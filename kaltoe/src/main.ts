import './style.css';
import { App } from './ui/app';
import { WEAPON, PASSIVE, ENEMY } from './content';
import { addWeapon, addPassive } from './sim/levelup';
import { weaponStatsAt, maxLevelOf, recalcStats } from './sim/stats';
import { spawnEnemy, hpScale } from './sim/enemies';
import { renderOffline } from './platform/audio';
import { createMusic, TRACK_IDS, STINGER_IDS, type TrackId, type StingerId } from './platform/music';
import { createSfx, SFX_NAMES, type SfxName } from './platform/sfx';

const root = document.getElementById('app')!;
const app = new App(root);
(window as unknown as { __app: App }).__app = app;

// ── 개발/테스트용 훅(스크린샷 장면 구성·오디오 점검). 게임 진행에는 쓰이지 않는다. ──
const dbg = {
  /** 진행 중인 판에 무기 추가(레벨 지정, 'max' 가능) */
  give(id: string, level: number | 'max' = 1) {
    const w = app.world; const d = WEAPON.get(id); if (!w || !d) return false;
    let wi = w.weapons.find(x => x.def.id === id);
    if (!wi) wi = addWeapon(w, d) ?? undefined;
    if (!wi) return false;
    wi.level = level === 'max' ? maxLevelOf(d) : Math.min(level, maxLevelOf(d));
    wi.st = weaponStatsAt(d, wi.level);
    return true;
  },
  passive(id: string, level = 1) {
    const w = app.world; const d = PASSIVE.get(id); if (!w || !d) return false;
    let p = w.passives.find(x => x.def.id === id);
    if (!p) { addPassive(w, d); p = w.passives.find(x => x.def.id === id); }
    if (p) { p.level = Math.min(level, d.maxLevel); recalcStats(w); }
    return true;
  },
  /** 플레이어 둘레에 적 n마리 */
  spawn(id: string, n = 1, radius = 200) {
    const w = app.world; const d = ENEMY.get(id); if (!w || !d) return 0;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.37;
      const r = radius * (0.6 + ((i * 7919) % 100) / 250);
      if (spawnEnemy(w, d, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r, hpScale(w, !!d.boss))) k++;
    }
    return k;
  },
  time(t: number) { if (app.world) app.world.t = t; },
  invuln(sec = 999) { if (app.world) app.world.player.invulnT = sec; },
  level(n: number) { if (app.world) { app.world.player.level = n; } },
};
(window as unknown as { __dbg: typeof dbg }).__dbg = dbg;

/** 오프라인 오디오 점검: 곡·스팅어·효과음을 렌더링해 음량 통계를 돌려준다(헤드리스 점검 스크립트용) */
function stats(buf: AudioBuffer) {
  let peak = 0, sum = 0, clip = 0, silent = 0, n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      sum += a * a; n++;
      if (a >= 0.999) clip++;
      if (a < 0.0005) silent++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return { peak: +peak.toFixed(3), rmsDb: +(20 * Math.log10(rms + 1e-9)).toFixed(1), clipPct: +((clip / n) * 100).toFixed(3), silentPct: +((silent / n) * 100).toFixed(1) };
}

function wavBase64(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  let o = 44;
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  let s = '';
  const bytes = new Uint8Array(out.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

(window as unknown as { __audioCheck: unknown }).__audioCheck = async (opts: { seconds?: number; wav?: boolean; tracks?: TrackId[] } = {}) => {
  const sec = opts.seconds ?? 12;
  const res: Record<string, unknown> = {};
  const wavs: Record<string, string> = {};
  for (const t of opts.tracks ?? TRACK_IDS) {
    for (const lvl of t === 'title' ? [0] : [1, 3]) {
      const buf = await renderOffline(sec, core => { const m = createMusic(core, false); m.setTrack(t); m.setIntensity(lvl); m.start(); m.scheduleRange(0, sec); });
      res[`music:${t}@${lvl}`] = stats(buf);
      if (opts.wav) wavs[`music-${t}-${lvl}`] = wavBase64(buf);
    }
  }
  for (const s of STINGER_IDS as StingerId[]) {
    const buf = await renderOffline(4, core => { const m = createMusic(core, false); m.stinger(s); m.scheduleRange(0, 4); });
    res[`stinger:${s}`] = stats(buf);
    if (opts.wav) wavs[`stinger-${s}`] = wavBase64(buf);
  }
  for (const n of SFX_NAMES as SfxName[]) {
    const buf = await renderOffline(2.5, core => { createSfx(core).play(n, { arg: 3 }); });
    res[`sfx:${n}`] = stats(buf);
    if (opts.wav) wavs[`sfx-${n}`] = wavBase64(buf);
  }
  return { stats: res, wavs };
};

// 설치형 웹앱: http(s)로 배포된 빌드에서만 서비스워커 등록(단일 파일/임베드에서는 건너뜀)
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !import.meta.env.DEV && document.querySelector('link[rel="manifest"]')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* 무시 */ });
}
