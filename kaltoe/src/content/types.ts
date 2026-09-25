// ─────────────────────────────────────────────────────────────────────────────
// 콘텐츠 스키마 — 게임 데이터(무기·패시브·적·스테이지·캐릭터·메타)와 엔진 사이의 계약.
// 새 콘텐츠는 이 타입에 맞는 항목을 src/content/*.ts 배열에 추가하기만 하면 된다.
//
// 기준 척도 (엔진 상수):
//  - 거리 단위 u ≈ 세로 폰 화면에서 CSS 1px. 화면의 짧은 변 ≈ 440u (세로 폰: 약 440×800u 보임).
//  - 플레이어 반지름 12u, 기본 이동속도 130u/s, 기본 최대 체력 100, 기본 자석(획득) 반경 65u.
//  - area 스탯이 키우는 것: 모든 원형의 area(반지름/폭), aura 반경, nova·beam의 range, orbit 궤도 거리(절반만), chain 연쇄 거리(제곱근), mine 발동 거리(제곱근).
//  - 적 반지름 보통 10~16u, 엘리트 20~26u, 보스 36~56u. 적 이동속도 보통 35~90u/s.
//  - 한 판 = 600초(실시간 10분) = 게임 속 09:00→18:00 (실시간 1초 = 게임 속 0.9분, 1시간 ≈ 66.7초).
//  - 12:00(200초)에 점심 메뉴 선택. 동시에 살아있는 적 상한 ≈ 450.
//  - 시간은 모두 초(s), 확률/비율은 0~1, 퍼센트 스탯은 0.1 = +10%.
// 이모지는 반드시 단일 코드포인트(필요 시 FE0F 포함)만 사용. ZWJ 결합 이모지(👨‍💼 등) 금지.
// ─────────────────────────────────────────────────────────────────────────────

/** 플레이어 스탯 키. 캐릭터/패시브/메타 강화/점심/모디파이어가 모두 이 키로 합산된다. */
export type StatKey =
  | 'might'      // 피해 +% (0.1 = +10%)
  | 'area'       // 범위(크기·반경) +%
  | 'cooldown'   // 재사용 대기 감소 % (0.08 = -8%). 합계 상한 0.5
  | 'amount'     // 투사체/개체 수 +N (정수)
  | 'duration'   // 지속시간 +%
  | 'projSpeed'  // 투사체 속도 +%
  | 'moveSpeed'  // 이동속도 +%
  | 'maxHp'      // 최대 체력 +N (정수, 기본 100)
  | 'armor'      // 피격 1회당 피해 -N (최소 1 피해는 받음)
  | 'recovery'   // 초당 체력 회복 +N
  | 'magnet'     // 획득 반경 +%
  | 'luck'       // 행운 +% (상자 다중 보상·4번째 선택지·드롭률·치명타에 영향)
  | 'growth'     // 경험치 획득 +%
  | 'greed'      // 코인(월급) 획득 +%
  | 'curse'      // 저주 +%: 적 체력·속도·수 증가(보상도 증가)
  | 'revival'    // 부활 횟수 +N
  | 'reroll'     // 레벨업 새로고침 횟수 +N
  | 'skip'       // 레벨업 건너뛰기 횟수 +N
  | 'banish'     // 레벨업 제외(영구 목록 제거) 횟수 +N
  | 'crit'       // 치명타 확률 +% (기본 0.05, 치명타 피해 ×2)
  | 'ultCharge'; // 궁극기 충전 속도 +%

export type StatBlock = Partial<Record<StatKey, number>>;

/** 이모지 문자열 1개(예 '📄') 또는 절차적 스프라이트 키('proc:...'). */
export type SpriteRef = string;

// ───────────────────────────── 무기 ─────────────────────────────

