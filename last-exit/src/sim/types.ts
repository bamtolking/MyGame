// 순수 시뮬레이션 타입. 렌더링 객체를 포함하지 않으며 전부 JSON 직렬화 가능해야 한다.
import type { RngState } from './rng';

export type WeaponId = 'rifle' | 'shotgun' | 'staff';
export type AbilityId = 'rapid' | 'pierce' | 'shock' | 'frost' | 'magnet' | 'light' | 'shield' | 'mend';
export type LootId = 'scrap' | 'parts' | 'relic';
export type EnemyType = 'chaser' | 'runner' | 'shooter' | 'armored' | 'bomber' | 'boss';
export type Difficulty = 'normal' | 'hard';
export type RunStatus = 'active' | 'escaped' | 'dead' | 'abandoned';
/** combat: 전투 목표 미완료 / cleared: 목표 완료(출구 개방) / ability: 능력 선택 대기 / escaping: 탈출 준비 중 / done: 출정 종료 */
export type Phase = 'combat' | 'cleared' | 'ability' | 'escaping' | 'done';

export type EnemyState = 'spawn' | 'chase' | 'hold' | 'windup' | 'charge' | 'fuse' | 'recover' | 'dead';

export interface Player {
  x: number; y: number;
  hp: number; maxHp: number; shield: number;
  /** 마지막 이동 방향(단위 벡터). 정지 시 대시 방향으로 사용 */
  moveX: number; moveY: number;
  /** 조준 방향(단위 벡터). 타깃이 있으면 타깃 방향 */
  aimX: number; aimY: number;
  moving: boolean;
  dashT: number; dashCd: number; dashDx: number; dashDy: number;
  invulnT: number; hurtT: number; hurtDx: number; hurtDy: number;
  fireCd: number; recoil: number;
  /** 원본 공격(방아쇠) 횟수 — 충격탄 계산용 */
  shots: number;
  targetId: number | null;
  walk: number;
}

export interface BossRt {
  phase: 1 | 2;
  pattern: 'idle' | 'cone' | 'ring' | 'summon';
  patternT: number;      // 현재 패턴 경과 시간
  telegraph: number;     // 예고 시간
  dirA: number;          // 부채꼴 방향(라디안)
  fired: boolean;        // 실제 판정 발생 여부
  cycle: number;         // 패턴 순서 인덱스
  summons: number;       // 소환 횟수
  restT: number;
  ringOffset: number;
}

export interface Enemy {
  id: number; type: EnemyType;
  x: number; y: number; r: number;
  hp: number; maxHp: number;
  state: EnemyState; stateT: number;
  dirX: number; dirY: number;   // 돌진/윈드업 방향
  slowT: number; slowMul: number;
  cd: number;                    // 공격 재사용 대기
  noLoot: boolean;               // 추격/경보/소환 적은 전리품 없음
  hitFlash: number;
  stuckT: number; lastX: number; lastY: number;
  flash: number;                 // 피격 표시
  boss: BossRt | null;
  wander: number;
}

export interface Projectile {
  id: number;
  owner: 'player' | 'enemy';
  /** weapon: 원본 공격 / shock: 충격탄 폭발(연쇄 금지) / boss, shooter: 적 공격 */
  src: 'weapon' | 'shock' | 'boss' | 'shooter';
  x: number; y: number; vx: number; vy: number;
  dmg: number; r: number; life: number;
  pierce: number; hitIds: number[];
  kind: 'bullet' | 'pellet' | 'orb' | 'ring';
  knock: number;
  volley: number;
  shock: boolean;
}

export interface LootDrop {
  id: number; type: LootId; count: number;
  x: number; y: number;
  attract: boolean; blocked: boolean; noPickT: number;
  /** 버린 물건: 자동으로 끌려오지 않고 직접 밟아야 줍는다. 통계에 다시 집계하지 않음 */
  dropped?: boolean;
}

export interface Chest {
  id: number; x: number; y: number;
  kind: 'chest' | 'safe';
  opened: boolean;
  loot: { type: LootId; count: number }[];
  alarmCount: number;
}

export interface PendingSpawn { x: number; y: number; type: EnemyType; t: number; noLoot: boolean }

export interface WaveDef { at?: number; atKills?: number; groups: { type: EnemyType; n: number }[]; spawns?: number[] }


