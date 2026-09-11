#!/usr/bin/env python3
"""
Rebuild #imski ("Shop By Category") as a full-bleed green band of line-art icons.

Replaces the five green photo cards (each with its own "Shop X" button) with a single
coloured band carrying one outline icon per category, a label under each, and one shared
View-all pill beneath -- the layout the owner referenced.

Two deliberate decisions worth keeping:

1. NO CAROUSEL. The old section ran the platform's Swiper cards rail. With five fixed
   categories there is nothing to page, and the rail is the component that carries the
   `2*maxSlidesPerView+1` clone shim plus the `>*{height:100%}` child trap. A plain flex row
   that wraps removes both failure modes outright.

2. The icons are ORIGINAL drawings in the referenced visual language (white ~2px stroke, round
   caps, no fill, loose/organic line), NOT the reference site's own asset files. Matching a
   look is ordinary design practice; shipping a competitor's actual artwork on a client's
   commercial site is not, and these two are competitors in the same market.

Colours are measured from the owner's references, not guessed:
    band  #527539   (the green of the existing category cards)
    pill  #B5D053   (the lime already used by this site's "Shop X" buttons)
    ink   #152111   (the deals pill's text colour)
Contrast: pill-on-band 3.06 (needs 3.0), ink-on-pill 9.63, white-on-band 5.30.
The deals pill green #68954D was rejected here: on this band it measures 1.51:1 and the
button would read as a shape that is barely there.
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
INDEX = os.path.join(REPO, "index.html")

MENU = "https://menu.lasvegas.treeoflifenv.com/menu"

# viewBox 0 0 64 64, stroke set by CSS. Drawn to read at 64px and stay legible at 44px.
ICONS = {
"flower": """
<defs><mask id="tolBud" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect x="0" y="0" width="64" height="64" fill="#fff"/><path d="M39.0 41.5 A7.6 7.6 0 0 1 30.7 50.5 A7.6 7.6 0 0 1 18.5 51.0 A7.6 7.6 0 0 1 9.5 42.7 A7.6 7.6 0 0 1 9.0 30.5 A7.6 7.6 0 0 1 17.3 21.5 A7.6 7.6 0 0 1 29.5 21.0 A7.6 7.6 0 0 1 38.5 29.3 A7.6 7.6 0 0 1 39.0 41.5 Z" fill="#000" stroke="#000" stroke-width="3.4"/></mask></defs><g mask="url(#tolBud)"><path d="M50.2 49.7 A6.2 6.2 0 0 1 40.3 50.9 A6.2 6.2 0 0 1 33.2 43.9 A6.2 6.2 0 0 1 34.2 34.0 A6.2 6.2 0 0 1 42.6 28.6 A6.2 6.2 0 0 1 52.1 31.8 A6.2 6.2 0 0 1 55.4 41.2 A6.2 6.2 0 0 1 50.2 49.7 Z"/></g><path d="M39.0 41.5 A7.6 7.6 0 0 1 30.7 50.5 A7.6 7.6 0 0 1 18.5 51.0 A7.6 7.6 0 0 1 9.5 42.7 A7.6 7.6 0 0 1 9.0 30.5 A7.6 7.6 0 0 1 17.3 21.5 A7.6 7.6 0 0 1 29.5 21.0 A7.6 7.6 0 0 1 38.5 29.3 A7.6 7.6 0 0 1 39.0 41.5 Z"/><path d="M34 21 L49 7 M43 12 q5 -4 10 -3.5 M21 31 v4.5 M18.8 33.2 h4.5 M30 45 v3.6 M28.2 46.8 h3.6 M47 36 v3.2 M45.4 37.6 h3.2"/>
""",
"pre-rolls": """
<path d="M6.5 47.5 L43.5 25.5 a4.4 4.4 0 0 1 4.5 7.6 L11 55.1 a4.4 4.4 0 0 1 -4.5 -7.6 Z M40 27.6 l4.5 7.6 M34.6 30.8 l4.5 7.6 M7.6 47 q-2.4 3.4 0 7 M10.5 28.5 L47.5 6.5 a4.4 4.4 0 0 1 4.5 7.6 L15 36.1 a4.4 4.4 0 0 1 -4.5 -7.6 Z M44 8.6 l4.5 7.6 M38.6 11.8 l4.5 7.6 M11.6 28 q-2.4 3.4 0 7"/>
""",
"vape-carts": """
<path d="M20.5 18 h11 a2 2 0 0 1 2 2 v31 a5.5 5.5 0 0 1 -5.5 5.5 h-4 a5.5 5.5 0 0 1 -5.5 -5.5 v-31 a2 2 0 0 1 2 -2 Z M23 6 h6 a2 2 0 0 1 2 2 v10 h-10 v-10 a2 2 0 0 1 2 -2 Z M19.5 30 h13.5 M19.5 44 h13.5 M41 24 h9.5 a2 2 0 0 1 2 2 v25 a5 5 0 0 1 -5 5 h-3.5 a5 5 0 0 1 -5 -5 v-25 a2 2 0 0 1 2 -2 Z M43 13 h5.5 a2 2 0 0 1 2 2 v9 h-9.5 v-9 a2 2 0 0 1 2 -2 Z M39 34 h13.5"/>
""",
"extracts": """
<path d="M28.5 12 L45.5 18.2 a3.2 3.2 0 0 1 1.9 4.1 L40.6 42 a8.5 8.5 0 0 1 -10.9 5.1 l-6 -2.2 a8.5 8.5 0 0 1 -5.1 -10.9 l7 -19.3 a3.2 3.2 0 0 1 3.5 -2.1 Z M31.2 3.6 L38.5 6.3 a2.3 2.3 0 0 1 1.4 3 l-1.6 4.3 -11.4 -4.2 1.6 -4.3 a2.3 2.3 0 0 1 2.7 -1.5 Z M24.6 25 L42.5 31.5 M8 53 q9 -6.5 19 -4 q8.5 2.1 16.5 .4 q5.5 -1.1 9 -3.9 M13.5 57.5 q9.5 -3.6 19 -.6 q6.4 2 12 .6 M7 47.5 a1.4 1.4 0 1 0 .1 0 Z M55 42.5 a1.4 1.4 0 1 0 .1 0 Z"/>
""",
"edibles": """
<path d="M30.0 25.0 Q23.7 20.0 14.3 21.5 Q22.2 26.9 30.0 25.0 M30.0 25.0 Q26.0 16.7 15.6 13.6 Q21.0 23.0 30.0 25.0 M30.0 25.0 Q30.0 14.6 21.0 6.4 Q21.8 18.6 30.0 25.0 M30.0 25.0 Q35.1 14.7 30.0 2.0 Q24.9 14.7 30.0 25.0 M30.0 25.0 Q38.2 18.6 39.0 6.4 Q30.0 14.6 30.0 25.0 M30.0 25.0 Q39.0 23.0 44.4 13.6 Q34.0 16.7 30.0 25.0 M30.0 25.0 Q37.8 26.9 45.7 21.5 Q36.3 20.0 30.0 25.0 M30 25 v7 M19 37 h21 a2.6 2.6 0 0 1 2.6 2.6 v11 a2.6 2.6 0 0 1 -2.6 2.6 h-21 a2.6 2.6 0 0 1 -2.6 -2.6 v-11 a2.6 2.6 0 0 1 2.6 -2.6 Z M22 37 L26.5 31.6 h21 a2.6 2.6 0 0 1 2.6 2.6 v11 a2.6 2.6 0 0 1 -2.6 2.6 h-4.5 M42.6 37 L47.5 31.6 M23 43.5 h9 M11.5 54 a1.4 1.4 0 1 0 .1 0 Z M8 48.5 a1.2 1.2 0 1 0 .1 0 Z"/>
""",
}

CATS = [
    dict(key="flower",     label="Flower",     href=MENU + "/flower",   tbd=None),
    dict(key="pre-rolls",  label="Pre-rolls",  href=MENU + "/pre-roll", tbd=None),
    dict(key="vape-carts", label="Vape carts", href=MENU,               tbd="vape-category-slug-unverified"),
    dict(key="extracts",   label="Extracts",   href=MENU + "/extract",  tbd=None),
    dict(key="edibles",    label="Edibles",    href=MENU + "/edible",   tbd=None),
]


def icon_svg(key):
    body = " ".join(ICONS[key].split())
    return (f'<svg class="tol-cat-ico" viewBox="0 0 64 64" fill="none" stroke="currentColor" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true" focusable="false">{body}</svg>')


def build_band():
    items = []
    for c in CATS:
        tbd = f' data-tol-tbd="{c["tbd"]}"' if c["tbd"] else ""
        items.append(
            f'<a class="tol-cat-item" href="{c["href"]}"{tbd} aria-label="Shop {c["label"].lower()}">'
            f'{icon_svg(c["key"])}'
            f'<span class="tol-cat-label">{c["label"]}</span></a>')
    return ('<div class="tol-cat-band" data-tol-added="category-icon-band">'
            '<div class="tol-cat-row">' + "".join(items) + '</div>'
            f'<div class="tol-cat-cta"><a class="tol-cat-viewall" href="{MENU}" '
            'aria-label="View all categories">View all</a></div>'
            '</div>')


CSS = """
<style id="tol-cat-band">
/* ============================================================================
   SHOP BY CATEGORY -> full-bleed band of line-art icons (no carousel).
   band #527539 / lime pill #B5D053 / ink #152111, all measured from the references.
   ========================================================================= */
