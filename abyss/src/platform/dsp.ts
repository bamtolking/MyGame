// Offline synthesis toolkit. Every sound effect and instrument note is rendered once into a Float32Array
// (then wrapped in an AudioBuffer), so sounds can be layered, filtered, distorted and shaped far more
// richly than a handful of live oscillator nodes would allow.
export const SR = 32000; // effects content stays well under 16 kHz; saves memory and synthesis time
export type Fn = number | ((t: number) => number);
const val = (f: Fn, t: number): number => (typeof f === 'number' ? f : f(t));
const TAU = Math.PI * 2;

export class Rand {
  private s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next(): number { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  bi(): number { return this.next() * 2 - 1; }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
}

export function buf(dur: number, sr = SR): Float32Array { return new Float32Array(Math.max(1, Math.ceil(dur * sr))); }

/** Adds `src` into `dst` starting at `t` seconds. */
export function mix(dst: Float32Array, src: Float32Array, t = 0, gain = 1, sr = SR): Float32Array {
  const o = Math.round(t * sr);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[o + i] += src[i] * gain;
  return dst;
}

/** Mixes several layers `[signal, startTime?, gain?]` into a new buffer of `dur` seconds. */
export function lay(dur: number, ...parts: [Float32Array, number?, number?][]): Float32Array {
  const b = buf(dur);
  for (const [s, t, g] of parts) mix(b, s, t ?? 0, g ?? 1);
  return b;
}

// ---------------------------------------------------------------- envelopes
/** Linear attack, then exponential decay reaching -60 dB `d` seconds after the peak. */
export const perc = (a: number, d: number, peak = 1) => (t: number): number => (t < a ? (peak * t) / a : peak * Math.exp(((a - t) * 6.9) / d));
/** Curved rise over `a`, then exponential release over `r`. */
export const swell = (a: number, r: number, peak = 1) => (t: number): number => (t < a ? peak * (t / a) ** 2 : peak * Math.exp(((a - t) * 6.9) / r));
/** Piecewise linear: lin(t0, v0, t1, v1, ...). */
export const lin = (...p: number[]) => (t: number): number => {
  if (t <= p[0]) return p[1];
  for (let i = 2; i < p.length; i += 2) if (t <= p[i]) { const k = (t - p[i - 2]) / Math.max(1e-6, p[i] - p[i - 2]); return p[i - 1] + (p[i + 1] - p[i - 1]) * k; }
  return p[p.length - 1];
};
/** Exponential glide from f0 to f1 over d seconds. */
export const glide = (f0: number, f1: number, d: number) => (t: number): number => f0 * Math.pow(f1 / f0, Math.min(1, t / d));
/** Smooth random curve between lo and hi changing about `rate` times per second. */
export function wander(rng: Rand, dur: number, rate: number, lo: number, hi: number): (t: number) => number {
  const n = Math.max(2, Math.ceil(dur * rate) + 2);
  const pts = Array.from({ length: n }, () => rng.range(lo, hi));
  return (t) => { const x = Math.max(0, t * rate); const i = Math.min(n - 2, Math.floor(x)); const k = x - i; const s = k * k * (3 - 2 * k); return pts[i] + (pts[i + 1] - pts[i]) * s; };
}

// ---------------------------------------------------------------- sources
export type Wave = 'sin' | 'tri' | 'saw' | 'sqr';
function blep(p: number, dt: number): number {
  if (p < dt) { const x = p / dt; return x + x - x * x - 1; }
  if (p > 1 - dt) { const x = (p - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
export function osc(dur: number, wave: Wave, freq: Fn, amp: Fn = 1, o: { sr?: number; phase?: number; pw?: number; vib?: [number, number]; vibDelay?: number } = {}): Float32Array {
  const sr = o.sr ?? SR, n = Math.ceil(dur * sr), out = new Float32Array(n);
  let p = o.phase ?? 0;
  const pw = o.pw ?? 0.5;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let f = val(freq, t);
    if (o.vib) { const vd = o.vibDelay ?? 0; const k = vd > 0 ? Math.min(1, t / vd) : 1; f *= 1 + o.vib[1] * k * Math.sin(TAU * o.vib[0] * t); }
    const dt = Math.min(0.5, Math.abs(f) / sr);
    let v: number;
    if (wave === 'sin') v = Math.sin(TAU * p);
    else if (wave === 'tri') v = 4 * Math.abs(p - 0.5) - 1;
    else if (wave === 'saw') v = 2 * p - 1 - blep(p, dt);
    else v = (p < pw ? 1 : -1) + blep(p, dt) - blep((p + 1 - pw) % 1, dt);
    out[i] = v * val(amp, t);
    p += dt; if (p >= 1) p -= 1;
  }
  return out;
}

export function noise(dur: number, rng: Rand, amp: Fn = 1, color: 'white' | 'pink' | 'brown' = 'white', sr = SR): Float32Array {
  const n = Math.ceil(dur * sr), out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.bi();
    let v = w;
    if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; v = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    else if (color === 'brown') { br = (br + 0.02 * w) / 1.02; v = br * 3.5; }
    out[i] = v * val(amp, i / sr);
  }
  return out;
}

/** Plucked string (Karplus-Strong with fractional delay). */
export function pluck(f: number, dur: number, rng: Rand, o: { bright?: number; decay?: number; sr?: number } = {}): Float32Array {
  const sr = o.sr ?? SR, n = Math.ceil(dur * sr), y = new Float32Array(n);
  const D = sr / f - 0.5;
  const exLen = Math.min(n, Math.ceil(D));
  const bright = o.bright ?? 0.5;
  const loss = Math.pow(10, -3 / ((o.decay ?? 2) * f));
  let lp = 0, mean = 0;
  const ex = new Float32Array(exLen);
  for (let i = 0; i < exLen; i++) { lp += (rng.bi() - lp) * (0.15 + bright * 0.85); ex[i] = lp; mean += lp; }
  mean /= exLen;
  for (let i = 0; i < n; i++) {
    let v = i < exLen ? ex[i] - mean : 0;
    const r = i - D;
    if (r >= 1) {
      const j = Math.floor(r), fr = r - j;
      const a = y[j] + (y[j + 1] - y[j]) * fr;
      const b = y[j - 1] + (y[j] - y[j - 1]) * fr;
      v += loss * (a + b) * 0.5;
    }
    y[i] = v;
  }
  return y;
}

/** Additive partials [freq, amp, decaySeconds] — bells, blades, coins, shields. */
export function ring(dur: number, partials: [number, number, number][], sr = SR): Float32Array {
  const n = Math.ceil(dur * sr), out = new Float32Array(n);
  for (const [f, a, d] of partials) {
    if (f >= sr * 0.47) continue; // above Nyquist it would alias
    const w = (TAU * f) / sr, k = Math.exp(-6.9 / (d * sr));
    let e = a;
    const att = Math.max(1, Math.round(0.0015 * sr));
    for (let i = 0; i < n; i++) { out[i] += Math.sin(w * i) * e * (i < att ? i / att : 1); e *= k; if (e < 1e-5) break; }
  }
  return out;
}

const BELL: [number, number, number][] = [[0.56, 1, 1], [0.92, 0.67, 0.9], [1.19, 1, 0.65], [1.7, 1.8, 0.55], [2, 2.67, 0.33], [2.74, 1.67, 0.35], [3, 1.46, 0.25], [3.76, 1.33, 0.2], [4.07, 1.33, 0.15]];
export function bell(f: number, dur: number, sr = SR): Float32Array {
  return norm(ring(dur, BELL.map(([r, a, d]) => [f * r, a, d * dur] as [number, number, number]), sr), 1);
}

/** Sparse impulses, each a tiny noise burst: fire crackle, debris, electric spit. */
export function crackle(dur: number, rng: Rand, density: number, amp: Fn = 1, sr = SR): Float32Array {
  const n = Math.ceil(dur * sr), out = new Float32Array(n);
  const count = Math.round(density * dur);
  for (let c = 0; c < count; c++) {
    const at = Math.floor(rng.next() * n), len = Math.floor(sr * rng.range(0.0008, 0.004)), a = rng.range(0.2, 1) * val(amp, at / sr);
    for (let i = 0; i < len && at + i < n; i++) out[at + i] += rng.bi() * a * (1 - i / len);
  }
  return out;
}

// ---------------------------------------------------------------- processing
export type FType = 'lp' | 'hp' | 'bp' | 'notch';
/** Zero-delay-feedback state-variable filter (in place). Band-pass is normalised to unity peak gain. */
export function svf(x: Float32Array, type: FType, cutoff: Fn, q = 0.707, sr = SR): Float32Array {
  let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
  const k = 1 / q;
  const fixed = typeof cutoff === 'number';
  for (let i = 0; i < x.length; i++) {
    if (i === 0 || (!fixed && (i & 31) === 0)) {
      const f = Math.min(sr * 0.45, Math.max(15, val(cutoff, i / sr)));
      const g = Math.tan((Math.PI * f) / sr);
      a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
    }
    const v0 = x[i], v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    x[i] = type === 'lp' ? v2 : type === 'bp' ? k * v1 : type === 'hp' ? v0 - k * v1 - v2 : v0 - k * v1;
  }
  return x;
}
export function drive(x: Float32Array, k: number): Float32Array {
  const n = Math.tanh(k);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k) / n;
  return x;
}
export function amp(x: Float32Array, env: Fn, sr = SR): Float32Array {
  for (let i = 0; i < x.length; i++) x[i] *= val(env, i / sr);
  return x;
}
export function norm(x: Float32Array, peak = 0.9): Float32Array {
  let m = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; }
  if (m > 1e-9) { const k = peak / m; for (let i = 0; i < x.length; i++) x[i] *= k; }
  return x;
}
export function fade(x: Float32Array, fin: number, fout: number, sr = SR): Float32Array {
  const a = Math.floor(fin * sr), b = Math.floor(fout * sr), n = x.length;
  for (let i = 0; i < a && i < n; i++) x[i] *= i / a;
  for (let i = 0; i < b && i < n; i++) x[n - 1 - i] *= i / b;
  return x;
}
export function reverse(x: Float32Array): Float32Array { return x.reverse(); }

