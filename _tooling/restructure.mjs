// Tree of Life homepage restructure — re-runnable transform against a fresh clone.
//
// Minimal-intervention rules learned the hard way this session:
//  - Do NOT touch the carousel config beyond item counts. Setting slidesPerView/loop
//    produced a duplicated first slide at runtime.
//  - Lazy images share ONE base64 SVG placeholder in src. The real source is data-src.
//  - min-height is a floor, not a cap. Capping the hero needs the H1 type ramp.
//  - Icon tiles reuse the EXISTING sgb-component-card DOM verbatim, swapping the <img>
//    in .thumbnail for an inline <svg>. If SGB renders today's cards, it renders these.
import * as cheerio from 'cheerio';
import fs from 'node:fs';

const FILE = process.argv[2];
if (!FILE) { console.error('usage: node restructure.mjs <index.html> [featured=Deal_1,...]'); process.exit(1); }
const featuredArg = (process.argv[3] || '').replace(/^featured=/, '');
const FEATURED = featuredArg ? featuredArg.split(',').map(s => s.trim()) : null;
const FEATURED_COUNT = 6;

const MENU = 'https://menu.lasvegas.treeoflifenv.com';
const $ = cheerio.load(fs.readFileSync(FILE, 'utf8'), { decodeEntities: false });
const log = [];

// ---------- 0. sanity ----------
const IDS = ['iuf2', 'i9szc', 'imski', 'ialb8', 'ir16v', 'i5qeg', 'iujbg', 'i0m8q', 'i3kl4'];
const bad = IDS.filter(id => $('#' + id).length !== 1);
if (bad.length) { console.error('HALT missing/duplicate ids: ' + bad.join(',')); process.exit(2); }
log.push('sanity: all 9 stable ids present exactly once');

// ---------- 1. REORDER: charity above brands ----------
const topOf = id => $('#' + id).closest('.sgbuilder-wrapper > *');
const charity = topOf('i5qeg'), brands = topOf('ialb8');
if (!charity.length || !brands.length) { console.error('HALT cannot resolve charity/brands'); process.exit(2); }
charity.insertBefore(brands);
log.push('reorder: charity(i5qeg) moved above brands(ialb8)');

// ---------- 2. FEATURED DEALS ----------
const imgOf = el => {
  const i = $(el).find('img').first();
  let v = i.attr('data-src') || '';
  if (!v || v.startsWith('data:')) v = (i.attr('srcset') || '').split(',')[0].trim().split(' ')[0] || '';
  if (!v || v.startsWith('data:')) v = (i.attr('alt') || '').replace(/\s+/g, '_');
  return ((v.split('/').pop()) || '').trim();
};
const all = $('#i9szc .gallery-item').toArray();
const seen = new Set(); let removedDup = 0, removedTrim = 0, kept = 0;
for (const el of all) {
  const name = imgOf(el);
  if (name && seen.has(name)) { $(el).remove(); removedDup++; continue; }
  if (name) seen.add(name);
  const wanted = FEATURED ? FEATURED.some(f => name.startsWith(f)) : kept < FEATURED_COUNT;
  if (wanted) kept++; else { $(el).remove(); removedTrim++; }
}
log.push(`deals: ${all.length} -> kept ${kept} (${removedDup} dup, ${removedTrim} surplus): ${[...seen].slice(0, FEATURED_COUNT).join(', ')}`);

const DEALS_URL = MENU + '/menu/specials';

// ---------- 2b. DEALS CARDS: image-led card + white text footer ----------
// The rail no longer uses the cloned Deal_N.webp artwork. Those were flat 425x498 images that
// baked the whole card in (a "DAILY DEAL" band, a divider and a painted-on "Shop Now" pill), and
// they have been superseded by real branded creative supplied by the client: 400x240 (5:3)
// promo images that each state brand, price and product. Every footer label below is therefore
// derived word-for-word from the artwork -- there are no invented product categories left.
// (_tooling/make-deal-tiles.py is kept only to regenerate the legacy green tiles if those
// offers ever come back; it is not part of this path.)
const DEAL_CARDS = [
  { f:'deal-incredibles-gummies.webp',     cat:'Gummies', ttl:'Incredibles &mdash; 5 for $40',
    alt:'Incredibles: 5 for $40 on gummies' },
  { f:'deal-rythm-goodgreen-half-oz.webp', cat:'Flower',  ttl:'Rythm &amp; Good Green &mdash; $59 half oz',
    alt:'Rythm and Good Green: $59 for a half ounce of flower' },
  { f:'deal-rythm-goodgreen-oz.webp',      cat:'Flower',  ttl:'Rythm &amp; Good Green &mdash; $99 oz',
    alt:'Rythm and Good Green: $99 for an ounce of flower' },
  { f:'deal-greenheaven-half-oz.webp',     cat:'Flower',  ttl:'Green Heaven &mdash; $45 half oz',
    alt:'Green Heaven: $45 for a half ounce of flower' },
];
const PH400 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjQwIj48L3N2Zz4=';
{
  const host = $('#i9szc .gallery-items').first();
  host.find('.gallery-item').remove();
  for (const d of DEAL_CARDS) {
    // the footer sits INSIDE the <a> so the whole card is the link surface
    host.append(
      `<div class="gallery-item gallery-item-image">` +
      `<a href="${DEALS_URL}" aria-label="${d.alt}" class="tol-deal-link">` +
      `<div class="thumb"><img src="${PH400}" data-src="assets/in-pages/${d.f}" ` +
      `data-lazyload="true" loading="lazy" alt="${d.alt}" class="img-fluid " ` +
      `width="400" height="240" style="aspect-ratio:400/240;" decoding="async"></div>` +
      `<div class="tol-deal-foot"><span class="tol-deal-cat">${d.cat}</span>` +
      `<span class="tol-deal-ttl">${d.ttl}</span></div></a></div>`);
  }
}
// the old cards' <head> preloads point at artwork that is no longer on the page (and at the
// dead staging host in their imagesrcset); swap them for the new LCP candidate.
$('link[rel="preload"][as="image"]').each((i, el) => {
  if (/assets\/in-pages\/Deal_\d+\.webp/.test($(el).attr('href') || '')) $(el).remove();
});
$('head').append(`<link rel="preload" as="image" href="assets/in-pages/${DEAL_CARDS[0].f}" fetchpriority="high">`);
log.push(`deals: rail rebuilt with ${DEAL_CARDS.length} branded client images (2:1 card, label+title footer); stale preloads swapped`);

