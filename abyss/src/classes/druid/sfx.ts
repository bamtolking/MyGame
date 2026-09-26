// druid: sound effects (platform/sfx registerSfx / aliasSfx).
// Wood and leaves for the thorn seed and vines, wind for the tornado, a howl and snarling bites for the spirit
// wolves, rain and soft chimes for renewal, and a gathering storm with sharp thunder cracks.
import { COMBAT, M, aliasSfx, band, boom, click, debris, high, low, registerSfx, sparkle, squelch, thud, whoosh, zap } from '../../platform/sfx';
import { Rand, amp, crackle, drive, glide, lay, lin, mix, noise, osc, perc, pluck, ring, svf, swell, voice, wander } from '../../platform/dsp';

/** Leaf rustle: sparse clicks through a bright band, under an envelope. */
function rustle(r: Rand, d: number, density: number, env: (t: number) => number = swell(d * 0.3, d * 0.7)): Float32Array {
  const c = crackle(d, r, density, env);
  const air = noise(d, r, (t) => env(t) * 0.25, 'pink');
  for (let i = 0; i < c.length; i++) c[i] += air[i];
  return svf(svf(c, 'hp', 1800, 0.7), 'bp', r.range(3600, 5200), 0.7);
}

/** Creaking wood: a slow irregular sawtooth through a resonant band (bending branches, tightening vines). */
function creak(r: Rand, d: number, f0: number, f1: number, bp = 900): Float32Array {
  const f = wander(r, d, 18, f0, f1);
  return svf(osc(d, 'saw', f, swell(d * 0.35, d * 0.6)), 'bp', bp * r.range(0.85, 1.15), 5);
}

/** Wind: pink noise through a wandering resonant band, with a whistle on top. */
function wind(r: Rand, d: number, lo: number, hi: number, env: (t: number) => number, q = 2.2): Float32Array {
  const body = svf(noise(d, r, env, 'pink'), 'bp', wander(r, d, 5, lo, hi), q);
  const whistle = svf(noise(d, r, (t) => env(t) * 0.5, 'white'), 'bp', wander(r, d, 3, hi * 1.2, hi * 2), 14);
  return lay(d, [body, 0, 1], [whistle, 0, 0.35]);
}

/** A wolf howl (formant voice with a rising then falling pitch). */
function howl(r: Rand, d: number, f: number): Float32Array {
  const k = r.range(0.95, 1.05) * f;
  return voice(d, lin(0, k * 0.62, d * 0.2, k, d * 0.7, k * 0.94, d, k * 0.7), 'u', 'o', lin(0, 0, d * 0.15, 1, d * 0.75, 0.8, d, 0), r, { shift: 1.25, vib: [5.5, 0.018], rough: 0.04, breath: 0.12, q: 8 });
}

/** A short thunder crack: tearing noise, electric buzz, then a quick rolling rumble. */
function crack(r: Rand, d: number, f0: number): Float32Array {
  return lay(d,
    [drive(click(r, 0.012, 700), 6), 0, 1],
    [zap(r, 0.22), 0, 0.55],
    [drive(high(r, 0.09, 1800, perc(0.001, 0.09)), 3), 0, 0.6],
    [boom(r, d * 0.8, f0), 0.015, 0.9],
    [amp(low(r, d, 180, swell(0.06, d * 0.85), 'brown'), wander(r, d, 11, 0.25, 1)), 0.03, 0.8]);
}

/** Rain: hiss plus hundreds of tiny droplet pops. */
function rain(r: Rand, d: number, env: (t: number) => number): Float32Array {
  const b = lay(d, [svf(noise(d, r, (t) => env(t) * 0.5, 'pink'), 'hp', 2200, 0.7), 0, 1]);
  const n = Math.round(d * 120);
  for (let i = 0; i < n; i++) {
    const t = r.next() * d * 0.97, f = r.range(1800, 5200), dd = r.range(0.008, 0.025);
    mix(b, ring(dd, [[f, 1, dd], [f * 1.6, 0.3, dd * 0.6]]), t, r.range(0.05, 0.22) * env(t));
  }
  return b;
}

