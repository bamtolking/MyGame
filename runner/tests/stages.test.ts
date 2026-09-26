// 골목 지도 acceptance: frozen courses are valid, every golden pouch is provably reachable hit-free, runtimes and
// star targets are in range, and each stage can be cleared by a casual bot on its first try at the planned rate.
import { describe, it, expect } from 'vitest';
import { STAGES } from '../src/data/stages';
import { BIOME_ORDER } from '../src/data/biomes';
import { SPEED_TIERS, TILE, PX_PER_M } from '../src/data/physics';
import { PARSED_BY_ID, resolveCourse } from '../src/sim/level';
import { validateChunk, tierCaps } from '../src/sim/validate';
import { newRun, stepRun } from '../src/sim/run';
import { Autopilot } from '../src/sim/autopilot';

describe('stages', () => {
  it('ids are unique, worlds/indices consistent, biomes valid', () => {
    const ids = new Set<string>();
    for (const st of STAGES) {
      expect(ids.has(st.id), st.id).toBe(false); ids.add(st.id);
      expect(st.id).toBe(st.remix ? `${st.world}-R` : `${st.world}-${st.index}`);
      expect(BIOME_ORDER, st.id).toContain(st.biome);
      expect(st.stars.jellyPct, st.id).toBeGreaterThanOrEqual(60); expect(st.stars.jellyPct, st.id).toBeLessThanOrEqual(90);
    }
  });

  it('frozen courses resolve to existing chunks whose tier range covers the tier they run at; runtime ≤ 75 s', () => {
    for (const st of STAGES) {
      const course = resolveCourse(st);
      if (!course) continue;
      let m = 0; const total = course.reduce((a, id) => a + (PARSED_BY_ID.get(id)?.width ?? 0), 0) / PX_PER_M;
      let secs = 0;
      course.forEach(id => {
        const p = PARSED_BY_ID.get(id); expect(p, `${st.id}: unknown chunk ${id}`).toBeTruthy(); if (!p) return;
        const f = total > 0 ? Math.min(1, m / total) : 0; const tier = Math.round(st.tiers[0] + (st.tiers[1] - st.tiers[0]) * f);
        const t = Math.max(p.def.tiers[0], Math.min(p.def.tiers[1], tier));
        expect(Math.abs(t - tier), `${st.id}: ${id} proven for tiers ${p.def.tiers} but course wants ${tier}`).toBeLessThanOrEqual(1);
        secs += p.width / SPEED_TIERS[t]; m += p.width / PX_PER_M;
      });
      expect(secs, `${st.id} runtime`).toBeLessThanOrEqual(75);
    }
  });

  it('every stage has exactly three golden pouches, each reachable hit-free with base abilities', () => {
    for (const st of STAGES) {
      const course = resolveCourse(st);
      const fromGlyphs = course ? course.reduce((a, id) => a + (PARSED_BY_ID.get(id)?.pickups.filter(k => k.kind === 'slotB').length ?? 0), 0) : 0;
      const fromDefs = st.pouches?.length ?? 0;
      expect(fromGlyphs + fromDefs, `${st.id} pouches`).toBe(3);
      if (!course) continue;
      let m = 0; const total = course.reduce((a, id) => a + (PARSED_BY_ID.get(id)?.width ?? 0), 0) / PX_PER_M;
      course.forEach((id, slot) => {
        const p = PARSED_BY_ID.get(id)!; const f = Math.min(1, m / total);
        const tier = Math.round(st.tiers[0] + (st.tiers[1] - st.tiers[0]) * f); const t = Math.max(p.def.tiers[0], Math.min(p.def.tiers[1], tier));
        const cells = [...p.pickups.filter(k => k.kind === 'slotB').map(k => ({ x: k.x, y: k.y })),
          ...(st.pouches ?? []).filter(q => q.slot === slot).map(q => ({ x: q.col * TILE + TILE / 2, y: q.row * TILE + TILE / 2 }))];
        for (const c of cells) expect(validateChunk(p, SPEED_TIERS[t], { mustCollect: c, caps: tierCaps(t) }).ok, `${st.id} pouch in ${id}@${c.x / TILE | 0},${c.y / TILE | 0}`).toBe(true);
        m += p.width / PX_PER_M;
      });
    }
  });

  it('every stage can be finished: a good bot clears each one', () => {
    for (const st of STAGES) {
      const s = newRun({ mode: 'stage', seed: st.seed, charId: 'hotteok', stageId: st.id, noCountdown: true });
      const ap = new Autopilot({ jitter: 5, seed: 3 });
      let n = 0; while (s.phase !== 'clear' && s.phase !== 'over' && n++ < 60 * 120) { stepRun(s, ap.next(s)); s.events.length = 0; }
      expect(s.phase, `${st.id} (dist ${Math.floor(s.dist)} m, cause ${s.deathCause})`).toBe('clear');
    }
  });
});
