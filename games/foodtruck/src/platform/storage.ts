// localStorage 저장. 실패를 성공처럼 표시하지 않는다.
import { SAVE } from '../data/balance';

export interface SaveOutcome { ok: boolean; error?: string; at: number }

export function readSaveText(): string | null {
  try { return localStorage.getItem(SAVE.key); } catch { return null; }
}

export function writeSaveText(text: string): SaveOutcome {
  try {
    localStorage.setItem(SAVE.key, text);
    // 기록 확인: 다시 읽어 길이 비교
    const back = localStorage.getItem(SAVE.key);
    if (back !== text) return { ok: false, error: '기록 확인 실패', at: Date.now() };
    return { ok: true, at: Date.now() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패', at: Date.now() };
  }
}

export function clearSave(): void {
  try { localStorage.removeItem(SAVE.key); } catch { /* ignore */ }
}

export function backupCorrupt(text: string | null): void {
  if (!text) return;
  try { localStorage.setItem(SAVE.key + '.corrupt', text); } catch { /* ignore */ }
}
