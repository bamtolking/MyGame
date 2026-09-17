/**
 * Authoritative match simulation. Fixed 20 Hz tick. Pure data state
 * (MatchState) + this class of methods. No rendering, no DOM.
 *
 * Tick order (symmetric for both sides):
 *  1. economy income, dispatch waves (roster snapshots)
 *  2. status effects, build spatial hash, compute team fronts
 *  3. every unit decides target + desired velocity (from start-of-tick positions)
 *  4. attacks / abilities queue damage (no state mutation of hp yet)
 *  5. projectiles advance, arrivals queue damage
 *  6. ALL queued damage applied at once (deaths resolved after) -> no side bias
 *  7. movement integration, separation, bounds
 *  8. relay capture, cannon, overtime, victory check
 */
import { Rng } from '../rng.ts';
import { unitDef, FACTIONS } from '../data/units.ts';
import { DT, MAP, ROSTER, ECON, MATCH, UPGRADE, TICK_RATE } from '../data/balance.ts';
import type { UnitDef, WeaponDef, Layer, Team, ArmorTag, FactionId } from '../types.ts';
import type {
  MatchState, Player, Unit, Projectile, Building, SimEvent, MatchMode, AiLevel, MatchResult, PlayerStats,
} from './state.ts';
import { SAVE_VERSION } from './state.ts';
import { applyCommand, emptyTypeStats, type Command, type CmdResult } from './commands.ts';
import { SpatialHash } from './spatial.ts';
import { rawDamage, afterArmor, canHitLayer } from './combat.ts';
import { runAi } from '../ai/ai.ts';

export interface PlayerConfig {
  faction: FactionId;
  isHuman: boolean;
  ai: AiLevel | null;
  name?: string;
}

export interface MatchConfig {
  mode: MatchMode;
  seed: number;
  /** players in order: team0 slots then team1 slots */
  players: PlayerConfig[];
  setupSeconds?: number;
  tutorial?: boolean;
}

interface Damage {
  targetId: number; // >0 unit, <0 building
  amount: number;
  srcOwner: number;
  srcType: string;
  x: number;
  y: number;
}

const STRUCT_TAGS: ArmorTag[] = ['structure'];

export class Match {
  s: MatchState;
  rng: Rng;
  events: SimEvent[] = [];
  private hash: SpatialHash;
  private damage: Damage[] = [];
  private fronts: [number, number] = [0, 0];
  /** median forward position per (owner, wave) group, for cohesion */
  private groupFront: Map<number, number> = new Map();
  private repairCount: Map<number, number> = new Map();
  private unitById: Map<number, Unit> = new Map();

  constructor(state: MatchState) {
    this.s = state;
    this.rng = new Rng(state.seed);
    this.rng.state = state.rngState;
    this.hash = new SpatialHash(MAP.W, MAP.H, 80);
    this.rebuildIndex();
  }

  static create(cfg: MatchConfig): Match {
    const players: Player[] = [];
    const perTeam = cfg.mode === '3v3' ? 3 : 1;
    const interval = cfg.mode === '3v3' ? MATCH.teamInterval : MATCH.interval1v1;
    cfg.players.forEach((pc, i) => {
      const team = (i < perTeam ? 0 : 1) as Team;
      const slot = i % perTeam;
      players.push({
        index: i, team, slot, faction: pc.faction,
        name: pc.name ?? (pc.isHuman ? '플레이어' : `AI ${['A', 'B', 'C'][slot]}${team === 1 ? "'" : ''}`),
        isHuman: pc.isHuman, ai: pc.isHuman ? null : pc.ai,
        credits: ECON.startCredits, econLevel: 0, tech: 1,
        upgrades: { attack: 0, defense: 0, support: 0 },
        roster: new Array(ROSTER.cols * ROSTER.rows).fill(null),
        nextDispatchAt: cfg.mode === '3v3' ? slot * MATCH.teamStagger : 0,
        interval, waveCount: 0, waves: [],
        spent: { units: 0, econ: 0, tech: 0, upgrades: 0, refunds: 0 },
        request: null, requestAt: 0, aiState: {},
      });
    });
    const mk = (team: Team, kind: 'core' | 'outpost', id: number): Building => {
      const lx = kind === 'core' ? MAP.coreX : MAP.outpostX;
      const x = team === 0 ? lx : MAP.W - lx;
      return {
        id, team, kind, x, y: MAP.coreY, r: kind === 'core' ? MAP.coreR : MAP.outpostR,
        hp: kind === 'core' ? MATCH.coreHp : MATCH.outpostHp, maxHp: kind === 'core' ? MATCH.coreHp : MATCH.outpostHp,
        armor: kind === 'core' ? MATCH.coreArmor : MATCH.outpostArmor,
        turret: kind === 'core' ? { ...MATCH.coreTurret } : { ...MATCH.outpostTurret },
        cooldown: 0, targetId: 0, facing: team === 0 ? 0 : Math.PI, alive: true,
      };
    };
    const stats: PlayerStats[] = players.map(() => ({ byType: {}, buildingDamage: 0 }));
    const state: MatchState = {
      version: SAVE_VERSION, mode: cfg.mode, seed: cfg.seed, rngState: cfg.seed >>> 0,
      phase: 'setup', phaseT: cfg.setupSeconds ?? MATCH.setupSeconds, t: 0, tick: 0,
      players, units: [], projectiles: [],
      buildings: [mk(0, 'core', 1), mk(0, 'outpost', 2), mk(1, 'core', 3), mk(1, 'outpost', 4)],
      relay: { progress: 0, owner: -1, contested: false, presence: [0, 0] },
      cannon: [{ used: false, pending: null }, { used: false, pending: null }],
      overtimeMult: 1, overtimeNext: MATCH.overtimeStart, result: null, nextId: 1, stats,
      paused: false, humanPlayer: players.findIndex((p) => p.isHuman), tutorial: !!cfg.tutorial,
    };
    return new Match(state);
  }

