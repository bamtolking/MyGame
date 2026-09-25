// Procedural WebAudio: SFX + a gayageum-style pentatonic loop over a janggu rhythm. Starts after a user gesture.
export class Sound {
  ctx: AudioContext | null = null; private master!: GainNode; private sfx!: GainNode; private bgm!: GainNode;
  sfxVol = 0.7; bgmVol = 0.45; private last = new Map<string, number>();
  private next = 0; private step = 0; mood: 'calm' | 'town' | 'boss' = 'calm'; private noiseBuf: AudioBuffer | null = null;

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      const c: AudioContext = new AC(); this.ctx = c;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
      this.bgm = c.createGain(); this.bgm.gain.value = this.bgmVol * 0.5; this.bgm.connect(this.master);
      const n = c.sampleRate; this.noiseBuf = c.createBuffer(1, n, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  setVolumes(s: number, b: number): void { this.sfxVol = s; this.bgmVol = b; if (this.ctx) { this.sfx.gain.value = s; this.bgm.gain.value = b * 0.5; } }
  suspend(): void { void this.ctx?.suspend(); } resume(): void { void this.ctx?.resume(); }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, dest: GainNode, slide = 0, delay = 0, attack = 0.005): void {
    const c = this.ctx!; const t = c.currentTime + delay; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, freq: number, dest: GainNode, delay = 0, type: BiquadFilterType = 'lowpass'): void {
    const c = this.ctx!; if (!this.noiseBuf) return; const t = c.currentTime + delay; const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  play(name: string, vol = 1): void {
    if (!this.ctx || this.sfxVol <= 0 || this.ctx.state !== 'running') return;
    const now = performance.now(); const gap = GAPS[name] ?? 30; if (now - (this.last.get(name) ?? 0) < gap) return; this.last.set(name, now);
    const S = this.sfx; const v = vol;
    switch (name) {
      case 'slash': this.noise(0.09, 0.18 * v, 3000, S, 0, 'bandpass'); this.tone(600, 0.07, 'triangle', 0.04 * v, S, -300); break;
      case 'arrow': this.tone(1300, 0.06, 'triangle', 0.05 * v, S, -700); this.noise(0.05, 0.05 * v, 5000, S, 0, 'highpass'); break;
      case 'bolt': this.tone(700, 0.12, 'sine', 0.06 * v, S, 500); break;
      case 'boom': this.noise(0.18, 0.14 * v, 900, S); this.tone(120, 0.18, 'sine', 0.08 * v, S, -60); break;
      case 'hit': this.noise(0.05, 0.07 * v, 1800, S); break;
      case 'kill': this.tone(900, 0.05, 'square', 0.025 * v, S, 400); break;
      case 'coin': this.tone(1760, 0.07, 'sine', 0.04, S); this.tone(2350, 0.09, 'sine', 0.035, S, 0, 0.05); break;
      case 'thunder': this.noise(0.35, 0.22 * v, 2500, S); this.tone(90, 0.3, 'sawtooth', 0.06 * v, S, -40); break;
      case 'frost': this.tone(2400, 0.3, 'sine', 0.05 * v, S, -1600); this.noise(0.25, 0.06 * v, 6000, S, 0, 'highpass'); break;
      case 'wisp': this.tone(500, 0.18, 'sine', 0.05 * v, S, 350); break;
      case 'bell': [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.05, S, 0, i * 0.06)); break;
      case 'guard': this.tone(330, 0.4, 'triangle', 0.07, S, 200); this.tone(660, 0.4, 'sine', 0.04, S, 300, 0.05); break;
      case 'hurt': this.tone(180, 0.12, 'square', 0.06, S, -80); this.noise(0.08, 0.1, 1200, S); break;
      case 'down': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.1, S, -20, i * 0.15)); break;
      case 'revive': [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.09, S, 0, i * 0.07)); break;
      case 'level': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.1, S, 0, i * 0.07)); this.noise(0.6, 0.08, 4000, S, 0.35, 'highpass'); break;
      case 'ult': this.noise(0.6, 0.25, 1400, S); this.tone(110, 0.7, 'sawtooth', 0.12, S, 220); [523, 784, 1047].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.07, S, 0, 0.1 + i * 0.06)); break;
      case 'roar': this.noise(0.9, 0.3, 500, S); this.tone(70, 0.9, 'sawtooth', 0.18, S, -30); break;
      case 'tele': this.tone(220, 0.15, 'square', 0.03 * v, S, 60); break;
      case 'item': [880, 1175].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.07, S, 0, i * 0.06)); break;
      case 'epic': [659, 880, 1109, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.09, S, 0, i * 0.07)); break;
      case 'legend': [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.11, S, 0, i * 0.08)); this.noise(1, 0.12, 5000, S, 0.5, 'highpass'); break;
      case 'quest': [587, 784, 988, 1175].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.09, S, 0, i * 0.09)); break;
      case 'horn': [220, 220, 196, 247].forEach((f, i) => this.tone(f, 0.55, 'sawtooth', 0.09, S, 0, i * 0.45, 0.08)); break;
      case 'click': this.tone(1400, 0.035, 'square', 0.025, S); break;
      case 'error': this.tone(200, 0.15, 'square', 0.05, S, -40); break;
      case 'emote': this.tone(1046, 0.1, 'sine', 0.05, S, 200); break;
      case 'merge': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.09, S, 0, i * 0.08)); break;
      case 'tp': this.tone(300, 0.5, 'sine', 0.08, S, 900); this.noise(0.4, 0.06, 3000, S, 0.1, 'highpass'); break;
    }
  }
  // ---- music: pentatonic gayageum plucks over a janggu pattern (12/8 feel) ----
  tick(): void {
    const c = this.ctx; if (!c || this.bgmVol <= 0 || c.state !== 'running') return;
    const t = c.currentTime; if (this.next < t) this.next = t + 0.05;
    const boss = this.mood === 'boss'; const dur = boss ? 0.14 : this.mood === 'town' ? 0.24 : 0.2;
    const scale = [196.0, 220.0, 261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3];
    const melody = boss ? [4, 4, 5, 4, 2, 3, 4, 2, 1, 2, 3, 1] : [2, 4, 5, 4, 7, 5, 4, 2, 3, 4, 2, 1, 0, 1, 2, 4, 5, 7, 8, 7, 5, 4, 5, 2];
    const B = this.bgm;
    while (this.next < t + 0.5) {
      const i = this.step, d = this.next - t, bar = Math.floor(i / 12);
      // janggu: 덩 (both) on 0, 기덕 on 3/5, 쿵 on 6, 더러러 on 9-11
      const k = i % 12;
      if (k === 0) { this.tone(95, 0.35, 'sine', 0.13, B, -30, d); this.noise(0.06, 0.08, 2600, B, d, 'bandpass'); }
      else if (k === 3 || k === 5 || (boss && k === 8)) this.noise(0.05, 0.07, 2800, B, d, 'bandpass');
      else if (k === 6) this.tone(105, 0.3, 'sine', 0.1, B, -30, d);
      else if (k >= 9 && (boss || bar % 2 === 1)) this.noise(0.035, 0.035, 3200, B, d, 'bandpass');
      if (k % (boss ? 1 : 2) === 0 || k === 11) {
        const n = melody[(i >> (boss ? 0 : 1)) % melody.length]; const oct = bar % 4 === 3 ? 0.5 : 1;
        this.tone(scale[n] * oct * (this.mood === 'town' ? 1 : 1), dur * 2.2, 'triangle', 0.045, B, 0, d, 0.003);
        if (!boss && k === 0) this.tone(scale[n] * 0.5, dur * 5, 'sine', 0.03, B, 0, d, 0.02);
      }
      this.next += dur; this.step = (i + 1) % 96;
    }
  }
}
const GAPS: Record<string, number> = { hit: 45, kill: 35, slash: 70, arrow: 60, bolt: 80, boom: 70, coin: 60, tele: 150, wisp: 100, thunder: 120, frost: 150, hurt: 140, emote: 300, bell: 400, guard: 400 };
