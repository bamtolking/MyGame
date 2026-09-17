// 영업 화면: HUD, 가게 캔버스, 주문 카드, 5×5 합성 보드, 생산 버튼, 일시정지 메뉴, 연습 안내.
import type { App } from './app';
import { h, svgEl, clear, fmtTime } from './dom';
import { TIME, BOARD } from '../data/balance';
import { FAMILIES, FAMILY_DEFS, foodDef, type Family } from '../data/foods';
import { CUSTOMER_DEFS } from '../data/customers';
import { dayDef } from '../data/days';
import { StoreRenderer } from '../render/store';
import { foodIcon, customerFace, COIN_ICON } from '../render/icons';
import { actSpawn, actMerge, actMove, actDiscard, actAccept, actAbort, orderReady, ordersWaitingFor, timeLeft, closeRun } from '../sim/run';
import { countByKey, mergeCandidates, findFood, countEmpty } from '../sim/board';
import type { RunState, RunEvent, Customer } from '../sim/types';

export class RunView {
  el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: StoreRenderer;
  private timeEl: HTMLElement; private barFill: HTMLElement; private coinEl: HTMLElement; private servedEl: HTMLElement; private fastBtn: HTMLButtonElement;
  private ordersEl: HTMLElement;
  private boardEl: HTMLElement;
  private cells: HTMLButtonElement[] = [];
  private infoEl: HTMLElement;
  private prodBtns = new Map<Family, HTMLButtonElement>();
  private tutEl: HTMLElement | null = null;
  private tutStep = -1;
  private selectedFood: number | null = null;
  private selectedOrder: number | null = null;
  private boardKey = '';
  private orderKey = '';
  private time = 0;
  private holdFam: Family | null = null;
  private holdTimer = 0;
  private holdInterval = 0;
  private practiceCloseTimer = 0;
  private saveEl: HTMLElement;
  private pauseOverlay: HTMLElement | null = null;

  get run(): RunState { return this.app.state.run!; }

