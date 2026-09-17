// 시뮬레이션 본체: 라운드 진행, 몬스터 생성/이동, 유닛 공격, 탈락/승리 판정. DOM 없음, 결정적.
import type { GameState, Monster, Unit, SimEvent } from './types.ts';
import { pathPos, slotPos, PATH_LEN, MONSTER_CAP, FIELD_W, FIELD_H } from '../data/board.ts';
import { ROUND_TIME, TOTAL_ROUNDS, BOSS_TIME, roundIncome, killGold } from '../data/economy.ts';
import { roundPlan, isBossRound, BOSS_NAMES } from '../data/monsters.ts';
import { ELEMENT_DEFS, MYTHICS, isMythic, type Element, type MythicId } from '../data/units.ts';
import { statsOf, pushLog, aliveMonsters, isAlive } from './state.ts';
import * as roster from './roster.ts';

export const DT = 1 / 30;

/** 라운드 n 시작. 이전 라운드가 있으면 보상 지급. 멀티에서는 호스트 신호로, 솔로에서는 타이머로 호출. */
export function startRound(s: GameState, n: number): void {
  if (!isAlive(s)) return;
  if (n <= s.round || n > TOTAL_ROUNDS) return; // 중복/역행 신호 무시
  if (s.round >= 1 && n > s.round) endRound(s);
  if (s.phase === 'countdown') { s.phase = 'playing'; s.countdownT = 0; }
  s.round = n; s.roundT = 0; s.roundStartedAt = s.time;
  s.stats.roundReached = Math.max(s.stats.roundReached, n);
  for (const p of roundPlan(n)) s.spawnQueue.push({ ...p, round: n });
  s.spawnQueue.sort((a, b) => a.at - b.at);
  const boss = isBossRound(n);
  s.events.push({ t: 'round', n, boss });
  if (boss) pushLog(s, `보스 라운드 ${n}: ${BOSS_NAMES[n] ?? '보스'} — ${BOSS_TIME}초 안에 처치하지 못하면 탈락!`, 'warn');
  else pushLog(s, `라운드 ${n} 시작`, 'info');
}

function endRound(s: GameState): void {
  const inc = roundIncome(s.round);
  s.gold += inc; s.stats.goldEarned += inc;
  s.events.push({ t: 'gold', amount: inc, x: FIELD_W / 2, y: FIELD_H / 2 });
}

export function eliminate(s: GameState, reason: string): void {
  if (!isAlive(s)) return;
  s.phase = 'eliminated'; s.eliminatedReason = reason; s.eliminatedRound = s.round;
  s.monsters = []; s.spawnQueue = []; s.bossId = null; s.bossDeadline = null;
  s.events.push({ t: 'eliminated', reason });
  pushLog(s, `탈락: ${reason}`, 'bad');
}

export function win(s: GameState): void {
  if (!isAlive(s)) return;
  endRound(s);
  s.phase = 'won'; s.monsters = []; s.spawnQueue = []; s.bossId = null; s.bossDeadline = null;
  s.events.push({ t: 'won' });
  pushLog(s, `${TOTAL_ROUNDS}라운드 방어 성공!`, 'good');
}

/** 멀티: 호스트가 게임 종료를 알렸을 때. 살아 있으면 승리. */
export function finish(s: GameState): void { if (isAlive(s)) win(s); }

export function spawnMonster(s: GameState, sp: { type: Monster['type']; hp: number; speed: number; boss: boolean; round: number }): Monster {
  const p = pathPos(0);
  const m: Monster = { id: s.nextId++, type: sp.type, boss: sp.boss, round: sp.round, hp: sp.hp, maxHp: sp.hp, dist: 0, laps: 0, speed: sp.speed, x: p.x, y: p.y,
    slowAmt: 0, slowT: 0, stunT: 0, stunImmT: 0, auraSlow: 0, alive: true };
  s.monsters.push(m);
  if (sp.boss) { s.bossId = m.id; s.bossDeadline = s.time + BOSS_TIME; s.bossRound = sp.round; }
  return m;
}

export function applySlow(m: Monster, amt: number, dur: number): void {
  if (m.boss) amt = Math.min(amt, 0.3);
  if (amt >= m.slowAmt || m.slowT <= 0) { m.slowAmt = amt; m.slowT = dur; }
}
export function applyStun(m: Monster, dur: number, bossMul: number, imm: number): void {
  if (m.stunImmT > 0) return;
  if (m.boss) dur *= bossMul;
  m.stunT = Math.max(m.stunT, dur); m.stunImmT = imm + dur;
}
export function dealDamage(s: GameState, m: Monster, dmg: number, u: Unit): boolean {
  if (!m.alive) return false;
  m.hp -= dmg; u.dmg += dmg; s.stats.damage += dmg;
  if (m.hp <= 0) { killMonster(s, m, u); return true; }
  return false;
}
function killMonster(s: GameState, m: Monster, u: Unit): void {
  m.alive = false; u.kills++; s.stats.kills++;
  const g = killGold(m.round, m.boss);
  s.gold += g; s.stats.goldEarned += g;
  s.events.push({ t: 'die', x: m.x, y: m.y, boss: m.boss, gold: g });
  if (m.boss) {
    s.stats.bossKills++;
    if (s.bossId === m.id) { s.bossId = null; s.bossDeadline = null; }
    pushLog(s, `보스 처치! +${g} 골드`, 'good');
    if (m.round >= TOTAL_ROUNDS && s.mode === 'solo') win(s);
  }
}

