// 한 판의 규칙: 떨어뜨리기, 합체, 캣닢, 콤보, 츄르 게이지, 넘침, 특수 능력, 저장.
// DOM 없음. update()가 이번 프레임 이벤트 목록을 채운다.
import { CATS, MAX_TIER, mergePoints, ASCEND_BONUS } from '../data/cats';
import { makeRules, type Rules, type ModeId } from '../data/rules';
import { World, makeBody, type Body } from './physics';
import { makeRng, next, range, weighted, type Rng } from './rng';

export type Power = 'punch' | 'liquify' | 'shake';
export const POWERS: Power[] = ['punch', 'liquify', 'shake'];
export const NIP = -1;
export const NIP_R = 15;
/** 캣닢이 키워 줄 수 있는 가장 큰 단계 (러시안블루 → 뱅갈까지). 더 큰 고양이는 점수만 */
export const NIP_MAX_TIER = 6;
export const NIP_TREAT_POINTS = 100;

export type GameEvent =
  | { t: 'drop'; tier: number; x: number }
  | { t: 'merge'; tier: number; x: number; y: number; points: number; combo: number; ax: number; ay: number; bx: number; by: number; ar: number; br: number }
  | { t: 'ascend'; x: number; y: number; points: number; combo: number }
  | { t: 'nip'; tier: number; x: number; y: number; points: number; combo: number; grew: boolean }
  | { t: 'land'; tier: number; x: number; y: number; speed: number }
  | { t: 'charge'; power: Power }
  | { t: 'power'; power: Power; x: number; y: number; tier: number }
  | { t: 'revive'; poofs: Array<{ x: number; y: number; tier: number }> }
  | { t: 'over' };

export interface GameOptions {
  mode: ModeId;
  seed: number;
  mods?: string[];
  dateKey?: string;
}

export interface Stats {
  drops: number;
  merges: number;
  maxCombo: number;
  maxTier: number;
  ascends: number;
  nips: number;
  powersUsed: number;
}

export function radiusOf(tier: number): number {
  return tier === NIP ? NIP_R : CATS[tier].r;
}

export class Game {
  readonly mode: ModeId;
  readonly seed: number;
  readonly mods: string[];
  readonly dateKey: string;
  rules: Rules;
  world: World;
  time = 0;
  nextId = 1;
  spawnRng: Rng;
  fxRng: Rng;
  /** [지금 들고 있는 것, 다음] 단계. -1 = 캣닢 공 */
  queue: number[] = [];
  spawned = 0;
  nipAt = 0;
  holdX: number;
  cooldown = 0;
  score = 0;
  combo = 0;
  comboTimer = 0;
  gauge = 0;
  gaugeNeed: number;
  charges: Record<Power, number>;
  liquify = 0;
  shake = 0;
  shakeTick = 0;
  private shakeDir = 1;
  /** 능력 사용 직후 넘침 판정을 잠시 멈춘다 (능력 때문에 지는 일 없게) */
  calm = 0;
  revived = false;
  over = false;
  /** 넘침 위험도 0..1 (가장 오래 삐져나온 고양이 기준) */
  danger = 0;
  /** 가장 높이 쌓인 고양이 윗면 (y, 작을수록 위험) */
  topY = 0;
  stats: Stats = { drops: 0, merges: 0, maxCombo: 0, maxTier: 0, ascends: 0, nips: 0, powersUsed: 0 };
  events: GameEvent[] = [];
  private lastLand = new Map<number, number>();

  constructor(opts: GameOptions) {
    this.mode = opts.mode;
    this.seed = opts.seed >>> 0;
    this.mods = opts.mods ?? [];
    this.dateKey = opts.dateKey ?? '';
    this.rules = makeRules(this.mods);
    const r = this.rules;
    this.world = new World({ gravity: r.gravity, friction: r.friction, restitution: r.restitution, boxW: r.boxW, boxH: r.boxH, substeps: 8, iterations: 2 });
    this.spawnRng = makeRng(this.seed);
    this.fxRng = makeRng(this.seed ^ 0x5bd1e995);
    this.nipAt = Math.round(range(this.spawnRng, r.catnipEvery[0], r.catnipEvery[1]));
    this.queue = [this.rollSpawn(), this.rollSpawn()];
    this.holdX = r.boxW / 2;
    this.gaugeNeed = r.gaugeFirst;
    this.charges = { punch: r.startCharges, liquify: r.startCharges, shake: r.startCharges };
    this.topY = r.boxH;
  }

