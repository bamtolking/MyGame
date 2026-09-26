// Palette readability checks (GDD 11.4): the hazard double outline must stand out on every background layer of
// every biome, and the three hazard body colours (+ the star-candy colour) must stay distinguishable for players
// with colour-vision deficiency. Colour is only a secondary cue (shape comes first), but it should still help.
import { describe, it, expect } from 'vitest';
import { BIOMES } from '../src/data/biomes';
import { OUTLINE_OUT, OUTLINE_IN } from '../src/render/hazards';
import { JELLY_COLOR, LETTER_COLORS } from '../src/render/pickups';

type RGB = [number, number, number];
const hexRgb = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toLinear = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linRgb = (h: string): RGB => hexRgb(h).map(toLinear) as RGB;

/** WCAG 2.x relative luminance and contrast ratio */
const luminance = (h: string): number => { const [r, g, b] = linRgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function contrast(a: string, b: string): number { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

/** Machado, Oliveira & Fernandes (2009) simulation matrices, severity 1.0, applied in linear RGB */
const CVD: Record<string, number[]> = {
  normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
function simulate(h: string, m: number[]): RGB {
  const [r, g, b] = linRgb(h);
  return [clamp01(m[0] * r + m[1] * g + m[2] * b), clamp01(m[3] * r + m[4] * g + m[5] * b), clamp01(m[6] * r + m[7] * g + m[8] * b)];
}
/** Björn Ottosson's OKLab from linear sRGB */
function oklab([r, g, b]: RGB): RGB {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function deltaE(a: string, b: string, cvd: string): number {
  const A = oklab(simulate(a, CVD[cvd])), B = oklab(simulate(b, CVD[cvd]));
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

const MIN_OUTLINE_CONTRAST = 3;
const MIN_DELTA_E = 0.08;

describe('palette: hazard outline vs backgrounds (WCAG ≥ 3:1 for at least one of the two outline colours)', () => {
  for (const bi of BIOMES) {
    it(bi.id, () => {
      const bgs: Record<string, string> = { skyTop: bi.sky[0], skyBottom: bi.sky[1], far: bi.far, mid: bi.mid, near: bi.near, ground: bi.ground, groundTop: bi.groundTop, platform: bi.platform };
      if (bi.haze) bgs.haze = bi.haze;
      for (const [name, bg] of Object.entries(bgs)) {
        const best = Math.max(contrast(OUTLINE_OUT, bg), contrast(OUTLINE_IN, bg));
        expect(best, `${bi.id}.${name} ${bg}: best outline contrast ${best.toFixed(2)}`).toBeGreaterThanOrEqual(MIN_OUTLINE_CONTRAST);
      }
    });
  }
});

describe('palette: hazard bodies are dark (the inner cream line reads on them)', () => {
  for (const bi of BIOMES) {
    it(bi.id, () => {
      for (const k of ['spike', 'tall', 'hang'] as const) {
        const cr = contrast(bi.hazard[k], OUTLINE_IN);
        expect(cr, `${bi.id}.hazard.${k} ${bi.hazard[k]} vs inner line: ${cr.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe('palette: hazard kinds + star candy stay distinct under colour-vision deficiency (OKLab ΔE ≥ 0.08)', () => {
  for (const bi of BIOMES) {
    it(bi.id, () => {
      const cols: [string, string][] = [['spike', bi.hazard.spike], ['tall', bi.hazard.tall], ['hang', bi.hazard.hang]];
      const rows: string[] = [];
      for (const cvd of Object.keys(CVD)) {
        const ds: string[] = [];
        for (let i = 0; i < cols.length; i++) {
          for (let j = i + 1; j < cols.length; j++) {
            const d = deltaE(cols[i][1], cols[j][1], cvd); ds.push(`${cols[i][0]}/${cols[j][0]} ${d.toFixed(3)}`);
            expect(d, `${bi.id} ${cvd}: ${cols[i][0]} vs ${cols[j][0]}`).toBeGreaterThanOrEqual(MIN_DELTA_E);
          }
          const dj = deltaE(cols[i][1], JELLY_COLOR, cvd);
          expect(dj, `${bi.id} ${cvd}: ${cols[i][0]} vs jelly`).toBeGreaterThanOrEqual(MIN_DELTA_E);
        }
        rows.push(`${cvd.padEnd(12)} ${ds.join('  ')}`);
      }
      console.log(`${bi.id}\n  ${rows.join('\n  ')}`);
    });
  }
});

describe('palette: the five 잔치 letter lanterns have five distinct colours', () => {
  it('pairwise OKLab ΔE ≥ 0.08 (normal vision)', () => {
    const L = LETTER_COLORS.slice(0, 5);
    expect(L.length).toBe(5);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) expect(deltaE(L[i], L[j], 'normal'), `${L[i]} vs ${L[j]}`).toBeGreaterThanOrEqual(MIN_DELTA_E);
  });
});
