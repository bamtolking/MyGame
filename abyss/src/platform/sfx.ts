// Sound-effect recipes. Each recipe layers transients, bodies and tails into one buffer; several seeded
// variants are rendered per sound so rapid repeats (hits, swings) never sound machine-gunned.
import { Rand, SR, amp, bell, buf, choirNote, crackle, drive, fade, glide, lay, lin, mix, noise, norm, osc, perc, pluck, reverse, ring, svf, swell, upsample, voice, wander, type Fn } from './dsp';

export type Recipe = (r: Rand) => Float32Array;
export interface SfxMeta { v: number; g: number; pj: number; cd: number; verb: number; max: number }
const M = (g: number, o: Partial<SfxMeta> = {}): SfxMeta => ({ v: 1, g, pj: 0.03, cd: 30, verb: 0.15, max: 3, ...o });
const COMBAT = { v: 4, pj: 0.07, cd: 22, max: 4 };

// ---------------------------------------------------------------- building blocks
const click = (r: Rand, d = 0.006, hp = 2500): Float32Array => svf(noise(d, r, perc(0.0003, d)), 'hp', hp);
const thud = (f0: number, f1: number, d: number, k = 1.5): Float32Array => drive(osc(d, 'sin', glide(f0, f1, d * 0.5), perc(0.002, d)), k);
const band = (r: Rand, d: number, f: Fn, q: number, env: Fn, color: 'white' | 'pink' | 'brown' = 'white'): Float32Array => svf(noise(d, r, env, color), 'bp', f, q);
const low = (r: Rand, d: number, f: Fn, env: Fn, color: 'white' | 'pink' | 'brown' = 'white'): Float32Array => svf(noise(d, r, env, color), 'lp', f, 0.8);
const high = (r: Rand, d: number, f: Fn, env: Fn): Float32Array => svf(noise(d, r, env), 'hp', f, 0.8);
function whoosh(r: Rand, d: number, f0: number, f1: number, q = 1.2): Float32Array {
  const bend = r.range(0.9, 1.1);
  return band(r, d, (t) => f0 * Math.pow((f1 * bend) / f0, Math.sin(Math.PI * Math.min(1, t / d))), q, (t) => Math.sin(Math.PI * Math.min(1, (t / d) ** 0.75)) ** 2, 'pink');
}
function squelch(r: Rand, d: number): Float32Array {
  const cut = wander(r, d, 40, 250, 1800);
  const b = svf(noise(d, r, perc(0.004, d), 'pink'), 'lp', cut, 3);
  return drive(norm(b, 1), 2);
}
function boom(r: Rand, d: number, f0 = 80): Float32Array {
  return lay(d,
    [drive(osc(d, 'sin', glide(f0, 26, d * 0.7), perc(0.004, d)), 1.8), 0, 1],
    [low(r, d, (t) => 1400 * Math.exp(-t * 7) + 110, perc(0.002, d * 0.8), 'brown'), 0, 0.9]);
}
function debris(r: Rand, d: number, n: number, lo = 900, hi = 4000): Float32Array {
  const b = buf(d);
  for (let i = 0; i < n; i++) { const t = d * Math.pow(r.next(), 1.6) * 0.9; const dd = r.range(0.01, 0.04); mix(b, band(r, dd, r.range(lo, hi), 3, perc(0.0005, dd)), t, r.range(0.3, 1) * (1 - t / d)); }
  return b;
}
function sparkle(r: Rand, d: number, n: number, lo: number, hi: number, dec = 0.25): Float32Array {
  const b = buf(d);
  for (let i = 0; i < n; i++) { const t = d * 0.8 * Math.pow(r.next(), 1.3); const f = r.range(lo, hi); const dd = r.range(dec * 0.3, dec); mix(b, ring(dd, [[f, 1, dd], [f * 2.02, 0.25, dd * 0.5]]), t, r.range(0.3, 1) * (1 - (t / d) * 0.7)); }
  return b;
}
function zap(r: Rand, d: number): Float32Array {
  const gate = wander(r, d, 70, -0.6, 1);
  const buzz = osc(d, 'saw', wander(r, d, 30, 55, 140), (t) => Math.max(0, gate(t)) * perc(0.002, d)(t));
  const hiss = high(r, d, 2500, (t) => Math.max(0, gate(t * 1.3)) * perc(0.001, d)(t));
  return drive(norm(lay(d, [svf(buzz, 'hp', 300), 0, 0.8], [hiss, 0, 0.6], [crackle(d, r, 160, perc(0.001, d)), 0, 0.7]), 1), 3);
}
function fireRoar(r: Rand, d: number, env: Fn, lo = 250, hi = 1300): Float32Array {
  return lay(d,
    [band(r, d, wander(r, d, 6, lo, hi), 0.7, env, 'pink'), 0, 1],
    [low(r, d, 380, env, 'brown'), 0, 0.8],
    [crackle(d, r, 55, env), 0, 0.35]);
}
function metal(r: Rand, d: number, f: number, dec = 0.5): Float32Array {
  const j = () => r.range(0.97, 1.03);
  return ring(d, [[f * j(), 1, dec], [f * 2.63 * j(), 0.7, dec * 0.7], [f * 4.2 * j(), 0.5, dec * 0.45], [f * 6.1 * j(), 0.3, dec * 0.3], [f * 8.7 * j(), 0.15, dec * 0.2]]);
}
function twang(r: Rand, f: number): Float32Array {
  return lay(0.45,
    [pluck(f * r.range(0.97, 1.03), 0.4, r, { bright: 0.95, decay: 0.35 }), 0, 0.55],
    [click(r, 0.004, 1800), 0, 0.7],
    [whoosh(r, 0.16, 1400, 5200, 2), 0.012, 0.5],
    [thud(320, 140, 0.035), 0, 0.3]);
}
const env3 = (a: number, s: number, d: number, sus = 0.8): Fn => lin(0, 0, a, 1, s, sus, d, 0);
function growl(r: Rand, d: number, f0: number, f1: number, from: string, to: string, o: Parameters<typeof voice>[6] = {}): Float32Array {
  return voice(d, glide(f0 * r.range(0.93, 1.07), f1, d * 0.9), from, to, env3(0.03, d * 0.55, d), r, o);
}
function chord(r: Rand, d: number, freqs: number[], vowel = 'a', gain = 0.4): Float32Array {
  const c = buf(d, 16000);
  for (const f of freqs) mix(c, choirNote(d, f, vowel, r, 16000, 2), 0, gain, 16000);
  return amp(upsample(c, SR / 16000), swell(d * 0.3, d * 0.7));
}
function bones(r: Rand, d: number, n: number): Float32Array {
  const b = buf(d);
  let t = 0;
  for (let i = 0; i < n && t < d - 0.05; i++) {
    const f = r.range(900, 2600);
    mix(b, lay(0.08, [band(r, 0.03, f * 1.6, 5, perc(0.0005, 0.03)), 0, 1], [ring(0.07, [[f, 0.6, 0.06], [f * 2.3, 0.3, 0.03]]), 0, 0.6]), t, r.range(0.4, 1) * (1 - (t / d) * 0.6));
    t += r.range(0.015, 0.06) * (1 + i * 0.08);
  }
  mix(b, thud(160, 70, 0.1), 0, 0.5);
  return b;
}

