// Fairness proof for the whole chunk library (the "no impossible patterns" promise).
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHUNKS } from '../src/data/chunks';
import { parseChunk, lintChunk } from '../src/sim/chunk';
import { validateChunk, validateRobust, chunkSlack, tierCaps, ROBUST_STEPS } from '../src/sim/validate';
import { SPEED_TIERS, TILE, GROUND_ROW, MAX_TIER } from '../src/data/physics';
import { BIOME_ORDER } from '../src/data/biomes';

const parsed = CHUNKS.map(parseChunk);
const normal = parsed.filter(p => !p.def.tags?.includes('sky') && !p.def.tags?.includes('special'));
const report: string[] = ['| chunk | tiers | cols | slack@min | slack@max | jellies reachable | tags |', '|---|---|---:|---:|---:|---:|---|'];

describe('chunk library', () => {
  it('ids are unique and every chunk lints clean', () => {
    const ids = new Set<string>();
    for (const p of parsed) {
      expect(ids.has(p.def.id), `duplicate id ${p.def.id}`).toBe(false); ids.add(p.def.id);
      expect(lintChunk(p), p.def.id).toEqual([]);
      if (p.def.biomes) for (const b of p.def.biomes) expect(BIOME_ORDER, `${p.def.id} biome`).toContain(b);
      expect(p.def.tiers[1], p.def.id).toBeLessThanOrEqual(MAX_TIER);
    }
  });

  it('sky chunks are safe: full ground, no hazards', () => {
    for (const p of parsed.filter(p => p.def.tags?.includes('sky'))) {
      expect(p.hazards.length, p.def.id).toBe(0);
      expect(p.def.rows[GROUND_ROW].includes('.'), p.def.id).toBe(false);
    }
  });

  it('every tier has enough distinct chunks for the no-repeat window', () => {
    for (let t = 0; t <= MAX_TIER; t++) {
      const n = normal.filter(p => p.def.tiers[0] <= t && p.def.tiers[1] >= t && !p.def.tags?.includes('tutorial')).length;
      expect(n, `tier ${t} pool`).toBeGreaterThanOrEqual(12);
    }
  });

  it('no dead air: never more than ~1.5 s without a jelly or hazard at the slowest speed', () => {
    for (const p of normal) {
      const xs = [...p.pickups.map(k => k.x), ...p.hazards.map(h => (h.x0 + h.x1) / 2)].sort((a, b) => a - b);
      let gap = xs.length ? xs[0] : p.width;
      for (let i = 1; i < xs.length; i++) gap = Math.max(gap, xs[i] - xs[i - 1]);
      gap = Math.max(gap, p.width - (xs[xs.length - 1] ?? 0));
      expect(gap / SPEED_TIERS[p.def.tiers[0]], `${p.def.id} dead-air gap ${gap}px`).toBeLessThanOrEqual(1.5);
    }
  });

  it('every chunk is crossable hit-free at every speed of its tier range (fine check: hurtbox +5 px, 67 ms decisions)', () => {
    const fails: string[] = [];
    for (const p of [...normal, ...parsed.filter(p => p.def.tags?.includes('special'))]) {
      for (let t = p.def.tiers[0]; t <= p.def.tiers[1]; t++) {
        if (!validateChunk(p, SPEED_TIERS[t], { caps: tierCaps(t) }).ok) fails.push(`${p.def.id}@tier${t}`);
      }
    }
    expect(fails).toEqual([]);
  });

  it('every forced action has a human-sized window (phase-robust check: 250/200/150 ms by tier)', () => {
    const fails: string[] = [];
    for (const p of [...normal, ...parsed.filter(p => p.def.tags?.includes('special'))]) {
      for (let t = p.def.tiers[0]; t <= p.def.tiers[1]; t++) {
        const r = validateRobust(p, t, SPEED_TIERS[t]);
        if (!r.ok) fails.push(`${p.def.id}@tier${t} (window < ${Math.round(ROBUST_STEPS[t] / 60 * 1000)}ms)`);
      }
    }
    expect(fails).toEqual([]);
  });

  it('potion slots reachable hit-free at every speed; EVERY jelly is individually collectible hit-free (no bait) at the slowest and fastest speed', () => {
    const fails: string[] = [];
    for (const p of normal) {
      const [a, b] = p.def.tiers;
      for (const pk of p.pickups.filter(k => k.kind === 'slotP')) {
        for (let t = a; t <= b; t++) {
          if (!validateChunk(p, SPEED_TIERS[t], { mustCollect: pk, caps: tierCaps(t) }).ok) fails.push(`${p.def.id} potion@col${pk.x / TILE | 0},row${pk.y / TILE | 0} tier${t}`);
        }
      }
      const jel = p.pickups.filter(k => k.kind !== 'slotP');
      let bad = 0;
      for (const t of a === b ? [a] : [a, b]) {
        for (const k of jel) {
          if (!validateChunk(p, SPEED_TIERS[t], { mustCollect: k, pad: 2, caps: tierCaps(t) }).ok) { bad++; fails.push(`${p.def.id} bait '${k.kind}'@col${k.x / TILE | 0},row${k.y / TILE | 0} tier${t}`); }
        }
      }
      const sMin = chunkSlack(p, SPEED_TIERS[a], tierCaps(a)); const sMax = chunkSlack(p, SPEED_TIERS[b], tierCaps(b));
      report.push(`| ${p.def.id} | ${p.def.tiers.join('–')} | ${p.cols} | ${sMin} | ${sMax} | ${bad === 0 ? '100%' : 'bait ' + bad} | ${(p.def.tags ?? []).join(' ')} |`);
    }
    try { mkdirSync('docs', { recursive: true }); writeFileSync('docs/chunk-report.md', '# 청크 공정성 리포트 (자동 생성)\n\n슬랙 = 판정 상자를 몇 px 키워도 여전히 무피격 통과가 가능한지 (최대 23). 클수록 여유로운 청크. 모든 청크는 단계별 최소 행동 창(250/200/150ms) 검사도 통과합니다.\n\n' + report.join('\n') + '\n'); } catch { /* ignore */ }
    expect(fails).toEqual([]);
  });

  it('easy tiers are forgiving: tier-0/1 chunks keep ≥ 8 px slack', () => {
    for (const p of normal.filter(p => p.def.tiers[0] <= 1)) {
      const sl = chunkSlack(p, SPEED_TIERS[p.def.tiers[0]], tierCaps(p.def.tiers[0]));
      expect(sl, `${p.def.id} slack`).toBeGreaterThanOrEqual(8);
    }
  });
});
