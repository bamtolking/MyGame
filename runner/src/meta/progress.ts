// Save model + run rewards (v2). Pure TS (no DOM) so it is unit-tested. One soft currency (엽전), no energy,
// no gacha, no consumables; every unlock is earned by play with its requirement shown up front (GDD §9).
import type { RunState } from '../sim/types';
import { CONTENT_HASH, hashString } from '../sim/content';
import { totalScore, jellyPct } from '../sim/run';
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { COMPANIONS, COMPANION_BY_ID } from '../data/companions';
import { STAGES, STAGE_BY_ID } from '../data/stages';
import { SCORE_VERSION } from '../data/tuning';
import { applyRunToMissions, drawMission, fillMissionSlots, MISSION_REWARD, MISSION_BY_ID, RANK_XP, RANK_REWARD, RANK_MAX, missionText, type ActiveMission } from './missions';
import { evaluateAchievements, COSMETIC_BY_ID, ACHIEVEMENTS, type AchievementUnlock } from './achievements';
// UI conveniences: the shop / wardrobe / achievement helpers live in achievements.ts, the rank preview in missions.ts
export { buyCosmetic, equipCosmetic, unequipCosmetic, equippedFor, achievementProgress, achievementView, shopList, estimateRuns, COSMETICS, ACHIEVEMENTS } from './achievements';
export { rankRewardPreview, RANK_TITLES } from './missions';

export const SAVE_VERSION = 2;
const ACHIEVEMENT_REWARD = (): Record<string, string> => Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a.reward]));

export interface Settings {
  bgm: number; sfx: number; musicOff: boolean;
  swapSides: boolean;       // jump on the right, slide on the left
  showPads: boolean;        // keep the thumb hints visible in landscape
  slideToggle: boolean;     // one tap = 0.6 s slide (motor accessibility)
  reduceMotion: boolean; shake: number; highContrast: boolean; lowFx: boolean; uiScale: number; fps30: boolean;
  showHitbox: boolean; vibrate: boolean; ghost: boolean;
  // assist (records are marked, never punished)
  gameSpeed: number;        // 0.6–1.0: real-time rate of the fixed-step sim (the course itself is unchanged)
  assistNoHit: boolean; assistHalfDrain: boolean; assistAutoSlide: boolean;
}
// `noCountdown`: the run started without the 3-2-1 (its log counts from that first step); undefined = recorded before the
// flag existed — the UI ignores such ghosts (their alignment is unknown)
export interface GhostRec { seed: number; content: number; charId: string; partnerId: string | null; companionId: string | null; mode: string; stageId: string | null; log: number[]; score: number; steps: number; assist: boolean; assistOpts?: { noHitDamage?: boolean; halfDrain?: boolean; autoSlide?: boolean }; noCountdown?: boolean }
export interface BestRec { score: number; dist: number; charId: string; date: number; assist: boolean; relay: boolean; scoreVersion: number }
export interface HallRec extends BestRec { mode: string; key?: string }
// medal 0 none · 1 동 · 2 은 · 3 금. `dist` / `medal` are the day's longest try (medals); `bestDist` / `assist` belong to the
// best-SCORE try (the shared record code and share text describe that one run). Records from before these fields lack them.
export interface DailyRec { best: number; dist: number; tries: number; charId: string; medal: number; bestDist?: number; assist?: boolean }

export interface Progress {
  version: number;
  rev: number;                            // +1 on every write (storage.ts): a newer save written by another tab is noticed, not overwritten
  settings: Settings;
  coins: number;
  unlocked: string[];                     // characters
  companions: string[];                   // owned companions
  loadout: { main: string; partner: string | null; companion: string | null };
  starMask: Record<string, number>;       // stageId → bitmask (bit0 ★1 finish, bit1 ★2 candy %, bit2 ★3 pouches)
  pouches: Record<string, number>;        // stageId → bitmask of golden pouches collected in COMPLETED runs
  stageBest: Record<string, number>;
  bestEndless: BestRec | null;
  bestByChar: Record<string, number>;
  daily: Record<string, DailyRec>;        // yyyy-mm-dd →
  daysPlayed: number; lastDay: string;
  rank: number; xp: number;
  missions: ActiveMission[]; missionCounter: number; missionsDone: number;
  achievements: Record<string, number>;   // id → unlocked at (ms)
  cosmetics: { owned: string[]; equipped: Record<string, { hat?: string; trail?: string; palette?: string; jumpSound?: string }> };
  bests: Record<string, number>;          // single-run records the achievements read (e.g. 'dist:hotteok', 'near', 'nohit')
  titles?: string[];                      // title rewards (none of the 30 achievements uses one yet)
  totals: {
    runs: number; dist: number; jellies: number; coins: number; bonusTimes: number; playTime: number; clears: number;
    nearMisses: number; airJumps: number; smashed: number; potions: number; bigJellies: number; letters: number; lines: number;
    superBonus: number; pouches: number; bestStreak: number;
    coinsEarned: number;                  // every 엽전 booked (pickups + distance + missions + rank) — for "약 N판" estimates
    moonCakes: number; fastFalls: number; relayDist: number;
  };
  hall: HallRec[];                        // local top records (per mode/character, ≤ 10 each)
  seen: string[];                         // features/tabs already visited (for the single 'new' dot)
  tutorialDone: boolean;
  scoreVersion: number;
}

