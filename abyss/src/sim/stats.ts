// Derived hero stats from class, level, attributes, gear and buffs.
import { CLASSES } from '../data/classes';
import { DIFFICULTIES } from '../data/zones';
import { baseOf, itemArmor, weaponDamage } from './items';
import type { Attrs, BuffMods, Elem, EquipSlot, Hero, HeroStats, ModKey } from './types';

export const MAX_RES = 75;

export function gearSums(h: Hero): Record<string, number> & { adds: Record<string, [number, number]> } {
  const s: Record<string, number> = {};
  const adds: Record<string, [number, number]> = { fire: [0, 0], cold: [0, 0], light: [0, 0], poison: [0, 0] };
  for (const slot of Object.keys(h.equip) as EquipSlot[]) {
    const it = h.equip[slot];
    if (!it || it.req > h.level) continue;
    for (const m of it.mods) {
      if (m.k === 'fireDmg' || m.k === 'coldDmg' || m.k === 'lightDmg') {
        const e = m.k.replace('Dmg', '');
        adds[e][0] += m.v; adds[e][1] += m.v2 ?? m.v;
      } else if (m.k === 'poisonDmg') { adds.poison[0] += m.v; adds.poison[1] += m.v; }
      else s[m.k] = (s[m.k] ?? 0) + m.v;
    }
  }
  return Object.assign(s, { adds });
}

export function buffVal(h: Hero, id: string): number {
  let v = 0;
  for (const b of h.buffs) if (b.id === id) v = Math.max(v, b.v);
  return v;
}

/** Sum of all active buffs' stat mods. */
export function buffMods(h: Hero): Required<BuffMods> {
  const o: Required<BuffMods> = { dmgPct: 0, ias: 0, armorPct: 0, armor: 0, lifeSteal: 0, manaSteal: 0, dodge: 0, ms: 0, hpRegen: 0, mpRegen: 0, crit: 0, critDmg: 0, resAll: 0, block: 0, thorns: 0, dmgTaken: 0 };
  for (const b of h.buffs) if (b.mods) for (const k of Object.keys(b.mods) as (keyof BuffMods)[]) o[k] += b.mods[k] ?? 0;
  return o;
}

export function effectiveAttrs(h: Hero, s: Record<string, number>): Attrs {
  const all = s.allAttr ?? 0;
  return {
    str: h.attrs.str + (s.str ?? 0) + all,
    dex: h.attrs.dex + (s.dex ?? 0) + all,
    vit: h.attrs.vit + (s.vit ?? 0) + all,
    ene: h.attrs.ene + (s.ene ?? 0) + all,
  };
}

