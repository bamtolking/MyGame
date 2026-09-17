// 자동 전투 시뮬레이션. 고정 시간 스텝(1/60초), 결정적 난수, DOM·렌더링 없음.
// 배속·일시정지는 호출자가 step() 호출 횟수로 제어한다 → 모든 요소가 같은 비율로 움직인다.
import { ENEMIES, BOSS, STAGE_HP_MUL, STAGE_DMG_MUL, ARMOR_MIN_RATIO, type EnemyType } from '../data/enemies';
import { BALANCE, type Difficulty } from '../data/balance';
import { getStages, HARD_MODS, type StageDef, type SpawnGroup } from '../data/waves';
import { seedRng, rngNext, type RngState } from '../../sim/rng';
import type { Loadout, WeaponConfig } from '../core/loadout';
import type { BattleStats, BattleResult, WeaponStat } from './types';

export interface Enemy {
  id: number; type: EnemyType; x: number; y: number; kx: number; ky: number;
  hp: number; maxHp: number; radius: number; speed: number; damage: number; attackInterval: number; attackTimer: number;
  armor: number; kbResist: number; alive: boolean; hitFlash: number; facing: number;
  fuse: number;            // 자폭형: -1이면 아직, 0 이상이면 카운트다운
  // 보스 전용
  phase: number; summonTimer: number; crushTimer: number; crushTelegraph: number; stun: number;
}
export interface Projectile {
  id: number; kind: 'bullet' | 'pellet' | 'bolt' | 'bomb' | 'fragment' | 'minibomb';
  x: number; y: number; vx: number; vy: number; life: number; dmg: number; weaponUid: string;
  extra: boolean; canChain: boolean; radius: number; sx: number; sy: number; tx: number; ty: number; t: number; flight: number; fragments: number;
}
export interface Drone { angle: number; fireTimer: number; x: number; y: number; recoil: number }
export interface WeaponState {
  cfg: WeaponConfig; timer: number; heat: number; overheated: boolean; shotCounter: number; drones: Drone[];
  lastDir: number; recoil: number; slashQueue: { t: number; dir: number; dmgMul: number }[]; stat: WeaponStat; beam: { dir: number; len: number; t: number } | null;
}
export type FxEvent =
  | { type: 'muzzle'; x: number; y: number; dir: number; weapon: string; extra?: boolean }
  | { type: 'slash'; x: number; y: number; dir: number; arc: number; range: number }
  | { type: 'laser'; x: number; y: number; dir: number; len: number; width: number }
  | { type: 'explosion'; x: number; y: number; r: number; extra?: boolean; small?: boolean }
  | { type: 'hit'; x: number; y: number; dmg: number; chain?: boolean; extra?: boolean; enemy: EnemyType }
  | { type: 'die'; x: number; y: number; enemy: EnemyType }
  | { type: 'chain'; x: number; y: number; x2: number; y2: number }
  | { type: 'shockwave'; x: number; y: number; r: number }
  | { type: 'crush_warn' } | { type: 'crush'; blocked: boolean }
  | { type: 'bomber_blast'; x: number; y: number; r: number }
  | { type: 'overheat'; weapon: string } | { type: 'cooled'; weapon: string }
  | { type: 'boss_phase'; phase: number } | { type: 'boss_spawn' }
  | { type: 'shield_break' } | { type: 'player_hit'; amount: number; shielded: boolean; protectedHit: boolean }
  | { type: 'stall_warn' } | { type: 'enrage' }
  | { type: 'summon'; x: number; y: number };

interface Spawn { t: number; type: EnemyType; x: number; y: number }

export interface SimOptions { loadout: Loadout; stage: number; difficulty: Difficulty; seed: number; hp: number; maxHp?: number }

export class BattleSim {
  readonly w = BALANCE.world.w; readonly h = BALANCE.world.h;
  readonly player = { x: BALANCE.world.w / 2, y: BALANCE.world.h / 2 + 10, r: BALANCE.playerRadius, hitFlash: 0, pulse: 0 };
  time = 0; hp: number; maxHp: number; shield: number; protectTimer = 0;
  enemies: Enemy[] = []; projectiles: Projectile[] = []; weapons: WeaponState[] = [];
  events: FxEvent[] = [];
  over = false; won = false; shockwaveUsed = false;
  enraged = false; stallWarned = false; enrageLevel = 0; nextEnrage = 0;
  readonly stage: StageDef; readonly stageNo: number; readonly difficulty: Difficulty;
  private rng: RngState; private queue: Spawn[]; private lastSpawnT: number; private nextId = 1;
  private hpMul: number; private dmgMul: number; private isBoss: boolean;
  stats: BattleStats;
  bossRef: Enemy | null = null;

