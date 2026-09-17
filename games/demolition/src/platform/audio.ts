// WebAudio 절차적 효과음. 외부 음원 없음. 사용자 입력 후에만 생성·재생한다.
import type { Material } from '../sim/types';

type Ctx = AudioContext;

export class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  volume = 0.8;
  muted = false;
  private last = new Map<string, number>();
  private active = 0;
  private readonly maxActive = 6;

  /** 사용자 제스처 안에서 호출 */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    } catch { this.ctx = null; }
  }
  setVolume(v: number) { this.volume = v; this.applyVolume(); }
  setMuted(m: boolean) { this.muted = m; this.applyVolume(); }
  private applyVolume() { if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.6, this.ctx.currentTime, 0.02); }

  private can(key: string, minGapMs: number): boolean {
    if (!this.ctx || !this.master || this.muted) return false;
    const now = performance.now();
    const t = this.last.get(key) ?? -1e9;
    if (now - t < minGapMs) return false;
    if (this.active >= this.maxActive) return false;
    this.last.set(key, now);
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, opts: { slideTo?: number; attack?: number; noise?: boolean; lowpass?: number } = {}) {
    const ctx = this.ctx!, t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let src: AudioScheduledSourceNode;
    if (opts.noise) {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0); let seed = 7; for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
      const n = ctx.createBufferSource(); n.buffer = buf; src = n;
    } else {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
      src = o;
    }
    let node: AudioNode = src;
    if (opts.lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lowpass; node.connect(f); node = f; }
    node.connect(g); g.connect(this.master!);
    this.active++;
    src.onended = () => { this.active = Math.max(0, this.active - 1); };
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  pull(power: number) { if (!this.can('pull', 90)) return; this.tone(180 + power * 420, 0.06, 'square', 0.05); }
  launch(power: number) { if (!this.can('launch', 50)) return; this.tone(90, 0.18, 'sawtooth', 0.35, { slideTo: 40, lowpass: 900 }); this.tone(0, 0.12, 'square', 0.18, { noise: true, lowpass: 1800 }); }
  hit(material: Material, strength: number) {
    const s = Math.min(1, strength);
    if (material === 'wood' || material === 'crate') { if (!this.can('wood', 60)) return; this.tone(160 + s * 60, 0.09 + s * 0.08, 'triangle', 0.2 + s * 0.3, { slideTo: 70, lowpass: 1200 }); this.tone(0, 0.06, 'square', 0.12 * s, { noise: true, lowpass: 2500 }); }
    else if (material === 'metal' || material === 'iron' || material === 'cutter') { if (!this.can('metal', 60)) return; this.tone(900 + s * 600, 0.12 + s * 0.15, 'sine', 0.12 + s * 0.2, { slideTo: 500 }); this.tone(1800, 0.05, 'square', 0.05 * s); }
    else { if (!this.can('stone', 70)) return; this.tone(0, 0.08 + s * 0.06, 'square', 0.15 + s * 0.2, { noise: true, lowpass: 700 }); }
  }
  ropeCut() { if (!this.can('rope', 80)) return; this.tone(0, 0.09, 'square', 0.3, { noise: true, lowpass: 5000 }); this.tone(1400, 0.08, 'triangle', 0.15, { slideTo: 300 }); }
  roll(strength: number) { if (!this.can('roll', 140)) return; this.tone(0, 0.14, 'square', 0.05 + 0.1 * Math.min(1, strength), { noise: true, lowpass: 320 }); }
  goal(combo: number) { if (!this.can('goal', 40)) return; const base = 520 * Math.pow(1.19, Math.min(combo - 1, 8)); this.tone(base, 0.22, 'triangle', 0.3); this.tone(base * 1.5, 0.3, 'sine', 0.18, { attack: 0.03 }); }
  protectFail() { if (!this.can('pfail', 200)) return; this.tone(220, 0.35, 'sawtooth', 0.3, { slideTo: 90, lowpass: 800 }); this.tone(0, 0.25, 'square', 0.15, { noise: true, lowpass: 400 }); }
  fail() { if (!this.can('fail', 300)) return; this.tone(330, 0.25, 'triangle', 0.22, { slideTo: 200 }); setTimeout(() => this.ctx && this.tone(240, 0.35, 'triangle', 0.22, { slideTo: 140 }), 200); }
  success() { if (!this.can('success', 300)) return; [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.ctx && this.tone(f, 0.28, 'triangle', 0.25), i * 110)); }
  star() { if (!this.can('star', 60)) return; this.tone(1200, 0.12, 'sine', 0.2, { slideTo: 1800 }); }
  ui() { if (!this.can('ui', 40)) return; this.tone(700, 0.05, 'square', 0.06); }
}
