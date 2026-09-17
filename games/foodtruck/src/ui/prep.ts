// 가게 배치 화면: 격자, 가구 선택→빈칸 선택→미리보기→확정, 직원 경로 미리보기, 구매·강화, 영업 시작.
import type { App } from './app';
import { h, svgEl, clear } from './dom';
import { starsEl } from './app';
import { STORE, type Cell } from '../data/store';
import { STAFF, PRICES, SEATS } from '../data/balance';
import { dayDef } from '../data/days';
import { CUSTOMER_DEFS, type CustomerType } from '../data/customers';
import { StoreRenderer } from '../render/store';
import { COIN_ICON, SEAT_ICON, DECOR_ICON, STAFF_ICON, customerFace } from '../render/icons';
import { validateLayout, pathToSeat, moveFurniture, seatsOf, decorBonusForSeat, travelTime } from '../sim/store';
import { buySeat, buyDecor, buySpeed, moveLayout, resetLayout, nextSeatPrice, nextDecorPrice, nextSpeedPrice, seatCount } from '../sim/meta';

const PATH_COLORS = ['#ffe27a', '#7fd3ff', '#ff8fd8', '#7ed957'];

export class PrepView {
  el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: StoreRenderer;
  private grid: HTMLElement;
  private cells: HTMLButtonElement[] = [];
  private statusEl: HTMLElement;
  private pathListEl: HTMLElement;
  private shopEl: HTMLElement;
  private coinEls: HTMLElement[] = [];
  private startBtn: HTMLButtonElement;
  private selectedId: number | null = null;
  private preview: Cell | null = null;
  private previewOk = false;
  private previewProblems: string[] = [];
  private time = 0;
  private dayId: number;