  // ───────────────────────────── helpers ─────────────────────────────
  fwd(team: Team, x: number): number {
    return team === 0 ? x : MAP.W - x;
  }
  /** grid cell -> world spawn position for a team */
  spawnPos(team: Team, cell: number): { x: number; y: number } {
    const col = cell % ROSTER.cols;
    const row = Math.floor(cell / ROSTER.cols);
    const lx = MAP.spawnX0 + col * MAP.spawnColGap;
    return { x: team === 0 ? lx : MAP.W - lx, y: MAP.spawnY0 + row * MAP.spawnRowGap };
  }
  unit(id: number): Unit | undefined {
    return this.unitById.get(id);
  }
  building(id: number): Building | undefined {
    return this.s.buildings.find((b) => b.id === id);
  }
  income(p: Player): number {
    const relay = this.s.relay.owner === p.team ? ECON.baseIncome * ECON.relayBonusFrac : 0;
    return ECON.baseIncome + p.econLevel * ECON.econIncomePerLevel + relay;
  }
  outpostAlive(team: Team): boolean {
    return this.s.buildings.some((b) => b.team === team && b.kind === 'outpost' && b.alive);
  }
  coreOf(team: Team): Building {
    return this.s.buildings.find((b) => b.team === team && b.kind === 'core')!;
  }
  private rebuildIndex() {
    this.unitById.clear();
    for (const u of this.s.units) this.unitById.set(u.id, u);
  }
  private emit(e: SimEvent) {
    this.events.push(e);
  }

  // ───────────────────────────── commands ─────────────────────────────
  command(c: Command): CmdResult {
    if (c.type === 'cannon') return this.fireCannon(this.s.players[c.player].team, c.x, c.y);
    return applyCommand(this.s, c);
  }

  cannonZoneOk(team: Team, x: number, y: number): boolean {
    return this.fwd(team, x) <= MAP.cannonZoneX && x >= 0 && x <= MAP.W && y >= 0 && y <= MAP.H;
  }

  fireCannon(team: Team, x: number, y: number): CmdResult {
    const c = this.s.cannon[team];
    if (this.s.phase !== 'battle') return { ok: false, reason: '전투 중에만 사용 가능' };
    if (c.used || c.pending) return { ok: false, reason: '이미 사용함' };
    if (!this.cannonZoneOk(team, x, y)) return { ok: false, reason: '자기 기지 근처에서만 사용 가능' };
    c.pending = { x, y, at: this.s.t + MATCH.cannon.warning };
    this.emit({ kind: 'cannonWarn', x, y, team });
    return { ok: true };
  }

  /** Skip remaining setup time (human ready). */
  skipSetup() {
    if (this.s.phase === 'setup') {
      this.s.phase = 'countdown';
      this.s.phaseT = MATCH.countdownSeconds;
    }
  }

  // ───────────────────────────── main step ─────────────────────────────
  step() {
    const s = this.s;
    this.events.length = 0;
    if (s.result || s.paused) return;
    if (s.phase === 'setup') {
      s.phaseT -= DT;
      this.aiTurns();
      if (s.phaseT <= 0) {
        s.phase = 'countdown';
        s.phaseT = MATCH.countdownSeconds;
      }
      this.syncRng();
      return;
    }
    if (s.phase === 'countdown') {
      s.phaseT -= DT;
      if (s.phaseT <= 0) {
        s.phase = 'battle';
        s.t = 0;
        s.tick = 0;
      }
      this.syncRng();
      return;
    }
    // battle
    s.tick += 1;
    s.t = s.tick / TICK_RATE;
    const t = s.t;
    for (const p of s.players) p.credits += this.income(p) * DT;
    this.aiTurns();
    this.dispatchWaves();

    // prepare
    for (const u of s.units) {
      u.px = u.x;
      u.py = u.y;
      if (u.flash > 0) u.flash -= DT;
      if (u.shield > 0 && t >= u.shieldUntil) u.shield = 0;
    }
    this.hash.clear();
    for (const u of s.units) this.hash.insert(u);
    this.computeFronts();
    this.repairCount.clear();
    this.damage.length = 0;

    for (const u of s.units) this.updateUnit(u);
    for (const b of s.buildings) this.updateBuilding(b);
    this.updateProjectiles();
    this.updateCannon();
    this.applyDamage();
    this.integrateMovement();
    this.updateRelay();
    this.removeDead();
    this.updateOvertime();
    this.checkVictory();
    this.syncRng();
  }

  private syncRng() {
    this.s.rngState = this.rng.state;
  }

  private aiTurns() {
    for (const p of this.s.players) {
      if (p.ai) runAi(this, p);
    }
  }

  // ───────────────────────────── dispatch ─────────────────────────────
  private dispatchWaves() {
    const s = this.s;
    for (const p of s.players) {
      if (s.t + 1e-9 < p.nextDispatchAt) continue;
      const counts: Record<string, number> = {};
      let count = 0;
      let value = 0;
      for (let cell = 0; cell < p.roster.length; cell++) {
        const e = p.roster[cell];
        if (!e) continue;
        e.dispatched = true;
        const def = unitDef(e.unitId);
        const pos = this.spawnPos(p.team, cell);
        this.spawnUnit(p, def, pos.x, pos.y, p.waveCount);
        counts[e.unitId] = (counts[e.unitId] ?? 0) + 1;
        count++;
        value += def.cost;
      }
      p.waves.push({ idx: p.waveCount, t: s.t, counts, value });
      if (p.waves.length > 40) p.waves.shift();
      p.waveCount += 1;
      p.nextDispatchAt += p.interval;
      this.emit({ kind: 'dispatch', player: p.index, count, t: s.t });
    }
  }

  spawnUnit(p: Player, def: UnitDef, x: number, y: number, wave: number): Unit {
    const s = this.s;
    const hp = Math.round(def.hp * (1 + UPGRADE.hpPerLevel * p.upgrades.defense));
    const u: Unit = {
      id: s.nextId++, team: p.team, owner: p.index, type: def.id,
      x, y, px: x, py: y, vx: 0, vy: 0, laneY: y, facing: p.team === 0 ? 0 : Math.PI,
      hp, maxHp: hp, armor: def.armor + UPGRADE.armorPerLevel * p.upgrades.defense,
      shield: 0, shieldUntil: 0,
      atkMult: 1 + UPGRADE.attackPerLevel * p.upgrades.attack,
      supMult: 1 + UPGRADE.supportPerLevel * p.upgrades.support,
      layer: def.layer, targetId: 0, retargetT: 0, move: 'advance', phase: 'idle', phaseT: 0,
      cooldown: 0, burstLeft: 0, burstT: 0, slowUntil: 0, slowFactor: 1,
      pool: def.ability ? def.ability.pool * (1 + UPGRADE.supportPerLevel * p.upgrades.support) : 0,
      abilityT: 0, flankLane: 0, stuckT: 0, jitterT: 0, jitterDir: 1, sx: x, sy: y,
      wave, bornAt: s.t, dead: false, anim: 0, flash: 0,
    };
    if (def.behavior === 'flank') {
      u.flankLane = y < MAP.H / 2 ? 1 : 2;
      u.move = 'lane';
    }
    s.units.push(u);
    this.unitById.set(u.id, u);
    this.emit({ kind: 'spawn', x, y, unitId: u.id });
    return u;
  }

