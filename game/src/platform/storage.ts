// 로컬 저장: 메타(설정·튜토리얼·해금·도감·기록) + 진행 중인 게임의 웨이브 시작 체크포인트.
// localStorage 를 쓸 수 없으면 메모리에만 보관하고 그 사실을 알립니다. 손상된 데이터는 안내 후 초기화합니다.
import type { ComboId } from '../data/combos';
import type { MapId } from '../data/maps';
import type { Difficulty } from '../data/waves';

export const META_KEY = 'combo_rush_meta';
export const RUN_KEY = 'combo_rush_run';
export const META_VERSION = 1;

export interface Settings { sfx: number; muted: boolean; fxLevel: 0 | 1 | 2; dmgNumbers: boolean; showRanges: boolean }
export interface ClearRecord { wins: number; bestWave: number; bestTime: number }
export interface Meta {
  version: number;
  settings: Settings;
  tutorialDone: boolean;
  unlocked: { mapB: boolean; hard: boolean };
  codex: ComboId[];
  records: Record<string, ClearRecord>; // key: `${mapId}:${difficulty}`
  bestWaveOverall: number;
  claimedRuns: string[];              // 승패 기록을 이미 반영한 runId (중복 지급 방지)
  runs: number; wins: number;
}
export interface RunCheckpoint { version: number; runId: string; mapId: MapId; difficulty: Difficulty; wave: number; savedAt: number; state: string }

export function defaultSettings(): Settings { return { sfx: 0.7, muted: false, fxLevel: 2, dmgNumbers: true, showRanges: true }; }
export function defaultMeta(): Meta {
  return { version: META_VERSION, settings: defaultSettings(), tutorialDone: false, unlocked: { mapB: false, hard: false }, codex: [], records: {}, bestWaveOverall: 0, claimedRuns: [], runs: 0, wins: 0 };
}

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
let backend: StorageLike | null = null;
const memory = new Map<string, string>();
export const storageInfo = { available: false, reason: '' };

export function useStorage(s: StorageLike | null): void { backend = s; probe(); }
function probe(): void {
  if (!backend) { storageInfo.available = false; storageInfo.reason = '저장소 없음'; return; }
  try { const k = '__cr_probe__'; backend.setItem(k, '1'); const ok = backend.getItem(k) === '1'; backend.removeItem(k); storageInfo.available = ok; storageInfo.reason = ok ? '' : '읽기 검증 실패'; }
  catch (e) { storageInfo.available = false; storageInfo.reason = (e as Error)?.message || '접근 불가'; }
}
try { if (typeof localStorage !== 'undefined') useStorage(localStorage); } catch { /* 비활성 환경 */ }

function readRaw(k: string): string | null { if (storageInfo.available && backend) { try { return backend.getItem(k); } catch { /* fallthrough */ } } return memory.get(k) ?? null; }
function writeRaw(k: string, v: string): { ok: boolean; error?: string } {
  memory.set(k, v);
  if (!storageInfo.available || !backend) return { ok: false, error: '브라우저 저장소를 쓸 수 없어 이번 세션에만 보관됩니다' };
  try { backend.setItem(k, v); if (backend.getItem(k) !== v) return { ok: false, error: '저장 검증 실패' }; return { ok: true }; }
  catch (e) { return { ok: false, error: '저장 실패: ' + ((e as Error)?.message || '알 수 없음') }; }
}
function removeRaw(k: string): void { memory.delete(k); if (storageInfo.available && backend) { try { backend.removeItem(k); } catch { /* ignore */ } } }

/** 메타 읽기. 손상 시 기본값 + 오류 메시지(호출자가 안내). */
export function loadMeta(): { meta: Meta; error: string | null } {
  const raw = readRaw(META_KEY);
  if (!raw) return { meta: defaultMeta(), error: null };
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || typeof o.version !== 'number') throw new Error('형식 오류');
    if (o.version !== META_VERSION) { removeRaw(META_KEY); return { meta: defaultMeta(), error: `저장 버전이 달라 설정·기록을 초기화했습니다 (${o.version} → ${META_VERSION})` }; }
    const d = defaultMeta();
    const meta: Meta = {
      version: META_VERSION,
      settings: { ...d.settings, ...(o.settings && typeof o.settings === 'object' ? o.settings : {}) },
      tutorialDone: !!o.tutorialDone,
      unlocked: { ...d.unlocked, ...(o.unlocked || {}) },
      codex: Array.isArray(o.codex) ? o.codex.filter((x: unknown) => typeof x === 'string') : [],
      records: o.records && typeof o.records === 'object' ? o.records : {},
      bestWaveOverall: Number(o.bestWaveOverall) || 0,
      claimedRuns: Array.isArray(o.claimedRuns) ? o.claimedRuns.slice(-100) : [],
      runs: Number(o.runs) || 0, wins: Number(o.wins) || 0,
    };
    return { meta, error: null };
  } catch (e) {
    removeRaw(META_KEY);
    return { meta: defaultMeta(), error: '저장 데이터가 손상되어 설정·기록을 초기화했습니다: ' + (e as Error).message };
  }
}
export function saveMeta(meta: Meta): { ok: boolean; error?: string } { return writeRaw(META_KEY, JSON.stringify(meta)); }

export function loadCheckpoint(): { cp: RunCheckpoint | null; error: string | null } {
  const raw = readRaw(RUN_KEY); if (!raw) return { cp: null, error: null };
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || typeof o.state !== 'string' || typeof o.runId !== 'string' || typeof o.wave !== 'number') throw new Error('형식 오류');
    if (!['A', 'B'].includes(o.mapId) || !['normal', 'hard'].includes(o.difficulty)) throw new Error('맵·난이도 정보 없음');
    JSON.parse(o.state); // 상태 문자열이 최소한 JSON 이어야 함(구조 검증은 deserialize 에서)
    return { cp: o as RunCheckpoint, error: null };
  } catch (e) { removeRaw(RUN_KEY); return { cp: null, error: '진행 중이던 게임 저장이 손상되어 삭제했습니다: ' + (e as Error).message }; }
}
export function saveCheckpoint(cp: RunCheckpoint): { ok: boolean; error?: string } { return writeRaw(RUN_KEY, JSON.stringify(cp)); }
export function clearCheckpoint(): void { removeRaw(RUN_KEY); }
export function clearAll(): void { removeRaw(META_KEY); removeRaw(RUN_KEY); }
