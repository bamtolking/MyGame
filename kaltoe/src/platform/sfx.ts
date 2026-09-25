// 효과음 라이브러리(절차적 합성) — '야근 네온' 사운드 방향(docs/STYLE.md §3 효과음). 외부 음원 없음.
// · 합성: 소리마다 샘플 단위 DSP(잡음+SVF 필터 스윕, 활강 오실레이터·FM·잡음 FM, 모달 종, 파편 임펄스, 소프트 새추레이션)로
//   변주 1~4개를 AudioBuffer에 미리 구워 둔다(처음 쓸 때, 실시간이면 켜진 직후 유휴 시간에 핵심 소리부터 미리).
//   모든 소리는 트랜지언트(딱) + 몸통(퍽·쿵·음색) + 꼬리(잔향·파편) 여러 겹이다.
// · 재생: 버퍼 소스 1개 + 게인 1개만 새로 만든다(휴대폰 오디오 스레드 부담 최소). 팬(고정 9단 StereoPanner)·리버브·딜레이
//   센드는 공유 버스. 재생마다 변주·음높이(playbackRate)·음량이 흔들려 반복돼도 기계적으로 들리지 않는다.
// · 믹스 위생: 우선순위별 동시 발음 상한(낮은 순위부터 버림, 큰 소리는 가장 오래된 잔소리를 끊고 들어감), 소리별 스로틀,
//   종류별 동시 발음 수, 잦은 소리는 밀도가 높을수록 자동으로 작아짐, 큰 소리는 리버브 센드 + 음악 덕킹.
//   리버브·딜레이 센드와 덕킹 깊이도 효과음 볼륨을 따라간다(볼륨을 줄여도 잔향만 남거나 음악이 괜히 줄지 않게).
// · 음정 맞춤: 음정이 있는 효과음(종·화음·5음계)은 음악 엔진이 알려 주는 지금 화음이나 곡의 조로 옮겨 낸다
//   (고정 C 장조가 D장조·F단조 곡 위에서 틀린 음으로 부딪치지 않게). 큰 소리는 음정 층만 따로 구워 잡음·충격은 그대로 둔다.
// · onSimEvent: 시뮬레이션 이벤트 → 효과음 매핑을 이 파일이 전담한다(레벨업·상자·점심·승리·사망은 app.ts가 직접 재생).
import type { AudioCore } from './audio';
import type { SimEvent, World } from '../sim/types';
import type { Harmony } from './music';

export type SfxName =
  | 'shoot' | 'hit' | 'kill' | 'gem' | 'coin' | 'levelup' | 'tick' | 'jackpot' | 'hurt' | 'boss' | 'explode'
  | 'ult' | 'item' | 'evolve' | 'click' | 'chime' | 'lunch' | 'clear' | 'death' | 'elite' | 'buy' | 'toast'
  | 'crit' | 'burn' | 'zap' | 'eliteKill' | 'bossKill' | 'enemyShot' | 'heal' | 'magnet' | 'timestop' | 'revive' | 'maxed' | 'yageun';

/** 모든 효과음 이름(오프라인 점검용) */
export const SFX_NAMES: SfxName[] = ['shoot', 'hit', 'kill', 'gem', 'coin', 'levelup', 'tick', 'jackpot', 'hurt', 'boss', 'explode',
  'ult', 'item', 'evolve', 'click', 'chime', 'lunch', 'clear', 'death', 'elite', 'buy', 'toast',
  'crit', 'burn', 'zap', 'eliteKill', 'bossKill', 'enemyShot', 'heal', 'magnet', 'timestop', 'revive', 'maxed', 'yageun'];

export interface SfxOpts {
  arg?: number;     // 효과음별 변주 인자(예: tick 음높이 단계 0..7, ult 궁극기 종류, explode 반경)
  pan?: number;     // -1(왼) .. 1(오)
  vol?: number;     // 배율
  weapon?: string;  // shoot 등에서 무기 id
}

export interface SfxAPI {
  play(name: SfxName, o?: SfxOpts): void;
  onSimEvent(ev: SimEvent, w: World): void;
}

// ───────────── 샘플 단위 합성 도구 ─────────────
// 합성은 모듈 전역 상태(SR·잡음 시드)를 쓰는 동기 함수라 한 번에 한 버퍼씩만 굽는다.

const TAU = Math.PI * 2;
let SR = 44100;
let nzS = 1;
/** 잡음 난수(xorshift32, -1..1). 채널마다 시드를 달리해 스테레오 폭을 만든다 */
const nz = () => { nzS ^= nzS << 13; nzS ^= nzS >>> 17; nzS ^= nzS << 5; return (nzS >>> 0) / 2147483648 - 1; };
/** 매개변수 난수(mulberry32, 0..1) — 변주마다 재현 가능 */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
const blep = (t: number, dt: number) => t < dt ? (t /= dt, t + t - t * t - 1) : t > 1 - dt ? (t = (t - 1) / dt, t * t + t + t + 1) : 0;
/** 사인 표(4096칸 + 선형 보간, 오차 -130dB) — 샘플마다 Math.sin을 부르지 않는다. ph는 0..1(부동소수 반올림으로 정확히 1이 돼도 안전하게 한 칸 더) */
const SINN = 4096, SIN = new Float32Array(SINN + 2);
for (let i = 0; i <= SINN + 1; i++) SIN[i] = Math.sin(TAU * i / SINN);
const sinT = (ph: number) => { const x = ph * SINN, i = x | 0; return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i); };
/** 어택 곡선(1 직선·2·3 점점 가파르게 차오름) */
const curve = (x: number, ap: number) => ap === 1 ? x : ap === 2 ? x * x : x * x * x;
/** 층 길이: 어택 + 유지 + 감쇠 6τ(-52dB) */
const span = (o: Float32Array, n0: number, a: number, h: number, d: number, len?: number) => Math.min(o.length - n0, len ? Math.round(len * SR) : a + h + Math.round(d * SR * 6));

/** 오실레이터 층: 음높이 지수 활강·FM·잡음 FM·비브라토·필터 엔벨로프 */
interface T {
  t?: number; f: number; to?: number; gl?: number;      // 시작(초)·시작 주파수·목표 주파수·활강 시정수
  w?: number;                                           // 파형 0 사인·1 삼각·2 톱니·3 사각
  a?: number; ap?: number; h?: number; d: number; v: number;  // 어택·어택 곡률·유지·감쇠 시정수·음량
  fm?: number; fi?: number; fd?: number;                // FM 변조비·지수·지수 감쇠(사인만)
  nm?: number;                                          // 잡음 FM 깊이(전기 지직)
  vib?: number; vd?: number;                            // 비브라토 속도·깊이
  lp?: number; le?: number; q?: number;                 // 저역 통과(기본 차단·엔벨로프 가산·공진)
  len?: number;
}
function tone(o: Float32Array, p: T) {
  const n0 = Math.round((p.t ?? 0) * SR); if (n0 >= o.length) return;
  const a = Math.max(1, Math.round((p.a ?? 0.0015) * SR)), h = Math.round((p.h ?? 0) * SR), ah = a + h, ap = p.ap ?? 1;
  const n = span(o, n0, a, h, p.d, p.len);
  const dm = Math.exp(-1 / (p.d * SR)), to = p.to ?? p.f, gm = p.to !== undefined ? Math.exp(-1 / ((p.gl ?? 0.05) * SR)) : 0;
  const w = p.w ?? 0, fm = p.fm ?? 0, fim = p.fd ? Math.exp(-1 / (p.fd * SR)) : 1, nm = p.nm ?? 0, vinc = (p.vib ?? 0) / SR, vd = p.vd ?? 0;
  const lp = p.lp ?? 0, le = p.le ?? 0, k = 1 / (p.q ?? 0.8), vol = p.v, ITAU = 1 / TAU;
  let df = p.f - to, ph = 0, mph = 0, vph = 0, e = 1, fi = p.fi ?? 0, ns = 0, env = 0, a1 = 0, a2 = 0, a3 = 0, ic1 = 0, ic2 = 0;
  for (let i = 0; i < n; i++) {
    if (i < a) env = curve(i / a, ap); else if (i < ah) env = 1; else { e *= dm; env = e; }
    let f = to + df; df *= gm;
    if (vinc) { vph += vinc; if (vph >= 1) vph -= 1; f *= 1 + vd * sinT(vph); }
    if (nm) { ns += (nz() - ns) * 0.2; f *= 1 + nm * ns; }
    const dt = Math.min(0.45, Math.abs(f) / SR);
    ph += dt; if (ph >= 1) ph -= 1;
    let s: number;
    if (w === 0) {
      if (fm) { mph += dt * fm; mph -= Math.floor(mph); let q = ph + fi * sinT(mph) * ITAU; q -= Math.floor(q); s = sinT(q); fi *= fim; }
      else s = sinT(ph);
    } else if (w === 1) s = 4 * Math.abs(ph - 0.5) - 1;
    else if (w === 2) s = 2 * ph - 1 - blep(ph, dt);
    else { let q = ph + 0.5; if (q >= 1) q -= 1; s = (ph < 0.5 ? 1 : -1) + blep(ph, dt) - blep(q, dt); }
    if (lp) {
      if ((i & 15) === 0) { const g = Math.tan(Math.PI * Math.min(SR * 0.45, lp + le * env) / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; }
      const v3 = s - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; s = v2;
    }
    o[n0 + i] += s * env * vol;
  }
}

/** 잡음 층: 상태 변수 필터(0 저역·1 대역·2 고역) 차단 주파수 지수 스윕 + 진폭 변조(펄럭임). 대역폭만큼 음량 보정 */
interface N {
  t?: number; a?: number; ap?: number; h?: number; d: number; v: number;
  m?: number; f?: number; to?: number; gl?: number; q?: number;
  am?: number; ad?: number; len?: number;
}
function noise(o: Float32Array, p: N) {
  const n0 = Math.round((p.t ?? 0) * SR); if (n0 >= o.length) return;
  const a = Math.max(1, Math.round((p.a ?? 0.0005) * SR)), h = Math.round((p.h ?? 0) * SR), ah = a + h, ap = p.ap ?? 1;
  const n = span(o, n0, a, h, p.d, p.len);
  const dm = Math.exp(-1 / (p.d * SR)), m = p.m ?? 0, q = p.q ?? 0.707, k = 1 / q, f0 = p.f ?? 1000, to = p.to ?? f0;
  const gm = Math.exp(-16 / ((p.gl ?? 0.05) * SR)), ainc = (p.am ?? 0) / SR, ad = p.ad ?? 0;
  const fg = Math.sqrt(f0 * to), ny = SR / 2;
  const bw = m === 0 ? fg : m === 1 ? fg / q : Math.max(1500, ny - fg);
  const v = p.v * Math.min(6, Math.sqrt(ny / bw));
  let df = f0 - to, e = 1, env = 0, aph = 0, a1 = 0, a2 = 0, a3 = 0, ic1 = 0, ic2 = 0;
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) { const g = Math.tan(Math.PI * Math.max(20, Math.min(SR * 0.45, to + df)) / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; df *= gm; }
    const x = nz();
    const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    const y = m === 0 ? v2 : m === 1 ? k * v1 : x - k * v1 - v2;
    if (i < a) env = curve(i / a, ap); else if (i < ah) env = 1; else { e *= dm; env = e; }
    if (ainc) { aph += ainc; if (aph >= 1) aph -= 1; env *= 1 - ad * (0.5 + 0.5 * sinT(aph)); }
    o[n0 + i] += y * env * v;
  }
}

/** 모달 종: 비조화 배음(비율·음량·감쇠 시정수 3개씩)을 감쇠 회전자로 합성(sin 호출 없음) */
function bell(o: Float32Array, p: { t?: number; f: number; pt: number[]; v: number; a?: number; len?: number }) {
  const n0 = Math.round((p.t ?? 0) * SR); if (n0 >= o.length) return;
  const a = Math.max(1, Math.round((p.a ?? 0.0006) * SR));
  for (let j = 0; j < p.pt.length; j += 3) {
    const fr = p.f * p.pt[j]; if (fr >= SR * 0.45) continue;
    const amp = p.pt[j + 1] * p.v, tau = p.pt[j + 2];
    const cw = Math.cos(TAU * fr / SR), sw = Math.sin(TAU * fr / SR), r = Math.exp(-1 / (tau * SR));
    const n = span(o, n0, a, 0, tau, p.len);
    let c = 1, s = 0;
    for (let i = 0; i < a && i < n; i++) { o[n0 + i] += s * amp * (i / a); const nc = (c * cw - s * sw) * r; s = (s * cw + c * sw) * r; c = nc; }
    for (let i = a; i < n; i++) { o[n0 + i] += s * amp; const nc = (c * cw - s * sw) * r; s = (s * cw + c * sw) * r; c = nc; }
  }
}

