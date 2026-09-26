import { describe, it, expect } from 'vitest';
import { CLASSES, CLASS_IDS, STARTER_CLASSES, classUnlocked, unlockedClasses, ATK } from '../src/shared/data/classes.ts';
import { MON_IDX } from '../src/shared/data/monsters.ts';
import { WEAPON_NAMES } from '../src/shared/data/items.ts';
import { xpNeed } from '../src/shared/data/xp.ts';
import { doAction } from '../src/server/actions.ts';
import { grantXp, withUnlocks } from '../src/server/progress.ts';
import { stun } from '../src/server/combat.ts';
import type { World } from '../src/server/world.ts';
import type { Player, Monster } from '../src/server/entities.ts';
import type { ClassId } from '../src/shared/types.ts';
import type { Ev } from '../src/shared/protocol.ts';
import { mkWorld, mkPlayer, spotIn, run, mkServer, FakeConn } from './helpers.ts';
import { PROTOCOL_VERSION } from '../src/shared/constants.ts';

const P0 = { level: 1, bosses: 0, worldBoss: 0 };
/** Collects every event the world emits (the server clears them per snapshot; worlds in tests are stepped directly). */
function evs(w: World, k: string): Ev[] { return w.events.map(e => e.ev).filter(e => e.k === k); }
function ring(w: World, at: [number, number], n: number, r: number, t = MON_IDX.clubber, lv = 5): Monster[] {
  const out: Monster[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const m = w.spawnMonster(t, at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, lv)!; m.lairIdx = 0; out.push(m); }
  w.spatial.rebuild(w.mons.values()); return out;
}
const tank = (ms: Monster[]) => { for (const m of ms) { m.maxHp = m.hp = 1e7; m.dmg = 0; } };

describe('class roster and unlocks', () => {
  it('ten distinct classes with complete data, starting with two', () => {
    expect(CLASS_IDS.length).toBe(10); expect(new Set(CLASS_IDS).size).toBe(10);
    expect(STARTER_CLASSES).toEqual(['sword', 'archer']);
    for (const id of CLASS_IDS) {
      const c = CLASSES[id]; expect(c.id).toBe(id);
      for (const k of ['name', 'desc', 'role', 'ultName', 'ultDesc', 'glyph', 'color'] as const) expect(c[k]).toBeTruthy();
      expect(c.unlock.text).toBeTruthy(); expect(WEAPON_NAMES[id]?.length).toBeGreaterThan(3);
      expect(c.hp).toBeGreaterThan(0); expect(c.aspd).toBeGreaterThan(0); expect(c.range).toBeGreaterThan(0);
    }
    expect(unlockedClasses(P0)).toEqual(['sword', 'archer']);
  });
  it('classes unlock progressively with level, first boss and world boss', () => {
    expect(classUnlocked('shaman', { ...P0, level: 3 })).toBe(false); expect(classUnlocked('shaman', { ...P0, level: 4 })).toBe(true);
    expect(classUnlocked('taoist', { ...P0, level: 9 })).toBe(false); expect(classUnlocked('taoist', { ...P0, bosses: 1 })).toBe(true); expect(classUnlocked('taoist', { ...P0, level: 10 })).toBe(true);
    expect(classUnlocked('musician', { ...P0, worldBoss: 1 })).toBe(true); expect(classUnlocked('musician', { ...P0, level: 19 })).toBe(false);
    expect(unlockedClasses({ level: 30, bosses: 0, worldBoss: 0 }).length).toBe(10);
    // every class is reachable by level 24 and the count never decreases
    let prev = 0; for (let l = 1; l <= 30; l++) { const n = unlockedClasses({ ...P0, level: l }).length; expect(n).toBeGreaterThanOrEqual(prev); prev = n; }
    expect(unlockedClasses({ ...P0, level: 24 }).length).toBe(10);
  });
  it('a new character can only start as a starter class', () => {
    const { gs } = mkServer(); const c = new FakeConn(); const s = gs.connect(c);
    gs.message(s, JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token: 'tok_cls_painter_00001', name: '화공지망', cls: 'painter' }));
    expect(s.player!.prof.cls).toBe('sword');
    const c2 = new FakeConn(); const s2 = gs.connect(c2);
    gs.message(s2, JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token: 'tok_cls_archer_000001', name: '궁수', cls: 'archer' }));
    expect(s2.player!.prof.cls).toBe('archer'); expect(s2.player!.prof.tried).toEqual(['archer']);
  });
  it('levelling past a threshold announces the unlock exactly once', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'sword', 7, spotIn(w, 1, 3));
    grantXp(w, p, xpNeed(7) + 5); expect(p.prof.level).toBe(8);
    const un = p.priv.filter(e => e.k === 'unlock'); expect(un).toEqual([{ k: 'unlock', c: 'spear' }]);
    p.priv.length = 0; grantXp(w, p, 10); expect(p.priv.filter(e => e.k === 'unlock').length).toBe(0);
    // nested changes are announced by the outermost call only
    p.priv.length = 0; withUnlocks(w, p, () => { withUnlocks(w, p, () => { p.prof.stats.bosses++; }); });
    expect(p.priv.filter(e => e.k === 'unlock')).toEqual([{ k: 'unlock', c: 'taoist' }]);
  });
});

