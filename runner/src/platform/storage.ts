// localStorage with read-back verification, a backup copy, export/import, and an in-memory fallback.
import { normalize, defaultProgress, SAVE_VERSION, type Progress } from '../meta/progress';

export const SAVE_KEY = 'jelly_runner_v1';
const EXPORT_PREFIX = 'JRUN1.';

let memory: string | null = null;
export const storageInfo = { available: false, reason: '' };
(function probe() {
  try {
    const k = '__jr_probe__'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k);
    storageInfo.available = ok; if (!ok) storageInfo.reason = '읽기 검증 실패';
  } catch (e) { storageInfo.available = false; storageInfo.reason = (e as Error)?.message || '접근 불가'; }
})();

function readRaw(key: string): string | null {
  try { return storageInfo.available ? localStorage.getItem(key) : (key === SAVE_KEY ? memory : null); } catch { return key === SAVE_KEY ? memory : null; }
}

export function load(): { p: Progress; error: string | null } {
  const raw = readRaw(SAVE_KEY);
  if (!raw) return { p: defaultProgress(), error: null };
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') throw new Error('형식 오류');
    if (o.version > SAVE_VERSION) return { p: defaultProgress(), error: `더 새로운 버전의 저장 데이터입니다 (v${o.version}). 새로 시작합니다.` };
    return { p: normalize(o), error: null };
  } catch (e) {
    const bk = readRaw(SAVE_KEY + '_bak');
    if (bk) { try { return { p: normalize(JSON.parse(bk)), error: '저장 데이터가 손상되어 백업에서 복구했어요' }; } catch { /* fallthrough */ } }
    return { p: defaultProgress(), error: '저장 데이터 손상: ' + (e as Error).message };
  }
}

/** Writes, then reads back to verify. Keeps the previous save as a backup. */
export function save(p: Progress): { ok: boolean; error?: string } {
  let raw = JSON.stringify(p);
  if (!storageInfo.available) { memory = raw; return { ok: false, error: '브라우저 저장소를 쓸 수 없어 이번 접속 동안만 기억해요 (내보내기 권장)' }; }
  const attempt = (): { ok: boolean; error?: string } => {
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev && prev !== raw) localStorage.setItem(SAVE_KEY + '_bak', prev);
    localStorage.setItem(SAVE_KEY, raw);
    if (localStorage.getItem(SAVE_KEY) !== raw) return { ok: false, error: '저장 검증 실패' };
    memory = raw; return { ok: true };
  };
  try { return attempt(); }
  catch (e) {
    // quota: drop old ghosts (the only large data) and the backup, then retry once
    try {
      for (const k of listGhosts().filter(k => k.startsWith('daily:'))) localStorage.removeItem(GHOST_PREFIX + k);
      localStorage.removeItem(SAVE_KEY + '_bak');
      const r = attempt(); if (r.ok) return { ok: true, error: '저장 공간이 부족해 지난 오늘의 골목 유령을 비웠어요' };
    } catch { /* ignore */ }
    memory = raw; return { ok: false, error: '저장 실패: ' + ((e as Error)?.message || '알 수 없음') };
  }
}

// ---- ghosts live in their own keys (one per stage / day / endless) so the main save stays small ----
const GHOST_PREFIX = 'jelly_runner_ghost_';
const ghostMem = new Map<string, string>();
export function saveGhost(key: string, g: unknown): boolean {
  const raw = JSON.stringify(g);
  try {
    if (!storageInfo.available) { ghostMem.set(key, raw); return false; }
    localStorage.setItem(GHOST_PREFIX + key, raw); return true;
  } catch {
    // quota: drop the oldest daily ghosts, then retry once
    try { for (const k of listGhosts().filter(k => k.startsWith('daily:')).sort().slice(0, 3)) localStorage.removeItem(GHOST_PREFIX + k); localStorage.setItem(GHOST_PREFIX + key, raw); return true; } catch { ghostMem.set(key, raw); return false; }
  }
}
export function loadGhost<T>(key: string): T | null {
  try { const raw = storageInfo.available ? localStorage.getItem(GHOST_PREFIX + key) : ghostMem.get(key) ?? null; return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
export function listGhosts(): string[] {
  const out: string[] = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(GHOST_PREFIX)) out.push(k.slice(GHOST_PREFIX.length)); } } catch { /* ignore */ }
  for (const k of ghostMem.keys()) if (!out.includes(k)) out.push(k);
  return out;
}
/** keep at most `max` daily ghosts (newest first) */
export function pruneDailyGhosts(max = 7): void {
  try { const ks = listGhosts().filter(k => k.startsWith('daily:')).sort(); while (ks.length > max) localStorage.removeItem(GHOST_PREFIX + ks.shift()); } catch { /* ignore */ }
}

export function exportString(p: Progress): string {
  const slim = { ...p };
  return EXPORT_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(slim))));
}
export function importString(str: string): { p: Progress | null; error?: string } {
  try {
    const s = str.trim();
    if (!s.startsWith(EXPORT_PREFIX)) return { p: null, error: `형식이 올바르지 않아요 (${EXPORT_PREFIX} 으로 시작해야 함)` };
    const o = JSON.parse(decodeURIComponent(escape(atob(s.slice(EXPORT_PREFIX.length)))));
    if (!o || typeof o !== 'object' || typeof o.version !== 'number') return { p: null, error: '데이터가 올바르지 않아요' };
    return { p: normalize(o) };
  } catch (e) { return { p: null, error: '불러오기 실패: ' + (e as Error).message }; }
}
