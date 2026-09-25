import type { ClassId, GearSlot, Item, Rarity, StatKey, Stats, Profile, TalKind } from '../types.ts';
import type { Rng } from '../rng.ts';
import { CLASSES } from './classes.ts';
import { TAL_SLOT_LEVELS } from '../constants.ts';

export const RARITY_NAMES = ['일반', '고급', '희귀', '영웅', '전설'];
export const RARITY_COLORS = ['#b8bcc8', '#5fd46b', '#4aa3ff', '#c16bff', '#ffb02e'];
const RARITY_MUL = [1, 1.12, 1.26, 1.42, 1.62];
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'armor', 'charm'];
export const SLOT_NAMES: Record<GearSlot, string> = { weapon: '무기', armor: '갑옷', charm: '노리개' };

const WEAPON_NAMES: Record<ClassId, string[]> = {
  sword: ['복숭아나무 검', '청동 환도', '강철 환도', '월철 환도', '천뢰검'],
  archer: ['복숭아나무 활', '각궁', '강철 각궁', '월광 각궁', '천뢰궁'],
  shaman: ['복숭아나무 방울', '청동 방울', '은방울', '월광 방울', '천뢰 방울'],
};
const ARMOR_NAMES = ['무명 도포', '누비 도포', '두정갑', '월철 갑주', '천뢰 갑주'];
const CHARM_NAMES = ['나무 노리개', '옥 노리개', '호박 노리개', '월석 노리개', '천뢰 노리개'];
export const tierOf = (ilvl: number): number => Math.min(4, Math.floor((ilvl - 1) / 6));
export function itemName(it: Item, cls: ClassId): string {
  const t = tierOf(it.ilvl);
  const n = it.slot === 'weapon' ? WEAPON_NAMES[cls][t] : it.slot === 'armor' ? ARMOR_NAMES[t] : CHARM_NAMES[t];
  return (it.plus ? `+${it.plus} ` : '') + n;
}

export const STAT_NAMES: Record<StatKey, string> = {
  atkPct: '공격력', hpPct: '체력', crit: '치명타 확률', critDmg: '치명타 피해', aspd: '공격 속도', move: '이동 속도',
  cdr: '부적 재사용', leech: '흡혈', xpPct: '경험치', goldPct: '금화 획득', dr: '받는 피해 감소',
};
// [min, max] at ilvl 1, grows by `per` per item level.
const AFFIX: Record<StatKey, [number, number, number]> = {
  atkPct: [0.03, 0.07, 0.0015], hpPct: [0.04, 0.09, 0.0015], crit: [0.02, 0.04, 0.0005], critDmg: [0.08, 0.16, 0.002],
  aspd: [0.03, 0.07, 0.001], move: [0.02, 0.04, 0.0004], cdr: [0.02, 0.05, 0.0006], leech: [0.005, 0.012, 0.0002],
  xpPct: [0.03, 0.07, 0.001], goldPct: [0.05, 0.12, 0.002], dr: [0.015, 0.035, 0.0004],
};
const AFFIX_KEYS = Object.keys(AFFIX) as StatKey[];
export const CAPS: Partial<Record<StatKey, number>> = { crit: 0.6, aspd: 0.8, move: 0.35, cdr: 0.4, leech: 0.08, dr: 0.6 };

