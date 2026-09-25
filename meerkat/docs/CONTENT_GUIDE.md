# 전문가용 콘텐츠 가이드

이 앱의 “전문성”은 코드가 아니라 **데이터 파일 몇 개**에 모여 있어요.
물리치료사·트레이너인 대표가 직접 고칠 수 있도록 정리했어요. 파일을 고친 뒤 `npm test` 로 이상이 없는지 확인하세요.

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 자세 판정 기준(정상/경미/주의/심함 경계), 점수 가중치, 자세 나이 공식 | `src/analysis/norms.ts` |
| 운동 이름·방법·코칭 멘트·실수·주의·처방 용량·대상 문제 | `src/content/exercises-upper.ts`, `exercises-lower.ts` |
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

운동 하나는 아래처럼 한 덩어리예요.
```ts
{
  id: 'chin-tuck',                         // 영문 고유 이름 (바꾸지 마세요: 기록과 연결됨)
  name: { ko: '턱 당기기', en: 'Chin tuck' },
  phase: 'activate',                       // breath | release | stretch | mobility | activate | integrate
  position: 'seated',                      // standing | seated | wall | supine | prone | quadruped | sideLying | kneeling
  regions: ['neck'],
  targets: { fhp: 1, neckPain: 0.7 },      // 겨냥하는 문제와 관련도(0~1) → 처방 점수
  equipment: [],                           // wall | chair | towel | mat | foamRoller | band | ball
  level: 1,                                // 1~3 (사용자 레벨 이하만 처방)
  dose: { kind: 'reps', sets: 2, value: 10, tempo: 2, holdSec: 5, rest: 15 },
  desk: true,                              // 사무실 리셋에 포함
  steps / cues / mistakes / why / muscles / caution,   // 한국어·영어 문구
  avoid: ['neckSevere'],                   // 이 상태면 처방 제외
  anim: { ... },                           // 시범 애니메이션 (아래 3번)
  coach: { ... },                          // (선택) AI 카메라 코칭
}
```
- `targets`에 쓸 수 있는 문제 이름: `fhp`(거북목) `roundShoulder` `kyphosis` `lordosis` `flatBack` `swayback`
  `kneeHyperext` `kneeFlexed` `headTilt` `shoulderTilt` `pelvicTilt` `lateralShift` `kneeValgus` `kneeVarus`
  `neckPain` `shoulderPain` `upperBackPain` `lowBackPain` `hipPain` `kneePain` `wristPain` `headache` `stiffness` `stress`
- `avoid`에 쓸 수 있는 상태: `neckSevere` `shoulderSevere` `lowBackSevere` `kneeSevere`(통증 7점 이상),
  `kneePain` `wristPain`(4점 이상), `radiating`(방사통) `pregnant` `dizzy` `balance`
- `cues`는 운동 중에 음성으로 읽어 줘요. 짧고 행동 중심으로 써 주세요.

## 3. 시범 애니메이션 만들기

키프레임(자세)을 2~4개 적으면 사이를 부드럽게 이어 줘요.
```ts
anim: {
  view: 90,                      // 카메라: 0 정면, 90 옆(오른쪽을 봄), 20~45 비스듬히
  props: [{ kind: 'chair' }],    // floor | mat | wall | chair | roller | ball | band | towel
  keys: [ 시작자세, 끝자세 ],
  durations: [1.2, 1.2],         // 각 구간 이동 시간(초)
  pauses: [0.5, 2.5],            // 각 자세에서 멈추는 시간(초) — 버티기 동작은 끝자세 멈춤을 길게
}
```
자세는 관절 각도(도)로 적어요. 기본 자세 모음은 `src/figure/poses.ts` (STAND, SIT, HOOK, SUPINE, PRONE, QUAD, SIDE_LYING, HALF_KNEEL, WALL).
- 척추·목·머리: `flex`(+앞으로 숙임) `side`(+사람 왼쪽으로) `twist`(+왼쪽으로 돌림)
- 어깨·고관절(`shL/shR/hipL/hipR`): `flex`(+앞으로 듦) `abd`(+옆으로) `rot`(+바깥돌림) `hab`(+수평 벌림)
- 팔꿈치 `elL/elR`, 무릎 `knL/knR`: 굽힘 각도 / 발목 `anL/anR`: +발끝 위로
- 몸 전체 `root`: `pitch`(90 엎드림, −90 바로 누움) `roll`(90 왼쪽으로 옆으로 누움)
- `both({ sh: {...}, el: 90 })` 으로 양쪽을 한 번에, `merge(SIT, {...})` 으로 기본 자세에 덧붙여요.

만든 뒤 확인: 개발 서버를 켜고 `http://localhost:5173/dev/anims.html?from=0&n=12` 에서 모든 동작의 끝 자세를 한 화면에 볼 수 있어요(`&key=0` 은 시작 자세).

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
- [ ] 48개 운동의 방법·용량·주의 문구가 임상 기준에 맞는지
- [ ] `avoid`(금기) 설정이 충분히 보수적인지 — 특히 허리·목 급성 통증, 임신
- [ ] 위험 신호 문항(`RED_FLAGS`)과 안내 문구
- [ ] 체형 유형 설명의 근육 목록(짧아진/약해진)
- [ ] 판정 기준(`norms.ts`)을 실제 회원 데이터로 1차 보정
- [ ] `config.ts`의 대표 이름·자격·소개
- [ ] “진단·치료” 같은 의료 표현이 들어가지 않았는지
