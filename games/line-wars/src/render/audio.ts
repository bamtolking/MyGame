/** Procedural WebAudio sound effects and a light ambient loop. No assets. */
import type { SimEvent } from '../core/sim/state.ts';

export class Audio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxGain: GainNode | null = null;
  bgmGain: GainNode | null = null;
  sfxVol = 0.7;
  bgmVol = 0.3;
  private noiseBuf: AudioBuffer | null = null;
  private budget = 0;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  /** must be called from a user gesture */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master); this.sfxGain.gain.value = this.sfxVol;
      this.bgmGain = this.ctx.createGain(); this.bgmGain.connect(this.master); this.bgmGain.gain.value = this.bgmVol;
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  setVolumes(sfx: number, bgm: number) {
    this.sfxVol = sfx; this.bgmVol = bgm;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.bgmGain) this.bgmGain.gain.value = bgm;
  }
  frame() { this.budget = 6; }
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, freqEnd?: number) {
    if (!this.ctx || !this.sfxGain || this.sfxVol <= 0 || this.budget-- <= 0) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + dur);
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  private noise(dur: number, vol: number, filterFreq: number) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuf || this.sfxVol <= 0 || this.budget-- <= 0) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(); s.stop(this.ctx.currentTime + dur);
  }
  handle(e: SimEvent, far: boolean) {
    if (!this.ctx) return;
    const v = far ? 0.35 : 1;
    switch (e.kind) {
      case 'shot':
        if (e.unitType === 'rifles' || e.unitType === 'glider') this.tone(1800, 0.05, 'square', 0.05 * v, 900);
        else if (e.unitType === 'piercer' || e.unitType === 'core' || e.unitType === 'outpost') { this.noise(0.15, 0.25 * v, 600); this.tone(120, 0.2, 'triangle', 0.25 * v, 50); }
        else if (e.unitType === 'howitzer') { this.noise(0.3, 0.3 * v, 400); this.tone(80, 0.4, 'sine', 0.3 * v, 30); }
        else if (e.unitType === 'flak' || e.unitType === 'interceptor') this.tone(1200, 0.08, 'sawtooth', 0.05 * v, 2400);
        else if (e.unitType === 'sprayer') this.noise(0.25, 0.12 * v, 1800);
        else if (e.unitType === 'thrower' || e.unitType === 'bomber') this.tone(300, 0.12, 'sine', 0.08 * v, 150);
        else if (e.unitType === 'gunship') this.tone(700, 0.06, 'square', 0.05 * v, 500);
        else this.tone(500, 0.05, 'square', 0.04 * v, 300);
        break;
      case 'beam': this.tone(2400, 0.25, 'sawtooth', 0.15 * v, 200); this.noise(0.2, 0.15 * v, 3000); break;
      case 'explosion': this.noise(e.power >= 1 ? 0.45 : 0.25, (e.power >= 1 ? 0.35 : 0.15) * v, 500); break;
      case 'death': this.noise(0.2, 0.12 * v, 900); this.tone(200, 0.15, 'triangle', 0.08 * v, 60); break;
      case 'buildingDestroyed': this.noise(1.2, 0.8, 300); this.tone(60, 1.2, 'sine', 0.5, 20); break;
      case 'cannonWarn': this.tone(880, 0.3, 'square', 0.15, 880); setTimeout(() => this.tone(880, 0.3, 'square', 0.15), 500); setTimeout(() => this.tone(880, 0.3, 'square', 0.15), 1000); break;
      case 'cannonFire': this.noise(1.0, 0.7, 400); this.tone(50, 1.0, 'sine', 0.5, 15); break;
      case 'dispatch': this.tone(523, 0.12, 'triangle', 0.15); setTimeout(() => this.tone(784, 0.18, 'triangle', 0.15), 110); break;
      case 'hit': if (e.shield && !far) this.tone(1500, 0.06, 'sine', 0.05, 1200); break;
      case 'relay': this.tone(660, 0.2, 'triangle', 0.2, 990); break;
      case 'overtime': this.tone(440, 0.4, 'square', 0.15, 220); break;
      case 'ended': this.tone(e.result.winner === 0 ? 660 : 330, 0.8, 'triangle', 0.3, e.result.winner === 0 ? 990 : 165); break;
      default: break;
    }
  }
  ui(kind: 'tap' | 'buy' | 'err' | 'open') {
    if (!this.ctx) return;
    this.budget = 3;
    if (kind === 'tap') this.tone(900, 0.04, 'sine', 0.08);
    else if (kind === 'buy') { this.tone(700, 0.08, 'triangle', 0.12, 1000); }
    else if (kind === 'err') this.tone(200, 0.15, 'square', 0.1, 150);
    else this.tone(500, 0.06, 'sine', 0.08, 700);
  }
  startBgm() {
    if (!this.ctx || this.bgmTimer !== null) return;
    const step = () => {
      if (!this.ctx || !this.bgmGain || this.bgmVol <= 0) { this.bgmStep++; return; }
      const notes = [55, 65.4, 73.4, 82.4, 65.4, 55, 49, 61.7];
      const f = notes[this.bgmStep % notes.length];
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.25, this.ctx.currentTime + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.9);
      o.connect(g); g.connect(this.bgmGain); o.start(); o.stop(this.ctx.currentTime + 2);
      if (this.bgmStep % 2 === 0) { const o2 = this.ctx.createOscillator(); const g2 = this.ctx.createGain(); o2.type = 'sine'; o2.frequency.value = f * 3; g2.gain.value = 0.0001; g2.gain.exponentialRampToValueAtTime(0.06, this.ctx.currentTime + 0.3); g2.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.5); o2.connect(g2); g2.connect(this.bgmGain); o2.start(); o2.stop(this.ctx.currentTime + 1.6); }
      this.bgmStep++;
    };
    step();
    this.bgmTimer = window.setInterval(step, 2000);
  }
  stopBgm() {
    if (this.bgmTimer !== null) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }
}
