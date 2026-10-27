# Bajrang Motors

The website for **Bajrang Motors**, a car repair workshop at Hindorna Chokdi, Rajula, Gujarat.
It tells one story: **from broken to back on the road.**

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/ (deploy this folder)
npm run preview   # serve the production build locally
```

> VS Code Live Server can't run the source directly (it uses npm packages).
> Use `npm run dev`, or point Live Server at the built `dist/` folder.

## Editing content

| What | Where |
|---|---|
| Phone numbers, address, hours, email, WhatsApp, links | `src/data/business.js` |
| Services and their hotspot positions on the car | `src/data/services.js` |
| Customer reviews (hidden until you add real ones) | `src/data/reviews.js` |
| "25+ years" legacy line | `legacy` in `src/data/business.js` |
| Page text | `index.html` (`{{tokens}}` are filled from `business.js`) |
| Photos | Put the original in `image/`, list it in `scripts/optimize-images.mjs`, run `npm run images` |

To show WhatsApp buttons everywhere, set `whatsapp` in `business.js`.
Sunday timing and the "please call ahead" note are set in `hours` / `hoursNote` in `business.js`.

## How it's built

- **Vite** with plain ES modules. No framework.
- **GSAP + ScrollTrigger** for the hero intro and the scroll sequences. **Lenis** for smooth scrolling.
- **The car** is a real photo of a white Hyundai Elite i20, cut out and split into layers by
  `scripts/build-car-assets.py` (body, two spinning wheel discs, a ground shadow, and a blueprint
  drawing traced from the photo). `src/components/car.js` stacks the layers; wheel spin, braking
  pitch, sag, lights and the blueprint→photo reveal are all CSS custom properties.
- **Sequences:** `src/animations/hero.js` (arrival + camera push into the real bay),
  `journey.js` (problem → inspection → repair → ready → road), `closing.js`, `reveals.js`.
- With `prefers-reduced-motion`, or if JavaScript fails, everything shows as a static, readable page.

## The 3D drive (closing scene)

`src/scene/` renders the final sequence with three.js: the i20 driving an S-curved sunset road
while the camera circles it (front ¾ → profile → rear ¾ → rear → opposite side → wide → hero).
Shots are listed in `SHOTS` in `src/scene/drive.js`; the road shape is `ROAD_POINTS` in
`src/scene/world.js`. three.js loads only when a visitor nears the section. Without WebGL, with
reduced motion, or if the model can't load, the 2D photo version is shown instead.

To install/replace the car: save the model as `image/i20.glb`, then run `npm run car-model`.


Car photo: ["2015 Hyundai i20 Premium SE MPi 1.4 Front"](https://commons.wikimedia.org/wiki/File:2015_Hyundai_i20_Premium_SE_MPi_1.4_Front.jpg)
by Vauxford, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The cut-out
(`image/i20-cutout.png`) and the generated layers in `public/media/car/` are adaptations and are
shared under the same licence. Their credit is on `credits.html` (linked from the footer); keep it if you use them.

3D car: ["2020 Hyundai i20 N- Line"](https://sketchfab.com/3d-models/2020-hyundai-i20-n-line-6c267be59fb94253bff935616eddcc99)
by shreyanshchaurasia13, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), optimised for the web.

The previous version of the site is kept in `legacy/`.
