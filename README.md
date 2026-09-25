# MyGame — 게임 허브 (GitHub Pages)

Claude Code로 만든 HTML5 게임·앱 16개와 로블록스 게임 1개를 **한 사이트**에서 각각 다른 주소로 여는 허브입니다.
휴대폰 브라우저(Chrome / Safari)에서 바로 플레이할 수 있고, 로그인·서버·결제·광고가 없습니다.

- 허브 첫 화면: `https://bamtolking.github.io/MyGame/` — 게임 목록과 **플레이** 버튼
- 각 게임: `https://bamtolking.github.io/MyGame/<게임 폴더 이름>/`
- 아이폰: Safari 로 열고 공유 버튼 → **홈 화면에 추가** 하면 앱처럼 전체 화면으로 실행됩니다.

## 개발 중인 게임 — 업데이트할 때마다 자동 반영 (live)

아래 게임은 복사본을 두지 않고, **배포할 때마다 원본 브랜치의 최신 커밋을 받아 빌드**합니다.
게임을 만드는 채팅(세션)이 자기 브랜치에 push 한 뒤 배포 워크플로를 한 번 실행하면 같은 주소가 새 버전으로 바뀝니다(main 병합 불필요).

| 게임 | 아이폰 웹앱 주소 | 원본 브랜치 · 폴더 | 만든 채팅 |
|---|---|---|---|
| 🔥 심연의 군주 | https://bamtolking.github.io/MyGame/abyss/ | `claude/zen-lamport-5zzkqg` · `abyss/` | 디아블로 같은 게임 만들기 |
| 🐿️ 미어캣 — AI 자세 분석·교정 운동 | https://bamtolking.github.io/MyGame/meerkat/ | `claude/dreamy-darwin-hxqjan` · `meerkat/` | 물리치료사/헬스트레이너 앱 기획 |
| 🌙 달빛 퇴마단 | https://bamtolking.github.io/MyGame/moonlit/ | `claude/nice-hypatia-xlm01y` · `mmorpg/` | MMO RPG 앱 기획 |
| 🟢 슬라임 하이스트! (로블록스) | https://bamtolking.github.io/MyGame/slime-heist/ (실행 파일 다운로드) | `claude/vigilant-brahmagupta-hf2k5b` · `roblox/build/SlimeHeist.rbxlx` | 로블록스 1위 게임 개발 |
| 🐱 냥체역학 | https://bamtolking.github.io/MyGame/nyang/ | `claude/determined-wright-wwlwgn` · `nyang/` | 대박 앱 아이디어 |
| ⏰ 칼퇴 서바이버 | https://bamtolking.github.io/MyGame/kaltoe/ | `claude/zen-maxwell-uwcoq6` · `kaltoe/` | 게임 앱 개발 |

- 미어캣의 카메라 기능은 https 에서만 켜지므로 이 주소(https)에서는 아이폰 카메라로 스캔까지 됩니다.
- 달빛 퇴마단은 서버가 없는 정적 호스팅이라 **오프라인 체험 월드**(AI 동료와 함께)로 실행됩니다. 온라인 멀티플레이는 게임 서버를 따로 띄워야 합니다.
- 슬라임 하이스트는 로블록스 게임이라 브라우저에서 실행되지 않습니다. 주소의 페이지에서 `.rbxlx` 실행 파일을 받아 PC/Mac 의 Roblox Studio 로 열고 ▶ Play 합니다.
- 허브 카드의 🔄 표시 옆 시각이 마지막 업데이트(원본 커밋 시각, 한국 시간)이고, 배포된 커밋 목록은 `https://bamtolking.github.io/MyGame/versions.json` 에 있습니다.

### live 게임 배포하는 방법 (게임 세션용)

1. 게임 폴더에서 빌드·테스트하고 자기 원본 브랜치에 commit → push (`play/index.html` 단일 파일도 함께 다시 빌드해 커밋 — 허브 빌드가 실패할 때 대신 올라가는 대체본)
2. 배포 실행: GitHub MCP `actions_run_trigger` → `method: run_workflow`, `workflow_id: pages.yml`, `ref: main`
   (사람이 할 때: 저장소 → Actions → "Deploy game hub to GitHub Pages" → Run workflow → Branch: main)
