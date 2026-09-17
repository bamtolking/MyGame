// 헤드리스 Chromium(모바일 뷰포트)으로 play/index.html을 실제 실행: 시작 → 이동/공격 → 빙의 → 일시정지 → 이어하기. 스크린샷은 e2e-out/ 및 docs/screenshots/.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true }); mkdirSync('docs/screenshots', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const report = []; const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

// 페이지 안에서 실행되는 자동 조작(월드 상태 → 입력)
const AUTOPILOTS = {
  // 가까운 적을 향해 접근하며 공격. 빙의 가능하면 접근 후 빙의
  fight: `(w) => {
    const p = w.player; const cand = w.possessTarget;
    if (cand && w.possessCd <= 0) return { possess: true };
    const c = w.candidates[0];
    if (c) { const dx = c.x - p.x, dy = c.y - p.y, l = Math.hypot(dx, dy) || 1; return { mx: dx / l, my: dy / l }; }
    const es = w.entities.filter(e => e.alive && e.team === 'enemy' && e.body !== 'turret');
    es.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const t = es[0]; if (!t) return {};
    const d = Math.hypot(t.x - p.x, t.y - p.y); const dx = t.x - p.x, dy = t.y - p.y;
    const want = 140; const mv = d > want ? { mx: dx / d, my: dy / d } : { mx: -dy / d * 0.7, my: dx / d * 0.7 };
    return { ...mv, attack: d < 230 };
  }`,
};

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('#title');
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#title');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  await page.tap('#t-start');
  await page.waitForTimeout(400);
  const st0 = await page.evaluate(() => { const a = window.__galaata; const w = a.run.world; return { screen: a.screen, zone: w.zoneIndex, body: w.player.body, hp: w.player.hp, enemies: w.entities.filter((e) => e.team === 'enemy').length, fps: a.fps }; });
  log(`${name}: game started ${JSON.stringify(st0)}`);
  await page.screenshot({ path: `e2e-out/${name}-02-start.png` });
  // 실제 터치: 조이스틱 드래그(왼쪽 아래)로 위로 이동
  const sx = viewport.width * 0.25, sy = viewport.height * 0.8;
  const p0 = await page.evaluate(() => ({ x: window.__galaata.run.world.player.x, y: window.__galaata.run.world.player.y }));
  await page.touchscreen.tap; // noop reference
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - i * 6, id: 1 }] }); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  const p1 = await page.evaluate(() => ({ x: window.__galaata.run.world.player.x, y: window.__galaata.run.world.player.y, stick: window.__galaata.input.state.stickActive }));
  log(`${name}: joystick moved player dy=${(p1.y - p0.y).toFixed(0)} (expect negative) stickReleased=${!p1.stick}`);
  // 공격 버튼 터치(누르고 있기) → 투사체 생성
  const ab = await page.$('#btn-attack'); const box = await ab.boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 }] });
  await page.waitForTimeout(400);
  const shots = await page.evaluate(() => window.__galaata.debug.shots);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const held = await page.evaluate(() => window.__galaata.input.state.attack);
  log(`${name}: attack button held → shots fired=${shots} releasedAfterTouchEnd=${!held}`);
  // 자동 조작으로 첫 빙의까지
  await page.evaluate((src) => { window.__auto = eval(src); }, AUTOPILOTS.fight);
  let shot = false; const t0 = Date.now(); let st1 = null;
  while (Date.now() - t0 < 25000) {
    st1 = await page.evaluate(() => { const w = window.__galaata.run.world; return { cands: w.candidates.length, target: !!w.possessTarget, body: w.player.body, hp: w.player.hp, poss: w.stats.possessions, phase: w.phase }; });
    if (st1.cands && !shot) { await page.waitForTimeout(120); await page.screenshot({ path: `e2e-out/${name}-03-possessable.png` }); shot = true; }
    if (st1.poss > 0 || st1.phase !== 'playing') break;
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => { window.__auto = null; });
  await page.waitForTimeout(350);
  const st2 = await page.evaluate(() => { const w = window.__galaata.run.world; const p = w.player; return { body: p.body, hp: Math.round(p.hp), stab: p.stability, poss: w.stats.possessions, hudName: document.getElementById('bodyname').textContent, hudSkill: document.getElementById('skill-txt').textContent, phase: w.phase }; });
  log(`${name}: after autopilot ${JSON.stringify(st2)}`);
  await page.screenshot({ path: `e2e-out/${name}-04-possessed.png` });
  // 일시정지: 시간 정지 확인
  await page.tap('#btn-pause'); await page.waitForTimeout(200);
  const t1 = await page.evaluate(() => window.__galaata.run.world.time); await page.waitForTimeout(600); const t2 = await page.evaluate(() => window.__galaata.run.world.time);
  log(`${name}: pause freezes time=${t1 === t2}`);
  await page.screenshot({ path: `e2e-out/${name}-05-pause.png` });
  await page.tap('#p-resume'); await page.waitForTimeout(300);
  const t3 = await page.evaluate(() => window.__galaata.run.world.time);
  log(`${name}: resumed time advances=${t3 > t2}`);
  // 도움말/도감/설정 열고 닫기
  await page.tap('#btn-pause'); await page.tap('#p-help'); await page.waitForTimeout(150);
  const helpOpen = await page.evaluate(() => !document.getElementById('help').classList.contains('hidden'));
  await page.screenshot({ path: `e2e-out/${name}-06-help.png` });
  await page.tap('#h-back'); await page.tap('#p-settings'); await page.waitForTimeout(150);
  const setOpen = await page.evaluate(() => !document.getElementById('settings').classList.contains('hidden'));
  await page.tap('#s-back'); await page.tap('#p-resume'); await page.waitForTimeout(150);
  log(`${name}: help=${helpOpen} settings=${setOpen} back to game=${await page.evaluate(() => window.__galaata.screen)}`);
  // 리로드 → 이어하기
  await page.reload(); await page.waitForSelector('#title');
  const resume = await page.evaluate(() => !document.getElementById('t-resume').classList.contains('hidden'));
  log(`${name}: resume button after reload=${resume}`);
  if (resume) { await page.tap('#t-resume'); await page.waitForTimeout(400); const st3 = await page.evaluate(() => { const w = window.__galaata.run.world; return { zone: w.zoneIndex, body: w.player.body, hp: Math.round(w.player.hp) }; }); log(`${name}: resumed ${JSON.stringify(st3)}`); await page.screenshot({ path: `e2e-out/${name}-07-resumed.png` }); }
  // 버튼 겹침 검사
  const overlap = await page.evaluate(() => {
    const ids = ['btn-attack', 'btn-skill', 'btn-possess', 'btn-interact', 'btn-pause']; const rs = ids.map((i) => document.getElementById(i).getBoundingClientRect());
    const bad = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) bad.push(ids[i] + '/' + ids[j]); }
    const inside = rs.every((r) => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight);
    const minSize = Math.min(...rs.map((r) => Math.min(r.width, r.height)));
    return { bad, inside, minSize };
  });
  log(`${name}: buttons overlap=${overlap.bad.length ? overlap.bad.join(',') : 'none'} inside=${overlap.inside} minSize=${overlap.minSize.toFixed(0)}px`);
  log(`${name}: errors=${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`);
  await ctx.close();
  return errors.length;
}
let errs = 0;
const only = process.env.E2E_ONLY;
const vps = [['phone-360x800', { width: 360, height: 800 }], ['phone-390x844', { width: 390, height: 844 }], ['phone-430x932', { width: 430, height: 932 }]];
for (const [n, vp] of vps) if (!only || n.includes(only)) errs += await run(n, vp);
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n'));
for (const f of ['phone-390x844-01-title.png', 'phone-390x844-02-start.png', 'phone-390x844-03-possessable.png', 'phone-390x844-04-possessed.png', 'phone-390x844-05-pause.png', 'phone-360x800-04-possessed.png', 'phone-430x932-04-possessed.png']) if (existsSync('e2e-out/' + f)) copyFileSync('e2e-out/' + f, 'docs/screenshots/' + f);
console.log(errs ? `FAILED with ${errs} errors` : 'E2E OK');
process.exit(errs ? 1 : 0);
