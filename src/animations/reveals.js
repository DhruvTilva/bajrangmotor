import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ─────────────────────────────────────────────────────────────────────────────
// REVEALS — shared scroll-in motion, driven by data attributes in the HTML:
//   data-split         heading lines rise out of a mask (split on <br>)
//   data-reveal        text/blocks lift and fade in
//   data-reveal-photo  photos unroll top-down, like a shutter going up
//   data-parallax-img  image drifts inside its frame
//   data-parallax="n"  element drifts horizontally by n% across its pass
// ─────────────────────────────────────────────────────────────────────────────

export function splitLines(el) {
  const lines = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = lines.map((l) => `<span class="split-line"><span>${l.trim()}</span></span>`).join('');
  return el.querySelectorAll('.split-line > span');
}

export function initReveals() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const lines = splitLines(el);
    gsap.from(lines, {
      yPercent: 110,
      duration: 1.1,
      ease: 'power4.out',
      stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  gsap.set('[data-reveal]', { autoAlpha: 0, y: 28 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true }),
  });

  document.querySelectorAll('[data-reveal-photo]').forEach((fig) => {
    const target = fig.querySelector('.photo__frame') || fig;
    gsap.fromTo(
      target,
      { clipPath: 'inset(0% 0% 100% 0%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 1.3,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: fig, start: 'top 85%' },
      },
    );
  });

  document.querySelectorAll('[data-parallax-img]').forEach((frame) => {
    gsap.fromTo(
      frame.querySelector('img'),
      { yPercent: -6 },
      { yPercent: 6, ease: 'none', scrollTrigger: { trigger: frame, scrub: true } },
    );
  });

  // Count-up numbers (the "25+ years" figure).
  document.querySelectorAll('[data-count-to]').forEach((el) => {
    const counter = { n: 0 };
    gsap.to(counter, {
      n: +el.dataset.countTo,
      duration: 1.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => (el.textContent = Math.round(counter.n)),
    });
  });

  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const amount = parseFloat(el.dataset.parallax) || 10;
    gsap.fromTo(el, { xPercent: 0 }, { xPercent: amount, ease: 'none', scrollTrigger: { trigger: el.parentElement, scrub: true } });
  });
}
