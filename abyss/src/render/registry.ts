// Extension points for class art modules (src/classes/<id>/art.ts). Modules register drawing callbacks here
// at import time; the renderer, rig, FX layer and icon painter consult them for anything they don't know.
import type { Area, Buff, ClassId, GEvent, Hero, Proj } from '../sim/types';
import type { Look, Pose } from './actors';
import type { Effect, Fx } from './fx';
import type { Camera } from './iso';

type C2D = CanvasRenderingContext2D;

/** Hero appearance per class. `common` already holds gear-derived fields (weapon kind/tier/glow, offhand, helm, armorTier…). */
export const CLASS_LOOK: Partial<Record<ClassId, (h: Hero, common: Partial<Look>, chestTier: number) => Look>> = {};

/** Maps an item category to the rig's weapon/offhand kind (new categories only). */
export const ITEM_KIND: Record<string, string> = {};

/**
 * Weapon art for a WeaponKind. Local space: origin in the fist, +y points out of the hand along the weapon.
 * `L(n)` scales lengths (icons draw larger). style: arm motion — 'slash' (default), 'thrust' (spears), 'punch' (fists/claws).
 */
export interface WeaponArt {
  draw(c: C2D, tier: number, steel: string, edge: string, L: (n: number) => number, glow?: string): void;
  style?: 'slash' | 'thrust' | 'punch';
  heavy?: boolean;
  /** Inventory icon on a 64×64 canvas translated to its centre (default: the weapon drawn diagonally). */
  icon?(c: C2D, tier: number, gem: string): void;
}
export const WEAPON_ART: Record<string, WeaponArt> = {};

/** Offhand art: drawn at the back hand (x,y) of the rig, and as an inventory icon (64×64, origin at centre). */
export interface OffhandArt {
  draw(c: C2D, x: number, y: number, tier: number, p: Pose, color?: string): void;
  icon(c: C2D, tier: number, gem: string): void;
}
export const OFFHAND_ART: Record<string, OffhandArt> = {};

/** Rig anchor points in actor-local units (origin at the feet, facing +x, up is -y). */
export interface RigAnchors {
  hx: number; hy: number; headR: number;   // head centre and radius
  shX: number; shY: number; hipY: number;  // shoulder line and hips
  build: number; height: number;
  fhx: number; fhy: number;                // front (weapon) hand
  bhx: number; bhy: number;                // back hand
}
/** Class decor drawn on the rig (masks, hoods, pauldrons, tabards, auras). 'back' is before the torso, 'front' after the weapon arm. */
export const DECOR: Record<string, (c: C2D, L: Look, p: Pose, a: RigAnchors, layer: 'back' | 'front') => void> = {};

/** Shared drawing context for world-space art. sx/sy: screen position of the thing drawn (css px). */
export interface WorldDraw { c: C2D; cam: Camera; z: number; time: number; fx: Fx; sx: number; sy: number }

/** Projectile art by Proj.kind. d.sy is already lifted to flight height; d.ang is the screen-space heading. */
export interface ProjArt {
  draw(p: Proj, d: WorldDraw & { ang: number }): void;
  /** Light it casts: [radius in tiles, 'r,g,b']. */
  light?: [number, string];
  /** Motion trail: ['r,g,b', width px]. */
  trail?: [string, number];
}
export const PROJ_ART: Record<string, ProjArt> = {};

/** Ground-area art by Area.kind (drawn on the floor under actors). d.rx: radius in screen px (ellipse ry = rx/2). */
export interface AreaArt {
  draw(a: Area, d: WorldDraw & { rx: number }): void;
  /** Optional over-actor layer (clouds, pillars of light). */
  air?(a: Area, d: WorldDraw & { rx: number }): void;
  light?(a: Area): [number, string] | null;
}
export const AREA_ART: Record<string, AreaArt> = {};

export type FxEvent = Extract<GEvent, { t: 'fx' }>;
/** What an FX_EVENT handler may use. */
export interface FxHost { fx: Fx; low: boolean; shake(v: number): void; delay(t: number, fn: () => void): void }
/** Visual reaction to a sim fx event (g.emit({t:'fx', kind, …})): spawn particles / timed effects. */
export const FX_EVENT: Record<string, (e: FxEvent, h: FxHost) => void> = {};

/** Timed effect art for fx.effect(kind, …). k = t/dur in 0..1, rx = e.r in screen px. */
export interface EffectArt {
  ground?(e: Effect, d: WorldDraw & { k: number; rx: number }): void;
  air?(e: Effect, d: WorldDraw & { k: number; rx: number }): void;
  /** Light while it plays: [radius in tiles, 'r,g,b'] or null. */
  light?(e: Effect, k: number): [number, string] | null;
}
export const EFFECT_ART: Record<string, EffectArt> = {};

/** Skill icon: background gradient [inner, outer] and a draw call on a 64×64 canvas translated to its centre. */
export interface SkillIconArt { tint: [string, string]; draw(c: C2D, glow: (col: string, blur?: number) => void): void }
export const SKILL_ICON: Record<string, SkillIconArt> = {};

/** Visuals for an active hero buff (by buff id), drawn around the hero before the hero sprite. */
export const BUFF_ART: Record<string, (c: C2D, sx: number, sy: number, z: number, time: number, b: Buff, fx: Fx, h: Hero) => void> = {};
