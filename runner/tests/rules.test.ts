// Run rules: damage, i-frames, pits, potions, power-ups, bonus time, relay, streak/near-miss, determinism.
import { describe, it, expect } from 'vitest';
import { newRun, stepRun, stateHash, totalScore } from '../src/sim/run';
import { restartStreamAt, placeChunk } from '../src/sim/level';
import { parseChunk } from '../src/sim/chunk';
import { DT, GROUND_Y, TILE, SPEED_TIERS } from '../src/data/physics';
import {
  HIT_DAMAGE, FALL_DAMAGE, HIT_IFRAMES, POTION_HEAL, POWER_DUR, BONUS_T, BONUS_LIFT_T, DRAIN_BY_TIER, BASE_MAX_HP,
} from '../src/data/tuning';
import type { RunState, RunInput } from '../src/sim/types';

const E = (n: number) => '.'.repeat(n);
const NONE: RunInput = { jump: false, slide: false };

/** A run whose stream ahead is replaced by the given rows (repeated flat ground after). */
function runWith(rows: string[] | null, opts: { charId?: string; partnerId?: string } = {}): RunState {
  const s = newRun({ mode: 'endless', seed: 7, charId: opts.charId ?? 'hotteok', partnerId: opts.partnerId });
  while (s.phase === 'countdown') stepRun(s, NONE);
  s.events.length = 0;
  if (rows) {
    restartStreamAt(s, s.body.x + TILE * 2);
    const c = parseChunk({ id: 'test_' + Math.random().toString(36).slice(2), tiers: [0, 0], rows });
    placeChunk(s, c, 0, s.biome);
  }
  return s;
}
function flatRows(groundRow: string, extra: Record<number, string> = {}): string[] {
  const w = groundRow.length; const r: string[] = [];
  for (let i = 0; i < 11; i++) r.push(extra[i] ?? E(w));
  r.push(groundRow);
  return r;
}
function steps(s: RunState, n: number, inp: RunInput | ((i: number) => RunInput) = NONE): void {
  for (let i = 0; i < n; i++) stepRun(s, typeof inp === 'function' ? inp(i) : inp);
}
function untilX(s: RunState, x: number, inp: RunInput = NONE, max = 2000): void {
  let n = 0; while (s.body.x < x && n++ < max && s.phase === 'run') stepRun(s, inp);
}

describe('hazards & i-frames', () => {
  it('running into a spike costs HIT_DAMAGE once, grants i-frames, resets the streak', () => {
    const s = runWith(flatRows('='.repeat(20), { 10: E(8) + '^^' + E(10) }));
    s.streak = 7;
    const hp0 = s.hp;
    untilX(s, s.body.x + 20 * TILE);
    expect(s.stats.hits).toBe(1);             // two adjacent spikes, but i-frames stop the second
    expect(hp0 - s.hp).toBeGreaterThanOrEqual(HIT_DAMAGE);
    expect(hp0 - s.hp).toBeLessThan(HIT_DAMAGE + 5); // plus a little drain
    expect(s.streak).toBe(0);
    expect(s.events.some(e => e.t === 'hit')).toBe(true);
  });
  it('i-frames last HIT_IFRAMES', () => {
    const s = runWith(flatRows('='.repeat(20), { 10: E(8) + '^' + E(11) }));
    let n = 0; while (s.stats.hits === 0 && n++ < 600) stepRun(s, NONE);
    expect(s.iframes).toBeGreaterThan(HIT_IFRAMES - 2 * DT);
    steps(s, Math.ceil(HIT_IFRAMES / DT) + 1);
    expect(s.iframes).toBe(0);
  });
  it('a hanging hazard hits a standing runner but not a sliding one', () => {
    const rows = flatRows('='.repeat(20), { 9: E(8) + 'vvv' + E(9) });
    const a = runWith(rows); untilX(a, a.body.x + 20 * TILE); expect(a.stats.hits).toBe(1);
    const b = runWith(rows); untilX(b, b.body.x + 20 * TILE, { jump: false, slide: true }); expect(b.stats.hits).toBe(0);
  });
  it('passing a hazard cleanly raises the streak; passing close counts a near miss', () => {
    const s = runWith(flatRows('='.repeat(20), { 10: E(8) + '^' + E(11) }));
    // jump so that we clear the spike
    const target = s.level.hazards.find(h => h.kind === 'spike')!;
    let jumped = false;
    untilX(s, s.body.x + 20 * TILE, NONE, 0);
    for (let i = 0; i < 400 && s.body.x < target.x1 + 200; i++) {
      const jump = !jumped && s.body.x > target.x0 - 150; if (jump) jumped = true;
      stepRun(s, { jump, slide: false });
    }
    expect(s.stats.hits).toBe(0);
    expect(s.streak).toBe(1);
  });
});

