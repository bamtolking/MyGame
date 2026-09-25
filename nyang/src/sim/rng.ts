// 판정용 시드 난수 (sfc32). 상태를 저장/복원할 수 있다.
export interface Rng { a: number; b: number; c: number; d: number }

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const split = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const r = { a: split(), b: split(), c: split(), d: split() };
  for (let i = 0; i < 12; i++) next(r);
  return r;
}

export function next(r: Rng): number {
  r.a >>>= 0; r.b >>>= 0; r.c >>>= 0; r.d >>>= 0;
  let t = (r.a + r.b) | 0;
  r.a = r.b ^ (r.b >>> 9);
  r.b = (r.c + (r.c << 3)) | 0;
  r.c = (r.c << 21) | (r.c >>> 11);
  r.d = (r.d + 1) | 0;
  t = (t + r.d) | 0;
  r.c = (r.c + t) | 0;
  return (t >>> 0) / 4294967296;
}

export function range(r: Rng, lo: number, hi: number): number {
  return lo + next(r) * (hi - lo);
}

export function int(r: Rng, n: number): number {
  return Math.floor(next(r) * n);
}

export function weighted(r: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let x = next(r) * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}

export function cloneRng(r: Rng): Rng {
  return { a: r.a, b: r.b, c: r.c, d: r.d };
}

/** 문자열 → 32비트 시드 (FNV-1a) */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
