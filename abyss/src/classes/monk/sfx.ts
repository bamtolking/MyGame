// monk: sound effects (platform/sfx registerSfx / aliasSfx).
// Fast, bright whips of air for the punches and punchy body thuds on the heavy hits; a breath-and-rush 'haa' for the
// chi wave; a temple bell over a low chant for the mantra; a rushing kick; zipping flash-steps for the seven-sided
// strike and a gong to finish it. The cast_* sounds are pre-rendered; impact sounds stay cheap (no voices).
import { COMBAT, M, aliasSfx, band, boom, click, high, low, registerSfx, sparkle, thud, whoosh } from '../../platform/sfx';
import { amp, bell, drive, glide, lay, lin, noise, osc, perc, reverse, ring, svf, swell, voice } from '../../platform/dsp';

// ---- palm strike and combo: the sim voices every punch at the strike itself
aliasSfx('cast_mk_palm', '');
aliasSfx('cast_mk_combo', '');

/** A fast punch: a short, bright whip of air and a cloth snap. */
registerSfx('mk_whiff', (r) => lay(0.22,
  [whoosh(r, 0.11, r.range(650, 850), r.range(3600, 4400), 1.6), 0, 1],
  [band(r, 0.03, r.range(1800, 2400), 2.5, perc(0.001, 0.03)), 0.05, 0.3],
  [thud(r.range(260, 300), 150, 0.03), 0.055, 0.2]), M(0.44, { ...COMBAT, cd: 28, max: 5 }));

/** The heavy third strike: deeper air and the whole body turning into it. */
registerSfx('mk_whiffHeavy', (r) => lay(0.36,
  [whoosh(r, 0.22, 240, 2600, 1.1), 0, 1],
  [low(r, 0.26, 320, swell(0.1, 0.15), 'brown'), 0, 0.5],
  [band(r, 0.04, 1500, 2, perc(0.001, 0.04)), 0.13, 0.35]), M(0.54, { ...COMBAT, cd: 40 }));

/** The finisher landing: a deep, punchy body blow. */
registerSfx('mk_thump', (r) => lay(0.5,
  [thud(r.range(92, 112), 36, 0.26, 3.2), 0, 1],
  [click(r, 0.006, 1800), 0, 0.6],
  [low(r, 0.3, 600, perc(0.002, 0.25), 'brown'), 0, 0.6],
  [band(r, 0.08, 900, 1, perc(0.001, 0.08), 'pink'), 0, 0.4]), M(0.55, { v: 3, pj: 0.05, cd: 60 }));

// ---- chi wave: breath drawn in, then a rushing release with a low push and a shimmer
registerSfx('cast_mk_wave', (r) => lay(0.95,
  [amp(band(r, 0.22, glide(450, 1500, 0.22), 1.4, 1, 'pink'), (t) => (t / 0.22) ** 2), 0, 0.35],
  [whoosh(r, 0.5, 230, 2100, 0.9), 0.17, 1],
  [thud(118, 48, 0.24, 2), 0.19, 0.75],
  [osc(0.5, 'sin', glide(230, 150, 0.45), perc(0.01, 0.45)), 0.19, 0.3],
  [sparkle(r, 0.5, 9, 2500, 6500, 0.22), 0.21, 0.35]), M(0.6, { v: 3, cd: 50, verb: 0.3 }));

// ---- mantra: a low chanted 'om', a temple bell struck as the circle blooms, light shimmering upward
registerSfx('cast_mk_mantra', (r) => lay(2.6,
  [voice(1.7, lin(0, 99, 1.5, 96), 'o', 'u', swell(0.22, 1.4), r, { rough: 0.08, breath: 0.12, vib: [4.5, 0.01] }), 0, 0.3],
  [bell(784, 2.2), 0.2, 0.5], [bell(1175, 1.8), 0.24, 0.22],
  [ring(2.4, [[392, 0.4, 2], [587, 0.2, 1.4]]), 0.2, 0.3],
  [click(r, 0.004, 3000), 0.2, 0.3],
  [sparkle(r, 1.6, 14, 2800, 8000, 0.35), 0.26, 0.3]), M(0.55, { cd: 300, verb: 0.65 }));

