# MyGame — 에이전트 안내 (Codex · Claude Code 공통)

이 저장소에는 게임이 두 개 있습니다.

| 폴더 | 게임 | 상태 |
|---|---|---|
| `roblox/` | **저승 휴게소** — 로블록스 협동 요리 디펜스 (Rojo + Luau) | **현재 주력. 이어서 작업할 대상** |
| 루트 (`src/`, `play/`) | 대박수비대 — 브라우저 타워디펜스 (TypeScript + Vite) | 완료된 별개 프로젝트. 건드릴 때만 `npm test` |

## 먼저 읽을 것 (순서대로)
1. `roblox/AGENTS.md` — 로블록스 프로젝트의 규칙, 도구 설치, 검증 파이프라인, 코드 관례
2. `roblox/docs/HANDOFF.md` — 지금까지의 상태, 설계 결정, 남은 일
3. `roblox/README.md`, `roblox/docs/DESIGN.md` — 사용자용 설명과 설계 메모
4. `roblox/docs/CHAT_HISTORY.md` — 지금까지 사용자와 나눈 대화 전문 (요구사항의 원문과 맥락)

## 공통 규칙
- 사용자는 비개발자에 가깝습니다. 보고는 쉬운 한국어로, 결과물은 "다운로드해서 바로 여는 파일" 형태를 유지합니다.
- 코드 주석·문서·커밋 메시지는 한국어로 씁니다.
- 커밋 전에 반드시 해당 프로젝트의 검증 파이프라인을 통과시킵니다 (로블록스: `cd roblox && ./build.sh`).
- `roblox/build/GhostDiner.rbxlx` 는 생성물이지만 커밋 대상입니다 (사용자가 Studio 로 바로 열기 때문). 손으로 편집하지 말고 `rojo build` 로 다시 만들어 커밋합니다. CI 가 소스와 일치하는지 검사합니다.
- 브랜치: 최신 작업은 `claude/roblox-coop-game-idea-kcarfh` 에 있습니다. 기본 브랜치(`claude/session-xitrmc`)는 로블록스 작업 이전 상태입니다.
- 외부 에셋(메시·이미지·오디오 ID)에 의존하지 않습니다. 모든 것은 파츠·파티클·내장 사운드로 만듭니다.
