// Adaptive soundtrack: 12/8 국악-fusion songs per area. Layers (pad, gayageum, lead, janggu, big drums, bass) fade with intensity.
import { Rand, midiHz } from './synth.ts';

type Lead = 'daegeum' | 'haegeum' | 'taepyeongso';
type Hit = [number, string, number];
interface SongDef {
  key: string; bpm: number; root: number; scale: number[]; prog: number[]; lead: Lead; perc: Hit[]; drums: Hit[]; fill: Hit[]; arp: number[][]; bassSteps: number[];
  extra: Hit[]; seed: number; leadOct: number; gain: number;
}
const PYEONG = [0, 2, 5, 7, 9], GYEMYEON = [0, 3, 5, 7, 10];
const GUT: Hit[] = [[0, 'deong', 1], [2, 'gi', 0.5], [3, 'deok', 0.75], [4, 'kung', 0.55], [6, 'kung', 0.85], [8, 'gi', 0.45], [9, 'deok', 0.7], [10, 'kung', 0.5], [11, 'gi', 0.35]];
const JAJIN: Hit[] = [[0, 'deong', 1], [2, 'gi', 0.4], [3, 'kung', 0.7], [5, 'deok', 0.65], [6, 'deong', 0.85], [8, 'gi', 0.4], [9, 'kung', 0.75], [11, 'deok', 0.7]];
const WAR: Hit[] = [[0, 'taiko', 1], [6, 'buk', 0.85], [9, 'buk', 0.6]];
const WAR_FILL: Hit[] = [[0, 'taiko', 1], [3, 'buk', 0.7], [6, 'taiko', 0.9], [8, 'buk', 0.55], [9, 'buk', 0.7], [10, 'buk', 0.8], [11, 'buk', 0.95]];
const BOSS: Hit[] = [[0, 'taiko', 1], [3, 'buk', 0.75], [6, 'taiko', 0.95], [8, 'buk', 0.5], [9, 'buk', 0.8], [11, 'buk', 0.65]];
const ARP_SLOW = [[0, 0], [3, 2], [6, 4], [9, 2]], ARP_FLOW = [[0, 0], [2, 2], [4, 4], [6, 5], [8, 4], [10, 2]], ARP_TREM = [[0, 0], [1, 0], [2, 0], [3, 2], [4, 2], [5, 2], [6, 4], [7, 4], [8, 4], [9, 5], [10, 4], [11, 2]], ARP_DRIP = [[0, 5], [5, 7], [8, 4]];
export const SONGS: Record<string, SongDef> = {
  town: { key: 'town', bpm: 64, root: 55, scale: PYEONG, prog: [0, 0, 3, 2, 0, 3, 1, 0], lead: 'daegeum', perc: GUT, drums: [], fill: [], arp: ARP_SLOW, bassSteps: [0], extra: [[0, 'moktak', 0.5], [6, 'moktak', 0.35]], seed: 11, leadOct: 12, gain: 0.9 },
  forest: { key: 'forest', bpm: 74, root: 50, scale: PYEONG, prog: [0, 3, 2, 0, 0, 3, 4, 2], lead: 'daegeum', perc: GUT, drums: WAR, fill: WAR_FILL, arp: ARP_FLOW, bassSteps: [0, 6], extra: [], seed: 23, leadOct: 24, gain: 0.9 },
  swamp: { key: 'swamp', bpm: 68, root: 52, scale: GYEMYEON, prog: [0, 0, 3, 2, 0, 4, 3, 0], lead: 'haegeum', perc: GUT, drums: WAR, fill: WAR_FILL, arp: ARP_DRIP, bassSteps: [0, 9], extra: [[0, 'shaker', 0.5], [4, 'shaker', 0.3], [8, 'shaker', 0.35]], seed: 37, leadOct: 12, gain: 0.95 },
  temple: { key: 'temple', bpm: 60, root: 57, scale: GYEMYEON, prog: [0, 3, 0, 4, 0, 3, 2, 0], lead: 'haegeum', perc: GUT, drums: WAR, fill: WAR_FILL, arp: ARP_SLOW, bassSteps: [0, 6], extra: [[0, 'moktak', 0.7], [3, 'moktak', 0.4], [6, 'bells', 0.4], [9, 'moktak', 0.4]], seed: 41, leadOct: 12, gain: 0.95 },
  valley: { key: 'valley', bpm: 96, root: 50, scale: GYEMYEON, prog: [0, 0, 3, 4, 0, 3, 2, 4], lead: 'daegeum', perc: JAJIN, drums: WAR, fill: WAR_FILL, arp: ARP_TREM, bassSteps: [0, 3, 6, 9], extra: [], seed: 59, leadOct: 24, gain: 0.9 },
  boss: { key: 'boss', bpm: 104, root: 49, scale: GYEMYEON, prog: [0, 0, 3, 3, 4, 4, 2, 1], lead: 'taepyeongso', perc: JAJIN, drums: BOSS, fill: WAR_FILL, arp: ARP_TREM, bassSteps: [0, 3, 6, 9], extra: [[0, 'kkwaeng', 0.35], [6, 'kkwaeng', 0.25]], seed: 71, leadOct: 24, gain: 1 },
};
export const ZONE_SONG = ['town', 'forest', 'swamp', 'temple', 'valley', 'boss'];
type Layer = 'pad' | 'pluck' | 'lead' | 'perc' | 'drums' | 'bass' | 'extra';
const LAYERS: Layer[] = ['pad', 'pluck', 'lead', 'perc', 'drums', 'bass', 'extra'];
const MIX: Record<Layer, number[]> = { pad: [0.34, 0.3, 0.26, 0.3], pluck: [0.5, 0.55, 0.5, 0.42], lead: [0.3, 0.28, 0.26, 0.34], perc: [0.28, 0.42, 0.55, 0.62], drums: [0, 0, 0.62, 0.78], bass: [0, 0.22, 0.46, 0.55], extra: [0.3, 0.28, 0.22, 0.25] };
const SEND: Record<Layer, number> = { pad: 0.5, pluck: 0.32, lead: 0.4, perc: 0.14, drums: 0.18, bass: 0.05, extra: 0.3 };

