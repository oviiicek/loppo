#!/bin/bash
# Builds the game and serves it for the browser tests:
#   bash tools/serve.sh          the dev build (with window.__dev) on http://127.0.0.1:4177
#   bash tools/serve.sh prod     the release build on http://127.0.0.1:4181
# The builds go to $DW_OUT (default /tmp/dw). A server already running on the port is replaced.
set -e
cd "$(dirname "$0")/.."
OUT=${DW_OUT:-/tmp/dw}
mkdir -p "$OUT"
if [ "$1" = "prod" ]; then
  DIR=$OUT/prod PORT=4181
  npx vite build --outDir "$DIR" --emptyOutDir > "$OUT/build-prod.log" 2>&1 || { tail -20 "$OUT/build-prod.log"; exit 1; }
else
  DIR=$OUT/dev PORT=4177
  npx vite build --mode devtools --outDir "$DIR" --emptyOutDir > "$OUT/build-dev.log" 2>&1 || { tail -20 "$OUT/build-dev.log"; exit 1; }
fi
pkill -f "http.server $PORT" 2>/dev/null || true
cd "$DIR" && (setsid nohup python3 -m http.server $PORT --bind 127.0.0.1 > "$OUT/srv$PORT.log" 2>&1 &)
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" && { echo "serving $DIR on $PORT"; exit 0; }
  sleep 0.5
done
echo "server on $PORT did not start"; exit 1
