# MyGame — 공개 게임 허브 운영 규칙 (Claude Code 세션용)

이 저장소(`bamtolking/MyGame`)는 **공개 게임 허브**입니다. 사람들이 링크만 받아 휴대폰/PC 브라우저에서 바로 게임을 플레이하는 용도이며,
GitHub Pages 로 `https://bamtolking.github.io/MyGame/` 에 배포됩니다. 허브 브랜치: `claude/game-hub-github-pages-09xp38`.
구조·빌드·배포 방법은 `README.md`, 게임 목록은 `games.json` 을 먼저 읽으세요.

## 절대 규칙
1. **기존 게임을 삭제하거나 덮어쓰지 않는다.** `games/<slug>/` 폴더와 원본 브랜치(`claude/*`)는 사용자의 명시적 지시 없이는 지우거나 rebase/force-push 하지 않는다.
2. **허브 브랜치에서만 작업하고 다른 브랜치에는 push 하지 않는다.** 다른 브랜치의 게임을 가져올 때는 `git read-tree --prefix=games/<slug>/ -u origin/<branch>:<dir>` 로 복사한다(원본 불변).
3. **민감정보를 저장소·클라이언트 코드에 넣지 않는다.** API Key, Secret, Access Token, 비밀번호, 인증서, 관리자 키, `.env`. `.env*` 는 `.gitignore` 로 제외(`.env.example` 만 허용).
   외부 API 에 비밀키가 필요하면 프론트엔드에 키를 넣지 말고 서버 측(별도 백엔드/서버리스 함수)에서 호출하도록 설계한다.
4. **push 전에 반드시 검사한다:** `npm run check-secrets` (모든 브랜치의 모든 커밋 검사). 의심 항목이 나오면 push 를 중단하고 사용자에게 보고한다.
   과거 커밋에서 발견되면 **임의로 공개하거나 히스토리를 고치지 말고** 사용자에게 경고만 한다(공개 저장소이므로 히스토리 정리가 필요할 수 있음을 알린다).
5. 각 게임의 CSS·JS·이미지·사운드·manifest·service worker 경로는 `/MyGame/<slug>/` 아래에서 동작해야 한다: Vite 는 `base: './'`, HTML/manifest/SW 는 상대 경로, SW 캐시 이름은 게임 고유 접두어, localStorage 키는 게임 고유.

## 게임 추가 흐름
- **프로토타입** (사용자가 휴대폰으로 테스트): `games/<slug>/` 에 독립 프로젝트로 넣고 `games.json` 에 항목 추가 → push 하면 허브에 자동 반영.
  프로토타입은 소스가 이 공개 저장소에 그대로 올라간다는 점을 사용자가 알고 있다(허용됨).
- **정식 개발 대상으로 지정되면** (사용자가 게임을 지목했을 때만):
  1. Private 저장소 `bamtolking/<slug>-dev` 를 만들고(사용자 승인 후) 원본 소스를 그곳으로 옮겨 개발한다.
  2. Private 저장소에 `templates/publish-to-hub.yml` 을 넣고, 토큰은 그 저장소의 Actions Secret(`HUB_PUSH_TOKEN`)으로만 보관한다.
  3. 허브의 `games.json` 항목을 `"build": { "prebuilt": true }` 로 바꾸고 `games/<slug>/` 에는 **빌드 결과물만** 둔다.
  4. 허브에 남아 있던 소스 사본은 사용자 지시가 있을 때만 제거하며, 과거 커밋에는 그대로 남는다는 점을 알린다.
- 새 게임은 기존 게임과 **분리**해서 관리한다(폴더·package.json·저장 키·SW 캐시 이름을 공유하지 않는다).

## 작업 후 확인 절차
1. `npm run build` → 모든 게임 빌드 성공, `_site/<slug>/index.html` 생성
2. `npm run preview` 로 `/MyGame/` 경로에서 각 게임이 404·콘솔 오류 없이 열리는지 확인(휴대폰 뷰포트)
3. `npm run check-secrets` 통과
4. commit → push → Actions "Deploy game hub to GitHub Pages" 의 build·deploy 잡 결과 확인
5. 사용자에게 허브 URL 과 게임별 URL 을 한국어로 보고
