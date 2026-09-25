// Monster templates (base values at monster level 1; scaled by level in data/balance.ts),
// champion/unique modifiers and boss definitions.
import type { Elem, MonsterAi, MonsterMod, ProjKind } from '../sim/types';

export interface MonsterTpl {
  id: string; name: string; zone: number;
  hp: number; dmg: [number, number]; atk: number; speed: number; r: number; xp: number;
  ai: MonsterAi; range: number; proj?: ProjKind; projSpeed?: number; elem: Elem;
  res: Partial<Record<Elem, number>>;
  art: string; scale: number; color: string; color2: string;
  pack: [number, number]; weight: number;
  undead?: boolean; demon?: boolean; flying?: boolean;
  /** Seconds between special abilities (summon / charge / teleport). */
  special?: number; summon?: string; leader?: string;
}

const M = (t: MonsterTpl) => t;

export const MONSTERS: Record<string, MonsterTpl> = {
  // ===== Zone 1: 대성당 =====
  zombie: M({ id: 'zombie', name: '좀비', zone: 1, hp: 26, dmg: [2, 5], atk: 0.8, speed: 1.3, r: 0.35, xp: 13, ai: 'melee', range: 0.9, elem: 'phys', res: { poison: 30 }, art: 'zombie', scale: 1, color: '#6f7d5a', color2: '#3f4a33', pack: [2, 5], weight: 3, undead: true }),
  skeleton: M({ id: 'skeleton', name: '해골 전사', zone: 1, hp: 16, dmg: [2, 5], atk: 1.1, speed: 2.5, r: 0.32, xp: 11, ai: 'melee', range: 0.9, elem: 'phys', res: { poison: 50, cold: 20 }, art: 'skeleton', scale: 1, color: '#d8d0bc', color2: '#8a8272', pack: [3, 6], weight: 3, undead: true }),
  skelArcher: M({ id: 'skelArcher', name: '해골 궁수', zone: 1, hp: 12, dmg: [2, 4], atk: 0.8, speed: 2.3, r: 0.32, xp: 13, ai: 'ranged', range: 7, proj: 'arrow', projSpeed: 11, elem: 'phys', res: { poison: 50 }, art: 'skelArcher', scale: 1, color: '#d8d0bc', color2: '#6d5a3a', pack: [2, 4], weight: 2, undead: true }),
  fallen: M({ id: 'fallen', name: '타락자', zone: 1, hp: 9, dmg: [1, 4], atk: 1.3, speed: 3.2, r: 0.26, xp: 7, ai: 'swarm', range: 0.8, elem: 'phys', res: {}, art: 'fallen', scale: 0.8, color: '#b0402a', color2: '#5a1f14', pack: [5, 9], weight: 3, demon: true, leader: 'shaman' }),
  shaman: M({ id: 'shaman', name: '타락 주술사', zone: 1, hp: 18, dmg: [2, 5], atk: 0.6, speed: 2.4, r: 0.3, xp: 20, ai: 'summoner', range: 6, proj: 'firebolt', projSpeed: 8, elem: 'fire', res: { fire: 30 }, art: 'shaman', scale: 0.9, color: '#b0402a', color2: '#e0c040', pack: [1, 1], weight: 0, demon: true, special: 6 }),
  bat: M({ id: 'bat', name: '흡혈 박쥐', zone: 1, hp: 7, dmg: [1, 3], atk: 1.4, speed: 4.2, r: 0.25, xp: 7, ai: 'erratic', range: 0.8, elem: 'phys', res: {}, art: 'bat', scale: 0.9, color: '#4a3a4a', color2: '#b03030', pack: [3, 6], weight: 2, flying: true }),

  // ===== Zone 2: 지하 묘지 =====
  ghoul: M({ id: 'ghoul', name: '구울', zone: 2, hp: 30, dmg: [3, 7], atk: 1.0, speed: 2.4, r: 0.36, xp: 16, ai: 'melee', range: 0.9, elem: 'phys', res: { poison: 40 }, art: 'ghoul', scale: 1.05, color: '#8a8f78', color2: '#4a3a30', pack: [3, 5], weight: 3, undead: true }),
  spider: M({ id: 'spider', name: '묘지 거미', zone: 2, hp: 16, dmg: [2, 5], atk: 1.4, speed: 3.6, r: 0.3, xp: 12, ai: 'swarm', range: 0.8, elem: 'poison', res: { poison: 75 }, art: 'spider', scale: 0.9, color: '#3a3040', color2: '#8a2a2a', pack: [4, 7], weight: 2 }),
  skelMage: M({ id: 'skelMage', name: '해골 마법사', zone: 2, hp: 16, dmg: [3, 6], atk: 0.6, speed: 2.2, r: 0.32, xp: 18, ai: 'caster', range: 7, proj: 'coldbolt', projSpeed: 8, elem: 'cold', res: { cold: 50, poison: 50 }, art: 'skelMage', scale: 1, color: '#d8d0bc', color2: '#4060c0', pack: [2, 3], weight: 2, undead: true, special: 5 }),
  wraith: M({ id: 'wraith', name: '망령', zone: 2, hp: 22, dmg: [3, 6], atk: 1.0, speed: 2.8, r: 0.32, xp: 18, ai: 'ghost', range: 0.9, elem: 'cold', res: { phys: 40, cold: 50, poison: 75 }, art: 'wraith', scale: 1.05, color: '#8fb0c8', color2: '#304058', pack: [2, 4], weight: 2, undead: true, flying: true, special: 4 }),
  brute: M({ id: 'brute', name: '시체 거인', zone: 2, hp: 70, dmg: [6, 12], atk: 0.6, speed: 1.6, r: 0.55, xp: 34, ai: 'charger', range: 1.1, elem: 'phys', res: { poison: 30 }, art: 'brute', scale: 1.45, color: '#9a8a78', color2: '#5a3a30', pack: [1, 2], weight: 1, undead: true, special: 6 }),

  // ===== Zone 3: 불의 동굴 =====
  goatman: M({ id: 'goatman', name: '염소인간', zone: 3, hp: 32, dmg: [4, 8], atk: 1.1, speed: 2.8, r: 0.36, xp: 17, ai: 'melee', range: 1.0, elem: 'phys', res: {}, art: 'goatman', scale: 1.1, color: '#7a5a3a', color2: '#3a2a1a', pack: [3, 6], weight: 3, demon: true }),
  goatArcher: M({ id: 'goatArcher', name: '염소인간 궁수', zone: 3, hp: 24, dmg: [3, 7], atk: 0.8, speed: 2.6, r: 0.34, xp: 18, ai: 'ranged', range: 7.5, proj: 'arrow', projSpeed: 12, elem: 'phys', res: {}, art: 'goatArcher', scale: 1.05, color: '#8a6a4a', color2: '#3a2a1a', pack: [2, 4], weight: 2, demon: true }),
  lizard: M({ id: 'lizard', name: '용암 도마뱀', zone: 3, hp: 28, dmg: [4, 8], atk: 0.7, speed: 2.4, r: 0.4, xp: 19, ai: 'ranged', range: 6.5, proj: 'spit', projSpeed: 9, elem: 'fire', res: { fire: 60 }, art: 'lizard', scale: 1.1, color: '#8a3a1a', color2: '#f0a030', pack: [2, 4], weight: 2 }),
  troll: M({ id: 'troll', name: '동굴 트롤', zone: 3, hp: 80, dmg: [7, 14], atk: 0.7, speed: 2.0, r: 0.55, xp: 38, ai: 'charger', range: 1.2, elem: 'phys', res: { cold: 20 }, art: 'troll', scale: 1.5, color: '#5a6a4a', color2: '#2a3020', pack: [1, 2], weight: 1, special: 5 }),
  fireSpirit: M({ id: 'fireSpirit', name: '불꽃 정령', zone: 3, hp: 18, dmg: [4, 8], atk: 0.7, speed: 3.0, r: 0.3, xp: 16, ai: 'caster', range: 6, proj: 'firebolt', projSpeed: 9, elem: 'fire', res: { fire: 75, phys: 20 }, art: 'fireSpirit', scale: 0.9, color: '#ff8a20', color2: '#ffe060', pack: [2, 4], weight: 2, flying: true, special: 4 }),

  // ===== Zone 4: 심연 =====
  hound: M({ id: 'hound', name: '지옥견', zone: 4, hp: 30, dmg: [4, 9], atk: 1.3, speed: 4.0, r: 0.36, xp: 18, ai: 'swarm', range: 0.9, elem: 'fire', res: { fire: 50 }, art: 'hound', scale: 1.1, color: '#4a1a14', color2: '#ff6020', pack: [3, 6], weight: 3, demon: true }),
  knight: M({ id: 'knight', name: '파멸의 기사', zone: 4, hp: 62, dmg: [7, 13], atk: 0.9, speed: 2.3, r: 0.45, xp: 32, ai: 'melee', range: 1.1, elem: 'phys', res: { phys: 25, fire: 30 }, art: 'knight', scale: 1.25, color: '#3a2a2a', color2: '#c02020', pack: [2, 3], weight: 2, demon: true }),
  witch: M({ id: 'witch', name: '피의 마녀', zone: 4, hp: 30, dmg: [5, 10], atk: 0.7, speed: 2.6, r: 0.34, xp: 26, ai: 'caster', range: 7, proj: 'blood', projSpeed: 8, elem: 'fire', res: { fire: 40, light: 40 }, art: 'witch', scale: 1.05, color: '#7a1a3a', color2: '#e04070', pack: [2, 3], weight: 2, demon: true, flying: true, special: 5 }),
  eye: M({ id: 'eye', name: '심연의 눈', zone: 4, hp: 34, dmg: [4, 10], atk: 0.6, speed: 1.8, r: 0.4, xp: 24, ai: 'ranged', range: 8, proj: 'lightning', projSpeed: 12, elem: 'light', res: { light: 75 }, art: 'eye', scale: 1.1, color: '#5a2a6a', color2: '#e0e060', pack: [1, 3], weight: 1, demon: true, flying: true }),
  soulEater: M({ id: 'soulEater', name: '영혼 포식자', zone: 4, hp: 90, dmg: [8, 16], atk: 0.7, speed: 2.2, r: 0.6, xp: 42, ai: 'charger', range: 1.3, elem: 'phys', res: { cold: 30, poison: 30 }, art: 'soulEater', scale: 1.6, color: '#2a2030', color2: '#60f0a0', pack: [1, 1], weight: 1, demon: true, special: 5 }),

  // ===== Bosses =====
  ordes: M({ id: 'ordes', name: '망자의 주교 오르데스', zone: 1, hp: 420, dmg: [4, 9], atk: 0.9, speed: 2.2, r: 0.5, xp: 450, ai: 'boss', range: 7, proj: 'bone', projSpeed: 9, elem: 'phys', res: { poison: 60, cold: 30 }, art: 'ordes', scale: 1.45, color: '#d8d0bc', color2: '#6a2a8a', pack: [1, 1], weight: 0, undead: true }),
  gromak: M({ id: 'gromak', name: '갈고리 도살꾼 그로막', zone: 2, hp: 780, dmg: [9, 17], atk: 1.0, speed: 2.5, r: 0.7, xp: 900, ai: 'boss', range: 1.4, elem: 'phys', res: { poison: 30 }, art: 'gromak', scale: 1.8, color: '#a07060', color2: '#6a1a14', pack: [1, 1], weight: 0, demon: true }),
  ignira: M({ id: 'ignira', name: '용암 여왕 이그니라', zone: 3, hp: 1000, dmg: [10, 18], atk: 0.8, speed: 2.3, r: 0.65, xp: 1600, ai: 'boss', range: 8, proj: 'fireball', projSpeed: 9, elem: 'fire', res: { fire: 75, cold: -20 }, art: 'ignira', scale: 1.7, color: '#c03010', color2: '#ffd040', pack: [1, 1], weight: 0, demon: true }),
  malegath: M({ id: 'malegath', name: '심연의 군주 말레가스', zone: 4, hp: 1500, dmg: [10, 18], atk: 0.9, speed: 2.4, r: 0.85, xp: 4000, ai: 'boss', range: 1.8, elem: 'fire', res: { fire: 50, light: 30, cold: 20, poison: 40 }, art: 'malegath', scale: 2.2, color: '#5a1010', color2: '#ff4010', pack: [1, 1], weight: 0, demon: true }),
};