export function baseStat(slot: GearSlot, ilvl: number, rarity: Rarity, plus: number): number {
  const m = RARITY_MUL[rarity] * (1 + 0.1 * plus);
  if (slot === 'weapon') return Math.round((3 + ilvl * 1.7) * m);
  if (slot === 'armor') return Math.round((14 + ilvl * 7.5) * m);
  return Math.round((1 + ilvl * 0.1) * m * 10) / 10; // charm: crit %
}
export function makeItem(rng: Rng, uid: number, slot: GearSlot, ilvl: number, rarity: Rarity): Item {
  const keys = AFFIX_KEYS.slice(); const affixes: [StatKey, number][] = [];
  for (let i = 0; i < rarity; i++) {
    const k = keys.splice(Math.floor(rng.next() * keys.length), 1)[0]; const [a, b, per] = AFFIX[k];
    const v = (a + (b - a) * rng.next()) + per * ilvl; affixes.push([k, Math.round(v * 1000) / 1000]);
  }
  return { uid, slot, rarity, ilvl, base: baseStat(slot, ilvl, rarity, 0), affixes, plus: 0 };
}
export function rollRarity(rng: Rng, bonus: number): Rarity {
  // bonus 0 = normal monster, 1 = elite, 2 = boss, 3 = world boss chest
  const w = [[62, 27, 8.4, 2.2, 0.4], [30, 38, 22, 8, 2], [0, 25, 45, 23, 7], [0, 0, 45, 40, 15]][Math.min(3, bonus)];
  return rng.weighted([0, 1, 2, 3, 4] as Rarity[], w);
}
export const enhanceCost = (it: Item): number => Math.floor(60 * (it.plus + 1) * (it.plus + 1) * (1 + it.ilvl / 8));
export const MAX_PLUS = 10;
export const sellValue = (it: Item): number => Math.floor((5 + it.ilvl * 2) * Math.pow(1 + it.rarity, 1.6) * (1 + it.plus * 0.3));
export const talBuyCost = (level: number): number => 250 + level * 40;
export const TAL_SHARD_COST = 30;

export function computeStats(p: Pick<Profile, 'cls' | 'level' | 'equip' | 'tals' | 'slots'>): Stats {
  const c = CLASSES[p.cls]; const L = p.level;
  const add: Record<StatKey, number> = { atkPct: 0, hpPct: 0, crit: 0, critDmg: 0, aspd: 0, move: 0, cdr: 0, leech: 0, xpPct: 0, goldPct: 0, dr: 0 };
  let atkFlat = 0, hpFlat = 0;
  for (const s of GEAR_SLOTS) {
    const it = p.equip[s]; if (!it) continue;
    const b = baseStat(it.slot, it.ilvl, it.rarity, it.plus);
    if (s === 'weapon') atkFlat += b; else if (s === 'armor') { hpFlat += b; add.dr += 0.01 * Math.min(10, it.plus); } else add.crit += b / 100;
    for (const [k, v] of it.affixes) add[k] += v;
  }
  add.leech += c.leech;
  for (const k of Object.keys(CAPS) as StatKey[]) add[k] = Math.min(add[k], CAPS[k]!);
  const atk = Math.round(((c.atk * (1 + 0.12 * (L - 1))) + atkFlat) * (1 + add.atkPct));
  const maxHp = Math.round((c.hp + c.hpLv * (L - 1) + hpFlat) * (1 + add.hpPct));
  const crit = Math.min(0.75, c.crit + add.crit), critDmg = 1.5 + add.critDmg;
  const aspd = c.aspd * (1 + add.aspd), move = c.move * (1 + add.move);
  const dr = Math.min(0.7, c.dr + add.dr);
  let talPow = 0; for (const uid of p.slots) { const t = uid == null ? null : p.tals.find(x => x.uid === uid); if (t) talPow += 40 * t.lv * t.lv; }
  const power = Math.round(atk * (1 + crit * (critDmg - 1)) * (aspd / c.aspd) * 12 + maxHp * 1.5 / (1 - dr) * 0.5 + talPow);
  return { maxHp, atk, crit, critDmg, aspd, move, cdr: add.cdr, leech: add.leech, xpPct: add.xpPct, goldPct: add.goldPct, dr, power };
}
export const slotsUnlocked = (level: number): number => TAL_SLOT_LEVELS.filter(l => level >= l).length;
export function newProfile(name: string, cls: ClassDefLike, now: number): Profile {
  return {
    v: 1, name, cls: cls.id, level: 1, xp: 0, gold: 0, shards: 0, inv: [], equip: { weapon: null, armor: null, charm: null },
    tals: [{ uid: 1, kind: cls.startTal, lv: 1 }], slots: [1, null, null, null],
    quest: { main: 0, prog: 0, bountyZone: 1, bountyProg: 0, bountyDone: 0 }, shrines: [0],
    stats: { kills: 0, deaths: 0, bosses: 0, worldBoss: 0, playSec: 0, revives: 0, merges: 0, goldEarned: 0, legendaries: 0 },
    pity: 0, nextUid: 2, created: now, opts: { autoSell: 0 },
  };
}
interface ClassDefLike { id: ClassId; startTal: TalKind }
