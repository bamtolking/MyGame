# 칼퇴 서바이버 — 크리에이티브 브리프 (고정 로스터)

> "오늘은 반드시 칼퇴한다." 09:00부터 18:00까지, 몰려오는 업무를 한 손으로 쓸어버리는 직장인 서바이벌 로그라이트.

## 핵심 방향
- 장르: 뱀서류/탕탕특공대류 **자동 공격 서바이벌 로그라이트**. 모바일 세로 화면, 한 손가락 가상 조이스틱. 브라우저(HTML5 Canvas) 단일 파일.
- 톤: **한국 직장인 공감 유머**. 적은 메일·서류·회의·상사·잔소리, 무기는 사무용품, 궁극기는 사직서. 누구나 웃을 수 있는 가벼운 풍자(특정 집단 비하·혐오·성적 표현 금지).
- 한 판 10분(09:00→18:00). 12:00 점심 메뉴 선택(오후 버프). 17:00 최종 보스. 18:00까지 보스를 못 잡으면 "야근 확정" — 시계가 17:59에 멈추고 보스를 잡아야 퇴근. 칼퇴 성공 후 "야근 모드"(무한)로 계속할 수 있음.
- 중독 루프: 20초마다 레벨업 3택1 → 무기 최대 레벨+짝 패시브로 **진화**(발견의 재미) → 엘리트 상자 슬롯 연출 → 판 끝나면 **월급(코인)** → 복지(영구 강화) → **업적으로 새 무기·캐릭터·스테이지 연쇄 해금** → 오늘의 업무(일일 도전)·출석 체크·야근 강도(난이도 1~10).
- 확장성: 모든 콘텐츠는 `src/content/*.ts` 데이터. 무기는 14개 동작 원형(archetype)을 파라미터로 조합. 새 스테이지/적/무기 추가 = 배열에 항목 추가.

## 고정 ID 로스터 (이 id·이름·이모지를 그대로 사용할 것. 수치와 설명은 각 담당이 채움)

### 무기 14 + 진화 14 (`weapons.ts`)
| id | 이름 | 이모지(icon/projectile) | 원형 | 진화 짝 패시브 | 진화 id / 이름 | 기본 해금 |
|---|---|---|---|---|---|---|
| pen | 볼펜 투척 | 🖊️ | shot (nearest) | multitask | fountain_storm / 만년필 폭풍 ✒️ | O |
| coffee | 뜨거운 아메리카노 | ☕ | aura | lunchbox | caffeine_overdrive / 카페인 오버드라이브 | O |
| cards | 명함 회오리 | 📇 | orbit | grit | vip_cards / VIP 골드 명함 🎴 | O |
| folder | 서류철 부메랑 | 📁 | boomerang | speedread | approval_storm / 무한 결재 🗂️ | O |
| clip | 클립 샷건 | 📎 | spread | shortcut | clip_gatling / 클립 개틀링 🖇️ | O |
| ctrlz | 단축키 번개 | ⚡ | chain | clover | ctrl_alt_del / Ctrl+Alt+Del 폭풍 🌩️ | O |
| laser | 레이저 포인터 | 🔴 | beam | busybody | presentation_beam / 프레젠테이션 빔 📽️ | 업적 |
| toner | 토너 폭탄 | 🖨️ | lob (장판) | passion | ink_flood / 잉크 대홍수 🌊 | 업적 |
| plane | 종이비행기 | ✈️ | homing | energy | crane_squadron / 종이학 편대 🕊️ | 업적 |
| keyboard | 엔터키 연타 | ⌨️ | nova | gym | mech_keyboard / 청축 기계식 키보드 🎹 | 업적 |
| drone | 사내 드론 | 🛸 | drone | nunchi | drone_squad / 감시 드론 편대 📡 | 업적 |
| card | 법인카드 | 💳 | bounce | stocks | black_card / 블랙카드 🖤 | 업적 |
| postit | 포스트잇 지뢰 | 🗒️ | mine | mental | postit_field / 포스트잇 지뢰밭 🟨 | 업적 |
| alarm | 퇴근 알람 | ⏰ | strike | selfhelp | clockout_bell / 6시 정각 종소리 🔔 | 업적 |


### 패시브 15 (`passives.ts`) — 대부분 최대 5레벨, multitask는 최대 2레벨
| id | 이름 | 이모지 | 스탯 | 기본 해금 |
|---|---|---|---|---|
| gym | 헬스장 회원권 | 💪 | might | O |
| mental | 철벽 멘탈 | 🛡️ | armor | O |
| vitamin | 종합 비타민 | 💊 | maxHp | O |
| lunchbox | 엄마 도시락 | 🥪 | recovery | O |
| shortcut | 단축키 마스터 | ⏩ | cooldown | O |
| busybody | 넓은 오지랖 | 👀 | area | O |
| multitask | 멀티태스킹 | 🤹 | amount (2레벨) | O |
| grit | 존버 정신 | 🧘 | duration | O |
| speedread | 속독 스킬 | 📖 | projSpeed | O |
| energy | 에너지 드링크 | 🥤 | moveSpeed | O |
| nunchi | 눈치 백단 | 👂 | magnet | O |
| clover | 사내 인맥 | 🍀 | luck | 업적 |
| selfhelp | 자기계발서 | 📚 | growth | 업적 |
| stocks | 주식 앱 | 📈 | greed | 업적 |
| passion | 열정 페이 | 🔥 | curse(+적/보상) | 업적 |

