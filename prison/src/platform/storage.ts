// Persistent storage with read-back verification. Falls back to memory when localStorage is unavailable.
export const SAVE_KEY = 'prison_designer_v1';
export const SAVE_VERSION = 1;

export interface Settings { sfx: number; showGrid: boolean; lowFx: boolean; hints: boolean }
export interface Records { runs: number; bestDay: number; bestPrisoners: number; bestChapter: number; wins: number }
export interface Meta { version: number; settings: Settings; records: Records }
export interface RunInfo { day: number; prisoners: number; money: number; chapter: number; mode: string }
export interface SaveBlob { version: number; meta: Meta; run: string | null; runInfo: RunInfo | null; savedAt: number }

export function defaultMeta(): Meta { return { version: SAVE_VERSION, settings: { sfx: 0.7, showGrid: false, lowFx: false, hints: true }, records: { runs: 0, bestDay: 0, bestPrisoners: 0, bestChapter: 0, wins: 0 } }; }
const empty = (): SaveBlob => ({ version: SAVE_VERSION, meta: defaultMeta(), run: null, runInfo: null, savedAt: 0 });

let memory: string | null = null;
export const storageInfo = { available: false, reason: '' };
(function probe() {
  try { const k = '__pd_probe__'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); storageInfo.available = ok; if (!ok) storageInfo.reason = '읽기 검증 실패'; }
  catch (e) { storageInfo.available = false; storageInfo.reason = (e as Error)?.message || '접근 불가'; }
})();

export function load(): { blob: SaveBlob; error: string | null } {
  let raw: string | null = null;
  try { raw = storageInfo.available ? localStorage.getItem(SAVE_KEY) : memory; } catch { raw = memory; }
  if (!raw) return { blob: empty(), error: null };
  try {
    const o = JSON.parse(raw) as SaveBlob;
    if (!o || o.version !== SAVE_VERSION || !o.meta) { const bk = readBackup(); if (bk) return { blob: bk, error: '저장 버전 불일치 — 백업에서 복구' }; return { blob: empty(), error: `저장 버전이 달라 초기화했습니다 (${o?.version} → ${SAVE_VERSION})` }; }
    const d = defaultMeta();
    return { blob: { ...o, meta: { ...d, ...o.meta, settings: { ...d.settings, ...(o.meta.settings || {}) }, records: { ...d.records, ...(o.meta.records || {}) } } }, error: null };
  } catch (e) { const bk = readBackup(); if (bk) return { blob: bk, error: '저장 데이터 손상 — 백업에서 복구' }; return { blob: empty(), error: '저장 데이터 손상: ' + (e as Error).message }; }
}
function readBackup(): SaveBlob | null { try { const raw = localStorage.getItem(SAVE_KEY + '_bak'); if (!raw) return null; const o = JSON.parse(raw); if (o && o.version === SAVE_VERSION && o.meta) return o; } catch { /* ignore */ } return null; }

export function save(blob: SaveBlob): { ok: boolean; error?: string } {
  blob.savedAt = Date.now();
  const raw = JSON.stringify(blob);
  if (!storageInfo.available) { memory = raw; return { ok: false, error: '브라우저 저장소를 쓸 수 없어 메모리에만 보관됨 (내보내기 권장)' }; }
  try {
    const prev = localStorage.getItem(SAVE_KEY); if (prev) localStorage.setItem(SAVE_KEY + '_bak', prev);
    localStorage.setItem(SAVE_KEY, raw);
    if (localStorage.getItem(SAVE_KEY) !== raw) return { ok: false, error: '저장 검증 실패 (읽어온 데이터 불일치)' };
    memory = raw; return { ok: true };
  } catch (e) { memory = raw; return { ok: false, error: '저장 실패: ' + ((e as Error)?.message || '알 수 없음') }; }
}
export function exportString(blob: SaveBlob): string { return 'PRSN1.' + btoa(unescape(encodeURIComponent(JSON.stringify(blob)))); }
export function importString(str: string): { blob: SaveBlob | null; error?: string } {
  try {
    const s = str.trim(); if (!s.startsWith('PRSN1.')) return { blob: null, error: '형식이 올바르지 않습니다 (PRSN1. 으로 시작해야 함)' };
    const o = JSON.parse(decodeURIComponent(escape(atob(s.slice(6))))) as SaveBlob;
    if (!o || o.version !== SAVE_VERSION || !o.meta) return { blob: null, error: `버전 불일치 (${o?.version})` };
    return { blob: o };
  } catch (e) { return { blob: null, error: '불러오기 실패: ' + (e as Error).message }; }
}
