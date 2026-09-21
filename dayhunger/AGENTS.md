# 데이헝거 — 에이전트 작업 안내

벽짓살(벽 짓고 살아남기) 장르의 모바일 협동 생존 게임. 순수 JavaScript(ESM), 빌드 단계 없음. 서버는 Node 22+ 와 `ws` 하나만 씁니다.
현재 상태와 다음 할 일은 `docs/HANDOFF.md`를 먼저 읽으세요.

## 명령
```bash
npm ci                 # 의존성 (ws, playwright-core)
npm start              # 서버 http://localhost:8080  (정적 파일 + WebSocket /ws)
npm test               # 규칙 테스트 (node:test, ~2초)  tests/*.test.js
npm run e2e            # 헤드리스 Chromium 실기동 검증 (약 40초, 스크린샷 e2e-out/)
npm run verify         # test + e2e (브라우저 없으면 e2e 건너뜀)
npm run build:www      # 앱에 넣을 정적 파일 www/ 생성
npm run android:sync   # www/ 생성 → Capacitor 동기화 (SDK 불필요)
npm run android:apk    # 로컬 release APK (JDK 21 + Android SDK 필요; 보통은 CI가 대신 함)
npm run icons          # SVG → PNG 아이콘 재생성 (Chromium 필요)
```
e2e에 Chromium이 필요합니다. 없으면 `npx --yes playwright@1.63.0 install --with-deps chromium` (인터넷 필요) 또는 시스템 크롬 경로를 `DH_CHROME=/usr/bin/chromium` 처럼 지정하세요.

## 구조 (어디를 고치면 되는가)
| 하고 싶은 것 | 파일 |
| --- | --- |
| 수치·밸런스 (자원, 건물, 적, 캐릭터, 전장, 난이도, 특전, 영구 강화) | `shared/constants.js` 만 |
| 게임 규칙 (이동, 채집, 건설, 낮밤, 적 AI, 투사체, 특전 적용, 직렬화) | `shared/game.js` |
| 협동 서버 (방, 대기실 설정, 메시지) | `server/index.js` |
| 화면 전환·세션·프로필 연동·효과음 훅·도움말·일시정지 | `client/js/main.js` |
| HUD·패널·모달·프로필/강화 화면 DOM | `client/js/ui.js`, `index.html`, `client/css/style.css` |
| 그리기 (타일, 캐릭터 모션, 적, 조명, 미니맵) | `client/js/renderer.js` |
| 서버 상태 미러·보간·파티클·로그 | `client/js/view.js` |
| 경험치·레벨·포인트·강화·해금·업적·일지·오늘의 도전 | `client/js/profile.js` |
| 효과음 | `client/js/audio.js` |
| 터치/키보드/핀치 | `client/js/input.js` |
| 앱 기본 서버 주소 | `client/js/config.js` |

## 꼭 지킬 것
- **솔로와 협동은 같은 `shared/game.js`를 씁니다.** 솔로는 브라우저가 `Game`을 직접 돌리고(`LocalSession`), 협동은 서버가 돌립니다(`NetSession`은 메시지만 보냄). 게임 규칙을 바꿀 때 클라이언트에 규칙 코드를 넣지 마세요.
- 클라이언트는 `Game`의 `fullState()`/`delta()` 결과만 봅니다. 새 상태를 화면에 보이려면 `serializePlayer`/`dynamicState`에 넣고 `view.js`에서 받으세요. `fx`(효과)와 `events`(로그·소리)는 델타에 실려 한 번만 전달됩니다.
- 새 타일을 추가하면 `T`, `TILE_NAMES`, (자원이면) `RESOURCES`/`REGROW`, `game.js`의 `NATURAL_SOLID`/`BUILDING_SOLID`/`BUILDABLE_BASE`, `renderer.js`의 `drawTile`과 `MINI` 색을 함께 갱신합니다.
- 서버는 클라이언트를 믿지 않습니다: 영구 강화 효과(`meta`)는 `clampMeta`로 범위를 제한하고, 특전은 제시된 3장만 고를 수 있습니다.
- `index.html`은 프로젝트 루트에 있고 모든 경로가 상대 경로입니다(서버와 앱 `www/`가 같은 구조). 절대 경로(`/client/...`)를 쓰지 마세요.
- e2e는 `window.__dh`(main.js 끝) 훅으로 내부 상태를 읽습니다. 지우지 마세요.
- 테스트는 `tests/game.test.js`(규칙), `tests/profile.test.js`(메타), `tests/net.test.js`. 규칙을 바꾸면 테스트도 같이 고칩니다. 전장 5종 완주 안정성 테스트는 반드시 통과해야 합니다.
- 진행 데이터(`dh_profile_v1`)는 localStorage 입니다. 구조를 바꿀 때는 `defaultProfile()`에 기본값을 추가하면 `mergeDeep`이 옛 데이터를 보존합니다.
- 협동 프로토콜(클라 → 서버): `create/join {name, cls, meta}`, `settings {map, difficulty}`(방장), `class {cls, meta}`, `start`, `input {mx,my,action}`, `build/repair/dismantle {key?,x,y}`, `eat`, `say {index}`, `perk {key}`, `continue`, `restart`, `leave`. 서버 → 클라: `lobby`, `start {playerId}`, `full`, `delta`, `toast`, `error`.
