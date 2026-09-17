// 한 스테이지의 플레이 세션: 상태 기계, 발사, 밧줄 절단, 판정, 안정 감지, 결과.
import Matter from 'matter-js';
import type { LevelDef, ShotInput, SessionState, SessionEvent, FailReason, Vec2 } from './types';
import { World, type BodyEntry, type RopeEntry } from './world';
import { shotToVelocity } from './launcher';
import { toppleCondition, dropCondition, protectOutCondition } from './judge';
import { segmentSegmentDistance } from './geometry';
import { JUDGE, PROJECTILE, HIT_EVENT_MIN_SPEED } from '../data/physics';

const { Body } = Matter;

export interface GoalState {
  body: string;
  judge: 'topple' | 'drop';
  achieved: boolean;
  holdCounter: number;
  achievedAtStep: number;
}

export interface ProtectState { body: string; failed: boolean }

export function starsFor(level: LevelDef, shotsUsed: number): number {
  if (shotsUsed <= level.stars.three) return 3;
  if (shotsUsed <= level.stars.two) return 2;
  return 1;
}

export class LevelSession {
  readonly world: World;
  state: SessionState = 'init';
  step_ = 0;                       // 진행된 고정 스텝 수
  shotsUsed = 0;
  shots: { shot: ShotInput; atStep: number }[] = [];
  goals: GoalState[];
  protects: ProtectState[];
  failReason: FailReason | null = null;
  combo = 0;
  maxCombo = 0;
  lastGoalStep = -Infinity;
  events: SessionEvent[] = [];
  settleCounter = 0;
  observeCounter = 0;
  successWait = 0;
  resultAtStep = -1;
  stars = 0;
  private disposed = false;
  /** 최근 creepWindowSteps 스텝의 자세 기록(느린 기울어짐 감지용). body.id → [x,y,angle]×N 순환 버퍼 */
  private poseHist = new Map<number, Float64Array>();
  private poseCursor = 0;

  constructor(readonly level: LevelDef) {
    this.world = new World(level);
    this.goals = level.goals.map((g) => ({ body: g.body, judge: g.judge, achieved: false, holdCounter: 0, achievedAtStep: -1 }));
    this.protects = (level.protects ?? []).map((p) => ({ body: p.body, failed: false }));
    for (const g of level.goals) this.world.mustEntry(g.body);
    for (const p of level.protects ?? []) this.world.mustEntry(p.body);
    this.presettle();
  }

  get shotsLeft() { return this.level.shots - this.shotsUsed; }
  get goalsDone() { return this.goals.filter((g) => g.achieved).length; }
  get allGoalsDone() { return this.goals.every((g) => g.achieved); }
  get timeSec() { return this.step_ / 60; }

  /** 시작 안정화: 항상 같은 스텝 수만큼 진행한 뒤 초기 자세를 기록하고 조준을 허용한다. */
  private presettle() {
    for (let i = 0; i < JUDGE.presettleSteps; i++) this.world.step();
    this.world.captureInitialPoses();
    this.events.length = 0;
    this.transition('aiming');
  }

  private transition(to: SessionState) {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.events.push({ t: 'state', from, to });
  }

  /** 조준 가능 상태에서만 발사. 성공·실패·비행 중에는 무시한다. */
  launch(shot: ShotInput): boolean {
    if (this.state !== 'aiming' || this.shotsLeft <= 0) return false;
    if (!(shot.power > 0) || !isFinite(shot.angleDeg)) return false;
    const v = shotToVelocity(shot);
    const { x, y } = this.level.launcher;
    this.world.addProjectile(x, y, v.x, v.y);
    this.shotsUsed++;
    this.shots.push({ shot, atStep: this.step_ });
    this.observeCounter = 0;
    this.settleCounter = 0;
    this.successWait = 0;
    this.events.push({ t: 'launch', shot, x, y });
    this.transition('flying');
    return true;
  }

