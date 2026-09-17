import type { GameState, Unit, Enemy, Projectile, EnemyType } from './types';
import { SLOTS, posAt, PATH_LEN } from '../data/map';
import { UNITS, SLOW_CAP, CORRO_MAX_STACKS, CORRO_ARMOR_PER_STACK, ASPD_CAP, MYTHICS } from '../data/units';
import { ENEMIES } from '../data/enemies';
import { hpMul, ENEMY_SPEED_MUL } from '../data/waves';
import { baseStats, fieldUnits, unitStatKey, pushLog, type UnitStats } from './state';
import { OVERHEAT_BONUS } from '../data/economy';

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

// ---------- enemy creation ----------
export function spawnEnemy(s: GameState, type: EnemyType, mul: number, tag = '', progress = 0, rewardOverride?: number): Enemy {
  const d = ENEMIES[type];
  const hp = Math.round(d.hp * mul);
  const e: Enemy = {
    id: s.nextId++, type, hp, maxHp: hp, shield: d.shield ? Math.round(d.shield * mul) : 0, maxShield: d.shield ? Math.round(d.shield * mul) : 0,
    progress, baseSpeed: d.speed * ENEMY_SPEED_MUL, armor: d.armor,
    slowAmt: 0, slowT: 0, corro: 0, corroT: 0, corroDps: 0, shockT: 0, pullCd: 0, freezeT: 0, freezeResist: 0,
    weakT: 0, weakAmt: 0, pulledT: 0, corroSrc: -1, burnSrc: -1, hasteMul: 1, sinceHit: 9, burnT: 0, burnDps: 0,
    alive: true, reward: rewardOverride ?? d.reward, exitDmg: d.exitDmg, wave: s.wave, isBoss: !!d.boss,
    bossPhase: 0, bossT: 0, bossStance: 0, escortIds: [], vulnT: 0, hasteT: 0, casterT: 3, escortOf: -1, spawnDelay: 0, eventTag: tag,
    x: 0, y: 0,
  };
  const [x, y] = posAt(progress); e.x = x; e.y = y;
  if (type === 'boss_cart') { e.bossT = 4; e.bossStance = 0; }
  if (type === 'boss_thief') { e.bossT = 6; }
  if (type === 'boss_flag') { e.bossT = 0; }
  s.enemies.push(e);
  if (!s.seenEnemies.includes(type)) s.seenEnemies.push(type);
  return e;
}

// ---------- status helpers ----------
export function applySlow(e: Enemy, amt: number, dur: number): void {
  let eff = amt;
  if (e.type === 'ghost' && e.shield > 0) eff *= 0.5;
  if (e.isBoss) eff *= 0.5;
  eff = Math.min(SLOW_CAP, eff);
  if (eff >= e.slowAmt - 1e-6) { e.slowAmt = eff; e.slowT = Math.max(e.slowT, dur); }
  // weaker slow than current: ignored (no stacking, no extension)
}
export function applyCorrosion(e: Enemy, dps: number, src: number): void {
  if (e.corro < CORRO_MAX_STACKS) e.corro++;
  e.corroT = 4; if (dps >= e.corroDps) { e.corroDps = dps; e.corroSrc = src; }
}
export function applyFreeze(e: Enemy, dur: number, resist: number): boolean {
  if (e.isBoss) { applySlow(e, 0.4 * 2, dur); return false; } // boss: slow only (halved inside → 0.4)
  if (e.freezeResist > 0) return false;
  e.freezeT = dur; e.freezeResist = dur + resist; return true;
}
export function effectiveArmor(s: GameState, e: Enemy): number {
  let a = e.armor;
  if (e.type === 'boss_cart') a = e.bossStance === 0 ? 0.8 : 0.0;
  if (e.type === 'boss_king' && e.bossPhase === 1) a = e.bossStance === 0 ? 0.6 : 0.1;
  a -= e.corro * CORRO_ARMOR_PER_STACK;
  if (e.slowT > 0 && s.relics.includes('frost_breaker')) a -= 0.1;
  return Math.max(0, Math.min(0.9, a));
}