/**
 * 무기 동작 원형. 각 원형이 WeaponStats 필드를 어떻게 쓰는지:
 *  shot      : cooldown마다 amount발을 interval 간격으로 targeting 대상에게 발사. 투사체 반지름 area, 속도 speed,
 *              수명 duration, pierce회 관통(0=첫 적중 후 소멸, 999=무한), knockback.
 *  spread    : cooldown마다 amount발을 spreadDeg 부채꼴로 동시에 발사(바라보는 방향/가장 가까운 적). 나머지는 shot과 같음.
 *  homing    : shot과 같으나 투사체가 turnRate(rad/s)로 가장 가까운 적을 추적.
 *  bounce    : 투사체가 적중 후 range 안의 다른 적에게 튕김. 튕김 횟수 = pierce.
 *  boomerang : 대상 방향으로 range까지 날아간 뒤 플레이어에게 돌아옴. 무한 관통, 같은 적 재타격 간격 hitCooldown.
 *  aura      : 플레이어 주변 반경 area 원에 상시 피해. hitCooldown마다 damage. slow/slowDur 가능. (cooldown·amount 미사용)
 *  orbit     : amount개가 플레이어 둘레 거리 range를 speed(°/s)로 회전. 개체 반지름 area. duration 동안 켜지고
 *              cooldown 뒤 다시 켜짐(duration ≥ cooldown이면 상시). 같은 적 재타격 hitCooldown.
 *  beam      : cooldown마다 amount줄의 광선(폭 area, 길이 range)을 대상 방향(여러 줄이면 균등 회전)으로 duration 동안 발사,
 *              hitCooldown마다 피해. spinDeg(°/s)>0이면 발사 중 회전.
 *  chain     : cooldown마다 range 안 무작위 적 amount명을 번개로 타격, 각 번개는 chains회 chainRange 안 다른 적으로 연쇄
 *              (연쇄마다 피해 chainFalloff 배).
 *  strike    : cooldown마다 화면 안 무작위 적 amount곳에 delay초 예고 후 반경 area 폭발.
 *  lob       : cooldown마다 amount개를 range 안 적에게 포물선 투척(비행 delay초). 착탄 시 반경 area 폭발.
 *              puddle>0이면 착탄 지점에 duration 동안 장판(초당 피해 = damage×puddle, hitCooldown 간격).
 *  nova      : cooldown마다 amount개의 확장 고리를 interval 간격으로 방출. 고리는 speed로 range까지 퍼지며 적마다 1회 피해+knockback.
 *  mine      : cooldown마다 amount개를 플레이어 주변에 설치. 0.4초 뒤 활성, 적이 trigger 거리 안이면 반경 area 폭발.
 *              duration 뒤 자동 폭발.
 *  drone     : amount대의 드론이 플레이어를 따라다니며 cooldown마다 가장 가까운 적에게 투사체(damage, speed, area) 발사.
 */
export type WeaponArchetype =
  | 'shot' | 'spread' | 'homing' | 'bounce' | 'boomerang' | 'aura' | 'orbit'
  | 'beam' | 'chain' | 'strike' | 'lob' | 'nova' | 'mine' | 'drone';

export type Targeting = 'nearest' | 'random' | 'facing' | 'strongest' | 'lowest';

export interface WeaponStats {
  damage: number;        // 1회 적중 피해 (기본 적 체력 10~40 기준)
  cooldown: number;      // 발사 주기(초)
  amount: number;        // 발사 개수
  area: number;          // 반지름/폭(u)
  range: number;         // 사거리/궤도 거리/광선 길이(u)
  speed: number;         // 투사체 속도(u/s) 또는 orbit 각속도(°/s)
  duration: number;      // 수명/지속(초)
  pierce: number;        // 관통 횟수 (999 = 무한)
  knockback: number;     // 넉백 세기(u)
  hitCooldown: number;   // 지속 판정의 같은 적 재타격 간격(초)
  interval: number;      // 한 번 발사 안에서 개별 발사 간격(초)
  // ── 원형별 선택 필드 ──
  spreadDeg?: number;    // spread 부채꼴 각도
  turnRate?: number;     // homing 회전 속도(rad/s)
  chains?: number;       // chain 연쇄 수
  chainRange?: number;   // chain 연쇄 거리
  chainFalloff?: number; // chain 연쇄마다 피해 배율(0~1)
  delay?: number;        // strike 예고/lob 비행 시간(초)
  puddle?: number;       // lob 장판 피해 비율(0이면 장판 없음)
  trigger?: number;      // mine 발동 거리(u)
  spinDeg?: number;      // beam 회전 속도(°/s)
  // ── 부가 효과(모든 원형 공통, 선택) ──
  slow?: number;         // 감속 비율(0~1)
  slowDur?: number;      // 감속 지속(초)
  burnDps?: number;      // 화상 초당 피해
  burnDur?: number;      // 화상 지속(초)
  freezeChance?: number; // 적중 시 빙결 확률(0~1, 빙결 1.2초, 보스 면역)
  critBonus?: number;    // 이 무기만의 추가 치명타 확률
  lifesteal?: number;    // 적중 피해 비례 회복 비율(예 0.01)
  execute?: number;      // 체력이 이 비율 이하인 일반 적 즉사(0~1, 보스·엘리트 무시)
}