// ---------------------------------------------------------------- thorn seed (basic)
aliasSfx('cast_dr_thorn', '');
registerSfx('dr_seedShot', (r) => lay(0.4,
  [pluck(r.range(170, 215), 0.3, r, { bright: 0.35, decay: 0.1 }), 0, 0.45],
  [click(r, 0.004, 1400), 0, 0.6],
  [whoosh(r, 0.17, 900, 3600, 1.6), 0.004, 0.75],
  [rustle(r, 0.18, 110, perc(0.005, 0.16)), 0, 0.5]), M(0.55, { v: 4, pj: 0.06, cd: 40 }));
registerSfx('dr_seedHit', (r) => lay(0.3,
  [thud(r.range(260, 320), 110, 0.07, 2), 0, 0.7],
  [band(r, 0.05, r.range(1100, 1500), 2.5, perc(0.0005, 0.05)), 0, 0.6],
  [rustle(r, 0.2, 140, perc(0.003, 0.18)), 0.004, 0.55]), M(0.36, COMBAT));

// ---------------------------------------------------------------- tornado
registerSfx('cast_dr_tornado', (r) => lay(1.15,
  [wind(r, 1.1, 320, 1300, lin(0, 0, 0.18, 1, 0.7, 0.8, 1.1, 0), 2.4), 0, 1],
  [whoosh(r, 0.55, 180, 1900, 0.9), 0, 0.8],
  [low(r, 1.0, 260, swell(0.2, 0.75), 'brown'), 0, 0.55],
  [rustle(r, 0.9, 90), 0.12, 0.45],
  [debris(r, 0.8, 5, 700, 2400), 0.2, 0.25]), M(0.5, { v: 3, pj: 0.05, cd: 70, verb: 0.2 }));
registerSfx('dr_tornadoEnd', (r) => lay(0.6, [wind(r, 0.55, 250, 900, perc(0.02, 0.5), 1.8), 0, 0.8], [rustle(r, 0.4, 70, perc(0.01, 0.35)), 0, 0.5]), M(0.22, { v: 2, cd: 120 }));

// ---------------------------------------------------------------- thorny vines
registerSfx('cast_dr_vines', (r) => lay(0.55,
  [rustle(r, 0.5, 120, swell(0.3, 0.2)), 0, 0.7],
  [osc(0.5, 'sin', glide(70, 110, 0.45), swell(0.35, 0.15)), 0, 0.35],
  [creak(r, 0.45, 55, 95, 700), 0.05, 0.35]), M(0.4, { v: 2, cd: 60 }));
registerSfx('dr_vinesGrow', (r) => {
  const b = lay(1.3,
    [debris(r, 0.5, 12, 250, 1400), 0, 0.8],
    [low(r, 0.5, 420, perc(0.005, 0.45), 'brown'), 0, 0.8],
    [thud(110, 45, 0.25, 2), 0, 0.6],
    [creak(r, 1.1, 45, 120, 850), 0.05, 0.7],
    [creak(r, 0.9, 70, 160, 1300), 0.2, 0.45],
    [rustle(r, 1.1, 150, swell(0.15, 0.9)), 0.05, 0.6]);
  // whip-like snaps as the vines lash out
  for (let i = 0; i < 4; i++) mix(b, drive(band(r, 0.025, r.range(1500, 2600), 3, perc(0.0005, 0.02)), 3), 0.06 + i * r.range(0.07, 0.14), 0.5);
  return b;
}, M(0.55, { v: 3, cd: 80, verb: 0.25 }));
registerSfx('dr_vineGrab', (r) => lay(0.45,
  [creak(r, 0.35, 60, 140, 1100), 0, 0.8],
  [squelch(r, 0.15), 0.02, 0.35],
  [rustle(r, 0.3, 120, perc(0.01, 0.28)), 0, 0.5]), M(0.3, { v: 3, cd: 90, max: 3 }));

