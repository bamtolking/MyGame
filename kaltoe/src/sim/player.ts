// 플레이어 이동·피격·회복·아이템 획득·경험치
import { BALANCE } from '../content';
import type { World } from './types';
import { recalcBase } from './stats';
import { damageEnemy, SLOT_MISC } from './damage';

const DT = 1 / 60;

export function hurtPlayer(w: World, raw: number, source: string) {
  const p = w.player;
  if (w.phase !== 'play') return;
  if (p.invulnT > 0) return;
  if (w.ultimate.kind === 'shield' && p.ultActiveT > 0) return;
  const dmg = Math.max(1, raw - w.d.armor);
  p.hp -= dmg;
  p.hurtT = 0.25;
  w.stats_.damageTaken += dmg;
  w.stats_.maxNoHit = Math.max(w.stats_.maxNoHit, p.noHitT);
  p.noHitT = 0;
  if (p.ultActiveT <= 0) p.ult = Math.min(p.ultMax, p.ult + dmg * 0.5 * w.d.ultMul);
  w.events.push({ t: 'hurt', dmg });
  if (p.hp <= 0) {
    if (p.revivals > 0) {
      p.revivals--;
      p.hp = Math.ceil(w.d.maxHp * 0.5);
      p.invulnT = 2.5;
      for (const e of w.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 220 * 220) damageEnemy(w, e, e.boss ? 0 : 9999, SLOT_MISC, { knock: 60, flat: true, quiet: true });
      }
      w.events.push({ t: 'revive' });
      w.events.push({ t: 'explode', x: p.x, y: p.y, r: 220, color: '#ffffff', big: true });
      w.events.push({ t: 'toast', text: '보험 처리 완료! 다시 출근합니다', kind: 'good' });
    } else {
      p.hp = 0;
      w.stats_.killedBy = source;
      w.phase = 'dead';
    }
  }
}

export function healPlayer(w: World, amt: number) {
  if (w.flags.has('noHeal')) return;
  w.player.hp = Math.min(w.d.maxHp, w.player.hp + amt);
}

export function updatePlayer(w: World) {
  const p = w.player;
  const L = Math.hypot(p.mx, p.my);
  p.moving = L > 0.05;
  if (p.moving) {
    const k = Math.min(1, L) / L;
    const sp = w.d.moveSpeed * (w.ultimate.kind === 'shield' && p.ultActiveT > 0 ? 1 + (w.ultimate.params.speed ?? 0.3) : 1);
    p.x += p.mx * k * sp * DT;
    p.y += p.my * k * sp * DT;
    p.fx = p.mx / L; p.fy = p.my / L;
    p.walk += DT * 10;
  }
  if (p.hurtT > 0) p.hurtT -= DT;
  if (p.invulnT > 0) p.invulnT -= DT;
  if (p.clockT > 0) p.clockT -= DT;
  p.noHitT += DT;
  if (w.d.recovery > 0 && p.hp < w.d.maxHp) p.hp = Math.min(w.d.maxHp, p.hp + w.d.recovery * DT);
  w.lsBudget = Math.min(w.d.maxHp * 0.04, w.lsBudget + w.d.maxHp * 0.04 * DT);
}

export function gainXp(w: World, v: number) {
  const p = w.player;
  p.xp += v * w.d.growthMul;
  let leveled = false;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = BALANCE.xpToLevel(p.level);
    w.levelQueue++;
    leveled = true;
    w.events.push({ t: 'levelup', level: p.level });
  }
  if (leveled && w.cfg.character.growth) recalcBase(w);
}

export function updatePickups(w: World) {
  const p = w.player;
  const mr = w.d.magnetR;
  const itemR = Math.max(34, mr * 0.55);
  for (const k of w.pickups) {
    if (k.dead) continue;
    k.t += DT;
    const dx = p.x - k.x, dy = p.y - k.y;
    const d2 = dx * dx + dy * dy;
    if (!k.pull) {
      const R = k.kind === 'xp' || k.kind === 'coin' ? mr : itemR;
      if (d2 < R * R && k.t > 0.15) k.pull = true;
      if (k.vx !== 0 || k.vy !== 0) {
        k.x += k.vx * DT; k.y += k.vy * DT;
        k.vx *= 0.9; k.vy *= 0.9;
        if (Math.abs(k.vx) + Math.abs(k.vy) < 2) { k.vx = 0; k.vy = 0; }
      }
      continue;
    }
    const d = Math.sqrt(d2) || 1;
    // 살짝 튕겨 나갔다가 빨려오는 느낌: 처음엔 바깥으로, 곧 빠르게 안쪽으로
    k.pt += DT;
    const sp = k.pt < 0.08 ? -120 : Math.min(1100, 260 + k.pt * 1500);
    k.x += dx / d * sp * DT;
    k.y += dy / d * sp * DT;
    if (d < p.r + 8) collect(w, k);
  }
}

function collect(w: World, k: World['pickups'][number]) {
  k.dead = true;
  const p = w.player;
  const rs = w.stats_;
  switch (k.kind) {
    case 'xp': gainXp(w, k.value); w.events.push({ t: 'gem' }); return;
    case 'coin': rs.coins += k.value * w.d.greedMul * w.coinMul; w.events.push({ t: 'coin' }); return;
    case 'coffee': healPlayer(w, 30); break;
    case 'chicken': healPlayer(w, w.d.maxHp); break;
    case 'magnet':
      for (const o of w.pickups) if (!o.dead && (o.kind === 'xp' || o.kind === 'coin')) o.pull = true;
      break;
    case 'bomb':
      for (const e of w.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.x - p.x) > w.viewW * 0.6 || Math.abs(e.y - p.y) > w.viewH * 0.6) continue;
        const dmg = e.boss ? e.maxHp * 0.03 : e.elite ? e.maxHp * 0.25 : e.hp + 1;
        damageEnemy(w, e, dmg, SLOT_MISC, { flat: true, knock: 20, quiet: !e.boss && !e.elite });
      }
      w.events.push({ t: 'explode', x: p.x, y: p.y, r: Math.max(w.viewW, w.viewH) * 0.6, color: '#ffae00', big: true });
      break;
    case 'clock': p.clockT = 5; break;
    case 'chest': w.chestQueue.push({ boss: !!k.bossChest }); break;
  }
  rs.pickups[k.kind] = (rs.pickups[k.kind] ?? 0) + 1;
  w.events.push({ t: 'item', kind: k.kind });
}