/** 파편·지글·전기 튐: 밀도가 변하는 희소 임펄스(지수 분포 간격)를 대역 필터로 울린다 */
function crackle(o: Float32Array, p: { t?: number; dur: number; r0: number; r1?: number; v: number; f: number; q?: number }) {
  const n0 = Math.round((p.t ?? 0) * SR); if (n0 >= o.length) return;
  const n = Math.min(o.length - n0, Math.round(p.dur * SR)), r0 = p.r0, r1 = p.r1 ?? r0, k = 1 / (p.q ?? 1);
  const g = Math.tan(Math.PI * Math.min(SR * 0.45, p.f) / SR), a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
  const v = p.v * 3 * k;
  let ic1 = 0, ic2 = 0, next = 0;
  for (let i = 0; i < n; i++) {
    let x = 0;
    if (i >= next) {
      const pr = i / n, fall = 1 - pr;
      if (i > 0) x = nz() * fall * fall * (0.4 + 0.6 * Math.abs(nz()));
      next = i + 1 + Math.floor(-Math.log(1e-6 + 0.5 * (nz() + 1)) * SR / Math.max(1, r0 + (r1 - r0) * pr));
    }
    const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    o[n0 + i] += v1 * v;
  }
}

const peakOf = (o: Float32Array) => { let m = 0; for (let i = 0; i < o.length; i++) { const x = Math.abs(o[i]); if (x > m) m = x; } return m; };
/** 소프트 새추레이션(정점을 1로 맞춘 뒤 drive배로 밀어 부드럽게 눌러 배음·두께를 만든다) */
function sat(o: Float32Array, drive: number) {
  const pk = peakOf(o); if (pk <= 0) return;
  const g = drive / pk;
  for (let i = 0; i < o.length; i++) { const x = Math.max(-3, Math.min(3, o[i] * g)); o[i] = x * (27 + x * x) / (27 + 9 * x * x); }
}

// ───────────── 소리 정의(레시피) ─────────────

type Rec = (o: Float32Array, r: () => number, v: number, ch: number) => void;
/** n 변주 수 · len 길이(초) · st 0 모노 / 1 채널마다 따로 합성(좌우 배치가 있는 소리) / 2 모노 합성 후 올패스로 좌우 비상관(값싼 스테레오 폭) */
interface Def { n: number; len: number; st: number; rec: Rec; ref?: string; grp?: string }
const DEFS: Record<string, Def> = {};
/** x.ref(몸통): 기준 음정 층 — 이 층을 더한 정점으로 정규화한다 · x.grp(음정 층): 몸통 — 그 몸통과 같은 배율로 정규화한다
 *  (원래 한 덩어리였던 소리를 둘로 나눠도 잡음·충격과 종소리의 균형이 그대로다) */
const def = (k: string, n: number, len: number, rec: Rec, st = 0, x: { ref?: string; grp?: string } = {}) => { DEFS[k] = { n, len, st, rec, ...x }; };

// 음정 층: 음정이 있는 부분(종·화음)을 몸통(잡음·충격·서브)과 따로 굽고, 재생할 때 음정 층만 재생 속도로 옮긴다.
// · 화음 따름(tri): 지금 화음의 근음으로 옮기고 3음 성질별 변주(4 장3 · 3 단3 · 5 sus4 · 2 sus2)를 고른다.
// · 조 따름: 곡의 조(스팅어와 같은 조옮김)로만 옮긴다 — 같은 조로 옮겨지는 스팅어와 함께 나는 소리.
// 기준(C 장조·옮김 0)으로 내면 나누기 전 소리와 같다.
const THIRDS = [4, 3, 5, 2];
type TonRec = (o: Float32Array, th: number, r: () => number, ch: number) => void;
function defTonal(k: string, len: number, st: number, tri: boolean, body: Rec, ton: TonRec) {
  def(k, 1, len, body, st, { ref: k + (tri ? '~4' : '~') });
  for (const th of tri ? THIRDS : [4]) def(k + (tri ? '~' + th : '~'), 1, len, (o, r, _v, ch) => ton(o, th, r, ch), st, { grp: k });
}
/** 기준음에서 s반음 위 주파수 */
const semi = (f: number, s: number) => f * Math.pow(2, s / 12);

/** 모노 → 좌우 비상관: 채널마다 다른 짧은 슈뢰더 올패스 두 단(저역은 거의 그대로, 중고역 위상만 흩어 넓게 들린다) */
function decorrelate(src: Float32Array, dst: Float32Array, d1: number, d2: number) {
  const g = 0.5, a = Math.round(d1 * SR), b = Math.round(d2 * SR), n = src.length;
  const t = new Float32Array(n);
  for (let i = 0; i < n; i++) { const xd = i >= a ? src[i - a] : 0, yd = i >= a ? t[i - a] : 0; t[i] = -g * src[i] + xd + g * yd; }
  for (let i = 0; i < n; i++) { const xd = i >= b ? t[i - b] : 0, yd = i >= b ? dst[i - b] : 0; dst[i] = -g * t[i] + xd + g * yd; }
}

// 배음표 [비율, 음량, 감쇠(초)] ×n
const GOLD = [1, 1, 0.42, 2.0, 0.35, 0.26, 3.0, 0.2, 0.15, 4.16, 0.12, 0.08];
const GOLD2 = [1, 1, 0.28, 2.0, 0.35, 0.18, 3.0, 0.2, 0.11, 4.16, 0.12, 0.06];   // 화음용(짧은 꼬리 — 긴 잔향은 리버브 센드가 맡는다)
const GLASS = [1, 1, 0.1, 2.76, 0.3, 0.05, 5.4, 0.12, 0.025];
const TING = [1, 1, 0.16, 1.506, 0.55, 0.11, 2.26, 0.4, 0.07, 3.02, 0.3, 0.05, 4.47, 0.18, 0.03];
const CLIPT = [1, 1, 0.06, 2.32, 0.6, 0.04, 4.25, 0.4, 0.025, 6.63, 0.25, 0.015];
const HAND = [1, 1, 0.55, 2.0, 0.45, 0.35, 3.0, 0.22, 0.2, 4.2, 0.12, 0.1, 5.4, 0.06, 0.06];
const CHURCH = [0.5, 0.55, 1.2, 1, 1, 1.1, 1.19, 0.45, 0.8, 1.5, 0.4, 0.65, 2, 0.5, 0.5, 2.51, 0.25, 0.35, 2.66, 0.2, 0.3, 3.01, 0.18, 0.25, 4.1, 0.1, 0.15];
const COIN = [1, 1, 0.09, 2.0, 0.3, 0.05, 2.76, 0.35, 0.04, 5.4, 0.12, 0.02];
const ALARM = [1, 1, 0.08, 1.47, 0.6, 0.06, 2.09, 0.4, 0.05, 2.9, 0.3, 0.03];

/** FM 종(유리·실로폰 느낌 음) */
const fmBell = (o: Float32Array, t: number, f: number, d: number, v: number, ratio = 3.5, idx = 1.2) => {
  tone(o, { t, f, d, v, a: 0.001, fm: ratio, fi: idx, fd: d * 0.3 });
  tone(o, { t, f: f * 2, d: d * 0.4, v: v * 0.22 });
};

// ── 타격 ──
def('hit', 4, 0.22, (o, r) => {             // 퍽: 딱(고역 잡음) + 퍽(대역 잡음) + 중역 펀치(폰 스피커에서도 들리게) + 저역 쿵 + 바삭한 꼬리
  const k = 0.85 + r() * 0.3;
  noise(o, { d: 0.0018 * k, v: 0.55, m: 2, f: 3000 + r() * 1800 });
  noise(o, { d: 0.014 * k, v: 0.75, m: 1, f: 1400 + r() * 800, q: 1.1 });
  tone(o, { f: 340 + r() * 70, to: 140, gl: 0.02, d: 0.03 * k, v: 0.7, w: 1, a: 0.0008 });
  tone(o, { f: 165 + r() * 30, to: 60, gl: 0.03, d: 0.035 * k, v: 0.55, a: 0.001 });
  noise(o, { t: 0.002, d: 0.025, v: 0.35, f: 2600, to: 500, gl: 0.03 });
  sat(o, 2);
});
def('crit', 2, 0.75, (o, r) => {            // 치명타 금속 강조: 쨍(비조화 금속 배음) + 샥 + 중역 타격
  bell(o, { f: 2300 + r() * 500, pt: TING, v: 0.8 });
  noise(o, { d: 0.05, v: 0.35, m: 2, f: 6500 });
  noise(o, { d: 0.003, v: 0.55, m: 2, f: 2500 });
  tone(o, { f: 900, to: 320, gl: 0.025, d: 0.028, v: 0.45, w: 1 });
  sat(o, 1.3);
});
def('burn', 3, 0.3, (o, r) => {             // 치익(커피 오라·레이저가 지지는 소리)
  noise(o, { a: 0.003, d: 0.06, v: 0.45, m: 2, f: 3800 + r() * 1500 });
  crackle(o, { dur: 0.24, r0: 1600, r1: 250, v: 0.8, f: 4200 + r() * 1500, q: 0.9 });
  noise(o, { a: 0.002, d: 0.025, v: 0.4, m: 1, f: 650, q: 0.9 });
});
def('zap', 3, 0.16, (o, r) => {             // 지직(번개 적중): 잡음 FM 톱니 + 전기 튐
  tone(o, { f: 1300 + r() * 500, nm: 0.8, d: 0.022, v: 0.6, a: 0.0005, w: 2, lp: 5000 });
  crackle(o, { dur: 0.1, r0: 3500, r1: 600, v: 0.9, f: 3600, q: 0.8 });
  noise(o, { d: 0.0025, v: 0.6, m: 2, f: 3000 });
  tone(o, { f: 240, to: 110, gl: 0.02, d: 0.02, v: 0.3, w: 1 });
});
def('soft', 3, 0.2, (o, r) => {            // 둔탁한 광역 타격(폭발·충격파가 이미 크게 울릴 때)
  tone(o, { f: 160 + r() * 40, to: 58, gl: 0.03, d: 0.035, v: 0.9 });
  tone(o, { f: 440 + r() * 80, to: 210, gl: 0.02, d: 0.014, v: 0.3, w: 1 });
  noise(o, { d: 0.02, v: 0.4, f: 1500 });
  sat(o, 1.5);
});
def('kill', 4, 0.3, (o, r) => {             // 뽁: 짧게 올라가는 거품 팝 + 종이 파편 바스락 + 바닥 쿵
  noise(o, { d: 0.0018, v: 0.5, m: 2, f: 2600 });
  tone(o, { f: 300 + r() * 60, to: 640 + r() * 80, gl: 0.01, d: 0.028, v: 0.9, a: 0.0012 });
  tone(o, { f: 1250 + r() * 250, to: 850, gl: 0.02, d: 0.018, v: 0.2 });
  noise(o, { d: 0.03, v: 0.45, m: 1, f: 900 + r() * 300, q: 0.9 });
  crackle(o, { t: 0.008, dur: 0.16, r0: 1000, r1: 120, v: 0.7, f: 3000 + r() * 1200, q: 1.2 });
  tone(o, { f: 150, to: 58, gl: 0.03, d: 0.04, v: 0.55 });
  sat(o, 1.6);
});
def('eliteKill', 1, 1.5, (o) => {           // 엘리트 처치: 중형 폭발 + 금빛 종 세 번
  noise(o, { d: 0.005, v: 0.8, m: 2, f: 1800 });
  noise(o, { a: 0.002, d: 0.13, v: 0.9, f: 4500, to: 280, gl: 0.09 });
  tone(o, { f: 115, to: 36, gl: 0.12, d: 0.22, v: 1.1 });
  tone(o, { f: 320, to: 120, gl: 0.04, d: 0.06, v: 0.5, w: 1 });
  crackle(o, { t: 0.03, dur: 0.6, r0: 500, r1: 40, v: 0.5, f: 2600 });
  sat(o, 1.8);
  bell(o, { t: 0.03, f: 1568, pt: GOLD, v: 0.3 });
  bell(o, { t: 0.1, f: 2349, pt: GOLD, v: 0.26 });
  bell(o, { t: 0.17, f: 3136, pt: GOLD, v: 0.22 });
}, 2);
defTonal('bossKill', 2.1, 2, true, (o) => {  // 보스 격파: 2단 대폭발 + 서브 드롭 + 파편 비 + (음정 층) 지금 화음의 종 화음이 번진다
  noise(o, { d: 0.008, v: 1, m: 2, f: 1100 });
  noise(o, { a: 0.002, d: 0.28, v: 1, f: 7000, to: 170, gl: 0.2 });
  noise(o, { t: 0.02, a: 0.04, d: 0.6, v: 0.5, f: 320 });
  tone(o, { f: 70, to: 24, gl: 0.35, d: 0.6, v: 1.3 });
  tone(o, { f: 240, to: 75, gl: 0.07, d: 0.12, v: 0.6, w: 1 });
  crackle(o, { t: 0.04, dur: 1.6, r0: 700, r1: 15, v: 0.55, f: 2200 });
  tone(o, { t: 0.32, f: 62, to: 28, gl: 0.2, d: 0.35, v: 0.8 });
  noise(o, { t: 0.32, a: 0.002, d: 0.16, v: 0.7, f: 4500, to: 250, gl: 0.12 });
  sat(o, 2.2);
  noise(o, { t: 0.1, a: 0.3, ap: 2, d: 0.3, v: 0.16, m: 2, f: 7500 });
}, (o, th) => {
  [0, th, 7, 12].forEach((s, i) => bell(o, { t: 0.12 + i * 0.07, f: semi(1046.5, s), pt: GOLD2, v: 0.24 }));
});
def('explodeS', 3, 0.75, (o, r) => {        // 소형 폭발(지뢰·토너·적 자폭): 딱 + 퍼엉(저역 통과 스윕) + 쿵 + 파편
  noise(o, { d: 0.004, v: 0.8, m: 2, f: 1500 });
  noise(o, { a: 0.001, d: 0.085, v: 0.9, f: 5000, to: 320, gl: 0.06 });
  tone(o, { f: 140 + r() * 30, to: 44, gl: 0.07, d: 0.12, v: 1 });
  tone(o, { f: 340, to: 140, gl: 0.03, d: 0.045, v: 0.45, w: 1 });
  crackle(o, { t: 0.02, dur: 0.42, r0: 700, r1: 50, v: 0.45, f: 2600 + r() * 800 });
  sat(o, 1.9);
});
def('explodeL', 2, 1.5, (o, r) => {         // 대형 폭발: 크랙 + 넓은 폭풍 + 우르릉 + 서브 드롭 + 긴 파편(위치 팬 + 리버브로 폭)
  noise(o, { d: 0.006, v: 1, m: 2, f: 1200 });
  noise(o, { a: 0.002, d: 0.2, v: 1, f: 6000, to: 220, gl: 0.14 });
  noise(o, { t: 0.01, a: 0.03, d: 0.45, v: 0.5, f: 380 });
  tone(o, { f: 95 + r() * 20, to: 30, gl: 0.16, d: 0.32, v: 1.2 });
  tone(o, { f: 220, to: 80, gl: 0.05, d: 0.09, v: 0.55, w: 1 });
  crackle(o, { t: 0.04, dur: 1.1, r0: 600, r1: 20, v: 0.55, f: 2200 + r() * 600 });
  sat(o, 2);
});
def('hurt', 3, 0.45, (o, r) => {            // 피격: 저역 쿵 + 둔탁한 톱니(끙) + 닫히는 저역 잡음, 굵게 새추레이션
  const f = 170 + r() * 30;
  tone(o, { f: 150 + r() * 20, to: 62, gl: 0.05, d: 0.07, v: 0.85 });
  tone(o, { f, to: f * 0.62, gl: 0.08, d: 0.07, v: 0.5, w: 2, lp: 600, le: 1400 });
  tone(o, { f: f * 1.04, to: f * 0.64, gl: 0.08, d: 0.07, v: 0.5, w: 2, lp: 600, le: 1400 });
  noise(o, { a: 0.001, d: 0.07, v: 0.7, f: 1800, to: 300, gl: 0.05 });
  noise(o, { d: 0.003, v: 0.5, m: 2, f: 2000 });
  sat(o, 2.4);
});
def('enemyShot', 2, 0.18, (o, r) => {       // 적 탄 발사: 낮은 퓻
  tone(o, { f: 780 + r() * 120, to: 340, gl: 0.03, d: 0.035, v: 0.7, w: 3, lp: 1400, le: 1200 });
  noise(o, { d: 0.01, v: 0.3, m: 1, f: 1500 });
});

