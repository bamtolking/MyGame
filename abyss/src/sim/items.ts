// Item generation: rarity roll, base pick, affix rolls, names, requirements and prices.
import { AFFIXES, BASES, BASE_BY_ID, RARE_A, RARE_B, UNIQUES, UNIQUE_BY_ID, slotGroups, type AffixDef, type AffixTier, type BaseItem } from '../data/items';
import { LOOT } from '../data/zones';
import type { Rng } from './rng';
import type { ClassId, Item, Mod, Rarity, Slot } from './types';

export interface GenOpts { rarity?: Rarity; cls?: ClassId; base?: string; slot?: Slot; uniq?: string; mf?: number; bonus?: number; minRarity?: Rarity }

const RANK: Record<Rarity, number> = { normal: 0, magic: 1, rare: 2, unique: 3 };

export function rollRarity(rng: Rng, mf: number, bonus = 1): Rarity {
  const mfU = (mf * 250) / (mf + 250) / 100;
  const mfR = (mf * 600) / (mf + 600) / 100;
  const mfM = mf / 100;
  if (rng.chance(LOOT.unique * bonus * (1 + mfU))) return 'unique';
  if (rng.chance(LOOT.rare * bonus * (1 + mfR))) return 'rare';
  if (rng.chance(Math.min(0.9, LOOT.magic * bonus * (1 + mfM)))) return 'magic';
  return 'normal';
}

const SLOT_WEIGHTS: [Slot, number][] = [['weapon', 22], ['offhand', 9], ['head', 10], ['chest', 10], ['gloves', 8], ['boots', 8], ['belt', 7], ['ring', 8], ['amulet', 5]];

export function pickBase(rng: Rng, ilvl: number, cls: ClassId | undefined, slot?: Slot): BaseItem {
  const s = slot ?? rng.weighted(SLOT_WEIGHTS, (x) => x[1])[0];
  let pool = BASES.filter((b) => b.slot === s && b.qlvl <= Math.max(1, ilvl));
  if (cls && (s === 'weapon' || s === 'offhand') && rng.chance(LOOT.classBias)) {
    const own = pool.filter((b) => b.cls === cls);
    if (own.length) pool = own;
  }
  if (!pool.length) pool = BASES.filter((b) => b.slot === s);
  return rng.weighted(pool, (b) => Math.exp(-(ilvl - b.qlvl) / 7));
}

function rollTier(rng: Rng, a: AffixDef, ilvl: number): AffixTier {
  const ok = a.tiers.filter((t) => t.lvl <= ilvl);
  return rng.weighted(ok, (t) => ok.indexOf(t) + 1);
}

function rollValue(rng: Rng, k: string, lo: number, hi: number): number {
  if (k === 'hpRegen' || k === 'mpRegen') return Math.round(rng.range(lo, hi) * 10) / 10;
  return rng.irange(Math.round(lo), Math.round(hi));
}

function tierMod(rng: Rng, a: AffixDef, t: AffixTier): Mod {
  const v = rollValue(rng, a.k, t.min, t.max);
  if (t.min2 !== undefined && t.max2 !== undefined) return { k: a.k, v, v2: Math.max(v + 1, rng.irange(t.min2, t.max2)) };
  return { k: a.k, v };
}

function pickAffixes(rng: Rng, base: BaseItem, ilvl: number, kind: 'prefix' | 'suffix', n: number, used: Set<string>): { mod: Mod; tier: AffixTier }[] {
  const groups = slotGroups(base);
  const out: { mod: Mod; tier: AffixTier }[] = [];
  for (let i = 0; i < n; i++) {
    const pool = AFFIXES.filter((a) => a.kind === kind && !used.has(a.id) && a.tiers[0].lvl <= ilvl && a.on.some((g) => groups.includes(g)));
    if (!pool.length) break;
    const a = rng.weighted(pool, (x) => x.weight);
    used.add(a.id);
    const t = rollTier(rng, a, ilvl);
    out.push({ mod: tierMod(rng, a, t), tier: t });
  }
  return out;
}

function rollBaseStats(rng: Rng, b: BaseItem, it: Item): void {
  if (b.armor && b.armor[1] > 0) it.armor = rng.irange(b.armor[0], b.armor[1]);
  if (b.dmg) it.dmg = [b.dmg[0], b.dmg[1]];
  if (b.block) it.block = b.block;
}

