// Audio engine: buses, reverb, compressor, spatialised SFX playback, background sample rendering, adaptive music.
import { SR, reverbIR, type Sample } from './synth.ts';
import { renderKey, hasKey } from './render.ts';
import { Music, SONGS } from './music.ts';
import SynthWorker from './synth.worker.ts?worker&inline';

interface Cfg { gap: number; max: number; vary: number; rev: number }
const DEF: Cfg = { gap: 30, max: 4, vary: 0.05, rev: 0.12 };
const CFG: Record<string, Partial<Cfg>> = {
  hit: { gap: 28, max: 8, vary: 0.12, rev: 0.05 }, hit_crit: { gap: 45, max: 4, vary: 0.08 }, hit_arrow: { gap: 30, max: 6, vary: 0.12, rev: 0.04 }, hit_magic: { gap: 40, max: 5, vary: 0.1 },
  slash: { gap: 60, max: 3, vary: 0.08, rev: 0.08 }, slash2: { gap: 60, max: 3, vary: 0.08, rev: 0.08 }, bow: { gap: 50, max: 3, vary: 0.06 }, cast: { gap: 70, max: 3 },
  kill: { gap: 32, max: 6, vary: 0.18, rev: 0.1 }, coin: { gap: 40, max: 5, vary: 0.1, rev: 0.08 }, soul: { gap: 120, max: 3, vary: 0.15, rev: 0.4 },
  thunder: { gap: 90, max: 3, rev: 0.25 }, frost: { gap: 150, max: 2, rev: 0.25 }, wisp_cast: { gap: 90, max: 3 }, wisp_boom: { gap: 50, max: 5, vary: 0.1 }, pierce: { gap: 80, max: 3 },
  bell: { gap: 300, max: 2, rev: 0.4, vary: 0.02 }, guard: { gap: 300, max: 2, rev: 0.3 }, whirl: { gap: 180, max: 2 }, tele: { gap: 140, max: 2, vary: 0 }, enemy_shot: { gap: 60, max: 4, vary: 0.15 },
  boom: { gap: 70, max: 4, vary: 0.08, rev: 0.2 }, slam: { gap: 150, max: 2, rev: 0.3 }, roar: { gap: 600, max: 1, rev: 0.3 }, level: { rev: 0.35, vary: 0 }, legend: { rev: 0.35, vary: 0 },
  quest: { rev: 0.3, vary: 0 }, ult_sword: { vary: 0, rev: 0.25 }, ult_archer: { vary: 0, rev: 0.25 }, ult_shaman: { vary: 0, rev: 0.35 }, horn: { vary: 0, rev: 0.45 }, click: { gap: 40, vary: 0.03, rev: 0 },
  open: { gap: 60, vary: 0.05, rev: 0 }, hurt: { gap: 120, max: 2, vary: 0.08, rev: 0.05 }, item: { rev: 0.25 }, item_epic: { rev: 0.3, vary: 0 }, down: { vary: 0, rev: 0.35 }, revive: { vary: 0, rev: 0.3 },
};
const DRUM_KEYS = ['deong', 'kung', 'deok', 'gi', 'buk', 'taiko', 'jing', 'kkwaeng', 'moktak', 'shaker', 'bells'];
const PRIORITY = ['click', 'open', 'hit', 'slash', 'slash2', 'bow', 'cast', 'hit_arrow', 'hit_magic', 'kill', 'coin', 'hurt', 'hit_crit', 'wisp_cast', 'wisp_boom', 'pierce', 'thunder', 'frost', 'bell', 'guard', 'whirl', 'tele', 'boom', 'enemy_shot', 'level', 'quest', 'item', 'soul', 'dash', 'ult_sword', 'ult_archer', 'ult_shaman', 'roar', 'slam', 'horn', 'kill_big', 'down', 'revive', 'tp', 'summon', 'blink', 'item_epic', 'legend', 'merge', 'emote', 'error'];