export interface WeaponLevel {
  desc: string;                   // 레벨업 카드 문구. 예: '투사체 +1', '피해 +10'
  delta: Partial<WeaponStats>;    // 이전 레벨 대비 더하는 값 (곱이 필요한 값도 합으로 표현)
}

export interface WeaponDef {
  id: string;
  name: string;                   // 예 '볼펜 투척'
  desc: string;                   // 한 줄 설명(웃기게)
  icon: SpriteRef;                // UI 아이콘 이모지
  projectile: SpriteRef;          // 투사체/개체 스프라이트(이모지). aura/beam/chain/nova는 color만 사용
  color: string;                  // 효과 색(#rrggbb)
  archetype: WeaponArchetype;
  targeting: Targeting;
  base: WeaponStats;              // 레벨 1
  levels: WeaponLevel[];          // 레벨 2..maxLevel (길이 = maxLevel-1, 기본 7 → 최대 8레벨)
  /** 진화 조건: 이 무기 최대 레벨 + 이 패시브 보유 → 엘리트/보스 상자에서 evolvesTo로 진화 */
  evolveWith?: string;            // passive id
  evolvesTo?: string;             // weapon id (evolved: true인 무기)
  evolved?: boolean;              // 진화 무기(일반 선택지에 등장하지 않음, 레벨 1 고정)
  /** 해금 조건 achievement id. 없으면 처음부터 사용 가능. */
  unlockedBy?: string;
}

// ───────────────────────────── 패시브 ─────────────────────────────

export interface PassiveDef {
  id: string;
  name: string;                   // 예 '헬스장 회원권'
  desc: string;                   // 예 '피해 +10% / 레벨'
  icon: SpriteRef;
  maxLevel: number;               // 보통 5
  perLevel: StatBlock;            // 레벨마다 더해지는 스탯
  unlockedBy?: string;
}

// ───────────────────────────── 적 ─────────────────────────────

/**
 * 적 이동/행동 원형:
 *  chase    : 플레이어를 향해 이동(기본).
 *  zigzag   : 추적하되 좌우로 흔들림(params.wobble 진폭u, params.freq Hz).
 *  dash     : 추적. params.dashRange 안이면 0.6초 예고 후 params.dashSpeed로 params.dashDur초 돌진, params.dashCd 재사용.
 *  ranged   : params.keep 거리 유지, params.shotCd마다 탄(params.shotSpeed, params.shotDamage) 발사.
 *  spawner  : 추적하며 params.spawnCd마다 params.spawnId를 params.spawnCount마리 소환.
 *  exploder : params.fuseRange 안에 들어오면 params.fuse초 뒤 반경 params.blastRadius, 피해 params.blastDamage 폭발(자신 사망).
 *  healer   : params.healCd마다 반경 params.healRadius 안 적 체력 params.healPct(비율) 회복.
 *  buffer   : params.buffCd마다 반경 params.buffRadius 안 적 이동속도 +params.buffPct, params.buffDur초.
 *  straight : 생성 시 방향으로 직진(무리 이벤트용), 화면 밖 멀리 가면 소멸.
 */
export type EnemyBehavior = 'chase' | 'zigzag' | 'dash' | 'ranged' | 'spawner' | 'exploder' | 'healer' | 'buffer' | 'straight';