export function genItem(rng: Rng, uid: number, ilvl: number, o: GenOpts = {}): Item {
  ilvl = Math.max(1, Math.round(ilvl));
  let rarity: Rarity = o.rarity ?? rollRarity(rng, o.mf ?? 0, o.bonus ?? 1);
  if (o.minRarity && RANK[rarity] < RANK[o.minRarity]) rarity = o.minRarity;
  if (o.uniq || rarity === 'unique') {
    const u = o.uniq ? UNIQUE_BY_ID[o.uniq] : pickUnique(rng, ilvl, o.cls);
    if (u) return makeUnique(rng, uid, u.id, ilvl);
    rarity = 'rare';
  }
  const base = o.base ? BASE_BY_ID[o.base] : pickBase(rng, ilvl, o.cls, o.slot);
  if ((base.slot === 'ring' || base.slot === 'amulet') && rarity === 'normal') rarity = 'magic';
  const it: Item = { uid, base: base.id, rarity, ilvl, req: 1, name: base.name, mods: [] };
  rollBaseStats(rng, base, it);
  if (base.implicit) it.mods.push(...base.implicit.map((m) => ({ ...m })));
  let maxTier = 0;
  if (rarity === 'magic') {
    const roll = rng.next();
    const used = new Set<string>();
    const pre = roll < 0.7 ? pickAffixes(rng, base, ilvl, 'prefix', 1, used) : [];
    const suf = roll >= 0.4 ? pickAffixes(rng, base, ilvl, 'suffix', 1, used) : [];
    if (!pre.length && !suf.length) suf.push(...pickAffixes(rng, base, ilvl, 'suffix', 1, used));
    for (const x of [...pre, ...suf]) { it.mods.push(x.mod); maxTier = Math.max(maxTier, x.tier.lvl); }
    it.name = [suf[0]?.tier.name, pre[0]?.tier.name, base.name].filter(Boolean).join(' ');
  } else if (rarity === 'rare') {
    const used = new Set<string>();
    let np = rng.irange(1, 3), ns = rng.irange(1, 3);
    while (np + ns < 3) { if (rng.chance(0.5)) np++; else ns++; }
    if (ilvl >= 20 && np + ns < 5 && rng.chance(0.4)) { if (np < 3) np++; else ns++; }
    const pre = pickAffixes(rng, base, ilvl, 'prefix', np, used);
    const suf = pickAffixes(rng, base, ilvl, 'suffix', ns, used);
    for (const x of [...pre, ...suf]) { it.mods.push(x.mod); maxTier = Math.max(maxTier, x.tier.lvl); }
    const words = RARE_B[base.cat] ?? RARE_B.any;
    it.name = `${rng.pick(RARE_A)}의 ${rng.pick(words)}`;
  }
  it.req = Math.max(1, base.qlvl, maxTier - 2);
  return it;
}

function pickUnique(rng: Rng, ilvl: number, cls?: ClassId) {
  const pool = UNIQUES.filter((u) => !u.bossOnly && BASE_BY_ID[u.base].qlvl <= ilvl + 2 && u.req <= ilvl + 4);
  if (!pool.length) return null;
  return rng.weighted(pool, (u) => { const b = BASE_BY_ID[u.base]; return (b.cls && cls && b.cls === cls ? 2 : 1) * Math.exp(-(ilvl - u.req) / 12); });
}

export function makeUnique(rng: Rng, uid: number, id: string, ilvl: number): Item {
  const u = UNIQUE_BY_ID[id];
  const base = BASE_BY_ID[u.base];
  const it: Item = { uid, base: base.id, rarity: 'unique', ilvl, req: u.req, name: u.name, mods: [], uniq: u.id };
  rollBaseStats(rng, base, it);
  if (base.implicit) it.mods.push(...base.implicit.map((m) => ({ ...m })));
  for (const m of u.mods) {
    const v = rollValue(rng, m.k, m.min, m.max);
    if (m.min2 !== undefined && m.max2 !== undefined) it.mods.push({ k: m.k, v, v2: rng.irange(m.min2, m.max2) });
    else it.mods.push({ k: m.k, v });
  }
  return it;
}

export function itemValue(it: Item): number {
  const r = { normal: 1, magic: 2.4, rare: 4.5, unique: 7 }[it.rarity];
  return Math.round((12 + it.ilvl * 7 + it.ilvl * it.ilvl * 0.25) * r * (1 + it.mods.length * 0.12));
}
export const sellPrice = (it: Item) => Math.max(1, Math.floor(itemValue(it) * 0.22));
export const buyPrice = (it: Item) => Math.floor(itemValue(it) * 1.3);

export function baseOf(it: Item): BaseItem { return BASE_BY_ID[it.base]; }

export function canEquipClass(it: Item, cls: ClassId): boolean {
  const b = baseOf(it);
  return !b.cls || b.cls === cls;
}

export function modSum(it: Item, k: string): number {
  let s = 0;
  for (const m of it.mods) if (m.k === k) s += m.v;
  return s;
}

/** Weapon damage range after local enhanced damage and flat damage. */
export function weaponDamage(it: Item): [number, number] {
  const b = baseOf(it);
  if (!it.dmg) return [0, 0];
  const ed = modSum(it, 'ed');
  let lo = it.dmg[0] * (1 + ed / 100), hi = it.dmg[1] * (1 + ed / 100);
  for (const m of it.mods) if (m.k === 'dmgFlat') { lo += m.v; hi += m.v2 ?? m.v; }
  void b;
  return [Math.round(lo), Math.round(hi)];
}

/** Armor value after local enhanced defense. */
export function itemArmor(it: Item): number {
  if (!it.armor) return 0;
  return Math.round(it.armor * (1 + modSum(it, 'armorPct') / 100));
}
