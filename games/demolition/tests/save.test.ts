import { describe, it, expect } from 'vitest';
import { validateSave, defaultSave, recordSuccess, totalStars, SAVE_VERSION } from '../src/platform/save';

describe('저장 데이터', () => {
  it('손상된 데이터는 거부한다', () => {
    expect(validateSave(null)).toBeNull();
    expect(validateSave({ version: 999 })).toBeNull();
    expect(validateSave({ version: SAVE_VERSION, best: { L01: { stars: 9, shots: 1 } } })).toBeNull();
    expect(validateSave({ version: SAVE_VERSION, best: { bad: { stars: 1, shots: 1 } } })).toBeNull();
  });
  it('정상 데이터는 기본값과 합쳐 읽는다', () => {
    const d = validateSave({ version: SAVE_VERSION, currentLevel: 3, unlocked: 4, best: { L01: { stars: 2, shots: 2 } }, settings: { volume: 0.5 } })!;
    expect(d.currentLevel).toBe(3); expect(d.unlocked).toBe(4); expect(d.best.L01.stars).toBe(2); expect(d.settings.volume).toBe(0.5); expect(d.settings.muted).toBe(false);
  });
  it('최고 기록만 갱신하고 낮은 기록으로 덮어쓰지 않으며 별은 중복 누적되지 않는다', () => {
    const d = defaultSave();
    expect(recordSuccess(d, 'L01', 1, 2, 2, 1, 20)).toBe(true);
    expect(d.unlocked).toBe(2);
    expect(recordSuccess(d, 'L01', 1, 1, 3, 0, 20)).toBe(false); // 더 낮은 별·더 많은 탄 → 변화 없음
    expect(d.best.L01).toEqual({ stars: 2, shots: 2 });
    expect(recordSuccess(d, 'L01', 1, 3, 1, 4, 20)).toBe(true);
    expect(d.best.L01).toEqual({ stars: 3, shots: 1 });
    expect(d.maxCombo).toBe(4);
    recordSuccess(d, 'L01', 1, 3, 1, 1, 20); recordSuccess(d, 'L01', 1, 3, 1, 1, 20);
    expect(totalStars(d)).toBe(3);
    // 마지막 스테이지(20) 클리어는 그 다음(21)을 열지 않는다 — 해금 범위를 넘기지 않음
    const before = d.unlocked;
    recordSuccess(d, 'L20', 20, 3, 1, 1, 20);
    expect(d.unlocked).toBe(before);
    expect(d.unlocked).toBeLessThanOrEqual(20);
  });
});