// ── 줍기 ──
const GEM_F = [783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96];   // 5음계 G5..G7
GEM_F.forEach((f, i) => def('gem' + i, 1, 0.3, o => {    // 반짝: 유리 FM 종 + 배음 + 틱
  fmBell(o, 0, f, 0.065, 0.8, 3.5, 1.1);
  tone(o, { f: f * 4.2, d: 0.012, v: 0.08 });
  noise(o, { d: 0.0015, v: 0.22, m: 2, f: 7000 });
}));
def('coin', 2, 0.65, (o, r) => {            // 챙그랑: 두 음(B6→E7) 금속 FM + 반짝
  const k = 1 + (r() - 0.5) * 0.02;
  tone(o, { f: 1976 * k, a: 0.001, h: 0.03, d: 0.03, v: 0.55, fm: 2, fi: 1.4, fd: 0.02 });
  tone(o, { t: 0.06, f: 2637 * k, a: 0.001, d: 0.13, v: 0.7, fm: 2, fi: 1.1, fd: 0.05 });
  bell(o, { t: 0.06, f: 5274 * k, pt: [1, 1, 0.05, 1.5, 0.5, 0.03], v: 0.12 });
  noise(o, { d: 0.002, v: 0.25, m: 2, f: 6000 });
});
def('item', 1, 1.1, (o) => {                // 아이템: 상승 슈잉 + 종 두 개 + 반짝
  tone(o, { f: 700, to: 1700, gl: 0.05, d: 0.08, v: 0.45, w: 1, lp: 2500, le: 2500 });
  bell(o, { t: 0.05, f: 1760, pt: GOLD2, v: 0.4 });
  bell(o, { t: 0.11, f: 2637, pt: GOLD2, v: 0.36 });
  noise(o, { t: 0.03, a: 0.03, d: 0.12, v: 0.2, m: 2, f: 6500 });
});
defTonal('heal', 1.35, 0, true, (o) => {     // 회복(커피·치킨): 반짝 + (음정 층) 지금 화음으로 따뜻하게 쌓이는 화음
  noise(o, { t: 0.05, a: 0.15, ap: 2, d: 0.2, v: 0.15, m: 2, f: 7000 });
}, (o, th) => {
  [0, th, 7, 12].forEach((s, i) => { tone(o, { t: i * 0.05, f: semi(523.25, s), a: 0.02, d: 0.3, v: 0.4, fm: 1, fi: 0.8, fd: 0.2, vib: 5, vd: 0.004 }); });
  bell(o, { t: 0.2, f: 2093, pt: GOLD, v: 0.25 });
});
def('magnet', 1, 1.25, (o) => {              // 자석(결재 도장 싹쓸이): 떨리며 올라가는 부웅 + 빨아들이는 바람 + 딩
  tone(o, { f: 160, to: 900, gl: 0.25, a: 0.04, h: 0.25, d: 0.15, v: 0.5, w: 2, lp: 500, le: 1500, vib: 14, vd: 0.05 });
  noise(o, { a: 0.25, ap: 2, d: 0.1, v: 0.35, m: 1, f: 500, to: 3500, gl: 0.25, q: 2 });
  bell(o, { t: 0.36, f: 1568, pt: GOLD, v: 0.35 });
});
def('timestop', 1, 1.6, (o) => {            // 시간 정지: 째깍 + 느려지며 내려가는 부우웅 + 얼어붙는 반짝
  bell(o, { f: 2200, pt: CLIPT, v: 0.5 });
  bell(o, { t: 0.22, f: 1650, pt: CLIPT, v: 0.5 });
  tone(o, { t: 0.02, f: 520, to: 70, gl: 0.35, a: 0.01, h: 0.2, d: 0.35, v: 0.5, w: 2, lp: 300, le: 2000 });
  noise(o, { t: 0.05, a: 0.5, ap: 2, d: 0.25, v: 0.14, m: 2, f: 8000 });
});

// ── 알림·UI ──
def('click', 2, 0.1, (o, r) => {            // 부드러운 톡(둥근 거품 소리)
  tone(o, { f: 1150 + r() * 100, to: 880, gl: 0.006, d: 0.016, v: 0.8, a: 0.0008 });
  tone(o, { f: 2350, d: 0.006, v: 0.12 });
  noise(o, { d: 0.002, v: 0.12, m: 1, f: 3000, q: 1 });
});
def('tick', 1, 0.07, (o) => {               // 룰렛 딸깍(음높이는 재생 속도로)
  noise(o, { d: 0.0025, v: 0.5, m: 1, f: 3000, q: 2 });
  tone(o, { f: 1760, d: 0.012, v: 0.6, a: 0.0005 });
  tone(o, { f: 3520, d: 0.005, v: 0.12 });
});
def('buy', 1, 1.15, (o) => {                 // 카-칭: 서랍 탁 + 5도 종 두 개 + 반짝
  noise(o, { d: 0.004, v: 0.6, m: 1, f: 2500, q: 1 });
  tone(o, { f: 180, to: 90, gl: 0.02, d: 0.03, v: 0.5 });
  bell(o, { t: 0.05, f: 1568, pt: [1, 1, 0.3, 2, 0.4, 0.2, 3, 0.25, 0.12, 4.2, 0.12, 0.06], v: 0.5 });
  bell(o, { t: 0.05, f: 2349, pt: [1, 1, 0.35, 2, 0.3, 0.2, 3, 0.2, 0.1], v: 0.45 });
  bell(o, { t: 0.1, f: 4699, pt: [1, 1, 0.08, 1.5, 0.5, 0.05], v: 0.12 });
});
def('toast', 1, 1.0, (o) => {               // 알림: 부드러운 두 음(E6→B5)
  tone(o, { f: 1318.5, a: 0.003, d: 0.12, v: 0.6, fm: 1, fi: 0.8, fd: 0.05 });
  tone(o, { t: 0.09, f: 987.8, a: 0.003, d: 0.2, v: 0.6, fm: 1, fi: 0.6, fd: 0.08 });
});
def('chime', 1, 2.2, (o) => {               // 정각 딩-동(E5→C5, 따뜻한 FM 종)
  for (const [t, f] of [[0, 659.26], [0.42, 523.25]]) {
    tone(o, { t, f, a: 0.002, d: 0.55, v: 0.6, fm: 1, fi: 1.6, fd: 0.2 });
    tone(o, { t, f: f * 2, d: 0.25, v: 0.16 });
    tone(o, { t, f: f * 3.01, d: 0.1, v: 0.08 });
  }
});
defTonal('maxed', 1.0, 0, true, (o) => {     // 최대 레벨: 반짝 + (음정 층) 지금 화음으로 치솟는 종 + 금속 쨍
  noise(o, { a: 0.2, ap: 2, d: 0.2, v: 0.12, m: 2, f: 7500 });
}, (o, th) => {
  [0, th, 7, 12, 12 + th].forEach((s, i) => fmBell(o, i * 0.045, semi(1046.5, s), 0.12, 0.5));
  bell(o, { t: 0.23, f: 3136, pt: TING, v: 0.35 });
});
defTonal('levelup', 1.3, 0, true, (o) => {   // 레벨업: 상승 스윕 + 붐 + 반짝 꼬리 + (음정 층) 지금 화음의 아르페지오 종(레벨업 스팅어와 같은 화음)
  noise(o, { a: 0.25, ap: 2, d: 0.08, v: 0.4, m: 1, f: 500, to: 7000, gl: 0.2, q: 1.2 });
  tone(o, { f: 130, to: 65, gl: 0.05, d: 0.1, v: 0.5 });
  noise(o, { t: 0.2, a: 0.02, d: 0.35, v: 0.14, m: 2, f: 8000 });
}, (o, th) => {
  [0, th, 7, 12].forEach((s, i) => fmBell(o, 0.02 + i * 0.06, semi(1046.5, s), 0.2, 0.55, 2, 0.9));
  bell(o, { t: 0.26, f: 4186, pt: GLASS, v: 0.25 });
});
def('lunch', 1, 2.0, (o) => {               // 점심 종: 손종 두 번(D6→G6)
  bell(o, { f: 1174.7, pt: HAND, v: 0.6 });
  bell(o, { t: 0.17, f: 1568, pt: HAND, v: 0.6 });
  noise(o, { d: 0.003, v: 0.3, m: 1, f: 3000 });
  noise(o, { t: 0.17, d: 0.003, v: 0.3, m: 1, f: 3000 });
});
def('elite', 1, 1.5, (o) => {               // 엘리트 출현: 빨려드는 상승음 → 쿵 + 불협 금속 쨍
  noise(o, { a: 0.28, ap: 3, d: 0.03, v: 0.55, m: 1, f: 700, to: 5000, gl: 0.2, q: 1.5 });
  tone(o, { t: 0.3, f: 120, to: 42, gl: 0.06, d: 0.15, v: 1 });
  noise(o, { t: 0.3, d: 0.05, v: 0.7, f: 3000, to: 400, gl: 0.04 });
  tone(o, { t: 0.3, f: 311, w: 2, a: 0.003, d: 0.3, v: 0.25, lp: 600, le: 1600 });
  tone(o, { t: 0.3, f: 440, w: 2, a: 0.003, d: 0.3, v: 0.2, lp: 600, le: 1600 });
  sat(o, 1.6);
  bell(o, { t: 0.3, f: 1245, pt: [1, 1, 0.4, 1.41, 0.6, 0.3, 2.2, 0.4, 0.2, 3.3, 0.2, 0.1], v: 0.35 });
});
def('boss', 1, 2.2, (o) => {                // 보스 경보 브라아암: 디튠 톱니 옥타브·5도 뭉치(필터 엔벨로프) + 디스토션 + 서브 + 쾅 + 긁는 금속
  for (const [f, v] of [[55, 0.3], [55.35, 0.3], [82.6, 0.25], [110.5, 0.3], [165.2, 0.2], [220.9, 0.16]]) tone(o, { f, w: 2, a: 0.07, h: 0.8, d: 0.35, v, lp: 160, le: 2600, vib: 4.5, vd: 0.003 });
  sat(o, 2.8);
  noise(o, { d: 0.006, v: 0.9, m: 2, f: 1500 });
  bell(o, { f: 690, pt: [1, 1, 0.25, 1.41, 0.7, 0.18, 2.23, 0.5, 0.12, 3.1, 0.3, 0.07], v: 0.4 });
  tone(o, { f: 80, to: 30, gl: 0.2, d: 0.4, v: 0.7 });
  noise(o, { t: 0.05, a: 0.2, d: 0.4, v: 0.3, m: 1, f: 2400, to: 700, gl: 0.6, q: 3 });
});
def('yageun', 1, 2.8, (o) => {              // 야근 확정: 낮은 시계탑 종 두 번(댕… 댕) + 스며드는 저음 드론
  bell(o, { f: 196, pt: CHURCH, v: 0.8 });
  bell(o, { f: 196 * 3.01, pt: [1, 1, 0.3, 1.5, 0.5, 0.2], v: 0.25 });
  bell(o, { t: 0.85, f: 196, pt: CHURCH, v: 0.5 });
  noise(o, { t: 0.85, d: 0.004, v: 0.3, m: 1, f: 1800 });
  tone(o, { f: 49, w: 2, a: 0.5, ap: 2, h: 0.6, d: 0.5, v: 0.3, lp: 150, le: 500 });
  tone(o, { f: 73.4, w: 2, a: 0.6, ap: 2, h: 0.5, d: 0.5, v: 0.2, lp: 150, le: 500 });
  noise(o, { d: 0.004, v: 0.5, m: 1, f: 1800 });
});

