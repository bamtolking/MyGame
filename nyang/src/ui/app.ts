// 화면 흐름(타이틀·게임·일시정지·결과·도감·설정), 입력, 메인 루프.
import { CATS, MAX_TIER } from '../data/cats';
import { Game, NIP, POWERS, type GameEvent, type GameSnapshot, type Power } from '../sim/game';
import { chooseX } from '../sim/bot';
import { makeRng, range, weighted } from '../sim/rng';
import { makeBody } from '../sim/physics';
import { dailyInfo, msUntilTomorrow, type DailyInfo } from '../sim/daily';
import { Renderer } from '../render/renderer';
import { drawPortrait, type Mood } from '../render/catdraw';
import { Sound } from '../platform/audio';
import { loadProfile, saveProfile, loadRun, saveRun, clearRun, resetAll, defaultProfile, type Profile } from '../platform/storage';
import { shareText, vibrate, type ShareResult } from '../platform/share';
import { ICON } from './icons';

const STEP = 1 / 60;
type Mode = 'title' | 'play' | 'pause' | 'over' | 'revive' | 'results';

const POWER_INFO: Record<Power, { name: string; icon: string; desc: string }> = {
  punch: { name: '냥펀치', icon: ICON.paw, desc: '고른 고양이 한 마리를 상자 밖으로 내보내요.' },
  liquify: { name: '액체화', icon: ICON.drop, desc: '4.5초 동안 모두 말랑하게 녹아 작아지고, 같은 고양이끼리 끌어당겨요.' },
  shake: { name: '흔들기', icon: ICON.box, desc: '상자를 흔들어 고양이들이 자리를 다시 잡게 해요.' },
};

