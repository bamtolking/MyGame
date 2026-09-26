// Headless player bot for balance sweeps: the game's Autopilot (solver-planned, window-centred jumps) with a
// human-like ±jitter-frame timing error.
import { newRun, stepRun, totalScore, type RunConfig } from '../src/sim/run';
import { Autopilot } from '../src/sim/autopilot';
import type { RunState } from '../src/sim/types';

export interface BotOpts { jitter: number; pad: number; seed: number; maxT?: number; lookahead?: number }
export interface BotResult { t: number; dist: number; score: number; hits: number; falls: number; potions: number; jellies: number; jellyPct: number; bonus: number; cause: string | null; phase: string; tier: number; nearMisses: number; bestStreak: number; steps: number }

export function playRun(cfg: RunConfig, o: BotOpts): { s: RunState; r: BotResult } {
  const s = newRun(cfg);
  const ap = new Autopilot({ jitter: o.jitter, pad: o.pad, seed: o.seed, lookTiles: o.lookahead ? o.lookahead / 40 : 12 });
  const maxT = o.maxT ?? 900;
  while (s.phase !== 'over' && s.phase !== 'clear' && s.t < maxT) { stepRun(s, ap.next(s)); s.events.length = 0; }
  const st = s.stats;
  return { s, r: { t: s.t, dist: Math.round(s.dist), score: totalScore(s), hits: st.hits, falls: st.falls, potions: st.potions, jellies: st.jellies, jellyPct: st.jelliesSeen ? Math.round(100 * st.jellies / st.jelliesSeen) : 0, bonus: st.bonusTimes, cause: s.deathCause, phase: s.phase, tier: st.maxTier, nearMisses: st.nearMisses, bestStreak: st.bestStreak, steps: s.steps } };
}