// ---------------------------------------------------------------- flesh / impact
function hitBody(r: Rand, heavy: number): Float32Array {
  const d = 0.3 + heavy * 0.35;
  return lay(d,
    [click(r, 0.006, 3000), 0, 0.55],
    [thud(r.range(150, 185) - heavy * 40, 42, 0.13 + heavy * 0.14, 2 + heavy * 1.5), 0, 1],
    [band(r, 0.07 + heavy * 0.04, r.range(900, 1500), 1.1, perc(0.001, 0.07 + heavy * 0.04)), 0.002, 0.55 + heavy * 0.2],
    [squelch(r, 0.13 + heavy * 0.12), 0.006, 0.4 + heavy * 0.2],
    [low(r, d, 420, perc(0.003, d * 0.8), 'brown'), 0, 0.45 + heavy * 0.4],
    [heavy > 0 ? debris(r, 0.15, 4, 1500, 4200) : buf(0.01), 0.004, 0.5]);
}

const RECIPES: Record<string, [Recipe, SfxMeta]> = {
  // ---- hero melee
  swing: [(r) => lay(0.32, [whoosh(r, 0.24, 320, 2700, 1.3), 0, 1], [ring(0.3, [[r.range(3100, 3500), 0.05, 0.25], [r.range(5000, 5600), 0.03, 0.16]]), 0.07, 1]), M(0.42, { ...COMBAT, cd: 40 })],
  swingHeavy: [(r) => lay(0.45, [whoosh(r, 0.36, 180, 1700, 1), 0, 1], [low(r, 0.4, 260, swell(0.2, 0.2), 'brown'), 0, 0.6]), M(0.5, { ...COMBAT, cd: 40 })],
  cleave: [(r) => lay(0.7, [whoosh(r, 0.5, 220, 2300, 1), 0, 1], [whoosh(r, 0.36, 420, 3200, 1.4), 0.13, 0.7], [ring(0.5, [[3300, 0.05, 0.4], [4900, 0.04, 0.3]]), 0.2, 1]), M(0.55, { cd: 60 })],
  hit: [(r) => hitBody(r, 0), M(0.62, COMBAT)],
  hitHeavy: [(r) => hitBody(r, 1), M(0.78, COMBAT)],
  crit: [(r) => lay(1.0,
    [ring(0.8, [[r.range(2350, 2650), 0.35, 0.55], [3900, 0.22, 0.42], [5250, 0.16, 0.3], [7300, 0.08, 0.2]]), 0, 0.55],
    [drive(osc(0.55, 'sin', glide(95, 28, 0.45), perc(0.002, 0.55)), 2), 0, 0.9],
    [high(r, 0.2, 4200, perc(0.001, 0.2)), 0, 0.35],
    [reverse(low(r, 0.12, 2000, swell(0.1, 0.02))), 0, 0.2]), M(0.6, { v: 3, cd: 60, verb: 0.3 })],
  hitArrow: [(r) => lay(0.28, [click(r, 0.004, 2800), 0, 0.7], [band(r, 0.03, r.range(1900, 2500), 2, perc(0.0005, 0.03)), 0, 0.7], [thud(r.range(210, 250), 90, 0.08, 1.6), 0, 0.8], [squelch(r, 0.09), 0.004, 0.35]), M(0.7, COMBAT)],
  hitMagic: [(r) => lay(0.4, [osc(0.12, 'sin', glide(r.range(1300, 1600), 180, 0.08), perc(0.001, 0.12)), 0, 0.6], [click(r, 0.005, 2000), 0, 0.6], [thud(130, 50, 0.14, 2), 0, 0.8], [sparkle(r, 0.3, 5, 2500, 6000, 0.12), 0.01, 0.35]), M(0.7, COMBAT)],
  hitFire: [(r) => lay(0.55, [thud(r.range(140, 170), 50, 0.14, 2), 0, 0.8], [band(r, 0.4, lin(0, 300, 0.08, 1500, 0.4, 400), 0.8, swell(0.03, 0.35), 'pink'), 0, 0.8], [high(r, 0.45, 3200, perc(0.01, 0.4)), 0, 0.25], [crackle(0.45, r, 70, perc(0.01, 0.4)), 0.02, 0.5]), M(0.55, COMBAT)],
  hitCold: [(r) => lay(0.55, [thud(r.range(190, 220), 70, 0.1, 2), 0, 0.7], [drive(click(r, 0.01, 1400), 4), 0, 0.6], [ring(0.4, [[r.range(2000, 2300), 0.5, 0.25], [r.range(3100, 3400), 0.4, 0.18], [r.range(4600, 5000), 0.3, 0.12], [6300, 0.2, 0.08]]), 0.003, 0.45], [high(r, 0.08, 3500, perc(0.001, 0.08)), 0, 0.4], [sparkle(r, 0.4, 6, 4000, 9000, 0.1), 0.02, 0.3]), M(0.85, COMBAT)],
  hitLight: [(r) => lay(0.35, [zap(r, 0.2), 0, 0.75], [click(r, 0.005, 3000), 0, 0.6], [thud(170, 60, 0.1), 0, 0.5]), M(0.8, COMBAT)],
  hitPoison: [(r) => { const b = lay(0.45, [squelch(r, 0.22), 0, 0.8], [thud(150, 60, 0.1), 0, 0.5]); for (let i = 0; i < 4; i++) mix(b, osc(0.05, 'sin', glide(r.range(250, 400), r.range(650, 900), 0.04), perc(0.004, 0.05)), 0.05 + i * r.range(0.04, 0.08), 0.35); return b; }, M(0.7, COMBAT)],
  block: [(r) => lay(0.9, [metal(r, 0.85, r.range(380, 430), 0.6), 0, 0.55], [click(r, 0.006, 2500), 0, 0.8], [thud(230, 120, 0.08, 2), 0, 0.6], [high(r, 0.06, 4000, perc(0.001, 0.06)), 0, 0.4]), M(0.8, { v: 3, cd: 50, verb: 0.3 })],
  evade: [(r) => whoosh(r, 0.18, 900, 3800, 1.5), M(0.35, { v: 2 })],
  // ---- kills
  gib: [(r) => { const b = lay(0.9, [thud(95, 32, 0.32, 3), 0, 0.9], [low(r, 0.3, lin(0, 2400, 0.25, 250), perc(0.002, 0.25), 'pink'), 0, 0.9]); for (let i = 0; i < 4; i++) mix(b, squelch(r, r.range(0.08, 0.18)), r.range(0, 0.25), 0.55); for (let i = 0; i < 3; i++) mix(b, drive(click(r, 0.008, 1600), 4), r.range(0, 0.08), 0.4); for (let i = 0; i < 4; i++) mix(b, osc(0.04, 'sin', glide(r.range(300, 500), 900, 0.03), perc(0.003, 0.04)), r.range(0.3, 0.8), 0.18); return b; }, M(0.72, { v: 3, cd: 40, max: 3 })],
  shatter: [(r) => lay(1.0, [drive(high(r, 0.05, 1500, perc(0.0005, 0.05)), 3), 0, 0.8], [sparkle(r, 0.8, 26, 2600, 8500, 0.28), 0, 0.8], [high(r, 0.5, 6000, perc(0.002, 0.45)), 0, 0.2], [thud(140, 60, 0.1), 0, 0.5]), M(0.62, { v: 3, cd: 40, verb: 0.3 })],
  burnDie: [(r) => lay(1.1, [fireRoar(r, 1.0, swell(0.12, 0.85), 300, 1600), 0, 1], [crackle(1.0, r, 90, perc(0.05, 0.9)), 0, 0.5], [thud(110, 45, 0.25, 2), 0, 0.5]), M(0.55, { v: 3, cd: 50 })],
  eliteKill: [(r) => lay(2.2, [boom(r, 1.6, 70), 0, 0.9], [metal(r, 1.6, 520, 1.3), 0, 0.2], [bell(660, 2), 0.02, 0.25], [bell(990, 1.8), 0.05, 0.15], [sparkle(r, 1.4, 14, 3000, 8000, 0.4), 0.05, 0.4]), M(0.75, { cd: 150, verb: 0.5 })],
  // ---- monster voices
  die_zombie: [(r) => lay(1.0, [growl(r, 0.9, 95, 58, 'o', 'u', { shift: 0.8, rough: 0.35, drive: 2, breath: 0.15 }), 0, 1], [thud(110, 45, 0.2), 0.5, 0.5]), M(0.5, { v: 3, cd: 60 })],
  die_ghoul: [(r) => growl(r, 0.7, 150, 80, 'a', 'o', { shift: 0.85, rough: 0.4, drive: 2.5, breath: 0.2 }), M(0.4, { v: 3, cd: 60 })],
  die_skeleton: [(r) => bones(r, 0.8, 16), M(0.8, { v: 3, cd: 50 })],
  die_skelArcher: [(r) => bones(r, 0.8, 14), M(0.8, { v: 3, cd: 50 })],
  die_skelMage: [(r) => lay(1.0, [bones(r, 0.8, 12), 0, 1], [growl(r, 0.6, 300, 150, 'o', 'u', { vib: [7, 0.05] }), 0, 0.25]), M(0.55, { v: 2, cd: 50, verb: 0.4 })],
  die_ordes: [(r) => lay(2.0, [bones(r, 1.4, 30), 0, 0.9], [growl(r, 1.6, 70, 40, 'a', 'u', { shift: 0.65, rough: 0.5, drive: 3 }), 0, 0.8]), M(0.8, { cd: 200, verb: 0.5 })],
  die_fallen: [(r) => growl(r, 0.4, 460, 260, 'i', 'a', { vib: [10, 0.05], shift: 1.2 }), M(0.42, { v: 4, cd: 60 })],
  die_shaman: [(r) => growl(r, 0.6, 380, 190, 'e', 'o', { vib: [8, 0.06], shift: 1.1 }), M(0.45, { v: 3, cd: 60 })],
  die_bat: [(r) => { const b = buf(0.3); for (let i = 0; i < 3; i++) mix(b, osc(0.05, 'sin', glide(r.range(3400, 3800), 2100, 0.04), perc(0.003, 0.05)), i * 0.06, 1 - i * 0.2); return b; }, M(0.3, { v: 3, cd: 50 })],
  die_spider: [(r) => { const b = lay(0.5, [high(r, 0.35, 3200, perc(0.01, 0.35)), 0, 0.6], [squelch(r, 0.15), 0, 0.5]); for (let i = 0; i < 8; i++) mix(b, click(r, 0.004, 2000), i * 0.025 + r.range(0, 0.01), 0.5); return b; }, M(0.45, { v: 3, cd: 50 })],
  die_wraith: [(r) => lay(1.6, [growl(r, 1.3, 520, 250, 'o', 'u', { vib: [5, 0.05], rough: 0.02, breath: 0.2 }), 0, 0.8], [osc(1.2, 'sin', glide(1040, 400, 1.1), perc(0.1, 1.1)), 0, 0.15], [sparkle(r, 1.2, 8, 3000, 6000, 0.3), 0.1, 0.2]), M(0.45, { v: 2, cd: 80, verb: 0.8 })],
  die_brute: [(r) => lay(1.0, [growl(r, 0.9, 80, 50, 'a', 'o', { shift: 0.7, rough: 0.5, drive: 3 }), 0, 1], [thud(90, 35, 0.3, 2), 0.35, 0.7]), M(0.6, { v: 3, cd: 60 })],
  die_troll: [(r) => lay(1.1, [growl(r, 1.0, 75, 45, 'a', 'o', { shift: 0.68, rough: 0.55, drive: 3 }), 0, 1], [thud(80, 32, 0.35, 2), 0.4, 0.8]), M(0.6, { v: 3, cd: 60 })],
  die_gromak: [(r) => lay(2.2, [growl(r, 1.8, 70, 36, 'a', 'u', { shift: 0.6, rough: 0.6, drive: 3.5 }), 0, 1], [boom(r, 1.2, 60), 0.6, 0.8]), M(0.85, { cd: 200, verb: 0.5 })],
  die_goatman: [(r) => growl(r, 0.6, 230, 140, 'e', 'a', { vib: [11, 0.07], rough: 0.25 }), M(0.45, { v: 3, cd: 60 })],
  die_goatArcher: [(r) => growl(r, 0.55, 250, 150, 'e', 'a', { vib: [11, 0.07], rough: 0.25 }), M(0.45, { v: 3, cd: 60 })],
  die_lizard: [(r) => lay(0.6, [growl(r, 0.4, 170, 110, 'o', 'u', { rough: 0.5, drive: 2 }), 0, 0.7], [high(r, 0.4, 3000, perc(0.02, 0.35)), 0.05, 0.4]), M(0.45, { v: 3, cd: 60 })],
  die_fireSpirit: [(r) => lay(0.8, [fireRoar(r, 0.6, swell(0.05, 0.5), 400, 2200), 0, 0.9], [osc(0.5, 'sin', glide(1400, 350, 0.45), perc(0.01, 0.45)), 0, 0.25]), M(0.45, { v: 3, cd: 60 })],
  die_eye: [(r) => lay(0.5, [squelch(r, 0.3), 0, 0.9], [osc(0.15, 'sin', glide(700, 110, 0.12), perc(0.002, 0.15)), 0, 0.6]), M(0.5, { v: 3, cd: 60 })],
  die_hound: [(r) => growl(r, 0.5, 560, 300, 'a', 'u', { shift: 1.1, rough: 0.3, drive: 1.5 }), M(0.3, { v: 3, cd: 60 })],
  die_knight: [(r) => lay(0.9, [metal(r, 0.8, r.range(300, 360), 0.4), 0.02, 0.35], [bones(r, 0.5, 8), 0, 0.3], [growl(r, 0.5, 115, 80, 'u', 'o', { rough: 0.3, drive: 2 }), 0, 0.6]), M(0.55, { v: 3, cd: 60 })],
  die_witch: [(r) => growl(r, 0.9, 720, 330, 'i', 'a', { vib: [7, 0.05], rough: 0.1 }), M(0.4, { v: 3, cd: 70, verb: 0.5 })],
  die_soulEater: [(r) => lay(1.5, [growl(r, 1.3, 58, 36, 'a', 'o', { shift: 0.6, rough: 0.6, drive: 4 }), 0, 1], [boom(r, 0.9, 55), 0.1, 0.6]), M(0.7, { v: 2, cd: 80 })],
  die_ignira: [(r) => lay(2.2, [growl(r, 1.8, 400, 160, 'i', 'o', { vib: [6, 0.06], rough: 0.3, drive: 2 }), 0, 0.8], [fireRoar(r, 2.0, swell(0.2, 1.7), 300, 1800), 0, 0.7]), M(0.8, { cd: 200, verb: 0.6 })],
  die_malegath: [(r) => lay(3, [growl(r, 2.6, 52, 28, 'a', 'u', { shift: 0.55, rough: 0.7, drive: 4 }), 0, 1], [boom(r, 2, 50), 0.3, 0.8]), M(0.9, { cd: 300, verb: 0.6 })],
  die_default: [(r) => growl(r, 0.6, 125, 75, 'a', 'o', { rough: 0.3, drive: 2 }), M(0.45, { v: 3, cd: 60 })],
  // ---- monster attacks
  mswing: [(r) => whoosh(r, 0.2, 280, 1500, 1), M(0.3, { v: 3, pj: 0.08, cd: 60, max: 3 })],
  mswingHeavy: [(r) => lay(0.45, [whoosh(r, 0.36, 140, 900, 0.9), 0, 1], [low(r, 0.4, 200, swell(0.2, 0.2), 'brown'), 0, 0.8]), M(0.45, { v: 3, pj: 0.06, cd: 80 })],
  bossSwing: [(r) => lay(0.7, [whoosh(r, 0.5, 90, 700, 0.8), 0, 1], [low(r, 0.6, 160, swell(0.3, 0.3), 'brown'), 0, 1], [osc(0.5, 'sin', 45, swell(0.3, 0.2)), 0, 0.5]), M(0.65, { v: 2, cd: 120 })],
  roar: [(r) => growl(r, 0.9, 110, 68, 'a', 'o', { shift: 0.75, rough: 0.5, drive: 2.5, breath: 0.2 }), M(0.5, { v: 2, cd: 300, verb: 0.3 })],
  bossRoar: [(r) => lay(2.4,
    [growl(r, 2.0, 62, 42, 'a', 'o', { shift: 0.6, rough: 0.6, drive: 3.5 }), 0, 1],
    [growl(r, 1.9, 93, 64, 'o', 'u', { shift: 0.7, rough: 0.5, drive: 3 }), 0.05, 0.55],
    [osc(2.0, 'sin', glide(55, 38, 2), swell(0.4, 1.6)), 0, 0.6],
    [low(r, 2.2, 450, swell(0.3, 1.9), 'brown'), 0, 0.6]), M(0.85, { cd: 400, verb: 0.6 })],
  bossCast: [(r) => lay(1.3,
    [reverse(band(r, 0.9, glide(1600, 200, 0.9), 1.5, perc(0.002, 0.9), 'pink')), 0, 0.8],
    [svf(lay(1.2, [osc(1.2, 'saw', 55, swell(0.8, 0.4)), 0, 1], [osc(1.2, 'saw', 58.3, swell(0.8, 0.4)), 0, 0.8], [osc(1.2, 'saw', 82.4, swell(0.8, 0.4)), 0, 0.6]), 'lp', lin(0, 200, 0.8, 1400, 1.2, 300)), 0, 0.5],
    [boom(r, 0.5, 90), 0.85, 0.6]), M(0.6, { cd: 200, verb: 0.5 })],
  breath: [(r) => lay(1.7, [fireRoar(r, 1.6, lin(0, 0, 0.15, 1, 1.25, 0.8, 1.6, 0), 300, 1100), 0, 1], [growl(r, 1.2, 60, 45, 'a', 'o', { shift: 0.6, rough: 0.6, drive: 3 }), 0, 0.35]), M(0.7, { cd: 300, verb: 0.3 })],
  bossDeath: [(r) => lay(4.5,
    [boom(r, 2.6, 60), 0, 1],
    [growl(r, 3.0, 70, 30, 'a', 'u', { shift: 0.6, rough: 0.6, drive: 3 }), 0, 0.7],
    [low(r, 4, 180, swell(0.4, 3.4), 'brown'), 0, 0.6],
    [chord(r, 3.2, [220, 261.6, 329.6, 440]), 1.1, 0.5],
    [bell(440, 3), 1.0, 0.25]), M(0.95, { cd: 1000, verb: 0.7 })],
  mshoot_arrow: [(r) => twang(r, 130), M(0.5, { v: 3, pj: 0.06, cd: 50 })],
  mshoot_firebolt: [(r) => lay(0.5, [fireRoar(r, 0.45, swell(0.04, 0.4), 300, 1400), 0, 1]), M(0.4, { v: 3, cd: 60 })],
  mshoot_fireball: [(r) => lay(0.7, [fireRoar(r, 0.6, swell(0.06, 0.5), 200, 1100), 0, 1], [thud(120, 60, 0.2), 0, 0.4]), M(0.45, { v: 2, cd: 60 })],
  mshoot_spit: [(r) => lay(0.4, [squelch(r, 0.2), 0, 0.8], [high(r, 0.3, 3000, perc(0.01, 0.3)), 0.03, 0.4]), M(0.4, { v: 3, cd: 60 })],
  mshoot_coldbolt: [(r) => lay(0.45, [band(r, 0.35, glide(2400, 5200, 0.3), 2, swell(0.05, 0.3)), 0, 0.8], [sparkle(r, 0.4, 6, 3000, 8000, 0.15), 0, 0.5]), M(0.38, { v: 3, cd: 60 })],
  mshoot_lightning: [(r) => zap(r, 0.25), M(0.35, { v: 3, cd: 60 })],
  mshoot_spark: [(r) => zap(r, 0.15), M(0.25, { v: 3, cd: 80 })],
  mshoot_blood: [(r) => lay(0.5, [squelch(r, 0.25), 0, 0.6], [reverse(band(r, 0.4, 700, 2, perc(0.002, 0.4), 'pink')), 0, 0.6]), M(0.4, { v: 3, cd: 60 })],
  mshoot_bone: [(r) => lay(0.4, [whoosh(r, 0.25, 600, 2400, 1.4), 0, 0.8], [bones(r, 0.2, 3), 0, 0.4]), M(0.38, { v: 3, cd: 60 })],
  // ---- hero skills
  cast_shoot: [(r) => twang(r, 104), M(0.8, { v: 4, pj: 0.05, cd: 40 })],
  cast_multishot: [(r) => lay(0.5, [twang(r, 98), 0, 1], [whoosh(r, 0.18, 1600, 5000, 2), 0.025, 0.4], [whoosh(r, 0.18, 1300, 4400, 2), 0.045, 0.4]), M(0.85, { v: 3, cd: 40 })],
  cast_explode: [(r) => lay(0.5, [twang(r, 100), 0, 1], [high(r, 0.35, 2800, perc(0.02, 0.3)), 0.01, 0.3], [crackle(0.35, r, 60, perc(0.01, 0.3)), 0.01, 0.4]), M(0.8, { v: 3, cd: 40 })],
  cast_strafe: [(r) => lay(0.5, [twang(r, 110), 0, 1], [twang(r, 116), 0.07, 0.7]), M(0.8, { v: 3, cd: 40 })],
  cast_rain: [(r) => lay(1.0, [twang(r, 96), 0, 0.8], [twang(r, 101), 0.06, 0.6], [twang(r, 92), 0.12, 0.5], [osc(0.7, 'sin', glide(2600, 1700, 0.7), perc(0.1, 0.6), { vib: [9, 0.01] }), 0.15, 0.12]), M(0.7, { v: 2, cd: 60 })],
  cast_bolt: [(r) => lay(0.45, [osc(0.3, 'sin', glide(420, 1500, 0.1), perc(0.002, 0.25)), 0, 0.5], [osc(0.2, 'tri', glide(840, 3000, 0.1), perc(0.002, 0.15)), 0, 0.2], [sparkle(r, 0.35, 6, 3000, 7000, 0.15), 0, 0.4], [whoosh(r, 0.2, 1500, 4500, 1.5), 0, 0.4]), M(0.55, { v: 4, cd: 40 })],
  cast_fireball: [(r) => lay(0.8, [fireRoar(r, 0.65, lin(0, 0, 0.05, 1, 0.65, 0), 250, 1500), 0, 1], [thud(130, 55, 0.25, 2), 0, 0.6], [crackle(0.6, r, 60, perc(0.01, 0.55)), 0, 0.4]), M(0.55, { v: 3, cd: 40 })],
  cast_frostnova: [(r) => lay(1.3, [drive(click(r, 0.012, 1200), 4), 0, 0.8], [sparkle(r, 1.0, 34, 2800, 9500, 0.35), 0, 0.7], [band(r, 0.8, glide(3200, 700, 0.8), 1, swell(0.03, 0.75)), 0, 0.6], [thud(160, 55, 0.2, 2), 0, 0.6], [ring(1.1, [[1850, 0.3, 0.8], [2780, 0.25, 0.6], [4150, 0.2, 0.4]]), 0, 0.4]), M(0.62, { v: 2, cd: 60, verb: 0.45 })],
  cast_chain: [(r) => lay(0.9, [drive(click(r, 0.01, 900), 6), 0, 0.9], [zap(r, 0.6), 0, 0.8], [crackle(0.7, r, 140, perc(0.002, 0.7)), 0, 0.5], [osc(0.2, 'saw', glide(1900, 280, 0.18), perc(0.002, 0.2)), 0, 0.12]), M(0.8, { v: 3, cd: 50 })],
  cast_teleport: [(r) => lay(0.9,
    [amp(band(r, 0.38, glide(300, 4500, 0.38), 1.5, 1, 'pink'), (t) => (t / 0.38) ** 3), 0, 0.8],
    [osc(0.1, 'sin', glide(1600, 260, 0.08), perc(0.001, 0.1)), 0.38, 0.6],
    [sparkle(r, 0.5, 12, 3000, 8000, 0.3), 0.38, 0.5],
    [ring(0.5, [[880, 0.3, 0.45], [1320, 0.2, 0.35]]), 0.38, 0.4]), M(0.5, { v: 2, cd: 80, verb: 0.5 })],
  cast_meteor: [(r) => lay(1.4, [osc(1.25, 'sin', glide(2600, 320, 1.15), lin(0, 0, 0.1, 0.3, 1.0, 0.7, 1.25, 0), { vib: [11, 0.015] }), 0, 0.5], [band(r, 1.25, glide(1500, 250, 1.2), 3, lin(0, 0, 0.2, 0.4, 1.1, 1, 1.25, 0)), 0, 0.6], [low(r, 1.3, 200, swell(1.0, 0.3), 'brown'), 0, 0.6]), M(0.5, { cd: 100 })],
  cast_dash: [(r) => lay(0.55, [whoosh(r, 0.38, 180, 2200, 0.8), 0, 1], [osc(0.4, 'sin', 55, swell(0.15, 0.25)), 0, 0.5], [reverse(high(r, 0.2, 3500, perc(0.002, 0.2))), 0, 0.35]), M(0.5, { v: 2, cd: 80 })],
  cast_leap: [(r) => whoosh(r, 0.32, 250, 2600, 1), M(0.45, { v: 2, cd: 80 })],
  warcry: [(r) => lay(1.6,
    [voice(1.1, lin(0, 100, 0.2, 128, 1.1, 104), 'a', 'a', env3(0.06, 0.8, 1.1), r, { drive: 2.5, rough: 0.35, vib: [5.5, 0.02], breath: 0.2 }), 0, 0.8],
    [voice(1.1, lin(0, 101, 0.2, 130, 1.1, 105), 'a', 'o', env3(0.08, 0.8, 1.1), r, { drive: 2, rough: 0.3, vib: [5, 0.02], shift: 0.85 }), 0.02, 0.6],
    [boom(r, 0.9, 70), 0, 0.6]), M(0.7, { cd: 300, verb: 0.55 })],
  berserk: [(r) => lay(1.4,
    [growl(r, 1.0, 70, 55, 'a', 'o', { shift: 0.65, rough: 0.6, drive: 4 }), 0, 0.8],
    [thud(62, 38, 0.18, 2), 0, 0.7], [thud(62, 38, 0.18, 2), 0.2, 0.55], [thud(62, 38, 0.18, 2), 0.8, 0.6], [thud(62, 38, 0.18, 2), 1.0, 0.45],
    [fireRoar(r, 0.9, swell(0.3, 0.6), 200, 900), 0, 0.5]), M(0.65, { cd: 300, verb: 0.4 })],
  nomana: [(r) => lay(0.3, [amp(high(r, 0.2, 2000, perc(0.01, 0.18)), wander(r, 0.2, 60, 0, 1)), 0, 0.6], [osc(0.18, 'sin', glide(440, 180, 0.15), perc(0.005, 0.15)), 0, 0.5]), M(0.35, { cd: 300 })],
  lightning: [(r) => lay(0.9, [drive(click(r, 0.01, 900), 6), 0, 0.9], [zap(r, 0.6), 0, 0.8], [crackle(0.7, r, 140, perc(0.002, 0.7)), 0, 0.5]), M(0.55, { v: 3, cd: 60 })],
  thunder: [(r) => lay(3.0, [drive(click(r, 0.012, 700), 6), 0, 1], [zap(r, 0.5), 0, 0.7], [boom(r, 1.5, 65), 0.03, 0.8], [amp(low(r, 2.8, 170, swell(0.15, 2.6), 'brown'), wander(r, 2.8, 9, 0.3, 1)), 0.05, 0.9]), M(0.8, { cd: 400, verb: 0.5 })],
  explode: [(r) => lay(1.7, [drive(click(r, 0.012, 600), 5), 0, 0.9], [boom(r, 1.3, 92), 0, 1], [low(r, 1.3, glide(4500, 180, 0.9), perc(0.002, 1.1), 'white'), 0, 0.8], [crackle(1.0, r, 45, perc(0.01, 0.9)), 0.02, 0.5], [debris(r, 1.1, 10), 0.05, 0.5]), M(0.8, { v: 3, cd: 60, verb: 0.3 })],
  meteor: [(r) => lay(2.4, [drive(click(r, 0.015, 500), 6), 0, 1], [boom(r, 1.9, 72), 0, 1], [low(r, 1.8, glide(3800, 120, 1.2), perc(0.003, 1.6), 'white'), 0, 0.9], [debris(r, 1.6, 22, 600, 3500), 0.03, 0.6], [amp(low(r, 2.2, 150, swell(0.1, 2), 'brown'), wander(r, 2.2, 8, 0.3, 1)), 0, 0.7]), M(0.9, { v: 2, cd: 120, verb: 0.35 })],
  stomp: [(r) => lay(1.5, [drive(click(r, 0.012, 500), 5), 0, 0.9], [boom(r, 1.2, 75), 0, 1], [debris(r, 1.0, 14, 500, 3000), 0.02, 0.6]), M(0.85, { v: 2, cd: 100, verb: 0.3 })],
  frost: [(r) => lay(1.2, [drive(click(r, 0.012, 1200), 4), 0, 0.7], [sparkle(r, 1.0, 24, 2800, 9500, 0.35), 0, 0.7], [band(r, 0.7, glide(3000, 800, 0.7), 1, swell(0.03, 0.65)), 0, 0.5]), M(0.55, { v: 2, cd: 80, verb: 0.4 })],
  teleport: [(r) => lay(0.9, [amp(band(r, 0.38, glide(300, 4500, 0.38), 1.5, 1, 'pink'), (t) => (t / 0.38) ** 3), 0, 0.8], [osc(0.1, 'sin', glide(1600, 260, 0.08), perc(0.001, 0.1)), 0.38, 0.6], [sparkle(r, 0.5, 10, 3000, 8000, 0.3), 0.38, 0.5]), M(0.45, { v: 2, cd: 80, verb: 0.5 })],
  blink: [(r) => lay(0.45, [amp(band(r, 0.18, glide(500, 4000, 0.18), 1.5, 1, 'pink'), (t) => (t / 0.18) ** 2), 0, 0.7], [osc(0.08, 'sin', glide(1400, 300, 0.07), perc(0.001, 0.08)), 0.18, 0.5]), M(0.4, { v: 2, cd: 80, verb: 0.4 })],
  // ---- hero
  heroHit: [(r) => { const grunt = r.next() < 0.5; return lay(0.4, [thud(r.range(130, 150), 55, 0.14, 2.2), 0, 0.9], [band(r, 0.07, 700, 1, perc(0.001, 0.07)), 0, 0.5], [squelch(r, 0.1), 0, 0.3], [grunt ? voice(0.2, glide(r.range(135, 155), 105, 0.18), 'u', 'o', env3(0.01, 0.1, 0.2), r, { rough: 0.3, breath: 0.25 }) : buf(0.01), 0.01, 0.35]); }, M(0.5, { v: 4, pj: 0.05, cd: 110 })],
  heroDeath: [(r) => lay(2.6, [voice(1.6, glide(155, 70, 1.4), 'a', 'o', env3(0.05, 0.9, 1.6), r, { rough: 0.35, drive: 1.6, breath: 0.2 }), 0, 0.7], [boom(r, 1.8, 60), 0, 0.8], [chord(r, 2.4, [110, 130.8, 164.8]), 0.4, 0.3]), M(0.8, { cd: 2000, verb: 0.7 })],
  // ---- world / items / ui
  gold: [(r) => { const b = buf(0.5); const n = r.int(4, 7); for (let i = 0; i < n; i++) { const f = r.range(2300, 4300), d = r.range(0.07, 0.2); mix(b, ring(d, [[f, 1, d], [f * 2.76, 0.45, d * 0.6], [f * 5.4, 0.2, d * 0.35]]), i * 0.032 + r.range(0, 0.02), r.range(0.4, 1)); } mix(b, click(r, 0.004, 3000), 0, 0.4); return b; }, M(0.32, { v: 4, cd: 60, verb: 0.2 })],
  pickup: [(r) => lay(0.3, [band(r, 0.14, 1200, 0.8, perc(0.012, 0.12), 'pink'), 0, 0.8], [ring(0.08, [[r.range(1700, 2000), 0.5, 0.06]]), 0.03, 0.4]), M(0.4, { v: 3, cd: 50 })],
  potPick: [(r) => lay(0.35, [band(r, 0.12, 1100, 0.8, perc(0.01, 0.1), 'pink'), 0, 0.6], [ring(0.2, [[r.range(1300, 1500), 0.6, 0.15], [r.range(3200, 3500), 0.3, 0.1]]), 0.02, 0.6]), M(0.4, { v: 3, cd: 50 })],
  drop: [(r) => lay(0.3, [thud(200, 90, 0.12, 1.5), 0, 0.8], [band(r, 0.08, 500, 1, perc(0.002, 0.08)), 0, 0.5], [debris(r, 0.2, 2, 800, 2000), 0.03, 0.3]), M(0.4, { v: 3, cd: 50 })],
  itemDrop: [(r) => lay(0.45, [thud(240, 120, 0.1), 0, 0.6], [ring(0.3, [[r.range(900, 1100), 0.5, 0.22], [r.range(2400, 2700), 0.3, 0.12]]), 0.005, 0.6], [click(r, 0.004, 2500), 0, 0.5]), M(0.4, { v: 3, cd: 40 })],
  rareDrop: [(r) => lay(1.6, [bell(880, 1.4), 0, 0.6], [bell(1320, 1.1), 0.08, 0.35], [sparkle(r, 1.0, 8, 3000, 7000, 0.3), 0.05, 0.35], [thud(240, 120, 0.1), 0, 0.4]), M(0.7, { cd: 100, verb: 0.5 })],
  uniqueDrop: [(r) => lay(3.0,
    [boom(r, 0.9, 80), 0, 0.5], [bell(659, 2.4), 0, 0.5], [bell(988, 2.1), 0.1, 0.4], [bell(1319, 1.9), 0.2, 0.35], [bell(1760, 1.7), 0.3, 0.3],
    [chord(r, 2.6, [329.6, 415.3, 493.9], 'a', 0.35), 0.05, 0.6], [sparkle(r, 2.2, 22, 3000, 9000, 0.4), 0.1, 0.4]), M(0.7, { cd: 300, verb: 0.7 })],
  equip: [(r) => lay(0.4, [ring(0.2, [[r.range(1500, 1750), 0.5, 0.15], [r.range(3800, 4100), 0.3, 0.08]]), 0, 0.6], [band(r, 0.14, 900, 0.8, perc(0.01, 0.12), 'pink'), 0.02, 0.7], [thud(180, 100, 0.06), 0.01, 0.4]), M(0.45, { v: 2, cd: 50 })],
  potion: [(r) => { const b = buf(1.1); for (let i = 0; i < 4; i++) mix(b, osc(0.08, 'sin', glide(220 + i * 30, 520 + i * 40, 0.05), perc(0.005, 0.07)), 0.09 * i, 0.5); mix(b, thud(120, 70, 0.1), 0.42, 0.5); mix(b, sparkle(r, 0.6, 8, 2500, 6000, 0.3), 0.45, 0.35); mix(b, lay(0.6, [osc(0.6, 'sin', 523.3, swell(0.1, 0.5)), 0, 0.2], [osc(0.6, 'sin', 659.3, swell(0.1, 0.5)), 0, 0.15]), 0.45, 1); return b; }, M(0.5, { v: 2, cd: 150, verb: 0.35 })],
  error: [(r) => lay(0.32, [svf(osc(0.12, 'sqr', 110, perc(0.005, 0.12)), 'lp', 700), 0, 0.8], [svf(osc(0.12, 'sqr', 98, perc(0.005, 0.12)), 'lp', 700), 0.13, 0.8]), M(0.3, { cd: 250 })],
  click: [(r) => lay(0.05, [click(r, 0.004, 3000), 0, 0.8], [osc(0.03, 'sin', 2400, perc(0.001, 0.02)), 0, 0.3]), M(0.4, { cd: 30, verb: 0 })],
  open: [(r) => lay(0.4, [band(r, 0.25, lin(0, 700, 0.25, 1600), 0.8, perc(0.02, 0.2), 'pink'), 0, 0.8], [ring(0.12, [[r.range(280, 320), 0.5, 0.1], [700, 0.25, 0.06]]), 0, 0.4], [click(r, 0.004, 1500), 0, 0.4]), M(0.35, { v: 2, cd: 60, verb: 0.05 })],
  barrel: [(r) => { const b = lay(0.7, [thud(160, 70, 0.15, 2), 0, 0.7], [ring(0.2, [[r.range(180, 200), 0.5, 0.15], [r.range(420, 450), 0.4, 0.12], [860, 0.3, 0.08]]), 0, 0.5], [debris(r, 0.5, 9, 500, 2500), 0.04, 0.5]); for (const [t, f] of [[0, 450], [0.015, 900], [0.04, 1600], [0.07, 700]]) mix(b, band(r, 0.04, f, 3, perc(0.0005, 0.035)), t, 0.8); return b; }, M(0.55, { v: 3, cd: 50 })],
  chest: [(r) => { const b = lay(1.1, [svf(osc(0.4, 'saw', wander(r, 0.4, 25, 60, 120), swell(0.12, 0.3)), 'bp', 900, 5), 0, 0.6], [ring(0.3, [[600, 0.5, 0.2], [1500, 0.3, 0.12]]), 0.42, 0.6], [thud(170, 90, 0.08), 0.42, 0.5]); for (let i = 0; i < 4; i++) { const f = r.range(2400, 4000); mix(b, ring(0.15, [[f, 1, 0.12], [f * 2.76, 0.4, 0.07]]), 0.52 + i * 0.05, 0.25); } return b; }, M(0.5, { cd: 150, verb: 0.3 })],
  stone: [(r) => lay(1.3, [amp(low(r, 1.1, 500, swell(0.2, 0.9), 'brown'), wander(r, 1.1, 25, 0.2, 1)), 0, 1], [thud(80, 40, 0.25, 2), 0.9, 0.7], [debris(r, 0.8, 8, 400, 1500), 0.1, 0.4]), M(0.4, { cd: 200 })],
  shrine: [(r) => lay(3.2, [chord(r, 3.0, [261.6, 329.6, 392, 523.3], 'a', 0.4), 0, 0.8], [bell(1046.5, 2.5), 0, 0.3], [sparkle(r, 2.5, 18, 2500, 8000, 0.45), 0.1, 0.35]), M(0.55, { cd: 500, verb: 0.8 })],
  portal: [(r) => lay(2.0, [band(r, 1.8, (t) => (500 + 900 * t) * (1 + 0.5 * Math.sin(Math.PI * 2 * 3 * t)), 4, swell(0.4, 1.4), 'pink'), 0, 0.9], [osc(1.8, 'sin', 110, swell(0.4, 1.4)), 0, 0.4], [osc(1.8, 'sin', 165, swell(0.5, 1.3), { vib: [4, 0.01] }), 0, 0.25], [sparkle(r, 1.6, 14, 2000, 7000, 0.4), 0.2, 0.3]), M(0.5, { cd: 400, verb: 0.6 })],
  waypoint: [(r) => lay(2.2, [bell(523.3, 1.8), 0, 0.5], [bell(659.3, 1.7), 0.1, 0.45], [bell(784, 1.6), 0.2, 0.4], [bell(1046.5, 1.6), 0.3, 0.35], [whoosh(r, 0.6, 300, 3000, 1), 0, 0.4]), M(0.5, { cd: 400, verb: 0.7 })],
  stairs: [(r) => { const b = buf(0.8); for (let i = 0; i < 4; i++) { mix(b, thud(r.range(110, 130), 70, 0.08), i * 0.16, 0.6); mix(b, band(r, 0.06, 450, 1, perc(0.005, 0.05), 'pink'), i * 0.16 + 0.01, 0.4); } return b; }, M(0.5, { cd: 300 })],
  learn: [(r) => lay(1.4, [bell(1046.5, 1.2), 0, 0.5], [bell(1568, 1.0), 0.07, 0.4], [sparkle(r, 1.0, 10, 3000, 8000, 0.3), 0.05, 0.4]), M(0.45, { cd: 200, verb: 0.6 })],
  levelup: [(r) => {
    const d = 3.0;
    const brass = buf(d);
    for (const f of [130.8, 196, 261.6, 329.6, 392]) for (const det of [0.996, 1.004]) mix(brass, osc(2.4, 'saw', f * det, swell(0.12, 2.1)), 0, 0.2);
    svf(brass, 'lp', lin(0, 300, 0.25, 3200, 1.2, 1400, 2.4, 600), 1.2);
    const b = lay(d, [brass, 0, 0.7], [boom(r, 1, 70), 0, 0.5]);
    [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => mix(b, bell(f, 1.4), 0.05 + i * 0.07, 0.3));
    mix(b, sparkle(r, 1.8, 20, 3000, 9000, 0.4), 0.3, 0.35);
    return b;
  }, M(0.7, { cd: 1000, verb: 0.6 })],
  resurrect: [(r) => lay(1.9, [reverse(band(r, 0.9, glide(900, 150, 0.9), 1.2, perc(0.002, 0.9), 'pink')), 0, 0.8], [voice(1.2, glide(80, 115, 1.1), 'u', 'a', env3(0.2, 0.9, 1.2), r, { rough: 0.4, drive: 2, shift: 0.8 }), 0.5, 0.5], [osc(1.6, 'sin', 55, swell(0.8, 0.8)), 0, 0.4]), M(0.5, { cd: 200, verb: 0.6 })],
};

