// 절차적 사운드: 야옹(포먼트 합성), 뽁, 퐁, 골골송, 보글보글, 배경음 오르골.
// 사용자 입력 뒤에만 시작한다 (브라우저 자동재생 정책).

export class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  sfxOn = true;
  bgmOn = true;
  private last = new Map<string, number>();
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private bgmNext = 0;

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const c: AudioContext = new AC();
      this.ctx = c;
      this.master = c.createGain(); this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.sfxOn ? 1 : 0; this.sfx.connect(this.master);
      this.music = c.createGain(); this.music.gain.value = this.bgmOn ? 0.22 : 0; this.music.connect(this.master);
      const n = Math.floor(c.sampleRate * 1.5);
      this.noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      if (this.bgmOn) this.startBgm();
    } catch { this.ctx = null; }
  }

  setSfx(on: boolean): void { this.sfxOn = on; if (this.ctx) this.sfx.gain.value = on ? 1 : 0; }
  setBgm(on: boolean): void {
    this.bgmOn = on;
    if (!this.ctx) return;
    this.music.gain.value = on ? 0.22 : 0;
    if (on) this.startBgm(); else this.stopBgm();
  }
  suspend(): void { this.ctx?.suspend().catch(() => {}); }
  resume(): void { this.ctx?.resume().catch(() => {}); }

  private gate(name: string, gapMs: number): boolean {
    const now = performance.now();
    if (now - (this.last.get(name) ?? -1e9) < gapMs) return false;
    this.last.set(name, now);
    return true;
  }

  private ok(): boolean { return !!this.ctx && this.sfxOn && this.ctx.state === 'running'; }

  /** 고양이 울음. size 0(아깽이)..10(우주뚱냥) */
  meow(size: number, kind: 'happy' | 'sad' | 'short' = 'happy', delay = 0): void {
    if (!this.ok()) return;
    const c = this.ctx!;
    const t0 = c.currentTime + delay;
    const f0 = 820 * Math.pow(0.86, size) * (0.94 + Math.random() * 0.12);
    const dur = kind === 'short' ? 0.22 : (0.3 + size * 0.035) * (kind === 'sad' ? 1.5 : 1);
    const src = c.createOscillator();
    src.type = 'sawtooth';
    const f = src.frequency;
    if (kind === 'sad') {
      f.setValueAtTime(f0 * 1.05, t0);
      f.linearRampToValueAtTime(f0 * 1.12, t0 + dur * 0.25);
      f.exponentialRampToValueAtTime(f0 * 0.62, t0 + dur);
    } else {
      f.setValueAtTime(f0 * 0.82, t0);
      f.linearRampToValueAtTime(f0 * 1.18, t0 + dur * 0.35);
      f.exponentialRampToValueAtTime(f0 * 0.78, t0 + dur);
    }
    // 비브라토
    const vib = c.createOscillator(); vib.frequency.value = 6.5;
    const vg = c.createGain(); vg.gain.value = f0 * 0.018;
    vib.connect(vg); vg.connect(f);
    // "미-아-오" 포먼트
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.9, t0 + 0.04);
    out.gain.setValueAtTime(0.9, t0 + dur * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const formant = (a: [number, number, number], q: number, gain: number) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(a[0], t0);
      bp.frequency.linearRampToValueAtTime(a[1], t0 + dur * 0.4);
      bp.frequency.linearRampToValueAtTime(a[2], t0 + dur);
      const g = c.createGain(); g.gain.value = gain;
      src.connect(bp); bp.connect(g); g.connect(out);
    };
    const k = Math.pow(0.97, size);
    formant([500 * k, 950 * k, 560 * k], 6, 1.0);
    formant([2300 * k, 1500 * k, 950 * k], 9, 0.7);
    formant([3200 * k, 2600 * k, 2300 * k], 12, 0.25);
    // 처음 "ㅁ" 소리: 저역 통과가 열린다
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, t0);
    lp.frequency.exponentialRampToValueAtTime(6000, t0 + 0.08);
    out.connect(lp); lp.connect(this.sfx);
    src.start(t0); vib.start(t0);
    src.stop(t0 + dur + 0.05); vib.stop(t0 + dur + 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, dest?: AudioNode): void {
    const c = this.ctx!;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest ?? this.sfx);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', delay = 0): void {
    const c = this.ctx!;
    const t0 = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }

  /** 합체: 뽁 + 야옹 */
  merge(tier: number, combo: number): void {
    if (!this.ok()) return;
    const p = 1 + Math.min(6, combo - 1) * 0.12;
    this.tone(520 * p * Math.pow(0.93, tier), 0.09, 'sine', 0.6, 700);
    this.tone(260 * p, 0.12, 'triangle', 0.3, -120, 0.01);
    if (this.gate('meow', 110)) this.meow(tier, 'happy', 0.05);
    if (combo >= 2) [0, 1, 2].forEach(i => this.tone(880 * p * Math.pow(1.26, i), 0.12, 'triangle', 0.2, 0, 0.08 + i * 0.05));
    if (tier >= 7) this.noise(0.35, 0.18, 900, 'lowpass', 0.02);
  }

  drop(tier: number): void {
    if (!this.ok() || !this.gate('drop', 60)) return;
    this.tone(700 - tier * 30, 0.08, 'sine', 0.3, -300);
  }

  land(tier: number, speed: number): void {
    if (!this.ok() || !this.gate('land', 70)) return;
    const v = Math.min(0.5, speed / 2000);
    this.tone(180 - tier * 8, 0.12, 'sine', v, -60);
    this.noise(0.06, v * 0.5, 700);
  }

  nip(): void {
    if (!this.ok()) return;
    [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.14, 0, i * 0.045));
    this.meow(2, 'short', 0.12);
  }

  ascend(): void {
    if (!this.ok()) return;
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.16, 0, i * 0.08));
    this.noise(1.2, 0.12, 3000, 'highpass', 0.3);
    this.meow(10, 'happy', 0.1);
  }

  punch(): void {
    if (!this.ok()) return;
    this.tone(300, 0.1, 'square', 0.12, 600);
    this.noise(0.18, 0.25, 2500, 'bandpass');
    this.meow(3, 'short', 0.06);
  }

  liquify(): void {
    if (!this.ok()) return;
    for (let i = 0; i < 12; i++) this.tone(300 + Math.random() * 500, 0.09, 'sine', 0.22, 400 + Math.random() * 300, i * 0.07);
  }

  bubble(): void {
    if (!this.ok() || !this.gate('bubble', 90)) return;
    this.tone(400 + Math.random() * 600, 0.06, 'sine', 0.12, 500);
  }

  shake(): void {
    if (!this.ok()) return;
    this.noise(0.9, 0.4, 350);
    for (let i = 0; i < 5; i++) this.tone(120, 0.1, 'triangle', 0.25, -30, i * 0.18);
  }

  charge(): void {
    if (!this.ok()) return;
    [988, 1319, 1976].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.22, 0, i * 0.07));
  }

  danger(): void {
    if (!this.ok() || !this.gate('danger', 600)) return;
    this.tone(90, 0.13, 'sine', 0.35, -20);
    this.tone(80, 0.13, 'sine', 0.3, -20, 0.16);
  }

  over(): void {
    if (!this.ok()) return;
    this.meow(5, 'sad', 0);
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, 0, 0.25 + i * 0.22));
  }

  record(): void {
    if (!this.ok()) return;
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'square', 0.12, 0, i * 0.11));
  }

  tap(): void {
    if (!this.ok() || !this.gate('tap', 40)) return;
    this.tone(900, 0.05, 'sine', 0.25, 200);
  }

  purr(): void {
    if (!this.ok() || !this.gate('purr', 1500)) return;
    const c = this.ctx!;
    const t0 = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = c.createGain(); g.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 24;
    const lg = c.createGain(); lg.gain.value = 0.9;
    lfo.connect(lg); lg.connect(g.gain);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(1, t0 + 0.2); env.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    s.connect(f); f.connect(g); g.connect(env); env.connect(this.sfx);
    s.start(t0); lfo.start(t0); s.stop(t0 + 1.3); lfo.stop(t0 + 1.3);
  }

  // ── 배경음: 느긋한 오르골 루프 ──
  private startBgm(): void {
    if (this.bgmTimer != null || !this.ctx) return;
    this.bgmNext = this.ctx.currentTime + 0.1;
    this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 120);
  }

  private stopBgm(): void {
    if (this.bgmTimer != null) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }

  private scheduleBgm(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const beat = 60 / 84 / 2;
    // C장조 5음계 멜로디 (32스텝) + 코드
    const mel = [72, -1, 76, 79, 76, -1, 74, 72, 69, -1, 72, 74, 76, -1, -1, -1, 74, -1, 77, 81, 79, -1, 76, 74, 72, -1, 74, 76, 72, -1, -1, -1];
    const chords = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
    while (this.bgmNext < c.currentTime + 0.5) {
      const step = this.bgmStep % 32;
      const t = this.bgmNext;
      const n = mel[step];
      if (n > 0) this.pluck(midi(n), t, 0.09);
      if (step % 8 === 0) {
        const ch = chords[(step / 8) | 0];
        ch.forEach((m, i) => this.pluck(midi(m), t + i * 0.02, 0.05, 1.6));
      }
      if (step % 4 === 2) this.pluck(midi(chords[(step / 8) | 0][0] + 12), t, 0.035, 0.4);
      this.bgmStep++;
      this.bgmNext += beat;
    }
  }

  private pluck(freq: number, t0: number, vol: number, dur = 0.7): void {
    const c = this.ctx!;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.005;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const g2 = c.createGain(); g2.gain.value = 0.3;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.music);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
  }
}

function midi(n: number): number { return 440 * Math.pow(2, (n - 69) / 12); }