describe('class change', () => {
  it('only in town, only to unlocked classes, with a short cooldown; grants the starting talisman once', () => {
    const w = mkWorld(); const town = spotIn(w, 0); const p = mkPlayer(w, 'sword', 3, town);
    expect(doAction(w, p, { t: 'cls', cls: 'nope' })).toMatch(/없는/);
    expect(doAction(w, p, { t: 'cls', cls: 'shaman' })).toMatch(/잠긴/);
    expect(doAction(w, p, { t: 'cls', cls: 'sword' })).toBeNull(); expect(p.prof.cls).toBe('sword');
    const f = mkPlayer(w, 'sword', 3, spotIn(w, 1, 2));
    expect(doAction(w, f, { t: 'cls', cls: 'archer' })).toMatch(/마을/);
    const hp0 = p.stats.maxHp; const tals0 = p.prof.tals.length;
    expect(doAction(w, p, { t: 'cls', cls: 'archer' })).toBeNull();
    expect(p.prof.cls).toBe('archer'); expect(p.stats.maxHp).toBeLessThan(hp0);
    expect(p.prof.tals.length).toBe(tals0 + 1); expect(p.prof.tals.at(-1)!.kind).toBe(CLASSES.archer.startTal);
    expect(evs(w, 'cls')).toEqual([{ k: 'cls', p: p.id, c: 'archer' }]);
    expect(w.rosterAdd.at(-1)!.cls).toBe('archer');
    expect(doAction(w, p, { t: 'cls', cls: 'sword' })).toMatch(/잠시/);
    run(w, 3.1); expect(doAction(w, p, { t: 'cls', cls: 'sword' })).toBeNull();
    run(w, 3.1); expect(doAction(w, p, { t: 'cls', cls: 'archer' })).toBeNull();
    expect(p.prof.tals.filter(t => t.kind === CLASSES.archer.startTal).length).toBe(1); // no talisman farming
    p.prof.level = 30; run(w, 3.1); expect(doAction(w, p, { t: 'cls', cls: 'painter' })).toBeNull(); expect(p.prof.cls).toBe('painter');
  });
});

describe('every class fights', () => {
  for (const cls of CLASS_IDS) it(`${cls}: clears a pack with basic attacks and its ultimate hits`, () => {
    const w = mkWorld(); const at = spotIn(w, 1, 11); const p = mkPlayer(w, cls, 10, at);
    const pack = ring(w, at, 8, Math.min(70, CLASSES[cls].range * 0.6), MON_IDX.imp, 3);
    for (const m of pack) m.dmg = 0;
    run(w, 25); expect(pack.filter(m => m.dead).length).toBeGreaterThanOrEqual(6);
    expect(p.prof.stats.kills).toBeGreaterThanOrEqual(6);
    // ultimate against sturdy dummies: it must deal damage within its duration
    const dummies = ring(w, [p.x, p.y], 6, 110, MON_IDX.clubber, 5); tank(dummies); const hp0 = dummies.reduce((s, m) => s + m.hp, 0);
    p.ult = 100; p.atkT = 99; w.events.length = 0; expect(doAction(w, p, { t: 'ult' })).toBeNull();
    for (let i = 0; i < 20 * 6; i++) { p.atkT = 99; w.step(); }
    expect(hp0 - dummies.reduce((s, m) => s + m.hp, 0)).toBeGreaterThan(p.stats.atk * 3);
    expect(evs(w, 'ult').length).toBe(1);
  });
});

