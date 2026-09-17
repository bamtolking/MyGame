// 절차적 WebAudio 효과음. 사용자 입력(탭) 뒤에만 시작하며, 같은 소리는 짧은 간격으로 제한합니다.
export type SfxName = 'shoot_flame' | 'shoot_oil' | 'shoot_frost' | 'shoot_laser' | 'shoot_laser_over' | 'shoot_tesla' | 'shoot_bomb' | 'vortex' | 'vortex_fire' | 'engineer'
  | 'hit' | 'explode' | 'explode_big' | 'ignite' | 'shards' | 'freeze' | 'die' | 'die_boss' | 'leak' | 'place' | 'merge' | 'merge3' | 'sell' | 'combo' | 'wave' | 'boss' | 'boss_warn' | 'win' | 'lose' | 'click' | 'error' | 'gold';

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  vol = 0.7; muted = false;
  private last = new Map<string, number>();
  private active = 0;

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); this.apply();
    } catch { this.ctx = null; }
  }
  setVolume(v: number, muted: boolean): void { this.vol = v; this.muted = muted; this.apply(); }
  private apply(): void { if (this.ctx) this.master.gain.value = this.muted ? 0 : this.vol; }
  suspend(): void { this.ctx?.suspend().catch(() => {}); }
  resume(): void { this.ctx?.resume().catch(() => {}); }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
    const c = this.ctx!; const t0 = c.currentTime + delay; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
    this.active++; o.onended = () => { this.active--; };
  }
  private noise(dur: number, vol: number, filterFreq: number, delay = 0, type: BiquadFilterType = 'lowpass'): void {
    const c = this.ctx!; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(this.master); src.start(c.currentTime + delay);
    this.active++; src.onended = () => { this.active--; };
  }
  /** 이름별 최소 간격과 동시 발음 상한으로 과도한 중첩을 막습니다. */
  play(name: SfxName): void {
    if (!this.ctx || this.muted || this.vol <= 0) return;
    if (this.ctx.state !== 'running') return;
    const now = performance.now(); const l = this.last.get(name) || 0;
    const minGap = name === 'hit' ? 70 : name.startsWith('shoot') ? 55 : name === 'explode' ? 90 : name === 'die' ? 60 : 0;
    if (now - l < minGap) return;
    if (this.active > 24 && !['win', 'lose', 'boss', 'merge', 'merge3', 'combo'].includes(name)) return;
    this.last.set(name, now);
    switch (name) {
      case 'shoot_flame': this.noise(0.12, 0.07, 1800); this.tone(220, 0.1, 'sawtooth', 0.03, 120); break;
      case 'shoot_oil': this.tone(180, 0.14, 'triangle', 0.05, -90); break;
      case 'shoot_frost': this.tone(1500, 0.09, 'sine', 0.05, 700); break;
      case 'shoot_laser': this.tone(880, 0.12, 'square', 0.035, -500); break;
      case 'shoot_laser_over': this.tone(660, 0.25, 'sawtooth', 0.06, 900); this.noise(0.2, 0.08, 5000, 0, 'highpass'); break;
      case 'shoot_tesla': this.noise(0.07, 0.1, 5000, 0, 'highpass'); this.tone(2000, 0.05, 'square', 0.035, -1200); break;
      case 'shoot_bomb': this.tone(260, 0.16, 'triangle', 0.06, -170); break;
      case 'vortex': this.noise(0.5, 0.05, 700); this.tone(300, 0.5, 'sine', 0.03, 200); break;
      case 'vortex_fire': this.noise(0.7, 0.1, 1200); this.tone(180, 0.6, 'sawtooth', 0.05, 160); break;
      case 'engineer': this.tone(500, 0.2, 'sine', 0.05, 300); this.tone(1000, 0.2, 'sine', 0.03, 300, 0.08); break;
      case 'hit': this.tone(700, 0.04, 'square', 0.025, -300); break;
      case 'explode': this.noise(0.28, 0.22, 900); this.tone(90, 0.22, 'sine', 0.14, -60); break;
      case 'explode_big': this.noise(0.45, 0.3, 700); this.tone(60, 0.45, 'sine', 0.22, -40); break;
      case 'ignite': this.noise(0.35, 0.25, 1400); this.tone(140, 0.3, 'sawtooth', 0.1, -80); break;
      case 'shards': this.tone(2400, 0.12, 'sine', 0.06, -1200); this.noise(0.1, 0.1, 6000, 0.02, 'highpass'); break;
      case 'freeze': this.tone(2200, 0.25, 'sine', 0.07, -1400); break;
      case 'die': this.tone(380, 0.12, 'triangle', 0.05, -260); break;
      case 'die_boss': this.noise(0.8, 0.4, 500); this.tone(70, 0.9, 'sawtooth', 0.2, -50); this.tone(1200, 0.5, 'sine', 0.1, 400, 0.3); break;
      case 'leak': this.tone(200, 0.3, 'sawtooth', 0.12, -120); this.tone(150, 0.4, 'square', 0.08, -70, 0.1); break;
      case 'place': this.tone(520, 0.08, 'sine', 0.07, 260); this.tone(780, 0.1, 'sine', 0.05, 0, 0.06); break;
      case 'merge': [600, 800, 1100].forEach((f, i) => this.tone(f, 0.15, 'sine', 0.09, 0, i * 0.07)); this.noise(0.2, 0.06, 3000, 0.15); break;
      case 'merge3': [500, 700, 1000, 1400, 1900].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.1, 0, i * 0.07)); this.noise(0.4, 0.12, 3500, 0.3); break;
      case 'sell': this.tone(900, 0.08, 'sine', 0.05, -300); this.tone(600, 0.1, 'sine', 0.04, -200, 0.08); break;
      case 'combo': this.tone(1000, 0.1, 'square', 0.05, 500); this.tone(1500, 0.14, 'sine', 0.06, 0, 0.08); break;
      case 'wave': this.tone(440, 0.1, 'square', 0.05); this.tone(660, 0.14, 'square', 0.05, 0, 0.12); break;
      case 'boss': [110, 110, 98].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.14, 0, i * 0.3)); this.noise(0.5, 0.15, 400, 0.9); break;
      case 'boss_warn': this.tone(330, 0.15, 'square', 0.06, 0); this.tone(330, 0.15, 'square', 0.06, 0, 0.2); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, 0, i * 0.15)); break;
      case 'lose': [400, 350, 300, 200].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.1, -30, i * 0.25)); break;
      case 'click': this.tone(1200, 0.04, 'square', 0.03); break;
      case 'error': this.tone(200, 0.15, 'square', 0.06, -50); break;
      case 'gold': this.tone(1900, 0.06, 'sine', 0.04); break;
    }
  }
}
