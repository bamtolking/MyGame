// 팩 앤 블래스트 실기동 테스트: 헤드리스 Chromium, 휴대폰 뷰포트 3종. 개발 서버(기본 http://localhost:5173)를 먼저 띄워야 한다.
// 실제 UI 탭으로 튜토리얼 흐름을 진행하고, 이후 구간은 페이지 안의 상태 API로 배치한 뒤 UI 버튼으로 출발한다.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const base = process.env.E2E_URL || 'http://localhost:5173/';
mkdirSync('e2e-out', { recursive: true });
const report = [];
const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function tapCell(page, x, y) {
  await page.waitForTimeout(60); // 레이아웃 변경 후 다음 프레임에서 캔버스 좌표가 갱신된다
  const p = await page.evaluate(([x, y]) => { const v = window.__pb.bagView; v.resize(); const r = v.canvas.getBoundingClientRect(); return { x: r.left + v.ox + (x + 0.5) * v.cs, y: r.top + v.oy + (y + 0.5) * v.cs }; }, [x, y]);
  await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(120);
}
const state = (page) => page.evaluate(() => { const r = window.__pb.run; return r ? { phase: r.phase, stage: r.stage, hp: r.hp, parts: r.parts, items: r.items.map(i => `${i.id}${i.grade}@${i.loc}:${i.x},${i.y}r${i.rot}`), locked: r.grid.locked.filter(Boolean).length, screen: window.__pb.screen, tut: window.__pb.tutorialStep } : { phase: 'none', screen: window.__pb.screen }; });
const modalText = (page) => page.evaluate(() => document.querySelector('#overlay .mhead')?.textContent || '');
async function tapText(page, text) { await page.tap(`button:has-text("${text}")`); await page.waitForTimeout(150); }
async function waitPhaseNot(page, phase, ms = 180000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await state(page); if (s.phase !== phase) return s; await page.waitForTimeout(300); } throw new Error('timeout waiting phase != ' + phase); }

