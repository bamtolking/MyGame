// Ghost (GDD §10.1 stage card 「유령 켜기/끄기」): the best run on this exact course, replayed from its input log next
// to the player. The log counts sim steps from the run's very first step, 3-2-1 included, so the ghost is rebuilt with
// the countdown setting it was RECORDED with (then it replays exactly, by determinism) and lined up with the player on
// "GO": recorded with a countdown but raced without (instant retry) → it is stepped through its own countdown at the
// start; recorded without but raced with (map / card start) → it waits while the player counts down.
// Ghosts saved before the flag was recorded (noCountdown undefined) are ignored — their alignment is unknown.
import { newRun, stepRun } from '../sim/run';
import { CONTENT_HASH } from '../sim/content';
import type { RunState, Mode } from '../sim/types';
import type { GhostRec } from '../meta/progress';

export interface Ghost { s: RunState; log: number[]; idx: number; bits: number }

/** Can this saved ghost race a run on `seed`? Same course, same build, known countdown setting. (startRun + stage card) */
export function ghostUsable(g: GhostRec | null | undefined, seed: number): g is GhostRec {
  return !!g && typeof g === 'object' && g.seed === (seed >>> 0) && g.content === CONTENT_HASH && Array.isArray(g.log) && typeof g.noCountdown === 'boolean';
}

/** The ghost for a run that starts with (`noCountdown` false) or without a 3-2-1, lined up on "GO". */
export function makeGhost(g: GhostRec, noCountdown: boolean): Ghost | null {
  try {
    const s = newRun({ mode: g.mode as Mode, seed: g.seed, charId: g.charId, partnerId: g.partnerId, companionId: g.companionId, stageId: g.stageId, assist: g.assistOpts, noCountdown: !!g.noCountdown });
    const gh: Ghost = { s, log: g.log, idx: 0, bits: 0 };
    if (noCountdown) for (let i = 0; i < 1000 && s.phase === 'countdown'; i++) stepGhost(gh);
    return gh;
  } catch { return null; }
}

/** One ghost step next to one player step. `playerCounting`: the player's step was a countdown step. */
export function stepGhost(gh: Ghost, playerCounting = false): void {
  const g = gh.s;
  if (playerCounting && g.phase !== 'countdown') return;      // recorded without a 3-2-1: wait for the player's GO
  const log = gh.log; const i = g.steps;
  let jump = false;
  while (gh.idx < log.length && log[gh.idx] === i) { gh.bits = log[gh.idx + 1]; jump = (gh.bits & 1) === 1; gh.idx += 2; }
  stepRun(g, { jump, slide: (gh.bits & 2) === 2, jumpHeld: (gh.bits & 4) === 4 });
  g.events.length = 0;
}
