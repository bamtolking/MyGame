// 절차적 벡터 그래픽: 장비 12종, 적 5종, 보스, 캐릭터. 외부 자산 없음.
import { EQUIPMENT, type EquipId, type Grade } from '../data/equipment';
import type { EnemyType } from '../data/enemies';
import type { Cell } from '../data/equipment';

type Ctx = CanvasRenderingContext2D;

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr); ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath();
}

export const GRADE_COLORS: Record<Grade, string> = { 1: '#b0bec5', 2: '#64b5f6', 3: '#ffca28' };

/** 장비 본체: 점유 칸들을 하나의 물건처럼 그린다. cells는 (0,0) 기준 상대 좌표, cs=칸 크기. */
export function drawItemBody(ctx: Ctx, id: EquipId, grade: Grade, cells: readonly Cell[], cs: number, opts: { alpha?: number; lift?: boolean; highlight?: boolean; invalid?: boolean; inactive?: boolean } = {}): void {
  const def = EQUIPMENT[id];
  const inset = Math.max(2, cs * 0.06);
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  if (opts.lift) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = cs * 0.3; ctx.shadowOffsetY = cs * 0.12; }
  const set = new Set(cells.map(c => c[0] + ',' + c[1]));
  // 본체 (칸 + 이음새)
  ctx.fillStyle = opts.invalid ? '#8e2f2f' : def.color;
  for (const [x, y] of cells) {
    roundRect(ctx, x * cs + inset, y * cs + inset, cs - inset * 2, cs - inset * 2, cs * 0.18); ctx.fill();
    if (set.has((x + 1) + ',' + y)) { ctx.fillRect(x * cs + cs - inset - 1, y * cs + inset + cs * 0.12, inset * 2 + 2, cs - inset * 2 - cs * 0.24); }
    if (set.has(x + ',' + (y + 1))) { ctx.fillRect(x * cs + inset + cs * 0.12, y * cs + cs - inset - 1, cs - inset * 2 - cs * 0.24, inset * 2 + 2); }
  }
  ctx.shadowColor = 'transparent';
  // 안쪽 질감: 종류별 패턴
  ctx.save();
  ctx.globalAlpha *= 0.18; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  for (const [x, y] of cells) {
    const px = x * cs, py = y * cs;
    if (def.kind === 'weapon') { ctx.beginPath(); ctx.moveTo(px + cs * 0.2, py + cs * 0.8); ctx.lineTo(px + cs * 0.8, py + cs * 0.2); ctx.stroke(); }
    else if (def.kind === 'support') { ctx.beginPath(); ctx.arc(px + cs / 2, py + cs / 2, cs * 0.3, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.strokeRect(px + cs * 0.25, py + cs * 0.25, cs * 0.5, cs * 0.5); }
  }
  ctx.restore();
  // 테두리 (등급별)
  ctx.lineWidth = grade === 3 ? 3 : grade === 2 ? 2.2 : 1.5;
  ctx.strokeStyle = opts.invalid ? '#ff5252' : opts.highlight ? '#ffffff' : GRADE_COLORS[grade];
  if (grade === 3 && !opts.invalid) { ctx.shadowColor = '#ffca28'; ctx.shadowBlur = cs * 0.25; }
  for (const [x, y] of cells) {
    // 바깥 변만 그리기
    const px = x * cs + inset, py = y * cs + inset, s = cs - inset * 2;
    ctx.beginPath();
    if (!set.has(x + ',' + (y - 1))) { ctx.moveTo(px, py); ctx.lineTo(px + s, py); }
    if (!set.has((x + 1) + ',' + y)) { ctx.moveTo(px + s, py); ctx.lineTo(px + s, py + s); }
    if (!set.has(x + ',' + (y + 1))) { ctx.moveTo(px, py + s); ctx.lineTo(px + s, py + s); }
    if (!set.has((x - 1) + ',' + y)) { ctx.moveTo(px, py); ctx.lineTo(px, py + s); }
    ctx.stroke();
  }
  ctx.shadowColor = 'transparent';
  // 아이콘: 첫 칸(기준 칸)에 그리되 셀이 여러 개면 무게중심에 가장 가까운 칸
  let cx = 0, cy = 0; for (const [x, y] of cells) { cx += x; cy += y; } cx /= cells.length; cy /= cells.length;
  let best = cells[0], bd = Infinity; for (const c of cells) { const d = (c[0] - cx) ** 2 + (c[1] - cy) ** 2; if (d < bd) { bd = d; best = c; } }
  ctx.save(); ctx.translate(best[0] * cs + cs / 2, best[1] * cs + cs / 2);
  if (opts.inactive) ctx.globalAlpha *= 0.5;
  drawEquipIcon(ctx, id, grade, cs * 0.78);
  ctx.restore();
  // 등급 점
  const gx = best[0] * cs + cs - inset - 3, gy = best[1] * cs + inset + 3;
  for (let i = 0; i < grade; i++) { ctx.fillStyle = GRADE_COLORS[grade]; ctx.beginPath(); ctx.arc(gx - i * 5, gy + 1, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/** 장비 아이콘 (중심 0,0, 크기 s). */
export function drawEquipIcon(ctx: Ctx, id: EquipId, grade: Grade, s: number): void {
  const def = EQUIPMENT[id]; const a = def.accent; const u = s / 2;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (id) {
    case 'dagger': {
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#e0e0e0'; ctx.beginPath(); ctx.moveTo(0, -u * 0.95); ctx.lineTo(u * 0.28, u * 0.15); ctx.lineTo(-u * 0.28, u * 0.15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { const y = -u * 0.7 + i * u * 0.2; ctx.beginPath(); ctx.moveTo(u * (0.06 + i * 0.05), y); ctx.lineTo(u * (0.14 + i * 0.05), y + u * 0.08); ctx.stroke(); }
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-u * 0.12, u * 0.15, u * 0.24, u * 0.6); ctx.fillStyle = '#ffb300'; ctx.fillRect(-u * 0.34, u * 0.12, u * 0.68, u * 0.1);
      break;
    }
    case 'mg': {
      ctx.rotate(-Math.PI / 8);
      ctx.fillStyle = '#37474f'; roundRect(ctx, -u * 0.9, -u * 0.18, u * 1.8, u * 0.36, u * 0.1); ctx.fill();
      ctx.fillStyle = a; ctx.fillRect(u * 0.55, -u * 0.1, u * 0.4, u * 0.2);
      if (grade >= 3) { ctx.fillStyle = '#37474f'; roundRect(ctx, -u * 0.6, -u * 0.36, u * 1.5, u * 0.16, u * 0.05); ctx.fill(); }
      ctx.fillStyle = '#263238'; roundRect(ctx, -u * 0.3, u * 0.15, u * 0.32, u * 0.55, u * 0.06); ctx.fill();
      ctx.fillStyle = '#546e7a'; roundRect(ctx, -u * 0.95, u * 0.1, u * 0.35, u * 0.4, u * 0.08); ctx.fill();
      if (grade >= 2) { ctx.strokeStyle = a; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-u * 0.5, -u * 0.05); ctx.lineTo(u * 0.4, -u * 0.05); ctx.stroke(); }
      break;
    }
    case 'shotgun': {
      ctx.rotate(-Math.PI / 12);
      ctx.fillStyle = '#4e342e'; roundRect(ctx, -u * 0.95, -u * 0.12, u * 0.6, u * 0.4, u * 0.08); ctx.fill();
      ctx.fillStyle = '#455a64'; roundRect(ctx, -u * 0.4, -u * 0.22, u * 1.35, u * 0.18, u * 0.06); ctx.fill(); roundRect(ctx, -u * 0.4, u * 0.02, u * 1.35, u * 0.18, u * 0.06); ctx.fill();
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(u * 0.95, -u * 0.13, u * 0.07, 0, 7); ctx.arc(u * 0.95, u * 0.11, u * 0.07, 0, 7); ctx.fill();
      if (grade >= 2) { ctx.fillStyle = '#ffab91'; ctx.fillRect(-u * 0.2, -u * 0.32, u * 0.5, u * 0.08); }
      break;
    }
    case 'laser': {
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#3949ab'; roundRect(ctx, -u * 0.9, -u * 0.26, u * 1.5, u * 0.52, u * 0.12); ctx.fill();
      ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(u * 0.5, -u * 0.3); ctx.lineTo(u * 0.98, 0); ctx.lineTo(u * 0.5, u * 0.3); ctx.closePath(); ctx.fill();
      const g = ctx.createLinearGradient(-u * 0.8, 0, u * 0.5, 0); g.addColorStop(0, 'rgba(128,222,234,0.1)'); g.addColorStop(1, a);
      ctx.fillStyle = g; ctx.fillRect(-u * 0.75, -u * (0.06 + grade * 0.03), u * 1.25, u * (0.12 + grade * 0.06));
      ctx.strokeStyle = '#1a237e'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-u * 0.7 + i * u * 0.3, -u * 0.26); ctx.lineTo(-u * 0.7 + i * u * 0.3, u * 0.26); ctx.stroke(); }
      break;
    }
    case 'bomb': {
      ctx.fillStyle = '#4e342e'; roundRect(ctx, -u * 0.35, -u * 0.2, u * 0.7, u * 1.0, u * 0.1); ctx.fill();
      ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.ellipse(0, -u * 0.2, u * 0.35, u * 0.14, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(0, -u * 0.45, u * 0.32, 0, 7); ctx.fill();
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(-u * 0.1, -u * 0.55, u * 0.09, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffcc80'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(u * 0.1, -u * 0.7); ctx.quadraticCurveTo(u * 0.3, -u * 0.95, u * 0.45, -u * 0.8); ctx.stroke();
      if (grade >= 3) { ctx.fillStyle = a; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-u * 0.5 + i * u * 0.5, u * 0.9, u * 0.07, 0, 7); ctx.fill(); } }
      break;
    }
    case 'drone': {
      ctx.fillStyle = '#006064'; roundRect(ctx, -u * 0.8, u * 0.1, u * 1.6, u * 0.5, u * 0.15); ctx.fill();
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(0, u * 0.1, u * 0.45, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = a; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -u * 0.35); ctx.lineTo(0, -u * 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -u * 0.85, u * 0.08, 0, 7); ctx.fill();
      const n = grade; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * u * 0.45; ctx.fillStyle = '#4dd0e1'; ctx.beginPath(); ctx.arc(x, u * 0.35, u * 0.12, 0, 7); ctx.fill(); ctx.strokeStyle = '#e0f7fa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - u * 0.2, u * 0.22); ctx.lineTo(x + u * 0.2, u * 0.22); ctx.stroke(); }
      break;
    }
    case 'battery': {
      ctx.fillStyle = '#f57f17'; roundRect(ctx, -u * 0.4, -u * 0.7, u * 0.8, u * 1.5, u * 0.12); ctx.fill();
      ctx.fillStyle = '#bdbdbd'; ctx.fillRect(-u * 0.18, -u * 0.85, u * 0.36, u * 0.18);
      ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(u * 0.1, -u * 0.5); ctx.lineTo(-u * 0.22, u * 0.05); ctx.lineTo(u * 0.02, u * 0.05); ctx.lineTo(-u * 0.1, u * 0.55); ctx.lineTo(u * 0.24, -u * 0.08); ctx.lineTo(0, -u * 0.08); ctx.closePath(); ctx.fill();
      for (let i = 0; i < grade; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(-u * 0.32, u * 0.62 - i * u * 0.16, u * 0.64, u * 0.06); }
      break;
    }
    case 'cooler': {
      ctx.fillStyle = '#006978'; roundRect(ctx, -u * 0.8, -u * 0.8, u * 1.6, u * 1.6, u * 0.2); ctx.fill();
      ctx.fillStyle = '#00acc1'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate((i / 3) * Math.PI * 2); ctx.beginPath(); ctx.ellipse(0, -u * 0.35, u * 0.18, u * 0.38, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(0, 0, u * 0.16, 0, 7); ctx.fill();
      ctx.strokeStyle = a; ctx.lineWidth = 1.5; for (let i = 0; i < grade + 1; i++) { ctx.beginPath(); ctx.moveTo(-u * 0.7, u * 0.5 + i * u * 0.1); ctx.lineTo(u * 0.7, u * 0.5 + i * u * 0.1); ctx.stroke(); }
      break;
    }
    case 'ammo': {
      ctx.fillStyle = '#5d6a1e'; roundRect(ctx, -u * 0.8, -u * 0.5, u * 1.6, u * 1.2, u * 0.12); ctx.fill();
      ctx.fillStyle = '#9e9d24'; ctx.fillRect(-u * 0.8, -u * 0.5, u * 1.6, u * 0.22);
      ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-u * 0.8, u * 0.2); ctx.lineTo(u * 0.8, u * 0.2); ctx.stroke();
      const n = 2 + grade; for (let i = 0; i < n; i++) { const x = -u * 0.5 + (i / (n - 1)) * u * 1.0; ctx.fillStyle = '#ffca28'; roundRect(ctx, x - u * 0.09, -u * 0.85, u * 0.18, u * 0.45, u * 0.08); ctx.fill(); ctx.fillStyle = '#ff8f00'; ctx.beginPath(); ctx.arc(x, -u * 0.85, u * 0.09, Math.PI, 0); ctx.fill(); }
      break;
    }
    case 'lens': {
      ctx.fillStyle = '#4527a0'; ctx.beginPath(); ctx.arc(0, 0, u * 0.85, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(-u * 0.2, -u * 0.2, u * 0.05, 0, 0, u * 0.7); g.addColorStop(0, '#fff'); g.addColorStop(0.4, a); g.addColorStop(1, '#7e57c2');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, u * 0.65, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; for (let i = 0; i < grade; i++) { ctx.beginPath(); ctx.arc(0, 0, u * (0.25 + i * 0.15), 0, 7); ctx.stroke(); }
      break;
    }
    case 'shield': {
      ctx.fillStyle = '#37474f'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(ang) * u * 0.9, Math.sin(ang) * u * 0.9); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#607d8b'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(ang) * u * 0.65, Math.sin(ang) * u * 0.65); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(0, -u * 0.4); ctx.lineTo(u * 0.3, -u * 0.2); ctx.lineTo(u * 0.25, u * 0.2); ctx.lineTo(0, u * 0.42); ctx.lineTo(-u * 0.25, u * 0.2); ctx.lineTo(-u * 0.3, -u * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#cfd8dc'; for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2 + Math.PI / 6; ctx.beginPath(); ctx.arc(Math.cos(ang) * u * 0.75, Math.sin(ang) * u * 0.75, u * 0.06, 0, 7); ctx.fill(); }
      if (grade >= 2) { ctx.strokeStyle = '#fff'; ctx.lineWidth = grade; ctx.beginPath(); ctx.moveTo(-u * 0.1, 0); ctx.lineTo(u * 0.1, 0); ctx.stroke(); }
      break;
    }
    case 'medkit': {
      ctx.fillStyle = '#b71c1c'; roundRect(ctx, -u * 0.8, -u * 0.55, u * 1.6, u * 1.2, u * 0.15); ctx.fill();
      ctx.fillStyle = '#e53935'; ctx.fillRect(-u * 0.3, -u * 0.75, u * 0.6, u * 0.22);
      ctx.fillStyle = a; ctx.fillRect(-u * 0.14, -u * 0.4, u * 0.28, u * 0.9); ctx.fillRect(-u * 0.45, -u * 0.09, u * 0.9, u * 0.28);
      for (let i = 1; i < grade; i++) { ctx.fillStyle = '#ffcdd2'; ctx.beginPath(); ctx.arc(-u * 0.6 + i * u * 0.35 - u * 0.35, u * 0.5, u * 0.07, 0, 7); ctx.fill(); }
      break;
    }
  }
  ctx.restore();
}

