/**
 * App: screens, fixed-step game loop, touch input, HUD. All game rules stay
 * in core/; this file only issues commands and draws state.
 */
import { Match, type MatchConfig } from '../core/sim/match.ts';
import { DT, MATCH, MAP, ROSTER, ECON } from '../core/data/balance.ts';
import { unitDef, FACTIONS } from '../core/data/units.ts';
import { rosterPop } from '../core/sim/commands.ts';
import { analyze } from '../core/sim/analysis.ts';
import type { FactionId, Team } from '../core/types.ts';
import type { SimEvent, AiLevel, MatchMode } from '../core/sim/state.ts';
import { Renderer } from '../render/renderer.ts';
import { Audio } from '../render/audio.ts';
import { TEAM_COLORS, unitIcon } from '../render/sprites.ts';
import { loadSettings, saveSettings, loadProgress, saveProgress, saveMatch, loadMatch, clearMatch, resetAll, type Settings, type Progress, TITLES, BADGES, SKINS } from '../persist/save.ts';
import { Panels } from './panels.ts';
import { Tutorial } from './tutorial.ts';

export type Difficulty = 'easy' | 'normal' | 'hard';
export interface StartOpts { mode: MatchMode; faction: FactionId; difficulty: Difficulty; presetIdx?: number; }

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
export function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class App {
  root: HTMLElement;
  settings: Settings = loadSettings();
  progress: Progress = loadProgress();
  audio = new Audio();
  renderer: Renderer | null = null;
  match: Match | null = null;
  opts: StartOpts | null = null;
  panels: Panels;
  tutorial: Tutorial | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudT = 0;
  private saveT = 0;
  private hud: Record<string, HTMLElement> = {};
  private toastEl: HTMLElement | null = null;
  private toastTimer = 0;
  private seenWaves = 0;
  private lastCountdown = -1;
  private prevPhase = '';
  private matchScreen: HTMLElement | null = null;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private pinchDist = 0;
  private dragged = false;
  simMsPerTick = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.panels = new Panels(this);
    TEAM_COLORS[0].main = SKINS[this.settings.colorSkin]?.ally ?? TEAM_COLORS[0].main;
    window.addEventListener('resize', () => { this.renderer?.resize(); this.checkOrientation(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.onHidden(); });
    window.addEventListener('pagehide', () => this.onHidden());
    document.addEventListener('pointerdown', () => this.audio.unlock(), { once: false, passive: true });
    this.showMenu();
  }

  // ───────────────────────────── menu ─────────────────────────────
  showMenu() {
    this.stopLoop();
    this.match = null;
    this.tutorial = null;
    this.audio.stopBgm();
    this.root.innerHTML = '';
    const sc = el('div', 'screen menu');
    sc.appendChild(el('h1', '', `라인워즈<small>LEGION CLASH</small>`));
    const saved = loadMatch();
    const btns = el('div', 'buttons');
    const mk = (label: string, sub: string, cls: string, fn: () => void) => { const b = el('button', `btn ${cls}`, `<span>${label}</span><span class="sub">${sub}</span>`); b.onclick = () => { this.audio.unlock(); this.audio.ui('tap'); fn(); }; btns.appendChild(b); return b; };
    if (saved) mk('이어하기', `${saved.meta.mode === '3v3' ? '팀 전투' : saved.meta.mode === 'practice' ? '연습' : '빠른 대전'} · 저장됨`, 'gold', () => this.resumeSaved());
    mk('빠른 대전', '1 대 1 AI 대전', 'primary', () => this.showSetup('1v1'));
    mk('팀 전투', '나 + AI 2 대 AI 3', '', () => this.showSetup('3v3'));
    mk('연습', '튜토리얼 · 안내 포함', '', () => this.showSetup('practice'));
    mk('프로필', '숙련도 · 칭호 · 배지', '', () => this.showProfile());
    mk('설정', '소리 · 연출 · 품질', '', () => this.showSettings(() => this.showMenu()));
    sc.appendChild(btns);
    const title = TITLES.filter((t) => t.need(this.progress)).pop()?.name ?? '신병';
    sc.appendChild(el('div', 'foot', `칭호: <b>${title}</b> · 전적 ${this.progress.wins}승 ${this.progress.losses}패 ${this.progress.draws}무<br>가로 화면 권장 · 로컬 저장 · 오프라인 AI 대전 (온라인 매칭 없음)`));
    this.root.appendChild(sc);
    this.checkOrientation();
  }

  showSetup(mode: MatchMode) {
    this.root.innerHTML = '';
    const sc = el('div', 'screen menu');
    const card = el('div', 'card setup');
    card.appendChild(el('h2', '', mode === '1v1' ? '빠른 대전' : mode === '3v3' ? '팀 전투 (3 대 3)' : '연습 (튜토리얼)'));
    let faction: FactionId = this.settings.lastFaction;
    let diff: Difficulty = mode === 'practice' ? 'easy' : this.settings.lastDifficulty;
    let presetIdx = -1;
    const rowF = el('div', 'row'); rowF.appendChild(el('label', '', '진영'));
    const fBtns: HTMLButtonElement[] = [];
    for (const f of Object.values(FACTIONS)) {
      const b = el('button', 'choice' + (faction === f.id ? ' on' : ''), `<div class="t">${f.name}</div><div class="d">${f.tagline}</div>`);
      b.onclick = () => { faction = f.id; fBtns.forEach((x) => x.classList.remove('on')); b.classList.add('on'); this.audio.ui('tap'); renderPresets(); };
      fBtns.push(b); rowF.appendChild(b);
    }
    card.appendChild(rowF);
    if (mode !== 'practice') {
      const rowD = el('div', 'row'); rowD.appendChild(el('label', '', '난이도'));
      const dBtns: HTMLButtonElement[] = [];
      for (const [id, name, d] of [['easy', '쉬움', '단순 조합 · 느린 대응'], ['normal', '보통', '전열 유지 · 대공/광역 대응'], ['hard', '어려움', '조합 분석 · 점진적 대응 · 팀 조율']] as const) {
        const b = el('button', 'choice' + (diff === id ? ' on' : ''), `<div class="t">${name}</div><div class="d">${d}</div>`);
        b.onclick = () => { diff = id; dBtns.forEach((x) => x.classList.remove('on')); b.classList.add('on'); this.audio.ui('tap'); };
        dBtns.push(b); rowD.appendChild(b);
      }
      card.appendChild(rowD);
    }
    const rowP = el('div', 'row');
    const renderPresets = () => {
      rowP.innerHTML = '';
      const ps = this.progress.presets.filter((p) => p.faction === faction);
      if (!ps.length) return;
      rowP.appendChild(el('label', '', '프리셋'));
      const none = el('button', 'choice on', `<div class="t">없음</div>`);
      const pb: HTMLButtonElement[] = [none];
      none.onclick = () => { presetIdx = -1; pb.forEach((x) => x.classList.remove('on')); none.classList.add('on'); };
      rowP.appendChild(none);
      ps.forEach((p) => {
        const idx = this.progress.presets.indexOf(p);
        const b = el('button', 'choice', `<div class="t">${p.name}</div><div class="d">${p.cells.filter(Boolean).length}개 병력 (자원 범위 내 자동 배치)</div>`);
        b.onclick = () => { presetIdx = idx; pb.forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
        pb.push(b); rowP.appendChild(b);
      });
    };
    renderPresets();
    card.appendChild(rowP);
    card.appendChild(el('p', '', `<span style="color:var(--muted);font-size:12px">${mode === '3v3' ? '아군 AI 2명과 적 AI 3명이 참여합니다. 출격은 A→B→C 순서로 15초 간격, 같은 사령관은 45초마다 재출격합니다.' : mode === 'practice' ? '안내에 따라 병력 배치 → 자동 출격 → 적 조합 관찰 → 대응 병력 추가 → 다음 출격 결과 확인 흐름을 짧게 경험합니다.' : '편성 시간 20초 후 카운트다운과 함께 시작합니다. 25초마다 편성표대로 부대가 출격합니다.'}</span>`));
    const row = el('div', 'row');
    const back = el('button', 'btn', '뒤로'); back.onclick = () => { this.audio.ui('tap'); this.showMenu(); };
    const start = el('button', 'btn primary', '경기 시작'); start.style.flex = '1';
    start.onclick = () => { this.audio.unlock(); this.audio.ui('buy'); this.settings.lastFaction = faction; this.settings.lastDifficulty = diff; saveSettings(this.settings); this.startMatch({ mode, faction, difficulty: diff, presetIdx }); };
    row.appendChild(back); row.appendChild(start);
    card.appendChild(row);
    sc.appendChild(card);
    this.root.appendChild(sc);
  }

  showProfile() {
    this.root.innerHTML = '';
    const sc = el('div', 'screen menu');
    const card = el('div', 'card profile');
    const p = this.progress;
    const title = TITLES.filter((t) => t.need(p)).pop()?.name ?? '신병';
    card.appendChild(el('h2', '', `프로필 · 칭호 <span style="color:var(--gold)">${title}</span>`));
    card.appendChild(el('p', '', `경기 ${p.matches} · ${p.wins}승 ${p.losses}패 ${p.draws}무 · 팀전 승리 ${p.teamWins} · 어려움 승리 ${p.winsVsHard}${p.bestWinTime ? ` · 최단 승리 ${fmtTime(p.bestWinTime)}` : ''}`));
    card.appendChild(el('h3', '', '진영 숙련도'));
    const mast = el('div', 'rowlist');
    for (const f of Object.values(FACTIONS)) mast.appendChild(el('div', 'item', `<b>${f.name}</b><br>숙련 ${p.mastery[f.id]} (Lv ${Math.floor(p.mastery[f.id] / 100) + 1})`));
    card.appendChild(mast);
    card.appendChild(el('h3', '', '칭호'));
    const tl = el('div', 'rowlist');
    for (const t of TITLES) tl.appendChild(el('div', 'item' + (t.need(p) ? '' : ' locked'), `<b>${t.name}</b><br><span style="color:var(--muted)">${t.desc}</span>`));
    card.appendChild(tl);
    card.appendChild(el('h3', '', '배지'));
    const bl = el('div', 'rowlist');
    for (const b of BADGES) bl.appendChild(el('div', 'item' + (p.badges.includes(b.id) ? '' : ' locked'), `<b>${b.name}</b><br><span style="color:var(--muted)">${b.desc}</span>`));
    card.appendChild(bl);
    card.appendChild(el('h3', '', '아군 색상 (숙련도 합계로 해제)'));
    const sl = el('div', 'rowlist');
    const total = p.mastery.iron + p.mastery.gale;
    for (const s of SKINS) {
      const ok = total >= s.need;
      const b = el('button', 'item' + (ok ? '' : ' locked') + (this.settings.colorSkin === s.id ? ' on' : ''), `<span style="display:inline-block;width:14px;height:14px;border-radius:7px;background:${s.ally};vertical-align:middle"></span> ${s.name}${ok ? '' : ` (숙련 ${s.need})`}${this.settings.colorSkin === s.id ? ' ✔' : ''}`);
      b.style.textAlign = 'left'; b.style.cursor = ok ? 'pointer' : 'default';
      b.onclick = () => { if (!ok) return; this.settings.colorSkin = s.id; TEAM_COLORS[0].main = s.ally; saveSettings(this.settings); this.showProfile(); };
      sl.appendChild(b);
    }
    card.appendChild(sl);
    if (p.presets.length) {
      card.appendChild(el('h3', '', '편성 프리셋'));
      const pl = el('div', 'rowlist');
      p.presets.forEach((pr, i) => { const b = el('button', 'item', `<b>${pr.name}</b><br>${FACTIONS[pr.faction].name} · ${pr.cells.filter(Boolean).length}개 <span style="color:var(--danger)">삭제</span>`); b.onclick = () => { p.presets.splice(i, 1); saveProgress(p); this.showProfile(); }; pl.appendChild(b); });
      card.appendChild(pl);
    }
    const back = el('button', 'btn', '뒤로'); back.style.marginTop = '10px'; back.onclick = () => this.showMenu();
    card.appendChild(back);
    sc.appendChild(card);
    this.root.appendChild(sc);
  }

  showSettings(onClose: () => void) {
    const m = el('div', 'modal');
    const box = el('div', 'box');
    box.appendChild(el('h3', '', '설정'));
    const close = el('button', 'close', '✕'); close.onclick = () => { m.remove(); saveSettings(this.settings); this.applySettings(); onClose(); };
    box.appendChild(close);
    const body = el('div', 'body');
    const s = this.settings;
    const range = (label: string, v: number, fn: (v: number) => void) => { const r = el('div', 'setting'); r.appendChild(el('span', '', label)); const i = el('input'); i.type = 'range'; i.min = '0'; i.max = '1'; i.step = '0.05'; i.value = String(v); i.oninput = () => { fn(+i.value); this.applySettings(); }; r.appendChild(i); body.appendChild(r); };
    const check = (label: string, v: boolean, fn: (v: boolean) => void) => { const r = el('div', 'setting'); r.appendChild(el('span', '', label)); const i = el('input'); i.type = 'checkbox'; i.checked = v; i.style.width = '26px'; i.style.height = '26px'; i.onchange = () => { fn(i.checked); this.applySettings(); }; r.appendChild(i); body.appendChild(r); };
    const select = (label: string, v: string, opts: [string, string][], fn: (v: string) => void) => { const r = el('div', 'setting'); r.appendChild(el('span', '', label)); const sel = el('select'); for (const [k, n] of opts) { const o = el('option', '', n); o.value = k; if (k === v) o.selected = true; sel.appendChild(o); } sel.onchange = () => { fn(sel.value); this.applySettings(); }; r.appendChild(sel); body.appendChild(r); };
    range('효과음', s.sfx, (v) => (s.sfx = v));
    range('배경음', s.bgm, (v) => (s.bgm = v));
    check('화면 흔들림', s.shake, (v) => (s.shake = v));
    check('섬광 효과', s.flash, (v) => (s.flash = v));
    select('그래픽 품질', s.quality, [['auto', '자동 (프레임에 따라)'], ['high', '높음'], ['low', '낮음 (저사양)']], (v) => (s.quality = v as Settings['quality']));
    select('체력바 표시', s.hpBars, [['damaged', '손상된 병력만'], ['all', '모두'], ['none', '표시 안 함']], (v) => (s.hpBars = v as Settings['hpBars']));
    const reset = el('button', 'btn danger', '모든 저장 데이터 초기화'); reset.style.marginTop = '8px';
    reset.onclick = () => { if (confirm('설정, 진행도, 저장된 경기를 모두 삭제할까요?')) { resetAll(); this.settings = loadSettings(); this.progress = loadProgress(); m.remove(); this.showMenu(); } };
    body.appendChild(reset);
    body.appendChild(el('p', '', `<span style="color:var(--muted);font-size:12px">버전 0.1 베타 · 온라인 기능 없음 · 데이터는 이 기기에만 저장됩니다.</span>`));
    box.appendChild(body);
    m.appendChild(box);
    this.root.appendChild(m);
  }

  applySettings() {
    this.audio.setVolumes(this.settings.sfx, this.settings.bgm);
    if (this.renderer) { this.renderer.settings = { quality: this.settings.quality, hpBars: this.settings.hpBars, shake: this.settings.shake, flash: this.settings.flash }; }
  }

  // ───────────────────────────── match lifecycle ─────────────────────────────
  startMatch(o: StartOpts) {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const ai: AiLevel = o.mode === 'practice' ? 'tutorial' : o.difficulty;
    const other = (f: FactionId): FactionId => (f === 'iron' ? 'gale' : 'iron');
    const rnd = (): FactionId => (Math.random() < 0.5 ? 'iron' : 'gale');
    const players: MatchConfig['players'] = [];
    if (o.mode === '3v3') {
      players.push({ faction: o.faction, isHuman: true, ai: null, name: '플레이어' });
      players.push({ faction: rnd(), isHuman: false, ai: o.difficulty, name: '아군 AI B' });
      players.push({ faction: rnd(), isHuman: false, ai: o.difficulty, name: '아군 AI C' });
      for (const n of ["적 AI A'", "적 AI B'", "적 AI C'"]) players.push({ faction: rnd(), isHuman: false, ai: o.difficulty, name: n });
    } else {
      players.push({ faction: o.faction, isHuman: true, ai: null, name: '플레이어' });
      players.push({ faction: o.mode === 'practice' ? 'gale' : (Math.random() < 0.6 ? other(o.faction) : rnd()), isHuman: false, ai, name: o.mode === 'practice' ? '교관 AI' : `적 AI (${o.difficulty === 'easy' ? '쉬움' : o.difficulty === 'normal' ? '보통' : '어려움'})` });
    }
    const m = Match.create({ mode: o.mode === 'practice' ? '1v1' : o.mode, seed, players, tutorial: o.mode === 'practice', setupSeconds: o.mode === 'practice' ? 45 : MATCH.setupSeconds });
    m.s.mode = o.mode;
    if (o.presetIdx !== undefined && o.presetIdx >= 0) {
      const pr = this.progress.presets[o.presetIdx];
      if (pr && pr.faction === o.faction) pr.cells.forEach((id, cell) => { if (id) m.command({ type: 'buy', player: 0, unitId: id, cell }); });
    }
    this.opts = o;
    this.beginMatch(m);
    this.panels.open('roster');
  }

  resumeSaved() {
    const saved = loadMatch();
    if (!saved) { this.toast('저장된 경기가 없습니다', true); return; }
    const m = Match.restore(saved.json);
    if (!m) { clearMatch(); this.toast('저장 데이터가 손상되어 복원할 수 없습니다', true); this.showMenu(); return; }
    const hp = m.s.players[m.s.humanPlayer];
    this.opts = { mode: m.s.mode, faction: hp.faction, difficulty: (saved.meta.difficulty as Difficulty) || 'normal' };
    m.s.paused = false;
    this.beginMatch(m);
    this.toast('저장된 경기를 복원했습니다');
  }

  private beginMatch(m: Match) {
    this.match = m;
    this.seenWaves = 0;
    this.lastCountdown = -1;
    this.buildMatchScreen();
    this.renderer!.viewerTeam = m.s.players[m.s.humanPlayer].team;
    this.renderer!.followFront();
    const hp = m.s.players[m.s.humanPlayer];
    const spawn = m.spawnPos(hp.team, 3 * ROSTER.cols + 4);
    this.renderer!.jumpTo(spawn.x + (hp.team === 0 ? 250 : -250), MAP.H / 2, Math.max(this.renderer!.minZoom(), 0.85));
    if (m.s.phase === 'battle') this.renderer!.followFront();
    this.tutorial = m.s.tutorial ? new Tutorial(this) : null;
    this.applySettings();
    this.audio.startBgm();
    this.last = performance.now();
    this.acc = 0;
    this.startLoop();
  }

  private buildMatchScreen() {
    this.root.innerHTML = '';
    const sc = el('div', 'screen'); sc.style.padding = '0'; sc.style.display = 'block';
    this.matchScreen = sc;
    const canvas = el('canvas'); canvas.id = 'field';
    sc.appendChild(canvas);
    this.root.appendChild(sc);
    this.renderer = new Renderer(canvas);
    this.bindCanvasInput(canvas);
    // top bar
    const top = el('div', 'topbar');
    const left = el('div', 'basebars'); const right = el('div', 'basebars right');
    const mkBar = (cls: string, lbl: string) => { const b = el('div', `bar ${cls}`); b.innerHTML = `<i></i><span class="lbl">${lbl}</span>`; return b; };
    this.hud.core0 = mkBar('', '아군 본진'); this.hud.out0 = mkBar('outpost', '전방 거점');
    this.hud.core1 = mkBar('enemy', '적 본진'); this.hud.out1 = mkBar('enemy outpost', '전방 거점');
    left.appendChild(this.hud.core0); left.appendChild(this.hud.out0);
    right.appendChild(this.hud.core1); right.appendChild(this.hud.out1);
    const clock = el('div', 'clock'); clock.innerHTML = `<div class="time">0:00</div><div class="phase"></div>`;
    this.hud.time = clock.querySelector('.time')!; this.hud.phase = clock.querySelector('.phase')!;
    top.appendChild(left); top.appendChild(clock); top.appendChild(right);
    sc.appendChild(top);
    const fl = el('div', 'frontline'); fl.innerHTML = `<b style="left:50%"></b><i style="left:50%"></i>`; this.hud.front = fl.querySelector('i')!; sc.appendChild(fl);
    // bottom bar
    const bot = el('div', 'botbar');
    const stat = (cls: string, k: string) => { const d = el('div', `stat ${cls}`); d.innerHTML = `<div class="v">0</div><div class="k">${k}</div>`; bot.appendChild(d); return d.querySelector('.v') as HTMLElement; };
    this.hud.credits = stat('credits', '크레딧');
    this.hud.income = stat('', '초당 수입');
    this.hud.dispatch = stat('dispatch', '다음 출격');
    this.hud.dispatchWrap = this.hud.dispatch.parentElement!;
    this.hud.pop = stat('', '인구수');
    const btn = (label: string, cls: string, fn: () => void) => { const b = el('button', `btn ${cls}`, label); b.onclick = () => { this.audio.ui('open'); fn(); }; bot.appendChild(b); return b; };
    this.hud.bRoster = btn('편성', 'primary badge', () => this.panels.toggle('roster'));
    this.hud.bResearch = btn('연구', 'badge', () => this.panels.toggle('research'));
    this.hud.bEnemy = btn('상대', 'badge', () => { this.panels.toggle('enemy'); this.seenWaves = this.totalEnemyWaves(); });
    if (this.match!.s.mode === '3v3') this.hud.bTeam = btn('팀', '', () => this.panels.toggle('team'));
    this.hud.bCannon = btn('방어포', 'gold', () => this.toggleCannon());
    this.hud.bReady = btn('출격 준비 완료', 'gold', () => { this.match?.skipSetup(); this.panels.close(); });
    this.hud.bPause = btn('⏸', '', () => this.pause());
    sc.appendChild(bot);
    // camera buttons
    const cam = el('div', 'cam');
    const cb = (label: string, fn: () => void) => { const b = el('button', 'btn small', label); b.onclick = () => { this.audio.ui('tap'); fn(); }; cam.appendChild(b); };
    const hp = this.match!.s.players[this.match!.s.humanPlayer];
    const myCore = hp.team === 0 ? MAP.coreX : MAP.W - MAP.coreX;
    cb('아군 기지', () => this.renderer!.jumpTo(myCore + (hp.team === 0 ? 200 : -200), MAP.H / 2));
    cb('전선', () => this.renderer!.followFront());
    cb('적 기지', () => this.renderer!.jumpTo(MAP.W - myCore + (hp.team === 0 ? -200 : 200), MAP.H / 2));
    cb('−', () => this.renderer!.zoomAt(0.8, this.renderer!.cw / 2, this.renderer!.ch / 2));
    cb('+', () => this.renderer!.zoomAt(1.25, this.renderer!.cw / 2, this.renderer!.ch / 2));
    sc.appendChild(cam);
    this.hud.countdown = el('div', 'countdown hidden'); sc.appendChild(this.hud.countdown);
    this.hud.hint = el('div', 'hint hidden'); sc.appendChild(this.hud.hint);
    this.hud.panelHost = el('div'); sc.appendChild(this.hud.panelHost);
    this.hud.modalHost = el('div'); sc.appendChild(this.hud.modalHost);
    this.checkOrientation();
  }

  get panelHost() { return this.hud.panelHost; }
  get modalHost() { return this.hud.modalHost; }
  get human() { return this.match!.s.players[this.match!.s.humanPlayer]; }

  totalEnemyWaves(): number {
    const m = this.match!; const t = this.human.team;
    return m.s.players.filter((p) => p.team !== t).reduce((a, p) => a + p.waveCount, 0);
  }

  // ───────────────────────────── loop ─────────────────────────────
  private startLoop() {
    this.stopLoop();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(frame);
  }
  private stopLoop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

  private frame(now: number) {
    const m = this.match, r = this.renderer;
    if (!m || !r) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25; // never fast-forward after a stall / background
    this.audio.frame();
    if (!m.s.paused && !m.s.result) {
      this.acc += dt;
      let steps = 0;
      const t0 = performance.now();
      while (this.acc >= DT && steps < 5) {
        m.step();
        this.handleEvents(m.events);
        this.acc -= DT;
        steps++;
      }
      if (steps > 0) this.simMsPerTick = (performance.now() - t0) / steps;
      if (this.acc >= DT) this.acc = DT * 0.99; // sim can't keep up: slow down instead of skipping
    } else if (m.s.result && !this.hud.resultShown) {
      this.acc = 0;
    }
    if (m.s.phase !== this.prevPhase) { if (m.s.phase === 'battle' && this.prevPhase === 'countdown') { r.followFront(); if (r.cam.zoom < 1) r.cam.zoom = Math.min(1.0, 2.4); } this.prevPhase = m.s.phase; }
    const alpha = m.s.paused ? 1 : Math.min(1, this.acc / DT);
    r.render(m, alpha, now);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.updateHud(); this.panels.refresh(); this.tutorial?.update(); }
    this.saveT += dt;
    if (this.saveT > 5 && !m.s.result) { this.saveT = 0; this.persistMatch(); }
    if (m.s.result && !this.hud.resultShown) { this.hud.resultShown = el('div'); setTimeout(() => this.showResult(), 1400); }
  }

  private handleEvents(events: SimEvent[]) {
    const r = this.renderer!; const m = this.match!;
    const cx = r.cam.x, cy = r.cam.y; const half = r.cw / 2 / r.cam.zoom + 200;
    for (const e of events) {
      r.fx.handle(e, r.viewerTeam, this.settings);
      const ex = 'x' in e ? (e as { x: number }).x : cx; const ey = 'y' in e ? (e as { y: number }).y : cy;
      this.audio.handle(e, Math.abs(ex - cx) > half || Math.abs(ey - cy) > half);
      if (e.kind === 'dispatch') {
        const p = m.s.players[e.player];
        if (p.team === this.human.team) this.banner(`${p.isHuman ? '아군' : p.name} 출격 · ${e.count}기`);
        else if (this.hud.bEnemy) this.hud.bEnemy.dataset.n = String(Math.max(0, this.totalEnemyWaves() - this.seenWaves) || '');
      } else if (e.kind === 'buildingDestroyed') {
        this.banner(e.team === this.human.team ? (e.building === 'outpost' ? '아군 전방 거점 파괴됨!' : '아군 본진 파괴됨') : (e.building === 'outpost' ? '적 전방 거점 파괴! 본진 공격 가능' : '적 본진 파괴!'));
      } else if (e.kind === 'overtime') {
        this.banner(`연장전: 건물 피해 ×${e.mult.toFixed(1)}`);
      } else if (e.kind === 'relay') {
        if (e.owner === this.human.team) this.toast('중계소 점령: 수입 +8%'); else if (e.owner === -1) this.toast('중계소 중립화'); else this.toast('적이 중계소를 점령했습니다', true);
      } else if (e.kind === 'cannonWarn' && e.team !== this.human.team) {
        this.toast('경고: 적 비상 방어포 조준 중!', true);
      }
    }
  }

  private updateHud() {
    const m = this.match!, s = m.s, hp = this.human, r = this.renderer!;
    const me = hp.team, en = (1 - me) as Team;
    const bar = (elm: HTMLElement, team: Team, kind: 'core' | 'outpost') => { const b = s.buildings.find((x) => x.team === team && x.kind === kind)!; (elm.querySelector('i') as HTMLElement).style.width = `${(b.hp / b.maxHp) * 100}%`; elm.classList.toggle('dead', !b.alive); (elm.querySelector('.lbl') as HTMLElement).textContent = kind === 'core' ? `${team === me ? '아군' : '적'} 본진 ${Math.ceil(b.hp)}` : `거점 ${Math.ceil(b.hp)}`; };
    bar(this.hud.core0, me, 'core'); bar(this.hud.out0, me, 'outpost'); bar(this.hud.core1, en, 'core'); bar(this.hud.out1, en, 'outpost');
    if (s.phase === 'setup') { this.hud.time.textContent = `편성 ${Math.ceil(s.phaseT)}초`; this.hud.phase.textContent = '초기 편성 시간'; }
    else if (s.phase === 'countdown') { this.hud.time.textContent = '0:00'; this.hud.phase.textContent = '곧 시작'; }
    else { this.hud.time.textContent = fmtTime(s.t); this.hud.phase.textContent = s.t >= MATCH.overtimeStart ? `연장전 · 건물 피해 ×${s.overtimeMult.toFixed(1)}` : s.result ? '경기 종료' : s.paused ? '일시정지' : ''; }
    // countdown
    if (s.phase === 'countdown') { const n = Math.ceil(s.phaseT); this.hud.countdown.classList.remove('hidden'); this.hud.countdown.textContent = String(n); if (n !== this.lastCountdown) { this.lastCountdown = n; this.audio.ui('open'); } }
    else if (s.phase === 'battle' && s.t < 1 && s.tick > 0) { this.hud.countdown.classList.remove('hidden'); this.hud.countdown.textContent = '출격!'; }
    else this.hud.countdown.classList.add('hidden');
    this.hud.credits.textContent = String(Math.floor(hp.credits));
    this.hud.income.textContent = `+${m.income(hp).toFixed(1)}`;
    this.hud.pop.textContent = `${rosterPop(hp)}/${ROSTER.popCap}`;
    // next dispatch (team mode: whose turn)
    if (s.phase === 'battle') {
      let next = hp, best = Infinity;
      for (const p of s.players) if (p.team === me && p.nextDispatchAt < best) { best = p.nextDispatchAt; next = p; }
      const left = Math.max(0, best - s.t);
      this.hud.dispatch.textContent = `${left.toFixed(0)}초`;
      this.hud.dispatchWrap.classList.toggle('soon', left < 5);
      (this.hud.dispatchWrap.querySelector('.k') as HTMLElement).textContent = s.mode === '3v3' ? `다음: ${next.isHuman ? '나' : next.name.replace('아군 ', '')} · 내 출격 ${Math.max(0, hp.nextDispatchAt - s.t).toFixed(0)}초` : '다음 출격';
    } else { this.hud.dispatch.textContent = s.phase === 'setup' ? `${Math.ceil(s.phaseT)}초` : '—'; (this.hud.dispatchWrap.querySelector('.k') as HTMLElement).textContent = '첫 출격까지'; }
    this.hud.bReady.classList.toggle('hidden', s.phase !== 'setup');
    const c = s.cannon[me];
    this.hud.bCannon.textContent = c.used ? '방어포 사용됨' : c.pending ? '방어포 발사 중' : r.cannonMode ? '조준 취소' : '비상 방어포';
    (this.hud.bCannon as HTMLButtonElement).disabled = c.used || !!c.pending || s.phase !== 'battle';
    this.hud.bRoster.dataset.n = '';
    // front-line marker
    const fp = this.frontFrac(); this.hud.front.style.left = `${fp * 100}%`;
    (this.hud.bPause as HTMLButtonElement).textContent = s.paused ? '▶' : '⏸';
  }

  private frontFrac(): number {
    const m = this.match!;
    let maxL = -1, minR = MAP.W + 1;
    for (const u of m.s.units) { if (u.team === 0 && u.x > maxL) maxL = u.x; if (u.team === 1 && u.x < minR) minR = u.x; }
    let x: number;
    if (maxL < 0 && minR > MAP.W) x = MAP.W / 2; else if (maxL < 0) x = minR; else if (minR > MAP.W) x = maxL; else x = (maxL + minR) / 2;
    const f = x / MAP.W;
    return this.human.team === 0 ? f : 1 - f;
  }

  // ───────────────────────────── input ─────────────────────────────
  private bindCanvasInput(c: HTMLCanvasElement) {
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      this.dragged = false;
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      const r = this.renderer!;
      if (this.pointers.size === 1) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) this.dragged = true;
        if (this.dragged) r.pan(dx, dy);
        if (r.cannonMode) r.cannonPreview = r.screenToWorld(e.clientX, e.clientY);
      } else if (this.pointers.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) r.zoomAt(d / this.pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinchDist = d; this.dragged = true;
        return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 0 && !this.dragged) this.tap(e.clientX, e.clientY);
      if (this.pointers.size < 2) this.pinchDist = 0;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.renderer!.zoomAt(e.deltaY < 0 ? 1.15 : 0.87, e.clientX, e.clientY); }, { passive: false });
  }

  private tap(sx: number, sy: number) {
    const r = this.renderer!, m = this.match!;
    const w = r.screenToWorld(sx, sy);
    if (r.cannonMode) {
      const res = m.command({ type: 'cannon', player: m.s.humanPlayer, x: w.x, y: w.y });
      if (res.ok) { r.cannonMode = false; r.cannonPreview = null; this.toast('비상 방어포 조준 완료: 1.5초 후 발사'); this.audio.ui('buy'); }
      else { this.toast(res.reason ?? '사용 불가', true); this.audio.ui('err'); }
      return;
    }
    const u = r.pickUnit(m, w.x, w.y);
    r.selectedUnit = u ? u.id : 0;
    if (u) { const d = unitDef(u.type); this.toast(`${d.name} (${m.s.players[u.owner].name}) 체력 ${Math.ceil(u.hp)}/${u.maxHp}${u.shield > 0 ? ` 보호막 ${Math.ceil(u.shield)}` : ''}${d.ability ? ` · 잔량 ${Math.ceil(u.pool)}` : ''} · ${d.strengths}`); }
  }

  toggleCannon() {
    const r = this.renderer!, m = this.match!;
    const c = m.s.cannon[this.human.team];
    if (c.used || c.pending) { this.toast('이번 경기에서 이미 사용했습니다', true); return; }
    if (m.s.phase !== 'battle') { this.toast('전투 중에만 사용할 수 있습니다', true); return; }
    r.cannonMode = !r.cannonMode; r.cannonPreview = null;
    if (r.cannonMode) { this.panels.close(); this.toast('아군 기지 근처(붉은 영역)를 탭해 조준하세요. 피해 130 · 반경 120 · 둔화 3초'); }
  }

  // ───────────────────────────── pause / save ─────────────────────────────
  pause() {
    const m = this.match!;
    if (m.s.result) return;
    if (m.s.paused) { m.s.paused = false; this.hud.modalHost.innerHTML = ''; this.last = performance.now(); return; }
    m.s.paused = true;
    this.persistMatch();
    const mo = el('div', 'modal'); const box = el('div', 'box');
    box.appendChild(el('h3', '', '일시정지'));
    const close = el('button', 'close', '✕'); close.onclick = () => this.pause(); box.appendChild(close);
    const body = el('div', 'body'); body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.gap = '8px';
    const b1 = el('button', 'btn primary', '계속하기'); b1.onclick = () => this.pause();
    const b2 = el('button', 'btn', '설정'); b2.onclick = () => this.showSettings(() => {});
    const b3 = el('button', 'btn', '저장하고 메뉴로'); b3.onclick = () => { this.persistMatch(); this.showMenu(); };
    const b4 = el('button', 'btn danger', '항복 (패배 처리)'); b4.onclick = () => { if (confirm('항복하면 패배로 기록됩니다. 계속할까요?')) { m.s.paused = false; const core = m.coreOf(this.human.team); core.hp = 0; core.alive = false; m.s.result = { winner: (1 - this.human.team) as Team, reason: 'core', t: m.s.t }; m.s.phase = 'ended'; this.hud.modalHost.innerHTML = ''; } };
    body.appendChild(b1); body.appendChild(b2); body.appendChild(b3); body.appendChild(b4);
    body.appendChild(el('p', '', `<span style="color:var(--muted);font-size:12px">경기는 5초마다, 그리고 앱이 배경으로 갈 때 자동 저장됩니다.</span>`));
    box.appendChild(body); mo.appendChild(box);
    this.hud.modalHost.innerHTML = ''; this.hud.modalHost.appendChild(mo);
  }
  private onHidden() {
    const m = this.match;
    if (!m || m.s.result) return;
    if (!m.s.paused) this.pause();
    this.persistMatch();
  }
  persistMatch() {
    const m = this.match;
    if (!m || m.s.result) return;
    saveMatch(m.serialize(), { mode: m.s.mode, savedAt: Date.now(), difficulty: this.opts?.difficulty ?? 'normal' });
  }

  // ───────────────────────────── result ─────────────────────────────
  private showResult() {
    const m = this.match!, s = m.s, res = s.result!, hp = this.human;
    clearMatch();
    const won = res.winner === hp.team, draw = res.winner === -1;
    // progress
    const p = this.progress;
    p.matches++; if (draw) p.draws++; else if (won) p.wins++; else p.losses++;
    const mins = res.t / 60;
    p.mastery[hp.faction] += Math.round(40 + mins * 4 + (won ? 80 : 0));
    const badge = (id: string) => { if (!p.badges.includes(id)) p.badges.push(id); };
    if (won) { badge('first_win'); if (this.opts?.difficulty === 'hard' && s.mode !== 'practice') { p.winsVsHard++; badge('hard_win'); } if (s.mode === '3v3') { p.teamWins++; badge('team_win'); } if (res.t <= 480) badge('fast_win'); if (hp.econLevel >= 4) badge('econ_win'); if (!p.bestWinTime || res.t < p.bestWinTime) p.bestWinTime = res.t; }
    const facMatches = p.matches; if (facMatches >= 5) badge(hp.faction === 'iron' ? 'iron_5' : 'gale_5');
    if (s.tutorial) { this.settings.tutorialDone = true; saveSettings(this.settings); }
    saveProgress(p);
    // screen
    const mo = el('div', 'modal'); mo.style.background = 'rgba(0,0,0,0.75)';
    const box = el('div', 'result card');
    box.appendChild(el('h2', draw ? 'draw' : won ? 'win' : 'lose', draw ? '무승부' : won ? '승리!' : '패배'));
    const reason = res.reason === 'core' ? '핵심 시설 파괴' : res.reason === 'time' ? '제한 시간 종료 · 남은 본진 체력 비율 판정' : res.reason === 'draw-simul' ? '양쪽 본진 동시 파괴' : '제한 시간 종료 · 체력 비율 동일';
    box.appendChild(el('p', '', `<b>${fmtTime(res.t)}</b> · ${reason} · ${FACTIONS[hp.faction].name} · ${s.mode === '3v3' ? '팀 전투' : s.mode === 'practice' ? '연습' : '빠른 대전'} (${this.opts?.difficulty === 'easy' ? '쉬움' : this.opts?.difficulty === 'hard' ? '어려움' : '보통'})<br><span style="color:var(--muted);font-size:12px">경제 투자 ${hp.spent.econ} (연구 ${hp.econLevel}단계) · 기술 ${hp.spent.tech} (${hp.tech}단계) · 업그레이드 ${hp.spent.upgrades} · 병력 구매 ${hp.spent.units} · 판매 환급 ${hp.spent.refunds} · 숙련도 +${Math.round(40 + mins * 4 + (won ? 80 : 0))}</span>`));
    // stats table
    const st = s.stats[hp.index].byType;
    const rows = Object.entries(st).filter(([, v]) => v.bought > 0 || v.dealt > 0).sort((a, b) => b[1].dealt + b[1].taken - a[1].dealt - a[1].taken).slice(0, 8);
    let html = `<table><tr><th>병종</th><th>구매</th><th>가한 피해</th><th>흡수 피해</th><th>수리/보호막</th><th>격파</th><th>손실</th></tr>`;
    for (const [id, v] of rows) html += `<tr><td>${unitDef(id).name}</td><td>${v.bought}</td><td>${Math.round(v.dealt)}</td><td>${Math.round(v.taken)}</td><td>${Math.round(v.healed + v.shielded)}</td><td>${v.kills}</td><td>${v.deaths}</td></tr>`;
    html += `</table>`;
    box.appendChild(el('div', 'scroll', html));
    // compositions
    const comp = (pl: typeof hp) => { const w = pl.waves[pl.waves.length - 1]; if (!w) return '<span style="color:var(--muted)">출격 없음</span>'; return Object.entries(w.counts).map(([id, n]) => `${unitDef(id).name}×${n}`).join(', '); };
    const two = el('div', 'two');
    two.appendChild(el('div', 'card', `<b>내 최종 편성</b><br><span style="font-size:12px">${comp(hp)}</span>`));
    const ens = s.players.filter((q) => q.team !== hp.team);
    two.appendChild(el('div', 'card', ens.map((q) => `<b>${q.name} (${FACTIONS[q.faction].name})</b><br><span style="font-size:12px">${comp(q)}</span>`).join('<br>')));
    box.appendChild(two);
    const tips = analyze(s, hp.index);
    box.appendChild(el('div', 'tips', `<b>개선 포인트 (경기 기록 기반)</b><ul>${tips.length ? tips.map((t) => `<li>${t.text}</li>`).join('') : '<li>기록상 뚜렷한 약점이 없습니다. 다른 조합도 시도해 보세요.</li>'}</ul>`));
    const row = el('div', 'row'); row.style.display = 'flex'; row.style.gap = '8px';
    const again = el('button', 'btn primary', '다시 하기'); again.style.flex = '1'; again.onclick = () => { if (this.opts) this.startMatch(this.opts); };
    const menu = el('button', 'btn', '메뉴로'); menu.onclick = () => this.showMenu();
    const preset = el('button', 'btn', '편성 프리셋 저장'); preset.onclick = () => { const name = prompt('프리셋 이름', `${FACTIONS[hp.faction].name} 편성 ${this.progress.presets.length + 1}`); if (!name) return; this.progress.presets.push({ name, faction: hp.faction, cells: hp.roster.map((e) => (e ? e.unitId : null)) }); saveProgress(this.progress); this.toast('프리셋을 저장했습니다'); };
    row.appendChild(again); row.appendChild(preset); row.appendChild(menu);
    box.appendChild(row);
    mo.appendChild(box);
    this.hud.modalHost.innerHTML = ''; this.hud.modalHost.appendChild(mo);
    this.panels.close();
    this.audio.stopBgm();
  }

  // ───────────────────────────── misc ui ─────────────────────────────
  toast(msg: string, warn = false) {
    if (!this.toastEl) { this.toastEl = el('div', 'toast'); this.root.appendChild(this.toastEl); }
    this.toastEl.textContent = msg; this.toastEl.className = 'toast' + (warn ? ' warn' : ''); this.toastEl.style.opacity = '1';
    if (this.matchScreen && this.toastEl.parentElement !== this.matchScreen) this.matchScreen.appendChild(this.toastEl);
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { if (this.toastEl) this.toastEl.style.opacity = '0'; }, 2600);
  }
  banner(msg: string) {
    if (!this.matchScreen) return;
    const b = el('div', 'banner', msg); this.matchScreen.appendChild(b);
    setTimeout(() => b.remove(), 1600);
  }
  showHint(step: string, text: string | null) {
    if (!this.hud.hint) return;
    if (!text) { this.hud.hint.classList.add('hidden'); return; }
    this.hud.hint.classList.remove('hidden');
    this.hud.hint.innerHTML = `<span class="step">${step}</span><span>${text}</span>`;
  }
  checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth * 1.15;
    let ov = document.getElementById('rotate');
    if (portrait && !sessionStorage.getItem('lw.rotateDismiss')) {
      if (!ov) {
        ov = el('div', 'rotate'); ov.id = 'rotate';
        ov.innerHTML = `<div class="icon">📱</div><div><b>가로 화면으로 돌려주세요</b><br><span style="color:var(--muted);font-size:13px">세로에서도 데이터는 유지되지만 전장이 좁아집니다.</span></div>`;
        const b = el('button', 'btn', '그래도 세로로 계속'); b.onclick = () => { sessionStorage.setItem('lw.rotateDismiss', '1'); ov!.remove(); };
        ov.appendChild(b); document.body.appendChild(ov);
      }
    } else if (ov) ov.remove();
  }
  /** fresh canvas element with the cached icon drawn (cloneNode would give a blank canvas) */
  unitIcon(type: string, team?: Team): HTMLCanvasElement {
    const src = unitIcon(type, unitDef(type).faction, team ?? this.human.team);
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    return c;
  }
  econInfo() { return ECON; }
}
