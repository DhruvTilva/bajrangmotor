import { gsap } from 'gsap';
import { WHEEL_RADIUS_RATIO, CAR_VIEWBOX, GROUND, HEADING } from './car.js';

// ─────────────────────────────────────────────────────────────────────────────
// ROAD — the road the car drives on, built in the car photo's own perspective.
//
// The car photo is a front three-quarter view, so its direction of travel on
// screen is HEADING (right and slightly towards camera). The roadway is laid out
// from the photo's measured tyre contact points along that heading, converging
// gently towards a vanishing point behind the car, and the horizon is set to
// the photo's camera eye level. Everything is recomputed from the car's resting
// box on resize, so road and car stay aligned at any screen size.
//
// The camera tracks the car: at `state.speed` the centre-line dashes slide back
// along the road, distant poles/hills drift, and the linked car's wheels turn at
// exactly the matching ground speed. Runs only while the scene is on screen.
// ─────────────────────────────────────────────────────────────────────────────

const PX_PER_SECOND = 1500; // ground speed at speed 1
const DEPTH = { hills: 0.05, poles: 0.42 };

// Road cross-section, in metres measured from the car's left-side tyre line
// (India drives on the left, so the car's lane runs from the left edge to the centre line).
// The i20 is 1.73 m wide, so it sits in the middle of a 3.8 m lane with ~1 m either side.
const ROAD = { asphalt: [-1.6, 6.4], edges: [-1.2, 6.1], centre: 2.6, dash: 2.5, gap: 4, line: 0.1 };
const VANISH = 9000; // distance (image units) behind the rear wheel where road lines converge

const svgNS = 'http://www.w3.org/2000/svg';
let uid = 0;

/**
 * root   – the .road element (scene background)
 * car    – the .car element (wheel rotation)
 * getBox – returns the car's resting box {left, top, width, height} in root coordinates
 */
export function createRoad(root, { car = null, getBox = null, speed = 0 } = {}) {
  const state = { speed };
  const layers = [...root.querySelectorAll('[data-road-layer]')].map((el) => ({
    el,
    depth: DEPTH[el.dataset.roadLayer] ?? 1,
    tile: 1,
    offset: 0,
  }));
  let rot = 0;
  let dashOffset = 0;
  let visible = false;

  // Roadway drawing
  const id = `road-clip-${++uid}`;
  const way = document.createElementNS(svgNS, 'svg');
  way.setAttribute('class', 'road__way');
  way.setAttribute('aria-hidden', 'true');
  way.innerHTML = `<defs><clipPath id="${id}"><rect x="0" width="100%" height="100%" /></clipPath></defs>
    <g clip-path="url(#${id})">
      <path class="road__asphalt" /><path class="road__edge" /><path class="road__edge" /><path class="road__centre" />
    </g>`;
  root.querySelector('.road__surface')?.after(way);
  const clipRect = way.querySelector('rect');
  const asphalt = way.querySelector('.road__asphalt');
  const [edgeNear, edgeFar] = way.querySelectorAll('.road__edge');
  const centre = way.querySelector('.road__centre');

  function layoutRoad() {
    if (!getBox) return;
    const box = getBox();
    const s = box.width / CAR_VIEWBOX.width; // px per image unit
    const lat = GROUND.unitsPerMetre;
    const lon = GROUND.unitsPerMetreLong;
    const r = GROUND.rearContact;

    // Point on the ground: t = image units along the heading from the rear contact,
    // m = metres to the car's right; lateral spacing narrows towards the vanishing point.
    const at = (t, m) => {
      const k = (VANISH + t) / VANISH;
      const x = r.x + HEADING.x * t + GROUND.lateral.x * m * lat * k;
      const y = r.y + HEADING.y * t + GROUND.lateral.y * m * lat * k;
      return `${(box.left + x * s).toFixed(1)} ${(box.top + y * s).toFixed(1)}`;
    };
    const line = (m) => `M ${at(-VANISH * 0.97, m)} L ${at(VANISH, m)}`;
    const [a0, a1] = ROAD.asphalt;
    asphalt.setAttribute('d', `M ${at(-VANISH * 0.97, a0)} L ${at(VANISH, a0)} L ${at(VANISH, a1)} L ${at(-VANISH * 0.97, a1)} Z`);
    edgeNear.setAttribute('d', line(ROAD.edges[0]));
    edgeFar.setAttribute('d', line(ROAD.edges[1]));
    centre.setAttribute('d', line(ROAD.centre));
    const dash = ROAD.dash * lon * s;
    const gap = ROAD.gap * lon * s;
    centre.style.strokeDasharray = `${dash.toFixed(1)} ${gap.toFixed(1)}`;
    // Painted line width: ROAD.line metres across, foreshortened by the angle between
    // the car's lateral axis and the road direction on screen.
    const foreshorten = Math.abs(GROUND.lateral.x * HEADING.y - GROUND.lateral.y * HEADING.x);
    way.style.setProperty('--line', `${Math.max(1.2, ROAD.line * lat * foreshorten * s).toFixed(2)}px`);

    // Horizon at the photo's camera eye level; the ground (and road) starts there.
    const horizon = box.top + box.height * GROUND.horizon;
    root.style.setProperty('--horizon', `${horizon.toFixed(1)}px`);
    clipRect.setAttribute('y', horizon.toFixed(1));
  }

  function measure() {
    for (const layer of layers) {
      if (layer.el.dataset.roadLayer === 'hills') layer.tile = 1600;
      else layer.tile = (layer.el.offsetHeight * 520) / 320; // poles: tile scales with layer height
    }
    layoutRoad();
  }

  function tick(_time, deltaMs) {
    if (!visible || state.speed === 0) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const distance = state.speed * PX_PER_SECOND * dt;
    for (const layer of layers) {
      layer.offset = (layer.offset + distance * layer.depth) % layer.tile;
      layer.el.style.transform = `translate3d(${-layer.offset}px,0,0)`;
    }
    // Positive offset slides the dashes back along the road, towards the vanishing point.
    dashOffset += distance;
    centre.style.strokeDashoffset = dashOffset.toFixed(1);
    if (car) {
      const radius = car.offsetWidth * WHEEL_RADIUS_RATIO || 1;
      rot += (distance / radius) * (180 / Math.PI);
      car.style.setProperty('--rot', (rot % 360).toFixed(2));
    }
  }

  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(root);
  const ro = new ResizeObserver(measure);
  ro.observe(root);
  measure();
  gsap.ticker.add(tick);

  return {
    state,
    destroy() {
      io.disconnect();
      ro.disconnect();
      gsap.ticker.remove(tick);
      way.remove();
    },
  };
}
