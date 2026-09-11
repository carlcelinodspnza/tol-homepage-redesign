#!/usr/bin/env python3
"""
Recolour the site to the 2026 Tree of Life brand palette.

Source of truth: TOL_Brand Guide_2026_R1.
    Primary    #26A94B
    Secondary  #1E3032
    Tertiary   #98D3D9

The palette is only three colours, so three shades are DERIVED from it. Each exists to satisfy
a contrast threshold the brand colour itself cannot, and each is recorded here so nobody later
mistakes them for brand colours:

    #1E873C  the workhorse green. Measured 4.58 BOTH as text on white AND as a ground under
             white text, which is what makes it a safe one-for-one swap for the old #5A9642
             wherever it appears -- the raw primary manages only 3.06 in either direction and
             would fail normal-size text.
    #28B350  hover fill for primary buttons. Hover must LIGHTEN, not darken: the buttons carry
             #1E3032 text at 4.50, and darkening the green drops that to 3.40 (fails).
             Lightening takes it to 5.02.
    #E6F1F3  a soft tertiary-tinted ground replacing the old warm #F2F7EE.

Contrast facts that drove every decision (all measured, none assumed):
    white on #26A94B ............ 3.06  -> graphics and LARGE text only, never body copy
    #1E3032 on #26A94B .......... 4.50  -> the correct button pairing
    #26A94B on white ............ 3.06  -> fails small text; use #1E873C instead
    #1E3032 on white ........... 13.78
    white on #1E3032 ........... 13.78
    #98D3D9 on #1E3032 .......... 8.30
    #1E3032 on #98D3D9 .......... 8.30

Scope. chrome.css carries the platform's own brand literals, but only ~19 of them; the rest of
its palette is untouched Bootstrap utility colour (alert reds, link blues) that never paints a
brand surface. Those are deliberately left alone. Generic darks (#1a1a1a, #111, #222, #121315)
ARE remapped to the brand secondary, which is what turns the page's dark chrome from neutral
charcoal into the brand's charcoal-green.

NOT changed: typography. The guide specifies Gotham and Forma DJR Display. Both are commercial
licences and neither is servable from Google Fonts, so substituting a lookalike would be a
silent downgrade. The site stays on Montserrat until the client supplies licensed webfonts.

Usage:  python3 _tooling/apply-brand-2026.py [--check]
"""
import io
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

PRIMARY   = "#26a94b"
SECONDARY = "#1e3032"
TERTIARY  = "#98d3d9"
GREEN_TXT = "#1e873c"      # derived: 4.58 both directions
PRIM_HOV  = "#28b350"      # derived: hover lightens so dark text stays >= 4.5
SEC_HOV   = "#223638"      # derived: secondary lightened, white text 12.71
TINT      = "#e6f1f3"      # derived: tertiary-tinted ground
MUTED     = "#8fa0a2"      # neutral tuned to the secondary hue (disabled controls)

# Applied to BOTH chrome.css and our injected blocks. Order matters only in that every key is
# a distinct literal, so a single pass is safe.
GLOBAL_MAP = {
    # --- the site's old greens -> brand ---
    "#aed136": PRIMARY,     "#aed036": PRIMARY,
    "#b5d053": PRIMARY,     "#c3dc6b": PRIM_HOV,
    "#5a9642": GREEN_TXT,   "#68954d": PRIMARY,     "#5a8442": PRIM_HOV,
    "#527539": PRIMARY,     "#47762f": PRIMARY,     "#14532d": SECONDARY,
    # --- every dark ink -> brand secondary ---
    "#21362c": SECONDARY,   "#1d2f24": SECONDARY,   "#2c3a31": SECONDARY,
    "#121315": SECONDARY,   "#12210f": SECONDARY,   "#152111": SECONDARY,
    "#0d0d0d": SECONDARY,   "#213c2c": SECONDARY,   "#1a1a1a": SECONDARY,
    "#3f5145": SECONDARY,   "#4a5a50": SECONDARY,
    # --- accents / grounds ---
    "#b42285": GREEN_TXT,   # off-brand magenta label -> brand green that passes on white
    "#f2f7ee": TINT,
    "#9aa79f": MUTED,
}
SHORT_MAP = {"#111": SECONDARY, "#222": SECONDARY}


