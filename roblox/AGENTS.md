# 저승 휴게소 (roblox/) — 에이전트 작업 규칙

## 한 줄 요약
저승 가는 길목의 분식집. 귀신 손님에게 원하는 음식을 제때 내주지 못하면 악귀가 되어 주방을 부순다. 2~6인 협동 요리 디펜스. 지도·손님·UI 를 전부 스크립트가 파츠로 만들어 에셋 없이 `.rbxlx` 하나로 실행된다.

## 도구 설치 (새 환경에서 처음 한 번)
```bash
bash roblox/scripts/setup-tools.sh      # rojo, luau, luau-lsp, lune, globalTypes.d.luau → roblox/.tools/ (인터넷 필요)
```
Codex 클라우드 환경이면 "설정 스크립트" 에 위 한 줄을 넣는다. Windows 는 WSL 에서 실행한다. `.tools/` 는 gitignore 대상이다.

## 검증 파이프라인 (커밋 전 필수)
```bash
cd roblox && ./build.sh
```
`build.sh` 는 순서대로 (1) 순수 로직 테스트 `tests/run.sh`, (2) Roblox API 타입 검사 `luau-lsp analyze` (+Rojo 소스맵), (3) 도우미 속성 이름 검사 `tests/check_props.py`, (4) `rojo build` → `build/GhostDiner.rbxlx`, (5) `lune` 이 있으면 헤드리스 통합 시뮬레이션 `tests/sim/run.luau` (약 2~3분, 90개 검증) 를 돌린다. 하나라도 실패하면 커밋하지 않는다.

시뮬레이션은 물리·렌더링·네트워크가 없는 흉내 환경(`tests/sim/rbx.luau`)이다. 손님 이동은 직선, 트윈은 즉시 적용, DataStore 는 메모리. "보이는 모습" 은 Studio 에서 사용자가 확인한다. Studio 에서 플레이하면 게임 안의 자가 진단(`SelfTest.server/client`)이 출력 창에 ✅/❌ 요약을 남기니, 사용자에게 그 요약을 받아 판단한다.

## 폴더 구조
```
default.project.json   Rojo 프로젝트. src/shared → ReplicatedStorage.GhostDiner, src/server → ServerScriptService.GhostDinerServer,
                       src/client → StarterPlayer.StarterPlayerScripts.GhostDinerClient
src/shared/            데이터·순수 로직 (--!strict). Config, Recipes, CustomerTypes, Waves, Upgrades, Combo, Events, Challenges,
                       Cosmetics, Talismans, Relics, Reviews, ItemVisuals(파츠 조립, 서버·클라 공용)
src/server/            Main(진입점), MapBuilder, Stations, Customers, Items, GameLoop, Shop, Data, Wardrobe, Remotes, GameState, SelfTest
src/client/            Main, Hud, Panels, Labels, Fx, Tutorial, Sfx, SelfTest
tests/                 *_test.luau (Luau CLI), check_props.py, sim/(Lune 통합 시뮬레이션), studio/(run-in-roblox)
build/GhostDiner.rbxlx 사용자가 여는 산출물 (커밋함)
docs/                  DESIGN.md(설계·수치), HANDOFF.md(인수인계)
```

