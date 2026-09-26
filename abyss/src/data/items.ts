// Item bases, random affixes (prefix/suffix with item-level tiers), unique items and rare-name word lists.
import type { ClassId, ModKey, Mod, Slot } from '../sim/types';

export type ItemCat =
  | 'sword' | 'axe' | 'mace' | 'sword2h' | 'axe2h' | 'bow' | 'staff' | 'wand'
  | 'spear' | 'claw' | 'knuckle' | 'scythe'
  | 'shield' | 'quiver' | 'orb' | 'pouch' | 'skull' | 'totem'
  | 'helm' | 'chest' | 'gloves' | 'boots' | 'belt' | 'ring' | 'amulet';

export interface BaseItem {
  id: string; name: string; slot: Slot; cat: ItemCat; qlvl: number;
  dmg?: [number, number]; speed?: number; twoHanded?: boolean;
  armor?: [number, number]; block?: number;
  /** Classes that may equip it (none = everyone). */
  cls?: ClassId | ClassId[];
  /** Spell weapon/offhand: can roll caster affixes (mana, spell damage, energy…). */
  caster?: boolean;
  implicit?: Mod[];
  /** Visual tier 0-4 (icon / sprite detail). */
  tier: number;
}

const W = (id: string, name: string, cat: ItemCat, qlvl: number, dmg: [number, number], speed: number, cls: ClassId | ClassId[], tier: number, extra: Partial<BaseItem> = {}): BaseItem =>
  ({ id, name, slot: 'weapon', cat, qlvl, dmg, speed, cls, tier, ...extra });
const A = (id: string, name: string, slot: Slot, cat: ItemCat, qlvl: number, armor: [number, number], tier: number, extra: Partial<BaseItem> = {}): BaseItem =>
  ({ id, name, slot, cat, qlvl, armor, tier, ...extra });

