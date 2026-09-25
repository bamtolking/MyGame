// 오디오 코어: 컨텍스트·버스(효과음/음악/리버브/딜레이)·마스터 체인(글루 컴프 → 리미터).
// 음악은 music.ts, 효과음은 sfx.ts가 이 코어 위에서 합성한다. 외부 음원 파일 없음(전부 WebAudio 합성).
// 코어는 AudioContext와 OfflineAudioContext 모두에서 만들 수 있어 헤드리스로 렌더링·측정할 수 있다.
import type { SimEvent, World } from '../sim/types';
import { createMusic, type MusicAPI, type TrackId, type StingerId } from './music';
import { createSfx, type SfxAPI, type SfxName, type SfxOpts } from './sfx';

export interface AudioCore {
  ctx: BaseAudioContext;
  /** 효과음 버스(설정 볼륨) */
  sfx: GainNode;
  /** 음악 버스(설정 볼륨) → duck → 마스터 */
  music: GainNode;
  /** 음악 덕킹 단(큰 효과음·스팅어 때 잠깐 줄임) */
  musicDuck: GainNode;
  /** 리버브 센드(여기에 연결하면 공간감) */
  reverb: GainNode;
  /** 딜레이 센드(에코) */
  delay: GainNode;
  /** 2초 스테레오 백색 잡음 버퍼(드럼·폭발·바람) */
  noise: AudioBuffer;
  /** 마스터 직전 노드(특수 용도) */
  pre: GainNode;
  now(): number;
  /** 음악을 amount(0~1)만큼 dur초 동안 줄였다 되돌림 */
  duck(amount: number, dur: number): void;
}

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = 1234567 + ch * 7919;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      const r = (seed / 2147483647) * 2 - 1;
      const t = i / len;
      // 초기 반사 몇 개 + 지수 감쇠 꼬리
      const early = i < ctx.sampleRate * 0.08 && (i % Math.floor(ctx.sampleRate * (0.011 + ch * 0.003)) < 3) ? 0.6 : 0;
      d[i] = (r * Math.pow(1 - t, decay) + early * (1 - t)) * 0.9;
    }
  }
  return buf;
}

export function buildCore(ctx: BaseAudioContext, dest: AudioNode): AudioCore {
  const master = ctx.createGain(); master.gain.value = 0.92;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16; glue.knee.value = 8; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.2;
  const pre = ctx.createGain(); pre.gain.value = 1;
  pre.connect(glue); glue.connect(limiter); limiter.connect(master); master.connect(dest);

  const sfx = ctx.createGain(); sfx.gain.value = 0.8; sfx.connect(pre);
  const musicDuck = ctx.createGain(); musicDuck.gain.value = 1; musicDuck.connect(pre);
  const music = ctx.createGain(); music.gain.value = 0.5; music.connect(musicDuck);

  // 리버브: 생성한 임펄스 응답 컨볼루션
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, 2.4, 3.2);
  const revRet = ctx.createGain(); revRet.gain.value = 0.55;
  const reverb = ctx.createGain(); reverb.gain.value = 1;
  const revHp = ctx.createBiquadFilter(); revHp.type = 'highpass'; revHp.frequency.value = 180;
  reverb.connect(revHp); revHp.connect(conv); conv.connect(revRet); revRet.connect(pre);

  // 딜레이: 0.33초 피드백 에코(고역 감쇠)
  const delay = ctx.createGain(); delay.gain.value = 1;
  const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.33;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 3200;
  const dlRet = ctx.createGain(); dlRet.gain.value = 0.5;
  delay.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(dlRet); dlRet.connect(pre);

  // 잡음 버퍼
  const len = ctx.sampleRate * 2;
  const noise = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = noise.getChannelData(ch);
    let seed = 42 + ch * 1013;
    for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
  }

  const core: AudioCore = {
    ctx, sfx, music, musicDuck, reverb, delay, noise, pre,
    now: () => ctx.currentTime,
    duck(amount: number, dur: number) {
      const t = ctx.currentTime;
      const g = musicDuck.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(Math.max(0.05, 1 - amount), t + 0.03);
      g.linearRampToValueAtTime(1, t + 0.03 + dur);
    },
  };
  return core;
}

/** 오프라인 렌더링(테스트·측정용): fn이 코어 위에 소리를 예약하면 그 결과 버퍼를 돌려준다 */
export async function renderOffline(seconds: number, fn: (core: AudioCore) => void, sampleRate = 44100): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const core = buildCore(off, off.destination);
  core.sfx.gain.value = 0.8; core.music.gain.value = 0.5;
  fn(core);
  return off.startRendering();
}

class AudioEngine {
  ctx: AudioContext | null = null;
  core: AudioCore | null = null;
  musicApi: MusicAPI | null = null;
  sfxApi: SfxAPI | null = null;
  sfxVol = 0.8;
  musicVol = 0.5;
  private wantMusic = false;
  private track: TrackId = 'title';
  private intensity = 0;

  unlock() {
    if (!this.ctx) {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { return; }
      this.core = buildCore(this.ctx, this.ctx.destination);
      this.core.sfx.gain.value = this.sfxVol;
      this.core.music.gain.value = this.musicVol;
      this.sfxApi = createSfx(this.core);
      this.musicApi = createMusic(this.core, true);
      this.musicApi.setTrack(this.track);
      this.musicApi.setIntensity(this.intensity);
      if (this.wantMusic) this.musicApi.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx; this.musicVol = music;
    if (this.core) { this.core.sfx.gain.value = sfx; this.core.music.gain.value = music; }
  }

  suspend() { this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  private live(): boolean { return !!this.ctx && this.ctx.state === 'running'; }

  /** 효과음(UI·연출). 이름 목록은 sfx.ts */
  play(name: SfxName, arg = 0, opts: SfxOpts = {}) { if (this.live() && this.sfxVol > 0) this.sfxApi?.play(name, { ...opts, arg }); }

  /** 시뮬레이션 이벤트 → 효과음(사운드 매핑은 sfx.ts가 전담) */
  event(ev: SimEvent, w: World) { if (this.live() && this.sfxVol > 0) this.sfxApi?.onSimEvent(ev, w); }

  startMusic() { this.wantMusic = true; this.musicApi?.start(); }
  stopMusic() { this.wantMusic = false; this.musicApi?.stop(); }
  /** 곡 전환(근무지·보스·야근·타이틀) */
  setTrack(t: TrackId) { this.track = t; this.musicApi?.setTrack(t); }
  /** 0 = 차분 … 3 = 최고조 */
  setIntensity(v: number) { this.intensity = v; this.musicApi?.setIntensity(v); }
  /** 짧은 음악 연주(승리·패배·레벨업 등) */
  stinger(s: StingerId) { if (this.live()) this.musicApi?.stinger(s); }
}

export const audio = new AudioEngine();

export function vibrate(on: boolean, ms: number | number[]) {
  if (!on) return;
  try { navigator.vibrate?.(ms); } catch { /* 무시 */ }
}

export type { TrackId, StingerId, SfxName };
