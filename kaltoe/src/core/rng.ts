// 결정적 난수(sfc32). 상태가 평범한 데이터라 저장/복원·재현 테스트가 가능하다.
export interface Rng { a: number; b: number; c: number; d: number }

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const r = { a: next(), b: next(), c: next(), d: next() };
  for (let i = 0; i < 12; i++) rand(r);
  return r;
}

/** [0,1) */
export function rand(s: Rng): number {
  let t = (s.a + s.b) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.d = (s.d + 1) | 0;
  t = (t + s.d) | 0;
  s.c = (s.c + t) | 0;
  return (t >>> 0) / 4294967296;
}

export const randRange = (s: Rng, a: number, b: number) => a + (b - a) * rand(s);
export const randInt = (s: Rng, n: number) => Math.floor(rand(s) * n);
export const chance = (s: Rng, p: number) => rand(s) < p;
export function pick<T>(s: Rng, arr: readonly T[]): T { return arr[randInt(s, arr.length)]; }
export function shuffle<T>(s: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = randInt(s, i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
export function weighted<T>(s: Rng, items: readonly T[], weight: (t: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return undefined;
  let r = rand(s) * total;
  for (const it of items) { r -= Math.max(0, weight(it)); if (r < 0) return it; }
  return items[items.length - 1];
}

/** 문자열 → 32비트 해시(FNV-1a). 일일 도전 시드 등에 사용. */
export function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
