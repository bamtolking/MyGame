// 절차적 벡터 스프라이트. 외부 자산 없이 Canvas 2D로 그린다. 좌표계: 대상 중심이 (0,0).
import type { EnemyType, LootId, WeaponId } from '../sim/types';
import { LOOT } from '../data/balance';
type Ctx = CanvasRenderingContext2D;

function circle(c: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, lw = 1.5): void { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 1.5): void { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
function poly(c: Ctx, pts: number[], fill: string, stroke?: string, lw = 1.5): void { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
const OUT = '#141017';

export interface PlayerOpts { aimA: number; walk: number; moving: boolean; weapon: WeaponId; tier: number; weightRatio: number; dashing: boolean; hurt: number; invuln: boolean; recoil: number; t: number; hpRatio: number }

export function drawWeapon(c: Ctx, weapon: WeaponId, tier: number, recoil: number, t: number): void {
  // 조준 방향 +x. 총구는 x>0
  const k = -recoil * 4;
  if (weapon === 'rifle') {
    rrect(c, -8 + k, -3, 26, 6, 2, '#3b4252', OUT, 1.2);
    rrect(c, 6 + k, -2, 16, 3.5, 1.5, tier >= 2 ? '#c9a24a' : tier >= 1 ? '#8fa3b8' : '#6b7787', OUT, 1);
    if (tier >= 2) rrect(c, 6 + k, 2, 14, 2.5, 1, '#c9a24a', OUT, 1);
    rrect(c, -6 + k, 2, 6, 6, 1.5, '#2b3040', OUT, 1);
  } else if (weapon === 'shotgun') {
    rrect(c, -10 + k, -4, 22, 8, 3, '#5a4632', OUT, 1.2);
    rrect(c, 4 + k, -3.5, 14, 7, 2, tier >= 2 ? '#d1a34b' : '#8a8f9a', OUT, 1);
    circle(c, 18 + k, 0, 3.6, '#2a2a30', '#111');
    if (tier >= 1) circle(c, 18 + k, 0, 1.8, tier >= 2 ? '#ffd27a' : '#c8d0dc');
    rrect(c, -8 + k, 3, 6, 5, 1.5, '#3a2c1c', OUT, 1);
  } else {
    rrect(c, -10 + k, -2, 26, 4, 2, '#6b4d2a', OUT, 1.2);
    const glow = tier >= 2 ? '#ffe680' : tier >= 1 ? '#9ff0ff' : '#5ad0e0';
    c.save(); c.shadowColor = glow; c.shadowBlur = 8 + tier * 4;
    circle(c, 18 + k, 0, 4.5 + tier, glow, OUT, 1);
    c.restore();
    const a = t * 6; c.strokeStyle = glow; c.lineWidth = 1.2; c.beginPath(); c.moveTo(14 + k, -5); c.lineTo(17 + k + Math.sin(a) * 2, -1); c.lineTo(15 + k, 3); c.stroke();
  }
}

export function drawPlayer(c: Ctx, o: PlayerOpts): void {
  const bob = o.moving ? Math.sin(o.walk) * 1.6 : Math.sin(o.t * 2) * 0.5;
  const lean = o.moving ? Math.cos(o.walk) * 0.06 : 0;
  c.save();
  if (o.invuln) c.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(o.t * 40));
  c.translate(0, bob); c.rotate(lean);
  // 그림자
  c.globalAlpha *= 1; circle(c, 0, 14, 10, 'rgba(0,0,0,0.35)');
  // 다리
  const legA = o.moving ? Math.sin(o.walk) * 5 : 0;
  rrect(c, -7, 6 + legA * 0.3, 5, 9, 2, '#2d3446', OUT, 1); rrect(c, 2, 6 - legA * 0.3, 5, 9, 2, '#2d3446', OUT, 1);
  // 가방 (무게에 따라 커짐)
  const bw = 12 + o.weightRatio * 10, bh = 14 + o.weightRatio * 8;
  const back = o.aimA > -Math.PI / 2 && o.aimA < Math.PI / 2 ? -1 : 1;
  rrect(c, back > 0 ? 2 : -2 - bw, -8, bw, bh, 4, o.weightRatio > 0.85 ? '#b0473f' : '#2f8f8a', OUT, 1.3);
  rrect(c, back > 0 ? 4 : -bw, -6, bw - 4, 4, 2, 'rgba(255,255,255,0.18)');
  // 몸통 (주황 재킷)
  rrect(c, -9, -6, 18, 15, 5, o.hurt > 0 ? '#ff9b8f' : '#f28c3a', OUT, 1.4);
  rrect(c, -3, -4, 6, 11, 2, '#c96d24');
  // 머리 + 헬멧
  circle(c, 0, -13, 8.5, '#ffd9b3', OUT, 1.4);
  c.beginPath(); c.arc(0, -14, 9, Math.PI, 0); c.fillStyle = '#e8c74a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke();
  rrect(c, -9.5, -15, 19, 3, 1.5, '#d1a83a', OUT, 1);
  // 고글
  const ex = Math.cos(o.aimA) * 2.5, ey = Math.sin(o.aimA) * 1.2;
  rrect(c, -7 + ex, -13 + ey, 14, 5, 2.5, '#233', OUT, 1);
  circle(c, -3.5 + ex, -10.5 + ey, 2, '#8ff'); circle(c, 3.5 + ex, -10.5 + ey, 2, '#8ff');
  // 무기 (조준 방향)
  c.save(); c.translate(0, -1); c.rotate(o.aimA); if (Math.abs(o.aimA) > Math.PI / 2) c.scale(1, -1); drawWeapon(c, o.weapon, o.tier, o.recoil, o.t); c.restore();
  // 팔
  const hx = Math.cos(o.aimA) * 8, hy = Math.sin(o.aimA) * 8 - 1;
  circle(c, hx, hy, 3.2, '#ffd9b3', OUT, 1);
  c.restore();
}

export interface EnemyOpts { type: EnemyType; state: string; stateT: number; windup: number; faceA: number; flash: number; hpRatio: number; slow: boolean; t: number; phase?: number; pattern?: string; telegraph?: number; patternT?: number }

export function drawEnemy(c: Ctx, o: EnemyOpts): void {
  const flash = o.flash > 0;
  const wind = o.state === 'windup' || o.state === 'fuse';
  const wr = wind ? Math.min(1, 1 - o.stateT / Math.max(0.01, o.windup)) : 0;
  c.save();
  if (o.state === 'spawn') { c.globalAlpha = 0.6; c.scale(0.7, 0.7); }
  const tint = (base: string) => flash ? '#ffffff' : base;
  const bob = Math.sin(o.t * 6 + o.faceA) * 1.2;
  switch (o.type) {
    case 'chaser': {
      circle(c, 0, 12, 10, 'rgba(0,0,0,0.3)');
      // 녹슨 상자 몸통 + 외눈
      c.save(); c.translate(0, bob); if (wind) c.translate(Math.cos(o.faceA) * wr * -4, Math.sin(o.faceA) * wr * -4);
      rrect(c, -11, -9, 22, 20, 4, tint('#8a4b32'), OUT, 1.5);
      rrect(c, -9, -7, 18, 5, 2, tint('#a86b4a'));
      circle(c, Math.cos(o.faceA) * 3, -1 + Math.sin(o.faceA) * 2, 5, '#1a0f0f', OUT, 1);
      circle(c, Math.cos(o.faceA) * 4, -1 + Math.sin(o.faceA) * 2.5, 2.5, wind ? '#fff35a' : '#ff3b3b');
      // 팔 (휘두르기 예고: 팔이 뒤로 젖혀졌다가 앞으로)
      const armA = o.faceA + (wind ? -1.2 + wr * 0.4 : 0.6 + Math.sin(o.t * 8) * 0.2);
      c.save(); c.rotate(armA); rrect(c, 6, -2.5, 14, 5, 2, tint('#6d3a26'), OUT, 1.2); poly(c, [20, -5, 26, 0, 20, 5], '#c9c9c9', OUT, 1); c.restore();
      c.restore();
      break;
    }
    case 'runner': {
      circle(c, 0, 10, 8, 'rgba(0,0,0,0.3)');
      c.save(); c.rotate(o.faceA);
      // 노란 랩터형: 뾰족한 몸, 긴 다리
      const leg = Math.sin(o.t * 22) * 4;
      c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-4, 4); c.lineTo(-7 + leg, 11); c.moveTo(2, 4); c.lineTo(5 - leg, 11); c.stroke();
      poly(c, [12, 0, -8, -7, -12, 0, -8, 7], tint('#e3c23a'), OUT, 1.5);
      circle(c, 5, -1, 2, '#1a1a1a'); circle(c, 5.5, -1, 1, wind ? '#fff' : '#ff4040');
      poly(c, [12, 0, 16, -3, 16, 3], '#fff', OUT, 1);
      c.restore();
      break;
    }
    case 'shooter': {
      circle(c, 0, 12, 9, 'rgba(0,0,0,0.3)');
      // 보라 삼각대 + 렌즈
      c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 3; i++) { const a = o.t * 0.5 + i * Math.PI * 2 / 3; c.moveTo(0, 2); c.lineTo(Math.cos(a) * 10, 12); } c.stroke();
      c.strokeStyle = '#6a4d8a'; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < 3; i++) { const a = o.t * 0.5 + i * Math.PI * 2 / 3; c.moveTo(0, 2); c.lineTo(Math.cos(a) * 10, 12); } c.stroke();
      circle(c, 0, -2, 10, tint('#7b4fb0'), OUT, 1.5);
      c.save(); c.rotate(o.faceA); rrect(c, 4, -3, 12, 6, 2, tint('#3a2a55'), OUT, 1.2); circle(c, 15, 0, 3, wind ? '#fff35a' : '#ff5ea8', OUT, 1); c.restore();
      circle(c, -3, -5, 2, '#d9c6ff');
      break;
    }
    case 'armored': {
      circle(c, 0, 15, 13, 'rgba(0,0,0,0.35)');
      c.save(); if (o.state === 'charge') c.translate(Math.cos(o.faceA) * 2, Math.sin(o.faceA) * 2);
      // 회청색 둥근 장갑 + 판
      circle(c, 0, 0, 15, tint('#4b6078'), OUT, 2);
      c.strokeStyle = tint('#7d94ad'); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 10, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      rrect(c, -13, 2, 26, 6, 2, tint('#3a4a5e'), OUT, 1);
      c.save(); c.rotate(o.faceA); rrect(c, 4, -8, 14, 16, 3, tint(wind ? '#c8d8ea' : '#8aa0b8'), OUT, 1.5); c.restore();
      circle(c, Math.cos(o.faceA) * 4, Math.sin(o.faceA) * 3 - 2, 3, wind || o.state === 'charge' ? '#ffb347' : '#ff6b6b', OUT, 1);
      c.restore();
      break;
    }
    case 'bomber': {
      circle(c, 0, 11, 9, 'rgba(0,0,0,0.3)');
      const blink = o.state === 'fuse' ? (Math.sin(o.t * (10 + wr * 40)) > 0) : (Math.sin(o.t * 4) > 0.6);
      c.save(); c.translate(0, bob * (o.state === 'fuse' ? 2 : 1));
      circle(c, 0, 0, 11, tint('#e07a2f'), OUT, 1.5);
      rrect(c, -8, -3, 16, 3, 1, 'rgba(0,0,0,0.25)');
      circle(c, 0, -13, 3.5, blink ? '#fff35a' : '#7a2a10', OUT, 1);
      c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(0, -9); c.stroke();
      circle(c, -3.5, -2, 2, '#1a1a1a'); circle(c, 3.5, -2, 2, '#1a1a1a');
      c.strokeStyle = '#1a1a1a'; c.lineWidth = 1.3; c.beginPath(); c.arc(0, 3, 4, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
      c.restore();
      break;
    }
    case 'boss': drawBoss(c, o); break;
  }
  c.restore();
}

