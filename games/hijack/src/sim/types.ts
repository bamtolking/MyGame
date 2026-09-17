// 공용 타입. 순수 시뮬레이션(DOM 없음)에서 사용.
export type BodyId = 'intruder' | 'scout' | 'shield' | 'bomber' | 'sniper' | 'mechanic' | 'turret' | 'boss' | 'node';
export type Team = 'player' | 'enemy';

export interface Vec { x: number; y: number }

export type WeaponKind = 'rapid' | 'burst' | 'shotgun' | 'lob' | 'pierce' | 'arc' | 'turret' | 'none';

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  damage: number;
  /** 초당 발사 횟수(연사 간격 = 1/rate) */
  rate: number;
  range: number;
  speed: number;
  pellets?: number;
  spread?: number;
  burst?: number;
  burstGap?: number;
  /** 발사 전 준비 시간(초). 저격 예고선 등 */
  windup?: number;
  splash?: number;
  /** 벽을 넘어가는 투사체(폭탄) */
  overWalls?: boolean;
  pierce?: boolean;
  chain?: number;
  chainRange?: number;
  shock?: number;
  knockback?: number;
  /** 비행 시간(포물선) */
  flight?: number;
  color: string;
}

export type SkillId = 'dash' | 'sprint' | 'guard' | 'bigbomb' | 'aimshot' | 'repairpulse';

export interface SkillDef {
  id: SkillId;
  name: string;
  /** HUD에 표시되는 한 줄 설명 */
  desc: string;
  cooldown: number;
  duration?: number;
}

export interface AIProfile {
  /** 선호 교전 거리 */
  preferRange: number;
  /** 이 거리보다 가까우면 물러남 */
  tooClose: number;
  /** 회전 속도(rad/s) */
  turnRate: number;
  /** 감지 거리 */
  sight: number;
  strafe: boolean;
}

export interface BodyDef {
  id: BodyId;
  name: string;
  role: string;
  /** 도감 설명 */
  desc: string;
  /** 갈아탄 직후 표시되는 한 줄 */
  swapHint: string;
  hp: number;
  speed: number;
  radius: number;
  /** null = 안정도 없음(기본 몸·기계) */
  stability: number | null;
  stabilityDecay: number;
  stabilityDamageFactor: number;
  weapon: WeaponDef;
  skill: SkillDef | null;
  possessable: boolean;
  /** 전방 방어 반각(rad). 0이면 없음 */
  blockArc: number;
  guardArc: number;
  ai: AIProfile;
  color: string;
  accent: string;
}

export type AIState = 'idle' | 'alert';

export interface Entity {
  id: number;
  body: BodyId;
  team: Team;
  controlled: boolean;
  x: number; y: number;
  vx: number; vy: number;
  /** 직전 스텝 이동 속도(조준 예측용) */
  mvx: number; mvy: number;
  facing: number;
  radius: number;
  hp: number; hpMax: number;
  stability: number | null; stabilityMax: number | null;
  collapsing: boolean;
  alive: boolean;
  attackCd: number;
  skillCd: number;
  /** 스킬 지속 종료 시각 */
  skillUntil: number;
  windup: number;
  windupTarget: Vec | null;
  burstLeft: number;
  burstVolley: number;
  burstTimer: number;
  invulnUntil: number;
  lastVolley: number;
  volleyDamage: number;
  hitFlash: number;
  shock: number;
  stunUntil: number;
  slowUntil: number;
  contactCd: number;
  /** 갈아탄 시각(연출용) */
  possessedAt: number;
  /** 포탑 정지 등 */
  disabled: boolean;
  /** 정밀 사격 대기 중 */
  aimshotPending: boolean;
  dashDir: Vec | null;
  lastHitAt: number;
  stabWarned: boolean;
  /** AI 방어 자세 등 스킬 쿨다운은 skillCd 공용 */
  guardHits: number;
  ai: {
    state: AIState;
    home: Vec;
    strafeDir: number;
    thinkT: number;
    wander: Vec | null;
    healCd: number;
    alertedAt: number;
    lostT: number;
    /** 보스 전용 */
    phase: number;
    patternT: number;
    ringT: number;
    laserT: number;
    laserTarget: Vec | null;
    chargeT: number;
    chargeDir: Vec | null;
    exposedUntil: number;
    summonT: number;
    shielded: boolean;
    laserAge: number;
    laserHit: boolean;
    chargeTele: number;
    chargeDash: number;
  };
  /** 웨이브/보스 소환 그룹 */
  tag: string;
  /** 사망 처리(1회) */
  deadHandled: boolean;
  /** 죽었을 때 위치 표시 등 */
  deathT: number;
}