  constructor(o: SimOptions) {
    this.stageNo = o.stage; this.difficulty = o.difficulty;
    this.stage = getStages(o.difficulty)[o.stage - 1];
    this.isBoss = this.stage.kind === 'boss';
    this.rng = seedRng(o.seed);
    this.hp = o.hp; this.maxHp = o.maxHp ?? BALANCE.maxHp; this.shield = o.loadout.shield;
    const hard = o.difficulty === 'hard';
    this.hpMul = STAGE_HP_MUL[o.stage - 1] * (hard ? HARD_MODS.hpMul : 1);
    this.dmgMul = STAGE_DMG_MUL[o.stage - 1] * (hard ? HARD_MODS.dmgMul : 1);
    this.stats = { duration: 0, damageTaken: 0, shieldStart: this.shield, shieldAbsorbed: 0, shieldLeft: this.shield, protectedDamage: 0, kills: 0, spawned: 0, weapons: {}, shockwaveUsed: false, shockwavePushed: 0, enraged: false, bossPhase: 0 };
    for (const cfg of o.loadout.weapons) {
      const stat: WeaponStat = { uid: cfg.uid, id: cfg.id, grade: cfg.grade, damage: 0, shots: 0, extraShots: 0, chains: 0, overheatTime: 0, kills: 0 };
      this.stats.weapons[cfg.uid] = stat;
      const drones: Drone[] = [];
      for (let i = 0; i < cfg.drones; i++) drones.push({ angle: (i / cfg.drones) * Math.PI * 2, fireTimer: 0.3 + i * 0.2, x: this.player.x, y: this.player.y, recoil: 0 });
      // 첫 발사는 짧은 준비 시간 뒤 (무기별로 살짝 다르게 → 처리 순서 유불리 완화)
      this.weapons.push({ cfg, timer: 0.25 + (this.weapons.length % 3) * 0.08, heat: 0, overheated: false, shotCounter: 0, drones, lastDir: -Math.PI / 2, recoil: 0, slashQueue: [], stat, beam: null });
    }
    this.queue = this.buildQueue(this.stage.groups);
    this.lastSpawnT = this.queue.length ? this.queue[this.queue.length - 1].t : 0;
  }

