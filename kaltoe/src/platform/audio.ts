// 절차적 사운드: WebAudio로 효과음과 배경음(강도 단계별 레이어)을 합성. 외부 파일 없음.
type Sfx =
  | 'shoot' | 'hit' | 'kill' | 'gem' | 'coin' | 'levelup' | 'tick' | 'jackpot' | 'hurt' | 'boss' | 'explode'
  | 'ult' | 'item' | 'evolve' | 'click' | 'chime' | 'lunch' | 'clear' | 'death' | 'elite' | 'buy' | 'toast';

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  sfxVol = 0.8;
  musicVol = 0.5;
  private last = new Map<string, number>();
  private gemCombo = 0;
  private gemT = 0;
  // 음악
  private musicOn = false;
  private intensity = 0;
  private nextNote = 0;
  private stepIdx = 0;
  private timer: number | null = null;
  private tempo = 124;

  unlock() {
    if (!this.ctx) {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      comp.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(comp);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol * 0.55; this.musicBus.connect(comp);
      const len = c.sampleRate * 1;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx; this.musicVol = music;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
    if (this.musicBus) this.musicBus.gain.value = music * 0.55;
  }

  suspend() { this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    const l = this.last.get(key) ?? 0;
    if (now - l < ms) return false;
    this.last.set(key, now);
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slide = 0, bus?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus ?? this.sfxBus!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, at = 0, filter = 1200, q = 0.7, bus?: AudioNode, type: BiquadFilterType = 'lowpass') {
    const c = this.ctx!;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = filter; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus ?? this.sfxBus!);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name: Sfx, arg = 0) {
    if (!this.ctx || this.ctx.state !== 'running' || this.sfxVol <= 0) return;
    switch (name) {
      case 'shoot': if (this.throttle('shoot', 70)) this.tone(660 + Math.random() * 180, 0.05, 'square', 0.025, 0, 0.6); break;
      case 'hit': if (this.throttle('hit', 45)) this.noise(0.04, 0.05, 0, 2600, 1, undefined, 'bandpass'); break;
      case 'kill': if (this.throttle('kill', 40)) { this.tone(320 + Math.random() * 90, 0.07, 'triangle', 0.06, 0, 0.5); this.noise(0.05, 0.04, 0, 1800); } break;
      case 'gem': {
        const now = performance.now();
        if (now - this.gemT > 900) this.gemCombo = 0;
        this.gemT = now;
        if (!this.throttle('gem', 35)) break;
        this.gemCombo = Math.min(this.gemCombo + 1, 24);
        const f = 880 * Math.pow(2, (this.gemCombo % 25) / 24);
        this.tone(f, 0.06, 'sine', 0.05);
        break;
      }
      case 'coin': if (this.throttle('coin', 60)) { this.tone(1320, 0.05, 'square', 0.03); this.tone(1980, 0.12, 'square', 0.03, 0.05); } break;
      case 'levelup': {
        const n = [523, 659, 784, 1047];
        n.forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, i * 0.06));
        this.tone(1568, 0.35, 'sine', 0.05, 0.24);
        break;
      }
      case 'tick': this.tone(1400 + arg * 40, 0.03, 'square', 0.035); break;
      case 'jackpot': {
        const n = [784, 988, 1175, 1568, 1976];
        n.forEach((f, i) => this.tone(f, 0.22, 'square', 0.05, i * 0.07));
        this.noise(0.6, 0.05, 0.1, 6000, 0.5, undefined, 'highpass');
        break;
      }
      case 'hurt': if (this.throttle('hurt', 120)) { this.tone(180, 0.18, 'sawtooth', 0.09, 0, 0.5); this.noise(0.12, 0.08, 0, 700); } break;
      case 'boss': {
        for (let i = 0; i < 3; i++) { this.tone(440, 0.25, 'sawtooth', 0.06, i * 0.5, 0.7); this.tone(330, 0.25, 'sawtooth', 0.06, i * 0.5 + 0.25, 0.7); }
        break;
      }
      case 'elite': this.tone(300, 0.3, 'sawtooth', 0.05, 0, 1.5); break;
      case 'explode': if (this.throttle('explode', 90)) { this.noise(0.35, 0.14, 0, 600); this.tone(90, 0.3, 'sine', 0.12, 0, 0.4); } break;
      case 'ult': {
        this.noise(1.0, 0.22, 0, 900);
        this.tone(60, 0.9, 'sine', 0.25, 0, 0.5);
        this.tone(880, 0.4, 'sawtooth', 0.04, 0, 0.25);
        break;
      }
      case 'item': this.tone(600, 0.1, 'triangle', 0.07, 0, 2); this.tone(1200, 0.14, 'triangle', 0.05, 0.08, 1.5); break;
      case 'evolve': {
        const n = [523, 784, 1047, 1319, 1568, 2093];
        n.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.06, i * 0.05));
        this.noise(0.8, 0.04, 0.2, 7000, 0.5, undefined, 'highpass');
        break;
      }
      case 'click': this.tone(900, 0.03, 'square', 0.03); break;
      case 'buy': this.tone(988, 0.06, 'square', 0.04); this.tone(1319, 0.14, 'square', 0.04, 0.06); break;
      case 'toast': this.tone(740, 0.08, 'sine', 0.04); break;
      case 'chime': this.tone(659, 0.5, 'sine', 0.08); this.tone(523, 0.7, 'sine', 0.08, 0.3); break;
      case 'lunch': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.07, i * 0.12)); break;
      case 'clear': {
        const n = [523, 523, 523, 659, 784, 1047];
        const d = [0, 0.12, 0.24, 0.36, 0.52, 0.7];
        n.forEach((f, i) => { this.tone(f, 0.3, 'square', 0.05, d[i]); this.tone(f / 2, 0.3, 'triangle', 0.06, d[i]); });
        break;
      }
      case 'death': {
        const n = [392, 370, 349, 294];
        n.forEach((f, i) => this.tone(f, i === 3 ? 0.9 : 0.35, 'sawtooth', 0.05, i * 0.35, i === 3 ? 0.8 : 1));
        break;
      }
    }
  }

  // ───────────── 배경음 ─────────────
  // 코드 진행(루트 반음): I – V – vi – IV (C장조 기준) — 가볍고 경쾌한 오피스 팝
  private chords = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];

  setIntensity(v: number) { this.intensity = v; this.tempo = [110, 124, 132, 142][Math.max(0, Math.min(3, v))]; }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.stepIdx = 0;
    const tick = () => {
      if (!this.ctx || !this.musicOn) return;
      while (this.nextNote < this.ctx.currentTime + 0.25) {
        this.scheduleStep(this.stepIdx, this.nextNote);
        this.nextNote += 60 / this.tempo / 4;
        this.stepIdx = (this.stepIdx + 1) % 64;
      }
    };
    this.timer = window.setInterval(tick, 50);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicBus!);
    o.start(t); o.stop(t + dur + 0.03);
  }

  private drum(kind: 'kick' | 'hat' | 'snare', t: number) {
    const c = this.ctx!;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(this.musicBus!); o.start(t); o.stop(t + 0.2);
    } else {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = c.createGain();
      const v = kind === 'hat' ? 0.05 : 0.12, d = kind === 'hat' ? 0.04 : 0.14;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f); f.connect(g); g.connect(this.musicBus!); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
    }
  }

  private scheduleStep(i: number, t: number) {
    const lvl = this.intensity;
    const bar = Math.floor(i / 16) % 4;
    const s = i % 16;
    const ch = this.chords[bar];
    const root = 130.81; // C3
    const f = (semi: number, oct = 0) => root * Math.pow(2, semi / 12 + oct);
    const stepDur = 60 / this.tempo / 4;
    // 베이스
    if (s % 4 === 0 || (lvl >= 2 && s % 4 === 2)) this.note(f(ch[0], -1), t, stepDur * 1.8, 'triangle', 0.16);
    // 드럼
    if (lvl >= 1) {
      if (s % 4 === 0) this.drum('kick', t);
      if (s % 8 === 4) this.drum('snare', t);
      if (lvl >= 2 || s % 2 === 0) this.drum('hat', t);
    } else if (s === 0) this.drum('kick', t);
    // 아르페지오
    const arp = [0, 1, 2, 1, 0, 2, 1, 2];
    if (s % 2 === 0) {
      const n = ch[arp[(s / 2) % arp.length]];
      this.note(f(n, 1), t, stepDur * 1.5, lvl >= 3 ? 'sawtooth' : 'square', lvl >= 3 ? 0.025 : 0.02);
    }
    // 멜로디(강도 2+)
    if (lvl >= 2 && (s === 0 || s === 6 || s === 10)) {
      const mel = [ch[2] + 12, ch[1] + 12, ch[0] + 12];
      this.note(f(mel[(s / 4 | 0) % 3], 1), t, stepDur * 3, 'triangle', 0.04);
    }
    // 보스: 반음 긴장 음
    if (lvl >= 3 && s === 8) this.note(f(ch[0] + 1, 0), t, stepDur * 4, 'sawtooth', 0.03);
  }
}

export const audio = new AudioEngine();

export function vibrate(on: boolean, ms: number | number[]) {
  if (!on) return;
  try { navigator.vibrate?.(ms); } catch { /* 무시 */ }
}
