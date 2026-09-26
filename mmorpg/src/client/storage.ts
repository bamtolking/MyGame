// Browser persistence: device token, settings, known characters, and the offline world's character store.
import type { Profile, ClassId } from '../shared/types.ts';
import type { ProfileStore } from '../server/server.ts';

const K = 'moonlit.';
function get(k: string): string | null { try { return localStorage.getItem(K + k); } catch { return null; } }
function set(k: string, v: string): boolean { try { localStorage.setItem(K + k, v); return true; } catch { return false; } }
function del(k: string): void { try { localStorage.removeItem(K + k); } catch { /* ignore */ } }
export const storageOk = (() => { try { localStorage.setItem(K + 't', '1'); localStorage.removeItem(K + 't'); return true; } catch { return false; } })();

export function token(kind: 'offline' | 'online'): string {
  let t = get('token.' + kind);
  if (!t || !/^[A-Za-z0-9_-]{16,64}$/.test(t)) {
    const a = new Uint8Array(18); crypto.getRandomValues(a);
    t = Array.from(a, b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b & 63]).join('');
    set('token.' + kind, t);
  }
  return t;
}
export function setToken(kind: 'offline' | 'online', t: string): boolean { if (!/^[A-Za-z0-9_-]{16,64}$/.test(t)) return false; return set('token.' + kind, t); }

export type Quality = 'high' | 'mid' | 'low';
export interface Settings { sfx: number; bgm: number; quality: Quality; dmgNums: boolean; shake: boolean; server: string; names: boolean }
const DEF: Settings = { sfx: 0.7, bgm: 0.45, quality: 'high', dmgNums: true, shake: true, server: '', names: true };
export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(get('settings') ?? '{}'); const s: Settings = { ...DEF, ...raw };
    if (!raw.quality && raw.low === true) s.quality = 'low'; // settings saved before quality levels existed
    if (!['high', 'mid', 'low'].includes(s.quality)) s.quality = 'high';
    delete (s as Partial<Settings> & { low?: boolean }).low; return s;
  } catch { return { ...DEF }; }
}
export function saveSettings(s: Settings): void { set('settings', JSON.stringify(s)); }

export interface KnownChar { name: string; cls: ClassId; level: number; t: number }
export function knownChar(kind: 'offline' | 'online'): KnownChar | null { try { return JSON.parse(get('char.' + kind) ?? 'null'); } catch { return null; } }
export function rememberChar(kind: 'offline' | 'online', c: KnownChar | null): void { if (c) set('char.' + kind, JSON.stringify(c)); else del('char.' + kind); }

/** Classes whose unlock the player has already seen in the 직업 sheet (drives the "NEW" badges). */
/** Class unlocks the player has already been shown, per mode (offline/online character). */
export function seenClasses(mode: 'offline' | 'online'): string[] { try { const a = JSON.parse(get('seenCls.' + mode) ?? 'null'); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch { return []; } }
export function saveSeenClasses(mode: 'offline' | 'online', ids: string[]): void { set('seenCls.' + mode, JSON.stringify(ids)); }

/** Character store for the in-browser (offline) world. Keeps one backup copy. */
export class LocalProfileStore implements ProfileStore {
  lastError = '';
  load(tok: string): Profile | null {
    for (const k of ['prof.' + tok, 'prof.' + tok + '.bak']) { const s = get(k); if (!s) continue; try { const p = JSON.parse(s); if (p && p.v === 1) return p; } catch { /* try backup */ } }
    return null;
  }
  save(tok: string, p: Profile): void {
    const s = JSON.stringify(p); const prev = get('prof.' + tok);
    if (prev) set('prof.' + tok + '.bak', prev);
    this.lastError = set('prof.' + tok, s) && get('prof.' + tok) === s ? '' : '저장 실패 (브라우저 저장 공간을 확인하세요)';
  }
  wipe(tok: string): void { del('prof.' + tok); del('prof.' + tok + '.bak'); }
  exportString(tok: string): string | null { const s = get('prof.' + tok); return s ? btoa(unescape(encodeURIComponent(s))) : null; }
  importString(tok: string, b64: string): boolean {
    try { const p = JSON.parse(decodeURIComponent(escape(atob(b64.trim())))); if (!p || p.v !== 1 || typeof p.name !== 'string') return false; this.save(tok, p); return true; } catch { return false; }
  }
}
