// 전투: 타깃 선택, 유닛별 공격, 투사체, 피해·상태 효과, 적 이동·보스 패턴.
import type { GameState, Enemy, Unit, Projectile } from './types';
import { UNITS, UNIT_PARAMS, STATUS, unitStats, type UnitKind, type Grade } from '../data/units';
import { ENEMIES, DRONE, BOSS } from '../data/enemies';
import { COMBO_NUM } from '../data/combos';
import { mapSlots, pathGeo, posAt } from '../data/maps';
import { spawnEnemy, unitPos, pushLog, rand } from './state';
import { tryIgnite, focusBonus, shardsOnLaser, tryFireVortex, noteCombo } from './combos';

export interface DmgCtx { unit: Unit | null; kind: UnitKind; combo: boolean; dtype: 'direct' | 'dot' | 'explosion' | 'beam' | 'chain'; pierce?: boolean }

// ---------- 조회 ----------
export function eRadius(e: Enemy): number { return ENEMIES[e.kind].radius; }
/** 반경 r 안의 살아있는 적(적 반경 포함) */
export function enemiesNear(s: GameState, x: number, y: number, r: number): Enemy[] {
  const out: Enemy[] = [];
  for (const e of s.enemies) if (e.alive && Math.hypot(e.x - x, e.y - y) <= r + eRadius(e)) out.push(e);
  return out;
}
const near = enemiesNear;

/** 가장 앞선(기지에 가까운) 적 */
export function pickTarget(s: GameState, x: number, y: number, range: number): Enemy | null {
  let best: Enemy | null = null;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (Math.hypot(e.x - x, e.y - y) > range + eRadius(e)) continue;
    if (!best || e.dist > best.dist) best = e;
  }
  return best;
}

// ---------- 지원(공병) 컨텍스트 ----------
export interface UnitCtx { haste: number; engGrade: Grade | 0 }
export function computeCtx(s: GameState): Map<number, UnitCtx> {
  const m = new Map<number, UnitCtx>();
  const engs = s.units.filter(u => u.kind === 'engineer');
  for (const u of s.units) {
    if (u.kind === 'engineer') { m.set(u.id, { haste: 0, engGrade: 0 }); continue; }
    const [x, y] = unitPos(s, u);
    const vals: number[] = []; let eg: Grade | 0 = 0;
    for (const e of engs) {
      const [ex, ey] = unitPos(s, e); const r = unitStats('engineer', e.grade).range;
      if (Math.hypot(ex - x, ey - y) <= r) { vals.push(UNIT_PARAMS.engineer.haste[e.grade]); if (e.grade > eg) eg = e.grade; }
    }
    vals.sort((a, b) => b - a);
    let h = vals[0] || 0; if (vals[1]) h += vals[1] * UNIT_PARAMS.engineer.stackSecond;
    m.set(u.id, { haste: Math.min(UNIT_PARAMS.engineer.hasteCap, h), engGrade: eg });
  }
  return m;
}

// ---------- 피해·상태 ----------
export function hitEnemy(s: GameState, e: Enemy, amount: number, ctx: DmgCtx): number {
  if (!e.alive || amount <= 0) return 0;
  let dmg = amount;
  if (ctx.dtype !== 'dot' && e.armor > 0) dmg = Math.max(1, dmg - e.armor);
  if (e.st.shield > 0 && !ctx.pierce) {
    const absorbed = Math.min(e.st.shield, dmg); e.st.shield -= absorbed; dmg -= absorbed;
    if (e.st.shield <= 0) { e.st.shield = 0; e.st.shieldT = 0; }
  }
  if (dmg <= 0) return 0;
  e.hp -= dmg;
  s.stats.dmgByKind[ctx.kind] = (s.stats.dmgByKind[ctx.kind] || 0) + dmg;
  if (ctx.unit) ctx.unit.dmg += dmg;
  if (ctx.dtype === 'dot') { e.dotAcc += dmg; }
  else s.events.push({ t: 'hit', enemy: e.id, x: e.x, y: e.y, dmg, kind: ctx.kind });
  if (e.hp <= 0) killEnemy(s, e, ctx.unit);
  return dmg;
}

