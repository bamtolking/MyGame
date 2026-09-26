// voidknight: sound effects (platform/sfx registerSfx / aliasSfx).
// Deep, dark whooshes for the greatsword, a wet rip and a rising siphon for the drain, a travelling 'vwoosh' with icy
// shimmer for the wave, whispers and a cracking eruption for the grasp, heartbeats and dark fire for the shroud,
// and for the eclipse a sucking, chanting charge that ends in a massive low boom.
// Only the cast_* sounds are pre-rendered when the class starts; the strike/impact sounds stay cheap (no voices).
// The eclipse's boom is baked into its cast sound: that act always lasts 0.7 s and strikes at 60% (0.42 s).
import { aliasSfx, band, boom, click, debris, fireRoar, high, low, M, COMBAT, registerSfx, sparkle, squelch, thud, whoosh } from '../../platform/sfx';
import { amp, buf, drive, glide, lay, mix, noise, osc, perc, reverse, ring, svf, swell, voice, wander, VOWELS, type Rand } from '../../platform/dsp';

const TAU = Math.PI * 2;
/** When the eclipse strikes, seconds after its cast begins (SkillDef timing: dur 0.7 × hitAt 0.6). */
const ECLIPSE_HIT = 0.42;

// ---------------------------------------------------------------- building blocks
/** Unvoiced formant noise gliding between two vowels, chopped into syllables: a whisper from the abyss. */
function whisper(r: Rand, d: number, env: (t: number) => number): Float32Array {
  const vs = ['a', 'e', 'i', 'o', 'u'];
  const A = VOWELS[vs[r.int(0, 4)]], B = VOWELS[vs[r.int(0, 4)]];
  const out = buf(d);
  const gains = [1, 0.55, 0.28];
  for (let f = 0; f < 3; f++) {
    const n = noise(d, r, 1, 'white');
    svf(n, 'bp', (t) => A[f] + (B[f] - A[f]) * Math.min(1, t / d), 7 + f * 3);
    mix(out, n, 0, gains[f]);
  }
  const syl = wander(r, d, 8, -0.4, 1);
  return amp(out, (t) => Math.max(0, syl(t)) ** 1.5 * env(t));
}

/** Lub-dub: two soft, deep thumps. */
function heartbeat(r: Rand, k = 1): Float32Array {
  return lay(0.7,
    [thud(64 * r.range(0.97, 1.03), 36, 0.22, 2.6), 0, k],
    [low(r, 0.12, 180, perc(0.004, 0.1), 'brown'), 0, 0.5 * k],
    [thud(56, 32, 0.26, 2.2), 0.21, 0.75 * k],
    [low(r, 0.12, 160, perc(0.004, 0.1), 'brown'), 0.21, 0.35 * k]);
}

/** Dark drone: two detuned saws low-passed, swelling over `d`. */
function voidDrone(d: number, f: number, env: (t: number) => number, cut = 500): Float32Array {
  const a = osc(d, 'saw', f, env), b = osc(d, 'saw', f * 1.012, env);
  for (let i = 0; i < a.length; i++) a[i] = (a[i] + b[i] * 0.8) * 0.5;
  return svf(a, 'lp', cut, 1.1);
}

// ---------------------------------------------------------------- basic: the greatsword cleaving (played at the strike)
aliasSfx('cast_vk_slash', '');
registerSfx('vk_swing', (r) => lay(0.6,
  [whoosh(r, 0.42, 140, 1500, 0.9), 0, 1],
  [low(r, 0.45, 230, swell(0.18, 0.25), 'brown'), 0, 0.65],
  [osc(0.4, 'sin', glide(118, 68, 0.35), swell(0.12, 0.25)), 0.02, 0.35],
  [ring(0.4, [[r.range(1350, 1550), 0.05, 0.32], [r.range(2150, 2350), 0.03, 0.2]]), 0.1, 1]), M(0.42, { ...COMBAT, cd: 40 }));

// ---------------------------------------------------------------- drain strike: a breath drawn in, then the life ripped out
registerSfx('cast_vk_drain', (r) => lay(0.55,
  [reverse(band(r, 0.34, glide(2600, 500, 0.34), 1.4, perc(0.002, 0.34), 'pink')), 0, 0.55],
  [whisper(r, 0.45, swell(0.2, 0.25)), 0.02, 0.4],
  [osc(0.4, 'sin', glide(70, 90, 0.4), swell(0.25, 0.15)), 0, 0.25]), M(0.32, { v: 3, cd: 60, verb: 0.3 }));
registerSfx('vk_drain', (r) => {
  // wet tearing bite, then a slurping siphon rising in pitch as the life flows back
  const siphon = amp(band(r, 0.6, glide(420, 2100, 0.55), 3.2, swell(0.28, 0.25), 'pink'), (t) => 0.6 + 0.4 * Math.sin(TAU * 11 * t));
  return lay(0.95,
    [squelch(r, 0.22), 0, 0.8],
    [thud(r.range(120, 140), 48, 0.15, 2.4), 0, 0.8],
    [click(r, 0.006, 2200), 0, 0.5],
    [siphon, 0.06, 0.45],
    [osc(0.55, 'sin', glide(190, 560, 0.5), swell(0.25, 0.28)), 0.08, 0.22],
    [ring(0.5, [[r.range(640, 680), 0.25, 0.4], [990, 0.12, 0.3]]), 0.42, 0.22]);
}, M(0.6, { v: 3, pj: 0.05, cd: 60, verb: 0.3 }));

