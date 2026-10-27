// Renders the transformation film (video/film.html) to MP4.
//
//   npm run film                 full 1920×1080 render → public/media/film/
//   npm run film -- --draft      960×540 quick preview
//   npm run film -- --from 13 --to 18   render only part (draft frames, no encode)
//
// How: starts a Vite dev server, opens the film page in headless Chrome, and for
// every frame calls window.film.render(t) and screenshots it. FFmpeg (ffmpeg-static)
// then encodes the web MP4, a high-quality master and the poster.
// Set CHROME_PATH if Chrome isn't at /usr/bin/google-chrome.
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => (args.includes(`--${name}`) ? parseFloat(args[args.indexOf(`--${name}`) + 1]) : fallback);
const draft = flag('draft');
const [W, H] = draft ? [960, 540] : [1920, 1080];
const FRAMES_DIR = 'video/.frames';
const OUT_DIR = 'public/media/film';
const MASTER_DIR = 'video/master';

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = `${server.resolvedUrls.local[0]}video/film.html`;

let browser;
let page;
// (Re)launches Chrome and loads the film page. Called again if Chrome crashes mid-render.
async function openPage() {
  await browser?.close().catch(() => {});
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
    protocolTimeout: 90000, // a hung software-GL screenshot is retried quickly
  });
  page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction('window.film && window.film.ready', { timeout: 600000 });
}
await openPage();
const { duration, fps } = await page.evaluate(() => ({ duration: window.film.duration, fps: window.film.fps }));

const first = Math.round(opt('from', 0) * fps);
const last = Math.round(opt('to', duration) * fps);
// --resume keeps frames already rendered by an interrupted run.
if (!flag('resume')) rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });
const started = Date.now();
for (let f = first; f < last; f++) {
  const file = `${FRAMES_DIR}/${String(f - first).padStart(5, '0')}.png`;
  if (flag('resume') && existsSync(file)) continue;
  for (let attempt = 1; ; attempt++) {
    try {
      await page.evaluate((t) => window.film.render(t), f / fps);
      await page.screenshot({ path: file });
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
      console.warn(`frame ${f}: ${err.message.split('\n')[0]} (restarting Chrome, attempt ${attempt + 1})`);
      await openPage();
    }
  }
  if ((f - first) % 24 === 0) {
    const done = f - first + 1;
    const eta = ((Date.now() - started) / done) * (last - f) / 1000;
    console.log(`frame ${f}/${last}  ~${Math.round(eta / 60)} min left`);
  }
}
await browser.close();
await server.close();

if (first !== 0 || last !== Math.round(duration * fps)) {
  console.log(`Partial render: frames are in ${FRAMES_DIR}/`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(MASTER_DIR, { recursive: true });
const ff = (...a) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
const input = ['-framerate', String(fps), '-i', `${FRAMES_DIR}/%05d.png`];
const suffix = draft ? '-draft' : '';

// Web version: H.264, yuv420p, fast-start so playback begins before the download finishes.
ff(...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', draft ? '26' : '23', '-tune', 'film', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `${OUT_DIR}/bajrang-motors-transformation${suffix}.mp4`);
// Smaller version for phones.
if (!draft) ff(...input, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-tune', 'film', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `${OUT_DIR}/bajrang-motors-transformation-720p.mp4`);
// Master: near-lossless, for future edits.
if (!draft) ff(...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv444p', '-an', `${MASTER_DIR}/bajrang-motors-transformation-master.mp4`);
// Poster: the opening shot once it has faded up.
ff('-i', `${FRAMES_DIR}/${String(Math.round(1.2 * fps)).padStart(5, '0')}.png`, '-q:v', '3', `${OUT_DIR}/bajrang-motors-transformation-poster${suffix}.jpg`);

for (const f of [`${OUT_DIR}/bajrang-motors-transformation${suffix}.mp4`, `${OUT_DIR}/bajrang-motors-transformation-720p.mp4`, `${MASTER_DIR}/bajrang-motors-transformation-master.mp4`]) {
  if (existsSync(f)) console.log(f, `${(statSync(f).size / 1048576).toFixed(1)} MB`);
}
if (!flag('keep-frames')) rmSync(FRAMES_DIR, { recursive: true, force: true });
console.log(`Done in ${Math.round((Date.now() - started) / 60000)} min.`);
