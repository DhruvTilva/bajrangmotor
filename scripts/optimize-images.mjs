// Turns the original workshop photos in /image into graded, web-ready WebP files in /public/media.
// Run `npm run images` after replacing or adding a photo.
//
// Every photo goes through the same steps so they read as one set:
//   1. number plates blurred (privacy: customers' cars)
//   2. light denoise, then upscale with Lanczos and sharpen
//   3. the site's colour grade: deeper contrast, cool blue-black shadows,
//      warm highlights, slightly richer colour, soft vignette
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const OUT = 'public/media';

// src: original file · crop: [left, top, width, height] to trim borders · widths: output sizes
// plates: [left, top, width, height] in the original file's pixels (before crop)
const photos = [
  { name: 'garage-front', src: 'image/garage-front.png', widths: [720, 1600], plates: [[16, 338, 40, 28]] },
  { name: 'garage-forecourt', src: 'image/garage-forecourt.png', widths: [900], plates: [[172, 204, 34, 20]] },
  { name: 'roadside-sign', src: 'image/1maingate.jpg', crop: [4, 14, 774, 482], widths: [1100] },
  { name: 'alignment-rig', src: 'image/2wheelalignment.jpg', widths: [720, 1600] },
  { name: 'engine-bay', src: 'image/3engine works.jpg', widths: [720, 1400], plates: [[490, 355, 118, 90]] },
  { name: 'tyre-bay', src: 'image/4 balancing.jpg', widths: [720, 1200] },
];

const GRADE = {
  contrast: 1.22,
  saturation: 1.16,
  shadowTint: [0.02, 0.05, 0.1], // pulled into the darks (the site's near-black blue)
  shadowAmount: 0.38,
  highlightTint: [1.0, 0.86, 0.72], // warm workshop light
  highlightAmount: 0.14,
  vignette: 0.42,
};

/** Blurs each plate rectangle with a feathered edge. */
async function blurPlates(input, plates) {
  const base = sharp(input);
  const { width, height } = await base.metadata();
  const blurred = await sharp(input).blur(14).toBuffer();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><defs><filter id="f"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
      plates.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#fff" filter="url(#f)"/>`).join('') +
      '</svg>',
  );
  const maskedBlur = await sharp(blurred).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(input).composite([{ input: maskedBlur }]).png().toBuffer();
}

/** Applies GRADE to raw RGB pixels. */
function grade(data, width, height, channels) {
  const g = GRADE;
  const cx = width / 2;
  const cy = height / 2;
  const maxR2 = cx * cx + cy * cy;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      let r = data[i] / 255;
      let gr = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      const l = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
      // saturation around luminance
      r = l + (r - l) * g.saturation;
      gr = l + (gr - l) * g.saturation;
      b = l + (b - l) * g.saturation;
      // S-curve contrast
      const curve = (v) => {
        const c = 0.5 + (v - 0.5) * g.contrast;
        return Math.min(1, Math.max(0, c));
      };
      r = curve(r);
      gr = curve(gr);
      b = curve(b);
      // split toning
      const sh = Math.pow(1 - l, 2) * g.shadowAmount;
      const hi = Math.pow(l, 2) * g.highlightAmount;
      r = r * (1 - sh) + g.shadowTint[0] * sh;
      gr = gr * (1 - sh) + g.shadowTint[1] * sh;
      b = b * (1 - sh) + g.shadowTint[2] * sh;
      r = r * (1 - hi) + r * g.highlightTint[0] * hi;
      gr = gr * (1 - hi) + gr * g.highlightTint[1] * hi;
      b = b * (1 - hi) + b * g.highlightTint[2] * hi;
      // vignette
      const dx = x - cx;
      const dy = y - cy;
      const v = 1 - g.vignette * Math.pow((dx * dx + dy * dy) / maxR2, 1.4);
      data[i] = Math.round(Math.min(1, r * v) * 255);
      data[i + 1] = Math.round(Math.min(1, gr * v) * 255);
      data[i + 2] = Math.round(Math.min(1, b * v) * 255);
    }
  }
  return data;
}

await mkdir(OUT, { recursive: true });

for (const p of photos) {
  let source = p.src;
  if (p.plates) source = await blurPlates(p.src, p.plates);
  for (const w of p.widths) {
    let img = sharp(source).median(3); // phone-photo noise
    if (p.crop) {
      const [left, top, width, height] = p.crop;
      img = img.extract({ left, top, width, height });
    }
    img = img.resize({ width: w, kernel: 'lanczos3', withoutEnlargement: false }).sharpen({ sigma: 0.9, m1: 0.6, m2: 2 });
    const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    grade(data, info.width, info.height, info.channels);
    const suffix = w === p.widths[0] && p.widths.length > 1 ? '-sm' : '';
    const file = `${OUT}/${p.name}${suffix}.webp`;
    // Pass only the dimensions: reusing `info` can carry a stale `premultiplied` flag from the
    // removed alpha channel, which would skew the colours.
    const raw = { width: info.width, height: info.height, channels: info.channels };
    const out = await sharp(data, { raw }).webp({ quality: 78 }).toFile(file);
    console.log(file, `${out.width}x${out.height}`, `${Math.round(out.size / 1024)} KB`);
  }
}
