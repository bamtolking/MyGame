# MyGame — 에이전트 안내 (Codex / Claude / 사람 공용)

이 저장소에는 서로 독립적인 HTML5 게임 두 개가 있습니다. 작업 요청에 게임 이름이 없으면 **데이헝거**(`dayhunger/`)를 뜻합니다.

| 게임 | 위치 | 스택 | 상세 안내 |
| --- | --- | --- | --- |
| **데이헝거** (벽 짓고 살아남기, 협동 생존, 안드로이드 앱) | `dayhunger/` | 순수 JS ESM + Node `ws` 서버 + Capacitor, 빌드 단계 없음 | `dayhunger/AGENTS.md`, `dayhunger/docs/HANDOFF.md` |
| 대박수비대: 합성 대폭주 (타워 디펜스, 싱글) | 저장소 루트 `src/`, `play/` | TypeScript + Vite + Vitest | `README.md` 아래쪽 |

## 공통 규칙
- UI 문구, 주석, 커밋 메시지는 **한국어**로 씁니다. 코드 식별자는 영어입니다.
- 두 프로젝트는 서로의 파일을 import 하지 않습니다. 루트 `package.json`은 대박수비대 전용, `dayhunger/package.json`은 데이헝거 전용입니다.
- 변경 후에는 해당 프로젝트의 검증 명령을 반드시 실행합니다.
  - 데이헝거: `cd dayhunger && npm run verify` (규칙 테스트 + 브라우저 e2e. 브라우저가 없으면 e2e는 "건너뜀"으로 표시되고 실패로 치지 않음)
  - 대박수비대: `npx vitest run tests/rules.test.ts`
- `dayhunger/android/` 는 Capacitor가 생성한 안드로이드 프로젝트입니다. `android/app/src/main/assets/`와 `www/`는 생성물이라 커밋하지 않습니다. 서명 키 `android/keystore/dayhunger.jks`는 의도적으로 커밋되어 있습니다(모든 빌드가 같은 키).
- APK는 로컬에서 만들지 않아도 됩니다. `dayhunger/**`가 바뀐 커밋을 푸시하면 GitHub Actions(`.github/workflows/dayhunger-android.yml`)가 빌드해 릴리스 태그 `dayhunger-latest`의 `dayhunger.apk`를 갱신합니다.

## 브랜치
- 최신 작업 브랜치: `claude/starcraft-eud-mobile-game-1ytq58` (데이헝거 전체가 여기에 있음).
- 저장소 기본 브랜치는 `claude/session-xitrmc` 이며 데이헝거가 없습니다. 이어서 작업할 때는 위 작업 브랜치를 기준으로 하거나, 먼저 기본 브랜치에 머지하세요.
