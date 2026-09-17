// play/index.html 을 file:// 로 열어 실행되는지 확인 (단일 파일 배포 검증)
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + resolve('play/index.html')); await page.waitForSelector('#title');
await page.tap('#title .menu button.primary'); await page.waitForSelector('#sheet .panel'); await page.tap('#sheet button.primary'); await page.waitForSelector('#cv'); await page.waitForTimeout(1500);
const st = await page.evaluate(() => window.__app.debug.summary());
console.log(`file:// 실행: zone=${st.zone} enemies=${st.enemies} fps=${st.fps.toFixed(0)} errors=${errors.length}`); if (errors.length) console.log(errors.join('\n'));
await browser.close(); process.exit(errors.length ? 1 : 0);