export function defaultSettings(): Settings {
  let rm = false; try { rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
  return {
    bgm: 0.5, sfx: 0.8, musicOff: false, swapSides: false, showPads: false, slideToggle: false,
    reduceMotion: rm, shake: rm ? 0 : 1, highContrast: false, lowFx: false, uiScale: 1, fps30: false, showHitbox: false, vibrate: true, ghost: true,
    gameSpeed: 1, assistNoHit: false, assistHalfDrain: false, assistAutoSlide: false,
  };
}
export function defaultProgress(): Progress {
  const starters = CHARACTERS.filter(c => c.unlock.kind === 'start').map(c => c.id);
  const comps = COMPANIONS.filter(c => c.unlock.kind === 'start').map(c => c.id);
  const p: Progress = {
    version: SAVE_VERSION, rev: 0, settings: defaultSettings(), coins: 0, unlocked: starters, companions: comps,
    loadout: { main: starters[0] ?? 'hotteok', partner: null, companion: comps[0] ?? null },
    starMask: {}, pouches: {}, stageBest: {}, bestEndless: null, bestByChar: {}, daily: {}, daysPlayed: 0, lastDay: '',
    rank: 0, xp: 0, missions: [], missionCounter: 0, missionsDone: 0,
    achievements: {}, cosmetics: { owned: [], equipped: {} }, bests: {},
    totals: { runs: 0, dist: 0, jellies: 0, coins: 0, bonusTimes: 0, playTime: 0, clears: 0, nearMisses: 0, airJumps: 0, smashed: 0, potions: 0, bigJellies: 0, letters: 0, lines: 0, superBonus: 0, pouches: 0, bestStreak: 0, coinsEarned: 0, moonCakes: 0, fastFalls: 0, relayDist: 0 },
    hall: [], seen: [], tutorialDone: false, scoreVersion: SCORE_VERSION,
  };
  fillMissions(p);
  return p;
}

export function fillMissions(p: Progress, avoid: string[] = []): void { fillMissionSlots(p.missions, p, () => p.missionCounter++, avoid); }

/** Save migrations: each step takes a vN object and returns vN+1. Never wipes progress. */
export const MIGRATIONS: Record<number, (o: any) => any> = {
  1: (o: any) => {
    const starMask: Record<string, number> = {};
    const pouches: Record<string, number> = {};
    for (const [k, v] of Object.entries(o.stars ?? {})) starMask[k] = (v as number) >= 3 ? 7 : (v as number) >= 2 ? 3 : (v as number) >= 1 ? 1 : 0;
    // a v1 ★3 stays ★3; v2 reads ★3 as "all three golden pouches", so the pouches go with it (else the card shows ★3 at 0/3)
    for (const [k, m] of Object.entries(starMask)) if (m & 4) pouches[k] = 7;
    const set = o.settings ?? {};
    const daily: Record<string, DailyRec> = Object.fromEntries(Object.entries(o.daily ?? {}).map(([k, d]: [string, any]) => [k, { best: d?.best ?? 0, dist: 0, tries: d?.tries ?? 0, charId: d?.charId ?? 'hotteok', medal: 0 }]));
    // v1 records predate SCORE_VERSION: keep them, marked as version 0 (never silently re-scored)
    const bestEndless = o.bestEndless ? { relay: false, ...o.bestEndless, scoreVersion: o.bestEndless.scoreVersion ?? 0 } : null;
    const hall: HallRec[] = [];
    if (bestEndless) hall.push({ ...bestEndless, mode: 'endless' });
    for (const [k, d] of Object.entries(daily)) if (d.best > 0) hall.push({ score: d.best, dist: 0, charId: d.charId, date: 0, assist: false, relay: false, scoreVersion: 0, mode: 'daily', key: k });
    const seen = [...(Array.isArray(o.seen) ? o.seen : []), ...(Array.isArray(o.seenHints) ? o.seenHints.map((h: string) => 'hint:' + h) : [])];
    return {
      // (no loadout.companion: v1 had none, so the fresh-save default — the starter companion, equipped — applies)
      ...o, version: 2, starMask, pouches, companions: [], loadout: { main: o.main, partner: o.partner ?? null },
      settings: { ...set, assistHalfDrain: !!set.assist, assistNoHit: false, assistAutoSlide: false },
      achievements: {}, cosmetics: { owned: [], equipped: {} }, hall, seen, daysPlayed: Object.keys(o.daily ?? {}).length, lastDay: '',
      daily, bestEndless,
      // ghosts move to their own storage keys: storage.load() calls takeLegacyGhosts() before normalize()
    };
  },
};

/** v1 kept ghosts inside the main save; v2 stores one per key. Returns them (key → GhostRec) so the storage layer can move them. */
export function takeLegacyGhosts(raw: any): Record<string, GhostRec> {
  const g = raw && typeof raw === 'object' ? raw.ghosts : null;
  if (!g || typeof g !== 'object' || Array.isArray(g)) return {};
  const out: Record<string, GhostRec> = {};
  for (const [k, v] of Object.entries(g)) if (v && typeof v === 'object' && Array.isArray((v as GhostRec).log)) { const r = v as GhostRec; out[k] = { ...r, partnerId: r.partnerId ?? null, companionId: r.companionId ?? null }; }
  return out;
}

/** Own-key lookup: the *_BY_ID tables are plain objects, so 'constructor' / '__proto__' / 'toString' would "exist". */
function hasId(table: object, id: unknown): id is string { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(table, id); }
const obj = (x: unknown): Record<string, any> => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, any> : {});
const num = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
/** keeps only finite numbers ≥ 0 (masks: whole numbers 0–7) */
function numMap(x: unknown, mask = false): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(x))) if (num(v) && v >= 0) out[k] = mask ? Math.floor(v) & 7 : v;
  return out;
}
const UI_SCALES = [1, 1.15, 1.3];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Migrate + merge a loaded (possibly older/partial) save onto defaults so new fields never crash old saves. Also the gate
 * for imported backup codes: every id must be a real one and every value the right type, so a hand-edited code can
 * never break a run later (unknown fields are kept — a save from a newer build loses nothing).
 */
