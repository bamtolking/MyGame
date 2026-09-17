import { describe, it, expect } from 'vitest';
import { ZONES } from '../src/data/zones';
import { findTiles, blocksMove, setTile, tileCenter } from '../src/sim/geom';
import { ESCAPE, SPAWN_MIN_DIST, TILE } from '../src/data/balance';

function bfs(rows: string[], sx: number, sy: number): Set<string> {
  const seen = new Set<string>([`${sx},${sy}`]); const q = [[sx, sy]];
  while (q.length) { const [x, y] = q.shift()!; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ox, ny = y + oy; const k = `${nx},${ny}`; if (seen.has(k) || blocksMove(rows, nx, ny, true)) continue; seen.add(k); q.push([nx, ny]); } }
  return seen;
}
function collapsed(rows: string[]): string[] { const r = rows.slice(); for (const [x, y] of findTiles(r, 'x')) setTile(r, x, y, '#'); for (const [x, y] of findTiles(r, 'y')) setTile(r, x, y, '.'); return r; }

describe('지도 검증', () => {
  for (const z of ZONES) {
    it(`${z.index}구역 ${z.name}: 직사각형·외벽·시작·출구`, () => {
      const w = z.map[0].length; for (const r of z.map) expect(r.length).toBe(w);
      expect(z.map[0]).toMatch(/^#+$/); expect(z.map[z.map.length - 1]).toMatch(/^#+$/);
      for (const r of z.map) { expect(r[0]).toBe('#'); expect(r[w - 1]).toBe('#'); }
      expect(findTiles(z.map, 'P').length).toBe(1);
      if (z.boss) { expect(findTiles(z.map, 'B').length).toBe(1); expect(findTiles(z.map, 'E').length).toBe(1); }
      else expect(findTiles(z.map, 'D').length).toBe(1);
      if (z.escape) expect(findTiles(z.map, 'E').length).toBe(1);
      expect(findTiles(z.map, '1').length + findTiles(z.map, '2').length).toBeGreaterThanOrEqual(2);
    });
    it(`${z.index}구역: 시작점에서 모든 목표에 도달 가능 (붕괴 전·후)`, () => {
      const variants = z.events.collapseAtKills ? [z.map, collapsed(z.map)] : [z.map];
      for (const rows of variants) {
        const [px, py] = findTiles(rows, 'P')[0]; const reach = bfs(rows, px, py);
        for (const ch of ['D', 'E', 'c', 'A', 'l', 'M', 'B', '1', '2', '3', '4', '5']) for (const [x, y] of findTiles(rows, ch)) expect(reach.has(`${x},${y}`), `${ch}@${x},${y}`).toBe(true);
      }
    });
    if (z.escape || z.boss) it(`${z.index}구역: 탈출 지점 주변에 회피 공간`, () => {
      const [ex, ey] = findTiles(z.map, 'E')[0]; const [cx, cy] = tileCenter(ex, ey); let open = 0;
      for (let ty = ey - 3; ty <= ey + 3; ty++) for (let tx = ex - 3; tx <= ex + 3; tx++) { const [x, y] = tileCenter(tx, ty); if (Math.hypot(x - cx, y - cy) <= ESCAPE.padRadius + TILE / 2 && !blocksMove(z.map, tx, ty, true)) open++; }
      expect(open).toBeGreaterThanOrEqual(18);
    });
    it(`${z.index}구역: 플레이어 시작점에서 충분히 먼 생성 지점 존재`, () => {
      const [px, py] = tileCenter(...findTiles(z.map, 'P')[0]); let far = 0;
      for (const d of ['1', '2', '3', '4', '5']) for (const [x, y] of findTiles(z.map, d)) { const [cx, cy] = tileCenter(x, y); if (Math.hypot(cx - px, cy - py) >= SPAWN_MIN_DIST) far++; }
      expect(far).toBeGreaterThanOrEqual(1);
    });
  }
});
