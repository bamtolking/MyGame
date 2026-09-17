// Procedural WebAudio sound effects. Starts only after a user gesture.
export class Audio {
  ctx: AudioContext | null = null; master!: GainNode; vol = 0.7;
  private last = new Map<string, number>();
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.master = this.ctx!.createGain(); this.master.connect(this.ctx!.destination); this.master.gain.value = this.vol; } catch { this.ctx = null; }
  }
  setVolume(v: number): void { this.vol = v; if (this.ctx) this.master.gain.value = v; }
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); const t = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, filterFreq: number, delay = 0): void {
    const c = this.ctx!; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(this.master); src.start(c.currentTime + delay);
  }
  play(name: string): void {
    if (!this.ctx || this.vol <= 0) return;
    const now = performance.now(); const gap = name === 'build' ? 120 : name === 'place' ? 40 : 0; const l = this.last.get(name) || 0; if (now - l < gap) return; this.last.set(name, now);
    switch (name) {
      case 'tap': this.tone(900, 0.04, 'square', 0.03, -200); break;
      case 'place': this.tone(500, 0.06, 'triangle', 0.05, 200); break;
      case 'cancel': this.tone(400, 0.08, 'triangle', 0.05, -200); break;
      case 'build': this.noise(0.08, 0.08, 1800); this.tone(700, 0.05, 'square', 0.03); break;
      case 'demolish': this.noise(0.2, 0.15, 600); break;
      case 'hire': this.tone(600, 0.1, 'sine', 0.06); this.tone(900, 0.12, 'sine', 0.06, 0, 0.08); break;
      case 'intake': this.tone(300, 0.25, 'sawtooth', 0.05, -100); this.tone(450, 0.2, 'sine', 0.05, 0, 0.2); break;
      case 'alert': [880, 660].forEach((f, i) => this.tone(f, 0.15, 'square', 0.06, 0, i * 0.16)); break;
      case 'fight': this.noise(0.15, 0.2, 900); this.tone(150, 0.15, 'sawtooth', 0.08, -60); break;
      case 'escape': [1000, 800, 1000, 800].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, 0, i * 0.13)); break;
      case 'riot': this.noise(0.6, 0.3, 500); [200, 180, 160].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.08, 0, i * 0.2)); break;
      case 'subdue': this.tone(300, 0.15, 'triangle', 0.06, -150); break;
      case 'chapter': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.09, 0, i * 0.12)); break;
      case 'day': [660, 880].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.05, 0, i * 0.15)); break;
      case 'money': this.tone(1500, 0.08, 'sine', 0.05); this.tone(2000, 0.1, 'sine', 0.04, 0, 0.06); break;
      case 'error': this.tone(200, 0.15, 'square', 0.05, -50); break;
      case 'death': this.tone(220, 0.5, 'sawtooth', 0.08, -120); this.noise(0.4, 0.15, 400, 0.1); break;
      case 'release': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.06, 0, i * 0.1)); break;
      case 'gameover': [400, 350, 300, 200].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.08, -30, i * 0.3)); break;
    }
  }
}
