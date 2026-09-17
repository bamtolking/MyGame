// Stage 1: the core scene. "What I just did helps me on the next attempt."
import { describe, expect, it } from 'vitest';
import { createAttempt, stepAttempt } from '../src/sim/engine';
import { SCRIPT_A, SCRIPT_B, craftRecording, findEv, mapOf, runScript, syntheticMap } from './helpers';
import { makeBot, type BotScript } from '../src/sim/bot';
import { NO_INPUT } from '../src/sim/types';
import { TILE } from '../src/sim/constants';

const m1 = mapOf('m1');
describe('core comparison: same map, same current-player input, with and without the ghost', () => {
  const A = runScript(m1, SCRIPT_A);
  it('A: solo run destroys the generator but cannot bring the core home in 25 s', () => {
    expect(A.st.outcome?.kind).toBe('timeout');
    expect(findEv(A, 'generatorDestroyed').length).toBe(1);
    expect(A.st.lasers[0].phase).toBe('off');
    expect(findEv(A, 'escape').length).toBe(0);
  });
  const soloB = runScript(m1, SCRIPT_B, []);
  it('B without the ghost: the laser never turns off and the player is stuck', () => {
    expect(soloB.st.outcome?.kind).toBe('timeout');
    expect(soloB.st.lasers[0].phase).toBe('on');
    expect(soloB.st.player.hasCore).toBe(false);
    expect(soloB.st.vault.corePresent).toBe(true);
  });
  const B = runScript(m1, SCRIPT_B, [A.rec]);
  it('B with ghost A: the ghost really destroys the generator, the laser turns off, the player escapes', () => {
    expect(B.st.outcome?.kind).toBe('escape');
    const gd = findEv(B, 'generatorDestroyed'); expect(gd.length).toBe(1); expect(gd[0].ev.by).toBe('ghost0');
    expect(findEv(B, 'laserChanged')[0].ev.phase).toBe('off');
    expect(B.st.stats.ghost0.generators).toBe(1);
    expect(B.st.stats.ghost0.kills).toBe(1); // the guard next to the generator
    expect(B.st.outcome!.tick).toBeLessThan(25 * 60);
  });
  it('ghost destroys the generator at the same time as in the original run', () => {
    expect(findEv(B, 'generatorDestroyed')[0].tick).toBe(findEv(A, 'generatorDestroyed')[0].tick);
  });
  it('only the current player\'s actions are recorded (ghost shots are never re-recorded)', () => {
    const own = findEv(B, 'shot').filter((e) => e.ev.owner === 'player').length;
    expect(B.rec.shots.length).toBe(own);
    expect(findEv(B, 'shot').filter((e) => e.ev.owner === 'ghost').length).toBe(A.rec.shots.length);
    expect(B.rec.shots.length).toBe(0);
  });
  it('shots do not grow exponentially across generations', () => {
    const C = runScript(m1, SCRIPT_A, [A.rec, B.rec]);
    expect(C.rec.shots.length).toBeLessThanOrEqual(A.rec.shots.length + 2);
    const D = runScript(m1, SCRIPT_B, [A.rec, B.rec, C.rec]);
    const ghostShots = findEv(D, 'shot').filter((e) => e.ev.owner === 'ghost').length;
    expect(ghostShots).toBe(A.rec.shots.length + B.rec.shots.length + C.rec.shots.length);
    expect(D.rec.shots.length).toBe(0);
  });
  it('recording covers exactly one frame per simulated tick', () => {
    expect(A.rec.pos.length).toBe(A.st.tick * 2); expect(A.rec.face.length).toBe(A.st.tick); expect(A.rec.endTick).toBe(A.st.tick);
  });
});

describe('determinism', () => {
  it('same inputs give identical results regardless of how ticks are batched', () => {
    const A = runScript(m1, SCRIPT_A);
    const inputs: import('../src/sim/types').PlayerInput[] = [];
    // capture B's inputs tick by tick
    const bot = makeBot(m1, SCRIPT_B); const s1 = createAttempt(m1, { weapon: 'rifle', ghosts: [A.rec] });
    while (!s1.outcome) { const inp = bot.input(s1); inputs.push({ ...inp }); stepAttempt(s1, inp); }
    // replay the captured inputs in batches of 7 (like a slow frame) and 1 (fast frame): must match exactly
    const s2 = createAttempt(m1, { weapon: 'rifle', ghosts: [A.rec] });
    let i = 0; while (!s2.outcome && i < inputs.length) { const n = (i % 2 === 0) ? 7 : 1; for (let k = 0; k < n && i < inputs.length && !s2.outcome; k++) stepAttempt(s2, inputs[i++]); }
    expect(s2.outcome).toEqual(s1.outcome);
    expect(s2.recording.pos).toEqual(s1.recording.pos);
    expect(s2.enemies.map((e) => [e.alive, Math.round(e.x), Math.round(e.y)])).toEqual(s1.enemies.map((e) => [e.alive, Math.round(e.x), Math.round(e.y)]));
  });
});

