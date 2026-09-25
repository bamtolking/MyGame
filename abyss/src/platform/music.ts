// Adaptive score. Instrument notes are synthesized offline (see dsp.ts) and cached, then sequenced
// with a look-ahead scheduler. Every dungeon track carries a combat layer (war drums + string
// ostinato) whose volume follows how many monsters are hunting the hero.
import { Rand, SR, amp, bell, buf, choirNote, drive, fade, glide, lin, mix, noise, norm, osc, perc, pluck, ring, sawHarmonics, svf, swell, table, tableOsc, VOWELS } from './dsp';

export type Music = 'none' | 'title' | 'town' | 'dungeon1' | 'dungeon2' | 'dungeon3' | 'dungeon4' | 'boss';
export type Inst = 'guitar' | 'harp' | 'bell' | 'pad' | 'choir' | 'choirO' | 'cello' | 'celloShort' | 'brass' | 'taiko' | 'tom' | 'frame' | 'hat' | 'anvil' | 'sub' | 'drip' | 'wind' | 'whisper' | 'swell';

const LO = 22050; // sample rate for soft, dark instruments
const MID = 32000;
export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Renders one note. `dur` is in seconds (only meaningful for sustained instruments). */
export function renderNote(inst: Inst, m: number, dur: number, seed: number): { data: Float32Array; sr: number } {
  const r = new Rand(seed * 7919 + m * 131 + Math.round(dur * 10));
  const f = mtof(m);
  switch (inst) {
    case 'guitar': {
      const a = pluck(f, 2.6, r, { bright: 0.45, decay: 2.4, sr: MID });
      const b = pluck(f * 1.002, 2.6, r, { bright: 0.35, decay: 2, sr: MID });
      const out = new Float32Array(a.length);
      for (let i = 0; i < out.length; i++) out[i] = a[i] * 0.7 + b[i] * 0.3;
      svf(out, 'lp', 3800, 0.7, MID);
      return { data: fade(norm(out, 0.8), 0.001, 0.3, MID), sr: MID };
    }
    case 'harp': {
      const p = pluck(f, 3.2, r, { bright: 0.3, decay: 2.8, sr: MID });
      mix(p, osc(3.2, 'sin', f, perc(0.004, 2.6), { sr: MID }), 0, 0.25, MID);
      return { data: fade(norm(p, 0.8), 0.001, 0.4, MID), sr: MID };
    }
    case 'bell': return { data: fade(norm(bell(f, 3.2, LO), 0.8), 0, 0.3, LO), sr: LO };
    case 'pad': {
      const sr = 16000, out = buf(dur, sr);
      const dark = table(sawHarmonics(f, 650, 4000), r), bright = table(sawHarmonics(f, 1300, 4000), r);
      for (const det of [-0.009, 0.001, 0.011]) tableOsc(out, dark, f * (1 + det), 0.3, { sr, phase: r.next(), tab2: bright, morph: 0.05 + r.next() * 0.05 });
      tableOsc(out, table([1]), f / 2, 0.3, { sr });
      amp(out, lin(0, 0, Math.min(2, dur * 0.3), 1, dur - Math.min(2.5, dur * 0.35), 0.9, dur, 0), sr);
      return { data: norm(out, 0.7), sr };
    }
    case 'choir': case 'choirO': {
      const out = choirNote(dur, f, inst === 'choir' ? 'a' : 'o', r);
      amp(out, lin(0, 0, Math.min(1.4, dur * 0.35), 1, dur - Math.min(1.6, dur * 0.4), 0.85, dur, 0), 16000);
      return { data: norm(out, 0.7), sr: 16000 };
    }
    case 'cello': {
      const sr = 16000, out = buf(dur, sr);
      const tab = table(sawHarmonics(f, 1100, 5000), r);
      tableOsc(out, tab, f, 0.65, { sr, vib: [5.2, 0.006], vibDelay: 0.4 });
      tableOsc(out, tab, f * 1.003, 0.35, { sr, phase: 0.3 });
      mix(out, svf(noise(0.2, r, perc(0.01, 0.15), 'pink', sr), 'bp', 900, 1, sr), 0, 0.12, sr);
      amp(out, lin(0, 0, 0.18, 1, dur - 0.4, 0.85, dur, 0), sr);
      return { data: norm(out, 0.75), sr };
    }
    case 'celloShort': {
      const d = 0.35;
      const out = osc(d, 'saw', f, 1, { sr: LO });
      mix(out, osc(d, 'saw', f * 1.003, 1, { sr: LO }), 0, 0.5, LO);
      mix(out, noise(d, r, perc(0.01, 0.12), 'pink', LO), 0, 0.15, LO);
      svf(out, 'lp', lin(0, 2400, 0.3, 700), 1.1, LO);
      amp(out, lin(0, 0, 0.012, 1, 0.12, 0.6, 0.35, 0), LO);
      return { data: norm(out, 0.75), sr: LO };
    }
    case 'brass': {
      const out = buf(dur, LO);
      for (const det of [-0.004, 0.004]) mix(out, osc(dur, 'saw', f * (1 + det), 1, { sr: LO }), 0, 0.5, LO);
      svf(out, 'lp', lin(0, 200, 0.08, 2600, 0.4, 1300, dur, 800), 1.3, LO);
      amp(out, lin(0, 0, 0.05, 1, 0.3, 0.75, dur - 0.3, 0.65, dur, 0), LO);
      return { data: drive(norm(out, 1), 1.4), sr: LO };
    }
    case 'taiko': {
      const out = buf(1.4);
      mix(out, drive(osc(1.4, 'sin', glide(f, f * 0.62, 0.3), perc(0.003, 1.2)), 1.6));
      mix(out, svf(noise(0.3, r, perc(0.001, 0.25), 'brown'), 'lp', 380), 0, 0.8);
      mix(out, svf(noise(0.02, r, perc(0.0005, 0.02)), 'bp', 2200, 1), 0, 0.3);
      return { data: norm(out, 0.9), sr: SR };
    }
    case 'tom': {
      const out = buf(0.7);
      mix(out, osc(0.7, 'sin', glide(f, f * 0.7, 0.2), perc(0.002, 0.55)));
      mix(out, svf(noise(0.15, r, perc(0.001, 0.12), 'pink'), 'bp', 600, 1), 0, 0.4);
      return { data: norm(out, 0.85), sr: SR };
    }
    case 'frame': {
      const out = buf(0.4);
      mix(out, svf(noise(0.35, r, perc(0.001, 0.25), 'pink'), 'bp', 1100, 0.8), 0, 1);
      mix(out, osc(0.2, 'sin', glide(210, 160, 0.1), perc(0.002, 0.15)), 0, 0.5);
      return { data: norm(out, 0.8), sr: SR };
    }
    case 'hat': return { data: norm(svf(noise(0.08, r, perc(0.001, 0.06)), 'hp', 7000), 0.6), sr: SR };
    case 'anvil': return { data: norm(ring(2.5, [[f, 1, 1.8], [f * 2.52, 0.7, 1.2], [f * 4.13, 0.45, 0.8], [f * 6.57, 0.25, 0.5], [f * 9.1, 0.12, 0.3]]), 0.7), sr: SR };
    case 'sub': {
      const sr = 8000;
      const out = osc(2.5, 'sin', glide(f, f * 0.7, 2), swell(0.05, 2.3), { sr });
      mix(out, svf(noise(2.5, r, swell(0.05, 2), 'brown', sr), 'lp', 120, 0.707, sr), 0, 0.5, sr);
      return { data: norm(out, 0.9), sr };
    }
    case 'drip': {
      const out = buf(0.6);
      mix(out, osc(0.06, 'sin', glide(f, f * 1.8, 0.05), perc(0.002, 0.05)));
      mix(out, ring(0.5, [[f * 2.1, 0.3, 0.4]]), 0.02, 1);
      return { data: norm(out, 0.6), sr: SR };
    }
    case 'wind': {
      const out = noise(dur, r, lin(0, 0, dur * 0.4, 1, dur, 0), 'pink', LO);
      svf(out, 'bp', (t) => 350 + 300 * Math.sin(t * 0.9) + 120 * Math.sin(t * 2.3), 3, LO);
      return { data: norm(out, 0.6), sr: LO };
    }
    case 'whisper': {
      const out = buf(dur, LO);
      const vs = ['a', 'o', 'e', 'u', 'i'];
      for (let k = 0; k < 2; k++) {
        const F = VOWELS[vs[r.int(0, 4)]];
        const n = noise(dur, r, 1, 'white', LO);
        const a = svf(n.slice(), 'bp', F[1], 7, LO), b = svf(n, 'bp', F[2], 9, LO);
        for (let i = 0; i < a.length; i++) a[i] = a[i] + b[i] * 0.6;
        mix(out, amp(a, swell(dur * 0.4, dur * 0.6), LO), r.range(0, 0.3), 0.5, LO);
      }
      return { data: norm(out, 0.5), sr: LO };
    }
    case 'swell': {
      const out = noise(dur, r, (t) => (t / dur) ** 3, 'pink', LO);
      svf(out, 'bp', glide(300, 3000, dur), 1, LO);
      return { data: fade(norm(out, 0.6), 0, 0.01, LO), sr: LO };
    }
  }
}

