// 앱 코어: 화면 전환, 게임 루프, 저장·복원, 일시정지, 대화상자.
import { h, svgEl, clear } from './dom';
import { Sfx } from '../platform/audio';
import { readSaveText, writeSaveText, clearSave, backupCorrupt } from '../platform/storage';
import { serializeState, parseSave } from '../sim/save';
import { newMeta, settleRun } from '../sim/meta';
import { createRun, tick, drainEvents } from '../sim/run';
import { computeResult, type DayResult } from '../sim/result';
import { TIME, SAVE } from '../data/balance';
import { DAYS, dayDef } from '../data/days';
import type { GameState, Screen, RunEvent } from '../sim/types';
import { COIN_ICON, STAR_ICON } from '../render/icons';
import { helpContent } from './help';
import { RunView } from './run';
import { PrepView } from './prep';

export interface DialogAction { label: string; primary?: boolean; danger?: boolean; onClick?: () => void | boolean }

export class App {
  state: GameState = { meta: newMeta(), run: null, screen: 'title' };
  sfx = new Sfx();
  saveStatus = '아직 저장 안 됨';
  saveOk = true;
  paused = false;
  pauseReason: 'menu' | 'background' | 'resume' | 'help' | null = null;
  fastClosing = false;
  /** 디버그·테스트용 시간 배속 (기본 1). 게임 규칙에는 영향 없음 */
  timeScale = 1;
  private lastFrame = 0;
  private acc = 0;
  private autosaveAcc = 0;
  private screenEl: HTMLElement | null = null;
  runView: RunView | null = null;
  prepView: PrepView | null = null;
  private overlays: HTMLElement[] = [];
  private toastEl: HTMLElement | null = null;
  private toastTimer = 0;
  private resultShown = false;
  private wasBackgroundPaused = false;
  private hasSave = false;