export const BASES: BaseItem[] = [
  // warrior one-handers
  W('shortSword', '짧은 검', 'sword', 1, [2, 6], 1.5, ['warrior', 'paladin'], 0),
  W('longSword', '장검', 'sword', 6, [5, 12], 1.45, ['warrior', 'paladin'], 1),
  W('bastard', '바스타드 소드', 'sword', 12, [9, 20], 1.4, ['warrior', 'paladin'], 2),
  W('runeSword', '룬 검', 'sword', 19, [14, 30], 1.45, ['warrior', 'paladin'], 3),
  W('demonBlade', '악마의 칼날', 'sword', 27, [21, 43], 1.5, ['warrior', 'paladin'], 4),
  W('hatchet', '손도끼', 'axe', 2, [3, 7], 1.4, 'warrior', 0),
  W('battleAxe', '전투 도끼', 'axe', 8, [6, 15], 1.35, 'warrior', 1),
  W('berserkAxe', '광전사 도끼', 'axe', 16, [12, 27], 1.35, 'warrior', 3),
  W('execAxe', '처형자의 도끼', 'axe', 25, [19, 41], 1.35, 'warrior', 4),
  W('club', '곤봉', 'mace', 1, [2, 7], 1.3, ['warrior', 'paladin'], 0),
  W('flail', '철퇴', 'mace', 7, [6, 13], 1.3, ['warrior', 'paladin'], 1),
  W('morningStar', '모닝스타', 'mace', 14, [10, 23], 1.3, ['warrior', 'paladin'], 2),
  W('warHammer', '전쟁 망치', 'mace', 22, [17, 38], 1.25, ['warrior', 'paladin'], 3),
  // warrior two-handers
  W('greatSword', '대검', 'sword2h', 4, [8, 18], 1.1, ['warrior', 'voidknight'], 1, { twoHanded: true }),
  W('greatAxe', '거대 도끼', 'axe2h', 12, [16, 35], 1.05, ['warrior', 'voidknight'], 2, { twoHanded: true }),
  W('headsman', '참수자의 대검', 'sword2h', 21, [27, 56], 1.05, ['warrior', 'voidknight'], 3, { twoHanded: true }),
  W('doomAxe', '파멸의 전투 도끼', 'axe2h', 29, [38, 78], 1.05, ['warrior', 'voidknight'], 4, { twoHanded: true }),
  // rogue bows (two-handed, quiver allowed)
  W('shortBow', '짧은 활', 'bow', 1, [2, 5], 1.55, 'rogue', 0, { twoHanded: true }),
  W('huntBow', '사냥 활', 'bow', 5, [4, 10], 1.5, 'rogue', 1, { twoHanded: true }),
  W('longBow', '장궁', 'bow', 11, [8, 19], 1.45, 'rogue', 2, { twoHanded: true }),
  W('compBow', '합성궁', 'bow', 18, [13, 28], 1.5, 'rogue', 3, { twoHanded: true }),
  W('shadowBow', '그림자 활', 'bow', 26, [20, 42], 1.5, 'rogue', 4, { twoHanded: true }),
  // sorcerer
  W('oakStaff', '참나무 지팡이', 'staff', 1, [3, 6], 1.25, ['sorcerer', 'druid'], 0, { caster: true, twoHanded: true, implicit: [{ k: 'spellDmg', v: 10 }] }),
  W('runeStaff', '룬 지팡이', 'staff', 9, [7, 14], 1.25, ['sorcerer', 'druid'], 1, { caster: true, twoHanded: true, implicit: [{ k: 'spellDmg', v: 18 }] }),
  W('archStaff', '대마법사 지팡이', 'staff', 18, [13, 26], 1.25, ['sorcerer', 'druid'], 3, { caster: true, twoHanded: true, implicit: [{ k: 'spellDmg', v: 26 }] }),
  W('abyssStaff', '심연의 지팡이', 'staff', 27, [21, 41], 1.25, ['sorcerer', 'druid'], 4, { caster: true, twoHanded: true, implicit: [{ k: 'spellDmg', v: 35 }] }),
  W('graveWand', '무덤 완드', 'wand', 1, [2, 5], 1.4, 'necromancer', 0, { caster: true, implicit: [{ k: 'mp', v: 6 }] }),
  W('boneWand', '뼈 완드', 'wand', 3, [2, 6], 1.4, ['sorcerer', 'necromancer'], 0, { caster: true, implicit: [{ k: 'mp', v: 10 }] }),
  W('crystalWand', '수정 완드', 'wand', 12, [6, 13], 1.4, ['sorcerer', 'necromancer'], 2, { caster: true, implicit: [{ k: 'mp', v: 20 }] }),
  W('lichWand', '망자의 완드', 'wand', 23, [12, 25], 1.4, ['sorcerer', 'necromancer'], 3, { caster: true, implicit: [{ k: 'mp', v: 30 }] }),
  // lancer spears (two-handed; the lancer's reach makes them strike from further away)
  W('pike', '장창', 'spear', 1, [3, 8], 1.35, 'lancer', 0, { twoHanded: true }),
  W('partisan', '파르티잔', 'spear', 7, [7, 16], 1.35, 'lancer', 1, { twoHanded: true }),
  W('glaive', '글레이브', 'spear', 14, [12, 27], 1.3, 'lancer', 2, { twoHanded: true }),
  W('dragonLance', '용기병의 창', 'spear', 21, [19, 41], 1.3, 'lancer', 3, { twoHanded: true }),
  W('stormLance', '폭풍의 창', 'spear', 29, [28, 58], 1.3, 'lancer', 4, { twoHanded: true }),
  // assassin claws (fast)
  W('katar', '카타르', 'claw', 1, [2, 5], 1.75, 'assassin', 0),
  W('bladeClaw', '칼날 발톱', 'claw', 8, [5, 11], 1.75, 'assassin', 1),
  W('hookClaw', '갈고리 발톱', 'claw', 15, [9, 19], 1.7, 'assassin', 2),
  W('viperClaw', '독사 발톱', 'claw', 22, [14, 29], 1.75, 'assassin', 3, { implicit: [{ k: 'poisonDmg', v: 12 }] }),
  W('shadowClaw', '그림자 발톱', 'claw', 29, [20, 40], 1.8, 'assassin', 4),
  // monk knuckles (a pair, so two-handed)
  W('wraps', '천 붕대', 'knuckle', 1, [2, 5], 1.85, 'monk', 0, { twoHanded: true }),
  W('ironKnuckle', '쇠 권갑', 'knuckle', 7, [5, 11], 1.85, 'monk', 1, { twoHanded: true }),
  W('tigerFist', '호랑이 권갑', 'knuckle', 14, [9, 19], 1.85, 'monk', 2, { twoHanded: true }),
  W('dragonFist', '용의 권갑', 'knuckle', 21, [14, 29], 1.85, 'monk', 3, { twoHanded: true }),
  W('heavenFist', '천상의 권갑', 'knuckle', 29, [20, 41], 1.9, 'monk', 4, { twoHanded: true }),
  // necromancer scythes
  W('boneScythe', '뼈 낫', 'scythe', 6, [7, 15], 1.2, 'necromancer', 1, { twoHanded: true, caster: true, implicit: [{ k: 'spellDmg', v: 12 }] }),
  W('graveScythe', '무덤지기의 낫', 'scythe', 16, [13, 27], 1.2, 'necromancer', 3, { twoHanded: true, caster: true, implicit: [{ k: 'spellDmg', v: 22 }] }),
  W('soulScythe', '영혼 수확자', 'scythe', 26, [21, 43], 1.2, 'necromancer', 4, { twoHanded: true, caster: true, implicit: [{ k: 'spellDmg', v: 32 }] }),
  // void knight greatswords
  W('rustblade', '녹슨 대검', 'sword2h', 1, [5, 11], 1.15, 'voidknight', 0, { twoHanded: true }),
  W('duskblade', '황혼의 대검', 'sword2h', 10, [13, 28], 1.1, 'voidknight', 2, { twoHanded: true }),
  W('voidblade', '공허의 대검', 'sword2h', 25, [30, 62], 1.1, 'voidknight', 4, { twoHanded: true }),
  // offhands
  A('buckler', '버클러', 'offhand', 'shield', 1, [3, 6], 0, { cls: ['warrior', 'paladin'], block: 15 }),
  A('kite', '카이트 실드', 'offhand', 'shield', 7, [10, 16], 1, { cls: ['warrior', 'paladin'], block: 20 }),
  A('tower', '탑 실드', 'offhand', 'shield', 14, [20, 30], 2, { cls: ['warrior', 'paladin'], block: 24 }),
  A('gothic', '고딕 방패', 'offhand', 'shield', 22, [32, 46], 3, { cls: ['warrior', 'paladin'], block: 27 }),
  A('aegis', '심연의 방패', 'offhand', 'shield', 30, [48, 64], 4, { cls: ['warrior', 'paladin'], block: 30 }),
  A('leatherQuiver', '가죽 화살통', 'offhand', 'quiver', 1, [0, 0], 0, { cls: 'rogue', implicit: [{ k: 'ias', v: 5 }] }),
  A('hunterQuiver', '사냥꾼 화살통', 'offhand', 'quiver', 10, [0, 0], 2, { cls: 'rogue', implicit: [{ k: 'ias', v: 8 }, { k: 'crit', v: 2 }] }),
  A('demonQuiver', '악마 화살통', 'offhand', 'quiver', 21, [0, 0], 4, { cls: 'rogue', implicit: [{ k: 'ias', v: 10 }, { k: 'crit', v: 4 }] }),
  A('crystalOrb', '수정 구슬', 'offhand', 'orb', 3, [0, 0], 0, { cls: 'sorcerer', implicit: [{ k: 'spellDmg', v: 8 }] }),
  A('starOrb', '별빛 구슬', 'offhand', 'orb', 12, [0, 0], 2, { cls: 'sorcerer', implicit: [{ k: 'spellDmg', v: 14 }] }),
  A('voidOrb', '공허의 구슬', 'offhand', 'orb', 23, [0, 0], 4, { cls: 'sorcerer', implicit: [{ k: 'spellDmg', v: 20 }] }),
  A('knifePouch', '투척 단검 주머니', 'offhand', 'pouch', 1, [0, 0], 0, { cls: 'assassin', implicit: [{ k: 'crit', v: 2 }] }),
  A('venomPouch', '맹독 단검 주머니', 'offhand', 'pouch', 12, [0, 0], 2, { cls: 'assassin', implicit: [{ k: 'crit', v: 4 }, { k: 'ias', v: 5 }] }),
  A('shadowPouch', '그림자 단검 주머니', 'offhand', 'pouch', 23, [0, 0], 4, { cls: 'assassin', implicit: [{ k: 'crit', v: 6 }, { k: 'ias', v: 8 }] }),
  A('shrunkenSkull', '말린 해골', 'offhand', 'skull', 1, [2, 4], 0, { cls: 'necromancer', caster: true, implicit: [{ k: 'spellDmg', v: 6 }, { k: 'hp', v: 5 }] }),
  A('hexSkull', '저주받은 해골', 'offhand', 'skull', 11, [6, 10], 2, { cls: 'necromancer', caster: true, implicit: [{ k: 'spellDmg', v: 12 }, { k: 'hp', v: 12 }] }),
  A('lichSkull', '리치의 해골', 'offhand', 'skull', 22, [12, 18], 4, { cls: 'necromancer', caster: true, implicit: [{ k: 'spellDmg', v: 18 }, { k: 'hp', v: 20 }] }),
  A('woodTotem', '나무 토템', 'offhand', 'totem', 1, [1, 3], 0, { cls: 'druid', caster: true, implicit: [{ k: 'spellDmg', v: 6 }, { k: 'hpRegen', v: 0.5 }] }),
  A('beastTotem', '짐승 토템', 'offhand', 'totem', 11, [5, 9], 2, { cls: 'druid', caster: true, implicit: [{ k: 'spellDmg', v: 12 }, { k: 'hpRegen', v: 1.5 }] }),
  A('stormTotem', '폭풍 토템', 'offhand', 'totem', 22, [10, 16], 4, { cls: 'druid', caster: true, implicit: [{ k: 'spellDmg', v: 18 }, { k: 'hpRegen', v: 3 }] }),
  // armor
  A('leatherCap', '가죽 모자', 'head', 'helm', 1, [2, 4], 0),
  A('helm', '투구', 'head', 'helm', 6, [6, 10], 1),
  A('hornHelm', '뿔 투구', 'head', 'helm', 13, [12, 18], 2),
  A('greatHelm', '대투구', 'head', 'helm', 20, [20, 28], 3),
  A('demonHelm', '악마 투구', 'head', 'helm', 28, [30, 40], 4),
  A('quilted', '누비 갑옷', 'chest', 'chest', 1, [5, 9], 0),
  A('leatherArmor', '가죽 갑옷', 'chest', 'chest', 4, [9, 14], 0),
  A('chainMail', '사슬 갑옷', 'chest', 'chest', 10, [18, 26], 1),
  A('plateMail', '판금 갑옷', 'chest', 'chest', 17, [30, 42], 2),
  A('gothicPlate', '고딕 판금', 'chest', 'chest', 24, [45, 60], 3),
  A('abyssPlate', '심연 갑주', 'chest', 'chest', 31, [62, 80], 4),
  A('leatherGloves', '가죽 장갑', 'gloves', 'gloves', 1, [1, 3], 0),
  A('chainGloves', '사슬 장갑', 'gloves', 'gloves', 9, [4, 7], 1),
  A('gauntlets', '건틀릿', 'gloves', 'gloves', 18, [8, 12], 3),
  A('demonGrip', '악마의 손아귀', 'gloves', 'gloves', 27, [13, 18], 4),
  A('leatherBoots', '가죽 신발', 'boots', 'boots', 1, [1, 3], 0),
  A('steelBoots', '강철 장화', 'boots', 'boots', 9, [4, 7], 1),
  A('warBoots', '전쟁 장화', 'boots', 'boots', 18, [8, 12], 3),
  A('shadowBoots', '그림자 장화', 'boots', 'boots', 27, [13, 18], 4),
  A('sash', '끈 허리띠', 'belt', 'belt', 1, [1, 2], 0),
  A('leatherBelt', '가죽 허리띠', 'belt', 'belt', 8, [3, 5], 1),
  A('plateBelt', '판금 허리띠', 'belt', 'belt', 18, [6, 9], 3),
  A('warBelt', '전쟁 허리띠', 'belt', 'belt', 27, [10, 14], 4),
  A('ring', '반지', 'ring', 'ring', 1, [0, 0], 0),
  A('amulet', '목걸이', 'amulet', 'amulet', 1, [0, 0], 0),
];
export const BASE_BY_ID: Record<string, BaseItem> = Object.fromEntries(BASES.map((b) => [b.id, b]));