export const BOSS_OF_FLOOR: Record<number, string> = { 3: 'ordes', 6: 'gromak', 9: 'ignira', 12: 'malegath' };
export const BOSS_LINES: Record<string, { intro: string; death: string }> = {
  ordes: { intro: '"살아있는 자여… 너도 곧 내 신도가 되리라."', death: '"주인님… 용서를…"' },
  gromak: { intro: '"아! 신선한 고기다!"', death: '"고기… 더…"' },
  ignira: { intro: '"내 불길 속에서 재가 되어라!"', death: '"불꽃은… 꺼지지 않는다…"' },
  malegath: { intro: '"필멸자여, 심연은 너를 기다려왔다."', death: '"이것으로… 끝이 아니다…"' },
};

export interface MonModDef { id: MonsterMod; name: string; color: string }
export const MON_MODS: Record<MonsterMod, MonModDef> = {
  fast: { id: 'fast', name: '신속', color: '#a0ffa0' },
  strong: { id: 'strong', name: '괴력', color: '#ffa080' },
  stone: { id: 'stone', name: '돌가죽', color: '#c0b090' },
  fireEnch: { id: 'fireEnch', name: '화염 강화', color: '#ff7030' },
  coldEnch: { id: 'coldEnch', name: '냉기 강화', color: '#80c0ff' },
  lightEnch: { id: 'lightEnch', name: '번개 강화', color: '#ffff70' },
  teleport: { id: 'teleport', name: '순간이동', color: '#d090ff' },
  vampiric: { id: 'vampiric', name: '흡혈', color: '#ff5070' },
  multishot: { id: 'multishot', name: '다중 사격', color: '#ffd080' },
  hardy: { id: 'hardy', name: '강건', color: '#ffe0a0' },
};

export const UNIQUE_MON_A = ['썩은', '피투성이', '뼈를 씹는', '굶주린', '울부짖는', '저주받은', '재앙의', '눈먼', '미친', '잔혹한', '검은', '비명의'];
export const UNIQUE_MON_B = ['송곳니', '발톱', '해골', '칼날', '그림자', '이빨', '가죽', '심장', '눈알', '뿔', '갈고리', '손톱'];