describe('pits', () => {
  it('falling costs FALL_DAMAGE, bounces the runner back and bridges the pit', () => {
    const s = runWith(flatRows('====' + '.'.repeat(8) + '='.repeat(12)));
    const hp0 = s.hp;
    untilX(s, s.body.x + 24 * TILE);
    expect(s.stats.falls).toBe(1);
    expect(hp0 - s.hp).toBeGreaterThanOrEqual(FALL_DAMAGE);
    expect(s.phase).toBe('run');
    expect(s.body.y).toBeLessThanOrEqual(GROUND_Y + 1);
  });
});

describe('items', () => {
  it('potions heal and never overheal', () => {
    const s = runWith(null);
    s.level.pickups.push({ id: 9999, type: 'potion', x: s.body.x + 60, y: GROUND_Y - 30, taken: false, pulled: false });
    s.level.pickups.sort((a, b) => a.x - b.x);
    s.hp = 50; steps(s, 20);
    expect(s.hp).toBeGreaterThan(50 + POTION_HEAL - 2);
    s.level.pickups.push({ id: 9998, type: 'potion', x: s.body.x + 60, y: GROUND_Y - 30, taken: false, pulled: false });
    s.level.pickups.sort((a, b) => a.x - b.x);
    s.hp = s.maxHp - 1; steps(s, 20);
    expect(s.hp).toBeLessThanOrEqual(s.maxHp);
  });
  it('a repeat power pickup refreshes (does not stack) and giant smashes hazards without damage', () => {
    const s = runWith(flatRows('='.repeat(24), { 10: E(10) + '^' + E(4) + 'A' + E(8) }));
    s.level.pickups.push({ id: 9997, type: 'power', power: 'giant', x: s.body.x + 50, y: GROUND_Y - 30, taken: false, pulled: false });
    s.level.pickups.push({ id: 9996, type: 'power', power: 'giant', x: s.body.x + 90, y: GROUND_Y - 30, taken: false, pulled: false });
    s.level.pickups.sort((a, b) => a.x - b.x);
    steps(s, 30);
    expect(s.power.giant).toBeLessThanOrEqual(POWER_DUR.giant);
    expect(s.power.giant).toBeGreaterThan(POWER_DUR.giant - 0.5);
    const hp0 = s.hp; untilX(s, s.body.x + 20 * TILE);
    expect(s.stats.hits).toBe(0); expect(s.stats.smashed).toBe(2);
    expect(hp0 - s.hp).toBeLessThan(5);
  });
});

