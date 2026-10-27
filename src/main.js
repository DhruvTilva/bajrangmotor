// Fonts (self-hosted via @fontsource)
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/anek-gujarati/gujarati-700.css'; // Gujarati: Anek, pairs with the Archivo wordmark

import './styles/base.css';
import './styles/components.css';
import './styles/sections.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { whatsappUrl } from './data/business.js';
import { reviews } from './data/reviews.js';
import { mountCar } from './components/car.js';
import { createDust } from './components/dust.js';
import { initNav } from './components/nav.js';
import { initServices } from './components/services.js';
import { initFilm } from './components/film.js';
import { initRig } from './components/rig.js';
import { initCursor, initMagnetic, initLoupe, finePointer } from './components/pointer.js';
import { initReveals } from './animations/reveals.js';
import { initHero, staticHero } from './animations/hero.js';
import { initJourney, staticJourney } from './animations/journey.js';
import { initClosing, staticClosing, initDrive } from './animations/closing.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
root.classList.add('app-ready');
const motion = root.classList.contains('motion');

// ── Content that depends on configuration ───────────────────────────────────
if (whatsappUrl) document.querySelectorAll('[data-whatsapp]').forEach((el) => (el.hidden = false));

if (reviews.length) {
  const box = document.querySelector('[data-reviews]');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  box.innerHTML = reviews
    .map((r) => `<figure class="review"><blockquote>“${esc(r.quote)}”</blockquote><figcaption>${esc(r.author)} · ${esc(r.source)}${r.date ? ` · ${esc(r.date)}` : ''}</figcaption></figure>`)
    .join('');
  box.hidden = false;
}

// ── Cars ────────────────────────────────────────────────────────────────────
const carEl = (name) => document.querySelector(`[data-car="${name}"]`);
const heroCar = mountCar(carEl('hero'), { beam: true, eager: true });
const journeyCar = mountCar(carEl('journey'), { lines: true, beam: true });
const servicesCar = mountCar(carEl('services'));
const closingCar = mountCar(carEl('closing'), { beam: true });
gsap.set(servicesCar, { '--lights': 0.4 });

// ── Behaviour ───────────────────────────────────────────────────────────────
let lenis = null;

if (motion) {
  // Smooth scrolling on desktop wheels/trackpads; touch keeps native scrolling.
  lenis = new Lenis({ anchors: { offset: 0 }, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  initHero(heroCar);
  initJourney(journeyCar);
  initClosing(closingCar);
  initDrive();
  initReveals();
  createDust(document.querySelector('[data-dust]'));

  if (finePointer()) {
    initCursor();
    initMagnetic();
    initLoupe();
  }
} else {
  staticHero(heroCar);
  staticJourney(journeyCar);
  staticClosing(closingCar);
}

initServices(document.querySelector('[data-explorer]'), { animate: motion });
initFilm(document.querySelector('[data-film]'), { autoplay: motion });
initRig({ animate: motion });
initNav({ lenis });

// Layout can shift once web fonts and lazy images arrive; re-measure pins.
document.fonts?.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());