// ── 큰 연출 ──
def('ult', 1, 2.2, (o) => {                 // 궁극기: 초대형 충격(크랙 + 폭풍 + 서브 드롭 24Hz까지) + 긴 파편 + 반짝 화음
  noise(o, { d: 0.008, v: 1, m: 2, f: 1000 });
  noise(o, { a: 0.002, d: 0.3, v: 1, f: 7000, to: 180, gl: 0.2 });
  noise(o, { a: 0.05, d: 0.7, v: 0.45, f: 300 });
  tone(o, { f: 78, to: 24, gl: 0.3, d: 0.6, v: 1.3 });
  tone(o, { f: 230, to: 70, gl: 0.08, d: 0.14, v: 0.6, w: 1 });
  crackle(o, { t: 0.03, dur: 1.5, r0: 550, r1: 10, v: 0.5, f: 2000 });
  sat(o, 2.3);
  [1318.5, 1760, 2637].forEach((f, i) => bell(o, { t: 0.06 + i * 0.05, f, pt: GOLD2, v: 0.16 }));
  noise(o, { t: 0.05, a: 0.4, ap: 2, d: 0.35, v: 0.14, m: 2, f: 8000 });
}, 2);
// 궁극기 종류별 강조(ult 위에 겹친다)
def('u:blast', 1, 1.0, (o) => {             // 사직서: 종이 폭풍
  crackle(o, { dur: 0.9, r0: 2500, r1: 200, v: 0.9, f: 3200, q: 0.8 });
  noise(o, { a: 0.05, d: 0.25, v: 0.35, m: 1, f: 2500, to: 700, gl: 0.3, q: 1, am: 22, ad: 0.5 });
});
def('u:vacuum', 1, 1.0, (o) => {            // 커피 브레이크: 빨아들이는 바람 + 내려가는 휘잉
  noise(o, { a: 0.1, d: 0.3, v: 0.6, m: 1, f: 4500, to: 300, gl: 0.3, q: 2 });
  tone(o, { f: 900, to: 140, gl: 0.3, a: 0.05, d: 0.3, v: 0.35, vib: 9, vd: 0.02 });
});
def('u:rain', 1, 1.1, (o, r) => {           // rm -rf: 쏟아지는 디지털 삐삐
  for (let i = 0; i < 16; i++) tone(o, { t: i * 0.055, f: 2600 - i * 110 + r() * 300, w: 3, a: 0.001, h: 0.018, d: 0.008, v: 0.22, lp: 5000 });
});
def('u:freeze', 1, 1.2, (o, r) => {         // 동결: 얼음 결정 종 무리 + 고역 서리
  for (let i = 0; i < 9; i++) bell(o, { t: i * 0.04 + r() * 0.02, f: 2800 + r() * 3200, pt: GLASS, v: 0.28 });
  noise(o, { a: 0.1, d: 0.35, v: 0.3, m: 2, f: 7000 });
});
def('u:shield', 1, 1.7, (o) => {            // 방어막: 차오르는 역장 험(트레몰로)
  for (const f of [220, 330, 440.5]) tone(o, { f, w: 2, a: 0.15, ap: 2, h: 0.5, d: 0.3, v: 0.25, lp: 500, le: 1500, vib: 6, vd: 0.004 });
  noise(o, { a: 0.2, d: 0.3, v: 0.15, m: 1, f: 3000, q: 3, am: 12, ad: 0.8 });
});
def('u:clone', 1, 1.2, (o) => {             // 분신: 겹쳐 오르는 두 줄 바람 + 코러스 반짝
  noise(o, { a: 0.12, ap: 2, d: 0.15, v: 0.5, m: 1, f: 600, to: 4500, gl: 0.2, q: 2 });
  noise(o, { t: 0.08, a: 0.12, ap: 2, d: 0.15, v: 0.4, m: 1, f: 900, to: 6000, gl: 0.2, q: 2 });
  fmBell(o, 0.2, 1568, 0.3, 0.3); fmBell(o, 0.22, 1575, 0.3, 0.3);
});
// 진화·대박·칼퇴: 같은 조로 옮겨지는 스팅어(evolve·victory)·상자 연출과 함께 나므로 음정 층을 곡의 조로 옮긴다
defTonal('evolve', 2.0, 0, false, (o) => {   // 진화: 즉시 충격(크랙+서브) + 금속 쨍 + (음정 층) 5음계 글리산도 + 길게 남는 수정 화음
  noise(o, { d: 0.006, v: 0.9, m: 2, f: 1400 });
  tone(o, { f: 90, to: 32, gl: 0.15, d: 0.3, v: 1.1 });
  noise(o, { a: 0.002, d: 0.15, v: 0.6, f: 5000, to: 300, gl: 0.1 });
  sat(o, 1.8);
  bell(o, { f: 2600, pt: TING, v: 0.4 });
  noise(o, { t: 0.3, a: 0.3, ap: 2, d: 0.35, v: 0.12, m: 2, f: 8000 });
}, (o) => {
  [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349, 2637, 3136, 3520].forEach((f, i) => fmBell(o, 0.05 + i * 0.035, f, 0.09, 0.28));
  [1046.5, 1568, 2093, 2637].forEach((f, i) => bell(o, { t: 0.4 + i * 0.03, f, pt: GOLD2, v: 0.2 }));
});
defTonal('jackpot', 1.7, 1, false, (o) => {  // 대박: 붐 + 반짝 + (음정 층) 흩어지는 동전 폭포(좌우로 퍼짐) + 밝은 화음
  tone(o, { f: 120, to: 55, gl: 0.05, d: 0.12, v: 0.7 });
  noise(o, { d: 0.005, v: 0.5, m: 2, f: 2000 });
  noise(o, { t: 0.1, a: 0.3, ap: 2, d: 0.3, v: 0.14, m: 2, f: 7500 });
}, (o, _th, r, ch) => {
  const P = [1568, 1760, 2093, 2349, 2637, 3136, 3520];
  for (let i = 0; i < 16; i++) {
    const t = i * 0.05 + r() * 0.03, f = P[Math.floor(r() * P.length)] * (r() < 0.3 ? 2 : 1), pn = r() * 2 - 1;
    const gch = ch === 0 ? 0.55 - pn * 0.45 : 0.55 + pn * 0.45;
    bell(o, { t, f, pt: COIN, v: 0.35 * gch });
  }
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(o, { t: 0.08 + i * 0.02, f, pt: GOLD2, v: 0.22 }));
});
defTonal('clear', 1.8, 1, false, (o, r, _v, ch) => {   // 칼퇴 성공: 폭죽 두 발(좌·우) + 색종이 바스락 + 휘익 + (음정 층) 밝은 종 화음
  for (const [t, side] of [[0, 0], [0.13, 1]]) {
    const g = side === ch ? 1 : 0.45;
    noise(o, { t, d: 0.004, v: 0.8 * g, m: 2, f: 1800 });
    tone(o, { t, f: 180, to: 70, gl: 0.03, d: 0.05, v: 0.7 * g });
    noise(o, { t, a: 0.001, d: 0.05, v: 0.6 * g, f: 4000, to: 600, gl: 0.04 });
    crackle(o, { t: t + 0.02, dur: 0.8, r0: 1500, r1: 100, v: 0.45 * g, f: 3500 + r() * 1000, q: 1.2 });
  }
  tone(o, { t: 0.15, f: 1000, to: 2200, gl: 0.12, a: 0.02, d: 0.12, v: 0.2, vib: 7, vd: 0.01 });
}, (o) => {
  [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => bell(o, { t: 0.25 + i * 0.05, f, pt: GOLD2, v: 0.22 }));
});
def('death', 1, 2.0, (o) => {               // 퇴사 위기: 쿵 + 전원이 꺼지며 내려가는 톱니(필터 닫힘) + CRT 틱
  tone(o, { f: 60, to: 28, gl: 0.3, d: 0.45, v: 1 });
  noise(o, { a: 0.002, d: 0.22, v: 0.7, f: 2500, to: 150, gl: 0.2 });
  tone(o, { t: 0.05, f: 440, to: 36, gl: 0.45, a: 0.01, h: 0.5, d: 0.35, v: 0.45, w: 2, lp: 150, le: 2600 });
  tone(o, { t: 0.05, f: 444, to: 37, gl: 0.45, a: 0.01, h: 0.5, d: 0.35, v: 0.45, w: 2, lp: 150, le: 2600 });
  sat(o, 1.8);
  noise(o, { t: 1.05, d: 0.004, v: 0.35, m: 2, f: 3000 });
  tone(o, { t: 1.05, f: 7800, d: 0.05, v: 0.05 });
});
defTonal('revive', 2.1, 0, true, (o) => {    // 보험 처리: 흰 충격 + (음정 층) 지금 화음으로 천상의 화음이 차오른다
  noise(o, { d: 0.006, v: 0.8, m: 2, f: 1500 });
  tone(o, { f: 100, to: 40, gl: 0.1, d: 0.25, v: 0.9 });
  sat(o, 1.6);
  noise(o, { t: 0.05, a: 0.5, ap: 2, d: 0.4, v: 0.14, m: 2, f: 7000 });
}, (o, th) => {
  for (const s of [0, th, 7, 12, 12 + th]) tone(o, { t: 0.05, f: semi(261.6, s), w: 2, a: 0.35, ap: 2, h: 0.4, d: 0.4, v: 0.14, lp: 300, le: 1500, vib: 5, vd: 0.004 });
  bell(o, { t: 0.55, f: 2093, pt: GOLD, v: 0.3 });
});

