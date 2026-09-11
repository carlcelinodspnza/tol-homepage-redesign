#!/usr/bin/env python3
"""
Composite a screen image onto the screen of a hand-held phone mockup,
producing assets/in-pages/rewards_app_phone_mockup.webp for the Points & Rewards section.

Inputs
  --mockup   the hand-holding-phone PNG (RGBA, transparent background)
  --shot     a phone-screen-shaped image (see _tooling/assets/rewards-screen.png,
             the rewards poster fitted to width with its own green extended to fill)
Output
  assets/in-pages/rewards_app_phone_mockup.webp

How the screen is located (no hand-placed coordinates)
------------------------------------------------------
1. Mask = saturated warm orange (the mockup's placeholder screen) OR near-white (its on-screen
   graphics). Blue channel is the discriminator: the screen sits under b<150 while skin runs
   b>150, which is what separates the screen from the hand holding it.
2. Keep only the LARGEST CONNECTED COMPONENT. Skipping this was the first bug: bright knuckle
   and wrist highlights also match "near-white", so the warp painted patches onto the hand.
3. Flood the outside and treat anything unreached as interior, which fills the holes punched by
   the placeholder's own white text and doodles. Without this the old artwork showed through.
4. Corners = extremes of x+y and x-y over that filled component.

Compositing
-----------
The warp target is scaled 3.5% OUTWARD from the quad centre so the image overfills, while the
paste mask stays EXACTLY the component. Overfill + exact mask is what removes the orange rim
without letting any pixel spill onto the bezel. Clipping the mask to the quad instead (an earlier
attempt) shaved the screen's left edge, because the quad's straight edge cuts inside the real
screen where the rounded corners pull the extreme points in.

The near-black dynamic island is pasted back from the original afterwards, and a faint diagonal
sheen is added so the result reads as glass rather than a flat paste.

Usage:
  python3 _tooling/make-rewards-phone.py --mockup <path.png> --shot <path.png> [--width 1200]
"""
import argparse
import os
import sys
from collections import deque

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    sys.exit("needs Pillow + numpy")

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "assets", "in-pages", "rewards_app_phone_mockup.webp")


def screen_parts(px, box):
    """Full-resolution screen mask + the skin that occludes it.

    Three things this has to get right, each learned from a broken render:

    * FULL RESOLUTION. The first version ran the connected-component step on a 4x-downscaled
      grid and upscaled with np.kron, so every mask boundary was quantised to 4px. That is what
      produced the stair-stepped screen edge and the blocky notch bitten out of the fingertip.

    * SKIN IS "ORANGE". Arm skin measures rgb(214,154,118): r>200, b<150, r-b=96 - it passes the
      warm-orange test the placeholder screen passes. Colour alone therefore cannot separate the
      screen from the hand holding it, which is why an earlier attempt that leaned on connected
      components collapsed the moment the flood fill silently no-opped and merged the two.
      The separator is g-b: skin stays in 8..38 while the screen's orange holds ~49 and its light
      top ~63. r-g in 30..95 keeps white on-screen text (r-g=0) out of the skin set.

    * ImageDraw.floodfill was a no-op on this image (it filled 0 pixels), so no connected-
      component step is used at all. The screen is isolated by colour + a spatial box instead.

    `box` is (x_max, y_max) bounding the phone; the arm occupies the lower right and a residual
    blob of it survives skin rejection, so the box is what finally excludes it. Tuned to this
    mockup, not general.
    """
    r, g, b, al = [px[..., i].astype(int) for i in range(4)]
    screenish = ((al > 200) & (r > 200) & (b < 150) & ((r - b) > 85)) | \
                ((al > 200) & (r > 235) & (g > 225) & (b > 215))
    skin = (al > 200) & ((r - g) >= 30) & ((r - g) <= 95) & ((g - b) >= 8) & ((g - b) <= 38)
    # OPEN the skin set so only real fingers survive. The placeholder's own white text and
    # asterisks sit on orange, and their anti-aliased edges land inside the skin colour window;
    # leaving them in punched holes that let "yourwebsite.com" show through the new screen.
    # Strokes are a few px wide and vanish under an 11px opening; a finger is ~100px and does not.
    sk = Image.fromarray((skin * 255).astype(np.uint8))
    skin = np.array(sk.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(11))) > 0
    H, W = r.shape
    yy, xx = np.mgrid[0:H, 0:W]
    inbox = (xx < box[0]) & (yy < box[1])
    return (screenish & ~skin & inbox), skin