  /** 고정 스텝 한 번. 일시정지 중에는 호출하지 않는다. */
  step() {
    if (this.disposed) return;
    this.step_++;
    const w = this.world;
    w.step((prev) => this.sweepRopes(prev));
    // 충돌 이벤트(효과음·먼지용)
    for (const h of w.hits) {
      if (h.speed >= HIT_EVENT_MIN_SPEED) this.events.push({ t: 'hit', material: h.a.material, other: h.b.material, speed: h.speed, x: h.x, y: h.y });
    }
    for (const gone of w.removeOutOfBounds()) this.events.push({ t: 'removed', body: gone.id });

    if (this.state === 'success' || this.state === 'failed') return;

    // 1) 보호물 실패를 목표보다 먼저 확인한다.
    this.judgeProtects();
    if (this.failReason) { this.finishFail(this.failReason); return; }
    // 2) 목표
    this.judgeGoals();
    // 3) 안정 상태 → 결과 전환 (조준 중에 뒤늦게 목표가 달성되는 경우도 포함)
    this.recordPoses();
    if (this.state === 'flying') this.observe();
    else if (this.state === 'aiming' && this.allGoalsDone) this.observeLateSuccess();
  }

  /** 조준 상태에서 목표가 모두 달성됨(느린 붕괴 등): 안정되면 성공 처리 */
  private observeLateSuccess() {
    this.settleCounter = this.isSettledNow() ? this.settleCounter + 1 : 0;
    this.successWait++;
    if (this.settleCounter >= JUDGE.successSettleSteps || this.successWait >= JUDGE.successMaxWaitSteps) this.finishSuccess();
  }

  private sweepRopes(prev: Map<BodyEntry, Vec2>) {
    const w = this.world;
    if (w.ropes.size === 0) return;
    for (const p of w.projectiles) {
      if (p.removed) continue;
      const p0 = prev.get(p);
      if (!p0) continue;
      const p1 = p.body.position;
      const reach = p.r + PROJECTILE.ropeCutMargin;
      for (const rope of w.ropes.values()) {
        if (rope.cut) continue;
        const { a, b } = w.ropeEndpoints(rope);
        if (segmentSegmentDistance(p0, { x: p1.x, y: p1.y }, a, b) <= reach) {
          const ends = w.cutRope(rope);
          if (ends) this.events.push({ t: 'ropeCut', ropeId: rope.id, a: ends.a, b: ends.b, at: { x: p1.x, y: p1.y } });
        }
      }
    }
  }

  private judgeProtects() {
    for (const p of this.protects) {
      if (p.failed) continue;
      const entry = this.world.mustEntry(p.body);
      const def = this.level.protects!.find((d) => d.body === p.body)!;
      const hit = this.world.protectHits.some((h) => h.protect === entry);
      if (hit) { p.failed = true; this.failReason = 'protectHit'; this.events.push({ t: 'protectFail', body: p.body, reason: 'protectHit' }); return; }
      if (protectOutCondition(entry, def.safeZone)) { p.failed = true; this.failReason = 'protectOut'; this.events.push({ t: 'protectFail', body: p.body, reason: 'protectOut' }); return; }
    }
  }

  private judgeGoals() {
    for (const g of this.goals) {
      if (g.achieved) continue;
      const entry = this.world.mustEntry(g.body);
      const def = this.level.goals.find((d) => d.body === g.body)!;
      // 떨어뜨리기: 구역 안에 있다가 월드 밖으로 사라진 경우(깊은 구덩이)도 달성으로 본다.
      const droppedOut = g.judge === 'drop' && entry.removed && g.holdCounter > 0;
      const ok = droppedOut || (g.judge === 'topple' ? toppleCondition(entry) : dropCondition(entry, def.zone!));
      if (!ok) { g.holdCounter = 0; continue; }
      g.holdCounter++;
      if (g.holdCounter >= JUDGE.holdSteps || entry.removed) {
        g.achieved = true;
        g.achievedAtStep = this.step_;
        this.combo = this.step_ - this.lastGoalStep <= JUDGE.comboWindowSteps ? this.combo + 1 : 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.lastGoalStep = this.step_;
        this.events.push({ t: 'goal', body: g.body, combo: this.combo, remaining: this.goals.length - this.goalsDone });
      }
    }
  }