/** Offhands that can be carried alongside a two-handed weapon (worn on the back / belt). */
export const OFFHAND_WITH_2H = new Set<ItemCat>(['quiver', 'totem']);

/** True when class `cls` may use base `b`. */
export function baseForClass(b: BaseItem, cls: ClassId): boolean {
  return !b.cls || (Array.isArray(b.cls) ? b.cls.includes(cls) : b.cls === cls);
}

export const CAT_NAMES: Record<ItemCat, string> = {
  sword: '한손 검', axe: '한손 도끼', mace: '둔기', sword2h: '양손 검', axe2h: '양손 도끼', bow: '활', staff: '지팡이', wand: '완드',
  spear: '창', claw: '발톱', knuckle: '권갑', scythe: '낫',
  shield: '방패', quiver: '화살통', orb: '마법 구슬', pouch: '단검 주머니', skull: '해골', totem: '토템', helm: '투구', chest: '갑옷', gloves: '장갑', boots: '신발', belt: '허리띠', ring: '반지', amulet: '목걸이',
};

// ---------------------------------------------------------------- affixes
type SlotGroup = 'weapon' | 'armor' | 'jewel' | 'shield' | 'quiver' | 'orb' | 'helm' | 'chest' | 'gloves' | 'boots' | 'belt' | 'caster' | 'ring' | 'amulet';
export interface AffixTier { lvl: number; min: number; max: number; min2?: number; max2?: number; name: string }
export interface AffixDef { id: string; kind: 'prefix' | 'suffix'; k: ModKey; on: SlotGroup[]; tiers: AffixTier[]; weight: number }

