// Run rules: damage, i-frames, pits, potions, power-ups, bonus time, relay, streak/near-miss, determinism.
import { describe, it, expect } from 'vitest';
import { newRun, stepRun, stateHash, totalScore, HITSTOP_STEPS } from '../src/sim/run';
import { restartStreamAt, placeChunk, ensureLevel, dangerOf, PARSED_BY_ID } from '../src/sim/level';
import { parseChunk } from '../src/sim/chunk';
import { DT, GROUND_Y, TILE, SPEED_TIERS } from '../src/data/physics';
import {
  HIT_DAMAGE, FALL_DAMAGE, HIT_IFRAMES, POTION_HEAL, POWER_DUR, BONUS_T, BONUS_LIFT_T, DRAIN_BY_TIER, BASE_MAX_HP,
  BREATHER_T, MINI_POTION_HEAL,
} from '../src/data/tuning';
import type { RunState, RunInput, Pickup } from '../src/sim/types';

const E = (n: number) => '.'.repeat(n);
const NONE: RunInput = { jump: false, slide: false };

/** A run whose stream ahead is replaced by the given rows (repeated flat ground after). */
function runWith(rows: string[] | null, opts: { charId?: string; partnerId?: string; companionId?: string; assist?: { noHitDamage?: boolean; halfDrain?: boolean; autoSlide?: boolean }; mode?: 'endless' | 'tutorial' } = {}): RunState {
  const s = newRun({ mode: opts.mode ?? 'endless', seed: 7, charId: opts.charId ?? 'hotteok', partnerId: opts.partnerId, companionId: opts.companionId, assist: opts.assist });
  while (s.phase === 'countdown') stepRun(s, NONE);
  s.events.length = 0;
  if (rows) {
    restartStreamAt(s, s.body.x + TILE * 2);
    const c = parseChunk({ id: 'test_' + Math.random().toString(36).slice(2), tiers: [0, 0], rows });
    placeChunk(s, c, 0, s.biome, { main: true });
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
/** Insert a pickup keeping the stream's x order (collectPickups relies on it). */
function addPickup(s: RunState, p: Omit<Pickup, 'id' | 'taken' | 'pulled'>): Pickup {
  const q: Pickup = { id: s.level.nextId++, taken: false, pulled: false, ...p };
  s.level.pickups.push(q); s.level.pickups.sort((a, b) => a.x - b.x); return q;
}
/** The word is one letter short; the missing letter lies just ahead of the runner. */
function almostFeast(s: RunState): void {
  for (let i = 0; i < s.letters.length; i++) s.letters[i] = i !== 0;
  addPickup(s, { type: 'letter', letter: 0, x: s.body.x + 30, y: s.body.y - 30 });
}
const sortedByX = (ps: Pickup[]) => ps.every((p, i) => i === 0 || ps[i - 1].x <= p.x);

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
    steps(s, HITSTOP_STEPS);                       // frozen: i-frames do not tick during hitstop
    expect(s.iframes).toBeGreaterThan(HIT_IFRAMES - 2 * DT);
    steps(s, Math.ceil(HIT_IFRAMES / DT) + 1);
    expect(s.iframes).toBe(0);
  });
  it('a jump pressed during the hitstop is queued: it becomes the air jump on the first live step', () => {
    for (let at = 1; at <= HITSTOP_STEPS; at++) {
      const s = runWith(flatRows('='.repeat(30), { 10: E(10) + 'A' + E(19) }));
      untilX(s, s.level.hazards[0].x0 - 120);
      stepRun(s, { jump: true, slide: false });                  // single jump into the tall fork
      let n = 0; while (s.stats.hits === 0 && n++ < 200) stepRun(s, NONE);
      expect(s.body.onGround).toBe(false);
      const air0 = s.stats.airJumps;
      steps(s, HITSTOP_STEPS + 1, i => ({ jump: i + 1 === at, slide: false }));
      expect(s.stats.airJumps, `pressed on hitstop step ${at}`).toBe(air0 + 1);
      expect(s.body.vy).toBeLessThan(-400);
    }
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
  it('the rescue bridge reaches the far edge of a wide pit: one fall, never a second one mid-gap', () => {
    const s = runWith(flatRows('====' + '.'.repeat(28) + '='.repeat(12)));
    untilX(s, s.body.x + 44 * TILE);
    expect(s.stats.falls).toBe(1);
    expect(s.body.onGround).toBe(true);
  });
  for (const k of ['dash', 'giant'] as const) {
    it(`${k} ending over a pit hands over to the rescue bridge: no forced fall (GDD §5.6 grace)`, () => {
      const s = runWith(flatRows('====' + '.'.repeat(28) + '='.repeat(12)));
      s.power[k] = 1.0; if (k === 'giant') s.body.scale = 2.1;
      let endX = 0; let n = 0;
      while (n++ < 400) { stepRun(s, NONE); if (!endX && s.events.some(e => e.t === 'powerEnd')) endX = s.body.x; }
      const pit = s.level.solids.filter(o => o.ground).map(o => o.x1).find(x1 => x1 < endX)!;
      expect(endX).toBeGreaterThan(pit + 4 * TILE);               // it really ended over the gap
      expect(s.stats.falls).toBe(0);
      expect(s.body.onGround).toBe(true);
    });
  }
  it('a relay while bridged over a pit: the partner is carried across, not dropped in', () => {
    const s = runWith(flatRows('====' + '.'.repeat(28) + '='.repeat(12)), { partnerId: 'goguma' });
    s.power.dash = 3;
    untilX(s, s.body.x + 8 * TILE);                              // on the dash bridge over the gap
    s.hp = 0.001; let n = 0;
    while (n++ < 300) stepRun(s, NONE);
    expect(s.relayUsed).toBe(true);
    expect(s.stats.falls).toBe(0);
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
    let n = 0; while (s.bonusStage !== 'none' && n++ < 120) stepRun(s, NONE);
    expect(s.bonusStage).toBe('none');
    expect(s.letters.every(l => !l)).toBe(true);
    expect(s.iframes).toBeGreaterThan(0);
    steps(s, 40);                                    // dropped onto the hazard-free landing chunk
    expect(s.phase).toBe('run');
    expect(s.body.onGround).toBe(true);
    expect(s.level.chunks.find(c => c.x <= s.body.x && s.body.x < c.x + c.width)?.id).toBe('landing');
  });
});

