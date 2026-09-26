// Procedural WebAudio: SFX + a small step-sequencer BGM per biome (bpm/key from biome data) and a bonus theme.
// Starts only after a user gesture. Jelly pickups climb a pentatonic scale while you keep chaining them.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxGain!: GainNode; bgmGain!: GainNode;
  sfxVol = 0.8; bgmVol = 0.5;
  private last = new Map<string, number>();
  private chain = 0; private chainT = 0;
  private music: { bpm: number; key: number; bonus: boolean } | null = null;
  private step = 0; private nextT = 0;
  private noiseBuf: AudioBuffer | null = null;

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); const c = this.ctx!;
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
      this.bgmGain = c.createGain(); this.bgmGain.gain.value = this.bgmVol * 0.45; this.bgmGain.connect(this.master);
      const n = Math.floor(c.sampleRate * 0.5); this.noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0); let sd = 7; for (let i = 0; i < n; i++) { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; d[i] = sd / 2147483648 - 1; }
    } catch { this.ctx = null; }
  }
  setVolumes(sfx: number, bgm: number): void {
    this.sfxVol = sfx; this.bgmVol = bgm;
    if (this.ctx) { this.sfxGain.gain.value = sfx; this.bgmGain.gain.value = bgm * 0.45; }
  }
  suspend(): void { this.ctx?.suspend().catch(() => {}); }
  resume(): void { this.ctx?.resume().catch(() => {}); }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, slide = 0, delay = 0, attack = 0.005): void {
    const c = this.ctx!; const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, freq: number, dest: AudioNode, delay = 0, type: BiquadFilterType = 'lowpass'): void {
    if (!this.noiseBuf) return;
    const c = this.ctx!; const t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + dur + 0.02);
  }

  play(name: string, arg = 0): void {
    if (!this.ctx || this.sfxVol <= 0 || this.ctx.state !== 'running') return;
    const now = performance.now();
    const gap = name === 'jelly' ? 28 : name === 'coin' ? 40 : name === 'land' ? 90 : 0;
    if (gap && now - (this.last.get(name) || 0) < gap) return; this.last.set(name, now);
    const S = this.sfxGain;
    switch (name) {
      case 'jump': this.tone(420, 0.12, 'square', 0.05, S, 380); break;
      case 'jump2': this.tone(620, 0.14, 'square', 0.05, S, 520); this.tone(930, 0.1, 'sine', 0.03, S, 300, 0.03); break;
      case 'land': this.noise(0.05, 0.06, 900, S); break;
      case 'slide': this.noise(0.18, 0.05, 2400, S, 0, 'bandpass'); break;
      case 'jelly': {
        if (now - this.chainT > 450) this.chain = 0; this.chainT = now;
        const n = PENTA[Math.min(PENTA.length - 1, Math.floor(this.chain / 3))]; this.chain++;
        this.tone(mtof(76 + n), 0.07, 'sine', 0.05, S); break;
      }
      case 'big': this.tone(880, 0.08, 'triangle', 0.07, S); this.tone(1320, 0.12, 'triangle', 0.06, S, 0, 0.05); break;
      case 'coin': this.tone(1568, 0.06, 'square', 0.035, S); this.tone(2093, 0.1, 'square', 0.03, S, 0, 0.05); break;
      case 'potion': [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.07, S, 0, i * 0.05)); break;
      case 'letter': [0, 4, 7].forEach((d, i) => this.tone(mtof(72 + d + arg * 2), 0.18, 'triangle', 0.08, S, 0, i * 0.05)); break;
      case 'power': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.05, S, 0, i * 0.045)); break;
      case 'powerEnd': this.tone(660, 0.2, 'triangle', 0.05, S, -300); break;
      case 'hit': this.noise(0.18, 0.2, 1400, S); this.tone(180, 0.22, 'sawtooth', 0.1, S, -90); break;
      case 'shield': this.tone(1200, 0.25, 'sine', 0.07, S, -600); this.noise(0.1, 0.06, 5000, S, 0, 'highpass'); break;
      case 'smash': this.noise(0.22, 0.22, 700, S); this.tone(110, 0.2, 'sine', 0.14, S, -50); break;
      case 'fall': this.tone(700, 0.45, 'triangle', 0.08, S, -520); this.tone(520, 0.3, 'sine', 0.05, S, 400, 0.4); break;
      case 'bonus': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.09, S, 0, i * 0.06)); this.noise(0.6, 0.08, 6000, S, 0.2, 'highpass'); break;
      case 'bonusEnd': [1047, 784, 659].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.07, S, 0, i * 0.07)); break;
      case 'speed': this.tone(300, 0.35, 'sawtooth', 0.05, S, 600); break;
      case 'skill': this.tone(700, 0.2, 'triangle', 0.07, S, 700); this.tone(1400, 0.2, 'sine', 0.04, S, 0, 0.08); break;
      case 'lowhp': this.tone(90, 0.16, 'sine', 0.16, S); this.tone(90, 0.16, 'sine', 0.13, S, 0, 0.22); break;
      case 'near': this.tone(1760, 0.05, 'sine', 0.035, S); break;
      case 'streak': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.12, 'square', 0.04, S, 0, i * 0.05)); break;
      case 'relay': [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, S, 0, i * 0.07)); break;
      case 'death': [440, 392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08, S, 0, i * 0.16)); break;
      case 'clear': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'square', 0.05, S, 0, i * 0.09)); break;
      case 'count': this.tone(660, 0.1, 'square', 0.05, S); break;
      case 'go': this.tone(990, 0.25, 'square', 0.06, S); break;
      case 'click': this.tone(1100, 0.04, 'square', 0.025, S); break;
      case 'error': this.tone(180, 0.15, 'square', 0.05, S, -40); break;
      case 'reward': [659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.07, S, 0, i * 0.08)); break;
    }
  }

  // ---- BGM: 16-step patterns, scheduled ~0.3 s ahead from the audio clock ----
  setMusic(m: { bpm: number; key: number } | 'bonus' | null): void {
    if (m === null) { this.music = null; return; }
    const next = m === 'bonus' ? { bpm: 176, key: 5, bonus: true } : { ...m, bonus: false };
    if (this.music && this.music.bpm === next.bpm && this.music.key === next.key && this.music.bonus === next.bonus) return;
    this.music = next; this.nextT = 0;
  }
  tick(): void {
    const c = this.ctx; const m = this.music;
    if (!c || !m || this.bgmVol <= 0 || c.state !== 'running') return;
    const t = c.currentTime; if (this.nextT < t) this.nextT = t + 0.05;
    const stepDur = 60 / m.bpm / 4;
    const B = this.bgmGain; const root = 60 + m.key;
    const prog = m.bonus ? [0, 5, 7, 5] : [0, 9, 5, 7];                  // I–vi–IV–V (bonus: I–IV–V–IV)
    const lead = m.bonus ? [12, 14, 16, 19, 16, 14, 12, 7, 12, 16, 19, 21, 19, 16, 14, 12] : [7, -1, 9, 7, 4, -1, 2, 4, 7, -1, 12, 9, 7, 4, 2, -1];
    while (this.nextT < t + 0.3) {
      const i = this.step % 16; const bar = Math.floor(this.step / 16) % 4; const d = this.nextT - t;
      const ch = root + prog[bar];
      if (i % 4 === 0) this.tone(mtof(ch - 24), stepDur * 3.2, 'triangle', 0.09, B, 0, d);          // bass
      if (i % 4 === 2) this.tone(mtof(ch - 12 + 7), stepDur * 1.5, 'triangle', 0.05, B, 0, d);
      if (i % 8 === 4) this.noise(0.08, 0.06, 3000, B, d, 'highpass');                              // snare-ish
      if (i % 2 === 0) this.noise(0.03, 0.025, 8000, B, d, 'highpass');                             // hat
      const n = lead[i]; if (n >= 0 && (m.bonus || i % 2 === 0 || i % 16 === 7)) this.tone(mtof(ch + n), stepDur * 1.8, 'square', 0.028, B, 0, d, 0.01);
      if (i === 0) [0, 4, 7].forEach(k => this.tone(mtof(ch + k), stepDur * 14, 'sine', 0.016, B, 0, d, 0.05)); // pad
      this.nextT += stepDur; this.step++;
    }
  }
}
