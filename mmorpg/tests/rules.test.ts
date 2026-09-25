import { describe, it, expect } from 'vitest';
import { MON_IDX, WORLD_BOSS, MONSTERS } from '../src/shared/data/monsters.ts';
import { REVIVE_TIME, DOWN_TIME, INV_MAX } from '../src/shared/constants.ts';
import { makeItem, enhanceCost } from '../src/shared/data/items.ts';
import { Rng } from '../src/shared/rng.ts';
import { zoneAt } from '../src/shared/map.ts';
import { doAction, cleanText, cleanName } from '../src/server/actions.ts';
import { hitMonster } from '../src/server/combat.ts';
import { giveItem } from '../src/server/progress.ts';
import { mkWorld, mkPlayer, spotIn, run } from './helpers.ts';

describe('shared kill credit (no kill stealing)', () => {
  it('everyone alive nearby gets XP; far, downed and in-town players do not', () => {
    const w = mkWorld(); const at = spotIn(w, 1, 3);
    const a = mkPlayer(w, 'sword', 1, at), b = mkPlayer(w, 'archer', 1, [at[0] + 200, at[1]]);
    const far = mkPlayer(w, 'shaman', 1, spotIn(w, 1, 0, at, 1200)); const down = mkPlayer(w, 'sword', 1, [at[0] - 100, at[1]]); w.downPlayer(down);
    const m = w.spawnMonster(MON_IDX.imp, at[0] + 50, at[1], 2)!; w.spatial.rebuild(w.mons.values());
    hitMonster(w, a, m, 999);
    expect(m.dead).toBe(true);
    expect(a.prof.stats.kills).toBe(1); expect(b.prof.stats.kills).toBe(1);
    expect(far.prof.stats.kills).toBe(0); expect(down.prof.stats.kills).toBe(0);
    expect(b.prof.xp).toBe(a.prof.xp); expect(a.prof.xp).toBeGreaterThan(0);
  });
  it('the group bonus is capped: 5 players get at most +80% of solo value each per kill-set', () => {
    const w = mkWorld(); const at = spotIn(w, 1, 5);
    const solo = mkPlayer(w, 'sword', 1, at); const m1 = w.spawnMonster(MON_IDX.clubber, at[0] + 30, at[1], 3)!; w.spatial.rebuild(w.mons.values()); hitMonster(w, solo, m1, 9999);
    const soloXp = solo.prof.xp;
    const w2 = mkWorld(); const ps = [0, 1, 2, 3, 4].map(i => mkPlayer(w2, 'sword', 1, [at[0] + i * 20, at[1]]));
    const m2 = w2.spawnMonster(MON_IDX.clubber, at[0] + 30, at[1], 3)!; w2.spatial.rebuild(w2.mons.values()); hitMonster(w2, ps[0], m2, 9999);
    expect(ps[3].prof.xp).toBeGreaterThan(0);
    expect(ps[3].prof.xp * 5).toBeLessThanOrEqual(Math.ceil(soloXp * 1.8) + 5);
  });
});

describe('down & revive', () => {
  it('an ally standing next to a downed player revives them after REVIVE_TIME', () => {
    const w = mkWorld(); const at = spotIn(w, 1, 6); const a = mkPlayer(w, 'sword', 3, at), b = mkPlayer(w, 'shaman', 3, [at[0] + 30, at[1]]);
    w.hurtPlayer(a, 99999); expect(a.down).toBe(true); expect(a.prof.stats.deaths).toBe(1);
    run(w, REVIVE_TIME + 0.2); expect(a.down).toBe(false); expect(a.hp).toBeGreaterThan(0); expect(b.prof.stats.revives).toBe(1);
  });
  it('alone, the downed player respawns at the nearest discovered shrine after DOWN_TIME', () => {
    const w = mkWorld(); const at = spotIn(w, 2, 2); const a = mkPlayer(w, 'archer', 9, at); a.prof.shrines = [0, 1];
    w.hurtPlayer(a, 99999); run(w, DOWN_TIME + 0.2);
    expect(a.down).toBe(false); expect(a.hp).toBe(a.stats.maxHp);
    const s1 = w.map.shrines[1]; expect(Math.hypot(a.x - s1.x, a.y - s1.y)).toBeLessThan(200);
  });
  it('the shaman ultimate instantly revives a downed ally in range', () => {
    const w = mkWorld(); const at = spotIn(w, 1, 7); const s = mkPlayer(w, 'shaman', 5, at), d = mkPlayer(w, 'sword', 5, [at[0] + 150, at[1]]);
    w.downPlayer(d); s.ult = 100; w.spatial.rebuild(w.mons.values()); expect(doAction(w, s, { t: 'ult' })).toBeNull(); run(w, 0.5);
    expect(d.down).toBe(false);
  });
});