  // ---------- 등장 계획 ----------
  private buildQueue(groups: SpawnGroup[]): Spawn[] {
    const out: Spawn[] = [];
    for (const g of groups) {
      const gap = g.gap ?? 0.35;
      const base = rngNext(this.rng) * Math.PI * 2;
      for (let i = 0; i < g.count; i++) {
        const p = this.spawnPos(g.side ?? 'any', i, g.count, base);
        out.push({ t: g.t + i * gap, type: g.type, x: p.x, y: p.y });
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  private spawnPos(side: NonNullable<SpawnGroup['side']>, i: number, n: number, base: number): { x: number; y: number } {
    const m = 26;
    const cx = this.player.x, cy = this.player.y;
    if (side === 'top') return { x: m + rngNext(this.rng) * (this.w - 2 * m), y: -m };
    if (side === 'bottom') return { x: m + rngNext(this.rng) * (this.w - 2 * m), y: this.h + m };
    if (side === 'left') return { x: -m, y: m + rngNext(this.rng) * (this.h - 2 * m) };
    if (side === 'right') return { x: this.w + m, y: m + rngNext(this.rng) * (this.h - 2 * m) };
    const a = side === 'ring' ? base + (i / n) * Math.PI * 2 : rngNext(this.rng) * Math.PI * 2;
    const R = Math.max(this.w, this.h) / 2 + 40;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  }

  spawnEnemy(type: EnemyType, x: number, y: number): Enemy {
    const d = ENEMIES[type];
    const isBoss = type === 'boss';
    const hp = Math.round(d.hp * (isBoss ? (this.difficulty === 'hard' ? HARD_MODS.hpMul : 1) : this.hpMul));
    const e: Enemy = {
      id: this.nextId++, type, x, y, kx: 0, ky: 0, hp, maxHp: hp, radius: d.radius, speed: d.speed,
      damage: Math.round(d.damage * (isBoss ? (this.difficulty === 'hard' ? HARD_MODS.dmgMul : 1) : this.dmgMul)),
      attackInterval: d.attackInterval, attackTimer: d.attackInterval * 0.6, armor: d.armor, kbResist: d.knockbackResist, alive: true, hitFlash: 0, facing: 0,
      fuse: -1, phase: 0, summonTimer: 4, crushTimer: 7, crushTelegraph: 0, stun: 0,
    };
    this.enemies.push(e); this.stats.spawned++;
    if (isBoss) { this.bossRef = e; this.events.push({ type: 'boss_spawn' }); }
    return e;
  }

  // ---------- 메인 스텝 ----------
  step(dt = BALANCE.fixedStep): void {
    if (this.over) return;
    this.time += dt;
    if (this.protectTimer > 0) this.protectTimer = Math.max(0, this.protectTimer - dt);
    if (this.player.hitFlash > 0) this.player.hitFlash -= dt;
    if (this.player.pulse > 0) this.player.pulse -= dt;
    // 등장
    const aliveCount = this.enemies.length;
    while (this.queue.length && this.queue[0].t <= this.time && aliveCount < 70) { const s = this.queue.shift()!; this.spawnEnemy(s.type, s.x, s.y); }
    this.updateStall(dt);
    this.updateEnemies(dt);
    if (this.over) return;
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    // 죽은 적 제거
    if (this.enemies.some(e => !e.alive)) this.enemies = this.enemies.filter(e => e.alive);
    // 종료 판정
    if (this.isBoss) {
      if (this.bossRef && !this.bossRef.alive) { this.finish(true); return; }
    } else if (this.queue.length === 0 && this.enemies.length === 0) { this.finish(true); return; }
  }

  private finish(won: boolean): void {
    this.over = true; this.won = won;
    this.stats.duration = this.time; this.stats.shieldLeft = this.shield; this.stats.enraged = this.enraged;
    this.stats.shockwaveUsed = this.shockwaveUsed;
    if (this.bossRef) this.stats.bossPhase = this.bossRef.phase;
    if (won) this.enemies = [];
  }

  result(): BattleResult { return { won: this.won, hpAfter: Math.max(0, this.hp), stats: this.stats }; }

  // ---------- 교착 안전장치 ----------
  private updateStall(dt: number): void {
    if (this.queue.length) return;
    const mul = this.isBoss ? 2.2 : 1;
    const since = this.time - this.lastSpawnT;
    if (!this.stallWarned && since > BALANCE.stall.warnAfter * mul) { this.stallWarned = true; this.events.push({ type: 'stall_warn' }); }
    if (!this.enraged && since > BALANCE.stall.enrageAfter * mul) { this.enraged = true; this.enrageLevel = 1; this.nextEnrage = this.time + BALANCE.stall.enrageEvery; this.events.push({ type: 'enrage' }); this.applyEnrage(); }
    else if (this.enraged && this.time >= this.nextEnrage) { this.enrageLevel++; this.nextEnrage = this.time + BALANCE.stall.enrageEvery; this.applyEnrage(); }
  }
  private applyEnrage(): void { for (const e of this.enemies) { e.speed *= 1.25; e.damage = Math.round(e.damage * 1.4); } }

  // ---------- 플레이어 피해 ----------
  damagePlayer(amount: number): void {
    if (amount <= 0 || this.over) return;
    if (this.protectTimer > 0) { this.stats.protectedDamage += amount; this.events.push({ type: 'player_hit', amount: 0, shielded: false, protectedHit: true }); return; }
    let rest = amount; let shielded = false;
    if (this.shield > 0) { const ab = Math.min(this.shield, rest); this.shield -= ab; rest -= ab; this.stats.shieldAbsorbed += ab; shielded = true; if (this.shield <= 0) this.events.push({ type: 'shield_break' }); }
    if (rest > 0) { this.hp -= rest; this.stats.damageTaken += rest; this.player.hitFlash = 0.2; }
    this.events.push({ type: 'player_hit', amount: rest, shielded, protectedHit: false });
    if (this.hp <= 0) { this.hp = 0; this.finish(false); }
  }

  // ---------- 적 ----------
  private updateEnemies(dt: number): void {
    const p = this.player;
    const es = this.enemies;
    // 분리(겹침 방지)
    for (let i = 0; i < es.length; i++) {
      const a = es[i]; if (!a.alive) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y; const md = (a.radius + b.radius) * 0.9; const d2 = dx * dx + dy * dy;
        if (d2 < md * md && d2 > 0.0001) {
          const d = Math.sqrt(d2); const push = (md - d) * 0.5; const nx = dx / d, ny = dy / d;
          const wa = b.type === 'boss' ? 1 : a.type === 'boss' ? 0 : 0.5; const wb = 1 - wa;
          a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * wb; b.y += ny * push * wb;
        }
      }
    }
    for (const e of es) {
      if (!e.alive) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      // 넉백 속도 감쇠
      const decay = Math.exp(-8 * dt);
      e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= decay; e.ky *= decay;
      const dx = p.x - e.x, dy = p.y - e.y; const dist = Math.hypot(dx, dy) || 0.001;
      const nx = dx / dist, ny = dy / dist; e.facing = Math.atan2(dy, dx);
      const stopDist = p.r + e.radius + 2;
      if (e.type === 'boss') { this.updateBoss(e, dt, dist, nx, ny, stopDist); continue; }
      if (e.type === 'bomber') {
        if (e.fuse < 0 && dist <= stopDist + 28) e.fuse = ENEMIES.bomber.fuse!;
        if (e.fuse >= 0) {
          e.fuse -= dt;
          if (dist > stopDist) { e.x += nx * e.speed * 0.35 * dt; e.y += ny * e.speed * 0.35 * dt; }
          if (e.fuse <= 0) {
            const R = ENEMIES.bomber.blastRadius!;
            this.events.push({ type: 'bomber_blast', x: e.x, y: e.y, r: R });
            if (Math.hypot(p.x - e.x, p.y - e.y) <= R + p.r) this.damagePlayer(e.damage);
            e.alive = false;
            if (this.over) return;
          }
          continue;
        }
      }
      if (dist > stopDist) { const mv = Math.min(e.speed * dt, dist - stopDist); e.x += nx * mv; e.y += ny * mv; }
      if (dist <= stopDist + 12) {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) { e.attackTimer = e.attackInterval; this.damagePlayer(e.damage); if (this.over) return; }
      } else if (e.attackTimer < e.attackInterval * 0.4) e.attackTimer = e.attackInterval * 0.4;
    }
  }

  private updateBoss(b: Enemy, dt: number, dist: number, nx: number, ny: number, stopDist: number): void {
    const hard = this.difficulty === 'hard';
    // 체력 구간 변화
    const ratio = b.hp / b.maxHp;
    const want = ratio <= BOSS.phaseThresholds[1] ? 2 : ratio <= BOSS.phaseThresholds[0] ? 1 : 0;
    if (want > b.phase) { b.phase = want; b.stun = BOSS.phaseStun; this.events.push({ type: 'boss_phase', phase: want }); b.summonTimer = Math.min(b.summonTimer, 2.5); }
    if (b.stun > 0) { b.stun -= dt; return; }
    const speed = b.speed * BOSS.phaseSpeed[b.phase];
    if (dist > stopDist) { const mv = Math.min(speed * dt, dist - stopDist); b.x += nx * mv; b.y += ny * mv; }
    else { b.attackTimer -= dt; if (b.attackTimer <= 0) { b.attackTimer = b.attackInterval; this.damagePlayer(b.damage); if (this.over) return; } }
    // 부하 소환
    b.summonTimer -= dt;
    if (b.summonTimer <= 0) {
      b.summonTimer = BOSS.summonInterval[b.phase] * (hard ? HARD_MODS.bossSummonMul : 1);
      const kinds: EnemyType[] = ['swarm', 'swarm', 'swarm', 'basic'];
      if (b.phase >= 1) kinds.push('rusher', 'swarm'); if (b.phase >= 2) kinds.push('bomber');
      if (hard) kinds.push('rusher');
      kinds.forEach((k, i) => { const a = (i / kinds.length) * Math.PI * 2 + rngNext(this.rng); const r = b.radius + 22; this.spawnEnemy(k, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); });
      this.events.push({ type: 'summon', x: b.x, y: b.y });
    }
    // 예고 있는 압축 공격
    if (b.crushTelegraph > 0) {
      b.crushTelegraph -= dt;
      if (b.crushTelegraph <= 0) {
        const blocked = this.protectTimer > 0 || this.shield >= BOSS.crushDamage;
        this.events.push({ type: 'crush', blocked });
        this.damagePlayer(BOSS.crushDamage);
      }
    } else {
      b.crushTimer -= dt;
      if (b.crushTimer <= 0) { b.crushTimer = hard ? HARD_MODS.bossCrushInterval : BOSS.crushInterval; b.crushTelegraph = BOSS.crushTelegraph; this.events.push({ type: 'crush_warn' }); }
    }
  }

  // ---------- 무기 ----------
  private aliveEnemies(): Enemy[] { return this.enemies.filter(e => e.alive); }
  private nearestInRange(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies) { if (!e.alive) continue; const d = Math.hypot(e.x - x, e.y - y) - e.radius; if (d <= range && d < bd) { bd = d; best = e; } }
    return best;
  }
  private liveProjectiles(uid: string): number { let n = 0; for (const p of this.projectiles) if (p.weaponUid === uid) n++; return n; }

