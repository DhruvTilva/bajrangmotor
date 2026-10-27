import { gsap } from 'gsap';
import { HEADING } from '../components/car.js';

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY — the signature sequence: Problem → Inspection → Repair → Ready → Road
//
// One pinned, scrubbed timeline of 10 units (2 per stage):
//   0  PROBLEM     blueprint car sagging at the front, warnings pulse.
//                  Backdrop: real engine-bay photo.
//   2  INSPECTION  camera leans in, a scan line sweeps the car, measurement
//                  lines draw (wheelbase, camber/toe, tread, suspension, battery).
//                  Backdrop: the real 3D alignment rig.
//   4  REPAIR      the sag comes out, car levels, wheels spin up on the
//                  balancer; warnings turn to checks. Backdrop: real tyre bay.
//   6  READY       a workshop light sweep passes over the car; behind it the
//                  blueprint becomes the real photograph, headlamps come on.
//   8  ROAD        the car spins up its wheels and pulls away along its heading;
//                  the winding road itself follows in the closing drive (scene/drive.js).
// ─────────────────────────────────────────────────────────────────────────────

export function initJourney(car) {
  const section = document.querySelector('[data-journey]');
  const stages = section.querySelectorAll('[data-stage]');
  const backdrops = section.querySelectorAll('[data-backdrop]');
  const scene = section.querySelector('.journey__scene');
  const sweep = section.querySelector('[data-sweep]');
  const ov = (name) => section.querySelector(`[data-ov="${name}"]`);

  // Opening state is visible before the pin starts.
  gsap.set(car, { '--paint': 0, '--flat': 1, '--pitch': 1.3, '--lights': 0, '--rot': 0 });
  gsap.set(stages[0], { autoAlpha: 1 });
  gsap.set(backdrops[0], { opacity: 1 });
  gsap.set(ov('warn'), { opacity: 1 });
  gsap.set(ov('scan'), { x: 60 });
  gsap.set(ov('ok').children, { scale: 0.4, transformOrigin: 'center' });

  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerWidth < 760 ? 420 : 520}%`,
      pin: section.querySelector('.journey__pin'),
      scrub: 1,
    },
  });

  const toStage = (i, t) =>
    tl
      .to(stages[i - 1], { autoAlpha: 0, y: -30, duration: 0.45, ease: 'power2.in' }, t)
      .fromTo(stages[i], { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, t + 0.35);

  tl.to('[data-rail]', { scaleY: 1, duration: 10, ease: 'none' }, 0);

  // 02 · Inspection
  toStage(1, 2);
  tl.to(backdrops[0], { opacity: 0, duration: 0.8 }, 2)
    .to(backdrops[1], { opacity: 1, duration: 0.8 }, 2)
    .to(ov('warn'), { opacity: 0.3, duration: 0.4 }, 2)
    .to(scene, { scale: 1.1, transformOrigin: '78% 75%', duration: 1 }, 2)
    .to(ov('scan'), { opacity: 1, duration: 0.15 }, 2.2)
    .to(ov('scan'), { x: 2240, duration: 1.4, ease: 'none' }, 2.2)
    .to(ov('scan'), { opacity: 0, duration: 0.2 }, 3.5)
    .fromTo(ov('dims'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 2.6)
    .to(scene, { scale: 1, duration: 0.8 }, 3.6);

  // 03 · Repair
  toStage(2, 4);
  tl.to(backdrops[1], { opacity: 0, duration: 0.8 }, 4)
    .to(backdrops[2], { opacity: 1, duration: 0.8 }, 4)
    .to(ov('dims'), { opacity: 0, duration: 0.4 }, 4)
    .to(ov('warn'), { opacity: 0, duration: 0.4 }, 4.3)
    .to(car, { '--flat': 0, '--pitch': 0, duration: 1.1 }, 4.3)
    .to(car, { '--rot': 720, duration: 1.3 }, 4.6)
    .to(ov('ok'), { opacity: 1, duration: 0.3 }, 5.1)
    .to(ov('ok').children, { scale: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(2)' }, 5.1);

  // 04 · Ready: the light sweep turns drawing into paint
  toStage(3, 6);
  tl.to(backdrops[2], { opacity: 0, duration: 0.8 }, 6)
    .to(ov('ok'), { opacity: 0, duration: 0.4 }, 6.1)
    .to(sweep, { opacity: 1, duration: 0.2 }, 6.2)
    .fromTo(sweep, { left: '0%' }, { left: '100%', duration: 1.3, ease: 'none' }, 6.3)
    .to(car, { '--paint': 1, duration: 1.3, ease: 'none' }, 6.3)
    .to(sweep, { opacity: 0, duration: 0.25 }, 7.5)
    .to(car, { '--lights': 1, duration: 0.3, ease: 'power1.in' }, 7.5);

  // 05 · Back on the road
  toStage(4, 8);
  tl.to(car, { '--rot': '+=1440', duration: 1.9, ease: 'power2.in' }, 8.2)
    .to(car, { '--pitch': -0.7, duration: 0.4, ease: 'power2.out' }, 8.2)
    .to(car, { '--pitch': 0, duration: 0.8, ease: 'power2.inOut' }, 8.6)
    // Finally it pulls away, straight down its own lane (along the photo's heading).
    .to(scene, {
      x: () => window.innerWidth * 0.75,
      y: () => window.innerWidth * 0.75 * (HEADING.y / HEADING.x),
      duration: 0.9,
      ease: 'power2.in',
    }, 9.1);
}

// Reduced motion: show the finished car.
export function staticJourney(car) {
  gsap.set(car, { '--paint': 1, '--lights': 0.6 });
}
