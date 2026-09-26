// App shell: screens, main loop (fixed step + interpolation), input wiring, audio routing, saving.
import { DT, VIEW_H } from '../data/physics';
import { BONUS_WORD, LOW_HP_FRAC } from '../data/tuning';
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { STAGES } from '../data/stages';
import { BIOME_BY_ID } from '../data/biomes';
import { newRun, stepRun, totalScore, jellyPct, type RunConfig } from '../sim/run';
import type { RunState, SimEvent, Mode } from '../sim/types';
import { Renderer, type GhostView } from '../render/renderer';
import { Audio } from '../platform/audio';
import * as store from '../platform/storage';
import { applyRun, stageStarCount, defaultProgress, dailySeed, dailyChar, todayKey, stageUnlocked, totalStars, unlockState, buyCharacter, canReroll, reroll, type Progress, type RunReward, type GhostRec } from '../meta/progress';
import { missionText, MISSION_REWARD, RANK_XP } from '../meta/missions';
import { InputState, keyZone, type Zone } from './input';
import { CONTENT_HASH } from '../sim/content';
import { h, clear } from './dom';
import { charCard, charPortrait, fmtNum, deathExplain, nearMissHints, hitName } from './panels';
import * as screens from './screens';

const MAX_STEPS = 5;
export const VERSION = '0.1.0-beta.1';

export type Screen = 'home' | 'chars' | 'adventure' | 'daily' | 'missions' | 'settings' | 'run' | 'results';

interface RunCtx {
  s: RunState; cfg: RunConfig;
  ghost: RunState | null; ghostLog: number[]; ghostIdx: number; ghostBits: number;
  acc: number; lastT: number; prevX: number; prevY: number;
  paused: boolean; ended: boolean; endT: number; reward: RunReward | null; lastCount: number; resumeT: number;
}

export class App {
  root: HTMLElement;
  p: Progress;
  audio = new Audio();
  input = new InputState();
  renderer: Renderer | null = null;
  run: RunCtx | null = null;
  screen: Screen = 'home';
  fps = 0; private frames = 0; private fpsT = 0; private frameSkip = 0;
  private raf = 0;
  private resultsReadyAt = 0;
  saveMsg = '';