export interface ZoneRt {
  index: number;
  w: number; h: number;
  /** 행 단위 타일 문자열 (붕괴 이후 변경 반영) */
  rows: string[];
  startX: number; startY: number;
  door: { x: number; y: number; open: boolean } | null;
  exitPad: { x: number; y: number; r: number; final: boolean } | null;
  spawnPoints: { x: number; y: number }[];
  waves: WaveDef[]; waveIdx: number; lastWaveT: number;
  killsRequired: number; kills: number;
  collapse: { state: 'idle' | 'warn' | 'done'; t: number; atKills: number } | null;
  drone: { x: number; y: number; used: boolean; heal: number; pay: { type: LootId; count: number }[] } | null;
  bossSpawned: boolean; bossDead: boolean;
  cleared: boolean;
  chestsTotal: number;
}

export interface EscapeRt {
  progress: number; need: number;
  active: boolean; inside: boolean;
  /** 추격 적 예약 (활성 시간 기준). 한 탈출구당 한 번만 예약 */
  waves: { at: number; type: EnemyType; n: number }[];
  waveIdx: number; elapsed: number;
  final: boolean;
}

export interface Flags {
  zoneCleared: number[];
  abilityPicked: number[];
  healZone: number[];
  shieldZone: number[];
  tier: string[];
  bossReward: boolean;
  tutorialStep: number;
}

export interface Stats {
  damageTaken: number[]; lootValue: number[]; time: number[]; kills: number[];
  maxWeight: number; drops: number; safesOpened: number; chestsOpened: number; dashes: number; hits: number;
}

export interface RunResult {
  kind: 'escaped' | 'dead';
  value: number; items: Record<LootId, number>; zone: number; cause: string; time: number; boss: boolean;
}

export type SimEvent =
  | { t: 'shot'; weapon: WeaponId; x: number; y: number; a: number; tier: number }
  | { t: 'hit'; x: number; y: number; crit?: boolean }
  | { t: 'kill'; type: EnemyType; x: number; y: number }
  | { t: 'beam'; pts: number[]; tier: number }
  | { t: 'explode'; x: number; y: number; r: number; kind: 'shock' | 'bomber' | 'boss' }
  | { t: 'pickup'; type: LootId; count: number; x: number; y: number }
  | { t: 'chest'; x: number; y: number; kind: 'chest' | 'safe' }
  | { t: 'hurt'; dx: number; dy: number; amount: number; shield: boolean }
  | { t: 'dash' }
  | { t: 'spawnWarn'; x: number; y: number }
  | { t: 'collapseWarn' } | { t: 'collapse' }
  | { t: 'escaped' } | { t: 'dead'; cause: string }
  | { t: 'bossPhase' } | { t: 'bossSpawn' } | { t: 'bossDead' }
  | { t: 'cleared'; zone: number }
  | { t: 'alarm' }
  | { t: 'bagFull' }
  | { t: 'drop'; type: LootId; count: number }
  | { t: 'toast'; text: string; kind: 'info' | 'warn' | 'good' | 'bad' }
  | { t: 'escapeStart' } | { t: 'escapeCancel' }
  | { t: 'zoneEnter'; zone: number }
  | { t: 'tier'; tier: number }
  | { t: 'heal'; amount: number } | { t: 'shield'; amount: number }
  | { t: 'knock'; id: number };

export interface RunState {
  v: number;
  runId: string; seed: number; rng: RngState;
  difficulty: Difficulty;
  status: RunStatus; phase: Phase;
  weapon: WeaponId; tier: number;
  abilities: Partial<Record<AbilityId, number>>;
  abilityOffer: AbilityId[] | null;
  zone: number; time: number; zoneTime: number;
  player: Player;
  bag: { items: Record<LootId, number>; maxWeight: number };
  enemies: Enemy[]; projectiles: Projectile[]; loots: LootDrop[]; chests: Chest[]; spawns: PendingSpawn[];
  zoneRt: ZoneRt;
  escape: EscapeRt | null;
  flags: Flags; stats: Stats;
  nextId: number; volley: number;
  result: RunResult | null;
  /** 렌더/UI가 소비하는 일회성 이벤트 — 저장 시 비움 */
  events: SimEvent[];
  bossBar: { hp: number; max: number; phase: number } | null;
}

export interface Input { mx: number; my: number; dash: boolean }

export type Action =
  | { type: 'interact' }
  | { type: 'requestEscape' }
  | { type: 'cancelEscape' }
  | { type: 'drop'; loot: LootId; n: number }
  | { type: 'pickAbility'; id: AbilityId }
  | { type: 'enterDoor' }
  | { type: 'openSafe'; id: number }
  | { type: 'droneTrade' };

export interface ActionResult { ok: boolean; msg?: string }
