import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ─────────────────────────────────────────────────────────────────────────────
// NAV — scrolled state, reading progress, active section, mobile menu and the
// mobile quick-action bar.
// ─────────────────────────────────────────────────────────────────────────────

export function initNav({ lenis } = {}) {
  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  const progress = document.querySelector('[data-progress]');
  const quickbar = document.querySelector('[data-quickbar]');
  const links = [...document.querySelectorAll('.nav__links a')];

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', open);
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) menu.querySelector('a').focus();
  }
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setMenu(false);
      toggle.focus();
    }
  });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      nav.classList.toggle('is-scrolled', self.scroll() > 20);
      progress.style.transform = `scaleX(${self.progress.toFixed(4)})`;
      quickbar?.classList.toggle('is-visible', self.scroll() > window.innerHeight * 0.85);
    },
  });

  links.forEach((link) => {
    const section = document.querySelector(link.getAttribute('href'));
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => link.classList.toggle('is-active', self.isActive),
    });
  });
}
