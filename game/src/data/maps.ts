// 맵 2종: 경로(적이 따라가는 고정 길)와 배치 칸. 논리 좌표계 400×560.
export type MapId = 'A' | 'B';
export const FIELD_W = 400;
export const FIELD_H = 560;
export const PATH_HALF = 14;   // 길 반폭
export const SLOT_R = 20;      // 배치 칸 반경

export interface Slot { id: number; x: number; y: number; anchorDist: number }
export interface MapDef {
  id: MapId; name: string; sub: string; desc: string;
  theme: { bg1: string; bg2: string; path: string; pathEdge: string; accent: string; deco: 'workshop' | 'canyon' };
  points: readonly (readonly [number, number])[];
  slots: readonly { x: number; y: number }[];
  base: { x: number; y: number };
  unlockedBy: MapId | null; // 해금 조건: 해당 맵 클리어
}

export const MAPS: Record<MapId, MapDef> = {
  A: {
    id: 'A', name: '초록 작업장', sub: '단일 경로 · 입문', desc: '직선과 굽은 길이 번갈아 나옵니다. 관통과 범위 공격을 모두 시험해 보세요.',
    theme: { bg1: '#1b3a2a', bg2: '#122a20', path: '#5d4a36', pathEdge: '#3c3020', accent: '#8bc34a', deco: 'workshop' },
    points: [[-24, 70], [310, 70], [310, 200], [90, 200], [90, 330], [320, 330], [320, 450], [200, 450], [200, 586]],
    slots: [
      { x: 60, y: 135 }, { x: 150, y: 135 }, { x: 240, y: 135 }, { x: 365, y: 135 },
      { x: 40, y: 265 }, { x: 170, y: 265 }, { x: 260, y: 265 }, { x: 355, y: 265 },
      { x: 60, y: 390 }, { x: 150, y: 390 }, { x: 240, y: 390 },
      { x: 120, y: 510 },
    ],
    base: { x: 200, y: 556 },
    unlockedBy: null,
  },
  B: {
    id: 'B', name: '고철 협곡', sub: '평행 협곡 · 응용', desc: '긴 직선 오르막과 나란히 붙은 협곡 구간. 자리마다 보이는 길이 다릅니다.',
    theme: { bg1: '#3a2e24', bg2: '#241b14', path: '#6b5a4a', pathEdge: '#3a2c20', accent: '#ff8f00', deco: 'canyon' },
    points: [[-24, 520], [110, 520], [110, 60], [190, 60], [190, 400], [265, 400], [265, 140], [350, 140], [350, 586]],
    slots: [
      { x: 60, y: 120 }, { x: 60, y: 300 }, { x: 60, y: 440 },
      { x: 150, y: 200 }, { x: 150, y: 350 }, { x: 150, y: 470 },
      { x: 228, y: 120 }, { x: 228, y: 270 }, { x: 228, y: 470 },
      { x: 308, y: 60 }, { x: 308, y: 250 }, { x: 308, y: 500 },
    ],
    base: { x: 350, y: 556 },
    unlockedBy: 'A',
  },
};
export const MAP_IDS: readonly MapId[] = ['A', 'B'];

/** 경로 기하: 누적 길이, 거리→좌표, 좌표→가장 가까운 경로 거리 */
export interface PathGeo { pts: readonly (readonly [number, number])[]; cum: number[]; len: number }
const geoCache = new Map<MapId, PathGeo>();
export function pathGeo(id: MapId): PathGeo {
  let g = geoCache.get(id); if (g) return g;
  const pts = MAPS[id].points; const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  g = { pts, cum, len: cum[cum.length - 1] }; geoCache.set(id, g); return g;
}
export function posAt(g: PathGeo, d: number): [number, number] {
  if (d <= 0) return [g.pts[0][0], g.pts[0][1]];
  if (d >= g.len) { const p = g.pts[g.pts.length - 1]; return [p[0], p[1]]; }
  let i = 1; while (g.cum[i] < d) i++;
  const t = (d - g.cum[i - 1]) / (g.cum[i] - g.cum[i - 1]);
  const a = g.pts[i - 1], b = g.pts[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
export function dirAt(g: PathGeo, d: number): [number, number] {
  let i = 1; while (i < g.cum.length - 1 && g.cum[i] < d) i++;
  const a = g.pts[i - 1], b = g.pts[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}
/** 점에서 가장 가까운 경로 거리(px)와 그 거리값 */
export function nearestDist(g: PathGeo, x: number, y: number): { d: number; dist: number } {
  let best = Infinity, bd = 0;
  for (let i = 1; i < g.pts.length; i++) {
    const a = g.pts[i - 1], b = g.pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1;
    let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t));
    const px = a[0] + dx * t, py = a[1] + dy * t; const dd = Math.hypot(px - x, py - y);
    if (dd < best) { best = dd; bd = g.cum[i - 1] + Math.sqrt(l2) * t; }
  }
  return { d: bd, dist: best };
}
const slotCache = new Map<MapId, Slot[]>();
export function mapSlots(id: MapId): Slot[] {
  let s = slotCache.get(id); if (s) return s;
  const g = pathGeo(id);
  s = MAPS[id].slots.map((p, i) => ({ id: i, x: p.x, y: p.y, anchorDist: nearestDist(g, p.x, p.y).d }));
  slotCache.set(id, s); return s;
}
