// Fairness validator + planner.
// `solve` searches the REAL player physics for a hit-free path (inflated hurtbox, decisions only every few
// frames — so nothing pixel- or frame-perfect is ever required). `validateChunk` proves a chunk from
// "grounded at local x = −40" to "grounded at x = width − 40"; since every chunk starts/ends on hazard-free
// ground and speed only changes at those boundaries, any sequence of proven chunks is crossable hit-free.
// The balance bot reuses `solve` as its planner.
import { DT, TILE, GROUND_Y, VALIDATE_PAD, VALIDATE_INPUT_STEP, PICK_PAD, MAX_JUMPS } from '../data/physics';
import { newBody, stepBody, hurtbox, boxesOverlap, type Body, type BodyCaps } from './body';
import type { ParsedChunk, Solid } from './chunk';

export interface Box { x0: number; x1: number; y0: number; y1: number }
export interface Decision { jump: boolean; slide: boolean }
export const CHOICES: Decision[] = [
  { jump: false, slide: false }, { jump: true, slide: false }, { jump: false, slide: true }, { jump: true, slide: true },
];

export interface SolveOpts {
  pad?: number;
  inputStep?: number;
  caps?: BodyCaps;
  /** require passing through this point's pickup box on the same path */
  mustCollect?: { x: number; y: number };
  /** success requires being grounded when reaching endX (default true) */
  endGrounded?: boolean;
  /** abort after this many simulated steps (planner budget); 0 = unlimited */
  budget?: number;
}
export interface SolveResult { ok: boolean; explored: number; path: Decision[]; aborted?: boolean }

function keyOf(b: Body, got: boolean): string {
  // Coarse on purpose: merging near-identical states can only drop alternatives (false FAIL), never invent a
  // path — the surviving representative is a real simulated trajectory.
  return `${Math.round(b.y / 3)}|${Math.round(b.vy / 30)}|${b.jumps}|${b.onGround ? 1 : 0}|${b.sliding ? 1 : 0}|${b.coyote > 0 ? 1 : 0}|${b.buffer > 0 ? 1 : 0}|${got ? 1 : 0}`;
}

export function solve(solids: readonly Solid[], hazards: readonly Box[], start: Body, speed: number, endX: number, opts: SolveOpts = {}): SolveResult {
  const pad = opts.pad ?? VALIDATE_PAD;
  const step = opts.inputStep ?? VALIDATE_INPUT_STEP;
  const caps = opts.caps ?? { maxJumps: MAX_JUMPS };
  const endGrounded = opts.endGrounded ?? true;
  const budget = opts.budget ?? 0;
  const q = () => solids;
  const dx = speed * DT;
  const must = opts.mustCollect;
  const visited = new Set<string>();
  let explored = 0; let aborted = false;
  const path: number[] = [];
  const maxLayers = Math.ceil((endX - start.x) / Math.max(1e-6, dx) / step) + 4;

  // Depth-first, "do nothing" first, visited set per decision layer. Success is usually a straight dive;
  // failure is exhaustive over merged states.
  const dfs = (b0: Body, got0: boolean, layer: number): boolean => {
    if (layer > maxLayers) return false;
    if (budget && explored > budget) { aborted = true; return false; }
    for (let ci = 0; ci < CHOICES.length; ci++) {
      const ch = CHOICES[ci];
      const b: Body = { ...b0 }; let got = got0; let dead = false; let done = false;
      for (let f = 0; f < step; f++) {
        stepBody(b, { jump: ch.jump && f === 0, slide: ch.slide }, dx, DT, q, caps);
        explored++;
        if (b.y > GROUND_Y + 160) { dead = true; break; }
        const hb = hurtbox(b, pad);
        for (const h of hazards) if (h.x1 > hb.x0 && h.x0 < hb.x1 && boxesOverlap(hb, h)) { dead = true; break; }
        if (dead) break;
        if (!got && must) {
          const pb = hurtbox(b, PICK_PAD - pad);
          if (must.x > pb.x0 && must.x < pb.x1 && must.y > pb.y0 && must.y < pb.y1) got = true;
        }
        if (b.x >= endX && (b.onGround || !endGrounded) && got) { done = true; break; }
      }
      if (dead) continue;
      if (done) { path.push(ci); return true; }
      if (b.x >= endX + 3 * TILE) continue;
      const k = layer + '#' + keyOf(b, got);
      if (visited.has(k)) continue;
      visited.add(k);
      path.push(ci);
      if (dfs(b, got, layer + 1)) return true;
      path.pop();
      if (aborted) return false;
    }
    return false;
  };
  const ok = dfs({ ...start }, !must, 0);
  return { ok, explored, path: ok ? path.map(i => CHOICES[i]) : [], aborted };
}

export interface ValidateOpts { pad?: number; inputStep?: number; caps?: BodyCaps; mustCollect?: { x: number; y: number } }

/** Chunk-local proof. Flat ground is assumed just before and after the chunk (lint guarantees it). */
export function validateChunk(p: ParsedChunk, speed: number, opts: ValidateOpts = {}): SolveResult {
  const solids: Solid[] = [
    { x0: -400, x1: 0, top: GROUND_Y, ground: true },
    ...p.solids,
    { x0: p.width, x1: p.width + 400, top: GROUND_Y, ground: true },
  ];
  return solve(solids, p.hazards, newBody(-TILE, GROUND_Y), speed, p.width - TILE, { ...opts, endGrounded: true });
}

/** Largest hurtbox inflation (px, capped at 23) at which the chunk is still crossable — how forgiving it is. */
export function chunkSlack(p: ParsedChunk, speed: number, caps?: BodyCaps): number {
  if (!validateChunk(p, speed, { pad: 0, caps }).ok) return -1;
  let lo = 0, hi = 24;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (validateChunk(p, speed, { pad: mid, caps }).ok) lo = mid; else hi = mid; }
  return lo;
}
