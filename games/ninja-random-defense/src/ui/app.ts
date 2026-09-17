// 앱 컨트롤러: 화면(타이틀·로비·게임·결과), 게임 루프, 입력, 네트워크 연결
import type { GameState, SimEvent } from '../sim/types.ts';
import { newGame, unitById, unitAtSlot, aliveMonsters, isAlive } from '../sim/state.ts';
import { step, dispatch, DT, startRound, finish, type Action } from '../sim/engine.ts';
import { snapshot, summary, type BoardSnap, type PlayerSummary } from '../sim/snapshot.ts';
import { Renderer, type BoardView } from '../render/renderer.ts';
import { Audio } from '../platform/audio.ts';
import * as store from '../platform/storage.ts';
import { h, $, clear, fmtNum } from './dom.ts';
import { unitInfo, craftPanel, upgradePanel, teamPanel, helpPanel, resultTable, spriteEl } from './panels.ts';
import { RoomHost } from '../net/room.ts';
import { RoomClient, type RoomView } from '../net/client.ts';
import { loopbackPair } from '../net/loopback.ts';
import { peerHost, peerConnect, wsConnect, parsePeerHost } from '../net/transports.ts';
import { makeCode, normCode, type Conn, type ResultRow, type ClientMsg } from '../net/protocol.ts';
import { SUMMON_COST, ROUND_TIME, TOTAL_ROUNDS, COUNTDOWN, FINAL_TIME, MAX_PLAYERS } from '../data/economy.ts';
import { MONSTER_CAP, FIELD_W, FIELD_H } from '../data/board.ts';
import { GRADE_NAMES, unitName } from '../data/units.ts';
import { BOSS_NAMES, isBossRound } from '../data/monsters.ts';

type Screen = 'title' | 'lobby' | 'game' | 'result';
interface Peer { name: string; summary: PlayerSummary | null; board: BoardSnap | null; boardAt: number }

