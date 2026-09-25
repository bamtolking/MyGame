// 효과음 라이브러리(절차적 합성). 코어 버스(audio.ts) 위에서 동작하며 오프라인 렌더링도 가능하다.
// onSimEvent: 시뮬레이션 이벤트 → 효과음 매핑을 이 파일이 전담한다.
import type { AudioCore } from './audio';
import type { SimEvent, World } from '../sim/types';

export type SfxName =
  | 'shoot' | 'hit' | 'kill' | 'gem' | 'coin' | 'levelup' | 'tick' | 'jackpot' | 'hurt' | 'boss' | 'explode'
  | 'ult' | 'item' | 'evolve' | 'click' | 'chime' | 'lunch' | 'clear' | 'death' | 'elite' | 'buy' | 'toast';

/** 모든 효과음 이름(오프라인 점검용) */
export const SFX_NAMES: SfxName[] = ['shoot', 'hit', 'kill', 'gem', 'coin', 'levelup', 'tick', 'jackpot', 'hurt', 'boss', 'explode',
  'ult', 'item', 'evolve', 'click', 'chime', 'lunch', 'clear', 'death', 'elite', 'buy', 'toast'];

export interface SfxOpts {
  arg?: number;     // 효과음별 변주 인자(예: tick 음높이)
  pan?: number;     // -1(왼) .. 1(오)
  vol?: number;     // 배율
  weapon?: string;  // shoot 등에서 무기 id
}

export interface SfxAPI {
  play(name: SfxName, o?: SfxOpts): void;
  onSimEvent(ev: SimEvent, w: World): void;
}

export function createSfx(core: AudioCore): SfxAPI {
  const ctx = core.ctx;
  const last = new Map<string, number>();
  let gemCombo = 0, gemT = -10;

  const throttle = (key: string, sec: number) => {
    const now = core.now();
    if (now - (last.get(key) ?? -99) < sec) return false;
    last.set(key, now);
    return true;
  };

  function tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slide = 0) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(core.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur: number, vol: number, at = 0, filter = 1200, q = 0.7, type: BiquadFilterType = 'lowpass') {
    const t = ctx.currentTime + at;
    const s = ctx.createBufferSource(); s.buffer = core.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filter; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(core.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }

  function play(name: SfxName, o: SfxOpts = {}) {
    const arg = o.arg ?? 0;
    switch (name) {
      case 'shoot': if (throttle('shoot', 0.07)) tone(660 + Math.random() * 180, 0.05, 'square', 0.025, 0, 0.6); break;
      case 'hit': if (throttle('hit', 0.045)) noise(0.04, 0.05, 0, 2600, 1, 'bandpass'); break;
      case 'kill': if (throttle('kill', 0.04)) { tone(320 + Math.random() * 90, 0.07, 'triangle', 0.06, 0, 0.5); noise(0.05, 0.04, 0, 1800); } break;
      case 'gem': {
        const now = core.now();
        if (now - gemT > 0.9) gemCombo = 0;
        gemT = now;
        if (!throttle('gem', 0.035)) break;
        gemCombo = Math.min(gemCombo + 1, 24);
        tone(880 * Math.pow(2, gemCombo / 24), 0.06, 'sine', 0.05);
        break;
      }
      case 'coin': if (throttle('coin', 0.06)) { tone(1320, 0.05, 'square', 0.03); tone(1980, 0.12, 'square', 0.03, 0.05); } break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.09, i * 0.06)); tone(1568, 0.35, 'sine', 0.05, 0.24); break;
      case 'tick': tone(1400 + arg * 40, 0.03, 'square', 0.035); break;
      case 'jackpot': [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.22, 'square', 0.05, i * 0.07)); noise(0.6, 0.05, 0.1, 6000, 0.5, 'highpass'); break;
      case 'hurt': if (throttle('hurt', 0.12)) { tone(180, 0.18, 'sawtooth', 0.09, 0, 0.5); noise(0.12, 0.08, 0, 700); } break;
      case 'boss': for (let i = 0; i < 3; i++) { tone(440, 0.25, 'sawtooth', 0.06, i * 0.5, 0.7); tone(330, 0.25, 'sawtooth', 0.06, i * 0.5 + 0.25, 0.7); } break;
      case 'elite': tone(300, 0.3, 'sawtooth', 0.05, 0, 1.5); break;
      case 'explode': if (throttle('explode', 0.09)) { noise(0.35, 0.14, 0, 600); tone(90, 0.3, 'sine', 0.12, 0, 0.4); } break;
      case 'ult': noise(1.0, 0.22, 0, 900); tone(60, 0.9, 'sine', 0.25, 0, 0.5); tone(880, 0.4, 'sawtooth', 0.04, 0, 0.25); break;
      case 'item': tone(600, 0.1, 'triangle', 0.07, 0, 2); tone(1200, 0.14, 'triangle', 0.05, 0.08, 1.5); break;
      case 'evolve': [523, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, i * 0.05)); noise(0.8, 0.04, 0.2, 7000, 0.5, 'highpass'); break;
      case 'click': tone(900, 0.03, 'square', 0.03); break;
      case 'buy': tone(988, 0.06, 'square', 0.04); tone(1319, 0.14, 'square', 0.04, 0.06); break;
      case 'toast': tone(740, 0.08, 'sine', 0.04); break;
      case 'chime': tone(659, 0.5, 'sine', 0.08); tone(523, 0.7, 'sine', 0.08, 0.3); break;
      case 'lunch': [784, 988, 1175].forEach((f, i) => tone(f, 0.4, 'sine', 0.07, i * 0.12)); break;
      case 'clear': [523, 523, 523, 659, 784, 1047].forEach((f, i) => { const d = [0, 0.12, 0.24, 0.36, 0.52, 0.7][i]; tone(f, 0.3, 'square', 0.05, d); tone(f / 2, 0.3, 'triangle', 0.06, d); }); break;
      case 'death': [392, 370, 349, 294].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.35, 'sawtooth', 0.05, i * 0.35, i === 3 ? 0.8 : 1)); break;
    }
  }

  function onSimEvent(ev: SimEvent, w: World) {
    const pan = (x: number) => Math.max(-1, Math.min(1, (x - w.player.x) / (w.viewW / 2)));
    switch (ev.t) {
      case 'hit': play('hit', { pan: pan(ev.x) }); break;
      case 'kill': play(ev.boss ? 'ult' : ev.elite ? 'explode' : 'kill', { pan: pan(ev.x) }); break;
      case 'hurt': play('hurt'); break;
      case 'explode': if (ev.big) play('explode', { pan: pan(ev.x) }); break;
      case 'gem': play('gem'); break;
      case 'coin': play('coin'); break;
      case 'item': play('item'); break;
      case 'toast': if (ev.kind === 'warn' || ev.kind === 'boss') play('toast'); break;
      case 'bossSpawn': play('boss'); break;
      case 'elite': play('elite'); break;
      case 'ult': play('ult'); break;
      case 'hour': play('chime'); break;
      case 'yageun': play('boss'); break;
      case 'shoot': play('shoot', { weapon: ev.w }); break;
      default: break;
    }
  }

  return { play, onSimEvent };
}
