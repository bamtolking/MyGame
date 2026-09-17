// 판(보드) 기하: 바깥 한 칸 두께의 고리 길을 몬스터가 시계 방향으로 돕니다. 안쪽 4×6 = 24칸이 유닛 자리. 세로 화면에 맞춘 6×8.
export const COLS = 6;
export const ROWS = 8;
export const CELL = 50;                       // 논리 픽셀
export const FIELD_W = COLS * CELL;           // 300
export const FIELD_H = ROWS * CELL;           // 400
export const INNER_COLS = COLS - 2;           // 4
export const INNER_ROWS = ROWS - 2;           // 6
export const SLOT_COUNT = INNER_COLS * INNER_ROWS; // 24
export const SLOT_R = 20;

/** 고리 길의 총 길이(논리 px). 칸 중심을 잇는 직사각형 둘레. */
export const PATH_LEN = 2 * ((COLS - 1) + (ROWS - 1)) * CELL; // 1200
const SEG_H = (COLS - 1) * CELL; // 250 (가로 변)
const SEG_V = (ROWS - 1) * CELL; // 350 (세로 변)

/** 길 위의 거리(px, 0..PATH_LEN)를 좌표로. 왼쪽 위에서 출발해 시계 방향. */
export function pathPos(d: number): { x: number; y: number } {
  d = ((d % PATH_LEN) + PATH_LEN) % PATH_LEN;
  const h = CELL / 2;
  if (d < SEG_H) return { x: h + d, y: h };
  d -= SEG_H;
  if (d < SEG_V) return { x: h + SEG_H, y: h + d };
  d -= SEG_V;
  if (d < SEG_H) return { x: h + SEG_H - d, y: h + SEG_V };
  d -= SEG_H;
  return { x: h, y: h + SEG_V - d };
}

export function slotPos(slot: number): { x: number; y: number } {
  const c = slot % INNER_COLS, r = Math.floor(slot / INNER_COLS);
  return { x: (1.5 + c) * CELL, y: (1.5 + r) * CELL };
}

/** 논리 좌표 → 자리 번호(없으면 -1). */
export function slotAt(x: number, y: number): number {
  const c = Math.floor(x / CELL) - 1, r = Math.floor(y / CELL) - 1;
  if (c < 0 || c >= INNER_COLS || r < 0 || r >= INNER_ROWS) return -1;
  return r * INNER_COLS + c;
}

/** 배치 순서 추천: 길에 가까운 자리(모서리·가장자리)부터. 봇과 자동 배치용. */
export const SLOT_ORDER: number[] = (() => {
  const list: { slot: number; score: number }[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const p = slotPos(i);
    const dx = Math.min(p.x - CELL / 2, FIELD_W - CELL / 2 - p.x);
    const dy = Math.min(p.y - CELL / 2, FIELD_H - CELL / 2 - p.y);
    // 두 변에 모두 가까울수록(모서리) 좋음
    list.push({ slot: i, score: dx + dy + Math.max(dx, dy) * 0.5 });
  }
  return list.sort((a, b) => a.score - b.score || a.slot - b.slot).map(x => x.slot);
})();

export const MONSTER_CAP = 80;
