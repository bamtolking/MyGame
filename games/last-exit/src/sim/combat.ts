// 자동 공격·타깃 선택·투사체·전기 연결·충격탄 폭발
import type { RunState, Enemy, Projectile } from './types';
import { ABILITIES, PLAYER } from '../data/balance';
import { weaponStats, emit, nid } from './state';
import { damageEnemy, damagePlayer } from './damage';
import { hasLos, dist, norm, tileAt, blocksShot } from './geom';

function targetable(s: RunState, e: Enemy, range: number): boolean {
  if (e.state === 'dead') return false;
  const p = s.player; const d = dist(p.x, p.y, e.x, e.y);
  if (d > range + e.r) return false;
  return hasLos(s.zoneRt.rows, p.x, p.y, e.x, e.y);
}

export function pickTarget(s: RunState, range: number): Enemy | null {
  const p = s.player;
  if (p.targetId != null) { const cur = s.enemies.find(e => e.id === p.targetId); if (cur && targetable(s, cur, range)) return cur; }
  let best: Enemy | null = null, bd = Infinity;
  for (const e of s.enemies) { if (!targetable(s, e, range)) continue; const d = dist(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
  p.targetId = best ? best.id : null;
  return best;
}

export function explode(s: RunState, x: number, y: number, r: number, dmg: number): void {
  emit(s, { t: 'explode', x, y, r, kind: 'shock' });
  for (const e of s.enemies) { if (e.state === 'dead') continue; if (dist(x, y, e.x, e.y) <= r + e.r) damageEnemy(s, e, dmg, 'shock'); }
}

export function updatePlayerAttack(s: RunState, dt: number): void {
  const p = s.player; const ws = weaponStats(s);
  p.fireCd = Math.max(0, p.fireCd - dt); p.recoil = Math.max(0, p.recoil - dt * 6);
  const t = pickTarget(s, ws.range);
  if (t) { const [ax, ay] = norm(t.x - p.x, t.y - p.y); p.aimX = ax; p.aimY = ay; }
  else if (p.moving) { p.aimX = p.moveX; p.aimY = p.moveY; }
  if (!t || p.fireCd > 0) return;
  p.fireCd = ws.interval; p.shots++; p.recoil = 1; s.volley++;
  const shock = ws.shockEvery > 0 && p.shots % ws.shockEvery === 0;
  const a = Math.atan2(p.aimY, p.aimX);
  emit(s, { t: 'shot', weapon: s.weapon, x: p.x, y: p.y, a, tier: s.tier });
  if (s.weapon === 'staff') {
    // 즉시 타격 + 연결
    const pts = [p.x, p.y, t.x, t.y];
    const visited = new Set<number>([t.id]);
    damageEnemy(s, t, ws.dmg, 'weapon');
    if (shock) explode(s, t.x, t.y, ABILITIES.shock.radius, ws.shockDmg);
    let cur = t, dmg = ws.dmg;
    for (let i = 0; i < ws.chains; i++) {
      let next: Enemy | null = null, bd = Infinity;
      for (const e of s.enemies) { if (e.state === 'dead' || visited.has(e.id)) continue; const d = dist(cur.x, cur.y, e.x, e.y); if (d <= ws.chainRange + e.r && d < bd && hasLos(s.zoneRt.rows, cur.x, cur.y, e.x, e.y)) { bd = d; next = e; } }
      if (!next) break;
      dmg *= ws.chainFalloff; visited.add(next.id); pts.push(next.x, next.y);
      damageEnemy(s, next, dmg, 'weapon'); cur = next;
    }
    emit(s, { t: 'beam', pts, tier: s.tier });
    return;
  }
  const n = ws.pellets; const life = ws.range / ws.speed + 0.05;
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * ws.spread;
    const ang = a + off; const vx = Math.cos(ang) * ws.speed, vy = Math.sin(ang) * ws.speed;
    s.projectiles.push({ id: nid(s), owner: 'player', src: 'weapon', x: p.x + Math.cos(ang) * 14, y: p.y + Math.sin(ang) * 14, vx, vy, dmg: ws.dmg, r: ws.projR, life, pierce: ws.pierce, hitIds: [], kind: n > 1 ? 'pellet' : 'bullet', knock: ws.knock, volley: s.volley, shock });
  }
}

export function updateProjectiles(s: RunState, dt: number): void {
  const p = s.player; const rows = s.zoneRt.rows; const ws = weaponStats(s);
  for (let i = s.projectiles.length - 1; i >= 0; i--) {
    const pr = s.projectiles[i];
    pr.life -= dt;
    // 벽 통과 방지: 이동을 작은 단계로 나눔
    const steps = Math.max(1, Math.ceil(Math.hypot(pr.vx, pr.vy) * dt / 10));
    let dead = pr.life <= 0;
    for (let k = 0; k < steps && !dead; k++) {
      pr.x += pr.vx * dt / steps; pr.y += pr.vy * dt / steps;
      const [tx, ty] = tileAt(pr.x, pr.y);
      if (blocksShot(rows, tx, ty)) { dead = true; emit(s, { t: 'hit', x: pr.x, y: pr.y }); break; }
      if (pr.owner === 'player') {
        for (const e of s.enemies) {
          if (e.state === 'dead' || pr.hitIds.includes(e.id)) continue;
          if (dist(pr.x, pr.y, e.x, e.y) <= e.r + pr.r) {
            const [kx, ky] = norm(pr.vx, pr.vy);
            if (pr.shock) { explode(s, pr.x, pr.y, ABILITIES.shock.radius, ws.shockDmg); for (const o of s.projectiles) if (o.volley === pr.volley) o.shock = false; }
            damageEnemy(s, e, pr.dmg, 'weapon', kx, ky, pr.knock);
            pr.hitIds.push(e.id);
            if (pr.pierce > 0) { pr.pierce--; } else { dead = true; break; }
          }
        }
      } else {
        if (dist(pr.x, pr.y, p.x, p.y) <= PLAYER.radius + pr.r) {
          const [kx, ky] = norm(pr.vx, pr.vy);
          damagePlayer(s, pr.dmg, kx, ky, pr.src === 'boss' ? '금고 파수꾼 투사체' : '사수 투사체');
          dead = true; emit(s, { t: 'hit', x: pr.x, y: pr.y });
        }
      }
    }
    if (dead) s.projectiles.splice(i, 1);
  }
}