// Carousel: 4-up, loop OFF at root AND in EVERY breakpoint.
// plugins.min.js pads the DOM with real [data-sg-loop-clone] slides until the count reaches
// 2*maxSlidesPerView+1 whenever loop is truthy ANYWHERE (its check is an OR-scan over all
// breakpoints). Safe rule: 2*maxSlidesPerView+1 <= realSlides.
const dealsHost = $('#i9szc .gallery-items').first();
{
  const bp = spv => ({ slidesPerView: spv, spaceBetween: spv >= 4 ? 25 : (spv >= 3 ? 20 : (spv >= 2 ? 16 : 14)),
                       navigation: true, pagination: false, loop: false, centeredSlides: false });
  const cfg = { slidesPerView: 4, navigation: true, pagination: false, loop: false, rewind: false,
                speed: 500, spaceBetween: 25, centeredSlides: false, watchOverflow: true,
                autoplay: false,
                breakpoints: { 0: bp(1), 576: bp(2), 768: bp(3), 992: bp(3), 1200: bp(4) } };
  dealsHost.attr('data-carousel-options', JSON.stringify(cfg));
  dealsHost.attr('style', '--items-per-slide:4');
}
log.push('deals: carousel -> 4-up, loop FALSE at root + all 5 breakpoints, centeredSlides false');

// Header row: heading left, page controls hard-right in line with the card row's right edge.
// The shim appends its own .swiper-controls INSIDE the rail (which is overflow:hidden), so the
// header buttons forward clicks to those hidden controls rather than being moved out of it.
$('#i9szc #izvej').children().wrapAll('<div class="tol-deals-head-l"></div>');
$('#i9szc #izvej').append(`
<div class="tol-deals-nav">
  <button type="button" data-tol-nav="prev" aria-label="Previous deals"></button>
  <button type="button" data-tol-nav="next" aria-label="Next deals"></button>
</div>`);
// View-all as a pill BELOW the rail (not a text link in the header)
$('#i9szc').append(`
<div class="sgb-component sgb-component-cta tol-deals-viewall" data-tol-added="featured-deals-cta"><a href="${DEALS_URL}" class="tol-deals-viewall-btn" aria-label="View all deals">View all deals</a></div>`);
log.push('deals: header row = heading left + chevrons right; View-all pill below the rail');
let repointed = 0;
$('a[href$="/deals"], a[href="/deals"]').each((i, el) => {
  if (/deal/i.test(($(el).text() || '').trim())) { $(el).attr('href', DEALS_URL); repointed++; }
});
log.push(`deals: View-all CTA added; ${repointed} legacy /deals links re-pointed to the live menu`);

