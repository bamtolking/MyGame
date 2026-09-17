// 저장·복원. 확정된 행동만 저장하고, 전투 중 이탈 시 전투 시작 체크포인트로 복귀한다.
import type { EquipId } from '../data/equipment';
import type { Difficulty } from '../data/balance';
import { validateAll } from './bag';
import { restoreCheckpoint, type RunState } from './run';

export const SAVE_KEY = 'packblast_save_v1';
export const SAVE_VERSION = 1;

export interface Settings { sfx: number; muted: boolean; shake: boolean; lowFx: boolean }
export interface RunRecord { date: number; difficulty: Difficulty; stage: number; won: boolean; seed: number }
export interface Meta {
  version: number;
  settings: Settings;
  tutorialDone: boolean;
  bestStage: Record<Difficulty, number>;
  clears: Record<Difficulty, number>;
  hardUnlocked: boolean;
  discoveredLinks: string[];   // "mg+battery" 처럼 실제 전투에서 적용된 연결
  codex: EquipId[];            // 획득한 장비 종류
  runs: number;
  history: RunRecord[];
}
export interface SaveBlob { version: number; meta: Meta; run: RunState | null; savedAt: number }

export function defaultMeta(): Meta {
  return { version: SAVE_VERSION, settings: { sfx: 0.7, muted: false, shake: true, lowFx: false }, tutorialDone: false, bestStage: { normal: 0, hard: 0 }, clears: { normal: 0, hard: 0 }, hardUnlocked: false, discoveredLinks: [], codex: [], runs: 0, history: [] };
}
export function emptyBlob(): SaveBlob { return { version: SAVE_VERSION, meta: defaultMeta(), run: null, savedAt: 0 }; }

let memory: string | null = null;
export const storageInfo = { available: false, reason: '' };
(function probe() {
  try { const k = '__pb_probe__'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); storageInfo.available = ok; if (!ok) storageInfo.reason = '읽기 검증 실패'; }
  catch (e) { storageInfo.available = false; storageInfo.reason = (e as Error)?.message || '접근 불가'; }
})();

const PHASES = ['prep', 'reward', 'unlock', 'battle', 'result'];

/** 저장된 판 상태의 구조·일관성 검사. 문제가 있으면 이유를 돌려준다. */
export function validateRun(r: unknown): string | null {
  if (!r || typeof r !== 'object') return '판 데이터 없음';
  const s = r as RunState;
  if (typeof s.seed !== 'number' || !s.rng || typeof s.rng.a !== 'number') return '난수 상태 손상';
  if (!PHASES.includes(s.phase)) return '단계 값 손상';
  if (typeof s.stage !== 'number' || s.stage < 1 || s.stage > 12) return '구간 값 손상';
  if (typeof s.hp !== 'number' || typeof s.parts !== 'number' || s.hp < 0 || s.parts < 0) return '체력·부품 손상';
  if (!s.grid || !Array.isArray(s.grid.locked) || s.grid.locked.length !== 25) return '가방 상태 손상';
  if (!Array.isArray(s.items)) return '장비 목록 손상';
  const uids = new Set<string>();
  for (const it of s.items) {
    if (!it || typeof it.uid !== 'string' || uids.has(it.uid)) return '장비 ID 중복/손상';
    uids.add(it.uid);
    if (![1, 2, 3].includes(it.grade) || ![0, 1, 2, 3].includes(it.rot) || (it.loc !== 'bag' && it.loc !== 'bench')) return '장비 속성 손상';
  }
  if (!validateAll(s.grid, s.items).ok) return '가방 배치가 유효하지 않음';
  if (s.phase === 'reward' && (!s.reward || !Array.isArray(s.reward.candidates) || s.reward.candidates.length !== 3)) return '보상 후보 손상';
  return null;
}

export interface LoadResult { blob: SaveBlob; error: string | null; note: string | null }

export function load(): LoadResult {
  let raw: string | null = null;
  try { raw = storageInfo.available ? localStorage.getItem(SAVE_KEY) : memory; } catch { raw = memory; }
  if (!raw) return { blob: emptyBlob(), error: null, note: null };
  let o: SaveBlob;
  try { o = JSON.parse(raw) as SaveBlob; } catch (e) { return { blob: emptyBlob(), error: '저장 데이터가 손상되어 새로 시작합니다: ' + (e as Error).message, note: null }; }
  if (!o || typeof o !== 'object' || o.version !== SAVE_VERSION || !o.meta) return { blob: emptyBlob(), error: `저장 버전이 달라 초기화했습니다 (${(o as SaveBlob | null)?.version} → ${SAVE_VERSION})`, note: null };
  const d = defaultMeta();
  const meta: Meta = { ...d, ...o.meta, settings: { ...d.settings, ...(o.meta.settings || {}) }, bestStage: { ...d.bestStage, ...(o.meta.bestStage || {}) }, clears: { ...d.clears, ...(o.meta.clears || {}) } };
  let run: RunState | null = o.run ?? null;
  let note: string | null = null; let error: string | null = null;
  if (run) {
    if (run.phase === 'battle') {
      const c = restoreCheckpoint(run);
      if (c) { run = c; note = '전투 중에 나갔던 판입니다. 해당 전투 시작 시점(정리 화면)부터 다시 도전합니다.'; }
      else { run.phase = 'prep'; run.battle = null; run.checkpoint = null; note = '전투 기록이 없어 정리 화면부터 다시 시작합니다.'; }
    }
    const v = validateRun(run);
    if (v) { error = '이어할 판 데이터가 손상되어 판만 초기화했습니다: ' + v; run = null; }
  }
  return { blob: { version: SAVE_VERSION, meta, run, savedAt: o.savedAt || 0 }, error, note };
}

export function save(blob: SaveBlob): { ok: boolean; error?: string } {
  blob.savedAt = Date.now();
  const raw = JSON.stringify(blob);
  if (!storageInfo.available) { memory = raw; return { ok: false, error: '브라우저 저장소를 쓸 수 없어 메모리에만 보관됩니다' }; }
  try {
    localStorage.setItem(SAVE_KEY, raw);
    if (localStorage.getItem(SAVE_KEY) !== raw) return { ok: false, error: '저장 검증 실패' };
    memory = raw; return { ok: true };
  } catch (e) { memory = raw; return { ok: false, error: '저장 실패: ' + ((e as Error)?.message || '알 수 없음') }; }
}

export function resetAll(): void {
  memory = null;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