// ── 무기 발사(자주 나므로 짧고 작게, 타격음 아래에 깔리게) ──
def('w:pen', 3, 0.16, (o, r) => {           // 볼펜 휙
  noise(o, { a: 0.003, d: 0.026, v: 0.8, m: 1, f: 1500 + r() * 400, to: 5200, gl: 0.03, q: 2.2 });
  noise(o, { d: 0.0015, v: 0.4, m: 2, f: 4000 });
  tone(o, { f: 2800, to: 4200, gl: 0.03, d: 0.02, v: 0.06 });
});
def('w:fountain_storm', 3, 0.18, (o, r) => {   // 만년필 폭풍: 더 굵은 휙 + 잉크 톡 + 반짝
  noise(o, { a: 0.004, d: 0.036, v: 0.8, m: 1, f: 900 + r() * 300, to: 4800, gl: 0.04, q: 1.6 });
  tone(o, { t: 0.004, f: 1500, to: 700, gl: 0.015, d: 0.02, v: 0.35 });
  noise(o, { t: 0.01, d: 0.045, v: 0.22, m: 2, f: 7000 });
});
def('w:cards', 2, 0.45, (o) => {            // 명함 탁 + 파라락
  noise(o, { d: 0.004, v: 0.8, m: 2, f: 3000 });
  noise(o, { t: 0.005, a: 0.02, d: 0.09, v: 0.55, m: 1, f: 2400, q: 1.5, am: 38, ad: 0.8 });
  tone(o, { f: 600, to: 1200, gl: 0.1, d: 0.08, v: 0.1, w: 1 });
});
def('w:vip_cards', 2, 1.0, (o) => {        // VIP 명함: 파라락 + 금빛 쨍
  noise(o, { d: 0.004, v: 0.8, m: 2, f: 3000 });
  noise(o, { t: 0.005, a: 0.02, d: 0.1, v: 0.55, m: 1, f: 2800, q: 1.5, am: 42, ad: 0.8 });
  bell(o, { t: 0.01, f: 3520, pt: GOLD, v: 0.3 });
});
def('w:folder', 2, 0.45, (o, r) => {        // 서류철 붕붕(도플러처럼 올라가는 바람)
  noise(o, { a: 0.1, ap: 2, d: 0.07, v: 0.8, m: 1, f: 300 + r() * 80, to: 1500, gl: 0.12, q: 1.4 });
  noise(o, { a: 0.1, ap: 2, d: 0.06, v: 0.25, f: 500 });
  tone(o, { a: 0.05, f: 95, to: 130, gl: 0.1, d: 0.06, v: 0.25 });
});
def('w:approval_storm', 2, 0.55, (o, r) => {   // 무한 결재: 쾅(결재 도장) + 굵은 부메랑 바람
  tone(o, { f: 170, to: 55, gl: 0.03, d: 0.05, v: 0.9 });
  noise(o, { d: 0.02, v: 0.6, f: 2000 });
  noise(o, { d: 0.002, v: 0.6, m: 2, f: 2500 });
  noise(o, { t: 0.03, a: 0.12, ap: 2, d: 0.08, v: 0.7, m: 1, f: 250 + r() * 60, to: 1300, gl: 0.14, q: 1.3 });
  sat(o, 1.4);
});
def('w:clip', 3, 0.22, (o, r) => {          // 클립 샷건: 착 + 챙(금속) + 반동
  noise(o, { d: 0.006, v: 0.7, m: 1, f: 3200, q: 1.2 });
  bell(o, { f: 2100 + r() * 300, pt: CLIPT, v: 0.55 });
  tone(o, { f: 240, to: 110, gl: 0.02, d: 0.02, v: 0.35 });
});
def('w:clip_gatling', 3, 0.15, (o, r) => {  // 클립 개틀링: 짧고 밝은 틱
  noise(o, { d: 0.004, v: 0.6, m: 1, f: 4000, q: 1.2 });
  bell(o, { f: 2700 + r() * 400, pt: [1, 1, 0.035, 2.32, 0.5, 0.025, 4.25, 0.3, 0.015], v: 0.5 });
  tone(o, { f: 300, to: 140, gl: 0.015, d: 0.012, v: 0.3 });
});
def('w:ctrlz', 3, 0.26, (o, r) => {         // 단축키 번개: 잡음 FM 지지직 + 전기 튐 + 험
  tone(o, { f: 1100 + r() * 300, nm: 0.9, d: 0.05, v: 0.55, w: 2, lp: 5500 });
  crackle(o, { dur: 0.16, r0: 2500, r1: 300, v: 1, f: 3800, q: 0.8 });
  tone(o, { f: 120, w: 2, d: 0.06, v: 0.2, lp: 900 });
  noise(o, { d: 0.003, v: 0.6, m: 2, f: 3000 });
});
def('w:ctrl_alt_del', 2, 0.45, (o, r) => {  // Ctrl+Alt+Del: 더 굵고 긴 방전 + 서브 쿵
  tone(o, { f: 700 + r() * 200, nm: 1.2, d: 0.1, v: 0.55, w: 2, lp: 4500 });
  crackle(o, { dur: 0.35, r0: 3000, r1: 200, v: 1, f: 3200, q: 0.7 });
  tone(o, { f: 110, to: 40, gl: 0.05, d: 0.09, v: 0.7 });
  noise(o, { d: 0.004, v: 0.7, m: 2, f: 2500 });
  sat(o, 1.5);
});
def('w:laser', 1, 0.85, (o) => {            // 레이저 포인터: 켜짐 칙 + 충전 스윕 + 디튠 톱니 웅(0.8초 지속)
  const H = 0.62;
  tone(o, { f: 220, w: 2, a: 0.03, h: H, d: 0.05, v: 0.3, lp: 1100, vib: 5.5, vd: 0.004 });
  tone(o, { f: 221.7, w: 2, a: 0.03, h: H, d: 0.05, v: 0.3, lp: 1100 });
  tone(o, { f: 880, a: 0.02, h: H, d: 0.05, v: 0.1, vib: 7, vd: 0.006 });
  tone(o, { f: 3520, a: 0.05, h: H - 0.05, d: 0.05, v: 0.025 });
  noise(o, { d: 0.01, v: 0.45, m: 2, f: 5000 });
  tone(o, { f: 300, to: 1600, gl: 0.04, d: 0.04, v: 0.22 });
});
def('w:presentation_beam', 1, 2.3, (o) => {   // 프레젠테이션 빔: 파워업 스윕 + 5도 저음 웅 + 반짝이는 윗소리(2.2초)
  const H = 1.9;
  tone(o, { f: 110, w: 2, a: 0.05, h: H, d: 0.08, v: 0.3, lp: 700, vib: 4, vd: 0.004 });
  tone(o, { f: 110.8, w: 2, a: 0.05, h: H, d: 0.08, v: 0.3, lp: 700 });
  tone(o, { f: 165, w: 2, a: 0.08, h: H, d: 0.08, v: 0.2, lp: 900 });
  tone(o, { f: 660, a: 0.1, h: H, d: 0.08, v: 0.08, vib: 6, vd: 0.006 });
  noise(o, { d: 0.012, v: 0.5, m: 2, f: 4000 });
  tone(o, { f: 200, to: 1800, gl: 0.08, d: 0.08, v: 0.25, w: 1 });
});
def('w:toner', 2, 0.25, (o, r) => {         // 토너 퉁(박격포처럼 쏘아 올림)
  tone(o, { f: 190 + r() * 20, to: 85, gl: 0.03, d: 0.05, v: 1 });
  noise(o, { d: 0.03, v: 0.45, f: 900 });
  noise(o, { t: 0.005, d: 0.05, v: 0.3, m: 1, f: 420, q: 3 });
  noise(o, { d: 0.002, v: 0.45, m: 2, f: 2500 });
  sat(o, 1.5);
});
def('w:ink_flood', 2, 0.32, (o, r) => {     // 잉크 대홍수: 굵은 퉁 + 액체 보글보글
  tone(o, { f: 170 + r() * 20, to: 70, gl: 0.03, d: 0.06, v: 1 });
  noise(o, { d: 0.035, v: 0.45, f: 800 });
  tone(o, { t: 0.03, f: 280, to: 760, gl: 0.03, d: 0.04, v: 0.45 });
  tone(o, { t: 0.08, f: 340, to: 900, gl: 0.025, d: 0.035, v: 0.35 });
  sat(o, 1.5);
});
def('w:plane', 3, 0.32, (o, r) => {         // 종이비행기 슉(내려가는 바람 + 종이 펄럭)
  noise(o, { a: 0.012, d: 0.07, v: 0.7, m: 1, f: 2800 + r() * 500, to: 900, gl: 0.07, q: 1.8, am: 32, ad: 0.45 });
  noise(o, { d: 0.002, v: 0.3, m: 2, f: 3500 });
});
def('w:crane_squadron', 2, 0.32, (o, r) => {   // 종이학 편대: 겹친 슉 두 줄 + 날갯짓
  noise(o, { a: 0.012, d: 0.07, v: 0.6, m: 1, f: 3000 + r() * 400, to: 900, gl: 0.07, q: 1.8, am: 30, ad: 0.4 });
  noise(o, { t: 0.035, a: 0.012, d: 0.07, v: 0.5, m: 1, f: 2500 + r() * 400, to: 800, gl: 0.07, q: 1.8, am: 34, ad: 0.4 });
  noise(o, { a: 0.03, d: 0.1, v: 0.35, m: 1, f: 700, q: 1.5, am: 16, ad: 0.9 });
});
def('w:keyboard', 2, 0.55, (o) => {         // 엔터키: 딸깍(눌림·올라옴 두 클릭 + 플라스틱 공진) + 충격파
  noise(o, { d: 0.0012, v: 0.9, m: 2, f: 2500 });
  noise(o, { d: 0.006, v: 0.55, m: 1, f: 3800, q: 5 });
  noise(o, { t: 0.035, d: 0.001, v: 0.5, m: 2, f: 2500 });
  noise(o, { t: 0.035, d: 0.005, v: 0.4, m: 1, f: 3100, q: 5 });
  tone(o, { t: 0.01, f: 150, to: 50, gl: 0.06, d: 0.1, v: 0.9 });
  noise(o, { t: 0.01, a: 0.004, d: 0.12, v: 0.55, f: 2600, to: 200, gl: 0.08 });
  sat(o, 1.5);
});
def('w:mech_keyboard', 2, 0.7, (o) => {     // 청축 기계식: 찰칵(스프링 핑) + 더 큰 충격파 + 서브
  noise(o, { d: 0.0015, v: 1, m: 2, f: 3000 });
  bell(o, { f: 4800, pt: [1, 1, 0.02, 1.6, 0.4, 0.012], v: 0.4 });
  noise(o, { t: 0.03, d: 0.0012, v: 0.7, m: 2, f: 3000 });
  bell(o, { t: 0.03, f: 4300, pt: [1, 1, 0.015], v: 0.3 });
  tone(o, { t: 0.01, f: 130, to: 38, gl: 0.08, d: 0.14, v: 1 });
  noise(o, { t: 0.01, a: 0.004, d: 0.16, v: 0.65, f: 3500, to: 180, gl: 0.1 });
  sat(o, 1.7);
});
def('w:drone', 3, 0.14, (o, r) => {          // 드론 퓽(짧은 레이저)
  tone(o, { f: 1900 + r() * 300, to: 520, gl: 0.028, d: 0.03, v: 0.5 });
  tone(o, { f: 3800, to: 1100, gl: 0.02, d: 0.012, v: 0.12 });
  noise(o, { d: 0.0015, v: 0.25, m: 2, f: 5000 });
});
def('w:drone_beep', 2, 0.1, (o, r) => {     // 드론 삐빅(가끔)
  const f = 2000 + r() * 200;
  tone(o, { f, a: 0.001, h: 0.016, d: 0.004, v: 0.35, w: 3, lp: 4500 });
  tone(o, { t: 0.03, f: f * 1.3, a: 0.001, h: 0.014, d: 0.004, v: 0.3, w: 3, lp: 4500 });
});
def('w:drone_squad', 3, 0.14, (o, r) => {    // 감시 드론 편대: 더 날카로운 퓽 + 전자 떨림
  tone(o, { f: 2300 + r() * 300, to: 600, gl: 0.025, d: 0.028, v: 0.5, w: 3, lp: 6000 });
  tone(o, { f: 1150, to: 300, gl: 0.025, d: 0.02, v: 0.2 });
  noise(o, { d: 0.0015, v: 0.25, m: 2, f: 5000 });
});
def('w:card', 2, 0.6, (o) => {              // 법인카드: 슥(긁기) + 칭
  noise(o, { a: 0.004, d: 0.018, v: 0.55, m: 1, f: 4200, q: 1.5 });
  bell(o, { t: 0.012, f: 2637, pt: [1, 1, 0.16, 2.0, 0.5, 0.11, 2.76, 0.4, 0.07, 5.4, 0.2, 0.035], v: 0.6 });
  bell(o, { t: 0.012, f: 3951, pt: [1, 1, 0.09], v: 0.18 });
});
def('w:black_card', 2, 0.9, (o) => {        // 블랙카드: 묵직한 툼 + 낮고 고급스러운 칭
  noise(o, { a: 0.004, d: 0.02, v: 0.5, m: 1, f: 3800, q: 1.5 });
  tone(o, { f: 120, to: 60, gl: 0.04, d: 0.08, v: 0.7 });
  bell(o, { t: 0.012, f: 1976, pt: [1, 1, 0.3, 2.0, 0.5, 0.2, 2.76, 0.4, 0.12, 5.4, 0.2, 0.06], v: 0.6 });
  bell(o, { t: 0.02, f: 2960, pt: [1, 1, 0.2], v: 0.2 });
});
def('w:postit', 3, 0.1, (o, r) => {         // 포스트잇 톡
  tone(o, { f: 950 + r() * 100, to: 480, gl: 0.01, d: 0.018, v: 0.8, a: 0.0008 });
  noise(o, { d: 0.004, v: 0.35, m: 1, f: 2200, q: 1 });
  noise(o, { t: 0.003, d: 0.02, v: 0.15, m: 2, f: 4500 });
});
def('w:postit_field', 2, 0.16, (o, r) => {  // 포스트잇 지뢰밭: 톡톡
  for (const t of [0, 0.045]) {
    tone(o, { t, f: 860 + r() * 100, to: 430, gl: 0.01, d: 0.02, v: 0.7, a: 0.0008 });
    noise(o, { t, d: 0.004, v: 0.3, m: 1, f: 2200, q: 1 });
  }
  noise(o, { t: 0.01, d: 0.04, v: 0.15, m: 2, f: 4500 });
});
def('w:alarm', 1, 0.75, (o, r) => {         // 퇴근 알람 따르릉(망치가 빠르게 종을 두드림)
  for (let k = 0; k < 10; k++) {
    const t = k / 26;
    bell(o, { t, f: 1480, pt: ALARM, v: 0.45 * (0.8 + 0.2 * r()) * (k < 8 ? 1 : 0.6) });
    noise(o, { t, d: 0.0015, v: 0.2, m: 2, f: 4000 });
  }
});
def('w:clockout_bell', 1, 2.8, (o) => {     // 6시 정각 종소리: 큰 종 댕~
  bell(o, { f: 392, pt: CHURCH, v: 0.8 });
  noise(o, { d: 0.004, v: 0.5, m: 1, f: 2500, q: 1 });
  tone(o, { f: 90, to: 60, gl: 0.05, d: 0.1, v: 0.3 });
});

