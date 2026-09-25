// 개발용: 헤드리스 Chromium으로 페이지를 열고 스크린샷/결과 JSON을 저장
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [,, url, out = 'e2e-out/shot.png', w = '430', h = '932'] = process.argv;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
try { await page.waitForFunction(() => (window).__done === true, null, { timeout: 90000 }); } catch { console.log('timeout waiting __done'); }
const res = await page.evaluate(() => (window).__result ?? null);
if (res) writeFileSync(out.replace(/\.png$/, '.json'), JSON.stringify(res, null, 1));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