export type DmgKind = 'hit' | 'dot' | 'explode' | 'chain' | 'skill' | 'burn';
/** Apply damage to an enemy. Returns damage actually applied (to hp+shield). Handles death. */
export function dealDamage(s: GameState, e: Enemy, amount: number, src: Unit | null, kind: DmgKind, statKey?: string): number {
  if (!e.alive || amount <= 0) return 0;
  let mult = 1 - effectiveArmor(s, e);
  if (e.vulnT > 0) mult *= 1 + e.weakAmt;
  if (e.type === 'boss_cart' && e.bossStance === 1) mult *= 1.25;
  if (e.type === 'boss_king' && e.bossPhase === 1 && e.bossStance === 1) mult *= 1.2;
  if (e.slowT > 0 && s.relics.includes('frost_breaker')) mult *= 1.12;
  if (e.pulledT > 0 && s.relics.includes('magnetic_storm')) mult *= 1.25;
  if (e.type === 'boss_flag' && e.escortIds.some(id => s.enemies.some(x => x.id === id && x.alive))) mult *= 0.6;
  if (e.escortOf >= 0 && s.enemies.some(b => b.id === e.escortOf && b.alive && b.type === 'boss_flag')) mult *= 0.7;
  let dmg = amount * mult;
  let applied = 0;
  if (e.shield > 0) { const ab = Math.min(e.shield, dmg); e.shield -= ab; dmg -= ab; applied += ab; }
  const hpDmg = Math.min(e.hp, dmg); e.hp -= hpDmg; applied += hpDmg;
  if (kind !== 'dot' && kind !== 'burn') e.sinceHit = 0;
  const key = statKey ?? (src ? unitStatKey(src) : 'skill');
  s.stats.dmgByUnit[key] = (s.stats.dmgByUnit[key] || 0) + applied;
  if (src) src.dmg += applied;
  if (kind !== 'dot' && kind !== 'burn') s.events.push({ t: 'hit', x: e.x, y: e.y, kind, dmg: applied, enemy: e.id });
  if (e.hp <= 0) killEnemy(s, e, src);
  return applied;
}

export function killEnemy(s: GameState, e: Enemy, src: Unit | null): void {
  if (!e.alive) return;
  e.alive = false; e.hp = 0;
  if (src) src.kills++;
  s.stats.killsBy[e.type] = (s.stats.killsBy[e.type] || 0) + 1;
  if (e.reward > 0) { s.gold += e.reward; s.stats.goldEarned += e.reward; s.events.push({ t: 'gold', x: e.x, y: e.y, amount: e.reward }); }
  const d = ENEMIES[e.type];
  if (d.split) {
    const mul = hpMul(e.wave);
    for (let i = 0; i < 2; i++) {
      const c = spawnEnemy(s, d.split, mul, e.eventTag, Math.max(0, e.progress - (i === 0 ? 0 : 12)), 0);
      c.wave = e.wave; c.spawnDelay = 0.2;
    }
  }
  if (e.isBoss) {
    s.cores += 1; s.stats.bossKills.push(s.wave);
    pushLog(s, `${d.name} 처치! 공방 핵 +1`, 'good');
    // release escorts
    for (const x of s.enemies) if (x.escortOf === e.id) x.escortOf = -1;
  }
  if (e.type === 'courier') { s.stats.couriersKilled++; pushLog(s, `보물 운반꾼 처치! +${e.reward} 골드`, 'good'); }
  s.events.push({ t: 'die', x: e.x, y: e.y, type: e.type, boss: e.isBoss });
}