  private updateWeapons(dt: number): void {
    for (const ws of this.weapons) {
      const c = ws.cfg;
      if (ws.recoil > 0) ws.recoil -= dt;
      if (ws.beam) { ws.beam.t -= dt; if (ws.beam.t <= 0) ws.beam = null; }
      // 열
      if (c.heat) {
        if (ws.heat > 0) ws.heat = Math.max(0, ws.heat - c.heat.coolRate * dt);
        if (ws.overheated) { ws.stat.overheatTime += dt; if (ws.heat <= c.heat.max * c.heat.resumeAt) { ws.overheated = false; this.events.push({ type: 'cooled', weapon: c.uid }); } }
      }
      // 연속 베기 대기열
      if (ws.slashQueue.length) {
        for (const q of ws.slashQueue) q.t -= dt;
        const due = ws.slashQueue.filter(q => q.t <= 0);
        ws.slashQueue = ws.slashQueue.filter(q => q.t > 0);
        for (const q of due) this.doSlash(ws, q.dir, q.dmgMul);
      }
      if (c.type === 'drone') { this.updateDrones(ws, dt); continue; }
      if (ws.timer > 0) ws.timer -= dt;
      if (ws.timer > 0 || ws.overheated) continue;
      const fired = this.fire(ws);
      if (fired) {
        ws.timer += c.interval; if (ws.timer < 0) ws.timer = 0;
        ws.stat.shots++; ws.recoil = 0.12; this.player.pulse = 0.12;
        if (c.heat) { ws.heat += c.heat.perShot; if (ws.heat >= c.heat.max) { ws.heat = c.heat.max; ws.overheated = true; this.events.push({ type: 'overheat', weapon: c.uid }); } }
        if (c.ammoEvery) { ws.shotCounter++; if (ws.shotCounter >= c.ammoEvery) { ws.shotCounter = 0; this.fireExtra(ws); } }
      } else ws.timer = Math.min(0.05, c.interval); // 대상 없음: 잠시 후 재시도
    }
  }