function progress(m: Monster): number { return m.laps * PATH_LEN + m.dist; }

/** 사거리 안에서 가장 오래 돈(진행도 최대) 몬스터 */
function pickTarget(s: GameState, ux: number, uy: number, range: number): Monster | null {
  let best: Monster | null = null; let bp = -1; const r2 = range * range;
  for (const m of s.monsters) {
    if (!m.alive) continue;
    const dx = m.x - ux, dy = m.y - uy; if (dx * dx + dy * dy > r2) continue;
    const p = progress(m); if (p > bp) { bp = p; best = m; }
  }
  return best;
}
function nearMonsters(s: GameState, x: number, y: number, r: number, except: Monster | null): Monster[] {
  const out: Monster[] = []; const r2 = r * r;
  for (const m of s.monsters) { if (!m.alive || m === except) continue; const dx = m.x - x, dy = m.y - y; if (dx * dx + dy * dy <= r2) out.push(m); }
  return out;
}

function attack(s: GameState, u: Unit, m: Monster): void {
  const st = statsOf(s, u); const p = slotPos(u.slot);
  const ev: SimEvent = { t: 'shot', from: u.id, x1: p.x, y1: p.y, x2: m.x, y2: m.y, kind: u.kind, grade: u.grade, kill: false };
  u.lastShot = s.time;
  if (isMythic(u.kind)) {
    const d = MYTHICS[u.kind as MythicId];
    let dmg = st.dmg;
    if (d.bossMul && m.boss) dmg *= d.bossMul;
    if (d.slowedMul && (m.slowT > 0 || m.auraSlow > 0)) dmg *= d.slowedMul;
    const tx = m.x, ty = m.y;
    ev.kill = dealDamage(s, m, dmg, u);
    if (d.splash) for (const o of nearMonsters(s, tx, ty, d.splash.r, m)) dealDamage(s, o, dmg * d.splash.ratio, u);
    if (d.stun) { applyStun(m, d.stun.dur, d.stun.bossMul, d.stun.imm); if (d.splash) for (const o of nearMonsters(s, tx, ty, d.splash.r, m)) applyStun(o, d.stun.dur, d.stun.bossMul, d.stun.imm); }
    if (d.slow) applySlow(m, d.slow.amt, d.slow.dur);
    if (d.chain) chain(s, u, m, dmg, d.chain.n, d.chain.ratio, d.chain.r, ev, d.slowedMul);
    s.events.push(ev); return;
  }
  const d = ELEMENT_DEFS[u.kind as Element]; const g = u.grade as 0 | 1 | 2 | 3;
  const tx = m.x, ty = m.y;
  ev.kill = dealDamage(s, m, st.dmg, u);
  if (d.splash) { const r = d.splash.r + d.splash.rPer * g; for (const o of nearMonsters(s, tx, ty, r, m)) dealDamage(s, o, st.dmg * d.splash.ratio, u); }
  if (d.slow) applySlow(m, Math.min(d.slow.cap, d.slow.amt + d.slow.amtPer * g), d.slow.dur);
  if (d.stun) applyStun(m, d.stun.dur + d.stun.durPer * g, d.stun.bossMul, d.stun.imm);
  if (d.chain) chain(s, u, m, st.dmg, d.chain.n + d.chain.nPer * g, d.chain.ratio, d.chain.r, ev);
  s.events.push(ev);
}
function chain(s: GameState, u: Unit, first: Monster, dmg: number, n: number, ratio: number, r: number, ev: SimEvent & { t: 'shot' }, slowedMul?: number): void {
  const hit = new Set<Monster>([first]); let cur = first; let d = dmg; ev.targets = [];
  for (let i = 0; i < n; i++) {
    d *= ratio;
    let next: Monster | null = null; let bd = Infinity;
    for (const o of s.monsters) { if (!o.alive || hit.has(o)) continue; const dx = o.x - cur.x, dy = o.y - cur.y; const dd = dx * dx + dy * dy; if (dd <= r * r && dd < bd) { bd = dd; next = o; } }
    if (!next) break;
    hit.add(next); ev.targets.push({ x: next.x, y: next.y });
    let dd = d; if (slowedMul && (next.slowT > 0 || next.auraSlow > 0)) dd *= slowedMul;
    dealDamage(s, next, dd, u); cur = next;
  }
}

