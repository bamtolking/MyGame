// 데이터 무결성 검사. 성분 설명의 구조, 식품의 영양 수치 타당성, 참조 무결성을 확인한다.
import { describe, expect, it } from 'vitest';
import { COMPOUND_CATALOG, COMPOUND_IDS, TAG_IDS } from '../src/data/catalog';
import { COMPOUNDS } from '../src/data/compounds';
import { FOODS } from '../src/data/foods';
import { NUTRIENT_IDS } from '../src/data/nutrients';

const EVIDENCE = ['strong', 'moderate', 'limited', 'contested'];
const EFFECT = ['benefit', 'mixed', 'caution', 'harm'];
const VERDICT = ['good', 'balanced', 'caution', 'limit'];
const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

describe('성분 구조', () => {
  for (const c of COMPOUNDS) {
    it(`${c.id} (${c.name})`, () => {
      expect(COMPOUND_IDS).toContain(c.id);
      expect(filled(c.name) && filled(c.en) && filled(c.summary) && filled(c.evidenceNote)).toBe(true);
      expect(EFFECT).toContain(c.effect);
      expect(c.tags.length).toBeGreaterThan(0);
      for (const t of c.tags) expect(TAG_IDS).toContain(t);
      expect(c.pathways.length).toBeGreaterThanOrEqual(1);
      expect(c.pathways.length).toBeLessThanOrEqual(4);
      for (const p of c.pathways) {
        expect(filled(p.title)).toBe(true);
        expect(EVIDENCE).toContain(p.evidence);
        expect(p.steps.length).toBeGreaterThanOrEqual(2);
        for (const s of p.steps) expect(filled(s.title) && filled(s.body)).toBe(true);
      }
      for (const s of [...(c.facts ?? []), ...(c.cautions ?? []), ...(c.refs ?? [])]) expect(filled(s)).toBe(true);
    });
  }
});

describe('성분 목록', () => {
  it('성분 id가 중복되지 않는다', () => {
    const ids = COMPOUNDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('목록의 모든 성분에 설명이 있다', () => {
    const have = new Set(COMPOUNDS.map((c) => c.id));
    const missing = COMPOUND_IDS.filter((id) => !have.has(id)).map((id) => `${id}(${COMPOUND_CATALOG[id]})`);
    expect(missing).toEqual([]);
  });
});

describe('식품 구조', () => {
  for (const f of FOODS) {
    it(`${f.id} (${f.name})`, () => {
      expect(filled(f.name) && filled(f.en) && filled(f.summary) && filled(f.basis) && filled(f.emoji)).toBe(true);
      expect(VERDICT).toContain(f.verdict.tone);
      expect(filled(f.verdict.text)).toBe(true);
      expect(f.serving.grams).toBeGreaterThan(0);
      expect(filled(f.serving.label)).toBe(true);

      const n = f.nutrients;
      for (const [k, v] of Object.entries(n)) {
        expect(NUTRIENT_IDS).toContain(k);
        expect(Number.isFinite(v) && (v as number) >= 0).toBe(true);
      }
      expect(n.kcal).toBeTypeOf('number');
      const carb = n.carb ?? 0, protein = n.protein ?? 0, fat = n.fat ?? 0, fiber = n.fiber ?? 0;
      expect(carb + protein + fat).toBeLessThanOrEqual(100.5);
      if (n.sugar != null) expect(n.sugar).toBeLessThanOrEqual(carb + 0.5);
      if (n.fiber != null) expect(n.fiber).toBeLessThanOrEqual(carb + 0.5);
      const fatParts = (n.satFat ?? 0) + (n.mufa ?? 0) + (n.pufa ?? 0) + (n.transFat ?? 0);
      expect(fatParts).toBeLessThanOrEqual(fat + 0.6);
      if (n.pufa != null) expect((n.la ?? 0) + (n.ala ?? 0) + (n.epaDha ?? 0) / 1000).toBeLessThanOrEqual(n.pufa + 0.6);
      // 열량 ≈ 단백질·당질 4, 식이섬유 2, 지방 9 kcal/g. 알코올 음료는 에탄올 열량 때문에 제외.
      if (f.id !== 'alcohol' && (n.kcal ?? 0) > 20) {
        const est = 4 * protein + 4 * Math.max(0, carb - fiber) + 2 * fiber + 9 * fat;
        expect(Math.abs((n.kcal ?? 0) - est), `열량 ${n.kcal} vs 추정 ${est.toFixed(0)}`).toBeLessThanOrEqual(Math.max(15, 0.2 * (n.kcal ?? 0)));
      }

      expect(f.compounds.length).toBeGreaterThanOrEqual(3);
      const cids = f.compounds.map((c) => c.id);
      expect(new Set(cids).size).toBe(cids.length);
      for (const c of f.compounds) {
        expect(COMPOUND_IDS).toContain(c.id);
        expect(filled(c.role)).toBe(true);
      }
      expect(f.howToEat.length).toBeGreaterThanOrEqual(2);
      for (const s of f.howToEat) expect(filled(s.title) && filled(s.body)).toBe(true);
      for (const m of f.myths ?? []) expect(filled(m.claim) && filled(m.truth)).toBe(true);
    });
  }
});

describe('식품 목록', () => {
  it('식품 id와 이름이 중복되지 않는다', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    expect(new Set(FOODS.map((f) => f.name)).size).toBe(FOODS.length);
  });
});