const T = (lvl: number, min: number, max: number, name: string, min2?: number, max2?: number): AffixTier => ({ lvl, min, max, name, min2, max2 });

export const AFFIXES: AffixDef[] = [
  // ---- prefixes
  { id: 'ed', kind: 'prefix', k: 'ed', on: ['weapon'], weight: 3, tiers: [T(1, 10, 20, '날카로운'), T(6, 21, 35, '잔혹한'), T(12, 36, 55, '야만적인'), T(19, 56, 80, '무자비한'), T(27, 81, 110, '학살하는'), T(36, 111, 150, '파멸적인')] },
  { id: 'dmgFlat', kind: 'prefix', k: 'dmgFlat', on: ['weapon'], weight: 2, tiers: [T(1, 1, 2, '묵직한', 2, 4), T(8, 2, 4, '육중한', 5, 9), T(16, 4, 7, '거대한', 10, 16), T(26, 7, 12, '괴물 같은', 17, 28)] },
  { id: 'fireDmg', kind: 'prefix', k: 'fireDmg', on: ['weapon', 'gloves', 'ring', 'quiver'], weight: 2, tiers: [T(1, 1, 2, '불타는', 3, 6), T(9, 3, 6, '이글거리는', 8, 14), T(18, 6, 11, '작열하는', 15, 26), T(28, 11, 18, '화산 같은', 27, 44)] },
  { id: 'coldDmg', kind: 'prefix', k: 'coldDmg', on: ['weapon', 'gloves', 'ring', 'quiver'], weight: 2, tiers: [T(1, 1, 2, '차가운', 2, 5), T(10, 3, 5, '얼어붙은', 7, 12), T(19, 5, 10, '혹한의', 13, 23), T(29, 10, 16, '빙하 같은', 24, 40)] },
  { id: 'lightDmg', kind: 'prefix', k: 'lightDmg', on: ['weapon', 'gloves', 'ring', 'quiver'], weight: 2, tiers: [T(1, 1, 1, '찌릿한', 5, 8), T(10, 1, 2, '번뜩이는', 10, 20), T(19, 1, 3, '벼락 맞은', 22, 38), T(29, 2, 5, '천둥치는', 40, 64)] },
  { id: 'poisonDmg', kind: 'prefix', k: 'poisonDmg', on: ['weapon', 'gloves', 'quiver'], weight: 1, tiers: [T(4, 4, 8, '독 묻은'), T(14, 10, 20, '맹독성'), T(24, 22, 40, '역병의')] },
  { id: 'armorPct', kind: 'prefix', k: 'armorPct', on: ['armor', 'shield'], weight: 3, tiers: [T(1, 10, 20, '튼튼한'), T(8, 21, 35, '견고한'), T(16, 36, 55, '강철 같은'), T(26, 56, 80, '철벽 같은'), T(34, 81, 110, '불멸의')] },
  { id: 'armor', kind: 'prefix', k: 'armor', on: ['armor', 'shield', 'belt', 'ring', 'amulet'], weight: 2, tiers: [T(1, 3, 8, '보강된'), T(10, 9, 20, '강화된'), T(20, 21, 40, '요새 같은'), T(30, 41, 65, '성채 같은')] },
  { id: 'hp', kind: 'prefix', k: 'hp', on: ['armor', 'shield', 'jewel', 'belt'], weight: 3, tiers: [T(1, 5, 10, '건강한'), T(8, 11, 20, '활기찬'), T(16, 21, 35, '강인한'), T(26, 36, 55, '불굴의'), T(34, 56, 80, '거신의')] },
  { id: 'mp', kind: 'prefix', k: 'mp', on: ['helm', 'jewel', 'caster', 'orb'], weight: 2, tiers: [T(1, 5, 10, '푸른'), T(8, 11, 20, '하늘빛'), T(16, 21, 35, '쪽빛'), T(26, 36, 55, '별빛의')] },
  { id: 'resAll', kind: 'prefix', k: 'resAll', on: ['shield', 'chest', 'amulet', 'ring', 'helm'], weight: 1, tiers: [T(8, 3, 6, '빛나는'), T(16, 7, 12, '찬란한'), T(26, 13, 20, '무지갯빛')] },
  { id: 'spellDmg', kind: 'prefix', k: 'spellDmg', on: ['caster', 'orb', 'amulet'], weight: 3, tiers: [T(1, 5, 10, '신비한'), T(10, 11, 20, '비전의'), T(20, 21, 32, '마력 깃든'), T(30, 33, 45, '초월한')] },
  { id: 'dmgPct', kind: 'prefix', k: 'dmgPct', on: ['amulet', 'ring', 'quiver', 'gloves'], weight: 2, tiers: [T(3, 4, 8, '호전적인'), T(12, 9, 15, '광포한'), T(22, 16, 24, '살육하는')] },
  { id: 'critDmg', kind: 'prefix', k: 'critDmg', on: ['weapon', 'amulet', 'gloves', 'quiver'], weight: 1, tiers: [T(6, 10, 20, '치명적인'), T(16, 21, 40, '처형하는'), T(28, 41, 65, '사신의')] },
  { id: 'skills', kind: 'prefix', k: 'skills', on: ['amulet', 'caster', 'orb'], weight: 1, tiers: [T(15, 1, 1, '숙련된'), T(32, 2, 2, '달인의')] },
  // ---- suffixes
  { id: 'str', kind: 'suffix', k: 'str', on: ['weapon', 'armor', 'shield', 'jewel', 'belt'], weight: 2, tiers: [T(1, 2, 4, '황소의'), T(8, 5, 8, '곰의'), T(16, 9, 14, '거인의'), T(26, 15, 22, '타이탄의')] },
  { id: 'dex', kind: 'suffix', k: 'dex', on: ['weapon', 'armor', 'jewel', 'quiver'], weight: 2, tiers: [T(1, 2, 4, '여우의'), T(8, 5, 8, '표범의'), T(16, 9, 14, '매의'), T(26, 15, 22, '그림자의')] },
  { id: 'vit', kind: 'suffix', k: 'vit', on: ['armor', 'shield', 'jewel', 'belt'], weight: 2, tiers: [T(1, 2, 4, '생명의'), T(8, 5, 8, '활력의'), T(16, 9, 14, '불사조의'), T(26, 15, 22, '영원의')] },
  { id: 'ene', kind: 'suffix', k: 'ene', on: ['caster', 'orb', 'helm', 'jewel'], weight: 2, tiers: [T(1, 2, 4, '학자의'), T(8, 5, 8, '현자의'), T(16, 9, 14, '마법사의'), T(26, 15, 22, '대현자의')] },
  { id: 'allAttr', kind: 'suffix', k: 'allAttr', on: ['amulet', 'ring'], weight: 1, tiers: [T(14, 2, 4, '왕의'), T(26, 5, 8, '황제의')] },
  { id: 'hpRegen', kind: 'suffix', k: 'hpRegen', on: ['armor', 'jewel', 'shield'], weight: 1, tiers: [T(1, 0.5, 1.5, '재생의'), T(12, 1.6, 3, '회복의'), T(22, 3.1, 5, '트롤의')] },
  { id: 'mpRegen', kind: 'suffix', k: 'mpRegen', on: ['helm', 'jewel', 'caster', 'orb'], weight: 1, tiers: [T(1, 0.5, 1.5, '집중의'), T(12, 1.6, 3, '통찰의'), T(22, 3.1, 5, '명상의')] },
  { id: 'ias', kind: 'suffix', k: 'ias', on: ['weapon', 'gloves', 'quiver', 'ring'], weight: 2, tiers: [T(1, 5, 10, '신속의'), T(10, 11, 20, '질풍의'), T(20, 21, 30, '광속의')] },
  { id: 'lifeSteal', kind: 'suffix', k: 'lifeSteal', on: ['weapon', 'ring', 'gloves', 'amulet'], weight: 1, tiers: [T(2, 1, 2, '거머리의'), T(12, 3, 5, '흡혈귀의'), T(24, 6, 8, '피의 군주의')] },
  { id: 'manaSteal', kind: 'suffix', k: 'manaSteal', on: ['weapon', 'ring', 'amulet'], weight: 1, tiers: [T(4, 2, 4, '영혼의'), T(16, 5, 7, '망령의')] },
  { id: 'lifeKill', kind: 'suffix', k: 'lifeKill', on: ['weapon', 'gloves', 'jewel'], weight: 1, tiers: [T(3, 1, 3, '도살자의'), T(14, 4, 8, '학살자의'), T(26, 9, 15, '섬멸자의')] },
  { id: 'manaKill', kind: 'suffix', k: 'manaKill', on: ['weapon', 'helm', 'jewel', 'caster'], weight: 1, tiers: [T(3, 1, 2, '수도승의'), T(14, 3, 5, '깨달음의')] },
  { id: 'resFire', kind: 'suffix', k: 'resFire', on: ['armor', 'shield', 'jewel'], weight: 2, tiers: [T(1, 5, 12, '잿불의'), T(12, 13, 25, '화산의'), T(24, 26, 40, '불꽃 수호의')] },
  { id: 'resCold', kind: 'suffix', k: 'resCold', on: ['armor', 'shield', 'jewel'], weight: 2, tiers: [T(1, 5, 12, '서리의'), T(12, 13, 25, '빙하의'), T(24, 26, 40, '겨울 수호의')] },
  { id: 'resLight', kind: 'suffix', k: 'resLight', on: ['armor', 'shield', 'jewel'], weight: 2, tiers: [T(1, 5, 12, '폭풍의'), T(12, 13, 25, '천둥의'), T(24, 26, 40, '번개 수호의')] },
  { id: 'resPoison', kind: 'suffix', k: 'resPoison', on: ['armor', 'shield', 'jewel'], weight: 1, tiers: [T(1, 5, 12, '독사의'), T(12, 13, 25, '전갈의'), T(24, 26, 40, '역병 수호의')] },
  { id: 'ms', kind: 'suffix', k: 'ms', on: ['boots'], weight: 3, tiers: [T(1, 5, 10, '여행자의'), T(10, 11, 20, '바람의'), T(20, 21, 30, '순풍의')] },
  { id: 'mf', kind: 'suffix', k: 'mf', on: ['helm', 'boots', 'gloves', 'jewel'], weight: 2, tiers: [T(1, 5, 12, '행운의'), T(12, 13, 25, '보물 사냥꾼의'), T(24, 26, 40, '재물신의')] },
  { id: 'gf', kind: 'suffix', k: 'gf', on: ['gloves', 'boots', 'belt', 'ring', 'amulet'], weight: 1, tiers: [T(1, 20, 40, '탐욕의'), T(12, 41, 80, '황금의')] },
  { id: 'light', kind: 'suffix', k: 'light', on: ['helm', 'ring', 'amulet', 'weapon'], weight: 1, tiers: [T(1, 1, 1, '빛의'), T(10, 2, 2, '태양의')] },
  { id: 'thorns', kind: 'suffix', k: 'thorns', on: ['chest', 'shield', 'gloves', 'boots'], weight: 1, tiers: [T(1, 2, 5, '가시의'), T(10, 6, 15, '고슴도치의'), T(20, 16, 35, '칼날의')] },
  { id: 'crit', kind: 'suffix', k: 'crit', on: ['weapon', 'gloves', 'amulet', 'ring', 'quiver', 'helm'], weight: 2, tiers: [T(1, 2, 3, '정밀의'), T(10, 4, 6, '저격수의'), T(20, 7, 10, '암살자의')] },
  { id: 'block', kind: 'suffix', k: 'block', on: ['shield'], weight: 2, tiers: [T(1, 3, 6, '수호의'), T(12, 7, 12, '방벽의')] },
  { id: 'dmgReduce', kind: 'suffix', k: 'dmgReduce', on: ['chest', 'shield', 'helm', 'belt'], weight: 1, tiers: [T(8, 1, 3, '완강함의'), T(18, 4, 8, '철벽의'), T(30, 9, 14, '금강의')] },
  { id: 'hpPct', kind: 'suffix', k: 'hpPct', on: ['belt', 'chest', 'amulet'], weight: 1, tiers: [T(10, 4, 8, '거목의'), T(20, 9, 15, '산맥의')] },
];

