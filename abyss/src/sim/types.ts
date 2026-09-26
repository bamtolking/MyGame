// Core shared types. The simulation (src/sim) is plain TypeScript with no DOM access.

export type ClassId = 'warrior' | 'rogue' | 'sorcerer' | 'paladin' | 'assassin' | 'lancer' | 'druid' | 'necromancer' | 'monk' | 'voidknight';
export const CLASS_IDS: ClassId[] = ['warrior', 'rogue', 'sorcerer', 'paladin', 'assassin', 'lancer', 'necromancer', 'druid', 'monk', 'voidknight'];
export type Elem = 'phys' | 'fire' | 'cold' | 'light' | 'poison';
export const ELEMS: Elem[] = ['phys', 'fire', 'cold', 'light', 'poison'];

export type Slot = 'weapon' | 'offhand' | 'head' | 'chest' | 'gloves' | 'boots' | 'belt' | 'amulet' | 'ring';
export type EquipSlot = 'weapon' | 'offhand' | 'head' | 'chest' | 'gloves' | 'boots' | 'belt' | 'amulet' | 'ring1' | 'ring2';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'offhand', 'head', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring1', 'ring2'];
export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';

export type ModKey =
  | 'str' | 'dex' | 'vit' | 'ene' | 'allAttr'
  | 'hp' | 'mp' | 'hpPct' | 'hpRegen' | 'mpRegen'
  | 'armor' | 'armorPct'
  | 'resFire' | 'resCold' | 'resLight' | 'resPoison' | 'resAll'
  | 'ed' | 'dmgFlat' | 'dmgPct' | 'fireDmg' | 'coldDmg' | 'lightDmg' | 'poisonDmg'
  | 'ias' | 'crit' | 'critDmg' | 'lifeSteal' | 'manaSteal' | 'lifeKill' | 'manaKill'
  | 'ms' | 'block' | 'mf' | 'gf' | 'light' | 'thorns' | 'skills' | 'spellDmg' | 'dmgReduce';

/** A rolled modifier. Range mods (flat damage) use v as min and v2 as max. */
export interface Mod { k: ModKey; v: number; v2?: number }

export interface Item {
  uid: number;
  base: string;
  rarity: Rarity;
  ilvl: number;
  req: number;
  name: string;
  mods: Mod[];
  /** Rolled base values. */
  armor?: number;
  dmg?: [number, number];
  block?: number;
  uniq?: string;
}

export interface Attrs { str: number; dex: number; vit: number; ene: number }

/** Derived, cached hero stats (recomputed whenever gear/level/buffs change). */
export interface HeroStats {
  str: number; dex: number; vit: number; ene: number;
  maxHp: number; maxMp: number; hpRegen: number; mpRegen: number;
  armor: number;
  res: Record<Elem, number>;
  wMin: number; wMax: number;
  adds: Record<Exclude<Elem, 'phys'>, [number, number]>;
  dmgMult: number; spellMult: number;
  aps: number; crit: number; critMult: number;
  lifeSteal: number; manaSteal: number; lifeKill: number; manaKill: number;
  moveSpeed: number; block: number; mf: number; gf: number; light: number; thorns: number;
  skills: number; dmgReduce: number; dodge: number;
  /** Percent of incoming damage prevented by buffs (bone armor, void shroud…). */
  dmgTakenPct: number;
  ranged: boolean; reach: number;
}

export interface Vec { x: number; y: number }

export interface Dmg {
  phys: number; fire: number; cold: number; light: number; poison: number;
  crit?: boolean;
  kb?: number;        // knockback distance
  stun?: number;      // seconds
  freeze?: number;    // seconds (hard CC)
  chill?: number;     // seconds (50% slow)
  src?: number;       // source entity id (0 = hero)
  via?: 'melee' | 'proj' | 'spell';
  noLeech?: boolean;
  srcX?: number; srcY?: number;
}

/** Built-in buffs have hard-coded effects; class skills use any id and describe their effect with `mods`. */
export type BuffId = 'warcry' | 'berserk' | 'evade' | 'shrineDmg' | 'shrineArmor' | 'shrineXp' | 'shrineMf' | 'shrineSpeed' | (string & {});
/** Flat stat bonuses a buff grants while active (percentages are in points, e.g. 30 = +30%). */
export interface BuffMods {
  dmgPct?: number; ias?: number; armorPct?: number; armor?: number; lifeSteal?: number; manaSteal?: number;
  dodge?: number; ms?: number; hpRegen?: number; mpRegen?: number; crit?: number; critDmg?: number;
  resAll?: number; block?: number; thorns?: number;
  /** Percent less damage taken (capped at 60). */
  dmgTaken?: number;
}
export interface Buff { id: BuffId; t: number; dur: number; v: number; mods?: BuffMods; color?: string; name?: string }

