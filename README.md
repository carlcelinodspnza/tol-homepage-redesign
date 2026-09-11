# Tree of Life — homepage restructure (preview)

A working preview of the proposed homepage restructure for Tree of Life Dispensary (Las Vegas),
built from a clone of the staging site so the real header, footer, chrome and video hero are intact.

**Live preview:** https://carlcelinodspnza.github.io/tol-homepage-redesign/

> Working fork of `nicoledreo/tol-homepage-redesign`, maintained at `carlcelinodspnza`.
> Updates are published from here. Upstream is tracked as the `upstream` remote (fetch-only).

---

## What changed

Section order between header and footer:

| # | Section | Change |
|---|---|---|
| 1 | Charity / VMSN video hero | Kept. Made thinner so the deals rail peeks above the fold. |
| 2 | Featured deals | Trimmed 16 cards to 6, added a **View all deals** button. |
| 3 | Shop by category | 4 photo tiles to 5 icon-led tiles: flower, pre-rolls, vape carts, extracts, edibles. |
| 4 | Charity blurb | **Moved up**, above brands. Button through to the full page. |
| 5 | Brands | Kept, reordered. |
| 6 | App | New section, ships complete with no client assets. |
| 7 | Reviews, then FAQ | Kept. Review cards fixed so the quotes actually render. |

Rewards and the closing contact band are **kept by default**. Append `?orphans=drop` to the URL to
preview the page without them — the client had listed neither.

## Measured results

| Check | Before | After |
|---|---|---|
| Deals rail visible above the fold at 1440x900 | 0px | 198px |
| Same at 375x812 | 0px | 211px |
| Rail gutters (deals / categories / brands / reviews) | inconsistent, cards sliced at the edge | all clip at 35px both sides |
| Text failing WCAG contrast | 39 elements | **0** at both 1440x900 and 375x812 |
| Horizontal overflow | none | none |

## Honest notes

- **Two images are AI-generated**, not real client assets: the vape cartridge tile
  (`assets/in-pages/vape_cart.png`) and the app section background
  (`assets/in-pages/app_lifestyle_bg.png`). Every other product photo is the client's own,
  recovered from the staging site. Generated images carry `data-tol-generated="true"` in the markup.
- **The vape category has no destination yet.** No `vape` slug exists anywhere on the live site, so
  that tile points at the full menu and is marked `data-tol-tbd="vape-category-slug-unverified"`.
  It cannot 404, but it needs the real URL before launch.
- **The app section is a placeholder by design** — real structure, fixed-ratio slots, store badges
  deliberately non-clickable, and a "Coming soon" line that is a deletable component. When the
  client's assets arrive it is a file swap, not a rebuild.
- **Pre-existing defects on the live site** are documented in `RESULTS.md` and were not caused by
  this work: five background images served from a dead host with an invalid certificate, and a
  `/deals` page still showing a calendar from July.

## Repository layout

```
/                 the restructured homepage (this is what GitHub Pages serves)
/_baseline/       the untouched clone of staging, for before/after comparison
/_tooling/        re-runnable transform, local server, generated assets
/_shots/          before/after screenshots
RESULTS.md        full build log, root causes and verification evidence
.nojekyll         required: Jekyll would otherwise drop /_xorigin and break the page
```

## Rebuilding

```bash
bash _tooling/rebuild.sh          # re-applies the transform to a fresh clone
node _tooling/serve.mjs . 8101    # serve locally, then open http://127.0.0.1:8101
```

Serve from the site root — the bundle uses absolute `/sites/...` paths, so serving from a parent
directory will 404 the hero video.