// ---------- buffs ----------
export interface UnitCtx { stats: UnitStats; aspd: number; dmgMul: number; x: number; y: number; sealed: boolean }
export function computeCtx(s: GameState): Map<number, UnitCtx> {
  const fu = fieldUnits(s);
  const m = new Map<number, UnitCtx>();
  const overheat = s.waveRt && s.waveRt.overheatT > 0 && s.waveRt.overheatT <= 25 ? s.waveRt.overheatSlots : [];
  const sealed = new Set(s.seals.filter(z => z.sealT > 0).map(z => z.slot));
  const slotOf = (x: Unit) => (x.loc.t === 'f' ? x.loc.slot : 0);
  for (const u of fu) {
    const st = baseStats(s, u); const sl = SLOTS[slotOf(u)];
    let mech = 0, chrono = 0;
    for (const o of fu) {
      if (o.id === u.id) continue;
      const os = SLOTS[slotOf(o)]; const d = dist(sl.x, sl.y, os.x, os.y);
      if (o.mythic === 'chrono') { if (d <= 100) chrono = Math.max(chrono, 0.30); continue; }
      if (o.mythic) continue;
      if (UNITS[o.kind].aura) { const b = baseStats(s, o); if (d <= b.auraRange) mech = Math.max(mech, b.aura); }
    }
    const buff = Math.min(ASPD_CAP, mech + chrono);
    const aspd = (1 + buff) * (1 + s.upgrades.spd * 0.04);
    let dmgMul = overheat.includes(slotOf(u)) ? 1 + OVERHEAT_BONUS : 1;
    // 외톨이 조준경
    if (u.kind === 'archer' && !u.mythic && s.relics.includes('lone_scope')) {
      let n = 0; for (const o of fu) { if (o.id !== u.id && (o.mythic || (o.kind !== 'mechanic' && o.kind !== 'toad'))) { const os = SLOTS[slotOf(o)]; if (dist(sl.x, sl.y, os.x, os.y) <= 90) n++; } }
      st.range += Math.max(0, 40 - 10 * n);
    }
    m.set(u.id, { stats: st, aspd, dmgMul, x: sl.x, y: sl.y, sealed: sealed.has(slotOf(u)) });
  }
  return m;
}

// ---------- targeting ----------
function inRange(e: Enemy, x: number, y: number, r: number): boolean { return e.alive && e.spawnDelay <= 0 && e.progress > 0 && dist(e.x, e.y, x, y) <= r; }
export function findTarget(s: GameState, u: Unit, ctx: UnitCtx): Enemy | null {
  const pr = u.mythic ? 'first' : UNITS[u.kind].priority;
  let best: Enemy | null = null; let bestScore = -Infinity;
  const cands = s.enemies.filter(e => inRange(e, ctx.x, ctx.y, ctx.stats.range));
  if (u.mythic === 'sun' || u.mythic === 'storm') {
    // cluster
    for (const e of cands) { let n = 0; for (const o of cands) if (dist(e.x, e.y, o.x, o.y) <= 60) n++; const sc = n * 1000 + e.progress; if (sc > bestScore) { bestScore = sc; best = e; } }
    return best;
  }
  for (const e of cands) {
    let sc = 0;
    switch (pr) {
      case 'first': sc = e.progress; break;
      case 'strong': sc = e.hp + e.shield; break;
      case 'fast': sc = (e.slowT <= 0 ? 10000 : 0) + e.baseSpeed * 10 + e.progress * 0.01; break;
      case 'armored': sc = effectiveArmor(s, e) * 5000 + e.hp + e.shield; break;
      case 'cluster': { let n = 0; for (const o of cands) if (dist(e.x, e.y, o.x, o.y) <= 45) n++; sc = n * 1000 + e.progress * 0.1; break; }
    }
    if (sc > bestScore) { bestScore = sc; best = e; }
  }
  return best;
}

function predictPos(e: Enemy, t: number): [number, number] {
  const sp = e.freezeT > 0 ? 0 : e.baseSpeed * (1 - e.slowAmt) * e.hasteMul;
  return posAt(Math.min(PATH_LEN - 1, e.progress + sp * t));
}

// ---------- attacks ----------
export function updateUnits(s: GameState, dt: number, ctxMap: Map<number, UnitCtx>): void {
  for (const u of s.units) {
    if (u.moveCd > 0) u.moveCd = Math.max(0, u.moveCd - dt);
    if (u.loc.t !== 'f') { u.tele = 0; continue; }
    const ctx = ctxMap.get(u.id)!;
    const st = ctx.stats;
    // chrono aura / colossus pulse handled separately
    if (u.mythic === 'colossus') { colossusUpdate(s, u, ctx, dt); continue; }
    if (u.mythic === 'chrono') chronoAura(s, u, ctx);
    if (u.tele > 0) {
      u.tele -= dt;
      if (u.tele <= 0) { u.tele = 0; sunExplode(s, u, ctx, u.teleX, u.teleY); }
      continue;
    }
    if (u.cd > 0) u.cd -= dt * ctx.aspd;
    if (u.cd > 0 || ctx.sealed) continue;
    const target = findTarget(s, u, ctx);
    if (!target) { u.cd = Math.min(u.cd, 0); continue; }
    if (u.cd < -st.cd) u.cd = 0;
    u.cd += st.cd;
    u.lastShot = s.time; u.lastTargetX = target.x; u.lastTargetY = target.y;
    fire(s, u, ctx, target);
  }
}