/** Which affix groups an item base can roll. */
export function slotGroups(b: BaseItem): SlotGroup[] {
  const g: SlotGroup[] = [];
  if (b.slot === 'weapon') { g.push('weapon'); if (b.caster) g.push('caster'); }
  if (b.cat === 'skull' || b.cat === 'totem') g.push('orb');
  if (b.cat === 'pouch') g.push('quiver');
  if (b.cat === 'shield') g.push('shield');
  if (b.cat === 'quiver') g.push('quiver');
  if (b.cat === 'orb') g.push('orb');
  if (b.slot === 'head') g.push('armor', 'helm');
  if (b.slot === 'chest') g.push('armor', 'chest');
  if (b.slot === 'gloves') g.push('armor', 'gloves');
  if (b.slot === 'boots') g.push('armor', 'boots');
  if (b.slot === 'belt') g.push('belt');
  if (b.slot === 'ring' || b.slot === 'amulet') g.push('jewel', b.slot as SlotGroup);
  return g;
}

// ---------------------------------------------------------------- uniques
export interface UniqueDef { id: string; name: string; base: string; req: number; mods: { k: ModKey; min: number; max: number; min2?: number; max2?: number }[]; lore: string; bossOnly?: string }
const U = (k: ModKey, min: number, max = min, min2?: number, max2?: number) => ({ k, min, max, min2, max2 });

