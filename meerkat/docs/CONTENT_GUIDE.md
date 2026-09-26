# 전문가용 콘텐츠 가이드

이 앱의 “전문성”은 코드가 아니라 **데이터 파일 몇 개**에 모여 있어요.
물리치료사·트레이너인 대표가 직접 고칠 수 있도록 정리했어요. 파일을 고친 뒤 `npm test` 로 이상이 없는지 확인하세요.

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 자세 판정 기준(정상/경미/주의/심함 경계), 점수 가중치, 자세 나이 공식 | `src/analysis/norms.ts` |
| 운동 이름·방법·코칭 멘트·실수·주의·처방 용량·대상 문제·시범 동작 | `src/content/ex/<부위>.ts`, `src/content/ex/<부위>-plus.ts` |
| 체형 유형(거북·새우·오리·플라밍고·미어캣) 설명, 짧아진/약해진 근육, 한마디 | `src/content/types.ts` |
| 측정 항목 이름·설명 문장 | `src/content/metrics.ts` |
| 오늘의 팁 | `src/content/tips.ts` |
| 위험 신호·주의 항목, 1분 리셋 구성, 루틴 시간 구성 | `src/routine/generator.ts` |
| 대표 이름·자격·소개, 앱 이름 | `src/config.ts` |

## 1. 판정 기준 보정 (`norms.ts`)

```ts
headForward: { view: 'side', unit: 'deg', pos: [12, 18, 25], weight: 1.4 },
//                                           ↑경미 ↑주의 ↑심함 경계
```
- `pos`는 양의 방향(예: 머리가 앞으로), `neg`는 음의 방향 경계예요. 없으면 그 방향은 평가하지 않아요.
- `weight`가 클수록 점수에 크게 반영돼요.
- **추천 보정 방법**: 회원 20~30명을 앱으로 찍고, 직접 평가(각도계·육안 평가)와 비교해 경계값을 옮기세요.
  마이 > **전문가 모드**를 켜면 리포트 맨 아래에 원시 측정값이 나와요.

측정 정의(요약)
| 지표 | 정의 |
|---|---|
| 머리 전방 각도 | 옆모습에서 어깨 관절 → 귀 선이 수직선에서 앞으로 기운 각도 |
| 어깨 전방 거리 | 어깨 관절이 고관절보다 앞에 있는 거리(cm, 키로 환산) |
| 골반 앞쏠림 | 고관절이 수직선(외측 복사뼈 약간 앞)보다 앞/뒤 |
| 무릎 신전 | 고관절-무릎-발목 각도, 뒤로 꺾이면 +(과신전) |
| 등 굽음·허리 곡선 지수 | 몸 윤곽선에서 C7~L1, L1~S2 구간의 휜 깊이 ÷ 길이 ×100 (가상 Flexicurve) |
| 어깨·골반·머리 기울기 | 정면에서 좌우 점을 잇는 선의 기울기 |
| 몸통·체중 치우침 | 어깨 중심-골반 중심, 골반 중심-두 발 중심의 좌우 거리 |
| 무릎 정렬 | 정면 고관절-무릎-발목 편차, +는 X다리 경향 |

## 2. 운동 추가·수정

운동은 부위별 파일에 있어요: `src/content/ex/<부위>.ts`(기본 동작)와 `src/content/ex/<부위>-plus.ts`(추가 동작).
부위: `neck` `shoulder` `thoracic`(가슴·흉추) `core`(호흡·코어) `lowback` `hip` `legs`(무릎·하체) `ankle`(발목·발·균형·손목), 그리고 풀기 동작 모음 `release-plus`.
등록은 `src/content/exercises.ts` 의 `REGION_FILES` 가 자동으로 해요.