/** 페이지 안에서 작업대 장비를 가장 좋은 자리에 배치하고 합성한다 (봇). */
async function botPrep(page) {
  return page.evaluate(() => {
    const app = window.__pb, C = window.__pbCore, r = app.run;
    let merged = true; while (merged) { merged = false; for (const it of [...r.items]) { const ps = C.mergePartners(r, it.uid); if (!ps.length) continue; const keep = it.loc === 'bag' ? it : (ps.find(p => p.loc === 'bag') ?? it); const consume = keep === it ? ps[0] : it; if (C.mergeItems(r, keep.uid, consume.uid).ok) { merged = true; break; } } }
    const score = (it, x, y, rot) => { const trial = r.items.map(i => i.uid === it.uid ? { ...i, x, y, rot, loc: 'bag' } : i); const lo = C.computeLoadout(trial, r.grid); let s = 0; for (const w of lo.weapons) for (const l of w.links) if (l.applied && (w.uid === it.uid || l.supportUid === it.uid)) s += 3 * l.grade; return s - (x + y) * 0.01; };
    const kindOrder = (id) => ({ dagger: 0, mg: 0, shotgun: 0, laser: 0, bomb: 0, drone: 0, battery: 1, cooler: 1, ammo: 1, lens: 1 })[id] ?? 2;
    for (const it of C.benchItems(r).sort((a, b) => kindOrder(a.id) - kindOrder(b.id) || b.grade - a.grade)) {
      let best = null; for (const rot of [0, 1, 2, 3]) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { if (!C.checkPlacement(r.grid, r.items, it.id, rot, x, y, it.uid).ok) continue; const s = score(it, x, y, rot); if (!best || s > best.s) best = { x, y, rot, s }; }
      if (best) C.placeItem(r, it.uid, best.x, best.y, best.rot);
    }
    app.persist(); app.renderPrep();
    return C.benchItems(r).length;
  });
}
async function playBattle(page, name, opts = {}) {
  // 출발 버튼 (작업대 남으면 확인 모달)
  await page.tap('#btn-start'); await page.waitForTimeout(250);
  if ((await modalText(page)).includes('작업대')) { await tapText(page, '분해하고 출발'); }
  await page.waitForTimeout(900);
  let s = await state(page);
  if (s.phase !== 'battle') throw new Error(name + ': battle did not start: ' + JSON.stringify(s));
  const stage = s.stage;
  if (opts.speed2) { await page.tap('#btn-speed'); }
  if (opts.screenshotAt) { await page.waitForTimeout(opts.screenshotAt); await page.screenshot({ path: `e2e-out/${name}-${opts.tag || ('battle' + stage)}.png` }); }
  // 충격파: 위험할 때 한 번
  const t0 = Date.now();
  while (Date.now() - t0 < 200000) {
    const st = await page.evaluate(() => { const a = window.__pb; const sim = a.sim; if (!sim) return { over: true }; const near = sim.enemies.filter(e => Math.hypot(e.x - sim.player.x, e.y - sim.player.y) < 60); return { over: sim.over, hp: sim.hp, near: near.length, bomber: near.some(e => e.type === 'bomber' && e.fuse >= 0), crush: a.battleView.crushWarn > 0, used: sim.shockwaveUsed, time: sim.time, fps: a.fps }; });
    if (st.over) break;
    if (!st.used && (st.crush || st.bomber || (st.near >= 3 && st.hp < 60) || st.hp < 25)) { await page.tap('#btn-shock'); }
    await page.waitForTimeout(250);
  }
  s = await waitPhaseNot(page, 'battle');
  const sum = await page.evaluate(() => { const s = window.__pb.run.lastSummary; return s ? { won: s.won, dur: s.stats.duration.toFixed(1), taken: s.stats.damageTaken, kills: s.stats.kills, spawned: s.stats.spawned, heal: s.healed, parts: s.partsGained, w: Object.values(s.stats.weapons).map(w => `${w.id}${w.grade}:${Math.round(w.damage)}dmg/${w.shots}shot${w.extraShots ? '/+' + w.extraShots : ''}${w.chains ? '/c' + w.chains : ''}${w.overheatTime ? '/oh' + w.overheatTime.toFixed(1) : ''}`).join(' ') } : null; });
  log(`${name}: stage ${stage} ${sum.won ? 'WIN' : 'LOSE'} ${sum.dur}s taken=${sum.taken} kills=${sum.kills}/${sum.spawned} heal=${sum.heal} parts=+${sum.parts} | ${sum.w}`);
  return { stage, ...sum };
}
async function afterBattle(page, name, opts = {}) {
  // 요약 모달
  if (!(await modalText(page)).includes('구간')) await page.waitForTimeout(500);
  if (opts.screenshotSummary) await page.screenshot({ path: `e2e-out/${name}-summary${opts.stage}.png` });
  await tapText(page, '다음');
  let s = await state(page);
  if (s.phase === 'unlock') {
    const locked = await page.evaluate(() => window.__pb.run.grid.locked.map((l, i) => l ? i : -1).filter(i => i >= 0));
    for (const idx of locked.slice(0, 2)) await tapCell(page, idx % 5, Math.floor(idx / 5));
    if (opts.screenshotUnlock) await page.screenshot({ path: `e2e-out/${name}-unlock.png` });
    await tapText(page, '해금 확정');
    s = await state(page);
    log(`${name}: unlock → locked=${s.locked} phase=${s.phase}`);
  }
  if (s.phase === 'reward') {
    if (opts.screenshotReward) await page.screenshot({ path: `e2e-out/${name}-reward${opts.stage}.png` });
    // 후보 중 "합성 가능" 또는 "지원 대상"이 있는 카드 우선
    const idx = await page.evaluate(() => { const cards = [...document.querySelectorAll('.card')]; let best = 0, bs = -1; cards.forEach((c, i) => { const t = c.textContent; let sc = 0; if (t.includes('합성 가능')) sc += 3; if (t.includes('지원 대상:') || t.includes('지원 가능:')) sc += 2; if (t.includes('2등급')) sc += 1; if (t.includes('공격')) sc += 1; if (sc > bs) { bs = sc; best = i; } }); return best; });
    const btns = await page.$$('.card button'); await btns[idx].tap(); await page.waitForTimeout(200);
    s = await state(page);
  }
  return s;
}

