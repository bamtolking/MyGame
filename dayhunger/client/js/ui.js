// HUD·패널·토스트·오버레이. DOM 갱신은 값이 바뀔 때만.
import * as C from '../../shared/constants.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      screens: { menu: $('screen-menu'), lobby: $('screen-lobby'), game: $('screen-game') },
      daylabel: $('daylabel'), clockfill: $('clockfill'), resWood: $('res-wood'), resStone: $('res-stone'), resFood: $('res-food'),
      hpfill: $('hpfill'), hufill: $('hufill'), log: $('log'), toast: $('toast'), hint: $('hint'), eatCount: $('eat-count'),
      buildpanel: $('buildpanel'), buildlist: $('buildlist'), chatpanel: $('chatpanel'), chatlist: $('chatlist'),
      overlay: $('overlay'), overTitle: $('over-title'), overBody: $('over-body'), btnContinue: $('btn-continue'), btnAgain: $('btn-again'),
      btnBuild: $('btn-build'), lobbyCode: $('lobby-code'), lobbyMembers: $('lobby-members'), lobbyHint: $('lobby-hint'), btnStart: $('btn-start'), menuMsg: $('menu-msg'),
    };
    this.cache = {};
    this.toastTimer = null;
    this.buildKey = null;
    this.onSelectBuild = null;
    this.onChat = null;
    this.buildButtons = new Map();
    this.renderBuildList();
    this.renderChatList();
  }
  showScreen(name) { for (const [k, el] of Object.entries(this.el.screens)) el.classList.toggle('hidden', k !== name); }
  set(key, el, prop, value) { if (this.cache[key] !== value) { this.cache[key] = value; el[prop] = value; } }
  toast(msg, ms = 1600) {
    const t = this.el.toast; t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  hint(text) { const h = this.el.hint; if (!text) { h.classList.add('hidden'); return; } h.textContent = text; h.classList.remove('hidden'); }

  renderBuildList() {
    const list = this.el.buildlist; list.innerHTML = '';
    const items = Object.entries(C.BUILDINGS).map(([key, b]) => ({ key, title: `${b.icon} ${b.name}`, cost: Object.entries(b.cost).map(([k, v]) => `${C.RES_ICON[k]}${v}`).join(' '), desc: b.desc, hp: b.hp }));
    items.push({ key: 'REPAIR', title: '🔧 수리', cost: `${C.RES_ICON.wood}${C.REPAIR_COST.wood} → +${C.REPAIR_AMOUNT}`, desc: '건물을 탭하면 체력을 회복합니다.' });
    items.push({ key: 'DISMANTLE', title: '🧹 철거', cost: '재료 절반 환불', desc: '내가 지은 건물을 탭해서 없앱니다.' });
    for (const it of items) {
      const b = document.createElement('button'); b.className = 'bitem'; b.dataset.key = it.key;
      b.innerHTML = `<span class="t">${it.title}</span><span class="c">${it.cost}${it.hp ? ` · 체력 ${it.hp}` : ''}</span><span class="d">${it.desc}</span>`;
      b.addEventListener('click', () => { if (this.onSelectBuild) this.onSelectBuild(it.key); });
      list.appendChild(b); this.buildButtons.set(it.key, b);
    }
  }
  renderChatList() {
    const list = this.el.chatlist; list.innerHTML = '';
    C.QUICK_CHAT.forEach((msg, i) => { const b = document.createElement('button'); b.textContent = msg; b.addEventListener('click', () => { if (this.onChat) this.onChat(i); }); list.appendChild(b); });
  }
  setBuildKey(key) {
    this.buildKey = key;
    for (const [k, b] of this.buildButtons) b.classList.toggle('selected', k === key);
    this.el.btnBuild.classList.toggle('active', !!key);
    if (!key) this.hint('');
    else if (key === 'REPAIR') this.hint('🔧 수리할 건물을 탭하세요');
    else if (key === 'DISMANTLE') this.hint('🧹 철거할 건물을 탭하세요');
    else this.hint(`${C.BUILDINGS[key].icon} ${C.BUILDINGS[key].name} — 지을 곳을 탭하세요 (🧱 버튼으로 취소)`);
  }
  updateAffordability(me) {
    if (!me) return;
    for (const [k, b] of this.buildButtons) {
      const def = C.BUILDINGS[k];
      if (!def) continue;
      const cant = !Object.entries(def.cost).every(([r, v]) => (me.inv[r] || 0) >= v);
      b.classList.toggle('cant', cant);
    }
  }
  togglePanel(name, show) {
    const el = name === 'build' ? this.el.buildpanel : this.el.chatpanel;
    const other = name === 'build' ? this.el.chatpanel : this.el.buildpanel;
    const willShow = show === undefined ? el.classList.contains('hidden') : show;
    el.classList.toggle('hidden', !willShow);
    if (willShow) other.classList.add('hidden');
    return willShow;
  }
  closePanels() { this.el.buildpanel.classList.add('hidden'); this.el.chatpanel.classList.add('hidden'); }

  updateHud(view, me) {
    const e = this.el;
    const total = view.phase === 'day' ? C.DAY_TICKS : C.NIGHT_TICKS;
    const left = Math.max(0, Math.ceil((total - view.cycleT) / C.TICK_RATE));
    const label = view.phase === 'day' ? `${view.day}일째 🌞 ${left}초` : `${view.day}일째 🌙 ${left}초${view.pending ? ` · 남은 적 ${view.enemies.length + view.pending}` : view.enemies.length ? ` · 적 ${view.enemies.length}` : ''}`;
    this.set('day', e.daylabel, 'textContent', label);
    this.set('clock', e.clockfill.style, 'width', `${Math.round((view.cycleT / total) * 100)}%`);
    e.clockfill.style.background = view.phase === 'day' ? '#ffd54f' : '#7986cb';
    if (me) {
      this.set('wood', e.resWood, 'textContent', `🪵 ${me.inv.wood}`);
      this.set('stone', e.resStone, 'textContent', `🪨 ${me.inv.stone}`);
      this.set('food', e.resFood, 'textContent', `🍎 ${me.inv.food}`);
      this.set('eat', e.eatCount, 'textContent', String(me.inv.food));
      this.set('hp', e.hpfill.style, 'width', `${Math.round(me.hp)}%`);
      this.set('hu', e.hufill.style, 'width', `${Math.round(me.hunger)}%`);
      e.hufill.style.background = me.hunger < 25 ? '#ef5350' : '#ffb74d';
    }
    const logText = view.log.map((l) => l.text).join('\n');
    if (this.cache.log !== logText) { this.cache.log = logText; e.log.innerHTML = view.log.map((l) => `<div>${escapeHtml(l.text)}</div>`).join(''); }
  }
  showOverlay(view, { isHost, isNet, alivePlayers }) {
    const e = this.el;
    e.overlay.classList.remove('hidden');
    if (view.won) {
      e.overTitle.textContent = '🏆 살아남았다!';
      e.overBody.textContent = `${C.WIN_DAY}일째 아침을 맞이했습니다.\n점수 ${view.score} · 처치 ${view.kills}\n${alivePlayers.map((p) => `${p.name}: 처치 ${p.kills}`).join('  ·  ')}`;
      e.btnContinue.classList.toggle('hidden', isNet && !isHost);
    } else {
      e.overTitle.textContent = '☠️ 게임 오버';
      e.overBody.textContent = `${view.day}일째 ${view.phase === 'night' ? '밤' : '낮'}에 모두 쓰러졌습니다.\n점수 ${view.score} · 처치 ${view.kills}`;
      e.btnContinue.classList.add('hidden');
    }
    e.btnAgain.classList.toggle('hidden', isNet && !isHost);
    e.btnAgain.textContent = isNet ? '대기실로 (다시 하기)' : '다시 하기';
  }
  hideOverlay() { this.el.overlay.classList.add('hidden'); }
  lobby(info) {
    this.el.lobbyCode.textContent = info.code;
    this.el.lobbyMembers.innerHTML = info.members.map((m) => `<li><span>${escapeHtml(m.name)}</span><span class="tag">${m.host ? '방장' : ''}</span></li>`).join('');
    const isHost = !!info.youHost;
    this.el.btnStart.classList.toggle('hidden', !isHost);
    this.el.lobbyHint.textContent = isHost ? `${info.members.length}명 · 준비되면 시작을 누르세요 (게임 중에도 참가 가능)` : '방장이 시작하길 기다리는 중…';
    this.el.lobbyHint.style.color = 'var(--muted)';
    return isHost;
  }
}
export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
