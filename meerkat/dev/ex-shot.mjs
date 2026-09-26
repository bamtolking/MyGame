// 개발용: 부위 파일의 운동 키 자세 시트를 PNG로 저장
// node dev/ex-shot.mjs <file> [--ids a,b] [--out path.png] [--dark] [--size 320] [--base http://localhost:5190/]
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const file = args[0];
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const base = opt('--base', process.env.BASE ?? 'http://localhost:5190/');
const out = opt('--out', `e2e-out/ex-${file}.png`);
const ids = opt('--ids', '');
const size = opt('--size', '');
const url = `${base}dev/ex.html?file=${file}${ids ? `&ids=${ids}` : ''}${args.includes('--dark') ? '&dark=1' : ''}${size ? `&size=${size}` : ''}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/404|favicon/.test(m.text()) && errors.push(m.text()));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 }).catch(() => errors.push('timeout'));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
console.log('saved', out);