const TIPS = {
  small: '같은 고양이가 옆에 오도록 떨어뜨려 보세요. 작은 고양이가 큰 고양이 사이에 갇히면 합치기 어려워요.',
  powers: '능력을 한 번도 안 썼어요! 액체화는 떨어져 있는 같은 고양이를 끌어모아 줘요.',
  combo: '합체로 커진 고양이가 바로 옆의 같은 고양이에 닿으면 연쇄 콤보! 점수가 최대 4배가 돼요.',
  corner: '큰 고양이를 한쪽 구석에 크기 순서대로 모아 두면 연쇄가 잘 터져요.',
};

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export class App {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: Renderer;
  readonly sound = new Sound();
  profile: Profile;
  mode: Mode = 'title';
  game: Game | null = null;
  demo: Game;
  fps = 60;
  saveOk = true;
  private demoRng = makeRng(Date.now() >>> 0);
  private demoWait = 1;
  private acc = 0;
  private last = 0;
  private aiming = false;
  private pendingDrop = 0;
  private keyDir = 0;
  private shownScore = 0;
  private nextShown = -99;
  private saveTimer = 0;
  private lastDangerBuzz = 0;
  private hintEl: HTMLElement | null = null;
  private toastQ: Array<{ html: string; ms: number }> = [];
  private toastBusy = false;
  private wakeLock: any = null;
  private overTimer = 0;
  private newBest = false;
  private cardCanvas: HTMLCanvasElement | null = null;
  private countdownTimer = 0;

  private hud!: HTMLElement;
  private title!: HTMLElement;
  private sheet!: HTMLElement;
  private scoreEl!: HTMLElement;
  private bestEl!: HTMLElement;
  private nextCv!: HTMLCanvasElement;
  private gaugeEl!: HTMLElement;
  private gaugeFill!: HTMLElement;
  private powerBtns = new Map<Power, HTMLButtonElement>();

  constructor(readonly root: HTMLElement) {
    this.profile = loadProfile();
    this.canvas = el<HTMLCanvasElement>('<canvas id="cv" aria-label="고양이 상자"></canvas>');
    root.appendChild(this.canvas);
    this.renderer = new Renderer(this.canvas);
    this.demo = this.newDemo();
    this.buildHud();
    this.title = el('<div id="title"></div>');
    root.appendChild(this.title);
    this.sheet = el('<div id="sheet" class="sheet" hidden></div>');
    root.appendChild(this.sheet);
    this.applySettings();
    this.bindInput();
    this.showTitle();
    document.fonts?.load?.("20px 'Jua'").then(() => { this.renderer.resize(); }).catch(() => {});
    requestAnimationFrame(t => { this.last = t; this.loop(t); });
  }

  // ── 화면 구성 ─────────────────────────────────────────────

  private buildHud(): void {
    this.hud = el(`
      <div id="hud" hidden>
        <div class="hud-top">
          <button class="icon-btn" id="btn-pause" aria-label="일시정지">${ICON.pause}</button>
          <div class="score-box">
            <div class="score outline-text" id="score">0</div>
            <div class="best" id="best">최고 0</div>
          </div>
          <div class="next-box" aria-label="다음 고양이"><canvas id="next" width="60" height="52"></canvas>다음</div>
        </div>
        <div class="gauge" id="gauge" role="progressbar" aria-label="츄르 게이지"><div class="gauge-fill" id="gauge-fill"></div><div class="gauge-label">츄르 게이지</div></div>
        <div class="hud-bottom">
          ${POWERS.map(p => `<button class="power" data-power="${p}" aria-label="${POWER_INFO[p].name}">${POWER_INFO[p].icon}<span>${POWER_INFO[p].name}</span><b class="count">1</b></button>`).join('')}
        </div>
      </div>`);
    this.root.appendChild(this.hud);
    this.scoreEl = this.hud.querySelector('#score')!;
    this.bestEl = this.hud.querySelector('#best')!;
    this.nextCv = this.hud.querySelector('#next')!;
    this.gaugeEl = this.hud.querySelector('#gauge')!;
    this.gaugeFill = this.hud.querySelector('#gauge-fill')!;
    this.hud.querySelector('#btn-pause')!.addEventListener('click', () => { this.sound.tap(); this.pause(); });
    this.hud.querySelectorAll<HTMLButtonElement>('.power').forEach(b => {
      const p = b.dataset.power as Power;
      this.powerBtns.set(p, b);
      b.addEventListener('click', () => this.usePower(p));
    });
  }

  showTitle(): void {
    this.mode = 'title';
    this.game = null;
    this.renderer.targeting = false;
    this.hud.hidden = true;
    this.closeSheet();
    this.setHint(null);
    this.releaseWake();
    const d = dailyInfo();
    const done = this.profile.daily[d.key];
    const run = this.validRun();
    const dex = this.profile.dex.filter(x => x > 0).length;
    const stars = '★'.repeat(d.mod.level) + '☆'.repeat(3 - d.mod.level);
    const dailyRun = run && run.mode === 'daily';
    const classicRun = run && run.mode === 'classic';
    this.title.innerHTML = `
      <div class="logo">
        <h1 class="outline-text"><span>냥</span><span>체</span><span>역</span><span>학</span></h1>
        <div class="tag">고양이는 액체다</div>
      </div>
      <div class="title-menu">
        ${classicRun ? `<button class="btn big" id="t-continue">${ICON.play}이어하기 <span class="sub">&nbsp;${fmt(run!.score)}점</span></button>` : ''}
        <button class="btn ${classicRun ? 'plain' : 'big'}" id="t-play">${classicRun ? '새 게임' : `${ICON.play}게임 시작`}</button>
        <button class="btn mint daily" id="t-daily">
          <span>${done ? `오늘의 상자 완료 · ${fmt(done.score)}점` : dailyRun ? '오늘의 상자 이어하기' : `오늘의 상자 #${d.no}`}</span>
          <span class="sub">${d.mod.name} ${stars}</span>
        </button>
        <div class="row">
          <button class="btn sky small" id="t-dex">${ICON.book}도감 ${dex}/${CATS.length}</button>
          <button class="btn plain small" id="t-settings">${ICON.gear}설정</button>
        </div>
        ${this.profile.best > 0 ? `<div class="best-line">최고 기록 <b>${fmt(this.profile.best)}</b>점</div>` : ''}
      </div>`;
    this.title.hidden = false;
    const on = (id: string, f: () => void) => this.title.querySelector('#' + id)?.addEventListener('click', () => { this.sound.unlock(); this.sound.tap(); f(); });
    on('t-continue', () => this.startGame('classic', run!));
    on('t-play', () => { if (classicRun) clearRun(); this.startGame('classic'); });
    on('t-daily', () => dailyRun ? this.startGame('daily', run!) : done ? this.showDailyDone(d) : this.showDailyIntro(d));
    on('t-dex', () => this.showDex());
    on('t-settings', () => this.showSettings());
    this.layoutInsets();
  }

  private validRun(): GameSnapshot | null {
    const run = loadRun();
    if (!run || run.v !== 1) return null;
    if (run.mode === 'daily' && run.dateKey !== dailyInfo().key) { clearRun(); return null; }
    try { Game.restore(run); } catch { clearRun(); return null; }
    return run;
  }

  private layoutInsets(): void {
    const h = this.root.clientHeight;
    if (this.mode === 'title') {
      const logo = this.title.querySelector('.logo')?.getBoundingClientRect();
      const menu = this.title.querySelector('.title-menu')?.getBoundingClientRect();
      const landscape = this.root.clientWidth > h * 1.2;
      if (landscape) this.renderer.setInsets(8, 8);
      else this.renderer.setInsets(logo ? logo.bottom - 6 : 140, menu ? h - menu.top + 2 : 220);
    } else {
      const g = this.gaugeEl.getBoundingClientRect();
      const b = this.hud.querySelector('.hud-bottom')!.getBoundingClientRect();
      const landscape = this.root.clientWidth > h * 1.2;
      this.renderer.setInsets(g.bottom + 2, landscape ? 8 : h - b.top + 4);
    }
  }

  // ── 게임 시작/종료 ─────────────────────────────────────────

  startGame(kind: 'classic' | 'daily', resume?: GameSnapshot): void {
    this.closeSheet();
    let g: Game;
    if (resume) {
      try { g = Game.restore(resume); } catch { clearRun(); g = this.freshGame(kind); }
    } else {
      g = this.freshGame(kind);
    }
    this.game = g;
    this.mode = 'play';
    this.newBest = false;
    this.shownScore = g.score;
    this.nextShown = -99;
    this.acc = 0;
    this.pendingDrop = 0;
    this.renderer.targeting = false;
    this.renderer.fx.list.length = 0;
    this.title.hidden = true;
    this.hud.hidden = false;
    this.hud.querySelector('.best')!.innerHTML = g.mode === 'daily' ? `<span class="mode-chip">오늘의 상자 · ${dailyInfo().mod.name}</span>` : `최고 ${fmt(this.profile.best)}`;
    this.layoutInsets();
    this.updateHud(true);
    this.requestWake();
    this.save();
    if (!(this.profile.tutorial & 1)) this.setHint('화면을 끌어서 위치를 정하고, 손을 떼면 떨어져요');
  }

  private freshGame(kind: 'classic' | 'daily'): Game {
    if (kind === 'daily') {
      const d = dailyInfo();
      return new Game({ mode: 'daily', seed: d.seed, mods: [d.mod.id], dateKey: d.key });
    }
    return new Game({ mode: 'classic', seed: (Math.random() * 2 ** 32) >>> 0 });
  }

  private newDemo(): Game {
    const g = new Game({ mode: 'classic', seed: (Math.random() * 2 ** 32) >>> 0 });
    // 데모는 몇 마리 깔고 시작
    const rng = makeRng(g.seed);
    for (let i = 0; i < 26; i++) {
      g.aim(chooseX(g, rng, 1)); g.cooldown = 0; g.drop();
      for (let k = 0; k < 24; k++) g.update(STEP);
      if (g.over) break;
    }
    for (let k = 0; k < 90; k++) g.update(STEP);
    g.events.length = 0;
    return g;
  }

  private onGameOver(): void {
    const g = this.game!;
    this.mode = 'over';
    this.aiming = false;
    this.renderer.targeting = false;
    this.setHint(null);
    this.sound.over();
    this.haptic([60, 40, 90]);
    clearTimeout(this.overTimer);
    this.overTimer = window.setTimeout(() => { if (!g.revived) this.showRevive(); else this.finish(); }, 1100);
  }

  private showRevive(): void {
    const g = this.game!;
    this.mode = 'revive';
    this.openSheet(`
      <div class="card">
        <canvas id="rv-cat" style="width:120px;height:120px;display:block;margin:0 auto"></canvas>
        <h2>앗, 상자가 넘쳤다!</h2>
        <p>집사 찬스를 쓰면 위쪽 고양이들을 치우고<br>이어서 할 수 있어요. (한 판에 한 번)</p>
        <div class="stack">
          <button class="btn gold big" id="rv-yes">${ICON.heart}집사 찬스!</button>
          <button class="btn plain" id="rv-no">결과 보기 · ${fmt(g.score)}점</button>
        </div>
      </div>`);
    drawPortrait(this.sheet.querySelector('#rv-cat')!, Math.max(1, Math.min(g.stats.maxTier, 6)), { mood: 'scared' });
    this.sheet.querySelector('#rv-yes')!.addEventListener('click', () => {
      this.sound.tap();
      if (g.revive()) {
        this.closeSheet();
        this.mode = 'play';
        this.renderer.onEvents(g.events.splice(0), g);
        this.sound.purr();
        this.save();
      }
    });
    this.sheet.querySelector('#rv-no')!.addEventListener('click', () => { this.sound.tap(); this.finish(); });
  }

  /** 판 종료: 기록 반영 후 결과 화면 */
  private finish(): void {
    const g = this.game!;
    const p = this.profile;
    this.newBest = g.mode === 'classic' && g.score > p.best;
    if (this.newBest) p.best = g.score;
    p.games++;
    p.maxCombo = Math.max(p.maxCombo, g.stats.maxCombo);
    if (g.mode === 'daily' && !p.daily[g.dateKey]) {
      p.daily[g.dateKey] = { score: g.score, maxTier: g.stats.maxTier, maxCombo: g.stats.maxCombo, drops: g.stats.drops, mod: g.mods[0] ?? 'plain' };
    }
    this.saveOk = saveProfile(p);
    clearRun();
    this.showResults();
  }

  private showResults(): void {
    const g = this.game!;
    this.mode = 'results';
    if (this.newBest) this.sound.record();
    const top = Math.max(0, g.stats.maxTier);
    const d = g.mode === 'daily' ? dailyInfo(new Date(g.dateKey + 'T12:00:00')) : null;
    let tip = TIPS.corner;
    if (top < 5) tip = TIPS.small;
    else if (g.stats.powersUsed === 0) tip = TIPS.powers;
    else if (g.stats.maxCombo < 3) tip = TIPS.combo;
    const mins = Math.floor(g.time / 60), secs = Math.floor(g.time % 60);
    this.openSheet(`
      <div class="card">
        <h2>${d ? `오늘의 상자 #${d.no} 완료!` : '상자가 넘쳤다!'}</h2>
        ${d ? `<p>${d.mod.name} · 내일 새 상자가 와요</p>` : ''}
        <div class="big-score outline-text" id="rs-score">0</div>
        <p>점</p>
        ${this.newBest ? '<span class="ribbon">최고 기록!</span>' : ''}
        <div class="stats">
          <div class="stat cat"><canvas id="rs-cat"></canvas><div><span>가장 큰 고양이</span><b>${CATS[top].name}</b></div></div>
          <div class="stat"><span>최대 콤보</span><b>${g.stats.maxCombo}</b></div>
          <div class="stat"><span>합체</span><b>${fmt(g.stats.merges)}번</b></div>
          <div class="stat"><span>떨어뜨린 고양이</span><b>${fmt(g.stats.drops)}마리</b></div>
          <div class="stat"><span>플레이 시간</span><b>${mins}분 ${secs}초</b></div>
        </div>
        <img class="share-preview" id="rs-card" alt="결과 카드">
        <p class="tip">${tip}</p>
        ${this.saveOk ? '' : '<p class="tip">이 기기에서는 기록을 저장할 수 없어요. (브라우저 저장소가 막혀 있음)</p>'}
        <div class="stack">
          <button class="btn mint big" id="rs-share">${ICON.share}결과 공유하기</button>
          <div class="row2">
            <button class="btn small" id="rs-again">${ICON.retry}${d ? '클래식 하기' : '다시 하기'}</button>
            <button class="btn plain small" id="rs-home">${ICON.home}처음으로</button>
          </div>
        </div>
      </div>`);
    drawPortrait(this.sheet.querySelector('#rs-cat')!, top, { mood: 'happy' });
    this.countUp(this.sheet.querySelector('#rs-score')!, g.score);
    const card = this.makeCard(g, d);
    this.cardCanvas = card;
    (this.sheet.querySelector('#rs-card') as HTMLImageElement).src = card.toDataURL('image/png');
    this.sheet.querySelector('#rs-share')!.addEventListener('click', () => this.share(this.shareMessage(g, d), card));
    this.sheet.querySelector('#rs-again')!.addEventListener('click', () => { this.sound.tap(); this.startGame('classic'); });
    this.sheet.querySelector('#rs-home')!.addEventListener('click', () => { this.sound.tap(); this.showTitle(); });
  }

  private makeCard(g: Game, d: DailyInfo | null): HTMLCanvasElement {
    return this.renderer.renderCard(g, {
      title: d ? `오늘의 상자 #${d.no} · ${d.mod.name}` : '클래식',
      score: fmt(g.score),
      sub: `가장 큰 고양이: ${CATS[g.stats.maxTier].name}\n최대 콤보 ${g.stats.maxCombo} · 합체 ${g.stats.merges}번`,
      best: this.newBest,
    });
  }

  private shareMessage(g: { score: number; stats: { maxTier: number; maxCombo: number } }, d: DailyInfo | null): string {
    const bar = CATS.map((_, i) => i <= g.stats.maxTier ? '🐾' : '▫️').join('');
    const cat = CATS[g.stats.maxTier].name;
    if (d) return `냥체역학 오늘의 상자 #${d.no} · ${d.mod.name}\n${fmt(g.score)}점 · 최대 ${g.stats.maxCombo}콤보\n${bar} ${cat}`;
    return `냥체역학에서 ${fmt(g.score)}점!\n${cat}까지 키웠어요 · 최대 ${g.stats.maxCombo}콤보\n${bar}`;
  }

  private async share(text: string, image?: HTMLCanvasElement): Promise<void> {
    this.sound.tap();
    const r: ShareResult = await shareText(text, image);
    if (r === 'copied') this.toast('결과를 복사했어요. 친구에게 붙여넣어 보내세요!');
    else if (r === 'failed') {
      // 복사도 막힌 환경: 직접 선택해서 복사할 수 있게 보여 준다
      const box = el<HTMLTextAreaElement>(`<textarea class="copybox" readonly aria-label="공유할 결과"></textarea>`);
      box.value = text;
      const card = this.sheet.querySelector('.card');
      if (card && !card.querySelector('.copybox')) card.querySelector('.stack')?.before(box);
      box.focus(); box.select();
      this.toast('아래 글을 길게 눌러 복사하세요');
    }
  }

  private countUp(node: HTMLElement, target: number): void {
    const t0 = performance.now();
    const dur = Math.min(1400, 400 + target / 30);
    const f = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      node.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && node.isConnected) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  // ── 오늘의 상자 ─────────────────────────────────────────

  private showDailyIntro(d: DailyInfo): void {
    const stars = '★'.repeat(d.mod.level) + '☆'.repeat(3 - d.mod.level);
    this.openSheet(`
      <div class="card">
        <h2>오늘의 상자 #${d.no}</h2>
        <p>오늘은 모든 집사가 같은 순서로 고양이를 받아요.<br>기록은 하루에 한 판만 남아요.</p>
        <div class="daily-card">
          <div class="mod">${d.mod.name}</div>
          <div class="stars" aria-label="난이도 ${d.mod.level}">${stars}</div>
          <p>${d.mod.desc}</p>
        </div>
        <div class="stack">
          <button class="btn mint big" id="dl-go">${ICON.play}시작!</button>
          <button class="btn plain small" id="dl-back">나중에</button>
        </div>
      </div>`);
    this.sheet.querySelector('#dl-go')!.addEventListener('click', () => { this.sound.tap(); this.startGame('daily'); });
    this.sheet.querySelector('#dl-back')!.addEventListener('click', () => { this.sound.tap(); this.closeSheet(); });
  }

  private showDailyDone(d: DailyInfo): void {
    const r = this.profile.daily[d.key];
    this.openSheet(`
      <div class="card">
        <h2>오늘의 상자 #${d.no}</h2>
        <p>${d.mod.name} · 오늘 기록</p>
        <div class="big-score outline-text">${fmt(r.score)}</div>
        <p>가장 큰 고양이 ${CATS[r.maxTier].name} · 최대 ${r.maxCombo}콤보</p>
        <div class="daily-card"><p>다음 상자까지</p><div class="mod countdown" id="dd-cd"></div></div>
        <div class="stack">
          <button class="btn mint big" id="dd-share">${ICON.share}기록 공유하기</button>
          <button class="btn plain small" id="dd-back">닫기</button>
        </div>
      </div>`);
    const cd = this.sheet.querySelector('#dd-cd')!;
    const tick = () => {
      const ms = msUntilTomorrow();
      const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
      cd.textContent = `${h}시간 ${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`;
    };
    tick();
    clearInterval(this.countdownTimer);
    this.countdownTimer = window.setInterval(() => { if (!cd.isConnected) clearInterval(this.countdownTimer); else tick(); }, 1000);
    this.sheet.querySelector('#dd-share')!.addEventListener('click', () => this.share(this.shareMessage({ score: r.score, stats: { maxTier: r.maxTier, maxCombo: r.maxCombo } }, d)));
    this.sheet.querySelector('#dd-back')!.addEventListener('click', () => { this.sound.tap(); this.closeSheet(); });
  }

  // ── 도감 / 설정 / 방법 ────────────────────────────────────

  showDex(): void {
    const dex = this.profile.dex;
    const found = dex.filter(x => x > 0).length;
    this.openSheet(`
      <div class="card">
        <h2>고양이 도감</h2>
        <div class="progress-line">발견 ${found} / ${CATS.length}</div>
        <div class="chain">${CATS.map((_, i) => `<canvas data-chain="${i}"></canvas>`).join('')}</div>
        <div class="dex-grid">
          ${CATS.map((c, i) => `<button class="dex-item ${dex[i] ? '' : 'locked'}" data-tier="${i}"><canvas></canvas>${dex[i] ? c.name : '???'}<small>${dex[i] ? `${fmt(dex[i])}번 만남` : '미발견'}</small></button>`).join('')}
          <div class="dex-item"><canvas id="dex-nip"></canvas>캣닢 공<small>닿으면 한 단계 업</small></div>
        </div>
        <div class="stack"><button class="btn plain small" id="dx-close">닫기</button></div>
      </div>`);
    this.sheet.querySelectorAll<HTMLCanvasElement>('[data-chain]').forEach(cv => {
      const i = Number(cv.dataset.chain);
      drawPortrait(cv, i, { silhouette: !dex[i], pad: 0.1 });
    });
    this.sheet.querySelectorAll<HTMLButtonElement>('.dex-item[data-tier]').forEach(b => {
      const i = Number(b.dataset.tier);
      drawPortrait(b.querySelector('canvas')!, i, { silhouette: !dex[i] });
      b.addEventListener('click', () => { if (dex[i]) { this.sound.tap(); this.showDexDetail(i); } });
    });
    drawPortrait(this.sheet.querySelector('#dex-nip')!, NIP);
    this.sheet.querySelector('#dx-close')!.addEventListener('click', () => { this.sound.tap(); this.closeSheet(); });
  }

  private showDexDetail(i: number): void {
    const c = CATS[i];
    this.openSheet(`
      <div class="card dex-detail">
        <canvas id="dd-cat"></canvas>
        <h2>${c.name}</h2>
        <div class="en">${c.en} · ${i + 1}단계</div>
        <p style="margin-top:10px">${c.desc}</p>
        <p class="tip">${i < MAX_TIER ? `${c.name} 두 마리가 만나면 ${CATS[i + 1].name}!` : '우주뚱냥 두 마리가 만나면 우주로 승천하며 큰 보너스를 줘요.'}<br>지금까지 ${fmt(this.profile.dex[i])}번 만났어요.</p>
        <div class="stack"><button class="btn plain small" id="dd-back">도감으로</button></div>
      </div>`);
    const cv = this.sheet.querySelector<HTMLCanvasElement>('#dd-cat')!;
    const moods: Mood[] = ['idle', 'happy', i === 8 ? 'grumpy' : 'idle', 'sleep'];
    let k = 0;
    const draw = () => drawPortrait(cv, i, { mood: moods[k % moods.length], t: k });
    draw();
    cv.addEventListener('click', () => { k++; this.sound.meow(i, 'short'); draw(); });
    this.sheet.querySelector('#dd-back')!.addEventListener('click', () => { this.sound.tap(); this.showDex(); });
  }

  showSettings(): void {
    const s = this.profile.settings;
    const row = (id: string, label: string, on: boolean) => `<div class="setting"><span id="${id}-l">${label}</span><button class="toggle" id="${id}" role="switch" aria-checked="${on}" aria-labelledby="${id}-l"></button></div>`;
    this.openSheet(`
      <div class="card">
        <h2>설정</h2>
        ${row('st-sfx', '효과음', s.sfx)}
        ${row('st-bgm', '배경음악', s.bgm)}
        ${row('st-vib', '진동', s.vib)}
        ${row('st-lite', '효과 줄이기 (배터리 절약)', s.lite)}
        <div class="stack">
          <button class="btn sky small" id="st-how">게임 방법</button>
          <button class="btn plain small" id="st-reset">기록 초기화</button>
          <button class="btn small" id="st-close">닫기</button>
        </div>
        <p class="credits">냥체역학 v0.9 · 글꼴: 주아체 (SIL OFL) · 모든 그림과 소리는 코드로 그리고 합성했어요.</p>
      </div>`);
    const bind = (id: string, key: keyof Profile['settings']) => {
      const b = this.sheet.querySelector<HTMLButtonElement>('#' + id)!;
      b.addEventListener('click', () => {
        s[key] = !s[key];
        b.setAttribute('aria-checked', String(s[key]));
        this.applySettings();
        saveProfile(this.profile);
        this.sound.unlock(); this.sound.tap();
      });
    };
    bind('st-sfx', 'sfx'); bind('st-bgm', 'bgm'); bind('st-vib', 'vib'); bind('st-lite', 'lite');
    this.sheet.querySelector('#st-how')!.addEventListener('click', () => { this.sound.tap(); this.showHowTo(() => this.showSettings()); });
    this.sheet.querySelector('#st-reset')!.addEventListener('click', () => { this.sound.tap(); this.confirmReset(); });
    this.sheet.querySelector('#st-close')!.addEventListener('click', () => { this.sound.tap(); this.backFromSheet(); });
  }

  private confirmReset(): void {
    this.openSheet(`
      <div class="card">
        <h2>기록을 지울까요?</h2>
        <p>최고 기록, 도감, 오늘의 상자 기록이 모두 사라져요. 되돌릴 수 없어요.</p>
        <div class="stack">
          <button class="btn" id="rs-yes">모두 지우기</button>
          <button class="btn plain small" id="rs-no">취소</button>
        </div>
      </div>`);
    this.sheet.querySelector('#rs-yes')!.addEventListener('click', () => {
      resetAll();
      const settings = this.profile.settings;
      this.profile = { ...defaultProfile(), settings };
      saveProfile(this.profile);
      this.toast('기록을 지웠어요');
      this.showTitle();
    });
    this.sheet.querySelector('#rs-no')!.addEventListener('click', () => { this.sound.tap(); this.showSettings(); });
  }

  showHowTo(back: () => void): void {
    this.openSheet(`
      <div class="card">
        <h2>게임 방법</h2>
        <div class="howto">
          <div class="step"><canvas data-t="1"></canvas><div><b>끌어서 조준, 떼면 쏙</b>화면을 좌우로 끌어 위치를 정하고 손을 떼면 고양이가 떨어져요.</div></div>
          <div class="step"><canvas data-t="2"></canvas><div><b>같은 고양이끼리 합체</b>같은 고양이 두 마리가 닿으면 한 단계 큰 고양이가 돼요. 목표는 우주뚱냥!</div></div>
          <div class="step">${ICON.warn}<div><b>상자 밖으로 삐져나오면 끝</b>점선 위로 2초 넘게 나와 있으면 상자가 넘쳐요.</div></div>
          <div class="step"><canvas data-t="-1"></canvas><div><b>캣닢 공</b>처음 닿은 고양이를 한 단계 키워 줘요.</div></div>
          ${POWERS.map(p => `<div class="step">${POWER_INFO[p].icon}<div><b>${POWER_INFO[p].name}</b>${POWER_INFO[p].desc}</div></div>`).join('')}
          <div class="step">${ICON.heart}<div><b>츄르 게이지</b>점수를 얻으면 차오르고, 가득 차면 능력이 하나 충전돼요.</div></div>
        </div>
        <div class="stack"><button class="btn small" id="ht-back">알겠어요</button></div>
      </div>`);
    this.sheet.querySelectorAll<HTMLCanvasElement>('canvas[data-t]').forEach(cv => drawPortrait(cv, Number(cv.dataset.t), { mood: 'happy', pad: 0.12 }));
    this.sheet.querySelector('#ht-back')!.addEventListener('click', () => { this.sound.tap(); back(); });
  }

  private backFromSheet(): void {
    if (this.mode === 'pause') this.showPause();
    else this.closeSheet();
  }

  // ── 일시정지 ─────────────────────────────────────────────

  pause(): void {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    this.aiming = false;
    this.renderer.targeting = false;
    this.save();
    this.showPause();
  }

  private showPause(): void {
    const g = this.game!;
    this.openSheet(`
      <div class="card">
        <h2>잠깐 쉬는 중</h2>
        <p>${g.mode === 'daily' ? '오늘의 상자' : '클래식'} · ${fmt(g.score)}점 · 진행 상황은 자동 저장돼요</p>
        <div class="stack">
          <button class="btn big" id="ps-go">${ICON.play}계속하기</button>
          <div class="row2">
            <button class="btn sky small" id="ps-how">게임 방법</button>
            <button class="btn plain small" id="ps-set">${ICON.gear}설정</button>
          </div>
          ${g.mode === 'classic' ? `<button class="btn plain small" id="ps-restart">${ICON.retry}새로 시작</button>` : ''}
          <button class="btn plain small" id="ps-home">${ICON.home}처음으로</button>
        </div>
      </div>`);
    this.sheet.querySelector('#ps-go')!.addEventListener('click', () => { this.sound.tap(); this.resume(); });
    this.sheet.querySelector('#ps-how')!.addEventListener('click', () => { this.sound.tap(); this.showHowTo(() => this.showPause()); });
    this.sheet.querySelector('#ps-set')!.addEventListener('click', () => { this.sound.tap(); this.showSettings(); });
    this.sheet.querySelector('#ps-restart')?.addEventListener('click', () => { this.sound.tap(); clearRun(); this.startGame('classic'); });
    this.sheet.querySelector('#ps-home')!.addEventListener('click', () => { this.sound.tap(); this.save(); this.showTitle(); });
  }

  resume(): void {
    if (this.mode !== 'pause') return;
    this.closeSheet();
    this.mode = 'play';
    this.acc = 0;
    this.sound.resume();
  }

  // ── 시트 / 토스트 / 힌트 ──────────────────────────────────

  private openSheet(html: string): void {
    this.sheet.innerHTML = html;
    this.sheet.hidden = false;
    (this.sheet.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  private closeSheet(): void {
    this.sheet.hidden = true;
    this.sheet.innerHTML = '';
    clearInterval(this.countdownTimer);
  }

  toast(text: string, tier?: number, sub?: string): void {
    const html = tier != null
      ? `<div class="toast"><canvas></canvas><div>${text}${sub ? `<small>${sub}</small>` : ''}</div></div>`
      : `<div class="toast text-only">${text}</div>`;
    this.toastQ.push({ html, ms: tier != null ? 2400 : 2000 });
    if (!this.toastBusy) this.nextToast(tier);
  }

  private nextToast(tier?: number): void {
    const item = this.toastQ.shift();
    if (!item) { this.toastBusy = false; return; }
    this.toastBusy = true;
    const node = el(item.html);
    this.root.appendChild(node);
    const cv = node.querySelector('canvas');
    if (cv) drawPortrait(cv, tier ?? 0, { mood: 'happy', pad: 0.1 });
    setTimeout(() => { node.remove(); this.nextToast(); }, item.ms);
  }

  private setHint(text: string | null): void {
    if (!text) { this.hintEl?.remove(); this.hintEl = null; return; }
    if (!this.hintEl) {
      this.hintEl = el(`<div class="hint" role="status"></div>`);
      this.hud.appendChild(this.hintEl);
    }
    this.hintEl.textContent = text;
  }

  // ── 설정 적용 / 기기 ─────────────────────────────────────

  private applySettings(): void {
    const s = this.profile.settings;
    this.sound.setSfx(s.sfx);
    this.sound.setBgm(s.bgm);
    this.renderer.lite = s.lite;
    this.renderer.reduceMotion = s.lite || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }

  private haptic(p: number | number[]): void {
    if (this.profile.settings.vib) vibrate(p);
  }

  private async requestWake(): Promise<void> {
    try { this.wakeLock = await (navigator as any).wakeLock?.request('screen'); } catch { this.wakeLock = null; }
  }

  private releaseWake(): void {
    try { this.wakeLock?.release(); } catch { /* 무시 */ }
    this.wakeLock = null;
  }

  private save(): void {
    if (!this.game || this.game.over) return;
    saveRun(this.game.snapshot());
  }

  // ── 입력 ─────────────────────────────────────────────────

  private bindInput(): void {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => {
      this.sound.unlock();
      if (this.mode !== 'play' || !this.game) return;
      const w = this.renderer.toWorld(e.clientX, e.clientY);
      if (this.renderer.targeting) {
        const b = this.renderer.pickBody(this.game, w.x, w.y);
        if (b) this.game.punch(b.id); else this.toast('취소했어요');
        this.setTargeting(false);
        this.processEvents(this.game.events.splice(0));
        return;
      }
      this.aiming = true;
      try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
      this.game.aim(w.x);
    });
    cv.addEventListener('pointermove', e => {
      if (this.mode !== 'play' || !this.game) return;
      const w = this.renderer.toWorld(e.clientX, e.clientY);
      if (this.renderer.targeting) { this.renderer.hoverId = this.renderer.pickBody(this.game, w.x, w.y)?.id ?? -1; return; }
      if (this.aiming || e.pointerType === 'mouse') this.game.aim(w.x);
    });
    const up = () => {
      if (!this.aiming) return;
      this.aiming = false;
      this.tryDrop();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { this.aiming = false; });
    window.addEventListener('keydown', e => {
      if (this.mode === 'play') {
        if (e.key === 'ArrowLeft' || e.key === 'a') this.keyDir = -1;
        else if (e.key === 'ArrowRight' || e.key === 'd') this.keyDir = 1;
        else if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); this.sound.unlock(); this.tryDrop(); }
        else if (e.key === 'Escape' || e.key === 'p') this.pause();
        else if (e.key === '1' || e.key === '2' || e.key === '3') this.usePower(POWERS[Number(e.key) - 1]);
      } else if (this.mode === 'pause' && (e.key === 'Escape' || e.key === 'p')) this.resume();
    });
    window.addEventListener('keyup', e => {
      if ((e.key === 'ArrowLeft' || e.key === 'a') && this.keyDir < 0) this.keyDir = 0;
      if ((e.key === 'ArrowRight' || e.key === 'd') && this.keyDir > 0) this.keyDir = 0;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.mode === 'play') this.pause();
        this.save();
        this.sound.suspend();
      } else {
        this.sound.resume();
        this.last = performance.now();
      }
    });
    window.addEventListener('pagehide', () => this.save());
    window.addEventListener('resize', () => { this.renderer.resize(); this.layoutInsets(); this.nextShown = -99; });
  }

  private tryDrop(): void {
    const g = this.game;
    if (!g || this.mode !== 'play') return;
    if (g.ready) { g.drop(); this.processEvents(g.events.splice(0)); }
    else this.pendingDrop = 0.3;
  }

  private setTargeting(on: boolean): void {
    this.renderer.targeting = on;
    this.renderer.hoverId = -1;
    this.powerBtns.get('punch')!.classList.toggle('active', on);
    if (on) this.setHint('내보낼 고양이를 톡 누르세요'); else this.setHint(null);
  }

  private usePower(p: Power): void {
    const g = this.game;
    if (!g || this.mode !== 'play') return;
    this.sound.unlock();
    if (p === 'punch') {
      if (this.renderer.targeting) { this.setTargeting(false); return; }
      if (!g.canUse('punch')) { this.noCharge(p); return; }
      this.sound.tap();
      this.setTargeting(true);
      return;
    }
    this.setTargeting(false);
    const ok = p === 'liquify' ? g.startLiquify() : g.startShake();
    if (!ok) { this.noCharge(p); return; }
    this.processEvents(g.events.splice(0));
  }

  private noCharge(p: Power): void {
    const g = this.game!;
    if (g.charges[p] <= 0) this.toast('츄르 게이지를 채우면 충전돼요');
    const b = this.powerBtns.get(p)!;
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
  }

  // ── 이벤트 처리 ──────────────────────────────────────────

  private processEvents(events: GameEvent[]): void {
    const g = this.game!;
    if (!events.length) return;
    this.renderer.onEvents(events, g);
    const p = this.profile;
    let dirty = false;
    for (const e of events) {
      switch (e.t) {
        case 'drop':
          this.sound.drop(e.tier < 0 ? 0 : e.tier);
          this.haptic(6);
          if (e.tier >= 0) {
            if (p.dex[e.tier] === 0) this.toast('새 고양이 발견!', e.tier, CATS[e.tier].name);
            p.dex[e.tier]++; dirty = true;
          }
          if (!(p.tutorial & 1)) { p.tutorial |= 1; dirty = true; this.setHint('같은 고양이끼리 닿으면 합체해요!'); }
          break;
        case 'merge':
        case 'nip': {
          if (e.t === 'nip') this.sound.nip(); else this.sound.merge(e.tier, e.combo);
          this.haptic(e.tier >= 7 ? [20, 30, 40] : 8 + e.tier * 3);
          p.merges++;
          const first = p.dex[e.tier] === 0;
          p.dex[e.tier]++;
          dirty = true;
          if (first) this.toast('새 고양이 발견!', e.tier, CATS[e.tier].name);
          if (!(p.tutorial & 2)) { p.tutorial |= 2; this.setHint(null); }
          if (e.combo >= 3) this.sound.purr();
          if (!(p.tutorial & 8) && g.stats.merges >= 6) { p.tutorial |= 8; this.toast('아래 능력 버튼도 써 보세요! 츄르 게이지가 차면 충전돼요'); }
          break;
        }
        case 'ascend':
          this.sound.ascend();
          this.haptic([40, 40, 80, 40, 120]);
          p.ascends++; p.merges++; dirty = true;
          this.toast('우주뚱냥 승천! 보너스 1,000점');
          break;
        case 'land':
          this.sound.land(Math.max(0, e.tier), e.speed);
          break;
        case 'charge':
          this.sound.charge();
          this.toast(`츄르 게이지 가득! ${POWER_INFO[e.power].name} +1`);
          { const b = this.powerBtns.get(e.power)!; b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
          break;
        case 'power':
          if (e.power === 'punch') this.sound.punch();
          else if (e.power === 'liquify') this.sound.liquify();
          else this.sound.shake();
          this.haptic(e.power === 'shake' ? [30, 50, 30, 50, 30] : 20);
          break;
        case 'over':
          this.onGameOver();
          break;
      }
    }
    if (dirty) this.saveOk = saveProfile(p);
  }

  // ── HUD ──────────────────────────────────────────────────

  private updateHud(force = false): void {
    const g = this.game;
    if (!g) return;
    const diff = g.score - this.shownScore;
    this.shownScore = Math.abs(diff) < 1 ? g.score : this.shownScore + diff * 0.2;
    this.scoreEl.textContent = fmt(this.shownScore);
    if (g.mode === 'classic') {
      const best = Math.max(this.profile.best, g.score);
      const txt = g.score > this.profile.best && this.profile.best > 0 ? `최고 기록 경신 중!` : `최고 ${fmt(best)}`;
      if (this.bestEl.textContent !== txt) this.bestEl.textContent = txt;
    }
    if (force || this.nextShown !== g.nextTier) {
      this.nextShown = g.nextTier;
      drawPortrait(this.nextCv, g.nextTier, { pad: 0.12 });
    }
    const full = POWERS.every(p => g.charges[p] >= g.rules.maxCharges);
    this.gaugeFill.style.width = `${Math.min(100, (g.gauge / g.gaugeNeed) * 100).toFixed(1)}%`;
    this.gaugeEl.classList.toggle('full', full);
    for (const p of POWERS) {
      const b = this.powerBtns.get(p)!;
      const c = String(g.charges[p]);
      const cnt = b.querySelector('.count')!;
      if (cnt.textContent !== c) cnt.textContent = c;
      const empty = g.charges[p] <= 0 ? '1' : '0';
      if (b.dataset.empty !== empty) b.dataset.empty = empty;
    }
    if (g.current === NIP && !(this.profile.tutorial & 16)) {
      this.profile.tutorial |= 16; saveProfile(this.profile);
      this.toast('캣닢 공! 처음 닿은 고양이를 한 단계 키워 줘요', NIP);
    }
    if (g.danger > 0.2 && !(this.profile.tutorial & 4)) {
      this.profile.tutorial |= 4; saveProfile(this.profile);
      this.toast('점선 밖으로 오래 나와 있으면 상자가 넘쳐요!');
    }
  }

  // ── 홍보용 장면 (스토어 스크린샷 스크립트가 호출) ─────────────

  stage(scene: 'pile' | 'combo' | 'liquify' | 'results' | 'dex' | 'daily'): void {
    const g = new Game({ mode: 'classic', seed: 20260925 });
    const rng = makeRng(scene.length * 97 + 5);
    const W = g.rules.boxW;
    const count = scene === 'combo' ? 18 : 24;
    for (let i = 0; i < count; i++) {
      const t = weighted(rng, [7, 8, 8, 8, 7, 5, 4, 3, 2, 1, 0]);
      const r = CATS[t].r;
      const b = makeBody(g.nextId++, t, range(rng, r, W - r), -r - 10, r, -10);
      g.world.add(b);
      for (let k = 0; k < 18; k++) g.world.step(STEP);
    }
    for (let k = 0; k < 180; k++) g.world.step(STEP);
    for (const b of g.world.bodies) { b.a = 0; b.w = 0; b.born = -10; b.touched = true; }
    // 테두리 위로 삐져나온 고양이는 치운다 (위험 표시 없이 깔끔한 화면)
    for (const b of [...g.world.bodies]) if (b.y - b.r < 40) g.world.remove(b);
    g.score = scene === 'results' ? 48210 : 18640;
    g.stats = { drops: 214, merges: 187, maxCombo: 6, maxTier: 9, ascends: 0, nips: 4, powersUsed: 3 };
    g.charges = { punch: 2, liquify: 1, shake: 3 };
    g.gauge = g.gaugeNeed * 0.62;
    g.time = 412;
    g.holdX = W * 0.3;
    for (let i = 0; i < CATS.length; i++) if (!this.profile.dex[i]) this.profile.dex[i] = 1 + (CATS.length - i) * 3;
    if (!this.profile.best) this.profile.best = 52480;
    this.profile.tutorial = 31;
    this.startGame('classic');
    this.game = g;
    this.shownScore = g.score;
    this.updateHud(true);
    if (scene === 'combo') {
      // 같은 고양이 쌍을 맞닿게 놓아 연쇄를 일으킨다
      const pairs: Array<[number, number, number]> = [[4, 120, 60], [4, 170, 60], [5, 250, 20], [2, 60, 0], [2, 88, 0]];
      for (const [t, x, y] of pairs) g.world.add(makeBody(g.nextId++, t, x, y, CATS[t].r, g.time));
    }
    if (scene === 'liquify') { g.startLiquify(); g.events.length = 0; }
    if (scene === 'results') { g.over = true; this.finishStaged(); }
    if (scene === 'dex') { this.pause(); this.showDex(); }
    if (scene === 'daily') { this.showTitle(); this.showDailyIntro(dailyInfo()); }
  }

  private finishStaged(): void {
    this.newBest = true;
    this.mode = 'results';
    this.showResults();
  }

  // ── 메인 루프 ────────────────────────────────────────────

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (dt > 0) this.fps = this.fps * 0.95 + Math.min(240, 1 / dt) * 0.05;

    if (this.mode === 'play' && this.game) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 5 && this.mode === 'play') {
        this.stepGame();
        this.acc -= STEP; n++;
      }
      if (n >= 5) this.acc = 0;
      this.updateHud();
      this.renderer.render(this.game, dt, { showHeld: true });
    } else if (this.mode === 'title') {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 3) { this.stepDemo(); this.acc -= STEP; n++; }
      if (n >= 3) this.acc = 0;
      this.renderer.render(this.demo, dt, { showHeld: true, demo: true });
    } else if (this.game) {
      this.updateHud();
      this.renderer.render(this.game, dt, { showHeld: this.mode !== 'results' && this.mode !== 'over' && this.mode !== 'revive', paused: true });
    }
  };

  private stepGame(): void {
    const g = this.game!;
    if (this.keyDir) g.aim(g.holdX + this.keyDir * 420 * STEP);
    if (this.pendingDrop > 0) {
      this.pendingDrop -= STEP;
      if (g.ready) { this.pendingDrop = 0; g.drop(); this.processEvents(g.events.splice(0)); }
    }
    g.update(STEP);
    this.processEvents(g.events.splice(0));
    if (g.liquify > 0 && Math.random() < 0.08) this.sound.bubble();
    if (g.danger > 0.3) {
      this.sound.danger();
      if (performance.now() - this.lastDangerBuzz > 700) { this.lastDangerBuzz = performance.now(); this.haptic(15); }
    }
    this.saveTimer += STEP;
    if (this.saveTimer > 4) { this.saveTimer = 0; this.save(); }
  }

  private stepDemo(): void {
    const g = this.demo;
    this.demoWait -= STEP;
    if (this.demoWait <= 0 && g.ready) {
      const x = chooseX(g, this.demoRng, 0.8);
      if (Math.abs(g.holdX - x) > 4) g.aim(g.holdX + Math.sign(x - g.holdX) * Math.min(Math.abs(x - g.holdX), 9));
      else { g.drop(); this.demoWait = 0.7 + Math.random() * 0.6; }
    }
    g.update(STEP);
    this.renderer.onEvents(g.events, g);
    if (g.over || g.world.bodies.length > 34) { this.demo = this.newDemo(); }
  }
}
