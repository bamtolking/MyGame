// localStorage persistence with strict validation. Corrupt data never crashes the app: it is dropped field by field.
import { MAX_GHOSTS } from '../sim/constants';
import { validateSlots } from '../sim/recording';
import { emptyMissionSave, emptyRecord, type MissionSave } from './session';
import type { MissionDef } from '../sim/types';

export const SAVE_KEY = 'solo_heist_25s_v1';
export const SAVE_VERSION = 1;
export interface Settings { muted: boolean; volume: number; fxIntensity: number; showHints: boolean }
export interface SaveData { v: number; settings: Settings; missions: Record<string, MissionSave>; unlocked: number; introSeen: boolean; savedAt: number }
export const defaultSettings = (): Settings => ({ muted: false, volume: 0.7, fxIntensity: 1, showHints: true });
export const defaultSave = (): SaveData => ({ v: SAVE_VERSION, settings: defaultSettings(), missions: {}, unlocked: 1, introSeen: false, savedAt: 0 });

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
function pickStorage(): StorageLike | null {
  try { const k = '__heist_probe__'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); return ok ? localStorage : null; } catch { return null; }
}
let memory: string | null = null;
const memStore: StorageLike = { getItem: () => memory, setItem: (_, v) => { memory = v; }, removeItem: () => { memory = null; } };

const num = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

/** Parse + validate a raw JSON string. Always returns usable data; `problems` lists what was dropped. */
export function parseSave(raw: string | null, missions: MissionDef[]): { data: SaveData; problems: string[] } {
  const data = defaultSave(); const problems: string[] = [];
  if (!raw) return { data, problems };
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return { data, problems: ['저장 데이터가 손상되어 초기화했습니다.'] }; }
  if (!o || typeof o !== 'object') return { data, problems: ['저장 데이터 형식이 잘못되어 초기화했습니다.'] };
  const r = o as Record<string, unknown>;
  if (r.v !== SAVE_VERSION) problems.push(`저장 버전이 달라(${String(r.v)}) 읽을 수 있는 부분만 복구했습니다.`);
  const s = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  data.settings = { muted: bool(s.muted, false), volume: num(s.volume, 0, 1, 0.7), fxIntensity: num(s.fxIntensity, 0, 1, 1), showHints: bool(s.showHints, true) };
  data.unlocked = Math.round(num(r.unlocked, 1, missions.length, 1));
  data.introSeen = bool(r.introSeen, false);
  data.savedAt = num(r.savedAt, 0, 1e15, 0);
  const ms = (r.missions && typeof r.missions === 'object' ? r.missions : {}) as Record<string, unknown>;
  for (const def of missions) {
    const m = ms[def.id] as Record<string, unknown> | undefined;
    if (!m || typeof m !== 'object') continue;
    const version = typeof m.version === 'number' ? m.version : -1;
    const save = emptyMissionSave(version);
    if (version === def.version) {
      save.slots = validateSlots(m.slots, def.id, def.version);
      const dropped = Array.isArray(m.slots) ? m.slots.slice(0, MAX_GHOSTS).filter((x, i) => x != null && save.slots[i] === null).length : 0;
      if (dropped) problems.push(`작전 ${def.index}: 손상된 분신 기록 ${dropped}개를 제외했습니다.`);
    } else if (Array.isArray(m.slots) && m.slots.some((x) => x != null)) {
      problems.push(`작전 ${def.index}: 맵이 바뀌어(v${version}→v${def.version}) 이전 분신 기록을 사용할 수 없습니다.`);
      save.version = version; // the session retires them and reports it
    }
    const rec = (m.record && typeof m.record === 'object' ? m.record : {}) as Record<string, unknown>;
    const e = emptyRecord();
    save.record = {
      clears: Math.round(num(rec.clears, 0, 1e6, e.clears)), attempts: Math.round(num(rec.attempts, 0, 1e7, e.attempts)),
      bestTicks: typeof rec.bestTicks === 'number' && Number.isInteger(rec.bestTicks) && rec.bestTicks > 0 && rec.bestTicks <= 3600 ? rec.bestTicks : null,
      minGhosts: typeof rec.minGhosts === 'number' && Number.isInteger(rec.minGhosts) && rec.minGhosts >= 0 && rec.minGhosts <= MAX_GHOSTS ? rec.minGhosts : null,
      noDamageClear: bool(rec.noDamageClear, false), bestComposition: typeof rec.bestComposition === 'string' && rec.bestComposition.length < 200 ? rec.bestComposition : null,
    };
    data.missions[def.id] = save;
  }
  return { data, problems };
}

export class SaveStore {
  private store: StorageLike; readonly persistent: boolean;
  constructor(store?: StorageLike | null) { const s = store === undefined ? pickStorage() : store; this.persistent = !!s; this.store = s ?? memStore; }
  load(missions: MissionDef[]): { data: SaveData; problems: string[] } {
    let raw: string | null = null; try { raw = this.store.getItem(SAVE_KEY); } catch { raw = null; }
    return parseSave(raw, missions);
  }
  save(data: SaveData): boolean {
    data.savedAt = Date.now();
    try { const raw = JSON.stringify(data); this.store.setItem(SAVE_KEY, raw); return this.store.getItem(SAVE_KEY) === raw; } catch { return false; }
  }
  clear(): void { try { this.store.removeItem(SAVE_KEY); } catch { /* ignore */ } }
}
