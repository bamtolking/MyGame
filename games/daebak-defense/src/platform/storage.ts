// Persistent storage with verification. Falls back to memory when localStorage is unavailable.
export const SAVE_KEY = 'daebak_defense_v1';
export const SAVE_VERSION = 3;

export interface Settings { bgm: number; sfx: number; reduceMotion: boolean; dmgNumbers: boolean; fastSummon: boolean; lowFx: boolean }
export interface RunRecord { runId: string; date: number; wave: number; won: boolean; time: number; units: string[]; mythics: string[]; relics: string[]; seed: number }
export interface Meta {
  version: number;
  settings: Settings;
  codex: { units: string[]; enemies: string[]; mythics: string[]; relics: string[] };
  records: { bestWave: number; wins: number; runs: number; fastestWin: number; totalKills: number };
  titles: string[];
  claimedRuns: string[];
  history: RunRecord[];
}
export interface SaveBlob { version: number; meta: Meta; run: string | null; runWave: number; savedAt: number }

export function defaultMeta(): Meta {
  return { version: SAVE_VERSION, settings: { bgm: 0.5, sfx: 0.7, reduceMotion: false, dmgNumbers: true, fastSummon: false, lowFx: false }, codex: { units: [], enemies: [], mythics: [], relics: [] }, records: { bestWave: 0, wins: 0, runs: 0, fastestWin: 0, totalKills: 0 }, titles: [], claimedRuns: [], history: [] };
}

let memory: string | null = null;
export const storageInfo = { available: false, reason: '' };
(function probe() {
  try { const k = '__dbsd_probe__'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); storageInfo.available = ok; if (!ok) storageInfo.reason = '읽기 검증 실패'; }
  catch (e) { storageInfo.available = false; storageInfo.reason = (e as Error)?.message || '접근 불가'; }
})();

export function load(): { blob: SaveBlob; error: string | null } {
  let raw: string | null = null;
  try { raw = storageInfo.available ? localStorage.getItem(SAVE_KEY) : memory; } catch { raw = memory; }
  if (!raw) return { blob: { version: SAVE_VERSION, meta: defaultMeta(), run: null, runWave: 0, savedAt: 0 }, error: null };
  try {
    const o = JSON.parse(raw) as SaveBlob;
    if (!o || o.version !== SAVE_VERSION || !o.meta) {
      // try backup
      const bk = readBackup();
      if (bk) return { blob: bk, error: `저장 버전 불일치(${o?.version}) — 백업에서 복구` };
      return { blob: { version: SAVE_VERSION, meta: defaultMeta(), run: null, runWave: 0, savedAt: 0 }, error: `저장 버전이 달라 초기화했습니다 (${o?.version} → ${SAVE_VERSION})` };
    }
    const m = { ...defaultMeta(), ...o.meta, settings: { ...defaultMeta().settings, ...(o.meta.settings || {}) }, codex: { ...defaultMeta().codex, ...(o.meta.codex || {}) }, records: { ...defaultMeta().records, ...(o.meta.records || {}) } };
    return { blob: { ...o, meta: m }, error: null };
  } catch (e) {
    const bk = readBackup();
    if (bk) return { blob: bk, error: '저장 데이터 손상 — 백업에서 복구' };
    return { blob: { version: SAVE_VERSION, meta: defaultMeta(), run: null, runWave: 0, savedAt: 0 }, error: '저장 데이터 손상: ' + (e as Error).message };
  }
}
function readBackup(): SaveBlob | null {
  try { const raw = localStorage.getItem(SAVE_KEY + '_bak'); if (!raw) return null; const o = JSON.parse(raw); if (o && o.version === SAVE_VERSION && o.meta) return o; } catch { /* ignore */ }
  return null;
}

/** Writes and verifies by reading back. Returns true only if verified. */
export function save(blob: SaveBlob): { ok: boolean; error?: string } {
  blob.savedAt = Date.now();
  const raw = JSON.stringify(blob);
  if (!storageInfo.available) { memory = raw; return { ok: false, error: '브라우저 저장소를 쓸 수 없어 메모리에만 보관됨 (내보내기 권장)' }; }
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(SAVE_KEY + '_bak', prev);
    localStorage.setItem(SAVE_KEY, raw);
    const back = localStorage.getItem(SAVE_KEY);
    if (back !== raw) return { ok: false, error: '저장 검증 실패 (읽어온 데이터 불일치)' };
    memory = raw;
    return { ok: true };
  } catch (e) { memory = raw; return { ok: false, error: '저장 실패: ' + ((e as Error)?.message || '알 수 없음') }; }
}

export function exportString(blob: SaveBlob): string {
  const raw = JSON.stringify(blob);
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return 'DBSD1.' + b64;
}
export function importString(str: string): { blob: SaveBlob | null; error?: string } {
  try {
    const s = str.trim();
    if (!s.startsWith('DBSD1.')) return { blob: null, error: '형식이 올바르지 않습니다 (DBSD1. 으로 시작해야 함)' };
    const raw = decodeURIComponent(escape(atob(s.slice(6))));
    const o = JSON.parse(raw) as SaveBlob;
    if (!o || o.version !== SAVE_VERSION || !o.meta) return { blob: null, error: `버전 불일치 (${o?.version})` };
    return { blob: o };
  } catch (e) { return { blob: null, error: '불러오기 실패: ' + (e as Error).message }; }
}
