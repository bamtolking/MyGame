// 배경음 시퀀서(절차적 합성). 곡(track)마다 패턴을 가지고, 강도(intensity 0~3)에 따라 레이어가 더해진다.
// 스케줄러는 '구간 예약' 방식: 실시간은 0.25초 앞을 주기적으로 예약하고, 오프라인 렌더는 한 번에 전체를 예약한다.
import type { AudioCore } from './audio';

export type TrackId = 'title' | 'office' | 'crunch' | 'dinner' | 'holiday' | 'boss' | 'overtime';
export type StingerId = 'victory' | 'defeat' | 'levelup' | 'evolve' | 'lunch' | 'bossIntro';

export const TRACK_IDS: TrackId[] = ['title', 'office', 'crunch', 'dinner', 'holiday', 'boss', 'overtime'];
export const STINGER_IDS: StingerId[] = ['victory', 'defeat', 'levelup', 'evolve', 'lunch', 'bossIntro'];

export interface MusicAPI {
  start(): void;
  stop(): void;
  setTrack(t: TrackId): void;
  setIntensity(v: number): void;
  stinger(s: StingerId): void;
  /** [from, to) 초 구간의 음을 예약(오프라인 렌더용으로도 쓴다) */
  scheduleRange(from: number, to: number): void;
}

export function createMusic(core: AudioCore, live: boolean): MusicAPI {
  const ctx = core.ctx;
  let track: TrackId = 'title';
  let intensity = 0;
  let playing = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextStep = 0;      // 다음 16분음표 시각(ctx 시간)
  let stepIdx = 0;
  const chords = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
  const tempo = () => [110, 124, 132, 142][Math.max(0, Math.min(3, intensity))] + (track === 'boss' ? 10 : 0);

  function note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(core.music);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function drum(kind: 'kick' | 'hat' | 'snare', t: number) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(core.music); o.start(t); o.stop(t + 0.2);
    } else {
      const s = ctx.createBufferSource(); s.buffer = core.noise;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = ctx.createGain();
      const v = kind === 'hat' ? 0.05 : 0.12, d = kind === 'hat' ? 0.04 : 0.14;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f); f.connect(g); g.connect(core.music); s.start(t, (stepIdx % 7) * 0.1); s.stop(t + d + 0.02);
    }
  }

  function step(i: number, t: number) {
    const lvl = track === 'boss' ? 3 : intensity;
    const bar = Math.floor(i / 16) % 4, s = i % 16;
    const ch = chords[bar];
    const f = (semi: number, oct = 0) => 130.81 * Math.pow(2, semi / 12 + oct);
    const sd = 60 / tempo() / 4;
    if (s % 4 === 0 || (lvl >= 2 && s % 4 === 2)) note(f(ch[0], -1), t, sd * 1.8, 'triangle', 0.16);
    if (lvl >= 1) { if (s % 4 === 0) drum('kick', t); if (s % 8 === 4) drum('snare', t); if (lvl >= 2 || s % 2 === 0) drum('hat', t); }
    else if (s === 0) drum('kick', t);
    const arp = [0, 1, 2, 1, 0, 2, 1, 2];
    if (s % 2 === 0) note(f(ch[arp[(s / 2) % arp.length]], 1), t, sd * 1.5, lvl >= 3 ? 'sawtooth' : 'square', lvl >= 3 ? 0.025 : 0.02);
    if (lvl >= 2 && (s === 0 || s === 6 || s === 10)) { const mel = [ch[2] + 12, ch[1] + 12, ch[0] + 12]; note(f(mel[(s / 4 | 0) % 3], 1), t, sd * 3, 'triangle', 0.04); }
    if (lvl >= 3 && s === 8) note(f(ch[0] + 1, 0), t, sd * 4, 'sawtooth', 0.03);
  }

  function scheduleRange(from: number, to: number) {
    if (nextStep < from) nextStep = from;
    while (nextStep < to) {
      step(stepIdx, nextStep);
      nextStep += 60 / tempo() / 4;
      stepIdx = (stepIdx + 1) % 64;
    }
  }

  return {
    start() {
      if (playing) return;
      playing = true;
      nextStep = ctx.currentTime + 0.1;
      if (live) timer = setInterval(() => { if (playing) scheduleRange(ctx.currentTime, ctx.currentTime + 0.25); }, 50);
    },
    stop() { playing = false; if (timer) { clearInterval(timer); timer = null; } },
    setTrack(t: TrackId) { track = t; },
    setIntensity(v: number) { intensity = Math.max(0, Math.min(3, v)); },
    stinger(_s: StingerId) { /* 기본판: 없음 */ },
    scheduleRange,
  };
}