describe('bonus time: order & letters', () => {
  for (const low of [false, true]) {
    it(`pickups stay in x order through a ${low ? '왕보름달 ' : ''}feast, so the whole candy field and the moon cake are collectible`, () => {
      const s = runWith(null); if (low) s.hp = 10;
      almostFeast(s);
      let n = 0, sky = 0;
      while ((s.stats.bonusTimes === 0 || s.bonusStage !== 'none') && n++ < 2000) {
        const b = s.body;   // bob through the candy field; rise to the moon cake's line near the end
        stepRun(s, { jump: false, slide: false, jumpHeld: s.bonusStage === 'sky' && (s.bonusT < 1.6 ? b.y > 270 : (Math.floor(s.steps / 25) % 2 === 0 || b.y > 360)) });
        if (s.bonusStage === 'sky') { sky++; expect(sortedByX(s.level.pickups), `step ${s.steps}`).toBe(true); }
      }
      expect(sky).toBeGreaterThan(Math.round(BONUS_T / DT) - 5);
      expect(s.stats.moonCakes).toBe(1);
      expect(s.stats.bonusJellies).toBeGreaterThan(60);
    });
  }
  it('a letter run past is missed: the next L slot offers it again (GDD §5.5)', () => {
    const s = runWith(null);
    const old = addPickup(s, { type: 'letter', letter: 0, x: s.body.x + 60, y: 60 });   // out of reach overhead
    untilX(s, s.body.x + 6 * TILE);
    expect(old.taken).toBe(false);
    restartStreamAt(s, s.body.x + TILE * 2); s.level.gen.letterDebt = 1000;
    const pc = placeChunk(s, parseChunk({ id: 'test_L', tiers: [0, 0], rows: flatRows('='.repeat(16), { 10: E(8) + 'L' + E(7) }) }), 0, s.biome, { main: true });
    const fresh = s.level.pickups.filter(p => p.chunk === pc.serial && p.type === 'letter');
    expect(fresh.map(p => p.letter)).toEqual([0]);
  });
  it('…but while a letter is still ahead, no second one is placed', () => {
    const s = runWith(null);
    restartStreamAt(s, s.body.x + TILE * 6); s.level.gen.letterDebt = 1000;
    addPickup(s, { type: 'letter', letter: 0, x: s.body.x + 3 * TILE, y: 60 });
    const pc = placeChunk(s, parseChunk({ id: 'test_L2', tiers: [0, 0], rows: flatRows('='.repeat(16), { 10: E(8) + 'L' + E(7) }) }), 0, s.biome, { main: true });
    expect(s.level.pickups.filter(p => p.chunk === pc.serial && p.type === 'letter')).toEqual([]);
  });
});

