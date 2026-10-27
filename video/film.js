// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORMATION FILM — "From broken to back on the road", 24 s at 24 fps.
//
// Every shot is rendered from the same 3D i20 used on the website, so the car is
// identical throughout. Two copies of it are loaded:
//   • damaged: dusty paint, scratched left flank, dented front-left bumper corner,
//     dead left headlamp (all procedural, see makeDamaged)
//   • clean:   the restored car (the model's own materials)
// In the transformation shot both stand in the same place and a moving light gate
// clips one into the other, so damage only ever changes where the light has passed.
//
// The garage itself is never faked: arrival/exit are composited over the real
// photo of the Bajrang Motors front (camera matched to that photo), and the
// inspection/repair montage uses the real workshop photographs.
//
// window.film.render(t) draws the frame at time t (seconds). Deterministic: no
// clocks, no randomness, so scripts/render-film.mjs can capture frame by frame.
// ─────────────────────────────────────────────────────────────────────────────
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import * as THREE from 'three';
import { createWorld, rightAt, LANE_OFFSET } from '../src/scene/world.js';
import { loadCar } from '../src/scene/car3d.js';

export const FPS = 24;
const XF = 0.4; // crossfade length (s) for photo transitions

const SHOTS = [
  { id: 'road-problem', start: 0, end: 3.6, num: '01', label: 'The problem' },
  { id: 'arrive', start: 3.6, end: 7.0, num: '02', label: 'Arriving at Bajrang Motors' },
  { id: 'photo-engine', start: 7.0, end: 8.6, num: '03', label: 'Inspection', photo: 'engine-bay', kb: [1.06, 1.16, -1.5, 0.5] },
  { id: 'scan', start: 8.6, end: 10.6, num: '03', label: 'Inspection' },
  { id: 'photo-rig', start: 10.6, end: 12.0, num: '04', label: 'Repair', photo: 'alignment-rig', kb: [1.14, 1.04, 1.2, 0] },
  { id: 'photo-tyre', start: 12.0, end: 13.2, num: '04', label: 'Repair', photo: 'tyre-bay', kb: [1.05, 1.13, 0, -1.5] },
  { id: 'transform', start: 13.2, end: 17.6, num: '05', label: 'Restored' },
  { id: 'exit', start: 17.6, end: 19.6, num: '06', label: 'Back on the road' },
  { id: 'road-final', start: 19.6, end: 24.0, num: '06', label: 'Back on the road' },
];
export const DURATION = SHOTS.at(-1).end;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (id) => document.getElementById(id);

// ── Renderer, worlds ─────────────────────────────────────────────────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.localClippingEnabled = true;
renderer.setClearColor(0x000000, 0);

const world = createWorld(renderer);
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 3000);

// Plate scene: car composited over a photograph (transparent background, shadows only).
const plate = new THREE.Scene();
plate.environment = world.scene.environment;
plate.environmentIntensity = 0.8;
const plateHemi = new THREE.HemisphereLight('#8d97c4', '#3a2a1e', 0.9);
const plateSun = new THREE.DirectionalLight('#ffc89a', 1.6);
plateSun.castShadow = true;
plateSun.shadow.mapSize.setScalar(2048);
Object.assign(plateSun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 40 });
plateSun.shadow.bias = -0.0004;
const plateKey = new THREE.DirectionalLight('#fff1e0', 0.9);
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.55 }));
catcher.receiveShadow = true;
plate.add(plateHemi, plateSun, plateSun.target, plateKey, plateKey.target, catcher);

// ── Cars ─────────────────────────────────────────────────────────────────────
const [clean, damaged] = await Promise.all([loadCar(), loadCar()]);
const carInv = { value: new THREE.Matrix4() };
const dustBoost = { value: 1 }; // more grime where the lighting is brightest
const DENT = new THREE.Vector3(0.74, 0.42, 1.86); // front-left bumper corner (car space: +x left, +z forward)
makeDamaged(damaged);

