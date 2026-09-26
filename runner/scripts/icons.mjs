// Renders the procedural app icons to PNG (public/) using the game's own drawing code in headless Chromium.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
await page.goto('file://' + resolve('play/index.html'));
await page.waitForFunction(() => !!window.__icon);
for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
  const url = await page.evaluate(([s, m]) => window.__icon(s, m), [size, mask]);
  writeFileSync(resolve('public', name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote public/' + name);
}
await browser.close();