// ---------- 캐릭터 ----------
export function drawPlayer(ctx: Ctx, x: number, y: number, r: number, t: number, o: { hit: number; pulse: number; facing: number; protect: number; shield: number; win?: boolean; dead?: boolean }): void {
  ctx.save(); ctx.translate(x, y);
  const bob = o.win ? Math.abs(Math.sin(t * 8)) * -6 : Math.sin(t * 3) * 1.5;
  const recoil = o.pulse > 0 ? o.pulse * 20 : 0;
  ctx.translate(-Math.cos(o.facing) * recoil, -Math.sin(o.facing) * recoil + bob);
  if (o.dead) ctx.rotate(Math.PI / 2 * 0.6);
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 1.15 - bob, r * 1.1, r * 0.4, 0, 0, 7); ctx.fill();
  // 가방
  ctx.fillStyle = '#6d4c41'; roundRect(ctx, -r * 1.05, -r * 0.5, r * 0.7, r * 1.1, 4); ctx.fill();
  ctx.fillStyle = '#8d6e63'; roundRect(ctx, -r * 1.0, -r * 0.35, r * 0.6, r * 0.35, 3); ctx.fill();
  // 몸
  ctx.fillStyle = '#ff8f00'; roundRect(ctx, -r * 0.55, -r * 0.3, r * 1.1, r * 1.1, r * 0.3); ctx.fill();
  ctx.fillStyle = '#ffb74d'; roundRect(ctx, -r * 0.3, 0, r * 0.6, r * 0.6, 3); ctx.fill();
  // 머리
  ctx.fillStyle = o.hit > 0 ? '#ffcdd2' : '#ffe0b2'; ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.62, 0, 7); ctx.fill();
  ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(0, -r * 0.85, r * 0.62, Math.PI, 0); ctx.fill();
  // 고글
  ctx.fillStyle = '#263238'; roundRect(ctx, -r * 0.55, -r * 0.8, r * 1.1, r * 0.32, 3); ctx.fill();
  ctx.fillStyle = '#80deea'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.64, r * 0.13, 0, 7); ctx.arc(r * 0.25, -r * 0.64, r * 0.13, 0, 7); ctx.fill();
  // 입
  ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.5; ctx.beginPath(); if (o.win) ctx.arc(0, -r * 0.4, r * 0.18, 0, Math.PI); else if (o.hit > 0) ctx.arc(0, -r * 0.3, r * 0.12, Math.PI, 0); else { ctx.moveTo(-r * 0.12, -r * 0.4); ctx.lineTo(r * 0.12, -r * 0.4); } ctx.stroke();
  // 보호막 / 보호
  if (o.shield > 0) { ctx.strokeStyle = 'rgba(144,202,249,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 1.7, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(144,202,249,0.12)'; ctx.fill(); }
  if (o.protect > 0) { ctx.strokeStyle = `rgba(255,241,118,${0.5 + 0.4 * Math.sin(t * 20)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 2.0, 0, 7); ctx.stroke(); }
  ctx.restore();
}

// ---------- 적 ----------
export function drawEnemy(ctx: Ctx, type: EnemyType, x: number, y: number, r: number, t: number, o: { hit: number; facing: number; hpRatio: number; fuse: number; phase?: number; stun?: number; telegraph?: number }): void {
  ctx.save(); ctx.translate(x, y);
  const flash = o.hit > 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 1.0, r * 0.35, 0, 0, 7); ctx.fill();
  switch (type) {
    case 'basic': {
      const wob = Math.sin(t * 6 + x) * 2;
      ctx.rotate(wob * 0.03);
      ctx.fillStyle = flash ? '#fff' : '#9e9e9e'; roundRect(ctx, -r * 0.8, -r * 1.0, r * 1.6, r * 1.9, r * 0.2); ctx.fill();
      ctx.fillStyle = '#757575'; ctx.fillRect(-r * 0.8, -r * 0.5, r * 1.6, r * 0.12); ctx.fillRect(-r * 0.8, r * 0.3, r * 1.6, r * 0.12);
      ctx.fillStyle = '#bf360c'; ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.1, r * 0.22, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(-r * 0.45, r * 0.55, r * 0.15, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.55, r * 0.22, 0, 7); ctx.arc(r * 0.3, -r * 0.55, r * 0.22, 0, 7); ctx.fill();
      ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(-r * 0.3 + Math.cos(o.facing) * 3, -r * 0.55 + Math.sin(o.facing) * 3, r * 0.1, 0, 7); ctx.arc(r * 0.3 + Math.cos(o.facing) * 3, -r * 0.55 + Math.sin(o.facing) * 3, r * 0.1, 0, 7); ctx.fill();
      ctx.strokeStyle = '#616161'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.9); ctx.lineTo(-r * 0.6 + Math.sin(t * 12) * 3, r * 1.4); ctx.moveTo(r * 0.4, r * 0.9); ctx.lineTo(r * 0.6 - Math.sin(t * 12) * 3, r * 1.4); ctx.stroke();
      break;
    }
    case 'rusher': {
      ctx.rotate(o.facing);
      ctx.fillStyle = flash ? '#fff' : '#e65100'; roundRect(ctx, -r * 0.9, -r * 0.55, r * 1.8, r * 1.1, r * 0.3); ctx.fill();
      ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(-r * 0.45, r * 0.5, r * 0.4, 0, 7); ctx.arc(r * 0.45, r * 0.5, r * 0.4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 2; for (const cx of [-r * 0.45, r * 0.45]) { ctx.beginPath(); ctx.moveTo(cx + Math.cos(t * 25) * r * 0.3, r * 0.5 + Math.sin(t * 25) * r * 0.3); ctx.lineTo(cx - Math.cos(t * 25) * r * 0.3, r * 0.5 - Math.sin(t * 25) * r * 0.3); ctx.stroke(); }
      ctx.fillStyle = '#ffe0b2'; ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.15, r * 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3e0'; ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.lineTo(r * 1.3, -r * 0.3); ctx.lineTo(r * 1.3, r * 0.3); ctx.closePath(); ctx.fill();
      break;
    }
    case 'swarm': {
      ctx.rotate(o.facing + Math.PI / 2);
      ctx.fillStyle = flash ? '#fff' : '#7cb342'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r * 1.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#33691e'; ctx.beginPath(); ctx.arc(0, -r * 0.7, r * 0.45, 0, 7); ctx.fill();
      ctx.strokeStyle = '#33691e'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { const ph = Math.sin(t * 20 + i) * 3; ctx.beginPath(); ctx.moveTo(-r * 0.7, i * r * 0.4); ctx.lineTo(-r * 1.3, i * r * 0.5 + ph); ctx.moveTo(r * 0.7, i * r * 0.4); ctx.lineTo(r * 1.3, i * r * 0.5 - ph); ctx.stroke(); }
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.8, r * 0.12, 0, 7); ctx.arc(r * 0.2, -r * 0.8, r * 0.12, 0, 7); ctx.fill();
      break;
    }
    case 'armored': {
      ctx.fillStyle = '#263238'; roundRect(ctx, -r * 1.05, r * 0.2, r * 2.1, r * 0.75, r * 0.2); ctx.fill();
      ctx.fillStyle = '#546e7a'; for (let i = 0; i < 5; i++) { const off = ((t * 40 + i * r * 0.42) % (r * 2.1)); ctx.fillRect(-r * 1.05 + off, r * 0.3, r * 0.2, r * 0.55); }
      ctx.fillStyle = flash ? '#fff' : '#607d8b'; roundRect(ctx, -r * 0.95, -r * 0.9, r * 1.9, r * 1.3, r * 0.15); ctx.fill();
      ctx.fillStyle = '#90a4ae'; roundRect(ctx, -r * 0.7, -r * 0.7, r * 1.4, r * 0.4, r * 0.1); ctx.fill();
      ctx.fillStyle = '#b0bec5'; for (const [bx, by] of [[-0.8, -0.75], [0.7, -0.75], [-0.8, 0.2], [0.7, 0.2]]) { ctx.beginPath(); ctx.arc(bx * r, by * r, r * 0.09, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.18, 0, 7); ctx.fill();
      ctx.save(); ctx.rotate(o.facing); ctx.fillStyle = '#37474f'; ctx.fillRect(0, -r * 0.12, r * 1.2, r * 0.24); ctx.restore();
      break;
    }
    case 'bomber': {
      const fusing = o.fuse >= 0;
      const blink = fusing && Math.floor(t * 12) % 2 === 0;
      ctx.fillStyle = flash || blink ? '#fff' : '#d32f2f'; roundRect(ctx, -r * 0.7, -r * 0.9, r * 1.4, r * 1.8, r * 0.3); ctx.fill();
      ctx.fillStyle = '#b71c1c'; ctx.fillRect(-r * 0.7, -r * 0.1, r * 1.4, r * 0.3);
      ctx.fillStyle = '#ffeb3b'; ctx.font = `bold ${r * 1.0}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, r * 0.05);
      ctx.fillStyle = '#9e9e9e'; ctx.fillRect(-r * 0.2, -r * 1.15, r * 0.4, r * 0.3);
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * 1.15); ctx.quadraticCurveTo(r * 0.3, -r * 1.5, r * 0.5, -r * 1.35); ctx.stroke();
      if (fusing) { ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(r * 0.5 + Math.random() * 3, -r * 1.35 + Math.random() * 3, r * 0.2, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#424242'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.9); ctx.lineTo(-r * 0.5, r * 1.3 + Math.sin(t * 18) * 2); ctx.moveTo(r * 0.4, r * 0.9); ctx.lineTo(r * 0.5, r * 1.3 - Math.sin(t * 18) * 2); ctx.stroke();
      break;
    }
    case 'boss': drawBoss(ctx, r, t, o); break;
  }
  ctx.restore();
}

