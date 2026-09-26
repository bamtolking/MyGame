// Character classes and their skills. All skill damage scales off weapon damage (percent of a weapon hit),
// so every class cares about weapon upgrades. Numbers here are the only place skill balance lives.
// The three starting classes live in this file; the seven unlockable classes each have their own folder
// under src/classes/<id>/ (data.ts here, sim.ts / art.ts / sfx.ts register behaviour, visuals and sounds).
import type { Attrs, ClassId, Elem, HeroActKind } from '../sim/types';
import { CLASS_IDS } from '../sim/types';
import { PALADIN } from '../classes/paladin/data';
import { ASSASSIN } from '../classes/assassin/data';
import { LANCER } from '../classes/lancer/data';
import { NECROMANCER } from '../classes/necromancer/data';
import { DRUID } from '../classes/druid/data';
import { MONK } from '../classes/monk/data';
import { VOIDKNIGHT } from '../classes/voidknight/data';

/** How a locked class is earned (tracked account-wide across all characters). */
export interface Unlock {
  /** Defeat this boss template (on difficulty >= diff). */
  boss?: string;
  /** Defeat any boss on at least this difficulty (0 normal, 1 nightmare, 2 hell). */
  diff?: number;
  /** Reach this hero level with any character. */
  level?: number;
  /** Shown on the locked class card. */
  text: string;
}

export interface ClassDef {
  id: ClassId; name: string; title: string; desc: string;
  attrs: Attrs; main: keyof Attrs;
  hpBase: number; hpLvl: number; hpVit: number;
  mpBase: number; mpLvl: number; mpEne: number;
  color: string; accent: string;
  /** Default stat allocation used by the auto-allocate button and the test bot. */
  autoAttr: Attrs;
  startGear: string[];
  skills: string[];
  basic: string;
  /** null = playable from the start. */
  unlock: Unlock | null;
  /** Fights from range (affects AI-free heuristics only: auto-aim, bot). */
  ranged: boolean;
  /** Spell caster: spell damage affixes apply, +30% mana regen, more mana potions drop. */
  spell: boolean;
  /** Critical chance gained per point of dexterity. */
  critPerDex: number;
  /** Extra melee reach (tiles), and extra reach while wielding a two-handed weapon. */
  reach: number; reach2h: number;
  /** Example offhand shown in the empty equipment slot ('' = two-handed class). */
  offhandHint: string;
}

export type SkillKind = 'melee' | 'proj' | 'target' | 'self' | 'move';

export interface SkillDef {
  id: string; cls: ClassId | 'any'; name: string; icon: string;
  req: number; kind: SkillKind; range: number; elem: Elem;
  /** Needs a hostile target in reach (melee). */
  mana: (r: number) => number;
  cd: (r: number) => number;
  pct: (r: number) => number;
  desc: string;
  detail: (r: number) => string[];
  /** Hero pose: 'attack' swings/shoots the weapon, 'cast' raises the hands. Default: attack for melee/basic, cast for spell classes. */
  anim?: 'attack' | 'cast';
  /** Movement skills: 'teleport' passes walls, 'leap' needs sight, 'dash' stops at obstacles, 'behind' lands behind the target monster. */
  move?: 'teleport' | 'leap' | 'dash' | 'behind';
  /** Act timing. dur: seconds (or × attack time when rel), hitAt: fraction of dur, invuln: seconds of invulnerability. */
  timing?: { kind?: HeroActKind; dur?: number; rel?: boolean; hitAt?: number; invuln?: number };
  /** Hints for the headless test bot: when is this skill worth pressing. */
  ai?: { crowd?: number; boss?: boolean; minDist?: number; maxDist?: number; lowHp?: number; buff?: boolean; away?: boolean };
}

