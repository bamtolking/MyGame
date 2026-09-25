// Audio engine: pre-rendered, layered sound effects (see sfx.ts) played with pitch variation, stereo
// position relative to the hero and a shared convolution reverb; adaptive music (see music.ts) with a
// combat layer that swells when monsters close in. Starts only after a user gesture.
import { Rand, SR } from './dsp';
import { renderNote, trackFor, type Inst, type Music, type NoteOut, type TrackDef } from './music';
import { WARM_CORE, renderSfx, resolveSfx, sfxMeta, type SfxMeta } from './sfx';

export type { Music };

interface Track { def: TrackDef; bus: GainNode; combat: GainNode; step: number; next: number; r: Rand; name: Music }

const SUSTAINED = new Set<Inst>(['pad', 'choir', 'choirO', 'cello', 'brass', 'wind', 'whisper', 'swell']);
const VARIED = new Set<Inst>(['taiko', 'frame', 'hat', 'tom']);
const NOTE_CAP = 5_000_000; // samples kept in the note cache (~20 MB)
const BOSS_SFX = ['bossRoar', 'bossSwing', 'bossCast', 'breath', 'meteor'];

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode; private sfxBus!: GainNode; private musicBus!: GainNode; private muffleF!: BiquadFilterNode;
  private verb!: ConvolverNode; private sfxVerbIn!: GainNode; private musicVerbIn!: GainNode;
  sfxVol = 0.75; bgmVol = 0.55;
  private bank = new Map<string, AudioBuffer[]>();
  private notes = new Map<string, AudioBuffer>();
  private noteSamples = 0;
  private last = new Map<string, number>();
  private voices = new Map<string, number[]>();
  private active: number[] = [];
  private warmQ: (() => void)[] = [];
  private music: Music = 'none';
  private track: Track | null = null;
  private lx = 0; private ly = 0;
  private intensity = 0; private combatLvl = 0;
  private varN = 0;

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = W.AudioContext ?? W.webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -4; limiter.knee.value = 2; limiter.ratio.value = 16; limiter.attack.value = 0.002; limiter.release.value = 0.2;
      limiter.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = 0.95; this.master.connect(limiter);
      const glue = c.createDynamicsCompressor();
      glue.threshold.value = -20; glue.knee.value = 8; glue.ratio.value = 3; glue.attack.value = 0.005; glue.release.value = 0.18;
      glue.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.connect(glue);
      this.muffleF = c.createBiquadFilter(); this.muffleF.type = 'lowpass'; this.muffleF.frequency.value = 20000; this.muffleF.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(this.muffleF);
      this.verb = c.createConvolver(); this.verb.buffer = this.impulse(c, 3.2);
      const verbOut = c.createGain(); verbOut.gain.value = 0.55; this.verb.connect(verbOut); verbOut.connect(this.master);
      this.sfxVerbIn = c.createGain(); this.sfxVerbIn.connect(this.verb);
      this.musicVerbIn = c.createGain(); this.musicVerbIn.connect(this.verb);
      this.setVolumes(this.sfxVol, this.bgmVol);
      for (const n of WARM_CORE) this.queueSfx(n);
      if (this.music !== 'none') this.startTrack();
    } catch { this.ctx = null; }
  }
  setVolumes(sfx: number, bgm: number): void {
    this.sfxVol = sfx; this.bgmVol = bgm;
    if (!this.ctx) return;
    this.sfxBus.gain.value = sfx; this.sfxVerbIn.gain.value = sfx;
    this.musicBus.gain.value = bgm * 0.7; this.musicVerbIn.gain.value = bgm * 0.7;
  }
  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }
  /** Renders sounds that are about to be needed (class skills, the zone's monsters) in the background. */
  prepare(names: string[]): void { for (const n of names) { const id = resolveSfx(n); if (id) this.queueSfx(id); } }
  /** Hero position: sound effects are panned and attenuated relative to it. */
  listen(x: number, y: number): void { this.lx = x; this.ly = y; }
  /** 0..1 — how hard the fight is; drives the music's combat layer. */
  setIntensity(v: number): void { this.intensity = Math.max(0, Math.min(1, v)); }
  /** Briefly muffles the music (boss kill, hero death). */
  muffle(sec: number): void {
    if (!this.ctx) return;
    const f = this.muffleF.frequency, t = this.ctx.currentTime;
    f.cancelScheduledValues(t); f.setValueAtTime(500, t); f.exponentialRampToValueAtTime(20000, t + sec);
  }

  /** Stereo room impulse: early reflections, then a tail that darkens as it decays. */
  private impulse(c: AudioContext, dur: number): AudioBuffer {
    const sr = c.sampleRate, n = Math.floor(sr * dur), ir = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      const r = new Rand(ch ? 91 : 17);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        lp += (r.bi() - lp) * (0.06 + 0.9 * Math.exp(-t * 2.5));
        d[i] = lp * Math.exp((-t * 6.9) / dur) * Math.min(1, t / 0.015);
      }
      for (let e = 0; e < 10; e++) { const at = Math.floor(sr * r.range(0.006, 0.09)); d[at] += r.bi() * 0.6 * (1 - at / (sr * 0.1)); }
    }
    return ir;
  }

  // ------------------------------------------------------------ sfx
  private queueSfx(id: string, front = false): void {
    const meta = sfxMeta(id);
    if (!meta || this.bank.has(id)) return;
    const task = (): void => { this.sfxBuffers(id, meta); };
    if (front) this.warmQ.unshift(task); else this.warmQ.push(task);
  }
  private sfxBuffers(id: string, meta: SfxMeta): AudioBuffer[] {
    let b = this.bank.get(id);
    if (!b) {
      b = [];
      for (let v = 0; v < meta.v; v++) {
        const data = renderSfx(id, v);
        const ab = this.ctx!.createBuffer(1, data.length, SR);
        ab.getChannelData(0).set(data);
        b.push(ab);
      }
      this.bank.set(id, b);
    }
    return b;
  }

  play(name: string, vol = 1, x?: number, y?: number): void {
    const c = this.ctx;
    if (!c || this.sfxVol <= 0 || c.state !== 'running') return;
    const id = resolveSfx(name);
    if (!id) return;
    const meta = sfxMeta(id)!;
    const now = c.currentTime;
    if ((now - (this.last.get(id) ?? -9)) * 1000 < meta.cd) return;
    const vs = (this.voices.get(id) ?? []).filter((e) => e > now);
    if (vs.length >= meta.max) return;
    this.active = this.active.filter((e) => e > now);
    if (this.active.length > 30 && meta.g < 0.6) return;
    let pan = 0, dist = 1;
    if (x !== undefined && y !== undefined) {
      const dx = x - this.lx, dy = y - this.ly;
      pan = Math.max(-0.8, Math.min(0.8, (dx - dy) / 10));
      dist = 1 / (1 + Math.max(0, Math.hypot(dx, dy) - 2.5) * 0.13);
      if (dist < 0.12) return;
    }
    const bufs = this.sfxBuffers(id, meta);
    const b = bufs[Math.floor(Math.random() * bufs.length)];
    const rate = 1 + (Math.random() * 2 - 1) * meta.pj;
    const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = vol * meta.g * dist;
    src.connect(g);
    let out: AudioNode = g;
    if (pan !== 0 && typeof c.createStereoPanner === 'function') { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(this.sfxBus);
    if (meta.verb > 0) { const s = c.createGain(); s.gain.value = meta.verb * (1.4 - dist * 0.4); out.connect(s); s.connect(this.sfxVerbIn); }
    src.start(now);
    const end = now + b.duration / rate;
    this.last.set(id, now); vs.push(end); this.voices.set(id, vs); this.active.push(end);
  }

  // ------------------------------------------------------------ music
  setMusic(m: Music): void {
    if (m === this.music) return;
    this.music = m;
    if (m === 'boss') for (const s of BOSS_SFX) this.queueSfx(s, true);
    if (this.ctx) this.startTrack();
  }
  private startTrack(): void {
    const c = this.ctx!, t = c.currentTime;
    if (this.track) {
      const old = this.track;
      old.bus.gain.cancelScheduledValues(t); old.bus.gain.setTargetAtTime(0, t, 0.5);
      setTimeout(() => { try { old.bus.disconnect(); } catch { /* already gone */ } }, 4000);
      this.track = null;
    }
    const def = trackFor(this.music);
    if (!def) return;
    const bus = c.createGain(); bus.gain.setValueAtTime(0.0001, t); bus.gain.linearRampToValueAtTime(1, t + 2);
    bus.connect(this.musicBus);
    const combat = c.createGain(); combat.gain.value = 0; combat.connect(bus);
    this.combatLvl = 0;
    this.track = { def, bus, combat, step: 0, next: t + 0.8, r: new Rand(7 + this.music.length * 31), name: this.music };
    for (const [inst, m, dur] of [...def.warm].reverse()) this.warmQ.unshift(() => { this.note(inst, m, dur); });
  }
  private note(inst: Inst, m: number, dur: number): AudioBuffer {
    const d = SUSTAINED.has(inst) ? Math.round(dur * 10) / 10 : 0;
    const v = VARIED.has(inst) ? this.varN++ % 3 : 0;
    const key = `${inst}|${m}|${d}|${v}`;
    let b = this.notes.get(key);
    if (b) { this.notes.delete(key); this.notes.set(key, b); return b; }
    const { data, sr } = renderNote(inst, m, d, v + 1);
    b = this.ctx!.createBuffer(1, data.length, sr);
    b.getChannelData(0).set(data);
    this.notes.set(key, b);
    this.noteSamples += data.length;
    for (const [k, old] of this.notes) {
      if (this.noteSamples <= NOTE_CAP) break;
      if (k === key) continue;
      this.notes.delete(k); this.noteSamples -= old.length;
    }
    return b;
  }
  private readonly out: NoteOut = (inst, m, when, vol, o = {}) => {
    const c = this.ctx!, tr = this.track;
    if (!tr) return;
    if (o.layer === 'combat' && this.combatLvl < 0.02) return;
    const b = this.note(inst, m, o.dur ?? 0);
    const src = c.createBufferSource(); src.buffer = b;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(g);
    let out: AudioNode = g;
    if (o.pan && typeof c.createStereoPanner === 'function') { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; }
    out.connect(o.layer === 'combat' ? tr.combat : tr.bus);
    const send = c.createGain(); send.gain.value = o.verb ?? 0.35; out.connect(send); send.connect(this.musicVerbIn);
    src.start(Math.max(when, c.currentTime));
  };

  tick(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const t0 = performance.now();
    while (this.warmQ.length && performance.now() - t0 < 5) this.warmQ.shift()!();
    const tr = this.track;
    if (!tr || this.bgmVol <= 0) return;
    const now = c.currentTime;
    const dungeon = tr.name.startsWith('dungeon');
    const target = dungeon ? this.intensity : 0;
    this.combatLvl += (target - this.combatLvl) * (target > this.combatLvl ? 0.03 : 0.006);
    tr.combat.gain.setTargetAtTime(this.combatLvl, now, 0.15);
    if (tr.next < now - 0.3) tr.next = now + 0.05;
    while (tr.next < now + 0.35) {
      tr.def.play(tr.step, tr.next, this.out, tr.r);
      tr.step++; tr.next += tr.def.step;
    }
  }
}
