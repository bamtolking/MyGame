// Rules: items, stats, combat math, progression, skills, economy, saving, determinism.
import { describe, expect, it } from 'vitest';
import { AFFIXES, BASES, UNIQUES } from '../src/data/items';
import { CLASSES, SKILLS, xpToNext } from '../src/data/classes';
import { DT, Game } from '../src/sim/game';
import { baseOf, buyPrice, genItem, makeUnique, sellPrice, weaponDamage } from '../src/sim/items';
import { Rng } from '../src/sim/rng';
import { armorReduction, computeStats, sheetDps } from '../src/sim/stats';
import { emptyDmg, giveXp, hurtHero, hurtMonster } from '../src/sim/combat';
import { makeMonster } from '../src/sim/spawn';
import { tryCast } from '../src/sim/skills';
import { CLASS_IDS } from '../src/sim/types';
import type { ClassId, Item } from '../src/sim/types';

describe('items', () => {
  it('generates valid items across levels and rarities', () => {
    const rng = new Rng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const ilvl = 1 + (i % 40);
      const it = genItem(rng, i + 1, ilvl, { mf: (i % 5) * 50, cls: (['warrior', 'rogue', 'sorcerer'] as const)[i % 3] });
      seen.add(it.rarity);
      expect(it.name.length).toBeGreaterThan(0);
      expect(it.req).toBeGreaterThanOrEqual(1);
      const b = baseOf(it);
      expect(b.qlvl).toBeLessThanOrEqual(Math.max(1, ilvl) + (it.rarity === 'unique' ? 2 : 0));
      if (it.rarity !== 'unique') {
        const implicit = b.implicit?.length ?? 0;
        const rolled = it.mods.length - implicit;
        if (it.rarity === 'normal') expect(rolled).toBe(0);
        if (it.rarity === 'magic') { expect(rolled).toBeGreaterThanOrEqual(1); expect(rolled).toBeLessThanOrEqual(2); }
        if (it.rarity === 'rare') { expect(rolled).toBeGreaterThanOrEqual(3); expect(rolled).toBeLessThanOrEqual(6); }
        // no affix group twice
        const keys = it.mods.slice(implicit).map((m) => m.k);
        expect(new Set(keys).size).toBe(keys.length);
      }
      if (b.slot === 'ring' || b.slot === 'amulet') expect(it.rarity).not.toBe('normal');
      for (const m of it.mods) { expect(Number.isFinite(m.v)).toBe(true); if (m.v2 !== undefined) expect(m.v2).toBeGreaterThanOrEqual(m.v); }
      expect(sellPrice(it)).toBeGreaterThan(0);
      expect(buyPrice(it)).toBeGreaterThan(sellPrice(it));
    }
    expect([...seen].sort()).toEqual(['magic', 'normal', 'rare', 'unique']);
  });
  it('affix tiers are ordered and every unique points at a real base', () => {
    for (const a of AFFIXES) for (let i = 1; i < a.tiers.length; i++) { expect(a.tiers[i].lvl).toBeGreaterThan(a.tiers[i - 1].lvl); expect(a.tiers[i].max).toBeGreaterThanOrEqual(a.tiers[i - 1].max); }
    const rng = new Rng(1);
    for (const u of UNIQUES) { const it = makeUnique(rng, 1, u.id, 30); expect(it.name).toBe(u.name); expect(baseOf(it)).toBeTruthy(); }
    expect(new Set(BASES.map((b) => b.id)).size).toBe(BASES.length);
  });
  it('enhanced damage raises weapon damage', () => {
    const it: Item = { uid: 1, base: 'longSword', rarity: 'magic', ilvl: 5, req: 1, name: 'x', mods: [{ k: 'ed', v: 100 }], dmg: [5, 12] };
    expect(weaponDamage(it)).toEqual([10, 24]);
  });
});

