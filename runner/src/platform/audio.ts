// Procedural WebAudio for 야식 대질주 (GDD §11.5, §5.4). No samples: every sound is synthesized here.
//  • BGM: a 16-bar step-sequencer loop per biome style (A = bars 1–8, B = bars 9–16): major-pentatonic lead,
//    bass, sine kick, noise hats, light pad, plus per-style colour (gayageum pluck + janggu rim, swing + EP comps,
//    festive sparkle arps, soft flute). Bonus = the current biome +15 BPM and a perfect fourth up with extra sparkle;
//    one calm menu loop. Notes are scheduled ~0.2 s ahead on the AudioContext clock by an internal timer (tick()
//    also pumps it). A music change hands over on the next beat (next bar between biomes) with a short crossfade.
//  • SFX: ~45 names, pitched in the key of the current music, max 6 voices (priority stealing), per-name rate limit.
//    Star-candy pickups climb a pentatonic ladder (+1 step per candy within 400 ms, 10 steps then hold, ≥45 ms apart).
//  • Mix: sfx and bgm(→duck) → master → compressor. Volume 0 means no scheduling work. Nothing here throws.

export type MusicStyle = 'market' | 'riverside' | 'bridge' | 'dawn';
export type MusicReq = { bpm: number; key: number; style?: MusicStyle } | 'bonus' | 'menu' | null;

const LOOKAHEAD = 0.22;       // s of music scheduled ahead of the audio clock
const PUMP_MS = 40;           // internal scheduler period
const MAX_VOICES = 6;         // simultaneous SFX (GDD §5.4)
const MASTER = 0.62;          // into the compressor (which adds make-up gain)
const BGM_LEVEL = 0.9;
const SFX_LEVEL = 1.0;
const JELLY_WINDOW = 0.4, JELLY_GAP = 0.045, JELLY_STEPS = 10;

const PENTA = [0, 2, 4, 7, 9];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** pentatonic index → semitones (5 = octave). Negative indexes go below the root. */
const pent = (i: number) => 12 * Math.floor(i / 5) + PENTA[((i % 5) + 5) % 5];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const curveVol = (v: number) => Math.pow(v, 1.5);   // perceptual slider curve

// ------------------------------------------------------------------------------------------------ pattern data
interface Chord { r: number; q: number }             // root (semitones above the key), q = 1 for minor
interface Line { idx: Int8Array; len: Uint8Array }  // 32 steps (2 bars) of pentatonic indexes
interface BassPat { note: Int8Array; len: Uint8Array }
type LeadKind = 'pluck' | 'ocarina' | 'bright' | 'flute' | 'box';
type SnareKind = 'snare' | 'clap' | 'brush';
type Pair<T> = [T, T];                               // [section A, section B]

interface StyleDef {
  swing8: number; swing16: number;                   // off-beat position (0.5 = straight)
  chords: Pair<Chord[]>; mel: Pair<Line[]>;
  lead: LeadKind; leadVol: number; leadOct: number;
  bass: Pair<BassPat>; bassVol: number; bassGate: number;
  kick: Pair<Uint8Array>; kickVol: number;
  snare: Pair<Uint8Array>; snareVol: number; snareKind: SnareKind;
  hat: Pair<Uint8Array>; hatVol: number;
  rim: Pair<Uint8Array> | null; rimVol: number;
  comp: Pair<Uint8Array> | null; compVol: number;
  arp: Pair<number>; arpVol: number;
  pad: number; fill: boolean;
}
interface StyleSrc {
  swing8?: number; swing16?: number;
  chords: Pair<string>; mel: Pair<string[]>;
  lead: LeadKind; leadVol: number; leadOct?: number;
  bass: Pair<string>; bassVol: number; bassGate?: number;
  kick: Pair<string>; kickVol: number;
  snare: Pair<string>; snareVol: number; snareKind?: SnareKind;
  hat: Pair<string>; hatVol: number;
  rim?: Pair<string>; rimVol?: number;
  comp?: Pair<string>; compVol?: number;
  arp?: Pair<number>; arpVol?: number;
  pad: number; fill?: boolean;
}

const REST = -128;
// melody letters: d r m s l = do re mi sol la, capitals one octave up, 3 5 6 = low mi/sol/la; '-' holds, '.' rests
const NOTE: Record<string, number> = { '3': -3, '5': -2, '6': -1, d: 0, r: 1, m: 2, s: 3, l: 4, D: 5, R: 6, M: 7, S: 8, L: 9 };
const BASS: Record<string, number> = { R: 1, F: 2, O: 3, L: 4, T: 5 };   // root, fifth, octave, low fifth, third
const ROMAN: Record<string, Chord> = { I: { r: 0, q: 0 }, ii: { r: 2, q: 1 }, iii: { r: 4, q: 1 }, IV: { r: 5, q: 0 }, V: { r: 7, q: 0 }, vi: { r: 9, q: 1 } };

const fit = (src: string, n: number) => (src.replace(/\s+/g, '') + '.'.repeat(n)).slice(0, n);
function parseLine(src: string): Line {
  const s = fit(src, 32); const idx = new Int8Array(32).fill(REST); const len = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const v = NOTE[s[i]]; if (v === undefined) continue;
    let l = 1; while (i + l < 32 && s[i + l] === '-') l++;
    idx[i] = v; len[i] = l;
  }
  return { idx, len };
}
function parseBass(src: string): BassPat {
  const s = fit(src, 16); const note = new Int8Array(16); const len = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const v = BASS[s[i]]; if (!v) continue;
    let l = 1; while (i + l < 16 && s[i + l] === '-') l++;
    note[i] = v; len[i] = l;
  }
  return { note, len };
}
const parseHits = (src: string) => Uint8Array.from(fit(src, 16), ch => ch === 'x' ? 1 : ch === 'o' ? 2 : 0);
function parseChords(src: string): Chord[] {
  const a = src.trim().split(/\s+/).map(x => ROMAN[x] ?? ROMAN.I);
  while (a.length < 8) a.push(ROMAN.I);
  return a.slice(0, 8);
}
const pair = <A, B>(p: Pair<A>, f: (x: A) => B): Pair<B> => [f(p[0]), f(p[1])];
function style(s: StyleSrc): StyleDef {
  return {
    swing8: s.swing8 ?? 0.5, swing16: s.swing16 ?? 0.5,
    chords: pair(s.chords, parseChords), mel: pair(s.mel, ls => [0, 1, 2, 3].map(i => parseLine(ls[i] ?? ''))),
    lead: s.lead, leadVol: s.leadVol, leadOct: s.leadOct ?? 0,
    bass: pair(s.bass, parseBass), bassVol: s.bassVol, bassGate: s.bassGate ?? 0.8,
    kick: pair(s.kick, parseHits), kickVol: s.kickVol,
    snare: pair(s.snare, parseHits), snareVol: s.snareVol, snareKind: s.snareKind ?? 'snare',
    hat: pair(s.hat, parseHits), hatVol: s.hatVol,
    rim: s.rim ? pair(s.rim, parseHits) : null, rimVol: s.rimVol ?? 0,
    comp: s.comp ? pair(s.comp, parseHits) : null, compVol: s.compVol ?? 0,
    arp: s.arp ?? [0, 0], arpVol: s.arpVol ?? 0,
    pad: s.pad, fill: s.fill ?? true,
  };
}