// 무기 id → [소리, 음량, 스로틀(초), 음높이 흔들림(반음), 리버브 센드(-1 없음 — 잦은 소리라 합성곱 리버브를 깨우지 않는다)]
const WPN: Record<string, [string, number, number, number, number]> = {
  pen: ['w:pen', 0.2, 0.07, 1.2, -1], fountain_storm: ['w:fountain_storm', 0.21, 0.075, 1, -1],
  cards: ['w:cards', 0.22, 0.2, 1, -1], vip_cards: ['w:vip_cards', 0.22, 0.2, 1, -1],
  folder: ['w:folder', 0.21, 0.12, 1, -1], approval_storm: ['w:approval_storm', 0.21, 0.1, 1, -1],
  clip: ['w:clip', 0.2, 0.09, 1, -1], clip_gatling: ['w:clip_gatling', 0.18, 0.07, 1.5, -1],
  ctrlz: ['w:ctrlz', 0.22, 0.1, 1, -1], ctrl_alt_del: ['w:ctrl_alt_del', 0.21, 0.1, 1, -1],
  laser: ['w:laser', 0.14, 0.3, 0.3, -1], presentation_beam: ['w:presentation_beam', 0.13, 0.5, 0.3, -1],
  toner: ['w:toner', 0.21, 0.1, 1, -1], ink_flood: ['w:ink_flood', 0.21, 0.1, 1, -1],
  plane: ['w:plane', 0.17, 0.08, 1.2, -1], crane_squadron: ['w:crane_squadron', 0.17, 0.08, 1, -1],
  keyboard: ['w:keyboard', 0.24, 0.12, 0.8, -1], mech_keyboard: ['w:mech_keyboard', 0.24, 0.12, 0.8, -1],
  drone: ['w:drone', 0.2, 0.09, 1.5, -1], drone_squad: ['w:drone_squad', 0.18, 0.09, 1.5, -1],
  card: ['w:card', 0.18, 0.1, 1, -1], black_card: ['w:black_card', 0.2, 0.1, 1, -1],
  postit: ['w:postit', 0.2, 0.08, 1.5, -1], postit_field: ['w:postit_field', 0.2, 0.08, 1.5, -1],
  alarm: ['w:alarm', 0.17, 0.2, 0.5, -1], clockout_bell: ['w:clockout_bell', 0.2, 0.3, 0.7, 1],
};
const ULT_KINDS = ['blast', 'vacuum', 'rain', 'freeze', 'shield', 'clone'];

/** 실시간이면 켜진 직후 유휴 시간에 미리 구울 소리(자주·먼저 쓰이는 순). 무기 소리와 궁극기 종류별 강조는 처음 쓸 때 굽는다(짧고 가볍다).
 *  음정 층은 몸통 뒤에 장3·단3 변주까지(sus 변주는 처음 쓸 때 — 종 몇 개라 가볍다) */
const WARM_ORDER = ['click', 'tick', 'hit', 'kill', 'gem0', 'gem1', 'gem2', 'gem3', 'gem4', 'gem5', 'gem6', 'gem7', 'gem8', 'gem9', 'gem10',
  'coin', 'crit', 'burn', 'zap', 'soft', 'hurt', 'explodeS', 'buy', 'enemyShot', 'item', 'toast', 'levelup', 'levelup~4', 'levelup~3', 'explodeL', 'chime',
  'maxed', 'maxed~4', 'maxed~3', 'heal', 'heal~4', 'heal~3', 'magnet', 'timestop', 'elite', 'eliteKill', 'lunch', 'boss', 'ult',
  'bossKill', 'bossKill~4', 'bossKill~3', 'evolve', 'evolve~', 'jackpot', 'jackpot~', 'clear', 'clear~', 'death', 'revive', 'revive~4', 'revive~3', 'yageun'];

// 우선순위(높을수록 먼저 살림)와 종류(동시 발음 수 제한)
const P_LOW = 0, P_MID = 1, P_HIGH = 2, P_TOP = 3;
const CAP = [10, 16, 22, 26];                       // 우선순위별: 현재 발음 수가 이보다 적어야 새로 낸다
const C_SHOOT = 0, C_HIT = 1, C_GEM = 2, C_KILL = 3, C_COIN = 4, C_BOOM = 5, C_UI = 6, C_BIG = 7;
const CAT_CAP = [4, 5, 4, 4, 3, 4, 6, 8];
/** 컨텍스트가 켜진 직후 ~0.2초는 마스터 컴프레서의 이득이 아직 올라오는 중이라 첫 소리가 눌린다 → 이 시각 이후로 미룬다
 *  (오프라인 점검도 실제 게임과 같은 음량으로 재게 된다) */
const SETTLE_T = 0.25;

