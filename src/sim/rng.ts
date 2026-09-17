// 결정적 난수(sfc32). 상태를 저장/복원할 수 있어 같은 시드+같은 입력이면 같은 결과.
export interface RngState { a: number; b: number; c: number; d: number }

export function rngCreate(seed: number): RngState {
  let s = (seed >>> 0) || 0x9e3779b9;
  const next = () => { s = (s + 0x9e3779b9) >>> 0; let z = s; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); return (z ^ (z >>> 16)) >>> 0; };
  const st = { a: next(), b: next(), c: next(), d: next() };
  for (let i = 0; i < 12; i++) rngNext(st);
  return st;
}
/** [0,1) */
export function rngNext(r: RngState): number {
  r.a >>>= 0; r.b >>>= 0; r.c >>>= 0; r.d >>>= 0;
  const t = (r.a + r.b | 0) + r.d | 0;
  r.d = r.d + 1 | 0;
  r.a = r.b ^ (r.b >>> 9);
  r.b = r.c + (r.c << 3) | 0;
  r.c = (r.c << 21 | r.c >>> 11);
  r.c = r.c + t | 0;
  return (t >>> 0) / 4294967296;
}
export function rngInt(r: RngState, n: number): number { return Math.floor(rngNext(r) * n); }
export function rngPick<T>(r: RngState, arr: readonly T[]): T { return arr[rngInt(r, arr.length)]; }
export function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