#imski{overflow:hidden}
#imski .tol-cat-band{
  background:#527539;
  /* full-bleed out of the section's own container without causing h-overflow */
  width:100vw; margin-left:calc(50% - 50vw); margin-right:calc(50% - 50vw);
  padding:52px 24px 46px;
}
#imski .tol-cat-row{
  max-width:1180px; margin:0 auto;
  display:flex; align-items:flex-start; justify-content:center;
  gap:18px; flex-wrap:wrap;
}
#imski .tol-cat-item{
  flex:1 1 0; min-width:128px; max-width:210px;
  display:flex; flex-direction:column; align-items:center; gap:16px;
  padding:10px 6px; border-radius:14px;
  text-decoration:none; color:#fff;
  }
/* hover = a wiggle on the icon, not a highlight box. focus-visible still needs a persistent
   indicator, so keyboard focus keeps a ring (an animation is not a focus indicator). */
@keyframes tol-cat-wiggle{
  0%,100%{transform:rotate(0deg)}
  12%{transform:rotate(-10deg)} 28%{transform:rotate(8deg)}
  44%{transform:rotate(-6deg)}  60%{transform:rotate(4deg)}
  76%{transform:rotate(-2deg)}  88%{transform:rotate(1deg)}
}
#imski .tol-cat-item:hover .tol-cat-ico,
#imski .tol-cat-item:focus-visible .tol-cat-ico{
  animation:tol-cat-wiggle .62s ease-in-out both;
  transform-origin:50% 62%;
}
#imski .tol-cat-item:focus-visible{outline:2px solid #fff; outline-offset:3px}
@media (prefers-reduced-motion:reduce){
  #imski .tol-cat-item:hover .tol-cat-ico,
  #imski .tol-cat-item:focus-visible .tol-cat-ico{animation:none}
}
#imski .tol-cat-ico{
  width:88px; height:88px; display:block;
  color:#fff;                      /* stroke is currentColor */
  vector-effect:non-scaling-stroke;
}
#imski .tol-cat-label{
  font-size:17px; font-weight:700; line-height:1.25; color:#fff;
  text-align:center; text-shadow:none !important; letter-spacing:.01em;
}
#imski .tol-cat-cta{text-align:center; margin-top:38px}
#imski .tol-cat-viewall{
  display:inline-flex; align-items:center; justify-content:center;
  min-height:44px; padding:11px 34px;
  background:#b5d053; color:#152111;
  font-size:16px; font-weight:700; line-height:1.2;
  text-decoration:none; text-shadow:none; border-radius:999px; border:0;
  transition:background .15s ease;
}
#imski .tol-cat-viewall:hover,
#imski .tol-cat-viewall:focus-visible{background:#c3dc6b; color:#152111}

