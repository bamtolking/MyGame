// Offline DSP toolkit: renders instrument samples and sound effects into Float32 buffers (pure TS, runs in Node for tests).
export const SR = 44100;
export interface Sample { l: Float32Array; r: Float32Array }
export const mk = (sec: number): Sample => { const n = Math.max(1, Math.ceil(sec * SR)); return { l: new Float32Array(n), r: new Float32Array(n) }; };
export const TAU = Math.PI * 2;

export class Rand {
  s: number; constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next(): number { let t = (this.s = (this.s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  bi(): number { return this.next() * 2 - 1; }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
}

/** RBJ biquad, direct form I. Coefficients can be changed per sample (for sweeps). */
export class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0; x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  constructor(type?: 'lp' | 'hp' | 'bp' | 'peak', f = 1000, q = 0.707, gainDb = 0) { if (type) this.set(type, f, q, gainDb); }
  set(type: 'lp' | 'hp' | 'bp' | 'peak', f: number, q = 0.707, gainDb = 0): this {
    const w = (TAU * Math.min(Math.max(f, 10), SR * 0.45)) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Math.max(q, 0.05));
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { const A = Math.pow(10, gainDb / 40); b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
  }
}
export class OnePole { y = 0; k: number; constructor(f: number) { this.k = 1 - Math.exp((-TAU * f) / SR); } set(f: number) { this.k = 1 - Math.exp((-TAU * f) / SR); } run(x: number) { return (this.y += (x - this.y) * this.k); } }

/** Pink noise (Paul Kellet). */
export class Pink { b0 = 0; b1 = 0; b2 = 0; b3 = 0; b4 = 0; b5 = 0; b6 = 0; r: Rand; constructor(seed = 7) { this.r = new Rand(seed); }
  next(): number { const w = this.r.bi(); this.b0 = 0.99886 * this.b0 + w * 0.0555179; this.b1 = 0.99332 * this.b1 + w * 0.0750759; this.b2 = 0.969 * this.b2 + w * 0.153852; this.b3 = 0.8665 * this.b3 + w * 0.3104856; this.b4 = 0.55 * this.b4 + w * 0.5329522; this.b5 = -0.7616 * this.b5 - w * 0.016898; const o = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + w * 0.5362; this.b6 = w * 0.115926; return o * 0.11; } }

// ---------- envelopes ----------
export const ad = (t: number, a: number, d: number): number => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d));
export const swell = (t: number, dur: number, shape = 1.5): number => (t < 0 || t >= dur ? 0 : Math.pow(Math.max(0, Math.sin((Math.PI * t) / dur)), shape));
const panL = (p: number) => Math.cos(((p + 1) * Math.PI) / 4), panR = (p: number) => Math.sin(((p + 1) * Math.PI) / 4);

