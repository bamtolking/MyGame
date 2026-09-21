// 절차 합성 효과음 (오디오 파일 없음). 첫 터치/클릭 뒤에 켜집니다.
export class Sound {
  constructor() { this.ctx = null; this.enabled = true; this.last = new Map(); this.master = null; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  tone(freq, dur, type = 'sine', { slide = 0, gain = 0.3, at = 0 } = {}) {
    const c = this.ctx, t0 = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, { gain = 0.3, from = 800, to = 200, type = 'lowpass', at = 0 } = {}) {
    const c = this.ctx, t0 = c.currentTime + at;
    const len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t0); src.stop(t0 + dur + 0.02);
  }
  play(name) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now(), minGap = { chop: 70, mine: 70, hit: 50, shot: 40, arrow: 60, crack: 80, click: 30 }[name] || 0;
    if (minGap && now - (this.last.get(name) || 0) < minGap) return;
    this.last.set(name, now);
    try {
      switch (name) {
        case 'click': this.tone(600, 0.05, 'square', { gain: 0.12 }); break;
        case 'chop': this.noise(0.08, { gain: 0.35, from: 1200, to: 300 }); this.tone(120, 0.08, 'triangle', { gain: 0.3, slide: -60 }); break;
        case 'mine': this.tone(900, 0.05, 'square', { gain: 0.15, slide: -300 }); this.noise(0.06, { gain: 0.3, from: 3000, to: 800 }); break;
        case 'pluck': this.tone(520, 0.09, 'triangle', { gain: 0.2, slide: -220 }); break;
        case 'splash': this.noise(0.18, { gain: 0.3, from: 600, to: 2500, type: 'highpass' }); break;
        case 'build': this.tone(300, 0.07, 'square', { gain: 0.15 }); this.tone(450, 0.09, 'square', { gain: 0.15, at: 0.07 }); break;
        case 'repair': this.tone(1200, 0.04, 'square', { gain: 0.12 }); this.tone(1500, 0.05, 'square', { gain: 0.12, at: 0.06 }); break;
        case 'hit': this.noise(0.05, { gain: 0.25, from: 2000, to: 400 }); this.tone(200, 0.06, 'square', { gain: 0.15, slide: -80 }); break;
        case 'hurt': this.tone(180, 0.16, 'sawtooth', { gain: 0.3, slide: -90 }); break;
        case 'kill': this.tone(400, 0.2, 'sine', { gain: 0.25, slide: -300 }); this.noise(0.12, { gain: 0.2, from: 1500, to: 200 }); break;
        case 'arrow': this.noise(0.08, { gain: 0.2, from: 4000, to: 1500, type: 'highpass' }); break;
        case 'shot': this.tone(800, 0.03, 'square', { gain: 0.12 }); this.noise(0.05, { gain: 0.15, from: 3000, to: 500 }); break;
        case 'crack': this.noise(0.07, { gain: 0.25, from: 900, to: 200 }); break;
        case 'eat': this.noise(0.06, { gain: 0.18, from: 700, to: 300 }); this.noise(0.06, { gain: 0.18, from: 700, to: 300, at: 0.09 }); break;
        case 'night': this.tone(110, 0.7, 'sawtooth', { gain: 0.28 }); this.tone(165, 0.7, 'sawtooth', { gain: 0.14 }); this.tone(82, 0.9, 'triangle', { gain: 0.25, at: 0.3 }); break;
        case 'dawn': [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'triangle', { gain: 0.2, at: i * 0.12 })); break;
        case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, 'triangle', { gain: 0.22, at: i * 0.14 })); break;
        case 'lose': [392, 311, 233].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', { gain: 0.2, at: i * 0.3 })); break;
        case 'perk': this.tone(880, 0.12, 'sine', { gain: 0.2 }); this.tone(1320, 0.25, 'sine', { gain: 0.2, at: 0.1 }); break;
        case 'levelup': [659, 784, 988, 1318].forEach((f, i) => this.tone(f, 0.2, 'square', { gain: 0.12, at: i * 0.1 })); break;
        case 'explosion': this.noise(0.45, { gain: 0.5, from: 1200, to: 60 }); this.tone(60, 0.4, 'sine', { gain: 0.4, slide: -30 }); break;
        case 'steal': this.tone(700, 0.08, 'square', { gain: 0.15 }); this.tone(500, 0.12, 'square', { gain: 0.15, at: 0.09 }); break;
        case 'revive': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.2, 'sine', { gain: 0.2, at: i * 0.09 })); break;
        case 'warn': this.tone(440, 0.12, 'square', { gain: 0.12 }); this.tone(440, 0.12, 'square', { gain: 0.12, at: 0.18 }); break;
        case 'boss': this.tone(55, 1.2, 'sawtooth', { gain: 0.35 }); this.tone(58, 1.2, 'sawtooth', { gain: 0.2 }); break;
        default: break;
      }
    } catch { /* 오디오 오류는 무시 */ }
  }
}