function fire(s: GameState, u: Unit, ctx: UnitCtx, target: Enemy): void {
  const st = ctx.stats; const dmg = st.atk * ctx.dmgMul; const g = u.grade;
  const proj = u.mythic ? (u.mythic === 'storm' ? 'bolt' : u.mythic === 'sun' ? 'sunshell' : 'shard') : UNITS[u.kind].proj;
  switch (proj) {
    case 'arrow': addProj(s, 'arrow', ctx, target, dmg, u, 420, 0, 0); break;
    case 'shard': addProj(s, 'shard', ctx, target, dmg, u, 330, 0, st.slow); break;
    case 'cracker': { const [tx, ty] = predictPos(target, 0.55); addLob(s, 'cracker', ctx, tx, ty, target.id, dmg, u, 0.55, st.splash, 0); break; }
    case 'glob': { const [tx, ty] = predictPos(target, 0.5); addLob(s, 'glob', ctx, tx, ty, target.id, dmg, u, 0.5, 30, st.corroDps); break; }
    case 'bolt': chainLightning(s, u, ctx, target, dmg); break;
    case 'pulse': magnetPulse(s, u, ctx, target, dmg); break;
    case 'puff': case 'coin': {
      s.events.push({ t: 'shoot', unit: u.id, kind: proj, x: ctx.x, y: ctx.y, tx: target.x, ty: target.y, grade: g });
      dealDamage(s, target, dmg, u, 'hit'); break;
    }
    case 'sunshell': {
      const [tx, ty] = predictPos(target, 0.8); u.tele = 0.8; u.teleX = tx; u.teleY = ty;
      s.events.push({ t: 'shoot', unit: u.id, kind: 'suntele', x: ctx.x, y: ctx.y, tx, ty, grade: 4 }); break;
    }
  }
}

function addProj(s: GameState, kind: Projectile['kind'], ctx: UnitCtx, target: Enemy, dmg: number, u: Unit, speed: number, radius: number, fx: number): void {
  s.projectiles.push({ id: s.nextId++, kind, x: ctx.x, y: ctx.y, sx: ctx.x, sy: ctx.y, tx: target.x, ty: target.y, targetId: target.id, t: 0, dur: 0, speed, dmg, src: u.id, grade: u.grade, radius, fx, fired: s.time });
  s.events.push({ t: 'shoot', unit: u.id, kind, x: ctx.x, y: ctx.y, tx: target.x, ty: target.y, grade: u.grade });
}
function addLob(s: GameState, kind: Projectile['kind'], ctx: UnitCtx, tx: number, ty: number, targetId: number, dmg: number, u: Unit | null, dur: number, radius: number, fx: number): void {
  s.projectiles.push({ id: s.nextId++, kind, x: ctx.x, y: ctx.y, sx: ctx.x, sy: ctx.y, tx, ty, targetId, t: 0, dur, speed: 0, dmg, src: u ? u.id : -1, grade: u ? u.grade : 0, radius, fx, fired: s.time });
  if (u) s.events.push({ t: 'shoot', unit: u.id, kind, x: ctx.x, y: ctx.y, tx, ty, grade: u.grade });
}

function chainLightning(s: GameState, u: Unit, ctx: UnitCtx, first: Enemy, dmg: number): void {
  const st = ctx.stats; const isStorm = u.mythic === 'storm';
  let jumps = st.chain; let conducted = false; const hit = new Set<number>(); const pts: number[] = [ctx.x, ctx.y];
  let cur: Enemy | null = first; let mul = 1; let i = 0;
  while (cur && i < jumps) {
    hit.add(cur.id); pts.push(cur.x, cur.y);
    let d = dmg * mul;
    if (cur.slowT > 0) {
      d *= isStorm ? 2.0 : 1.5;
      if (!conducted) { conducted = true; jumps += isStorm ? 2 : (s.relics.includes('cold_conductor') ? 3 : 1); }
      cur.shockT = 1.0; s.events.push({ t: 'shock', x: cur.x, y: cur.y });
    }
    dealDamage(s, cur, d, u, 'chain');
    // next: nearest alive enemy within 60 not hit
    let next: Enemy | null = null; let bd = 61;
    for (const e of s.enemies) { if (!e.alive || hit.has(e.id) || e.spawnDelay > 0) continue; const dd = dist(e.x, e.y, cur.x, cur.y); if (dd < bd) { bd = dd; next = e; } }
    cur = next; mul *= 0.8; i++;
  }
  s.events.push({ t: 'chain', pts, conducted, grade: isStorm ? 4 : u.grade });
}