const matByName = (car, name) => {
  let found = null;
  car.car.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => m.name === name && (found = m)));
  return found;
};
const lamps = {
  cleanHead: matByName(clean, 'material_5'),
  cleanTail: matByName(clean, 'material_15'),
  dmgTail: matByName(damaged, 'material_15'),
};
const spots = (car) => { const s = []; car.car.traverse((o) => o.isSpotLight && s.push(o)); return s; };
const cleanSpots = spots(clean);
const dmgSpots = spots(damaged);
// Damaged car: left headlamp dead (the one on the dented corner).
dmgSpots.forEach((s) => (s.position.x > 0 ? (s.intensity = 0) : (s.intensity *= 0.55)));
// Hide the damaged copy's soft contact shadow; the clean copy's one is enough.
damaged.car.children.forEach((c) => c.isMesh && c.material.isMeshBasicMaterial && (c.visible = false));

// World-space clipping planes that follow the car: clean shows behind the gate, damaged ahead of it.
const cleanPlane = new THREE.Plane();
const dmgPlane = new THREE.Plane();
const setClip = (car, plane) =>
  car.car.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => { if (!m.isMeshBasicMaterial || m.map?.isCanvasTexture !== true) m.clippingPlanes = [plane]; }));
setClip(clean, cleanPlane);
setClip(damaged, dmgPlane);

function placeGate(carObj, s) {
  const p = carObj.localToWorld(new THREE.Vector3(0, 0, s));
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(carObj.matrixWorld);
  cleanPlane.setFromNormalAndCoplanarPoint(fwd.clone().negate(), p);
  dmgPlane.setFromNormalAndCoplanarPoint(fwd, p);
}

/** Dust, scratches, dent and a dead lamp, all on the second copy of the model. */
function makeDamaged(d) {
  const car = d.car;
  car.updateMatrixWorld(true);
  const inv = new THREE.Matrix4();
  // 1. Dent: push the bumper-corner surface inwards and back, with a soft falloff.
  const push = new THREE.Vector3(-0.62, -0.08, -0.78).normalize();
  const v = new THREE.Vector3();
  const sphere = new THREE.Sphere();
  car.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    const g = o.geometry;
    g.computeBoundingSphere();
    sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
    if (sphere.distanceToPoint(DENT) > 0.45) return;
    inv.copy(o.matrixWorld).invert();
    const pos = g.attributes.position;
    const out = new Float32Array(pos.count * 3);
    const dirLocal = push.clone().transformDirection(inv);
    const scale = new THREE.Vector3().setFromMatrixScale(inv).x;
    let touched = false;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const world = v.clone().applyMatrix4(o.matrixWorld);
      const dist = world.distanceTo(DENT);
      let amt = 0;
      if (dist < 0.34) {
        const f = 1 - dist / 0.34;
        amt = 0.12 * f * f * (0.8 + 0.2 * Math.sin(world.z * 40 + world.y * 25));
        touched = true;
      }
      v.addScaledVector(dirLocal, amt * scale);
      out.set([v.x, v.y, v.z], i * 3);
    }
    if (!touched) return;
    o.geometry = g.clone();
    o.geometry.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    o.geometry.deleteAttribute('normal');
    o.geometry.computeVertexNormals();
  });

  // 2. Dust, grime, scratches and dent shading via a shared shader patch.
  const seen = new Set();
  car.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (seen.has(m) || m.isMeshBasicMaterial) continue;
      seen.add(m);
      if (m.name === 'material_14') { m.clearcoat = 0.15; m.roughness = 0.55; m.color.set('#dcd9d2'); }
      if (m.name === 'material_5') { m.metalness = 0.4; m.roughness = 0.55; }
      const glass = m.transparent;
      m.customProgramCacheKey = () => (glass ? 'dust-glass' : 'dust');
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uCarInv = carInv;
        sh.uniforms.uDustBoost = dustBoost;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vFilmWorld;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvFilmWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec3 vFilmWorld;
            uniform mat4 uCarInv;
            uniform float uDustBoost;
            float fh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
            float fn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
              return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), f.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), f.x), f.y),
                         mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), f.x), mix(fh(i + vec3(0,1,1)), fh(i + vec3(1,1,1)), f.x), f.y), f.z); }
            float fbm(vec3 p){ return 0.5 * fn(p) + 0.25 * fn(p * 2.03) + 0.125 * fn(p * 4.01) + 0.125 * fn(p * 8.1); }
            float gDust; float gScratch;`)
          .replace('#include <color_fragment>', `#include <color_fragment>
            vec3 lp = (uCarInv * vec4(vFilmWorld, 1.0)).xyz;
            float n = fbm(lp * 5.0);
            float low = 1.0 - smoothstep(0.1, 0.75, lp.y);
            gDust = clamp(low * 0.8 + (n - 0.5) * 0.8, 0.0, 1.0) * ${glass ? '0.4' : '0.5'};
            gDust = clamp(gDust * uDustBoost, 0.0, 0.92);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.31, 0.27), gDust);
            float side = smoothstep(0.55, 0.8, lp.x);
            // a few long, slightly wavy key-scratch strokes along the front door and wing
            float band = smoothstep(0.38, 0.46, lp.y) * (1.0 - smoothstep(0.74, 0.8, lp.y)) * smoothstep(0.3, 0.6, lp.z) * (1.0 - smoothstep(1.6, 1.85, lp.z));
            float stroke = abs(fract(lp.y * 9.0 - lp.z * 1.3 + fn(lp * vec3(1.0, 1.0, 3.0)) * 0.6) - 0.5);
            float lines = (1.0 - smoothstep(0.0, 0.025, stroke)) * step(0.55, fn(vec3(floor(lp.y * 9.0 - lp.z * 1.3), 3.7, 1.1) * 1.7));
            gScratch = lines * band * side ${glass ? '* 0.0' : ''};
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.12, 0.12), gScratch);
            float dd = length((lp - vec3(${DENT.x.toFixed(3)}, ${DENT.y.toFixed(3)}, ${DENT.z.toFixed(3)})) / vec3(0.32, 0.22, 0.34));
            float dent = 1.0 - smoothstep(0.35, 1.0, dd);
            diffuseColor.rgb *= 1.0 - dent * 0.6 * (0.5 + 0.5 * n);
            float crack = smoothstep(0.9, 0.97, sin(lp.y * 90.0 + lp.z * 30.0 + n * 9.0)) * dent;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05), crack * ${glass ? '0.0' : '0.8'});`)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            roughnessFactor = mix(roughnessFactor, 0.92, clamp(gDust * 1.1 + gScratch, 0.0, 1.0));`);
      };
      m.needsUpdate = true;
    }
  });
}

