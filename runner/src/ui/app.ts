// App core: navigation, modal/toast, run lifecycle, the fixed-step loop (GDD §4.7), pause & resume countdown,
// results hand-off, audio routing and saving. Menu screens live in ./screens.ts (they call the stable API below).
//
// Loop rules: accumulator += min(frameDt, 0.25) × gameSpeed; ≤ MAX_CATCHUP_STEPS per frame, the rest is dropped
// (no burst after a hitch); render is interpolated (camera + runner, skipping teleports) and capped at 60 Hz
// (30 Hz + DPR ≤ 1.5 with 배터리 절약); a frame gap > STALL_PAUSE_MS, hiding the page, blur, resize or rotation
// auto-pauses. Resuming is an explicit 계속 + a 1.5 s 3-2-1 held HERE — the sim never sees it, so the input log
// (ghosts, replays) stays step-exact. The rAF loop only runs while a run is live (not on menus / pause / results).
import { DT, VIEW_W, VIEW_H, GROUND_Y } from '../data/physics';
import { LOW_HP_FRAC } from '../data/tuning';
import { STAGES, STAGE_BY_ID } from '../data/stages';
import { BIOME_BY_ID } from '../data/biomes';
import { newRun, stepRun, totalScore, type RunConfig } from '../sim/run';
import type { RunState, SimEvent, Mode } from '../sim/types';
import { Renderer, type GhostView } from '../render/renderer';
import { HAT_IDS, type HatId } from '../render/characters';
import { Audio } from '../platform/audio';
import * as store from '../platform/storage';
import { applyRun, dailySeed, dailyChar, dailyCompanion, dailyArchive, todayKey, featureOpen, ghostKeyFor, type Progress, type RunReward, type GhostRec } from '../meta/progress';
import { MISSION_BY_ID, missionText } from '../meta/missions';
import { InputState, keyZone, bindSurface, evTime, type Zone } from './input';
import { CONTENT_HASH } from '../sim/content';
import { h, clear } from './dom';
import { mountResults, nextStageAfter, HINT_VERB, fmtNum } from './results';
import * as screens from './screens';

const MAX_CATCHUP_STEPS = 5;
const STALL_PAUSE_MS = 250;
const RESUME_COUNT_T = 1.5;
const TUTORIAL_SLOW = 0.4;
const TUTORIAL_SLOW_MIN = 2;      // s (real) of 40 % speed after a tutorial rewind…
const TUTORIAL_SLOW_MAX = 5;      // …until the runner is past the hazard, at most this long
export const VERSION = '0.2.0-beta.1';

export type Screen = 'home' | 'chars' | 'adventure' | 'daily' | 'missions' | 'settings' | 'run' | 'results' | (string & {});
export interface StartOpts { noCountdown?: boolean }

interface RunCtx {
  s: RunState; cfg: RunConfig; dateKey: string;
  ghost: RunState | null; ghostLog: number[]; ghostIdx: number; ghostBits: number;
  acc: number; lastT: number; frames: number; prevX: number; prevY: number;
  paused: boolean; ended: boolean; reward: RunReward | null;
  resumeT: number;
  slow: { t: number; untilX: number } | null;
  slideTaught: boolean;                     // tutorial: before the slide beat the whole landscape screen is "jump"
  warned50: boolean; lowT: number; missionT: number; toasted: Set<string>;
  results: { dispose: () => void; readyAt: number } | null;
  timers: number[];
  unbind: (() => void) | null;
}

export class App {
  root: HTMLElement;
  p: Progress;
  audio = new Audio();
  input = new InputState();
  renderer: Renderer | null = null;
  run: RunCtx | null = null;
  screen: Screen = 'home';
  fps = 0; private frames = 0; private fpsT = 0;
  /** a frame gap longer than this auto-pauses a live run (GDD §4.7); tests may raise it around screenshots */
  stallMs = STALL_PAUSE_MS;
  private graceUntil = 0;            // no stall-pause right after a run starts / the first gesture (audio init)
  private raf = 0; private loopOn = false;
  private lastW = 0; private lastH = 0;
  private persistAsked = false;
  private probe: HTMLElement | null = null;
  saveMsg = '';

