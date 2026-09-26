// lancer: sound effects (platform/sfx registerSfx / aliasSfx).
// Sharp air-tearing thrust whooshes with a thin ring of spear steel, a rotating whirr for the sweep, electric
// charge and crackle for the javelin, a leap of rushing wind, and thunder for the dragon's landing and the storm wave.
import { COMBAT, M, aliasSfx, band, boom, click, debris, high, low, metal, registerSfx, thud, whoosh, zap } from '../../platform/sfx';
import { amp, buf, crackle, drive, glide, lay, mix, osc, perc, reverse, ring, svf, swell, wander } from '../../platform/dsp';
import { STORM, stormAt } from './shared';

const TAU = Math.PI * 2;

// ---- basic thrust: the stab itself plays 'ln_stab' from the sim at the strike
aliasSfx('cast_ln_thrust', '');
registerSfx('ln_stab', (r) => lay(0.32,
  [whoosh(r, 0.15, 650, 3900, 1.7), 0, 1],
  [high(r, 0.07, 3800, perc(0.002, 0.06)), 0.045, 0.28],
  [ring(0.22, [[r.range(3000, 3500), 0.05, 0.18], [r.range(5200, 5800), 0.03, 0.12]]), 0.06, 1]), M(0.55, { ...COMBAT, cd: 40 }));

// ---- piercing thrust: a short draw-back as the act starts, then a long air-tearing thrust with a ringing spearhead
registerSfx('cast_ln_pierce', (r) => lay(0.3,
  [reverse(high(r, 0.2, 2200, perc(0.002, 0.18))), 0, 0.35],
  [band(r, 0.22, glide(500, 1200, 0.22), 1.4, swell(0.16, 0.05), 'pink'), 0, 0.5]), M(0.3, { v: 2, cd: 50 }));
registerSfx('ln_pierce', (r) => lay(0.75,
  [whoosh(r, 0.28, 420, 4400, 1.3), 0, 1],
  [band(r, 0.3, glide(3400, 800, 0.28), 3, perc(0.003, 0.28)), 0.01, 0.45],
  [thud(r.range(160, 185), 70, 0.12, 1.8), 0.01, 0.4],
  [metal(r, 0.6, r.range(1550, 1750), 0.35), 0.03, 0.14],
  [ring(0.5, [[r.range(2600, 2900), 0.4, 0.35]]), 0.04, 0.12]), M(0.55, { v: 3, pj: 0.05, cd: 50, verb: 0.2 }));

// ---- whirling spear: a rotating whirr while winding, then a full-circle gust
registerSfx('cast_ln_sweep', (r) => {
  const d = 0.38, rate = r.range(11, 13);
  return lay(d,
    [amp(band(r, d, glide(500, 1400, d), 1.6, swell(0.28, 0.1), 'pink'), (t) => 0.35 + 0.65 * Math.max(0, Math.sin(TAU * rate * t))), 0, 0.8],
    [click(r, 0.004, 2200), 0, 0.2]);
}, M(0.32, { v: 2, cd: 60 }));
registerSfx('ln_sweep', (r) => lay(0.85,
  [whoosh(r, 0.48, 190, 2500, 0.9), 0, 1],
  [whoosh(r, 0.34, 520, 3800, 1.4), 0.12, 0.65],
  [low(r, 0.55, 240, swell(0.15, 0.38), 'brown'), 0, 0.7],
  [thud(110, 48, 0.2, 2), 0.05, 0.35],
  [ring(0.5, [[3300, 0.05, 0.4], [4900, 0.04, 0.3]]), 0.2, 1]), M(0.6, { v: 3, cd: 60, verb: 0.2 }));

// ---- lightning javelin: charge crackle, the throw, a sizzling spear flying away
registerSfx('cast_ln_javelin', (r) => {
  const d = 1.0;
  const charge = amp(zap(r, 0.32), (t) => Math.min(1, t / 0.3) ** 2);
  const hum = svf(osc(0.9, 'saw', glide(r.range(95, 110), 220, 0.3), (t) => (t < 0.3 ? (t / 0.3) ** 2 : Math.exp(-(t - 0.3) * 5))), 'bp', 900, 2);
  const tail = amp(lay(0.6, [crackle(0.6, r, 260, 1), 0, 0.9], [high(r, 0.6, 4200, 1), 0, 0.25]), (t) => Math.exp(-t * 5.5));
  return lay(d,
    [charge, 0, 0.55], [hum, 0, 0.4],
    [whoosh(r, 0.26, 320, 3800, 1.2), 0.24, 1],
    [drive(click(r, 0.008, 1400), 4), 0.3, 0.45],
    [tail, 0.3, 0.7]);
}, M(0.72, { v: 3, cd: 60, verb: 0.2 }));
registerSfx('ln_javelinHit', (r) => lay(0.4,
  [zap(r, 0.18), 0, 0.7],
  [click(r, 0.005, 3000), 0, 0.6],
  [thud(r.range(180, 210), 70, 0.1, 2), 0, 0.5],
  [crackle(0.25, r, 180, perc(0.002, 0.25)), 0, 0.4]), M(0.45, { v: 4, pj: 0.08, cd: 60, max: 3 }));