export function normalize(raw: any): Progress {
  const d = defaultProgress();
  if (!raw || typeof raw !== 'object') return d;
  let o = raw; let v = typeof o.version === 'number' ? o.version : 1;
  while (v < SAVE_VERSION && MIGRATIONS[v]) { o = MIGRATIONS[v](o); v++; }
  const p: Progress = {
    ...d, ...o,
    settings: { ...d.settings, ...obj(o.settings) }, totals: { ...d.totals, ...obj(o.totals) },
    loadout: { ...d.loadout, ...obj(o.loadout) }, cosmetics: { owned: [], equipped: {}, ...obj(o.cosmetics) },
  };
  // scalars: a value of the wrong type (or NaN / Infinity) falls back to the default
  for (const k of Object.keys(d) as (keyof Progress)[]) {
    const dv = d[k]; if (dv !== null && typeof dv !== 'object' && (typeof p[k] !== typeof dv || (typeof dv === 'number' && !num(p[k])))) (p as any)[k] = dv;
  }
  for (const k of Object.keys(d.totals) as (keyof Progress['totals'])[]) if (!num(p.totals[k])) p.totals[k] = d.totals[k];
  const st = p.settings as unknown as Record<string, unknown>; const ds = d.settings as unknown as Record<string, unknown>;
  for (const k of Object.keys(ds)) if (typeof st[k] !== typeof ds[k] || (typeof ds[k] === 'number' && !num(st[k]))) st[k] = ds[k];
  const S = p.settings;
  S.gameSpeed = clamp(S.gameSpeed, 0.6, 1); S.bgm = clamp(S.bgm, 0, 1); S.sfx = clamp(S.sfx, 0, 1); S.shake = clamp(S.shake, 0, 1);
  if (!UI_SCALES.includes(S.uiScale)) S.uiScale = 1;

  p.unlocked = Array.from(new Set([...(Array.isArray(o.unlocked) ? o.unlocked : []), ...d.unlocked])).filter(id => hasId(CHAR_BY_ID, id));
  p.companions = Array.from(new Set([...(Array.isArray(o.companions) ? o.companions : []), ...d.companions])).filter(id => hasId(COMPANION_BY_ID, id));
  if (!hasId(CHAR_BY_ID, p.loadout.main) || !p.unlocked.includes(p.loadout.main)) p.loadout.main = p.unlocked[0];
  const pa = p.loadout.partner; if (pa !== null && (!hasId(CHAR_BY_ID, pa) || !p.unlocked.includes(pa) || pa === p.loadout.main)) p.loadout.partner = null;
  const co = p.loadout.companion; if (co !== null && !p.companions.includes(co as string)) p.loadout.companion = p.companions[0] ?? null;
  if (!Array.isArray(p.missions)) p.missions = [];
  // keep only missions whose template still exists (an unknown one could never complete); repair numbers
  p.missions = p.missions.filter(m => m && hasId(MISSION_BY_ID, m.id)).slice(0, 3).map(m => {
    const level = Math.max(0, Math.min(2, Math.floor(Number(m.level) || 0)));
    return { id: m.id, level, progress: Math.max(0, Number(m.progress) || 0), target: Number(m.target) > 0 ? Number(m.target) : MISSION_BY_ID[m.id].targets[level], runsWithout: Math.max(0, Number(m.runsWithout) || 0) };
  });
  p.starMask = numMap(p.starMask, true); p.pouches = numMap(p.pouches, true);
  p.stageBest = numMap(p.stageBest); p.bestByChar = numMap(p.bestByChar); p.bests = numMap(p.bests); p.achievements = numMap(p.achievements);
  const daily: Record<string, DailyRec> = {};
  for (const [k, r] of Object.entries(obj(p.daily))) {
    if (!r || typeof r !== 'object' || !num(r.best)) continue;
    const e: DailyRec = daily[k] = { ...r, dist: num(r.dist) ? r.dist : 0, tries: num(r.tries) ? r.tries : 0, charId: typeof r.charId === 'string' ? r.charId : d.loadout.main, medal: num(r.medal) ? r.medal : 0 };
    if (e.bestDist !== undefined && !num(e.bestDist)) delete e.bestDist;
    if (e.assist !== undefined && typeof e.assist !== 'boolean') delete e.assist;
  }
  p.daily = daily;
  const be = p.bestEndless as BestRec | null;
  if (be !== null && (!be || typeof be !== 'object' || !num(be.score) || !num(be.dist) || typeof be.charId !== 'string')) p.bestEndless = null;
  if (!Array.isArray(p.cosmetics.owned)) p.cosmetics.owned = [];
  p.cosmetics.owned = Array.from(new Set(p.cosmetics.owned.filter(x => typeof x === 'string')));
  p.cosmetics.equipped = Object.fromEntries(Object.entries(obj(p.cosmetics.equipped)).filter(([, e]) => e && typeof e === 'object' && !Array.isArray(e)));
  // achievement rewards are never lost: re-grant any cosmetic whose achievement is recorded
  const rewards = ACHIEVEMENT_REWARD();
  for (const id of Object.keys(p.achievements)) { const rw = hasId(rewards, id) ? rewards[id] : ''; if (hasId(COSMETIC_BY_ID, rw) && !p.cosmetics.owned.includes(rw)) p.cosmetics.owned.push(rw); }
  p.hall = trimHall((Array.isArray(p.hall) ? p.hall : []).filter(h => h && typeof h === 'object' && num(h.score) && num(h.dist) && typeof h.mode === 'string' && typeof h.charId === 'string'));
  p.seen = Array.isArray(p.seen) ? p.seen.filter(x => typeof x === 'string') : [];
  if (p.titles !== undefined) p.titles = Array.isArray(p.titles) ? p.titles.filter(x => typeof x === 'string') : [];
  delete (p as any).ghosts; delete (p as any).stars; delete (p as any).main; delete (p as any).partner; delete (p as any).rerollDay; delete (p as any).seenHints;
  fillMissions(p);
  p.version = SAVE_VERSION;
  return p;
}

