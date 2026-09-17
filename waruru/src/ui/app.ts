// 앱: 화면(타이틀·스테이지 선택·플레이), 게임 루프(고정 시간 간격), 입력(조준·발사), HUD·결과·힌트·튜토리얼·일시정지·저장.
import { LevelSession } from '../sim/session';
import type { LevelDef, ShotInput, SessionEvent, Vec2 } from '../sim/types';
import { LEVELS, levelById } from '../data/levels/index';
import { SOLUTIONS } from '../data/solutions';
import { FIXED_DT, MAX_STEPS_PER_FRAME, LAUNCH, JUDGE } from '../data/physics';
import { dragToShot, clampDrag, previewTrajectory, makeHitTest } from '../sim/launcher';
import { Renderer, type ViewState } from '../render/renderer';
import { Sfx } from '../platform/audio';
import { loadSave, writeSave, resetSave, recordSuccess, totalStars, type SaveData, type SaveStatus } from '../platform/save';
import { FAIL_TEXT, TUTORIALS, SAVE_POLICY } from './strings';

type Screen = 'title' | 'levels' | 'game';

const $ = (sel: string, root: ParentNode = document) => root.querySelector(sel) as HTMLElement;
const el = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export class App {
  root: HTMLElement;
  save: SaveData; saveStatus: SaveStatus; saveOk = true;
  sfx = new Sfx();
  screen: Screen = 'title';
  // 플레이
  session: LevelSession | null = null;
  level: LevelDef | null = null;
  renderer: Renderer | null = null;
  canvas: HTMLCanvasElement | null = null;
  paused = false;
  pauseReason: 'menu' | 'background' | null = null;
  acc = 0; lastT = 0; raf = 0; time = 0;
  view: ViewState = { aiming: false, drag: null, preview: [], power: 0, highlight: new Set(), hintShot: null, debug: false, time: 0, recoil: 0, resultFlash: 0 };
  pointerId: number | null = null;
  hintStage = 0;
  tutorialKey: string | null = null; tutorialStep = 0;
  resultShown = false; resultRecorded = false;
  dev = false;
  fps = 0; private fpsAcc = 0; private fpsN = 0;
  private lastPullSfx = 0;
  private comboTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    const { data, status } = loadSave();
    this.save = data; this.saveStatus = status;
    this.sfx.setVolume(this.save.settings.volume); this.sfx.setMuted(this.save.settings.muted);
    const params = new URLSearchParams(location.search);
    this.dev = params.get('dev') === '1';
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.onBackground(); });
    window.addEventListener('blur', () => this.cancelAim());
    window.addEventListener('resize', () => this.renderer?.resize());
    // 첫 사용자 입력에서 오디오 잠금 해제
    const unlock = () => this.sfx.unlock();
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    const lv = Number(params.get('level'));
    if (lv >= 1 && levelById(lv)) { this.startLevel(lv); if (params.get('replay') === '1' && this.dev) setTimeout(() => this.replaySolution(), 300); }
    else this.showTitle();
  }

  // ---------- 화면 ----------
  private clear() { this.stopLoop(); this.root.innerHTML = ''; this.session?.dispose(); this.session = null; this.renderer = null; this.canvas = null; }

  showTitle() {
    this.clear(); this.screen = 'title';
    const s = el('div', 'screen', ''); s.id = 'title';
    const total = totalStars(this.save);
    const cleared = Object.keys(this.save.best).length;
    s.innerHTML = `
      <div class="logo">🏗️</div>
      <h1>와르르! 철거왕<small>한 발의 기적 · 웹 베타</small></h1>
      <p class="sub">한 발의 커터볼로 밧줄을 끊고, 추를 떨어뜨리고, 구조물을 무너뜨리세요.</p>
      <div class="stack">
        <button class="btn primary" id="btn-play">${cleared > 0 ? `이어하기 (스테이지 ${Math.min(this.save.currentLevel, this.save.unlocked)})` : '시작하기'}</button>
        <button class="btn" id="btn-levels">스테이지 선택 · ★ ${total}/${LEVELS.length * 3}</button>
        <button class="btn ghost" id="btn-settings">설정</button>
        <p class="note">${SAVE_POLICY}</p>
        ${this.saveStatus === 'corrupt' ? `<p class="note" style="color:var(--danger)">저장 데이터가 손상되어 읽을 수 없습니다. 초기화하면 새로 시작할 수 있습니다.</p><button class="btn danger" id="btn-reset">저장 초기화</button>` : ''}
        ${this.saveStatus === 'unavailable' ? `<p class="note" style="color:var(--danger)">이 브라우저에서는 저장을 사용할 수 없습니다(사생활 보호 모드 등). 기록이 유지되지 않습니다.</p>` : ''}
      </div>`;
    this.root.appendChild(s);
    $('#btn-play', s).onclick = () => { this.sfx.ui(); this.startLevel(Math.min(this.save.currentLevel, this.save.unlocked)); };
    $('#btn-levels', s).onclick = () => { this.sfx.ui(); this.showLevels(); };
    $('#btn-settings', s).onclick = () => { this.sfx.ui(); this.openSettings(s); };
    const rb = s.querySelector('#btn-reset') as HTMLElement | null;
    if (rb) rb.onclick = () => { if (confirm('저장 데이터를 초기화할까요? 모든 기록이 사라집니다.')) { resetSave(); const r = loadSave(); this.save = r.data; this.saveStatus = r.status === 'empty' ? 'ok' : r.status; this.showTitle(); } };
  }

  showLevels() {
    this.clear(); this.screen = 'levels';
    const s = el('div', 'screen'); s.id = 'levels';
    s.innerHTML = `<div class="row" style="justify-content:space-between"><h1>스테이지</h1><button class="btn ghost" id="btn-back">← 처음</button></div>
      <p class="sub">★ ${totalStars(this.save)}/${LEVELS.length * 3} · 최고 콤보 ${this.save.maxCombo} · 클리어한 스테이지는 자유롭게 다시 도전할 수 있어요.</p><div class="grid"></div>`;
    const grid = $('.grid', s);
    for (const lv of LEVELS) {
      const best = this.save.best[lv.key];
      const locked = lv.id > this.save.unlocked;
      const c = el('button', `cell${locked ? ' locked' : ''}${best ? ' cleared' : ''}${lv.id === this.save.currentLevel ? ' current' : ''}`);
      c.innerHTML = `<span>${locked ? '🔒' : lv.id}</span><span class="stars">${best ? '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : ''}</span><span class="shots">${best ? `${best.shots}발` : locked ? '' : lv.title}</span>`;
      c.title = lv.title;
      if (!locked) c.onclick = () => { this.sfx.ui(); this.startLevel(lv.id); };
      grid.appendChild(c);
    }
    this.root.appendChild(s);
    $('#btn-back', s).onclick = () => { this.sfx.ui(); this.showTitle(); };
  }

  openSettings(parent: HTMLElement) {
    const ov = el('div', 'overlay');
    ov.innerHTML = `<div class="card settings"><h2>설정</h2>
      <label>효과음 크기 <input type="range" id="s-vol" min="0" max="100" value="${Math.round(this.save.settings.volume * 100)}"></label>
      <label>음소거 <input type="checkbox" id="s-mute" ${this.save.settings.muted ? 'checked' : ''}></label>
      <label>화면 흔들림·효과 줄이기 <input type="checkbox" id="s-fx" ${this.save.settings.reducedFx ? 'checked' : ''}></label>
      <p class="note">${SAVE_POLICY}</p>
      <div class="stack" style="margin-top:12px"><button class="btn primary" id="s-close">닫기</button><button class="btn danger" id="s-reset">저장 초기화</button></div></div>`;
    parent.appendChild(ov);
    ($('#s-vol', ov) as HTMLInputElement).oninput = (e) => { this.save.settings.volume = Number((e.target as HTMLInputElement).value) / 100; this.sfx.setVolume(this.save.settings.volume); this.persist(); };
    ($('#s-mute', ov) as HTMLInputElement).onchange = (e) => { this.save.settings.muted = (e.target as HTMLInputElement).checked; this.sfx.setMuted(this.save.settings.muted); this.persist(); };
    ($('#s-fx', ov) as HTMLInputElement).onchange = (e) => { this.save.settings.reducedFx = (e.target as HTMLInputElement).checked; if (this.renderer) this.renderer.effects.reduced = this.save.settings.reducedFx; this.persist(); };
    $('#s-close', ov).onclick = () => { this.sfx.ui(); ov.remove(); };
    $('#s-reset', ov).onclick = () => { if (confirm('저장 데이터를 초기화할까요? 모든 기록이 사라집니다.')) { resetSave(); const r = loadSave(); this.save = r.data; this.saveStatus = r.status === 'empty' ? 'ok' : r.status; ov.remove(); if (this.screen === 'title') this.showTitle(); else if (this.screen === 'levels') this.showLevels(); } };
  }

  persist() { this.saveOk = writeSave(this.save); if (!this.saveOk) this.toast('저장에 실패했습니다. 기록이 유지되지 않을 수 있어요.'); }

  // ---------- 플레이 ----------
  startLevel(id: number) {
    const lv = levelById(id);
    if (!lv) return;
    this.clear(); this.screen = 'game';
    this.level = lv;
    this.save.currentLevel = id; this.persist();
    const g = el('div'); g.id = 'game';
    g.innerHTML = `
      <div id="hud-top">
        <button class="btn icon" id="btn-levels" title="스테이지 목록">≡</button>
        <div class="stage">${lv.id}. ${lv.title}<small>${lv.subtitle}</small></div>
        <div class="pill" id="pill-shots" title="남은 발사 수"></div>
        <div class="pill" id="pill-goals" title="목표 달성"></div>
        <button class="btn icon" id="btn-pause" title="일시정지">⏸</button>
      </div>
      <div id="stage-wrap"><canvas id="cv"></canvas></div>
      <div id="hud-bottom">
        <button class="btn" id="btn-restart">↺ 다시 시작</button>
        <div class="hint-area" id="hint-area">발사대를 누른 채 뒤로 당겼다 놓으세요</div>
        <button class="btn" id="btn-hint">💡 힌트</button>
      </div>`;
    this.root.appendChild(g);
    this.canvas = $('#cv', g) as HTMLCanvasElement;
    this.renderer = new Renderer(this.canvas);
    this.renderer.effects.reduced = this.save.settings.reducedFx;
    this.renderer.resize();
    this.bindInput();
    $('#btn-restart', g).onclick = () => { this.sfx.ui(); this.restart(); };
    $('#btn-hint', g).onclick = () => { this.sfx.ui(); this.nextHint(); };
    $('#btn-pause', g).onclick = () => { this.sfx.ui(); this.openPause(); };
    $('#btn-levels', g).onclick = () => { this.sfx.ui(); this.showLevels(); };
    this.newSession();
    this.startLoop();
  }

  private newSession() {
    this.session?.dispose();
    this.session = new LevelSession(this.level!);
    this.session.drainEvents();
    this.renderer?.effects.clear();
    this.hintStage = 0; this.view.highlight = new Set(); this.view.hintShot = null; this.view.recoil = 0;
    this.resultShown = false; this.resultRecorded = false;
    this.paused = false; this.pauseReason = null; this.acc = 0;
    this.cancelAim();
    $('#stage-wrap')?.querySelectorAll('.overlay, .combo, .tip, .toast').forEach((n) => n.remove());
    this.updateHud();
    this.setupTutorial();
  }

  restart() { this.newSession(); }

  private setupTutorial() {
    const lv = this.level!;
    this.tutorialKey = null; this.tutorialStep = 0;
    if (lv.tutorial && !this.save.tutorialsDone.includes(lv.tutorial)) { this.tutorialKey = lv.tutorial; this.showTip(); }
    if (lv.shots >= 2 && lv.id >= 6 && !this.save.tutorialsDone.includes('twoShots') && !this.tutorialKey) { this.tutorialKey = 'twoShots'; this.showTip(); }
  }
  private showTip() {
    $('#stage-wrap')?.querySelectorAll('.tip').forEach((n) => n.remove());
    if (!this.tutorialKey) return;
    const steps = TUTORIALS[this.tutorialKey as keyof typeof TUTORIALS];
    if (!steps || this.tutorialStep >= steps.length) { this.finishTutorial(); return; }
    const tip = el('div', 'tip');
    const isLast = this.tutorialStep === steps.length - 1;
    tip.innerHTML = `<div class="txt">${steps[this.tutorialStep]}</div><button class="btn" id="tip-next">${isLast ? '확인' : '다음'}</button><button class="btn ghost" id="tip-skip">건너뛰기</button>`;
    $('#stage-wrap').appendChild(tip);
    $('#tip-next', tip).onclick = () => { this.sfx.ui(); this.tutorialStep++; this.showTip(); };
    $('#tip-skip', tip).onclick = () => { this.sfx.ui(); this.finishTutorial(); };
  }
  private finishTutorial() {
    if (this.tutorialKey && !this.save.tutorialsDone.includes(this.tutorialKey)) { this.save.tutorialsDone.push(this.tutorialKey); this.persist(); }
    this.tutorialKey = null;
    $('#stage-wrap')?.querySelectorAll('.tip').forEach((n) => n.remove());
  }
  /** 이벤트에 따라 기본 튜토리얼 단계를 자동으로 넘긴다 */
  private tutorialAdvance(trigger: 'aimStart' | 'launch' | 'goal') {
    if (this.tutorialKey !== 'basic') return;
    const want = trigger === 'aimStart' ? 1 : trigger === 'launch' ? 2 : 3;
    if (this.tutorialStep < want) { this.tutorialStep = want; this.showTip(); }
  }
  replayHelp() { const lv = this.level!; if (lv.tutorial) { this.tutorialKey = lv.tutorial; this.tutorialStep = 0; this.showTip(); } else this.toast('이 스테이지에는 도움말이 없습니다.'); }

  private nextHint() {
    const lv = this.level!;
    this.hintStage = (this.hintStage + 1) % (lv.hints.length + 1);
    const area = $('#hint-area');
    this.view.highlight = new Set(); this.view.hintShot = null;
    if (this.hintStage === 0) { area.innerHTML = '힌트를 껐습니다'; return; }
    const h = lv.hints[this.hintStage - 1];
    area.innerHTML = `<b>힌트 ${this.hintStage}/${lv.hints.length}</b> ${h.text}`;
    if (h.highlight) this.view.highlight = new Set(h.highlight);
    if (h.shot) this.view.hintShot = h.shot;
  }

  // ---------- 입력 ----------
  private bindInput() {
    const cv = this.canvas!;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.session || !this.renderer || this.paused || this.pointerId !== null) return;
      if (this.session.state !== 'aiming' || this.session.shotsLeft <= 0) return;
      const w = this.renderer.toWorld(e.clientX, e.clientY);
      const L = this.session.level.launcher;
      if (Math.hypot(w.x - L.x, w.y - L.y) > LAUNCH.touchRadius) return;
      this.pointerId = e.pointerId;
      try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
      this.view.aiming = true; this.view.drag = { x: 0, y: 0 }; this.view.preview = []; this.view.power = 0;
      this.tutorialAdvance('aimStart');
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.pointerId !== e.pointerId || !this.session || !this.renderer) return;
      const w = this.renderer.toWorld(e.clientX, e.clientY);
      const L = this.session.level.launcher;
      const drag = clampDrag({ x: w.x - L.x, y: w.y - L.y });
      this.view.drag = drag;
      const shot = dragToShot(drag);
      this.view.power = shot?.power ?? 0;
      if (shot) {
        const bodies = [...this.session.world.entries.values()].filter((en) => !en.removed && en.kind !== 'projectile').map((en) => en.body);
        this.view.preview = previewTrajectory(L, shot, makeHitTest(bodies));
        const now = performance.now();
        if (now - this.lastPullSfx > 120) { this.lastPullSfx = now; this.sfx.pull(shot.power); }
      } else this.view.preview = [];
      e.preventDefault();
    });
    const release = (e: PointerEvent, cancel: boolean) => {
      if (this.pointerId !== e.pointerId) return;
      const drag = this.view.drag;
      this.pointerId = null;
      this.view.aiming = false; this.view.drag = null; this.view.preview = [];
      if (cancel || !drag || !this.session || this.paused) return;
      const shot = dragToShot(drag);
      if (!shot) return; // 아주 짧은 당김은 취소
      this.fire(shot);
    };
    cv.addEventListener('pointerup', (e) => release(e, false));
    cv.addEventListener('pointercancel', (e) => release(e, true));
    cv.addEventListener('lostpointercapture', (e) => { if (this.pointerId === e.pointerId) release(e, true); });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  private cancelAim() { this.pointerId = null; this.view.aiming = false; this.view.drag = null; this.view.preview = []; }

  fire(shot: ShotInput) {
    if (!this.session || this.paused) return;
    if (this.session.launch(shot)) {
      this.view.recoil = 1; this.view.hintShot = null;
      this.sfx.launch(shot.power);
      this.tutorialAdvance('launch');
      this.updateHud();
    }
  }

  /** 개발용: 검증된 해법 재생 */
  replaySolution() {
    if (!this.session || !this.level) return;
    const sol = SOLUTIONS[this.level.solutionRef];
    if (!sol) { this.toast('기록된 해법이 없습니다'); return; }
    if (sol.levelVersion !== this.level.version) this.toast(`주의: 해법 버전(${sol.levelVersion}) ≠ 스테이지 버전(${this.level.version})`);
    let i = 0;
    const tick = () => {
      if (!this.session || this.session.level !== this.level) return;
      if (i >= sol.shots.length) return;
      if (this.session.state === 'aiming' && !this.paused) { this.fire(sol.shots[i++]); }
      if (i < sol.shots.length) setTimeout(tick, 200);
    };
    tick();
  }

  // ---------- 루프 ----------
  private startLoop() { this.lastT = performance.now(); this.acc = 0; cancelAnimationFrame(this.raf); const frame = (t: number) => { this.raf = requestAnimationFrame(frame); this.frame(t); }; this.raf = requestAnimationFrame(frame); }
  private stopLoop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  private frame(t: number) {
    const dtReal = Math.min(0.25, (t - this.lastT) / 1000); // 긴 지연은 잘라낸다
    this.lastT = t;
    this.fpsAcc += dtReal; this.fpsN++; if (this.fpsAcc >= 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    const s = this.session, r = this.renderer;
    if (!s || !r) return;
    if (!this.paused) {
      this.acc += dtReal;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) { s.step(); this.acc -= FIXED_DT; steps++; }
      if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0; // 보충 한도 초과분은 버린다(한꺼번에 계산하지 않음)
      this.handleEvents(s.drainEvents());
      this.time += dtReal;
      r.effects.update(dtReal);
      this.view.recoil = Math.max(0, this.view.recoil - dtReal * 4);
      for (const p of s.world.projectiles) if (!p.removed) r.effects.trail(p.id, p.body.position);
      // 구름 소리(주요 공)
      for (const e of s.world.circles) if (!e.removed && e.kind === 'ball' && !e.body.isSleeping) { const sp = e.body.speed; if (sp > 2) this.sfx.roll(sp / 8); }
    }
    this.view.time = this.time;
    this.view.debug = this.dev && this.view.debug;
    r.draw(s, this.view);
    if (this.dev) this.drawDebugText();
    if ((s.state === 'success' || s.state === 'failed') && !this.resultShown && s.step_ - s.resultAtStep >= JUDGE.resultDelaySteps) this.showResult();
  }

  private handleEvents(evs: SessionEvent[]) {
    const r = this.renderer!, s = this.session!;
    for (const ev of evs) {
      switch (ev.t) {
        case 'hit': {
          const strength = Math.min(1, ev.speed / 12);
          const m = ev.material === 'cutter' || ev.material === 'ground' ? ev.other : ev.material;
          this.sfx.hit(m, strength);
          if (strength > 0.15) { r.effects.dust(ev.x, ev.y, Math.round(3 + strength * 6)); if (m === 'wood' && strength > 0.4) r.effects.chips(ev.x, ev.y, Math.round(strength * 6)); if (strength > 0.5) r.effects.addShake(strength * 4); }
          break;
        }
        case 'ropeCut': r.effects.ropeSnap(ev.a, ev.b, ev.at); this.sfx.ropeCut(); this.toast('밧줄 절단!'); break;
        case 'goal': this.sfx.goal(ev.combo); r.effects.addShake(3 + ev.combo); this.showCombo(ev.combo, ev.remaining); this.tutorialAdvance('goal'); this.updateHud(); break;
        case 'protectFail': this.sfx.protectFail(); r.effects.addShake(6); break;
        case 'success': this.sfx.success(); r.effects.addShake(5); break;
        case 'fail': this.sfx.fail(); break;
        case 'state': this.updateHud(); break;
        default: break;
      }
    }
  }

  private showCombo(combo: number, remaining: number) {
    const wrap = $('#stage-wrap'); wrap.querySelectorAll('.combo').forEach((n) => n.remove());
    const c = el('div', 'combo', combo >= 2 ? `${combo}연쇄!` : (remaining > 0 ? '철거!' : '완료!'));
    wrap.appendChild(c);
    if (this.comboTimer) clearTimeout(this.comboTimer);
    this.comboTimer = window.setTimeout(() => c.remove(), 900);
  }

  private updateHud() {
    const s = this.session; if (!s) return;
    const lv = s.level;
    const pills = $('#pill-shots'); if (pills) pills.innerHTML = `발사 ` + Array.from({ length: lv.shots }, (_, i) => `<span class="ball${i < s.shotsUsed ? ' used' : ''}"></span>`).join('');
    const pg = $('#pill-goals'); if (pg) pg.textContent = `목표 ${s.goalsDone}/${s.goals.length}`;
    const area = $('#hint-area');
    if (area && this.hintStage === 0) {
      area.textContent = s.state === 'aiming' ? (s.shotsUsed === 0 ? '발사대를 누른 채 뒤로 당겼다 놓으세요' : `남은 발사 ${s.shotsLeft}발 · 이전 결과는 그대로 유지됩니다`) : s.state === 'flying' ? '관찰 중… 움직임이 멈추면 다음 발사가 가능해요' : '';
    }
  }

  private showResult() {
    const s = this.session!, lv = s.level;
    this.resultShown = true;
    this.cancelAim();
    const wrap = $('#stage-wrap');
    const ov = el('div', 'overlay');
    if (s.state === 'success') {
      if (!this.resultRecorded) {
        this.resultRecorded = true;
        const changed = recordSuccess(this.save, lv.key, lv.id, s.stars, s.shotsUsed, s.maxCombo, LEVELS.length);
        if (changed) this.persist();
      }
      const best = this.save.best[lv.key];
      const hasNext = lv.id < LEVELS.length;
      ov.innerHTML = `<div class="card"><h2>철거 완료!</h2><div class="big">${'★'.repeat(s.stars)}<span style="opacity:.25">${'★'.repeat(3 - s.stars)}</span></div>
        <div class="stats"><span>사용 <b>${s.shotsUsed}발</b></span><span>최대 연쇄 <b>${s.maxCombo}</b></span><span>최고 기록 <b>★${best?.stars ?? s.stars} · ${best?.shots ?? s.shotsUsed}발</b></span></div>
        ${s.stars < 3 ? `<p class="note">${lv.stars.three}발 이내로 해결하면 ★3</p>` : ''}
        ${!this.saveOk ? '<p class="note" style="color:var(--danger)">기록 저장에 실패했습니다.</p>' : ''}
        <div class="stack">${hasNext ? '<button class="btn primary" id="r-next">다음 스테이지 ▶</button>' : '<button class="btn primary" id="r-levels">모든 스테이지 완료! 목록으로</button>'}<button class="btn" id="r-retry">다시 도전</button>${hasNext ? '<button class="btn ghost" id="r-levels">스테이지 목록</button>' : ''}</div></div>`;
      wrap.appendChild(ov);
      const nx = ov.querySelector('#r-next') as HTMLElement | null; if (nx) nx.onclick = () => { this.sfx.ui(); this.startLevel(lv.id + 1); };
      $('#r-retry', ov).onclick = () => { this.sfx.ui(); this.restart(); };
      $('#r-levels', ov).onclick = () => { this.sfx.ui(); this.showLevels(); };
      for (let i = 0; i < s.stars; i++) setTimeout(() => this.sfx.star(), 300 + i * 220);
    } else {
      const ft = FAIL_TEXT[s.failReason ?? 'goalsRemaining'];
      ov.innerHTML = `<div class="card"><h2>재도전!</h2><div class="reason">${ft.title}</div><p class="note">${ft.detail}</p>
        <div class="stats"><span>목표 <b>${s.goalsDone}/${s.goals.length}</b></span><span>사용 <b>${s.shotsUsed}/${lv.shots}발</b></span></div>
        <div class="stack"><button class="btn primary" id="r-retry">다시 시작 ↺</button><button class="btn ghost" id="r-hint">힌트 보고 다시 시작</button><button class="btn ghost" id="r-levels">스테이지 목록</button></div></div>`;
      wrap.appendChild(ov);
      $('#r-retry', ov).onclick = () => { this.sfx.ui(); this.restart(); };
      $('#r-hint', ov).onclick = () => { this.sfx.ui(); this.restart(); this.nextHint(); };
      $('#r-levels', ov).onclick = () => { this.sfx.ui(); this.showLevels(); };
    }
  }

  // ---------- 일시정지 ----------
  openPause() {
    if (this.paused || !this.session) return;
    this.cancelAim();
    this.paused = true; this.pauseReason = 'menu';
    const wrap = $('#stage-wrap');
    const ov = el('div', 'overlay'); ov.id = 'pause';
    ov.innerHTML = `<div class="card"><h2>일시정지</h2><p class="note">물리·판정·연출이 모두 멈춰 있습니다.</p>
      <div class="stack"><button class="btn primary" id="p-resume">계속하기 ▶</button><button class="btn" id="p-restart">다시 시작 ↺</button><button class="btn" id="p-help">도움말 다시 보기</button><button class="btn" id="p-settings">설정</button><button class="btn ghost" id="p-levels">스테이지 목록</button>
      ${this.dev ? `<button class="btn ghost" id="p-debug">개발: 충돌 모양·연결점 ${this.view.debug ? '끄기' : '보기'}</button><button class="btn ghost" id="p-replay">개발: 검증 입력 재생</button>` : ''}</div></div>`;
    wrap.appendChild(ov);
    $('#p-resume', ov).onclick = () => { this.sfx.ui(); this.resume(); };
    $('#p-restart', ov).onclick = () => { this.sfx.ui(); this.restart(); };
    $('#p-help', ov).onclick = () => { this.sfx.ui(); this.resume(); this.replayHelp(); };
    $('#p-settings', ov).onclick = () => { this.sfx.ui(); this.openSettings(ov); };
    $('#p-levels', ov).onclick = () => { this.sfx.ui(); this.showLevels(); };
    const dbg = ov.querySelector('#p-debug') as HTMLElement | null; if (dbg) dbg.onclick = () => { this.view.debug = !this.view.debug; this.resume(); };
    const rp = ov.querySelector('#p-replay') as HTMLElement | null; if (rp) rp.onclick = () => { this.restart(); this.replaySolution(); };
  }
  resume() {
    $('#stage-wrap')?.querySelectorAll('#pause, #bg-pause').forEach((n) => n.remove());
    this.paused = false; this.pauseReason = null; this.acc = 0; this.lastT = performance.now();
  }
  private onBackground() {
    if (this.screen !== 'game' || !this.session || this.paused) return;
    this.cancelAim();
    this.paused = true; this.pauseReason = 'background';
    const wrap = $('#stage-wrap'); if (!wrap) return;
    const ov = el('div', 'overlay'); ov.id = 'bg-pause';
    ov.innerHTML = `<div class="card"><h2>잠시 멈춤</h2><p class="note">화면을 벗어나 자동으로 일시정지했습니다. 누적된 시간은 계산하지 않습니다.</p><div class="stack"><button class="btn primary" id="bg-resume">계속하기 ▶</button></div></div>`;
    wrap.appendChild(ov);
    $('#bg-resume', ov).onclick = () => { this.sfx.ui(); this.resume(); };
  }

  toast(msg: string) {
    const wrap = $('#stage-wrap'); if (!wrap) return;
    wrap.querySelectorAll('.toast').forEach((n) => n.remove());
    const t = el('div', 'toast', msg); wrap.appendChild(t);
    setTimeout(() => t.remove(), 1400);
  }

  private drawDebugText() {
    const wrap = $('#stage-wrap'); if (!wrap || !this.session) return;
    let d = wrap.querySelector('.debug') as HTMLElement | null;
    if (!d) { d = el('div', 'debug'); wrap.appendChild(d); }
    const s = this.session;
    const c = s.world.counts();
    d.textContent = `fps ${this.fps.toFixed(0)} step ${s.step_} state ${s.state} settle ${s.settleCounter} obs ${s.observeCounter}\nbodies ${c.bodies} constraints ${c.constraints} goals ${s.goals.map((g) => `${g.body}:${g.achieved ? 'OK' : g.holdCounter}`).join(' ')}\nprotect ${s.protects.map((p) => `${p.body}:${p.failed ? 'FAIL' : 'ok'}`).join(' ') || '-'} shots ${s.shots.map((x) => `${x.shot.angleDeg}°/${x.shot.power}`).join(' ')}`;
  }
}