export type HeroActKind = 'attack' | 'skill' | 'leap' | 'dash' | 'channel';
export interface HeroAct {
  kind: HeroActKind;
  skill: string;        // skill id ('attack' for basic)
  t: number; dur: number; hitAt: number; fired: boolean;
  tx: number; ty: number; targetId: number;
  fx: number; fy: number; // origin (for leap / dash)
  n?: number;             // channel counter
  ids?: number[];         // per-act bookkeeping for class skills (e.g. monsters already struck)
  data?: Record<string, number>;
}

export type Intent =
  | { type: 'move'; x: number; y: number }
  | { type: 'dir'; dx: number; dy: number }
  | { type: 'attack'; id: number; hold: boolean }
  | { type: 'attackPoint'; x: number; y: number }
  | { type: 'skill'; slot: number; x: number; y: number; id: number }
  | { type: 'interact'; kind: 'prop' | 'npc' | 'drop' | 'stairs'; id: number; x: number; y: number };

export interface Entity { id: number; x: number; y: number; r: number }

export interface Hero extends Entity {
  cls: ClassId; name: string; level: number; xp: number; gold: number;
  attrs: Attrs; freePts: number; skillPts: number; skills: Record<string, number>;
  equip: Record<EquipSlot, Item | null>;
  inv: (Item | null)[];
  potHp: number; potMp: number; scrolls: number;
  rmbSkill: number;
  // transient
  hp: number; mp: number; st: HeroStats; dirty: boolean;
  facing: number; anim: number; moving: boolean; speedNow: number;
  act: HeroAct | null; intent: Intent | null; path: Vec[] | null; pathGoal: Vec | null;
  cds: number[]; buffs: Buff[];
  potT: number; hitT: number; invulnT: number; chillT: number; blockT: number; dead: boolean; deadT: number;
  regenHp: number; potHeal: number;
  kills: number; deaths: number; playTime: number;
}

export type MonsterAi = 'melee' | 'ranged' | 'caster' | 'swarm' | 'erratic' | 'charger' | 'summoner' | 'ghost' | 'boss';
export type MonsterRank = 'normal' | 'champion' | 'unique' | 'minion' | 'boss';
export type MonsterMod = 'fast' | 'strong' | 'stone' | 'fireEnch' | 'coldEnch' | 'lightEnch' | 'teleport' | 'vampiric' | 'multishot' | 'hardy';

export interface MonAct { kind: 'melee' | 'shoot' | 'cast' | 'special'; t: number; dur: number; hitAt: number; done: boolean; tx: number; ty: number; spec: string }

export interface Monster extends Entity {
  tpl: string; lvl: number; name: string; rank: MonsterRank; mods: MonsterMod[];
  hp: number; maxHp: number; dmg: [number, number]; speed: number; atkRate: number;
  res: Record<Elem, number>; xp: number;
  awake: boolean; dead: boolean; deadT: number;
  act: MonAct | null; atkCd: number; aiT: number;
  facing: number; anim: number; moving: boolean;
  hitT: number; stunT: number; freezeT: number; chillT: number;
  poison: { dps: number; t: number } | null; burn: { dps: number; t: number } | null;
  kbx: number; kby: number; fleeT: number;
  packId: number; leaderId: number; homeX: number; homeY: number;
  timers: Record<string, number>;
  summoned: boolean; phase: number; alpha: number;
  deathStyle: DeathStyle;
  lastHitBy: number;
}

export type DeathStyle = 'normal' | 'gib' | 'burn' | 'shatter' | 'zap' | 'bones' | 'boss';

export type PropKind =
  | 'barrel' | 'crate' | 'chest' | 'bigchest' | 'sarco' | 'shrine' | 'torch' | 'brazier' | 'pillar' | 'candle'
  | 'tree' | 'well' | 'fence' | 'waypoint' | 'stash' | 'portal' | 'statue' | 'crystal' | 'tomb' | 'lamp' | 'rock' | 'house' | 'bones' | 'lavavent' | 'spikes' | 'banner' | 'cart' | 'grave';

export interface Prop {
  id: number; kind: PropKind; x: number; y: number; blocks: boolean; used: boolean;
  hp: number; light: number; face: number; variant: number;
  data: Record<string, number | string>;
}

export type NpcKind = 'smith' | 'healer' | 'elder' | 'gambler';
export interface Npc extends Entity { kind: NpcKind; name: string; facing: number; anim: number; hx: number; hy: number; wanderT: number; tx: number; ty: number }

export interface Drop {
  id: number; x: number; y: number;
  item?: Item; gold?: number; pot?: 'hp' | 'mp' | 'scroll';
  t: number;
}