// ---------------------------------------------------------------- dark wave: a rising gather, then the crescent tearing away
registerSfx('cast_vk_wave', (r) => lay(0.5,
  [amp(band(r, 0.4, glide(180, 1300, 0.4), 1.2, 1, 'pink'), (t) => (t / 0.4) ** 2), 0, 0.55],
  [osc(0.45, 'sin', glide(62, 96, 0.4), swell(0.3, 0.12)), 0, 0.35],
  [sparkle(r, 0.35, 5, 3500, 8000, 0.12), 0.1, 0.2]), M(0.34, { v: 2, cd: 60 }));
registerSfx('vk_wave', (r) => lay(1.2,
  [whoosh(r, 0.85, 110, 1400, 0.8), 0, 1],
  [voidDrone(0.95, 58, perc(0.01, 0.9), 700), 0, 0.5],
  [thud(92, 44, 0.2, 2.2), 0, 0.55],
  [high(r, 0.8, 4200, swell(0.1, 0.6)), 0.04, 0.18],
  [sparkle(r, 0.9, 14, 3200, 8500, 0.25), 0.05, 0.32],
  [ring(0.6, [[r.range(1850, 2000), 0.2, 0.45], [2900, 0.12, 0.3]]), 0.04, 0.18]), M(0.55, { v: 3, cd: 60, verb: 0.35 }));

// ---------------------------------------------------------------- abyssal grasp: whispers rising from below, then the hands erupt
registerSfx('cast_vk_grasp', (r) => lay(1.0,
  [whisper(r, 0.9, swell(0.3, 0.55)), 0, 0.7],
  [whisper(r, 0.8, swell(0.25, 0.5)), 0.12, 0.5],
  [amp(low(r, 0.9, 220, swell(0.35, 0.45), 'brown'), wander(r, 0.9, 14, 0.4, 1)), 0, 0.6],
  [osc(0.8, 'sin', glide(44, 62, 0.7), swell(0.35, 0.4)), 0, 0.4],
  [reverse(band(r, 0.3, glide(1800, 400, 0.3), 1.2, perc(0.002, 0.3), 'pink')), 0.1, 0.3]), M(0.45, { cd: 100, verb: 0.45 }));
registerSfx('vk_grasp', (r) => lay(1.4,
  [drive(click(r, 0.014, 600), 5), 0, 0.75],
  [boom(r, 0.9, 72), 0, 0.8],
  [debris(r, 0.7, 12, 400, 2600), 0.02, 0.5],
  // sinews creaking as the hands close
  [svf(osc(0.55, 'saw', wander(r, 0.55, 22, 55, 115), swell(0.12, 0.38)), 'bp', 720, 4), 0.06, 0.35],
  // the drag: a grinding rumble
  [amp(low(r, 1.1, 260, swell(0.2, 0.8), 'brown'), wander(r, 1.1, 12, 0.3, 1)), 0.08, 0.7],
  [ring(0.9, [[r.range(215, 225), 0.25, 0.7], [330, 0.12, 0.5]]), 0, 0.25]), M(0.7, { v: 2, cd: 120, verb: 0.4 }));

// ---------------------------------------------------------------- void shroud: heartbeats, dark fire kindling, whispers
registerSfx('cast_vk_shroud', (r) => {
  const b = lay(2.4,
    [reverse(band(r, 0.3, glide(2200, 300, 0.3), 1.2, perc(0.002, 0.3), 'pink')), 0, 0.4],
    [fireRoar(r, 1.4, swell(0.25, 1.1), 140, 650), 0.18, 0.5],
    [whisper(r, 1.3, swell(0.45, 0.8)), 0.12, 0.45],
    [voidDrone(2.0, 55, swell(0.35, 1.6), 420), 0, 0.45],
    [sparkle(r, 1.2, 8, 2500, 6000, 0.3), 0.25, 0.18]);
  mix(b, heartbeat(r, 1), 0.02, 0.95);
  mix(b, heartbeat(r, 1), 0.78, 0.8);
  mix(b, heartbeat(r, 1), 1.54, 0.55);
  return b;
}, M(0.55, { cd: 300, verb: 0.55 }));

// ---------------------------------------------------------------- eclipse: light sucked away, a chant, then a massive low boom
registerSfx('cast_vk_eclipse', (r) => {
  const H = ECLIPSE_HIT;
  return lay(3.6,
    // the charge: air and light sucked into the knight, a demonic chant under whispers
    [reverse(low(r, H, glide(3200, 240, H), perc(0.002, H), 'pink')), 0, 0.6],
    [voice(H + 0.15, glide(66, 98, H), 'o', 'a', swell(H * 0.9, 0.12), r, { shift: 0.7, rough: 0.35, breath: 0.25, drive: 1.6 }), 0, 0.3],
    [whisper(r, H + 0.1, swell(H * 0.8, 0.1)), 0, 0.4],
    [voidDrone(H + 0.1, 55, swell(H * 0.9, 0.08), 900), 0, 0.3],
    // the eclipse: crack, boom, sub-bass fall, blast, long rumble and a dark resonance
    [drive(click(r, 0.02, 380), 6), H, 0.9],
    [boom(r, 2.2, 56), H, 1],
    [osc(2.8, 'sin', glide(50, 25, 2.4), perc(0.01, 2.8)), H, 0.8],
    [low(r, 2.6, glide(2600, 90, 1.4), perc(0.003, 2.2), 'white'), H, 0.7],
    [amp(low(r, 3, 150, swell(0.1, 2.7), 'brown'), wander(r, 3, 8, 0.3, 1)), H + 0.05, 0.7],
    [ring(2.6, [[110, 0.4, 2.2], [164.8, 0.28, 1.8], [233.1, 0.18, 1.4]]), H, 0.3],
    [sparkle(r, 1.6, 16, 2000, 6500, 0.35), H + 0.05, 0.22]);
}, M(0.85, { cd: 400, verb: 0.6 }));