/** harmony: 지금 들리는 화음·곡의 조(음악 엔진이 알려 준다). 없거나 null이면 기준(C 장조) 그대로 낸다 */
export function createSfx(core: AudioCore, harmony: () => Harmony | null = () => null): SfxAPI {
  const ctx = core.ctx;
  const bank = new Map<string, AudioBuffer[]>();
  const last = new Map<string, number>();

  // ── 공유 버스: 팬(큰 소리 9단 / 잦은 소리 5단) → out → core.sfx, 리버브 센드 3단, 딜레이 센드 ──
  // 잦은 소리(타격·처치·보석·발사·코인)는 전투 밀도에 따라 차단 주파수가 오르는 공유 고역 통과를 거친다
  // (난장판에서 수십 개의 '쿵'이 저역을 뭉개지 않게 — 폭발·보스 같은 큰 소리는 우회해 무게를 지킨다)
  const out = ctx.createGain(); out.connect(core.sfx);
  const busyHp = ctx.createBiquadFilter(); busyHp.type = 'highpass'; busyHp.frequency.value = 30; busyHp.Q.value = 0.6; busyHp.connect(out);
  const hasPan = typeof (ctx as BaseAudioContext & { createStereoPanner?: unknown }).createStereoPanner === 'function';
  const mkPans = (n: number, dst: AudioNode) => Array.from({ length: n }, (_, i) => {
    if (!hasPan) return dst;
    const p = ctx.createStereoPanner(); p.pan.value = -0.7 + (1.4 * i) / (n - 1); p.connect(dst); return p as AudioNode;
  });
  const panBus = mkPans(9, out), panBusy = mkPans(5, busyHp);
  // 리버브·딜레이 센드는 코어 버스를 공유해 core.sfx(볼륨)를 거치지 않는다 → wet 단이 효과음 볼륨을 따라가게 한다
  // (기본 볼륨 0.8에서 1 = 설계한 믹스 그대로. 볼륨을 줄였을 때 잔향·에코만 남아 뿌옇게 들리지 않게)
  const VOL0 = 0.8;
  const wetR = ctx.createGain(), wetD = ctx.createGain();
  let wetV = core.sfx.gain.value / VOL0;
  wetR.gain.value = wetV; wetD.gain.value = wetV;
  wetR.connect(core.reverb); wetD.connect(core.delay);
  const sends = [0.07, 0.17, 0.34].map(v => { const g = ctx.createGain(); g.gain.value = v; g.connect(wetR); return g; });
  const dly = ctx.createGain(); dly.gain.value = 0.2; dly.connect(wetD);
  /** 효과음 볼륨(설정 슬라이더)이 바뀌었으면 wet 단을 맞춘다(소리를 낼 때마다 확인 — 값싼 비교 한 번) */
  const syncWet = (now: number) => {
    const v = core.sfx.gain.value / VOL0;
    if (Math.abs(v - wetV) < 0.002) return;
    wetV = v;
    wetR.gain.setTargetAtTime(v, now, 0.015); wetD.gain.setTargetAtTime(v, now, 0.015);
  };

  // ── 합성(변주 하나씩 굽는다: 미리 굽기가 한 번에 오래 막지 않게) ──
  const arrOf = (key: string) => { let a = bank.get(key); if (!a) { a = []; bank.set(key, a); } return a; };
  /** 레시피 → 채널 배열(정규화 전). 유한값 확인(NaN·무한대는 0 — 마스터 컴프레서 오염 방지) + 직류 제거(25Hz 1차 고역) → (비상관 스테레오) */
  const raw = (key: string, v: number): Float32Array[] => {
    const d = DEFS[key];
    SR = ctx.sampleRate;
    const len = Math.ceil(d.len * SR), hk = hashStr(key);
    const chs: Float32Array[] = [];
    for (let ch = 0; ch < (d.st === 1 ? 2 : 1); ch++) {
      const o = new Float32Array(len);
      nzS = ((hk ^ Math.imul(v + 1, 0x9E3779B1) ^ Math.imul(ch + 1, 0x85EBCA77)) | 0) || 1;
      d.rec(o, prng(hk + v * 7919), v, ch);
      chs.push(o);
    }
    const R = 1 - TAU * 25 / SR;
    for (const o of chs) { let x1 = 0, y1 = 0; for (let i = 0; i < len; i++) { const x = o[i] - o[i] === 0 ? o[i] : 0; const y = x - x1 + R * y1; x1 = x; y1 = y; o[i] = y; } }
    if (d.st === 2) { const m = chs[0], l = new Float32Array(len), r = new Float32Array(len); decorrelate(m, l, 0.0019, 0.0043); decorrelate(m, r, 0.0029, 0.0033); chs[0] = l; chs.push(r); }
    return chs;
  };
  const ngain = new Map<string, number>();     // 몸통 key → 정규화 배율(그 음정 층들이 같은 배율을 쓴다)
  const synthOne = (key: string, arr: AudioBuffer[]) => {
    const d = DEFS[key], v = arr.length;
    const chs = raw(key, v), len = chs[0].length;
    // 두 채널 함께 정점 1로 정규화. 몸통은 기준 음정 층을 더한 정점(나누기 전 한 덩어리 소리) 기준, 음정 층은 그 몸통의 배율 그대로
    // → -56dB 아래로 떨어진 꼬리는 잘라 내고 끝을 코사인 페이드(잘린 느낌·딸깍 없이)
    let g: number;
    if (d.grp) {
      if (!ngain.has(d.grp)) synthOne(d.grp, arrOf(d.grp));
      g = ngain.get(d.grp) ?? 1;
    } else {
      let pk = 0;
      if (d.ref) {
        const rf = raw(d.ref, 0);
        chs.forEach((o, c) => { const q = rf[Math.min(c, rf.length - 1)]; for (let i = 0; i < len; i++) { const x = Math.abs(o[i] + q[i]); if (x > pk) pk = x; } });
      } else for (const o of chs) pk = Math.max(pk, peakOf(o));
      g = pk > 0 ? 1 / pk : 0;
      if (d.ref) ngain.set(key, g);
    }
    let end = 0;
    for (const o of chs) for (let i = 0; i < len; i++) { o[i] *= g; if (o[i] > 0.0016 || o[i] < -0.0016) end = i; }
    end = Math.min(len, end + 1 + Math.round(0.004 * SR));
    const fl = Math.min(Math.round(0.3 * SR), Math.round(end * 0.12));
    const b = ctx.createBuffer(chs.length, Math.max(1, end), SR);
    chs.forEach((o, ch) => {
      for (let i = 0; i < fl; i++) o[end - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fl);
      b.getChannelData(ch).set(o.subarray(0, Math.max(1, end)));
    });
    arr.push(b);
  };
  const live = !('startRendering' in ctx);
  const heavy = (key: string) => DEFS[key].len * (DEFS[key].st ? 2 : 1) > 0.9;
  const ready = (key: string) => (bank.get(key)?.length ?? 0) > 0;
  const pend: string[] = [];                    // 실시간: 먼저 구울 소리(쓰였는데 변주가 덜 구워진 것)
  /** 변주를 하나 고른다. 없으면 지금 하나만 굽고, 나머지 변주는 실시간이면 대기열로(프레임을 오래 막지 않게) */
  const buf = (key: string) => {
    let arr = bank.get(key);
    if (!arr) { arr = []; bank.set(key, arr); }
    if (!arr.length || (!live && arr.length < DEFS[key].n)) synthOne(key, arr);
    if (live && arr.length < DEFS[key].n && !pend.includes(key)) { pend.push(key); kick(); }
    return arr[Math.floor(Math.random() * arr.length)];
  };

  // 실시간: 켜진 직후부터 자주 쓰는 소리부터 조금씩 미리 굽는다. 한 번에 변주 하나, 걸린 시간의 3배만큼 쉬고,
  // 무거운 소리(1초 분량 이상)는 전투 중(최근 0.4초 안에 시뮬레이션 이벤트)엔 미뤘다가 조용할 때(메뉴·모달) 굽는다.
  let simT = -1e9, wi = 0, busy = false;
  const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const done = (k: string) => (bank.get(k)?.length ?? 0) >= DEFS[k].n;
  /** 다음 굽기 일감: 대기열 먼저, 그다음 미리 굽기 목록. 전투 중이면 가벼운 것만('' = 없음, '-' = 무거운 것만 남아 기다림) */
  const nextJob = (fight: boolean) => {
    let wait = false;
    for (let i = 0; i < pend.length; i++) {
      const k = pend[i];
      if (done(k)) { pend.splice(i--, 1); continue; }
      if (fight && heavy(k)) { wait = true; continue; }
      return k;
    }
    while (wi < WARM_ORDER.length && done(WARM_ORDER[wi])) wi++;
    for (let i = wi; i < WARM_ORDER.length; i++) {
      const k = WARM_ORDER[i];
      if (done(k)) continue;
      if (fight && heavy(k)) { wait = true; continue; }
      return k;
    }
    return wait ? '-' : '';
  };
  const step = () => {
    busy = false;
    const key = nextJob(clock() - simT < 400);
    if (!key) return;
    busy = true;
    if (key === '-') { setTimeout(step, 250); return; }
    let arr = bank.get(key);
    if (!arr) { arr = []; bank.set(key, arr); }
    const t0 = clock();
    synthOne(key, arr);
    setTimeout(step, Math.max(20, (clock() - t0) * 3));
  };
  function kick() { if (live && !busy && typeof setTimeout === 'function') { busy = true; setTimeout(step, 150); } }
  kick();
  /** 곧 쓸 소리를 미리 굽기 대기열 앞에 넣는다(예: 이번 판 캐릭터의 궁극기 강조음) */
  const want = (key: string) => { if (live && !done(key) && !pend.includes(key)) { pend.unshift(key); kick(); } };
  /** 전투 중 아직 안 구워진 무거운 폭발류는 이번 한 번만 가벼운 소리로 대신하고 뒤에서 굽는다(첫 등장에 프레임이 멈추지 않게) */
  const FALLBACK: Record<string, string> = { explodeL: 'explodeS', eliteKill: 'explodeS', bossKill: 'explodeS' };
  const choose = (key: string) => {
    const fb = FALLBACK[key];
    if (!live || !fb || ready(key) || !ready(fb) || clock() - simT > 400) return key;
    if (!pend.includes(key)) { pend.unshift(key); kick(); }
    return fb;
  };

  // ── 발음 관리 ──
  interface Voice { end: number; p: number; c: number; t0: number; g: GainNode; s: AudioBufferSourceNode }
  const voices: Voice[] = [];
  const catN = new Int16Array(8);
  const dens = new Float64Array(8), densT = new Float64Array(8);
  let hpT = -1;
  const census = (now: number) => {
    catN.fill(0);
    let j = 0;
    for (let i = 0; i < voices.length; i++) { const x = voices[i]; if (x.end > now) { voices[j++] = x; catN[x.c]++; } }
    voices.length = j;
  };
  const throttle = (key: string, sec: number) => {
    const now = core.now();
    if (now - (last.get(key) ?? -99) < sec) return false;
    last.set(key, now);
    return true;
  };
  /** 잦은 소리의 밀도 보정: 최근 0.4초에 많이 났을수록 작게(난장판에서도 한 방 한 방이 뭉개지지 않게) */
  const density = (c: number, now: number, k: number) => {
    dens[c] = dens[c] * Math.exp(-Math.max(0, now - densT[c]) / 0.4) + 1; densT[c] = now;
    return 1 / Math.sqrt(1 + dens[c] * k);
  };
  const densNow = (c: number, now: number) => dens[c] * Math.exp(-Math.max(0, now - densT[c]) / 0.4);
  const semis = (j: number) => Math.pow(2, ((Math.random() * 2 - 1) * j) / 12);

  interface Em { rate?: number; pan?: number; send?: number; dl?: boolean; p?: number; c?: number }
  function emit(key: string, gain: number, e: Em = {}): boolean {
    const now = ctx.currentTime, p = e.p ?? P_MID, c = e.c ?? C_UI;
    census(now);
    if (catN[c] >= CAT_CAP[c] && p < P_TOP) return false;
    if (voices.length >= CAP[p]) {
      if (p < P_TOP) return false;
      // 최상위 소리: 가장 낮은 순위 중 가장 오래된 발음을 짧게 줄여 끊고 자리를 낸다
      let vi = -1;
      for (let i = 0; i < voices.length; i++) { const x = voices[i]; if (x.p < P_TOP && (vi < 0 || x.p < voices[vi].p || (x.p === voices[vi].p && x.t0 < voices[vi].t0))) vi = i; }
      if (vi >= 0) {
        const x = voices[vi];
        try { x.g.gain.cancelScheduledValues(now); x.g.gain.setTargetAtTime(0, now, 0.012); x.s.stop(now + 0.08); } catch { /* 이미 끝남 */ }
        x.end = now; voices.splice(vi, 1);
      }
    }
    const b = buf(choose(key));
    const rate = e.rate ?? 1, t = Math.max(now, SETTLE_T);
    const s = ctx.createBufferSource(); s.buffer = b;
    if (rate !== 1) s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(g);
    const pan = Math.max(-0.7, Math.min(0.7, e.pan ?? 0));
    if (c <= C_COIN) {
      g.connect(panBusy[Math.round((pan + 0.7) / 0.35)]);
      if (now - hpT > 0.1) { hpT = now; busyHp.frequency.setTargetAtTime(30 + Math.min(150, (densNow(C_HIT, now) + densNow(C_KILL, now) + densNow(C_GEM, now) * 0.5) * 8), now, 0.2); }
    } else g.connect(panBus[Math.round((pan + 0.7) / 0.175)]);
    if ((e.send !== undefined && e.send >= 0) || e.dl) syncWet(now);
    if (e.send !== undefined && e.send >= 0) g.connect(sends[Math.min(2, e.send)]);
    if (e.dl) g.connect(dly);
    s.onended = () => { s.disconnect(); g.disconnect(); };
    s.start(t);
    voices.push({ end: t + b.duration / rate, p, c, t0: t, g, s });
    return true;
  }

  // ── 음정 맞춤 ──
  /** 곡의 조옮김 → 재생 속도 배율(짧은 음정 효과음은 통째로 옮긴다 — 딸깍·탁 같은 잡음은 짧아 티가 나지 않는다) */
  const keyRate = () => { const h = harmony(); return h && h.key ? Math.pow(2, h.key / 12) : 1; };
  /** 몸통 + 음정 층. 음정 층만 지금 화음(tri: 근음으로 옮기고 3음 성질 변주)이나 곡의 조로 옮긴다.
   *  몸통이 대체음으로 났으면(첫 등장·전투 중 아직 안 구워짐) 음정 층은 이번엔 생략 */
  function emitT(key: string, gain: number, e: Em, tri: boolean): boolean {
    if (!emit(key, gain, e)) return false;
    if (!ready(key)) return true;
    const h = harmony();
    let sub = key + '~', sh = 0;
    if (tri) { sub += h ? thirdOf(h) : 4; sh = h ? (((h.root + 6) % 12) + 12) % 12 - 6 : 0; }
    else sh = h ? h.key : 0;
    emit(sub, gain, { ...e, rate: (e.rate ?? 1) * Math.pow(2, sh / 12) });
    return true;
  }

  // 음악 덕킹: 더 센 덕킹이 진행 중이면 약한 요청은 무시(덮어써서 일찍 풀리지 않게).
  // 깊이는 효과음 볼륨을 따라간다(기본 0.8에서 그대로 — 효과음을 줄였는데 궁극기·보스 격파 때 음악만 크게 줄지 않게)
  let duckEnd = 0, duckAmt = 0;
  const duck = (amt0: number, dur: number) => {
    const now = core.now(), amt = amt0 * Math.min(1, core.sfx.gain.value / VOL0);
    if (amt < 0.02) return;
    if (now < duckEnd - dur * 0.5 && amt <= duckAmt) return;
    core.duck(amt, dur); duckEnd = now + dur; duckAmt = amt;
  };

  // ── 상태(콤보·강도 기억) ──
  let gemCombo = 0, gemT = -10, killCombo = 0, killT = -10, dmgAvg = 0, dmgN = 0, lockBig = -1;

  // 타격 계열(HK_*)별 스로틀 시각 — 적 조회 전에 '전부 스로틀 중'이면 바로 건너뛴다(문자열·클로저 할당 없음)
  const hitLast = new Float64Array(4).fill(-99);
  const hitBusy = (now: number) => { for (let k = 0; k < 4; k++) if (now - hitLast[k] >= HIT_THR[k]) return false; return true; };
  function hit(kind: number, rel: number, crit: boolean, pan: number, vol: number) {
    const now = core.now();
    const hv = Math.max(-1, Math.min(1.5, rel));          // 최근 평균 대비 세기(로그) → 셀수록 낮고 크게
    if (crit && throttle('crit', 0.07)) emit('crit', 0.15 * vol * jit(0.15), { rate: semis(1.2), pan, p: P_HIGH, c: C_HIT });
    if (now - hitLast[kind] < HIT_THR[kind]) return;
    hitLast[kind] = now;
    const g = HIT_GAIN[kind] * vol * (1 + 0.22 * hv) * (crit ? 1.15 : 1) * density(C_HIT, now, 0.12) * jit(0.15);
    emit(HIT_KEY[kind], g, { rate: (1 - 0.07 * hv) * (crit ? 0.93 : 1) * semis(0.8), pan, p: P_MID, c: C_HIT });
  }

  function kill(pan: number, vol: number) {
    const now = core.now();
    killCombo = now - killT > 1 ? 0 : killCombo + 1; killT = now;
    if (!throttle('kill', 0.035)) return;
    const st = Math.min(killCombo, 18) * 0.4;             // 연속 처치마다 조금씩 올라가는 음(최대 +7반음)
    const g = 0.3 * vol * (1 + st * 0.02) * density(C_KILL, now, 0.2) * jit(0.15);
    emit('kill', g, { rate: Math.pow(2, st / 12) * semis(0.3), pan, p: P_HIGH, c: C_KILL });
  }

  function gem(vol: number) {
    const now = core.now();
    if (now - gemT > 0.9) gemCombo = 0;
    gemT = now;
    if (!throttle('gem', 0.035)) return;
    gemCombo = Math.min(gemCombo + 1, 40);
    const top = GEM_F.length - 1;
    const i = gemCombo <= top ? gemCombo - 1 : top - 1 + (gemCombo & 1);   // 5음계로 올라가다 꼭대기에서 반짝임 유지
    emit('gem' + i, 0.16 * vol * density(C_GEM, now, 0.08) * (0.9 + Math.random() * 0.2), { rate: semis(0.08) * keyRate(), pan: (Math.random() - 0.5) * 0.3, p: P_MID, c: C_GEM });   // 곡의 조의 5음계로
  }

  function explode(r: number, big: boolean, pan: number, vol: number) {
    const now = core.now();
    if (now < lockBig) return;                             // 궁극기·부활·폭탄 직후: 그 소리에 이미 충격이 들어 있다
    const huge = r >= 150, large = big || r > 70;
    if (!throttle('boom', huge ? 0.02 : large ? 0.05 : 0.07)) return;
    if (large) {
      const rate = huge ? 0.84 : 1.02 - Math.min(0.12, Math.max(0, r - 70) / 700);
      if (emit('explodeL', (huge ? 0.8 : 0.58) * vol * density(C_BOOM, now, 0.15), { rate: rate * semis(0.6), pan, send: huge ? 2 : 1, p: P_TOP, c: C_BOOM })) duck(huge ? 0.35 : 0.15, huge ? 0.6 : 0.25);
    } else {
      emit('explodeS', 0.24 * vol * density(C_BOOM, now, 0.3), { rate: (1.2 - Math.min(0.25, r / 240)) * semis(0.8), pan, p: P_HIGH, c: C_BOOM });
    }
  }

  const shotLast = new Map<string, number>();
  function shoot(id: string, pan: number, vol: number) {
    const s = WPN[id] ?? WPN.pen, now = core.now();
    if (now - (shotLast.get(id) ?? -99) < s[2]) return;     // 무기마다 스로틀
    shotLast.set(id, now);
    let key = s[0];
    if (key === 'w:drone' && Math.random() < 0.25) key = 'w:drone_beep';
    emit(key, s[1] * vol * density(C_SHOOT, now, 0.1) * jit(0.15), { rate: semis(s[3]), pan: pan + (Math.random() - 0.5) * 0.2, send: s[4], p: P_LOW, c: C_SHOOT });
  }

  function play(name: SfxName, o: SfxOpts = {}) {
    const arg = o.arg ?? 0, pan = o.pan ?? 0, vol = o.vol ?? 1;
    const r1 = () => jit(0.08);
    switch (name) {
      case 'shoot': shoot(o.weapon ?? 'pen', pan, vol); break;
      case 'hit': hit(HK_IMPACT, 0, false, pan, vol); break;
      case 'crit': hit(HK_IMPACT, 0.8, true, pan, vol); break;
      case 'burn': hit(HK_BURN, 0, false, pan, vol); break;
      case 'zap': hit(HK_ZAP, 0, false, pan, vol); break;
      case 'kill': kill(pan, vol); break;
      case 'gem': gem(vol); break;
      case 'coin': if (throttle('coin', 0.05)) emit('coin', 0.2 * vol * density(C_COIN, core.now(), 0.35) * r1(), { rate: semis(0.4) * keyRate(), pan: pan + (Math.random() - 0.5) * 0.3, p: P_MID, c: C_COIN }); break;
      case 'tick': emit('tick', 0.18 * vol, { rate: Math.pow(2, MAJOR[Math.abs(Math.round(arg)) % 8] / 12), pan, p: P_HIGH, c: C_UI }); break;
      case 'click': if (throttle('click', 0.03)) emit('click', 0.16 * vol * r1(), { rate: semis(0.5), pan, p: P_HIGH, c: C_UI }); break;
      case 'enemyShot': if (throttle('enemyShot', 0.14)) emit('enemyShot', 0.15 * vol * r1(), { rate: semis(1.5), pan, p: P_LOW, c: C_SHOOT }); break;
      case 'hurt': if (throttle('hurt', 0.12)) { emit('hurt', 0.5 * vol * r1(), { rate: semis(0.8), pan, p: P_TOP, c: C_BIG }); duck(0.18, 0.25); } break;
      case 'explode': explode(arg > 0 ? arg : 120, true, pan, vol); break;
      case 'item': if (throttle('item', 0.06)) emit('item', 0.4 * vol * r1(), { rate: semis(0.3) * keyRate(), pan, p: P_HIGH, c: C_UI }); break;
      case 'heal': if (throttle('heal', 0.1)) emitT('heal', 0.4 * vol, { pan, send: 1, p: P_HIGH, c: C_UI }, true); break;
      case 'magnet': if (throttle('magnet', 0.1)) emit('magnet', 0.4 * vol, { pan, send: 1, p: P_HIGH, c: C_UI }); break;
      case 'timestop': if (throttle('timestop', 0.1)) { emit('timestop', 0.42 * vol, { pan, send: 2, p: P_TOP, c: C_BIG }); duck(0.3, 0.8); } break;
      case 'buy': emit('buy', 0.4 * vol, { rate: semis(0.2) * keyRate(), pan, send: 0, p: P_TOP, c: C_UI }); break;
      case 'toast': if (throttle('toast', 0.25)) emit('toast', 0.33 * vol, { rate: keyRate(), pan, send: 0, p: P_HIGH, c: C_UI }); break;
      case 'chime': emit('chime', 0.42 * vol, { rate: keyRate(), pan, send: 1, p: P_TOP, c: C_BIG }); break;
      case 'maxed': emitT('maxed', 0.36 * vol, { pan, send: 1, dl: true, p: P_TOP, c: C_UI }, true); break;
      case 'levelup': if (throttle('levelup', 0.15)) emitT('levelup', 0.48 * vol, { pan, send: 1, dl: true, p: P_TOP, c: C_BIG }, true); break;
      // 점심 종은 같은 조로 옮겨지는 점심 스팅어(약 3초)와 함께 난다 — 그 사이 다시 울리면 겹쳐 뭉개지므로 3초 스로틀
      case 'lunch': if (throttle('lunch', 3)) emit('lunch', 0.6 * vol, { rate: keyRate(), pan, send: 1, p: P_TOP, c: C_BIG }); break;
      case 'elite': emit('elite', 0.5 * vol, { pan, send: 1, p: P_TOP, c: C_BIG }); duck(0.2, 0.5); break;
      case 'eliteKill': emit('eliteKill', 0.52 * vol, { rate: semis(0.5), pan, send: 1, p: P_TOP, c: C_BIG }); duck(0.25, 0.5); break;
      case 'bossKill': emitT('bossKill', 0.85 * vol, { pan, send: 2, p: P_TOP, c: C_BIG }, true); duck(0.55, 1.6); break;
      case 'boss': if (throttle('boss', 0.5)) { emit('boss', 0.9 * vol, { pan, send: 2, p: P_TOP, c: C_BIG }); duck(0.25, 0.9); } break;
      case 'yageun': emit('yageun', 0.7 * vol, { pan, send: 2, p: P_TOP, c: C_BIG }); duck(0.3, 1.2); break;
      case 'ult': {
        lockBig = core.now() + 0.25;
        emit('ult', 0.75 * vol, { pan, send: 2, p: P_TOP, c: C_BIG });
        emit('u:' + ULT_KINDS[Math.abs(Math.round(arg)) % ULT_KINDS.length], 0.34 * vol, { pan, send: 1, p: P_TOP, c: C_BIG });
        duck(0.65, 1.5);
        break;
      }
      case 'revive': lockBig = core.now() + 0.25; emitT('revive', 0.75 * vol, { pan, send: 2, p: P_TOP, c: C_BIG }, true); duck(0.5, 1.4); break;
      case 'evolve': {
        // 상자에서 진화가 연달아 드러나면(0.4~0.5초 간격) 두 번째부터는 작게, 덕킹도 다시 걸지 않는다(큰 충격이 겹쳐 두 배로 커지지 않게)
        const now = core.now(), again = now - (last.get('evolve') ?? -99) < 1.5;
        last.set('evolve', now);
        emitT('evolve', (again ? 0.5 : 0.75) * vol, { pan, send: 2, dl: true, p: P_TOP, c: C_BIG }, false);
        if (!again) duck(0.2, 0.8);
        break;
      }
      case 'jackpot': if (throttle('jackpot', 0.3)) { emitT('jackpot', 0.6 * vol, { pan, send: 1, dl: true, p: P_TOP, c: C_BIG }, false); duck(0.3, 1); } break;
      case 'clear': emitT('clear', 0.6 * vol, { pan, send: 1, p: P_TOP, c: C_BIG }, false); break;
      case 'death': emit('death', 0.8 * vol, { pan, send: 2, p: P_TOP, c: C_BIG }); break;
    }
  }

  let ultK = '';
  function onSimEvent(ev: SimEvent, w: World) {
    simT = clock();
    if (w.ultimate.kind !== ultK) { ultK = w.ultimate.kind; if (ULT_KINDS.includes(ultK)) want('u:' + ultK); }
    const px = w.player.x, py = w.player.y;
    switch (ev.t) {
      case 'hit': {
        // 최근 피해의 로그 평균보다 센 타격일수록 낮고 크게(판이 진행돼 숫자가 커져도 상대적으로 판단)
        const ld = Math.log(Math.max(1, ev.dmg));
        dmgAvg = dmgN < 20 ? (dmgAvg * dmgN + ld) / (dmgN + 1) : dmgAvg * 0.97 + ld * 0.03; dmgN++;
        if (!ev.crit && hitBusy(core.now())) break;          // 모든 계열이 스로틀 중이면 적 조회도 건너뛴다
        hit(hitKind(w, ev.uid), ld - dmgAvg, ev.crit, panOf(ev.x, px), nearOf(ev.x, ev.y, px, py));
        break;
      }
      case 'kill':
        if (ev.boss) play('bossKill', { pan: panOf(ev.x, px) });
        else if (ev.elite) play('eliteKill', { pan: panOf(ev.x, px) });
        else kill(panOf(ev.x, px), nearOf(ev.x, ev.y, px, py));
        break;
      case 'hurt': play('hurt', { vol: Math.max(0.75, Math.min(1.25, 0.7 + (ev.dmg / Math.max(1, w.d.maxHp)) * 3)) }); break;
      case 'explode': explode(ev.r, ev.big, panOf(ev.x, px), nearOf(ev.x, ev.y, px, py)); break;
      case 'gem': gem(1); break;
      case 'coin': play('coin'); break;
      case 'item':
        if (ev.kind === 'coffee' || ev.kind === 'chicken') play('heal', { vol: ev.kind === 'chicken' ? 1.15 : 1 });
        else if (ev.kind === 'magnet') play('magnet');
        else if (ev.kind === 'clock') play('timestop');
        else if (ev.kind !== 'bomb' && ev.kind !== 'chest') play('item');   // 폭탄은 폭발음이 대신한다. 상자는 상자 창이 열릴 때 app.ts가 낸다(두 번 울리지 않게)
        break;
      case 'toast': if (ev.kind === 'warn' || ev.kind === 'boss') play('toast'); break;
      case 'bossSpawn': play('boss'); break;
      case 'elite': play('elite'); break;
      case 'ult': play('ult', { arg: Math.max(0, ULT_KINDS.indexOf(w.ultimate.kind)) }); break;
      case 'revive': play('revive'); break;
      case 'hour': play('chime'); break;
      case 'yageun': play('yageun'); break;
      case 'maxed': play('maxed'); break;
      case 'shoot': shoot(ev.w, 0, 1); break;
      case 'enemyShot': play('enemyShot'); break;
      default: break;
    }
  }

  return { play, onSimEvent };
}