/** 보스 전용 패턴. cooldown마다 반복. hpBelow가 있으면 체력 비율이 그 이하일 때만 사용(페이즈). */
export type BossAbilityKind =
  | 'summon'   // params: enemy(id), count, radius
  | 'charge'   // params: speed, dur, windup
  | 'ring'     // params: bullets, speed, damage  (전방위 탄막)
  | 'aimed'    // params: bullets, spreadDeg, speed, damage (플레이어 조준 부채꼴)
  | 'slam'     // params: radius, damage, windup (플레이어 위치에 예고 원 → 폭발)
  | 'hazard'   // params: count, radius, dps, dur (장판 설치)
  | 'wall'     // params: enemy(id), count, radius (플레이어를 둘러싸는 적 고리 — '긴급 회의 소집')
  | 'enrage';  // params: speedMul, cdMul (1회성: hpBelow 도달 시 발동)

export interface BossAbility {
  kind: BossAbilityKind;
  cooldown: number;
  hpBelow?: number;
  params: Record<string, number | string>;
  shout?: string;                 // 사용 시 말풍선 대사(예 '이거 오늘까지 되죠?')
}

export interface EnemyDef {
  id: string;
  name: string;                   // 예 '스팸 메일'
  sprite: SpriteRef;              // 이모지
  tint?: string;                  // 외곽선/그림자 색
  label?: string;                 // 말풍선 적이면 표시 문구(예 '결혼은?'). 있으면 이모지 대신 말풍선으로 그림
  hp: number;                     // 기본 체력(시간 배율 적용 전)
  speed: number;                  // u/s
  damage: number;                 // 접촉 1회 피해(같은 적은 0.8초마다 1회)
  radius: number;                 // u
  xp: number;                     // 떨어뜨리는 경험치 양(보석 크기는 자동)
  knockbackResist?: number;       // 0~1 (1 = 밀리지 않음)
  armor?: number;                 // 받는 피해 -N
  shield?: number;                // 체력보다 먼저 깎이는 보호막
  behavior: EnemyBehavior;
  params?: Record<string, number | string>;
  split?: { into: string; count: number };  // 사망 시 분열
  coinChance?: number;            // 코인 드롭 확률(기본값은 balance.ts)
  elite?: boolean;                // 엘리트: 처치 시 상자 드롭, 체력바 표시
  boss?: boolean;                 // 보스: 화면 상단 체력바, 처치 시 큰 상자
  abilities?: BossAbility[];      // 보스(또는 엘리트) 패턴
  intro?: string;                 // 첫 등장 시 토스트 문구
  /** 사람형 적(상사·친척 등): 이모지를 얼굴로 쓰고 아래에 정장 몸통을 그린다 */
  body?: { suit: string; tie: string };
}

// ───────────────────────────── 스테이지 ─────────────────────────────

export interface SpawnEntry { enemy: string; weight: number }

/** from~to초 구간의 상시 소환 규칙. 구간은 겹치지 않게, 0~600초를 빈틈없이 덮는다. */
export interface SpawnSegment {
  from: number;
  to: number;
  pool: SpawnEntry[];
  rate: number;                   // 초당 소환 수(구간 시작 → 끝으로 선형 보간하려면 rateEnd 지정)
  rateEnd?: number;
  minAlive: number;               // 살아있는 적이 이보다 적으면 즉시 보충
  hpMul: number;                  // 이 구간 적 체력 배율(구간 내 선형으로 hpMulEnd까지)
  hpMulEnd?: number;
}

export type StageEventKind =
  | 'swarm'    // enemy가 count마리 무리로 화면 한쪽에서 반대쪽으로 직진 (straight)
  | 'ring'     // enemy count마리가 플레이어를 반경 radius로 포위
  | 'elite'    // 엘리트 1마리 등장(상자 보유)
  | 'boss'     // 보스 등장(경고 연출)
  | 'message'  // 토스트 문구만 표시
  | 'burst';   // enemy count마리를 화면 밖 무작위 위치에 즉시 소환

export interface StageEvent {
  at: number;                     // 초
  kind: StageEventKind;
  enemy?: string;
  count?: number;
  radius?: number;
  text?: string;                  // 경고/토스트 문구
  hpMul?: number;                 // 이 이벤트로 나온 적 체력 배율(기본 = 현재 구간 배율)
}

export interface StagePalette {
  floor: string;                  // 바닥 기본색
  floorAlt: string;               // 타일 교차색
  line: string;                   // 타일 선
  accent: string;                 // 강조색(UI 테두리 등)
  fog: string;                    // 화면 가장자리 비네트 색
}