// ---------------------------------------------------------------- one save, two instances (tabs / the installed app)
const ADDITIVE = /^(coins|missionCounter|missionsDone|totals\.(?!bestStreak$)[^.]+)$/;
/**
 * Three-way merge for a save changed in two places at once — another tab, or the installed app next to a browser tab,
 * wrote it while this instance changed it too. `base`: the save as this instance last read or wrote it; `local`: its
 * state now; `remote`: the newer stored save. What changed on one side only comes from that side. Where both changed:
 * counters (엽전, totals, …) add both gains, records keep the higher (bests, ranks, days), star / pouch masks combine,
 * id lists (unlocked, owned, seen …) and the hall unite, a day's daily record keeps its best try, missions follow the
 * stored save (its rewards are already paid), settings and loadout follow this instance (its latest touch).
 */
export function mergeProgress(base: Progress, local: Progress, remote: Progress): Progress {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
  const m = (b: any, l: any, r: any, path: string): any => {
    if (same(l, b)) return r;
    if (same(r, b)) return l;
    if (path === 'missions') return r;
    if (path === 'hall') { const seen = new Set<string>(); return [...r, ...l].filter(h => { const k = JSON.stringify(h); if (seen.has(k)) return false; seen.add(k); return true; }); }
    if (path === 'bestEndless') return (l?.score ?? -1) >= (r?.score ?? -1) ? l : r;
    if (/^daily\.[^.]+$/.test(path) && isObj(l) && isObj(r)) {
      const hi = l.best >= r.best ? l : r;
      return { ...hi, dist: Math.max(l.dist, r.dist), medal: Math.max(l.medal, r.medal), tries: l.tries + r.tries - (b?.tries ?? 0) };
    }
    if (Array.isArray(l) && Array.isArray(r)) return Array.from(new Set([...r, ...l]));
    if (isObj(l) && isObj(r)) {
      const out: Record<string, any> = {};
      for (const k of new Set([...Object.keys(r), ...Object.keys(l)])) { const v = m(isObj(b) ? b[k] : undefined, l[k], r[k], path ? `${path}.${k}` : k); if (v !== undefined) out[k] = v; }
      return out;
    }
    if (typeof l === 'number' && typeof r === 'number' && !/^(settings|loadout)\./.test(path)) {
      if (/^(starMask|pouches)\./.test(path)) return l | r;
      if (ADDITIVE.test(path)) return l + r - (typeof b === 'number' ? b : 0);
      return Math.max(l, r);
    }
    if (path === 'lastDay' && typeof l === 'string' && typeof r === 'string') return l > r ? l : r;
    return l;
  };
  const out = m(base, local, remote, '') as Progress;
  // rank + XP are one bar: keep the pair that is further along
  if (!same([local.rank, local.xp], [base.rank, base.xp]) && !same([remote.rank, remote.xp], [base.rank, base.xp])) {
    const hi = local.rank > remote.rank || (local.rank === remote.rank && local.xp >= remote.xp) ? local : remote;
    out.rank = hi.rank; out.xp = hi.xp;
  }
  return normalize(out);
}

