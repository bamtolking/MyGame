// 실브라우저 테스트(헤드리스 Chromium, 휴대폰 뷰포트 3종). play/index.html을 열어 실제로 조작하고 스크린샷을 남긴다.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => existsSync(p));
mkdirSync('e2e-out', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const report = [];
const log = m => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failures = 0;
const check = (name, cond, extra = '') => { log(`${cond ? '  ✔' : '  ✘'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) failures++; };

async function run(name, viewport) {
  log(`\n[${name}] ${viewport.width}×${viewport.height}`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(900);
  // 출석 체크 팝업
  const att = await page.locator('.confirm-wrap').count();
  check('출석 체크 팝업 표시', att === 1);
  await page.screenshot({ path: `e2e-out/${name}-01-attendance.png` });
  if (att) await page.locator('.confirm-wrap .btn.primary').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `e2e-out/${name}-02-title.png` });
  const coins = await page.evaluate(() => window.__app.profile.coins);
  check('출석 보상 지급', coins > 0, `₩${coins}`);

  // 메뉴 화면 순회
  for (const [label, file] of [['복지', '03-shop'], ['업적', '04-ach'], ['도감', '05-codex']]) {
    await page.locator('.title-grid .btn', { hasText: label }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `e2e-out/${name}-${file}.png` });
    await page.locator('.screen-head .btn.icon').first().click();
    await page.waitForTimeout(200);
  }
  await page.getByText('출근하기').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `e2e-out/${name}-06-char.png` });
  await page.getByText('다음 → 근무지 선택').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `e2e-out/${name}-07-stage.png` });
  await page.getByText('🏃 출근!').click();
  await page.waitForTimeout(600);
  const tut = await page.locator('.tutorial').count();
  check('첫 판 튜토리얼 표시', tut === 1);

  // 조이스틱으로 원을 그리며 이동
  const cx = viewport.width / 2, cy = viewport.height * 0.65;
  await page.touchscreen.tap(cx, cy);
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 4;
    await page.mouse.move(cx + Math.cos(a) * 45, cy + Math.sin(a) * 45);
    await page.waitForTimeout(150);
  }
  await page.mouse.up();
  let st = await page.evaluate(() => window.__app.debugState());
  check('전투 진행(처치 발생)', st && st.kills > 0, JSON.stringify(st));
  check('튜토리얼 사라짐', (await page.locator('.tutorial').count()) === 0);
  await page.screenshot({ path: `e2e-out/${name}-08-combat.png` });

  // 레벨업 강제 → 카드 선택
  await page.evaluate(() => { const w = window.__app.world; w.player.xp += w.player.xpNext * 1.01; });
  await page.evaluate(() => { const w = window.__app.world; w.pickups.push({ kind: 'xp', x: w.player.x, y: w.player.y, value: 1, vx: 0, vy: 0, pull: true, t: 1, dead: false, pt: 1 }); });
  await page.waitForTimeout(700);
  const lv = await page.locator('.modal .choice').count();
  check('레벨업 선택지 표시', lv >= 3, `${lv}개`);
  await page.screenshot({ path: `e2e-out/${name}-09-levelup.png` });
  if (lv) { await page.locator('.modal .choice').first().click(); await page.waitForTimeout(300); }
  st = await page.evaluate(() => window.__app.debugState());
  check('선택 후 전투 재개', st.phase === 'play', st.phase);

  // 궁극기 충전 → 발동
  await page.evaluate(() => { const w = window.__app.world; w.player.ult = w.player.ultMax; });
  await page.waitForTimeout(200);
  await page.locator('.ult').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  const ultUses = await page.evaluate(() => window.__app.world.stats_.ultUses);
  check('궁극기 발동', ultUses === 1);
  await page.screenshot({ path: `e2e-out/${name}-10-ult.png` });

  // 상자
  await page.evaluate(() => { const w = window.__app.world; w.pickups.push({ kind: 'chest', x: w.player.x, y: w.player.y, value: 0, vx: 0, vy: 0, pull: true, t: 1, dead: false, pt: 1 }); });
  await page.waitForTimeout(600);
  check('상자 모달', (await page.locator('.chest-stage').count()) === 1);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `e2e-out/${name}-11-chest.png` });
  const doneBtn = page.locator('.modal .btn.primary', { hasText: '받기' });
  if (await doneBtn.count()) await doneBtn.click();
  await page.waitForTimeout(300);

  // 점심: 시간을 12:00 직전으로
  await page.evaluate(() => { const w = window.__app.world; w.t = 199.5; });
  await page.waitForTimeout(900);
  check('점심 메뉴 모달', (await page.locator('.lunch-card').count()) >= 1);
  await page.screenshot({ path: `e2e-out/${name}-12-lunch.png` });
  if (await page.locator('.lunch-card').count()) await page.locator('.lunch-card').first().click();
  await page.waitForTimeout(400);

  // 일시정지
  await page.locator('.pausebtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => window.__app.world.t); await page.waitForTimeout(600); const t2 = await page.evaluate(() => window.__app.world.t);
  check('일시정지 중 시간 정지', t1 === t2);
  await page.screenshot({ path: `e2e-out/${name}-13-pause.png` });
  await page.getByText('▶ 계속 일하기').click();
  await page.waitForTimeout(1500);
  // FPS 측정
  const fps = await page.evaluate(() => window.__app.fps);
  log(`  · FPS(헤드리스 소프트웨어 렌더): ${fps.toFixed(0)}`);
  // 적 대량 소환 후 FPS
  await page.evaluate(() => {
    const w = window.__app.world;
    w.t = 480; w.player.invulnT = 30;
  });
  await page.waitForTimeout(6000);
  const st2 = await page.evaluate(() => window.__app.debugState());
  check('후반 부하에서도 진행', !!st2, st2 ? `적 ${st2.enemies}마리 FPS ${st2.fps.toFixed(0)}` : '월드 없음');
  await page.screenshot({ path: `e2e-out/${name}-14-late.png` });

  // 열린 모달 정리(레벨업/상자)
  for (let i = 0; i < 20; i++) {
    const kind = await page.evaluate(() => window.__app.modals.kind);
    if (!kind) break;
    if (kind === 'levelup') await page.locator('.modal .choice').first().click();
    else if (kind === 'chest') { await page.waitForTimeout(2500); await page.locator('.modal .btn.primary', { hasText: '받기' }).click(); }
    else if (kind === 'lunch') await page.locator('.lunch-card').first().click();
    await page.waitForTimeout(450);
  }
  await page.evaluate(() => { window.__app.world.player.invulnT = 30; });
  // 조퇴 → 결과 화면
  await page.locator('.pausebtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
  await page.getByText('🏳 조퇴하기').click();
  await page.waitForTimeout(200);
  await page.locator('.confirm-wrap .btn.danger').click();
  await page.waitForTimeout(600);
  check('결과 화면', (await page.locator('.result-head').count()) === 1);
  await page.screenshot({ path: `e2e-out/${name}-15-result.png` });
  const prof = await page.evaluate(() => ({ runs: window.__app.profile.lifetime.runs, ach: Object.keys(window.__app.profile.achievements).length, coins: window.__app.profile.coins }));
  check('판 기록 저장', prof.runs === 1, JSON.stringify(prof));
  // 새로고침 후 저장 유지
  await page.reload();
  await page.waitForTimeout(800);
  const prof2 = await page.evaluate(() => ({ runs: window.__app.profile.lifetime.runs, coins: window.__app.profile.coins }));
  check('새로고침 후 저장 유지', prof2.runs === 1 && prof2.coins === prof.coins, JSON.stringify(prof2));
  check('콘솔/페이지 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await run('phone', { width: 390, height: 844 });
await run('small', { width: 360, height: 640 });
await run('landscape', { width: 844, height: 390 });
await browser.close();
log(`\n결과: ${failures ? `실패 ${failures}건` : '모두 통과'}`);
writeFileSync('e2e-out/report.txt', report.join('\n'));
process.exit(failures ? 1 : 0);
