// 한 판(런) 동안의 런타임 상태 타입. DOM 없이 순수 데이터 — 헤드리스 시뮬레이션/테스트 가능.
import type { Rng } from '../core/rng';
import type {
  WeaponDef, WeaponStats, PassiveDef, EnemyDef, StageDef, CharacterDef, UltimateDef, LunchDef, ModifierDef, StatKey,
} from '../content/types';
import type { SpatialGrid } from '../core/grid';

export type Stats = Record<StatKey, number>;

/** 파생 스탯(계산 완료값) */
export interface Derived {
  mightMul: number; areaMul: number; cdMul: number; amountAdd: number; durMul: number; projSpeedMul: number;
  moveSpeed: number; maxHp: number; armor: number; recovery: number; magnetR: number; luck: number;
  growthMul: number; greedMul: number; curse: number; crit: number; ultMul: number;
}

export interface WeaponInst {
  def: WeaponDef;
  slot: number;            // 0..5 (적의 재타격 대기 배열 인덱스로도 사용)
  level: number;
  st: WeaponStats;         // base + 레벨 델타 누적
  cd: number;              // 다음 발사까지 남은 시간
  burst: number;           // 이번 발사에서 남은 개수
  burstT: number;          // 다음 개별 발사까지
  on: number;              // orbit/beam 활성 남은 시간
  angle: number;           // orbit/beam 회전각
  drones: { x: number; y: number; cd: number }[];
  dmg: number;             // 누적 피해(결과 화면)
  kills: number;
  maxedAt?: number;
}

export interface PassiveInst { def: PassiveDef; level: number }

export interface Enemy {
  uid: number;
  def: EnemyDef;
  x: number; y: number; r: number;
  vx: number; vy: number;          // 넉백 속도
  hp: number; maxHp: number; shield: number;
  speed: number; damage: number; xp: number;
  elite: boolean; boss: boolean;
  dead: boolean;
  flash: number;                   // 피격 하양 번쩍임
  contactCd: number;
  slowT: number; slowAmt: number;
  freezeT: number; stunT: number;
  burnT: number; burnDps: number; burnTick: number; burnSlot: number;
  buffT: number; buffAmt: number;
  hitCd: Float32Array;             // 무기 슬롯별 재타격 가능 시각 (0..5 무기, 6 궁극기/장판, 7 예비)
  // 행동 상태
  t: number;                       // 범용 타이머
  st: number;                      // 행동 단계 (0 추적, 1 예고, 2 돌진, 3 퓨즈 …)
  stT: number;                     // 단계 타이머
  dx: number; dy: number;          // 돌진/직진 방향
  seed: number;                    // 흔들림 위상
  abil: number[];                  // 보스 능력별 타이머
  enraged: boolean;
  spdMul: number; cdMul: number;   // 격노 배율
  shout: string; shoutT: number;   // 말풍선
  face: number;                    // 좌우 방향(렌더)
  spawnT: number;                  // 등장 연출 타이머
  lastHitSlot: number;             // 마지막으로 때린 무기 슬롯(처치 기여)
  chargeSpeed: number; chargeDur: number;  // 보스 돌진 파라미터
  straight: boolean;               // 무리 이벤트: 직진 강제
  abLock: number;                  // 보스 능력 사이 전역 잠금
  pendAb: number; pendT: number;   // 예고 중인 능력(탄막 발사 전 0.35초)
}

export type BulletKind = 'shot' | 'homing' | 'bounce' | 'boomerang' | 'drone';

export interface Bullet {
  kind: BulletKind;
  slot: number;
  x: number; y: number; vx: number; vy: number; r: number;
  dmg: number; pierce: number; knock: number;
  life: number; maxLife: number;
  sprite: string; rot: number; spin: number;
  hits: number[];                  // 이미 맞힌 적 uid
  turn: number;                    // homing
  range: number;                   // bounce 탐색 거리 / boomerang 최대 거리
  back: boolean;                   // boomerang 복귀 중
  ox: number; oy: number;          // 발사 원점
  hitCd: number;                   // boomerang 재타격 간격
  dead: boolean;
  fx: WeaponStats;                 // 부가 효과 참조(slow/burn/freeze/crit…)
  tgt: Enemy | null;               // homing 현재 대상
}

export interface EnemyBullet {
  x: number; y: number; vx: number; vy: number; r: number;
  dmg: number; life: number; sprite: string; dead: boolean;
}