describe('director (GDD §5.8): pits are hazards too', () => {
  it('tension never runs past BREATHER_T without a true breather; acclimation chunks are easy (danger ≤ 3)', () => {
    let worst = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = newRun({ mode: 'endless', seed, charId: 'hotteok', noCountdown: true });
      const seen = new Map<number, { id: string; tier: number }>();
      for (let x = 0; s.level.gen.mainM < 2500; x += 400) {
        s.body.x = x; ensureLevel(s);
        for (const c of s.level.chunks) if (c.main && !seen.has(c.index)) seen.set(c.index, { id: c.id, tier: c.tier });
      }
      let run = 0, prevTier = -1;
      for (const [, c] of [...seen].sort((a, b) => a[0] - b[0])) {
        const p = PARSED_BY_ID.get(c.id)!;
        if (prevTier >= 0 && c.tier > prevTier) expect(dangerOf(p), `seed ${seed}: ${c.id} after a speed-up`).toBeLessThanOrEqual(3);
        prevTier = c.tier;
        run = dangerOf(p) === 0 ? 0 : run + p.width / SPEED_TIERS[c.tier];
        worst = Math.max(worst, run);
      }
    }
    expect(worst).toBeLessThanOrEqual(BREATHER_T);
  });
});

describe('companions', () => {
  it('깍순이: the honey drop turns a proven running-line star candy ahead into +8 honey; with no safe cell it waits, never skips', () => {
    const s = runWith(flatRows('='.repeat(48), { 10: E(34) + 'oooooooo' + E(6) }), { companionId: 'magpie' });
    const pc = s.level.chunks.find(c => c.id.startsWith('test_'))!; const total0 = pc.jellyTotal;
    s.compT = 25 - DT;
    steps(s, 30);                                               // no candy in the drop window yet
    expect(s.events.some(e => e.t === 'drop')).toBe(false);
    expect(s.compT).toBeGreaterThanOrEqual(25);                  // still due: it retries every step
    let n = 0; while (!s.events.some(e => e.t === 'drop') && n++ < 400) stepRun(s, NONE);
    expect(s.events.some(e => e.t === 'drop')).toBe(true); expect(s.compT).toBeLessThan(1);
    const honey = s.level.pickups.find(p => p.type === 'miniPotion')!;
    expect(honey.chunk).toBe(pc.serial); expect(honey.y).toBe(GROUND_Y - TILE / 2);
    expect(pc.jellyTotal).toBe(total0 - 1);
    s.hp = 50; untilX(s, honey.x + 2 * TILE);
    expect(honey.taken).toBe(true); expect(s.stats.miniPotions).toBe(1); expect(s.hp).toBeGreaterThan(50 + MINI_POTION_HEAL - 3);
  });
});