// ---------------------------------------------------------------- voices
export const VOWELS: Record<string, [number, number, number]> = {
  a: [800, 1150, 2900], e: [400, 1600, 2700], i: [350, 1900, 2800], o: [450, 800, 2830], u: [325, 700, 2530],
};
/** Formant-filtered buzz: groans, roars, shrieks. `shift` scales formants (smaller = bigger creature).
 *  Synthesized at <= 22.05 kHz (formants live well below that) and upsampled. */
export function voice(dur: number, f0: Fn, from: string, to: string, env: Fn, rng: Rand, o: { shift?: number; vib?: [number, number]; rough?: number; breath?: number; drive?: number; sr?: number; q?: number } = {}): Float32Array {
  const osr = o.sr ?? SR, sr = Math.min(osr, 22050), n = Math.ceil(dur * sr);
  const A = VOWELS[from], B = VOWELS[to], sh = o.shift ?? 1;
  const rough = o.rough ?? 0.1;
  const jit = wander(rng, dur, 18, -1, 1);
  const src = osc(dur, 'saw', (t) => val(f0, t) * (1 + rough * 0.08 * jit(t)), 1, { sr, vib: o.vib, vibDelay: 0.15 });
  if (rough > 0.2) { const r2 = osc(dur, 'sqr', (t) => val(f0, t) * 0.5 * (1 + 0.1 * jit(t * 1.3)), 1, { sr, pw: 0.3 }); for (let i = 0; i < n; i++) src[i] += r2[i] * (rough - 0.2); }
  if (o.breath) { const nz = noise(dur, rng, o.breath, 'white', sr); for (let i = 0; i < n; i++) src[i] += nz[i]; }
  const out = new Float32Array(n);
  const q = o.q ?? 6;
  const gains = [1, 0.55, 0.22];
  for (let f = 0; f < 3; f++) {
    const c = src.slice();
    const a = A[f] * sh, b = B[f] * sh;
    svf(c, 'bp', a === b ? a : (t) => a + (b - a) * Math.min(1, t / dur), q + f * 2, sr);
    for (let i = 0; i < n; i++) out[i] += c[i] * gains[f];
  }
  amp(out, env, sr);
  if (o.drive) drive(norm(out, 1), o.drive);
  return norm(sr === osr ? out : upsample(out, osr / sr), 1);
}