운동 하나는 아래처럼 한 덩어리예요. **가장 좋은 예시는 `src/content/ex/neck.ts` 의 `chin-tuck`** 이에요 — 새로 쓸 때 그대로 따라 하세요.
```ts
{
  id: 'chin-tuck',                         // 영문 소문자-하이픈 고유 이름 (바꾸지 마세요: 기록과 연결됨)
  name: { ko: '턱 당기기', en: 'Chin tuck' },
  phase: 'activate',                       // breath | release | stretch | mobility | activate | integrate
  position: 'seated',                      // standing | seated | wall | supine | prone | quadruped | sideLying | kneeling
  regions: ['neck'],                       // neck shoulder upperBack chest lowBack core hip glute knee ankle wrist fullBody
  targets: { fhp: 1, neckPain: 0.7 },      // 겨냥하는 문제와 관련도(0~1) → 처방 점수
  equipment: [],                           // wall | chair | towel | mat | foamRoller | band | ball
  level: 1,                                // 1~3 (사용자 레벨 이하만 처방)
  dose: { kind: 'reps', sets: 2, value: 10, tempo: 2, holdSec: 5, rest: 15 },
  desk: true,                              // 사무실(의자·서서)에서 가능하면
  setup, steps, breathing, feel, easier, harder, cues, mistakes, why, muscles, caution,  // 문구 (아래 기준)
  avoid: ['neckSevere'],                   // 이 상태면 처방 제외
  anim: { ... },                           // 시범 애니메이션 (3번)
  coach: { ... },                          // (선택) AI 카메라 코칭 (4번)
}
```
- `targets` 문제 이름: `fhp`(거북목) `roundShoulder` `kyphosis` `lordosis` `flatBack` `swayback`
  `kneeHyperext` `kneeFlexed` `headTilt` `shoulderTilt` `pelvicTilt` `lateralShift` `kneeValgus` `kneeVarus`
  `neckPain` `shoulderPain` `upperBackPain` `lowBackPain` `hipPain` `kneePain` `wristPain` `headache` `stiffness` `stress`
- `avoid` 상태: `neckSevere` `shoulderSevere` `lowBackSevere` `kneeSevere`(통증 7점 이상),
  `kneePain` `wristPain`(4점 이상), `radiating`(방사통) `pregnant` `dizzy` `balance` — 보수적으로 붙이세요.
  (엎드리기·배에 힘주기 → `pregnant`, 한 발 서기·눈 감기 → `balance`, 목 젖히기·빠른 회전 → `dizzy`, 손바닥 짚기 → `wristPain`, 깊은 무릎 굽힘 → `kneePain`)

### 문구 작성 기준 (따라 하기 쉬운 수준으로 구체적으로)
| 칸 | 기준 |
|---|---|
| `setup` | 시작 자세 2~4줄. **발 너비·무릎 각도·손 위치·척추·시선**을 숫자와 기준점으로 (“발은 골반 너비”, “무릎 90도”, “손목은 어깨 바로 아래”) |
| `steps` | 동작 순서 4~6줄, 한 줄에 한 동작. 움직이는 방향·거리·시간(“2초에 걸쳐”, “1~2cm”, “5초 버티기”)과 반복 수를 넣기 |
| `breathing` | 언제 들이마시고 내쉬는지 (힘쓰는 구간에 내쉬기가 기본, 스트레칭은 내쉴 때 조금 더) |
| `feel` | 어디가 늘어나거나 힘이 들어가야 정답인지 + 이런 느낌이면 멈추라는 신호(찌릿함·저림·날카로운 통증) |
| `easier` | 아프거나 버거울 때 구체적 대안(자세 바꾸기, 범위 줄이기, 다른 운동 이름) |
| `harder` | 익숙해졌을 때 진행 방법(시간·횟수·자세·다른 운동) |
| `cues` | 운동 중 음성으로 읽는 짧은 말 3~4개 (한국어 12자 안팎, 행동 중심) |
| `mistakes` | 흔한 실수 3~4개를 **“실수 → 고치는 법”** 형식으로 (영어도 `→` 포함) |
| `why` | 어떤 자세 문제에 왜 좋은지 1~2문장 |
| `muscles` | 주로 쓰는 근육 (한국어 해부학 이름) |
| `caution` | 필요할 때 멈춰야 할 신호·금기 |

- 모든 목록은 `ko`, `en` 줄 수가 같아야 해요. 한국어는 해요체, 친근하고 구체적으로. “진단·치료·완치” 같은 의료 표현 금지.
- 처방 용량 기준: 스트레칭 버티기 20~45초 × 2세트(한쪽씩이면 `perSide: true`), 깨우기 8~15회 × 2~3세트(`holdSec` 2~5초),
  움직이기 8~12회 또는 45~60초, 호흡 60~120초(`kind: 'time'`), 통합 8~12회 × 2~3세트. 휴식 `rest` 10~30초.
- **비슷한 동작 묶음** (`src/routine/families.ts`): 이미 있는 동작과 같은 근육을 거의 같은 방식으로 쓰는 변형(예: 4자 스트레칭 ↔ 누워서 엉덩이 늘리기,
  Y·T·W 들기)을 추가했다면 같은 묶음에 id를 넣어 주세요. 한 루틴에는 묶음마다 하나만 들어가고, 날마다 묶음 안에서 돌아가며 골라져요.

## 3. 시범 애니메이션 만들기