  private fire(ws: WeaponState): boolean {
    const c = ws.cfg; const p = this.player;
    switch (c.type) {
      case 'melee': {
        const t = this.nearestInRange(p.x, p.y, c.range); if (!t) return false;
        const dir = Math.atan2(t.y - p.y, t.x - p.x); ws.lastDir = dir;
        this.doSlash(ws, dir, 1);
        for (let i = 1; i < c.slashes; i++) ws.slashQueue.push({ t: 0.16 * i, dir, dmgMul: 0.6 });
        return true;
      }
      case 'mg': {
        const t = this.nearestInRange(p.x, p.y, c.range); if (!t) return false;
        if (this.liveProjectiles(c.uid) >= c.maxProjectiles) return false;
        const dir = Math.atan2(t.y - p.y, t.x - p.x); ws.lastDir = dir;
        this.spawnProjectile('bullet', ws, dir, c.damage, false, c.range / c.projectileSpeed + 0.1);
        this.events.push({ type: 'muzzle', x: p.x, y: p.y, dir, weapon: c.id });
        return true;
      }
      case 'shotgun': {
        const t = this.nearestInRange(p.x, p.y, c.range); if (!t) return false;
        if (this.liveProjectiles(c.uid) + c.pellets > c.maxProjectiles) return false;
        const dir = Math.atan2(t.y - p.y, t.x - p.x); ws.lastDir = dir;
        this.firePellets(ws, dir, c.pellets, c.damage, false);
        this.events.push({ type: 'muzzle', x: p.x, y: p.y, dir, weapon: c.id });
        return true;
      }
      case 'laser': {
        const dir = this.bestLaserDir(ws); if (dir === null) return false;
        ws.lastDir = dir; this.fireLaser(ws, dir);
        return true;
      }
      case 'bomb': {
        const t = this.bestClusterTarget(c.range, c.radius); if (!t) return false;
        if (this.liveProjectiles(c.uid) >= c.maxProjectiles) return false;
        ws.lastDir = Math.atan2(t.y - p.y, t.x - p.x);
        this.spawnBomb('bomb', ws, t.x, t.y, c.damage, c.radius, false, c.fragments);
        this.events.push({ type: 'muzzle', x: p.x, y: p.y, dir: ws.lastDir, weapon: c.id });
        return true;
      }
      default: return false;
    }
  }