export function killEnemy(s: GameState, e: Enemy, by: Unit | null): void {
  if (!e.alive) return;
  e.alive = false; e.hp = 0;
  if (e.dotAcc > 0) { s.events.push({ t: 'hit', enemy: e.id, x: e.x, y: e.y, dmg: e.dotAcc, kind: 'burn' }); e.dotAcc = 0; }
  const d = ENEMIES[e.kind];
  if (e.reward > 0) { s.gold += e.reward; s.stats.goldEarned += e.reward; }
  s.stats.kills++; if (by) by.kills++;
  if (d.boss) { s.stats.bossKills.push(e.kind); pushLog(s, `${d.name} 격파!`, 'good'); }
  s.events.push({ t: 'die', enemy: e.id, kind: e.kind, x: e.x, y: e.y, boss: d.boss });
}

export function applyBurn(s: GameState, e: Enemy, dps: number, dur: number): void {
  if (!e.alive) return;
  const fresh = e.st.burn <= 0;
  e.st.burnDps = Math.max(e.st.burnDps, dps); e.st.burn = Math.max(e.st.burn, dur); // 중첩 없음: 더 센 값·긴 시간만 유지
  if (fresh) s.events.push({ t: 'status', enemy: e.id, x: e.x, y: e.y, kind: 'burn' });
}
export function applyOil(s: GameState, e: Enemy, dur: number): void {
  if (!e.alive) return;
  const fresh = e.st.oil <= 0; e.st.oil = Math.max(e.st.oil, dur);
  if (fresh) s.events.push({ t: 'status', enemy: e.id, x: e.x, y: e.y, kind: 'oil' });
}
export function applyChill(s: GameState, e: Enemy, pct: number, dur: number): void {
  if (!e.alive) return;
  const d = ENEMIES[e.kind]; if (d.ctrlResist) pct *= 0.5;
  const fresh = e.st.chill <= 0;
  e.st.chillPct = Math.min(UNIT_PARAMS.frost.chillCap, Math.max(e.st.chillPct, pct)); e.st.chill = Math.max(e.st.chill, dur);
  if (fresh) s.events.push({ t: 'status', enemy: e.id, x: e.x, y: e.y, kind: 'chill' });
}
export function applyFreeze(s: GameState, e: Enemy, dur: number): boolean {
  if (!e.alive || ENEMIES[e.kind].ctrlResist || e.st.freezeImmune > 0 || e.st.frozen > 0) return false;
  e.st.frozen = dur; e.st.freezeImmune = UNIT_PARAMS.frost.freezeImmune + dur;
  s.events.push({ t: 'status', enemy: e.id, x: e.x, y: e.y, kind: 'freeze' });
  return true;
}
export function applyMark(s: GameState, e: Enemy, dur: number): void {
  if (!e.alive) return; const fresh = e.st.mark <= 0; e.st.mark = Math.max(e.st.mark, dur);
  if (fresh) s.events.push({ t: 'status', enemy: e.id, x: e.x, y: e.y, kind: 'mark' });
}
export function applyShield(s: GameState, e: Enemy, hp: number, dur: number): void {
  if (!e.alive) return; e.st.shield = hp; e.st.shieldT = dur;
  s.events.push({ t: 'status', enemy: e.id, x: e.x, y: e.y, kind: 'shield' });
}

/** 적의 현재 이동 속도(감속·빙결·보스 상태 반영) */
export function enemySpeed(e: Enemy): number {
  if (e.st.frozen > 0) return 0;
  let v = e.speed * (1 - Math.min(UNIT_PARAMS.frost.chillCap, e.st.chill > 0 ? e.st.chillPct : 0)) * (1 - e.st.bossSlow);
  if (e.boss) { if (e.boss.hasteT > 0) v *= BOSS.core.hasteMul; if (e.boss.enraged) v *= BOSS.golem.enrageSpeedMul; }
  return v;
}
function predictPos(s: GameState, e: Enemy, t: number): [number, number] {
  const g = pathGeo(s.mapId); return posAt(g, Math.min(g.len, e.dist + enemySpeed(e) * t));
}