// Each section is 8 bars = four 2-bar lines; the chord list gives one chord per bar.
const STYLES: Record<MusicStyle | 'menu', StyleDef> = {
  // 야시장 골목 — bouncy 150 BPM, gayageum-like plucked lead, oom-pah bass, janggu '덕' rim clicks
  market: style({
    swing16: 0.54,
    chords: ['I vi IV V I vi V I', 'IV V iii vi ii V I V'],
    mel: [
      ['s-s-l-s-M-R-D--- l-l-D-l-s-m-s---', 'l-l-D-l-s-m-r--- s-s-l-s-r---.-5-', 's-s-l-s-M-R-D--- l-l-D-l-s-m-s---', 'r-r-m-s-l-s-m-r- d---m-s-d-------'],
      ['D-.-D-l-D-R-M--- R-.-R-D-R-S-M---', 'M-M-R-M-S-M-R--- D-D-l-D-M-D-l---', 'r-r-l-r-D-l-r--- s-s-r-s-l-s-R---', 'M-R-D-l-s-m-s--- r-m-s-l-D-R-M-R-'],
    ],
    lead: 'pluck', leadVol: 0.2,
    bass: ['R-..F-..R-..F-O-', 'R-.RF-..R-.RO-F-'], bassVol: 0.2, bassGate: 0.75,
    kick: ['x.......x.......', 'x.....x.x.......'], kickVol: 0.5,
    snare: ['....x.......x...', '....x.......x..x'], snareVol: 0.15,
    hat: ['..x...x...x...x.', 'x.x.x.x.x.x.x.xx'], hatVol: 0.05,
    rim: ['...x......x..x..', '...x..x...x..x.x'], rimVol: 0.07,
    arp: [0, 2], arpVol: 0.022, pad: 0.03,
  }),
  // 포장마차 강변 — laid-back 140 BPM swing, ocarina lead an octave lower, electric-piano off-beat comps, brushes
  riverside: style({
    swing8: 0.62,
    chords: ['I vi ii V I vi ii V', 'IV I ii V IV I V I'],
    mel: [
      ['m---s-l-s---m--- d---m-s-m-------', 'l---s-m-r------- r---m-s-l-s---m-', 'm---s-l-s---m--- d---m-s-m-------', 'l---D-l-s---m--- r-m-s---r-------'],
      ['D---l-D-R---D--- l---s-m-s-------', 'l-s-l-D-l---s--- r---m-s-r-------', 'D---l-D-R-M-D--- l-s-m---d-------', 'r-m-s-l-s---r--- d-----------m-s-'],
    ],
    lead: 'ocarina', leadVol: 0.15, leadOct: -12,
    bass: ['R---F---R-O-F---', 'R---T---F---O-F-'], bassVol: 0.2, bassGate: 0.85,
    kick: ['x.......x.....x.', 'x.....x.x.....x.'], kickVol: 0.42,
    snare: ['....x.......x...', '....x.......x...'], snareVol: 0.13, snareKind: 'brush',
    hat: ['x.x.x.o.x.x.x.o.', 'x.x.x.o.x.x.x.ox'], hatVol: 0.04,
    comp: ['......x.......x.', '..x...x...x...x.'], compVol: 0.035,
    pad: 0.028,
  }),
  // 불꽃놀이 다리 — bright festive 156 BPM, square lead with an octave sheen, octave-pumping bass, sparkle arps
  bridge: style({
    chords: ['I V vi IV I V IV V', 'IV V I vi IV V I I'],
    mel: [
      ['d-m-s-D-.-s-D-M- R---s-r-s-------', 'l-s-l-D-M-D-l--- D---l-s-l-------', 'd-m-s-D-.-s-D-M- R---s-r-s-------', 'D-l-D-M-R-D-l-s- r-m-s-l-s---.---'],
      ['D---l-D-M---D-l- R---D-R-S---R---', 'M-R-D-R-M---S--- M-R-D-l-D-------', 'D-l-D-M-D-l-s--- r-m-s-l-s-l-D-R-', 'M---D---s---D--- d-s-D-----------'],
    ],
    lead: 'bright', leadVol: 0.11,
    bass: ['R-O-R-O-R-O-R-O-', 'R-O-R-O-F-O-R-OR'], bassVol: 0.19, bassGate: 0.6,
    kick: ['x...x...x...x...', 'x...x...x...x...'], kickVol: 0.46,
    snare: ['....x.......x...', '....x.......x...'], snareVol: 0.15, snareKind: 'clap',
    hat: ['x.o.x.o.x.o.x.o.', 'xxoxxxoxxxoxxxox'], hatVol: 0.04,
    arp: [2, 1], arpVol: 0.022, pad: 0.028,
  }),
  // 새벽 지붕길 — gentle 132 BPM, soft flute lead with long notes, big pad, sparse kick, shaker, music-box sparkle
  dawn: style({
    swing8: 0.56,
    chords: ['I IV vi V I IV V I', 'vi IV I V ii IV V V'],
    mel: [
      ['m-------s---m-r- d-------l---s---', 'd---r-m-r------- r-------m---r---', 'm-------s---m-r- d-------l---s---', 'r---m-s-l---s--- m-------d-------'],
      ['l-------s---m--- s-------l---D---', 'm-------r---d--- r-----------m-r-', 'l---s-m-r------- l---D-l-s-------', 'r---m---s---l--- s---------------'],
    ],
    lead: 'flute', leadVol: 0.13,
    bass: ['R-------F-------', 'R-------R---F---'], bassVol: 0.17, bassGate: 0.9,
    kick: ['x...............', 'x.......x.......'], kickVol: 0.36,
    snare: ['................', '........x.......'], snareVol: 0.09, snareKind: 'brush',
    hat: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'], hatVol: 0.028,
    arp: [0, 2], arpVol: 0.02, pad: 0.048, fill: false,
  }),
  // menu — calm 100 BPM in A, music-box lead, pad, a shaker and (B only) a soft kick
  menu: style({
    swing8: 0.56,
    chords: ['I vi IV V I vi IV I', 'IV V iii vi IV V I I'],
    mel: [
      ['s---m---D---s--- l---D---M---D---', 'D---l---s---m--- r---m---s-------', 's---m---D---s--- l---D---M---D---', 'D---l---s---r--- d---------------'],
      ['l-------s---l--- s-------r-------', 'm-------s---m--- l-------D-------', 'D---l---s---l--- s---r---s---l---', 's-------m---r--- d---------------'],
    ],
    lead: 'box', leadVol: 0.13,
    bass: ['R-------F-------', 'R-------F---O---'], bassVol: 0.15, bassGate: 0.9,
    kick: ['................', 'x...............'], kickVol: 0.3,
    snare: ['................', '................'], snareVol: 0,
    hat: ['..x...x...x...x.', '..x...x...x...x.'], hatVol: 0.022,
    arp: [0, 2], arpVol: 0.016, pad: 0.048, fill: false,
  }),
};
const STYLE_BPM: [number, MusicStyle][] = [[150, 'market'], [140, 'riverside'], [156, 'bridge'], [132, 'dawn']];
const inferStyle = (bpm: number): MusicStyle => STYLE_BPM.reduce((b, x) => Math.abs(x[0] - bpm) < Math.abs(b[0] - bpm) ? x : b)[1];
/** tonic MIDI note for the music, kept in F#2..F3 whatever the key */
const tonic = (key: number) => { const k = ((Math.round(key) % 12) + 12) % 12; return 48 + ((k + 6) % 12) - 6; };

