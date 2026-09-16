#!/bin/sh
# Balance batch: several AI matchups. Output appended to the given log file.
LOG=${1:-balance.log}
: > "$LOG"
run() { echo "== $*" >> "$LOG"; node --experimental-strip-types tools/headless.ts "$@" 2>&1 | tail -12 >> "$LOG"; }
run 10 1v1 hard hard iron gale
run 10 1v1 hard hard gale gale
run 10 1v1 hard hard iron iron
run 8 1v1 normal normal iron gale
run 8 1v1 easy easy iron gale
run 6 1v1 hard normal iron gale
run 6 1v1 hard easy gale iron
run 6 3v3 hard hard iron gale
run 6 3v3 normal normal gale iron
