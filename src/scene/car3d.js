import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// ─────────────────────────────────────────────────────────────────────────────
// CAR (3D) — loads the i20 glTF and normalises it so that, inside the returned
// group, the car's nose points along +Z, its axles along X, its tyres touch
// y = 0 and it's centred on the origin at true size.
//
// Model: "2020 Hyundai i20 N- Line" by shreyanshchaurasia13 (Sketchfab, CC BY 4.0),
// optimised by scripts/optimize-car-model.mjs.
// ─────────────────────────────────────────────────────────────────────────────

export const CAR_MODEL = {
  url: '/media/car/i20.glb',
  yaw: 0,            // radians that turn the model's own nose onto +Z (set after inspecting the model)
  length: 3.995,     // m (i20 2020: 3995 × 1775 × 1505 mm, wheelbase 2580 mm)
};

/**
 * Finds the wheels from geometry (this model's parts are unnamed) and wraps each
 * in a pivot at its axle so it can spin.
 *   1. Tyres: round (as tall as long), touching the ground, out at a corner.
 *   2. Wheel parts: anything symmetric about a tyre's axle (rim, disc, hub, nuts),
 *      which also leaves off-centre parts like brake calipers static.
 */
function rigWheels(car) {
  const parts = [];
  car.traverse((o) => {
    if (!o.isMesh) return;
    const box = new THREE.Box3().setFromObject(o);
    parts.push({ mesh: o, box, c: box.getCenter(new THREE.Vector3()), s: box.getSize(new THREE.Vector3()) });
  });

  const tyres = new Map();
  for (const p of parts) {
    const round = Math.abs(p.s.y - p.s.z) < 0.08 * p.s.y;
    if (round && p.s.y > 0.45 && p.s.y < 0.85 && p.box.min.y < 0.06 && Math.abs(p.c.x) > 0.3) {
      const key = `${Math.sign(p.c.x)}${Math.sign(p.c.z)}`;
      if (!tyres.has(key) || tyres.get(key).s.y < p.s.y) tyres.set(key, p);
    }
  }

  const wheels = [];
  let radius = 0.31;
  for (const tyre of tyres.values()) {
    const axle = tyre.c;
    radius = tyre.s.y / 2;
    const pivot = new THREE.Group();
    pivot.position.copy(axle);
    car.add(pivot);
    pivot.updateMatrixWorld();
    for (const p of parts) {
      const onAxle = Math.abs(p.c.y - axle.y) < 0.025 && Math.abs(p.c.z - axle.z) < 0.025;
      const symmetric = Math.abs(p.s.y - p.s.z) < 0.04;
      const inside = p.s.y <= tyre.s.y + 0.01 && Math.abs(p.c.x - axle.x) < 0.3;
      if (onAxle && symmetric && inside) pivot.attach(p.mesh);
    }
    wheels.push(pivot);
  }
  return { wheels, radius };
}

function headlights(car, length) {
  const lights = new THREE.Group();
  for (const x of [-0.62, 0.62]) {
    const s = new THREE.SpotLight('#fff2dc', 120, 45, 0.4, 0.7, 2);
    s.position.set(x, 0.72, length / 2 - 0.15);
    s.target.position.set(x * 2, 0, length / 2 + 18);
    lights.add(s, s.target);
  }
  car.add(lights);
  return lights;
}

// Soft contact shadow so the tyres read as planted even where the sun shadow is faint.
function contactShadow(car, length, width) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.35, length * 1.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }),
  );
  mesh.position.y = 0.03;
  mesh.renderOrder = 1;
  car.add(mesh);
}

function finish(model) {
  const car = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = CAR_MODEL.yaw;
  inner.add(model);
  car.add(inner);
  car.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  // A car is longer than it is wide: if the model lies along X, turn it onto Z.
  if (size.x > size.z) {
    inner.rotation.y += Math.PI / 2;
    car.updateMatrixWorld(true);
    box.setFromObject(inner).getSize(size);
  }
  inner.scale.setScalar(CAR_MODEL.length / size.z);
  car.updateMatrixWorld(true);
  box.setFromObject(inner);
  const centre = box.getCenter(new THREE.Vector3());
  inner.position.set(-centre.x, -box.min.y, -centre.z);
  car.updateMatrixWorld(true);
  box.setFromObject(inner);
  size.copy(box.getSize(new THREE.Vector3()));

  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  const { wheels, radius } = rigWheels(car);
  if (wheels.length !== 4) console.warn(`[drive] expected 4 wheels, found ${wheels.length}; wheels won't spin correctly.`);
  headlights(car, CAR_MODEL.length);
  contactShadow(car, CAR_MODEL.length, size.x);
  if (import.meta.env.DEV) console.info(`[drive] car loaded: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m, ${wheels.length} wheels (r = ${radius.toFixed(3)} m)`);
  return { car, wheels, wheelRadius: radius, size };
}

/** Which model to load. In development, `?carModel=/path.glb` tries another file. */
function modelUrl() {
  if (import.meta.env.DEV) {
    const override = new URLSearchParams(location.search).get('carModel');
    if (override) return override;
  }
  return CAR_MODEL.url;
}

export async function loadCar() {
  const url = modelUrl();
  // Check the file first: a missing file can come back as the site's HTML page with status 200.
  const res = await fetch(url);
  const head = new Uint8Array(await res.clone().arrayBuffer()).slice(0, 4);
  if (!res.ok || String.fromCharCode(...head) !== 'glTF') {
    throw new Error(`3D car model not found at ${url} (HTTP ${res.status}, ${res.headers.get('content-type') || 'unknown type'}). Run \`npm run car-model\` after saving the model to image/i20.glb.`);
  }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(await res.arrayBuffer(), url.slice(0, url.lastIndexOf('/') + 1));
  return finish(gltf.scene);
}
