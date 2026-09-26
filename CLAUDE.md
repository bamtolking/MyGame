# MyGame — 공개 게임 허브 운영 규칙 (Claude Code 세션용)

이 저장소(`bamtolking/MyGame`)는 **공개 게임 허브**입니다. 사람들이 링크만 받아 휴대폰/PC 브라우저에서 바로 게임을 플레이하는 용도이며,
GitHub Pages 로 `https://bamtolking.github.io/MyGame/` 에 배포됩니다. **배포 브랜치는 `main`** 이며, main 에 push(PR 병합)될 때마다 자동 배포됩니다.
구조·빌드·배포 방법은 `README.md`, 게임 목록은 `games.json` 을 먼저 읽으세요.

## 사용자 지시: 업데이트할 때마다 아이폰 웹앱 링크를 준다 (2026-09-25)
사용자는 아이폰에서 바로 해 볼 수 있는 **웹앱 링크**를 원한다. 앱·게임을 새로 만들거나 고칠 때마다(작은 수정 포함) 답변 끝에 링크를 준다.
- 링크 형식: `https://bamtolking.github.io/MyGame/<slug>/?v=<원본 브랜치 커밋 7자리>` — 로그인 없이 Safari 에서 열리고 "홈 화면에 추가"로 앱처럼 설치된다.
  `?v=` 는 브라우저 캐시(GitHub Pages 최대 10분) 때문에 옛 버전이 뜨는 것을 막는다. claude.ai 아티팩트 링크가 있으면 함께 준다(로그인 필요한 비공개 링크).
- **live 게임(아래 표)은 main 병합 없이 배포한다.** 순서:
  1. 게임 폴더에서 빌드·테스트 → 자기 원본 브랜치에 commit → push (단일 파일 `play/index.html` 도 다시 빌드해 함께 커밋 — 허브 빌드가 깨질 때의 대체본)
  2. GitHub MCP `actions_run_trigger`: `method: run_workflow`, `workflow_id: pages.yml`, `ref: main` (owner `bamtolking`, repo `MyGame`)
  3. `actions_list` `list_workflow_runs` (resource_id `pages.yml`)로 방금 실행이 `success` 인지 확인 (보통 2~4분).
     `cancelled` 면 뒤이어 시작된 가장 최근 실행을 확인한다(그 실행이 모든 원본 브랜치의 최신 커밋을 다시 받는다).
     `failure` 면 `get_job_logs` 로 원인을 보고 고친 뒤 다시 실행한다. 실행 요약(Summary)에 게임별로 배포된 커밋이 표로 나온다.
  4. 성공을 확인한 뒤 링크를 준다. 이 컨테이너에서는 `*.github.io` 에 접속할 수 없으므로(프록시 403) 배포 확인은 Actions 결과로 한다.
- **로블록스 게임**: 실행 파일(`.rbxlx`)을 다시 빌드해 원본 브랜치에 커밋 → 위 2~3 → 다운로드 페이지 링크 `https://bamtolking.github.io/MyGame/<slug>/` 를 주고,
  `SendUserFile` 로 실행 파일도 직접 보낸다. 휴대폰 로블록스 앱에서 하려면 Studio 에서 한 번 Publish 해야 한다는 점을 함께 알린다.
- **새 앱·게임**: `games.json` 에 live 항목을 추가하는 PR 을 main 으로 한 번 만들고(사용자가 병합), 그 뒤부터는 위 절차만 반복한다.

| 게임 | 주소 | 원본 브랜치 · 폴더 | 만든 채팅 |
|---|---|---|---|
| 심연의 군주 | `/MyGame/abyss/` | `claude/zen-lamport-5zzkqg` · `abyss/` (루트 `npm run abyss:build`) | 디아블로 같은 게임 만들기 |
| 미어캣 (AI 자세 분석) | `/MyGame/meerkat/` | `claude/dreamy-darwin-hxqjan` · `meerkat/` | 물리치료사/헬스트레이너 앱 기획 |
| 달빛 퇴마단 | `/MyGame/moonlit/` | `claude/nice-hypatia-xlm01y` · `mmorpg/` | MMO RPG 앱 기획 |
| 슬라임 하이스트! (로블록스, 다운로드) | `/MyGame/slime-heist/` | `claude/vigilant-brahmagupta-hf2k5b` · `roblox/build/SlimeHeist.rbxlx` | 로블록스 1위 게임 개발 |
| 냥체역학 | `/MyGame/nyang/` | `claude/determined-wright-wwlwgn` · `nyang/` | 대박 앱 아이디어 |
| 칼퇴 서바이버 | `/MyGame/kaltoe/` | `claude/zen-maxwell-uwcoq6` · `kaltoe/` | 게임 앱 개발 |

## 절대 규칙
1. **기존 게임을 삭제하거나 덮어쓰지 않는다.** `games/<slug>/` 폴더와 원본 브랜치(`claude/*`)는 사용자의 명시적 지시 없이는 지우거나 rebase/force-push 하지 않는다.
2. **작업 브랜치(`claude/*`)에서 작업하고 `main` 으로 Pull Request 를 만든다.** 게임 원본 브랜치나 다른 작업 브랜치에는 push 하지 않는다. 다른 브랜치의 게임을 가져올 때는 `git read-tree --prefix=games/<slug>/ -u origin/<branch>:<dir>` 로 복사한다(원본 불변).
   예외: live 게임은 복사하지 않고 배포 때 원본 브랜치를 읽기만 한다(`scripts/build-site.mjs` 가 `.live/<slug>/` 에 풀어 빌드). 게임 세션은 자기 원본 브랜치에만 push 한다.