// ---------- 3. SHOP BY CATEGORY - full-bleed band of line-art icons ----------
// Replaces the platform's Swiper cards rail entirely. With five fixed categories there is
// nothing to page, and dropping the rail also drops both of its traps: the
// 2*maxSlidesPerView+1 clone shim and the slide-child height:100% rule.
// Icons are ORIGINAL drawings in the referenced visual language, not the reference site's own
// asset files. Colours measured: band #527539, lime pill #B5D053, ink #152111
// (pill-on-band 3.06, ink-on-pill 9.63, white-on-band 5.30). The deals pill green #68954D was
// rejected here - on this band it measures 1.51:1 and the button barely reads as a shape.
const CAT_ITEMS = [
  {"label": "Flower", "href": "https://menu.lasvegas.treeoflifenv.com/menu/flower", "tbd": "", "svg": "<svg class=\"tol-cat-ico\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><defs><mask id=\"tolBud\" maskUnits=\"userSpaceOnUse\" x=\"0\" y=\"0\" width=\"64\" height=\"64\"><rect x=\"0\" y=\"0\" width=\"64\" height=\"64\" fill=\"#fff\"/><path d=\"M39.0 41.5 A7.6 7.6 0 0 1 30.7 50.5 A7.6 7.6 0 0 1 18.5 51.0 A7.6 7.6 0 0 1 9.5 42.7 A7.6 7.6 0 0 1 9.0 30.5 A7.6 7.6 0 0 1 17.3 21.5 A7.6 7.6 0 0 1 29.5 21.0 A7.6 7.6 0 0 1 38.5 29.3 A7.6 7.6 0 0 1 39.0 41.5 Z\" fill=\"#000\" stroke=\"#000\" stroke-width=\"3.4\"/></mask></defs><g mask=\"url(#tolBud)\"><path d=\"M50.2 49.7 A6.2 6.2 0 0 1 40.3 50.9 A6.2 6.2 0 0 1 33.2 43.9 A6.2 6.2 0 0 1 34.2 34.0 A6.2 6.2 0 0 1 42.6 28.6 A6.2 6.2 0 0 1 52.1 31.8 A6.2 6.2 0 0 1 55.4 41.2 A6.2 6.2 0 0 1 50.2 49.7 Z\"/></g><path d=\"M39.0 41.5 A7.6 7.6 0 0 1 30.7 50.5 A7.6 7.6 0 0 1 18.5 51.0 A7.6 7.6 0 0 1 9.5 42.7 A7.6 7.6 0 0 1 9.0 30.5 A7.6 7.6 0 0 1 17.3 21.5 A7.6 7.6 0 0 1 29.5 21.0 A7.6 7.6 0 0 1 38.5 29.3 A7.6 7.6 0 0 1 39.0 41.5 Z\"/><path d=\"M34 21 L49 7 M43 12 q5 -4 10 -3.5 M21 31 v4.5 M18.8 33.2 h4.5 M30 45 v3.6 M28.2 46.8 h3.6 M47 36 v3.2 M45.4 37.6 h3.2\"/></svg>"},
  {"label": "Pre-rolls", "href": "https://menu.lasvegas.treeoflifenv.com/menu/pre-roll", "tbd": "", "svg": "<svg class=\"tol-cat-ico\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6.5 47.5 L43.5 25.5 a4.4 4.4 0 0 1 4.5 7.6 L11 55.1 a4.4 4.4 0 0 1 -4.5 -7.6 Z M40 27.6 l4.5 7.6 M34.6 30.8 l4.5 7.6 M7.6 47 q-2.4 3.4 0 7 M10.5 28.5 L47.5 6.5 a4.4 4.4 0 0 1 4.5 7.6 L15 36.1 a4.4 4.4 0 0 1 -4.5 -7.6 Z M44 8.6 l4.5 7.6 M38.6 11.8 l4.5 7.6 M11.6 28 q-2.4 3.4 0 7\"/></svg>"},
  {"label": "Vape carts", "href": "https://menu.lasvegas.treeoflifenv.com/menu", "tbd": " data-tol-tbd=\"vape-category-slug-unverified\"", "svg": "<svg class=\"tol-cat-ico\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20.5 18 h11 a2 2 0 0 1 2 2 v31 a5.5 5.5 0 0 1 -5.5 5.5 h-4 a5.5 5.5 0 0 1 -5.5 -5.5 v-31 a2 2 0 0 1 2 -2 Z M23 6 h6 a2 2 0 0 1 2 2 v10 h-10 v-10 a2 2 0 0 1 2 -2 Z M19.5 30 h13.5 M19.5 44 h13.5 M41 24 h9.5 a2 2 0 0 1 2 2 v25 a5 5 0 0 1 -5 5 h-3.5 a5 5 0 0 1 -5 -5 v-25 a2 2 0 0 1 2 -2 Z M43 13 h5.5 a2 2 0 0 1 2 2 v9 h-9.5 v-9 a2 2 0 0 1 2 -2 Z M39 34 h13.5\"/></svg>"},
  {"label": "Extracts", "href": "https://menu.lasvegas.treeoflifenv.com/menu/extract", "tbd": "", "svg": "<svg class=\"tol-cat-ico\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M28.5 12 L45.5 18.2 a3.2 3.2 0 0 1 1.9 4.1 L40.6 42 a8.5 8.5 0 0 1 -10.9 5.1 l-6 -2.2 a8.5 8.5 0 0 1 -5.1 -10.9 l7 -19.3 a3.2 3.2 0 0 1 3.5 -2.1 Z M31.2 3.6 L38.5 6.3 a2.3 2.3 0 0 1 1.4 3 l-1.6 4.3 -11.4 -4.2 1.6 -4.3 a2.3 2.3 0 0 1 2.7 -1.5 Z M24.6 25 L42.5 31.5 M8 53 q9 -6.5 19 -4 q8.5 2.1 16.5 .4 q5.5 -1.1 9 -3.9 M13.5 57.5 q9.5 -3.6 19 -.6 q6.4 2 12 .6 M7 47.5 a1.4 1.4 0 1 0 .1 0 Z M55 42.5 a1.4 1.4 0 1 0 .1 0 Z\"/></svg>"},
  {"label": "Edibles", "href": "https://menu.lasvegas.treeoflifenv.com/menu/edible", "tbd": "", "svg": "<svg class=\"tol-cat-ico\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M30.0 25.0 Q23.7 20.0 14.3 21.5 Q22.2 26.9 30.0 25.0 M30.0 25.0 Q26.0 16.7 15.6 13.6 Q21.0 23.0 30.0 25.0 M30.0 25.0 Q30.0 14.6 21.0 6.4 Q21.8 18.6 30.0 25.0 M30.0 25.0 Q35.1 14.7 30.0 2.0 Q24.9 14.7 30.0 25.0 M30.0 25.0 Q38.2 18.6 39.0 6.4 Q30.0 14.6 30.0 25.0 M30.0 25.0 Q39.0 23.0 44.4 13.6 Q34.0 16.7 30.0 25.0 M30.0 25.0 Q37.8 26.9 45.7 21.5 Q36.3 20.0 30.0 25.0 M30 25 v7 M19 37 h21 a2.6 2.6 0 0 1 2.6 2.6 v11 a2.6 2.6 0 0 1 -2.6 2.6 h-21 a2.6 2.6 0 0 1 -2.6 -2.6 v-11 a2.6 2.6 0 0 1 2.6 -2.6 Z M22 37 L26.5 31.6 h21 a2.6 2.6 0 0 1 2.6 2.6 v11 a2.6 2.6 0 0 1 -2.6 2.6 h-4.5 M42.6 37 L47.5 31.6 M23 43.5 h9 M11.5 54 a1.4 1.4 0 1 0 .1 0 Z M8 48.5 a1.2 1.2 0 1 0 .1 0 Z\"/></svg>"}
];
{
  const sec = $('#imski');
  sec.find('.sgb-component-cards').remove();          // the old cards carousel
  const items = CAT_ITEMS.map(c =>
    `<a class="tol-cat-item" href="${c.href}"${c.tbd} aria-label="Shop ${c.label.toLowerCase()}">`
    + c.svg + `<span class="tol-cat-label">${c.label}</span></a>`).join('');
  sec.append(
    `<div class="tol-cat-band" data-tol-added="category-icon-band">`
    + `<div class="tol-cat-row">${items}</div>`
    + `<div class="tol-cat-cta"><a class="tol-cat-viewall" href="${MENU}/menu" `
    + `aria-label="View all categories">View all</a></div></div>`);
}
log.push(`categories: rail replaced by a ${CAT_ITEMS.length}-icon band + one View-all pill (no carousel)`);

