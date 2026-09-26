// App shell: title/class select, game loop, HUD (orbs, skill bar, target bar, minimap), panels, modals,
// touch controls, audio + event routing, autosave.
import { CLASSES, CLASS_ORDER, SKILLS, skillAnim, xpToNext } from '../data/classes';
import { MON_MODS, MONSTERS } from '../data/monsters';
import { DIFFICULTIES, ZONES } from '../data/zones';
import { DT, Game, newHero, type SaveData } from '../sim/game';
import { genItem } from '../sim/items';
import { Rng } from '../sim/rng';
import { rankOf } from '../sim/skills';
import { computeStats } from '../sim/stats';
import type { ClassId, EquipSlot, GEvent, Item } from '../sim/types';
import { Audio } from '../platform/audio';
import { classSfx } from '../platform/sfx';
import * as store from '../platform/storage';
import { isUnlocked, loadProfile, record, saveProfile, unlockProgress, type Profile } from '../platform/profile';
import { drawBiped, type Look } from '../render/actors';
import { skillIconUrl } from '../render/icons';
import { Renderer, heroLook } from '../render/renderer';
import { BASE_BY_ID } from '../data/items';
import { $, clear, fmt, h } from './dom';
import { Input } from './input';
import { charPanel, deathModal, elderPanel, gamblerPanel, healerPanel, invPanel, menuModal, shopPanel, skillsPanel, stashPanel, victoryModal, waypointModal } from './panels';
import { itemTooltipHtml, type PriceMode } from './tooltip';

export type SelWhere = 'inv' | 'equip' | 'stash' | 'shop';
type LeftPanel = 'char' | 'skills' | 'shop' | 'healer' | 'elder' | 'gambler' | 'stash' | null;
type ModalKind = 'menu' | 'waypoint' | 'death' | 'victory' | null;

export class App {
  root: HTMLElement;
  screen: 'title' | 'game' = 'title';
  g: Game | null = null;
  r: Renderer | null = null;
  cv: HTMLCanvasElement | null = null;
  audio = new Audio();
  settings = store.loadSettings();
  input = new Input(this);
  touchMode = false;
  paused = false;
  panelL: LeftPanel = null;
  panelR: 'inv' | null = null;
  modal: ModalKind = null;
  mapOpen = false;
  sel: { where: SelWhere; idx: number | EquipSlot } | null = null;
  lastGamble: Item | null = null;
  npcLine = 0;
  wpDiff = 0;
  lastSaveOk = true; lastSaveAt = 0;
  private acc = 0; private lastT = 0; private saveT = 0; private mapT = 0; private sig = '';
  private msgs: HTMLElement | null = null;
  private titleAnim = 0;
  private victoryPending = 0;
  private deadShown = false;
  private hudCache: Record<string, string> = {};
  private bossTarget = 0;
  private canvasTip = 0;
  fps = 0; private fpsN = 0; private fpsT = 0;
  private hitStop = 0; private slowMo = 0; private slowDur = 1;
  private lowFps = 0; private playT = 0;
  private readonly lockQ = /[?&]hq\b/.test(location.search);
  /** Logical (landscape) viewport size in css px, and whether the app is rotated 90° to force landscape. */
  vw = window.innerWidth; vh = window.innerHeight; rotated = false;
  /** Account-wide progress (class unlocks). */
  profile: Profile = loadProfile();