  /** 탄약상자 추가 탄: 원본 공격 횟수 기준으로만 발동하고, 추가 탄은 다시 추가 탄을 만들지 않는다. */
  private fireExtra(ws: WeaponState): void {
    const c = ws.cfg; const p = this.player; const dir = ws.lastDir;
    if (c.type === 'mg') {
      if (this.liveProjectiles(c.uid) >= c.maxProjectiles) return;
      this.spawnProjectile('bullet', ws, dir + (rngNext(this.rng) - 0.5) * 0.12, c.damage, true, c.range / c.projectileSpeed + 0.1);
    } else if (c.type === 'shotgun') {
      const n = Math.min(c.pellets + 2, 9);
      if (this.liveProjectiles(c.uid) + n > c.maxProjectiles + 9) return;
      this.firePellets(ws, dir, n, c.damage, true);
    } else if (c.type === 'bomb') {
      const t = this.bestClusterTarget(c.range, c.radius * 0.7); if (!t) return;
      this.spawnBomb('minibomb', ws, t.x + (rngNext(this.rng) - 0.5) * 20, t.y + (rngNext(this.rng) - 0.5) * 20, Math.round(c.damage * 0.5), Math.round(c.radius * 0.7), true, 0);
    } else return;
    ws.stat.extraShots++;
    this.events.push({ type: 'muzzle', x: p.x, y: p.y, dir, weapon: c.id, extra: true });
  }

  private firePellets(ws: WeaponState, dir: number, n: number, dmg: number, extra: boolean): void {
    const c = ws.cfg; const spread = (c.spread * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? dir : dir - spread / 2 + (spread * i) / (n - 1);
      this.spawnProjectile('pellet', ws, a + (rngNext(this.rng) - 0.5) * 0.04, dmg, extra, c.range / c.projectileSpeed);
    }
  }

  private spawnProjectile(kind: Projectile['kind'], ws: WeaponState, dir: number, dmg: number, extra: boolean, life: number, from?: { x: number; y: number }, canChain = false): void {
    const c = ws.cfg; const sp = c.projectileSpeed; const o = from ?? this.player;
    this.projectiles.push({ id: this.nextId++, kind, x: o.x + Math.cos(dir) * 10, y: o.y + Math.sin(dir) * 10, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, life, dmg, weaponUid: c.uid, extra, canChain, radius: 0, sx: o.x, sy: o.y, tx: 0, ty: 0, t: 0, flight: 0, fragments: 0 });
  }
  private spawnBomb(kind: 'bomb' | 'minibomb' | 'fragment', ws: WeaponState, tx: number, ty: number, dmg: number, radius: number, extra: boolean, fragments: number, from?: { x: number; y: number }, flight?: number): void {
    const o = from ?? this.player;
    this.projectiles.push({ id: this.nextId++, kind, x: o.x, y: o.y, vx: 0, vy: 0, life: 10, dmg, weaponUid: ws.cfg.uid, extra, canChain: false, radius, sx: o.x, sy: o.y, tx, ty, t: 0, flight: flight ?? ws.cfg.flightTime, fragments });
  }

