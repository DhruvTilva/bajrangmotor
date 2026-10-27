import { gsap } from 'gsap';
import { services } from '../data/services.js';
import { business } from '../data/business.js';
import { CAR_VIEWBOX } from './car.js';
import { finePointer } from './pointer.js';

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE EXPLORER — hotspots placed in the car's own coordinate space, so they
// stay locked to the drawing at any size. Desktop: moving near a part selects
// it. Touch: tap a hotspot. Keyboard/screen readers: the tab list.
// ─────────────────────────────────────────────────────────────────────────────

const pct = (v, total) => `${((v / total) * 100).toFixed(3)}%`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function initServices(root, { animate = true } = {}) {
  const stage = root.querySelector('.explorer__stage');
  const hotspotLayer = root.querySelector('[data-hotspots]');
  const tabs = root.querySelector('[data-service-tabs]');
  const panel = root.querySelector('[data-service-panel]');
  let current = null;

  hotspotLayer.innerHTML = services
    .map(
      (s) => `<button class="hotspot" type="button" tabindex="-1" aria-hidden="true" data-id="${s.id}"
        style="left:${pct(s.hotspot.x, CAR_VIEWBOX.width)};top:${pct(s.hotspot.y, CAR_VIEWBOX.height)}">
        <span class="hotspot__label">${esc(s.zone)}</span></button>`,
    )
    .join('');

  tabs.innerHTML = services
    .map(
      (s) => `<button class="chip" type="button" role="tab" id="tab-${s.id}" aria-controls="service-panel"
        aria-selected="false" tabindex="-1" data-id="${s.id}">${esc(s.title.replace('Computerised ', ''))}</button>`,
    )
    .join('');
  panel.id = 'service-panel';

  function render(s, index) {
    const tag = s.source === 'signboard' ? '<span class="tag">On the board</span>' : '';
    panel.setAttribute('aria-labelledby', `tab-${s.id}`);
    panel.innerHTML = `
      <div class="panel__meta"><span>S-${String(index + 1).padStart(2, '0')} · ${esc(s.zone)}</span>${tag}</div>
      <h3 class="panel__title">${esc(s.title)}</h3>
      <p class="panel__body">${esc(s.body)}</p>
      <p class="panel__signs-label">Worth mentioning when you call</p>
      <ul class="panel__signs">${s.signs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <a class="btn btn--ghost btn--small panel__cta" href="tel:${business.phone.tel}" data-cursor="Call">Ask about this · ${business.phone.display}</a>`;
  }

  function select(id, { focusTab = false } = {}) {
    if (id === current) return;
    current = id;
    const index = services.findIndex((s) => s.id === id);
    const s = services[index];
    hotspotLayer.querySelectorAll('.hotspot').forEach((h) => h.classList.toggle('is-active', h.dataset.id === id));
    tabs.querySelectorAll('.chip').forEach((t) => {
      const on = t.dataset.id === id;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      if (on && focusTab) t.focus();
    });
    stage.style.setProperty('--mx', pct(s.hotspot.x, CAR_VIEWBOX.width));
    stage.style.setProperty('--my', pct(s.hotspot.y, CAR_VIEWBOX.height));
    if (animate) {
      gsap.to(panel, {
        autoAlpha: 0, y: 8, duration: 0.15, overwrite: true,
        onComplete: () => {
          render(s, index);
          gsap.fromTo(panel.children, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out' });
          gsap.to(panel, { autoAlpha: 1, y: 0, duration: 0.3 });
        },
      });
    } else {
      render(s, index);
    }
  }

  hotspotLayer.addEventListener('click', (e) => {
    const h = e.target.closest('.hotspot');
    if (h) select(h.dataset.id);
  });
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('.chip');
    if (t) select(t.dataset.id);
  });
  tabs.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = services.findIndex((s) => s.id === current);
    let next = e.key === 'Home' ? 0 : e.key === 'End' ? services.length - 1 : i + keys[e.key];
    next = (next + services.length) % services.length;
    select(services[next].id, { focusTab: true });
  });

  // Desktop: the nearest part to the pointer is "inspected" automatically.
  if (finePointer()) {
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * CAR_VIEWBOX.width;
      const y = ((e.clientY - r.top) / r.height) * CAR_VIEWBOX.height;
      let best = null;
      let bestDist = CAR_VIEWBOX.width * 0.1; // car image units
      for (const s of services) {
        const d = Math.hypot(s.hotspot.x - x, s.hotspot.y - y);
        if (d < bestDist) { best = s; bestDist = d; }
      }
      if (best) select(best.id);
      else {
        stage.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        stage.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      }
    });
  }

  select(services[0].id);
}
