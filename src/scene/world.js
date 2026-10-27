import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// WORLD — the sunset landscape the car drives through (units: metres, Y up).
//   • sky dome with the site's dusk gradient and a low sun
//   • distant hill silhouettes, dusty ground, distance haze
//   • an S-curved two-lane road built as a ribbon mesh along a spline, so its
//     edge lines and dashed centre line follow the curve exactly
//   • telephone poles with sagging wires along the roadside
// ─────────────────────────────────────────────────────────────────────────────

export const SUN_DIR = new THREE.Vector3(-0.35, 0.07, -1).normalize();
const HAZE = '#2b2230';

// Road centreline (x, z). The car drives towards +Z through two S-bends.
const ROAD_POINTS = [
  [-20, -190], [-28, -140], [-4, -95], [34, -55], [44, -10], [16, 35],
  [-30, 72], [-42, 118], [-12, 160], [30, 198], [40, 250], [20, 300],
];
export const LANE_OFFSET = -1.9; // metres to the right of centre (negative = left lane; India drives on the left)
const ROAD_WIDTH = 8.4;
const TEX_LENGTH = 7.5; // metres of road per texture repeat: 3 m dash + 4.5 m gap

export function createRoadCurve() {
  return new THREE.CatmullRomCurve3(ROAD_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
}

/** Right-hand vector (on the ground) at curve parameter u. */
export function rightAt(curve, u, target = new THREE.Vector3()) {
  const t = curve.getTangentAt(u);
  return target.set(-t.z, 0, t.x).normalize();
}

function asphaltTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 256; // across the road (ROAD_WIDTH)
  c.height = 512; // along the road (TEX_LENGTH)
  const g = c.getContext('2d');
  g.fillStyle = '#2b2d31';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 9000; i++) {
    const v = 30 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 3},${0.25 + Math.random() * 0.4})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 1.5, 1.5);
  }
  // Wheel tracks: slightly darker, polished bands in each lane.
  const pxm = c.width / ROAD_WIDTH;
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (const m of [1.3, 2.9, 5.5, 7.1]) g.fillRect((m - 0.35) * pxm, 0, 0.7 * pxm, c.height);
  // Markings: solid edge lines, dashed centre line (white, as on Indian state highways).
  g.fillStyle = '#d9d5cc';
  const line = 0.15 * pxm;
  g.fillRect(0.3 * pxm, 0, line, c.height);
  g.fillRect(c.width - 0.3 * pxm - line, 0, line, c.height);
  g.fillRect(c.width / 2 - line / 2, 0, line, (3 / TEX_LENGTH) * c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function buildRoad(curve, renderer) {
  const samples = 900;
  const length = curve.getLength();
  const pos = [];
  const uv = [];
  const idx = [];
  const right = new THREE.Vector3();
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const p = curve.getPointAt(u);
    rightAt(curve, u, right);
    for (const side of [-1, 1]) {
      pos.push(p.x + right.x * side * ROAD_WIDTH / 2, 0.02, p.z + right.z * side * ROAD_WIDTH / 2);
      uv.push(side < 0 ? 0 : 1, (u * length) / TEX_LENGTH);
    }
    if (i < samples) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // counter-clockwise from above → faces up
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: asphaltTexture(renderer), roughness: 0.82, metalness: 0 });
  const road = new THREE.Mesh(geo, mat);
  road.receiveShadow = true;
  return road;
}

