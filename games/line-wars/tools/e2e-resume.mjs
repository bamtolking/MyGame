/* Save → menu → resume flow, settings modal, surrender. */
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept());
await page.goto(url, { waitUntil: 'load' });
await page.getByText('빠른 대전').first().click(); await page.getByText('경기 시작').click(); await page.waitForTimeout(500);
await page.locator('.panel .close').click();
await page.evaluate(() => { const m = window.lw.match; m.command({ type: 'buy', player: 0, unitId: 'rifles', cell: 21 }); m.skipSetup(); while (m.s.t < 40) m.step(); });
const before = await page.evaluate(() => ({ t: window.lw.match.s.t, units: window.lw.match.s.units.length, credits: Math.floor(window.lw.human.credits) }));
await page.locator('.botbar .btn').last().click(); await page.waitForTimeout(200);
await page.getByText('저장하고 메뉴로').click(); await page.waitForTimeout(400);
const hasResume = await page.getByText('이어하기').count();
console.log('menu shows 이어하기:', hasResume > 0);
await page.screenshot({ path: 'screenshots/30-menu-resume.png' });
await page.getByText('이어하기').first().click(); await page.waitForTimeout(600);
const after = await page.evaluate(() => ({ t: window.lw.match.s.t, units: window.lw.match.s.units.length, credits: Math.floor(window.lw.human.credits), paused: window.lw.match.s.paused }));
console.log('before', JSON.stringify(before), 'after', JSON.stringify(after));
// settings from pause
await page.locator('.botbar .btn').last().click(); await page.waitForTimeout(200);
await page.getByRole('button', { name: '설정' }).click(); await page.waitForTimeout(200);
await page.screenshot({ path: 'screenshots/31-settings.png' });
await page.locator('.modal .close').last().click();
await page.getByText('항복').click(); await page.waitForTimeout(2000);
console.log('after surrender result:', await page.evaluate(() => JSON.stringify(window.lw.match.s.result)));
await page.getByText('메뉴로').click(); await page.waitForTimeout(300);
console.log('saved match cleared:', (await page.getByText('이어하기').count()) === 0);
// profile screen
await page.getByText('프로필').first().click(); await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/32-profile.png' });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
