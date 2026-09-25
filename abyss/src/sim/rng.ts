// Deterministic PRNG (sfc32). Used for dungeon generation, loot and combat rolls so a seed reproduces a run.
export class Rng {
  a: number; b: number; c: number; d: number;

  constructor(seed: number) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next(); this.b = next(); this.c = next(); this.d = next();
    for (let i = 0; i < 12; i++) this.next();
  }

  /** Float in [0,1). */
  next(): number {
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  /** Integer in [0, n). */
  int(n: number): number { return Math.floor(this.next() * n); }
  /** Integer in [lo, hi] inclusive. */
  irange(lo: number, hi: number): number { return lo + Math.floor(this.next() * (hi - lo + 1)); }
  /** Float in [lo, hi). */
  range(lo: number, hi: number): number { return lo + this.next() * (hi - lo); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
  weighted<T>(arr: readonly T[], weight: (t: T) => number): T {
    let total = 0;
    for (const x of arr) total += Math.max(0, weight(x));
    let r = this.next() * total;
    for (const x of arr) { r -= Math.max(0, weight(x)); if (r < 0) return x; }
    return arr[arr.length - 1];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  /** Derive an independent seed (for sub-generators). */
  fork(): number { return (this.next() * 4294967296) >>> 0; }
}
