// localStorage persistence with read-back verification and a backup copy. Falls back to memory.
import { SAVE_VERSION, type SaveData } from '../sim/game';
import type { ClassId, Item } from '../sim/types';

const PREFIX = 'abyss.v1.';
export interface Settings { bgm: number; sfx: number; lowFx: boolean; dmgNumbers: boolean; shake: boolean; showLabels: boolean }
export const DEFAULT_SETTINGS: Settings = { bgm: 0.55, sfx: 0.75, lowFx: false, dmgNumbers: true, shake: true, showLabels: false };

const memory = new Map<string, string>();
export const storageOk = (() => {
  try { const k = PREFIX + 'probe'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); return ok; } catch { return false; }
})();

function get(key: string): string | null {
  try { if (storageOk) return localStorage.getItem(PREFIX + key); } catch { /* fall through */ }
  return memory.get(key) ?? null;
}
function set(key: string, v: string): boolean {
  memory.set(key, v);
  try {
    if (!storageOk) return false;
    const prev = localStorage.getItem(PREFIX + key);
    if (prev) localStorage.setItem(PREFIX + key + '.bak', prev);
    localStorage.setItem(PREFIX + key, v);
    return localStorage.getItem(PREFIX + key) === v;
  } catch { return false; }
}
function del(key: string): void {
  memory.delete(key);
  try { if (storageOk) { localStorage.removeItem(PREFIX + key); localStorage.removeItem(PREFIX + key + '.bak'); } } catch { /* ignore */ }
}

function parseHero(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as SaveData;
    if (!o || o.v !== SAVE_VERSION || !o.cls || typeof o.level !== 'number') return null;
    return o;
  } catch { return null; }
}

export function loadHero(cls: ClassId): SaveData | null {
  const s = parseHero(get('hero.' + cls));
  if (s) return s;
  try { return storageOk ? parseHero(localStorage.getItem(PREFIX + 'hero.' + cls + '.bak')) : null; } catch { return null; }
}
export function saveHero(s: SaveData): boolean { return set('hero.' + s.cls, JSON.stringify(s)); }
export function deleteHero(cls: ClassId): void { del('hero.' + cls); }

export function loadStash(): (Item | null)[] | null {
  const raw = get('stash');
  if (!raw) return null;
  try { const o = JSON.parse(raw); return Array.isArray(o) ? o : null; } catch { return null; }
}
export function saveStash(stash: (Item | null)[]): boolean { return set('stash', JSON.stringify(stash)); }

export function loadSettings(): Settings {
  try { const raw = get('settings'); if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: Settings): void { set('settings', JSON.stringify(s)); }

export function exportHero(s: SaveData): string { return 'ABYSS1.' + btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
export function importHero(str: string): SaveData | null {
  const t = str.trim();
  if (!t.startsWith('ABYSS1.')) return null;
  try { return parseHero(decodeURIComponent(escape(atob(t.slice(7))))); } catch { return null; }
}
