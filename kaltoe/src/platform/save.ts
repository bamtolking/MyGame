// 프로필 저장: localStorage + 백업 + 검증 + 내보내기/불러오기
export const SAVE_KEY = 'kaltoe.profile.v1';
export const SAVE_VERSION = 1;

export interface StageBest { bestTime: number; clears: number; bestHeat: number; bestKills: number; bestLevel: number; bestOvertime: number }

export interface Settings {
  sfx: number; bgm: number; shake: boolean; vibrate: boolean; low: boolean; dmgNums: boolean; joystick: 'float' | 'fixed';
  /** 그래픽 품질. auto = 프레임 시간을 보고 자동 조절 */
  quality: 'auto' | 'high' | 'medium' | 'low';
  /** 화면 방향. land = 가로 우선(터치 기기가 세로로 서 있으면 화면을 90° 돌려 가로로 보여 줌), auto = 기기 방향 그대로 */
  orient: 'land' | 'auto';
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
  dailyPick: { date: string; char: string; stage: string; heat: number; mods: string[] } | null;
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
    settings: { sfx: 0.8, bgm: 0.5, shake: true, vibrate: true, low: false, dmgNums: true, joystick: 'float', quality: 'auto', orient: 'land' },
    sel: { char: 'kim', stage: 'office', heat: 0 },
    daily: { date: '', played: false, cleared: false, streak: 0, lastClear: '' },
    dailyPick: null,
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
    dailyPick: r.dailyPick && typeof r.dailyPick === 'object' && typeof r.dailyPick.date === 'string' && Array.isArray(r.dailyPick.mods) ? r.dailyPick : null,
    attendance: obj(r.attendance, d.attendance),
    tutorialDone: !!r.tutorialDone,
    hints: arr(r.hints),
    last: r.last && typeof r.last === 'object' ? (r.last as LastRun) : null,
  };
  // 중첩 필드 교정: 숫자 사전은 숫자만, 최고 기록은 필드별 숫자로
  for (const k of Object.keys(p.lifetime) as (keyof Profile['lifetime'])[]) p.lifetime[k] = num(p.lifetime[k], 0);
  const numDict = (o: Record<string, unknown>) => { const out: Record<string, number> = {}; for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && isFinite(v)) out[k] = v; return out; };
  p.metaRanks = numDict(p.metaRanks);
  p.achievements = numDict(p.achievements);
  p.progress = numDict(p.progress);
  p.heatCleared = numDict(p.heatCleared);
  const bests: Record<string, StageBest> = {};
  for (const [k, v] of Object.entries(p.bests as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const b = v as Partial<StageBest>;
    bests[k] = { bestTime: num(b.bestTime, 0), clears: num(b.clears, 0), bestHeat: num(b.bestHeat, -1), bestKills: num(b.bestKills, 0), bestLevel: num(b.bestLevel, 0), bestOvertime: num(b.bestOvertime, 0) };
  }
  p.bests = bests;
  const st = p.settings;
  st.sfx = Math.min(1, Math.max(0, num(st.sfx, d.settings.sfx)));
  st.bgm = Math.min(1, Math.max(0, num(st.bgm, d.settings.bgm)));
  for (const k of ['shake', 'vibrate', 'low', 'dmgNums'] as const) if (typeof st[k] !== 'boolean') st[k] = d.settings[k];
  if (st.joystick !== 'fixed' && st.joystick !== 'float') st.joystick = 'float';
  if (!['auto', 'high', 'medium', 'low'].includes(st.quality)) st.quality = st.low ? 'low' : 'auto';
  if (st.orient !== 'land' && st.orient !== 'auto') st.orient = 'land';
  if (typeof p.sel.char !== 'string') p.sel.char = d.sel.char;
  if (typeof p.sel.stage !== 'string') p.sel.stage = d.sel.stage;
  p.sel.heat = Math.max(0, Math.floor(num(p.sel.heat, 0)));
  p.daily = { date: String(p.daily.date ?? ''), played: !!p.daily.played, cleared: !!p.daily.cleared, streak: num(p.daily.streak, 0), lastClear: String(p.daily.lastClear ?? '') };
  p.attendance = { last: String(p.attendance.last ?? ''), day: num(p.attendance.day, 0), total: num(p.attendance.total, 0) };
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
  const raw = (() => { try { return ls.getItem(SAVE_KEY); } catch { return null; } })();
  const had = raw !== null;
  // 읽을 수 없는(손상/더 새 버전) 저장은 덮어쓰기 전에 따로 보관
  if (had) { try { ls.setItem(SAVE_KEY + '_unreadable', raw as string); } catch { /* 무시 */ } }
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
    const m = code.replace(/\s+/g, '').match(/^KALTOE1\.([0-9a-z]+)\.(.+)$/);
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
