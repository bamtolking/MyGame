#!/usr/bin/env bash
# 개발자용: 타입 검사 + 로직 테스트 + .rbxlx 빌드.
#   필요 도구: rojo (https://github.com/rojo-rbx/rojo/releases), luau (https://github.com/luau-lang/luau/releases),
#              luau-lsp (https://github.com/JohnnyMorganz/luau-lsp/releases), globalTypes.d.luau (luau-lsp 저장소 scripts/)
#   도구가 PATH 에 없으면 TOOLS_DIR 환경변수로 폴더를 지정하세요.
set -euo pipefail
cd "$(dirname "$0")"
TOOLS_DIR="${TOOLS_DIR:-}"
bin() { if [ -n "$TOOLS_DIR" ] && [ -x "$TOOLS_DIR/$1" ]; then echo "$TOOLS_DIR/$1"; else echo "$1"; fi; }
ROJO="$(bin rojo)"; LUAU="$(bin luau)"; LSP="$(bin luau-lsp)"
DEFS="${DEFS:-${TOOLS_DIR:+$TOOLS_DIR/}globalTypes.d.luau}"

echo "== 1/3 로직 테스트"
LUAU_BIN="$LUAU" tests/run.sh

echo "== 2/3 타입 검사 (Roblox API 정의 + Rojo 소스맵)"
"$ROJO" sourcemap default.project.json -o sourcemap.json >/dev/null
"$LSP" analyze --definitions="$DEFS" --sourcemap=sourcemap.json --base-luaurc .luaurc src/shared/*.luau src/server/*.luau src/client/*.luau
rm -f sourcemap.json

echo "== 3/3 빌드"
mkdir -p build
"$ROJO" build default.project.json -o build/GhostDiner.rbxlx
echo "완료: build/GhostDiner.rbxlx"