export class Sound {
  ctx: AudioContext | null = null; sfxVol = 0.7; bgmVol = 0.45; music: Music | null = null;
  private master!: GainNode; private sfx!: GainNode; private musicBus!: GainNode; private duckG!: GainNode; private revIn!: GainNode;
  private bufs = new Map<string, AudioBuffer>(); private queue: string[] = []; private queued = new Set<string>(); private pumping = false; private worker: Worker | null = null;
  private last = new Map<string, number>(); private voices = new Map<string, number>(); private lx = 0; private ly = 0; private scene: [string, number] = ['town', 0];

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      const c: AudioContext = new AC({ latencyHint: 'interactive' }); this.ctx = c;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.22;
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
      this.duckG = c.createGain(); this.duckG.connect(this.master); this.musicBus = c.createGain(); this.musicBus.gain.value = this.bgmVol; this.musicBus.connect(this.duckG);
      const rev = c.createConvolver(); rev.buffer = this.toBuffer(reverbIR(2.6, 2.2)); this.revIn = c.createGain(); this.revIn.gain.value = 0.9; this.revIn.connect(rev); rev.connect(this.master);
      try { this.worker = new SynthWorker(); this.worker.onmessage = (e) => this.onRendered(e.data); this.worker.onerror = () => { this.worker = null; this.requeueAll(); }; } catch { this.worker = null; }
      PRIORITY.slice(0, 12).forEach(k => this.want('sfx:' + k)); DRUM_KEYS.forEach(k => this.want('drum:' + k)); PRIORITY.slice(12).forEach(k => this.want('sfx:' + k));
      this.music = new Music(c, this.musicBus, this.revIn, { drum: (n) => this.get('drum:' + n), gay: (m) => this.get('gay:' + m), geo: (m) => this.get('geo:' + m) });
      this.prewarmSong(this.scene[0]); this.music.setScene(...this.scene); this.music.start();
    } catch (e) { console.warn('audio unavailable', e); this.ctx = null; }
  }
  setVolumes(sfx: number, bgm: number): void { this.sfxVol = sfx; this.bgmVol = bgm; if (this.ctx) { this.sfx.gain.value = sfx; this.musicBus.gain.value = bgm; } }
  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }
  listen(x: number, y: number): void { this.lx = x; this.ly = y; }
  /** Music scene: song key (town/forest/swamp/temple/valley/boss) + intensity 0..3. */
  setScene(song: string, intensity: number): void {
    if (this.scene[0] !== song) this.prewarmSong(song);
    this.scene = [song, intensity]; this.music?.setScene(song, intensity);
  }
  /** Briefly lowers the music under a big sound effect. */
  duck(depth = 0.45, sec = 0.6): void { const c = this.ctx; if (!c) return; const g = this.duckG.gain; g.cancelScheduledValues(c.currentTime); g.setTargetAtTime(1 - depth, c.currentTime, 0.02); g.setTargetAtTime(1, c.currentTime + sec, 0.25); }
  tick(): void { /* music schedules itself */ }

  /** Plays a sound effect; x/y (world) pan and attenuate it relative to the listener. */
  play(name: string, vol = 1, x?: number, y?: number): void {
    const c = this.ctx; if (!c || c.state !== 'running' || this.sfxVol <= 0) return;
    const buf = this.get('sfx:' + name); if (!buf) return;
    const cfg = { ...DEF, ...CFG[name] }; const now = performance.now();
    if (now - (this.last.get(name) ?? 0) < cfg.gap) return; if ((this.voices.get(name) ?? 0) >= cfg.max) return; this.last.set(name, now);
    let pan = 0, att = 1;
    if (x != null && y != null) { const dx = x - this.lx, dy = y - this.ly; pan = Math.max(-0.8, Math.min(0.8, dx / 520)); att = Math.max(0.12, Math.min(1, 1.25 - Math.hypot(dx, dy) / 900)); }
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = 1 + (Math.random() - 0.5) * 2 * cfg.vary;
    const g = c.createGain(); g.gain.value = vol * att; s.connect(g);
    let out: AudioNode = g; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(this.sfx); if (cfg.rev > 0) { const r = c.createGain(); r.gain.value = cfg.rev; out.connect(r); r.connect(this.revIn); }
    this.voices.set(name, (this.voices.get(name) ?? 0) + 1);
    s.onended = () => { g.disconnect(); this.voices.set(name, Math.max(0, (this.voices.get(name) ?? 1) - 1)); };
    s.start();
  }

  // ---------- sample cache ----------
  private toBuffer(s: Sample): AudioBuffer { const b = this.ctx!.createBuffer(2, s.l.length, SR); b.getChannelData(0).set(s.l); b.getChannelData(1).set(s.r); return b; }
  private get(key: string): AudioBuffer | null { const b = this.bufs.get(key); if (b) return b; this.want(key); return null; }
  /** Requests a sample: rendered in the synth worker (or on the main thread in small slices if workers are unavailable). */
  private want(key: string): void {
    if (this.queued.has(key) || this.bufs.has(key) || !hasKey(key)) return; this.queued.add(key);
    if (this.worker) { this.worker.postMessage({ key }); return; }
    this.queue.push(key); if (!this.pumping) { this.pumping = true; setTimeout(() => this.pump(), 0); }
  }
  private onRendered(d: { key: string; l?: Float32Array; r?: Float32Array; error?: string }): void {
    if (d.error || !d.l || !d.r || !this.ctx) { console.warn('sound render failed', d.key, d.error); return; }
    this.bufs.set(d.key, this.toBuffer({ l: d.l, r: d.r }));
  }
  private requeueAll(): void { for (const k of this.queued) if (!this.bufs.has(k)) this.queue.push(k); if (!this.pumping && this.queue.length) { this.pumping = true; setTimeout(() => this.pump(), 0); } }
  private pump(): void {
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < 8) { const k = this.queue.shift()!; try { this.bufs.set(k, this.toBuffer(renderKey(k))); } catch (e) { console.warn('sound render failed', k, e); } }
    if (this.queue.length) setTimeout(() => this.pump(), 16); else this.pumping = false;
  }
  private prewarmSong(key: string): void {
    const d = SONGS[key]; if (!d || !this.ctx) return; const notes = new Set<number>();
    for (const ch of d.prog) for (const [, k] of d.arp) { const kk = ch + k; notes.add(d.root + 12 + 12 * Math.floor(kk / 5) + d.scale[((kk % 5) + 5) % 5]); }
    for (const m of notes) this.want('gay:' + m);
    for (const ch of d.prog) this.want('geo:' + (d.root - 12 + 12 * Math.floor(ch / 5) + d.scale[ch % 5]));
  }
}