  constructor(root: HTMLElement) {
    this.root = root;
    const l = store.load(); this.p = l.p;
    this.applySettings();
    this.showHome();
    if (l.error) this.toast(l.error, 'warn', 5);
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    window.addEventListener('blur', () => this.autoPause());
    window.addEventListener('pagehide', () => this.persist());
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    // browser gestures must never eat game input
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', stop);
    document.addEventListener('selectstart', e => { if (!(e.target as HTMLElement)?.closest?.('input,textarea')) e.preventDefault(); });
    document.addEventListener('gesturestart', stop as EventListener);
    this.input.onPress = () => this.audio.unlock();
    try { const as = (navigator as any).audioSession; if (as) as.type = 'ambient'; } catch { /* ignore */ }
    try { (navigator as any).storage?.persist?.(); } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------ persistence & settings
  persist(): void {
    const r = store.save(this.p);
    this.saveMsg = r.ok ? (r.error ?? '') : (r.error ?? '저장 실패');
    if (!r.ok || r.error) this.toast(this.saveMsg, 'warn', 4);
  }
  applySettings(): void {
    const st = this.p.settings;
    this.audio.setVolumes(st.sfx, st.bgm);
    if (this.renderer) this.renderer.opts = { reduceMotion: st.reduceMotion, highContrast: st.highContrast, lowFx: st.lowFx, showHitbox: st.showHitbox };
    document.documentElement.classList.toggle('reduce-motion', st.reduceMotion);
  }

  // ------------------------------------------------------------------ generic UI bits
  toast(text: string, kind: 'info' | 'good' | 'warn' = 'info', sec = 2.5): void {
    let box = document.getElementById('toasts'); if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
    const el = h('div', { class: 'toast ' + kind }, text); box.append(el);
    setTimeout(() => el.classList.add('out'), sec * 1000); setTimeout(() => el.remove(), sec * 1000 + 400);
  }
  nav(screen: Screen): void {
    this.stopLoop(); this.screen = screen; this.input.reset(); this.input.enabled = false; clear(this.root);
    this.renderer = null; this.run = null; this.audio.setMusic(null);
  }
  topbar(title: string, back: () => void = () => this.showHome()): HTMLElement {
    return h('header', { class: 'topbar' },
      h('button', { class: 'back', 'aria-label': '뒤로', onclick: () => { this.audio.play('click'); back(); } }, '←'),
      h('h2', {}, title),
      h('div', { class: 'wallet' }, h('span', { class: 'coin' }, '●'), ` ${fmtNum(this.p.coins)}`),
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

  // ------------------------------------------------------------------ run lifecycle
  startEndless(): void { const p = this.p; this.startRun({ mode: 'endless', seed: (Math.random() * 2 ** 32) >>> 0, charId: p.loadout.main, partnerId: p.loadout.partner, assist: this.assistOpts() }); }

  startRun(cfg: RunConfig): void {
    this.audio.unlock();
    this.nav('run');
    const s = newRun(cfg);
    let ghost: RunState | null = null; let log: number[] = [];
    const gkey = cfg.mode === 'stage' ? 'stage:' + cfg.stageId : cfg.mode === 'daily' ? 'daily:' + todayKey() : '';
    const g: GhostRec | null = gkey ? store.loadGhost<GhostRec>(gkey) : null;
    if (g && this.p.settings.ghost && g.seed === s.seed && g.content === CONTENT_HASH) {
      ghost = newRun({ mode: g.mode as Mode, seed: g.seed, charId: g.charId, partnerId: g.partnerId, companionId: g.companionId, stageId: g.stageId, assist: g.assistOpts });
      log = g.log;
    }
    this.run = { s, cfg, ghost, ghostLog: log, ghostIdx: 0, ghostBits: 0, acc: 0, lastT: performance.now(), prevX: s.body.x, prevY: s.body.y, paused: false, ended: false, endT: 0, reward: null, lastCount: -1, resumeT: 0 };
    this.buildRunDom();
    this.input.reset(); this.input.enabled = true;
    const bi = BIOME_BY_ID[s.biome]; if (bi) this.audio.setMusic({ bpm: bi.bpm, key: bi.key });
    this.startLoop();
  }

  private buildRunDom(): void {
    const swap = this.p.settings.swapSides;
    const pad = (zone: Exclude<Zone, null>) => {
      const b = h('div', { class: `pad ${zone}`, 'data-zone': zone }, h('span', { class: 'ic' }, zone === 'jump' ? '▲' : '▼'), h('b', {}, zone === 'jump' ? '점프' : '슬라이드'), h('small', {}, zone === 'jump' ? '탭 · 공중에서 한 번 더' : '누르고 있기'));
      return b;
    };
    const pads = h('div', { id: 'pads', class: swap ? 'swap' : '' }, pad('jump'), pad('slide'));
    const stage = h('div', { id: 'stage' }, h('canvas', { id: 'cv' }));
    const hints = h('div', { id: 'lhints', class: swap ? 'swap' : '' }, h('div', { class: 'lh jump' }, '▲ 점프'), h('div', { class: 'lh slide' }, '▼ 슬라이드'));
    const pauseBtn = h('button', { id: 'btn-pause', 'aria-label': '일시정지', onclick: () => this.setPaused(true) }, 'Ⅱ');
    const runEl = h('div', { id: 'run', class: 'screen run' }, stage, hints, pads, pauseBtn);
    this.root.append(runEl);
    this.renderer = new Renderer(document.getElementById('cv') as HTMLCanvasElement);
    this.applySettings();
    // pointer input on the whole run surface; each pointer keeps its zone
    const zoneAt = (e: PointerEvent): Zone => {
      const t = e.target as HTMLElement; const pz = t.closest?.('.pad') as HTMLElement | null;
      if (pz) return pz.dataset.zone as Zone;
      if (t.closest?.('button')) return null;
      const left = e.clientX < window.innerWidth / 2;
      return (left !== swap) ? 'jump' : 'slide';
    };
    const down = (e: PointerEvent) => {
      if (!this.run || this.run.paused || this.run.ended) return;
      const z = zoneAt(e); if (!z) return;
      e.preventDefault();
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      this.input.pointerDown(e.pointerId, z);
      document.querySelector(`.pad.${z}`)?.classList.add('on'); document.querySelector(`.lh.${z}`)?.classList.add('on');
    };
    const up = (e: PointerEvent) => {
      this.input.pointerUp(e.pointerId);
      for (const z of ['jump', 'slide']) if (!(z === 'slide' ? this.input.slideHeld : this.input.jumpHeld)) { document.querySelector(`.pad.${z}`)?.classList.remove('on'); document.querySelector(`.lh.${z}`)?.classList.remove('on'); }
    };
    runEl.addEventListener('pointerdown', down);
    runEl.addEventListener('pointerup', up); runEl.addEventListener('pointercancel', up); runEl.addEventListener('lostpointercapture', up as EventListener);
    runEl.addEventListener('touchstart', e => { if (!(e.target as HTMLElement).closest('button')) e.preventDefault(); }, { passive: false });
    runEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    this.layout();
  }

  layout(): void {
    const stage = document.getElementById('stage'); if (!stage || !this.renderer) return;
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    document.getElementById('run')?.classList.toggle('portrait', portrait);
    const r = stage.getBoundingClientRect();
    if (r.width > 10 && r.height > 10) this.renderer.resize(r.width, r.height);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (this.screen !== 'run' || !this.run) return;
    if (down && (e.code === 'Escape' || e.code === 'KeyP')) { e.preventDefault(); if (!this.run.ended) this.setPaused(!this.run.paused); return; }
    if (this.run.ended) { if (down && (e.code === 'Space' || e.code === 'Enter') && performance.now() > this.resultsReadyAt && document.getElementById('res-retry')) { e.preventDefault(); (document.getElementById('res-retry') as HTMLButtonElement).click(); } return; }
    if (!keyZone(e.code)) return;
    e.preventDefault();
    if (this.run.paused) return;
    this.audio.unlock();
    if (down) this.input.keyDown(e.code, e.repeat); else this.input.keyUp(e.code);
  }

  autoPause(): void { if (this.run && !this.run.paused && !this.run.ended && this.run.s.phase !== 'over') this.setPaused(true); }

  setPaused(p: boolean): void {
    const rc = this.run; if (!rc || rc.ended) return;
    rc.paused = p; this.input.reset();
    document.querySelectorAll('.pad.on,.lh.on').forEach(el => el.classList.remove('on'));
    if (p) {
      this.audio.suspend();
      const st = this.p.settings;
      this.modal(h('div', { class: 'sheet' },
        h('h3', {}, '일시정지'),
        h('p', { class: 'muted' }, `${fmtNum(totalScore(rc.s))}점 · ${Math.floor(rc.s.dist)}m`),
        h('button', { class: 'primary', onclick: this.click(() => { this.closeModal(); this.resume(); }) }, '계속 달리기'),
        h('button', { onclick: this.click(() => { this.closeModal(); rc.paused = false; this.startRun(rc.cfg.mode === 'endless' ? { ...rc.cfg, seed: (Math.random() * 2 ** 32) >>> 0 } : rc.cfg); }) }, '처음부터'),
        h('label', { class: 'set' }, h('span', {}, h('b', {}, '소리')), h('input', { type: 'checkbox', checked: st.sfx > 0 || st.bgm > 0, onchange: (e: Event) => { const on = (e.target as HTMLInputElement).checked; st.sfx = on ? 0.8 : 0; st.bgm = on ? 0.5 : 0; this.applySettings(); this.persist(); } })),
        h('button', { class: 'ghost', onclick: this.click(() => { this.closeModal(); this.showHome(); }) }, '그만하고 나가기 (기록 안 됨)'),
      ), false);
    }
  }
  private resume(): void {
    const rc = this.run; if (!rc) return;
    this.audio.resume();
    // short countdown so nothing happens the instant you tap "continue". Done here (not in the sim) so the
    // input log / ghost replay stays step-exact.
    if (rc.s.phase === 'run') rc.resumeT = 1.0;
    rc.paused = false; rc.acc = 0; rc.lastT = performance.now();
  }

  // ------------------------------------------------------------------ loop
  private startLoop(): void { cancelAnimationFrame(this.raf); const f = (t: number) => { this.frame(t); if (this.run) this.raf = requestAnimationFrame(f); }; this.raf = requestAnimationFrame(f); }
  private stopLoop(): void { cancelAnimationFrame(this.raf); this.raf = 0; }

  frame(now: number): void {
    const rc = this.run; const r = this.renderer; if (!rc || !r) return;
    let real = (now - rc.lastT) / 1000; rc.lastT = now;
    if (real > 0.25 && !rc.paused && !rc.ended && rc.s.phase === 'run') { this.setPaused(true); real = 0; }
    real = Math.min(real, 0.1);
    const s = rc.s;
    if (rc.resumeT > 0 && !rc.paused) { rc.resumeT = Math.max(0, rc.resumeT - real); r.resumeCount = rc.resumeT; if (rc.resumeT === 0) this.audio.play('go'); }
    else r.resumeCount = 0;
    if (!rc.paused && rc.resumeT <= 0) {
      rc.acc += real * Math.max(0.5, Math.min(1, this.p.settings.gameSpeed || 1));
      let n = 0;
      while (rc.acc >= DT && n < MAX_STEPS) {
        rc.prevX = s.body.x; rc.prevY = s.body.y;
        const beforeCd = s.phase === 'countdown' ? Math.ceil(s.countdown / 0.5) : -1;
        stepRun(s, this.input.take());
        if (s.phase === 'countdown') { const c = Math.ceil(s.countdown / 0.5); if (c !== beforeCd && c > 0) this.audio.play('count'); }
        else if (beforeCd > 0 && s.phase === 'run') this.audio.play('go');
        if (rc.ghost) this.stepGhost(rc);
        rc.acc -= DT; n++;
      }
      if (n >= MAX_STEPS) rc.acc = 0;
    }
    if (s.events.length) { r.consume(s.events, s); this.onEvents(s.events, s); s.events.length = 0; }
    // interpolation (skip across teleports)
    const a = Math.min(1, rc.acc / DT);
    const tele = Math.abs(s.body.x - rc.prevX) > 100;
    const ix = tele ? s.body.x : rc.prevX + (s.body.x - rc.prevX) * a;
    const iy = tele ? s.body.y : rc.prevY + (s.body.y - rc.prevY) * a;
    let gv: GhostView | null = null;
    if (rc.ghost && rc.ghost.phase !== 'over' && s.bonusStage === 'none' && rc.ghost.bonusStage === 'none') { const gb = rc.ghost.body; gv = { x: gb.x, y: gb.y, sliding: gb.sliding, onGround: gb.onGround, charId: rc.ghost.charId, scale: gb.scale }; }
    // battery saver: draw every other frame on fast displays
    this.frameSkip ^= 1;
    r.pbDist = s.mode === 'endless' && !s.trial ? (this.p.bestEndless?.dist ?? 0) : 0;
    if (!(this.p.settings.lowFx && this.frameSkip)) r.draw(s, ix, iy, this.p.settings.lowFx ? real * 2 : real, gv);
    this.audio.tick();
    this.frames++; this.fpsT += real; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    if ((s.phase === 'over' || s.phase === 'clear') && !rc.ended) this.endRun(rc);
  }

  private stepGhost(rc: RunCtx): void {
    const g = rc.ghost!; const log = rc.ghostLog; const i = g.steps;
    let jump = false;
    while (rc.ghostIdx < log.length && log[rc.ghostIdx] === i) { rc.ghostBits = log[rc.ghostIdx + 1]; jump = (rc.ghostBits & 1) === 1; rc.ghostIdx += 2; }
    stepRun(g, { jump, slide: (rc.ghostBits & 2) === 2, jumpHeld: (rc.ghostBits & 4) === 4 });
    g.events.length = 0;
  }

  private onEvents(evs: SimEvent[], s: RunState): void {
    const a = this.audio;
    for (const e of evs) {
      switch (e.t) {
        case 'jump': a.play(e.n === 2 ? 'jump2' : 'jump'); break;
        case 'land': a.play('land'); break;
        case 'slide': a.play('slide'); break;
        case 'pickup':
          if (e.type === 'jelly' || e.type === 'bonusJelly') a.play('jelly');
          else if (e.type === 'big') a.play('big');
          else if (e.type === 'coin') a.play('coin');
          else if (e.type === 'potion' || e.type === 'bigPotion') a.play('potion');
          else if (e.type === 'letter') a.play('letter', e.letter ?? 0);
          break;
        case 'hit': a.play(e.shielded ? 'shield' : 'hit'); if (!e.shielded && this.p.settings.vibrate) try { navigator.vibrate?.(40); } catch { /* ignore */ } break;
        case 'smash': a.play('smash'); break;
        case 'power': a.play('power'); break;
        case 'powerEnd': a.play('powerEnd'); break;
        case 'bonusStart': a.play('bonus'); a.setMusic('bonus'); break;
        case 'bonusEnd': { a.play('bonusEnd'); const bi = BIOME_BY_ID[s.biome]; if (bi) a.setMusic({ bpm: bi.bpm, key: bi.key }); break; }
        case 'fall': a.play('fall'); break;
        case 'speedUp': a.play('speed'); break;
        case 'biome': { const bi = BIOME_BY_ID[e.id]; if (bi && s.bonusStage === 'none') a.setMusic({ bpm: bi.bpm, key: bi.key }); break; }
        case 'skill': a.play('skill'); break;
        case 'lowHp': a.play('lowhp'); break;
        case 'revive': case 'relay': a.play('relay'); break;
        case 'nearMiss': a.play('near'); break;
        case 'streak': a.play('streak'); break;
        case 'death': a.play('death'); a.setMusic(null); break;
        case 'clear': a.play('clear'); a.setMusic(null); break;
      }
    }
  }

  // ------------------------------------------------------------------ results
  private endRun(rc: RunCtx): void {
    rc.ended = true; this.input.reset(); this.input.enabled = false;
    const s = rc.s;
    rc.reward = applyRun(this.p, s);
    if (rc.reward.ghost && rc.reward.ghostKey) { store.saveGhost(rc.reward.ghostKey, rc.reward.ghost); store.pruneDailyGhosts(7); }
    this.persist();
    setTimeout(() => { if (this.run === rc) this.showResults(rc); }, 350);
  }

  private showResults(rc: RunCtx): void {
    const s = rc.s; const rw = rc.reward!; const p = this.p;
    this.resultsReadyAt = performance.now() + 650;   // a mashing thumb can't skip the results by accident
    const cleared = s.phase === 'clear';
    const st = s.stageId ? STAGES.find(x => x.id === s.stageId) : null;
    const nextStage = st ? STAGES[STAGES.findIndex(x => x.id === st.id) + 1] : null;
    const title = s.trial ? '시험 달리기 끝' : s.mode === 'tutorial' ? (cleared ? '튜토리얼 완료!' : '연습 끝') : s.mode === 'stage' ? (cleared ? '도착!' : '아쉬워요!') : rw.newBest ? '새 기록!' : '달리기 끝';
    const why = deathExplain(s);
    const hints = nearMissHints(s, rw);
    const stat = (k: string, v: string) => h('div', { class: 'st' }, h('small', {}, k), h('b', {}, v));
    const retry = () => {
      if (performance.now() < this.resultsReadyAt) return;
      this.audio.play('click'); this.closeModal();
      if (rc.cfg.trial) this.startRun({ ...rc.cfg, seed: (Math.random() * 2 ** 32) >>> 0 });
      else if (rc.cfg.mode === 'endless') this.startEndless(); else if (rc.cfg.mode === 'tutorial') this.startEndless(); else this.startRun(rc.cfg);
    };
    const el = h('div', { class: 'sheet results' },
      h('h2', {}, title, s.assist ? h('small', { class: 'tagx' }, ' 느긋 모드') : null),
      h('div', { class: 'bigscore', id: 'res-score' }, '0'),
      rw.newBest && s.mode !== 'tutorial' ? h('div', { class: 'newbest' }, rw.prevBest ? `이전 최고 ${fmtNum(rw.prevBest)}` : '첫 기록!') : rw.prevBest ? h('div', { class: 'muted' }, `최고 ${fmtNum(rw.prevBest)}`) : null,
      st ? h('div', { class: 'goals' },
        goal(cleared, `도착 (${st.length}m)`), goal(cleared && jellyPct(s) >= st.stars.jellyPct, `젤리 ${st.stars.jellyPct}% (이번 ${jellyPct(s)}%)`), goal(cleared && ((p.pouches[st.id] ?? 0) & 7) === 7, `황금 복주머니 3개 (이번 ${[0,1,2].filter(i => (s.pouchesGot >> i) & 1).length}개)`)) : null,
      !cleared && s.mode !== 'tutorial' ? h('div', { class: 'why' }, h('b', {}, why.title), h('small', {}, why.detail)) : null,
      ...hints.map(t => h('div', { class: 'almost' }, t)),
      h('div', { class: 'stats' },
        stat('거리', `${fmtNum(Math.floor(s.dist))}m`), stat('젤리', `${fmtNum(s.stats.jellies)} (${jellyPct(s)}%)`), stat('곰젤리', fmtNum(s.stats.bigJellies)),
        stat('보너스 타임', `${s.stats.bonusTimes}번`), stat('연속 무피격', `${s.stats.bestStreak}회`), stat('아슬아슬', `${s.stats.nearMisses}번`)),
      h('div', { class: 'rewards' },
        h('div', { class: 'kv' }, h('span', {}, '코인'), h('b', {}, `+${fmtNum(rw.coins)}`)),
        h('small', { class: 'muted' }, [rw.coinsFromPickups ? `주운 코인 ${rw.coinsFromPickups}` : '', rw.coinsFromDist ? `거리 ${rw.coinsFromDist}` : '', rw.coinsFromMissions ? `미션 ${rw.coinsFromMissions}` : '', rw.coinsFromRank ? `랭크 ${rw.coinsFromRank}` : ''].filter(Boolean).join(' · ') || '—'),
        ...rw.missionsDone.map(m => h('div', { class: 'mdone' }, `✔ ${m.text} (+★${m.xp})`)),
        rw.rankUps ? h('div', { class: 'mdone' }, `랭크 업! → ${p.rank}`) : null,
        ...rw.unlocked.map(id => h('div', { class: 'mdone' }, `🎉 새 캐릭터 합류: ${CHAR_BY_ID[id]?.name}`)),
        h('div', { class: 'mlist' }, ...p.missions.map(m => h('div', { class: 'mini' }, h('span', {}, missionText(m)), h('small', {}, `${fmtNum(Math.min(m.progress, m.target))}/${fmtNum(m.target)}`)))),
      ),
      h('button', { class: 'primary huge', id: 'res-retry', onclick: retry }, s.mode === 'tutorial' ? '무한 질주 시작!' : '다시 달리기'),
      h('div', { class: 'row' },
        cleared && nextStage && stageUnlocked(p, nextStage.id) ? h('button', { onclick: this.click(() => { this.closeModal(); this.startRun({ ...rc.cfg, stageId: nextStage.id, seed: nextStage.seed }); }) }, `다음: ${nextStage.id}`) : null,
        h('button', { class: 'ghost', onclick: this.click(() => { this.closeModal(); if (s.trial) this.showChars(); else if (s.mode === 'stage') this.showAdventure(); else this.showHome(); }) }, s.trial ? '캐릭터 목록' : s.mode === 'stage' ? '모험 지도' : '홈으로'),
      ),
    );
    this.modal(el, false);
    // score count-up (any tap skips)
    const target = rw.score; const sc = document.getElementById('res-score')!; const t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / 900); sc.textContent = fmtNum(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1 && document.body.contains(sc)) requestAnimationFrame(tick); };
    requestAnimationFrame(tick); el.addEventListener('pointerdown', () => { sc.textContent = fmtNum(target); }, { once: true });
    if (rw.newBest || rw.newStars || rw.missionsDone.length) this.audio.play('reward');
  }
}

function goal(ok: boolean, text: string): HTMLElement { return h('div', { class: 'goal' + (ok ? ' ok' : '') }, ok ? '★ ' : '☆ ', text); }
function kv(k: string, v: string): HTMLElement { return h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, v)); }
void VIEW_H; void BONUS_WORD; void LOW_HP_FRAC; void hitName;
