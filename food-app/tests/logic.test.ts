import { describe, expect, it } from 'vitest';
import { COMPOUNDS } from '../src/data/compounds';
import { FOODS } from '../src/data/foods';
import { buildFoodPrompt, errorInfo, sanitizeAiFood } from '../src/lib/ai';
import { fmtNum } from '../src/lib/format';
import { SearchIndex, choseong, normalize } from '../src/lib/search';

const index = new SearchIndex(FOODS, COMPOUNDS);
const top = (q: string) => index.search(q)[0];

describe('검색', () => {
  it('이름·별칭·영어로 찾는다', () => {
    expect(top('시금치')).toMatchObject({ type: 'food', id: 'spinach' });
    expect(top('시금치나물')).toMatchObject({ type: 'food', id: 'spinach' });
    expect(top('Blueberry')).toMatchObject({ type: 'food', id: 'blueberry' });
    expect(top('카놀라')).toMatchObject({ type: 'food', id: 'canola-oil' });
  });
  it('성분으로 찾는다', () => {
    expect(top('안토시아닌')).toMatchObject({ type: 'compound', id: 'anthocyanin' });
    expect(top('렉틴')).toMatchObject({ type: 'compound', id: 'lectin' });
    expect(top('오메가6')).toMatchObject({ type: 'compound', id: 'linoleic-acid' });
    expect(top('4-HNE')).toMatchObject({ type: 'compound', id: 'oxidized-lipids' });
  });
  it('초성으로 찾는다', () => {
    expect(choseong('시금치')).toBe('ㅅㄱㅊ');
    expect(top('ㅅㄱㅊ')).toMatchObject({ type: 'food', id: 'spinach' });
    expect(top('ㅂㄹㅂㄹ')).toMatchObject({ type: 'food', id: 'blueberry' });
  });
  it('한 글자 오타를 허용한다', () => {
    expect(top('블루배리')).toMatchObject({ type: 'food', id: 'blueberry' });
  });
  it('작용 태그를 찾는다', () => {
    expect(index.search('항산화').some((h) => h.type === 'tag' && h.id === 'antioxidant')).toBe(true);
  });
  it('공백·기호를 무시한다', () => {
    expect(normalize(' 강낭 콩 ')).toBe('강낭콩');
    expect(index.search('   ')).toEqual([]);
  });
});

describe('숫자 표시', () => {
  it('크기에 맞게 반올림한다', () => {
    expect(fmtNum(884)).toBe('884');
    expect(fmtNum(1234)).toBe('1,234');
    expect(fmtNum(18.64)).toBe('18.6');
    expect(fmtNum(2.71)).toBe('2.7');
    expect(fmtNum(0.078)).toBe('0.078');
    expect(fmtNum(0)).toBe('0');
  });
});

describe('AI 응답 정리', () => {
  const good = {
    name: '두리안',
    en: 'Durian',
    emoji: '🍈',
    category: '과일',
    summary: '열대 과일입니다.',
    verdict: { tone: 'balanced', text: '적당히' },
    basis: '생 두리안 100g',
    serving: { label: '과육 2쪽', grams: 80 },
    nutrients: { kcal: 147, carb: 27, fat: 5.3, protein: 1.5, bogus: 3, fiber: -1, vitC: '19.7' },
    compounds: [
      { id: 'potassium', amount: '436mg', role: '혈압 조절' },
      { id: 'potassium', role: '중복' },
      { name: '황화합물', effect: 'weird', role: '특유의 냄새', pathway: { title: '냄새', evidence: 'nope', steps: [{ title: 'a', body: 'b' }, { title: 'c', body: 'd' }] } },
      { id: 'not-a-real-id', role: '이름 없음' },
    ],
    howToEat: [{ title: '술과 함께 먹지 않기', body: '알코올 대사를 방해할 수 있습니다.' }, { title: '', body: '빈 제목' }],
    pairings: { good: ['물'], avoid: 'x' },
    cautions: ['<img src=x onerror=alert(1)>'],
    myths: [{ claim: 'c', truth: 't' }, { claim: '' }],
  };

  it('잘못된 값은 버리고 쓸 수 있는 값만 남긴다', () => {
    const r = sanitizeAiFood(good, '두리안', 1);
    expect(r?.ok).toBe(true);
    if (!r || !r.ok) return;
    const f = r.food;
    expect(f.key).toBe('두리안');
    expect(f.category).toBe('과일');
    expect(f.nutrients).toEqual({ kcal: 147, carb: 27, fat: 5.3, protein: 1.5, vitC: 19.7 });
    expect(f.compounds.map((c) => c.id ?? c.name)).toEqual(['potassium', '황화합물']);
    expect(f.compounds[1].effect).toBe('mixed');
    expect(f.compounds[1].pathway?.evidence).toBe('limited');
    expect(f.howToEat).toHaveLength(1);
    expect(f.pairings).toEqual({ good: ['물'], avoid: [] });
    expect(f.myths).toHaveLength(1);
    // 이스케이프는 화면에서 하므로 원문은 보존
    expect(f.cautions[0]).toContain('<img');
  });

  it('먹는 것이 아니면 안내 메시지를 돌려준다', () => {
    expect(sanitizeAiFood({ notFood: true, message: '자동차는 음식이 아니에요' }, '자동차')).toEqual({ ok: false, notFood: true, message: '자동차는 음식이 아니에요' });
  });

  it('형식이 맞지 않으면 null', () => {
    expect(sanitizeAiFood(null, 'x')).toBeNull();
    expect(sanitizeAiFood([1, 2], 'x')).toBeNull();
    expect(sanitizeAiFood({ name: 'x', summary: '', compounds: [] }, 'x')).toBeNull();
  });

  it('프롬프트에 성분 목록과 영양소 키가 들어간다', () => {
    const p = buildFoodPrompt('두리안');
    expect(p).toContain('anthocyanin=안토시아닌');
    expect(p).toContain('vitK(비타민 K, μg)');
    expect(new TextEncoder().encode(p).length).toBeLessThan(60000);
  });

  it('오류 코드를 안내 문구로 바꾼다', () => {
    expect(errorInfo({ code: 'not_granted' }).hide).toBe(true);
    expect(errorInfo({ code: 'cancelled' }).silent).toBe(true);
    expect(errorInfo({ code: 'rate_limited' }).message).toContain('잠시');
    expect(errorInfo('boom').code).toBe('upstream_error');
  });
});
