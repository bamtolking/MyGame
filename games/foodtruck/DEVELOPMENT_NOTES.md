# DEVELOPMENT_NOTES — 괴물 포장마차: 합치고 팔자!

다음 작업자가 이어갈 수 있도록 현재 상태를 기록한다. (2026-09-17, 첫 웹 베타)

## 1. 프로젝트 위치와 기술

- 저장소 루트에는 별개의 게임(`대박수비대`, 루트 `src/`)이 있다. 이 게임은 **`monster-stall/` 하위 폴더의 독립 프로젝트**이며 루트 파일을 수정하지 않았다(루트 README에 안내 문단만 추가).
- TypeScript 5.9 + Vite 7.3 + Vitest 5.0 + playwright-core 1.63 (루트 프로젝트와 같은 고정 버전). Node 22.
- Phaser는 검토했지만 채택하지 않았다: 주문 카드·보드·버튼 등 UI 비중이 큰 게임이라 DOM + Canvas 2D가 가볍고(번들 112KB), 루트 프로젝트와 같은 구조라 유지보수가 쉽다. 가게 장면만 Canvas로 그린다.
- 외부 자산 없음: 아이콘은 `src/render/icons.ts`의 SVG 문자열, 손님·직원은 `src/render/store.ts`의 Canvas 도형, 효과음은 `src/platform/audio.ts`의 WebAudio 합성.

## 2. 폴더 구조

```
monster-stall/
  index.html, vite.config.ts, tsconfig.json, package.json
  src/main.ts                앱 부팅 + 디버그 노출(window.__app, window.__dbg)
  src/style.css              모바일 세로 우선 레이아웃
  src/data/
    balance.ts               시간(180/150초), 보드(5×5, 최대 4단계, 시작 음식), 대기줄 3명, 직원 속도·배율, 장식(+5/상한 10초),
                             팁 비율 기준(60%/30%), 상점 가격, 저장 키·주기
    foods.ts                 3계열 × 4단계 이름·가격·설명
    customers.ts             손님 6종: 선호 계열·확률, 단계 성향, 2개 주문 확률, 대기줄/주문 인내, 원료당 인내, 식사 시간, 팁 비율
    days.ts                  영업일 5개 + 연습: 활성 단계, 단계 가중치, 원료량 상한, 손님 수·가중치, 도착 간격/버스트/쌍, 계열 편향,
                             인내 배율, 목표 서빙, 2별 규칙, 도전 수입, 날씨(연출)
    store.ts                 6×4 격자, 배식구 (0,0), 출입구 (5,3), 기본 배치(좌석 2)
  src/sim/
    rng.ts                   sfc32 결정적 난수 (판정용). 시각 효과는 Math.random
    types.ts                 저장 가능한 순수 상태 타입 (RunState, MetaState, Customer, Staff …)
    board.ts                 생성(빈칸 규칙: 아래 행부터 왼쪽→오른쪽), 합성, 이동, 정리, 후보, 주문용 인스턴스 선택
    store.ts                 배치 검증(겹침·고정칸·좌석 수·경로 존재·배식구↔출입구 통로), BFS 경로, 장식 보너스, 가구 이동/추가
    orders.ts                주문 생성(선호 × 영업일 단계 가중치 × 손님 성향, 원료량 상한 적용), 도착 일정(버스트·쌍·150초 이전 보정)
    run.ts                   createRun, tick(dt), closeRun, 플레이어 조작(actSpawn/Merge/Move/Discard/Accept/Abort),
                             손님 상태기계, 직원 상태기계, 결제(전달 시점), 팁 확정(접수 시점)
    result.ts                집계·별·해금·기록 기반 조언
    meta.ts                  영구 데이터: 정산(실행 ID당 1회), 구매·강화(중복 방지), 배치 이동/초기화, 최고 기록
    save.ts                  직렬화, 스키마 검증(보드 25칸·ID 중복·장부 합계 일치 등), 손상 보고
  src/render/icons.ts, store.ts
  src/ui/app.ts (코어·루프·저장·일시정지·대화상자·제목·영업일·결과), prep.ts (배치), run.ts (영업), help.ts, dom.ts
  src/platform/storage.ts, audio.ts
  tests/  board, orders, store, run, experiments(A/B/C), economy, save, balance(스윕)
  scripts/singlefile.mjs (play/index.html), e2e.mjs (Playwright)
  docs/balance-results.md (자동 생성)
```

