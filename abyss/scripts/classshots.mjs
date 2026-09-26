// Screenshots one class in action (idle, walking, basic attack and every skill) from a built page.
// Usage: node abyss/scripts/classshots.mjs <classId> [outDir] [pageHtml]
//   pageHtml: a single-file build (module scripts can't load from file:// otherwise). Private build:
//     npx vite build --config abyss/vite.config.ts --outDir $TMP/dist-x --emptyOutDir && DIST=$TMP/dist-x OUT=$TMP/x.html node abyss/scripts/singlefile.mjs
//   defaults to abyss/play/index.html
// Writes <outDir>/<cls>-*.png and prints page errors. The class is started directly (no unlock needed).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cls = process.argv[2] ?? 'warrior';
const out = resolve(process.argv[3] ?? join(root, 'e2e-out', 'classes'));
const page0 = resolve(process.argv[4] ?? join(root, 'play', 'index.html'));
mkdirSync(out, { recursive: true });
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT') && !m.text().includes('Failed to load resource')) errors.push('console: ' + m.text()); });
await page.goto('file://' + page0 + '?hq');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(400);
await page.evaluate((cls) => window.__app.startGame(cls, '테스트', null), cls);
await page.waitForTimeout(700);
const shot = (name) => page.screenshot({ path: join(out, `${cls}-${name}.png`) });
await shot('00-town');
// strong hero on floor 2, every skill learned at rank 8, a pack of monsters next to it
await page.evaluate(() => {
  const g = window.__app.g, h = g.hero;
  h.level = 30; h.attrs.vit += 400; h.attrs.ene += 200; h.skillPts = 60;
  for (let r = 0; r < 8; r++) for (let s = 0; s < 5; s++) g.learnSkill(s);
  g.enterFloor(2, 'start');
  g.refreshStats(); h.hp = h.st.maxHp; h.mp = h.st.maxMp;
});
await page.waitForTimeout(500);
const pull = () => page.evaluate(() => {
  const g = window.__app.g, h = g.hero;
  const ms = g.world.monsters.filter((m) => !m.dead && m.rank !== 'boss').slice(0, 6);
  ms.forEach((m, i) => { m.x = h.x + 2.2 + (i % 3) * 0.9; m.y = h.y + 0.6 + Math.floor(i / 3) * 0.9 - 0.4; m.awake = true; m.hp = Math.max(m.hp, m.maxHp); });
  h.hp = h.st.maxHp; h.mp = h.st.maxMp; h.cds = [0, 0, 0, 0, 0]; h.act = null;
  // drop a held attack intent too, or the next skill key comes back 'busy'
  h.intent = null; h.path = null;
});
const aim = () => page.evaluate(() => {
  const a = window.__app, g = a.g, h = g.hero;
  const m = g.world.monsters.filter((q) => !q.dead).sort((p, q) => Math.hypot(p.x - h.x, p.y - h.y) - Math.hypot(q.x - h.x, q.y - h.y))[0];
  if (!m) return null;
  return { x: a.r.cam.sxOf(m.x, m.y), y: a.r.cam.syOf(m.x, m.y) - 20 };
});
await pull();
await page.waitForTimeout(300);
await shot('01-idle');
// walking
await page.evaluate(() => { const g = window.__app.g, h = g.hero; g.setIntent({ type: 'move', x: h.x - 3, y: h.y - 1 }); });
await page.waitForTimeout(350);
await shot('02-walk');
await page.waitForTimeout(500);
await pull();
// basic attack: hold left click on the nearest monster
let p = await aim();
if (p) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(260); await shot('03-basic-a'); await page.waitForTimeout(160); await shot('03-basic-b'); await page.mouse.up(); }
for (let s = 0; s < 5; s++) {
  await page.waitForTimeout(250);
  await pull();
  await page.waitForTimeout(150);
  p = await aim();
  if (p) await page.mouse.move(p.x, p.y);
  await page.keyboard.press(String(s + 1));
  for (const [i, wait] of [[0, 90], [1, 220], [2, 420]]) { await page.waitForTimeout(wait); await shot(`1${s}-skill${s + 1}-${i}`); }
}
// inventory + skills panel (icons)
await page.keyboard.press('i'); await page.waitForTimeout(250); await shot('20-inventory'); await page.keyboard.press('Escape');
await page.keyboard.press('k'); await page.waitForTimeout(250); await shot('21-skills'); await page.keyboard.press('Escape');
console.log(`${cls}: screenshots in ${out}`);
console.log(`${cls}: errors=${errors.length}`);
for (const e of errors.slice(0, 12)) console.log('  ' + e);
await browser.close();