키프레임(자세)을 적으면 사이를 부드럽게 이어 줘요. **동작에 단계가 있으면 키를 3~4개로** 나눠 따라 하기 쉽게 하세요
(예: 준비 → 손을 머리에 얹기 → 기울여 늘리기, 또는 시작 → 들어 올리기 → 최고점 버티기).
```ts
anim: {
  view: 90,                      // 카메라: 0 정면, 90 옆(사람이 화면 오른쪽을 봄), 20~45 비스듬히, 음수는 반대 비스듬
  elev: 10,                      // 카메라 높이각(누운 자세는 10~20)
  props: [{ kind: 'chair' }],    // mat | wall | chair | band | towel | roller | ball | step | table
  keys: [ 시작자세, 중간자세, 끝자세 ],
  labels: [ {ko:'바르게 앉기', en:'Sit tall'}, ... ],   // 키마다 자세 이름(화면 자막) — keys 와 개수 같게, 한국어 12자 안팎
  durations: [1.2, 1.2, 1.2],    // 각 키에서 다음 키로 가는 시간(초) — 마지막은 처음으로 돌아가는 시간
  pauses: [0.6, 0.4, 2.5],       // 각 키에서 멈추는 시간(초) — 버티는 자세는 2초 이상
  holdKey: 2,                    // 버티기(hold) 운동이 플레이어에서 멈춰 있을 키 (기본 1)
  focus: [                       // 근육 강조: stretch(빨강, 늘어나는 곳) · work(파랑, 힘 주는 곳)
    { a: 'neckTop', b: 'shR', kind: 'stretch' },
    { a: 'chest', b: 'neckTop', side: 'front', kind: 'work', r: 2.2 },
  ],
  trace: ['haL'],                // 가장 크게 움직이는 관절의 경로(점선 화살표). 움직임이 아주 작으면 생략
  zoom: 1.2,                     // 작은 동작(목 등)은 1.1~1.3
}
```
- 관절 이름: `pelvis` `waist` `chest`(목 아래 흉곽 위) `neckTop` `head` `headTop` `nose` `backMid` `backTop`
  `shL/shR`(어깨) `elL/elR` `wrL/wrR` `haL/haR`(손끝) `hipL/hipR` `knL/knR` `anL/anR` `heelL/heelR` `toeL/toeR` `sitL/sitR`(좌골)
  — `L` 은 사람의 왼쪽. 한쪽씩 하는 운동은 **오른쪽을 먼저** 시범 보이고(반대쪽은 자동 좌우 반전), 옆모습은 늘어나는 쪽이 카메라를 향하게.
- `focus` 의 `side`: 몸 기준 `front`/`back`/`in`/`out` 으로 띠를 옮겨요(허벅지 앞=대퇴사두, 뒤=햄스트링). `from`/`to` 로 구간 조절, `r` 굵기(기본 3.2).
  예) 햄스트링 `{a:'hipR', b:'knR', side:'back', kind:'stretch'}`, 종아리 `{a:'knR', b:'anR', side:'back'}`, 가슴 `{a:'chest', b:'shR', side:'front'}`,
  상부승모근 `{a:'neckTop', b:'shR'}`, 복부 `{a:'chest', b:'pelvis', side:'front'}`, 허리 `{a:'backMid', b:'pelvis', side:'back'}`,
  엉덩이 `{a:'pelvis', b:'hipR', side:'back', r:4}`, 고관절 굴곡근 `{a:'waist', b:'hipR', side:'front'}`, 손목 굽힘근 `{a:'elR', b:'wrR', side:'front'}`.
- 받침: `{ kind: 'step', at: 'heelL', key: 0 }` 은 키 0 에서 왼발 뒤꿈치 높이에 윗면이 오는 계단, `{ kind: 'table', at: 'haR', key: 1, off: [0,0,10] }` 은 손 높이의 탁자.
  발이 계단 위에 있으면 `ground: { joints: ['heelL','toeL'], y: 20 }` 으로 그 발을 높이 20에 맞춰요(나머지 발은 바닥 0 이상이어야 함).
- 밴드·수건: `{ kind: 'band', at: 'haL', to: 'haR' }` (두 관절 사이 선). 문고리·기둥에 묶은 밴드는 `to` 없이
  `{ kind: 'band', at: 'haR', off: [40, 0, 0], key: 0 }` — 키 0 의 오른손 위치에서 `off` 만큼 떨어진 고정점까지 이어져요.
