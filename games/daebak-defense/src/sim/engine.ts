import type { GameState, Grade, MythicId, UnitKind, EnemyType } from './types';
import { rngNext, rngShuffle } from './rng';
import { WAVES, EXTRA_GROUPS, hpMul, BOSS_HP_MUL, TOTAL_WAVES, SPAWN_GAP_MUL } from '../data/waves';
import { PREP_TIME, EARLY_BONUS_PER_SEC, waveReward, EXTRA_ORDER_WAVES, COURIER_WAVES, OVERHEAT_WAVES, SKILL_BOMB, SKILL_FREEZE } from '../data/economy';
import { TOAD_CAP } from '../data/units';
import { RELICS } from '../data/relics';
import { ENEMIES } from '../data/enemies';
import { computeCtx, updateUnits, updateProjectiles, updateEnemies, updateSeals, spawnEnemy } from './combat';
import { baseStats, fieldUnits, pushLog, skillCooldownMax, STATE_VERSION } from './state';
import * as roster from './roster';
import { SLOTS } from '../data/map';

export const DT = 1 / 60;
type Result = roster.Result;

export function startWave(s: GameState, n: number): void {
  const def = WAVES[n - 1];
  const mul = hpMul(n);
  const q: { at: number; type: EnemyType; hpMul: number; tag: string }[] = [];
  const push = (groups: typeof def.groups, tag = '', offset = 0) => {
    for (const g of groups) for (let i = 0; i < g.n; i++) {
      const isBoss = !!ENEMIES[g.type].boss;
      q.push({ at: (offset + g.delay + i * g.gap) * SPAWN_GAP_MUL, type: g.type, hpMul: isBoss ? BOSS_HP_MUL : mul, tag });
    }
  };
  push(def.groups);
  const extra = s.extraOffer && s.extraOffer.wave === n && s.extraOffer.decided && s.extraOffer.open;
  if (extra && EXTRA_GROUPS[n]) push(EXTRA_GROUPS[n], 'extra', 8);
  if (COURIER_WAVES[n]) q.push({ at: 6, type: 'courier', hpMul: mul, tag: 'courier' });
  q.sort((a, b) => a.at - b.at);
  s.wave = n; s.phase = 'wave';
  s.waveRt = { index: n, spawnQueue: q, spawnT: 0, spawned: 0, remaining: 0, extraAccepted: !!extra, startedAt: s.time, overheatSlots: [], overheatT: 0, courierAlive: false };
  if (OVERHEAT_WAVES.includes(n)) {
    const pool = SLOTS.map(x => x.id); rngShuffle(s.rng, pool);
    s.waveRt.overheatSlots = pool.slice(0, 3); s.waveRt.overheatT = 29; // 4s warn + 25s active
    pushLog(s, `공방 과열 예고: ${s.waveRt.overheatSlots.map(i => SLOTS[i].name).join(', ')} (4초 뒤 25초간 공격 +40%)`, 'warn');
  }
  s.events.push({ t: 'wave', index: n });
  if (def.boss) { s.events.push({ t: 'boss', type: def.boss }); pushLog(s, `보스 등장: ${ENEMIES[def.boss].name} (통과 시 생명 -${ENEMIES[def.boss].exitDmg}${def.boss === 'boss_king' ? ' = 즉시 패배' : ''}) — ${ENEMIES[def.boss].hint}`, 'warn'); }
  else if (def.intro && !s.seenEnemies.includes(def.intro)) { const d = ENEMIES[def.intro]; pushLog(s, `새로운 적 [${d.trait}] ${d.name}: ${d.hint}`, 'info'); }
  if (COURIER_WAVES[n]) pushLog(s, '돌발: 보물 운반꾼이 곧 지나갑니다! 잡으면 큰 골드', 'good');
}

function endWave(s: GameState): void {
  const n = s.wave;
  let reward = waveReward(n);
  if (s.relics.includes('guild_seal')) reward = Math.round(reward * 1.15);
  let toad = 0; let colossus = 0;
  for (const u of fieldUnits(s)) { const st = baseStats(s, u); if (u.mythic === 'colossus') colossus += st.income; else if (st.income) toad += st.income; }
  toad = Math.min(toad, s.relics.includes('guild_seal') ? 90 : TOAD_CAP);
  let extra = 0, extraShards = 0;
  if (s.waveRt?.extraAccepted && EXTRA_ORDER_WAVES[n]) { extra = EXTRA_ORDER_WAVES[n].gold; extraShards = EXTRA_ORDER_WAVES[n].shards; s.stats.extraAccepted++; }
  const total = reward + toad + colossus + extra;
  s.gold += total; s.stats.goldEarned += total; s.shards += extraShards;
  pushLog(s, `웨이브 ${n} 완료: +${reward}${toad ? ` (두꺼비 +${toad})` : ''}${colossus ? ` (거신 +${colossus})` : ''}${extra ? ` (추가 주문 +${extra}, 조각 +${extraShards})` : ''}`, 'good');
  s.events.push({ t: 'gold', x: 200, y: 300, amount: total });
  s.waveRt = null; s.seals = []; s.extraOffer = null;
  if (n >= TOTAL_WAVES) { s.phase = 'won'; s.events.push({ t: 'won' }); return; }
  s.wave = n + 1;
  if (WAVES[n - 1].boss) { offerRelics(s); if (s.relicOffer) { s.phase = 'relic'; return; } }
  beginPrep(s);
}