  private doSlash(ws: WeaponState, dir: number, dmgMul: number): void {
    const c = ws.cfg; const p = this.player; const half = (c.arc * Math.PI) / 360;
    this.events.push({ type: 'slash', x: p.x, y: p.y, dir, arc: c.arc, range: c.range });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius; if (d > c.range) continue;
      let a = Math.atan2(e.y - p.y, e.x - p.x) - dir; a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) <= half) this.applyHit(e, Math.round(c.damage * dmgMul), ws, { knock: 12 });
    }
  }

  /** 레이저: 사거리 안의 각 적 방향을 후보로, 광선 폭 안에 들어오는 적 수가 최대인 방향(동률이면 가까운 쪽). */
  private bestLaserDir(ws: WeaponState): number | null {
    const c = ws.cfg; const p = this.player; const es = this.aliveEnemies();
    let best: number | null = null, bestN = 0, bestD = Infinity;
    for (const t of es) {
      const d = Math.hypot(t.x - p.x, t.y - p.y); if (d - t.radius > c.range) continue;
      const dir = Math.atan2(t.y - p.y, t.x - p.x);
      const n = this.enemiesOnBeam(dir, c.range, c.width).length;
      if (n > bestN || (n === bestN && d < bestD)) { bestN = n; bestD = d; best = dir; }
    }
    return best;
  }
  private enemiesOnBeam(dir: number, range: number, width: number): { e: Enemy; along: number }[] {
    const p = this.player; const cx = Math.cos(dir), cy = Math.sin(dir); const out: { e: Enemy; along: number }[] = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x, dy = e.y - p.y; const along = dx * cx + dy * cy; if (along < 0 || along - e.radius > range) continue;
      const perp = Math.abs(-dx * cy + dy * cx); if (perp <= width + e.radius) out.push({ e, along });
    }
    out.sort((a, b) => a.along - b.along);
    return out;
  }
  private fireLaser(ws: WeaponState, dir: number): void {
    const c = ws.cfg; const p = this.player;
    const hits = this.enemiesOnBeam(dir, c.range, c.width).slice(0, c.pierce);
    ws.beam = { dir, len: c.range, t: 0.16 };
    this.events.push({ type: 'laser', x: p.x, y: p.y, dir, len: c.range, width: c.width });
    const hitIds = new Set<number>();
    for (const h of hits) { hitIds.add(h.e.id); this.applyHit(h.e, c.damage, ws, { knock: 4 }); }
    if (hits.length && c.lensMul) this.tryChain(ws, hits[0].e, c.damage, hitIds); // 광선 1회당 연쇄 최대 1회
  }

  private bestClusterTarget(range: number, radius: number): Enemy | null {
    const p = this.player; let best: Enemy | null = null, bestN = 0, bestD = Infinity;
    for (const t of this.enemies) {
      if (!t.alive) continue; const d = Math.hypot(t.x - p.x, t.y - p.y); if (d - t.radius > range || d < 30) continue;
      let n = 0; for (const e of this.enemies) if (e.alive && Math.hypot(e.x - t.x, e.y - t.y) <= radius + e.radius) n++;
      if (n > bestN || (n === bestN && d < bestD)) { bestN = n; bestD = d; best = t; }
    }
    return best;
  }

  private updateDrones(ws: WeaponState, dt: number): void {
    const c = ws.cfg; const p = this.player; const R = 58;
    for (const d of ws.drones) {
      d.angle += 1.7 * dt; d.x = p.x + Math.cos(d.angle) * R; d.y = p.y + Math.sin(d.angle) * R;
      if (d.recoil > 0) d.recoil -= dt;
      d.fireTimer -= dt; if (d.fireTimer > 0) continue;
      const t = this.nearestInRange(d.x, d.y, c.range);
      if (!t) { d.fireTimer = 0.08; continue; }
      if (this.liveProjectiles(c.uid) >= c.maxProjectiles) { d.fireTimer = 0.08; continue; }
      d.fireTimer = c.interval; d.recoil = 0.1;
      const dir = Math.atan2(t.y - d.y, t.x - d.x);
      this.spawnProjectile('bolt', ws, dir, c.damage, false, c.range / c.projectileSpeed + 0.1, d, !!c.lensMul);
      ws.stat.shots++;
      this.events.push({ type: 'muzzle', x: d.x, y: d.y, dir, weapon: c.id });
    }
  }

  /** 공명 렌즈 연쇄: 원본 공격 1회당 최대 1회, 원래 적 제외, 감소된 피해, 연쇄는 새 연쇄를 만들지 않는다. */
  private tryChain(ws: WeaponState, from: Enemy, baseDmg: number, exclude: Set<number>): void {
    const mul = ws.cfg.lensMul; if (!mul) return;
    let best: Enemy | null = null, bd = 90;
    for (const e of this.enemies) { if (!e.alive || e.id === from.id || exclude.has(e.id)) continue; const d = Math.hypot(e.x - from.x, e.y - from.y); if (d <= bd) { bd = d; best = e; } }
    if (!best) return;
    ws.stat.chains++;
    this.events.push({ type: 'chain', x: from.x, y: from.y, x2: best.x, y2: best.y });
    this.applyHit(best, Math.round(baseDmg * mul), ws, { chain: true, knock: 3 });
  }

  // ---------- 투사체 ----------
  private updateProjectiles(dt: number): void {
    const keep: Projectile[] = [];
    for (const pr of this.projectiles) {
      const ws = this.weapons.find(w => w.cfg.uid === pr.weaponUid)!;
      if (pr.kind === 'bomb' || pr.kind === 'minibomb' || pr.kind === 'fragment') {
        pr.t += dt; const k = Math.min(1, pr.t / pr.flight);
        pr.x = pr.sx + (pr.tx - pr.sx) * k; pr.y = pr.sy + (pr.ty - pr.sy) * k;
        if (k >= 1) { this.explode(pr, ws); continue; }
        keep.push(pr); continue;
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.life <= 0 || pr.x < -40 || pr.y < -40 || pr.x > this.w + 40 || pr.y > this.h + 40) continue;
      let hit: Enemy | null = null; let bd = Infinity;
      for (const e of this.enemies) { if (!e.alive) continue; const d = Math.hypot(e.x - pr.x, e.y - pr.y); if (d <= e.radius + 3 && d < bd) { bd = d; hit = e; } }
      if (hit) {
        this.applyHit(hit, pr.dmg, ws, { extra: pr.extra, knock: pr.kind === 'pellet' ? 7 : pr.kind === 'bolt' ? 4 : 5 });
        if (pr.canChain) this.tryChain(ws, hit, pr.dmg, new Set([hit.id]));
        continue;
      }
      keep.push(pr);
    }
    this.projectiles = keep;
  }
  private explode(pr: Projectile, ws: WeaponState): void {
    this.events.push({ type: 'explosion', x: pr.x, y: pr.y, r: pr.radius, extra: pr.extra, small: pr.kind !== 'bomb' });
    for (const e of this.enemies) { if (!e.alive) continue; if (Math.hypot(e.x - pr.x, e.y - pr.y) <= pr.radius + e.radius) this.applyHit(e, pr.dmg, ws, { extra: pr.extra, knock: pr.kind === 'bomb' ? 18 : 10, from: { x: pr.x, y: pr.y } }); }
    for (let i = 0; i < pr.fragments; i++) {
      const a = (i / pr.fragments) * Math.PI * 2 + rngNext(this.rng) * 0.5; const d = 42;
      this.spawnBomb('fragment', ws, pr.x + Math.cos(a) * d, pr.y + Math.sin(a) * d, Math.round(pr.dmg * 0.35), 28, pr.extra, 0, { x: pr.x, y: pr.y }, 0.25);
    }
  }

  // ---------- 피격 ----------
  applyHit(e: Enemy, dmg: number, ws: WeaponState, o: { extra?: boolean; chain?: boolean; knock?: number; from?: { x: number; y: number } } = {}): number {
    if (!e.alive || this.over) return 0;
    let eff = Math.max(dmg - e.armor, dmg * ARMOR_MIN_RATIO);
    if (e.type === 'boss') eff *= BOSS.phaseDamageTaken[e.phase];
    eff = Math.round(eff * 10) / 10;
    e.hp -= eff; e.hitFlash = 0.1;
    ws.stat.damage += eff;
    if (o.knock && e.kbResist < 1) {
      const f = o.from ?? this.player; const dx = e.x - f.x, dy = e.y - f.y; const d = Math.hypot(dx, dy) || 1;
      const k = o.knock * 8 * (1 - e.kbResist); e.kx += (dx / d) * k; e.ky += (dy / d) * k; // 감쇠 8/s → 총 변위 ≈ knock px
    }
    this.events.push({ type: 'hit', x: e.x, y: e.y, dmg: eff, chain: o.chain, extra: o.extra, enemy: e.type });
    if (e.hp <= 0) { e.alive = false; ws.stat.kills++; this.stats.kills++; this.events.push({ type: 'die', x: e.x, y: e.y, enemy: e.type }); }
    return eff;
  }

  // ---------- 긴급 충격파 ----------
  useShockwave(): boolean {
    if (this.shockwaveUsed || this.over) return false;
    this.shockwaveUsed = true; this.stats.shockwaveUsed = true;
    const p = this.player; const S = BALANCE.shockwave; let pushed = 0;
    this.events.push({ type: 'shockwave', x: p.x, y: p.y, r: S.radius });
    for (const e of this.enemies) {
      if (!e.alive) continue; const dx = e.x - p.x, dy = e.y - p.y; const d = Math.hypot(dx, dy);
      if (d > S.radius) continue;
      if (e.kbResist < 1) { const k = S.push * 8 * (1 - e.kbResist); e.kx += (dx / (d || 1)) * k; e.ky += (dy / (d || 1)) * k; pushed++; }
      if (S.damage > 0) { e.hp -= S.damage; e.hitFlash = 0.1; if (e.hp <= 0) { e.alive = false; this.stats.kills++; this.events.push({ type: 'die', x: e.x, y: e.y, enemy: e.type }); } }
    }
    this.protectTimer = S.protect; this.stats.shockwavePushed = pushed;
    return true;
  }

  drainEvents(): FxEvent[] { const ev = this.events; this.events = []; return ev; }
}

/** 편의: 전투를 끝까지(또는 maxSeconds까지) 돌리고 결과를 돌려준다. shockwaveAt: 해당 시각에 충격파 사용. */
export function runBattle(o: SimOptions & { maxSeconds?: number; shockwaveAt?: number }): { result: BattleResult; sim: BattleSim } {
  const sim = new BattleSim(o);
  const max = o.maxSeconds ?? 300;
  let sw = false;
  while (!sim.over && sim.time < max) {
    if (o.shockwaveAt !== undefined && !sw && sim.time >= o.shockwaveAt) { sim.useShockwave(); sw = true; }
    sim.step();
    sim.drainEvents();
  }
  if (!sim.over) { sim.stats.duration = sim.time; }
  return { result: sim.result(), sim };
}
