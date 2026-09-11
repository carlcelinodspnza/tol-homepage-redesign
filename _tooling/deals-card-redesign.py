#!/usr/bin/env python3
"""
Rebuild the #i9szc featured-deals rail as image-led cards with a white text footer.

Run AFTER _tooling/make-deal-tiles.py (it consumes Deal_N_wide.webp).
Idempotent: re-running detects the marker and re-applies from scratch is not needed.

What it changes
---------------
1. Each gallery item: portrait Deal_N.webp -> landscape Deal_N_wide.webp (2:1), real alt text
   replacing the generic "Deal N", and a footer (category label + title) added INSIDE the <a>
   so the whole card is the link surface, as in the target.
2. data-carousel-options: 4-up, loop FALSE at root AND in every breakpoint, centeredSlides
   false, spaceBetween 25, rewind true. Also --items-per-slide:4.
3. A header row: the existing h2/subtitle on the left, chevrons + "View all deals" on the right.
4. A CSS block (id="tol-deals-cards") + a small nav-forwarding script.

The two non-negotiables, both learned the hard way in this repo
---------------------------------------------------------------
* loop MUST be false in EVERY breakpoint. plugins.min.js runs a pre-init DOM padding shim that
  appends real [data-sg-loop-clone] slides until the count reaches 2*maxSlidesPerView+1. Its
  _loopOn check is an OR-scan across all breakpoints, so ONE leftover loop:true re-arms padding
  at every width. With 6 real deals, 4-up needs 9 -> 3 clones -> visibly duplicated cards.
  Safe-loop rule: 2*maxSlidesPerView + 1 <= realSlideCount.
* `#i9szc .gallery-item > *{height:auto !important}` is LOAD-BEARING, not redundant. chrome.css
  has `.sgen--blocks_carousel .swiper-wrapper>.swiper-slide>*{height:100%}`. It is dormant while
  the rail is align-items:center, and ARMS the moment we set align-items:stretch for equal-height
  cards -- the <a> then swells to the full card height and pushes the footer below the card, where
  the overflow:hidden we add for rounded corners deletes it silently. Same mechanism that cut the
  category rail's buttons off. Do not "clean up" that line.

Content honesty
---------------
Four cards carry a printed product descriptor, so their label is derived word-for-word from the
artwork. Deal_3 prints NO product word at all, and Deal_7's only candidate ("EDIBLES") sits in the
slot that holds "SELECT BRANDS" on every sibling card, so it may be half a brand name. Labelling
either would be an invented product claim on a licensed dispensary's public page, so both fall back
to the artwork's own printed words and are tagged data-tol-tbd for the client to resolve.
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
INDEX = os.path.join(REPO, "index.html")

# label/title/alt. 'gap' marks a card whose product category is NOT derivable from the artwork.
DEALS = {
    "Deal_1": dict(
        cat="Pre-Rolls",
        title="5 for $30 &middot; 10 for $50 &mdash; select 1g pre-rolls",
        alt="Daily Deal: select brands - 5 for $30 or 10 for $50 on select 1g pre-rolls",
        gap=None),
    "Deal_2": dict(
        cat="Pre-Rolls",
        title="4 for $45 &mdash; select pre-rolls",
        alt="Daily Deal: select brands - 4 for $45 on select pre-rolls",
        gap=None),
    "Deal_3": dict(
        cat="Daily Deal",
        title="1 for $20 &middot; 3 for $55 &middot; 4 for $70",
        alt="Daily Deal: 1 for $20, 3 for $55, 4 for $70",
        gap="category-not-on-artwork"),
    "Deal_4": dict(
        cat="Rosin",
        title="2 for $80 &mdash; select 1g rosin",
        alt="Daily Deal: select brands - 2 for $80 on select 1g rosin",
        gap=None),
    "Deal_6": dict(
        cat="Ounces",
        title="Premium ounces &mdash; $129",
        alt="Daily Deal: select brands - premium ounces $129",
        gap=None),
    "Deal_7": dict(
        cat="Daily Deal",
        title="3 for $24 &mdash; Sip, Just Edibles, Drink Loud",
        alt="Daily Deal: Sip, Just Edibles, Drink Loud - 3 for $24",
        gap="brand-vs-category-ambiguous"),
}

CAROUSEL = {
    "slidesPerView": 4, "navigation": True, "pagination": False,
    "loop": False, "rewind": True, "speed": 500, "spaceBetween": 25,
    "centeredSlides": False, "watchOverflow": True,
    "autoplay": {"delay": 5000, "disableOnInteraction": False, "pauseOnMouseEnter": True},
    "breakpoints": {
        "0":    {"slidesPerView": 1, "spaceBetween": 14, "navigation": True, "pagination": False, "loop": False, "centeredSlides": False},
        "576":  {"slidesPerView": 2, "spaceBetween": 16, "navigation": True, "pagination": False, "loop": False, "centeredSlides": False},
        "768":  {"slidesPerView": 3, "spaceBetween": 20, "navigation": True, "pagination": False, "loop": False, "centeredSlides": False},
        "992":  {"slidesPerView": 3, "spaceBetween": 25, "navigation": True, "pagination": False, "loop": False, "centeredSlides": False},
        "1200": {"slidesPerView": 4, "spaceBetween": 25, "navigation": True, "pagination": False, "loop": False, "centeredSlides": False},
    },
}

PLACEHOLDER = ('data:image/svg+xml;base64,'
               'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3NjAiIGhlaWdodD0iMzgwIj48L3N2Zz4=')

CSS = """
<style id="tol-deals-cards">
/* ============================================================================
   DEALS RAIL -> image-led card with a white text footer.
   Tokens measured off the target rail: card radius 24, 1px #e4e4e4 hairline, NO shadow,
   2:1 image, 24px footer padding, 16px/24px label + title, label #b42285, title #000.
   ========================================================================= */

