// 헤드리스 Chromium으로 play/index.html을 휴대폰 크기로 열어 화면을 찍는다 (shots/).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
mkdirSync('shots', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const browser = await chromium.launch({ executablePath: exe, headless: true });
const errors = [];
const pages = (process.argv[2] ?? ',f.spinach,f.canola-oil,c.anthocyanin,s:ㅂㄹㅂㄹ,s:두리안').split(',');
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${scheme} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('fonts.g') && errors.push(`${scheme} console: ${m.text()}`));
  await page.goto(url);
  for (const p of pages) {
    if (p.startsWith('s:')) {
      await page.fill('#q', p.slice(2));
      await page.waitForTimeout(150);
    } else {
      await page.evaluate((h) => { location.hash = h; }, p);
      await page.waitForTimeout(150);
    }
    const name = (p || 'home').replace(/[^a-z0-9ㄱ-힣.-]/gi, '_');
    await page.screenshot({ path: `shots/${scheme}-${name}.png`, fullPage: process.env.FULL === '1' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) errors.push(`${scheme} ${p}: horizontal overflow ${overflow}px`);
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
