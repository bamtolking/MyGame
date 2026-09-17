// 스테이지 데이터 → matter-js 물리 월드. 물리 월드는 이 클래스 하나만 소유한다.
import Matter from 'matter-js';
import type { BodyDef, LevelDef, Material, BodyRole, RopeDef, HingeDef, Vec2 } from './types';
import { MATERIALS } from '../data/materials';
import { ENGINE_OPTS, GRAVITY_Y, GROUND_Y, SLEEP, SUBSTEPS, SUB_DELTA_MS, WORLD_H, WORLD_W, PROJECTILE, BOUNDS } from '../data/physics';

const { Engine, Bodies, Body, Composite, Constraint, Vertices, Sleeping, Events } = Matter;

export type EntryKind = 'block' | 'ball' | 'ramp' | 'poly' | 'ground' | 'projectile';

export interface BodyEntry {
  id: string;
  kind: EntryKind;
  body: Matter.Body;
  material: Material;
  role: BodyRole | 'projectile';
  w: number; h: number; r: number;
  isStatic: boolean;
  removed: boolean;
  label?: string;
  init: { x: number; y: number; angle: number }; // 안정화 후 초기 자세
}

export interface RopeEntry {
  id: string;
  def: RopeDef;
  constraint: Matter.Constraint;
  restLength: number;
  cut: boolean;
  entryA?: BodyEntry;
  entryB?: BodyEntry;
}

export interface HingeEntry {
  id: string;
  def: HingeDef;
  constraint: Matter.Constraint;
  entry: BodyEntry;
}

export interface HitRecord {
  a: BodyEntry; b: BodyEntry; speed: number; x: number; y: number;
}

let sleepConfigured = false;
function configureSleeping() {
  if (sleepConfigured) return;
  sleepConfigured = true;
  (Sleeping as any)._motionSleepThreshold = SLEEP.motionSleepThreshold;
  (Sleeping as any)._motionWakeThreshold = SLEEP.motionWakeThreshold;
}

function matOpts(m: Material) {
  const p = MATERIALS[m];
  return { density: p.density, friction: p.friction, frictionStatic: p.frictionStatic, restitution: p.restitution, frictionAir: p.frictionAir };
}

/** 매끄럽게 구르도록 변 수를 넉넉히 잡은 원(Bodies.circle은 변 수를 반지름 이하로 제한한다). */
export const CIRCLE_SIDES = 40;
export function makeCircle(x: number, y: number, r: number, opts: Matter.IChamferableBodyDefinition): Matter.Body {
  return Bodies.polygon(x, y, CIRCLE_SIDES, r, { ...opts, circleRadius: r } as Matter.IChamferableBodyDefinition);
}

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;

export class World {
  readonly engine: Matter.Engine;
  readonly entries = new Map<string, BodyEntry>();
  readonly byBodyId = new Map<number, BodyEntry>();
  readonly ropes = new Map<string, RopeEntry>();
  readonly hinges = new Map<string, HingeEntry>();
  readonly projectiles: BodyEntry[] = [];
  readonly circles: BodyEntry[] = [];        // 구름 저항 대상
  readonly hits: HitRecord[] = [];            // 마지막 step()에서 시작된 충돌
  readonly protectHits: { protect: BodyEntry; projectile: BodyEntry }[] = [];
  private projectileSeq = 0;
  private collisionHandler: (e: Matter.IEventCollision<Matter.Engine>) => void;

  constructor(readonly level: LevelDef) {
    configureSleeping();
    this.engine = Engine.create({
      gravity: { x: 0, y: GRAVITY_Y, scale: 0.001 },
      enableSleeping: true,
      ...ENGINE_OPTS,
    });
    this.buildGround();
    for (const def of level.bodies) this.addBodyDef(def);
    for (const r of level.ropes ?? []) this.addRope(r);
    for (const h of level.hinges ?? []) this.addHinge(h);
    this.collisionHandler = (e) => this.onCollisionStart(e);
    Events.on(this.engine, 'collisionStart', this.collisionHandler);
  }

