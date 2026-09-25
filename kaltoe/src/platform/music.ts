// 배경음 엔진(절차적 작곡·합성) — 곡 7개 × 강도 0~3, 스팅어 6개. 외부 음원 없음.
// 곡 정의(템포·조성·섹션·화음·선율 악보) → 스텝 스크립트(곡마다 편곡) → 악기(FM 로즈·슈퍼소 패드·베이스·브라스·벨·
// KS 가야금·오르간·드럼 샘플) → 덱(곡마다 버스·필터·센드, 킥 사이드체인) → bed(스팅어 덕킹) → core.music.
// 스케줄러는 '구간 예약' 방식: 실시간은 0.3초 앞을 50ms마다 예약하고, 오프라인 렌더는 한 번에 전체를 예약한다(같은 결과).
// 곡 전환은 다음 마디(느린 곡은 반 마디) 경계에서 두 덱 사이 크로스페이드, 강도 변화는 다음 마디에 반영된다.
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

// ───────────── 음악 이론 도우미 ─────────────
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const mod12 = (x: number) => ((x % 12) + 12) % 12;
/** 'F#' 'Bb' 같은 음이름 → [피치클래스, 읽은 글자 수] */
function pcOf(s: string): [number, number] {
  let p = PC[s[0]] ?? 0, i = 1;
  if (s[1] === '#') { p++; i++; } else if (s[1] === 'b') { p--; i++; }
  return [mod12(p), i];
}
/** 'C4' → 60 */
function nn(s: string): number { const [p, i] = pcOf(s); return p + 12 * (parseInt(s.slice(i), 10) + 1); }

// 화음 성질(근음 기준 반음 간격)
const QUAL: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], '9': [0, 4, 7, 10, 14],
  '13': [0, 4, 10, 14, 21], '7b9': [0, 4, 7, 10, 13], '7sus': [0, 5, 7, 10], '9sus': [0, 5, 7, 10, 14], add9: [0, 4, 7, 14], '6': [0, 4, 7, 9],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
};

interface Ch {
  sym: string; r: number; iv: number[]; b: number; mask: number;
  pad: number[]; keys: number[];
  /** 앞 화음과 달라지는 자리(패드 재발음) · 같은 화음이 이어지는 길이(스텝) */
  first: boolean; hold: number;
}

/** 근음을 빼고(루트리스) 5음을 빼서 n음 화음 구성음을 고른다 */
function pickTones(iv: number[], n: number): number[] {
  let t = iv.slice();
  if (t.length > n) t = t.filter(x => x !== 0);
  if (t.length > n) t = t.filter(x => x !== 7);
  t = t.slice(0, n);
  for (let k = 0; t.length < n; k++) t.push(t[k] + 12);
  return t;
}

/** 성부 진행: 앞 화음에서 가장 적게 움직이는 자리바꿈을 음역 안에서 고른다 */
function voiceLead(pcs: number[], prev: number[] | null, lo: number, hi: number, ctr: number): number[] {
  const n = pcs.length, cur: number[] = new Array(n);
  let best: number[] | null = null, bc = 1e9;
  const rec = (i: number) => {
    if (i === n) {
      const v = cur.slice().sort((a, b) => a - b);
      for (let k = 1; k < n; k++) if (v[k] === v[k - 1]) return;
      if (v[n - 1] - v[0] > 15) return;
      let cost = Math.abs(v.reduce((a, b) => a + b, 0) / n - ctr) * 0.35;
      if (prev) for (let k = 0; k < n; k++) cost += Math.abs(v[k] - prev[Math.min(k, prev.length - 1)]);
      if (v[1] - v[0] < 3 && v[0] < 58) cost += 4;          // 저음역 뭉침 피하기
      if (cost < bc) { bc = cost; best = v; }
      return;
    }
    for (let m = lo + mod12(pcs[i] - lo); m <= hi; m += 12) { cur[i] = m; rec(i + 1); }
  };
  rec(0);
  return best ?? pcs.map(p => lo + mod12(p - lo)).sort((a, b) => a - b);
}