### 캐릭터 8 + 궁극기 (`characters.ts`)
| id | 이름 | 직급 | 시작 무기 | 궁극기 id / 이름 / 원형 | 해금 |
|---|---|---|---|---|---|
| kim | 김신입 | 입사 3일차 신입사원 | pen | resign / 사직서 투척 / blast | 기본 |
| park | 박대리 | 커피 없인 못 사는 대리 | coffee | coffee_break / 커피 타임 / vacuum | 기본 |
| lee | 이개발 | 야근이 일상인 백엔드 개발자 | ctrlz | rmrf / rm -rf / / rain | 업적 |
| choi | 최디자 | 최종_진짜최종.psd의 디자이너 | laser | final_final / 최종_최종_진짜최종 / freeze | 업적 |
| jung | 정인턴 | 열정 가득 인턴 | postit | coffee_run / 커피 셔틀 / shield | 업적 |
| han | 한과장 | 법카의 달인 | card | corp_card / 법카 긁기 / clone | 업적 |
| yoon | 윤팀장 | 회의를 사랑하는 팀장 | folder | emergency_meeting / 긴급 회의 소집 / freeze | 업적 |
| nakha | 낙하산 | 사장님 아들(비밀) | drone | dad_call / 아빠 찬스 / clone | 숨은 업적 |

### 스테이지 4 (`stages.ts`)
| id | 이름 | 분위기 | 중간 보스 | 최종 보스 | 해금 |
|---|---|---|---|---|---|
| office | 월요일 사무실 | 밝은 회색-파랑 카펫 | team_lead 팀장님 😒 | bujang 부장님 😤 | 기본 |
| crunch | 분기 마감 야근 | 어두운 남색 사무실, 모니터 불빛 | pm PM 🙄 | director 본부장 😠 | office 칼퇴 업적 |
| dinner | 부서 회식 | 고깃집 주황/갈색 | toast_master 건배사 과장 🥳 | bomb_bujang 폭탄주 부장님 🥴 | crunch 칼퇴 업적 |
| holiday | 명절 친척집 | 따뜻한 한옥 장판 노랑 | uncle 삼촌 🧔 | big_aunt 큰이모 🧓 | dinner 칼퇴 업적 |

### 적 로스터 (`enemies.ts`) — id / 이름 / 이모지 / 역할
- 공용: `mini_memo` 작은 쪽지 📝 (분열 자식, 약함)
- office: `spam` 스팸 메일 📧 zigzag 떼 / `memo` 결재 서류 📄 기본 / `phone` 전화벨 📞 dash / `meeting` 회의 초대 📅 ring 이벤트용 / `kpi` KPI 그래프 📊 느린 탱커 / `binder` 서류 뭉치 🗂️ 분열→memo / `chat` 단톡방 알림 💬 ranged / `deadline` 마감 임박 ⌛ 빠름 / 엘리트 `printer` 고장난 프린터 🖨️ spawner(memo) / 중간보스 `team_lead` 팀장님 😒 (body) / 최종 `bujang` 부장님 😤 (body)
- crunch: `bug` 버그 🐛 떼 / `issue` 긴급 이슈 🧨 exploder / `zombie` 좀비 동료 🧟 탱커 / `ghost_task` 유령 업무 👻 zigzag / `hotfix` 핫픽스 🩹 healer / `report` 주간 보고서 📑 분열→mini_memo / `alert` 장애 알림 🚨 ranged / `owl` 올빼미 야근러 🦉 dash / 엘리트 `server` 서버 다운 🖥️ spawner(bug) / 중간보스 `pm` PM 🙄 (body) / 최종 `director` 본부장 😠 (body)
- dinner: `soju` 소주병 🍶 기본 / `beer` 생맥주 🍺 zigzag / `samgyup` 삼겹살 🥓 분열→mini_meat / `mini_meat` 고기 조각 🍖 / `mic` 노래방 마이크 🎤 ranged / `tambourine` 탬버린 🥁 buffer / `bombshot` 폭탄주 💣 exploder / `cheers` 건배 잔 🥂 dash / `hangover` 숙취 🤢 탱커 / 엘리트 `grill` 불판 ♨️ spawner(mini_meat) / 중간보스 `toast_master` 건배사 과장 🥳 (body) / 최종 `bomb_bujang` 폭탄주 부장님 🥴 (body)
- holiday: 말풍선 적(label 사용, sprite는 💬) `nag_job` "취업은?" / `nag_marry` "결혼은?" / `nag_weight` "살쪘네?" / `nag_salary` "연봉은?" / `nag_kids` "애는?" / `songpyeon` 송편 🥟 떼 / `jeon` 모둠전 🍳 탱커 / `cousin` 사촌동생 🧒 dash / `dishes` 설거지 더미 🍽️ 분열→mini_dish / `mini_dish` 접시 🥣 / `remote` TV 리모컨 📺 ranged / 엘리트 `gift` 선물세트 🎁 spawner(songpyeon) / 중간보스 `uncle` 삼촌 🧔 (body) / 최종 `big_aunt` 큰이모 🧓 (body)

