// Save model + run rewards. Pure TS (no DOM) so it is unit-tested. One soft currency (coins), no energy,
// no gacha, no consumables; every unlock is earned by play with its requirement shown up front.
import type { RunState } from '../sim/types';
import { CONTENT_HASH, hashString } from '../sim/content';
import { totalScore, jellyPct } from '../sim/run';
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { STAGES } from '../data/stages';
import { applyRunToMissions, drawMission, MISSION_REWARD, RANK_XP, RANK_REWARD, missionText, type ActiveMission } from './missions';

export const SAVE_VERSION = 1;

export interface Settings {
  bgm: number; sfx: number;
  swapSides: boolean;       // jump on the right, slide on the left
  reduceMotion: boolean; highContrast: boolean; lowFx: boolean; showHitbox: boolean;
  assist: boolean;          // gentler damage/drain (records are flagged)
  ghost: boolean;           // show personal-best ghost where available
  vibrate: boolean;
  gameSpeed: number;        // 0.6–1.0: real-time rate of the fixed-step sim (assist; the course itself is unchanged)
}
export interface GhostRec { seed: number; content: number; charId: string; partnerId: string | null; mode: string; stageId: string | null; log: number[]; score: number; steps: number; assist: boolean }
export interface BestRec { score: number; dist: number; charId: string; date: number; assist: boolean }

export interface Progress {
  version: number;
  settings: Settings;
  coins: number;
  unlocked: string[];
  main: string; partner: string | null;
  stars: Record<string, number>;          // stageId → 0..3
  stageBest: Record<string, number>;
  bestEndless: BestRec | null;
  bestByChar: Record<string, number>;
  daily: Record<string, { best: number; tries: number; charId: string }>; // yyyy-mm-dd →
  rank: number; xp: number;
  missions: ActiveMission[]; missionCounter: number; missionsDone: number; rerollDay: string;
  totals: { runs: number; dist: number; jellies: number; coins: number; bonusTimes: number; playTime: number; clears: number };
  ghosts: Record<string, GhostRec>;       // 'stage:1-1' | 'daily:2026-09-26'
  tutorialDone: boolean;
  seenHints: string[];
}

