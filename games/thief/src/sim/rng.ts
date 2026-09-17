// Seeded RNG (sfc32). All simulation randomness goes through this so that
// the same seed + same inputs always produce the same attempt.
export class Rng {
  private a: number; private b: number; private c: number; private d: number;
  constructor(seed: number) {
    this.a = 0x9e3779b9 ^ seed; this.b = 0x243f6a88 ^ (seed * 7919); this.c = 0xb7e15162 ^ (seed * 104729); this.d = seed | 1;
    for (let i = 0; i < 12; i++) this.next();
  }
  /** [0,1) */
  next(): number {
    this.a |= 0; this.b |= 0; this.c |= 0; this.d |= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  range(min: number, max: number): number { return min + (max - min) * this.next(); }
  snapshot(): [number, number, number, number] { return [this.a, this.b, this.c, this.d]; }
  restore(s: [number, number, number, number]): void { [this.a, this.b, this.c, this.d] = s; }
}
