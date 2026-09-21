// 데이헝거 클라이언트 진입점: 화면 전환, 솔로/협동 세션, 프로필(경험치·강화·해금), 특전, 결과, 효과음, 메인 루프.
import * as C from '../../shared/constants.js';
import { Game } from '../../shared/game.js';
import { View } from './view.js';
import { Net } from './net.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { DEFAULT_SERVER } from './config.js';
import { Profile, xpToNext } from './profile.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const ui = new UI();
const view = new View();
const renderer = new Renderer($('game'), $('minimap'));
const input = new Input({ joy: $('joy'), knob: $('joy-knob'), actionBtn: $('btn-action'), canvas: $('game') });
const net = new Net();
const profile = new Profile();
const sound = new Sound();
sound.enabled = profile.data.settings.sound !== false;

const S = { session: null, myId: null, isNet: false, isHost: false, name: '', hoverTile: null, lastInputSent: 0, lastInput: '', daily: false, overShown: false, recorded: 0, snapshot: null, perkShown: false, tipIndex: 0, tipShown: false, tipAt: 0 };
const vibrate = (ms) => { if (profile.data.settings.vibrate !== false && navigator.vibrate) { try { navigator.vibrate(ms); } catch {} } };
window.addEventListener('pointerdown', () => sound.unlock(), { passive: true });
document.addEventListener('click', (e) => { if (e.target.closest('button')) sound.play('click'); });