  // ───────────────────────────── fronts ─────────────────────────────
  private computeFronts() {
    const arrs: number[][] = [[], []];
    for (const u of this.s.units) {
      const def = unitDef(u.type);
      if (def.layer !== 'ground') continue;
      if (def.behavior === 'artillery' || def.behavior === 'support' || def.behavior === 'flank') continue;
      arrs[u.team].push(this.fwd(u.team, u.x));
    }
    // cohesion groups: same owner + same wave march together
    const groups = new Map<number, number[]>();
    for (const u of this.s.units) {
      const def = unitDef(u.type);
      if (def.behavior === 'artillery' || def.behavior === 'support' || def.behavior === 'flank') continue;
      const key = u.owner * 10000 + u.wave;
      let g = groups.get(key);
      if (!g) { g = []; groups.set(key, g); }
      g.push(this.fwd(u.team, u.x));
    }
    this.groupFront.clear();
    for (const [key, g] of groups) {
      g.sort((x, y) => x - y);
      this.groupFront.set(key, g[Math.floor(g.length * 0.5)]);
    }
    for (let t = 0; t < 2; t++) {
      const a = arrs[t];
      if (a.length === 0) {
        this.fronts[t] = this.fwd(t as Team, t === 0 ? MAP.outpostX : MAP.W - MAP.outpostX) + 140;
      } else {
        a.sort((x, y) => x - y);
        this.fronts[t] = a[Math.min(a.length - 1, Math.floor(a.length * 0.7))];
      }
    }
  }

  // ───────────────────────────── targeting ─────────────────────────────
  private targetValid(u: Unit, w: WeaponDef | undefined): boolean {
    const id = u.targetId;
    if (id === 0 || !w) return false;
    if (id > 0) {
      const t = this.unitById.get(id);
      return !!t && !t.dead && t.team !== u.team && canHitLayer(w, t.layer);
    }
    const b = this.building(-id);
    return !!b && b.alive && b.team !== u.team && this.buildingAttackable(b);
  }

  buildingAttackable(b: Building): boolean {
    if (b.kind === 'outpost') return true;
    return !this.outpostAlive(b.team);
  }

  private acquire(u: Unit, def: UnitDef, w: WeaponDef): void {
    const dive = def.behavior === 'flank' && u.flankLane === 3;
    const sight = Math.max(w.range + 120, 260) + (dive ? 260 : 0);
    let best = 0;
    let bestScore = Infinity;
    this.hash.query(u.x, u.y, sight, (o, d2) => {
      if (o.team === u.team || o.dead) return;
      if (!canHitLayer(w, o.layer)) return;
      const d = Math.sqrt(d2);
      const od = unitDef(o.type);
      const edge = d - def.radius - od.radius;
      if (w.minRange && edge < w.minRange * 0.85) return;
      let score = d;
      if (w.preferAir && o.layer === 'air') score -= 260;
      if (w.preferAir && o.layer === 'ground') score += 120;
      if (dive) {
        if (od.behavior === 'artillery' || od.behavior === 'support') score -= 320;
        else if (od.behavior === 'ranged') score -= 120;
      }
      if (def.roles.includes('antiarmor') && od.armorTags.includes('armored')) score -= 60;
      if (def.roles.includes('aoe') && od.armorTags.includes('light')) score -= 30;
      if (score < bestScore) {
        bestScore = score;
        best = o.id;
      }
    });
    // buildings: only when not in flank-lane mode
    if (u.move !== 'lane') {
      for (const b of this.s.buildings) {
        if (b.team === u.team || !b.alive || !this.buildingAttackable(b)) continue;
        const d = Math.hypot(b.x - u.x, b.y - u.y) - b.r;
        if (d > sight) continue;
        const score = d + 40;
        if (score < bestScore) {
          bestScore = score;
          best = -b.id;
        }
      }
    }
    u.targetId = best;
    u.retargetT = 0.5;
  }

  private targetPos(id: number): { x: number; y: number; r: number; vx: number; vy: number; layer: Layer } | null {
    if (id > 0) {
      const t = this.unitById.get(id);
      if (!t || t.dead) return null;
      return { x: t.x, y: t.y, r: unitDef(t.type).radius, vx: t.vx, vy: t.vy, layer: t.layer };
    }
    const b = this.building(-id);
    if (!b || !b.alive) return null;
    return { x: b.x, y: b.y, r: b.r, vx: 0, vy: 0, layer: 'ground' };
  }