// ---------------------------------------------------------------- sequencing
export interface NoteOut { (inst: Inst, m: number, when: number, vol: number, o?: { dur?: number; pan?: number; layer?: 'base' | 'combat'; verb?: number }): void }

export interface TrackDef { step: number; play: (step: number, when: number, out: NoteOut, r: Rand) => void; warm: [Inst, number, number][] }

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];

/** Chord helper: triad on scale degree, returns midi notes. */
function triad(root: number, scale: number[], deg: number, oct = 0): number[] {
  const n = (d: number) => root + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7) + oct * 12;
  return [n(deg), n(deg + 2), n(deg + 4)];
}

function titleTrack(): TrackDef {
  const bar = 16, beat = 1; // 60 bpm, 16th-note grid
  const prog = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]; // Dm Bb Gm A
  const bass = [38, 34, 31, 33];
  const mel = [74, 0, 0, 72, 69, 0, 0, 0, 70, 0, 69, 0, 67, 0, 0, 0, 65, 0, 67, 69, 0, 0, 62, 0, 64, 0, 65, 0, 61, 0, 0, 0];
  return {
    step: beat / 4,
    warm: [...prog.flatMap((c) => c.map((n) => ['choir', n, beat * 8.5] as [Inst, number, number])), ...bass.map((b) => ['cello', b, beat * 8.5] as [Inst, number, number])],
    play(s, when, out) {
      const barI = Math.floor(s / bar), pos = s % bar;
      const ch = Math.floor(barI / 2) % 4;
      if (pos === 0 && barI % 2 === 0) {
        for (const n of prog[ch]) out('choir', n, when, 0.3, { dur: beat * 8.5, pan: (n % 5) / 5 - 0.4 });
        out('cello', bass[ch], when, 0.45, { dur: beat * 8.5 });
        out('taiko', 36, when, 0.6, { verb: 0.6 });
      }
      if (pos === 12 && barI % 2 === 1) out('taiko', 36, when, 0.25, { verb: 0.6 });
      if (pos % 4 === 0) { const mi = (barI % 8) * 4 + pos / 4; const n = mel[mi % mel.length]; if (n) out('bell', n, when, 0.16, { pan: 0.2, verb: 0.9 }); }
      if (pos % 2 === 0 && barI >= 2) { const c = prog[ch]; const arp = [c[0] + 12, c[1] + 12, c[2] + 12, c[1] + 12]; out('harp', arp[(pos / 2) % 4], when, 0.09, { pan: -0.3, verb: 0.7 }); }
    },
  };
}

