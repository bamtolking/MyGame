#!/bin/sh
LOG=${1:-balance2.log}
: > "$LOG"
run() { echo "== $*" >> "$LOG"; node --experimental-strip-types tools/headless.ts "$@" 2>&1 | tail -12 >> "$LOG"; }
run 12 1v1 hard hard iron gale
run 8 1v1 hard normal iron gale
run 8 1v1 hard normal gale iron
run 6 1v1 normal easy iron gale
run 6 3v3 hard hard iron gale
run 6 3v3 hard hard gale iron
