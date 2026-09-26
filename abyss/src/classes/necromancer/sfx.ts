// necromancer: sound effects (platform/sfx registerSfx / aliasSfx).
// Dry bone snaps and rattles, wet squelches for the corpse blasts, breathy ghost-whispers for the incantations,
// a gritty earth-grind for the rising mage and a long toxic hiss with bubbling for the plague.
// Only the cast_* sounds are pre-rendered by the game, so the impact sounds stay cheap (noise and oscillators).
import { aliasSfx, band, bones, boom, click, debris, env3, high, low, M, registerSfx, sparkle, squelch, thud, whoosh } from '../../platform/sfx';
import { amp, drive, glide, lay, lin, mix, osc, perc, ring, swell, voice, wander } from '../../platform/dsp';

const TAU = Math.PI * 2;

// ---- bone bolt (basic): the cast is silent, the shard snaps off the wand at the release
aliasSfx('cast_nc_bolt', '');
registerSfx('nc_boltFire', (r) => lay(0.42,
  [whoosh(r, 0.18, 700, 3600, 1.6), 0, 0.8],
  [click(r, 0.005, 2200), 0, 0.5],
  [band(r, 0.03, r.range(1700, 2300), 4, perc(0.0005, 0.03)), 0, 0.6],
  [osc(0.32, 'sin', glide(r.range(880, 980), 520, 0.28), perc(0.02, 0.28), { vib: [9, 0.02] }), 0.01, 0.1]), M(0.55, { v: 4, pj: 0.06, cd: 40 }));

// ---- bone spear: bones creak together with a rising whisper, then a crack and a heavy rush of air
registerSfx('cast_nc_spear', (r) => lay(0.55,
  [bones(r, 0.4, 7), 0, 0.4],
  [amp(band(r, 0.45, glide(500, 1900, 0.45), 2, 1, 'pink'), (t) => (t / 0.45) ** 2), 0, 0.55],
  [osc(0.45, 'sin', glide(110, 170, 0.45), swell(0.35, 0.1)), 0, 0.22]), M(0.35, { v: 3, cd: 60, verb: 0.25 }));
registerSfx('nc_spearFire', (r) => lay(0.85,
  [drive(click(r, 0.01, 1200), 5), 0, 0.8],
  [whoosh(r, 0.36, 260, 3000, 1.1), 0, 0.9],
  [thud(120, 50, 0.18, 2), 0, 0.5],
  [debris(r, 0.4, 6, 1500, 4500), 0.03, 0.3],
  [osc(0.5, 'sin', glide(760, 380, 0.45), perc(0.01, 0.45), { vib: [7, 0.03] }), 0.02, 0.12]), M(0.8, { v: 3, cd: 60, verb: 0.25 }));
/** Spear punching through a body: a bone crunch. */
registerSfx('nc_spearHit', (r) => lay(0.32,
  [band(r, 0.05, r.range(1400, 2000), 3, perc(0.0006, 0.05)), 0, 0.8],
  [squelch(r, 0.12), 0.005, 0.45],
  [click(r, 0.005, 2500), 0, 0.5],
  [thud(r.range(170, 210), 80, 0.07, 2), 0, 0.4]), M(0.36, { v: 4, pj: 0.08, cd: 55, max: 3 }));

// ---- corpse explosion: a guttural whispered word, then wet blasts of gore and bone
registerSfx('cast_nc_corpse', (r) => lay(0.75,
  [voice(0.45, glide(r.range(95, 110), 80, 0.4), 'o', 'a', env3(0.05, 0.3, 0.45), r, { breath: 0.6, rough: 0.3, shift: 0.9 }), 0, 0.5],
  [amp(high(r, 0.5, 2500, swell(0.1, 0.35)), wander(r, 0.5, 30, 0.3, 1)), 0, 0.22],
  [osc(0.6, 'sin', glide(70, 45, 0.6), swell(0.15, 0.4)), 0, 0.4]), M(0.5, { v: 2, cd: 80, verb: 0.35 }));
registerSfx('nc_corpseBoom', (r) => {
  const b = lay(1.3,
    [drive(click(r, 0.012, 700), 5), 0, 0.8],
    [boom(r, 1.0, 85), 0, 0.9],
    [low(r, 0.5, lin(0, 3000, 0.4, 300), perc(0.002, 0.4), 'pink'), 0, 0.7],
    [debris(r, 0.9, 12, 1200, 4000), 0.02, 0.45]);
  for (let i = 0; i < 5; i++) mix(b, squelch(r, r.range(0.08, 0.2)), r.range(0, 0.3), 0.5);
  for (let i = 0; i < 4; i++) mix(b, osc(0.05, 'sin', glide(r.range(300, 500), 900, 0.04), perc(0.003, 0.05)), r.range(0.35, 0.9), 0.15);
  return b;
}, M(0.78, { v: 2, cd: 45, max: 4, verb: 0.3 }));

