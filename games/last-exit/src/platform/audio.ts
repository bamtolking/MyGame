// 절차적 WebAudio 효과음 + 강도별 배경음. 사용자 입력 후에만 시작.
export type BgmMode = 'explore' | 'danger' | 'escape' | 'off';
export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxGain!: GainNode; bgmGain!: GainNode;
  sfxVol = 0.7; bgmVol = 0.4;
  mode: BgmMode = 'off'; private bgmStep = 0; private bgmNext = 0;
  private last = new Map<string, number>();

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); const c = this.ctx!;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfxGain = c.createGain(); this.sfxGain.connect(this.master); this.sfxGain.gain.value = this.sfxVol;
      this.bgmGain = c.createGain(); this.bgmGain.connect(this.master); this.bgmGain.gain.value = this.bgmVol * 0.5;
    } catch { this.ctx = null; }
  }
  setVolumes(sfx: number, bgm: number): void { this.sfxVol = sfx; this.bgmVol = bgm; if (this.ctx) { this.sfxGain.gain.value = sfx; this.bgmGain.gain.value = bgm * 0.5; } }
  suspend(): void { this.ctx?.suspend().catch(() => {}); }
  resume(): void { this.ctx?.resume().catch(() => {}); }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest: GainNode, slide = 0, delay = 0): void {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); const t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  private noise(dur: number, vol: number, filterFreq: number, delay = 0, type: BiquadFilterType = 'lowpass'): void {
    const c = this.ctx!; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(c.currentTime + delay);
  }
  play(name: string): void {
    if (!this.ctx || this.sfxVol <= 0 || this.ctx.state !== 'running') return;
    const now = performance.now(); const l = this.last.get(name) || 0;
    const minGap = name === 'hit' ? 50 : name.startsWith('shoot') ? 40 : name === 'pickup' ? 70 : 0;
    if (now - l < minGap) return; this.last.set(name, now);
    const S = this.sfxGain;
    switch (name) {
      case 'shoot_rifle': this.noise(0.05, 0.1, 3500, 0, 'highpass'); this.tone(520, 0.06, 'square', 0.05, S, -300); break;
      case 'shoot_rifle2': this.noise(0.06, 0.12, 3000, 0, 'highpass'); this.tone(420, 0.07, 'square', 0.06, S, -250); break;
      case 'shoot_shotgun': this.noise(0.18, 0.3, 1200); this.tone(120, 0.16, 'sawtooth', 0.12, S, -60); break;
      case 'shoot_shotgun2': this.noise(0.22, 0.35, 1000); this.tone(90, 0.2, 'sawtooth', 0.14, S, -50); break;
      case 'shoot_staff': this.noise(0.09, 0.12, 5000, 0, 'highpass'); this.tone(1500, 0.09, 'square', 0.04, S, -900); this.tone(2400, 0.06, 'sine', 0.03, S, 600, 0.02); break;
      case 'shoot_staff2': this.noise(0.12, 0.16, 6000, 0, 'highpass'); this.tone(1200, 0.12, 'square', 0.05, S, -800); this.tone(3000, 0.08, 'sine', 0.04, S, 800, 0.03); break;
      case 'hit': this.tone(300, 0.05, 'square', 0.03, S, -150); break;
      case 'kill': this.noise(0.12, 0.15, 1800); this.tone(360, 0.14, 'triangle', 0.06, S, -260); break;
      case 'hurt': this.noise(0.15, 0.25, 700); this.tone(180, 0.2, 'sawtooth', 0.1, S, -100); break;
      case 'shieldhit': this.tone(900, 0.12, 'sine', 0.07, S, -300); break;
      case 'dash': this.noise(0.12, 0.12, 2500, 0, 'highpass'); this.tone(700, 0.1, 'sine', 0.05, S, 500); break;
      case 'pickup': this.tone(1300, 0.06, 'sine', 0.05, S, 400); this.tone(1900, 0.08, 'sine', 0.04, S, 0, 0.05); break;
      case 'pickup_relic': [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.06, S, 0, i * 0.06)); break;
      case 'chest': this.noise(0.15, 0.2, 900); this.tone(500, 0.12, 'square', 0.05, S, 200); this.tone(900, 0.15, 'sine', 0.05, S, 0, 0.1); break;
      case 'safe': [400, 600, 800].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.07, S, 0, i * 0.07)); this.noise(0.25, 0.15, 1500, 0.2); break;
      case 'alarm': [880, 660, 880, 660].forEach((f, i) => this.tone(f, 0.18, 'square', 0.06, S, 0, i * 0.2)); break;
      case 'explode': this.noise(0.35, 0.3, 800); this.tone(80, 0.3, 'sine', 0.18, S, -50); break;
      case 'shock': this.noise(0.14, 0.18, 1400); this.tone(160, 0.14, 'triangle', 0.1, S, -80); break;
      case 'warn': this.tone(520, 0.08, 'square', 0.05, S); this.tone(520, 0.08, 'square', 0.05, S, 0, 0.12); break;
      case 'spawn': this.tone(240, 0.12, 'triangle', 0.04, S, 120); break;
      case 'collapse': this.noise(0.9, 0.35, 400); this.tone(50, 0.8, 'sine', 0.2, S, -20); break;
      case 'door': this.noise(0.3, 0.15, 600); this.tone(200, 0.3, 'triangle', 0.08, S, -80); break;
      case 'cleared': [523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, S, 0, i * 0.08)); break;
      case 'ability': [659, 880, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.08, S, 0, i * 0.07)); break;
      case 'tier': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.09, S, 0, i * 0.07)); this.noise(0.3, 0.1, 3000, 0.3); break;
      case 'heal': [700, 900, 1100].forEach((f, i) => this.tone(f, 0.15, 'sine', 0.06, S, 0, i * 0.06)); break;
      case 'escape_start': [330, 330, 440].forEach((f, i) => this.tone(f, 0.16, 'square', 0.07, S, 0, i * 0.18)); break;
      case 'escape_tick': this.tone(1000, 0.04, 'square', 0.03, S); break;
      case 'escape_ok': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.1, S, 0, i * 0.12)); this.noise(0.5, 0.12, 4000, 0.5, 'highpass'); break;
      case 'boss': [98, 98, 87, 73].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.14, S, 0, i * 0.3)); this.noise(0.6, 0.2, 300, 0.9); break;
      case 'boss_cone': this.tone(140, 0.5, 'sawtooth', 0.1, S, 60); break;
      case 'boss_ring': this.tone(700, 0.3, 'square', 0.06, S, -400); break;
      case 'boss_dead': this.noise(1.0, 0.4, 500); this.tone(70, 1.0, 'sawtooth', 0.2, S, -50); [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.1, S, 0, 0.6 + i * 0.12)); break;
      case 'lose': [330, 294, 262, 196].forEach((f, i) => this.tone(f, 0.55, 'sawtooth', 0.09, S, -20, i * 0.28)); break;
      case 'ui': this.tone(1200, 0.04, 'square', 0.03, S); break;
      case 'error': this.tone(200, 0.15, 'square', 0.06, S, -50); break;
      case 'drop': this.tone(300, 0.1, 'triangle', 0.05, S, -120); this.noise(0.08, 0.08, 1000, 0.05); break;
      case 'drone': [600, 800, 600, 800].forEach((f, i) => this.tone(f, 0.08, 'square', 0.04, S, 0, i * 0.08)); break;
    }
  }
  setBgm(mode: BgmMode): void { if (this.mode !== mode) { this.mode = mode; this.bgmNext = 0; } }
  tick(): void {
    if (!this.ctx || this.mode === 'off' || this.bgmVol <= 0) return;
    const c = this.ctx; if (c.state !== 'running') return;
    const t = c.currentTime; if (this.bgmNext === 0) this.bgmNext = t + 0.05;
    const stepDur = this.mode === 'escape' ? 0.16 : this.mode === 'danger' ? 0.2 : 0.26;
    const bass = this.mode === 'escape' ? [82.4, 82.4, 98, 73.4] : this.mode === 'danger' ? [98, 92.5, 87.3, 98] : [110, 98, 87.3, 82.4];
    const scale = this.mode === 'explore' ? [220, 261.6, 293.7, 329.6, 392, 440, 523.3] : [220, 246.9, 261.6, 329.6, 349.2, 415.3, 440];
    while (this.bgmNext < t + 0.6) {
      const i = this.bgmStep; const bar = Math.floor(i / 8) % 4; const dl = this.bgmNext - t;
      if (i % 8 === 0 || (this.mode !== 'explore' && i % 8 === 4)) this.tone(bass[bar], stepDur * 5, 'triangle', this.mode === 'explore' ? 0.06 : 0.08, this.bgmGain, 0, dl);
      const pat = [0, 2, 4, 2, 5, 4, 2, 0, 3, 4, 5, 6, 5, 4, 3, 2];
      const n = pat[(i + bar * 4) % pat.length];
      if (this.mode === 'explore') { if (i % 4 === 0 || i % 8 === 3) this.tone(scale[n], stepDur * 1.8, 'sine', 0.035, this.bgmGain, 0, dl); }
      else { if (i % 2 === 0) this.tone(scale[n] * (bar === 3 ? 0.5 : 1), stepDur * 1.2, this.mode === 'escape' ? 'square' : 'triangle', this.mode === 'escape' ? 0.03 : 0.04, this.bgmGain, 0, dl); if (i % 4 === 2) this.tone(2000, 0.02, 'square', 0.012, this.bgmGain, 0, dl); }
      this.bgmNext += stepDur; this.bgmStep = (i + 1) % 64;
    }
  }
}
