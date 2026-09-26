// Meta progression: rewards, missions (assignment rules), achievements + cosmetics, shop, saves (fallbacks, quota,
// backup code, migration fixtures). No energy/gacha/consumables anywhere. (GDD §9, §13.5)
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { newRun, stepRun, jellyPct } from '../src/sim/run';
import { Autopilot } from '../src/sim/autopilot';
import {
  defaultProgress, normalize, applyRun, unlockState, buyCharacter, autoUnlock, stageUnlocked, totalStars, reroll, dailySeed, dailyChar, todayKey,
  MIGRATIONS, stageStarCount, fillMissions, takeLegacyGhosts, featureOpen, recordCode, mergeProgress, SAVE_VERSION, type Progress,
} from '../src/meta/progress';
import {
  MISSIONS, MISSION_BY_ID, drawMission, applyRunToMissions, RANK_XP, RANK_MAX, RANK_REWARD, RANK_TITLES, MISSION_REWARD, rankRewardPreview, rankXpTotal,
  isQuick, maxLevelFor, requirementMet, longModeOpen, runTrace, missionText, liveMissionProgress,
} from '../src/meta/missions';
import {
  ACHIEVEMENTS, COSMETICS, COSMETIC_BY_ID, evaluateAchievements, achievementProgress, achievementView, buyCosmetic, equipCosmetic, unequipCosmetic,
  equippedFor, shopList, estimateRuns, PALETTE_PRICE,
} from '../src/meta/achievements';
import * as store from '../src/platform/storage';
import { CHARACTERS } from '../src/data/characters';
import { STAGES } from '../src/data/stages';
import { CONTENT_HASH } from '../src/sim/content';
import type { RunState } from '../src/sim/types';