export function defaultSettings(): Settings {
  let rm = false; try { rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
  return { bgm: 0.5, sfx: 0.8, swapSides: false, reduceMotion: rm, highContrast: false, lowFx: false, showHitbox: false, assist: false, ghost: true, vibrate: true, gameSpeed: 1 };
}
export function defaultProgress(): Progress {
  const starters = CHARACTERS.filter(c => c.unlock.kind === 'start').map(c => c.id);
  const p: Progress = {
    version: SAVE_VERSION, settings: defaultSettings(), coins: 0, unlocked: starters, main: starters[0] ?? 'hotteok', partner: null,
    stars: {}, stageBest: {}, bestEndless: null, bestByChar: {}, daily: {}, rank: 0, xp: 0,
    missions: [], missionCounter: 0, missionsDone: 0, rerollDay: '',
    totals: { runs: 0, dist: 0, jellies: 0, coins: 0, bonusTimes: 0, playTime: 0, clears: 0 },
    ghosts: {}, tutorialDone: false, seenHints: [],
  };
  fillMissions(p);
  return p;
}

export function fillMissions(p: Progress): void {
  while (p.missions.length < 3) { p.missions.push(drawMission(p.missions.map(m => m.id), p.rank, p.missionCounter)); p.missionCounter++; }
}

/** Merge a loaded (possibly older/partial) save onto defaults so new fields never crash old saves. */
export function normalize(raw: any): Progress {
  const d = defaultProgress();
  if (!raw || typeof raw !== 'object') return d;
  const p: Progress = { ...d, ...raw, settings: { ...d.settings, ...(raw.settings || {}) }, totals: { ...d.totals, ...(raw.totals || {}) } };
  p.unlocked = Array.from(new Set([...(Array.isArray(raw.unlocked) ? raw.unlocked : []), ...d.unlocked])).filter(id => CHAR_BY_ID[id]);
  if (!CHAR_BY_ID[p.main] || !p.unlocked.includes(p.main)) p.main = p.unlocked[0];
  if (p.partner && (!CHAR_BY_ID[p.partner] || !p.unlocked.includes(p.partner) || p.partner === p.main)) p.partner = null;
  if (!Array.isArray(p.missions)) p.missions = [];
  p.missions = p.missions.filter(m => m && typeof m.id === 'string');
  fillMissions(p);
  for (const k of ['stars', 'stageBest', 'bestByChar', 'daily', 'ghosts'] as const) if (!p[k] || typeof p[k] !== 'object') (p as any)[k] = {};
  p.version = SAVE_VERSION;
  return p;
}

export function totalStars(p: Progress): number { return Object.values(p.stars).reduce((a, b) => a + b, 0); }

export type UnlockState = { ok: true } | { ok: false; reason: string; canBuy?: number };
export function unlockState(p: Progress, charId: string): UnlockState {
  const c = CHAR_BY_ID[charId]; if (!c) return { ok: false, reason: '없음' };
  if (p.unlocked.includes(charId)) return { ok: true };
  const u = c.unlock;
  switch (u.kind) {
    case 'start': return { ok: true };
    case 'stars': return { ok: false, reason: `모험 별 ${u.n}개 (현재 ${totalStars(p)})` };
    case 'rank': return { ok: false, reason: `미션 랭크 ${u.n} (현재 ${p.rank})` };
    case 'coins': return { ok: false, reason: `코인 ${u.cost.toLocaleString('ko-KR')}개`, canBuy: u.cost };
  }
}
/** Grants every character whose star/rank requirement is now met. Returns newly unlocked ids. */
export function autoUnlock(p: Progress): string[] {
  const got: string[] = [];
  for (const c of CHARACTERS) {
    if (p.unlocked.includes(c.id)) continue;
    const u = c.unlock;
    if ((u.kind === 'stars' && totalStars(p) >= u.n) || (u.kind === 'rank' && p.rank >= u.n) || u.kind === 'start') { p.unlocked.push(c.id); got.push(c.id); }
  }
  return got;
}
export function buyCharacter(p: Progress, charId: string): { ok: boolean; error?: string } {
  const c = CHAR_BY_ID[charId]; if (!c) return { ok: false, error: '없는 캐릭터' };
  if (p.unlocked.includes(charId)) return { ok: false, error: '이미 있어요' };
  if (c.unlock.kind !== 'coins') return { ok: false, error: '코인으로 열 수 없어요' };
  if (p.coins < c.unlock.cost) return { ok: false, error: `코인이 ${(c.unlock.cost - p.coins).toLocaleString('ko-KR')}개 부족해요` };
  p.coins -= c.unlock.cost; p.unlocked.push(charId); return { ok: true };
}

export function stageUnlocked(p: Progress, stageId: string): boolean {
  const i = STAGES.findIndex(s => s.id === stageId); if (i <= 0) return i === 0;
  const prev = STAGES[i - 1];
  const st = STAGES[i];
  if ((p.stars[prev.id] ?? 0) < 1) return false;
  // a new world also needs some stars from the previous world
  if (st.world !== prev.world) { const need = worldGate(st.world); return totalStars(p) >= need; }
  return true;
}
export function worldGate(world: number): number { return world <= 1 ? 0 : (world - 1) * 8; }

export function stageStars(s: RunState): number {
  const st = STAGES.find(x => x.id === s.stageId); if (!st || s.phase !== 'clear') return 0;
  let n = 1;
  if (jellyPct(s) >= st.stars.jellyPct) n++;
  if (s.hp / s.maxHp * 100 >= st.stars.hpPct) n++;
  return n;
}

export function todayKey(d = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
/** Same course for everyone on the same build and local date. */
export function dailySeed(key: string): number { return hashString(`${key}|${CONTENT_HASH}`); }
/** Character of the day — playable even while locked (a free try-out). */
export function dailyChar(key: string): string { return CHARACTERS[hashString('char|' + key) % CHARACTERS.length].id; }

export interface RunReward {
  score: number; coins: number; coinsFromPickups: number; coinsFromDist: number; coinsFromMissions: number; coinsFromRank: number;
  newBest: boolean; prevBest: number; stars: number; prevStars: number; newStars: number;
  missionsDone: { text: string; xp: number; coins: number }[]; rankUps: number; unlocked: string[]; ghostSaved: boolean;
}

/** Book a finished run into the save. Idempotent per RunState (guarded by the caller holding one reference). */
export function applyRun(p: Progress, s: RunState, dateKey = todayKey()): RunReward {
  const score = totalScore(s);
  const coinsFromPickups = s.stats.coins; const coinsFromDist = Math.floor(s.dist / 100);
  const r: RunReward = { score, coins: 0, coinsFromPickups, coinsFromDist, coinsFromMissions: 0, coinsFromRank: 0, newBest: false, prevBest: 0, stars: 0, prevStars: 0, newStars: 0, missionsDone: [], rankUps: 0, unlocked: [], ghostSaved: false };
  if (s.trial) return r;                     // try-out runs never touch records, missions or coins
  p.totals.runs++; p.totals.dist += Math.floor(s.dist); p.totals.jellies += s.stats.jellies; p.totals.coins += s.stats.coins; p.totals.bonusTimes += s.stats.bonusTimes; p.totals.playTime += s.t;
  const ghost = (): GhostRec => ({ seed: s.seed, content: CONTENT_HASH, charId: firstCharOf(s), partnerId: s.partnerId, mode: s.mode, stageId: s.stageId, log: s.log.slice(), score, steps: s.steps, assist: s.assist });

  if (s.mode === 'endless') {
    r.prevBest = p.bestEndless?.score ?? 0;
    if (score > r.prevBest) { r.newBest = true; p.bestEndless = { score, dist: Math.floor(s.dist), charId: firstCharOf(s), date: Date.now(), assist: s.assist }; }
    const k = firstCharOf(s); if (score > (p.bestByChar[k] ?? 0)) p.bestByChar[k] = score;
  } else if (s.mode === 'stage' && s.stageId) {
    r.prevStars = p.stars[s.stageId] ?? 0; r.stars = stageStars(s);
    if (r.stars > r.prevStars) { p.stars[s.stageId] = r.stars; r.newStars = r.stars - r.prevStars; }
    r.prevBest = p.stageBest[s.stageId] ?? 0;
    if (s.phase === 'clear') p.totals.clears++;
    if (score > r.prevBest && s.phase === 'clear') { r.newBest = true; p.stageBest[s.stageId] = score; if (s.log.length < 60000) { p.ghosts['stage:' + s.stageId] = ghost(); r.ghostSaved = true; } }
  } else if (s.mode === 'daily') {
    const d = p.daily[dateKey] ?? { best: 0, tries: 0, charId: firstCharOf(s) };
    d.tries++; r.prevBest = d.best;
    if (score > d.best) { d.best = score; d.charId = firstCharOf(s); r.newBest = true; if (s.log.length < 60000) { p.ghosts['daily:' + dateKey] = ghost(); r.ghostSaved = true; } }
    p.daily[dateKey] = d;
    // keep only the last 14 daily ghosts
    const keys = Object.keys(p.ghosts).filter(k => k.startsWith('daily:')).sort();
    while (keys.length > 14) delete p.ghosts[keys.shift()!];
  }

  if (s.mode !== 'tutorial') {
    const done = applyRunToMissions(p.missions, s);
    for (const i of done.sort((a, b) => b - a)) {
      const m = p.missions[i]; const rw = MISSION_REWARD[m.level];
      r.missionsDone.push({ text: missionText(m), xp: rw.xp, coins: rw.coins });
      r.coinsFromMissions += rw.coins; p.xp += rw.xp; p.missionsDone++;
      p.missions.splice(i, 1);
    }
    while (p.xp >= RANK_XP(p.rank)) { p.xp -= RANK_XP(p.rank); r.coinsFromRank += RANK_REWARD(p.rank); p.rank++; r.rankUps++; }
    fillMissions(p);
  } else p.tutorialDone = true;

  r.coins = coinsFromPickups + coinsFromDist + r.coinsFromMissions + r.coinsFromRank;
  p.coins += r.coins;
  r.unlocked = autoUnlock(p);
  return r;
}
function firstCharOf(s: RunState): string { return s.mainId; }

/** Swapping a mission is always free (a swapped mission simply gives no stars). */
export function canReroll(p: Progress, i: number): boolean { return !!p.missions[i]; }
export function reroll(p: Progress, i: number): boolean {
  if (!p.missions[i]) return false;
  const others = p.missions.map(m => m.id);
  p.missions[i] = drawMission(others, p.rank, p.missionCounter++);
  return true;
}