## 3. 주요 게임 규칙 (구현 기준)

- **시간**: 고정 스텝 1/30초. 프레임당 실제 경과는 0.25초로 상한(백그라운드 복귀 시 한꺼번에 처리 방지). 180초 영업, 150초 신규 손님 중단. 180초에 `closing`: 대기줄·이동 중·주문 대기 손님은 `closed`로 집계, 접수된 서빙만 마무리 후 `ended`.
- **보드**: 25칸, 음식은 고유 ID. 같은 계열·같은 단계·다른 인스턴스만 합성, 결과는 두 번째 칸. 그날 `maxTier` 이상은 합성 불가. 생성은 1단계만, 코인 소모 없음. 시작 음식 6개는 `startFoodsGiven` 플래그로 1회. 연습 영업은 시작 음식 없음.
- **손님 상태**: `queued → walking → ordering → accepted → eating → leaving → gone`, 이탈 사유 `full | queue_timeout | order_timeout | closed | served`. 대기줄 인내와 주문 인내는 별도 변수. 착석 시 주문 인내 = (기본 + 원료당 × (원료량−1)) × 영업일 배율 + 좌석 장식 보너스.
- **접수(actAccept)**: `ordering` 상태만 가능. `pickFoodsFor`로 정확한 계열·단계·수량의 인스턴스를 고르고(높은 단계 대체 없음), 모두 존재하는지 재확인 후 한 번에 제거, `reservedFoodIds` 기록, 서빙 대기열 push, 팁 배율 확정, 인내 정지. 같은 손님 재접수는 거부.
- **직원**: `idle → pickup(0.5s) → toSeat(경로/속도) → handoff(0.6s) → returning → idle`. 전달 시점(`deliver`)에만 장부 기록(판매액·팁·전달 목록·메뉴별 판매 수). 속도 = 2.0칸/초 × [1, 1.15, 1.30].
- **경로**: BFS 4방향, 가구 칸 통과 불가. 좌석 옆(상하좌우) 통행 가능 칸이 목표. 배치 확정 시 배식구·출입구에서 모든 좌석 경로 + 배식구↔출입구 통로가 있어야 한다.
- **정산**: `settleRun`은 `run.settled` 또는 `meta.settledRunIds`에 있으면 무시. 연습(`practice`)은 코인 없음. 목표 달성 시 `unlockedDay` 갱신, 최고 기록은 max로만 갱신.
- **저장**: `monster-stall.save.v1` 키에 `{v, savedAt, screen, meta, run}` 한 덩어리. 영업 중 3초 주기 + 주요 조작 후. 복원은 일시정지로 시작. `parseSave`가 구조·장부 일치를 검증하고 실패 시 손상 안내 + 초기화 경로.

## 4. 밸런스 데이터 위치

- 모든 수치는 `src/data/*.ts`. 영업일 조정은 `days.ts`, 손님 성격은 `customers.ts`, 가격·시간·팁 기준은 `balance.ts`, 메뉴 가격은 `foods.ts`.
- `npm run balance`로 봇 스윕을 다시 돌리면 `docs/balance-results.md`가 갱신된다. 봇 프로필(초보/보통/빠름)과 가게 조건(기본/강화)이 표로 나온다.

## 5. 구현 완료 / 미완료

