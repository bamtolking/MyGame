// Fairness proof for the whole chunk library (the "no impossible patterns" promise).
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHUNKS } from '../src/data/chunks';
import { parseChunk, lintChunk } from '../src/sim/chunk';
import { validateChunk, chunkSlack } from '../src/sim/validate';
import { SPEED_TIERS, TILE, GROUND_ROW, MAX_TIER } from '../src/data/physics';
import { BIOME_ORDER } from '../src/data/biomes';

const parsed = CHUNKS.map(parseChunk);
const normal = parsed.filter(p => !p.def.tags?.includes('sky') && !p.def.tags?.includes('special'));
const report: string[] = ['| chunk | tiers | cols | slack@min | slack@max | jelly reach | notes |', '|---|---|---:|---:|---:|---:|---|'];

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

  it('every chunk is crossable hit-free at every speed of its tier range (handicapped validator)', () => {
    const fails: string[] = [];
    for (const p of [...normal, ...parsed.filter(p => p.def.tags?.includes('special'))]) {
      for (let t = p.def.tiers[0]; t <= p.def.tiers[1]; t++) {
        const r = validateChunk(p, SPEED_TIERS[t]);
        if (!r.ok) fails.push(`${p.def.id}@tier${t}`);
      }
    }
    expect(fails).toEqual([]);
  });

  it('potion slots are reachable hit-free at every speed; ≥85 % of jellies are collectible hit-free at the slowest speed', () => {
    const fails: string[] = [];
    for (const p of normal) {
      for (const pk of p.pickups.filter(k => k.kind === 'slotP')) {
        for (let t = p.def.tiers[0]; t <= p.def.tiers[1]; t++) {
          if (!validateChunk(p, SPEED_TIERS[t], { mustCollect: pk }).ok) fails.push(`${p.def.id} potion@${pk.x / TILE | 0},${pk.y / TILE | 0} tier${t}`);
        }
      }
      const jel = p.pickups.filter(k => k.kind === 'jelly' || k.kind === 'big');
      const v = SPEED_TIERS[p.def.tiers[0]];
      const ok = jel.filter(k => validateChunk(p, v, { mustCollect: k, pad: 2 }).ok).length;
      const pct = jel.length ? Math.round(100 * ok / jel.length) : 100;
      if (pct < 85) fails.push(`${p.def.id} jellies reachable ${pct}%`);
      const sMin = chunkSlack(p, SPEED_TIERS[p.def.tiers[0]]); const sMax = chunkSlack(p, SPEED_TIERS[p.def.tiers[1]]);
      report.push(`| ${p.def.id} | ${p.def.tiers.join('–')} | ${p.cols} | ${sMin} | ${sMax} | ${pct}% | ${(p.def.tags ?? []).join(' ')} |`);
    }
    try { mkdirSync('docs', { recursive: true }); writeFileSync('docs/chunk-report.md', '# 청크 공정성 리포트 (자동 생성)\n\n슬랙 = 판정 상자를 몇 px 키워도 여전히 무피격 통과가 가능한지 (최대 23). 클수록 여유로운 청크.\n\n' + report.join('\n') + '\n'); } catch { /* ignore */ }
    expect(fails).toEqual([]);
  });

  it('easy tiers are forgiving: tier-0/1 chunks keep ≥ 8 px slack', () => {
    for (const p of normal.filter(p => p.def.tiers[0] <= 1)) {
      const sl = chunkSlack(p, SPEED_TIERS[p.def.tiers[0]]);
      expect(sl, `${p.def.id} slack`).toBeGreaterThanOrEqual(8);
    }
  });
});
