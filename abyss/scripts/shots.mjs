// Headless Chromium smoke run: loads play/index.html, starts a class, walks into the dungeon, fights,
// opens panels, and writes screenshots + a log to e2e-out/.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'e2e-out');
mkdirSync(out, { recursive: true });
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const url = 'file://' + resolve(root, 'play/index.html');
const log = [];
const L = (m) => { console.log(m); log.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function run(name, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr ?? 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#title');
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, `${name}-01-title.png`) });
  const cls = opts.cls ?? 'warrior';
  const idx = { warrior: 0, rogue: 1, sorcerer: 2 }[cls];
  await page.locator('.ccard').nth(idx).locator('.newrow button').click();
  await page.waitForSelector('#cv');
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, `${name}-02-town.png`) });
  // teleport into floor 1 via the sim for a deterministic check
  await page.evaluate(() => { const a = window.__app; a.g.enterFloor(opts_floor(), 'start'); function opts_floor() { return 1; } });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, `${name}-03-floor1.png`) });
  // move toward nearest monster and fight using the real input path (clicks)
  for (let i = 0; i < 40; i++) {
    const pos = await page.evaluate(() => {
      const a = window.__app, g = a.g, h = g.hero;
      let best = null, bd = 1e9;
      for (const m of g.world.monsters) { if (m.dead) continue; const d = Math.hypot(m.x - h.x, m.y - h.y); if (d < bd) { bd = d; best = m; } }
      if (!best) return null;
      const cam = a.r.cam;
      return { x: cam.sxOf(best.x, best.y), y: cam.syOf(best.x, best.y) - 20, d: bd, inView: cam.sxOf(best.x, best.y) > 0 && cam.sxOf(best.x, best.y) < cam.w && cam.syOf(best.x, best.y) > 0 && cam.syOf(best.x, best.y) < cam.h };
    });
    if (!pos) break;
    if (pos.inView) {
      if (opts.mobile) await page.touchscreen.tap(pos.x, pos.y);
      else await page.mouse.click(pos.x, pos.y);
    } else {
      await page.evaluate(() => { const g = window.__app.g; const h = g.hero; let best = null, bd = 1e9; for (const m of g.world.monsters) { if (m.dead) continue; const d = Math.hypot(m.x - h.x, m.y - h.y); if (d < bd) { bd = d; best = m; } } if (best) g.setIntent({ type: 'move', x: best.x, y: best.y }); });
    }
    await page.waitForTimeout(350);
    if (i === 20) await page.screenshot({ path: join(out, `${name}-04-combat.png`) });
    // use skill 1 now and then
    if (i % 5 === 4) await page.keyboard.press('1');
  }
  const st = await page.evaluate(() => { const g = window.__app.g; return { hp: Math.round(g.hero.hp), max: g.hero.st.maxHp, kills: g.hero.kills, lvl: g.hero.level, floor: g.world.floor, drops: g.world.drops.length, fps: Math.round(window.__app.fps) }; });
  L(`${name}: after fighting ${JSON.stringify(st)}`);
  await page.screenshot({ path: join(out, `${name}-05-after.png`) });
  // spawn some loot next to the hero to test labels + tooltip
  await page.evaluate(() => {
    const g = window.__app.g;
    for (let i = 0; i < 5; i++) g.world.drops.push({ id: g.world.nextId++, x: g.hero.x + 1 + i * 0.4, y: g.hero.y + 0.5, item: window.__genItem ? null : null, t: 1 });
    g.world.drops = g.world.drops.filter((d) => d.item || d.gold || d.pot);
  });
  // open panels
  await page.keyboard.press('i');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${name}-06-inventory.png`) });
  await page.keyboard.press('c');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${name}-07-character.png`) });
  await page.keyboard.press('Escape');
  await page.keyboard.press('k');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${name}-08-skills.png`) });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `${name}-09-map.png`) });
  await page.keyboard.press('Tab');
  // deeper zones
  for (const f of [5, 8, 11]) {
    await page.evaluate((f) => { window.__app.g.enterFloor(f, 'start'); }, f);
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(out, `${name}-10-floor${f}.png`) });
  }
  // boss floor
  await page.evaluate(() => { const g = window.__app.g; g.enterFloor(3, 'start'); const b = g.world.monsters.find((m) => m.id === g.world.bossId); g.hero.x = b.x + 3; g.hero.y = b.y + 2; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, `${name}-11-boss.png`) });
  L(`${name}: errors=${errors.length}`);
  for (const e of errors.slice(0, 10)) L('  ' + e);
  await ctx.close();
}


async function flows() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#title');
  await page.locator('.ccard').nth(0).locator('.namein').fill('테스트');
  await page.locator('.ccard').nth(0).locator('.newrow button').click();
  await page.waitForSelector('#cv');
  await page.waitForTimeout(500);
  const scr = (p) => page.evaluate(({ x, y }) => { const c = window.__app.r.cam; return { x: c.sxOf(x, y), y: c.syOf(x, y) }; }, p);
  const npcPos = (kind) => page.evaluate((k) => { const n = window.__app.g.world.npcs.find((q) => q.kind === k); return { x: n.x, y: n.y }; }, kind);
  const walkTo = async (x, y) => { await page.evaluate(({ x, y }) => window.__app.g.setIntent({ type: 'move', x, y }), { x, y }); for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); const d = await page.evaluate(({ x, y }) => Math.hypot(window.__app.g.hero.x - x, window.__app.g.hero.y - y), { x, y }); if (d < 2.2) break; } };
  // 1) talk to the smith by clicking him
  let p = await npcPos('smith');
  await walkTo(p.x + 1.5, p.y + 1.5);
  let s = await scr({ x: p.x, y: p.y });
  await page.mouse.click(s.x, s.y - 30);
  await page.waitForTimeout(1500);
  let st = await page.evaluate(() => ({ panelL: window.__app.panelL, panelR: window.__app.panelR, shop: window.__app.g.shop.length, gold: window.__app.g.hero.gold }));
  L(`flows: smith panel=${st.panelL}/${st.panelR} shop=${st.shop} gold=${st.gold}`);
  await page.screenshot({ path: join(out, 'flow-01-shop.png') });
  // give gold, buy the cheapest item via double click
  await page.evaluate(() => { window.__app.g.hero.gold = 5000; window.__app.refresh(true); });
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.__app.g.hero.inv.filter(Boolean).length);
  await page.locator('.grid.shop .cell').first().dblclick();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__app.g.hero.inv.filter(Boolean).length);
  L(`flows: bought item inv ${before} -> ${after}`);
  // hover an inventory item → tooltip
  await page.locator('.grid.inv .cell').first().hover();
  await page.waitForTimeout(200);
  const tipVis = await page.evaluate(() => !document.getElementById('tip').classList.contains('hidden'));
  L(`flows: tooltip visible=${tipVis}`);
  await page.screenshot({ path: join(out, 'flow-02-tooltip.png') });
  // sell it back with double click
  await page.locator('.grid.inv .cell').first().dblclick();
  await page.waitForTimeout(200);
  const sold = await page.evaluate(() => ({ inv: window.__app.g.hero.inv.filter(Boolean).length, gold: window.__app.g.hero.gold }));
  L(`flows: after sell inv=${sold.inv} gold=${sold.gold}`);
  await page.keyboard.press('Escape');
  // 2) equip: generate a rare weapon into the bag, double-click to equip
  await page.evaluate(() => { const g = window.__app.g; const it = { uid: 9999, base: 'longSword', rarity: 'rare', ilvl: 5, req: 1, name: '테스트의 송곳니', mods: [{ k: 'ed', v: 50 }, { k: 'str', v: 5 }, { k: 'lifeSteal', v: 3 }], dmg: [5, 12] }; g.hero.inv[0] = it; window.__app.togglePanel('inv'); });
  await page.waitForTimeout(200);
  await page.locator('.grid.inv .cell').first().dblclick();
  await page.waitForTimeout(200);
  const eq = await page.evaluate(() => window.__app.g.hero.equip.weapon?.name);
  L(`flows: equipped weapon=${eq}`);
  await page.screenshot({ path: join(out, 'flow-03-equipped.png') });
  await page.keyboard.press('Escape');
  // 3) healer + elder + gambler + stash open via click
  for (const k of ['healer', 'elder', 'gambler']) {
    p = await npcPos(k);
    await walkTo(p.x + 1.2, p.y + 1.2);
    p = await npcPos(k);
    s = await scr({ x: p.x, y: p.y });
    await page.mouse.click(s.x, s.y - 30);
    await page.waitForTimeout(1300);
    const pl = await page.evaluate(() => window.__app.panelL);
    const dbg = await page.evaluate((k) => { const g = window.__app.g; const n = g.world.npcs.find((q) => q.kind === k); return { hero: [g.hero.x.toFixed(1), g.hero.y.toFixed(1)], npc: [n.x.toFixed(1), n.y.toFixed(1)], intent: JSON.stringify(g.hero.intent), hover: JSON.stringify(window.__app.r.hover) }; }, k);
    L(`flows: npc ${k} → panel ${pl} ${JSON.stringify(dbg)}`);
    if (k === 'gambler') { await page.evaluate(() => { window.__app.g.hero.gold = 99999; window.__app.refresh(true); }); await page.locator('.gbtn').first().click(); await page.waitForTimeout(200); await page.screenshot({ path: join(out, 'flow-04-gamble.png') }); }
    if (k === 'elder') await page.screenshot({ path: join(out, 'flow-04-elder.png') });
    await page.keyboard.press('Escape');
  }
  // 4) go down the stairs by clicking the stairs tile
  await walkTo(23.5, 7.2);
  s = await scr({ x: 23.5, y: 5.5 });
  await page.mouse.click(s.x, s.y + 16);
  await page.waitForTimeout(1500);
  let fl = await page.evaluate(() => window.__app.g.world.floor);
  L(`flows: after clicking stairs floor=${fl}`);
  // 5) town portal: T, then click portal
  await page.keyboard.press('t');
  await page.waitForTimeout(400);
  const portal = await page.evaluate(() => { const p = window.__app.g.world.props.find((q) => q.kind === 'portal'); return p ? { x: p.x, y: p.y } : null; });
  if (portal) { s = await scr(portal); await page.mouse.click(s.x, s.y - 26); await page.waitForTimeout(1500); }
  fl = await page.evaluate(() => window.__app.g.world.floor);
  L(`flows: after portal floor=${fl} (expect 0)`);
  await page.screenshot({ path: join(out, 'flow-05-town-portal.png') });
  // back through the town portal
  const tp = await page.evaluate(() => { const p = window.__app.g.world.props.find((q) => q.kind === 'portal'); return p ? { x: p.x, y: p.y } : null; });
  if (tp) { await walkTo(tp.x + 1, tp.y + 1); s = await scr(tp); await page.mouse.click(s.x, s.y - 26); await page.waitForTimeout(1500); }
  fl = await page.evaluate(() => window.__app.g.world.floor);
  L(`flows: back through portal floor=${fl} (expect 1)`);
  // 6) waypoint menu from town
  await page.evaluate(() => { window.__app.g.maxFloor[0] = 7; window.__app.g.enterTown('spawn'); });
  await page.waitForTimeout(300);
  const wp = await page.evaluate(() => { const p = window.__app.g.world.props.find((q) => q.kind === 'waypoint'); return { x: p.x, y: p.y }; });
  await walkTo(wp.x + 1.5, wp.y + 1.5);
  s = await scr(wp);
  await page.mouse.click(s.x, s.y);
  await page.waitForTimeout(1500);
  const modal = await page.evaluate(() => window.__app.modal);
  L(`flows: waypoint modal=${modal}`);
  await page.screenshot({ path: join(out, 'flow-06-waypoint.png') });
  if (modal === 'waypoint') { await page.locator('.wp', { hasText: '1층' }).nth(2).click(); await page.waitForTimeout(800); }
  fl = await page.evaluate(() => window.__app.g.world.floor);
  L(`flows: waypoint travel floor=${fl} (expect 7)`);
  await page.screenshot({ path: join(out, 'flow-07-floor7.png') });
  // 7) death → respawn
  await page.evaluate(() => { const g = window.__app.g; g.hero.hp = 1; g.hero.invulnT = 0; for (const m of g.world.monsters) { if (!m.dead) { m.x = g.hero.x + 0.8; m.y = g.hero.y; m.awake = true; m.dmg = [999, 999]; break; } } });
  await page.waitForTimeout(3500);
  const dead = await page.evaluate(() => ({ dead: window.__app.g.hero.dead, modal: window.__app.modal }));
  L(`flows: death dead=${dead.dead} modal=${dead.modal}`);
  await page.screenshot({ path: join(out, 'flow-08-death.png') });
  if (dead.modal === 'death') { await page.locator('.modalbox button').first().click(); await page.waitForTimeout(600); }
  const alive = await page.evaluate(() => ({ dead: window.__app.g.hero.dead, floor: window.__app.g.world.floor, hp: window.__app.g.hero.hp }));
  L(`flows: respawned dead=${alive.dead} floor=${alive.floor} hp=${Math.round(alive.hp)}`);
  // 8) save → reload → continue
  const lvlBefore = await page.evaluate(() => { const g = window.__app.g; g.hero.level = 7; g.hero.gold = 1234; window.__app.saveNow(); return window.__app.lastSaveOk; });
  await page.reload();
  await page.waitForSelector('#title');
  const cont = await page.locator('.ccard').nth(0).locator('button.primary').first().innerText();
  L(`flows: saved=${lvlBefore} continue button="${cont.replace(/\n/g, ' ')}"`);
  await page.locator('.ccard').nth(0).locator('button.primary').first().click();
  await page.waitForTimeout(500);
  const loaded = await page.evaluate(() => ({ lvl: window.__app.g.hero.level, gold: window.__app.g.hero.gold, name: window.__app.g.hero.name, weapon: window.__app.g.hero.equip.weapon?.name }));
  L(`flows: loaded ${JSON.stringify(loaded)}`);
  // 9) menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, 'flow-09-menu.png') });
  L(`flows: errors=${errors.length}`);
  for (const e of errors.slice(0, 10)) L('  ' + e);
  await ctx.close();
}

const which = process.argv[2] ?? 'all';
if (which === 'all' || which === 'flows') await flows();
if (which === 'all' || which === 'desk') await run('desk', { width: 1280, height: 720 }, { cls: process.argv[3] ?? 'warrior' });
if (which === 'all' || which === 'phone') await run('phone', { width: 844, height: 390 }, { mobile: true, dpr: 2, cls: process.argv[3] ?? 'sorcerer' });
if (which === 'all' || which === 'portrait') await run('portrait', { width: 390, height: 844 }, { mobile: true, dpr: 2, cls: process.argv[3] ?? 'rogue' });
writeFileSync(join(out, 'log.txt'), log.join('\n'));
await browser.close();