  /** 소환 순서는 플레이와 무관하게 시드로만 정해진다 (오늘의 상자 공정성) */
  private rollSpawn(): number {
    const i = this.spawned++;
    if (i === this.nipAt) {
      this.nipAt += Math.round(range(this.spawnRng, this.rules.catnipEvery[0], this.rules.catnipEvery[1]));
      return NIP;
    }
    const w = this.rules.spawnWeights;
    // 처음 몇 번은 작은 고양이만 (첫 합체를 빨리 보여 준다)
    if (i < 4) return weighted(this.spawnRng, w.slice(0, 3));
    return weighted(this.spawnRng, w);
  }

  get current(): number { return this.queue[0]; }
  get nextTier(): number { return this.queue[1]; }
  get ready(): boolean { return this.cooldown <= 0 && !this.over; }
  get comboMul(): number { return Math.min(this.rules.comboMaxMul, 1 + this.rules.comboBonus * Math.max(0, this.combo - 1)); }

  /** 들고 있는 고양이가 놓일 수 있는 x 범위로 제한 */
  clampX(x: number, tier = this.current): number {
    const r = radiusOf(tier) * (this.liquify > 0 ? this.rules.liquifyShrink : 1);
    return Math.max(r, Math.min(this.rules.boxW - r, x));
  }

  aim(x: number): void { this.holdX = this.clampX(x); }

  drop(): boolean {
    if (!this.ready) return false;
    const tier = this.queue.shift()!;
    this.queue.push(this.rollSpawn());
    const x = this.clampX(this.holdX, tier);
    const r = radiusOf(tier);
    const b = makeBody(this.nextId++, tier, x, this.rules.dropY, r, this.time);
    if (this.liquify > 0 && tier !== NIP) { b.rt = r * this.rules.liquifyShrink; b.r = b.rt; b.invM = 1 / (b.r * b.r); }
    b.vy = 60;
    this.world.add(b);
    this.cooldown = this.rules.dropCooldown;
    this.stats.drops++;
    this.holdX = this.clampX(this.holdX);
    this.events.push({ t: 'drop', tier, x });
    return true;
  }

