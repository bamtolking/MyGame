// 절차적 WebAudio 효과음. 사용자 입력 후에만 시작하며, 같은 소리는 짧은 간격으로 반복되지 않는다.
export type SfxName = 'spawn' | 'merge' | 'merge_high' | 'order' | 'accept' | 'deliver' | 'coin' | 'leave' | 'close' | 'ended' | 'buy' | 'click' | 'error' | 'select' | 'move' | 'discard' | 'star';

export class Sfx {
  ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private last = new Map<string, number>();
  volume = 0.7;
  muted = false;
  private pending = 0;

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      this.applyVolume();
    } catch { this.ctx = null; }
  }

  setVolume(v: number, muted: boolean): void { this.volume = v; this.muted = muted; this.applyVolume(); }
  private applyVolume(): void { if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume * 0.6; }
  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
    const c = this.ctx; const g0 = this.gain; if (!c || !g0) return;
    const o = c.createOscillator(); const g = c.createGain();
    const t = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(g0); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, filterFreq: number, delay = 0): void {
    const c = this.ctx; const g0 = this.gain; if (!c || !g0) return;
    const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(g0); src.start(c.currentTime + delay);
  }

  play(name: SfxName): void {
    if (!this.ctx || this.muted || this.volume <= 0) return;
    const now = performance.now();
    const minGap = name === 'spawn' ? 70 : name === 'order' ? 250 : name === 'leave' ? 300 : 40;
    const l = this.last.get(name) || 0;
    if (now - l < minGap) return;
    this.last.set(name, now);
    // 동시 폭주 방지: 짧은 시간에 너무 많은 소리가 겹치면 건너뛴다
    if (this.pending > 6) return;
    this.pending++; setTimeout(() => { this.pending--; }, 120);
    switch (name) {
      case 'spawn': this.tone(520, 0.08, 'triangle', 0.08, 260); break;
      case 'select': this.tone(880, 0.05, 'sine', 0.05); break;
      case 'move': this.tone(660, 0.06, 'sine', 0.05, -200); break;
      case 'merge': [620, 830, 1100].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.09, 0, i * 0.06)); break;
      case 'merge_high': [520, 660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.1, 0, i * 0.07)); this.noise(0.3, 0.08, 2500, 0.3); break;
      case 'order': this.tone(990, 0.08, 'square', 0.05); this.tone(1320, 0.1, 'square', 0.05, 0, 0.09); break;
      case 'accept': this.tone(700, 0.07, 'triangle', 0.08, 200); this.tone(1000, 0.1, 'triangle', 0.07, 0, 0.07); break;
      case 'deliver': this.tone(1500, 0.06, 'sine', 0.06); this.tone(2000, 0.12, 'sine', 0.07, 0, 0.06); break;
      case 'coin': this.tone(1800, 0.05, 'sine', 0.05); this.tone(2400, 0.08, 'sine', 0.04, 0, 0.04); break;
      case 'leave': this.tone(300, 0.2, 'sine', 0.05, -100); break;
      case 'close': [660, 660, 520].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.09, 0, i * 0.22)); break;
      case 'ended': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.1, 0, i * 0.12)); break;
      case 'star': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.09, 0, i * 0.1)); break;
      case 'buy': this.tone(900, 0.08, 'sine', 0.08); this.tone(1200, 0.12, 'sine', 0.08, 0, 0.08); this.noise(0.1, 0.05, 3000, 0.1); break;
      case 'click': this.tone(1100, 0.03, 'square', 0.03); break;
      case 'discard': this.noise(0.12, 0.08, 1500); this.tone(240, 0.12, 'triangle', 0.05, -120); break;
      case 'error': this.tone(220, 0.14, 'square', 0.05, -40); break;
    }
  }
}