function townTrack(): TrackDef {
  const bar = 8, beat = 60 / 76 / 2; // eighth-note grid
  const V: Record<string, number[]> = { Am: [45, 52, 57, 60, 64], G: [43, 50, 55, 59, 62], F: [41, 48, 53, 57, 60], E: [40, 47, 52, 56, 59], Dm: [38, 45, 50, 53, 57], C: [36, 43, 48, 52, 55] };
  const prog = ['Am', 'G', 'F', 'E', 'Am', 'Dm', 'E', 'Am', 'F', 'C', 'G', 'Am', 'Dm', 'Am', 'E', 'E'];
  const pat = [0, 2, 3, 4, 1, 3, 2, 4];
  // original 16-bar melody in eighths (0 = rest, -1 = hold)
  const mel = [
    76, -1, 74, 72, -1, 71, 72, -1, 74, -1, 71, -1, 67, -1, -1, -1, 69, -1, 72, -1, 71, 69, 68, -1, 71, -1, -1, -1, 0, 0, 0, 0,
    72, -1, 71, 69, -1, 67, 69, -1, 65, -1, 69, 72, 74, -1, -1, -1, 71, -1, 72, 71, 69, -1, 68, -1, 69, -1, -1, -1, 0, 0, 0, 0,
    69, -1, 72, -1, 77, -1, 76, 74, 72, -1, 76, -1, 79, -1, 76, -1, 74, -1, 72, 71, 72, -1, 74, -1, 76, -1, -1, -1, 0, 0, 0, 0,
    77, -1, 76, 74, 72, -1, 69, -1, 76, -1, 72, 69, 68, -1, 71, -1, 69, -1, 71, 72, 71, -1, 68, -1, 64, -1, -1, -1, 0, 0, 0, 0,
  ];
  return {
    step: beat,
    warm: [
      ...[...new Set(Object.values(V).flat())].map((m) => ['guitar', m, 0] as [Inst, number, number]),
      ...[0, 4, 8, 12].flatMap((b) => V[prog[b]].slice(1, 4).map((m) => ['pad', m, beat * 33] as [Inst, number, number])),
    ],
    play(s, when, out, r) {
      const barI = Math.floor(s / bar), pos = s % bar;
      const cycle = Math.floor(barI / prog.length);
      const c = V[prog[barI % prog.length]];
      const human = r.range(-0.008, 0.008);
      out('guitar', c[pat[pos]], when + human, pos === 0 ? 0.42 : 0.24 + (pos % 2 ? 0 : 0.05), { pan: -0.25 + (pat[pos] / 4) * 0.5, verb: 0.35 });
      if (pos === 0) out('cello', c[0] - 12, when, 0.22, { dur: beat * 8.2 });
      if (cycle % 2 === 1 || barI >= 8) {
        const mi = (barI % prog.length) * 8 + pos;
        const m = mel[mi % mel.length];
        if (m > 0) out(cycle % 2 === 0 ? 'harp' : 'bell', m, when, cycle % 2 === 0 ? 0.28 : 0.12, { pan: 0.25, verb: 0.6 });
      }
      if (pos === 0 && barI % 4 === 0 && cycle >= 1) for (const m of [c[1], c[2], c[3]]) out('pad', m, when, 0.1, { dur: beat * 33, pan: 0 });
      if (pos === 0 && barI % 8 === 4) out('wind', 60, when, 0.18, { dur: 9 });
    },
  };
}

