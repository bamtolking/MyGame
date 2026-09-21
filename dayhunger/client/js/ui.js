// HUD·패널·모달·화면 렌더링. DOM 갱신은 값이 바뀔 때만.
import * as C from '../../shared/constants.js';
import { ACHIEVEMENTS, xpToNext } from './profile.js';

const $ = (id) => document.getElementById(id);
export const ENEMY_ICON = { ZOMBIE: '🧟', RUNNER: '🏃', SPITTER: '🤢', THIEF: '🦝', BAT: '🦇', BREAKER: '🔨', BRUTE: '🦍', BOMBER: '💣', BOSS: '👑' };

export class UI {
  constructor() {
    this.el = {
      screens: { menu: $('screen-menu'), setup: $('screen-setup'), profile: $('screen-profile'), upgrade: $('screen-upgrade'), lobby: $('screen-lobby'), game: $('screen-game') },
      daylabel: $('daylabel'), clockfill: $('clockfill'), wavePreview: $('wave-preview'), resWood: $('res-wood'), resStone: $('res-stone'), resIron: $('res-iron'), resFood: $('res-food'), clsIcon: $('cls-icon'),
      hpfill: $('hpfill'), hufill: $('hufill'), perkIcons: $('perk-icons'), log: $('log'), toast: $('toast'), hint: $('hint'), eatCount: $('eat-count'), tip: $('tip'), tipText: $('tip-text'), tipNext: $('tip-next'),
      buildpanel: $('buildpanel'), buildlist: $('buildlist'), chatpanel: $('chatpanel'), chatlist: $('chatlist'),
      overlay: $('overlay'), sumXp: $('sum-xp'), sumTitle: $('sum-title'), sumSub: $('sum-sub'), sumGrid: $('sum-grid'), sumXpLevel: $('sum-xp-level'), sumXpFill: $('sum-xpfill'), sumXpText: $('sum-xp-text'), sumPoints: $('sum-points'), sumNew: $('sum-new'),
      btnContinue: $('btn-continue'), btnAgain: $('btn-again'), btnBuild: $('btn-build'), btnPause: $('btn-pause'),
      perkmodal: $('perkmodal'), perkCards: $('perk-cards'), perkTimer: $('perk-timer'), pausemodal: $('pausemodal'),
      lobbyCode: $('lobby-code'), lobbyMembers: $('lobby-members'), lobbyHint: $('lobby-hint'), btnStart: $('btn-start'), menuMsg: $('menu-msg'),
      lobbyMap: $('lobby-map'), lobbyDiff: $('lobby-diff'), lobbyClass: $('lobby-class'), lobbySettingsHint: $('lobby-settings-hint'),
      setupMap: $('setup-map'), setupDiff: $('setup-diff'), setupClass: $('setup-class'), setupTitle: $('setup-title'), setupNote: $('setup-note'),
      pcLevel: $('pc-level'), pcXp: $('pc-xp'), pcPoints: $('pc-points'), dailyDesc: $('daily-desc'), upgBadge: $('upg-badge'),
      profileLevel: $('profile-level'), profileXp: $('profile-xp'), profilePoints: $('profile-points'), profileStats: $('profile-stats'), profileAch: $('profile-achievements'), profileRuns: $('profile-runs'),
      upgradePoints: $('upgrade-points'), upgradeList: $('upgrade-list'),
    };
    this.cache = {};
    this.toastTimer = null;
    this.buildKey = null; this.buildCls = null; this.buildPerkSig = '';
    this.onSelectBuild = null; this.onChat = null; this.onLobbySettings = null; this.onLobbyClass = null;
    this.buildButtons = new Map();
    this.renderBuildList(C.DEFAULT_CLASS, {});
    this.renderChatList();
    for (const [tab, sec] of [['ptab-stats', 'psec-stats'], ['ptab-ach', 'psec-ach'], ['ptab-runs', 'psec-runs']]) {
      $(tab).addEventListener('click', () => {
        for (const t of ['ptab-stats', 'ptab-ach', 'ptab-runs']) $(t).classList.toggle('selected', t === tab);
        for (const s of ['psec-stats', 'psec-ach', 'psec-runs']) $(s).classList.toggle('hidden', s !== sec);
      });
    }
  }
  showScreen(name) { for (const [k, el] of Object.entries(this.el.screens)) el.classList.toggle('hidden', k !== name); }
  set(key, el, prop, value) { if (this.cache[key] !== value) { this.cache[key] = value; el[prop] = value; } }
  toast(msg, ms = 1600) {
    const t = this.el.toast; t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  hint(text) { const h = this.el.hint; if (!text) { h.classList.add('hidden'); return; } h.textContent = text; h.classList.remove('hidden'); }
  tip(text) { const t = this.el.tip; if (!text) { t.classList.add('hidden'); return; } this.el.tipText.textContent = text; t.classList.remove('hidden'); }

  // ---------- 카드 줄 (전장/난이도/캐릭터/특전) ----------
  renderCards(container, defs, selected, onSelect, { disabled = false, lockText = null } = {}) {
    container.innerHTML = '';
    for (const [key, d] of Object.entries(defs)) {
      const lock = lockText ? lockText(key) : null;
      const b = document.createElement('button');
      b.className = 'card' + (key === selected ? ' selected' : '') + (lock ? ' locked' : ''); b.dataset.key = key; b.disabled = disabled || !!lock;
      b.innerHTML = `<span class="ci">${d.icon}</span><span class="cn">${escapeHtml(d.name)}${d.size ? ` <small>${d.size}×${d.size}</small>` : ''}</span><span class="cd">${escapeHtml(d.desc || '')}</span>${lock ? `<span class="lock">해금: ${escapeHtml(lock)}</span>` : ''}`;
      b.addEventListener('click', () => onSelect(key));
      container.appendChild(b);
    }
  }
  markCard(container, key) { for (const b of container.querySelectorAll('.card')) b.classList.toggle('selected', b.dataset.key === key); }

  // ---------- 건설/채팅 패널 ----------
  renderBuildList(cls, perks) {
    const sig = cls + ':' + ((perks && perks.build_discount) || 0) + ':' + ((perks && perks.repair) || 0);
    if (this.buildPerkSig === sig) return;
    this.buildPerkSig = sig;
    const list = this.el.buildlist; list.innerHTML = ''; this.buildButtons.clear();
    const cd = C.CLASSES[cls] || C.CLASSES[C.DEFAULT_CLASS];
    const items = Object.entries(C.BUILDINGS).map(([key, b]) => ({ key, title: `${b.icon} ${b.name}`, cost: Object.entries(C.costFor(cls, b.cost, perks)).map(([k, v]) => `${C.RES_ICON[k]}${v}`).join(' '), desc: b.desc, hp: b.hp }));
    items.push({ key: 'REPAIR', title: '🔧 수리', cost: `${C.RES_ICON.wood}${C.REPAIR_COST.wood} → +${C.REPAIR_AMOUNT + (cd.repairBonus || 0) + 25 * ((perks && perks.repair) || 0)}`, desc: '건물을 탭하면 체력을 회복합니다.' });
    items.push({ key: 'DISMANTLE', title: '🧹 철거', cost: '재료 절반 환불', desc: '건물을 탭해서 없앱니다.' });
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
      const cant = !Object.entries(C.costFor(me.cls, def.cost, me.perks)).every(([r, v]) => (me.inv[r] || 0) >= v);
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

  // ---------- HUD ----------
  updateHud(view, me) {
    const e = this.el;
    const total = view.phase === 'day' ? view.dayTicks : view.nightTicks;
    const left = Math.max(0, Math.ceil((total - view.cycleT) / C.TICK_RATE));
    const foes = view.enemies.length + (view.pending || 0);
    const label = view.phase === 'day' ? `${view.day}일째 🌞 ${left}초` : `${view.day}일째 🌙 ${left}초${foes ? ` · 적 ${foes}` : ''}`;
    this.set('day', e.daylabel, 'textContent', label);
    this.set('clock', e.clockfill.style, 'width', `${Math.round((view.cycleT / total) * 100)}%`);
    e.clockfill.style.background = view.phase === 'day' ? '#ffd54f' : '#7986cb';
    const nw = view.phase === 'day' && view.nextWave ? `다음 밤 ${view.nextWave.count}마리 ${view.nextWave.kinds.slice(0, 5).map((k) => ENEMY_ICON[k] || '👾').join('')}${view.nextWave.boss ? ' 👑' : ''}` : '';
    this.set('wave', e.wavePreview, 'textContent', nw);
    if (me) {
      this.set('wood', e.resWood, 'textContent', `🪵 ${me.inv.wood}`);
      this.set('stone', e.resStone, 'textContent', `🪨 ${me.inv.stone}`);
      this.set('iron', e.resIron, 'textContent', `⛓️ ${me.inv.iron || 0}`);
      this.set('food', e.resFood, 'textContent', `🍎 ${me.inv.food}`);
      this.set('eat', e.eatCount, 'textContent', String(me.inv.food));
      this.set('cls', e.clsIcon, 'textContent', (C.CLASSES[me.cls] || C.CLASSES.SURVIVOR).icon);
      this.set('hp', e.hpfill.style, 'width', `${Math.round((me.hp / (me.maxHp || 100)) * 100)}%`);
      this.set('hu', e.hufill.style, 'width', `${Math.round(me.hunger)}%`);
      e.hufill.style.background = me.hunger < 25 ? '#ef5350' : '#ffb74d';
      const perks = Object.entries(me.perks || {}).map(([k, lv]) => (C.PERKS[k] ? C.PERKS[k].icon + (lv > 1 ? lv : '') : '')).join(' ');
      this.set('perks', e.perkIcons, 'textContent', perks);
    }
    const logText = view.log.map((l) => l.text).join('\n');
    if (this.cache.log !== logText) { this.cache.log = logText; e.log.innerHTML = view.log.map((l) => `<div>${escapeHtml(l.text)}</div>`).join(''); }
  }

  // ---------- 특전 모달 ----------
  showPerkModal(me, onPick) {
    const defs = {};
    for (const k of me.perkOffer) { const p = C.PERKS[k]; if (p) defs[k] = { icon: p.icon, name: p.name + (me.perks && me.perks[k] ? ` ${me.perks[k] + 1}단계` : ''), desc: p.desc }; }
    this.renderCards(this.el.perkCards, defs, null, onPick);
    this.el.perkmodal.classList.remove('hidden');
  }
  hidePerkModal() { this.el.perkmodal.classList.add('hidden'); }
  updatePerkTimer(me, isNet) { this.el.perkTimer.style.width = isNet ? `${Math.round((me.perkT / C.PERK_OFFER_TICKS) * 100)}%` : '100%'; }
  showPause(show) { this.el.pausemodal.classList.toggle('hidden', !show); }

  // ---------- 결과 화면 ----------
  showSummary(view, me, result, { isHost, isNet, daily }) {
    const e = this.el;
    e.overlay.classList.remove('hidden');
    const md = C.MAPS[view.map] || {}, dd = C.DIFFICULTIES[view.difficulty] || {};
    if (view.won) { e.sumTitle.textContent = '🏆 살아남았다!'; e.sumSub.textContent = `${view.winDay}일째 아침을 맞이했습니다 · ${md.icon || ''}${md.name || ''} · ${dd.icon || ''}${dd.name || ''}${daily ? ' · 📆 오늘의 도전' : ''}`; }
    else { e.sumTitle.textContent = '☠️ 게임 오버'; e.sumSub.textContent = `${view.day}일째 ${view.phase === 'night' ? '밤' : '낮'}에 모두 쓰러졌습니다 · ${md.icon || ''}${md.name || ''} · ${dd.icon || ''}${dd.name || ''}${daily ? ' · 📆 오늘의 도전' : ''}`; }
    const st = (me && me.stats) || {};
    const g = (st.gathered || {});
    const cells = [['생존', `${view.day}일`], ['점수', view.score], ['처치', me ? me.kills : view.kills], ['채집', `🪵${g.wood || 0} 🪨${g.stone || 0} ⛓️${g.iron || 0} 🍎${g.food || 0}`], ['건물', st.built || 0], ['특전', st.perks || 0]];
    e.sumGrid.innerHTML = cells.map(([k, v]) => `<div class="st"><span class="k">${k}</span><span class="v">${escapeHtml(String(v))}</span></div>`).join('');
    if (result) {
      e.sumXp.classList.remove('hidden');
      e.sumXpLevel.textContent = String(result.levelBefore);
      e.sumXpFill.style.transition = 'none'; e.sumXpFill.style.width = `${Math.round(result.xpBeforeRatio * 100)}%`;
      e.sumXpText.textContent = `+${result.xpGained} XP`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        e.sumXpFill.style.transition = 'width .9s ease';
        if (result.levelUps.length) { e.sumXpFill.style.width = '100%'; setTimeout(() => { e.sumXpLevel.textContent = String(result.levelAfter); e.sumXpFill.style.transition = 'none'; e.sumXpFill.style.width = '0%'; requestAnimationFrame(() => { e.sumXpFill.style.transition = 'width .9s ease'; e.sumXpFill.style.width = `${Math.round(result.xpAfterRatio * 100)}%`; }); }, 950); }
        else e.sumXpFill.style.width = `${Math.round(result.xpAfterRatio * 100)}%`;
      }));
      e.sumPoints.textContent = `💠 생존 포인트 +${result.pointsGained}${result.levelUps.length ? ` · 🎉 레벨 ${result.levelAfter} 달성!` : ''}`;
      const items = [];
      for (const a of result.newAchievements) items.push(`<div class="nw ach">🏅 업적 달성: ${a.icon} ${escapeHtml(a.name)} — ${escapeHtml(a.desc)} (+${a.points}💠)</div>`);
      for (const u of result.newUnlocks) { const [kind, key] = u.split(':'); const def = kind === 'classes' ? C.CLASSES[key] : kind === 'maps' ? C.MAPS[key] : C.DIFFICULTIES[key]; if (def) items.push(`<div class="nw">🔓 해금: ${def.icon} ${escapeHtml(def.name)}</div>`); }
      e.sumNew.innerHTML = items.join('');
    } else { e.sumXp.classList.add('hidden'); e.sumPoints.textContent = ''; e.sumNew.innerHTML = ''; }
    e.btnContinue.classList.toggle('hidden', !view.won || (isNet && !isHost));
    e.btnAgain.classList.toggle('hidden', isNet && !isHost);
    e.btnAgain.textContent = isNet ? '대기실로 (다시 하기)' : '다시 하기';
  }
  hideOverlay() { this.el.overlay.classList.add('hidden'); }

  // ---------- 대기실 ----------
  lobby(info, myCls, profile) {
    this.el.lobbyCode.textContent = info.code;
    this.el.lobbyMembers.innerHTML = info.members.map((m) => `<li><span>${(C.CLASSES[m.cls] || {}).icon || ''} ${escapeHtml(m.name)} <small>${(C.CLASSES[m.cls] || {}).name || ''}</small></span><span class="tag">${m.host ? '방장' : ''}</span></li>`).join('');
    const isHost = !!info.youHost;
    const st = info.settings || {};
    const lockMap = (k) => (profile && !profile.isUnlocked('maps', k) ? profile.unlockText('maps', k) : null);
    const lockDiff = (k) => (profile && !profile.isUnlocked('difficulties', k) ? profile.unlockText('difficulties', k) : null);
    const lockCls = (k) => (profile && !profile.isUnlocked('classes', k) ? profile.unlockText('classes', k) : null);
    this.renderCards(this.el.lobbyMap, C.MAPS, st.map, (k) => this.onLobbySettings && this.onLobbySettings(k, st.difficulty), { disabled: !isHost, lockText: isHost ? lockMap : null });
    this.renderCards(this.el.lobbyDiff, C.DIFFICULTIES, st.difficulty, (k) => this.onLobbySettings && this.onLobbySettings(st.map, k), { disabled: !isHost, lockText: isHost ? lockDiff : null });
    this.renderCards(this.el.lobbyClass, C.CLASSES, myCls, (k) => this.onLobbyClass && this.onLobbyClass(k), { lockText: lockCls });
    this.el.lobbySettingsHint.textContent = isHost ? '(방장이 고릅니다)' : '(방장만 바꿀 수 있어요)';
    this.el.btnStart.classList.toggle('hidden', !isHost);
    this.el.lobbyHint.textContent = isHost ? `${info.members.length}명 · 준비되면 시작을 누르세요 (게임 중에도 참가 가능)` : '방장이 시작하길 기다리는 중…';
    this.el.lobbyHint.style.color = 'var(--muted)';
    return isHost;
  }

  // ---------- 메뉴/프로필/강화 ----------
  menu(profile, daily) {
    const d = profile.data;
    this.el.pcLevel.textContent = String(d.level);
    this.el.pcXp.style.width = `${Math.round(profile.xpProgress * 100)}%`;
    this.el.pcPoints.textContent = String(d.points);
    const md = C.MAPS[daily.map], dd = C.DIFFICULTIES[daily.difficulty];
    this.el.dailyDesc.textContent = `${md.icon} ${md.name} · ${dd.icon} ${dd.name}${daily.done ? ` · 완료 ✅ (최고 ${daily.best}점)` : daily.best ? ` · 최고 ${daily.best}점` : ' · 3일 생존하면 +5💠'}`;
    const buyable = Object.keys(C.UPGRADES).filter((k) => profile.canBuy(k)).length;
    this.el.upgBadge.textContent = String(buyable); this.el.upgBadge.classList.toggle('hidden', buyable === 0);
  }
  renderProfile(profile) {
    const d = profile.data, st = d.stats;
    this.el.profileLevel.textContent = String(d.level); this.el.profileXp.style.width = `${Math.round(profile.xpProgress * 100)}%`; this.el.profilePoints.textContent = String(d.points);
    const mins = Math.round(st.playTicks / C.TICK_RATE / 60);
    const cells = [['플레이 횟수', st.runs], ['승리', st.wins], ['최고 생존일', `${st.bestDay}일`], ['최고 점수', st.bestScore], ['누적 처치', st.kills], ['누적 건물', st.built], ['낚시', st.fish], ['플레이 시간', `${mins}분`],
      ['나무', st.gathered.wood], ['돌', st.gathered.stone], ['철', st.gathered.iron], ['식량', st.gathered.food],
      ['경험치', `${d.xp} / ${xpToNext(d.level)}`], ['업적', `${Object.keys(d.achievements).length} / ${ACHIEVEMENTS.length}`]];
    for (const [k, v] of Object.entries(st.bestByMap)) cells.push([`${(C.MAPS[k] || {}).icon || ''} ${(C.MAPS[k] || {}).name || k} 최고`, `${v}일`]);
    this.el.profileStats.innerHTML = cells.map(([k, v]) => `<div class="st"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(v))}</span></div>`).join('');
    this.el.profileAch.innerHTML = ACHIEVEMENTS.map((a) => { const got = d.achievements[a.key]; return `<div class="ach${got ? '' : ' locked'}"><span class="ai">${a.icon}</span><span class="at"><span class="an">${escapeHtml(a.name)}</span><span class="ad">${escapeHtml(a.desc)}</span></span><span class="ap">${got ? '✅' : `+${a.points}💠`}</span></div>`; }).join('');
    this.el.profileRuns.innerHTML = d.runs.length ? d.runs.map((r) => { const md = C.MAPS[r.map] || {}, dd = C.DIFFICULTIES[r.difficulty] || {}, cd = C.CLASSES[r.cls] || {}; const dt = new Date(r.at); return `<div class="runrow"><span>${md.icon || ''}${dd.icon || ''}${cd.icon || ''} ${r.day}일 · ${r.score}점 · 처치 ${r.kills}${r.players > 1 ? ` · 👥${r.players}` : ''}${r.daily ? ' · 📆' : ''}</span><span class="${r.won ? 'won' : 'lost'}">${r.won ? '승리' : '탈락'} <small>${dt.getMonth() + 1}/${dt.getDate()}</small></span></div>`; }).join('') : '<p class="sub">아직 기록이 없어요. 첫 판을 시작해 보세요!</p>';
  }
  renderUpgrades(profile, onBuy) {
    this.el.upgradePoints.textContent = String(profile.points);
    this.el.upgradeList.innerHTML = '';
    for (const [key, u] of Object.entries(C.UPGRADES)) {
      const lv = profile.upgradeLevel(key), cost = profile.upgradeCost(key);
      const row = document.createElement('div'); row.className = 'upg';
      row.innerHTML = `<span class="ui">${u.icon}</span><span class="ut"><span class="un">${escapeHtml(u.name)} <span class="dots">${'●'.repeat(lv)}${'○'.repeat(u.max - lv)}</span></span><span class="ud">${escapeHtml(u.desc)}</span></span>`;
      const b = document.createElement('button'); b.className = 'accent'; b.textContent = cost === null ? '완료' : `💠 ${cost}`; b.disabled = !profile.canBuy(key);
      b.addEventListener('click', () => onBuy(key));
      row.appendChild(b); this.el.upgradeList.appendChild(row);
    }
  }
}
export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