3. 실행이 success 인지 확인(2~4분) → 사용자에게 `https://bamtolking.github.io/MyGame/<slug>/?v=<커밋 7자리>` 링크를 준다.
   `?v=` 는 GitHub Pages 의 브라우저 캐시(최대 10분) 때문에 옛 버전이 보이는 것을 막는다.

빌드 방식은 `games.json` 의 `live` 항목이 정합니다: `dir`(브랜치 안 폴더, 이 안에서 `npm ci` + `build.command`),
`fallback`(빌드가 실패하면 대신 올릴 단일 파일), `hubSw`(원본 서비스 워커 대신 허브 표준 워커 사용 — 아래 표).
배포 전에 받은 소스도 민감정보 검사(`check-secrets.mjs --dir`)를 거칩니다.

## 게임 목록과 원본 브랜치 (복사본 게임)

| # | 게임 | 배포 주소 (경로) | 원본 브랜치 | 원본 브랜치에서의 위치 | 허브 폴더 |
|---|---|---|---|---|---|
| 1 | 대박수비대: 합성 대폭주 | `/MyGame/daebak-defense/` | `claude/session-xitrmc` (기본 브랜치) | 저장소 루트 | `games/daebak-defense/` |
| 2 | 라인워즈: 군단의 충돌 | `/MyGame/line-wars/` | `claude/epic-gauss-ht6czg` | 저장소 루트 (`docs/`=빌드 결과) | `games/line-wars/` |
| 3 | 크림슨 엑자일 (CRIMSON EXILE) | `/MyGame/crimson-exile/` | `claude/ecstatic-ramanujan-cfm6rp` | 저장소 루트 (빌드 없는 순수 JS) | `games/crimson-exile/` |
| 4 | 합체방어대: 콤보 러시 | `/MyGame/combo-rush/` | `claude/combo-rush-tower-defense-c3edcg` | `game/` 폴더 | `games/combo-rush/` |
| 5 | 가방이 무기다: 팩 앤 블래스트 | `/MyGame/pack-and-blast/` | `claude/pack-and-blast-game-5ox2gz` | `src/packblast/` + `packblast/index.html` | `games/pack-and-blast/` |
| 6 | 털고 튀어!: 라스트 엑시트 | `/MyGame/last-exit/` | `claude/last-exit-game-dev-7unvj9` | `last-exit/` 폴더 | `games/last-exit/` |
| 7 | 괴물 포장마차: 합치고 팔자! | `/MyGame/foodtruck/` | `claude/monster-food-truck-game-thu1lj` | `monster-stall/` 폴더 | `games/foodtruck/` |
| 8 | 나 혼자 도둑단: 25초의 공범 | `/MyGame/thief/` | `claude/heist-game-25sec-xwnluz` | `heist/` 폴더 | `games/thief/` |
| 9 | 와르르! 철거왕: 한 발의 기적 | `/MyGame/demolition/` | `claude/waruru-demolition-physics-puzzle-38dmbu` | `waruru/` 폴더 | `games/demolition/` |
| 10 | 갈아타!: 바디 하이재킹 | `/MyGame/hijack/` | `claude/galaata-body-hijacking-game-xju67u` | `galaata/` 폴더 | `games/hijack/` |
| 11 | 닌자 랜덤 디펜스 (친구와 협동) | `/MyGame/ninja-random-defense/` | `claude/naruto-random-defense-mobile-h3lssi` | 저장소 루트 (`legacy/` 제외) | `games/ninja-random-defense/` |

**원본 브랜치는 하나도 수정·삭제하지 않았습니다.** 이 브랜치의 `games/` 폴더는 각 브랜치에서 가져온 복사본이며,
허브에서 동작하도록 필요한 최소한의 경로만 손봤습니다(아래 "허브용으로 바꾼 것" 참고).

## 저장소 구조

