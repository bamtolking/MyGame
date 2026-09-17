// 절차적 WebAudio 효과음. 사용자 입력 후에만 시작하고, 동시 재생 수를 제한한다.
export class Sfx {
  private ctx: AudioContext | null = null;
  private gain!: GainNode;
  volume = 0.7; muted = false;
  private last = new Map<string, number>();
  private frameCount = 0; private frameAt = 0;

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC(); this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination); this.apply();
    } catch { this.ctx = null; }
  }
  setVolume(v: number, muted: boolean): void { this.volume = v; this.muted = muted; this.apply(); }
  private apply(): void { if (this.ctx) this.gain.gain.value = this.muted ? 0 : this.volume; }
  suspend(): void { this.ctx?.suspend().catch(() => {}); }
  resume(): void { this.ctx?.resume().catch(() => {}); }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); const t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.gain); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  private noise(dur: number, vol: number, filterFreq: number, delay = 0, type: BiquadFilterType = 'lowpass'): void {
    const c = this.ctx!; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(this.gain); src.start(c.currentTime + delay);
  }

  play(name: string): void {
    if (!this.ctx || this.muted || this.volume <= 0 || this.ctx.state !== 'running') return;
    const now = performance.now();
    // 프레임당 동시 재생 제한
    if (now - this.frameAt > 40) { this.frameAt = now; this.frameCount = 0; }
    if (this.frameCount >= 4) return; 
    const minGap: Record<string, number> = { mg: 70, hit: 50, shotgun: 120, drone: 90, slash: 120, laser: 150, die: 60, chain: 80, explode: 100 };
    const l = this.last.get(name) || 0; if (now - l < (minGap[name] ?? 0)) return;
    this.last.set(name, now); this.frameCount++;
    switch (name) {
      case 'click': this.tone(1100, 0.04, 'square', 0.03); break;
      case 'error': this.tone(180, 0.15, 'square', 0.06, -60); break;
      case 'select': this.tone(700, 0.06, 'sine', 0.05, 200); break;
      case 'place': this.tone(320, 0.08, 'triangle', 0.08, -120); this.noise(0.05, 0.05, 1500, 0.02); break;
      case 'rotate': this.tone(900, 0.05, 'sine', 0.04, 300); break;
      case 'merge': [500, 700, 1000, 1400].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.08, 0, i * 0.06)); this.noise(0.3, 0.06, 3000, 0.2, 'highpass'); break;
      case 'dismantle': this.noise(0.15, 0.1, 900); this.tone(240, 0.12, 'sawtooth', 0.05, -100); break;
      case 'close': this.tone(240, 0.12, 'triangle', 0.09, -80); this.noise(0.12, 0.08, 800, 0.05); this.tone(420, 0.1, 'sine', 0.05, 0, 0.12); break;
      case 'mg': this.tone(760, 0.05, 'square', 0.035, -350); this.noise(0.04, 0.05, 3500); break;
      case 'extra': this.tone(1300, 0.06, 'square', 0.04, -400); break;
      case 'shotgun': this.noise(0.14, 0.16, 1400); this.tone(160, 0.12, 'sawtooth', 0.07, -80); break;
      case 'laser': this.tone(1500, 0.18, 'sawtooth', 0.05, -900); this.tone(2400, 0.12, 'sine', 0.04, -1200); break;
      case 'bomb': this.tone(220, 0.15, 'triangle', 0.07, 180); break;
      case 'explode': this.noise(0.3, 0.22, 800); this.tone(80, 0.28, 'sine', 0.14, -50); break;
      case 'drone': this.tone(1900, 0.05, 'sine', 0.035, 500); break;
      case 'slash': this.noise(0.09, 0.09, 2600, 0, 'bandpass'); this.tone(600, 0.06, 'triangle', 0.04, -300); break;
      case 'chain': this.tone(1800, 0.09, 'sine', 0.05, 900); this.tone(2600, 0.08, 'sine', 0.03, -800, 0.04); break;
      case 'hit': this.tone(300, 0.05, 'square', 0.03, -100); break;
      case 'die': this.noise(0.12, 0.1, 1200); this.tone(360, 0.14, 'triangle', 0.06, -250); break;
      case 'overheat': this.noise(0.4, 0.1, 2500, 0, 'highpass'); this.tone(200, 0.35, 'sawtooth', 0.05, -120); break;
      case 'cooled': this.tone(900, 0.08, 'sine', 0.05, 300); break;
      case 'player_hit': this.noise(0.1, 0.12, 700); this.tone(140, 0.12, 'square', 0.06, -60); break;
      case 'shield_hit': this.tone(1200, 0.08, 'triangle', 0.05, -300); break;
      case 'shield_break': this.noise(0.25, 0.15, 3000, 0, 'highpass'); this.tone(800, 0.25, 'sawtooth', 0.07, -600); break;
      case 'shockwave': this.noise(0.5, 0.25, 500); this.tone(90, 0.5, 'sine', 0.18, 60); this.tone(400, 0.3, 'sawtooth', 0.06, -300, 0.05); break;
      case 'warn': [660, 660].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, 0, i * 0.18)); break;
      case 'crush': this.noise(0.4, 0.3, 600); this.tone(60, 0.5, 'sine', 0.2, -30); break;
      case 'bomber': this.tone(1000, 0.08, 'square', 0.05, 0); this.tone(1000, 0.08, 'square', 0.05, 0, 0.15); break;
      case 'boss': [110, 110, 92].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.12, 0, i * 0.3)); break;
      case 'boss_phase': this.noise(0.5, 0.2, 900); [300, 250, 200].forEach((f, i) => this.tone(f, 0.3, 'square', 0.06, 0, i * 0.12)); break;
      case 'boss_die': this.noise(0.9, 0.35, 500); this.tone(70, 1.0, 'sawtooth', 0.18, -50); [523, 659, 784].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.1, 0, 0.5 + i * 0.12)); break;
      case 'reward': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.08, 0, i * 0.08)); break;
      case 'heal': [600, 800, 1000].forEach((f, i) => this.tone(f, 0.15, 'sine', 0.07, 0, i * 0.07)); break;
      case 'unlock': [400, 600, 900].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, 0, i * 0.1)); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.1, 0, i * 0.14)); break;
      case 'lose': [400, 350, 300, 200].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.08, -30, i * 0.25)); break;
    }
  }
}
