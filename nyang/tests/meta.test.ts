import { describe, it, expect } from 'vitest';
import { levelOf, xpToNext, gameXp, bumpStreak, liveStreak, prevDay, titleOf } from '../src/meta/progress';
import { ensureMissions, applySignal, pickMissions, missionById, missionText, ALL_MISSIONS, ALL_DONE_BONUS } from '../src/meta/missions';
import { BOXES, HATS, rewardsAt, nextReward } from '../src/data/cosmetics';
import { CATS } from '../src/data/cats';

describe('levels', () => {
  it('turns total xp into a level and progress', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: xpToNext(1) });
    expect(levelOf(xpToNext(1))).toEqual({ level: 2, into: 0, need: xpToNext(2) });
    expect(levelOf(xpToNext(1) + 10).into).toBe(10);
    const toTen = Array.from({ length: 9 }, (_, i) => xpToNext(i + 1)).reduce((a, b) => a + b, 0);
    expect(levelOf(toTen).level).toBe(10);
  });

  it('a typical first game reaches level 2', () => {
    expect(levelOf(gameXp(25000, 3)).level).toBeGreaterThanOrEqual(2);
  });

  it('every unlockable has a unique level and early levels reward often', () => {
    const levels = [...BOXES, ...HATS].filter(x => x.level > 1).map(x => x.level);
    expect(new Set(levels).size).toBe(levels.length);
    for (let l = 2; l <= 10; l++) expect(rewardsAt(l).length).toBe(1);
    expect(nextReward(1)).toEqual({ level: 2, kind: 'box', id: 'gift' });
    expect(nextReward(99)).toBeNull();
  });

  it('titles grow with level', () => {
    expect(titleOf(1, 'ko')).toBe('초보 집사');
    expect(titleOf(12, 'en')).toBe('Skilled Butler');
  });
});

describe('daily streak', () => {
  it('counts consecutive days and resets after a gap', () => {
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    expect(prevDay('2026-01-01')).toBe('2025-12-31');
    let s = { count: 0, best: 0, last: '' };
    s = bumpStreak(s, '2026-09-24');
    s = bumpStreak(s, '2026-09-25');
    s = bumpStreak(s, '2026-09-25');
    expect(s.count).toBe(2);
    expect(liveStreak(s, '2026-09-26')).toBe(2);
    expect(liveStreak(s, '2026-09-27')).toBe(0);
    s = bumpStreak(s, '2026-09-28');
    expect(s).toEqual({ count: 1, best: 2, last: '2026-09-28' });
  });
});

describe('missions', () => {
  it('picks one easy, one medium, one hard mission per day, stable per date', () => {
    const a = pickMissions('2026-09-25');
    expect(a).toEqual(pickMissions('2026-09-25'));
    expect(a.map(id => id[0])).toEqual(['e', 'm', 'h']);
    const days = new Set<string>();
    for (let d = 1; d <= 28; d++) days.add(pickMissions(`2026-10-${String(d).padStart(2, '0')}`).join());
    expect(days.size).toBeGreaterThan(15);
  });

  it('resets when the date changes', () => {
    const s = ensureMissions(undefined, '2026-09-25');
    s.prog[0] = 3;
    expect(ensureMissions(s, '2026-09-25')).toBe(s);
    expect(ensureMissions(s, '2026-09-26').prog).toEqual([0, 0, 0]);
  });

  it('progress, completion xp and the all-done bonus', () => {
    const s = { date: 'x', ids: ['e-tier4', 'm-combo4', 'h-score'], prog: [0, 0, 0], done: [false, false, false], bonus: false };
    let xp = 0;
    for (let i = 0; i < 5; i++) xp += applySignal(s, { kind: 'merge', tier: 4 }).xp;
    expect(s.done[0]).toBe(false);
    xp += applySignal(s, { kind: 'merge', tier: 2 }).xp;
    expect(s.prog[0]).toBe(5);
    const r1 = applySignal(s, { kind: 'merge', tier: 9 });
    expect(r1.completed.map(m => m.id)).toEqual(['e-tier4']);
    xp += r1.xp;
    xp += applySignal(s, { kind: 'combo', combo: 3 }).xp;
    expect(s.prog[1]).toBe(3);
    xp += applySignal(s, { kind: 'combo', combo: 5 }).xp;
    xp += applySignal(s, { kind: 'score', score: 30000 }).xp;
    expect(s.done[2]).toBe(false);
    const last = applySignal(s, { kind: 'score', score: 70000 });
    expect(last.bonus).toBe(true);
    xp += last.xp;
    expect(xp).toBe(100 + 200 + 350 + ALL_DONE_BONUS);
    expect(applySignal(s, { kind: 'score', score: 99999 }).xp).toBe(0);
  });

  it('every mission has text in both languages', () => {
    const name = (i: number) => CATS[i].name;
    for (const m of ALL_MISSIONS) {
      expect(missionById(m.id)).toBe(m);
      expect(missionText(m, 'ko', name).length).toBeGreaterThan(3);
      expect(missionText(m, 'en', name).length).toBeGreaterThan(3);
    }
  });
});