interface Note { bar: number; step: number; dur: number; deg: number; slide: boolean }
/** Generative 8-bar melody (A A' B A'') in the song's pentatonic mode, seeded so it's stable. */
function compose(song: SongDef): Note[] {
  const r = new Rand(song.seed); const RH = [[[0, 3], [3, 3], [6, 4], [10, 2]], [[0, 2], [2, 1], [3, 3], [6, 2], [8, 1], [9, 3]], [[0, 6], [6, 3], [9, 3]], [[0, 3], [3, 2], [5, 1], [6, 6]]];
  const notes: Note[] = []; let d = 5 + r.next() * 2 | 0;
  const phrase = (bar0: number, ending: boolean, vary: Note[] | null) => {
    if (vary) { for (const n of vary) notes.push({ ...n, bar: n.bar - vary[0].bar + bar0, deg: n.deg + (r.next() < 0.3 ? (r.next() < 0.5 ? 1 : -1) : 0) }); return; }
    for (let b = 0; b < 2; b++) {
      const rh = ending && b === 1 ? [[0, 4], [4, 2], [6, 6]] : RH[r.next() * RH.length | 0];
      rh.forEach(([step, dur], i) => {
        if (r.next() < 0.1 && !(ending && b === 1 && i === rh.length - 1)) return;
        const mv = r.next(); d += mv < 0.35 ? 1 : mv < 0.7 ? -1 : mv < 0.85 ? 2 : mv < 0.95 ? -2 : 0; d = Math.max(2, Math.min(9, d));
        if (ending && b === 1 && i === rh.length - 1) d = r.next() < 0.6 ? 5 : 3;
        notes.push({ bar: bar0 + b, step, dur, deg: d, slide: r.next() < 0.35 });
      });
    }
  };
  phrase(0, false, null); const A = notes.slice(); phrase(2, true, A); phrase(4, false, null); phrase(6, true, null);
  return notes;
}

export interface Bank { drum(name: string): AudioBuffer | null; gay(midi: number): AudioBuffer | null; geo(midi: number): AudioBuffer | null }

class SongPlayer {
  def: SongDef; out: GainNode; layers = {} as Record<Layer, GainNode>; melody: Note[]; lastLead = 0;
  constructor(ctx: AudioContext, def: SongDef, dest: AudioNode, rev: AudioNode) {
    this.def = def; this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest); this.melody = compose(def);
    for (const l of LAYERS) { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.out); const s = ctx.createGain(); s.gain.value = SEND[l]; g.connect(s); s.connect(rev); this.layers[l] = g; }
  }
}