$('body').append(`
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
`);
log.push('categories: band CSS (tol-cat-band) injected');

// ---------- 3b. POINTS & REWARDS: real phone mockup ----------
// The stock two-phone render is replaced by a hand-held phone whose screen carries an actual
// capture of THIS site's mobile view, composited by _tooling/make-rewards-phone.py (that script
// documents how the screen quad is found and why the mask has to be the filled largest
// component rather than the quad). The original alt was empty, which for the section's only
// image left screen-reader users with nothing.
{
  const img = $('#ir16v img').first();
  if (img.length) {
    const ALT = 'A phone held in one hand showing the Tree of Life rewards offer: earn 250 points when you sign up, with a sign-up QR code and the Bud, VIP, Diamond and Elite points tiers';
    img.attr('data-src', 'assets/in-pages/rewards_app_phone_mockup.webp')
       .removeAttr('srcset').removeAttr('sizes')
       .removeAttr('data-img-fallback').removeAttr('onerror')
       .attr('src', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAwIiBoZWlnaHQ9IjE2MDAiPjwvc3ZnPg==')
       .attr('alt', ALT).attr('width', '1600').attr('height', '1600')
       .attr('style', 'aspect-ratio:1/1;');
    log.push('rewards: phone mockup swapped in (site mobile view on screen) + real alt text');
  }
}

// ---------- 4. APP SECTION — ships complete with zero client assets ----------
const appSection = `
<section class="sgb-component sgb-component-section tol-app" id="tol-app" data-tol-added="app-section" data-tol-slot="app-phone-bg">
  <div class="container">
    <div class="row tol-app-row">
      <div class="col tol-app-copy">
        <!-- SWAP ZONE: client-supplied copy. Safe to edit. -->
        <div class="sgb-component sgb-component-heading"><h2 class="tol-app-h">Coming soon: the Tree of Life app</h2></div>
        <div class="sgb-component sgb-component-text tol-app-offer">App-only specials, every week.</div>
        <ul class="tol-app-list">
          <li>Order ahead and skip the line</li>
          <li>Track your rewards points</li>
          <li>App-only download specials</li>
        </ul>
        <!-- END SWAP ZONE -->
        <div class="tol-app-badges">
          <span class="tol-badge is-pending" aria-disabled="true" role="img" aria-label="App Store, coming soon">
            <img src="assets/in-pages/download_app_store.webp" width="256" height="80" alt="Download on the App Store" loading="lazy" decoding="async">
          </span>
          <span class="tol-badge is-pending" aria-disabled="true" role="img" aria-label="Google Play, coming soon">
            <img src="assets/in-pages/google_play.webp" width="256" height="80" alt="Download on the Google Play Store" loading="lazy" decoding="async">
          </span>
        </div>
        <!-- DELETE THIS ONE COMPONENT when the app is live, then add href to the two badges. -->
        <p class="tol-app-soon" data-tol-delete-on-launch="true">Coming soon to the App Store and Google Play.</p>
      </div>
    </div>
  </div>
</section>`;
topOf('iujbg').before(appSection);
log.push('app: section built with designed fallback (silhouette + disabled badges + deletable notice)');
log.push('app: slots app-phone-1 (640x1280) and two 256x80 badges are fixed-ratio file swaps');

// ---------- 5. ORPHANS: make it a switch, not a decision ----------
$('body').append(`
<script id="tol-orphans">
(function(){
  try{
    var mode = new URLSearchParams(location.search).get('orphans') || 'keep';
    if (mode === 'drop') {
      ['ir16v','i3kl4'].forEach(function(id){
        var el = document.getElementById(id);
        var top = el && el.closest('.sgbuilder-wrapper > *');
        if (top) top.style.display = 'none';
      });
      document.documentElement.setAttribute('data-tol-orphans','drop');
    }
  }catch(e){}
})();
</script>`);
log.push('orphans: ?orphans=drop hides Rewards(ir16v) + Contact CTA(i3kl4); default keeps them');

// ---------- 6. STYLES ----------
$('body').append(`
<style id="tol-restructure">
#iuf2 { min-height:78vh !important; height:auto !important;
        padding-top:clamp(40px,5vh,64px) !important; padding-bottom:clamp(40px,5vh,64px) !important; }
@media only screen and (min-width:768px) and (max-width:1200px){
  #ieoe{font-size:46px !important;line-height:1.14 !important}
  #inbmi{margin-bottom:10px !important} #iabjw{margin-top:16px !important}
}
@media only screen and (max-width:767px){
  #iuf2{min-height:74vh !important}
  #ieoe{font-size:34px !important;line-height:1.14 !important;margin-bottom:6px !important}
  #inbmi{margin-bottom:8px !important} #iabjw{margin-top:12px !important}
}
.tol-deals-viewall{text-align:center;margin-top:28px}
.tol-deals-viewall .btn{min-height:44px;display:inline-flex;align-items:center}

/* Category tiles. The card wrapper stays SGB-native; only presentation is overridden.
   The inherited style_1 geometry is built for a rotated-title photo card: the CARD carries
   ~100px of left padding against ~25px right (a gutter for the rotated title), which pushed
   .inner and everything in it 38px right of centre. Reset the padding and let .inner fill. */
.tol-cat-card{height:auto !important;overflow:visible !important;padding:0 !important}
.tol-cat-card .inner.style_1{width:100% !important;max-width:100% !important;
  flex:1 1 100% !important;margin:0 !important;box-sizing:border-box !important;
  height:100% !important;min-height:0 !important;
  display:flex !important;flex-direction:column;align-items:center;justify-content:center !important;
  gap:12px;padding:22px 16px !important;text-align:center}
.tol-cat-card a.p{position:absolute;inset:0;background:none !important;z-index:1}
.tol-cat-card a.p::before,.tol-cat-card a.p::after{content:none !important;display:none !important}
/* Photo frame. The recovered images are transparent cut-outs, so they sit straight on the
   card green with no chip behind them. */
.tol-cat-card .thumbnail{position:relative;z-index:2;
  width:100% !important;height:168px !important;min-height:0 !important;max-height:168px !important;
  flex:0 0 auto !important;aspect-ratio:auto !important;overflow:visible !important;
  background:none !important;border:0 !important;border-radius:0 !important;
  display:flex !important;align-items:center;justify-content:center}
.tol-cat-card .thumbnail img{width:100% !important;height:100% !important;
  object-fit:contain !important;display:block;margin:0 auto}
.tol-cat-card .thumbnail svg.tol-ico{width:64px;height:64px;color:#fff}
.tol-cat-card .info{position:relative;z-index:2;width:100% !important;height:auto !important;
  display:flex !important;flex-direction:column;align-items:center;gap:10px;
  padding-left:0 !important;padding-right:0 !important}
.tol-cat-card .title{position:static !important;transform:none !important;
  width:auto !important;height:auto !important;left:auto !important;top:auto !important;
  max-width:100% !important;display:block !important;overflow:visible !important;
  writing-mode:horizontal-tb !important;white-space:nowrap !important;
  font-size:20px !important;line-height:1.25;color:#fff;margin:0;text-align:center !important}
.tol-cat-card .title::after,.tol-cat-card .title::before{content:none !important;display:none !important}
.tol-cat-card .title svg,.tol-cat-card .title i{display:none !important}
.tol-cat-card .ctas{position:relative;z-index:2;width:100% !important;height:auto !important;
  display:flex !important;justify-content:center !important;padding:0 !important;margin:0 !important}
.tol-cat-card .btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center;
  white-space:nowrap;margin:0 !important}
@media only screen and (max-width:767px){
  .tol-cat-card .thumbnail{height:138px !important;max-height:138px !important}
  .tol-cat-card .title{font-size:18px !important}
}

/* App section */
.tol-app{padding:56px 0}
.tol-app-row{display:flex;gap:32px;align-items:center;flex-wrap:wrap}
.tol-app-copy{flex:1 1 320px;min-width:0}
.tol-app-art{flex:0 1 260px;display:flex;justify-content:center}
/* The site's global heading style is white text faked legible with a 4-way text-shadow.
   That measures 1.00 contrast on a light ground. Do not inherit it for authored content. */
.tol-app-h{margin:0 0 8px;color:#21362C !important;-webkit-text-stroke:0 !important;
  text-shadow:none !important;font-size:34px;line-height:1.2}
@media only screen and (max-width:767px){ .tol-app-h{font-size:26px} }
/* Brand green #5a9642 measures 3.57 on white — under the 4.5 body-text floor.
   #47762f is the same hue darkened to 5.42 and clears it. */
.tol-app-offer{font-weight:700;color:#47762f;margin-bottom:12px;font-size:17px}
.tol-app-list{margin:0 0 20px;padding-left:20px}
.tol-app-list li{margin-bottom:6px}
.tol-app-badges{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.tol-badge{display:inline-flex;opacity:.55;filter:grayscale(1);cursor:default}
.tol-badge img{height:48px;width:auto}
.tol-app-soon{margin-top:12px;font-size:14px;color:#21362C}
.tol-phone{width:210px;aspect-ratio:640/1280;border-radius:26px;background:#21362C;
  border:3px solid #5a9642;display:flex;align-items:center;justify-content:center;padding:10px}
.tol-phone-screen{width:100%;height:100%;border-radius:18px;background:rgba(174,209,54,.12);
  display:flex;align-items:center;justify-content:center}
.tol-phone-mark{color:#aed136;font-weight:700;font-size:13px;letter-spacing:.08em;text-align:center}
</style>`);
log.push('hero: min-height 100vh -> 78vh (74vh mobile) + H1 ramp tightened at <=1200 and <=767');


// ---------- 7. GLOBAL POLISH ----------
// One shared horizontal inset so every rail lines up with the .container sections.
// The site's own .container resolves to 20px margin + 15px padding = 35px of content
// inset at desktop, so the full-bleed Swiper rails are padded to match.
$('body').append(`
<style id="tol-polish">
:root{ --tol-inset:35px; --tol-ink:#21362C; --tol-green:#5a9642; --tol-lime:#aed136; }
@media only screen and (max-width:767px){ :root{ --tol-inset:20px; } }

/* A. HERO VIDEO
   The injected video renders 1440x810 inside a 702px wrapper with object-fit:contain,
   which letterboxes it to black. Cover it instead, and drop the dead seogstage.com
   background image that was showing through as black. */
#iuf2{ background-image:none !important; background-color:#1d2f24 !important; }
#iuf2 .sg-video-bg-wrapper{ position:absolute !important; inset:0 !important;
  width:100% !important; height:100% !important; overflow:hidden !important; z-index:0 !important;
  background:transparent !important; }
/* The platform centres the video with left/top:50% + translate(-50%,-50%). inset:0 alone does
   not cancel the transform, which parks the frame at -720,-351 so only its bottom-right
   quadrant overlapped the hero. Zero the offsets AND the transform. */
#iuf2 .sg-video-bg-wrapper video, #iuf2 video{
  position:absolute !important; left:0 !important; top:0 !important;
  right:auto !important; bottom:auto !important; margin:0 !important;
  transform:none !important;
  width:100% !important; height:100% !important; min-width:100% !important; min-height:100% !important;
  max-width:none !important; max-height:none !important;
  object-fit:cover !important; object-position:center center !important; }
#iuf2 > *:not(.sg-video-bg-wrapper){ position:relative; z-index:2; }
#iuf2::after{ content:""; position:absolute; inset:0; z-index:1; pointer-events:none;
  background:linear-gradient(90deg, rgba(0,0,0,.66) 0%, rgba(0,0,0,.46) 44%, rgba(0,0,0,.12) 74%, rgba(0,0,0,0) 100%); }

/* B. SECTION HEADINGS
   The site fakes legibility with a 4-way black text-shadow on white type, which
   measures 1.00 contrast on light grounds. Remove it, set a real colour per section. */
.sgbuilder-wrapper h1,.sgbuilder-wrapper h2,.sgbuilder-wrapper h3,
.sgbuilder-wrapper .sgb-component-heading,.sgbuilder-wrapper .sgb-component-text{
  text-shadow:none !important; -webkit-text-stroke:0 !important; }
/* Light-ground sections: headings AND the platform's heading/eyebrow divs.
   The eyebrow is a div.sgb-component-heading, so an h1/h2/h3 list alone misses it. */
#i9szc h1,#i9szc h2,#i9szc h3,#i9szc h4,#i9szc .sgb-component-heading,
#imski h1,#imski h2,#imski h3,#imski h4,#imski .sgb-component-heading,
#i5qeg h1,#i5qeg h2,#i5qeg h3,#i5qeg h4,#i5qeg .sgb-component-heading,
#ialb8 h1,#ialb8 h2,#ialb8 h3,#ialb8 h4,#ialb8 .sgb-component-heading,
#ir16v h1,#ir16v h2,#ir16v h3,#ir16v h4,#ir16v .sgb-component-heading,
#tol-app h1,#tol-app h2,#tol-app h3,
#i3kl4 h1,#i3kl4 h2,#i3kl4 h3,#i3kl4 h4,#i3kl4 .sgb-component-heading{
  color:var(--tol-ink) !important; }
#i9szc .sgb-component-text,#imski .sgb-component-text,#i5qeg .sgb-component-text,
#ialb8 .sgb-component-text,#ir16v .sgb-component-text,#i3kl4 .sgb-component-text,
#i9szc p,#imski p,#i5qeg p,#ialb8 p,#ir16v p,#i3kl4 p{ color:#3f5145 !important; }
/* Dark + green grounds keep white type, minus the fake outline. */
#iujbg h1,#iujbg h2,#iujbg h3,#iujbg h4,#iujbg .sgb-component-heading,
#i0m8q h1,#i0m8q h2,#i0m8q h3,#i0m8q h4,#i0m8q .sgb-component-heading{ color:#fff !important; }
#i0m8q .sgb-component-text,#i0m8q p,#i0m8q li{ color:#f2f7ee !important; }
/* Cards keep their own local colours: brand cards are dark, category tiles are green. */
#ialb8 .brand-card,#ialb8 .brand-card *:not(.btn):not(.btn *){ color:#fff !important; }
/* lime buttons need dark ink: white on #aed136 measures 1.75 */
#ialb8 .brand-card .btn, #i3kl4 .btn, #i5qeg .btn, #imski .btn, .tol-deals-viewall .btn{
  color:#12210f !important; }
#imski .tol-cat-card .title{ color:#fff !important; }
/* Tile ground: white on the stock #5a9642 measures 3.57, which clears the large-text bar
   at desktop (20px bold) but not the 4.5 body bar once the title drops to 18px on mobile.
   Darken one step to #47762f (same hue as the FAQ ground) and white clears at 5.42 at any size. */
#imski .tol-cat-card, #imski .tol-cat-card .inner.style_1{ background-color:#47762f !important; }
#imski .tol-cat-card{ border-radius:20px !important; overflow:hidden !important; }
#imski .tol-cat-card .inner.style_1{ border-radius:20px !important; }
#iujbg .testimonial-item .content{ color:#2c3a31 !important; }
#ieoe{ color:#fff !important; }

/* C. RAIL ALIGNMENT + TRUE EDGE GUTTER
   Padding does NOT create a gutter on a Swiper: overflow:hidden clips at the BORDER box,
   so slides translate straight through the padding and get sliced at the viewport edge.
   Narrow the rail with width+margin instead, so the clip happens on the 35px line and
   every rail starts where the .container sections start.
     deals / categories  parent 1440 @0   -> margin 35
     brands              parent 1430 @5   -> margin 30
     reviews             parent 1400 @20  -> margin 15  */
#i9szc .gallery-items, #imski .sg-card-items{
  padding-left:0 !important; padding-right:0 !important;
  width:calc(100% - 70px) !important; margin-left:35px !important; margin-right:35px !important;
  box-sizing:border-box !important; }
#ialb8 .gallery-items{
  padding-left:0 !important; padding-right:0 !important;
  width:calc(100% - 60px) !important; margin-left:30px !important; margin-right:30px !important;
  box-sizing:border-box !important; }
#iujbg .container{ padding-left:0 !important; padding-right:0 !important; }
#iujbg .sgb-component-testimonials{ padding-left:0 !important; padding-right:0 !important; }
#iujbg .testimonial-items{
  padding-left:0 !important; padding-right:0 !important;
  width:calc(100% - 30px) !important; margin-left:15px !important; margin-right:15px !important;
  box-sizing:border-box !important; }
@media only screen and (max-width:767px){
  #i9szc .gallery-items, #imski .sg-card-items{
    width:calc(100% - 40px) !important; margin-left:20px !important; margin-right:20px !important; }
  #ialb8 .gallery-items{
    width:calc(100% - 30px) !important; margin-left:15px !important; margin-right:15px !important; }
  #iujbg .testimonial-items{
    width:calc(100% - 20px) !important; margin-left:10px !important; margin-right:10px !important; }
}

/* D. REVIEWS
   The card was a fixed 372px block holding a 322px .content, so the quote rendered
   below the visible area. Lay the card out as a column and let the text flow. */
#iujbg .testimonial-items .swiper-wrapper{ align-items:stretch !important; }
#iujbg .testimonial-items{ overflow:hidden !important; }
#iujbg .testimonial-item{
  height:auto !important; min-height:300px !important; max-height:none !important;
  padding:26px 26px 26px 54px !important; border-radius:16px !important;
  display:flex !important; flex-direction:column !important; gap:14px !important;
  box-shadow:0 10px 26px rgba(0,0,0,.28) !important; overflow:visible !important; }
/* The platform forces every slide child to height:100% via
   .sgen--blocks_carousel .swiper-wrapper > .swiper-slide > *. Combined with a
   shrinkable flex child that collapsed .content to 0px, so the quote rendered at zero
   height. flex:0 0 auto lets it size to its own text. */
#iujbg .testimonial-items .swiper-slide > *{ height:auto !important; }
#iujbg .testimonial-item .content{
  height:auto !important; max-height:none !important; min-height:0 !important;
  overflow:visible !important; display:block !important; flex:0 0 auto !important;
  color:#2c3a31 !important; font-size:15px !important; line-height:1.55 !important; }
#iujbg .testimonial-item .rating{ flex:0 0 auto !important; }
#iujbg .testimonial-item .info{ flex:0 0 auto !important; color:#4a5a50 !important; }

/* E. CHARITY
   The row carries negative gutters that pulled the image to x=23. Zero them so the
   image's left edge lands on the same 35px line as the deal cards above. */
#i5qeg .row{ align-items:center !important; margin-left:0 !important; margin-right:0 !important; }
#i5qeg .cell:first-child{ padding-left:0 !important; padding-right:0 !important; }
#i5qeg img{ width:100% !important; max-width:100% !important; height:auto !important;
  border-radius:20px !important; display:block !important;
  box-shadow:0 14px 34px rgba(33,54,44,.18) !important; }
#i5qeg .cell:last-child{ padding-left:34px !important; }

/* F. BRANDS */
#ialb8 .brand-card{ box-shadow:0 12px 30px rgba(33,54,44,.22) !important; }
/* The brand logos are white wordmarks built for a dark plate. A white background made
   them invisible - match the brand card's near-black instead. */
#ialb8 .thumb{ background:#121315 !important; border-radius:20px !important;
  box-shadow:0 12px 30px rgba(33,54,44,.22) !important; overflow:hidden !important;
  padding:18px !important; display:flex !important; align-items:center; justify-content:center; }
#ialb8 .thumb img{ max-width:100% !important; height:auto !important; object-fit:contain !important; }

/* G. APP SECTION */
#tol-app{ position:relative; overflow:hidden;
  border-top:1px solid rgba(33,54,44,.14) !important; padding:72px 0 !important; }
/* The image occupies the right half and is CROPPED to fill it (cover), so there is no
   dead white margin inside the band. */
#tol-app::before{ content:""; position:absolute; top:0; bottom:0; right:0; left:40%;
  z-index:0; pointer-events:none;
  background-image:url("assets/in-pages/app_lifestyle_bg.png");
  background-repeat:no-repeat; background-position:center center; background-size:cover; }
/* Many stops = a genuinely gradual wash rather than a visible edge. */
#tol-app::after{ content:""; position:absolute; inset:0; z-index:1; pointer-events:none;
  background:linear-gradient(90deg,
    #fff 0%, #fff 30%,
    rgba(255,255,255,.99) 38%, rgba(255,255,255,.95) 45%,
    rgba(255,255,255,.87) 52%, rgba(255,255,255,.74) 59%,
    rgba(255,255,255,.58) 66%, rgba(255,255,255,.40) 73%,
    rgba(255,255,255,.24) 80%, rgba(255,255,255,.11) 88%,
    rgba(255,255,255,0) 100%); }
#tol-app .container{ position:relative; z-index:2; }
#tol-app .tol-app-copy{ max-width:560px; }
@media only screen and (max-width:767px){
  #tol-app::before{ background-size:cover; opacity:.22; }
  #tol-app::after{ background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.78)); }
}

/* H. FAQ
   White type on the section's #5a9642 measures 3.57, under the 4.5 body floor. Darken the
   ground one step to #47762f (same hue) and white clears at 5.42. */
#i0m8q{ position:relative; overflow:hidden; background-color:#47762f !important; }
#i0m8q .sgb-component-section, #i0m8q > .container{ background-color:transparent !important; }
#i0m8q::before{ content:""; position:absolute; inset:0; z-index:0; pointer-events:none;
  background-image:url("assets/in-pages/faq_leaves_bg.png");
  background-repeat:no-repeat; background-position:right center; background-size:cover;
  opacity:.5; mix-blend-mode:soft-light;
  -webkit-mask-image:linear-gradient(90deg,transparent 0%,transparent 38%,#000 78%);
  mask-image:linear-gradient(90deg,transparent 0%,transparent 38%,#000 78%); }
#i0m8q > *{ position:relative; z-index:1; }

/* I. CLOSING CTA */
#i3kl4 a{ color:var(--tol-ink) !important; text-decoration:none !important; font-weight:700 !important; }
#i3kl4 .btn{ color:#12210f !important; }
</style>`);
log.push('polish: hero video object-fit cover + dead bg removed + legibility scrim');
log.push('polish: headings de-outlined - dark green on light, white on dark/green');
log.push('polish: rails padded to the shared 35px container inset');
log.push('polish: review cards re-laid as columns so the quote text renders');
log.push('polish: charity image widened, rounded, shadowed; copy shifted right');
log.push('polish: brand cards + thumbs given elevation');
log.push('polish: app section divider + phone bg right + white left-to-centre gradient');
log.push('polish: FAQ botanical bg masked to the right side');
log.push('polish: closing CTA text set to readable dark green');




// ---------- 9. PORTABLE PATHS ----------
// The clone emits a few ROOT-absolute asset refs ("/sites/...", "/assets/..."). Those resolve
// only when the bundle is served from a domain root. Under a GitHub Pages project path
// (/<repo>/) they 404 - which is exactly what killed the hero video on the first publish:
//   /sites/.../hero-30s.webm                 -> 404
//   /<repo>/sites/.../hero-30s.webm          -> 200
// Rewrite them relative so the bundle works from a root OR a subpath.
{
  let vid = 0, other = 0;
  $('[data-background-video]').each((i, el) => {
    const raw = $(el).attr('data-background-video') || '';
    // the value is JSON with escaped slashes: {"url":"\/sites\/..."}
    const fixed = raw.replace(/"url"\s*:\s*"\\?\/(?!\/)/g, '"url":"');
    if (fixed !== raw) { $(el).attr('data-background-video', fixed); vid++; }
  });
  $('[src], [href]').each((i, el) => {
    for (const attr of ['src', 'href']) {
      const v = $(el).attr(attr);
      if (!v) continue;
      // only asset directories - leave site navigation links (/store, /rewards) alone
      if (/^\/(assets|sites|dispenza|_xorigin)\//.test(v)) {
        $(el).attr(attr, v.replace(/^\//, ''));
        other++;
      }
    }
  });
  log.push(`portable: rewrote ${vid} background-video url(s) and ${other} root-absolute asset ref(s) to relative`);
}

// ---------- 8. DEALS CARD STYLES + HEADER NAV WIRING ----------
$('body').append(`
<style id="tol-deals-cards">
/* ============================================================================
   DEALS RAIL -> image-led card with a white text footer.
   Tokens measured off the target rail: card radius 24, 1px #e4e4e4 hairline, NO shadow,
   2:1 image, 24px footer padding, 16px/24px label + title, label #b42285, title #000.
   ========================================================================= */

/* -- header row: heading left, chevrons + view-all right ------------------ */
#i9szc #izvej{
  display:flex; align-items:flex-end; justify-content:space-between; gap:24px;
  /* the platform caps this block at max-width:1000px, which stopped the page controls
     370px short of the card row's right edge. Match the rail's own 35px inset instead. */
  max-width:none !important; width:calc(100% - 70px) !important;
  margin:0 35px 22px; padding-left:0 !important; padding-right:0 !important;
}
#i9szc .tol-deals-head-l{min-width:0}
#i9szc .tol-deals-nav{display:flex; align-items:center; gap:0; flex:0 0 auto; padding-bottom:4px}
/* 44x44 hit area (WCAG target size) with a 26px optical chevron inside; the centre-to-centre
   spacing is carried by the boxes themselves rather than a gap. */
#i9szc .tol-deals-nav button[data-tol-nav]{
  width:44px; height:44px; padding:0; margin:0; border:0; background:none;
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
/* the rail's own page controls sit at the right end of the header row, in line with the
   right edge of the card row (both are inset 35px). When every card fits there is nothing to
   page through, so Swiper locks and we hide them rather than show two dead arrows. */
#i9szc .tol-deals-nav[data-tol-locked="true"]{visibility:hidden; pointer-events:none}

/* View-all pill below the rail */
#i9szc .tol-deals-viewall{text-align:center; margin-top:34px}
#i9szc .tol-deals-viewall-btn{
  display:inline-flex; align-items:center; justify-content:center;
  min-height:44px; padding:11px 30px;
  background:#68954d; color:#152111;
  font-size:16px; font-weight:700; line-height:1.2; text-decoration:none; text-shadow:none;
  border-radius:999px; border:0;
  transition:background .15s ease;
}
#i9szc .tol-deals-viewall-btn:hover,
#i9szc .tol-deals-viewall-btn:focus-visible{background:#5a8442; color:#152111}
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
/* LOAD-BEARING. chrome.css sets '.swiper-wrapper>.swiper-slide>*{height:100%}'. Dormant under
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
#i9szc .tol-deal-foot{text-align:left; align-items:flex-start}
#i9szc .tol-deal-cat, #i9szc .tol-deal-ttl{text-align:left; width:100%}
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
    var sw = rail.swiper;
    var locked = !!sw && (sw.isLocked === true || (sw.isBeginning && sw.isEnd));
    wrap.setAttribute('data-tol-locked', locked ? 'true' : 'false');
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
`);
log.push('deals: card CSS (tol-deals-cards) + header nav script injected');

// ---------- 9. REWARDS IMAGE BLEED ----------
$('body').append(`
<style id="tol-rewards-bleed">
/* The rewards image is a hand whose arm runs off the bottom-right of the artwork. Inside the
   centred .container it stopped short of the viewport and read as a floating cut-out, so the
   image cell is pulled out to the right edge of the screen and the arm runs off it.

   calc(50% - 50vw): the 50% resolves against the row's width, so this equals
   -(viewport - container)/2 - exactly the gutter between the container edge and the screen edge.
   Only from 992px up; below that the layout is stacked and a bleed would just crop the phone. */
@media (min-width:992px){
  /* the cell also carries 25px of its own padding, which held the artwork 25px short of
     the screen edge even after the negative margin landed correctly */
  #ir16v #i7sp5{ margin-right:calc(50% - 50vw) !important; padding-right:0 !important; }
  #ir16v #ilkzg{ width:100% !important; max-width:none !important; }
  #ir16v #ilkzg img{ width:100% !important; max-width:none !important; height:auto !important; }
}
/* the section spans the viewport, so this cannot clip the bleed - it only stops the negative
   margin from becoming a horizontal scrollbar if a browser rounds the calc up a pixel */
#ir16v{ overflow-x:clip; }
</style>
`);
log.push('rewards: image cell bleeds to the right viewport edge >=992px');

fs.writeFileSync(FILE, $.html(), 'utf8');
console.log('RESTRUCTURE OK -> ' + FILE);
log.forEach(l => console.log('  - ' + l));