export class App {
  root: HTMLElement;
  settings: store.Settings; records: store.Records;
  audio = new Audio();
  renderer: Renderer | null = null; canvas: HTMLCanvasElement | null = null;
  state: GameState | null = null; mode: 'solo' | 'multi' = 'solo';
  screen: Screen = 'title';
  // 멀티
  client: RoomClient | null = null; room: RoomHost | null = null; peerHandle: { close: () => void } | null = null;
  netKind: 'p2p' | 'ws' | null = null; roomView: RoomView | null = null; roomCode = '';
  peers = new Map<string, Peer>(); viewPid: string | null = null;
  nextRoundAt = 0; gameStarted = false; reconnecting = false;
  // UI 상태
  selected: number | null = null; moveMode = false;
  drag: { id: number; x0: number; y0: number; x: number; y: number; moved: boolean } | null = null;
  sheet: string | null = null;
  speed = 1; paused = false; userPaused = false; acc = 0; lastT = 0; running = false;
  fps = 0; frames = 0; fpsT = 0; lastNet = 0; hudT = 0; panelT = 0; tabsT = 0; hiddenAt = 0;
  results: ResultRow[] | null = null; won = false; recorded = false; endTimer: ReturnType<typeof setTimeout> | null = null;
  lastToast = ''; lastToastAt = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const l = store.load(); this.settings = l.settings; this.records = l.records;
    this.audio.enabled = this.settings.sound; this.audio.volume = this.settings.volume;
    const unlock = () => { this.audio.unlock(); };
    window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('beforeunload', () => { if (this.client) this.client.leave(); });
    this.showTitle();
  }

  save(): void { store.save({ settings: this.settings, records: this.records }); }

  // ---------- 화면 ----------
  private mount(id: Screen, el: HTMLElement): void { this.screen = id; clear(this.root); el.id = id; el.classList.add('screen'); this.root.append(el); }

  showTitle(): void {
    this.teardown();
    const params = new URLSearchParams(location.search); const pre = normCode(params.get('room') || '');
    const name = h('input', { class: 'text', placeholder: '이름 (최대 12자)', maxlength: '12', value: this.settings.name });
    const code = h('input', { class: 'text', placeholder: '방 코드 6자리', maxlength: '6', autocapitalize: 'characters', value: pre, style: 'letter-spacing:4px;font-family:ui-monospace,monospace' });
    const getName = () => { const n = name.value.trim().slice(0, 12) || '닌자'; this.settings.name = n; this.save(); return n; };
    const r = this.records;
    const el = h('div', { class: 'center' },
      h('div', { class: 'logo' }, '🥷'),
      h('h1', {}, '닌자 랜덤 디펜스'),
      h('p', { class: 'sub' }, '랜덤 소환 · 합성 · 조합 · 친구와 4인 협동'),
      name,
      h('button', { class: 'btn big primary', onclick: () => { getName(); this.startSolo(); } }, '혼자 하기'),
      h('button', { class: 'btn big blue', onclick: () => { getName(); void this.createRoom(); } }, '방 만들기 (친구와 함께)'),
      h('div', { class: 'row', style: 'width:100%;max-width:360px' }, code, h('button', { class: 'btn', style: 'flex:none', onclick: () => { getName(); const c = normCode(code.value); if (c.length < 4) { this.toastNow('방 코드를 입력하세요'); return; } void this.joinRoom(c); } }, '참가')),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => this.openSheet('help') }, '게임 방법'), h('button', { class: 'btn small', onclick: () => this.openSheet('menu') }, '설정')),
      h('details', { class: 'advanced' }, h('summary', {}, '고급: 전용 서버 주소 (비우면 P2P 자동)'),
        h('input', { class: 'text', placeholder: '예: wss://내서버.example.com/ws', value: this.settings.serverUrl, onchange: (e: Event) => { this.settings.serverUrl = (e.target as HTMLInputElement).value.trim(); this.save(); } }),
        h('div', { class: 'dim small', style: 'margin-top:6px' }, 'P2P 시그널 서버 (비우면 공용 PeerJS 서버)'),
        h('input', { class: 'text', placeholder: '예: peer.example.com:9000/peer', value: this.settings.peerHost, onchange: (e: Event) => { this.settings.peerHost = (e.target as HTMLInputElement).value.trim(); this.save(); } })),
      r.games ? h('div', { class: 'records' }, `기록: ${r.games}판 · 승리 ${r.wins} · 최고 라운드 ${r.bestRound} · 최다 처치 ${r.bestKills} · 협동 ${r.coop}판`) : null,
      h('div', { class: 'dim small' }, 'v0.2 베타 · 세로 화면 권장'));
    this.mount('title', el);
    if (pre) code.focus();
  }

  // ---------- 솔로 ----------
  startSolo(): void {
    this.teardown();
    this.mode = 'solo'; this.state = newGame((Math.random() * 0x7fffffff) >>> 0, 'solo');
    this.peers.clear(); this.viewPid = null; this.recorded = false; this.results = null;
    this.showGame();
  }

  // ---------- 멀티: 연결 ----------
  private wsUrl(): string | null {
    let u = this.settings.serverUrl.trim();
    if (!u) return null;
    if (!/^[a-z]+:\/\//i.test(u)) u = (location.protocol === 'https:' ? 'wss://' : 'ws://') + u;
    u = u.replace(/^http/i, 'ws');
    if (!/\/ws\/?$/.test(u)) u = u.replace(/\/+$/, '') + '/ws';
    return u;
  }
  /** 전용 서버 주소: 설정값 > 전용 서버가 넣어 준 표식(meta nrd-server) > 없음(P2P) */
  private async detectServer(): Promise<string | null> {
    const cfg = this.wsUrl(); if (cfg) return cfg;
    if (!/^https?:$/.test(location.protocol)) return null;
    if (document.querySelector('meta[name="nrd-server"]')) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return null;
  }
  private attachOnHello(conn: Conn): void {
    conn.onMessage(m => { const msg = m as ClientMsg; if (msg && msg.t === 'hello' && this.room) this.room.attach(conn, msg); });
  }
  private busy(text: string): HTMLElement { const el = h('div', { class: 'center' }, h('div', { class: 'logo' }, '⏳'), h('p', {}, text), h('button', { class: 'btn', onclick: () => this.showTitle() }, '취소')); this.mount('lobby', el); return el; }

  async createRoom(): Promise<void> {
    this.teardown(); this.busy('방을 만드는 중…');
    try {
      const ws = await this.detectServer();
      const token = this.settings.token;
      if (ws) {
        const conn = await wsConnect(ws); this.netKind = 'ws';
        this.client = new RoomClient(conn, this.settings.name || '닌자', token); this.wireClient(this.client); this.client.hello({ create: true });
      } else {
        const code = makeCode(); this.netKind = 'p2p';
        this.room = new RoomHost({ code, onEmpty: () => { /* 호스트 방은 화면이 정리 */ } });
        this.peerHandle = await peerHost(code, c => this.attachOnHello(c), parsePeerHost(this.settings.peerHost));
        const [a, b] = loopbackPair();
        this.client = new RoomClient(a, this.settings.name || '닌자', token); this.wireClient(this.client); this.attachOnHello(b); this.client.hello({ create: true });
      }
    } catch (e) { this.showTitle(); this.toastNow(`방 만들기 실패: ${(e as Error).message}`); }
  }
  async joinRoom(code: string): Promise<void> {
    this.teardown(); this.busy(`방 ${code}에 참가하는 중…`);
    try {
      const ws = await this.detectServer(); const token = this.settings.token;
      const conn = ws ? await wsConnect(ws) : await peerConnect(code, parsePeerHost(this.settings.peerHost));
      this.netKind = ws ? 'ws' : 'p2p'; this.roomCode = code;
      this.client = new RoomClient(conn, this.settings.name || '닌자', token); this.wireClient(this.client); this.client.hello({ code });
    } catch (e) { this.showTitle(); this.toastNow(`참가 실패: ${(e as Error).message}`); }
  }
  private async reconnect(): Promise<void> {
    if (!this.roomCode || this.reconnecting || this.netKind === null) return;
    this.reconnecting = true; this.toastNow('재접속 중…', 'warn');
    try {
      const ws = this.netKind === 'ws' ? (await this.detectServer()) : null;
      const conn = this.netKind === 'ws' ? await wsConnect(ws!) : await peerConnect(this.roomCode, parsePeerHost(this.settings.peerHost));
      this.client = new RoomClient(conn, this.settings.name || '닌자', this.settings.token); this.wireClient(this.client); this.client.hello({ code: this.roomCode });
      this.hideOverlay(); this.toastNow('재접속 완료', 'good');
    } catch (e) { this.showOverlay('연결이 끊겼습니다', (e as Error).message, [['다시 시도', () => void this.reconnect()], ['나가기', () => this.showTitle()]]); }
    this.reconnecting = false;
  }

  private wireClient(c: RoomClient): void {
    c.on('room', r => {
      this.roomCode = r.code;
      if (r.phase === 'lobby') this.gameStarted = false;
      for (const p of r.players) { if (p.pid === r.you) continue; const pe = this.peers.get(p.pid); if (pe) { pe.name = p.name; if (p.summary) pe.summary = p.summary; } else this.peers.set(p.pid, { name: p.name, summary: p.summary, board: null, boardAt: 0 }); }
      for (const pid of [...this.peers.keys()]) if (!r.players.some(p => p.pid === pid)) this.peers.delete(pid);
      if (this.screen === 'lobby' || (this.screen === 'result' && r.phase === 'lobby')) this.showLobby();
      else if (this.screen === 'game') this.updateTabs(true);
    });
    c.on('start', m => {
      if (this.state && this.mode === 'multi' && this.gameStarted) return; // 재접속: 기존 판 유지
      const idx = Math.max(0, m.order.indexOf(this.client?.room?.you ?? ''));
      this.mode = 'multi'; this.state = newGame(((m.seed + idx * 7919) >>> 0), 'multi'); this.gameStarted = true;
      this.viewPid = null; this.recorded = false; this.results = null; this.nextRoundAt = performance.now() + COUNTDOWN * 1000;
      for (const p of this.peers.values()) { p.summary = null; p.board = null; }
      this.showGame();
    });
    c.on('round', n => {
      const s = this.state; if (!s || this.mode !== 'multi') return;
      this.nextRoundAt = performance.now() + (n >= TOTAL_ROUNDS ? FINAL_TIME : ROUND_TIME) * 1000;
      if (isAlive(s)) startRound(s, n);
    });
    c.on('peer', (pid, sm) => { const p = this.peers.get(pid); if (p) p.summary = sm; else this.peers.set(pid, { name: pid, summary: sm, board: null, boardAt: 0 }); });
    c.on('board', (pid, b) => { const p = this.peers.get(pid); if (p) { p.board = b; p.boardAt = performance.now(); } });
    c.on('gold', (_from, fromName, amount) => { if (this.state) { dispatch(this.state, { type: 'receiveGold', amount }); this.toast(`${fromName}님이 ${amount} 골드를 보냈습니다`, 'good'); this.audio.gold(); } });
    c.on('emote', (from, fromName, text) => { this.toast(`${from === this.client?.room?.you ? '나' : fromName}: ${text}`, 'emote'); this.audio.emote(); });
    c.on('end', (results, won) => this.onMultiEnd(results, won));
    c.on('error', msg => { this.toastNow(msg, 'bad'); if (this.screen === 'lobby' && !this.client?.room) setTimeout(() => this.showTitle(), 800); });
    c.on('close', () => {
      if (this.client !== c) return;
      if (this.screen === 'game' && this.mode === 'multi') { this.showOverlay('연결이 끊겼습니다', this.netKind === 'p2p' ? '방장이 나갔거나 네트워크가 끊겼습니다.' : '서버와 연결이 끊겼습니다.', [['재접속', () => void this.reconnect()], ['나가기', () => this.showTitle()]]); }
      else if (this.screen === 'lobby' || this.screen === 'result') { this.toastNow('연결이 끊겼습니다', 'bad'); setTimeout(() => this.showTitle(), 600); }
    });
  }

  // ---------- 로비 ----------
  showLobby(): void {
    const r = this.client?.room; if (!r) return;
    const me = r.players.find(p => p.pid === r.you); const isHost = !!me?.host;
    const link = /^https?:$/.test(location.protocol) ? `${location.origin}${location.pathname}?room=${r.code}` : '';
    const share = async () => {
      const text = `닌자 랜덤 디펜스 방 코드: ${r.code}${link ? `\n${link}` : ''}`;
      try { if (navigator.share) { await navigator.share({ title: '닌자 랜덤 디펜스', text }); return; } } catch { /* 취소 */ }
      try { await navigator.clipboard.writeText(text); this.toastNow('코드를 복사했습니다', 'good'); } catch { this.toastNow('코드: ' + r.code); }
    };
    const el = h('div', { class: 'center' },
      h('p', { class: 'dim' }, '친구에게 이 코드를 알려주세요'),
      h('div', { class: 'code' }, r.code),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => void share() }, '코드 공유 / 복사')),
      h('div', { class: 'players' }, ...r.players.map(p => h('div', { class: 'card row' }, h('span', {}, p.host ? '👑' : '🥷'), h('b', { class: 'grow' }, p.name + (p.pid === r.you ? ' (나)' : '')), h('span', { class: 'dim small' }, p.connected ? '접속' : '끊김'))),
        r.players.length < MAX_PLAYERS ? h('div', { class: 'dim small' }, `${r.players.length}/${MAX_PLAYERS}명 · 친구를 기다리는 중…`) : null),
      isHost ? h('button', { class: 'btn big primary', onclick: () => this.client?.start() }, r.players.length > 1 ? '게임 시작' : '혼자라도 시작') : h('p', { class: 'dim' }, '방장이 시작하기를 기다리는 중…'),
      h('p', { class: 'dim small' }, this.netKind === 'p2p' ? 'P2P 연결(서버 없음). 방장은 이 화면(또는 게임 화면)을 켜 둬야 합니다.' : '전용 서버 연결'),
      h('button', { class: 'btn', onclick: () => this.showTitle() }, '나가기'));
    this.mount('lobby', el);
  }

  // ---------- 게임 화면 ----------
  showGame(): void {
    const s = this.state!; this.selected = null; this.moveMode = false; this.drag = null; this.sheet = null; this.paused = false; this.userPaused = false; this.speed = 1;
    this.canvas = h('canvas', { id: 'cv' });
    const left = h('div', { class: 'left' },
      h('div', { class: 'hud' }, h('div', { class: 'stat', id: 'st-round' }), h('div', { class: 'stat', id: 'st-time' }), h('div', { class: 'stat', id: 'st-mon' }), h('div', { class: 'stat', id: 'st-gold' }),
        this.mode === 'solo' ? h('button', { class: 'icon', id: 'btn-speed', onclick: () => { this.speed = this.speed === 1 ? 2 : 1; $('#btn-speed').textContent = this.speed + '×'; } }, '1×') : null,
        this.mode === 'solo' ? h('button', { class: 'icon', id: 'btn-pause', onclick: () => this.togglePause() }, '⏸') : null,
        h('button', { class: 'icon', onclick: () => this.openSheet('menu') }, '≡')),
      this.mode === 'multi' ? h('div', { class: 'tabs', id: 'tabs' }) : null,
      h('div', { class: 'boardwrap', id: 'boardwrap' }, this.canvas, h('div', { class: 'toasts', id: 'toasts' }), h('div', { id: 'overlay', class: 'overlay hidden' })));
    const right = h('div', { class: 'right' },
      h('div', { id: 'unitpanel', class: 'hidden' }),
      h('div', { class: 'bar' },
        h('button', { class: 'btn primary', id: 'btn-summon', onclick: () => this.doSummon() }, '소환', h('small', {}, `${SUMMON_COST}G`)),
        h('button', { class: 'btn', id: 'btn-automerge', onclick: () => this.act({ type: 'automerge' }) }, '자동합성', h('small', {}, '속성×3')),
        h('button', { class: 'btn', id: 'btn-craft', onclick: () => this.openSheet('craft') }, '조합', h('small', {}, '신화')),
        h('button', { class: 'btn', id: 'btn-upgrade', onclick: () => this.openSheet('upgrade') }, '강화', h('small', { id: 'lbl-upgrade' }, `소환 Lv${s.summonLv}`)),
        this.mode === 'multi' ? h('button', { class: 'btn', id: 'btn-team', onclick: () => this.openSheet('team') }, '팀', h('small', {}, '골드·관전')) : h('button', { class: 'btn', onclick: () => this.openSheet('help') }, '도움말', h('small', {}, '규칙'))));
    const el = h('div', {}, left, right);
    this.mount('game', el);
    this.renderer = new Renderer(this.canvas); this.renderer.fx.low = this.settings.lowFx;
    this.bindCanvas(this.canvas);
    new ResizeObserver(() => this.layout()).observe($('#boardwrap'));
    this.layout();
    this.updateTabs(true); this.updateHud();
    this.running = true; this.lastT = performance.now(); this.acc = 0;
    requestAnimationFrame(this.loop);
    if (this.mode === 'solo') this.banner('준비!', false);
  }
  layout(): void {
    if (this.screen !== 'game' || !this.renderer) return;
    const wrap = document.getElementById('boardwrap'); if (!wrap) return;
    const W = wrap.clientWidth - 12, H = wrap.clientHeight - 12; if (W <= 0 || H <= 0) return;
    const w = Math.min(W, H * FIELD_W / FIELD_H), hh = w * FIELD_H / FIELD_W;
    this.renderer.resize(Math.floor(w), Math.floor(hh));
  }
  private togglePause(): void { if (this.mode !== 'solo') return; this.userPaused = !this.userPaused; this.paused = this.userPaused || this.sheet !== null; const b = document.getElementById('btn-pause'); if (b) b.textContent = this.userPaused ? '▶' : '⏸'; if (this.userPaused) this.showOverlay('일시정지', '', [['계속하기', () => this.togglePause()]]); else this.hideOverlay(); }

  loop = (now: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dtReal = Math.min(0.25, (now - this.lastT) / 1000); this.lastT = now;
    const s = this.state; const r = this.renderer; if (!s || !r) return;
    if (!this.paused) {
      this.acc += dtReal * this.speed; let n = 0;
      while (this.acc >= DT && n < 10) { step(s, DT); this.acc -= DT; n++; }
      if (this.acc > DT * 10) this.acc = 0;
    }
    if (s.events.length) this.handleEvents(s.events), s.events.length = 0;
    if (this.mode === 'multi' && this.client && now - this.lastNet > 500) { this.lastNet = now; this.client.summary(summary(s)); this.client.board(snapshot(s)); }
    // 렌더
    let view: BoardView;
    const peer = this.viewPid ? this.peers.get(this.viewPid) : null;
    if (peer && peer.board) view = Renderer.viewOfSnap(peer.board, (now - peer.boardAt) / 1000, `${peer.name} 판 관전 중`);
    else { this.viewPid = null; view = Renderer.viewOf(s, this.selectedSlot(), this.moveMode || this.drag ? this.selectedSlot() : null, this.drag && this.drag.moved ? { kind: unitById(s, this.drag.id)!.kind, grade: unitById(s, this.drag.id)!.grade, x: this.drag.x, y: this.drag.y } : null, this.mode === 'multi' ? '내 판' : undefined); }
    r.draw(view, this.paused ? 0 : dtReal);
    if (now - this.hudT > 100) { this.hudT = now; this.updateHud(); }
    if (now - this.panelT > 250) { this.panelT = now; this.updateUnitPanel(false); }
    if (this.mode === 'multi' && now - this.tabsT > 500) { this.tabsT = now; this.updateTabs(false); }
    this.frames++; if (now - this.fpsT > 1000) { this.fps = this.frames * 1000 / (now - this.fpsT); this.frames = 0; this.fpsT = now; }
    // 종료 판정
    if (!isAlive(s) && !this.endTimer && this.mode === 'solo') this.endTimer = setTimeout(() => this.showResult(), 1600);
  };

  private handleEvents(events: SimEvent[]): void {
    const r = this.renderer!; r.pushEvents(events);
    for (const e of events) {
      switch (e.t) {
        case 'shot': this.audio.shot(e.kind); break;
        case 'die': this.audio.kill(e.boss); break;
        case 'summon': this.audio.summon(e.grade); if (e.grade >= 2) this.toast(`${GRADE_NAMES[e.grade]} 등장! ${unitName(e.kind, e.grade)}`, e.grade >= 3 ? 'warn' : 'good'); break;
        case 'merge': this.audio.merge(e.grade); break;
        case 'mythic': this.audio.mythic(); this.toast(`신화 완성! ${unitName(e.kind, 4)}`, 'warn'); break;
        case 'round': this.audio.round(e.boss); this.banner(e.boss ? `보스: ${BOSS_NAMES[e.n] ?? '보스'}` : `라운드 ${e.n}`, e.boss); break;
        case 'gold': this.audio.gold(); break;
        case 'levelup': this.audio.merge(3); break;
        case 'eliminated': this.audio.eliminated(); this.selected = null; this.moveMode = false; this.updateUnitPanel(true);
          if (this.mode === 'multi' && this.client) { this.client.eliminated(this.state!.round, e.reason); this.client.summary(summary(this.state!)); this.showOverlay('탈락', e.reason + ' — 친구들이 끝날 때까지 관전합니다', [['친구 판 보기', () => { this.hideOverlay(); this.viewFirstAlivePeer(); }], ['나가기', () => this.showTitle()]]); }
          break;
        case 'won': this.audio.win(); break;
      }
    }
  }
  private viewFirstAlivePeer(): void { for (const [pid, p] of this.peers) if (p.summary && p.summary.phase !== 'eliminated') { this.viewPid = pid; this.updateTabs(true); return; } const first = this.peers.keys().next(); if (!first.done) { this.viewPid = first.value; this.updateTabs(true); } }

  // ---------- HUD ----------
  private updateHud(): void {
    const s = this.state; if (!s || this.screen !== 'game') return;
    const now = performance.now();
    const el = (id: string) => document.getElementById(id)!;
    el('st-round').innerHTML = `<b>R ${s.round}/${TOTAL_ROUNDS}</b>${s.round > 0 && isBossRound(s.round) ? '보스' : (s.round + 1 <= TOTAL_ROUNDS && isBossRound(s.round + 1) ? '다음 보스' : '라운드')}`;
    let t: string; let cls = 'stat';
    if (s.bossDeadline != null) { const left = Math.max(0, s.bossDeadline - s.time); t = `<b>${Math.ceil(left)}초</b>보스 제한`; cls = 'stat boss'; }
    else if (s.phase === 'countdown') { const left = this.mode === 'multi' ? Math.max(0, (this.nextRoundAt - now) / 1000) : s.countdownT; t = `<b>${Math.ceil(left)}</b>시작까지`; }
    else if (s.round >= TOTAL_ROUNDS) t = `<b>최종</b>라운드`;
    else { const left = this.mode === 'multi' ? Math.max(0, (this.nextRoundAt - now) / 1000) : Math.max(0, ROUND_TIME - s.roundT); t = `<b>${Math.ceil(left)}초</b>다음 라운드`; }
    el('st-time').innerHTML = t; el('st-time').className = cls;
    const n = aliveMonsters(s); el('st-mon').innerHTML = `<b>${n}/${MONSTER_CAP}</b>몬스터`; el('st-mon').className = 'stat' + (n >= MONSTER_CAP * 0.7 ? ' warn' : '');
    el('st-gold').innerHTML = `<b>${fmtNum(s.gold)}</b>골드`;
    const bs = document.getElementById('btn-summon') as HTMLButtonElement | null; if (bs) bs.disabled = !isAlive(s) || s.gold < SUMMON_COST || !s.slots.some(x => x == null);
    const lu = document.getElementById('lbl-upgrade'); if (lu) lu.textContent = `소환Lv${s.summonLv} 공격+${s.atkLv * 8}%`;
  }
  private updateTabs(force: boolean): void {
    if (this.mode !== 'multi') return; const tabs = document.getElementById('tabs'); if (!tabs) return;
    const s = this.state!; const you = this.client?.room?.you;
    const mk = (pid: string | null, name: string, sm: PlayerSummary | null, connected: boolean) => {
      const dead = sm?.phase === 'eliminated'; const on = this.viewPid === pid;
      const b = h('button', { class: 'tab' + (on ? ' on' : '') + (dead ? ' dead' : '') + (connected ? '' : ' off'), onclick: () => { this.viewPid = pid; this.selected = null; this.moveMode = false; this.updateUnitPanel(true); this.updateTabs(true); } },
        `${name} · R${sm?.round ?? 0} · 👾${sm?.monsters ?? 0}${dead ? ' 탈락' : ''}`);
      return b;
    };
    const key = [this.viewPid, ...[...this.peers].map(([pid, p]) => `${pid}:${p.name}:${p.summary?.round}:${p.summary?.monsters}:${p.summary?.phase}`)].join('|') + `|me:${s.round}:${aliveMonsters(s)}:${s.phase}`;
    if (!force && tabs.dataset.key === key) return; tabs.dataset.key = key;
    clear(tabs);
    tabs.append(mk(null, '나', summary(s), true));
    const players = this.client?.room?.players ?? [];
    for (const [pid, p] of this.peers) { if (pid === you) continue; const info = players.find(x => x.pid === pid); tabs.append(mk(pid, p.name, p.summary, info ? info.connected : true)); }
  }
  private selectedSlot(): number | null { const u = this.state ? unitById(this.state, this.selected) : undefined; return u ? u.slot : null; }
  private updateUnitPanel(force: boolean): void {
    const panel = document.getElementById('unitpanel'); if (!panel || !this.state) return;
    const u = unitById(this.state, this.selected);
    if (!u || this.viewPid) { if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); clear(panel); panel.dataset.key = ''; } this.selected = null; this.moveMode = false; return; }
    const key = `${u.id}:${u.kills}:${Math.floor(u.dmg)}:${this.moveMode}:${this.state.units.length}:${this.state.gold >= SUMMON_COST}`;
    if (!force && panel.dataset.key === key) return; panel.dataset.key = key;
    clear(panel); panel.classList.remove('hidden');
    panel.append(unitInfo(this.state, u, {
      merge: () => this.act({ type: 'merge', id: u.id }), mergeRandom: () => { if (confirm('같은 등급 3개를 섞어 다음 등급 무작위 속성 1개로 합성합니다. 진행할까요?')) this.act({ type: 'merge', id: u.id, random: true }); },
      move: () => { this.moveMode = !this.moveMode; this.updateUnitPanel(true); }, sell: () => { if (confirm(`${unitName(u.kind, u.grade)}을(를) 판매할까요?`)) { this.act({ type: 'sell', id: u.id }); this.select(null); } }, close: () => this.select(null),
    }, this.moveMode));
  }
  select(id: number | null): void { this.selected = id; this.moveMode = false; this.updateUnitPanel(true); }

  // ---------- 행동 ----------
  act(a: Action): boolean {
    const s = this.state; if (!s) return false;
    const r = dispatch(s, a);
    if (!r.ok) { this.toast(r.error, 'bad'); this.audio.error(); return false; }
    if (r.msg) this.toast(r.msg, 'good');
    if (a.type === 'merge' && r.unitId != null) this.select(r.unitId);
    this.updateHud(); this.updateUnitPanel(true); this.refreshSheet();
    return true;
  }
  doSummon(): void { const s = this.state; if (!s) return; if (this.act({ type: 'summon' })) { /* 연출은 이벤트에서 */ } }

  // ---------- 캔버스 입력 ----------
  private bindCanvas(cv: HTMLCanvasElement): void {
    const pos = (e: PointerEvent): [number, number] => { const rect = cv.getBoundingClientRect(); return this.renderer!.toField(e.clientX - rect.left, e.clientY - rect.top); };
    cv.addEventListener('pointerdown', e => {
      if (this.viewPid || !this.state || !isAlive(this.state)) return;
      const [x, y] = pos(e); const slot = this.renderer!.slotAtPx(e.clientX - cv.getBoundingClientRect().left, e.clientY - cv.getBoundingClientRect().top);
      const u = slot >= 0 ? unitAtSlot(this.state, slot) : undefined;
      if (u && !this.moveMode) { this.drag = { id: u.id, x0: x, y0: y, x, y, moved: false }; cv.setPointerCapture(e.pointerId); }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      if (!this.drag) return; const [x, y] = pos(e); this.drag.x = x; this.drag.y = y;
      if (!this.drag.moved && Math.hypot(x - this.drag.x0, y - this.drag.y0) > 10) { this.drag.moved = true; this.selected = this.drag.id; this.updateUnitPanel(true); }
    });
    const up = (e: PointerEvent) => {
      const s = this.state; if (!s) { this.drag = null; return; }
      const rect = cv.getBoundingClientRect(); const slot = this.renderer!.slotAtPx(e.clientX - rect.left, e.clientY - rect.top);
      if (this.drag && this.drag.moved) { const id = this.drag.id; this.drag = null; if (slot >= 0) this.act({ type: 'move', id, slot }); this.select(id); return; }
      this.drag = null;
      if (this.viewPid || !isAlive(s)) return;
      if (slot < 0) { if (!this.moveMode) this.select(null); return; }
      const u = unitAtSlot(s, slot);
      if (this.moveMode && this.selected != null) { const id = this.selected; if (this.act({ type: 'move', id, slot })) { this.moveMode = false; this.select(id); } return; }
      if (u) { this.audio.tap(); this.select(u.id === this.selected ? null : u.id); } else this.select(null);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { this.drag = null; });
  }

  // ---------- 시트 ----------
  openSheet(kind: string): void {
    this.closeSheet(); this.sheet = kind;
    if (this.mode === 'solo' && this.screen === 'game') this.paused = true;
    const titles: Record<string, string> = { craft: '조합 — 신화', upgrade: '강화', team: '팀', help: '게임 방법', menu: '설정 / 메뉴' };
    const body = h('div', { id: 'sheet-body' });
    const sheet = h('div', { class: 'sheet', id: 'sheet', onclick: (e: Event) => { if (e.target === sheet) this.closeSheet(); } },
      h('div', { class: 'panel' }, h('div', { class: 'head' }, h('b', {}, titles[kind] ?? kind), h('button', { class: 'icon close', onclick: () => this.closeSheet() }, '✕')), body));
    document.body.append(sheet); this.refreshSheet();
  }
  refreshSheet(): void {
    const body = document.getElementById('sheet-body'); if (!body || !this.sheet) return; clear(body);
    const s = this.state; const k = this.sheet;
    if (k === 'craft' && s) body.append(craftPanel(s, id => { if (this.act({ type: 'craft', id })) this.closeSheet(); }));
    else if (k === 'upgrade' && s) body.append(upgradePanel(s, { summon: () => this.act({ type: 'upgradeSummon' }), atk: () => this.act({ type: 'upgradeAtk' }) }));
    else if (k === 'team' && s) body.append(teamPanel(s, this.client?.room?.you ?? '', (this.client?.room?.players ?? []).map(p => ({ ...p, summary: p.pid === this.client?.room?.you ? summary(s) : (this.peers.get(p.pid)?.summary ?? p.summary) })), {
      send: (pid, amount) => { if (this.act({ type: 'sendGold', amount })) { this.client?.sendGold(pid, amount); this.toast(`${amount} 골드를 보냈습니다`, 'good'); } },
      emote: text => { this.client?.emote(text); this.closeSheet(); } }));
    else if (k === 'help') body.append(helpPanel());
    else if (k === 'menu') body.append(this.menuPanel());
    else if (s == null && (k === 'craft' || k === 'upgrade' || k === 'team')) body.append(h('p', { class: 'dim' }, '게임 중에만 열 수 있습니다'));
  }
  private menuPanel(): HTMLElement {
    const box = h('div', {});
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => h('div', { class: 'card row' }, h('b', { class: 'grow' }, label), h('button', { class: 'btn small' + (get() ? ' active' : ''), onclick: (e: Event) => { set(!get()); (e.target as HTMLElement).classList.toggle('active', get()); (e.target as HTMLElement).textContent = get() ? '켜짐' : '꺼짐'; this.save(); } }, get() ? '켜짐' : '꺼짐'));
    box.append(toggle('효과음', () => this.settings.sound, v => { this.settings.sound = v; this.audio.enabled = v; }));
    box.append(h('div', { class: 'card row' }, h('b', { class: 'grow' }, '음량'), h('input', { type: 'range', min: '0', max: '1', step: '0.1', value: String(this.settings.volume), oninput: (e: Event) => { const v = Number((e.target as HTMLInputElement).value); this.settings.volume = v; this.audio.setVolume(v); this.save(); } })));
    box.append(toggle('연출 줄이기(저사양)', () => this.settings.lowFx, v => { this.settings.lowFx = v; if (this.renderer) this.renderer.fx.low = v; }));
    if (this.screen === 'game') {
      if (this.mode === 'solo') box.append(h('div', { class: 'card row' }, h('b', { class: 'grow' }, '속도'), ...[1, 2].map(v => h('button', { class: 'btn small' + (this.speed === v ? ' active' : ''), onclick: () => { this.speed = v; const b = document.getElementById('btn-speed'); if (b) b.textContent = v + '×'; this.refreshSheet(); } }, `${v}×`))));
      box.append(h('div', { class: 'card small dim' }, `FPS ${this.fps.toFixed(0)} · ${this.mode === 'multi' ? (this.netKind === 'p2p' ? 'P2P' : '서버') + ' 연결' : '솔로'}`));
      box.append(h('button', { class: 'btn small', onclick: () => { this.closeSheet(); this.openSheet('help'); } }, '게임 방법'));
      box.append(h('div', { style: 'height:8px' }));
      box.append(h('button', { class: 'btn danger', style: 'width:100%', onclick: () => { if (confirm('게임을 나갈까요? 진행 상황은 저장되지 않습니다.')) { this.closeSheet(); this.showTitle(); } } }, '게임 나가기'));
    }
    return box;
  }
  closeSheet(): void { const el = document.getElementById('sheet'); if (el) el.remove(); this.sheet = null; if (this.mode === 'solo') this.paused = this.userPaused; }

  // ---------- 알림 ----------
  toast(text: string, kind = ''): void {
    const now = performance.now(); if (text === this.lastToast && now - this.lastToastAt < 1500) return; this.lastToast = text; this.lastToastAt = now;
    const box = document.getElementById('toasts'); if (!box) { this.toastNow(text, kind); return; }
    const t = h('div', { class: 'toast ' + kind }, text); box.append(t); while (box.children.length > 4) box.firstChild!.remove(); setTimeout(() => t.remove(), 2300);
  }
  toastNow(text: string, kind = ''): void {
    let box = document.getElementById('toasts-global'); if (!box) { box = h('div', { id: 'toasts-global', class: 'toasts', style: 'position:fixed;top:calc(var(--sat) + 10px);z-index:50' }); document.body.append(box); }
    const t = h('div', { class: 'toast ' + kind }, text); box.append(t); setTimeout(() => t.remove(), 2300);
  }
  banner(text: string, boss: boolean): void { const wrap = document.getElementById('boardwrap'); if (!wrap) return; const b = h('div', { class: 'banner' + (boss ? ' boss' : '') }, text); wrap.append(b); setTimeout(() => b.remove(), 1700); }
  showOverlay(title: string, text: string, buttons: [string, () => void][]): void {
    const ov = document.getElementById('overlay'); if (!ov) return; clear(ov); ov.classList.remove('hidden');
    ov.append(h('h2', { style: 'margin:0' }, title), text ? h('p', { class: 'dim small', style: 'margin:0' }, text) : '', h('div', { class: 'row wrap', style: 'justify-content:center' }, ...buttons.map(([l, f]) => h('button', { class: 'btn', onclick: f }, l))));
  }
  hideOverlay(): void { const ov = document.getElementById('overlay'); if (ov) { ov.classList.add('hidden'); clear(ov); } }
  private onVisibility(): void {
    if (this.screen !== 'game' || !this.state) return;
    if (document.hidden) { this.hiddenAt = performance.now(); if (this.mode === 'solo' && !this.userPaused && isAlive(this.state)) this.togglePause(); }
    else if (this.mode === 'multi' && this.hiddenAt) {
      const missed = Math.min(90, (performance.now() - this.hiddenAt) / 1000); this.hiddenAt = 0;
      const steps = Math.floor(missed / DT); for (let i = 0; i < steps; i++) step(this.state, DT); this.state.events.length = 0; this.lastT = performance.now();
    }
  }

  // ---------- 종료 ----------
  private onMultiEnd(results: ResultRow[], won: boolean): void {
    const s = this.state; if (s) { finish(s); s.events.length = 0; }
    this.results = results; this.won = won;
    this.showResult();
  }
  showResult(): void {
    const s = this.state; if (!s) { this.showTitle(); return; }
    this.running = false; if (this.endTimer) { clearTimeout(this.endTimer); this.endTimer = null; } this.closeSheet();
    const wonSolo = s.phase === 'won'; const won = this.mode === 'multi' ? (wonSolo || (this.won && s.phase === 'won')) : wonSolo;
    if (!this.recorded) {
      this.recorded = true; const r = this.records; r.games++; if (won) r.wins++; r.bestRound = Math.max(r.bestRound, s.stats.roundReached); r.bestKills = Math.max(r.bestKills, s.stats.kills); r.mythics += s.stats.mythics.length; if (this.mode === 'multi') r.coop++; this.save();
    }
    const you = this.client?.room?.you ?? '';
    const isHost = this.client?.isHost ?? false;
    const el = h('div', { class: 'center result' },
      h('h1', { class: won ? 'win' : 'lose' }, won ? '🏆 방어 성공!' : '💀 탈락'),
      h('p', { class: 'dim' }, won ? `${TOTAL_ROUNDS}라운드를 모두 막아냈습니다` : `${s.eliminatedRound || s.round}라운드 — ${s.eliminatedReason}`),
      h('div', { class: 'statgrid' },
        h('div', { class: 'card' }, h('b', {}, String(s.stats.roundReached)), h('span', { class: 'dim small' }, '도달 라운드')),
        h('div', { class: 'card' }, h('b', {}, String(s.stats.kills)), h('span', { class: 'dim small' }, `처치 (보스 ${s.stats.bossKills})`)),
        h('div', { class: 'card' }, h('b', {}, fmtNum(s.stats.damage)), h('span', { class: 'dim small' }, '누적 피해')),
        h('div', { class: 'card' }, h('b', {}, `${s.stats.summons} / ${s.stats.merges}`), h('span', { class: 'dim small' }, '소환 / 합성')),
        h('div', { class: 'card' }, h('b', {}, GRADE_NAMES[s.stats.peakGrade]), h('span', { class: 'dim small' }, '최고 등급')),
        h('div', { class: 'card' }, h('b', {}, String(s.stats.mythics.length)), h('span', { class: 'dim small' }, '신화 조합'))),
      s.units.length ? h('div', { class: 'row wrap', style: 'justify-content:center;max-width:420px' }, ...s.units.slice().sort((a, b) => b.dmg - a.dmg).slice(0, 6).map(u => h('div', { class: 'col', style: 'align-items:center' }, spriteEl(u.kind, u.grade, 40), h('span', { class: 'small dim' }, fmtNum(u.dmg))))) : null,
      this.results ? h('div', { style: 'width:100%;max-width:460px' }, h('h3', {}, this.won ? '팀 결과 — 협동 승리!' : '팀 결과'), resultTable(this.results, you)) : null,
      h('div', { class: 'row wrap', style: 'justify-content:center' },
        this.mode === 'solo' ? h('button', { class: 'btn primary', onclick: () => this.startSolo() }, '다시 하기') : (isHost ? h('button', { class: 'btn primary', onclick: () => { this.client?.again(); } }, '같은 방에서 다시') : h('span', { class: 'dim small' }, '방장이 "다시"를 누르면 로비로 돌아갑니다')),
        h('button', { class: 'btn', onclick: () => this.showTitle() }, '처음으로')));
    this.mount('result', el);
  }

  private teardown(): void {
    this.running = false; if (this.endTimer) { clearTimeout(this.endTimer); this.endTimer = null; }
    this.closeSheet();
    const c = this.client; this.client = null; if (c) { try { c.leave(); } catch { /* ignore */ } }
    if (this.peerHandle) { const p = this.peerHandle; this.peerHandle = null; setTimeout(() => p.close(), 200); }
    if (this.room) { const r = this.room; this.room = null; setTimeout(() => r.destroy(), 100); }
    this.state = null; this.renderer = null; this.peers.clear(); this.viewPid = null; this.gameStarted = false; this.roomView = null; this.netKind = null; this.roomCode = '';
    this.selected = null; this.moveMode = false; this.drag = null; this.results = null; this.won = false; this.reconnecting = false;
  }
}