// ── Light gate: the scan (blue) / restoration (white) sweep ──────────────────
function makeGate() {
  const g = new THREE.Group();
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const r = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = r;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const tubeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const curtainMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85, toneMapped: false });
  const W = 1.35;
  const Hh = 1.95;
  for (const x of [-W, W]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, Hh, 10), tubeMat);
    tube.position.set(x, Hh / 2, 0);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.5, Hh * 1.25, 1);
    glow.position.set(x, Hh / 2, 0);
    const light = new THREE.PointLight('#ffffff', 26, 4.5, 2);
    light.position.set(x * 0.85, 1.1, 0);
    g.add(tube, glow, light);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, W * 2, 10).rotateZ(Math.PI / 2), tubeMat);
  top.position.y = Hh;
  const topGlow = new THREE.Sprite(glowMat);
  topGlow.scale.set(W * 2.4, 0.4, 1);
  topGlow.position.y = Hh;
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, Hh), curtainMat);
  curtain.position.y = Hh / 2;
  g.add(top, topGlow, curtain);
  g.userData = { tubeMat, curtainMat, glowMat, lights: g.children.filter((c) => c.isPointLight) };
  g.setColor = (hex) => {
    for (const m of [tubeMat, curtainMat, glowMat]) m.color.set(hex);
    g.userData.lights.forEach((l) => l.color.set(hex));
  };
  return g;
}
const gate = makeGate();

// ── Helpers ──────────────────────────────────────────────────────────────────
const curve = world.curve;
const roadLen = curve.getLength();
const tmp = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() };

