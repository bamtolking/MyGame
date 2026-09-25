// 프로필 저장: localStorage + 백업 + 검증 + 내보내기/불러오기
export const SAVE_KEY = 'kaltoe.profile.v1';
export const SAVE_VERSION = 1;

export interface StageBest { bestTime: number; clears: number; bestHeat: number; bestKills: number; bestLevel: number; bestOvertime: number }

export interface Settings {
  sfx: number; bgm: number; shake: boolean; vibrate: boolean; low: boolean; dmgNums: boolean; joystick: 'float' | 'fixed';
}

export interface LastRun {
  stage: string; char: string; cleared: boolean; time: number; level: number; kills: number; coins: number; date: string;
}

export interface Profile {
  v: number;
  created: number;
  coins: number;
  lifetime: {
    kills: number; bossKills: number; evolves: number; coins: number; ultUses: number; runs: number; clears: number;
    dailyClears: number; chests: number; metaRanks: number; playSec: number;
  };
  metaRanks: Record<string, number>;
  unlocked: string[];                  // 'weapon:laser', 'character:lee', 'feature:daily' …
  hired: string[];                     // 가격이 있는 캐릭터 고용 기록
  achievements: Record<string, number>; // id → 달성 시각(ms)
  progress: Record<string, number>;    // 업적 지표(최대값/누적)
  bests: Record<string, StageBest>;
  heatCleared: Record<string, number>; // 스테이지별 클리어한 최고 야근 강도(-1 = 없음)
  discovered: { weapons: string[]; enemies: string[]; lunches: string[] };
  settings: Settings;
  sel: { char: string; stage: string; heat: number };
  daily: { date: string; played: boolean; cleared: boolean; streak: number; lastClear: string };
  attendance: { last: string; day: number; total: number };
  tutorialDone: boolean;
  hints: string[];                     // 한 번 본 온보딩 힌트
  last: LastRun | null;
}

export function newProfile(): Profile {
  return {
    v: SAVE_VERSION,
    created: Date.now(),
    coins: 0,
    lifetime: { kills: 0, bossKills: 0, evolves: 0, coins: 0, ultUses: 0, runs: 0, clears: 0, dailyClears: 0, chests: 0, metaRanks: 0, playSec: 0 },
    metaRanks: {},
    unlocked: [],
    hired: [],
    achievements: {},
    progress: {},
    bests: {},
    heatCleared: {},
    discovered: { weapons: [], enemies: [], lunches: [] },
    settings: { sfx: 0.8, bgm: 0.5, shake: true, vibrate: true, low: false, dmgNums: true, joystick: 'float' },
    sel: { char: 'kim', stage: 'office', heat: 0 },
    daily: { date: '', played: false, cleared: false, streak: 0, lastClear: '' },
    attendance: { last: '', day: 0, total: 0 },
    tutorialDone: false,
    hints: [],
    last: null,
  };
}

/** 누락 필드를 기본값으로 채우고 타입이 이상한 값은 교정 */
export function normalize(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Profile>;
  if (typeof r.v !== 'number' || r.v > SAVE_VERSION) return null;
  const d = newProfile();
  const num = (v: unknown, def: number) => (typeof v === 'number' && isFinite(v) ? v : def);
  const obj = <T extends object>(v: unknown, def: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? { ...def, ...(v as T) } : def);
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
  const p: Profile = {
    v: SAVE_VERSION,
    created: num(r.created, d.created),
    coins: Math.max(0, Math.floor(num(r.coins, 0))),
    lifetime: obj(r.lifetime, d.lifetime),
    metaRanks: obj(r.metaRanks, {}),
    unlocked: arr(r.unlocked),
    hired: arr(r.hired),
    achievements: obj(r.achievements, {}),
    progress: obj(r.progress, {}),
    bests: obj(r.bests, {}),
    heatCleared: obj(r.heatCleared, {}),
    discovered: {
      weapons: arr(r.discovered?.weapons), enemies: arr(r.discovered?.enemies), lunches: arr(r.discovered?.lunches),
    },
    settings: obj(r.settings, d.settings),
    sel: obj(r.sel, d.sel),
    daily: obj(r.daily, d.daily),
    attendance: obj(r.attendance, d.attendance),
    tutorialDone: !!r.tutorialDone,
    hints: arr(r.hints),
    last: r.last && typeof r.last === 'object' ? (r.last as LastRun) : null,
  };
  for (const k of Object.keys(p.lifetime) as (keyof Profile['lifetime'])[]) p.lifetime[k] = num(p.lifetime[k], 0);
  return p;
}

function storage(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function loadProfile(): { profile: Profile; status: 'new' | 'ok' | 'restored' | 'corrupt' } {
  const ls = storage();
  if (!ls) return { profile: newProfile(), status: 'new' };
  const tryParse = (k: string) => { try { const s = ls.getItem(k); return s ? normalize(JSON.parse(s)) : null; } catch { return null; } };
  const main = tryParse(SAVE_KEY);
  if (main) return { profile: main, status: 'ok' };
  const had = (() => { try { return ls.getItem(SAVE_KEY) !== null; } catch { return false; } })();
  const bak = tryParse(SAVE_KEY + '_bak');
  if (bak) return { profile: bak, status: 'restored' };
  return { profile: newProfile(), status: had ? 'corrupt' : 'new' };
}

let lastGood = '';
export function saveProfile(p: Profile): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    const s = JSON.stringify(p);
    if (lastGood && lastGood !== s) ls.setItem(SAVE_KEY + '_bak', lastGood);
    ls.setItem(SAVE_KEY, s);
    const back = ls.getItem(SAVE_KEY);
    if (back !== s) return false;
    lastGood = s;
    return true;
  } catch { return false; }
}

function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

export function exportProfile(p: Profile): string {
  const json = JSON.stringify(p);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `KALTOE1.${checksum(json)}.${b64}`;
}

export function importProfile(code: string): Profile | null {
  try {
    const m = code.trim().match(/^KALTOE1\.([0-9a-z]+)\.(.+)$/);
    if (!m) return null;
    const json = decodeURIComponent(escape(atob(m[2])));
    if (checksum(json) !== m[1]) return null;
    return normalize(JSON.parse(json));
  } catch { return null; }
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function yesterdayKey(d = new Date()): string {
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return todayKey(y);
}