export const UNIQUES: UniqueDef[] = [
  { id: 'gromakCleaver', name: '그로막의 식칼', base: 'battleAxe', req: 9, mods: [U('ed', 80, 120), U('lifeSteal', 5, 7), U('lifeKill', 4, 6), U('str', 10)], lore: '아직도 고기 냄새가 가시지 않는다.', bossOnly: 'gromak' },
  { id: 'thunderJudge', name: '천둥의 심판', base: 'warHammer', req: 21, mods: [U('ed', 110, 150), U('lightDmg', 5, 5, 50, 70), U('ias', 15), U('str', 12)], lore: '내리칠 때마다 하늘이 대답한다.' },
  { id: 'silentOath', name: '고요한 서약', base: 'longSword', req: 7, mods: [U('ed', 50, 70), U('resAll', 15), U('vit', 10), U('hpRegen', 2)], lore: '맹세를 지킨 기사의 유품.' },
  { id: 'ravenBow', name: '까마귀 깃 장궁', base: 'longBow', req: 11, mods: [U('ed', 60, 90), U('dex', 15), U('ias', 20), U('crit', 5), U('mf', 20)], lore: '화살이 날아갈 때 까마귀 울음이 들린다.' },
  { id: 'viperFang', name: '독사의 송곳니', base: 'compBow', req: 18, mods: [U('ed', 100, 140), U('poisonDmg', 25, 40), U('lifeSteal', 4), U('dex', 10)], lore: '한 번 물리면 놓아주지 않는다.' },
  { id: 'emberStaff', name: '잿불 지팡이', base: 'runeStaff', req: 8, mods: [U('spellDmg', 40, 60), U('fireDmg', 5, 8, 12, 20), U('ene', 15), U('skills', 1)], lore: '식지 않는 불씨가 지팡이 끝에 머문다.' },
  { id: 'deadWhisper', name: '망자의 속삭임', base: 'crystalWand', req: 15, mods: [U('spellDmg', 30, 45), U('manaSteal', 5), U('mp', 40), U('crit', 8)], lore: '귀를 기울이면 이름을 부르는 소리가 난다.' },
  { id: 'boneCrown', name: '해골 왕관', base: 'helm', req: 6, mods: [U('hp', 30), U('lifeKill', 3), U('armorPct', 60), U('resCold', 20)], lore: '망자의 주교가 쓰던 관.', bossOnly: 'ordes' },
  { id: 'sageHood', name: '현자의 두건', base: 'hornHelm', req: 15, mods: [U('mp', 50), U('ene', 20), U('mpRegen', 3), U('skills', 1)], lore: '생각이 맑아진다.' },
  { id: 'dragonScale', name: '용비늘 갑옷', base: 'plateMail', req: 17, mods: [U('armorPct', 100, 140), U('resFire', 40), U('hp', 40), U('thorns', 20)], lore: '용암 여왕조차 태우지 못한 비늘.', bossOnly: 'ignira' },
  { id: 'thiefHand', name: '도둑의 손', base: 'leatherGloves', req: 5, mods: [U('gf', 100), U('mf', 30), U('ias', 10), U('dex', 8)], lore: '주인의 허락 없이 금화를 모은다.' },
  { id: 'windStep', name: '바람걸음', base: 'steelBoots', req: 10, mods: [U('ms', 30), U('dex', 10), U('resLight', 25)], lore: '발자국이 남지 않는다.' },
  { id: 'giantBelt', name: '거인의 허리띠', base: 'leatherBelt', req: 13, mods: [U('str', 15), U('vit', 15), U('hpPct', 10)], lore: '두 사람이 둘러도 남는다.' },
  { id: 'immortalSeal', name: '불멸의 인장', base: 'ring', req: 20, mods: [U('lifeSteal', 5), U('hpRegen', 4), U('resAll', 15)], lore: '끼는 순간 심장 박동이 느려진다.' },
  { id: 'manaCircle', name: '마력의 고리', base: 'ring', req: 12, mods: [U('mp', 30), U('spellDmg', 20), U('mpRegen', 2), U('dmgPct', 10)], lore: '끝없이 도는 푸른 빛.' },
  { id: 'abyssEye', name: '심연의 눈', base: 'amulet', req: 24, mods: [U('skills', 2), U('resAll', 20), U('light', 3), U('mf', 30)], lore: '심연을 들여다보면, 심연도 너를 본다.', bossOnly: 'malegath' },
  { id: 'guardianWall', name: '수호자의 벽', base: 'tower', req: 15, mods: [U('block', 12), U('resAll', 25), U('armorPct', 120), U('vit', 10)], lore: '무너진 성문에서 뜯어낸 문짝.' },
  { id: 'hunterQuiverU', name: '사냥꾼의 긍지', base: 'hunterQuiver', req: 9, mods: [U('ias', 15), U('crit', 6), U('dex', 10), U('dmgPct', 15)], lore: '빈 화살통은 사냥꾼의 수치다.' },
  { id: 'starfall', name: '별의 낙하', base: 'starOrb', req: 14, mods: [U('spellDmg', 30), U('fireDmg', 4, 6, 10, 16), U('ene', 12), U('mp', 25)], lore: '구슬 속에서 별이 떨어진다.' },
  { id: 'dawnbringer', name: '새벽을 부르는 자', base: 'morningStar', req: 14, mods: [U('ed', 90, 130), U('lightDmg', 3, 3, 30, 45), U('resAll', 15), U('hpRegen', 3)], lore: '어둠 속에서도 새벽빛이 스며 나온다.' },
  { id: 'silkThread', name: '비단실', base: 'hookClaw', req: 15, mods: [U('ed', 90, 130), U('crit', 8), U('ias', 20), U('dex', 12)], lore: '베인 줄도 모르고 쓰러진다.' },
  { id: 'skyPiercer', name: '하늘 꿰뚫기', base: 'dragonLance', req: 21, mods: [U('ed', 110, 150), U('lightDmg', 4, 4, 40, 60), U('str', 12), U('ms', 10)], lore: '용을 떨어뜨린 창.' },
  { id: 'oldGrove', name: '고목의 심장', base: 'beastTotem', req: 11, mods: [U('spellDmg', 30, 40), U('hpRegen', 3), U('vit', 12), U('resPoison', 30)], lore: '천 년 된 나무의 심장이 아직 뛴다.' },
  { id: 'lichGrin', name: '리치의 웃음', base: 'hexSkull', req: 12, mods: [U('spellDmg', 30, 45), U('manaKill', 4), U('ene', 15), U('skills', 1)], lore: '밤마다 턱이 딱딱 부딪힌다.' },
  { id: 'stillWater', name: '고요한 물', base: 'tigerFist', req: 14, mods: [U('ed', 90, 120), U('ias', 20), U('dex', 15), U('lifeSteal', 4)], lore: '흐르지 않으나 모든 것을 삼킨다.' },
  { id: 'eclipseEdge', name: '일식의 칼날', base: 'duskblade', req: 12, mods: [U('ed', 100, 140), U('lifeSteal', 6), U('str', 12), U('resCold', 25)], lore: '해가 가려지면 칼날이 운다.' },
  { id: 'bloodPact', name: '피의 서약', base: 'gothicPlate', req: 24, mods: [U('hp', 80), U('lifeSteal', 4), U('str', 15), U('armorPct', 80)], lore: '피로 쓴 계약서는 찢을 수 없다.' },
];
export const UNIQUE_BY_ID: Record<string, UniqueDef> = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));