3. **민감정보를 저장소·클라이언트 코드에 넣지 않는다.** API Key, Secret, Access Token, 비밀번호, 인증서, 관리자 키, `.env`. `.env*` 는 `.gitignore` 로 제외(`.env.example` 만 허용).
   외부 API 에 비밀키가 필요하면 프론트엔드에 키를 넣지 말고 서버 측(별도 백엔드/서버리스 함수)에서 호출하도록 설계한다.
4. **push 전에 반드시 검사한다:** `npm run check-secrets` (모든 브랜치의 모든 커밋 검사). 의심 항목이 나오면 push 를 중단하고 사용자에게 보고한다.
   과거 커밋에서 발견되면 **임의로 공개하거나 히스토리를 고치지 말고** 사용자에게 경고만 한다(공개 저장소이므로 히스토리 정리가 필요할 수 있음을 알린다).
5. 각 게임의 CSS·JS·이미지·사운드·manifest·service worker 경로는 `/MyGame/<slug>/` 아래에서 동작해야 한다: Vite 는 `base: './'`, HTML/manifest/SW 는 상대 경로, SW 캐시 이름은 게임 고유 접두어, localStorage 키는 게임 고유.
6. **`.github/workflows/pages.yml` 의 트리거에 작업 브랜치 이름을 넣지 않는다.** 트리거는 `on.push.branches: [main]` 하나뿐이어야 하며, `'**'` 같은 패턴이나 `claude/*` 브랜치를 추가하지 않는다.
   워크플로는 브랜치마다 자기 안의 파일을 따르므로, 작업 브랜치에 그런 트리거를 넣으면 그 브랜치에 push 할 때마다 Pages 배포가 시도되고 환경 규칙에 막혀 실패한다.
   GitHub Pages 를 배포하는 워크플로는 이 파일 하나로 통일하고, 배포는 `main` 병합 또는 `ref: main` 수동 실행(workflow_dispatch)으로만 일어나게 한다. 다른 이름의 Pages 배포 워크플로를 새로 만들지 않는다.
7. live 게임의 원본 `sw.js` 가 캐시를 먼저 보여 주거나 다른 게임의 캐시를 지우면 `games.json` 의 `live.hubSw: true` 로 허브 표준 워커(네트워크 우선, 자기 캐시만 관리)로 바꿔 배포한다.

## 게임 추가 흐름
- **프로토타입** (사용자가 휴대폰으로 테스트): `games/<slug>/` 에 독립 프로젝트로 넣고 `games.json` 에 항목 추가 → push 하면 허브에 자동 반영.
  프로토타입은 소스가 이 공개 저장소에 그대로 올라간다는 점을 사용자가 알고 있다(허용됨).
- **정식 개발 대상으로 지정되면** (사용자가 게임을 지목했을 때만):
  1. Private 저장소 `bamtolking/<slug>-dev` 를 만들고(사용자 승인 후) 원본 소스를 그곳으로 옮겨 개발한다.
  2. Private 저장소에 `templates/publish-to-hub.yml` 을 넣고, 토큰은 그 저장소의 Actions Secret(`HUB_PUSH_TOKEN`)으로만 보관한다.
  3. 허브의 `games.json` 항목을 `"build": { "prebuilt": true }` 로 바꾸고 `games/<slug>/` 에는 **빌드 결과물만** 둔다.
  4. 허브에 남아 있던 소스 사본은 사용자 지시가 있을 때만 제거하며, 과거 커밋에는 그대로 남는다는 점을 알린다.
- **live 게임** (개발이 계속되는 게임, 기본으로 권장): `games.json` 에 `"live": { "dir": "<브랜치 안 폴더>", "fallback": "play/index.html" }` 와 `build` 를 적는다.
  `games/<slug>/` 폴더는 만들지 않는다. 배포할 때마다 원본 브랜치의 최신 커밋을 빌드하므로 갱신 PR 이 필요 없다.
- 원본 브랜치가 갱신되면 허브 복사본(live 가 아닌 게임)은 자동으로 따라오지 않는다. 갱신은 `git rm -r games/<slug> && git read-tree --prefix=games/<slug>/ -u origin/<branch>:<dir>` (같은 게임의 새 버전으로 교체하는 것이며, 게임 삭제가 아니다).
- 새 게임은 기존 게임과 **분리**해서 관리한다(폴더·package.json·저장 키·SW 캐시 이름을 공유하지 않는다).

## 작업 후 확인 절차
1. `npm run build` → 모든 게임 빌드 성공, `_site/<slug>/index.html` 생성
2. `npm run preview` 로 `/MyGame/` 경로에서 각 게임이 404·콘솔 오류 없이 열리는지 확인(휴대폰 뷰포트)
3. `npm run check-secrets` 통과
4. commit → push → `main` 으로 PR 생성(사용자가 병합) → 병합 후 Actions "Deploy game hub to GitHub Pages" 의 build·deploy 잡 결과 확인
5. 사용자에게 허브 URL 과 게임별 URL(`?v=<커밋>` 포함)을 한국어로 보고