  update(dt: number): void {
    this.events.length = 0;
    if (this.over) return;
    this.time += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) { this.comboTimer = 0; this.combo = 0; } }
    this.tickPowers(dt);
    this.world.step(dt);
    this.resolveTouches();
    this.checkLanding();
    this.checkOverflow(dt);
  }

  /** 막 합체해 태어난 고양이는 잠시 연쇄 단계를 기억한다 */
  private chainOf(b: Body): number {
    return this.time - b.ct <= this.rules.comboWindow ? b.chain : 0;
  }

  /** 점수 지급. chain = 이번 합체의 연쇄 단계 (1 = 단독 합체) */
  private award(base: number, chain: number): number {
    this.combo = chain;
    this.comboTimer = this.rules.comboWindow;
    if (chain > this.stats.maxCombo) this.stats.maxCombo = chain;
    const pts = Math.round(base * this.comboMul);
    this.score += pts;
    this.addGauge(pts);
    return pts;
  }

  private addGauge(pts: number): void {
    const maxed = () => POWERS.every(p => this.charges[p] >= this.rules.maxCharges);
    if (maxed()) { this.gauge = Math.min(this.gaugeNeed, this.gauge + pts); return; }
    this.gauge += pts;
    while (this.gauge >= this.gaugeNeed && !maxed()) {
      this.gauge -= this.gaugeNeed;
      this.gaugeNeed = Math.round(this.gaugeNeed * this.rules.gaugeGrowth / 50) * 50;
      let best: Power = POWERS[0];
      for (const p of POWERS) if (this.charges[p] < this.charges[best]) best = p;
      this.charges[best]++;
      this.events.push({ t: 'charge', power: best });
    }
    if (maxed()) this.gauge = Math.min(this.gauge, this.gaugeNeed);
  }

  private targetR(tier: number): number {
    return radiusOf(tier) * (this.liquify > 0 && tier !== NIP ? this.rules.liquifyShrink : 1);
  }

  private resolveTouches(): void {
    const born: Body[] = [];
    for (const [A, B] of this.world.touching) {
      if (A.dead || B.dead) continue;
      if (A.tier >= 0 && A.tier === B.tier) {
        const t = A.tier;
        const x = (A.x + B.x) / 2, y = (A.y + B.y) / 2;
        const chain = Math.max(this.chainOf(A), this.chainOf(B)) + 1;
        this.world.remove(A); this.world.remove(B);
        this.stats.merges++;
        if (t === MAX_TIER) {
          const pts = this.award(mergePoints(t) + ASCEND_BONUS, chain);
          this.stats.ascends++;
          this.events.push({ t: 'ascend', x, y, points: pts, combo: this.combo });
          this.nudge(x, y, 170, 520);
          continue;
        }
        const nb = makeBody(this.nextId++, t + 1, x, y, Math.max(A.r, B.r), this.time);
        nb.rt = this.targetR(t + 1);
        nb.vx = (A.vx + B.vx) / 2; nb.vy = (A.vy + B.vy) / 2 - 40;
        nb.a = A.a; nb.w = (A.w + B.w) / 2;
        nb.touched = true;
        nb.chain = chain; nb.ct = this.time;
        born.push(nb);
        if (t + 1 > this.stats.maxTier) this.stats.maxTier = t + 1;
        const pts = this.award(mergePoints(t), chain);
        this.events.push({ t: 'merge', tier: t + 1, x, y, points: pts, combo: this.combo, ax: A.x, ay: A.y, bx: B.x, by: B.y, ar: A.r, br: B.r });
        this.nudge(x, y, CATS[t + 1].r * 1.6, 90 + 14 * t);
      } else if ((A.tier === NIP) !== (B.tier === NIP)) {
        const nip = A.tier === NIP ? A : B;
        const cat = nip === A ? B : A;
        this.world.remove(nip);
        this.stats.nips++;
        const t = cat.tier;
        if (t > NIP_MAX_TIER) {
          // 큰 고양이는 캣닢에 기분만 좋아진다 (점수만)
          const pts = this.award(NIP_TREAT_POINTS, 1);
          this.events.push({ t: 'nip', tier: t, x: cat.x, y: cat.y, points: pts, combo: this.combo, grew: false });
          continue;
        }
        const chain = this.chainOf(cat) + 1;
        cat.tier = t + 1;
        cat.rt = this.targetR(t + 1);
        cat.born = Math.max(cat.born, this.time - this.rules.overflowGrace * 0.5);
        cat.chain = chain; cat.ct = this.time;
        if (t + 1 > this.stats.maxTier) this.stats.maxTier = t + 1;
        const pts = this.award(mergePoints(t), chain);
        this.events.push({ t: 'nip', tier: t + 1, x: cat.x, y: cat.y, points: pts, combo: this.combo, grew: true });
      }
    }
    for (const b of born) this.world.add(b);
  }

  /** 합체 지점 주변 고양이를 살짝 밀어낸다 (통통 튀는 느낌) */
  private nudge(x: number, y: number, radius: number, power: number): void {
    for (const b of this.world.bodies) {
      const dx = b.x - x, dy = b.y - y;
      const d = Math.hypot(dx, dy);
      if (d < 1 || d > radius + b.r) continue;
      const k = power * (1 - d / (radius + b.r));
      b.vx += dx / d * k;
      b.vy += dy / d * k - k * 0.3;
    }
  }

  private checkLanding(): void {
    for (const b of this.world.bodies) {
      if (b.hit < 260) continue;
      const last = this.lastLand.get(b.id) ?? -1;
      if (this.time - last < 0.18) continue;
      this.lastLand.set(b.id, this.time);
      this.events.push({ t: 'land', tier: b.tier, x: b.x, y: b.y + b.r, speed: b.hit });
    }
    if (this.lastLand.size > 400) {
      const alive = new Set(this.world.bodies.map(b => b.id));
      for (const id of [...this.lastLand.keys()]) if (!alive.has(id)) this.lastLand.delete(id);
    }
  }

  private checkOverflow(dt: number): void {
    const r = this.rules;
    let worst = 0;
    let top = r.boxH;
    const calm = this.calm > 0 || this.shake > 0;
    if (this.calm > 0) this.calm -= dt;
    for (const b of this.world.bodies) {
      const eligible = this.time - b.born > r.overflowGrace && b.touched && !calm;
      const t = b.y - b.r;
      if (eligible && t < top) top = t;
      if (eligible && t < -2) b.over += dt;
      else b.over = Math.max(0, b.over - dt * 1.5);
      if (b.over > worst) worst = b.over;
    }
    this.topY = top;
    this.danger = Math.min(1, worst / r.overflowTime);
    if (worst >= r.overflowTime) {
      this.over = true;
      this.events.push({ t: 'over' });
    }
  }

  // ── 특수 능력 ─────────────────────────────────────────────

  canUse(p: Power): boolean {
    if (this.over || this.charges[p] <= 0) return false;
    if (p === 'liquify') return this.liquify <= 0;
    if (p === 'shake') return this.shake <= 0;
    return this.world.bodies.length > 0;
  }

  /** 냥펀치: 고른 고양이 하나를 상자에서 내보낸다 */
  punch(id: number): boolean {
    if (!this.canUse('punch')) return false;
    const b = this.world.bodies.find(x => x.id === id);
    if (!b) return false;
    this.world.remove(b);
    this.charges.punch--;
    this.stats.powersUsed++;
    this.events.push({ t: 'power', power: 'punch', x: b.x, y: b.y, tier: b.tier });
    return true;
  }

  /** 액체화: 잠시 모두 작아지고 미끄러워지며, 같은 고양이끼리 끌어당긴다 */
  startLiquify(): boolean {
    if (!this.canUse('liquify')) return false;
    this.charges.liquify--;
    this.stats.powersUsed++;
    this.liquify = this.rules.liquifyTime;
    this.applyLiquify(true);
    this.events.push({ t: 'power', power: 'liquify', x: this.rules.boxW / 2, y: this.rules.boxH / 2, tier: 0 });
    return true;
  }

  private applyLiquify(on: boolean): void {
    for (const b of this.world.bodies) b.rt = on ? this.targetRRaw(b.tier) * this.rules.liquifyShrink : this.targetRRaw(b.tier);
    this.world.p.friction = on ? 0.02 : this.rules.friction;
    this.world.force = on ? liquifyForce : null;
  }

  private targetRRaw(tier: number): number { return tier === NIP ? NIP_R : CATS[tier].r; }

  /** 상자 흔들기: 몇 번 크게 흔들어 자리를 다시 잡게 한다 */
  startShake(): boolean {
    if (!this.canUse('shake')) return false;
    this.charges.shake--;
    this.stats.powersUsed++;
    this.shake = this.rules.shakeTime;
    this.shakeTick = 0;
    this.events.push({ t: 'power', power: 'shake', x: this.rules.boxW / 2, y: this.rules.boxH, tier: 0 });
    return true;
  }

  private tickPowers(dt: number): void {
    if (this.liquify > 0) {
      this.liquify -= dt;
      if (this.liquify <= 0) { this.liquify = 0; this.applyLiquify(false); this.calm = 1.5; }
    }
    if (this.shake > 0) {
      this.shake -= dt;
      this.shakeTick -= dt;
      if (this.shakeTick <= 0 && this.shake > 0.15) {
        this.shakeTick = 0.16;
        const dir = this.shakeDir = -this.shakeDir || 1;
        for (const b of this.world.bodies) {
          const k = Math.min(1, 30 / b.r);
          b.vx += dir * range(this.fxRng, 140, 240) * (0.5 + k * 0.5);
          // 이미 떠오르는 고양이는 더 띄우지 않는다 (계속 쌓여 튀어나가지 않게)
          if (b.vy > -60) b.vy = Math.min(b.vy, 0) - range(this.fxRng, 180, 300) * (0.55 + k * 0.45);
        }
      }
      if (this.shake <= 0) { this.shake = 0; this.calm = 1.5; }
    }
  }

  /** 집사 찬스: 위쪽 고양이들을 치우고 한 번 더 */
  revive(): boolean {
    if (!this.over || this.revived) return false;
    this.revived = true;
    this.over = false;
    const limit = this.rules.boxH * 0.4;
    const poofs: Array<{ x: number; y: number; tier: number }> = [];
    for (const b of [...this.world.bodies]) {
      if (b.y - b.r < limit) { poofs.push({ x: b.x, y: b.y, tier: b.tier }); this.world.remove(b); }
      else b.over = 0;
    }
    this.danger = 0;
    this.cooldown = 0.6;
    this.events.push({ t: 'revive', poofs });
    return true;
  }

  // ── 저장 ─────────────────────────────────────────────────

  snapshot(): GameSnapshot {
    return {
      v: 1,
      mode: this.mode, seed: this.seed, mods: this.mods, dateKey: this.dateKey,
      time: this.time, nextId: this.nextId,
      spawnRng: { ...this.spawnRng }, fxRng: { ...this.fxRng },
      queue: [...this.queue], spawned: this.spawned, nipAt: this.nipAt,
      holdX: this.holdX, cooldown: this.cooldown,
      score: this.score, combo: this.combo, comboTimer: this.comboTimer,
      gauge: this.gauge, gaugeNeed: this.gaugeNeed, charges: { ...this.charges },
      liquify: this.liquify, shake: this.shake, shakeTick: this.shakeTick, calm: this.calm,
      revived: this.revived, stats: { ...this.stats },
      bodies: this.world.bodies.map(b => [b.id, b.tier, b.x, b.y, b.vx, b.vy, b.a, b.w, b.r, b.rt, b.born, b.over, b.touched ? 1 : 0, b.chain, b.ct]),
    };
  }

  static restore(s: GameSnapshot): Game {
    if (!s || s.v !== 1) throw new Error('bad snapshot');
    const g = new Game({ mode: s.mode, seed: s.seed, mods: s.mods, dateKey: s.dateKey });
    g.time = s.time; g.nextId = s.nextId;
    g.spawnRng = { ...s.spawnRng }; g.fxRng = { ...s.fxRng };
    g.queue = [...s.queue]; g.spawned = s.spawned; g.nipAt = s.nipAt;
    g.holdX = s.holdX; g.cooldown = s.cooldown;
    g.score = s.score; g.combo = s.combo; g.comboTimer = s.comboTimer;
    g.gauge = s.gauge; g.gaugeNeed = s.gaugeNeed; g.charges = { ...s.charges };
    g.shake = s.shake; g.shakeTick = s.shakeTick; g.calm = s.calm ?? 0;
    g.revived = s.revived; g.stats = { ...s.stats };
    for (const a of s.bodies) {
      const [id, tier, x, y, vx, vy, ang, w, r, rt, born, over, touched, chain, ct] = a;
      if (!(tier === NIP || (tier >= 0 && tier <= MAX_TIER)) || ![x, y, vx, vy, ang, w, r, rt].every(Number.isFinite)) throw new Error('bad body');
      const b = makeBody(id, tier, x, y, r, born);
      b.vx = vx; b.vy = vy; b.a = ang; b.w = w; b.rt = rt; b.over = over; b.touched = touched === 1;
      b.chain = chain ?? 0; b.ct = ct ?? born;
      g.world.add(b);
    }
    g.liquify = s.liquify;
    if (g.liquify > 0) { g.world.p.friction = 0.02; g.world.force = liquifyForce; }
    return g;
  }
}