interface ZoneFlavor { root: number; scale: number[]; bell: Inst; choir: Inst; drip?: boolean; tribal?: boolean; dissonant?: boolean }
const ZONE_FLAVOR: Record<string, ZoneFlavor> = {
  dungeon1: { root: 38, scale: MINOR, bell: 'bell', choir: 'choir' },
  dungeon2: { root: 36, scale: PHRYG, bell: 'bell', choir: 'choirO', drip: true },
  dungeon3: { root: 40, scale: PHRYG, bell: 'anvil', choir: 'choirO', tribal: true },
  dungeon4: { root: 33, scale: PHRYG, bell: 'bell', choir: 'choir', dissonant: true },
};

function dungeonTrack(m: Music): TrackDef {
  const z = ZONE_FLAVOR[m];
  const bar = 16, beat = 60 / 96 / 4; // 16th-note grid
  const R = z.root;
  const degs = z.dissonant ? [0, 1, 0, 4] : [0, 5, 3, 4];
  const drone = z.dissonant ? [R, R + 6] : [R, R + 7];
  const osti = z.dissonant ? [0, 0, 12, 0, 1, 0, 6, 0] : [0, 0, 7, 0, 8, 0, 7, 3];
  const phraseLen = bar * 4 * beat;
  return {
    step: beat,
    warm: [...drone.map((d) => ['pad', d, phraseLen * 1.25] as [Inst, number, number]), ...degs.flatMap((d) => triad(R + 12, z.scale, d).map((n) => [z.choir, n, phraseLen * 0.9] as [Inst, number, number]))],
    play(s, when, out, r) {
      const barI = Math.floor(s / bar), pos = s % bar;
      const phrase = Math.floor(barI / 4);
      const deg = degs[phrase % 4];
      // --- ambient base
      if (pos === 0 && barI % 4 === 0) {
        for (const d of drone) out('pad', d, when, 0.26, { dur: phraseLen * 1.25, pan: d === R ? -0.2 : 0.2 });
        const ch = triad(R + 12, z.scale, deg);
        if (z.dissonant) ch[1] = ch[0] + 1;
        if (phrase % 2 === 1 || z.dissonant) for (const n of ch) out(z.choir, n, when + beat * 4, 0.16, { dur: phraseLen * 0.9, pan: r.range(-0.5, 0.5), verb: 0.8 });
      }
      if (pos === 0 && barI % 8 === 2) out(z.bell, z.bell === 'anvil' ? R + 36 : R + 24, when, z.bell === 'anvil' ? 0.12 : 0.2, { pan: r.range(-0.6, 0.6), verb: 1 });
      if (pos === 8 && r.next() < 0.3) {
        // a short falling harp motif from the scale
        let d = r.int(7, 11);
        for (let k = 0; k < r.int(3, 5); k++) { out('harp', R + 24 + z.scale[d % 7] + 12 * Math.floor(d / 7) - 12, when + k * beat * 3, 0.1, { pan: r.range(-0.5, 0.5), verb: 0.9 }); d -= r.int(1, 2); }
      }
      if (z.drip && pos % 4 === 0 && r.next() < 0.06) out('drip', r.int(84, 96), when, 0.12, { pan: r.range(-0.8, 0.8), verb: 1 });
      if (z.tribal && pos % 4 === 0 && (pos === 0 || pos === 12 || (pos === 8 && barI % 2 === 1))) out('tom', R + 12, when, pos === 0 ? 0.22 : 0.13, { pan: -0.2, verb: 0.5 });
      if (pos === 0 && barI % 16 === 9) out('whisper', 60, when, 0.12, { dur: 4, pan: r.range(-0.7, 0.7), verb: 1 });
      if (pos === 0 && barI % 16 === 13 && z.dissonant) out('swell', 60, when, 0.18, { dur: phraseLen / 2, verb: 0.8 });
      if (pos === 0 && barI % 4 === 0 && (z.dissonant || z.tribal)) out('sub', R, when, 0.35);
      // --- combat layer (drums + strings); gain driven by intensity
      const L = { layer: 'combat' as const };
      if (pos === 0 || pos === 6 || pos === 10) out('taiko', R + 7, when, pos === 0 ? 0.7 : 0.45, { ...L, verb: 0.4 });
      if (pos === 3 || pos === 13) out('taiko', R + 12, when, 0.22, { ...L, pan: 0.3 });
      if (pos === 4 || pos === 12) out('frame', 60, when, 0.35, { ...L, pan: -0.25 });
      if (pos % 2 === 1) out('hat', 60, when, 0.08 + (pos % 4 === 3 ? 0.05 : 0), { ...L, pan: 0.35 });
      if (pos % 2 === 0) { const n = R + 12 + z.scale[deg % 7] + osti[(pos / 2) % 8]; out('celloShort', n, when, 0.3, { ...L, pan: -0.15 }); }
      if (pos === 0 && barI % 2 === 0) { const ch = triad(R + 12, z.scale, deg); for (const n of ch) out('brass', n, when, 0.14, { ...L, dur: beat * 10, pan: 0.15 }); }
    },
  };
}

