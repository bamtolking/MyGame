// 자주 묻는 질문 검사: 모든 식품·성분에 충분한 질문이 있고, 형식이 맞는지.
import { describe, expect, it } from 'vitest';
import { COMPOUND_IDS } from '../src/data/catalog';
import { COMPOUND_FAQ, FOOD_FAQ } from '../src/data/faq';
import { FOOD_BY_ID, FOODS } from '../src/data/foods';
import type { QA } from '../src/data/types';

export const MIN_FOOD_QA = 15;
export const MIN_COMPOUND_QA = 12;
const norm = (s: string) => s.replace(/[\s?.,!·]/g, '');

function checkList(list: QA[]) {
  const seen = new Set<string>();
  for (const { q, a } of list) {
    expect(typeof q === 'string' && q.trim().length >= 6, `질문이 너무 짧음: ${q}`).toBe(true);
    expect(q.trim().endsWith('?'), `물음표로 끝나야 함: ${q}`).toBe(true);
    expect(typeof a === 'string' && a.trim().length >= 40, `답이 너무 짧음: ${q}`).toBe(true);
    expect(a.length, `답이 너무 김: ${q}`).toBeLessThanOrEqual(900);
    for (const m of a.matchAll(/\[(근거[^\]]*|논쟁[^\]]*)\]/g)) expect(['근거 강함', '근거 중간', '근거 제한적', '논쟁 중'], `근거 표시 형식: ${m[0]}`).toContain(m[1]);
    const k = norm(q);
    expect(seen.has(k), `중복 질문: ${q}`).toBe(false);
    seen.add(k);
  }
}

describe('식품 질문', () => {
  for (const f of FOODS) {
    it(`${f.id} (${f.name})`, () => {
      const list = FOOD_FAQ[f.id] ?? [];
      expect(list.length, `${f.id} 질문 수`).toBeGreaterThanOrEqual(MIN_FOOD_QA);
      checkList(list);
    });
  }
  it('없는 식품 id가 없다', () => {
    expect(Object.keys(FOOD_FAQ).filter((id) => !FOOD_BY_ID.has(id))).toEqual([]);
  });
});

describe('성분 질문', () => {
  for (const id of COMPOUND_IDS) {
    it(id, () => {
      const list = COMPOUND_FAQ[id] ?? [];
      expect(list.length, `${id} 질문 수`).toBeGreaterThanOrEqual(MIN_COMPOUND_QA);
      checkList(list);
    });
  }
  it('없는 성분 id가 없다', () => {
    expect(Object.keys(COMPOUND_FAQ).filter((id) => !(COMPOUND_IDS as string[]).includes(id))).toEqual([]);
  });
});
