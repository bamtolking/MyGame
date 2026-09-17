// 실제 브라우저(헤드리스 Chromium, 휴대폰 뷰포트) 동작 확인. play/index.html을 열어 터치로 조준·발사하고 스크린샷을 남긴다.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const url = process.env.E2E_URL || 'file://' + resolve('play/index.html');
const report = [];
const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const MAX_DRAG = 150;

async function dragShot(page, angleDeg, power, opts = {}) {
  // 발사대 화면 좌표와 당김 벡터(각도·세기 → 반대 방향)
  const p = await page.evaluate(({ angleDeg, power, MAX_DRAG }) => {
    const app = window.__waruru; const r = app.renderer; const L = app.session.level.launcher;
    const rect = r.canvas.getBoundingClientRect();
    const a = angleDeg * Math.PI / 180; const len = power * MAX_DRAG;
    const dx = -Math.cos(a) * len, dy = Math.sin(a) * len; // 화면 y는 아래가 +
    const sx = rect.left + r.ox + L.x * r.scale, sy = rect.top + r.oy + L.y * r.scale;
    return { sx, sy, ex: sx + dx * r.scale, ey: sy + dy * r.scale };
  }, { angleDeg, power, MAX_DRAG });
  const steps = 12;
  await page.touchscreen.tap; // no-op reference
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }] });
  await touch('touchStart', p.sx, p.sy);
  for (let i = 1; i <= steps; i++) { await touch('touchMove', p.sx + (p.ex - p.sx) * i / steps, p.sy + (p.ey - p.sy) * i / steps); await page.waitForTimeout(16); }
  if (opts.screenshot) await page.screenshot({ path: opts.screenshot });
  if (opts.cancel) await touch('touchCancel', p.ex, p.ey); else await touch('touchEnd', p.ex, p.ey);
  await cdp.detach();
}
async function waitResult(page, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const st = await page.evaluate(() => window.__waruru.session?.state); if (st === 'success' || st === 'failed') return st; await page.waitForTimeout(150); }
  return await page.evaluate(() => window.__waruru.session?.state);
}
async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('#title');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForSelector('#title');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  await page.tap('#btn-play');
  await page.waitForSelector('#cv');
  await page.waitForTimeout(400);
  const lay = await page.evaluate(() => { const r = window.__waruru.renderer; return { scale: r.scale, ox: r.ox, oy: r.oy, cw: r.cw, ch: r.ch }; });
  log(`${name}: stage scale=${lay.scale.toFixed(3)} canvas=${lay.cw}x${lay.ch} ox=${lay.ox.toFixed(0)} oy=${lay.oy.toFixed(0)}`);
  await page.screenshot({ path: `e2e-out/${name}-02-level1-tip.png` });
  // 튜토리얼 건너뛰기 후 조준 스크린샷 + 발사
  const skip = await page.$('#tip-skip'); if (skip) await skip.tap();
  // 짧은 당김은 취소되어야 함
  await dragShot(page, 20, 0.05);
  await page.waitForTimeout(200);
  let st = await page.evaluate(() => ({ state: window.__waruru.session.state, shots: window.__waruru.session.shotsUsed }));
  log(`${name}: short drag → state=${st.state} shotsUsed=${st.shots} (expect aiming/0)`);
  // 터치 취소도 발사되면 안 됨
  await dragShot(page, 20, 0.7, { cancel: true });
  await page.waitForTimeout(200);
  st = await page.evaluate(() => ({ state: window.__waruru.session.state, shots: window.__waruru.session.shotsUsed }));
  log(`${name}: cancelled drag → state=${st.state} shotsUsed=${st.shots} (expect aiming/0)`);
  // UI 버튼(힌트) 탭은 발사가 아님
  await page.tap('#btn-hint'); await page.waitForTimeout(100);
  st = await page.evaluate(() => ({ state: window.__waruru.session.state, shots: window.__waruru.session.shotsUsed, hint: document.getElementById('hint-area').textContent }));
  log(`${name}: hint tap → state=${st.state} shotsUsed=${st.shots} hint="${st.hint.slice(0, 30)}"`);
  await page.tap('#btn-hint'); await page.waitForTimeout(100);
  await page.screenshot({ path: `e2e-out/${name}-03-hint2.png` });
  await page.tap('#btn-hint'); // 힌트 끄기
  // 실제 해법 발사(검증 입력 L01)
  await dragShot(page, 22.5, 0.7, { screenshot: `e2e-out/${name}-04-aiming.png` });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `e2e-out/${name}-05-flight.png` });
  let res = await waitResult(page);
  const sum = await page.evaluate(() => window.__waruru.session.summary());
  log(`${name}: L01 solution via touch → ${res} ${JSON.stringify(sum)}`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `e2e-out/${name}-06-result.png` });
  // 결과 버튼 연타로 기록 중복 없는지
  const before = await page.evaluate(() => JSON.stringify(window.__waruru.save.best));
  log(`${name}: save after L01 = ${before}`);
  // 다음 스테이지 → 재시작 확인 → L02..L05 해법 재생
  const sols = { 2: [[5,0.9]], 3: [[80,0.9]], 4: [[60,0.85]], 5: [[25,0.9]], 6: [[75,0.6]], 7: [[25,0.85]], 8: [[22.5,0.9]], 9: [[60,0.65]], 10: [[40,0.7]], 11: [[72.5,0.65]], 12: [[70,0.9]], 13: [[80,0.9]], 14: [[50,0.95]], 15: [[72.5,0.65]], 16: [[60,0.6],[57.5,0.85]], 17: [[35,0.65],[50,0.8]], 18: [[77.5,0.9]], 19: [[25,0.6]], 20: [[56,0.925]] };
  let solved = 0;
  for (const [id, shots] of Object.entries(sols)) {
    await page.evaluate((id) => window.__waruru.startLevel(Number(id)), id);
    await page.waitForTimeout(300);
    const skip2 = await page.$('#tip-skip'); if (skip2) await skip2.tap();
    if (Number(id) === 3) {
      const counts0 = await page.evaluate(() => window.__waruru.session.world.counts());
      await dragShot(page, 60, 0.3); await page.waitForTimeout(1500);
      await page.tap('#btn-restart'); await page.waitForTimeout(200);
      const counts1 = await page.evaluate(() => window.__waruru.session.world.counts());
      log(`${name}: L03 restart bodies ${counts0.bodies}→${counts1.bodies} constraints ${counts0.constraints}→${counts1.constraints}`);
    }
    for (let k = 0; k < shots.length; k++) {
      // 다음 발사가 가능해질 때까지 대기(이전 결과 유지 확인)
      for (let w = 0; w < 60; w++) { const st = await page.evaluate(() => window.__waruru.session.state); if (st === 'aiming' || st === 'success' || st === 'failed') break; await page.waitForTimeout(150); }
      const st = await page.evaluate(() => window.__waruru.session.state); if (st !== 'aiming') break;
      await dragShot(page, shots[k][0], shots[k][1]); await page.waitForTimeout(700);
    }
    res = await waitResult(page);
    const s2 = await page.evaluate(() => window.__waruru.session.summary());
    if (res === 'success') solved++;
    if (Number(id) === 3) await page.screenshot({ path: `e2e-out/${name}-07-L03-ropecut.png` });
    if (Number(id) === 9) await page.screenshot({ path: `e2e-out/${name}-08-L09-protect.png` });
    if (Number(id) === 18) await page.screenshot({ path: `e2e-out/${name}-09-L18-chain.png` });
    if (Number(id) === 20) await page.screenshot({ path: `e2e-out/${name}-10-L20-final.png` });
    log(`${name}: L${String(id).padStart(2,'0')} solution via touch → ${res} goals=${s2.goalsDone}/${s2.goals} stars=${s2.stars}`);
  }
  log(`${name}: solved via touch ${solved}/${Object.keys(sols).length} follow-up stages`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `e2e-out/${name}-10-L05-result.png` });
  // 일시정지: 스텝이 멈추는지
  await page.evaluate(() => window.__waruru.startLevel(1)); await page.waitForTimeout(300);
  const skip3 = await page.$('#tip-skip'); if (skip3) await skip3.tap();
  await dragShot(page, 22.5, 0.7); await page.waitForTimeout(200);
  await page.tap('#btn-pause'); await page.waitForTimeout(200);
  const s1 = await page.evaluate(() => window.__waruru.session.step_); await page.waitForTimeout(700); const s2 = await page.evaluate(() => window.__waruru.session.step_);
  log(`${name}: pause step frozen=${s1 === s2} (${s1}→${s2})`);
  await page.screenshot({ path: `e2e-out/${name}-11-pause.png` });
  await page.tap('#p-resume'); await page.waitForTimeout(500);
  const s3 = await page.evaluate(() => window.__waruru.session.step_);
  log(`${name}: resumed steps advancing=${s3 > s2}`);
  // 새로고침 → 타이틀에서 이어하기(스테이지 처음부터)
  await page.reload(); await page.waitForSelector('#title');
  const t = await page.evaluate(() => document.getElementById('btn-play').textContent);
  log(`${name}: after reload title button="${t}"`);
  await page.tap('#btn-levels'); await page.waitForTimeout(200);
  await page.screenshot({ path: `e2e-out/${name}-12-levels.png` });
  log(`${name}: errors=${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`);
  await ctx.close();
  return errors.length;
}
let errs = 0;
const only = process.env.E2E_ONLY;
if (!only || only === 'p390') errs += await run('phone-390x844', { width: 390, height: 844 });
if (!only || only === 'p360') errs += await run('small-360x800', { width: 360, height: 800 });
if (!only || only === 'p430') errs += await run('large-430x932', { width: 430, height: 932 });
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n'));
console.log(errs ? `E2E FAILED with ${errs} errors` : 'E2E OK');
process.exit(errs ? 1 : 0);
