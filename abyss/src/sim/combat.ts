// Damage rolls and application, deaths, loot, props, projectiles and area effects.
import { MAX_LEVEL, STAT_PTS_PER_LEVEL, xpToNext } from '../data/classes';
import { UNIQUES } from '../data/items';
import { BOSS_LINES, MONSTERS } from '../data/monsters';
import { LAST_FLOOR, LOOT, MAX_POTIONS, SHRINES } from '../data/zones';
import { genItem, makeUnique } from './items';
import { circleFree, los, nearestWalkable, opaque } from './path';
import { makeMonster } from './spawn';
import { armorReduction, computeStats } from './stats';
import type { Game } from './game';
import type { Area, AreaKind, Dmg, Elem, Item, Monster, Prop, Proj, ProjKind } from './types';

export const emptyDmg = (): Dmg => ({ phys: 0, fire: 0, cold: 0, light: 0, poison: 0 });
const HIT_ELEMS: Exclude<Elem, 'poison'>[] = ['phys', 'fire', 'cold', 'light'];

export function scaleDmg(d: Dmg, k: number): Dmg {
  return { ...d, phys: d.phys * k, fire: d.fire * k, cold: d.cold * k, light: d.light * k, poison: d.poison * k };
}

/** A hero hit worth pct% of a weapon swing, optionally converting the weapon portion to an element. */
export function heroRoll(g: Game, pct: number, conv: Elem | null = null, varianceLight = false): Dmg {
  const st = g.hero.st, r = g.rng;
  const mult = (pct / 100) * st.dmgMult;
  const d = emptyDmg();
  const p = r.range(st.wMin, st.wMax + 0.999) * mult;
  if (conv && conv !== 'phys') d[conv] += p; else d.phys += p;
  d.fire += r.range(st.adds.fire[0], st.adds.fire[1] + 0.999) * mult * (st.adds.fire[1] > 0 ? 1 : 0);
  d.cold += r.range(st.adds.cold[0], st.adds.cold[1] + 0.999) * mult * (st.adds.cold[1] > 0 ? 1 : 0);
  d.light += r.range(st.adds.light[0], st.adds.light[1] + 0.999) * mult * (st.adds.light[1] > 0 ? 1 : 0);
  d.poison += st.adds.poison[0] * mult;
  if (varianceLight) d.light *= r.range(0.35, 1.65);
  if (st.adds.cold[1] > 0) d.chill = 1.2;
  if (r.chance(st.crit / 100)) { const k = st.critMult; d.phys *= k; d.fire *= k; d.cold *= k; d.light *= k; d.poison *= k; d.crit = true; }
  d.src = 0; d.srcX = g.hero.x; d.srcY = g.hero.y;
  return d;
}

function dominant(d: Dmg): Elem {
  let best: Elem = 'phys', bv = d.phys;
  for (const e of ['fire', 'cold', 'light', 'poison'] as Elem[]) if (d[e] > bv) { bv = d[e]; best = e; }
  return best;
}

export function wake(g: Game, m: Monster): void {
  if (m.awake) return;
  m.awake = true;
  for (const o of g.world.monsters) {
    if (o.dead || o.awake) continue;
    if ((m.packId && o.packId === m.packId) || Math.hypot(o.x - m.x, o.y - m.y) < 4) o.awake = true;
  }
}

