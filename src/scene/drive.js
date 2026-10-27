import * as THREE from 'three';
import { createWorld, rightAt, LANE_OFFSET } from './world.js';
import { loadCar } from './car3d.js';

// ─────────────────────────────────────────────────────────────────────────────
// DRIVE — the closing sequence: the repaired i20 driving a winding sunset road,
// filmed by a camera that travels around it. Scroll progress p (0–1) drives
// everything:
//   • the car's distance along the road (its heading is the road's tangent, it
//     sits in the left lane, leans slightly in bends, wheels turn at road speed)
//   • the camera, which moves between SHOTS defined around the car: azimuth is
//     measured from the car's nose towards its right side, so 0° = straight on,
//     90° = right profile, 180° = straight behind, 270° = left profile.
// Shots blend with an ease-in-out, so the camera settles on each angle and then
// glides to the next: one continuous orbit, no cuts.
// ─────────────────────────────────────────────────────────────────────────────

export const SHOTS = [
  { p: 0.0, name: 'Front three-quarter', az: 38, el: 5, dist: 7.2, fov: 32, look: 0.75 },
  { p: 0.15, name: 'Side profile', az: 90, el: 3.5, dist: 7.6, fov: 30, look: 0.7 },
  { p: 0.3, name: 'Rear three-quarter', az: 142, el: 7, dist: 7.4, fov: 32, look: 0.75 },
  { p: 0.43, name: 'Rear', az: 180, el: 9, dist: 8.2, fov: 32, look: 0.8 },
  { p: 0.56, name: 'Opposite side', az: 238, el: 6, dist: 7.4, fov: 32, look: 0.75 },
  { p: 0.7, name: 'The road', az: 305, el: 13, dist: 28, fov: 42, look: 5.5 },
  // Final hero shot: low and wide so the car sits under the headline.
  { p: 0.87, name: 'Front three-quarter', az: 392, el: 4, dist: 10.5, fov: 32, look: 2.15 },
  { p: 1.0, name: 'Front three-quarter', az: 392, el: 4, dist: 10.5, fov: 32, look: 2.15 },
];

// Portion of the road travelled over the whole sequence (decelerating at the end).
const ROAD_START = 0.08;
const ROAD_END = 0.84;

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function shotAt(p) {
  let i = 0;
  while (i < SHOTS.length - 2 && p > SHOTS[i + 1].p) i++;
  const a = SHOTS[i];
  const b = SHOTS[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
  const out = { name: (t < 0.5 ? a : b).name };
  for (const k of ['az', 'el', 'dist', 'fov', 'look']) out[k] = lerp(a[k], b[k], t);
  return out;
}

export async function startDrive(canvas, { onShot } = {}) {
  const mobile = innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const world = createWorld(renderer);
  const { car, wheels, wheelRadius } = await loadCar();
  world.scene.add(car);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 3000);
  // Soft key light from just above the camera, as on an automotive shoot at dusk:
  // the low sun rims the car from behind, this shapes the side facing us.
  const key = new THREE.DirectionalLight('#ffe6cf', 1.1);
  world.scene.add(key, key.target);
  const curve = world.curve;
  const roadLength = curve.getLength();

  const state = { p: 0, dirty: true, visible: false, shot: '' };
  const pos = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const look = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    state.dirty = true;
  }

  function update() {
    const p = state.p;
    // Road position: mostly constant speed, easing off for the final hero shot.
    const travel = p < 0.85 ? (p / 0.85) * 0.92 : 0.92 + (1 - Math.pow(1 - (p - 0.85) / 0.15, 2)) * 0.08;
    const u = lerp(ROAD_START, ROAD_END, travel);
    curve.getPointAt(u, pos);
    curve.getTangentAt(u, fwd);
    rightAt(curve, u, right);
    pos.addScaledVector(right, LANE_OFFSET);

    // Heading = road tangent. Lean into bends from the change in heading just ahead.
    car.position.copy(pos);
    car.lookAt(look.copy(pos).add(fwd));
    const ahead = curve.getTangentAt(Math.min(1, u + 0.01));
    const turn = fwd.x * ahead.z - fwd.z * ahead.x; // + = turning right
    car.rotateZ(THREE.MathUtils.clamp(-turn * 1.6, -0.035, 0.035));

    const spin = (u * roadLength) / wheelRadius;
    for (const w of wheels) w.rotation.x = spin;

    // Camera: orbit position around the car, framed so the car fits narrow screens.
    const s = shotAt(p);
    const az = THREE.MathUtils.degToRad(s.az);
    const el = THREE.MathUtils.degToRad(s.el);
    camera.fov = s.fov;
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(s.fov) / 2) * camera.aspect);
    const dist = Math.max(s.dist, 2.6 / Math.tan(hfov / 2));
    camera.position
      .copy(pos)
      .addScaledVector(fwd, Math.cos(az) * Math.cos(el) * dist)
      .addScaledVector(right, Math.sin(az) * Math.cos(el) * dist)
      .addScaledVector(up, Math.max(0.35, Math.sin(el) * dist + 0.4));
    camera.lookAt(look.copy(pos).addScaledVector(up, s.look));
    camera.updateProjectionMatrix();

    world.followSun(pos);
    key.position.copy(camera.position).addScaledVector(up, 3);
    key.target.position.copy(pos);
    world.sky.position.copy(camera.position);
    if (s.name !== state.shot) {
      state.shot = s.name;
      onShot?.(s.name, SHOTS.findIndex((x) => x.name === s.name));
    }
  }

  function frame() {
    if (!state.visible || !state.dirty) return;
    state.dirty = false;
    update();
    renderer.render(world.scene, camera);
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => {
    state.visible = e.isIntersecting;
    state.dirty = true;
  }).observe(canvas);
  resize();

  return {
    setProgress(p) {
      state.p = p;
      state.dirty = true;
    },
    frame,
    renderer,
  };
}
