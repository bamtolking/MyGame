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
import { Fx } from '../render/fx';
import { loadProfile, saveProfile, type Profile } from '../platform/save';
import { audio, vibrate } from '../platform/audio';
import { buildRunConfig, checkAttendance, dailyInfo, evaluateAchievements, settleRun } from '../meta/progress';
import { Input } from './input';
import { Hud } from './hud';
import { Modals } from './modals';
import { Screens } from './screens';
import { h, Toasts, setClickSound, confirmBox } from './dom';

const pickStr = (arr: readonly string[], f: string) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : f);

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
  paused = false;
  private acc = 0;
  private last = 0;
  private achT = 0;
  private hudT = 0;
  fps = 60;
  private slowSec = 0;
  private combo = 0;
  private comboT = 0;
  private comboBest = 0;
  private phaseDelay = -1;
  private ultHinted = false;
  private fpsAcc = 0; private fpsN = 0;
  private lastRunOpts: { char: string; stage: string; heat: number; daily: boolean } | null = null;
  private deathT = 0;
  private deathShown = false;
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
    setClickSound(() => audio.play('click'));
    const self = this;
    this.modals = new Modals({
      root: this.ui,
      pick: i => { if (self.world) { applyChoice(self.world, i); audio.play('buy'); self.afterModal(); } },
      reroll: () => { if (self.world && reroll(self.world)) self.modals.levelUp(self.world); },
      skip: () => { if (self.world && skipLevel(self.world)) self.afterModal(); },
      banish: i => { if (self.world && banish(self.world, i)) self.modals.levelUp(self.world); },
      closeChest: () => { if (self.world) { closeChest(self.world); self.afterModal(); } },
      lunch: id => { if (self.world) { applyLunch(self.world, id); audio.play('lunch'); self.afterModal(); } },
      resume: () => self.setPaused(false),
      quit: async () => {
        if (await confirmBox(self.ui, '조퇴하시겠습니까?', '지금까지 번 월급은 받고 판이 끝납니다.', '조퇴', '계속 일하기', true)) self.finishRun();
      },
      settings: () => {
        const el = self.screens.settings(() => { el.remove(); }, true);
      },
      overtime: () => { if (self.world) { continueOvertime(self.world); self.modals.close(); audio.play('boss'); } },
      goHome: () => self.finishRun(),
    });
    this.screens = new Screens({
      root: this.ui,
      get profile() { return self.profile; },
      save: () => this.save(),
      startRun: o => this.startRun(o),
      applySettings: () => this.applySettings(),
      show: () => {},
      replaceProfile: p => { this.profile = p; this.save(); this.applySettings(); },
    });
    this.applySettings();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.world && this.world.phase === 'play') this.setPaused(true); audio.suspend(); }
      else audio.resume();
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
    if (this.saveStatus === 'corrupt') this.toasts.show('저장 파일을 읽지 못해 새로 시작합니다', 'warn', 4000);
    const att = checkAttendance(this.profile);
    if (att) {
      this.save();
      setTimeout(() => {
        confirmBox(this.ui, `📅 출석 체크 ${att.day}일차`, `오늘도 출근해 주셨군요!\n출근 수당 ₩${att.coins} 지급 완료.\n(7일 주기, 7일차 보너스 두둑)`, '감사합니다', '닫기');
        audio.play('coin');
        this.screens.title();
      }, 400);
    }
    const g = evaluateAchievements(this.profile);
    if (g.length) { this.save(); for (const x of g) this.toasts.show(`🏆 ${x.a.name} — ${x.text}`, 'ach', 3500); }
  }

  private demo = true;
  private demoAcc = 0;
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

  private stepDemo(w: World, dt: number) {
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
      else { this.idleWorld = this.makeIdleWorld(); return; }
    }
    if (n >= 4) this.demoAcc = 0;
    // 데모 이벤트: 시각 효과만(소리·토스트 없음)
    for (const ev of w.events) {
      if (ev.t === 'kill') this.fx.burst(ev.x, ev.y, ENEMY.get(ev.id)?.tint ?? '#fff', ev.boss ? 30 : 4, 140, 3, 2, 260);
      else if (ev.t === 'explode') this.fx.boom(ev.x, ev.y, ev.r, ev.color, ev.big);
      else if (ev.t === 'chain') this.fx.bolt(ev.pts, ev.color);
      else if (ev.t === 'hit' && this.profile.settings.dmgNums) this.fx.dmg(ev.x, ev.y, ev.dmg, ev.crit, ev.uid);
    }
    w.events.length = 0;
    if (w.t > 420) this.idleWorld = this.makeIdleWorld();
  }

  save() {
    if (!saveProfile(this.profile)) this.toasts.show('⚠ 저장 실패 (브라우저 저장소를 확인하세요)', 'warn');
  }

  applySettings() {
    const s = this.profile.settings;
    audio.setVolumes(s.sfx, s.bgm);
    this.fx.shakeOn = s.shake;
    this.fx.showNums = s.dmgNums;
    if (this.renderer.low !== s.low) this.renderer.setLow(s.low);
    this.input.fixed = s.joystick === 'fixed';
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
    const di = o.daily ? dailyInfo(p) : null;
    const seed = di ? di.seed : (Math.random() * 2 ** 32) >>> 0;
    const cfg = buildRunConfig(p, { char: o.char, stage: o.stage, heat: o.heat, seed, modifiers: di?.modifiers, daily: o.daily });
    const w = createWorld(cfg);
    const [vw, vh] = this.renderer.viewSize();
    w.viewW = vw; w.viewH = vh;
    this.world = w;
    this.screens.close();
    this.modals.close();
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
    this.fx.parts.length = 0; this.fx.nums.length = 0;
    audio.unlock(); audio.startMusic(); audio.setIntensity(1);
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
    this.hud?.root.remove(); this.hud = null;
    this.tutorial?.remove(); this.tutorial = null;
    audio.setIntensity(0);
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

  togglePause() {
    const w = this.world;
    if (!w) return;
    if (this.modals.kind && this.modals.kind !== 'pause') return;
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
      case 'levelup': this.modals.levelUp(w); audio.play('levelup'); break;
      case 'chest': this.modals.chest(w); audio.play('item'); break;
      case 'lunch': this.modals.lunch(w); audio.play('lunch'); break;
      case 'victory': this.modals.victory(w); audio.play('clear'); this.confetti(); break;
    }
  }

  private confetti() {
    const c = h('div', { class: 'confetti' });
    const colors = ['#ffd84d', '#ff5a5f', '#3ddc97', '#4d9fff', '#a36bff'];
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

  private banner(text: string, cls: string, sub = '') {
    const b = h('div', { class: `banner ${cls}` }, text, sub ? h('small', null, sub) : null);
    this.ui.appendChild(b);
    setTimeout(() => b.remove(), 1900);
  }

  // ───────────── 이벤트 → 연출 ─────────────

  private handleEvents(w: World) {
    const fx = this.fx;
    const set = this.profile.settings;
    for (const ev of w.events) {
      switch (ev.t) {
        case 'hit': fx.dmg(ev.x, ev.y, ev.dmg, ev.crit, ev.uid); audio.play('hit'); break;
        case 'kill': {
          this.combo++; this.comboT = 1.3;
          if (this.combo > this.comboBest) this.comboBest = this.combo;
          if (this.combo === 100 || this.combo === 300 || this.combo === 700 || this.combo === 1500) {
            const shout = this.combo >= 1500 ? '전설의 일잘러!' : this.combo >= 700 ? '야근 각성!' : this.combo >= 300 ? '업무 폭주!' : '일 좀 하는데?';
            this.banner(`🔥 ${this.combo} 연속 처리`, 'lv', shout);
            audio.play('levelup');
          }
          this.hint('autoAttack');
          const def = ENEMY.get(ev.id);
          const col = def?.tint ?? '#ffffff';
          if (ev.boss) {
            fx.burst(ev.x, ev.y, '#ffd84d', 60, 420, 5, 2, 200); fx.burst(ev.x, ev.y, col, 40, 300, 4, 0);
            fx.addShake(0.9); fx.addFlash(0.6); audio.play('ult'); vibrate(set.vibrate, [60, 40, 120]);
            fx.text(ev.x, ev.y - 30, '격파!', '#ffd84d', 26, 1.6);
          } else if (ev.elite) {
            fx.burst(ev.x, ev.y, '#ffd84d', 26, 300, 4, 2, 200); fx.addShake(0.35); audio.play('explode');
          } else {
            fx.burst(ev.x, ev.y, col, 5, 140, 3, 2, 260);
            audio.play('kill');
          }
          break;
        }
        case 'hurt': fx.addShake(0.22); fx.addFlash(0.22, '#ff2244'); audio.play('hurt'); vibrate(set.vibrate, 25); break;
        case 'explode': fx.boom(ev.x, ev.y, ev.r, ev.color, ev.big); if (ev.big) { fx.addShake(0.3); audio.play('explode'); } break;
        case 'gem': audio.play('gem'); break;
        case 'coin': audio.play('coin'); break;
        case 'item': {
          audio.play('item');
          const p = w.player;
          const label: Record<string, string> = { coffee: '☕ 커피 수혈! +30', chicken: '🍗 치킨! 체력 완전 회복', magnet: '🧲 결재 도장 싹쓸이!', bomb: '💣 부서 대청소!', clock: '⏰ 시간 정지!', chest: '📦 택배 수령!' };
          if (label[ev.kind]) fx.text(p.x, p.y - 30, label[ev.kind], '#fff', 13, 1.3);
          if (ev.kind === 'bomb') { fx.addFlash(0.5, '#ffae00'); fx.addShake(0.5); }
          break;
        }
        case 'levelup': fx.text(w.player.x, w.player.y - 34, 'LEVEL UP!', '#7dffb3', 16, 1); fx.burst(w.player.x, w.player.y, '#7dffb3', 18, 200, 3, 1); break;
        case 'toast': this.toasts.show(ev.text, ev.kind ?? 'info'); if (ev.kind === 'warn' || ev.kind === 'boss') audio.play('toast'); break;
        case 'bossSpawn': this.banner(`⚠ ${ev.name} 등장 ⚠`, 'boss', ENEMY.get(ev.id)?.intro ?? ''); audio.play('boss'); audio.setIntensity(3); vibrate(set.vibrate, [100, 60, 100]); break;
        case 'bossDead': this.toasts.show(`🎉 ${ev.name} 격파!`, 'good', 3000); audio.setIntensity(w.t > 400 ? 2 : 1); break;
        case 'elite': this.hint('elite'); audio.play('elite'); this.toasts.show(`⚠ 엘리트 ${ev.name} 출현 — 처치하면 택배 상자!`, 'warn'); break;
        case 'ult': this.banner(ev.shout, 'ult'); fx.addFlash(0.7, '#ffffff'); fx.addShake(0.8); audio.play('ult'); vibrate(set.vibrate, [50, 30, 90]); break;
        case 'evolve': {
          const to = WEAPON.get(ev.to);
          this.toasts.show(`⭐ 진화! ${WEAPON.get(ev.from)?.name} → ${to?.name}`, 'ach', 3500);
          this.banner(`⭐ 진화! ${to?.icon ?? ''} ${to?.name ?? ''}`, 'ult', to?.desc ?? '');
          fx.addFlash(0.5, '#e4b8ff');
          fx.burst(w.player.x, w.player.y, '#e4b8ff', 40, 300, 4, 1);
          break;
        }
        case 'hour': {
          const msg = HOUR_MESSAGES[ev.hour];
          if (msg) this.toasts.show(msg, 'info');
          audio.play('chime');
          if (ev.hour === 15) audio.setIntensity(2);
          break;
        }
        case 'revive': fx.addFlash(0.8); this.banner('보험 처리!', 'lv', '다시 일어났다'); break;
        case 'chain': fx.bolt(ev.pts, ev.color); break;
        case 'yageun': this.hint('yageun'); this.banner('야근 확정', 'yageun', pickStr(YAGEUN_CONFIRMED, '보스를 잡아야 퇴근할 수 있습니다')); audio.play('boss'); break;
        case 'shoot': audio.play('shoot'); break;
        default: break;
      }
    }
    w.events.length = 0;
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
      this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0;
      // 동적 해상도: 전투 중 2초 연속 45fps 미만이면 해상도를 한 단계 낮춘다
      if (this.world && this.world.phase === 'play' && !this.paused && this.fps < 45) {
        this.slowSec++;
        if (this.slowSec >= 2 && this.renderer.dprCap > 1) {
          this.renderer.dprCap = Math.max(1, this.renderer.dprCap - 0.5);
          this.renderer.resize();
          this.slowSec = 0;
        }
      } else this.slowSec = 0;
    }

    const w = this.world;
    if (w) {
      const [mx, my] = this.input.vector();
      w.player.mx = mx; w.player.my = my;
      if (!this.paused && w.phase === 'play') {
        if (w.hitStop > 0) { w.hitStop -= dt; }
        else {
          const speed = w.flags.has('fastClock') ? 1.3 : 1;
          this.acc += dt * speed;
          let n = 0;
          while (this.acc >= DT && n < 8 && w.phase === 'play') { stepWorld(w); this.acc -= DT; n++; }
          if (n >= 8) this.acc = 0;
        }
        // 실시간 업적(1초마다)
        this.achT += dt;
        if (this.achT > 1) {
          this.achT = 0;
          const g = evaluateAchievements(this.profile, w);
          if (g.length) { this.save(); for (const x of g) { this.toasts.show(`🏆 업적 달성: ${x.a.name} — ${x.text}`, 'ach', 3500); audio.play('jackpot'); } }
          if (w.overtime) {
            const min = Math.floor(w.stats_.overtimeSec / 60);
            if (min > 0 && Math.floor((w.stats_.overtimeSec - 1) / 60) < min) this.toasts.show(pickStr(OVERTIME_MESSAGES, `야근 ${min}분째…`), 'warn');
          }
        }
      }
      this.handleEvents(w);
      // 단계 전환
      if (!this.modals.kind && !this.paused) {
        if (w.phase === 'dead') {
          this.deathT += dt;
          if (!this.deathShown) { this.deathShown = true; audio.play('death'); this.fx.addFlash(0.6, '#000000'); this.banner('퇴사 위기…', 'yageun'); }
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
        this.fx.update(dt);
        this.renderer.render(w, dt, this.input.joy);
        this.hudT += dt;
        if (this.hud) this.hud.update(w);
      }
    } else if (this.idleWorld) {
      // 메뉴 배경: 자동 조종 데모 플레이(어트랙트 모드)
      const iw = this.idleWorld;
      if (this.demo) this.stepDemo(iw, dt);
      this.fx.update(dt);
      this.renderer.render(iw, dt, null);
    }
  }

  debugState() {
    const w = this.world;
    return w ? { phase: w.phase, t: w.t, level: w.player.level, hp: w.player.hp, kills: w.stats_.kills, enemies: w.enemies.length, fps: this.fps, weapons: w.weapons.map(x => `${x.def.id}:${x.level}`) } : null;
  }
}

export { BALANCE };