```
games.json                  게임 목록(제목·설명·폴더·빌드 방법) — 허브 첫 화면과 빌드 스크립트가 모두 이 파일을 읽습니다
hub/index.html              허브 첫 화면 템플릿 (게임 카드가 자동으로 채워짐)
hub/roblox.html             로블록스 게임 실행 파일 다운로드·실행 안내 페이지 템플릿
hub/404.html                없는 주소로 들어왔을 때 보여줄 페이지
scripts/build-site.mjs      모든 게임을 빌드해 _site/<게임>/ 로 모으고 첫 화면을 생성 (live 게임은 원본 브랜치를 .live/ 에 받아 빌드)
scripts/serve-site.mjs      _site/ 를 /MyGame/ 경로로 띄우는 로컬 미리보기 서버 (의존성 없음)
.github/workflows/pages.yml GitHub Pages 자동 배포
games/<게임>/               게임별 독립 프로젝트 (각자 package.json · 빌드 · 테스트)
```

배포 결과(`_site/`)는 다음과 같습니다.

```
_site/index.html            ← /MyGame/
_site/daebak-defense/       ← /MyGame/daebak-defense/
_site/line-wars/            ← /MyGame/line-wars/      (manifest.webmanifest + sw.js 포함, 홈 화면 설치 가능)
_site/crimson-exile/        ← /MyGame/crimson-exile/  (manifest.json + sw.js 포함, 홈 화면 설치 가능)
_site/combo-rush/  _site/pack-and-blast/  _site/last-exit/  _site/foodtruck/  _site/thief/  _site/demolition/  _site/hijack/
_site/ninja-random-defense/ ← /MyGame/ninja-random-defense/ (manifest.webmanifest 포함, 서비스 워커 없음, P2P 협동은 공용 PeerJS 서버 이용)
```

## GitHub Pages 배포

배포는 **`main` 브랜치** 기준입니다. `main` 에 push(또는 Pull Request 병합)될 때마다 워크플로 "Deploy game hub to GitHub Pages" 가 자동으로 실행되어
11개 게임을 모두 빌드하고 `https://bamtolking.github.io/MyGame/` 에 배포합니다. 작업은 `claude/*` 브랜치에서 하고 `main` 으로 PR 을 만들어 병합합니다.

처음 한 번만 확인할 설정 (저장소 → Settings):
1. **Pages** → *Source* 가 **GitHub Actions** 인지 확인
2. **Environments** → **github-pages** → *Deployment branches and tags* 에 **main** 이 허용되어 있는지 확인.
   없으면 **Add deployment branch or tag rule** → `main` → **Add rule**.
   GitHub 는 이 환경을 자동으로 만들 때 그 시점의 기본 브랜치만 허용하도록 잠급니다. 배포 잡이
   `Branch "main" is not allowed to deploy to github-pages due to environment protection rules` 로 1초 만에 거부되면 이 설정이 원인입니다.
3. (권장) **General** → *Default branch* 를 `main` 으로 변경. 저장소 첫 화면에 이 README 가 보이고 Actions 의 "Run workflow" 버튼도 쓸 수 있게 됩니다.
   새 Claude 세션은 기본 브랜치에서 시작하므로, 이렇게 해야 새 채팅도 `CLAUDE.md` 의 "업데이트할 때마다 링크 주기" 규칙을 처음부터 따릅니다.

배포 주소는 Settings → Pages 에도 표시됩니다.

## 로컬에서 빌드·미리보기

```bash
node --version                 # 22 이상
npm run build                  # games/*/ 를 모두 npm ci + 빌드 → _site/
npm run preview                # http://localhost:8080/MyGame/  (같은 Wi-Fi 휴대폰은 터미널에 표시되는 IP 주소)

node scripts/build-site.mjs last-exit          # 한 게임만 다시 빌드
SKIP_INSTALL=1 node scripts/build-site.mjs     # npm ci 생략 (이미 설치돼 있을 때)
```

게임 하나만 개발할 때는 그 폴더로 들어가 원래대로 작업하면 됩니다: `cd games/last-exit && npm install && npm run dev`