def recolour(text, label):
    hits = {}
    for old, new in GLOBAL_MAP.items():
        pat = re.compile(re.escape(old), re.I)
        n = len(pat.findall(text))
        if n:
            text = pat.sub(new, text)
            hits[old] = n
    for old, new in SHORT_MAP.items():
        # only a standalone 3-digit hex, never the first half of a 6-digit one
        pat = re.compile(re.escape(old) + r"\b(?![0-9a-fA-F])", re.I)
        n = len(pat.findall(text))
        if n:
            text = pat.sub(new, text)
            hits[old] = n
    total = sum(hits.values())
    print("  %-14s %3d replacements  %s" % (label, total,
          ", ".join("%s x%d" % (k, v) for k, v in sorted(hits.items(), key=lambda x: -x[1])[:8])))
    return text, total


# Context-specific fixes that a flat colour map cannot express.
CONTEXT_FIXES = [
    # The category band becomes brand green. White icon strokes are graphics (3.06 >= 3.0) and
    # pass, but the labels were 17px -- under the 18.66px bold threshold for LARGE text, where
    # 3.06 is allowed. Bump to 19px bold so the label is formally large text.
    ("#imski .tol-cat-label{\n  font-size:17px;", "#imski .tol-cat-label{\n  font-size:19px;"),
    # A green pill on a green band has no separation. The View-all becomes the brand secondary
    # with white text (13.78) -- the guide's own dark-on-green pairing.
    ("background:#26a94b; color:#1e3032;\n  font-size:16px; font-weight:700; line-height:1.2;\n"
     "  text-decoration:none; text-shadow:none; border-radius:999px; border:0;\n"
     "  transition:background .15s ease;\n}\n#imski .tol-cat-viewall:hover",
     "background:#1e3032; color:#ffffff;\n  font-size:16px; font-weight:700; line-height:1.2;\n"
     "  text-decoration:none; text-shadow:none; border-radius:999px; border:0;\n"
     "  transition:background .15s ease;\n}\n#imski .tol-cat-viewall:hover"),
    ("#imski .tol-cat-viewall:focus-visible{background:#28b350; color:#1e3032}",
     "#imski .tol-cat-viewall:focus-visible{background:#223638; color:#ffffff}"),
]


BRAND_FIXES = """
<style id="tol-brand-fixes">
/* Two contrast corrections found by sweeping the recoloured page, not predicted on paper.

   1. The hero copy sits on dark media. #1e873c is the green tuned for WHITE grounds (4.58 there)
      and measures only 3.01 against the dark hero, so the charity link uses the brand primary,
      which is 4.50 on #1e3032. Same green family, correct direction.
   2. The footer copyright band inherited the old #5a9642 green and so became #1e873c, leaving its
      light grey type at 3.70. The band returns to the brand secondary, where that type clears
      comfortably and the footer reads as one dark block. */
#iuy2 a, #inbmi a, #iuf2 .sgb-component-text a{ color:#26a94b !important; }
footer#masterfoot section#copyrightinfo.copyright{ background-color:#1e3032 !important; }
</style>
"""


def main():
    check = "--check" in sys.argv
    files = [("chrome.css", os.path.join(REPO, "chrome.css")),
             ("index.html", os.path.join(REPO, "index.html"))]
    print("Applying TOL 2026 brand palette")
    print("  primary %s  secondary %s  tertiary %s" % (PRIMARY, SECONDARY, TERTIARY))
    print("  derived: green-text %s  hover %s  tint %s" % (GREEN_TXT, PRIM_HOV, TINT))
    grand = 0
    for label, path in files:
        src = io.open(path, encoding="utf-8", errors="replace").read()
        out, n = recolour(src, label)
        grand += n
        if label == "index.html":
            applied = 0
            for old, new in CONTEXT_FIXES:
                if old in out:
                    out = out.replace(old, new, 1)
                    applied += 1
            print("  %-14s %3d context fixes of %d" % ("", applied, len(CONTEXT_FIXES)))
        if label == "index.html" and 'id="tol-brand-fixes"' not in out:
            out = out.replace("</body>", BRAND_FIXES + "</body>", 1)
            print("  %-14s appended tol-brand-fixes" % "")
        if not check:
            if not os.path.exists(path + ".prebrand"):
                shutil.copy2(path, path + ".prebrand")
            io.open(path, "w", encoding="utf-8").write(out)
    print("  TOTAL %d replacements%s" % (grand, " (dry run)" if check else ""))


if __name__ == "__main__":
    main()
