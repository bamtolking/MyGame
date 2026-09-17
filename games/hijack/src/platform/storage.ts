// 저장: 설정·기록·도감·도전과제·체크포인트. 손상 데이터는 기본값으로 복구하고 사용자에게 알린다.
import type { BodyId } from '../sim/types';

export const SAVE_KEY = 'galaata_v1';
export const SAVE_VERSION = 1;

export interface Settings { volume: number; muted: boolean; fx: number; hints: boolean; showDamage: boolean }
export interface Records { runs: number; clears: number; bestTime: number; bestZone: number; longestSurvival: number; possessions: number; bodyUse: Partial<Record<BodyId, number>>; fewestPossessClear: number }
export interface Checkpoint { zoneIndex: number; body: BodyId; hp: number; stability: number | null; seed: number; stats: unknown; startedAt: number; elapsed: number }
export interface SaveData {
  version: number;
  settings: Settings;
  records: Records;
  codex: BodyId[];
  achievements: string[];
  tutorialDone: boolean;
  hardUnlocked: boolean;
  checkpoint: Checkpoint | null;
  savedAt: number;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { volume: 0.7, muted: false, fx: 1, hints: true, showDamage: true },
    records: { runs: 0, clears: 0, bestTime: 0, bestZone: 0, longestSurvival: 0, possessions: 0, bodyUse: {}, fewestPossessClear: 0 },
    codex: ['intruder'], achievements: [], tutorialDone: false, hardUnlocked: false, checkpoint: null, savedAt: 0,
  };
}

export const storageInfo = { available: false, reason: '' };
let memory: string | null = null;
(function probe() {
  try { const k = '__galaata_probe__'; localStorage.setItem(k, '1'); storageInfo.available = localStorage.getItem(k) === '1'; localStorage.removeItem(k); }
  catch (e) { storageInfo.available = false; storageInfo.reason = (e as Error)?.message || '접근 불가'; }
})();

export function load(): { data: SaveData; notice: string | null } {
  let raw: string | null = null;
  try { raw = storageInfo.available ? localStorage.getItem(SAVE_KEY) : memory; } catch { raw = memory; }
  if (!raw) return { data: defaultSave(), notice: null };
  try {
    const o = JSON.parse(raw) as Partial<SaveData>;
    if (!o || typeof o !== 'object' || o.version !== SAVE_VERSION) return { data: defaultSave(), notice: '저장 데이터 버전이 달라 초기화했습니다' };
    const d = defaultSave();
    const data: SaveData = {
      ...d, ...o,
      settings: { ...d.settings, ...(o.settings ?? {}) },
      records: { ...d.records, ...(o.records ?? {}), bodyUse: { ...(o.records?.bodyUse ?? {}) } },
      codex: Array.isArray(o.codex) ? (o.codex as BodyId[]) : d.codex,
      achievements: Array.isArray(o.achievements) ? o.achievements : [],
      checkpoint: o.checkpoint && typeof o.checkpoint === 'object' && typeof o.checkpoint.zoneIndex === 'number' ? o.checkpoint : null,
    };
    if (!data.codex.includes('intruder')) data.codex.unshift('intruder');
    return { data, notice: null };
  } catch (e) {
    return { data: defaultSave(), notice: '저장 데이터가 손상되어 초기화했습니다' };
  }
}

export function save(data: SaveData): { ok: boolean; error?: string } {
  data.savedAt = Date.now();
  const raw = JSON.stringify(data);
  memory = raw;
  if (!storageInfo.available) return { ok: false, error: '브라우저 저장소를 쓸 수 없어 이번 세션에만 보관됨' };
  try { localStorage.setItem(SAVE_KEY, raw); return localStorage.getItem(SAVE_KEY) === raw ? { ok: true } : { ok: false, error: '저장 검증 실패' }; }
  catch (e) { return { ok: false, error: '저장 실패: ' + ((e as Error)?.message || '알 수 없음') }; }
}

export function reset(): void { memory = null; try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
