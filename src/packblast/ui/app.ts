// 화면·입력·게임 루프. 게임 규칙은 core/·combat/ 에 있고 여기서는 호출만 한다.
import { h, clear } from './dom';
import { openModal, closeModal, isModalOpen, toast } from './modal';
import { Sfx } from '../platform/audio';
import { EQUIPMENT, GRADE_NAMES, TAG_NAMES, KIND_NAMES, SUPPORT_TARGET_NAMES, supportEffectText, type EquipId } from '../data/equipment';
import { BALANCE, DIFFICULTY_NAMES, type Difficulty } from '../data/balance';
import { ENEMIES } from '../data/enemies';
import { load, save, resetAll, storageInfo, type SaveBlob } from '../core/save';
import { createRun, newSeed, placeItem, toBench, mergeItems, mergePartners, dismantleItem, dismantleRefund, heal, canHeal, pickReward, refreshReward, chooseUnlock, checkStart, startBattle, applyBattleResult, restoreCheckpoint, getItem, bagItems, benchItems, loadoutOf, stageDef, lockedCells, type RunState } from '../core/run';
import { checkPlacement, freeCellCount, itemAt, itemCells, type Item } from '../core/bag';
import { rotateCells, nextRot, type Rot } from '../core/shapes';
import { weaponStatLines, type Loadout } from '../core/loadout';
import { candidateFlags } from '../core/rewards';
import { BattleSim } from '../combat/sim';
import { BagView, renderItemThumb, type Selection, type BagAnim } from '../render/bagView';
import { BattleView } from '../render/battleView';
import { drawEquipIcon } from '../render/sprites';

type Screen = 'title' | 'prep' | 'battle' | 'result';
const STEP = BALANCE.fixedStep;

