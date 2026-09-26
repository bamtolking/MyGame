// Character rig shared by every class: pose data, palettes and the per-class "look" plugin interface.
// A look only draws what is specific to its class (headgear, weapon, armour, extras); the rig draws the body.
import { type Ctx, INK, eye, blush, line, ellipse } from './core.ts';

export interface Pose { bob: number; lean: number; legF: number; legB: number; armF: number; armB: number; wpn: number; eyes: 'open' | 'blink' | 'hurt' | 'fierce'; step: number; extra: number }
export const P0: Pose = { bob: 0, lean: 0, legF: 0, legB: 0, armF: 0.3, armB: -0.2, wpn: 0, eyes: 'open', step: 0, extra: 0 };
export const pose = (o: Partial<Pose>): Pose => ({ ...P0, ...o });
/** Walk-cycle pose parts: body bob, leg swing, cloth step. */
export const WALK = (bob: number, lf: number, step: number): Partial<Pose> => ({ bob, lean: 0.07, legF: lf, legB: -lf, armF: -lf * 0.9 + 0.2, armB: lf * 0.9 - 0.1, step });
/** Every look must provide exactly these frames. atk0 = wind-up, atk1 = strike, atk2 = follow-through. */
export const FRAME_NAMES = ['idle0', 'idle1', 'blink', 'walk0', 'walk1', 'walk2', 'walk3', 'atk0', 'atk1', 'atk2', 'hurt'] as const;
export type FrameName = typeof FRAME_NAMES[number];
export const CHAR_W = 78, CHAR_H = 96, CHAR_FOOT = 90;

export interface Pal { robe: string; lining: string; sash: string; pants: string; shoe: string; skin: string; hair: string; iris: string; cuff: string }

/**
 * Per-class drawing hooks. Coordinates: the character faces RIGHT in a 78×96 box, feet at (39, 90).
 * Torso space (back/torso/front/hat hooks): origin at the hip centre (39, 70) after bob + lean; up is −y.
 * The head is centred at (2, −41) with radius 15.5 in torso space.
 * Arm space (hand hook): origin at the hand centre; the arm points down (+y) before the arm angle is applied,
 * so "forward" for a held weapon depends on the pose's armF/armB angles.
 */
export interface ClassLook {
  pal: Pal;
  frames: Record<FrameName, Pose>;
  /** Robe hem y (default 19, short jacket ≈ 12). */
  hem?: number;
  /** Draw the two sash tails hanging at the front (default true). */
  sashTails?: boolean;
  /** Draw hair behind the head (default true). */
  hairBack?: boolean;
  /** Behind the back arm and torso (quiver, long hair, cape, carried instrument). */
  back?(c: Ctx, P: Pal, p: Pose): void;
  /** Custom sleeve: build the path, fill and stroke it. Arm space, before the hand is drawn. */
  sleeve?(c: Ctx, P: Pal, back: boolean): void;
  /** Custom leg (leg space: origin at the hip joint, leg points down). */
  leg?(c: Ctx, P: Pal, back: boolean): void;
  /** Over the robe, under the sash (vest, armour plates, embroidery). `sw` is the hem sway. */
  torso?(c: Ctx, P: Pal, p: Pose, sw: number): void;
  /** Replaces the default face (eyes, blush, mouth), e.g. for a mask. Use defaultFace() inside to keep the eyes. */
  face?(c: Ctx, P: Pal, p: Pose, hx: number, hy: number): void;
  /** Headgear, drawn after the face. */
  hat(c: Ctx, P: Pal, p: Pose, hx: number, hy: number, R: number): void;
  /** What the hand holds (arm space, origin at the hand). Called for the back hand (back=true) and the front hand. */
  hand(c: Ctx, P: Pal, p: Pose, back: boolean): void;
  /** After the front arm (e.g. a shield worn over the arm). Torso space. */
  front?(c: Ctx, P: Pal, p: Pose): void;
  /** Inventory weapon icon in a 48×48 box; `tier` is the metal/wood colour for the item tier. */
  weaponIcon(c: Ctx, tier: string): void;
}

/** The standard face: two anime eyes, blush and a mouth that follows the pose's expression. */
export function defaultFace(c: Ctx, P: Pal, p: Pose, hx: number, hy: number, mouth = true): void {
  eye(c, hx - 2.5, hy + 2.5, 3.6, P.iris, p.eyes, false); eye(c, hx + 8, hy + 2.5, 3.3, P.iris, p.eyes, true); blush(c, hx - 4, hy + 9); blush(c, hx + 10, hy + 9);
  if (!mouth) return;
  if (p.eyes === 'fierce') line(c, [hx + 1.5, hy + 10.5, hx + 5.5, hy + 10], INK, 1.5); else if (p.eyes === 'hurt') { ellipse(c, hx + 3.5, hy + 10.5, 2, 1.6); c.fillStyle = INK; c.fill(); }
  else { c.beginPath(); c.arc(hx + 3.5, hy + 8.5, 2.4, 0.2, Math.PI - 0.2); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke(); }
}