  // ───────────────────────────── unit update ─────────────────────────────
  private updateUnit(u: Unit) {
    const s = this.s;
    const def = unitDef(u.type);
    const w = def.weapon;
    const team = u.team;
    const dir = team === 0 ? 1 : -1;
    const speedMul = s.t < u.slowUntil ? u.slowFactor : 1;
    const speed = def.speed * speedMul;
    if (u.cooldown > 0) u.cooldown -= DT;
    if (u.retargetT > 0) u.retargetT -= DT;

    // targeting
    if (w) {
      const valid = this.targetValid(u, w);
      if (!valid || u.retargetT <= 0) {
        const prev = u.targetId;
        // keep a valid target if still reasonably close (hysteresis)
        let keep = false;
        if (valid) {
          const tp = this.targetPos(prev)!;
          const edge = Math.hypot(tp.x - u.x, tp.y - u.y) - def.radius - tp.r;
          keep = edge <= w.range * 1.25 && !(w.minRange && edge < w.minRange * 0.85);
          if (keep) u.retargetT = 0.5;
        }
        if (!keep) this.acquire(u, def, w);
      }
    }

    // ── movement decision ──
    let gx = u.x;
    let gy = u.y;
    let wantMove = false;
    let stopAt = 0;
    let cohesionSlow = 1;
    const front = this.fronts[team];
    const enemyFrontMy = MAP.W - this.fronts[1 - team]; // enemy front line in *my* forward coordinates
    const myF = this.fwd(team, u.x);
    const toWorldX = (f: number) => (team === 0 ? f : MAP.W - f);

    const tp = w && u.targetId !== 0 ? this.targetPos(u.targetId) : null;
    let inRange = false;
    let edge = Infinity;
    if (tp && w) {
      edge = Math.hypot(tp.x - u.x, tp.y - u.y) - def.radius - tp.r;
      inRange = edge <= w.range && !(w.minRange && edge < w.minRange);
    }

    if (def.behavior === 'flank' && u.move === 'lane') {
      // travel along the map edge, only engage very close threats
      const laneY = u.flankLane === 1 ? MAP.laneTop : MAP.laneBottom;
      const past = myF > enemyFrontMy + 180 || myF > this.fwd(team, team === 0 ? MAP.W - MAP.outpostX : MAP.outpostX) - 140;
      if (past) { u.move = 'dive'; u.flankLane = 3; }
      if (tp && edge < 70) {
        gx = tp.x; gy = tp.y; wantMove = !inRange; stopAt = w!.range * 0.9;
      } else {
        gx = toWorldX(myF + 400); gy = laneY; wantMove = true;
        if (Math.abs(u.y - laneY) > 30) { gx = u.x + dir * 120; }
      }
    } else if (def.behavior === 'support') {
      // follow nearby ally combat units, stay behind the front
      let cx = 0, cy = 0, n = 0;
      this.hash.query(u.x, u.y, 360, (o) => {
        if (o.team !== team || o.dead || o.id === u.id) return;
        const od = unitDef(o.type);
        if (od.behavior === 'support' || od.behavior === 'flank') return;
        cx += o.x; cy += o.y; n++;
      });
      if (n > 0) {
        cx /= n; cy /= n;
        const cf = this.fwd(team, cx);
        const goalF = Math.min(cf - 20, front - 60);
        gx = toWorldX(goalF); gy = cy; wantMove = Math.hypot(gx - u.x, gy - u.y) > 30;
      } else {
        const goalF = Math.min(this.fwd(team, team === 0 ? MAP.outpostX : MAP.W - MAP.outpostX) + 120, front - 60);
        gx = toWorldX(goalF); gy = u.laneY; wantMove = Math.hypot(gx - u.x, gy - u.y) > 20;
      }
      this.doAbility(u, def);
    } else if (def.behavior === 'artillery') {
      const holdF = front - 110;
      if (tp && inRange) {
        wantMove = false;
      } else if (tp && edge < (w!.minRange ?? 0)) {
        // too close: back away
        gx = toWorldX(myF - 150); gy = u.y; wantMove = true; u.move = 'retreat';
      } else if (tp && myF < holdF) {
        gx = tp.x; gy = tp.y; wantMove = true; stopAt = w!.range * 0.92;
      } else {
        // hold behind allies; advance only as allies advance
        const goalF = Math.min(this.objectiveF(team), holdF);
        if (myF > goalF + 25) { gx = toWorldX(goalF); gy = u.y; wantMove = true; u.move = 'retreat'; }
        else if (myF < goalF - 10) { gx = toWorldX(goalF); gy = this.laneGoalY(u, team, goalF); wantMove = true; u.move = 'advance'; }
        else { wantMove = false; u.move = 'hold'; }
      }
    } else {
      // assault / ranged / interceptor / bomber
      let kiting = false;
      if (def.kite && w && u.phase === 'idle' && u.cooldown > 0.12 && u.layer === 'ground') {
        // hit-and-run: back away from melee attackers that get too close
        let ex = 0, ey = 0, ed = Infinity;
        this.hash.query(u.x, u.y, w.range * 0.4, (o, d2) => {
          if (o.team === team || o.dead || o.layer !== 'ground') return;
          const ow = unitDef(o.type).weapon;
          if (!ow || ow.range > 40) return;
          if (d2 < ed) { ed = d2; ex = o.x; ey = o.y; }
        });
        if (ed < Infinity) {
          const d = Math.sqrt(ed) || 1;
          gx = u.x + ((u.x - ex) / d) * 90; gy = u.y + ((u.y - ey) / d) * 90;
          // don't back into the map edge: bias toward own side
          gx += dir * -30;
          wantMove = true; stopAt = 0; kiting = true; u.move = 'retreat'; cohesionSlow = 0.8;
        }
      }
      if (kiting) {
        // handled above
      } else if (tp) {
        if (inRange) { wantMove = false; u.move = 'engage'; }
        else {
          gx = tp.x; gy = tp.y; wantMove = true; stopAt = w!.range * 0.92; u.move = 'engage';
          // slight lead for slow units chasing fast ones
          if (def.layer === 'ground' && tp.layer === 'air' && !canHitLayer(w!, 'air')) wantMove = false;
        }
      } else {
        const goalF = this.objectiveF(team);
        gx = toWorldX(goalF); gy = this.laneGoalY(u, team, goalF); wantMove = true;
        if (u.move !== 'dive') u.move = 'advance';
        // cohesion: don't outrun the bulk of your own wave (fast units wait for the group)
        const gf = this.groupFront.get(u.owner * 10000 + u.wave);
        if (gf !== undefined && myF > gf + 100) cohesionSlow = 0.3;
      }
    }

    // ── attack state machine ──
    if (w) {
      if (u.phase === 'windup') {
        u.phaseT -= DT;
        const tpos = this.targetPos(u.targetId);
        const stillOk = tpos && this.targetValid(u, w) && Math.hypot(tpos.x - u.x, tpos.y - u.y) - def.radius - tpos.r <= w.range * 1.2;
        if (!stillOk) { u.phase = 'idle'; u.cooldown = Math.min(u.cooldown, 0.2); }
        else if (u.phaseT <= 0) {
          this.fire(u, def, w);
          u.phase = 'recover';
          const burst = w.burst ?? 1;
          u.burstLeft = burst - 1;
          u.burstT = w.burstGap ?? 0;
          u.phaseT = Math.max(w.recover, burst > 1 ? burst * (w.burstGap ?? 0.1) : 0);
        }
        wantMove = false;
      } else if (u.phase === 'recover') {
        u.phaseT -= DT;
        if (u.burstLeft > 0) {
          u.burstT -= DT;
          if (u.burstT <= 0) {
            if (this.targetValid(u, w)) this.fire(u, def, w);
            u.burstLeft--;
            u.burstT = w.burstGap ?? 0.1;
          }
        }
        if (u.phaseT <= 0) u.phase = 'idle';
      } else if (tp && inRange && u.cooldown <= 0) {
        u.phase = 'windup';
        u.phaseT = w.windup;
        u.cooldown = w.cycle;
        u.facing = Math.atan2(tp.y - u.y, tp.x - u.x);
        wantMove = false;
      }
      if (tp && inRange) u.facing = Math.atan2(tp.y - u.y, tp.x - u.x);
    }

    // ── velocity ──
    if (wantMove) {
      let dx = gx - u.x;
      let dy = gy - u.y;
      let d = Math.hypot(dx, dy);
      if (stopAt > 0 && tp) {
        // approach the target's edge, stopping at stopAt
        const need = d - (def.radius + tp.r + stopAt);
        if (need <= 0) { d = 0; }
        else { d = Math.min(d, need); }
      }
      if (d > 1.5) {
        const ux = dx / Math.hypot(dx, dy);
        const uy = dy / Math.hypot(dx, dy);
        const sp = Math.min(speed * cohesionSlow, d / DT);
        u.vx = ux * sp;
        u.vy = uy * sp;
        if (u.phase === 'idle' || u.phase === 'recover') u.facing = Math.atan2(uy, ux);
      } else {
        u.vx = 0; u.vy = 0;
      }
    } else {
      u.vx = 0; u.vy = 0;
    }

    // ── stuck detection: wanted to move but didn't ──
    if (wantMove && Math.abs(u.vx) + Math.abs(u.vy) > 1) {
      u.stuckT += DT;
      if (u.stuckT > 2) {
        const moved = Math.hypot(u.x - u.sx, u.y - u.sy);
        if (moved < 6) {
          u.jitterT = 0.6;
          u.jitterDir = this.rng.chance(0.5) ? 1 : -1;
          u.retargetT = 0;
        }
        u.stuckT = 0; u.sx = u.x; u.sy = u.y;
      }
    } else { u.stuckT = 0; u.sx = u.x; u.sy = u.y; }
    if (u.jitterT > 0) {
      u.jitterT -= DT;
      u.vy += u.jitterDir * speed * 0.9; // sidestep to unstick
    }
  }

