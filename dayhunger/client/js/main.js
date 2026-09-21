// 데이헝거 클라이언트 진입점: 화면 전환, 솔로/협동 세션, 메인 루프.
import * as C from '../../shared/constants.js';
import { Game } from '../../shared/game.js';
import { View } from './view.js';
import { Net } from './net.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { DEFAULT_SERVER } from './config.js';

const $ = (id) => document.getElementById(id);
const ui = new UI();
const view = new View();
const renderer = new Renderer($('game'), $('minimap'));
const input = new Input({ joy: $('joy'), knob: $('joy-knob'), actionBtn: $('btn-action'), canvas: $('game') });
const net = new Net();

const S = { session: null, myId: null, isNet: false, isHost: false, name: '', hoverTile: null, overlayShown: false, lastInputSent: 0, lastInput: '' };

// ---------- 세션: 솔로(로컬 시뮬레이션) ----------
class LocalSession {
  constructor(name, cls, map, difficulty) {
    this.game = new Game({ map, difficulty });
    const p = this.game.addPlayer(name, cls);
    this.playerId = p.id;
    this.acc = 0; this.paused = false;
    view.reset(); view.applyFull(this.game.fullState());
  }
  update(dt) {
    if (this.paused) return;
    this.acc = Math.min(this.acc + dt, 250);
    const step = 1000 / C.TICK_RATE;
    while (this.acc >= step) { this.acc -= step; this.game.tick(); view.applyDelta(this.game.delta()); }
  }
  sendInput(i) { this.game.setInput(this.playerId, i); }
  build(key, x, y) { this.result(this.game.build(this.playerId, key, x, y)); }
  repair(x, y) { this.result(this.game.repair(this.playerId, x, y)); }
  dismantle(x, y) { this.result(this.game.dismantle(this.playerId, x, y)); }
  eat() { this.result(this.game.eat(this.playerId)); }
  say(i) { this.game.say(this.playerId, i); }
  continueEndless() { this.game.continueEndless(); view.applyDelta(this.game.delta()); }
  result(r) { if (r && r.ok === false && r.reason) ui.toast(r.reason); }
  destroy() {}
}
// ---------- 세션: 협동(서버가 시뮬레이션) ----------
class NetSession {
  constructor(playerId) { this.playerId = playerId; }
  update() {}
  sendInput(i) { net.send({ type: 'input', ...i }); }
  build(key, x, y) { net.send({ type: 'build', key, x, y }); }
  repair(x, y) { net.send({ type: 'repair', x, y }); }
  dismantle(x, y) { net.send({ type: 'dismantle', x, y }); }
  eat() { net.send({ type: 'eat' }); }
  say(i) { net.send({ type: 'say', index: i }); }
  continueEndless() { net.send({ type: 'continue' }); }
  destroy() {}
}

// ---------- 메뉴 ----------
const savedName = (() => { try { return localStorage.getItem('dh_name') || ''; } catch { return ''; } })();
$('name').value = savedName;
const getName = () => { const n = ($('name').value || '').trim() || '생존자'; try { localStorage.setItem('dh_name', n); } catch {} return n; };
const menuMsg = (m, ok) => { ui.el.menuMsg.textContent = m; ui.el.menuMsg.style.color = ok ? 'var(--ok)' : 'var(--danger)'; };

// ---------- 협동 서버 주소 ----------
const IS_APP = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const NEEDS_SERVER = IS_APP || !/^https?:$/.test(location.protocol);
const serverInput = $('server');
const savedServer = (() => { try { return localStorage.getItem('dh_server') || ''; } catch { return ''; } })();
serverInput.value = savedServer || DEFAULT_SERVER;
const getServer = () => { const v = serverInput.value.trim(); try { localStorage.setItem('dh_server', v); } catch {} return v; };
const refreshServerSummary = () => { $('server-summary').textContent = serverInput.value.trim() ? `(${serverInput.value.trim()})` : (NEEDS_SERVER ? '(입력 필요)' : '(현재 주소)'); };
serverInput.addEventListener('input', refreshServerSummary); refreshServerSummary();
if (NEEDS_SERVER) $('server-box').open = true;
async function connectOrExplain() {
  const base = getServer();
  try { await net.connect(base); return true; }
  catch (err) {
    if (err && err.message === 'no-server') { menuMsg('협동 서버 주소를 입력하세요 (아래 "협동 서버 주소")'); $('server-box').open = true; serverInput.focus(); }
    else menuMsg(base ? `서버(${base})에 연결할 수 없어요. 주소와 서버 실행 여부를 확인하세요.` : '서버에 연결할 수 없어요. 서버(npm start)가 켜져 있는지 확인하세요.');
    return false;
  }
}