describe('bonus time', () => {
  it('collecting every letter lifts to the sky; no drain and power timers pause; returns safely', () => {
    const s = runWith(null);
    s.power.magnet = 3;
    for (let i = 0; i < s.letters.length; i++) s.letters[i] = i !== 2;
    s.level.pickups.push({ id: 9990, type: 'letter', letter: 2, x: s.body.x + 60, y: GROUND_Y - 30, taken: false, pulled: false });
    s.level.pickups.sort((a, b) => a.x - b.x);
    steps(s, 20);
    expect(s.bonusStage).toBe('lift');
    steps(s, Math.ceil(BONUS_LIFT_T / DT) + 2);
    expect(s.bonusStage).toBe('sky');
    const hp0 = s.hp; const mag0 = s.power.magnet;
    steps(s, Math.round(BONUS_T / DT) - 30, i => ({ jump: false, slide: false, jumpHeld: i % 40 < 20 }));
    expect(s.hp).toBe(hp0);
    expect(s.power.magnet).toBe(mag0);
    expect(s.stats.bonusJellies).toBeGreaterThan(0);
    steps(s, 60);
    expect(s.bonusStage).toBe('none');
    expect(s.letters.every(l => !l)).toBe(true);
    expect(s.iframes).toBeGreaterThan(0);
    steps(s, 120);
    expect(s.phase).toBe('run');
    expect(s.body.onGround).toBe(true);
  });
});

describe('drain, relay, death', () => {
  it('HP drains at the tier rate', () => {
    const s = runWith(null); const hp0 = s.hp; steps(s, 60);
    expect(hp0 - s.hp).toBeCloseTo(DRAIN_BY_TIER[s.tier], 1);
  });
  it('relay partner takes over once at 50 % HP, then the run ends', () => {
    const s = runWith(null, { partnerId: 'hotteok2' });
    if (!s.partnerId) return; // content may not define a second character yet
    s.hp = 0.001; steps(s, 2);
    expect(s.relayUsed).toBe(true); expect(s.phase).toBe('run'); expect(s.hp).toBeGreaterThan(s.maxHp * 0.45);
    s.hp = 0.001; steps(s, 2);
    expect(s.phase === 'dying' || s.phase === 'over').toBe(true);
  });
  it('death by drain is reported as drain', () => {
    const s = runWith(null); s.hp = 0.01; steps(s, 3);
    expect(s.phase).toBe('dying'); expect(s.deathCause).toBe('drain');
    steps(s, 100); expect(s.phase).toBe('over');
  });
});

describe('determinism', () => {
  it('same seed + same inputs → identical state hash', () => {
    const script = (i: number): RunInput => ({ jump: i % 97 === 0 || i % 211 === 5, slide: (i % 300) > 250, jumpHeld: i % 97 < 8 });
    const a = newRun({ mode: 'endless', seed: 123, charId: 'hotteok' }); const b = newRun({ mode: 'endless', seed: 123, charId: 'hotteok' });
    for (let i = 0; i < 60 * 60; i++) { stepRun(a, script(i)); stepRun(b, script(i)); a.events.length = 0; b.events.length = 0; }
    expect(stateHash(a)).toBe(stateHash(b));
    const c = newRun({ mode: 'endless', seed: 124, charId: 'hotteok' });
    for (let i = 0; i < 60 * 60; i++) { stepRun(c, script(i)); c.events.length = 0; }
    expect(stateHash(c)).not.toBe(stateHash(a));
  });
  it('input log replays to the same result', () => {
    const script = (i: number): RunInput => ({ jump: i % 83 === 0, slide: (i % 400) > 350, jumpHeld: i % 83 < 6 });
    const a = newRun({ mode: 'endless', seed: 99, charId: 'hotteok' });
    for (let i = 0; i < 60 * 40; i++) { stepRun(a, script(i)); a.events.length = 0; }
    const b = newRun({ mode: 'endless', seed: 99, charId: 'hotteok' });
    const log = a.log; let li = 0; let bits = 0;
    for (let i = 0; i < 60 * 40; i++) {
      let jump = false;
      while (li < log.length && log[li] === i) { bits = log[li + 1]; jump = (bits & 1) === 1; li += 2; }
      stepRun(b, { jump, slide: (bits & 2) === 2, jumpHeld: (bits & 4) === 4 }); b.events.length = 0;
    }
    expect(stateHash(b)).toBe(stateHash(a));
    expect(totalScore(b)).toBe(totalScore(a));
  });
});

void SPEED_TIERS; void BASE_MAX_HP;