describe('talismans', () => {
  it('merging needs 3 identical (kind+level) and keeps the equipped copy', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'sword', 3, spotIn(w, 0));
    const start = p.prof.tals[0]; expect(p.prof.slots[0]).toBe(start.uid);
    p.prof.tals.push({ uid: 50, kind: 'blades', lv: 1 });
    expect(doAction(w, p, { t: 'merge', uid: start.uid })).toMatch(/3장/);
    p.prof.tals.push({ uid: 51, kind: 'blades', lv: 1 }, { uid: 52, kind: 'wisp', lv: 1 });
    expect(doAction(w, p, { t: 'merge', uid: 50 })).toBeNull();
    const blades = p.prof.tals.filter(t => t.kind === 'blades'); expect(blades.length).toBe(1); expect(blades[0].lv).toBe(2); expect(blades[0].uid).toBe(start.uid);
    expect(p.prof.slots[0]).toBe(start.uid); expect(p.prof.stats.merges).toBe(1);
  });
  it('slots unlock by level and one kind cannot occupy two slots', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'sword', 3, spotIn(w, 0));
    p.prof.tals.push({ uid: 60, kind: 'frost', lv: 1 }, { uid: 61, kind: 'blades', lv: 2 });
    expect(doAction(w, p, { t: 'talslot', slot: 2, uid: 60 })).toMatch(/레벨 7/);
    expect(doAction(w, p, { t: 'talslot', slot: 1, uid: 60 })).toBeNull();
    expect(doAction(w, p, { t: 'talslot', slot: 1, uid: 61 })).toBeNull(); // blades Lv2 into slot 1 → the Lv1 blades in slot 0 is removed
    expect(p.prof.slots.filter(s => s != null)).toEqual([61]);
  });
});

describe('gear & economy', () => {
  it('enhancing only works in town, costs gold and caps at +10', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'sword', 5, spotIn(w, 1, 2));
    const it = makeItem(new Rng(1), 99, 'weapon', 5, 2); p.prof.inv.push(it); expect(doAction(w, p, { t: 'equip', uid: 99 })).toBeNull();
    p.prof.gold = 1e9; expect(doAction(w, p, { t: 'enhance', uid: 99 })).toMatch(/마을/);
    const [tx, ty] = [w.map.spawn.x, w.map.spawn.y]; p.x = tx; p.y = ty; p.zone = zoneAt(w.map, tx, ty);
    const atk0 = p.stats.atk; const cost = enhanceCost(it);
    expect(doAction(w, p, { t: 'enhance', uid: 99 })).toBeNull(); expect(p.prof.gold).toBe(1e9 - cost); expect(p.stats.atk).toBeGreaterThan(atk0);
    for (let i = 0; i < 12; i++) doAction(w, p, { t: 'enhance', uid: 99 }); expect(p.prof.equip.weapon!.plus).toBe(10);
  });
  it('a full bag auto-sells the cheapest item instead of losing loot', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'archer', 5, spotIn(w, 0)); const r = new Rng(2);
    for (let i = 0; i < INV_MAX; i++) p.prof.inv.push(makeItem(r, 1000 + i, 'charm', 20, 3));
    const g0 = p.prof.gold; giveItem(w, p, 3, 0, 0);
    expect(p.prof.inv.length).toBe(INV_MAX); expect(p.prof.gold).toBeGreaterThan(g0);
  });
  it('rejects forged commands (unknown uids, bad slots, bulk sell of equipped gear)', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'sword', 12, spotIn(w, 0));
    expect(doAction(w, p, { t: 'equip', uid: 424242 })).toBeTruthy();
    expect(doAction(w, p, { t: 'talslot', slot: 9, uid: 1 })).toBeTruthy();
    expect(doAction(w, p, { t: 'tp', shrine: 3 })).toBeNull();
    const q = mkPlayer(w, 'sword', 1, spotIn(w, 0)); q.prof.shrines = [0]; expect(doAction(w, q, { t: 'tp', shrine: 3 })).toMatch(/발견/);
    expect(doAction(w, p, { t: 'sell', uids: new Array(100).fill(1) })).toBeTruthy();
    expect(() => doAction(w, p, { t: 'merge', uid: 'x' } as any)).not.toThrow();
  });
});

describe('quests', () => {
  it('the first story quest completes on 8 wisp kills and hands out its reward', () => {
    const w = mkWorld(); const at = spotIn(w, 1, 8); const p = mkPlayer(w, 'sword', 1, at); w.spatial.rebuild(w.mons.values());
    for (let i = 0; i < 8; i++) { const m = w.spawnMonster(MON_IDX.wisp, at[0] + 40, at[1], 1)!; hitMonster(w, p, m, 999); }
    expect(p.prof.quest.main).toBe(1); expect(p.prof.gold).toBeGreaterThanOrEqual(60);
    expect(p.priv.some(e => e.k === 'quest')).toBe(true);
  });
  it('state quests (level, slots) complete as soon as they are already satisfied', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'archer', 5, spotIn(w, 0)); p.prof.quest.main = 2; // "reach level 3"
    doAction(w, p, { t: 'autosell', r: 0 }); // any action path; then force re-check through a state change
    p.prof.tals.push({ uid: 77, kind: 'frost', lv: 1 }); doAction(w, p, { t: 'talslot', slot: 1, uid: 77 });
    expect(p.prof.quest.main).toBeGreaterThanOrEqual(4);
  });
});