/* -- header row: heading left, chevrons + view-all right ------------------ */
#i9szc #izvej{
  display:flex; align-items:flex-end; justify-content:space-between; gap:24px;
  width:calc(100% - 70px); margin:0 35px 22px;
}
#i9szc .tol-deals-head-l{min-width:0}
#i9szc .tol-deals-nav{display:flex; align-items:center; gap:18px; flex:0 0 auto; padding-bottom:4px}
#i9szc .tol-deals-nav button[data-tol-nav]{
  width:26px; height:26px; padding:0; margin:0; border:0; background:none;
  cursor:pointer; color:#213c2c; display:inline-flex; align-items:center; justify-content:center;
  transition:color .15s ease;
}
#i9szc .tol-deals-nav button[data-tol-nav]::before{
  content:""; width:11px; height:11px;
  border-right:2px solid currentColor; border-bottom:2px solid currentColor;
}
#i9szc .tol-deals-nav button[data-tol-nav="prev"]::before{transform:rotate(135deg); margin-left:4px}
#i9szc .tol-deals-nav button[data-tol-nav="next"]::before{transform:rotate(-45deg); margin-right:4px}
#i9szc .tol-deals-nav button[aria-disabled="true"]{color:#9aa79f; cursor:default}
#i9szc .tol-deals-nav .tol-deals-viewall-link{
  font-size:16px; font-weight:500; line-height:1.4; color:#213c2c; text-decoration:none;
  text-shadow:none; white-space:nowrap;
  background-image:repeating-linear-gradient(to right, currentColor 0 2px, transparent 2px 4px);
  background-size:100% 1px; background-repeat:repeat-x; background-position:0 100%;
  padding-bottom:5px;
}
/* the shim appends its own controls inside the rail; we drive them from the header instead */
#i9szc .gallery-items .swiper-controls{display:none !important}

/* -- rail + card ---------------------------------------------------------- */
#i9szc .gallery-items .swiper-wrapper{align-items:stretch !important}
#i9szc .gallery-item{
  align-items:stretch !important;      /* card is a COLUMN flex box: this is the H axis */
  justify-content:flex-start !important;
  padding:0 !important;                /* chrome.css .swiper-slide{padding:5px} */
  overflow:hidden !important;          /* computed overflow is visible; radius won't clip without it */
  border-radius:24px;
  background:#fff;
  border:1px solid #e4e4e4;
  box-shadow:none;
}
/* LOAD-BEARING. chrome.css sets `.swiper-wrapper>.swiper-slide>*{height:100%}`. Dormant under
   align-items:center; arms the moment we stretch. Without this the <a> takes the full card height
   and the footer is pushed out of the card and silently clipped by the overflow:hidden above.
   Exact precedent: the reviews counter-rule in tol-polish. DO NOT REMOVE. */