완료:
- 흐름 전체: 영업 준비(배치·구매·목표 확인) → 손님 입장·대기줄·착석·주문 → 생성·합성·이동·정리 → 접수 → 직원 실제 이동·전달 → 결제·식사·퇴장 → 마감·정산 → 해금·재도전 → 다른 조건의 영업일.
- 메뉴 12종, 손님 6종(선호·인내·식사·팁 데이터 실제 사용), 영업일 5개 + 연습, 좌석 2~4, 장식 2, 직원 속도 2단계.
- 드래그 없는 조작, 길게 누르기 연속 생성(손 떼기·백그라운드·보드 가득 시 정지), 합성 후보·필요 음식 강조, 음식 정보줄, 정리 확인창.
- 일시정지(모든 시간 정지, 메뉴 조작 가능), 백그라운드 자동 정지 + 복귀 확인, 저장/이어하기/손상 처리, 마감하고 돌아가기.
- 연습 영업(6단계 안내, 건너뛰기), 배치 화면 첫 안내, 도움말(손님·메뉴·규칙), 설정(음량·음소거·저장 초기화).
- 절차적 그래픽(음식 12종 실루엣 구분, 손님 6종 동작 구분, 가게 성장 외형: 간판 2일차, 조명 3일차, 테이블 촛불 4일차, 직원 장비 변화), 효과음 15종.
- 결과 화면(실제 판매액·팁·서빙·이탈 종류별·최다 메뉴·별·해금·기록 기반 조언).

미완료·제한:
- 실제 휴대폰 기기 테스트는 하지 않았다(헤드리스 Chromium 모바일 뷰포트 3종만). iOS Safari의 오디오 잠금·100dvh 동작은 미확인.
- Android/iOS 앱 패키징 없음(Capacitor 등 향후 검토). PWA 매니페스트/서비스워커 없음.
- 드래그 조작 없음(의도적으로 첫 버전 제외).
- 직원과 손님의 충돌·통로 막힘 없음(서로 통과, 의도적).
- 손님이 두 명 함께 오는 연출은 도착 시각만 동일(손잡기 등 시각 연출 없음).
- 배경 음악 없음(효과음만).
- 가로 화면 레이아웃은 별도 최적화하지 않았다(세로 우선; 700px 이상 폭에서는 중앙 520px 컬럼).

## 6. 실행 명령

`npm install`, `npm run dev`(5174), `npm run typecheck`, `npm run test`, `npm run balance`, `npm run build`, `npm run e2e`. e2e는 `/opt/pw-browsers/chromium-1194/...` 경로의 Chromium을 기본으로 쓰며 `CHROME_PATH` 환경변수로 바꿀 수 있다.

## 7. 디버그 노출

`window.__app`(App 인스턴스: `state`, `timeScale` 배속, `persist()`, `show()`), `window.__dbg`(actSpawn/actMerge/actAccept/actMove/actDiscard/orderReady/tick/countByKey). e2e 스크립트가 사용한다. 게임 규칙에는 영향이 없지만 배포판에서 제거하려면 `src/main.ts`의 두 줄을 지우면 된다.

## 8. 남은 문제·다음 작업 후보

1. 실제 휴대폰에서 터치 반응·글자 크기·오디오 확인 후 조정.
2. 밸런스: 봇은 주문 대기 이탈이 거의 0이라 인내 시간의 실제 압박은 사람 플레이로 확인해야 한다. 4일차 도전 수입(450)과 5일차(360)는 강화 가게 기준으로 빠듯하게 잡았다.
3. 결과 화면 조언은 임계값 기반이라 표현이 단조로울 수 있다.
4. 카드가 4장일 때 가로 스크롤이 필요하다(오른쪽 페이드로 표시). 더 작은 화면에서는 카드 폭 108px로 줄어든다.
5. 저장 버전 업그레이드 경로(v1 → v2 마이그레이션)는 아직 없다. 구조를 바꾸면 `SAVE.version`을 올리고 `parseSave`에 변환을 추가할 것.