/** What a class module's data.ts exports. */
export interface ClassPack { def: ClassDef; skills: SkillDef[] }

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior', name: '전사', title: '강철의 수호자',
    desc: '두꺼운 갑옷과 방패로 적진 한가운데를 버티며 근접 무기로 적을 쓸어버립니다. 초보자에게 추천.',
    attrs: { str: 25, dex: 20, vit: 25, ene: 10 }, main: 'str',
    hpBase: 48, hpLvl: 4, hpVit: 2.5, mpBase: 10, mpLvl: 1, mpEne: 1.2,
    color: '#8a2a1e', accent: '#e0a060',
    autoAttr: { str: 2, dex: 1, vit: 2, ene: 0 },
    startGear: ['shortSword', 'buckler', 'quilted'],
    skills: ['bash', 'cleave', 'warcry', 'leap', 'berserk'],
    basic: 'attack',
    unlock: null, ranged: false, spell: false, critPerDex: 0, reach: 0, reach2h: 0.35, offhandHint: 'kite',
  },
  rogue: {
    id: 'rogue', name: '레인저', title: '그림자 사냥꾼',
    desc: '활로 먼 거리에서 적을 꿰뚫습니다. 빠른 발과 회피로 적과 거리를 유지하세요.',
    attrs: { str: 15, dex: 30, vit: 20, ene: 15 }, main: 'dex',
    hpBase: 40, hpLvl: 3, hpVit: 2.2, mpBase: 14, mpLvl: 1.5, mpEne: 1.5,
    color: '#2e5a2a', accent: '#b8d080',
    autoAttr: { str: 0, dex: 3, vit: 2, ene: 0 },
    startGear: ['shortBow', 'leatherQuiver', 'leatherCap'],
    skills: ['multishot', 'explode', 'rain', 'dash', 'strafe'],
    basic: 'shoot',
    unlock: null, ranged: true, spell: false, critPerDex: 0.03, reach: 0, reach2h: 0, offhandHint: 'hunterQuiver',
  },
  sorcerer: {
    id: 'sorcerer', name: '소서러', title: '원소의 지배자',
    desc: '불과 얼음, 번개를 다룹니다. 몸은 약하지만 강력한 범위 마법으로 무리를 한꺼번에 태웁니다.',
    attrs: { str: 10, dex: 15, vit: 20, ene: 35 }, main: 'ene',
    hpBase: 36, hpLvl: 2.5, hpVit: 2, mpBase: 20, mpLvl: 2, mpEne: 2,
    color: '#2a3a7a', accent: '#90b0ff',
    autoAttr: { str: 0, dex: 0, vit: 2, ene: 3 },
    startGear: ['oakStaff', 'quilted'],
    skills: ['fireball', 'frostnova', 'chain', 'teleport', 'meteor'],
    basic: 'bolt',
    unlock: null, ranged: true, spell: true, critPerDex: 0, reach: 0, reach2h: 0, offhandHint: 'starOrb',
  },
  paladin: PALADIN.def,
  assassin: ASSASSIN.def,
  lancer: LANCER.def,
  necromancer: NECROMANCER.def,
  druid: DRUID.def,
  monk: MONK.def,
  voidknight: VOIDKNIGHT.def,
};

/** Classes in display / unlock order. */
export const CLASS_ORDER: ClassId[] = CLASS_IDS;

const pctTxt = (v: number) => `무기 피해의 ${Math.round(v)}%`;

