// paladin: sound effects (platform/sfx registerSfx / aliasSfx).
// Bright metallic clangs and holy chimes for the strikes, a resonant spinning 'whum' for the blessed hammer,
// a choir swell for the aura and judgment, shield bashes and a heavy landing for the charge.
// Only the cast_* sounds are pre-rendered by the game, so the impact sounds avoid the (costly) choir voices.
import { aliasSfx, boom, chord, click, debris, fireRoar, high, low, M, metal, registerSfx, sparkle, thud, whoosh, band } from '../../platform/sfx';
import { amp, bell, drive, glide, lay, osc, perc, ring, swell } from '../../platform/dsp';

const TAU = Math.PI * 2;

// ---- basic strike and zeal: the swing itself plays 'swing' from the sim at each strike
aliasSfx('cast_pl_strike', '');
aliasSfx('cast_pl_zeal', '');
/** Zeal strike landing: a bright clang with a small chime on top. */
registerSfx('pl_zealHit', (r) => lay(0.7,
  [metal(r, 0.55, r.range(1150, 1350), 0.3), 0, 0.3],
  [ring(0.5, [[r.range(1900, 2300), 0.5, 0.4], [r.range(4700, 5200), 0.25, 0.2]]), 0.004, 0.16],
  [click(r, 0.005, 2600), 0, 0.5],
  [thud(r.range(200, 240), 90, 0.07, 1.8), 0, 0.35],
  [sparkle(r, 0.45, 4, 3500, 7500, 0.15), 0.01, 0.22]), M(0.4, { v: 4, pj: 0.06, cd: 45, max: 4, verb: 0.25 }));

// ---- blessed hammer: a resonant, pulsing 'whum' as it spins away, with a ring of blessed metal
registerSfx('cast_pl_hammer', (r) => {
  const d = 1.6, rate = r.range(5, 6);
  const whum = amp(osc(d, 'sin', glide(160, 92, d), swell(0.04, 1.4)), (t) => 0.45 + 0.55 * Math.max(0, Math.sin(TAU * rate * t)));
  const sub = amp(osc(d, 'tri', glide(80, 55, d), swell(0.05, 1.2)), (t) => 0.5 + 0.5 * Math.sin(TAU * rate * t + 0.6));
  const air = amp(band(r, d, glide(900, 420, d), 2.2, swell(0.08, 1.3), 'pink'), (t) => 0.3 + 0.7 * Math.max(0, Math.sin(TAU * rate * t + 1.4)));
  return lay(d,
    [whum, 0, 0.75], [sub, 0, 0.4], [air, 0, 0.45],
    [metal(r, 1.1, r.range(500, 540), 0.9), 0, 0.22],
    [bell(1318.5, 1.2), 0.015, 0.16],
    [click(r, 0.006, 1500), 0, 0.35]);
}, M(0.55, { v: 3, cd: 60, verb: 0.35 }));
/** Hammer striking an enemy: a short, bright clank. */
registerSfx('pl_hammerHit', (r) => lay(0.45,
  [metal(r, 0.4, r.range(720, 900), 0.26), 0, 0.35],
  [thud(r.range(180, 220), 80, 0.08, 2), 0, 0.6],
  [click(r, 0.004, 3000), 0, 0.5],
  [ring(0.3, [[r.range(2400, 2700), 0.3, 0.2]]), 0, 0.28]), M(0.36, { v: 4, pj: 0.08, cd: 70, max: 3, verb: 0.2 }));

// ---- holy aura: choir swell, rising bells, a warm drone and a breath of holy fire
registerSfx('cast_pl_aura', (r) => lay(2.4,
  [bell(1318.5, 1.3), 0, 0.14], [sparkle(r, 0.4, 6, 3000, 7500, 0.2), 0, 0.18],
  // the ring igniting at the paladin's feet (the aura takes hold 0.25 s into the cast)
  [thud(120, 55, 0.35, 1.6), 0.24, 0.4], [low(r, 0.6, 700, perc(0.01, 0.5), 'pink'), 0.24, 0.3],
  [chord(r, 2.1, [261.6, 329.6, 392, 523.3], 'a', 0.35), 0, 0.7],
  [bell(784, 1.8), 0.04, 0.22], [bell(1046.5, 1.6), 0.14, 0.18], [bell(1568, 1.4), 0.24, 0.14],
  [osc(2.1, 'sin', 65.4, swell(0.3, 1.6)), 0, 0.4],
  [fireRoar(r, 1.2, swell(0.25, 0.8), 300, 1100), 0.05, 0.18],
  [sparkle(r, 1.7, 16, 2500, 8000, 0.4), 0.1, 0.3]), M(0.6, { cd: 300, verb: 0.65 }));

