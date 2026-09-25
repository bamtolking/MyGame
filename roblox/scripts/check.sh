#!/usr/bin/env bash
# 정적 검사: Roblox API 정의로 strict 타입 검사(린트 포함) + stylua 포맷 검사 + Lune 단위 테스트
# 필요 도구: rojo, luau-lsp, stylua, lune (README의 "개발자용" 참고)
set -euo pipefail
cd "$(dirname "$0")/.."

DEFS="${ROBLOX_DEFS:-.tools/globalTypes.None.d.luau}"
if [ ! -f "$DEFS" ]; then
	mkdir -p "$(dirname "$DEFS")"
	curl -fsSL -o "$DEFS" \
		https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.None.d.luau
fi

echo "== rojo sourcemap"
rojo sourcemap default.project.json -o sourcemap.json

echo "== luau-lsp analyze (strict, Roblox API)"
luau-lsp analyze --platform roblox --sourcemap sourcemap.json \
	--definitions "@roblox=$DEFS" --base-luaurc .luaurc src

echo "== stylua --check"
stylua --check src tests scripts

echo "== unit tests"
lune run tests/run.luau

echo "== server integration test (headless mock engine)"
lune run tests/server.luau

echo "== full-stack client smoke test"
lune run tests/client.luau