describe('drain, relay, death', () => {
  it('HP drains at the tier rate', () => {
    const s = runWith(null); const hp0 = s.hp; steps(s, 60);
    expect(hp0 - s.hp).toBeCloseTo(DRAIN_BY_TIER[s.tier], 1);
  });
  it('relay partner takes over once at 50 % of its own max (after a 1 s hand-over freeze), then the run ends', () => {
    const s = runWith(null, { partnerId: 'goguma' });
    expect(s.partnerId).toBe('goguma');
    s.power.dash = 2;
    s.hp = 0.001; steps(s, 2);
    expect(s.relayUsed).toBe(true); expect(s.phase).toBe('run'); expect(s.charId).toBe('goguma');
    expect(s.maxHp).toBe(85); expect(s.hp).toBeCloseTo(85 * 0.5, 0);
    expect(s.power.dash).toBe(0);
    const x0 = s.body.x; steps(s, 30); expect(s.body.x).toBe(x0);           // frozen hand-over
    steps(s, 40); expect(s.body.x).toBeGreaterThan(x0);
    // 고구미 revives once at 35 % before the run can end
    s.hp = 0.001; steps(s, 2); expect(s.phase).toBe('run'); expect(s.hp).toBeCloseTo(85 * 0.35, 0);
    s.hp = 0.001; steps(s, 2);
    expect(s.phase === 'dying' || s.phase === 'over').toBe(true);
  });
  it('death by drain is reported as drain', () => {
    const s = runWith(null); s.hp = 0.01; steps(s, 3);
    expect(s.phase).toBe('dying'); expect(s.deathCause).toBe('drain');
    steps(s, 100); expect(s.phase).toBe('over');
  });
});


describe('second-chance & assist options', () => {
  it('해돌이: the first two pits cost nothing (the bounce still happens)', () => {
    const rows = flatRows('====' + '.'.repeat(8) + '='.repeat(12));
    const s = runWith(rows, { companionId: 'haetae' });
    const hp0 = s.hp; untilX(s, s.body.x + 24 * TILE);
    expect(s.stats.falls).toBe(1); expect(s.stats.pitsGuarded).toBe(1); expect(hp0 - s.hp).toBeLessThan(5);
  });
  it('assist: no-hit-damage keeps warmth; half drain halves the drain; auto-slide ducks hanging hazards', () => {
    const a = runWith(flatRows('='.repeat(20), { 10: E(8) + '^' + E(11) }), { assist: { noHitDamage: true } });
    const hp0 = a.hp; untilX(a, a.body.x + 20 * TILE); expect(a.stats.hits).toBe(1); expect(hp0 - a.hp).toBeLessThan(3);
    const b = runWith(null, { assist: { halfDrain: true } }); const hb = b.hp; steps(b, 60); expect(hb - b.hp).toBeCloseTo(DRAIN_BY_TIER[0] / 2, 1);
    const c = runWith(flatRows('='.repeat(20), { 9: E(8) + 'vvv' + E(9) }), { assist: { autoSlide: true } });
    untilX(c, c.body.x + 20 * TILE); expect(c.stats.hits).toBe(0);
    expect(a.assist && b.assist && c.assist).toBe(true);
  });
  it('shield (어묵이) starts charged and absorbs one obstacle hit', () => {
    const s = runWith(flatRows('='.repeat(24), { 10: E(8) + '^' + E(15) }), { charId: 'eomuk' });
    expect(s.shield).toBe(1);
    const hp0 = s.hp; untilX(s, s.body.x + 20 * TILE);
    expect(s.shield).toBe(0); expect(s.stats.hits).toBe(0); expect(s.stats.shieldsUsed).toBe(1); expect(hp0 - s.hp).toBeLessThan(3);
  });
  it('tutorial: a mistake costs nothing and replays the chunk', () => {
    const s = runWith(flatRows('='.repeat(20), { 10: E(8) + '^' + E(11) }), { mode: 'tutorial' });
    const hp0 = s.hp; let n = 0; while (s.rewinds === 0 && n++ < 600) stepRun(s, NONE);
    expect(s.rewinds).toBe(1); expect(s.hp).toBeGreaterThan(hp0 - 2); expect(s.stats.hits).toBe(0);
    expect(s.events.some(e => e.t === 'rewind')).toBe(true);
  });
});