export function hurtMonster(g: Game, m: Monster, d: Dmg): number {
  if (m.dead) return 0;
  const boss = m.rank === 'boss';
  let total = 0;
  for (const e of HIT_ELEMS) { const v = d[e]; if (v > 0) total += v * (1 - m.res[e] / 100); }
  if (d.poison > 0) {
    const pv = d.poison * (1 - m.res.poison / 100);
    if (pv > 0 && (!m.poison || m.poison.dps * m.poison.t < pv)) m.poison = { dps: pv / 3, t: 3 };
  }
  total = Math.max(0, total);
  m.hp -= total;
  m.hitT = 0.18;
  m.lastHitBy = d.src ?? 0;
  wake(g, m);
  if (d.stun) { m.stunT = Math.max(m.stunT, boss ? d.stun * 0.2 : d.stun); if (!boss) m.act = null; }
  if (d.freeze) {
    if (boss || m.rank === 'unique') m.chillT = Math.max(m.chillT, d.freeze * 2);
    else { m.freezeT = Math.max(m.freezeT, d.freeze); m.act = null; }
  }
  if (d.chill) m.chillT = Math.max(m.chillT, d.chill);
  if (d.kb && !boss && d.srcX !== undefined && d.srcY !== undefined) {
    const dx = m.x - d.srcX, dy = m.y - d.srcY, l = Math.hypot(dx, dy) || 1;
    const k = d.kb * (m.rank === 'unique' || m.rank === 'champion' ? 0.5 : 1) * 7;
    m.kbx += (dx / l) * k; m.kby += (dy / l) * k;
  }
  const h = g.hero;
  if (d.src === 0 && !d.noLeech && total > 0) {
    if (h.st.lifeSteal > 0) h.hp = Math.min(h.st.maxHp, h.hp + Math.min(total * h.st.lifeSteal / 100, h.st.maxHp * 0.08));
    if (h.st.manaSteal > 0) h.mp = Math.min(h.st.maxMp, h.mp + Math.min(total * h.st.manaSteal / 100, h.st.maxMp * 0.08));
  }
  if (total >= 0.5 || d.crit) g.emit({ t: 'dmg', x: m.x, y: m.y, v: Math.round(total), kind: d.crit ? 'crit' : 'normal', elem: dominant(d) });
  if (m.res.phys >= 75 && d.phys > 0 && total < 1) g.emit({ t: 'dmg', x: m.x, y: m.y, v: 0, kind: 'immune' });
  g.emit({ t: 'hit', id: m.id });
  if (m.mods.includes('lightEnch') && g.rng.chance(0.3)) {
    const n = g.rng.irange(3, 5);
    for (let i = 0; i < n; i++) {
      const a = g.rng.range(0, Math.PI * 2);
      spawnProj(g, 'spark', 'mon', m.x, m.y, Math.cos(a) * 5, Math.sin(a) * 5, { ...emptyDmg(), light: (m.dmg[0] + m.dmg[1]) * 0.35, src: m.id }, { life: 1.4, r: 0.2 });
    }
  }
  if (m.hp <= 0) killMonster(g, m);
  return total;
}

export function hurtHero(g: Game, d: Dmg, attacker: Monster | null, kind: 'melee' | 'proj' | 'area'): number {
  const h = g.hero;
  if (h.dead || h.invulnT > 0) return 0;
  const st = h.st;
  if (st.dodge > 0 && kind !== 'area' && g.rng.chance(st.dodge / 100)) { g.emit({ t: 'dmg', x: h.x, y: h.y, v: 0, kind: 'dodge' }); return 0; }
  if (st.block > 0 && kind !== 'area' && g.rng.chance(st.block / 100)) {
    h.blockT = 0.25;
    g.emit({ t: 'dmg', x: h.x, y: h.y, v: 0, kind: 'block' });
    g.emit({ t: 'sfx', id: 'block' });
    return 0;
  }
  const lvl = attacker?.lvl ?? g.world.mlvl;
  const phys = d.phys * (1 - armorReduction(st.armor, lvl));
  const el = d.fire * (1 - st.res.fire / 100) + d.cold * (1 - st.res.cold / 100) + d.light * (1 - st.res.light / 100) + d.poison * (1 - st.res.poison / 100);
  let total = phys + el - st.dmgReduce;
  if (total < 1) total = phys + el > 0 ? 1 : 0;
  h.hp -= total;
  h.hitT = 0.25;
  if (d.cold > 0 || d.chill) h.chillT = Math.max(h.chillT, d.chill ?? 1.2);
  g.emit({ t: 'dmg', x: h.x, y: h.y, v: Math.round(total), kind: 'hero', elem: dominant(d) });
  if (total > st.maxHp * 0.12) g.emit({ t: 'shake', v: Math.min(1, total / st.maxHp) });
  g.emit({ t: 'sfx', id: 'heroHit' });
  if (attacker && !attacker.dead) {
    if (kind === 'melee' && st.thorns > 0) hurtMonster(g, attacker, { ...emptyDmg(), phys: st.thorns, src: 0, noLeech: true });
    if (attacker.mods.includes('vampiric')) attacker.hp = Math.min(attacker.maxHp, attacker.hp + total * 0.6);
  }
  if (h.hp <= 0) heroDie(g);
  return total;
}

