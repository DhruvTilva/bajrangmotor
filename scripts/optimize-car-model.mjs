// Turns the downloaded 3D car into a web-ready file for the closing drive scene.
//
//   1. Download "2020 Hyundai i20 N- Line" (glTF / .glb) from
//      https://sketchfab.com/3d-models/2020-hyundai-i20-n-line-6c267be59fb94253bff935616eddcc99
//      and save it as image/i20.glb
//   2. npm run car-model   →   public/media/car/i20.glb
//
// Model by shreyanshchaurasia13, CC BY 4.0 (credited in the site footer).
//
// Why the material table below: the source uses the old spec/gloss workflow with
// every diffuse colour black and each part's colour stored as its *specular* colour.
// Automatic conversion turns that into black paint, and the glass is alpha-masked
// out entirely. So each material is rebuilt as proper metal/roughness PBR here.
// Material roles were identified by where each one sits on the car.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { execFileSync } from 'node:child_process';
import { statSync, existsSync, rmSync } from 'node:fs';

const SRC = 'image/i20.glb';
const TMP = 'image/.i20-pbr.glb';
const OUT = 'public/media/car/i20.glb';

const PAINT = '#eceef0'; // Polar White: change here to repaint the car

// color: sRGB hex, or 'specular' to keep the model's own colour / 'specularTexture' to use its texture.
const MATERIALS = {
  material_14: { role: 'body paint', color: PAINT, metal: 0.05, rough: 0.32, clearcoat: 1 },
  material_0: { role: 'black roof, pillars & trim', color: '#0b0c0e', metal: 0, rough: 0.3, clearcoat: 0.6 },
  material_2: { role: 'black plastics, mirror caps', color: '#101113', metal: 0, rough: 0.55 },
  material_4: { role: 'interior', color: '#17181b', metal: 0, rough: 0.85 },
  material_1: { role: 'grey interior/trim', color: 'specular', metal: 0.1, rough: 0.6 },
  material_7: { role: 'brakes & running gear', color: 'specular', metal: 1, rough: 0.45 },
  material_9: { role: 'underbody, exhaust', color: 'specular', metal: 0.3, rough: 0.7 },
  material_18: { role: 'wheel-arch liners', color: '#0d0e10', metal: 0, rough: 0.9 },
  material_17: { role: 'front grille', color: '#0b0c0e', metal: 0.2, rough: 0.45 },
  material_16: { role: 'side trim', color: 'specular', metal: 0.7, rough: 0.35 },
  material_12: { role: 'tyres', color: 'specularTexture', metal: 0, rough: 0.88 },
  material_13: { role: 'alloy wheels', color: 'specularTexture', metal: 1, rough: 0.28 },
  // Plates left blank: no registration number is shown on the site.
  material_21: { role: 'number plates (blank)', color: '#d9dad6', metal: 0, rough: 0.55 },
  material_5: { role: 'headlamp reflectors', color: 'specular', metal: 1, rough: 0.12 },
  material_10: { role: 'mirror glass', color: '#c8ccd0', metal: 1, rough: 0.04 },
  material_15: { role: 'tail lamps', color: '#a3150e', metal: 0, rough: 0.2, emissive: '#5a0400' },
  material_3: { role: 'rear lamp inner', color: 'specular', metal: 0, rough: 0.25 },
  material_19: { role: 'rear reflectors', color: 'specular', metal: 0, rough: 0.25 },
  material_20: { role: 'tail lamp housing', color: 'specular', metal: 0, rough: 0.3 },
  material_8: { role: 'N Line red accent', color: 'specular', metal: 0, rough: 0.35 },
  material_6: { role: 'tinted windows', color: '#0c1014', alpha: 0.72, metal: 0, rough: 0.04 },
  material_11: { role: 'clear glass, lamp lenses', color: '#d5dbe0', alpha: 0.18, metal: 0, rough: 0.03 },
};

if (!existsSync(SRC)) {
  console.error(`Missing ${SRC}. See the instructions at the top of this script.`);
  process.exit(1);
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hex = (h) => [1, 3, 5].map((i) => toLinear(parseInt(h.slice(i, i + 2), 16) / 255));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const clearcoatExt = doc.createExtension(KHRMaterialsClearcoat);

for (const mat of doc.getRoot().listMaterials()) {
  const sg = mat.getExtension('KHR_materials_pbrSpecularGlossiness');
  const spec = sg?.getSpecularFactor() ?? [1, 1, 1];
  const specTex = sg?.getSpecularGlossinessTexture() ?? null;
  const def = MATERIALS[mat.getName()] ?? { color: 'specular', metal: 0, rough: 0.6 };

  let rgb = [1, 1, 1];
  let texture = null;
  if (def.color === 'specularTexture') texture = specTex;
  else if (def.color === 'specular') rgb = spec; // swatch colour is applied below from the texture's first pixel
  else rgb = hex(def.color);

  if (def.color === 'specular' && specTex) {
    // These parts store their colour in a single-colour 8×8 texture; bake it into the factor.
    const { default: sharp } = await import('sharp');
    const { data } = await sharp(Buffer.from(specTex.getImage())).raw().toBuffer({ resolveWithObject: true });
    rgb = [0, 1, 2].map((i) => toLinear(data[i] / 255) * spec[i]);
  }

  mat.setBaseColorFactor([...rgb, def.alpha ?? 1]);
  mat.setBaseColorTexture(texture);
  mat.setMetallicFactor(def.metal);
  mat.setRoughnessFactor(def.rough);
  mat.setMetallicRoughnessTexture(null);
  mat.setAlphaMode(def.alpha ? 'BLEND' : 'OPAQUE');
  mat.setDoubleSided(true);
  if (def.emissive) mat.setEmissiveFactor(hex(def.emissive));
  if (def.clearcoat) {
    mat.setExtension('KHR_materials_clearcoat', clearcoatExt.createClearcoat().setClearcoatFactor(def.clearcoat).setClearcoatRoughnessFactor(0.06));
  }
  mat.setExtension('KHR_materials_pbrSpecularGlossiness', null);
}
doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === 'KHR_materials_pbrSpecularGlossiness')?.dispose();
await io.write(TMP, doc);

execFileSync('npx', ['gltf-transform', 'optimize', TMP, OUT,
  '--compress', 'meshopt',          // decoded in the browser by three's MeshoptDecoder
  '--simplify', 'true',
  '--simplify-ratio', '0.4',
  '--simplify-error', '0.0004',
  // Keep every part a separate mesh: the wheels are found by their geometry and spun
  // individually, which joining, instancing or palette-merging would break.
  '--join', 'false',
  '--instance', 'false',
  '--palette', 'false',
  '--texture-compress', 'webp',
  '--texture-size', '1024',
], { stdio: 'inherit' });
rmSync(TMP);

const mb = (f) => (statSync(f).size / 1048576).toFixed(1);
console.log(`\n${SRC} ${mb(SRC)} MB → ${OUT} ${mb(OUT)} MB`);
