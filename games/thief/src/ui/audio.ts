// Procedural WebAudio SFX. Nothing plays before the first user gesture (unlock()).
export class Sfx {
  private ctx: AudioContext | null = null; private master!: GainNode; muted = false; volume = 0.7; private last = new Map<string, number>();
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try { const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }); const C = AC.AudioContext || AC.webkitAudioContext; if (!C) return; this.ctx = new C(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); this.apply(); } catch { this.ctx = null; }
  }
  apply(): void { if (this.ctx) this.master.gain.value = this.muted ? 0 : this.volume; }
  suspend(): void { this.ctx?.suspend().catch(() => {}); }
  resume(): void { this.ctx?.resume().catch(() => {}); }
  private tone(f: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); const t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  private noise(dur: number, vol: number, cutoff: number, delay = 0, hp = false): void {
    const c = this.ctx!; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = cutoff;
    const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(this.master); src.start(c.currentTime + delay);
  }
  play(name: string): void {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = performance.now(); const gap = name === 'step' ? 180 : name === 'hit' ? 50 : name.startsWith('shoot') ? 40 : name === 'genhit' ? 70 : 0;
    if (now - (this.last.get(name) || 0) < gap) return; this.last.set(name, now);
    switch (name) {
      case 'step': this.noise(0.04, 0.05, 900); break;
      case 'dash': this.noise(0.14, 0.18, 2500, 0, true); this.tone(500, 0.12, 'sine', 0.08, 500); break;
      case 'shoot_rifle': this.tone(1100, 0.05, 'square', 0.06, -600); this.noise(0.04, 0.08, 3500); break;
      case 'shoot_shotgun': this.noise(0.18, 0.28, 1200); this.tone(160, 0.14, 'sawtooth', 0.12, -90); break;
      case 'shoot_ghost': this.tone(1400, 0.05, 'triangle', 0.035, -500); break;
      case 'turret': this.tone(300, 0.2, 'sawtooth', 0.09, 240); break;
      case 'turret_warn': this.tone(880, 0.08, 'square', 0.04); this.tone(880, 0.08, 'square', 0.04, 0, 0.12); break;
      case 'hit': this.noise(0.05, 0.1, 2000); this.tone(400, 0.05, 'square', 0.04, -200); break;
      case 'genhit': this.tone(700, 0.06, 'triangle', 0.06, -300); this.noise(0.05, 0.08, 4000, 0, true); break;
      case 'enemy_die': this.noise(0.3, 0.25, 900); this.tone(120, 0.3, 'sine', 0.14, -70); break;
      case 'generator': this.noise(0.5, 0.35, 700); this.tone(70, 0.5, 'sine', 0.22, -40); [500, 380, 260].forEach((f, i) => this.tone(f, 0.16, 'square', 0.06, -100, 0.1 + i * 0.1)); break;
      case 'laser_off': this.tone(900, 0.25, 'sine', 0.08, -700); this.tone(300, 0.3, 'triangle', 0.05, -200, 0.1); break;
      case 'laser_warn': this.tone(1200, 0.05, 'square', 0.03); break;
      case 'plate_on': this.tone(520, 0.1, 'sine', 0.09); this.tone(780, 0.14, 'sine', 0.09, 0, 0.08); break;
      case 'plate_off': this.tone(600, 0.1, 'sine', 0.06, -250); break;
      case 'vault': [420, 560, 700, 940].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, 0, i * 0.07)); this.noise(0.25, 0.1, 1500, 0.2); break;
      case 'core': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.1, 0, i * 0.09)); break;
      case 'hurt': this.noise(0.12, 0.2, 1500); this.tone(220, 0.18, 'sawtooth', 0.1, -120); break;
      case 'die': [300, 240, 180, 120].forEach((f, i) => this.tone(f, 0.28, 'sawtooth', 0.09, -30, i * 0.14)); break;
      case 'rewind': [1500, 1100, 800, 600].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.06, -200, i * 0.06)); this.noise(0.3, 0.06, 3000, 0, true); break;
      case 'hold': this.tone(700, 0.12, 'sine', 0.06); this.tone(700, 0.12, 'sine', 0.06, 0, 0.15); break;
      case 'tick': this.tone(1000, 0.05, 'square', 0.05); break;
      case 'tick_final': this.tone(1400, 0.08, 'square', 0.07); break;
      case 'timeout': this.tone(200, 0.5, 'sawtooth', 0.1, -80); this.noise(0.4, 0.1, 800); break;
      case 'finish': this.tone(600, 0.12, 'sine', 0.08); this.tone(450, 0.2, 'sine', 0.08, 0, 0.12); break;
      case 'escape': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.1, 0, i * 0.11)); this.noise(0.5, 0.12, 2500, 0.4); break;
      case 'click': this.tone(1300, 0.035, 'square', 0.03); break;
      case 'unlock': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.08, 0, i * 0.1)); break;
    }
  }
}
