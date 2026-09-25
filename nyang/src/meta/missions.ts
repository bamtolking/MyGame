// 오늘의 미션 3개 (쉬움·보통·어려움). 날짜로 정해지고, 그날 여러 판에 걸쳐 진행된다.
import { hashString, makeRng, int } from '../sim/rng';

export type MissionKind = 'merges' | 'games' | 'powers' | 'nips' | 'tier' | 'combo' | 'score' | 'gold' | 'fever' | 'daily';

export interface MissionDef {
  id: string;
  kind: MissionKind;
  target: number;
  /** tier 미션: 이 단계 이상 */
  tier?: number;
  xp: number;
}

const EASY: MissionDef[] = [
  { id: 'e-merges', kind: 'merges', target: 40, xp: 100 },
  { id: 'e-games', kind: 'games', target: 2, xp: 100 },
  { id: 'e-powers', kind: 'powers', target: 3, xp: 100 },
  { id: 'e-nips', kind: 'nips', target: 2, xp: 100 },
  { id: 'e-tier4', kind: 'tier', tier: 4, target: 6, xp: 100 },
];
const MID: MissionDef[] = [
  { id: 'm-combo4', kind: 'combo', target: 4, xp: 200 },
  { id: 'm-score', kind: 'score', target: 25000, xp: 200 },
  { id: 'm-gold', kind: 'gold', target: 3, xp: 200 },
  { id: 'm-fever', kind: 'fever', target: 2, xp: 200 },
  { id: 'm-tier6', kind: 'tier', tier: 6, target: 3, xp: 200 },
  { id: 'm-daily', kind: 'daily', target: 1, xp: 200 },
];
const HARD: MissionDef[] = [
  { id: 'h-combo6', kind: 'combo', target: 6, xp: 350 },
  { id: 'h-score', kind: 'score', target: 60000, xp: 350 },
  { id: 'h-tier8', kind: 'tier', tier: 8, target: 1, xp: 350 },
  { id: 'h-fever', kind: 'fever', target: 5, xp: 350 },
  { id: 'h-gold', kind: 'gold', target: 8, xp: 350 },
];
export const ALL_MISSIONS = [...EASY, ...MID, ...HARD];
export const ALL_DONE_BONUS = 250;

export interface MissionState {
  date: string;
  ids: string[];
  prog: number[];
  done: boolean[];
  bonus: boolean;
}

export function missionById(id: string): MissionDef | undefined { return ALL_MISSIONS.find(m => m.id === id); }

export function pickMissions(date: string): string[] {
  const rng = makeRng(hashString('missions-' + date));
  return [EASY[int(rng, EASY.length)].id, MID[int(rng, MID.length)].id, HARD[int(rng, HARD.length)].id];
}

/** 날짜가 바뀌었으면 새 미션으로 */
export function ensureMissions(s: MissionState | undefined, date: string): MissionState {
  if (s && s.date === date && s.ids.length === 3 && s.ids.every(id => missionById(id))) return s;
  return { date, ids: pickMissions(date), prog: [0, 0, 0], done: [false, false, false], bonus: false };
}

export type MissionSignal =
  | { kind: 'merge'; tier: number }
  | { kind: 'gold' }
  | { kind: 'fever' }
  | { kind: 'power' }
  | { kind: 'nip' }
  | { kind: 'combo'; combo: number }
  | { kind: 'score'; score: number }
  | { kind: 'game'; daily: boolean };

export interface MissionResult { completed: MissionDef[]; bonus: boolean; xp: number }

/** 신호 하나를 반영하고, 이번에 새로 끝난 미션과 받을 경험치를 돌려준다 */
export function applySignal(s: MissionState, sig: MissionSignal): MissionResult {
  const completed: MissionDef[] = [];
  let xp = 0;
  s.ids.forEach((id, i) => {
    if (s.done[i]) return;
    const m = missionById(id)!;
    let p = s.prog[i];
    switch (m.kind) {
      case 'merges': if (sig.kind === 'merge') p++; break;
      case 'tier': if (sig.kind === 'merge' && sig.tier >= (m.tier ?? 0)) p++; break;
      case 'gold': if (sig.kind === 'gold') p++; break;
      case 'fever': if (sig.kind === 'fever') p++; break;
      case 'powers': if (sig.kind === 'power') p++; break;
      case 'nips': if (sig.kind === 'nip') p++; break;
      case 'combo': if (sig.kind === 'combo') p = Math.max(p, sig.combo); break;
      case 'score': if (sig.kind === 'score') p = Math.max(p, sig.score); break;
      case 'games': if (sig.kind === 'game') p++; break;
      case 'daily': if (sig.kind === 'game' && sig.daily) p++; break;
    }
    s.prog[i] = Math.min(p, m.target);
    if (s.prog[i] >= m.target) { s.done[i] = true; completed.push(m); xp += m.xp; }
  });
  let bonus = false;
  if (!s.bonus && s.done.every(Boolean)) { s.bonus = true; bonus = true; xp += ALL_DONE_BONUS; }
  return { completed, bonus, xp };
}

/** 미션 설명 문구 */
export function missionText(m: MissionDef, lang: 'ko' | 'en', catName: (i: number) => string): string {
  const n = m.target.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US');
  const cat = m.tier != null ? catName(m.tier) : '';
  if (lang === 'ko') {
    switch (m.kind) {
      case 'merges': return `합체 ${n}번 하기`;
      case 'games': return `${n}판 하기`;
      case 'powers': return `능력 ${n}번 쓰기`;
      case 'nips': return `캣닢 공 ${n}번 쓰기`;
      case 'tier': return `${cat} 이상 ${n}마리 만들기`;
      case 'combo': return `한 판에 ${n}콤보 달성`;
      case 'score': return `한 판에 ${n}점 넘기기`;
      case 'gold': return `황금 고양이 ${n}번 합체`;
      case 'fever': return `냥냥 피버 ${n}번 발동`;
      case 'daily': return '오늘의 상자 끝내기';
    }
  }
  switch (m.kind) {
    case 'merges': return `Merge ${n} times`;
    case 'games': return `Play ${n} games`;
    case 'powers': return `Use powers ${n} times`;
    case 'nips': return `Use ${n} catnip balls`;
    case 'tier': return `Make ${n} ${cat} or bigger`;
    case 'combo': return `Reach a ${n} combo in one game`;
    case 'score': return `Score ${n} in one game`;
    case 'gold': return `Merge ${n} golden cats`;
    case 'fever': return `Trigger Nyan Fever ${n} times`;
    case 'daily': return "Finish today's Daily Box";
  }
}
