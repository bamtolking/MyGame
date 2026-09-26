// Sound-effect recipes. Every sound is layered: a transient (attack), a body and a tail, then normalised to its mix level.
import { mk, whoosh, thump, burst, partials, crackle, pluck, voice, addMono, drive, normalize, fadeTail, trimSilence, Biquad, Rand, Pink, Saw, ad, swell, midiHz, TAU, SR, type Sample } from './synth.ts';
import { DRUMS } from './kit.ts';

type Recipe = () => Sample;
const fin = (s: Sample, peak: number, drv = 0, tail = 0.02): Sample => { if (drv) drive(s, drv); normalize(s, peak); fadeTail(s, tail); return trimSilence(s); };
const PENTA = [0, 2, 4, 7, 9];

export const SFX: Record<string, Recipe> = {
  // ---------------- player attacks ----------------
  slash: () => { const s = mk(0.42); whoosh(s, 0, 0.2, 500, 3200, 1.1, 0.9, -0.4, 0.4, 3); whoosh(s, 0.02, 0.18, 2500, 7000, 2, 0.35, -0.2, 0.3, 4);
    partials(s, 0.04, 2900, [1, 1.41, 1.93, 2.54], [1, 0.6, 0.45, 0.3], [0.09, 0.07, 0.06, 0.05], 0.18, { pan: 0.2 }); return fin(s, 0.62); },
  slash2: () => { const s = mk(0.4); whoosh(s, 0, 0.17, 700, 4200, 1.3, 0.9, 0.4, -0.4, 5); partials(s, 0.03, 3300, [1, 1.37, 2.1], [1, 0.5, 0.3], [0.08, 0.06, 0.05], 0.16, { pan: -0.2 }); return fin(s, 0.6); },
  hit: () => { const s = mk(0.3); burst(s, 0, 0.012, 'hp', 2500, 0.7, 0.9, 0.004, 7); burst(s, 0, 0.12, 'lp', 1400, 0.8, 0.8, 0.035, 8); thump(s, 0, 190, 58, 0.03, 0.06, 0.95, 2.2);
    return fin(s, 0.78, 1.8); },
  hit_crit: () => { const s = mk(0.55); burst(s, 0, 0.015, 'hp', 3000, 0.7, 1, 0.005, 9); burst(s, 0, 0.2, 'lp', 1800, 0.8, 0.9, 0.06, 10); thump(s, 0, 240, 50, 0.04, 0.1, 1, 2.8);
    partials(s, 0.005, 1850, [1, 1.52, 2.33, 3.1], [1, 0.7, 0.5, 0.35], [0.16, 0.12, 0.1, 0.08], 0.35); whoosh(s, 0.01, 0.2, 5000, 1200, 1.5, 0.3, 0, 0, 11); return fin(s, 0.9, 1.6); },
  hit_arrow: () => { const s = mk(0.22); burst(s, 0, 0.01, 'hp', 3500, 0.7, 0.7, 0.003, 12); burst(s, 0, 0.09, 'bp', 950, 3, 1, 0.03, 13); thump(s, 0, 380, 150, 0.02, 0.04, 0.6, 1.5); return fin(s, 0.62); },
  hit_magic: () => { const s = mk(0.6); burst(s, 0, 0.35, 'lp', 3500, 0.9, 1, 0.09, 14, 0, 380); thump(s, 0, 140, 42, 0.05, 0.12, 0.9, 2);
    const r = new Rand(15); for (let i = 0; i < 6; i++) partials(s, r.range(0, 0.15), r.range(2600, 5200), [1], [1], [0.05], 0.08, { pan: r.bi() * 0.6 }); return fin(s, 0.75, 1.4); },
  bow: () => { const s = mk(0.4); addMono(s, 0, pluck(98, 0.35, { bright: 0.8, decay: 0.25, pos: 0.08, body: false }), 0.9); whoosh(s, 0.01, 0.1, 2500, 5000, 2, 0.5, 0, 0.4, 16);
    burst(s, 0, 0.006, 'hp', 4000, 0.7, 0.5, 0.002, 17); return fin(s, 0.55); },
  cast: () => { const s = mk(0.5); const r = new Rand(18), b = new Biquad('bp', 2200, 1.2); voice(s, 0, 0.18, (t) => b.run(r.bi()) * swell(t, 0.18) * (0.6 + 0.4 * Math.sin(TAU * 32 * t)), 1.2);
    partials(s, 0.05, 1318, [1, 2, 3.01], [1, 0.4, 0.2], [0.25, 0.15, 0.1], 0.35, { pan: 0.25 }); partials(s, 0.09, 1975, [1, 2], [1, 0.3], [0.2, 0.12], 0.25, { pan: -0.25 }); return fin(s, 0.5); },
  // ---------------- class basic attacks ----------------
  thrust: () => { const s = mk(0.36); const r = new Rand(301), bp = new Biquad(), lp = new Biquad('lp', 900, 0.7); let k = 0; // air rushes forward (band + level rise to the tip), then a steel tick
    voice(s, 0, 0.18, (t) => { if ((k++ & 15) === 0) bp.set('bp', 450 * Math.pow(8, t / 0.13), 1.3); const n = r.bi(); return (bp.run(n) * 2.2 + lp.run(n) * 0.8) * (t < 0.12 ? (t / 0.12) ** 2 : Math.exp(-(t - 0.12) / 0.012)); }, 1.4, (t) => -0.3 + t * 5);
    burst(s, 0.118, 0.006, 'hp', 5000, 0.7, 0.6, 0.0015, 302, 0.35); partials(s, 0.118, 3520, [1, 1.47, 2.09, 2.83], [1, 0.6, 0.4, 0.25], [0.06, 0.045, 0.035, 0.025], 0.22, { pan: 0.35 }); return fin(s, 0.6); },
  zap: () => { const s = mk(0.4); const r = new Rand(305), hp = new Biquad('hp', 900, 0.7); let ph = 0, g = 0; // FM-warped arc buzz gated by random sparks
    voice(s, 0, 0.25, (t) => { ph += (TAU * (2400 * Math.exp(-t / 0.025) + 140)) / SR; if (r.next() < 0.004) g = r.range(0.4, 1); g *= 0.9993; return hp.run(Math.sign(Math.sin(ph + 2.5 * Math.sin(ph * 0.31))) * (0.4 + g) + r.bi() * g * 0.8) * ad(t, 0.001, 0.05); }, 0.9);
    burst(s, 0, 0.012, 'hp', 3200, 0.7, 0.8, 0.0035, 306); crackle(s, 0.004, 0.2, 350, 0.75, 307, 4200);
    partials(s, 0.03, 2960, [1, 2.76, 5.4], [1, 0.35, 0.15], [0.2, 0.1, 0.05], 0.13, { pan: 0.2 }); partials(s, 0.05, 3950, [1, 2.76], [1, 0.3], [0.14, 0.07], 0.08, { pan: -0.2 }); return fin(s, 0.5); },
  bash: () => { const s = mk(0.55); whoosh(s, 0, 0.07, 400, 1400, 0.9, 0.5, -0.2, 0.2, 310); const T = 0.03;
    thump(s, T, 160, 42, 0.03, 0.12, 1, 2.8); burst(s, T, 0.18, 'lp', 1500, 0.8, 0.9, 0.035, 311, 0, 300); burst(s, T, 0.008, 'bp', 2400, 1, 0.6, 0.002, 312);
    partials(s, T, 310, [1, 2.32, 3.87], [1, 0.5, 0.25], [0.05, 0.03, 0.02], 0.45); partials(s, T, 1180, [1, 1.51, 2.24, 2.93], [1, 0.7, 0.45, 0.3], [0.2, 0.14, 0.1, 0.07], 0.16, { beat: 3 }); // board knock + iron rim
    return fin(s, 0.74, 1.7, 0.12); },
  stab: () => { const s = mk(0.2); whoosh(s, 0, 0.075, 1300, 4200, 1.5, 0.75, -0.25, 0.25, 315);
    burst(s, 0.06, 0.03, 'bp', 1150, 2.2, 0.8, 0.007, 316, 0.1); thump(s, 0.06, 320, 150, 0.01, 0.018, 0.35, 1.3); partials(s, 0.055, 4300, [1, 1.53], [1, 0.4], [0.03, 0.02], 0.07, { pan: 0.15 }); return fin(s, 0.42); },
  musket: () => { const s = mk(0.6); const r = new Rand(320); voice(s, 0, 0.003, () => r.bi(), 1); // raw click front
    burst(s, 0, 0.04, 'hp', 900, 0.6, 1.4, 0.01, 321); burst(s, 0.001, 0.3, 'lp', 5000, 0.7, 1, 0.035, 322, 0, 500); burst(s, 0.001, 0.12, 'bp', 1800, 0.8, 1.5, 0.025, 326); burst(s, 0.001, 0.14, 'bp', 550, 0.7, 5, 0.03, 327);
    thump(s, 0, 150, 48, 0.03, 0.085, 0.8, 2.6); crackle(s, 0.02, 0.4, 160, 0.7, 323, 2300);
    burst(s, 0.085, 0.2, 'lp', 1800, 0.7, 0.3, 0.04, 324, -0.5); burst(s, 0.16, 0.2, 'lp', 1100, 0.7, 0.18, 0.05, 325, 0.5); return fin(s, 0.88, 1.6); }, // + slapback echoes
  strum: () => { const s = mk(0.6); [67, 69, 71, 74, 76].forEach((m, i) => addMono(s, i * 0.022, pluck(midiHz(m), 0.6 - i * 0.022, { bright: 0.78, decay: 0.9, pos: 0.16, seed: 330 + i }), 0.55 - i * 0.04, -0.35 + i * 0.18));
    burst(s, 0, 0.012, 'hp', 3500, 0.7, 0.25, 0.003, 336); return fin(s, 0.5); },
  brush: () => { const s = mk(0.36); stroke(s, 0, 0.3, 400, 1700, 1, -0.4, 0.4, 340); return fin(s, 0.4); },
  ink: () => { const s = mk(0.5); burst(s, 0, 0.18, 'lp', 1700, 0.9, 1, 0.045, 345, 0, 380); thump(s, 0, 210, 80, 0.02, 0.05, 0.55, 1.6); crackle(s, 0.008, 0.14, 380, 0.35, 346, 1300);
    const r = new Rand(347); for (let i = 0; i < 3; i++) drip(s, 0.11 + i * 0.09 + r.range(0, 0.03), r.range(500, 800), 0.3 * (1 - i * 0.25), r.bi() * 0.4); return fin(s, 0.5); },
  rocket: () => { const s = mk(0.56); let ph = 0; voice(s, 0, 0.075, (t) => { ph += (TAU * (3000 - 1300 * t / 0.075)) / SR; return Math.sin(ph) * swell(t, 0.075, 0.7); }, 0.22); whoosh(s, 0, 0.07, 3500, 1500, 2, 0.35, 0, 0, 350); // incoming whistle
    const T = 0.065; burst(s, T, 0.012, 'hp', 1800, 0.7, 0.9, 0.003, 351); thump(s, T, 170, 48, 0.025, 0.07, 0.85, 2.2); burst(s, T, 0.3, 'lp', 3600, 0.8, 1, 0.05, 352, 0, 500); crackle(s, T + 0.015, 0.45, 180, 1, 353, 3300);
    return fin(s, 0.72, 1.4); },
  // ---------------- talismans ----------------
  wisp_cast: () => { const s = mk(0.5); const r = new Rand(19), lp = new Biquad('lp', 1600, 0.8); let ph = 0;
    voice(s, 0, 0.35, (t) => { ph += (TAU * (140 + 260 * t / 0.35)) / SR; return lp.run(r.bi()) * swell(t, 0.35, 1.2) * (0.7 + 0.3 * Math.sin(TAU * 23 * t)) * 2.2 + Math.sin(ph) * 0.25 * swell(t, 0.35); }, 1);
    crackle(s, 0, 0.3, 60, 0.4, 20); return fin(s, 0.5); },
  wisp_boom: () => { const s = mk(0.9); burst(s, 0, 0.5, 'lp', 2600, 0.8, 1, 0.12, 21, 0, 300); thump(s, 0, 150, 40, 0.05, 0.14, 1, 2.4); crackle(s, 0.02, 0.5, 90, 0.7, 22, 2500);
    whoosh(s, 0, 0.25, 900, 300, 1, 0.4, 0, 0, 23); return fin(s, 0.72, 1.5); },
  thunder: () => { const s = mk(1.8); burst(s, 0, 0.03, 'hp', 2500, 0.6, 1, 0.012, 24); let ph = 0; const r = new Rand(25);
    voice(s, 0.005, 0.16, (t) => { ph += (TAU * (1900 * Math.exp(-t / 0.05) + 180)) / SR; return (Math.sin(ph + 3 * Math.sin(ph * 0.5)) * 0.6 + r.bi() * 0.4) * ad(t, 0.001, 0.05); }, 0.8);
    const lp = new Biquad('lp', 260, 0.7); let br = 0, am = 1;
    voice(s, 0.02, 1.7, (t) => { br = br * 0.995 + r.bi() * 0.05; if (r.next() < 0.002) am = r.range(0.5, 1.2); return lp.run(br * 8) * ad(t, 0.03, 0.45) * am; }, 1.6);
    burst(s, 0.01, 0.4, 'bp', 1200, 0.8, 0.5, 0.08, 26); return fin(s, 0.92, 1.6); },
  frost: () => { const s = mk(1.1); const r = new Rand(27);
    for (let i = 0; i < 9; i++) partials(s, r.range(0, 0.12), r.range(2200, 7200), [1, 2.76], [1, 0.3], [r.range(0.15, 0.55), 0.1], 0.18, { pan: r.bi() * 0.7 });
    burst(s, 0, 0.25, 'hp', 5500, 0.8, 0.5, 0.08, 28); whoosh(s, 0, 0.35, 3000, 900, 1.2, 0.5, -0.3, 0.3, 29); burst(s, 0, 0.02, 'hp', 3000, 1, 0.6, 0.006, 30); return fin(s, 0.62); },
  pierce: () => { const s = mk(0.4); whoosh(s, 0, 0.14, 6500, 1800, 2.2, 1, -0.6, 0.6, 31); let ph = 0; voice(s, 0, 0.18, (t) => { ph += (TAU * (1700 - 700 * t / 0.18)) / SR; return Math.sin(ph) * ad(t, 0.005, 0.06); }, 0.35);
    burst(s, 0, 0.008, 'hp', 4000, 0.7, 0.5, 0.003, 32); return fin(s, 0.55); },
  bell: () => { const s = mk(1.4); const r = new Rand(33);
    for (let j = 0; j < 4; j++) for (const base of [2350, 2640, 2960]) partials(s, j * 0.045 + r.range(0, 0.02), base * r.range(0.98, 1.02), [1, 2.76, 5.4], [1, 0.35, 0.15], [0.35, 0.18, 0.09], 0.13 * (1 - j * 0.18), { pan: r.bi() * 0.6 });
    return fin(s, 0.5); },
  guard: () => { const s = mk(1.0); let p1 = 0, p2 = 0; voice(s, 0, 0.9, (t) => { p1 += (TAU * 110) / SR; p2 += (TAU * 220.7) / SR; return (Math.sin(p1) + 0.5 * Math.sin(p2)) * ad(t, 0.12, 0.28); }, 0.8);
    const r = new Rand(34); for (let i = 0; i < 5; i++) partials(s, 0.05 + i * 0.05, r.range(3000, 5200), [1], [1], [0.18], 0.1, { pan: r.bi() * 0.5 }); whoosh(s, 0, 0.3, 400, 2400, 1, 0.3, 0, 0, 35); return fin(s, 0.55); },
  whirl: () => { const s = mk(0.7); whoosh(s, 0, 0.65, 300, 1600, 0.9, 1, -0.8, 0.8, 36); whoosh(s, 0.1, 0.5, 2400, 700, 1.6, 0.6, 0.8, -0.8, 37); return fin(s, 0.6); },
  // ---------------- kills & loot ----------------
  kill: () => { const s = mk(0.45); let ph = 0; voice(s, 0, 0.3, (t) => { ph += (TAU * (520 + 900 * (1 - Math.exp(-t / 0.08)))) / SR; return Math.sin(ph) * ad(t, 0.005, 0.07) * 0.6; }, 1);
    burst(s, 0, 0.08, 'bp', 1600, 1.2, 0.5, 0.02, 38); partials(s, 0.03, 1760, [1, 2.01], [1, 0.3], [0.12, 0.06], 0.2); return fin(s, 0.42); },
  kill_big: () => { const s = mk(1.2); thump(s, 0, 110, 38, 0.06, 0.2, 1, 2.2); burst(s, 0, 0.4, 'lp', 2200, 0.8, 0.8, 0.1, 39, 0, 400);
    partials(s, 0.02, 196, [1, 1.52, 2.15, 2.68, 3.2], [1, 0.7, 0.5, 0.35, 0.25], [0.8, 0.5, 0.35, 0.25, 0.2], 0.4, { beat: 0.7 }); whoosh(s, 0.05, 0.6, 400, 3000, 1, 0.3, 0, 0, 40); return fin(s, 0.82, 1.3); },
  soul: () => { const s = mk(0.9); let ph = 0; voice(s, 0, 0.8, (t) => { ph += (TAU * (700 + 900 * t)) / SR; return (Math.sin(ph) + 0.3 * Math.sin(ph * 2.01)) * swell(t, 0.8, 2); }, 0.35); whoosh(s, 0, 0.6, 1200, 4000, 1.5, 0.2, 0, 0, 41); return fin(s, 0.3); },
  coin: () => { const s = mk(0.4); partials(s, 0, 2637, [1, 1.5, 2.44], [1, 0.4, 0.25], [0.09, 0.06, 0.04], 0.6); partials(s, 0.045, 3951, [1, 1.33], [1, 0.4], [0.07, 0.04], 0.35); burst(s, 0, 0.004, 'hp', 5000, 0.7, 0.3, 0.001, 42); return fin(s, 0.38); },
  item: () => { const s = mk(0.9); [72, 76, 79, 84].forEach((m, i) => addMono(s, i * 0.05, pluck(midiHz(m), 0.8, { bright: 0.7, decay: 0.9, seed: 50 + i }), 0.5, (i - 1.5) * 0.2));
    partials(s, 0.2, 2093, [1, 2.76], [1, 0.3], [0.4, 0.2], 0.25); return fin(s, 0.5); },
  item_epic: () => { const s = mk(1.6); [69, 72, 76, 81, 84, 88].forEach((m, i) => addMono(s, i * 0.06, pluck(midiHz(m), 1, { bright: 0.75, decay: 1.2, seed: 60 + i }), 0.5, (i - 2.5) * 0.15));
    partials(s, 0.3, 1760, [1, 2.76, 5.4], [1, 0.35, 0.15], [0.8, 0.4, 0.2], 0.35); whoosh(s, 0, 0.5, 800, 5000, 1.2, 0.25, 0, 0, 43); return fin(s, 0.65); },
  legend: () => { const s = mk(3.2); partials(s, 0, 123, [1, 1.52, 2.15, 2.68, 3.2, 4.1], [1, 0.8, 0.6, 0.45, 0.35, 0.2], [2.4, 1.6, 1.2, 0.9, 0.7, 0.5], 0.7, { beat: 0.6, attack: 0.03, glide: -0.02 });
    [67, 71, 74, 79, 83, 86, 91].forEach((m, i) => addMono(s, 0.15 + i * 0.07, pluck(midiHz(m), 1.4, { bright: 0.8, decay: 1.6, seed: 70 + i }), 0.45, (i - 3) * 0.15));
    const r = new Rand(44); for (let i = 0; i < 14; i++) partials(s, 0.6 + r.range(0, 1.2), r.range(3000, 7000), [1], [1], [0.2], 0.08, { pan: r.bi() }); whoosh(s, 0, 1, 300, 6000, 0.8, 0.3, -0.5, 0.5, 45); return fin(s, 0.85); },
  // ---------------- progression / UI ----------------
  level: () => { const s = mk(2.8); const notes = [62, 64, 67, 69, 71, 74, 76, 79, 81, 83, 86];
    notes.forEach((m, i) => addMono(s, i * 0.045, pluck(midiHz(m), 1.2, { bright: 0.75, decay: 1.4, seed: 80 + i }), 0.42, -0.6 + i * 0.12));
    partials(s, 0.5, 147, [1, 1.52, 2.15, 2.68, 3.2], [1, 0.7, 0.5, 0.35, 0.25], [2, 1.3, 0.9, 0.7, 0.5], 0.55, { beat: 0.5, attack: 0.02 });
    const r = new Rand(46); for (let i = 0; i < 10; i++) partials(s, 0.5 + r.range(0, 0.8), r.range(3500, 6500), [1], [1], [0.18], 0.07, { pan: r.bi() }); return fin(s, 0.78); },
  quest: () => { const s = mk(1.8); [67, 71, 74, 79].forEach((m, i) => addMono(s, i * 0.09, pluck(midiHz(m), 1.2, { bright: 0.7, decay: 1.3, seed: 90 + i }), 0.5, (i - 1.5) * 0.25));
    partials(s, 0.38, 2640, [1, 2.76, 5.4], [1, 0.35, 0.15], [0.5, 0.25, 0.12], 0.3); partials(s, 0.36, 196, [1, 1.52, 2.15], [1, 0.6, 0.4], [1.2, 0.8, 0.5], 0.35, { beat: 0.6 }); return fin(s, 0.66); },
  merge: () => { const s = mk(1.2); whoosh(s, 0, 0.35, 400, 3000, 1, 0.5, -0.5, 0.5, 47); [72, 79, 84, 88].forEach((m, i) => addMono(s, 0.18 + i * 0.05, pluck(midiHz(m), 0.9, { bright: 0.8, decay: 1, seed: 100 + i }), 0.45));
    thump(s, 0.18, 200, 70, 0.03, 0.08, 0.5); return fin(s, 0.6); },
  click: () => { const s = mk(0.12); partials(s, 0, 1180, [1, 2.7], [1, 0.3], [0.03, 0.015], 0.9); burst(s, 0, 0.004, 'bp', 3000, 1, 0.4, 0.002, 48); return fin(s, 0.3); },
  open: () => { const s = mk(0.25); whoosh(s, 0, 0.16, 1500, 4500, 1.5, 1, -0.3, 0.3, 49); return fin(s, 0.22); },
  error: () => { const s = mk(0.35); const o = new Saw(); voice(s, 0, 0.28, (t) => o.next(t < 0.12 ? 220 : 175) * ad(t % 0.14, 0.005, 0.05), 0.5); return fin(s, 0.35); },
  emote: () => { const s = mk(0.3); let ph = 0; voice(s, 0, 0.2, (t) => { ph += (TAU * (700 + 1400 * t)) / SR; return Math.sin(ph) * ad(t, 0.004, 0.05); }, 1); return fin(s, 0.3); },
  cls_change: () => { const s = mk(1.5); whoosh(s, 0, 0.7, 350, 5000, 0.9, 0.35, -0.5, 0.5, 355); // rising bell arpeggio over a gliding tone, sparkles
    [72, 76, 79, 84, 88, 91].forEach((m, i) => partials(s, 0.06 + i * 0.055, midiHz(m), [1, 2.76, 5.4], [1, 0.3, 0.12], [0.32, 0.16, 0.08], 0.2 - i * 0.012, { pan: -0.5 + i * 0.2 }));
    partials(s, 0.3, 523, [1, 2, 3.01], [1, 0.35, 0.15], [0.35, 0.22, 0.15], 0.18, { attack: 0.04, glide: -0.06 });
    const r = new Rand(356); for (let i = 0; i < 12; i++) partials(s, 0.2 + r.range(0, 0.7), r.range(3500, 7500), [1], [1], [r.range(0.08, 0.2)], 0.06, { pan: r.bi() * 0.8 }); return fin(s, 0.55); },
  // ---------------- ultimates ----------------
  ult_sword: () => { const s = mk(2.2); whoosh(s, 0, 0.3, 300, 5000, 0.9, 0.7, -0.5, 0.5, 51); braam(s, 0.28, 41.2, 1.6); thump(s, 0.28, 160, 35, 0.08, 0.3, 1, 2.5);
    whoosh(s, 0.3, 0.9, 400, 2500, 0.8, 0.8, -1, 1, 52); partials(s, 0.3, 2400, [1, 1.41, 1.93], [1, 0.6, 0.4], [0.3, 0.2, 0.15], 0.25); return fin(s, 0.95, 1.4); },
  ult_archer: () => { const s = mk(2.0); for (let i = 0; i < 6; i++) addMono(s, i * 0.04, pluck(90 + i * 6, 0.3, { bright: 0.85, decay: 0.2, pos: 0.07, seed: 110 + i, body: false }), 0.4, (i - 2.5) * 0.3);
    whoosh(s, 0.1, 0.6, 1500, 7000, 1.3, 0.8, -0.8, 0.8, 53); braam(s, 0.3, 55, 1.3); thump(s, 0.3, 130, 38, 0.06, 0.25, 1, 2.4); return fin(s, 0.95, 1.3); },
  ult_shaman: () => { const s = mk(3.0); partials(s, 0.25, 110, [1, 1.52, 2.15, 2.68, 3.2, 4.1], [1, 0.8, 0.6, 0.45, 0.35, 0.2], [2.2, 1.5, 1.1, 0.8, 0.6, 0.4], 0.8, { beat: 0.8, attack: 0.02 });
    choir(s, 0, 1.4, [57, 64, 69, 72], 0.5); const r = new Rand(54); for (let j = 0; j < 5; j++) for (const b of [2350, 2800]) partials(s, 0.3 + j * 0.05, b * r.range(0.97, 1.03), [1, 2.76], [1, 0.3], [0.3, 0.15], 0.12, { pan: r.bi() });
    thump(s, 0.35, 120, 34, 0.08, 0.35, 1, 2.2); burst(s, 0.35, 0.6, 'lp', 3000, 0.8, 0.6, 0.15, 55, 0, 300); return fin(s, 0.95, 1.2); },
  ult_spear: () => { const s = mk(2.0); const r = new Rand(360), f1 = new Biquad('bp', 600, 2.5), f2 = new Biquad('bp', 1400, 3), sw = new Biquad(), o = new Saw(); let k = 0, jit = 0;
    voice(s, 0, 0.55, (t) => { if ((k++ & 15) === 0) sw.set('bp', 300 * Math.pow(10, t / 0.5), 0.8); jit = jit * 0.99 + r.bi() * 0.3; // dragon roar: growling saw + breath through a rising band
      const src = o.next(95 + 60 * t + jit * 8) * (0.6 + 0.4 * Math.sin(TAU * 31 * t)) + r.bi() * 0.5; return (f1.run(src) * 1.3 + f2.run(src) * 0.8 + sw.run(r.bi()) * 2.5) * swell(t, 0.55, 0.8); }, 1.1, (t) => -0.8 + t * 3);
    whoosh(s, 0.05, 0.45, 400, 4500, 1, 0.6, -0.6, 0.6, 361); const T = 0.4; burst(s, T, 0.02, 'hp', 2000, 0.7, 1, 0.006, 362); thump(s, T, 150, 36, 0.06, 0.26, 1, 2.6);
    partials(s, T, 98, [1, 1.52, 2.15, 2.68, 3.2, 4.1], [1, 0.8, 0.6, 0.45, 0.35, 0.2], [0.6, 0.5, 0.4, 0.32, 0.26, 0.2], 0.75, { beat: 0.7, attack: 0.008, glide: -0.015 });
    partials(s, T, 2600, [1, 1.41, 1.93, 2.62], [1, 0.6, 0.4, 0.25], [0.35, 0.25, 0.18, 0.12], 0.22); return fin(s, 0.95, 1.4, 0.4); },
  ult_taoist: () => { const s = mk(2.15); const T = 0.6; // chant of three formant voices gliding up a fourth, cut by the thunder crack
    for (const [m, p] of [[45, -0.3], [52, 0.3], [57, 0]] as [number, number][]) { const f0 = midiHz(m), o = new Saw(), fa = new Biquad('bp', 480, 5), fb = new Biquad('bp', 850, 7), fc = new Biquad('bp', 2500, 9);
      voice(s, 0, T + 0.4, (t) => { const src = o.next(f0 * Math.pow(2, (Math.min(t, T) / T) * 5 / 12) * (1 + 0.005 * Math.sin(TAU * 5.5 * t + m)));
        return (fa.run(src) * 1.3 + fb.run(src) * 0.8 + fc.run(src) * 0.3) * Math.min(1, t / 0.12) * (t < T ? 0.5 + 0.5 * t / T : Math.exp(-(t - T) / 0.06)); }, 0.55, p); }
    whoosh(s, 0.1, T - 0.05, 300, 3000, 1, 0.35, 0, 0, 365); burst(s, T, 0.03, 'hp', 2500, 0.6, 1, 0.012, 366); const r = new Rand(367); let ph = 0;
    voice(s, T + 0.004, 0.18, (t) => { ph += (TAU * (2100 * Math.exp(-t / 0.05) + 170)) / SR; return (Math.sin(ph + 3 * Math.sin(ph * 0.5)) * 0.6 + r.bi() * 0.4) * ad(t, 0.001, 0.055); }, 0.85);
    const lp = new Biquad('lp', 240, 0.7); let br = 0, am = 1; voice(s, T + 0.015, 2.15 - T - 0.02, (t) => { br = br * 0.995 + r.bi() * 0.05; if (r.next() < 0.002) am = r.range(0.5, 1.2); return lp.run(br * 8) * ad(t, 0.02, 0.38) * am; }, 1.7);
    burst(s, T, 0.4, 'bp', 1300, 0.8, 0.5, 0.08, 368); thump(s, T, 90, 30, 0.08, 0.3, 0.8, 2.2); return fin(s, 0.95, 1.5, 0.45); },
  ult_guardian: () => { const s = mk(2.15); whoosh(s, 0, 0.14, 300, 1400, 0.9, 0.5, 0, 0, 370); const T = 0.1;
    burst(s, T, 0.03, 'hp', 1500, 0.7, 0.9, 0.01, 371); thump(s, T, 95, 28, 0.08, 0.34, 1, 3); burst(s, T, 1.2, 'lp', 1300, 0.7, 1, 0.26, 372, 0, 140); crackle(s, T + 0.03, 0.9, 80, 0.8, 373, 1100); // stone wall slam
    partials(s, T, 73.4, [1, 1.52, 2.15, 2.68, 3.2, 4.1, 5.3], [1, 0.8, 0.6, 0.45, 0.35, 0.22, 0.14], [0.95, 0.75, 0.6, 0.48, 0.38, 0.3, 0.24], 0.8, { beat: 0.5, attack: 0.02, glide: -0.012 }); // deep gong
    partials(s, T + 0.02, 1320, [1, 1.51, 2.24, 2.93, 3.71], [1, 0.7, 0.5, 0.35, 0.2], [0.55, 0.42, 0.33, 0.25, 0.18], 0.24, { beat: 2.2 }); return fin(s, 0.95, 1.5, 0.5); }, // golden shield ring
  ult_assassin: () => { const s = mk(1.4); const r = new Rand(375), bp = new Biquad(), lp = new Biquad('lp', 500, 0.8); let k = 0, ph = 0; const R = 0.42;
    voice(s, 0, R, (t) => { const u = t / R; if ((k++ & 15) === 0) bp.set('bp', 250 * Math.pow(6, u), 1.1); ph += (TAU * (45 + 30 * u)) / SR; const n = r.bi(); // reversed swell of dark air + sub, cut off sharply
      return (bp.run(n) * 2 + lp.run(n) * 0.8 + Math.sin(ph) * 0.5) * u ** 3 * (u > 0.97 ? (1 - u) / 0.03 : 1); }, 1.1, (t) => Math.sin(TAU * 3 * t) * 0.6);
    for (let i = 0; i < 7; i++) { const t0 = R + i * 0.075 + r.range(0, 0.02), p = i % 2 ? 0.55 : -0.55, a = 1 - i * 0.08; // blade flurry
      whoosh(s, t0, 0.07, 1500, 6000, 1.8, 0.55 * a, -p, p, 376 + i); partials(s, t0 + 0.05, r.range(3600, 4600), [1, 1.47, 2.1], [1, 0.5, 0.3], [0.05, 0.035, 0.025], 0.1 * a, { pan: p }); burst(s, t0 + 0.05, 0.02, 'bp', 1200, 2, 0.35 * a, 0.005, 390 + i, p); }
    burst(s, R, 0.7, 'lp', 450, 0.8, 0.35, 0.2, 399); return fin(s, 0.9, 1.3); },
  ult_gunner: () => { const s = mk(2.1); const r = new Rand(400); // accelerating fuse-pop drum roll + fizz, then the volley of launches
    for (let t = 0, dt = 0.05; t < 0.3; t += dt, dt = Math.max(0.025, dt * 0.85)) thump(s, t, 150, 62, 0.018, 0.045, 0.35 + t * 1.5, 1.8);
    burst(s, 0, 0.5, 'hp', 4000, 0.7, 0.3, 0.12, 401); crackle(s, 0, 0.5, 450, 0.6, 402, 2600); thump(s, 0.08, 110, 38, 0.05, 0.2, 0.8, 2.4);
    for (let i = 0; i < 12; i++) { const t0 = 0.08 + i * 0.1 + r.range(0, 0.03), p = r.bi() * 0.7; whoosh(s, t0, 0.38, 500, 3800, 1, 0.55 * (1 - i * 0.04), p * 0.5, p, 403 + i); burst(s, t0, 0.05, 'lp', 900, 0.8, 0.35, 0.01, 420 + i, p); }
    crackle(s, 0.1, 1.5, 90, 0.25, 440, 3500); return fin(s, 0.92, 1.4); },
  ult_musician: () => { const s = mk(2.2); const deong = DRUMS.deong().l; addMono(s, 0, deong, 0.9); // janggu "deong", pentatonic glissando up, then deong + kkwaengwari on the top
    const gl = [62, 64, 67, 69, 71, 74, 76, 79, 81, 83, 86]; gl.forEach((m, i) => addMono(s, 0.06 + i * 0.042, pluck(midiHz(m), 1.4 - i * 0.04, { bright: 0.72, decay: 1.1, pos: 0.18, seed: 450 + i }), 0.65, -0.7 + i * 0.14));
    const T = 0.06 + gl.length * 0.042; addMono(s, T, deong, 1); addMono(s, T, DRUMS.kkwaeng().l, 0.45);
    [67, 74, 79].forEach((m, i) => addMono(s, T + i * 0.012, pluck(midiHz(m), 1.4, { bright: 0.7, decay: 1.2, seed: 470 + i }), 0.55, (i - 1) * 0.4)); return fin(s, 0.9); },
  ult_painter: () => { const s = mk(2.2); stroke(s, 0, 0.55, 250, 2000, 0.7, -0.8, 0.8, 480); const T = 0.42, r = new Rand(481); // big brush sweep, ink splash, tiger growl
    burst(s, T, 0.35, 'lp', 1600, 0.9, 1, 0.08, 482, 0, 300); thump(s, T, 150, 45, 0.04, 0.14, 0.9, 2.2); crackle(s, T, 0.3, 300, 0.4, 483, 1200);
    for (let i = 0; i < 4; i++) drip(s, T + 0.15 + i * 0.1 + r.range(0, 0.04), r.range(450, 750), 0.22, r.bi() * 0.6);
    const o = new Saw(), f1 = new Biquad(), f2 = new Biquad(), f3 = new Biquad('bp', 2300, 5), dry = new Biquad('lp', 1100, 0.7); let jit = 0, k = 0; // growl: the snarl opens "o" -> "a" and closes again
    voice(s, 0.4, 1.35, (t) => { const op = Math.sin(Math.PI * Math.min(1, t / 0.9)); if ((k++ & 31) === 0) { f1.set('bp', 430 + 330 * op, 3); f2.set('bp', 850 + 400 * op, 4); } jit = jit * 0.99 + r.bi() * 0.4;
      const src = o.next(55 + 30 * op + jit * 5) * (0.55 + 0.45 * Math.sin(TAU * 24 * t + Math.sin(TAU * 7 * t))) + r.bi() * 0.4;
      return (f1.run(src) * 1.5 + f2.run(src) + f3.run(src) * 0.45 + dry.run(src) * 0.35) * swell(t, 1.35, 0.5) * Math.min(1, t / 0.08); }, 3.2, 0.2);
    return fin(s, 0.92, 1.4); },
  // ---------------- danger & monsters ----------------
  boom: () => { const s = mk(1.0); thump(s, 0, 120, 36, 0.05, 0.2, 1, 2.6); burst(s, 0, 0.6, 'lp', 2400, 0.8, 1, 0.14, 56, 0, 250); crackle(s, 0.03, 0.6, 50, 0.6, 57, 1800); return fin(s, 0.85, 1.6); },
  slam: () => { const s = mk(1.8); thump(s, 0, 90, 28, 0.08, 0.4, 1, 3); burst(s, 0, 1.2, 'lp', 1400, 0.7, 1, 0.3, 58, 0, 150); crackle(s, 0.05, 1.1, 80, 0.8, 59, 1200);
    burst(s, 0, 0.03, 'hp', 1500, 0.7, 0.8, 0.01, 60); return fin(s, 0.95, 1.8); },
  roar: () => { const s = mk(1.6); const r = new Rand(61); const f1 = new Biquad('bp', 700, 3), f2 = new Biquad('bp', 1220, 4), f3 = new Biquad('bp', 2600, 5); const o = new Saw(); let jit = 0;
    voice(s, 0, 1.5, (t) => { jit = jit * 0.99 + r.bi() * 0.4; const f = 78 + 14 * Math.sin(TAU * 3 * t) + jit * 6; const src = o.next(f) * (0.7 + 0.3 * Math.sin(TAU * 27 * t)) + r.bi() * 0.35;
      return (f1.run(src) * 1.4 + f2.run(src) + f3.run(src) * 0.5 + src * 0.25) * swell(t, 1.5, 0.6); }, 1.6);
    thump(s, 0, 70, 30, 0.1, 0.4, 0.8, 2); return fin(s, 0.9, 2); },
  horn: () => { const s = mk(3.2); for (const [t0, m] of [[0, 45], [1.4, 50]] as [number, number][]) { const f0 = midiHz(m); const o = new Saw(); const lp = new Biquad('lp', 900, 1.4), pk = new Biquad('peak', 520, 1.5, 6);
    voice(s, t0, 1.5, (t) => { const f = f0 * (1 + 0.012 * Math.sin(TAU * 5 * t) * Math.min(1, t / 0.5)) * (t < 0.12 ? 0.94 + 0.5 * t : 1); return pk.run(lp.run(o.next(f))) * swell(t, 1.5, 0.5); }, 1); }
    return fin(s, 0.8, 1.3); },
  tele: () => { const s = mk(0.4); let ph = 0; voice(s, 0, 0.35, (t) => { ph += (TAU * 82) / SR; return Math.sin(ph) * (0.6 + 0.4 * Math.sin(TAU * 18 * t)) * ad(t, 0.02, 0.1); }, 1); burst(s, 0, 0.2, 'lp', 600, 0.8, 0.4, 0.06, 62); return fin(s, 0.42, 1.5); },
  enemy_shot: () => { const s = mk(0.3); whoosh(s, 0, 0.2, 1200, 400, 1.2, 1, 0, 0, 63); return fin(s, 0.3); },
  dash: () => { const s = mk(0.6); whoosh(s, 0, 0.35, 250, 900, 0.9, 1, -0.4, 0.4, 64); thump(s, 0.02, 90, 40, 0.04, 0.1, 0.7, 2); return fin(s, 0.55); },
  summon: () => { const s = mk(1.4); const b = new Biquad('bp', 900, 1.2); const o = new Saw(); voice(s, 0, 1.2, (t) => b.run(o.next(220 * Math.pow(2, t * 1.2))) * swell(t, 1.2, 1), 1.2);
    whoosh(s, 0, 1, 200, 1400, 0.8, 0.6, 0, 0, 65); return fin(s, 0.55); },
  blink: () => { const s = mk(0.6); whoosh(s, 0, 0.3, 4000, 300, 1.2, 1, 0.5, -0.5, 66); partials(s, 0, 660, [1, 1.5, 2.2], [1, 0.5, 0.3], [0.2, 0.1, 0.08], 0.4, { glide: 0.3 }); return fin(s, 0.55); },
  tp: () => { const s = mk(1.2); whoosh(s, 0, 0.8, 300, 5000, 1, 0.8, -0.4, 0.4, 67); [76, 83, 88].forEach((m, i) => partials(s, 0.3 + i * 0.08, midiHz(m), [1, 2.76], [1, 0.3], [0.35, 0.15], 0.25)); return fin(s, 0.55); },
  // ---------------- player state ----------------
  hurt: () => { const s = mk(0.4); thump(s, 0, 140, 70, 0.03, 0.08, 1, 2); burst(s, 0, 0.1, 'lp', 900, 0.8, 0.8, 0.03, 68); const f1 = new Biquad('bp', 450, 3); const o = new Saw();
    voice(s, 0.01, 0.14, (t) => f1.run(o.next(190 - 60 * t)) * swell(t, 0.14), 0.8); return fin(s, 0.65, 1.5); },
  down: () => { const s = mk(2.5); [74, 71, 69, 67, 62].forEach((m, i) => addMono(s, i * 0.13, pluck(midiHz(m), 1.2, { bright: 0.4, decay: 1.2, seed: 120 + i }), 0.5));
    partials(s, 0.6, 98, [1, 1.52, 2.15, 2.68], [1, 0.6, 0.4, 0.3], [1.5, 1, 0.7, 0.5], 0.5, { beat: 0.5, attack: 0.02 }); return fin(s, 0.62); },
  revive: () => { const s = mk(1.8); [62, 67, 69, 74, 79, 81, 86].forEach((m, i) => addMono(s, i * 0.06, pluck(midiHz(m), 1, { bright: 0.8, decay: 1.2, seed: 130 + i }), 0.45, (i - 3) * 0.2));
    whoosh(s, 0, 0.8, 300, 5000, 0.9, 0.4, 0, 0, 69); const r = new Rand(70); for (let i = 0; i < 8; i++) partials(s, 0.3 + r.range(0, 0.6), r.range(3000, 6000), [1], [1], [0.18], 0.08, { pan: r.bi() }); return fin(s, 0.65); },
};