// ---------------------------------------------------------------- rare names
export const RARE_A = ['파멸', '공포', '해골', '피', '영혼', '악몽', '폭풍', '그림자', '재앙', '서리', '역병', '독수리', '늑대', '까마귀', '용', '망령', '분노', '황혼', '심연', '무덤', '벼락', '고통', '광기', '혼돈'];
export const RARE_B: Partial<Record<ItemCat, string[]>> & { any: string[] } = {
  sword: ['송곳니', '칼날', '이빨', '가시'], axe: ['쐐기', '도끼날', '부리'], mace: ['망치', '주먹', '분쇄자'], sword2h: ['대검', '처형자', '송곳니'], axe2h: ['절단기', '도끼날'],
  bow: ['활시위', '날개', '깃털', '뿔'], staff: ['지팡이', '막대', '가지'], wand: ['손가락', '뼈', '가시'],
  spear: ['창날', '뿔', '침'], claw: ['발톱', '송곳니', '손톱'], knuckle: ['주먹', '손마디', '권'], scythe: ['낫', '수확자', '초승달'],
  shield: ['방벽', '성벽', '비늘'], quiver: ['화살집', '둥지'], orb: ['눈', '구체', '별'], pouch: ['주머니', '비수'], skull: ['두개골', '해골', '머리'], totem: ['토템', '우상', '뿌리'],
  helm: ['왕관', '가면', '두개골', '관'], chest: ['갑주', '가죽', '껍질', '외투'], gloves: ['손아귀', '발톱', '손'], boots: ['발굽', '걸음', '발자국'], belt: ['사슬', '매듭', '허리띠'],
  ring: ['고리', '매듭', '눈'], amulet: ['부적', '심장', '눈물', '표식'],
  any: ['울부짖음', '속삭임'],
};