// ---------- 세션: 솔로(로컬 시뮬레이션) ----------
class LocalSession {
  constructor(name, cls, map, difficulty, meta, seed) {
    this.game = new Game({ map, difficulty, ...(seed ? { seed } : {}) });
    const p = this.game.addPlayer(name, cls, meta);
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
  perk(key) { this.result(this.game.choosePerk(this.playerId, key)); view.applyDelta(this.game.delta()); }
  continueEndless() { this.game.continueEndless(); view.applyDelta(this.game.delta()); }
  result(r) { if (r && r.ok === false && r.reason) ui.toast(r.reason); }
  destroy() {}
}
// ---------- 세션: 협동(서버가 시뮬레이션) ----------
class NetSession {
  constructor(playerId) { this.playerId = playerId; this.paused = false; }
  update() {}
  sendInput(i) { net.send({ type: 'input', ...i }); }
  build(key, x, y) { net.send({ type: 'build', key, x, y }); }
  repair(x, y) { net.send({ type: 'repair', x, y }); }
  dismantle(x, y) { net.send({ type: 'dismantle', x, y }); }
  eat() { net.send({ type: 'eat' }); }
  say(i) { net.send({ type: 'say', index: i }); }
  perk(key) { net.send({ type: 'perk', key }); }
  continueEndless() { net.send({ type: 'continue' }); }
  destroy() {}
}

// ---------- 메뉴 ----------
const savedName = (() => { try { return localStorage.getItem('dh_name') || ''; } catch { return ''; } })();
$('name').value = savedName;
const getName = () => { const n = ($('name').value || '').trim() || '생존자'; try { localStorage.setItem('dh_name', n); } catch {} return n; };
const menuMsg = (m, ok) => { ui.el.menuMsg.textContent = m; ui.el.menuMsg.style.color = ok ? 'var(--ok)' : 'var(--danger)'; };
const refreshMenu = () => ui.menu(profile, profile.dailyInfo());

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

// ---------- 전장/난이도/캐릭터 선택 (저장됨, 해금 확인) ----------
const pref = (k, def, valid) => { try { const v = localStorage.getItem(k); return valid[v] ? v : def; } catch { return def; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const SEL = { map: pref('dh_map', C.DEFAULT_MAP, C.MAPS), difficulty: pref('dh_diff', C.DEFAULT_DIFFICULTY, C.DIFFICULTIES), cls: pref('dh_cls', C.DEFAULT_CLASS, C.CLASSES) };
function ensureUnlocked() {
  if (!profile.isUnlocked('maps', SEL.map)) SEL.map = C.DEFAULT_MAP;
  if (!profile.isUnlocked('difficulties', SEL.difficulty)) SEL.difficulty = C.DEFAULT_DIFFICULTY;
  if (!profile.isUnlocked('classes', SEL.cls)) SEL.cls = C.DEFAULT_CLASS;
}
const lockText = (kind) => (k) => (profile.isUnlocked(kind, k) ? null : profile.unlockText(kind, k));
function renderSetup(daily) {
  ensureUnlocked();
  ui.el.setupTitle.textContent = daily ? '📆 오늘의 도전' : '게임 설정';
  ui.el.setupNote.classList.toggle('hidden', !daily);
  if (daily) { const d = profile.dailyInfo(); ui.el.setupNote.textContent = `${d.date} · 전장과 난이도는 오늘 모두에게 같습니다 (해금 없이 도전 가능). 3일 생존 시 +5💠`; }
  ui.renderCards($('setup-map'), C.MAPS, daily ? profile.dailyInfo().map : SEL.map, (k) => { SEL.map = k; setPref('dh_map', k); ui.markCard($('setup-map'), k); }, { disabled: daily, lockText: daily ? null : lockText('maps') });
  ui.renderCards($('setup-diff'), C.DIFFICULTIES, daily ? profile.dailyInfo().difficulty : SEL.difficulty, (k) => { SEL.difficulty = k; setPref('dh_diff', k); ui.markCard($('setup-diff'), k); }, { disabled: daily, lockText: daily ? null : lockText('difficulties') });
  ui.renderCards($('setup-class'), C.CLASSES, SEL.cls, (k) => { SEL.cls = k; setPref('dh_cls', k); ui.markCard($('setup-class'), k); }, { lockText: lockText('classes') });
}
$('btn-solo').addEventListener('click', () => { S.name = getName(); S.daily = false; renderSetup(false); ui.showScreen('setup'); });
$('btn-daily').addEventListener('click', () => { S.name = getName(); S.daily = true; renderSetup(true); ui.showScreen('setup'); });
$('setup-start').addEventListener('click', () => startLocal());
$('setup-back').addEventListener('click', () => ui.showScreen('menu'));
$('btn-profile').addEventListener('click', () => { ui.renderProfile(profile); ui.showScreen('profile'); });
$('profile-back').addEventListener('click', () => { refreshMenu(); ui.showScreen('menu'); });
function openUpgrades() {
  ui.renderUpgrades(profile, (key) => { if (profile.buy(key)) { sound.play('perk'); openUpgrades(); } });
  ui.showScreen('upgrade');
}
$('btn-upgrade').addEventListener('click', openUpgrades);
$('upgrade-back').addEventListener('click', () => { refreshMenu(); ui.showScreen('menu'); });
// 설정
const setSound = $('set-sound'), setVib = $('set-vibrate'), pauseSound = $('pause-sound');
setSound.checked = profile.data.settings.sound !== false; setVib.checked = profile.data.settings.vibrate !== false; pauseSound.checked = setSound.checked;
const applySound = (on) => { profile.data.settings.sound = on; sound.enabled = on; setSound.checked = on; pauseSound.checked = on; profile.save(); };
setSound.addEventListener('change', () => applySound(setSound.checked));
pauseSound.addEventListener('change', () => applySound(pauseSound.checked));
setVib.addEventListener('change', () => { profile.data.settings.vibrate = setVib.checked; profile.save(); });
$('btn-settings').addEventListener('click', () => $('settings-modal').classList.remove('hidden'));
$('btn-settings-close').addEventListener('click', () => $('settings-modal').classList.add('hidden'));
$('set-zoom-reset').addEventListener('click', () => { renderer.setZoom(1); menuMsg('화면 크기를 초기화했어요', true); });
$('set-tips-reset').addEventListener('click', () => { profile.data.tipsSeen = false; profile.save(); menuMsg('다음 판에 도움말이 다시 나옵니다', true); });
$('set-data-reset').addEventListener('click', () => { if (confirm('레벨·포인트·강화·업적·기록이 모두 지워집니다. 정말 초기화할까요?')) { profile.reset(); refreshMenu(); applySound(true); menuMsg('초기화했어요', true); } });

$('btn-create').addEventListener('click', async () => {
  S.name = getName(); ensureUnlocked(); menuMsg('서버에 연결하는 중…', true);
  if (await connectOrExplain()) net.send({ type: 'create', name: S.name, cls: SEL.cls, meta: profile.meta });
});
$('btn-join').addEventListener('click', async () => {
  const code = ($('code').value || '').trim().toUpperCase();
  if (code.length !== 4) { menuMsg('방 코드 4자리를 입력하세요'); return; }
  S.name = getName(); ensureUnlocked(); menuMsg('서버에 연결하는 중…', true);
  if (await connectOrExplain()) net.send({ type: 'join', code, name: S.name, cls: SEL.cls, meta: profile.meta });
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
$('btn-continue').addEventListener('click', () => { S.session && S.session.continueEndless(); ui.hideOverlay(); S.overShown = false; });
$('btn-menu').addEventListener('click', () => { if (S.isNet) { net.send({ type: 'leave' }); net.close(); } toMenu(); });
// 일시정지 (솔로)
const setPaused = (on) => { if (!(S.session instanceof LocalSession)) return; S.session.paused = on; ui.showPause(on); };
$('btn-pause').addEventListener('click', () => setPaused(true));
$('btn-resume').addEventListener('click', () => setPaused(false));
$('btn-pause-menu').addEventListener('click', () => { ui.showPause(false); recordIfNeeded(true); toMenu(); });

ui.onSelectBuild = (key) => { ui.setBuildKey(key); ui.togglePanel('build', false); };
ui.onChat = (i) => { S.session && S.session.say(i); ui.togglePanel('chat', false); };
ui.onLobbySettings = (map, difficulty) => net.send({ type: 'settings', map, difficulty });
ui.onLobbyClass = (cls) => { SEL.cls = cls; setPref('dh_cls', cls); net.send({ type: 'class', cls, meta: profile.meta }); };

input.onTap = (sx, sy) => {
  if (!S.session || !ui.buildKey) return;
  const { tx, ty } = renderer.screenToTile(sx, sy);
  if (ui.buildKey === 'REPAIR') S.session.repair(tx, ty);
  else if (ui.buildKey === 'DISMANTLE') S.session.dismantle(tx, ty);
  else S.session.build(ui.buildKey, tx, ty);
};
input.onHover = (sx, sy) => { S.hoverTile = sx == null ? null : renderer.screenToTile(sx, sy); };
input.onZoom = (f) => renderer.setZoom(renderer.zoom * f);
input.onKey = (key) => {
  if (!S.session) return;
  if (key === 'e') S.session.eat();
  else if (key === 'b') $('btn-build').click();
  else if (key === 'c') $('btn-chat').click();
  else if (key === 'p') setPaused(!S.session.paused);
  else if (key === 'escape') { if (ui.buildKey || !ui.el.buildpanel.classList.contains('hidden') || !ui.el.chatpanel.classList.contains('hidden')) { ui.setBuildKey(null); ui.closePanels(); } else setPaused(!S.session.paused); }
  else if (key === '+' || key === '=') renderer.setZoom(renderer.zoom * 1.1);
  else if (key === '-') renderer.setZoom(renderer.zoom * 0.9);
  else if (/^[0-9]$/.test(key)) { const keys = [...Object.keys(C.BUILDINGS), 'REPAIR', 'DISMANTLE']; const k = keys[(+key + 9) % 10]; if (k) ui.onSelectBuild(k); }
};

// ---------- 네트워크 이벤트 ----------
net.on('lobby', (info) => {
  S.isNet = true; S.isHost = ui.lobby(info, SEL.cls, profile);
  if (info.state === 'lobby') { ui.showScreen('lobby'); endSession(); }
});
net.on('error', (m) => { menuMsg(m.msg); ui.el.lobbyHint.textContent = m.msg; ui.el.lobbyHint.style.color = 'var(--danger)'; });
net.on('start', (m) => { S.myId = m.playerId; view.reset(); beginSession(new NetSession(m.playerId), true); });
net.on('full', (f) => view.applyFull(f));
net.on('delta', (d) => view.applyDelta(d));
net.on('toast', (m) => ui.toast(m.msg));
net.on('close', () => { if (S.session || !ui.el.screens.lobby.classList.contains('hidden')) { recordIfNeeded(true); toMenu(); menuMsg('서버와 연결이 끊겼어요'); } });

// ---------- 세션 시작/종료 ----------
function startLocal() {
  S.isNet = false; S.isHost = true; S.name = getName(); ensureUnlocked();
  const d = S.daily ? profile.dailyInfo() : null;
  const s = new LocalSession(S.name, SEL.cls, d ? d.map : SEL.map, d ? d.difficulty : SEL.difficulty, profile.meta, d ? d.seed : 0);
  S.myId = s.playerId;
  beginSession(s, false);
}
function beginSession(session, isNet) {
  endSession();
  S.session = session; S.isNet = isNet; S.overShown = false; S.recorded = 0; S.snapshot = null; S.perkShown = false; S.tipIndex = 0; S.tipShown = false;
  ui.hideOverlay(); ui.hidePerkModal(); ui.showPause(false); ui.setBuildKey(null); ui.closePanels(); ui.tip('');
  ui.el.btnPause.classList.toggle('hidden', isNet);
  ui.showScreen('game'); input.enabled = true;
  renderer.resize();
  view.onEvent = (e) => {
    if (e.type === 'night') { ui.toast(e.boss ? '🌙👑 괴수가 온다! 벽 뒤로!' : '🌙 밤이 왔다! 벽 뒤로!', 2500); sound.play(e.boss ? 'boss' : 'night'); if (e.boss) vibrate(120); }
    if (e.type === 'dawn') { ui.toast('🌞 아침이다. 보급 도착!', 2000); sound.play('dawn'); }
    if (e.type === 'steal') { ui.toast('🦝 도둑이다! 잡으면 되찾을 수 있어요', 2000); sound.play('steal'); }
    if (e.type === 'win') sound.play('win');
    if (e.type === 'gameover') sound.play('lose');
    if (e.type === 'revive') sound.play('revive');
    if (e.type === 'secondchance') ui.toast('💫 두 번째 기회! 5초 뒤 모닥불에서 부활', 2500);
    if (e.type === 'bossloot') ui.toast('🎁 괴수 전리품 획득!', 2000);
    if (e.type === 'perk' && e.name === S.name) sound.play('perk');
  };
  view.onFx = (f) => {
    const me = view.me(S.myId);
    const near = me && Math.hypot(f.x - me.x, f.y - me.y) < 12;
    switch (f.k) {
      case 'hit': if (near) sound.play(f.res === 'tree' ? 'chop' : f.res === 'rock' ? 'mine' : f.res === 'fish' ? 'splash' : 'pluck'); break;
      case 'blood': if (near) sound.play('hit'); break;
      case 'hurt': case 'spithit': if (near) sound.play('hurt'); if (me && Math.hypot(f.x - me.x, f.y - me.y) < 0.6) vibrate(30); break;
      case 'crack': if (near) sound.play('crack'); break;
      case 'build': sound.play('build'); break;
      case 'repair': sound.play('repair'); break;
      case 'eat': sound.play('eat'); break;
      case 'die': if (near) sound.play('kill'); break;
      case 'explosion': sound.play('explosion'); vibrate(60); break;
      case 'shot': if (near !== false) sound.play('shot'); break;
      case 'heal': sound.play('pluck'); break;
      default: break;
    }
  };
}
function endSession() { if (S.session) { S.session.destroy(); S.session = null; } input.enabled = false; ui.tip(''); }
function toMenu() { endSession(); ui.hideOverlay(); ui.hidePerkModal(); ui.showPause(false); refreshMenu(); ui.showScreen('menu'); S.isNet = false; S.daily = false; }

document.addEventListener('visibilitychange', () => { if (document.hidden && S.session instanceof LocalSession && !S.session.game.over) setPaused(true); });

// ---------- 결과 기록 (한 판에 한 번, 무한 모드는 추가분만) ----------
function buildRun(me) {
  const snap = S.snapshot;
  const st = me.stats || {};
  const gathered = {};
  for (const k of C.RES_KEYS) gathered[k] = ((st.gathered || {})[k] || 0) - ((snap && snap.gathered[k]) || 0);
  return {
    map: view.map, difficulty: view.difficulty, cls: me.cls, day: view.day, score: view.score, kills: me.kills - (snap ? snap.kills : 0),
    won: view.won && !snap, endless: !!snap, players: view.players.length, daily: S.daily, ticks: view.t - (snap ? snap.t : 0),
    stats: { ...st, gathered, built: (st.built || 0) - (snap ? snap.built : 0), fish: (st.fish || 0) - (snap ? snap.fish : 0), bossKills: (st.bossKills || 0) - (snap ? snap.bossKills : 0), eliteKills: st.eliteKills || 0, recovers: st.recovers || 0, perks: st.perks || 0 },
  };
}
function recordIfNeeded(forced = false) {
  const me = view.me(S.myId);
  if (!me || !view.ready || S.recorded >= 2 || (!view.over && !forced)) return null;
  if (S.recorded === 1 && !view.endless) return null;
  const run = buildRun(me);
  if (forced && run.day < 2 && !view.over) return null; // 1일째에 나가면 기록 안 함
  const xpBefore = profile.data.xp, levelBefore = profile.data.level;
  const r = profile.recordRun(run);
  r.xpBeforeRatio = xpBefore / xpToNext(levelBefore); r.xpAfterRatio = profile.xpProgress; r.levelAfter = profile.data.level;
  S.snapshot = { kills: me.kills, built: me.stats.built || 0, fish: me.stats.fish || 0, bossKills: me.stats.bossKills || 0, gathered: { ...(me.stats.gathered || {}) }, t: view.t };
  S.recorded = view.won ? 1 : 2;
  if (r.levelUps.length) sound.play('levelup');
  return r;
}

// ---------- 첫 판 도움말 ----------
const TIPS = [
  { text: '왼쪽 조이스틱으로 움직여 보세요. 화면 밖의 🔥 화살표가 기지 방향입니다.', when: () => true, done: (me) => Math.hypot(me.x - S.spawnX, me.y - S.spawnY) > 2.5 },
  { text: '나무 옆에서 ⛏️ 버튼을 꾹 누르면 나무를 벱니다. 바위·철광석·열매·물가(낚시)도 같은 버튼!', when: () => true, done: (me) => (me.stats.gathered.wood || 0) >= 4 },
  { text: '🧱 버튼 → 나무 벽 → 지을 곳을 탭. 모닥불 주변을 벽으로 둘러싸면 밤이 편해집니다.', when: () => true, done: (me) => (me.stats.built || 0) >= 1 },
  { text: '배고픔(🍖)이 줄어들면 🍎 버튼으로 먹으세요. 모닥불 근처에서 먹으면 더 찹니다.', when: (me) => me.hunger < 80, done: (me) => (me.stats.foodEaten || 0) >= 1 },
  { text: '밤에는 적이 몰려옵니다. 벽 안에서 ⛏️로 적을 때리세요. 아침이 오면 특전을 고를 수 있어요!', when: () => view.phase === 'night', done: () => view.phase === 'day' && view.day >= 2 },
];
function tickTips(me, now) {
  if (S.isNet || profile.data.tipsSeen || !me || !me.alive) return;
  if (S.perkShown || S.session.paused) { if (S.tipShown) { S.tipShown = false; ui.tip(''); } return; }
  if (S.spawnX === undefined || S.tipIndex === 0 && !S.tipShown) { if (S.spawnX === undefined) { S.spawnX = me.x; S.spawnY = me.y; } }
  const t = TIPS[S.tipIndex];
  if (!t) { profile.data.tipsSeen = true; profile.save(); ui.tip(''); return; }
  if (!S.tipShown) { if (t.when(me)) { ui.tip(t.text); S.tipShown = true; S.tipAt = now; } return; }
  if (t.done(me) || now - S.tipAt > 25000) { S.tipIndex++; S.tipShown = false; ui.tip(''); }
}
$('tip-next').addEventListener('click', () => { S.tipIndex++; S.tipShown = false; ui.tip(''); });

// ---------- 메인 루프 ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(100, now - last); last = now;
  if (S.session) {
    S.session.update(dt);
    const inp = input.vector();
    if (S.session.paused) { inp.mx = 0; inp.my = 0; inp.action = false; }
    const key = `${inp.mx},${inp.my},${inp.action}`;
    if (key !== S.lastInput || now - S.lastInputSent > 200) { S.session.sendInput(inp); S.lastInput = key; S.lastInputSent = now; }
    const me = view.me(S.myId);
    renderer.draw(view, S.myId, { buildKey: ui.buildKey, hoverTile: S.hoverTile });
    ui.updateHud(view, me);
    if (me) {
      ui.renderBuildList(me.cls, me.perks);
      if (!ui.el.buildpanel.classList.contains('hidden')) ui.updateAffordability(me);
      // 새벽 특전 선택
      if (me.perkOffer && me.perkOffer.length && !S.perkShown && !view.over) {
        S.perkShown = true;
        if (S.session instanceof LocalSession) S.session.paused = true;
        ui.showPerkModal(me, (k) => S.session && S.session.perk(k));
      } else if (S.perkShown && (!me.perkOffer || !me.perkOffer.length)) {
        S.perkShown = false; ui.hidePerkModal();
        if (S.session instanceof LocalSession && ui.el.pausemodal.classList.contains('hidden')) S.session.paused = false;
      }
      if (S.perkShown) ui.updatePerkTimer(me, S.isNet);
      tickTips(me, now);
    }
    if (view.over && !S.overShown) {
      S.overShown = true; ui.setBuildKey(null); ui.closePanels(); ui.hidePerkModal(); ui.tip('');
      const r = recordIfNeeded();
      ui.showSummary(view, me, r, { isHost: S.isHost, isNet: S.isNet, daily: S.daily });
      refreshMenu();
    }
    if (!view.over && S.overShown) { S.overShown = false; ui.hideOverlay(); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
refreshMenu();
ui.showScreen('menu');

// ---------- 안드로이드 뒤로가기 (Capacitor App 플러그인) ----------
const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
if (capApp && capApp.addListener) {
  let backAt = 0;
  capApp.addListener('backButton', () => {
    const inGame = !ui.el.screens.game.classList.contains('hidden');
    const inMenu = !ui.el.screens.menu.classList.contains('hidden');
    if (inGame) {
      if (!ui.el.perkmodal.classList.contains('hidden')) return;
      if (!ui.el.pausemodal.classList.contains('hidden')) { setPaused(false); return; }
      if (!ui.el.buildpanel.classList.contains('hidden') || !ui.el.chatpanel.classList.contains('hidden')) { ui.closePanels(); return; }
      if (ui.buildKey) { ui.setBuildKey(null); return; }
      if (S.session instanceof LocalSession && !view.over) { setPaused(true); return; }
      const now = Date.now();
      if (now - backAt < 2000) { $('btn-menu').click(); return; }
      backAt = now; ui.toast('한 번 더 누르면 메뉴로 나갑니다');
    } else if (!ui.el.screens.lobby.classList.contains('hidden')) { $('btn-leave').click(); }
    else if (!inMenu) { refreshMenu(); ui.showScreen('menu'); }
    else if (!$('settings-modal').classList.contains('hidden')) { $('settings-modal').classList.add('hidden'); }
    else if (capApp.exitApp) capApp.exitApp();
  });
}
// ---------- PWA: 오프라인 솔로 플레이용 서비스 워커 (앱 안에서는 불필요) ----------
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !IS_APP) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
// 디버그/테스트용 훅 (e2e 스크립트가 사용)
window.__dh = { S, view, C, net, renderer, profile, ui, sound };