// ---- skeletal mage: a two-voice ghostly chant; the ground grinds open and bones rattle up; icy rattling shots
registerSfx('cast_nc_mage', (r) => lay(0.95,
  [voice(0.8, glide(r.range(120, 132), 100, 0.8), 'u', 'o', env3(0.15, 0.55, 0.8), r, { breath: 0.4, vib: [5, 0.03], rough: 0.15 }), 0, 0.45],
  [voice(0.8, glide(r.range(178, 190), 150, 0.8), 'o', 'u', env3(0.2, 0.55, 0.8), r, { breath: 0.5, vib: [5.5, 0.03], shift: 1.1 }), 0.05, 0.3],
  [osc(0.9, 'sin', 55, swell(0.3, 0.55)), 0, 0.35]), M(0.42, { v: 2, cd: 100, verb: 0.5 }));
registerSfx('nc_mageRise', (r) => lay(1.1,
  [drive(click(r, 0.012, 600), 4), 0, 0.6],
  [amp(low(r, 0.8, 450, swell(0.05, 0.7), 'brown'), wander(r, 0.8, 30, 0.3, 1)), 0, 0.7],
  [debris(r, 0.7, 10, 500, 2500), 0.02, 0.5],
  [bones(r, 0.8, 14), 0.15, 0.55],
  [osc(0.8, 'sin', glide(300, 420, 0.8), swell(0.4, 0.4), { vib: [6, 0.04] }), 0.1, 0.12]), M(0.65, { v: 2, cd: 100, verb: 0.35 }));
registerSfx('nc_mageShot', (r) => lay(0.45,
  [bones(r, 0.18, 3), 0, 0.3],
  [band(r, 0.3, glide(2200, 5200, 0.25), 2, swell(0.03, 0.25)), 0, 0.6],
  [sparkle(r, 0.35, 5, 3500, 8500, 0.12), 0, 0.4],
  [click(r, 0.004, 3000), 0, 0.3]), M(0.3, { v: 4, pj: 0.07, cd: 60, max: 4, verb: 0.2 }));

// ---- bone armor: a swirling storm of rattling bones that clatters shut around the body
registerSfx('cast_nc_armor', (r) => lay(0.8,
  [bones(r, 0.7, 20), 0, 0.7],
  [amp(whoosh(r, 0.6, 250, 1800, 1), (t) => 0.6 + 0.4 * Math.sin(TAU * 7 * t)), 0, 0.6],
  [osc(0.6, 'sin', glide(90, 140, 0.6), swell(0.3, 0.3)), 0, 0.3]), M(0.55, { v: 2, cd: 100, verb: 0.3 }));
registerSfx('nc_armorUp', (r) => {
  const b = lay(0.6,
    [thud(150, 70, 0.15, 2), 0.18, 0.6],
    [ring(0.4, [[r.range(900, 1000), 0.3, 0.3], [r.range(2100, 2300), 0.2, 0.2]]), 0.18, 0.25]);
  for (let i = 0; i < 6; i++) mix(b, band(r, 0.025, r.range(1500, 3000), 5, perc(0.0005, 0.025)), 0.02 + i * 0.03, 0.6);
  return b;
}, M(0.5, { v: 2, cd: 100, verb: 0.25 }));
/** Bone shards stabbing a melee attacker. */
registerSfx('nc_thorns', (r) => lay(0.26,
  [band(r, 0.04, r.range(1800, 2600), 4, perc(0.0005, 0.04)), 0, 0.8],
  [whoosh(r, 0.08, 1500, 4500, 2), 0, 0.4],
  [squelch(r, 0.08), 0.01, 0.35]), M(0.34, { v: 3, pj: 0.08, cd: 150, max: 2 }));

// ---- plague: a hissing breath and a gurgle, then the cloud bursts out with a long hiss and bubbling
registerSfx('cast_nc_plague', (r) => {
  const b = lay(0.7,
    [amp(high(r, 0.6, 1800, 1), (t) => (t / 0.6) ** 1.5 * 0.8), 0, 0.5],
    [voice(0.5, glide(90, 75, 0.5), 'a', 'o', env3(0.1, 0.35, 0.5), r, { breath: 0.8, rough: 0.5, shift: 0.8 }), 0.1, 0.35]);
  for (let i = 0; i < 5; i++) mix(b, osc(0.05, 'sin', glide(r.range(200, 350), r.range(500, 800), 0.04), perc(0.004, 0.05)), 0.15 + i * r.range(0.05, 0.09), 0.25);
  return b;
}, M(0.42, { v: 2, cd: 100, verb: 0.3 }));
registerSfx('nc_plagueBurst', (r) => {
  const d = 1.6;
  const b = lay(d,
    [low(r, d, lin(0, 5000, 0.25, 2600, d, 600), swell(0.03, 1.3), 'white'), 0, 0.7],
    [band(r, d, wander(r, d, 3, 300, 900), 0.8, swell(0.08, 1.2), 'pink'), 0, 0.5],
    [thud(110, 50, 0.2, 2), 0, 0.5],
    [squelch(r, 0.25), 0, 0.5]);
  for (let i = 0; i < 10; i++) mix(b, osc(0.06, 'sin', glide(r.range(180, 320), r.range(500, 900), 0.05), perc(0.004, 0.06)), 0.2 + r.next() * 1.2, r.range(0.12, 0.3));
  return b;
}, M(0.75, { v: 2, cd: 120, verb: 0.35 }));
