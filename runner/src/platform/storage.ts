// localStorage with read-back verification, a backup copy, export/import, and an in-memory fallback (GDD §9.9).
//   write → read back and verify → the previous value is kept as `_bak`
//   a corrupted main save loads from `_bak`; a save from a NEWER build is copied aside before anything is written
//   storage blocked → memory (this session only); QuotaExceeded → drop the oldest non-best ghosts, then retry
//   ghosts live in their own keys (≤ 250 KB together) so the main save stays small
import { normalize, defaultProgress, takeLegacyGhosts, totalStars, SAVE_VERSION, type Progress } from '../meta/progress';
import { CONTENT_HASH } from '../sim/content';

export const SAVE_KEY = 'jelly_runner_v1';
export const BAK_KEY = SAVE_KEY + '_bak';
const EXPORT_PREFIX = 'JRUN1.';
const GHOST_PREFIX = 'jelly_runner_ghost_';
/** all ghosts together stay under this many characters (≈ bytes for the ASCII JSON they are) */
export const GHOST_BUDGET = 250_000;

// Everything goes through this accessor so a blocked / swapped storage (tests, Safari private mode) is handled.
function ls(): Storage | null { try { return (globalThis as { localStorage?: Storage }).localStorage ?? null; } catch { return null; } }

const mem = new Map<string, string>();   // fallback for every key while storage is unavailable
export const storageInfo = { available: false, reason: '' };
/** (Re)check whether localStorage works. Runs once at import; tests and a "다시 시도" button may call it again. */
export function probeStorage(): boolean {
  try {
    const st = ls(); if (!st) throw new Error('localStorage 없음');
    const k = '__jr_probe__'; st.setItem(k, '1'); const ok = st.getItem(k) === '1'; st.removeItem(k);
    storageInfo.available = ok; storageInfo.reason = ok ? '' : '읽기 검증 실패';
  } catch (e) { storageInfo.available = false; storageInfo.reason = (e as Error)?.message || '접근 불가'; }
  return storageInfo.available;
}
probeStorage();

// the memory copy only exists while the last write of that key failed, so it is always the newest value
function readRaw(key: string): string | null {
  const m = mem.get(key); if (m !== undefined) return m;
  if (storageInfo.available) { try { return ls()!.getItem(key); } catch { /* fall through */ } }
  return null;
}
/** Forget the in-memory fallback copies (tests; or after the player exported and wants a clean slate). */
export function clearMemoryFallback(): void { mem.clear(); }
function writeRaw(key: string, v: string): void {
  if (!storageInfo.available) { mem.set(key, v); return; }
  ls()!.setItem(key, v);
  mem.delete(key);
}
function removeRaw(key: string): void {
  mem.delete(key);
  if (storageInfo.available) { try { ls()!.removeItem(key); } catch { /* ignore */ } }
}
export function isQuotaError(e: unknown): boolean {
  const x = e as { name?: string; code?: number } | null;
  return !!x && (x.name === 'QuotaExceededError' || x.name === 'NS_ERROR_DOM_QUOTA_REACHED' || x.code === 22 || x.code === 1014);
}

/** GDD §9.9: after the first booked run, quietly ask the browser to keep our storage (no prompt in most browsers). */
export async function requestPersist(): Promise<boolean> {
  try {
    const sm = (globalThis as { navigator?: { storage?: { persisted?: () => Promise<boolean>; persist?: () => Promise<boolean> } } }).navigator?.storage;
    if (!sm?.persist) return false;
    if (sm.persisted && await sm.persisted()) return true;
    return !!(await sm.persist());
  } catch { return false; }
}

// ---------------------------------------------------------------- main save
export interface LoadResult { p: Progress; error: string | null; recovered?: 'bak' | 'newer' | 'reset' }
function parseSave(raw: string): Progress {
  const o = JSON.parse(raw);
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('형식 오류');
  moveLegacyGhosts(o);
  return normalize(o);
}
export function load(): LoadResult {
  const raw = readRaw(SAVE_KEY);
  if (!raw) {
    const bk = readRaw(BAK_KEY);   // main missing but a backup exists (e.g. main removed by a failed write) → use it
    if (bk) { try { return { p: parseSave(bk), error: '저장 데이터를 백업에서 복구했어요', recovered: 'bak' }; } catch { /* fall through */ } }
    return { p: defaultProgress(), error: null };
  }
  let o: any = null;
  try { o = JSON.parse(raw); } catch { o = null; }
  if (o && typeof o === 'object' && typeof o.version === 'number' && o.version > SAVE_VERSION) {
    // a save from a newer build: never overwrite it — park a copy, then continue best-effort (unknown fields are kept)
    const aside = `${SAVE_KEY}_v${o.version}`;
    try { if (!readRaw(aside)) writeRaw(aside, raw); } catch { /* ignore */ }
    try { return { p: parseSave(raw), error: `더 새 버전(v${o.version})의 저장 데이터예요. 사본을 따로 보관하고 이어서 불러왔어요.`, recovered: 'newer' }; } catch { /* fall through */ }
  }
  try { return { p: parseSave(raw), error: null }; }
  catch (e) {
    const bk = readRaw(BAK_KEY);
    if (bk) { try { return { p: parseSave(bk), error: '저장 데이터가 손상되어 백업에서 복구했어요', recovered: 'bak' }; } catch { /* fall through */ } }
    // keep the unreadable text so nothing is ever destroyed silently
    try { writeRaw(SAVE_KEY + '_broken', raw); } catch { /* ignore */ }
    return { p: defaultProgress(), error: '저장 데이터 손상: ' + (e as Error).message, recovered: 'reset' };
  }
}