describe('class mechanics', () => {
  const setup = (cls: ClassId, lv = 10): [World, Player, [number, number]] => { const w = mkWorld(); const at = spotIn(w, 1, 4); return [w, mkPlayer(w, cls, lv, at), at]; };
  it('spear thrust pierces a line; its ult thrusts every 0.2 s', () => {
    const [w, p, at] = setup('spear'); const line = [40, 90, 140].map(d => w.spawnMonster(MON_IDX.clubber, at[0] + d, at[1], 5)!); tank(line);
    const off = w.spawnMonster(MON_IDX.clubber, at[0], at[1] + 120, 5)!; tank([off]); w.spatial.rebuild(w.mons.values());
    p.atkT = 0; w.step(); expect(line.every(m => m.hp < m.maxHp)).toBe(true); expect(off.hp).toBe(off.maxHp);
    p.ult = 100; w.events.length = 0; doAction(w, p, { t: 'ult' }); expect(p.ultT).toBe(3); run(w, 3.1);
    expect(evs(w, 'uhit').length).toBeGreaterThanOrEqual(14); expect(evs(w, 'uhit').length).toBeLessThanOrEqual(16);
  });
  it('taoist lightning chains to two more monsters and reports the chain points', () => {
    const [w, p, at] = setup('taoist'); const ms = [200, 300, 400, 900].map(d => w.spawnMonster(MON_IDX.clubber, at[0] + d * 0.5, at[1], 5)!); tank(ms);
    w.spatial.rebuild(w.mons.values()); p.atkT = 0; w.step();
    const a = evs(w, 'atk')[0] as Ev & { k: 'atk' }; expect(a.pts?.length).toBe(4);
    expect(ms.slice(0, 3).every(m => m.hp < m.maxHp)).toBe(true); expect(ms[3].hp).toBe(ms[3].maxHp);
  });
  it('guardian bash pushes monsters back; its aura cuts allies’ damage taken; its ult shields and stuns', () => {
    const [w, g, at] = setup('guardian'); const m = w.spawnMonster(MON_IDX.clubber, at[0] + 40, at[1], 5)!; tank([m]); w.spatial.rebuild(w.mons.values());
    const x0 = m.x; g.atkT = 0; w.step(); expect(m.x).toBeGreaterThan(x0 + 10);
    const ally = mkPlayer(w, 'archer', 10, [at[0], at[1] + 60]); const lone = mkPlayer(w, 'archer', 10, spotIn(w, 1, 0, at, 900));
    w.step(); const h1 = ally.hp, h2 = lone.hp; w.hurtPlayer(ally, 50); w.hurtPlayer(lone, 50);
    expect(h1 - ally.hp).toBeLessThan(h2 - lone.hp);
    g.ult = 100; ally.shield = 0; doAction(w, g, { t: 'ult' });
    expect(ally.shield).toBeGreaterThan(g.stats.maxHp * 0.3); expect(g.ultT).toBe(5); expect(m.stunT).toBeGreaterThan(1);
    const gh = g.hp; g.shield = 0; w.hurtPlayer(g, 100); const cut = gh - g.hp;
    const [w2, g2] = setup('guardian'); g2.shield = 0; const gh2 = g2.hp; w2.hurtPlayer(g2, 100); expect(cut).toBeLessThan((gh2 - g2.hp) * 0.6);
  });
  it('assassin deals bonus damage to weakened monsters and hits extra targets during its ult', () => {
    const [w, p, at] = setup('assassin'); p.stats.crit = 0; const m = w.spawnMonster(MON_IDX.clubber, at[0] + 30, at[1], 5)!; tank([m]); w.spatial.rebuild(w.mons.values());
    p.atkT = 0; w.step(); const full = m.maxHp - m.hp;
    m.hp = m.maxHp * 0.2; const low0 = m.hp; p.atkT = 0; w.step(); const low = low0 - m.hp;
    expect(low / full).toBeGreaterThan(1.3);
    ring(w, at, 4, 90, MON_IDX.clubber, 5); p.ult = 100; doAction(w, p, { t: 'ult' }); w.events.length = 0; p.atkT = 0; w.step();
    const a = evs(w, 'atk')[0] as Ev & { k: 'atk' }; expect(a.pts!.length).toBe(6);
    expect(w.aspdMul(p)).toBeCloseTo(1.5);
  });
  it('gunner bullets pierce everything on the line and burst at the target', () => {
    const [w, p, at] = setup('gunner'); const ms = [60, 160, 300].map(d => w.spawnMonster(MON_IDX.clubber, at[0] + d, at[1], 5)!); tank(ms);
    w.spatial.rebuild(w.mons.values()); p.atkT = 0; w.step(); run(w, 0.4);
    expect(ms.every(m => m.hp < m.maxHp)).toBe(true);
  });
  it('musician speeds up nearby allies and its ult buffs and heals them', () => {
    const [w, mu, at] = setup('musician'); const ally = mkPlayer(w, 'sword', 10, [at[0] + 100, at[1]]); w.step();
    expect(w.aspdMul(ally)).toBeCloseTo(1 + ATK.musicianAspd); ally.x += 400; expect(w.aspdMul(ally)).toBe(1); ally.x -= 400;
    ally.hp = 10; mu.ult = 100; doAction(w, mu, { t: 'ult' });
    expect(ally.hp).toBeGreaterThan(10); expect(ally.buffT).toBe(6); expect(w.aspdMul(ally)).toBeCloseTo(1 + ATK.musicianAspd + 0.35);
    run(w, 6.1); expect(w.aspdMul(ally)).toBeCloseTo(1 + ATK.musicianAspd);
  });
  it('painter ink pools slow and keep burning', () => {
    const [w, p, at] = setup('painter'); const m = w.spawnMonster(MON_IDX.clubber, at[0] + 150, at[1], 5)!; tank([m]); w.spatial.rebuild(w.mons.values());
    p.atkT = 0; w.step(); p.atkT = 99; run(w, 0.3); expect(m.slowT).toBeGreaterThan(0); expect(m.slowMul).toBeLessThan(1);
    const after1 = m.hp; for (let i = 0; i < 25; i++) { p.atkT = 99; w.step(); } expect(m.hp).toBeLessThan(after1);
  });
  it('stunned monsters neither move nor attack', () => {
    const [w, p, at] = setup('taoist'); const m = w.spawnMonster(MON_IDX.clubber, at[0] + 30, at[1], 5)!; m.maxHp = m.hp = 1e7; w.spatial.rebuild(w.mons.values());
    m.stunT = 1; m.tgt = p.id; m.st = 'chase'; const x0 = m.x, y0 = m.y, hp0 = p.hp; p.atkT = 99;
    for (let i = 0; i < 18; i++) { p.atkT = 99; w.step(); }
    expect(Math.hypot(m.x - x0, m.y - y0)).toBeLessThan(8); expect(p.hp).toBe(hp0);
  });
});

