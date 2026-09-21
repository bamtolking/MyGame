#!/usr/bin/env bash
# 개발자용: 로직 테스트 + 타입 검사 + 속성 검사 + .rbxlx 빌드 + 헤드리스 시뮬레이션.
#   필요 도구: scripts/setup-tools.sh 한 번 실행하면 roblox/.tools/ 에 전부 설치됩니다.
#   (rojo, luau, luau-lsp + globalTypes.d.luau, lune) 다른 곳에 있으면 TOOLS_DIR 환경변수로 지정하세요.
set -euo pipefail
cd "$(dirname "$0")"
# 도구 위치: TOOLS_DIR 환경변수 > roblox/.tools (scripts/setup-tools.sh 가 설치) > PATH
TOOLS_DIR="${TOOLS_DIR:-}"
if [ -z "$TOOLS_DIR" ] && [ -d ".tools" ]; then
  TOOLS_DIR="$(pwd)/.tools"
fi
bin() { if [ -n "$TOOLS_DIR" ] && [ -x "$TOOLS_DIR/$1" ]; then echo "$TOOLS_DIR/$1"; else echo "$1"; fi; }
ROJO="$(bin rojo)"; LUAU="$(bin luau)"; LSP="$(bin luau-lsp)"
DEFS="${DEFS:-${TOOLS_DIR:+$TOOLS_DIR/}globalTypes.d.luau}"

echo "== 1/5 로직 테스트"
LUAU_BIN="$LUAU" tests/run.sh

echo "== 2/5 타입 검사 (Roblox API 정의 + Rojo 소스맵)"
"$ROJO" sourcemap default.project.json -o sourcemap.json >/dev/null
"$LSP" analyze --definitions="$DEFS" --sourcemap=sourcemap.json --base-luaurc .luaurc src/shared/*.luau src/server/*.luau src/client/*.luau
rm -f sourcemap.json

if command -v python3 >/dev/null 2>&1; then
  echo "== 3/5 도우미 속성 이름 검사"
  python3 tests/check_props.py "$DEFS"
else
  echo "== 3/5 속성 이름 검사 건너뜀 (python3 없음)"
fi

echo "== 4/5 빌드"
mkdir -p build
"$ROJO" build default.project.json -o build/GhostDiner.rbxlx
echo "완료: build/GhostDiner.rbxlx"

LUNE="$(bin lune)"
if command -v "$LUNE" >/dev/null 2>&1 || [ -x "$LUNE" ]; then
  echo "== 5/5 헤드리스 통합 시뮬레이션 (Lune)"
  "$LUNE" run tests/sim/run.luau .
else
  echo "== 5/5 시뮬레이션 건너뜀 (lune 없음)"
fi
