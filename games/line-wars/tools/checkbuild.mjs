import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const url of ['http://localhost:4173/', 'file:///home/user/MyGame/docs/linewars-single.html']) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.getByText('빠른 대전').first().click(); await page.getByText('경기 시작').click(); await page.waitForTimeout(800);
  const ok = await page.evaluate(() => !!window.lw?.match && window.lw.match.s.phase === 'setup');
  console.log(url, 'match started:', ok, 'errors:', errors.length ? errors : 'none');
  await page.close();
}
await browser.close();