// ───────────── 악보 표기 ─────────────
// 공백으로 구분한 토큰 = 스텝 하나. '.' = 앞 음 늘임, '-' = 쉼, '|' = 보기용 구분(무시).
// 선율 토큰: 'E5', 'F#5^'(위에서 꺾어 내림), 'A4~'(아래에서 밀어 올림·떨기), '*'(강세).
// 베이스·오스티나토 토큰(현재 화음 기준): R 근음, 8 옥타브, 5 5음, v 아래 5음, 3, 7, f(♭2) m(단3) t(증4) 6,
// n 다음 화음 근음, b/a 다음 근음의 반음 아래/위(경과음). 뒤에 '*' 강세, 'g' 고스트.
interface Ev { tok: string; len: number }
interface Mel { m: number; o: string; len: number }
function toks(src: string | string[]): string[] { return (Array.isArray(src) ? src.join(' ') : src).split(/\s+/).filter(x => x && x !== '|'); }
function pat(src: string | string[]): (Ev | undefined)[] {
  const tk = toks(src), out: (Ev | undefined)[] = new Array(tk.length);
  for (let i = 0; i < tk.length; i++) {
    const x = tk[i];
    if (x === '.' || x === '-') continue;
    let j = i + 1;
    while (j < tk.length && tk[j] === '.') j++;
    out[i] = { tok: x, len: j - i };
  }
  return out;
}
function mpat(src: string | string[]): (Mel | undefined)[] {
  return pat(src).map(e => {
    if (!e) return undefined;
    const k = /^([A-G][#b]?-?\d)(.*)$/.exec(e.tok);
    return k ? { m: nn(k[1]), o: k[2], len: e.len } : undefined;
  });
}
/** 드럼 패턴: 글자 하나 = 스텝 하나(X 강, x 보통, g 고스트, '.' 쉼). 공백은 보기용. 장구는 D 덩·K 쿵·T 덕·g 기덕·r 굴림 */
const dp = (s: string) => s.replace(/\s+/g, '');

// ───────────── 곡 정의 ─────────────
type Wave = OscillatorType | 'organ' | 'reed' | 'soft';
interface SynP { w: Wave[]; mul?: number[]; det: number; lp: number; env: number; fa: number; fd: number; a: number; dec: number; sus: number; r: number; q: number }
interface PadP { w: Wave; det: number; a: number; r: number; lp: number; mod: number; v: number; q: number }
interface MonoP extends SynP { v: number; vib: number; glide: number }
interface SecDef { n: string; ch: string[]; mel?: string[]; alt?: string[]; f?: string }
interface Mix { k: number; s: number; h: number; bass: number; pad: number; keys: number; pluck: number; lead: number; fx: number }
interface TrackDef {
  bpm: number; spb: 3 | 4; swing: number; hum: number; maj: number; minLv: number; vol: number;
  bassLo: number; padR: [number, number, number]; keyR: [number, number, number];
  intro: SecDef[]; form: SecDef[];
  mix: Mix; rev: Partial<Mix>; dly: Partial<Mix>; dlyT: number;
  tone: number; wob: number; sc: number; ap: number; drive: number; post: number;
  pluck: [number, number];            // 플럭 버스 로우패스·팬
  bass: MonoP; lead: MonoP; pad: PadP;
}

const BASS_WARM: MonoP = { w: ['triangle', 'sine'], det: 0, lp: 650, env: 500, fa: 0.006, fd: 0.14, a: 0.008, dec: 0.5, sus: 0.7, r: 0.09, q: 0, v: 0.62, vib: 0, glide: 0 };
const BASS_SLAP: MonoP = { w: ['sawtooth', 'square'], det: 7, lp: 360, env: 3600, fa: 0.003, fd: 0.07, a: 0.003, dec: 0.2, sus: 0.55, r: 0.05, q: 5, v: 0.4, vib: 0, glide: 0 };
const BASS_PULSE: MonoP = { w: ['sawtooth', 'sine'], det: 0, lp: 380, env: 2000, fa: 0.003, fd: 0.08, a: 0.003, dec: 0.12, sus: 0.5, r: 0.04, q: 6, v: 0.42, vib: 0, glide: 0 };
const BASS_TROT: MonoP = { w: ['triangle', 'square'], mul: [1, 1], det: 0, lp: 700, env: 1400, fa: 0.004, fd: 0.09, a: 0.004, dec: 0.25, sus: 0.6, r: 0.06, q: 1, v: 0.52, vib: 0, glide: 0 };
const BASS_GUGAK: MonoP = { w: ['sine', 'triangle'], det: 0, lp: 700, env: 1300, fa: 0.005, fd: 0.12, a: 0.006, dec: 0.5, sus: 0.6, r: 0.1, q: 2, v: 0.62, vib: 0, glide: 0 };
const BASS_DIST: MonoP = { w: ['sawtooth', 'sawtooth'], det: 14, lp: 700, env: 2600, fa: 0.003, fd: 0.1, a: 0.003, dec: 0.2, sus: 0.8, r: 0.05, q: 5, v: 0.5, vib: 0, glide: 0 };
const BASS_TECH: MonoP = { w: ['sine', 'sawtooth'], det: 0, lp: 260, env: 1500, fa: 0.003, fd: 0.06, a: 0.004, dec: 0.15, sus: 0.45, r: 0.04, q: 8, v: 0.58, vib: 0, glide: 0 };

const LEAD_FLUTE: MonoP = { w: ['soft'], det: 0, lp: 2400, env: 1300, fa: 0.04, fd: 0.3, a: 0.035, dec: 0.6, sus: 0.72, r: 0.2, q: 0, v: 0.24, vib: 0.00019, glide: 0 };
const LEAD_CHORUS: MonoP = { w: ['sawtooth', 'sawtooth'], det: 11, lp: 1400, env: 3000, fa: 0.012, fd: 0.25, a: 0.01, dec: 0.3, sus: 0.75, r: 0.12, q: 3, v: 0.13, vib: 0.00016, glide: 0.035 };
const LEAD_SAW: MonoP = { w: ['sawtooth', 'square'], det: 7, lp: 1500, env: 2400, fa: 0.02, fd: 0.35, a: 0.02, dec: 0.5, sus: 0.8, r: 0.22, q: 4, v: 0.12, vib: 0.0002, glide: 0.07 };
const LEAD_BRASS: MonoP = { w: ['sawtooth', 'sawtooth'], det: 6, lp: 650, env: 3000, fa: 0.045, fd: 0.25, a: 0.03, dec: 0.4, sus: 0.8, r: 0.1, q: 2, v: 0.15, vib: 0.00032, glide: 0 };
const LEAD_PIRI: MonoP = { w: ['reed'], det: 0, lp: 2200, env: 1500, fa: 0.04, fd: 0.3, a: 0.05, dec: 0.5, sus: 0.85, r: 0.15, q: 3, v: 0.14, vib: 0.00036, glide: 0.05 };
const LEAD_BELL: MonoP = { w: ['sine'], det: 0, lp: 9000, env: 0, fa: 0.01, fd: 0.1, a: 0.005, dec: 0.3, sus: 0.5, r: 0.2, q: 0, v: 0.1, vib: 0, glide: 0 };
const LEAD_SIREN: MonoP = { w: ['sawtooth', 'sawtooth'], mul: [1, 1.4983], det: 5, lp: 2000, env: 2600, fa: 0.02, fd: 0.3, a: 0.015, dec: 0.4, sus: 0.85, r: 0.12, q: 5, v: 0.1, vib: 0.0002, glide: 0.09 };

const PAD_WARM: PadP = { w: 'sawtooth', det: 9, a: 0.6, r: 1.2, lp: 850, mod: 0.3, v: 0.05, q: 0 };
const PAD_BRIGHT: PadP = { w: 'sawtooth', det: 12, a: 0.25, r: 0.6, lp: 2000, mod: 0.35, v: 0.042, q: 1 };
const PAD_COLD: PadP = { w: 'sawtooth', det: 15, a: 0.5, r: 0.9, lp: 1400, mod: 0.5, v: 0.05, q: 2 };
const PAD_SOFT: PadP = { w: 'sawtooth', det: 8, a: 0.3, r: 0.5, lp: 1500, mod: 0.25, v: 0.034, q: 0 };
const PAD_STR: PadP = { w: 'sawtooth', det: 10, a: 0.7, r: 1.2, lp: 1250, mod: 0.4, v: 0.045, q: 1 };
const PAD_DARK: PadP = { w: 'sawtooth', det: 16, a: 0.15, r: 0.5, lp: 1700, mod: 0.4, v: 0.045, q: 2 };
const PAD_VOID: PadP = { w: 'sawtooth', det: 12, a: 1.2, r: 1.6, lp: 820, mod: 0.6, v: 0.055, q: 3 };

// 악기 음색(다성)
const S_ARP: SynP = { w: ['sawtooth', 'square'], det: 6, lp: 650, env: 4200, fa: 0.004, fd: 0.09, a: 0.003, dec: 0.12, sus: 0.3, r: 0.08, q: 5 };
const S_STAB: SynP = { w: ['square'], det: 0, lp: 900, env: 3600, fa: 0.003, fd: 0.05, a: 0.002, dec: 0.06, sus: 0.2, r: 0.05, q: 2 };
const S_ARPC: SynP = { w: ['sawtooth'], det: 0, lp: 480, env: 3000, fa: 0.003, fd: 0.12, a: 0.003, dec: 0.15, sus: 0.25, r: 0.1, q: 6 };
const S_OST: SynP = { w: ['sawtooth', 'sawtooth'], det: 10, lp: 850, env: 2600, fa: 0.003, fd: 0.07, a: 0.002, dec: 0.08, sus: 0.3, r: 0.05, q: 4 };
const S_SEQ: SynP = { w: ['sawtooth'], det: 0, lp: 420, env: 1700, fa: 0.003, fd: 0.08, a: 0.002, dec: 0.1, sus: 0.2, r: 0.06, q: 9 };
const S_DUB: SynP = { w: ['sawtooth', 'sawtooth'], det: 9, lp: 480, env: 2400, fa: 0.005, fd: 0.12, a: 0.004, dec: 0.18, sus: 0.1, r: 0.15, q: 3 };
const S_ORGAN: SynP = { w: ['organ'], det: 0, lp: 3200, env: 1400, fa: 0.003, fd: 0.06, a: 0.004, dec: 0.1, sus: 0.8, r: 0.04, q: 0 };
const S_BRASS: SynP = { w: ['sawtooth', 'sawtooth'], det: 7, lp: 500, env: 3000, fa: 0.05, fd: 0.25, a: 0.025, dec: 0.3, sus: 0.8, r: 0.12, q: 1 };
const S_BRASSLO: SynP = { w: ['sawtooth', 'sawtooth'], det: 9, lp: 170, env: 1300, fa: 0.45, fd: 0.5, a: 0.08, dec: 0.5, sus: 0.9, r: 0.35, q: 2 };
const S_BASS: SynP = { w: ['sawtooth', 'sine'], det: 0, lp: 280, env: 1500, fa: 0.004, fd: 0.12, a: 0.004, dec: 0.3, sus: 0.6, r: 0.1, q: 3 };
const S_SAW: SynP = { w: ['sawtooth', 'sawtooth'], det: 12, lp: 1800, env: 1500, fa: 0.3, fd: 0.6, a: 0.02, dec: 0.6, sus: 0.8, r: 0.5, q: 1 };

const A_OF = ['Dmaj9', 'Aadd9/C#', 'Bm9', 'Gmaj9', 'Dmaj9', 'Aadd9/C#', 'Bm9', 'Gmaj9|A7sus'];
const MEL_OF_A = [
  'F#5 . . A5 | . . E5 . | . . D5 . | E5 . F#5 .',
  'E5 . . . | . . C#5 . | . . A4 . | B4 . C#5 .',
  'D5 . . F#5 | . . B4 . | . . . . | A4 . B4 .',
  'D5 . . . | . . B4 . | . . A4 . | . . - -',
  'F#5 . . A5 | . . E5 . | . . D5 . | E5 . F#5 .',
  'E5 . . . | . . C#5 . | . . E5 . | F#5 . E5 .',
  'D5 . . F#5 | . . B5 . | . . . . | A5 . F#5 .',
];
const A_CR = ['Am', 'Fadd9', 'C', 'G', 'Am', 'Fadd9', 'C', 'Gsus4|G'];
const MEL_CR_A = [
  'E5 . . . | . . . . | D5 . . . | C5 . . .',
  'A4 . . . | . . . . | - - C5 . | . . D5 .',
  'E5 . . . | . . . . | G5 . . . | F5 . E5 .',
  'D5 . . . | . . . . | . . . . | B4 . . .',
  'E5 . . . | . . . . | D5 . . . | C5 . . .',
  'A4 . . . | . . . . | - - C5 . | . . E5 .',
  'G5 . . . | . . . . | A5 . . . | B5 . . .',
  'C6 . . . | . . . . | B5 . . . | . . . .',
];
const A_DI = ['Dm', 'Dm', 'Gm', 'Dm', 'Bb', 'A7', 'Dm', 'A7'];
const MEL_DI_A = [
  'D5 . . E5 | F5 . . . | E5 . D5 . | A4 . . .',
  'D5 . . . | . . . . | - - A4 . | D5 . E5 .',
  'F5^ . . E5 | D5 . . . | Bb4 . . . | D5 . . .',
  'A4~ . . . | . . . . | . . . . | - - - -',
  'F5 . . . | F5 . E5 . | F5 . . . | Bb5 . A5 .',
  'A5^ . . . | . . G5 . | E5 . . . | . . . .',
  'F5 . . . | E5 . D5 . | E5 . . . | A4 . . .',
  'E5 . . . | . . . . | - - C#5 . | E5 . A5 .',
];
const A_HO = ['Em9', 'Cmaj9/E', 'Am9/E', 'Dsus2/E', 'Em9', 'Cmaj9/E', 'Am9/E', 'Dsus2'];
const MEL_HO_A = [
  'E5 . . . . . D5 . E5 G5 . .',
  'A5 . . . . . G5 . E5 D5 . .',
  'E5~ . . . . . . . . G5 . E5',
  'D5 . . B4 . . A4 . . B4 . .',
  'E5 . . . . . G5 . A5 B5 . .',
  'D6 . . . . . B5 . A5 G5 . .',
  'A5 . . . . . G5 . E5 D5 . .',
  'B4 . . D5 . . E5~ . . . . .',
];
const A_BO = ['Em', 'Em', 'F', 'Em', 'Em', 'Em', 'C', 'B'];
const MEL_BO_A = [
  'B5 . . . | . . . . | . . . . | C6 . B5 .',
  'G5 . . . | . . . . | F#5 . . . | G5 . . .',
  'A5 . . . | . . . . | C6 . . . | . . . .',
  'B5 . . . | . . . . | . . . . | - - - -',
  'E6 . . . | . . . . | D6 . . . | B5 . . .',
  'C6 . . . | . . . . | B5 . . . | . . . .',
  'G5 . . . | . . . . | E5 . . . | G5 . . .',
  'F#5 . . . | . . . . | D#5 . . . | F#5 . . .',
];
const FM8 = ['Fm7', 'Fm7', 'Fm7', 'Fm7', 'Fm7', 'Fm7', 'Fm7', 'Fm7'];

const TRACKS: Record<TrackId, TrackDef> = {
  // 로파이 시티팝 C장조 90 — FM 로즈·따뜻한 베이스·브러시 드럼·테이프 흔들림·바이닐 잡음
  title: {
    bpm: 90, spb: 4, swing: 0.2, hum: 3, maj: 0, minLv: 2, vol: 1, bassLo: 29, padR: [53, 74, 62], keyR: [55, 77, 65],
    intro: [{ n: 'I', ch: ['Fmaj9', 'G9sus'], mel: ['- - - - | - - - - | - - - - | - - - -', '- - - - | - - - - | - - - - | C5 . D5 .'] }],
    form: [
      { n: 'A', ch: ['Fmaj9', 'Em7', 'Dm9', 'G9sus|G13'], mel: [
        'E5 . . D5 | . . C5 . | A4 . . . | G4 . A4 .',
        'B4 . . . | . . G4 . | A4 . B4 . | D5 . . .',
        'C5 . . D5 | . . E5 . | . . . . | F5 . E5 .',
        'D5 . . . | . . . . | - - A4 . | B4 . D5 .'] },
      { n: 'A2', ch: ['Fmaj9', 'Em7', 'Dm9', 'G9sus|G13'], mel: [
        'E5 . . D5 | . . C5 . | A4 . . . | C5 . D5 .',
        'E5 . . . | . . D5 . | B4 . . . | G4 . B4 .',
        'A4 . . C5 | . . D5 . | . . E5 . | F5 . G5 .',
        'A5 . . . | . . G5 . | . . . . | - - - -'] },
      { n: 'B', ch: ['Fmaj9', 'E7b9', 'Am9', 'Gm9|C9', 'Fmaj9', 'E7b9', 'Am9', 'Dm9|G13'], mel: [
        '- - A5 . | G5 . E5 . | . . . . | C5 . D5 .',
        'E5 . . . | . . D5 . | . . B4 . | G#4 . . .',
        'A4 . . B4 | . . C5 . | . . E5 . | . . G5 .',
        'F5 . . E5 | . . D5 . | . . . . | Bb4 . C5 .',
        'A4 . . C5 | . . E5 . | . . G5 . | A5 . . .',
        'G#5 . . . | F5 . . . | E5 . . . | D5 . B4 .',
        'C5 . . . | . . B4 . | A4 . . . | E5 . G5 .',
        'F5 . . . | E5 . D5 . | . . . . | B4 . D5 .'] },
      { n: 'C', f: 'brk', ch: ['Fmaj9', 'Em7', 'Dm9', 'G9sus'], alt: [
        '- - - - | - - - - | C6 . A5 . | G5 . E5 .',
        'D5 . . . | - - - - | - - B5 . | G5 . D5 .',
        '- - - - | - - - - | A5 . F5 . | E5 . C5 .',
        'D5 . . . | . . . . | - - - - | - - - -'] },
    ],
    mix: { k: 1.05, s: 2.4, h: 6, bass: 0.72, pad: 1.9, keys: 2.5, pluck: 1.5, lead: 1.7, fx: 2.2 },
    rev: { s: 0.25, h: 0.1, pad: 0.35, keys: 0.3, pluck: 0.3, lead: 0.4, fx: 0.15 }, dly: { keys: 0.1, lead: 0.24 }, dlyT: 0.75,
    tone: 6800, wob: 0.0011, sc: 0.12, ap: 0.45, drive: 1.2, post: 3200, pluck: [6000, 0.3],
    bass: BASS_WARM, lead: LEAD_FLUTE, pad: PAD_WARM,
  },
  // 업비트 신스웨이브 펑크 D장조 120 — 4박 킥·슬랩 베이스·16분 아르페지오·코러스 리드
  office: {
    bpm: 120, spb: 4, swing: 0.06, hum: 0, maj: 2, minLv: 0, vol: 1, bassLo: 31, padR: [55, 76, 65], keyR: [60, 81, 70],
    intro: [{ n: 'I', f: 'bld', ch: ['A7sus'] }],
    form: [
      { n: 'A', ch: A_OF, mel: [...MEL_OF_A, 'G5 . . . | F#5 . . . | E5 . . . | D5 . E5 .'] },
      { n: 'B', ch: ['Em9', 'F#m7', 'Gmaj9', 'A7sus|A7', 'Em9', 'F#m7', 'Gmaj9', 'A7sus'], mel: [
        '- - B5 . | . A5 . . | G5 . . . | E5 . G5 .',
        '- - C#6 . | . B5 . . | A5 . . . | F#5 . A5 .',
        '- - D6 . | . C#6 . . | B5 . . . | A5 . B5 .',
        'A5 . . . | . . G5 . | . . E5 . | C#5 . E5 .',
        '- - B5 . | . A5 . . | G5 . . . | E5 . G5 .',
        '- - C#6 . | . B5 . . | A5 . . . | F#5 . A5 .',
        '- - D6 . | . C#6 . . | B5 . . . | D6 . . .',
        'E6 . . . | . . D6 . | . . . . | - - - -'] },
      { n: 'A2', ch: A_OF, mel: [...MEL_OF_A, 'G5 . . . | F#5 . . . | E5 . . . | - - - -'] },
      { n: 'BR', f: 'brk', ch: ['Bm9', 'Gmaj9', 'Bm9', 'A7sus'] },
    ],
    mix: { k: 0.57, s: 2, h: 3.4, bass: 1.14, pad: 2.6, keys: 3.8, pluck: 3, lead: 2.6, fx: 2.4 },
    rev: { s: 0.22, h: 0.08, pad: 0.3, keys: 0.15, pluck: 0.2, lead: 0.3, fx: 0.3 }, dly: { keys: 0.12, pluck: 0.35, lead: 0.25 }, dlyT: 0.75,
    tone: 20000, wob: 0, sc: 0.45, ap: 0.15, drive: 1.6, post: 5000, pluck: [5200, -0.25],
    bass: BASS_SLAP, lead: LEAD_CHORUS, pad: PAD_BRIGHT,
  },
  // 다크 신스웨이브 A단조 126 — 펄스 베이스·게이트 스네어·차가운 패드·글라이드 리드
  crunch: {
    bpm: 126, spb: 4, swing: 0, hum: 0, maj: 0, minLv: 0, vol: 1, bassLo: 28, padR: [52, 74, 62], keyR: [57, 79, 67],
    intro: [{ n: 'I', f: 'bld', ch: ['Am'] }],
    form: [
      { n: 'A', ch: A_CR, mel: MEL_CR_A },
      { n: 'B', ch: ['F', 'G', 'Em', 'Am', 'F', 'G', 'Esus4|E', 'E'], mel: [
        'A5 . . . | G5 . . . | F5 . . . | E5 . . .',
        'D5 . . . | . . . . | B4 . . . | D5 . . .',
        'E5 . . . | G5 . . . | B5 . . . | A5 . G5 .',
        'A5 . . . | . . . . | . . . . | - - - -',
        'A5 . . . | G5 . . . | F5 . . . | E5 . F5 .',
        'G5 . . . | . . . . | D5 . . . | G5 . . .',
        'A5 . . . | . . . . | G#5 . . . | . . . .',
        'B5 . . . | . . . . | . . . . | - - - -'] },
      { n: 'A2', ch: A_CR, mel: MEL_CR_A },
      { n: 'BR', f: 'brk', ch: ['Dm', 'F', 'Dm', 'E'] },
    ],
    mix: { k: 0.44, s: 1.55, h: 5.5, bass: 1.03, pad: 2.4, keys: 1.5, pluck: 5.5, lead: 2.1, fx: 2.4 },
    rev: { s: 0.55, h: 0.1, pad: 0.4, keys: 0.2, pluck: 0.25, lead: 0.35, fx: 0.3 }, dly: { pluck: 0.4, lead: 0.3 }, dlyT: 0.75,
    tone: 20000, wob: 0, sc: 0.5, ap: 0.15, drive: 1.3, post: 6000, pluck: [3600, 0.3],
    bass: BASS_PULSE, lead: LEAD_SAW, pad: PAD_COLD,
  },
  // 회식 트로트 디스코 D단조 130 — 쿵짝 2박·오르간 짝·브라스 선율(꺾기·떨기)
  dinner: {
    bpm: 130, spb: 4, swing: 0, hum: 0, maj: 5, minLv: 0, vol: 1, bassLo: 31, padR: [53, 74, 62], keyR: [57, 76, 66],
    intro: [{ n: 'I', ch: ['A7'], mel: ['A4 . C#5 . | E5 . G5 . | A5 . . . | - - - -'] }],
    form: [
      { n: 'A', ch: A_DI, mel: MEL_DI_A },
      { n: 'B', ch: ['Gm', 'Gm', 'Dm', 'Dm', 'Bb', 'A7', 'Dm', 'Dm'], mel: [
        'Bb5 . . . | A5 . . . | G5 . . . | A5 . Bb5 .',
        'D6^ . . . | . . . . | Bb5 . . . | A5 . G5 .',
        'A5 . . . | . . F5 . | A5 . . . | Bb5 . A5 .',
        'F5 . . . | E5 . D5 . | - - - - | D5 . E5 .',
        'F5 . . . | . . D5 . | F5 . . . | Bb5 . . .',
        'A5 . . . | G5 . . . | E5 . . . | C#5 . E5 .',
        'D5~ . . . | . . . . | . . . . | . . . .',
        '- - - - | - - - - | A4 . D5 . | E5 . F5 .'] },
      { n: 'A2', ch: A_DI, mel: MEL_DI_A },
      { n: 'I', f: 'stop', ch: ['Dm', 'Gm', 'A7', 'Dm'], mel: [
        'A5 . D6 . | A5 . F5 . | - - D5 . | E5 . F5 .',
        'G5 . Bb5 . | G5 . D5 . | - - D5 . | E5 . F5 .',
        'E5 . . . | G5 . . . | A5 . . . | C#6 . . .',
        'D6 . . . | . . . . | A5 . F5 . | D5 . . .'] },
    ],
    mix: { k: 0.66, s: 2.1, h: 3.2, bass: 0.76, pad: 2.8, keys: 4.2, pluck: 3, lead: 2.5, fx: 1.5 },
    rev: { s: 0.25, h: 0.1, pad: 0.25, keys: 0.15, lead: 0.3, fx: 0.3 }, dly: { lead: 0.12 }, dlyT: 0.5,
    tone: 20000, wob: 0, sc: 0.25, ap: 0.22, drive: 1.2, post: 4000, pluck: [5000, 0],
    bass: BASS_TROT, lead: LEAD_BRASS, pad: PAD_SOFT,
  },
  // 국악 퓨전 E 계면조(5음) 12/8 114 — 가야금(KS)·자진모리 장구·징·꽹과리 + 현대 비트, 피리 헤테로포니
  holiday: {
    bpm: 114, spb: 3, swing: 0, hum: 0, maj: 7, minLv: 0, vol: 1, bassLo: 28, padR: [52, 74, 62], keyR: [55, 76, 64],
    intro: [{ n: 'I', ch: ['Em9', 'Em9'], mel: ['E4 G4 A4 B4 D5 E5 G5 A5 B5 . . .', 'B4 . . . . . A4 . B4 D5 . .'] }],
    form: [
      { n: 'A', ch: A_HO, mel: MEL_HO_A },
      { n: 'B', ch: ['Cmaj9', 'Dsus2', 'G6', 'Em9', 'Cmaj9', 'Dsus2', 'Am9', 'Bm7'], mel: [
        'G5 . . A5 . . B5 . . . . .',
        'A5 . . . . . D6 . B5 A5 . .',
        'B5 . . . . . A5 . . D5 . .',
        'E5~ . . . . . . . . . . .',
        'B5 . . . . . A5 . G5 E5 . .',
        'D6 . . . . . B5 . A5 B5 . .',
        'A5 . . . . . G5 . E5 G5 . .',
        'D5 . . . . . . . . B4 . .'] },
      { n: 'T', f: 'trad', ch: ['Em9', 'Em9', 'Em9', 'Em9'], mel: [
        'E5 G5 A5 B5 . . A5 G5 E5 D5 . .',
        'E5 . . . . . D5 E5 G5 A5 . .',
        'B5 A5 G5 A5 . . G5 E5 D5 E5 . .',
        'E5~ . . . . . . . . - - -'] },
      { n: 'A2', ch: A_HO, mel: MEL_HO_A },
    ],
    mix: { k: 0.72, s: 0.68, h: 1.8, bass: 0.82, pad: 2.3, keys: 1, pluck: 3.6, lead: 2.4, fx: 1.5 },
    rev: { s: 0.3, h: 0.12, pad: 0.35, pluck: 0.32, lead: 0.35, fx: 0.4 }, dly: { pluck: 0.18, lead: 0.2 }, dlyT: 2 / 3,
    tone: 20000, wob: 0, sc: 0.3, ap: 0.15, drive: 1.3, post: 3000, pluck: [7500, -0.15],
    bass: BASS_GUGAK, lead: LEAD_PIRI, pad: PAD_STR,
  },
  // 보스 E 프리지안 140 — 디스토션 베이스 리프·스네어 롤·반음 긴장·사이렌 리드
  boss: {
    bpm: 140, spb: 4, swing: 0, hum: 0, maj: 0, minLv: 0, vol: 1, bassLo: 28, padR: [52, 72, 62], keyR: [57, 77, 66],
    intro: [{ n: 'I', f: 'bld', ch: ['Em'] }],
    form: [
      { n: 'A', ch: A_BO, mel: MEL_BO_A },
      { n: 'B', ch: ['C', 'B', 'Bb', 'A', 'C', 'B', 'Bb', 'B7'], mel: [
        'E6 . . . | . . . . | G5 . . . | . . . .',
        'D#6 . . . | . . . . | F#5 . . . | . . . .',
        'D6 . . . | . . . . | F5 . . . | . . . .',
        'C#6 . . . | . . . . | E5 . . . | . . . .',
        'E6 . . . | . . . . | C6 . . . | B5 . C6 .',
        'D#6 . . . | . . . . | B5 . . . | F#5 . . .',
        'D6 . . . | . . . . | Bb5 . . . | F5 . . .',
        'A5 . . . | . . . . | F#5 . . . | D#5 . . .'] },
      { n: 'A2', ch: A_BO, mel: MEL_BO_A },
      { n: 'S', f: 'stop', ch: ['Em', 'Em', 'F', 'F'] },
    ],
    mix: { k: 0.4, s: 0.55, h: 5.2, bass: 1.8, pad: 2.3, keys: 7, pluck: 5.2, lead: 3, fx: 2.4 },
    rev: { s: 0.4, h: 0.08, pad: 0.3, pluck: 0.15, lead: 0.3, fx: 0.3 }, dly: { pluck: 0.15, lead: 0.2 }, dlyT: 0.75,
    tone: 20000, wob: 0, sc: 0.4, ap: 0.15, drive: 4.5, post: 2600, pluck: [3200, 0.2],
    bass: BASS_DIST, lead: LEAD_SIREN, pad: PAD_DARK,
  },
  // 다크 미니멀 테크노 F단조 132 — 럼블 킥·오프비트 베이스·3:4 폴리리듬 시퀀스·덥 코드·벨
  overtime: {
    bpm: 132, spb: 4, swing: 0.04, hum: 0, maj: 8, minLv: 0, vol: 1, bassLo: 29, padR: [53, 75, 63], keyR: [56, 75, 65],
    intro: [],
    form: [
      { n: 'A', ch: FM8 },
      { n: 'B', ch: FM8 },
      { n: 'C', ch: ['Fm9', 'Fm9', 'Fm9', 'Fm9', 'Dbmaj9/F', 'Dbmaj9/F', 'Fm9', 'Fm9'] },
      { n: 'BR', f: 'brk', ch: ['Fm9', 'Fm9', 'Fm9', 'Fm9'] },
      { n: 'BL', f: 'bld', ch: ['Fm9', 'Fm9', 'Fm9', 'Fm9'] },
    ],
    mix: { k: 0.32, s: 1.8, h: 4, bass: 0.9, pad: 2, keys: 7.5, pluck: 7, lead: 5, fx: 2.4 },
    rev: { s: 0.45, h: 0.12, pad: 0.4, keys: 0.3, pluck: 0.25, lead: 0.5, fx: 0.4 }, dly: { keys: 0.5, pluck: 0.3, lead: 0.45 }, dlyT: 0.75,
    tone: 20000, wob: 0, sc: 0.45, ap: 0.2, drive: 1.5, post: 5000, pluck: [500, 0],
    bass: BASS_TECH, lead: LEAD_BELL, pad: PAD_VOID,
  },
};

// 편곡 패턴(스텝 스크립트가 쓰는 악보 조각)
const TI = {
  comp1: pat('X . . . . . x . . . X . . . . .'), comp2: pat('X . . . . . x . X . . . . . x .'), compC: pat('X . . . . . . . . . . . x . . .'),
  bass1: pat('R . . . . . R . . . 5 . . . b .'), bass2: pat('R . . . . . 5 . R . . . . . b .'), bassC: pat('R . . . . . . . . . . . . . . .'),
  kA: dp('X... ...x ..X. ....'), kB: dp('X... .... X.x. ...g'), sA: dp('.... X... .... X...'), sB: dp('.... X... .... X..g'),
  hh: dp('x.xg x.x. x.xg x.x.'), shk: dp('gxgx gxgx gxgx gxgx'),
};
const OF = {
  bassA: pat('R* . - Rg 8* . - R . Rg 8* . 5 . b .'), bassB: pat('R* . . R - . 8* . R . - Rg 8* . 7 .'), bassBR: pat('R . . . . . . . R . . . . . . .'),
  k: dp('X... X... X... X...'), kB: dp('X... X... X... X.x.'), cl: dp('.... X... .... X...'),
  hc: dp('.g.g .g.g .g.g .g.g'), hc2: dp('xgxg xgxg xgxg xgxg'), ho: dp('..x. ..x. ..x. ..x.'), gh: dp('.... ...g .g.. ...g'),
  stab: pat('- - X - - - x - - - X - - - x -'), stabB: pat('- - X - - - x x - - X - - x - -'),
  arp: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 2], tamb: dp('.... x... .... x...'), shk: dp('xgxg xgxg xgxg xgxg'),
};
const CR = {
  b16: pat('R* R R R R* R R R R* R R R R* R 8 R'), b8: pat('R* . R . R* . R . R* . R . R* . R .'), bBR: pat('R . . . . . . . . . . . . . . .'),
  k1: dp('X... .... X... ....'), k2: dp('X... .... X.x. ....'), k3: dp('X... X... X.x. X...'), sn: dp('.... X... .... X...'),
  h8: dp('x.x. x.x. x.x. x.x.'), h16: dp('xgxg xgxg xgxg xgxg'), ho: dp('.... .... .... ..x.'),
  arp: [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 1, 3, 2, 4, 2],
};
const DI = {
  b2: pat('R . . . v . . . R . . . v . b .'), bOct: pat('R . 8 . R . 8 . R . 8 . R . 8 .'), bStop: pat('R . . . - - - - R . . . - - - -'),
  k: dp('X... X... X... X...'), sn: dp('.... X... .... X...'), ho: dp('..x. ..x. ..x. ..x.'), hc: dp('x.g. x.g. x.g. x.g.'),
  org: pat('- - x . - - x . - - x . - - x .'), tamb: dp('gxgx gxgx gxgx gxgx'), stop: dp('X... .... X... ....'),
};
const HO = {
  jang: dp('D.T K.T K.T KT.'), fill: dp('D.g K.T KrK rrr'),
  k1: dp('X.. ... X.. ...'), k3: dp('X.. ... X.. x..'), cl: dp('... X.. ... X..'), hat: dp('x.g x.g x.g x.g'),
  ost: pat('R . 5 8 . 5 R . 5 8 . 5'), bass: pat('R . . . . . 5 . . R . .'), kkw: dp('X.. x.. X.. x.x'),
};
const BO = {
  riffA: pat('R* R 8 R f R m R R* R 8 R t R m f'), riffB: pat('R* . R . R* . 8 . R* . R . 8 . R .'), riffS: pat('R* . . . . . . . . . . . . . . .'),
  k: dp('X... X... X... X...'), k3: dp('X... X... X... X.xx'), kB3: dp('X.x. X.x. X.x. X.x.'), sn: dp('.... X... .... X...'),
  h8: dp('x.x. x.x. x.x. x.x.'), h16: dp('xgxg xgxg xgxg xgxg'), ho: dp('.... .... .... ..x.'),
  ost: pat('R f R m R f R 5 R f R m R 5 t 5'),
};
const OT = {
  k: dp('X... X... X... X...'), hc: dp('xgxx xgxx xgxx xgxg'), ho: dp('..x. ..x. ..x. ..x.'), cl: dp('.... X... .... X...'),
  bass: pat('- - R . - - R . - - R . - - R .'), bassR: pat('- R R R - R R R - R R R - R R R'),
  stab: pat('- - - - - - X . - - - - - - - -'), shk: dp('.x.x .x.x .x.x .xxx'),
  seq: [0, 12, 3, 0, 7, 12, 10, 3], bell1: mpat('C6 . . Ab5 . . F5 . . . . . - - - -'), bell2: mpat('Ab5 . . C6 . . Eb6 . . F6 . . - - - -'),
};

// ───────────── 곡 조립(화음 성부 진행·선율 배치) ─────────────
interface Bar { sec: SecDef; bi: number; ch: Ch[]; mel?: (Mel | undefined)[]; alt?: (Mel | undefined)[]; off: number; last: boolean }
interface Built { intro: Bar[]; loop: Bar[] }
const BUILT = new Map<TrackId, Built>();

function buildTrack(id: TrackId): Built {
  const had = BUILT.get(id);
  if (had) return had;
  const def = TRACKS[id], spbar = def.spb * 4;
  let pp: number[] | null = null, pk: number[] | null = null;
  const mk = (secs: SecDef[]): Bar[] => {
    const bars: Bar[] = [];
    for (const sec of secs) {
      const mel = sec.mel ? mpat(sec.mel) : undefined, alt = sec.alt ? mpat(sec.alt) : undefined;
      sec.ch.forEach((cs, bi) => {
        const ch = cs.split('|').map(sym => {
          const [head, bs] = sym.split('/');
          const [r, i] = pcOf(head);
          const iv = QUAL[head.slice(i)] ?? QUAL[''];
          const b = bs ? pcOf(bs)[0] : r;
          let mask = 0;
          for (const x of iv) mask |= 1 << mod12(r + x);
          const pad = voiceLead(pickTones(iv, 4).map(x => mod12(r + x)), pp, def.padR[0], def.padR[1], def.padR[2]);
          const keys = voiceLead(pickTones(iv, 4).map(x => mod12(r + x)), pk, def.keyR[0], def.keyR[1], def.keyR[2]);
          pp = pad; pk = keys;
          return { sym, r, iv, b, mask, pad, keys, first: true, hold: 0 } as Ch;
        });
        bars.push({ sec, bi, ch, mel, alt, off: bi * spbar, last: bi === sec.ch.length - 1 });
      });
    }
    // 같은 화음이 이어지면 패드를 이어서(최대 4마디)
    const seq: { c: Ch; len: number }[] = [];
    for (const b of bars) for (const c of b.ch) seq.push({ c, len: spbar / b.ch.length });
    for (let i = 0; i < seq.length;) {
      const c = seq[i].c;
      c.first = true; c.hold = seq[i].len;
      let j = i + 1;
      while (j < seq.length && seq[j].c.sym === c.sym && c.hold + seq[j].len <= spbar * 4) { seq[j].c.first = false; c.hold += seq[j].len; j++; }
      i = j;
    }
    return bars;
  };
  const bt = { intro: mk(def.intro), loop: mk(def.form) };
  BUILT.set(id, bt);
  return bt;
}

// ───────────── 엔진 ─────────────
type BusK = 'k' | 's' | 'l' | 'r' | 'bass' | 'pad' | 'keys' | 'pluck' | 'lead' | 'fx';
interface Deck {
  id: number; b: Record<BusK, GainNode>;
  fade: GainNode; revF: GainNode; dlyF: GainNode; sc: GainNode; tone: BiquadFilterNode; wobG: GainNode; fltG: GainNode;
  bassLP: BiquadFilterNode; shaper: WaveShaperNode; bassPost: BiquadFilterNode; bassOut: GainNode;
  padLP: BiquadFilterNode; apG: GainNode; pluckLP: BiquadFilterNode; pluckPan: AudioNode; leadLP: BiquadFilterNode; vibG: GainNode;
  snd: Record<string, GainNode>;
  /** LFO 연결 켜기/끄기(쉬는 덱은 변조 지연선을 돌리지 않는다) · 페이드가 끝나 조용해지는 시각 */
  link(on: boolean): void; idleAt: number;
}
interface Play { id: TrackId; def: TrackDef; bt: Built; d: Deck; t0: number; n: number; sd: number; lm: number; le: number; lastLv: number }
interface Ctx {
  p: Play; d: Deck; def: TrackDef; t: number; sd: number; s: number; spbar: number; nb: number; n: number; bar: number;
  B: Bar; lv: number; intro: boolean; ch: Ch; nx: Ch; chg: boolean;
}

/** 결정적 의사난수(-1..1): 같은 스텝이면 실시간·오프라인이 같은 값을 낸다 */
function hz(a: number, b = 0): number {
  let x = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 1, 668265263);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) | 0) / 2147483648;
}
function rng(seed: number) { let x = (seed | 0) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x | 0) / 2147483648; }; }
function strHash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h; }