/** 지연 폭발(lob 비행, strike 예고, mine 설치, 보스 slam 예고) */
export interface Blast {
  kind: 'lob' | 'strike' | 'mine' | 'slam' | 'ult';
  slot: number;                    // 플레이어 무기 슬롯(-1 = 적 공격)
  x: number; y: number;            // 착탄/폭발 지점
  sx: number; sy: number;          // lob 시작점
  t: number; delay: number;        // 경과/총 시간
  r: number; dmg: number; knock: number;
  puddle: number; puddleDur: number; hitCd: number;
  trigger: number; life: number;   // mine
  armed: boolean;
  sprite: string; color: string;
  hostile: boolean;                // true면 플레이어에게 피해
  dead: boolean;
  fx: WeaponStats | null;
}

/** 지속 장판(잉크 웅덩이, 보스 위험 지대) */
export interface Zone {
  x: number; y: number; r: number;
  dps: number; tick: number; t: number; life: number;
  slot: number; hostile: boolean; color: string; dead: boolean;
  fx: WeaponStats | null; hitCd: number;
}

export interface Beam {
  slot: number; x: number; y: number; ang: number; len: number; w: number;
  life: number; maxLife: number; dmg: number; hitCd: number; spin: number; color: string;
  fx: WeaponStats; dead: boolean; knock: number;
}

export interface Ring {
  slot: number; x: number; y: number; r: number; maxR: number; speed: number;
  dmg: number; knock: number; hits: Set<number>; color: string; dead: boolean; fx: WeaponStats;
  w: number;
}

export type PickupKind = 'xp' | 'coin' | 'coffee' | 'chicken' | 'magnet' | 'bomb' | 'clock' | 'chest';

export interface Pickup {
  kind: PickupKind;
  x: number; y: number; value: number;
  vx: number; vy: number;
  pull: boolean;                   // 흡수 중
  t: number;                       // 생성 후 경과
  dead: boolean;
  bossChest?: boolean;
  pt: number;                      // 흡수 경과 시간
}

export interface Player {
  x: number; y: number; r: number;
  px: number; py: number;          // 직전 스텝 위치(렌더 보간)
  hp: number;
  fx: number; fy: number;          // 바라보는 방향(단위 벡터)
  mx: number; my: number;          // 이번 스텝 이동 입력(-1..1)
  moving: boolean;
  level: number; xp: number; xpNext: number;
  hurtT: number;                   // 피격 연출
  invulnT: number;                 // 무적
  ult: number; ultMax: number;
  ultActiveT: number;              // 지속형 궁극기 남은 시간
  clockT: number;                  // 시계 아이템(적 정지) 남은 시간
  revivals: number; rerolls: number; skips: number; banishes: number;
  noHitT: number;                  // 무피격 연속 시간
  walk: number;                    // 걷기 애니메이션 위상
}

export type Phase = 'play' | 'levelup' | 'chest' | 'lunch' | 'victory' | 'dead' | 'over';

export interface LevelChoice {
  kind: 'newWeapon' | 'weapon' | 'newPassive' | 'passive' | 'heal' | 'coins';
  id: string;                      // 무기/패시브 id ('' for heal/coins)
  level: number;                   // 선택 시 도달할 레벨
  desc: string;
}

export interface ChestResult {
  items: { kind: 'evolve' | 'weapon' | 'passive' | 'coins' | 'heal'; id: string; from?: string; level: number }[];
  coins: number;
  boss: boolean;
}

/** 시뮬레이션 → UI/사운드 이벤트 큐 (매 프레임 비움) */
export type SimEvent =
  | { t: 'kill'; x: number; y: number; elite: boolean; boss: boolean; id: string }
  | { t: 'hit'; x: number; y: number; dmg: number; crit: boolean; uid: number }
  | { t: 'hurt'; dmg: number }
  | { t: 'shoot'; w: string }
  | { t: 'explode'; x: number; y: number; r: number; color: string; big: boolean }
  | { t: 'gem' }
  | { t: 'coin' }
  | { t: 'item'; kind: PickupKind }
  | { t: 'levelup'; level: number }
  | { t: 'toast'; text: string; kind?: 'info' | 'warn' | 'boss' | 'good' }
  | { t: 'bossSpawn'; name: string; id: string }
  | { t: 'bossDead'; name: string }
  | { t: 'elite'; name: string }
  | { t: 'ult'; id: string; shout: string }
  | { t: 'evolve'; from: string; to: string }
  | { t: 'hour'; hour: number }
  | { t: 'shout'; text: string; x: number; y: number }
  | { t: 'revive' }
  | { t: 'chain'; pts: number[]; color: string }
  | { t: 'yageun' }
  | { t: 'clear' }
  | { t: 'enemyShot' }
  | { t: 'maxed'; id: string };

