import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { finePointer } from '../components/pointer.js';
import { WHEEL_RADIUS_RATIO, HEADING, CAR_VIEWBOX } from '../components/car.js';

// ─────────────────────────────────────────────────────────────────────────────
// HERO — "arrival at the real garage"
//
// Intro (on load, ~3 s; the headline is readable after ~1.6 s):
//   1. The workshop tube light flickers on over the real photo of the garage front.
//   2. The car drives in from the left and brakes; wheel rotation is derived from
//      distance travelled and the nose dips under braking, then settles.
//   3. Headline lines rise out of their masks; supporting copy fades in.
//
// Scroll (pinned):
//   The car pulls away to the right while the camera pushes into the open bay
//   towards the alignment rig on the back wall, then match-cuts to the real
//   close-up photo of that same rig. "Step inside."
// ─────────────────────────────────────────────────────────────────────────────

// Where the alignment rig sits in garage-front.webp (fractions of the image).
const RIG_FOCUS = { x: 0.645, y: 0.55 };

// Transform-origin (px) of a focal point inside an object-fit: cover image.
function coverFocus(img, focus) {
  const box = { width: img.offsetWidth, height: img.offsetHeight }; // layout size, ignores transforms
  const iw = img.naturalWidth || +img.getAttribute('width');
  const ih = img.naturalHeight || +img.getAttribute('height');
  const scale = Math.max(box.width / iw, box.height / ih);
  const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
  const rw = iw * scale;
  const rh = ih * scale;
  return `${(box.width - rw) * px + RIG_FOCUS.x * rw}px ${(box.height - rh) * py + RIG_FOCUS.y * rh}px`;
}

export function initHero(car) {
  const hero = document.querySelector('[data-hero]');
  const wrapper = hero.querySelector('[data-hero-car]');
  const photo = hero.querySelector('[data-hero-photo]');
  const photoImg = photo.querySelector('img');
  const lamp = hero.querySelector('[data-hero-lamp]');
  const lines = hero.querySelectorAll('.hero__title .line > span');
  const fades = hero.querySelectorAll('[data-hero-fade]');

  // ── Intro ──────────────────────────────────────────────────────────────────
  const drive = { p: 0 };
  const startX = () => -(window.innerWidth * 0.5 + car.offsetWidth * 0.6);
  const wheelRadius = () => car.offsetWidth * WHEEL_RADIUS_RATIO;
  const applyDrive = () => {
    const x = startX() * (1 - drive.p);
    // The photo is a front three-quarter view: the car travels along its own heading
    // (right and towards camera), growing slightly as it approaches.
    const travelled = (x - startX()) / HEADING.x;
    gsap.set(car, {
      x,
      y: x * (HEADING.y / HEADING.x),
      scale: 0.86 + 0.14 * drive.p,
      '--rot': (travelled / wheelRadius()) * (180 / Math.PI),
    });
  };

  // Lines start hidden via CSS; hand the transform over to GSAP.
  gsap.set(lines, { y: 0, yPercent: 110 });
  applyDrive();

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .set(wrapper, { opacity: 1 })
    .fromTo(lamp, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'none', keyframes: { opacity: [0, 0.8, 0.1, 0.9, 0.3, 1] } }, 0.15)
    .fromTo(hero, { '--night': 0.95 }, { '--night': 0.42, duration: 1.4 }, 0.2)
    .fromTo(photo, { scale: 1.08 }, { scale: 1, duration: 3.4, ease: 'power2.out' }, 0)
    .fromTo(car, { '--lights': 0 }, { '--lights': 1, duration: 0.3 }, 0.35)
    // Arrival: strong deceleration curve = braking into the light.
    .to(drive, { p: 1, duration: 2.1, ease: 'power3.out', onUpdate: applyDrive }, 0.45)
    .to(car, { '--pitch': 1.4, '--lift': 2, duration: 0.45, ease: 'power2.in' }, 1.95)
    .to(car, { '--pitch': 0, '--lift': 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' }, 2.4)
    .to(car, { '--lights': 0.55, duration: 1 }, 2.6)
    .to(lines, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.1 }, 1.25)
    .to(fades, { opacity: 1, duration: 1, stagger: 0.12 }, 0.5);

  // ── Pointer parallax (CSS `translate`, so it composes with GSAP transforms) ─
  if (finePointer()) {
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    hero.addEventListener('pointermove', (e) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
    hero.addEventListener('pointerleave', () => Object.assign(target, { x: 0, y: 0 }));
    const layers = [
      [photo, -14, -8],
      [lamp, -6, -3],
      [wrapper, 10, 3],
    ];
    gsap.ticker.add(() => {
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      for (const [el, dx, dy] of layers) el.style.translate = `${(current.x * dx).toFixed(2)}px ${(current.y * dy).toFixed(2)}px`;
    });
  }

  // ── Scroll: pull away, push into the bay, match-cut to the rig ─────────────
  // The push aims at the rig, whose on-screen position depends on viewport shape.
  const aimCamera = () => (photo.style.transformOrigin = coverFocus(photoImg, RIG_FOCUS));
  aimCamera();
  ScrollTrigger.addEventListener('refreshInit', aimCamera);
  gsap.set(wrapper, { x: 0, xPercent: -50 }); // replaces the CSS translateX(-50%) centring
  const scroll = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: '+=140%',
      pin: true,
      scrub: 0.8,
      // If the visitor scrolls before the intro finishes, jump it to its end state.
      onUpdate: (self) => self.progress > 0.01 && intro.isActive() && intro.progress(1),
    },
  });
  scroll
    .to('[data-hero-content]', { yPercent: -18, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 0)
    // Pulls away along its heading: 150% of its width across, the matching distance down.
    .to(wrapper, { xPercent: 100, yPercent: 150 * (CAR_VIEWBOX.width / CAR_VIEWBOX.height) * (HEADING.y / HEADING.x), duration: 0.42, ease: 'power2.in' }, 0.04)
    .to(car, { '--rot': '+=1080', '--lights': 1, duration: 0.42, ease: 'power2.in' }, 0.04)
    .to(car, { '--pitch': -0.8, duration: 0.12 }, 0.04)
    .to([lamp, '[data-dust]'], { autoAlpha: 0, duration: 0.25 }, 0.1)
    .to(photo, { scale: 3.1, duration: 0.72, ease: 'power2.inOut' }, 0.12)
    .to(hero, { '--night': 0.15, duration: 0.5 }, 0.12)
    .fromTo('[data-hero-closeup]', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.14 }, 0.72)
    .fromTo('[data-hero-closeup] img', { scale: 1.35 }, { scale: 1, duration: 0.28, ease: 'power2.out' }, 0.72)
    .fromTo('[data-hero-inside]', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.14 }, 0.84)
    .to({}, { duration: 0.06 });
}

// Reduced motion: a composed still of the parked car, lights on.
export function staticHero(car) {
  gsap.set(car, { '--lights': 0.6 });
}
