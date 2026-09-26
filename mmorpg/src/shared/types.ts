// Plain data types shared by the server simulation, the wire protocol and the client UI.
export type ClassId = 'sword' | 'archer' | 'shaman' | 'spear' | 'taoist' | 'guardian' | 'assassin' | 'gunner' | 'musician' | 'painter';
export type GearSlot = 'weapon' | 'armor' | 'charm';
export type Rarity = 0 | 1 | 2 | 3 | 4;
export type StatKey = 'atkPct' | 'hpPct' | 'crit' | 'critDmg' | 'aspd' | 'move' | 'cdr' | 'leech' | 'xpPct' | 'goldPct' | 'dr';
export type TalKind = 'blades' | 'wisp' | 'thunder' | 'frost' | 'aura' | 'pierce' | 'bell' | 'guard';

export interface Item { uid: number; slot: GearSlot; rarity: Rarity; ilvl: number; base: number; affixes: [StatKey, number][]; plus: number }
export interface Tal { uid: number; kind: TalKind; lv: number }
export interface Equip { weapon: Item | null; armor: Item | null; charm: Item | null }
export interface QuestState { main: number; prog: number; bountyZone: number; bountyProg: number; bountyDone: number }
export interface LifeStats { kills: number; deaths: number; bosses: number; worldBoss: number; playSec: number; revives: number; merges: number; goldEarned: number; legendaries: number }

/** Persistent character. Everything the server saves. */
export interface Profile {
  v: number; name: string; cls: ClassId; level: number; xp: number; gold: number; shards: number;
  inv: Item[]; equip: Equip; tals: Tal[]; slots: (number | null)[];
  quest: QuestState; shrines: number[]; stats: LifeStats; pity: number; nextUid: number; created: number;
  x?: number; y?: number; opts?: { autoSell: number };
  /** Classes this character has played (each grants its starting talisman once). */
  tried?: ClassId[];
}

/** Derived combat stats. */
export interface Stats { maxHp: number; atk: number; crit: number; critDmg: number; aspd: number; move: number; cdr: number; leech: number; xpPct: number; goldPct: number; dr: number; power: number }

/** Public info about a player shown to everyone (roster). */
export interface RosterEntry { id: number; name: string; cls: ClassId; level: number; bot: boolean; tals: [TalKind, number][]; power: number }

/** Private per-player state pushed to the owning client (diffed per key). */
export interface MeState {
  id: number; name: string; cls: ClassId; level: number; xp: number; xpNeed: number; gold: number; shards: number;
  hp: number; maxHp: number; shield: number; ult: number; ultT: number; downed: number; revive: number;
  stats: Stats; inv: Item[]; equip: Equip; tals: Tal[]; slots: (number | null)[]; cds: number[];
  quest: QuestState; shrines: number[]; zone: number; lstats: LifeStats; pity: number; autoSell: number; auto: boolean;
}