describe('ghost projectiles are real, but only hits count', () => {
  it('a ghost bullet is stopped by a wall and does not hurt the enemy behind it', () => {
    // wall column at x tiles 5, rows 4..6. Ghost at (2,5) shoots right toward an enemy at (8,5) behind the wall.
    const map = syntheticMap({ enemies: [{ kind: 'chaser', at: [8, 5] }] });
    const gx = 2.5 * TILE, gy = 5.5 * TILE;
    const rec = craftRecording(map, 'rifle', gx, gy, 200, [{ t: 5, x: gx, y: gy, w: 'rifle', a: [0, 0.01, -0.01] }]);
    const st = createAttempt(map, { weapon: 'rifle', ghosts: [rec] });
    const hits: string[] = [];
    for (let i = 0; i < 120; i++) { stepAttempt(st, NO_INPUT); for (const e of st.events) if (e.kind === 'hit') hits.push(e.target); }
    expect(hits).toContain('wall'); expect(hits).not.toContain('enemy');
    expect(st.enemies[0].hp).toBe(st.enemies[0].maxHp);
  });
  it('a recorded shot misses if the enemy is somewhere else this time; the ghost never re-aims', () => {
    const gx = 2.5 * TILE, gy = 2.5 * TILE; const ex = 8.5 * TILE, ey = 2.5 * TILE;
    const mapThen = syntheticMap({ spawn: [1, 9], enemies: [{ kind: 'chaser', at: [8, 2] }] });
    const rec = craftRecording(mapThen, 'rifle', gx, gy, 200, [{ t: 5, x: gx, y: gy, w: 'rifle', a: [Math.atan2(ey - gy, ex - gx)] }]);
    const s1 = createAttempt(mapThen, { weapon: 'rifle', ghosts: [rec] });
    for (let i = 0; i < 60; i++) stepAttempt(s1, NO_INPUT);
    expect(s1.enemies[0].hp).toBeLessThan(s1.enemies[0].maxHp); // hits when the enemy is where it was
    const mapNow = syntheticMap({ spawn: [1, 9], enemies: [{ kind: 'chaser', at: [8, 5] }] }); // same map id/version, enemy elsewhere
    const s2 = createAttempt(mapNow, { weapon: 'rifle', ghosts: [rec] });
    for (let i = 0; i < 60; i++) stepAttempt(s2, NO_INPUT);
    expect(s2.enemies[0].hp).toBe(s2.enemies[0].maxHp);
  });
  it('an enemy that is already dead takes no further damage and gives no second kill', () => {
    const gx = 2.5 * TILE, gy = 2.5 * TILE; const ex = 4.5 * TILE, ey = 2.5 * TILE;
    const map = syntheticMap({ enemies: [{ kind: 'chaser', at: [4, 2] }] });
    const ang = Math.atan2(ey - gy, ex - gx);
    // one shotgun blast (6 pellets, 5 dmg each = 30 = exactly the chaser's hp) and a second blast 3 ticks later
    const rec = craftRecording(map, 'shotgun', gx, gy, 200, [{ t: 3, x: gx, y: gy, w: 'shotgun', a: [ang, ang, ang, ang, ang, ang] }, { t: 6, x: gx, y: gy, w: 'shotgun', a: [ang, ang, ang, ang, ang, ang] }]);
    const st = createAttempt(map, { weapon: 'rifle', ghosts: [rec] });
    let died = 0; for (let i = 0; i < 60; i++) { stepAttempt(st, NO_INPUT); died += st.events.filter((e) => e.kind === 'enemyDied').length; }
    expect(died).toBe(1); expect(st.stats.ghost0.kills).toBe(1); expect(st.enemies[0].hp).toBe(0);
    expect(st.stats.ghost0.damage).toBe(30);
  });
});