export function beginPrep(s: GameState): void {
  s.phase = 'prep'; s.prepT = PREP_TIME; s.prepMax = PREP_TIME;
  if (EXTRA_ORDER_WAVES[s.wave]) { s.extraOffer = { wave: s.wave, open: false, decided: false }; pushLog(s, `위험한 추가 주문: 웨이브 ${s.wave}에 강한 무리를 추가하면 +${EXTRA_ORDER_WAVES[s.wave].gold} 골드, 조각 +${EXTRA_ORDER_WAVES[s.wave].shards}`, 'warn'); }
}

function offerRelics(s: GameState): void {
  const owned = new Set(s.relics);
  const kinds = new Set(s.units.map(u => u.kind));
  const pool = RELICS.filter(r => !owned.has(r.id));
  const relevant = pool.filter(r => r.tags.length === 0 || r.tags.some(t => kinds.has(t as UnitKind)));
  const rest = pool.filter(r => !relevant.includes(r));
  rngShuffle(s.rng, relevant); rngShuffle(s.rng, rest);
  const pick = [...relevant, ...rest].slice(0, 3).map(r => r.id);
  s.relicOffer = pick.length ? pick : null;
}

export function chooseRelic(s: GameState, id: string): Result {
  if (s.phase !== 'relic' || !s.relicOffer) return { ok: false, error: '유물 선택 단계가 아닙니다' };
  if (!s.relicOffer.includes(id)) return { ok: false, error: '제시되지 않은 유물' };
  s.relics.push(id); s.stats.relics.push(id); s.relicOffer = null;
  s.events.push({ t: 'relic', id });
  pushLog(s, `유물 획득: ${RELICS.find(r => r.id === id)!.name}`, 'good');
  beginPrep(s);
  return { ok: true };
}

export function earlyStart(s: GameState): Result {
  if (s.phase !== 'prep') return { ok: false, error: '대기 중이 아닙니다' };
  const bonus = Math.floor(s.prepT * EARLY_BONUS_PER_SEC);
  if (bonus > 0) { s.gold += bonus; s.stats.goldEarned += bonus; pushLog(s, `조기 시작 보너스 +${bonus}`, 'good'); }
  if (s.extraOffer && !s.extraOffer.decided) s.extraOffer = null;
  startWave(s, s.wave);
  return { ok: true };
}

export function decideExtra(s: GameState, accept: boolean): Result {
  if (s.phase !== 'prep' || !s.extraOffer || s.extraOffer.decided) return { ok: false, error: '추가 주문을 결정할 수 없습니다' };
  s.extraOffer.decided = true; s.extraOffer.open = accept;
  pushLog(s, accept ? '추가 주문 수락! 강한 무리가 추가됩니다' : '추가 주문 거절 (손해 없음)', accept ? 'warn' : 'info');
  return { ok: true };
}

export function useSkill(s: GameState, kind: 'bomb' | 'freeze', x: number, y: number): Result {
  if (s.phase !== 'wave' && s.phase !== 'prep') return { ok: false, error: '지금은 사용할 수 없습니다' };
  if (s.skills[kind] > 0) return { ok: false, error: `재사용 대기 ${Math.ceil(s.skills[kind])}초` };
  s.skills[kind] = skillCooldownMax(s, kind);
  if (kind === 'bomb') {
    const dmg = SKILL_BOMB.dmg * (1 + SKILL_BOMB.perWave * s.wave) * (s.relics.includes('field_manual') ? 1.4 : 1);
    s.projectiles.push({ id: s.nextId++, kind: 'skill_bomb', x, y: -30, sx: x, sy: -30, tx: x, ty: y, targetId: -1, t: 0, dur: 0.6, speed: 0, dmg, src: -1, grade: 0, radius: SKILL_BOMB.radius, fx: SKILL_BOMB.bossMul, fired: s.time });
  } else {
    s.projectiles.push({ id: s.nextId++, kind: 'skill_freeze', x, y: -30, sx: x, sy: -30, tx: x, ty: y, targetId: -1, t: 0, dur: 0.5, speed: 0, dmg: SKILL_FREEZE.dur, src: -1, grade: 0, radius: SKILL_FREEZE.radius, fx: 0, fired: s.time });
  }
  return { ok: true };
}

