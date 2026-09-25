// 보이는 반지름을 물리보다 살짝 크게 잡고, 겹치는 부분을 두 원의 근축(radical line)으로 잘라
// 떡처럼 맞닿은 모양을 만든다. 벽과 바닥도 같은 방식으로 평평하게 누른다.
import type { Clip } from './catdraw';

export const VISUAL_SCALE = 1.075;

export interface Disc { x: number; y: number; r: number }

/** discs[i]의 잘림 평면 목록을 out[i]에 채운다. W,H = 상자 안쪽 크기 (벽 무시하려면 NaN) */
export function buildClips(discs: Disc[], W: number, H: number, out: Clip[][]): void {
  const n = discs.length;
  while (out.length < n) out.push([]);
  for (let i = 0; i < n; i++) {
    const c = out[i]; c.length = 0;
    const a = discs[i];
    if (W === W) {
      if (a.x - a.r < 0) c.push({ nx: -1, ny: 0, d: Math.max(a.r * 0.35, a.x) });
      if (a.x + a.r > W) c.push({ nx: 1, ny: 0, d: Math.max(a.r * 0.35, W - a.x) });
    }
    if (H === H && a.y + a.r > H) c.push({ nx: 0, ny: 1, d: Math.max(a.r * 0.35, H - a.y) });
  }
  // x 정렬로 이웃 찾기
  const idx = discs.map((_, i) => i).sort((p, q) => (discs[p].x - discs[p].r) - (discs[q].x - discs[q].r));
  for (let ii = 0; ii < n; ii++) {
    const i = idx[ii]; const A = discs[i];
    const maxX = A.x + A.r;
    for (let jj = ii + 1; jj < n; jj++) {
      const j = idx[jj]; const B = discs[j];
      if (B.x - B.r > maxX) break;
      const dx = B.x - A.x, dy = B.y - A.y;
      const rr = A.r + B.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const D = Math.sqrt(d2);
      const nx = dx / D, ny = dy / D;
      let da = (d2 + A.r * A.r - B.r * B.r) / (2 * D);
      let db = D - da;
      // 너무 깊게 파고들지 않게
      da = Math.max(A.r * 0.3, da); db = Math.max(B.r * 0.3, db);
      out[i].push({ nx, ny, d: da });
      out[j].push({ nx: -nx, ny: -ny, d: db });
    }
  }
}