  constructor(public root: HTMLElement) {
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('blur', () => { this.runView?.stopHold(); });
    window.addEventListener('resize', () => { this.runView?.resize(); this.prepView?.resize(); });
    window.addEventListener('pointerdown', () => this.sfx.unlock(), { once: true, capture: true });
    window.addEventListener('keydown', () => this.sfx.unlock(), { once: true, capture: true });
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- 부팅 ----------
  boot(): void {
    const text = readSaveText();
    if (!text) { this.state = { meta: newMeta(), run: null, screen: 'title' }; this.show('title'); return; }
    const p = parseSave(text);
    if (!p.ok) {
      backupCorrupt(text);
      this.state = { meta: newMeta(), run: null, screen: 'title' };
      this.show('title');
      this.dialog('저장 데이터를 읽을 수 없어요', `${p.error}\n\n손상된 데이터는 브라우저에 백업해 두고, 새 저장으로 시작할 수 있어요. 초기화하기 전까지는 저장하지 않아요.`, [
        { label: '초기화하고 새로 시작', primary: true, onClick: () => { clearSave(); this.state = { meta: newMeta(), run: null, screen: 'title' }; this.hasSave = false; this.persist('reset'); this.show('title'); } },
      ], false);
      return;
    }
    this.hasSave = true;
    this.state = { meta: p.blob.meta, run: p.blob.run, screen: 'title' };
    this.sfx.setVolume(this.state.meta.settings.volume, this.state.meta.settings.muted);
    // 끝난 영업이 정산되지 않았으면 결과 화면부터
    if (this.state.run && this.state.run.phase === 'ended' && !this.state.run.settled) { this.show('result'); return; }
    if (this.state.run && this.state.run.phase === 'ended') this.state.run = null;
    this.show('title');
  }

  // ---------- 저장 ----------
  persist(reason: string): boolean {
    const text = serializeState(this.state);
    const r = writeSaveText(text);
    this.saveOk = r.ok;
    this.saveStatus = r.ok ? `저장됨 (${reason}, ${new Date(r.at).toLocaleTimeString('ko-KR')})` : `저장 실패: ${r.error ?? '알 수 없음'}`;
    if (r.ok) this.hasSave = true;
    this.runView?.updateSaveStatus();
    return r.ok;
  }

  // ---------- 화면 ----------
  show(screen: Screen): void {
    this.closeAllOverlays();
    if (this.toastEl) { this.toastEl.remove(); this.toastEl = null; }
    this.runView?.destroy(); this.runView = null;
    this.prepView?.destroy(); this.prepView = null;
    this.state.screen = screen;
    if (this.screenEl) this.screenEl.remove();
    let el: HTMLElement;
    switch (screen) {
      case 'title': el = this.buildTitle(); break;
      case 'days': el = this.buildDays(); break;
      case 'prep': this.prepView = new PrepView(this); el = this.prepView.el; break;
      case 'run': this.runView = new RunView(this); el = this.runView.el; break;
      case 'result': el = this.buildResult(); break;
    }
    this.screenEl = el;
    this.root.append(el);
    if (screen === 'prep') this.prepView?.mounted();
    if (screen === 'run') this.runView?.mounted();
  }

  private buildTitle(): HTMLElement {
    const run = this.state.run;
    const activeRun = run && run.phase !== 'ended';
    const el = h('div', { id: 'title', class: 'screen' });
    el.append(
      h('div', { class: 'logo', html: LOGO_SVG }),
      h('h1', {}, '괴물 포장마차', h('br'), h('span', { style: 'color:var(--accent)' }, '합치고 팔자!')),
      h('div', { class: 'sub' }, '합성 퍼즐 + 주문 처리 + 작은 가게 운영 · 웹 베타'),
    );
    const menu = h('div', { class: 'menu' });
    if (activeRun) menu.append(h('button', { class: 'btn primary', onClick: () => this.resumeRun() }, `영업 이어하기 (${dayDef(run!.dayId).name})`));
    if (this.hasSave) menu.append(h('button', { class: `btn ${activeRun ? '' : 'primary'}`, onClick: () => { this.sfx.play('click'); this.show('days'); } }, '계속하기 (영업일 선택)'));
    menu.append(h('button', { class: `btn ${this.hasSave ? '' : 'primary'}`, onClick: () => this.newGame() }, this.hasSave ? '처음부터 새로 시작' : '새로 시작'));
    menu.append(h('div', { class: 'row' },
      h('button', { class: 'btn grow', onClick: () => this.openHelp() }, '도움말'),
      h('button', { class: 'btn grow', onClick: () => this.openSettings() }, '설정'),
    ));
    el.append(menu);
    el.append(h('div', { class: 'foot' }, `서버·로그인·결제 없음 · 이 기기의 브라우저에만 저장 · ${this.hasSave ? '저장 데이터 있음' : '저장 데이터 없음'}`));
    return el;
  }

  private newGame(): void {
    this.sfx.play('click');
    const start = () => {
      clearSave();
      this.state = { meta: newMeta(), run: null, screen: 'title' };
      this.sfx.setVolume(this.state.meta.settings.volume, this.state.meta.settings.muted);
      this.hasSave = false;
      this.persist('새 게임');
      this.offerTutorial();
    };
    if (this.hasSave) this.confirm('처음부터 시작할까요?', '지금까지의 코인·가게·기록이 모두 지워져요. 되돌릴 수 없어요.', start, '지우고 새로 시작', true);
    else start();
  }

  private offerTutorial(): void {
    this.dialog('연습 영업으로 배워볼까요?', '손님 한 명의 주문을 실제로 처리해 보는 짧은 연습이에요. 연습 수입은 저장되지 않아요. 건너뛰어도 도움말에서 언제든 다시 볼 수 있어요.', [
      { label: '연습 시작', primary: true, onClick: () => this.startPractice() },
      { label: '건너뛰고 바로 영업 준비', onClick: () => { this.state.meta.tutorialDone = true; this.persist('튜토리얼 건너뜀'); this.goPrep(1); } },
    ], false);
  }

  private buildDays(): HTMLElement {
    const m = this.state.meta;
    const el = h('div', { id: 'days', class: 'screen' });
    el.append(h('div', { class: 'topbar' }, h('button', { class: 'btn small', onClick: () => this.show('title') }, '← 제목'), h('h2', {}, '영업일 선택'), h('span', { class: 'coin' }, svgEl(COIN_ICON), String(m.coins))));
    const sc = h('div', { class: 'scroll' });
    sc.append(h('p', { class: 'small muted', style: 'margin:0 0 10px' }, '목표 서빙 인원을 채우면 다음 영업일이 열려요. 열린 영업일은 자유롭게 다시 도전할 수 있고, 매번 다른 시드로 주문이 달라져요.'));
    for (const d of DAYS) {
      const locked = d.id > m.unlockedDay;
      const best = m.best[String(d.id)];
      const card = h('button', { class: `daycard ${locked ? 'locked' : ''}`, disabled: locked, onClick: () => { this.sfx.play('click'); this.goPrep(d.id); } },
        h('div', { class: 'num' }, locked ? '🔒' : String(d.id)),
        h('div', { class: 'grow' },
          h('div', { class: 'name' }, d.name, ' ', h('span', { class: 'muted small' }, d.subtitle)),
          h('div', { class: 'desc' }, locked ? `${d.id - 1}일차에서 ${dayDef(d.id - 1).targetServed}명 이상 서빙하면 열려요.` : d.desc),
          h('div', { class: 'row', style: 'margin-top:6px' }, starsEl(best?.stars ?? 0), h('span', { class: 'small muted' }, best ? `최고 수입 ${best.income} · 최다 서빙 ${best.served}명` : '기록 없음')),
        ));
      sc.append(card);
    }
    sc.append(h('button', { class: 'btn block', style: 'margin-top:6px', onClick: () => this.startPractice() }, '연습 영업 다시 하기'));
    el.append(sc);
    return el;
  }

  goPrep(dayId: number): void {
    this.state.meta.lastDay = dayId;
    this.state.run = null;
    this.show('prep');
  }

  // ---------- 영업 ----------
  startDay(dayId: number, practice = false): void {
    const seed = Math.floor(Math.random() * 1_000_000_000);
    this.state.run = createRun({ dayId, seed, meta: this.state.meta, practice });
    this.paused = false; this.pauseReason = null; this.fastClosing = false; this.acc = 0; this.autosaveAcc = 0; this.resultShown = false;
    this.persist('영업 시작');
    this.show('run');
  }

  startPractice(): void { this.closeAllOverlays(); this.startDay(0, true); }

  resumeRun(): void {
    const run = this.state.run;
    if (!run || run.phase === 'ended') { this.show('days'); return; }
    this.paused = true; this.pauseReason = 'resume'; this.fastClosing = false; this.acc = 0; this.resultShown = false;
    this.show('run');
    this.dialog('이어하기', `가장 최근 저장 지점(영업 ${Math.floor(run.t)}초)부터 이어서 시작해요. 앱을 닫아둔 시간은 영업에 적용되지 않았어요.`, [
      { label: '계속하기', primary: true, onClick: () => this.setPaused(false) },
    ], false);
  }

  setPaused(p: boolean, reason: App['pauseReason'] = 'menu'): void {
    this.paused = p; this.pauseReason = p ? reason : null;
    if (p) { this.runView?.stopHold(); this.sfx.suspend(); } else { this.sfx.resume(); this.lastFrame = 0; }
    this.runView?.onPauseChange();
  }

  private onVisibility(): void {
    if (document.hidden) {
      this.runView?.stopHold();
      if (this.state.screen === 'run' && this.state.run && this.state.run.phase !== 'ended' && !this.paused) {
        this.setPaused(true, 'background');
        this.wasBackgroundPaused = true;
        this.persist('백그라운드');
      }
    } else if (this.wasBackgroundPaused) {
      this.wasBackgroundPaused = false;
      if (this.state.screen === 'run' && this.paused && this.pauseReason === 'background') {
        this.dialog('돌아오셨어요!', '화면을 벗어나 있는 동안 영업을 멈춰 두었어요. 계속할까요?', [{ label: '계속하기', primary: true, onClick: () => this.setPaused(false) }], false);
      }
    }
  }

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const dtReal = this.lastFrame ? Math.min(TIME.maxFrameDelta, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    const run = this.state.run;
    if (this.state.screen === 'run' && run && this.runView) {
      let events: RunEvent[] = [];
      if (!this.paused && run.phase !== 'ended') {
        const speed = (run.phase === 'closing' && this.fastClosing ? TIME.closingFastSpeed : 1) * this.timeScale;
        this.acc += dtReal * speed;
        let steps = 0;
        const maxSteps = 40 * Math.max(1, this.timeScale);
        while (this.acc >= TIME.step && steps < maxSteps) { tick(run, TIME.step); this.acc -= TIME.step; steps++; }
        if (steps >= maxSteps) this.acc = 0;
        events = drainEvents(run);
        this.autosaveAcc += dtReal;
        if (this.autosaveAcc >= SAVE.autosaveIntervalSec) { this.autosaveAcc = 0; this.persist('자동'); }
      }
      this.runView.update(dtReal, events);
      if (run.phase === 'ended' && !this.resultShown) {
        this.resultShown = true;
        this.persist('영업 종료');
        setTimeout(() => { if (this.state.run === run) this.show('result'); }, 700);
      }
    } else if (this.state.screen === 'prep' && this.prepView) {
      this.prepView.update(dtReal);
    }
  }

  // ---------- 결과 ----------
  private buildResult(): HTMLElement {
    const run = this.state.run!;
    const res: DayResult = computeResult(run);
    const day = dayDef(run.dayId);
    const settled = settleRun(this.state.meta, run, res);
    this.persist('정산');
    if (res.stars > 0 && settled.applied) setTimeout(() => this.sfx.play('star'), 300);
    const el = h('div', { id: 'result', class: 'screen' });
    el.append(h('div', { class: 'topbar' }, h('h2', {}, run.practice ? '연습 결과' : `${day.name} 결과`), h('span', { class: 'coin' }, svgEl(COIN_ICON), String(this.state.meta.coins))));
    const sc = h('div', { class: 'scroll' });
    const stars = h('div', { class: 'stars center', style: 'justify-content:center;display:flex;margin:4px 0 8px' });
    for (let i = 1; i <= 3; i++) stars.append(svgEl(STAR_ICON(i <= res.stars)));
    if (!run.practice) sc.append(stars);
    sc.append(h('div', { class: 'card center' },
      h('div', { class: 'muted small' }, run.practice ? '연습 수입 (저장되지 않음)' : run.aborted ? '중도 마감 · 실제 영업 수입' : '총 영업 수입'),
      h('div', { class: 'big' }, `${res.income} 코인`),
      h('div', { class: 'small muted' }, `판매 ${res.sales} + 팁 ${res.tips}${settled.applied && !run.practice ? ' · 지갑에 입금됨' : settled.applied ? '' : ' · 이미 정산된 결과'}`),
    ));
    const tbl = h('table');
    const row = (k: string, v: string) => tbl.append(h('tr', {}, h('td', {}, k), h('td', {}, v)));
    row('서빙 완료', `${res.served}명 / 목표 ${res.targetServed}명 ${res.star1 ? '✅' : '❌'}`);
    row('도착한 손님', `${res.arrived}명`);
    row('대기줄 이탈', `${res.leftQueue}명`);
    row('주문 대기 중 이탈', `${res.leftOrder}명`);
    if (res.turnedAway) row('만석으로 못 들어옴', `${res.turnedAway}명`);
    if (res.closedUnserved) row('마감 처리(미접수)', `${res.closedUnserved}명`);
    row('가장 많이 판 메뉴', res.topFood ? `${res.topFood.name} ${res.topFood.count}개` : '없음');
    row('평균 서빙 대기', `${res.avgServiceWait}초 (접수→전달)`);
    row('여유 있게 접수(팁 100%)', `${res.happyServed}명`);
    sc.append(h('div', { class: 'card' }, h('h3', {}, '집계'), tbl));
    if (!run.practice) {
      const best = this.state.meta.best[String(run.dayId)];
      sc.append(h('div', { class: 'card' }, h('h3', {}, '별 기준'),
        h('div', { class: 'small' }, `${res.star1 ? '⭐' : '☆'} 서빙 ${res.targetServed}명 이상 — ${res.served}명`),
        h('div', { class: 'small' }, `${res.star1 && res.star2 ? '⭐' : '☆'} ${res.star2Label} — ${day.star2.kind === 'maxLeft' ? `떠난 손님 ${res.leftQueue + res.leftOrder}명` : `여유 서빙 ${res.happyServed}명`}${!res.star1 && res.star2 ? ' (1별 필요)' : ''}`),
        h('div', { class: 'small' }, `${res.star1 && res.star3 ? '⭐' : '☆'} 수입 ${res.incomeGoal} 이상 — ${res.income}${!res.star1 && res.star3 ? ' (1별 필요)' : ''}`),
        h('div', { class: 'small muted', style: 'margin-top:6px' }, best ? `이 영업일 최고 기록: 별 ${best.stars} · 수입 ${best.income} · 서빙 ${best.served}명` : ''),
        h('div', { class: 'small', style: 'margin-top:6px;color:var(--accent)' }, res.unlocksNext ? (this.state.meta.unlockedDay >= run.dayId + 1 ? `${run.dayId + 1}일차 ${dayDef(run.dayId + 1).name} 열림!` : '') : run.dayId < 5 ? `다음 영업일은 ${res.targetServed}명 이상 서빙하면 열려요.` : '마지막 영업일이에요.'),
      ));
    }
    const ul = h('ul');
    for (const a of res.advice) ul.append(h('li', {}, a));
    sc.append(h('div', { class: 'card' }, h('h3', {}, '기록에서 본 것'), ul));
    sc.append(h('p', { class: 'small muted' }, '남은 음식은 이월되지 않아요. 다음 영업은 새 보드와 시작 음식 6개로 시작해요.'));
    const actions = h('div', { class: 'dialog-actions', style: 'display:flex;flex-direction:column;gap:8px;padding:0 0 12px' });
    if (run.practice) {
      actions.append(h('button', { class: 'btn primary block', onClick: () => { this.state.meta.tutorialDone = true; this.state.run = null; this.persist('연습 완료'); this.goPrep(1); } }, '가게 배치 보러 가기 (1일차 준비)'));
    } else {
      if (res.unlocksNext && run.dayId < 5) actions.append(h('button', { class: 'btn primary block', onClick: () => { this.sfx.play('click'); this.goPrep(run.dayId + 1); } }, `다음 영업일 준비 (${dayDef(run.dayId + 1).name})`));
      actions.append(h('button', { class: `btn block ${res.unlocksNext ? '' : 'primary'}`, onClick: () => { this.sfx.play('click'); this.goPrep(run.dayId); } }, '가게 손보고 다시 도전'));
      actions.append(h('button', { class: 'btn block', onClick: () => { this.sfx.play('click'); this.state.run = null; this.persist('결과 닫기'); this.show('days'); } }, '영업일 선택으로'));
    }
    sc.append(actions);
    el.append(sc);
    return el;
  }

  // ---------- 오버레이 ----------
  dialog(title: string, body: string | HTMLElement, actions: DialogAction[], closable = true): HTMLElement {
    const ov = h('div', { class: 'overlay' });
    const dlg = h('div', { class: 'dialog' });
    if (closable) dlg.append(h('button', { class: 'close', 'aria-label': '닫기', onClick: () => this.closeOverlay(ov) }, '✕'));
    dlg.append(h('h3', {}, title));
    if (typeof body === 'string') for (const para of body.split('\n\n')) dlg.append(h('p', {}, para)); else dlg.append(body);
    const act = h('div', { class: 'actions' });
    for (const a of actions) act.append(h('button', { class: `btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}`, onClick: () => { const keep = a.onClick?.(); if (keep !== true) this.closeOverlay(ov); } }, a.label));
    if (actions.length) dlg.append(act);
    ov.append(dlg);
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov && closable) this.closeOverlay(ov); });
    this.root.append(ov);
    this.overlays.push(ov);
    return ov;
  }

  confirm(title: string, body: string, onYes: () => void, yesLabel = '확인', danger = false): void {
    this.dialog(title, body, [{ label: yesLabel, primary: !danger, danger, onClick: onYes }, { label: '취소' }]);
  }

  closeOverlay(ov: HTMLElement): void {
    ov.remove();
    this.overlays = this.overlays.filter((o) => o !== ov);
    if (this.state.screen === 'run' && this.overlays.length === 0 && this.paused && this.pauseReason === 'help') this.setPaused(false);
  }

  closeAllOverlays(): void { for (const o of this.overlays) o.remove(); this.overlays = []; }

  toast(msg: string, err = false): void {
    if (this.toastEl) this.toastEl.remove();
    this.toastEl = h('div', { class: `toast ${err ? 'err' : ''}` }, msg);
    this.root.append(this.toastEl);
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toastEl?.remove(); this.toastEl = null; }, 1800);
    if (err) this.sfx.play('error');
  }

  openHelp(): void {
    if (this.state.screen === 'run' && !this.paused) this.setPaused(true, 'help');
    this.dialog('도움말', helpContent(), [{ label: '닫기' }]);
  }

  openSettings(): void {
    if (this.state.screen === 'run' && !this.paused) this.setPaused(true, 'help');
    const s = this.state.meta.settings;
    const body = h('div');
    const vol = h('input', { type: 'range', min: 0, max: 100, value: Math.round(s.volume * 100) }) as HTMLInputElement;
    const muteBtn = h('button', { class: 'btn block' }, s.muted ? '🔇 음소거 해제' : '🔊 음소거');
    vol.addEventListener('input', () => { s.volume = Number(vol.value) / 100; this.sfx.setVolume(s.volume, s.muted); });
    vol.addEventListener('change', () => { this.sfx.play('click'); this.persist('설정'); });
    muteBtn.addEventListener('click', () => { s.muted = !s.muted; this.sfx.setVolume(s.volume, s.muted); muteBtn.textContent = s.muted ? '🔇 음소거 해제' : '🔊 음소거'; this.persist('설정'); });
    body.append(h('p', {}, '효과음 음량'), vol, h('div', { style: 'height:8px' }), muteBtn, h('div', { style: 'height:12px' }),
      h('p', { class: 'small muted' }, `저장 상태: ${this.saveStatus}`),
      h('button', { class: 'btn block danger', onClick: () => this.confirm('저장을 초기화할까요?', '코인·가게·기록·진행 중인 영업이 모두 지워지고 제목 화면으로 돌아가요. 되돌릴 수 없어요.', () => { clearSave(); this.closeAllOverlays(); this.state = { meta: newMeta(), run: null, screen: 'title' }; this.hasSave = false; this.paused = false; this.pauseReason = null; this.persist('초기화'); this.show('title'); }, '모두 지우기', true) }, '저장 초기화'));
    this.dialog('설정', body, [{ label: '닫기' }]);
  }
}