export interface RunConfig {
  stage: StageDef;
  character: CharacterDef;
  seed: number;
  heat: number;                    // 0..10
  modifiers: ModifierDef[];        // 일일 도전 등 추가 규칙
  meta: Partial<Record<StatKey, number>>;   // 영구 강화 합산 스탯
  unlockedWeapons: Set<string>;
  unlockedPassives: Set<string>;
  unlockedLunches: Set<string>;
  daily: boolean;
  dailyDate: string;               // 오늘의 업무 날짜(자정을 넘긴 판 정산 구분)
  overtimeAllowed: boolean;
}

/** 결과 화면·업적용 한 판 기록 */
export interface RunStats {
  kills: number;
  eliteKills: number;
  bossKills: string[];
  evolves: string[];
  maxed: string[];
  ultUses: number;
  chests: number;
  coins: number;
  damageTaken: number;
  lunch: string | null;
  pickups: Record<string, number>;
  maxNoHit: number;
  weaponKills: Record<string, number>;
  weaponDmg: Record<string, number>;
  levelAt: Record<number, number>;  // 정각별 레벨 기록(밸런스 분석)
  killsAt: Record<number, number>;
  cleared: boolean;
  overtimeSec: number;
  killedBy: string | null;
}

export interface World {
  cfg: RunConfig;
  rng: Rng;
  fxRng: Rng;                      // 시각 효과 전용(판정과 분리)
  t: number;                       // 경과 초(야근 확정 중에는 증가하지만 시계 표시는 17:59)
  clockT: number;                  // 표시용 시계 초(0..600, 이후 야근)
  step: number;
  phase: Phase;
  player: Player;
  base: Stats;                     // 캐릭터+메타+모디파이어+점심 합산 (패시브 제외)
  stats: Stats;                    // 최종 합산
  d: Derived;
  weapons: WeaponInst[];
  passives: PassiveInst[];
  banished: Set<string>;
  lunch: LunchDef | null;
  ultimate: UltimateDef;
  enemies: Enemy[];
  bullets: Bullet[];
  ebullets: EnemyBullet[];
  blasts: Blast[];
  zones: Zone[];
  beams: Beam[];
  rings: Ring[];
  pickups: Pickup[];
  grid: SpatialGrid<Enemy>;
  nextUid: number;
  spawnAcc: number;
  eventIdx: number;
  seenEnemies: Set<string>;
  bossAlive: Enemy | null;         // 화면 상단 체력바 대상
  finalBossSpawned: boolean;
  finalBossDead: boolean;
  yageun: boolean;                 // 야근 확정 상태
  overtime: boolean;               // 야근 모드 진행 중
  cleared: boolean;
  levelQueue: number;              // 대기 중인 레벨업 수
  choices: LevelChoice[];
  chest: ChestResult | null;
  chestQueue: { boss: boolean }[];
  lunchChoices: LunchDef[];
  events: SimEvent[];
  viewW: number; viewH: number;    // 월드 단위 화면 크기(소환 위치 계산)
  hitStop: number;                 // 히트스톱 남은 시간(실시간)
  stats_: RunStats;
  enemyHpMul: number; enemySpeedMul: number; enemyDmgMul: number; spawnMul: number; xpMul: number; coinMul: number;
  flags: Set<string>;
  lastHour: number;
  lunchOffered: boolean;
  gemCount: number;
  refillAcc: number;
  lsBudget: number;
  shotBudget: number;
  wrapUp: boolean;                 // 18:00 퇴근 정리 중
  clearT: number;                  // 퇴근 정리 남은 시간
  clearHp: number;                 // 칼퇴 순간 체력 비율(아슬아슬 칼퇴 업적)
  overtimeStart: number;           // 야근 모드 시작 시각(t)              // 일반 원거리 적 초당 발사 예산                // 흡혈 회복 예산(초당 충전)               // 최소 생존 보충 누적                // 바닥의 경험치 보석 수(병합 판단)
  damageMulT: number; damageMulAmt: number;  // 궁극기 vacuum 버프
  fireMulT: number; fireMul: number;         // 궁극기 clone 버프
}

export type { WeaponDef, EnemyDef, StageDef, CharacterDef };