describe('ghosts are time projections', () => {
  it('a ghost never picks up the core or escapes, even when replaying a successful run', () => {
    const A = runScript(m1, SCRIPT_A); const B = runScript(m1, SCRIPT_B, [A.rec]);
    expect(B.rec.endKind).toBe('escape');
    // Replay both ghosts while the current player stands still: nobody takes the core.
    const st = createAttempt(m1, { weapon: 'rifle', ghosts: [A.rec, B.rec] });
    while (!st.outcome) stepAttempt(st, NO_INPUT);
    expect(st.outcome?.kind).toBe('timeout'); expect(st.vault.corePresent).toBe(true); expect(st.player.hasCore).toBe(false);
    expect(st.lasers[0].phase).toBe('off'); // ghost A still did its job
  });
  it('lasers and enemies never damage or push ghosts; ghost positions follow the recording exactly', () => {
    const A = runScript(m1, SCRIPT_A);
    const st = createAttempt(m1, { weapon: 'rifle', ghosts: [A.rec] });
    for (let t = 1; t <= 600; t++) { stepAttempt(st, NO_INPUT); const g = st.ghosts[0]; expect(g.x).toBeCloseTo(A.rec.pos[(t - 1) * 2] / 10, 5); expect(g.y).toBeCloseTo(A.rec.pos[(t - 1) * 2 + 1] / 10, 5); }
  });
  it('end kinds: finish holds the last position, death vanishes, timeout plays the full 25 s then vanishes', () => {
    const A = runScript(m1, SCRIPT_A);
    const cut = (endKind: 'finish' | 'death' | 'timeout', ticks: number) => ({ ...A.rec, endKind, endTick: ticks, pos: A.rec.pos.slice(0, ticks * 2), face: A.rec.face.slice(0, ticks), shots: A.rec.shots.filter((s) => s.t <= ticks), dashes: A.rec.dashes.filter((d) => d <= ticks) });
    const fin = cut('finish', 700), dead = cut('death', 700), tout = A.rec;
    const st = createAttempt(m1, { weapon: 'rifle', ghosts: [fin, dead, tout] });
    const gone: number[] = []; const hold: number[] = [];
    while (!st.outcome) { stepAttempt(st, NO_INPUT); for (const e of st.events) { if (e.kind === 'ghostGone') gone.push(e.ghost); if (e.kind === 'ghostHold') hold.push(e.ghost); } if (st.tick === 1000) { expect(st.ghosts[0].present).toBe(true); expect(st.ghosts[0].x).toBeCloseTo(A.rec.pos[699 * 2] / 10); expect(st.ghosts[1].present).toBe(false); expect(st.ghosts[2].present).toBe(true); } }
    expect(hold).toEqual([0]); expect(gone).toContain(1); expect(gone).not.toContain(0);
    expect(st.ghosts[2].present).toBe(true); // timeout ghost is present through the final tick
  });
  it('a finished ghost fires no new shots after its end tick', () => {
    const A = runScript(m1, SCRIPT_A);
    const fin = { ...A.rec, endKind: 'finish' as const, endTick: 300, pos: A.rec.pos.slice(0, 600), face: A.rec.face.slice(0, 300), shots: A.rec.shots, dashes: [] };
    const st = createAttempt(m1, { weapon: 'rifle', ghosts: [fin] });
    let late = 0; while (!st.outcome) { stepAttempt(st, NO_INPUT); if (st.tick > 300) late += st.events.filter((e) => e.kind === 'shot' && e.owner === 'ghost').length; }
    expect(late).toBe(0);
  });
});

describe('attempt reset', () => {
  it('a new attempt starts from the identical initial state (enemies, generator, laser, time)', () => {
    const A = runScript(m1, SCRIPT_A);
    expect(A.st.generators[0].alive).toBe(false);
    const fresh = createAttempt(m1, { weapon: 'rifle', ghosts: [A.rec] });
    expect(fresh.tick).toBe(0); expect(fresh.generators[0].hp).toBe(fresh.generators[0].maxHp); expect(fresh.lasers[0].phase).toBe('on');
    expect(fresh.enemies.every((e) => e.alive && e.hp === e.maxHp)).toBe(true); expect(fresh.vault.corePresent).toBe(true); expect(fresh.player.hp).toBe(6);
  });
  it('after taking the core, the player can still escape after the helping ghost is gone', () => {
    const A = runScript(m1, SCRIPT_A);
    const dead = { ...A.rec, endKind: 'death' as const, endTick: 620, pos: A.rec.pos.slice(0, 1240), face: A.rec.face.slice(0, 620), shots: A.rec.shots.filter((s) => s.t <= 620), dashes: [] };
    const B = runScript(m1, SCRIPT_B, [dead]);
    expect(findEv(B, 'ghostGone').length).toBe(1);
    expect(findEv(B, 'corePicked')[0].tick).toBeGreaterThan(620);
    expect(B.st.outcome?.kind).toBe('escape');
  });
});