describe('review fixes', () => {
  const setup = (cls: ClassId, lv = 10): [World, Player, [number, number]] => { const w = mkWorld(); const at = spotIn(w, 1, 4); return [w, mkPlayer(w, cls, lv, at), at]; };
  it('ultimate sub-hits stop once the caster walks into town or changes class', () => {
    for (const how of ['town', 'cls'] as const) {
      const [w, p, at] = setup('taoist'); const ms = ring(w, at, 6, 120, MON_IDX.clubber, 5); tank(ms); p.prof.slots = [null, null, null, null]; // no talismans
      p.ult = 100; doAction(w, p, { t: 'ult' }); for (let i = 0; i < 6; i++) { p.atkT = 99; w.step(); } // first strike lands at 0.15 s
      if (how === 'town') { const t = spotIn(w, 0); p.x = t[0]; p.y = t[1]; } else { p.prof.cls = 'sword'; }
      const hp0 = ms.reduce((a, m) => a + m.hp, 0); for (let i = 0; i < 60; i++) { p.atkT = 99; w.step(); }
      expect(ms.reduce((a, m) => a + m.hp, 0)).toBe(hp0);
    }
  });
  it('a stun cancels a charge that is being wound up', () => {
    const [w, p, at] = setup('guardian'); const m = w.spawnMonster(MON_IDX.clubber, at[0] + 150, at[1], 5)!; m.maxHp = m.hp = 1e7; w.spatial.rebuild(w.mons.values());
    m.tgt = p.id; m.st = 'chase'; m.atkT = 0; let wound = false;
    for (let i = 0; i < 40 && !wound; i++) { p.atkT = 99; w.step(); wound = (m.st as string) === 'wind'; }
    expect(wound).toBe(true); expect(w.hazards.some(h => h.src === m.id)).toBe(true);
    stun(w, m, 1.5); expect(m.st).toBe('recover'); expect(w.hazards.some(h => h.src === m.id)).toBe(false);
    const hp0 = p.hp, x0 = m.x; for (let i = 0; i < 20; i++) { p.atkT = 99; w.step(); }
    expect(p.hp).toBe(hp0); expect(Math.abs(m.x - x0)).toBeLessThan(8);
  });
  it('a gunner shot hits each monster once: target ×1, pierced ×0.85, burst ×0.4', () => {
    const [w, p, at] = setup('gunner'); p.stats.crit = 0;
    const tgt = w.spawnMonster(MON_IDX.clubber, at[0] + 120, at[1], 5)!, behind = w.spawnMonster(MON_IDX.clubber, at[0] + 150, at[1], 5)!, side = w.spawnMonster(MON_IDX.clubber, at[0] + 120, at[1] + 40, 5)!;
    tank([tgt, behind, side]); w.spatial.rebuild(w.mons.values()); p.atkT = 0; w.step(); for (let i = 0; i < 10; i++) { p.atkT = 99; w.step(); }
    const dmg = (m: Monster) => (m.maxHp - m.hp) / p.stats.atk;
    expect(dmg(tgt)).toBeGreaterThan(0.9); expect(dmg(tgt)).toBeLessThan(1.1);
    expect(dmg(behind)).toBeGreaterThan(0.75); expect(dmg(behind)).toBeLessThan(0.95);
    expect(dmg(side)).toBeGreaterThan(0.3); expect(dmg(side)).toBeLessThan(0.5);
  });
  it('a stun does not leave a monster crippled by a stronger slow afterwards', () => {
    const [w, , at] = setup('painter'); const m = w.spawnMonster(MON_IDX.clubber, at[0] + 100, at[1], 5)!;
    stun(w, m, 0.8); expect(m.slowMul).toBe(1); expect(m.stunT).toBeCloseTo(0.8);
  });
  it('the musician aura helps allies, not the musician', () => {
    const [w, mu, at] = setup('musician'); const ally = mkPlayer(w, 'sword', 10, [at[0] + 60, at[1]]); w.step();
    expect(w.aspdMul(mu)).toBe(1); expect(w.aspdMul(ally)).toBeCloseTo(1 + ATK.musicianAspd);
  });
  it('profiles from before the class system keep their class and get no duplicate talisman', () => {
    const { gs, store } = mkServer(); const prof = JSON.parse(JSON.stringify(mkPlayer(mkWorld(), 'shaman', 2).prof)); delete prof.tried; store.save('tok_legacy_shaman_0001', prof);
    const c = new FakeConn(); const s = gs.connect(c); gs.message(s, JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token: 'tok_legacy_shaman_0001', name: 'x', cls: 'sword' }));
    const p = s.player!; expect(p.prof.cls).toBe('shaman'); expect(p.prof.tried).toEqual(['shaman']);
    const w = s.world!; const t = spotIn(w, 0); p.x = t[0]; p.y = t[1]; p.zone = 0;
    expect(doAction(w, p, { t: 'cls', cls: 'sword' })).toBeNull(); w.time += 5;
    p.priv.length = 0; grantXp(w, p, xpNeed(2) + xpNeed(3) + 5); expect(p.prof.level).toBe(4);
    expect(p.priv.filter(e => e.k === 'unlock')).toEqual([]); // already played the shaman: no "new class" fanfare
    expect(doAction(w, p, { t: 'cls', cls: 'shaman' })).toBeNull();
    expect(p.prof.tals.filter(x => x.kind === 'wisp').length).toBe(1);
  });
  it('an outdated client is asked to reload', () => {
    const { gs } = mkServer(); const c = new FakeConn(); const s = gs.connect(c);
    gs.message(s, JSON.stringify({ t: 'hello', v: 1, token: 'tok_old_client_000001', name: 'x', cls: 'sword' }));
    expect(c.closed).toBe(true); expect(c.of('err')[0].msg).toMatch(/새로고침/);
  });
});