export function drawBoss(c: Ctx, o: EnemyOpts): void {
  const flash = o.flash > 0; const p2 = (o.phase || 1) === 2;
  const tele = o.pattern && o.pattern !== 'idle' ? Math.min(1, (o.patternT || 0) / Math.max(0.01, o.telegraph || 1)) : 0;
  circle(c, 0, 26, 28, 'rgba(0,0,0,0.4)');
  // 금고문 몸통
  const body = flash ? '#fff' : p2 ? '#6b2f6b' : '#4e3a50';
  circle(c, 0, 0, 30, body, OUT, 2.5);
  circle(c, 0, 0, 24, flash ? '#eee' : p2 ? '#8a3f8a' : '#6a4d6c', '#2a1a2a', 1.5);
  // 손잡이 (회전)
  c.save(); c.rotate(o.t * (p2 ? 2.2 : 0.8));
  c.strokeStyle = flash ? '#ddd' : '#e9c46a'; c.lineWidth = 4; c.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); } c.stroke();
  circle(c, 0, 0, 6, '#e9c46a', OUT, 1.5);
  c.restore();
  // 눈 (두 개, 예고 중 밝아짐)
  const eye = tele > 0 ? `rgba(255,${Math.round(240 - tele * 120)},80,1)` : '#ff5aa0';
  circle(c, -9, -7, 4, eye, OUT, 1); circle(c, 9, -7, 4, eye, OUT, 1);
  // 팔/집게
  for (const sgn of [-1, 1]) {
    c.save(); c.translate(sgn * 30, 6); c.rotate(sgn * (0.3 + Math.sin(o.t * 3) * 0.15 + (o.pattern === 'cone' ? tele * 0.8 : 0)));
    rrect(c, -6, -5, 16, 10, 3, p2 ? '#a34ca3' : '#7a5a7c', OUT, 1.5);
    poly(c, [10, -6, 20, -2, 12, 0, 20, 2, 10, 6], '#d0d0d0', OUT, 1.2);
    c.restore();
  }
  // 소환 예고: 상단 불빛
  if (o.pattern === 'summon') circle(c, 0, -30, 5, Math.sin(o.t * 20) > 0 ? '#fff35a' : '#ff3b3b', OUT, 1);
}

