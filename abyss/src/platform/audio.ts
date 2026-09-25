// Procedural WebAudio: synthesized sound effects and adaptive music (plucked-string town theme,
// dark drones in the dungeon, drums for boss fights). Starts only after a user gesture.
type Music = 'none' | 'title' | 'town' | 'dungeon1' | 'dungeon2' | 'dungeon3' | 'dungeon4' | 'boss';

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxBus!: GainNode; musicBus!: GainNode; verb!: ConvolverNode; verbGain!: GainNode;
  sfxVol = 0.75; bgmVol = 0.55;
  private noiseBuf: AudioBuffer | null = null;
  private last = new Map<string, number>();
  private music: Music = 'none';
  private next = 0; private step = 0;
  private drones: { o: OscillatorNode; g: GainNode }[] = [];
  private pluckCache = new Map<number, AudioBuffer>();

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(comp);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.bgmVol * 0.5; this.musicBus.connect(comp);
      // simple reverb (decaying noise impulse)
      this.verb = c.createConvolver();
      const len = Math.floor(c.sampleRate * 2.2); const ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.verb.buffer = ir;
      this.verbGain = c.createGain(); this.verbGain.gain.value = 0.35;
      this.verb.connect(this.verbGain); this.verbGain.connect(comp);
      const n = Math.floor(c.sampleRate * 1.5); this.noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  setVolumes(sfx: number, bgm: number): void {
    this.sfxVol = sfx; this.bgmVol = bgm;
    if (this.ctx) { this.sfxBus.gain.value = sfx; this.musicBus.gain.value = bgm * 0.5; }
  }
  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }

  // ------------------------------------------------------------ primitives
  private env(g: GainNode, t: number, a: number, peak: number, dur: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }
  tone(freq: number, dur: number, type: OscillatorType, vol: number, o: { slide?: number; delay?: number; attack?: number; dest?: AudioNode; verb?: number; vib?: number; detune?: number } = {}): void {
    const c = this.ctx!; const t = c.currentTime + (o.delay ?? 0);
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + o.slide), t + dur);
    if (o.vib) { const l = c.createOscillator(); const lg = c.createGain(); l.frequency.value = 6; lg.gain.value = o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + (o.attack ?? 0.005) + 0.1); }
    this.env(g, t, o.attack ?? 0.005, vol, dur);
    osc.connect(g); g.connect(o.dest ?? this.sfxBus);
    if (o.verb) { const vg = c.createGain(); vg.gain.value = o.verb; g.connect(vg); vg.connect(this.verb); }
    osc.start(t); osc.stop(t + (o.attack ?? 0.005) + dur + 0.05);
  }
  noise(dur: number, vol: number, type: BiquadFilterType, freq: number, o: { delay?: number; sweep?: number; q?: number; attack?: number; dest?: AudioNode; verb?: number } = {}): void {
    const c = this.ctx!; if (!this.noiseBuf) return;
    const t = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = o.q ?? 0.8;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + o.sweep), t + dur);
    const g = c.createGain(); this.env(g, t, o.attack ?? 0.004, vol, dur);
    src.connect(f); f.connect(g); g.connect(o.dest ?? this.sfxBus);
    if (o.verb) { const vg = c.createGain(); vg.gain.value = o.verb; g.connect(vg); vg.connect(this.verb); }
    src.start(t, Math.random()); src.stop(t + dur + (o.attack ?? 0.004) + 0.05);
  }
  private pluck(freq: number, vol: number, delay: number, dest: AudioNode): void {
    const c = this.ctx!;
    const key = Math.round(freq);
    let buf = this.pluckCache.get(key);
    if (!buf) {
      // Karplus-Strong string
      const sr = c.sampleRate, len = Math.floor(sr * 2.2), N = Math.max(2, Math.round(sr / freq));
      buf = c.createBuffer(1, len, sr);
      const d = buf.getChannelData(0); const ring = new Float32Array(N);
      for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
      let p = 0;
      for (let i = 0; i < len; i++) { const nx = (p + 1) % N; const v = (ring[p] + ring[nx]) * 0.5 * 0.996; d[i] = ring[p]; ring[p] = v; p = nx; }
      this.pluckCache.set(key, buf);
    }
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain(); g.gain.value = vol;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    s.connect(f); f.connect(g); g.connect(dest);
    const vg = c.createGain(); vg.gain.value = 0.5; g.connect(vg); vg.connect(this.verb);
    s.start(t); s.stop(t + 2.2);
  }

  // ------------------------------------------------------------ sfx
  play(name: string, vol = 1): void {
    if (!this.ctx || this.sfxVol <= 0 || this.ctx.state !== 'running') return;
    const now = performance.now();
    const gap = name === 'hit' || name.startsWith('mshoot') || name === 'heroHit' ? 55 : name.startsWith('die_') ? 40 : name === 'gold' ? 60 : 25;
    if (now - (this.last.get(name) ?? 0) < gap) return;
    this.last.set(name, now);
    const v = vol;
    if (name.startsWith('die_')) { this.death(name.slice(4), v); return; }
    if (name.startsWith('mshoot_')) { this.mshoot(name.slice(7), v * 0.6); return; }
    switch (name) {
      case 'swing': this.noise(0.14, 0.18 * v, 'bandpass', 700, { sweep: 1800, q: 1.2 }); break;
      case 'hit': this.noise(0.08, 0.3 * v, 'lowpass', 1600); this.tone(140, 0.12, 'sine', 0.3 * v, { slide: -80 }); break;
      case 'bash': this.noise(0.1, 0.35 * v, 'lowpass', 1400); this.tone(110, 0.2, 'sine', 0.4 * v, { slide: -60 }); this.tone(620, 0.12, 'square', 0.05 * v, { slide: -200 }); break;
      case 'cleave': this.noise(0.28, 0.24 * v, 'bandpass', 500, { sweep: 2200, q: 1 }); this.tone(120, 0.18, 'sine', 0.25 * v, { slide: -60, delay: 0.1 }); break;
      case 'warcry': this.tone(130, 0.7, 'sawtooth', 0.14 * v, { vib: 12, attack: 0.05, verb: 0.6 }); this.tone(196, 0.6, 'sawtooth', 0.08 * v, { vib: 10, attack: 0.05 }); this.noise(0.5, 0.12 * v, 'lowpass', 600, { attack: 0.05 }); break;
      case 'stomp': case 'meteor': this.tone(70, 0.6, 'sine', 0.6 * v, { slide: -40 }); this.noise(0.6, 0.4 * v, 'lowpass', 500, { sweep: -300, verb: 0.4 }); break;
      case 'berserk': this.tone(90, 0.6, 'sawtooth', 0.16 * v, { slide: 80, vib: 8 }); this.noise(0.4, 0.12 * v, 'lowpass', 900); break;
      case 'explode': this.noise(0.5, 0.45 * v, 'lowpass', 1000, { sweep: -700, verb: 0.3 }); this.tone(80, 0.35, 'sine', 0.35 * v, { slide: -45 }); break;
      case 'frost': case 'cast_frostnova': for (let i = 0; i < 5; i++) this.tone(1800 + Math.random() * 1600, 0.3, 'sine', 0.06 * v, { delay: i * 0.03, verb: 0.5 }); this.noise(0.3, 0.12 * v, 'highpass', 4000); break;
      case 'lightning': case 'thunder': this.noise(0.35, 0.35 * v, 'highpass', 2500, { verb: 0.2 }); for (let i = 0; i < 4; i++) this.noise(0.04, 0.25 * v, 'bandpass', 3000, { delay: i * 0.05 + Math.random() * 0.03 }); this.tone(1200, 0.15, 'sawtooth', 0.06 * v, { slide: -900 }); if (name === 'thunder') this.tone(55, 0.8, 'sine', 0.4 * v, { slide: -20 }); break;
      case 'teleport': case 'cast_teleport': this.tone(300, 0.3, 'sine', 0.14 * v, { slide: 1100, verb: 0.6 }); this.noise(0.25, 0.08 * v, 'highpass', 5000); break;
      case 'block': this.tone(900, 0.12, 'square', 0.07 * v, { slide: -300 }); this.tone(1400, 0.15, 'triangle', 0.08 * v); this.noise(0.05, 0.2 * v, 'highpass', 3000); break;
      case 'heroHit': this.noise(0.07, 0.22 * v, 'lowpass', 900); this.tone(170, 0.12, 'sawtooth', 0.06 * v, { slide: -60 }); break;
      case 'heroDeath': this.tone(220, 1.4, 'sawtooth', 0.14 * v, { slide: -170, verb: 0.8 }); this.tone(110, 1.6, 'sine', 0.3 * v, { slide: -60 }); break;
      case 'levelup': [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.11 * v, { delay: i * 0.08, verb: 0.7 })); this.tone(1568, 1.2, 'sine', 0.05 * v, { delay: 0.4, verb: 1 }); break;
      case 'gold': for (let i = 0; i < 3; i++) this.tone(2200 + Math.random() * 900, 0.09, 'sine', 0.06 * v, { delay: i * 0.045 }); break;
      case 'potPick': case 'pickup': this.noise(0.05, 0.12 * v, 'bandpass', 1800); this.tone(900, 0.08, 'sine', 0.06 * v, { delay: 0.03 }); break;
      case 'drop': this.noise(0.08, 0.2 * v, 'lowpass', 700); break;
      case 'equip': this.noise(0.12, 0.16 * v, 'bandpass', 1300, { q: 2 }); this.tone(700, 0.08, 'triangle', 0.06 * v, { delay: 0.05 }); break;
      case 'potion': for (let i = 0; i < 3; i++) this.tone(320 - i * 40, 0.08, 'sine', 0.14 * v, { delay: i * 0.1, slide: -80 }); break;
      case 'error': this.tone(140, 0.15, 'square', 0.06 * v); break;
      case 'nomana': this.tone(260, 0.12, 'triangle', 0.08 * v, { slide: -80 }); break;
      case 'barrel': this.noise(0.18, 0.3 * v, 'bandpass', 600, { q: 1.5 }); this.tone(180, 0.1, 'square', 0.06 * v, { slide: -60 }); break;
      case 'chest': this.tone(200, 0.35, 'sawtooth', 0.05 * v, { slide: 80, vib: 20 }); this.tone(1600, 0.2, 'sine', 0.06 * v, { delay: 0.3 }); break;
      case 'stone': this.noise(0.5, 0.25 * v, 'lowpass', 300, { attack: 0.05 }); break;
      case 'shrine': [262, 330, 392, 523].forEach((f) => this.tone(f, 1.4, 'sine', 0.07 * v, { attack: 0.3, verb: 1 })); break;
      case 'portal': this.noise(0.8, 0.14 * v, 'bandpass', 400, { sweep: 1800, attack: 0.2, verb: 0.5 }); this.tone(520, 0.9, 'sine', 0.06 * v, { attack: 0.2, vib: 10, verb: 0.8 }); break;
      case 'waypoint': [523, 659, 784].forEach((f, i) => this.tone(f, 0.8, 'sine', 0.07 * v, { delay: i * 0.06, verb: 0.9 })); break;
      case 'stairs': for (let i = 0; i < 4; i++) this.noise(0.06, 0.18 * v, 'lowpass', 500, { delay: i * 0.13 }); break;
      case 'learn': this.tone(880, 0.3, 'triangle', 0.09 * v, { verb: 0.5 }); this.tone(1320, 0.4, 'sine', 0.05 * v, { delay: 0.08, verb: 0.5 }); break;
      case 'mswing': this.noise(0.1, 0.1 * v, 'bandpass', 900, { sweep: 900 }); break;
      case 'roar': this.tone(100, 0.5, 'sawtooth', 0.12 * v, { vib: 15, slide: -30 }); this.noise(0.4, 0.12 * v, 'lowpass', 500); break;
      case 'blink': this.tone(900, 0.15, 'sine', 0.08 * v, { slide: -600 }); break;
      case 'resurrect': [220, 277, 330].forEach((f) => this.tone(f, 0.9, 'sine', 0.06 * v, { attack: 0.2, slide: f * 0.5, verb: 1 })); break;
      case 'bossRoar': this.tone(70, 1.3, 'sawtooth', 0.22 * v, { vib: 9, slide: -25, attack: 0.08, verb: 0.8 }); this.tone(105, 1.1, 'sawtooth', 0.1 * v, { vib: 7, attack: 0.08 }); this.noise(1.0, 0.2 * v, 'lowpass', 400, { attack: 0.1 }); break;
      case 'bossCast': this.tone(160, 0.6, 'sawtooth', 0.1 * v, { slide: 200, verb: 0.6 }); this.noise(0.5, 0.15 * v, 'bandpass', 800, { sweep: 1200 }); break;
      case 'bossSwing': this.noise(0.25, 0.25 * v, 'bandpass', 400, { sweep: 1200 }); break;
      case 'bossDeath': this.noise(2.2, 0.4 * v, 'lowpass', 700, { sweep: -600, verb: 0.8 }); this.tone(60, 2.4, 'sawtooth', 0.2 * v, { slide: -35, verb: 0.8 }); [262, 311, 392, 523].forEach((f, i) => this.tone(f, 2.2, 'sine', 0.06 * v, { delay: 0.8 + i * 0.1, attack: 0.4, verb: 1 })); break;
      case 'breath': this.noise(1.3, 0.3 * v, 'bandpass', 600, { q: 0.6, attack: 0.1, sweep: 400 }); break;
      case 'uniqueDrop': this.tone(1320, 0.9, 'triangle', 0.1 * v, { verb: 1 }); this.tone(1980, 1.1, 'sine', 0.06 * v, { delay: 0.05, verb: 1 }); this.tone(660, 0.6, 'sine', 0.08 * v); break;
      case 'rareDrop': this.tone(1100, 0.5, 'triangle', 0.07 * v, { verb: 0.7 }); break;
      case 'itemDrop': this.noise(0.06, 0.12 * v, 'bandpass', 1500); break;
      case 'click': this.tone(1200, 0.03, 'square', 0.025 * v); break;
      case 'open': this.noise(0.12, 0.12 * v, 'bandpass', 900); break;
      // hero skills
      case 'cast_fireball': this.noise(0.3, 0.2 * v, 'bandpass', 500, { sweep: 900, q: 0.8 }); this.tone(220, 0.2, 'sawtooth', 0.04 * v, { slide: -80 }); break;
      case 'cast_chain': this.play('lightning', v); break;
      case 'cast_meteor': this.tone(1200, 0.9, 'sine', 0.05 * v, { slide: -1000, attack: 0.1 }); break;
      case 'cast_bolt': this.tone(900, 0.14, 'sine', 0.08 * v, { slide: -500 }); this.noise(0.08, 0.06 * v, 'highpass', 3000); break;
      case 'cast_shoot': case 'cast_multishot': case 'cast_explode': case 'cast_strafe': this.tone(420, 0.09, 'triangle', 0.1 * v, { slide: -180 }); this.noise(0.06, 0.12 * v, 'bandpass', 2400, { delay: 0.01 }); break;
      case 'cast_rain': for (let i = 0; i < 4; i++) this.tone(400 + i * 30, 0.08, 'triangle', 0.06 * v, { delay: i * 0.06, slide: -150 }); break;
      case 'cast_dash': case 'cast_leap': this.noise(0.25, 0.18 * v, 'bandpass', 600, { sweep: 1500 }); break;
      case 'cast_warcry': this.play('warcry', v); break;
      case 'cast_berserk': this.play('berserk', v); break;
      case 'cast_attack': case 'cast_bash': case 'cast_cleave': this.play('swing', v * 0.8); break;
    }
  }
  private death(art: string, v: number): void {
    switch (art) {
      case 'skeleton': case 'skelArcher': case 'skelMage': case 'ordes': for (let i = 0; i < 6; i++) this.noise(0.04, 0.15 * v, 'bandpass', 1800 + Math.random() * 1500, { delay: i * 0.05 + Math.random() * 0.03, q: 3 }); break;
      case 'zombie': case 'ghoul': case 'brute': this.tone(110, 0.5, 'sawtooth', 0.1 * v, { slide: -50, vib: 10 }); this.noise(0.3, 0.12 * v, 'lowpass', 500); break;
      case 'fallen': case 'shaman': this.tone(700, 0.25, 'square', 0.05 * v, { slide: -400 }); break;
      case 'bat': this.tone(2400, 0.12, 'sine', 0.06 * v, { slide: 800 }); break;
      case 'spider': this.noise(0.25, 0.14 * v, 'highpass', 3000); break;
      case 'wraith': this.tone(500, 0.8, 'sine', 0.08 * v, { slide: -300, vib: 18, verb: 0.9 }); break;
      case 'fireSpirit': this.noise(0.5, 0.16 * v, 'highpass', 2000, { sweep: -1500 }); break;
      case 'eye': this.noise(0.2, 0.2 * v, 'lowpass', 400); this.tone(300, 0.2, 'sine', 0.08 * v, { slide: -200 }); break;
      default: this.tone(130, 0.45, 'sawtooth', 0.1 * v, { slide: -60, vib: 8 }); this.noise(0.25, 0.12 * v, 'lowpass', 600);
    }
  }
  private mshoot(kind: string, v: number): void {
    switch (kind) {
      case 'arrow': this.tone(460, 0.07, 'triangle', 0.08 * v, { slide: -150 }); break;
      case 'firebolt': case 'fireball': case 'spit': this.noise(0.25, 0.18 * v, 'bandpass', 500, { sweep: 700 }); break;
      case 'coldbolt': this.tone(1600, 0.2, 'sine', 0.06 * v, { slide: -600 }); break;
      case 'lightning': case 'spark': this.noise(0.12, 0.18 * v, 'highpass', 3000); break;
      default: this.tone(600, 0.15, 'sine', 0.06 * v, { slide: -300 }); break;
    }
  }

  // ------------------------------------------------------------ music
  setMusic(m: Music): void {
    if (m === this.music) return;
    this.music = m;
    this.step = 0; this.next = 0;
    this.stopDrones();
    if (!this.ctx) return;
    if (m.startsWith('dungeon') || m === 'title') this.startDrones(m);
  }
  private stopDrones(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const d of this.drones) { try { d.g.gain.setTargetAtTime(0.0001, t, 0.6); d.o.stop(t + 3); } catch { /* ignore */ } }
    this.drones = [];
  }
  private startDrones(m: Music): void {
    const c = this.ctx!; const t = c.currentTime;
    const root = m === 'dungeon1' ? 55 : m === 'dungeon2' ? 49 : m === 'dungeon3' ? 46.25 : m === 'dungeon4' ? 41.2 : 55;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 2; lp.connect(this.musicBus);
    const lfo = c.createOscillator(); const lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    for (const [f, type, vol, det] of [[root, 'sawtooth', 0.09, -6], [root * 1.5, 'sawtooth', 0.05, 5], [root * 2, 'triangle', 0.05, 0], [root * (m === 'dungeon4' ? 1.414 : 1.2), 'sine', 0.04, 0]] as [number, OscillatorType, number, number][]) {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 4);
      o.connect(g); g.connect(lp); o.start();
      this.drones.push({ o, g });
    }
    this.drones.push({ o: lfo, g: lg });
  }

  tick(): void {
    if (!this.ctx || this.ctx.state !== 'running' || this.bgmVol <= 0) return;
    const c = this.ctx; const t = c.currentTime;
    if (this.next === 0) this.next = t + 0.1;
    const m = this.music;
    if (m === 'town' || m === 'title') {
      // 70 bpm 8th notes, Am - F - C - G / Am - Dm - E7 - Am (original arpeggio)
      const beat = 60 / 72 / 2;
      const chords: number[][] = [[220, 262, 330, 440], [175, 220, 262, 349], [131, 196, 262, 330], [196, 247, 294, 392], [220, 262, 330, 440], [147, 220, 294, 349], [165, 208, 247, 330], [220, 262, 330, 440]];
      const melody = [659, 0, 587, 523, 0, 494, 523, 0, 440, 0, 523, 587, 659, 0, 587, 0, 523, 0, 494, 440, 0, 392, 440, 0, 415, 0, 494, 587, 523, 0, 440, 0];
      while (this.next < t + 0.5) {
        const i = this.step; const bar = Math.floor(i / 8) % chords.length; const ch = chords[bar]; const pos = i % 8;
        const d = this.next - t;
        const pat = [0, 2, 1, 3, 2, 1, 3, 2];
        this.pluck(ch[pat[pos]] * (pos === 0 ? 0.5 : 1), pos === 0 ? 0.22 : 0.13, d, this.musicBus);
        if (m === 'town' && i % 2 === 0) { const n = melody[(i / 2) % melody.length]; if (n && bar % 4 !== 3 || (n && pos < 4)) this.pluck(n, 0.1, d, this.musicBus); }
        this.next += beat; this.step++;
      }
    } else if (m.startsWith('dungeon')) {
      // sparse bells and distant thuds over the drone
      while (this.next < t + 0.5) {
        const d = this.next - t;
        const r = Math.random();
        const root = m === 'dungeon1' ? 220 : m === 'dungeon2' ? 196 : m === 'dungeon3' ? 185 : 165;
        if (r < 0.18) { const ratios = [1, 1.2, 1.5, 1.8, 2, 2.4, 1.059]; const f = root * ratios[Math.floor(Math.random() * ratios.length)] * (Math.random() < 0.3 ? 2 : 1); this.tone(f, 2.5, 'sine', 0.035, { delay: d, attack: 0.02, dest: this.musicBus, verb: 1.2 }); this.tone(f * 2.76, 1.2, 'sine', 0.01, { delay: d, dest: this.musicBus, verb: 1 }); }
        else if (r < 0.26) { this.tone(50, 0.7, 'sine', 0.12, { delay: d, slide: -20, dest: this.musicBus, verb: 0.6 }); }
        else if (r < 0.3 && m === 'dungeon4') { this.noise(1.6, 0.03, 'bandpass', 300, { delay: d, attack: 0.6, dest: this.musicBus, verb: 1 }); }
        this.next += 0.9 + Math.random() * 1.2;
      }
    } else if (m === 'boss') {
      const beat = 60 / 126 / 2;
      while (this.next < t + 0.4) {
        const i = this.step; const d = this.next - t; const pos = i % 16;
        if (pos % 4 === 0 || pos === 10) this.tone(58, 0.3, 'sine', 0.35, { delay: d, slide: -25, dest: this.musicBus });
        if (pos === 4 || pos === 12) this.noise(0.12, 0.12, 'bandpass', 1400, { delay: d, dest: this.musicBus });
        if (pos % 2 === 1) this.noise(0.03, 0.03, 'highpass', 7000, { delay: d, dest: this.musicBus });
        if (pos === 0 && Math.floor(i / 16) % 2 === 0) [110, 131, 165].forEach((f) => this.tone(f, 1.2, 'sawtooth', 0.035, { delay: d, attack: 0.05, dest: this.musicBus }));
        if (pos === 0 && Math.floor(i / 16) % 2 === 1) [104, 123, 156].forEach((f) => this.tone(f, 1.2, 'sawtooth', 0.035, { delay: d, attack: 0.05, dest: this.musicBus }));
        this.next += beat; this.step++;
      }
    }
  }
}
