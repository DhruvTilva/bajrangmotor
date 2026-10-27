// ─────────────────────────────────────────────────────────────────────────────
// RIG — footer readout styled after the garage's 3D alignment machine.
// Each gauge swings from an out-of-spec reading into its green spec band while
// the digits count; the balancer spins up and its imbalance drops to 0 g.
// Runs when scrolled into view, replays on hover. Values are illustrative.
// Reduced motion: shows the final in-spec values, no animation.
// ─────────────────────────────────────────────────────────────────────────────

const SWEEP = 180; // the dial is a half circle
const ease = (t) => 1 - Math.pow(1 - t, 3);

function polar(deg, r) {
  const a = ((180 - deg) * Math.PI) / 180;
  return [60 + r * Math.cos(a), 62 - r * Math.sin(a)];
}

function setupGauge(g) {
  const n = (k) => parseFloat(g.dataset[k]);
  const toDeg = (v) => ((v - n('min')) / (n('max') - n('min'))) * SWEEP;
  const [x1, y1] = polar(toDeg(n('lo')), 50);
  const [x2, y2] = polar(toDeg(n('hi')), 50);
  g.querySelector('.rig__spec').setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}A50 50 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  const needle = g.querySelector('.rig__needle');
  const val = g.querySelector('[data-val]');
  const state = g.querySelector('[data-state]');
  const decimals = (g.dataset.end.split('.')[1] || '').length;
  const draw = (v) => {
    const [x, y] = polar(toDeg(v), 40);
    needle.setAttribute('x2', x.toFixed(1));
    needle.setAttribute('y2', y.toFixed(1));
    const ok = v >= n('lo') && v <= n('hi');
    val.textContent = (v > 0 ? '+' : '') + v.toFixed(decimals);
    g.classList.toggle('is-off', !ok);
    state.textContent = ok ? 'In spec' : 'Adjusting';
  };
  return { draw, from: n('start'), to: n('end') };
}

export function initRig({ animate = true } = {}) {
  const rig = document.querySelector('[data-rig]');
  if (!rig) return;
  const gauges = [...rig.querySelectorAll('[data-gauge]')].map(setupGauge);
  const bal = rig.querySelector('[data-balance]');
  const spin = bal.querySelector('[data-spin]');
  const grams = bal.querySelector('[data-grams]');
  const bstate = bal.querySelector('[data-bstate]');
  const weight = bal.querySelector('[data-weight]');

  const finish = () => {
    gauges.forEach((g) => g.draw(g.to));
    grams.textContent = '0';
    bal.classList.remove('is-off');
    bstate.textContent = 'Balanced';
  };
  if (!animate) return finish();

  let raf = 0;
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    const start = performance.now();
    cancelAnimationFrame(raf);
    const tick = (now) => {
      const t = (now - start) / 1000;
      gauges.forEach((g, i) => {
        const k = Math.min(1, Math.max(0, (t - 0.3 - i * 0.35) / 1.6));
        g.draw(g.from + (g.to - g.from) * ease(k));
      });
      // Balancer: spin up for 1.2 s, run, brake; imbalance 35 g → 0 g once the weight is fitted.
      const speed = t < 1.2 ? t / 1.2 : t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 1);
      spin.style.transform = `rotate(${(t * 900 * speed) % 360}deg)`;
      const g = t < 2.2 ? 35 : Math.max(0, Math.round(35 * (1 - (t - 2.2) / 1.2)));
      grams.textContent = g;
      bal.classList.toggle('is-off', g > 0);
      bstate.textContent = g > 0 ? (t < 2.2 ? 'Measuring' : 'Fitting weight') : 'Balanced';
      weight.style.opacity = t > 2.2 ? 1 : 0;
      if (t < 3.8) raf = requestAnimationFrame(tick);
      else { running = false; finish(); }
    };
    raf = requestAnimationFrame(tick);
  };
  gauges.forEach((g) => g.draw(g.from));
  grams.textContent = '35';
  bal.classList.add('is-off');
  bstate.textContent = 'Measuring';
  new IntersectionObserver(([e]) => e.isIntersecting && run(), { threshold: 0.5 }).observe(rig);
  rig.addEventListener('pointerenter', run);
}