export function drawChest(c: Ctx, kind: 'chest' | 'safe', opened: boolean, t: number): void {
  circle(c, 0, 10, 12, 'rgba(0,0,0,0.3)');
  if (kind === 'chest') {
    rrect(c, -13, -6, 26, 18, 3, opened ? '#4a3a2a' : '#8a5a34', OUT, 1.5);
    rrect(c, -13, -6, 26, 6, 3, opened ? '#3a2d20' : '#a8703f', OUT, 1.2);
    rrect(c, -14, -1, 28, 3, 1, '#c8c8c8', OUT, 1);
    rrect(c, -3, -3, 6, 7, 1.5, opened ? '#333' : '#e9c46a', OUT, 1);
    if (opened) { c.strokeStyle = '#000'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-10, 4); c.lineTo(10, 8); c.stroke(); }
  } else {
    rrect(c, -14, -10, 28, 24, 4, opened ? '#2a3a2a' : '#2f5c3f', OUT, 2);
    rrect(c, -11, -7, 22, 18, 2, opened ? '#1e2a1e' : '#3f7a52', '#1a2a1a', 1);
    circle(c, 0, 2, 5, '#c8c8c8', OUT, 1.2); c.strokeStyle = '#333'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 2); c.lineTo(Math.cos(t * 2) * 4, 2 + Math.sin(t * 2) * 4); c.stroke();
    const al = !opened && Math.sin(t * 5) > 0;
    circle(c, 0, -13, 3.5, al ? '#ff3b3b' : '#5a1a1a', OUT, 1);
    if (al) { c.save(); c.globalAlpha = 0.25; circle(c, 0, -13, 8, '#ff3b3b'); c.restore(); }
  }
}