async function run(name, viewport, mode) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(base); await page.waitForSelector('#title');
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#title');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  // ---- 튜토리얼: 실제 탭으로 배치 ----
  await tapText(page, '튜토리얼');
  let s = await state(page); log(`${name}: new tutorial run phase=${s.phase} items=${s.items.length} tut=${s.tut}`);
  await page.tap('.chip[data-uid="i2"]'); await page.waitForTimeout(120); // 기관총
  await tapCell(page, 1, 0); // 미리보기
  await page.screenshot({ path: `e2e-out/${name}-02-preview.png` });
  await tapCell(page, 1, 0); // 확정
  s = await state(page); log(`${name}: mg placed → ${s.items.find(i => i.startsWith('mg'))} tut=${s.tut}`);
  // 잘못된 위치 시도: 잠긴 칸
  await page.tap('.chip[data-uid="i4"]'); await page.waitForTimeout(120); // 배터리
  await tapCell(page, 0, 0);
  const invalidInfo = await page.evaluate(() => document.querySelector('#info')?.textContent || '');
  log(`${name}: invalid preview info contains '놓을 수 없음'=${invalidInfo.includes('놓을 수 없음')} (${invalidInfo.slice(0, 60)})`);
  await page.screenshot({ path: `e2e-out/${name}-03-invalid.png` });
  // 회전 후 기관총 옆에 배치 (2,0)
  await page.tap('text=회전'); await page.waitForTimeout(150);
  await page.tap('text=회전'); await page.waitForTimeout(150); // 두 번 회전 → 세로 원복
  await tapCell(page, 2, 0); await tapCell(page, 2, 0);
  s = await state(page);
  const link = await page.evaluate(() => { const lo = window.__pbCore.loadoutOf(window.__pb.run); const w = lo.weapons.find(w => w.id === 'mg'); return w ? { interval: w.interval, base: w.baseInterval, links: w.links.map(l => `${l.supportId}:${l.applied}`) } : null; });
  log(`${name}: battery placed → ${s.items.find(i => i.startsWith('battery'))} link=${JSON.stringify(link)} tut=${s.tut}`);
  // 기관총 검사(연결 표시)
  await tapCell(page, 1, 1);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `e2e-out/${name}-04-links.png` });
  const info = await page.evaluate(() => document.querySelector('#info')?.textContent || '');
  log(`${name}: inspect mg info has '✓ 배터리'=${info.includes('✓ 배터리')} tut=${(await state(page)).tut}`);
  // 나머지: 단검 (3,0), 구급팩 (1,3)
  await page.tap('.chip[data-uid="i1"]'); await page.waitForTimeout(100); await tapCell(page, 3, 0); await tapCell(page, 3, 0);
  s = await state(page); log(`${name}: dagger → ${s.items.find(i => i.startsWith('dagger'))}`);
  await page.tap('.chip[data-uid="i3"]'); await page.waitForTimeout(100); await tapCell(page, 1, 3); await tapCell(page, 1, 3);
  s = await state(page); log(`${name}: all placed bench=${s.items.filter(i => i.includes('@bench')).length} items=${s.items.join(' ')}`);
  await page.screenshot({ path: `e2e-out/${name}-05-prep-ready.png` });
  // 정리 중 새로고침 → 장비·재화 일치
  const before = JSON.stringify(s);
  await page.reload(); await page.waitForSelector('#title'); await tapText(page, '이어하기');
  const after = JSON.stringify(await state(page));
  log(`${name}: reload during prep restores state=${before === after}`);
  // ---- 전투 1: 일시정지·배속·전투 중 새로고침 확인 ----
  await page.tap('#btn-start'); await page.waitForTimeout(250);
  if ((await modalText(page)).includes('작업대')) { await tapText(page, '분해하고 출발'); }
  await page.waitForTimeout(900);
  s = await state(page); log(`${name}: battle started phase=${s.phase} screen=${s.screen}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `e2e-out/${name}-06-battle1.png` });
  await page.tap('.topbar button[aria-label="일시정지"]'); await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => ({ t: window.__pb.sim.time, heat: window.__pb.sim.weapons[0].heat, n: window.__pb.sim.enemies.length, pr: window.__pb.sim.projectiles.length }));
  await page.waitForTimeout(700);
  const t2 = await page.evaluate(() => ({ t: window.__pb.sim.time, heat: window.__pb.sim.weapons[0].heat, n: window.__pb.sim.enemies.length, pr: window.__pb.sim.projectiles.length }));
  log(`${name}: pause freezes time=${t1.t === t2.t} heat=${t1.heat === t2.heat} enemies=${t1.n === t2.n} projectiles=${t1.pr === t2.pr}`);
  await page.screenshot({ path: `e2e-out/${name}-07-pause.png` });
  await tapText(page, '계속하기');
  await page.tap('#btn-speed'); await page.waitForTimeout(500);
  const sp = await page.evaluate(() => window.__pb.speed); log(`${name}: speed=${sp}`);
  // 전투 중 새로고침 → 전투 시작 시점 복원
  const hpBefore = s.hp;
  await page.reload(); await page.waitForSelector('#title');
  const note = await page.evaluate(() => document.querySelector('#title .note')?.textContent || '');
  await tapText(page, '이어하기');
  s = await state(page);
  log(`${name}: reload during battle → phase=${s.phase} stage=${s.stage} hp=${s.hp} (was ${hpBefore}) note='${note.slice(0, 40)}'`);
  // ---- 전투 1 실제 진행 ----
  const b1 = await playBattle(page, name, { speed2: true, screenshotAt: 2500, tag: '08-battle1-2x' });
  await afterBattle(page, name, { screenshotSummary: true, screenshotReward: true, stage: 1 });
  s = await state(page); log(`${name}: after reward phase=${s.phase} stage=${s.stage} items=${s.items.length} tut=${s.tut}`);
  await page.screenshot({ path: `e2e-out/${name}-09-prep2.png` });
  // 후보 새로고침 무료 재추첨 불가 확인은 규칙 테스트에서. 여기서는 합성/분해 UI 한 번
  const results = [b1];
  if (mode === 'short') {
    // 작업대 남긴 채 출발 → 확인 모달 → 돌아가기 → 다시 출발
    await page.tap('#btn-start'); await page.waitForTimeout(250);
    const mt = await modalText(page); log(`${name}: leftover bench modal='${mt}'`);
    if (mt.includes('작업대')) { await page.screenshot({ path: `e2e-out/${name}-10-bench-confirm.png` }); await tapText(page, '돌아가서 정리'); const s2 = await state(page); log(`${name}: cancel keeps items=${s2.items.length} phase=${s2.phase}`); }
    await botPrep(page);
    const b2 = await playBattle(page, name, { speed2: true, screenshotAt: 3000, tag: '11-battle2' }); results.push(b2);
    await afterBattle(page, name, { stage: 2 });
    await page.screenshot({ path: `e2e-out/${name}-12-prep3.png` });
  } else {
    // 끝까지 진행 (assist: 각 전투 전 체력 회복 → 보스·결과 화면 확인용)
    let guard = 0;
    while (guard++ < 14) {
      s = await state(page); if (s.phase !== 'prep') break;
      if (mode === 'assist') await page.evaluate(() => { window.__pb.run.hp = window.__pb.run.maxHp; window.__pb.persist(); window.__pb.renderPrep(); });
      const left = await botPrep(page);
      const stage = s.stage;
      const b = await playBattle(page, name, { speed2: true, screenshotAt: stage === 12 ? 6000 : (stage === 4 || stage === 8 ? 4000 : 0), tag: stage === 12 ? '20-boss' : `1x-battle${stage}` });
      results.push(b);
      s = await state(page);
      if (s.phase === 'result') break;
      await afterBattle(page, name, { stage, screenshotUnlock: stage === 4, screenshotReward: stage === 8 });
    }
    s = await state(page);
    await page.waitForTimeout(400);
    if ((await modalText(page)).includes('구간')) { await page.screenshot({ path: `e2e-out/${name}-21-final-summary.png` }); await tapText(page, '다음'); await page.waitForTimeout(400); }
    await page.screenshot({ path: `e2e-out/${name}-22-result.png` });
    const res = await page.evaluate(() => ({ phase: window.__pb.run.phase, won: window.__pb.run.result?.won, stage: window.__pb.run.result?.stage, best: window.__pb.blob.meta.bestStage, hard: window.__pb.blob.meta.hardUnlocked, links: window.__pb.blob.meta.discoveredLinks.length, codex: window.__pb.blob.meta.codex.length }));
    log(`${name}: RESULT ${JSON.stringify(res)}`);
    // 패배/승리 후 새로고침해도 결과 유지
    await page.reload(); await page.waitForSelector('#title');
    const again = await page.evaluate(() => ({ phase: window.__pb.run?.phase, won: window.__pb.run?.result?.won, best: window.__pb.blob.meta.bestStage }));
    log(`${name}: after reload result kept=${again.phase === 'result'} ${JSON.stringify(again)}`);
  }
  const fps = await page.evaluate(() => window.__pb.fps);
  log(`${name}: battles=${results.length} wins=${results.filter(r => r.won).length} avgDur=${(results.reduce((a, r) => a + Number(r.dur), 0) / results.length).toFixed(1)}s lastFps=${fps.toFixed(0)} errors=${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`);
  // 설정·도감·도움말 열기
  await page.evaluate(() => window.__pb.showTitle());
  await tapText(page, '도감'); await page.screenshot({ path: `e2e-out/${name}-30-codex.png` }); await page.tap('#overlay .x');
  await tapText(page, '설정'); await page.screenshot({ path: `e2e-out/${name}-31-settings.png` }); await page.tap('#overlay .x');
  await ctx.close();
  return errors.length;
}
let errs = 0;
const only = process.env.E2E_ONLY;
if (!only || only === 'small') errs += await run('small-360x800', { width: 360, height: 800 }, 'short');
if (!only || only === 'phone') errs += await run('phone-390x844', { width: 390, height: 844 }, 'full');
if (!only || only === 'large') errs += await run('large-430x932', { width: 430, height: 932 }, 'assist');
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n'));
console.log(errs ? `FAILED with ${errs} errors` : 'E2E OK');
process.exit(errs ? 1 : 0);