// ---------- 전장/난이도/캐릭터 선택 (저장됨) ----------
const pref = (k, def, valid) => { try { const v = localStorage.getItem(k); return valid[v] ? v : def; } catch { return def; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const SEL = { map: pref('dh_map', C.DEFAULT_MAP, C.MAPS), difficulty: pref('dh_diff', C.DEFAULT_DIFFICULTY, C.DIFFICULTIES), cls: pref('dh_cls', C.DEFAULT_CLASS, C.CLASSES) };
function renderSetup() {
  ui.renderCards($('setup-map'), C.MAPS, SEL.map, (k) => { SEL.map = k; setPref('dh_map', k); ui.markCard($('setup-map'), k); });
  ui.renderCards($('setup-diff'), C.DIFFICULTIES, SEL.difficulty, (k) => { SEL.difficulty = k; setPref('dh_diff', k); ui.markCard($('setup-diff'), k); });
  ui.renderCards($('setup-class'), C.CLASSES, SEL.cls, (k) => { SEL.cls = k; setPref('dh_cls', k); ui.markCard($('setup-class'), k); });
}
$('btn-solo').addEventListener('click', () => { S.name = getName(); renderSetup(); ui.showScreen('setup'); });
$('setup-start').addEventListener('click', () => startLocal());
$('setup-back').addEventListener('click', () => ui.showScreen('menu'));
ui.onLobbySettings = (map, difficulty) => net.send({ type: 'settings', map, difficulty });
ui.onLobbyClass = (cls) => { SEL.cls = cls; setPref('dh_cls', cls); net.send({ type: 'class', cls }); };
$('btn-create').addEventListener('click', async () => {
  S.name = getName(); menuMsg('서버에 연결하는 중…', true);
  if (await connectOrExplain()) net.send({ type: 'create', name: S.name, cls: SEL.cls });
});
$('btn-join').addEventListener('click', async () => {
  const code = ($('code').value || '').trim().toUpperCase();
  if (code.length !== 4) { menuMsg('방 코드 4자리를 입력하세요'); return; }
  S.name = getName(); menuMsg('서버에 연결하는 중…', true);
  if (await connectOrExplain()) net.send({ type: 'join', code, name: S.name, cls: SEL.cls });
});
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
$('btn-start').addEventListener('click', () => net.send({ type: 'start' }));
$('btn-leave').addEventListener('click', () => { net.send({ type: 'leave' }); net.close(); toMenu(); });
$('btn-build').addEventListener('click', () => {
  if (ui.buildKey) { ui.setBuildKey(null); ui.closePanels(); ui.toast('건설 취소'); return; }
  const shown = ui.togglePanel('build');
  if (shown) ui.updateAffordability(view.me(S.myId));
});
$('btn-build-close').addEventListener('click', () => ui.togglePanel('build', false));
$('btn-chat').addEventListener('click', () => ui.togglePanel('chat'));
$('btn-chat-close').addEventListener('click', () => ui.togglePanel('chat', false));
$('btn-eat').addEventListener('click', () => S.session && S.session.eat());
$('btn-again').addEventListener('click', () => { if (S.isNet) net.send({ type: 'restart' }); else startLocal(); });
$('btn-continue').addEventListener('click', () => { S.session && S.session.continueEndless(); ui.hideOverlay(); S.overlayShown = false; });
$('btn-menu').addEventListener('click', () => { if (S.isNet) { net.send({ type: 'leave' }); net.close(); } toMenu(); });

ui.onSelectBuild = (key) => { ui.setBuildKey(key); ui.togglePanel('build', false); };
ui.onChat = (i) => { S.session && S.session.say(i); ui.togglePanel('chat', false); };

input.onTap = (sx, sy) => {
  if (!S.session || !ui.buildKey) return;
  const { tx, ty } = renderer.screenToTile(sx, sy);
  if (ui.buildKey === 'REPAIR') S.session.repair(tx, ty);
  else if (ui.buildKey === 'DISMANTLE') S.session.dismantle(tx, ty);
  else S.session.build(ui.buildKey, tx, ty);
};
input.onHover = (sx, sy) => { S.hoverTile = sx == null ? null : renderer.screenToTile(sx, sy); };
input.onZoom = (f) => renderer.setZoom(renderer.zoom * f);
input.onKey = (key, code) => {
  if (!S.session) return;
  if (key === 'e') S.session.eat();
  else if (key === 'b') $('btn-build').click();
  else if (key === 'c') $('btn-chat').click();
  else if (key === 'escape') { ui.setBuildKey(null); ui.closePanels(); }
  else if (key === '+' || key === '=') renderer.setZoom(renderer.zoom * 1.1);
  else if (key === '-') renderer.setZoom(renderer.zoom * 0.9);
  else if (/^[0-9]$/.test(key)) { const keys = [...Object.keys(C.BUILDINGS), 'REPAIR', 'DISMANTLE']; const k = keys[(+key + 9) % 10]; if (k) ui.onSelectBuild(k); }
  void code;
};

// ---------- 네트워크 이벤트 ----------
net.on('lobby', (info) => {
  S.isNet = true; S.isHost = ui.lobby(info, SEL.cls);
  if (info.state === 'lobby') { ui.showScreen('lobby'); endSession(); }
});
net.on('error', (m) => { menuMsg(m.msg); ui.el.lobbyHint.textContent = m.msg; ui.el.lobbyHint.style.color = 'var(--danger)'; });
net.on('start', (m) => { S.myId = m.playerId; view.reset(); beginSession(new NetSession(m.playerId), true); });
net.on('full', (f) => view.applyFull(f));
net.on('delta', (d) => view.applyDelta(d));
net.on('toast', (m) => ui.toast(m.msg));
net.on('close', () => { if (S.session || !ui.el.screens.lobby.classList.contains('hidden')) { toMenu(); menuMsg('서버와 연결이 끊겼어요'); } });

// ---------- 세션 시작/종료 ----------
function startLocal() {
  S.isNet = false; S.isHost = true; S.name = getName();
  const s = new LocalSession(S.name, SEL.cls, SEL.map, SEL.difficulty);
  S.myId = s.playerId;
  beginSession(s, false);
}
function beginSession(session, isNet) {
  endSession();
  S.session = session; S.isNet = isNet; S.overlayShown = false;
  ui.hideOverlay(); ui.setBuildKey(null); ui.closePanels();
  ui.showScreen('game'); input.enabled = true;
  renderer.resize();
  ui.renderBuildList(S.isNet ? SEL.cls : session.game.players.get(S.myId).cls);
  view.onEvent = (e) => {
    if (e.type === 'night') ui.toast(e.boss ? '🌙👑 괴수가 온다! 벽 뒤로!' : '🌙 밤이 왔다! 벽 뒤로!', 2500);
    if (e.type === 'dawn') ui.toast('🌞 아침이다. 보급 도착!', 2000);
    if (e.type === 'steal') ui.toast('🦝 도둑이다! 잡으면 되찾을 수 있어요', 2000);
  };
}
function endSession() { if (S.session) { S.session.destroy(); S.session = null; } input.enabled = false; }
function toMenu() { endSession(); ui.hideOverlay(); ui.showScreen('menu'); S.isNet = false; }

document.addEventListener('visibilitychange', () => { if (S.session instanceof LocalSession) S.session.paused = document.hidden; });

// ---------- 메인 루프 ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(100, now - last); last = now;
  if (S.session) {
    S.session.update(dt);
    const inp = input.vector();
    const key = `${inp.mx},${inp.my},${inp.action}`;
    if (key !== S.lastInput || now - S.lastInputSent > 200) { S.session.sendInput(inp); S.lastInput = key; S.lastInputSent = now; }
    const me = view.me(S.myId);
    renderer.draw(view, S.myId, { buildKey: ui.buildKey, hoverTile: S.hoverTile });
    ui.updateHud(view, me);
    if (!ui.el.buildpanel.classList.contains('hidden')) ui.updateAffordability(me);
    if (view.over && !S.overlayShown) { S.overlayShown = true; ui.setBuildKey(null); ui.closePanels(); ui.showOverlay(view, { isHost: S.isHost, isNet: S.isNet, alivePlayers: view.players }); }
    if (!view.over && S.overlayShown) { S.overlayShown = false; ui.hideOverlay(); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
ui.showScreen('menu');
// ---------- 안드로이드 뒤로가기 (Capacitor App 플러그인) ----------
const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
if (capApp && capApp.addListener) {
  let backAt = 0;
  capApp.addListener('backButton', () => {
    const inGame = !ui.el.screens.game.classList.contains('hidden');
    const inLobby = !ui.el.screens.lobby.classList.contains('hidden');
    if (inGame) {
      if (!ui.el.buildpanel.classList.contains('hidden') || !ui.el.chatpanel.classList.contains('hidden')) { ui.closePanels(); return; }
      if (ui.buildKey) { ui.setBuildKey(null); return; }
      const now = Date.now();
      if (now - backAt < 2000) { $('btn-menu').click(); return; }
      backAt = now; ui.toast('한 번 더 누르면 메뉴로 나갑니다');
    } else if (inLobby) { $('btn-leave').click(); }
    else if (!ui.el.screens.setup.classList.contains('hidden')) { ui.showScreen('menu'); }
    else if (capApp.exitApp) capApp.exitApp();
  });
}
// ---------- PWA: 오프라인 솔로 플레이용 서비스 워커 (앱 안에서는 불필요) ----------
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !IS_APP) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
// 디버그/테스트용 훅 (e2e 스크립트가 사용)
window.__dh = { S, view, C, net, renderer };