export function starsEl(n: number): HTMLElement {
  const el = h('span', { class: 'stars' });
  for (let i = 1; i <= 3; i++) el.append(svgEl(STAR_ICON(i <= n)));
  return el;
}

const LOGO_SVG = `<svg viewBox="0 0 300 150" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff8a5c"/><stop offset="1" stop-color="#c94f3d"/></linearGradient></defs>
<path d="M20 70 L150 20 L280 70 Z" fill="url(#lg)"/><path d="M20 70 h260 v10 h-260z" fill="#ffd66b"/>
<g>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${30 + i * 34}" cy="80" r="9" fill="#c94f3d"/>`).join('')}</g>
<rect x="40" y="82" width="220" height="50" rx="8" fill="#5a3f2e"/><rect x="50" y="90" width="200" height="34" rx="6" fill="#3a2418"/>
<rect x="60" y="96" width="60" height="22" rx="4" fill="#f1c34f"/>
<ellipse cx="200" cy="112" rx="26" ry="10" fill="#a86f45" stroke="#3a2418" stroke-width="2"/>
<g transform="translate(150 55)"><path d="M-18 20 q-4 -30 18 -30 q22 0 18 30 q-18 8 -36 0z" fill="#7ed957" stroke="#4ea832" stroke-width="2"/><circle cx="-6" cy="4" r="3" fill="#1c1430"/><circle cx="7" cy="4" r="3" fill="#1c1430"/><path d="M-6 12 q6 5 12 0" fill="none" stroke="#1c1430" stroke-width="2"/></g>
<g transform="translate(95 60)"><path d="M-10 -8 l-4 -10 8 6z M10 -8 l4 -10 -8 6z" fill="#f3d27a" stroke="#a83a3a"/><circle r="14" fill="#e05a5a" stroke="#a83a3a" stroke-width="2"/><circle cx="-5" cy="-2" r="2.5" fill="#1c1430"/><circle cx="5" cy="-2" r="2.5" fill="#1c1430"/><path d="M-5 5 q5 4 10 0" fill="none" stroke="#1c1430" stroke-width="2"/></g>
<g transform="translate(210 58)"><path d="M-12 0 a12 12 0 0 1 24 0 v16 l-4 -3 -4 3 -4 -3 -4 3 -4 -3 -4 3z" fill="#dfe6ff" stroke="#9aa6d8" stroke-width="2"/><circle cx="-4" cy="0" r="2" fill="#1c1430"/><circle cx="4" cy="0" r="2" fill="#1c1430"/></g>
<circle cx="60" cy="35" r="3" fill="#ffe27a"/><circle cx="250" cy="28" r="2" fill="#ffe27a"/><circle cx="20" cy="20" r="2" fill="#fff"/></svg>`;