export function drawLoot(c: Ctx, type: LootId, t: number, count = 1): void {
  const bob = Math.sin(t * 3 + count) * 1.5; c.save(); c.translate(0, bob);
  circle(c, 0, 8 - bob, 7, 'rgba(0,0,0,0.25)');
  if (type === 'scrap') { poly(c, [-7, -4, 3, -8, 8, 0, 4, 7, -6, 5], LOOT.scrap.color, OUT, 1.4); circle(c, 0, 0, 2.5, '#5a4630', OUT, 1); }
  else if (type === 'parts') { rrect(c, -7, -5, 14, 10, 2, LOOT.parts.color, OUT, 1.4); rrect(c, -3, -2, 6, 4, 1, '#1a3a40'); c.strokeStyle = '#1a3a40'; c.lineWidth = 1.2; c.beginPath(); for (let i = -1; i <= 1; i++) { c.moveTo(i * 4, -5); c.lineTo(i * 4, -8); c.moveTo(i * 4, 5); c.lineTo(i * 4, 8); } c.stroke(); }
  else { c.save(); c.shadowColor = '#ffe680'; c.shadowBlur = 10 + Math.sin(t * 4) * 4; poly(c, [0, -9, 8, -2, 5, 8, -5, 8, -8, -2], LOOT.relic.color, OUT, 1.5); c.restore(); poly(c, [0, -6, 4, -2, 0, 0, -4, -2], '#fff8d6'); }
  c.restore();
  if (count > 1) { c.font = 'bold 10px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2.5; c.textAlign = 'center'; c.strokeText(`×${count}`, 9, 12); c.fillText(`×${count}`, 9, 12); }
}

export function drawDrone(c: Ctx, t: number, used: boolean): void {
  const hov = Math.sin(t * 4) * 3; circle(c, 0, 14, 9, 'rgba(0,0,0,0.25)');
  c.save(); c.translate(0, hov - 6);
  for (const sx of [-1, 1]) { c.strokeStyle = '#9ab'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(sx * 11, -6, 7, 2, 0, 0, Math.PI * 2); c.stroke(); }
  rrect(c, -10, -4, 20, 12, 5, used ? '#556' : '#8fb3c7', OUT, 1.5);
  circle(c, -3, 1, 2.5, used ? '#333' : '#5ad0e0'); circle(c, 3, 1, 2.5, used ? '#333' : '#5ad0e0');
  c.save(); c.translate(0, 9); c.rotate(Math.sin(t * 3) * 0.3); rrect(c, -1.5, 0, 3, 8, 1, '#ccc', OUT, 1); circle(c, 0, 9, 3, '#ccc', OUT, 1); c.restore();
  c.restore();
}

export function drawExitPad(c: Ctx, r: number, final: boolean, active: boolean, t: number): void {
  const col = final ? '#e9c46a' : '#6ee7a0';
  c.save(); c.globalAlpha = active ? 0.9 : 0.35;
  circle(c, 0, 0, r, final ? 'rgba(233,196,106,0.12)' : 'rgba(110,231,160,0.12)', col, 2);
  c.setLineDash([12, 8]); c.lineDashOffset = -t * 30; c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r - 8, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  if (active) { const pr = ((t * 0.6) % 1) * r; c.globalAlpha = 0.5 * (1 - pr / r); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, pr, 0, Math.PI * 2); c.stroke(); }
  c.globalAlpha = active ? 1 : 0.5;
  c.fillStyle = col; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText(final ? '최종 출구' : '탈출 지점', 0, r - 16);
  c.restore();
}