  private objectiveF(team: Team): number {
    const enemy = (1 - team) as Team;
    const out = this.s.buildings.find((b) => b.team === enemy && b.kind === 'outpost')!;
    const core = this.coreOf(enemy);
    const b = out.alive ? out : core;
    return this.fwd(team, b.x) - b.r - 10;
  }

  private laneGoalY(u: Unit, team: Team, goalF: number): number {
    const myF = this.fwd(team, u.x);
    const dist = goalF - myF;
    let y = u.laneY;
    // past the centre line, drift toward the middle so lanes converge on the enemy base
    if (myF > MAP.W / 2) y += (MAP.coreY - y) * Math.min(1, (myF - MAP.W / 2) / 500) * 0.5;
    if (dist < 320) return MAP.coreY + (y - MAP.coreY) * Math.max(0, dist / 320);
    return y;
  }

  // ───────────────────────────── abilities ─────────────────────────────
  private doAbility(u: Unit, def: UnitDef) {
    const ab = def.ability;
    if (!ab || u.pool <= 0) return;
    const s = this.s;
    if (ab.kind === 'repair') {
      // nearest damaged mechanical ally in range with < stackCap repairers
      let best: Unit | null = null;
      let bestD = Infinity;
      this.hash.query(u.x, u.y, ab.range, (o, d2) => {
        if (o.team !== u.team || o.dead || o.id === u.id || o.hp >= o.maxHp) return;
        const od = unitDef(o.type);
        if (!od.armorTags.includes('mechanical')) return;
        if ((this.repairCount.get(o.id) ?? 0) >= (ab.stackCap ?? 1)) return;
        if (d2 < bestD) { bestD = d2; best = o; }
      });
      if (best) {
        const b = best as Unit;
        const amt = Math.min(ab.amount * u.supMult * DT, b.maxHp - b.hp, u.pool);
        b.hp += amt;
        u.pool -= amt;
        this.repairCount.set(b.id, (this.repairCount.get(b.id) ?? 0) + 1);
        this.stat(u.owner, u.type).healed += amt;
        if (s.tick % 10 === 0) this.emit({ kind: 'repair', x: u.x, y: u.y, tx: b.x, ty: b.y });
      }
    } else if (ab.kind === 'shield') {
      u.abilityT -= DT;
      if (u.abilityT > 0) return;
      u.abilityT = ab.interval ?? 5;
      const cands: Unit[] = [];
      this.hash.query(u.x, u.y, ab.range, (o) => {
        if (o.team !== u.team || o.dead || o.id === u.id || o.shield > 0) return;
        cands.push(o);
      });
      // prefer damaged / front units: sort by hp fraction
      cands.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      const amount = ab.amount * u.supMult;
      let n = 0;
      for (const o of cands) {
        if (n >= (ab.maxTargets ?? 4) || u.pool <= 0) break;
        const give = Math.min(amount, u.pool);
        o.shield = give;
        o.shieldUntil = s.t + (ab.duration ?? 7);
        u.pool -= give;
        this.stat(u.owner, u.type).shielded += give;
        this.emit({ kind: 'shieldOn', x: o.x, y: o.y });
        n++;
      }
    }
  }

