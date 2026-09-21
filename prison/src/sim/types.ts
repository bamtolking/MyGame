import type { Activity } from '../data/regime';
import type { SecurityLevel, Difficulty } from '../data/economy';
import type { Policy } from '../data/policy';
import type { ObjType } from '../data/objects';
import type { StaffType } from '../data/staff';

export interface Vec { x: number; y: number }

export const NEED_KEYS = ['hunger', 'sleep', 'hygiene', 'exercise', 'recreation', 'freedom', 'safety'] as const;
export type NeedKey = typeof NEED_KEYS[number];
export type Needs = Record<NeedKey, number>;
export const NEED_INFO: Record<NeedKey, { name: string; weight: number; icon: string }> = {
  hunger: { name: '배고픔', weight: 1.5, icon: '🍽' },
  sleep: { name: '피로', weight: 1.2, icon: '💤' },
  hygiene: { name: '위생', weight: 0.6, icon: '🚿' },
  exercise: { name: '운동', weight: 0.7, icon: '🏃' },
  recreation: { name: '여가', weight: 0.8, icon: '📺' },
  freedom: { name: '자유', weight: 1.2, icon: '🔓' },
  safety: { name: '불안', weight: 1.0, icon: '🛡' },
};

export type PState = 'idle' | 'move' | 'sleep' | 'eat' | 'shower' | 'rest' | 'work' | 'fight' | 'escape' | 'subdued' | 'heal' | 'release' | 'wait';
export type Intent = 'none' | 'sleep' | 'eat' | 'shower' | 'yard' | 'common' | 'work' | 'cell' | 'holding' | 'solitary' | 'infirmary' | 'escape' | 'release' | 'wander' | 'riot';

export type Trait = 'violent' | 'escapist' | 'leader' | 'worker' | 'calm';
export const TRAIT_INFO: Record<Trait, { name: string; icon: string; desc: string }> = {
  violent: { name: '폭력적', icon: '👊', desc: '분노가 빨리 쌓임' },
  escapist: { name: '탈주 성향', icon: '🏃', desc: '기회가 있으면 탈주, 밤에 터널을 팜' },
  leader: { name: '리더', icon: '👑', desc: '분노하면 주변 수감자를 선동' },
  worker: { name: '성실', icon: '🔧', desc: '노동 수입 1.5배' },
  calm: { name: '온순', icon: '🕊', desc: '분노가 천천히 쌓임' },
};
export interface Prisoner {
  id: number; name: string; sec: SecurityLevel; volatility: number; escapist: boolean; traits: Trait[]; tunnel: number; strikes: number;
  x: number; y: number; hp: number; maxHp: number;
  needs: Needs; mood: number; anger: number;
  state: PState; intent: Intent; stateT: number;
  path: Vec[] | null; pathI: number; target: Vec | null;
  useObj: number; bedId: number;
  sentence: number; arrivedDay: number;
  punishedUntil: number; injured: boolean; rioter: boolean;
  fightId: number; thinkT: number; lastRoom: number; calmT: number; waitT: number; lastMeal: number;
  toRoom: number; // room id the prisoner is heading to (-1 none)
}

export type SState = 'idle' | 'move' | 'work' | 'fight' | 'chase' | 'injured' | 'leave';
export interface Staff {
  id: number; type: StaffType; name: string;
  x: number; y: number; hp: number; maxHp: number;
  state: SState; stateT: number; path: Vec[] | null; pathI: number; target: Vec | null;
  jobId: number; fightId: number; chaseId: number; useObj: number; thinkT: number;
  temp: boolean; leaveAt: number; patrolT: number;
}

export interface GameObject { id: number; type: ObjType; x: number; y: number; users: number; owner: number; built: boolean }

export type JobKind = 'build' | 'demolish';
export interface Job {
  id: number; kind: JobKind; x: number; y: number;
  struct: number; // struct index for build (0 = none)
  obj: ObjType | null; objId: number; // for object build (objId = the ghost object) / demolish
  progress: number; total: number; cost: number; workerId: number; unreachable: boolean; retryT: number;
}

export interface Room { id: number; zone: number; tiles: number[]; objs: number[]; valid: boolean; secure: boolean; issues: string[]; cx: number; cy: number }

export interface Fight { id: number; x: number; y: number; prisoners: number[]; guards: number[]; t: number; riot: boolean; lastHit: number }

export interface DayFinance { day: number; grant: number; wages: number; food: number; build: number; work: number; fines: number; bonus: number; grade: string; mood: number; incidents: number }

export interface Stats { escapes: number; deaths: number; released: number; riots: number; fights: number; workIncome: number; daysNoIncident: number; moodDays: number; todayIncidents: number; moodSamples: number[]; intake: number; subdued: number; tunnelsFound: number; todayFights: number; bestGrade: string; searches: number }

export type Phase = 'play' | 'won' | 'bankrupt' | 'fired';

export interface SimEvent { type: string; text?: string; x?: number; y?: number; kind?: 'info' | 'warn' | 'bad' | 'good'; data?: any }

export interface GameState {
  version: number; seed: number; rngState: number[];
  time: number; phase: Phase; mode: 'empty' | 'quick'; difficulty: Difficulty;
  policy: Policy; wageMul: number; lastSearch: number; yardClosedDay: number; blackoutDay: number;
  pendingEvent: { id: string; day: number } | null; lastEventDay: number; eventHour: number; recentEvents: string[];
  w: number; h: number; entry: Vec;
  terrain: Uint8Array; struct: Uint8Array; zone: Uint8Array; objAt: Int32Array;
  objects: GameObject[]; jobs: Job[]; prisoners: Prisoner[]; staff: Staff[]; fights: Fight[];
  nextId: number;
  money: number; reputation: number; meals: number; mealCap: number;
  regime: Activity[]; autoIntake: boolean; intakeMix: Record<SecurityLevel, boolean>; unlocked: SecurityLevel[];
  chapter: number; chapterDoneAt: number;
  lockdown: boolean; riot: boolean; riotSquadUntil: number;
  finance: { today: DayFinance; history: DayFinance[] };
  stats: Stats; log: { t: number; text: string; kind: string }[];
  lastHour: number; lastIntakeDay: number; lastDay: number;
  // derived caches (not serialized)
  cache: SimCache;
  events: SimEvent[];
}

export interface SimCache {
  insecure: Uint8Array; rooms: Room[]; roomAt: Int32Array; dirtyRooms: boolean; dirtySecurity: boolean;
  objIndex: Map<number, GameObject>; prisonerIndex: Map<number, Prisoner>; staffIndex: Map<number, Staff>;
  jobAt: Int32Array; // job id per tile or -1
  riotCheckT: number; objectiveT: number; hourlyT: number;
}