// ---- charge: a rush of armour and wind, shield bashes on contact, a heavy landing
registerSfx('cast_pl_charge', (r) => lay(0.65,
  [whoosh(r, 0.45, 160, 1800, 0.9), 0, 1],
  [debris(r, 0.4, 9, 2200, 5200), 0, 0.3],
  [thud(95, 50, 0.2, 2), 0, 0.5],
  [osc(0.45, 'sin', 55, swell(0.1, 0.3)), 0, 0.4]), M(0.55, { v: 2, cd: 80 }));
registerSfx('pl_shieldBash', (r) => lay(0.6,
  [metal(r, 0.55, r.range(330, 400), 0.45), 0, 0.45],
  [thud(r.range(120, 150), 45, 0.18, 2.5), 0, 0.9],
  [click(r, 0.006, 2000), 0, 0.6],
  [low(r, 0.25, 500, perc(0.002, 0.2), 'brown'), 0, 0.5]), M(0.62, { v: 3, pj: 0.06, cd: 60, max: 3, verb: 0.25 }));
registerSfx('pl_chargeImpact', (r) => lay(1.3,
  [boom(r, 1.0, 80), 0, 0.9],
  [metal(r, 1.1, 290, 0.9), 0, 0.3],
  [drive(click(r, 0.012, 600), 5), 0, 0.7],
  [debris(r, 0.8, 10, 500, 3000), 0.02, 0.5],
  [bell(587.3, 1.0), 0.02, 0.1]), M(0.78, { v: 2, cd: 100, verb: 0.35 }));

// ---- heavenly judgment: the choir rises as the sky opens; each pillar strikes like a struck bell
registerSfx('cast_pl_judgment', (r) => lay(2.6,
  // instant feedback as the weapon is raised: a bright struck chime and a rush of air upward
  [bell(1760, 1.1), 0, 0.2], [ring(0.9, [[2637, 0.5, 0.6], [3951, 0.3, 0.4]]), 0.004, 0.14],
  [whoosh(r, 0.45, 350, 3200, 1.1), 0, 0.35],
  [sparkle(r, 0.5, 8, 3500, 8500, 0.2), 0.01, 0.22],
  [chord(r, 2.3, [220, 277.2, 329.6, 440, 554.4], 'a', 0.3), 0, 0.8],
  [amp(band(r, 1.4, glide(400, 3200, 1.4), 1.2, 1, 'pink'), (t) => Math.min(1, t / 1.4) ** 2), 0, 0.22],
  [bell(880, 2), 0.18, 0.2], [bell(1318.5, 1.8), 0.34, 0.15],
  [sparkle(r, 2, 20, 3000, 9000, 0.45), 0.2, 0.28]), M(0.62, { cd: 400, verb: 0.7 }));
registerSfx('pl_pillar', (r) => lay(1.2,
  [drive(click(r, 0.01, 900), 5), 0, 0.75],
  [boom(r, 0.7, r.range(88, 100)), 0, 0.6],
  [ring(0.9, (() => { const f = r.range(740, 1050); return [[f, 1, 0.8], [f * 2.02, 0.5, 0.5], [f * 3.01, 0.3, 0.3]] as [number, number, number][]; })()), 0, 0.28],
  [high(r, 0.3, 3500, perc(0.002, 0.28)), 0, 0.32],
  [sparkle(r, 0.9, 12, 3000, 9000, 0.3), 0.01, 0.32],
  [osc(0.5, 'sin', glide(1800, 900, 0.4), perc(0.002, 0.45)), 0, 0.14]), M(0.55, { v: 3, pj: 0.05, cd: 70, max: 4, verb: 0.45 }));
registerSfx('pl_judgmentEnd', (r) => lay(2.2,
  [boom(r, 1.5, 70), 0, 0.85],
  [bell(523.3, 2), 0, 0.3], [bell(784, 1.8), 0.03, 0.25], [bell(1046.5, 1.6), 0.06, 0.2],
  [osc(1.8, 'sin', 130.8, swell(0.02, 1.6)), 0, 0.3],
  [sparkle(r, 1.6, 18, 3000, 9000, 0.4), 0, 0.3]), M(0.7, { cd: 300, verb: 0.6 }));