  // ───────────────────────────── firing ─────────────────────────────
  private fire(u: Unit, def: UnitDef, w: WeaponDef) {
    const tp = this.targetPos(u.targetId);
    if (!tp) return;
    const s = this.s;
    const tid = u.targetId;
    const targetTags = tid > 0 ? unitDef(this.unitById.get(tid)!.type).armorTags : STRUCT_TAGS;
    u.facing = Math.atan2(tp.y - u.y, tp.x - u.x);
    switch (w.kind) {
      case 'hitscan': {
        const raw = rawDamage(w, u.atkMult, targetTags, tp.layer);
        this.queueDamage(tid, raw, u, tp.x, tp.y);
        this.emit({ kind: 'shot', x: u.x, y: u.y, tx: tp.x, ty: tp.y, unitType: u.type, team: u.team, targetLayer: tp.layer });
        break;
      }
      case 'projectile': {
        const d = Math.hypot(tp.x - u.x, tp.y - u.y);
        const speed = w.projSpeed ?? 500;
        s.projectiles.push({
          id: s.nextId++, kind: def.roles.includes('antiair') ? 'flak' : 'shell', team: u.team, owner: u.owner, ownerUnit: u.id,
          unitType: u.type, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: tp.x, ty: tp.y, targetId: tid, speed,
          t: 0, dur: d / speed, dmg: w.dmg, aoe: w.aoe ?? 0, atkMult: u.atkMult, dead: false,
        });
        this.emit({ kind: 'shot', x: u.x, y: u.y, tx: tp.x, ty: tp.y, unitType: u.type, team: u.team, targetLayer: tp.layer });
        break;
      }
      case 'arc':
      case 'bomb': {
        const speed = w.projSpeed ?? 300;
        const d = Math.hypot(tp.x - u.x, tp.y - u.y);
        const dur = w.kind === 'bomb' ? 0.45 : Math.max(0.35, d / speed);
        // lead the target by a fraction of its velocity
        const lead = w.kind === 'bomb' ? 0.3 : 0.55;
        const tx = tp.x + tp.vx * dur * lead;
        const ty = tp.y + tp.vy * dur * lead;
        s.projectiles.push({
          id: s.nextId++, kind: w.kind, team: u.team, owner: u.owner, ownerUnit: u.id, unitType: u.type,
          x: u.x, y: u.y, sx: u.x, sy: u.y, tx, ty, targetId: 0, speed, t: 0, dur, dmg: w.dmg, aoe: w.aoe ?? 40,
          atkMult: u.atkMult, dead: false,
        });
        this.emit({ kind: 'shot', x: u.x, y: u.y, tx, ty, unitType: u.type, team: u.team, targetLayer: 'ground' });
        break;
      }
      case 'cone': {
        const half = w.coneHalf ?? 0.6;
        const reach = w.range + def.radius + 14;
        this.hash.query(u.x, u.y, reach + 14, (o) => {
          if (o.team === u.team || o.dead || !canHitLayer(w, o.layer)) return;
          const ang = Math.atan2(o.y - u.y, o.x - u.x);
          let da = Math.abs(ang - u.facing);
          if (da > Math.PI) da = Math.PI * 2 - da;
          if (da > half) return;
          const raw = rawDamage(w, u.atkMult, unitDef(o.type).armorTags, o.layer);
          this.queueDamage(o.id, raw, u, o.x, o.y);
        });
        if (tid < 0) {
          const b = this.building(-tid)!;
          this.queueDamage(tid, rawDamage(w, u.atkMult, STRUCT_TAGS, 'ground'), u, b.x, b.y);
        }
        this.emit({ kind: 'shot', x: u.x, y: u.y, tx: tp.x, ty: tp.y, unitType: u.type, team: u.team, targetLayer: 'ground' });
        break;
      }
      case 'beam': {
        const raw = rawDamage(w, u.atkMult, targetTags, tp.layer);
        this.queueDamage(tid, raw, u, tp.x, tp.y);
        // pierce: units behind the primary target along the beam line
        const pierce = w.pierce ?? 0;
        if (pierce > 0) {
          const dx = tp.x - u.x, dy = tp.y - u.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = dx / len, ny = dy / len;
          const ex = u.x + nx * (len + 140), ey = u.y + ny * (len + 140);
          const extra: { o: Unit; along: number }[] = [];
          this.hash.query((u.x + ex) / 2, (u.y + ey) / 2, (len + 140) / 2 + 30, (o) => {
            if (o.team === u.team || o.dead || o.id === tid || !canHitLayer(w, o.layer)) return;
            const ox = o.x - u.x, oy = o.y - u.y;
            const along = ox * nx + oy * ny;
            const perp = Math.abs(ox * ny - oy * nx);
            if (along > len * 0.5 && along < len + 140 && perp < 16 + unitDef(o.type).radius) extra.push({ o, along });
          });
          extra.sort((a, b) => a.along - b.along);
          for (let i = 0; i < Math.min(pierce, extra.length); i++) {
            const o = extra[i].o;
            const r2 = rawDamage(w, u.atkMult, unitDef(o.type).armorTags, o.layer) * (w.pierceFrac ?? 0.5);
            this.queueDamage(o.id, r2, u, o.x, o.y);
          }
          this.emit({ kind: 'beam', x: u.x, y: u.y, tx: ex, ty: ey, team: u.team });
        } else {
          this.emit({ kind: 'beam', x: u.x, y: u.y, tx: tp.x, ty: tp.y, team: u.team });
        }
        break;
      }
    }
  }

  private queueDamage(targetId: number, raw: number, src: Unit | null, x: number, y: number, srcOwner = src ? src.owner : -1, srcType = src ? src.type : 'building') {
    this.damage.push({ targetId, amount: raw, srcOwner, srcType, x, y });
  }

  /** AoE by *actual* positions at impact time (both layers if weapon allows). */
  private splash(x: number, y: number, r: number, team: Team, owner: number, unitType: string, dmg: number, atkMult: number) {
    const w = unitDef(unitType).weapon!;
    this.hash.query(x, y, r + 16, (o, d2) => {
      if (o.team === team || o.dead || !canHitLayer(w, o.layer)) return;
      const od = unitDef(o.type);
      if (Math.sqrt(d2) > r + od.radius) return;
      const raw = rawDamage({ ...w, dmg }, atkMult, od.armorTags, o.layer);
      this.damage.push({ targetId: o.id, amount: raw, srcOwner: owner, srcType: unitType, x: o.x, y: o.y });
    });
    for (const b of this.s.buildings) {
      if (b.team === team || !b.alive || !this.buildingAttackable(b)) continue;
      if (Math.hypot(b.x - x, b.y - y) <= r + b.r) {
        const raw = rawDamage({ ...w, dmg }, atkMult, STRUCT_TAGS, 'ground');
        this.damage.push({ targetId: -b.id, amount: raw, srcOwner: owner, srcType: unitType, x: b.x, y: b.y });
      }
    }
    this.emit({ kind: 'explosion', x, y, r, power: dmg > 40 ? 1 : 0.5, team });
  }