// ---------- 유닛 공격 ----------
export function updateUnits(s: GameState, dt: number, ctx: Map<number, UnitCtx>): void {
  for (const u of s.units) {
    const c = ctx.get(u.id)!;
    if (u.moveCd > 0) u.moveCd = Math.max(0, u.moveCd - dt);
    if (u.fireVortexCd > 0) u.fireVortexCd = Math.max(0, u.fireVortexCd - dt);
    const [x, y] = unitPos(s, u);
    const st = unitStats(u.kind, u.grade);
    if (u.kind === 'engineer') {
      if (u.grade === 3) {
        u.pulseT += dt;
        if (u.pulseT >= UNIT_PARAMS.engineer.pulseInterval3) {
          u.pulseT = 0;
          for (const o of s.units) if (o.kind !== 'engineer' && Math.hypot(...diff(unitPos(s, o), [x, y])) <= st.range) o.boost = UNIT_PARAMS.engineer.pulseMul3;
          s.events.push({ t: 'engpulse', unit: u.id, x, y, r: st.range });
        }
      }
      continue;
    }
    // 연계 ⑥ 과충전 충전(레이저가 공병 범위 안일 때만)
    if (u.kind === 'laser' && c.engGrade > 0 && !u.overcharged) {
      u.charge += dt;
      if (u.charge >= UNIT_PARAMS.engineer.overchargeInterval[c.engGrade as Grade]) { u.charge = 0; u.overcharged = true; s.events.push({ t: 'overcharge', unit: u.id, x, y }); }
    } else if (u.kind === 'laser' && c.engGrade === 0) u.charge = 0;
    // 회오리 지속 효과
    if (u.kind === 'vortex') updateVortex(s, u, dt, x, y, st.range);
    if (u.cd > 0) { u.cd -= dt * (1 + c.haste); if (u.cd > 0) continue; }
    u.cd = 0;
    if (u.kind === 'vortex') { if (near(s, x, y, st.range).length) { startVortex(s, u, x, y, st); u.cd = st.cd; } continue; }
    if (u.kind === 'laser') { const boost = u.boost; if (attackLaser(s, u, x, y, st, boost)) { u.boost = 1; u.cd = st.cd; } continue; }
    const target = pickTarget(s, x, y, st.range);
    if (!target) continue;
    u.facing = Math.atan2(target.y - y, target.x - x);
    const boost = u.boost; u.boost = 1;
    switch (u.kind) {
      case 'flame': attackFlame(s, u, x, y, st, target, boost); break;
      case 'oil': lob(s, u, 'oil', x, y, target, st.dmg * boost, UNIT_PARAMS.oil.splash[u.grade], 0.55); break;
      case 'frost': shootHoming(s, u, 'frost', x, y, target, st.dmg * boost, UNIT_PARAMS.frost.projSpeed, u.grade === 3 ? UNIT_PARAMS.frost.splash3 : 0); break;
      case 'tesla': attackTesla(s, u, x, y, st, target, boost); break;
      case 'bomber': lob(s, u, 'bomb', x, y, target, st.dmg * boost, UNIT_PARAMS.bomber.radius[u.grade], UNIT_PARAMS.bomber.flight); break;
    }
    u.cd = st.cd;
  }
}
function diff(a: [number, number], b: [number, number]): [number, number] { return [a[0] - b[0], a[1] - b[1]]; }

