// 골목 지도 acceptance: frozen courses are valid, every golden pouch is provably reachable hit-free, runtimes and
// star targets are in range, and each stage can be cleared by a casual bot on its first try at the planned rate.
import { describe, it, expect } from 'vitest';
import { STAGES } from '../src/data/stages';
import { BIOME_ORDER } from '../src/data/biomes';
import { SPEED_TIERS, TILE, PX_PER_M } from '../src/data/physics';
import { PARSED_BY_ID, resolveCourse, ensureLevel } from '../src/sim/level';
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

  it('the 21-stage map of GDD §8.2: ids, worlds, biomes, remixes, table lengths (±10 %), short intros', () => {
    const TABLE: [string, string, number, [number, number]][] = [
      ['1-1', '첫걸음', 300, [0, 0]], ['1-2', '찜통 탑', 350, [0, 0]], ['1-3', '초롱 아래로', 400, [0, 1]], ['1-4', '꼬치 골목', 450, [0, 1]],
      ['1-5', '하수구 틈', 500, [1, 1]], ['1-6', '야시장 한 바퀴', 550, [1, 1]], ['1-R', '한밤 골목', 550, [2, 2]],
      ['2-1', '평상 위로', 500, [1, 1]], ['2-2', '천막 사다리', 550, [1, 2]], ['2-3', '쏙 내려오기', 600, [2, 2]], ['2-4', '두 갈래 길', 650, [2, 2]],
      ['2-5', '강바람', 700, [2, 3]], ['2-6', '포장마차 종점', 800, [3, 3]], ['2-R', '비 오는 강변', 800, [4, 4]],
      ['3-1', '다리 입구', 700, [3, 3]], ['3-2', '불꽃 터널', 750, [3, 4]], ['3-3', '끊어진 난간', 800, [3, 4]], ['3-4', '박자 맞추기', 850, [4, 4]],
      ['3-5', '세 갈래 불빛', 900, [4, 5]], ['3-6', '보름달 언덕', 1000, [5, 5]], ['3-R', '불꽃 대폭발', 1000, [5, 5]],
    ];
    const WORLD_BIOME: Record<number, string> = { 1: 'market', 2: 'riverside', 3: 'bridge' };
    expect(STAGES.map(s => s.id)).toEqual(TABLE.map(t => t[0]));
    for (const [id, name, len, tiers] of TABLE) {
      const st = STAGES.find(s => s.id === id)!;
      expect(st.name, id).toBe(name); expect(st.tiers, id).toEqual(tiers); expect(st.length, id).toBe(len);
      expect(st.biome, id).toBe(WORLD_BIOME[st.world]);
      expect(!!st.remix, id).toBe(id.endsWith('-R')); if (st.remix) expect(st.index, id).toBe(7);
      expect(st.intro.length, `${id} intro`).toBeGreaterThan(0); expect([...st.intro].length, `${id} intro ≤ 20 chars`).toBeLessThanOrEqual(20);
      const course = resolveCourse(st); expect(course, `${id} has a frozen course`).toBeTruthy();
      const m = course!.reduce((a, c) => a + PARSED_BY_ID.get(c)!.width, 0) / PX_PER_M;
      expect(Math.abs(m - len), `${id} course ${m} m vs table ${len} m`).toBeLessThanOrEqual(len * 0.1);
    }
  });

  it('courses are hand-built: no chunk twice, the biome set piece once where its tiers allow, no pits before 1-5, fast-fall taught in 2-3', () => {
    const sp = (biome: string) => [...PARSED_BY_ID.values()].find(p => p.def.tags?.includes('setpiece') && p.def.biomes?.includes(biome));
    for (const st of STAGES) {
      const course = resolveCourse(st)!;
      expect(new Set(course).size, `${st.id} repeats a chunk`).toBe(course.length);
      const piece = sp(st.biome)!;
      // every stage whose tiers reach the piece's range has it once — except the single-element lessons 1-1…1-3
      const allowed = st.tiers[1] >= piece.def.tiers[0] - 1 && !(st.world === 1 && !st.remix && st.index <= 3);
      expect(course.filter(id => id === piece.def.id).length, `${st.id} set piece`).toBe(allowed ? 1 : 0);
      for (const id of course) expect(PARSED_BY_ID.get(id)!.def.tags?.some(t => ['sky', 'special', 'tutorial'].includes(t)), `${st.id}: ${id} is not a course chunk`).toBeFalsy();
      // speed follows the table: a chunk runs at the stage's tier, or one tier faster only in the closing exam
      let m = 0; const total = course.reduce((a, id) => a + PARSED_BY_ID.get(id)!.width, 0);
      for (const id of course) {
        const p = PARSED_BY_ID.get(id)!; const f = m / total;
        const tier = Math.round(st.tiers[0] + (st.tiers[1] - st.tiers[0]) * f); const t = Math.max(p.def.tiers[0], Math.min(p.def.tiers[1], tier));
        expect(t === tier || (t === tier + 1 && f >= 0.65), `${st.id}: ${id} runs at tier ${t} at ${Math.round(f * 100)}% of a tier-${tier} stretch`).toBe(true);
        m += p.width;
      }
      if (st.world === 1 && !st.remix && st.index < 5) {
        for (const id of course) expect(PARSED_BY_ID.get(id)!.def.rows[11].includes('.'), `${st.id}: ${id} has a pit`).toBe(false);
      }
    }
    const signs = (id: string) => resolveCourse(STAGES.find(s => s.id === id)!)!.flatMap(c => PARSED_BY_ID.get(c)!.def.signs ?? []).map(s => s.text);
    expect(signs('2-3').some(t => t.includes('빠른 낙하')), '2-3 teaches the fast-fall with a sign').toBe(true);
    for (const st of STAGES.filter(s => s.id !== '2-3' && (s.world < 2 || (s.world === 2 && s.index < 3)))) {
      expect(signs(st.id).some(t => t.includes('빠른 낙하')), `${st.id} must not pre-empt the 2-3 lesson`).toBe(false);
    }
  });

  it('pouches: three distinct cells, on existing course slots, never on a hazard', () => {
    for (const st of STAGES) {
      const course = resolveCourse(st)!;
      const cells = new Set<string>();
      for (const q of st.pouches ?? []) {
        expect(q.slot >= 0 && q.slot < course.length, `${st.id} pouch slot ${q.slot}`).toBe(true);
        const p = PARSED_BY_ID.get(course[q.slot])!;
        expect(q.col >= 0 && q.col < p.cols && q.row >= 0 && q.row < 11, `${st.id} pouch cell ${q.col},${q.row}`).toBe(true);
        expect('^Av-=P?LB'.includes(p.def.rows[q.row][q.col]), `${st.id} pouch on '${p.def.rows[q.row][q.col]}' in ${p.def.id}`).toBe(false);
        cells.add(`${q.slot}:${q.col},${q.row}`);
      }
      expect(cells.size, st.id).toBe(st.pouches?.length ?? 0);
    }
  });

  // ★3 is a bitmask of pouch indices 0..2: a set piece's 'B' glyph is numbered after the stage's own `pouches`.
  it('the three pouches of a stage carry three distinct ★3 bits', () => {
    for (const st of STAGES) {
      const s = newRun({ mode: 'stage', seed: st.seed, charId: 'hotteok', stageId: st.id, noCountdown: true });
      const bits = new Map<number, number>();
      for (let x = 0; s.level.finishX === Infinity && x < 80000; x += 200) {
        s.body.x = x; ensureLevel(s);
        for (const p of s.level.pickups) if (p.type === 'pouch') bits.set(p.id, p.pouch ?? -1);
      }
      expect([...new Set(bits.values())].sort(), `${st.id} pouch bits`).toEqual([0, 1, 2]);
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