function onRoad(carObj, u) {
  curve.getPointAt(u, tmp.pos);
  curve.getTangentAt(u, tmp.fwd);
  rightAt(curve, u, tmp.right);
  tmp.pos.addScaledVector(tmp.right, LANE_OFFSET);
  carObj.position.copy(tmp.pos);
  carObj.lookAt(tmp.pos.clone().add(tmp.fwd));
  return { pos: tmp.pos.clone(), fwd: tmp.fwd.clone(), right: tmp.right.clone() };
}
function orbit(base, az, el, dist, lookY = 0.7) {
  const a = THREE.MathUtils.degToRad(az);
  const e = THREE.MathUtils.degToRad(el);
  camera.position.copy(base.pos)
    .addScaledVector(base.fwd, Math.cos(a) * Math.cos(e) * dist)
    .addScaledVector(base.right, Math.sin(a) * Math.cos(e) * dist)
    .add(new THREE.Vector3(0, Math.max(0.3, Math.sin(e) * dist + 0.35), 0));
  camera.lookAt(base.pos.clone().add(new THREE.Vector3(0, lookY, 0)));
}
/** Puts the car on a path at parameter p, heading along the path's tangent. */
function alongPath(carObj, qp, p) {
  const pos = qp(p);
  const dir = qp(Math.min(1, p + 0.005)).sub(qp(Math.max(0, p - 0.005))).normalize();
  carObj.position.copy(pos);
  carObj.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
}
function spin(d, metres) { d.wheels.forEach((w) => (w.rotation.x = metres / d.wheelRadius)); }
function lights(which, head) {
  if (which === clean) {
    cleanSpots.forEach((s) => (s.visible = head > 0));
    if (lamps.cleanHead) { lamps.cleanHead.emissive.set('#fff4e2'); lamps.cleanHead.emissiveIntensity = head * 1.6; }
  } else dmgSpots.forEach((s) => (s.visible = head > 0));
}
function only(...objs) {
  for (const o of [clean.car, damaged.car, gate]) if (!objs.includes(o)) o.parent?.remove(o);
}
function setPlate(src, objectPosition, filter = 'none', transform = 'none') {
  const img = $('plate').querySelector('img');
  if (src && !img.src.endsWith(src)) img.src = src;
  $('plate').style.display = src ? 'block' : 'none';
  img.style.objectPosition = objectPosition;
  img.style.filter = filter;
  img.style.transform = transform;
}
const photoSrc = (name) => `/media/${name}.webp`;
function showPhoto(layerId, shot, t, opacity) {
  const layer = $(layerId);
  if (!shot || opacity <= 0) { layer.style.opacity = 0; return; }
  const img = layer.querySelector('img');
  if (!img.src.endsWith(photoSrc(shot.photo))) img.src = photoSrc(shot.photo);
  const p = clamp01((t - shot.start) / (shot.end - shot.start + XF));
  const [s0, s1, dx, dy] = shot.kb;
  img.style.transform = `scale(${lerp(s0, s1, p)}) translate(${dx * p}%, ${dy * p}%)`;
  layer.style.opacity = opacity;
}

// Garage-front photo plate: camera matched by eye to the photograph
// (eye height 1.5 m, horizon 45% down the frame, garage opening ≈ 8.6 m away).
function garageCamera() {
  camera.fov = 40;
  camera.position.set(0, 1.5, 0);
  camera.lookAt(0, 1.5 - Math.tan(THREE.MathUtils.degToRad(2.1)) * 10, 10);
  camera.updateProjectionMatrix();
}
const GARAGE_PLATE = '58%';