/** Writes, then reads back to verify. Keeps the previous save as a backup. */
export function save(p: Progress): { ok: boolean; error?: string } {
  const raw = JSON.stringify(p);
  if (!storageInfo.available) { mem.set(SAVE_KEY, raw); return { ok: false, error: '브라우저 저장소를 쓸 수 없어 이번 접속 동안만 기억해요 (내보내기 권장)' }; }
  const st = ls()!;
  const attempt = (): { ok: boolean; error?: string } => {
    const prev = st.getItem(SAVE_KEY);
    if (prev && prev !== raw) st.setItem(BAK_KEY, prev);
    st.setItem(SAVE_KEY, raw);
    if (st.getItem(SAVE_KEY) !== raw) return { ok: false, error: '저장 검증 실패' };
    mem.delete(SAVE_KEY); return { ok: true };
  };
  try { const r = attempt(); if (r.ok) return r; mem.set(SAVE_KEY, raw); return r; }
  catch (e) {
    if (isQuotaError(e)) {
      // free space: stale / old non-best ghosts first (one at a time), then the backup copy
      let dropped = 0;
      for (const k of evictableGhosts(p)) {
        removeRaw(GHOST_PREFIX + k); dropped++;
        try { const r = attempt(); if (r.ok) return { ok: true, error: `저장 공간이 부족해 지난 유령 ${dropped}개를 비웠어요` }; } catch { /* keep freeing */ }
      }
      try { st.removeItem(BAK_KEY); const r = attempt(); if (r.ok) return { ok: true, error: '저장 공간이 부족해 백업 사본을 비웠어요' }; } catch { /* ignore */ }
    }
    mem.set(SAVE_KEY, raw);
    return { ok: false, error: '저장 실패: ' + ((e as Error)?.message || '알 수 없음') + ' (이번 접속 동안만 기억해요)' };
  }
}

