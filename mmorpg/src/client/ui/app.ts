// App shell: title & character creation, connection lifecycle, HUD, sheets, input.
import type { C2S, BossInfo, WorldBossState } from '../../shared/protocol.ts';
import { PROTOCOL_VERSION, TILE, TAL_SLOT_LEVELS } from '../../shared/constants.ts';
import type { ClassId, Item, MeState } from '../../shared/types.ts';
import { CLASSES, CLASS_IDS } from '../../shared/data/classes.ts';
import { MONSTERS } from '../../shared/data/monsters.ts';
import { TALS } from '../../shared/data/talismans.ts';
import { ZONES } from '../../shared/data/zones.ts';
import { MAIN_QUESTS, BOUNTY_N } from '../../shared/data/quests.ts';
import { slotsUnlocked } from '../../shared/data/items.ts';
import { fmtNum } from '../../shared/math.ts';
import { findPath } from '../../shared/path.ts';
import { PF } from '../../shared/protocol.ts';
import { Game } from '../game.ts';
import { LocalTransport, WsTransport, wsUrl, detectServer, type Transport } from '../net.ts';
import { Sound } from '../audio.ts';
import * as store from '../storage.ts';
import { h, $, clear, fmtTime } from './dom.ts';
import { Joystick } from './joystick.ts';
import { bagPanel, itemModal, smithPanel, talPanel, questPanel, mapPanel, rosterPanel, chatPanel, codexPanel } from './panels.ts';
import { classIcon, talIcon } from '../render/sprites.ts';

export interface AppApi {
  me(): MeState; game(): Game; send(m: C2S): void; openSheet(name: string, arg?: unknown): void; closeSheet(): void;
  openItem(it: Item, equipped: boolean): void; openModal(el: HTMLElement): void; closeModal(): void; toast(text: string, color?: string): void; confirm(text: string, yes: () => void): void;
  chatLines(): { name: string; text: string; sys: boolean }[];
}
type Mode = 'offline' | 'online';
/** `me` fields each sheet displays (a change re-renders it). */
const SHEET_KEYS: Record<string, string[]> = { bag: ['inv', 'equip', 'gold', 'shards', 'stats', 'autoSell', 'zone'], tal: ['tals', 'slots', 'gold', 'shards', 'zone', 'level'], smith: ['equip', 'gold', 'zone'], quest: ['quest', 'lstats'], map: ['shrines'] };
const ULT_GLYPH: Record<ClassId, string> = { sword: '斬', archer: '矢', shaman: '巫' };

export class App implements AppApi {
  root: HTMLElement; set = store.loadSettings(); snd = new Sound();
  g: Game | null = null; tr: Transport | null = null; mode: Mode = 'offline'; joy: Joystick | null = null;
  sheet: { name: string; arg: unknown } | null = null; private sheetDirty = false; private raf = 0; private hudT = 0; private chat: { name: string; text: string; sys: boolean; t: number }[] = [];
  private toasts: { el: HTMLElement; until: number }[] = []; private sheetT = 0; private sheetPointer = false; private ann: string[] = []; private annUntil = 0;
  private questPath: { t: number; ang: number | null; dist: number; key: string } = { t: 0, ang: null, dist: 0, key: '' };
  private zoneSamples: [number, number][][] | null = null; private retry = 0; private lastZone = -1; private tutorial = true;
  el: Record<string, HTMLElement> = {};
  pendingHello: { name: string; cls: ClassId } | null = null;