export class Music {
  ctx: AudioContext; bank: Bank; dest: AudioNode; rev: AudioNode;
  cur: SongPlayer | null = null; old: SongPlayer[] = []; want = 'town'; intensity = 0; step = 0; bar = 0; nextT = 0; timer = 0;
  private noise: AudioBuffer; private waves: Record<string, PeriodicWave> = {};
  constructor(ctx: AudioContext, dest: AudioNode, rev: AudioNode, bank: Bank) {
    this.ctx = ctx; this.dest = dest; this.rev = rev; this.bank = bank;
    const n = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, n, ctx.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const wave = (amps: number[]) => { const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1); amps.forEach((a, i) => (im[i + 1] = a)); return ctx.createPeriodicWave(re, im); };
    this.waves.flute = wave([1, 0.32, 0.12, 0.05, 0.02]);
    this.waves.saw = wave(Array.from({ length: 24 }, (_, i) => 1 / (i + 1)));
    this.waves.reed = wave(Array.from({ length: 22 }, (_, i) => Math.pow(i + 1, -0.72) * (i % 2 ? 0.75 : 1)));
  }
  start(): void { if (this.timer) return; this.nextT = this.ctx.currentTime + 0.1; this.timer = window.setInterval(() => this.schedule(), 40); }
  stop(): void { clearInterval(this.timer); this.timer = 0; }
  /** song: town/forest/swamp/temple/valley/boss · intensity 0 calm, 1 exploring, 2 fighting, 3 boss */
  setScene(song: string, intensity: number): void { this.want = SONGS[song] ? song : 'town'; this.intensity = Math.max(0, Math.min(3, intensity | 0)); }

  private schedule(): void {
    const ctx = this.ctx; if (ctx.state !== 'running') return;
    if (this.nextT < ctx.currentTime - 0.5) this.nextT = ctx.currentTime + 0.05; // tab was asleep
    while (this.nextT < ctx.currentTime + 0.3) {
      if (this.step === 0) this.onBar(this.nextT);
      if (this.cur) this.playStep(this.cur, this.step, this.nextT);
      const bpm = this.cur?.def.bpm ?? 70; this.nextT += 60 / (bpm * 3); this.step = (this.step + 1) % 12; if (this.step === 0) this.bar++;
    }
  }
  private onBar(t: number): void {
    if (!this.cur || this.cur.def.key !== this.want) {
      if (this.cur) { const o = this.cur; o.out.gain.setTargetAtTime(0, t, 0.6); this.old.push(o); setTimeout(() => { o.out.disconnect(); this.old = this.old.filter(x => x !== o); }, 6000); }
      this.cur = new SongPlayer(this.ctx, SONGS[this.want], this.dest, this.rev); this.cur.out.gain.setTargetAtTime(this.cur.def.gain, t, 0.5); this.bar = 0;
    }
    const lvl = this.cur.def.key === 'town' ? 0 : this.cur.def.key === 'boss' ? 3 : Math.max(1, this.intensity);
    for (const l of LAYERS) this.cur.layers[l].gain.setTargetAtTime(MIX[l][lvl] * (l === 'lead' && (this.bar % 16) >= 8 && lvl < 3 ? 0 : 1), t, 0.7);
  }
  private playStep(sp: SongPlayer, step: number, t: number): void {
    const d = sp.def, bar = this.bar, L = sp.layers; const chord = d.prog[bar % d.prog.length]; const sd = 60 / (d.bpm * 3);
    const deg = (k: number, oct: number) => d.root + oct + 12 * Math.floor(k / 5) + d.scale[((k % 5) + 5) % 5];
    // janggu
    for (const [s, name, v] of d.perc) if (s === step) this.drum(name, t, v * (0.85 + Math.random() * 0.2), L.perc);
    for (const [s, name, v] of d.extra) if (s === step) this.drum(name, t, v, L.extra);
    // big drums (fill on the 4th bar of each phrase), jing on phrase starts
    const drums = bar % 4 === 3 ? d.fill : d.drums; for (const [s, name, v] of drums) if (s === step) this.drum(name, t, v, L.drums);
    if (step === 0 && (bar % (d.key === 'boss' ? 2 : 4) === 0) && d.drums.length) this.drum('jing', t, 0.7, L.drums);
    // gayageum arpeggio over the bar's chord
    for (const [s, k] of d.arp) if (s === step) { const b = this.bank.gay(deg(chord + k, 12)); if (b) this.sample(b, t, 0.55 + Math.random() * 0.2, L.pluck, (Math.random() - 0.5) * 0.5); }
    // bass (geomungo) on the chord root
    if (d.bassSteps.includes(step)) { const b = this.bank.geo(deg(chord, -12)); if (b) this.sample(b, t, step === 0 ? 0.95 : 0.7, L.bass, 0); if (step === 0 && d.key === 'boss') this.sub(midiHz(deg(chord, -24)), t, sd * 5, L.bass); }
    // pad chord (root + fifth) once per bar
    if (step === 0) { this.pad(midiHz(deg(chord, 0)), t, sd * 14, L.pad); this.pad(midiHz(deg(chord + 2, 0)), t, sd * 14, L.pad); }
    // lead melody
    for (const n of sp.melody) if (n.bar === bar % 8 && n.step === step) { const m = deg(n.deg, d.leadOct - 12); this.lead(d.lead, m, t, n.dur * sd, n.slide, L.lead, sp); }
  }
  // ---------- voices ----------
  private drum(name: string, t: number, vel: number, dest: AudioNode): void { const b = this.bank.drum(name); if (b) this.sample(b, t, vel, dest, name === 'deok' || name === 'gi' ? 0.25 : name === 'kung' ? -0.2 : 0); }
  private sample(buf: AudioBuffer, t: number, vel: number, dest: AudioNode, pan: number): void {
    const ctx = this.ctx, s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = vel;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; s.connect(g); g.connect(p); p.connect(dest); } else { s.connect(g); g.connect(dest); }
    s.start(t); s.onended = () => g.disconnect();
  }
  private pad(f: number, t: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 720; lp.Q.value = 0.6; lp.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 1.1); g.gain.setValueAtTime(0.16, t + dur - 0.2); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);
    for (const det of [-7, 6]) { const o = ctx.createOscillator(); o.setPeriodicWave(this.waves.saw); o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 1.7); }
    setTimeout(() => g.disconnect(), (t - ctx.currentTime + dur + 2) * 1000);
  }
  private sub(f: number, t: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur + 0.05);
  }
  private lead(kind: Lead, midi: number, t: number, dur: number, slide: boolean, dest: AudioNode, sp: SongPlayer): void {
    const ctx = this.ctx; const f = midiHz(midi); const o = ctx.createOscillator(), g = ctx.createGain();
    o.setPeriodicWave(kind === 'daegeum' ? this.waves.flute : kind === 'haegeum' ? this.waves.saw : this.waves.reed);
    const from = kind === 'haegeum' && sp.lastLead ? sp.lastLead : slide ? f * 0.94 : f; sp.lastLead = f;
    o.frequency.setValueAtTime(from, t); if (from !== f) o.frequency.exponentialRampToValueAtTime(f, t + (kind === 'haegeum' ? 0.13 : 0.09));
    // vibrato (농현) that blooms after the attack
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = kind === 'taepyeongso' ? 6.4 : kind === 'haegeum' ? 5.6 : 5.1;
    const depth = kind === 'daegeum' ? 14 : kind === 'haegeum' ? 28 : 32; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + Math.min(0.25, dur * 0.4)); lg.gain.linearRampToValueAtTime(depth, t + Math.min(0.7, dur));
    lfo.connect(lg); lg.connect(o.detune);
    let chain: AudioNode = o;
    if (kind !== 'daegeum') { const f1 = ctx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = kind === 'haegeum' ? 1100 : 1400; f1.Q.value = 1.3; f1.gain.value = kind === 'haegeum' ? 9 : 11; chain.connect(f1); chain = f1;
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = kind === 'haegeum' ? 4200 : 5200; chain.connect(f2); chain = f2; }
    chain.connect(g); g.connect(dest);
    const peak = kind === 'daegeum' ? 0.32 : kind === 'haegeum' ? 0.2 : 0.17; const att = kind === 'taepyeongso' ? 0.03 : 0.07; const end = t + Math.max(0.15, dur * 0.95);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setTargetAtTime(peak * 0.8, t + att, 0.3); g.gain.setTargetAtTime(0.0001, end, 0.07);
    o.start(t); lfo.start(t); o.stop(end + 0.5); lfo.stop(end + 0.5);
    if (kind === 'daegeum') { // breath noise through a band-pass tracking the note
      const n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.2; const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.09, t + 0.04); ng.gain.setTargetAtTime(0.025, t + 0.06, 0.15); ng.gain.setTargetAtTime(0.0001, end, 0.06);
      n.connect(bp); bp.connect(ng); ng.connect(dest); n.start(t, Math.random()); n.stop(end + 0.4); n.onended = () => ng.disconnect();
    }
    o.onended = () => g.disconnect();
  }
}