describe('hero stats & combat', () => {
  it('all classes start alive with sane stats and a weapon', () => {
    for (const cls of CLASS_IDS) {
      const g = new Game(cls, 't', 1);
      const st = g.hero.st;
      expect(st.maxHp).toBeGreaterThan(50);
      expect(st.maxMp).toBeGreaterThan(10);
      expect(g.hero.equip.weapon).not.toBeNull();
      expect(sheetDps(st)).toBeGreaterThan(3);
      expect(g.world.floor).toBe(0);
      expect(g.hero.skills[CLASSES[cls].skills[0]]).toBe(1);
    }
  });
  it('armor and resistance reduce damage; block and dodge can negate it', () => {
    const g = new Game('warrior', 't', 2);
    g.enterFloor(1, 'start');
    const h = g.hero;
    h.equip.offhand = null; g.refreshStats();
    const m = makeMonster(g.world, 'skeleton', 10, 'normal', [], h.x + 1, h.y, g.rng);
    const hp0 = h.hp;
    const dealt1 = hurtHero(g, { ...emptyDmg(), phys: 50 }, m, 'melee');
    expect(dealt1).toBeLessThan(50);
    expect(dealt1).toBeCloseTo(50 * (1 - armorReduction(h.st.armor, 10)), 5);
    expect(h.hp).toBeCloseTo(hp0 - dealt1, 5);
    const fire0 = hurtHero(g, { ...emptyDmg(), fire: 40 }, m, 'area');
    h.equip.ring1 = { uid: 5, base: 'ring', rarity: 'magic', ilvl: 5, req: 1, name: 'r', mods: [{ k: 'resFire', v: 50 }] }; g.refreshStats();
    const fire1 = hurtHero(g, { ...emptyDmg(), fire: 40 }, m, 'area');
    expect(fire1).toBeLessThan(fire0);
    expect(armorReduction(1e9, 1)).toBeLessThanOrEqual(0.8);
  });
  it('monster resistances and death give xp and can drop loot', () => {
    const g = new Game('sorcerer', 't', 3);
    g.enterFloor(2, 'start');
    const m = makeMonster(g.world, 'fireSpirit', 5, 'champion', [], g.hero.x + 2, g.hero.y, g.rng);
    const before = m.hp;
    hurtMonster(g, m, { ...emptyDmg(), fire: 100, src: 0 });
    expect(before - m.hp).toBeCloseTo(100 * (1 - m.res.fire / 100), 5);
    const drops0 = g.world.drops.length;
    const xp0 = g.hero.xp + xpToNext(1) * (g.hero.level - 1);
    hurtMonster(g, m, { ...emptyDmg(), phys: 1e6, src: 0 });
    expect(m.dead).toBe(true);
    expect(g.hero.xp + xpToNext(1) * (g.hero.level - 1)).toBeGreaterThan(xp0);
    expect(g.world.drops.length).toBeGreaterThan(drops0);
  });
  it('level up grants 5 stat points and 1 skill point and heals', () => {
    const g = new Game('rogue', 't', 4);
    g.hero.hp = 1;
    giveXp(g, xpToNext(1) + 1);
    expect(g.hero.level).toBe(2);
    expect(g.hero.freePts).toBe(5);
    expect(g.hero.skillPts).toBe(1);
    expect(g.hero.hp).toBe(g.hero.st.maxHp);
    g.allocAttr('vit', 5);
    expect(g.hero.freePts).toBe(0);
    expect(g.learnSkill(0)).toBe(true);
    expect(g.hero.skills.multishot).toBe(2);
    expect(g.learnSkill(1)).toBe(false); // needs level 3
  });
});

