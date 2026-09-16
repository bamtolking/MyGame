// 도깨비 야시장 — logical field 400 x 600
export const FIELD_W = 400;
export const FIELD_H = 600;
export const PATH_HALF = 15;

export const PATH_POINTS: [number, number][] = [
  [-30, 60], [330, 60], [330, 150], [90, 150], [90, 240], [330, 240], [330, 330],
  [150, 330], [150, 430], [330, 430], [330, 520], [200, 520], [200, 615],
];

export interface SlotDef { id: number; x: number; y: number; name: string }
// 23 placement slots. Names are for the tutorial/log only.
export const SLOTS: SlotDef[] = [
  { id: 0, x: 80, y: 20, name: '입구 등불1' }, { id: 1, x: 170, y: 20, name: '입구 등불2' }, { id: 2, x: 260, y: 20, name: '입구 등불3' },
  { id: 3, x: 130, y: 105, name: '가판대 A1' }, { id: 4, x: 210, y: 105, name: '가판대 A2' }, { id: 5, x: 290, y: 105, name: '가판대 A3' }, { id: 6, x: 370, y: 105, name: '동쪽 모퉁이1' },
  { id: 7, x: 45, y: 195, name: '서쪽 골목' }, { id: 8, x: 150, y: 195, name: '가판대 B1' }, { id: 9, x: 240, y: 195, name: '가판대 B2' }, { id: 10, x: 330, y: 195, name: '동쪽 안뜰' },
  { id: 11, x: 110, y: 285, name: '가판대 C1' }, { id: 12, x: 200, y: 285, name: '가판대 C2' }, { id: 13, x: 290, y: 285, name: '가판대 C3' }, { id: 14, x: 370, y: 285, name: '동쪽 모퉁이2' },
  { id: 15, x: 100, y: 380, name: '창고 앞마당' }, { id: 16, x: 200, y: 380, name: '골목 중심1' }, { id: 17, x: 280, y: 380, name: '골목 중심2' },
  { id: 18, x: 150, y: 475, name: '보물길 서쪽' }, { id: 19, x: 250, y: 475, name: '보물길 중앙' }, { id: 20, x: 370, y: 475, name: '동쪽 모퉁이3' },
  { id: 21, x: 145, y: 565, name: '금고 문 서쪽' }, { id: 22, x: 258, y: 565, name: '금고 문 동쪽' },
];
export const SLOT_R = 19;

// Precomputed path geometry
export interface Seg { x0: number; y0: number; x1: number; y1: number; len: number; start: number }
export const SEGS: Seg[] = (() => {
  const out: Seg[] = []; let acc = 0;
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const [x0, y0] = PATH_POINTS[i]; const [x1, y1] = PATH_POINTS[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    out.push({ x0, y0, x1, y1, len, start: acc }); acc += len;
  }
  return out;
})();
export const PATH_LEN = SEGS.reduce((a, s) => a + s.len, 0);

export function posAt(progress: number): [number, number] {
  if (progress <= 0) { const s = SEGS[0]; return [s.x0, s.y0]; }
  for (let i = 0; i < SEGS.length; i++) {
    const s = SEGS[i];
    if (progress <= s.start + s.len) {
      const k = (progress - s.start) / s.len;
      return [s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k];
    }
  }
  const s = SEGS[SEGS.length - 1]; return [s.x1, s.y1];
}

/** Length of path within `range` of point (for slot quality analysis). */
export function coverage(x: number, y: number, range: number, step = 4): number {
  let n = 0;
  for (let p = 0; p < PATH_LEN; p += step) { const [px, py] = posAt(p); if (Math.hypot(px - x, py - y) <= range) n += step; }
  return n;
}