// ---------------------------------------------------------------- text
const r1 = (v: number) => (Math.round(v * 10) / 10).toString();
export function modText(m: Mod): string {
  const v = m.v;
  switch (m.k) {
    case 'str': return `힘 +${v}`;
    case 'dex': return `민첩 +${v}`;
    case 'vit': return `활력 +${v}`;
    case 'ene': return `에너지 +${v}`;
    case 'allAttr': return `모든 능력치 +${v}`;
    case 'hp': return `생명력 +${v}`;
    case 'mp': return `마나 +${v}`;
    case 'hpPct': return `최대 생명력 +${v}%`;
    case 'hpRegen': return `초당 생명력 재생 +${r1(v)}`;
    case 'mpRegen': return `초당 마나 재생 +${r1(v)}`;
    case 'armor': return `방어력 +${v}`;
    case 'armorPct': return `방어력 +${v}% (강화)`;
    case 'resFire': return `화염 저항 +${v}%`;
    case 'resCold': return `냉기 저항 +${v}%`;
    case 'resLight': return `번개 저항 +${v}%`;
    case 'resPoison': return `독 저항 +${v}%`;
    case 'resAll': return `모든 저항 +${v}%`;
    case 'ed': return `피해 +${v}% (강화)`;
    case 'dmgFlat': return `물리 피해 +${v}-${m.v2}`;
    case 'dmgPct': return `모든 피해 +${v}%`;
    case 'fireDmg': return `화염 피해 +${v}-${m.v2}`;
    case 'coldDmg': return `냉기 피해 +${v}-${m.v2}`;
    case 'lightDmg': return `번개 피해 +${v}-${m.v2}`;
    case 'poisonDmg': return `독 피해 +${v} (3초간)`;
    case 'ias': return `공격 속도 +${v}%`;
    case 'crit': return `치명타 확률 +${v}%`;
    case 'critDmg': return `치명타 피해 +${v}%`;
    case 'lifeSteal': return `생명력 흡수 ${v}%`;
    case 'manaSteal': return `마나 흡수 ${v}%`;
    case 'lifeKill': return `처치 시 생명력 +${v}`;
    case 'manaKill': return `처치 시 마나 +${v}`;
    case 'ms': return `이동 속도 +${v}%`;
    case 'block': return `막기 확률 +${v}%`;
    case 'mf': return `마법 아이템 발견 +${v}%`;
    case 'gf': return `금화 획득 +${v}%`;
    case 'light': return `시야 반경 +${v}`;
    case 'thorns': return `공격자에게 피해 ${v} 반사`;
    case 'skills': return `모든 기술 +${v}`;
    case 'spellDmg': return `주문 피해 +${v}%`;
    case 'dmgReduce': return `받는 피해 -${v}`;
  }
}

export const RARITY_COLOR: Record<string, string> = { normal: '#e8e2d6', magic: '#7c8cff', rare: '#f2e05a', unique: '#c8a45a' };
export const RARITY_NAME: Record<string, string> = { normal: '일반', magic: '마법', rare: '희귀', unique: '고유' };
