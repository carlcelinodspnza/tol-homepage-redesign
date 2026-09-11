# Tree of Life homepage restructure — verification results
Run: 2026-09-10. Baseline = /project (untouched clone). Redesign = /redesign (restructured).
Served each from its OWN root (the bundle uses absolute /sites/... paths).

## Fold gate — "make the hero thinner so the next section peeks"
Metric: peek = innerHeight - nextSectionTop at scroll 0.
Pass = nextTop/innerHeight <= 0.85 AND hero >= 60vh.

| Viewport   | Baseline peek | Redesign peek | Hero px | H1 px | Ratio | Pass |
|------------|---------------|---------------|---------|-------|-------|------|
| 1440 x 900 | 0             | 198           | 702     | 80    | 0.78  | YES  |
| 1024 x 768 | 0             | 169           | 599     | 46    | 0.78  | YES  |
| 768 x 1024 | 0             | 225           | 799     | 46    | 0.78  | YES  |
| 375 x 812  | 0             | 211           | 601     | 34    | 0.74  | YES  |

The tablet/mobile bands needed the H1 type ramp tightened, NOT just min-height.
min-height is a floor and cannot cap content: at 1024x768 the hero measured 715px
against a 599px floor (H1 was 360px = 5 lines at 60px/72px). Reducing the H1 to 46px
took it to 157px and the hero to exactly its floor. Same cause and fix at 375.

## Structure
- .sgbuilder-wrapper children: 9, order = HERO, i9szc, imski, i5qeg, ialb8, ir16v, iujbg, i0m8q, i3kl4
- Charity (i5qeg) now sits ABOVE Brands (ialb8). This was the only true swap required.
- All 9 stable ids present exactly once, before and after.

## Deals
- 16 gallery items -> 6. Unique images kept: Deal_1,2,3,4,6,7 (Deal_5 does not exist upstream).
- Carousel config left UNTOUCHED. An earlier attempt set slidesPerView/loop and produced a
  duplicated first slide at runtime; reverted. The 11 DOM slides seen at runtime are Swiper
  loop clones of the 6 real ones, which is the site own behaviour.
- "View all deals" CTA added in the site own grammar (sgb-component-cta > a.btn),
  pointing at menu.lasvegas.treeoflifenv.com/menu/specials (always current) rather than
  the stale /deals page. 4 legacy /deals links re-pointed to match.
- CTA tap target 152x44 (meets the 44px floor). Contrast 11.97:1 (needs 4.5).

## Video hero
- Injected and PLAYING at every viewport. readyState 4, 1920x1080, hero-30s.webm.
- NOTE: the clone stores JS-disabled HTML, so the <video> is absent from the file and only
  exists after plugins.min.js + main.min.js run. Both were captured. The bundle MUST be
  served over HTTP from its own root; over file:// or a parent root the video 404s.

