// Per-class visuals and sounds for basic attacks and ultimates (one module per class, registered in index.ts).
import type { FxSystem } from '../render/fx.ts';
import type { Sound } from '../audio/engine.ts';
import type { Art } from '../render/art/index.ts';
import type { Painter } from '../render/paint.ts';

export interface FxCtx {
  fx: FxSystem; snd: Sound; art: Art;
  /** Caster entity id; true when the caster is the local player; volume for the caster's sounds (1 own, ~0.35 others). */
  id: number; mine: boolean; vol: number;
  /** Caster feet position (world units). */
  x: number; y: number;
  /** Class colour as 0xRRGGBB. */
  col: number;
  /** The caster's ultimate is active (sustained ults). */
  ult: boolean;
  /** Attack counter for this caster (alternate swings with n % 2). */
  n: number;
  /** Is (x, y) within r of the local player (use to skip sounds/shake far away). */
  near(x: number, y: number, r: number): boolean;
  /** Current position of an entity (monster y is at its body centre), or null if gone. */
  entPos(kind: 'p' | 'm', id: number): { x: number; y: number } | null;
}
/** Server 'atk' event: target position/id; `pts` = extra target points [x, y, ...] (chain lightning). */
export interface AtkEv { tx: number; ty: number; tid?: number; pts?: number[] }
/** Server 'ult' event: caster position; optional target point. */
export interface UltEv { x: number; y: number; tx?: number; ty?: number }
/** Server 'uhit' event: a timed sub-hit of an ultimate, at (x, y) or along (x, y) → (x2, y2). */
export interface HitEv { x: number; y: number; x2?: number; y2?: number }

export interface ClassFx {
  /** Attack pose duration in seconds (atk0 → atk1 → atk2). */
  atkDur: number;
  /** Build this class's custom textures ahead of time (called in idle frames when the class first shows up). */
  warm?(): void;
  /** Forget per-caster state (called when a new world/FxSystem starts; fx.time restarts at 0). */
  reset?(): void;
  /** Radius of the generic ult magic circle (default 170). */
  ultR?: number;
  /** Basic attack visuals + sound. `ang` points from the caster to the target. */
  atk(c: FxCtx, e: AtkEv, ang: number): void;
  /** Class-specific part of the ultimate cast (pillar, circle, cut-in, flash and `ult_<class>` sound are generic). */
  ult(c: FxCtx, e: UltEv): void;
  /** A timed sub-hit of the ultimate. */
  uhit?(c: FxCtx, e: HitEv): void;
  /** Drawn every frame at the caster while its ultimate is active (sustained ults). */
  aura?(p: Painter, art: Art, t: number, x: number, y: number): void;
}