/** 화면 위치 → 팬(카메라가 플레이어 중심이라 플레이어 기준 ±200 → ±0.7) */
const panOf = (x: number, px: number) => Math.max(-1, Math.min(1, (x - px) / 200)) * 0.7;
/** 멀리서 난 소리는 조금 작게(화면 밖도 들리긴 한다) */
const nearOf = (x: number, y: number, px: number, py: number) => Math.max(0.5, Math.min(1, 1.25 - Math.hypot(x - px, y - py) / 480));
const jit = (a: number) => 1 - a + Math.random() * 2 * a;
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
/** 화음의 3음 성질(음정 층 변주): 4 장3 · 3 단3 · 5 sus4 · 2 sus2 — 셋 다 없으면 장3 */
function thirdOf(h: Harmony): number {
  for (const th of THIRDS) if ((h.mask >> ((h.root + th) % 12)) & 1) return th;
  return 4;
}

// 타격 계열: 퍽(투사체·궤도·부메랑 등) · 둔탁(광역·궁극기 — 폭발음이 따로 울림) · 치익(커피 오라·레이저) · 지직(번개)
const HK_IMPACT = 0, HK_SOFT = 1, HK_BURN = 2, HK_ZAP = 3;
const HIT_KEY = ['hit', 'soft', 'burn', 'zap'];
const HIT_THR = [0.032, 0.06, 0.1, 0.05];
const HIT_GAIN = [0.27, 0.2, 0.2, 0.2];
/** 맞은 적의 마지막 타격 무기 → 타격음 계열 */
function hitKind(w: World, uid: number): number {
  let slot = -1;
  for (const e of w.enemies) if (e.uid === uid) { slot = e.lastHitSlot; break; }
  if (slot < 0) return HK_IMPACT;
  if (slot >= 6) return HK_SOFT;
  for (const wi of w.weapons) {
    if (wi.slot !== slot) continue;
    const a = wi.def.archetype;
    return a === 'aura' || a === 'beam' ? HK_BURN : a === 'chain' ? HK_ZAP : a === 'nova' || a === 'lob' || a === 'mine' || a === 'strike' ? HK_SOFT : HK_IMPACT;
  }
  return HK_IMPACT;
}