  // ───────────────────────────── projectiles ─────────────────────────────
  private updateProjectiles() {
    const s = this.s;
    for (const p of s.projectiles) {
      if (p.dead) continue;
      p.t += DT;
      if (p.kind === 'arc' || p.kind === 'bomb') {
        const k = Math.min(1, p.t / p.dur);
        p.x = p.sx + (p.tx - p.sx) * k;
        p.y = p.sy + (p.ty - p.sy) * k;
        if (p.t >= p.dur) {
          this.splash(p.tx, p.ty, p.aoe, p.team, p.owner, p.unitType, p.dmg, p.atkMult);
          p.dead = true;
        }
      } else {
        // homing shell: follow target; fizzle if it is gone
        const tp = this.targetPos(p.targetId);
        if (!tp) { p.dead = true; continue; }
        p.tx = tp.x; p.ty = tp.y;
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        const stepLen = p.speed * DT;
        if (d <= stepLen + tp.r) {
          p.x = p.tx; p.y = p.ty;
          const w = unitDef(p.unitType).weapon!;
          const tags = p.targetId > 0 ? unitDef(this.unitById.get(p.targetId)!.type).armorTags : STRUCT_TAGS;
          const raw = rawDamage(w, p.atkMult, tags, tp.layer);
          this.damage.push({ targetId: p.targetId, amount: raw, srcOwner: p.owner, srcType: p.unitType, x: p.tx, y: p.ty });
          if (p.aoe > 0) this.splash(p.tx, p.ty, p.aoe, p.team, p.owner, p.unitType, p.dmg * 0.5, p.atkMult);
          p.dead = true;
        } else {
          p.x += (dx / d) * stepLen;
          p.y += (dy / d) * stepLen;
        }
      }
    }
    if (s.projectiles.length > 0 && s.tick % 5 === 0) s.projectiles = s.projectiles.filter((p) => !p.dead);
  }

  // ───────────────────────────── buildings ─────────────────────────────
  private updateBuilding(b: Building) {
    if (!b.alive) return;
    if (b.cooldown > 0) b.cooldown -= DT;
    const t = this.unitById.get(b.targetId);
    if (!t || t.dead || Math.hypot(t.x - b.x, t.y - b.y) - unitDef(t.type).radius > b.turret.range + 10) {
      b.targetId = 0;
      let best = 0, bd = Infinity;
      this.hash.query(b.x, b.y, b.turret.range + 20, (o, d2) => {
        if (o.team === b.team || o.dead) return;
        if (d2 < bd) { bd = d2; best = o.id; }
      });
      b.targetId = best;
    }
    const tt = this.unitById.get(b.targetId);
    if (tt && b.cooldown <= 0) {
      b.cooldown = b.turret.cycle;
      b.facing = Math.atan2(tt.y - b.y, tt.x - b.x);
      const raw = b.turret.dmg;
      this.damage.push({ targetId: tt.id, amount: raw, srcOwner: -1, srcType: b.kind, x: tt.x, y: tt.y });
      this.emit({ kind: 'shot', x: b.x, y: b.y, tx: tt.x, ty: tt.y, unitType: b.kind, team: b.team, targetLayer: tt.layer });
    }
  }

  // ───────────────────────────── cannon ─────────────────────────────
  private updateCannon() {
    const s = this.s;
    for (let team = 0; team < 2; team++) {
      const c = s.cannon[team];
      if (!c.pending || s.t < c.pending.at) continue;
      const { x, y } = c.pending;
      const cfg = MATCH.cannon;
      this.hash.query(x, y, cfg.radius + 16, (o, d2) => {
        if (o.team === team || o.dead) return;
        if (Math.sqrt(d2) > cfg.radius + unitDef(o.type).radius) return;
        this.damage.push({ targetId: o.id, amount: cfg.dmg, srcOwner: -1, srcType: 'cannon', x: o.x, y: o.y });
        o.slowUntil = s.t + cfg.slow.duration;
        o.slowFactor = cfg.slow.factor;
      });
      c.pending = null;
      c.used = true;
      this.emit({ kind: 'cannonFire', x, y, team: team as Team });
    }
  }

  // ───────────────────────────── damage application ─────────────────────────────
  private stat(owner: number, type: string) {
    if (owner < 0) return emptyTypeStats();
    const st = this.s.stats[owner].byType;
    return (st[type] ??= emptyTypeStats());
  }

  private applyDamage() {
    const s = this.s;
    for (const d of this.damage) {
      if (d.targetId > 0) {
        const u = this.unitById.get(d.targetId);
        if (!u || u.dead) continue;
        let eff = afterArmor(d.amount, u.armor);
        let shielded = false;
        if (u.shield > 0) {
          const absorb = Math.min(u.shield, eff);
          u.shield -= absorb;
          eff -= absorb;
          shielded = true;
        }
        u.hp -= eff;
        u.flash = 0.12;
        this.stat(d.srcOwner, d.srcType).dealt += eff;
        this.stat(u.owner, u.type).taken += eff;
        if (s.tick % 2 === 0 || eff > 30) this.emit({ kind: 'hit', x: u.x, y: u.y, amount: eff, targetId: u.id, shield: shielded });
        if (u.hp <= 0 && !u.dead) {
          u.dead = true;
          this.stat(d.srcOwner, d.srcType).kills += 1;
          this.stat(u.owner, u.type).deaths += 1;
          if (d.srcOwner >= 0 && ECON.killBountyPerPop > 0) s.players[d.srcOwner].credits += ECON.killBountyPerPop * unitDef(u.type).pop;
          this.emit({ kind: 'death', x: u.x, y: u.y, unitType: u.type, team: u.team, layer: u.layer });
        }
      } else {
        const b = this.building(-d.targetId);
        if (!b || !b.alive) continue;
        const eff = afterArmor(d.amount, b.armor) * s.overtimeMult;
        b.hp -= eff;
        if (d.srcOwner >= 0) {
          this.stat(d.srcOwner, d.srcType).dealt += eff;
          s.stats[d.srcOwner].buildingDamage += eff;
        }
        if (b.hp <= 0) {
          b.hp = 0;
          b.alive = false;
          this.emit({ kind: 'buildingDestroyed', x: b.x, y: b.y, team: b.team, building: b.kind });
        }
      }
    }
    this.damage.length = 0;
  }

