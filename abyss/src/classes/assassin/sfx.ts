// assassin: sound effects (platform/sfx registerSfx / aliasSfx).
// Sharp blade "shinks", light knife throws, smoke fuse hiss + pop, dark whooshes, and the sentry's clicks and whirr.
import { COMBAT, M, aliasSfx, band, click, high, low, metal, registerSfx, squelch, thud, whoosh } from '../../platform/sfx';
import { buf, crackle, drive, glide, lay, lin, mix, osc, perc, reverse, ring, svf, swell, type Rand } from '../../platform/dsp';

/** Bright steel partials (a blade leaving its sheath / meeting flesh). */
const shing = (r: Rand, d: number, f: number): Float32Array =>
  ring(d, [[f * r.range(0.97, 1.03), 0.5, d * 0.7], [f * 1.63 * r.range(0.98, 1.02), 0.38, d * 0.5], [f * 2.41, 0.24, d * 0.32], [f * 3.37, 0.12, d * 0.2]]);

/** One small mechanical tick (ratchets, latches). */
const tick = (r: Rand, f: number): Float32Array =>
  lay(0.035, [band(r, 0.02, f * r.range(0.9, 1.1), 6, perc(0.0004, 0.018)), 0, 1], [ring(0.03, [[f * 0.62 * r.range(0.95, 1.05), 0.4, 0.02]]), 0, 0.5]);

// ---- basic: twin-claw rake — two quick crossing swipes with a thin steel ring
aliasSfx('cast_as_slash', '');
registerSfx('as_claw', (r) => lay(0.38,
  [whoosh(r, 0.13, 650, 4200, 1.6), 0, 1],
  [whoosh(r, 0.12, 900, 5400, 1.8), 0.06, 0.85],
  [shing(r, 0.22, r.range(4300, 4800)), 0.045, 0.07],
  [high(r, 0.05, 5200, perc(0.001, 0.05)), 0.065, 0.22]), M(0.42, { ...COMBAT, cd: 40 }));

// ---- venom strike: vial coat on the draw, then the thrust "shink" at the strike
registerSfx('cast_as_venom', (r) => lay(0.3,
  [squelch(r, 0.1), 0, 0.45],
  [band(r, 0.22, glide(1700, 3800, 0.18), 3, swell(0.04, 0.18)), 0, 0.45],
  [click(r, 0.004, 3000), 0, 0.3]), M(0.3, { v: 3, cd: 60 }));
registerSfx('as_stab', (r) => lay(0.55,
  [whoosh(r, 0.08, 1300, 6200, 2.2), 0, 0.8],
  [click(r, 0.004, 3600), 0.06, 0.6],
  [shing(r, 0.45, r.range(2900, 3300)), 0.065, 0.3],
  [squelch(r, 0.1), 0.07, 0.4]), M(0.6, { ...COMBAT, cd: 40 }));

// ---- throwing knives: leather rustle, then a flurry of light blade whooshes
registerSfx('cast_as_knives', (r) => {
  const b = buf(0.5);
  mix(b, band(r, 0.06, 1100, 0.9, perc(0.005, 0.05), 'pink'), 0, 0.35);
  mix(b, click(r, 0.004, 4200), 0.02, 0.35);
  for (let i = 0; i < 6; i++) mix(b, whoosh(r, 0.1, 1900, 7200, 2.4), 0.1 + i * 0.013 + r.range(0, 0.006), 0.55 - i * 0.04);
  mix(b, shing(r, 0.2, r.range(5200, 5800)), 0.1, 0.05);
  return b;
}, M(0.55, { v: 3, cd: 50 }));
registerSfx('as_knifeHit', (r) => lay(0.2,
  [ring(0.18, [[r.range(3800, 4600), 0.6, 0.1], [r.range(6500, 7200), 0.3, 0.06]]), 0, 0.35],
  [click(r, 0.003, 3000), 0, 0.8],
  [thud(r.range(240, 290), 120, 0.04), 0, 0.45]), M(0.26, { v: 4, pj: 0.08, cd: 35, max: 3 }));

// ---- smoke bomb: fuse sizzle on the throw, then a dull pop and a long hiss
registerSfx('cast_as_smoke', (r) => lay(0.32,
  [high(r, 0.28, 3600, swell(0.08, 0.2)), 0, 0.45],
  [crackle(0.28, r, 130), 0, 0.45],
  [band(r, 0.12, 900, 0.8, perc(0.01, 0.1), 'pink'), 0, 0.35]), M(0.42, { v: 2, cd: 100 }));