export interface GameSnapshot {
  v: 1;
  mode: ModeId; seed: number; mods: string[]; dateKey: string;
  time: number; nextId: number;
  spawnRng: Rng; fxRng: Rng;
  queue: number[]; spawned: number; nipAt: number;
  holdX: number; cooldown: number;
  score: number; combo: number; comboTimer: number;
  gauge: number; gaugeNeed: number; charges: Record<Power, number>;
  liquify: number; shake: number; shakeTick: number; calm?: number;
  revived: boolean; stats: Stats;
  bodies: number[][];
}

/** 액체화 중: 같은 단계 고양이끼리 서로 끌어당긴다 */
function liquifyForce(bodies: Body[], h: number): void {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const A = bodies[i];
    if (A.tier < 0) continue;
    for (let j = i + 1; j < n; j++) {
      const B = bodies[j];
      if (B.tier !== A.tier) continue;
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx, dy);
      const range = (A.r + B.r) * 2.8;
      if (d < 1e-3 || d > range) continue;
      const ux = dx / d, uy = dy / d;
      // 이미 빠르게 다가가는 중이면 더 당기지 않는다 (사이에 낀 고양이가 튕겨 나가지 않게)
      const closing = (A.vx - B.vx) * ux + (A.vy - B.vy) * uy;
      if (closing > 260) continue;
      const acc = 1200 * h;
      A.vx += ux * acc; A.vy += uy * acc;
      B.vx -= ux * acc; B.vy -= uy * acc;
    }
  }
}
