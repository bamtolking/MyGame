import type { GameState } from '../sim/types';
import { newGame, serialize, deserialize } from '../sim/state';
import { step, dispatch, DT, type Action } from '../sim/engine';
import { hourOf, dayOf } from '../sim/prisoner';
import { chapterProgress } from '../sim/objectives';
import { totalCapacity } from '../sim/economy';
import { CHAPTERS } from '../data/objectives';
import { ACTIVITY_INFO, HOUR_SECONDS } from '../data/regime';
import { Renderer, type Selection } from '../render/renderer';
import { Input } from './input';
import { Audio } from '../platform/audio';
import * as store from '../platform/storage';
import { h, $, clear, money, clock } from './dom';
import { TOOLS, TOOL_BY_ID, CATS, isDrawKind, type Tool, type CatId } from './toolbar';
import { objectivesPanel, regimePanel, staffPanel, intakePanel, reportPanel, logPanel, settingsPanel, exportPanel, helpPanel, infoCard, chapterModal, gameOverModal, sheetFrame } from './panels';

const MAX_STEPS_PER_FRAME = 60;
const VERSION = 'v0.1.0-beta.1';

export class App {
  root: HTMLElement;
  state: GameState | null = null;
  renderer!: Renderer; input!: Input;
  audio = new Audio();
  blob: store.SaveBlob;
  speed = 1; paused = false; acc = 0; lastT = 0; running = false;
  tool: Tool = TOOL_BY_ID.select; cat: CatId = 'select';
  sheetOpen: string | null = null; modalOpen = false;
  selection: Selection = null;
  saveStatus = ''; lastSavedHour = -1;
  fps = 0; frames = 0; fpsT = 0; hudT = 0; infoT = 0;
  toastQ: { el: HTMLElement; until: number }[] = [];
  dismissedHints = new Set<string>(); hintT = 0;
  buildSound = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const l = store.load(); this.blob = l.blob;
    if (l.error) setTimeout(() => this.toast(l.error!, 'warn'), 100);
    this.showTitle();
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state) { this.saveRun(); if (!this.paused) this.setPaused(true); } });
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 200));
  }

  // ---------- Title ----------
  showTitle(): void {
    this.running = false; this.state = null; this.selection = null;
    clear(this.root);
    const ri = this.blob.runInfo; const hasRun = !!this.blob.run && !!ri;
    const seedInput = h('input', { type: 'number', placeholder: '시드 (비우면 무작위)', inputmode: 'numeric', style: 'font:inherit;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:#101316;color:#fff;width:100%' }) as HTMLInputElement;
    const seed = () => { const v = seedInput.value.trim(); return v ? (parseInt(v, 10) >>> 0) : ((Math.random() * 2 ** 32) >>> 0); };
    const rec = this.blob.meta.records;
    const t = h('div', { id: 'title' },
      h('div', { class: 'logo' }, '🏛️'),
      h('h1', {}, h('small', {}, '교도소 건설·경영 시뮬레이션 · 베타'), '감옥 설계자'),
      h('div', { class: 'sub' }, '빈 부지에 벽을 세우고 방을 배정하고 직원을 고용해 교도소를 운영하세요. 수감자의 욕구를 채우지 못하면 싸움·탈주·폭동이 일어납니다.'),
      h('div', { class: 'menu' },
        hasRun ? h('button', { class: 'primary', onclick: () => this.resumeRun() }, `이어하기 (${ri!.day}일차 · 수감자 ${ri!.prisoners}명 · ${money(ri!.money)})`) : null,
        h('button', { class: hasRun ? '' : 'primary', onclick: () => this.confirmNew(() => this.newRun(seed(), 'empty')) }, '새 게임 — 빈 부지', h('small', { style: 'display:block;font-size:11px;color:inherit;opacity:.8' }, '처음부터 짓기 (목표가 안내합니다)')),
        h('button', { class: hasRun ? '' : 'primary', onclick: () => this.confirmNew(() => this.newRun(seed(), 'quick')) }, '새 게임 — 빠른 시작', h('small', { style: 'display:block;font-size:11px;color:inherit;opacity:.8' }, '기본 시설이 갖춰진 작은 교도소')),
        seedInput,
        h('div', { class: 'row' }, h('button', { onclick: () => this.openSheet('help') }, '도움말'), h('button', { onclick: () => this.openSheet('settings') }, '설정'), h('button', { class: 'ghost', onclick: () => this.openSheet('export') }, '내보내기')),
      ),
      h('div', { class: 'foot' }, `저장소: ${store.storageInfo.available ? '브라우저 로컬 저장 사용 가능' : '⚠ 브라우저 저장 불가(' + store.storageInfo.reason + ') — 내보내기 권장'}`, h('br'), `기록: 최장 ${rec.bestDay}일 · 최다 수감자 ${rec.bestPrisoners}명 · 최고 ${rec.bestChapter}장 · 완주 ${rec.wins}회 / ${rec.runs}판`, h('br'), `싱글 플레이 · 온라인 기능 없음 · ${VERSION}`),
    );
    this.root.append(t, h('div', { id: 'sheet', class: 'hidden' }), h('div', { id: 'modal', class: 'hidden' }));
  }
  confirmNew(fn: () => void): void { if (this.blob.run) this.confirm('저장된 게임이 있습니다. 새 게임을 시작하면 덮어씁니다. 계속할까요?', fn); else fn(); }

  // ---------- Run lifecycle ----------
  newRun(seed: number, mode: 'empty' | 'quick'): void {
    this.audio.unlock();
    this.state = newGame(seed, mode);
    this.blob.meta.records.runs++;
    this.startGame();
    this.saveRun();
    if (mode === 'empty') this.toast('빈 부지입니다. 🎯 목표를 보고 대기실부터 지어 보세요.', 'info');
    else this.toast('빠른 시작: 기본 시설과 직원이 준비되어 있습니다. 08:00에 수감자가 도착합니다.', 'good');
  }
  resumeRun(): void {
    this.audio.unlock();
    try { this.state = deserialize(this.blob.run!); this.startGame(); this.toast(`${dayOf(this.state)}일차 ${clock(hourOf(this.state))}에서 이어합니다`, 'good'); }
    catch (e) { this.toast('이어하기 실패: ' + (e as Error).message, 'bad'); this.blob.run = null; this.blob.runInfo = null; this.saveAll(); this.showTitle(); }
  }
  startGame(): void {
    clear(this.root); this.buildGameDom(); this.applySettings();
    this.speed = 1; this.paused = false; this.acc = 0; this.lastT = performance.now(); this.selection = null; this.sheetOpen = null; this.modalOpen = false; this.lastSavedHour = this.state!.lastHour;
    this.setTool(TOOL_BY_ID.select); this.setCat('select');
    this.renderer.fitMap(this.state!, this.state!.mode === 'quick' ? { x: 19, y: 22 } : { x: 14, y: 22 });
    if (!this.running) { this.running = true; requestAnimationFrame(t => this.frame(t)); }
    this.updateHud(true);
  }
  applySettings(): void { const st = this.blob.meta.settings; this.audio.setVolume(st.sfx); if (this.renderer) { this.renderer.showGrid = st.showGrid; this.renderer.lowFx = st.lowFx; } }

  buildGameDom(): void {
    const g = h('div', { id: 'game' },
      h('div', { id: 'topbar' },
        h('span', { class: 'stat', id: 'st-money' }, '$0'), h('span', { class: 'stat', id: 'st-pris' }, '👤 0/0'), h('span', { class: 'stat', id: 'st-time' }, '📅 1일 06:00'),
        h('span', { class: 'spacer' }),
        h('div', { class: 'speeds' }, h('button', { id: 'btn-pause', onclick: () => this.setPaused(!this.paused) }, '⏸'), h('button', { id: 'btn-speed', onclick: () => this.setSpeed(this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1) }, '1×')),
        h('button', { id: 'btn-obj', onclick: () => this.openSheet('objectives') }, '🎯'),
        h('button', { id: 'btn-menu', onclick: () => this.openSheet('settings') }, '≡'),
      ),
      h('div', { id: 'ticker', onclick: () => this.openSheet('log') }, ''),
      h('div', { id: 'field' }, h('canvas', { id: 'cv' }), h('div', { id: 'status-strip' }), h('div', { id: 'alertbar' }), h('div', { id: 'toasts' }), h('div', { id: 'hint', class: 'hidden' }),
        h('div', { id: 'fieldbtns' }, h('button', { id: 'btn-sec', title: '보안 보기', onclick: () => this.toggleSecurity() }, '🔒'), h('button', { title: '전체 보기', onclick: () => { this.renderer.follow = null; this.renderer.fitMap(this.state!); } }, '🗺')),
        h('div', { id: 'infocard', class: 'hidden' })),
      h('div', { id: 'bottombar' }, h('div', { id: 'toolhint' }), h('div', { id: 'chips' }), h('div', { id: 'cats' })),
      h('div', { id: 'sheet', class: 'hidden' }), h('div', { id: 'modal', class: 'hidden' }),
    );
    this.root.append(g);
    const cv = $('cv') as HTMLCanvasElement;
    this.renderer = new Renderer(cv);
    this.input = new Input(cv, this.renderer, {
      isDrawTool: () => isDrawKind(this.tool.kind),
      onTap: (tx, ty, wx, wy) => this.onTap(tx, ty, wx, wy),
      onRectPreview: r => { this.renderer.selRect = r ? { ...r, color: this.tool.color, hollow: this.tool.kind === 'struct' && (this.tool.struct === 'wall' || this.tool.struct === 'fence') && Math.abs(r.x1 - r.x0) >= 2 && Math.abs(r.y1 - r.y0) >= 2 } : null; },
      onRect: (x0, y0, x1, y1) => this.onRect(x0, y0, x1, y1),
      onCamChange: () => { this.renderer.follow = null; if (this.state) this.renderer.clampCam(this.state); },
    });
    this.renderCats(); this.renderChips();
  }
  layout(): void { if (this.renderer && this.state) { this.renderer.resize(); this.renderer.clampCam(this.state); } }

  // ---------- Loop ----------
  frame(t: number): void {
    if (!this.running) return;
    requestAnimationFrame(tt => this.frame(tt));
    const s = this.state; if (!s) return;
    const dt = Math.min(0.25, (t - this.lastT) / 1000); this.lastT = t;
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    const simActive = !this.paused && !this.sheetOpen && !this.modalOpen && s.phase !== 'bankrupt' && s.phase !== 'fired';
    if (simActive) {
      this.acc += dt * this.speed; let n = 0;
      while (this.acc >= DT && n < MAX_STEPS_PER_FRAME) { step(s); this.acc -= DT; n++; }
      if (n >= MAX_STEPS_PER_FRAME) this.acc = 0;
    }
    this.processEvents();
    if (s.lastHour !== this.lastSavedHour) { this.lastSavedHour = s.lastHour; this.saveRun(); }
    this.hudT += dt; if (this.hudT >= 0.25) { this.hudT = 0; this.updateHud(); }
    this.infoT += dt; if (this.selection && this.infoT >= 0.5) { this.infoT = 0; this.renderInfo(); }
    this.hintT += dt; if (this.hintT >= 1) { this.hintT = 0; this.updateHint(); }
    const now = performance.now(); this.toastQ = this.toastQ.filter(q => { if (now > q.until) { q.el.remove(); return false; } return true; });
    this.renderer.draw(s, now);
  }
  processEvents(): void {
    const s = this.state!; if (!s.events.length) return;
    for (const ev of s.events) {
      switch (ev.type) {
        case 'log': this.toast(ev.text!, ev.kind || 'info'); this.setTicker(ev.text!, ev.kind || 'info'); break;
        case 'fight': this.audio.play('fight'); this.renderer.addMarker(ev.x!, ev.y!, 'alert'); break;
        case 'escape': this.audio.play('escape'); this.renderer.addMarker(ev.x!, ev.y!, 'alert'); break;
        case 'escaped': this.audio.play('alert'); break;
        case 'death': this.audio.play('death'); break;
        case 'riot': this.audio.play('riot'); break;
        case 'intake': this.audio.play('intake'); this.renderer.addMarker(ev.x! + 0.5, ev.y! + 0.5, 'good'); break;
        case 'built': { const now = performance.now(); if (now - this.buildSound > 150) { this.buildSound = now; this.audio.play('build'); } this.renderer.addMarker(ev.x!, ev.y!, 'built'); break; }
        case 'chapter': this.audio.play('chapter'); this.showModal(chapterModal(this, ev.data)); this.blob.meta.records.bestChapter = Math.max(this.blob.meta.records.bestChapter, s.chapter); if (s.chapter >= CHAPTERS.length) this.blob.meta.records.wins++; this.saveAll(); break;
        case 'day': this.audio.play('day'); break;
        case 'gameover': this.audio.play('gameover'); this.showModal(gameOverModal(this, ev.data)); this.saveRun(); break;
      }
    }
    s.events.length = 0;
  }

  // ---------- HUD ----------
  updateHud(force = false): void {
    const s = this.state!; void force;
    const m = $('st-money'); m.textContent = money(s.money); m.className = 'stat' + (s.money < 0 ? ' bad' : s.money < 2000 ? ' warn' : '');
    const cap = totalCapacity(s); const pr = $('st-pris'); pr.textContent = `👤 ${s.prisoners.length}/${cap}`; pr.className = 'stat' + (s.prisoners.length > cap ? ' bad' : '');
    const hr = hourOf(s), mn = Math.floor((s.time / HOUR_SECONDS % 1) * 60);
    $('st-time').textContent = `${dayOf(s)}일 ${clock(hr, mn)}`;
    const sb = $('btn-speed'); sb.textContent = `${this.speed}×`; sb.className = this.paused ? '' : this.speed > 1 ? 'on' : '';
    $('btn-pause').textContent = this.paused ? '▶' : '⏸'; $('btn-pause').className = this.paused ? 'on' : '';
    const prog = chapterProgress(s); $('btn-obj').textContent = s.chapter >= CHAPTERS.length ? '🎖' : `🎯 ${prog.filter(p => p.done).length}/${prog.length}`;
    const mood = s.prisoners.length ? Math.round(s.prisoners.reduce((a, p) => a + p.mood, 0) / s.prisoners.length) : 0;
    const guards = s.staff.filter(x => x.type === 'guard' && x.state !== 'leave').length;
    const act = ACTIVITY_INFO[s.regime[hr]];
    $('status-strip').innerHTML = `<b style="color:${act.color}">● ${act.name}</b>${s.lockdown ? ' <b style="color:#ff8a8a">봉쇄</b>' : ''} · 평판 <b>${s.reputation}</b> · 기분 <b style="color:${mood >= 65 ? '#9be39f' : mood >= 45 ? '#ffd27f' : '#ff9a9a'}">${mood}</b> · 식사 <b>${Math.round(s.meals)}</b> · 👮${guards}${this.paused ? ' · <b>일시정지</b>' : ''}`;
    // alert bar
    const ab = $('alertbar'); clear(ab);
    if (s.fights.length) ab.append(h('button', { onclick: () => { const f = s.fights[0]; this.focusOn(f.x, f.y); } }, `💥 싸움 ${s.fights.length}`));
    const esc = s.prisoners.filter(p => p.state === 'escape'); if (esc.length) ab.append(h('button', { onclick: () => { this.focusOn(esc[0].x, esc[0].y); this.select({ kind: 'prisoner', id: esc[0].id }); } }, `🏃 탈주 ${esc.length}`));
    if (s.riot) ab.append(h('button', { onclick: () => this.setCat('manage') }, '🔥 폭동'));
    $('btn-sec').className = this.renderer.showSecurity ? 'on' : '';
  }
  setTicker(text: string, kind: string): void { const t = $('ticker'); t.textContent = text; t.className = kind; }
  toast(text: string, kind: string): void {
    const box = document.getElementById('toasts'); if (!box) return;
    const el = h('div', { class: 'msg ' + kind }, text); box.append(el);
    this.toastQ.push({ el, until: performance.now() + (kind === 'bad' ? 6000 : 4000) });
    while (this.toastQ.length > 4) { const q = this.toastQ.shift()!; q.el.remove(); }
  }
  updateHint(): void {
    const s = this.state!; const el = document.getElementById('hint'); if (!el) return;
    if (!this.blob.meta.settings.hints || this.selection) { el.classList.add('hidden'); return; }
    let id = '', text = '';
    const rooms = s.cache.rooms; const valid = rooms.filter(r => r.valid);
    if (s.mode === 'empty' && s.chapter === 0 && !s.jobs.length && !rooms.length && !s.struct.some(v => v)) { id = 'first'; text = '🧱 건설 → 벽 도구로 사각형을 드래그해 방을 만들고, 문을 다세요. 🎯 목표가 순서를 알려줍니다.'; }
    else if (s.jobs.length && s.jobs.every(j => j.unreachable)) { id = 'unreach'; text = '⛔ 작업반이 갈 수 없는 작업입니다. 벽으로 막힌 곳이면 문을 먼저 계획하세요.'; }
    else if (rooms.length && !valid.length) { id = 'invalid'; text = '⚠ 방이 아직 유효하지 않습니다. 방을 탭하면 부족한 것(밀폐·물건·크기)을 알려줍니다.'; }
    else if (s.chapter >= 1 && s.prisoners.length === 0 && !s.autoIntake && totalCapacity(s) > 0) { id = 'intake'; text = '🚌 관리 → 수감 접수에서 자동 접수를 켜거나 지금 접수하세요.'; }
    else if (s.prisoners.length && s.meals < 1 && !s.staff.some(x => x.type === 'cook')) { id = 'cook'; text = '🍳 요리사가 없어 식사가 없습니다. 주방(조리대·냉장고)을 짓고 요리사를 고용하세요.'; }
    else if (s.prisoners.length >= 5 && !s.staff.some(x => x.type === 'guard')) { id = 'guard'; text = '👮 교도관이 없습니다. 싸움을 진압하고 탈주를 막으려면 고용하세요.'; }
    else if (this.speed === 1 && s.jobs.length >= 10) { id = 'speed'; text = '⏩ 상단 2×/4× 버튼으로 건설을 빨리 볼 수 있습니다.'; }
    if (!id || this.dismissedHints.has(id)) { el.classList.add('hidden'); return; }
    if (el.dataset.id !== id) { el.dataset.id = id; clear(el); el.append(h('span', {}, text + ' '), h('button', { style: 'min-height:24px;min-width:24px;padding:0 6px;font-size:11px;margin-left:6px', onclick: () => { this.dismissedHints.add(id); el.classList.add('hidden'); } }, '✕')); }
    el.classList.remove('hidden');
  }

  // ---------- Controls ----------
  setSpeed(n: number): void { this.speed = n; this.paused = false; this.audio.play('tap'); this.updateHud(); }
  setPaused(p: boolean): void { this.paused = p; if (p) this.saveRun(); this.updateHud(); }
  toggleSecurity(): void { this.renderer.showSecurity = !this.renderer.showSecurity; this.audio.play('tap'); this.updateHud(); }
  toggleFollow(kind: 'prisoner' | 'staff', id: number): void { this.renderer.follow = this.renderer.follow?.id === id ? null : { kind, id }; this.renderInfo(); }
  focusOn(x: number, y: number): void { this.renderer.follow = null; this.renderer.centerOn(x, y); if (this.renderer.cam.zoom < 16) this.renderer.cam.zoom = 20; this.renderer.clampCam(this.state!); }

  setCat(c: CatId): void { this.cat = c; this.renderCats(); this.renderChips(); if (c === 'select') this.setTool(TOOL_BY_ID.select); }
  renderCats(): void { const el = document.getElementById('cats'); if (!el) return; clear(el); for (const c of CATS) el.append(h('button', { class: this.cat === c.id ? 'on' : '', onclick: () => { this.audio.play('tap'); this.setCat(c.id); } }, h('span', { class: 'ic' }, c.icon), c.name)); }
  renderChips(): void {
    const el = document.getElementById('chips'); if (!el || !this.state) return; clear(el); const s = this.state;
    for (const t of TOOLS.filter(t => t.cat === this.cat)) {
      let on = this.tool.id === t.id && t.kind !== 'action';
      if (t.action === 'security') on = this.renderer.showSecurity; if (t.action === 'grid') on = this.renderer.showGrid; if (t.action === 'lockdown') on = s.lockdown;
      const dim = t.cost != null && s.money < t.cost;
      let sub = t.cost != null ? money(t.cost) : '';
      if (t.staff) sub = `${s.staff.filter(x => x.type === t.staff && x.state !== 'leave').length}명 · ${money(t.cost!)}`;
      el.append(h('button', { class: (on ? 'on' : '') + (dim ? ' dim' : ''), onclick: () => this.onChip(t) }, h('span', { class: 'ic' }, t.icon), t.name, sub ? h('small', {}, sub) : null));
    }
  }
  onChip(t: Tool): void {
    this.audio.play('tap');
    if (t.kind === 'action') {
      switch (t.action) {
        case 'security': this.toggleSecurity(); break;
        case 'fit': this.renderer.follow = null; this.renderer.fitMap(this.state!); break;
        case 'grid': this.renderer.showGrid = !this.renderer.showGrid; this.blob.meta.settings.showGrid = this.renderer.showGrid; this.saveAll(); break;
        case 'hire': this.act({ type: 'hire', staff: t.staff! }); break;
        case 'riotSquad': this.confirm(`진압대를 요청할까요? (${money(1500)}, 24시간 주둔)`, () => this.act({ type: 'riotSquad' })); break;
        case 'lockdown': this.act({ type: 'lockdown', on: !this.state!.lockdown }); break;
        default: if (t.action?.startsWith('sheet:')) this.openSheet(t.action.slice(6));
      }
      this.renderChips(); this.updateToolHint(); return;
    }
    this.setTool(this.tool.id === t.id ? TOOL_BY_ID.select : t);
  }
  setTool(t: Tool): void { this.tool = t; this.renderer.selRect = null; this.renderChips(); this.updateToolHint(); }
  updateToolHint(): void {
    const el = document.getElementById('toolhint'); if (!el) return; clear(el); const t = this.tool;
    if (t.kind === 'select') { el.append(h('div', { class: 'txt' }, h('b', {}, '👆 선택'), ' 탭: 정보 · 드래그: 이동 · 두 손가락: 확대')); return; }
    el.append(h('div', { class: 'txt' }, h('b', {}, `${t.icon} ${t.name}`), t.cost != null ? ` ${money(t.cost)}/칸 · ` : ' · ', t.desc), h('button', { onclick: () => { this.audio.play('cancel'); this.setTool(TOOL_BY_ID.select); } }, '✕ 취소'));
  }

  // ---------- Map interaction ----------
  onTap(tx: number, ty: number, wx: number, wy: number): void {
    const s = this.state!;
    if (isDrawKind(this.tool.kind)) { this.onRect(tx, ty, tx, ty); return; }
    const pick = this.renderer.pick(s, wx, wy);
    if (pick) { this.audio.play('tap'); this.select(pick); return; }
    if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) { this.select(null); return; }
    this.audio.play('tap'); this.select({ kind: 'tile', x: tx, y: ty });
  }
  onRect(x0: number, y0: number, x1: number, y1: number): void {
    const t = this.tool; let r: { ok: boolean; msg?: string; n?: number } = { ok: false };
    switch (t.kind) {
      case 'struct': r = this.act({ type: 'build', struct: t.struct!, x0, y0, x1, y1 }); break;
      case 'zone': r = this.act({ type: 'zone', zone: t.zone!, x0, y0, x1, y1 }); break;
      case 'object': r = this.act({ type: 'object', obj: t.obj!, x0, y0, x1, y1 }); break;
      case 'demolish': r = this.act({ type: 'demolish', x0, y0, x1, y1 }); break;
    }
    if (r.ok) { this.audio.play('place'); if (r.n && r.n > 1 && t.kind !== 'zone') this.toast(`${t.name} ${r.n}${t.kind === 'object' ? '개' : '칸'} 계획됨`, 'info'); }
    this.renderChips();
  }
  act(a: Action): { ok: boolean; msg?: string; n?: number } {
    const r = dispatch(this.state!, a);
    if (!r.ok) { this.audio.play('error'); if (r.msg) this.toast(r.msg, 'warn'); }
    else if (r.msg) this.toast(r.msg, 'warn');
    if (a.type === 'hire' && r.ok) this.audio.play('hire');
    this.processEvents(); this.updateHud(); this.renderChips();
    return r;
  }
  select(sel: Selection): void { this.selection = sel; this.renderer.selection = sel; if (!sel) this.renderer.follow = null; this.renderInfo(); }
  renderInfo(): void {
    const el = document.getElementById('infocard'); if (!el) return;
    if (!this.selection) { el.classList.add('hidden'); return; }
    const content = infoCard(this); if (!content) { this.selection = null; this.renderer.selection = null; el.classList.add('hidden'); return; }
    clear(el); el.append(content); el.classList.remove('hidden');
  }

  // ---------- Sheets / modals ----------
  openSheet(name: string): void {
    this.audio.unlock(); this.sheetOpen = name; if (this.state) this.saveRun();
    this.renderSheet();
  }
  renderSheet(): void {
    const el = $('sheet'); clear(el); const name = this.sheetOpen; if (!name) { el.classList.add('hidden'); return; }
    let body: HTMLElement;
    switch (name) {
      case 'objectives': body = objectivesPanel(this); break; case 'regime': body = regimePanel(this); break; case 'staff': body = staffPanel(this); break;
      case 'intake': body = intakePanel(this); break; case 'report': body = reportPanel(this); break; case 'log': body = logPanel(this); break;
      case 'settings': body = settingsPanel(this); break; case 'export': body = exportPanel(this); break; case 'help': body = helpPanel(this); break;
      default: body = sheetFrame(this, name, h('div', {}, '?'));
    }
    el.append(body); el.classList.remove('hidden');
    el.onclick = (e: MouseEvent) => { if (e.target === el) this.closeSheet(); };
  }
  closeSheet(): void { this.sheetOpen = null; const el = document.getElementById('sheet'); if (el) { clear(el); el.classList.add('hidden'); } if (this.state) { this.lastT = performance.now(); this.renderChips(); this.updateHud(); } }
  showModal(body: HTMLElement): void { const el = $('modal'); clear(el); el.append(body); el.classList.remove('hidden'); this.modalOpen = true; }
  closeModal(): void { const el = document.getElementById('modal'); if (el) { clear(el); el.classList.add('hidden'); } this.modalOpen = false; this.lastT = performance.now(); }
  confirm(text: string, onYes: () => void): void {
    const body = h('div', { class: 'modal-body' }, h('div', { class: 'sheet-content', style: 'padding:16px' }, h('div', { style: 'font-size:14px;line-height:1.5' }, text), h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { onclick: () => this.closeModal() }, '아니오'), h('button', { class: 'primary', onclick: () => { this.closeModal(); onYes(); } }, '예'))));
    this.showModal(body);
  }

  // ---------- Save ----------
  saveRun(): void {
    const s = this.state; if (!s) return;
    try { this.blob.run = serialize(s); this.blob.runInfo = { day: dayOf(s), prisoners: s.prisoners.length, money: Math.round(s.money), chapter: s.chapter, mode: s.mode }; }
    catch (e) { this.saveStatus = '직렬화 실패: ' + (e as Error).message; return; }
    const rec = this.blob.meta.records; rec.bestDay = Math.max(rec.bestDay, dayOf(s)); rec.bestPrisoners = Math.max(rec.bestPrisoners, s.prisoners.length);
    this.saveAll();
  }
  saveAll(): void { const r = store.save(this.blob); this.saveStatus = r.ok ? `저장됨 ${new Date().toLocaleTimeString()}` : (r.error || '저장 실패'); if (!r.ok && !this.savedWarned) { this.savedWarned = true; this.toast('⚠ ' + this.saveStatus, 'warn'); } }
  savedWarned = false;
}