// ── Shots ────────────────────────────────────────────────────────────────────
const SHOT_RENDER = {
  'road-problem'(t) {
    only(damaged.car);
    world.scene.add(damaged.car);
    // Slowing from ~45 to ~25 km/h towards the garage.
    const metres = 12.5 * t - 1.4 * t * t;
    const u = 0.3 + metres / roadLen;
    const base = onRoad(damaged.car, u);
    spin(damaged, metres);
    lights(damaged, 1);
    damaged.car.rotateZ(Math.sin(t * 9) * 0.004); // tired suspension
    orbit(base, lerp(-34, -24, smooth(t / 3.6)), 3, lerp(7.4, 6.2, t / 3.6), 0.65);
    camera.fov = 34;
    world.followSun(base.pos);
    world.sky.position.copy(camera.position);
    placeGate(damaged.car, -100);
    return world.scene;
  },
  arrive(t) {
    only(damaged.car);
    plate.add(damaged.car);
    setPlate(photoSrc('garage-front'), `50% ${GARAGE_PLATE}`, 'brightness(0.92)');
    garageCamera();
    const p = easeOut(clamp01(t / 3.1));
    // Path from the road towards the right-hand bay (where the alignment rig is).
    // Camera looks along +z, so screen-right is -x: the right-hand bay is at negative x.
    const a = new THREE.Vector3(-1.3, 0, 2.4);
    const c = new THREE.Vector3(-2.2, 0, 5.0);
    const b = new THREE.Vector3(-2.3, 0, 7.7);
    const qp = (k) => a.clone().multiplyScalar((1 - k) ** 2).add(c.clone().multiplyScalar(2 * (1 - k) * k)).add(b.clone().multiplyScalar(k * k));
    const pos = qp(p);
    alongPath(damaged.car, qp, p);
    spin(damaged, p * 5.6);
    damaged.car.rotateX(-(1 - ramp(t, 3.0, 3.6)) * ramp(t, 2.6, 3.0) * 0.012); // settles as it stops
    lights(damaged, 1);
    if (lamps.dmgTail) { lamps.dmgTail.emissive.set('#ff2a14'); lamps.dmgTail.emissiveIntensity = ramp(t, 2.2, 2.6) * 2.2; }
    plateSun.position.set(6, 9, 22); plateSun.target.position.set(-2, 0, 6);
    plateKey.position.set(0, 3, -2); plateKey.target.position.copy(pos);
    placeGate(damaged.car, -100);
    return plate;
  },
  scan(t) {
    only(damaged.car, gate);
    plate.add(damaged.car, gate);
    setPlate(photoSrc('engine-bay'), '50% 40%', 'blur(10px) brightness(0.32) saturate(0.8)', 'scale(1.12)');
    damaged.car.position.set(0, 0, 0);
    damaged.car.rotation.set(0, 0, 0);
    spin(damaged, 0);
    lights(damaged, 0);
    if (lamps.dmgTail) lamps.dmgTail.emissiveIntensity = 0;
    camera.fov = 30;
    const k = smooth(t / 2.0);
    camera.position.set(lerp(3.3, 2.9, k), lerp(1.05, 0.95, k), lerp(4.6, 4.1, k));
    camera.lookAt(0.55, 0.5, 1.45);
    camera.updateProjectionMatrix();
    gate.setColor('#2aa6e6');
    gate.position.set(0, 0, lerp(2.5, -0.6, smooth(ramp(t, 0.1, 1.5))));
    gate.visible = t < 1.55;
    plateSun.position.set(4, 6, 6); plateSun.target.position.set(0, 0, 0);
    plateKey.position.copy(camera.position).add(new THREE.Vector3(0, 2.5, 0)); plateKey.target.position.set(0.5, 0.4, 1.4);
    placeGate(damaged.car, -100);
    $('tagDent').style.opacity = ramp(t, 0.9, 1.2) * (1 - ramp(t, 1.85, 2.0));
    return plate;
  },
  transform(t) {
    only(damaged.car, clean.car, gate);
    plate.add(damaged.car, clean.car, gate);
    setPlate(photoSrc('alignment-rig'), '50% 45%', 'blur(9px) brightness(0.34) saturate(0.85)', 'scale(1.1)');
    for (const d of [damaged, clean]) { d.car.position.set(0, 0, 0); d.car.rotation.set(0, 0, 0); spin(d, 0); }
    // Slow orbit from the left profile round to the front-left three-quarter.
    const th = THREE.MathUtils.degToRad(lerp(8, 52, smooth(t / 4.4)));
    const dist = lerp(7.0, 6.4, t / 4.4);
    camera.fov = 32;
    camera.position.set(Math.cos(th) * dist, lerp(1.25, 1.0, t / 4.4), Math.sin(th) * dist);
    camera.lookAt(0, 0.62, 0.15);
    camera.updateProjectionMatrix();
    // The gate passes rear → front; behind it the car is restored.
    const s = lerp(-2.6, 2.6, smooth(ramp(t, 0.6, 3.1)));
    gate.setColor('#ffffff');
    gate.position.set(0, 0, s);
    gate.visible = t > 0.45 && t < 3.25;
    placeGate(clean.car, s);
    lights(damaged, 0);
    lights(clean, ramp(t, 3.25, 3.6));
    if (lamps.dmgTail) lamps.dmgTail.emissiveIntensity = 0;
    if (lamps.cleanTail) { lamps.cleanTail.emissive.set('#ff2a14'); lamps.cleanTail.emissiveIntensity = ramp(t, 3.25, 3.6) * 1.4; }
    plateSun.position.set(-5, 8, -4); plateSun.target.position.set(0, 0, 0);
    plateKey.position.copy(camera.position).add(new THREE.Vector3(0, 3, 0)); plateKey.target.position.set(0, 0.5, 0);
    $('tagOk').style.opacity = ramp(t, 3.5, 3.8) * (1 - ramp(t, 4.15, 4.4));
    $('flash').style.opacity = 0.35 * Math.max(0, 1 - Math.abs(t - 3.2) / 0.18);
    return plate;
  },
  exit(t) {
    only(clean.car);
    plate.add(clean.car);
    setPlate(photoSrc('garage-front'), `50% ${GARAGE_PLATE}`, 'brightness(0.92)');
    garageCamera();
    const p = easeIn(clamp01(t / 2.0)) * 0.55 + clamp01(t / 2.0) * 0.45;
    const a = new THREE.Vector3(-2.3, 0, 8.3);
    const c = new THREE.Vector3(-2.0, 0, 4.4);
    const b = new THREE.Vector3(1.6, 0, 3.6);
    const qp = (k) => a.clone().multiplyScalar((1 - k) ** 2).add(c.clone().multiplyScalar(2 * (1 - k) * k)).add(b.clone().multiplyScalar(k * k));
    const pos = qp(p);
    alongPath(clean.car, qp, p);
    spin(clean, p * 7);
    lights(clean, 1);
    if (lamps.cleanTail) lamps.cleanTail.emissiveIntensity = 0.6;
    plateSun.position.set(6, 9, 22); plateSun.target.position.set(-2, 0, 6);
    plateKey.position.set(0, 3, -2); plateKey.target.position.copy(pos);
    placeGate(clean.car, 100);
    return plate;
  },
  'road-final'(t) {
    only(clean.car);
    world.scene.add(clean.car);
    const metres = 14 * t;
    const u = 0.46 + metres / roadLen;
    const base = onRoad(clean.car, u);
    spin(clean, metres);
    lights(clean, 1);
    // Track the car low and in front, then let it drive past a now-still camera.
    const tc = Math.min(t, 2.3);
    const camBase = onRoad(new THREE.Object3D(), 0.46 + (14 * tc) / roadLen);
    orbit(camBase, lerp(-26, -14, smooth(tc / 2.3)), 2, lerp(8.5, 9.5, tc / 2.3), 0.9);
    if (t > 2.3) camera.lookAt(camBase.pos.clone().add(camBase.fwd.clone().multiplyScalar(-6)).add(new THREE.Vector3(0, 2.2 + ramp(t, 2.3, 3.6) * 2.5, 0)).lerp(base.pos.clone().setY(0.9), 1 - smooth(ramp(t, 2.3, 3.6))));
    camera.fov = 36;
    world.followSun(base.pos);
    world.sky.position.copy(camera.position);
    placeGate(clean.car, 100);
    $('title').style.opacity = smooth(ramp(t, 2.5, 3.3));
    $('title').style.transform = `translateY(${(1 - smooth(ramp(t, 2.5, 3.3))) * 2}vh)`;
    return world.scene;
  },
};

