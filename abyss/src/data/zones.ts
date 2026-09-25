// Zones (tilesets + monster pools), difficulty, level scaling and loot tables.
// Every balance knob that is not a skill or an item lives here.

export interface ZoneDef {
  id: number; name: string; gen: 'town' | 'cathedral' | 'catacombs' | 'caves' | 'abyss';
  monsters: string[];
  darkness: number;          // alpha of the darkness overlay outside light
  floorColors: [string, string, string];   // base, dark, light
  wallColors: [string, string, string];    // top, left face, right face
  mortar: string; accent: string; fog: string;
  music: 'town' | 'dungeon1' | 'dungeon2' | 'dungeon3' | 'dungeon4';
}

export const ZONES: ZoneDef[] = [
  { id: 0, name: '잿빛마을', gen: 'town', monsters: [], darkness: 0.5, floorColors: ['#3c4a2c', '#2e3a22', '#4a5a36'], wallColors: ['#5a4632', '#7a6448', '#5e4c36'], mortar: '#2e2418', accent: '#ffb060', fog: '#0a0c14', music: 'town' },
  { id: 1, name: '버려진 대성당', gen: 'cathedral', monsters: ['zombie', 'skeleton', 'skelArcher', 'fallen', 'bat'], darkness: 0.94, floorColors: ['#4a4640', '#36332e', '#5a564e'], wallColors: ['#6a655c', '#56524a', '#403d37'], mortar: '#23211d', accent: '#ffb050', fog: '#050506', music: 'dungeon1' },
  { id: 2, name: '지하 묘지', gen: 'catacombs', monsters: ['ghoul', 'spider', 'skelMage', 'wraith', 'brute', 'skeleton'], darkness: 0.95, floorColors: ['#4a3c30', '#382c22', '#5a4a3a'], wallColors: ['#6a5040', '#584234', '#402e24'], mortar: '#20160f', accent: '#ff9040', fog: '#060403', music: 'dungeon2' },
  { id: 3, name: '불의 동굴', gen: 'caves', monsters: ['goatman', 'goatArcher', 'lizard', 'troll', 'fireSpirit'], darkness: 0.93, floorColors: ['#3e342c', '#2c241e', '#4e4236'], wallColors: ['#5a4a3e', '#463a30', '#322820'], mortar: '#1a1410', accent: '#ff6020', fog: '#080302', music: 'dungeon3' },
  { id: 4, name: '심연', gen: 'abyss', monsters: ['hound', 'knight', 'witch', 'eye', 'soulEater'], darkness: 0.92, floorColors: ['#3a1e1c', '#2a1412', '#4a2622'], wallColors: ['#5a2a24', '#4a201c', '#341412'], mortar: '#140606', accent: '#ff3010', fog: '#0c0202', music: 'dungeon4' },
];

export const FLOORS_PER_ZONE = 3;
export const LAST_FLOOR = 12;
export const zoneOfFloor = (f: number): number => (f <= 0 ? 0 : Math.min(4, Math.ceil(f / FLOORS_PER_ZONE)));
export const floorName = (f: number): string => (f <= 0 ? ZONES[0].name : `${ZONES[zoneOfFloor(f)].name} ${((f - 1) % FLOORS_PER_ZONE) + 1}층`);

export const DIFFICULTIES = [
  { id: 0, name: '보통', resPenalty: 0, color: '#e8e2d6' },
  { id: 1, name: '악몽', resPenalty: 20, color: '#ff9a50' },
  { id: 2, name: '지옥', resPenalty: 50, color: '#ff4040' },
];

/** Monster level for a floor/difficulty. */
export function floorMonsterLevel(floor: number, diff: number): number {
  if (diff === 0) return 2 * floor - 1;
  if (diff === 1) return Math.round(22 + 1.5 * (floor - 1));
  return Math.round(40 + 1.0 * (floor - 1));
}

/** Multiplicative growth per monster level; flattens after level 30 so gear (which caps around ilvl 36) can keep up. */
function growth(level: number, early: number, late: number): number {
  const l = Math.max(1, level) - 1;
  const a = Math.min(l, 29);
  const b = Math.max(0, l - 29);
  return Math.pow(early, a) * Math.pow(late, b);
}
export const monsterHpScale = (lvl: number) => growth(lvl, 1.155, 1.06) * (1 + 0.03 * (lvl - 1));
export const monsterDmgScale = (lvl: number) => growth(lvl, 1.105, 1.045);
export const monsterXpScale = (lvl: number) => growth(lvl, 1.16, 1.07);

export const RANK_MULT = {
  normal: { hp: 1, dmg: 1, xp: 1 },
  minion: { hp: 1.4, dmg: 1.15, xp: 1.6 },
  champion: { hp: 2.6, dmg: 1.45, xp: 3.5 },
  unique: { hp: 4.2, dmg: 1.7, xp: 6 },
  boss: { hp: 1, dmg: 1, xp: 1 },
};

/** Loot. Probabilities before magic find. */
export const LOOT = {
  goldChance: { normal: 0.32, minion: 0.4, champion: 1, unique: 1, boss: 1 },
  potChance: { normal: 0.085, minion: 0.1, champion: 0.5, unique: 0.8, boss: 1 },
  itemChance: { normal: 0.085, minion: 0.14, champion: 0.9, unique: 1, boss: 1 },
  itemCount: { normal: 1, minion: 1, champion: 2, unique: 3, boss: 6 },
  /** base chance per rarity (checked unique → rare → magic). */
  unique: 0.012, rare: 0.075, magic: 0.34,
  /** bonus rarity rolls for elite drops (multiplier on chances). */
  eliteBonus: { normal: 1, minion: 1.3, champion: 2.2, unique: 3, boss: 4 },
  classBias: 0.6,
};

export const SHRINES = [
  { id: 'shrineDmg', name: '전투의 성소', desc: '60초간 피해 +30%', color: '#ff6040' },
  { id: 'shrineArmor', name: '수호의 성소', desc: '60초간 방어력 +60%', color: '#60a0ff' },
  { id: 'shrineXp', name: '경험의 성소', desc: '120초간 경험치 +25%', color: '#ffe060' },
  { id: 'shrineMf', name: '행운의 성소', desc: '120초간 마법 아이템 발견 +75%', color: '#60ff90' },
  { id: 'shrineSpeed', name: '신속의 성소', desc: '60초간 이동·공격 속도 +20%', color: '#c080ff' },
  { id: 'heal', name: '회복의 성소', desc: '생명력과 마나를 모두 회복', color: '#ff80a0' },
] as const;

export const PRICES = { potHp: 30, potMp: 25, scroll: 60, healFree: true };
export const MAX_POTIONS = 20;
export const MAX_SCROLLS = 20;
export const INV_SIZE = 40;
export const STASH_SIZE = 60;
