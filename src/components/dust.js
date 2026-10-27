// ─────────────────────────────────────────────────────────────────────────────
// DUST — slow motes drifting through the workshop light cone in the hero.
// Plain 2D canvas, ~70 particles, DPR capped at 2, paused when off screen.
// ─────────────────────────────────────────────────────────────────────────────

export function createDust(canvas, { count = 70 } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };
  let w = 0;
  let h = 0;
  let raf = 0;
  let running = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const motes = Array.from({ length: count }, () => spawn(true));

  function spawn(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : -0.02,
      r: 0.4 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.012,
      vy: 0.004 + Math.random() * 0.014,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 50) / 1000;
    last = now;
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.phase += dt;
      m.x += (m.vx + Math.sin(m.phase * 0.7) * 0.004) * dt;
      m.y += m.vy * dt;
      if (m.y > 1.02 || m.x < -0.02 || m.x > 1.02) Object.assign(m, spawn(false));
      // Brightest inside the light cone (centre column, widening downwards).
      const coneHalfWidth = 0.08 + m.y * 0.22;
      const inCone = Math.max(0, 1 - Math.abs(m.x - 0.5) / coneHalfWidth);
      const alpha = (0.08 + inCone * 0.6) * (0.6 + Math.sin(m.phase * 2) * 0.4);
      ctx.fillStyle = `rgba(230,240,255,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
  io.observe(canvas);
  resize();
  window.addEventListener('resize', resize);

  return {
    destroy() {
      stop();
      io.disconnect();
      window.removeEventListener('resize', resize);
    },
  };
}