/** Trailer-style low brass "braam": detuned saws through a closing low-pass. */
function braam(s: Sample, t0: number, f: number, dur: number): void {
  const lp = new Biquad('lp', 1800, 1.2); const osc = [new Saw(), new Saw(), new Saw(), new Saw(), new Saw()]; const det = [1, 1.004, 0.996, 2.003, 1.498]; let k = 0;
  voice(s, t0, dur, (t) => { if ((k++ & 31) === 0) lp.set('lp', 250 + 1800 * Math.exp(-t / 0.35), 1.4); let v = 0; for (let i = 0; i < 5; i++) v += osc[i].next(f * det[i]) * (i < 3 ? 1 : 0.5); return lp.run(v * 0.35) * ad(t, 0.015, dur * 0.35); }, 1);
}
/** Vowel-formant "choir" pad (for the shaman's ritual). */
function choir(s: Sample, t0: number, dur: number, midis: number[], amp: number): void {
  for (const m of midis) { const f = midiHz(m); const fa = new Biquad('bp', 730, 6), fb = new Biquad('bp', 1090, 8), fc = new Biquad('bp', 2440, 10); const o = new Saw(); const r = new Rand(m);
    voice(s, t0, dur, (t) => { const vib = 1 + 0.006 * Math.sin(TAU * 5.3 * t + m); const src = o.next(f * vib) + r.bi() * 0.05; return (fa.run(src) * 1.2 + fb.run(src) * 0.8 + fc.run(src) * 0.35) * swell(t, dur, 0.7); }, amp / midis.length * 3, (m % 5) / 5 - 0.4); }
}
/** Brush stroke on paper: noise through a band that arcs up and back down, bristle scratches on top. */
function stroke(s: Sample, t0: number, dur: number, lo: number, hi: number, amp: number, pan0: number, pan1: number, seed: number): void {
  const r = new Rand(seed), pk = new Pink(seed), bp = new Biquad(), hp = new Biquad('hp', 3600, 0.7); let k = 0, g = 0;
  voice(s, t0, dur, (t) => { const u = t / dur; if ((k++ & 15) === 0) bp.set('bp', lo + (hi - lo) * Math.sin(Math.PI * u ** 0.7), 0.85); if (r.next() < 0.025) g = r.next(); g *= 0.999;
    return (bp.run(pk.next()) * 9 + hp.run(r.bi()) * g * 0.25) * Math.sin(Math.PI * u ** 0.6) ** 1.25; }, amp, (t) => pan0 + (pan1 - pan0) * (t / dur));
}
/** Ink/water droplet: a sine "plip" whose pitch jumps up as the bubble closes. */
function drip(s: Sample, t0: number, f0: number, amp: number, pan: number): void { let ph = 0; voice(s, t0, 0.09, (t) => { ph += (TAU * f0 * (2.6 - 1.6 * Math.exp(-t / 0.012))) / SR; return Math.sin(ph) * ad(t, 0.001, 0.015); }, amp, pan); }
export { PENTA };
