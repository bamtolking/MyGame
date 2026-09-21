// 전체 검증: 규칙 테스트 → e2e. e2e는 브라우저가 없으면 건너뜁니다(종료 코드 3).
import { spawnSync } from 'node:child_process';
const run = (args) => spawnSync(process.execPath, args, { stdio: 'inherit', cwd: new URL('..', import.meta.url).pathname });
const t = run(['--test', 'tests/game.test.js', 'tests/profile.test.js', 'tests/net.test.js']);
if (t.status !== 0) { console.error('규칙 테스트 실패'); process.exit(1); }
const e = run(['scripts/e2e.mjs']);
if (e.status === 3) { console.log('e2e 건너뜀 (Chromium 없음). 설치: npx --yes playwright@1.63.0 install --with-deps chromium'); process.exit(0); }
if (e.status !== 0) { console.error('e2e 실패'); process.exit(1); }
console.log('모든 검증 통과');