export function heroDie(g: Game): void {
  const h = g.hero;
  if (h.dead) return;
  h.hp = 0; h.dead = true; h.deadT = 0; h.act = null; h.intent = null; h.path = null;
  h.deaths++;
  g.emit({ t: 'death' });
  g.emit({ t: 'sfx', id: 'heroDeath' });
}

export function giveXp(g: Game, amount: number): void {
  const h = g.hero;
  if (h.level >= MAX_LEVEL) return;
  h.xp += Math.max(1, Math.round(amount));
  let leveled = false;
  while (h.level < MAX_LEVEL && h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level);
    h.level++;
    h.freePts += STAT_PTS_PER_LEVEL;
    h.skillPts += 1;
    leveled = true;
    g.emit({ t: 'levelup', level: h.level });
  }
  if (leveled) {
    h.st = computeStats(h, g.diff);
    h.hp = h.st.maxHp; h.mp = h.st.maxMp;
    g.emit({ t: 'sfx', id: 'levelup' });
    g.emit({ t: 'fx', kind: 'levelup', x: h.x, y: h.y });
    g.emit({ t: 'msg', text: `레벨 ${h.level} 달성! 능력치·기술 포인트를 분배하세요`, color: '#ffe080', big: true });
  }
  if (h.level >= MAX_LEVEL) h.xp = 0;
}

export function killMonster(g: Game, m: Monster): void {
  if (m.dead) return;
  const w = g.world, h = g.hero, rng = g.rng;
  m.dead = true; m.hp = 0; m.deadT = 0; m.act = null; m.poison = null; m.burn = null; m.freezeT = 0;
  g.emit({ t: 'sfx', id: 'die_' + MONSTERS[m.tpl].art, x: m.x, y: m.y });
  g.emit({ t: 'fx', kind: MONSTERS[m.tpl].undead ? 'bones' : 'blood', x: m.x, y: m.y, n: m.rank === 'boss' ? 40 : 12 });
  if (!m.summoned) {
    const gap = h.level - m.lvl;
    const pen = gap > 5 ? Math.max(0.1, 1 - 0.1 * (gap - 5)) : 1;
    const shrine = h.buffs.some((b) => b.id === 'shrineXp') ? 1.25 : 1;
    giveXp(g, m.xp * pen * shrine);
    monsterDrops(g, m);
  }
  h.kills++;
  if (h.st.lifeKill) h.hp = Math.min(h.st.maxHp, h.hp + h.st.lifeKill);
  if (h.st.manaKill) h.mp = Math.min(h.st.maxMp, h.mp + h.st.manaKill);
  if (m.mods.includes('fireEnch')) addArea(g, 'stomp', 'mon', m.x, m.y, 2.2, 0.01, { ...emptyDmg(), fire: (m.dmg[0] + m.dmg[1]) * 0.9, src: m.id }, { delay: 0.35, data: { fire: 1 } });
  if (m.mods.includes('coldEnch')) addArea(g, 'nova', 'mon', m.x, m.y, 3.2, 0.5, { ...emptyDmg(), cold: (m.dmg[0] + m.dmg[1]) * 0.6, chill: 2, src: m.id }, { data: { cold: 1 } });
  // fallen flee when a pack mate falls
  for (const o of w.monsters) {
    if (o.dead || o === m || MONSTERS[o.tpl].ai !== 'swarm') continue;
    if (Math.hypot(o.x - m.x, o.y - m.y) < 6 && rng.chance(m.tpl === 'shaman' ? 0.9 : 0.35)) o.fleeT = rng.range(1.5, 3);
  }
  if (m.id === w.bossId) {
    w.downSealed = false;
    for (const o of w.monsters) if (o.summoned && !o.dead) killMonster(g, o);
    g.bosses[m.tpl] = (g.bosses[m.tpl] ?? 0) + 1;
    const final = w.floor === LAST_FLOOR;
    g.emit({ t: 'bossDead', name: m.name, final });
    g.emit({ t: 'msg', text: BOSS_LINES[m.tpl]?.death ?? '', color: '#ff9070' });
    g.emit({ t: 'shake', v: 1 });
    g.emit({ t: 'sfx', id: 'bossDeath' });
    if (final) {
      if (g.unlockedDiff < 2 && g.unlockedDiff === g.diff) g.unlockedDiff = g.diff + 1;
      g.emit({ t: 'victory', diff: g.diff });
    } else g.emit({ t: 'msg', text: '봉인이 풀렸습니다. 아래층으로 가는 계단이 열렸습니다.', color: '#ffd080' });
  }
}

