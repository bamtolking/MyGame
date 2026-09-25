// 실제 브라우저 테스트 (헤드리스 크로미움, 휴대폰 화면). play/index.html 을 열어 터치로 한 판을 끝까지 해 본다.
// 사용: npm run build && npm run e2e   (스크린샷: e2e-out/, 보고서: e2e-out/report.txt)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const report = [];
let failures = 0;
const log = m => { console.log(m); report.push(m); };
const check = (name, cond, extra = '') => { if (!cond) failures++; log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function run(name, viewport) {
  log(`\n== ${name} (${viewport.width}x${viewport.height}) ==`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: `e2e-out/${name}-${n}.png` });
  const S = fn => page.evaluate(fn);
  const wait = ms => page.waitForTimeout(ms);
  const tapWorld = async (wx, wy) => {
    const p = await page.evaluate(([x, y]) => window.__nyang.renderer.toScreen(x, y), [wx, wy]);
    await page.touchscreen.tap(p.x, p.y);
  };

  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#t-play');
  await wait(800);
  await shot('01-title');
  check('title shows start + daily + dex buttons', await page.isVisible('#t-play') && await page.isVisible('#t-daily') && await page.isVisible('#t-dex'));

  // 한 판 시작
  await page.tap('#t-play');
  await wait(300);
  check('game starts', (await S(() => window.__nyang.mode)) === 'play');
  check('first-time hint shown', await page.isVisible('.hint'));
  // 터치로 떨어뜨리기 (상자 폭 곳곳)
  const xs = [60, 300, 180, 110, 250, 40, 320, 150, 210, 90, 270, 180, 130, 230];
  for (const x of xs) { await tapWorld(x, 200); await wait(560); }
  const st1 = await S(() => { const g = window.__nyang.game; return { drops: g.stats.drops, bodies: g.world.bodies.length, merges: g.stats.merges, score: g.score }; });
  check('touch drops land in the box', st1.drops === xs.length, JSON.stringify(st1));
  check('merges happen and score', st1.merges > 0 && st1.score > 0);
  // 드래그 조준
  const a = await page.evaluate(() => window.__nyang.renderer.toScreen(40, 100));
  const b = await page.evaluate(() => window.__nyang.renderer.toScreen(300, 100));
  await page.evaluate(([a, b]) => {
    const cv = document.getElementById('cv');
    const ev = (type, x) => cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: a.y, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true }));
    ev('pointerdown', a.x); ev('pointermove', (a.x + b.x) / 2);
    window.__dragX = window.__nyang.game.holdX;
    ev('pointermove', b.x);
  }, [a, b]);
  const aimX = await S(() => window.__nyang.game.holdX);
  check('drag moves the held cat', aimX > 250, `holdX=${aimX.toFixed(0)}`);
  await page.evaluate(([b]) => document.getElementById('cv').dispatchEvent(new PointerEvent('pointerup', { clientX: b.x, clientY: b.y, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true })), [b]);
  await wait(600);
  await shot('02-playing');

  // 능력
  await page.tap('[data-power="liquify"]');
  await wait(150);
  check('liquify starts', (await S(() => window.__nyang.game.liquify)) > 0);
  await wait(900);
  await shot('03-liquify');
  await wait(4200);
  check('liquify ends and restores friction', (await S(() => window.__nyang.game.liquify === 0 && window.__nyang.game.world.p.friction === window.__nyang.game.rules.friction)));
  await page.tap('[data-power="shake"]');
  await wait(100);
  check('shake starts', (await S(() => window.__nyang.game.shake)) > 0);
  await wait(1500);
  const before = await S(() => ({ n: window.__nyang.game.world.bodies.length, c: window.__nyang.game.charges.punch, mode: window.__nyang.mode, over: window.__nyang.game.over, danger: window.__nyang.game.danger }));
  log('info before punch ' + JSON.stringify(before));
  await page.tap('[data-power="punch"]');
  await wait(100);
  check('punch enters targeting', await S(() => window.__nyang.renderer.targeting));
  await shot('04-punch-target');
  const target = await S(() => { const bs = window.__nyang.game.world.bodies; const b = bs[bs.length - 1]; const p = window.__nyang.renderer.toScreen(b.x, b.y); const el = document.elementFromPoint(p.x, p.y); return { x: b.x, y: b.y, sx: p.x, sy: p.y, el: el && (el.id || el.className) }; });
  log('info punch target ' + JSON.stringify(target));
  await tapWorld(target.x, target.y);
  await wait(200);
  const after = await S(() => ({ n: window.__nyang.game.world.bodies.length, c: window.__nyang.game.charges.punch, t: window.__nyang.renderer.targeting }));
  check('punch removes a cat and uses a charge', after.n <= before.n - 1 && after.c === before.c - 1 && !after.t, JSON.stringify({ before, after }));

  // 일시정지
  await page.tap('#btn-pause');
  await wait(200);
  const t1 = await S(() => window.__nyang.game.time); await wait(600); const t2 = await S(() => window.__nyang.game.time);
  check('pause freezes the game', t1 === t2 && (await S(() => window.__nyang.mode)) === 'pause');
  await shot('05-pause');
  await page.tap('#ps-go');
  await wait(200);
  check('resume', (await S(() => window.__nyang.mode)) === 'play');

  // 저장 → 새로고침 → 이어하기
  const saved = await S(() => { window.__nyang.save(); const g = window.__nyang.game; return { score: g.score, n: g.world.bodies.length }; });
  await page.reload();
  await page.waitForSelector('#t-continue', { timeout: 5000 }).catch(() => {});
  check('continue button after reload', await page.isVisible('#t-continue'));
  await page.tap('#t-continue');
  await wait(200);
  const resumed = await S(() => { const g = window.__nyang.game; return { score: g.score, n: g.world.bodies.length }; });
  check('resume restores score and cats', resumed.score === saved.score && resumed.n === saved.n, JSON.stringify({ saved, resumed }));

  // 넘치게 만들기 → 집사 찬스 → 다시 넘침 → 결과
  // 중력을 끄고 테두리 위에 고양이 하나를 걸쳐 두면 2.2초 뒤 넘침 판정
  const overflow = () => S(() => {
    const g = window.__nyang.game;
    g.world.p.gravity = 0;
    for (const b of g.world.bodies) { b.vx = 0; b.vy = 0; }
    const r = 43;
    g.world.add({ id: g.nextId++, tier: 5, x: g.rules.boxW / 2, y: -20, vx: 0, vy: 0, a: 0, w: 0, r, rt: r, invM: 1 / (r * r), born: g.time - 5, over: 0, touched: true, dead: false, hit: 0, chain: 0, ct: g.time - 5, px: 0, py: 0, pa: 0, ovx: 0, ovy: 0, cf: 0, cl: 0, cr: 0 });
  });
  const gravityBack = () => S(() => { const g = window.__nyang.game; g.world.p.gravity = g.rules.gravity; });
  await overflow();
  await page.waitForSelector('#rv-yes', { timeout: 15000 }).catch(() => {});
  check('revive offer appears on overflow', await page.isVisible('#rv-yes'));
  await shot('06-revive');
  await page.tap('#rv-yes');
  await gravityBack();
  await wait(300);
  check('revive continues the game', (await S(() => window.__nyang.mode)) === 'play' && (await S(() => window.__nyang.game.revived)));
  await overflow();
  await page.waitForSelector('#rs-share', { timeout: 15000 }).catch(() => {});
  check('results sheet after second overflow', await page.isVisible('#rs-share'));
  await wait(1600);
  await shot('07-results');
  const card = await S(() => { const img = document.getElementById('rs-card'); return img && img.naturalWidth; });
  check('share card image rendered', card === 1080, `width=${card}`);
  await page.tap('#rs-share');
  await wait(400);
  const shared = await S(() => !!document.querySelector('.toast') || !!document.querySelector('.copybox'));
  check('share gives feedback (copy or text box)', shared);
  await page.tap('#rs-home');
  await wait(300);
  check('best score shown on title', await page.isVisible('.best-line'));
  check('no saved run after game over', !(await page.isVisible('#t-continue')));

  // 도감
  await page.tap('#t-dex');
  await wait(300);
  const dexCount = await S(() => document.querySelectorAll('.dex-item[data-tier]').length);
  const found = await S(() => document.querySelectorAll('.dex-item[data-tier]:not(.locked)').length);
  check('dex lists 11 cats, some found', dexCount === 11 && found >= 2, `found=${found}`);
  await shot('08-dex');
  await page.tap('.dex-item[data-tier="0"]');
  await wait(200);
  check('dex detail opens', await page.isVisible('#dd-cat'));
  await page.tap('#dd-back'); await wait(150);
  await page.tap('#dx-close'); await wait(150);

  // 설정
  await page.tap('#t-settings');
  await wait(200);
  await page.tap('#st-sfx');
  check('settings toggle sfx', (await page.getAttribute('#st-sfx', 'aria-checked')) === 'false');
  await page.tap('#st-sfx');
  await shot('09-settings');
  await page.tap('#st-close'); await wait(150);

  // 오늘의 상자
  await page.tap('#t-daily');
  await wait(200);
  check('daily intro', await page.isVisible('#dl-go'));
  await shot('10-daily');
  await page.tap('#dl-go');
  await wait(300);
  check('daily game starts', (await S(() => window.__nyang.game.mode)) === 'daily' && await page.isVisible('.mode-chip'));
  for (const x of [80, 280, 180]) { await tapWorld(x, 150); await wait(500); }
  await S(() => { window.__nyang.game.revived = true; });
  await wait(600);
  await overflow();
  await page.waitForSelector('#rs-share', { timeout: 15000 }).catch(() => {});
  check('daily results', await page.isVisible('#rs-share'));
  await page.tap('#rs-home'); await wait(300);
  const dailyLabel = await page.textContent('#t-daily');
  check('daily marked done on title', /완료/.test(dailyLabel || ''), (dailyLabel || '').trim().replace(/\s+/g, ' '));
  await page.tap('#t-daily'); await wait(300);
  check('daily done sheet with countdown', await page.isVisible('#dd-cd'));
  await page.tap('#dd-back'); await wait(150);

  // 많이 쌓였을 때 프레임
  await S(() => window.__nyang.stage('pile'));
  await wait(3000);
  const fps = await S(() => window.__nyang.fps);
  log(`info fps with a full box (headless, software GL): ${fps.toFixed(0)}`);
  await shot('11-full');

  // HUD 겹침 확인
  const overlap = await S(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    const a = r('.hud-top'), g = r('#gauge'), b = r('.hud-bottom');
    return { gaugeBelowTop: g.top >= a.top, bottomInView: b.bottom <= innerHeight + 1, rightInView: b.right <= innerWidth + 1 };
  });
  check('HUD fits the screen', overlap.bottomInView && overlap.rightInView, JSON.stringify(overlap));

  check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await ctx.close();
}

const only = process.env.E2E_ONLY;
if (!only || only === 'phone') await run('phone-390x844', { width: 390, height: 844 });
if (!only || only === 'small') await run('small-360x640', { width: 360, height: 640 });
if (!only || only === 'land') await run('landscape-844x390', { width: 844, height: 390 });
if (!only || only === 'tablet') await run('tablet-768x1024', { width: 768, height: 1024 });
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n') + '\n');
log(failures ? `\nE2E FAILED: ${failures} checks` : '\nE2E OK');
process.exit(failures ? 1 : 0);