  constructor(root: HTMLElement) {
    this.root = root;
    const l = store.load(); this.p = l.p;
    this.lastW = window.innerWidth; this.lastH = window.innerHeight;
    this.applySettings();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => { this.autoPause(); setTimeout(() => this.layout(), 250); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.autoPause(); this.persist(); } });
    window.addEventListener('blur', () => this.autoPause());
    window.addEventListener('pagehide', () => { this.autoPause(); this.persist(); });
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    // browser gestures must never eat game input (menus scroll; text fields keep selection)
    const inField = (e: Event) => !!(e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable]');
    document.addEventListener('contextmenu', e => { if (!inField(e)) e.preventDefault(); });
    document.addEventListener('selectstart', e => { if (!inField(e)) e.preventDefault(); });
    document.addEventListener('gesturestart', e => e.preventDefault());
    // WebAudio may only start from a gesture: Chrome counts pointerup/touchend for touch, iOS touchend
    const unlock = () => {
      if (!this.audio.ctx) this.graceUntil = Math.max(this.graceUntil, performance.now() + 1000);   // the first gesture builds the audio graph
      this.audio.unlock();
    };
    for (const t of ['pointerdown', 'pointerup', 'touchend', 'keydown']) document.addEventListener(t, unlock, { capture: true, passive: true });
    this.input.onPress = () => { unlock(); document.getElementById('title-ov')?.classList.add('gone'); };
    this.input.onChange = () => this.padsLit();
    try { const as = (navigator as any).audioSession; if (as) as.type = 'ambient'; } catch { /* ignore */ }
    if (!this.p.tutorialDone) this.startTutorial(); else this.showHome();
    if (l.error) this.toast(l.error, 'warn', 5);
  }

  // ------------------------------------------------------------------ persistence & settings
  persist(): void {
    const r = store.save(this.p);
    const msg = r.ok ? (r.error ?? '') : (r.error ?? '저장하지 못했어요');
    if ((!r.ok || r.error) && msg !== this.saveMsg) this.toast(msg, 'warn', 4);
    this.saveMsg = msg;
  }
  applySettings(): void {
    const st = this.p.settings;
    this.audio.setVolumes(st.sfx, st.musicOff ? 0 : st.bgm);
    if (this.renderer) this.renderer.opts = { reduceMotion: st.reduceMotion, highContrast: st.highContrast, lowFx: st.lowFx, showHitbox: st.showHitbox, shake: st.reduceMotion ? 0 : (st.shake ?? 1), uiScale: st.uiScale || 1 };
    this.input.slideToggle = !!st.slideToggle;
    const de = document.documentElement;
    de.classList.toggle('reduce-motion', st.reduceMotion);
    de.style.setProperty('--ui', String(st.uiScale || 1));
    if (this.run && this.renderer) this.layout();
  }

  // ------------------------------------------------------------------ generic UI bits
  toast(text: string, kind: 'info' | 'good' | 'warn' = 'info', sec = 2.5): void {
    let box = document.getElementById('toasts'); if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
    // during a run toasts stay off the play band: landscape → over the ground at the bottom, portrait → under the HUD band
    box.classList.toggle('in-run', this.screen === 'run' && !!this.run);
    box.classList.toggle('port', this.isPortrait());
    const el = h('div', { class: 'toast ' + kind, role: 'status' }, text); box.append(el);
    setTimeout(() => el.classList.add('out'), sec * 1000); setTimeout(() => el.remove(), sec * 1000 + 400);
  }
  nav(screen: Screen): void {
    this.teardownRun();
    this.screen = screen; this.input.reset(); this.input.enabled = false;
    this.closeModal(); clear(this.root);
    this.duck(false);
    if (screen !== 'run') this.music('menu');
  }
  topbar(title: string, back: () => void = () => this.showHome()): HTMLElement {
    return h('header', { class: 'topbar' },
      h('button', { class: 'back', 'aria-label': '뒤로', onclick: () => { this.audio.play('click'); back(); } }, '←'),
      h('h2', {}, title),
      h('div', { class: 'wallet' }, h('span', { class: 'coin' }, '엽전'), ` ${fmtNum(this.p.coins)}`),
    );
  }
  click(fn: () => void): () => void { return () => { this.audio.unlock(); this.audio.play('click'); fn(); }; }

  // ------------------------------------------------------------------ menu screens (src/ui/screens.ts)
  showHome(): void { screens.showHome(this); }
  showChars(): void { screens.showChars(this); }
  showAdventure(): void { screens.showAdventure(this); }
  showDaily(): void { screens.showDaily(this); }
  showMissions(): void { screens.showMissions(this); }
  showSettings(): void { screens.showSettings(this); }

  // ------------------------------------------------------------------ modal helpers
  modal(content: HTMLElement, dismissable = true): void {
    this.closeModal();
    const m = h('div', { id: 'modal', onclick: (e: Event) => { if (dismissable && e.target === m) this.closeModal(); } }, content);
    document.body.append(m);
  }
  closeModal(): void { document.getElementById('modal')?.remove(); }
  confirm(text: string, yes: () => void): void {
    this.modal(h('div', { class: 'sheet' }, h('p', {}, text),
      h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: this.click(() => this.closeModal()) }, '취소'), h('button', { class: 'danger', onclick: this.click(() => { this.closeModal(); yes(); }) }, '확인'))));
  }

  assistOpts() { const st = this.p.settings; return { noHitDamage: st.assistNoHit, halfDrain: st.assistHalfDrain, autoSlide: st.assistAutoSlide }; }

  // ------------------------------------------------------------------ run entry points
  startEndless(o: StartOpts = {}): void {
    const p = this.p;
    this.startRun({ mode: 'endless', seed: (Math.random() * 2 ** 32) >>> 0, charId: p.loadout.main, partnerId: featureOpen(p, 'relay') ? p.loadout.partner : null, companionId: p.loadout.companion, assist: this.assistOpts(), noCountdown: !!o.noCountdown });
  }
  /** 골목 지도 stage with the current loadout (no relay in stages). */
  startStage(id: string, o: StartOpts = {}): void {
    const st = STAGE_BY_ID[id]; if (!st) { this.showHome(); return; }
    const p = this.p;
    this.startRun({ mode: 'stage', seed: st.seed, charId: p.loadout.main, companionId: p.loadout.companion, stageId: id, assist: this.assistOpts(), noCountdown: !!o.noCountdown });
  }
  /** 오늘의 골목 (or one of the last 7 days): the day's runner + companion are lent even while locked. */
  startDaily(dateKey = todayKey(), o: StartOpts = {}): void {
    this.startRun({ mode: 'daily', seed: dailySeed(dateKey), charId: dailyChar(dateKey), companionId: dailyCompanion(dateKey), assist: this.assistOpts(), noCountdown: !!o.noCountdown }, { dateKey });
  }
  /** 첫 달리기: boots straight into the run under the title overlay; the first tap jumps. */
  startTutorial(): void {
    this.startRun({ mode: 'tutorial', seed: 1, charId: this.p.loadout.main, companionId: null, noCountdown: true });
  }
  /** 시험 달리기 (60 s, no records). */
  startTrial(charId: string, o: StartOpts = {}): void {
    this.startRun({ mode: 'endless', seed: (Math.random() * 2 ** 32) >>> 0, charId, companionId: this.p.loadout.companion, trial: true, noCountdown: !!o.noCountdown });
  }

  startRun(cfg: RunConfig, o: { dateKey?: string } = {}): void {
    this.nav('run');                 // (audio is unlocked by the gesture that started the run — never at boot)
    // a daily started through startRun(cfg) (e.g. from the 7-day archive) books into the day its seed belongs to
    const dateKey = o.dateKey ?? (cfg.mode === 'daily' ? dailyArchive().find(k => dailySeed(k) === (cfg.seed >>> 0)) : undefined) ?? todayKey();
    const s = newRun(cfg);
    // ghost of the best run on this exact course (stages, dailies)
    let ghost: RunState | null = null; let log: number[] = [];
    const gkey = cfg.trial ? null : cfg.mode === 'stage' || cfg.mode === 'daily' ? ghostKeyFor(cfg.mode, cfg.stageId ?? null, dateKey) : null;
    const g: GhostRec | null = gkey ? store.loadGhost<GhostRec>(gkey) : null;
    if (g && this.p.settings.ghost && g.seed === s.seed && g.content === CONTENT_HASH && Array.isArray(g.log)) {
      try { ghost = newRun({ mode: g.mode as Mode, seed: g.seed, charId: g.charId, partnerId: g.partnerId, companionId: g.companionId, stageId: g.stageId, assist: g.assistOpts, noCountdown: cfg.noCountdown }); log = g.log; } catch { ghost = null; }
    }
    this.run = {
      s, cfg, dateKey, ghost, ghostLog: log, ghostIdx: 0, ghostBits: 0,
      acc: 0, lastT: 0, frames: 0, prevX: s.body.x, prevY: s.body.y,
      paused: false, ended: false, reward: null, resumeT: 0, slow: null, slideTaught: false,
      warned50: false, lowT: 0, missionT: 1, toasted: new Set(), results: null, timers: [], unbind: null,
    };
    this.buildRunDom(this.run);
    this.input.reset(); this.input.enabled = true;
    this.graceUntil = performance.now() + 1000;
    this.biomeMusic(s.biome);
    // portrait is a first-class layout (no "please rotate" wall) — one gentle, one-time tip
    if (this.isPortrait() && s.mode !== 'tutorial' && Array.isArray(this.p.seen) && !this.p.seen.includes('rotate-tip')) {
      this.p.seen.push('rotate-tip'); this.toast('가로로 돌리면 화면이 더 커져요', 'info', 3.5);
    }
    if (s.phase === 'countdown') this.audio.play('count');
    this.startLoop();
  }

  private buildRunDom(rc: RunCtx): void {
    const st = this.p.settings; const swap = st.swapSides; const s = rc.s;
    const pad = (zone: Exclude<Zone, null>) => h('div', { class: `pad ${zone}`, 'data-zone': zone },
      h('div', { class: 'pad-in' }, h('span', { class: 'ic' }, zone === 'jump' ? '▲' : '▼'), h('b', {}, zone === 'jump' ? '점프' : '슬라이드'), h('small', {}, zone === 'jump' ? '탭 · 공중에서 한 번 더' : '누르고 있기')));
    const pauseBtn = h('button', { id: 'btn-pause', type: 'button', 'aria-label': '일시정지', onclick: () => { this.audio.play('click'); this.setPaused(true); } }, h('i'), h('i'));
    const stage = h('div', { id: 'stage' }, h('canvas', { id: 'cv' }), pauseBtn);
    const showHints = st.showPads || this.p.totals.runs < 3 || s.mode === 'tutorial';
    const hints = h('div', { id: 'lhints', class: (swap ? 'swap' : '') + (showHints ? ' show' : '') },
      h('div', { class: 'lh jump' }, h('span', {}, '▲'), h('b', {}, '점프')), h('div', { class: 'lh slide' }, h('span', {}, '▼'), h('b', {}, '슬라이드')));
    const pads = h('div', { id: 'pads', class: swap ? 'swap' : '' }, pad('jump'), pad('slide'));
    const runEl = h('div', { id: 'run', class: 'screen run' }, stage, hints, pads);
    if (s.mode === 'tutorial') {
      runEl.append(
        h('div', { id: 'title-ov', 'aria-hidden': 'true' }, h('h1', {}, '야식 대질주'), h('p', { class: 't-sub' }, '보름달까지 달려라!'), h('p', { class: 't-how' }, this.isPortrait() ? '점프 버튼을 누르면 점프!' : '화면을 누르면 점프!')),
        h('button', { id: 'btn-skip', type: 'button', onclick: () => { this.audio.play('click'); this.skipTutorial(); } }, '건너뛰기'),
      );
    }
    this.root.append(runEl);
    this.renderer = new Renderer(document.getElementById('cv') as HTMLCanvasElement);
    const r = this.renderer;
    const p = this.p;
    r.hud = {
      pbDist: s.trial ? 0 : s.mode === 'endless' ? (p.bestEndless?.dist ?? 0) : s.mode === 'daily' ? (p.daily[rc.dateKey]?.dist ?? 0) : 0,
      stageGoalPct: s.stageId ? STAGE_BY_ID[s.stageId]?.stars.jellyPct ?? 0 : 0,
      pouchesBefore: s.stageId ? p.pouches[s.stageId] ?? 0 : 0,
      pauseW: 52,
    };
    r.hats = {};
    for (const [cid, eq] of Object.entries(p.cosmetics?.equipped ?? {})) { const hat = (eq?.hat ?? '').replace(/^hat_/, '') as HatId; if (HAT_IDS.includes(hat)) r.hats[cid] = hat; }
    this.applySettings();
    rc.unbind = bindSurface(runEl, this.input, {
      zoneAt: e => this.zoneAt(e),
      gesture: () => this.audio.unlock(),
    });
    this.layout();
  }

  /** zone of a new pointer: portrait pads by element, otherwise screen halves (letterbox included). */
  private zoneAt(e: PointerEvent): Zone {
    const rc = this.run; if (!rc || rc.paused || rc.ended) return null;
    const t = e.target as HTMLElement;
    if (t.closest?.('#results, #modal, #cheer')) return null;
    const pad = t.closest?.('.pad') as HTMLElement | null;
    if (pad) return (pad.dataset.zone as Zone) ?? null;
    if (rc.s.mode === 'tutorial' && !rc.slideTaught && !this.isPortrait()) return 'jump';   // 「화면을 누르면 점프!」
    const left = e.clientX < window.innerWidth / 2;
    return left !== this.p.settings.swapSides ? 'jump' : 'slide';
  }
  private padsLit(): void {
    const j = this.input.jumpHeld, sl = this.input.slideHeld;
    document.querySelectorAll('.pad.jump,.lh.jump').forEach(el => el.classList.toggle('on', j));
    document.querySelectorAll('.pad.slide,.lh.slide').forEach(el => el.classList.toggle('on', sl));
  }

  isPortrait(): boolean { return window.innerHeight > window.innerWidth * 1.05; }
  private safeInsets(): { l: number; r: number; t: number; b: number } {
    if (!this.probe) {
      this.probe = h('div', { style: 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)' });
      document.body.append(this.probe);
    }
    const cs = getComputedStyle(this.probe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }

  layout(): void {
    const runEl = document.getElementById('run'); const stage = document.getElementById('stage');
    const r = this.renderer; if (!runEl || !stage || !r) return;
    const portrait = this.isPortrait();
    runEl.classList.toggle('portrait', portrait); runEl.classList.toggle('landscape', !portrait);
    const st = this.p.settings; const ui = st.uiScale || 1; const ins = this.safeInsets();
    let bandH = 0;
    if (portrait) {
      const W = runEl.clientWidth || window.innerWidth;
      const worldH = Math.round(W * VIEW_H / VIEW_W);
      bandH = Math.round((window.innerHeight < 700 ? 62 : 68) * ui);
      stage.style.height = worldH + bandH + 'px';
      runEl.style.setProperty('--bandH', bandH + 'px');
      runEl.style.setProperty('--worldH', worldH + 'px');
      document.documentElement.style.setProperty('--toastTop', worldH + bandH + 10 + 'px');
    } else { stage.style.height = ''; runEl.style.removeProperty('--bandH'); runEl.style.removeProperty('--worldH'); }
    const rect = stage.getBoundingClientRect();
    if (rect.width > 10 && rect.height > 10) r.resize(rect.width, rect.height, { dprCap: st.fps30 ? 1.5 : 2, bandH, insets: portrait ? { l: ins.l, r: ins.r, t: 0, b: 0 } : ins });
    r.hud.pauseW = 52;
    // landscape thumb hints sit in the letterbox when there is one
    const lb = r.offL * r.scale;
    runEl.style.setProperty('--lb', Math.max(0, lb) + 'px');
    const res = document.getElementById('results');
    if (res) { res.classList.toggle('portrait', portrait); res.classList.toggle('landscape', !portrait); }
    const rc = this.run;
    if (rc && (rc.paused || rc.ended || !this.loopOn)) this.redraw();
  }

  private onResize(): void {
    const w = window.innerWidth, hh = window.innerHeight;
    const big = Math.abs(w - this.lastW) > 40 || Math.abs(hh - this.lastH) > 80 || (w > hh) !== (this.lastW > this.lastH);
    this.lastW = w; this.lastH = hh;
    if (big) this.autoPause();
    this.layout();
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (this.screen !== 'run' || !this.run) return;          // the results screen handles its own keys
    const rc = this.run;
    if (down && (e.code === 'Escape' || e.code === 'KeyP')) {
      e.preventDefault(); if (rc.ended || e.repeat) return;
      if (rc.paused) { if (document.querySelector('#modal .pause')) { this.closeModal(); this.resume(); } }
      else this.setPaused(true);
      return;
    }
    if (down && e.code === 'KeyH' && import.meta.env.DEV) { this.p.settings.showHitbox = !this.p.settings.showHitbox; this.applySettings(); return; }
    if (rc.ended || rc.paused) return;
    if (!keyZone(e.code)) return;
    e.preventDefault();
    if (down) this.input.keyDown(e.code, e.repeat, evTime(e)); else this.input.keyUp(e.code);
  }

  // ------------------------------------------------------------------ pause / resume
  autoPause(): void { const rc = this.run; if (rc && !rc.paused && !rc.ended && rc.s.phase !== 'over' && rc.s.phase !== 'clear') this.setPaused(true); }

  setPaused(p: boolean): void {
    const rc = this.run; if (!rc || rc.ended) return;
    if (!p) { this.closeModal(); this.resume(); return; }
    if (rc.paused) return;
    rc.paused = true; rc.resumeT = 0;
    this.input.reset(); this.input.enabled = false; this.padsLit();
    this.audio.suspend();
    this.stopLoop();
    this.redraw();
    this.pauseSheet(rc);
  }

  private pauseSheet(rc: RunCtx): void {
    const st = this.p.settings; const s = rc.s; const tut = s.mode === 'tutorial';
    const save = () => { this.applySettings(); this.persist(); };
    const qset = (label: string, on: boolean, set: (v: boolean) => void) => h('label', { class: 'qset' }, h('span', {}, label),
      h('input', { type: 'checkbox', checked: on, onchange: (e: Event) => { set((e.target as HTMLInputElement).checked); save(); } }));
    this.modal(h('div', { class: 'sheet pause', role: 'dialog', 'aria-label': '일시정지' },
      h('h3', {}, '잠깐 쉬어요'),
      h('p', { class: 'muted' }, tut ? '첫 달리기' : `${fmtNum(totalScore(s))}점 · ${fmtNum(Math.floor(s.dist))}m`),
      h('button', { class: 'primary big', id: 'btn-resume', type: 'button', onclick: this.click(() => { this.closeModal(); this.resume(); }) }, '계속'),
      h('div', { class: 'row' },
        h('button', { id: 'btn-restart', type: 'button', onclick: this.click(() => { this.closeModal(); this.restart(rc); }) }, '처음부터'),
        tut
          ? h('button', { class: 'ghost', id: 'btn-quit', type: 'button', onclick: this.click(() => { this.closeModal(); this.skipTutorial(); }) }, '건너뛰기')
          : h('button', { class: 'ghost', id: 'btn-quit', type: 'button', onclick: this.click(() => { this.closeModal(); this.showHome(); }) }, '그만하기')),
      tut ? null : h('p', { class: 'pause-note' }, '여기까지 할까요? 기록은 저장돼요', h('small', {}, '그만하면 이번 판만 세지 않아요')),
      h('div', { class: 'qsets' },
        qset('음악', !st.musicOff && st.bgm > 0, v => { st.musicOff = !v; if (v && st.bgm <= 0) st.bgm = 0.5; }),
        qset('효과음', st.sfx > 0, v => { st.sfx = v ? (st.sfx > 0 ? st.sfx : 0.8) : 0; }),
        qset('흔들림', (st.shake ?? 1) > 0 && !st.reduceMotion, v => { st.shake = v ? 1 : 0; if (v) st.reduceMotion = false; })),
    ), false);
    setTimeout(() => (document.getElementById('btn-resume') as HTMLButtonElement | null)?.focus?.({ preventScroll: true } as FocusOptions), 0);
  }

  private resume(): void {
    const rc = this.run; if (!rc || !rc.paused || rc.ended) return;
    rc.paused = false;
    this.audio.resume();
    this.input.reset(); this.input.enabled = true;
    rc.resumeT = rc.s.phase === 'run' || rc.s.phase === 'countdown' || rc.s.phase === 'dying' ? RESUME_COUNT_T : 0;
    if (rc.resumeT > 0) this.audio.play('count');
    rc.lastT = 0; rc.acc = 0;
    this.startLoop();
  }

  private restart(rc: RunCtx): void {
    const cfg = { ...rc.cfg, noCountdown: true };
    if (cfg.mode === 'endless') cfg.seed = (Math.random() * 2 ** 32) >>> 0;
    this.startRun(cfg, { dateKey: rc.dateKey });
  }

  // ------------------------------------------------------------------ loop
  private startLoop(): void {
    cancelAnimationFrame(this.raf); this.loopOn = true;
    const f = (t: number) => { if (!this.loopOn) return; this.frame(t); if (this.loopOn) this.raf = requestAnimationFrame(f); };
    this.raf = requestAnimationFrame(f);
  }
  private stopLoop(): void { this.loopOn = false; cancelAnimationFrame(this.raf); this.raf = 0; }

  frame(now: number): void {
    const rc = this.run; const r = this.renderer; if (!rc || !r) { this.stopLoop(); return; }
    const st = this.p.settings;
    const minGap = st.fps30 ? 1000 / 30 - 4 : 1000 / 60 - 4;      // 120 Hz → 60 fps, 배터리 절약 → 30 fps
    if (rc.lastT && now - rc.lastT < minGap) return;
    let real = rc.lastT ? (now - rc.lastT) / 1000 : 0; rc.lastT = now; rc.frames++;
    const s = rc.s;
    // a hitch (> 250 ms) pauses a live run so it can never cost a hit; the tutorial has nothing to lose, so it just drops the time
    if (real * 1000 > this.stallMs && rc.frames > 3 && now > this.graceUntil && s.mode !== 'tutorial' && !rc.ended && (s.phase === 'run' || s.phase === 'countdown')) { this.setPaused(true); return; }
    real = Math.min(real, 0.25);

    // post-pause 3-2-1 (the sim is simply not stepped)
    if (rc.resumeT > 0) {
      const before = Math.ceil(rc.resumeT / 0.5);
      rc.resumeT = Math.max(0, rc.resumeT - real);
      const after = Math.ceil(rc.resumeT / 0.5);
      if (after !== before) this.audio.play(after > 0 ? 'count' : 'go');
    }
    r.resumeCount = rc.resumeT;

    // tutorial rewind: 40 % speed until the runner is past the hazard that stopped it
    let speed = Math.max(0.6, Math.min(1, st.gameSpeed || 1));
    if (speed < 1 && s.phase === 'run') s.assist = true;   // a slowed run is an assisted record (marked, never punished); the sim never reads it
    if (rc.slow) {
      rc.slow.t += real;
      if ((rc.slow.t >= TUTORIAL_SLOW_MIN && s.body.x > rc.slow.untilX) || rc.slow.t >= TUTORIAL_SLOW_MAX) this.endSlow(rc);
      else speed *= TUTORIAL_SLOW;
    }
    if (s.mode === 'tutorial' && !rc.slideTaught && s.level.chunks.some(c => c.id === 'tut_3_slide' && c.x < s.body.x + 700)) rc.slideTaught = true;

    if (!rc.paused && rc.resumeT <= 0 && !rc.ended) {
      rc.acc += real * speed;
      let n = 0;
      while (rc.acc >= DT && n < MAX_CATCHUP_STEPS) {
        const stepT = now - ((rc.acc - DT) / speed) * 1000;     // real time this step stands for
        rc.prevX = s.body.x; rc.prevY = s.body.y;
        const cd = s.phase === 'countdown' ? Math.ceil(s.countdown / 0.5) : -1;
        stepRun(s, this.input.take(stepT));
        if (s.phase === 'countdown') { const c2 = Math.ceil(s.countdown / 0.5); if (c2 !== cd) this.audio.play('count'); }
        else if (cd > 0) this.audio.play('go');
        if (rc.ghost) this.stepGhost(rc);
        rc.acc -= DT; n++;
      }
      if (rc.acc >= DT) rc.acc = 0;                               // drop the rest: no catch-up burst
    }
    if (s.events.length) { r.consume(s.events, s); this.onEvents(s.events, s, rc); s.events.length = 0; }
    this.watchRun(rc, real);

    this.draw(rc, real);
    this.frames++; this.fpsT += real; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    if ((s.phase === 'over' || s.phase === 'clear') && !rc.ended) this.endRun(rc);
  }

  private draw(rc: RunCtx, real: number): void {
    const r = this.renderer; if (!r) return; const s = rc.s;
    const a = rc.paused || rc.resumeT > 0 ? 1 : Math.min(1, rc.acc / DT);
    const tele = Math.abs(s.body.x - rc.prevX) > 100 || Math.abs(s.body.y - rc.prevY) > 120;
    const ix = tele ? s.body.x : rc.prevX + (s.body.x - rc.prevX) * a;
    const iy = tele ? s.body.y : rc.prevY + (s.body.y - rc.prevY) * a;
    let gv: GhostView | null = null;
    const g = rc.ghost;
    if (g && g.phase !== 'over' && g.phase !== 'dying' && s.bonusStage === 'none' && g.bonusStage === 'none') gv = { x: g.body.x, y: g.body.y, sliding: g.body.sliding, onGround: g.body.onGround, charId: g.charId, scale: g.body.scale };
    r.draw(s, ix, iy, real, gv);
  }
  /** one frame without advancing anything (pause / resize / results) */
  private redraw(): void { const rc = this.run; if (rc && this.renderer) this.draw(rc, 0); }

  private stepGhost(rc: RunCtx): void {
    const g = rc.ghost!; const log = rc.ghostLog; const i = g.steps;
    let jump = false;
    while (rc.ghostIdx < log.length && log[rc.ghostIdx] === i) { rc.ghostBits = log[rc.ghostIdx + 1]; jump = (rc.ghostBits & 1) === 1; rc.ghostIdx += 2; }
    stepRun(g, { jump, slide: (rc.ghostBits & 2) === 2, jumpHeld: (rc.ghostBits & 4) === 4 });
    g.events.length = 0;
  }

  /** per-frame run checks: low-warmth cues, live mission ticks */
  private watchRun(rc: RunCtx, real: number): void {
    const s = rc.s; if (s.phase !== 'run' || rc.paused) return;
    const pct = s.hp / s.maxHp;
    if (s.bonusStage === 'none' && s.mode !== 'tutorial') {
      if (!rc.warned50 && pct < 0.5 && this.p.totals.runs < 6) { rc.warned50 = true; this.toast('계속 식어요 — 꿀물로 데워요', 'info', 2); }
      if (pct < LOW_HP_FRAC) { rc.lowT -= real; if (rc.lowT <= 0) { rc.lowT = 2.5; this.audio.play('lowhp'); } } else rc.lowT = 0;
    }
    rc.missionT -= real;
    if (rc.missionT <= 0 && !s.trial && s.mode !== 'tutorial') {
      rc.missionT = 0.5;
      for (const m of this.p.missions) {
        if (rc.toasted.has(m.id)) continue;
        const t = MISSION_BY_ID[m.id]; if (!t) continue;
        try {
          if (t.when && !t.when(s)) continue;
          const v = t.measure(s); const prog = t.scope === 'run' ? Math.max(m.progress, v) : m.progress + v;
          if (prog >= m.target) { rc.toasted.add(m.id); this.toast(`미션 완료! ${missionText(m)}`, 'good', 1.5); }
        } catch { rc.toasted.add(m.id); }
      }
    }
  }

  private onEvents(evs: SimEvent[], s: RunState, rc: RunCtx): void {
    const a = this.audio;
    for (const e of evs) {
      switch (e.t) {
        case 'jump': a.play(e.n === 2 ? 'jump2' : 'jump'); break;
        case 'land': a.play('land'); break;
        case 'slide': a.play('slide'); break;
        case 'fastFall': a.play('fastfall'); break;
        case 'pickup':
          switch (e.type) {
            case 'jelly': case 'bonusJelly': a.play('jelly'); break;
            case 'big': a.play('big'); break;
            case 'coin': a.play('coin'); break;
            case 'letter': a.play('letter', e.letter ?? 0); break;
            case 'potion': case 'bigPotion': a.play('potion'); break;
            case 'miniPotion': a.play('miniPotion'); break;
            case 'moonCake': a.play('moonCake'); break;
            case 'pouch': a.play('pouch', e.pouch ?? 0); break;
            case 'power': break;                       // the 'power' event plays it
          }
          break;
        case 'line': a.play('line'); break;
        case 'hit': a.play(e.shielded ? 'shield' : 'hit'); if (!e.shielded && this.p.settings.vibrate) try { navigator.vibrate?.(40); } catch { /* ignore */ } break;
        case 'smash': a.play('smash'); break;
        case 'power': a.play('power'); break;
        case 'powerEnd': a.play('powerEnd'); break;
        case 'bonusStart': a.play('bonus'); this.music('bonus'); break;
        case 'bonusEnd': a.play('bonusEnd'); this.biomeMusic(s.biome); break;
        case 'fall': a.play('fall'); break;
        case 'speedUpSoon': a.play('speed'); break;
        case 'biome': if (s.bonusStage === 'none') this.biomeMusic(e.id); break;
        case 'skill': a.play('skill'); break;
        case 'lowHp': a.play('lowhp'); rc.lowT = 2.5; break;
        case 'revive': a.play('revive'); break;
        case 'relay': a.play('relay'); break;
        case 'nearMiss': a.play('near'); break;
        case 'streak': a.play('streak'); break;
        case 'death': a.play('death'); break;
        case 'clear': a.play('clear'); break;
        case 'rewind': if (s.mode === 'tutorial') this.tutorialHint(rc, e.kind); break;
      }
    }
  }

  // ------------------------------------------------------------------ tutorial
  private tutorialHint(rc: RunCtx, kind: string): void {
    const s = rc.s; const bx = s.body.x;
    let untilX = bx + 520; let key = kind;
    if (kind === 'pit') {
      const gs = s.level.solids.filter(o => o.ground).sort((p, q) => p.x0 - q.x0);
      for (let i = 1; i < gs.length; i++) if (gs[i].x0 - gs[i - 1].x1 > 1 && gs[i].x0 > bx) { untilX = gs[i].x0 + 40; break; }
    } else {
      const hz = s.level.hazards.find(z => z.kind === kind && z.x0 > bx);
      if (hz) { untilX = hz.x1 + 30; if (kind === 'hang' && hz.y1 < GROUND_Y - 60) key = 'low'; }
    }
    rc.slow = { t: 0, untilX };
    const v = HINT_VERB[key] ?? HINT_VERB.spike;
    if (this.renderer) this.renderer.hint = { text: v.text, sub: v.sub, zone: v.zone, t: 0 };
    document.querySelectorAll('.pad.flash,.lh.flash').forEach(el => el.classList.remove('flash'));
    if (v.zone) document.querySelectorAll(`.pad.${v.zone},.lh.${v.zone}`).forEach(el => el.classList.add('flash'));
    document.getElementById('lhints')?.classList.add('show');
  }
  private endSlow(rc: RunCtx): void {
    rc.slow = null; if (this.renderer) this.renderer.hint = null;
    document.querySelectorAll('.pad.flash,.lh.flash').forEach(el => el.classList.remove('flash'));
  }
  skipTutorial(): void {
    const rc = this.run;
    this.p.tutorialDone = true; this.persist();
    if (rc) { rc.ended = true; this.input.reset(); this.input.enabled = false; }
    this.cheer(true);
  }
  /** tiny 「잘했어요!」 card, then stage 1-1 right away */
  private cheer(skipped: boolean): void {
    const rc = this.run; const first = STAGES[0]?.id ?? '1-1'; const st = STAGE_BY_ID[first];
    document.getElementById('btn-skip')?.remove(); document.getElementById('title-ov')?.remove();
    const host = document.getElementById('run') ?? this.root;
    host.append(h('div', { id: 'cheer' }, h('b', {}, skipped ? '좋아요!' : '잘했어요!'), h('small', {}, `이제 ${first} 「${st?.name ?? '첫걸음'}」 달려요`)));
    this.audio.play(skipped ? 'click' : 'reward');
    const go = () => { if (this.run === rc) this.startStage(first, { noCountdown: true }); };
    const t = window.setTimeout(go, skipped ? 700 : 1100);
    if (rc) rc.timers.push(t);
  }

  // ------------------------------------------------------------------ end of a run → results
  private endRun(rc: RunCtx): void {
    rc.ended = true; this.input.reset(); this.input.enabled = false; this.padsLit();
    const s = rc.s;
    if (s.mode === 'tutorial') { applyRun(this.p, s, rc.dateKey); this.persist(); this.cheer(false); return; }
    rc.reward = applyRun(this.p, s, rc.dateKey);
    if (rc.reward.ghost && rc.reward.ghostKey) { store.saveGhost(rc.reward.ghostKey, rc.reward.ghost); store.pruneDailyGhosts(7); }
    this.persist();
    if (!this.persistAsked) { this.persistAsked = true; try { (navigator as any).storage?.persist?.().catch?.(() => {}); } catch { /* ignore */ } }
    if (s.phase === 'clear') rc.timers.push(window.setTimeout(() => { if (this.run === rc) this.showResults(rc); }, 550));
    else this.showResults(rc);
  }

  private showResults(rc: RunCtx): void {
    const s = rc.s; const rw = rc.reward!;
    const runEl = document.getElementById('run'); if (!runEl) return;
    this.screen = 'results';
    this.duck(true);
    this.closeModal();
    const next = s.stageId && s.phase === 'clear' && !s.trial ? nextStageAfter(this.p, s.stageId) : null;
    rc.results = mountResults(runEl, {
      s, rw, cfg: rc.cfg, p: this.p, dateKey: rc.dateKey,
      portrait: this.isPortrait(), swap: this.p.settings.swapSides, next,
      onRetry: () => this.retry(rc),
      onHome: () => this.showHome(),
      onNext: next ? () => this.startStage(next) : null,
      play: (n, arg) => this.audio.play(n, arg ?? 0),
    });
    this.redraw();
    this.stopLoop();
  }

  /** instant retry: a new run with no countdown (death → control ≤ 2.5 s including the 0.8 s KO) */
  retry(rc: RunCtx | null = this.run): void {
    if (!rc) return;
    const cfg = rc.cfg;
    if (cfg.trial) this.startTrial(cfg.charId, { noCountdown: true });
    else if (cfg.mode === 'endless') this.startEndless({ noCountdown: true });
    else if (cfg.mode === 'daily') this.startDaily(rc.dateKey, { noCountdown: true });
    else if (cfg.mode === 'stage' && cfg.stageId) this.startStage(cfg.stageId, { noCountdown: true });
    else this.startRun({ ...cfg, noCountdown: true }, { dateKey: rc.dateKey });
  }

  private teardownRun(): void {
    this.stopLoop();
    const rc = this.run;
    if (rc) { rc.results?.dispose(); rc.unbind?.(); for (const t of rc.timers) clearTimeout(t); rc.timers.length = 0; }
    this.run = null; this.renderer = null;
  }

  // ------------------------------------------------------------------ audio routing
  private music(m: 'menu' | 'bonus' | null | { bpm: number; key: number; style: string }): void {
    try { (this.audio.setMusic as (x: unknown) => void).call(this.audio, m); } catch { /* ignore */ }
  }
  private biomeMusic(id: string): void { const bi = BIOME_BY_ID[id]; if (bi) this.music({ bpm: bi.bpm, key: bi.key, style: bi.style }); }
  private duck(on: boolean): void { try { (this.audio as unknown as { duck?: (b: boolean) => void }).duck?.(on); } catch { /* ignore */ } }
}
