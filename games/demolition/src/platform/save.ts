// 로컬 저장(localStorage). 물리 엔진 객체는 저장하지 않는다. 물리 진행 중 상태도 저장하지 않는다(정책).
export interface SaveData {
  version: number;
  currentLevel: number;               // 마지막으로 선택한 스테이지 id
  unlocked: number;                   // 열린 최대 스테이지 id
  best: Record<string, { stars: number; shots: number }>; // 스테이지 key → 최고 별, 최소 탄 수
  maxCombo: number;
  tutorialsDone: string[];
  settings: { volume: number; muted: boolean; reducedFx: boolean };
}

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'waruru.save.v1';

export type SaveStatus = 'ok' | 'empty' | 'corrupt' | 'unavailable';

export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, currentLevel: 1, unlocked: 1, best: {}, maxCombo: 0, tutorialsDone: [], settings: { volume: 0.8, muted: false, reducedFx: false } };
}

function storage(): Storage | null {
  try { const s = window.localStorage; s.getItem('__probe'); return s; } catch { return null; }
}

export function validateSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== SAVE_VERSION) return null;
  const d = defaultSave();
  if (typeof r.currentLevel === 'number' && r.currentLevel >= 1 && r.currentLevel <= 99) d.currentLevel = Math.floor(r.currentLevel);
  if (typeof r.unlocked === 'number' && r.unlocked >= 1 && r.unlocked <= 99) d.unlocked = Math.floor(r.unlocked);
  if (r.best && typeof r.best === 'object') {
    for (const [k, v] of Object.entries(r.best as Record<string, unknown>)) {
      if (!/^L\d{2}$/.test(k) || !v || typeof v !== 'object') return null;
      const b = v as Record<string, unknown>;
      if (typeof b.stars !== 'number' || typeof b.shots !== 'number' || b.stars < 0 || b.stars > 3 || b.shots < 0) return null;
      d.best[k] = { stars: Math.floor(b.stars), shots: Math.floor(b.shots) };
    }
  }
  if (typeof r.maxCombo === 'number' && r.maxCombo >= 0) d.maxCombo = Math.floor(r.maxCombo);
  if (Array.isArray(r.tutorialsDone)) d.tutorialsDone = r.tutorialsDone.filter((x): x is string => typeof x === 'string');
  if (r.settings && typeof r.settings === 'object') {
    const s = r.settings as Record<string, unknown>;
    if (typeof s.volume === 'number') d.settings.volume = Math.max(0, Math.min(1, s.volume));
    if (typeof s.muted === 'boolean') d.settings.muted = s.muted;
    if (typeof s.reducedFx === 'boolean') d.settings.reducedFx = s.reducedFx;
  }
  return d;
}

export function loadSave(): { data: SaveData; status: SaveStatus } {
  const s = storage();
  if (!s) return { data: defaultSave(), status: 'unavailable' };
  let text: string | null = null;
  try { text = s.getItem(SAVE_KEY); } catch { return { data: defaultSave(), status: 'unavailable' }; }
  if (!text) return { data: defaultSave(), status: 'empty' };
  try {
    const parsed = JSON.parse(text);
    const valid = validateSave(parsed);
    if (!valid) return { data: defaultSave(), status: 'corrupt' };
    return { data: valid, status: 'ok' };
  } catch { return { data: defaultSave(), status: 'corrupt' }; }
}

export function writeSave(data: SaveData): boolean {
  const s = storage();
  if (!s) return false;
  try { s.setItem(SAVE_KEY, JSON.stringify(data)); return s.getItem(SAVE_KEY) !== null; } catch { return false; }
}

export function resetSave(): boolean {
  const s = storage();
  if (!s) return false;
  try { s.removeItem(SAVE_KEY); return true; } catch { return false; }
}

/** 성공 결과 반영: 최고 기록만 갱신한다(낮은 기록으로 덮어쓰지 않음). 반환값은 갱신 여부. */
export function recordSuccess(data: SaveData, levelKey: string, levelId: number, stars: number, shots: number, maxCombo: number, totalLevels: number): boolean {
  const prev = data.best[levelKey];
  let changed = false;
  if (!prev) { data.best[levelKey] = { stars, shots }; changed = true; }
  else {
    if (stars > prev.stars) { prev.stars = stars; changed = true; }
    if (shots < prev.shots) { prev.shots = shots; changed = true; }
  }
  if (levelId + 1 <= totalLevels && data.unlocked < levelId + 1) { data.unlocked = levelId + 1; changed = true; }
  if (maxCombo > data.maxCombo) { data.maxCombo = maxCombo; changed = true; }
  return changed;
}

export function totalStars(data: SaveData): number {
  return Object.values(data.best).reduce((a, b) => a + b.stars, 0);
}
