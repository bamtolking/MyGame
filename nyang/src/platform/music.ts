// 배경음악: WebAudio로 실시간 합성하는 16마디 곡 (F장조, 재즈풍 코드 진행).
// 타이틀은 느긋한 편곡, 게임은 통통 튀는 편곡, 냥냥 피버에서는 박수·16분 하이햇·아르페지오가 더해진다.
// 넘치기 직전(긴장도)에는 음악이 먹먹해진다.

export type MusicMode = 'title' | 'game' | 'off';

/** 한 마디의 코드: 베이스 음(MIDI), 5도 간격, 건반 보이싱(MIDI) */
interface Chord { root: number; fifth: number; voicing: number[] }

const F = 41, E = 40, A = 45, D = 38, C = 36, Bb = 46, G = 43;
const ch = (root: number, voicing: number[], fifth = 7): Chord => ({ root, fifth, voicing });

/** 16마디, 각 마디는 코드 1개 또는 2개(반 마디씩) */
const CHORDS: Chord[][] = [
  [ch(F, [57, 60, 64, 67])],
  [ch(E, [55, 58, 62, 64], 6), ch(A, [55, 61, 64, 66])],
  [ch(D, [53, 57, 60, 64])],
  [ch(C, [51, 55, 58, 62]), ch(F, [51, 55, 57, 62])],
  [ch(Bb, [50, 53, 57, 60])],
  [ch(A, [52, 55, 59, 60]), ch(D, [54, 57, 60, 64])],
  [ch(G, [53, 57, 58, 62])],
  [ch(C, [52, 55, 58, 62])],
  [ch(Bb, [50, 53, 57, 60])],
  [ch(Bb, [52, 55, 58, 60])],
  [ch(A, [52, 55, 59, 60])],
  [ch(D, [53, 57, 60, 64])],
  [ch(G, [53, 57, 58, 62])],
  [ch(C, [52, 55, 58, 62])],
  [ch(F, [57, 60, 64, 67])],
  [ch(C, [53, 55, 58, 62]), ch(C, [52, 55, 58, 62])],
];

/** 멜로디: 마디마다 8분음표 8칸. 음이름, '-' 이어서, '.' 쉼 */
const MELODY = [
  'C5 . A4 C5 E5 - D5 C5',
  'D5 . Bb4 G4 A4 - C#5 E5',
  'F5 - E5 D5 C5 - A4 .',
  'G4 . Bb4 C5 Eb5 - D5 C5',
  'D5 . F5 - A5 - G5 F5',
  'E5 . C5 A4 F#4 - A4 C5',
  'Bb4 - D5 F5 E5 - D5 Bb4',
  'C5 . E5 G5 Bb4 - - .',
  'F5 - - D5 F5 - A5 -',
  'G5 - E5 C5 G4 - - .',
  'E5 - - C5 E5 - G5 -',
  'F5 - E5 D5 A4 - - .',
  'D5 . Bb4 D5 G5 - F5 D5',
  'E5 . C5 E5 Bb5 - G5 E5',
  'F5 - - - E5 - C5 A4',
  'G4 - Bb4 - C5 - E5 .',
];