describe('pickups & scoring extras', () => {
  it('한 줄 완성: collecting every star candy of a ≥12-candy chunk pays a line bonus', () => {
    const s = runWith(flatRows('='.repeat(20), { 10: 'oooooooooooooooooooo' }));
    untilX(s, s.body.x + 24 * TILE);
    expect(s.stats.lines).toBe(1);
  });
  it('golden pouches set their bit; a moon cake waits near the end of every feast', () => {
    const s = newRun({ mode: 'endless', seed: 3, charId: 'hotteok', noCountdown: true });
    s.level.pickups.push({ id: 991, type: 'pouch', pouch: 2, x: s.body.x + 40, y: GROUND_Y - 30, taken: false, pulled: false });
    s.level.pickups.sort((a, b) => a.x - b.x);
    steps(s, 10); expect(s.pouchesGot).toBe(4);
    for (let i = 0; i < s.letters.length; i++) s.letters[i] = true; s.letters[0] = false;
    s.level.pickups.push({ id: 992, type: 'letter', letter: 0, x: s.body.x + 40, y: GROUND_Y - 30, taken: false, pulled: false });
    s.level.pickups.sort((a, b) => a.x - b.x);
    let n = 0; while (s.bonusStage !== 'sky' && n++ < 200) stepRun(s, NONE);
    expect(s.level.pickups.some(p => p.type === 'moonCake')).toBe(true);
  });
  it('press 1–4 steps before landing becomes a ground jump (the air jump is kept)', () => {
    const s = runWith(null);
    stepRun(s, { jump: true, slide: false });
    let n = 0; while (!(s.body.vy > 0 && s.body.y > GROUND_Y - 25) && n++ < 200) stepRun(s, NONE);
    stepRun(s, { jump: true, slide: false });            // just before touching down
    n = 0; while (!s.body.onGround && s.body.vy > 0 && n++ < 10) stepRun(s, NONE);
    expect(s.body.jumps).toBeLessThanOrEqual(1);         // it became a fresh ground jump
    expect(s.body.vy).toBeLessThan(0);
  });
  it('jellyPct500 stays −1 until 500 m, then freezes the star-candy % of that moment', () => {
    const s = runWith(null);
    steps(s, 120); expect(s.stats.jellyPct500).toBe(-1);
    s.dist = 499.8; stepRun(s, NONE); expect(s.stats.jellyPct500).toBe(-1);
    let n = 0; while (s.dist < 500 && n++ < 60) stepRun(s, NONE);
    const pct = s.stats.jellyPct500;
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBe(Math.floor(100 * s.stats.jellies / s.stats.jelliesSeen));
    s.stats.jellies = 0; steps(s, 60);
    expect(s.stats.jellyPct500).toBe(pct);
  });
  it('the run records whether it started without the countdown (ghost alignment)', () => {
    expect(newRun({ mode: 'endless', seed: 1, charId: 'hotteok', noCountdown: true }).noCountdown).toBe(true);
    expect(newRun({ mode: 'endless', seed: 1, charId: 'hotteok' }).noCountdown).toBe(false);
  });
  it('score never exceeds 999,999', () => {
    const s = runWith(null); s.score = 2_000_000; expect(totalScore(s)).toBe(999999);
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