## Defects found — PRE-EXISTING, not caused by this work
1. Brands section (#ialb8): 10 of 10 images broken, baseline and redesign alike. Their
   data-src points at lasvegas.treeoflife.seogstage.com, which serves an invalid TLS cert.
   The section renders as empty boxes. Brands is item 5 on the client list.
2. Five dead CSS backgrounds from the same host: banner_bg (hero), Group_1000001852 (brands),
   Group_47 (rewards), Frame_11 (reviews), Group_1000001854 (faq). 5 console errors at 1440.
3. "Shop Our Daily Deals" heading is rgb(255,255,255) on rgb(255,255,255) -> contrast 1.00
   against a required 3.0. It is legible only via a 4-way 1px black text-shadow faking an
   outline. Identical in the baseline, so pre-existing - BUT the restructure promotes this
   section above the fold, so it now matters much more. Recommend a real colour fix.
4. /deals serves an April 2026 calendar and a WEEKLY calendar for 07/19-07/25 - seven weeks stale.
5. Hero video <source> is typed video/mp4 for a .webm file. Browsers sniff past it; still wrong.

## Not built here (blocked)
- Shop-by-category icon tiles: needs a menu slug for "vape carts", which appears nowhere on
  the site. Cloudflare 403s a driven browser even on the known-good /menu/flower, so this is
  bot detection, not a missing slug - it needs a human browser session or the client.
- App section: needs the client assets (1-2 weeks out).
- Orphaned Rewards (ir16v) and Contact CTA (i3kl4) LEFT IN PLACE pending a client decision.
  Together they are 1,516px, about 25 percent of the page. Omission from a list is not an
  instruction to delete.

## Reproduce
  node scripts/clone-stage-1-extract.mjs https://lasvegastreeoflifenv.staging.sgen.com/
  node scripts/clone-stage-3-emit.mjs <stage1-dir> --shape sp
  node restructure.mjs <bundle>/redesign/index.html
  serve <bundle>/project on one port and <bundle>/redesign on another, each from its own root


---

# UPDATE — all five blockers resolved without client input

The client could not supply the vape URL, the orphan decision, the featured-deal picks, the app
assets, or an SGB feasibility answer. Each was worked around rather than waited on.

| Blocker | Resolution |
|---|---|
| Vape carts URL | The June crawl in seo.db proves only edible/extract/flower/pre-roll/specials were EVER linked. The menu host 403s automation (even known-good /menu/flower), so it is bot detection, not a missing slug. Tile 3 points at /menu (the full menu, verified to exist) and carries data-tol-tbd="vape-category-slug-unverified". Cannot 404; one-line swap later. |
| Rewards + Contact CTA | Not decided. Both LEFT IN PLACE by default, with ?orphans=drop hiding them. The client picks by looking. Verified: with drop, the visible order is exactly the eight sections they specified. |
| Which six deals | Script parameter: restructure.mjs <file> featured=Deal_1,Deal_3,... Default keeps the first six unique. |
| App assets | Section ships COMPLETE with a designed fallback - phone silhouette at the exact 640x1280 ratio, both real store badges greyed and non-clickable, and a deletable "Coming soon" component. Swap = replace files at fixed paths. |
| SGB feasibility | Sidestepped. Icon tiles reuse the EXISTING sgb-component-card DOM verbatim (.inner.style_1 > a.p + .thumbnail + .info) with the <img> swapped for an inline <svg>. If SGB renders today's cards, it renders these. Only CSS differs. |

## What the visual read caught that no assertion did

Every numeric gate was green while the tiles were visibly broken. In sequence:
1. Titles rendered ROTATED 90 degrees - style_1 applies transform: matrix(0,-1,1,0,0,0).
2. Titles CLIPPED to "lower" / "re-rolls" - .title inherits width:380px at left:-35px, geometry
   meant for the rotated layout, inside a 151px .inner.
3. Buttons CUT OFF - .inner is fixed 151x400 and the card is overflow:hidden.
4. Two "Flower" tiles side by side - Swiper loop cloning with 5 items in 5 slots.
5. An inherited arrow glyph in .title forced two-line wraps on the longer labels.
6. My authored h2 inherited the site's white-on-white heading style.
All six fixed. The lesson: green numbers are not a rendered page.

## Contrast — everything authored here now passes

| Element | Ratio | Needs | Pass |
|---|---|---|---|
| App heading | 12.89 | 3.0 | yes |
| App offer line | 5.38 | 4.5 | yes (brand #5a9642 measured 3.57 on white; darkened to #47762f) |
| Coming-soon notice | 12.89 | 4.5 | yes |
| Category title | 3.57 | 3.0 | yes (large text) |
| View-all CTA | 11.97 | 4.5 | yes |
| Category CTA | 11.97 | 4.5 | yes |

## Final state, verified at 1440x900 and 375x812

- Fold peek 198px desktop / 211px mobile, from a baseline of 0. Ratios 0.78 / 0.74.
- 5 category tiles, correct order, no clipping, every tap target 44px tall.
- 6 unique featured deals + View-all CTA.
- App section present with all slots.
- Video playing. No horizontal overflow at any tested width.
- Charity above Brands.

## Still genuinely outstanding (needs a human, not a workaround)

- The real vape category slug, to replace /menu on tile 3.
- The client's actual choice on Rewards and the Contact CTA.
- Real app assets.
- The five dead seogstage.com background images and the ten broken Brands images - a platform
  fix, unchanged by any of this.
- "Shop Our Daily Deals" and "Shop By Category" headings are still white-on-white (contrast 1.00),
  legible only via a fake text-shadow. PRE-EXISTING site style. I fixed it only on content I
  authored; changing the site's global heading style is a design decision, not a bug fix.


---

# UPDATE 2 — real product photography restored + tile centring fixed

## Images: 4 of 5 are the client's OWN photos, not generated

The staging tiles' images were already in the clone. Recovered and reinstated:

| Tile | File | Source | Natural size |
|---|---|---|---|
| Flower | Group_75.webp | REAL - client's own | 231x357 |
| Pre-rolls | Pre_Rolls_1.webp | REAL - client's own | 575x549 |
| Vape carts | vape_cart.png | GENERATED (fal flux/dev + rembg) | 1024x1024 |
| Extracts | concentrate_1.webp | REAL - client's own | 327x343 |
| Edibles | edibles.webp | REAL - client's own | 434x271 |

All four real files are transparent WebP (VP8X container with an ALPH chunk), so they sit directly
on the card green with no plate behind them.

Only the vape cart was generated, and only after proving no real one exists: the entire June crawl
of all three treeoflifenv sites yields 54 distinct image filenames and NOT ONE is a vape/cart
product shot. The only vape images in seo.db belong to other clients (cookies.co, nuleafnv). The
menu host that would carry one 403s automation.

Generation was two steps: fal-ai/flux/dev produced two candidates, and the cleaner one (no
hallucinated logos - the first had garbled fake branding) went through fal-ai/imageutils/rembg to
cut the background out. Result is a 1024x1024 RGBA PNG with a real alpha channel.

Every generated image carries data-tol-generated="true" in the markup so it can be found and
swapped the moment the client supplies a real vape photo. The four real ones carry "false".

## Centring: the tiles were 38px right of centre

Measured cause, not guessed: the inherited style_1 puts roughly 100px of padding on the CARD's
left against ~25px on its right - a gutter for the rotated title - so .inner rendered 103px wide
starting at x=100 inside a 228px card. Everything centred correctly WITHIN .inner; .inner itself
was displaced. Fixed by zeroing the card padding and letting .inner fill.

Verified: thumbnail, title and button all now measure an offset of 0 from card centre, at both
1440x900 and 375x812, across all five tiles.

## Rebuild

  bash _tooling/rebuild.sh

Idempotent. Copies the pristine clone, injects the generated vape asset, applies the transform.
The baseline in project/ is deliberately kept free of the generated asset so it stays a byte-exact
clone of staging.

## Re-verified after the change

- Fold peek 211px at 375x812; ratio gates still pass.
- All 5 tile images load; zero icon fallbacks remain.
- Button offsets [0,0,0,0,0]; tap targets 140-169 x 44.
- No horizontal overflow. Hero video playing (readyState 4).


---

# UPDATE 3 - full polish pass (every item from the review)

| Request | Done | Evidence |
|---|---|---|
| Show/play the hero video | YES | video fills hero exactly, object-fit cover, readyState 4, playing |
| Charity blurb + button to full page | ALREADY DONE | #i5qeg above brands; LEARN MORE -> /charitable-efforts, 151x43 |
| Are the reviews hidden? | FIXED - they were never hidden | 6 cards now render real quotes + names |
| Deals edge padding + align upper/lower | FIXED | all four rails clip at 35/35 |
| Section headings hard to read | FIXED | dark green on light, white on dark/green, no outlines |
| Charity image bigger, rounded, aligned; text right | FIXED | img left=35, radius 20px, shadow, copy padded 34px |
| Brand cards need drop shadows | FIXED | brand-card + .thumb elevated |
| App section: divider, phone bg right, white gradient | FIXED | generated phone bg, feathered, gradient left-to-centre |
| Reviews boxes align to categories | FIXED | reviews rail clips at 35/35, loop disabled |
| FAQ subtle background on the right | FIXED | generated botanical line-art, masked to the right |
| CTA text readable | FIXED | 0 contrast failures in that section |

## Root causes worth keeping

1. HERO VIDEO. It was never missing - it was parked off-screen. The platform centres it with
   left/top:50% + translate(-50%,-50%); inset:0 does NOT cancel a transform, so the frame sat at
   -720,-351 and only its bottom-right quadrant overlapped the hero. The rest was the wrapper's
   black background. Fix: zero the offsets AND the transform, clear the wrapper background, and
   remove the dead seogstage.com background image behind it.
2. RAIL GUTTERS. Padding does not create a gutter on a Swiper - overflow:hidden clips at the
   BORDER box, so slides translate straight through the padding and get sliced at the viewport
   edge. Narrowing each rail with width+margin makes the clip land on the 35px line.
3. REVIEWS. The quotes were always in the DOM. The platform forces every slide child to
   height:100%; combined with a shrinkable flex child this collapsed .content to 0px.
   flex:0 0 auto lets it size to its own text.
4. A CLEVER FIX THAT BACKFIRED. An adaptive "recolour anything failing contrast" script was
   tried and REMOVED: its ancestor background walk resolved dark at load time, so it stamped
   inline color:#fff !important over headings the stylesheet had already set correctly, taking
   failures from 8 up to 39. Deterministic per-section enumeration replaced it.

## Contrast

Zero failures at 1440x900 AND 375x812, measured against the actually-painted background with
the WCAG large-text rule applied. Two grounds were darkened one step to #47762f (same hue) so
white type clears 4.5 rather than sitting at 3.57: the FAQ section and the category tiles.

## Generated assets (all in _tooling/assets, injected by rebuild.sh)

- vape_cart.png      - the one product photo with no real counterpart anywhere on the site
- app_phone_bg.png   - app section background
- faq_leaves_bg.png  - FAQ botanical background

Everything else is the client's own photography.


---

# UPDATE 4 - final three

| Request | Fix | Verified |
|---|---|---|
| Curve the category tile corners | border-radius 20px + overflow hidden on card and inner | computed 20px / hidden |
| Rove logo showing as a plain white box | MY REGRESSION: I had set .thumb background to #fff, and the Rove logo is a WHITE wordmark, so it vanished. Plate changed to #121315 to match the brand card. | thumb bg rgb(18,19,21); ROVE + GREENLIFE both legible |
| Review vertical line bumping the arrow | ALSO MY REGRESSION: the platform used padding 25px 25px 25px 50px to clear the accent rule and the prev arrow; my 26px-all-round pulled it left. Restored to 26px 26px 26px 54px. | content starts 74px clear of the arrow |

Note: the brand images were never broken in the clone - they resolve from local in-pages files via
srcset even though the src attribute still points at the dead seogstage host. The only problem was
the white plate I had introduced.


---

# UPDATE 5

- App band image: swapped the bare phone mockup for a generated MODERN MINIMALIST LIFESTYLE shot
  (app_lifestyle_bg.png - person with a phone, bright airy interior, green plant accent). The band
  now uses left:40% + background-size:cover so the image fills the whole right half edge to edge
  instead of floating with dead white margin. The white wash was rebuilt with 11 gradient stops
  (30% -> 100%) so it reads as a genuinely gradual fade rather than a visible edge.
  The old app_phone_bg.png was deleted; rebuild.sh updated.
- Closing CTA link "CALL (702) 536-4200 FOR MORE INFO!": underline removed, weight 700.
  Verified text-decoration-line: none, font-weight: 700.


---

# UPDATE 4 — deals rail rebuilt as image-led cards, and two earlier claims corrected

## Two things this document got wrong

**1. The duplicated first slide was NOT "Swiper loop clones".** Lines above state "The 11 DOM
slides seen at runtime are Swiper loop clones of the 6 real ones, which is the site own behaviour."
Both halves are false, and it matters, because it frames the rail as untouchable.

Read from `assets/front/js/plugins.min.js` and reproduced on demand: `window.SGPlugins.sgCarousel`
runs a **custom pre-init DOM padding shim** immediately before `new Swiper()`. If loop is truthy at
the root **or in any breakpoint** (the check is an OR-scan), it appends **real** cloned nodes marked
`data-sg-loop-clone="1"` until the wrapper holds `2 * maxSlidesPerView + 1` children. Swiper 11
loops by rearranging real elements and contributed **0** `.swiper-slide-duplicate` nodes.

    SAFE-LOOP RULE:  2 * maxSlidesPerView + 1  <=  realSlideCount

Measured with the 6 real deals: spv2 needs 5 -> no padding, 0 duplicate frames (safe); spv3 needs 7
-> 1 clone, 2 broken frames; spv4 needs 9 -> 3 clones, 3 broken frames. Clearing `loop` on the root
alone is not enough — one leftover `loop:true` in a single breakpoint re-arms padding at every width.

**2. The deals heading is no longer white-on-white.** The "Still genuinely outstanding" section says
"Shop Our Daily Deals" and "Shop By Category" are "still white-on-white (contrast 1.00)". Measured
live, that is false for the deals section: `h2#iykyh` computes `rgb(33,54,44)` with `text-shadow:
none` — the tol-polish block already fixed it. The claim was NOT re-measured for `#imski`, so treat
that half as unverified rather than true.

## What changed in the deals rail

Rebuilt to match an owner-supplied reference: a 2:1 artwork panel above a white 24px-padded footer
carrying a magenta category label and a bold title, on a white card with a 1px `#e4e4e4` hairline,
24px radius and no shadow. No per-card button — the whole card is the link. The carousel controls
moved out of the rail into the section header row, beside a "View all deals" link.

`_tooling/make-deal-tiles.py` generates `Deal_N_wide.webp`. Each source `Deal_N.webp` bakes the
entire card into one flat image; profiled identically on all six: "DAILY DEAL" y45-64, divider
y103-108, offer y133-399, "Shop Now" pill x123-298 / y413-462. The script keeps only the offer block
and re-canvases it onto a 2:1 tile, padding with the artwork's own flat `rgb(174,208,53)`. Cropping
the portrait source with `object-fit:cover` would have removed 57% of its height and lost the price
(cover scale 0.757 on 425x498 into the measured 321.8x160.9 box leaves 42.7% visible).
Scale is uniform across all six so the set still reads as one rail. 425px is the largest source
anywhere in the repo, so the tiles are LANCZOS-upscaled — acceptable only because the artwork is
flat hard-edged typography.

**One CSS line is load-bearing.** `chrome.css` sets `height:100%` on every direct child of a slide.
It is dormant while the rail is `align-items:center` and arms the moment it stretches for
equal-height cards: the `<a>` takes the full card height and the footer is pushed below the card,
where the `overflow:hidden` added for the radius deletes it silently. `#i9szc .gallery-item > *
{height:auto !important}` prevents that. Do not remove it as redundant.

**Deliberate behaviour changes.** `autoplay:false` and `rewind:false` — both are required for the
reference's greyed-out prev arrow, because `rewind:true` never lets Swiper disable the nav buttons.
The below-rail "View all deals" pill moved into the header row. The h2 and subtitle are unchanged.

## Footer copy: what is derived and what is still a gap

Four labels are derived word-for-word from the artwork: Deal_1 and Deal_2 "Pre-Rolls", Deal_4
"Rosin", Deal_6 "Ounces". Two are NOT, and ship the artwork's own printed "Daily Deal" with a
`data-tol-tbd` marker rather than an invented product category:

- **Deal_3** prints three price tiers and **no product word anywhere** on the card.
- **Deal_7**'s only candidate word sits inside "SIP, JUST EDIBLES, DRINK LOUD", occupying the slot
  that reads "SELECT BRANDS" on all five sibling cards — so "Edibles" may be half a brand name, not
  a category. Labelling it as a category could misdescribe a regulated product.

No card in the set contains the word "flower"; "Premium Ounces" states a weight, not a product type.
Generic `alt="Deal N"` was replaced with a real description on all six.

Still needed from the client: what product Deal_3 is; whether Deal_7's band is three brand names or
a slogan; whether Deal_6's $129 is per ounce or a bundle; and six per-offer URLs (all six cards
currently share one href).

## Verified at 1440 / 768 / 375

Card 323.8x282.9 against the reference's 321.25x282.7. Image ratio exactly 2.0 with object-fit cover.
All 6 footers full-bleed, card heights equal, image-top spread 0. Contrast 5.99 (label) and 19.44
(title) against white. Nav targets 44x44. 6 DOM slides and 0 clones at every width, 0 duplicate
frames across a full cycle, all six deals reachable. No horizontal overflow. No new console errors —
the remaining ones are the pre-existing seogstage TLS failures and the cart CORS block, both of
which reproduce identically on the original deployment.
