// AI 경로 점검: window.claude를 흉내 내서 "DB에 없는 식품 분석 → 결과 화면 → 질문" 흐름이 끝까지 도는지 확인한다.
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';

const url = 'file://' + resolve('play/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  const food = {
    name: '두리안', en: 'Durian', emoji: '🍈', category: '과일',
    summary: '열대 과일로 지방과 황화합물이 많은 편입니다. (모의 응답)',
    verdict: { tone: 'balanced', text: '적당량이면 괜찮아요.' },
    basis: '생 두리안 과육 100g', serving: { label: '과육 2쪽 (약 80g)', grams: 80 },
    nutrients: { kcal: 147, carb: 27.1, fiber: 3.8, protein: 1.5, fat: 5.3, potassium: 436, vitC: 19.7, vitB1: 0.37 },
    compounds: [
      { id: 'potassium', amount: '436mg/100g', role: '나트륨 배출을 도와 혈압 조절에 기여합니다.' },
      { name: '휘발성 황화합물', effect: 'mixed', amount: '미량', role: '특유의 냄새를 냅니다.', pathway: { title: '알코올 대사 방해 가설', evidence: 'limited', steps: [{ title: '흡수', body: '황화합물이 흡수됩니다.' }, { title: '효소', body: 'ALDH 활성을 억제할 수 있습니다.' }, { title: '결과', body: '술과 함께 먹으면 불편감이 생길 수 있습니다.' }] } },
      { id: 'vitamin-c', amount: '19.7mg/100g', role: '항산화와 콜라겐 합성에 쓰입니다.' },
    ],
    howToEat: [{ title: '술과 함께 먹지 않기', body: '알코올 분해가 늦어질 수 있습니다.' }, { title: '냉장 보관', body: '냄새가 퍼지지 않게 밀폐합니다.' }],
    pairings: { good: ['물'], avoid: ['술'] },
    cautions: ['칼륨 제한이 필요한 신장질환자는 양을 조절하세요.'],
    myths: [],
  };
  const calls = [];
  window.__calls = calls;
  const sample = async (input, opts) => {
    calls.push({ kind: 'text', input });
    const text = '두리안의 칼륨은 소장에서 흡수됩니다. [근거 강함]\n\n• 첫째 항목 [논쟁 중]\n• 둘째 항목';
    await new Promise((r) => setTimeout(r, 50));
    opts?.onText?.({ text: text.slice(0, 20), delta: text.slice(0, 20) });
    await new Promise((r) => setTimeout(r, 50));
    opts?.onText?.({ text, delta: text.slice(20) });
    return { text, truncated: false, modelTierApplied: 'default' };
  };
  sample.json = async (input, opts) => {
    calls.push({ kind: 'json', input, opts: { modelTier: opts?.modelTier, cache: opts?.cache } });
    await new Promise((r) => setTimeout(r, 200));
    opts?.onText?.({ text: '{"name":', delta: '{"name":' });
    await new Promise((r) => setTimeout(r, 200));
    if (input.includes('"자동차"')) return { notFood: true, message: '자동차는 먹는 것이 아니에요.' };
    return food;
  };
  sample.limits = async () => ({ maxPromptBytes: 65536 });
  window.claude = { use: async (name) => (name === 'sample' ? sample : null) };
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const check = (label, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) errors.push(label); };

await page.goto(url);
await page.fill('#q', '두리안');
await page.waitForSelector('[data-ai-analyze]');
check('검색 결과에 AI 분석 버튼', true);
await page.tap('[data-ai-analyze]');
await page.waitForSelector('.ai-cta.busy');
check('분석 중 표시', true);
await page.waitForSelector('.ai-banner', { timeout: 5000 });
check('분석 후 AI 결과 화면으로 이동', decodeURIComponent(await page.evaluate(() => location.hash)) === '#a.두리안');
check('성분 카드 3개', (await page.locator('.cc').count()) === 3);
check('목록 밖 성분의 경로 다이어그램', (await page.locator('.cc .path li').count()) >= 3);
check('카탈로그 성분은 링크', (await page.locator('.cc a.cc-name[href="#c.potassium"]').count()) === 1);
const call = await page.evaluate(() => window.__calls[0]);
check('default 모델·24시간 캐시로 요청', call.opts.modelTier === 'default' && call.opts.cache.gcTime === 86400000);
await page.screenshot({ path: 'shots/ai-food.png' });

await page.tap('[data-grams="80"]');
check('1회 분량 전환', (await page.locator('.label-size').innerText()).includes('80g'));

check('질문 영역 보임', await page.locator('#ask').isVisible());
await page.fill('#ask-input', '하루에 얼마나 먹어도 돼요?');
await page.tap('.ask-form button');
await page.waitForFunction(() => document.querySelectorAll('.answer .ev').length >= 2);
check('답변에 근거 배지 렌더링', true);
check('답변 목록 렌더링', (await page.locator('.answer ul li').count()) === 2);
const q = await page.evaluate(() => window.__calls.at(-1).input);
check('질문 프롬프트에 식품 데이터 포함', q.includes('두리안') && q.includes('칼륨'));
await page.screenshot({ path: 'shots/ai-answer.png', fullPage: false });

await page.goto(url + '#');
await page.waitForSelector('.chip.ai');
check('홈의 최근 목록에 AI 분석 표시', true);

await page.fill('#q', '자동차');
await page.tap('[data-ai-analyze]');
await page.waitForFunction(() => document.querySelector('[data-ai-slot]')?.textContent.includes('먹는 것이 아니에요'));
check('먹는 것이 아닐 때 안내', true);

await page.evaluate(() => { location.hash = 'f.spinach'; });
await page.waitForSelector('#ask:not([hidden])');
check('DB 식품 페이지에도 질문 영역', true);

await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join('\n') : '\nall passed');
process.exit(errors.length ? 1 : 0);