  constructor(root: HTMLElement) {
    this.root = root;
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    this.fitViewport();
    window.addEventListener('resize', () => { this.fitViewport(); this.layout(); });
    window.addEventListener('orientationchange', () => setTimeout(() => { this.fitViewport(); this.layout(); }, 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.saveNow(); this.audio.suspend(); }
      else this.audio.resume();
    });
    window.addEventListener('beforeunload', () => this.saveNow());
    // any first gesture starts audio, so sounds and music are synthesized while the title screen is up
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, () => this.unlockAudio(), { capture: true, passive: true });
    this.showTitle();
  }

  /**
   * The game is landscape-only. On a phone held upright the whole app is rotated 90° (so it plays sideways even with the
   * rotation lock on); everything inside works in app-local coordinates — see toLocal().
   */
  fitViewport(): void {
    const W = window.innerWidth, H = window.innerHeight;
    const rot = (this.touchMode || /[?&]rot\b/.test(location.search)) && H > W;
    this.rotated = rot;
    this.vw = rot ? H : W; this.vh = rot ? W : H;
    document.documentElement.classList.toggle('rot', rot);
    document.documentElement.classList.toggle('short', this.vh <= 520);
    document.documentElement.classList.toggle('narrowL', this.vw <= 700 && this.vh > 520);
    document.documentElement.style.setProperty('--lvw', `${this.vw / 100}px`);
    document.documentElement.style.setProperty('--lvh', `${this.vh / 100}px`);
    const st = this.root.style;
    if (rot) { st.inset = 'auto'; st.left = '0'; st.top = '0'; st.width = `${H}px`; st.height = `${W}px`; st.transformOrigin = '0 0'; st.transform = `translateX(${W}px) rotate(90deg)`; }
    else { st.inset = ''; st.left = ''; st.top = ''; st.width = ''; st.height = ''; st.transform = ''; st.transformOrigin = ''; }
  }
  /** Screen (client) coordinates → app-local css px. */
  toLocal(cx: number, cy: number): { x: number; y: number } {
    return this.rotated ? { x: cy, y: this.vh - cx } : { x: cx, y: cy };
  }
  /** An element's box in app-local css px. */
  localRect(el: Element): { left: number; top: number; right: number; bottom: number } {
    const r = el.getBoundingClientRect();
    if (!this.rotated) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    const a = this.toLocal(r.left, r.top), b = this.toLocal(r.right, r.bottom);
    return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) };
  }
  /** Tries to go fullscreen + lock landscape on phones (Android); iOS keeps the CSS rotation. */
  private tryLandscapeLock(): void {
    if (!this.touchMode) return;
    try {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
      const fs = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
      const lock = () => { const o = screen.orientation as ScreenOrientation & { lock?: (t: string) => Promise<void> }; o?.lock?.('landscape').catch(() => { /* not supported */ }); };
      if (fs) fs.then(lock).catch(() => { /* fullscreen refused */ }); else lock();
    } catch { /* ignore */ }
  }

  unlockAudio(): void {
    this.audio.unlock();
    this.audio.setVolumes(this.settings.sfx, this.settings.bgm);
  }

  setTouchMode(on: boolean): void {
    if (this.touchMode === on) return;
    this.touchMode = on;
    $('#game')?.classList.toggle('touch', on);
    this.layout();
  }

  // ================================================================ title
  showTitle(): void {
    this.screen = 'title';
    cancelAnimationFrame(this.titleAnim);
    clear(this.root);
    this.fitViewport();
    this.audio.setMusic('title');
    const prof = (this.profile = loadProfile());
    const bg = h('canvas', { id: 'titlebg' });
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const lookOf = (cls: ClassId, save: SaveData | null): Look => {
      const hero = newHero(cls, CLASSES[cls].name);
      if (save) { for (const k of Object.keys(save.equip) as EquipSlot[]) hero.equip[k] = save.equip[k]; hero.level = save.level; }
      else { const rng = new Rng(1); for (const id of CLASSES[cls].startGear) { const b = BASE_BY_ID[id]; hero.equip[b.slot === 'ring' ? 'ring1' : (b.slot as EquipSlot)] = genItem(rng, 1, 1, { base: id, rarity: 'normal' }); } }
      return heroLook(hero);
    };
    const pose = (t: number, atk: number, spell: boolean) => ({ t, walk: 0, moving: false, atk: spell ? -1 : atk, cast: spell ? atk : -1, hit: 0, dead: -1, flip: false, back: false, alpha: 1, frozen: false, chill: false });
    const grid = h('div', { class: 'cgrid' });
    const detail = h('div', { class: 'detail' });
    const big = h('canvas', { class: 'bigportrait' }) as HTMLCanvasElement;
    const tiles = new Map<ClassId, HTMLElement>();
    const saves = new Map<ClassId, SaveData | null>();
    const looks = new Map<ClassId, Look>();
    let sel: ClassId = isUnlocked(prof, prof.lastClass) ? prof.lastClass : 'warrior';
    let unlockedN = 0;
    for (const cls of CLASS_ORDER) {
      const c = CLASSES[cls];
      const locked = !isUnlocked(prof, cls);
      if (!locked) unlockedN++;
      const save = locked ? null : store.loadHero(cls);
      saves.set(cls, save);
      const look = lookOf(cls, save);
      looks.set(cls, look);
      const cv = h('canvas', { class: 'tport' }) as HTMLCanvasElement;
      const isNew = !locked && !prof.seen.includes(cls);
      const tile = h('button', { class: 'ctile' + (locked ? ' locked' : '') + (isNew ? ' new' : ''), style: `--cc:${c.color};--ca:${c.accent}`, 'aria-label': c.name, onclick: () => select(cls) },
        cv, h('div', { class: 'tname' }, c.name), h('div', { class: 'tsub' }, locked ? '🔒 잠김' : save ? `Lv.${save.level}` : c.title));
      grid.appendChild(tile); tiles.set(cls, tile);
      // static tile portrait (silhouette while locked)
      const W = 84, H = 96;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const tc = cv.getContext('2d')!;
      tc.scale(dpr, dpr);
      const gl = tc.createRadialGradient(W / 2, H - 14, 2, W / 2, H - 26, 50);
      gl.addColorStop(0, locked ? 'rgba(120,120,140,0.18)' : 'rgba(255,150,70,0.32)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      tc.fillStyle = gl; tc.fillRect(0, 0, W, H);
      tc.fillStyle = 'rgba(0,0,0,0.45)'; tc.beginPath(); tc.ellipse(W / 2, H - 10, 20, 6, 0, 0, Math.PI * 2); tc.fill();
      tc.save(); tc.translate(W / 2, H - 10); tc.scale(1.45, 1.45);
      drawBiped(tc, look, pose(0.6, -1, false));
      tc.restore();
      if (locked) { tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'source-atop'; tc.fillStyle = 'rgba(10,8,14,0.93)'; tc.fillRect(0, 0, cv.width, cv.height); tc.globalCompositeOperation = 'source-over'; }
    }
    const renderDetail = (): void => {
      clear(detail);
      const c = CLASSES[sel];
      const locked = !isUnlocked(prof, sel);
      const save = saves.get(sel) ?? null;
      detail.setAttribute('style', `--cc:${c.color};--ca:${c.accent}`);
      const skills = [c.basic, ...c.skills];
      const icons = h('div', { class: 'dskills' }, ...skills.map((id) => h('img', { src: skillIconUrl(SKILLS[id]?.icon ?? id), alt: SKILLS[id]?.name ?? id, title: `${SKILLS[id]?.name ?? id} (레벨 ${SKILLS[id]?.req ?? 1})` })));
      detail.append(h('div', { class: 'cname' }, c.name, h('small', {}, c.title)), h('div', { class: 'cdesc' }, c.desc), icons);
      if (locked) {
        const prog = unlockProgress(prof, sel);
        detail.append(h('div', { class: 'lockbox' }, h('b', {}, '🔒 해금 조건'), h('div', {}, c.unlock?.text ?? ''), prog ? h('small', {}, prog) : null));
        return;
      }
      const nameIn = h('input', { class: 'namein', id: `name-${sel}`, maxlength: '12', value: save?.name ?? c.name, 'aria-label': '이름' }) as HTMLInputElement;
      const cls = sel;
      const begin = () => this.startGame(cls, nameIn.value.trim() || c.name, null);
      const start = () => {
        this.unlockAudio();
        if (!save) { begin(); return; }
        // in-page confirmation (browser dialogs are not available everywhere)
        const box = h('div', { class: 'confirm' },
          h('div', {}, `${save.name} (레벨 ${save.level}) 저장을 지우고 새로 시작할까요?`),
          h('div', { class: 'row' },
            h('button', { class: 'danger', onclick: begin }, '지우고 시작'),
            h('button', { onclick: () => box.remove() }, '취소')));
        detail.querySelector('.confirm')?.remove();
        detail.appendChild(box);
      };
      if (save) detail.append(h('button', { class: 'primary cont', onclick: () => { this.unlockAudio(); this.startGame(cls, save.name, save); } }, `이어하기 · ${save.name} Lv.${save.level}`, h('small', {}, `${DIFFICULTIES[Math.min(save.diff, 2)].name} · 최심 ${Math.max(...save.maxFloor)}층`)));
      detail.append(h('div', { class: 'newrow' }, nameIn, h('button', { class: save ? '' : 'primary', onclick: start }, save ? '새로 시작' : '시작')));
    };
    const select = (cls: ClassId): void => {
      sel = cls;
      for (const [k, t] of tiles) t.classList.toggle('sel', k === cls);
      if (isUnlocked(prof, cls) && !prof.seen.includes(cls)) { prof.seen.push(cls); saveProfile(prof); tiles.get(cls)?.classList.remove('new'); }
      renderDetail();
    };
    const t = h('div', { id: 'title' }, bg,
      h('div', { class: 'tleft' },
        h('div', { class: 'logo' }, h('small', {}, 'ABYSS · 액션 RPG'), h('h1', {}, '심연의 군주'), h('div', { class: 'sub' }, '대성당 아래 열린 심연 속으로. 괴물을 베고, 전리품을 줍고, 심연의 군주를 쓰러뜨려라.')),
        h('div', { class: 'dwrap' }, big, detail)),
      h('div', { class: 'tright' },
        h('div', { class: 'cghead' }, '직업 선택', h('small', {}, `${unlockedN} / ${CLASS_ORDER.length} 해금 · 진행하면 새 직업이 열립니다`)),
        grid,
        h('div', { class: 'foot' }, 'PC: 클릭 이동·공격 · 1~5 기술 · Q/E 물약 · T 귀환 · I/C/K 창 · Tab 지도', h('br'), '모바일: 가로 화면 전용 · 왼쪽 아래를 드래그해 이동 · 오른쪽 버튼으로 공격·기술', h('br'), h('span', { class: 'dim' }, store.storageOk ? '진행은 이 브라우저에 자동 저장됩니다.' : '⚠ 저장소를 쓸 수 없는 환경입니다. 창을 닫으면 진행이 사라집니다.'))));
    this.root.appendChild(t);
    select(sel);
    // big animated portrait of the selected class
    const portraits: { cv: HTMLCanvasElement; cls: () => ClassId }[] = [{ cv: big, cls: () => sel }];
    // animated background embers + portraits
    const bctx = bg.getContext('2d')!;
    const embers = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 2, v: 0.02 + Math.random() * 0.06 }));
    let t0 = performance.now();
    const loop = (now: number) => {
      if (this.screen !== 'title') return;
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      const W = (bg.width = bg.clientWidth), H = (bg.height = bg.clientHeight);
      const gr = bctx.createRadialGradient(W / 2, H * 1.1, 10, W / 2, H * 0.9, Math.max(W, H));
      gr.addColorStop(0, '#5a1408'); gr.addColorStop(0.35, '#1e0806'); gr.addColorStop(1, '#050304');
      bctx.fillStyle = gr; bctx.fillRect(0, 0, W, H);
      for (const e of embers) {
        e.y -= e.v * dt; e.x += Math.sin(now / 900 + e.s * 10) * 0.0004;
        if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
        bctx.fillStyle = `rgba(255,${120 + e.s * 40},40,${0.3 + 0.4 * Math.sin(now / 300 + e.s * 7) ** 2})`;
        bctx.fillRect(e.x * W, e.y * H, e.s * 1.5, e.s * 1.5);
      }
      for (const p of portraits) {
        const cls = p.cls();
        const locked = !isUnlocked(prof, cls);
        const cw = p.cv.clientWidth || 170, ch = p.cv.clientHeight || 200;
        if (p.cv.width !== Math.round(cw * dpr) || p.cv.height !== Math.round(ch * dpr)) { p.cv.width = Math.round(cw * dpr); p.cv.height = Math.round(ch * dpr); }
        const c = p.cv.getContext('2d')!;
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, ch);
        const g2 = c.createRadialGradient(cw / 2, ch - 24, 5, cw / 2, ch * 0.7, ch * 0.6);
        g2.addColorStop(0, locked ? 'rgba(140,140,170,0.2)' : 'rgba(255,140,60,0.35)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g2; c.fillRect(0, 0, cw, ch);
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(cw / 2, ch - 22, cw * 0.22, 11, 0, 0, Math.PI * 2); c.fill();
        c.save();
        c.translate(cw / 2, ch - 22); const k = Math.min(cw / 64, ch / 78); c.scale(k, k);
        const tt = now / 1000;
        const atk = (tt % 3.2) > 2.4 ? ((tt % 3.2) - 2.4) / 0.8 : -1;
        const spell = skillAnim(cls, CLASSES[cls].basic) === 'cast';
        drawBiped(c, looks.get(cls)!, pose(tt, locked ? -1 : atk, spell));
        c.restore();
        if (locked) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(10,8,14,0.92)'; c.fillRect(0, 0, p.cv.width, p.cv.height); c.globalCompositeOperation = 'source-over'; }
      }
      this.audio.tick();
      this.titleAnim = requestAnimationFrame(loop);
    };
    this.titleAnim = requestAnimationFrame(loop);
  }

  toTitle(): void {
    this.closeModal();
    this.g = null; this.r = null;
    this.showTitle();
  }

  // ================================================================ game
  startGame(cls: ClassId, name: string, save: SaveData | null): void {
    cancelAnimationFrame(this.titleAnim);
    this.tryLandscapeLock();
    this.profile.lastClass = cls;
    if (save) record(this.profile, { level: save.level }); else saveProfile(this.profile);
    const seed = save?.seed ?? ((Math.random() * 2 ** 32) >>> 0);
    this.g = new Game(cls, name, seed, save ?? undefined);
    const stash = store.loadStash();
    if (stash) for (let i = 0; i < Math.min(stash.length, this.g.stash.length); i++) this.g.stash[i] = stash[i];
    this.screen = 'game';
    this.panelL = null; this.panelR = null; this.modal = null; this.mapOpen = false; this.sel = null; this.deadShown = false; this.victoryPending = 0;
    this.wpDiff = this.g.diff;
    this.buildGameDom();
    // cast sounds first, then the class module's impact/extra sounds (pl_*, nc_*, …) so none renders mid-fight
    const pre = /^[a-z]{2}_/.exec(CLASSES[cls].skills[0])?.[0];
    this.audio.prepare([...CLASSES[cls].skills.map((id) => `cast_${id}`), ...(pre ? classSfx(pre) : [])]);
    if (!save) this.saveNow();
    this.emitIntro();
    this.lastT = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  private emitIntro(): void {
    const g = this.g!;
    if (g.hero.level === 1 && g.hero.kills === 0) {
      this.showMsg('잿빛마을에 오신 것을 환영합니다. 장로 오윈(마을 광장)에게 말을 걸어 보세요.', '#e8d8a0', true);
      this.showMsg(this.touchMode ? '왼쪽 아래를 드래그해 이동, 오른쪽 버튼으로 공격합니다. 북쪽 계단으로 대성당에 들어갈 수 있습니다.' : '클릭으로 이동하고, 북쪽의 계단을 클릭하면 대성당으로 내려갑니다. 1~5: 기술, Q: 물약.', '#c8c0b0');
    }
  }

  buildGameDom(): void {
    clear(this.root);
    const cv = h('canvas', { id: 'cv' });
    this.cv = cv;
    const slotBtn = (i: number) => {
      const b = h('button', { class: 'slot', 'data-slot': String(i) },
        h('img', { alt: '' }), h('span', { class: 'cd' }), h('span', { class: 'key' }, i < 0 ? '좌' : String(i + 1)), h('span', { class: 'mana' }));
      b.addEventListener('click', () => { this.unlockAudio(); if (i < 0) return; this.input.castAtCursor(i); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (i >= 0 && rankOf(this.g!, i) > 0) { this.g!.hero.rmbSkill = i; } });
      return b;
    };
    const hd = this.hudDpr();
    const orb = (cls: string) => h('div', { class: 'orb ' + cls }, h('canvas', { width: Math.round(120 * hd), height: Math.round(120 * hd) }), h('span', { class: 'orbtxt' }));
    const hud = h('div', { id: 'hud' },
      orb('hp'),
      h('div', { id: 'bar' },
        h('div', { id: 'xp' }, h('i'), h('span')),
        h('div', { id: 'slots' },
          h('button', { class: 'pot hp', onclick: () => this.g!.usePotion('hp'), title: '생명 물약 (Q)' }, h('span', { class: 'n' }), h('span', { class: 'key' }, 'Q')),
          slotBtn(-1), slotBtn(0), slotBtn(1), slotBtn(2), slotBtn(3), slotBtn(4),
          h('button', { class: 'pot mp', onclick: () => this.g!.usePotion('mp'), title: '마나 물약 (E)' }, h('span', { class: 'n' }), h('span', { class: 'key' }, 'E')),
          h('button', { class: 'pot scroll', onclick: () => this.g!.useScroll(), title: '귀환 두루마리 (T)' }, h('span', { class: 'n' }), h('span', { class: 'key' }, 'T'))),
        h('div', { id: 'menubtns' },
          h('button', { id: 'b-char', onclick: () => this.togglePanel('char') }, '캐릭터', h('small', {}, 'C')),
          h('button', { id: 'b-skills', onclick: () => this.togglePanel('skills') }, '기술', h('small', {}, 'K')),
          h('button', { id: 'b-inv', onclick: () => this.togglePanel('inv') }, '가방', h('small', {}, 'I')),
          h('button', { onclick: () => this.toggleMap() }, '지도', h('small', {}, 'Tab')),
          h('button', { onclick: () => this.escape() }, '메뉴', h('small', {}, 'Esc')))),
      orb('mp'));
    const tbtn = (i: number) => {
      const b = h('button', { class: 'tskill', 'data-slot': String(i) }, h('img', { alt: '' }), h('span', { class: 'cd' }));
      b.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.lastTouchAt = performance.now(); this.unlockAudio(); this.input.castAtCursor(i); this.input.heldSkill = i; b.classList.add('down'); }, { passive: false });
      const up = (e: Event) => { e.preventDefault(); this.input.heldSkill = -1; b.classList.remove('down'); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
      b.addEventListener('click', () => this.input.castAtCursor(i));
      return b;
    };
    const attack = h('button', { id: 't-attack' }, h('img', { alt: '공격' }));
    attack.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.lastTouchAt = performance.now(); this.unlockAudio(); this.input.attackHeld = true; this.input.touchAttack(); attack.classList.add('down'); }, { passive: false });
    const aup = (e: Event) => { e.preventDefault(); this.input.attackHeld = false; attack.classList.remove('down'); };
    attack.addEventListener('touchend', aup); attack.addEventListener('touchcancel', aup);
    attack.addEventListener('click', () => this.input.touchAttack());
    const tp = (cls: string, fn: () => void, label: string) => { const b = h('button', { class: 'tpot ' + cls, 'aria-label': label }, h('span', { class: 'n' })); b.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.lastTouchAt = performance.now(); fn(); }, { passive: false }); b.addEventListener('click', fn); return b; };
    const interact = h('button', { id: 't-interact', class: 'hidden' });
    interact.addEventListener('click', () => this.touchInteract());
    const joy = h('div', { id: 'joyzone' }, h('div', { id: 'joy', class: 'hidden' }, h('div', { id: 'knob' })));
    this.input.attachJoyZone(joy);
    const touch = h('div', { id: 'touch' },
      joy,
      h('div', { id: 'tright' }, attack, tbtn(0), tbtn(1), tbtn(2), tbtn(3), tbtn(4), interact),
      h('div', { id: 'tpots' }, tp('hp', () => this.g!.usePotion('hp'), '생명 물약'), tp('mp', () => this.g!.usePotion('mp'), '마나 물약'), tp('scroll', () => this.g!.useScroll(), '귀환 두루마리')),
      h('div', { id: 'tmenu' },
        h('button', { id: 't-inv', onclick: () => this.togglePanel('inv') }, '가방'),
        h('button', { id: 't-char', onclick: () => this.togglePanel('char') }, '능력'),
        h('button', { id: 't-skills', onclick: () => this.togglePanel('skills') }, '기술'),
        h('button', { onclick: () => this.toggleMap() }, '지도'),
        h('button', { onclick: () => this.escape() }, '≡')));
    const game = h('div', { id: 'game', class: this.touchMode ? 'touch' : '' },
      cv,
      h('div', { id: 'top' },
        h('div', { id: 'zone' }),
        h('div', { id: 'target', class: 'hidden' }, h('div', { class: 'tname' }), h('div', { class: 'tbar' }, h('i')), h('div', { class: 'tsub' })),
        h('canvas', { id: 'minimap', width: Math.round(180 * hd), height: Math.round(120 * hd) })),
      h('div', { id: 'buffs' }),
      h('div', { id: 'msgs' }),
      h('div', { id: 'banner' }),
      hud, touch,
      h('div', { id: 'panels' }, h('div', { class: 'pl' }), h('div', { class: 'pr' })),
      h('div', { id: 'mapov', class: 'hidden', onclick: () => this.toggleMap() }, h('canvas')),
      h('div', { id: 'modal', class: 'hidden' }),
      h('div', { id: 'tip', class: 'hidden' }));
    this.root.appendChild(game);
    this.msgs = $('#msgs');
    this.r = new Renderer(cv);
    this.input.attach(cv);
    // icons
    const c = CLASSES[this.g!.hero.cls];
    const icons = [c.basic, ...c.skills].map((id) => skillIconUrl(SKILLS[id].icon));
    game.querySelectorAll<HTMLButtonElement>('.slot').forEach((b) => { const i = Number(b.dataset.slot); b.querySelector('img')!.src = icons[i + 1]; });
    game.querySelectorAll<HTMLButtonElement>('.tskill').forEach((b) => { const i = Number(b.dataset.slot); b.querySelector('img')!.src = icons[i + 1]; });
    ($('#t-attack img') as HTMLImageElement).src = icons[0];
    this.applySettings();
    this.layout();
  }

  layout(): void {
    if (this.screen !== 'game' || !this.r) return;
    const w = this.vw, hgt = this.vh;
    this.r.resize(w, hgt);
    const mm = $('#mapov canvas') as HTMLCanvasElement | null;
    const hd = this.hudDpr();
    if (mm) { mm.width = Math.round(w * hd); mm.height = Math.round(hgt * hd); }
    $('#game')?.classList.toggle('narrow', w < 820);
    $('#game')?.classList.toggle('portrait', hgt > w);
  }

  applySettings(): void {
    const s = this.settings;
    this.audio.setVolumes(s.sfx, s.bgm);
    if (this.r) { this.r.lowFx = s.lowFx; this.r.showAll = s.showLabels; this.r.setQuality(this.r.quality); }
    store.saveSettings(s);
  }

  // ================================================================ loop
  frame(now: number): void {
    if (this.screen !== 'game' || !this.g || !this.r) return;
    const g = this.g, r = this.r;
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    this.fpsN++; this.fpsT += dt;
    if (this.fpsT >= 1) {
      this.fps = this.fpsN / this.fpsT; this.fpsN = 0; this.fpsT = 0;
      // adaptive quality: step down after a few slow seconds (never while paused or just after loading)
      if (!this.lockQ && !this.paused && this.playT > 4 && r.quality > 0) {
        this.lowFps = this.fps < 36 ? this.lowFps + 1 : 0;
        if (this.lowFps >= 3) { r.setQuality(r.quality - 1); this.lowFps = 0; }
      }
    }
    this.paused = this.modal === 'menu' || this.modal === 'waypoint' || this.modal === 'victory' || document.hidden || ((this.panelL !== null || this.panelR !== null || this.mapOpen) && (this.touchMode || this.vw < 820) && g.world.floor > 0);
    r.mouse.x = this.input.mouse.x; r.mouse.y = this.input.mouse.y; r.mouse.inside = this.input.mouse.inside && !this.touchMode;
    // hit-stop freezes the action for a few frames on heavy blows; slow motion eases back after boss kills
    let scale = 1;
    if (this.hitStop > 0) { this.hitStop -= dt; scale = 0.04; }
    else if (this.slowMo > 0) { this.slowMo -= dt; const k = 1 - Math.max(0, this.slowMo) / this.slowDur; scale = 0.22 + 0.78 * k * k; }
    if (!this.paused) {
      this.playT += dt;
      this.input.frame();
      this.acc += dt * scale;
      let n = 0;
      while (this.acc >= DT && n < 6) { g.update(DT); this.acc -= DT; n++; }
      if (n >= 6) this.acc = 0;
    }
    const events = g.drain();
    if (!this.settings.dmgNumbers) for (let i = events.length - 1; i >= 0; i--) { const e = events[i]; if (e.t === 'dmg' && e.kind !== 'hero' && e.kind !== 'gold') events.splice(i, 1); }
    if (!this.settings.shake) for (let i = events.length - 1; i >= 0; i--) if (events[i].t === 'shake') events.splice(i, 1);
    this.audio.listen(g.hero.x, g.hero.y);
    r.handle(events, g);
    for (const e of events) this.onEvent(e);
    r.render(g, this.paused ? 0 : dt * scale, this.paused ? 0 : dt);
    this.audio.setIntensity(this.combatIntensity(g));
    this.updateHud(dt);
    this.audio.tick();
    this.saveT += dt;
    if (this.saveT > 20) { this.saveT = 0; this.saveNow(); }
    if (this.victoryPending > 0) { this.victoryPending -= dt; if (this.victoryPending <= 0 && !this.modal) this.openModal('victory'); }
    // cursor + tooltip for item labels on the ground
    const hv = r.hover;
    this.cv!.style.cursor = hv ? (hv.kind === 'monster' ? 'crosshair' : 'pointer') : 'default';
    const drop = hv?.kind === 'drop' ? g.world.drops.find((d) => d.id === hv.id) : null;
    if (drop?.item && !this.touchMode) {
      if (this.canvasTip !== drop.id) {
        this.canvasTip = drop.id;
        const tip = $('#tip')!;
        tip.innerHTML = this.tipHtml(drop.item, 'none');
        tip.classList.remove('hidden');
      }
      const tip = $('#tip')!;
      const x = Math.min(this.vw - tip.offsetWidth - 6, this.input.mouse.x + 18), y = Math.min(this.vh - tip.offsetHeight - 6, this.input.mouse.y + 12);
      tip.style.left = `${Math.max(4, x)}px`; tip.style.top = `${Math.max(4, y)}px`;
    } else if (this.canvasTip) { this.canvasTip = 0; this.hideTip(); }
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Tells the player about classes that just became playable. */
  private announceUnlocks(list: ClassId[]): void {
    list.forEach((cls, i) => setTimeout(() => {
      this.banner(`새 직업 해금: ${CLASSES[cls].name}`, `${CLASSES[cls].title} — 제목 화면에서 새 캐릭터로 시작할 수 있습니다`);
      this.showMsg(`🔓 새 직업 「${CLASSES[cls].name}」이(가) 해금되었습니다!`, '#ffd070', true);
      this.audio.play('uniqueDrop');
    }, 1200 + i * 3000));
  }

  /** 0..1: awake monsters close to the hero (bosses count as a full fight). */
  private combatIntensity(g: Game): number {
    const h = g.hero;
    if (h.dead) return 0;
    let v = 0;
    for (const m of g.world.monsters) {
      if (m.dead || !m.awake) continue;
      const d = Math.hypot(m.x - h.x, m.y - h.y);
      if (d < 10) v += m.rank === 'boss' ? 4 : m.rank === 'unique' || m.rank === 'champion' ? 1 : 0.35;
    }
    return Math.min(1, v / 2);
  }

  private onEvent(e: GEvent): void {
    const g = this.g!;
    switch (e.t) {
      case 'sfx': this.audio.play(e.id, 1, e.x, e.y); break;
      case 'impact': {
        const a = this.audio;
        const magic = CLASSES[g.hero.cls].spell;
        const id = e.elem === 'fire' ? 'hitFire' : e.elem === 'cold' ? 'hitCold' : e.elem === 'light' ? 'hitLight' : e.elem === 'poison' ? 'hitPoison'
          : e.via === 'proj' ? (magic ? 'hitMagic' : 'hitArrow') : e.via === 'spell' ? 'hitMagic' : e.crit || e.power > 0.3 || e.kill ? 'hitHeavy' : 'hit';
        a.play(id, 0.75 + Math.min(0.5, e.power), e.x, e.y);
        if (e.via === 'melee' && id !== 'hit' && id !== 'hitHeavy') a.play('hit', 0.6, e.x, e.y);
        if (e.crit) a.play('crit', 1, e.x, e.y);
        if (e.via === 'melee' && (e.crit || e.power > 0.3 || e.kill)) this.hitStop = Math.max(this.hitStop, e.crit ? 0.065 : 0.045);
        else if (e.crit) this.hitStop = Math.max(this.hitStop, 0.03);
        break;
      }
      case 'kill':
        if (e.rank === 'boss') { this.slowMo = this.slowDur = 1.6; this.hitStop = 0.12; this.audio.muffle(2.2); }
        else if (e.rank === 'unique' || e.rank === 'champion') { this.hitStop = Math.max(this.hitStop, 0.09); this.audio.play('eliteKill', 1, e.x, e.y); }
        break;
      case 'dmg':
        if (e.kind === 'hero' && e.v >= g.hero.st.maxHp * 0.15) this.hitStop = Math.max(this.hitStop, 0.05);
        break;
      case 'msg': this.showMsg(e.text, e.color ?? '#e8d8b0', !!e.big); break;
      case 'itemDrop': this.audio.play(e.rarity === 'unique' ? 'uniqueDrop' : e.rarity === 'rare' ? 'rareDrop' : 'itemDrop'); break;
      case 'pickup': this.showMsg(`획득: ${e.item.name}`, e.item.rarity === 'unique' ? '#c8a45a' : e.item.rarity === 'rare' ? '#f2e05a' : e.item.rarity === 'magic' ? '#8a9aff' : '#d8d0c0'); this.refresh(); break;
      case 'levelup': this.refresh(true); this.saveNow(); this.announceUnlocks(record(this.profile, { level: e.level })); break;
      case 'death': this.audio.muffle(3); this.slowMo = this.slowDur = 1.2; this.deadShown = false; setTimeout(() => { if (this.g === g && g.hero.dead && !this.deadShown) { this.deadShown = true; this.openModal('death'); } }, 1400); this.audio.setMusic('none'); break;
      case 'zone': {
        this.audio.prepare(ZONES[g.world.zone].monsters.flatMap((id) => [`die_${MONSTERS[id].art}`, MONSTERS[id].proj ? `mshoot_${MONSTERS[id].proj}` : '']).filter((n) => n));
        this.banner(e.name, e.floor > 0 ? `${DIFFICULTIES[g.diff].name} · 몬스터 레벨 ${g.world.mlvl}` : '안전 지대');
        this.audio.setMusic(ZONES[g.world.zone].music);
        this.bossTarget = 0;
        if (this.panelL === 'shop' || this.panelL === 'healer' || this.panelL === 'elder' || this.panelL === 'gambler' || this.panelL === 'stash') this.closePanels();
        if (this.modal === 'death' && !g.hero.dead) this.closeModal();
        break;
      }
      case 'boss': this.bossTarget = e.id; this.audio.setMusic('boss'); break;
      case 'bossDead': this.announceUnlocks(record(this.profile, { boss: e.tpl, diff: e.diff })); this.bossTarget = 0; this.audio.setMusic(ZONES[g.world.zone].music); this.saveNow(); if (e.final) this.victoryPending = 3.5; break;
      case 'open':
        this.npcLine++;
        this.sel = null;
        if (e.ui === 'waypoint') { this.wpDiff = g.diff; this.openModal('waypoint'); }
        else { this.panelL = e.ui === 'shop' ? 'shop' : e.ui; this.panelR = e.ui === 'shop' || e.ui === 'stash' || e.ui === 'gambler' ? 'inv' : this.touchMode || this.vw < 820 ? null : this.panelR; this.audio.play('open'); this.refresh(true); }
        break;
      case 'save': this.saveNow(); break;
    }
  }

  // ================================================================ HUD
  private setText(key: string, el: Element | null, text: string): void {
    if (!el || this.hudCache[key] === text) return;
    this.hudCache[key] = text; el.textContent = text;
  }

  /** Pixel density for HUD canvases (orbs, minimap, map). */
  hudDpr(): number { return Math.min(3, Math.max(1, window.devicePixelRatio || 1)); }

  private drawOrb(cv: HTMLCanvasElement, frac: number, col: [string, string, string], t: number): void {
    const c = cv.getContext('2d')!;
    const W = cv.width, u = W / 120, R = W / 2 - 6 * u;
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.arc(W / 2, W / 2, R, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#0a0808'; c.fillRect(0, 0, W, W);
    const level = W / 2 + R - frac * R * 2;
    const g = c.createLinearGradient(0, level, 0, W);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, W);
    for (let x = 0; x <= W; x += 3 * u) c.lineTo(x, level + (Math.sin(x / (11 * u) + t * 2.4) * 2.2 + Math.sin(x / (5 * u) - t * 3.1)) * u);
    c.lineTo(W, W); c.closePath(); c.fill();
    for (let i = 0; i < 6; i++) { const bx = W / 2 + Math.sin(t * 0.7 + i * 2.1) * R * 0.6, by = level + ((t * 18 * u + i * 29 * u) % (W - level + 1)); c.fillStyle = col[2]; c.globalAlpha = 0.25; c.beginPath(); c.arc(bx, W - (by - level), 1.8 * u, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    const hl = c.createRadialGradient(W * 0.38, W * 0.3, 2 * u, W * 0.45, W * 0.4, R);
    hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(0.4, 'rgba(255,255,255,0.05)'); hl.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = hl; c.fillRect(0, 0, W, W);
    c.restore();
    c.lineWidth = 5 * u; c.strokeStyle = '#5a4424'; c.beginPath(); c.arc(W / 2, W / 2, R + 2 * u, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.5 * u; c.strokeStyle = '#c8a860'; c.beginPath(); c.arc(W / 2, W / 2, R + 4 * u, 0, Math.PI * 2); c.stroke();
  }

  private updateHud(dt: number): void {
    const g = this.g!, hero = g.hero, st = hero.st, r = this.r!;
    const t = r.time;
    const hpc = $('.orb.hp canvas') as HTMLCanvasElement, mpc = $('.orb.mp canvas') as HTMLCanvasElement;
    const poisoned = false;
    if (hpc) this.drawOrb(hpc, Math.max(0, hero.hp / st.maxHp), poisoned ? ['#40b030', '#103008', '#a0ff80'] : ['#d42020', '#4a0404', '#ff9090'], t);
    if (mpc) this.drawOrb(mpc, Math.max(0, hero.mp / st.maxMp), ['#3050e0', '#08104a', '#90a0ff'], t + 1.3);
    this.setText('hpt', $('.orb.hp .orbtxt'), `${Math.max(0, Math.ceil(hero.hp))}/${st.maxHp}`);
    this.setText('mpt', $('.orb.mp .orbtxt'), `${Math.floor(hero.mp)}/${st.maxMp}`);
    const need = xpToNext(hero.level);
    const xpi = $('#xp i') as HTMLElement | null;
    if (xpi) xpi.style.width = `${Math.min(100, (hero.xp / need) * 100)}%`;
    this.setText('xpt', $('#xp span'), `레벨 ${hero.level} · ${Math.floor((hero.xp / need) * 100)}%`);
    // skills
    const c = CLASSES[hero.cls];
    const update = (sel: string) => document.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => {
      const i = Number(b.dataset.slot);
      if (i < 0) return;
      const id = c.skills[i], d = SKILLS[id];
      const rank = rankOf(g, i);
      const learned = rank > 0;
      const cd = hero.cds[i];
      const full = d.cd(Math.max(1, rank)) || 1;
      b.classList.toggle('off', !learned);
      b.classList.toggle('nomana', learned && hero.mp < d.mana(rank));
      b.classList.toggle('rmb', hero.rmbSkill === i && !this.touchMode);
      (b.querySelector('.cd') as HTMLElement).style.setProperty('--cd', cd > 0 ? `${(cd / full) * 360}deg` : '0deg');
      const m = b.querySelector('.mana');
      if (m) this.setText('mana' + sel + i, m, learned ? String(d.mana(rank)) : '');
    });
    update('.slot'); update('.tskill');
    this.setText('php', $('.pot.hp .n'), String(hero.potHp)); this.setText('pmp', $('.pot.mp .n'), String(hero.potMp)); this.setText('psc', $('.pot.scroll .n'), String(hero.scrolls));
    this.setText('tphp', $('.tpot.hp .n'), String(hero.potHp)); this.setText('tpmp', $('.tpot.mp .n'), String(hero.potMp)); this.setText('tpsc', $('.tpot.scroll .n'), String(hero.scrolls));
    // level-up badges
    $('#b-char')?.classList.toggle('badge', hero.freePts > 0); $('#t-char')?.classList.toggle('badge', hero.freePts > 0);
    $('#b-skills')?.classList.toggle('badge', hero.skillPts > 0); $('#t-skills')?.classList.toggle('badge', hero.skillPts > 0);
    // zone
    this.setText('zone', $('#zone'), `${g.world.name}${g.world.floor > 0 ? ` · ${DIFFICULTIES[g.diff].name}` : ''}`);
    // target bar: boss > hovered monster
    const tgt = $('#target') as HTMLElement;
    let mid = this.bossTarget;
    const hv = r.hover;
    if (hv?.kind === 'monster') mid = hv.id;
    else if (hv?.kind === 'npc') mid = -hv.id;
    const m = mid > 0 ? g.world.monsters.find((q) => q.id === mid && !q.dead) : null;
    const npc = mid < 0 ? g.world.npcs.find((q) => q.id === -mid) : null;
    if (m) {
      tgt.classList.remove('hidden');
      const tpl = MONSTERS[m.tpl];
      const col = m.rank === 'boss' ? '#ff7a40' : m.rank === 'unique' ? '#e0b050' : m.rank === 'champion' ? '#7a90ff' : '#e8e0d0';
      const nm = m.rank === 'unique' ? `${m.name} (${tpl.name})` : m.rank === 'champion' ? `${tpl.name} · 챔피언` : m.rank === 'minion' ? `${tpl.name} · 추종자` : m.name;
      this.setText('tname', tgt.querySelector('.tname'), nm);
      (tgt.querySelector('.tname') as HTMLElement).style.color = col;
      (tgt.querySelector('.tbar i') as HTMLElement).style.width = `${(m.hp / m.maxHp) * 100}%`;
      const res = Object.entries(m.res).filter(([, v]) => v >= 50).map(([k]) => ({ phys: '물리', fire: '화염', cold: '냉기', light: '번개', poison: '독' }[k as 'phys'])).join('·');
      this.setText('tsub', tgt.querySelector('.tsub'), [m.mods.map((x) => MON_MODS[x].name).join(' · '), res ? `${res} 저항` : '', `레벨 ${m.lvl}`].filter(Boolean).join('  |  '));
      tgt.classList.toggle('boss', m.rank === 'boss');
    } else if (npc) {
      tgt.classList.remove('hidden', 'boss');
      this.setText('tname', tgt.querySelector('.tname'), npc.name);
      (tgt.querySelector('.tname') as HTMLElement).style.color = '#e8d8a0';
      (tgt.querySelector('.tbar i') as HTMLElement).style.width = '0%';
      this.setText('tsub', tgt.querySelector('.tsub'), '대화하기');
    } else tgt.classList.add('hidden');
    // buffs
    const bf = $('#buffs')!;
    const bsig = hero.buffs.map((b) => b.id + Math.ceil(b.t)).join(',');
    if (this.hudCache.buffs !== bsig) {
      this.hudCache.buffs = bsig;
      const names: Record<string, string> = { warcry: '전쟁의 함성', berserk: '광폭화', evade: '회피', shrineDmg: '전투', shrineArmor: '수호', shrineXp: '경험', shrineMf: '행운', shrineSpeed: '신속' };
      clear(bf);
      for (const b of hero.buffs) bf.appendChild(h('div', { class: 'buff' }, `${b.name ?? names[b.id] ?? b.id} ${Math.ceil(b.t)}s`));
    }
    // minimap
    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 0.2;
      const mm = $('#minimap') as HTMLCanvasElement;
      const hd = this.hudDpr();
      if (mm) { const mc = mm.getContext('2d')!; mc.setTransform(hd, 0, 0, hd, 0, 0); r.drawMap(mc, g, mm.width / hd, mm.height / hd, 3.2, false); }
      if (this.mapOpen) { const big = $('#mapov canvas') as HTMLCanvasElement; if (big) { const bc = big.getContext('2d')!; bc.setTransform(hd, 0, 0, hd, 0, 0); r.drawMap(bc, g, big.width / hd, big.height / hd, 7, true); } }
    }
    // touch interact prompt
    if (this.touchMode) this.updateInteract();
    // panels: rebuild when state signature changes
    this.refresh();
  }

  private nearInteract(): { label: string; fn: () => void } | null {
    const g = this.g!, hero = g.hero, w = g.world;
    let best: { d: number; label: string; fn: () => void } | null = null;
    const consider = (d: number, label: string, fn: () => void) => { if (d < 2.6 && (!best || d < best.d)) best = { d, label, fn }; };
    for (const d of w.drops) if (d.item) consider(Math.hypot(d.x - hero.x, d.y - hero.y), `줍기: ${d.item.name}`, () => g.setIntent({ type: 'interact', kind: 'drop', id: d.id, x: d.x, y: d.y }));
    for (const n of w.npcs) consider(Math.hypot(n.x - hero.x, n.y - hero.y) - 0.5, `대화: ${n.name}`, () => g.setIntent({ type: 'interact', kind: 'npc', id: n.id, x: n.x, y: n.y }));
    for (const p of w.props) {
      if (p.used && !['waypoint', 'stash', 'portal', 'well'].includes(p.kind)) continue;
      const lab: Record<string, string> = { chest: '상자 열기', bigchest: '보물 상자 열기', sarco: '석관 열기', shrine: '성소 사용', waypoint: '표석 (이동)', stash: '보관함', portal: '차원문 들어가기', well: '우물' };
      if (!lab[p.kind]) continue;
      consider(Math.hypot(p.x - hero.x, p.y - hero.y), lab[p.kind], () => g.setIntent({ type: 'interact', kind: 'prop', id: p.id, x: p.x, y: p.y }));
    }
    if (w.down) consider(Math.hypot(w.down.x - hero.x, w.down.y - hero.y), w.floor === 0 ? '대성당으로 내려가기' : '아래층으로', () => g.setIntent({ type: 'interact', kind: 'stairs', id: 1, x: w.down!.x, y: w.down!.y }));
    if (w.up) consider(Math.hypot(w.up.x - hero.x, w.up.y - hero.y), w.floor === 1 ? '마을로 올라가기' : '위층으로', () => g.setIntent({ type: 'interact', kind: 'stairs', id: -1, x: w.up!.x, y: w.up!.y }));
    return best;
  }
  private interactFn: (() => void) | null = null;
  private updateInteract(): void {
    const b = $('#t-interact') as HTMLElement;
    const n = this.nearInteract();
    this.interactFn = n?.fn ?? null;
    b.classList.toggle('hidden', !n);
    if (n) this.setText('tint', b, n.label);
  }
  touchInteract(): void { this.interactFn?.(); }

  showJoy(j: { cx: number; cy: number; x: number; y: number } | null): void {
    const el = $('#joy') as HTMLElement, knob = $('#knob') as HTMLElement;
    if (!el) return;
    if (!j) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.style.left = `${j.cx - 55}px`; el.style.top = `${j.cy - 55}px`;
    let dx = j.x - j.cx, dy = j.y - j.cy; const l = Math.hypot(dx, dy); if (l > 45) { dx = (dx / l) * 45; dy = (dy / l) * 45; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  }

  showMsg(text: string, color: string, big = false): void {
    if (!this.msgs || !text) return;
    const el = h('div', { class: 'msg' + (big ? ' big' : ''), style: `color:${color}` }, text);
    this.msgs.appendChild(el);
    while (this.msgs.children.length > 5) this.msgs.removeChild(this.msgs.firstChild!);
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600); }, big ? 4200 : 3000);
  }
  banner(title: string, sub: string): void {
    const b = $('#banner');
    if (!b) return;
    clear(b);
    b.appendChild(h('div', { class: 'bt' }, title)); b.appendChild(h('div', { class: 'bs' }, sub));
    b.classList.remove('show'); void (b as HTMLElement).offsetWidth; b.classList.add('show');
  }

  // ================================================================ panels
  togglePanel(p: 'inv' | 'char' | 'skills'): void {
    this.unlockAudio();
    this.sel = null;
    if (p === 'inv') this.panelR = this.panelR ? null : 'inv';
    else this.panelL = this.panelL === p ? null : p;
    if ((this.touchMode || this.vw < 820) && p !== 'inv' && this.panelL) this.panelR = null;
    if ((this.touchMode || this.vw < 820) && p === 'inv' && this.panelR && (this.panelL === 'char' || this.panelL === 'skills')) this.panelL = null;
    this.audio.play('open');
    this.refresh(true);
  }
  closePanels(): void {
    this.panelL = null; this.panelR = null; this.sel = null; this.hideTip();
    this.refresh(true);
    this.saveNow();
  }
  toggleMap(): void {
    this.mapOpen = !this.mapOpen;
    $('#mapov')?.classList.toggle('hidden', !this.mapOpen);
    this.mapT = 0;
  }
  escape(): void {
    if (this.modal === 'death') return;
    if (this.modal) { this.closeModal(); return; }
    if (this.mapOpen) { this.toggleMap(); return; }
    if (this.panelL || this.panelR) { this.closePanels(); return; }
    this.openModal('menu');
  }
  openModal(k: Exclude<ModalKind, null>): void {
    this.modal = k;
    const m = $('#modal')!;
    clear(m);
    m.classList.remove('hidden');
    m.appendChild(k === 'menu' ? menuModal(this) : k === 'waypoint' ? waypointModal(this) : k === 'death' ? deathModal(this) : victoryModal(this));
    this.hideTip();
  }
  closeModal(): void {
    this.modal = null;
    const m = $('#modal');
    if (m) { clear(m); m.classList.add('hidden'); }
  }

  /** Rebuild open panels if relevant state changed (or when forced). */
  refresh(force = false): void {
    const g = this.g;
    if (!g || this.screen !== 'game') return;
    const hero = g.hero;
    const sig = [this.panelL, this.panelR, hero.gold, hero.freePts, hero.skillPts, hero.level, hero.potHp, hero.potMp, hero.scrolls, hero.rmbSkill,
      hero.inv.map((i) => i?.uid ?? 0).join('.'), Object.values(hero.equip).map((i) => i?.uid ?? 0).join('.'), g.shop.length, g.stash.map((i) => i?.uid ?? 0).join('.'),
      JSON.stringify(this.sel), this.lastGamble?.uid ?? 0, Math.round(hero.hp / 10), Math.round(hero.mp / 10), hero.st.maxHp].join('|');
    if (!force && sig === this.sig) return;
    this.sig = sig;
    const pl = $('#panels .pl')!, pr = $('#panels .pr')!;
    clear(pl); clear(pr);
    const L = this.panelL;
    if (L) pl.appendChild(L === 'char' ? charPanel(this) : L === 'skills' ? skillsPanel(this) : L === 'shop' ? shopPanel(this) : L === 'healer' ? healerPanel(this) : L === 'elder' ? elderPanel(this) : L === 'gambler' ? gamblerPanel(this) : stashPanel(this));
    if (this.panelR) pr.appendChild(invPanel(this));
    $('#panels')!.classList.toggle('open', !!(L || this.panelR));
    $('#panels')!.classList.toggle('both', !!(L && this.panelR));
  }

  // ================================================================ item selection / actions
  itemAt(where: SelWhere, idx: number | EquipSlot): Item | null {
    const g = this.g!;
    if (where === 'inv') return g.hero.inv[idx as number] ?? null;
    if (where === 'equip') return g.hero.equip[idx as EquipSlot] ?? null;
    if (where === 'stash') return g.stash[idx as number] ?? null;
    return g.shop[idx as number] ?? null;
  }
  select(where: SelWhere, idx: number | EquipSlot): void {
    // click selects (action buttons appear below), double-click / right-click does the quick action
    if (this.sel && this.sel.where === where && this.sel.idx === idx) { if (this.touchMode) this.sel = null; }
    else this.sel = { where, idx };
    this.audio.play('click');
    this.refresh(true);
  }
  quick(where: SelWhere, idx: number | EquipSlot): void {
    const g = this.g!;
    const it = this.itemAt(where, idx);
    if (!it) return;
    if (where === 'inv') {
      if (this.panelL === 'shop' && g.world.floor === 0) g.sell(idx as number);
      else if (this.panelL === 'stash') g.stashPut(idx as number);
      else g.equipFromInv(idx as number);
    } else if (where === 'equip') g.unequip(idx as EquipSlot);
    else if (where === 'stash') g.stashTake(idx as number);
    else if (where === 'shop') g.buy(idx as number);
    this.sel = null; this.hideTip();
    this.refresh(true);
  }
  selBox(): HTMLElement | null {
    if (!this.sel) return null;
    const g = this.g!;
    const { where, idx } = this.sel;
    const it = this.itemAt(where, idx);
    if (!it) return null;
    const btns: HTMLElement[] = [];
    const act = (label: string, fn: () => void, cls = '') => btns.push(h('button', { class: cls, onclick: () => { fn(); this.sel = null; this.refresh(true); } }, label));
    if (where === 'inv') {
      act('장착', () => g.equipFromInv(idx as number), 'primary');
      if (this.panelL === 'shop' && g.world.floor === 0) act('판매', () => g.sell(idx as number));
      if (this.panelL === 'stash') act('보관', () => g.stashPut(idx as number));
      act('버리기', () => g.dropFromInv(idx as number), 'danger');
    } else if (where === 'equip') act('해제', () => g.unequip(idx as EquipSlot), 'primary');
    else if (where === 'stash') act('꺼내기', () => g.stashTake(idx as number), 'primary');
    else act('구매', () => g.buy(idx as number), 'primary');
    act('닫기', () => undefined);
    const price: PriceMode = where === 'shop' ? 'buy' : where === 'inv' && this.panelL === 'shop' ? 'sell' : 'none';
    return h('div', { class: 'selbox' }, h('div', { class: 'tt', html: this.tipHtml(it, price, where === 'equip') }), h('div', { class: 'selbtns' }, ...btns));
  }
  tipHtml(it: Item, price: PriceMode, equipped = false): string { return itemTooltipHtml(this.g!, it, { price, equipped }); }
  showTip(it: Item, anchor: HTMLElement, where: SelWhere): void {
    const tip = $('#tip')!;
    const price: PriceMode = where === 'shop' ? 'buy' : where === 'inv' && this.panelL === 'shop' ? 'sell' : 'none';
    tip.innerHTML = this.tipHtml(it, price, where === 'equip');
    tip.classList.remove('hidden');
    const r = this.localRect(anchor);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left - tw - 8; if (x < 4) x = r.right + 8; if (x + tw > this.vw - 4) x = Math.max(4, this.vw - tw - 4);
    let y = r.top; if (y + th > this.vh - 4) y = Math.max(4, this.vh - th - 4);
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  }
  hideTip(): void { $('#tip')?.classList.add('hidden'); }

  // ================================================================ saving
  saveNow(): void {
    const g = this.g;
    if (!g || this.screen !== 'game') return;
    this.lastSaveOk = store.saveHero(g.toSave()) && store.saveStash(g.stash);
    this.lastSaveAt = Date.now();
  }
}

export { computeStats, fmt };
