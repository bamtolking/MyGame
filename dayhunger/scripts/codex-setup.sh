#!/usr/bin/env bash
# Codex(또는 다른 에이전트) 클라우드 환경 설정 스크립트.
# 저장소 루트에서:  bash dayhunger/scripts/codex-setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== 데이헝거 의존성 설치 =="
npm ci --no-audit --no-fund
echo "== Chromium (e2e용, 실패해도 계속) =="
if ! node -e "import('playwright-core').then(m=>{const p=m.chromium.executablePath();require('fs').accessSync(p);console.log('chromium:',p)})" 2>/dev/null; then
  npx --yes playwright@1.63.0 install --with-deps chromium 2>/dev/null || npx --yes playwright@1.63.0 install chromium 2>/dev/null || echo "Chromium 설치 실패 — e2e는 건너뜀 (규칙 테스트는 동작)"
fi
echo "== 규칙 테스트 =="
npm test
echo "설정 완료. 검증: cd dayhunger && npm run verify"
