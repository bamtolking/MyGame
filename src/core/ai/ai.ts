/**
 * Commander AI. Uses only information a human has: own state, the enemy's
 * *dispatched* waves (same as the 상대 정보 panel), and units on the field.
 * Acts through the same validated commands, with the same credits.
 */
import { unitDef, FACTIONS } from '../data/units.ts';
import { ROSTER, MAP, ECON, DT, MATCH } from '../data/balance.ts';
import { econCost, techCost, rosterPop, buyBlockReason, type Command } from '../sim/commands.ts';
import type { Player, Unit } from '../sim/state.ts';
import type { UnitDef, Team } from '../types.ts';
import type { Match } from '../sim/match.ts';

interface AiMem {
  clock: number;
  nextThink: number;
  scriptStep: number;
  lastEconAt: number;
  plan: string;
  saveFor: string | null;
}

interface Threat {
  air: number;
  armored: number;
  lightCount: number;
  lightValue: number;
  lightMelee: number; // count of light melee units (swarm that cone AoE handles)
  lightRanged: number; // value of light ranged units (needs ranged AoE / artillery)
  aoe: number;
  artillery: number;
  flank: number;
  antiair: number;
  antiarmor: number;
  total: number;
}

const LEVEL = {
  easy: { think: 12, budget: 0.5, econCap: 2, econUntil: 420, t2At: 240, t3At: 600, counters: 0.3, upgrades: false },
  normal: { think: 6, budget: 0.7, econCap: 3, econUntil: 300, t2At: 110, t3At: 360, counters: 0.8, upgrades: true },
  hard: { think: 4, budget: 0.6, econCap: 5, econUntil: 330, t2At: 70, t3At: 260, counters: 1.0, upgrades: true },
};

function emptyThreat(): Threat {
  return { air: 0, armored: 0, lightCount: 0, lightValue: 0, lightMelee: 0, lightRanged: 0, aoe: 0, artillery: 0, flank: 0, antiair: 0, antiarmor: 0, total: 0 };
}

function addUnitToThreat(t: Threat, d: UnitDef, n: number) {
  const v = d.cost * n;
  t.total += v;
  if (d.layer === 'air') t.air += v;
  if (d.armorTags.includes('armored')) t.armored += v;
  if (d.armorTags.includes('light')) { t.lightCount += n; t.lightValue += v; if (d.weapon && d.weapon.range <= 40) t.lightMelee += n; else if (d.weapon && d.layer === 'ground') t.lightRanged += v; }
  if (d.roles.includes('aoe')) t.aoe += v;
  if (d.roles.includes('artillery')) t.artillery += v;
  if (d.roles.includes('flanker')) t.flank += v;
  if (d.roles.includes('antiair')) t.antiair += v;
  else if (d.weapon && d.weapon.targets === 'both') t.antiair += v * 0.45;
  if (d.roles.includes('antiarmor')) t.antiarmor += v;
}

/** Threat from the last N dispatched waves of the enemy team (public info). */
export function enemyThreat(m: Match, team: Team, waves = 2): Threat {
  const t = emptyThreat();
  for (const p of m.s.players) {
    if (p.team === team) continue;
    const ws = p.waves.slice(-waves);
    const last = ws[ws.length - 1];
    if (!last) continue;
    // use the latest wave as the composition (waves repeat)
    for (const [id, n] of Object.entries(last.counts)) addUnitToThreat(t, unitDef(id), n);
  }
  return t;
}

export function rosterThreat(p: Player): Threat {
  const t = emptyThreat();
  for (const e of p.roster) if (e) addUnitToThreat(t, unitDef(e.unitId), 1);
  return t;
}

function teamRosterThreat(m: Match, team: Team): Threat {
  const t = emptyThreat();
  for (const p of m.s.players) if (p.team === team) for (const e of p.roster) if (e) addUnitToThreat(t, unitDef(e.unitId), 1);
  return t;
}

/** where is the fight? >0 means enemy has pushed onto our side (fraction of half map) */
function pressure(m: Match, team: Team): number {
  let enemyDeep = 0;
  let n = 0;
  for (const u of m.s.units) {
    if (u.team === team || u.layer !== 'ground') continue;
    const f = m.fwd(u.team, u.x); // how far the enemy unit advanced
    if (f > MAP.W / 2) { enemyDeep += (f - MAP.W / 2) / (MAP.W / 2); n++; }
  }
  return n === 0 ? 0 : enemyDeep / n + Math.min(0.5, n / 20);
}

