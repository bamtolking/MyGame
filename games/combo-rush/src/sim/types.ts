import type { UnitKind, Grade } from '../data/units';
import type { EnemyKind } from '../data/enemies';
import type { MapId } from '../data/maps';
import type { Difficulty } from '../data/waves';
import type { ComboId } from '../data/combos';
import type { RngState } from './rng';

export type Phase = 'prep' | 'wave' | 'won' | 'lost';

export interface Unit {
  id: number; kind: UnitKind; grade: Grade; slot: number;
  invested: number;      // 실제 투입 골드(판매 환급 기준)
  cd: number;            // 남은 공격 대기시간
  moveCd: number;        // 이동 재사용 대기
  charge: number;        // 과충전 충전량(레이저·연계⑥)
  overcharged: boolean;  // 다음 발사 과충전 여부
  boost: number;         // 3등급 공병 발전기 강화(다음 공격 배율, 1=없음)
  pulseT: number;        // 공병 3등급 발전기 타이머
  fireVortexT: number;   // 화염 회오리 남은 시간
  fireVortexCd: number;  // 화염 회오리 재발동 대기
  pullT: number;         // 회오리 끌기 진행 시간
  facing: number;        // 마지막 조준 방향(라디안)
  kills: number; dmg: number; bornWave: number;
}

export interface Status {
  oil: number; burn: number; burnDps: number; chill: number; chillPct: number;
  frozen: number; freezeImmune: number; mark: number; shield: number; shieldT: number;
  igniteCd: number; shardCd: number; bossSlow: number; bossSlowT: number;
}

export interface BossRt {
  enraged: boolean;
  shieldTimer: number; hasteTimer: number; hasteT: number;
  minionsDone: number;
  telegraph: { kind: 'shield' | 'haste' | 'minion'; t: number } | null;
}

export interface Enemy {
  id: number; kind: EnemyKind; hp: number; maxHp: number; dist: number; speed: number;
  x: number; y: number; alive: boolean; reward: number; armor: number; lifeDmg: number;
  st: Status; droneT: number; wave: number; spawnedBy: number | null; boss: BossRt | null;
  pullBy: number | null; // 현재 끌고 있는 회오리 유닛 id
  dotAcc: number; dotT: number; // 지속 피해 숫자 표시용 누적
}

export type ProjKind = 'flame' | 'oil' | 'frost' | 'bomb' | 'frag';
export interface Projectile {
  id: number; kind: ProjKind; x: number; y: number; sx: number; sy: number; tx: number; ty: number;
  targetId: number; t: number; dur: number; dmg: number; src: number; srcKind: UnitKind; grade: Grade;
  radius: number; combo: boolean; boost: number;
}

export interface WaveRt { index: number; queue: { at: number; kind: EnemyKind; hpMul: number }[]; t: number; spawned: number; startedAt: number }

export interface RunStats { dmgByKind: Record<string, number>; kills: number; combos: Record<string, number>; summons: number; merges: number; sells: number; goldEarned: number; goldSpent: number; playTime: number; lifeLostBy: Record<string, number>; peakGrade: number; bossKills: string[]; refreshes: number }

export type SimEvent =
  | { t: 'shoot'; unit: number; kind: UnitKind; grade: Grade; x: number; y: number; tx: number; ty: number; boost?: boolean }
  | { t: 'beam'; unit: number; x: number; y: number; x2: number; y2: number; width: number; over: boolean; grade: Grade }
  | { t: 'cone'; unit: number; x: number; y: number; angle: number; spread: number; range: number }
  | { t: 'chain'; pts: number[]; frost: boolean; grade: Grade }
  | { t: 'hit'; enemy: number; x: number; y: number; dmg: number; kind: string }
  | { t: 'explode'; x: number; y: number; r: number; kind: 'bomb' | 'frag' | 'ignite' | 'focus' | 'shards' | 'frostsplash' }
  | { t: 'vortex'; unit: number; x: number; y: number; r: number; fire: boolean; grade: Grade }
  | { t: 'status'; enemy: number; x: number; y: number; kind: 'oil' | 'chill' | 'freeze' | 'shield' | 'burn' | 'mark' }
  | { t: 'die'; enemy: number; kind: EnemyKind; x: number; y: number; boss: boolean }
  | { t: 'leak'; x: number; y: number; dmg: number }
  | { t: 'place'; unit: number; x: number; y: number }
  | { t: 'merge'; unit: number; x: number; y: number; grade: Grade; fromX: number; fromY: number }
  | { t: 'sell'; x: number; y: number; gold: number }
  | { t: 'combo'; id: ComboId; x: number; y: number; first: boolean }
  | { t: 'wave'; index: number }
  | { t: 'boss'; kind: EnemyKind; x: number; y: number }
  | { t: 'bosspattern'; kind: 'shield' | 'haste' | 'minion' | 'enrage'; phase: 'warn' | 'go'; x: number; y: number }
  | { t: 'gold'; x: number; y: number; amount: number }
  | { t: 'overcharge'; unit: number; x: number; y: number }
  | { t: 'engpulse'; unit: number; x: number; y: number; r: number }
  | { t: 'won' } | { t: 'lost' }
  | { t: 'msg'; text: string; kind: 'info' | 'warn' | 'good' };

export interface GameState {
  version: number; runId: string; mapId: MapId; difficulty: Difficulty;
  seed: number; rng: RngState; time: number;
  phase: Phase; wave: number; prepT: number; prepMax: number; waveRt: WaveRt | null;
  life: number; maxLife: number; gold: number;
  nextId: number;
  units: Unit[]; slots: (number | null)[];
  enemies: Enemy[]; projectiles: Projectile[];
  offer: UnitKind[]; refreshFree: number; refreshCount: number; offerSerial: number;
  combosSeen: ComboId[];
  events: SimEvent[]; stats: RunStats; log: string[];
  rewardClaimed: boolean; tutorial: boolean;
}