function attackFlame(s: GameState, u: Unit, x: number, y: number, st: { dmg: number; range: number }, target: Enemy, boost: number): void {
  if (u.grade < 3) { shootHoming(s, u, 'flame', x, y, target, st.dmg * boost, UNIT_PARAMS.flame.projSpeed, 0); return; }
  // 3등급: 부채꼴 화염 방사(즉시 판정). 표시 범위 = 판정 범위.
  const spread = UNIT_PARAMS.flame.coneAngle; const ang = u.facing;
  s.events.push({ t: 'cone', unit: u.id, x, y, angle: ang, spread, range: st.range });
  s.events.push({ t: 'shoot', unit: u.id, kind: 'flame', grade: 3, x, y, tx: target.x, ty: target.y, boost: boost > 1 });
  for (const e of near(s, x, y, st.range)) {
    const a = Math.atan2(e.y - y, e.x - x); let d = Math.abs(a - ang); if (d > Math.PI) d = Math.PI * 2 - d;
    if (d > spread / 2) continue;
    flameHit(s, u, e, st.dmg * boost);
  }
}
export function flameHit(s: GameState, u: Unit, e: Enemy, dmg: number): void {
  hitEnemy(s, e, dmg, { unit: u, kind: 'flame', combo: false, dtype: 'direct' });
  if (!e.alive) return;
  applyBurn(s, e, UNIT_PARAMS.flame.burnDps[u.grade], UNIT_PARAMS.flame.burnDur);
  tryIgnite(s, e, u, dmg);
}

function shootHoming(s: GameState, u: Unit, kind: 'flame' | 'frost', x: number, y: number, target: Enemy, dmg: number, speed: number, radius: number): void {
  const dist = Math.hypot(target.x - x, target.y - y);
  s.projectiles.push({ id: s.nextId++, kind, x, y, sx: x, sy: y, tx: target.x, ty: target.y, targetId: target.id, t: 0, dur: Math.max(0.08, dist / speed), dmg, src: u.id, srcKind: u.kind, grade: u.grade, radius, combo: false, boost: 1 });
  s.events.push({ t: 'shoot', unit: u.id, kind: u.kind, grade: u.grade, x, y, tx: target.x, ty: target.y });
}
function lob(s: GameState, u: Unit, kind: 'oil' | 'bomb', x: number, y: number, target: Enemy, dmg: number, radius: number, flight: number): void {
  const [tx, ty] = predictPos(s, target, flight);
  s.projectiles.push({ id: s.nextId++, kind, x, y, sx: x, sy: y, tx, ty, targetId: -1, t: 0, dur: flight, dmg, src: u.id, srcKind: u.kind, grade: u.grade, radius, combo: false, boost: 1 });
  s.events.push({ t: 'shoot', unit: u.id, kind: u.kind, grade: u.grade, x, y, tx, ty });
}

/** 레이저 조준: 사거리 안 후보 각각을 향한 광선이 관통하는 적 수를 세어 가장 많이 맞는 방향(동률이면 더 앞선 적)을 고릅니다. */
export function laserAim(s: GameState, x: number, y: number, range: number, len: number, width: number): { target: Enemy; hits: Enemy[] } | null {
  let best: { target: Enemy; hits: Enemy[] } | null = null; let bestScore = -1;
  for (const c of s.enemies) {
    if (!c.alive || Math.hypot(c.x - x, c.y - y) > range + eRadius(c)) continue;
    const hits = beamHits(s, x, y, Math.atan2(c.y - y, c.x - x), len, width);
    const score = hits.length * 100000 + c.dist;
    if (score > bestScore) { bestScore = score; best = { target: c, hits }; }
  }
  return best;
}
export function beamHits(s: GameState, x: number, y: number, ang: number, len: number, width: number): Enemy[] {
  const dx = Math.cos(ang), dy = Math.sin(ang); const out: Enemy[] = [];
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const px = e.x - x, py = e.y - y; const t = Math.max(0, Math.min(len, px * dx + py * dy));
    const cx = x + dx * t, cy = y + dy * t; if (Math.hypot(e.x - cx, e.y - cy) <= width / 2 + eRadius(e)) out.push(e);
  }
  return out;
}
function attackLaser(s: GameState, u: Unit, x: number, y: number, st: { dmg: number; range: number }, boost: number): boolean {
  const over = u.overcharged;
  let len = UNIT_PARAMS.laser.length[u.grade], width = UNIT_PARAMS.laser.width[u.grade], dmg = st.dmg * boost;
  if (over) { len += COMBO_NUM.overchargeLenBonus; width *= COMBO_NUM.overchargeWidthMul; dmg *= COMBO_NUM.overchargeDmgMul; }
  const aim = laserAim(s, x, y, st.range, len, width); if (!aim) return false;
  u.overcharged = false; if (over) noteCombo(s, 'overcharge', x, y);
  u.facing = Math.atan2(aim.target.y - y, aim.target.x - x);
  const dx = Math.cos(u.facing), dy = Math.sin(u.facing);
  const x2 = x + dx * len, y2 = y + dy * len;
  s.events.push({ t: 'beam', unit: u.id, x, y, x2, y2, width, over, grade: u.grade });
  s.events.push({ t: 'shoot', unit: u.id, kind: 'laser', grade: u.grade, x, y, tx: x2, ty: y2, boost: over });
  for (const e of aim.hits) {
    if (!e.alive) continue;
    const mul = shardsOnLaser(s, e, u);
    hitEnemy(s, e, dmg * mul, { unit: u, kind: 'laser', combo: false, dtype: 'beam', pierce: over });
  }
  return true;
}