  constructor(root: HTMLElement) {
    this.root = root; this.snd.setVolumes(this.set.sfx, this.set.bgm);
    (window as any).__app = this;
    this.showTitle();
    window.addEventListener('resize', () => this.g?.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.snd.suspend(); if (this.tr instanceof LocalTransport) this.tr.saveNow(); }
      else this.snd.resume();
    });
    window.addEventListener('pagehide', () => { if (this.tr instanceof LocalTransport) this.tr.saveNow(); });
  }

  // ======================= title =======================
  showTitle(): void {
    cancelAnimationFrame(this.raf); this.tr?.close(); this.tr = null; this.g = null; clear(this.root);
    const off = store.knownChar('offline'), on = store.knownChar('online');
    const onlineBox = h('div', { class: 'online-box' }, h('small', {}, '서버 확인 중…'));
    const t = h('div', { id: 'title' },
      h('div', { class: 'sky' }, h('div', { class: 'moon' }), h('div', { class: 'hills' }), ...Array.from({ length: 14 }, (_, i) => h('i', { class: 'firefly', style: { left: `${(i * 37) % 100}%`, top: `${40 + (i * 23) % 50}%`, animationDelay: `${(i * 0.7) % 5}s` } }))),
      h('div', { class: 'logo' }, h('small', {}, '한 손으로 즐기는 요괴 퇴마 MMORPG'), h('h1', {}, '달빛 퇴마단'), h('div', { class: 'eng' }, 'MOONLIT EXORCISTS')),
      h('div', { class: 'menu' },
        off ? h('button', { class: 'primary big', onclick: () => this.start('offline', null) }, h('span', {}, `이어하기`), h('small', {}, `${off.name} · Lv${off.level} ${CLASSES[off.cls].name}`)) : null,
        h('button', { class: off ? '' : 'primary big', onclick: () => this.showCreate('offline') }, off ? '새 캐릭터 (오프라인)' : h('span', {}, '모험 시작', h('small', { class: 'block' }, 'AI 동료들과 함께하는 체험 월드'))),
        onlineBox,
        h('div', { class: 'row' }, h('button', { onclick: () => this.titleModal(codexPanel()) }, '요괴 도감'), h('button', { onclick: () => this.titleModal(this.settingsPanel(true)) }, '설정'))),
      h('div', { class: 'foot' }, '이동만 하세요. 공격·부적은 자동입니다. · v0.1 알파', h('br'), store.storageOk ? '' : '⚠ 브라우저 저장소를 쓸 수 없어 진행이 저장되지 않습니다'),
      h('div', { id: 'modal', class: 'hidden' }));
    this.root.append(t);
    const fill = (info: Awaited<ReturnType<typeof detectServer>>) => {
      clear(onlineBox);
      if (info) { const n = info.channels.reduce((s, c) => s + c.humans, 0); onlineBox.append(h('button', { class: 'online', onclick: () => on ? this.start('online', null) : this.showCreate('online') }, h('span', {}, `🌐 온라인 접속 — ${info.name}`), h('small', {}, `${n}명 접속 중${on ? ` · ${on.name} Lv${on.level}` : ''}`))); }
      else if (this.set.server) onlineBox.append(h('button', { class: 'online', onclick: () => on ? this.start('online', null) : this.showCreate('online') }, h('span', {}, '🌐 온라인 접속'), h('small', {}, this.set.server)));
      else onlineBox.append(h('small', { class: 'muted' }, '온라인 서버: 설정에서 주소 입력 (npm start 로 서버 실행)'));
    };
    void detectServer().then(fill);
  }
  private titleModal(el: HTMLElement): void { const m = $('#modal'); clear(m); m.classList.remove('hidden'); m.append(h('div', { class: 'modal-card tall' }, h('button', { class: 'close', onclick: () => m.classList.add('hidden') }, '✕'), el)); }

  showCreate(mode: Mode): void {
    clear(this.root); let cls: ClassId = 'sword';
    const name = h('input', { type: 'text', maxlength: 10, placeholder: '이름 (최대 10자)', autocomplete: 'off' }) as HTMLInputElement;
    const cards = h('div', { class: 'classes' });
    const draw = () => { clear(cards); for (const id of CLASS_IDS) { const c = CLASSES[id]; cards.append(h('button', { class: `classcard ${cls === id ? 'sel' : ''}`, style: { '--c': c.color } as any, onclick: () => { cls = id; this.snd.unlock(); this.snd.play('click'); draw(); } }, h('img', { src: classIcon(id) }), h('b', {}, c.name), h('small', { class: 'role' }, c.role), h('p', {}, c.desc), h('small', { class: 'ultname' }, `필살기 · ${c.ultName}`), h('small', { class: 'tal' }, h('img', { src: talIcon(c.startTal) }), TALS[c.startTal].name))); } };
    draw();
    const go = () => { const n = name.value.trim(); if (!n) { name.focus(); name.classList.add('shake'); setTimeout(() => name.classList.remove('shake'), 400); return; } this.start(mode, { name: n, cls }); };
    this.root.append(h('div', { id: 'create' }, h('h2', {}, mode === 'online' ? '온라인 캐릭터 만들기' : '퇴마사 만들기'),
      h('p', { class: 'hint' }, mode === 'offline' ? '오프라인 체험 월드: 이 기기에 저장되며, AI 동료(AI 표시)들이 함께 사냥합니다.' : '온라인 서버에 저장됩니다. 같은 채널의 다른 사람들과 함께 플레이합니다.'),
      cards, name, h('div', { class: 'row' }, h('button', { onclick: () => this.showTitle() }, '뒤로'), h('button', { class: 'primary grow', onclick: go }, '퇴마 시작!'))));
    name.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }

  // ======================= session =======================
  start(mode: Mode, create: { name: string; cls: ClassId } | null): void {
    this.snd.unlock(); this.mode = mode; this.retry = 0;
    if (mode === 'offline' && create) { const lt = new store.LocalProfileStore(); lt.wipe(store.token('offline')); }
    this.pendingHello = create ?? { name: store.knownChar(mode)?.name ?? '퇴마사', cls: store.knownChar(mode)?.cls ?? 'sword' };
    this.buildGameDom(); this.connect();
  }
  private connect(): void {
    this.tr?.close();
    const tr: Transport = this.mode === 'offline' ? new LocalTransport(6) : new WsTransport(wsUrl(this.set.server));
    this.tr = tr;
    this.g = new Game(tr, this.el.cv as HTMLCanvasElement, this.snd, this.set, this.hooks());
    tr.onStatus = (s, why) => {
      if (s === 'open') { this.retry = 0; this.el.loading.querySelector('p')!.textContent = '월드에 들어가는 중…'; tr.send({ t: 'hello', v: PROTOCOL_VERSION, token: store.token(this.mode), name: this.pendingHello!.name, cls: this.pendingHello!.cls }); }
      else if (this.mode === 'online') {
        if (this.retry < 5) { this.retry++; this.el.loading.classList.remove('hidden'); this.el.loading.querySelector('p')!.textContent = `${why ?? '연결 끊김'} — 다시 연결 중 (${this.retry}/5)…`; setTimeout(() => { if (this.tr === tr) this.connect(); }, 1200 * this.retry); }
        else this.fatal(`${why ?? '연결할 수 없습니다'}. 서버 주소를 확인하거나 오프라인 모드로 플레이하세요.`);
      }
    };
    tr.connect();
    cancelAnimationFrame(this.raf); const loop = (t: number) => { this.raf = requestAnimationFrame(loop); this.frame(t); }; this.raf = requestAnimationFrame(loop);
  }
  private fatal(msg: string): void { this.openModal(h('div', {}, h('h3', {}, '알림'), h('p', {}, msg), h('button', { class: 'primary wide', onclick: () => this.showTitle() }, '타이틀로'))); }
  private hooks() {
    return {
      onWelcome: () => { this.el.loading.classList.add('hidden'); const me = this.g!.me; store.rememberChar(this.mode, { name: me.name, cls: me.cls, level: me.level, t: Date.now() }); this.renderStatic(); this.zoneSamples = null; this.questPath.t = 0; this.tutorial = me.level <= 1 && me.quest.main === 0; if (this.tutorial) this.el.tutorial.classList.remove('hidden'); this.snd.mood = 'calm'; },
      onMe: (ch: Set<string>) => { if (ch.has('level')) store.rememberChar(this.mode, { name: this.g!.me.name, cls: this.g!.me.cls, level: this.g!.me.level, t: Date.now() }); if (this.sheet && (SHEET_KEYS[this.sheet.name] ?? []).some(k => ch.has(k))) this.sheetDirty = true; if (ch.has('slots') || ch.has('tals') || ch.has('level')) this.renderSlots(); },
      onRoster: () => { if (this.sheet?.name === 'roster') this.sheetDirty = true; },
      onChat: (name: string, text: string, sys: boolean) => this.addChat(name, text, sys),
      onAnn: (text: string, kind: string) => { this.ann.push(text); this.addChat('', text, true); if (kind === 'legend' || kind === 'boss') this.snd.play('quest'); },
      onToast: (text: string, color?: string, big?: boolean) => this.toast(text, color, big),
      onBoss: (b: BossInfo | null) => this.renderBoss(b),
      onWb: (w: WorldBossState) => this.renderWb(w),
      onError: (msg: string, fatal: boolean) => { if (fatal) { this.tr?.close(); this.fatal(msg); } else { this.toast(msg, '#ff9a9a'); this.snd.play('error'); } },
      onLevel: (lv: number) => { const el = this.el.lvlup; el.textContent = `LEVEL ${lv}`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); if (TAL_SLOT_LEVELS.includes(lv)) this.toast(`부적 칸이 열렸습니다! 부적 메뉴에서 장착하세요`, '#ffe066', true); },
      onHurt: () => { const v = this.el.vignette; v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit'); },
    };
  }

  // ======================= DOM =======================
  private buildGameDom(): void {
    clear(this.root); const E = this.el;
    E.cv = h('canvas', { id: 'cv' });
    E.touch = h('div', { id: 'touch' });
    E.joyBase = h('div', { class: 'joy' }, E.joyKnob = h('div', { class: 'knob' }));
    E.hpfill = h('i', { class: 'hp' }); E.shfill = h('i', { class: 'sh' }); E.hptext = h('span', {});
    E.xpfill = h('i', {}); E.lv = h('b', { class: 'lv' }); E.name = h('b', {}); E.power = h('small', {}); E.money = h('small', { class: 'money' });
    E.portrait = h('img', { class: 'portrait' });
    E.questT = h('b', {}); E.questP = h('small', {}); E.questArrow = h('i', { class: 'arrow' }, '➤'); E.questDist = h('small', { class: 'dist' }); E.bounty = h('small', { class: 'bounty' });
    E.mini = h('canvas', { width: 208, height: 208 }); E.zone = h('b', {}); E.chan = h('button', { class: 'chip', onclick: () => this.openSheet('roster') });
    E.ult = h('button', { class: 'ult hudbtn', onclick: () => this.useUlt() }, E.ultGlyph = h('span', {}), E.ultTxt = h('small', {}));
    E.slots = h('div', { class: 'slots' });
    E.auto = h('button', { class: 'autobtn hudbtn', onclick: () => { const on = !this.g?.me.auto; this.send({ t: 'auto', on }); } }, h('b', {}, 'AUTO'), h('small', {}, '자동 사냥'));
    E.boss = h('div', { class: 'bossbar hidden' }); E.wb = h('div', { class: 'wbbanner hidden' }); E.annEl = h('div', { class: 'ann hidden' });
    E.toasts = h('div', { class: 'toasts' }); E.chatlog = h('div', { class: 'chatlog' });
    E.down = h('div', { class: 'downed hidden' }); E.lvlup = h('div', { class: 'lvlup' }); E.vignette = h('div', { class: 'vignette' });
    E.tutorial = h('div', { class: 'tutorial hidden' }, h('div', { class: 'hand' }, '👆'), h('b', {}, '화면 아무 곳이나 드래그해서 이동'), h('small', {}, '공격과 부적은 자동! 요괴에게 다가가 보세요'));
    E.loading = h('div', { class: 'loading' }, h('div', { class: 'spinner' }), h('p', {}, '연결 중…'), h('button', { class: 'ghost', onclick: () => this.showTitle() }, '취소'));
    const menu = h('div', { class: 'menu' }, ...[['bag', '🎒', '가방'], ['tal', '📜', '부적'], ['quest', '❗', '퀘스트'], ['map', '🗺', '지도'], ['settings', '⚙', '메뉴']].map(([k, ic, lb]) => { const b = h('button', { class: 'hudbtn', 'data-k': k, onclick: () => this.openSheet(k) }, h('span', {}, ic), h('small', {}, lb)); E['menu_' + k] = b; return b; }));
    const game = h('div', { id: 'game' }, E.cv, E.touch, E.joyBase, E.vignette,
      h('div', { id: 'hud' },
        h('div', { class: 'tl' },
          h('div', { class: 'me' }, h('div', { class: 'pwrap' }, E.portrait, E.lv), h('div', { class: 'info' }, h('div', { class: 'nm' }, E.name, E.power), h('div', { class: 'hpbar' }, E.hpfill, E.shfill, E.hptext), E.money)),
          h('button', { class: 'quest hudbtn', onclick: () => this.openSheet('quest') }, h('div', { class: 'qtop' }, E.questArrow, E.questT, E.questDist), E.questP, E.bounty)),
        h('div', { class: 'tr' }, h('button', { class: 'minimap hudbtn', onclick: () => this.openSheet('map') }, E.mini), h('div', { class: 'zoneinfo' }, E.zone, E.chan), menu),
        h('div', { class: 'topc' }, E.boss, E.wb, E.annEl),
        E.toasts,
        h('div', { class: 'bl' }, E.chatlog, h('div', { class: 'row' }, h('button', { class: 'hudbtn chatbtn', onclick: () => this.openSheet('chat') }, '💬'), h('button', { class: 'hudbtn chatbtn', onclick: () => this.quickEmote() }, '😀'))),
        h('div', { class: 'br' }, E.slots, E.ult, E.auto),
        E.down, E.lvlup, E.tutorial,
        h('div', { class: 'xpbar' }, E.xpfill)),
      E.sheet = h('div', { id: 'sheet', class: 'hidden' }), h('div', { id: 'modal', class: 'hidden' }), E.loading);
    const down = () => { this.sheetPointer = true; }, up = () => { this.sheetPointer = false; };
    E.sheet.addEventListener('pointerdown', down); E.sheet.addEventListener('pointerup', up); E.sheet.addEventListener('pointercancel', up);
    E.sheet.addEventListener('click', (e) => { if (e.target === E.sheet) this.closeSheet(); });
    this.root.append(game);
    this.joy = new Joystick(E.touch, E.joyBase, E.joyKnob);
    this.joy.onTap = (x, y) => this.tapWorld(x, y);
    window.onkeydown = (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === ' ') { this.useUlt(); e.preventDefault(); } else if (k === 'b' || k === 'i') this.toggleSheet('bag'); else if (k === 't') this.toggleSheet('tal'); else if (k === 'q' || k === 'j') this.toggleSheet('quest'); else if (k === 'm') this.toggleSheet('map'); else if (k === 'enter') this.openSheet('chat'); else if (k === 'escape') { this.closeModal(); this.closeSheet(); }
    };
  }
  private renderStatic(): void {
    const g = this.g!; const me = g.me; this.el.portrait.setAttribute('src', classIcon(me.cls)); this.el.ultGlyph.textContent = ULT_GLYPH[me.cls];
    this.el.ult.style.setProperty('--c', CLASSES[me.cls].color); this.el.ult.title = CLASSES[me.cls].ultName; this.renderSlots();
  }
  private renderSlots(): void {
    const g = this.g; if (!g) return; const me = g.me; const open = slotsUnlocked(me.level); clear(this.el.slots);
    for (let i = 0; i < 4; i++) {
      const uid = me.slots?.[i]; const t = uid != null ? me.tals.find(x => x.uid === uid) : null; const locked = i >= open;
      this.el.slots.append(h('button', { class: `slot hudbtn ${locked ? 'locked' : ''}`, 'data-i': i, onclick: () => this.openSheet('tal', locked || t ? null : i) },
        locked ? h('small', {}, `Lv${TAL_SLOT_LEVELS[i]}`) : t ? [h('img', { src: talIcon(t.kind) }), h('b', { class: 'tl' }, String(t.lv)), h('i', { class: 'cd' })] : h('small', {}, '+')));
    }
  }

  // ======================= per frame =======================
  private frame(t: number): void {
    const g = this.g; if (!g || !g.ready) return;
    const v = this.joy!.read(); g.input.x = v.x; g.input.y = v.y;
    if (this.tutorial && (v.x || v.y)) { this.tutorial = false; setTimeout(() => this.el.tutorial.classList.add('hidden'), 1200); }
    g.frame(t);
    if (t - this.hudT > 100) { this.hudT = t; this.updateHud(); }
    this.updateBars();
  }
  private updateBars(): void {
    const me = this.g!.me; const E = this.el;
    const hp = Math.max(0, me.hp) / me.maxHp; E.hpfill.style.width = `${hp * 100}%`; E.shfill.style.width = `${Math.min(1, me.shield / me.maxHp) * 100}%`;
    E.hptext.textContent = `${Math.ceil(Math.max(0, me.hp))} / ${me.maxHp}`; E.hpfill.classList.toggle('low', hp < 0.3);
    E.xpfill.style.width = `${me.xpNeed ? Math.min(100, me.xp / me.xpNeed * 100) : 100}%`;
    E.auto.classList.toggle('on', !!me.auto);
    const u = Math.min(100, me.ult); E.ult.style.setProperty('--p', `${u}%`); E.ult.classList.toggle('ready', u >= 100 && me.zone !== 0); E.ultTxt.textContent = me.ultT > 0 ? `${me.ultT.toFixed(1)}` : u >= 100 ? '필살!' : `${Math.floor(u)}%`;
    const slots = E.slots.children;
    for (let i = 0; i < slots.length; i++) {
      const cdEl = slots[i].querySelector('.cd') as HTMLElement | null; if (!cdEl) continue; const uid = me.slots[i]; const t = uid != null ? me.tals.find(x => x.uid === uid) : null; if (!t) continue;
      const max = TALS[t.kind].cd[t.lv - 1] * (1 - (me.stats.cdr ?? 0)); const cd = me.cds?.[i] ?? 0; cdEl.style.setProperty('--p', max > 0 ? `${Math.min(100, cd / max * 100)}%` : '0%');
    }
  }
  private updateHud(): void {
    const g = this.g!; const me = g.me; const E = this.el; const now = performance.now();
    E.lv.textContent = String(me.level); E.name.textContent = me.name; E.power.textContent = `전투력 ${fmtNum(me.stats.power)}`;
    E.money.textContent = `🪙 ${fmtNum(me.gold)}   🌙 ${me.shards}`;
    const zone = ZONES[me.zone]; E.zone.textContent = zone ? `${zone.name}${me.zone >= 1 && me.zone <= 4 ? ` Lv${zone.minLv}~${zone.maxLv}` : ''}` : '';
    const humans = [...g.roster.values()].filter(r => !r.bot).length, bots = g.roster.size - humans;
    E.chan.textContent = `${g.online ? `CH${g.channel}` : '오프라인'} · 👥${humans}${bots ? `+AI${bots}` : ''}${g.online && g.rtt ? ` · ${Math.round(g.rtt)}ms` : ''}`;
    if (me.zone !== this.lastZone) { const was = this.lastZone; this.lastZone = me.zone; this.snd.mood = g.wb.state === 'fight' ? 'boss' : me.zone === 0 ? 'town' : 'calm'; if (was >= 0 && zone) this.zoneBanner(zone.name, me.zone); }
    // quest tracker
    const q = MAIN_QUESTS[me.quest.main];
    if (q) { E.questT.textContent = q.title; E.questP.textContent = q.n > 1 || q.kind === 'kill' || q.kind === 'killZone' ? `${q.desc.split('.')[0]} (${me.quest.prog}/${q.n})` : q.desc.split('.')[0]; }
    else { E.questT.textContent = '현상금 사냥'; E.questP.textContent = '모든 이야기 완료! 불가사리와 현상금으로 성장하세요'; }
    E.bounty.textContent = me.quest.bountyZone >= 1 && me.quest.bountyZone <= 4 ? `현상금 · ${ZONES[me.quest.bountyZone].name} ${me.quest.bountyProg}/${BOUNTY_N}` : '';
    this.updateQuestArrow();
    // downed overlay
    if (me.downed > 0) {
      E.down.classList.remove('hidden'); clear(E.down);
      E.down.append(h('b', {}, '쓰러졌습니다'), h('small', {}, `${me.downed}초 뒤 가까운 신당에서 부활합니다`), me.revive > 0 ? h('div', { class: 'bar' }, h('i', { style: { width: `${me.revive * 100}%` } }), h('span', {}, '동료가 일으키는 중…')) : h('small', {}, '동료가 곁에 서면 일으켜 줍니다'),
        h('button', { class: 'hudbtn', disabled: me.downed > 13, onclick: () => this.send({ t: 'respawn' }) }, '신당으로 귀환'));
    } else E.down.classList.add('hidden');
    // chat fade
    for (const el of Array.from(E.chatlog.children) as HTMLElement[]) if (Number(el.dataset.t) < now - 12000) el.classList.add('old');
    // toasts
    this.toasts = this.toasts.filter(t => { if (t.until < now) { t.el.remove(); return false; } return true; });
    // announcements ticker
    if (this.annUntil < now) { if (this.ann.length) { E.annEl.textContent = this.ann.shift()!; E.annEl.classList.remove('hidden'); this.annUntil = now + 4500; } else E.annEl.classList.add('hidden'); }
    // minimap
    this.drawMini();
    // world boss countdown text
    if (g.wb.state !== 'idle') this.renderWb(g.wb, true);
    // re-render an open sheet only for fields it shows, at most every 400 ms, and never while the user is typing in it
    if (this.sheet && this.sheetDirty && now - this.sheetT > 400 && !this.sheetPointer && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement)) { this.sheetDirty = false; this.renderSheet(); }
    // menu badges
    const up = me.inv.some(it => { const cur = me.stats.power; const trial = { cls: me.cls, level: me.level, tals: me.tals, slots: me.slots, equip: { ...me.equip, [it.slot]: it } }; return cur < computeStatsPower(trial); });
    E.menu_bag.classList.toggle('badge', up);
    const open = slotsUnlocked(me.level); const canMerge = hasMerge(me); const emptySlot = me.tals.length > me.slots.filter(s => s != null).length && [0, 1, 2, 3].some(i => i < open && me.slots[i] == null);
    E.menu_tal.classList.toggle('badge', canMerge || emptySlot);
  }
  private zoneBanner(name: string, z: number): void {
    const b = h('div', { class: 'zonebanner' }, h('small', {}, z === 0 ? '안전 지역' : z === 5 ? '월드 보스 지역' : `권장 Lv${ZONES[z].minLv}~${ZONES[z].maxLv}`), h('b', {}, name));
    this.el.toasts.parentElement!.querySelectorAll('.zonebanner').forEach(x => x.remove()); this.el.toasts.parentElement!.append(b); setTimeout(() => b.remove(), 2600);
  }
  private updateQuestArrow(): void {
    const g = this.g!; const me = g.me; const q = MAIN_QUESTS[me.quest.main]; const pos = g.myPos(); const E = this.el;
    let target: [number, number] | null = null;
    if (q) {
      if (q.kind === 'boss') { const l = g.map.lairs.find(l => l.boss === q.target); if (l) target = [l.x, l.y]; }
      else if (q.kind === 'worldboss') { if (g.wb.state !== 'idle') target = [g.map.altar.x, g.map.altar.y]; }
      else if (q.kind === 'enhance') { const n = g.map.npcs.find(n => n.kind === 'smith')!; if (me.zone !== 0) target = [n.x, n.y]; }
      else if ((q.kind === 'visit' || q.kind === 'killZone' || q.kind === 'kill') && me.zone !== q.zone) target = this.nearestInZone(q.zone, pos.x, pos.y);
      else if (q.kind === 'merge' || q.kind === 'slots') target = null;
    }
    if (!target) { E.questArrow.style.visibility = 'hidden'; E.questDist.textContent = ''; return; }
    const key = `${me.quest.main}:${target[0]}:${target[1]}`; const now = performance.now();
    if (now - this.questPath.t > 1500 || this.questPath.key !== key) {
      this.questPath.t = now; this.questPath.key = key; const path = findPath(g.map, pos.x, pos.y, target[0], target[1], 20000);
      let wp = target; if (path) { for (const p of path) { if (Math.hypot(p[0] - pos.x, p[1] - pos.y) > 48) { wp = p; break; } } }
      this.questPath.ang = Math.atan2(wp[1] - pos.y, wp[0] - pos.x); this.questPath.dist = Math.hypot(target[0] - pos.x, target[1] - pos.y);
    }
    const d = Math.hypot(target[0] - pos.x, target[1] - pos.y);
    E.questArrow.style.visibility = d < 150 ? 'hidden' : 'visible'; E.questArrow.style.transform = `rotate(${this.questPath.ang ?? 0}rad)`; E.questDist.textContent = d < 150 ? '도착' : `${Math.round(d / TILE)}m`;
  }
  private nearestInZone(z: number, x: number, y: number): [number, number] | null {
    const m = this.g!.map;
    if (!this.zoneSamples) { this.zoneSamples = ZONES.map(() => []); for (let ty = 2; ty < m.h; ty += 3) for (let tx = 2; tx < m.w; tx += 3) { const i = ty * m.w + tx; if (m.tiles[i] === 1 || m.tiles[i] === 0 || m.tiles[i] === 3) { const zz = m.zones[i]; if (zz < ZONES.length) this.zoneSamples[zz].push([tx * TILE + 16, ty * TILE + 16]); } } }
    let best: [number, number] | null = null, bd = Infinity; for (const p of this.zoneSamples[z] ?? []) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = p; } }
    if (best && z === 1) { const dx = best[0] - x, dy = best[1] - y, l = Math.hypot(dx, dy) || 1; best = [best[0] + dx / l * 160, best[1] + dy / l * 160]; }
    return best;
  }
  private drawMini(): void {
    const g = this.g!; const cv = this.el.mini as HTMLCanvasElement; const c = cv.getContext('2d')!; const pos = g.myPos(); const S = cv.width; const tiles = 64; const k = S / tiles;
    c.save(); c.clearRect(0, 0, S, S); c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#0a0c16'; c.fillRect(0, 0, S, S); c.imageSmoothingEnabled = false;
    const tx = pos.x / TILE - tiles / 2, ty = pos.y / TILE - tiles / 2;
    c.drawImage(g.r.terrain.miniMap, tx, ty, tiles, tiles, 0, 0, S, S);
    const toM = (x: number, y: number) => [(x / TILE - tx) * k, (y / TILE - ty) * k];
    for (const s of g.map.shrines) { const [x, y] = toM(s.x, s.y); c.fillStyle = g.me.shrines.includes(s.id) ? '#9fd7ff' : '#556'; c.fillRect(x - 4, y - 4, 8, 8); }
    for (const m of g.mons.values()) { const def = MONSTERS[m.t]; if (def.beh !== 'boss' && def.key !== 'goldgob') { const [x, y] = toM(m.x, m.y); c.fillStyle = 'rgba(255,90,90,0.8)'; c.fillRect(x - 1.5, y - 1.5, 3, 3); } }
    for (const l of g.map.lairs) { const [x, y] = toM(l.x, l.y); c.font = '20px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('💀', x, y); }
    { const [x, y] = toM(g.map.altar.x, g.map.altar.y); c.font = '22px system-ui'; c.fillText(g.wb.state === 'idle' ? '🔥' : '🌕', x, y); }
    for (const m of g.mons.values()) if (MONSTERS[m.t].key === 'goldgob') { const [x, y] = toM(m.x, m.y); c.fillText('💰', x, y); }
    for (const p of g.players.values()) { if (p.id === g.myId) continue; const r = g.roster.get(p.id); const [x, y] = toM(p.x, p.y); c.fillStyle = (p.f & PF.DOWN) ? '#ff5a5a' : r?.bot ? '#7fb8ff' : '#7dffb0'; c.beginPath(); c.arc(x, y, 5, 0, 6.3); c.fill(); }
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.arc(S / 2, S / 2, 7, 0, 6.3); c.fill(); c.stroke();
    c.restore(); c.strokeStyle = 'rgba(255,224,138,0.8)'; c.lineWidth = 4; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); c.stroke();
  }
  private renderBoss(b: BossInfo | null): void {
    const E = this.el.boss; if (!b) { E.classList.add('hidden'); return; } E.classList.remove('hidden'); clear(E);
    const def = MONSTERS[b.type]; E.append(h('div', { class: 'bn' }, h('b', {}, def.name), b.enr ? h('span', { class: 'chip red' }, '분노') : null, h('small', {}, `${Math.ceil(b.hp / b.maxHp * 100)}%`)), h('div', { class: 'bb' }, h('i', { style: { width: `${b.hp / b.maxHp * 100}%` } })));
  }
  private renderWb(w: WorldBossState, tickOnly = false): void {
    const E = this.el.wb; if (!E) return;
    if (w.state === 'idle') { E.classList.add('hidden'); if (!tickOnly && this.g) this.snd.mood = this.g.me.zone === 0 ? 'town' : 'calm'; return; }
    E.classList.remove('hidden'); clear(E); const g = this.g!; const secs = Math.max(0, Math.round(w.t));
    const far = Math.hypot(g.myPos().x - g.map.altar.x, g.myPos().y - g.map.altar.y) > 900;
    E.append(h('span', {}, w.state === 'warn' ? `🌕 핏빛 달 — 불가사리 출현까지 ${fmtTime(secs)}` : `🔥 불가사리 토벌 중! ${fmtTime(secs)}`));
    if (far) E.append(h('button', { class: 'hudbtn', onclick: () => this.confirm('달맞이 제단으로 순간이동할까요?', () => this.send({ t: 'tp', shrine: 4 })) }, '제단으로'));
    if (w.state === 'fight' && w.top?.length) E.append(h('small', { class: 'block' }, w.top.slice(0, 3).map((t, i) => `${i + 1}. ${t.name} ${fmtNum(t.dmg)}`).join('  ')));
  }

  // ======================= actions =======================
  private useUlt(): void { const me = this.g?.me; if (!me) return; if (me.zone === 0) { this.toast('마을에서는 필살기를 쓸 수 없습니다'); return; } if (me.ult < 100) { this.toast(`필살기 충전 중 (${Math.floor(me.ult)}%) — 요괴를 처치하면 찹니다`); return; } this.send({ t: 'ult' }); }
  private quickEmote(): void { const i = [0, 1, 3, 4, 5][Math.floor(Math.random() * 5)]; this.send({ t: 'emote', e: i }); }
  private tapWorld(sx: number, sy: number): void {
    const g = this.g; if (!g?.ready) return; const rect = (this.el.cv as HTMLCanvasElement).getBoundingClientRect(); const [wx, wy] = g.r.toWorld(sx - rect.left, sy - rect.top);
    for (const n of g.map.npcs) if (Math.hypot(n.x - wx, n.y - 24 - wy) < 44) { this.snd.play('click'); this.openSheet(n.kind === 'smith' ? 'smith' : n.kind === 'talshop' ? 'tal' : n.kind === 'board' ? 'quest' : 'map'); return; }
  }
  send(m: C2S): void { this.g?.send(m); if (m.t !== 'i') this.snd.play('click'); }
  me(): MeState { return this.g!.me; }
  game(): Game { return this.g!; }
  chatLines() { return this.chat; }
  private addChat(name: string, text: string, sys: boolean): void {
    this.chat.push({ name, text, sys, t: Date.now() }); if (this.chat.length > 100) this.chat.shift();
    const el = h('div', { class: sys ? 'sys' : '', 'data-t': String(performance.now()) }, name ? h('b', {}, name + ': ') : null, text);
    this.el.chatlog?.append(el); while (this.el.chatlog && this.el.chatlog.children.length > 5) this.el.chatlog.firstChild!.remove();
    const log = this.sheet?.name === 'chat' ? $('#sheet .chatlog') : null; if (log) { log.append(h('div', { class: sys ? 'sys' : '' }, name ? h('b', {}, name + ': ') : null, text)); log.scrollTop = log.scrollHeight; }
  }
  toast(text: string, color?: string, big = false): void {
    const el = h('div', { class: `toast ${big ? 'big' : ''}`, style: { borderColor: color ?? '#9fd7ff' } }, text); this.el.toasts.append(el);
    this.toasts.push({ el, until: performance.now() + (big ? 3800 : 2600) }); while (this.toasts.length > 4) this.toasts.shift()!.el.remove();
  }
  confirm(text: string, yes: () => void): void { this.openModal(h('div', {}, h('p', {}, text), h('div', { class: 'row' }, h('button', { onclick: () => this.closeModal() }, '취소'), h('button', { class: 'primary grow', onclick: () => { this.closeModal(); yes(); } }, '확인')))); }
  openModal(el: HTMLElement): void { const m = $('#modal'); clear(m); m.classList.remove('hidden'); m.onclick = (e) => { if (e.target === m) this.closeModal(); }; m.append(h('div', { class: 'modal-card' }, h('button', { class: 'close', onclick: () => this.closeModal() }, '✕'), el)); }
  closeModal(): void { $('#modal')?.classList.add('hidden'); }
  openItem(it: Item, equipped: boolean): void { this.openModal(itemModal(this, it, equipped)); }
  toggleSheet(name: string): void { if (this.sheet?.name === name) this.closeSheet(); else this.openSheet(name); }
  openSheet(name: string, arg: unknown = null): void { if (!this.g?.ready) return; this.snd.play('click'); this.sheet = { name, arg }; this.renderSheet(); }
  closeSheet(): void { this.sheet = null; this.sheetPointer = false; const el = $('#sheet'); if (el) { el.classList.add('hidden'); clear(el); } }
  private renderSheet(): void {
    const s = this.sheet; const el = $('#sheet'); if (!s || !el) return;
    const titles: Record<string, string> = { bag: '가방', tal: '부적', quest: '퀘스트', map: '지도 · 신당 이동', settings: '메뉴', roster: '접속자', chat: '채팅', smith: '대장간', codex: '요괴 도감' };
    let body: HTMLElement;
    switch (s.name) {
      case 'bag': body = bagPanel(this); break; case 'tal': body = talPanel(this, s.arg as number | null); break; case 'quest': body = questPanel(this); break;
      case 'map': body = mapPanel(this); break; case 'roster': body = rosterPanel(this); break; case 'chat': body = chatPanel(this); break; case 'smith': body = smithPanel(this); break;
      case 'codex': body = codexPanel(); break; default: body = this.settingsPanel(false);
    }
    this.sheetT = performance.now();
    const card = el.querySelector('.sheet-card') as HTMLElement | null;
    if (card && card.dataset.name === s.name) { // same sheet: swap only the body so the header/✕ stay put under the finger
      const b = card.querySelector('.body') as HTMLElement; const scroll = b.scrollTop; clear(b); b.append(body); b.scrollTop = scroll; return;
    }
    clear(el); el.classList.remove('hidden');
    el.append(h('div', { class: 'sheet-card', 'data-name': s.name }, h('div', { class: 'head' }, h('b', {}, titles[s.name] ?? ''), h('button', { class: 'close', onclick: () => this.closeSheet() }, '✕')), h('div', { class: 'body' }, body)));
  }
  settingsPanel(onTitle: boolean): HTMLElement {
    const S = this.set; const save = () => { store.saveSettings(S); this.snd.setVolumes(S.sfx, S.bgm); this.g?.applySettings(); };
    const slider = (label: string, key: 'sfx' | 'bgm') => h('label', { class: 'set' }, h('span', {}, label), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S[key], oninput: (e: Event) => { S[key] = Number((e.target as HTMLInputElement).value); save(); } }));
    const toggle = (label: string, key: 'low' | 'dmgNums' | 'shake' | 'names') => h('label', { class: 'set' }, h('span', {}, label), h('input', { type: 'checkbox', checked: S[key], onchange: (e: Event) => { S[key] = (e.target as HTMLInputElement).checked; save(); } }));
    const server = h('input', { type: 'text', value: S.server, placeholder: '예: 192.168.0.10:8080 또는 game.example.com' }) as HTMLInputElement;
    server.addEventListener('change', () => { S.server = server.value.trim(); save(); });
    const g = this.g;
    return h('div', {},
      !onTitle && g ? h('div', { class: 'grid2' }, h('button', { onclick: () => this.openSheet('roster') }, '👥 접속자'), h('button', { onclick: () => this.openSheet('codex') }, '📖 요괴 도감'), h('button', { onclick: () => this.openSheet('chat') }, '💬 채팅'), h('button', { onclick: () => this.openSheet('smith') }, '⚒ 대장간')) : null,
      h('h3', {}, '소리 · 화면'), slider('효과음', 'sfx'), slider('배경음', 'bgm'), toggle('저사양 모드 (빛·파티클 줄임)', 'low'), toggle('피해 숫자 표시', 'dmgNums'), toggle('이름표 표시', 'names'),
      h('h3', {}, '온라인 서버'), h('small', { class: 'hint' }, '게임 서버(npm start)를 켠 주소. 서버가 이 페이지를 직접 제공하면 비워두세요.'), server,
      !onTitle && g ? h('div', { class: 'card' }, h('small', {}, `${g.online ? '온라인' : '오프라인 체험 월드'} · ${g.serverName} · 채널 ${g.channel} · FPS ${Math.round(g.fps)}${g.online ? ` · 핑 ${Math.round(g.rtt)}ms` : ''}`)) : null,
      h('h3', {}, '저장'), this.mode === 'offline' || onTitle ? this.backupBox() : h('small', { class: 'hint' }, '온라인 캐릭터는 서버에 저장됩니다. 이 기기의 접속 코드(백업)로 다른 기기에서도 이어할 수 있습니다.'),
      !onTitle ? h('button', { class: 'wide', onclick: () => { if (this.tr instanceof LocalTransport) this.tr.saveNow(); this.showTitle(); } }, '타이틀로 나가기') : null);
  }
  private backupBox(): HTMLElement {
    const ls = new store.LocalProfileStore(); const ta = h('textarea', { rows: 3, placeholder: '백업 코드를 붙여넣고 불러오기' }) as HTMLTextAreaElement;
    return h('div', { class: 'backup' }, h('small', { class: 'hint' }, '오프라인 캐릭터는 이 브라우저에 저장됩니다. 백업 코드로 옮길 수 있어요.'), ta,
      h('div', { class: 'row' }, h('button', { onclick: () => { if (this.tr instanceof LocalTransport) this.tr.saveNow(); const s = ls.exportString(store.token('offline')); ta.value = s ?? ''; if (s) { ta.select(); try { void navigator.clipboard?.writeText(s); } catch { /* ignore */ } } } }, '백업 코드 만들기'),
        h('button', { onclick: () => { if (!ta.value.trim()) return; if (ls.importString(store.token('offline'), ta.value)) { const p = ls.load(store.token('offline')); if (p) store.rememberChar('offline', { name: p.name, cls: p.cls, level: p.level, t: Date.now() }); alert('불러왔습니다. 타이틀에서 이어하기를 누르세요.'); this.showTitle(); } else alert('올바른 백업 코드가 아닙니다'); } }, '불러오기')));
  }
}

import { computeStats } from '../../shared/data/items.ts';
function computeStatsPower(p: Parameters<typeof computeStats>[0]): number { return computeStats(p).power; }
function hasMerge(me: MeState): boolean { const c = new Map<string, number>(); for (const t of me.tals) { if (t.lv >= 5) continue; const k = t.kind + t.lv; c.set(k, (c.get(k) ?? 0) + 1); } return [...c.values()].some(v => v >= 3); }