// ---------------------------------------------------------------- stars, stages, unlocks
export function starsOf(mask: number): number { return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1); }
export function stageStarCount(p: Progress, id: string): number { return starsOf(p.starMask[id] ?? 0); }
export function totalStars(p: Progress): number { return Object.values(p.starMask).reduce((a, m) => a + starsOf(m), 0); }
export function worldStars(p: Progress, world: number): number { return STAGES.filter(s => s.world === world).reduce((a, s) => a + stageStarCount(p, s.id), 0); }
export function stageCleared(p: Progress, id: string): boolean { return ((p.starMask[id] ?? 0) & 1) === 1; }

/** ★1 on the previous regular stage opens the next; a remix needs 12 of its world's 18 regular stars. Stars never gate the main path. */
export function stageUnlocked(p: Progress, stageId: string): boolean {
  const st = STAGE_BY_ID[stageId]; if (!st) return false;
  if (st.remix) return worldStars(p, st.world) >= REMIX_GATE && STAGES.filter(s => s.world === st.world && !s.remix).every(s => stageCleared(p, s.id));
  const regular = STAGES.filter(s => !s.remix);
  const i = regular.findIndex(s => s.id === stageId);
  return i <= 0 ? i === 0 : stageCleared(p, regular[i - 1].id);
}
export const REMIX_GATE = 12;
/** The next stage to play: the first unlocked regular stage without ★1, else null (everything cleared). */
export function nextStage(p: Progress): string | null {
  const s = STAGES.find(x => !x.remix && stageUnlocked(p, x.id) && !stageCleared(p, x.id));
  return s ? s.id : null;
}

/** Progressive disclosure (GDD §9.8). */
export type Feature = 'map' | 'missions' | 'endless' | 'relay' | 'daily' | 'chars' | 'backup';
export function featureOpen(p: Progress, f: Feature): boolean {
  switch (f) {
    case 'map': return p.totals.runs >= 1 || p.tutorialDone;
    case 'missions': return p.totals.runs >= 3;
    case 'endless': return stageCleared(p, '1-4') || p.totals.runs >= 12;
    case 'relay': return stageCleared(p, '1-6');
    case 'daily': return p.totals.runs >= 6;
    case 'chars': return p.unlocked.length > 1 || p.companions.length > 1 || p.totals.runs >= 5;
    // 백업 코드 + 홈 화면 추가 안내 (in 설정, never a popup): after 5 runs or the first unlock
    case 'backup': return p.totals.runs >= 5 || p.unlocked.length > 1 || p.companions.length > 1 || (p.cosmetics?.owned?.length ?? 0) > 0;
  }
}