  constructor(private app: App) {
    const run = this.run;
    const day = dayDef(run.dayId);
    this.el = h('div', { id: 'run', class: 'screen' });
    // HUD
    this.timeEl = h('span', { class: 'time' }, '3:00');
    this.barFill = h('i');
    this.coinEl = h('span', { class: 'coin' }, svgEl(COIN_ICON), '0');
    this.servedEl = h('span', { class: 'served' }, '');
    this.fastBtn = h('button', { class: 'btn small', style: 'display:none', onClick: () => { this.app.fastClosing = !this.app.fastClosing; this.fastBtn.textContent = this.app.fastClosing ? '보통 속도' : '빠르게 보기 ▶▶'; } }, '빠르게 보기 ▶▶') as HTMLButtonElement;
    const bar = h('div', { class: 'bar' }, this.barFill, h('b', { style: `left:${(TIME.lastArrival / TIME.dayLength) * 100}%` }));
    this.el.append(h('div', { class: 'hud' }, this.timeEl, bar, this.coinEl, this.servedEl, this.fastBtn, h('button', { class: 'pause', 'aria-label': '일시정지', onClick: () => this.openPause() }, '⏸')));
    // 가게
    this.canvas = h('canvas');
    this.renderer = new StoreRenderer(this.canvas);
    this.el.append(h('div', { class: 'storewrap' }, this.canvas));
    // 연습 안내
    if (run.practice) { this.tutEl = h('div', { class: 'tutbanner' }); this.el.append(this.tutEl); }
    // 주문 카드
    this.ordersEl = h('div', { class: 'orders' });
    this.el.append(this.ordersEl);
    // 보드
    this.boardEl = h('div', { class: 'board', role: 'grid' });
    for (let i = 0; i < BOARD.cols * BOARD.rows; i++) {
      const b = h('button', { class: 'cell', 'data-i': i, 'aria-label': `보드 ${i + 1}번 칸`, onClick: () => this.onCell(i) }) as HTMLButtonElement;
      this.cells.push(b); this.boardEl.append(b);
    }
    this.el.append(h('div', { class: 'boardwrap' }, this.boardEl));
    // 정보줄
    this.infoEl = h('div', { class: 'infobar' });
    this.el.append(this.infoEl);
    // 생산 버튼
    const prod = h('div', { class: 'prod' });
    for (const fam of FAMILIES) {
      const def = foodDef(fam, 1);
      const b = h('button', { class: `prodbtn ${fam}` }, svgEl(foodIcon(fam, 1)), h('span', { class: 'l' }, FAMILY_DEFS[fam].name, h('small', {}, `${def.name} 만들기`))) as HTMLButtonElement;
      b.addEventListener('pointerdown', (e) => this.onProdDown(e, fam, b));
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) b.addEventListener(ev, () => this.stopHold());
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      this.prodBtns.set(fam, b); prod.append(b);
    }
    this.el.append(prod);
    this.saveEl = h('span');
    void day;
  }

  private ro: ResizeObserver | null = null;
  mounted(): void {
    this.resize(); this.renderBoard(true); this.renderOrders(true); this.renderInfo();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.boardEl.parentElement!); }
  }
  destroy(): void { this.stopHold(); clearTimeout(this.practiceCloseTimer); this.ro?.disconnect(); }
  resize(): void {
    this.renderer.resize();
    // 보드: 남은 공간에 맞는 정사각형 (한 칸 최소 52px 목표, 최대 440px)
    const wrap = this.boardEl.parentElement!;
    const size = Math.max(200, Math.min(wrap.clientWidth - 20, wrap.clientHeight - 8, 440));
    this.boardEl.style.width = `${size}px`; this.boardEl.style.height = `${size}px`;
  }
  updateSaveStatus(): void { this.saveEl.textContent = this.app.saveStatus; }
  onPauseChange(): void { if (this.app.paused) this.stopHold(); }

  // ---------- 프레임 ----------
  update(dt: number, events: RunEvent[]): void {
    const run = this.run;
    if (!this.app.paused) this.time += dt * (run.phase === 'closing' && this.app.fastClosing ? 2 : 1);
    for (const ev of events) this.onEvent(ev);
    // HUD
    const left = timeLeft(run);
    this.timeEl.textContent = run.phase === 'open' ? fmtTime(left) : run.phase === 'closing' ? '마감' : '종료';
    this.timeEl.style.color = run.phase === 'open' && left <= 30 ? 'var(--bad)' : '';
    this.barFill.style.width = `${Math.min(100, (run.t / TIME.dayLength) * 100)}%`;
    this.coinEl.lastChild!.textContent = String(run.ledger.sales + run.ledger.tips);
    const day = dayDef(run.dayId);
    this.servedEl.textContent = `서빙 ${run.stats.served}/${day.targetServed}`;
    this.fastBtn.style.display = run.phase === 'closing' ? '' : 'none';
    // 주문 카드·보드 (외부 변경 감지)
    this.renderOrders(false);
    this.renderBoard(false);
    // 캔버스
    this.renderer.draw(run, run.furniture, { time: this.time, weather: day.weather, level: this.app.state.meta.unlockedDay, staffSpeedLevel: run.staffSpeedLevel }, this.app.paused ? 0 : dt);
    // 생산 버튼 상태
    const full = countEmpty(run.board) === 0 || run.phase !== 'open';
    for (const b of this.prodBtns.values()) b.classList.toggle('disabled', full);
    if (run.practice) this.updateTutorial();
  }

  private onEvent(ev: RunEvent): void {
    const run = this.run;
    switch (ev.kind) {
      case 'seated': this.app.sfx.play('order'); this.renderOrders(true); break;
      case 'queue': break;
      case 'delivered': {
        const c = run.customers.find((x) => x.id === ev.customerId);
        if (c && c.sale) {
          this.app.sfx.play('deliver'); setTimeout(() => this.app.sfx.play('coin'), 80);
          const seat = run.seats.find((s) => s.id === c.seatId);
          if (seat) this.renderer.burst(seat, '#ffd23f', 10, `+${c.sale.price + c.sale.tip}`);
          const fx = h('div', { class: 'fxcoin' }, `+${c.sale.price}${c.sale.tip ? ` (+팁 ${c.sale.tip})` : ''}`);
          const r = this.coinEl.getBoundingClientRect(); const pr = this.el.getBoundingClientRect();
          fx.style.left = `${r.left - pr.left}px`; fx.style.top = `${r.bottom - pr.top + 4}px`;
          this.el.append(fx); setTimeout(() => fx.remove(), 1000);
          this.app.persist('전달');
          if (run.practice) this.practiceCloseTimer = window.setTimeout(() => { if (run.phase === 'open') closeRun(run, false); }, 2500);
        }
        this.renderOrders(true); this.renderInfo();
        break;
      }
      case 'left': {
        if (ev.reason === 'order_timeout' || ev.reason === 'queue_timeout') {
          this.app.sfx.play('leave');
          const c = run.customers.find((x) => x.id === ev.customerId);
          if (c && ev.reason === 'order_timeout') this.app.toast(`${CUSTOMER_DEFS[c.type].name}이(가) 기다리다 떠났어요.`);
        }
        if (this.selectedOrder === ev.customerId) this.selectedOrder = null;
        this.renderOrders(true); this.renderInfo();
        break;
      }
      case 'closed': {
        this.app.sfx.play('close');
        this.stopHold();
        this.app.toast(run.aborted ? '마감했어요. 접수된 서빙만 마무리해요.' : '영업 시간 종료! 접수된 서빙만 마무리해요.');
        this.selectedFood = null; this.selectedOrder = null;
        this.renderBoard(true); this.renderOrders(true); this.renderInfo();
        break;
      }
      case 'ended': this.app.sfx.play('ended'); break;
      default: break;
    }
  }

  // ---------- 보드 ----------
  renderBoard(force: boolean): void {
    const run = this.run;
    const key = run.board.map((c) => (c ? `${c.id}` : '_')).join(',');
    const structural = force || key !== this.boardKey;
    const changed = key !== this.boardKey;
    this.boardKey = key;
    if (changed && !force) this.renderInfo();
    const cand = this.selectedFood != null ? new Set(mergeCandidates(run.board, this.selectedFood, run.maxTier)) : null;
    const neededKeys = new Set<string>();
    if (this.selectedOrder != null) { const c = run.customers.find((x) => x.id === this.selectedOrder); if (c) for (const it of c.order.items) neededKeys.add(`${it.family}:${it.tier}`); }
    for (let i = 0; i < this.cells.length; i++) {
      const b = this.cells[i]; const f = run.board[i];
      if (structural) {
        clear(b);
        if (f) {
          b.append(svgEl(foodIcon(f.family, f.tier)), h('span', { class: 'tier' }, `${f.tier}`));
          if (f.tier >= run.maxTier) b.append(h('span', { class: 'maxed' }, 'MAX'));
          b.setAttribute('aria-label', `${foodDef(f.family, f.tier).name} ${f.tier}단계`);
        } else b.setAttribute('aria-label', `빈칸 ${i + 1}`);
      }
      b.classList.toggle('sel', !!f && f.id === this.selectedFood);
      b.classList.toggle('mergeable', !!f && !!cand && cand.has(f.id));
      b.classList.toggle('target', !f && this.selectedFood != null && run.phase === 'open');
      b.classList.toggle('needed', !!f && neededKeys.has(`${f.family}:${f.tier}`));
    }
  }

  private onCell(i: number): void {
    const run = this.run;
    const f = run.board[i];
    if (run.phase !== 'open') { this.app.toast('영업이 끝났어요. 남은 서빙만 마무리합니다.'); return; }
    if (this.selectedFood == null) {
      if (f) { this.selectedFood = f.id; this.selectedOrder = null; this.app.sfx.play('select'); }
      this.renderBoard(false); this.renderInfo();
      return;
    }
    if (f && f.id === this.selectedFood) { this.selectedFood = null; this.renderBoard(false); this.renderInfo(); return; }
    if (f) {
      const r = actMerge(run, this.selectedFood, f.id);
      if (r.result.ok) {
        this.app.sfx.play(r.item!.tier >= 3 ? 'merge_high' : 'merge');
        this.selectedFood = null;
        this.renderBoard(true);
        const cell = this.cells[r.index!]; cell.classList.remove('mergefx'); void cell.offsetWidth; cell.classList.add('mergefx');
        if (r.item!.tier >= 3) this.app.toast(`${foodDef(r.item!.family, r.item!.tier).name} 완성!`);
        this.app.persist('합성');
      } else {
        this.app.toast(r.result.reason ?? '합칠 수 없어요.', true);
        this.selectedFood = f.id; // 안전하게 새 선택으로 전환 (보드 변화 없음)
        this.renderBoard(false);
      }
      this.renderOrders(true); this.renderInfo();
      return;
    }
    const r = actMove(run, this.selectedFood, i);
    if (r.ok) { this.app.sfx.play('move'); this.selectedFood = null; this.renderBoard(true); }
    else this.app.toast(r.reason ?? '옮길 수 없어요.', true);
    this.renderInfo();
  }

  private discardSelected(): void {
    const run = this.run;
    if (this.selectedFood == null) return;
    const idx = findFood(run.board, this.selectedFood);
    if (idx < 0) return;
    const f = run.board[idx]!;
    const def = foodDef(f.family, f.tier);
    const doIt = () => {
      const r = actDiscard(run, f.id);
      if (!r.result.ok) { this.app.toast(r.result.reason ?? '', true); return; }
      this.app.sfx.play('discard');
      this.selectedFood = null;
      this.renderBoard(true); this.renderOrders(true); this.renderInfo();
      this.app.persist('정리');
    };
    if (f.tier >= 2) this.app.confirm(`${def.name}(${f.tier}단계)을(를) 정리할까요?`, `이 음식 1개가 사라져요. 코인은 지급되지 않아요. 원료 ${Math.pow(2, f.tier - 1)}개 분량이에요.`, doIt, '정리하기', true);
    else doIt();
  }

  // ---------- 생산 ----------
  private spawn(fam: Family, quiet: boolean): boolean {
    const run = this.run;
    const r = actSpawn(run, fam);
    if (!r.result.ok) { if (!quiet) this.app.toast(r.result.reason ?? '', true); return false; }
    this.app.sfx.play('spawn');
    this.renderBoard(true);
    const cell = this.cells[r.index!]; cell.classList.remove('pop'); void cell.offsetWidth; cell.classList.add('pop');
    this.renderOrders(true); this.renderInfo();
    return true;
  }

  private onProdDown(e: PointerEvent, fam: Family, btn: HTMLButtonElement): void {
    e.preventDefault();
    if (this.app.paused) return;
    this.app.sfx.unlock();
    this.stopHold();
    try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!this.spawn(fam, false)) return;
    this.holdFam = fam;
    btn.classList.add('holding');
    this.holdTimer = window.setTimeout(() => {
      this.holdInterval = window.setInterval(() => {
        if (this.app.paused || this.holdFam !== fam || document.hidden || !this.spawn(fam, true)) this.stopHold();
      }, BOARD.holdIntervalMs);
    }, BOARD.holdDelayMs);
  }

  stopHold(): void {
    clearTimeout(this.holdTimer); clearInterval(this.holdInterval);
    this.holdTimer = 0; this.holdInterval = 0;
    if (this.holdFam) { this.prodBtns.get(this.holdFam)?.classList.remove('holding'); this.holdFam = null; }
    for (const b of this.prodBtns.values()) b.classList.remove('holding');
    if (this.app.state.run && this.app.state.run.stats.ops.spawn > 0) this.app.persist('생산');
  }

  // ---------- 주문 카드 ----------
  renderOrders(structural: boolean): void {
    const run = this.run;
    const active = run.customers.filter((c) => c.state === 'ordering' || c.state === 'accepted').sort((a, b) => (a.seatedAt ?? 0) - (b.seatedAt ?? 0));
    const counts = countByKey(run.board);
    const key = active.map((c) => `${c.id}:${c.state}:${orderReady(run, c) ? 1 : 0}:${this.selectedOrder === c.id ? 's' : ''}`).join('|') + `|q${run.queue.length}`;
    if (structural || key !== this.orderKey) {
      this.orderKey = key;
      clear(this.ordersEl);
      if (!active.length) this.ordersEl.append(h('div', { class: 'empty' }, run.phase === 'open' ? (run.queue.length ? `대기줄 ${run.queue.length}명 · 좌석이 비면 앉아요` : run.t < 3 ? '손님이 오고 있어요…' : '지금은 주문이 없어요. 재료를 미리 준비해 두세요.') : '남은 서빙을 마무리하는 중…'));
      for (const c of active) this.ordersEl.append(this.buildCard(c, counts));
    }
    // 매 프레임: 인내 막대
    for (const card of Array.from(this.ordersEl.children) as HTMLElement[]) {
      const id = Number(card.dataset.id); if (!id) continue;
      const c = run.customers.find((x) => x.id === id); if (!c) continue;
      const ratio = c.orderPatienceMax > 0 ? Math.max(0, c.orderPatience / c.orderPatienceMax) : 0;
      const pat = card.querySelector('.pat') as HTMLElement; const fill = pat.firstElementChild as HTMLElement; const secs = card.querySelector('.secs') as HTMLElement;
      fill.style.width = `${ratio * 100}%`;
      pat.classList.toggle('mid', ratio < 0.6 && ratio >= 0.3); pat.classList.toggle('low', ratio < 0.3);
      card.classList.toggle('urgent', c.state === 'ordering' && ratio < 0.3);
      secs.textContent = c.state === 'ordering' ? `${Math.ceil(c.orderPatience)}초` : c.state === 'accepted' ? (run.staff.carrying === c.id ? '전달 중' : `대기 ${Math.max(0, run.servingQueue.indexOf(c.id))}번째`) : '';
    }
  }

  private buildCard(c: Customer, counts: Record<string, number>): HTMLElement {
    const run = this.run;
    const ready = orderReady(run, c);
    const def = CUSTOMER_DEFS[c.type];
    const card = h('button', { class: `order ${ready ? 'ready' : ''} ${c.state === 'accepted' ? 'accepted' : ''} ${this.selectedOrder === c.id ? 'sel' : ''}`, 'data-id': c.id, onClick: () => this.onOrderTap(c.id) });
    card.append(h('div', { class: 'top' }, svgEl(customerFace(c.type), 'face'), h('span', { class: 'name' }, def.name)));
    const items = h('div', { class: 'items' });
    const grouped = new Map<string, { family: Family; tier: number; n: number }>();
    for (const it of c.order.items) { const k = `${it.family}:${it.tier}`; const g = grouped.get(k); if (g) g.n++; else grouped.set(k, { family: it.family, tier: it.tier, n: 1 }); }
    for (const [k, g] of grouped) {
      const have = (counts[k] || 0) >= g.n;
      items.append(h('span', { class: `item ${have || c.state === 'accepted' ? 'have' : ''}`, title: foodDef(g.family, g.tier).name }, svgEl(foodIcon(g.family, g.tier)), g.n > 1 ? h('span', { class: 'cnt' }, `×${g.n}`) : null, h('span', { class: 'chk' }, '✓')));
    }
    card.append(items);
    card.append(h('div', { class: 'pat' }, h('i')));
    card.append(h('div', { class: 'foot' }, h('span', { class: 'secs' }, ''), h('span', { class: 'badge' }, c.state === 'accepted' ? '서빙 중' : ready ? '준비 완료 ▶' : `${c.order.price}코인`)));
    return card;
  }

  private onOrderTap(id: number): void {
    const run = this.run;
    const c = run.customers.find((x) => x.id === id);
    if (!c) return;
    if (c.state === 'accepted') { this.app.toast('이미 접수했어요. 직원이 전달 중이에요.'); return; }
    if (run.phase !== 'open') { this.app.toast('영업이 끝나 새 접수를 받을 수 없어요.'); return; }
    if (orderReady(run, c)) {
      const r = actAccept(run, c.id);
      if (!r.ok) { this.app.toast(r.reason ?? '', true); this.renderOrders(true); return; }
      this.app.sfx.play('accept');
      if (this.selectedOrder === c.id) this.selectedOrder = null;
      this.selectedFood = null;
      this.renderBoard(true); this.renderOrders(true); this.renderInfo();
      this.app.persist('접수');
      return;
    }
    this.app.sfx.play('select');
    this.selectedOrder = this.selectedOrder === c.id ? null : c.id;
    this.selectedFood = null;
    this.renderBoard(false); this.renderOrders(true); this.renderInfo();
  }

  // ---------- 정보줄 ----------
  renderInfo(): void {
    const run = this.run;
    clear(this.infoEl);
    const txt = h('div', { class: 'txt' });
    if (this.selectedFood != null) {
      const idx = findFood(run.board, this.selectedFood);
      if (idx < 0) { this.selectedFood = null; return this.renderInfo(); }
      const f = run.board[idx]!; const def = foodDef(f.family, f.tier);
      const waiting = ordersWaitingFor(run, f.family, f.tier).length;
      const next = f.tier < run.maxTier ? `합치면 → ${foodDef(f.family, f.tier + 1).name}(${f.tier + 1}단계, ${foodDef(f.family, f.tier + 1).price}코인)` : '오늘 최고 단계 (더 합칠 수 없음)';
      txt.append(h('b', {}, def.name), ` · ${FAMILY_DEFS[f.family].name} ${f.tier}단계 · ${def.price}코인`, h('br'), h('span', { class: 'small muted' }, `${next} · 기다리는 주문 ${waiting}개`));
      this.infoEl.append(txt, h('button', { class: 'btn small', onClick: () => this.discardSelected() }, '정리'));
      return;
    }
    if (this.selectedOrder != null) {
      const c = run.customers.find((x) => x.id === this.selectedOrder);
      if (!c) { this.selectedOrder = null; return this.renderInfo(); }
      const counts = countByKey(run.board);
      const need = new Map<string, number>();
      for (const it of c.order.items) need.set(`${it.family}:${it.tier}`, (need.get(`${it.family}:${it.tier}`) || 0) + 1);
      const parts: string[] = [];
      for (const [k, n] of need) { const [fam, t] = k.split(':'); parts.push(`${foodDef(fam as Family, Number(t)).name} ${Math.min(n, counts[k] || 0)}/${n}`); }
      txt.append(h('b', {}, `${CUSTOMER_DEFS[c.type].name} 주문`), ` · ${parts.join(', ')}`, h('br'), h('span', { class: 'small muted' }, `필요한 음식이 보드에서 강조돼요. 인내 ${Math.ceil(c.orderPatience)}초 남음 · ${c.order.price}코인`));
      this.infoEl.append(txt, h('button', { class: 'btn small', onClick: () => { this.selectedOrder = null; this.renderBoard(false); this.renderOrders(true); this.renderInfo(); } }, '해제'));
      return;
    }
    txt.append(h('span', { class: 'small muted' }, run.phase === 'open' ? `음식 → 같은 음식: 합성 · 음식 → 빈칸: 이동 · 빈칸 ${countEmpty(run.board)}/25 · 오늘 최고 ${run.maxTier}단계` : '마감 정리 중이에요.'));
    this.infoEl.append(txt);
  }

  // ---------- 일시정지 ----------
  private openPause(): void {
    if (this.pauseOverlay) return;
    this.app.sfx.play('click');
    this.app.setPaused(true, 'menu');
    const run = this.run;
    const body = h('div');
    body.append(h('p', { class: 'small muted' }, `${dayDef(run.dayId).name} · 영업 ${Math.floor(run.t)}초 경과 · 수입 ${run.ledger.sales + run.ledger.tips}코인`));
    this.updateSaveStatus();
    body.append(h('p', { class: 'small muted' }, this.saveEl));
    this.pauseOverlay = this.app.dialog('일시정지', body, [
      { label: '계속하기', primary: true, onClick: () => { this.pauseOverlay = null; this.app.setPaused(false); } },
      { label: '도움말', onClick: () => { this.app.openHelp(); return true; } },
      { label: '설정', onClick: () => { this.app.openSettings(); return true; } },
      { label: run.phase === 'open' ? '마감하고 돌아가기' : '결과로 이동', danger: true, onClick: () => {
        if (run.phase !== 'open') { this.pauseOverlay = null; this.app.setPaused(false); this.app.fastClosing = true; return; }
        this.app.confirm('지금 마감할까요?', '새 주문과 생산이 끝나요. 이미 접수한 서빙은 마무리하고, 실제로 판매한 수입만 정산해요. 목표를 못 채우면 다음 영업일은 열리지 않아요.', () => {
          actAbort(run); this.pauseOverlay = null; this.app.closeAllOverlays(); this.app.fastClosing = true; this.app.setPaused(false);
        }, '마감하기', true);
        return true;
      } },
    ], false);
  }

  // ---------- 연습 안내 ----------
  private updateTutorial(): void {
    const run = this.run; if (!this.tutEl) return;
    const c = run.customers[0];
    const counts = countByKey(run.board);
    const g1 = counts['grill:1'] || 0, g2 = counts['grill:2'] || 0;
    let step: number; let text: string;
    if (!c || c.state === 'walking' || c.state === 'queued') { step = 1; text = '손님이 오고 있어요. 앉으면 주문 카드가 나타나요. 카드에서 원하는 음식을 확인하세요.'; }
    else if (c.state === 'ordering' && g2 === 0 && g1 < 2) { step = 2; text = `주문은 치즈 꼬치(구이 2단계)예요. 아래 "구이" 버튼을 눌러 불씨 꼬치를 2개 만드세요. (${g1}/2)`; }
    else if (c.state === 'ordering' && g2 === 0) { step = 3; text = '불씨 꼬치 하나를 누르고, 다른 불씨 꼬치를 누르면 합쳐져 치즈 꼬치가 돼요.'; }
    else if (c.state === 'ordering') { step = 4; text = '주문 카드가 "준비 완료"예요! 카드를 눌러 직원에게 서빙을 맡기세요.'; }
    else if (c.state === 'accepted') { step = 5; text = '직원이 배식구에서 음식을 받아 좌석까지 걸어가요. 전달되면 수입이 들어와요.'; }
    else { step = 6; text = '연습 완료! 실제 영업에서는 손님이 여럿 오고, 가게 배치가 서빙 시간을 바꿔요. 잠시 후 결과로 넘어가요.'; }
    if (step !== this.tutStep) {
      this.tutStep = step;
      clear(this.tutEl);
      this.tutEl.append(h('span', { class: 'n' }, String(step)), h('span', { class: 'grow' }, text), h('button', { class: 'btn small', onClick: () => { this.app.confirm('연습을 건너뛸까요?', '도움말에서 언제든 규칙을 다시 볼 수 있어요.', () => { if (run.phase === 'open') actAbort(run); this.app.fastClosing = true; }); } }, '건너뛰기'));
    }
  }
}