  // ---------- 생성 ----------
  private register(id: string, kind: EntryKind, body: Matter.Body, material: Material, role: BodyRole | 'projectile', w: number, h: number, r: number, label?: string): BodyEntry {
    const entry: BodyEntry = {
      id, kind, body, material, role, w, h, r, isStatic: body.isStatic, removed: false, label,
      init: { x: body.position.x, y: body.position.y, angle: body.angle },
    };
    body.label = id;
    this.entries.set(id, entry);
    this.byBodyId.set(body.id, entry);
    if ((kind === 'ball' || kind === 'projectile') && !body.isStatic) this.circles.push(entry);
    Composite.add(this.engine.world, body);
    return entry;
  }

  private buildGround() {
    const h = WORLD_H - GROUND_Y + 200;
    const segs = this.level.ground ?? [{ from: -600, to: WORLD_W + 600 }];
    segs.forEach((seg, i) => {
      const w = seg.to - seg.from;
      const ground = Bodies.rectangle(seg.from + w / 2, GROUND_Y + h / 2, w, h, { isStatic: true, ...matOpts('ground') });
      this.register(i === 0 ? 'ground' : `ground_${i}`, 'ground', ground, 'ground', 'normal', w, h, 0);
    });
  }

  private addBodyDef(def: BodyDef) {
    if (this.entries.has(def.id)) throw new Error(`중복 id: ${def.id}`);
    switch (def.kind) {
      case 'block': {
        const body = Bodies.rectangle(def.x, def.y, def.w, def.h, {
          angle: deg2rad(def.angle ?? 0), isStatic: !!def.static, ...matOpts(def.material),
        });
        this.register(def.id, 'block', body, def.material, def.role ?? 'normal', def.w, def.h, 0, def.label);
        break;
      }
      case 'ball': {
        const body = makeCircle(def.x, def.y, def.r, { isStatic: !!def.static, ...matOpts(def.material) });
        this.register(def.id, 'ball', body, def.material, def.role ?? 'ball', def.r * 2, def.r * 2, def.r);
        break;
      }
      case 'ramp': {
        const { x, y, w, h } = def;
        const pts = def.dir === 'right'
          ? [{ x, y }, { x: x + w, y: y + h }, { x, y: y + h }]
          : [{ x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
        this.addPolygon(def.id, pts, def.material ?? 'stone', true, 'ramp');
        break;
      }
      case 'poly': {
        this.addPolygon(def.id, def.points, def.material ?? 'stone', def.static !== false, 'poly');
        break;
      }
    }
  }

  private addPolygon(id: string, points: Vec2[], material: Material, isStatic: boolean, kind: EntryKind) {
    const verts = Vertices.clockwiseSort(points.map((p) => ({ x: p.x, y: p.y })));
    const c = Vertices.centre(verts);
    const body = Body.create({ position: { x: c.x, y: c.y }, vertices: verts, isStatic, ...matOpts(material) });
    const b = body.bounds;
    this.register(id, kind, body, material, 'normal', b.max.x - b.min.x, b.max.y - b.min.y, 0);
  }

  private addRope(def: RopeDef) {
    const entryA = def.a.body ? this.mustEntry(def.a.body) : undefined;
    const entryB = def.b.body ? this.mustEntry(def.b.body) : undefined;
    if (!entryB && !entryA) throw new Error(`밧줄 ${def.id}: 최소 한쪽은 물체여야 함`);
    const pointA = entryA ? { x: def.a.x - entryA.body.position.x, y: def.a.y - entryA.body.position.y } : { x: def.a.x, y: def.a.y };
    const pointB = entryB ? { x: def.b.x - entryB.body.position.x, y: def.b.y - entryB.body.position.y } : { x: def.b.x, y: def.b.y };
    const restLength = Math.hypot(def.a.x - def.b.x, def.a.y - def.b.y);
    const constraint = Constraint.create({
      bodyA: entryA?.body, pointA, bodyB: entryB?.body, pointB,
      length: restLength, stiffness: 1, damping: 0.02, label: def.id,
    });
    Composite.add(this.engine.world, constraint);
    this.ropes.set(def.id, { id: def.id, def, constraint, restLength, cut: false, entryA, entryB });
  }

  private addHinge(def: HingeDef) {
    const entry = this.mustEntry(def.body);
    const pointB = { x: def.pivot.x - entry.body.position.x, y: def.pivot.y - entry.body.position.y };
    const constraint = Constraint.create({
      pointA: { x: def.pivot.x, y: def.pivot.y }, bodyB: entry.body, pointB,
      length: 0, stiffness: 1, damping: 0, label: def.id,
    });
    Composite.add(this.engine.world, constraint);
    this.hinges.set(def.id, { id: def.id, def, constraint, entry });
  }

  mustEntry(id: string): BodyEntry {
    const e = this.entries.get(id);
    if (!e) throw new Error(`알 수 없는 물체 id: ${id}`);
    return e;
  }

  // ---------- 밧줄 ----------
  ropeEndpoints(rope: RopeEntry): { a: Vec2; b: Vec2 } {
    const c = rope.constraint;
    const a = c.bodyA ? { x: c.bodyA.position.x + c.pointA.x, y: c.bodyA.position.y + c.pointA.y } : { x: c.pointA.x, y: c.pointA.y };
    const b = c.bodyB ? { x: c.bodyB.position.x + c.pointB.x, y: c.bodyB.position.y + c.pointB.y } : { x: c.pointB.x, y: c.pointB.y };
    return { a, b };
  }

  /** 밧줄은 당길 수만 있다: 현재 길이가 원래 길이보다 짧으면 힘을 내지 않게 한다. */
  private relaxSlackRopes() {
    for (const rope of this.ropes.values()) {
      if (rope.cut) continue;
      const { a, b } = this.ropeEndpoints(rope);
      const cur = Math.hypot(a.x - b.x, a.y - b.y);
      rope.constraint.length = cur < rope.restLength ? cur : rope.restLength;
    }
  }

  cutRope(rope: RopeEntry): { a: Vec2; b: Vec2 } | null {
    if (rope.cut) return null;
    const ends = this.ropeEndpoints(rope);
    rope.cut = true;
    Composite.remove(this.engine.world, rope.constraint);
    for (const e of [rope.entryA, rope.entryB]) if (e && !e.removed) Sleeping.set(e.body, false);
    return ends;
  }

  // ---------- 발사체 ----------
  addProjectile(x: number, y: number, vxPerSec: number, vyPerSec: number): BodyEntry {
    const id = `projectile_${++this.projectileSeq}`;
    const body = makeCircle(x, y, PROJECTILE.radius, {
      density: PROJECTILE.density, restitution: PROJECTILE.restitution, friction: PROJECTILE.friction,
      frictionStatic: PROJECTILE.frictionStatic, frictionAir: PROJECTILE.frictionAir,
    });
    const entry = this.register(id, 'projectile', body, 'cutter', 'projectile', PROJECTILE.radius * 2, PROJECTILE.radius * 2, PROJECTILE.radius);
    Body.setVelocity(body, { x: vxPerSec / 60, y: vyPerSec / 60 });
    this.projectiles.push(entry);
    return entry;
  }

  // ---------- 제거 ----------
  removeEntry(entry: BodyEntry) {
    if (entry.removed) return;
    entry.removed = true;
    for (const rope of this.ropes.values()) {
      if (!rope.cut && (rope.entryA === entry || rope.entryB === entry)) this.cutRope(rope);
    }
    for (const h of this.hinges.values()) {
      if (h.entry === entry) Composite.remove(this.engine.world, h.constraint);
    }
    Composite.remove(this.engine.world, entry.body);
  }

  removeOutOfBounds(): BodyEntry[] {
    const gone: BodyEntry[] = [];
    for (const e of this.entries.values()) {
      if (e.removed || e.isStatic) continue;
      const p = e.body.position;
      if (p.y > BOUNDS.maxY || p.x < BOUNDS.minX || p.x > BOUNDS.maxX) { this.removeEntry(e); gone.push(e); }
    }
    return gone;
  }

  // ---------- 시간 진행 ----------
  /** 한 고정 스텝(1/60초) = SUBSTEPS번의 엔진 갱신. 각 서브스텝 뒤 콜백에 발사체 이전 위치를 전달한다. */
  step(afterSubstep?: (prev: Map<BodyEntry, Vec2>) => void) {
    this.hits.length = 0;
    this.protectHits.length = 0;
    const prev = new Map<BodyEntry, Vec2>();
    for (let i = 0; i < SUBSTEPS; i++) {
      prev.clear();
      for (const p of this.projectiles) if (!p.removed) prev.set(p, { x: p.body.position.x, y: p.body.position.y });
      this.relaxSlackRopes();
      Engine.update(this.engine, SUB_DELTA_MS);
      this.applyRollingResistance();
      this.propagateWake();
      afterSubstep?.(prev);
    }
  }

  /** 원형 물체가 무언가와 접촉 중이면 재질의 구름 저항(px/s²)만큼 일정하게 감속한다. 공중에서는 적용하지 않는다. */
  private applyRollingResistance() {
    if (this.circles.length === 0) return;
    const touching = new Set<number>();
    for (const pair of this.engine.pairs.list) {
      if (!pair.isActive) continue;
      touching.add(pair.bodyA.id); touching.add(pair.bodyB.id);
    }
    for (const e of this.circles) {
      if (e.removed || !touching.has(e.body.id)) continue;
      const R = MATERIALS[e.material].rollingResistance ?? 0;
      if (R <= 0) continue;
      const b = e.body;
      if (b.isSleeping) continue;
      const v = Body.getVelocity(b);
      const speed = Math.hypot(v.x, v.y);
      if (speed <= 0) continue;
      const dv = (R * SUB_DELTA_MS / 1000) / 60; // matter 속도 단위(px per 1/60s)
      const ratio = Math.max(0, speed - dv) / speed;
      Body.setVelocity(b, { x: v.x * ratio, y: v.y * ratio });
      Body.setAngularVelocity(b, Body.getAngularVelocity(b) * ratio);
    }
  }

  /** 제약 조건으로 연결된 상대가 움직이면 잠든 물체를 깨운다(엔진은 제약 조건으로 깨우지 않음). */
  private propagateWake() {
    const check = (a?: Matter.Body | null, b?: Matter.Body | null) => {
      if (!a || !b || a.isStatic || b.isStatic) return;
      if (a.isSleeping && !b.isSleeping && Body.getSpeed(b) > SLEEP.propagateWakeSpeed) Sleeping.set(a, false);
      if (b.isSleeping && !a.isSleeping && Body.getSpeed(a) > SLEEP.propagateWakeSpeed) Sleeping.set(b, false);
    };
    for (const r of this.ropes.values()) if (!r.cut) check(r.constraint.bodyA, r.constraint.bodyB);
  }

  private onCollisionStart(e: Matter.IEventCollision<Matter.Engine>) {
    for (const pair of e.pairs) {
      const ea = this.byBodyId.get(pair.bodyA.id);
      const eb = this.byBodyId.get(pair.bodyB.id);
      if (!ea || !eb) continue;
      const va = Body.getVelocity(pair.bodyA), vb = Body.getVelocity(pair.bodyB);
      const speed = Math.hypot(va.x - vb.x, va.y - vb.y);
      const s = pair.collision.supports[0] ?? pair.bodyA.position;
      this.hits.push({ a: ea, b: eb, speed, x: s.x, y: s.y });
      const proj = ea.role === 'projectile' ? ea : eb.role === 'projectile' ? eb : null;
      const prot = ea.role === 'protect' ? ea : eb.role === 'protect' ? eb : null;
      if (proj && prot) this.protectHits.push({ protect: prot, projectile: proj });
    }
  }

  /** 아직 끊어지지 않은 밧줄에 매달린 물체 id 집합 */
  hangingBodies(): Set<number> {
    const out = new Set<number>();
    for (const r of this.ropes.values()) {
      if (r.cut) continue;
      if (r.constraint.bodyA) out.add(r.constraint.bodyA.id);
      if (r.constraint.bodyB) out.add(r.constraint.bodyB.id);
    }
    return out;
  }

  /** 동적(비정적) 물체 목록 — 안정 판정용. */
  dynamicEntries(): BodyEntry[] {
    const out: BodyEntry[] = [];
    for (const e of this.entries.values()) if (!e.removed && !e.isStatic) out.push(e);
    return out;
  }

  captureInitialPoses() {
    for (const e of this.entries.values()) e.init = { x: e.body.position.x, y: e.body.position.y, angle: e.body.angle };
  }

  counts() {
    return { bodies: Composite.allBodies(this.engine.world).length, constraints: Composite.allConstraints(this.engine.world).length };
  }

  dispose() {
    Events.off(this.engine, 'collisionStart', this.collisionHandler);
    Composite.clear(this.engine.world, false, true);
    Engine.clear(this.engine);
  }
}
