// Headless player bot. Plans with the same solver the fairness validator uses, then executes with an optional
// human-like reaction jitter (jump presses delayed by 0..jitter frames) so balance can be swept per skill level.
import { DT, TILE, GROUND_Y } from '../src/data/physics';
import { newRun, stepRun, charOf, totalScore, type RunConfig } from '../src/sim/run';
import { solve, type Decision } from '../src/sim/validate';
import { rngNext, seedRng, type RngState } from '../src/sim/rng';
import type { RunState } from '../src/sim/types';

export interface BotOpts { jitter: number; pad: number; seed: number; maxT?: number; lookahead?: number }
export interface BotResult { t: number; dist: number; score: number; hits: number; falls: number; potions: number; jellies: number; jellyPct: number; bonus: number; cause: string | null; phase: string; tier: number; nearMisses: number; bestStreak: number; steps: number }

export function planStep(s: RunState, pad: number, lookahead: number): Decision {
  const b = s.body; const ch = charOf(s);
  if (s.bonusStage !== 'none') return { jump: false, slide: false };
  const x0 = b.x - 100, x1 = b.x + lookahead + 200;
  const solids = s.level.solids.filter(o => o.x1 > x0 && o.x0 < x1);
  const powered = s.power.giant > 0 || s.power.dash > 0 || s.rescue > 0;
  const hazards = s.iframes > 0.25 || powered ? [] : s.level.hazards.filter(h => !h.broken && !h.passed && h.x1 > x0 && h.x0 < x1);
  if (powered) solids.push({ x0: x0, x1: x1, top: GROUND_Y, ground: true });
  const caps = { maxJumps: ch.maxJumps, glide: ch.glide };
  const endX = b.x + lookahead;
  // prefer a path through the next potion (players steer for potions)
  const pot = s.level.pickups.find(p => !p.taken && (p.type === 'potion' || p.type === 'bigPotion') && p.x > b.x + 20 && p.x < endX - 40);
  const opts = { pad, caps, endGrounded: false, budget: 60000 };
  if (pot) { const r = solve(solids, hazards, b, s.speed, endX, { ...opts, mustCollect: { x: pot.x, y: pot.y } }); if (r.ok && r.path.length) return r.path[0]; }
  let r = solve(solids, hazards, b, s.speed, endX, opts);
  if (!r.ok) r = solve(solids, hazards, b, s.speed, endX, { ...opts, pad: 0 });
  return r.ok && r.path.length ? r.path[0] : { jump: false, slide: false };
}

export function playRun(cfg: RunConfig, o: BotOpts): { s: RunState; r: BotResult } {
  const s = newRun(cfg);
  const rng: RngState = seedRng(o.seed ^ 0x5eed);
  const maxT = o.maxT ?? 900; const look = o.lookahead ?? 8 * TILE;
  let hold: Decision = { jump: false, slide: false }; let holdLeft = 0;
  let pendingJump = -1;
  while (s.phase !== 'over' && s.phase !== 'clear' && s.t < maxT) {
    let jump = false;
    if (holdLeft <= 0) {
      const d = s.phase === 'run' ? planStep(s, o.pad, look) : { jump: false, slide: false };
      hold = { jump: false, slide: d.slide }; holdLeft = 4;
      if (d.jump) pendingJump = s.steps + (o.jitter > 0 ? Math.floor(rngNext(rng) * (o.jitter + 1)) : 0);
    }
    if (pendingJump >= 0 && s.steps >= pendingJump) { jump = true; pendingJump = -1; }
    stepRun(s, { jump, slide: hold.slide, jumpHeld: jump });
    s.events.length = 0;
    holdLeft--;
  }
  const st = s.stats;
  return { s, r: { t: s.t, dist: Math.round(s.dist), score: totalScore(s), hits: st.hits, falls: st.falls, potions: st.potions, jellies: st.jellies, jellyPct: st.jelliesSeen ? Math.round(100 * st.jellies / st.jelliesSeen) : 0, bonus: st.bonusTimes, cause: s.deathCause, phase: s.phase, tier: st.maxTier, nearMisses: st.nearMisses, bestStreak: st.bestStreak, steps: s.steps } };
}
void DT;
