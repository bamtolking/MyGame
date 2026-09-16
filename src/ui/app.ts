import type { GameState, Unit, SimEvent, Grade, MythicId } from '../sim/types';
import { GRADE_NAMES } from '../sim/types';
import { newGame, unitById, unitLabel, skillCooldownMax } from '../sim/state';
import { step, dispatch, serialize, deserialize, DT, type Action } from '../sim/engine';
import { currentSummonCost, currentOdds, canSummon, sellValue } from '../sim/roster';
import { Renderer } from '../render/renderer';
import { Audio } from '../platform/audio';
import * as store from '../platform/storage';
import { h, $, clear, fmtTime } from './dom';
import { summonPanel, mergePanel, mythicPanel, upgradePanel, unitInfo, relicPanel, resultPanel, codexPanel, enemyGuide, spriteImg, gradeBadge } from './panels';
import { UNITS, MYTHICS } from '../data/units';
import { SLOTS } from '../data/map';
import { TOTAL_WAVES, WAVES } from '../data/waves';
import { ENEMIES } from '../data/enemies';
import { EXTRA_ORDER_WAVES } from '../data/economy';
import { RELIC_BY_ID } from '../data/relics';

const MAX_STEPS_PER_FRAME = 8;

export class App {
  root: HTMLElement;
  state: GameState | null = null;
  renderer!: Renderer;
  audio = new Audio();
  blob: store.SaveBlob;
  speed = 1; paused = false; acc = 0; lastT = 0; running = false;
  lastPhase = '';
  msgQueue: { text: string; kind: string; until: number }[] = [];
  hintStage = 0;
  selected: number | null = null;
  drag: { id: number; x0: number; y0: number; moved: boolean } | null = null;
  sheetOpen: string | null = null;
  mergeSel = new Set<number>(); mergeTab = { g: 0 as Grade };
  saveStatus = ''; lastSaveOk = false;
  fps = 0; frames = 0; fpsT = 0;
  bgm = false;