/** Linear-interpolation resampler by factor k (> 1 = more samples). */
export function upsample(x: Float32Array, k: number): Float32Array {
  const n = Math.floor(x.length * k), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = i / k, j = Math.floor(p), fr = p - j; out[i] = x[j] + ((j + 1 < x.length ? x[j + 1] : 0) - x[j]) * fr; }
  return out;
}

// ---------------------------------------------------------------- wavetables (cheap sustained tones)
const TN = 2048;
/** One period built from harmonic amplitudes (index 0 = fundamental). */
export function table(harm: number[], rng?: Rand): Float32Array {
  const t = new Float32Array(TN + 1);
  for (let k = 0; k < harm.length; k++) {
    const a = harm[k];
    if (Math.abs(a) < 1e-4) continue;
    const ph = rng ? rng.next() * TAU : 0, w = (TAU * (k + 1)) / TN;
    for (let i = 0; i < TN; i++) t[i] += a * Math.sin(w * i + ph);
  }
  t[TN] = t[0];
  return norm(t, 1);
}
/** Plays a wavetable into `out` (added), with detune, vibrato and a slow optional table crossfade. */
export function tableOsc(out: Float32Array, tab: Float32Array, f: number, gain: number, o: { sr?: number; vib?: [number, number]; vibDelay?: number; phase?: number; tab2?: Float32Array; morph?: number } = {}): Float32Array {
  const sr = o.sr ?? SR, n = out.length, base = (f * TN) / sr;
  let p = (o.phase ?? 0) * TN;
  const vr = o.vib ? (TAU * o.vib[0]) / sr : 0, vd = o.vib ? o.vib[1] : 0, vdel = (o.vibDelay ?? 0) * sr;
  const t2 = o.tab2, mr = o.morph ? (TAU * o.morph) / sr : 0;
  let inc = base, m = 0;
  for (let i = 0; i < n; i++) {
    if ((i & 31) === 0) {
      // modulators are updated every 32 samples: plenty for vibrato and slow timbre drift
      inc = vd ? base * (1 + vd * Math.sin(vr * i) * (i < vdel ? i / vdel : 1)) : base;
      if (t2) m = 0.5 + 0.5 * Math.sin(mr * i);
    }
    const j = p | 0, fr = p - j;
    let v = tab[j] + (tab[j + 1] - tab[j]) * fr;
    if (t2) v += (t2[j] + (t2[j + 1] - t2[j]) * fr - v) * m;
    out[i] += v * gain;
    p += inc;
    if (p >= TN) p -= TN;
  }
  return out;
}
/** Harmonic amplitudes of a buzz source shaped by vowel formants (choirs). */
export function vowelHarmonics(f: number, vowel: string, maxHz: number, bw = 1.4): number[] {
  const F = VOWELS[vowel], G = [1, 0.5, 0.25], W = [100, 120, 180];
  const out: number[] = [];
  for (let k = 1; k * f < maxHz; k++) {
    const hz = k * f;
    let a = 0;
    for (let i = 0; i < 3; i++) { const x = (hz - F[i]) / ((W[i] * bw) / 2); a += G[i] / (1 + x * x); }
    out.push(a / Math.sqrt(k));
  }
  return out;
}
/** Harmonic amplitudes of a sawtooth through a gentle low-pass at `fc`. */
export function sawHarmonics(f: number, fc: number, maxHz: number): number[] {
  const out: number[] = [];
  for (let k = 1; k * f < maxHz; k++) { const r = (k * f) / fc; out.push(1 / k / Math.sqrt(1 + r * r * r * r)); }
  return out;
}
/** A small choir section singing one sustained vowel. */
export function choirNote(dur: number, f: number, vowel: string, rng: Rand, sr = 16000, voices = 3): Float32Array {
  const n = Math.ceil(dur * sr), out = new Float32Array(n);
  const top = Math.min(sr * 0.45, 4200);
  const tab = table(vowelHarmonics(f, vowel, top), rng);
  const tab2 = table(vowelHarmonics(f, vowel === 'a' ? 'o' : 'u', top), rng);
  for (let v = 0; v < voices; v++) {
    const det = (v - (voices - 1) / 2) * 0.0065 + rng.range(-0.002, 0.002);
    tableOsc(out, tab, f * (1 + det), 1 / voices, { sr, vib: [4.5 + rng.next() * 1.2, 0.011], vibDelay: 0.5, phase: rng.next(), tab2, morph: 0.07 + rng.next() * 0.08 });
  }
  const br = svf(noise(dur, rng, 0.05, 'white', sr), 'bp', VOWELS[vowel][1], 2, sr);
  for (let i = 0; i < n; i++) out[i] += br[i];
  return out;
}
