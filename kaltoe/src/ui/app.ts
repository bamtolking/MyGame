// 앱: 화면 전환, 메인 루프(고정 스텝), 시뮬레이션 이벤트 → 효과/사운드/토스트, 판 시작/종료
import { BALANCE, ENEMY, WEAPON, WEAPONS } from '../content';
import { HOUR_MESSAGES, OVERTIME_MESSAGES, YAGEUN_CONFIRMED, ONBOARDING_HINTS } from '../content/strings';
import { createWorld } from '../sim/state';
import { stepWorld, continueOvertime, endRun, DT } from '../sim/step';
import { applyChoice, applyLunch, banish, closeChest, reroll, skipLevel } from '../sim/levelup';
import { activateUlt } from '../sim/ultimate';
import type { World } from '../sim/types';
import { autoChoose, autoMove } from '../sim/autopilot';
import { Renderer } from '../render/renderer';
import { Fx, type Quality } from '../render/fx';
import { clearSpriteCache } from '../render/sprites';
import { loadFonts, onFontsReady } from './fonts';
import { loadProfile, saveProfile, SAVE_KEY, type Profile } from '../platform/save';
import { audio, type TrackId } from '../platform/audio';
import { juiceEvent, juiceDeath } from '../render/juice';
import { buildRunConfig, checkAttendance, dailyInfo, dailyModifiersFor, evaluateAchievements, settleRun } from '../meta/progress';
import { Input } from './input';
import { Hud } from './hud';
import { Modals } from './modals';
import { Screens } from './screens';
import { h, Toasts, Banners, setClickSound, confirmBox, onCanvasGlyphs } from './dom';

const pickStr = (arr: readonly string[], f: string) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : f);

/** 자동 품질 사다리: 위에서부터 [효과 품질, 해상도(dpr) 상한]. 느려지면 한 칸씩 내려간다. */
const QUALITY_LADDER: { q: Quality; dpr: number }[] = [
  { q: 'high', dpr: 3 }, { q: 'high', dpr: 2 }, { q: 'medium', dpr: 2 }, { q: 'medium', dpr: 1.5 }, { q: 'low', dpr: 1.25 }, { q: 'low', dpr: 1 },
];

