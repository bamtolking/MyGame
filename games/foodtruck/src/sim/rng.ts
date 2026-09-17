// 판정용 결정적 난수(sfc32). 상태가 순수 데이터라 저장·복원할 수 있다.
// 시각 효과용 난수는 이 모듈을 쓰지 않는다 (Math.random 사용).
export interface RngState { a: number; b: number; c: number; d: number }

export function seedRng(seed: number): RngState {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const st = { a: next(), b: next(), c: next(), d: next() };
  for (let i = 0; i < 12; i++) rngNext(st);
  return st;
}

/** [0,1) 실수. 상태를 변경한다. */
export function rngNext(s: RngState): number {
  s.a >>>= 0; s.b >>>= 0; s.c >>>= 0; s.d >>>= 0;
  let t = (s.a + s.b) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.d = (s.d + 1) | 0;
  t = (t + s.d) | 0;
  s.c = (s.c + t) | 0;
  return (t >>> 0) / 4294967296;
}

export function rngInt(s: RngState, n: number): number {
  return Math.floor(rngNext(s) * n);
}

export function rngRange(s: RngState, min: number, max: number): number {
  return min + rngNext(s) * (max - min);
}

/** 가중치 배열에서 인덱스 선택 */
export function rngWeighted(s: RngState, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return 0;
  let r = rngNext(s) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** 문자열 → 32비트 시드 */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