function bossTrack(): TrackDef {
  const bar = 16, beat = 60 / 132 / 4;
  const R = 38; // D minor
  const prog: number[][] = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 48, 52]]; // Dm Bb C Am
  const roots = [26, 22, 24, 21];
  const osti = [0, 0, 12, 0, 7, 0, 12, 10, 0, 0, 12, 0, 8, 7, 3, 5];
  const kit = [1, 0, 0, 0.4, 0, 0, 1, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0.4];
  return {
    step: beat,
    warm: [...prog.flatMap((c) => c.map((n) => ['brass', n, beat * 28] as [Inst, number, number])), ...prog.flatMap((c) => c.map((n) => ['choir', n + 12, beat * 60] as [Inst, number, number]))],
    play(s, when, out) {
      const barI = Math.floor(s / bar), pos = s % bar;
      const ci = Math.floor(barI / 2) % 4;
      const k = kit[pos];
      if (k) out('taiko', R - 2, when, 0.75 * k, { verb: 0.35, pan: pos % 2 ? 0.2 : -0.1 });
      if (pos === 4 || pos === 12) out('frame', 60, when, 0.5, { pan: 0.2 });
      if (pos % 2 === 1) out('hat', 60, when, 0.12, { pan: -0.35 });
      out('celloShort', roots[ci] + 12 + osti[pos], when, pos % 4 === 0 ? 0.42 : 0.3, { pan: -0.2 });
      if (pos === 0 && barI % 2 === 0) for (const n of prog[ci]) out('brass', n, when, 0.2, { dur: beat * 28, pan: 0.2 });
      if (pos === 0 && barI % 4 === 0 && barI >= 4) for (const n of prog[ci]) out('choir', n + 12, when, 0.18, { dur: beat * 60, verb: 0.8 });
      if (pos === 0 && barI % 4 === 0) out('anvil', 86, when, 0.12, { verb: 0.6, pan: 0.4 });
      if (pos === 0 && barI % 8 === 0) out('sub', 30, when, 0.5);
    },
  };
}

export function trackFor(m: Music): TrackDef | null {
  if (m === 'title') return titleTrack();
  if (m === 'town') return townTrack();
  if (m === 'boss') return bossTrack();
  if (m.startsWith('dungeon')) return dungeonTrack(m);
  return null;
}