// ------------------------------------------------------------------------------------------------ SFX table
/** name → [priority (0 lowest … 3), min gap between plays in s]. Anything not listed is ignored by play(). */
const SFX: Record<string, [number, number]> = {
  jump: [1, 0.04], jump2: [1, 0.04], slide: [0, 0.12], fastfall: [1, 0.12], land: [0, 0.09],
  jelly: [0, 0], big: [1, 0.05], coin: [0, 0.045], letter: [2, 0.08], potion: [1, 0.1], miniPotion: [1, 0.1], drip: [0, 0.1],
  moonCake: [3, 0.3], line: [2, 0.2], pouch: [2, 0.2],
  power: [2, 0.2], giant: [2, 0.2], dash: [2, 0.2], magnet: [2, 0.2], powerEnd: [1, 0.2],
  hit: [3, 0.15], shield: [2, 0.15], smash: [1, 0.06], fall: [3, 0.4], near: [0, 0.12],
  bonus: [3, 0.5], bonusEnd: [2, 0.5], speed: [2, 0.8], lowhp: [2, 1.25], streak: [1, 0.3], relay: [2, 0.3], revive: [3, 0.5],
  skill: [2, 0.3], rewind: [2, 0.3], death: [3, 0.8], clear: [3, 0.8],
  count: [1, 0.15], go: [2, 0.2], click: [0, 0.03], error: [1, 0.15], reward: [2, 0.3], unlock: [3, 0.5], star: [2, 0.12],
  warn: [3, 0.15],
};
export const SFX_NAMES = Object.keys(SFX);

// ------------------------------------------------------------------------------------------------ engine types
interface Env {
  a?: number;       // attack (s)
  d?: number;       // decay time-constant (s); with s = 0 this is a pluck and len is ignored
  s?: number;       // sustain level 0..1
  r?: number;       // release (s) after len
  f1?: number;      // glide target (Hz)
  g?: number;       // glide time (s)
  det?: number;     // detune (cents)
  scoop?: number;   // start this many cents off pitch and slide in over 30 ms
  vib?: number;     // vibrato depth (cents), starts after vibAt
  vibAt?: number;
  lp?: number;      // per-note lowpass (Hz)
  trem?: number;    // tremolo rate (Hz)
  q?: number;       // filter Q (noise)
  drop?: AudioNode[];
}
interface Spec { id: string; kind: 'biome' | 'bonus' | 'menu'; style: MusicStyle | 'menu'; bpm: number; key: number; T: number; start: number }
interface Song {
  spec: Spec; st: StyleDef; T: number; bonus: boolean;
  stepDur: number; startT: number; step: number;
  bus: GainNode; leadF: BiquadFilterNode; hatF: BiquadFilterNode; snF: BiquadFilterNode; padF: BiquadFilterNode; bassF: BiquadFilterNode;
}
interface Voice { g: GainNode; t0: number; end: number; pri: number }

