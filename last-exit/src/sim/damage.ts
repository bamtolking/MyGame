// 피해 처리: 플레이어·적. 한 곳에서만 체력을 줄인다.
import type { RunState, Enemy, LootId } from './types';
import { ENEMIES, ABILITIES, BOSS, LOOT } from '../data/balance';
import { emit, nid, toast } from './state';
import { rngNext } from './rng';
import { zoneDef } from '../data/zones';

/** 플레이어 피해. 무적·피격 직후 중복 방지. 사망 시 상태 확정. 반환: 실제 적용 여부 */
export function damagePlayer(s: RunState, amount: number, dx: number, dy: number, cause: string): boolean {
  const p = s.player;
  if (s.status !== 'active') return false;
  if (p.invulnT > 0 || p.hurtT > 0) return false;
  let rest = amount; let usedShield = false;
  if (p.shield > 0) { const a = Math.min(p.shield, rest); p.shield -= a; rest -= a; usedShield = true; }
  p.hp = Math.max(0, p.hp - rest);
  p.hurtT = 0.55; p.hurtDx = dx; p.hurtDy = dy;
  s.stats.damageTaken[s.zone] += amount; s.stats.hits++;
  emit(s, { t: 'hurt', dx, dy, amount, shield: usedShield });
  if (p.hp <= 0) {
    s.status = 'dead'; s.phase = 'done';
    s.result = { kind: 'dead', value: 0, items: { ...s.bag.items }, zone: s.zone, cause, time: s.time, boss: s.zoneRt.bossDead };
    emit(s, { t: 'dead', cause });
  }
  return true;
}

/** 적 피해. src='weapon'일 때만 서리 적용. 반환: 처치 여부 */
export function damageEnemy(s: RunState, e: Enemy, amount: number, src: 'weapon' | 'shock', kx = 0, ky = 0, knock = 0): boolean {
  if (e.state === 'dead') return false;
  const def = ENEMIES[e.type];
  const dmg = amount * (1 - def.dr);
  e.hp -= dmg; e.hitFlash = 0.12; e.flash = 0.12;
  emit(s, { t: 'hit', x: e.x, y: e.y });
  if (src === 'weapon') {
    const f = s.abilities.frost || 0;
    if (f) {
      if (e.type === 'boss') { e.slowMul = ABILITIES.frost.bossSlow; e.slowT = Math.max(e.slowT, ABILITIES.frost.bossDur); }
      else { e.slowMul = Math.max(0.6, ABILITIES.frost.slow[f - 1]); e.slowT = Math.max(e.slowT, ABILITIES.frost.dur[f - 1]); }
    }
  }
  if (knock > 0 && e.type !== 'boss' && e.type !== 'armored' && e.state !== 'charge') {
    // 짧은 밀쳐내기: 위치를 직접 이동하지 않고 속도 느낌으로 스텝에서 처리하기 위해 dir 저장 대신 즉시 소량 이동
    e.x += kx * knock * 0.05; e.y += ky * knock * 0.05; emit(s, { t: 'knock', id: e.id });
  }
  if (e.hp <= 0) { killEnemy(s, e); return true; }
  return false;
}

export function killEnemy(s: RunState, e: Enemy): void {
  if (e.state === 'dead') return;
  e.state = 'dead'; e.hp = 0;
  emit(s, { t: 'kill', type: e.type, x: e.x, y: e.y });
  s.stats.kills[s.zone]++;
  if (e.type === 'boss') {
    s.zoneRt.bossDead = true; s.bossBar = null;
    emit(s, { t: 'bossDead' });
    if (!s.flags.bossReward) {
      s.flags.bossReward = true;
      BOSS.reward.forEach((r, i) => s.loots.push({ id: nid(s), type: r.type, count: r.count, x: e.x + (i - 0.5) * 30, y: e.y + 10, attract: false, blocked: false, noPickT: 0.3 }));
      toast(s, '금고 파수꾼 처치! 보상은 탈출해야 확정됩니다', 'good');
    }
    return;
  }
  if (!e.noLoot) {
    s.zoneRt.kills++;
    const def = ENEMIES[e.type];
    if (rngNext(s.rng) < def.dropChance * 0.4) {
      const type: LootId = s.zone <= 2 ? 'scrap' : (rngNext(s.rng) < 0.85 ? 'parts' : 'relic');
      s.loots.push({ id: nid(s), type, count: 1, x: e.x, y: e.y, attract: false, blocked: false, noPickT: 0.25 });
    }
  }
}
export function lootName(id: LootId): string { return LOOT[id].name; }
export function zoneName(n: number): string { return zoneDef(n).name; }