export type ProjectileKind = 'bullet' | 'pellet' | 'bomb' | 'pierce' | 'turret' | 'boss';

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  team: Team;
  ownerId: number;
  ownerBody: BodyId;
  x: number; y: number; vx: number; vy: number;
  damage: number;
  ttl: number;
  radius: number;
  pierce: boolean;
  hitIds: number[];
  splash: number;
  overWalls: boolean;
  knockback: number;
  shock: number;
  volley: number;
  /** 포물선용 */
  sx: number; sy: number; tx: number; ty: number; flight: number; t: number;
  /** 지연 폭탄(발 밑에 설치) */
  fuse: number;
  selfDamage: boolean;
  breaksWalls: boolean;
  color: string;
}

export type DeviceKind = 'crackedWall' | 'switch' | 'door' | 'panel' | 'repair' | 'overload' | 'exit' | 'spawner';

export interface DeviceBase { id: string; kind: DeviceKind; x: number; y: number }
export interface CrackedWall extends DeviceBase { kind: 'crackedWall'; tx: number; ty: number; hp: number; hpMax: number; broken: boolean }
export interface SwitchDev extends DeviceBase { kind: 'switch'; on: boolean; doorId: string; radius: number }
export interface DoorDev extends DeviceBase { kind: 'door'; tiles: { tx: number; ty: number }[]; open: boolean; label: string; lock: 'none' | 'switch' | 'panel' | 'waves' | 'overload' }
export interface PanelDev extends DeviceBase { kind: 'panel'; doorId: string; used: boolean; channel: number; channelNeed: number }
export interface RepairDev extends DeviceBase { kind: 'repair'; uses: number; channel: number }
export interface OverloadDev extends DeviceBase { kind: 'overload'; used: boolean; turretTag: string; doorId: string | null; channel: number }
export interface ExitDev extends DeviceBase { kind: 'exit'; tiles: { tx: number; ty: number }[]; open: boolean }
export interface SpawnerDev extends DeviceBase { kind: 'spawner'; tag: string }
export type Device = CrackedWall | SwitchDev | DoorDev | PanelDev | RepairDev | OverloadDev | ExitDev | SpawnerDev;

export interface WaveSpec { at: number; spawns: { body: BodyId; spawner: string }[]; label: string }

export interface Input {
  mx: number; my: number;
  attack: boolean;
  skill: boolean;
  possess: boolean;
  interact: boolean;
}

export type EventType =
  | 'shot' | 'hit' | 'block' | 'explode' | 'die' | 'possess' | 'possessFail' | 'skill' | 'collapseWarn' | 'collapseStart'
  | 'wallBreak' | 'switch' | 'door' | 'turretOff' | 'repair' | 'bossWarn' | 'bossPhase' | 'bossDie' | 'zoneEnter' | 'stun'
  | 'lastChance' | 'defeat' | 'victory' | 'wave' | 'laser' | 'shock' | 'pickup' | 'hint';

export interface GameEvent {
  type: EventType;
  x?: number; y?: number;
  body?: BodyId;
  text?: string;
  amount?: number;
  dir?: number;
  fromX?: number; fromY?: number;
  id?: number;
}

export interface RunStats {
  possessions: number;
  bodiesUsed: BodyId[];
  kills: number;
  damageTaken: number;
  timeByBody: Partial<Record<BodyId, number>>;
  usedShield: boolean;
  lastChanceSaves: number;
  zoneTimes: number[];
}

export type Phase = 'playing' | 'zoneclear' | 'victory' | 'defeat';