// Dry, dusty verge: mottled earth so the ground shows speed and depth.
function groundTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a221a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.6 ? `rgba(70,58,44,${Math.random() * 0.5})` : `rgba(10,8,6,${Math.random() * 0.5})`;
    const r = 1 + Math.random() * 3;
    g.fillRect(Math.random() * 256, Math.random() * 256, r, r);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(300, 300); // ~8 m per tile
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    // Colours are the site's CSS dusk palette (sRGB, written straight to the screen).
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float sun = max(dot(d, sunDir), 0.0);
        vec3 top = vec3(0.027, 0.039, 0.063);
        vec3 mid = vec3(0.059, 0.102, 0.165);
        vec3 dusk = vec3(0.227, 0.188, 0.267);
        vec3 glow = mix(vec3(0.722, 0.396, 0.227), vec3(0.94, 0.635, 0.306), pow(sun, 6.0));
        vec3 col = mix(glow, dusk, smoothstep(0.0, 0.09, h));
        col = mix(col, mid, smoothstep(0.08, 0.3, h));
        col = mix(col, top, smoothstep(0.28, 0.75, h));
        col += vec3(1.0, 0.55, 0.25) * pow(sun, 10.0) * 0.45 * (1.0 - smoothstep(0.0, 0.35, h));
        col += vec3(1.0, 0.86, 0.62) * smoothstep(0.99982, 0.99992, sun);
        if (h < 0.0) col = vec3(0.169, 0.133, 0.188);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

function buildHills() {
  const seg = 240;
  const r = 900;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const h = 28 + Math.sin(a * 3 + 1.2) * 14 + Math.sin(a * 7 + 0.4) * 8 + Math.sin(a * 17) * 3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r + 50;
    pos.push(x, -5, z, x, h, z);
    if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#141720', fog: false, side: THREE.DoubleSide }));
}

function buildPoles(curve) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#0d0f12', roughness: 0.9 });
  const pole = new THREE.CylinderGeometry(0.1, 0.14, 9, 8);
  const bar = new THREE.BoxGeometry(1.6, 0.12, 0.12);
  const length = curve.getLength();
  const tops = [];
  const right = new THREE.Vector3();
  for (let d = 12; d < length; d += 42) {
    const u = d / length;
    const p = curve.getPointAt(u);
    rightAt(curve, u, right);
    const base = p.clone().addScaledVector(right, -(ROAD_WIDTH / 2 + 3.2)); // left verge
    const m = new THREE.Mesh(pole, mat);
    m.position.copy(base).setY(4.5);
    m.castShadow = true;
    const b = new THREE.Mesh(bar, mat);
    b.position.copy(base).setY(8.6);
    b.lookAt(base.clone().add(right).setY(8.6));
    b.rotateY(Math.PI / 2);
    group.add(m, b);
    tops.push({ base, right: right.clone() });
  }
  // Sagging wires between consecutive poles.
  const wireMat = new THREE.LineBasicMaterial({ color: '#07080a' });
  for (let i = 0; i < tops.length - 1; i++) {
    for (const off of [-0.7, 0, 0.7]) {
      const a = tops[i].base.clone().addScaledVector(tops[i].right, off).setY(8.68);
      const b = tops[i + 1].base.clone().addScaledVector(tops[i + 1].right, off).setY(8.68);
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        pts.push(a.clone().lerp(b, t).setY(8.68 - Math.sin(t * Math.PI) * 0.9));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }
  }
  return group;
}

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 70, 650);
  const curve = createRoadCurve();

  const sky = buildSky();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1200, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(renderer), roughness: 1 }),
  );
  ground.receiveShadow = true;
  scene.add(sky, ground, buildHills(), buildRoad(curve, renderer), buildPoles(curve));

  // Low warm sun, cool sky fill, and reflections of the dusk sky on the paint.
  const sun = new THREE.DirectionalLight('#ffb27a', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(renderer.capabilities.maxTextureSize >= 4096 && innerWidth > 760 ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target, new THREE.HemisphereLight('#7a86b8', '#2a1c14', 0.9));

  const envScene = new THREE.Scene();
  envScene.add(buildSky());
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 1.15;
  pmrem.dispose();

  return {
    scene,
    curve,
    sky,
    /** Keep the sun's shadow camera centred on the car. */
    followSun(target) {
      sun.target.position.copy(target);
      sun.position.copy(target).addScaledVector(SUN_DIR, 40);
    },
  };
}