describe('danger & safety', () => {
  it('telegraphed attacks only hit players still inside the marked area', () => {
    const w = mkWorld(); const at = spotIn(w, 1, 9); const a = mkPlayer(w, 'sword', 5, at), b = mkPlayer(w, 'sword', 5, [at[0] + 300, at[1]]);
    const m = w.spawnMonster(MON_IDX.boss_chief, at[0] + 600, at[1], 6)!;
    w.hazard({ sh: 0, x: at[0], y: at[1], r: 100, x2: 0, y2: 0, w: 0, dmg: 50, pct: 0, src: m.id, delay: 0.5 });
    const ha = a.hp, hb = b.hp; run(w, 0.6); expect(a.hp).toBeLessThan(ha); expect(b.hp).toBe(hb);
  });
  it("a hazard is cancelled when its caster dies first", () => {
    const w = mkWorld(); const at = spotIn(w, 1, 10); const a = mkPlayer(w, 'sword', 5, at);
    const m = w.spawnMonster(MON_IDX.bogwisp, at[0] + 700, at[1], 3)!;
    w.hazard({ sh: 0, x: at[0], y: at[1], r: 100, x2: 0, y2: 0, w: 0, dmg: 50, pct: 0, src: m.id, delay: 0.5 }); m.dead = true;
    const h0 = a.hp; run(w, 0.6); expect(a.hp).toBe(h0);
  });
  it('monsters never walk into the town, even when chasing', () => {
    const w = mkWorld(); const p = mkPlayer(w, 'archer', 1, [w.map.spawn.x, w.map.spawn.y]);
    const gate = spotIn(w, 1, 1); for (let i = 0; i < 30; i++) { const m = w.spawnMonster(MON_IDX.imp, gate[0] + (i % 5) * 20, gate[1] + Math.floor(i / 5) * 20, 1); if (m) { m.tgt = p.id; m.st = 'chase'; } }
    for (let t = 0; t < 400; t++) { w.step(); for (const m of w.mons.values()) expect(zoneAt(w.map, m.x, m.y)).not.toBe(0); }
  });
  it('spawns always match the zone the player is standing in', () => {
    const w = mkWorld(); mkPlayer(w, 'sword', 20, spotIn(w, 1, 12)); run(w, 20);
    for (const m of w.mons.values()) if (!m.boss && m.def.key !== 'goldgob') expect(MONSTERS[m.t].zone).toBe(1);
  });
});

describe('world boss event', () => {
  it('idle → warn → fight; HP scales with participants; everyone who fought is rewarded', () => {
    const w = mkWorld({ wbFirst: 1, wbInterval: 600 }); const at: [number, number] = [w.map.altar.x + 120, w.map.altar.y];
    const ps = [mkPlayer(w, 'sword', 10, at), mkPlayer(w, 'archer', 10, [at[0], at[1] + 60]), mkPlayer(w, 'shaman', 10, [at[0] - 240, at[1]])];
    ps.forEach(p => { p.prof.quest.main = 9; }); // "핏빛 달"
    run(w, 2); expect(w.wb.state).toBe('warn');
    run(w, 60); expect(w.wb.state).toBe('fight'); const boss = w.mons.get(w.wb.bossId)!; expect(boss.t).toBe(WORLD_BOSS);
    expect(boss.maxHp).toBeGreaterThan(6000);
    // everybody hits it until it dies
    w.spatial.rebuild(w.mons.values()); let guard = 0;
    while (!boss.dead && guard++ < 5000) { for (const p of ps) { p.hp = p.stats.maxHp; p.down = false; hitMonster(w, p, boss, 3); } w.step(); }
    expect(boss.dead).toBe(true); w.step();
    expect(w.wb.state).toBe('idle');
    for (const p of ps) { expect(p.prof.stats.worldBoss).toBe(1); expect(p.prof.quest.main).toBe(10); expect(p.prof.inv.length + Object.values(p.prof.equip).filter(Boolean).length).toBeGreaterThan(0); }
  });
});

describe('text & names', () => {
  it('sanitizes chat and names', () => {
    expect(cleanText('  안녕\u0000<script>  하세요  ', 60)).toBe('안녕script 하세요');
    expect(cleanText('시발 뭐야', 60)).not.toContain('시발');
    expect(cleanName('  달빛<b>검객</b>123456  ')).toBe('달빛b검객b123');
    expect(cleanName('')).toBe(''); expect(cleanName(42)).toBe('');
  });
});
