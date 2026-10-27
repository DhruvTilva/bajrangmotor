import { gsap } from 'gsap';

// ─────────────────────────────────────────────────────────────────────────────
// POINTER — custom cursor, magnetic buttons and the photo loupe.
// Only enabled for fine pointers (mouse/trackpad) with motion allowed;
// touch devices keep native behaviour.
// ─────────────────────────────────────────────────────────────────────────────

export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function initCursor() {
  const el = document.querySelector('[data-cursor-el]');
  if (!el) return;
  const label = el.querySelector('span');
  document.documentElement.classList.add('has-cursor');
  const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    xTo(e.clientX);
    yTo(e.clientY);
    el.classList.add('is-visible');
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('is-visible'));

  // Contextual states, resolved by delegation so dynamically rendered elements work too.
  document.addEventListener('pointerover', (e) => {
    const labelled = e.target.closest('[data-cursor]');
    const inspect = e.target.closest('[data-loupe], .explorer__stage');
    el.classList.toggle('is-label', !!labelled);
    el.classList.toggle('is-inspect', !labelled && !!inspect);
    if (labelled) label.textContent = labelled.dataset.cursor;
  });
}

export function initMagnetic() {
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    btn.addEventListener('pointerleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)', overwrite: true });
    });
  });
}

// Magnifying lens over workshop photos: "look closer" at the real equipment.
export function initLoupe() {
  const ZOOM = 2;
  document.querySelectorAll('[data-loupe]').forEach((frame) => {
    const img = frame.querySelector('img');
    const lens = document.createElement('div');
    lens.className = 'loupe';
    lens.setAttribute('aria-hidden', 'true');
    frame.appendChild(lens);
    let rect;
    frame.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      rect = frame.getBoundingClientRect();
      lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
      lens.style.backgroundSize = `${rect.width * ZOOM}px ${rect.height * ZOOM}px`;
      lens.classList.add('is-on');
    });
    frame.addEventListener('pointermove', (e) => {
      if (!rect) return;
      rect = frame.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      lens.style.left = `${x}px`;
      lens.style.top = `${y}px`;
      lens.style.backgroundPosition = `${-(x * ZOOM - 100)}px ${-(y * ZOOM - 100)}px`;
    });
    frame.addEventListener('pointerleave', () => {
      rect = null;
      lens.classList.remove('is-on');
    });
  });
}