## 원본 브랜치가 바뀌었을 때 허브 복사본 갱신 (복사본 게임만)

`games/<slug>/` 는 원본 브랜치의 **복사본**이라 원본 브랜치에 새 커밋이 생겨도 자동으로 따라오지 않습니다. 다시 가져오려면:

```bash
git rm -r -q games/<slug> && git read-tree --prefix=games/<slug>/ -u origin/<원본 브랜치>:<원본 폴더>
# 예) git rm -r -q games/hijack && git read-tree --prefix=games/hijack/ -u origin/claude/galaata-body-hijacking-game-xju67u:galaata
```

콤보 러시·팩 앤 블래스트는 허브용 설정 파일이 따로 있으므로(아래 표) `src/` 등 내용 폴더만 바꿔 넣으세요.

## 새 게임 추가하는 방법

1. `games/<새-폴더>/` 에 독립 프로젝트로 넣습니다 (Vite 프로젝트라면 `vite.config.ts` 의 `base: './'` 필수).
2. `games.json` 의 `games` 배열에 항목을 추가합니다 (`slug` = 폴더 이름 = 주소, `build.outDir` = 빌드 결과 폴더).
3. push 하면 허브 첫 화면과 배포에 자동 반영됩니다.

## 운영 원칙 (프로토타입 → 정식 개발)

- **프로토타입**: `games/<slug>/` 에 소스째 넣고 `games.json` 에 등록하면 허브에서 바로 휴대폰 테스트가 됩니다. 이 저장소는 공개이므로 프로토타입 소스도 공개됩니다.
- **정식 개발 대상으로 지정한 게임**: 원본 소스를 **Private 저장소**(예: `bamtolking/<slug>-dev`)로 옮겨 개발하고, 허브에는 **빌드 결과물만** 올립니다.
  - Private 저장소에 `templates/publish-to-hub.yml` 을 넣으면 push 때마다 빌드해 이 허브의 `games/<slug>/` 에 결과물만 커밋합니다(토큰은 Private 저장소의 Actions Secret 에만 보관).
  - 허브의 `games.json` 에서 그 게임을 `"build": { "prebuilt": true }` 로 바꾸면 허브는 빌드 없이 폴더를 그대로 배포합니다.
  - 허브에 남아 있던 소스 사본은 지시가 있을 때 제거합니다. 과거 커밋에는 남으므로 완전히 숨기려면 히스토리 정리가 필요합니다.
  - 브라우저 게임의 **빌드된 JS 는 누구나 내려받을 수 있습니다**(난독화는 암호화가 아님). 숨겨야 할 로직·비밀키는 서버 측에 둡니다.
- **새 게임은 기존 게임과 분리**: 폴더·package.json·localStorage 키·service worker 캐시 이름을 공유하지 않습니다.

## 보안 규칙

- API Key · Secret · Access Token · 비밀번호 · 인증서 · 관리자 키 · `.env` 를 저장소나 클라이언트 코드에 넣지 않습니다. `.env*` 는 `.gitignore` 로 제외되어 있습니다(`.env.example` 만 허용).
- 외부 API 에 비밀키가 필요하면 프론트엔드에 키를 넣지 말고 서버 측 구조(별도 백엔드/서버리스 함수)를 씁니다.
- push 전에 `npm run check-secrets` 를 실행합니다. 모든 브랜치의 모든 커밋을 검사하며, 의심 항목이 있으면 종료 코드 1 로 멈춥니다. 배포 워크플로도 빌드 전에 작업 트리를 검사합니다.
- 오탐은 `.secrets-allowlist` 에 정규식으로 등록합니다. 과거 커밋에서 발견된 항목은 임의로 처리하지 않고 저장소 소유자가 판단합니다.
- 마지막 전체 검사: 이 문서를 갱신한 시점에 10개 게임 브랜치를 포함한 모든 커밋(27개)에서 민감정보 없음.

## 허브용으로 바꾼 것 (원본 브랜치와 다른 점)