@media (max-width:900px){
  #imski .tol-cat-row{gap:10px}
  #imski .tol-cat-ico{width:72px; height:72px}
  #imski .tol-cat-label{font-size:15px}
}
@media (max-width:560px){
  #imski .tol-cat-band{padding:38px 16px 34px}
  #imski .tol-cat-row{gap:8px}
  #imski .tol-cat-item{flex:0 0 calc(33.333% - 8px); min-width:0}
  #imski .tol-cat-ico{width:60px; height:60px}
  #imski .tol-cat-label{font-size:14px}
}
</style>
"""


def main():
    s = io.open(INDEX, encoding="utf-8").read()
    if 'id="tol-cat-band"' in s:
        sys.exit("already applied (tol-cat-band present)")

    start = s.find('id="imski"')
    assert start != -1, "#imski not found"
    start = s.rfind("<", 0, start)
    nxt = s.find('id="i5qeg"')
    assert nxt != -1, "next section #i5qeg not found"
    sec_end = s.rfind("</div>", start, nxt)

    seg = s[start:sec_end]
    # keep the heading block, drop the whole cards component
    cards = re.search(r'<div[^>]*id="i42a7"[^>]*>.*', seg, re.S)
    assert cards, "cards component #i42a7 not found"
    kept = seg[:cards.start()]
    new_seg = kept + build_band()

    s = s[:start] + new_seg + s[sec_end:]
    s = s.replace("</body>", CSS + "</body>", 1)
    io.open(INDEX, "w", encoding="utf-8").write(s)

    print("category band built: %d icons, carousel removed" % len(CATS))
    print("links:", ", ".join(c["label"] for c in CATS))
    print("still flagged:", [c["tbd"] for c in CATS if c["tbd"]])


if __name__ == "__main__":
    main()