function tankShare(p: Player): number {
  let tank = 0, total = 0;
  for (const e of p.roster) {
    if (!e) continue;
    const d = unitDef(e.unitId);
    total += d.pop;
    if (d.roles.includes('tank')) tank += d.pop;
  }
  return total === 0 ? 0 : tank / total;
}

type Need = 'antiair' | 'aoe' | 'antiarmor' | 'tank' | 'rearguard' | 'fill' | 'air' | 'support' | 'artillery' | 'ranged';

function pickUnitForNeed(p: Player, need: Need, rng: () => number): string | null {
  const f = FACTIONS[p.faction];
  const cands = f.units.map(unitDef).filter((d) => d.tier <= p.tech && p.credits >= d.cost);
  const by = (pred: (d: UnitDef) => boolean) => cands.filter(pred);
  let pool: UnitDef[] = [];
  switch (need) {
    case 'antiair': pool = by((d) => d.roles.includes('antiair')); if (!pool.length) pool = by((d) => !!d.weapon && d.weapon.targets === 'both' && d.layer === 'ground'); break;
    case 'aoe': pool = by((d) => d.roles.includes('aoe') && d.layer === 'ground'); break;
    case 'antiarmor': pool = by((d) => d.roles.includes('antiarmor')); break;
    case 'tank': pool = by((d) => d.roles.includes('tank')); break;
    case 'rearguard': pool = by((d) => (d.roles.includes('tank') || d.roles.includes('aoe')) && d.layer === 'ground'); break;
    case 'air': pool = by((d) => d.layer === 'air' && !d.roles.includes('antiair')); break;
    case 'support': pool = by((d) => d.roles.includes('support')); break;
    case 'artillery': pool = by((d) => d.roles.includes('artillery')); break;
    case 'ranged': pool = by((d) => d.behavior === 'ranged' && d.layer === 'ground' && d.tier === 1); break;
    case 'fill': {
      // weighted core composition per faction
      const w: Record<string, number> = p.faction === 'iron'
        ? { shieldwalker: 3, rifles: 4, sprayer: 1.5, flak: 0.6, piercer: 1.5, howitzer: 1.2, repair: 0.8, gunship: 0.8 }
        : { raiders: 3.5, glider: 4, thrower: 1.5, interceptor: 0.6, infiltrator: 1.2, shieldskiff: 0.8, bomber: 1.0, railgun: 0.8 };
      let sum = 0;
      for (const d of cands) sum += w[d.id] ?? 1;
      let r = rng() * sum;
      for (const d of cands) { r -= w[d.id] ?? 1; if (r <= 0) return d.id; }
      return cands.length ? cands[cands.length - 1].id : null;
    }
  }
  if (!pool.length) return null;
  // prefer the most expensive affordable (higher tier = better specialist), with a bit of randomness
  pool.sort((a, b) => b.cost - a.cost);
  return rng() < 0.7 ? pool[0].id : pool[Math.floor(rng() * pool.length)].id;
}

/** Pick a roster cell for a unit according to its role. Returns -1 if none. */
export function chooseCell(p: Player, d: UnitDef, spread: boolean, rng: () => number, random = false): number {
  const cols = ROSTER.cols, rows = ROSTER.rows;
  const free = (c: number, r: number) => !p.roster[r * cols + c];
  if (random) {
    const empties: number[] = [];
    for (let i = 0; i < p.roster.length; i++) if (!p.roster[i]) empties.push(i);
    return empties.length ? empties[Math.floor(rng() * empties.length)] : -1;
  }
  let colPref: number[];
  const b = d.behavior;
  if (b === 'flank') colPref = [7, 6, 5];
  else if (b === 'artillery') colPref = [0, 1, 2];
  else if (b === 'support') colPref = [2, 3, 1];
  else if (d.layer === 'air') colPref = [3, 2, 4, 1];
  else if (d.roles.includes('antiair')) colPref = [4, 3, 5, 2];
  else if (b === 'assault') colPref = [7, 6, 5, 4];
  else colPref = [5, 4, 6, 3, 2];
  // rows: concentrate near centre or spread outward
  const centre = [2, 3, 1, 4, 0, 5];
  const wide = [0, 5, 2, 3, 1, 4];
  let rowPref = spread ? wide : centre;
  if (b === 'flank') rowPref = rng() < 0.5 ? [0, 1, 5, 4, 2, 3] : [5, 4, 0, 1, 3, 2];
  for (const c of colPref) for (const r of rowPref) if (free(c, r)) return r * cols + c;
  for (let i = 0; i < p.roster.length; i++) if (!p.roster[i]) return i;
  return -1;
}