| 게임 | 변경 | 이유 |
|---|---|---|
| 대박수비대 | 루트 → `games/daebak-defense/` 로 이동 (내용 동일) | 루트를 허브 첫 화면에 쓰기 위해 |
| 콤보 러시 | `game/` 내용을 폴더 루트로 올리고 `package.json`·`vite.config.ts`·`tsconfig.json` 에서 `game/` 접두어 제거, `scripts/*.mjs` 의 `game/play` → `play` | 원본은 루트 설정이 `root: 'game'` 으로 가리키는 구조 |
| 팩 앤 블래스트 | `src/packblast/` → `src/`, `tests/packblast/` → `tests/`, `packblast/index.html` → `index.html`, 전용 `package.json`·`vite.config.ts` 추가, `scripts/*.mjs` 경로 정리 | 원본은 대박수비대와 한 프로젝트를 공유(두 번째 진입점) |
| 냥체역학 · 칼퇴 서바이버 (live) | 배포할 때 `sw.js` 를 허브 표준 서비스 워커(네트워크 우선, `hub-<slug>-` 캐시만 관리)로 교체 (`live.hubSw`) | 원본 워커는 캐시를 먼저 보여 줘서 업데이트 직후 옛 버전이 뜨고, 활성화될 때 같은 사이트의 다른 게임 캐시까지 지움 |
| 크림슨 엑자일 | `sw.js` 의 오래된 캐시 삭제를 `crimson-exile-` 접두어 캐시로 한정. 브랜치의 `.github/workflows/pages.yml` 은 복사하지 않음(허브 워크플로가 대신함) | 같은 도메인의 다른 게임 오프라인 캐시를 지우지 않도록 |
| 라인워즈 | `public/sw.js`(및 `docs/sw.js`)의 캐시 삭제를 `linewars-` 접두어로 한정 | 위와 같음 |
| 라스트 엑시트 · 괴물 포장마차 · 나 혼자 도둑단 · 와르르! 철거왕 · 갈아타! | 변경 없음 (폴더 그대로 복사, 폴더 이름만 주소에 맞춤) | 이미 독립 프로젝트 |
| 닌자 랜덤 디펜스 | `legacy/`(대박수비대 사본)와 브랜치 전용 `.github/workflows/pages.yml` 을 복사하지 않고, `vite.config.ts`·`tsconfig.json`·`package.json` 에서 legacy 진입점·스크립트만 제거 | 대박수비대는 `games/daebak-defense/` 에 이미 있고, 배포는 허브 워크플로가 담당 |

## 세이브·PWA가 안 깨지는 이유

- 모든 게임이 `base: './'` (상대 경로) 로 빌드되어 CSS·JS·아이콘 경로가 `/MyGame/<게임>/` 아래에서 그대로 맞습니다.
- 저장 키(localStorage)가 게임마다 다릅니다: `daebak_defense_v1`, `combo_rush_*`, `crimson_exile_save_v1`, `lw.*`, `packblast_save_v1`, `last_exit_v1`, `monster-stall.save.v1`, `solo_heist_25s_v1`, `waruru.save.v1`, `galaata_v1`, `nrd.v1`(닌자 랜덤 디펜스). 같은 도메인이라도 서로 덮어쓰지 않습니다.
- 서비스 워커는 각각 `/MyGame/crimson-exile/sw.js`, `/MyGame/line-wars/sw.js` 로 등록되어 범위(scope)가 자기 게임 폴더로 한정됩니다. manifest 의 `start_url`·`scope` 도 `./` 라 같은 폴더를 가리킵니다.
- 나머지 9개 게임은 서비스 워커 없이 동작하며(원본과 동일), 그래픽·사운드를 코드로 생성하므로 외부 파일 경로가 없습니다. 크림슨 엑자일만 Google Fonts 를 인터넷에서 불러오고, 닌자 랜덤 디펜스의 협동 모드는 공용 PeerJS 시그널 서버(0.peerjs.com)와 WebRTC 를 씁니다(혼자 하기는 완전 오프라인 동작).