function attackTesla(s: GameState, u: Unit, x: number, y: number, st: { dmg: number }, first: Enemy, boost: number): void {
  const p = UNIT_PARAMS.tesla; let maxT = p.targets[u.grade]; const jump = p.jump[u.grade]; const fall = p.falloff[u.grade];
  const visited = new Set<number>(); const pts = [x, y]; let cur: Enemy | null = first; let dmg = st.dmg * boost; let frost = false; let extraGiven = false;
  while (cur && visited.size < Math.min(maxT, COMBO_NUM.chainMax)) {
    visited.add(cur.id); pts.push(cur.x, cur.y);
    const chilled = cur.st.chill > 0 || cur.st.frozen > 0;
    if (chilled && !extraGiven) { extraGiven = true; maxT += COMBO_NUM.chainExtra; frost = true; noteCombo(s, 'chainfrost', cur.x, cur.y); }
    hitEnemy(s, cur, dmg * (chilled ? COMBO_NUM.chainFrostDmgMul : 1), { unit: u, kind: 'tesla', combo: false, dtype: 'chain' });
    const jr = jump + (chilled ? COMBO_NUM.chainJumpBonus : 0);
    let next: Enemy | null = null, bd = Infinity;
    for (const e of s.enemies) { if (!e.alive || visited.has(e.id)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d <= jr && d < bd) { bd = d; next = e; } }
    dmg *= fall; cur = next;
  }
  s.events.push({ t: 'chain', pts, frost, grade: u.grade });
  s.events.push({ t: 'shoot', unit: u.id, kind: 'tesla', grade: u.grade, x, y, tx: first.x, ty: first.y });
}