registerSfx('as_smokePop', (r) => lay(1.9,
  [thud(150, 45, 0.18, 2.5), 0, 0.9],
  [drive(click(r, 0.01, 800), 3), 0, 0.55],
  [low(r, 1.7, lin(0, 3200, 0.3, 1300, 1.7, 450), swell(0.03, 1.45), 'pink'), 0, 0.85],
  [high(r, 1.3, 4600, swell(0.05, 1.05)), 0.02, 0.3],
  [crackle(0.5, r, 60, perc(0.01, 0.4)), 0, 0.3]), M(0.6, { v: 2, cd: 200, verb: 0.35 }));

// ---- shadow step: a reversed rush into a dark whoosh with a sub drop; the strike is a vicious ringing slash
registerSfx('cast_as_shadow', (r) => lay(0.65,
  [reverse(band(r, 0.2, glide(3200, 400, 0.2), 1.2, perc(0.002, 0.2), 'pink')), 0, 0.75],
  [whoosh(r, 0.3, 240, 2600, 1), 0.14, 0.9],
  [osc(0.45, 'sin', glide(170, 42, 0.4), perc(0.02, 0.4)), 0.12, 0.6],
  [svf(osc(0.4, 'saw', glide(230, 110, 0.35), swell(0.1, 0.25)), 'lp', 900), 0.1, 0.18]), M(0.46, { v: 2, cd: 80, verb: 0.4 }));
registerSfx('as_shadowHit', (r) => lay(0.95,
  [whoosh(r, 0.17, 500, 5400, 1.4), 0, 0.85],
  [shing(r, 0.75, r.range(2100, 2400)), 0.05, 0.4],
  [thud(125, 38, 0.25, 2.5), 0.05, 0.8],
  [high(r, 0.15, 3000, perc(0.001, 0.15)), 0.05, 0.35]), M(0.6, { v: 3, cd: 80, verb: 0.3 }));

// ---- blade sentry: ratchet winding, a toss + clank + latch clicks + whirr spin-up, light "thwip" shots
registerSfx('cast_as_sentry', (r) => {
  const b = buf(0.45);
  let t = 0;
  for (let i = 0; i < 6; i++) { mix(b, tick(r, 3000), t, 0.75); t += 0.045 - i * 0.004; }
  mix(b, ring(0.25, [[r.range(600, 700), 0.5, 0.2], [1650, 0.3, 0.12]]), t + 0.02, 0.3);
  return b;
}, M(0.42, { v: 2, cd: 80 }));
registerSfx('as_sentryDeploy', (r) => {
  const b = lay(1.0,
    [whoosh(r, 0.16, 800, 3000, 1.4), 0, 0.4],
    [metal(r, 0.5, r.range(480, 560), 0.3), 0.2, 0.3],
    [thud(200, 90, 0.08, 2), 0.2, 0.6],
    [click(r, 0.005, 2500), 0.2, 0.6]);
  for (let i = 0; i < 3; i++) mix(b, tick(r, 3400), 0.27 + i * 0.035, 0.55);
  mix(b, svf(osc(0.6, 'saw', glide(90, 440, 0.5), swell(0.3, 0.25)), 'bp', glide(600, 2600, 0.5), 2), 0.32, 0.35);
  return b;
}, M(0.62, { v: 2, cd: 100, verb: 0.2 }));
// each shot carries a short tail of the spinning blade ring; at one shot per 0.3 s the tails join into a steady whirr
const whirr = (r: Rand, d: number): Float32Array => {
  const f = r.range(150, 175), rate = r.range(32, 40);
  return svf(osc(d, 'saw', f, (t) => (0.55 + 0.45 * Math.sin(t * Math.PI * 2 * rate)) * Math.min(1, t / 0.03) * Math.max(0, 1 - t / d)), 'bp', 1500, 1.4);
};
registerSfx('as_sentryShot', (r) => lay(0.34,
  [tick(r, 2600), 0, 0.8],
  [whoosh(r, 0.09, 1600, 6000, 2.2), 0.005, 0.7],
  [svf(osc(0.12, 'saw', glide(520, 380, 0.1), perc(0.004, 0.1)), 'bp', 1800, 2), 0, 0.25],
  [whirr(r, 0.33), 0, 0.2]), M(0.2, { v: 4, pj: 0.06, cd: 45, max: 3 }));
registerSfx('as_sentryBreak', (r) => {
  const b = lay(0.6,
    [svf(osc(0.4, 'saw', glide(400, 70, 0.35), perc(0.01, 0.35)), 'bp', glide(2000, 500, 0.35), 2), 0, 0.3],
    [metal(r, 0.4, r.range(700, 800), 0.25), 0.12, 0.2],
    [thud(160, 70, 0.08), 0.14, 0.5]);
  for (let i = 0; i < 4; i++) mix(b, tick(r, 2800), 0.02 + i * 0.03, 0.5);
  return b;
}, M(0.35, { v: 2, cd: 80 }));
