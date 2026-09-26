// Ghosts race the player from "GO" whether the best run was recorded with a 3-2-1 (map / stage card start) or
// without one (instant retry), and replay the recorded run exactly (src/ui/ghost.ts, GDD §8.2 「유령도 항상 맞는다」).
import { describe, it, expect } from 'vitest';
import { newRun, stepRun, totalScore, type RunConfig } from '../src/sim/run';
import { Autopilot } from '../src/sim/autopilot';
import { CONTENT_HASH } from '../src/sim/content';
import { ghostUsable, makeGhost, stepGhost } from '../src/ui/ghost';
import type { GhostRec } from '../src/meta/progress';
import type { RunState } from '../src/sim/types';

const MAX = 60 * 240;
function record(cfg: RunConfig): { s: RunState; rec: GhostRec } {
  const s = newRun(cfg); const ap = new Autopilot({ jitter: 0, seed: 5 });
  for (let i = 0; i < MAX && s.phase !== 'over' && s.phase !== 'clear'; i++) { stepRun(s, ap.next(s)); s.events.length = 0; }
  const rec = { seed: s.seed, content: CONTENT_HASH, charId: s.mainId, partnerId: s.partnerId, companionId: s.companionId, mode: s.mode, stageId: s.stageId,
    log: s.log.slice(), score: totalScore(s), steps: s.steps, assist: s.assist, assistOpts: { ...s.assistOpts }, noCountdown: !!cfg.noCountdown };
  return { s, rec };
}

describe('ghost replay lines up on GO', () => {
  for (const id of ['1-1', '1-4', '2-3']) {
    for (const [recNoCd, curNoCd] of [[false, true], [true, false], [false, false], [true, true]]) {
      it(`${id}: recorded ${recNoCd ? 'without' : 'with'} a countdown, raced ${curNoCd ? 'without' : 'with'}`, () => {
        const cfg: RunConfig = { mode: 'stage', seed: 0, charId: 'hotteok', stageId: id, noCountdown: recNoCd };
        const { s: best, rec } = record(cfg);
        expect(best.phase).toBe('clear');
        expect(ghostUsable(rec, best.seed)).toBe(true);
        const gh = makeGhost(rec, curNoCd)!;
        const me = newRun({ ...cfg, noCountdown: curNoCd });
        let ran = 0;
        for (let i = 0; i < MAX + 200 && gh.s.phase !== 'over' && gh.s.phase !== 'clear'; i++) {
          const counting = me.phase === 'countdown';
          stepRun(me, { jump: false, slide: false, jumpHeld: false }); me.events.length = 0;
          stepGhost(gh, counting);
          // a runner that never presses anything moves exactly like the ghost until the ghost's first press / power-up
          if (!counting && ran < 60) { expect(gh.s.phase).toBe('run'); expect(gh.s.body.x).toBe(me.body.x); ran++; }
        }
        expect(ran).toBe(60);
        expect([gh.s.phase, gh.s.stats.hits, totalScore(gh.s), gh.s.steps]).toEqual([best.phase, best.stats.hits, totalScore(best), best.steps]);
      });
    }
  }
  it('ghosts without a recorded countdown setting, or from another course / build, are not raced', () => {
    const { rec } = record({ mode: 'stage', seed: 0, charId: 'hotteok', stageId: '1-1' });
    expect(ghostUsable({ ...rec, noCountdown: undefined }, rec.seed)).toBe(false);
    expect(ghostUsable({ ...rec, content: rec.content ^ 1 }, rec.seed)).toBe(false);
    expect(ghostUsable(rec, rec.seed + 1)).toBe(false);
    expect(ghostUsable(null, rec.seed)).toBe(false);
  });
});
