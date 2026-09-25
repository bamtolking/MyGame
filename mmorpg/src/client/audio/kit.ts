// Instrument samples for the soundtrack (pure DSP; rendered once, then played by the sequencer).
import { mk, thump, burst, partials, pluck, addMono, normalize, fadeTail, trimSilence, midiHz, type Sample } from './synth.ts';

const done = (s: Sample, peak: number): Sample => { normalize(s, peak); fadeTail(s); return trimSilence(s); };
export const DRUMS: Record<string, () => Sample> = {
  kung: () => { const s = mk(0.7); thump(s, 0, 175, 96, 0.035, 0.16, 1, 1.8); burst(s, 0, 0.08, 'lp', 900, 0.8, 0.35, 0.02, 201); return done(s, 0.85); },
  deok: () => { const s = mk(0.3); burst(s, 0, 0.06, 'bp', 2700, 2.2, 1, 0.018, 202); thump(s, 0, 760, 430, 0.01, 0.03, 0.55, 1.4); burst(s, 0, 0.005, 'hp', 5000, 0.7, 0.5, 0.0015, 203); return done(s, 0.75); },
  gi: () => { const s = mk(0.2); burst(s, 0, 0.04, 'bp', 3100, 2, 1, 0.012, 204); return done(s, 0.3); },
  deong: () => { const s = mk(0.8); thump(s, 0, 170, 92, 0.035, 0.18, 1, 1.8); burst(s, 0, 0.06, 'bp', 2600, 2.2, 0.8, 0.018, 205); burst(s, 0, 0.004, 'hp', 5000, 0.7, 0.4, 0.0015, 206); return done(s, 0.9); },
  buk: () => { const s = mk(0.9); thump(s, 0, 125, 64, 0.04, 0.24, 1, 2.2); burst(s, 0, 0.1, 'lp', 1600, 0.8, 0.45, 0.025, 207); return done(s, 0.9); },
  taiko: () => { const s = mk(1.6); thump(s, 0, 82, 39, 0.09, 0.5, 1, 2.6); burst(s, 0, 0.15, 'lp', 800, 0.8, 0.5, 0.04, 208); thump(s, 0, 210, 110, 0.02, 0.05, 0.25, 1.2); return done(s, 0.95); },
  jing: () => { const s = mk(6.5); partials(s, 0, 116, [1, 1.52, 2.15, 2.68, 3.2, 4.1, 5.3], [1, 0.75, 0.55, 0.4, 0.3, 0.2, 0.12], [4.5, 3.2, 2.4, 1.8, 1.3, 0.9, 0.7], 1, { beat: 0.55, attack: 0.05, glide: -0.012 });
    thump(s, 0, 90, 60, 0.05, 0.1, 0.25, 1.2); return done(s, 0.85); },
  kkwaeng: () => { const s = mk(0.9); partials(s, 0, 870, [1, 1.9, 2.96, 4.3, 5.8], [1, 0.8, 0.6, 0.4, 0.3], [0.45, 0.32, 0.24, 0.16, 0.1], 1, { beat: 2.5 }); burst(s, 0, 0.02, 'hp', 4000, 0.7, 0.6, 0.006, 209); return done(s, 0.55); },
  moktak: () => { const s = mk(0.25); partials(s, 0, 820, [1, 2.24], [1, 0.25], [0.055, 0.025], 1); burst(s, 0, 0.004, 'bp', 2400, 1.2, 0.5, 0.0015, 210); return done(s, 0.6); },
  shaker: () => { const s = mk(0.12); burst(s, 0, 0.1, 'hp', 6500, 0.8, 1, 0.03, 211); return done(s, 0.25); },
  bells: () => { const s = mk(0.9); for (let j = 0; j < 3; j++) for (const b of [2400, 2710, 3050]) partials(s, j * 0.035, b, [1, 2.76], [1, 0.3], [0.28, 0.12], 0.3 * (1 - j * 0.25), { pan: (b - 2710) / 700 }); return done(s, 0.4); },
};
export function gayageum(midi: number): Sample { const s = mk(2.6); addMono(s, 0, pluck(midiHz(midi), 2.6, { bright: 0.55, decay: 2.1, pos: 0.2, seed: midi * 7 })); return done(s, 0.8); }
export function geomungo(midi: number): Sample {
  const s = mk(2.2); addMono(s, 0, pluck(midiHz(midi), 2.2, { bright: 0.35, decay: 1.5, pos: 0.13, seed: midi * 13 }));
  burst(s, 0, 0.02, 'bp', 1400, 1.2, 0.35, 0.006, midi); thump(s, 0, midiHz(midi) * 2.2, midiHz(midi), 0.01, 0.05, 0.3, 1.2); return done(s, 0.85);
}