// ---------------------------------------------------------------- ghosts (one per stage / day / endless)
export function saveGhost(key: string, g: unknown, p?: Progress): boolean {
  const raw = JSON.stringify(g);
  if (!storageInfo.available) { mem.set(GHOST_PREFIX + key, raw); return false; }
  const st = ls()!;
  const fits = () => ghostBytes([key]) + raw.length <= GHOST_BUDGET;
  // keep the ghost budget: drop old non-best ghosts (never the one being written)
  for (const k of evictableGhosts(p).filter(k => k !== key)) { if (fits()) break; removeRaw(GHOST_PREFIX + k); }
  try { st.setItem(GHOST_PREFIX + key, raw); return true; }
  catch (e) {
    if (isQuotaError(e)) for (const k of evictableGhosts(p).filter(k => k !== key)) {
      removeRaw(GHOST_PREFIX + k);
      try { st.setItem(GHOST_PREFIX + key, raw); return true; } catch { /* keep freeing */ }
    }
    mem.set(GHOST_PREFIX + key, raw); return false;
  }
}
export function loadGhost<T>(key: string): T | null {
  try { const raw = readRaw(GHOST_PREFIX + key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
export function removeGhost(key: string): void { removeRaw(GHOST_PREFIX + key); }
export function listGhosts(): string[] {
  const out: string[] = [];
  if (storageInfo.available) {
    try { const st = ls()!; for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k && k.startsWith(GHOST_PREFIX)) out.push(k.slice(GHOST_PREFIX.length)); } } catch { /* ignore */ }
  }
  for (const k of mem.keys()) if (k.startsWith(GHOST_PREFIX) && !out.includes(k.slice(GHOST_PREFIX.length))) out.push(k.slice(GHOST_PREFIX.length));
  return out;
}
/** Total characters used by ghosts (optionally ignoring some keys). */
export function ghostBytes(except: string[] = []): number {
  let n = 0; for (const k of listGhosts()) if (!except.includes(k)) n += (readRaw(GHOST_PREFIX + k)?.length ?? 0);
  return n;
}
/**
 * Ghost keys that may be dropped, in the order they should go (GDD §9.9 "최고 기록이 아닌 오래된 유령부터"):
 * 1. unreadable ghosts or ghosts of another build (they can never replay), 2. daily ghosts outside the 7-day window,
 * 3. other daily ghosts, oldest first — except today's and the all-time best day. Stage / endless ghosts are personal bests: never.
 */
export function evictableGhosts(p?: Progress, today?: string): string[] {
  const keys = listGhosts();
  const stale: string[] = [];
  for (const k of keys) {
    try { const g = JSON.parse(readRaw(GHOST_PREFIX + k) ?? 'null'); if (!g || typeof g !== 'object' || g.content !== CONTENT_HASH) stale.push(k); } catch { stale.push(k); }
  }
  const days = keys.filter(k => k.startsWith('daily:') && !stale.includes(k)).sort();
  const t = today ?? days[days.length - 1]?.slice(6) ?? '';
  let bestDay = '';
  if (p) { let b = -1; for (const [d, r] of Object.entries(p.daily ?? {})) if ((r?.best ?? 0) > b) { b = r.best; bestDay = d; } }
  const keep = (k: string) => k === 'daily:' + t || k === 'daily:' + bestDay;
  const cutoff = t ? shiftDay(t, -6) : '';
  const old = days.filter(k => !keep(k) && cutoff && k.slice(6) < cutoff);
  const recent = days.filter(k => !keep(k) && !old.includes(k));
  return [...stale, ...old, ...recent];
}
function shiftDay(key: string, d: number): string {
  const [y, m, dd] = key.split('-').map(Number); if (!y || !m || !dd) return '';
  const t = new Date(Date.UTC(y, m - 1, dd) + d * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
/** keep at most `max` daily ghosts (newest first) */
export function pruneDailyGhosts(max = 7): void {
  try { const ks = listGhosts().filter(k => k.startsWith('daily:')).sort(); while (ks.length > max) removeRaw(GHOST_PREFIX + ks.shift()); } catch { /* ignore */ }
}
/** v1 saves carried ghosts inline: move each to its own key (an existing ghost for the same key wins). */
function moveLegacyGhosts(o: any): void {
  const gs = takeLegacyGhosts(o);
  for (const [k, g] of Object.entries(gs)) { try { if (!readRaw(GHOST_PREFIX + k)) saveGhost(k, g); } catch { /* ignore */ } }
}

// ---------------------------------------------------------------- backup code (base64) + .txt download
export function exportString(p: Progress): string {
  const slim = { ...p };
  return EXPORT_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(slim))));
}
/** Accepts the bare code or the whole downloaded .txt (the code is found anywhere in the text; line breaks are ignored). */
export function importString(str: string): { p: Progress | null; error?: string } {
  try {
    const at = str.indexOf(EXPORT_PREFIX);
    if (at < 0) return { p: null, error: `형식이 올바르지 않아요 (${EXPORT_PREFIX} 으로 시작해야 함)` };
    const body = (str.slice(at + EXPORT_PREFIX.length).replace(/\s+/g, '').match(/^[A-Za-z0-9+/=]+/) ?? [''])[0];
    const o = JSON.parse(decodeURIComponent(escape(atob(body))));
    if (!o || typeof o !== 'object' || typeof o.version !== 'number') return { p: null, error: '데이터가 올바르지 않아요' };
    moveLegacyGhosts(o);
    return { p: normalize(o) };
  } catch (e) { return { p: null, error: '불러오기 실패: ' + (e as Error).message }; }
}
/** Contents of the downloadable backup file (UI: new Blob([backupFileContent(p)], { type: 'text/plain' })). The code is the last line. */
export function backupFileContent(p: Progress, now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const f = (n: number) => n.toLocaleString('ko-KR');
  return [
    '야식 대질주 — 백업 코드',
    `만든 때: ${d}`,
    `계급 ${p.rank} · 엽전 ${f(p.coins)} · 별 ${totalStars(p)}개 · 달린 판 ${f(p.totals.runs)} · 주자 ${p.unlocked.length}명`,
    '',
    '설정 → 백업 코드 → 가져오기에 아래 줄 전체(또는 이 파일 내용 전체)를 붙여 넣으면 이어서 할 수 있어요.',
    '',
    exportString(p),
    '',
  ].join('\n');
}
export function backupFileName(now = new Date()): string {
  return `yasik-backup-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.txt`;
}
