// Player kinematics — the ONE implementation used by both the live run and the fairness validator.
import {
  GROUND_Y, GRAVITY, JUMP_V, DJUMP_V, FASTFALL_MUL, MAX_FALL_V, COYOTE_T, JUMP_BUFFER_T,
  STAND_W, STAND_H, SLIDE_W, SLIDE_H, FOOT_W,
} from '../data/physics';
import type { Solid } from './chunk';

export interface Body {
  x: number;          // world x of the hurtbox centre
  y: number;          // world y of the feet (bottom of hurtbox)
  vy: number;
  onGround: boolean;
  jumps: number;      // jumps used since last landing
  sliding: boolean;
  coyote: number;     // s left to still ground-jump after leaving an edge
  buffer: number;     // s left on a buffered jump press
  scale: number;      // 1, or GIANT_SCALE while giant
}

export interface BodyInput { jump: boolean; slide: boolean }   // jump = pressed this step (edge), slide = held
export interface BodyCaps { maxJumps: number; glide?: number }  // glide: fall-speed cap while jump is held (0/undefined = none)

export interface StepResult { jumped: 0 | 1 | 2; landed: boolean }

export function newBody(x: number, y: number): Body {
  return { x, y, vy: 0, onGround: true, jumps: 0, sliding: false, coyote: 0, buffer: 0, scale: 1 };
}

export function hurtbox(b: Body, pad = 0): { x0: number; x1: number; y0: number; y1: number } {
  const w = (b.sliding ? SLIDE_W : STAND_W) * b.scale; const h = (b.sliding ? SLIDE_H : STAND_H) * b.scale;
  return { x0: b.x - w / 2 - pad, x1: b.x + w / 2 + pad, y0: b.y - h - pad, y1: b.y + pad };
}

/** Solids are queried through this so the run can index them however it likes. */
export type SolidQuery = (x0: number, x1: number) => Iterable<Solid>;

function supportTop(q: SolidQuery, x: number, yFrom: number, yTo: number, bridge: boolean): number | null {
  const f0 = x - FOOT_W / 2, f1 = x + FOOT_W / 2;
  let best: number | null = bridge && GROUND_Y >= yFrom - 0.001 && GROUND_Y <= yTo + 0.001 ? GROUND_Y : null;
  for (const s of q(f0, f1)) {
    if (s.x1 <= f0 || s.x0 >= f1) continue;
    if (s.top >= yFrom - 0.001 && s.top <= yTo + 0.001 && (best === null || s.top < best)) best = s.top;
  }
  return best;
}

/**
 * Advance one fixed step. `bridge` = treat pits as solid ground (dash/giant/bonus).
 * `holdJump` (optional) = jump button currently held, only used by gliding characters.
 */
export function stepBody(b: Body, inp: BodyInput, dx: number, dt: number, q: SolidQuery, caps: BodyCaps, bridge = false, holdJump = false): StepResult {
  const res: StepResult = { jumped: 0, landed: false };
  if (inp.jump) b.buffer = JUMP_BUFFER_T; else b.buffer = Math.max(0, b.buffer - dt);
  b.coyote = Math.max(0, b.coyote - dt);

  if (b.buffer > 0) {
    if (b.onGround || b.coyote > 0) {
      b.vy = -JUMP_V; b.jumps = 1; b.onGround = false; b.coyote = 0; b.buffer = 0; res.jumped = 1;
    } else if (b.jumps < caps.maxJumps && inp.jump) {
      // air jump only on a fresh press (a stale buffered press must not burn it)
      b.vy = -DJUMP_V; b.jumps = Math.max(b.jumps, 1) + 1; b.buffer = 0; res.jumped = 2;
    }
  }

  b.x += dx;

  if (b.onGround) {
    b.sliding = inp.slide;
    const top = supportTop(q, b.x, b.y, b.y, bridge);
    if (top === null) { b.onGround = false; b.coyote = COYOTE_T; b.vy = 0; }
    else return res;
  }

  // airborne
  b.sliding = false;
  let g = GRAVITY;
  if (inp.slide && b.vy > -200) g *= FASTFALL_MUL;
  b.vy = Math.min(b.vy + g * dt, MAX_FALL_V);
  if (caps.glide && holdJump && b.vy > caps.glide && !inp.slide) b.vy = caps.glide;
  const ny = b.y + b.vy * dt;
  if (b.vy >= 0) {
    const top = supportTop(q, b.x, b.y, ny, bridge);
    if (top !== null) {
      b.y = top; b.vy = 0; b.onGround = true; b.jumps = 0; res.landed = true;
      b.sliding = inp.slide;
      if (b.buffer > 0) { b.vy = -JUMP_V; b.jumps = 1; b.onGround = false; b.buffer = 0; b.sliding = false; res.jumped = 1; }
      return res;
    }
  }
  b.y = ny;
  return res;
}

export function boxesOverlap(a: { x0: number; x1: number; y0: number; y1: number }, b: { x0: number; x1: number; y0: number; y1: number }): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}
