/** 2D 기하 도우미 (이미지 픽셀 좌표: x 오른쪽, y 아래쪽) */

export interface V2 {
  x: number;
  y: number;
}

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

export const mid = (a: V2, b: V2): V2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y });
export const len = (v: V2) => Math.hypot(v.x, v.y);
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 세 점 a-b-c 에서 b의 내각(0~180°).
 */
export function angleAt(a: V2, b: V2, c: V2): number {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const d = len(v1) * len(v2);
  if (d === 0) return 180;
  const cos = clamp((v1.x * v2.x + v1.y * v2.y) / d, -1, 1);
  return deg(Math.acos(cos));
}

/** 두 점을 잇는 선의 수평 대비 기울기(도). 오른쪽 점이 더 아래면 양수. */
export function tiltDeg(left: V2, right: V2): number {
  return deg(Math.atan2(right.y - left.y, right.x - left.x));
}

/** 아래→위 벡터가 수직에서 얼마나 기울었는지(도). dx>0 이면 양수. */
export function fromVerticalDeg(bottom: V2, top: V2): number {
  return deg(Math.atan2(top.x - bottom.x, bottom.y - top.y));
}

/** y 에서 선분 a-b 의 x 값(선형 보간, 연장 포함) */
export function xAtY(a: V2, b: V2, y: number): number {
  if (b.y === a.y) return (a.x + b.x) / 2;
  return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
}

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 구간별 선형 보간: xs 오름차순 */
export function piecewise(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return lerp(ys[i - 1], ys[i], t);
    }
  }
  return ys[ys.length - 1];
}
