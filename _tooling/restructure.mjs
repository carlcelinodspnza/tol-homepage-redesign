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
$('#i9szc').append(`
<div class="sgb-component sgb-component-cta tol-deals-viewall" data-tol-added="featured-deals-cta">
  <a href="${DEALS_URL}" class="btn btn-secondary" aria-label="View all deals">View all deals</a>
</div>`);
let repointed = 0;
$('a[href$="/deals"], a[href="/deals"]').each((i, el) => {
  if (/deal/i.test(($(el).text() || '').trim())) { $(el).attr('href', DEALS_URL); repointed++; }
});
log.push(`deals: View-all CTA added; ${repointed} legacy /deals links re-pointed to the live menu`);

// ---------- 3. SHOP BY CATEGORY — 5 icon tiles ----------
// Icons: 24x24, fill none, stroke currentColor 1.8, round caps. Deliberately ABSTRACTED —
// no candy / cookie / lit-cigarette literalism, which is what NV ad rules tend to scrutinise.
const ico = d => `<svg class="tol-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const ICONS = {
  flower: ico('<path d="M12 21v-9"/><path d="M12 12c0-3-1.9-5.2-4.6-6.1C7.4 8.7 9 11 12 12z"/><path d="M12 12c0-3 1.9-5.2 4.6-6.1C16.6 8.7 15 11 12 12z"/><path d="M12 12c-1.5-2.3-1.5-5.4 0-7.7 1.5 2.3 1.5 5.4 0 7.7z"/>'),
  preroll: ico('<path d="M4.4 20.5 6.2 18l9.4-11a2.1 2.1 0 0 1 3.2 2.7L9.9 20.2l-3.7 1.3z"/><path d="M6.2 18l3.7 2.2"/><path d="M16.6 6.2l1.7 1.4"/>'),
  vape: ico('<path d="M10.6 2.6h2.8v2.6h-2.8z"/><rect x="8.4" y="5.2" width="7.2" height="12" rx="2.2"/><path d="M8.4 9.3h7.2"/><path d="M12 17.2v4.2"/>'),
  extract: ico('<path d="M8.6 3.4h6.8"/><path d="M10 3.4v2.4"/><path d="M14 3.4v2.4"/><rect x="6.2" y="5.8" width="11.6" height="14.4" rx="3"/><path d="M12 10.2c1.7 1.9 2.6 3.3 2.6 4.5a2.6 2.6 0 0 1-5.2 0c0-1.2.9-2.6 2.6-4.5z"/>'),
  edible: ico('<rect x="4.2" y="6.4" width="15.6" height="13.4" rx="4"/><path d="M12 10.4v5.6"/><path d="M12 12.6c-.9-1.4-2.3-2-3.8-2 0 1.7 1.5 2.7 3.8 2z"/><path d="M12 12.6c.9-1.4 2.3-2 3.8-2 0 1.7-1.5 2.7-3.8 2z"/>')
};

// Tile 3 has NO verified menu slug. The June crawl shows only edible/extract/flower/pre-roll/
// specials were ever linked, and the menu host 403s automation, so this cannot be resolved
// from here. Point it at the FULL menu (verified to exist) rather than guess into a 404.
// img = the REAL staging product photo recovered from the clone (transparent WebP, VP8X+ALPH).
// Only the vape cart had no image anywhere on the site or in the June crawl, so that one is
// generated. Every other tile is the client's own photography.
const CATS = [
  { key: 'flower',  title: 'Flower',     href: MENU + '/menu/flower',   cta: 'Shop flower',
    img: 'Group_75.webp',       alt: 'Cannabis flower bud',   real: true },
  { key: 'preroll', title: 'Pre-rolls',  href: MENU + '/menu/pre-roll', cta: 'Shop pre-rolls',
    img: 'Pre_Rolls_1.webp',    alt: 'Cannabis pre-rolls',    real: true },
  { key: 'vape',    title: 'Vape carts', href: MENU + '/menu',          cta: 'Shop vape carts',
    img: 'vape_cart.png',       alt: 'Cannabis vape cartridge', real: false,
    tbd: 'vape-category-slug-unverified' },
  { key: 'extract', title: 'Extracts',   href: MENU + '/menu/extract',  cta: 'Shop extracts',
    img: 'concentrate_1.webp',  alt: 'Cannabis extract',      real: true },
  { key: 'edible',  title: 'Edibles',    href: MENU + '/menu/edible',   cta: 'Shop edibles',
    img: 'edibles.webp',        alt: 'Cannabis edibles',      real: true }
];

// reviews rail: with the loop on, the three visible cards drift mid-slide and get sliced
// by the gutter. Turn it off so they sit flush, exactly like the category tiles.
$('#iujbg [data-carousel-options]').each((i, el) => {
  const raw = $(el).attr('data-carousel-options');
  try {
    const cfg = JSON.parse(raw);
    cfg.loop = false;
    if (cfg.breakpoints) for (const k of Object.keys(cfg.breakpoints)) cfg.breakpoints[k].loop = false;
    $(el).attr('data-carousel-options', JSON.stringify(cfg));
  } catch (e) { /* leave as-is */ }
});
log.push('reviews: carousel loop disabled so the visible cards sit flush on the gutter');

const cardsHost = $('#imski').find('.sg-card-items').first();
if (!cardsHost.length) { console.error('HALT category card container not found'); process.exit(2); }
const oldCards = cardsHost.children('.sgb-component-card').length;
cardsHost.children('.sgb-component-card').remove();
for (const c of CATS) {
  cardsHost.append(
    `<div class="sgb-component sgb-component-card tol-cat-card"${c.tbd ? ` data-tol-tbd="${c.tbd}"` : ''}>` +
      `<div class="inner style_1">` +
        `<a href="${c.href}" class="p" aria-label="${c.title}"></a>` +
        `<div class="thumbnail tol-cat-thumb">` +
          (c.img
            ? `<img src="assets/in-pages/${c.img}" alt="${c.alt}" loading="lazy" decoding="async"`
              + ` data-tol-generated="${c.real ? 'false' : 'true'}">`
            : ICONS[c.key]) +
        `</div>` +
        `<div class="info">` +
          `<div class="title">${c.title}</div>` +
          `<div class="ctas"><a href="${c.href}" class="btn btn-secondary" aria-label="${c.cta}">${c.cta}</a></div>` +
        `</div>` +
      `</div>` +
    `</div>`
  );
}
cardsHost.attr('style', '--items-per-slide:5');
const cfgRaw = cardsHost.attr('data-carousel-options');
if (cfgRaw) {
  try {
    const cfg = JSON.parse(cfgRaw);
    // 5 tiles in 5 slots: loop cloning only produces visible duplicate tiles (two "Flower"
    // side by side). This is the opposite call from the deals rail, and correct here because
    // item count equals slot count.
    const bump = o => { if (!o) return; if (o.slidesPerView >= 4) o.slidesPerView = 5; o.loop = false; };
    bump(cfg); if (cfg.breakpoints) for (const k of Object.keys(cfg.breakpoints)) bump(cfg.breakpoints[k]);
    cardsHost.attr('data-carousel-options', JSON.stringify(cfg));
  } catch { log.push('categories: WARN carousel config unparsed, left as-is'); }
}
log.push(`categories: ${oldCards} photo cards -> ${CATS.length} icon tiles (same card DOM, img swapped for inline svg)`);
log.push('categories: Concentrates relabelled Extracts to match its own /menu/extract URL');
log.push('categories: vape tile -> /menu (full menu) + data-tol-tbd marker; NOT a guessed slug');
log.push('categories: loop disabled (5 tiles in 5 slots) + style_1 rotation/padding overridden');
log.push('categories: 4 REAL staging product photos restored (Group_75, Pre_Rolls_1, concentrate_1, edibles); vape generated');

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



fs.writeFileSync(FILE, $.html(), 'utf8');
console.log('RESTRUCTURE OK -> ' + FILE);
log.forEach(l => console.log('  - ' + l));