function magnetPulse(s: GameState, u: Unit, ctx: UnitCtx, target: Enemy, dmg: number): void {
  const st = ctx.stats; const radius = 50 + (s.relics.includes('magnetic_storm') ? 20 : 0);
  const cdPull = s.relics.includes('magnetic_storm') ? 1.2 : 2.0;
  s.events.push({ t: 'shoot', unit: u.id, kind: 'pulse', x: ctx.x, y: ctx.y, tx: target.x, ty: target.y, grade: u.grade });
  const pulled: number[] = [];
  const anchor = target.progress;
  for (const e of s.enemies) {
    if (!e.alive || e.spawnDelay > 0 || dist(e.x, e.y, target.x, target.y) > radius) continue;
    if (e.isBoss) { if (e.pullCd <= 0) { e.vulnT = Math.max(e.vulnT, 2); e.weakAmt = Math.max(e.weakAmt, 0.1); e.pullCd = cdPull; } continue; }
    if (e.pullCd > 0) continue;
    if (e.id === target.id) { e.progress = Math.max(0, e.progress - st.pull * 0.5); }
    else if (e.progress > anchor) { e.progress = Math.max(anchor, e.progress - st.pull); }
    else continue;
    e.pullCd = cdPull; e.pulledT = 1.0; pulled.push(e.id);
    const [x, y] = posAt(e.progress); e.x = x; e.y = y;
  }
  dealDamage(s, target, dmg, u, 'hit');
  if (pulled.length) s.events.push({ t: 'pull', from: pulled, x: target.x, y: target.y });
}

function chronoAura(s: GameState, u: Unit, ctx: UnitCtx): void {
  for (const e of s.enemies) if (e.alive && dist(e.x, e.y, ctx.x, ctx.y) <= 100) applySlow(e, 0.35, 0.25);
}
function colossusUpdate(s: GameState, u: Unit, ctx: UnitCtx, dt: number): void {
  if (ctx.sealed) return;
  u.pulseT += dt * ctx.aspd;
  if (u.pulseT < ctx.stats.cd) return;
  const any = s.enemies.some(e => e.alive && dist(e.x, e.y, ctx.x, ctx.y) <= 110);
  if (!any) { u.pulseT = ctx.stats.cd; return; }
  u.pulseT = 0; u.lastShot = s.time;
  const dmg = ctx.stats.atk * ctx.dmgMul; const pulled: number[] = [];
  s.events.push({ t: 'explode', x: ctx.x, y: ctx.y, r: 110, kind: 'gravity' });
  for (const e of s.enemies) {
    if (!e.alive || dist(e.x, e.y, ctx.x, ctx.y) > 110) continue;
    if (e.isBoss) { dealDamage(s, e, dmg * 2, u, 'explode'); continue; }
    if (e.pullCd <= 0) { e.progress = Math.max(0, e.progress - 30); e.pullCd = 3; pulled.push(e.id); const [x, y] = posAt(e.progress); e.x = x; e.y = y; }
    if (e.freezeResist <= 0) { e.freezeT = 0.6; e.freezeResist = 3.6; }
    dealDamage(s, e, dmg, u, 'explode');
  }
  if (pulled.length) s.events.push({ t: 'pull', from: pulled, x: ctx.x, y: ctx.y });
}

function sunExplode(s: GameState, u: Unit, ctx: UnitCtx, x: number, y: number): void {
  const dmg = ctx.stats.atk * ctx.dmgMul;
  s.events.push({ t: 'explode', x, y, r: 75, kind: 'sun' });
  for (const e of s.enemies) {
    if (!e.alive || dist(e.x, e.y, x, y) > 75) continue;
    dealDamage(s, e, dmg, u, 'explode');
    if (e.alive) { e.burnT = 2; e.burnDps = Math.max(e.burnDps, 15 * (1 + s.upgrades.atk * 0.06)); e.burnSrc = u.id; }
  }
}