#i9szc .gallery-item > *{height:auto !important}

#i9szc .tol-deal-link{
  display:flex; flex-direction:column; width:100%; height:100%;
  text-decoration:none; color:inherit;
}
#i9szc .gallery-item .thumb{display:block; width:100%; overflow:hidden; line-height:0}
#i9szc .gallery-item .thumb img{
  aspect-ratio:2/1 !important;         /* beats the inline aspect-ratio:425/498 */
  object-fit:cover !important;         /* computed object-fit is fill -> would squash */
  width:100% !important; height:auto !important;
  display:block; border-radius:0; max-width:100%;
}

/* -- footer --------------------------------------------------------------- */
#i9szc .tol-deal-foot{
  display:flex; flex-direction:column; gap:0;
  padding:24px; background:#fff; flex:1 1 auto;
}
#i9szc .tol-deal-cat{
  font-size:16px; line-height:24px; font-weight:400; color:#b42285;
  text-shadow:none !important; letter-spacing:0; text-transform:none;
}
#i9szc .tol-deal-ttl{
  font-size:16px; line-height:24px; font-weight:700; color:#0d0d0d;
  text-shadow:none !important; letter-spacing:0;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
  overflow:hidden; min-height:48px;
}

@media (max-width:767px){
  #i9szc #izvej{width:calc(100% - 40px); margin:0 20px 18px; flex-wrap:wrap; gap:12px}
  #i9szc .tol-deal-foot{padding:18px}
}
</style>
"""

SCRIPT = """
<script id="tol-deals-nav-js">
/* Forward the header chevrons to the rail's own (hidden) Swiper controls, and mirror their
   disabled state. Driving Swiper's buttons rather than the instance keeps this working even if
   the shim re-inits on resize. */