export class App {
  root: HTMLElement; blob: SaveBlob; run: RunState | null = null; sfx = new Sfx(); screen: Screen = 'title';
  saveStatus = ''; loadNote: string | null = null;
  // prep
  elPrep!: HTMLElement; bagCanvas!: HTMLCanvasElement; bagView!: BagView; bagArea!: HTMLElement;
  elTop!: HTMLElement; elTutor!: HTMLElement; elThreats!: HTMLElement; elInfo!: HTMLElement; elBench!: HTMLElement; elBenchLabel!: HTMLElement; elActions!: HTMLElement; btnHeal!: HTMLButtonElement; btnStart!: HTMLButtonElement;
  sel: Selection | null = null; inspectUid: string | null = null; anim: BagAnim = {}; unlockChoice: number[] | null = null; loadout: Loadout | null = null;
  drag: { uid: string; from: 'bag' | 'bench'; origin: 'chip' | 'canvas'; sx: number; sy: number; active: boolean; pointerId: number } | null = null;
  // battle
  elBattle!: HTMLElement; battleCanvas!: HTMLCanvasElement; battleView!: BattleView; elBTop!: HTMLElement; elWeapons!: HTMLElement; btnShock!: HTMLButtonElement; btnSpeed!: HTMLButtonElement; elBmsg!: HTMLElement;
  sim: BattleSim | null = null; speed: 1 | 2 = 1; paused = false; acc = 0; ended = false; endTimer = 0; starting = false; heatEls = new Map<string, { chip: HTMLElement; fill: HTMLElement; st: HTMLElement }>();
  // misc
  elTitle!: HTMLElement; elResult!: HTMLElement; last = 0; time = 0; tutorialStep = 0; fps = 0; private fpsAcc = 0; private fpsN = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const l = load(); this.blob = l.blob; this.run = l.blob.run; this.loadNote = l.error || l.note;
    this.sfx.setVolume(this.blob.meta.settings.sfx, this.blob.meta.settings.muted);
    this.build();
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('resize', () => this.onResize());
    root.addEventListener('pointerdown', () => this.sfx.unlock(), { capture: true });
    this.showTitle();
    requestAnimationFrame(t => this.frame(t));
  }

  // ---------------- 저장 ----------------
  persist(): void { this.blob.run = this.run; const r = save(this.blob); this.saveStatus = r.ok ? '' : (r.error || '저장 실패'); }

  // ---------------- DOM 구성 ----------------
  private build(): void {
    const r = this.root; clear(r);
    this.elTitle = h('div', { id: 'title', class: 'screen' });
    // prep
    this.elTop = h('div', { class: 'topbar' });
    this.elTutor = h('div', { id: 'tutor', class: 'hidden' });
    this.elThreats = h('div', { id: 'threats' });
    this.bagCanvas = h('canvas', { id: 'bagcv' });
    this.bagArea = h('div', { id: 'bagarea' }, this.bagCanvas);
    this.elInfo = h('div', { id: 'info' });
    this.elBench = h('div', { id: 'bench' });
    this.elBenchLabel = h('div', { id: 'benchlabel' });
    this.elActions = h('div', { id: 'actions' });
    this.btnHeal = h('button', { id: 'btn-heal', onClick: () => this.healAction() }, '회복');
    this.btnStart = h('button', { id: 'btn-start', class: 'primary', onClick: () => this.startFlow() }, '가방 닫고 출발');
    this.elPrep = h('div', { id: 'prep', class: 'screen hidden' }, this.elTop, this.elTutor, this.elThreats, this.bagArea, this.elInfo, h('div', { id: 'benchwrap' }, this.elBenchLabel, this.elBench), this.elActions, h('div', { id: 'startrow' }, this.btnHeal, this.btnStart));
    this.bagView = new BagView(this.bagCanvas);
    this.bagCanvas.addEventListener('pointerdown', e => this.onBagPointerDown(e));
    this.bagCanvas.addEventListener('pointermove', e => this.onPointerMove(e));
    this.bagCanvas.addEventListener('pointerup', e => this.onPointerUp(e));
    this.bagCanvas.addEventListener('pointercancel', () => { this.drag = null; });
    // battle
    this.elBTop = h('div', { class: 'topbar' });
    this.battleCanvas = h('canvas', { id: 'bcv' });
    this.elBmsg = h('div', { id: 'bmsg' });
    this.elWeapons = h('div', { id: 'weapons' });
    this.btnShock = h('button', { id: 'btn-shock', onClick: () => this.useShockwave() }, '⚡ 긴급 충격파');
    this.btnSpeed = h('button', { id: 'btn-speed', onClick: () => this.toggleSpeed() }, '1×');
    this.elBattle = h('div', { id: 'battle', class: 'screen hidden' }, this.elBTop, h('div', { id: 'bfield' }, this.battleCanvas, this.elBmsg), this.elWeapons, h('div', { id: 'bcontrols' }, this.btnShock, this.btnSpeed));
    this.battleView = new BattleView(this.battleCanvas);
    this.elResult = h('div', { id: 'result', class: 'screen hidden' });
    r.append(this.elTitle, this.elPrep, this.elBattle, this.elResult);
  }

  private showScreen(s: Screen): void {
    this.screen = s;
    this.elTitle.classList.toggle('hidden', s !== 'title'); this.elPrep.classList.toggle('hidden', s !== 'prep');
    this.elBattle.classList.toggle('hidden', s !== 'battle'); this.elResult.classList.toggle('hidden', s !== 'result');
    this.onResize();
  }
  private onResize(): void {
    if (this.screen === 'prep') this.bagView.resize();
    if (this.screen === 'battle' && this.sim) this.battleView.resize(this.sim);
  }

  // ---------------- 타이틀 ----------------
  showTitle(): void {
    closeModal();
    const m = this.blob.meta; const el = this.elTitle; clear(el);
    const canResume = !!this.run && this.run.phase !== 'result';
    const logo = h('canvas', { class: 'logo-bag' }) as HTMLCanvasElement; renderItemThumb(logo, 'mg', 3, 0, 84);
    el.append(
      logo,
      h('h1', {}, h('small', {}, '가방이 무기다'), '팩 앤 블래스트', h('small', { style: 'color:#a9a8c7;letter-spacing:0;font-size:11px;margin-top:4px' }, '웹 베타')),
      h('div', { class: 'sub' }, '제한된 가방에 장비를 배치하고, 인접 효과로 조합을 만든 뒤, 짧은 자동 전투로 고철 괴물을 상대하세요. 12구간, 마지막은 보스.'),
    );
    if (this.loadNote) el.append(h('div', { class: 'note' }, this.loadNote));
    el.append(
      h('div', { class: 'menu' },
        canResume ? h('button', { class: 'primary', onClick: () => this.resume() }, `이어하기 (구간 ${this.run!.stage} · ${DIFFICULTY_NAMES[this.run!.difficulty]})`) : null,
        h('button', { class: canResume ? '' : 'primary', onClick: () => this.newRunFlow('normal') }, '새 게임 · 보통'),
        h('button', { disabled: !m.hardUnlocked, onClick: () => this.newRunFlow('hard') }, m.hardUnlocked ? '새 게임 · 어려움' : '어려움 (보통 클리어 후 해금)'),
        h('div', { class: 'row' },
          h('button', { onClick: () => this.newRunFlow('normal', true) }, '튜토리얼'),
          h('button', { onClick: () => this.openCodex() }, '도감'),
          h('button', { onClick: () => this.openHelp() }, '도움말'),
          h('button', { onClick: () => this.openSettings() }, '설정'),
        ),
      ),
      h('div', { class: 'foot' }, `최고 도달: 보통 ${m.bestStage.normal}구간 · 어려움 ${m.bestStage.hard}구간 · 클리어 ${m.clears.normal + m.clears.hard}회`, h('br'), storageInfo.available ? '진행 상황은 이 브라우저에 자동 저장됩니다.' : '⚠ 브라우저 저장소를 쓸 수 없어 진행이 저장되지 않습니다.'),
    );
    this.loadNote = null;
    this.showScreen('title');
  }
  private newRunFlow(diff: Difficulty, tutorial = false): void {
    const start = () => { this.run = createRun(newSeed(), diff, tutorial || !this.blob.meta.tutorialDone); this.tutorialStep = this.run.tutorial ? 1 : 0; this.blob.meta.runs++; this.persist(); this.enterPrep(); };
    if (this.run && this.run.phase !== 'result') openModal(this.root, { title: '새 게임', body: '진행 중인 판이 있습니다. 버리고 새로 시작할까요?', center: true, buttons: [{ label: '돌아가기', onClick: () => {} }, { label: '새로 시작', cls: 'danger', onClick: start }] });
    else start();
  }
  private resume(): void { if (!this.run) return; this.tutorialStep = this.run.tutorial && !this.blob.meta.tutorialDone ? this.guessTutorialStep() : 0; if (this.run.phase === 'result') this.showResult(); else this.enterPrep(); }
  private guessTutorialStep(): number { const r = this.run!; if (r.stage >= 2) return r.phase === 'prep' ? 5 : 0; const mg = r.items.find(i => i.id === 'mg'); if (!mg || mg.loc !== 'bag') return 1; const lo = loadoutOf(r); const w = lo.weapons.find(w => w.id === 'mg'); if (!w || !w.links.some(l => l.applied && l.type === 'battery')) return 2; return 4; }

  // ---------------- 정리 화면 ----------------
  enterPrep(): void {
    const r = this.run!; closeModal();
    this.sel = null; this.inspectUid = null; this.anim = {}; this.drag = null;
    this.unlockChoice = r.phase === 'unlock' ? [] : null;
    this.showScreen('prep');
    this.renderPrep();
    if (r.phase === 'reward') this.openReward();
  }
  renderPrep(): void {
    const r = this.run!; if (!r) return;
    // 합성·분해로 사라진 장비를 가리키는 선택은 해제한다
    if (this.inspectUid && !getItem(r, this.inspectUid)) this.inspectUid = null;
    if (this.sel && !getItem(r, this.sel.uid)) this.sel = null;
    this.loadout = loadoutOf(r);
    const def = stageDef(r);
    // 상단
    clear(this.elTop);
    this.elTop.append(
      this.hpBar(r.hp, r.maxHp, 0),
      h('div', { class: 'stat' }, h('span', { class: 'ico' }, '⚙'), `${r.parts}`),
      h('div', { class: 'stageinfo' }, `구간 ${r.stage}/${BALANCE.stages}`, h('small', {}, `${def.kind === 'boss' ? '보스' : def.kind === 'elite' ? '정예' : '기본'} · ${DIFFICULTY_NAMES[r.difficulty]} · 빈칸 ${freeCellCount(r.grid, r.items)}`)),
      h('div', { class: 'spacer' }),
      h('button', { class: 'ghost', 'aria-label': '메뉴', onClick: () => this.openPrepMenu() }, '☰'),
    );
    // 다음 위협
    clear(this.elThreats);
    this.elThreats.append(h('span', { class: 'muted' }, '다음:'), h('span', { class: 'tchip' }, def.title), ...def.threats.map(t => h('span', { class: 'tchip warn' }, t)));
    if (this.blob.meta.settings.sfx === 0) { /* no-op */ }
    // 튜토리얼
    this.renderTutor();
    // 정보
    this.renderInfo();
    // 작업대
    this.renderBench();
    // 액션
    this.renderActions();
    // 출발/회복
    const ch = canHeal(r);
    this.btnHeal.disabled = !ch.ok; this.btnHeal.textContent = `회복 +${Math.round(r.maxHp * BALANCE.healRatio)} (⚙${BALANCE.healCost})`; this.btnHeal.title = ch.reason || '';
    const st = checkStart(r);
    this.btnStart.disabled = r.phase !== 'prep' || this.starting;
    this.btnStart.textContent = r.phase === 'unlock' ? '해금할 칸을 선택하세요' : st.ok ? (def.kind === 'boss' ? '가방 닫고 보스전 출발' : '가방 닫고 출발') : '무기를 가방에 넣으세요';
  }
  private hpBar(hp: number, max: number, shield: number): HTMLElement {
    const pct = Math.max(0, Math.min(100, (hp / max) * 100)); const spct = Math.max(0, Math.min(100, (shield / max) * 100));
    return h('div', { class: 'hpwrap' }, h('div', { class: 'hpbar' }, h('div', { class: 'fill', style: `width:${pct}%` }), shield > 0 ? h('div', { class: 'shieldfill', style: `width:${spct}%` }) : null, h('div', { class: 'txt' }, `♥ ${Math.ceil(hp)}/${max}${shield > 0 ? ` +🛡${Math.ceil(shield)}` : ''}`)));
  }
  private renderInfo(): void {
    const r = this.run!; const el = this.elInfo; clear(el);
    if (this.unlockChoice) { el.append(h('div', { class: 'name' }, '가방 확장'), h('div', { class: 'line' }, `정예 전투 클리어! 잠긴 모서리 칸 중 ${r.pendingUnlock}칸을 골라 해금합니다. 자물쇠 칸을 누르세요.`)); return; }
    const uid = this.sel?.uid ?? this.inspectUid;
    const it = uid ? getItem(r, uid) : undefined;
    if (!it) {
      el.append(h('div', { class: 'hint' }, benchItems(r).length ? '작업대의 장비를 누른 뒤 가방 칸을 누르면 미리보기가 나타납니다. 같은 자리를 다시 누르거나 "배치 확정"을 누르세요.' : '가방 속 장비를 누르면 이동·합성·분해 메뉴와 연결 상태가 보입니다.'),
        h('div', { class: 'line' }, `빈칸 ${freeCellCount(r.grid, r.items)} · 다음 전투: ${stageDef(r).threats.join(', ')}`));
      return;
    }
    const d = EQUIPMENT[it.id];
    el.append(h('div', { class: 'name' }, d.name, h('span', { class: `badge g${it.grade}` }, GRADE_NAMES[it.grade]), h('span', { class: `badge kind-${d.kind}` }, KIND_NAMES[d.kind]), ...d.tags.map(t => h('span', { class: 'badge tag' }, TAG_NAMES[t])), h('span', { class: 'muted' }, `${d.shape.length}칸`)));
    el.append(h('div', { class: 'line' }, d.short + ' · ' + d.gradeNotes[it.grade - 1]));
    if (this.sel && this.sel.moving) {
      if (this.sel.ax === null) el.append(h('div', { class: 'hint' }, '가방 칸을 눌러 놓을 자리를 고르세요. ↻ 회전으로 방향을 바꿀 수 있습니다.'));
      else { const chk = checkPlacement(r.grid, r.items, it.id, this.sel.rot, this.sel.ax, this.sel.ay!, it.uid); el.append(h('div', { class: chk.ok ? 'ok' : 'no' }, chk.ok ? '✓ 놓을 수 있습니다. 같은 자리를 다시 누르거나 "배치 확정"을 누르세요.' : '✗ 놓을 수 없음: ' + chk.reasons.join(', '))); }
      return;
    }
    // 가방 속 장비 검사: 실제 효과와 연결
    const lo = this.loadout!;
    const w = lo.weapons.find(x => x.uid === it.uid);
    if (w) {
      for (const line of weaponStatLines(w)) el.append(h('div', { class: 'line' }, line));
      if (w.links.length === 0) el.append(h('div', { class: 'hint' }, d.tags.length ? `연결된 지원 장비 없음. ${d.tags.map(t => TAG_NAMES[t]).join('·')} 대상 지원 장비를 옆에 붙여 보세요.` : '이 무기는 지원 장비의 영향을 받지 않습니다.'));
      for (const l of w.links) el.append(h('div', { class: l.applied ? 'ok' : 'no' }, `${l.applied ? '✓' : '✗'} ${EQUIPMENT[l.supportId].name} ${GRADE_NAMES[l.grade]}: ${l.applied ? l.text : l.reason}`));
    }
    const sp = lo.supports.find(x => x.uid === it.uid);
    if (sp) {
      el.append(h('div', { class: 'line' }, `${supportEffectText(it.id, it.grade)} · 대상: ${SUPPORT_TARGET_NAMES[sp.type]} 태그 장비`));
      if (sp.linkedTo.length) el.append(h('div', { class: 'ok' }, '✓ 연결됨: ' + sp.linkedTo.map(u => EQUIPMENT[getItem(r, u)!.id].name).join(', ')));
      else el.append(h('div', { class: 'no' }, `✗ 연결된 무기 없음 — ${SUPPORT_TARGET_NAMES[sp.type]} 장비 옆(상하좌우)에 붙이세요.`));
      for (const b of sp.blockedFrom) el.append(h('div', { class: 'no' }, `✗ ${EQUIPMENT[getItem(r, b.uid)!.id].name}: ${b.reason}`));
    }
    if (d.shield) el.append(h('div', { class: 'line' }, `전투 시작 보호막 ${d.shield[it.grade - 1]} (가방 전체 합계 ${lo.shield})`));
    if (d.heal) el.append(h('div', { class: 'line' }, `클리어 시 회복 ${d.heal[it.grade - 1]} (가방 전체 합계 ${lo.heal})`));
    if (it.loc === 'bench') el.append(h('div', { class: 'hint' }, '작업대 장비는 전투에 가져가지 않습니다.'));
  }
  private renderBench(): void {
    const r = this.run!; const el = this.elBench; clear(el);
    const items = benchItems(r);
    this.elBenchLabel.replaceChildren(h('span', {}, `작업대 (${items.length})`), h('span', {}, '전투에는 가방 속 장비만 가져갑니다'));
    if (!items.length) { el.append(h('div', { class: 'empty' }, '작업대가 비어 있습니다')); return; }
    for (const it of items) {
      const cv = h('canvas') as HTMLCanvasElement; renderItemThumb(cv, it.id, it.grade, it.rot, 44);
      const chip = h('div', { class: 'chip' + (this.sel?.uid === it.uid || this.inspectUid === it.uid ? ' sel' : ''), 'data-uid': it.uid }, cv, h('div', { class: 'nm' }, EQUIPMENT[it.id].name), h('div', { class: 'g', style: `color:${it.grade === 3 ? '#ffca28' : it.grade === 2 ? '#64b5f6' : '#b0bec5'}` }, `${it.grade}등급`));
      chip.addEventListener('pointerdown', e => this.onChipPointerDown(e, it.uid));
      chip.addEventListener('pointermove', e => this.onPointerMove(e));
      chip.addEventListener('pointerup', e => this.onPointerUp(e));
      chip.addEventListener('pointercancel', () => { this.drag = null; });
      el.append(chip);
    }
  }
  private renderActions(): void {
    const r = this.run!; const el = this.elActions; clear(el); el.className = '';
    const B = (label: string, ico: string, onClick: () => void, opts: { cls?: string; disabled?: boolean } = {}) => h('button', { class: opts.cls || '', disabled: opts.disabled, onClick }, h('span', { class: 'ico' }, ico), label);
    if (this.unlockChoice) {
      el.className = 'cols3';
      el.append(B('선택 취소', '↺', () => { this.unlockChoice = []; this.renderPrep(); }), h('div'), B('해금 확정', '🔓', () => this.confirmUnlock(), { cls: 'primary', disabled: this.unlockChoice.length !== r.pendingUnlock }));
      return;
    }
    if (this.sel) {
      const canConfirm = this.sel.ax !== null && checkPlacement(r.grid, r.items, getItem(r, this.sel.uid)!.id, this.sel.rot, this.sel.ax, this.sel.ay!, this.sel.uid).ok;
      el.append(B('회전', '↻', () => this.rotateSel()), B('취소', '✕', () => this.cancelSel()), B('작업대로', '⬇', () => this.toBenchAction(this.sel!.uid), { disabled: this.sel.from !== 'bag' }), B('배치 확정', '✓', () => this.confirmPlace(), { cls: 'primary', disabled: !canConfirm }));
      return;
    }
    if (this.inspectUid) {
      const it = getItem(r, this.inspectUid)!;
      const partners = mergePartners(r, it.uid);
      el.className = 'cols5';
      if (it.loc === 'bag') el.append(B('이동', '✥', () => this.moveItem(it.uid)), B('회전', '↻', () => this.moveItem(it.uid, true)), B(`합성${partners.length ? ` (${partners.length})` : ''}`, '⚗', () => this.mergeFlow(it.uid), { disabled: !partners.length }), B('작업대로', '⬇', () => this.toBenchAction(it.uid)), B('분해', '🔧', () => this.dismantleFlow(it.uid), { cls: 'danger' }));
      else el.append(B('가방에 놓기', '⬆', () => this.selectBench(it.uid)), B('회전', '↻', () => { this.selectBench(it.uid); this.rotateSel(); }), B(`합성${partners.length ? ` (${partners.length})` : ''}`, '⚗', () => this.mergeFlow(it.uid), { disabled: !partners.length }), h('div'), B('분해', '🔧', () => this.dismantleFlow(it.uid), { cls: 'danger' }));
      return;
    }
    el.append(h('div', { class: 'muted', style: 'grid-column: span 4; font-size: 12px; display:flex; align-items:center; min-height:44px;' }, '장비를 선택하면 회전·이동·합성·분해 버튼이 여기에 나타납니다.'));
  }

  // ---- 입력 ----
  private onChipPointerDown(e: PointerEvent, uid: string): void {
    if (this.run?.phase !== 'prep') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag = { uid, from: 'bench', origin: 'chip', sx: e.clientX, sy: e.clientY, active: false, pointerId: e.pointerId };
  }
  private onBagPointerDown(e: PointerEvent): void {
    const r = this.run!; if (!r) return;
    this.bagCanvas.setPointerCapture(e.pointerId);
    const cell = this.bagView.cellAt(e.clientX, e.clientY);
    if (this.unlockChoice) { if (cell) this.tapUnlock(cell); return; }
    if (r.phase !== 'prep') return;
    // 드래그 후보: 선택 중이 아니고 가방 장비를 눌렀을 때
    const it = cell ? itemAt(r.grid, r.items, cell.x, cell.y) : undefined;
    if (!this.sel && it) { this.drag = { uid: it.uid, from: 'bag', origin: 'canvas', sx: e.clientX, sy: e.clientY, active: false, pointerId: e.pointerId }; return; }
    if (this.sel) { this.drag = { uid: this.sel.uid, from: this.sel.from, origin: 'canvas', sx: e.clientX, sy: e.clientY, active: false, pointerId: e.pointerId }; return; }
    if (cell) this.tapCell(cell); else { this.inspectUid = null; this.renderPrep(); }
  }
  private onPointerMove(e: PointerEvent): void {
    const d = this.drag; if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) { if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 10) return; d.active = true; this.beginDrag(d.uid, d.from); }
    const cell = this.bagView.cellAt(e.clientX, e.clientY);
    if (cell && this.sel) { const it = getItem(this.run!, this.sel.uid)!; const cells = rotateCells(EQUIPMENT[it.id].shape, this.sel.rot); let w = 0, hh = 0; for (const [x, y] of cells) { w = Math.max(w, x + 1); hh = Math.max(hh, y + 1); } this.sel.ax = cell.x - Math.floor((w - 1) / 2); this.sel.ay = cell.y - Math.floor((hh - 1) / 2); }
  }
  private onPointerUp(e: PointerEvent): void {
    const d = this.drag; if (!d || e.pointerId !== d.pointerId) return; this.drag = null;
    if (d.active) { // 드래그 놓기
      if (this.sel && this.sel.ax !== null) { const it = getItem(this.run!, this.sel.uid)!; if (checkPlacement(this.run!.grid, this.run!.items, it.id, this.sel.rot, this.sel.ax, this.sel.ay!, it.uid).ok) this.confirmPlace(); else this.renderPrep(); }
      return;
    }
    // 탭
    if (d.origin === 'chip') { this.selectBench(d.uid); return; }
    const cell = this.bagView.cellAt(e.clientX, e.clientY);
    if (cell) this.tapCell(cell);
  }
  private beginDrag(uid: string, from: 'bag' | 'bench'): void {
    const it = getItem(this.run!, uid)!;
    this.sel = { uid, rot: it.rot, ax: null, ay: null, moving: true, from }; this.inspectUid = null; this.anim.lift = { t: 0 }; this.sfx.play('select'); this.renderPrep();
  }
  private selectBench(uid: string): void {
    if (this.run?.phase !== 'prep') return;
    if (this.sel?.uid === uid) { this.sel = null; this.inspectUid = uid; this.renderPrep(); return; }
    const it = getItem(this.run, uid)!;
    this.sel = { uid, rot: it.rot, ax: null, ay: null, moving: true, from: 'bench' }; this.inspectUid = null; this.anim.lift = { t: 0 };
    this.sfx.play('select'); this.renderPrep();
  }
  private tapCell(cell: { x: number; y: number }): void {
    const r = this.run!;
    if (this.sel) {
      const it = getItem(r, this.sel.uid)!;
      // 현재 미리보기가 이 칸을 덮고 유효하면 확정
      if (this.sel.ax !== null) {
        const covers = itemCells({ id: it.id, rot: this.sel.rot, x: this.sel.ax, y: this.sel.ay! }).some(c => c[0] === cell.x && c[1] === cell.y);
        if (covers && checkPlacement(r.grid, r.items, it.id, this.sel.rot, this.sel.ax, this.sel.ay!, it.uid).ok) { this.confirmPlace(); return; }
      }
      // 기준 칸 결정: 누른 칸을 포함하면서 놓을 수 있는 첫 위치, 없으면 누른 칸 자체
      const cells = rotateCells(EQUIPMENT[it.id].shape, this.sel.rot);
      let found: { x: number; y: number } | null = null;
      for (const [cx, cy] of cells) { const ax = cell.x - cx, ay = cell.y - cy; if (checkPlacement(r.grid, r.items, it.id, this.sel.rot, ax, ay, it.uid).ok) { found = { x: ax, y: ay }; break; } }
      this.sel.ax = found ? found.x : cell.x; this.sel.ay = found ? found.y : cell.y;
      if (!found) this.sfx.play('error'); else this.sfx.play('click');
      this.renderPrep(); return;
    }
    const it = itemAt(r.grid, r.items, cell.x, cell.y);
    this.inspectUid = it ? it.uid : null;
    if (it) this.sfx.play('select');
    this.renderPrep(); this.checkTutorial();
  }
  private rotateSel(): void { if (!this.sel) return; this.sel.rot = nextRot(this.sel.rot); this.anim.rotate = { t: 0 }; this.sfx.play('rotate'); this.renderPrep(); }
  private cancelSel(): void { if (!this.sel) return; const uid = this.sel.uid; this.sel = null; this.inspectUid = uid; this.renderPrep(); }
  private moveItem(uid: string, rotate = false): void {
    const it = getItem(this.run!, uid)!; this.sel = { uid, rot: rotate ? nextRot(it.rot) : it.rot, ax: it.x, ay: it.y, moving: true, from: 'bag' }; this.inspectUid = null; this.anim.lift = { t: 0 }; if (rotate) this.anim.rotate = { t: 0 };
    this.sfx.play(rotate ? 'rotate' : 'select'); this.renderPrep();
  }
  private confirmPlace(): void {
    const r = this.run!; const s = this.sel; if (!s || s.ax === null) return;
    const res = placeItem(r, s.uid, s.ax, s.ay!, s.rot);
    if (!res.ok) { this.sfx.play('error'); toast(this.bagArea, res.error); return; }
    this.anim.land = { uid: s.uid, t: 0 }; this.sfx.play('place');
    this.sel = null; this.inspectUid = s.uid; this.persist(); this.renderPrep(); this.checkTutorial();
  }
  private toBenchAction(uid: string): void {
    const res = toBench(this.run!, uid); if (!res.ok) { toast(this.bagArea, res.error); return; }
    this.sel = null; this.inspectUid = uid; this.sfx.play('click'); this.persist(); this.renderPrep();
  }
  private mergeFlow(uid: string): void {
    const r = this.run!; const it = getItem(r, uid)!; const partners = mergePartners(r, uid);
    if (!partners.length) { toast(this.bagArea, '같은 종류·같은 등급 장비가 없습니다'); return; }
    const d = EQUIPMENT[it.id];
    const pick = (p: Item) => {
      const keep = it.loc === 'bag' || p.loc !== 'bag' ? it : p;
      openModal(this.root, { title: '합성 확인', center: true,
        body: h('div', {}, h('div', { class: 'list' }, this.itemRow(it), h('div', { style: 'text-align:center' }, '+'), this.itemRow(p), h('div', { style: 'text-align:center' }, '↓'), h('div', { class: 'row', style: 'border:2px solid #ffca28' }, this.thumb(it.id, (it.grade + 1) as Item['grade'], 0, 40), h('div', { class: 'grow' }, `${d.name} `, h('span', { class: `badge g${it.grade + 1}` }, GRADE_NAMES[(it.grade + 1) as 1 | 2 | 3]), h('div', { class: 'muted' }, d.gradeNotes[Math.min(2, it.grade) as 0 | 1 | 2])))),
          h('p', { class: 'muted' }, `결과는 ${keep.loc === 'bag' ? '가방의 현재 위치' : '작업대'}에 남고 다른 하나는 사라집니다. 모양은 그대로입니다.`)),
        buttons: [{ label: '취소', onClick: () => {} }, { label: '합성', cls: 'primary', onClick: () => {
          const res = mergeItems(r, keep.uid, keep === it ? p.uid : it.uid);
          if (!res.ok) { this.sfx.play('error'); toast(this.bagArea, res.error); return; }
          this.sfx.play('merge'); this.anim.merge = { uid: keep.uid, t: 0 }; this.sel = null; this.inspectUid = keep.uid; this.persist(); this.renderPrep();
        } }] });
    };
    if (partners.length === 1) pick(partners[0]);
    else openModal(this.root, { title: '합성할 장비 선택', center: true, body: h('div', { class: 'list' }, partners.map(p => { const row = this.itemRow(p, true); row.addEventListener('click', () => pick(p)); return row; })) });
  }
  private dismantleFlow(uid: string): void {
    const r = this.run!; const it = getItem(r, uid)!; const refund = dismantleRefund(it.grade);
    openModal(this.root, { title: '분해', center: true, body: h('div', {}, this.itemRow(it), h('p', {}, `분해하면 부품 +${refund}을 받고 장비는 사라집니다.`)), buttons: [{ label: '취소', onClick: () => {} }, { label: `분해 (+${refund})`, cls: 'danger', onClick: () => { const res = dismantleItem(r, uid); if (!res.ok) { toast(this.bagArea, res.error); return; } this.sfx.play('dismantle'); this.sel = null; this.inspectUid = null; this.persist(); this.renderPrep(); this.checkTutorial(); } }] });
  }
  private healAction(): void {
    const r = this.run!; const c = canHeal(r); if (!c.ok) { toast(this.bagArea, c.reason!); return; }
    openModal(this.root, { title: '회복', center: true, body: `부품 ${BALANCE.healCost}을 사용해 체력을 ${Math.round(r.maxHp * BALANCE.healRatio)} 회복합니다. (정비마다 1회)`, buttons: [{ label: '취소', onClick: () => {} }, { label: '회복', cls: 'primary', onClick: () => { const res = heal(r); if (res.ok) { this.sfx.play('heal'); toast(this.bagArea, `체력 +${res.healed}`); this.persist(); this.renderPrep(); } } }] });
  }
  private itemRow(it: Item, clickable = false): HTMLElement {
    const d = EQUIPMENT[it.id];
    return h('div', { class: 'row', style: clickable ? 'cursor:pointer' : '' }, this.thumb(it.id, it.grade, it.rot, 40), h('div', { class: 'grow' }, `${d.name} `, h('span', { class: `badge g${it.grade}` }, GRADE_NAMES[it.grade]), h('div', { class: 'muted' }, it.loc === 'bag' ? `가방 (${it.x + 1}, ${it.y + 1})` : '작업대')), clickable ? h('span', {}, '›') : null);
  }
  private thumb(id: EquipId, grade: Item['grade'], rot: Rot, size: number): HTMLCanvasElement { const cv = h('canvas') as HTMLCanvasElement; renderItemThumb(cv, id, grade, rot, size); return cv; }

  // ---- 해금 ----
  private tapUnlock(cell: { x: number; y: number }): void {
    const r = this.run!; const idx = cell.y * 5 + cell.x; if (!r.grid.locked[idx]) return;
    const c = this.unlockChoice!; const i = c.indexOf(idx);
    if (i >= 0) c.splice(i, 1); else if (c.length < r.pendingUnlock) c.push(idx); else { toast(this.bagArea, `${r.pendingUnlock}칸까지 선택할 수 있습니다`); return; }
    this.sfx.play('click'); this.renderPrep();
  }
  private confirmUnlock(): void {
    const r = this.run!; const res = chooseUnlock(r, this.unlockChoice!); if (!res.ok) { toast(this.bagArea, res.error); return; }
    this.sfx.play('unlock'); this.unlockChoice = null; this.persist(); this.renderPrep(); this.openReward();
  }

  // ---- 보상 ----
  private openReward(): void {
    const r = this.run!; if (r.phase !== 'reward' || !r.reward) return;
    const body = h('div', {});
    const render = () => {
      clear(body);
      body.append(h('div', { class: 'cards' }, r.reward!.candidates.map((c, i) => {
        const d = EQUIPMENT[c.id]; const f = candidateFlags(c, r.items);
        const flags: HTMLElement[] = [];
        if (f.mergeable) flags.push(h('span', { class: 'flag ok' }, '⚗ 합성 가능'));
        if (d.kind === 'support') flags.push(h('span', { class: 'flag ' + (f.hasTarget ? 'ok' : 'no') }, f.hasTarget ? `⟷ 지원 대상: ${f.targetNames.join(', ')}` : `⟷ 현재 ${SUPPORT_TARGET_NAMES[d.support!.type]} 장비 없음`));
        if (d.kind === 'weapon') flags.push(h('span', { class: 'flag ' + (f.hasTarget ? 'ok' : 'no') }, f.hasTarget ? `⟷ 지원 가능: ${f.targetNames.join(', ')}` : '⟷ 연결할 지원 장비 없음'));
        return h('div', { class: 'card' }, this.thumb(c.id, c.grade, 0, 64),
          h('div', { class: 'cbody' }, h('div', { class: 'name' }, d.name, h('span', { class: `badge g${c.grade}` }, GRADE_NAMES[c.grade]), h('span', { class: `badge kind-${d.kind}` }, KIND_NAMES[d.kind]), h('span', { class: 'muted' }, `${d.shape.length}칸`)), h('div', {}, d.short), h('div', {}, ...flags)),
          h('button', { class: 'primary', onClick: () => { const res = pickReward(r, i); if (!res.ok) { toast(this.bagArea, res.error); return; } this.sfx.play('reward'); this.persist(); closeModal(); this.inspectUid = res.item!.uid; if (this.tutorialStep === 4 || (r.tutorial && r.stage === 2 && !this.blob.meta.tutorialDone)) this.tutorialStep = 5; this.renderPrep(); } }, '선택'));
      })));
      body.append(h('div', { class: 'muted', style: 'margin-top:8px;font-size:12px' }, `선택한 장비는 작업대로 갑니다. 부품 ${r.parts} · 새로고침은 보상마다 1회 (부품 ${BALANCE.refreshCost})`));
    };
    render();
    openModal(this.root, { title: `보상 선택 — 구간 ${r.stage - 1} 클리어`, body, closable: false, buttons: [{ label: r.reward.refreshUsed ? '새로고침 사용함' : `새로고침 (⚙${BALANCE.refreshCost})`, keep: true, disabled: r.reward.refreshUsed || r.parts < BALANCE.refreshCost, onClick: () => { const res = refreshReward(r); if (!res.ok) { toast(this.root, res.error); return; } this.sfx.play('click'); this.persist(); closeModal(); this.openReward(); } }] });
  }

  // ---- 출발 ----
  private startFlow(): void {
    const r = this.run!; if (this.starting || r.phase !== 'prep') return;
    if (this.sel) { this.cancelSel(); }
    const chk = checkStart(r);
    if (!chk.ok) { this.sfx.play('error'); toast(this.bagArea, chk.reasons[0]); return; }
    if (chk.bench.length) {
      openModal(this.root, { title: '작업대에 장비가 남아 있습니다', center: true,
        body: h('div', {}, h('p', {}, '다음 전투에는 가방 속 장비만 가져갑니다. 남은 장비를 분해하고 출발할까요?'), h('div', { class: 'list' }, chk.bench.map(it => this.itemRow(it))), h('p', {}, `분해 환급 합계: 부품 +${chk.benchRefund}`)),
        buttons: [{ label: '돌아가서 정리', onClick: () => {} }, { label: `분해하고 출발 (+${chk.benchRefund})`, cls: 'danger', onClick: () => this.doStart() }] });
      return;
    }
    this.doStart();
  }
  private doStart(): void {
    const r = this.run!; if (this.starting || r.phase !== 'prep') return;
    this.starting = true; this.btnStart.disabled = true;
    const res = startBattle(r, true);
    if (!res.ok) { this.starting = false; toast(this.bagArea, res.error); this.renderPrep(); return; }
    const lo = res.loadout!;
    // 도감·발견한 연결 기록
    const m = this.blob.meta;
    for (const it of r.items) if (!m.codex.includes(it.id)) m.codex.push(it.id);
    for (const w of lo.weapons) for (const l of w.links) if (l.applied) { const k = `${w.id}+${l.supportId}`; if (!m.discoveredLinks.includes(k)) m.discoveredLinks.push(k); }
    this.persist();
    this.sfx.play('close');
    // 가방 닫는 연출 후 전투 시작
    const tr = h('div', { id: 'transition' }, h('div', {}, '가방을 닫는 중…'), h('div', { class: 'zip' }), h('div', { class: 'muted', style: 'font-size:12px' }, `구간 ${r.stage} · ${stageDef(r).title}`));
    this.root.appendChild(tr);
    window.setTimeout(() => { tr.remove(); this.beginBattle(lo); this.starting = false; }, 650);
  }

  // ---------------- 전투 ----------------
  private beginBattle(lo: Loadout): void {
    const r = this.run!;
    this.sim = new BattleSim({ loadout: lo, stage: r.battle!.stage, difficulty: r.difficulty, seed: r.battle!.seed, hp: r.hp, maxHp: r.maxHp });
    this.battleView.reset(); this.battleView.shakeOn = this.blob.meta.settings.shake; this.battleView.lowFx = this.blob.meta.settings.lowFx;
    this.paused = false; this.ended = false; this.endTimer = 0; this.acc = 0;
    this.btnShock.disabled = false;
    this.buildWeaponChips(lo);
    clear(this.elBmsg);
    this.showScreen('battle');
    this.renderBattleTop();
    if (r.tutorial && !this.blob.meta.tutorialDone && this.tutorialStep === 4) this.bmsg('배터리 연결: 기관총이 더 빨리 쏩니다. 열도 빨리 쌓이니 하단 열 게이지를 보세요.', 'warn');
    if (stageDef(r).kind === 'boss') this.bmsg('보스: 붉은 점선 원이 보이면 압축 공격 예고 — 보호막이나 충격파로 막으세요.', 'warn');
  }
  private buildWeaponChips(lo: Loadout): void {
    clear(this.elWeapons); this.heatEls.clear();
    for (const w of lo.weapons) {
      const cv = h('canvas') as HTMLCanvasElement; renderItemThumb(cv, w.id, w.grade, 0, 30, { withShape: false });
      const fill = h('div', { class: 'f' }); const st = h('div', { class: 'st' }, w.links.filter(l => l.applied).map(l => EQUIPMENT[l.supportId].name[0]).join('·') || '단독');
      const chip = h('div', { class: 'wchip' }, cv, h('div', { class: 'col' }, h('div', { class: 'nm' }, `${EQUIPMENT[w.id].name} ${w.grade}`), w.heat ? h('div', { class: 'heat' }, fill) : null, st));
      this.elWeapons.append(chip); this.heatEls.set(w.uid, { chip, fill, st });
    }
  }
  private renderBattleTop(): void {
    const r = this.run!; const s = this.sim!; clear(this.elBTop);
    this.elBTop.append(this.hpBar(s.hp, s.maxHp, s.shield), h('div', { class: 'stageinfo' }, `구간 ${r.battle?.stage ?? r.stage}/${BALANCE.stages}`, h('small', {}, `${stageDef(r).title} · ${Math.floor(s.time)}s`)), h('div', { class: 'spacer' }), h('button', { class: 'ghost', 'aria-label': '일시정지', onClick: () => this.togglePause() }, this.paused ? '▶' : '⏸'));
  }
  private bmsg(text: string, cls = ''): void { const m = h('div', { class: 'msg ' + cls }, text); this.elBmsg.append(m); window.setTimeout(() => m.remove(), 4000); while (this.elBmsg.children.length > 3) this.elBmsg.firstChild?.remove(); }
  private useShockwave(): void { if (!this.sim || this.paused || this.ended) return; if (this.sim.useShockwave()) { this.btnShock.disabled = true; this.btnShock.textContent = '충격파 사용함'; } }
  private toggleSpeed(): void { this.speed = this.speed === 1 ? 2 : 1; this.btnSpeed.textContent = `${this.speed}×`; this.sfx.play('click'); }
  private togglePause(): void {
    if (!this.sim || this.ended) return;
    if (this.paused) { closeModal(); this.paused = false; this.sfx.resume(); this.renderBattleTop(); return; }
    this.paused = true; this.renderBattleTop();
    openModal(this.root, { title: '일시정지', center: true, closable: false, body: h('div', {}, h('p', {}, '적·무기·투사체·열·보호 시간·등장·보스 패턴이 모두 멈춥니다.'), h('p', { class: 'muted' }, '전투 중 앱을 닫으면 이 전투의 시작 시점부터 다시 도전합니다.')),
      buttons: [{ label: '계속하기', cls: 'primary', onClick: () => { this.paused = false; this.renderBattleTop(); } }, { label: '설정', keep: true, onClick: () => this.openSettings(() => this.togglePauseMenuAgain()) }, { label: '포기 (전투 시작 시점으로)', cls: 'danger', onClick: () => this.abandonBattle() }] });
  }
  private togglePauseMenuAgain(): void { if (this.paused && this.screen === 'battle') { this.paused = false; this.togglePause(); } }
  private abandonBattle(): void {
    const r = this.run!; const c = restoreCheckpoint(r); this.run = c ?? { ...r, phase: 'prep', battle: null, checkpoint: null };
    this.sim = null; this.paused = false; this.persist(); this.showTitle();
  }
  private onVisibility(): void {
    if (document.hidden) { if (this.screen === 'battle' && this.sim && !this.ended && !this.paused) { this.paused = true; this.renderBattleTop(); this.sfx.suspend(); } return; }
    this.last = 0;
    if (this.screen === 'battle' && this.paused && !isModalOpen() && !this.ended) {
      openModal(this.root, { title: '돌아왔습니다', center: true, closable: false, body: '전투를 일시정지했습니다. 계속할까요?', buttons: [{ label: '계속하기', cls: 'primary', onClick: () => { this.paused = false; this.sfx.resume(); this.renderBattleTop(); } }] });
    }
  }

  private frame(now: number): void {
    requestAnimationFrame(t => this.frame(t));
    if (!this.last) this.last = now;
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.1) dt = 0.1; // 큰 프레임 지연은 잘라낸다 (백그라운드 복귀 등)
    this.time += dt;
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc >= 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    if (this.screen === 'prep' && this.run) {
      for (const k of ['land', 'rotate', 'merge', 'lift'] as const) { const a = this.anim[k]; if (a) { a.t += dt; if (a.t > 0.6) delete this.anim[k]; } }
      { const rc = this.bagCanvas.getBoundingClientRect(); if (this.bagView.W !== Math.floor(rc.width) || this.bagView.H !== Math.floor(rc.height)) this.bagView.resize(); }
      this.bagView.draw({ grid: this.run.grid, items: this.run.items, sel: this.sel, inspectUid: this.inspectUid, unlock: this.unlockChoice ? { chosen: this.unlockChoice, need: this.run.pendingUnlock } : null, anim: this.anim, loadout: this.loadout ?? loadoutOf(this.run), time: this.time });
    } else if (this.screen === 'battle' && this.sim) {
      const sim = this.sim;
      if (!this.paused && !this.ended) {
        this.acc += dt * this.speed; let steps = 0;
        while (this.acc >= STEP && steps < 8) { sim.step(); this.acc -= STEP; steps++; this.handleEvents(); if (sim.over) break; }
        if (steps >= 8) this.acc = 0;
        if (sim.over) { this.ended = true; this.endTimer = 0; this.sfx.play(sim.won ? 'win' : 'lose'); }
      }
      if (!this.paused) { this.battleView.update(dt * (this.ended ? 1 : this.speed)); if (this.ended) { this.endTimer += dt; if (this.endTimer > 1.3) { this.finishBattle(); return; } } }
      { const rc = this.battleCanvas.getBoundingClientRect(); if (this.battleView.W !== Math.floor(rc.width) || this.battleView.H !== Math.floor(rc.height)) this.battleView.resize(sim); }
      this.battleView.draw(sim, { paused: this.paused, won: this.ended && sim.won, lost: this.ended && !sim.won });
      this.updateBattleHud();
    }
  }
  private handleEvents(): void {
    const sim = this.sim!; const evs = sim.drainEvents(); if (!evs.length) return;
    for (const ev of evs) {
      if (ev.type === 'crush_warn') this.bmsg('압축 공격 예고! 보호막·충격파로 막으세요', 'warn');
      if (ev.type === 'boss_phase') this.bmsg(ev.phase === 1 ? '장갑판이 떨어졌다! 보스가 빨라지고 피해를 더 받는다' : '최종 단계! 소환이 잦아진다', 'warn');
      if (ev.type === 'stall_warn') this.bmsg('경고: 전투가 길어지고 있습니다. 곧 적이 강화됩니다.', 'warn');
      if (ev.type === 'enrage') this.bmsg('적 강화 발동', 'warn');
      if (ev.type === 'overheat') { const w = sim.weapons.find(x => x.cfg.uid === ev.weapon); if (w) this.bmsg(`${EQUIPMENT[w.cfg.id].name} 과열! 잠시 냉각`, 'warn'); }
    }
    const sfx = this.battleView.consume(evs, sim);
    for (const s of sfx.slice(0, 4)) this.sfx.play(s);
  }
  private hudTick = 0;
  private updateBattleHud(): void {
    const sim = this.sim!;
    for (const ws of sim.weapons) {
      const el = this.heatEls.get(ws.cfg.uid); if (!el) continue;
      if (ws.cfg.heat) { const p = (ws.heat / ws.cfg.heat.max) * 100; el.fill.style.width = p + '%'; el.chip.classList.toggle('hot', p > 65 && !ws.overheated); el.chip.classList.toggle('overheat', ws.overheated); }
      const st = ws.stat; const parts: string[] = [];
      if (ws.overheated) parts.push('과열 냉각 중'); else if (st.extraShots) parts.push(`추가탄 ${st.extraShots}`); if (st.chains) parts.push(`연쇄 ${st.chains}`); if (!parts.length) parts.push(`피해 ${Math.round(st.damage)}`);
      const txt = parts.join(' · '); if (el.st.textContent !== txt) { el.st.textContent = txt; el.st.classList.toggle('ok', !!(st.extraShots || st.chains) && !ws.overheated); }
    }
    this.hudTick += 1; if (this.hudTick % 10 === 0 && !this.paused) this.renderBattleTop();
  }
  private finishBattle(): void {
    const r = this.run!; const sim = this.sim!; if (!sim.over || r.phase !== 'battle') { this.sim = null; return; }
    const res = sim.result();
    applyBattleResult(r, res);
    this.sim = null; this.ended = false;
    const m = this.blob.meta; const st = r.lastSummary!.stage;
    if (res.won && st > m.bestStage[r.difficulty]) m.bestStage[r.difficulty] = st;
    if (r.tutorial && !m.tutorialDone && this.tutorialStep === 4) this.tutorialStep = 5;
    this.persist();
    this.showSummary();
  }
  private showSummary(): void {
    const r = this.run!; const s = r.lastSummary; if (!s) { this.afterSummary(); return; }
    const st = s.stats; const def = stageDef({ ...r, stage: s.stage } as RunState);
    const rows = Object.values(st.weapons).sort((a, b) => b.damage - a.damage).map(w => h('tr', {}, h('td', {}, `${EQUIPMENT[w.id as EquipId].name} ${w.grade}`), h('td', { class: 'num' }, `${Math.round(w.damage)}`), h('td', { class: 'num' }, `${w.shots}`), h('td', { class: 'num' }, w.extraShots ? `${w.extraShots}` : '–'), h('td', { class: 'num' }, w.chains ? `${w.chains}` : '–'), h('td', { class: 'num' }, w.overheatTime > 0 ? `${w.overheatTime.toFixed(1)}s` : '–')));
    const body = h('div', {},
      h('p', {}, `${def.title} · ${st.duration.toFixed(1)}초 · 처치 ${st.kills}/${st.spawned}${st.enraged ? ' · 적 강화 발동' : ''}`),
      h('table', {}, h('tr', {}, h('th', {}, '무기'), h('th', { class: 'num' }, '피해'), h('th', { class: 'num' }, '발사'), h('th', { class: 'num' }, '추가탄'), h('th', { class: 'num' }, '연쇄'), h('th', { class: 'num' }, '과열')), ...rows),
      h('p', {}, `받은 피해 ${Math.round(st.damageTaken)} (체력 ${s.hpBefore} → ${s.hpAfter - s.healed})${st.shieldStart ? ` · 보호막 ${st.shieldStart} 중 ${Math.round(st.shieldAbsorbed)} 흡수` : ''}${st.protectedDamage ? ` · 충격파 보호로 ${Math.round(st.protectedDamage)} 무효` : ''}${st.shockwaveUsed ? ` · 충격파 ${st.shockwavePushed}기 밀어냄` : ''}`),
      s.won ? h('p', { class: 'ok', style: 'color:#a5d6a7' }, `클리어! 부품 +${s.partsGained}${s.healed ? ` · 구급팩 회복 +${s.healed}` : ''} → 체력 ${s.hpAfter}`) : h('p', { style: 'color:#ef9a9a' }, '패배…'),
    );
    openModal(this.root, { title: s.won ? `구간 ${s.stage} 클리어` : `구간 ${s.stage} 패배`, body, closable: false, center: true, buttons: [{ label: '다음', cls: 'primary', onClick: () => { r.summarySeen = true; this.persist(); this.afterSummary(); } }] });
  }
  private afterSummary(): void {
    const r = this.run!;
    if (r.phase === 'result') { this.showResult(); return; }
    this.enterPrep();
  }

  // ---------------- 결과 ----------------
  private showResult(): void {
    const r = this.run!; closeModal(); const el = this.elResult; clear(el);
    const m = this.blob.meta; const won = !!r.result?.won;
    if (!r.resultRecorded) {
      r.resultRecorded = true;
      if (won) { m.clears[r.difficulty]++; m.hardUnlocked = true; }
      const reached = r.result?.stage ?? r.stage; if (reached > m.bestStage[r.difficulty]) m.bestStage[r.difficulty] = reached;
      m.history.unshift({ date: Date.now(), difficulty: r.difficulty, stage: reached, won, seed: r.seed }); m.history = m.history.slice(0, 20);
      if (r.tutorial) m.tutorialDone = true;
      this.persist();
    }
    const s = r.lastSummary;
    el.append(
      h('h1', { class: won ? 'win' : 'lose' }, won ? '승리!' : '패배'),
      h('div', { class: 'muted' }, won ? '거대 고철 수거기를 처치했습니다.' : `구간 ${r.result?.stage ?? r.stage}에서 쓰러졌습니다.`),
      h('div', { class: 'box' },
        h('div', {}, `난이도: ${DIFFICULTY_NAMES[r.difficulty]} · 도달 구간: ${r.result?.stage ?? r.stage}/12`),
        h('div', {}, `이 판에서 받은 총 피해: ${Math.round(r.totalDamageTaken)} · 남은 부품 ${r.parts}`),
        h('div', {}, '마지막 가방: ' + (bagItems(r).map(i => `${EQUIPMENT[i.id].name}${i.grade}`).join(', ') || '없음')),
        s && !won ? h('div', { style: 'margin-top:6px;color:#ffe082' }, this.loseHint(r)) : null,
        won ? h('div', { style: 'margin-top:6px;color:#ffe082' }, m.hardUnlocked && r.difficulty === 'normal' ? '어려움 난이도가 해금되었습니다.' : '') : null,
      ),
      h('div', { class: 'menu' },
        h('button', { class: 'primary', onClick: () => { this.run = createRun(newSeed(), r.difficulty, false); this.tutorialStep = 0; this.blob.meta.runs++; this.persist(); this.enterPrep(); } }, `다시 도전 (${DIFFICULTY_NAMES[r.difficulty]})`),
        h('button', { onClick: () => this.showTitle() }, '타이틀로'),
      ),
    );
    this.showScreen('result');
  }
  private loseHint(r: RunState): string {
    const s = r.lastSummary!; const st = s.stats; const def = stageDef({ ...r, stage: s.stage } as RunState);
    const lo = bagItems(r);
    if (def.threats.some(t => t.includes('장갑')) && lo.every(i => ['mg', 'dagger', 'shotgun'].includes(i.id) || EQUIPMENT[i.id].kind !== 'weapon')) return '힌트: 장갑 적은 피격당 피해를 줄입니다. 레이저·폭탄처럼 한 방이 큰 무기가 유리합니다.';
    if (def.threats.some(t => t.includes('몰려') || t.includes('군집')) && !lo.some(i => ['bomb', 'shotgun', 'laser', 'dagger'].includes(i.id))) return '힌트: 작은 적 무리에는 범위 공격(산탄총·폭탄·단검)이나 연쇄(공명 렌즈)가 효과적입니다.';
    if (!lo.some(i => i.id === 'shield') && st.damageTaken > 40) return '힌트: 받은 피해가 큽니다. 방패판으로 보호막을 얻거나 충격파를 위험한 순간에 쓰세요.';
    const oh = Object.values(st.weapons).reduce((a, w) => a + w.overheatTime, 0);
    if (oh > st.duration * 0.3) return '힌트: 과열로 멈춘 시간이 깁니다. 냉각기를 과열 무기 옆에 붙여 보세요.';
    return '힌트: 다음 위협 표시를 보고 무기와 생존 장비의 배치를 바꿔 보세요.';
  }

  // ---------------- 메뉴/설정/도감/도움말 ----------------
  private openPrepMenu(): void {
    openModal(this.root, { title: '메뉴', center: true, body: h('div', { class: 'muted' }, this.saveStatus ? `⚠ ${this.saveStatus}` : '확정한 행동은 자동 저장되었습니다.'), buttons: [{ label: '설정', onClick: () => this.openSettings() }, { label: '도움말', onClick: () => this.openHelp() }, { label: '타이틀로', onClick: () => this.showTitle() }] });
  }
  private openSettings(onClose?: () => void): void {
    const st = this.blob.meta.settings;
    const vol = h('input', { type: 'range', min: 0, max: 100, value: Math.round(st.sfx * 100) }) as HTMLInputElement;
    vol.addEventListener('input', () => { st.sfx = Number(vol.value) / 100; this.sfx.setVolume(st.sfx, st.muted); });
    vol.addEventListener('change', () => { this.persist(); this.sfx.play('click'); });
    const cb = (key: 'muted' | 'shake' | 'lowFx') => { const c = h('input', { type: 'checkbox', checked: st[key] }) as HTMLInputElement; c.addEventListener('change', () => { st[key] = c.checked; this.sfx.setVolume(st.sfx, st.muted); this.battleView.shakeOn = st.shake; this.battleView.lowFx = st.lowFx; this.persist(); }); return c; };
    openModal(this.root, { title: '설정', center: true, onClose,
      body: h('div', {},
        h('div', { class: 'setting' }, h('div', { class: 'lbl' }, '효과음 음량'), vol),
        h('div', { class: 'setting' }, h('div', { class: 'lbl' }, '음소거'), cb('muted')),
        h('div', { class: 'setting' }, h('div', { class: 'lbl' }, '화면 흔들림'), cb('shake')),
        h('div', { class: 'setting' }, h('div', { class: 'lbl' }, '효과 줄이기 (파티클 절반)'), cb('lowFx')),
        h('div', { class: 'setting' }, h('div', { class: 'lbl' }, '이어하기 정책', h('div', { class: 'muted', style: 'font-size:11px' }, '정리·보상 단계의 확정 행동은 즉시 저장. 전투 중 나가면 그 전투 시작 시점부터 재도전.'))),
        h('div', { class: 'setting' }, h('div', { class: 'lbl' }, '저장소', h('div', { class: 'muted', style: 'font-size:11px' }, storageInfo.available ? '이 브라우저의 localStorage' : '사용 불가: ' + storageInfo.reason))),
        h('div', { class: 'setting' }, h('div', { class: 'lbl' }, '저장 초기화', h('div', { class: 'muted', style: 'font-size:11px' }, '진행 중인 판·기록·도감·설정을 모두 지웁니다')), h('button', { class: 'danger small', onClick: () => this.resetFlow() }, '초기화')),
      ),
      buttons: [{ label: '닫기', cls: 'primary', onClick: () => onClose?.() }] });
  }
  private resetFlow(): void {
    openModal(this.root, { title: '정말 초기화할까요?', center: true, body: '되돌릴 수 없습니다.', buttons: [{ label: '취소', onClick: () => this.openSettings() }, { label: '모두 지우기', cls: 'danger', onClick: () => { resetAll(); const l = load(); this.blob = l.blob; this.run = null; this.sim = null; this.tutorialStep = 0; this.sfx.setVolume(this.blob.meta.settings.sfx, false); this.showTitle(); } }] });
  }
  private openCodex(): void {
    const m = this.blob.meta;
    const ents = (Object.keys(EQUIPMENT) as EquipId[]).map(id => { const d = EQUIPMENT[id]; const known = m.codex.includes(id); const cv = h('canvas') as HTMLCanvasElement; renderItemThumb(cv, id, 1, 0, 44); return h('div', { class: 'ent' + (known ? '' : ' locked') }, cv, h('div', {}, h('b', {}, known ? d.name : '???'), h('div', { class: 'muted' }, known ? d.short : `${d.shape.length}칸 · ${KIND_NAMES[d.kind]}`))); });
    const links = m.discoveredLinks.length ? m.discoveredLinks.map(k => { const [w, s] = k.split('+') as EquipId[]; return h('li', {}, `${EQUIPMENT[w].name} + ${EQUIPMENT[s].name}: ${EQUIPMENT[s].short}`); }) : [h('li', { class: 'muted' }, '아직 발견한 연결이 없습니다. 지원 장비를 무기 옆에 붙이고 출발하면 기록됩니다.')];
    openModal(this.root, { title: '장비 도감', body: h('div', {}, h('div', { class: 'codex' }, ents), h('h3', { style: 'margin:12px 0 4px;font-size:14px;color:#ffb300' }, `발견한 인접 효과 (${m.discoveredLinks.length})`), h('ul', { style: 'padding-left:18px;margin:0' }, links), h('h3', { style: 'margin:12px 0 4px;font-size:14px;color:#ffb300' }, '최근 기록'), h('ul', { style: 'padding-left:18px;margin:0' }, m.history.length ? m.history.slice(0, 8).map(r => h('li', {}, `${new Date(r.date).toLocaleDateString()} · ${DIFFICULTY_NAMES[r.difficulty]} · ${r.won ? '승리' : `구간 ${r.stage} 패배`}`)) : [h('li', { class: 'muted' }, '기록 없음')])) });
  }
  private openHelp(): void {
    openModal(this.root, { title: '도움말', body: h('div', { class: 'help' },
      h('h3', {}, '한 판의 흐름'), h('p', {}, '12개 전투 구간. 4·8구간은 정예, 12구간은 보스. 전투 후 장비 후보 3개 중 1개를 고르고 가방을 정리한 뒤 "가방 닫고 출발".'),
      h('h3', {}, '가방'), h('p', {}, '5×5 격자, 처음엔 모서리 4칸이 잠겨 21칸. 정예 클리어 시 해금. 장비는 실제 점유 칸 기준으로 배치되며 90도 회전 가능. 작업대 장비는 전투에 가져가지 않습니다.'),
      h('h3', {}, '조작'), h('ul', {}, h('li', {}, '작업대 장비 누르기 → 가방 칸 누르기(미리보기) → 같은 자리 다시 누르기 또는 "배치 확정"'), h('li', {}, '가방 속 장비 누르기 → 이동·회전·합성·분해·작업대로'), h('li', {}, '드래그로도 옮길 수 있습니다')),
      h('h3', {}, '인접 효과'), h('p', {}, '실제 점유 칸이 상하좌우로 맞닿은 무기와 지원 장비만 연결됩니다(대각선 제외). 같은 종류의 지원은 가장 강한 하나만, 다른 종류는 함께 적용.'),
      h('ul', {}, h('li', {}, '배터리 → 기계(기관총·레이저·드론): 공격 간격 단축. 과열도 빨라짐'), h('li', {}, '냉각기 → 과열(기관총·레이저): 열 방출 증가'), h('li', {}, '탄약상자 → 탄도(기관총·산탄총·폭탄): 일정 발사마다 추가 탄'), h('li', {}, '공명 렌즈 → 에너지(레이저·드론): 적중 시 다른 적 1명에게 연쇄')),
      h('h3', {}, '전투'), h('p', {}, '자동 전투. 긴급 충격파는 전투마다 1회: 적을 밀어내고 잠시 보호. 1×/2× 배속, 일시정지 가능. 교착이 길어지면 경고 후 적이 강화됩니다.'),
      h('h3', {}, '합성·부품'), h('p', {}, '같은 종류·같은 등급 2개 → 한 등급 위(최대 3등급, 모양 유지). 부품은 후보 새로고침(3)과 정비마다 1회 회복(6)에 씁니다. 분해 환급 1/2/4.'),
      h('h3', {}, '저장'), h('p', {}, '확정한 행동은 자동 저장. 전투 중 나가면 그 전투 시작 시점부터 재도전합니다.'),
      h('p', { class: 'muted' }, h('button', { class: 'small', onClick: () => { closeModal(); this.newRunFlow('normal', true); } }, '튜토리얼 다시 보기')),
    ) });
  }

  // ---------------- 튜토리얼 ----------------
  private renderTutor(): void {
    const r = this.run!; const el = this.elTutor;
    if (!r.tutorial || this.blob.meta.tutorialDone || this.tutorialStep <= 0 || this.tutorialStep > 5) { el.classList.add('hidden'); return; }
    const texts: Record<number, string> = {
      1: '작업대의 기관총을 누른 뒤, 가방 칸을 눌러 놓아 보세요. (같은 자리 다시 누르기 = 확정)',
      2: '배터리를 기관총과 상하좌우로 맞닿게 놓으세요. 맞닿은 변에 노란 연결 표시가 생깁니다.',
      3: '가방 속 기관총을 눌러 연결을 확인하세요. 공격 간격이 실제로 짧아졌습니다.',
      4: '나머지 장비도 넣고 "가방 닫고 출발"을 누르세요. 전투에서 기관총이 더 빨리 쏘는지, 열 게이지가 어떻게 되는지 보세요.',
      5: '새 장비를 받았습니다. ↻ 회전하거나 기존 장비를 옮겨서 공간을 만들어 넣어 보세요.',
    };
    el.classList.remove('hidden'); clear(el);
    el.append(h('span', { class: 'step' }, `${this.tutorialStep}/5`), h('span', { class: 'txt' }, texts[this.tutorialStep]), h('button', { class: 'ghost', onClick: () => { this.blob.meta.tutorialDone = true; this.tutorialStep = 0; this.persist(); this.renderPrep(); } }, '건너뛰기'));
  }
  private checkTutorial(): void {
    const r = this.run; if (!r || !r.tutorial || this.blob.meta.tutorialDone || !this.tutorialStep) return;
    const mg = r.items.find(i => i.id === 'mg'); const bat = r.items.find(i => i.id === 'battery');
    const lo = loadoutOf(r); const mgW = mg ? lo.weapons.find(w => w.uid === mg.uid) : undefined;
    const linked = !!mgW && mgW.links.some(l => l.applied && l.type === 'battery');
    let step = this.tutorialStep;
    if (step === 1 && mg?.loc === 'bag') step = 2;
    if (step === 2 && (linked || !bat)) step = 3;
    if (step === 3 && (this.inspectUid === mg?.uid || !mg)) step = 4;
    if (step === 5 && r.stage >= 2) { const newest = r.items[r.items.length - 1]; if (!newest || newest.loc === 'bag' || r.items.length < 4) { this.blob.meta.tutorialDone = true; step = 0; this.persist(); } }
    if (step !== this.tutorialStep) { this.tutorialStep = step; this.renderTutor(); }
  }
}
