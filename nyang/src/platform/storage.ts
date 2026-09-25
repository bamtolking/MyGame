// 기기 저장: 프로필(최고 기록, 도감, 설정, 오늘의 상자 기록)과 진행 중인 판.
// localStorage가 막혀 있어도 게임은 돌아가야 하므로 모든 접근을 감싼다.
import { CATS } from '../data/cats';
import type { GameSnapshot } from '../sim/game';
import type { LangSetting } from '../i18n';

export interface DailyRecord { score: number; maxTier: number; maxCombo: number; drops: number; mod: string }

export interface Profile {
  v: 1;
  best: number;
  /** 단계별로 만들어 본 횟수 (0 = 아직 발견 못 함) */
  dex: number[];
  games: number;
  merges: number;
  ascends: number;
  maxCombo: number;
  daily: Record<string, DailyRecord>;
  settings: { sfx: boolean; bgm: boolean; vib: boolean; lite: boolean; lang: LangSetting };
  tutorial: number;
}

const KEY = 'nyangche.profile.v1';
const RUN = 'nyangche.run.v1';

export function defaultProfile(): Profile {
  return {
    v: 1, best: 0, dex: CATS.map(() => 0), games: 0, merges: 0, ascends: 0, maxCombo: 0, daily: {},
    settings: { sfx: true, bgm: true, vib: true, lite: false, lang: 'auto' }, tutorial: 0,
  };
}

function get(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function set(key: string, val: string): boolean {
  try { window.localStorage.setItem(key, val); return window.localStorage.getItem(key) === val; } catch { return false; }
}

function del(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* 무시 */ }
}

export function loadProfile(): Profile {
  const base = defaultProfile();
  const raw = get(KEY);
  if (!raw) return base;
  try {
    const p = JSON.parse(raw);
    if (!p || p.v !== 1) return base;
    const dex = Array.isArray(p.dex) ? CATS.map((_, i) => Math.max(0, Number(p.dex[i]) || 0)) : base.dex;
    return {
      ...base,
      best: Math.max(0, Number(p.best) || 0),
      dex,
      games: Number(p.games) || 0,
      merges: Number(p.merges) || 0,
      ascends: Number(p.ascends) || 0,
      maxCombo: Number(p.maxCombo) || 0,
      daily: p.daily && typeof p.daily === 'object' ? p.daily : {},
      settings: { ...base.settings, ...(p.settings || {}), lang: ['auto', 'ko', 'en'].includes(p.settings?.lang) ? p.settings.lang : 'auto' },
      tutorial: Number(p.tutorial) || 0,
    };
  } catch {
    return base;
  }
}

export function saveProfile(p: Profile): boolean {
  // 오래된 오늘의 상자 기록은 60일치만 보관
  const keys = Object.keys(p.daily).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete p.daily[k];
  return set(KEY, JSON.stringify(p));
}

export function loadRun(): GameSnapshot | null {
  const raw = get(RUN);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveRun(s: GameSnapshot): boolean { return set(RUN, JSON.stringify(s)); }
export function clearRun(): void { del(RUN); }
export function resetAll(): void { del(KEY); del(RUN); }
