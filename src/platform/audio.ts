// WebAudio 절차적 효과음 (파일 없음). 첫 터치 후에 켜집니다.
export class Audio {
  ctx: AudioContext | null = null; master: GainNode | null = null;
  enabled = true; volume = 0.5;
  private lastShot = 0;
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  setVolume(v: number): void { this.volume = v; if (this.master) this.master.gain.value = v; }
  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, slide = 0, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + delay; const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  private noise(dur: number, gain = 0.15, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const n = Math.floor(this.ctx.sampleRate * dur); const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf; const g = this.ctx.createGain(); g.gain.value = gain; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(this.ctx.currentTime + delay);
  }
  shot(kind: string): void { const now = performance.now(); if (now - this.lastShot < 70) return; this.lastShot = now;
    if (kind === 'bolt' || kind === 'dragon') this.tone(900, 0.06, 'square', 0.04, -500); else if (kind === 'fire' || kind === 'titan') this.noise(0.08, 0.05); else if (kind === 'earth') this.tone(120, 0.08, 'triangle', 0.08, -60); else this.tone(1400, 0.04, 'sine', 0.03, 300); }
  kill(boss: boolean): void { if (boss) { this.tone(200, 0.5, 'sawtooth', 0.25, -150); this.noise(0.5, 0.3); } else this.tone(500, 0.08, 'triangle', 0.06, -200); }
  summon(grade: number): void { const base = [440, 523, 659, 784, 988][grade]; this.tone(base, 0.12, 'triangle', 0.15); if (grade >= 1) this.tone(base * 1.5, 0.15, 'triangle', 0.12, 0, 0.08); if (grade >= 2) this.tone(base * 2, 0.3, 'sine', 0.15, 0, 0.16); if (grade >= 3) { this.tone(base * 2.5, 0.5, 'sine', 0.15, 0, 0.26); this.noise(0.3, 0.1, 0.2); } }
  merge(grade: number): void { this.tone(300 + grade * 100, 0.1, 'square', 0.08, 200); this.tone(600 + grade * 150, 0.25, 'triangle', 0.15, 300, 0.1); }
  mythic(): void { for (let i = 0; i < 5; i++) this.tone(400 + i * 120, 0.4, 'sine', 0.15, 0, i * 0.09); this.noise(0.6, 0.15); }
  round(boss: boolean): void { if (boss) { this.tone(110, 0.6, 'sawtooth', 0.2, 30); this.tone(165, 0.6, 'sawtooth', 0.15, 30, 0.3); } else { this.tone(660, 0.1, 'triangle', 0.1); this.tone(880, 0.15, 'triangle', 0.1, 0, 0.1); } }
  gold(): void { this.tone(1200, 0.08, 'sine', 0.1); this.tone(1600, 0.12, 'sine', 0.1, 0, 0.07); }
  error(): void { this.tone(200, 0.12, 'square', 0.06, -80); }
  eliminated(): void { this.tone(300, 0.8, 'sawtooth', 0.2, -250); this.noise(0.8, 0.3); }
  win(): void { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.15, 0, i * 0.15)); }
  emote(): void { this.tone(700, 0.06, 'sine', 0.08); this.tone(900, 0.08, 'sine', 0.08, 0, 0.06); }
  tap(): void { this.tone(800, 0.03, 'sine', 0.04); }
}
