// Autopilot: plans with the fairness validator's solver and presses like a person — aiming at the MIDDLE of a
// jump's feasible window (not the last frame), with an optional ±jitter-frame timing error. Used by the balance
// bots (tests), the browser e2e, and the home-screen demo run.
import { TILE, GROUND_Y } from '../data/physics';
import { charOf } from './run';
import { solve, type Decision, type SolveOpts } from './validate';
import { rngNext, seedRng, type RngState } from './rng';
import type { RunState, RunInput } from './types';

export class Autopilot {
  jitter: number; pad: number; look: number;
  private rng: RngState;
  private target: number | null = null;   // absolute step to jump at (middle of the window)
  private mustAt = -1;                     // absolute step of a forced (latest-moment) jump
  private slide = false; private holdLeft = 0;

  constructor(opts: { jitter?: number; pad?: number; lookTiles?: number; seed?: number } = {}) {
    this.jitter = opts.jitter ?? 0; this.pad = opts.pad ?? 4; this.look = (opts.lookTiles ?? 12) * TILE;
    this.rng = seedRng((opts.seed ?? 1) ^ 0x5eed);
  }

  /** Input for the next step of `s`. Call once per stepRun. */
  next(s: RunState): RunInput {
    let jump = false;
    if (s.phase !== 'run') { this.target = null; this.mustAt = -1; return { jump: false, slide: false }; }
    if (this.holdLeft <= 0 && this.mustAt < 0) {
      const had = this.target !== null;
      const d = this.plan(s);
      this.slide = d.slide; this.holdLeft = 4;
      if (d.jump) this.mustAt = s.steps + this.late();
      else if (!had && this.target !== null) this.target += this.both();   // aim is a bit off
    }
    if (this.mustAt >= 0 && s.steps >= this.mustAt) { jump = true; this.mustAt = -1; this.holdLeft = 0; this.target = null; }
    else if (this.target !== null && s.steps >= this.target) {
      // re-check at the moment of pressing (e.g. the air jump may have been used meanwhile)
      if (this.jitter > 0 || this.jumpNowOk(s, this.slide)) { jump = true; this.holdLeft = 0; }
      this.target = null;
    }
    this.holdLeft--;
    // the planner does not model gliding, so never hold jump on the ground course (a held press would glide and
    // desynchronise the plan); in the sky, bob through the candy field
    return { jump, slide: this.slide, jumpHeld: (jump && charOf(s).glide === 0) || (s.bonusStage === 'sky' && this.skyHold(s)) };
  }

  private late(): number { return this.jitter <= 0 ? 0 : Math.floor(rngNext(this.rng) * (this.jitter + 1)); }
  private both(): number { return this.jitter <= 0 ? 0 : Math.round((rngNext(this.rng) * 2 - 1) * this.jitter); }

  private world(s: RunState) {
    const b = s.body; const x0 = b.x - 100, x1 = b.x + this.look + 260;
    const solids = s.level.solids.filter(o => o.x1 > x0 && o.x0 < x1);
    const powered = s.power.giant > 0 || s.power.dash > 0;
    const hazards = s.iframes > 0.25 || powered ? [] : s.level.hazards.filter(h => !h.broken && !h.passed && !h.touched && h.x1 > x0 && h.x0 < x1);
    if (powered || s.rescue > 0) solids.push({ x0, x1, top: GROUND_Y, ground: true });   // pits are bridged (a rescue bridge can outlast the i-frames)
    return { solids, hazards };
  }

  private plan(s: RunState): Decision {
    const b = s.body; const ch = charOf(s);
    if (s.bonusStage !== 'none') return { jump: false, slide: false };
    const { solids, hazards } = this.world(s);
    const base: SolveOpts = { pad: this.pad, caps: { maxJumps: ch.maxJumps, glide: ch.glide }, budget: 40000 };
    const endX = b.x + this.look;
    const run = (o: SolveOpts) => solve(solids, hazards, b, s.speed, endX, { ...base, ...o });
    const pot = s.level.pickups.find(p => !p.taken && (p.type === 'potion' || p.type === 'bigPotion') && p.x > b.x + 20 && p.x < endX - 40);
    let r = pot ? run({ mustCollect: { x: pot.x, y: pot.y } }) : { ok: false, path: [] as Decision[], explored: 0 };
    if (!r.ok) r = run({});
    if (!r.ok) r = run({ endGrounded: false });
    if (!r.ok) r = run({ endGrounded: false, pad: 0 });
    if (!r.ok || !r.path.length) return { jump: false, slide: false };
    const first = r.path[0];
    const k = r.path.findIndex(d => d.jump);
    if (k === 0) { this.target = null; return first; }
    if (k > 0 && this.target === null && this.jumpNowOk(s, first.slide)) this.target = s.steps + Math.floor(k * 4 / 2);
    return { jump: false, slide: first.slide };
  }

  private jumpNowOk(s: RunState, slide: boolean): boolean {
    const b = s.body; const ch = charOf(s); const { solids, hazards } = this.world(s);
    return solve(solids, hazards, b, s.speed, b.x + this.look, { pad: this.pad, caps: { maxJumps: ch.maxJumps, glide: ch.glide }, budget: 40000, firstChoice: slide ? 3 : 1 }).ok;
  }

  /** Bonus sky: bob up and down through the jelly field. */
  private skyHold(s: RunState): boolean { return Math.floor(s.steps / 25) % 2 === 0 || s.body.y > 360; }
}
