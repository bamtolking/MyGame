// 절차적 스프라이트: 몸마다 실루엣이 다르게. 모두 +x 방향을 보는 기준으로 그리며 호출자가 회전시킨다.
import { BODIES } from '../data/bodies';
import type { BodyId, Entity } from '../sim/types';

export interface DrawOpts { controlled: boolean; t: number; guarding: boolean; sprinting: boolean; charging: boolean; stunned: boolean; collapsing: boolean; disabled: boolean; hitFlash: number; possessable: boolean; exposed: boolean; shielded: boolean }

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath(); }
function poly(ctx: CanvasRenderingContext2D, pts: number[][]): void { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }

/** 몸 본체 그리기(0,0 중심, +x 전방) */
export function drawBody(ctx: CanvasRenderingContext2D, body: BodyId, o: DrawOpts): void {
  const d = BODIES[body];
  const base = o.disabled ? '#4a5058' : d.color; const acc = o.disabled ? '#2f343a' : d.accent;
  const bob = Math.sin(o.t * 6) * 0.6;
  ctx.lineWidth = 2; ctx.lineJoin = 'round';
  switch (body) {
    case 'intruder': {
      // 슬림 캡슐 + 큰 코어 + 바이저
      ctx.fillStyle = acc; rr(ctx, -9, -7 + bob, 18, 14, 6); ctx.fill();
      ctx.fillStyle = base; rr(ctx, -7, -5 + bob, 14, 10, 5); ctx.fill();
      ctx.fillStyle = '#0a2a33'; rr(ctx, 1, -4 + bob, 7, 8, 3); ctx.fill();
      ctx.fillStyle = '#37e2ff'; rr(ctx, 3, -2.5 + bob, 4, 5, 2); ctx.fill();
      ctx.fillStyle = '#9ff4ff'; circle(ctx, -2, bob, 3.2); ctx.fill();
      break;
    }
    case 'scout': {
      // 쐐기(화살) 실루엣 + 뒤쪽 추진기 2개
      ctx.fillStyle = acc; poly(ctx, [[14, 0], [-10, -9], [-6, 0], [-10, 9]]); ctx.fill();
      ctx.fillStyle = base; poly(ctx, [[11, 0], [-7, -6], [-4, 0], [-7, 6]]); ctx.fill();
      ctx.fillStyle = '#2b3a00'; rr(ctx, -12, -10, 5, 5, 1.5); ctx.fill(); rr(ctx, -12, 5, 5, 5, 1.5); ctx.fill();
      if (o.sprinting) { ctx.strokeStyle = 'rgba(233,255,106,0.8)'; ctx.beginPath(); ctx.moveTo(-12, -7); ctx.lineTo(-26, -7); ctx.moveTo(-12, 7); ctx.lineTo(-26, 7); ctx.stroke(); }
      ctx.fillStyle = '#1a2400'; rr(ctx, 3, -2.5, 6, 5, 2); ctx.fill();
      ctx.fillStyle = o.controlled ? '#37e2ff' : '#ff5a5a'; rr(ctx, 4.5, -1.5, 3, 3, 1); ctx.fill();
      break;
    }
    case 'shield': {
      // 둥글고 무거운 몸체 + 넓은 전방 방패판
      ctx.fillStyle = acc; circle(ctx, -2, 0, 15); ctx.fill();
      ctx.fillStyle = base; circle(ctx, -2, 0, 11); ctx.fill();
      ctx.fillStyle = '#20284a'; rr(ctx, -8, -4, 8, 8, 2); ctx.fill();
      const ext = o.guarding ? 4 : 0; const arcW = o.guarding ? 24 : 18;
      ctx.fillStyle = '#c9d5ee'; rr(ctx, 6 + ext, -arcW, 8, arcW * 2, 4); ctx.fill();
      ctx.fillStyle = '#5f78b8'; rr(ctx, 8 + ext, -arcW + 3, 4, arcW * 2 - 6, 2); ctx.fill();
      if (o.guarding) { ctx.strokeStyle = 'rgba(160,200,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 24, -2.0, 2.0); ctx.stroke(); }
      ctx.fillStyle = o.controlled ? '#37e2ff' : '#ff5a5a'; rr(ctx, 1, -2, 4, 4, 1); ctx.fill();
      break;
    }
    case 'bomber': {
      // 둥근 몸 + 등 뒤 폭탄 통 2개 + 손에 든 폭탄 + 경고 줄무늬
      ctx.fillStyle = '#3a2a1a'; rr(ctx, -17, -11, 8, 9, 3); ctx.fill(); rr(ctx, -17, 2, 8, 9, 3); ctx.fill();
      ctx.fillStyle = acc; circle(ctx, 0, 0, 14); ctx.fill();
      ctx.fillStyle = base; circle(ctx, 0, 0, 10.5); ctx.fill();
      ctx.fillStyle = '#2a1a08'; ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(4, -10); ctx.lineTo(-2, 10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#222'; circle(ctx, 12, 6, 5); ctx.fill();
      ctx.fillStyle = Math.sin(o.t * 12) > 0 ? '#ffd23c' : '#ff6a3c'; circle(ctx, 14, 2, 1.6); ctx.fill();
      ctx.fillStyle = o.controlled ? '#37e2ff' : '#ff5a5a'; rr(ctx, 4, -3, 4, 4, 1); ctx.fill();
      break;
    }
    case 'sniper': {
      // 가늘고 긴 몸 + 긴 총열 + 스코프
      ctx.fillStyle = acc; rr(ctx, -10, -8, 16, 16, 6); ctx.fill();
      ctx.fillStyle = base; rr(ctx, -8, -6, 12, 12, 5); ctx.fill();
      ctx.fillStyle = '#2a1640'; rr(ctx, 2, -2.5, 36, 5, 2); ctx.fill();
      ctx.fillStyle = '#d8b8ff'; rr(ctx, 30, -1.5, 8, 3, 1); ctx.fill();
      ctx.fillStyle = '#12081e'; rr(ctx, 6, -7, 8, 4, 1.5); ctx.fill();
      if (o.charging) { ctx.fillStyle = '#ffffff'; circle(ctx, 38, 0, 2.5 + Math.sin(o.t * 30)); ctx.fill(); }
      ctx.fillStyle = o.controlled ? '#37e2ff' : '#ff5a5a'; rr(ctx, -4, -2, 4, 4, 1); ctx.fill();
      break;
    }
    case 'mechanic': {
      // 둥근 몸 + 코일 안테나 + 렌치 + 전기 점
      ctx.fillStyle = acc; circle(ctx, 0, 0, 13); ctx.fill();
      ctx.fillStyle = base; circle(ctx, 0, 0, 9.5); ctx.fill();
      ctx.strokeStyle = '#0b3d38'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4, -20); ctx.stroke();
      ctx.fillStyle = '#bfffff'; circle(ctx, -4, -21, 2.6 + Math.sin(o.t * 20) * 0.6); ctx.fill();
      ctx.strokeStyle = '#0b3d38'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(16, 12); ctx.stroke();
      ctx.fillStyle = '#0b3d38'; circle(ctx, 17, 13, 3.5); ctx.fill();
      for (let i = 0; i < 3; i++) { const a = o.t * 4 + (i * Math.PI * 2) / 3; ctx.fillStyle = 'rgba(191,255,255,0.8)'; circle(ctx, Math.cos(a) * 15, Math.sin(a) * 15, 1.6); ctx.fill(); }
      ctx.fillStyle = o.controlled ? '#37e2ff' : '#ff5a5a'; rr(ctx, 3, -2, 4, 4, 1); ctx.fill();
      break;
    }
    case 'turret': {
      ctx.fillStyle = '#3a4048'; poly(ctx, [[14, 0], [7, 12], [-7, 12], [-14, 0], [-7, -12], [7, -12]]); ctx.fill();
      ctx.fillStyle = base; poly(ctx, [[10, 0], [5, 9], [-5, 9], [-10, 0], [-5, -9], [5, -9]]); ctx.fill();
      ctx.fillStyle = '#2a2f36'; rr(ctx, 0, -3, 20, 6, 2); ctx.fill();
      ctx.fillStyle = o.disabled ? '#333' : Math.sin(o.t * 8) > 0 ? '#ff3b3b' : '#7a1a1a'; circle(ctx, -2, 0, 3); ctx.fill();
      break;
    }
    case 'node': {
      ctx.fillStyle = '#3d1f5c'; poly(ctx, [[13, 0], [6.5, 11], [-6.5, 11], [-13, 0], [-6.5, -11], [6.5, -11]]); ctx.fill();
      ctx.fillStyle = base; poly(ctx, [[8, 0], [4, 7], [-4, 7], [-8, 0], [-4, -7], [4, -7]]); ctx.fill();
      ctx.fillStyle = '#fff'; circle(ctx, 0, 0, 3 + Math.sin(o.t * 6)); ctx.fill();
      ctx.strokeStyle = 'rgba(233,198,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(o.t * 3) * 2, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'boss': {
      // 큰 팔각 코어 + 회전 링 + 눈
      const r = 40;
      ctx.fillStyle = '#3a0d14'; poly(ctx, Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * Math.PI * 2) * r, Math.sin((i / 8) * Math.PI * 2) * r])); ctx.fill();
      ctx.fillStyle = base; poly(ctx, Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * Math.PI * 2) * (r - 6), Math.sin((i / 8) * Math.PI * 2) * (r - 6)])); ctx.fill();
      ctx.strokeStyle = o.shielded ? 'rgba(181,108,255,0.95)' : '#ff8a8a'; ctx.lineWidth = o.shielded ? 4 : 3;
      for (let i = 0; i < 8; i++) { const a0 = o.t * 1.2 + (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(0, 0, r - 12, a0, a0 + 0.5); ctx.stroke(); }
      ctx.fillStyle = o.exposed ? '#ffb347' : '#14060a'; circle(ctx, 0, 0, o.exposed ? 16 + Math.sin(o.t * 16) * 2 : 14); ctx.fill();
      ctx.fillStyle = o.exposed ? '#fff3c4' : acc; circle(ctx, 4, 0, o.exposed ? 8 : 6); ctx.fill();
      if (o.shielded) { ctx.strokeStyle = 'rgba(181,108,255,0.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r + 8 + Math.sin(o.t * 5) * 2, 0, Math.PI * 2); ctx.stroke(); }
      break;
    }
  }
  if (o.hitFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, o.hitFlash * 5)})`; circle(ctx, 0, 0, d.radius + 4); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
}

const iconCache = new Map<string, string>();
/** HUD용 아이콘(데이터 URL) */
export function bodyIcon(body: BodyId, controlled = true, size = 44): string {
  const key = `${body}:${controlled}:${size}`; const c = iconCache.get(key); if (c) return c;
  const cv = document.createElement('canvas'); cv.width = size * 2; cv.height = size * 2;
  const ctx = cv.getContext('2d')!; ctx.scale(2, 2); ctx.translate(size / 2, size / 2);
  const s = body === 'boss' ? 0.45 : body === 'sniper' ? 0.8 : 1.15; ctx.scale(s, s); ctx.rotate(-Math.PI / 2);
  drawBody(ctx, body, { controlled, t: 1, guarding: false, sprinting: false, charging: false, stunned: false, collapsing: false, disabled: false, hitFlash: 0, possessable: false, exposed: false, shielded: false });
  const url = cv.toDataURL(); iconCache.set(key, url); return url;
}

export function entityOpts(e: Entity, time: number): DrawOpts {
  const d = BODIES[e.body];
  return {
    controlled: e.controlled, t: time + e.id * 0.37,
    guarding: e.skillUntil > time && d.skill?.id === 'guard',
    sprinting: e.skillUntil > time && d.skill?.id === 'sprint',
    charging: e.windup > 0,
    stunned: e.stunUntil > time, collapsing: e.collapsing, disabled: e.disabled, hitFlash: e.hitFlash,
    possessable: false, exposed: e.ai.exposedUntil > time, shielded: e.ai.shielded,
  };
}
