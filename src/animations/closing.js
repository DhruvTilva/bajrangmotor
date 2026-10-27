import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createRoad } from '../components/road.js';
import { finePointer } from '../components/pointer.js';
import { HEADING } from '../components/car.js';

// ─────────────────────────────────────────────────────────────────────────────
// CLOSING — two versions of the final scene:
//   • 3D drive (initDrive): the i20 on a winding sunset road, filmed from all
//     sides as you scroll. Loaded lazily, only where WebGL is available.
//   • 2D fallback (initClosing): the car photo cruising on a flat road; shown for
//     reduced motion, without WebGL, or while/if the 3D scene fails to load.
// ─────────────────────────────────────────────────────────────────────────────

const CRUISE = 0.5;

export function initClosing(car) {
  const section = document.querySelector('[data-closing]');
  const wrapper = section.querySelector('[data-closing-car]');
  // Resting box of the car (its CSS centring is a -50% shift, applied by GSAP below).
  const getBox = () => ({
    left: wrapper.offsetLeft - wrapper.offsetWidth / 2,
    top: wrapper.offsetTop,
    width: wrapper.offsetWidth,
    height: wrapper.offsetHeight,
  });
  const road = createRoad(section.querySelector('.road'), { car, getBox, speed: CRUISE });

  gsap.set(car, { '--lights': 1 });
  gsap.set(wrapper, { x: 0, xPercent: -50 });
  // Arrives from behind along its own lane: the photo's heading, not a sideways slide.
  const approach = () => window.innerWidth * 0.75;
  gsap.fromTo(wrapper, { x: () => -approach(), y: () => -approach() * (HEADING.y / HEADING.x) }, {
    x: 0,
    y: 0,
    ease: 'power2.out',
    scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 20%', scrub: 1, invalidateOnRefresh: true },
  });

  // Suspension bob while cruising.
  gsap.to(car, { '--lift': -1.6, duration: 0.42, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  if (finePointer()) {
    const speedTo = gsap.quickTo(road.state, 'speed', { duration: 1.2, ease: 'power2.out' });
    const pitchTo = gsap.quickTo(car, '--pitch', { duration: 0.8, ease: 'power2.out' });
    let lastNx = 0;
    section.addEventListener('pointermove', (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      speedTo(CRUISE + nx * 0.35);
      pitchTo(Math.max(-0.6, Math.min(0.6, (lastNx - nx) * 6))); // squat when speeding up, dip when slowing
      lastNx = nx;
    });
    section.addEventListener('pointerleave', () => { speedTo(CRUISE); pitchTo(0); });
  }
}

export function staticClosing(car) {
  gsap.set(car, { '--lights': 1 });
}

// ── 3D drive ────────────────────────────────────────────────────────────────

function webglAvailable() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function initDrive() {
  if (!webglAvailable()) return;
  const section = document.querySelector('[data-closing]');
  const canvas = section.querySelector('[data-drive-canvas]');
  const content = section.querySelector('.closing__content');
  const shotEl = section.querySelector('[data-drive-shot]');
  const indexEl = section.querySelector('[data-drive-index]');
  section.classList.add('has-drive');
  let drive = null;

  // The headline belongs to the final hero shot; hidden while the camera tours the car.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${innerWidth < 760 ? 380 : 460}%`,
      pin: true,
      scrub: 1,
      onUpdate: (self) => drive?.setProgress(self.progress),
    },
  });
  tl.fromTo(content, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.88)
    .fromTo('[data-drive-caption]', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.05 }, 0.86)
    .set({}, {}, 1);

  // Fetch three.js + the model once the visitor is within ~2 screens of the scene.
  const io = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    try {
      const { startDrive } = await import('../scene/drive.js');
      drive = await startDrive(canvas, {
        onShot: (name, i) => {
          shotEl.textContent = name;
          indexEl.textContent = String(i + 1).padStart(2, '0');
        },
      });
      drive.setProgress(tl.scrollTrigger.progress);
      gsap.ticker.add(drive.frame);
      section.classList.add('is-3d');
      canvas.addEventListener('webglcontextlost', () => section.classList.remove('is-3d'));
    } catch (err) {
      console.error('[drive] 3D car failed to load:', err);
      if (import.meta.env.DEV) {
        // Development: make the failure impossible to miss instead of quietly falling back.
        section.insertAdjacentHTML('beforeend',
          `<div class="drive__error" role="alert"><b>3D car not loaded (development notice)</b><span>${err.message}</span></div>`);
      }
      tl.scrollTrigger.kill(true);
      tl.progress(1);
      section.classList.remove('has-drive');
      ScrollTrigger.refresh();
    }
  }, { rootMargin: '200% 0px' });
  io.observe(section);
}
