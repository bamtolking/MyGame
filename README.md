# MyGame — 게임 허브 (GitHub Pages)

Claude Code로 만든 HTML5 게임 10개를 **한 사이트**에서 각각 다른 주소로 실행하는 허브입니다.
휴대폰 브라우저(Chrome / Safari)에서 바로 플레이할 수 있고, 로그인·서버·결제·광고가 없습니다.

- 허브 첫 화면: `https://bamtolking.github.io/MyGame/` — 게임 목록과 **플레이** 버튼
- 각 게임: `https://bamtolking.github.io/MyGame/<게임 폴더 이름>/`

## 게임 목록과 원본 브랜치

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

**원본 브랜치는 하나도 수정·삭제하지 않았습니다.** 이 브랜치의 `games/` 폴더는 각 브랜치에서 가져온 복사본이며,
허브에서 동작하도록 필요한 최소한의 경로만 손봤습니다(아래 "허브용으로 바꾼 것" 참고).

## 저장소 구조

```
games.json                  게임 목록(제목·설명·폴더·빌드 방법) — 허브 첫 화면과 빌드 스크립트가 모두 이 파일을 읽습니다
hub/index.html              허브 첫 화면 템플릿 (게임 카드가 자동으로 채워짐)
hub/404.html                없는 주소로 들어왔을 때 보여줄 페이지
scripts/build-site.mjs      모든 게임을 빌드해 _site/<게임>/ 로 모으고 첫 화면을 생성
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
```

## GitHub Pages 배포 (처음 한 번만 설정)

이 브랜치를 push 하면 워크플로 "Deploy game hub to GitHub Pages" 가 자동으로 돌아 10개 게임을 모두 빌드합니다.
첫 실행에서 **빌드는 성공**했고 Pages 도 Actions 방식으로 켜졌지만, 마지막 배포 단계가 다음 이유로 거부되었습니다.

> Branch "claude/game-hub-github-pages-09xp38" is not allowed to deploy to github-pages due to environment protection rules.

GitHub 가 자동으로 만든 `github-pages` 환경이 **기본 브랜치에서만 배포 허용**으로 잠겨 있기 때문입니다. 한 번만 풀어 주면 됩니다.

1. GitHub 저장소 → **Settings** → 왼쪽 메뉴 **Environments** → **github-pages** 클릭
2. *Deployment branches and tags* 에서 **Add deployment branch or tag rule** 클릭 → 이름에 `claude/game-hub-github-pages-09xp38` 입력 → **Add rule**
   (또는 드롭다운을 **No restriction** 으로 바꿔도 됩니다)
3. **Actions** 탭 → 맨 위(최신) 실행 클릭 → 오른쪽 위 **Re-run jobs** → **Re-run failed jobs**
4. 1~2분 뒤 `https://bamtolking.github.io/MyGame/` 접속 (Settings → Pages 에도 주소가 표시됩니다)

Settings → **Pages** 의 *Source* 가 **GitHub Actions** 로 되어 있는지도 확인하세요 (다른 값이면 GitHub Actions 로 바꿉니다).
이후에는 이 브랜치에 push 할 때마다 자동으로 다시 배포됩니다.
이 브랜치를 저장소의 기본 브랜치로 바꾸고 싶다면 Settings → General → *Default branch* 에서 바꿀 수 있습니다(선택 사항, 위 규칙은 그대로 필요).

## 로컬에서 빌드·미리보기

```bash
node --version                 # 22 이상
npm run build                  # games/*/ 를 모두 npm ci + 빌드 → _site/
npm run preview                # http://localhost:8080/MyGame/  (같은 Wi-Fi 휴대폰은 터미널에 표시되는 IP 주소)

node scripts/build-site.mjs last-exit          # 한 게임만 다시 빌드
SKIP_INSTALL=1 node scripts/build-site.mjs     # npm ci 생략 (이미 설치돼 있을 때)
```

게임 하나만 개발할 때는 그 폴더로 들어가 원래대로 작업하면 됩니다: `cd games/last-exit && npm install && npm run dev`

## 원본 브랜치가 바뀌었을 때 허브 복사본 갱신

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
| 크림슨 엑자일 | `sw.js` 의 오래된 캐시 삭제를 `crimson-exile-` 접두어 캐시로 한정. 브랜치의 `.github/workflows/pages.yml` 은 복사하지 않음(허브 워크플로가 대신함) | 같은 도메인의 다른 게임 오프라인 캐시를 지우지 않도록 |
| 라인워즈 | `public/sw.js`(및 `docs/sw.js`)의 캐시 삭제를 `linewars-` 접두어로 한정 | 위와 같음 |
| 라스트 엑시트 · 괴물 포장마차 · 나 혼자 도둑단 · 와르르! 철거왕 · 갈아타! | 변경 없음 (폴더 그대로 복사, 폴더 이름만 주소에 맞춤) | 이미 독립 프로젝트 |

## 세이브·PWA가 안 깨지는 이유

- 모든 게임이 `base: './'` (상대 경로) 로 빌드되어 CSS·JS·아이콘 경로가 `/MyGame/<게임>/` 아래에서 그대로 맞습니다.
- 저장 키(localStorage)가 게임마다 다릅니다: `daebak_defense_v1`, `combo_rush_*`, `crimson_exile_save_v1`, `lw.*`, `packblast_save_v1`, `last_exit_v1`, `monster-stall.save.v1`, `solo_heist_25s_v1`, `waruru.save.v1`, `galaata_v1`. 같은 도메인이라도 서로 덮어쓰지 않습니다.
- 서비스 워커는 각각 `/MyGame/crimson-exile/sw.js`, `/MyGame/line-wars/sw.js` 로 등록되어 범위(scope)가 자기 게임 폴더로 한정됩니다. manifest 의 `start_url`·`scope` 도 `./` 라 같은 폴더를 가리킵니다.
- 나머지 8개 게임은 서비스 워커 없이 동작하며(원본과 동일), 그래픽·사운드를 코드로 생성하므로 외부 파일 경로가 없습니다. 크림슨 엑자일만 Google Fonts 를 인터넷에서 불러옵니다.
