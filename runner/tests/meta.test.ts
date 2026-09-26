// Meta progression: rewards, missions, unlocks, saves. No energy/gacha/consumables anywhere.
import { describe, it, expect } from 'vitest';
import { newRun, stepRun } from '../src/sim/run';
import { defaultProgress, normalize, applyRun, unlockState, buyCharacter, autoUnlock, stageUnlocked, totalStars, reroll, dailySeed, dailyChar, todayKey } from '../src/meta/progress';
import { MISSIONS, drawMission, applyRunToMissions, RANK_XP } from '../src/meta/missions';
import { CHARACTERS } from '../src/data/characters';
import { STAGES } from '../src/data/stages';
import type { RunState } from '../src/sim/types';

function finished(mode: 'endless' | 'stage' | 'daily' = 'endless', patch: (s: RunState) => void = () => {}, stageId?: string): RunState {
  const s = newRun({ mode, seed: 5, charId: CHARACTERS[0].id, stageId });
  while (s.phase === 'countdown') stepRun(s, { jump: false, slide: false });
  for (let i = 0; i < 120; i++) stepRun(s, { jump: false, slide: false });
  patch(s); s.phase = 'over';
  return s;
}

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
    expect(CHARACTERS.some(c => c.id === p.main)).toBe(true);
  });
  it('endless run books coins from pickups + distance, updates best once', () => {
    const p = defaultProgress();
    const s = finished('endless', s => { s.stats.coins = 12; s.dist = 345; s.score = 1000; });
    const r = applyRun(p, s);
    expect(r.coinsFromPickups).toBe(12); expect(r.coinsFromDist).toBe(3);
    expect(p.coins).toBe(r.coins);
    expect(r.newBest).toBe(true); expect(p.bestEndless!.score).toBe(1000 + 345);
    const s2 = finished('endless', s => { s.dist = 10; s.score = 5; });
    expect(applyRun(p, s2).newBest).toBe(false);
  });
  it('trial runs never pay out or touch records', () => {
    const p = defaultProgress();
    const s = newRun({ mode: 'endless', seed: 1, charId: CHARACTERS[0].id, trial: true }); s.stats.coins = 50; s.dist = 900; s.phase = 'over';
    const r = applyRun(p, s);
    expect(r.coins).toBe(0); expect(p.coins).toBe(0); expect(p.bestEndless).toBeNull(); expect(p.totals.runs).toBe(0);
  });
  it('stage stars: 1 for finishing, +1 jelly goal, +1 HP goal; only improvements are kept', () => {
    if (!STAGES.length) return;
    const st = STAGES[0]; const p = defaultProgress();
    const s = finished('stage', s => { s.phase = 'clear'; s.stats.jellies = 100; s.stats.jelliesSeen = 100; s.hp = s.maxHp; }, st.id);
    s.phase = 'clear';
    const r = applyRun(p, s);
    expect(r.stars).toBe(3); expect(p.stars[st.id]).toBe(3);
    const s2 = finished('stage', s => { s.phase = 'clear'; s.stats.jellies = 0; s.stats.jelliesSeen = 100; s.hp = 1; }, st.id);
    s2.phase = 'clear';
    applyRun(p, s2); expect(p.stars[st.id]).toBe(3);
    const s3 = finished('stage', () => {}, st.id); // died → 0 stars
    expect(applyRun(defaultProgress(), s3).stars).toBe(0);
  });
  it('stage unlock chain: next stage needs ★1 on the previous; new worlds need a star total', () => {
    const p = defaultProgress();
    expect(stageUnlocked(p, STAGES[0].id)).toBe(true);
    if (STAGES.length > 1) {
      expect(stageUnlocked(p, STAGES[1].id)).toBe(false);
      p.stars[STAGES[0].id] = 1;
      if (STAGES[1].world === STAGES[0].world) expect(stageUnlocked(p, STAGES[1].id)).toBe(true);
    }
    expect(totalStars(p)).toBe(STAGES.length > 1 ? 1 : 0);
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
    const p = defaultProgress(); p.rank = 99; for (const st of STAGES) p.stars[st.id] = 3;
    autoUnlock(p);
    for (const c of CHARACTERS) if (c.unlock.kind !== 'coins') expect(p.unlocked).toContain(c.id);
  });
});

describe('missions', () => {
  it('templates have increasing targets and no "get hit / die" goals', () => {
    for (const m of MISSIONS) {
      expect(m.targets[0]).toBeLessThan(m.targets[1]); expect(m.targets[1]).toBeLessThan(m.targets[2]);
      expect(/부딪|죽|맞기|피격 \d+회 이상/.test(m.text(1))).toBe(false);
    }
  });
  it('drawn missions never duplicate an active one', () => {
    for (let c = 0; c < 60; c++) { const ex = [MISSIONS[c % MISSIONS.length].id, MISSIONS[(c + 3) % MISSIONS.length].id]; expect(ex).not.toContain(drawMission(ex, c % 7, c).id); }
  });
  it('run-scope keeps the best single run; total-scope accumulates; completion pays and refills', () => {
    const p = defaultProgress();
    p.missions = [{ id: 'jelly_run', level: 0, progress: 0, target: 150, runsWithout: 0 }, { id: 'coin_tot', level: 0, progress: 0, target: 60, runsWithout: 0 }, { id: 'near', level: 0, progress: 0, target: 3, runsWithout: 0 }];
    const s1 = finished('endless', s => { s.stats.jellies = 100; s.stats.coins = 40; });
    expect(applyRunToMissions(p.missions, s1)).toEqual([]);
    expect(p.missions[0].progress).toBe(100); expect(p.missions[1].progress).toBe(40);
    const s2 = finished('endless', s => { s.stats.jellies = 50; s.stats.coins = 30; });
    const r = applyRun(p, s2);
    expect(r.missionsDone.map(m => m.text)).toEqual([expect.stringContaining('코인')]);
    expect(p.missions.length).toBe(3);
    expect(p.missions.find(m => m.id === 'jelly_run')!.progress).toBe(100);
  });
  it('rank-ups pay coins; swapping a mission is always free', () => {
    const p = defaultProgress(); p.xp = RANK_XP(0) - 1;
    p.missions[0] = { id: 'jelly_run', level: 2, progress: 0, target: 1, runsWithout: 0 };
    const r = applyRun(p, finished('endless', s => { s.stats.jellies = 5; }));
    expect(r.rankUps).toBeGreaterThanOrEqual(1); expect(r.coinsFromRank).toBeGreaterThan(0);
    const before = p.missions[1].id; expect(reroll(p, 1)).toBe(true); expect(reroll(p, 1)).toBe(true);
    expect(p.missions.length).toBe(3); void before;
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
