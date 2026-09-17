// 화면·입력·메인 루프·저장 연결. 게임 규칙은 sim/ 에만 있고 여기서는 dispatch 로만 상태를 바꿉니다.
import type { GameState, SimEvent, Unit } from '../sim/types';
import { newGame } from '../sim/state';
import { step, DT, dispatch, serialize, deserialize } from '../sim/engine';
import { mergeCandidates, mergePreview, sellValue } from '../sim/roster';
import { Renderer } from '../render/renderer';
import { unitSprite, enemySprite, drawUnit, drawEnemy, GRADE_HEX } from '../render/sprites';
import { Audio, type SfxName } from '../platform/audio';
import { loadMeta, saveMeta, loadCheckpoint, saveCheckpoint, clearCheckpoint, clearAll, storageInfo, type Meta, type RunCheckpoint } from '../platform/storage';
import { UNITS, UNIT_KINDS, unitStats, type UnitKind, type Grade, GRADE_NAME } from '../data/units';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { MAPS, MAP_IDS, mapSlots, SLOT_R, type MapId } from '../data/maps';
import { DIFF, type Difficulty } from '../data/waves';
import { COMBOS, COMBO_IDS } from '../data/combos';
import { SUMMON_COST, REFRESH_COST, TOTAL_WAVES, MID_BOSS_WAVE, FINAL_BOSS_WAVE, MAX_UNITS } from '../data/economy';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function fmtTime(s: number): string { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${r.toString().padStart(2, '0')}`; }
const KIND_SFX: Record<UnitKind, SfxName> = { flame: 'shoot_flame', oil: 'shoot_oil', vortex: 'vortex', frost: 'shoot_frost', laser: 'shoot_laser', tesla: 'shoot_tesla', bomber: 'shoot_bomb', engineer: 'engineer' };

export class App {
  root: HTMLElement;
  meta!: Meta;
  state: GameState | null = null;
  renderer!: Renderer; audio = new Audio();
  speed: 1 | 2 = 1; paused = false; pauseReason: 'user' | 'hidden' | null = null;
  devSpeed = 1;
  private raf = 0; private last = 0; private acc = 0;
  private lastCheckpointWave = 0; private lastCheckpointPhase = '';
  saveStatus = '';
  fps = 0; private fpsAcc = 0; private fpsN = 0;
  private screens!: Record<'title' | 'select' | 'game' | 'result', HTMLElement>;
  private ui!: { life: HTMLElement; wave: HTMLElement; gold: HTMLElement; speed: HTMLButtonElement; msgbar: HTMLElement; prepbar: HTMLElement; prepText: HTMLElement; offerrow: HTMLElement; unitmenu: HTMLElement; hint: HTMLElement; hintTxt: HTMLElement; hintBtn: HTMLButtonElement; pauseOverlay: HTMLElement; pauseNote: HTMLElement; modal: HTMLElement; modalTitle: HTMLElement; modalContent: HTMLElement; toast: HTMLElement; field: HTMLElement; refresh: HTMLButtonElement; };
  private hud = { life: -1, wave: -1, gold: -1, prep: '', offerKey: '', unitKey: '' };
  private sel = { map: 'A' as MapId, diff: 'normal' as Difficulty };
  private msgTimers: number[] = [];
  private sellArmed = 0;
  private tutorialStep = 0; // 0 없음, 1 배치, 2 합성, 3 연계, 4 완료
  private resultShown = false;
  private toastT = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const { meta, error } = loadMeta(); this.meta = meta;
    this.buildDom();
    this.applySettings();
    this.showTitle();
    if (error) this.toast(error, 5000);
    if (!storageInfo.available) this.toast('브라우저 저장소를 쓸 수 없습니다 (' + storageInfo.reason + '). 기록이 유지되지 않습니다.', 6000);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state && this.screens.game.classList.contains('hidden') === false) this.pause('hidden'); });
    window.addEventListener('blur', () => { if (this.state && !this.screens.game.classList.contains('hidden')) this.pause('hidden'); });
    window.addEventListener('resize', () => this.layout());
    const q = new URLSearchParams(location.search);
    if (q.get('dev') === '1') { const sp = Number(q.get('speed')); if (sp >= 1 && sp <= 16) this.devSpeed = sp; }
    const unlock = () => { this.audio.unlock(); };
    document.addEventListener('pointerdown', unlock, { passive: true }); document.addEventListener('touchstart', unlock, { passive: true });
  }

  // ---------- DOM ----------
  private buildDom(): void {
    const title = el('div', 'screen'); title.id = 'title';
    const select = el('div', 'screen hidden'); select.id = 'select';
    const game = el('div', 'screen hidden'); game.id = 'game';
    const result = el('div', 'screen hidden'); result.id = 'result';
    this.screens = { title, select, game, result };
    // 게임 화면 골격
    game.innerHTML = `
      <div id="topbar">
        <div class="stat life"><span>❤</span><span id="hud-life">20</span></div>
        <div class="wave"><span id="hud-wave">웨이브 1/18</span><small id="hud-wave-sub">준비</small></div>
        <div class="stat"><span>💰</span><span id="hud-gold">100</span></div>
        <button id="btn-speed" aria-label="속도">1×</button>
        <button id="btn-pause" aria-label="일시정지">⏸</button>
      </div>
      <div id="field"><canvas id="cv"></canvas><div id="msgbar"></div>
        <div id="prepbar" class="hidden"><span id="prep-text"></span><button id="btn-early" class="small primary">바로 시작</button></div>
        <div id="pauseoverlay" class="hidden"><div class="box"><h3>일시정지</h3><div class="note" id="pause-note"></div><button id="btn-resume" class="primary">계속하기</button><button id="btn-p-settings">설정</button><button id="btn-p-codex">연계 도감</button><button id="btn-p-help">도움말</button><button id="btn-p-quit" class="danger">포기하고 나가기</button></div></div>
      </div>
      <div id="bottombar">
        <div id="offerrow"></div>
        <div id="unitmenu" class="hidden"></div>
        <div id="hintline"><span class="txt" id="hint-txt"></span><button id="hint-btn" class="ghost hidden">건너뛰기</button></div>
      </div>`;
    const modal = el('div', 'hidden'); modal.id = 'modal';
    modal.innerHTML = `<div class="sheet"><div class="sheethead"><h3 id="modal-title"></h3><button class="close" aria-label="닫기">✕</button></div><div class="content" id="modal-content"></div></div>`;
    const toast = el('div', 'hidden'); toast.id = 'toast';
    this.root.append(title, select, game, result, modal, toast);
    const $ = (id: string) => document.getElementById(id)!;
    this.ui = { life: $('hud-life'), wave: $('hud-wave'), gold: $('hud-gold'), speed: $('btn-speed') as HTMLButtonElement, msgbar: $('msgbar'), prepbar: $('prepbar'), prepText: $('prep-text'), offerrow: $('offerrow'), unitmenu: $('unitmenu'), hint: $('hintline'), hintTxt: $('hint-txt'), hintBtn: $('hint-btn') as HTMLButtonElement, pauseOverlay: $('pauseoverlay'), pauseNote: $('pause-note'), modal, modalTitle: $('modal-title'), modalContent: $('modal-content'), toast, field: $('field'), refresh: null as unknown as HTMLButtonElement };
    this.renderer = new Renderer($('cv') as HTMLCanvasElement);
    this.renderer.onEvent = e => this.onSimEvent(e);
    modal.querySelector('.close')!.addEventListener('click', () => this.closeModal());
    modal.addEventListener('click', e => { if (e.target === modal) this.closeModal(); });
    $('btn-speed').addEventListener('click', () => { this.speed = this.speed === 1 ? 2 : 1; this.ui.speed.textContent = this.speed + '×'; this.sfx('click'); });
    $('btn-pause').addEventListener('click', () => this.pause('user'));
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-p-settings').addEventListener('click', () => this.openSettings());
    $('btn-p-codex').addEventListener('click', () => this.openCodex());
    $('btn-p-help').addEventListener('click', () => this.openHelp());
    $('btn-p-quit').addEventListener('click', () => this.confirm('현재 판을 포기할까요? 이 판의 저장은 삭제되고 기록은 남지 않습니다.', () => { clearCheckpoint(); this.state = null; this.stopLoop(); this.closeModal(); this.showTitle(); }));
    $('btn-early').addEventListener('click', () => { if (this.state) { const r = dispatch(this.state, { type: 'early' }); if (r.ok) this.sfx('click'); } });
    this.ui.hintBtn.addEventListener('click', () => this.skipTutorial());
    // 캔버스 입력: 터치·마우스 공통(pointer). 짧은 탭만 처리.
    const cv = $('cv'); let downX = 0, downY = 0, downId = -1;
    cv.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downId = e.pointerId; });
    cv.addEventListener('pointerup', e => { if (e.pointerId !== downId) return; downId = -1; if (Math.hypot(e.clientX - downX, e.clientY - downY) > 14) return; const r = cv.getBoundingClientRect(); this.onFieldTap(e.clientX - r.left, e.clientY - r.top); });
    cv.addEventListener('pointercancel', () => { downId = -1; });
  }

  private show(name: keyof App['screens']): void { for (const k of Object.keys(this.screens) as (keyof App['screens'])[]) this.screens[k].classList.toggle('hidden', k !== name); if (name === 'game') this.layout(); }
  toast(text: string, ms = 1800, ok = false): void { const t = this.ui.toast; t.textContent = text; t.classList.toggle('ok', ok); t.classList.remove('hidden'); clearTimeout(this.toastT); this.toastT = window.setTimeout(() => t.classList.add('hidden'), ms); }
  sfx(n: SfxName): void { this.audio.play(n); }
  applySettings(): void { const s = this.meta.settings; this.audio.setVolume(s.sfx, s.muted); this.renderer.fx.level = s.fxLevel; this.renderer.dmg.enabled = s.dmgNumbers; this.renderer.view.showRanges = s.showRanges; }

  // ---------- 제목 ----------
  showTitle(): void {
    const t = this.screens.title; t.innerHTML = '';
    const hero = el('canvas', 'hero'); hero.width = 600; hero.height = 300; this.drawHero(hero);
    const h1 = el('h1', '', `<small>선택형 소환 · 합성 · 연계 디펜스</small>합체방어대<br>콤보 러시`);
    const sub = el('div', 'sub', '작은 기계와 정령을 소환해 합치고, 서로 다른 능력을 연결해 몰려오는 고철 벌레를 막아내세요.');
    const menu = el('div', 'menu');
    let { cp, error } = loadCheckpoint(); if (error) this.toast(error, 5000);
    if (cp) { try { deserialize(cp.state); } catch (e) { clearCheckpoint(); cp = null; this.toast('이어하기 저장이 손상되어 삭제했습니다: ' + (e as Error).message, 5000); } }
    if (cp) { const b = el('button', 'primary', `이어하기<br><small style="color:#3e2723">${MAPS[cp.mapId].name} · ${DIFF[cp.difficulty].name} · 웨이브 ${cp.wave} 시작 시점부터</small>`); b.addEventListener('click', () => this.resumeCheckpoint(cp)); menu.append(b); }
    const bNew = el('button', cp ? '' : 'primary', '새 게임'); bNew.addEventListener('click', () => { this.sfx('click'); if (cp) this.confirm('새 게임을 시작하면 이어하기 저장이 삭제됩니다. 계속할까요?', () => { clearCheckpoint(); this.closeModal(); this.showSelect(); }); else this.showSelect(); }); menu.append(bNew);
    const row = el('div', 'row');
    const bCodex = el('button', '', `연계 도감 ${this.meta.codex.length}/6`); bCodex.addEventListener('click', () => this.openCodex());
    const bHelp = el('button', '', '도움말'); bHelp.addEventListener('click', () => this.openHelp());
    const bSet = el('button', '', '설정'); bSet.addEventListener('click', () => this.openSettings());
    row.append(bCodex, bHelp, bSet); menu.append(row);
    const rec = this.meta.bestWaveOverall ? `최고 도달 웨이브 ${this.meta.bestWaveOverall} · 승리 ${this.meta.wins}회 / ${this.meta.runs}판` : '아직 기록이 없습니다';
    const foot = el('div', 'foot', `${rec}<br>웹 베타 · 세로 화면 권장 · 이어하기는 마지막 웨이브 시작 시점부터`);
    t.append(hero, h1, sub, menu, foot);
    this.show('title');
  }
  private drawHero(cv: HTMLCanvasElement): void {
    const c = cv.getContext('2d')!; const W = cv.width, H = cv.height;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b3a2a'); g.addColorStop(1, '#0f1d2e'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#5d4a36'; c.lineWidth = 40; c.lineCap = 'round'; c.beginPath(); c.moveTo(-20, 200); c.quadraticCurveTo(300, 260, 620, 190); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 3; c.setLineDash([10, 14]); c.stroke(); c.setLineDash([]);
    const units: [UnitKind, Grade, number, number][] = [['flame', 3, 110, 120], ['oil', 2, 200, 90], ['vortex', 3, 300, 120], ['frost', 2, 400, 90], ['laser', 3, 500, 120], ['tesla', 1, 60, 60], ['bomber', 2, 540, 60], ['engineer', 3, 250, 40]];
    for (const [k, gr, x, y] of units) { c.save(); c.translate(x, y); c.scale(2.2, 2.2); drawUnit(c, k, gr); c.restore(); }
    const enemies: [EnemyKind, number, number][] = [['gearbug', 90, 205], ['sparkrat', 170, 215], ['boltant', 230, 222], ['scrapturtle', 330, 225], ['repairdrone', 420, 210], ['boss_golem', 540, 200]];
    for (const [k, x, y] of enemies) { c.save(); c.translate(x, y); c.scale(k === 'boss_golem' ? 2.4 : 2, k === 'boss_golem' ? 2.4 : 2); drawEnemy(c, k); c.restore(); }
    // 연출: 광선·불꽃
    c.strokeStyle = 'rgba(255,82,82,0.8)'; c.lineWidth = 8; c.beginPath(); c.moveTo(500, 130); c.lineTo(340, 225); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(255,109,0,0.6)'; c.beginPath(); c.arc(170, 215, 34, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffe082'; c.beginPath(); c.arc(170, 215, 12, 0, Math.PI * 2); c.fill();
  }

  // ---------- 선택 ----------
  showSelect(): void {
    const s = this.screens.select; s.innerHTML = ''; if (!this.meta.unlocked.mapB && this.sel.map === 'B') this.sel.map = 'A'; if (!this.meta.unlocked.hard) this.sel.diff = 'normal';
    const back = el('button', 'ghost small', '← 처음으로'); back.style.alignSelf = 'flex-start'; back.addEventListener('click', () => this.showTitle());
    const h = el('h2', '', '맵 선택'); const cards = el('div', 'cards');
    const render = () => {
      cards.innerHTML = '';
      for (const id of MAP_IDS) {
        const m = MAPS[id]; const locked = m.unlockedBy && !this.meta.unlocked.mapB; const rec = this.meta.records[`${id}:${this.sel.diff}`];
        const card = el('div', 'card' + (this.sel.map === id ? ' sel' : '') + (locked ? ' locked' : ''));
        const cv = el('canvas'); cv.width = 128; cv.height = 128; this.drawMapThumb(cv, id); card.append(cv);
        card.append(el('div', 't', `<b>${m.name}</b> <small>${m.sub}</small><small>${locked ? '🔒 초록 작업장을 클리어하면 해금' : m.desc}</small>${rec ? `<small class="lock">기록: 승리 ${rec.wins}회 · 최고 웨이브 ${rec.bestWave}</small>` : ''}`));
        card.addEventListener('click', () => { if (locked) { this.toast('초록 작업장을 먼저 클리어하세요'); return; } this.sel.map = id; render(); });
        cards.append(card);
      }
      diffrow.innerHTML = '';
      for (const d of ['normal', 'hard'] as Difficulty[]) { const locked = d === 'hard' && !this.meta.unlocked.hard; const b = el('button', this.sel.diff === d ? 'sel' : '', `${DIFF[d].name}${locked ? ' 🔒' : ''}<br><small>${locked ? '보통 클리어 후 해금' : DIFF[d].desc}</small>`); b.addEventListener('click', () => { if (locked) { this.toast('보통 난이도를 먼저 클리어하세요'); return; } this.sel.diff = d; render(); }); diffrow.append(b); }
    };
    const diffrow = el('div', 'diffrow'); const h2 = el('h2', '', '난이도');
    const go = el('button', 'primary go', '출발!'); go.addEventListener('click', () => this.startGame(this.sel.map, this.sel.diff));
    const note = el('div', 'foot', `<small>목표: 18웨이브 방어 · 9웨이브 중간 보스 · 18웨이브 최종 보스 · 배치 최대 ${MAX_UNITS}기</small>`);
    s.append(back, h, cards, h2, diffrow, go, note); render(); this.show('select');
  }
  private drawMapThumb(cv: HTMLCanvasElement, id: MapId): void {
    const c = cv.getContext('2d')!; const m = MAPS[id]; const k = cv.width / 400 * 0.95; c.fillStyle = m.theme.bg1; c.fillRect(0, 0, cv.width, cv.height); c.save(); c.translate(3, 3); c.scale(k, k * 0.82);
    c.strokeStyle = m.theme.path; c.lineWidth = 26; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); m.points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    for (const s of m.slots) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(s.x, s.y, 14, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = m.theme.accent; c.beginPath(); c.arc(m.base.x, m.base.y, 18, 0, Math.PI * 2); c.fill(); c.restore();
  }

  // ---------- 게임 시작/이어하기 ----------
  startGame(mapId: MapId, difficulty: Difficulty): void {
    const q = new URLSearchParams(location.search); const qs = Number(q.get('seed'));
    const seed = qs > 0 ? qs : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1;
    const tutorial = !this.meta.tutorialDone && mapId === 'A' && difficulty === 'normal';
    this.state = newGame({ mapId, difficulty, seed, tutorial });
    this.tutorialStep = tutorial ? 1 : 0;
    this.meta.runs++; saveMeta(this.meta);
    this.beginRun(); this.lastCheckpointWave = 0; this.checkpointIfNeeded(true);
  }
  resumeCheckpoint(cp: RunCheckpoint): void {
    try { const s = deserialize(cp.state); this.state = s; this.tutorialStep = 0; this.beginRun(); this.lastCheckpointWave = s.wave; this.lastCheckpointPhase = s.phase; this.toast(`웨이브 ${s.wave} 시작 시점부터 이어서 진행합니다`, 2200, true); }
    catch (e) { clearCheckpoint(); this.toast('이어하기 저장이 손상되어 삭제했습니다: ' + (e as Error).message, 5000); this.showTitle(); }
  }
  private beginRun(): void {
    this.resultShown = false; this.paused = false; this.pauseReason = null; this.speed = 1; this.ui.speed.textContent = '1×';
    const v = this.renderer.view; v.selectedUnit = null; v.selectedOffer = null; v.mode = 'none'; v.mergeTargets = []; v.tutorialSlot = null;
    this.renderer.fx.parts = []; this.renderer.dmg.clear(); this.renderer.unitAnim.clear(); this.renderer.bossWarn = null; this.renderer.bg = null;
    this.ui.msgbar.innerHTML = ''; this.hud = { life: -1, wave: -1, gold: -1, prep: '', offerKey: '', unitKey: '' };
    this.ui.pauseOverlay.classList.add('hidden');
    this.show('game'); this.renderOffer(); this.renderUnitMenu(); this.updateHint();
    this.startLoop();
  }

  // ---------- 루프 ----------
  private startLoop(): void { this.stopLoop(); this.last = performance.now(); this.acc = 0; const tick = (now: number) => { this.raf = requestAnimationFrame(tick); this.frame(now); }; this.raf = requestAnimationFrame(tick); }
  private stopLoop(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  layout(): void { const r = this.ui.field.getBoundingClientRect(); if (r.width > 0 && r.height > 0) this.renderer.resize(Math.floor(r.width), Math.floor(r.height)); }
  private frame(now: number): void {
    const s = this.state; if (!s) return;
    let dt = (now - this.last) / 1000; this.last = now; if (dt > 0.1) dt = 0.1; // 백그라운드 복귀 시 시간 몰아서 계산 금지
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc >= 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    const running = !this.paused && s.phase !== 'won' && s.phase !== 'lost';
    if (running) {
      this.acc += dt * this.speed * this.devSpeed; let n = 0;
      while (this.acc >= DT && n < 12 * this.devSpeed) { step(s); this.acc -= DT; n++; }
      if (n >= 12 * this.devSpeed) this.acc = 0;
      this.checkpointIfNeeded(false);
    }
    if (this.renderer.cssW === 0) this.layout();
    this.renderer.consumeEvents(s);
    this.renderer.draw(s, dt, !running);
    this.updateHud();
    if ((s.phase === 'won' || s.phase === 'lost') && !this.resultShown) { this.resultShown = true; setTimeout(() => this.showResult(), s.phase === 'won' ? 1400 : 1000); }
  }

  // ---------- 일시정지 ----------
  pause(reason: 'user' | 'hidden'): void {
    if (!this.state || this.paused) { if (this.paused && reason === 'hidden') this.pauseReason = this.pauseReason || 'hidden'; return; }
    this.paused = true; this.pauseReason = reason; this.audio.suspend();
    this.ui.pauseNote.textContent = reason === 'hidden' ? '화면을 벗어나 자동으로 멈췄습니다. 적·투사체·대기시간·웨이브가 모두 함께 멈춰 있습니다.' : '적·투사체·대기시간·웨이브가 모두 함께 멈춥니다.';
    this.ui.pauseOverlay.classList.remove('hidden');
  }
  resume(): void { if (!this.paused) return; this.paused = false; this.pauseReason = null; this.ui.pauseOverlay.classList.add('hidden'); this.audio.resume(); this.last = performance.now(); this.acc = 0; this.sfx('click'); }

  // ---------- 저장 ----------
  private checkpointIfNeeded(force: boolean): void {
    const s = this.state; if (!s) return;
    if (s.phase !== 'prep') return;
    if (!force && s.wave === this.lastCheckpointWave) return;
    this.lastCheckpointWave = s.wave;
    const r = saveCheckpoint({ version: 1, runId: s.runId, mapId: s.mapId, difficulty: s.difficulty, wave: s.wave, savedAt: Date.now(), state: serialize(s) });
    this.saveStatus = r.ok ? `웨이브 ${s.wave} 시작 시점 저장됨` : (r.error || '저장 실패');
    if (!r.ok) this.toast(this.saveStatus, 2500);
  }
  private recordResult(s: GameState): { unlocked: string[] } {
    const unlocked: string[] = [];
    if (this.meta.claimedRuns.includes(s.runId)) return { unlocked };
    this.meta.claimedRuns.push(s.runId); if (this.meta.claimedRuns.length > 100) this.meta.claimedRuns.shift();
    const key = `${s.mapId}:${s.difficulty}`; const rec = this.meta.records[key] || { wins: 0, bestWave: 0, bestTime: 0 };
    const reached = s.phase === 'won' ? TOTAL_WAVES : s.wave;
    rec.bestWave = Math.max(rec.bestWave, reached); this.meta.bestWaveOverall = Math.max(this.meta.bestWaveOverall, reached);
    if (s.phase === 'won') { rec.wins++; this.meta.wins++; rec.bestTime = rec.bestTime ? Math.min(rec.bestTime, s.stats.playTime) : s.stats.playTime; if (s.mapId === 'A' && !this.meta.unlocked.mapB) { this.meta.unlocked.mapB = true; unlocked.push('새 맵 「고철 협곡」 해금!'); } if (s.difficulty === 'normal' && !this.meta.unlocked.hard) { this.meta.unlocked.hard = true; unlocked.push('어려움 난이도 해금!'); } }
    this.meta.records[key] = rec;
    for (const c of s.combosSeen) if (!this.meta.codex.includes(c)) this.meta.codex.push(c);
    saveMeta(this.meta); clearCheckpoint();
    return { unlocked };
  }

  // ---------- 결과 ----------
  private showResult(): void {
    const s = this.state!; const won = s.phase === 'won'; const { unlocked } = this.recordResult(s);
    this.stopLoop();
    const r = this.screens.result; r.innerHTML = '';
    r.append(el('h2', won ? 'win' : 'lose', won ? '방어 성공!' : '기지 파괴…'));
    const dmg = Object.entries(s.stats.dmgByKind).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${UNITS[k as UnitKind]?.name ?? k} ${Math.round(v)}`).join(' · ');
    const combos = Object.entries(s.stats.combos).map(([k, v]) => `${COMBOS[k as keyof typeof COMBOS].name} ${v}회`).join(' · ') || '없음';
    const worst = Object.entries(s.stats.lifeLostBy).sort((a, b) => b[1] - a[1])[0];
    const st = el('div', 'stats');
    st.innerHTML = `<div><span>맵 · 난이도</span><b>${MAPS[s.mapId].name} · ${DIFF[s.difficulty].name}</b></div><div><span>도달 웨이브</span><b>${won ? TOTAL_WAVES : s.wave} / ${TOTAL_WAVES}</b></div><div><span>플레이 시간</span><b>${fmtTime(s.stats.playTime)}</b></div><div><span>처치</span><b>${s.stats.kills}</b></div><div><span>소환 / 합성 / 판매</span><b>${s.stats.summons} / ${s.stats.merges} / ${s.stats.sells}</b></div><div><span>최고 등급</span><b>${s.stats.peakGrade}등급</b></div><div><span>피해 상위</span><b style="text-align:right">${dmg || '-'}</b></div><div><span>연계 발동</span><b style="text-align:right;max-width:60%">${combos}</b></div>${worst ? `<div><span>기지 피해 원인</span><b>${ENEMIES[worst[0] as EnemyKind].name} (${worst[1]})</b></div>` : ''}${unlocked.map(u => `<div class="unl">🎉 ${u}</div>`).join('')}`;
    const menu = el('div', 'menu');
    const again = el('button', 'primary', '다시 도전 (같은 맵·난이도)'); again.addEventListener('click', () => { this.sfx('click'); this.startGame(s.mapId, s.difficulty); });
    const sel = el('button', '', '맵·난이도 선택'); sel.addEventListener('click', () => { this.state = null; this.showSelect(); });
    const home = el('button', 'ghost', '처음으로'); home.addEventListener('click', () => { this.state = null; this.showTitle(); });
    menu.append(again, sel, home);
    const tip = el('div', 'foot', `<small>${won ? '다른 조합으로도 시도해 보세요. 연계 도감에서 아직 못 본 연계를 확인할 수 있습니다.' : '힌트: 같은 유닛 2기를 합쳐 칸을 아끼고, 기름·냉각·회오리 같은 조건 유닛을 공격 유닛 옆에 두면 연계가 터집니다.'}</small>`);
    r.append(st, menu, tip); this.show('result');
  }

  // ---------- HUD ----------
  private updateHud(): void {
    const s = this.state!; const u = this.ui;
    if (s.life !== this.hud.life) { this.hud.life = s.life; u.life.textContent = String(s.life); u.life.parentElement!.classList.toggle('low', s.life <= 5); }
    const gold = Math.floor(s.gold); if (gold !== this.hud.gold) { this.hud.gold = gold; u.gold.textContent = String(gold); const poor = gold < SUMMON_COST || s.units.length >= MAX_UNITS; u.offerrow.querySelectorAll('.offer').forEach(b => b.classList.toggle('poor', poor)); }
    if (s.wave !== this.hud.wave) { this.hud.wave = s.wave; u.wave.textContent = `웨이브 ${s.wave}/${TOTAL_WAVES}`; }
    const sub = s.phase === 'prep' ? `준비 ${Math.ceil(s.prepT)}초` : s.phase === 'wave' ? (s.wave === FINAL_BOSS_WAVE ? '최종 보스' : s.wave === MID_BOSS_WAVE ? '중간 보스' : `남은 적 ${s.enemies.length + (s.waveRt?.queue.length || 0)}`) : s.phase === 'won' ? '승리' : '패배';
    if (sub !== this.hud.prep) { this.hud.prep = sub; document.getElementById('hud-wave-sub')!.textContent = sub; }
    const showPrep = s.phase === 'prep'; u.prepbar.classList.toggle('hidden', !showPrep); if (showPrep) u.prepText.textContent = `웨이브 ${s.wave} 시작까지 ${Math.ceil(s.prepT)}초`;
    const ok = s.offer.join(',') + '|' + s.refreshFree + '|' + s.units.length; if (ok !== this.hud.offerKey) { this.hud.offerKey = ok; this.renderOffer(); }
    const v = this.renderer.view; const su = v.selectedUnit != null ? s.units.find(x => x.id === v.selectedUnit) : null;
    if (v.selectedUnit != null && !su) { v.selectedUnit = null; v.mode = 'none'; v.mergeTargets = []; this.renderUnitMenu(); this.updateHint(); }
    else if (su) { const uk = `${su.id}:${su.grade}:${su.slot}:${v.mode}:${mergeCandidates(s, su).length}`; if (uk !== this.hud.unitKey) { this.hud.unitKey = uk; this.renderUnitMenu(); } }
    this.updateTutorial();
  }

  private renderOffer(): void {
    const s = this.state; const row = this.ui.offerrow; if (!s) return;
    const v = this.renderer.view; const gold = Math.floor(s.gold);
    row.innerHTML = '';
    s.offer.forEach((kind, i) => {
      const d = UNITS[kind]; const poor = gold < SUMMON_COST || s.units.length >= MAX_UNITS;
      const b = el('button', 'offer' + (v.selectedOffer === i ? ' sel' : '') + (poor ? ' poor' : ''));
      const cv = el('canvas'); cv.width = 88; cv.height = 88; const c = cv.getContext('2d')!; c.drawImage(unitSprite(kind, 1, 2), 0, 0, 88, 88);
      b.append(cv, el('div', 'n', d.name), el('div', 'c', `${SUMMON_COST}💰`)); b.dataset.idx = String(i); b.setAttribute('aria-label', `${d.name} 소환 후보`);
      b.addEventListener('click', () => this.selectOffer(i));
      row.append(b);
    });
    const rb = el('button', '', s.refreshFree > 0 ? `새로고침<small>무료 ${s.refreshFree}회</small>` : `새로고침<small>${REFRESH_COST}💰</small>`); rb.id = 'btn-refresh';
    rb.addEventListener('click', () => { const r = dispatch(s, { type: 'refresh' }); if (!r.ok) { this.toast(r.error!); this.sfx('error'); return; } v.selectedOffer = null; this.sfx('click'); this.renderOffer(); this.updateHint(); });
    row.append(rb); this.ui.refresh = rb;
  }
  private selectOffer(i: number): void {
    const s = this.state!; const v = this.renderer.view;
    if (s.units.length >= MAX_UNITS) { this.toast(`배치 칸이 가득 찼습니다 (최대 ${MAX_UNITS}기). 합성으로 칸을 비우세요`); this.sfx('error'); return; }
    if (Math.floor(s.gold) < SUMMON_COST) { this.toast(`골드 부족 (${SUMMON_COST} 필요, 보유 ${Math.floor(s.gold)})`); this.sfx('error'); return; }
    v.selectedOffer = v.selectedOffer === i ? null : i; v.selectedUnit = null; v.mode = 'none'; v.mergeTargets = [];
    this.sfx('click'); this.renderOffer(); this.renderUnitMenu(); this.updateHint();
  }
  private renderUnitMenu(): void {
    const s = this.state; const v = this.renderer.view; const m = this.ui.unitmenu; if (!s) return;
    const u = v.selectedUnit != null ? s.units.find(x => x.id === v.selectedUnit) : null;
    m.classList.toggle('hidden', !u); this.ui.offerrow.classList.toggle('hidden', !!u);
    if (!u) return;
    const d = UNITS[u.kind]; const st = unitStats(u.kind, u.grade); const cands = mergeCandidates(s, u); const pv = mergePreview(u);
    m.innerHTML = '';
    const head = el('div', 'head'); const cv = el('canvas'); cv.width = 80; cv.height = 80; cv.getContext('2d')!.drawImage(unitSprite(u.kind, u.grade, 2), 0, 0, 80, 80);
    const statTxt = u.kind === 'engineer' ? `지원 범위 ${st.range} · 공격 속도 +${Math.round((u.grade === 1 ? 18 : u.grade === 2 ? 26 : 34))}%` : `피해 ${st.dmg.toFixed(0)} · 간격 ${st.cd.toFixed(2)}초 · 사거리 ${st.range}`;
    const desc = v.mode === 'merge' && pv ? `합성 → ${GRADE_NAME[pv.grade]}: ${pv.text}` : `${d.role} · ${u.grade === 3 ? d.g3 : d.desc}`;
    head.append(cv, el('div', 'info', `<b>${d.name}</b> <span class="badge g${u.grade}">${GRADE_NAME[u.grade]}</span> <small>${statTxt}</small><span class="d" title="${desc}">${desc}</span>`));
    const acts = el('div', 'acts');
    const bMove = el('button', v.mode === 'move' ? 'armed' : '', `이동<small>${v.mode === 'move' ? '칸 선택 중' : u.moveCd > 0 ? `대기 ${u.moveCd.toFixed(1)}s` : '빈칸·교환'}</small>`);
    bMove.addEventListener('click', () => { if (u.moveCd > 0) { this.toast(`이동 대기 ${u.moveCd.toFixed(1)}초`); return; } v.mode = v.mode === 'move' ? 'none' : 'move'; v.mergeTargets = []; this.sfx('click'); this.renderUnitMenu(); this.updateHint(); });
    const bMerge = el('button', v.mode === 'merge' ? 'armed' : '', `합성<small>${u.grade >= 3 ? '최고 등급' : cands.length ? `${cands.length}기 가능` : '같은 유닛 없음'}</small>`); bMerge.disabled = !cands.length;
    bMerge.addEventListener('click', () => { if (!cands.length) return; v.mode = v.mode === 'merge' ? 'none' : 'merge'; v.mergeTargets = v.mode === 'merge' ? cands.map(c => c.id) : []; this.sfx('click'); this.renderUnitMenu(); this.updateHint(); });
    const refund = sellValue(u);
    const armed = this.sellArmed === u.id;
    const bSell = el('button', armed ? 'danger' : '', armed ? `정말 판매?<small>+${refund}💰</small>` : `판매<small>+${refund}💰</small>`);
    bSell.addEventListener('click', () => { if (this.sellArmed !== u.id) { this.sellArmed = u.id; this.renderUnitMenu(); setTimeout(() => { if (this.sellArmed === u.id) { this.sellArmed = 0; this.renderUnitMenu(); } }, 2500); return; } this.sellArmed = 0; const r = dispatch(s, { type: 'sell', id: u.id }); if (r.ok) { this.sfx('sell'); this.toast(r.msg!, 1200, true); } else this.toast(r.error!); v.selectedUnit = null; v.mode = 'none'; v.mergeTargets = []; this.renderUnitMenu(); this.renderOffer(); this.updateHint(); });
    const bClose = el('button', 'ghost', '닫기'); bClose.addEventListener('click', () => { this.deselect(); });
    acts.append(bMove, bMerge, bSell, bClose); m.append(head, acts);
  }
  private deselect(): void { const v = this.renderer.view; v.selectedUnit = null; v.selectedOffer = null; v.mode = 'none'; v.mergeTargets = []; this.sellArmed = 0; this.renderUnitMenu(); this.renderOffer(); this.updateHint(); }

  private updateHint(): void {
    const s = this.state; const v = this.renderer.view; const h = this.ui.hint; if (!s) return;
    if (this.tutorialStep > 0 && this.tutorialStep < 4) { h.classList.add('tut'); this.ui.hintBtn.classList.remove('hidden'); this.ui.hintTxt.innerHTML = this.tutorialText(); return; }
    h.classList.remove('tut'); this.ui.hintBtn.classList.add('hidden');
    let t = '';
    if (v.selectedOffer != null) t = `초록색 빈칸을 눌러 ${UNITS[s.offer[v.selectedOffer]].name}을(를) 배치하세요 (다시 누르면 취소)`;
    else if (v.mode === 'move') t = '옮길 칸을 누르세요. 유닛이 있는 칸이면 자리를 바꿉니다';
    else if (v.mode === 'merge') { const su = s.units.find(x => x.id === v.selectedUnit); const pv = su ? mergePreview(su) : null; t = pv ? `노란 테두리의 같은 유닛을 누르면 ${GRADE_NAME[pv.grade]}으로 합성: ${pv.text}` : '노란 테두리의 같은 유닛을 누르면 합성됩니다'; }
    else if (v.selectedUnit != null) t = '흰 원이 사거리입니다. 유닛을 옮기거나 합성·판매할 수 있습니다';
    else if (s.units.length === 0) t = '아래 후보 중 하나를 고르고 빈칸을 눌러 배치하세요';
    else t = '유닛을 누르면 사거리와 메뉴가 보입니다 · 같은 유닛 2기 = 합성';
    this.ui.hintTxt.textContent = t;
  }

  // ---------- 전장 입력 ----------
  private onFieldTap(px: number, py: number): void {
    const s = this.state; if (!s || this.paused) return;
    const v = this.renderer.view; const [fx, fy] = this.renderer.toField(px, py);
    const slot = this.renderer.slotAt(s.mapId, fx, fy);
    if (slot == null) { if (v.selectedUnit != null || v.selectedOffer != null) this.deselect(); return; }
    const occ = s.slots[slot];
    if (v.mode === 'move' && v.selectedUnit != null) {
      const r = dispatch(s, { type: 'move', id: v.selectedUnit, slot }); if (!r.ok) { this.toast(r.error!); this.sfx('error'); return; }
      this.sfx('place'); this.deselect(); return;
    }
    if (v.mode === 'merge' && v.selectedUnit != null) {
      if (occ != null && v.mergeTargets.includes(occ)) {
        const a = s.units.find(x => x.id === v.selectedUnit)!;
        const r = dispatch(s, { type: 'merge', a: a.id, b: occ }); if (!r.ok) { this.toast(r.error!); this.sfx('error'); return; }
        this.sfx(a.grade === 3 ? 'merge3' : 'merge'); this.deselect(); return;
      }
      if (occ == null) { this.toast('합성할 유닛을 눌러야 합니다'); return; }
    }
    if (occ != null) {
      if (v.selectedOffer != null) { this.toast('이미 유닛이 있는 칸입니다. 빈칸을 고르세요'); this.sfx('error'); return; }
      v.selectedUnit = occ; v.mode = 'none'; v.mergeTargets = []; this.sellArmed = 0; this.sfx('click'); this.renderUnitMenu(); this.updateHint(); return;
    }
    // 빈칸
    if (v.selectedOffer != null) {
      const r = dispatch(s, { type: 'place', offer: v.selectedOffer, slot });
      if (!r.ok) { this.toast(r.error!); this.sfx('error'); return; }
      this.sfx('place'); v.selectedOffer = null; this.renderOffer(); this.updateHint(); return;
    }
    if (v.selectedUnit != null) { this.deselect(); return; }
    this.toast('먼저 아래에서 소환 후보를 고르세요', 1400);
  }

  // ---------- 시뮬레이션 이벤트 → 소리·메시지 ----------
  private onSimEvent(e: SimEvent): void {
    switch (e.t) {
      case 'shoot': this.sfx(e.boost && e.kind === 'laser' ? 'shoot_laser_over' : KIND_SFX[e.kind]); break;
      case 'hit': if (e.kind !== 'burn') this.sfx('hit'); break;
      case 'explode': this.sfx(e.kind === 'ignite' ? 'ignite' : e.kind === 'shards' ? 'shards' : e.kind === 'focus' ? 'explode_big' : e.kind === 'frostsplash' ? 'freeze' : 'explode'); break;
      case 'vortex': this.sfx(e.fire ? 'vortex_fire' : 'vortex'); break;
      case 'status': if (e.kind === 'freeze') this.sfx('freeze'); break;
      case 'die': this.sfx(e.boss ? 'die_boss' : 'die'); break;
      case 'leak': this.sfx('leak'); break;
      case 'combo': this.sfx('combo'); if (e.first) { const c = COMBOS[e.id]; this.pushMsg(`★ 연계 발견: ${c.name} — ${c.cond} ${c.effect.split('.')[0]}`, 'good', 5000); if (!this.meta.codex.includes(e.id)) { this.meta.codex.push(e.id); saveMeta(this.meta); } } break;
      case 'wave': this.sfx('wave'); break;
      case 'boss': this.sfx('boss'); break;
      case 'bosspattern': if (e.phase === 'warn') this.sfx('boss_warn'); break;
      case 'engpulse': this.sfx('engineer'); break;
      case 'won': this.sfx('win'); break;
      case 'lost': this.sfx('lose'); break;
      case 'msg': this.pushMsg(e.text, e.kind); break;
      default: break;
    }
  }
  private pushMsg(text: string, kind: 'info' | 'warn' | 'good', ms = 2600): void {
    const bar = this.ui.msgbar; const m = el('div', 'msg ' + kind, text); bar.append(m);
    while (bar.children.length > 2) bar.firstElementChild!.remove();
    window.setTimeout(() => m.remove(), ms);
  }

  // ---------- 튜토리얼 ----------
  private tutorialText(): string {
    switch (this.tutorialStep) {
      case 1: return '<b>① 배치</b> 아래 후보에서 <b>화염봇</b>을 고르고, 초록색으로 반짝이는 빈칸을 누르세요. (25골드)';
      case 2: return '<b>② 합성</b> 같은 유닛(예: 화염봇)을 하나 더 배치한 뒤, 그 유닛을 누르고 <b>[합성]</b> → 노란 테두리의 짝을 누르세요.';
      case 3: return '<b>③ 연계</b> <b>기름분사기</b>를 화염봇 근처에 두세요. 기름 묻은 적이 화염을 맞으면 <b>점화 폭발</b>이 터집니다!';
      default: return '';
    }
  }
  private updateTutorial(): void {
    const s = this.state; if (!s || this.tutorialStep === 0 || this.tutorialStep >= 4) return;
    const v = this.renderer.view;
    if (this.tutorialStep === 1 && s.units.length >= 1) { this.tutorialStep = 2; this.updateHint(); }
    if (this.tutorialStep === 2 && s.stats.merges >= 1) { this.tutorialStep = 3; this.updateHint(); }
    if (this.tutorialStep === 3 && s.combosSeen.length >= 1) { this.tutorialStep = 4; this.meta.tutorialDone = true; saveMeta(this.meta); v.tutorialSlot = null; this.updateHint(); this.pushMsg('튜토리얼 완료! 도움말에서 언제든 다시 볼 수 있습니다.', 'good', 4000); return; }
    // 강조 칸: 1단계는 첫 빈칸, 2단계는 화염봇 옆 빈칸, 3단계는 화염봇 근처 빈칸
    if (this.tutorialStep === 1) v.tutorialSlot = 1;
    else { const fl = s.units.find(u => u.kind === 'flame'); const slots = mapSlots(s.mapId); if (fl) { let best: number | null = null, bd = 1e9; for (const sl of slots) { if (s.slots[sl.id] != null) continue; const d = Math.hypot(sl.x - slots[fl.slot].x, sl.y - slots[fl.slot].y); if (d < bd) { bd = d; best = sl.id; } } v.tutorialSlot = best; } else v.tutorialSlot = null; }
  }
  private skipTutorial(): void { this.tutorialStep = 4; this.meta.tutorialDone = true; saveMeta(this.meta); this.renderer.view.tutorialSlot = null; this.updateHint(); this.sfx('click'); }

  // ---------- 모달 ----------
  private openModal(title: string, content: HTMLElement): void { this.ui.modalTitle.textContent = title; this.ui.modalContent.innerHTML = ''; this.ui.modalContent.append(content); this.ui.modal.classList.remove('hidden'); if (this.state && !this.paused && !this.screens.game.classList.contains('hidden')) this.pause('user'); }
  closeModal(): void { this.ui.modal.classList.add('hidden'); }
  private confirm(text: string, onYes: () => void): void {
    const box = el('div'); box.append(el('p', '', text));
    const row = el('div', 'diffrow'); const y = el('button', 'danger', '확인'); y.addEventListener('click', () => { this.closeModal(); onYes(); }); const n = el('button', '', '취소'); n.addEventListener('click', () => this.closeModal()); row.append(y, n); box.append(row);
    this.openModal('확인', box);
  }
  openCodex(): void {
    const box = el('div'); const seen = new Set([...this.meta.codex, ...(this.state?.combosSeen || [])]);
    box.append(el('p', '', `<small>발견한 연계 ${seen.size}/${COMBO_IDS.length}. 연계는 실제 전투에서 처음 발생했을 때 기록됩니다.</small>`));
    for (const id of COMBO_IDS) {
      const c = COMBOS[id]; const known = seen.has(id);
      const row = el('div', 'combo' + (known ? '' : ' unknown'));
      const ic = el('div', 'ic', known ? '★' : '?'); ic.style.background = known ? c.color : '#37415a'; ic.style.color = '#1a1230';
      row.append(ic, el('div', 't', known ? `<b>${c.name}</b> <small>${UNITS[c.units[0]].name} + ${UNITS[c.units[1]].name}</small><br><small>${c.cond} → ${c.effect}</small>` : `<b>???</b> <small>${UNITS[c.units[0]].name} + ${UNITS[c.units[1]].name}</small><br><small>두 유닛을 가까이 두고 조건을 만들어 보세요.</small>`));
      box.append(row);
    }
    this.openModal('연계 도감', box);
  }
  openHelp(): void {
    const box = el('div');
    box.innerHTML = `<p><b>한 판의 흐름</b><br><small>맵·난이도 선택 → 유닛 배치 → 18웨이브 방어 (9웨이브 중간 보스, 18웨이브 최종 보스) → 결과. 기지 체력이 0이 되면 즉시 패배.</small></p>
      <p><b>조작</b><br><small>· 소환: 하단 후보 3개 중 하나를 누르고 초록 빈칸을 누르면 ${SUMMON_COST}골드로 배치. 배치 후 후보가 새로 나옵니다. 후보만 고르고 취소하면 비용이 없습니다.<br>· 새로고침: 한 판에 무료 2회, 이후 ${REFRESH_COST}골드.<br>· 유닛을 누르면 사거리(흰 원)와 이동·합성·판매 메뉴. 드래그가 필요 없습니다.<br>· 합성: 같은 종류·같은 등급 2기 → 한 등급 위(최대 3등급). 3등급은 공격 방식이 달라집니다.<br>· 판매: 실제 투입 골드의 60% 환급.<br>· 상단 1×/2× 속도, ⏸ 일시정지. 화면을 벗어나면 자동으로 멈춥니다.</small></p>
      <p><b>이어하기</b><br><small>게임을 닫았다가 돌아오면 <b>마지막 웨이브 시작 시점</b>부터 다시 진행합니다(웨이브 중간 상태는 저장되지 않습니다). 준비 시간 동안 배치한 유닛은 그 웨이브 시작 시점 저장에 포함되지 않습니다.</small></p>
      <p><b>튜토리얼 3단계</b><br><small>① 후보를 골라 빈칸에 배치 → ② 같은 유닛 2기 합성 → ③ 기름분사기 + 화염봇으로 첫 연계(점화 폭발) 확인.</small></p>
      <p><b>유닛 8종</b></p>`;
    const ul = el('div', 'unitlist');
    for (const k of UNIT_KINDS) { const d = UNITS[k]; const u = el('div', 'u'); const cv = el('canvas'); cv.width = 80; cv.height = 80; cv.getContext('2d')!.drawImage(unitSprite(k, 1, 2), 0, 0, 80, 80); u.append(cv, el('div', '', `<b>${d.name}</b><small>${d.role}</small><small>3등급: ${d.g3}</small>`)); ul.append(u); }
    box.append(ul);
    const en = el('p', '', `<b>적</b><br><small>${(Object.keys(ENEMIES) as EnemyKind[]).map(k => `· <b>${ENEMIES[k].name}</b>(${ENEMIES[k].trait}): ${ENEMIES[k].hint}`).join('<br>')}</small>`);
    box.append(en);
    this.openModal('도움말', box);
  }
  openSettings(): void {
    const box = el('div'); const st = this.meta.settings; const save = () => { saveMeta(this.meta); this.applySettings(); };
    const row = (label: string, ctrl: HTMLElement) => { const r = el('div', 'setrow'); r.append(el('span', '', label), ctrl); box.append(r); };
    const vol = el('input'); vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = String(st.sfx); vol.addEventListener('input', () => { st.sfx = Number(vol.value); save(); }); vol.addEventListener('change', () => this.sfx('click')); row('효과음 음량', vol);
    const mute = el('button', 'small' + (st.muted ? ' sel' : ''), st.muted ? '음소거 중' : '소리 켬'); mute.addEventListener('click', () => { st.muted = !st.muted; save(); mute.textContent = st.muted ? '음소거 중' : '소리 켬'; mute.classList.toggle('sel', st.muted); }); row('음소거', mute);
    const fxo = el('div', 'opts'); (['0', '1', '2'] as const).forEach((v, i) => { const b = el('button', st.fxLevel === i ? 'sel' : '', ['최소', '보통', '전체'][i]); b.addEventListener('click', () => { st.fxLevel = i as 0 | 1 | 2; save(); fxo.querySelectorAll('button').forEach((x, j) => x.classList.toggle('sel', j === i)); }); fxo.append(b); }); row('효과 강도(흔들림·파티클)', fxo);
    const dn = el('button', 'small' + (st.dmgNumbers ? ' sel' : ''), st.dmgNumbers ? '표시' : '숨김'); dn.addEventListener('click', () => { st.dmgNumbers = !st.dmgNumbers; save(); dn.textContent = st.dmgNumbers ? '표시' : '숨김'; dn.classList.toggle('sel', st.dmgNumbers); }); row('피해 숫자', dn);
    const sr = el('button', 'small' + (st.showRanges ? ' sel' : ''), st.showRanges ? '표시' : '숨김'); sr.addEventListener('click', () => { st.showRanges = !st.showRanges; save(); sr.textContent = st.showRanges ? '표시' : '숨김'; sr.classList.toggle('sel', st.showRanges); }); row('공병 지원 범위 항상 표시', sr);
    const tut = el('button', 'small', '다시 보기'); tut.addEventListener('click', () => { this.meta.tutorialDone = false; save(); this.toast('다음 「초록 작업장 · 보통」 새 게임에서 튜토리얼이 나옵니다', 2500, true); }); row('튜토리얼', tut);
    const reset = el('button', 'small danger', '모두 삭제'); reset.addEventListener('click', () => this.confirm('설정·기록·해금·도감·진행 중 저장을 모두 삭제할까요? 되돌릴 수 없습니다.', () => { clearAll(); this.meta = loadMeta().meta; this.applySettings(); this.state = null; this.stopLoop(); this.toast('저장을 초기화했습니다', 2000, true); this.showTitle(); })); row('저장 초기화', reset);
    box.append(el('p', '', `<small>저장소: ${storageInfo.available ? '브라우저 localStorage 사용 중' : '사용 불가 (' + storageInfo.reason + ')'}${this.saveStatus ? ' · ' + this.saveStatus : ''}</small>`));
    this.openModal('설정', box);
  }

  // ---------- 테스트 훅 ----------
  act(a: Parameters<typeof dispatch>[1]) { return this.state ? dispatch(this.state, a) : { ok: false, error: 'no state' }; }
  get view() { return this.renderer.view; }
  tapField(fx: number, fy: number): void { const [px, py] = this.renderer.toScreen(fx, fy); this.onFieldTap(px, py); }
  slotScreenPos(slot: number): { x: number; y: number } | null { if (!this.state) return null; const sl = mapSlots(this.state.mapId)[slot]; const [x, y] = this.renderer.toScreen(sl.x, sl.y); const r = this.renderer.canvas.getBoundingClientRect(); return { x: r.left + x, y: r.top + y }; }
  get tutorial() { return this.tutorialStep; }
  static readonly SLOT_R = SLOT_R;
}
