/** Local persistence: settings, long-term progress, in-progress match snapshot. */
import type { FactionId } from '../core/types.ts';

export interface Settings {
  sfx: number; bgm: number; shake: boolean; flash: boolean; quality: 'auto' | 'high' | 'low'; hpBars: 'damaged' | 'all' | 'none';
  lastFaction: FactionId; lastDifficulty: 'easy' | 'normal' | 'hard'; tutorialDone: boolean; colorSkin: number;
}
export interface RosterPreset { name: string; faction: FactionId; cells: (string | null)[]; }
export interface Progress {
  version: number;
  matches: number; wins: number; losses: number; draws: number;
  mastery: Record<FactionId, number>; // xp
  badges: string[];
  bestWinTime: number; // seconds, 0 none
  winsVsHard: number; teamWins: number;
  presets: RosterPreset[];
  unlockedSkins: number[];
}
const K = { settings: 'lw.settings.v1', progress: 'lw.progress.v1', match: 'lw.match.v3' };

export const DEFAULT_SETTINGS: Settings = { sfx: 0.7, bgm: 0.25, shake: true, flash: true, quality: 'auto', hpBars: 'damaged', lastFaction: 'iron', lastDifficulty: 'normal', tutorialDone: false, colorSkin: 0 };
export const DEFAULT_PROGRESS: Progress = { version: 1, matches: 0, wins: 0, losses: 0, draws: 0, mastery: { iron: 0, gale: 0 }, badges: [], bestWinTime: 0, winsVsHard: 0, teamWins: 0, presets: [], unlockedSkins: [0] };

function read<T>(key: string, def: T, validate: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(def);
    const v = JSON.parse(raw);
    if (!validate(v)) return structuredClone(def);
    return { ...structuredClone(def), ...v };
  } catch {
    return structuredClone(def);
  }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota / private mode */ }
}
export function loadSettings(): Settings { return read(K.settings, DEFAULT_SETTINGS, (v) => !!v && typeof v === 'object'); }
export function saveSettings(s: Settings) { write(K.settings, s); }
export function loadProgress(): Progress { return read(K.progress, DEFAULT_PROGRESS, (v) => !!v && typeof v === 'object' && typeof (v as Progress).matches === 'number'); }
export function saveProgress(p: Progress) { write(K.progress, p); }
export function saveMatch(json: string, meta: { mode: string; savedAt: number; difficulty: string }) {
  write(K.match, { meta, json });
}
export function loadMatch(): { meta: { mode: string; savedAt: number; difficulty: string }; json: string } | null {
  try {
    const raw = localStorage.getItem(K.match);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.json !== 'string' || !v.meta) return null;
    return v;
  } catch { return null; }
}
export function clearMatch() { try { localStorage.removeItem(K.match); } catch { /* ignore */ } }
export function resetAll() { try { localStorage.removeItem(K.settings); localStorage.removeItem(K.progress); localStorage.removeItem(K.match); } catch { /* ignore */ } }

export const TITLES: { name: string; need: (p: Progress) => boolean; desc: string }[] = [
  { name: '신병', need: () => true, desc: '기본 칭호' },
  { name: '전선 지휘관', need: (p) => p.wins >= 1, desc: '첫 승리' },
  { name: '역전의 명수', need: (p) => p.wins >= 5, desc: '5승 달성' },
  { name: '철벽', need: (p) => p.mastery.iron >= 300, desc: '철갑연맹 숙련 300' },
  { name: '질풍', need: (p) => p.mastery.gale >= 300, desc: '질풍길드 숙련 300' },
  { name: '군단장', need: (p) => p.winsVsHard >= 3, desc: '어려움 AI 상대 3승' },
];
export const BADGES: { id: string; name: string; desc: string }[] = [
  { id: 'first_win', name: '첫 승리', desc: '어떤 모드든 첫 승리' },
  { id: 'hard_win', name: '강적 격파', desc: '어려움 AI 상대 승리' },
  { id: 'team_win', name: '연합 승리', desc: '팀 전투 승리' },
  { id: 'fast_win', name: '전격전', desc: '8분 이내 승리' },
  { id: 'econ_win', name: '부국강병', desc: '경제 연구 4단계 이상으로 승리' },
  { id: 'iron_5', name: '철갑 베테랑', desc: '철갑연맹 5경기' },
  { id: 'gale_5', name: '질풍 베테랑', desc: '질풍길드 5경기' },
];
export const SKINS = [
  { id: 0, name: '기본 (청/적)', ally: '#4f8cff', need: 0 },
  { id: 1, name: '에메랄드', ally: '#34d399', need: 150 },
  { id: 2, name: '골드', ally: '#fbbf24', need: 400 },
  { id: 3, name: '바이올렛', ally: '#a78bfa', need: 800 },
];
