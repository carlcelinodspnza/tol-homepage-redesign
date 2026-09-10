#!/usr/bin/env bash
# Rebuild the redesign from the pristine clone. Idempotent.
set -e
B="$(cd "$(dirname "$0")/.." && pwd)"
K="C:/Users/nicol/Oso/.claude/skills/clone-site"   # cheerio lives here
rm -rf "$B/redesign"
cp -r "$B/project" "$B/redesign"
for a in vape_cart.png app_lifestyle_bg.png faq_leaves_bg.png; do
  cp "$B/_tooling/assets/$a" "$B/redesign/assets/in-pages/$a"
done
cp "$B/_tooling/restructure.mjs" "$K/_tol-restructure.mjs"
( cd "$K" && node _tol-restructure.mjs "$B/redesign/index.html" )
rm -f "$K/_tol-restructure.mjs"
