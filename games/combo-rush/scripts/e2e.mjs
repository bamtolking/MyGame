// 헤드리스 Chromium(휴대폰 뷰포트 3종)으로 빌드된 play/index.html 을 실제로 조작하는 e2e.
// 흐름: 제목 → 맵 선택 → 배치(탭) → 합성(메뉴) → 2배속/일시정지 → 모달 → 새로고침 후 이어하기 → 승리/패배 결과 → 재시작.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = 'e2e-out'; mkdirSync(out, { recursive: true });
const base = 'file://' + resolve('play/index.html');
const report = []; const log = (m) => { console.log(m); report.push(m); };
let fails = 0; const check = (name, cond, extra = '') => { log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) fails++; };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader'] });

async function newPage(viewport, url) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url); await page.waitForSelector('#title');
  return { ctx, page, errors };
}
const st = (page) => page.evaluate(() => { const a = window.__game; const s = a.state; return s ? { phase: s.phase, wave: s.wave, gold: Math.floor(s.gold), life: s.life, units: s.units.map(u => `${u.kind}${u.grade}@${u.slot}`), offer: s.offer, enemies: s.enemies.length, time: s.time, tut: a.tutorial, paused: a.paused, combos: s.combosSeen, fps: a.fps, free: s.refreshFree, kills: s.stats.kills } : null; });
const tapSlot = async (page, slot) => { const p = await page.evaluate((s) => window.__game.slotScreenPos(s), slot); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(120); };
const overlap = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