// ---------------------------------------------------------------- loot
function dropSpot(g: Game, x: number, y: number, spread = 1.3): { x: number; y: number } {
  for (let k = 0; k < 12; k++) {
    const a = g.rng.range(0, Math.PI * 2), r = g.rng.range(0.2, spread);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (circleFree(g.world, px, py, 0.15)) return { x: px, y: py };
  }
  return nearestWalkable(g.world, x, y, 4) ?? { x, y };
}

export function dropItem(g: Game, it: Item, x: number, y: number): void {
  const p = dropSpot(g, x, y);
  g.world.drops.push({ id: g.world.nextId++, x: p.x, y: p.y, item: it, t: 0 });
  g.emit({ t: 'itemDrop', rarity: it.rarity, x: p.x, y: p.y });
}
export function dropGold(g: Game, amount: number, x: number, y: number): void {
  const p = dropSpot(g, x, y);
  g.world.drops.push({ id: g.world.nextId++, x: p.x, y: p.y, gold: Math.max(1, Math.round(amount)), t: 0 });
}
export function dropPot(g: Game, kind: 'hp' | 'mp' | 'scroll', x: number, y: number): void {
  const p = dropSpot(g, x, y);
  g.world.drops.push({ id: g.world.nextId++, x: p.x, y: p.y, pot: kind, t: 0 });
}

function rollItems(g: Game, n: number, ilvl: number, bonus: number, x: number, y: number, minRare = 0): void {
  const st = g.hero.st;
  for (let i = 0; i < n; i++) {
    const it = genItem(g.rng, g.nextUid++, ilvl, { cls: g.hero.cls, mf: st.mf, bonus, minRarity: i < minRare ? 'rare' : undefined });
    dropItem(g, it, x, y);
  }
}