// ---------------------------------------------------------------- spirit wolves
registerSfx('cast_dr_wolves', (r) => lay(1.8,
  [howl(r, 1.5, 560), 0, 0.8],
  [howl(r, 1.25, 700), 0.28, 0.4],
  [sparkle(r, 1.2, 10, 2200, 6500, 0.3), 0.1, 0.25]), M(0.38, { v: 2, cd: 250, verb: 0.65 }));
registerSfx('dr_wolfRelease', (r) => lay(0.7,
  [whoosh(r, 0.5, 300, 2600, 1.1), 0, 0.8],
  [amp(band(r, 0.55, glide(700, 2400, 0.5), 2, 1, 'pink'), swell(0.2, 0.3)), 0, 0.5],
  [sparkle(r, 0.5, 8, 2500, 7000, 0.2), 0.05, 0.35]), M(0.42, { v: 3, cd: 80, verb: 0.4 }));
registerSfx('dr_wolfBite', (r) => lay(0.45,
  [voice(0.24, glide(r.range(170, 210), 120, 0.2), 'a', 'e', lin(0, 0, 0.02, 1, 0.14, 0.7, 0.24, 0), r, { rough: 0.55, drive: 2.2, breath: 0.25, shift: 1.1 }), 0, 0.6],
  [click(r, 0.005, 1800), 0.05, 0.8],
  [thud(r.range(190, 230), 80, 0.07, 2), 0.05, 0.7],
  [squelch(r, 0.08), 0.055, 0.35],
  [sparkle(r, 0.3, 5, 2500, 6000, 0.15), 0.05, 0.2]), M(0.5, { ...COMBAT, cd: 50 }));

// ---------------------------------------------------------------- rain of renewal
registerSfx('cast_dr_renewal', (r) => lay(1.0,
  [osc(0.9, 'sin', 523.3, swell(0.35, 0.55)), 0, 0.22],
  [osc(0.9, 'sin', 659.3, swell(0.4, 0.5)), 0.05, 0.16],
  [osc(0.9, 'sin', 784, swell(0.45, 0.45)), 0.1, 0.12],
  [sparkle(r, 0.8, 12, 2600, 7500, 0.35), 0.05, 0.4],
  [rustle(r, 0.8, 80), 0, 0.35]), M(0.4, { v: 2, cd: 200, verb: 0.6 }));
registerSfx('dr_rain', (r) => lay(4.2,
  [rain(r, 4.1, lin(0, 0, 0.5, 1, 3.4, 0.9, 4.1, 0)), 0, 1],
  [low(r, 4.0, 500, lin(0, 0, 0.6, 0.6, 3.3, 0.5, 4.0, 0), 'pink'), 0, 0.35],
  [sparkle(r, 3.5, 14, 2000, 6000, 0.5), 0.2, 0.3]), M(0.36, { cd: 600, verb: 0.5, max: 1 }));

// ---------------------------------------------------------------- thunderstorm
registerSfx('cast_dr_storm', (r) => lay(1.0,
  [wind(r, 0.95, 200, 800, lin(0, 0, 0.3, 1, 0.95, 0), 1.6), 0, 0.9],
  [whoosh(r, 0.6, 140, 1200, 0.8), 0.05, 0.6],
  [osc(0.9, 'sin', glide(48, 38, 0.9), swell(0.5, 0.4)), 0, 0.4]), M(0.42, { v: 2, cd: 120, verb: 0.35 }));
registerSfx('dr_stormGather', (r) => lay(2.4,
  [amp(low(r, 2.3, 150, swell(0.5, 1.7), 'brown'), wander(r, 2.3, 7, 0.25, 1)), 0, 1],
  [boom(r, 1.6, 55), 0.35, 0.6],
  [wind(r, 2.2, 180, 600, swell(0.6, 1.5), 1.4), 0, 0.5],
  [crackle(1.5, r, 25, swell(0.5, 0.9)), 0.3, 0.25]), M(0.5, { cd: 400, verb: 0.55 }));
registerSfx('dr_thunder', (r) => crack(r, 1.1, r.range(70, 95)), M(0.46, { v: 4, pj: 0.08, cd: 110, max: 3, verb: 0.4 }));