async function mainFlow(name, viewport) {
  const { ctx, page, errors } = await newPage(viewport, base + '?seed=42');
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#title');
  await page.screenshot({ path: `${out}/${name}-01-title.png` });
  await page.tap('text=새 게임'); await page.waitForSelector('#select:not(.hidden)');
  // 잠긴 맵/난이도 확인
  const lockedB = await page.evaluate(() => document.querySelectorAll('#select .card.locked').length); check(`${name} 맵B 잠김`, lockedB === 1);
  await page.screenshot({ path: `${out}/${name}-02-select.png` });
  await page.tap('text=출발!'); await page.waitForSelector('#game:not(.hidden)'); await page.waitForTimeout(300);
  let s = await st(page); check(`${name} 게임 시작(준비 단계, 골드 100, 튜토리얼 1단계)`, s.phase === 'prep' && s.gold === 100 && s.tut === 1, JSON.stringify(s));
  // 겹침 검사: 상단바/하단바/캔버스
  const rects = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect().toJSON(); return { top: r('topbar'), field: r('field'), bottom: r('bottombar'), cv: r('cv'), offer: r('offerrow'), hint: r('hintline') }; });
  check(`${name} 레이아웃 겹침 없음`, !overlap(rects.top, rects.field) && !overlap(rects.field, rects.bottom) && rects.bottom.bottom <= viewport.height + 1 && rects.cv.height > viewport.height * 0.45, JSON.stringify(rects));
  const btnSizes = await page.evaluate(() => [...document.querySelectorAll('#game button')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [b.textContent.trim().slice(0, 6), Math.round(r.width), Math.round(r.height)]; }));
  check(`${name} 게임 버튼 터치 영역 ≥ 36px`, btnSizes.every(b => b[1] >= 36 && b[2] >= 30), JSON.stringify(btnSizes));
  // 후보 선택만 하고 취소 → 비용 없음
  await page.tap('.offer[data-idx="0"]'); await page.waitForTimeout(80); await page.tap('.offer[data-idx="0"]'); await page.waitForTimeout(80);
  s = await st(page); check(`${name} 후보 선택·취소 시 비용 없음`, s.gold === 100 && s.units.length === 0);
  // 배치 3기: flame(슬롯1), flame(슬롯2)→ 합성, oil(슬롯0)
  await page.tap('.offer[data-idx="0"]'); await tapSlot(page, 1);
  s = await st(page); check(`${name} 배치 1: 화염봇, 골드 75, 후보 갱신`, s.units[0] === 'flame1@1' && s.gold === 75 && s.tut === 2, JSON.stringify(s));
  // 같은 칸에 다시 배치 시도 → 실패 안내
  await page.tap('.offer[data-idx="0"]'); await tapSlot(page, 1); const toast1 = await page.evaluate(() => document.getElementById('toast').textContent);
  s = await st(page); check(`${name} 점유 칸 배치 거부`, s.units.length === 1 && s.gold === 75 && /이미 유닛/.test(toast1), toast1);
  await tapSlot(page, 2); s = await st(page); check(`${name} 배치 2: 두 번째 화염봇`, s.units.length === 2 && s.gold === 50, JSON.stringify(s.units));
  await page.screenshot({ path: `${out}/${name}-03-placed.png` });
  // 합성: 유닛 탭 → 합성 버튼 → 상대 탭
  await tapSlot(page, 1); const menuVisible = await page.evaluate(() => !document.getElementById('unitmenu').classList.contains('hidden')); check(`${name} 유닛 메뉴 표시`, menuVisible);
  await page.screenshot({ path: `${out}/${name}-04-unitmenu.png` });
  await page.tap('#unitmenu .acts button:nth-child(2)'); await page.waitForTimeout(80);
  const mergeTargets = await page.evaluate(() => window.__game.view.mergeTargets.length); check(`${name} 합성 후보 강조 1기`, mergeTargets === 1);
  await tapSlot(page, 2); s = await st(page); check(`${name} 합성 결과: 2등급 화염봇 1기, 칸 2 비움`, s.units.length === 1 && s.units[0] === 'flame2@1' && s.tut === 3, JSON.stringify(s.units));
  // 기름분사기 배치(후보에서 찾기, 필요 시 새로고침)
  let oilIdx = s.offer.indexOf('oil'); if (oilIdx < 0) { await page.tap('#btn-refresh'); await page.waitForTimeout(80); s = await st(page); oilIdx = s.offer.indexOf('oil'); }
  check(`${name} 기름분사기 후보 확보`, oilIdx >= 0, JSON.stringify(s.offer));
  await page.tap(`.offer[data-idx="${oilIdx}"]`); await tapSlot(page, 0); s = await st(page); check(`${name} 기름분사기 배치`, s.units.some(u => u.startsWith('oil')), JSON.stringify(s.units));
  // 웨이브 시작 → 2배속 → 전투
  await page.tap('#btn-early'); await page.tap('#btn-speed'); await page.waitForTimeout(6000);
  s = await st(page); check(`${name} 전투 진행(적 처치 발생, 2배속, fps>30)`, (s.phase === 'wave' || s.wave >= 2) && s.kills > 0 && s.fps > 30, JSON.stringify({ phase: s.phase, wave: s.wave, kills: s.kills, fps: s.fps.toFixed(0) }));
  await page.screenshot({ path: `${out}/${name}-05-combat.png` });
  // 알림/힌트가 캔버스 배치 칸을 가리지 않는지: 메시지 바 높이 제한
  const msgRect = await page.evaluate(() => { const m = document.getElementById('msgbar').getBoundingClientRect(); const f = document.getElementById('field').getBoundingClientRect(); return { mh: m.height, fh: f.height }; }); check(`${name} 알림이 전장을 덮지 않음(높이 < 25%)`, msgRect.mh < msgRect.fh * 0.25, JSON.stringify(msgRect));
  // 일시정지: 시간 정지
  await page.tap('#btn-pause'); await page.waitForTimeout(200); const t1 = (await st(page)).time; await page.waitForTimeout(700); const t2 = (await st(page)).time;
  check(`${name} 일시정지 중 시간 정지`, t1 === t2 && (await st(page)).paused === true);
  await page.screenshot({ path: `${out}/${name}-06-pause.png` });
  await page.tap('#btn-p-codex'); await page.waitForTimeout(150); const codexOpen = await page.evaluate(() => !document.getElementById('modal').classList.contains('hidden')); const closeVisible = await page.evaluate(() => { const b = document.querySelector('#modal .close').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }); check(`${name} 도감 모달 열림·닫기 버튼 보임`, codexOpen && closeVisible);
  await page.screenshot({ path: `${out}/${name}-07-codex.png` });
  await page.tap('#modal .close'); await page.waitForTimeout(100);
  await page.tap('#btn-p-help'); await page.waitForTimeout(100); await page.screenshot({ path: `${out}/${name}-08-help.png` }); await page.tap('#modal .close');
  await page.tap('#btn-p-settings'); await page.waitForTimeout(100); await page.screenshot({ path: `${out}/${name}-09-settings.png` }); await page.tap('#modal .close');
  await page.tap('#btn-resume'); await page.waitForTimeout(300); const t3 = (await st(page)).time; check(`${name} 재개 후 시간 진행`, t3 > t2);
  // 백그라운드 전환 → 자동 일시정지, 확인 없이 진행되지 않음
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(200); const hid = await st(page); await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(600);
  const afterBack = await st(page); check(`${name} 백그라운드 자동 일시정지·복귀 시 사용자 확인 대기`, hid.paused && afterBack.paused && afterBack.time === hid.time);
  await page.tap('#btn-resume'); await page.waitForTimeout(100);
  // 웨이브 2 시작 시점 저장 후 새로고침 → 이어하기
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) { s = await st(page); if (s.wave >= 2 && s.phase === 'prep') break; if (s.phase === 'prep') await page.tap('#btn-early'); await page.waitForTimeout(400); }
  s = await st(page); const snap = s; check(`${name} 웨이브 2 준비 단계 도달`, s.wave >= 2, JSON.stringify(s));
  // 준비 중 유닛 하나 더 배치(이어하기 시 웨이브 시작 시점으로 복귀하므로 반영되지 않아야 함)
  await page.tap('.offer[data-idx="0"]'); await tapSlot(page, 5); const afterExtra = await st(page);
  await page.reload(); await page.waitForSelector('#title');
  const resumeBtn = await page.$('#title button:has-text("이어하기")'); check(`${name} 이어하기 버튼 표시`, !!resumeBtn);
  await page.screenshot({ path: `${out}/${name}-10-title-resume.png` });
  if (resumeBtn) { await resumeBtn.tap(); await page.waitForSelector('#game:not(.hidden)'); await page.waitForTimeout(300); const r = await st(page); check(`${name} 이어하기: 웨이브 시작 시점 복원(웨이브·골드·유닛 일치, 준비 중 배치는 미반영)`, r.wave === snap.wave && r.gold === snap.gold && r.units.join() === snap.units.join() && r.phase === 'prep' && afterExtra.units.length === snap.units.length + 1, JSON.stringify({ r, snap: { wave: snap.wave, gold: snap.gold, units: snap.units } })); await page.screenshot({ path: `${out}/${name}-11-resumed.png` }); }
  check(`${name} 브라우저 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function winFlow(name, viewport) {
  // 개발용 속도(?dev=1&speed=8)로 봇처럼 액션을 넣어 승리까지 진행. 실제 UI 흐름(결과 화면·재시작)을 확인.
  const { ctx, page, errors } = await newPage(viewport, base + '?seed=23&dev=1&speed=8');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('combo_rush_meta', JSON.stringify({ version: 1, tutorialDone: true })); }); await page.reload(); await page.waitForSelector('#title');
  await page.tap('text=새 게임'); await page.waitForSelector('#select:not(.hidden)'); await page.tap('text=출발!'); await page.waitForSelector('#game:not(.hidden)');
  const deadline = Date.now() + 240000; let s;
  while (Date.now() < deadline) {
    s = await st(page); if (!s || s.phase === 'won' || s.phase === 'lost') break;
    await page.evaluate(() => {
      const a = window.__game; const s = a.state; const kinds = ['laser', 'tesla', 'bomber', 'flame', 'frost'];
      const merge = () => { for (const u of s.units) { const o = s.units.find(x => x.id !== u.id && x.kind === u.kind && x.grade === u.grade && x.grade < 3); if (o) { a.act({ type: 'merge', a: u.id, b: o.id }); return true; } } return false; };
      while (merge()) {}
      let g = 0; while (s.gold >= 25 && s.units.length < 12 && g++ < 6) { let i = s.offer.findIndex(k => kinds.includes(k) && s.units.some(u => u.kind === k && u.grade === 1)); if (i < 0) i = s.offer.findIndex(k => kinds.includes(k)); if (i < 0) { if (s.refreshFree > 0 || s.gold > 80) { a.act({ type: 'refresh' }); continue; } break; } const free = s.slots.findIndex(x => x == null); if (free < 0) break; a.act({ type: 'place', offer: i, slot: free }); while (merge()) {} }
      if (s.units.length >= 12 && s.gold >= 60) { const g1 = s.units.find(u => u.grade === 1); if (g1) a.act({ type: 'sell', id: g1.id }); }
      if (s.phase === 'prep' && s.prepT < 2) a.act({ type: 'early' });
    });
    await page.waitForTimeout(250);
  }
  s = await st(page); log(`${name} 승리 흐름 종료: ${JSON.stringify({ phase: s.phase, wave: s.wave, life: s.life, time: Math.round(s.time), combos: s.combos })}`);
  check(`${name} 18웨이브 승리 도달`, s.phase === 'won');
  await page.waitForSelector('#result:not(.hidden)', { timeout: 5000 }); await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}-12-result-win.png` });
  const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('combo_rush_meta')));
  check(`${name} 승리 기록·해금 저장(맵B, 어려움)`, meta.wins === 1 && meta.unlocked.mapB === true && meta.unlocked.hard === true, JSON.stringify({ wins: meta.wins, unlocked: meta.unlocked, claimed: meta.claimedRuns.length }));
  const cp = await page.evaluate(() => localStorage.getItem('combo_rush_run')); check(`${name} 승리 후 이어하기 저장 삭제`, cp === null);
  // 새로고침해도 기록이 중복되지 않음
  await page.reload(); await page.waitForSelector('#title'); const meta2 = await page.evaluate(() => JSON.parse(localStorage.getItem('combo_rush_meta'))); check(`${name} 새로고침 후 승리 기록 중복 없음`, meta2.wins === 1 && meta2.runs === 1);
  await page.tap('text=새 게임'); await page.waitForSelector('#select:not(.hidden)'); const lockedNow = await page.evaluate(() => document.querySelectorAll('#select .card.locked').length); check(`${name} 승리 후 맵B 해금 표시`, lockedNow === 0);
  await page.screenshot({ path: `${out}/${name}-13-select-unlocked.png` });
  // 맵 B · 어려움 선택이 실제 데이터에 반영되는지
  await page.tap('#select .card:nth-child(2)'); await page.tap('.diffrow button:nth-child(2)'); await page.tap('text=출발!'); await page.waitForSelector('#game:not(.hidden)'); await page.waitForTimeout(200);
  const sel = await page.evaluate(() => ({ map: window.__game.state.mapId, diff: window.__game.state.difficulty })); check(`${name} 맵B·어려움 선택 반영`, sel.map === 'B' && sel.diff === 'hard', JSON.stringify(sel));
  await page.screenshot({ path: `${out}/${name}-14-mapB.png` });
  check(`${name} 승리 흐름 브라우저 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function loseFlow(name, viewport) {
  const { ctx, page, errors } = await newPage(viewport, base + '?seed=7&dev=1&speed=8');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('combo_rush_meta', JSON.stringify({ version: 1, tutorialDone: true })); }); await page.reload(); await page.waitForSelector('#title');
  await page.tap('text=새 게임'); await page.waitForSelector('#select:not(.hidden)'); await page.tap('text=출발!'); await page.waitForSelector('#game:not(.hidden)');
  const deadline = Date.now() + 120000; let s;
  while (Date.now() < deadline) { s = await st(page); if (s.phase === 'lost') break; if (s.phase === 'prep') await page.evaluate(() => window.__game.act({ type: 'early' })); await page.waitForTimeout(300); }
  check(`${name} 유닛 없이 방치 → 패배`, s.phase === 'lost' && s.life === 0, JSON.stringify(s));
  await page.waitForSelector('#result:not(.hidden)', { timeout: 5000 }); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/${name}-15-result-lose.png` });
  await page.tap('text=다시 도전'); await page.waitForSelector('#game:not(.hidden)'); await page.waitForTimeout(200); const r = await st(page); check(`${name} 재도전으로 새 판 시작`, r.phase === 'prep' && r.wave === 1 && r.gold === 100);
  const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('combo_rush_meta'))); check(`${name} 패배 기록 1회`, meta.runs === 2 && meta.wins === 0 && meta.records['A:normal'].bestWave >= 1);
  check(`${name} 패배 흐름 브라우저 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function corruptFlow(name, viewport) {
  const { ctx, page, errors } = await newPage(viewport, base);
  await page.evaluate(() => { localStorage.setItem('combo_rush_meta', '{broken'); localStorage.setItem('combo_rush_run', '{"runId":"x","state":"nope","wave":2}'); });
  await page.reload(); await page.waitForSelector('#title'); await page.waitForTimeout(300);
  const toast = await page.evaluate(() => document.getElementById('toast').textContent); const hasResume = await page.$('#title button:has-text("이어하기")');
  check(`${name} 손상 저장: 안내 표시, 앱 정상 진입, 이어하기 없음`, /손상/.test(toast) && !hasResume, toast);
  check(`${name} 손상 저장 브라우저 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function resizeFlow(name) {
  const { ctx, page, errors } = await newPage({ width: 390, height: 844 }, base + '?seed=42');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('combo_rush_meta', JSON.stringify({ version: 1, tutorialDone: true })); }); await page.reload(); await page.waitForSelector('#title');
  await page.tap('text=새 게임'); await page.waitForSelector('#select:not(.hidden)'); await page.tap('text=출발!'); await page.waitForSelector('#game:not(.hidden)'); await page.waitForTimeout(200);
  await page.setViewportSize({ width: 360, height: 800 }); await page.waitForTimeout(300);
  await page.tap('.offer[data-idx="0"]'); await tapSlot(page, 4); const s = await st(page);
  check(`${name} 화면 크기 변경 후 탭 좌표 일치(슬롯 4 배치)`, s.units.length === 1 && s.units[0].endsWith('@4'), JSON.stringify(s.units));
  await page.screenshot({ path: `${out}/${name}-16-resized-360x800.png` });
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${name}-17-landscape.png` });
  await page.tap('.offer[data-idx="0"]'); await tapSlot(page, 6); const s2 = await st(page); check(`${name} 가로 화면에서도 배치 가능`, s2.units.length === 2, JSON.stringify(s2.units));
  check(`${name} 크기 변경 브라우저 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

const only = process.env.E2E_ONLY;
const viewports = { 'p360x800': { width: 360, height: 800 }, 'p390x844': { width: 390, height: 844 }, 'p430x932': { width: 430, height: 932 } };
for (const [n, v] of Object.entries(viewports)) if (!only || only === 'main') await mainFlow(n, v);
if (!only || only === 'win') await winFlow('win-390x844', viewports.p390x844);
if (!only || only === 'lose') await loseFlow('lose-360x800', viewports.p360x800);
if (!only || only === 'corrupt') await corruptFlow('corrupt-390x844', viewports.p390x844);
if (!only || only === 'resize') await resizeFlow('resize');
await browser.close();
writeFileSync(`${out}/report.txt`, report.join('\n'));
console.log(fails ? `E2E FAILED (${fails})` : 'E2E OK');
process.exit(fails ? 1 : 0);