export class App {
  root: HTMLElement;
  ui: HTMLElement;
  canvas: HTMLCanvasElement;
  fx = new Fx();
  renderer: Renderer;
  input: Input;
  profile: Profile;
  saveStatus: string;
  world: World | null = null;
  hud: Hud | null = null;
  modals: Modals;
  screens: Screens;
  toasts: Toasts;
  private banners: Banners;
  paused = false;
  private acc = 0;
  private last = 0;
  private achT = 0;
  private hudT = 0;
  fps = 60;
  private slowSec = 0;
  private fastSec = 0;
  private fpsHist: number[] = [];
  lastWork = 0;            // 최근 1초 평균 프레임 작업 시간(ms)
  private qLevel = 0;      // QUALITY_LADDER 단계(0 = 최고)
  private qCeil = 0;       // 자동 조절이 올라갈 수 있는 최고 단계
  private sinceUp = 99;
  private workAcc = 0;
  private frameN = 0;
  private stepsThisFrame = 0;
  private combo = 0;
  private comboT = 0;
  private comboBest = 0;
  private phaseDelay = -1;
  private ultHinted = false;
  private overtimeMin = 0;
  private fpsAcc = 0; private fpsN = 0;
  private lastRunOpts: { char: string; stage: string; heat: number; daily: boolean } | null = null;
  private deathT = 0;
  private deathShown = false;
  private renderErr = false;
  private tutorial: HTMLElement | null = null;
  private idleWorld: World | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.canvas = h('canvas', { id: 'cv' }) as HTMLCanvasElement;
    this.ui = h('div', { id: 'ui' });
    root.appendChild(this.canvas);
    root.appendChild(this.ui);
    this.renderer = new Renderer(this.canvas, this.fx);
    this.input = new Input(root);
    this.input.onUlt = () => this.useUlt();
    this.input.onPause = () => this.togglePause();
    const lp = loadProfile();
    this.profile = lp.profile;
    this.saveStatus = lp.status;
    this.toasts = new Toasts(this.ui);
    this.banners = new Banners(this.ui);
    setClickSound(() => audio.play('click'));
    const self = this;
    this.modals = new Modals({
      root: this.ui,
      pick: i => { if (self.world) { applyChoice(self.world, i); audio.play('buy'); self.afterModal(); } },
      reroll: () => { if (self.world && reroll(self.world)) self.modals.levelUp(self.world); },
      skip: () => { if (self.world && skipLevel(self.world)) self.afterModal(); },
      banish: i => { if (self.world && banish(self.world, i)) self.modals.levelUp(self.world); },
      closeChest: () => { if (self.world) { closeChest(self.world); self.afterModal(); } },
      lunch: id => { if (self.world) { applyLunch(self.world, id); audio.play('buy'); self.afterModal(); } },
      resume: () => self.setPaused(false),
      quit: async () => {
        if (await confirmBox(self.ui, '조퇴하시겠습니까?', '지금까지 번 월급은 받고 판이 끝납니다.', '조퇴', '계속 일하기', true)) self.finishRun();
      },
      settings: () => {
        const el = self.screens.settings(() => { el.remove(); }, true);
      },
      overtime: () => { if (self.world) { continueOvertime(self.world); self.modals.close(); audio.play('boss'); audio.setTrack('overtime'); audio.setIntensity(3); } },
      goHome: () => self.finishRun(),
    });
    this.screens = new Screens({
      root: this.ui,
      get profile() { return self.profile; },
      save: () => this.save(),
      startRun: o => this.startRun(o),
      applySettings: () => this.applySettings(),
      show: () => {},
      replaceProfile: p => { this.profile = p; this.save(); this.applySettings(); this.screens.syncSel(); },
      checkAchievements: () => {
        const g = evaluateAchievements(this.profile);
        if (g.length) { this.save(); for (const x of g) this.toasts.show(`🏆 업적 달성: ${x.a.name} — ${x.text}`, 'ach', 3500); audio.play('jackpot'); }
      },
    });
    this.applySettings();
    loadFonts();
    onFontsReady(() => { clearSpriteCache(); this.fx.invalidateText(); });
    onCanvasGlyphs(() => { clearSpriteCache(); this.fx.invalidateText(); });   // 캔버스 글자 조각이 늦게 도착하면 한 번 더 굽는다

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.world && this.world.phase === 'play') this.setPaused(true); audio.suspend(); }
      else { audio.resume(); if (!this.world) this.checkDay(); }
    });
    // 다른 탭에서 저장이 바뀌면(판 진행 중이 아닐 때) 다시 읽는다
    window.addEventListener('storage', e => {
      if (e.key !== SAVE_KEY || this.world) return;
      const lp = loadProfile();
      if (lp.status !== 'ok') return;
      this.profile = lp.profile;
      // 옛 프로필을 붙잡고 있는 확인창·메뉴 화면은 닫고 타이틀로
      this.ui.querySelectorAll('.confirm-wrap').forEach(n => n.remove());
      this.applySettings();
      this.screens.syncSel();
      if (this.screens.cur) this.screens.title();
    });
    const unlock = () => { audio.unlock(); audio.startMusic(); };
    window.addEventListener('pointerdown', unlock, { once: false, passive: true });
    window.addEventListener('keydown', unlock, { once: false });

    // 타이틀 배경용 데모 월드
    this.idleWorld = this.makeIdleWorld();
    this.screens.title();
    this.greet();
    requestAnimationFrame(t => { this.last = t; this.frame(t); });
  }

  private greet() {
    if (this.saveStatus === 'restored') this.toasts.show('저장 파일이 손상되어 백업에서 복구했습니다', 'warn', 4000);
    if (this.saveStatus === 'corrupt') this.toasts.show('저장 파일을 읽지 못해 새로 시작합니다 (이전 파일은 따로 보관됨)', 'warn', 4000);
    this.checkDay();
    const g = evaluateAchievements(this.profile);
    if (g.length) { this.save(); for (const x of g) this.toasts.show(`🏆 ${x.a.name} — ${x.text}`, 'ach', 3500); }
  }

  private demo = true;
  private demoAcc = 0;
  /** 날짜가 바뀌었으면 출석 체크(앱을 켜 둔 채 자정을 넘긴 경우 포함) */
  checkDay() {
    const att = checkAttendance(this.profile);
    if (!att) return;
    this.save();
    setTimeout(() => {
      if (this.world) { audio.play('coin'); this.toasts.show(`📅 출석 체크 ${att.day}일차 — 출근 수당 ₩${att.coins} 지급`, 'good', 3200); return; }
      confirmBox(this.ui, `📅 출석 체크 ${att.day}일차`, `오늘도 출근해 주셨군요!\n출근 수당 ₩${att.coins} 지급 완료.\n(7일 주기, 7일차 보너스 두둑)`, '감사합니다', '닫기');
      audio.play('coin');
      if (this.screens.curName === 'title') this.screens.title();
    }, 400);
  }

  private makeIdleWorld(): World {
    const chars = ['kim', 'park', 'lee', 'choi', 'han', 'yoon'];
    const stages = ['office', 'crunch', 'dinner', 'holiday'];
    const seed = (Math.random() * 1e9) >>> 0;
    const cfg = buildRunConfig(this.profile, { char: chars[seed % chars.length], stage: stages[(seed >> 3) % stages.length], heat: 0, seed });
    // 데모는 모든 무기를 쓰고, 조금 강하게(오래 버티며 화려하게)
    cfg.unlockedWeapons = new Set(WEAPONS.map(x => x.id));
    cfg.meta = { might: 0.6, maxHp: 150, recovery: 1, cooldown: 0.2, growth: 0.6 };
    const w = createWorld(cfg);
    const [vw, vh] = this.renderer.viewSize();
    w.viewW = vw; w.viewH = vh;
    return w;
  }

  private stepDemo(w: World, dt: number): number {
    this.demoAcc += dt;
    let n = 0;
    while (this.demoAcc >= DT && n < 4) {
      this.demoAcc -= DT; n++;
      if (w.phase === 'play') {
        if (w.step % 3 === 0) { const [mx, my] = autoMove(w); w.player.mx = mx; w.player.my = my; }
        if (w.player.ult >= w.player.ultMax) activateUlt(w);
        stepWorld(w);
      } else if (w.phase === 'levelup') applyChoice(w, autoChoose(w));
      else if (w.phase === 'chest') closeChest(w);
      else if (w.phase === 'lunch') applyLunch(w, w.lunchChoices[0].id);
      else { this.idleWorld = this.makeIdleWorld(); return 0; }
    }
    if (n >= 4) this.demoAcc = 0;
    // 데모 이벤트: 시각 효과만(소리·토스트 없음)
    for (const ev of w.events) { juiceEvent(this.fx, ev, w, { vibrate: false, demo: true }); this.renderer.onEvent(ev, w); }
    w.events.length = 0;
    if (w.t > 420) this.idleWorld = this.makeIdleWorld();
    return n;
  }

  save() {
    if (!saveProfile(this.profile)) this.toasts.show('⚠ 저장 실패 (브라우저 저장소를 확인하세요)', 'warn');
  }

  applySettings() {
    const s = this.profile.settings;
    audio.setVolumes(s.sfx, s.bgm);
    this.fx.shakeOn = s.shake;
    this.fx.showNums = s.dmgNums;
    const fixed = s.quality === 'high' ? 0 : s.quality === 'medium' ? 2 : s.quality === 'low' ? 4 : -1;
    if (fixed >= 0) this.setQualityLevel(fixed);
    else if (this.qLevel !== Math.max(this.qLevel, this.qCeil)) this.setQualityLevel(this.qCeil);
    this.input.fixed = s.joystick === 'fixed';
  }

  /** 품질 사다리 단계 적용(렌더 품질 + 해상도 상한) */
  private setQualityLevel(i: number) {
    const lv = QUALITY_LADDER[Math.max(0, Math.min(QUALITY_LADDER.length - 1, i))];
    this.qLevel = Math.max(0, Math.min(QUALITY_LADDER.length - 1, i));
    this.renderer.dprCap = lv.dpr;
    this.renderer.setQuality(lv.q);
  }

  private onResize() {
    this.renderer.resize();
    const [vw, vh] = this.renderer.viewSize();
    if (this.world) { this.world.viewW = vw; this.world.viewH = vh; }
  }

  // ───────────── 판 ─────────────

  startRun(o: { char: string; stage: string; heat: number; daily: boolean }) {
    this.lastRunOpts = o;
    const p = this.profile;
    const di = o.daily ? dailyInfo(p) : null;   // 자정이 지난 재도전이면 오늘 것으로 새로 정해진다
    if (di) this.save();
    const seed = di ? di.seed : (Math.random() * 2 ** 32) >>> 0;
    const cfg = buildRunConfig(p, {
      char: di ? di.char : o.char, stage: di ? di.stage : o.stage, heat: di ? di.heat : o.heat, seed,
      modifiers: di ? dailyModifiersFor(p, di) : undefined, daily: o.daily, dailyDate: di?.date,
    });
    const w = createWorld(cfg);
    const [vw, vh] = this.renderer.viewSize();
    w.viewW = vw; w.viewH = vh;
    this.world = w;
    this.screens.close();
    this.modals.close();
    this.banners.clear();
    this.hud?.root.remove();
    this.hud = new Hud(this.ui, () => this.useUlt(), () => this.togglePause());
    this.hud.setUltIcon(w.ultimate.icon, w.ultimate.name);
    this.ui.appendChild(this.toasts.el);
    this.paused = false;
    this.acc = 0;
    this.deathT = 0;
    this.deathShown = false;
    this.combo = 0; this.comboT = 0; this.comboBest = 0; this.phaseDelay = -1; this.ultHinted = false;
    this.renderer.camX = 0; this.renderer.camY = 0;
    this.fx.reset();
    this.overtimeMin = 0;
    audio.unlock(); audio.setTrack(this.stageTrack(w)); audio.setIntensity(1); audio.startMusic();
    this.toasts.show(`${w.cfg.stage.icon} ${w.cfg.stage.name} — 09:00 출근!`, 'info', 2200);
    if (o.daily) this.toasts.show(`📅 오늘의 업무: ${w.cfg.modifiers.filter(m => !m.id.startsWith('heat')).map(m => m.name).join(', ')}`, 'warn', 3500);
    if (!p.tutorialDone) {
      this.tutorial = h('div', { class: 'tutorial' }, h('span', { class: 'hand' }, '👆'), '화면을 누른 채 끌어서 이동!', h('div', { class: 'small', style: 'color:#fff' }, '공격은 자동입니다'));
      this.ui.appendChild(this.tutorial);
      this.input.onFirstMove = () => {
        this.tutorial?.remove(); this.tutorial = null;
        p.tutorialDone = true; this.save();
      };
    } else {
      this.hint('move');
    }
  }

  private finishRun() {
    const w = this.world;
    if (!w) return;
    endRun(w);
    const st = settleRun(this.profile, w);
    this.save();
    this.modals.close();
    this.banners.clear();
    this.hud?.root.remove(); this.hud = null;
    this.tutorial?.remove(); this.tutorial = null;
    this.input.onFirstMove = null;
    this.input.release();
    audio.setTrack('title'); audio.setIntensity(0);
    this.screens.results(w, st, () => { if (this.lastRunOpts) this.startRun(this.lastRunOpts); });
    if (st.grants.length) audio.play('jackpot');
    if (st.total > 0) setTimeout(() => this.hint('meta'), 1200);
    this.idleWorld = this.makeIdleWorld();
    this.world = null;
  }

  private useUlt() {
    const w = this.world;
    if (!w || this.paused || w.phase !== 'play') return;
    activateUlt(w);
  }

  /** 확인창·인게임 설정 같은 덧창이 떠 있는지 */
  private overlayOpen() { return !!this.ui.querySelector('.confirm-wrap, #ui > .screen'); }

  togglePause() {
    const w = this.world;
    if (!w) return;
    if (this.modals.kind && this.modals.kind !== 'pause') return;
    if (this.overlayOpen()) return;
    this.setPaused(!this.paused);
  }

  setPaused(v: boolean) {
    const w = this.world;
    if (!w) return;
    if (v && w.phase !== 'play') return;
    this.paused = v;
    this.input.release();
    if (v) this.modals.pause(w); else if (this.modals.kind === 'pause') this.modals.close();
  }

  /** 모달이 닫힌 뒤 다음 대기 모달이 있으면 연다 */
  private afterModal() {
    const w = this.world;
    if (!w) return;
    this.modals.close();
    this.input.release();
    this.openPhaseModal();
  }

  private openPhaseModal() {
    const w = this.world!;
    switch (w.phase) {
      case 'levelup': this.modals.levelUp(w); audio.play('levelup'); audio.stinger('levelup'); break;
      case 'chest': this.modals.chest(w); audio.play('item'); break;
      case 'lunch': this.modals.lunch(w); audio.play('lunch'); audio.stinger('lunch'); break;
      case 'victory': this.modals.victory(w); audio.play('clear'); audio.stinger('victory'); this.confetti(); break;
    }
  }

  private confetti() {
    const c = h('div', { class: 'confetti' });
    const colors = ['#ffd84d', '#ff4d6d', '#3ddc97', '#3de0ff', '#ff5cf0'];
    for (let i = 0; i < 70; i++) {
      c.appendChild(h('i', { style: `left:${Math.random() * 100}%;background:${colors[i % 5]};animation-duration:${1.8 + Math.random() * 1.8}s;animation-delay:${Math.random() * 0.6}s` }));
    }
    this.ui.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }

  /** 온보딩 힌트: 프로필당 한 번만 */
  private hint(key: string) {
    const p = this.profile;
    const text = ONBOARDING_HINTS[key];
    if (!text || p.hints.includes(key)) return;
    p.hints.push(key);
    this.toasts.show(`💡 ${text}`, 'good', 3200);
  }

  /** 그리기 한 번이 예외를 던져도 HUD 갱신·다음 프레임이 멈추지 않게(오류는 한 번만 기록) */
  private safeRender(...args: Parameters<Renderer['render']>) {
    try { this.renderer.render(...args); } catch (e) { if (!this.renderErr) { this.renderErr = true; console.error('render', e); } }
  }

  /** 큰 배너는 한 번에 하나(우선순위: 퇴사 > 보스 > 궁극기·진화·야근 > 콤보·부활) — ui/dom.ts Banners */
  private banner(text: string, cls: string, sub = '') { this.banners.show(text, cls, sub); }

  // ───────────── 이벤트 → 연출 ─────────────

  private handleEvents(w: World) {
    const set = this.profile.settings;
    for (const ev of w.events) {
      juiceEvent(this.fx, ev, w, { vibrate: set.vibrate });   // 시각 연출(render/juice.ts)
      this.renderer.onEvent(ev, w);                             // 렌더러 쪽 동작 연출(공격 자세·시체 날리기 등)
      audio.event(ev, w);                                      // 효과음(platform/sfx.ts)
      // 아래는 UI(토스트·배너·힌트·콤보·음악 전환)
      switch (ev.t) {
        case 'kill': {
          this.combo++; this.comboT = 1.3;
          if (this.combo > this.comboBest) this.comboBest = this.combo;
          if (this.combo === 100 || this.combo === 300 || this.combo === 700 || this.combo === 1500) {
            const shout = this.combo >= 1500 ? '전설의 일잘러!' : this.combo >= 700 ? '야근 각성!' : this.combo >= 300 ? '업무 폭주!' : '일 좀 하는데?';
            this.banner(`🔥 ${this.combo} 연속 처리`, 'lv', shout);
            audio.play('levelup');
          }
          this.hint('autoAttack');
          break;
        }
        case 'toast': this.toasts.show(ev.text, ev.kind ?? 'info'); break;
        case 'bossSpawn': this.banner(`⚠ ${ev.name} 등장 ⚠`, 'boss', ENEMY.get(ev.id)?.intro ?? ''); audio.setTrack('boss'); audio.setIntensity(3); audio.stinger('bossIntro'); break;
        case 'bossDead': {
          this.toasts.show(`🎉 ${ev.name} 격파!`, 'good', 3000);
          if (!w.bossAlive || w.bossAlive.dead) { audio.setTrack(w.overtime ? 'overtime' : this.stageTrack(w)); audio.setIntensity(w.t > 400 ? 2 : 1); }
          break;
        }
        case 'elite': this.hint('elite'); this.toasts.show(`⚠ 엘리트 ${ev.name} 출현 — 처치하면 택배 상자!`, 'warn'); break;
        case 'ult': this.banner(ev.shout, 'ult'); break;
        case 'evolve': {
          const to = WEAPON.get(ev.to);
          this.toasts.show(`⭐ 진화! ${WEAPON.get(ev.from)?.name} → ${to?.name}`, 'ach', 3500);
          this.banner(`⭐ 진화! ${to?.icon ?? ''} ${to?.name ?? ''}`, 'ult', to?.desc ?? '');
          break;
        }
        case 'hour': {
          const msg = HOUR_MESSAGES[ev.hour];
          if (msg) this.toasts.show(msg, 'info');
          if (ev.hour === 15 && !(w.bossAlive && !w.bossAlive.dead)) audio.setIntensity(2);
          break;
        }
        case 'revive': this.banner('보험 처리!', 'lv', '다시 일어났다'); break;
        case 'yageun': this.hint('yageun'); this.banner('야근 확정', 'yageun', pickStr(YAGEUN_CONFIRMED, '보스를 잡아야 퇴근할 수 있습니다')); break;
        case 'maxed': this.hint('evolveReady'); break;
        default: break;
      }
    }
    w.events.length = 0;
  }

  /** 근무지 → 배경음 곡 */
  private stageTrack(w: World): TrackId {
    const id = w.cfg.stage.id;
    return id === 'office' || id === 'crunch' || id === 'dinner' || id === 'holiday' ? id : 'office';
  }

  // ───────────── 메인 루프 ─────────────

  private frame(now: number) {
    requestAnimationFrame(t => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 1) {
      this.fps = this.fpsN / this.fpsAcc;
      const work = this.workAcc / Math.max(1, this.fpsN);   // 프레임당 실제 작업 시간(ms)
      this.lastWork = work;
      this.fpsAcc = 0; this.fpsN = 0; this.workAcc = 0;
      // 동적 해상도: fps(GPU 병목)와 프레임당 JS 작업 시간(CPU 병목)을 함께 본다.
      // 저전력 모드처럼 30fps로 '고정'된 기기(최근 3초가 모두 29~31fps)는 느린 기기로 오판하지 않는다.
      this.fpsHist.push(this.fps); if (this.fpsHist.length > 3) this.fpsHist.shift();
      const capped30 = this.fpsHist.length === 3 && this.fpsHist.every(f => f > 28.5 && f < 31.5);
      if (this.world && this.world.phase === 'play' && !this.paused) {
        const slow = work > 13 || (this.fps < 45 && !capped30);
        if (slow) { this.slowSec++; this.fastSec = 0; }
        else if (work < 6 && this.fps > 56) { this.fastSec++; this.slowSec = 0; }
        else { this.slowSec = 0; this.fastSec = 0; }
        this.sinceUp++;
        if (this.profile.settings.quality === 'auto') {
          // 품질 사다리: 효과를 먼저 줄이고, 해상도는 나중에 줄인다
          if (this.slowSec >= 2 && this.qLevel < QUALITY_LADDER.length - 1) {
            // 올린 직후 금방 느려졌다면 그 단계는 이번 세션에서 다시 올리지 않는다(왕복 방지)
            if (this.sinceUp <= 8) this.qCeil = this.qLevel + 1;
            this.setQualityLevel(this.qLevel + 1); this.slowSec = 0;
          }
          if (this.fastSec >= 8 && this.qLevel > this.qCeil) { this.setQualityLevel(this.qLevel - 1); this.fastSec = 0; this.sinceUp = 0; }
        }
      }
    }
    const t0 = performance.now();

    const w = this.world;
    this.input.enabled = !!w && w.phase === 'play' && !this.paused && !this.modals.kind && !this.overlayOpen();
    if (!this.input.enabled && this.input.joy.active) this.input.release();
    if (w) {
      const [mx, my] = this.input.vector();
      w.player.mx = mx; w.player.my = my;
      this.stepsThisFrame = 0;
      if (!this.paused && w.phase === 'play') {
        if (w.hitStop > 0) { w.hitStop -= dt; }
        else {
          const speed = w.flags.has('fastClock') ? 1.3 : 1;
          this.acc += dt * speed;
          let n = 0;
          while (this.acc >= DT && n < 8 && w.phase === 'play') { stepWorld(w); this.acc -= DT; n++; }
          if (n >= 8) this.acc = 0;
          this.stepsThisFrame = n;
        }
        // 실시간 업적(1초마다)
        this.achT += dt;
        if (this.achT > 1) {
          this.achT = 0;
          const g = evaluateAchievements(this.profile, w);
          if (g.length) { this.save(); for (const x of g) { this.toasts.show(`🏆 업적 달성: ${x.a.name} — ${x.text}`, 'ach', 3500); audio.play('jackpot'); } }
          if (w.overtime) {
            const min = Math.floor(w.stats_.overtimeSec / 60);
            if (min > this.overtimeMin) { this.overtimeMin = min; this.toasts.show(pickStr(OVERTIME_MESSAGES, `야근 ${min}분째…`), 'warn'); }
          }
        }
      }
      this.handleEvents(w);
      // 단계 전환
      if (!this.modals.kind && !this.paused) {
        if (w.phase === 'dead') {
          this.deathT += dt;
          if (!this.deathShown) { this.deathShown = true; audio.play('death'); audio.stinger('defeat'); juiceDeath(this.fx); this.banner('퇴사 위기…', 'yageun death'); }
          if (this.deathT > 1.4) this.finishRun();
        } else if (w.phase !== 'play') {
          // 레벨업/상자 창은 아주 짧게 뜸을 들여 폭발·글자가 보이게 한다
          if (this.phaseDelay < 0) this.phaseDelay = w.phase === 'levelup' ? 0.18 : w.phase === 'chest' ? 0.3 : 0.05;
          this.phaseDelay -= dt;
          if (this.phaseDelay <= 0) {
            this.phaseDelay = -1;
            if (w.phase === 'levelup') this.hint('levelup');
            if (w.phase === 'lunch') this.hint('lunch');
            this.openPhaseModal();
          }
        }
      }
      // 콤보 감쇠
      if (this.comboT > 0 && !this.paused && w.phase === 'play') { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
      if (this.hud) this.hud.setCombo(this.combo);
      // 궁극기 첫 충전 힌트
      if (!this.ultHinted && w.player.ult >= w.player.ultMax) { this.ultHinted = true; this.hint('ult'); }
      if (this.world) {
        const live = !this.paused && w.phase === 'play';
        this.fx.update(dt);
        // 모달·일시정지 중에는 월드가 멈춰 있으니 3프레임에 한 번만 그린다
        this.frameN++;
        if (live || w.phase === 'dead' || this.phaseDelay >= 0 || this.fx.flash > 0 || this.frameN % 3 === 0) {
          this.renderer.live = live; this.renderer.demo = false;
          this.safeRender(w, dt, this.input.joy, this.stepsThisFrame);
        }
        this.hudT += dt;
        if (this.hud) this.hud.update(w);
      }
    } else if (this.idleWorld && this.screens.curName === 'title') {
      // 메뉴 배경: 자동 조종 데모 플레이(어트랙트 모드). 불투명한 다른 메뉴 화면 뒤에서는 돌리지 않는다.
      const iw = this.idleWorld;
      const n = this.demo ? this.stepDemo(iw, dt) : 0;
      this.fx.update(dt);
      this.renderer.live = true; this.renderer.demo = true;
      this.safeRender(this.idleWorld ?? iw, dt, null, n);
    }
    this.workAcc += performance.now() - t0;
  }

  debugState() {
    const w = this.world;
    return w ? { phase: w.phase, t: w.t, level: w.player.level, hp: w.player.hp, kills: w.stats_.kills, enemies: w.enemies.length, fps: this.fps, work: this.lastWork, quality: this.renderer.quality, dpr: this.renderer.dpr, weapons: w.weapons.map(x => `${x.def.id}:${x.level}`) } : null;
  }
}

export { BALANCE };
