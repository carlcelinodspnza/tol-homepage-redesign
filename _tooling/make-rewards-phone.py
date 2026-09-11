#!/usr/bin/env python3
"""
Composite a live capture of the MOBILE homepage onto the screen of a hand-held phone mockup,
producing assets/in-pages/rewards_app_phone_mockup.webp for the Points & Rewards section.

Inputs
  --mockup   the hand-holding-phone PNG (RGBA, transparent background)
  --shot     a 390x844 screenshot of the site's own mobile view
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
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("needs Pillow + numpy")

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "assets", "in-pages", "rewards_app_phone_mockup.webp")


def largest_component(mask, step=4):
    small = mask[::step, ::step]
    h, w = small.shape
    seen = np.zeros_like(small, bool)
    best = None
    for sy in range(h):
        for sx in range(w):
            if small[sy, sx] and not seen[sy, sx]:
                q = deque([(sy, sx)]); seen[sy, sx] = True; comp = []
                while q:
                    y, x = q.popleft(); comp.append((y, x))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                if best is None or len(comp) > len(best):
                    best = comp
    out = np.zeros_like(small, bool)
    for y, x in best:
        out[y, x] = True
    return np.kron(out, np.ones((step, step), bool))[:mask.shape[0], :mask.shape[1]]


def fill_holes(mask):
    H, W = mask.shape
    seen = np.zeros((H, W), bool); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if not mask[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if not mask[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and not mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return mask | (~seen)


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
    ap.add_argument("--overfill", type=float, default=1.035)
    a = ap.parse_args()

    mock = Image.open(a.mockup).convert("RGBA"); W, H = mock.size
    px = np.array(mock)
    r, g, b, al = [px[..., i].astype(int) for i in range(4)]
    screen = ((al > 200) & (r > 200) & (b < 150) & ((r - b) > 85)) | \
             ((al > 200) & (r > 235) & (g > 225) & (b > 215))
    comp = fill_holes(largest_component(screen))
    ys, xs = np.nonzero(comp)
    s, d = xs + ys, xs - ys
    quad = [(int(xs[s.argmin()]), int(ys[s.argmin()])), (int(xs[d.argmax()]), int(ys[d.argmax()])),
            (int(xs[s.argmax()]), int(ys[s.argmax()])), (int(xs[d.argmin()]), int(ys[d.argmin()]))]
    cx, cy = xs.mean(), ys.mean()
    grown = [(cx + (p[0] - cx) * a.overfill, cy + (p[1] - cy) * a.overfill) for p in quad]
    print("screen quad:", quad, " mask px:", int(comp.sum()))

    shot = Image.open(a.shot).convert("RGBA"); sw, sh = shot.size
    warped = shot.transform((W, H), Image.PERSPECTIVE,
                            find_coeffs(grown, [(0, 0), (sw, 0), (sw, sh), (0, sh)]),
                            resample=Image.BICUBIC)

    mi = Image.fromarray((comp * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    out = mock.copy()
    out.paste(warped, (0, 0), mi)
    island = (r < 70) & (g < 70) & (b < 70) & (al > 200) & comp
    out.paste(mock, (0, 0),
              Image.fromarray((island * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5)))
    yy, xx = np.mgrid[0:H, 0:W]
    band = np.clip(1 - np.abs((xx * 0.55 + yy * 0.45) - 980) / 560, 0, 1) ** 2
    gl = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    gl.putalpha(Image.fromarray(((band * 22).astype(int) * np.array(mi).astype(int) // 255).astype(np.uint8)))
    out.alpha_composite(gl)

    alpha = np.array(out)[..., 3]
    ys2, xs2 = np.nonzero(alpha > 6)
    crop = out.crop((int(xs2.min()), int(ys2.min()), int(xs2.max()) + 1, int(ys2.max()) + 1))
    pad = int(crop.width * 0.02)
    canv = Image.new("RGBA", (crop.width + pad * 2, crop.height + pad * 2), (0, 0, 0, 0))
    canv.paste(crop, (pad, pad), crop)
    final = canv.resize((a.width, round(a.width * canv.size[1] / canv.size[0])), Image.LANCZOS)
    final.save(OUT, "WEBP", quality=90, method=6)
    print("wrote %s  %s  %d bytes" % (OUT, final.size, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()