function drawBoss(ctx: Ctx, r: number, t: number, o: { hit: number; facing: number; hpRatio: number; phase?: number; stun?: number; telegraph?: number }): void {
  const ph = o.phase ?? 0; const flash = o.hit > 0;
  const shake = (o.stun ?? 0) > 0 ? Math.sin(t * 40) * 3 : 0;
  ctx.translate(shake, 0);
  // 궤도
  ctx.fillStyle = '#212121'; roundRect(ctx, -r * 1.1, r * 0.3, r * 2.2, r * 0.7, r * 0.2); ctx.fill();
  ctx.fillStyle = '#424242'; for (let i = 0; i < 7; i++) { const off = ((t * 30 + i * r * 0.32) % (r * 2.2)); ctx.fillRect(-r * 1.1 + off, r * 0.38, r * 0.16, r * 0.54); }
  // 본체 (호퍼)
  ctx.fillStyle = flash ? '#fff' : '#5d4037'; roundRect(ctx, -r * 1.0, -r * 0.7, r * 2.0, r * 1.1, r * 0.2); ctx.fill();
  ctx.fillStyle = '#4e342e'; ctx.beginPath(); ctx.moveTo(-r * 1.0, -r * 0.7); ctx.lineTo(-r * 0.8, -r * 1.2); ctx.lineTo(r * 0.8, -r * 1.2); ctx.lineTo(r * 1.0, -r * 0.7); ctx.closePath(); ctx.fill();
  // 장갑판 (구간이 지날수록 떨어져 나감)
  ctx.fillStyle = '#8d6e63'; if (ph < 1) { roundRect(ctx, -r * 0.95, -r * 0.6, r * 0.6, r * 0.9, r * 0.1); ctx.fill(); } if (ph < 2) { roundRect(ctx, r * 0.35, -r * 0.6, r * 0.6, r * 0.9, r * 0.1); ctx.fill(); }
  // 고철 더미
  const junk = ['#9e9e9e', '#ff8f00', '#78909c', '#bcaaa4']; for (let i = 0; i < 6; i++) { ctx.fillStyle = junk[i % 4]; ctx.fillRect(-r * 0.6 + i * r * 0.2, -r * 1.15 + Math.sin(t * 3 + i) * 2, r * 0.16, r * 0.16); }
  // 눈(램프)
  ctx.fillStyle = ph >= 2 ? '#ff1744' : ph >= 1 ? '#ff9100' : '#ffeb3b'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.35, r * 0.15, 0, 7); ctx.arc(r * 0.3, -r * 0.35, r * 0.15, 0, 7); ctx.fill();
  // 자석 크레인 팔
  ctx.save(); ctx.rotate(o.facing);
  ctx.strokeStyle = '#37474f'; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.1, -r * 0.4); ctx.lineTo(r * 1.5 + ((o.telegraph ?? 0) > 0 ? Math.sin(t * 30) * 4 : 0), 0); ctx.stroke();
  ctx.fillStyle = (o.telegraph ?? 0) > 0 ? '#ff1744' : '#ff8f00'; ctx.beginPath(); ctx.arc(r * 1.5, 0, r * 0.3, Math.PI, 0); ctx.fill(); ctx.fillRect(r * 1.2, 0, r * 0.6, r * 0.12);
  ctx.restore();
  // 굴뚝 연기
  ctx.fillStyle = 'rgba(120,120,120,0.35)'; for (let i = 0; i < 3; i++) { const k = ((t * 0.7 + i * 0.33) % 1); ctx.beginPath(); ctx.arc(-r * 0.7, -r * 1.3 - k * r * 0.8, r * 0.12 + k * r * 0.15, 0, 7); ctx.fill(); }
}
