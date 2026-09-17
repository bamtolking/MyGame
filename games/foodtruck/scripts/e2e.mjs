// 헤드리스 Chromium(휴대폰 뷰포트)으로 실제 플레이 흐름을 실행하고 스크린샷을 e2e-out/에 남긴다.
// 실행 전 `npm run build`로 play/index.html을 만들어야 한다.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const report = [];
const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function run(name, viewport, full = true) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = (n) => page.screenshot({ path: `e2e-out/${name}-${n}.png` });
  const st = (fn) => page.evaluate(fn);
  await page.goto(url);
  await page.waitForSelector('#title');
  await st(() => { localStorage.clear(); });
  await page.reload(); await page.waitForSelector('#title');
  await shot('01-title');

  // 새로 시작 → 연습 영업
  await page.tap('text=새로 시작');
  await page.waitForSelector('.dialog');
  await page.tap('text=연습 시작');
  await page.waitForSelector('#run');
  // 손님 착석 대기
  await page.waitForFunction(() => window.__app.state.run.customers.some((c) => c.state === 'ordering'), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await shot('02-practice-order');
  // 구이 2개 생성 (탭 2회)
  await page.tap('.prodbtn.grill'); await page.waitForTimeout(150);
  await page.tap('.prodbtn.grill'); await page.waitForTimeout(150);
  let b = await st(() => window.__app.state.run.board.map((c) => (c ? `${c.family}${c.tier}` : '.')).join(''));
  log(`${name}: after 2 grill taps board=${b}`);
  // 합성: 두 칸 탭
  const idx = await st(() => window.__app.state.run.board.map((c, i) => (c ? i : -1)).filter((i) => i >= 0));
  await page.tap(`.cell[data-i="${idx[0]}"]`); await page.waitForTimeout(120);
  await shot('03-practice-selected');
  await page.tap(`.cell[data-i="${idx[1]}"]`, { force: true }); await page.waitForTimeout(200);
  b = await st(() => window.__app.state.run.board.map((c) => (c ? `${c.family}${c.tier}` : '.')).join(''));
  log(`${name}: after merge board=${b}`);
  const ready = await page.$('.order.ready');
  log(`${name}: order ready card present=${!!ready}`);
  await shot('04-practice-ready');
  await page.tap('.order.ready', { force: true });
  await page.waitForTimeout(400);
  await shot('05-practice-serving');
  await page.waitForFunction(() => window.__app.state.run.ledger.deliveries.length >= 1, null, { timeout: 15000 });
  const led = await st(() => ({ sales: window.__app.state.run.ledger.sales, tips: window.__app.state.run.ledger.tips, wait: window.__app.state.run.ledger.deliveries[0].serviceWait }));
  log(`${name}: practice delivered sales=${led.sales} tips=${led.tips} serviceWait=${led.wait}s`);
  await page.waitForSelector('#result', { timeout: 20000 });
  await shot('06-practice-result');
  const coinsAfterPractice = await st(() => window.__app.state.meta.coins);
  log(`${name}: coins after practice=${coinsAfterPractice} (expected 0)`);
  await page.tap('text=가게 배치 보러 가기');
  await page.waitForSelector('#prep');
  await page.waitForTimeout(300);
  await shot('07-prep-day1');
  // 좌석 이동: 첫 좌석(1,2) → (1,0) 배식구 옆으로 확정
  const gridBtn = (x, y) => `#prep .grid-overlay button[data-x="${x}"][data-y="${y}"]`;
  const confirmBtn = '#prep .hint button.primary';
  const before = await st(() => Array.from(document.querySelectorAll('.pathlist .pill')).map((e) => e.textContent));
  const seats0 = await st(() => window.__app.state.meta.layout.filter((f) => f.kind === 'seat'));
  await page.tap(gridBtn(seats0[0].x, seats0[0].y)); await page.waitForTimeout(150);
  await page.tap(gridBtn(1, 0)); await page.waitForTimeout(150);
  await page.tap(confirmBtn); await page.waitForTimeout(200);
  const mid = await st(() => Array.from(document.querySelectorAll('.pathlist .pill')).map((e) => e.textContent));
  // 잘못된 배치: 두 번째 좌석을 (0,1)로 → 배식구가 갇혀 거부되어야 함
  await page.tap(gridBtn(seats0[1].x, seats0[1].y)); await page.waitForTimeout(150);
  await page.tap(gridBtn(0, 1)); await page.waitForTimeout(150);
  const statusTxt = await st(() => document.querySelector('#prep .hint')?.textContent);
  const hasConfirm = await page.$(confirmBtn);
  log(`${name}: blocking layout status="${statusTxt}" confirmVisible=${!!hasConfirm}`);
  await page.tap('#prep .hint button'); await page.waitForTimeout(120); // 취소
  // 첫 좌석을 멀리(4,2)로 옮겨 경로 길이 차이 확인
  await page.tap(gridBtn(1, 0)); await page.waitForTimeout(150);
  await page.tap(gridBtn(4, 2)); await page.waitForTimeout(150);
  await shot('08-prep-preview');
  await page.tap(confirmBtn); await page.waitForTimeout(200);
  const after = await st(() => Array.from(document.querySelectorAll('.pathlist .pill')).map((e) => e.textContent));
  const layoutNow = await st(() => window.__app.state.meta.layout.map((f) => `${f.kind}@${f.x},${f.y}`).join(' '));
  log(`${name}: paths before=${JSON.stringify(before)} near=${JSON.stringify(mid)} far=${JSON.stringify(after)} layout=${layoutNow}`);
  // 1일차 영업 시작
  await page.tap('#prep .prepbar .btn');
  await page.waitForSelector('#run');
  await page.waitForFunction(() => window.__app.state.run.customers.some((c) => c.state === 'ordering'), null, { timeout: 15000 });
  await page.waitForTimeout(200);
  await shot('09-day1-start');
  // 길게 누르기: 음료 버튼 900ms 유지 → 여러 개 생성, 손 떼면 멈춤
  const drinkBtn = await page.$('.prodbtn.drink');
  const box = await drinkBtn.boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(950);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const drinks1 = await st(() => window.__app.state.run.board.filter((c) => c && c.family === 'drink').length);
  await page.waitForTimeout(600);
  const drinks2 = await st(() => window.__app.state.run.board.filter((c) => c && c.family === 'drink').length);
  log(`${name}: long-press drinks=${drinks1} after release=${drinks2} (should be equal)`);
  // 일시정지: 시간이 멈추는지
  await page.tap('#run .pause'); await page.waitForTimeout(200);
  const pt1 = await st(() => window.__app.state.run.t); await page.waitForTimeout(700); const pt2 = await st(() => window.__app.state.run.t);
  log(`${name}: paused time frozen=${pt1 === pt2} (${pt1.toFixed(2)} → ${pt2.toFixed(2)})`);
  await shot('12-pause');
  await page.tap('.dialog >> text=계속하기'); await page.waitForTimeout(150);
  const pt3 = await st(() => window.__app.state.run.t); await page.waitForTimeout(400); const pt4 = await st(() => window.__app.state.run.t);
  log(`${name}: resumed time advancing=${pt4 > pt3}`);
  // 봇으로 1일차 진행 (배속 6배)
  await st(() => { window.__app.timeScale = 6; });
  let shotsDone = { serving: false, merge: false };
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const r = await st(() => {
      const app = window.__app; const run = app.state.run; const d = window.__dbg;
      if (!run || run.phase !== 'open') return { phase: run?.phase, served: run?.stats.served };
      const ordering = run.customers.filter((c) => c.state === 'ordering').sort((a, b) => a.orderPatience - b.orderPatience);
      for (const c of ordering) if (d.orderReady(run, c)) { d.actAccept(run, c.id); app.runView.renderBoard(true); app.runView.renderOrders(true); return { acted: 'accept' }; }
      const have = d.countByKey(run.board);
      for (const c of ordering) for (const it of c.order.items) {
        const k = `${it.family}:${it.tier}`;
        if ((have[k] || 0) >= c.order.items.filter((x) => x.family === it.family && x.tier === it.tier).length) continue;
        // 아래 단계에서 만들기
        for (let t = it.tier - 1; t >= 1; t--) {
          const ids = run.board.filter((x) => x && x.family === it.family && x.tier === t).map((x) => x.id);
          if (ids.length >= 2) { d.actMerge(run, ids[0], ids[1]); app.runView.renderBoard(true); app.runView.renderOrders(true); return { acted: 'merge' }; }
        }
        d.actSpawn(run, it.family); app.runView.renderBoard(true); app.runView.renderOrders(true); return { acted: 'spawn' };
      }
      return { phase: run.phase, served: run.stats.served, carrying: run.staff.carrying };
    });
    if (r.carrying != null && !shotsDone.serving) { shotsDone.serving = true; await shot('10-day1-serving'); }
    if (r.acted === 'merge' && !shotsDone.merge) { shotsDone.merge = true; await shot('11-day1-merge'); }
    if (r.phase === 'closing' || r.phase === 'ended') break;
    await page.waitForTimeout(120);
  }
  await st(() => { window.__app.timeScale = 8; window.__app.fastClosing = true; });
  await page.waitForSelector('#result', { timeout: 60000 });
  await page.waitForTimeout(300);
  const res = await st(() => ({ coins: window.__app.state.meta.coins, unlocked: window.__app.state.meta.unlockedDay, served: window.__app.state.run.stats.served, sales: window.__app.state.run.ledger.sales, tips: window.__app.state.run.ledger.tips, settled: window.__app.state.run.settled }));
  log(`${name}: day1 result served=${res.served} sales=${res.sales} tips=${res.tips} coins=${res.coins} unlocked=${res.unlocked} settled=${res.settled}`);
  await shot('13-day1-result');
  // 결과 새로고침 → 중복 입금 없음
  await page.reload(); await page.waitForSelector('#result, #title');
  const coins2 = await st(() => window.__app.state.meta.coins);
  log(`${name}: coins after reload=${coins2} (same as ${res.coins}: ${coins2 === res.coins})`);
  if (!full) { log(`${name}: errors=${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`); await ctx.close(); return errors.length; }
  // 영업일 선택 화면 (디버그로 전체 해금하여 화면 확인)
  if (await page.$('#result')) { await page.tap('text=영업일 선택으로'); }
  else { await page.tap('text=계속하기'); }
  await page.waitForSelector('#days');
  await st(() => { window.__app.state.meta.unlockedDay = 5; window.__app.state.meta.coins += 400; window.__app.show('days'); });
  await page.waitForTimeout(200);
  await shot('14-days');
  // 4일차 준비: 구매 후 배치
  await page.tap('.daycard >> nth=3'); await page.waitForSelector('#prep'); await page.waitForTimeout(200);
  for (let i = 0; i < 3; i++) { const bb = await page.$('.shoprow .btn.primary'); if (!bb) break; await bb.tap(); await page.waitForTimeout(200); }
  await page.waitForTimeout(200);
  const meta = await st(() => ({ coins: window.__app.state.meta.coins, seats: window.__app.state.meta.layout.filter((f) => f.kind === 'seat').length, decors: window.__app.state.meta.layout.filter((f) => f.kind === 'decor').length, speed: window.__app.state.meta.staffSpeedLevel }));
  log(`${name}: after purchases coins=${meta.coins} seats=${meta.seats} decors=${meta.decors} speed=${meta.speed}`);
  await shot('15-prep-day4');
  await page.tap('#prep .prepbar .btn'); await page.waitForSelector('#run');
  await st(() => { window.__app.timeScale = 8; });
  await page.waitForFunction(() => window.__app.state.run.t > 50, null, { timeout: 30000 });
  // 봇 몇 번 돌려 고급 음식 만들기
  for (let i = 0; i < 60; i++) {
    await st(() => { const run = window.__app.state.run; const d = window.__dbg; if (run.phase !== 'open') return; const ids = run.board.filter((x) => x && x.family === 'dessert' && x.tier === 1).map((x) => x.id); if (ids.length >= 2) d.actMerge(run, ids[0], ids[1]); else { const i2 = run.board.filter((x) => x && x.family === 'dessert' && x.tier === 2).map((x) => x.id); if (i2.length >= 2) d.actMerge(run, i2[0], i2[1]); else d.actSpawn(run, 'dessert'); } window.__app.runView.renderBoard(true); window.__app.runView.renderOrders(true); });
    await page.waitForTimeout(30);
  }
  await st(() => { window.__app.timeScale = 1; });
  await page.waitForTimeout(300);
  await shot('16-day4-run');
  // 저장·이어하기: 새로고침 후 이어하기
  await st(() => window.__app.persist('e2e'));
  await page.reload(); await page.waitForSelector('#title');
  const resumeBtn = await page.$('text=영업 이어하기');
  log(`${name}: resume button present=${!!resumeBtn}`);
  if (resumeBtn) {
    await resumeBtn.tap(); await page.waitForSelector('#run'); await page.waitForTimeout(200);
    await shot('17-resume');
    const st5 = await st(() => ({ paused: window.__app.paused, t: window.__app.state.run.t, foods: window.__app.state.run.board.filter(Boolean).length, day: window.__app.state.run.dayId }));
    log(`${name}: resumed paused=${st5.paused} t=${st5.t.toFixed(1)} foods=${st5.foods} day=${st5.day}`);
    await page.tap('text=계속하기');
  }
  log(`${name}: errors=${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`);
  await ctx.close();
  return errors.length;
}

let errs = 0;
const only = process.env.E2E_ONLY;
if (!only || only === 'phone') errs += await run('phone-390x844', { width: 390, height: 844 }, true);
if (!only || only === 'small') errs += await run('small-360x800', { width: 360, height: 800 }, false);
if (!only || only === 'large') errs += await run('large-430x932', { width: 430, height: 932 }, false);
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n'));
console.log(errs ? `FAILED with ${errs} errors` : 'E2E OK');
process.exit(errs ? 1 : 0);