function vibCurve(depth: number, dur: number, base: number, rate = 5.5): Float32Array {
  const n = Math.max(8, Math.min(512, Math.ceil(dur * rate * 12)));
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * dur; a[i] = base + depth * Math.min(1, x / 0.15) * Math.sin(2 * Math.PI * rate * x); }
  return a;
}
function tremCurve(vol: number, dur: number, rate: number): Float32Array {
  const n = Math.max(16, Math.min(512, Math.ceil(dur * rate * 10)));
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1); const env = Math.min(1, x / 0.12) * Math.min(1, (1 - x) / 0.25);
    a[i] = vol * env * (0.55 + 0.45 * Math.cos(2 * Math.PI * rate * x * dur));
  }
  a[n - 1] = 0;
  return a;
}

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxGain!: GainNode; bgmGain!: GainNode;
  sfxVol = 0.8; bgmVol = 0.5;
  private duckGain: GainNode | null = null; private ducked = false;
  private noiseBuf: AudioBuffer | null = null;
  private offline = false; private userSuspended = false; private wakeT = -1e9; private timer = 0;
  // sfx state
  private last = new Map<string, number>();
  private voices: Voice[] = [];
  private dying: { n: AudioNode; at: number }[] = [];
  private vEnd = 0;
  private jStep = -1; private jChainT = -1e9; private jLastT = -1e9;
  private sfxKey = 0;
  // music state
  private req: Spec | null = null; private cur: Song | null = null; private switchAt = 0;
  private lastBiome: Spec | null = null;

  // ---------------------------------------------------------------------------------------------- lifecycle
  /** Create/resume the context. Call from a user gesture (first pointerdown / key). */
  unlock(): void {
    if (this.ctx) {
      this.userSuspended = false;
      if (!this.offline && this.ctx.state !== 'running') { this.wakeT = performance.now(); this.ctx.resume().catch(() => {}); }
      return;
    }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      const c: AudioContext = new AC({ latencyHint: 'interactive' });
      this.build(c);
      if (c.state !== 'running') { this.wakeT = performance.now(); c.resume().catch(() => {}); }
      // old iOS only really unlocks once something is started inside the gesture
      const b = c.createBufferSource(); b.buffer = c.createBuffer(1, 1, c.sampleRate); b.connect(c.destination); b.start(0);
      b.onended = () => b.disconnect();
      this.timer = window.setInterval(() => this.pump(), PUMP_MS);
      document.addEventListener('visibilitychange', this.onVis);
    } catch { this.ctx = null; }
  }
  /** Test hook: drive the engine from an OfflineAudioContext (tick() must then be called by the test). */
  attachForTest(c: BaseAudioContext): void { this.offline = true; this.build(c); }

  private build(c: BaseAudioContext): void {
    this.ctx = c as AudioContext;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 10; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master = c.createGain(); this.master.gain.value = MASTER; this.master.connect(comp); comp.connect(c.destination);
    this.sfxGain = c.createGain(); this.sfxGain.connect(this.master);
    this.duckGain = c.createGain(); this.duckGain.gain.value = this.ducked ? 0.5 : 1; this.duckGain.connect(this.master);
    this.bgmGain = c.createGain(); this.bgmGain.connect(this.duckGain);
    this.sfxGain.gain.value = curveVol(this.sfxVol) * SFX_LEVEL;
    this.bgmGain.gain.value = curveVol(this.bgmVol) * BGM_LEVEL;
    const n = Math.floor(c.sampleRate); this.noiseBuf = c.createBuffer(1, n, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); let sd = 7;
    for (let i = 0; i < n; i++) { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; d[i] = sd / 2147483648 - 1; }
  }

  private onVis = (): void => {
    const c = this.ctx; if (!c || this.offline) return;
    if (document.hidden) c.suspend().catch(() => {});
    else if (!this.userSuspended) { this.wakeT = performance.now(); c.resume().catch(() => {}); }
  };
  private live(): boolean {
    const c = this.ctx; if (!c) return false;
    if (this.offline || c.state === 'running') return true;
    // just asked to resume from a gesture: schedule anyway, it plays as soon as the context wakes
    return c.state === 'suspended' && !this.userSuspended && performance.now() - this.wakeT < 400;
  }

  setVolumes(sfx: number, bgm: number): void {
    this.sfxVol = clamp(Number(sfx) || 0, 0, 1); this.bgmVol = clamp(Number(bgm) || 0, 0, 1);
    const c = this.ctx; if (!c) return;
    try {
      this.sfxGain.gain.setTargetAtTime(curveVol(this.sfxVol) * SFX_LEVEL, c.currentTime, 0.02);
      this.bgmGain.gain.setTargetAtTime(curveVol(this.bgmVol) * BGM_LEVEL, c.currentTime, 0.02);
    } catch { /* ignore */ }
  }
  /** Pause everything (pause sheet). */
  suspend(): void { this.userSuspended = true; if (this.ctx && !this.offline) this.ctx.suspend().catch(() => {}); }
  resume(): void {
    this.userSuspended = false;
    if (this.ctx && !this.offline) { this.wakeT = performance.now(); this.ctx.resume().catch(() => {}); }
  }
  /** Results screen: BGM at 50 %. */
  duck(on: boolean): void {
    this.ducked = !!on;
    const c = this.ctx; if (!c || !this.duckGain) return;
    try { this.duckGain.gain.setTargetAtTime(on ? 0.5 : 1, c.currentTime, 0.12); } catch { /* ignore */ }
  }
  /** Called every frame by the run loop; the internal timer pumps too, so this is optional. */
  tick(): void { this.pump(); }

  // ---------------------------------------------------------------------------------------------- music API
  /** {bpm,key[,style]} = biome loop (style inferred from bpm if omitted), 'bonus' = 보름달 잔치 variant of the
   *  last biome, 'menu' = calm menu loop, null = fade out. Same request again = no-op (the loop keeps going). */
  setMusic(m: MusicReq): void {
    let spec: Spec | null = null;
    try { spec = this.resolve(m); } catch { spec = null; }
    if ((spec ? spec.id : '') === (this.req ? this.req.id : '')) return;
    this.req = spec;
    if (spec) this.sfxKey = spec.key;
    try { this.switchAt = this.boundary(spec); } catch { this.switchAt = 0; }
  }

  private resolve(m: MusicReq): Spec | null {
    if (!m) return null;
    const mk = (kind: Spec['kind'], st: Spec['style'], bpm: number, key: number, T: number, start: number): Spec =>
      ({ id: `${kind}:${st}:${bpm}:${key}`, kind, style: st, bpm, key, T, start });
    if (m === 'menu') return mk('menu', 'menu', 100, 9, tonic(9), 0);
    if (m === 'bonus') {
      const b = this.lastBiome ?? mk('biome', 'market', 150, 0, tonic(0), 0);
      return mk('bonus', b.style, b.bpm + 15, b.key + 5, b.T + 5, 128);   // +15 BPM, a perfect fourth up, start at B
    }
    if (typeof m === 'object') {
      const bpm = clamp(Math.round(Number(m.bpm) || 140), 60, 220); const key = Math.round(Number(m.key) || 0);
      const st: MusicStyle = m.style && m.style in STYLES ? m.style : inferStyle(bpm);
      const s = mk('biome', st, bpm, key, tonic(key), 0); this.lastBiome = s; return s;
    }
    return null;
  }
  /** When the playing song should hand over: next bar between biomes, next beat otherwise, now for a stop. */
  private boundary(spec: Spec | null): number {
    const c = this.ctx; const cur = this.cur; if (!c || !cur) return 0;
    const now = c.currentTime; if (!spec) return now;
    const unit = cur.spec.kind === 'biome' && spec.kind === 'biome' ? 16 : 4;
    const span = unit * cur.stepDur;
    return cur.startT + Math.max(0, Math.ceil((now + 0.05 - cur.startT) / span)) * span;
  }

  private pump(): void {
    const c = this.ctx; if (!c) return;
    try {
      if (!this.live()) return;
      const now = c.currentTime; this.reap(now);
      if (this.bgmVol <= 0) return;                         // muted: no scheduling work at all
      const horizon = now + LOOKAHEAD; const want = this.req;
      let cur = this.cur;
      if (cur && (!want || want.id !== cur.spec.id)) {
        const at = Math.max(this.switchAt, now + 0.02);
        if (at > horizon) { this.schedule(cur, horizon, now); return; }
        this.schedule(cur, at, now); this.endSong(cur, at);
        cur = this.cur = want ? this.startSong(want, at) : null;
      }
      if (!cur && want) cur = this.cur = this.startSong(want, now + 0.06);
      if (cur) this.schedule(cur, horizon, now);
    } catch { /* audio must never break the game */ }
  }

  private startSong(spec: Spec, t: number): Song {
    const c = this.ctx!;
    const bus = c.createGain(); bus.gain.value = 0; bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + 0.04);
    bus.connect(this.bgmGain);
    const filt = (type: BiquadFilterType, f: number, q = 0.7) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.connect(bus); return n; };
    const stepDur = 60 / spec.bpm / 4;
    const bonus = spec.kind === 'bonus';
    return {
      spec, st: STYLES[spec.style], T: spec.T, bonus, stepDur, startT: t - spec.start * stepDur, step: spec.start, bus,
      leadF: filt('lowpass', bonus ? 3400 : 2800), hatF: filt('highpass', 7000), snF: filt('bandpass', 1800, 0.8),
      padF: filt('lowpass', 1400), bassF: filt('lowpass', 800),
    };
  }
  private endSong(sg: Song, at: number): void {
    const g = sg.bus.gain; g.cancelScheduledValues(at); g.setTargetAtTime(0, at, 0.1);
    for (const n of [sg.bus, sg.leadF, sg.hatF, sg.snF, sg.padF, sg.bassF]) this.dying.push({ n, at: at + 0.9 });
  }
  private schedule(sg: Song, until: number, now: number): void {
    for (let guard = 0; guard < 128; guard++) {
      const gt = sg.startT + sg.step * sg.stepDur;
      if (gt >= until) break;
      if (gt < now - 0.02) { sg.step = Math.ceil((now - sg.startT) / sg.stepDur); continue; }   // was muted/stalled: stay on the grid
      this.doStep(sg, sg.step, Math.max(now, gt + this.swingOff(sg, sg.step)));
      sg.step++;
    }
  }
  private swingOff(sg: Song, n: number): number {
    const i = n & 3; const sd = sg.stepDur; const s8 = (sg.st.swing8 - 0.5) * 4 * sd; const s16 = (sg.st.swing16 - 0.5) * 2 * sd;
    return i === 2 ? s8 : i === 1 ? s16 : i === 3 ? s16 + s8 * 0.5 : 0;
  }

  private doStep(sg: Song, n: number, t: number): void {
    const st = sg.st; const s = n & 255; const bar = s >> 4; const sec = bar >> 3; const b8 = bar & 7; const i = s & 15;
    const ch = st.chords[sec][b8]; const T = sg.T; const sd = sg.stepDur; const bonus = sg.bonus;
    const third = ch.q ? 3 : 4; const broot = ch.r > 6 ? ch.r - 12 : ch.r; const BT = T > 50 ? T - 12 : T;   // bass tonic Eb2..D3
    // drums
    if (st.kick[sec][i] || (bonus && (i & 3) === 0)) this.kick(sg, t, st.kickVol);
    const fill = (st.fill || bonus) && i >= 12 && (b8 === 7 || (bonus && b8 === 3));
    if (fill) this.snare(sg, t, Math.max(st.snareVol, 0.1) * (0.4 + 0.15 * (i - 12)), 'snare');
    else if (st.snare[sec][i]) this.snare(sg, t, st.snareVol, st.snareKind);
    const h = st.hat[sec][i] || (bonus && (i & 1) === 0 ? 1 : 0);
    if (h) this.hat(sg, t, st.hatVol * (h === 2 ? 1.25 : (i & 3) === 0 ? 0.75 : 1), h === 2);
    if (st.rim && st.rim[sec][i]) this.rim(sg, t, st.rimVol);
    if (st.comp && st.comp[sec][i]) this.chordStab(sg, t, ch, third, st.compVol);
    // bass
    const bp = st.bass[sec]; const bc = bp.note[i];
    if (bc) {
      const semi = broot + (bc === 2 ? 7 : bc === 3 ? 12 : bc === 4 ? -5 : bc === 5 ? third : 0);
      this.bassNote(sg, t, mtof(BT + semi), bp.len[i] * sd * st.bassGate, st.bassVol);
    }
    // pad: one chord per bar, overlapping releases keep it smooth
    if (i === 0 && st.pad > 0) this.pad(sg, t, ch, third, 16 * sd, st.pad * (bonus ? 0.8 : 1));
    // lead (bonus: doubled an octave below for weight)
    const ln = st.mel[sec][b8 >> 1]; const ls = ((b8 & 1) << 4) | i; const li = ln.idx[ls];
    if (li !== REST) {
      let m = T + 24 + st.leadOct + pent(li); while (m > 94) m -= 12;
      const len = ln.len[ls] * sd;
      this.leadNote(sg, t, m, len);
      if (bonus) this.osc(sg.bus, t, mtof(m - 12), 'triangle', st.leadVol * 0.35, 0, { a: 0.004, d: Math.min(0.25, len * 0.5) });
    }
    // sparkle arps (bonus: every 16th)
    const ad = bonus ? 1 : st.arp[sec];
    if (ad && i % ad === 0) {
      const seq = i < 8 ? [0, third, 7, 12] : [12, 7, third, 0];
      let m = T + 24 + ch.r + seq[(i / ad) & 3]; while (m > 93) m -= 12; while (m < 76) m += 12;
      this.sparkle(sg, t, mtof(m), (st.arpVol || 0.02) * (bonus ? 1.1 : 1));
    }
    if (bonus && i === 0 && (b8 & 1) === 0) this.noise(sg.hatF, t, 0.5, 0.03, null, 0, { a: 0.25, s: 1, r: 0.3 });
  }

  // ---------------------------------------------------------------------------------------------- instruments
  private kick(sg: Song, t: number, vol: number): void {
    this.osc(sg.bus, t, 140, 'sine', vol, 0, { a: 0.003, d: 0.075, f1: 46, g: 0.11 });
    this.osc(sg.bus, t, 900, 'triangle', vol * 0.08, 0, { a: 0.001, d: 0.006, f1: 300, g: 0.02 });   // click for phone speakers
  }
  private hat(sg: Song, t: number, vol: number, open: boolean): void {
    this.noise(sg.hatF, t, 0, vol, null, 0, { a: 0.001, d: open ? 0.045 : 0.012 });
  }
  private snare(sg: Song, t: number, vol: number, kind: SnareKind): void {
    if (vol <= 0) return;
    if (kind === 'clap') {
      for (let k = 0; k < 3; k++) this.noise(sg.snF, t + k * 0.011, 0, vol * 0.8, null, 0, { a: 0.001, d: 0.007 });
      this.noise(sg.snF, t + 0.033, 0, vol, null, 0, { a: 0.001, d: 0.045 });
      return;
    }
    this.osc(sg.bus, t, 190, 'triangle', vol * 0.5, 0, { a: 0.002, d: 0.03, f1: 140, g: 0.06 });
    this.noise(sg.snF, t, 0, vol, null, 0, kind === 'brush' ? { a: 0.012, d: 0.05 } : { a: 0.001, d: 0.035 });
  }
  /** janggu '덕': a dry wooden click */
  private rim(sg: Song, t: number, vol: number): void {
    this.osc(sg.bus, t, 1250, 'sine', vol, 0, { a: 0.001, d: 0.012, f1: 1000, g: 0.02 });
    this.noise(sg.bus, t, 0, vol * 0.5, 'bandpass', 3000, { q: 3, a: 0.001, d: 0.01 });
  }
  private voicing(T: number, ch: Chord, third: number): number[] {
    return [0, third, 7].map(x => T + 12 + (((ch.r + x) % 12) + 12) % 12);
  }
  private pad(sg: Song, t: number, ch: Chord, third: number, len: number, vol: number): void {
    const vs = this.voicing(sg.T, ch, third);
    vs.forEach((m, k) => this.osc(sg.padF, t, mtof(m), 'triangle', vol, len, { a: 0.15, d: 0.3, s: 0.75, r: 0.35, det: (k - 1) * 5 }));
  }
  private chordStab(sg: Song, t: number, ch: Chord, third: number, vol: number): void {
    for (const m of this.voicing(sg.T, ch, third)) this.osc(sg.padF, t, mtof(m), 'sine', vol, 0, { a: 0.004, d: 0.09 });
  }
  private bassNote(sg: Song, t: number, f: number, len: number, vol: number): void {
    const e: Env = { a: 0.005, d: 0.12, s: 0.55, r: 0.06 };
    this.osc(sg.bassF, t, f, 'triangle', vol, len, e);
    this.osc(sg.bassF, t, f, 'sawtooth', vol * 0.3, len, e);
    if (f >= 70) this.osc(sg.bus, t, f / 2, 'sine', vol * 0.45, len, e);   // sub octave (skipped when it would be < 35 Hz)
  }
  private sparkle(sg: Song, t: number, f: number, vol: number): void {
    this.osc(sg.bus, t, f, 'triangle', vol, 0, { a: 0.002, d: 0.06 });
    this.osc(sg.bus, t, f * 2, 'sine', vol * 0.25, 0, { a: 0.002, d: 0.03 });
  }
  private leadNote(sg: Song, t: number, m: number, len: number): void {
    const st = sg.st; const f = mtof(m); const v = st.leadVol; const c = this.ctx!;
    switch (st.lead) {
      case 'pluck': {   // gayageum-ish: bright pluck through a closing filter, a small scoop, 농현 vibrato on held notes
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
        lp.frequency.setValueAtTime(4200, t); lp.frequency.setTargetAtTime(1100, t, 0.08); lp.connect(sg.bus);
        const d = Math.min(0.3, 0.08 + len * 0.3);
        this.osc(lp, t, f, 'square', v * 0.28, 0, { a: 0.003, d: d * 0.6, scoop: -45 });
        this.osc(lp, t, f, 'triangle', v, 0, { a: 0.003, d, scoop: -45, vib: len > 0.35 ? 22 : 0, vibAt: 0.1, drop: [lp] });
        break;
      }
      case 'ocarina':
        this.osc(sg.bus, t, f, 'sine', v, len * 0.92, { a: 0.02, d: 0.2, s: 0.7, r: 0.09, vib: len > 0.35 ? 14 : 0, vibAt: 0.18 });
        this.osc(sg.bus, t, f, 'triangle', v * 0.3, len * 0.92, { a: 0.02, d: 0.2, s: 0.6, r: 0.09 });
        break;
      case 'bright':
        this.osc(sg.leadF, t, f, 'square', v * 0.55, len * 0.8, { a: 0.004, d: 0.1, s: 0.45, r: 0.06 });
        this.osc(sg.leadF, t, f * 2, 'sine', v * 0.3, len * 0.8, { a: 0.004, d: 0.08, s: 0.35, r: 0.06 });
        break;
      case 'flute':
        this.osc(sg.bus, t, f, 'sine', v, len * 0.95, { a: 0.045, d: 0.25, s: 0.85, r: 0.18, vib: len > 0.4 ? 12 : 0, vibAt: 0.25 });
        this.osc(sg.bus, t, f, 'triangle', v * 0.12, len * 0.95, { a: 0.045, d: 0.25, s: 0.8, r: 0.18 });
        break;
      case 'box':
        this.osc(sg.bus, t, f, 'sine', v, 0, { a: 0.003, d: 0.3 });
        this.osc(sg.bus, t, f * 4, 'sine', v * 0.12, 0, { a: 0.002, d: 0.06 });
        break;
    }
  }

  // ---------------------------------------------------------------------------------------------- synthesis primitives
  /** gain envelope; returns the time the voice is silent */
  private env(p: AudioParam, t: number, vol: number, len: number, e: Env): number {
    const a = e.a ?? 0.004; const s = e.s ?? 0;
    p.value = 0;   // a fresh GainNode is 1 until its first event: a source starting on that frame would click at full level
    if (e.trem) { const dur = Math.max(0.05, len); p.setValueCurveAtTime(tremCurve(vol, dur, e.trem), t, dur); return t + dur + 0.01; }
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(vol, t + a);
    if (s > 0) {
      const r = e.r ?? 0.08; const tr = Math.max(t + a, t + len);
      p.setTargetAtTime(vol * s, t + a, e.d ?? 0.06); p.setTargetAtTime(0, tr, r / 4);
      return tr + r * 1.6;
    }
    const d = e.d ?? Math.max(0.01, len / 4);
    p.setTargetAtTime(0, t + a, d);
    return t + a + d * 6.5;
  }
  private osc(dest: AudioNode, t: number, f: number, type: OscillatorType, vol: number, len: number, e: Env = {}): number {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    const end = this.env(g.gain, t, vol, len, e);
    if (e.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, e.f1), t + (e.g ?? Math.max(0.02, len || (end - t) * 0.5)));
    const base = e.det ?? 0; const det = o.detune;
    if (e.scoop) { det.setValueAtTime(base + e.scoop, t); det.linearRampToValueAtTime(base, t + 0.03); }
    else if (base) det.setValueAtTime(base, t);
    const vAt = t + (e.vibAt ?? 0.15);
    if (e.vib && end - vAt > 0.12) det.setValueCurveAtTime(vibCurve(e.vib, end - vAt, base), vAt, end - vAt);
    let lp: BiquadFilterNode | null = null;
    if (e.lp) { lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = e.lp; g.connect(lp); lp.connect(dest); }
    else g.connect(dest);
    o.connect(g); o.start(t); o.stop(end);
    const drop = e.drop;
    o.onended = () => { o.disconnect(); g.disconnect(); if (lp) lp.disconnect(); if (drop) for (const n of drop) n.disconnect(); };
    if (end > this.vEnd) this.vEnd = end;
    return end;
  }
  /** filtered noise from the shared buffer (type null = no own filter, dest already filters) */
  private noise(dest: AudioNode, t: number, len: number, vol: number, type: BiquadFilterType | null, f: number, e: Env = {}): number {
    const c = this.ctx!; if (!this.noiseBuf) return t;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const g = c.createGain(); const end = this.env(g.gain, t, vol, len, e);
    let fl: BiquadFilterNode | null = null;
    if (type) {
      fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (e.q) fl.Q.value = e.q;
      if (e.f1) fl.frequency.exponentialRampToValueAtTime(e.f1, t + (e.g ?? Math.max(0.02, len || (end - t) * 0.5)));
      src.connect(fl); fl.connect(g);
    } else src.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.9); src.stop(end);
    src.onended = () => { src.disconnect(); g.disconnect(); if (fl) fl.disconnect(); };
    if (end > this.vEnd) this.vEnd = end;
    return end;
  }
  /** two-operator FM bell */
  private bell(dest: AudioNode, t: number, f: number, vol: number, len: number, ratio = 3.5, index = 1): number {
    const c = this.ctx!; const car = c.createOscillator(); const mod = c.createOscillator(); const mg = c.createGain(); const g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, t); mg.gain.setTargetAtTime(0, t, len / 5);
    mod.connect(mg); mg.connect(car.frequency);
    const end = this.env(g.gain, t, vol, 0, { a: 0.002, d: len / 4 });
    car.connect(g); g.connect(dest);
    car.start(t); mod.start(t); car.stop(end); mod.stop(end);
    car.onended = () => { car.disconnect(); mod.disconnect(); mg.disconnect(); g.disconnect(); };
    if (end > this.vEnd) this.vEnd = end;
    return end;
  }

  // ---------------------------------------------------------------------------------------------- voices
  private reap(now: number): void {
    if (this.voices.length) {
      let w = 0;
      for (const v of this.voices) { if (v.end <= now) { try { v.g.disconnect(); } catch { /* */ } } else this.voices[w++] = v; }
      this.voices.length = w;
    }
    if (this.dying.length) {
      let w = 0;
      for (const d of this.dying) { if (d.at <= now) { try { d.n.disconnect(); } catch { /* */ } } else this.dying[w++] = d; }
      this.dying.length = w;
    }
  }
  private alloc(pri: number, t: number): Voice | null {
    const c = this.ctx!; const now = c.currentTime; this.reap(now);
    if (this.voices.length >= MAX_VOICES) {
      let vi = 0;
      for (let i = 1; i < this.voices.length; i++) {
        const a = this.voices[i], b = this.voices[vi];
        if (a.pri < b.pri || (a.pri === b.pri && a.t0 < b.t0)) vi = i;
      }
      const victim = this.voices[vi]; if (victim.pri > pri) return null;
      const p = victim.g.gain; p.cancelScheduledValues(now); p.setTargetAtTime(0, now, 0.012);
      this.dying.push({ n: victim.g, at: now + 0.12 }); this.voices.splice(vi, 1);
    }
    const g = c.createGain(); g.connect(this.sfxGain);
    const v: Voice = { g, t0: t, end: t + 0.5, pri }; this.voices.push(v);
    return v;
  }
  private sfxRoot(): number { const k = ((Math.round(this.sfxKey) % 12) + 12) % 12; return 51 + ((k + 9) % 12); }   // Eb3..D4

  // ---------------------------------------------------------------------------------------------- SFX
  play(name: string, arg = 0): void {
    const c = this.ctx; if (!c || this.sfxVol <= 0) return;
    const meta = SFX[name]; if (!meta) return;
    try {
      if (!this.live()) return;
      const now = c.currentTime; let t = now;
      if (name === 'jelly') {
        if (now - this.jChainT > JELLY_WINDOW) this.jStep = -1;
        this.jChainT = now;
        t = Math.max(now, this.jLastT + JELLY_GAP);
        if (t - now > JELLY_GAP + 0.005) return;             // already one queued: merge this candy into it
        this.jStep = Math.min(JELLY_STEPS - 1, this.jStep + 1); this.jLastT = t;
      } else {
        const l = this.last.get(name); if (l !== undefined && now - l < meta[1] && now >= l) return;
        this.last.set(name, now);
      }
      const v = this.alloc(meta[0], t); if (!v) return;
      this.vEnd = t;
      this.sfx(name, v.g, t, Number(arg) || 0);
      v.end = this.vEnd + 0.05;
    } catch { /* ignore */ }
  }

  private sfx(name: string, v: AudioNode, t: number, arg: number): void {
    const K = this.sfxRoot(); const F = (s: number) => mtof(K + s);
    const arp = (semis: number[], dt: number, fn: (f: number, at: number, k: number) => void) => semis.forEach((s, k) => fn(F(s), t + k * dt, k));
    switch (name) {
      // ---- movement
      case 'jump':
        this.osc(v, t, 300, 'triangle', 0.21, 0.13, { f1: 620, g: 0.09 });
        this.osc(v, t + 0.012, 600, 'sine', 0.07, 0.08, { f1: 1000, g: 0.07 });
        break;
      case 'jump2':   // 휙
        this.noise(v, t, 0.17, 0.2, 'bandpass', 700, { f1: 3400, q: 1.4, a: 0.02 });
        this.osc(v, t, 520, 'sine', 0.09, 0.13, { f1: 1150, g: 0.11 });
        break;
      case 'slide':
        this.noise(v, t, 0.22, 0.1, 'bandpass', 2400, { f1: 1100, q: 0.9, a: 0.025 });
        this.osc(v, t, 230, 'triangle', 0.07, 0.1, { f1: 150 });
        break;
      case 'fastfall':
        this.osc(v, t, 900, 'triangle', 0.12, 0.15, { f1: 200, g: 0.13 });
        this.noise(v, t, 0.14, 0.08, 'lowpass', 3200, { f1: 500 });
        break;
      case 'land':
        this.osc(v, t, 150, 'sine', 0.24, 0.07, { f1: 65 });
        this.noise(v, t, 0.035, 0.07, 'lowpass', 800);
        break;
      // ---- pickups
      case 'jelly': {
        const f = F(12 + pent(this.jStep));
        this.osc(v, t, f, 'sine', 0.15, 0.085);
        this.osc(v, t, f * 2, 'triangle', 0.025, 0.035);
        break;
      }
      case 'big':   // 왕별사탕: a strummed major triad
        arp([12, 16, 19, 24], 0.028, (f, at) => this.osc(v, at, f, 'triangle', 0.085, 0.32));
        this.bell(v, t + 0.09, F(31), 0.05, 0.4);
        break;
      case 'coin':  // 엽전: two tones a fourth apart with a metallic edge
        this.osc(v, t, F(19), 'triangle', 0.09, 0.06);
        this.bell(v, t, F(19), 0.03, 0.08, 2.76, 0.5);
        this.osc(v, t + 0.055, F(24), 'triangle', 0.09, 0.16);
        this.bell(v, t + 0.055, F(24), 0.05, 0.2, 2.76, 0.6);
        break;
      case 'letter': {   // lantern letter: a bell, do-re-mi-sol-la by letter index
        const s = pent(((Math.round(arg) % 5) + 5) % 5);
        this.bell(v, t, F(24 + s), 0.16, 0.9, 3.5, 1);
        [0, 4, 7].forEach((x, k) => this.osc(v, t + k * 0.02, F(12 + x), 'sine', 0.035, 0.45, { a: 0.02, s: 0.6, r: 0.3 }));
        break;
      }
      case 'potion':   // 꿀물: three glugs and a warm sparkle
        [1, 1.26, 1.5].forEach((r, k) => this.osc(v, t + k * 0.075, 330 * r, 'sine', 0.13, 0.08, { f1: 660 * r, g: 0.06 }));
        arp([24, 28, 31], 0.03, (f, at) => this.osc(v, at + 0.2, f, 'triangle', 0.05, 0.3));
        this.bell(v, t + 0.28, F(36), 0.03, 0.3);
        break;
      case 'miniPotion':
        [1, 1.3].forEach((r, k) => this.osc(v, t + k * 0.07, 360 * r, 'sine', 0.11, 0.07, { f1: 720 * r, g: 0.05 }));
        this.osc(v, t + 0.15, F(31), 'triangle', 0.045, 0.22);
        break;
      case 'drip':     // magpie's honey drop landing
        this.osc(v, t, 1200, 'sine', 0.07, 0.06, { f1: 600 });
        this.osc(v, t + 0.05, 800, 'sine', 0.06, 0.05, { f1: 1600 });
        break;
      case 'moonCake': {   // 보름달 떡 fanfare
        const br: Env = { lp: 2200, a: 0.01, s: 0.7, d: 0.1, r: 0.12 };
        [[0, 7, 0.08], [0.1, 7, 0.08], [0.2, 7, 0.08], [0.3, 12, 0.6]].forEach(([dt, s, l]) => this.osc(v, t + dt, F(12 + s), 'sawtooth', 0.07, l, br));
        this.osc(v, t + 0.3, F(12 + 4), 'sawtooth', 0.04, 0.6, br);
        this.osc(v, t + 0.3, F(7), 'sawtooth', 0.04, 0.6, br);
        arp([36, 40, 43], 0.06, (f, at) => this.bell(v, at + 0.38, f, 0.035, 0.4));
        this.noise(v, t + 0.3, 0.5, 0.035, 'highpass', 6000, { a: 0.1, s: 1, r: 0.3 });
        break;
      }
      case 'line':     // 한 줄 완성: a strummed add9/maj7 chord
        arp([12, 16, 19, 23, 26], 0.022, (f, at) => this.osc(v, at, f, 'triangle', 0.055, 0.5, { a: 0.01, s: 0.5, r: 0.25 }));
        this.bell(v, t + 0.1, F(31), 0.05, 0.5);
        break;
      case 'pouch':    // 복주머니: jingle bells then a small chord
        [4, 5, 6, 7, 5, 8].forEach((s, k) => this.bell(v, t + [0, 0.06, 0.12, 0.2, 0.26, 0.34][k], F(24 + pent(s)), 0.055, 0.18, 2.4, 0.8));
        this.noise(v, t, 0.35, 0.035, 'highpass', 7000, { a: 0.02, s: 0.8, r: 0.1 });
        arp([24, 28, 31], 0.02, (f, at) => this.bell(v, at + 0.42, f, 0.045, 0.5));
        break;
      // ---- power-ups
      case 'power': case 'giant': case 'dash': case 'magnet':
        arp([12, 14, 16, 19, 21, 24], 0.045, (f, at) => this.osc(v, at, f, 'square', 0.055, 0.1, { lp: 2600 }));
        this.noise(v, t, 0.3, 0.05, 'bandpass', 500, { f1: 3000, a: 0.25, s: 1, r: 0.08 });
        this.osc(v, t + 0.3, F(24), 'triangle', 0.06, 0.35);
        this.osc(v, t + 0.3, F(28), 'triangle', 0.05, 0.35);
        if (name === 'giant') this.osc(v, t, 98, 'triangle', 0.16, 0.45, { f1: 196, g: 0.4, a: 0.02, s: 0.7, r: 0.1 });
        if (name === 'dash') this.noise(v, t + 0.05, 0.3, 0.12, 'bandpass', 400, { f1: 4200, q: 1, a: 0.05 });
        if (name === 'magnet') this.osc(v, t + 0.1, F(19), 'sine', 0.06, 0.5, { a: 0.03, s: 0.8, vib: 60, vibAt: 0.12 });
        break;
      case 'powerEnd':
        this.osc(v, t, F(19), 'triangle', 0.08, 0.12, { f1: F(17) });
        this.osc(v, t + 0.12, F(12), 'triangle', 0.08, 0.2, { f1: F(10) });
        break;
      // ---- hazards
      case 'hit': {    // 쿵: a soft round thump (arg: 0 spike, 1 tall, 2 hang → slightly different weight)
        const k = [1, 0.82, 1.18][Math.round(arg)] ?? 1;
        this.osc(v, t, 130 * k, 'sine', 0.42, 0.3, { a: 0.003, f1: 48 * k, g: 0.18 });
        this.osc(v, t, 240 * k, 'triangle', 0.14, 0.12, { f1: 120 * k });
        this.noise(v, t, 0.1, 0.16, 'lowpass', 600);
        break;
      }
      case 'shield':   // bubble pops, nothing lost
        this.osc(v, t, 1000, 'sine', 0.12, 0.22, { f1: 340, g: 0.18 });
        this.osc(v, t + 0.07, F(36), 'triangle', 0.04, 0.15);
        this.osc(v, t + 0.12, F(43), 'triangle', 0.03, 0.15);
        this.noise(v, t, 0.08, 0.03, 'highpass', 5000);
        break;
      case 'smash':
        this.noise(v, t, 0.15, 0.2, 'lowpass', 1600, { f1: 400 });
        this.osc(v, t, 170, 'sine', 0.26, 0.14, { f1: 60 });
        this.bell(v, t + 0.04, F(31), 0.05, 0.15);
        break;
      case 'fall':     // whoosh down … balloon pop-in
        this.noise(v, t, 0.42, 0.18, 'bandpass', 2600, { f1: 300, q: 1.3, a: 0.05, g: 0.4 });
        this.osc(v, t, 760, 'triangle', 0.06, 0.38, { f1: 190, g: 0.38, a: 0.02, s: 0.6 });
        this.noise(v, t + 0.46, 0.025, 0.18, 'bandpass', 1600, { a: 0.001 });
        this.osc(v, t + 0.46, 280, 'sine', 0.12, 0.16, { f1: 900, g: 0.12 });
        this.osc(v, t + 0.55, F(24), 'triangle', 0.05, 0.2);
        this.osc(v, t + 0.6, F(31), 'triangle', 0.04, 0.2);
        break;
      case 'near':     // tiny sparkle
        this.osc(v, t, F(31), 'sine', 0.05, 0.05);
        this.osc(v, t + 0.03, F(36), 'sine', 0.035, 0.05);
        break;
      // ---- run progress
      case 'bonus': {  // 보름달 잔치 (arg 1 = 왕보름달)
        for (let k = 0; k < 8; k++) this.osc(v, t + k * 0.05, F(12 + pent(k)), 'triangle', 0.09, 0.22);
        arp([24, 28, 31], 0.02, (f, at) => this.bell(v, at + 0.4, f, 0.06, 0.7));
        if (arg) arp([36, 40, 43], 0.05, (f, at) => this.bell(v, at + 0.55, f, 0.035, 0.6));
        this.noise(v, t, 0.9, 0.04, 'highpass', 6000, { a: 0.3, s: 1, r: 0.3 });
        break;
      }
      case 'bonusEnd':
        arp([24, 21, 19, 12], 0.09, (f, at) => this.osc(v, at, f, 'triangle', 0.07, 0.2));
        this.osc(v, t + 0.36, F(16), 'sine', 0.035, 0.3, { a: 0.02, s: 0.6, r: 0.2 });
        break;
      case 'speed':    // tier-up riser (~1 s) ending in a bright ding
        this.noise(v, t, 0.9, 0.11, 'bandpass', 350, { f1: 4200, q: 1.2, a: 0.8, s: 1, r: 0.1, g: 0.9 });
        this.osc(v, t, 220, 'sine', 0.05, 0.9, { f1: 880, g: 0.9, a: 0.6, s: 1, r: 0.1 });
        this.bell(v, t + 0.92, F(24), 0.11, 0.35);
        this.osc(v, t + 0.95, F(31), 'triangle', 0.05, 0.25);
        break;
      case 'lowhp':    // '덜덜' — a soft low shiver, never an alarm (≤ 1 Hz via the rate limit)
        this.osc(v, t, F(7), 'triangle', 0.09, 0.38, { trem: 11, lp: 900 });
        this.osc(v, t, F(14), 'sine', 0.035, 0.38, { trem: 11 });
        break;
      case 'streak':
        arp([24, 28, 31], 0.05, (f, at) => this.osc(v, at, f, 'triangle', 0.07, 0.12));
        this.bell(v, t + 0.15, F(36), 0.04, 0.25);
        break;
      case 'relay':    // baton pass
        this.noise(v, t, 0.25, 0.08, 'bandpass', 500, { f1: 2500, a: 0.05 });
        arp([12, 16, 19, 24], 0.07, (f, at) => this.osc(v, at, f, 'triangle', 0.085, 0.18));
        this.bell(v, t + 0.3, F(31), 0.04, 0.4);
        break;
      case 'revive':
        [12, 16, 19, 24].forEach(s => this.osc(v, t, F(s), 'sine', 0.045, 0.7, { a: 0.25, s: 0.8, r: 0.3 }));
        for (let k = 0; k < 6; k++) this.bell(v, t + 0.15 + k * 0.08, F(24 + pent(k)), 0.045, 0.3);
        this.noise(v, t + 0.2, 0.6, 0.03, 'highpass', 6000, { a: 0.2, s: 1, r: 0.3 });
        break;
      case 'skill':
        this.osc(v, t, 600, 'triangle', 0.09, 0.2, { f1: 1300, g: 0.18 });
        this.osc(v, t + 0.08, F(31), 'sine', 0.05, 0.25);
        this.noise(v, t, 0.2, 0.04, 'bandpass', 1200, { f1: 4000 });
        break;
      case 'rewind':   // tutorial rewind: tape spinning back
        this.osc(v, t, 1200, 'triangle', 0.08, 0.35, { f1: 300, g: 0.3, a: 0.02, s: 0.7, r: 0.08 });
        this.noise(v, t, 0.35, 0.06, 'bandpass', 3000, { f1: 800, a: 0.03 });
        break;
      case 'death':    // a soft falling sigh
        arp([19, 16, 12], 0.17, (f, at) => this.osc(v, at, f, 'triangle', 0.09, 0.22));
        this.osc(v, t + 0.51, F(7), 'triangle', 0.09, 0.45, { f1: F(7) * 0.97, g: 0.45, a: 0.01, s: 0.7, r: 0.25, vib: 18, vibAt: 0.1 });
        break;
      case 'clear': {  // stage clear fanfare
        arp([12, 16, 19, 24], 0.08, (f, at) => this.osc(v, at, f, 'square', 0.06, 0.12, { lp: 2400 }));
        const br: Env = { lp: 2200, a: 0.01, s: 0.6, d: 0.1, r: 0.2 };
        [12, 16, 19, 24].forEach(s => this.osc(v, t + 0.36, F(s), 'square', 0.035, 0.6, br));
        arp([36, 40, 43], 0.06, (f, at) => this.bell(v, at + 0.4, f, 0.04, 0.5));
        this.noise(v, t + 0.36, 0.6, 0.03, 'highpass', 6000, { a: 0.15, s: 1, r: 0.3 });
        break;
      }
      // ---- UI
      case 'count':
        this.osc(v, t, F(24), 'sine', 0.14, 0.06);
        this.osc(v, t, F(36), 'triangle', 0.03, 0.02);
        break;
      case 'go':
        arp([24, 28, 31], 0.012, (f, at) => this.bell(v, at, f, 0.07, 0.45, 3.5, 0.8));
        this.osc(v, t, F(36), 'sine', 0.05, 0.3);
        break;
      case 'click':
        this.osc(v, t, 1100, 'sine', 0.07, 0.03, { f1: 800 });
        break;
      case 'error':    // soft 'bwmp' (not the reserved double square)
        this.osc(v, t, 330, 'triangle', 0.13, 0.16, { f1: 230, g: 0.12, lp: 1400 });
        break;
      case 'reward':
        arp([24, 28, 31, 36, 40], 0.06, (f, at) => this.bell(v, at, f, 0.055, 0.35));
        [12, 16, 19].forEach(s => this.osc(v, t, F(s), 'sine', 0.035, 0.6, { a: 0.02, s: 0.6, r: 0.3 }));
        break;
      case 'unlock':
        for (let k = 0; k < 10; k++) this.osc(v, t + k * 0.04, F(12 + pent(k)), 'triangle', 0.06, 0.18);
        arp([24, 28, 31, 36], 0.02, (f, at) => this.bell(v, at + 0.45, f, 0.05, 0.9));
        this.noise(v, t, 0.9, 0.04, 'highpass', 6000, { a: 0.2, s: 1, r: 0.3 });
        break;
      case 'star': {   // stage star pop (arg = star 0..2 → do, mi, sol)
        const s = [0, 4, 7][((Math.round(arg) % 3) + 3) % 3];
        this.noise(v, t, 0.03, 0.14, 'bandpass', 1800, { a: 0.001 });
        this.osc(v, t, 400, 'sine', 0.08, 0.06, { f1: 900 });
        this.bell(v, t + 0.03, F(24 + s), 0.12, 0.5);
        this.osc(v, t + 0.06, F(36 + s), 'triangle', 0.03, 0.2);
        break;
      }
      case 'warn':     // RESERVED (GDD §11.5): the double short square, only for v2 moving-hazard warnings
        this.osc(v, t, 880, 'square', 0.07, 0.06, { lp: 3000, s: 0.9, r: 0.02 });
        this.osc(v, t + 0.1, 880, 'square', 0.07, 0.06, { lp: 3000, s: 0.9, r: 0.02 });
        break;
    }
  }
}
