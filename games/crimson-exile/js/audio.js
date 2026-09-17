'use strict';
// ===================== 간단한 신스 효과음 =====================
const Audio_ = {
  ctx: null, enabled: true, master: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.25; this.master.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  },
  tone(freq, dur, type = 'square', vol = 0.3, slide = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, lp = 1200) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  },
  play(name) {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case 'shoot': this.tone(620, 0.08, 'square', 0.12, -300); break;
      case 'cast': this.tone(300, 0.18, 'sine', 0.18, 500); break;
      case 'melee': this.noise(0.08, 0.25, 900); break;
      case 'hit': this.noise(0.05, 0.15, 2000); break;
      case 'crit': this.tone(900, 0.1, 'sawtooth', 0.15, -400); this.noise(0.08, 0.2, 3000); break;
      case 'hurt': this.tone(160, 0.2, 'sawtooth', 0.2, -80); break;
      case 'kill': this.noise(0.15, 0.2, 600); break;
      case 'explode': this.noise(0.4, 0.35, 400); this.tone(80, 0.3, 'sine', 0.3, -40); break;
      case 'pickup': this.tone(880, 0.08, 'sine', 0.15, 300); break;
      case 'currency': this.tone(1200, 0.12, 'triangle', 0.15, 600); this.tone(1800, 0.2, 'sine', 0.1, 200); break;
      case 'levelup': [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.2), i * 90)); break;
      case 'potion': this.tone(500, 0.25, 'sine', 0.2, 300); break;
      case 'dodge': this.noise(0.1, 0.1, 1500); break;
      case 'ult': [220, 330, 440, 660, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.15), i * 60)); break;
      case 'death': this.tone(200, 1.2, 'sawtooth', 0.3, -150); break;
      case 'boss': this.tone(60, 1.5, 'sawtooth', 0.35, 20); this.noise(0.6, 0.2, 300); break;
      case 'orb': this.tone(700, 0.15, 'sine', 0.2, 900); this.tone(1400, 0.3, 'sine', 0.1, -200); break;
      case 'portal': this.tone(200, 0.6, 'sine', 0.25, 800); break;
      case 'ui': this.tone(500, 0.04, 'square', 0.06); break;
      case 'shrine': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sine', 0.15), i * 70)); break;
      case 'freeze': this.tone(1500, 0.2, 'sine', 0.12, -900); break;
    }
  },
};