/** Built-in projectile kinds; class modules add their own (drawn via the render registry). */
export type ProjKind = 'arrow' | 'bolt' | 'fireball' | 'explode' | 'firebolt' | 'coldbolt' | 'bone' | 'spit' | 'blood' | 'lightning' | 'poison' | 'spark' | 'shadow' | 'meteor' | 'frost' | 'skull' | 'orb' | (string & {});
export interface Proj {
  id: number; kind: ProjKind; side: 'hero' | 'mon';
  x: number; y: number; vx: number; vy: number; r: number;
  dmg: Dmg; life: number; pierce: number; hit: number[];
  aoe: number; aoeMult: number; homing: number; targetId: number; src: number; age: number;
  bounce?: number;
  /** Registry key of a custom motion (sim/registry PROJ_MOTION), replacing straight flight. */
  motion?: string;
  /** Registry key of an extra on-hit effect (sim/registry PROJ_HIT). */
  onHit?: string;
  /** Monsters may be hit again after this many seconds (0 = each monster once). */
  rehit?: number;
  /** Does not stop at walls (spirits, waves). */
  ghost?: boolean;
  data?: Record<string, number>;
}

export type AreaKind = 'rain' | 'meteor' | 'burn' | 'nova' | 'poisonCloud' | 'firewave' | 'bossNova' | 'lightningRing' | 'stomp' | 'bonePrison' | 'telegraph' | 'strafe' | 'shock' | (string & {});
/**
 * A ground effect. Generic behaviour is driven by fields/data so class skills rarely need code:
 *  - tick > 0: damages every enemy inside each tick (else once when it triggers)
 *  - follow: stays centred on the hero
 *  - proj: sentry — each tick fires this projectile kind at the nearest enemy within data.range (default 7)
 *  - data.heal: hero heals this much per tick while inside · data.pull: pulls enemies toward the centre (tiles/s)
 *  - data.chill / data.fear: seconds of chill / flee applied to enemies inside each tick
 *  - custom per-tick logic: sim/registry AREA_TICK[kind]
 */
export interface Area {
  id: number; kind: AreaKind; side: 'hero' | 'mon';
  x: number; y: number; r: number;
  t: number; dur: number; delay: number; tick: number; tickT: number;
  dmg: Dmg; hitIds: number[]; data: Record<string, number>;
  follow?: boolean;
  proj?: string;
}

export interface Decal { x: number; y: number; kind: 'blood' | 'bones' | 'rug' | 'crack' | 'rubble' | 'pentagram' | 'grass' | 'flowers' | 'path' | 'moss' | 'skull' | 'web'; v: number; rot: number; w?: number; h?: number }

export const T_VOID = 0, T_FLOOR = 1, T_WALL = 2, T_UP = 3, T_DOWN = 4, T_LAVA = 5, T_WATER = 6, T_DOOR = 7;

export interface World {
  floor: number; zone: number; diff: number; seed: number;
  w: number; h: number;
  tiles: Uint8Array; vari: Uint8Array; block: Uint8Array; explored: Uint8Array;
  monsters: Monster[]; props: Prop[]; npcs: Npc[]; drops: Drop[]; projs: Proj[]; areas: Area[]; decals: Decal[];
  start: Vec; up: Vec | null; down: Vec | null; downSealed: boolean; bossId: number;
  flow: Uint16Array; flowTile: number; flowT: number;
  nextId: number; mlvl: number; name: string;
  bossRoom: { x: number; y: number; w: number; h: number } | null;
  bossTriggered: boolean;
}

export type GEvent =
  | { t: 'dmg'; x: number; y: number; v: number; kind: 'normal' | 'crit' | 'hero' | 'heal' | 'mana' | 'block' | 'dodge' | 'immune' | 'xp' | 'gold'; elem?: Elem }
  | { t: 'sfx'; id: string; x?: number; y?: number }
  | { t: 'fx'; kind: string; x: number; y: number; x2?: number; y2?: number; r?: number; c?: string; n?: number; pts?: number[] }
  | { t: 'msg'; text: string; color?: string; big?: boolean }
  | { t: 'levelup'; level: number }
  | { t: 'death' }
  | { t: 'zone'; floor: number; name: string }
  | { t: 'boss'; id: number; name: string }
  | { t: 'bossDead'; name: string; final: boolean; tpl: string; diff: number }
  | { t: 'pickup'; item: Item }
  | { t: 'itemDrop'; rarity: Rarity; x: number; y: number }
  | { t: 'shake'; v: number }
  | { t: 'hit'; id: number }
  | { t: 'npc'; kind: NpcKind }
  | { t: 'save' }
  | { t: 'open'; ui: 'shop' | 'healer' | 'elder' | 'gambler' | 'stash' | 'waypoint' }
  | { t: 'victory'; diff: number }
  | { t: 'impact'; id: number; x: number; y: number; dx: number; dy: number; power: number; crit: boolean; elem: Elem; via: 'melee' | 'proj' | 'spell'; kill: boolean }
  | { t: 'kill'; id: number; x: number; y: number; dx: number; dy: number; style: DeathStyle; rank: MonsterRank; art: string; scale: number }
  | { t: 'swing'; x: number; y: number; ang: number; skill: string; r: number; elem: Elem }
  | { t: 'mattack'; id: number; x: number; y: number; ang: number; r: number; heavy: boolean };
