#!/usr/bin/env python3
"""
Rebuild the featured-deal artwork as LANDSCAPE tiles for the redesigned deals card.

Why this exists
---------------
Each source Deal_N.webp (425x498, RGBA, rounded corners baked in as transparency) is a FLAT
image that bakes in the WHOLE card: a "DAILY DEAL" band, a divider rule, the offer typography,
and a "Shop Now" pill. The redesigned card supplies the label and makes the entire card the
click target, so the band and the pill are redundant -- and a painted-on button inside a card
that is already a link reads as broken.

Measured geometry, identical on all six source files (not assumed -- profiled):
    y  45- 64   "DAILY DEAL"
    y 103-108   divider rule
    y 133-399   the offer block            <- the only part we keep
    y 413-462   "Shop Now" pill, x 123-298 <- dropped
The field is a single flat colour, rgb(174,208,53), so re-canvassing to any aspect ratio is
seamless: we PAD with that exact colour instead of cropping or stretching the offer.

This is what lets the card go landscape without damage. Forcing the portrait source into a
2:1 box with object-fit:cover would crop ~63% of its height and cut the price off; with
object-fit:fill it would squash. Padding a flat field does neither.

Scaling is UNIFORM across all six tiles, deliberately. Fitting each offer block to the tile
individually blows the sparse cards ("$129") far larger than the dense ones ("1 for $20 /
3 for $55 / 4 for $70") and the rail stops reading as one set. A single scale factor preserves
the original artwork's relative type sizes. The tallest block (Deal_3, 227x252) is therefore
the binding constraint on how large any of them can be.

425px is the largest source anywhere in the repo (checked assets/in-pages, assets/full-library
and sites/**) -- there is no higher-resolution original, so tiles are upscaled with LANCZOS.
That is acceptable ONLY because the artwork is flat white-on-green typography with hard edges
and no photographic detail. Do not reuse this approach on a photo.

Usage:  python3 _tooling/make-deal-tiles.py [--ratio 2.0] [--height 380] [--fill 0.78] [--check]
"""
import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required:  python3 -m pip install Pillow")

FIELD = (174, 208, 53, 255)          # the flat green, measured not guessed
DEALS = ["Deal_1", "Deal_2", "Deal_3", "Deal_4", "Deal_6", "Deal_7"]

# Vertical window containing every offer block, excluding the "DAILY DEAL" band (ends at the
# y=108 divider) and the "Shop Now" pill (starts y=413).
CROP_TOP, CROP_BOTTOM = 112, 406

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC_DIR = os.path.join(REPO, "assets", "in-pages")


def is_field(px, tol=14):
    """True for the flat green field, or anything outside the card's rounded corners."""
    r, g, b, a = px
    if a < 200:
        return True
    return abs(r - FIELD[0]) < tol and abs(g - FIELD[1]) < tol and abs(b - FIELD[2]) < tol


def offer_bbox(im):
    """Tight bbox of the offer block inside the crop window."""
    w, h = im.size
    px = im.load()
    xs, ys = [], []
    for y in range(CROP_TOP, min(CROP_BOTTOM, h)):
        for x in range(w):
            if not is_field(px[x, y]):
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ratio", type=float, default=2.0, help="tile width/height (target spec: 2.0)")
    ap.add_argument("--height", type=int, default=380, help="tile height in px")
    ap.add_argument("--fill", type=float, default=0.78,
                    help="fraction of tile height the TALLEST offer block may occupy")
    ap.add_argument("--width-fill", type=float, default=0.84,
                    help="fraction of tile width the WIDEST offer block may occupy")
    ap.add_argument("--check", action="store_true", help="report geometry and exit")
    args = ap.parse_args()

    tw, th = int(round(args.height * args.ratio)), args.height

    sources = {}
    for name in DEALS:
        p = os.path.join(SRC_DIR, name + ".webp")
        if not os.path.exists(p):
            sys.exit("missing source: " + p)
        im = Image.open(p).convert("RGBA")
        box = offer_bbox(im)
        if box is None:
            sys.exit("no offer content found in " + name)
        sources[name] = (im, box)

    # ONE scale for the whole set: the most constrained card decides it for everybody.
    scale = min(
        min(tw * args.width_fill / (b[2] - b[0]), th * args.fill / (b[3] - b[1]))
        for _, b in sources.values()
    )

    print("tile %dx%d (ratio %.2f)   uniform scale %.3f" % (tw, th, args.ratio, scale))
    for name, (_, b) in sources.items():
        cw, ch = b[2] - b[0], b[3] - b[1]
        print("  %-7s offer %3dx%3d -> %3dx%3d  (%.0f%% of tile width)"
              % (name, cw, ch, round(cw * scale), round(ch * scale), 100.0 * cw * scale / tw))
    if args.check:
        return

    for name, (im, b) in sources.items():
        crop = im.crop(b)
        nw, nh = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
        crop = crop.resize((nw, nh), Image.LANCZOS)
        tile = Image.new("RGBA", (tw, th), FIELD)
        tile.paste(crop, ((tw - nw) // 2, (th - nh) // 2), crop)
        out = os.path.join(SRC_DIR, name + "_wide.webp")
        tile.convert("RGB").save(out, "WEBP", quality=92, method=6)
        print("  wrote %s (%d bytes)" % (os.path.basename(out), os.path.getsize(out)))


if __name__ == "__main__":
    main()