export type UnlockState = { ok: true } | { ok: false; reason: string; canBuy?: number; progress?: [number, number] };
export function unlockState(p: Progress, charId: string): UnlockState {
  const c = CHAR_BY_ID[charId]; if (!c) return { ok: false, reason: '없음' };
  if (p.unlocked.includes(charId)) return { ok: true };
  const u = c.unlock;
  switch (u.kind) {
    case 'start': return { ok: true };
    case 'stars': return { ok: false, reason: `골목 지도 ★ ${totalStars(p)}/${u.n}`, progress: [totalStars(p), u.n] };
    case 'rank': return { ok: false, reason: `계급 ${p.rank}/${u.n}`, progress: [p.rank, u.n] };
    case 'coins': return { ok: false, reason: `엽전 ${p.coins.toLocaleString('ko-KR')}/${u.cost.toLocaleString('ko-KR')}`, canBuy: u.cost, progress: [p.coins, u.cost] };
  }
}
export function companionState(p: Progress, id: string): UnlockState {
  const c = COMPANION_BY_ID[id]; if (!c) return { ok: false, reason: '없음' };
  if (p.companions.includes(id)) return { ok: true };
  const u = c.unlock;
  switch (u.kind) {
    case 'start': return { ok: true };
    case 'stage': return { ok: false, reason: `${u.id} 클리어`, progress: [stageCleared(p, u.id) ? 1 : 0, 1] };
    case 'coins': return { ok: false, reason: `엽전 ${p.coins.toLocaleString('ko-KR')}/${u.cost.toLocaleString('ko-KR')}`, canBuy: u.cost, progress: [p.coins, u.cost] };
  }
}
/** Grants every character/companion whose star/rank/stage requirement is now met. Returns newly unlocked ids. */
export function autoUnlock(p: Progress): string[] {
  const got: string[] = [];
  for (const c of CHARACTERS) {
    if (p.unlocked.includes(c.id)) continue;
    const u = c.unlock;
    if ((u.kind === 'stars' && totalStars(p) >= u.n) || (u.kind === 'rank' && p.rank >= u.n) || u.kind === 'start') { p.unlocked.push(c.id); got.push(c.id); }
  }
  for (const c of COMPANIONS) {
    if (p.companions.includes(c.id)) continue;
    const u = c.unlock;
    if (u.kind === 'start' || (u.kind === 'stage' && stageCleared(p, u.id))) { p.companions.push(c.id); got.push(c.id); }
  }
  return got;
}
export function buyCharacter(p: Progress, charId: string): { ok: boolean; error?: string } {
  const c = CHAR_BY_ID[charId]; if (!c) return { ok: false, error: '없는 캐릭터' };
  if (p.unlocked.includes(charId)) return { ok: false, error: '이미 있어요' };
  if (c.unlock.kind !== 'coins') return { ok: false, error: '엽전으로 열 수 없어요' };
  if (p.coins < c.unlock.cost) return { ok: false, error: `엽전이 ${(c.unlock.cost - p.coins).toLocaleString('ko-KR')}개 부족해요` };
  p.coins -= c.unlock.cost; p.unlocked.push(charId); return { ok: true };
}
export function buyCompanion(p: Progress, id: string): { ok: boolean; error?: string } {
  const c = COMPANION_BY_ID[id]; if (!c) return { ok: false, error: '없는 짝꿍' };
  if (p.companions.includes(id)) return { ok: false, error: '이미 있어요' };
  if (c.unlock.kind !== 'coins') return { ok: false, error: '엽전으로 열 수 없어요' };
  if (p.coins < c.unlock.cost) return { ok: false, error: `엽전이 ${(c.unlock.cost - p.coins).toLocaleString('ko-KR')}개 부족해요` };
  p.coins -= c.unlock.cost; p.companions.push(id); return { ok: true };
}