// ---- flying kick: push-off and a rushing whoosh; each enemy kicked lands a heavy thud
registerSfx('cast_mk_kick', (r) => lay(0.55,
  [whoosh(r, 0.34, 200, 3200, 1.1), 0, 1],
  [high(r, 0.3, 3000, swell(0.15, 0.15)), 0, 0.3],
  [band(r, 0.04, 1400, 2, perc(0.001, 0.04)), 0, 0.4],
  [thud(140, 70, 0.08), 0, 0.45]), M(0.52, { v: 3, cd: 60 }));
registerSfx('mk_kickHit', (r) => lay(0.45,
  [thud(r.range(118, 138), 44, 0.2, 3), 0, 1],
  [click(r, 0.006, 2400), 0, 0.6],
  [band(r, 0.06, r.range(700, 1000), 1.2, perc(0.001, 0.06)), 0, 0.5],
  [low(r, 0.25, 500, perc(0.002, 0.2), 'brown'), 0, 0.5]), M(0.5, { ...COMBAT, cd: 45 }));

// ---- seven-sided strike: a sharp rising zip as the monk vanishes, a zip-and-slap per flash-step, then a gong
registerSfx('cast_mk_seven', (r) => lay(0.85,
  [amp(band(r, 0.28, glide(400, 5200, 0.28), 2, 1, 'pink'), (t) => (t / 0.28) ** 3), 0, 0.6],
  [osc(0.12, 'sin', glide(1800, 400, 0.1), perc(0.001, 0.12)), 0.28, 0.3],
  [sparkle(r, 0.5, 10, 3000, 8000, 0.25), 0.26, 0.4],
  [ring(0.6, [[1318.5, 0.3, 0.5], [1976, 0.15, 0.35]]), 0.28, 0.3]), M(0.5, { v: 2, cd: 100, verb: 0.35 }));
registerSfx('mk_sevenHit', (r) => lay(0.3,
  [reverse(high(r, 0.06, 3000, perc(0.001, 0.06))), 0, 0.45],
  [whoosh(r, 0.07, 1200, 5200, 2), 0, 0.6],
  [click(r, 0.005, 2600), 0.055, 0.7],
  [thud(r.range(165, 200), 68, 0.09, 2.2), 0.055, 0.75],
  [ring(0.2, [[r.range(2200, 2600), 0.3, 0.15]]), 0.055, 0.25]), M(0.48, { v: 4, pj: 0.1, cd: 40, max: 4 }));
registerSfx('mk_gong', (r) => {
  const d = 3.2, f = r.range(106, 114);
  const body = ring(d, [[f, 1, 3], [f * 1.48, 0.7, 2.6], [f * 2.03, 0.55, 2.2], [f * 2.61, 0.5, 1.8], [f * 3.24, 0.4, 1.5], [f * 4.13, 0.3, 1.1], [f * 5.2, 0.22, 0.8], [f * 6.7, 0.15, 0.5]]);
  // the shimmer that blooms after the strike, beating slowly
  const shim = amp(ring(d, [[f * 3.02, 0.5, 2.4], [f * 3.07, 0.5, 2.4], [f * 4.5, 0.35, 1.8], [f * 4.56, 0.35, 1.8]]), (t) => Math.min(1, t / 0.35) * (0.6 + 0.4 * Math.sin(t * 7)));
  return lay(d,
    [drive(click(r, 0.012, 900), 3), 0, 0.7],
    [boom(r, 1.2, 70), 0, 0.55],
    [body, 0, 0.8], [shim, 0, 0.45],
    [svf(noise(0.6, r, perc(0.003, 0.5), 'pink'), 'bp', 1800, 0.9), 0, 0.3],
    [bell(523.3, 2.4), 0.02, 0.18]);
}, M(0.7, { cd: 300, verb: 0.6 }));
