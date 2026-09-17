import type { RngState } from './rng.ts';
import type { Kind, Grade, Element } from '../data/units.ts';
import type { MonsterType } from '../data/monsters.ts';

export type Phase = 'countdown' | 'playing' | 'eliminated' | 'won';
export type Mode = 'solo' | 'multi';

export interface Unit {
  id: number; kind: Kind; grade: Grade; slot: number;
  cd: number;            // 남은 공격 대기(초)
  dmg: number; kills: number; born: number; // 통계
  lastShot: number;      // 마지막 공격 시각(연출)
}

export interface Monster {
  id: number; type: MonsterType; boss: boolean; round: number;
  hp: number; maxHp: number;
  dist: number; laps: number; speed: number; x: number; y: number;
  slowAmt: number; slowT: number; stunT: number; stunImmT: number;
  auraSlow: number;      // 눈보라 여왕 상시 감속(매 스텝 재계산)
  alive: boolean;
}

export interface Spawn { at: number; type: MonsterType; hp: number; speed: number; boss: boolean; round: number }

export type SimEvent =
  | { t: 'shot'; from: number; x1: number; y1: number; x2: number; y2: number; kind: Kind; grade: Grade; kill: boolean; targets?: { x: number; y: number }[] }
  | { t: 'hit'; x: number; y: number; kind: Kind }
  | { t: 'die'; x: number; y: number; boss: boolean; gold: number }
  | { t: 'summon'; slot: number; grade: Grade; kind: Kind }
  | { t: 'merge'; slot: number; grade: Grade; kind: Kind; confirmed: boolean }
  | { t: 'mythic'; slot: number; kind: Kind }
  | { t: 'round'; n: number; boss: boolean }
  | { t: 'gold'; amount: number; x: number; y: number }
  | { t: 'eliminated'; reason: string }
  | { t: 'won' }
  | { t: 'levelup'; what: 'summon' | 'atk' };

export interface Stats {
  kills: number; bossKills: number; damage: number; summons: number; merges: number; crafts: number;
  goldEarned: number; goldSpent: number; goldSent: number; goldReceived: number;
  peakGrade: Grade; mythics: Kind[]; roundReached: number; playTime: number;
  gradeCount: number[]; // 소환 등급 분포
}

export interface GameState {
  version: number; seed: number; rng: RngState; mode: Mode;
  time: number; phase: Phase; countdownT: number;
  round: number; roundT: number; roundStartedAt: number;
  spawnQueue: Spawn[];
  gold: number; summonLv: number; atkLv: number;
  units: Unit[]; slots: (number | null)[]; monsters: Monster[]; nextId: number;
  bossId: number | null; bossDeadline: number | null; bossRound: number;
  eliminatedReason: string; eliminatedRound: number;
  stats: Stats; events: SimEvent[]; log: { text: string; kind: string; time: number }[];
}

export type { Kind, Grade, Element, MonsterType };