describe('skills', () => {
  it('casting spends mana, applies cooldown and hits monsters', () => {
    const g = new Game('sorcerer', 't', 7);
    g.enterFloor(1, 'start');
    const h = g.hero;
    h.level = 20; h.skills = { fireball: 5, frostnova: 5, chain: 5, teleport: 3, meteor: 3 }; g.refreshStats();
    h.mp = h.st.maxMp;
    for (const m of g.world.monsters) m.dead = true;
    const m = makeMonster(g.world, 'zombie', 1, 'normal', [], h.x + 1.2, h.y, g.rng);
    m.hp = m.maxHp = 1e6;
    const mp0 = h.mp;
    expect(tryCast(g, 1, h.x, h.y, 0)).toBe('ok');
    expect(h.mp).toBeLessThan(mp0);
    expect(h.cds[1]).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) g.update(DT);
    expect(m.hp).toBeLessThan(1e6);
    expect(m.freezeT + m.chillT).toBeGreaterThan(0);
    expect(tryCast(g, 1, h.x, h.y, 0)).toBe('cooldown');
    h.mp = 0;
    expect(tryCast(g, 0, m.x, m.y, m.id)).toBe('nomana');
  });
  it('every class skill can be cast at max rank without errors', () => {
    for (const cls of CLASS_IDS) {
      const g = new Game(cls, 't', 9);
      g.enterFloor(4, 'start');
      const h = g.hero;
      h.level = 30;
      for (const id of CLASSES[cls].skills) h.skills[id] = 10;
      g.refreshStats();
      for (let slot = 0; slot < 5; slot++) {
        h.mp = h.st.maxMp; h.cds = [0, 0, 0, 0, 0]; h.act = null;
        const r = tryCast(g, slot, h.x + 2, h.y + 1, 0);
        expect(['ok', 'approach', 'invalid']).toContain(r);
        for (let i = 0; i < 120; i++) g.update(DT);
      }
    }
  });
  it('every class skill works against a pack of monsters next to the hero (and with a corpse nearby)', () => {
    for (const cls of CLASS_IDS) {
      const g = new Game(cls, 't', 21);
      g.enterFloor(2, 'start');
      const h = g.hero;
      h.level = 30; h.attrs.vit += 400;
      for (const id of CLASSES[cls].skills) h.skills[id] = 8;
      g.refreshStats(); h.hp = h.st.maxHp;
      // pull a few monsters around the hero; kill one to leave a corpse
      const pack = g.world.monsters.filter((m) => !m.dead && m.rank !== 'boss').slice(0, 5);
      pack.forEach((m, i) => { m.x = h.x + 1.1 + (i % 2) * 0.7; m.y = h.y + (i - 2) * 0.6; m.awake = true; });
      for (let slot = -1; slot < 5; slot++) {
        const alive = g.world.monsters.filter((m) => !m.dead && Math.hypot(m.x - h.x, m.y - h.y) < 5);
        if (alive.length < 2) { const more = g.world.monsters.filter((m) => !m.dead && m.rank !== 'boss').slice(0, 3); more.forEach((m, i) => { m.x = h.x + 1.2; m.y = h.y + (i - 1) * 0.7; m.awake = true; }); }
        const corpse = g.world.monsters.find((m) => !m.dead && m.rank === 'normal' && Math.hypot(m.x - h.x, m.y - h.y) < 4);
        if (corpse) { corpse.hp = 1; g.hero.st && g.update(DT); }
        const t = g.world.monsters.find((m) => !m.dead && Math.hypot(m.x - h.x, m.y - h.y) < 4)!;
        h.mp = h.st.maxMp; h.cds = [0, 0, 0, 0, 0]; h.act = null; h.hp = h.st.maxHp; h.dead = false;
        const r = tryCast(g, slot, t.x, t.y, t.id);
        expect(['ok', 'approach', 'invalid'], `${cls} slot ${slot}`).toContain(r);
        for (let i = 0; i < 150; i++) g.update(DT);
        expect(Number.isFinite(h.x) && Number.isFinite(h.y), `${cls} slot ${slot} position`).toBe(true);
        for (const m of g.world.monsters) expect(Number.isFinite(m.hp), `${cls} slot ${slot} monster hp`).toBe(true);
      }
    }
  });
});

