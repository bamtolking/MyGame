#!/usr/bin/env bash
# 검증·빌드 도구를 roblox/.tools/ 에 설치합니다 (Linux x86_64, macOS arm64/x86_64). 인터넷 필요.
#   rojo(빌드) · luau(로직 테스트) · luau-lsp + globalTypes.d.luau(Roblox API 타입 검사) · lune(헤드리스 시뮬레이션)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.tools"
mkdir -p "$DIR"
cd "$DIR"

ROJO_VER="7.5.1"
LUNE_VER="0.10.3"
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS-$ARCH" in
  Linux-x86_64)  ROJO="rojo-$ROJO_VER-linux-x86_64.zip"; LUAU="luau-ubuntu.zip"; LSP="luau-lsp-linux-x86_64.zip"; LUNE="lune-$LUNE_VER-linux-x86_64.zip" ;;
  Darwin-arm64)  ROJO="rojo-$ROJO_VER-macos-aarch64.zip"; LUAU="luau-macos.zip"; LSP="luau-lsp-macos-arm64.zip"; LUNE="lune-$LUNE_VER-macos-aarch64.zip" ;;
  Darwin-x86_64) ROJO="rojo-$ROJO_VER-macos-x86_64.zip"; LUAU="luau-macos.zip"; LSP="luau-lsp-macos.zip"; LUNE="lune-$LUNE_VER-macos-x86_64.zip" ;;
  *) echo "지원하지 않는 플랫폼: $OS-$ARCH (Windows 는 WSL 에서 실행하세요)"; exit 1 ;;
esac

fetch() { # url, out
  curl -sSL --retry 3 --fail -o "$2" "$1" || { echo "다운로드 실패: $1"; exit 1; }
}
fetch "https://github.com/rojo-rbx/rojo/releases/download/v$ROJO_VER/$ROJO" rojo.zip && unzip -o -q rojo.zip && rm -f rojo.zip
fetch "https://github.com/luau-lang/luau/releases/latest/download/$LUAU" luau.zip && unzip -o -q luau.zip && rm -f luau.zip
fetch "https://github.com/JohnnyMorganz/luau-lsp/releases/latest/download/$LSP" lsp.zip && unzip -o -q lsp.zip && rm -f lsp.zip
fetch "https://github.com/lune-org/lune/releases/download/v$LUNE_VER/$LUNE" lune.zip && unzip -o -q lune.zip && rm -f lune.zip
fetch "https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau" globalTypes.d.luau
chmod +x rojo luau luau-analyze luau-compile luau-ast luau-lsp lune 2>/dev/null || true

echo "설치 완료: $DIR"
./rojo --version
./luau-lsp --version
./lune --version
echo "이제 'cd roblox && ./build.sh' 로 전체 검증을 돌릴 수 있습니다."