  // ───────────────────────────── movement ─────────────────────────────
  private integrateMovement() {
    const s = this.s;
    for (const u of s.units) {
      if (u.dead) continue;
      u.x += u.vx * DT;
      u.y += u.vy * DT;
      u.anim += Math.hypot(u.vx, u.vy) * DT;
    }
    // separation (2 passes), same layer only
    this.hash.clear();
    for (const u of s.units) if (!u.dead) this.hash.insert(u);
    for (let pass = 0; pass < 2; pass++) {
      for (const u of s.units) {
        if (u.dead) continue;
        const ru = unitDef(u.type).radius;
        this.hash.query(u.x, u.y, ru + 20, (o, d2) => {
          if (o.id <= u.id || o.dead || o.layer !== u.layer) return;
          const ro = unitDef(o.type).radius;
          const minD = ru + ro;
          if (d2 >= minD * minD) return;
          let d = Math.sqrt(d2);
          let nx: number, ny: number;
          if (d < 0.01) {
            // exactly overlapping: deterministic split by id parity
            const a = ((u.id * 7 + o.id * 13) % 360) * (Math.PI / 180);
            nx = Math.cos(a); ny = Math.sin(a); d = 0.01;
          } else { nx = (o.x - u.x) / d; ny = (o.y - u.y) / d; }
          const overlap = (minD - d) * (u.team === o.team ? 0.5 : 0.7);
          u.x -= nx * overlap * 0.5; u.y -= ny * overlap * 0.5;
          o.x += nx * overlap * 0.5; o.y += ny * overlap * 0.5;
        });
      }
      // buildings push ground units out
      for (const u of s.units) {
        if (u.dead || u.layer !== 'ground') continue;
        const ru = unitDef(u.type).radius;
        for (const b of s.buildings) {
          if (!b.alive) continue;
          const dx = u.x - b.x, dy = u.y - b.y;
          const d = Math.hypot(dx, dy);
          const minD = b.r + ru;
          if (d < minD) {
            const nx = d < 0.01 ? 1 : dx / d, ny = d < 0.01 ? 0 : dy / d;
            u.x = b.x + nx * minD; u.y = b.y + ny * minD;
          }
        }
      }
    }
    for (const u of s.units) {
      const r = unitDef(u.type).radius;
      if (u.x < r) u.x = r;
      if (u.x > MAP.W - r) u.x = MAP.W - r;
      if (u.y < r) u.y = r;
      if (u.y > MAP.H - r) u.y = MAP.H - r;
    }
  }

  private removeDead() {
    const s = this.s;
    let any = false;
    for (const u of s.units) if (u.dead) { any = true; break; }
    if (any) {
      s.units = s.units.filter((u) => !u.dead);
      this.rebuildIndex();
    }
  }

  // ───────────────────────────── relay ─────────────────────────────
  private updateRelay() {
    const s = this.s;
    const r = s.relay;
    let a = 0, b = 0;
    this.hash.query(MAP.relayX, MAP.relayY, MAP.relayR, (o) => {
      if (o.layer !== 'ground') return;
      if (o.team === 0) a++; else b++;
    });
    r.presence = [a, b];
    r.contested = a > 0 && b > 0;
    const rate = DT / ECON.relayCaptureSeconds;
    if (a > 0 && b === 0) r.progress = Math.min(1, r.progress + rate);
    else if (b > 0 && a === 0) r.progress = Math.max(-1, r.progress - rate);
    const prev = r.owner;
    if (r.progress >= 1) r.owner = 0;
    else if (r.progress <= -1) r.owner = 1;
    else if (r.owner === 0 && r.progress <= 0) r.owner = -1;
    else if (r.owner === 1 && r.progress >= 0) r.owner = -1;
    if (prev !== r.owner) this.emit({ kind: 'relay', owner: r.owner });
  }

  private updateOvertime() {
    const s = this.s;
    if (s.t >= s.overtimeNext) {
      s.overtimeMult = Math.round((s.overtimeMult + MATCH.overtimeDmgStep) * 100) / 100;
      s.overtimeNext += MATCH.overtimeStep;
      this.emit({ kind: 'overtime', mult: s.overtimeMult });
    }
  }

  private checkVictory() {
    const s = this.s;
    const c0 = this.coreOf(0), c1 = this.coreOf(1);
    let result: MatchResult | null = null;
    if (!c0.alive && !c1.alive) result = { winner: -1, reason: 'draw-simul', t: s.t };
    else if (!c0.alive) result = { winner: 1, reason: 'core', t: s.t };
    else if (!c1.alive) result = { winner: 0, reason: 'core', t: s.t };
    else if (s.t >= MATCH.timeLimit) {
      const r0 = c0.hp / c0.maxHp, r1 = c1.hp / c1.maxHp;
      if (Math.abs(r0 - r1) < 1e-9) result = { winner: -1, reason: 'draw-time', t: s.t };
      else result = { winner: r0 > r1 ? 0 : 1, reason: 'time', t: s.t };
    }
    if (result) {
      s.result = result;
      s.phase = 'ended';
      this.emit({ kind: 'ended', result });
    }
  }

  // ───────────────────────────── serialization ─────────────────────────────
  serialize(): string {
    this.syncRng();
    return JSON.stringify(this.s);
  }
  static restore(json: string): Match | null {
    try {
      const st = JSON.parse(json) as MatchState;
      if (!st || st.version !== SAVE_VERSION || !Array.isArray(st.players) || !Array.isArray(st.units)) return null;
      for (const p of st.players) if (!FACTIONS[p.faction]) return null;
      return new Match(st);
    } catch {
      return null;
    }
  }

  /** Units on the field by type for one player (for UI). */
  fieldCounts(owner: number): Record<string, number> {
    const c: Record<string, number> = {};
    for (const u of this.s.units) if (u.owner === owner) c[u.type] = (c[u.type] ?? 0) + 1;
    return c;
  }
}