export function explodeAt(s: GameState, x: number, y: number, r: number, dmg: number, src: Unit | null, kind: string, bossMul = 1, statKey?: string): Enemy[] {
  const hit: Enemy[] = [];
  s.events.push({ t: 'explode', x, y, r, kind });
  for (const e of s.enemies) {
    if (!e.alive || e.spawnDelay > 0 || dist(e.x, e.y, x, y) > r + 4) continue;
    hit.push(e); dealDamage(s, e, dmg * (e.isBoss ? bossMul : 1), src, 'explode', statKey);
  }
  return hit;
}

// ---------- projectiles ----------
export function updateProjectiles(s: GameState, dt: number): void {
  const keep: Projectile[] = [];
  for (const p of s.projectiles) {
    if (p.kind === 'arrow' || p.kind === 'shard') {
      const tgt = s.enemies.find(e => e.id === p.targetId);
      if (tgt && tgt.alive) { p.tx = tgt.x; p.ty = tgt.y; }
      const d = dist(p.x, p.y, p.tx, p.ty); const stepLen = p.speed * dt;
      if (d <= stepLen + 2) {
        p.x = p.tx; p.y = p.ty;
        if (tgt && tgt.alive) {
          const src = s.units.find(u => u.id === p.src) ?? null;
          dealDamage(s, tgt, p.dmg, src, 'hit');
          if (p.kind === 'shard' && tgt.alive && p.fx > 0) applySlow(tgt, p.fx, 1.6);
        }
        continue; // remove
      }
      p.x += (p.tx - p.x) / d * stepLen; p.y += (p.ty - p.y) / d * stepLen;
      keep.push(p);
    } else {
      p.t += dt / p.dur;
      if (p.t >= 1) { land(s, p); continue; }
      const k = p.t; p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * (p.kind === 'skill_bomb' || p.kind === 'skill_freeze' ? 0 : 40);
      keep.push(p);
    }
  }
  s.projectiles = keep;
}

function land(s: GameState, p: Projectile): void {
  const src = s.units.find(u => u.id === p.src) ?? null;
  if (p.kind === 'cracker') {
    const hit = explodeAt(s, p.tx, p.ty, p.radius, p.dmg, src, 'cracker');
    // 산성 + 폭죽: 부식된 적에게 폭발 → 제한적 추가 폭발 (1회, 재발동 없음)
    const corroded = hit.filter(e => e.corro > 0 && e.alive || (e.corro > 0));
    const bursts = s.relics.includes('chain_igniter') ? 2 : 1;
    const mul = s.relics.includes('chain_igniter') ? 0.5 : 0.3;
    const rad = s.relics.includes('chain_igniter') ? 35 : 28;
    for (let i = 0; i < Math.min(bursts, corroded.length); i++) {
      const c = corroded[i];
      s.events.push({ t: 'explode', x: c.x, y: c.y, r: rad, kind: 'acidburst' });
      for (const e of s.enemies) if (e.alive && e.spawnDelay <= 0 && dist(e.x, e.y, c.x, c.y) <= rad) dealDamage(s, e, p.dmg * mul, src, 'explode');
    }
  } else if (p.kind === 'glob') {
    s.events.push({ t: 'explode', x: p.tx, y: p.ty, r: p.radius, kind: 'acid' });
    for (const e of s.enemies) if (e.alive && e.spawnDelay <= 0 && dist(e.x, e.y, p.tx, p.ty) <= p.radius + 4) { dealDamage(s, e, p.dmg, src, 'hit'); if (e.alive) applyCorrosion(e, p.fx, p.src); }
  } else if (p.kind === 'skill_bomb') {
    explodeAt(s, p.tx, p.ty, p.radius, p.dmg, null, 'bomb', p.fx, 'skill:bomb');
    s.events.push({ t: 'skill', kind: 'bomb', x: p.tx, y: p.ty, r: p.radius });
  } else if (p.kind === 'skill_freeze') {
    s.events.push({ t: 'skill', kind: 'freeze', x: p.tx, y: p.ty, r: p.radius });
    for (const e of s.enemies) if (e.alive && dist(e.x, e.y, p.tx, p.ty) <= p.radius + 4) applyFreeze(e, p.dmg, 4.0);
  }
}