function updateUnits(s: GameState, dt: number): void {
  // 눈보라 여왕 오라: 매 스텝 재계산
  for (const m of s.monsters) m.auraSlow = 0;
  for (const u of s.units) if (u.kind === 'queen') { const a = MYTHICS.queen.aura!; const p = slotPos(u.slot); for (const m of nearMonsters(s, p.x, p.y, a.r, null)) m.auraSlow = Math.max(m.auraSlow, m.boss ? Math.min(a.slow, 0.3) : a.slow); }
  for (const u of s.units) {
    u.cd -= dt; if (u.cd > 0) continue;
    const st = statsOf(s, u); const p = slotPos(u.slot);
    const m = pickTarget(s, p.x, p.y, st.range);
    if (!m) { u.cd = 0.05; continue; }
    attack(s, u, m); u.cd += st.period; if (u.cd < 0) u.cd = st.period * 0.5;
  }
}

function updateMonsters(s: GameState, dt: number): void {
  for (const m of s.monsters) {
    if (!m.alive) continue;
    if (m.stunImmT > 0) m.stunImmT -= dt;
    if (m.stunT > 0) { m.stunT -= dt; continue; }
    let slow = 0;
    if (m.slowT > 0) { m.slowT -= dt; slow = m.slowAmt; } else m.slowAmt = 0;
    slow = Math.max(slow, m.auraSlow);
    m.dist += m.speed * (1 - slow) * dt;
    if (m.dist >= PATH_LEN) { m.dist -= PATH_LEN; m.laps++; }
    const p = pathPos(m.dist); m.x = p.x; m.y = p.y;
  }
  if (s.monsters.some(m => !m.alive)) s.monsters = s.monsters.filter(m => m.alive);
}

/** 고정 시간 스텝 한 번 진행 */
export function step(s: GameState, dt = DT): void {
  if (s.phase === 'eliminated' || s.phase === 'won') return;
  if (s.phase === 'countdown') {
    s.countdownT -= dt;
    for (const u of s.units) if (u.cd > 0) u.cd = Math.max(0, u.cd - dt);
    if (s.countdownT <= 0 && s.mode === 'solo') startRound(s, 1);
    return;
  }
  s.time += dt; s.roundT += dt; s.stats.playTime += dt;
  while (s.spawnQueue.length && s.spawnQueue[0].at <= s.roundT) spawnMonster(s, s.spawnQueue.shift()!);
  updateUnits(s, dt);
  updateMonsters(s, dt);
  if (s.phase !== 'playing') return; // 마지막 보스 처치로 승리한 경우
  const n = aliveMonsters(s);
  if (n >= MONSTER_CAP) { eliminate(s, `몬스터 ${MONSTER_CAP}마리 초과`); return; }
  if (s.bossDeadline != null && s.time >= s.bossDeadline) { eliminate(s, `보스를 ${BOSS_TIME}초 안에 처치하지 못함`); return; }
  if (s.mode === 'solo') {
    if (s.round < TOTAL_ROUNDS) { if (s.roundT >= ROUND_TIME) startRound(s, s.round + 1); }
    // 마지막 라운드: 보스 처치 시 killMonster에서 승리, 제한시간 초과 시 위에서 탈락
  }
}

export type Action =
  | { type: 'summon' } | { type: 'merge'; id: number; random?: boolean } | { type: 'automerge' }
  | { type: 'craft'; id: MythicId } | { type: 'sell'; id: number } | { type: 'move'; id: number; slot: number }
  | { type: 'upgradeSummon' } | { type: 'upgradeAtk' } | { type: 'sendGold'; amount: number } | { type: 'receiveGold'; amount: number };

export function dispatch(s: GameState, a: Action): roster.Result {
  switch (a.type) {
    case 'summon': return roster.summon(s);
    case 'merge': return roster.mergeUnit(s, a.id, !!a.random);
    case 'automerge': return roster.autoMerge(s);
    case 'craft': return roster.craft(s, a.id);
    case 'sell': return roster.sell(s, a.id);
    case 'move': return roster.move(s, a.id, a.slot);
    case 'upgradeSummon': return roster.upgradeSummon(s);
    case 'upgradeAtk': return roster.upgradeAtk(s);
    case 'sendGold': return roster.sendGold(s, a.amount);
    case 'receiveGold': return roster.receiveGold(s, a.amount);
  }
}

export function serialize(s: GameState): string { const { events, ...rest } = s; return JSON.stringify({ ...rest, events: [] }); }
export function stateHash(s: GameState): string {
  const str = serialize(s); let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