### 점심 메뉴 10 (`lunch.ts`)
`gukbap` 뜨끈한 국밥 🍲 / `jeyuk` 제육볶음 🥘 / `malatang` 마라탕 🌶️ / `salad` 닭가슴살 샐러드 🥗 / `donkatsu` 왕돈까스 🍛 / `jjajang` 짜장면 🍜 / `gimbap` 참치김밥 🍙 / `dosirak` 편의점 도시락 🍱 / `burger` 수제버거 🍔 / `sushi` 회전초밥 🍣 (뒤 4개는 업적 해금 권장)

### 기능 해금 키
`daily`(오늘의 업무), `heat`(야근 강도), `overtime`(야근 모드) — 업적 보상 kind 'feature'로만 해금.

## 파일 소유 (서로 다른 파일만 수정)
- 전투 콘텐츠 담당: `weapons.ts`, `passives.ts`, `characters.ts`, `lunch.ts`
- 적/스테이지 담당: `enemies.ts`, `stages.ts`
- 시스템/메타 담당: `balance.ts`, `meta.ts`, `achievements.ts`, `modifiers.ts`
- UX/문구 담당: `docs/GDD.md`, `strings.ts`
- `types.ts`, `index.ts`는 수정 금지(엔진 계약). 스키마로 표현할 수 없는 요구는 결과 보고에 적을 것.

## 해금 업적 id 규칙 (교차 참조 고정)
무언가를 해금하는 업적의 id는 `u_<종류>_<대상id>` 로 고정한다. 콘텐츠 담당은 `unlockedBy`에 이 id를 쓰고, 시스템/메타 담당은 같은 id의 업적을 만들어 조건과 보상(`reward: {kind, id}`)을 정한다.
- 무기: `u_weapon_laser`, `u_weapon_toner`, `u_weapon_plane`, `u_weapon_keyboard`, `u_weapon_drone`, `u_weapon_card`, `u_weapon_postit`, `u_weapon_alarm`
- 패시브: `u_passive_clover`, `u_passive_selfhelp`, `u_passive_stocks`, `u_passive_passion`
- 캐릭터: `u_character_lee`, `u_character_choi`, `u_character_jung`, `u_character_han`, `u_character_yoon`, `u_character_nakha`(hidden)
- 스테이지: `u_stage_crunch`(office 칼퇴), `u_stage_dinner`(crunch 칼퇴), `u_stage_holiday`(dinner 칼퇴)
- 점심: `u_lunch_gimbap`, `u_lunch_dosirak`, `u_lunch_burger`, `u_lunch_sushi` (나머지 6개는 기본 해금)
- 기능: `u_feature_daily`, `u_feature_heat`, `u_feature_overtime`
- 메타 강화 중 잠긴 것은 시스템/메타 담당이 `u_meta_<id>`로 직접 정한다(양쪽 모두 그 담당 소유).
- 캐릭터의 시작 무기는 무기 해금 여부와 관계없이 그 캐릭터로 플레이할 때 항상 사용 가능(엔진 규칙).

## 밸런스 목표(1차 기준, 이후 헤드리스 봇 시뮬레이션으로 조정)
- 레벨: 12:00(200초) ≈ Lv 13~16, 15:00(400초) ≈ Lv 30~34, 18:00(600초) ≈ Lv 45~52. 선택지 최대 조합(무기 6×8레벨 + 패시브 6×5레벨) ≈ 78회 선택이라 끝까지 다 채우지는 못함.
- 처치 수(보통 빌드): 100초 ≈ 300, 200초 ≈ 850, 400초 ≈ 2200, 600초 ≈ 3800. 일반 적 평균 경험치 ≈ 1.3.
- 동시 적 수: 초반 15~40, 중반 80~180, 후반 200~350(상한 450).
- 무기 DPS(단일 대상, 스탯 보정 전): 시작 무기 Lv1 ≈ 18~25, Lv8 ≈ 110~160(광역 무기는 단일 DPS가 낮은 대신 다수 타격). 진화 ≈ Lv8의 2.5~3.5배 + 특수 효과.
- 적 체력: 기본 적 base hp 10~20. 구간 hpMul이 0초 1.0 → 200초 ≈ 2.2 → 400초 ≈ 5 → 600초 ≈ 10(스테이지가 뒤로 갈수록 기본 체력·배율이 1.3~1.8배씩 증가). 보스 체력은 그 시점 플레이어 예상 DPS × 25~45초.
- 코인: 한 판 칼퇴 시 약 250~450 코인(스테이지 배율 별도), 사망 시 벌어둔 만큼. 복지 1단계 가격 100~300, 전체 만렙 합계 ≈ 40,000(약 100판) — 장기 목표.
- 접촉 피해: 기본 적 5~8, 강한 적 10~15, 보스 20~30 (같은 적 0.8초마다). 최대 체력 100 기준.
