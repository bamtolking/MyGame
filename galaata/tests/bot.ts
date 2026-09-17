// 헤드리스 봇: 경로 이동·사격·빙의 명령으로 구역을 실제로 플레이한다(테스트·밸런스용).
import { RULES } from '../src/data/rules';
import { BODIES } from '../src/data/bodies';
import { EMPTY_INPUT, step } from '../src/sim/engine';
import type { Entity, Input } from '../src/sim/types';
import { World } from '../src/sim/world';

const S = RULES.tile;

export interface BotLog { t: number; msg: string }

export class Bot {
  log: BotLog[] = [];
  input: Input = { ...EMPTY_INPUT };
  strafeDir = 1; strafeT = 0;
  constructor(public w: World) {}
  get p(): Entity { return this.w.player; }
  note(msg: string): void { this.log.push({ t: +this.w.time.toFixed(2), msg }); }
  tick(input: Partial<Input> = {}, n = 1): void {
    for (let i = 0; i < n; i++) { this.input = { ...EMPTY_INPUT, ...input }; step(this.w, this.input); if (this.w.phase !== 'playing') return; }
  }
  release(): void { this.tick({}, 1); }
  /** 타일 좌표까지 BFS 경로로 이동. 도착 또는 시간 초과 시 반환 */
  moveTo(tx: number, ty: number, opts: { attack?: boolean; maxSec?: number; stopDist?: number } = {}): boolean {
    const target = { x: tx * S + S / 2, y: ty * S + S / 2 };
    const maxSteps = Math.round((opts.maxSec ?? 12) / RULES.fixedDt);
    for (let i = 0; i < maxSteps; i++) {
      if (this.w.phase !== 'playing') return false;
      const p = this.p; const dd = Math.hypot(target.x - p.x, target.y - p.y);
      if (dd <= (opts.stopDist ?? 10)) return true;
      const ptx = Math.floor(p.x / S), pty = Math.floor(p.y / S);
      let gx = target.x, gy = target.y;
      if (!(ptx === tx && pty === ty)) {
        const path = this.w.map.path(ptx, pty, tx, ty, this.w.staticBlocked());
        if (!path) { this.note(`no path to ${tx},${ty}`); return false; }
        // 첫 노드가 현재 타일 중심 근처면 다음 노드
        let n = path[0]; if (path.length > 1 && Math.hypot(n.tx * S + S / 2 - p.x, n.ty * S + S / 2 - p.y) < 6) n = path[1];
        gx = n.tx * S + S / 2; gy = n.ty * S + S / 2;
      }
      const av = this.avoidance(); if (av) { this.tick({ ...av, attack: false }); continue; }
      const l = Math.hypot(gx - p.x, gy - p.y) || 1;
      this.tick({ mx: (gx - p.x) / l, my: (gy - p.y) / l, attack: !!opts.attack });
    }
    this.note(`moveTo ${tx},${ty} timeout`); return false;
  }
  /** 대상 뒤로 돌아가며(방패 대응) 체력 비율까지 사격 */
  weaken(target: Entity, ratio = RULES.possessHpRatio, maxSec = 20): boolean {
    const maxSteps = Math.round(maxSec / RULES.fixedDt);
    for (let i = 0; i < maxSteps; i++) {
      if (this.w.phase !== 'playing') return false;
      if (!target.alive) { this.note(`target ${target.body} died`); return false; }
      if (target.hp / target.hpMax <= ratio) return true;
      const p = this.p; const wp = BODIES[p.body].weapon;
      const hasBlock = BODIES[target.body].blockArc > 0;
      const av = this.avoidance(); if (av) { this.tick({ ...av, attack: false }); continue; }
      // 원하는 위치: 방패면 등 뒤(궤도 접근), 아니면 사거리 70% 지점
      let gx: number, gy: number;
      if (hasBlock && !wp.overWalls) { const g = this.flankGoal(target); gx = g.x; gy = g.y; }
      else {
        const base = Math.atan2(p.y - target.y, p.x - target.x); const r = Math.min(wp.range * (wp.kind === 'lob' ? 0.8 : 0.7), 200);
        this.strafeT -= RULES.fixedDt; if (this.strafeT <= 0) { this.strafeT = 0.9 + this.w.rng.next() * 0.8; this.strafeDir = -this.strafeDir; }
        const tries = [this.strafeDir * 0.35, 0, -this.strafeDir * 0.35, this.strafeDir * 1.2, -this.strafeDir * 1.2];
        gx = p.x; gy = p.y;
        const others = this.w.entities.filter((e) => e.alive && e.team === 'enemy' && e !== target && e.ai.state === 'alert' && e.body !== 'turret');
        let found = false;
        for (const off of tries) { const cx = target.x + Math.cos(base + off) * r, cy = target.y + Math.sin(base + off) * r; if (!this.w.map.boxBlocked(cx, cy, p.radius) && this.w.map.lineOfSight(p.x, p.y, cx, cy) && !others.some((o) => Math.hypot(o.x - cx, o.y - cy) < 150)) { gx = cx; gy = cy; found = true; break; } }
        if (!found) for (const off of tries) { const cx = target.x + Math.cos(base + off) * r, cy = target.y + Math.sin(base + off) * r; if (!this.w.map.boxBlocked(cx, cy, p.radius)) { gx = cx; gy = cy; break; } }
      }
      const dx = gx - p.x, dy = gy - p.y; const l = Math.hypot(dx, dy);
      const k = this.kite(hasBlock ? target : undefined);
      let mvx = (l > 8 ? dx / l : 0) + k.x * 1.5, mvy = (l > 8 ? dy / l : 0) + k.y * 1.5; const ml = Math.hypot(mvx, mvy); if (ml > 1) { mvx /= ml; mvy /= ml; }
      if (ml > 0.05 && this.w.map.boxBlocked(p.x + mvx * 14, p.y + mvy * 14, p.radius * 0.82)) { const t2 = { x: -mvy, y: mvx }; mvx = t2.x; mvy = t2.y; }
      const inRange = Math.hypot(target.x - p.x, target.y - p.y) <= wp.range + 10 && (wp.overWalls || this.w.map.lineOfSight(p.x, p.y, target.x, target.y));
      const aimOk = wp.kind === 'arc' || this.w.aimTargetId === target.id || this.w.aimTargetId === 0;
      this.tick({ mx: mvx, my: mvy, attack: inRange && aimOk });
    }
    this.note('weaken timeout'); return false;
  }
  /** 빙의 가능 대상에게 접근 후 빙의 */
  possess(target: Entity, maxSec = 8): boolean {
    const maxSteps = Math.round(maxSec / RULES.fixedDt);
    for (let i = 0; i < maxSteps; i++) {
      if (this.w.phase !== 'playing') return false;
      if (!target.alive) return false;
      const p = this.p; const dx = target.x - p.x, dy = target.y - p.y; const l = Math.hypot(dx, dy);
      if (this.w.possessTarget === target && this.w.possessCd <= 0) { this.tick({ possess: true }); this.release(); return this.p.id === target.id; }
      this.tick({ mx: dx / l, my: dy / l });
    }
    this.note('possess timeout'); return false;
  }
  /** 회피 입력(폭탄 착탄·보스 레이저·돌진). 없으면 null */
  avoidance(): Partial<Input> | null {
    const w = this.w; const p = this.p; const d = BODIES[p.body];
    const dashSkill = (d.skill?.id === 'dash' || d.skill?.id === 'sprint') && p.skillCd <= 0;
    const bomb = w.projectiles.find((q) => q.kind === 'bomb' && q.team === 'enemy' && Math.hypot(q.tx - p.x, q.ty - p.y) < q.splash + p.radius + 12);
    if (bomb) { const ax = p.x - bomb.tx, ay = p.y - bomb.ty; const l = Math.hypot(ax, ay) || 1; return { mx: ax / l, my: ay / l, skill: dashSkill }; }
    const boss = w.entities.find((e) => e.alive && e.body === 'boss');
    if (boss) {
      const ai = boss.ai;
      if (ai.laserAge >= 0 && ai.laserAge < 1.35 && ai.laserTarget) {
        const ux = ai.laserTarget.x - boss.x, uy = ai.laserTarget.y - boss.y; const l = Math.hypot(ux, uy) || 1; const nx = -uy / l, ny = ux / l;
        const side = (p.x - boss.x) * nx + (p.y - boss.y) * ny; const distLine = Math.abs(side);
        if (distLine < 60) { const s = side >= 0 ? 1 : -1; return { mx: nx * s, my: ny * s, skill: dashSkill }; }
      }
      if ((ai.chargeTele > 0 || ai.chargeDash > 0) && ai.chargeDir) {
        const nx = -ai.chargeDir.y, ny = ai.chargeDir.x; const side = (p.x - boss.x) * nx + (p.y - boss.y) * ny;
        if (Math.abs(side) < 70) { const s = side >= 0 ? 1 : -1; return { mx: nx * s, my: ny * s, skill: dashSkill }; }
      }
    }
    return null;
  }
  /** 근접형 위협(방패·정비병)에서 멀어지는 벡터(카이팅). 없으면 0 */
  kite(except?: Entity): { x: number; y: number } {
    const p = this.p; let kx = 0, ky = 0;
    for (const e of this.w.entities) {
      if (!e.alive || e.team !== 'enemy' || e === except || e.ai.state !== 'alert') continue;
      if (e.body === 'turret' || e.body === 'node') continue;
      const wp = BODIES[e.body].weapon; const near = e.body === 'boss' ? 150 : wp.range > 140 ? 110 : 140;
      const dx = p.x - e.x, dy = p.y - e.y; const d = Math.hypot(dx, dy) || 1;
      if (d < near && (e.body === 'boss' || BODIES[p.body].speed >= BODIES[e.body].speed)) { const f = (near - d) / near; kx += (dx / d) * f; ky += (dy / d) * f; }
    }
    return { x: kx, y: ky };
  }
  /** 표적이 보이고 사거리 안이며 걸어갈 수 있는 가장 가까운 타일 중심(사격 위치). 없으면 null */
  firingSpot(target: Entity, range: number): { x: number; y: number } | null {
    const w = this.w; const p = this.p; const m = w.map; const blocked = w.staticBlocked();
    const ptx = Math.floor(p.x / S), pty = Math.floor(p.y / S); const field = m.flowField(ptx, pty, blocked);
    let best: { x: number; y: number } | null = null; let bd = Infinity;
    const r = Math.ceil(range / S);
    const ttx = Math.floor(target.x / S), tty = Math.floor(target.y / S);
    for (let ty = tty - r; ty <= tty + r; ty++) for (let tx = ttx - r; tx <= ttx + r; tx++) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
      const idx = ty * m.w + tx; if (field[idx] < 0) continue;
      const cx = tx * S + S / 2, cy = ty * S + S / 2; const dd = Math.hypot(cx - target.x, cy - target.y);
      if (dd > range * 0.9 || dd < 40) continue;
      if (!m.lineOfSight(cx, cy, target.x, target.y)) continue;
      const cost = field[idx] * S + dd * 0.3; if (cost < bd) { bd = cost; best = { x: cx, y: cy }; }
    }
    return best;
  }
  /** 방패 상대 자리: 정면 호 안에 있으면 궤도를 돌아 등 뒤로, 아니면 등 뒤 지점 */
  flankGoal(target: Entity): { x: number; y: number } {
    const p = this.p; const td = BODIES[target.body];
    const rel = Math.atan2(p.y - target.y, p.x - target.x);
    let diff = rel - target.facing; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    const arc = (target.skillUntil > this.w.time ? td.guardArc : td.blockArc) + 0.35;
    const r = 78;
    if (Math.abs(diff) < arc) { const dir = diff >= 0 ? 1 : -1; const a = rel + dir * 0.9; return { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r }; }
    return { x: target.x - Math.cos(target.facing) * 62, y: target.y - Math.sin(target.facing) * 62 };
  }
  useSkill(): void { this.tick({ skill: true }); this.release(); }
  interact(): void { this.tick({ interact: true }); this.release(); }
  wait(sec: number, input: Partial<Input> = {}): void { this.tick(input, Math.round(sec / RULES.fixedDt)); }
  nearestEnemy(body?: string): Entity | null {
    let best: Entity | null = null; let bd = Infinity;
    for (const e of this.w.entities) { if (!e.alive || e.team !== 'enemy' || (body && e.body !== body)) continue; const d = Math.hypot(e.x - this.p.x, e.y - this.p.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  /** 근처 적을 전부 처치(단순 킬 전략) */
  killAll(maxSec = 60, filter?: (e: Entity) => boolean): void {
    const end = this.w.time + maxSec;
    while (this.w.time < end && this.w.phase === 'playing') {
      const t = this.w.entities.filter((e) => e.alive && e.team === 'enemy' && e.body !== 'turret' && e.body !== 'boss' && e.body !== 'node' && (!filter || filter(e))).sort((a, b) => Math.hypot(a.x - this.p.x, a.y - this.p.y) - Math.hypot(b.x - this.p.x, b.y - this.p.y))[0];
      if (!t) return;
      const ok = this.weaken(t, 0, 25);
      if (!ok && t.alive) { this.note(`killAll: could not kill ${t.body}`); return; }
    }
  }
}

/** 자동 전투 정책(난이도 탐침): 위협 우선 교전, 폭탄 회피, 위험하면 빙의, 적이 없으면 목표 지점으로. */
export interface AutoOpts {
  maxSec: number;
  goal?: { tx: number; ty: number };
  possessBelow?: number;
  boss?: boolean;
  /** 이 몸은 남겨둠(약화돼도 더 쏘지 않고 빙의 대상으로 아낌) */
  keepAlive?: string[];
  stopWhen?: (w: World) => boolean;
  /** 교전 대상 탐색 거리 */
  engage?: number;
}
function flankable(w: World, p: Entity, t: Entity): boolean {
  const td = BODIES[t.body]; const pd = BODIES[p.body];
  if (!td.blockArc) return true;
  if (pd.weapon.overWalls) return true; // 폭탄은 위에서
  return pd.speed >= td.speed * 1.4; // 빠른 몸만 등 뒤로 돌아갈 수 있음
}
export function autoplay(bot: Bot, o: AutoOpts): void {
  const w = bot.w; const end = w.time + o.maxSec; const pb = o.possessBelow ?? 0.4; const engage = o.engage ?? 420;
  let strafe = 1; let strafeT = 0;
  while (w.time < end && w.phase === 'playing') {
    if (o.stopWhen && o.stopWhen(w)) return;
    const p = bot.p; const d = BODIES[p.body];
    const hpr = p.hp / p.hpMax; const str = p.stability != null && p.stabilityMax ? p.stability / p.stabilityMax : 1;
    const danger = hpr < pb || str < 0.28 || p.collapsing || !!w.lastChance;
    // 0) 폭탄 회피: 착탄 예정 지점이 가까우면 반대로
    const av = bot.avoidance(); if (av && !w.lastChance) { bot.tick({ ...av, attack: false }); continue; }
    // 1) 위험하면 빙의(후보가 있으면 접근)
    if (danger) {
      const score = (c: Entity) => Math.hypot(c.x - p.x, c.y - p.y) - (c.stunUntil > w.time ? 200 : 0) - (c.body === 'scout' ? -60 : 0) - c.hp;
      const cands = w.candidates.filter((c) => !(o.keepAlive ?? []).includes(c.body) || hpr < 0.2 || !!w.lastChance).sort((a, b) => score(a) - score(b));
      const c = cands[0];
      if (c) {
        if (w.possessTarget && w.possessCd <= 0 && (w.possessTarget === c || w.lastChance)) { bot.tick({ possess: true }); bot.release(); continue; }
        const dx = c.x - p.x, dy = c.y - p.y; const l = Math.hypot(dx, dy) || 1;
        bot.tick({ mx: dx / l, my: dy / l, attack: false, skill: (d.skill?.id === 'dash' || d.skill?.id === 'sprint') && p.skillCd <= 0 });
        continue;
      }
    }
    // 1.5) 보스전 몸 선호: 더 유리한 몸이 후보면 갈아탐(저격>폭탄>정비>방패>정찰)
    if (o.boss && w.possessTarget && w.possessCd <= 0) {
      const rank: Record<string, number> = { sniper: 5, bomber: 4, mechanic: 3, shield: 2, scout: 1, intruder: 0 };
      const boss = w.entities.find((e) => e.alive && e.body === 'boss');
      const want = boss && boss.ai.shielded ? { sniper: 5, bomber: 4, shield: 3, mechanic: 2, scout: 1, intruder: 0 } as Record<string, number> : rank;
      if ((want[w.possessTarget.body] ?? 0) > (want[p.body] ?? 0) && w.possessTarget.hp / w.possessTarget.hpMax >= 0.25) { bot.tick({ possess: true }); bot.release(); continue; }
    }
    // 2) 표적 선택: 보스전은 노드/보스, 아니면 경계 중인 적 → 가까운 적. 남겨둘 몸·못 뚫는 방패는 제외
    const enemies = w.entities.filter((e) => e.alive && e.team === 'enemy');
    const keepList = o.keepAlive ?? [];
    let target: Entity | undefined;
    const dist = (e: Entity) => Math.hypot(e.x - p.x, e.y - p.y);
    if (o.boss) {
      const boss = enemies.find((e) => e.body === 'boss'); const nodes = enemies.filter((e) => e.body === 'node');
      const soldiers = enemies.filter((e) => e.body !== 'boss' && e.body !== 'node' && e.body !== 'turret' && flankable(w, p, e));
      const near = soldiers.filter((e) => dist(e) < 160 && !keepList.includes(e.body));
      if (near.length) target = near.sort((a, b) => a.hp - b.hp)[0];
      else if (boss && boss.ai.shielded && nodes.length) target = nodes.sort((a, b) => dist(a) - dist(b))[0];
      else if (boss && !boss.ai.shielded && !(boss.ai.chargeTele > 0 || boss.ai.chargeDash > 0)) target = boss;
      else target = soldiers.filter((e) => !keepList.includes(e.body))[0];
    } else {
      const soldiers = enemies.filter((e) => e.body !== 'turret' && e.body !== 'node' && dist(e) < engage && flankable(w, p, e));
      const threats = soldiers.filter((e) => e.ai.state === 'alert' && !keepList.includes(e.body));
      const pool = threats.length ? threats : soldiers.filter((e) => !keepList.includes(e.body));
      target = pool.sort((a, b) => dist(a) - dist(b))[0];
      if (!target) { const t2 = enemies.filter((e) => e.body === 'turret' && !e.disabled && dist(e) < 200 && w.map.lineOfSight(p.x, p.y, e.x, e.y)); target = t2[0]; }
    }
    if (!target) {
      if (o.goal) { const ok = bot.moveTo(o.goal.tx, o.goal.ty, { maxSec: 4 }); if (ok) return; continue; }
      bot.tick({}); continue;
    }
    // 3) 자리 잡기(사거리 65% 지점, 좌우 이동) — 방패는 등 뒤
    const wp = d.weapon; const hasBlock = BODIES[target.body].blockArc > 0;
    const tdx = target.x - p.x, tdy = target.y - p.y; const td = Math.hypot(tdx, tdy) || 1;
    let gx: number, gy: number;
    const desired = target.body === 'boss' ? 170 : Math.min(wp.range * 0.65, 160);
    if (hasBlock && !wp.overWalls) { const g = bot.flankGoal(target); gx = g.x; gy = g.y; }
    else {
      strafeT -= RULES.fixedDt; if (strafeT <= 0) { strafeT = 1.0 + w.rng.next(); strafe = -strafe; }
      const a = Math.atan2(-tdy, -tdx) + strafe * 0.55;
      gx = target.x + Math.cos(a) * desired; gy = target.y + Math.sin(a) * desired;
      if (w.map.boxBlocked(gx, gy, p.radius * 0.82)) { strafe = -strafe; const a2 = Math.atan2(-tdy, -tdx) + strafe * 0.55; gx = target.x + Math.cos(a2) * desired; gy = target.y + Math.sin(a2) * desired; }
    }
    const los = w.map.lineOfSight(p.x, p.y, target.x, target.y);
    if (target.body === 'boss' && w.map.boxBlocked(gx, gy, p.radius * 0.82)) { for (const off of [0, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4]) { const a2 = Math.atan2(-tdy, -tdx) + off; const cx = target.x + Math.cos(a2) * desired, cy = target.y + Math.sin(a2) * desired; if (!w.map.boxBlocked(cx, cy, p.radius * 0.82)) { gx = cx; gy = cy; break; } } }
    else if (w.map.boxBlocked(gx, gy, p.radius * 0.82) || (!los && !wp.overWalls)) {
      const spot = bot.firingSpot(target, wp.range + (wp.splash ?? 0) * 0.5);
      if (spot) { const ptx = Math.floor(p.x / S), pty = Math.floor(p.y / S); const path = w.map.path(ptx, pty, Math.floor(spot.x / S), Math.floor(spot.y / S), w.staticBlocked()); if (path && path.length) { const n = path[0]; gx = n.tx * S + S / 2; gy = n.ty * S + S / 2; } else { gx = spot.x; gy = spot.y; } }
      else { const ptx = Math.floor(p.x / S), pty = Math.floor(p.y / S); const path = w.map.path(ptx, pty, Math.floor(target.x / S), Math.floor(target.y / S), w.staticBlocked()); if (path && path.length) { const n = path[0]; gx = n.tx * S + S / 2; gy = n.ty * S + S / 2; } }
    }
    const mdx = gx - p.x, mdy = gy - p.y; const ml = Math.hypot(mdx, mdy);
    const k = bot.kite(hasBlock ? target : undefined);
    let mvx = (ml > 6 ? mdx / ml : 0) + k.x * 1.5, mvy = (ml > 6 ? mdy / ml : 0) + k.y * 1.5; const mll = Math.hypot(mvx, mvy); if (mll > 1) { mvx /= mll; mvy /= mll; }
    const mv = { mx: mvx, my: mvy };
    const inRange = td <= wp.range + target.radius && (wp.overWalls || los);
    let skill = false;
    if (p.skillCd <= 0 && d.skill) {
      if (d.skill.id === 'repairpulse' && (hpr < 0.7 || td < 90)) skill = true;
      if (d.skill.id === 'aimshot' && inRange && td > 180) skill = true;
      if (d.skill.id === 'guard' && hpr < 0.8 && td < 200 && enemies.filter((e) => e.ai.state === 'alert').length > 1) skill = true;
      if (d.skill.id === 'bigbomb' && td < 70 && hpr > 0.6) skill = true;
    }
    bot.tick({ ...mv, attack: inRange, skill });
  }
}
