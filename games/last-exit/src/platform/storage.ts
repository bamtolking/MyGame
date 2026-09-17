// 저장: 보관 재화·해금·기록(meta) + 출정 스냅샷(run). 쓰기 후 읽어서 검증, 백업 보관.
import type { EnemyType, LootId, RunState, WeaponId, Difficulty } from '../sim/types';
import { serialize, bagValue } from '../sim/state';

export const SAVE_KEY = 'last_exit_v1';
export const SAVE_VERSION = 1;

export interface Settings { sfx: number; bgm: number; shake: boolean; lowFx: boolean }
export interface RunRecord { runId: string; date: number; kind: 'escaped' | 'dead' | 'abandoned'; zone: number; value: number; weapon: WeaponId; difficulty: Difficulty; time: number; boss: boolean; seed: number; items: Record<LootId, number> }
export interface Meta {
  version: number;
  vault: number;                        // 보관 재화 (탈출로 확정된 것만)
  unlocks: { shotgun: boolean; staff: boolean };
  bagUpgrades: number;
  hardUnlocked: boolean;
  codex: { enemies: EnemyType[]; loot: LootId[]; bestZone: number; bossSeen: boolean; bossKilled: boolean };
  records: { runs: number; escapes: number; deaths: number; bestValue: number; totalValue: number; fastestFull: number; earlyEscapes: number };
  settledRuns: string[];
  history: RunRecord[];
  settings: Settings;
  tutorialDone: boolean;
  lastWeapon: WeaponId; lastDifficulty: Difficulty;
}
export interface RunSave { snapshot: string; runId: string; zone: number; phase: string; label: string; savedAt: number }
export interface SaveBlob { version: number; meta: Meta; run: RunSave | null; savedAt: number }

export function defaultMeta(): Meta {
  return {
    version: SAVE_VERSION, vault: 0, unlocks: { shotgun: false, staff: false }, bagUpgrades: 0, hardUnlocked: false,
    codex: { enemies: [], loot: [], bestZone: 0, bossSeen: false, bossKilled: false },
    records: { runs: 0, escapes: 0, deaths: 0, bestValue: 0, totalValue: 0, fastestFull: 0, earlyEscapes: 0 },
    settledRuns: [], history: [], settings: { sfx: 0.7, bgm: 0.4, shake: true, lowFx: false }, tutorialDone: false, lastWeapon: 'rifle', lastDifficulty: 'normal',
  };
}
function emptyBlob(): SaveBlob { return { version: SAVE_VERSION, meta: defaultMeta(), run: null, savedAt: 0 }; }

let memory: string | null = null;
export const storageInfo = { available: false, reason: '' };
(function probe() {
  try { const k = '__lastexit_probe__'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); storageInfo.available = ok; if (!ok) storageInfo.reason = '읽기 검증 실패'; }
  catch (e) { storageInfo.available = false; storageInfo.reason = (e as Error)?.message || '접근 불가'; }
})();

function normalize(o: SaveBlob): SaveBlob {
  const d = defaultMeta();
  const m: Meta = { ...d, ...o.meta, unlocks: { ...d.unlocks, ...(o.meta.unlocks || {}) }, codex: { ...d.codex, ...(o.meta.codex || {}) }, records: { ...d.records, ...(o.meta.records || {}) }, settings: { ...d.settings, ...(o.meta.settings || {}) } };
  if (!Array.isArray(m.settledRuns)) m.settledRuns = []; if (!Array.isArray(m.history)) m.history = [];
  if (typeof m.vault !== 'number' || !isFinite(m.vault) || m.vault < 0) m.vault = 0;
  let run = o.run && typeof o.run.snapshot === 'string' && typeof o.run.runId === 'string' ? o.run : null;
  return { version: SAVE_VERSION, meta: m, run, savedAt: o.savedAt || 0 };
}

export function load(): { blob: SaveBlob; error: string | null } {
  let raw: string | null = null;
  try { raw = storageInfo.available ? localStorage.getItem(SAVE_KEY) : memory; } catch { raw = memory; }
  if (!raw) return { blob: emptyBlob(), error: null };
  try {
    const o = JSON.parse(raw) as SaveBlob;
    if (!o || typeof o !== 'object' || !o.meta) throw new Error('구조 오류');
    if (o.version !== SAVE_VERSION) {
      const bk = readBackup(); if (bk) return { blob: normalize(bk), error: `저장 버전 불일치(${o.version}) — 백업에서 복구했습니다` };
      return { blob: emptyBlob(), error: `저장 버전이 달라 초기화했습니다 (${o.version} → ${SAVE_VERSION})` };
    }
    return { blob: normalize(o), error: null };
  } catch (e) {
    const bk = readBackup(); if (bk) return { blob: normalize(bk), error: '저장 데이터 손상 — 백업에서 복구했습니다' };
    return { blob: emptyBlob(), error: '저장 데이터가 손상되어 초기화했습니다: ' + (e as Error).message };
  }
}
function readBackup(): SaveBlob | null {
  try { const raw = localStorage.getItem(SAVE_KEY + '_bak'); if (!raw) return null; const o = JSON.parse(raw); if (o && o.version === SAVE_VERSION && o.meta) return o; } catch { /* ignore */ }
  return null;
}

