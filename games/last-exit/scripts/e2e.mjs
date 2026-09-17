// 실제 브라우저(헤드리스 Chromium, 휴대폰 뷰포트·터치 에뮬레이션) 실기동 테스트.
// 개발 서버(기본 http://localhost:5174) 또는 E2E_URL 을 대상으로 하며 스크린샷은 e2e-out/ 에 저장.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const url = process.env.E2E_URL || 'http://localhost:5174/';
mkdirSync('e2e-out', { recursive: true });
const report = []; const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failures = 0;
function check(cond, msg) { if (cond) log('  ✓ ' + msg); else { failures++; log('  ✗ ' + msg); } }

async function run(name, viewport, full) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = (n) => page.screenshot({ path: `e2e-out/${name}-${n}.png` });
  const sum = () => page.evaluate(() => window.__app.debug.summary());
  const joyX = 100, joyY = viewport.height - 130; let touching = false;
  async function touchStart() { if (touching) return; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joyX, y: joyY, id: 1 }] }); touching = true; }
  async function touchMove(dx, dy) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: joyX + dx * 42, y: joyY + dy * 42, id: 1 }] }); }
  async function touchEnd() { if (!touching) return; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); touching = false; }
  /** 목표 함수가 주는 좌표로 터치 조이스틱 조작. until 이 true 가 되거나 시간 초과까지 */
  async function drive(goal, until, timeoutMs, opts = {}) {
    const t0 = Date.now(); await touchStart(); let last = 0;
    while (Date.now() - t0 < timeoutMs) {
      const st = await sum(); if (!st) break;
      if (await until(st)) { await touchEnd(); return true; }
      if (st.status !== 'active' || st.sheet) break;
      const g = await goal(st); if (!g) { await touchMove(0, 0); await page.waitForTimeout(80); continue; }
      const d = await page.evaluate(([x, y]) => window.__app.debug.dirTo(x, y), g);
      await touchMove(d[0], d[1]);
      if (opts.dash && Date.now() - last > 1200) { const danger = await page.evaluate(() => { const s = window.__app.state; return s.enemies.some(e => (e.state === 'windup' || e.state === 'fuse' || e.state === 'charge') && Math.hypot(e.x - s.player.x, e.y - s.player.y) < 90); }); if (danger) { await page.tap('#btn-dash'); last = Date.now(); } }
      await page.waitForTimeout(60);
    }
    await touchEnd(); return false;
  }
  const nearestEnemyOrChest = async (st) => page.evaluate(() => { const s = window.__app.state; const p = s.player; let best = null, bd = 1e9; for (const e of s.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = [e.x, e.y]; } } if (best && bd < 130) { const [ux, uy] = [(p.x - best[0]) / bd, (p.y - best[1]) / bd]; return [p.x + ux * 60, p.y + uy * 60]; } if (best) return best; const c = s.chests.find(c => !c.opened && c.kind === 'chest'); if (c) return [c.x, c.y]; const l = s.loots.find(l => !l.blocked); if (l) return [l.x, l.y]; return null; });
  const clearZone = async (zone, timeoutMs) => drive(nearestEnemyOrChest, st => st.cleared || st.zone !== zone, timeoutMs, { dash: true });

  log(`\n=== ${name} (${viewport.width}×${viewport.height}) ===`);
  await page.goto(url); await page.waitForSelector('#title'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#title');
  await shot('01-title');
  await page.tap('#title .menu button.primary'); await page.waitForSelector('#sheet .panel'); await shot('02-start');
  await page.fill('#sheet input', '7'); await page.tap('#sheet button.primary'); await page.waitForSelector('#cv'); await page.waitForTimeout(500);
  // 레이아웃: 버튼 겹침 검사
  const rects = await page.evaluate(() => { const g = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vis: r.width > 0 }; }; return { dash: g('btn-dash'), bag: g('btn-bag'), pause: g('btn-pause'), top: g('topbar'), hint: g('hint') }; });
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  check(!overlap(rects.dash, rects.bag) && !overlap(rects.top, rects.dash) && rects.dash.y + rects.dash.h <= viewport.height, '대시·가방·상단 UI가 겹치지 않고 화면 안에 있음');
  check(rects.dash.w >= 44 && rects.bag.h >= 44, '버튼 크기 44px 이상');
  let st = await sum(); const x0 = st.x, y0 = st.y;
  // 이동: 조이스틱 드래그
  await touchStart(); await touchMove(1, 0); await page.waitForTimeout(500); st = await sum(); check(st.x - x0 > 40, `조이스틱 오른쪽 드래그로 이동 (Δx=${(st.x - x0).toFixed(0)})`);
  await touchEnd(); await page.waitForTimeout(150); const xs = (await sum()).x; await page.waitForTimeout(300); check(Math.abs((await sum()).x - xs) < 0.01, '터치를 놓으면 즉시 멈춤');
  // UI 버튼 터치가 이동으로 처리되지 않음
  const before = await sum(); await page.tap('#btn-bag'); await page.waitForTimeout(200); const sheetOpen = await page.evaluate(() => !document.getElementById('sheet').classList.contains('hidden'));
  check(sheetOpen, '가방 버튼으로 시트 열림'); check((await sum()).paused === true, '가방 시트가 전투를 정지시킴');
  await shot('03-bag'); await page.tap('#sheet h2 .close'); await page.waitForTimeout(150); const after = await sum();
  check(Math.abs(after.x - before.x) < 1 && Math.abs(after.y - before.y) < 1, '버튼 터치가 이동 입력으로 새지 않음'); check(after.paused === false, '시트 닫으면 재개');
  // 대시
  await page.tap('#btn-dash'); await page.waitForTimeout(100); await page.tap('#btn-dash'); await page.waitForTimeout(400); const dashes = await page.evaluate(() => window.__app.state.stats.dashes); check(dashes === 1, `대시 버튼 연타 → 1회만 발동 (${dashes})`);
  // 일시정지: 시간 정지
  await page.tap('#btn-pause'); await page.waitForTimeout(200); const t1 = (await sum()).time; await page.waitForTimeout(600); check((await sum()).time === t1, '일시정지 중 게임 시간 정지'); await shot('04-pause'); await page.tap('#sheet button.primary'); await page.waitForTimeout(100);
  // 백그라운드 전환 → 자동 일시정지 + 입력 해제
  await touchStart(); await touchMove(0, 1); await page.waitForTimeout(150);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(200); check((await sum()).paused === true, '백그라운드 전환 시 자동 일시정지'); check(await page.evaluate(() => window.__app.input.joy.active === false), '백그라운드 전환 시 이동 입력 해제');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await touchEnd(); await page.tap('#sheet button.primary'); await page.waitForTimeout(100);
  // 1구역 정리
  const ok1 = await clearZone(1, 120000); st = await sum(); log(`  1구역: cleared=${st.cleared} kills=${st.kills}/${st.need} hp=${st.hp} bag=${JSON.stringify(st.bag)} value=${st.value} t=${st.time.toFixed(0)}s fps=${st.fps.toFixed(0)}`);
  check(ok1 && st.cleared, '1구역 목표 완료'); await shot('05-combat-cleared');
  check(st.phase === 'ability' && st.sheet === 'ability', '완료 후 능력 선택 시트'); await shot('06-ability');
  await page.tap('#sheet .card.pick'); await page.waitForTimeout(100); await page.tap('#sheet button.primary'); await page.waitForTimeout(200); st = await sum(); check(st.phase === 'cleared' && Object.keys(st.abilities).length === 1, `능력 1개 선택 (${JSON.stringify(st.abilities)})`);
  check(st.save === '저장됨', `저장 상태: ${st.save}`);
  // 상자·전리품 회수 후 문으로
  await drive(async () => page.evaluate(() => { const s = window.__app.state; const c = s.chests.find(c => !c.opened && c.kind === 'chest'); if (c) return [c.x, c.y]; const l = s.loots.find(l => !l.blocked); if (l) return [l.x, l.y]; return [s.zoneRt.door.x, s.zoneRt.door.y]; }), async (st) => st.chests === 0 && st.loots === 0 && Math.hypot(st.x - st.door.x, st.y - st.door.y) < 30, 60000);
  st = await sum(); log(`  1구역 회수: bag=${JSON.stringify(st.bag)} weight=${st.weight} value=${st.value}`);
  const ib = await page.evaluate(() => { const b = document.getElementById('btn-interact'); return b.classList.contains('hidden') ? null : b.textContent; }); check(ib && ib.includes('다음 구역'), `문 앞 상호작용 버튼: ${ib}`);
  await page.tap('#btn-interact'); await page.waitForTimeout(200); await shot('07-door-confirm'); await page.tap('#sheet .btnrow button:last-child'); await page.waitForTimeout(300);
  st = await sum(); check(st.zone === 2, '2구역 진입'); check(st.save === '저장됨', '2구역 진입 스냅샷 저장');
  // 새로고침 → 이어하기 (구역 진입 시점)
  await page.reload(); await page.waitForSelector('#title'); const resumeBtn = await page.$('#title .menu button.primary'); const rt = resumeBtn ? await resumeBtn.textContent() : ''; check(rt.includes('이어하기') && rt.includes('2구역'), `이어하기 버튼: ${rt}`);
  await resumeBtn.tap(); await page.waitForSelector('#cv'); await page.waitForTimeout(400); st = await sum(); check(st.zone === 2 && st.kills === 0 && Math.abs(st.value - (await sum()).value) < 1, `복원: zone=${st.zone} kills=${st.kills} hp=${st.hp} value=${st.value}`);
  const ok2 = await clearZone(2, 150000); st = await sum(); log(`  2구역: cleared=${st.cleared} hp=${st.hp} value=${st.value} t=${st.time.toFixed(0)}s`); check(ok2 && st.cleared, '2구역 목표 완료');
  await shot('08-zone2-cleared');
  // 탈출 지점으로 → 탈출 요청
  await drive(async (st) => [st.pad.x, st.pad.y], async (st) => Math.hypot(st.x - st.pad.x, st.y - st.pad.y) < 30, 60000);
  const ib2 = await page.evaluate(() => document.getElementById('btn-interact').textContent); check(ib2.includes('탈출 요청'), `탈출 지점 버튼: ${ib2}`); await shot('09-exit-choice');
  await page.tap('#btn-interact'); await page.waitForTimeout(200); st = await sum(); check(st.escape && st.escape.active, '탈출 요청 시작');
  // 탈출 중: 패드 안에서 버티기 (적을 향해 쏘되 패드 중심 근처 유지)
  const t0 = Date.now(); await touchStart(); let shotTaken = false;
  while (Date.now() - t0 < 30000) { st = await sum(); if (!st || st.status !== 'active') break; const d = await page.evaluate(() => { const s = window.__app.state; const p = s.zoneRt.exitPad; const dx = p.x - s.player.x, dy = p.y - s.player.y; const l = Math.hypot(dx, dy); return l > 25 ? [dx / l, dy / l] : [0, 0]; }); await touchMove(d[0], d[1]); if (!shotTaken && st.escape.progress > 2.5) { await shot('10-escaping'); shotTaken = true; } await page.waitForTimeout(60); }
  await touchEnd(); await page.waitForTimeout(1500); st = await sum(); log(`  탈출 결과: status=${st.status} hp=${st.hp} value=${st.value} t=${st.time.toFixed(0)}s`);
  check(st.status === 'escaped', '2구역 조기 탈출 성공'); await page.waitForTimeout(300); await shot('11-result-escaped');
  const vault = await page.evaluate(() => window.__app.blob.meta.vault); check(vault === st.value, `보관 재화 반영 ◆${vault} (전리품 ◆${st.value})`);
  const settled = await page.evaluate(() => window.__app.blob.meta.settledRuns.length); check(settled === 1, '정산 1회 기록');
  await page.reload(); await page.waitForSelector('#title'); const vault2 = await page.evaluate(() => window.__app.blob.meta.vault); const hasResume = await page.evaluate(() => !!window.__app.blob.run);
  check(vault2 === vault && !hasResume, `새로고침 후 재화 유지(◆${vault2}), 종료된 출정은 복구되지 않음`);
  // 해금 화면
  await page.tap('text=무기 해금'); await page.waitForTimeout(200); await shot('12-shop'); await page.tap('#sheet h2 .close'); await page.waitForTimeout(100);
  if (full) {
    // 보스전: 새 출정 → 6구역으로 점프 (디버그) → 보스 예고 스크린샷 → 사망 결과
    await page.tap('#title .menu button.primary'); await page.waitForSelector('#sheet .panel'); await page.fill('#sheet input', '9'); await page.tap('#sheet button.primary'); await page.waitForSelector('#cv'); await page.waitForTimeout(300);
    await page.evaluate(() => { window.__app.skipTutorial(); window.__app.debug.jumpZone(6); window.__app.state.bag.items.relic = 4; });
    await page.waitForTimeout(2500); st = await sum(); check(!!st.boss, '보스 등장 (체력 바)');
    let got = false; const tb = Date.now(); await touchStart();
    while (Date.now() - tb < 20000) { const pat = await page.evaluate(() => { const b = window.__app.state.enemies.find(e => e.type === 'boss'); return b && b.boss ? b.boss.pattern + ':' + b.boss.fired : null; }); if (pat === 'cone:false' || pat === 'ring:false') { await page.waitForTimeout(250); await shot('13-boss-telegraph'); got = true; break; } await touchMove(0.6, -0.4); await page.waitForTimeout(80); }
    await touchEnd(); check(got, '보스 공격 예고 표시 확인');
    await page.evaluate(() => window.__app.debug.setHp(3)); const td = Date.now(); while (Date.now() - td < 40000) { st = await sum(); if (!st || st.status !== 'active') break; await page.waitForTimeout(200); }
    await page.waitForTimeout(1600); st = await sum(); check(st.status === 'dead', `보스에게 사망 (${st.status})`); await shot('14-result-dead');
    const v3 = await page.evaluate(() => window.__app.blob.meta.vault); check(v3 === vault, `사망 후 보관 재화 유지 ◆${v3}`);
    await page.tap('#sheet .btnrow button:first-child'); await page.waitForTimeout(200);
  }
  log(`  콘솔/페이지 오류: ${errors.length}${errors.length ? '\n    ' + errors.slice(0, 5).join('\n    ') : ''}`); if (errors.length) failures++;
  await ctx.close();
}

const only = process.env.E2E_ONLY;
if (!only || only === 'phone') await run('phone-390x844', { width: 390, height: 844 }, true);
if (!only || only === 'small') await run('small-360x800', { width: 360, height: 800 }, false);
if (!only || only === 'large') await run('large-430x932', { width: 430, height: 932 }, false);
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n'));
console.log(failures ? `\nE2E FAILED (${failures})` : '\nE2E OK'); process.exit(failures ? 1 : 0);