/** Adds a mono voice rendered by fn(t) into s, starting at t0 seconds, with constant or time-varying pan. */
export function voice(s: Sample, t0: number, dur: number, fn: (t: number) => number, gain = 1, pan: number | ((t: number) => number) = 0): void {
  const i0 = Math.floor(t0 * SR), n = Math.min(s.l.length - i0, Math.ceil(dur * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR; const v = fn(t) * gain; const p = typeof pan === 'number' ? pan : pan(t);
    s.l[i0 + i] += v * panL(p); s.r[i0 + i] += v * panR(p);
  }
}
export function addMono(s: Sample, t0: number, src: Float32Array, gain = 1, pan = 0): void {
  const i0 = Math.floor(t0 * SR), n = Math.min(src.length, s.l.length - i0), gl = gain * panL(pan), gr = gain * panR(pan);
  for (let i = 0; i < n; i++) { s.l[i0 + i] += src[i] * gl; s.r[i0 + i] += src[i] * gr; }
}

// ---------- building blocks ----------
/** Band-passed noise whoosh with an exponential centre-frequency sweep. */
export function whoosh(s: Sample, t0: number, dur: number, f0: number, f1: number, q: number, amp: number, pan0 = 0, pan1 = 0, seed = 1): void {
  const r = new Rand(seed), bp = new Biquad(), bp2 = new Biquad(); let k = 0;
  voice(s, t0, dur, (t) => { if ((k++ & 15) === 0) { const f = f0 * Math.pow(f1 / f0, t / dur); bp.set('bp', f, q); bp2.set('bp', f * 1.5, q * 1.3); } const n = r.bi(); return (bp.run(n) + 0.5 * bp2.run(n)) * swell(t, dur, 1.2) * 3; }, amp, (t) => pan0 + (pan1 - pan0) * (t / dur));
}
/** Pitch-dropping sine membrane hit (kick / body thump). */
export function thump(s: Sample, t0: number, f0: number, f1: number, pitchDecay: number, decay: number, amp: number, drive = 1.5): void {
  let ph = 0; const dur = decay * 7;
  voice(s, t0, dur, (t) => { const f = f1 + (f0 - f1) * Math.exp(-t / pitchDecay); ph += (TAU * f) / SR; return Math.tanh(Math.sin(ph) * ad(t, 0.002, decay) * drive) / Math.tanh(drive); }, amp);
}
/** Filtered noise burst. */
export function burst(s: Sample, t0: number, dur: number, type: 'lp' | 'hp' | 'bp', f: number, q: number, amp: number, decay = dur / 4, seed = 3, pan = 0, fEnd = f): void {
  const r = new Rand(seed), b = new Biquad(type, f, q); let k = 0;
  voice(s, t0, dur, (t) => { if (fEnd !== f && (k++ & 15) === 0) b.set(type, f * Math.pow(fEnd / f, t / dur), q); return b.run(r.bi()) * ad(t, 0.001, decay); }, amp, pan);
}
/** Inharmonic partial cluster (bells, gongs, blades). Phasor recursion + multiplicative decay: cheap enough for big gongs. */
export function partials(s: Sample, t0: number, base: number, ratios: number[], amps: number[], decays: number[], amp: number, o: { attack?: number; beat?: number; glide?: number; pan?: number } = {}): void {
  const i0 = Math.floor(t0 * SR); if (i0 >= s.l.length) return; const beat = o.beat ?? 0, glide = o.glide ?? 0; const p = o.pan ?? 0; const gl = panL(p), gr = panR(p);
  const norm = amp / (beat ? 2 : 1);
  for (let k = 0; k < ratios.length; k++) {
    const f = base * ratios[k]; if (f >= SR * 0.45) continue;
    const att = Math.max(1, Math.floor((o.attack ?? 0.002) * (1 + k * 0.5) * SR)); const d = decays[k]; const n = Math.min(s.l.length - i0, att + Math.ceil(d * 7 * SR));
    const dec = Math.exp(-1 / (d * SR)); let env = 1; let ph1 = Math.random() * TAU, ph2 = Math.random() * TAU; const a = amps[k] * norm;
    const glideDec = Math.exp(-1 / (0.6 * SR)); let g = glide;
    let c1 = Math.cos(ph1), s1 = Math.sin(ph1), c2 = Math.cos(ph2), s2 = Math.sin(ph2);
    let w1 = (TAU * f) / SR, w2 = (TAU * (f + beat)) / SR; let cw1 = Math.cos(w1), sw1 = Math.sin(w1), cw2 = Math.cos(w2), sw2 = Math.sin(w2);
    for (let i = 0; i < n; i++) {
      if (glide && (i & 63) === 0) { g *= Math.pow(glideDec, 64); const m = 1 + g; w1 = (TAU * f * m) / SR; w2 = (TAU * (f + beat) * m) / SR; cw1 = Math.cos(w1); sw1 = Math.sin(w1); cw2 = Math.cos(w2); sw2 = Math.sin(w2); }
      let v = s1; const nc1 = c1 * cw1 - s1 * sw1; s1 = s1 * cw1 + c1 * sw1; c1 = nc1;
      if (beat) { v += s2; const nc2 = c2 * cw2 - s2 * sw2; s2 = s2 * cw2 + c2 * sw2; c2 = nc2; }
      const e = i < att ? i / att : (env *= dec); v *= e * a; s.l[i0 + i] += v * gl; s.r[i0 + i] += v * gr;
    }
  }
}
/** Random crackle impulses (fire, debris). */
export function crackle(s: Sample, t0: number, dur: number, rate: number, amp: number, seed = 5, f = 3000): void {
  const r = new Rand(seed), b = new Biquad('bp', f, 1.5); let hold = 0;
  voice(s, t0, dur, (t) => { if (r.next() < rate / SR) hold = r.range(0.4, 1); hold *= 0.985; return b.run(r.bi() * hold) * (1 - t / dur); }, amp, 0);
}
/** Karplus-Strong plucked string (Jaffe-Smith extended: fractional tuning, brightness, pluck position). */
export function pluck(freq: number, sec: number, o: { bright?: number; decay?: number; pos?: number; seed?: number; body?: boolean } = {}): Float32Array {
  const n = Math.ceil(sec * SR), out = new Float32Array(n); const period = SR / freq;
  const S = 0.5 - (o.bright ?? 0.5) * 0.45; // loop filter stretch: lower = brighter
  let L = Math.max(2, Math.floor(period - S)); let d = period - L - S; if (d < 0.1 && L > 2) { L--; d += 1; } const C = (1 - d) / (1 + d);
  const g = Math.pow(10, -3 / ((o.decay ?? 2) * freq)); const buf = new Float32Array(L); const r = new Rand(o.seed ?? 11);
  const exc = new OnePole(freq * (2 + (o.bright ?? 0.5) * 10)); const P = Math.max(1, Math.floor((o.pos ?? 0.18) * L));
  const tmp = new Float32Array(L); for (let i = 0; i < L; i++) tmp[i] = exc.run(r.bi());
  for (let i = 0; i < L; i++) buf[i] = tmp[i] - 0.9 * tmp[(i + L - P) % L];
  let idx = 0, prev = 0, apx = 0, apy = 0;
  for (let i = 0; i < n; i++) {
    const x = buf[idx]; const lp = (1 - S) * x + S * prev; prev = x; const ap = C * lp + apx - C * apy; apx = lp; apy = ap;
    buf[idx] = ap * g; out[i] = x; idx = idx + 1 === L ? 0 : idx + 1;
  }
  if (o.body !== false) { const b1 = new Biquad('peak', 230, 1.2, 5), b2 = new Biquad('peak', 720, 2, 3), hp = new Biquad('hp', 60, 0.7); for (let i = 0; i < n; i++) out[i] = hp.run(b2.run(b1.run(out[i]))); }
  const fo = Math.min(n, Math.floor(0.03 * SR)); for (let i = 0; i < fo; i++) out[n - 1 - i] *= i / fo;
  return out;
}
/** PolyBLEP sawtooth oscillator (band-limited enough for SFX/bass, ~50x cheaper than additive). */
export class Saw { ph = 0; next(f: number): number { const dt = Math.min(0.49, f / SR); this.ph += dt; if (this.ph >= 1) this.ph -= 1; const t = this.ph; let v = 2 * t - 1;
  if (t < dt) { const x = t / dt; v -= x + x - x * x - 1; } else if (t > 1 - dt) { const x = (t - 1) / dt; v -= x * x + x + x + 1; } return v * 0.6; } }
// ---------- post ----------
export function drive(s: Sample, amount: number): void { const k = Math.tanh(amount); for (const ch of [s.l, s.r]) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * amount) / k; }
export function normalize(s: Sample, peak: number): void {
  let m = 1e-9; for (const ch of [s.l, s.r]) for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > m) m = a; }
  const g = peak / m; for (const ch of [s.l, s.r]) for (let i = 0; i < ch.length; i++) ch[i] *= g;
}
export function fadeTail(s: Sample, sec = 0.02): void { const n = s.l.length, f = Math.min(n, Math.floor(sec * SR)); for (let i = 0; i < f; i++) { const g = i / f; s.l[n - 1 - i] *= g; s.r[n - 1 - i] *= g; } }
export function trimSilence(s: Sample, thresh = 0.0006): Sample {
  let end = s.l.length; while (end > 1 && Math.abs(s.l[end - 1]) < thresh && Math.abs(s.r[end - 1]) < thresh) end--;
  end = Math.min(s.l.length, end + Math.floor(0.01 * SR)); return { l: s.l.slice(0, end), r: s.r.slice(0, end) };
}
/** Stereo reverb impulse: early reflections + frequency-damped exponential tail. */
export function reverbIR(sec: number, rt60: number, damp0 = 9000, damp1 = 1800, seed = 21): Sample {
  const s = mk(sec); const rl = new Rand(seed), rr = new Rand(seed + 1); const fl = new OnePole(damp0), fr = new OnePole(damp0);
  const n = s.l.length;
  for (let i = 0; i < n; i++) {
    const t = i / SR; if (i % 64 === 0) { const f = damp0 * Math.pow(damp1 / damp0, Math.min(1, t / rt60)); fl.set(f); fr.set(f); }
    const env = Math.exp((-6.9 * t) / rt60) * Math.min(1, t / 0.012);
    s.l[i] = fl.run(rl.bi()) * env; s.r[i] = fr.run(rr.bi()) * env;
  }
  for (const [dt, g, p] of [[0.011, 0.6, -0.6], [0.017, 0.5, 0.5], [0.023, 0.45, -0.2], [0.031, 0.35, 0.7], [0.041, 0.3, -0.8], [0.053, 0.25, 0.3]]) { const i = Math.floor(dt * SR); s.l[i] += g * panL(p); s.r[i] += g * panR(p); }
  normalize(s, 0.5); return s;
}
export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