(function(){
  var rail = document.getElementById('gallery-items-izxi4');
  var wrap = document.querySelector('#i9szc .tol-deals-nav');
  if(!rail || !wrap) return;
  function target(kind){
    return rail.querySelector(kind === 'prev' ? '.swiper-button-prev' : '.swiper-button-next');
  }
  wrap.querySelectorAll('[data-tol-nav]').forEach(function(b){
    b.addEventListener('click', function(){
      var t = target(b.getAttribute('data-tol-nav'));
      if(t) t.click();
    });
  });
  function sync(){
    wrap.querySelectorAll('[data-tol-nav]').forEach(function(b){
      var t = target(b.getAttribute('data-tol-nav'));
      var off = !t || t.classList.contains('swiper-button-disabled');
      b.setAttribute('aria-disabled', off ? 'true' : 'false');
    });
  }
  var tries = 0;
  var iv = setInterval(function(){
    if(rail.swiper){
      clearInterval(iv); sync();
      rail.swiper.on('slideChange', sync);
      rail.swiper.on('resize', sync);
      rail.swiper.on('update', sync);
    } else if(++tries > 100){ clearInterval(iv); }
  }, 100);
})();
</script>
"""


def build_footer(key):
    d = DEALS[key]
    gap = ' data-tol-tbd="%s"' % d["gap"] if d["gap"] else ""
    return ('<div class="tol-deal-foot"%s>'
            '<span class="tol-deal-cat">%s</span>'
            '<span class="tol-deal-ttl">%s</span>'
            '</div>') % (gap, d["cat"], d["title"])


def main():
    src = io.open(INDEX, encoding="utf-8").read()
    orig = src

    if 'id="tol-deals-cards"' in src:
        sys.exit("already applied (tol-deals-cards present) - revert index.html first")

    # ---- 1. per-card: swap asset, fix alt, add footer inside the <a> -------------
    changed = []
    for key in DEALS:
        d = DEALS[key]
        # the <a ...> ... </a> for this deal
        pat = re.compile(
            r'(<a [^>]*?>)(<div class="thumb"><img [^>]*?data-src="assets/in-pages/'
            + re.escape(key) + r'\.webp"[^>]*?></div>)(</a>)')
        m = pat.search(src)
        if not m:
            sys.exit("could not locate card markup for " + key)
        a_open, thumb, a_close = m.group(1), m.group(2), m.group(3)

        img = thumb
        img = img.replace('data-src="assets/in-pages/%s.webp"' % key,
                          'data-src="assets/in-pages/%s_wide.webp"' % key)
        img = re.sub(r'\ssrcset="[^"]*"', '', img)          # portrait variants no longer apply
        img = re.sub(r'\ssizes="[^"]*"', '', img)
        img = re.sub(r'\sdata-img-fallback="[^"]*"', '', img)
        img = re.sub(r'\sonerror="[^"]*"', '', img)
        img = re.sub(r'src="data:image/svg\+xml;base64,[^"]*"', 'src="%s"' % PLACEHOLDER, img)
        img = re.sub(r'alt="[^"]*"', 'alt="%s"' % d["alt"], img)
        img = re.sub(r'width="\d+"', 'width="760"', img)
        img = re.sub(r'height="\d+"', 'height="380"', img)
        img = re.sub(r'style="aspect-ratio:[^"]*;?"', 'style="aspect-ratio:760/380;"', img)

        a_new = re.sub(r'aria-label="[^"]*"', 'aria-label="%s"' % d["alt"], a_open)
        if 'class=' in a_new:
            a_new = re.sub(r'class="([^"]*)"', r'class="\1 tol-deal-link"', a_new)
        else:
            a_new = a_new[:-1] + ' class="tol-deal-link">'

        src = src[:m.start()] + a_new + img + build_footer(key) + a_close + src[m.end():]
        changed.append(key)

    # ---- 2. carousel config ------------------------------------------------------
    def esc(o):
        return json.dumps(o, separators=(',', ':')).replace('"', '&quot;')
    src, n = re.subn(r'data-carousel-options="[^"]*"',
                     'data-carousel-options="%s"' % esc(CAROUSEL), src, count=1)
    if n != 1:
        sys.exit("carousel options attribute not found")
    src, n2 = re.subn(r'style="--items-per-slide:5"', 'style="--items-per-slide:4"', src, count=1)

    # ---- 3. header row -----------------------------------------------------------
    head_open = '<div data-component-id="maow2fzpnb4df" id="izvej" class="sgb-component sgb-component-div">'
    if head_open not in src:
        sys.exit("heading block #izvej not found")
    nav = ('<div class="tol-deals-nav">'
           '<button type="button" data-tol-nav="prev" aria-label="Previous deals"></button>'
           '<button type="button" data-tol-nav="next" aria-label="Next deals"></button>'
           '<a class="tol-deals-viewall-link" href="https://menu.lasvegas.treeoflifenv.com/menu/specials">View all deals</a>'
           '</div>')
    src = src.replace(head_open, head_open + '<div class="tol-deals-head-l">', 1)
    # close the left wrapper right before the gallery component and append the nav
    gal = '<div data-component-id="maovu0jyvb0c1" id="izxi4"'
    if gal not in src:
        sys.exit("gallery component #izxi4 not found")
    # the heading block's own closing </div> is the one immediately preceding the gallery
    idx = src.find(gal)
    close = src.rfind('</div>', 0, idx)
    src = src[:close] + '</div>' + nav + src[close:]

    # ---- 4. css + script ---------------------------------------------------------
    src = src.replace('</body>', CSS + SCRIPT + '</body>', 1)

    if src == orig:
        sys.exit("no changes produced")
    io.open(INDEX, "w", encoding="utf-8").write(src)
    print("patched %d cards: %s" % (len(changed), ", ".join(changed)))
    print("carousel -> 4-up, loop FALSE at root + all %d breakpoints" % len(CAROUSEL["breakpoints"]))
    print("items-per-slide rewritten: %s" % bool(n2))
    print("GAPS (need the client): " +
          ", ".join("%s=%s" % (k, v["gap"]) for k, v in DEALS.items() if v["gap"]))


if __name__ == "__main__":
    main()