export function computeStats(h: Hero, diff: number): HeroStats {
  const c = CLASSES[h.cls];
  const s = gearSums(h);
  const g = (k: ModKey) => s[k] ?? 0;
  const a = effectiveAttrs(h, s);
  const lvl = h.level;
  const bm = buffMods(h);

  const maxHp = Math.round((c.hpBase + c.hpLvl * (lvl - 1) + a.vit * c.hpVit + g('hp')) * (1 + g('hpPct') / 100));
  const maxMp = Math.round(c.mpBase + c.mpLvl * (lvl - 1) + a.ene * c.mpEne + g('mp'));

  let armor = 0;
  for (const slot of Object.keys(h.equip) as EquipSlot[]) {
    const it = h.equip[slot];
    if (it && it.req <= h.level) armor += itemArmor(it);
  }
  armor += g('armor') + Math.floor(a.dex / 4);
  armor *= 1 + (buffVal(h, 'shrineArmor') + (buffVal(h, 'warcry') > 0 ? 40 : 0) + bm.armorPct) / 100;
  armor += bm.armor;

  const pen = DIFFICULTIES[diff]?.resPenalty ?? 0;
  const resAll = g('resAll') + bm.resAll;
  const res: Record<Elem, number> = {
    phys: 0,
    fire: Math.min(MAX_RES, g('resFire') + resAll - pen),
    cold: Math.min(MAX_RES, g('resCold') + resAll - pen),
    light: Math.min(MAX_RES, g('resLight') + resAll - pen),
    poison: Math.min(MAX_RES, g('resPoison') + resAll - pen),
  };

  const w = h.equip.weapon && h.equip.weapon.req <= h.level ? h.equip.weapon : null;
  const wb = w ? baseOf(w) : null;
  let [wMin, wMax] = w ? weaponDamage(w) : [1, 3];
  const ranged = c.ranged;
  if (h.cls === 'rogue' && wb?.cat !== 'bow') { wMin = Math.max(1, Math.round(wMin * 0.3)); wMax = Math.max(2, Math.round(wMax * 0.3)); }

  const mainVal = a[c.main];
  const dmgPct = g('dmgPct') + buffVal(h, 'warcry') + buffVal(h, 'berserk') + buffVal(h, 'shrineDmg') + bm.dmgPct;
  const spellMult = c.spell ? 1 + g('spellDmg') / 100 : 1;
  const dmgMult = (1 + mainVal / 100) * (1 + dmgPct / 100) * spellMult;

  const baseSpeed = wb?.speed ?? 1.4;
  const ias = g('ias') + (buffVal(h, 'berserk') > 0 ? 40 : 0) + buffVal(h, 'shrineSpeed') + bm.ias;
  const aps = Math.min(3.5, baseSpeed * (1 + ias / 100));

  const crit = Math.min(60, 5 + g('crit') + bm.crit + a.dex * c.critPerDex);
  const critMult = 1.5 + (g('critDmg') + bm.critDmg) / 100;

  const off = h.equip.offhand && h.equip.offhand.req <= h.level ? h.equip.offhand : null;
  const block = off && off.block ? Math.min(50, off.block + g('block') + bm.block + a.dex * 0.05) : 0;

  const ms = Math.min(60, g('ms') + buffVal(h, 'shrineSpeed') + bm.ms);

  return {
    str: a.str, dex: a.dex, vit: a.vit, ene: a.ene,
    maxHp, maxMp,
    hpRegen: 0.3 + a.vit * 0.025 + g('hpRegen') + bm.hpRegen,
    mpRegen: (1 + a.ene * 0.04 + g('mpRegen') + bm.mpRegen) * (c.spell ? 1.3 : 1),
    armor: Math.round(armor), res,
    wMin, wMax,
    adds: { fire: s.adds.fire, cold: s.adds.cold, light: s.adds.light, poison: s.adds.poison },
    dmgMult, spellMult, aps, crit, critMult,
    lifeSteal: g('lifeSteal') + (buffVal(h, 'berserk') > 0 ? 6 : 0) + bm.lifeSteal,
    manaSteal: g('manaSteal') + bm.manaSteal, lifeKill: g('lifeKill'), manaKill: g('manaKill'),
    moveSpeed: 4.3 * (1 + ms / 100),
    block, mf: g('mf') + buffVal(h, 'shrineMf'), gf: g('gf'), light: 7 + g('light'), thorns: g('thorns') + bm.thorns,
    skills: g('skills'), dmgReduce: g('dmgReduce'), dodge: Math.min(75, buffVal(h, 'evade') + bm.dodge),
    dmgTakenPct: Math.min(60, bm.dmgTaken),
    ranged, reach: 1.0 + c.reach + (wb?.twoHanded ? c.reach2h : 0),
  };
}

/** Armor → physical damage reduction against an attacker of level L. */
export function armorReduction(armor: number, lvl: number): number {
  return Math.min(0.8, armor / (armor + 25 + 12 * lvl));
}

/** Rough sheet DPS of the basic attack (for UI and item comparison). */
export function sheetDps(st: HeroStats): number {
  const avg = (st.wMin + st.wMax) / 2 + (st.adds.fire[0] + st.adds.fire[1] + st.adds.cold[0] + st.adds.cold[1] + st.adds.light[0] + st.adds.light[1]) / 2 + st.adds.poison[0];
  return avg * st.dmgMult * st.aps * (1 + (st.crit / 100) * (st.critMult - 1));
}

/** Effective skill rank (base rank + item bonus, only if learned). */
export function skillRank(h: Hero, id: string): number {
  const r = h.skills[id] ?? 0;
  return r > 0 ? r + h.st.skills : 0;
}