const NOTE: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function noteToMidi(n: string): number {
  const m = /^([A-G][#b]?)(\d)$/.exec(n);
  if (!m) throw new Error('bad note ' + n);
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
}

/** 멜로디 한 마디 → [시작 칸, MIDI, 길이(칸)] 목록 */
export function parseBar(bar: string): Array<[number, number, number]> {
  const tok = bar.trim().split(/\s+/);
  const out: Array<[number, number, number]> = [];
  tok.forEach((x, i) => {
    if (x === '-' || x === '.') { if (x === '-' && out.length) out[out.length - 1][2]++; return; }
    out.push([i, noteToMidi(x), 1]);
  });
  return out;
}

const MEL = MELODY.map(parseBar);
export const SONG = { chords: CHORDS, melody: MEL };

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private out: GainNode;
  private bus: GainNode;
  private filter: BiquadFilterNode;
  private send: GainNode;
  private mode: MusicMode = 'off';
  private pendingMode: MusicMode | null = null;
  private fever = false;
  private tension = 0;
  private enabled = true;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private bpm = 84;
  private swing = 0.56;

  constructor(private ctx: AudioContext, dest: AudioNode, private noise: AudioBuffer) {
    const c = ctx;
    this.out = c.createGain(); this.out.gain.value = 0;
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 16000; this.filter.Q.value = 0.5;
    this.bus = c.createGain(); this.bus.gain.value = 1;
    this.send = c.createGain(); this.send.gain.value = 0.28;
    const verb = c.createConvolver();
    verb.buffer = this.impulse(2.2);
    this.bus.connect(this.filter);
    this.bus.connect(this.send); this.send.connect(verb); verb.connect(this.filter);
    this.filter.connect(this.out);
    this.out.connect(dest);
  }

  private impulse(sec: number): AudioBuffer {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    return buf;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyGain();
    if (on && this.mode !== 'off') this.run();
  }

  /** 모드는 다음 마디 첫 박에서 바뀐다 (끊기지 않게) */
  setMode(m: MusicMode): void {
    if (m === this.mode && !this.pendingMode) return;
    if (this.mode === 'off' || m === 'off') {
      this.mode = m; this.pendingMode = null;
      if (m !== 'off') { this.step = 0; this.nextTime = this.ctx.currentTime + 0.08; this.tempoFor(m); this.run(); }
      this.applyGain();
      return;
    }
    this.pendingMode = m;
  }

  getMode(): MusicMode { return this.pendingMode ?? this.mode; }

  setFever(on: boolean): void {
    this.fever = on;
    this.applyGain();
  }

  setTension(k: number): void {
    const v = Math.max(0, Math.min(1, k));
    if (Math.abs(v - this.tension) < 0.02) return;
    this.tension = v;
    const f = 16000 * Math.pow(1 - v * 0.93, 2.2) + 500;
    this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.25);
  }

  private applyGain(): void {
    const target = !this.enabled || this.mode === 'off' ? 0 : this.fever ? 1.15 : 1;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setTargetAtTime(target, this.ctx.currentTime, this.mode === 'off' ? 0.25 : 0.4);
  }

  private tempoFor(m: MusicMode): void {
    if (m === 'title') { this.bpm = 80; this.swing = 0.56; }
    else { this.bpm = 104; this.swing = 0.6; }
  }

  private run(): void {
    if (this.timer != null) return;
    if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.tick(), 50);
  }

  private halt(): void {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null; }
  }

  /** 앞으로 0.25초 안에 올 8분음표 칸들을 예약한다 */
  tick(): void {
    const c = this.ctx;
    if (!this.enabled || (this.mode === 'off' && this.out.gain.value < 0.001)) { this.halt(); return; }
    if (c.state !== 'running') return;
    if (this.nextTime < c.currentTime - 0.5) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.25) {
      if (this.step % 8 === 0 && this.pendingMode) {
        this.mode = this.pendingMode; this.pendingMode = null; this.tempoFor(this.mode);
      }
      const beat = 60 / this.bpm;
      const dur = (this.step % 2 === 0 ? this.swing : 1 - this.swing) * beat;
      if (this.mode !== 'off') this.play(this.step, this.nextTime, dur, beat);
      this.nextTime += dur;
      this.step++;
    }
  }

  /** 오프라인 렌더(테스트)용: 지정한 칸 수만큼 바로 예약 */
  renderSteps(mode: MusicMode, steps: number, fever = false): number {
    this.mode = mode; this.tempoFor(mode); this.fever = fever; this.enabled = true;
    this.out.gain.value = fever ? 1.15 : 1;
    let t = 0.05;
    for (let s = 0; s < steps; s++) {
      const beat = 60 / this.bpm;
      const dur = (s % 2 === 0 ? this.swing : 1 - this.swing) * beat;
      this.play(s, t, dur, beat);
      t += dur;
    }
    return t;
  }

  private play(step: number, t: number, dur: number, beat: number): void {
    const bar = Math.floor(step / 8) % 16;
    const pos = step % 8;
    const chords = CHORDS[bar];
    const chord = chords.length > 1 && pos >= 4 ? chords[1] : chords[0];
    const nextBar = CHORDS[(bar + 1) % 16][0];
    const eighth = beat / 2;
    if (this.mode === 'title') this.playTitle(bar, pos, chord, t, eighth);
    else this.playGame(bar, pos, chord, chords, nextBar, t, dur, eighth);
  }

  private playTitle(bar: number, pos: number, chord: Chord, t: number, eighth: number): void {
    if (pos === 0) {
      this.pad(chord.voicing, t, eighth * 8, 0.05);
      this.bass(chord.root, t, eighth * 5, 0.15, true);
    }
    if (pos === 4 && CHORDS[bar].length > 1) this.pad(chord.voicing, t, eighth * 4, 0.045);
    if (pos % 2 === 0) this.bell(chord.voicing[(pos / 2) % chord.voicing.length] + 12, t, eighth * 3, 0.07);
    if (bar >= 8) {
      for (const [p, m, len] of MEL[bar]) if (p === pos) this.flute(m - 12, t, eighth * len, 0.1);
    }
    if (pos % 2 === 1) this.hat(t, 0.018);
  }

  private playGame(bar: number, pos: number, chord: Chord, chords: Chord[], next: Chord, t: number, dur: number, eighth: number): void {
    const fever = this.fever;
    // 베이스: 근음 - 5도 - 근음 - 5도 - 다음 코드로 반음 접근
    const second = chords.length > 1 ? chords[1] : chords[0];
    if (pos === 0) this.bass(chords[0].root, t, eighth * 1.6, 0.2);
    if (pos === 2) this.bass(chords[0].root + chords[0].fifth, t, eighth * 0.9, 0.15);
    if (pos === 4) this.bass(second.root, t, eighth * 1.6, 0.19);
    if (pos === 6) this.bass(second.root + second.fifth, t, eighth * 0.9, 0.14);
    if (pos === 7) this.bass(next.root - 1, t, eighth * 0.9, 0.13);
    if (fever && pos % 2 === 1 && pos !== 7) this.bass(chord.root + 12, t, eighth * 0.6, 0.08);
    // 건반 반주: 엇박 스탭
    if (pos === 1 || pos === 5) for (const m of chord.voicing) this.ep(m, t, eighth * 1.4, 0.05);
    if (pos === 3) for (const m of chord.voicing) this.ep(m, t, eighth * 0.7, 0.035);
    // 멜로디
    for (const [p, m, len] of MEL[bar]) if (p === pos) this.bell(m, t, eighth * len * 0.95, 0.1);
    // 드럼
    const fill = bar % 4 === 3;
    if (pos === 0 || pos === 4 || (fever && (pos === 2 || pos === 6)) || (bar % 2 === 1 && pos === 7)) this.kick(t, pos === 0 ? 0.55 : 0.45);
    if (pos === 2 || pos === 6) { this.snare(t, 0.16); if (fever) this.clap(t, 0.2); }
    if (fill && pos === 7) this.snare(t + dur * 0.5, 0.1);
    this.hat(t, pos % 2 === 1 ? 0.05 : 0.03, fill && pos === 7);
    if (fever) {
      this.hat(t + dur * 0.5, 0.025);
      // 반짝이는 16분 아르페지오
      const v = chord.voicing;
      const a = v[(pos * 2) % v.length] + 24, b = v[(pos * 2 + 1) % v.length] + 12;
      this.arp(a, t, dur * 0.45, 0.035);
      this.arp(b, t + dur * 0.5, dur * 0.45, 0.03);
    }
  }

  // ── 악기 ──────────────────────────────────────────────────

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number, sustain: number, end: number): void {
    const p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak * sustain), t + attack + decay);
    p.setValueAtTime(Math.max(0.0002, peak * sustain), Math.max(t + attack + decay, end - 0.02));
    p.exponentialRampToValueAtTime(0.0001, end + 0.12);
  }

  /** 전자 피아노 (FM) */
  private ep(m: number, t: number, len: number, vel: number): void {
    const c = this.ctx, f = hz(m);
    const car = c.createOscillator(); car.frequency.value = f;
    const mod = c.createOscillator(); mod.frequency.value = f;
    const idx = c.createGain();
    idx.gain.setValueAtTime(f * 1.6, t); idx.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.35);
    mod.connect(idx); idx.connect(car.frequency);
    const tine = c.createOscillator(); tine.frequency.value = f * 7;
    const tg = c.createGain(); tg.gain.setValueAtTime(vel * 0.25, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    const g = c.createGain();
    this.env(g, t, vel, 0.006, 0.35, 0.45, t + len);
    car.connect(g); tine.connect(tg); tg.connect(this.bus); g.connect(this.bus);
    const end = t + len + 0.2;
    car.start(t); mod.start(t); tine.start(t); car.stop(end); mod.stop(end); tine.stop(t + 0.1);
  }

  /** 멜로디용 말렛 (마림바/칼림바 느낌) */
  private bell(m: number, t: number, len: number, vel: number): void {
    const c = this.ctx, f = hz(m);
    const g = c.createGain();
    this.env(g, t, vel, 0.004, 0.25, 0.35, t + Math.max(0.12, len));
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.98;
    const g2 = c.createGain(); g2.gain.setValueAtTime(vel * 0.35, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    const o3 = c.createOscillator(); o3.type = 'triangle'; o3.frequency.value = f * 2;
    const g3 = c.createGain(); g3.gain.value = 0.18;
    o1.connect(g); o3.connect(g3); g3.connect(g); o2.connect(g2); g2.connect(this.bus); g.connect(this.bus);
    const end = t + len + 0.3;
    for (const o of [o1, o3]) { o.start(t); o.stop(end); }
    o2.start(t); o2.stop(t + 0.15);
  }

  private bass(m: number, t: number, len: number, vel: number, soft = false): void {
    const c = this.ctx, f = hz(m);
    const o = c.createOscillator(); o.type = soft ? 'sine' : 'triangle'; o.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f / 2;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = soft ? 500 : 900;
    const g = c.createGain();
    this.env(g, t, vel, 0.008, 0.2, 0.6, t + len);
    const g2 = c.createGain(); g2.gain.value = 0.5;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.bus);
    const end = t + len + 0.2;
    o.start(t); o2.start(t); o.stop(end); o2.stop(end);
  }

  private pad(ms: number[], t: number, len: number, vel: number): void {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + Math.min(0.8, len * 0.4));
    g.gain.setValueAtTime(vel, t + len * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4);
    lp.connect(g); g.connect(this.bus);
    for (const m of ms) for (const det of [-6, 6]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + len + 0.5);
    }
  }

  private flute(m: number, t: number, len: number, vel: number): void {
    const c = this.ctx, f = hz(m);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const vib = c.createOscillator(); vib.frequency.value = 5;
    const vg = c.createGain(); vg.gain.value = f * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    const g = c.createGain();
    this.env(g, t, vel, 0.06, 0.2, 0.8, t + len);
    o.connect(g); g.connect(this.bus);
    const end = t + len + 0.2;
    o.start(t); vib.start(t); o.stop(end); vib.stop(end);
  }

  private arp(m: number, t: number, len: number, vel: number): void {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = hz(m);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    const g = c.createGain();
    this.env(g, t, vel, 0.003, 0.08, 0.3, t + len);
    o.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + len + 0.15);
  }

  private noiseHit(t: number, len: number, vel: number, type: BiquadFilterType, freq: number, q = 1): void {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t, Math.random() * 1.2); s.stop(t + len + 0.02);
  }

  private kick(t: number, vel: number): void {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.3);
  }

  private snare(t: number, vel: number): void {
    this.noiseHit(t, 0.16, vel, 'bandpass', 1900, 0.8);
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const g = c.createGain(); g.gain.setValueAtTime(vel * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.12);
  }

  private clap(t: number, vel: number): void {
    for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.012, 0.09, vel * (i === 2 ? 1 : 0.6), 'bandpass', 1300, 1.5);
  }

  private hat(t: number, vel: number, open = false): void {
    this.noiseHit(t, open ? 0.22 : 0.045, vel, 'highpass', 7500, 0.7);
  }
}