- 리그 한계: 손가락·발가락·아래팔 비틀기(회내·회외)·발목 안쪽/바깥쪽 꺾기는 표현할 수 없어요. 이런 동작은 보이는 큰 움직임만 그리고 문구로 설명하세요.

자세는 관절 각도(도)로 적어요. 기본 자세 모음 `src/figure/poses.ts`: `STAND` `SIT` `HOOK`(무릎 세워 누움) `SUPINE` `PRONE` `QUAD`(네발) `SIDE_LYING`(왼쪽으로 누움)
`HALF_KNEEL` `WALL` `HANDS_BEHIND_HEAD` `HANDS_ON_HIPS` `ARMS_CROSSED`. 파일 안에서 쓰는 자세는 파일 안에 상수로 만들어도 돼요(공용 파일은 고치지 마세요).
- 척추·목·머리(`lumbar` `thorax` `neck` `head`): `flex`(+앞으로 숙임) `side`(+사람 왼쪽으로 기울임) `twist`(+왼쪽으로 돌림)
- 어깨·고관절(`shL/shR/hipL/hipR`): `flex`(+앞으로 듦) `abd`(+옆으로 벌림) `rot`(+바깥돌림) `hab`(+수평 벌림)
- 견갑 `scapL/scapR`: `elev`(+으쓱) `prot`(+앞으로 내밈, −는 뒤로 모음)
- 팔꿈치 `elL/elR`, 무릎 `knL/knR`: 굽힘 각도 / 손목 `wrL/wrR`: +손바닥 쪽으로 꺾임 / 발목 `anL/anR`: +발끝 위로
- 몸 전체 `root`: `pitch`(+앞으로 기울어짐: 90 엎드림, −90 바로 누움) `roll`(+왼쪽으로: 90 왼쪽으로 옆으로 누움) `yaw`
- `level: { a: ['backTop'], b: ['heelL','heelR'] }` 은 두 접촉점 높이가 같도록 몸 전체 기울기를 자동 보정(브리지·네발 등),
  `anchor: ['heelL','heelR']` 은 그 점이 움직이지 않게 고정(기본은 두 발).
- `both({ sh: {...}, el: 90 })` 로 양쪽을 한 번에, `merge(SIT, {...})` 로 기본 자세에 덧붙여요(뒤에 쓴 값이 우선).

### 만든 뒤 꼭 확인
1. `REGION=neck npx vitest run tests/exercises.test.ts` — 내 파일만 검사(빠짐없는 문구, 키·자막 개수, 바닥 아래로 꺼지지 않는지, 반대쪽 포함).
2. 개발 서버(`npx vite --port 5190`)가 켜진 상태에서 `node dev/ex-shot.mjs neck --ids chin-tuck --out /tmp/x.png` 로 키 자세 시트를 만들어 **이미지를 직접 보고** 확인:
   키마다 자세가 문구와 맞는지, 관절이 이상하게 꺾이거나 몸이 바닥·의자에 박히지 않는지, 근육 강조가 제자리인지, 90° 돌려 본 모습과 반대쪽도 자연스러운지.
3. `npx tsc --noEmit` 타입 검사.

## 4. AI 카메라 코칭 붙이기
```ts
coach: {
  view: 'side', metric: 'kneeAngle', mode: 'reps',
  rest: 160, peak: 115, dir: -1,      // 160° 이상에서 시작 → 115° 이하까지 내려갔다 오면 1회
  hint: {...}, more: {...}, good: {...},
}
```
사용 가능한 지표: `kneeAngle`(옆, 무릎 각도) `hipAngle`(옆, 어깨-골반-무릎) `armRaise`(정면, 팔 높이)
`headTilt`(정면, 머리 기울기) `trunkSide`(정면, 몸통 옆 기울기) `footLift`(정면, 한 발 들기)
`hipAbduction`(정면, 다리 벌림) `heelRaise`(까치발). 버티기 동작은 `mode: 'hold', target: 값`.

## 5. 출시 전 검토 체크리스트 (대표 확인용)
- [ ] 모든 운동의 방법·용량·주의 문구가 임상 기준에 맞는지
- [ ] `avoid`(금기) 설정이 충분히 보수적인지 — 특히 허리·목 급성 통증, 임신
- [ ] 위험 신호 문항(`RED_FLAGS`)과 안내 문구
- [ ] 체형 유형 설명의 근육 목록(짧아진/약해진)
- [ ] 판정 기준(`norms.ts`)을 실제 회원 데이터로 1차 보정
- [ ] `config.ts`의 대표 이름·자격·소개
- [ ] “진단·치료” 같은 의료 표현이 들어가지 않았는지