export interface StageDef {
  id: string;
  name: string;                   // 예 '월요일 사무실'
  subtitle: string;               // 예 '메일 폭탄 주의'
  desc: string;
  icon: SpriteRef;
  palette: StagePalette;
  decor: SpriteRef[];             // 바닥에 흩어진 장식 이모지(판정 없음)
  timeline: SpawnSegment[];
  events: StageEvent[];
  finalBoss: string;              // 17:00 전후 등장하는 최종 보스 id. 18:00까지 못 잡으면 '야근 확정' — 잡을 때까지 시계 정지
  overtimePool: SpawnEntry[];     // 18:00 이후 무한 야근 모드 소환 풀
  unlockedBy?: string;
  coinMul?: number;               // 스테이지 코인 배율(후반 스테이지 보상↑)
  hpMul?: number;                 // 스테이지 전체 적 체력 배율
}

// ───────────────────────────── 캐릭터 / 궁극기 ─────────────────────────────

/**
 * 궁극기 원형(게이지가 차면 버튼으로 발동):
 *  blast   : 반경 params.radius 안 모든 적에게 params.damage(×might) 피해 + 넉백 (사직서 투척)
 *  freeze  : 화면 모든 적 params.dur초 빙결(보스는 감속 50%)
 *  rain    : params.dur초 동안 화면 무작위 위치에 초당 params.rate개의 폭발(반경 params.radius, 피해 params.damage)
 *  vacuum  : 화면 모든 경험치/코인 흡수 + params.dur초 동안 피해 ×(1+params.buff)
 *  shield  : params.dur초 무적 + 이동속도 +params.speed, 닿는 적 params.damage 피해
 *  clone   : params.dur초 동안 보유 무기 발사 속도 ×params.mul
 */
export type UltimateKind = 'blast' | 'freeze' | 'rain' | 'vacuum' | 'shield' | 'clone';

export interface UltimateDef {
  id: string;
  name: string;                   // 예 '사직서 투척'
  desc: string;
  icon: SpriteRef;
  kind: UltimateKind;
  charge: number;                 // 게이지 최대치. 적 처치 1 = 1, 엘리트 20, 피격 피해 1당 0.5
  params: Record<string, number>;
  shout: string;                  // 발동 대사(예 '저 오늘부로 그만둡니다!')
}

/** 절차적 캐릭터 외형 */
export interface Look {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bob' | 'bald' | 'spiky' | 'bun';
  suit: string;                   // 상의 색
  tie: string;                    // 넥타이/포인트 색
  accessory?: SpriteRef;          // 머리 위/손 소품 이모지(선택)
  glasses?: boolean;
}

export interface CharacterDef {
  id: string;
  name: string;                   // 예 '김신입'
  title: string;                  // 직급/설명 예 '입사 3일차 신입사원'
  desc: string;
  look: Look;
  startWeapon: string;            // weapon id
  stats: StatBlock;               // 기본 보너스
  growth?: { every: number; stats: StatBlock };  // N레벨마다 추가 보너스
  ultimate: string;               // ultimate id
  unlockedBy?: string;            // achievement id (없으면 기본 해금)
  price?: number;                 // 해금 후 코인으로 고용해야 하면 가격
}

// ───────────────────────────── 점심 메뉴 ─────────────────────────────

export interface LunchDef {
  id: string;
  name: string;                   // 예 '뜨끈한 국밥'
  icon: SpriteRef;
  desc: string;
  stats: StatBlock;               // 오후 내내(=런 끝까지) 적용
  heal?: number;                  // 즉시 회복 비율(0~1)
  unlockedBy?: string;
}

// ───────────────────────────── 메타(영구 성장) ─────────────────────────────

export interface MetaUpgradeDef {
  id: string;
  name: string;                   // 예 '사내 헬스장'
  icon: SpriteRef;
  desc: string;                   // 예 '피해 +5% / 단계'
  stat: StatKey;
  perRank: number;
  maxRank: number;
  baseCost: number;               // 1단계 가격(코인)
  costStep: number;               // 단계마다 가격 증가(선형). 실제 가격 = baseCost + costStep×현재단계
  unlockedBy?: string;
}