const AHEAD = 0.3;      // 실시간 예약 선행 시간(초)
const TICK = 50;        // 예약 주기(ms)
const MASTER = 0.3;     // 엔진 출력 기준 레벨(코어 글루 컴프·리미터 앞에서 여유를 둔다)

export function createMusic(core: AudioCore, live: boolean): MusicAPI {
  const ctx = core.ctx, sr = ctx.sampleRate;
  const gain = (v: number) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const biquad = (type: BiquadFilterType, f: number, q = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const panner = (v: number): AudioNode => {
    if (!ctx.createStereoPanner) return gain(1);
    const p = ctx.createStereoPanner(); p.pan.value = v; return p;
  };
  const lfo = (f: number) => { const o = ctx.createOscillator(); o.frequency.value = f; o.start(); return o; };
  const pw = (h: number[]) => ctx.createPeriodicWave(new Float32Array(h.length), Float32Array.from(h));
  const WAVES: Record<string, PeriodicWave> = {
    organ: pw([0, 1, 0.75, 0.5, 0.3, 0, 0.22, 0, 0.16]),
    reed: pw([0, 1, 0.35, 0.72, 0.22, 0.48, 0.14, 0.3, 0.08, 0.18, 0.04, 0.1]),
    soft: pw([0, 1, 0.22, 0.07, 0.025]),
  };

  // 출력: 트랙 bed(스팅어 때 덕킹) + 스팅어 버스 → out → core.music
  const out = gain(MASTER), dcBlock = biquad('highpass', 26, -3); out.connect(dcBlock); dcBlock.connect(core.music);
  const bed = gain(1); bed.connect(out);
  // 리버브 센드는 코어 리버브를 공유하므로 음악 볼륨(core.music)을 따라가게 한다
  const wetRev = gain(core.music.gain.value); wetRev.connect(core.reverb);
  const bedRev = gain(1); bedRev.connect(wetRev);
  // 템포 동기 핑퐁 딜레이(음악 전용)
  const dIn = gain(1), dHp = biquad('highpass', 320), dL = ctx.createDelay(2), dR = ctx.createDelay(2), dFb = gain(0.38), dLp = biquad('lowpass', 3600), dOut = gain(0.55);
  const mg = ctx.createChannelMerger(2);
  dIn.connect(dHp); dHp.connect(dL); dL.connect(mg, 0, 0); dL.connect(dR); dR.connect(mg, 0, 1); dR.connect(dLp); dLp.connect(dFb); dFb.connect(dL);
  mg.connect(dOut); dOut.connect(out);
  dL.delayTime.value = 0.375; dR.delayTime.value = 0.375;
  const bedDly = gain(1); bedDly.connect(dIn);
  // 스팅어 버스(bed 덕킹과 무관) + 테이프 스톱 라인(defeat)
  const sDry = gain(1); sDry.connect(out);
  const sRev = gain(0.4); sRev.connect(wetRev);
  const sDly = gain(0.35); sDly.connect(dIn);
  const TAPE = 2.4, sTape = ctx.createDelay(1); sTape.delayTime.value = 0; const sTapeG = gain(TAPE); sTape.connect(sTapeG); sTapeG.connect(sDry);

  // 공용 LFO(덱마다 깊이만 따로)
  const lfWow = lfo(0.47), lfFlut = lfo(5.7), lfCho = lfo(0.63), lfAp = lfo(3.6), lfVib = lfo(5.3);

  // 부드러운 포화 곡선(k별 캐시)
  const curves = new Map<number, Float32Array<ArrayBuffer>>();
  const curve = (k: number) => {
    let c = curves.get(k);
    if (!c) { c = new Float32Array(1025); const n = Math.tanh(k); for (let i = 0; i < 1025; i++) { const x = i / 512 - 1; c[i] = Math.tanh(k * x) / n; } curves.set(k, c); }
    return c;
  };

  function mkDeck(id: number): Deck {
    const fade = gain(0), revF = gain(0), dlyF = gain(0);
    fade.connect(bed); revF.connect(bedRev); dlyF.connect(bedDly);
    const wob = ctx.createDelay(0.05); wob.delayTime.value = 0.006; wob.connect(fade);
    const wobG = gain(0), fltG = gain(0); wobG.connect(wob.delayTime); fltG.connect(wob.delayTime);
    const tone = biquad('lowpass', 20000, -3); tone.connect(wob);
    const sum = gain(1); sum.connect(tone);
    const sc = gain(1); sc.connect(sum);
    const snd: Record<string, GainNode> = {};
    const send = (from: AudioNode, key: string, to: GainNode) => { const g = gain(0); from.connect(g); g.connect(to); snd[key] = g; };
    const b = {} as Record<BusK, GainNode>;
    // 드럼: 킥(가운데·마른) · 스네어 계열(가운데) · 하이햇 왼/오
    b.k = gain(1); b.k.connect(sum);
    b.s = gain(1); b.s.connect(sum); send(b.s, 's', revF);
    b.l = gain(1); const pl = panner(-0.38); b.l.connect(pl); pl.connect(sum); send(b.l, 'hl', revF);
    b.r = gain(1); const pr = panner(0.38); b.r.connect(pr); pr.connect(sum); send(b.r, 'hr', revF);
    // 베이스: 드라이브 → 필터(음마다 엔벨로프) → 포화 → 후단 필터 → 레벨 → 사이드체인
    b.bass = gain(1);
    const bassLP = biquad('lowpass', 600, 2), shaper = ctx.createWaveShaper(), bassPost = biquad('lowpass', 5000, -3), bassOut = gain(1);
    b.bass.connect(bassLP); bassLP.connect(shaper); shaper.connect(bassPost); bassPost.connect(bassOut); bassOut.connect(sc);
    // 패드: 필터(느린 움직임) → 코러스 폭 넓히기(왼쪽 원음·오른쪽 흔들린 지연) → 사이드체인
    b.pad = gain(1);
    const padLP = biquad('lowpass', 1500, 0); b.pad.connect(padLP);
    const wl = panner(-0.65), wr = panner(0.65), wd = ctx.createDelay(0.05); wd.delayTime.value = 0.014;
    const wideG = gain(0.0025); wideG.connect(wd.delayTime);
    padLP.connect(wl); padLP.connect(wd); wd.connect(wr); wl.connect(sc); wr.connect(sc); send(padLP, 'pad', revF);
    // 건반: 자동 팬(로즈 트레몰로)
    b.keys = gain(1);
    const ap = ctx.createStereoPanner ? ctx.createStereoPanner() : null, apG = gain(0);
    if (ap) { b.keys.connect(ap); apG.connect(ap.pan); ap.connect(sum); } else b.keys.connect(sum);
    send(b.keys, 'keys', revF); send(b.keys, 'keysD', dlyF);
    // 플럭(아르페지오·가야금)
    b.pluck = gain(1);
    const pluckLP = biquad('lowpass', 6000, 0), pluckPan = panner(0);
    b.pluck.connect(pluckLP); pluckLP.connect(pluckPan); pluckPan.connect(sum); send(pluckPan, 'pluck', revF); send(pluckPan, 'pluckD', dlyF);
    // 리드: 필터 엔벨로프 → 지연 변조 비브라토(음마다 늦게 깊어짐)
    b.lead = gain(1);
    const leadLP = biquad('lowpass', 2000, 2), vib = ctx.createDelay(0.05); vib.delayTime.value = 0.004;
    const vibG = gain(0); vibG.connect(vib.delayTime);
    b.lead.connect(leadLP); leadLP.connect(vib); vib.connect(sum); send(vib, 'lead', revF); send(vib, 'leadD', dlyF);
    // 효과(라이저·크래클)
    b.fx = gain(1); b.fx.connect(sum); send(b.fx, 'fx', revF);
    const links: [AudioNode, AudioNode][] = [[lfWow, wobG], [lfFlut, fltG], [lfCho, wideG], [lfAp, apG], [lfVib, vibG]];
    let on = false;
    const link = (v: boolean) => {
      if (v === on) return;
      on = v;
      for (const [a, g] of links) { if (v) a.connect(g); else try { a.disconnect(g); } catch { /* 이미 끊김 */ } }
    };
    return { id, b, fade, revF, dlyF, sc, tone, wobG, fltG, bassLP, shaper, bassPost, bassOut, padLP, apG, pluckLP, pluckPan, leadLP, vibG, snd, link, idleAt: 0 };
  }
  const decks = [mkDeck(0), mkDeck(1)];

  // ── 발음 관리: 덱·스팅어별 소스 목록(페이드 때 멈추고, 끝나면 연결 해제) ──
  const VO: { n: AudioScheduledSourceNode; e: number }[][] = [[], [], []];
  function reg(o: number, n: AudioScheduledSourceNode, t: number, e: number, nodes?: AudioNode[], off = 0) {
    if (off > 0) (n as AudioBufferSourceNode).start(t, off); else n.start(t);
    n.stop(e);
    VO[o].push({ n, e });
    if (nodes) n.onended = () => { for (const x of nodes) x.disconnect(); };
  }
  function prune(now: number) {
    for (const l of VO) { let j = 0; for (let i = 0; i < l.length; i++) if (l[i].e > now) l[j++] = l[i]; l.length = j; }
  }
  function cut(o: number, at: number) {
    for (const v of VO[o]) if (v.e > at) { try { v.n.stop(at); } catch { /* 이미 멈춤 */ } v.e = at; }
  }

  // ── 합성 도우미 ──
  function osc(w: Wave, f: number, det = 0): OscillatorNode {
    const o = ctx.createOscillator();
    const p = WAVES[w];
    if (p) o.setPeriodicWave(p); else o.type = w as OscillatorType;
    o.frequency.value = f;
    if (det) o.detune.value = det;
    return o;
  }
  /** ADSR: 선형 어택 → 지수 감쇠 → rel 시각부터 지수 릴리스(r초 뒤 거의 0) */
  function env(p: AudioParam, t: number, a: number, pk: number, dec: number, sus: number, rel: number, r: number) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(pk, t + a);
    if (sus < 1) p.setTargetAtTime(pk * sus, t + a, dec);
    p.setTargetAtTime(0, Math.max(rel, t + a), r / 6);
  }

  /** 다성 신스 음(필터 엔벨로프 포함): 아르페지오·스탭·브라스·오르간 */
  function vSyn(o: number, dst: AudioNode, t: number, m: number, dur: number, v: number, S: SynP, x?: AudioNode) {
    const f = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = S.q;
    const lo = Math.min(16000, S.lp + f * 0.5), hi = Math.min(16000, lo + S.env * v);
    lp.frequency.setValueAtTime(lo, t); lp.frequency.linearRampToValueAtTime(hi, t + S.fa); lp.frequency.setTargetAtTime(lo, t + S.fa, S.fd);
    const end = Math.max(t + dur, t + S.a) + S.r, nodes: AudioNode[] = [g, lp];
    for (let i = 0; i < S.w.length; i++) {
      const k = osc(S.w[i], f * (S.mul?.[i] ?? 1), S.w.length > 1 ? (i ? S.det : -S.det) : 0);
      k.connect(lp); nodes.push(k); reg(o, k, t, end, i ? undefined : nodes);
    }
    lp.connect(g); env(g.gain, t, S.a, v, S.dec, S.sus, t + dur, S.r);
    g.connect(dst); if (x) g.connect(x);
  }

  /** FM 일렉트릭 피아노(2-오퍼레이터): 타건 세기에 따라 밝기(변조 지수)가 변한다 */
  function vRhodes(o: number, dst: AudioNode, t: number, m: number, dur: number, v: number, x?: AudioNode) {
    const f = mtof(m), car = osc('sine', f), md = osc('sine', f * 1.0007), mgn = ctx.createGain(), g = ctx.createGain();
    const I = f * (0.8 + 2.4 * v) * (m > 76 ? 0.5 : m > 69 ? 0.75 : 1);
    mgn.gain.setValueAtTime(I, t); mgn.gain.setTargetAtTime(I * 0.22, t, 0.07); mgn.gain.setTargetAtTime(I * 0.08, t + 0.25, 0.7);
    md.connect(mgn); mgn.connect(car.frequency); car.connect(g);
    const pk = 0.2 * v, tau = m > 72 ? 0.5 : m > 60 ? 0.85 : 1.2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.003);
    g.gain.setTargetAtTime(pk * 0.18, t + 0.003, tau); g.gain.setTargetAtTime(0, t + dur, 0.07);
    const end = t + dur + 0.45;
    g.connect(dst); if (x) g.connect(x);
    reg(o, car, t, end, [car, md, mgn, g]); reg(o, md, t, end);
  }

  /** FM 종소리(비정수 배음비) */
  function vBell(o: number, dst: AudioNode, t: number, m: number, dur: number, v: number, ratio = 3.5, idx = 1.8, x?: AudioNode) {
    const f = mtof(m), car = osc('sine', f), md = osc('sine', f * ratio), mgn = ctx.createGain(), g = ctx.createGain();
    const D = f * ratio * idx;
    mgn.gain.setValueAtTime(D, t); mgn.gain.setTargetAtTime(D * 0.12, t, 0.22);
    md.connect(mgn); mgn.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, Math.max(0.12, dur / 3));
    g.gain.setTargetAtTime(0, t + dur, 0.03);
    const end = t + dur + 0.2;
    g.connect(dst); if (x) g.connect(x);
    reg(o, car, t, end, [car, md, mgn, g]); reg(o, md, t, end);
  }

  // ── 카플러스-스트롱 가야금: 음높이별 버퍼를 미리 계산(JS)해 캐시(최대 28개) ──
  const ksCache = new Map<number, { b: AudioBuffer; r: number }>();
  function ks(m: number) {
    const had = ksCache.get(m);
    if (had) return had;
    const f = mtof(m), N = Math.max(8, Math.floor(sr / f - 0.5)), r = (f * (N + 0.5)) / sr;
    const T60 = Math.max(0.5, Math.min(2.2, 2.4 - (m - 48) * 0.035)), len = Math.min(1.5, T60 * 0.8 + 0.2);
    const B = ctx.createBuffer(1, Math.ceil(len * sr), sr), d = B.getChannelData(0), line = new Float32Array(N), R = rng(m * 7919 + 3);
    let y = 0;
    for (let i = 0; i < N; i++) { y += 0.55 * (R() - y); line[i] = y; }
    const q = Math.max(1, Math.round(N * 0.18)), ex = Float32Array.from(line);
    let mean = 0;
    for (let i = 0; i < N; i++) { line[i] = ex[i] - 0.6 * ex[(i + q) % N]; mean += line[i]; }
    mean /= N;
    for (let i = 0; i < N; i++) line[i] -= mean;
    const g = Math.pow(0.001, 1 / (T60 * sr / (N + 0.5)));
    for (let i = 0, p = 0; i < d.length; i++) { const a = line[p], nx = p + 1 === N ? 0 : p + 1; d[i] = a; line[p] = g * 0.5 * (a + line[nx]); p = nx; }
    lp1(d, 5200); fin(B, 0.9, 0.0015, 0.03);
    const k = { b: B, r };
    if (ksCache.size >= 28) ksCache.delete(ksCache.keys().next().value as number);
    ksCache.set(m, k);
    return k;
  }
  /** 가야금 음: '~' 농현(떨기), '^' 꺾기(눌러 올렸다 내림) */
  function vKS(o: number, dst: AudioNode, t: number, m: number, dur: number, v: number, orn = '') {
    const K = ks(m), s = ctx.createBufferSource(); s.buffer = K.b;
    const pr = s.playbackRate;
    pr.setValueAtTime(K.r * 1.006, t); pr.setTargetAtTime(K.r, t, 0.025);
    if (orn.includes('~') && dur > 0.35) {
      for (let k = 1, tt = t + 0.2; tt < t + dur; k++, tt += 0.045) pr.linearRampToValueAtTime(K.r * (1 + 0.011 * Math.sin(k * 1.35) * Math.min(1, (tt - t - 0.2) / 0.35)), tt);
    } else if (orn.includes('^') && dur > 0.25) {
      pr.setValueAtTime(K.r, t + dur * 0.45); pr.linearRampToValueAtTime(K.r * 1.059, t + dur * 0.62); pr.linearRampToValueAtTime(K.r, t + dur * 0.85);
    }
    const g = ctx.createGain(), rel = t + dur;
    g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, rel); g.gain.setTargetAtTime(0, rel, 0.07);
    s.connect(g); g.connect(dst);
    reg(o, s, t, Math.min(t + K.b.duration / K.r, rel + 0.42), [s, g]);
  }

  // ── 드럼·효과 샘플(JS로 한 번 합성해 캐시) ──
  function lp1(d: Float32Array, fc: number) { const a = 1 - Math.exp((-2 * Math.PI * fc) / sr); let y = 0; for (let i = 0; i < d.length; i++) { y += a * (d[i] - y); d[i] = y; } }
  function biq(d: Float32Array, type: 0 | 1 | 2, f: number, q: number) {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (type === 0) { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if (type === 1) { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al, A1 = (-2 * cs) / a0, A2 = (1 - al) / a0;
    b0 /= a0; b1 /= a0; b2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < d.length; i++) { const x = d[i], y = b0 * x + b1 * x1 + b2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y; }
  }
  /** 정규화 + 시작·끝 페이드(클릭 방지) */
  function fin(B: AudioBuffer, peak = 0.95, fi = 0, fo = 0.01): AudioBuffer {
    let mx = 0;
    for (let c = 0; c < B.numberOfChannels; c++) { const d = B.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > mx) mx = a; } }
    const k = mx > 0 ? peak / mx : 1, L = B.length, nf = Math.min(L, Math.floor(sr * fo)), ni = Math.min(L, Math.floor(sr * fi));
    for (let c = 0; c < B.numberOfChannels; c++) {
      const d = B.getChannelData(c);
      for (let i = 0; i < L; i++) d[i] *= k;
      for (let i = 0; i < ni; i++) d[i] *= i / ni;
      for (let i = L - nf; i < L; i++) d[i] *= (L - i) / nf;
    }
    return B;
  }
  const mkB = (sec: number, ch = 1) => ctx.createBuffer(ch, Math.max(1, Math.ceil(sec * sr)), sr);
  const M808 = [205.3, 304.4, 369.6, 522.7, 540, 800];
  function metal(d: Float32Array, scale: number, amt: number, R: () => number) {
    const ph = new Float64Array(6), inc = new Float64Array(6);
    for (let k = 0; k < 6; k++) { ph[k] = (R() + 1) / 2; inc[k] = (M808[k] * scale) / sr; }
    const a = amt / 6;
    for (let i = 0; i < d.length; i++) {
      let s = 0;
      for (let k = 0; k < 6; k++) { let p = ph[k] + inc[k]; if (p >= 1) p -= 1; ph[k] = p; s += p < 0.5 ? a : -a; }
      d[i] += s;
    }
  }
  /** 지수 감쇠 계수(표본당 곱) */
  const dk = (tau: number) => Math.exp(-1 / (sr * tau));
  /** 빠른 tanh 근사(|x|≥3이면 ±1) */
  const ft = (x: number) => (x >= 3 ? 1 : x <= -3 ? -1 : (x * (27 + x * x)) / (27 + 9 * x * x));
  function kickB(R: () => number, f0: number, f1: number, pt: number, at: number, drive: number, click: number, lp: number, len: number, rumble = 0) {
    const B = mkB(len), d = B.getChannelData(0), kp = dk(pt), ka = dk(at), kc = dk(0.0022), kr = dk(0.42), w = (2 * Math.PI) / sr, w2 = w * f1 * 0.96, nrm = 1 / ft(drive);
    let ph = 0, ph2 = 0, ep = 1, ea = 1, ec = 0.55 * click, er = rumble;
    for (let i = 0; i < d.length; i++) {
      ph += w * (f1 + (f0 - f1) * ep); ep *= kp;
      let x = Math.sin(ph) * ea * (i < 29 ? i / 29 : 1) + ec * R(); ea *= ka; ec *= kc;
      if (rumble) { ph2 += w2; x += er * Math.sin(ph2) * Math.min(1, i / (sr * 0.05)); er *= kr; }
      d[i] = ft(x * drive) * nrm;
    }
    if (lp) biq(d, 0, lp, 0.7);
    return fin(B, 0.98);
  }
  function snareB(R: () => number, tf: number, ta: number, td: number, na: number, nd: number, hp: number, lp: number, len: number, gate = 0, drive = 1, att = 0.0006) {
    const B = mkB(len), d = B.getChannelData(0), nz = new Float32Array(d.length);
    for (let i = 0; i < nz.length; i++) nz[i] = R();
    biq(nz, 1, hp, 0.7); biq(nz, 0, lp, 0.7);
    const w = (2 * Math.PI * tf) / sr, kf = dk(0.012), kt = dk(td), kn = dk(nd), gi = Math.floor(gate * sr), gl = sr * 0.016, ai = Math.max(1, att * sr), nrm = drive > 1 ? 1 / ft(drive) : 1;
    let p1 = 0, p2 = 0, ef = 0.35, et = ta, en = na, eg = 0;
    for (let i = 0; i < d.length; i++) {
      p1 += w * (1 + ef); p2 += w * 1.63 * (1 + ef); ef *= kf;
      let ne = en; en *= kn;
      if (gate) { if (i < gi) eg = ne; else ne = eg * Math.max(0, 1 - (i - gi) / gl); }
      const x = (Math.sin(p1) + 0.5 * Math.sin(p2)) * et * (i < 22 ? i / 22 : 1) + nz[i] * ne * (i < ai ? i / ai : 1); et *= kt;
      d[i] = drive > 1 ? ft(x * drive) * nrm : x;
    }
    return fin(B);
  }
  function noiseB(R: () => number, len: number, ch = 1) { const B = mkB(len, ch); for (let c = 0; c < ch; c++) { const d = B.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = R(); } return B; }
  /** 감쇠하는 사인 부분음 합(점화식 발진기: 표본당 곱셈 몇 번) */
  function partials(len: number, fs: number[], as: number[], ds: number[], att: number) {
    const B = mkB(len), d = B.getChannelData(0), ai = Math.max(1, att * sr);
    for (let k = 0; k < fs.length; k++) {
      const c2 = 2 * Math.cos((2 * Math.PI * fs[k]) / sr), kd = dk(ds[k]);
      let s1 = 0, s0 = Math.sin((2 * Math.PI * fs[k]) / sr), e = as[k];
      for (let i = 0; i < d.length; i++) { d[i] += s1 * e; const s2 = c2 * s0 - s1; s1 = s0; s0 = s2; e *= kd; }
    }
    for (let i = 0; i < ai && i < d.length; i++) d[i] *= i / ai;
    return B;
  }
  /** 잡음 버스트 포락선: 박수(짧은 3연타 + 꼬리) */
  function clapEnv(d: Float32Array, tail: number) {
    const kb = dk(0.0032), kt = dk(tail), s1 = Math.round(sr * 0.0095), s3 = Math.round(sr * 0.028);
    let b = 0, tl = 0;
    for (let i = 0; i < d.length; i++) {
      if (i === 0 || i === s1 || i === 2 * s1) b += 1;
      if (i === s3) tl = 0.75;
      d[i] *= b + tl; b *= kb; tl *= kt;
    }
  }
  /** 선형 어택 + 지수 감쇠 포락선 */
  function adEnv(d: Float32Array, att: number, tau: number) {
    const ai = Math.max(1, att * sr), k = dk(tau);
    for (let i = 0, e = 1; i < d.length; i++) { d[i] *= (i < ai ? i / ai : 1) * e; if (i >= ai) e *= k; }
  }
  function synthDrum(name: string): AudioBuffer {
    const R = rng(strHash(name));
    switch (name) {
      case 'k.lofi': return kickB(R, 115, 46, 0.03, 0.2, 1.5, 0.15, 2400, 0.5);
      case 'k.funk': return kickB(R, 170, 50, 0.03, 0.24, 2.2, 0.6, 0, 0.45);
      case 'k.synth': return kickB(R, 190, 43, 0.05, 0.36, 2.6, 0.45, 0, 0.7);
      case 'k.trot': return kickB(R, 160, 55, 0.026, 0.2, 1.8, 0.7, 0, 0.4);
      case 'k.gugak': return kickB(R, 150, 47, 0.04, 0.3, 2, 0.4, 0, 0.55);
      case 'k.boss': return kickB(R, 240, 46, 0.04, 0.3, 4.2, 0.9, 0, 0.5);
      case 'k.techno': return kickB(R, 220, 46, 0.045, 0.4, 2.4, 0.5, 0, 0.9, 0.25);
      case 's.brush': return snareB(R, 190, 0.08, 0.05, 1, 0.14, 900, 6000, 0.4, 0, 1, 0.004);
      case 's.funk': return snareB(R, 195, 0.6, 0.07, 0.8, 0.13, 1500, 9500, 0.32);
      case 's.gate': return snareB(R, 175, 0.5, 0.1, 1, 0.6, 900, 8000, 0.36, 0.26);
      case 's.trot': return snareB(R, 215, 0.45, 0.06, 0.9, 0.11, 1800, 10000, 0.28);
      case 's.boss': return snareB(R, 185, 0.7, 0.09, 1, 0.18, 1100, 9000, 0.4, 0, 2.2);
      case 'rim': {
        const B = partials(0.09, [1700, 820], [0.7, 0.5], [0.009, 0.02], 0.0003), d = B.getChannelData(0), k = dk(0.0015);
        for (let i = 0, e = 0.6; i < d.length; i++, e *= k) d[i] += R() * e;
        biq(d, 1, 300, 0.7); return fin(B);
      }
      case 'clap': case 'clap.big': {
        const big = name === 'clap.big', B = noiseB(R, big ? 0.7 : 0.4), d = B.getChannelData(0);
        biq(d, 2, big ? 1000 : 1150, 1.3); biq(d, 1, 500, 0.7); clapEnv(d, big ? 0.3 : 0.12);
        return fin(B);
      }
      case 'h.c': case 'h.soft': case 'h.o': {
        const soft = name === 'h.soft', open = name === 'h.o', B = noiseB(R, open ? 0.5 : 0.1), d = B.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] *= soft ? 0.7 : 0.4;
        metal(d, 1.9, soft ? 0.3 : 0.6, R);
        biq(d, 1, soft ? 5200 : 7200, 0.7); biq(d, 1, soft ? 5200 : 7200, 0.7); if (soft) biq(d, 0, 9500, 0.7);
        adEnv(d, 0.0004, open ? 0.25 : soft ? 0.036 : 0.05);
        return fin(B);
      }
      case 'shk': { const B = noiseB(R, 0.14), d = B.getChannelData(0); biq(d, 2, 6500, 1); adEnv(d, 0.012, 0.045); return fin(B); }
      case 'tamb': {
        const B = noiseB(R, 0.3), d = B.getChannelData(0); biq(d, 1, 6500, 0.7); adEnv(d, 0.002, 0.08);
        const J = partials(0.3, [5300, 6700, 7900, 9400], [0.12, 0.12, 0.12, 0.12], [0.14, 0.14, 0.14, 0.14], 0.003).getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] += J[i];
        return fin(B);
      }
      case 'crash': {
        // 금속 성분은 한 번 만들어 두 채널이 공유, 잡음은 채널마다 달라 넓게 퍼진다
        const B = mkB(1.4, 2), m = new Float32Array(B.length);
        metal(m, 1.37, 0.5, R);
        for (let c = 0; c < 2; c++) {
          const d = B.getChannelData(c);
          for (let i = 0; i < d.length; i++) d[i] = R() * 0.5 + m[i];
          biq(d, 1, 3200, 0.7); biq(d, 1, 3200, 0.7);
          const k1 = dk(0.5), k2 = dk(0.04), ai = sr * 0.002;
          for (let i = 0, e1 = 1, e2 = 0.4; i < d.length; i++, e1 *= k1, e2 *= k2) d[i] *= (i < ai ? i / ai : 1) * e1 * (1 + e2);
        }
        return fin(B);
      }
      case 'rev': {       // 역재생 심벌: 크래시를 뒤집어 쓴다
        const C = drum('crash'), B = mkB(C.duration, 2);
        for (let c = 0; c < 2; c++) { const s = C.getChannelData(c), d = B.getChannelData(c), L = d.length; for (let i = 0; i < L; i++) d[i] = s[L - 1 - i]; }
        return fin(B, 0.95, 0.05, 0.004);
      }
      case 'tom.h': case 'tom.m': case 'tom.l': {
        const f = name === 'tom.h' ? 210 : name === 'tom.m' ? 150 : 105, B = mkB(0.6), d = B.getChannelData(0), w = (2 * Math.PI * f) / sr, kf = dk(0.04), ka = dk(0.2), kn = dk(0.015);
        for (let i = 0, ph = 0, ef = 0.6, ea = 1, en = 0.15; i < d.length; i++, ef *= kf, ea *= ka, en *= kn) { ph += w * (1 + ef); d[i] = ft(1.5 * (Math.sin(ph) * ea * (i < 22 ? i / 22 : 1) + R() * en)); }
        return fin(B);
      }
      case 'jg.kung': {   // 장구 궁편(낮은 쪽, 손바닥·궁채): 둥 울리는 막 소리
        const B = mkB(0.7), d = B.getChannelData(0), nz = new Float32Array(d.length), w = (2 * Math.PI * 82.4) / sr, kf = dk(0.03), k1 = dk(0.3), k2 = dk(0.12), kn = dk(0.025);
        for (let i = 0; i < nz.length; i++) nz[i] = R();
        lp1(nz, 700);
        for (let i = 0, ph = 0, ef = 0.3, e1 = 1, e2 = 0.3, en = 1.2; i < d.length; i++, ef *= kf, e1 *= k1, e2 *= k2, en *= kn) { ph += w * (1 + ef); d[i] = ft(1.3 * ((Math.sin(ph) * e1 + Math.sin(ph * 1.52) * e2) * (i < 29 ? i / 29 : 1) + nz[i] * en)); }
        return fin(B);
      }
      case 'jg.deok': {   // 장구 채편(높은 쪽, 열채): 딱 갈라지는 소리
        const B = mkB(0.3), d = B.getChannelData(0), nz = new Float32Array(d.length), w = (2 * Math.PI * 392) / sr, kf = dk(0.008), kn = dk(0.01), k1 = dk(0.07), k2 = dk(0.035);
        for (let i = 0; i < nz.length; i++) nz[i] = R();
        biq(nz, 1, 2000, 0.7);
        const S = partials(0.3, [2600], [0.5], [0.003], 0.00005).getChannelData(0);
        for (let i = 0, ph = 0, ef = 0.15, en = 1, e1 = 0.7, e2 = 0.3; i < d.length; i++, ef *= kf, en *= kn, e1 *= k1, e2 *= k2) {
          ph += w * (1 + ef);
          d[i] = nz[i] * en + (Math.sin(ph) * e1 + Math.sin(ph * 1.68) * e2) * (i < 15 ? i / 15 : 1) + S[i];
        }
        return fin(B);
      }
      case 'kkw': {       // 꽹과리: 밝은 금속 비정수 배음
        const fs = [1, 1.49, 1.92, 2.55, 3.21, 4.08].map(x => x * 1150);
        const B = partials(0.5, fs, [1, 0.8, 0.65, 0.5, 0.35, 0.25], [0.28, 0.22, 0.18, 0.14, 0.1, 0.08], 0.0005), d = B.getChannelData(0), k = dk(0.004);
        for (let i = 0, e = 0.6; i < d.length; i++, e *= k) d[i] += R() * e;
        return fin(B);
      }
      case 'jing': {      // 징: 낮고 길게 맥놀이하는 울림(E2 기준, 곡 조성에 맞춤)
        return fin(partials(2.8, [82.4, 83, 167.3, 223.3, 290, 379], [1, 0.8, 0.45, 0.3, 0.2, 0.1], [1.8, 1.8, 1, 0.7, 0.5, 0.35], 0.02), 0.95, 0, 0.3);
      }
      case 'crackle': {   // 바이닐 딱딱이: 드문 톡 소리만(쉿 소리는 재생 때 잡음 버퍼로 따로)
        const B = mkB(3, 2);
        for (let c = 0; c < 2; c++) {
          const d = B.getChannelData(c), n = 12 + c * 3;
          for (let p = 0; p < n; p++) {
            const at = Math.floor(((p + 0.5 + 0.45 * R()) / n) * (d.length - 64)), a = (0.25 + 0.75 * Math.abs(R())) * (R() > 0 ? 1 : -1), len = 8 + Math.floor(6 * Math.abs(R()));
            for (let k = 0; k < 40; k++) d[at + k] += a * Math.exp(-k / len) * (k < 2 ? k / 2 : 1);
          }
        }
        return fin(B, 0.9);
      }
      case 'sub': {       // 서브 임팩트(진화·보스 등장)
        const B = mkB(1.6), d = B.getChannelData(0), w = (2 * Math.PI) / sr, kf = dk(0.18), ka = dk(0.6), ai = sr * 0.004;
        for (let i = 0, ph = 0, ef = 1, ea = 1; i < d.length; i++, ef *= kf, ea *= ka) { ph += w * (32 + 48 * ef); d[i] = ft(1.6 * Math.sin(ph) * (i < ai ? i / ai : 1) * ea); }
        return fin(B);
      }
      default: return kickB(R, 150, 50, 0.03, 0.25, 2, 0.5, 0, 0.4);
    }
  }
  const dCache = new Map<string, AudioBuffer>();
  // 곡마다 쓰는 샘플(첫 마디에 필요한 것부터). 실시간에서는 틱마다 조금씩 미리 합성하고, 전환이 예약되면 그 곡 것을 앞당긴다
  const KIT: Record<TrackId, string[]> = {
    title: ['crackle', 'k.lofi', 's.brush', 'h.soft', 'rim', 'shk', 'crash'],
    office: ['s.funk', 'rev', 'crash', 'k.funk', 'clap', 'h.c', 'h.o', 'tom.h', 'tom.m', 'tom.l', 'tamb', 'shk'],
    crunch: ['s.gate', 'rev', 'crash', 'k.synth', 'h.c', 'h.o', 'tom.h', 'tom.m', 'tom.l'],
    dinner: ['s.trot', 'crash', 'k.trot', 'h.o', 'h.c', 'tamb'],
    holiday: ['jing', ...ksWarm().map(m => 'ks:' + m), 'jg.deok', 'jg.kung', 'k.gugak', 'clap', 'h.c', 'kkw', 'crash'],
    boss: ['s.boss', 'rev', 'crash', 'k.boss', 'h.c', 'h.o'],
    overtime: ['k.techno', 'h.c', 'h.o', 'clap.big', 'clap', 'rim', 'shk', 'crash', 'sub', 'rev'],
  };
  const STING_KIT = ['s.funk', 'tom.m', 'tom.l', 'k.funk', 'crash', 'rev', 'k.boss', 'sub'];
  const queue: string[] = live ? [...KIT.title, ...KIT.office, ...STING_KIT, ...KIT.crunch, ...KIT.dinner, ...KIT.holiday, ...KIT.boss, ...KIT.overtime] : [];
  const warmed = (k: string) => (k.startsWith('ks:') ? ksCache.has(+k.slice(3)) : dCache.has(k));
  /** 곡 전환이 예약되면 그 곡 샘플을 먼저 */
  function prio(t: TrackId) { if (live) queue.unshift(...KIT[t].filter(k => !warmed(k))); }
  /** 명절 곡에서 쓰는 가야금 음높이(선율 + 오스티나토의 근음·5음·옥타브) */
  function ksWarm(): number[] {
    const set = new Set<number>(), bt = buildTrack('holiday');
    for (const b of [...bt.intro, ...bt.loop]) {
      for (const e of b.mel ?? []) if (e) set.add(e.m);
      for (const c of b.ch) { const base = 45 + mod12(c.r - 45); set.add(base); set.add(base + 12); set.add(base + mod12(c.r + 7 - base)); }
    }
    return [...set].sort((a, b) => a - b);
  }
  /** 예약 틱마다 budget(ms) 안에서 미리 합성 */
  function warm(budget: number) {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < budget) {
      const k = queue.shift() as string;
      if (warmed(k)) continue;
      if (k.startsWith('ks:')) ks(+k.slice(3)); else drum(k);
    }
  }
  const drum = (name: string) => { let b = dCache.get(name); if (!b) { b = synthDrum(name); dCache.set(name, b); } return b; };
  /** 샘플 한 번 재생. endAt을 주면 샘플 끝이 그 시각에 오게(역재생 심벌), 모자라면 앞부분을 건너뛴다 */
  function hit(o: number, dst: AudioNode, name: string, t: number, v: number, rate = 1, endAt = 0) {
    const b = drum(name), s = ctx.createBufferSource(); s.buffer = b;
    if (rate !== 1) s.playbackRate.value = rate;
    const nodes: AudioNode[] = [s];
    let off = 0;
    if (endAt) { const st = endAt - b.duration / rate; if (st >= t) t = st; else off = (t - st) * rate; }
    if (v !== 1 || off) {
      const g = ctx.createGain();
      if (off) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.03); } else g.gain.value = v;
      s.connect(g); g.connect(dst); nodes.push(g);
    } else s.connect(dst);
    reg(o, s, t, t + (b.duration - off) / rate + 0.01, nodes, off);
  }
  /** 반복 버퍼(바이닐 잡음)를 dur초 동안 부드럽게 */
  function loopFx(o: number, dst: AudioNode, name: string, t: number, dur: number, v: number) {
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = drum(name); s.loop = true;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.06); g.gain.setValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.06);
    s.connect(g); g.connect(dst);
    reg(o, s, t, t + dur + 0.07, [s, g]);
  }
  /** 테이프 쉿 소리: 코어 잡음 버퍼를 로우패스로 걸러 dur초 동안 */
  function hiss(o: number, dst: AudioNode, t: number, dur: number, v: number) {
    const s = ctx.createBufferSource(), f = biquad('lowpass', 3800, -3), g = ctx.createGain();
    s.buffer = core.noise; s.loop = true;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.06); g.gain.setValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.06);
    s.connect(f); f.connect(g); g.connect(dst);
    reg(o, s, t, t + dur + 0.07, [s, f, g], 0);
  }
  /** 잡음 라이저: 대역 필터가 올라가며 커진다 */
  function sweep(o: number, dst: AudioNode, t: number, dur: number, f0: number, f1: number, v: number) {
    const s = ctx.createBufferSource(), f = biquad('bandpass', f0, 1.6), g = ctx.createGain();
    s.buffer = core.noise; s.loop = true;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.92); g.gain.linearRampToValueAtTime(0, t + dur + 0.04);
    s.connect(f); f.connect(g); g.connect(dst);
    reg(o, s, t, t + dur + 0.05, [s, f, g]);
  }

  // ── 덱 버스 음(단성 베이스·리드, 패드) ──
  function vBass(c: Ctx, m: number, len: number, v: number, pop: boolean) {
    const P = c.def.bass, d = c.d, t = c.t, dur = len * c.sd * 0.94, f = mtof(m), g = ctx.createGain(), nodes: AudioNode[] = [g];
    const end = Math.max(t + dur, t + P.a) + P.r;
    for (let i = 0; i < P.w.length; i++) {
      const k = osc(P.w[i], f * (P.mul?.[i] ?? 1), P.w.length > 1 ? (i ? P.det : -P.det) : 0);
      k.connect(g); nodes.push(k); reg(d.id, k, t, end, i ? undefined : nodes);
    }
    env(g.gain, t, P.a, v * P.v, P.dec, P.sus, t + dur, P.r);
    g.connect(d.b.bass);
    const fq = d.bassLP.frequency, top = P.lp + P.env * v * (pop ? 1.7 : 1);
    fq.setTargetAtTime(top, t, 0.004); fq.setTargetAtTime(P.lp, t + P.fa + 0.008, P.fd);
  }
  function vLead(c: Ctx, m: number, len: number, v: number, orn = '', oct = false) {
    const P = c.def.lead, d = c.d, p = c.p, t = c.t, dur = len * c.sd * (P.glide ? 1.02 : 0.92), f = mtof(m);
    const g = ctx.createGain(), nodes: AudioNode[] = [g], oscs: OscillatorNode[] = [];
    const end = Math.max(t + dur, t + P.a) + P.r;
    for (let i = 0; i < P.w.length; i++) oscs.push(osc(P.w[i], f * (P.mul?.[i] ?? 1), P.w.length > 1 ? (i ? P.det : -P.det) : 0));
    if (oct) oscs.push(osc(P.w[0], f * 2, 4));
    let from = 0, gt = P.glide || 0.06;
    if (orn.includes('^')) { from = 200; gt = 0.07; } else if (orn.includes('~')) { from = -160; gt = 0.09; } else if (P.glide && p.lm && t - p.le < c.sd * 1.2 && p.lm !== m) from = (p.lm - m) * 100;
    oscs.forEach((k, i) => {
      if (from) { const base = k.detune.value; k.detune.setValueAtTime(base + from, t); k.detune.linearRampToValueAtTime(base, t + gt); }
      k.connect(g); nodes.push(k); reg(d.id, k, t, end, i ? undefined : nodes);
    });
    env(g.gain, t, P.a, v * P.v * (oct ? 0.8 : 1), P.dec, P.sus, t + dur, P.r);
    g.connect(d.b.lead);
    const fq = d.leadLP.frequency;
    fq.setTargetAtTime(P.lp + P.env * v, t, P.fa / 2); fq.setTargetAtTime(P.lp, t + P.fa, P.fd);
    const vg = d.vibG.gain;
    vg.setTargetAtTime(0, t, 0.02);
    if (dur > 0.3) vg.setTargetAtTime(P.vib, t + Math.min(0.25, dur * 0.35), 0.12);
    p.lm = m; p.le = t + dur;
  }
  function vPad(c: Ctx, m: number, dur: number, v: number) {
    const P = c.def.pad, d = c.d, t = c.t, f = mtof(m), g = ctx.createGain(), nodes: AudioNode[] = [g], end = t + dur + P.r;
    for (let k = -1; k <= 1; k += 2) { const x = osc(P.w, f, k * P.det + hz(m, k) * 3); x.connect(g); nodes.push(x); reg(d.id, x, t, end, k < 0 ? nodes : undefined); }
    env(g.gain, t, Math.min(P.a, dur * 0.5), v * P.v, 1, 1, t + dur, P.r);
    g.connect(d.b.pad);
  }

  // ── 스텝 스크립트 도우미 ──
  const V = (ch: string | undefined) => (ch === 'X' ? 1 : ch === 'x' ? 0.72 : ch === 'g' ? 0.36 : 0);
  const hum = (c: Ctx, ms: number, salt = 0) => (hz(c.n, salt + 11) * ms) / 1000;
  function dr(c: Ctx, p: string, name: string, bus: BusK, g = 1, off = 0): number {
    const v = V(p[c.s]);
    if (v) hit(c.d.id, c.d.b[bus], name, c.t + off * c.sd, v * g);
    return v;
  }
  function kick(c: Ctx, p: string, name: string, g = 1) {
    const v = dr(c, p, name, 'k', g);
    if (v >= 0.5) duckSc(c, c.t, c.def.sc * v);
  }
  function duckSc(c: Ctx, t: number, depth: number) {
    if (depth <= 0) return;
    const g = c.d.sc.gain;
    g.setTargetAtTime(1 - depth, t, 0.004); g.setTargetAtTime(1, t + 0.03, 0.08 * (120 / c.def.bpm));
  }
  function deg(c: Ctx, tk: string, lo = c.def.bassLo, root = false): number {
    const ch = c.ch, base = lo + mod12((root ? ch.r : ch.b) - lo), above = (pc: number) => base + mod12(pc - base);
    switch (tk[0]) {
      case '8': return base + 12;
      case '5': return above(ch.r + 7);
      case 'v': return above(ch.r + 7) - 12;
      case '3': return above(ch.r + (ch.iv.includes(3) ? 3 : ch.iv.includes(4) ? 4 : 5));
      case '7': return above(ch.r + (ch.iv.includes(10) ? 10 : ch.iv.includes(11) ? 11 : 9));
      case '6': return base + 9;
      case 'f': return base + 1;
      case 'm': return base + 3;
      case 't': return base + 6;
      case 'n': case 'b': case 'a': {
        let m = base + mod12(c.nx.b - base);
        if (m - base > 6) m -= 12;
        return tk[0] === 'n' ? m : tk[0] === 'b' ? m - 1 : m + 1;
      }
      default: return base;
    }
  }
  function bassLine(c: Ctx, P: (Ev | undefined)[], v = 1) {
    const e = P[c.s];
    if (!e) return;
    const fl = e.tok.slice(1), ghost = fl.includes('g'), acc = fl.includes('*');
    vBass(c, deg(c, e.tok), ghost ? Math.min(1, e.len) : e.len, v * (ghost ? 0.5 : acc ? 1 : 0.84), acc);
  }
  function leadLine(c: Ctx, arr: (Mel | undefined)[] | undefined, v = 1, oct = false, tr = 0) {
    const e = arr?.[c.B.off + c.s];
    if (e) vLead(c, e.m + tr, e.len, v * (e.o.includes('*') ? 1.15 : 1), e.o, oct);
  }
  /** 화음 구성음을 lo부터 위로 i번째 */
  function tone(ch: Ch, lo: number, i: number): number {
    for (let m = lo, k = -1; m < lo + 48; m++) if ((ch.mask >> (m % 12)) & 1) { if (++k === i) return m; }
    return lo;
  }
  const accent = (s: number, spb: number) => (s % (spb * 2) === 0 ? 1 : s % spb === 0 ? 0.86 : s % 2 === 0 ? 0.74 : 0.62);
  function pad(c: Ctx, v = 1) { if (c.chg) for (const m of c.ch.pad) vPad(c, m, c.ch.hold * c.sd, v); }
  function rhodes(c: Ctx, notes: number[], len: number, v: number, strum = 0.012) {
    for (let i = 0; i < notes.length; i++) vRhodes(c.d.id, c.d.b.keys, c.t + i * strum + hum(c, 4, i), notes[i], len * c.sd, v * (0.92 + 0.08 * hz(c.n, i + 5)));
  }
  function chord(c: Ctx, notes: number[], len: number, v: number, S: SynP, bus: BusK = 'keys', strum = 0) {
    for (let i = 0; i < notes.length; i++) vSyn(c.d.id, c.d.b[bus], c.t + i * strum, notes[i], len * c.sd, v, S);
  }
  const phraseEnd = (c: Ctx, n: number) => c.B.bi % n === n - 1 || c.B.last;
  function crash(c: Ctx, v = 0.55) { hit(c.d.id, c.d.b.s, 'crash', c.t, (v * 1.1) / c.def.mix.s); }
  /** 다음 마디 첫 박에 맞춰 끝나는 라이저(잡음 스윕 + 역재생 심벌) */
  function riser(c: Ctx, dur: number, v = 0.3) {
    const end = c.t + dur;
    sweep(c.d.id, c.d.b.fx, c.t, dur, 350, 7000, v * 0.45);
    hit(c.d.id, c.d.b.fx, 'rev', c.t, v * 0.6, 1, end);
  }
  /** 스네어 빌드업: from 스텝부터 16분 → 마지막 박은 32분, 점점 세게 */
  function snareBuild(c: Ctx, name: string, from: number, v0: number, v1: number) {
    if (c.s < from) return;
    const k = (c.s - from) / Math.max(1, c.spbar - 1 - from), v = v0 + (v1 - v0) * k;
    hit(c.d.id, c.d.b.s, name, c.t, v);
    if (c.s >= c.spbar - c.def.spb) hit(c.d.id, c.d.b.s, name, c.t + c.sd / 2, v * 0.85);
  }
  function tomFill(c: Ctx, from: number, v = 0.7) {
    if (c.s < from) return;
    const k = Math.floor(((c.s - from) / (c.spbar - from)) * 4);
    const nm = ['tom.h', 'tom.m', 'tom.l', 'tom.l'][k];
    hit(c.d.id, c.d.b.s, nm, c.t, (0.5 / c.def.mix.s) * v * (c.s & 1 ? 0.85 : 1));   // 탐은 스네어 버스 레벨과 무관한 크기
  }
  function toneSweep(c: Ctx, f0: number, f1: number, dur: number) {
    const q = c.d.tone.frequency;
    q.setValueAtTime(f0, c.t); q.exponentialRampToValueAtTime(f1, c.t + dur);
  }

  // ───────────── 곡별 편곡(스텝마다 호출) ─────────────
  const SCRIPT: Record<TrackId, (c: Ctx) => void> = {
    title(c) {
      const { s, lv, B, d } = c, brk = B.sec.f === 'brk';
      if (c.nb % 2 === 0 && s === 0) { loopFx(d.id, d.b.fx, 'crackle', c.t, c.bar * 2, 0.2); hiss(d.id, d.b.fx, c.t, c.bar * 2, 0.012); }
      pad(c, 0.9);
      const cp = (brk ? TI.compC : B.ch.length > 1 ? TI.comp2 : TI.comp1)[s];
      if (cp) rhodes(c, c.ch.keys, cp.len, cp.tok === 'X' ? 0.7 : 0.48, 0.014);
      bassLine(c, brk ? TI.bassC : B.ch.length > 1 ? TI.bass2 : TI.bass1, 0.85);
      if (c.intro) { leadLine(c, B.mel, 0.8); return; }
      if (lv >= 1) {
        const odd = c.nb & 1;
        if (!brk) kick(c, odd ? TI.kB : TI.kA, 'k.lofi', 0.9);
        dr(c, odd ? TI.sB : TI.sA, brk ? 'rim' : 's.brush', 's', brk ? 0.45 : 0.62);
        dr(c, TI.hh, 'h.soft', 'r', 0.4 * (0.85 + 0.15 * hz(c.n, 3)));
        if (lv >= 3) dr(c, TI.shk, 'shk', 'l', 0.28);
        if (!brk && phraseEnd(c, 4) && s >= 13) hit(d.id, d.b.s, 's.brush', c.t, 0.22 + (s - 13) * 0.08);
        if (B.bi === 0 && s === 0 && B.sec.n === 'B') crash(c, 0.4);
      }
      if (lv >= 2) {
        leadLine(c, B.mel, 0.82);
        const e = B.alt?.[B.off + s];
        if (e) vRhodes(d.id, d.b.keys, c.t, e.m, e.len * c.sd, 0.62);
      }
      if (lv >= 3) { const e = B.mel?.[B.off + s]; if (e) vBell(d.id, d.b.pluck, c.t, e.m + 12, e.len * c.sd, 0.035, 2, 1.1); }
    },

    office(c) {
      const { s, lv, B, d } = c, n = B.sec.n, brk = B.sec.f === 'brk';
      pad(c, brk ? 1.1 : 0.9);
      if (brk && s === 0 && B.bi === 0) toneSweep(c, 18000, 650, c.bar * 1.5);
      if (brk && s === 0 && B.bi === 2) toneSweep(c, 650, 18000, c.bar * 2 - 0.02);
      if (c.intro) {
        if (lv >= 1) { snareBuild(c, 's.funk', 0, 0.2, 0.75); if (s === 0) riser(c, c.bar, 0.35); }
        return;
      }
      bassLine(c, brk ? OF.bassBR : n === 'B' ? OF.bassB : OF.bassA, 0.9);
      if (lv >= 1) {
        if (!brk) { kick(c, n === 'B' && c.nb & 1 ? OF.kB : OF.k, 'k.funk', 1); dr(c, OF.cl, 'clap', 's', 0.75); }
        dr(c, lv >= 2 && !brk ? OF.hc2 : OF.hc, 'h.c', 'r', 0.42 * accent(s, 4));
        dr(c, OF.ho, 'h.o', 'l', brk ? 0.25 : 0.34);
        const e = (n === 'B' ? OF.stabB : OF.stab)[s];
        if (e && !brk) chord(c, c.ch.keys.slice(1), e.len * 0.6, e.tok === 'X' ? 0.1 : 0.075, S_STAB, 'keys', 0.004);
        if (!brk && phraseEnd(c, 8) && s >= 8) tomFill(c, 8, 0.62);
        else if (!brk && phraseEnd(c, 4) && s >= 12) hit(d.id, d.b.s, 's.funk', c.t, 0.3 + (s - 12) * 0.12);
        if (brk && B.last) snareBuild(c, 's.funk', 4, 0.15, 0.7);
        if (brk && B.last && s === 0) riser(c, c.bar, 0.35);
        if (lv >= 2 && B.bi === 0 && s === 0 && !brk) crash(c, 0.5);
      }
      if (lv >= 2) {
        if (!brk) dr(c, OF.gh, 's.funk', 's', 0.28);
        const i = OF.arp[s];
        vSyn(d.id, d.b.pluck, c.t, tone(c.ch, 62, i), c.sd * 0.9, 0.075 * accent(s, 4), S_ARP);
        if (!brk) leadLine(c, B.mel, 0.9, lv >= 3);
      } else if (lv === 1 && n === 'B') leadLine(c, B.mel, 0.75);
      if (lv >= 3 && !brk) { dr(c, OF.tamb, 'tamb', 'l', 0.4); dr(c, OF.shk, 'shk', 'r', 0.24); if (phraseEnd(c, 4) && s === 0 && B.bi > 0) crash(c, 0.3); }
    },

    crunch(c) {
      const { s, lv, B, d } = c, brk = B.sec.f === 'brk';
      pad(c, brk ? 1.15 : 1);
      if (c.intro) {
        bassLine(c, CR.b8, 0.8);
        if (lv >= 1) { snareBuild(c, 's.gate', 8, 0.25, 0.8); if (s === 0) riser(c, c.bar, 0.35); }
        return;
      }
      bassLine(c, brk ? CR.bBR : lv >= 1 ? CR.b16 : CR.b8, 0.9);
      if (lv >= 1) {
        if (!brk) { kick(c, lv >= 3 ? CR.k3 : lv >= 2 ? CR.k2 : CR.k1, 'k.synth', 1); dr(c, CR.sn, 's.gate', 's', 0.75); }
        else if (s === 0) kick(c, 'X', 'k.synth', 0.7);
        dr(c, lv >= 2 && !brk ? CR.h16 : CR.h8, 'h.c', 'r', 0.36 * accent(s, 4));
        if (lv >= 3) dr(c, CR.ho, 'h.o', 'l', 0.3);
        if (!brk && phraseEnd(c, 8) && s >= 8) tomFill(c, 8, 0.7);
        else if (!brk && phraseEnd(c, 4) && s >= 12) hit(d.id, d.b.s, 's.gate', c.t, 0.3 + (s - 12) * 0.12);
        if (brk && B.last) { snareBuild(c, 's.gate', 0, 0.12, 0.7); if (s === 0) riser(c, c.bar, 0.4); }
        if (lv >= 2 && B.bi === 0 && s === 0 && !brk) crash(c, 0.55);
      }
      if (lv >= 2 || (lv === 1 && !(s & 1))) vSyn(d.id, d.b.pluck, c.t, tone(c.ch, 57, CR.arp[s]), c.sd * (lv >= 2 ? 0.85 : 1.6), (lv >= 2 ? 0.07 : 0.06) * accent(s, 4), S_ARPC);
      if (lv >= 2) leadLine(c, B.mel, 0.9, lv >= 3);
      else if (lv === 1 && B.sec.n === 'B') leadLine(c, B.mel, 0.75);
      if (lv >= 3 && !brk && phraseEnd(c, 4) && s === 0 && B.bi > 0) crash(c, 0.3);
    },

    dinner(c) {
      const { s, lv, B, d } = c, n = B.sec.n, stop = B.sec.f === 'stop';
      pad(c, stop ? 0.6 : 0.9);
      if (c.intro) {
        if (lv >= 1) { snareBuild(c, 's.trot', 8, 0.3, 0.8); if (s === 0) crash(c, 0.35); }
        leadLine(c, B.mel, 0.95);
        return;
      }
      bassLine(c, stop ? DI.bStop : n === 'B' && lv >= 2 ? DI.bOct : DI.b2, 0.9);
      if (lv >= 1) {
        if (stop) {
          kick(c, DI.stop, 'k.trot', 1); dr(c, DI.stop, 's.trot', 's', 0.7);
          if (s === 0 && B.bi === 0) crash(c, 0.5);
          if (B.last) snareBuild(c, 's.trot', 12, 0.35, 0.8);
        } else {
          kick(c, DI.k, 'k.trot', 1); dr(c, DI.sn, 's.trot', 's', 0.72);
          dr(c, DI.ho, 'h.o', 'l', 0.3); if (lv >= 2) dr(c, DI.hc, 'h.c', 'r', 0.3);
          const e = DI.org[s];
          if (e) chord(c, c.ch.keys.slice(1), e.len * 0.55, 0.075, S_ORGAN);
          if (phraseEnd(c, 8) && s >= 8) snareBuild(c, 's.trot', 8, 0.35, 0.8);
          else if (phraseEnd(c, 4) && s >= 12) hit(d.id, d.b.s, 's.trot', c.t, 0.35 + (s - 12) * 0.12);
          if (lv >= 2 && B.bi === 0 && s === 0) crash(c, 0.45);
        }
        if (stop) leadLine(c, B.mel, 0.95, lv >= 3);
      }
      if (!stop && (lv >= 2 || (lv === 1 && n === 'B'))) leadLine(c, B.mel, lv >= 2 ? 0.9 : 0.8, lv >= 3);
      if (lv >= 3 && !stop) { dr(c, DI.tamb, 'tamb', 'r', 0.36); if (!B.mel?.[B.off + s] && s % 4 === 2 && B.bi % 2) vSyn(d.id, d.b.pluck, c.t, tone(c.ch, 74, (s >> 2) % 3), c.sd * 1.5, 0.09, S_BRASS); }
    },

    holiday(c) {
      const { s, lv, B, d } = c, trad = B.sec.f === 'trad';
      pad(c, trad ? 1.1 : 0.9);
      const secStart = B.bi === 0 && s === 0;
      if (c.intro) {
        if (c.nb === 0 && s === 0) hit(d.id, d.b.s, 'jing', c.t, 0.55);
        const e = B.mel?.[B.off + s];
        if (e) vKS(d.id, d.b.pluck, c.t, e.m, e.len * c.sd, 0.62, e.o);
        if (c.nb === 1 && lv >= 1) { const ch = HO.fill[s]; if (s >= 6) jang(c, ch, 0.8); }
        return;
      }
      bassLine(c, HO.bass, 0.85);
      if (lv >= 1) {
        // 장구: 자진모리(마지막 마디는 굿거리풍 채움)
        jang(c, (phraseEnd(c, 4) ? HO.fill : HO.jang)[s], trad ? 0.9 : 0.72);
        if (!trad) {
          kick(c, lv >= 3 ? HO.k3 : HO.k1, 'k.gugak', 0.95); dr(c, HO.cl, 'clap', 's', 0.6);
          if (lv >= 2) dr(c, HO.hat, 'h.c', 'r', 0.3 * accent(s, 3));
          const e = HO.ost[s];
          if (e && !((lv >= 2 || B.sec.n === 'B') && B.mel?.[B.off + s])) vKS(d.id, d.b.pluck, c.t, deg(c, e.tok, 45, true), e.len * c.sd, 0.34 * accent(s, 3));
        }
        if (secStart && (lv >= 2 || trad || B.sec.n === 'A')) hit(d.id, d.b.s, 'jing', c.t, 0.42);
      }
      if (lv >= 2 || trad || (lv === 1 && B.sec.n === 'B')) {
        const e = B.mel?.[B.off + s];
        if (e) vKS(d.id, d.b.pluck, c.t, e.m, e.len * c.sd, 0.66, e.o);
      }
      if (lv >= 3) {
        if (!trad) { leadLine(c, B.mel, 0.85, false, -12); dr(c, HO.kkw, 'kkw', 'l', 0.18); }
        if (secStart && !trad) crash(c, 0.35);
      }
    },

    boss(c) {
      const { s, lv, B, d } = c, n = B.sec.n, stop = B.sec.f === 'stop';
      pad(c, 0.85);
      if (c.intro) {
        bassLine(c, BO.riffS, 0.9);
        if (lv >= 1) { snareBuild(c, 's.boss', 0, 0.15, 0.85); if (s === 0) riser(c, c.bar, 0.4); }
        return;
      }
      if (stop) {
        if (!B.last) {
          if (s === 0) { kick(c, 'X', 'k.boss', 1); crash(c, 0.5); chord(c, c.ch.keys, 3, 0.09, S_BRASS, 'keys'); }
          bassLine(c, BO.riffS, 1);
          if (lv >= 1 && s >= 8) hit(d.id, d.b.s, 's.boss', c.t, 0.12 + (s - 8) * 0.03);
        } else if (lv >= 1) { snareBuild(c, 's.boss', 0, 0.3, 0.9); if (s === 0) riser(c, c.bar, 0.45); kick(c, BO.k, 'k.boss', 0.8); }
        return;
      }
      bassLine(c, n === 'B' ? BO.riffB : BO.riffA, 0.95);
      if (lv >= 1) {
        kick(c, lv >= 3 ? (n === 'B' ? BO.kB3 : BO.k3) : BO.k, 'k.boss', 1);
        dr(c, BO.sn, 's.boss', 's', 0.78);
        dr(c, lv >= 2 ? BO.h16 : BO.h8, 'h.c', 'r', 0.36 * accent(s, 4));
        dr(c, BO.ho, 'h.o', 'l', 0.3);
        if (phraseEnd(c, 8)) snareBuild(c, 's.boss', 8, 0.3, 0.9);
        else if (phraseEnd(c, 4) && s >= 12) { hit(d.id, d.b.s, 's.boss', c.t, 0.45 + (s - 12) * 0.12); hit(d.id, d.b.s, 's.boss', c.t + c.sd / 2, 0.4 + (s - 12) * 0.1); }
        if (B.bi % 4 === 0 && s === 0 && (lv >= 2 || B.bi === 0)) crash(c, 0.5);
        if (c.chg && lv >= 2) chord(c, c.ch.keys, 2, 0.07, S_BRASS, 'keys');
      }
      if (lv >= 2) { const e = BO.ost[s]; if (e) vSyn(d.id, d.b.pluck, c.t, deg(c, e.tok, 52), c.sd * 0.8, 0.065 * accent(s, 4), S_OST); }
      if (lv >= 3) leadLine(c, B.mel, 0.9);
    },

    overtime(c) {
      const { s, lv, B, d, n } = c, sec = B.sec.n, brk = sec === 'BR', bld = sec === 'BL';
      pad(c, brk ? 1.2 : 0.9);
      // 시퀀스 필터: 섹션을 따라 천천히 열린다(최면적 움직임)
      if (s === 0) {
        const base = sec === 'A' ? 380 : sec === 'B' ? 700 : sec === 'C' ? 1300 : brk ? 2400 : 900;
        d.pluckLP.frequency.setTargetAtTime(base * (1 + 0.35 * Math.sin((c.nb / 8) * Math.PI * 2)), c.t, c.bar * 0.6);
      }
      if (!brk) bassLine(c, sec === 'C' || bld ? OT.bassR : OT.bass, 0.95);
      if (lv >= 1) {
        if (!brk && !(bld && B.bi < 2)) kick(c, OT.k, 'k.techno', 1);
        if (!bld || B.bi < 2) dr(c, OT.hc, 'h.c', 'r', (brk ? 0.2 : 0.3) * (0.7 + 0.3 * hz(n, 7)));
        if (!brk) dr(c, OT.ho, 'h.o', 'l', 0.28);
        if (lv >= 2 && !brk && !bld) dr(c, OT.cl, 'clap.big', 's', 0.55);
        if (lv >= 2 && !brk && !bld && phraseEnd(c, 8) && s >= 13) hit(d.id, d.b.s, 'clap', c.t, 0.25 + (s - 13) * 0.1);
        if (bld) snareBuild(c, 'clap', B.bi < 2 ? 12 : B.bi === 2 ? 4 : 0, 0.1 + B.bi * 0.08, 0.55 + B.bi * 0.08);
        if (bld && B.last && s === 0) riser(c, c.bar, 0.45);
        if (brk && B.bi === 0 && s === 0) toneSweep(c, 18000, 900, c.bar);
        if (brk && B.last && s === 0) toneSweep(c, 900, 18000, c.bar * 5 - 0.02);
        if (sec === 'A' && B.bi === 0 && s === 0 && c.nb > 0) { crash(c, 0.45); hit(d.id, d.b.k, 'sub', c.t, 0.5); }
      }
      if (lv >= 2) {
        // 3박 주기 시퀀스(16분 격자 위의 폴리미터) + 3:4 림샷
        if (n % 3 === 0 || (sec === 'C' && n % 3 === 2)) {
          const k = Math.floor(n / 3) % OT.seq.length;
          vSyn(d.id, d.b.pluck, c.t, 53 + OT.seq[k], c.sd * 1.2, 0.08 * (s === 0 ? 1.2 : 1), S_SEQ);   // F 페달 위(화음이 바뀌어도 구성음)
        }
        if (!brk && n % 3 === 1 && sec !== 'A') hit(d.id, d.b.r, 'rim', c.t, 0.2);
      }
      if (lv >= 3) {
        const e = OT.stab[s];
        if (e && !brk && B.bi % 2 === 1) chord(c, c.ch.keys, 2, 0.06, S_DUB);
        const bl = (c.nb & 3) === 0 ? OT.bell1 : (c.nb & 3) === 2 ? OT.bell2 : null;
        const be = bl?.[s];
        if (be) vBell(d.id, d.b.lead, c.t, be.m, be.len * c.sd * 2, 0.07, 3.5, 1.6);
        if (!brk) dr(c, OT.shk, 'shk', 'l', 0.2);
      }
    },
  };
  /** 장구 한 스텝: D 덩(양편) · K 쿵(궁편) · T 덕(채편) · g 기덕(꾸밈음+덕) · r 더러러러(굴림) */
  function jang(c: Ctx, ch: string | undefined, v: number) {
    const d = c.d, t = c.t;
    if (!ch || ch === '.') return;
    if (ch === 'D' || ch === 'K') hit(d.id, d.b.s, 'jg.kung', t, v * (ch === 'D' ? 1 : 0.85));
    if (ch === 'D' || ch === 'T') hit(d.id, d.b.r, 'jg.deok', t, v * 0.8);
    if (ch === 'g') { hit(d.id, d.b.r, 'jg.deok', t - c.sd * 0.33, v * 0.35); hit(d.id, d.b.r, 'jg.deok', t, v * 0.75); }
    if (ch === 'r') for (let k = 0; k < 3; k++) hit(d.id, d.b.r, 'jg.deok', t + (k * c.sd) / 3, v * (0.35 + 0.12 * k));
  }

  // ───────────── 스케줄러 ─────────────
  let want: TrackId = 'title';
  let level = 0, pendLv = -1;
  let pendTrack: TrackId | null = null;
  let playing = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let cur: Play | null = null, lastDeck = 1;
  const C = {} as Ctx;

  function config(d: Deck, def: TrackDef, T: number) {
    const set = (p: AudioParam, v: number) => { p.cancelScheduledValues(T); p.setValueAtTime(v, T); };
    const M = def.mix;
    set(d.b.k.gain, M.k); set(d.b.s.gain, M.s); set(d.b.l.gain, M.h); set(d.b.r.gain, M.h);
    set(d.b.bass.gain, 1); set(d.bassOut.gain, (M.bass * Math.tanh(def.drive)) / def.drive);
    set(d.b.pad.gain, M.pad); set(d.b.keys.gain, M.keys); set(d.b.pluck.gain, M.pluck); set(d.b.lead.gain, M.lead); set(d.b.fx.gain, M.fx);
    const R = def.rev, D = def.dly;
    set(d.snd.s.gain, R.s ?? 0); set(d.snd.hl.gain, R.h ?? 0); set(d.snd.hr.gain, R.h ?? 0); set(d.snd.pad.gain, R.pad ?? 0);
    set(d.snd.keys.gain, R.keys ?? 0); set(d.snd.pluck.gain, R.pluck ?? 0); set(d.snd.lead.gain, R.lead ?? 0); set(d.snd.fx.gain, R.fx ?? 0);
    set(d.snd.keysD.gain, D.keys ?? 0); set(d.snd.pluckD.gain, D.pluck ?? 0); set(d.snd.leadD.gain, D.lead ?? 0);
    set(d.tone.frequency, def.tone); set(d.wobG.gain, def.wob); set(d.fltG.gain, def.wob * 0.045);
    set(d.bassLP.frequency, def.bass.lp); d.bassLP.Q.value = def.bass.q;
    d.shaper.curve = curve(def.drive); d.shaper.oversample = def.drive > 2 ? '2x' : 'none';
    set(d.bassPost.frequency, def.post);
    set(d.padLP.frequency, def.pad.lp); d.padLP.Q.value = def.pad.q;
    set(d.leadLP.frequency, def.lead.lp); d.leadLP.Q.value = def.lead.q; set(d.vibG.gain, 0);
    set(d.pluckLP.frequency, def.pluck[0]); if ((d.pluckPan as StereoPannerNode).pan) set((d.pluckPan as StereoPannerNode).pan, def.pluck[1]);
    set(d.apG.gain, def.ap); set(d.sc.gain, 1);
    d.link(true); d.idleAt = Infinity;
    for (const g of [d.fade.gain, d.revF.gain, d.dlyF.gain]) { g.cancelScheduledValues(T); g.setValueAtTime(0, T); g.linearRampToValueAtTime(def.vol, T + 0.03); }
    const dt = (def.dlyT * 60) / def.bpm;
    dL.delayTime.setTargetAtTime(dt, T, 0.04); dR.delayTime.setTargetAtTime(dt, T, 0.04);
  }
  function fadeOut(d: Deck, T: number, tau: number) {
    for (const g of [d.fade.gain, d.revF.gain, d.dlyF.gain]) { g.cancelScheduledValues(T); g.setTargetAtTime(0, T, tau); }
    cut(d.id, T + tau * 7);
    d.idleAt = T + tau * 7 + 0.1;
  }
  function switchTo(id: TrackId, T: number) {
    const def = TRACKS[id], d = decks[1 - (cur ? cur.d.id : lastDeck)];
    lastDeck = d.id;
    if (cur) fadeOut(cur.d, T, 0.2);
    cut(d.id, T);
    config(d, def, T);
    cur = { id, def, bt: buildTrack(id), d, t0: T, n: 0, sd: 60 / def.bpm / def.spb, lm: 0, le: -1, lastLv: level };
  }
  function barAt(p: Play, nb: number): Bar {
    const bt = p.bt;
    return nb < bt.intro.length ? bt.intro[nb] : bt.loop[(nb - bt.intro.length) % bt.loop.length];
  }
  function playStep(p: Play, tn: number) {
    const def = p.def, spbar = def.spb * 4, nb = Math.floor(p.n / spbar), s = p.n % spbar;
    const B = barAt(p, nb), half = B.ch.length > 1 && s >= spbar / 2 ? 1 : 0, ch = B.ch[half];
    const lv = Math.max(level, def.minLv);
    const c = C;
    c.p = p; c.d = p.d; c.def = def; c.sd = p.sd; c.s = s; c.spbar = spbar; c.nb = nb; c.n = p.n; c.bar = p.sd * spbar;
    c.t = tn + (def.spb === 4 && s & 1 ? def.swing * p.sd : 0) + (def.hum ? hum(c, def.hum, 1) : 0);
    c.B = B; c.lv = lv; c.intro = nb < p.bt.intro.length; c.ch = ch;
    c.nx = half === 0 && B.ch.length > 1 ? B.ch[1] : barAt(p, nb + 1).ch[0];
    c.chg = ch.first && s === half * (spbar / 2);
    // 강도가 올라간 마디 첫 박에는 크래시
    if (s === 0) { if (lv > p.lastLv && lv >= 2 && !c.intro) crash(c, 0.4); p.lastLv = lv; }
    // 패드 필터가 8마디 주기로 천천히 열렸다 닫힌다
    if (s === 0) p.d.padLP.frequency.setTargetAtTime(def.pad.lp * (1 + def.pad.mod * Math.sin((nb * Math.PI) / 4)), c.t, c.bar * 0.6);
    SCRIPT[p.id](c);
  }

  function scheduleRange(from: number, to: number) {
    if (!playing) return;
    const muted = core.music.gain.value < 0.0005;
    for (let guard = 0; cur && guard < 20000; guard++) {
      const p: Play = cur, spbar = p.def.spb * 4, tn = p.t0 + p.n * p.sd;
      if (tn >= to) break;
      const barLen = p.sd * spbar;
      if (p.n % spbar === 0 && pendLv >= 0) { level = pendLv; pendLv = -1; }
      if (pendTrack && (p.n % spbar === 0 || (barLen > 1.6 && p.n % (spbar / 2) === 0))) {
        if (pendLv >= 0) { level = pendLv; pendLv = -1; }
        const id = pendTrack; pendTrack = null;
        switchTo(id, tn);
        continue;
      }
      // 타이머가 밀렸으면(탭 숨김·긴 프레임) 지난 음은 몰아서 내지 않고 건너뛴다
      if (tn >= from - 0.012 && !muted) playStep(p, Math.max(tn, from));
      p.n++;
    }
  }

  function tick() {
    if (!playing) return;
    const now = ctx.currentTime, v = core.music.gain.value;
    if (Math.abs(wetRev.gain.value - v) > 0.002) wetRev.gain.setTargetAtTime(v, now, 0.05);
    prune(now);
    for (const d of decks) if (now > d.idleAt) { d.link(false); d.idleAt = Infinity; }
    scheduleRange(now, now + AHEAD);
    warm(cur?.id === 'title' ? 8 : 3);           // 메뉴에서는 조금 더 많이
  }

  // ───────────── 스팅어 ─────────────
  let lvT = -10, lvN = 0, duckEnd = -1, duckAmt = 1;
  function duckBed(t: number, amt: number, dur: number) {
    if (t < duckEnd && amt > duckAmt) return;          // 더 깊은 덕킹이 진행 중이면 유지
    duckEnd = t + dur; duckAmt = amt;
    for (const g of [bed.gain, bedRev.gain, bedDly.gain]) { g.cancelScheduledValues(t); g.setTargetAtTime(amt, t, 0.04); g.setTargetAtTime(1, t + dur, 0.35); }
  }
  function chordNow(): Ch | null {
    const p = cur;
    if (!p || !playing) return null;
    const spbar = p.def.spb * 4, n = Math.max(0, Math.floor((ctx.currentTime - p.t0) / p.sd)), B = barAt(p, Math.floor(n / spbar));
    return B.ch[B.ch.length > 1 && n % spbar >= spbar / 2 ? 1 : 0];
  }
  function stinger(id: StingerId) {
    const t = ctx.currentTime + 0.03, maj = cur ? cur.def.maj : 0, tr = mod12(maj + 6) - 6;
    switch (id) {
      case 'levelup': {
        if (t - lvT < 0.28) return;
        lvN = t - lvT < 4 ? Math.min(3, lvN + 1) : 0; lvT = t;
        const ch = chordNow(), mask = ch ? ch.mask : 0b10010001;
        const C0 = { mask } as Ch;
        const lo = 72 + lvN * 2;
        for (let k = 0; k < 4; k++) {
          const m = tone(C0, lo, k + (k === 3 ? 1 : 0));
          vBell(2, sDry, t + k * 0.055, m, 0.55 - k * 0.05, 0.2 + k * 0.03, 2, 1.1, sRev);
        }
        vBell(2, sDry, t + 0.22, tone(C0, lo + 12, 1), 0.7, 0.09, 3.01, 0.8, sDly);
        duckBed(t, 0.78, 0.35);
        break;
      }
      case 'lunch': {
        const seq = ['E5', 'C5', 'D5', 'G4', 'G4', 'D5', 'E5', 'C5'];
        seq.forEach((nm, i) => {
          const at = t + i * 0.34 + (i >= 4 ? 0.12 : 0), m = nn(nm) + tr;
          vBell(2, sDry, at, m, 1.6, 0.27, 3.5, 1.3, sRev);
          vBell(2, sDry, at, m - 12, 1.2, 0.15, 1, 0.6);
        });
        duckBed(t, 0.45, 2.9);
        break;
      }
      case 'victory': {
        hit(2, sDry, 's.funk', t, 0.45); hit(2, sDry, 's.funk', t + 0.09, 0.55); hit(2, sDry, 'tom.m', t + 0.18, 0.6); hit(2, sDry, 'tom.l', t + 0.27, 0.65);
        const st1 = [65, 69, 72, 76], big = [64, 67, 71, 74, 79];
        for (const at of [t + 0.36, t + 0.54]) {
          for (const m of st1) vSyn(2, sDry, at, m + tr, 0.13, 0.085, S_BRASS, sRev);
          vSyn(2, sDry, at, 43 + tr, 0.14, 0.22, S_BASS);
        }
        const T = t + 0.84;
        hit(2, sDry, 'k.funk', T, 0.9); hit(2, sDry, 'crash', T, 0.6); hit(2, sRev, 'crash', T, 0.3);
        for (const m of big) vSyn(2, sDry, T, m + tr, 1.9, 0.075, S_BRASS, sRev);
        for (const m of big) vRhodes(2, sDry, T + 0.01, m + tr - 12, 2.2, 0.55, sRev);
        vSyn(2, sDry, T, 36 + tr, 2, 0.26, S_BASS); vSyn(2, sDry, T, 48 + tr, 2, 0.1, S_BASS);
        [72, 76, 79, 83, 86, 88, 91].forEach((m, i) => vRhodes(2, sDry, T + 0.08 + i * 0.06, m + tr, 1.2, 0.45, sDly));
        [91, 95, 98].forEach((m, i) => vBell(2, sDry, T + 0.55 + i * 0.09, m + tr, 1.2, 0.03, 2, 1, sRev));
        duckBed(t, 0.22, 3.3);
        break;
      }
      case 'defeat': {
        // 슬픈 로즈: IV → iv → I, 끝에서 테이프가 멈추듯 음이 가라앉는다
        const cs: [number, number[], number, number, number][] = [[0, [57, 60, 64], 69, 41, 1.1], [1.1, [56, 60, 62], 68, 41, 1.2], [2.3, [55, 59, 64], 67, 36, 1.7]];
        for (const [at, ns, top, bs, dur] of cs) {
          for (let i = 0; i < ns.length; i++) vRhodes(2, sTape, t + at + i * 0.02, ns[i] + tr, dur, 0.5, sRev);
          vRhodes(2, sTape, t + at + 0.07, top + tr, dur, 0.68, sRev);
          vRhodes(2, sTape, t + at, bs + tr, dur, 0.6);
        }
        const dt = sTape.delayTime, g = sTapeG.gain, curveT = new Float32Array(32);
        for (let k = 0; k < 32; k++) curveT[k] = 0.26 * Math.pow(k / 31, 3);
        try {
          dt.cancelScheduledValues(t); dt.setValueAtTime(0, t); dt.setValueCurveAtTime(curveT, t + 2.55, 1.35); dt.setValueAtTime(0, t + 4.3);
          g.cancelScheduledValues(t); g.setValueAtTime(TAPE, t); g.setValueAtTime(TAPE, t + 2.9); g.linearRampToValueAtTime(0, t + 3.9); g.setValueAtTime(TAPE, t + 4.3);
        } catch { /* 앞선 테이프 스톱이 아직 진행 중: 음은 그대로 둔다 */ }
        duckBed(t, 0.18, 3.8);
        break;
      }
      case 'evolve': {
        // 라이저 → ♭VI – ♭VII – I (영웅 종지)
        const k0 = 60 + tr;
        sweep(2, sDry, t, 1.1, 400, 7000, 0.14); hit(2, sDry, 'rev', t, 0.3, 1, t + 1.1);
        for (let i = 0; i < 16; i++) { const at = t + 1.1 * (1 - Math.pow(1 - i / 16, 1.3)); hit(2, sDry, 's.funk', at, 0.12 + 0.5 * (i / 16)); }
        const rs = [osc('sawtooth', mtof(k0 - 12), -10), osc('sawtooth', mtof(k0 - 12), 10)], rg = gain(0), rl = biquad('lowpass', 400, 4);
        for (const o of rs) { o.frequency.setValueAtTime(mtof(k0 - 12), t); o.frequency.exponentialRampToValueAtTime(mtof(k0 + 12), t + 1.1); o.connect(rl); }
        rl.frequency.setValueAtTime(400, t); rl.frequency.exponentialRampToValueAtTime(5000, t + 1.1);
        rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(0.06, t + 1.0); rg.gain.linearRampToValueAtTime(0, t + 1.15);
        rl.connect(rg); rg.connect(sDry);
        reg(2, rs[0], t, t + 1.2, [rs[0], rs[1], rl, rg]); reg(2, rs[1], t, t + 1.2);
        const hits: [number, number[], number, number][] = [[1.1, [56, 60, 63, 68], 32, 0.2], [1.35, [58, 62, 65, 70], 34, 0.2], [1.6, [60, 64, 67, 74, 72], 36, 1.8]];
        for (const [at, ns, bs, dur] of hits) {
          for (const m of ns) { vSyn(2, sDry, t + at, m + tr, dur, 0.07, S_BRASS, sRev); vSyn(2, sDry, t + at, m + tr + 12, dur, 0.03, S_SAW, sRev); }
          vSyn(2, sDry, t + at, bs + tr, dur, 0.25, S_BASS);
          hit(2, sDry, 'k.boss', t + at, dur > 1 ? 0.9 : 0.6);
        }
        hit(2, sDry, 'crash', t + 1.6, 0.65); hit(2, sDry, 'sub', t + 1.6, 0.55);
        [84, 88, 91, 96].forEach((m, i) => vBell(2, sDry, t + 1.66 + i * 0.07, m + tr, 1.2, 0.035, 2, 1, sRev));
        duckBed(t, 0.35, 2.4);
        break;
      }
      case 'bossIntro': {
        // 저음 브라스(E → F 반음 긴장) + 경보
        hit(2, sDry, 'sub', t, 0.7); hit(2, sDry, 'k.boss', t, 0.9); hit(2, sDry, 'crash', t, 0.4);
        for (const m of [28, 40, 47]) vSyn(2, sDry, t, m, 0.95, 0.12, S_BRASSLO, sRev);
        for (const m of [29, 41, 48]) vSyn(2, sDry, t + 1.0, m, 1.3, 0.13, S_BRASSLO, sRev);
        hit(2, sDry, 'tom.l', t + 1.0, 0.8); hit(2, sDry, 'tom.l', t + 1.25, 0.55); hit(2, sDry, 'sub', t + 1.0, 0.45);
        const a = osc('square', 988), af = biquad('bandpass', 1400, 2.5), ag = gain(0);
        for (let k = 0; k < 11; k++) {
          const at = t + 0.12 + k * 0.2;
          a.frequency.setValueAtTime(k % 2 ? 698 : 988, at);
          ag.gain.setValueAtTime(0, at); ag.gain.linearRampToValueAtTime(0.05, at + 0.01); ag.gain.setValueAtTime(0.05, at + 0.17); ag.gain.linearRampToValueAtTime(0, at + 0.19);
        }
        a.connect(af); af.connect(ag); ag.connect(sDry); ag.connect(sRev);
        reg(2, a, t, t + 2.45, [a, af, ag]);
        duckBed(t, 0.25, 2.4);
        break;
      }
    }
  }

  return {
    start() {
      if (playing) return;
      playing = true;
      const T = ctx.currentTime + 0.05;
      duckEnd = -1; duckAmt = 1;
      for (const g of [bed.gain, bedRev.gain, bedDly.gain, sDry.gain]) { g.cancelScheduledValues(T); g.setValueAtTime(1, T); }
      if (pendLv >= 0) { level = pendLv; pendLv = -1; }
      pendTrack = null;
      switchTo(want, T);
      if (live) { timer = setInterval(tick, TICK); tick(); }
    },
    stop() {
      if (!playing) return;
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      const T = ctx.currentTime;
      for (const d of decks) fadeOut(d, T, 0.05);
      const g = sDry.gain; g.cancelScheduledValues(T); g.setTargetAtTime(0, T, 0.05);
      cut(2, T + 0.3);
      pendTrack = null;
      cur = null;
    },
    setTrack(t: TrackId) {
      want = t;
      if (!playing || !cur) return;
      pendTrack = t === cur.id ? null : t;
      if (pendTrack) prio(pendTrack);
    },
    setIntensity(v: number) {
      const L = Math.max(0, Math.min(3, Math.round(v)));
      if (!playing || !cur) { level = L; pendLv = -1; } else pendLv = L === level ? -1 : L;
    },
    stinger,
    scheduleRange,
  };
}