// ── Editing ──────────────────────────────────────────────────────────────────
function shotAt(t) {
  return SHOTS.find((s) => t >= s.start && t < s.end) ?? SHOTS.at(-1);
}

function render(t) {
  t = Math.min(Math.max(t, 0), DURATION - 1e-4);
  const shot = shotAt(t);
  const i = SHOTS.indexOf(shot);
  const prev = SHOTS[i - 1];
  const next = SHOTS[i + 1];
  for (const id of ['tagDent', 'tagOk', 'flash', 'title']) $(id).style.opacity = 0;
  $('plate').style.display = 'none';

  // Which 3D shot (if any) draws the canvas this frame: a photo shot keeps the
  // previous 3D shot running underneath while it fades in.
  let gl = null;
  let glT = 0;
  if (!shot.photo) { gl = shot; glT = t - shot.start; }
  else if (prev && !prev.photo && t - shot.start < XF) { gl = prev; glT = t - prev.start; }

  if (gl) {
    canvas.style.opacity = 1;
    dustBoost.value = gl.id === 'transform' ? 1.75 : 1;
    const scene = SHOT_RENDER[gl.id](glT);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    clean.car.updateMatrixWorld(true);
    damaged.car.updateMatrixWorld(true);
    carInv.value.copy(damaged.car.matrixWorld).invert();
    if (gl.id === 'transform') placeGate(clean.car, gate.position.z);
    renderer.render(scene, camera);
  } else {
    canvas.style.opacity = 0;
  }

  // Photo layers: A = current/primary photo, B = the previous photo while crossfading.
  const fadeIn = ramp(t, shot.start, shot.start + XF);
  if (shot.photo) {
    showPhoto('photoA', shot, t, prev ? fadeIn : 1);
    showPhoto('photoB', prev?.photo ? prev : null, t, 1);
    if (!prev?.photo) $('photoB').style.opacity = 0;
    // photoB sits above photoA, so fade it out instead.
    if (prev?.photo) { $('photoB').style.opacity = 1 - fadeIn; $('photoA').style.opacity = 1; }
  } else if (prev?.photo && t - shot.start < XF) {
    showPhoto('photoA', prev, t, 1 - fadeIn);
    $('photoB').style.opacity = 0;
  } else {
    $('photoA').style.opacity = 0;
    $('photoB').style.opacity = 0;
  }

  // Dips to black: opening, closing, and hard cuts between two 3D shots.
  let dip = 0;
  dip = Math.max(dip, 1 - ramp(t, 0, 0.5));
  dip = Math.max(dip, ramp(t, DURATION - 0.35, DURATION));
  if (prev && !prev.photo && !shot.photo) dip = Math.max(dip, 1 - ramp(t, shot.start, shot.start + 0.18));
  if (next && !next.photo && !shot.photo) dip = Math.max(dip, ramp(t, shot.end - 0.12, shot.end));
  $('dip').style.opacity = dip;

  // Chapter label (hidden during the end title).
  $('labelNum').textContent = shot.num;
  $('labelText').textContent = shot.label;
  const firstOfLabel = SHOTS.find((s) => s.label === shot.label);
  const lastOfLabel = SHOTS.findLast((s) => s.label === shot.label);
  let la = ramp(t, firstOfLabel.start + 0.25, firstOfLabel.start + 0.6) * (1 - ramp(t, lastOfLabel.end - 0.35, lastOfLabel.end - 0.1));
  if (shot.id === 'road-final') la *= 1 - ramp(t, shot.start + 2.2, shot.start + 2.6);
  $('label').style.opacity = la;
}

// Preload every image so screenshots never catch a half-loaded photo.
await Promise.all(['garage-front', 'engine-bay', 'alignment-rig', 'tyre-bay'].map((n) => new Promise((res) => {
  const im = new Image();
  im.onload = im.onerror = res;
  im.src = photoSrc(n);
})));
await document.fonts.ready;

// Compile every shot once so the first captured frame of each isn't missing anything.
for (const s of SHOTS) if (!s.photo) render(s.start + 0.5);

window.film = { render, duration: DURATION, fps: FPS, ready: true };
const qt = new URLSearchParams(location.search).get('t');
render(qt ? parseFloat(qt) : 1.5);