// ---------------------------------------------------------------- daily
export function todayKey(d = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
/** Same course for everyone on the same build and local date. */
export function dailySeed(key: string): number { return hashString(`${key}|${CONTENT_HASH}`); }
function dayIndex(key: string): number { const [y, m, d] = key.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); }
/** Runner + companion of the day — lent even while locked (a free try-out). */
export function dailyChar(key: string): string { return CHARACTERS[((dayIndex(key) % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length].id; }
export function dailyCompanion(key: string): string { return COMPANIONS[((dayIndex(key) % COMPANIONS.length) + COMPANIONS.length) % COMPANIONS.length].id; }
export const DAILY_MEDALS = [1000, 2000, 3500];   // m for 동 · 은 · 금 (published up front)
export function medalFor(dist: number): number { return DAILY_MEDALS.filter(m => dist >= m).length; }
/** The last 7 days (today first) that can still be played. */
export function dailyArchive(today = todayKey()): string[] {
  const out: string[] = []; const base = dayIndex(today);
  for (let i = 0; i < 7; i++) { const t = new Date((base - i) * 86400000); out.push(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`); }
  return out;
}
/**
 * A shareable record code: YYMMDD-score-dist-check (checksum only guards typos; there is no server). Score and distance
 * must come from the same try (DailyRec.best + bestDist); an assisted record is always marked (`-도움`, in the checksum too).
 */
export function recordCode(key: string, score: number, dist: number, assist = false): string {
  const ymd = key.replace(/-/g, '').slice(2);
  const ck = (hashString(`${ymd}|${score}|${dist}${assist ? '|A' : ''}`) % 1296).toString(36).padStart(2, '0').toUpperCase();
  return `${ymd}-${score}-${dist}-${ck}${assist ? '-도움' : ''}`;
}

// ---------------------------------------------------------------- run booking
export interface RunReward {
  score: number; coins: number; coinsFromPickups: number; coinsFromDist: number; coinsFromMissions: number; coinsFromRank: number;
  newBest: boolean; prevBest: number;
  stars: number; prevStars: number; newStars: number; starMask: number; prevMask: number; pouchesNew: number;
  missionsDone: { text: string; xp: number; coins: number }[]; rankUps: number; unlocked: string[];
  achievements: AchievementUnlock[]; medal: number; prevMedal: number;
  ghost: GhostRec | null;            // a new personal-best ghost to store (the app writes it to its own key)
  ghostKey: string | null;
}

export function ghostKeyFor(mode: string, stageId: string | null, dateKey: string): string | null {
  return mode === 'stage' && stageId ? 'stage:' + stageId : mode === 'daily' ? 'daily:' + dateKey : mode === 'endless' ? 'endless' : null;
}

/**
 * Book a finished run into the save. Call exactly once per finished RunState. `dateKey` is the run's course day (an
 * archive daily books into that day's record); `now` is the real calendar day, which alone counts toward 참여한 날.
 */
export function applyRun(p: Progress, s: RunState, dateKey = todayKey(), now = todayKey()): RunReward {
  const score = totalScore(s);
  const coinsFromPickups = s.stats.coins; const coinsFromDist = Math.floor(s.dist / 100);
  const r: RunReward = {
    score, coins: 0, coinsFromPickups, coinsFromDist, coinsFromMissions: 0, coinsFromRank: 0, newBest: false, prevBest: 0,
    stars: 0, prevStars: 0, newStars: 0, starMask: 0, prevMask: 0, pouchesNew: 0, missionsDone: [], rankUps: 0, unlocked: [],
    achievements: [], medal: 0, prevMedal: 0, ghost: null, ghostKey: null,
  };
  if (s.trial) return r;                     // try-out runs never touch records, missions or coins
  const T = p.totals; const st = s.stats;
  const missionsOpen = featureOpen(p, 'missions');   // judged before this run counts (GDD §9.8: missions appear after 3 runs)
  T.runs++; T.dist += Math.floor(s.dist); T.jellies += st.jellies; T.coins += st.coins; T.bonusTimes += st.bonusTimes; T.playTime += s.t;
  T.nearMisses += st.nearMisses; T.airJumps += st.airJumps; T.smashed += st.smashed; T.potions += st.potions; T.bigJellies += st.bigJellies;
  T.letters += st.letters; T.lines += st.lines; T.superBonus += st.superBonus; T.bestStreak = Math.max(T.bestStreak, st.bestStreak);
  T.moonCakes = (T.moonCakes ?? 0) + st.moonCakes; T.fastFalls = (T.fastFalls ?? 0) + st.fastFalls; T.relayDist = (T.relayDist ?? 0) + Math.floor(st.relayDist);
  if (p.lastDay !== now) { p.lastDay = now; p.daysPlayed++; }
  const main = s.mainId;
  const rec: BestRec = { score, dist: Math.floor(s.dist), charId: main, date: Date.now(), assist: s.assist, relay: s.relayUsed, scoreVersion: SCORE_VERSION };
  const gk = ghostKeyFor(s.mode, s.stageId, dateKey);
  const ghost = (): GhostRec => ({ seed: s.seed, content: CONTENT_HASH, charId: main, partnerId: s.partnerId, companionId: s.companionId, mode: s.mode, stageId: s.stageId, log: s.log.slice(), score, steps: s.steps, assist: s.assist, assistOpts: { ...s.assistOpts }, noCountdown: s.noCountdown });

  if (s.mode === 'endless') {
    r.prevBest = p.bestEndless?.score ?? 0;
    if (score > r.prevBest) { r.newBest = true; p.bestEndless = rec; if (s.log.length < 80000) { r.ghost = ghost(); r.ghostKey = gk; } }
    if (score > (p.bestByChar[main] ?? 0)) p.bestByChar[main] = score;
    addHall(p, { ...rec, mode: 'endless' });
  } else if (s.mode === 'stage' && s.stageId) {
    const id = s.stageId;
    r.prevMask = p.starMask[id] ?? 0; r.prevStars = starsOf(r.prevMask);
    if (s.phase === 'clear') {
      T.clears++;
      const before = p.pouches[id] ?? 0; const after = before | (s.pouchesGot & 7);
      r.pouchesNew = starsOf(after & ~before); p.pouches[id] = after; T.pouches += r.pouchesNew;
      r.starMask = stageStarMaskOf(s, after);
      const merged = r.prevMask | r.starMask; p.starMask[id] = merged;
      r.stars = starsOf(merged); r.newStars = r.stars - r.prevStars;
    }
    r.prevBest = p.stageBest[id] ?? 0;
    if (score > r.prevBest && s.phase === 'clear') { r.newBest = true; p.stageBest[id] = score; if (s.log.length < 80000) { r.ghost = ghost(); r.ghostKey = gk; } }
    if (s.phase === 'clear') addHall(p, { ...rec, mode: 'stage', key: id });
  } else if (s.mode === 'daily') {
    const d = p.daily[dateKey] ?? { best: 0, dist: 0, tries: 0, charId: main, medal: 0 };
    d.tries++; r.prevBest = d.best; r.prevMedal = d.medal;
    if (score > d.best) { d.best = score; d.charId = main; d.bestDist = Math.floor(s.dist); d.assist = s.assist; r.newBest = true; if (s.log.length < 80000) { r.ghost = ghost(); r.ghostKey = gk; } }
    d.dist = Math.max(d.dist, Math.floor(s.dist)); d.medal = Math.max(d.medal, medalFor(Math.floor(s.dist))); r.medal = d.medal;
    p.daily[dateKey] = d;
    addHall(p, { ...rec, mode: 'daily', key: dateKey });
  }

  if (s.mode !== 'tutorial' && missionsOpen) {
    const done = applyRunToMissions(p.missions, s, p, { newStars: r.newStars, pouchesNew: r.pouchesNew, cleared: s.mode === 'stage' && s.phase === 'clear' });
    const finished = done.map(i => p.missions[i].id);
    for (const i of done.sort((a, b) => b - a)) {
      const m = p.missions[i]; const rw = MISSION_REWARD[m.level];
      r.missionsDone.push({ text: missionText(m), xp: rw.xp, coins: rw.coins });
      r.coinsFromMissions += rw.coins; p.xp += rw.xp; p.missionsDone++;
      p.missions.splice(i, 1);
    }
    while (p.rank < RANK_MAX && p.xp >= RANK_XP(p.rank)) { p.xp -= RANK_XP(p.rank); r.coinsFromRank += RANK_REWARD(p.rank); p.rank++; r.rankUps++; }
    if (p.rank >= RANK_MAX) p.xp = Math.min(p.xp, RANK_XP(RANK_MAX));   // capped: keep the bar full, never overflow
    fillMissions(p, finished);
  } else if (s.mode === 'tutorial') p.tutorialDone = true;

  r.coins = coinsFromPickups + coinsFromDist + r.coinsFromMissions + r.coinsFromRank;
  p.coins += r.coins; T.coinsEarned = (T.coinsEarned ?? 0) + r.coins;
  r.unlocked = autoUnlock(p);
  r.achievements = evaluateAchievements(p, s);
  return r;
}
function stageStarMaskOf(s: RunState, pouchesAll: number): number {
  const st = STAGE_BY_ID[s.stageId ?? '']; if (!st || s.phase !== 'clear') return 0;
  let m = 1;
  if (jellyPct(s) >= st.stars.jellyPct) m |= 2;
  if ((pouchesAll & 7) === 7) m |= 4;
  return m;
}
/** ★ mask this run alone would earn (pouches from earlier completed runs count toward ★3). */
export function stageStarMask(s: RunState, pouchesBefore = 0): number { return stageStarMaskOf(s, pouchesBefore | (s.pouchesGot & 7)); }

function addHall(p: Progress, h: HallRec): void { p.hall.push(h); p.hall = trimHall(p.hall); }
/**
 * The top 10 per (mode, key, character) — but ONE per day for 오늘의 골목: the day's best, the only daily record the hall
 * shows (every try kept would grow the save, written twice with its backup, by ~0.5 MB a year). Ties keep the earlier.
 */
function trimHall(hall: HallRec[]): HallRec[] {
  const groups = new Map<string, HallRec[]>();
  for (const x of hall) { const k = x.mode === 'daily' ? `daily|${x.key ?? ''}` : `${x.mode}|${x.key ?? ''}|${x.charId}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(x); }
  return [...groups.values()].flatMap(g => g.sort((a, b) => b.score - a.score).slice(0, g[0].mode === 'daily' ? 1 : 10));
}

/** Swapping a mission is always free (a swapped mission simply gives no stars). */
export function canReroll(p: Progress, i: number): boolean { return !!p.missions[i]; }
export function reroll(p: Progress, i: number): boolean {
  if (!p.missions[i]) return false;
  const all = p.missions.map(m => m.id);
  const others = p.missions.filter((_, j) => j !== i);   // the rules look at the two that stay
  p.missions[i] = drawMission(all, p, p.missionCounter++, others);
  return true;
}
