// 절차적 WebAudio 효과음. 사용자 입력 후에만 시작. 몸마다 다른 공격음.
export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  volume = 0.7; muted = false;
  private last = new Map<string, number>();
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx!.createGain(); this.master.connect(this.ctx!.destination); this.apply();
    } catch { this.ctx = null; }
  }
  apply(): void { if (this.ctx) this.master.gain.value = this.muted ? 0 : this.volume; }
  suspend(): void { this.ctx?.suspend().catch(() => {}); }
  resume(): void { this.ctx?.resume().catch(() => {}); }
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); const t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  private noise(dur: number, vol: number, filterFreq: number, delay = 0, type: BiquadFilterType = 'lowpass'): void {
    const c = this.ctx!; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(this.master); src.start(c.currentTime + delay);
  }
  play(name: string): void {
    if (!this.ctx || this.muted || this.volume <= 0) return;
    const now = performance.now(); const gap = name.startsWith('shot_') ? 40 : name === 'hit' ? 50 : name === 'block' ? 60 : 0;
    if (now - (this.last.get(name) ?? 0) < gap) return; this.last.set(name, now);
    switch (name) {
      case 'shot_intruder': this.tone(1500, 0.05, 'square', 0.05, -600); break;
      case 'shot_scout': this.tone(1100, 0.04, 'sawtooth', 0.05, -300); break;
      case 'shot_shield': this.noise(0.18, 0.28, 900); this.tone(120, 0.15, 'square', 0.12, -60); break;
      case 'shot_bomber': this.tone(220, 0.16, 'sine', 0.12, -120); this.noise(0.08, 0.08, 600); break;
      case 'shot_sniper': this.noise(0.12, 0.3, 5000, 0, 'highpass'); this.tone(2400, 0.12, 'square', 0.06, -1800); break;
      case 'windup_sniper': this.tone(600, 0.35, 'sine', 0.04, 900); break;
      case 'shot_mechanic': this.noise(0.06, 0.12, 4000, 0, 'highpass'); this.tone(2000, 0.05, 'square', 0.04, -1200); break;
      case 'shot_turret': this.tone(900, 0.05, 'square', 0.04, -300); break;
      case 'shot_boss': this.tone(300, 0.12, 'sawtooth', 0.07, -100); break;
      case 'hit': this.noise(0.06, 0.12, 1500); this.tone(500, 0.06, 'triangle', 0.05, -200); break;
      case 'hurt': this.noise(0.12, 0.2, 800); this.tone(180, 0.15, 'square', 0.1, -80); break;
      case 'block': this.tone(1800, 0.06, 'sine', 0.08, 600); this.noise(0.04, 0.08, 6000, 0, 'highpass'); break;
      case 'explode': this.noise(0.4, 0.4, 700); this.tone(70, 0.4, 'sine', 0.25, -40); break;
      case 'die': this.noise(0.2, 0.2, 1200); this.tone(320, 0.2, 'sawtooth', 0.07, -220); break;
      case 'possess': [500, 750, 1000, 1500].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.1, 200, i * 0.05)); this.noise(0.25, 0.12, 4000, 0.1, 'highpass'); this.tone(90, 0.3, 'sine', 0.15, 60); break;
      case 'possessFail': this.tone(220, 0.12, 'square', 0.05, -80); break;
      case 'skill': this.tone(700, 0.1, 'triangle', 0.07, 500); break;
      case 'skill_dash': this.noise(0.1, 0.1, 3000, 0, 'highpass'); this.tone(900, 0.08, 'sine', 0.05, 600); break;
      case 'skill_guard': this.tone(400, 0.15, 'square', 0.07, 100); this.tone(600, 0.15, 'square', 0.05, 100, 0.05); break;
      case 'skill_repair': [600, 900, 1200].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.07, 0, i * 0.06)); break;
      case 'warn': this.tone(880, 0.12, 'square', 0.08); this.tone(880, 0.12, 'square', 0.08, 0, 0.2); break;
      case 'collapse': this.tone(200, 0.35, 'sawtooth', 0.1, -120); this.tone(150, 0.35, 'sawtooth', 0.08, -100, 0.2); break;
      case 'wall': this.noise(0.5, 0.4, 500); this.tone(60, 0.4, 'sine', 0.2, -30); break;
      case 'switch': this.tone(900, 0.1, 'sine', 0.08); this.tone(1350, 0.15, 'sine', 0.08, 0, 0.1); break;
      case 'door': this.tone(300, 0.3, 'sawtooth', 0.06, 150); this.noise(0.25, 0.08, 1200); break;
      case 'turretOff': this.tone(700, 0.25, 'sawtooth', 0.07, -600); break;
      case 'stun': this.tone(1500, 0.08, 'square', 0.06, -400); this.tone(1200, 0.08, 'square', 0.06, -400, 0.1); break;
      case 'boss': this.tone(80, 0.6, 'sawtooth', 0.18, -20); this.tone(120, 0.6, 'square', 0.1, -30, 0.1); this.noise(0.5, 0.2, 400); break;
      case 'bossPhase': this.tone(140, 0.4, 'sawtooth', 0.14, 80); this.tone(280, 0.4, 'square', 0.08, 120, 0.15); break;
      case 'laser': this.noise(0.35, 0.3, 3000, 0, 'highpass'); this.tone(2000, 0.35, 'sawtooth', 0.08, -1500); break;
      case 'lastChance': this.tone(60, 0.5, 'sine', 0.25); this.tone(1200, 0.4, 'sine', 0.08, -900); break;
      case 'victory': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, 0, i * 0.12)); break;
      case 'defeat': [400, 300, 200].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.08, -60, i * 0.25)); break;
      case 'ui': this.tone(800, 0.05, 'sine', 0.04); break;
      case 'zone': [440, 660, 880].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.08, 0, i * 0.1)); break;
      case 'wave': this.tone(500, 0.2, 'square', 0.07, -100); this.tone(500, 0.2, 'square', 0.07, -100, 0.25); break;
      default: break;
    }
  }
}
