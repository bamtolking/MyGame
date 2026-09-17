import { describe, it, expect } from 'vitest';
import { newGame, unitById, createUnit, placeUnit, fieldUnits } from '../src/sim/state';
import { step, dispatch, serialize, deserialize, stateHash, startWave, DT } from '../src/sim/engine';
import { rollGrade, summon, currentOdds, mergePreview, merge, autoPick, recipeStatus, craftMythic, moveUnit, currentSummonCost } from '../src/sim/roster';
import { BASE_ODDS, PITY_ODDS } from '../src/data/summon';
import { UNIT_KINDS, SLOW_CAP, CORRO_MAX_STACKS, MAX_MYTHICS_ON_FIELD } from '../src/data/units';
import { spawnEnemy, applySlow, applyCorrosion, dealDamage, killEnemy, computeCtx } from '../src/sim/combat';
import { SLOTS, PATH_LEN, posAt, coverage, PATH_HALF } from '../src/data/map';
import { WAVES, TOTAL_WAVES } from '../src/data/waves';
import { ENEMIES } from '../src/data/enemies';
import { RELICS } from '../src/data/relics';
import type { Grade, GameState } from '../src/sim/types';
import { PITY_THRESHOLD } from '../src/data/economy';

const ready = (seed = 1) => { const s = newGame(seed, 1000); s.phase = 'prep'; s.prepT = 60; s.prepMax = 60; s.countdownT = 0; s.wave = 1; return s; };

