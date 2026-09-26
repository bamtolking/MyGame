// 실기동 점검: claude.ai 뷰어와 비슷한 조건(다른 출처의 샌드박스 iframe, 휴대폰 높이, 링크 클릭을 가로채는 호스트)에서
// 이동·탭·뒤로 가기·질문·AI 분석 흐름이 끝까지 도는지 확인한다. window.claude는 흉내 낸다.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = readFileSync(resolve('play/index.html'));
const inner = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(app); }).listen(4102);
const outer = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>
<iframe id=f src="http://localhost:4102/index.html" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`);
}).listen(4101);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  if (window === window.top) return;
  // 호스트가 a[href] 클릭을 가로채 아무 일도 안 하는 상황을 흉내 낸다.
  window.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (a) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  const food = {
    name: '두리안', en: 'Durian', emoji: '🍈', category: '과일', summary: '열대 과일입니다. (모의 응답)',
    verdict: { tone: 'balanced', text: '적당량이면 괜찮아요.' }, basis: '생 두리안 과육 100g', serving: { label: '과육 2쪽 (약 80g)', grams: 80 },
    nutrients: { kcal: 147, carb: 27.1, fiber: 3.8, protein: 1.5, fat: 5.3, potassium: 436, vitC: 19.7 },
    compounds: [
      { id: 'potassium', amount: '436mg/100g', role: '혈압 조절에 기여합니다.' },
      { name: '휘발성 황화합물', effect: 'mixed', role: '냄새를 냅니다.', pathway: { title: '알코올 대사 방해 가설', evidence: 'limited', steps: [{ title: '흡수', body: '흡수됩니다.' }, { title: '효소', body: 'ALDH를 억제할 수 있습니다.' }, { title: '결과', body: '술과 함께 먹으면 불편할 수 있습니다.' }] } },
      { id: 'vitamin-c', amount: '19.7mg/100g', role: '항산화에 쓰입니다.' },
    ],
    howToEat: [{ title: '술과 함께 먹지 않기', body: '알코올 분해가 늦어질 수 있습니다.' }, { title: '냉장 보관', body: '밀폐합니다.' }],
    pairings: { good: ['물'], avoid: ['술'] }, cautions: ['신장질환자는 양을 조절하세요.'], myths: [],
    faq: [{ q: '술과 같이 먹으면 위험한가요?', a: '불편감이 생길 수 있습니다. [근거 제한적]' }, { q: '하루에 얼마나 먹어도 되나요?', a: '과육 2~3쪽이 적당합니다.\n• 칼륨이 많습니다\n• 열량이 높은 편입니다' }],
  };
  window.__calls = [];
  const sample = async () => ({ text: 'x', truncated: false });
  sample.json = async (input, opts) => {
    window.__calls.push({ opts: { modelTier: opts?.modelTier, cache: opts?.cache } });
    await new Promise((r) => setTimeout(r, 150));
    opts?.onText?.({ text: '{"name":', delta: '{"name":' });
    await new Promise((r) => setTimeout(r, 150));
    return input.includes('"자동차"') ? { notFood: true, message: '자동차는 먹는 것이 아니에요.' } : food;
  };
  window.claude = { use: async (n) => (n === 'sample' ? sample : null) };
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const check = (label, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) errors.push(label); };

await page.goto('http://127.0.0.1:4101/');
const frame = page.frames().find((f) => f.url().includes(':4102'));
await frame.waitForSelector('.home');
const f = frame;
const state = () => f.evaluate(() => ({ h1: document.querySelector('#view h1')?.textContent, scroll: document.getElementById('scroller').scrollTop, docScroll: document.scrollingElement.scrollTop, hash: location.hash }));
const shot = (n) => page.screenshot({ path: `shots/e2e-${n}.png` });

// 1. 홈 하단 분류 목록의 식품 이름 → 식품 화면 (스크롤을 내린 상태에서)
await f.evaluate(() => { document.getElementById('scroller').scrollTop = 99999; });
await f.locator('.cat a', { hasText: '브로콜리' }).tap();
let s = await state();
check('홈 목록 → 식품 화면', s.h1 === '브로콜리', JSON.stringify(s));
check('이동하면 맨 위부터 보임', s.scroll === 0 && s.docScroll === 0);
check('문서 자체는 스크롤되지 않음(한 화면 앱)', await f.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1));
await shot('01-food');

// 2. 탭
await f.locator('.tabs [data-tab="cmp"]').tap();
check('성분·기전 탭 → 해당 패널만 보임', await f.evaluate(() => !document.getElementById('panel-cmp').hidden && document.getElementById('panel-nut').hidden));
await f.evaluate(() => { document.getElementById('scroller').scrollTop = 1500; });
await f.locator('.tabs [data-tab="warn"]').tap();
const tabState = await f.evaluate(() => { const sc = document.getElementById('scroller'); const t = document.querySelector('.tabs'); return { visible: !document.getElementById('panel-warn').hidden, tabsVisible: t.getBoundingClientRect().top >= sc.getBoundingClientRect().top - 1 && t.getBoundingClientRect().top < sc.getBoundingClientRect().top + 400 }; });
check('내려간 상태에서 탭 → 새 패널 처음이 보임', tabState.visible && tabState.tabsVisible, JSON.stringify(tabState));
check('탭이 주소에 남음', (await state()).hash.endsWith('.warn'));
await shot('02-tab');

// 3. 성분 이름 → 성분 화면 → 뒤로
await f.locator('.tabs [data-tab="cmp"]').tap();
await f.locator('#panel-cmp .cc-name').first().tap();
s = await state();
check('성분 이름 → 성분 화면', s.h1 === '설포라판', JSON.stringify(s));
await f.locator('#back').tap();
await f.waitForTimeout(400);
s = await state();
check('뒤로 → 이전 식품 화면', s.h1 === '브로콜리', JSON.stringify(s));
await f.locator('#back').tap();
await f.waitForTimeout(400);
check('다시 뒤로 → 홈', await f.evaluate(() => !!document.querySelector('.home')));

// 4. 홈 추천 카드 → 해당 탭으로 바로
await f.locator('.feat').first().tap();
check('추천 카드 → 블루베리 주의·오해 탭', await f.evaluate(() => document.querySelector('#view h1').textContent === '블루베리' && !document.getElementById('panel-warn').hidden));

// 5. 근거 배지 → 안내 화면, 브랜드 → 홈
await f.locator('#panel-warn').evaluate(() => {});
await f.locator('.tabs [data-tab="cmp"]').tap();
await f.locator('#panel-cmp .ev').first().tap();
check('근거 배지 → 근거 수준 안내', (await state()).h1 === '근거 수준과 자료 출처');
await f.locator('.brand').tap();
check('로고 → 홈', await f.evaluate(() => !!document.querySelector('.home')));

// 6. 질문 (데이터가 있으면)
const faqCount = await f.evaluate(() => document.querySelectorAll('.home .clist .crow').length);
if (faqCount) {
  await f.locator('.home .clist .crow').first().tap();
  const qa = await f.evaluate(() => { const d = document.querySelector('.qa[open]'); const sc = document.getElementById('scroller'); return { open: !!d, panel: !document.getElementById('panel-faq').hidden, inView: d ? d.getBoundingClientRect().top < sc.getBoundingClientRect().bottom && d.getBoundingClientRect().bottom > sc.getBoundingClientRect().top : false }; });
  check('많이 묻는 질문 → 질문 탭에서 그 질문이 펼쳐져 보임', qa.open && qa.panel && qa.inView, JSON.stringify(qa));
  await shot('03-faq');
  await f.fill('#faq-filter', '하루');
  const vis = await f.evaluate(() => [...document.querySelectorAll('.qa')].filter((d) => !d.hidden).length);
  check('질문 안에서 찾기', vis > 0);
  await f.fill('#q', '임산부');
  await f.waitForTimeout(150);
  const n = await f.evaluate(() => [...document.querySelectorAll('#view .sec h2')].some((h) => h.textContent.startsWith('질문')));
  check('검색창에서 질문 검색', n);
} else console.log('skip 질문 점검 (아직 질문 데이터 없음)');

// 7. AI 분석 (DB에 없는 식품)
await f.fill('#q', '두리안');
await f.waitForSelector('[data-ai-analyze]');
await f.locator('[data-ai-analyze]').tap();
await f.waitForSelector('.ai-banner', { timeout: 5000 });
s = await state();
check('AI 분석 → 결과 화면', s.h1 === '두리안' && decodeURIComponent(s.hash) === '#a.두리안', JSON.stringify(s));
const call = await f.evaluate(() => window.__calls[0]);
check('default 모델·24시간 캐시', call.opts.modelTier === 'default' && call.opts.cache.gcTime === 86400000);
await f.locator('.tabs [data-tab="faq"]').tap();
const aiFaq = await f.evaluate(() => ({ n: document.querySelectorAll('#panel-faq .qa').length, badge: !!document.querySelector('#panel-faq .ev'), list: document.querySelectorAll('#panel-faq .qa-a li').length }));
check('AI 분석에도 질문 탭', aiFaq.n === 2 && aiFaq.badge && aiFaq.list === 2, JSON.stringify(aiFaq));
await f.locator('.tabs [data-tab="nut"]').tap();
await f.locator('[data-grams="80"]').tap();
check('1회 분량 전환', (await f.locator('.label-size').innerText()).includes('80g'));
await f.fill('#q', '자동차');
await f.locator('[data-ai-analyze]').tap();
await f.waitForFunction(() => document.querySelector('[data-ai-slot]')?.textContent.includes('먹는 것이 아니에요'));
check('먹는 것이 아닐 때 안내', true);
check('Claude에게 묻는 입력칸은 없음', await f.evaluate(() => !document.querySelector('.ask, #ask-input')));

await browser.close();
inner.close();
outer.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join('\n') : '\nall passed');
process.exit(errors.length ? 1 : 0);