function finished(mode: 'endless' | 'stage' | 'daily' = 'endless', patch: (s: RunState) => void = () => {}, stageId?: string): RunState {
  const s = newRun({ mode, seed: 5, charId: CHARACTERS[0].id, stageId });
  while (s.phase === 'countdown') stepRun(s, { jump: false, slide: false });
  for (let i = 0; i < 120; i++) stepRun(s, { jump: false, slide: false });
  patch(s); s.phase = 'over';
  return s;
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('progress', () => {
  it('fresh save: a starter character, 3 missions, no coins', () => {
    const p = defaultProgress();
    expect(p.unlocked.length).toBeGreaterThanOrEqual(1);
    expect(p.missions.length).toBe(3);
    expect(new Set(p.missions.map(m => m.id)).size).toBe(3);
    expect(p.coins).toBe(0);
  });
  it('normalize repairs partial/old saves without wiping progress', () => {
    const p = normalize({ version: 1, coins: 123, unlocked: ['nope'], main: 'nope', missions: 'bad', settings: { sfx: 0.2 } });
    expect(p.coins).toBe(123);
    expect(p.settings.sfx).toBe(0.2);
    expect(p.settings.bgm).toBe(defaultProgress().settings.bgm);
    expect(p.unlocked.every(id => CHARACTERS.some(c => c.id === id))).toBe(true);
    expect(p.missions.length).toBe(3);
    expect(CHARACTERS.some(c => c.id === p.loadout.main)).toBe(true);
  });
  it('normalize drops missions whose template no longer exists and repairs numbers', () => {
    const p = normalize({ version: 2, missions: [{ id: 'gone', level: 0, progress: 1, target: 2, runsWithout: 0 }, { id: 'jelly_run', level: 9, progress: 'x', target: -1 }] });
    expect(p.missions.length).toBe(3);
    expect(p.missions.some(m => m.id === 'gone')).toBe(false);
    const j = p.missions.find(m => m.id === 'jelly_run')!;
    expect(j.level).toBe(2); expect(j.progress).toBe(0); expect(j.target).toBe(MISSION_BY_ID.jelly_run.targets[2]);
  });
  it('v1 saves migrate to v2 without losing coins, stars or unlocks', () => {
    const v1 = { version: 1, coins: 777, unlocked: ['hotteok', 'bungeo'], main: 'bungeo', partner: 'hotteok', stars: { '1-1': 3, '1-2': 1 }, missions: [], settings: { sfx: 0.3, assist: true } };
    const p = normalize(v1);
    expect(p.version).toBe(2); expect(p.coins).toBe(777);
    expect(p.unlocked).toContain('bungeo'); expect(p.loadout.main).toBe('bungeo'); expect(p.loadout.partner).toBe('hotteok');
    expect(p.starMask['1-1']).toBe(7); expect(p.starMask['1-2']).toBe(1);
    // a v1 ★3 keeps its three golden pouches (the ★3 condition) — not ★3 next to "0/3"; the starter companion is equipped
    expect(p.pouches).toEqual({ '1-1': 7 });
    expect(p.loadout.companion).toBe(defaultProgress().loadout.companion); expect(p.loadout.companion).not.toBeNull();
    expect(p.settings.sfx).toBe(0.3); expect(p.settings.assistHalfDrain).toBe(true);
    expect(typeof MIGRATIONS[1]).toBe('function');
  });
  it('normalize: an edited backup code (prototype-name ids, wrong types) cannot break a run — only real ids, typed values', () => {
    const p = normalize({
      version: 2, coins: 'lots', rank: null, lastDay: 5, tutorialDone: 'yes',
      missions: [{ id: 'constructor', level: 0, progress: 0, target: 5, runsWithout: 0 }, { id: '__proto__', target: 5 }, { id: 'toString', target: 5 }],
      unlocked: ['hotteok', 'constructor', 'toString'], companions: ['constructor'], loadout: { main: 'constructor', partner: 'toString', companion: 'hasOwnProperty' },
      hall: [null, 5, { score: 'x', mode: 'endless', charId: 'hotteok' }], daily: { '2026-09-01': null, '2026-09-02': { best: 'x' }, '2026-09-03': { best: 10, bestDist: 'far', assist: 1 } },
      settings: { gameSpeed: 'fast', sfx: 7, bgm: -1, uiScale: 3, swapSides: 'yes' }, totals: { dist: '100', runs: 'x', jellies: Infinity },
      achievements: { constructor: 1, near_20: 'x' }, starMask: { '1-1': 'x', '1-2': 99 }, stageBest: { '1-1': '5000' }, bestEndless: { score: 'x' },
      cosmetics: { owned: ['constructor', 3], equipped: { hotteok: 'hat' } },
    });
    const d = defaultProgress();
    expect(p.missions.length).toBe(3);
    for (const m of p.missions) expect(Object.prototype.hasOwnProperty.call(MISSION_BY_ID, m.id), m.id).toBe(true);
    for (const id of ['constructor', '__proto__', 'toString']) expect(MISSION_BY_ID[id as string]).toBeUndefined();
    expect(COSMETIC_BY_ID['constructor' as string]).toBeUndefined();
    expect(p.unlocked).toEqual(d.unlocked); expect(p.companions).toEqual(d.companions);
    expect(p.loadout).toEqual({ main: d.loadout.main, partner: null, companion: d.loadout.companion });
    expect(p.coins).toBe(0); expect(p.rank).toBe(0); expect(p.lastDay).toBe(''); expect(p.tutorialDone).toBe(false);
    expect(p.hall).toEqual([]); expect(Object.keys(p.daily)).toEqual(['2026-09-03']); expect(p.daily['2026-09-03']).toEqual({ best: 10, dist: 0, tries: 0, charId: d.loadout.main, medal: 0 });
    expect(p.settings).toMatchObject({ gameSpeed: d.settings.gameSpeed, sfx: 1, bgm: 0, uiScale: 1, swapSides: false });
    expect(p.totals).toMatchObject({ dist: 0, runs: 0, jellies: 0 });
    expect(p.achievements).toEqual({ constructor: 1 }); expect(p.starMask).toEqual({ '1-2': 99 & 7 }); expect(p.stageBest).toEqual({}); expect(p.bestEndless).toBeNull();
    expect(p.cosmetics).toEqual({ owned: ['constructor'], equipped: {} });
    // it round-trips, and runs start and book on it (before: newRun "reading 'kind'", applyRun "measure is not a function" / "reading 'mode'")
    const q = normalize(clone(p)); expect(q).toEqual(p);
    q.totals.runs = 3;
    expect(() => newRun({ mode: 'endless', seed: 1, charId: q.loadout.main, partnerId: q.loadout.partner, companionId: q.loadout.companion })).not.toThrow();
    const r = applyRun(q, finished('endless', s => { s.dist = 600; }));
    expect(r.score).toBeGreaterThan(0); expect(q.totals.runs).toBe(4); expect(q.totals.dist).toBe(600);
  });
  it('endless run books coins from pickups + distance, updates best once', () => {
    const p = defaultProgress();
    const s = finished('endless', s => { s.stats.coins = 12; s.dist = 345; s.score = 1000; });
    const r = applyRun(p, s);
    expect(r.coinsFromPickups).toBe(12); expect(r.coinsFromDist).toBe(3);
    expect(p.coins).toBe(r.coins); expect(p.totals.coinsEarned).toBe(r.coins);
    expect(r.newBest).toBe(true); expect(p.bestEndless!.score).toBe(1000 + 345);
    const s2 = finished('endless', s => { s.dist = 10; s.score = 5; });
    expect(applyRun(p, s2).newBest).toBe(false);
  });
  it('a best-run ghost records whether its run had the 3-2-1 (the log counts steps from that first step)', () => {
    const p = defaultProgress();
    const a = applyRun(p, finished('endless', s => { s.score = 100; }));
    expect(a.ghost!.noCountdown).toBe(false); expect(a.ghostKey).toBe('endless');
    const s = newRun({ mode: 'endless', seed: 5, charId: 'hotteok', noCountdown: true });
    for (let i = 0; i < 120; i++) stepRun(s, { jump: false, slide: false });
    s.score = 99999; s.phase = 'over';
    expect(applyRun(p, s).ghost!.noCountdown).toBe(true);
  });
  it('trial runs never pay out or touch records', () => {
    const p = defaultProgress();
    const s = newRun({ mode: 'endless', seed: 1, charId: CHARACTERS[0].id, trial: true }); s.stats.coins = 50; s.dist = 900; s.phase = 'over';
    const r = applyRun(p, s);
    expect(r.coins).toBe(0); expect(p.coins).toBe(0); expect(p.bestEndless).toBeNull(); expect(p.totals.runs).toBe(0);
    expect(r.achievements).toEqual([]);
  });
  it('stage stars: ★1 finish, ★2 candy %, ★3 all three pouches (pouches add up across completed runs)', () => {
    if (!STAGES.length) return;
    const st = STAGES[0]; const p = defaultProgress();
    const s = finished('stage', s => { s.stats.jellies = 100; s.stats.jelliesSeen = 100; s.pouchesGot = 0b011; }, st.id); s.phase = 'clear';
    const r = applyRun(p, s);
    expect(r.stars).toBe(2); expect(stageStarCount(p, st.id)).toBe(2); expect(p.pouches[st.id]).toBe(3);
    const s2 = finished('stage', s => { s.stats.jellies = 0; s.stats.jelliesSeen = 100; s.pouchesGot = 0b100; }, st.id); s2.phase = 'clear';
    const r2 = applyRun(p, s2);
    expect(r2.stars).toBe(3); expect(stageStarCount(p, st.id)).toBe(3);   // ★2 kept, ★3 from pouches of two runs
    const s3 = finished('stage', s => { s.pouchesGot = 7; }, st.id);        // died: pouches of an unfinished run don't count
    const p3 = defaultProgress(); applyRun(p3, s3); expect(p3.pouches[st.id] ?? 0).toBe(0); expect(stageStarCount(p3, st.id)).toBe(0);
  });
  it('stage unlock chain: the next stage needs ★1 on the previous', () => {
    const p = defaultProgress();
    expect(stageUnlocked(p, STAGES[0].id)).toBe(true);
    const regular = STAGES.filter(s => !s.remix);
    if (regular.length > 1) {
      expect(stageUnlocked(p, regular[1].id)).toBe(false);
      p.starMask[regular[0].id] = 1;
      expect(stageUnlocked(p, regular[1].id)).toBe(true);
    }
    expect(totalStars(p)).toBe(regular.length > 1 ? 1 : 0);
  });
  it('참여한 날 counts real calendar days: an archive daily books into its own day but never adds a day', () => {
    const p = defaultProgress();
    applyRun(p, finished('endless'), '2026-09-26', '2026-09-26');
    for (let i = 0; i < 5; i++) { applyRun(p, finished('daily'), '2026-09-23', '2026-09-26'); applyRun(p, finished('endless'), '2026-09-26', '2026-09-26'); }
    expect(p.daysPlayed).toBe(1); expect(p.lastDay).toBe('2026-09-26'); expect(p.daily['2026-09-23'].tries).toBe(5);
    applyRun(p, finished('daily'), '2026-09-21', '2026-09-27'); expect(p.daysPlayed).toBe(2);
  });
  it('daily record: the share code is one real try (best score + ITS distance), an assisted best is marked; medals follow the longest try', () => {
    const p = defaultProgress(); const k = '2026-09-20';
    applyRun(p, finished('daily', s => { s.dist = 2100; s.score = 30000; }), k);
    applyRun(p, finished('daily', s => { s.dist = 1500; s.score = 32000; s.assist = true; }), k);
    const d = p.daily[k];
    expect(d.dist).toBe(2100); expect(d.medal).toBe(2);
    expect(d.best).toBe(32000 + 1500); expect(d.bestDist).toBe(1500); expect(d.assist).toBe(true);
    expect(recordCode(k, d.best, d.bestDist!, d.assist)).toMatch(/^260920-33500-1500-[0-9A-Z]{2}-도움$/);
    expect(recordCode(k, d.best, d.bestDist!)).toMatch(/^260920-33500-1500-[0-9A-Z]{2}$/);
    applyRun(p, finished('daily', s => { s.dist = 3000; s.score = 100; }), k);   // longer but lower: medal only
    expect(p.daily[k]).toMatchObject({ best: 33500, bestDist: 1500, assist: true, dist: 3000, medal: 2 });
  });
  it('hall of fame keeps ONE record per day for 오늘의 골목 (that day\'s best); older saves are pruned on load', () => {
    const p = defaultProgress();
    for (const [k, score] of [['2026-09-20', 500], ['2026-09-20', 900], ['2026-09-20', 700], ['2026-09-21', 300]] as const) applyRun(p, finished('daily', s => { s.score = score; }), k);
    const days = p.hall.filter(h => h.mode === 'daily');
    expect(days.map(h => [h.key, h.score])).toEqual([['2026-09-20', p.daily['2026-09-20'].best], ['2026-09-21', p.daily['2026-09-21'].best]]);
    for (let i = 0; i < 12; i++) applyRun(p, finished('endless', s => { s.score = i * 100; }));
    expect(p.hall.filter(h => h.mode === 'endless').length).toBe(10);   // endless: still the top 10 per character
    const old = clone(p); for (let i = 0; i < 10; i++) old.hall.push({ ...days[0], score: i, date: i });   // a save from before: every try kept
    const q = normalize(old);
    expect(q.hall.filter(h => h.mode === 'daily')).toEqual(days);
    // a year of dailies, 10 tries a day: the hall grows by one record a day (it was ten)
    const y = defaultProgress();
    for (let d = 0; d < 60; d++) for (let t = 0; t < 10; t++) applyRun(y, finished('daily', s => { s.score = t; }), `2026-${String(1 + Math.floor(d / 28)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}`);
    expect(y.hall.length).toBe(60);
  });
});

describe('unlocks', () => {
  it('every character has a visible, deterministic unlock path (no gacha)', () => {
    for (const c of CHARACTERS) expect(['start', 'stars', 'rank', 'coins']).toContain(c.unlock.kind);
    const p = defaultProgress();
    for (const c of CHARACTERS) { const u = unlockState(p, c.id); if (!u.ok) expect(u.reason.length).toBeGreaterThan(0); }
  });
  it('coins buy exactly the listed price; refusing when short', () => {
    const c = CHARACTERS.find(c => c.unlock.kind === 'coins'); if (!c) return;
    const cost = (c.unlock as { cost: number }).cost; const p = defaultProgress();
    p.coins = cost - 1; expect(buyCharacter(p, c.id).ok).toBe(false); expect(p.coins).toBe(cost - 1);
    p.coins = cost; expect(buyCharacter(p, c.id).ok).toBe(true); expect(p.coins).toBe(0); expect(p.unlocked).toContain(c.id);
    expect(buyCharacter(p, c.id).ok).toBe(false);
  });
  it('star / rank unlocks are granted automatically', () => {
    const p = defaultProgress(); p.rank = 99; for (const st of STAGES) p.starMask[st.id] = 7;
    autoUnlock(p);
    const maxStars = STAGES.length * 3;
    for (const c of CHARACTERS) if (c.unlock.kind === 'rank' || (c.unlock.kind === 'stars' && c.unlock.n <= maxStars)) expect(p.unlocked).toContain(c.id);
  });
});

// ---------------------------------------------------------------- missions
/** A spread of saves at different points of the game (feature gates, rank, unlocks, stage progress). */
function contexts(): Progress[] {
  const out: Progress[] = [];
  const runs = [3, 4, 6, 9, 13, 30, 80];
  for (let i = 0; i < 28; i++) {
    const p = defaultProgress();
    p.totals.runs = runs[i % runs.length]; p.rank = (i * 7) % (RANK_MAX + 1); p.tutorialDone = true;
    const cleared = STAGES.filter(s => !s.remix).slice(0, i % 9);
    for (const st of cleared) p.starMask[st.id] = i % 2 ? 1 : 3;
    if (i % 3 === 0) p.unlocked = CHARACTERS.map(c => c.id);
    if (i % 5 === 0) for (const st of STAGES) p.pouches[st.id] = 7;
    p.missions = []; p.missionCounter = i * 11; fillMissions(p);
    out.push(p);
  }
  return out;
}
function checkRules(p: Progress, where: string): void {
  const ms = p.missions;
  expect(ms.length, where).toBe(3);
  expect(new Set(ms.map(m => m.id)).size, where + ' distinct').toBe(3);
  const verbs: Record<string, number> = {};
  for (const m of ms) {
    const t = MISSION_BY_ID[m.id]; expect(t, where).toBeTruthy();
    verbs[t.verb] = (verbs[t.verb] ?? 0) + 1;
    expect(requirementMet(p, t.requires), `${where}: ${m.id} requires ${t.requires}`).toBe(true);
    expect(m.level, `${where}: ${m.id} level`).toBeLessThanOrEqual(maxLevelFor(t, p));
    expect(m.target).toBe(t.targets[m.level]);
  }
  expect(Math.max(...Object.values(verbs)), where + ' same verb').toBeLessThanOrEqual(2);
  expect(ms.filter(m => MISSION_BY_ID[m.id].quirky).length, where + ' quirky').toBeLessThanOrEqual(1);
  expect(ms.filter(m => isQuick(m, p)).length, where + ' finishable in one run').toBeGreaterThanOrEqual(1);
}

describe('missions', () => {
  it('40 templates × 3 levels; increasing targets; no chores, no characters; verbs and requirements declared', () => {
    expect(MISSIONS.length).toBe(40);
    expect(new Set(MISSIONS.map(m => m.id)).size).toBe(40);
    const names = CHARACTERS.map(c => c.name);
    for (const m of MISSIONS) {
      expect(m.targets[0]).toBeLessThan(m.targets[1]); expect(m.targets[1]).toBeLessThan(m.targets[2]);
      const txt = m.text(m.targets[1]);
      expect(/(맞기|맞으세요|부딪히기|쓰러지|죽|판 하기|판 플레이|번 달리기)/.test(txt), `${m.id}: chore "${txt}"`).toBe(false);
      expect(names.some(n => txt.includes(n)), `${m.id}: names a character`).toBe(false);
      expect(m.verb.length).toBeGreaterThan(0);
      expect(m.quick).toBeGreaterThanOrEqual(0); expect(m.quick).toBeLessThanOrEqual(3);
    }
    // GDD §9.3 new ids are all present
    for (const id of ['line_run', 'big_run', 'power_run', 'bonus_run', 'tier_run', 'smash_run', 'flow_run', 'coin_run', 'potion_run', 'sky_run', 'no_potion', 'no_air', 'no_jelly', 'nohit_dist', 'super_bonus', 'fastfall_run', 'relay_dist', 'dist_tot', 'jelly_tot', 'near_tot', 'airjump_tot', 'star_tot', 'pouch_tot', 'clear_tot', 'daily_dist'])
      expect(MISSION_BY_ID[id], id).toBeTruthy();
    expect(MISSIONS.filter(m => m.quirky).map(m => m.id).sort()).toEqual(['no_air', 'no_jelly', 'no_potion', 'super_bonus']);
    expect(MISSION_BY_ID.fastfall_run.requires).toBe('world2'); expect(MISSION_BY_ID.relay_dist.requires).toBe('relay');
    expect(MISSION_BY_ID.daily_dist.modes).toEqual(['daily']);
    for (const id of ['star_tot', 'pouch_tot', 'clear_tot']) expect(MISSION_BY_ID[id].requires).toBe('stage');
  });
  it('assignment rules hold over many draws (fills, completions, swaps) in every stage of the game', () => {
    let draws = 0; const seen = new Set<string>(); let exactlyOneQuick = 0; let sets = 0;
    for (const [ci, p] of contexts().entries()) {
      checkRules(p, `ctx ${ci} fill`);
      for (let step = 0; step < 40; step++) {
        const j = (step * 7 + ci) % 3;
        if (step % 3 === 2) { reroll(p, j); }
        else { const id = p.missions[j].id; p.missions.splice(j, 1); p.missionsDone++; fillMissions(p, [id]); }
        draws++; for (const m of p.missions) seen.add(m.id);
        checkRules(p, `ctx ${ci} step ${step}`);
        sets++; if (p.missions.filter(m => isQuick(m, p)).length === 1) exactlyOneQuick++;
      }
    }
    expect(draws).toBeGreaterThan(1000);
    expect(exactlyOneQuick / sets).toBeGreaterThan(0.95);   // shape: one "this run" mission + two longer goals
    expect(seen.size).toBeGreaterThanOrEqual(34);           // (fastfall needs a world-2 clear; pouch needs pouches in the data)
  });
  it('no mission for an unopened feature: fresh save (stage phase) only gets stage-doable missions', () => {
    const p = defaultProgress(); p.totals.runs = 3; p.tutorialDone = true; p.missions = []; fillMissions(p);
    expect(longModeOpen(p)).toBe(false);
    for (let i = 0; i < 60; i++) {
      for (const m of p.missions) {
        const t = MISSION_BY_ID[m.id];
        expect(t.requires === 'long' || t.requires === 'relay' || t.requires === 'daily' || t.requires === 'world2', `${m.id} offered too early`).toBe(false);
        expect(m.level).toBeLessThan(t.stageLevels);
      }
      reroll(p, i % 3);
    }
    // relay / daily / world2 stay hidden until opened
    const q = defaultProgress(); q.totals.runs = 12; q.rank = 10;
    expect(maxLevelFor(MISSION_BY_ID.relay_dist, q)).toBe(-1);
    expect(maxLevelFor(MISSION_BY_ID.fastfall_run, q)).toBe(-1);
    expect(maxLevelFor(MISSION_BY_ID.bonus_run, q)).toBe(1);        // 3 feasts in one run need the relay partner
    q.unlocked = CHARACTERS.map(c => c.id); for (const st of STAGES.filter(s => s.world === 1 && !s.remix)) q.starMask[st.id] = 1;
    if (STAGES.some(s => s.id === '1-6')) { expect(maxLevelFor(MISSION_BY_ID.relay_dist, q)).toBe(2); expect(maxLevelFor(MISSION_BY_ID.bonus_run, q)).toBe(2); }
  });
  it('drawing is deterministic (no Math.random): the same save offers the same mission', () => {
    const a = defaultProgress(); const b = normalize(clone(a));
    expect(b.missions).toEqual(a.missions);
    for (let c = 0; c < 30; c++) expect(drawMission(['jelly_run'], a, c)).toEqual(drawMission(['jelly_run'], b, c));
  });
  it('drawn missions never duplicate an active one', () => {
    const p = defaultProgress(); p.totals.runs = 20;
    for (let c = 0; c < 60; c++) { p.rank = c % 7; const ex = [MISSIONS[c % MISSIONS.length].id, MISSIONS[(c + 3) % MISSIONS.length].id]; expect(ex).not.toContain(drawMission(ex, p, c).id); }
  });
  it('missions only count once the feature is open (after 3 runs)', () => {
    const p = defaultProgress();
    p.missions = [{ id: 'jelly_run', level: 0, progress: 0, target: 1, runsWithout: 0 }, ...p.missions.slice(1)];
    for (let i = 0; i < 3; i++) expect(applyRun(p, finished('endless', s => { s.stats.jellies = 5; })).missionsDone).toEqual([]);
    expect(applyRun(p, finished('endless', s => { s.stats.jellies = 5; })).missionsDone.length).toBe(1);
  });
  it('run-scope keeps the best single run; total-scope accumulates; completion pays and refills', () => {
    const p = defaultProgress(); p.totals.runs = 3;
    p.missions = [{ id: 'jelly_run', level: 0, progress: 0, target: 150, runsWithout: 0 }, { id: 'coin_tot', level: 0, progress: 0, target: 60, runsWithout: 0 }, { id: 'near', level: 0, progress: 0, target: 3, runsWithout: 0 }];
    const s1 = finished('endless', s => { s.stats.jellies = 100; s.stats.coins = 40; });
    expect(applyRunToMissions(p.missions, s1)).toEqual([]);
    expect(p.missions[0].progress).toBe(100); expect(p.missions[1].progress).toBe(40);
    const s2 = finished('endless', s => { s.stats.jellies = 50; s.stats.coins = 30; });
    const r = applyRun(p, s2);
    expect(r.missionsDone.map(m => m.text)).toEqual([expect.stringContaining('엽전')]);
    expect(r.coinsFromMissions).toBe(MISSION_REWARD[0].coins);
    expect(p.missions.length).toBe(3);
    expect(p.missions.find(m => m.id === 'jelly_run')!.progress).toBe(100);
    expect(p.missions.some(m => m.id === 'coin_tot')).toBe(false);   // a just-finished mission is not offered right back
  });
  it('mode filters and stage deltas: daily_dist only counts daily runs; star/clear count booked stage results', () => {
    const a = [{ id: 'daily_dist', level: 0, progress: 0, target: 800, runsWithout: 0 }];
    applyRunToMissions(a, finished('endless', s => { s.dist = 5000; }));
    expect(a[0].progress).toBe(0); expect(a[0].runsWithout).toBe(1);
    expect(applyRunToMissions(a, finished('daily', s => { s.dist = 900; }))).toEqual([0]);
    const p = defaultProgress(); p.totals.runs = 3;
    p.missions = [{ id: 'star_tot', level: 0, progress: 0, target: 2, runsWithout: 0 }, { id: 'clear_tot', level: 0, progress: 0, target: 2, runsWithout: 0 }, { id: 'jelly_run', level: 2, progress: 0, target: 99999, runsWithout: 0 }];
    const st = STAGES[0].id;
    const s = finished('stage', s => { s.stats.jellies = 100; s.stats.jelliesSeen = 100; }, st); s.phase = 'clear';
    const r = applyRun(p, s);
    expect(r.newStars).toBe(2);
    expect(r.missionsDone.length).toBe(1);   // ★1 + ★2 = 2 new stars → star_tot done; clear_tot at 1/2
    expect(p.missions.find(m => m.id === 'clear_tot')!.progress).toBe(1);
    // replaying the same stage adds no stars
    const again = [{ id: 'star_tot', level: 0, progress: 0, target: 2, runsWithout: 0 }];
    applyRunToMissions(again, s, p); expect(again[0].progress).toBe(0);
  });
  it('stretch missions use an exact replay; a tampered run falls back conservatively', () => {
    const s = finished('endless');
    const t = runTrace(s);
    expect(t.exact).toBe(true);
    expect(t.noHit).toBe(Math.floor(s.dist));
    const bad = finished('endless', s => { s.stats.hits = 2; s.dist += 50; });   // no longer reproducible
    const tb = runTrace(bad);
    expect(tb.exact).toBe(false); expect(tb.noHit).toBe(0);
    // mid-run (the HUD checks missions every 0.5 s): cheap values, no replay, nothing cached for the final booking
    const live = newRun({ mode: 'endless', seed: 5, charId: 'hotteok', noCountdown: true });
    for (let i = 0; i < 600; i++) stepRun(live, { jump: false, slide: false });
    const mid = runTrace(live); expect(mid.exact).toBe(false);
    for (let i = 0; i < 600; i++) stepRun(live, { jump: false, slide: false });
    live.phase = 'over';
    const end = runTrace(live); expect(end.exact).toBe(true); expect(end.noAir).toBe(Math.floor(live.dist));
  });
  it('live progress during a run (for the 1.5 s toast) never mutates the missions', () => {
    const active = [{ id: 'jelly_run', level: 0, progress: 0, target: 150, runsWithout: 0 }, { id: 'coin_tot', level: 0, progress: 50, target: 60, runsWithout: 0 }, { id: 'star_tot', level: 0, progress: 0, target: 2, runsWithout: 0 }];
    const before = clone(active);
    const s = newRun({ mode: 'endless', seed: 3, charId: 'hotteok' }); s.stats.jellies = 149; s.stats.coins = 9;
    let live = liveMissionProgress(active, s);
    expect(live.map(l => l.done)).toEqual([false, false, false]);
    s.stats.jellies = 150; s.stats.coins = 10;
    live = liveMissionProgress(active, s);
    expect(live.map(l => l.done)).toEqual([true, true, false]); expect(live[1].progress).toBe(60);
    expect(active).toEqual(before);
    expect(liveMissionProgress([{ id: 'daily_dist', level: 0, progress: 0, target: 800, runsWithout: 0 }], Object.assign(s, { dist: 900 }))[0].done).toBe(false);
  });
  it('jellypct reads the 별사탕 rate AT 500 m (frozen): a "미션 완료!" toast is always booked', () => {
    const t = MISSION_BY_ID.jellypct;
    const s = newRun({ mode: 'endless', seed: 5308, charId: 'hotteok', companionId: 'firefly' }); const ap = new Autopilot({ jitter: 9, pad: 2, seed: 5308 });
    let at500 = -1;
    while (s.phase !== 'over' && s.t < 900) {
      stepRun(s, ap.next(s)); s.events.length = 0;
      if (s.dist < 500) expect(t.measure(s)).toBe(0);
      else if (at500 < 0) { at500 = jellyPct(s); expect(t.measure(s)).toBe(at500); }
    }
    expect(at500).toBeGreaterThan(0);
    expect(jellyPct(s)).not.toBe(at500);           // the whole-run rate moved on after 500 m…
    expect(t.measure(s)).toBe(at500);               // …the mission still reads the 500 m value
    const a = [{ id: 'jellypct', level: 2, progress: 0, target: at500, runsWithout: 0 }];
    expect(liveMissionProgress(a, s)[0].done).toBe(true); expect(applyRunToMissions(a, s)).toEqual([0]);
    const b = [{ id: 'jellypct', level: 2, progress: 0, target: at500 + 1, runsWithout: 0 }];
    expect(liveMissionProgress(b, s)[0].done).toBe(false); expect(applyRunToMissions(b, s)).toEqual([]);
  });
  it('backup code / home-screen hint opens after 5 runs or the first unlock', () => {
    const p = defaultProgress(); expect(featureOpen(p, 'backup')).toBe(false);
    p.totals.runs = 5; expect(featureOpen(p, 'backup')).toBe(true);
    const q = defaultProgress(); q.unlocked.push('bungeo'); expect(featureOpen(q, 'backup')).toBe(true);
  });
  it('rank: XP curve, cap 30, rank rewards and the next-rank preview', () => {
    expect(rankXpTotal()).toBe(207);
    expect(RANK_XP(0)).toBe(3); expect(RANK_XP(29)).toBe(9);
    expect(RANK_TITLES.length).toBe(RANK_MAX + 1);
    const r5 = rankRewardPreview(5), r12 = rankRewardPreview(12);
    expect(r5.unlocks).toContain('kkochi'); expect(r12.unlocks).toContain('eomuk');
    expect(r5.coins).toBe(RANK_REWARD(4)); expect(r5.xpNeeded).toBe(RANK_XP(4));
    expect(rankRewardPreview(7).unlocks).toEqual([]); expect(rankRewardPreview(7).title.length).toBeGreaterThan(0);
    expect(rankRewardPreview(31).max).toBe(true);
    const p = defaultProgress(); p.rank = RANK_MAX; p.xp = 0; p.totals.runs = 3;
    p.missions[0] = { id: 'jelly_run', level: 2, progress: 0, target: 1, runsWithout: 0 };
    const r = applyRun(p, finished('endless', s => { s.stats.jellies = 5; }));
    expect(p.rank).toBe(RANK_MAX); expect(r.rankUps).toBe(0);
  });
  it('rank-ups pay coins; swapping a mission is always free', () => {
    const p = defaultProgress(); p.xp = RANK_XP(0) - 1; p.totals.runs = 3;
    p.missions[0] = { id: 'jelly_run', level: 2, progress: 0, target: 1, runsWithout: 0 };
    const r = applyRun(p, finished('endless', s => { s.stats.jellies = 5; }));
    expect(r.rankUps).toBeGreaterThanOrEqual(1); expect(r.coinsFromRank).toBe(RANK_REWARD(0));
    const coins = p.coins; expect(reroll(p, 1)).toBe(true); expect(reroll(p, 1)).toBe(true);
    expect(p.missions.length).toBe(3); expect(p.coins).toBe(coins);
    expect(missionText(p.missions[1]).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- achievements, cosmetics, shop
describe('achievements & cosmetics', () => {
  it('30 achievements in 5 groups of 6; 5 hidden curiosities with hints; each unlocks exactly one cosmetic', () => {
    expect(ACHIEVEMENTS.length).toBe(30);
    for (const g of ['dist', 'collect', 'skill', 'mastery', 'curious']) expect(ACHIEVEMENTS.filter(a => a.group === g).length, g).toBe(6);
    const hidden = ACHIEVEMENTS.filter(a => a.hidden);
    expect(hidden.length).toBe(5); for (const a of hidden) { expect(a.group).toBe('curious'); expect((a.hint ?? '').length).toBeGreaterThan(4); }
    const rewards = ACHIEVEMENTS.map(a => a.reward);
    expect(new Set(rewards).size).toBe(30);
    for (const r of rewards) expect(r.startsWith('title:') || !!COSMETIC_BY_ID[r], r).toBe(true);
  });
  it('catalogue: 12 hats, 8 trails, 4 jump sounds, 12 palettes (6 from 「○○로 2,000 m」, 6 × 800 엽전), one per character each', () => {
    const k = (kind: string) => COSMETICS.filter(c => c.kind === kind);
    expect(k('hat').length).toBe(12); expect(k('trail').length).toBe(8); expect(k('jumpSound').length).toBe(4); expect(k('palette').length).toBe(12);
    expect(new Set(COSMETICS.map(c => c.id)).size).toBe(COSMETICS.length);
    for (const n of ['갓', '복건', '머리띠', '족두리', '조바위', '꽃핀', '털모자', '복주머니 모자', '도깨비 뿔', '삿갓', '왕관', '월계관']) expect(k('hat').some(h => h.name === n), n).toBe(true);
    for (const n of ['별가루', '불꽃', '김', '등불', '꽃잎', '눈송이', '무지개', '엽전']) expect(k('trail').some(h => h.name === n), n).toBe(true);
    const shop = k('palette').filter(c => c.price); expect(shop.length).toBe(6);
    for (const c of shop) expect(c.price).toBe(PALETTE_PRICE);
    for (const ch of CHARACTERS) {
      expect(shop.filter(c => c.charId === ch.id).length, ch.id).toBe(1);
      expect(k('palette').filter(c => !c.price && c.charId === ch.id).length, ch.id).toBe(1);
      expect(ACHIEVEMENTS.find(a => a.reward === `pal_${ch.id}_a`)!.desc).toContain('2,000 m');
    }
    // every non-shop cosmetic comes from exactly one achievement
    for (const c of COSMETICS.filter(c => !c.price)) expect(ACHIEVEMENTS.filter(a => a.reward === c.id).length, c.id).toBe(1);
  });
  it('an achievement unlocks once, at run end, and grants its cosmetic', () => {
    const p = defaultProgress();
    const s = finished('endless', s => { s.dist = 2100; s.stats.nearMisses = 20; });
    const r = applyRun(p, s);
    const ids = r.achievements.map(a => a.id);
    expect(ids).toContain('dist_hotteok'); expect(ids).toContain('near_20'); expect(ids).toContain('sk_near_run');
    expect(p.cosmetics.owned).toContain('pal_hotteok_a'); expect(p.cosmetics.owned).toContain('hat_gat'); expect(p.cosmetics.owned).toContain('hat_bokgeon');
    const r2 = applyRun(p, finished('endless', s => { s.dist = 2500; s.stats.nearMisses = 30; }));
    expect(r2.achievements.map(a => a.id)).not.toContain('dist_hotteok');
    expect(p.cosmetics.owned.filter(c => c === 'pal_hotteok_a').length).toBe(1);
    // nothing is judged mid-run: evaluateAchievements is only called from applyRun
    expect(evaluateAchievements(p, finished('endless')).length).toBe(0);
  });
  it('relay splits the distance per character; hidden achievement shows only its hint until unlocked', () => {
    const p = defaultProgress();
    const s = finished('endless', s => { s.relayUsed = true; s.partnerId = 'bungeo'; s.relayStartDist = 800; s.dist = 2300; s.stats.relayDist = 1500; });
    applyRun(p, s);
    expect(p.bests['dist:hotteok']).toBe(800); expect(p.bests['dist:bungeo']).toBe(1500);
    expect(p.achievements.cu_relay).toBeGreaterThan(0);
    const v = achievementView(defaultProgress(), 'cu_super')!;
    expect(v.name).toBe('???'); expect(v.desc).toBe(ACHIEVEMENTS.find(a => a.id === 'cu_super')!.hint);
  });
  it('achievementProgress gives [cur, target] for every achievement', () => {
    const p = defaultProgress(); p.totals.jellies = 4321; p.totals.nearMisses = 50;
    for (const a of ACHIEVEMENTS) { const [c, t] = achievementProgress(p, a.id); expect(t).toBeGreaterThan(0); expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(t); }
    expect(achievementProgress(p, 'col_jelly')).toEqual([4321, 10000]);
    expect(achievementProgress(p, 'near_20')).toEqual([20, 20]);
    expect(achievementProgress(p, 'nope')).toEqual([0, 1]);
  });
  it('shop: fixed prices, refuses when short / not for sale / owned; wardrobe: palettes only on their character', () => {
    const p = defaultProgress();
    expect(buyCosmetic(p, 'pal_hotteok_b').ok).toBe(false);
    p.coins = PALETTE_PRICE + 5;
    expect(buyCosmetic(p, 'hat_gat').ok).toBe(false);                 // achievement-only
    expect(buyCosmetic(p, 'pal_hotteok_b').ok).toBe(true); expect(p.coins).toBe(5);
    expect(buyCosmetic(p, 'pal_hotteok_b').ok).toBe(false);           // owned
    expect(equipCosmetic(p, 'bungeo', 'pal_hotteok_b').ok).toBe(false);
    expect(equipCosmetic(p, 'hotteok', 'pal_hotteok_b').ok).toBe(true);
    expect(equipCosmetic(p, 'hotteok', 'hat_gat').ok).toBe(false);    // not owned yet
    p.cosmetics.owned.push('hat_gat', 'jump_bell');
    expect(equipCosmetic(p, 'bungeo', 'hat_gat').ok).toBe(true); expect(equipCosmetic(p, 'bungeo', 'jump_bell').ok).toBe(true);
    expect(equippedFor(p, 'hotteok').palette!.id).toBe('pal_hotteok_b');
    expect(equippedFor(p, 'bungeo').hat!.id).toBe('hat_gat'); expect(equippedFor(p, 'bungeo').jumpSound!.id).toBe('jump_bell');
    unequipCosmetic(p, 'bungeo', 'hat'); expect(equippedFor(p, 'bungeo').hat).toBeUndefined();
    // the shop list: coin characters / companions + 6 palettes, each with a "약 N판" estimate
    const list = shopList(p);
    expect(list.filter(x => x.kind === 'cosmetic').length).toBe(6);
    expect(list.some(x => x.kind === 'char' && x.id === 'dalgona' && x.price === 2500)).toBe(true);
    expect(list.some(x => x.kind === 'companion' && x.price === 3500)).toBe(true);
    for (const x of list) if (!x.owned) expect(x.runs).toBe(estimateRuns(p, x.price));
    expect(estimateRuns(p, 0)).toBe(0); expect(estimateRuns(p, 1500)).toBe(10);   // fresh save: 150/run design estimate
  });
  it('recorded achievements always keep their cosmetic (normalize re-grants)', () => {
    const p = normalize({ version: 2, achievements: { near_20: 1, col_jelly: 2 }, cosmetics: { owned: [], equipped: {} } });
    expect(p.cosmetics.owned).toEqual(expect.arrayContaining(['hat_gat', 'trail_star']));
  });
});

// ---------------------------------------------------------------- storage
class FakeStorage {
  data = new Map<string, string>(); quota = Infinity; writes = 0;
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) {
    let used = 0; for (const [kk, vv] of this.data) if (kk !== k) used += kk.length + vv.length;
    if (used + k.length + String(v).length > this.quota) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; }
    this.writes++; this.data.set(k, String(v));
  }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}
function install(fs: FakeStorage | 'blocked' | null): FakeStorage | null {
  const g = globalThis as Record<string, unknown>;
  if (fs === 'blocked') Object.defineProperty(g, 'localStorage', { configurable: true, get() { throw new Error('SecurityError: access denied'); } });
  else Object.defineProperty(g, 'localStorage', { configurable: true, writable: true, value: fs ?? undefined });
  store.clearMemoryFallback(); store.probeStorage();
  return fs === 'blocked' ? null : fs;
}
const ghost = (score: number, content = CONTENT_HASH, n = 400) => ({ seed: 1, content, charId: 'hotteok', partnerId: null, companionId: null, mode: 'daily', stageId: null, log: Array.from({ length: n }, (_, i) => i), score, steps: 100, assist: false });
function richSave(): Progress {
  const p = defaultProgress();
  p.coins = 4321; p.rank = 7; p.xp = 2; p.unlocked = CHARACTERS.slice(0, 3).map(c => c.id); p.starMask = { [STAGES[0].id]: 3 };
  p.daily['2026-09-20'] = { best: 30000, dist: 1500, tries: 2, charId: 'bungeo', medal: 1 };
  p.cosmetics.owned.push('hat_gat'); p.cosmetics.equipped.hotteok = { hat: 'hat_gat' };
  p.bests['dist:hotteok'] = 1234; p.settings.sfx = 0.25; p.hall.push({ score: 1, dist: 2, charId: 'hotteok', date: 3, assist: false, relay: false, scoreVersion: 1, mode: 'endless' });
  p.seen.push('한글 키 ✓');
  return normalize(clone(p));
}

describe('storage', () => {
  afterEach(() => { install(null); });

  it('write → read-back verify → previous save kept as _bak; load round-trips', () => {
    const fs = install(new FakeStorage())!;
    expect(store.storageInfo.available).toBe(true);
    const p = richSave();
    expect(store.save(p).ok).toBe(true);
    expect(fs.getItem(store.BAK_KEY)).toBeNull();
    const first = fs.getItem(store.SAVE_KEY);
    p.coins += 1; expect(store.save(p).ok).toBe(true);
    expect(fs.getItem(store.BAK_KEY)).toBe(first);
    const l = store.load(); expect(l.error).toBeNull(); expect(l.p).toEqual(p);
  });
  it('a corrupted main save loads from _bak (and keeps the broken text)', () => {
    const fs = install(new FakeStorage())!;
    const p = richSave(); store.save(p); p.coins = 9999; store.save(p);
    fs.data.set(store.SAVE_KEY, '{"version":2,"coins":');   // truncated write
    const l = store.load();
    expect(l.recovered).toBe('bak'); expect(l.error).toContain('백업'); expect(l.p.coins).toBe(4321);
    fs.data.set(store.BAK_KEY, 'garbage');
    const l2 = store.load(); expect(l2.recovered).toBe('reset'); expect(fs.getItem(store.SAVE_KEY + '_broken')).toBe('{"version":2,"coins":');
  });
  it('storage blocked → memory fallback for this session', () => {
    install('blocked');
    expect(store.storageInfo.available).toBe(false);
    const p = richSave();
    const r = store.save(p); expect(r.ok).toBe(false); expect(r.error).toContain('이번 접속');
    expect(store.load().p).toEqual(p);
    expect(store.saveGhost('endless', ghost(5))).toBe(false);
    expect(store.loadGhost<{ score: number }>('endless')!.score).toBe(5);
  });
  it('no localStorage at all (old WebView) → memory fallback', () => {
    install(null);
    expect(store.storageInfo.available).toBe(false);
    const p = richSave(); store.save(p); expect(store.load().p.coins).toBe(4321);
  });
  it('QuotaExceeded → drops stale / old non-best ghosts first, never stage or endless bests, then saves', () => {
    const fs = install(new FakeStorage())!;
    const p = richSave();
    p.daily = { '2026-09-01': { best: 90000, dist: 3000, tries: 1, charId: 'hotteok', medal: 2 }, '2026-09-10': { best: 100, dist: 10, tries: 1, charId: 'hotteok', medal: 0 }, '2026-09-25': { best: 200, dist: 10, tries: 1, charId: 'hotteok', medal: 0 }, '2026-09-26': { best: 300, dist: 10, tries: 1, charId: 'hotteok', medal: 0 } };
    for (const k of ['daily:2026-09-01', 'daily:2026-09-10', 'daily:2026-09-25', 'daily:2026-09-26', 'stage:1-1', 'endless']) store.saveGhost(k, ghost(1));
    store.saveGhost('daily:2026-08-01', ghost(1, 12345));   // another build's ghost: can never replay
    const order = store.evictableGhosts(p);
    expect(order[0]).toBe('daily:2026-08-01');                                  // stale first
    expect(order).toEqual(['daily:2026-08-01', 'daily:2026-09-10', 'daily:2026-09-25']);   // oldest non-best; today (09-26) and the best day (09-01) stay
    const raw = JSON.stringify(p);
    let used = 0; for (const [k, v] of fs.data) used += k.length + v.length;
    fs.quota = used + raw.length + store.SAVE_KEY.length - 2500;   // needs roughly one ghost's worth of space
    const r = store.save(p);
    expect(r.ok).toBe(true); expect(r.error).toContain('유령');
    expect(fs.getItem('jelly_runner_ghost_stage:1-1')).not.toBeNull();
    expect(fs.getItem('jelly_runner_ghost_endless')).not.toBeNull();
    expect(fs.getItem('jelly_runner_ghost_daily:2026-09-26')).not.toBeNull();
    expect(fs.getItem('jelly_runner_ghost_daily:2026-09-01')).not.toBeNull();
    expect(fs.getItem('jelly_runner_ghost_daily:2026-08-01')).toBeNull();
    expect(JSON.parse(fs.getItem(store.SAVE_KEY)!).coins).toBe(p.coins);
  });
  it('quota that cannot be freed → memory fallback with a clear message (nothing lost this session)', () => {
    const fs = install(new FakeStorage())!;
    fs.quota = 50;
    const p = richSave(); const r = store.save(p);
    expect(r.ok).toBe(false); expect(r.error).toContain('이번 접속');
    expect(store.load().p.coins).toBe(p.coins);
  });
  it('quota with no ghost left to drop → the backup copy goes and the new save IS written (it used to rewrite _bak first)', () => {
    const fs = install(new FakeStorage())!;
    const p = richSave(); store.save(p); p.coins += 1; store.save(p);   // main + _bak
    let used = 0; for (const [k, v] of fs.data) used += k.length + v.length;
    fs.quota = used + 100; p.seen.push('x'.repeat(400));                  // fits only without _bak
    const r = store.save(p);
    expect(r.ok).toBe(true); expect(r.error).toContain('백업');
    expect(fs.getItem(store.BAK_KEY)).toBeNull();
    expect(JSON.parse(fs.getItem(store.SAVE_KEY)!).seen).toContain('x'.repeat(400));
    expect(store.load().p).toEqual(p);
  });
  it('ghosts stay under the 250 KB budget by dropping old non-best daily ghosts', () => {
    install(new FakeStorage());
    for (let d = 1; d <= 9; d++) store.saveGhost(`daily:2026-09-${String(d).padStart(2, '0')}`, ghost(d, CONTENT_HASH, 8000));
    store.saveGhost('endless', ghost(1, CONTENT_HASH, 8000));
    expect(store.ghostBytes()).toBeLessThanOrEqual(store.GHOST_BUDGET);
    expect(store.listGhosts()).toContain('endless'); expect(store.listGhosts()).toContain('daily:2026-09-09');
  });
  it('a save from a newer build is parked, never overwritten', () => {
    const fs = install(new FakeStorage())!;
    const future = { ...clone(richSave()), version: SAVE_VERSION + 1, futureField: { x: 1 } };
    fs.data.set(store.SAVE_KEY, JSON.stringify(future));
    const l = store.load();
    expect(l.recovered).toBe('newer'); expect(l.p.coins).toBe(4321);
    expect(fs.getItem(`${store.SAVE_KEY}_v${SAVE_VERSION + 1}`)).toBe(JSON.stringify(future));
    expect((l.p as unknown as { futureField: unknown }).futureField).toEqual({ x: 1 });
  });
  // another tab / the installed app on the same save: `fs` writes stand for the other instance
  const otherWrites = (fs: FakeStorage, f: (o: Progress) => void) => { const o = JSON.parse(fs.getItem(store.SAVE_KEY)!); f(o); o.rev++; fs.setItem(store.SAVE_KEY, JSON.stringify(o)); };
  it('two instances: a stale one hiding (nothing changed) writes nothing and takes in the newer save', () => {
    const fs = install(new FakeStorage())!;
    store.save(richSave());
    const mine = store.load().p; const settings = mine.settings; const missions = mine.missions;
    otherWrites(fs, o => { o.coins += 5000; o.totals.runs += 2; o.starMask['1-2'] = 1; });
    const stored = fs.getItem(store.SAVE_KEY); const writes = fs.writes;
    const r = store.save(mine);                                            // pagehide / visibilitychange in the stale tab
    expect(fs.writes).toBe(writes); expect(fs.getItem(store.SAVE_KEY)).toBe(stored);   // no rollback
    expect(r).toEqual({ ok: true, merged: true });
    expect(mine.coins).toBe(4321 + 5000); expect(mine.starMask['1-2']).toBe(1);
    expect(mine.settings).toBe(settings); expect(mine.missions).toBe(missions);        // same objects: screens hold on to them
    // storage event: refresh() pulls the next write in; nothing new → false
    otherWrites(fs, o => { o.coins += 1; o.settings.sfx = 0.9; });
    expect(store.refresh(mine)).toBe(true); expect(mine.coins).toBe(9322); expect(settings.sfx).toBe(0.9);
    expect(store.refresh(mine)).toBe(false);
    expect(store.save(mine).ok).toBe(true); expect(fs.writes).toBe(writes + 1);         // (the other instance's write only)
  });
  it('two instances: a change made in a stale one is merged with the newer save, never written over it', () => {
    const fs = install(new FakeStorage())!;
    store.save(richSave());
    const mine = store.load().p; const rev = mine.rev;
    otherWrites(fs, o => { o.coins += 500; o.totals.runs += 1; o.totals.dist += 900; o.starMask['1-2'] = 3; o.stageBest['1-2'] = 7000; o.unlocked.push('bungeo'); o.hall.push({ ...o.hall[0], score: 99 }); });
    mine.coins -= 300; mine.seen.push('shop'); mine.settings.sfx = 0.1; mine.starMask[STAGES[0].id] = 7; mine.totals.runs += 1; mine.stageBest['1-2'] = 6000;
    const r = store.save(mine);
    expect(r.ok).toBe(true); expect(r.merged).toBe(true);
    const got = JSON.parse(fs.getItem(store.SAVE_KEY)!) as Progress;
    expect(got.coins).toBe(4321 + 500 - 300); expect(got.totals.runs).toBe(2); expect(got.totals.dist).toBe(900);
    expect(got.starMask).toMatchObject({ [STAGES[0].id]: 7, '1-2': 3 }); expect(got.stageBest['1-2']).toBe(7000);
    expect(got.unlocked).toContain('bungeo'); expect(got.seen).toContain('shop'); expect(got.settings.sfx).toBe(0.1);
    expect(got.hall.map(h => h.score)).toEqual(expect.arrayContaining([1, 99]));
    expect(got.rev).toBeGreaterThan(rev + 1); expect(got).toEqual(mine);
    expect(JSON.parse(fs.getItem(store.BAK_KEY)!).coins).toBe(4321 + 500);             // the other instance's save is the backup
  });
  it('mergeProgress: one-sided changes win; both-sided: counters add, records max, masks OR, sets unite, daily keeps its best try', () => {
    const b = richSave(); b.daily['2026-09-20'] = { best: 30000, dist: 1500, tries: 2, charId: 'bungeo', medal: 1, bestDist: 1500 };
    const l = clone(b), r = clone(b);
    l.coins += 10; r.coins += 20; l.totals.jellies += 5; r.totals.jellies += 7; l.totals.bestStreak = 30; r.totals.bestStreak = 20;
    l.daily['2026-09-20'] = { ...b.daily['2026-09-20'], best: 40000, bestDist: 1200, tries: 3, charId: 'hotteok' };
    r.daily['2026-09-20'] = { ...b.daily['2026-09-20'], dist: 2600, medal: 2, tries: 4 };
    l.rank = 8; l.xp = 0; r.rank = 7; r.xp = 3; l.loadout.main = CHARACTERS[1].id; r.missions = [];
    l.bestEndless = { score: 5, dist: 1, charId: 'hotteok', date: 1, assist: false, relay: false, scoreVersion: 1 };
    r.bestEndless = { ...l.bestEndless, score: 9 };
    const m = mergeProgress(b, l, r);
    expect(m.coins).toBe(b.coins + 30); expect(m.totals.jellies).toBe(b.totals.jellies + 12); expect(m.totals.bestStreak).toBe(30);
    expect(m.daily['2026-09-20']).toMatchObject({ best: 40000, bestDist: 1200, charId: 'hotteok', dist: 2600, medal: 2, tries: 5 });
    expect([m.rank, m.xp]).toEqual([8, 0]); expect(m.bestEndless!.score).toBe(9);
    expect(m.loadout.main).toBe(CHARACTERS[1].id); expect(m.missions.length).toBe(3);
    expect(mergeProgress(b, clone(b), r)).toEqual(normalize(clone(r)));                  // nothing changed here → the stored save
  });
  it('가져오기 (save with replace): the code replaces the stored save; ghosts that are not its own records go', () => {
    const fs = install(new FakeStorage())!;
    const cur = richSave(); cur.stageBest = { '1-1': 90000 }; cur.bestEndless = { score: 80000, dist: 3000, charId: 'hotteok', date: 1, assist: false, relay: false, scoreVersion: 1 };
    store.save(cur); store.load();
    for (const [k, sc] of [['stage:1-1', 90000], ['endless', 80000], ['daily:2026-09-20', 30000], ['stage:1-2', 5000]] as const) store.saveGhost(k, ghost(sc));
    const imported = normalize(clone(richSave())); imported.stageBest = { '1-1': 90000, '1-2': 4000 };   // an older backup
    expect(store.save(imported, { replace: true })).toEqual({ ok: true, merged: false });
    expect(JSON.parse(fs.getItem(store.SAVE_KEY)!)).toEqual(imported);
    expect(store.listGhosts().sort()).toEqual(['daily:2026-09-20', 'stage:1-1']);       // its own records' ghosts stay
    const reset = defaultProgress(); store.save(reset, { replace: true });
    expect(store.listGhosts()).toEqual([]);
  });
  it('backup code: export → import round-trips exactly (also from the .txt file and line-wrapped)', () => {
    install(new FakeStorage());
    const p = richSave();
    const code = store.exportString(p);
    expect(code.startsWith('JRUN1.')).toBe(true);
    expect(store.importString(code).p).toEqual(p);
    const txt = store.backupFileContent(p, new Date(2026, 8, 26, 9, 5));
    expect(txt).toContain('2026-09-26 09:05'); expect(txt).toContain(`계급 ${p.rank}`);
    expect(txt.trim().split('\n').pop()).toBe(code);
    expect(store.importString(txt).p).toEqual(p);
    const wrapped = code.slice(0, 40) + '\n' + code.slice(40, 90) + '\r\n  ' + code.slice(90);
    expect(store.importString(wrapped).p).toEqual(p);
    expect(store.importString('hello').p).toBeNull();
    expect(store.importString(code.slice(0, code.length - 30)).p).toBeNull();   // truncated copy is refused, not half-loaded
    expect(store.backupFileName(new Date(2026, 8, 26))).toBe('yasik-backup-20260926.txt');
  });
});

// ---------------------------------------------------------------- migration fixtures (GDD §13.5)
const FIX = join(__dirname, 'fixtures');
const fixtures = readdirSync(FIX).filter(f => /^save_v\d+\.json$/.test(f)).sort();

describe('save migration fixtures', () => {
  afterEach(() => { install(null); });

  it('there is a fixture for every past save version', () => {
    for (let v = 1; v <= SAVE_VERSION; v++) expect(fixtures, `save_v${v}.json`).toContain(`save_v${v}.json`);
  });
  for (const f of fixtures) {
    it(`${f} → v${SAVE_VERSION} with no reset branch`, () => {
      const raw = JSON.parse(readFileSync(join(FIX, f), 'utf8'));
      const p = normalize(clone(raw));
      expect(p.version).toBe(SAVE_VERSION);
      expect(p.coins).toBe(raw.coins); expect(p.rank).toBe(raw.rank); expect(p.xp).toBe(raw.xp);
      expect(p.missionsDone).toBe(raw.missionsDone); expect(p.missionCounter).toBe(raw.missionCounter);
      for (const id of raw.unlocked) expect(p.unlocked).toContain(id);
      for (const [k, v] of Object.entries(raw.totals as Record<string, number>)) expect(p.totals[k as keyof Progress['totals']], k).toBe(v);
      // the save round-trips through the backup code unchanged afterwards
      expect(store.importString(store.exportString(p)).p).toEqual(p);
    });
  }

  it('save_v1.json migrates with zero data loss (through storage.load, ghosts moved to their own keys)', () => {
    const v1 = JSON.parse(readFileSync(join(FIX, 'save_v1.json'), 'utf8'));
    const fs = install(new FakeStorage())!;
    fs.data.set(store.SAVE_KEY, JSON.stringify(v1));
    const { p, error } = store.load();
    expect(error).toBeNull();
    // currency, rank, missions
    expect(p.coins).toBe(1843); expect(p.rank).toBe(4); expect(p.xp).toBe(2); expect(p.missionsDone).toBe(14); expect(p.missionCounter).toBe(17);
    expect(p.missions).toEqual(v1.missions);
    // characters and loadout
    expect(p.unlocked).toEqual(['hotteok', 'bungeo']); expect(p.loadout.main).toBe('bungeo'); expect(p.loadout.partner).toBe('hotteok');
    // stars (count → mask), stage and endless bests, per-character bests
    expect(p.starMask).toEqual({ '1-1': 7, '1-2': 3, '1-3': 1, '1-4': 0 });
    expect(p.pouches).toEqual({ '1-1': 7 }); expect(p.loadout.companion).toBe(defaultProgress().loadout.companion);   // ★3 ⇔ 3 pouches; starter companion on
    expect(p.stageBest).toEqual(v1.stageBest); expect(p.bestByChar).toEqual(v1.bestByChar);
    expect(p.bestEndless).toMatchObject({ score: 48210, dist: 1874, charId: 'bungeo', date: 1758000000000, assist: false, scoreVersion: 0 });
    // daily records (+ days played), and every record also in the hall of fame
    for (const [k, d] of Object.entries(v1.daily as Record<string, { best: number; tries: number; charId: string }>)) expect(p.daily[k]).toMatchObject({ best: d.best, tries: d.tries, charId: d.charId });
    expect(p.daysPlayed).toBe(3);
    expect(p.hall.some(h => h.mode === 'endless' && h.score === 48210)).toBe(true);
    expect(p.hall.filter(h => h.mode === 'daily').length).toBe(3);
    // totals, play state, settings
    for (const [k, v] of Object.entries(v1.totals as Record<string, number>)) expect(p.totals[k as keyof Progress['totals']]).toBe(v);
    expect(p.tutorialDone).toBe(true);
    expect(p.seen).toEqual(['hint:jump', 'hint:slide', 'hint:pit']);
    const s = v1.settings;
    expect(p.settings).toMatchObject({ bgm: s.bgm, sfx: s.sfx, swapSides: s.swapSides, reduceMotion: s.reduceMotion, highContrast: s.highContrast, lowFx: s.lowFx, showHitbox: s.showHitbox, ghost: s.ghost, vibrate: s.vibrate, gameSpeed: s.gameSpeed, assistHalfDrain: true });
    // ghosts: out of the main save, into one key each, byte-identical records
    expect(JSON.stringify(p)).not.toContain('"ghosts"');
    for (const [k, g] of Object.entries(v1.ghosts as Record<string, object>)) expect(store.loadGhost(k)).toEqual({ ...g, companionId: null });
    expect(Object.keys(takeLegacyGhosts(v1)).sort()).toEqual(['daily:2026-09-21', 'stage:1-1']);
    // intentionally dropped: rerollDay (swaps are free now) — nothing else
    const kept = new Set(['version', 'settings', 'coins', 'unlocked', 'main', 'partner', 'stars', 'stageBest', 'bestEndless', 'bestByChar', 'daily', 'rank', 'xp', 'missions', 'missionCounter', 'missionsDone', 'totals', 'ghosts', 'tutorialDone', 'seenHints']);
    expect(Object.keys(v1).filter(k => !kept.has(k))).toEqual(['rerollDay']);
    // saving the migrated save and loading it again is stable
    store.save(p); expect(store.load().p).toEqual(p);
  });
  it('save_v2.json (pre-achievement v2) keeps everything and gains the new fields', () => {
    const v2 = JSON.parse(readFileSync(join(FIX, 'save_v2.json'), 'utf8'));
    const p = normalize(clone(v2));
    for (const k of ['coins', 'unlocked', 'companions', 'loadout', 'starMask', 'pouches', 'stageBest', 'bestEndless', 'bestByChar', 'daily', 'daysPlayed', 'lastDay', 'rank', 'xp', 'missions', 'missionCounter', 'missionsDone', 'achievements', 'hall', 'seen', 'tutorialDone', 'scoreVersion'])
      expect((p as unknown as Record<string, unknown>)[k], k).toEqual(v2[k]);
    expect(p.settings).toMatchObject(v2.settings);
    expect(p.totals).toMatchObject(v2.totals);
    expect(p.cosmetics).toEqual(v2.cosmetics);
    expect(p.bests).toEqual({}); expect(p.totals.coinsEarned).toBe(0);
  });
});

describe('daily', () => {
  it('same date → same seed and character; different dates differ', () => {
    const a = todayKey(new Date(2026, 8, 26)), b = todayKey(new Date(2026, 8, 27));
    expect(a).toBe('2026-09-26');
    expect(dailySeed(a)).toBe(dailySeed(a)); expect(dailySeed(a)).not.toBe(dailySeed(b));
    expect(dailyChar(a)).toBe(dailyChar(a));
  });
});
