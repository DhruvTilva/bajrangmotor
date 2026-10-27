# Transformation film: production note

**"Broken in. Road-ready out."** A 24-second, 1920×1080, 24 fps silent film for the website's
"07 / The film" section.

| File | What |
|---|---|
| `public/media/film/bajrang-motors-transformation.mp4` | Web version, H.264, fast-start |
| `public/media/film/bajrang-motors-transformation-720p.mp4` | Lighter version used on phones |
| `public/media/film/bajrang-motors-transformation-poster.jpg` | Poster (opening shot) |
| `video/master/bajrang-motors-transformation-master.mp4` | Near-lossless master (yuv444, CRF 12) for re-editing |
| `video/film.html`, `video/film.js` | The film's source: every shot, the edit and the titles |
| `scripts/render-film.mjs` | Renders the film to the files above |

## Storyboard

| Time | Shot | How it's made |
|---|---|---|
| 0.0–3.6 | 01 The problem: a dusty, dented i20 on a dusk road | 3D car on the site's 3D road |
| 3.6–7.0 | 02 Arriving at Bajrang Motors, rolling into the right-hand bay | 3D car composited onto the **real photo** of the garage front, camera matched to the photo, shadows only |
| 7.0–8.6 | 03 Inspection | **Real photo**: engine bay with a mechanic at work |
| 8.6–10.6 | 03 Inspection: a blue scan gate passes over the damaged front corner | 3D, over a blurred real workshop photo |
| 10.6–13.2 | 04 Repair | **Real photos**: 3D alignment rig, then wheel balancer and tyre changers |
| 13.2–17.6 | 05 Restored: a white light gate sweeps rear to front, and behind it the car is clean and polished | 3D: damaged and clean copies of the same model, split by a moving clipping plane |
| 17.6–19.6 | 06 Back on the road, driving out of the bay | 3D car over the real garage-front photo |
| 19.6–24.0 | 06 Driving into the sunset, end title | 3D car on the 3D road; title "Bajrang Motors: Let's get you back on the road." |

## How it was produced

No AI video service or GPU was available, so the film is rendered from the same three.js scene and
3D car the website uses, one frame at a time in headless Chrome, then encoded with FFmpeg.

- **One car throughout:** every shot uses the same i20 model. The damaged look is procedural
  (dust, grime, scratches, a dented front-left bumper corner, a dead left headlamp). The repaired
  look is the model's own finish, so damage and repair always match up.
- **The real garage:** arrival and exit are composited onto the actual photo of the Bajrang Motors
  front. The montage uses the actual workshop photos. Nothing claims to be the garage that isn't.
- **No audio:** there's no licensed music, and the site plays the film muted anyway.

## Re-rendering

```bash
npm run film              # full 1080p render (about 1–3 hours on this CPU-only machine)
npm run film -- --draft   # 960×540 preview
npm run film -- --resume  # continue an interrupted render
```

Preview any moment in the dev server at `http://localhost:5173/video/film.html?t=15.5`.

## Credits

The 3D car is "2020 Hyundai i20 N- Line" by shreyanshchaurasia13 (CC BY 4.0), listed on the site's
credits page. All workshop photographs are of the actual garage.