// ---------- enemy update ----------
export function updateEnemies(s: GameState, dt: number): void {
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (e.spawnDelay > 0) { e.spawnDelay -= dt; }
    e.sinceHit += dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) { e.slowT = 0; e.slowAmt = 0; } }
    if (e.shockT > 0) e.shockT -= dt;
    if (e.pullCd > 0) e.pullCd -= dt;
    if (e.pulledT > 0) e.pulledT -= dt;
    if (e.freezeT > 0) e.freezeT -= dt;
    if (e.freezeResist > 0) e.freezeResist -= dt;
    if (e.vulnT > 0) { e.vulnT -= dt; if (e.vulnT <= 0) e.weakAmt = 0; }
    if (e.hasteT > 0) { e.hasteT -= dt; if (e.hasteT <= 0) e.hasteMul = 1; }
    if (e.corro > 0) {
      e.corroT -= dt;
      const src = s.units.find(u => u.id === e.corroSrc) ?? null;
      dealDamage(s, e, e.corroDps * e.corro * dt, src, 'dot', src ? undefined : 'mushroom@0');
      if (!e.alive) continue;
      if (e.corroT <= 0) { e.corro = 0; e.corroDps = 0; }
    }
    if (e.burnT > 0) {
      e.burnT -= dt; const src = s.units.find(u => u.id === e.burnSrc) ?? null;
      dealDamage(s, e, e.burnDps * dt, src, 'burn', 'mythic:sun'); if (!e.alive) continue;
    }
    const d = ENEMIES[e.type];
    if (d.regen && e.sinceHit > 1.5 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + d.regen * e.maxHp * dt);
    if (d.caster) {
      e.casterT -= dt;
      if (e.casterT <= 0) {
        e.casterT = 3;
        for (const o of s.enemies) if (o.alive && o.id !== e.id && !o.isBoss && dist(o.x, o.y, e.x, e.y) <= 60) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.06); o.hasteT = 2; o.hasteMul = Math.max(o.hasteMul, 1.15); }
        s.events.push({ t: 'explode', x: e.x, y: e.y, r: 60, kind: 'heal' });
      }
    }
    if (e.isBoss) bossUpdate(s, e, dt);
    // move
    const sp = e.freezeT > 0 ? 0 : e.baseSpeed * (1 - e.slowAmt) * e.hasteMul;
    e.progress += sp * dt;
    if (e.progress >= PATH_LEN) { exitEnemy(s, e); continue; }
    const [x, y] = posAt(e.progress); e.x = x; e.y = y;
  }
  // purge dead
  if (s.enemies.length > 0 && s.enemies.some(e => !e.alive)) s.enemies = s.enemies.filter(e => e.alive);
}

function exitEnemy(s: GameState, e: Enemy): void {
  e.alive = false;
  const dmg = e.exitDmg;
  if (dmg > 0) {
    s.life = Math.max(0, s.life - dmg);
    s.stats.lifeLostBy[e.type] = (s.stats.lifeLostBy[e.type] || 0) + dmg;
    s.events.push({ t: 'exit', x: e.x, y: e.y, dmg });
    if (e.type === 'boss_king') { s.life = 0; }
    if (s.life <= 0 && s.phase !== 'lost') { s.phase = 'lost'; s.events.push({ t: 'lost' }); pushLog(s, `${ENEMIES[e.type].name}이(가) 금고를 뚫었습니다.`, 'warn'); }
  } else if (e.type === 'courier') pushLog(s, '보물 운반꾼이 도망쳤습니다 (생명 피해 없음)', 'info');
  for (const x of s.enemies) if (x.escortOf === e.id) x.escortOf = -1;
}

