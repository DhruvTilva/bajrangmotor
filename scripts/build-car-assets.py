"""
Builds the animated car's image layers from image/i20-cutout.png.

Source photo: "2015 Hyundai i20 Premium SE MPi 1.4 Front" by Vauxford,
https://commons.wikimedia.org/wiki/File:2015_Hyundai_i20_Premium_SE_MPi_1.4_Front.jpg
licensed CC BY-SA 4.0. The cut-out and every file generated here are adaptations
of it and are shared under the same licence (credited in the site footer).

Outputs (public/media/car/):
  i20-body[-sm].webp    the car itself
  i20-lines[-sm].webp   blueprint line drawing traced from the photo's edges
  i20-shadow.webp       soft ground shadow
  wheel-front.webp      front alloy, "un-squashed" into a circle so it can spin
  wheel-rear.webp       rear alloy, same

Run:  python3 scripts/build-car-assets.py   (needs Pillow + numpy)
If the source photo changes, update SIZE and WHEELS here and in src/components/car.js.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = Path('image/i20-cutout.png')
OUT = Path('public/media/car')
SIZE = (2284, 1219)  # cut-out dimensions; all coordinates below use this space

# Alloy wheels as seen in the photo: centre, radii of the rim ellipse, tilt (deg, clockwise).
WHEELS = {
    'front': dict(cx=1106, cy=978, rx=112, ry=170, tilt=8),
    'rear': dict(cx=172, cy=738, rx=60, ry=124, tilt=3),
}
WHEEL_PAD = 1.06  # include a sliver of tyre so the spinning disc fully covers the rim

# Ground contact patch for the shadow: rear-left, front-left, front-right, rear-right corners.
SHADOW = [(30, 845), (120, 915), (1100, 1228), (2170, 1088), (1800, 905), (700, 825)]
SHADOW_PAD = 140  # extra canvas height below the car for the blurred shadow

BLUE = (42, 166, 230)


def save(img, name, width=None):
    if width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(OUT / name, 'WEBP', quality=82, alpha_quality=90, method=6)
    print(OUT / name, img.size, f"{(OUT / name).stat().st_size // 1024} KB")


def wheel_disc(src, cx, cy, rx, ry, tilt, size=512):
    r = ry * WHEEL_PAD
    half = int(r * 1.6)
    crop = src.crop((cx - half, cy - half, cx + half, cy + half))
    crop = crop.rotate(tilt, resample=Image.BICUBIC)  # undo the clockwise tilt
    stretched = crop.resize((round(crop.width * ry / rx), crop.height), Image.LANCZOS)
    mx, my = stretched.width / 2, stretched.height / 2
    disc = stretched.crop((round(mx - r), round(my - r), round(mx + r), round(my + r))).resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    disc.putalpha(mask.resize((size, size), Image.LANCZOS))
    return disc


def line_drawing(src):
    """Blue edge drawing: Sobel edges of the paintwork plus a crisp outline of the silhouette."""
    arr = np.asarray(src).astype(np.float32) / 255
    alpha = arr[..., 3]
    lum = (arr[..., 0] * 0.3 + arr[..., 1] * 0.59 + arr[..., 2] * 0.11) * alpha

    def sobel(ch):
        p = np.pad(ch, 1, mode='edge')
        gx = (p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[1:-1, :-2] + p[2:, :-2])
        gy = (p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:])
        return np.hypot(gx, gy)

    detail = np.clip((sobel(lum) - 0.22) / 0.5, 0, 1) * 0.8
    outline = np.clip(sobel(alpha) / 1.5, 0, 1)
    a = np.maximum(detail, outline)
    a = np.maximum(a, alpha * 0.07)  # faint glassy fill
    out = np.zeros(arr.shape, np.uint8)
    out[..., :3] = BLUE
    out[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def shadow():
    w, h = SIZE
    img = Image.new('L', (w, h + SHADOW_PAD), 0)
    ImageDraw.Draw(img).polygon(SHADOW, fill=215)
    img = img.filter(ImageFilter.GaussianBlur(38))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.putalpha(img)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert('RGBA')
    assert src.size == SIZE, f'expected {SIZE}, got {src.size}'

    save(src, 'i20-body.webp', 1600)
    save(src, 'i20-body-sm.webp', 900)

    lines = line_drawing(src.resize((1600, round(1600 * SIZE[1] / SIZE[0])), Image.LANCZOS))
    save(lines, 'i20-lines.webp')
    save(lines, 'i20-lines-sm.webp', 900)

    save(shadow(), 'i20-shadow.webp', 800)

    for name, w in WHEELS.items():
        save(wheel_disc(src, **w), f'wheel-{name}.webp')


if __name__ == '__main__':
    main()
