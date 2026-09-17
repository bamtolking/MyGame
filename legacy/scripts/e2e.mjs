// Real-browser test (headless Chromium, mobile viewport). Loads play/index.html, plays, screenshots to e2e-out/.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const url = 'file://' + resolve('legacy/play/index.html');
const report = [];
const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
async function run(name, viewport, landscape = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('#title');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForSelector('#title');
  await page.fill('#title input', '777');
  await page.tap('text=새 게임');
  await page.waitForSelector('#cv');
  await page.waitForTimeout(3600); // countdown
  const st0 = await page.evaluate(() => ({ phase: window.__app.state.phase, gold: window.__app.state.gold, units: window.__app.state.units.length }));
  log(`${name}: after countdown phase=${st0.phase} gold=${st0.gold} units=${st0.units}`);
  // summon 3 times via button
  for (let i = 0; i < 3; i++) { await page.tap('#btn-summon'); await page.waitForTimeout(150); }
  const st1 = await page.evaluate(() => ({ gold: window.__app.state.gold, units: window.__app.state.units.length, bench: window.__app.state.bench.filter(x => x != null).length, selected: window.__app.selected }));
  log(`${name}: after 3 summons gold=${st1.gold} units=${st1.units} bench=${st1.bench} selected=${st1.selected}`);
  await page.screenshot({ path: `e2e-out/${name}-02-summoned.png` });
  // tap an empty slot on canvas (slot 16 = 골목 중심1 at 200,380)
  const tapSlot = async (id) => { const p = await page.evaluate((id) => { const r = window.__app.renderer; const s = r; const sl = [{x:80,y:20},{x:170,y:20},{x:260,y:20},{x:130,y:105},{x:210,y:105},{x:290,y:105},{x:370,y:105},{x:45,y:195},{x:150,y:195},{x:240,y:195},{x:330,y:195},{x:110,y:285},{x:200,y:285},{x:290,y:285},{x:370,y:285},{x:100,y:380},{x:200,y:380},{x:280,y:380},{x:150,y:475},{x:250,y:475},{x:370,y:475},{x:145,y:565},{x:258,y:565}][id]; const rect = r.canvas.getBoundingClientRect(); return { x: rect.left + s.ox + sl.x * s.scale, y: rect.top + s.oy + sl.y * s.scale }; }, id); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(120); if (process.env.E2E_DEBUG) log(`  tap slot ${id} at ${p.x.toFixed(0)},${p.y.toFixed(0)} → log=${await page.evaluate(() => JSON.stringify(window.__app.state.log.slice(-1)))} sel=${await page.evaluate(() => window.__app.selected)}`); };
  await tapSlot(16);
  let st2 = await page.evaluate(() => ({ slot16: window.__app.state.slots[16], bench: window.__app.state.bench.filter(x => x != null).length, selected: window.__app.selected }));
  log(`${name}: after placing: slot16=${st2.slot16} bench=${st2.bench} selected=${st2.selected}`);
  // select remaining bench units and place
  for (const [bi, slot] of [[0, 17], [1, 19]]) { const has = await page.evaluate((bi) => window.__app.state.bench[bi] != null, bi); if (!has) continue; await page.tap(`.benchslot[data-idx="${bi}"]`); await page.waitForTimeout(100); await tapSlot(slot); }
  st2 = await page.evaluate(() => ({ field: window.__app.state.units.filter(u => u.loc.t === 'f').length, bench: window.__app.state.bench.filter(x => x != null).length }));
  log(`${name}: field units=${st2.field} bench=${st2.bench}`);
  // select a field unit → panel, swap by tapping another occupied slot
  await tapSlot(16); await page.waitForTimeout(100);
  const panel = await page.evaluate(() => !document.getElementById('unitpanel').classList.contains('hidden'));
  log(`${name}: unit panel visible=${panel}`);
  await page.screenshot({ path: `e2e-out/${name}-03-selected.png` });
  await tapSlot(1); // swap with starting archer
  const sw = await page.evaluate(() => ({ s1: window.__app.state.slots[1], s16: window.__app.state.slots[16] }));
  log(`${name}: after swap slot1=${sw.s1} slot16=${sw.s16}`);
  // speed 2x and let it run
  await page.tap('#btn-speed');
  await page.waitForTimeout(12000);
  let st3 = await page.evaluate(() => ({ wave: window.__app.state.wave, phase: window.__app.state.phase, life: window.__app.state.life, gold: Math.floor(window.__app.state.gold), kills: Object.values(window.__app.state.stats.killsBy).reduce((a, b) => a + b, 0), fps: window.__app.fps }));
  log(`${name}: after 12s@2x wave=${st3.wave} phase=${st3.phase} life=${st3.life} gold=${st3.gold} kills=${st3.kills} fps=${st3.fps.toFixed(0)}`);
  await page.screenshot({ path: `e2e-out/${name}-04-combat.png` });
  // open sheets
  for (const [btn, sel] of [['#btn-merge', '합성'], ['#btn-mythic', '신화'], ['#btn-upgrade', '강화'], ['#btn-odds', '확률']]) {
    await page.tap(btn); await page.waitForTimeout(200);
    const open = await page.evaluate(() => !document.getElementById('sheet').classList.contains('hidden'));
    if (btn === '#btn-merge') await page.screenshot({ path: `e2e-out/${name}-05-merge.png` });
    if (btn === '#btn-mythic') await page.screenshot({ path: `e2e-out/${name}-06-mythic.png` });
    await page.tap('#sheet .close'); await page.waitForTimeout(100);
    const closed = await page.evaluate(() => document.getElementById('sheet').classList.contains('hidden'));
    log(`${name}: sheet ${sel} open=${open} closed=${closed}`);
  }
  // skill: arm bomb, tap field
  await page.tap('#btn-bomb'); await page.waitForTimeout(100);
  await tapSlot(12);
  const sk = await page.evaluate(() => ({ cd: window.__app.state.skills.bomb, mode: window.__app.renderer.view.skillMode }));
  log(`${name}: bomb used cd=${sk.cd.toFixed(0)} mode=${sk.mode}`);
  // pause / resume
  await page.tap('#btn-pause'); await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => window.__app.state.time); await page.waitForTimeout(800); const t2 = await page.evaluate(() => window.__app.state.time);
  log(`${name}: paused time frozen=${t1 === t2}`);
  await page.screenshot({ path: `e2e-out/${name}-07-pause.png` });
  await page.tap('text=계속하기'); await page.waitForTimeout(200);
  // run to wave 5+ with bot-like summoning to test save/resume
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const w = await page.evaluate(() => { const a = window.__app; const s = a.state; if (s.phase === 'prep') a.act({ type: 'early' }); if (s.gold >= 60) { a.doSummon(); const u = s.units[s.units.length - 1]; if (u && u.loc.t === 'b') { const free = s.slots.findIndex(x => x == null); if (free >= 0) a.act({ type: 'move', id: u.id, to: { t: 'f', slot: free } }); } a.select(null); } return s.wave; });
    if (w >= 5) break; await page.waitForTimeout(500);
  }
  const st4 = await page.evaluate(() => ({ wave: window.__app.state.wave, life: window.__app.state.life, fps: window.__app.fps, save: window.__app.saveStatus, enemies: window.__app.state.enemies.length }));
  log(`${name}: reached wave=${st4.wave} life=${st4.life} fps=${st4.fps.toFixed(0)} save="${st4.save}"`);
  await page.screenshot({ path: `e2e-out/${name}-08-wave5.png` });
  // reload → resume
  await page.reload(); await page.waitForSelector('#title');
  const resumeBtn = await page.$('text=이어하기');
  log(`${name}: resume button present=${!!resumeBtn}`);
  if (resumeBtn) { await resumeBtn.tap(); await page.waitForTimeout(500); const st5 = await page.evaluate(() => ({ wave: window.__app.state.wave, phase: window.__app.state.phase, units: window.__app.state.units.length, gold: Math.floor(window.__app.state.gold) })); log(`${name}: resumed wave=${st5.wave} phase=${st5.phase} units=${st5.units} gold=${st5.gold}`); await page.screenshot({ path: `e2e-out/${name}-09-resumed.png` }); }
  log(`${name}: errors=${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`);
  await ctx.close();
  return errors.length;
}
let errs = 0;
const only = process.env.E2E_ONLY;
if (!only || only === 'phone') errs += await run('phone-390x844', { width: 390, height: 844 });
if (!only || only === 'small') errs += await run('small-360x640', { width: 360, height: 640 });
if (!only || only === 'land') errs += await run('landscape-844x390', { width: 844, height: 390 }, true);
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n'));
console.log(errs ? `FAILED with ${errs} errors` : 'E2E OK');
process.exit(errs ? 1 : 0);