// ---------- 회오리 ----------
function startVortex(s: GameState, u: Unit, x: number, y: number, st: { dmg: number; range: number }): void {
  const p = UNIT_PARAMS.vortex; const inRange = near(s, x, y, st.range);
  const fire = tryFireVortex(s, u, x, y, inRange);
  u.pullT = p.pullDur;
  for (const e of inRange) {
    hitEnemy(s, e, st.dmg, { unit: u, kind: 'vortex', combo: false, dtype: 'direct' });
    if (!e.alive) continue;
    applyMark(s, e, p.markDur[u.grade]);
    if (ENEMIES[e.kind].ctrlResist) { e.st.bossSlow = p.bossSlow; e.st.bossSlowT = p.bossSlowDur; }
  }
  s.events.push({ t: 'vortex', unit: u.id, x, y, r: st.range, fire: fire || u.fireVortexT > 0, grade: u.grade });
}
function updateVortex(s: GameState, u: Unit, dt: number, x: number, y: number, range: number): void {
  const p = UNIT_PARAMS.vortex; const anchor = mapSlots(s.mapId)[u.slot].anchorDist; const g = pathGeo(s.mapId);
  if (u.fireVortexT > 0) {
    u.fireVortexT = Math.max(0, u.fireVortexT - dt);
    const dps = STATUS.fireVortexDps[u.grade];
    for (const e of near(s, x, y, range)) hitEnemy(s, e, dps * dt, { unit: u, kind: 'vortex', combo: true, dtype: 'dot' });
  }
  if (u.pullT <= 0) return;
  u.pullT = Math.max(0, u.pullT - dt);
  const v = p.pullSpeed[u.grade] * dt;
  for (const e of near(s, x, y, range)) {
    if (ENEMIES[e.kind].ctrlResist || e.st.frozen > 0) continue;
    if (Math.abs(e.dist - anchor) > range * 1.3) continue; // 경로상 멀리 떨어진(다른 구간) 적은 끌지 않음
    if (e.dist > anchor) e.dist = Math.max(anchor, e.dist - v); else if (e.dist < anchor) e.dist = Math.min(anchor, e.dist + v);
    e.pullBy = u.id; const [px, py] = posAt(g, e.dist); e.x = px; e.y = py;
  }
}

// ---------- 투사체 ----------
export function updateProjectiles(s: GameState, dt: number): void {
  const keep: Projectile[] = [];
  for (const p of s.projectiles) {
    p.t += dt;
    if (p.targetId >= 0) { const e = s.enemies.find(e => e.id === p.targetId); if (e && e.alive) { p.tx = e.x; p.ty = e.y; } }
    const k = Math.min(1, p.t / p.dur);
    p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
    if (k < 1) { keep.push(p); continue; }
    landProjectile(s, p);
  }
  s.projectiles = keep;
}
function landProjectile(s: GameState, p: Projectile): void {
  const u = s.units.find(u => u.id === p.src) || null;
  const uu = u ?? ghostUnit(p);
  switch (p.kind) {
    case 'flame': { const e = s.enemies.find(e => e.id === p.targetId); if (e && e.alive) flameHit(s, uu, e, p.dmg); break; }
    case 'frost': {
      const e = s.enemies.find(e => e.id === p.targetId);
      if (p.radius > 0) {
        s.events.push({ t: 'explode', x: p.x, y: p.y, r: p.radius, kind: 'frostsplash' });
        for (const o of near(s, p.x, p.y, p.radius)) {
          hitEnemy(s, o, o.id === p.targetId ? p.dmg : p.dmg * 0.5, { unit: u, kind: 'frost', combo: false, dtype: 'direct' });
          if (o.alive) { applyChill(s, o, UNIT_PARAMS.frost.chillPct[p.grade], UNIT_PARAMS.frost.chillDur); applyFreeze(s, o, UNIT_PARAMS.frost.freeze3); }
        }
      } else if (e && e.alive) {
        hitEnemy(s, e, p.dmg, { unit: u, kind: 'frost', combo: false, dtype: 'direct' });
        if (e.alive) applyChill(s, e, UNIT_PARAMS.frost.chillPct[p.grade], UNIT_PARAMS.frost.chillDur);
      }
      break;
    }
    case 'oil': {
      for (const o of near(s, p.x, p.y, p.radius)) { hitEnemy(s, o, p.dmg, { unit: u, kind: 'oil', combo: false, dtype: 'direct' }); if (o.alive) applyOil(s, o, UNIT_PARAMS.oil.oilDur[p.grade]); }
      s.events.push({ t: 'status', enemy: -1, x: p.x, y: p.y, kind: 'oil' });
      break;
    }
    case 'bomb': {
      let r = p.radius, dmg = p.dmg; const fb = focusBonus(s, p.x, p.y, r);
      if (fb) { r *= fb.rMul; dmg *= fb.dmgMul; }
      s.events.push({ t: 'explode', x: p.x, y: p.y, r, kind: fb ? 'focus' : 'bomb' });
      for (const o of near(s, p.x, p.y, r)) hitEnemy(s, o, dmg, { unit: u, kind: 'bomber', combo: false, dtype: 'explosion' });
      if (p.grade === 3) {
        const b = UNIT_PARAMS.bomber;
        for (let i = 0; i < b.frags3; i++) {
          const a = rand(s) * Math.PI * 2, d = b.fragSpread3 * (0.4 + rand(s) * 0.6);
          s.projectiles.push({ id: s.nextId++, kind: 'frag', x: p.x, y: p.y, sx: p.x, sy: p.y, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d, targetId: -1, t: 0, dur: 0.35, dmg: p.dmg * b.fragDmgMul3, src: p.src, srcKind: 'bomber', grade: 3, radius: b.fragRadius3, combo: false, boost: 1 });
        }
      }
      break;
    }
    case 'frag': {
      s.events.push({ t: 'explode', x: p.x, y: p.y, r: p.radius, kind: 'frag' });
      for (const o of near(s, p.x, p.y, p.radius)) hitEnemy(s, o, p.dmg, { unit: u, kind: 'bomber', combo: false, dtype: 'explosion' });
      break;
    }
  }
}
/** 발사한 유닛이 사라졌을 때(판매·합성) 투사체 처리를 위한 임시 유닛 */
function ghostUnit(p: Projectile): Unit {
  return { id: -1, kind: p.srcKind, grade: p.grade, slot: -1, invested: 0, cd: 0, moveCd: 0, charge: 0, overcharged: false, boost: 1, pulseT: 0, fireVortexT: 0, fireVortexCd: 0, pullT: 0, facing: 0, kills: 0, dmg: 0, bornWave: 0 };
}