function rearGuardNeeded(p: Player): boolean {
  // any tank/aoe/melee unit in the back two columns of the edge rows?
  const cols = ROSTER.cols;
  for (const r of [0, 1, 4, 5]) for (const c of [0, 1, 2]) {
    const e = p.roster[r * cols + c];
    if (e) {
      const d = unitDef(e.unitId);
      if (d.roles.includes('tank') || d.roles.includes('aoe')) return false;
    }
  }
  return true;
}

export function runAi(m: Match, p: Player) {
  const s = m.s;
  const mem = p.aiState as unknown as AiMem;
  if (mem.clock === undefined) { mem.clock = 0; mem.nextThink = 0.5 + p.slot * 0.7; mem.scriptStep = 0; mem.lastEconAt = -999; mem.plan = ''; mem.saveFor = null; }
  mem.clock += DT;
  if (mem.clock < mem.nextThink) return;
  const rng = () => m.rng.next();
  const level = p.ai;
  if (level === 'script') return;
  if (level === 'tutorial') { runTutorialScript(m, p, mem); mem.nextThink = mem.clock + 1; return; }
  const L = LEVEL[level as 'easy' | 'normal' | 'hard'];
  mem.nextThink = mem.clock + L.think * (0.85 + rng() * 0.3);
  const t = s.phase === 'battle' ? s.t : 0;
  const cmd = (c: Command) => m.command(c).ok;

  // ── information (public) ──
  const enemy = enemyThreat(m, p.team, 2);
  const own = s.mode === '3v3' && level === 'hard' ? teamRosterThreat(m, p.team) : rosterThreat(p);
  const press = s.phase === 'battle' ? pressure(m, p.team) : 0;
  const teamSize = s.mode === '3v3' ? 3 : 1;
  const request = p.request && t - p.requestAt < 75 ? p.request : null;
  if (p.request && t - p.requestAt >= 75) p.request = null;

  // ── cannon (team's decision: slot 0 of an all-AI team) ──
  if (s.phase === 'battle' && p.slot === 0 && !s.players.some((q) => q.team === p.team && q.isHuman)) considerCannon(m, p);

  // ── economy / tech decisions (with a savings reserve so goals are reachable) ──
  const econLimit = request === 'economy' ? Math.min(p.econLevel, L.econCap) : L.econCap + (p.slot === 2 ? 1 : 0);
  const winning = press <= 0 && t > 60 && enemy.total < own.total * 0.8;
  const canEcon = t < L.econUntil && p.econLevel < econLimit && press < 0.15 && (level !== 'easy' || t > 120);
  const needAntiArmorTech = enemy.armored > 250 && p.tech < 2;
  const tc = techCost(p.tech);
  const wantT2 = p.tech === 1 && (t >= L.t2At || needAntiArmorTech);
  const wantT3 = p.tech === 2 && t >= L.t3At && rosterPop(p) >= 16;
  let reserve = 0;
  if (tc !== null && (wantT2 || wantT3)) reserve = tc;
  else if (canEcon) reserve = econCost(p.econLevel);
  else if (winning && level === 'hard' && p.econLevel < ECON.econMaxLevel && t < 480) reserve = econCost(p.econLevel);
  // save up for one expensive higher-tier unit once the roster has a base (otherwise T2/T3 units never get bought)
  if (level !== 'easy' && s.phase === 'battle' && p.tech >= 2 && rosterPop(p) >= 16 && reserve === 0 && !mem.saveFor && rng() < 0.5) {
    const cands = FACTIONS[p.faction].units.map(unitDef).filter((d) => d.tier >= 2 && d.tier <= p.tech && d.cost >= 150 && rosterPop(p) + d.pop <= ROSTER.popCap);
    if (cands.length) mem.saveFor = cands[Math.floor(rng() * cands.length)].id;
  }
  if (mem.saveFor) {
    const d = unitDef(mem.saveFor);
    if (rosterPop(p) + d.pop > ROSTER.popCap || press > 0.35) mem.saveFor = null;
    else if (p.credits >= d.cost) {
      const cell = chooseCell(p, d, enemy.aoe > 200, rng);
      if (cell >= 0) cmd({ type: 'buy', player: p.index, unitId: mem.saveFor, cell });
      mem.saveFor = null;
    } else reserve = Math.max(reserve, d.cost);
  }
  if (press > 0.3) reserve = 0;

  if (tc !== null && (wantT2 || wantT3) && p.credits >= tc) { if (cmd({ type: 'tech', player: p.index })) reserve = 0; }
  else if (canEcon && p.credits >= econCost(p.econLevel)) {
    if (level !== 'easy' || rng() < 0.5) { if (cmd({ type: 'econ', player: p.index })) { mem.lastEconAt = t; reserve = 0; } }
  } else if (winning && level === 'hard' && p.econLevel < ECON.econMaxLevel && t < 480 && p.credits >= econCost(p.econLevel)) {
    if (cmd({ type: 'econ', player: p.index })) reserve = 0;
  }
  if (L.upgrades && p.tech >= 2 && t > 150 && p.credits > 450 + reserve && rosterPop(p) >= 18) {
    const k = p.upgrades.attack <= p.upgrades.defense ? 'attack' : 'defense';
    if (p.upgrades[k] < ECON.upgradeMax && rng() < 0.5) cmd({ type: 'upgrade', player: p.index, kind: k });
  }

  // ── unit purchases (gradual: budget fraction per think, respecting the reserve) ──
  let budget = Math.max(0, p.credits - reserve) * L.budget;
  if (s.phase === 'setup') budget = p.credits; // spend freely before the first wave
  if (press > 0.3) budget = p.credits;
  const spread = enemy.aoe > 200 && level !== 'easy';
  const needs: Need[] = [];
  const react = level === 'easy' ? rng() < L.counters : true;
  const teamAAmul = s.mode === '3v3' && p.slot === 1 ? 1.4 : 1;
  if (request === 'antiair') needs.push('antiair');
  if (request === 'frontline') needs.push('tank');
  if (react) {
    if (enemy.air > 0 && own.antiair < enemy.air * 0.7 * teamAAmul) needs.push('antiair');
    if (enemy.lightMelee >= 5 && own.aoe < enemy.lightValue * 0.45) needs.push('aoe');
    if (enemy.lightRanged >= 400 && own.artillery < enemy.lightRanged * 0.35) needs.push(p.tech >= 2 ? 'artillery' : 'ranged');
    if (enemy.armored > 200 && own.antiarmor < enemy.armored * 0.5) needs.push('antiarmor');
    if (enemy.flank > 0 && rearGuardNeeded(p) && level !== 'easy') needs.push('rearguard');
  }
  const tankTarget = (s.mode === '3v3' && p.slot === 0 ? 0.42 : 0.3) * (p.faction === 'iron' ? 0.75 : 1);
  if (tankShare(p) < tankTarget) needs.push('tank');
  if (level === 'hard') {
    if (enemy.antiair < 150 && p.tech >= 2 && t > 180 && own.air < 400 && rng() < 0.5) needs.push('air');
    if (own.total > 600 && own.artillery + own.antiarmor < 200 && p.tech >= 2) needs.push(p.slot === 2 || teamSize === 1 ? 'artillery' : 'antiarmor');
    if (own.total > 900 && p.tech >= 2 && rng() < 0.35) needs.push('support');
  }
  needs.push('fill');

  let guard = 0;
  let spent = 0;
  const popNow = rosterPop(p);
  while (guard++ < 12 && spent < budget) {
    const need = needs.length ? needs.shift()! : 'fill';
    const id = pickUnitForNeed(p, need, rng);
    if (!id) { if (need === 'fill') break; continue; }
    const d = unitDef(id);
    if (spent + d.cost > budget) { if (need === 'fill') break; continue; }
    // avoid mono-composition: no type above 40% of roster pop once the roster is big (not for easy)
    if (level !== 'easy' && popNow + spent / 60 > 12) {
      let typePop = 0;
      for (const e of p.roster) if (e && e.unitId === id) typePop += d.pop;
      if ((typePop + d.pop) / Math.max(1, rosterPop(p) + d.pop) > 0.4) { if (need === 'fill') { if (guard > 6) break; continue; } continue; }
    }
    if (buyBlockReason(p, id)) { if (need === 'fill') break; continue; }
    let cell = chooseCell(p, d, spread, rng, level === 'easy' && rng() < 0.5);
    if (need === 'rearguard') {
      const cols = ROSTER.cols;
      cell = -1;
      for (const r of [0, 5, 1, 4]) for (const c of [1, 0, 2]) if (!p.roster[r * cols + c] && cell < 0) cell = r * cols + c;
    }
    if (cell < 0) break;
    if (cmd({ type: 'buy', player: p.index, unitId: id, cell })) spent += d.cost;
    else break;
    if (need !== 'fill' && needs.length === 0) needs.push('fill');
  }
  // ── composition upgrade: when near the pop cap with spare credits, sell the cheapest
  //    low-tier units (70% refund, same rule as the human) to fit one higher-tier unit ──
  if (level !== 'easy' && p.tech >= 2 && rosterPop(p) >= ROSTER.popCap - 4 && p.credits > 250 && s.phase === 'battle' && press < 0.3) {
    const highTier = FACTIONS[p.faction].units.map(unitDef).filter((d) => d.tier === p.tech);
    const pick = highTier.length ? highTier[Math.floor(rng() * highTier.length)] : null;
    if (pick) {
      // candidate sells: dispatched, lower tier, cheapest first
      const sells: number[] = [];
      for (let i = 0; i < p.roster.length; i++) { const e = p.roster[i]; if (e && e.dispatched && unitDef(e.unitId).tier < p.tech) sells.push(i); }
      sells.sort((a, b) => unitDef(p.roster[a]!.unitId).cost - unitDef(p.roster[b]!.unitId).cost);
      let pop = rosterPop(p), credits = p.credits;
      const chosen: number[] = [];
      for (const i of sells) {
        if (pop + pick.pop <= ROSTER.popCap && credits >= pick.cost) break;
        const d = unitDef(p.roster[i]!.unitId);
        chosen.push(i); pop -= d.pop; credits += Math.floor(d.cost * ECON.sellRefund);
        if (chosen.length >= 4) break;
      }
      if (pop + pick.pop <= ROSTER.popCap && credits >= pick.cost) {
        for (const i of chosen) cmd({ type: 'sell', player: p.index, cell: i });
        const cell = chooseCell(p, pick, spread, rng);
        if (cell >= 0) cmd({ type: 'buy', player: p.index, unitId: pick.id, cell });
      }
    }
  }
  mem.plan = needs.join(',');
}