  constructor(private app: App) {
    const m = app.state.meta;
    this.dayId = m.lastDay;
    const day = dayDef(this.dayId);
    this.el = h('div', { id: 'prep', class: 'screen' });
    const coin = () => { const c = h('span', { class: 'coin' }, svgEl(COIN_ICON), String(m.coins)); this.coinEls.push(c); return c; };
    this.el.append(h('div', { class: 'topbar' }, h('button', { class: 'btn small', onClick: () => { app.sfx.play('click'); app.show('days'); } }, '← 영업일'), h('h2', {}, `${this.dayId}일차 준비 · ${day.name}`), coin()));
    const sc = h('div', { class: 'scroll' });

    // 오늘의 영업 정보
    const faces = h('div', { class: 'faces' });
    const types = Object.entries(day.customerWeights).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as Array<[CustomerType, number]>;
    for (const [t] of types) faces.append(h('span', { title: CUSTOMER_DEFS[t].name }, svgEl(customerFace(t))));
    const best = m.best[String(this.dayId)];
    sc.append(h('div', { class: 'card' },
      h('h3', {}, `${day.name} `, h('span', { class: 'muted small' }, day.subtitle)),
      h('p', { class: 'small', style: 'margin:0 0 8px;line-height:1.4' }, day.desc),
      h('div', { class: 'row wrap small', style: 'gap:6px' },
        h('span', { class: 'pill' }, `손님 약 ${day.customerCount}명`),
        h('span', { class: 'pill' }, `메뉴 ${day.minTier}~${day.maxTier}단계`),
        h('span', { class: 'pill' }, `목표 서빙 ${day.targetServed}명`),
        h('span', { class: 'pill' }, `⭐2 ${day.star2.label}`),
        h('span', { class: 'pill' }, `⭐3 수입 ${day.incomeGoal}`),
      ),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'small muted' }, '오늘 오는 손님:'), faces),
      h('div', { class: 'row', style: 'margin-top:6px' }, starsEl(best?.stars ?? 0), h('span', { class: 'small muted' }, best ? `최고 수입 ${best.income} · 최다 서빙 ${best.served}명` : '아직 기록 없음')),
    ));

    // 가게 격자
    this.canvas = h('canvas');
    this.renderer = new StoreRenderer(this.canvas);
    this.grid = h('div', { class: 'grid-overlay' });
    for (let y = 0; y < STORE.rows; y++) for (let x = 0; x < STORE.cols; x++) {
      const b = h('button', { 'data-x': x, 'data-y': y, 'aria-label': `칸 ${x + 1},${y + 1}`, onClick: () => this.onCell({ x, y }) });
      this.cells.push(b); this.grid.append(b);
    }
    const wrap = h('div', { class: 'storewrap' }, this.canvas, this.grid);
    this.statusEl = h('div', { class: 'hint', style: 'min-height:38px;display:flex;align-items:center;gap:8px;margin-top:8px' });
    this.pathListEl = h('div', { class: 'pathlist', style: 'margin-top:6px' });
    const storeCard = h('div', { class: 'card', style: 'padding:8px' });
    storeCard.append(h('h3', { style: 'padding:0 4px' }, '가게 배치 ', h('span', { class: 'muted small' }, '가구 누르기 → 빈칸 누르기 → 확정')));
    if (!m.prepHintShown) {
      const banner = h('div', { class: 'tutbanner', style: 'margin:0 0 8px' }, h('span', { class: 'n' }, '!'), h('span', { class: 'grow' }, '좌석을 누른 뒤 빈칸을 누르면 옮길 수 있어요. 점선은 직원이 배식구에서 좌석까지 걷는 경로예요. 가까울수록 서빙이 빨라져요.'), h('button', { class: 'btn small', onClick: () => { banner.remove(); m.prepHintShown = true; app.persist('배치 안내'); } }, '알겠어요'));
      storeCard.append(banner);
    }
    storeCard.append(wrap, this.statusEl, this.pathListEl);
    sc.append(storeCard);

    // 상점
    this.shopEl = h('div', { class: 'card' });
    sc.append(this.shopEl);

    sc.append(h('p', { class: 'small muted', style: 'margin:0 0 8px;line-height:1.45' }, '영업은 약 3분(180초)이고 준비·정산 시간은 따로예요. 시작하면 계열별 1단계 음식 2개씩(6개)을 받고, 남은 음식은 다음 날로 넘어가지 않아요. 150초부터는 새 손님이 오지 않아요.'));
    this.el.append(sc);
    this.startBtn = h('button', { class: 'btn primary block', onClick: () => this.start() }, '영업 시작') as HTMLButtonElement;
    this.el.append(h('div', { class: 'prepbar' }, this.startBtn));
    this.refresh();
  }

  mounted(): void { this.resize(); this.draw(0); }
  destroy(): void { /* nothing to release */ }

  resize(): void {
    this.renderer.resize();
    const g = this.renderer.geom;
    this.grid.style.left = `${g.ox}px`; this.grid.style.top = `${g.oy}px`; this.grid.style.width = `${g.cs * STORE.cols}px`; this.grid.style.height = `${g.cs * STORE.rows}px`;
  }

  update(dt: number): void { this.time += dt; this.draw(dt); }

  private currentLayout() {
    const m = this.app.state.meta;
    if (this.selectedId != null && this.preview && this.previewOk) return moveFurniture(m.layout, this.selectedId, this.preview).furniture;
    return m.layout;
  }

  private draw(dt: number): void {
    const m = this.app.state.meta;
    const layout = this.currentLayout();
    const paths = seatsOf(layout).map((s, i) => ({ path: pathToSeat(STORE.kitchen, s, layout) ?? [], color: PATH_COLORS[i % PATH_COLORS.length] }));
    const day = dayDef(this.dayId);
    this.renderer.draw(null, layout, { time: this.time, weather: day.weather, level: m.unlockedDay, staffSpeedLevel: m.staffSpeedLevel, paths, selectedId: this.selectedId, ghost: this.selectedId != null && this.preview ? { kind: m.layout.find((f) => f.id === this.selectedId)!.kind, cell: this.preview, ok: this.previewOk } : null }, dt);
  }

  private onCell(c: Cell): void {
    const m = this.app.state.meta;
    const f = m.layout.find((x) => x.x === c.x && x.y === c.y);
    this.app.sfx.play('click');
    if (this.selectedId == null) {
      if (f) { this.selectedId = f.id; this.preview = null; }
      else if (c.x === STORE.kitchen.x && c.y === STORE.kitchen.y) this.app.toast('배식구예요. 직원이 여기서 음식을 받아요.');
      else if (c.x === STORE.entrance.x && c.y === STORE.entrance.y) this.app.toast('손님 출입구예요.');
      else this.app.toast('먼저 옮길 가구(좌석·장식)를 누르세요.');
    } else if (f && f.id === this.selectedId) {
      this.selectedId = null; this.preview = null;
    } else if (f) {
      this.selectedId = f.id; this.preview = null;
    } else if (this.preview && this.preview.x === c.x && this.preview.y === c.y) {
      this.confirmMove();
      return;
    } else {
      const r = moveFurniture(m.layout, this.selectedId, c);
      this.preview = c; this.previewOk = r.ok; this.previewProblems = r.problems;
      if (!r.ok) this.app.sfx.play('error');
    }
    this.refresh();
  }

  private confirmMove(): void {
    const m = this.app.state.meta;
    if (this.selectedId == null || !this.preview) return;
    const r = moveLayout(m, this.selectedId, this.preview);
    if (!r.ok) { this.app.toast(r.problems[0] ?? '놓을 수 없는 자리예요.', true); return; }
    this.app.sfx.play('move');
    this.app.toast('배치를 바꿨어요. 경로가 다시 계산됐어요.');
    this.selectedId = null; this.preview = null;
    this.app.persist('배치 변경');
    this.refresh();
  }

  private cancelMove(): void { this.selectedId = null; this.preview = null; this.refresh(); }

  refresh(): void {
    const m = this.app.state.meta;
    for (const c of this.coinEls) c.lastChild!.textContent = String(m.coins);
    // 격자 상태
    for (const b of this.cells) {
      const x = Number(b.dataset.x), y = Number(b.dataset.y);
      const f = m.layout.find((q) => q.x === x && q.y === y);
      b.className = '';
      if ((x === STORE.kitchen.x && y === STORE.kitchen.y) || (x === STORE.entrance.x && y === STORE.entrance.y)) b.classList.add('fixed');
      if (f && f.id === this.selectedId) b.classList.add('sel');
      if (this.selectedId != null && !f && !b.classList.contains('fixed')) b.classList.add('target');
    }
    // 상태 줄
    clear(this.statusEl);
    if (this.selectedId == null) {
      const chk = validateLayout(m.layout);
      this.statusEl.append(h('span', { class: 'grow' }, chk.ok ? '가구를 누르면 옮길 수 있어요.' : `⚠ ${chk.problems[0]}`));
      const reset = h('button', { class: 'btn small', onClick: () => this.app.confirm('배치를 초기화할까요?', '구매한 좌석·장식은 유지되고 위치만 기본 배치로 돌아가요.', () => { const r = resetLayout(m); if (!r.ok) this.app.toast(r.problems[0], true); else { this.app.persist('배치 초기화'); this.refresh(); } }) }, '배치 초기화');
      this.statusEl.append(reset);
    } else {
      const f = m.layout.find((q) => q.id === this.selectedId)!;
      const name = f.kind === 'seat' ? '좌석' : '장식';
      if (!this.preview) this.statusEl.append(h('span', { class: 'grow' }, `${name} 선택됨. 옮길 빈칸을 누르세요.`), h('button', { class: 'btn small', onClick: () => this.cancelMove() }, '취소'));
      else if (this.previewOk) this.statusEl.append(h('span', { class: 'grow' }, `(${this.preview.x + 1}, ${this.preview.y + 1})로 옮길까요? 아래 경로가 새 배치 기준이에요.`), h('button', { class: 'btn small', onClick: () => this.cancelMove() }, '취소'), h('button', { class: 'btn small primary', onClick: () => this.confirmMove() }, '확정'));
      else this.statusEl.append(h('span', { class: 'grow', style: 'color:var(--bad)' }, `놓을 수 없어요: ${this.previewProblems[0]}`), h('button', { class: 'btn small', onClick: () => this.cancelMove() }, '취소'));
    }
    // 경로 목록
    clear(this.pathListEl);
    const layout = this.currentLayout();
    const speed = STAFF.baseSpeed * STAFF.speedMult[m.staffSpeedLevel];
    seatsOf(layout).forEach((s, i) => {
      const p = pathToSeat(STORE.kitchen, s, layout);
      const bonus = decorBonusForSeat(s, layout);
      const steps = p ? p.length : null;
      this.pathListEl.append(h('span', { class: 'pill', style: `border-color:${PATH_COLORS[i % PATH_COLORS.length]}` }, `좌석${i + 1}: ${steps === null ? '경로 없음' : `${steps}칸 · 편도 ${travelTime(steps, speed).toFixed(1)}초`}${bonus ? ` · 장식 +${bonus}초` : ''}`));
    });
    // 상점
    clear(this.shopEl);
    this.shopEl.append(h('h3', {}, '구매·강화 ', h('span', { class: 'muted small' }, '영업 사이에만 가능')));
    const row = (icon: string, title: string, desc: string, price: number | null, onBuy: () => void, doneLabel = '최대') => {
      const btn = price === null ? h('button', { class: 'btn small', disabled: true }, doneLabel) : h('button', { class: `btn small ${m.coins >= price ? 'primary' : ''}`, disabled: m.coins < price, onClick: onBuy }, `${price} 코인`);
      this.shopEl.append(h('div', { class: 'shoprow' }, svgEl(icon, 'icon'), h('div', { class: 't' }, h('b', {}, title), h('span', {}, desc)), btn));
    };
    const sp = nextSeatPrice(m);
    row(SEAT_ICON, `좌석 추가 (${seatCount(m)}/${SEATS.max})`, '손님을 더 받지만 동시에 처리할 주문도 늘어요.', seatCount(m) >= SEATS.max ? null : sp, () => this.buy(() => buySeat(m)));
    const dp = nextDecorPrice(m);
    const decors = m.layout.filter((f) => f.kind === 'decor').length;
    row(DECOR_ICON, `등불 장식 (${decors}/${PRICES.decorMax})`, '붙어 있는 좌석의 주문 인내 +5초 (좌석당 최대 +10초).', dp, () => this.buy(() => buyDecor(m)));
    const spd = nextSpeedPrice(m);
    row(STAFF_ICON, `직원 서빙 속도 (${m.staffSpeedLevel}/2)`, `기본 ${STAFF.baseSpeed}칸/초 → 1단계 ×${STAFF.speedMult[1]} → 2단계 ×${STAFF.speedMult[2]}. 현재 ${speed.toFixed(2)}칸/초.`, spd, () => this.buy(() => buySpeed(m)));
    // 시작 버튼
    const chk = validateLayout(m.layout);
    this.startBtn.disabled = !chk.ok || this.selectedId != null;
    this.startBtn.textContent = !chk.ok ? '배치를 고쳐야 시작할 수 있어요' : this.selectedId != null ? '배치 변경을 마친 뒤 시작' : `영업 시작 (${this.dayId}일차)`;
  }

  private buy(fn: () => { ok: boolean; reason?: string }): void {
    const r = fn();
    if (!r.ok) { this.app.toast(r.reason ?? '구매할 수 없어요.', true); return; }
    this.app.sfx.play('buy');
    this.app.toast('구매했어요! 가게에 배치됐어요.');
    this.app.persist('구매');
    this.refresh();
  }

  private start(): void {
    const chk = validateLayout(this.app.state.meta.layout);
    if (!chk.ok) { this.app.toast(chk.problems[0], true); return; }
    this.app.sfx.play('click');
    this.app.startDay(this.dayId);
  }
}
