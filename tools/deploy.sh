#!/bin/bash
# Builds the release and puts it on GitHub Pages (the gh-pages branch, https://oviiicek.github.io/loppo/), then
# prepares the artifact's copy in $DW_OUT/artifact (loppo.html + assets/) for the Artifact tool.
#   bash tools/deploy.sh "Deploy: what changed"
set -e
cd "$(dirname "$0")/.."
OUT=${DW_OUT:-/tmp/dw}
MSG=${1:-Deploy}
mkdir -p "$OUT"
npx tsc --noEmit
npx vite build --outDir "$OUT/prod" --emptyOutDir > "$OUT/build-prod.log" 2>&1 || { tail -20 "$OUT/build-prod.log"; exit 1; }
# GitHub Pages: the branch holds the built files only
git fetch -q origin gh-pages
git worktree remove --force "$OUT/ghp" 2>/dev/null || true
rm -rf "$OUT/ghp"
git worktree prune
git worktree add -q --detach "$OUT/ghp" origin/gh-pages
(
  cd "$OUT/ghp"
  git rm -rq --ignore-unmatch .
  cp -r "$OUT/prod/." .
  touch .nojekyll
  git add -A
  git commit -qm "$MSG"
  for i in 0 2 4 8 16; do sleep $i; git push -q origin HEAD:gh-pages && break; done
)
git worktree remove --force "$OUT/ghp"
# the artifact: the same page and its assets
rm -rf "$OUT/artifact"
mkdir -p "$OUT/artifact"
cp -r "$OUT/prod/assets" "$OUT/artifact/"
cp "$OUT/prod/index.html" "$OUT/artifact/loppo.html"
echo "deployed: $(git -C . rev-parse --short HEAD) → gh-pages; artifact files in $OUT/artifact"
ls "$OUT/artifact/assets"