// aliases
const ALIAS: Record<string, string> = {
  cast_warcry: 'warcry', cast_berserk: 'berserk', cast_frostnova: 'cast_frostnova', cast_chain: 'cast_chain',
  bash: 'hitHeavy', cast_attack: '', cast_bash: '', cast_cleave: '',
  mshoot_fireball2: 'mshoot_fireball',
};

export function resolveSfx(name: string): string {
  if (name in ALIAS) return ALIAS[name];
  if (RECIPES[name]) return name;
  if (name.startsWith('die_')) return 'die_default';
  if (name.startsWith('mshoot_')) return 'mshoot_firebolt';
  return '';
}
export function sfxMeta(name: string): SfxMeta | null { return RECIPES[name]?.[1] ?? null; }
/** Renders one variant of a sound. */
export function renderSfx(name: string, variant: number): Float32Array {
  const rec = RECIPES[name];
  if (!rec) return new Float32Array(1);
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  const out = norm(rec[0](new Rand((h ^ (variant * 0x9e3779b1)) >>> 0)), 0.9);
  return fade(out, 0, Math.min(0.05, out.length / SR / 4));
}
/** Sounds rendered ahead of time (on the title screen), most urgent first. Everything else renders on first use or via Audio.prepare. */
export const WARM_CORE = ['swing', 'hit', 'hitHeavy', 'crit', 'hitArrow', 'hitMagic', 'hitFire', 'hitCold', 'hitLight', 'hitPoison', 'heroHit', 'mswing', 'mswingHeavy', 'gib', 'shatter', 'burnDie', 'block', 'evade',
  'gold', 'itemDrop', 'pickup', 'potPick', 'drop', 'potion', 'equip', 'click', 'open', 'error', 'nomana', 'barrel', 'chest', 'stairs', 'portal', 'waypoint', 'learn', 'rareDrop', 'uniqueDrop', 'levelup', 'eliteKill', 'explode', 'stomp', 'roar', 'die_default'];
export const ALL_SFX = Object.keys(RECIPES);

// ---------------------------------------------------------------- class modules
/** Registers a sound for class modules (src/classes/<id>/sfx.ts). Meta defaults: M(gain, { v, pj, cd, verb, max }). */
export function registerSfx(name: string, recipe: Recipe, meta: SfxMeta): void { RECIPES[name] = [recipe, meta]; }
/** Plays an existing sound under another name (e.g. 'cast_pl_zeal' → 'swingHeavy'); '' silences it. */
export function aliasSfx(name: string, to: string): void { ALIAS[name] = to; }
export { M, COMBAT, click, thud, band, low, high, whoosh, squelch, boom, debris, sparkle, zap, fireRoar, metal, twang, env3, growl, chord, bones, hitBody };
