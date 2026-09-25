// 시각 점검용 스크린샷 투어 + 부하 장면 FPS 측정.
// 사용: node scripts/shots.mjs [html파일] [출력폴더]   (기본 play/index.html → e2e-out/shots)
// 헤드리스 Chromium(소프트웨어 렌더)이라 FPS는 실기기보다 낮게 나온다 — 변경 전후 비교용.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = resolve(process.argv[2] || 'play/index.html');
const out = process.argv[3] || 'e2e-out/shots';
mkdirSync(out, { recursive: true });
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-certificate-errors'] });
const report = [];
const log = m => { console.log(m); report.push(m); };

async function scene(page, name, setup, waitMs = 1200) {
  await page.evaluate(setup);
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${out}/${name}.png` });
}

async function closeModals(page) {
  for (let i = 0; i < 12; i++) {
    const k = await page.evaluate(() => window.__app.modals.kind);
    if (!k) return;
    if (k === 'levelup') await page.evaluate(() => { const w = window.__app.world; w.levelQueue = 0; w.choices = []; w.phase = 'play'; window.__app.modals.close(); });
    else if (k === 'chest') await page.evaluate(() => { const w = window.__app.world; w.chest = null; w.phase = 'play'; window.__app.modals.close(); });
    else if (k === 'lunch') await page.evaluate(() => { const w = window.__app.world; w.lunchOffered = true; w.phase = 'play'; window.__app.modals.close(); });
    else await page.evaluate(() => window.__app.modals.close());
    await page.waitForTimeout(150);
  }
}

async function run(tag, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + html);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kaltoe.profile.v1', JSON.stringify({ v: 1, coins: 12345, attendance: { last: new Date().toISOString().slice(0, 10), day: 1, total: 5 }, tutorialDone: true, hints: ['move','autoAttack','levelup','ult','elite','evolveReady','lunch','yageun','meta'], unlocked: ['stage:crunch','stage:dinner','stage:holiday','feature:daily','feature:heat','feature:overtime'] })); });
  await page.reload();
  await page.waitForTimeout(3500);
  const att = page.locator('.confirm-wrap .btn.primary'); if (await att.count()) await att.click();
  await page.screenshot({ path: `${out}/${tag}-01-title.png` });
  for (const stage of tag === 'phone' ? ['office', 'crunch', 'dinner', 'holiday'] : ['office']) {
    await page.evaluate(s => window.__app.startRun({ char: s === 'crunch' ? 'lee' : s === 'dinner' ? 'han' : s === 'holiday' ? 'choi' : 'kim', stage: s, heat: 0, daily: false }), stage);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__dbg.invuln());
    // 초반 전투(20초 진행)
    await page.mouse.move(viewport.width / 2, viewport.height * 0.7); await page.mouse.down();
    for (let i = 0; i < 20; i++) { await page.mouse.move(viewport.width / 2 + Math.cos(i) * 40, viewport.height * 0.7 + Math.sin(i) * 40); await page.waitForTimeout(250); await closeModals(page); }
    await page.mouse.up();
    await closeModals(page);
    await page.screenshot({ path: `${out}/${tag}-${stage}-02-early.png` });
    if (stage !== 'office') continue;
    // 무기 잔뜩 + 적 대량(후반 부하)
    await page.evaluate(() => {
      const d = window.__dbg; d.time(460); d.level(40);
      for (const [id, lv] of [['fountain_storm', 1], ['toner', 'max'], ['ctrlz', 'max'], ['coffee', 'max'], ['cards', 'max'], ['keyboard', 'max']]) d.give(id, lv);
      d.passive('busybody', 5); d.passive('gym', 5);
      d.spawn('memo', 120, 260); d.spawn('spam', 80, 320); d.spawn('kpi', 30, 240); d.spawn('printer', 2, 200);
    });
    await page.waitForTimeout(2500); await closeModals(page);
    await page.screenshot({ path: `${out}/${tag}-03-heavy.png` });
    if (process.env.QUALITY) await page.evaluate(q => { const a = window.__app; a.profile.settings.quality = q; a.applySettings(); }, process.env.QUALITY);
    await page.waitForTimeout(300);
    const f0 = await page.evaluate(() => { window.__fpsN = 0; window.__fpsT = performance.now(); const tick = () => { window.__fpsN++; if (performance.now() - window.__fpsT < 5000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 0; });
    await page.waitForTimeout(5200);
    const fps = await page.evaluate(() => window.__fpsN / 5);
    const st = await page.evaluate(() => window.__app.debugState());
    log(`[${tag}] heavy scene: enemies=${st?.enemies} fps=${fps.toFixed(1)} work=${st?.work?.toFixed(2)}ms quality=${st?.quality} dpr=${st?.dpr} (headless swiftshader)`);
    await closeModals(page);
    // 보스전
    await page.evaluate(() => { const d = window.__dbg; d.spawn('bujang', 1, 180); d.spawn('memo', 30, 250); });
    await page.waitForTimeout(3500); await closeModals(page);
    await page.screenshot({ path: `${out}/${tag}-04-boss.png` });
    // 궁극기
    await page.evaluate(() => { const w = window.__app.world; w.player.ult = w.player.ultMax; });
    await page.locator('.ult').dispatchEvent('pointerdown');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${tag}-05-ult.png` });
    await page.waitForTimeout(800); await closeModals(page);
    // 레벨업 창
    await page.evaluate(() => { const w = window.__app.world; w.player.xp += w.player.xpNext * 1.01; w.pickups.push({ kind: 'xp', x: w.player.x, y: w.player.y, value: 1, vx: 0, vy: 0, pull: true, t: 1, dead: false, pt: 1 }); });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${tag}-06-levelup.png` });
    await closeModals(page);
    // 상자
    await page.evaluate(() => { const w = window.__app.world; w.pickups.push({ kind: 'chest', x: w.player.x, y: w.player.y, value: 0, vx: 0, vy: 0, pull: true, t: 1, dead: false, pt: 1 }); });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${out}/${tag}-07-chest.png` });
    await closeModals(page);
    // 일시정지
    await page.locator('.pausebtn').dispatchEvent('pointerdown'); await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${tag}-08-pause.png` });
    await page.evaluate(() => window.__app.setPaused(false));
  }
  log(`[${tag}] errors: ${errors.length ? errors.slice(0, 5).join(' | ') : 'none'}`);
  await ctx.close();
}

await run('phone', { width: 390, height: 844 });
await run('land', { width: 844, height: 390 });
await browser.close();
writeFileSync(`${out}/report.txt`, report.join('\n'));