export function monsterDrops(g: Game, m: Monster): void {
  const rng = g.rng, r = m.rank, st = g.hero.st;
  const goldMul = r === 'boss' ? 12 : r === 'unique' ? 3 : r === 'champion' ? 2 : 1;
  if (rng.chance(LOOT.goldChance[r])) dropGold(g, rng.range(2, 7) * (1 + m.lvl * 0.8) * goldMul * (1 + st.gf / 100), m.x, m.y);
  if (rng.chance(LOOT.potChance[r])) {
    const n = r === 'boss' ? 3 : 1;
    for (let i = 0; i < n; i++) dropPot(g, rng.chance(g.hero.cls === 'sorcerer' ? 0.5 : 0.68) ? 'hp' : 'mp', m.x, m.y);
  }
  if (rng.chance(r === 'normal' ? 0.012 : 0.2)) dropPot(g, 'scroll', m.x, m.y);
  if (rng.chance(LOOT.itemChance[r])) {
    const n = LOOT.itemCount[r] + (r === 'boss' ? g.diff : 0);
    rollItems(g, n, m.lvl + (r === 'boss' ? 2 : 0), LOOT.eliteBonus[r], m.x, m.y, r === 'boss' ? 2 : r === 'unique' ? 1 : 0);
  }
  if (r === 'boss') {
    const u = UNIQUES.find((x) => x.bossOnly === m.tpl);
    if (u && rng.chance(0.45)) dropItem(g, makeUnique(rng, g.nextUid++, u.id, m.lvl), m.x, m.y);
  }
}