/** Advance simulation by one fixed step. Only runs the world when the phase allows. */
export function step(s: GameState, dt = DT): void {
  if (s.phase === 'won' || s.phase === 'lost' || s.phase === 'relic') return;
  if (s.phase === 'countdown') { s.countdownT -= dt; if (s.countdownT <= 0) { s.countdownT = 0; startWave(s, 1); } return; }
  s.time += dt; s.stats.playTime += dt;
  for (const k of ['bomb', 'freeze'] as const) if (s.skills[k] > 0) s.skills[k] = Math.max(0, s.skills[k] - dt);
  if (s.phase === 'prep') {
    s.prepT -= dt;
    // units keep relocating cooldowns ticking; no enemies exist
    for (const u of s.units) if (u.moveCd > 0) u.moveCd = Math.max(0, u.moveCd - dt);
    updateProjectiles(s, dt);
    if (s.prepT <= 0) { if (s.extraOffer && !s.extraOffer.decided) s.extraOffer = null; startWave(s, s.wave); }
    return;
  }
  // phase === 'wave'
  const rt = s.waveRt!;
  rt.spawnT += dt;
  while (rt.spawnQueue.length && rt.spawnQueue[0].at <= rt.spawnT) {
    const it = rt.spawnQueue.shift()!;
    const reward = it.type === 'courier' ? COURIER_WAVES[rt.index] : undefined;
    const e = spawnEnemy(s, it.type, it.hpMul, it.tag, 0, reward);
    rt.spawned++;
    if (it.type === 'boss_flag') { for (const x of s.enemies) if (x.alive && x.type === 'wisp' && x.wave === s.wave && x.id !== e.id) x.escortOf = e.id; }
    if (e.type === 'wisp' && it.tag === '') { const boss = s.enemies.find(b => b.alive && b.type === 'boss_flag'); if (boss) e.escortOf = boss.id; }
  }
  if (rt.overheatT > 0) rt.overheatT -= dt;
  const ctx = computeCtx(s);
  updateUnits(s, dt, ctx);
  updateProjectiles(s, dt);
  updateEnemies(s, dt);
  updateSeals(s, dt);
  if ((s.phase as string) === 'lost') return;
  if (rt.spawnQueue.length === 0 && !s.enemies.some(e => e.alive) && s.projectiles.every(p => p.kind === 'skill_bomb' || p.kind === 'skill_freeze' ? false : true)) {
    if (s.projectiles.length === 0) endWave(s);
    else if (s.projectiles.every(p => p.kind !== 'skill_bomb' && p.kind !== 'skill_freeze')) { s.projectiles = []; endWave(s); }
  }
}

// ---------- dispatch ----------
export type Action =
  | { type: 'summon' } | { type: 'designate'; kind: UnitKind }
  | { type: 'merge'; ids: number[] } | { type: 'craft'; id: MythicId } | { type: 'reserve'; id: MythicId }
  | { type: 'move'; id: number; to: { t: 'f'; slot: number } | { t: 'b'; idx: number } }
  | { type: 'lock'; id: number } | { type: 'fav'; id: number } | { type: 'sell'; id: number }
  | { type: 'upgrade'; id: 'atk' | 'spd' | 'life' }
  | { type: 'skill'; kind: 'bomb' | 'freeze'; x: number; y: number }
  | { type: 'relic'; id: string } | { type: 'early' } | { type: 'extra'; accept: boolean };

export function dispatch(s: GameState, a: Action): Result & { unitId?: number } {
  switch (a.type) {
    case 'summon': return roster.summon(s);
    case 'designate': return roster.designateKind(s, a.kind);
    case 'merge': return roster.merge(s, a.ids);
    case 'craft': return roster.craftMythic(s, a.id);
    case 'reserve': { const n = roster.reserveRecipe(s, a.id); return { ok: true, msg: `${n}개 재료 잠금` }; }
    case 'move': return roster.moveUnit(s, a.id, a.to);
    case 'lock': return roster.toggleLock(s, a.id);
    case 'fav': return roster.toggleFav(s, a.id);
    case 'sell': return roster.sellUnit(s, a.id);
    case 'upgrade': return roster.buyUpgrade(s, a.id);
    case 'skill': return useSkill(s, a.kind, a.x, a.y);
    case 'relic': return chooseRelic(s, a.id);
    case 'early': return earlyStart(s);
    case 'extra': return decideExtra(s, a.accept);
  }
}

// ---------- snapshot ----------
export function serialize(s: GameState): string {
  const { events, ...rest } = s;
  return JSON.stringify({ ...rest, events: [] });
}
export function deserialize(json: string): GameState {
  const o = JSON.parse(json);
  if (!o || typeof o !== 'object' || o.version !== STATE_VERSION) throw new Error(`저장 버전 불일치 (${o?.version} ≠ ${STATE_VERSION})`);
  if (!Array.isArray(o.units) || !Array.isArray(o.slots) || !o.rng) throw new Error('저장 데이터 손상');
  o.events = [];
  return o as GameState;
}
export function stateHash(s: GameState): string {
  // cheap structural hash for determinism tests
  const str = serialize(s); let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