## 코드 관례
- 파일 이름: `X.luau` = ModuleScript, `X.server.luau` = Script, `X.client.luau` = LocalScript (Rojo 규칙).
- `src/shared` 는 `--!strict`, 서버·클라이언트는 `--!nonstrict`. 필드 선언에 타입 주석을 붙이지 않는다 (`T.x: type = …` 는 문법 오류). `local list: {T} = …` 뒤에 `T.List = list` 로 노출한다.
- 상태 복제는 Attribute 로 한다: 게임 상태는 `ReplicatedStorage.GhostDinerState` 의 Attribute, 조리대·손님 상태는 파츠/모델의 Attribute. 클라이언트는 `workspace:GetServerTimeNow()` 와 `DoneAt/DeadlineAt` 같은 시각 값으로 진행 바를 스스로 계산한다. 늦게 들어온 플레이어도 즉시 동기화된다.
- 서버가 모든 판정을 한다. 클라이언트→서버 통신은 ProximityPrompt(내장), `Buy`/`SetHat`(RemoteFunction), `Ready`/`UseTalisman`/`RelicVote`(RemoteEvent) 뿐이다. 새 통신은 `Remotes.luau` 에 추가하고 서버에서 인자 타입을 검사한다.
- 서버→클라이언트 연출·알림은 `Remotes.Notify` 로 `{ kind = "...", ... }` 페이로드를 보내고 `client/Main.client.luau` 의 핸들러에서 분기한다.
- 플레이어는 한 손에 한 가지만 든다 (Tool, Backpack UI 숨김). `Items.getHeldId/give/take/replace` 만 쓴다.
- 소리는 `rbxasset://sounds/…` 내장 파일만 쓴다. 승인되지 않은 파일이 있으므로(예: swoosh.wav) `Sfx.luau` 가 시작 시 PreloadAsync 로 실패한 소리를 대체음으로 바꾼다. 검증된 파일: electronicpingshort.wav, impact_water.mp3, victory.wav, HalloweenLightning.wav.
- UI 는 코드로 만든다(`Hud.luau` 의 `mk`/`label` 도우미). 오른쪽 위에는 로블록스 플레이어 목록이 있으니 그 아래/왼쪽으로 띄운다. 모바일 점프 버튼(오른쪽 아래)과 조이스틱(왼쪽 아래)을 피한다.
- 문자열은 한국어. 이모지는 UI 라벨에만 쓰고 파츠 이름에는 쓰지 않는다.
- 새 수치는 `Config.luau` 에, 새 요리·손님·이벤트·목표·유물은 각 shared 모듈의 목록에 데이터로 추가한다 (레시피 설명은 `Recipes.describe` 가 자동 생성).

## 자주 하는 작업 방법
- **요리 추가**: `Recipes.luau` 의 `itemList` 에 재료(raw)·중간(mid)·완성(dish) 항목과 `comboList`/`cookList`/`Pound` 규칙을 추가. 새 원재료면 `CrateItems` 에도 넣고 `MapBuilder` 의 상자 배치(뒷벽 X 간격 8)를 조정. `tests/recipes_test.luau` 가 도달 가능성을 검사한다.
- **손님 추가**: `CustomerTypes.luau` 에 항목(`look.feature` 는 `Customers.buildRig` 의 분기와 맞춤). `Waves.plan` 이 밤별 가중치로 뽑는다.
- **밤 이벤트·목표·유물·부적 추가**: 각 shared 목록에 항목 추가 후, 효과가 적용되는 곳(`GameLoop.onServed`, `Stations`, `Customers.spawn`) 에 분기 추가. 테스트도 함께 갱신.
- **연출 추가**: 서버는 `Remotes.notifyAll({kind=...})`, 클라이언트는 `Fx.luau` 에 함수 추가 후 `Main.client.luau` 핸들러에서 호출.
- **시뮬레이션 시나리오 확장**: `tests/sim/run.luau` 에 `check(...)` 를 추가. 새 리모트·서비스 메서드를 쓰면 `tests/sim/rbx.luau` 에 흉내 구현을 추가해야 할 수 있다.

## 알아 둘 함정
- Lune 은 같은 인스턴스라도 접근할 때마다 새 userdata 를 준다. 시뮬레이션 코드에서 인스턴스를 테이블 키로 쓰지 말고 `GetDebugId()` 를 쓴다. (게임 코드가 인스턴스를 키로 쓰는 것은 실제 Roblox 에선 문제없다.)
- Lune 에서 `Part.Position` 은 `CFrame` 에서 파생되지 않는다. 흉내 환경의 `setCF` 가 둘 다 맞춘다.
- Roblox 에서 `Humanoid.RequiresNeck = false` 를 빼면 목 관절 없는 손님 리그가 즉시 죽는다.
- 손님은 충돌 그룹 `Customers` 라 카운터·조리대·플레이어를 통과한다(귀신). 바닥과는 충돌한다.
- `string.format("%d", x)` 에 정수가 아닌 값을 주면 오류가 난다. 보상·게이지 계산은 `math.floor(... + 0.5)` 로 정수화한다.

## 완료 기준
1. `./build.sh` 전부 통과 (시뮬레이션 90개 검증 포함).
2. `build/GhostDiner.rbxlx` 재생성 후 커밋.
3. 사용자에게 바뀐 점, 확인이 필요한 점(Studio 에서 눈으로 볼 것), 다음 제안을 쉬운 말로 보고. README/DESIGN/HANDOFF 갱신.