export const SKILLS: Record<string, SkillDef> = {
  // ---- basic attacks ----
  attack: {
    id: 'attack', cls: 'warrior', name: '공격', icon: 'sword', req: 1, kind: 'melee', range: 1.2, elem: 'phys',
    mana: () => 0, cd: () => 0, pct: () => 100,
    desc: '무기로 적을 벱니다.', detail: () => [pctTxt(100)],
  },
  shoot: {
    id: 'shoot', cls: 'rogue', name: '사격', icon: 'arrow', req: 1, kind: 'proj', range: 12, elem: 'phys',
    mana: () => 0, cd: () => 0, pct: () => 100,
    desc: '화살을 쏩니다.', detail: () => [pctTxt(100)],
  },
  bolt: {
    id: 'bolt', cls: 'sorcerer', name: '마력탄', icon: 'bolt', req: 1, kind: 'proj', range: 11, elem: 'phys',
    mana: () => 0, cd: () => 0, pct: () => 100,
    desc: '순수한 마력 덩어리를 날립니다.', detail: () => [pctTxt(100)],
  },

  // ---- warrior ----
  bash: {
    id: 'bash', cls: 'warrior', name: '강타', icon: 'bash', req: 1, kind: 'melee', range: 1.2, elem: 'phys',
    mana: (r) => 2 + Math.floor(r * 0.25), cd: () => 0, pct: (r) => 150 + 20 * r,
    desc: '온 힘을 실어 내리쳐 적을 밀쳐내고 잠시 기절시킵니다.',
    detail: (r) => [pctTxt(150 + 20 * r), `기절 ${(0.5 + 0.05 * r).toFixed(2)}초 · 밀쳐내기`],
  },
  cleave: {
    id: 'cleave', cls: 'warrior', name: '회전 베기', icon: 'cleave', req: 3, kind: 'self', range: 2.4, elem: 'phys',
    mana: (r) => 4 + Math.floor(r * 0.35), cd: () => 0, pct: (r) => 110 + 13 * r,
    desc: '몸을 회전하며 주변의 모든 적을 벱니다.',
    detail: (r) => [pctTxt(110 + 13 * r), `반경 ${(2.3 + 0.05 * r).toFixed(1)}칸`],
  },
  warcry: {
    id: 'warcry', cls: 'warrior', name: '전쟁의 함성', icon: 'warcry', req: 6, kind: 'self', range: 4, elem: 'phys',
    mana: () => 8, cd: () => 16, pct: (r) => 25 + 5 * r,
    desc: '포효하여 주변 적을 기절시키고 10초간 피해와 방어력이 증가합니다.',
    detail: (r) => [`피해 +${25 + 5 * r}% · 방어 +40%`, `주변 적 기절 ${(1 + 0.1 * r).toFixed(1)}초`, '재사용 16초'],
  },
  leap: {
    id: 'leap', cls: 'warrior', name: '도약 강타', icon: 'leap', req: 10, kind: 'move', range: 7, elem: 'phys', move: 'leap',
    mana: () => 10, cd: (r) => Math.max(2.5, 5 - 0.2 * r), pct: (r) => 200 + 25 * r,
    desc: '목표 지점으로 뛰어올라 착지하며 주변 적에게 피해를 주고 밀쳐냅니다.',
    detail: (r) => [pctTxt(200 + 25 * r), '반경 2.4칸 · 최대 7칸', `재사용 ${Math.max(2.5, 5 - 0.2 * r).toFixed(1)}초`],
  },
  berserk: {
    id: 'berserk', cls: 'warrior', name: '광폭화', icon: 'berserk', req: 15, kind: 'self', range: 0, elem: 'phys',
    mana: () => 15, cd: () => 30, pct: (r) => 50 + 6 * r,
    desc: '10초간 광기에 휩싸여 공격 속도와 피해가 크게 오르고 생명력을 흡수합니다.',
    detail: (r) => [`피해 +${50 + 6 * r}% · 공격 속도 +40%`, '생명력 흡수 6%', '재사용 30초'],
  },

  // ---- rogue ----
  multishot: {
    id: 'multishot', cls: 'rogue', name: '다중 사격', icon: 'multishot', req: 1, kind: 'proj', range: 12, elem: 'phys',
    mana: (r) => 3 + Math.floor(r * 0.3), cd: () => 0, pct: (r) => 75 + 7 * r,
    desc: '부채꼴로 여러 발의 화살을 동시에 쏩니다.',
    detail: (r) => [`화살 ${3 + Math.min(4, Math.floor(r / 3))}발`, `각 ${pctTxt(75 + 7 * r)}`],
  },
  explode: {
    id: 'explode', cls: 'rogue', name: '폭발 화살', icon: 'explode', req: 3, kind: 'proj', range: 12, elem: 'fire',
    mana: (r) => 5 + Math.floor(r * 0.4), cd: () => 0, pct: (r) => 150 + 17 * r,
    desc: '적중 시 폭발하는 화살. 주변 적에게 화염 피해를 줍니다.',
    detail: (r) => [`${pctTxt(150 + 17 * r)} (화염)`, '폭발 반경 1.8칸'],
  },
  rain: {
    id: 'rain', cls: 'rogue', name: '화살비', icon: 'rain', req: 6, kind: 'target', range: 11, elem: 'phys',
    mana: (r) => 9 + Math.floor(r * 0.4), cd: () => 1.2, pct: (r) => 45 + 6 * r,
    desc: '목표 지역에 화살을 퍼부어 적을 둔화시키고 여러 번 피해를 줍니다.',
    detail: (r) => [`8회 × ${pctTxt(45 + 6 * r)}`, '반경 2.6칸 · 둔화'],
  },
  dash: {
    id: 'dash', cls: 'rogue', name: '그림자 질주', icon: 'dash', req: 10, kind: 'move', range: 6, elem: 'phys', move: 'dash',
    mana: () => 6, cd: (r) => Math.max(1.8, 4 - 0.2 * r), pct: (r) => 30 + 3 * r,
    desc: '그림자처럼 순식간에 이동하고 3초간 공격을 회피할 확률이 생깁니다.',
    detail: (r) => [`회피 ${Math.min(60, 30 + 3 * r)}% (3초)`, `재사용 ${Math.max(1.8, 4 - 0.2 * r).toFixed(1)}초`],
  },
  strafe: {
    id: 'strafe', cls: 'rogue', name: '폭풍 사격', icon: 'strafe', req: 15, kind: 'self', range: 10, elem: 'phys',
    mana: () => 16, cd: () => 8, pct: (r) => 90 + 9 * r,
    desc: '주변의 적들에게 자동으로 화살을 연사합니다.',
    detail: (r) => [`화살 ${10 + r}발 × ${pctTxt(90 + 9 * r)}`, '재사용 8초'],
  },

  // ---- sorcerer ----
  fireball: {
    id: 'fireball', cls: 'sorcerer', name: '화염구', icon: 'fireball', req: 1, kind: 'proj', range: 12, elem: 'fire',
    mana: (r) => 5 + Math.floor(r * 0.45), cd: () => 0, pct: (r) => 165 + 20 * r,
    desc: '폭발하는 불덩이를 던져 주변 적까지 태웁니다.',
    detail: (r) => [`${pctTxt(165 + 20 * r)} (화염)`, '폭발 반경 1.5칸'],
  },
  frostnova: {
    id: 'frostnova', cls: 'sorcerer', name: '서리 고리', icon: 'frostnova', req: 3, kind: 'self', range: 4.5, elem: 'cold',
    mana: (r) => 9 + Math.floor(r * 0.3), cd: () => 2, pct: (r) => 100 + 12 * r,
    desc: '냉기의 고리를 퍼뜨려 주변 적을 얼립니다. 우두머리는 둔화됩니다.',
    detail: (r) => [`${pctTxt(100 + 12 * r)} (냉기)`, `빙결 ${(1.4 + 0.1 * r).toFixed(1)}초 · 반경 4.5칸`, '재사용 2초'],
  },
  chain: {
    id: 'chain', cls: 'sorcerer', name: '연쇄 번개', icon: 'chain', req: 6, kind: 'proj', range: 10, elem: 'light',
    mana: (r) => 9 + Math.floor(r * 0.4), cd: () => 0, pct: (r) => 150 + 18 * r,
    desc: '적에서 적으로 튀는 번개를 발사합니다. 피해 편차가 큽니다.',
    detail: (r) => [`${pctTxt(150 + 18 * r)} (번개)`, `최대 ${4 + Math.floor(r / 3)}명 연쇄`],
  },
  teleport: {
    id: 'teleport', cls: 'sorcerer', name: '순간이동', icon: 'teleport', req: 10, kind: 'move', range: 9, elem: 'phys', move: 'teleport',
    mana: (r) => Math.max(6, 14 - r), cd: () => 0.6, pct: () => 0,
    desc: '목표 지점으로 즉시 이동합니다.',
    detail: (r) => [`최대 9칸`, `마나 ${Math.max(6, 14 - r)}`],
  },
  meteor: {
    id: 'meteor', cls: 'sorcerer', name: '유성', icon: 'meteor', req: 15, kind: 'target', range: 11, elem: 'fire',
    mana: () => 22, cd: () => 5, pct: (r) => 380 + 40 * r,
    desc: '하늘에서 유성을 떨어뜨려 넓은 범위를 불태우고 땅에 불길을 남깁니다.',
    detail: (r) => [`${pctTxt(380 + 40 * r)} (화염)`, '반경 2.8칸 · 불타는 땅 3초', '재사용 5초'],
  },
};

for (const pack of [PALADIN, ASSASSIN, LANCER, NECROMANCER, DRUID, MONK, VOIDKNIGHT]) for (const sk of pack.skills) SKILLS[sk.id] = sk;

/** The pose a skill uses (see SkillDef.anim). */
export function skillAnim(cls: ClassId, id: string): 'attack' | 'cast' {
  const d = SKILLS[id];
  if (!d) return 'attack';
  if (d.anim) return d.anim;
  if (id === 'warcry' || id === 'berserk') return 'cast';
  if (id === CLASSES[cls].basic || d.kind === 'melee' || d.kind === 'move') return 'attack';
  return CLASSES[cls].spell ? 'cast' : 'attack';
}

export const MAX_SKILL_RANK = 10;
export const MAX_LEVEL = 50;
export const STAT_PTS_PER_LEVEL = 5;

/** Total XP needed to go from level L to L+1. */
export function xpToNext(level: number): number {
  return Math.round(60 * Math.pow(level, 2.05) + 40 * level);
}