registerSfx('ln_arc', (r) => lay(0.55,
  [drive(click(r, 0.008, 1200), 4), 0, 0.6],
  [zap(r, 0.32), 0, 0.85],
  [crackle(0.4, r, 220, perc(0.002, 0.38)), 0, 0.5],
  [thud(165, 60, 0.1), 0, 0.4]), M(0.5, { v: 4, pj: 0.06, cd: 60, max: 3 }));

// ---- dragon's descent: take-off thump, rushing wind up and back down, electricity gathering on the lance
registerSfx('cast_ln_dragon', (r) => {
  const d = 0.78;
  const wind = band(r, d, (t) => 400 + 2600 * Math.sin(Math.PI * Math.min(1, t / d)), 0.9, (t) => Math.sin(Math.PI * Math.min(1, t / d)) ** 1.5, 'pink');
  const gather = amp(crackle(0.35, r, 240, 1), (t) => (t / 0.35) ** 2);
  const whistle = osc(0.4, 'sin', glide(2400, 900, 0.4), (t) => (t / 0.4) ** 2 * 0.6);
  return lay(d,
    [thud(125, 48, 0.22, 2.2), 0, 0.8],
    [whoosh(r, 0.35, 220, 3200, 0.9), 0, 0.9],
    [wind, 0, 0.55],
    [gather, 0.4, 0.45],
    [whistle, 0.36, 0.12]);
}, M(0.42, { v: 2, cd: 100, verb: 0.25 }));
/** Landing: a thunder crash, the lance ringing in the stone, debris and a long rumble. */
registerSfx('ln_dragonLand', (r) => lay(2.6,
  [drive(click(r, 0.012, 700), 6), 0, 1],
  [zap(r, 0.45), 0, 0.8],
  [boom(r, 1.5, 72), 0, 1],
  [debris(r, 1.0, 16, 500, 3200), 0.02, 0.55],
  [metal(r, 0.9, r.range(500, 540), 0.6), 0, 0.14],
  [amp(low(r, 2.3, 170, swell(0.1, 2.1), 'brown'), wander(r, 2.3, 9, 0.3, 1)), 0.05, 0.8]), M(0.9, { v: 2, cd: 120, verb: 0.45 }));

// ---- storm thrusts: nine stabs baked at the channel's thrust times over a rising electric hum
registerSfx('cast_ln_storm', (r) => {
  const d = 1.45;
  const b = buf(d);
  for (let i = 0; i <= STORM.n; i++) {
    const at = Math.max(0, stormAt(i) - 0.04);
    const last = i === STORM.n;
    mix(b, whoosh(r, last ? 0.2 : 0.11, last ? 400 : r.range(900, 1300), last ? 4200 : r.range(3600, 5200), 1.8), at, last ? 1 : 0.75);
    mix(b, click(r, 0.004, 2600), at + 0.04, 0.25);
  }
  const hum = svf(lay(1.3, [osc(1.3, 'saw', glide(82, 164, 1.2), swell(1.0, 0.3)), 0, 1], [osc(1.3, 'saw', glide(83.2, 166, 1.2), swell(1.0, 0.3)), 0, 0.8]), 'bp', glide(500, 1800, 1.2), 1.5);
  mix(b, hum, 0, 0.3);
  mix(b, amp(crackle(1.2, r, 160, 1), (t) => (t / 1.2) ** 1.5), 0.05, 0.4);
  return b;
}, M(0.58, { cd: 200, verb: 0.2 }));
/** The wave: a thunder crack that rolls away. */
registerSfx('ln_stormWave', (r) => lay(1.6,
  [drive(click(r, 0.01, 900), 5), 0, 0.9],
  [zap(r, 0.5), 0, 0.8],
  [band(r, 1.0, glide(2600, 380, 1.0), 1.2, perc(0.01, 0.9), 'pink'), 0, 0.6],
  [boom(r, 1.0, 88), 0, 0.7],
  [crackle(1.0, r, 150, perc(0.01, 0.9)), 0, 0.5]), M(0.75, { v: 2, cd: 150, verb: 0.35 }));