export function drawDoor(c: Ctx, open: boolean, t: number): void {
  rrect(c, -16, -16, 32, 32, 3, open ? '#1a2a1a' : '#2a2f3a', OUT, 2);
  if (open) { c.save(); c.globalAlpha = 0.5 + Math.sin(t * 4) * 0.2; rrect(c, -12, -12, 24, 24, 2, '#6ee7a0'); c.restore(); c.fillStyle = '#062'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('출구', 0, 4); }
  else { c.strokeStyle = '#4a5060'; c.lineWidth = 3; c.beginPath(); c.moveTo(-16, -6); c.lineTo(16, -6); c.moveTo(-16, 6); c.lineTo(16, 6); c.stroke(); c.fillStyle = '#7d8aa4'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('잠김', 0, 4); }
}

/** UI용 아이콘 캔버스 */
export function iconCanvas(kind: 'player' | EnemyType | LootId | 'chest' | 'safe' | 'drone' | WeaponId, size = 64, extra: any = {}): HTMLCanvasElement {
  const cv = document.createElement('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px';
  const c = cv.getContext('2d')!; c.scale(dpr, dpr); c.translate(size / 2, size / 2); c.lineJoin = 'round'; c.lineCap = 'round';
  const sc = kind === 'boss' ? size / 90 : size / 48; c.scale(sc, sc);
  if (kind === 'player') drawPlayer(c, { aimA: 0, walk: 0, moving: false, weapon: extra.weapon || 'rifle', tier: extra.tier || 0, weightRatio: 0.3, dashing: false, hurt: 0, invuln: false, recoil: 0, t: 0, hpRatio: 1 });
  else if (kind === 'rifle' || kind === 'shotgun' || kind === 'staff') { c.scale(1.3, 1.3); drawWeapon(c, kind, extra.tier || 0, 0, 0); }
  else if (kind === 'scrap' || kind === 'parts' || kind === 'relic') { c.scale(1.6, 1.6); drawLoot(c, kind, 0); }
  else if (kind === 'chest' || kind === 'safe') drawChest(c, kind, false, 0);
  else if (kind === 'drone') drawDrone(c, 0, false);
  else drawEnemy(c, { type: kind, state: 'chase', stateT: 0, windup: 1, faceA: 0, flash: 0, hpRatio: 1, slow: false, t: 0, phase: 1, pattern: 'idle' });
  return cv;
}