// ---------- boss patterns ----------
function bossUpdate(s: GameState, e: Enemy, dt: number): void {
  switch (e.type) {
    case 'boss_flag': {
      const escorts = s.enemies.filter(x => x.alive && x.escortOf === e.id);
      e.escortIds = escorts.map(x => x.id);
      if (escorts.length === 0) {
        if (e.bossT <= 0 && e.vulnT <= 0 && e.bossPhase > 0) { /* nothing */ }
        if (e.bossPhase === 0) { e.bossPhase = 1; e.vulnT = 8; e.weakAmt = Math.max(e.weakAmt, 0.35); e.bossT = 12; pushLog(s, '호위 전멸! 깃발왕이 8초간 약화됩니다', 'good'); }
        else { e.bossT -= dt; if (e.bossT <= 0) { e.bossT = 12; e.bossPhase = 0; for (let i = 0; i < 3; i++) { const w = spawnEnemy(s, 'wisp', hpMul(s.wave), '', Math.max(0, e.progress - 25 - i * 12)); w.escortOf = e.id; w.wave = e.wave; } pushLog(s, '깃발왕이 호위를 다시 불러냅니다', 'warn'); } }
      }
      break;
    }
    case 'boss_cart': {
      e.bossT -= dt;
      if (e.bossT <= 0) { e.bossStance = e.bossStance === 0 ? 1 : 0; e.bossT = e.bossStance === 0 ? 4 : 3; s.events.push({ t: 'boss', type: e.type }); }
      break;
    }
    case 'boss_thief': {
      e.bossT -= dt;
      if (e.bossT <= 0) { e.bossT = 9; sealSlots(s, 3); }
      e.casterT -= dt; if (e.casterT <= 0) { e.casterT = 7; e.hasteT = 1.5; e.hasteMul = 1.4; }
      break;
    }
    case 'boss_king': {
      const frac = e.hp / e.maxHp;
      const ph = frac > 0.7 ? 0 : frac > 0.4 ? 1 : 2;
      if (ph !== e.bossPhase) { e.bossPhase = ph; e.bossT = ph === 1 ? 4 : 3; e.bossStance = 0; s.events.push({ t: 'boss', type: e.type }); pushLog(s, ph === 1 ? '수집왕: 자세 전환 단계! 취약 자세를 노리세요' : '수집왕: 봉인+돌진 단계! 예고된 자리를 비우세요', 'warn'); }
      e.bossT -= dt;
      if (ph === 0) { if (e.bossT <= 0) { e.bossT = 10; for (let i = 0; i < 3; i++) { const w = spawnEnemy(s, 'slime', hpMul(s.wave) * 0.35, '', Math.max(0, e.progress - 20 - i * 14)); w.wave = e.wave; } pushLog(s, '수집왕이 슬라임 호위를 불러냅니다', 'warn'); } }
      else if (ph === 1) { if (e.bossT <= 0) { e.bossStance = e.bossStance === 0 ? 1 : 0; e.bossT = e.bossStance === 0 ? 4 : 3; } }
      else { if (e.bossT <= 0) { e.bossT = 10; sealSlots(s, 3); } e.casterT -= dt; if (e.casterT <= 0) { e.casterT = 12; e.hasteT = 1.5; e.hasteMul = 1.4; for (let i = 0; i < 4; i++) { const w = spawnEnemy(s, 'fox', hpMul(s.wave) * 0.35, '', Math.max(0, e.progress - 30 - i * 10)); w.wave = e.wave; } } }
      break;
    }
  }
}

export function sealSlots(s: GameState, n: number): void {
  const occupied = s.slots.map((id, i) => (id != null ? i : -1)).filter(i => i >= 0 && !s.seals.some(z => z.slot === i));
  // deterministic selection using game rng
  const picks: number[] = [];
  const pool = occupied.slice();
  while (picks.length < n && pool.length) { const i = Math.floor(rngNextS(s) * pool.length); picks.push(pool.splice(i, 1)[0]); }
  for (const slot of picks) { s.seals.push({ slot, warnT: 2, sealT: 0 }); s.events.push({ t: 'seal', slot, phase: 'warn' }); }
  if (picks.length) pushLog(s, `봉인 예고! ${picks.length}곳 (2초 뒤 4초 봉인)`, 'warn');
}
import { rngNext } from './rng';
function rngNextS(s: GameState): number { return rngNext(s.rng); }

export function updateSeals(s: GameState, dt: number): void {
  if (!s.seals.length) return;
  for (const z of s.seals) {
    if (z.warnT > 0) { z.warnT -= dt; if (z.warnT <= 0) { z.warnT = 0; z.sealT = 4; s.events.push({ t: 'seal', slot: z.slot, phase: 'seal' }); } }
    else if (z.sealT > 0) z.sealT -= dt;
  }
  s.seals = s.seals.filter(z => z.warnT > 0 || z.sealT > 0);
}
