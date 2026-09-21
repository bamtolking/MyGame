#!/usr/bin/env bash
# 공유 모듈(순수 로직)을 Roblox 없이 Luau CLI로 테스트합니다.
#   사용법: LUAU_BIN=/path/to/luau tests/run.sh
# Roblox 식 require(script.Parent.X) 를 파일 경로 require("./X") 로 바꿔 임시 폴더에서 실행합니다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LUAU_BIN="${LUAU_BIN:-}"
if [ -z "$LUAU_BIN" ]; then
  if [ -x "$ROOT/.tools/luau" ]; then LUAU_BIN="$ROOT/.tools/luau"; else LUAU_BIN="luau"; fi
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "$ROOT"/src/shared/*.luau; do
  sed -E 's/require\(script\.Parent\.([A-Za-z0-9_]+)\)/require(".\/\1")/g' "$f" > "$TMP/$(basename "$f")"
done
cp "$ROOT"/tests/*.luau "$TMP"/

fail=0
for t in "$TMP"/*_test.luau; do
  name="$(basename "$t")"
  if "$LUAU_BIN" "$t"; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    fail=1
  fi
done
exit $fail
