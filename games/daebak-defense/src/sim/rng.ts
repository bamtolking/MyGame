// Deterministic PRNG (sfc32). State is plain data so it can be saved/restored.
export interface RngState { a: number; b: number; c: number; d: number }

export function seedRng(seed: number): RngState {
  // splitmix-ish seeding into 4 words
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

/** Returns float in [0,1). Mutates state. */
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

export function rngPick<T>(s: RngState, arr: readonly T[]): T {
  return arr[rngInt(s, arr.length)];
}

export function rngShuffle<T>(s: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(s, i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
