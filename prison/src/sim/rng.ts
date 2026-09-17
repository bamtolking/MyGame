// Deterministic sfc32 RNG. State is serializable so a saved game continues identically.
export class Rng {
  a = 0; b = 0; c = 0; d = 0;
  constructor(seed: number) { this.seed(seed); }
  seed(seed: number): void {
    this.a = 0x9e3779b9 ^ seed; this.b = 0x243f6a88 ^ (seed << 7); this.c = 0xb7e15162 ^ (seed >>> 3); this.d = seed | 1;
    for (let i = 0; i < 12; i++) this.next();
  }
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0; this.a = this.b ^ (this.b >>> 9); this.b = (this.c + (this.c << 3)) | 0; this.c = (this.c << 21) | (this.c >>> 11); this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  int(n: number): number { return Math.floor(this.next() * n); }
  range(lo: number, hi: number): number { return lo + this.next() * (hi - lo); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
  getState(): number[] { return [this.a, this.b, this.c, this.d]; }
  setState(s: number[]): void { [this.a, this.b, this.c, this.d] = s; }
}