// ---------- 적 ----------
export function updateEnemies(s: GameState, dt: number): void {
  const g = pathGeo(s.mapId);
  const pulling = new Set<number>();
  for (const u of s.units) if (u.kind === 'vortex' && u.pullT > 0) pulling.add(u.id);
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const st = e.st;
    // 상태 타이머
    if (st.oil > 0) st.oil = Math.max(0, st.oil - dt);
    if (st.burn > 0) { st.burn = Math.max(0, st.burn - dt); hitEnemy(s, e, st.burnDps * dt, { unit: null, kind: 'flame', combo: false, dtype: 'dot' }); if (st.burn <= 0) st.burnDps = 0; if (!e.alive) continue; }
    if (st.chill > 0) { st.chill = Math.max(0, st.chill - dt); if (st.chill <= 0) st.chillPct = 0; }
    if (st.frozen > 0) st.frozen = Math.max(0, st.frozen - dt);
    if (st.freezeImmune > 0) st.freezeImmune = Math.max(0, st.freezeImmune - dt);
    if (st.mark > 0) st.mark = Math.max(0, st.mark - dt);
    if (st.shieldT > 0) { st.shieldT = Math.max(0, st.shieldT - dt); if (st.shieldT <= 0) st.shield = 0; }
    if (st.igniteCd > 0) st.igniteCd = Math.max(0, st.igniteCd - dt);
    if (st.shardCd > 0) st.shardCd = Math.max(0, st.shardCd - dt);
    if (st.bossSlowT > 0) { st.bossSlowT = Math.max(0, st.bossSlowT - dt); if (st.bossSlowT <= 0) st.bossSlow = 0; }
    e.dotT += dt; if (e.dotT >= 0.5) { e.dotT = 0; if (e.dotAcc > 0) { s.events.push({ t: 'hit', enemy: e.id, x: e.x, y: e.y, dmg: e.dotAcc, kind: 'burn' }); e.dotAcc = 0; } }
    // 지원형·보스 행동
    if (e.kind === 'repairdrone') updateDrone(s, e, dt);
    if (e.boss) updateBoss(s, e, dt);
    // 이동(회오리에 끌리는 동안은 회오리가 위치를 정함)
    const pulled = e.pullBy != null && pulling.has(e.pullBy);
    if (!pulled) {
      e.pullBy = null;
      e.dist += enemySpeed(e) * dt;
      const [x, y] = posAt(g, e.dist); e.x = x; e.y = y;
    }
    if (e.dist >= g.len) {
      e.alive = false;
      s.life = Math.max(0, s.life - e.lifeDmg);
      s.stats.lifeLostBy[e.kind] = (s.stats.lifeLostBy[e.kind] || 0) + e.lifeDmg;
      s.events.push({ t: 'leak', x: e.x, y: e.y, dmg: e.lifeDmg });
      if (s.life <= 0) { s.phase = 'lost'; s.events.push({ t: 'lost' }); pushLog(s, '기지가 파괴되었습니다', 'warn'); return; }
    }
  }
  // 죽은 적 정리(이번 스텝의 피해 처리가 모두 끝난 뒤)
  s.enemies = s.enemies.filter(e => e.alive);
}
function updateDrone(s: GameState, e: Enemy, dt: number): void {
  e.droneT -= dt; if (e.droneT > 0) return; e.droneT = DRONE.interval;
  let n = 0;
  for (const o of s.enemies) {
    if (!o.alive || o.id === e.id || o.st.shield > 0) continue;
    if (Math.hypot(o.x - e.x, o.y - e.y) > DRONE.radius) continue;
    applyShield(s, o, DRONE.shieldHp, DRONE.shieldDur); if (++n >= DRONE.maxTargets) break;
  }
}
function updateBoss(s: GameState, e: Enemy, dt: number): void {
  const b = e.boss!;
  if (e.kind === 'boss_golem') {
    if (!b.enraged && e.hp <= e.maxHp * BOSS.golem.enrageAt) { b.enraged = true; e.armor += BOSS.golem.enrageArmor; s.events.push({ t: 'bosspattern', kind: 'enrage', phase: 'go', x: e.x, y: e.y }); pushLog(s, '고철 골렘이 장갑을 두르고 가속합니다!', 'warn'); }
    return;
  }
  const c = BOSS.core; const diff = s.difficulty;
  if (b.hasteT > 0) b.hasteT = Math.max(0, b.hasteT - dt);
  if (b.telegraph) {
    b.telegraph.t -= dt;
    if (b.telegraph.t <= 0) {
      const k = b.telegraph.kind; b.telegraph = null;
      s.events.push({ t: 'bosspattern', kind: k, phase: 'go', x: e.x, y: e.y });
      if (k === 'shield') applyShield(s, e, c.shieldHp, c.shieldDur);
      else if (k === 'haste') b.hasteT = c.hasteDur;
      else if (k === 'minion') { for (let i = 0; i < c.minionCount; i++) spawnEnemy(s, c.minionKind, 1, Math.max(0, e.dist - 14 * (i + 1)), e.id); pushLog(s, '코어 마스터가 부하를 소환했습니다', 'warn'); }
    }
    return;
  }
  b.shieldTimer += dt; b.hasteTimer += dt;
  const thresholds = c.minionAt[diff];
  const warn = (kind: 'shield' | 'haste' | 'minion') => { b.telegraph = { kind, t: c.telegraph }; s.events.push({ t: 'bosspattern', kind, phase: 'warn', x: e.x, y: e.y }); pushLog(s, `보스 예고: ${kind === 'shield' ? '보호막' : kind === 'haste' ? '가속' : '부하 소환'} (${c.telegraph}초 뒤)`, 'warn'); };
  if (b.minionsDone < thresholds.length && e.hp <= e.maxHp * thresholds[b.minionsDone]) { b.minionsDone++; warn('minion'); return; }
  if (b.shieldTimer >= c.shieldInterval[diff]) { b.shieldTimer = 0; warn('shield'); return; }
  if (b.hasteTimer >= c.hasteInterval[diff]) { b.hasteTimer = 0; warn('haste'); }
}