// ---------------------------------------------------------------- props
export function useProp(g: Game, p: Prop): void {
  if (p.used) return;
  const rng = g.rng, w = g.world, h = g.hero;
  const unblock = () => { if (p.blocks) { w.block[Math.floor(p.y) * w.w + Math.floor(p.x)] = 0; p.blocks = false; } };
  switch (p.kind) {
    case 'barrel': case 'crate': {
      if (w.floor === 0) return;
      p.used = true; unblock();
      g.emit({ t: 'sfx', id: 'barrel' });
      g.emit({ t: 'fx', kind: 'splinters', x: p.x, y: p.y, n: 14 });
      const roll = rng.next();
      if (roll < 0.3) dropGold(g, rng.range(2, 6) * (1 + w.mlvl * 0.6), p.x, p.y);
      else if (roll < 0.4) dropPot(g, rng.chance(0.6) ? 'hp' : 'mp', p.x, p.y);
      else if (roll < 0.47) rollItems(g, 1, w.mlvl, 1, p.x, p.y);
      else if (roll < 0.5 && w.floor >= 2) { // ambush!
        const pool = ['skeleton', 'zombie', 'ghoul', 'goatman', 'hound'];
        const tpl = pool[Math.min(pool.length - 1, w.zone)];
        const m = makeMonster(w, tpl, w.mlvl, 'normal', [], p.x, p.y, rng); m.awake = true;
      }
      break;
    }
    case 'chest': case 'bigchest': {
      p.used = true;
      g.emit({ t: 'sfx', id: 'chest' });
      const big = p.kind === 'bigchest';
      dropGold(g, rng.range(4, 10) * (1 + w.mlvl) * (big ? 4 : 1), p.x, p.y + 0.8);
      rollItems(g, big ? rng.irange(3, 4) : rng.irange(1, 2), w.mlvl + (big ? 1 : 0), big ? 2.5 : 1.5, p.x, p.y + 0.6, big ? 1 : 0);
      if (rng.chance(0.4)) dropPot(g, 'hp', p.x, p.y + 0.8);
      break;
    }
    case 'sarco': {
      p.used = true;
      g.emit({ t: 'sfx', id: 'stone' });
      if (rng.chance(0.55)) rollItems(g, 1, w.mlvl, 1.3, p.x, p.y + 0.8);
      if (rng.chance(0.4)) dropGold(g, rng.range(3, 8) * (1 + w.mlvl * 0.7), p.x, p.y + 0.8);
      if (rng.chance(0.25)) {
        const n = rng.irange(1, 3);
        for (let i = 0; i < n; i++) { const m = makeMonster(w, 'skeleton', w.mlvl, 'normal', [], p.x + rng.range(-1, 1), p.y + 1, rng); m.awake = true; if (!circleFree(w, m.x, m.y, 0.3)) { const s = nearestWalkable(w, m.x, m.y, 3); if (s) { m.x = s.x; m.y = s.y; } } }
        g.emit({ t: 'msg', text: '관 속에서 망자가 깨어났다!', color: '#ff8080' });
      }
      break;
    }
    case 'shrine': {
      p.used = true;
      const s = SHRINES[p.variant % SHRINES.length];
      g.emit({ t: 'sfx', id: 'shrine' });
      g.emit({ t: 'fx', kind: 'shrine', x: p.x, y: p.y, c: s.color });
      g.emit({ t: 'msg', text: `${s.name}: ${s.desc}`, color: s.color, big: true });
      if (s.id === 'heal') { h.hp = h.st.maxHp; h.mp = h.st.maxMp; }
      else {
        const dur = s.id === 'shrineXp' || s.id === 'shrineMf' ? 120 : 60;
        const v = s.id === 'shrineDmg' ? 30 : s.id === 'shrineArmor' ? 60 : s.id === 'shrineXp' ? 25 : s.id === 'shrineMf' ? 75 : 20;
        h.buffs = h.buffs.filter((b) => b.id !== s.id);
        h.buffs.push({ id: s.id, t: dur, dur, v });
        h.dirty = true;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- projectiles
export function spawnProj(g: Game, kind: ProjKind, side: 'hero' | 'mon', x: number, y: number, vx: number, vy: number, dmg: Dmg, o: Partial<Proj> = {}): Proj {
  const p: Proj = { id: g.world.nextId++, kind, side, x, y, vx, vy, r: 0.18, dmg, life: 1.6, pierce: 0, hit: [], aoe: 0, aoeMult: 0.8, homing: 0, targetId: 0, src: dmg.src ?? 0, age: 0, ...o };
  g.world.projs.push(p);
  return p;
}

function explode(g: Game, p: Proj, x: number, y: number, directId: number): void {
  const k: string = p.kind === 'fireball' || p.kind === 'explode' || p.kind === 'meteor' ? 'explosion' : p.kind === 'frost' ? 'frostburst' : 'burst';
  g.emit({ t: 'fx', kind: k, x, y, r: p.aoe });
  g.emit({ t: 'sfx', id: 'explode', x, y });
  if (p.side === 'hero') {
    for (const m of g.world.monsters) {
      if (m.dead || m.id === directId) continue;
      if (Math.hypot(m.x - x, m.y - y) <= p.aoe + m.r) hurtMonster(g, m, scaleDmg(p.dmg, p.aoeMult));
    }
    breakPropsNear(g, x, y, p.aoe);
  } else if (Math.hypot(g.hero.x - x, g.hero.y - y) <= p.aoe + g.hero.r && g.hero.id !== directId) {
    hurtHero(g, scaleDmg(p.dmg, p.aoeMult), null, 'area');
  }
}

export function breakPropsNear(g: Game, x: number, y: number, r: number): void {
  if (g.world.floor === 0) return;
  for (const p of g.world.props) {
    if (p.used || (p.kind !== 'barrel' && p.kind !== 'crate')) continue;
    if (Math.hypot(p.x - x, p.y - y) <= r + 0.4) useProp(g, p);
  }
}

function propAt(g: Game, x: number, y: number): Prop | null {
  const tx = Math.floor(x), ty = Math.floor(y);
  for (const p of g.world.props) if (!p.used && p.blocks && Math.floor(p.x) === tx && Math.floor(p.y) === ty) return p;
  return null;
}

export function updateProjs(g: Game, dt: number): void {
  const w = g.world, h = g.hero;
  const keep: Proj[] = [];
  for (const p of w.projs) {
    p.age += dt; p.life -= dt;
    if (p.homing > 0) {
      const t = p.side === 'hero' ? (p.targetId ? w.monsters.find((m) => m.id === p.targetId && !m.dead) : undefined) : h.dead ? undefined : h;
      if (t) {
        const sp = Math.hypot(p.vx, p.vy);
        const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, p.homing * dt);
        p.vx = p.vx * (1 - k) + (dx / l) * sp * k; p.vy = p.vy * (1 - k) + (dy / l) * sp * k;
        const nl = Math.hypot(p.vx, p.vy) || 1; p.vx = (p.vx / nl) * sp; p.vy = (p.vy / nl) * sp;
      }
    }
    let alive = p.life > 0;
    const dist = Math.hypot(p.vx, p.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 0.2));
    for (let s = 0; s < n && alive; s++) {
      const px = p.x, py = p.y;
      p.x += (p.vx * dt) / n; p.y += (p.vy * dt) / n;
      const tx = Math.floor(p.x), ty = Math.floor(p.y);
      if (opaque(w, tx, ty) || !los(w, px, py, p.x, p.y)) {
        if (p.aoe > 0) explode(g, p, p.x - (p.vx * dt) / n, p.y - (p.vy * dt) / n, -1);
        else g.emit({ t: 'fx', kind: 'spark', x: p.x, y: p.y, c: p.kind });
        alive = false; break;
      }
      if (p.side === 'hero') {
        const pr = propAt(g, p.x, p.y);
        if (pr && (pr.kind === 'barrel' || pr.kind === 'crate')) { useProp(g, pr); if (p.aoe > 0) explode(g, p, p.x, p.y, -1); alive = false; break; }
        for (const m of w.monsters) {
          if (m.dead || p.hit.includes(m.id)) continue;
          const rr = p.r + m.r;
          if (Math.abs(m.x - p.x) > rr || Math.abs(m.y - p.y) > rr) continue;
          if (Math.hypot(m.x - p.x, m.y - p.y) > rr) continue;
          p.hit.push(m.id);
          hurtMonster(g, m, p.dmg);
          if (p.aoe > 0) explode(g, p, p.x, p.y, m.id);
          else g.emit({ t: 'fx', kind: 'impact', x: p.x, y: p.y, c: p.kind });
          if (p.pierce > 0) { p.pierce--; continue; }
          alive = false; break;
        }
      } else if (!h.dead && Math.hypot(h.x - p.x, h.y - p.y) <= p.r + h.r) {
        const src = w.monsters.find((m) => m.id === p.src) ?? null;
        hurtHero(g, p.dmg, src, 'proj');
        if (p.aoe > 0) explode(g, p, p.x, p.y, h.id);
        else g.emit({ t: 'fx', kind: 'impact', x: p.x, y: p.y, c: p.kind });
        alive = false;
      }
    }
    if (p.life <= 0 && p.aoe > 0) explode(g, p, p.x, p.y, -1);
    if (alive) keep.push(p);
  }
  w.projs = keep;
}

// ---------------------------------------------------------------- areas
export function addArea(g: Game, kind: AreaKind, side: 'hero' | 'mon', x: number, y: number, r: number, dur: number, dmg: Dmg, o: Partial<Area> = {}): Area {
  const a: Area = { id: g.world.nextId++, kind, side, x, y, r, t: 0, dur, delay: 0, tick: 0.5, tickT: 0, dmg, hitIds: [], data: {}, ...o };
  g.world.areas.push(a);
  return a;
}

function areaHit(g: Game, a: Area, x: number, y: number, r: number, d: Dmg, once: boolean): void {
  if (a.side === 'hero') {
    for (const m of g.world.monsters) {
      if (m.dead) continue;
      if (once && a.hitIds.includes(m.id)) continue;
      if (Math.hypot(m.x - x, m.y - y) <= r + m.r) { if (once) a.hitIds.push(m.id); hurtMonster(g, m, d); }
    }
  } else {
    const h = g.hero;
    if (h.dead || (once && a.hitIds.includes(h.id))) return;
    if (Math.hypot(h.x - x, h.y - y) <= r + h.r) { if (once) a.hitIds.push(h.id); const src = g.world.monsters.find((m) => m.id === a.dmg.src) ?? null; hurtHero(g, d, src, 'area'); }
  }
}

export function updateAreas(g: Game, dt: number): void {
  const w = g.world;
  const keep: Area[] = [];
  for (const a of w.areas) {
    if (a.delay > 0) {
      a.delay -= dt;
      if (a.delay <= 0) {
        if (a.kind === 'meteor' || a.kind === 'stomp') {
          areaHit(g, a, a.x, a.y, a.r, a.dmg, true);
          if (a.side === 'hero') breakPropsNear(g, a.x, a.y, a.r);
          g.emit({ t: 'fx', kind: a.kind === 'meteor' || a.data.fire ? 'explosion' : 'stomp', x: a.x, y: a.y, r: a.r });
          g.emit({ t: 'sfx', id: a.kind === 'meteor' ? 'meteor' : 'stomp', x: a.x, y: a.y });
          g.emit({ t: 'shake', v: a.kind === 'meteor' ? 0.6 : 0.4 });
          if (a.kind === 'meteor' && a.data.burn) addArea(g, 'burn', a.side, a.x, a.y, a.r * 0.8, 3, scaleDmg(a.dmg, a.data.burn), { tick: 0.5 });
        }
      } else { keep.push(a); continue; }
    }
    a.t += dt;
    switch (a.kind) {
      case 'nova': case 'bossNova': case 'lightningRing': case 'firewave': {
        const cur = a.r * Math.min(1, a.t / Math.max(0.01, a.dur));
        const band = a.kind === 'nova' ? 0.9 : 0.55;
        if (a.side === 'hero') {
          for (const m of w.monsters) {
            if (m.dead || a.hitIds.includes(m.id)) continue;
            const d = Math.hypot(m.x - a.x, m.y - a.y);
            if (d <= cur + m.r && d >= cur - band - m.r) { a.hitIds.push(m.id); hurtMonster(g, m, a.dmg); }
          }
        } else {
          const h = g.hero;
          const d = Math.hypot(h.x - a.x, h.y - a.y);
          if (!a.hitIds.includes(h.id) && d <= cur + h.r && d >= cur - band - h.r) { a.hitIds.push(h.id); hurtHero(g, a.dmg, w.monsters.find((m) => m.id === a.dmg.src) ?? null, 'area'); }
        }
        break;
      }
      case 'rain': case 'burn': case 'poisonCloud': case 'shock': {
        a.tickT -= dt;
        if (a.tickT <= 0) {
          a.tickT += a.tick;
          areaHit(g, a, a.x, a.y, a.r, a.dmg, false);
          if (a.kind === 'rain') g.emit({ t: 'fx', kind: 'rainTick', x: a.x, y: a.y, r: a.r });
        }
        break;
      }
    }
    if (a.t < a.dur) keep.push(a);
  }
  w.areas = keep;
}

/** Pick up potion/gold drops automatically when walking over them. */
export function autoPickup(g: Game): void {
  const h = g.hero, w = g.world;
  w.drops = w.drops.filter((d) => {
    if (d.item) return true;
    if (Math.hypot(d.x - h.x, d.y - h.y) > 1.0) return true;
    if (d.gold) { h.gold += d.gold; g.emit({ t: 'sfx', id: 'gold' }); g.emit({ t: 'dmg', x: d.x, y: d.y, v: d.gold, kind: 'gold' }); return false; }
    if (d.pot === 'hp' && h.potHp < MAX_POTIONS) { h.potHp++; g.emit({ t: 'sfx', id: 'potPick' }); return false; }
    if (d.pot === 'mp' && h.potMp < MAX_POTIONS) { h.potMp++; g.emit({ t: 'sfx', id: 'potPick' }); return false; }
    if (d.pot === 'scroll' && h.scrolls < 20) { h.scrolls++; g.emit({ t: 'sfx', id: 'potPick' }); return false; }
    return true;
  });
}
