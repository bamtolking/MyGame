// Procedural WebAudio SFX + simple BGM loop. Starts only after a user gesture.
export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxGain!: GainNode; bgmGain!: GainNode;
  bgmOn = false; private bgmTimer = 0; private bgmStep = 0; private bgmNext = 0;
  sfxVol = 0.7; bgmVol = 0.5;
  private last = new Map<string, number>();

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); const c = this.ctx!;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfxGain = c.createGain(); this.sfxGain.connect(this.master); this.sfxGain.gain.value = this.sfxVol;
      this.bgmGain = c.createGain(); this.bgmGain.connect(this.master); this.bgmGain.gain.value = this.bgmVol * 0.5;
    } catch { this.ctx = null; }
  }
  setVolumes(sfx: number, bgm: number): void { this.sfxVol = sfx; this.bgmVol = bgm; if (this.ctx) { this.sfxGain.gain.value = sfx; this.bgmGain.gain.value = bgm * 0.5; } }
  suspend(): void { this.ctx?.suspend(); }
  resume(): void { this.ctx?.resume(); }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest: GainNode, slide = 0, delay = 0): void {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + delay); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + delay + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + delay); g.gain.exponentialRampToValueAtTime(vol, c.currentTime + delay + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
    o.connect(g); g.connect(dest); o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur + 0.05);
  }
  private noise(dur: number, vol: number, filterFreq: number, delay = 0): void {
    const c = this.ctx!; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(c.currentTime + delay);
  }
  /** Rate-limited SFX by name. */
  play(name: string): void {
    if (!this.ctx || this.sfxVol <= 0) return;
    const now = performance.now(); const l = this.last.get(name) || 0; const minGap = name === 'hit' ? 60 : name.startsWith('shoot') ? 45 : 0;
    if (now - l < minGap) return; this.last.set(name, now);
    const S = this.sfxGain;
    switch (name) {
      case 'shoot_arrow': this.tone(900, 0.06, 'square', 0.05, S, -400); break;
      case 'shoot_cracker': this.tone(200, 0.12, 'sawtooth', 0.06, S, 200); break;
      case 'shoot_shard': this.tone(1400, 0.08, 'sine', 0.05, S, 600); break;
      case 'shoot_glob': this.tone(300, 0.1, 'triangle', 0.05, S, -150); break;
      case 'shoot_bolt': this.noise(0.08, 0.12, 4000); this.tone(1800, 0.05, 'square', 0.04, S, -900); break;
      case 'shoot_pulse': this.tone(160, 0.25, 'sine', 0.08, S, 90); break;
      case 'shoot_puff': this.noise(0.1, 0.05, 1200); break;
      case 'shoot_coin': this.tone(1600, 0.08, 'sine', 0.05, S); this.tone(2100, 0.1, 'sine', 0.04, S, 0, 0.05); break;
      case 'explode': this.noise(0.3, 0.25, 900); this.tone(90, 0.25, 'sine', 0.15, S, -60); break;
      case 'explode_big': this.noise(0.5, 0.35, 700); this.tone(60, 0.5, 'sine', 0.25, S, -40); break;
      case 'freeze': this.tone(2200, 0.25, 'sine', 0.08, S, -1400); this.tone(3000, 0.3, 'triangle', 0.04, S, -2000, 0.05); break;
      case 'armorbreak': this.noise(0.12, 0.2, 2500); this.tone(500, 0.1, 'square', 0.06, S, -300); break;
      case 'die': this.tone(400, 0.15, 'triangle', 0.06, S, -300); break;
      case 'die_boss': this.noise(0.8, 0.4, 500); this.tone(80, 0.9, 'sawtooth', 0.2, S, -60); this.tone(1200, 0.5, 'sine', 0.1, S, 400, 0.3); break;
      case 'exit': this.tone(220, 0.3, 'sawtooth', 0.12, S, -120); this.tone(160, 0.4, 'square', 0.08, S, -80, 0.1); break;
      case 'summon': this.tone(600, 0.1, 'sine', 0.08, S, 300); break;
      case 'summon_rare': [600, 800, 1000].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.08, S, 0, i * 0.06)); break;
      case 'summon_hero': [500, 750, 1000, 1500].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.1, S, 0, i * 0.08)); break;
      case 'summon_legend': [400, 600, 800, 1200, 1600, 2000].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, S, 0, i * 0.07)); this.noise(0.4, 0.1, 3000, 0.4); break;
      case 'merge': [700, 900, 1200].forEach((f, i) => this.tone(f, 0.15, 'sine', 0.1, S, 0, i * 0.07)); break;
      case 'mythic': [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, S, 0, i * 0.09)); this.noise(0.8, 0.15, 2000, 0.5); this.tone(1047, 1.2, 'sine', 0.1, S, 0, 0.7); break;
      case 'wave': this.tone(440, 0.12, 'square', 0.06, S); this.tone(660, 0.15, 'square', 0.06, S, 0, 0.12); break;
      case 'boss': [110, 110, 98].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.14, S, 0, i * 0.3)); break;
      case 'relic': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.1, S, 0, i * 0.1)); break;
      case 'gold': this.tone(1900, 0.06, 'sine', 0.04, S); break;
      case 'click': this.tone(1200, 0.04, 'square', 0.03, S); break;
      case 'error': this.tone(200, 0.15, 'square', 0.06, S, -50); break;
      case 'skill': this.noise(0.2, 0.15, 3000); this.tone(300, 0.3, 'sawtooth', 0.08, S, 400); break;
      case 'seal': this.tone(700, 0.3, 'sine', 0.08, S, -500); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, S, 0, i * 0.15)); break;
      case 'lose': [400, 350, 300, 200].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.1, S, -30, i * 0.25)); break;
    }
  }
  // ---- BGM: gentle pentatonic loop, scheduled in small chunks ----
  startBgm(): void { this.bgmOn = true; this.bgmNext = 0; }
  stopBgm(): void { this.bgmOn = false; }
  tick(): void {
    if (!this.ctx || !this.bgmOn || this.bgmVol <= 0) return;
    const c = this.ctx; if (c.state !== 'running') return;
    const t = c.currentTime;
    if (this.bgmNext === 0) this.bgmNext = t + 0.05;
    const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
    const bass = [130.8, 130.8, 98.0, 110.0];
    const stepDur = 0.22;
    while (this.bgmNext < t + 0.6) {
      const i = this.bgmStep; const bar = Math.floor(i / 8) % 4;
      if (i % 8 === 0) this.tone(bass[bar], stepDur * 7, 'triangle', 0.07, this.bgmGain, 0, this.bgmNext - t);
      const pat = [0, 2, 4, 2, 5, 4, 2, 0, 3, 4, 5, 7, 5, 4, 3, 2];
      const n = pat[(i + bar * 4) % pat.length];
      if (i % 2 === 0 || (i % 8 === 3)) this.tone(scale[n] * (bar === 3 ? 0.5 : 1), stepDur * 1.6, 'sine', 0.045, this.bgmGain, 0, this.bgmNext - t);
      if (i % 4 === 2) this.tone(1600, 0.03, 'square', 0.012, this.bgmGain, 0, this.bgmNext - t);
      this.bgmNext += stepDur; this.bgmStep = (i + 1) % 64;
    }
  }
}