  private recordPoses() {
    const N = JUDGE.creepWindowSteps;
    const i = (this.poseCursor = (this.poseCursor + 1) % N) * 3;
    for (const e of this.world.dynamicEntries()) {
      let h = this.poseHist.get(e.body.id);
      if (!h) { h = new Float64Array(N * 3); for (let k = 0; k < N; k++) { h[k * 3] = e.body.position.x; h[k * 3 + 1] = e.body.position.y; h[k * 3 + 2] = e.body.angle; } this.poseHist.set(e.body.id, h); }
      h[i] = e.body.position.x; h[i + 1] = e.body.position.y; h[i + 2] = e.body.angle;
    }
  }

  /** 주요 물체의 속도·각속도(그리고 최근 창의 누적 이동)로 안정 여부를 판단한다. 장식 효과는 고려하지 않는다. */
  isSettledNow(): boolean {
    const hanging = this.world.hangingBodies();
    const N = JUDGE.creepWindowSteps;
    const oldest = ((this.poseCursor + 1) % N) * 3;
    for (const e of this.world.dynamicEntries()) {
      const b = e.body;
      if (b.isSleeping) continue;
      const isHanging = hanging.has(b.id);
      const limit = isHanging ? JUDGE.settleSpeedHanging : JUDGE.settleSpeed;
      if (Body.getSpeed(b) > limit || Body.getAngularSpeed(b) > JUDGE.settleAngular * (isHanging ? 4 : 1)) return false;
      const h = this.poseHist.get(b.id);
      if (h && !isHanging) {
        const dx = b.position.x - h[oldest], dy = b.position.y - h[oldest + 1], da = Math.abs(b.angle - h[oldest + 2]);
        if (Math.hypot(dx, dy) > JUDGE.creepMaxMove || da > (JUDGE.creepMaxRotDeg * Math.PI) / 180) return false;
      }
    }
    return true;
  }

  private observe() {
    this.observeCounter++;
    this.settleCounter = this.isSettledNow() ? this.settleCounter + 1 : 0;
    const timedOut = this.observeCounter >= JUDGE.shotMaxObserveSteps;
    if (this.allGoalsDone) {
      this.successWait++;
      if (this.settleCounter >= JUDGE.successSettleSteps || this.successWait >= JUDGE.successMaxWaitSteps || timedOut) this.finishSuccess();
      return;
    }
    if (this.settleCounter >= JUDGE.settleHoldSteps || timedOut) {
      if (this.shotsLeft > 0) { this.transition('aiming'); return; }
      this.finishFail(this.shotsUsed >= this.level.shots ? 'outOfShots' : 'goalsRemaining');
    }
  }

  private finishSuccess() {
    this.stars = starsFor(this.level, this.shotsUsed);
    this.resultAtStep = this.step_;
    this.transition('success');
    this.events.push({ t: 'success', shotsUsed: this.shotsUsed, stars: this.stars, maxCombo: this.maxCombo });
  }

  private finishFail(reason: FailReason) {
    this.failReason = reason;
    this.resultAtStep = this.step_;
    this.transition('failed');
    this.events.push({ t: 'fail', reason });
  }

  drainEvents(): SessionEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** 개발·검증용 요약 */
  summary() {
    return {
      state: this.state, step: this.step_, shotsUsed: this.shotsUsed, goalsDone: this.goalsDone, goals: this.goals.length,
      protectsSafe: this.protects.every((p) => !p.failed), failReason: this.failReason, stars: this.stars, maxCombo: this.maxCombo,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.world.dispose();
  }
}

/** 검증·재생용: 발사 목록을 순서대로 적용하고 결과가 확정될 때까지 진행한다. */
export function runShots(level: LevelDef, shots: ShotInput[], maxSteps = 60 * 90): LevelSession {
  const s = new LevelSession(level);
  let i = 0;
  while (s.step_ < maxSteps) {
    if (s.state === 'aiming') {
      if (i < shots.length) { s.launch(shots[i++]); }
      else if (s.shotsLeft > 0) {
        // 남은 탄을 쓰지 않으면 결과가 확정되지 않는다. 검증에서는 여기서 멈춘다.
        break;
      }
    }
    if (s.state === 'success' || s.state === 'failed') break;
    s.step();
  }
  return s;
}