function considerCannon(m: Match, p: Player) {
  const s = m.s;
  const c = s.cannon[p.team];
  if (c.used || c.pending) return;
  const inZone: Unit[] = [];
  for (const u of s.units) {
    if (u.team === p.team) continue;
    if (m.fwd(p.team, u.x) <= MAP.cannonZoneX && m.fwd(p.team, u.x) > MAP.cannonZoneX - 420) inZone.push(u);
  }
  if (inZone.length < 6) return;
  let cx = 0, cy = 0;
  for (const u of inZone) { cx += u.x; cy += u.y; }
  cx /= inZone.length; cy /= inZone.length;
  let near = 0, value = 0;
  for (const u of inZone) if (Math.hypot(u.x - cx, u.y - cy) <= MATCH.cannon.radius) { near++; value += unitDef(u.type).cost; }
  if (near >= 5 && value >= 450 && m.cannonZoneOk(p.team, cx, cy)) m.command({ type: 'cannon', player: p.index, x: cx, y: cy });
}

/** Scripted tutorial opponent: predictable, teaches counter-picking. Same credits. */
function runTutorialScript(m: Match, p: Player, mem: AiMem) {
  const s = m.s;
  const t = s.phase === 'battle' ? s.t : -1;
  const cmd = (c: Command) => m.command(c).ok;
  const buy = (id: string, cell: number) => cmd({ type: 'buy', player: p.index, unitId: id, cell });
  const steps: { at: number; run: () => void }[] = [
    { at: -1, run: () => { buy('raiders', 2 * 8 + 7); buy('raiders', 3 * 8 + 7); buy('raiders', 1 * 8 + 7); } },
    { at: 24, run: () => { buy('raiders', 4 * 8 + 7); buy('raiders', 2 * 8 + 6); } },
    { at: 49, run: () => { cmd({ type: 'tech', player: p.index }); } },
    { at: 74, run: () => { buy('glider', 2 * 8 + 5); } },
    { at: 124, run: () => { buy('bomber', 2 * 8 + 3); } },
    { at: 149, run: () => { buy('raiders', 3 * 8 + 6); } },
    { at: 174, run: () => { buy('bomber', 3 * 8 + 3); } },
    { at: 199, run: () => { p.ai = 'normal'; } },
  ];
  while (mem.scriptStep < steps.length && t >= steps[mem.scriptStep].at) {
    steps[mem.scriptStep].run();
    mem.scriptStep++;
  }
}
