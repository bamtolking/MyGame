import { settings } from '../state/store';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

export function unlockAudio() {
  ac();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  tick() {
    if (settings.value.sound) tone(880, 0, 0.12, 'sine', 0.12);
  },
  go() {
    if (!settings.value.sound) return;
    tone(1320, 0, 0.28, 'sine', 0.2);
  },
  rep() {
    if (!settings.value.sound) return;
    tone(660, 0, 0.09, 'triangle', 0.16);
    tone(990, 0.07, 0.14, 'triangle', 0.14);
  },
  done() {
    if (!settings.value.sound) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle', 0.14));
  },
  shutter() {
    if (!settings.value.sound) return;
    tone(2200, 0, 0.05, 'square', 0.05);
    tone(1400, 0.05, 0.08, 'square', 0.04);
  },
  soft() {
    if (settings.value.sound) tone(520, 0, 0.18, 'sine', 0.1);
  },
};