/** 쓰고 다시 읽어 검증. 검증 성공 시에만 ok */
export function save(blob: SaveBlob): { ok: boolean; error?: string } {
  blob.savedAt = Date.now();
  const raw = JSON.stringify(blob);
  if (!storageInfo.available) { memory = raw; return { ok: false, error: '브라우저 저장소를 쓸 수 없어 이번 세션에만 보관됩니다 (' + storageInfo.reason + ')' }; }
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(SAVE_KEY + '_bak', prev);
    localStorage.setItem(SAVE_KEY, raw);
    const back = localStorage.getItem(SAVE_KEY);
    if (back !== raw) return { ok: false, error: '저장 검증 실패 (읽어온 데이터 불일치)' };
    memory = raw; return { ok: true };
  } catch (e) { memory = raw; return { ok: false, error: '저장 실패: ' + ((e as Error)?.message || '알 수 없음') }; }
}
export function wipe(): void { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_KEY + '_bak'); } catch { /* ignore */ } memory = null; }

/** 출정 스냅샷 기록 (구역 진입·목표 완료·능력 선택 등 안전 지점) */
export function snapshotRun(blob: SaveBlob, s: RunState, label: string): void {
  blob.run = { snapshot: serialize(s), runId: s.runId, zone: s.zone, phase: s.phase, label, savedAt: Date.now() };
}

/** 정산: 출정 ID 기준 1회만. 탈출이면 보관 재화 가산. 반환: 이번에 실제 가산된 값 */
export function settleRun(blob: SaveBlob, s: RunState): { awarded: number; already: boolean } {
  const m = blob.meta;
  if (m.settledRuns.includes(s.runId)) { blob.run = null; return { awarded: 0, already: true }; }
  const kind: RunRecord['kind'] = s.status === 'escaped' ? 'escaped' : s.status === 'dead' ? 'dead' : 'abandoned';
  const value = kind === 'escaped' ? bagValue(s) : 0;
  m.settledRuns.push(s.runId); if (m.settledRuns.length > 200) m.settledRuns.splice(0, m.settledRuns.length - 200);
  m.records.runs++;
  if (kind === 'escaped') { m.vault += value; m.records.escapes++; m.records.totalValue += value; m.records.bestValue = Math.max(m.records.bestValue, value); if (s.zone <= 2) m.records.earlyEscapes++; if (s.zone === 6 && s.zoneRt.bossDead) { if (s.difficulty === 'normal') m.hardUnlocked = true; if (!m.records.fastestFull || s.time < m.records.fastestFull) m.records.fastestFull = s.time; } }
  else if (kind === 'dead') m.records.deaths++;
  m.codex.bestZone = Math.max(m.codex.bestZone, s.zone);
  if (s.zoneRt.bossSpawned) m.codex.bossSeen = true; if (s.zoneRt.bossDead) m.codex.bossKilled = true;
  m.history.unshift({ runId: s.runId, date: Date.now(), kind, zone: s.zone, value, weapon: s.weapon, difficulty: s.difficulty, time: s.time, boss: s.zoneRt.bossDead, seed: s.seed, items: { ...s.bag.items } });
  if (m.history.length > 30) m.history.length = 30;
  blob.run = null;
  return { awarded: value, already: false };
}
export function noteCodex(m: Meta, enemies: Iterable<EnemyType>, loot: Iterable<LootId>): void {
  for (const e of enemies) if (!m.codex.enemies.includes(e)) m.codex.enemies.push(e);
  for (const l of loot) if (!m.codex.loot.includes(l)) m.codex.loot.push(l);
}

/** 해금·수납 보강 구매 (순수). 성공 시 재화 차감 */
export function purchase(m: Meta, id: 'shotgun' | 'staff' | 'bag1' | 'bag2', price: number): { ok: boolean; msg?: string } {
  const owned = id === 'shotgun' ? m.unlocks.shotgun : id === 'staff' ? m.unlocks.staff : id === 'bag1' ? m.bagUpgrades >= 1 : m.bagUpgrades >= 2;
  if (owned) return { ok: false, msg: '이미 보유' };
  if (id === 'bag2' && m.bagUpgrades < 1) return { ok: false, msg: '1단계 먼저' };
  if (m.vault < price) return { ok: false, msg: `◆${price - m.vault} 부족` };
  m.vault -= price;
  if (id === 'shotgun') m.unlocks.shotgun = true; else if (id === 'staff') m.unlocks.staff = true; else if (id === 'bag1') m.bagUpgrades = 1; else m.bagUpgrades = 2;
  return { ok: true };
}