  constructor(root: HTMLElement) {
    this.root = root;
    const l = store.load(); this.blob = l.blob;
    if (l.error) setTimeout(() => alert(l.error), 100);
    this.showTitle();
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state && !this.paused && this.state.phase !== 'won' && this.state.phase !== 'lost') this.setPaused(true, true); });
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 200));
  }

  // ---------- Title ----------
  showTitle(): void {
    this.running = false; this.state = null; this.audio.stopBgm();
    clear(this.root);
    const m = this.blob.meta;
    const hasRun = !!this.blob.run;
    const seedInput = h('input', { type: 'number', placeholder: '시드 (비우면 무작위)', inputmode: 'numeric' }) as HTMLInputElement;
    const t = h('div', { id: 'title' },
      h('div', { class: 'lantern' }, '🏮'),
      h('h1', {}, h('small', {}, '랜덤 합성 디펜스 · 베타'), '대박수비대', h('br'), '합성 대폭주'),
      h('div', { class: 'sub' }, '뽑힌 것은 운, 무엇을 남기고 어디에 놓고 언제 합칠지는 실력. 도깨비 야시장의 보물 창고를 40웨이브 동안 지키세요.'),
      h('div', { class: 'menu' },
        hasRun ? h('button', { class: 'primary', onclick: () => this.resumeRun() }, `이어하기 (웨이브 ${this.blob.runWave})`) : null,
        h('button', { class: hasRun ? '' : 'primary', onclick: () => { const v = seedInput.value.trim(); this.newRun(v ? (parseInt(v, 10) >>> 0) : ((Math.random() * 2 ** 32) >>> 0)); } }, '새 게임 (보통)'),
        seedInput,
        h('div', { class: 'row' }, h('button', { onclick: () => this.openSheet('codex') }, '도감·기록'), h('button', { onclick: () => this.openSheet('guide') }, '적 도감'), h('button', { onclick: () => this.openSheet('settings') }, '설정')),
        h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => this.openSheet('export') }, '내보내기/불러오기')),
      ),
      h('div', { class: 'foot' }, `저장소: ${store.storageInfo.available ? '브라우저 로컬 저장 사용 가능' : '⚠ 브라우저 저장 불가(' + store.storageInfo.reason + ') — 내보내기 권장'}`, h('br'), `기록: 최고 W${m.records.bestWave} · 승리 ${m.records.wins}/${m.records.runs}판 · 싱글 플레이 · 온라인 기능 없음`, h('br'), 'v0.1.0-beta.1'),
    );
    this.root.append(t);
    this.root.append(h('div', { id: 'sheet', class: 'hidden' }), h('div', { id: 'modal', class: 'hidden' }));
  }

  // ---------- Run lifecycle ----------
  newRun(seed: number): void {
    this.audio.unlock();
    this.state = newGame(seed);
    this.startGame();
    this.blob.meta.records.runs++; this.saveAll();
  }
  resumeRun(): void {
    this.audio.unlock();
    try {
      const s = deserialize(this.blob.run!);
      if (s.phase === 'prep') { s.prepT = s.prepMax; }
      this.state = s; this.startGame();
      this.toast(`웨이브 ${s.wave} 시작 시점에서 이어합니다`, 'good');
    } catch (e) { alert('이어하기 실패: ' + (e as Error).message); this.blob.run = null; this.saveAll(); this.showTitle(); }
  }
  retryRun(sameSeed: boolean): void {
    const seed = sameSeed && this.state ? this.state.seed : ((Math.random() * 2 ** 32) >>> 0);
    this.blob.run = null; this.saveAll();
    this.newRun(seed);
  }

  startGame(): void {
    clear(this.root); this.buildGameDom(); this.layout();
    this.speed = 1; this.paused = false; this.acc = 0; this.lastT = performance.now(); this.selected = null; this.hintStage = this.state!.wave > 1 ? 99 : 0; this.lastPhase = '';
    this.renderer.fx.reduceMotion = this.blob.meta.settings.reduceMotion; this.renderer.dmg.enabled = this.blob.meta.settings.dmgNumbers; this.renderer.lowFx = this.blob.meta.settings.lowFx; this.renderer.fx.quality = this.blob.meta.settings.lowFx ? 0.4 : 1;
    this.audio.setVolumes(this.blob.meta.settings.sfx, this.blob.meta.settings.bgm); this.audio.startBgm();
    if (!this.running) { this.running = true; requestAnimationFrame(t => this.frame(t)); }
    this.updateHud();
  }

  buildGameDom(): void {
    const g = h('div', { id: 'game' },
      h('div', { id: 'topbar' },
        h('span', { class: 'stat', id: 'st-life' }, '♥ 20'), h('span', { class: 'stat', id: 'st-gold' }, '◆ 0'), h('span', { class: 'stat', id: 'st-shards', title: '운명 조각' }, '🧩 0'), h('span', { class: 'stat', id: 'st-cores', title: '공방 핵' }, '🔮 0'),
        h('span', { class: 'spacer' }),
        h('div', { id: 'wave-info' }, h('span', { id: 'st-wave' }, 'W 1/40'), h('small', { id: 'st-sub' }, '')),
        h('button', { id: 'btn-speed', onclick: () => this.toggleSpeed() }, '1×'),
        h('button', { id: 'btn-pause', onclick: () => this.setPaused(true) }, '⏸'),
      ),
      h('div', { id: 'field' }, h('canvas', { id: 'cv' }), h('div', { id: 'msgbar' }), h('div', { id: 'hint', class: 'hidden' }), h('div', { id: 'prepbar', class: 'hidden' }), h('div', { id: 'extra-offer', class: 'hidden' }), h('button', { id: 'skillcancel', class: 'hidden', onclick: () => this.setSkillMode(null) }, '스킬 취소')),
      h('div', { id: 'bottombar' },
        h('div', { id: 'unitpanel', class: 'hidden' }),
        h('div', { id: 'actions' },
          h('button', { id: 'btn-summon', class: 'primary', onclick: () => this.doSummon() }, '소환', h('small', { id: 'summon-cost' }, '30')),
          h('button', { id: 'btn-merge', onclick: () => this.openSheet('merge') }, '합성', h('small', {}, '3개→승급')),
          h('button', { id: 'btn-mythic', onclick: () => this.openSheet('mythic') }, '신화', h('small', {}, '레시피')),
          h('button', { id: 'btn-upgrade', onclick: () => this.openSheet('upgrade') }, '강화', h('small', {}, '골드 사용')),
        ),
        h('div', { id: 'row2' },
          h('div', { id: 'bench' }, ...[0, 1, 2].map(i => h('button', { class: 'benchslot', 'data-idx': i, onclick: () => this.tapBench(i) }))),
          h('div', { id: 'skills' },
            h('button', { id: 'btn-bomb', onclick: () => this.setSkillMode(this.renderer.view.skillMode === 'bomb' ? null : 'bomb') }, '💥 포격', h('small', {}, '범위 피해'), h('div', { class: 'cd' })),
            h('button', { id: 'btn-freeze', onclick: () => this.setSkillMode(this.renderer.view.skillMode === 'freeze' ? null : 'freeze') }, '❄ 냉각', h('small', {}, '빙결·감속'), h('div', { class: 'cd' })),
            h('button', { id: 'btn-odds', style: 'flex:0.5;font-size:16px', title: '소환 확률', onclick: () => this.openSheet('summon') }, '%'),
          ),
        ),
      ),
      h('div', { id: 'sheet', class: 'hidden' }), h('div', { id: 'modal', class: 'hidden' }),
    );
    this.root.append(g);
    const cv = $('cv') as HTMLCanvasElement;
    this.renderer = new Renderer(cv);
    this.renderer.onEvent = e => this.onSimEvent(e);
    cv.addEventListener('pointerdown', e => this.onPointerDown(e));
    cv.addEventListener('pointermove', e => this.onPointerMove(e));
    cv.addEventListener('pointerup', e => this.onPointerUp(e));
    cv.addEventListener('pointercancel', () => { this.drag = null; this.renderer.view.hoverSlot = null; });
  }

  layout(): void {
    if (!this.state) return;
    const field = $('field'); const r = field.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    this.renderer.resize(r.width, r.height);
  }

  // ---------- Loop ----------
  frame(now: number): void {
    if (!this.running || !this.state) return;
    const s = this.state;
    let real = (now - this.lastT) / 1000; this.lastT = now;
    if (real > 0.1) real = 0.1; // never advance a long time (background / hiccup)
    const worldRunning = !this.paused && s.phase !== 'relic' && s.phase !== 'won' && s.phase !== 'lost' && !this.sheetOpen;
    if (worldRunning) this.acc += real * this.speed;
    let n = 0;
    while (this.acc >= DT && n < MAX_STEPS_PER_FRAME) { step(s, DT); this.acc -= DT; n++; }
    if (n >= MAX_STEPS_PER_FRAME) this.acc = 0;
    this.renderer.consumeEvents(s);
    this.checkPhase();
    this.renderer.draw(s, real);
    this.updateHud();
    this.audio.tick();
    this.frames++; this.fpsT += real; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    requestAnimationFrame(t => this.frame(t));
  }

  checkPhase(): void {
    const s = this.state!;
    if (s.phase !== this.lastPhase) {
      const prev = this.lastPhase; this.lastPhase = s.phase;
      if (s.phase === 'prep' || s.phase === 'relic') this.saveRun();
      if (s.phase === 'relic') this.showModal(relicPanel(s, a => { this.act(a); this.hideModal(); }), '유물 선택', false);
      if (s.phase === 'won' || s.phase === 'lost') this.finishRun(s.phase === 'won');
      if (s.phase === 'wave' && prev) this.setSkillMode(null);
    }
    // meta codex tracking (cheap)
    const cx = this.blob.meta.codex;
    for (const u of s.units) { const k = u.mythic ? null : `${u.kind}@${u.grade}`; if (k && !cx.units.includes(k)) cx.units.push(k); if (u.mythic && !cx.mythics.includes(u.mythic)) cx.mythics.push(u.mythic); }
    for (const e of s.seenEnemies) if (!cx.enemies.includes(e)) cx.enemies.push(e);
    for (const r of s.relics) if (!cx.relics.includes(r)) cx.relics.push(r);
  }

  onSimEvent(e: SimEvent): void {
    const a = this.audio;
    switch (e.t) {
      case 'msg': this.toast(e.text, e.kind || 'info'); break;
      case 'shoot': a.play('shoot_' + (e.kind === 'suntele' ? 'cracker' : e.kind === 'pulse' ? 'pulse' : e.kind)); break;
      case 'explode': a.play(e.kind === 'sun' || e.kind === 'bomb' || e.kind === 'gravity' ? 'explode_big' : e.kind === 'heal' ? 'gold' : 'explode'); break;
      case 'chain': if (e.conducted) a.play('freeze'); break;
      case 'die': a.play(e.boss ? 'die_boss' : 'die'); break;
      case 'exit': a.play('exit'); break;
      case 'summon': { const g = e.grade; a.play(g >= 3 ? 'summon_legend' : g === 2 ? 'summon_hero' : g === 1 ? 'summon_rare' : 'summon'); this.showSummonResult(e.unit); break; }
      case 'merge': a.play('merge'); if (this.hintStage === 2) this.hintStage = 3; break;
      case 'mythic': a.play('mythic'); this.toast(`✨ 신화 완성: ${MYTHICS[e.id].name} — ${MYTHICS[e.id].desc}`, 'good', 6); break;
      case 'wave': a.play('wave'); break;
      case 'boss': a.play('boss'); break;
      case 'relic': a.play('relic'); break;
      case 'skill': a.play(e.kind === 'freeze' ? 'freeze' : 'explode_big'); break;
      case 'seal': a.play('seal'); break;
      case 'won': a.play('win'); break;
      case 'lost': a.play('lose'); break;
      case 'levelup': a.play('relic'); break;
      default: break;
    }
  }

  // ---------- Actions ----------
  act(a: Action): ReturnType<typeof dispatch> {
    const s = this.state!; const r = dispatch(s, a);
    if (!r.ok) { this.toast(r.error, 'warn'); this.audio.play('error'); }
    this.renderer.consumeEvents(s); this.updateHud();
    return r;
  }
  doSummon(): void {
    const s = this.state!; const c = canSummon(s);
    if (!c.ok) { this.toast(c.error, 'warn'); this.audio.play('error'); return; }
    const r = this.act({ type: 'summon' });
    if (r.ok && this.hintStage === 0) this.hintStage = 1;
  }
  showSummonResult(unitId: number): void {
    const s = this.state!; const u = unitById(s, unitId); if (!u) return;
    const fast = this.blob.meta.settings.fastSummon;
    if (u.grade >= 2 || !fast) {
      const el = h('div', { class: 'msg good', style: 'display:flex;align-items:center;gap:8px;border-color:' + ['#9e9e9e', '#42a5f5', '#ab47bc', '#ffb300'][u.grade] }, spriteImg(u, 32), h('span', {}, gradeBadge(u.grade), ` ${UNITS[u.kind].name} — ${UNITS[u.kind].role}`, s.lastResult?.pityUsed ? ' (불운 보정)' : '', s.lastResult?.designated ? ' (종류 지정)' : ''));
      this.pushMsgEl(el, u.grade >= 2 ? 3.5 : 1.6);
    }
    // auto-select newly summoned bench unit for quick placement
    if (u.loc.t === 'b') this.select(u.id);
  }
  toggleSpeed(): void { this.speed = this.speed === 1 ? 2 : 1; $('btn-speed').textContent = `${this.speed}×`; this.audio.play('click'); }
  setPaused(p: boolean, auto = false): void {
    this.paused = p;
    if (p) { this.audio.suspend(); this.showModal(this.pausePanel(auto), '일시정지', true, () => this.setPaused(false)); }
    else { this.audio.resume(); this.hideModal(); this.lastT = performance.now(); this.acc = 0; }
  }
  setSkillMode(m: 'bomb' | 'freeze' | null): void {
    const v = this.renderer.view; const s = this.state!;
    if (m && s.skills[m] > 0) { this.toast(`재사용 대기 ${Math.ceil(s.skills[m])}초`, 'warn'); m = null; }
    v.skillMode = m; v.skillX = 200; v.skillY = 300;
    if (m) { this.select(null); this.audio.play('click'); }
    $('skillcancel').classList.toggle('hidden', !m);
    $('btn-bomb').classList.toggle('armed', m === 'bomb'); $('btn-freeze').classList.toggle('armed', m === 'freeze');
  }

  // ---------- Input ----------
  private ptr(e: PointerEvent): [number, number] { const r = this.renderer.canvas.getBoundingClientRect(); return this.renderer.toField(e.clientX - r.left, e.clientY - r.top); }
  onPointerDown(e: PointerEvent): void {
    if (!this.state) return; this.audio.unlock();
    const [fx, fy] = this.ptr(e); const v = this.renderer.view;
    if (v.skillMode) { v.skillX = fx; v.skillY = fy; return; }
    const slot = this.renderer.slotAt(fx, fy);
    if (slot != null && this.state.slots[slot] != null) { this.drag = { id: this.state.slots[slot]!, x0: fx, y0: fy, moved: false }; try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ } }
  }
  onPointerMove(e: PointerEvent): void {
    if (!this.state) return; const [fx, fy] = this.ptr(e); const v = this.renderer.view;
    if (v.skillMode) { if (e.buttons || e.pointerType === 'touch') { v.skillX = fx; v.skillY = fy; } return; }
    if (this.drag) { if (Math.hypot(fx - this.drag.x0, fy - this.drag.y0) > 12) { this.drag.moved = true; if (this.selected !== this.drag.id) this.select(this.drag.id); } if (this.drag.moved) v.hoverSlot = this.renderer.slotAt(fx, fy); }
  }
  onPointerUp(e: PointerEvent): void {
    if (!this.state) return; const s = this.state; const [fx, fy] = this.ptr(e); const v = this.renderer.view;
    if (v.skillMode) { const m = v.skillMode; v.skillMode = null; this.setSkillMode(null); const r = this.act({ type: 'skill', kind: m, x: Math.max(0, Math.min(400, fx)), y: Math.max(0, Math.min(600, fy)) }); if (r.ok) this.audio.play('skill'); return; }
    const slot = this.renderer.slotAt(fx, fy);
    const dragged = this.drag; this.drag = null; v.hoverSlot = null;
    if (dragged && dragged.moved) { if (slot != null && slot !== this.slotOf(dragged.id)) this.tryMove(dragged.id, slot); return; }
    // tap
    if (slot == null) { this.select(null); return; }
    const occ = s.slots[slot];
    if (this.selected != null) {
      if (occ === this.selected) { this.select(null); return; }
      this.tryMove(this.selected, slot); return;
    }
    if (occ != null) this.select(occ);
  }
  slotOf(id: number): number | null { const u = unitById(this.state!, id); return u && u.loc.t === 'f' ? u.loc.slot : null; }
  tryMove(id: number, slot: number): void {
    const s = this.state!; const occ = s.slots[slot];
    const r = this.act({ type: 'move', id, to: { t: 'f', slot } });
    if (r.ok) { this.audio.play('click'); if (this.hintStage === 1) this.hintStage = 2; if (occ != null) this.toast('자리를 교환했습니다', 'info', 1.2); this.select(null); }
  }
  tapBench(i: number): void {
    const s = this.state!; const id = s.bench[i];
    if (this.selected != null && id == null) { const r = this.act({ type: 'move', id: this.selected, to: { t: 'b', idx: i } }); if (r.ok) this.select(null); return; }
    if (this.selected != null && id != null && id !== this.selected) { const r = this.act({ type: 'move', id: this.selected, to: { t: 'b', idx: i } }); if (r.ok) this.select(null); return; }
    if (id == null) { this.toast('빈 대기석입니다. 유닛을 선택한 뒤 탭하면 대기석으로 보냅니다.', 'info', 1.5); return; }
    if (this.selected === id) this.select(null); else this.select(id);
  }
  select(id: number | null): void {
    this.selected = id; this.renderer.view.selectedUnit = id;
    this.renderUnitPanel(); this.renderBench();
  }

  // ---------- HUD ----------
  updateHud(): void {
    const s = this.state!; if (!s) return;
    $('st-life').textContent = `♥ ${s.life}/${s.maxLife}`; $('st-gold').textContent = `◆ ${Math.floor(s.gold)}`; $('st-shards').textContent = `🧩 ${s.shards}`; $('st-cores').textContent = `🔮 ${s.cores}`;
    const alive = s.enemies.filter(e => e.alive).length; const left = alive + (s.waveRt?.spawnQueue.length || 0);
    $('st-wave').textContent = `W ${Math.min(s.wave, TOTAL_WAVES)}/${TOTAL_WAVES}`;
    const bossW = WAVES[s.wave - 1]?.boss;
    $('st-sub').textContent = s.phase === 'wave' ? `남은 적 ${left}${bossW ? ' · 보스' : ''} · ${fmtTime(s.stats.playTime)}` : s.phase === 'prep' ? `다음 웨이브 ${s.prepT.toFixed(0)}초${bossW ? ' · 보스!' : ''}` : s.phase === 'countdown' ? '준비' : fmtTime(s.stats.playTime);
    const cost = currentSummonCost(s); const od = currentOdds(s);
    $('summon-cost').textContent = `${cost} 골드${od.pityActive ? ' · 영웅+ 확정' : ` · 보정 ${od.pity}/${od.threshold}`}${s.designatedKind ? ' · ' + UNITS[s.designatedKind].name : ''}`;
    const sb = $('btn-summon') as HTMLButtonElement; sb.classList.toggle('pity', od.pityActive); sb.disabled = s.gold < cost || s.phase === 'countdown';
    const canMerge = [0, 1, 2].some(g => { const byKind: Record<string, number> = {}; let n = 0; for (const u of s.units) if (!u.mythic && u.grade === g) { n++; byKind[u.kind] = (byKind[u.kind] || 0) + 1; } return Object.values(byKind).some(c => c >= 3); });
    $('btn-merge').classList.toggle('ready', canMerge);
    const canCraft = s.cores >= 1 && (['storm', 'sun', 'chrono', 'colossus'] as MythicId[]).some(id => { const m = MYTHICS[id]; const used = new Set<number>(); return m.recipe.every(r => { const u = s.units.find(x => !x.mythic && x.kind === r.kind && x.grade === r.grade && !used.has(x.id)); if (u) { used.add(u.id); return true; } return false; }) && !s.units.some(u => u.mythic === id); });
    $('btn-mythic').classList.toggle('ready', canCraft);
    for (const k of ['bomb', 'freeze'] as const) { const b = $(k === 'bomb' ? 'btn-bomb' : 'btn-freeze') as HTMLButtonElement; const cd = s.skills[k]; const max = skillCooldownMax(s, k); (b.querySelector('.cd') as HTMLElement).style.width = cd > 0 ? `${(cd / max) * 100}%` : '0'; b.disabled = cd > 0 || s.phase === 'countdown'; (b.querySelector('small') as HTMLElement).textContent = cd > 0 ? `${Math.ceil(cd)}초` : k === 'bomb' ? '범위 피해' : '빙결·감속'; }
    // prep bar
    const pb = $('prepbar');
    if (s.phase === 'prep') { pb.classList.remove('hidden'); if (!pb.firstChild) pb.append(h('button', { class: 'primary', onclick: () => { const r = this.act({ type: 'early' }); if (r.ok) this.audio.play('wave'); } }, '')); (pb.firstChild as HTMLElement).textContent = `▶ 웨이브 ${s.wave} 바로 시작 (+${Math.floor(s.prepT * 2)} 골드)`; }
    else { pb.classList.add('hidden'); clear(pb); }
    // extra offer
    const eo = $('extra-offer');
    if (s.phase === 'prep' && s.extraOffer && !s.extraOffer.decided) {
      if (eo.classList.contains('hidden')) { eo.classList.remove('hidden'); clear(eo); const r = EXTRA_ORDER_WAVES[s.extraOffer.wave]; eo.append(h('div', { class: 'txt' }, h('b', {}, '⚠ 위험한 추가 주문'), h('br'), `웨이브 ${s.extraOffer.wave}에 정예 무리 추가 → 클리어 시 +${r.gold} 골드, 조각 +${r.shards}. 거절해도 손해 없음.`), h('button', { class: 'primary', onclick: () => this.act({ type: 'extra', accept: true }) }, '수락'), h('button', { onclick: () => this.act({ type: 'extra', accept: false }) }, '거절')); }
    } else eo.classList.add('hidden');
    // hint
    this.updateHint();
    this.renderBench();
    // messages expiry
    const now = performance.now() / 1000; const bar = $('msgbar');
    for (const c of [...bar.children]) { const until = +(c as HTMLElement).dataset.until!; if (until < now) c.remove(); }
    if (this.sheetOpen === 'merge' || this.sheetOpen === 'mythic' || this.sheetOpen === 'upgrade') { /* panels re-render on action */ }
    if (this.selected != null && !unitById(s, this.selected)) this.select(null);
    if (this.selected != null && Math.floor(now * 4) % 2 === 0) this.renderUnitPanelStatsOnly();
  }
  updateHint(): void {
    const s = this.state!; const el = $('hint');
    const hints = ['👉 소환 버튼으로 수비대를 뽑으세요 (첫 소환은 100골드 안에 3회 가능)', '👉 대기석의 새 유닛이 선택됐어요. 전장의 빈 자리(초록)를 탭해 배치하세요. 굽은 구간이 유리합니다', '👉 유닛을 탭하면 사거리와 정보가 보입니다. 같은 등급 3개가 모이면 합성 버튼이 초록으로 켜져요', ''];
    if (this.hintStage === 3 && s.cores >= 1) { el.textContent = '👉 공방 핵을 얻었어요! 신화 버튼에서 레시피와 부족한 재료를 확인하세요'; el.classList.remove('hidden'); this.hintStage = 4; return; }
    if (this.hintStage >= 4 && s.wave >= 12) { this.hintStage = 99; }
    const t = this.hintStage < 3 ? hints[this.hintStage] : (this.hintStage === 3 && s.wave <= 8 ? hints[2] : (this.hintStage === 4 && s.wave < 12 ? el.textContent : ''));
    if (t && this.selected == null) { el.textContent = t!; el.classList.remove('hidden'); } else el.classList.add('hidden');
  }
  benchKey = '';
  renderBench(): void {
    const s = this.state!; const bench = $('bench');
    const key = s.bench.map(id => { const u = id != null ? unitById(s, id) : null; return u ? `${u.id}:${u.locked ? 1 : 0}:${u.id === this.selected ? 1 : 0}` : '-'; }).join('|');
    if (key === this.benchKey) return; this.benchKey = key;
    [...bench.children].forEach((b, i) => {
      const id = s.bench[i]; const el = b as HTMLElement; clear(el); el.classList.toggle('sel', id != null && id === this.selected);
      if (id != null) { const u = unitById(s, id)!; el.append(spriteImg(u, 44)); el.append(h('span', { class: 'pip', style: `background:${['#9e9e9e', '#42a5f5', '#ab47bc', '#ffb300', '#ff1744'][u.grade]}` })); if (u.locked) el.append(h('span', { class: 'lk' }, '🔒')); }
      else el.append(h('small', {}, '대기'));
    });
  }
  renderUnitPanel(): void {
    const s = this.state!; const p = $('unitpanel'); clear(p);
    const u = this.selected != null ? unitById(s, this.selected) : null;
    if (!u) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    const name = unitLabel(u); const d = u.mythic ? MYTHICS[u.mythic] : UNITS[u.kind];
    const benchBtn = u.loc.t === 'f' ? h('button', { title: '대기석으로', onclick: () => { const i = s.bench.findIndex(x => x == null); if (i < 0) { this.toast('대기석이 가득 찼습니다', 'warn'); return; } const r = this.act({ type: 'move', id: u.id, to: { t: 'b', idx: i } }); if (r.ok) this.select(null); } }, '⇩대기') : null;
    p.append(h('div', { class: 'head' }, spriteImg(u, 36),
      h('div', { class: 'who' }, h('div', { class: 'name' }, gradeBadge(u.grade), ' ', name), h('small', {}, `${d.role} · ${u.loc.t === 'f' ? SLOTS[u.loc.slot].name : '대기석'} · 빈 자리 탭=이동 · 유닛 탭=교환`)),
      h('button', { class: 'close', onclick: () => this.select(null) }, '✕')));
    p.append(h('div', { id: 'unit-stats' }, unitInfo(s, u)));
    p.append(h('div', { class: 'btns' },
      h('button', { title: '잠금(합성 자동 선택 제외)', onclick: () => { this.act({ type: 'lock', id: u.id }); this.renderUnitPanel(); } }, u.locked ? '🔓 잠금 해제' : '🔒 잠금'),
      h('button', { title: '즐겨찾기', onclick: () => { this.act({ type: 'fav', id: u.id }); this.renderUnitPanel(); } }, u.fav ? '★ 즐겨찾기' : '☆ 즐겨찾기'),
      benchBtn,
      h('button', { class: 'danger', title: '판매', onclick: () => { if (confirm(`${name}을(를) ${sellValue(u)} 골드에 판매할까요?`)) { this.act({ type: 'sell', id: u.id }); this.select(null); } } }, `판매 ${sellValue(u)}`)));
  }
  renderUnitPanelStatsOnly(): void { const s = this.state!; const u = this.selected != null ? unitById(s, this.selected) : null; const el = document.getElementById('unit-stats'); if (u && el) { clear(el); el.append(unitInfo(s, u)); } }

  toast(text: string, kind = 'info', dur = 2.6): void { this.pushMsgEl(h('div', { class: 'msg ' + kind }, text), dur); }
  pushMsgEl(el: HTMLElement, dur: number): void {
    const bar = document.getElementById('msgbar'); if (!bar) return;
    el.dataset.until = String(performance.now() / 1000 + dur); bar.append(el);
    while (bar.children.length > 2) bar.firstChild!.remove();
  }

  // ---------- Sheets / modals ----------
  openSheet(kind: string): void {
    const sheet = $('sheet'); clear(sheet); sheet.classList.remove('hidden'); this.sheetOpen = kind;
    const titles: Record<string, string> = { summon: '소환 확률 · 운명 조각', merge: '합성', mythic: '신화 조합', upgrade: '전투 강화 · 경제 표', codex: '도감 · 기록', guide: '적 도감', settings: '설정', export: '내보내기 / 불러오기' };
    const content = h('div', { class: 'sheet-content' });
    const body = h('div', { class: 'sheet-body' }, h('div', { class: 'sheet-head' }, h('h3', {}, titles[kind] || kind), h('button', { class: 'close', onclick: () => this.closeSheet() }, '✕')), content);
    sheet.append(body);
    sheet.onclick = ev => { if (ev.target === sheet) this.closeSheet(); };
    const rerender = () => { clear(content); content.append(this.sheetContent(kind, rerender)); this.state && this.updateHud(); };
    rerender();
  }
  sheetContent(kind: string, rerender: () => void): HTMLElement {
    const s = this.state; const act = (a: Action) => this.act(a);
    switch (kind) {
      case 'summon': return summonPanel(s!, a => { act(a); rerender(); });
      case 'merge': return mergePanel(s!, act, this.mergeSel, rerender, this.mergeTab);
      case 'mythic': return mythicPanel(s!, act, rerender);
      case 'upgrade': return upgradePanel(s!, act, rerender);
      case 'codex': return codexPanel(this.blob.meta);
      case 'guide': return enemyGuide();
      case 'settings': return this.settingsPanel(rerender);
      case 'export': return this.exportPanel(rerender);
    }
    return h('div');
  }
  closeSheet(): void { const sheet = $('sheet'); sheet.classList.add('hidden'); clear(sheet); this.sheetOpen = null; this.mergeSel.clear(); if (this.state) { this.lastT = performance.now(); this.updateHud(); } }
  showModal(content: HTMLElement, title: string, closable: boolean, onClose?: () => void): void {
    const modal = $('modal'); clear(modal); modal.classList.remove('hidden');
    modal.append(h('div', { class: 'modal-body' }, h('div', { class: 'sheet-head' }, h('h3', {}, title), closable ? h('button', { class: 'close', onclick: () => { onClose?.(); } }, '✕') : null), h('div', { class: 'sheet-content' }, content)));
  }
  hideModal(): void { const m = $('modal'); m.classList.add('hidden'); clear(m); }

  pausePanel(auto: boolean): HTMLElement {
    const s = this.state!;
    return h('div', {},
      auto ? h('div', { class: 'desc', style: 'margin-bottom:8px' }, '화면을 벗어나 자동으로 멈췄습니다. 전투 시간은 흐르지 않았습니다.') : null,
      h('div', { class: 'desc', style: 'margin-bottom:8px' }, `웨이브 ${s.wave} · 시드 ${s.seed} · ${fmtTime(s.stats.playTime)} · 저장: ${this.saveStatus || '아직 없음'} · ${this.fps.toFixed(0)} FPS`),
      h('button', { class: 'primary', style: 'width:100%', onclick: () => this.setPaused(false) }, '계속하기'),
      h('div', { style: 'height:8px' }),
      this.settingsPanel(() => { }),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => { this.hideModal(); this.openSheet('guide'); } }, '적 도감'), h('button', { onclick: () => { this.hideModal(); this.openSheet('export'); } }, '내보내기')),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'danger', onclick: () => { if (confirm('이 판을 포기하고 타이틀로 갈까요? (최근 웨이브 시작 시점의 저장은 유지됩니다)')) { this.paused = false; this.hideModal(); this.showTitle(); } } }, '타이틀로')),
    );
  }
  settingsPanel(rerender: () => void): HTMLElement {
    const st = this.blob.meta.settings;
    const apply = () => { this.audio.setVolumes(st.sfx, st.bgm); if (this.renderer) { this.renderer.fx.reduceMotion = st.reduceMotion; this.renderer.dmg.enabled = st.dmgNumbers; this.renderer.lowFx = st.lowFx; this.renderer.fx.quality = st.lowFx ? 0.4 : 1; } this.saveAll(); };
    const range = (key: 'bgm' | 'sfx', label: string) => h('label', { class: 'opt' }, label, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st[key], oninput: (e: Event) => { st[key] = parseFloat((e.target as HTMLInputElement).value); apply(); } }));
    const check = (key: 'reduceMotion' | 'dmgNumbers' | 'fastSummon' | 'lowFx', label: string) => h('label', { class: 'opt' }, label, h('input', { type: 'checkbox', checked: st[key], style: 'width:22px;height:22px', onchange: (e: Event) => { st[key] = (e.target as HTMLInputElement).checked; apply(); } }));
    return h('div', {}, range('bgm', '🎵 배경음'), range('sfx', '🔊 효과음'), check('reduceMotion', '흔들림·플래시 줄이기'), check('dmgNumbers', '피해 숫자 표시'), check('fastSummon', '소환 연출 간소화(영웅 이상만 표시)'), check('lowFx', '효과 품질 낮춤(저사양)'),
      h('div', { class: 'saveinfo', style: 'margin-top:6px' }, `저장소: ${store.storageInfo.available ? '사용 가능' : '불가 — ' + store.storageInfo.reason}`));
  }
  exportPanel(rerender: () => void): HTMLElement {
    const ta = h('textarea', { placeholder: '여기에 저장 문자열(DBSD1....)을 붙여넣고 불러오기' }) as HTMLTextAreaElement;
    const status = h('div', { class: 'saveinfo' });
    return h('div', {},
      h('div', { class: 'desc' }, '설정·도감·기록·진행 중인 판을 문자열로 내보내거나 불러옵니다. 다른 기기로 옮길 때 사용하세요.'),
      h('div', { class: 'row', style: 'margin:8px 0' },
        h('button', { onclick: async () => { if (this.state) this.saveRun(); const str = store.exportString(this.blob); ta.value = str; try { await navigator.clipboard.writeText(str); status.textContent = '클립보드에 복사했습니다'; } catch { status.textContent = '아래 텍스트를 직접 복사하세요'; } } }, '내보내기(복사)'),
        h('button', { class: 'danger', onclick: () => { const r = store.importString(ta.value); if (!r.blob) { status.textContent = r.error!; return; } if (!confirm('현재 저장을 덮어씁니다. 계속할까요?')) return; this.blob = r.blob; const sv = store.save(this.blob); status.textContent = sv.ok ? '불러오기 완료 (저장 검증됨)' : '불러왔지만 저장 실패: ' + sv.error; if (!this.state) this.showTitle(); } }, '불러오기'),
      ), ta, status);
  }

  // ---------- Save ----------
  saveRun(): void {
    const s = this.state!; this.blob.run = serialize(s); this.blob.runWave = s.wave; this.saveAll();
  }
  saveAll(): void {
    const r = store.save(this.blob); this.lastSaveOk = r.ok; this.saveStatus = r.ok ? `저장됨 ✓ (${new Date().toLocaleTimeString()})` : `저장 실패: ${r.error}`;
    if (!r.ok && this.state) this.toast('⚠ ' + r.error, 'warn', 4);
  }
  finishRun(won: boolean): void {
    const s = this.state!; const m = this.blob.meta; const newTitles: string[] = [];
    if (!m.claimedRuns.includes(s.runId)) {
      m.claimedRuns.push(s.runId); if (m.claimedRuns.length > 200) m.claimedRuns.shift();
      const reached = won ? 40 : s.wave;
      m.records.bestWave = Math.max(m.records.bestWave, reached);
      if (won) { m.records.wins++; if (!m.records.fastestWin || s.stats.playTime < m.records.fastestWin) m.records.fastestWin = s.stats.playTime; }
      m.records.totalKills += Object.values(s.stats.killsBy).reduce((a, b) => a + b, 0);
      const give = (t: string) => { if (!m.titles.includes(t)) { m.titles.push(t); newTitles.push(t); } };
      if (s.stats.merges > 0) give('첫 합성'); if (s.stats.mythicsMade.length) give('신화의 주인'); if (s.stats.mythicsMade.length >= 2) give('이중 신화');
      if (reached >= 10) give('야시장 문지기'); if (reached >= 20) give('장갑 파괴자'); if (reached >= 30) give('시간을 되찾은 자'); if (won) give('보물 창고 수호자');
      if (won && s.life === s.maxLife) give('무결점 수비'); if (s.stats.legendMade >= 3) give('전설 수집가'); if (s.stats.couriersKilled >= 3) give('운반꾼 사냥꾼'); if (s.stats.extraAccepted >= 2) give('위험을 즐기는 자');
      const top = Object.entries(s.stats.dmgByUnit).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k.startsWith('mythic:') ? MYTHICS[k.slice(7) as MythicId].name : k.startsWith('skill') ? '스킬' : `${GRADE_NAMES[+k.split('@')[1]]} ${UNITS[k.split('@')[0] as keyof typeof UNITS].name}`);
      m.history.push({ runId: s.runId, date: Date.now(), wave: reached, won, time: s.stats.playTime, units: top, mythics: s.stats.mythicsMade.slice(), relics: s.relics.slice(), seed: s.seed }); if (m.history.length > 20) m.history.shift();
    }
    this.blob.run = null; this.blob.runWave = 0; this.saveAll();
    this.showModal(resultPanel(s, won, () => { this.hideModal(); this.retryRun(true); }, () => { this.hideModal(); this.retryRun(false); }, () => { this.hideModal(); this.showTitle(); }, newTitles), won ? '승리' : '패배', false);
  }
}
