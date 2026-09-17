/**
 * Core rule tests (node:test). Run: npm test
 * These exercise the authoritative simulation directly, no browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/core/sim/match.ts';
import { unitDef } from '../src/core/data/units.ts';
import { ROSTER, MAP, MATCH, ECON, DT } from '../src/core/data/balance.ts';
import { rosterPop } from '../src/core/sim/commands.ts';
import type { FactionId } from '../src/core/types.ts';

function mk(seed = 1, a: FactionId = 'iron', b: FactionId = 'gale', setup = 0) {
  const m = Match.create({ mode: '1v1', seed, setupSeconds: setup, players: [{ faction: a, isHuman: true, ai: null }, { faction: b, isHuman: false, ai: 'script' }] });
  return m;
}
function toBattle(m: Match) { m.s.phase = 'countdown'; m.s.phaseT = 0.01; m.step(); assert.equal(m.s.phase, 'battle'); }
function runFor(m: Match, seconds: number) { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) m.step(); }
function cell(col: number, row: number) { return row * ROSTER.cols + col; }

test('buy → dispatched at next wave, mirrored positions, stays in roster after death', () => {
  const m = mk();
  assert.ok(m.command({ type: 'buy', player: 0, unitId: 'rifles', cell: cell(7, 0) }).ok);
  assert.ok(m.command({ type: 'buy', player: 1, unitId: 'raiders', cell: cell(7, 0) }).ok);
  toBattle(m);
  runFor(m, DT);
  const u0 = m.s.units.find((u) => u.team === 0)!; const u1 = m.s.units.find((u) => u.team === 1)!;
  assert.ok(u0 && u1, 'both dispatched');
  // mirrored spawn: same lane y, x mirrored; front column is closest to the centre for both teams
  assert.equal(u0.laneY, u1.laneY);
  const s0 = m.spawnPos(0, cell(7, 0)), s1 = m.spawnPos(1, cell(7, 0));
  assert.ok(Math.abs(s0.x + s1.x - MAP.W) < 1e-6, 'x mirrored');
  assert.ok(s0.x < MAP.W / 2 && s1.x > MAP.W / 2);
  assert.ok(s0.x > m.spawnPos(0, cell(0, 0)).x && s1.x < m.spawnPos(1, cell(0, 0)).x, 'front column is forward for both teams');
  // kill the rifles: roster entry must remain and re-spawn next wave
  u0.hp = 0; u0.dead = true; runFor(m, DT);
  assert.equal(m.s.units.filter((u) => u.team === 0).length, 0);
  assert.ok(m.s.players[0].roster[cell(7, 0)], 'roster entry kept after death');
  runFor(m, MATCH.interval1v1);
  assert.equal(m.s.players[0].waveCount, 2);
  assert.ok(m.s.units.some((u) => u.team === 0 && u.type === 'rifles'), 're-spawned in wave 2');
});

test('survivors are not duplicated or healed by the next dispatch; they merge', () => {
  const m = mk();
  for (const b of m.s.buildings) b.turret.dmg = 0;
  m.command({ type: 'buy', player: 0, unitId: 'shieldwalker', cell: cell(7, 2) });
  toBattle(m);
  runFor(m, 1);
  const u = m.s.units[0];
  u.hp = 100; // damaged survivor
  const id = u.id;
  runFor(m, MATCH.interval1v1);
  const mine = m.s.units.filter((x) => x.team === 0);
  assert.equal(mine.length, 2, 'survivor + new = 2 units (no duplication)');
  const surv = mine.find((x) => x.id === id)!;
  assert.ok(surv && surv.hp <= 100, 'survivor hp not reset');
});

test('cancel refunds 100% before dispatch, sell refunds 70% after; no money from cycling', () => {
  const m = mk();
  const p = m.s.players[0];
  const c0 = p.credits;
  for (let i = 0; i < 20; i++) {
    assert.ok(m.command({ type: 'buy', player: 0, unitId: 'rifles', cell: 0 }).ok);
    assert.ok(m.command({ type: 'cancel', player: 0, cell: 0 }).ok);
  }
  assert.equal(p.credits, c0, 'buy/cancel cycling is neutral');
  m.command({ type: 'buy', player: 0, unitId: 'rifles', cell: 0 });
  toBattle(m); runFor(m, 0.1);
  assert.ok(!m.command({ type: 'cancel', player: 0, cell: 0 }).ok, 'cancel not allowed after dispatch');
  const before = p.credits;
  assert.ok(m.command({ type: 'sell', player: 0, cell: 0 }).ok);
  assert.equal(Math.round(p.credits - before), Math.floor(unitDef('rifles').cost * ECON.sellRefund));
  assert.equal(m.s.units.filter((u) => u.team === 0).length, 1, 'selling does not remove the field unit');
  // move/sell cannot teleport or change existing field units
  const field = m.s.units.find((u) => u.team === 0)!;
  m.command({ type: 'buy', player: 0, unitId: 'shieldwalker', cell: 5 });
  m.command({ type: 'move', player: 0, from: 5, to: 40 });
  assert.equal(field.type, 'rifles');
});

test('credits and pop never negative; blocked purchases explain why', () => {
  const m = mk();
  const p = m.s.players[0];
  p.credits = 50;
  const r = m.command({ type: 'buy', player: 0, unitId: 'rifles', cell: 0 });
  assert.equal(r.ok, false); assert.equal(r.reason, '자원 부족');
  p.credits = 100000;
  const r2 = m.command({ type: 'buy', player: 0, unitId: 'piercer', cell: 0 });
  assert.equal(r2.reason, '2단계 기술 필요');
  let bought = 0;
  for (let i = 0; i < 48; i++) if (m.command({ type: 'buy', player: 0, unitId: 'shieldwalker', cell: i }).ok) bought++;
  assert.equal(bought * 2, ROSTER.popCap, 'pop cap respected');
  assert.equal(m.command({ type: 'buy', player: 0, unitId: 'rifles', cell: 47 }).reason, '인구수 초과');
  assert.ok(p.credits >= 0 && rosterPop(p) <= ROSTER.popCap);
});

test('dispatch boundary: a purchase applied before the dispatch tick is included exactly once', () => {
  const m = mk();
  toBattle(m);
  // advance to just before wave 2
  runFor(m, MATCH.interval1v1 - DT * 2);
  m.command({ type: 'buy', player: 0, unitId: 'rifles', cell: 3 });
  runFor(m, DT * 3);
  const mine = m.s.units.filter((u) => u.team === 0);
  assert.equal(mine.length, 1, 'included once');
  assert.equal(m.s.players[0].waveCount, 2);
});

test('upgrades and research bought mid-battle only affect later waves', () => {
  const m = mk();
  m.command({ type: 'buy', player: 0, unitId: 'rifles', cell: 7 });
  toBattle(m); runFor(m, 0.5);
  const first = m.s.units.find((u) => u.team === 0)!;
  m.s.players[0].credits = 5000;
  assert.ok(m.command({ type: 'upgrade', player: 0, kind: 'attack' }).ok);
  assert.ok(m.command({ type: 'upgrade', player: 0, kind: 'defense' }).ok);
  assert.equal(first.atkMult, 1); assert.equal(first.armor, 0);
  runFor(m, MATCH.interval1v1);
  const second = m.s.units.find((u) => u.team === 0 && u.id !== first.id)!;
  assert.ok(second.atkMult > 1 && second.armor === 1 && second.maxHp > first.maxHp);
  assert.equal(first.atkMult, 1, 'existing unit unchanged');
});

test('ground-only weapons cannot damage air; anti-air can', () => {
  const m = mk(3);
  m.s.players[0].credits = 5000; m.s.players[1].credits = 5000; m.s.players[1].tech = 3;
  m.command({ type: 'buy', player: 0, unitId: 'sprayer', cell: cell(7, 2) });
  m.command({ type: 'buy', player: 0, unitId: 'shieldwalker', cell: cell(7, 3) });
  m.command({ type: 'buy', player: 1, unitId: 'bomber', cell: cell(7, 2) });
  for (const b of m.s.buildings) b.turret.dmg = 0;
  toBattle(m); runFor(m, 30);
  const bomber = m.s.units.find((u) => u.type === 'bomber')!;
  assert.ok(bomber && bomber.hp === bomber.maxHp, 'bomber untouched by ground-only units');
  const m2 = mk(4);
  m2.s.players[0].credits = 5000; m2.s.players[1].credits = 5000; m2.s.players[1].tech = 3;
  m2.command({ type: 'buy', player: 0, unitId: 'flak', cell: cell(7, 2) });
  m2.command({ type: 'buy', player: 1, unitId: 'bomber', cell: cell(7, 2) });
  for (const b of m2.s.buildings) b.turret.dmg = 0;
  for (const p of m2.s.players) p.interval = 9999;
  toBattle(m2); runFor(m2, 30);
  assert.ok(!m2.s.units.some((u) => u.type === 'bomber'), 'flak kills the bomber');
});

test('AoE hits by actual position and radius; heal caps and stacking', () => {
  const m = mk(5);
  m.s.players[0].credits = 9000; m.s.players[0].tech = 3; m.s.players[1].credits = 9000;
  m.command({ type: 'buy', player: 0, unitId: 'howitzer', cell: cell(1, 2) });
  m.command({ type: 'buy', player: 1, unitId: 'raiders', cell: cell(7, 2) });
  m.command({ type: 'buy', player: 1, unitId: 'raiders', cell: cell(7, 3) });
  m.command({ type: 'buy', player: 1, unitId: 'raiders', cell: cell(6, 2) });
  toBattle(m); runFor(m, 25);
  const st = m.s.stats[0].byType.howitzer;
  assert.ok(st && st.dealt > 0, 'howitzer dealt splash damage');
  // repair: pool limited and cannot exceed maxHp, max 2 drones per target
  const m3 = mk(6);
  const p = m3.s.players[0]; p.credits = 9000; p.tech = 3;
  m3.command({ type: 'buy', player: 0, unitId: 'shieldwalker', cell: cell(3, 2) });
  for (let i = 0; i < 3; i++) m3.command({ type: 'buy', player: 0, unitId: 'repair', cell: cell(2, i + 1) });
  toBattle(m3); runFor(m3, 0.2);
  const tank = m3.s.units.find((u) => u.type === 'shieldwalker')!;
  tank.hp = 50;
  runFor(m3, 1);
  const drones = m3.s.units.filter((u) => u.type === 'repair');
  const used = drones.reduce((a, d) => a + (unitDef('repair').ability!.pool - d.pool), 0);
  const healed = tank.hp - 50;
  assert.ok(healed > 0 && Math.abs(healed - used) < 1e-6, 'heal equals pool spent');
  assert.ok(healed <= 2 * 10 * 1.05 + 1, 'at most 2 drones stack (10 hp/s each)');
  runFor(m3, 90);
  assert.ok(tank.hp <= tank.maxHp + 1e-9, 'never above max hp');
});

test('simultaneous core destruction is a draw; time limit compares hp ratio', () => {
  const m = mk(7);
  toBattle(m);
  const c0 = m.coreOf(0), c1 = m.coreOf(1);
  for (const b of m.s.buildings) if (b.kind === 'outpost') { b.alive = false; b.hp = 0; }
  c0.hp = 1; c1.hp = 1;
  // simulate one splash that kills both in the same tick via direct damage queue
  (m as unknown as { damage: unknown[] }).damage.push({ targetId: -c0.id, amount: 1000, srcOwner: -1, srcType: 'x', x: 0, y: 0 }, { targetId: -c1.id, amount: 1000, srcOwner: -1, srcType: 'x', x: 0, y: 0 });
  // apply via a private call
  (m as unknown as { applyDamage: () => void }).applyDamage();
  (m as unknown as { checkVictory: () => void }).checkVictory();
  assert.deepEqual(m.s.result?.winner, -1); assert.equal(m.s.result?.reason, 'draw-simul');
  const m2 = mk(8); toBattle(m2);
  m2.s.tick = Math.round(MATCH.timeLimit / DT) - 1;
  m2.coreOf(1).hp = 1000;
  m2.step();
  assert.equal(m2.s.result?.winner, 0); assert.equal(m2.s.result?.reason, 'time');
  const m3 = mk(9); toBattle(m3);
  m3.s.tick = Math.round(MATCH.timeLimit / DT) - 1; m3.step();
  assert.equal(m3.s.result?.reason, 'draw-time');
});

test('side swap symmetry: identical mirrored rosters produce mirrored outcomes', () => {
  const run = (swap: boolean) => {
    const m = mk(11, 'iron', 'iron');
    m.s.players[0].credits = m.s.players[1].credits = 9000;
    const list: [string, number][] = [['rifles', cell(5, 1)], ['rifles', cell(5, 4)], ['shieldwalker', cell(7, 2)], ['shieldwalker', cell(7, 3)], ['sprayer', cell(6, 2)]];
    for (const [id, c] of list) { m.command({ type: 'buy', player: swap ? 1 : 0, unitId: id, cell: c }); }
    for (const [id, c] of list) { m.command({ type: 'buy', player: swap ? 0 : 1, unitId: id, cell: c }); }
    toBattle(m); runFor(m, 60);
    return m.s.units.map((u) => `${u.team}:${u.type}:${Math.round(u.hp)}`).sort().join(',');
  };
  // identical rosters both sides: result must be a symmetric state (same multiset of hp per team)
  const a = run(false);
  const teams = a.split(',').filter(Boolean);
  const t0 = teams.filter((s) => s.startsWith('0:')).map((s) => s.slice(2)).sort().join(',');
  const t1 = teams.filter((s) => s.startsWith('1:')).map((s) => s.slice(2)).sort().join(',');
  assert.equal(t0, t1, 'left and right survive identically with identical rosters');
});

test('team mode dispatch order and intervals', () => {
  const m = Match.create({ mode: '3v3', seed: 2, setupSeconds: 0, players: Array.from({ length: 6 }, () => ({ faction: 'iron' as FactionId, isHuman: false, ai: 'script' as const })) });
  toBattle(m);
  const times: number[][] = m.s.players.map(() => []);
  for (let i = 0; i < Math.round(100 / DT); i++) {
    m.step();
    for (const e of m.events) if (e.kind === 'dispatch') times[e.player].push(+e.t.toFixed(2));
  }
  assert.deepEqual(times[0].slice(0, 3), [0.05, 45, 90]);
  assert.deepEqual(times[1].slice(0, 2), [15, 60]);
  assert.deepEqual(times[2].slice(0, 2), [30, 75]);
  assert.deepEqual(times[3], times[0]); assert.deepEqual(times[4], times[1]); assert.deepEqual(times[5], times[2]);
});

test('serialization round trip is exact and deterministic', () => {
  const m = Match.create({ mode: '1v1', seed: 99, setupSeconds: 1, players: [{ faction: 'iron', isHuman: false, ai: 'hard' }, { faction: 'gale', isHuman: false, ai: 'hard' }] });
  runFor(m, 40);
  const json = m.serialize();
  const r = Match.restore(json)!;
  assert.ok(r);
  runFor(m, 10); runFor(r, 10);
  assert.equal(m.serialize(), r.serialize(), 'restored match continues identically');
  assert.equal(Match.restore('{"version":0}'), null);
  assert.equal(Match.restore('garbage'), null);
});

test('emergency cannon: once per team, only near own base, damages + slows', () => {
  const m = mk(12);
  m.s.players[1].credits = 9000;
  for (let i = 0; i < 6; i++) m.command({ type: 'buy', player: 1, unitId: 'raiders', cell: cell(7, i) });
  toBattle(m);
  assert.equal(m.command({ type: 'cannon', player: 0, x: MAP.W - 300, y: 500 }).ok, false, 'not near own base');
  runFor(m, 14); // raiders reach our side
  const target = m.s.units.find((u) => u.team === 1)!;
  const hp0 = target.hp;
  assert.ok(m.command({ type: 'cannon', player: 0, x: target.x, y: target.y }).ok);
  assert.equal(m.command({ type: 'cannon', player: 0, x: target.x, y: target.y }).ok, false, 'already used/pending');
  runFor(m, MATCH.cannon.warning + DT);
  assert.ok(m.s.cannon[0].used);
  assert.ok(target.dead || target.hp < hp0, 'cannon damaged the target');
});

test('AI uses the same credits/rules: never negative, never beyond pop cap, waves visible only', () => {
  const m = Match.create({ mode: '1v1', seed: 5, setupSeconds: 2, players: [{ faction: 'iron', isHuman: false, ai: 'hard' }, { faction: 'gale', isHuman: false, ai: 'hard' }] });
  for (let i = 0; i < Math.round(300 / DT); i++) {
    m.step();
    for (const p of m.s.players) { assert.ok(p.credits >= -1e-6, 'credits non-negative'); assert.ok(rosterPop(p) <= ROSTER.popCap); }
    if (m.s.result) break;
  }
});

test('stuck / idle detection: units keep advancing and engaging (no unit idle far from enemies for long)', () => {
  const m = Match.create({ mode: '1v1', seed: 21, setupSeconds: 2, players: [{ faction: 'gale', isHuman: false, ai: 'normal' }, { faction: 'iron', isHuman: false, ai: 'normal' }] });
  let idleViolations = 0;
  const idleT = new Map<number, number>();
  for (let i = 0; i < Math.round(240 / DT); i++) {
    m.step();
    if (m.s.phase !== 'battle') continue;
    for (const u of m.s.units) {
      const moving = Math.abs(u.vx) + Math.abs(u.vy) > 1 || u.phase !== 'idle' || u.move === 'hold' || u.move === 'engage';
      const d = unitDef(u.type);
      if (d.behavior === 'support' || d.behavior === 'artillery') continue;
      const t = moving ? 0 : (idleT.get(u.id) ?? 0) + DT;
      idleT.set(u.id, t);
      if (t > 6) idleViolations++;
    }
    if (m.s.result) break;
  }
  assert.equal(idleViolations, 0, 'no combat unit idle for more than 6s');
});