describe('economy, inventory, travel and saving', () => {
  it('buy, sell, equip, stash and potions', () => {
    const g = new Game('warrior', 't', 11);
    const h = g.hero;
    h.gold = 100000; h.level = 5; g.refreshStats();
    const n0 = h.inv.filter(Boolean).length;
    g.buy(0);
    expect(h.inv.filter(Boolean).length).toBe(n0 + 1);
    const idx = h.inv.findIndex(Boolean);
    const gold = h.gold;
    g.sell(idx);
    expect(h.gold).toBeGreaterThan(gold);
    g.buyPotion('hp', 3);
    expect(h.potHp).toBe(7);
    // equip a two-hander removes the shield into the bag
    h.inv[0] = genItem(g.rng, 900, 5, { base: 'greatSword', rarity: 'normal' });
    expect(h.equip.offhand).not.toBeNull();
    g.equipFromInv(0);
    expect(baseOf(h.equip.weapon!).id).toBe('greatSword');
    expect(h.equip.offhand).toBeNull();
    expect(h.inv.some((it) => it && baseOf(it).cat === 'shield')).toBe(true);
    // class restriction
    h.inv[5] = genItem(g.rng, 901, 5, { base: 'longBow', rarity: 'normal' });
    expect(g.equipFromInv(5)).toBe(false);
    // stash
    g.stashPut(5);
    expect(g.stash.filter(Boolean).length).toBe(1);
    g.stashTake(g.stash.findIndex(Boolean));
    expect(g.stash.filter(Boolean).length).toBe(0);
  });
  it('stairs, sealed boss stairs, portal and waypoint', () => {
    const g = new Game('rogue', 't', 12);
    g.takeStairs(1);
    expect(g.world.floor).toBe(1);
    g.enterFloor(3, 'start');
    g.takeStairs(1);
    expect(g.world.floor).toBe(3); // sealed until the bishop dies
    g.useScroll();
    const p = g.world.props.find((q) => q.kind === 'portal')!;
    expect(p).toBeTruthy();
    g.setIntent({ type: 'interact', kind: 'prop', id: p.id, x: p.x, y: p.y });
    for (let i = 0; i < 400 && g.world.floor !== 0; i++) g.update(DT);
    expect(g.world.floor).toBe(0);
    const tp = g.world.props.find((q) => q.kind === 'portal')!;
    g.setIntent({ type: 'interact', kind: 'prop', id: tp.id, x: tp.x, y: tp.y });
    for (let i = 0; i < 600 && g.world.floor !== 3; i++) g.update(DT);
    expect(g.world.floor).toBe(3);
    expect(g.travel(2)).toBe(true);
    expect(g.world.floor).toBe(2);
    expect(g.travel(9)).toBe(false);
  });
  it('save round-trip restores the hero exactly', () => {
    const g = new Game('sorcerer', '마법사', 13);
    g.hero.level = 12; g.hero.gold = 777; g.hero.attrs.ene = 80; g.hero.skills.chain = 4; g.maxFloor[0] = 8; g.unlockedDiff = 1;
    g.hero.inv[3] = genItem(g.rng, g.nextUid++, 12, { rarity: 'rare' });
    const s = JSON.parse(JSON.stringify(g.toSave()));
    const g2 = new Game('sorcerer', 'x', s.seed, s);
    expect(g2.hero.name).toBe('마법사');
    expect(g2.hero.level).toBe(12);
    expect(g2.hero.gold).toBe(777);
    expect(g2.hero.attrs.ene).toBe(80);
    expect(g2.hero.skills.chain).toBe(4);
    expect(g2.hero.inv[3]).toEqual(g.hero.inv[3]);
    expect(g2.maxFloor[0]).toBe(8);
    expect(g2.unlockedDiff).toBe(1);
    expect(computeStats(g2.hero, 0).maxMp).toBe(computeStats(g.hero, 0).maxMp);
  });
  it('same seed and same inputs give the same run', () => {
    const run = () => {
      const g = new Game('warrior', 't', 99);
      g.enterFloor(1, 'start');
      for (let i = 0; i < 60 * 40; i++) {
        if (i % 30 === 0) { const m = g.world.monsters.find((q) => !q.dead); if (m) g.setIntent({ type: 'attack', id: m.id, hold: true }); }
        g.update(DT);
      }
      return { x: g.hero.x, y: g.hero.y, hp: g.hero.hp, kills: g.hero.kills, xp: g.hero.xp, drops: g.world.drops.length };
    };
    expect(run()).toEqual(run());
  });
});