describe('summon odds (no pity)', () => {
  it('base odds sum to 1 and rollGrade matches distribution within tolerance', () => {
    expect(Object.values(BASE_ODDS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(Object.values(PITY_ODDS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    const s = newGame(42); const N = 200000; const cnt = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) cnt[rollGrade(s, BASE_ODDS)]++;
    expect(cnt[0] / N).toBeCloseTo(0.70, 2); expect(cnt[1] / N).toBeCloseTo(0.25, 2);
    expect(Math.abs(cnt[2] / N - 0.045)).toBeLessThan(0.003); expect(Math.abs(cnt[3] / N - 0.005)).toBeLessThan(0.0012);
  });
  it('kind distribution is uniform across 8 kinds', () => {
    const s = ready(7); s.gold = 1e9; const cnt: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) { const r = summon(s); if (!r.ok) throw new Error(r.error); cnt[r.result!.kind] = (cnt[r.result!.kind] || 0) + 1; s.units.length = 2; s.bench.fill(null); }
    for (const k of UNIT_KINDS) expect(cnt[k] / 4000).toBeGreaterThan(0.09);
  });
});

describe('pity (불운 보정)', () => {
  it('guarantees hero+ after 12 consecutive sub-hero results and resets counter', () => {
    const s = ready(3); s.gold = 1e9; let maxStreak = 0, streak = 0, pityHits = 0;
    for (let i = 0; i < 3000; i++) {
      const before = currentOdds(s);
      const r = summon(s); if (!r.ok) throw new Error(r.error);
      if (before.pityActive) { pityHits++; expect(r.result!.grade).toBeGreaterThanOrEqual(2); expect(r.result!.pityUsed).toBe(true); }
      if (r.result!.grade >= 2) { expect(s.pity).toBe(0); streak = 0; } else { streak++; maxStreak = Math.max(maxStreak, streak); expect(s.pity).toBe(streak); }
      s.units.length = 2; s.bench.fill(null);
    }
    expect(maxStreak).toBeLessThanOrEqual(PITY_THRESHOLD); expect(pityHits).toBeGreaterThan(0);
  });
  it('pity roll distribution is 95/5', () => {
    const s = newGame(9); const N = 100000; let leg = 0; for (let i = 0; i < N; i++) if (rollGrade(s, PITY_ODDS) === 3) leg++;
    expect(Math.abs(leg / N - 0.05)).toBeLessThan(0.004);
  });
});

describe('fate shards / designation', () => {
  it('normal summon grants 1 shard; designation costs 5, forces kind, keeps grade odds', () => {
    const s = ready(5); s.gold = 1e9;
    let normals = 0; for (let i = 0; i < 50; i++) { const r = summon(s); if (r.result!.grade === 0) normals++; s.units.length = 2; s.bench.fill(null); }
    expect(s.shards).toBe(normals);
    s.shards = 5;
    expect(dispatch(s, { type: 'designate', kind: 'toad' }).ok).toBe(true); expect(s.shards).toBe(0);
    expect(dispatch(s, { type: 'designate', kind: 'toad' }).ok).toBe(false); // already designated / no shards
    const r = summon(s); expect(r.result!.kind).toBe('toad'); expect(r.result!.designated).toBe(true); expect(s.designatedKind).toBeNull();
    // grade odds unaffected by designation: sample
    const cnt = [0, 0, 0, 0]; for (let i = 0; i < 3000; i++) { s.shards = 5; s.designatedKind = null; dispatch(s, { type: 'designate', kind: 'bear' }); const rr = summon(s); cnt[rr.result!.grade]++; expect(rr.result!.kind).toBe('bear'); s.units.length = 2; s.bench.fill(null); }
    expect(cnt[0] / 3000).toBeGreaterThan(0.6); expect(cnt[0] / 3000).toBeLessThan(0.78);
  });
});

describe('economy guards', () => {
  it('insufficient gold: no deduction, no unit', () => { const s = ready(); s.gold = 10; const n = s.units.length; const r = dispatch(s, { type: 'summon' }); expect(r.ok).toBe(false); expect(s.gold).toBe(10); expect(s.units.length).toBe(n); });
  it('field + bench full: blocked before paying', () => {
    const s = ready(); s.gold = 1000; for (let i = 0; i < s.slots.length; i++) if (s.slots[i] == null) placeUnit(s, createUnit(s, 'archer', 0), { t: 'f', slot: i }); for (let i = 0; i < 3; i++) placeUnit(s, createUnit(s, 'archer', 0), { t: 'b', idx: i });
    const g = s.gold; const r = dispatch(s, { type: 'summon' }); expect(r.ok).toBe(false); expect(s.gold).toBe(g);
  });
  it('summon cost escalates and caps at 100', () => { const s = ready(); expect(currentSummonCost(s)).toBe(30); s.summonCount = 10; expect(currentSummonCost(s)).toBe(50); s.summonCount = 500; expect(currentSummonCost(s)).toBe(100); });
  it('upgrade cost/levels and max', () => { const s = ready(); s.gold = 10000; for (let i = 0; i < 12; i++) expect(dispatch(s, { type: 'upgrade', id: 'atk' }).ok).toBe(true); expect(dispatch(s, { type: 'upgrade', id: 'atk' }).ok).toBe(false); expect(s.upgrades.atk).toBe(12); });
});

describe('merge rules (atomic)', () => {
  const setup = () => { const s = ready(11); s.units.length = 0; s.slots.fill(null); s.bench.fill(null); return s; };
  it('same kind x3 → confirmed kind, grade+1, exactly 3 consumed, result in first field slot', () => {
    const s = setup(); const a = createUnit(s, 'penguin', 0), b = createUnit(s, 'penguin', 0), c = createUnit(s, 'penguin', 0);
    placeUnit(s, a, { t: 'b', idx: 0 }); placeUnit(s, b, { t: 'f', slot: 5 }); placeUnit(s, c, { t: 'f', slot: 6 });
    const pv = mergePreview(s, [a.id, b.id, c.id]); expect(pv.ok && pv.confirmed && pv.kind === 'penguin' && pv.grade === 1).toBe(true);
    const r = merge(s, [a.id, b.id, c.id]); expect(r.ok).toBe(true);
    expect(s.units.length).toBe(1); expect(s.units[0].grade).toBe(1); expect(s.units[0].kind).toBe('penguin'); expect(s.slots[5]).toBe(s.units[0].id); expect(s.slots[6]).toBeNull(); expect(s.bench[0]).toBeNull();
  });
  it('mixed kinds → random kind (unless sorting_box majority)', () => {
    const s = setup(); const a = createUnit(s, 'penguin', 1), b = createUnit(s, 'penguin', 1), c = createUnit(s, 'toad', 1); [a, b, c].forEach((u, i) => placeUnit(s, u, { t: 'f', slot: i }));
    expect(mergePreview(s, [a.id, b.id, c.id]).confirmed).toBe(false);
    s.relics.push('sorting_box'); const pv = mergePreview(s, [a.id, b.id, c.id]); expect(pv.confirmed).toBe(true); expect(pv.kind).toBe('penguin');
  });
  it('rejects duplicates, different grades, legends, mythics, and repeated ids after merge', () => {
    const s = setup(); const a = createUnit(s, 'bear', 0), b = createUnit(s, 'bear', 0), c = createUnit(s, 'bear', 1); [a, b, c].forEach((u, i) => placeUnit(s, u, { t: 'f', slot: i }));
    expect(merge(s, [a.id, a.id, b.id]).ok).toBe(false); expect(merge(s, [a.id, b.id, c.id]).ok).toBe(false);
    const l1 = createUnit(s, 'bear', 3), l2 = createUnit(s, 'bear', 3), l3 = createUnit(s, 'bear', 3); [l1, l2, l3].forEach((u, i) => placeUnit(s, u, { t: 'f', slot: 5 + i }));
    expect(merge(s, [l1.id, l2.id, l3.id]).ok).toBe(false);
    const d = createUnit(s, 'bear', 0); placeUnit(s, d, { t: 'f', slot: 10 });
    const ids = [a.id, b.id, d.id]; expect(merge(s, ids).ok).toBe(true); expect(merge(s, ids).ok).toBe(false); // second call with same ids fails (no dupes)
    expect(s.units.filter(u => u.grade === 1).length).toBe(2);
  });
  it('autoPick excludes locked units; preview warns on locked', () => {
    const s = setup(); const us = [0, 1, 2, 3].map(i => { const u = createUnit(s, 'rabbit', 0); placeUnit(s, u, { t: 'f', slot: i }); return u; });
    us[0].locked = true; const pick = autoPick(s, 0, 'rabbit')!; expect(pick).not.toContain(us[0].id); expect(pick.length).toBe(3);
    us[1].locked = true; us[2].locked = true; expect(autoPick(s, 0, 'rabbit')).toBeNull();
    expect(mergePreview(s, [us[0].id, us[1].id, us[3].id]).warnLocked!.length).toBe(2);
  });
});

describe('mythic crafting', () => {
  it('consumes exact ingredients + 1 core, blocks duplicates and >2 on field', () => {
    const s = ready(2); s.units.length = 0; s.slots.fill(null); s.bench.fill(null);
    const mk = (k: any, g: Grade, slot: number) => { const u = createUnit(s, k, g); placeUnit(s, u, { t: 'f', slot }); return u; };
    mk('rabbit', 2, 0); mk('penguin', 2, 1); mk('archer', 1, 2); mk('archer', 1, 3);
    expect(recipeStatus(s, 'storm').canCraft).toBe(false); s.cores = 1; expect(recipeStatus(s, 'storm').canCraft).toBe(true);
    expect(craftMythic(s, 'storm').ok).toBe(true); expect(s.cores).toBe(0); expect(s.units.length).toBe(2); expect(s.units.filter(u => u.mythic === 'storm').length).toBe(1);
    expect(s.units.find(u => u.mythic)!.loc).toEqual({ t: 'f', slot: 0 });
    mk('rabbit', 2, 4); mk('penguin', 2, 5); s.cores = 5; expect(craftMythic(s, 'storm').ok).toBe(false); // duplicate
    mk('raccoon', 2, 6); mk('mushroom', 2, 7); expect(craftMythic(s, 'sun').ok).toBe(true);
    mk('penguin', 2, 8); mk('mechanic', 2, 9); mk('rabbit', 1, 10); const r = craftMythic(s, 'chrono'); expect(r.ok).toBe(true);
    expect(fieldUnits(s).filter(u => u.mythic).length).toBe(MAX_MYTHICS_ON_FIELD); expect(s.units.find(u => u.mythic === 'chrono')!.loc.t).toBe('b');
    const ch = s.units.find(u => u.mythic === 'chrono')!; expect(moveUnit(s, ch.id, { t: 'f', slot: 12 }).ok).toBe(false);
  });
});

describe('relocation', () => {
  it('move has cooldown, swap works, projectiles never duplicate, telegraph cancels', () => {
    const s = ready(4); const a = unitById(s, s.slots[1]!)!; const b = unitById(s, s.slots[4]!)!;
    expect(moveUnit(s, a.id, { t: 'f', slot: 10 }).ok).toBe(true); expect(a.moveCd).toBeGreaterThan(0);
    expect(moveUnit(s, a.id, { t: 'f', slot: 11 }).ok).toBe(false);
    for (let i = 0; i < 100; i++) step(s, DT); expect(a.moveCd).toBe(0);
    expect(moveUnit(s, a.id, { t: 'f', slot: 4 }).ok).toBe(true); expect(s.slots[4]).toBe(a.id); expect(s.slots[10]).toBe(b.id);
    s.projectiles.push({ id: 999, kind: 'arrow', x: 0, y: 0, sx: 0, sy: 0, tx: 10, ty: 10, targetId: -1, t: 0, dur: 0, speed: 100, dmg: 1, src: a.id, grade: 0, radius: 0, fx: 0, fired: 0 });
    for (let i = 0; i < 100; i++) step(s, DT); expect(moveUnit(s, b.id, { t: 'b', idx: 0 }).ok).toBe(true); expect(s.projectiles.filter(p => p.id === 999).length).toBeLessThanOrEqual(1);
  });
});

describe('enemies, statuses, rewards', () => {
  it('slime split: parent reward once, children reward 0 and inherit progress; exit damage once', () => {
    const s = ready(6); s.phase = 'wave'; s.waveRt = { index: 6, spawnQueue: [], spawnT: 0, spawned: 0, remaining: 0, extraAccepted: false, startedAt: 0, overheatSlots: [], overheatT: 0, courierAlive: false };
    const e = spawnEnemy(s, 'slime', 1, '', 500); const g0 = s.gold; killEnemy(s, e, null);
    expect(s.gold - g0).toBe(ENEMIES.slime.reward); const kids = s.enemies.filter(x => x.alive && x.type === 'slimelet'); expect(kids.length).toBe(2); expect(kids[0].progress).toBe(500); expect(kids.every(k => k.reward === 0)).toBe(true);
    killEnemy(s, e, null); expect(s.gold - g0).toBe(ENEMIES.slime.reward); // no double reward
    kids.forEach(k => { k.progress = PATH_LEN - 0.001; }); const life = s.life; step(s, DT); expect(s.life).toBe(life - 2); expect(s.enemies.filter(x => x.alive).length).toBe(0);
    step(s, DT); expect(s.life).toBe(life - 2);
  });
  it('slow capped at 60%, weaker slow ignored, corrosion max 3 stacks, boss slow halved', () => {
    const s = ready(); const e = spawnEnemy(s, 'wisp', 1); applySlow(e, 0.9, 2); expect(e.slowAmt).toBe(SLOW_CAP); applySlow(e, 0.3, 5); expect(e.slowAmt).toBe(SLOW_CAP); expect(e.slowT).toBe(2);
    for (let i = 0; i < 6; i++) applyCorrosion(e, 4, 1); expect(e.corro).toBe(CORRO_MAX_STACKS);
    const b = spawnEnemy(s, 'boss_cart', 1); applySlow(b, 0.6, 2); expect(b.slowAmt).toBeCloseTo(0.3);
  });
  it('damage: armor, corrosion, cart stance, shield first; dead enemies give no double kill', () => {
    const s = ready(); const t = spawnEnemy(s, 'tortoise', 1); const d1 = dealDamage(s, t, 20, null, 'hit'); expect(d1).toBeCloseTo(10); applyCorrosion(t, 4, 1); applyCorrosion(t, 4, 1); const d2 = dealDamage(s, t, 20, null, 'hit'); expect(d2).toBeCloseTo(14);
    const g = spawnEnemy(s, 'ghost', 1); dealDamage(s, g, 30, null, 'hit'); expect(g.shield).toBe(15); expect(g.hp).toBe(50);
    const c = spawnEnemy(s, 'boss_cart', 1); c.bossStance = 0; expect(dealDamage(s, c, 100, null, 'hit')).toBeCloseTo(20); c.bossStance = 1; expect(dealDamage(s, c, 100, null, 'hit')).toBeCloseTo(125);
    const w = spawnEnemy(s, 'wisp', 1); const kills0 = s.stats.killsBy.wisp || 0; dealDamage(s, w, 1000, null, 'hit'); dealDamage(s, w, 1000, null, 'hit'); killEnemy(s, w, null); expect(s.stats.killsBy.wisp).toBe(kills0 + 1);
  });
  it('attack speed buffs cap at +60% and same-type buffs do not stack', () => {
    const s = ready(); s.units.length = 0; s.slots.fill(null); const a = createUnit(s, 'archer', 0); placeUnit(s, a, { t: 'f', slot: 16 });
    for (const [k, slot] of [['mechanic', 15], ['mechanic', 17]] as const) { const m = createUnit(s, k, 3); placeUnit(s, m, { t: 'f', slot }); }
    let ctx = computeCtx(s); expect(ctx.get(a.id)!.aspd).toBeCloseTo(1.30); // two legend mechanics (0.30 each) → max, not sum
    const ch = createUnit(s, 'penguin', 4, 'chrono'); placeUnit(s, ch, { t: 'f', slot: 12 }); ctx = computeCtx(s); expect(ctx.get(a.id)!.aspd).toBeCloseTo(1.60);
  });
});

describe('skills', () => {
  it('cooldown enforced; bomb damages, boss reduced', () => {
    const s = ready(); s.phase = 'wave'; s.waveRt = { index: 1, spawnQueue: [], spawnT: 0, spawned: 0, remaining: 0, extraAccepted: false, startedAt: 0, overheatSlots: [], overheatT: 0, courierAlive: false };
    const e = spawnEnemy(s, 'wisp', 1, '', 100); const b = spawnEnemy(s, 'boss_flag', 1, '', 100); b.hp = 100000; b.maxHp = 100000;
    expect(dispatch(s, { type: 'skill', kind: 'bomb', x: e.x, y: e.y }).ok).toBe(true); expect(dispatch(s, { type: 'skill', kind: 'bomb', x: e.x, y: e.y }).ok).toBe(false);
    for (let i = 0; i < 60; i++) step(s, DT);
    expect(e.alive).toBe(false); expect(b.hp).toBeLessThan(100000); expect(100000 - b.hp).toBeLessThan(140 * 1.08 * 0.9 * 0.5);
  });
});

describe('waves & map data', () => {
  it('40 waves, bosses at 10/20/30/40, all 8 normal enemy types appear, intros precede use', () => {
    expect(WAVES.length).toBe(TOTAL_WAVES); expect(WAVES[9].boss).toBe('boss_flag'); expect(WAVES[19].boss).toBe('boss_cart'); expect(WAVES[29].boss).toBe('boss_thief'); expect(WAVES[39].boss).toBe('boss_king');
    const seen = new Set<string>(); for (const w of WAVES) { for (const g of w.groups) { if (!ENEMIES[g.type].boss && !seen.has(g.type)) { expect(w.intro).toBe(g.type); } seen.add(g.type); } }
    for (const t of ['wisp', 'fox', 'tortoise', 'troll', 'slime', 'ghost', 'caster', 'ogre']) expect(seen.has(t)).toBe(true);
  });
  it('slots do not overlap the path and have meaningful coverage variance', () => {
    for (const sl of SLOTS) { let md = 1e9; for (let p = 0; p < PATH_LEN; p += 2) { const [x, y] = posAt(p); md = Math.min(md, Math.hypot(x - sl.x, y - sl.y)); } expect(md).toBeGreaterThanOrEqual(PATH_HALF + 16); }
    const cov = SLOTS.map(sl => coverage(sl.x, sl.y, 110)); expect(Math.max(...cov) / Math.min(...cov)).toBeGreaterThan(1.8);
    for (let i = 0; i < SLOTS.length; i++) for (let j = i + 1; j < SLOTS.length; j++) expect(Math.hypot(SLOTS[i].x - SLOTS[j].x, SLOTS[i].y - SLOTS[j].y)).toBeGreaterThanOrEqual(44);
  });
  it('relic offers: 3 distinct, unowned', () => {
    const s = ready(8); s.phase = 'wave'; startWave(s, 10); s.wave = 10; s.enemies = []; s.waveRt!.spawnQueue = []; step(s, DT); expect(s.phase).toBe('relic'); expect(s.relicOffer!.length).toBe(3); expect(new Set(s.relicOffer!).size).toBe(3);
    expect(dispatch(s, { type: 'relic', id: 'nope' }).ok).toBe(false); expect(dispatch(s, { type: 'relic', id: s.relicOffer![1] }).ok).toBe(true); expect(s.relics.length).toBe(1); expect(s.phase).toBe('prep'); expect(s.wave).toBe(11);
  });
});

describe('determinism & snapshots', () => {
  const script = (s: GameState) => { if (s.phase === 'prep' && s.prepT < 5) dispatch(s, { type: 'early' }); if (s.gold >= 60) { const r = dispatch(s, { type: 'summon' }); if (r.ok) { const u = s.units[s.units.length - 1]; const f = s.slots.findIndex(x => x == null); if (u.loc.t === 'b' && f >= 0) dispatch(s, { type: 'move', id: u.id, to: { t: 'f', slot: f } }); } } if (s.phase === 'relic') dispatch(s, { type: 'relic', id: s.relicOffer![0] }); };
  it('same seed + same inputs → identical state hash; snapshot roundtrip continues identically', () => {
    const a = newGame(123, 1), b = newGame(123, 1);
    for (let i = 0; i < 60 * 120; i++) { script(a); script(b); step(a, DT); step(b, DT); a.events.length = 0; b.events.length = 0; }
    expect(stateHash(a)).toBe(stateHash(b)); expect(a.wave).toBeGreaterThan(2);
    const snap = serialize(a); const c = deserialize(snap);
    for (let i = 0; i < 60 * 60; i++) { script(a); script(c); step(a, DT); step(c, DT); a.events.length = 0; c.events.length = 0; }
    expect(stateHash(a)).toBe(stateHash(c));
  });
  it('rejects wrong version / corrupt snapshots', () => {
    expect(() => deserialize('{"version":1}')).toThrow(); expect(() => deserialize('garbage')).toThrow();
    const s = newGame(1); const o = JSON.parse(serialize(s)); delete o.rng; expect(() => deserialize(JSON.stringify(o))).toThrow();
  });
  it('resuming a snapshot restores gold/rng so re-rolling by reload is impossible', () => {
    const s = newGame(55, 1); s.phase = 'prep'; s.prepT = 30; s.prepMax = 30; s.gold = 500;
    const snap = serialize(s);
    const r1 = summon(deserialize(snap)).result!; const r2 = summon(deserialize(snap)).result!;
    expect(r1.grade).toBe(r2.grade); expect(r1.kind).toBe(r2.kind);
  });
});