/** 업적 조건에서 추적하는 지표 */
export type AchievementMetric =
  | 'totalKills' | 'runKills' | 'surviveSec' | 'clearStage' | 'clearWithChar' | 'reachLevel'
  | 'totalEvolves' | 'evolveWeapon' | 'weaponMax' | 'totalBossKills' | 'bossKill' | 'totalCoins'
  | 'ultUses' | 'runsPlayed' | 'heatClear' | 'dailyClears' | 'attendanceDays' | 'lunchPick'
  | 'overtimeSec' | 'noHitSec' | 'chestsOpened' | 'weaponKills' | 'metaRanks' | 'lowHpClear'
  | 'runCoins' | 'charLevel' | 'pickupItem';

export type RewardKind = 'weapon' | 'passive' | 'character' | 'stage' | 'coins' | 'feature' | 'lunch' | 'meta';

/** reward.kind === 'feature' 일 때 id로 쓸 수 있는 기능 키 (엔진이 아는 것만) */
export type FeatureId =
  | 'daily'      // 오늘의 업무(일일 도전)
  | 'heat'       // 야근 강도(난이도 단계) 선택
  | 'overtime';  // 칼퇴 성공 후 '야근 모드'(무한) 계속하기

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;                   // 조건 설명
  icon: SpriteRef;
  metric: AchievementMetric;
  target: number;                 // 목표 수치(예 1000 처치, 300초)
  param?: string;                 // 지표 대상 id(스테이지/캐릭터/무기/보스/점심/아이템)
  reward: { kind: RewardKind; id?: string; amount?: number };
  hidden?: boolean;               // 달성 전 '???'로 표시
}

/** 일일 도전/야근 강도에 쓰는 규칙 변경 */
export interface ModifierDef {
  id: string;
  name: string;
  icon: SpriteRef;
  desc: string;
  stats?: StatBlock;              // 플레이어 스탯 가감
  enemyHpMul?: number;            // 곱
  enemySpeedMul?: number;         // 곱
  enemyDamageMul?: number;        // 곱
  spawnMul?: number;              // 소환 속도 곱
  xpMul?: number;
  coinMul?: number;
  flags?: string[];               // 특수 규칙 키(엔진이 아는 것만): 'noHeal','bigHead','oneHp','glassCannon','fastClock','eliteRush'
}

// ───────────────────────────── 밸런스 상수 ─────────────────────────────

export interface PickupChances {
  coffee: number;                 // 체력 회복(30) — 처치당 확률
  chicken: number;                // 체력 전부 회복
  magnet: number;                 // 모든 보석 흡수
  bomb: number;                   // 화면 적 전멸(보스 제외, 엘리트는 큰 피해)
  clock: number;                  // 적 5초 정지
}

export interface BalanceDef {
  runSeconds: number;             // 600
  lunchAt: number;                // 200
  finalBossAt: number;            // 최종 보스 등장 시각(초)
  xpToLevel: (level: number) => number;  // level→level+1 에 필요한 경험치
  maxWeapons: number;             // 6
  maxPassives: number;            // 6
  choices: number;                // 기본 선택지 수 3 (행운으로 4번째)
  fourthChoiceLuck: number;       // luck 1.0당 4번째 선택지 확률
  baseCrit: number;
  critMul: number;
  coinChance: number;             // 일반 적 코인 드롭 확률
  coinValue: number;              // 코인 1개 가치
  eliteCoins: number;
  bossCoins: number;
  pickups: PickupChances;         // 처치당(luck 적용)
  chestMulti: { three: number; five: number };  // 상자 3개/5개 보상 확률(luck 적용 전)
  clearBonus: number;             // 칼퇴 성공 보너스 코인
  overtimeCoinPerMin: number;     // 야근 1분당 보너스 코인
  overtimeHpGrowth: number;       // 야근 분당 적 체력 증가 비율
  overtimeSpawnGrowth: number;    // 야근 분당 소환량 증가 비율
  contactCooldown: number;        // 같은 적 접촉 피해 간격 0.8
  heatLevels: ModifierDef[];      // 야근 강도 1..N (누적 적용)
}
