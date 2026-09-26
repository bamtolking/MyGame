// Headless player bot. Plans with the same solver the fairness validator uses. Jumps are timed like a person:
// aimed at the MIDDLE of the feasible window (not the last possible frame), then offset by a random reaction
// error of ±jitter frames. So jitter ≈ how sloppy the player's timing is.
import { TILE, GROUND_Y } from '../src/data/physics';
import { newRun, stepRun, charOf, totalScore, type RunConfig } from '../src/sim/run';
import { solve, type Decision, type SolveOpts } from '../src/sim/validate';
import { rngNext, seedRng, type RngState } from '../src/sim/rng';
import type { RunState } from '../src/sim/types';

export interface BotOpts { jitter: number; pad: number; seed: number; maxT?: number; lookahead?: number }
export interface BotResult { t: number; dist: number; score: number; hits: number; falls: number; potions: number; jellies: number; jellyPct: number; bonus: number; cause: string | null; phase: string; tier: number; nearMisses: number; bestStreak: number; steps: number }

interface Mem { target: number | null }

function world(s: RunState, look: number) {
  const b = s.body; const x0 = b.x - 100, x1 = b.x + look + 260;
  const solids = s.level.solids.filter(o => o.x1 > x0 && o.x0 < x1);
  const powered = s.power.giant > 0 || s.power.dash > 0 || s.rescue > 0;
  const hazards = s.iframes > 0.25 || powered ? [] : s.level.hazards.filter(h => !h.broken && !h.passed && !h.touched && h.x1 > x0 && h.x0 < x1);
  if (powered) solids.push({ x0, x1, top: GROUND_Y, ground: true });
  return { solids, hazards };
}

/** Decision for the next 4 frames. May set mem.target = an absolute step at which to jump (middle of the window). */
export function plan(s: RunState, pad: number, look: number, mem: Mem): Decision {
  const b = s.body; const ch = charOf(s);
  if (s.bonusStage !== 'none') return { jump: false, slide: false };
  const { solids, hazards } = world(s, look);
  const base: SolveOpts = { pad, caps: { maxJumps: ch.maxJumps, glide: ch.glide }, budget: 40000 };
  const endX = b.x + look;
  const run = (o: SolveOpts) => solve(solids, hazards, b, s.speed, endX, { ...base, ...o });
  // steer for the next potion when there is one ahead
  const pot = s.level.pickups.find(p => !p.taken && (p.type === 'potion' || p.type === 'bigPotion') && p.x > b.x + 20 && p.x < endX - 40);
  let r = pot ? run({ mustCollect: { x: pot.x, y: pot.y } }) : { ok: false, path: [] as Decision[], explored: 0 };
  if (!r.ok) r = run({});
  if (!r.ok) r = run({ endGrounded: false });
  if (!r.ok) r = run({ endGrounded: false, pad: 0 });
  if (!r.ok || !r.path.length) return { jump: false, slide: false };
  const first = r.path[0];
  const k = r.path.findIndex(d => d.jump);
  if (k === 0) { mem.target = null; return first; }                 // latest moment: must jump now
  if (k > 0 && mem.target === null && jumpNowOk(s, pad, look, first.slide)) mem.target = s.steps + Math.floor(k * 4 / 2);
  return { jump: false, slide: first.slide };
}

/** Is pressing jump right now safe (a hit-free, grounded continuation exists)? */
export function jumpNowOk(s: RunState, pad: number, look: number, slide: boolean): boolean {
  const b = s.body; const ch = charOf(s); const { solids, hazards } = world(s, look);
  const o: SolveOpts = { pad, caps: { maxJumps: ch.maxJumps, glide: ch.glide }, budget: 40000, firstChoice: slide ? 3 : 1, inputStep: 1 };
  // inputStep 1 for the first layer only matters for the forced press; later layers use the normal grid
  return solve(solids, hazards, b, s.speed, b.x + look, { ...o, inputStep: 4 }).ok;
}

export function playRun(cfg: RunConfig, o: BotOpts): { s: RunState; r: BotResult } {
  const s = newRun(cfg);
  const rng: RngState = seedRng(o.seed ^ 0x5eed);
  const maxT = o.maxT ?? 900; const look = o.lookahead ?? 12 * TILE;
  const mem: Mem = { target: null };
  let slide = false; let holdLeft = 0; let mustAt = -1;
  const late = () => o.jitter <= 0 ? 0 : Math.floor(rngNext(rng) * (o.jitter + 1));
  const both = () => o.jitter <= 0 ? 0 : Math.round((rngNext(rng) * 2 - 1) * o.jitter);
  while (s.phase !== 'over' && s.phase !== 'clear' && s.t < maxT) {
    let jump = false;
    if (holdLeft <= 0 && mustAt < 0) {
      const hadTarget = mem.target !== null;
      const d = s.phase === 'run' ? plan(s, o.pad, look, mem) : { jump: false, slide: false };
      slide = d.slide; holdLeft = 4;
      if (d.jump) mustAt = s.steps + late();
      else if (!hadTarget && mem.target !== null) mem.target += both();   // the player's aim is a bit off
    }
    if (mustAt >= 0 && s.steps >= mustAt) { jump = true; mustAt = -1; holdLeft = 0; mem.target = null; }
    else if (mem.target !== null && s.steps >= mem.target) {
      // re-check at the moment of pressing (the world may have changed, e.g. an air jump was used)
      if (jumpNowOk(s, o.pad, look, slide) || o.jitter > 0) { jump = true; holdLeft = 0; }
      mem.target = null;
    }
    stepRun(s, { jump, slide, jumpHeld: jump });
    s.events.length = 0;
    holdLeft--;
  }
  const st = s.stats;
  return { s, r: { t: s.t, dist: Math.round(s.dist), score: totalScore(s), hits: st.hits, falls: st.falls, potions: st.potions, jellies: st.jellies, jellyPct: st.jelliesSeen ? Math.round(100 * st.jellies / st.jelliesSeen) : 0, bonus: st.bonusTimes, cause: s.deathCause, phase: s.phase, tier: st.maxTier, nearMisses: st.nearMisses, bestStreak: st.bestStreak, steps: s.steps } };
}