def find_coeffs(dst, src):
    m = []
    for p1, p2 in zip(dst, src):
        m.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0] * p1[0], -p2[0] * p1[1]])
        m.append([0, 0, 0, p1[0], p1[1], 1, -p2[1] * p1[0], -p2[1] * p1[1]])
    A = np.array(m, float); B = np.array(src, float).reshape(8)
    return np.linalg.solve(A.T @ A, A.T @ B)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mockup", required=True)
    ap.add_argument("--shot", required=True)
    ap.add_argument("--width", type=int, default=1200)
    ap.add_argument("--overfill", type=float, default=1.02)
    ap.add_argument("--preview", default=None)
    ap.add_argument("--boxx", type=int, default=1400)
    ap.add_argument("--boxy", type=int, default=1650)
    a = ap.parse_args()

    mock = Image.open(a.mockup).convert("RGBA"); W, H = mock.size
    px = np.array(mock)

    r, g, b, al = [px[..., i].astype(int) for i in range(4)]

    clean, skin = screen_parts(px, (a.boxx, a.boxy))

    # Use the cleaned screen region ITSELF as the mask, not a polygon fitted to it. An earlier
    # version eroded by 11px to shake off stray specks, took the extremes, then grew the quad
    # back by a flat 3% - which under-recovered the LEFT edge by ~39px (x=555 vs the true 516)
    # and left a band of the original cream gradient, with two of its white doodles, showing
    # inside the bezel. The region's own boundary is the screen's true boundary.
    ys, xs = np.nonzero(clean)

    # Corners by fitting the four EDGES, not by taking extreme points. Extremes land on the
    # rounded corners and are pulled inward, and they shift whenever the mask changes: that is
    # what moved the bottom-right corner from x=1231 to x=1208 between runs and left a strip of
    # the original orange down the right side of the screen. A fitted right edge puts that
    # corner at x=1297, ~90px further out, which is where the screen actually ends.
    # Left/right are fitted as x=f(y) and top/bottom as y=f(x); each is valid because the quad
    # is tall and near-vertical. The middle 76% of rows/columns is used so the rounded corners
    # and the fingertip notch do not drag the fit.
    y0, y1 = ys.min(), ys.max(); hh = y1 - y0
    rows = [(v, xs[ys == v].min(), xs[ys == v].max())
            for v in range(int(y0 + .12 * hh), int(y1 - .12 * hh)) if (ys == v).sum() > 40]
    Rr = np.array(rows)
    Lm, Lb = np.polyfit(Rr[:, 0], Rr[:, 1], 1)      # left   x = Lm*y + Lb
    Rm, Rb = np.polyfit(Rr[:, 0], Rr[:, 2], 1)      # right  x = Rm*y + Rb

    # Top and bottom CANNOT be fitted the same way by column. On a rotated rectangle the
    # per-column min-y traces the side edges, not the top, which is what produced a quad whose
    # top-left corner sat at y=96 - hundreds of px above a screen that starts at y=309. Fit them
    # instead from thin bands at the vertical extremes, which do lie on those two edges.
    yyg = np.mgrid[0:r.shape[0], 0:r.shape[1]][0]
    def band(lo, hi):
        m = clean & (yyg >= lo) & (yyg <= hi)
        by, bx = np.nonzero(m)
        return np.polyfit(bx, by, 1)                # y = m*x + c
    Tm, Tb = band(y0, y0 + 40)
    Bm, Bb = band(y1 - 40, y1)

    def meet(m1, b1, m2, b2):                        # x = m1*y + b1  with  y = m2*x + b2
        x = (m1 * b2 + b1) / (1 - m1 * m2)
        return (x, m2 * x + b2)

    quad = [meet(Lm, Lb, Tm, Tb), meet(Rm, Rb, Tm, Tb),
            meet(Rm, Rb, Bm, Bb), meet(Lm, Lb, Bm, Bb)]
    cx = sum(p[0] for p in quad) / 4.0
    cy = sum(p[1] for p in quad) / 4.0
    grow = lambda k: [(cx + (p[0] - cx) * k, cy + (p[1] - cy) * k) for p in quad]

    # Mask = the screen polygon MINUS the fingers MINUS the dark bezel. Masking by screen COLOUR
    # left a bright 1-3px rim tracing the screen edge and the island - blend pixels that are
    # neither "screenish" nor skin - and morphological growth to cover it overshot onto the
    # bezel and tore white gaps down the right edge. Subtracting what is genuinely in front
    # (skin) or behind (bezel) captures the rim by construction, and lets the polygon be grown
    # safely: any overshoot lands on the dark bezel and is removed.
    H, W = r.shape
    poly = Image.new("L", (W, H), 0)
    ImageDraw.Draw(poly).polygon(grow(1.012), fill=255)
    darkest = np.maximum(np.maximum(r, g), b)
    comp = (np.array(poly) > 0) & ~skin & (darkest >= 90) & (al > 200)
    grown = grow(1.012 * a.overfill)
    print("fitted quad:", [(round(x), round(y)) for x, y in quad], " mask px:", int(comp.sum()))

    shot = Image.open(a.shot).convert("RGBA"); sw, sh = shot.size
    warped = shot.transform((W, H), Image.PERSPECTIVE,
                            find_coeffs(grown, [(0, 0), (sw, 0), (sw, sh), (0, sh)]),
                            resample=Image.BICUBIC)

    # Soft edge: erode by ~1px first so the feather falls INSIDE the screen and never bleeds
    # onto the bezel, then blur. This is what removes the hard pasted-rectangle look.
    mi = Image.fromarray((comp * 255).astype(np.uint8))
    mi = mi.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))

    out = mock.copy()
    out.paste(warped, (0, 0), mi)

    # ambient: the screen is lit by the same scene, so darken it very slightly toward the
    # bezel. A perfectly flat paste is the main tell that something was composited in.
    yy, xx = np.mgrid[0:H, 0:W]
    inner = np.array(Image.fromarray((comp * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
                     .filter(ImageFilter.GaussianBlur(26))).astype(float) / 255.0
    vign = np.clip((1.0 - inner) * 0.42, 0, 1) * (comp.astype(float))
    shade = Image.new("RGBA", (W, H), (12, 16, 20, 0))
    shade.putalpha(Image.fromarray((vign * 190).astype(np.uint8)))
    out.alpha_composite(shade)

    # glass sheen
    band = np.clip(1 - np.abs((xx * 0.55 + yy * 0.45) - 980) / 560, 0, 1) ** 2
    gl = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    gl.putalpha(Image.fromarray(((band * 20).astype(int) * np.array(mi).astype(int) // 255).astype(np.uint8)))
    out.alpha_composite(gl)

    # dynamic island back on top
    island = (r < 70) & (g < 70) & (b < 70) & (al > 200) & comp
    out.paste(mock, (0, 0),
              Image.fromarray((island * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))

    alpha = np.array(out)[..., 3]
    ys2, xs2 = np.nonzero(alpha > 6)
    crop = out.crop((int(xs2.min()), int(ys2.min()), int(xs2.max()) + 1, int(ys2.max()) + 1))
    pad = int(crop.width * 0.02)
    canv = Image.new("RGBA", (crop.width + pad * 2, crop.height + pad * 2), (0, 0, 0, 0))
    canv.paste(crop, (pad, pad), crop)
    final = canv.resize((a.width, round(a.width * canv.size[1] / canv.size[0])), Image.LANCZOS)
    final.save(OUT, "WEBP", quality=92, method=6)
    print("wrote %s  %s  %d bytes" % (OUT, final.size, os.path.getsize(OUT)))
    if a.preview:
        pv = Image.new("RGBA", final.size, (255, 255, 255, 255)); pv.alpha_composite(final)
        pv.convert("RGB").save(a.preview)
        print("preview ->", a.preview)


if __name__ == "__main__":
    main()
