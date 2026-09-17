// 가방 화면 렌더러 (Canvas). 상태를 읽어 그리기만 하고 게임 상태는 바꾸지 않는다.
import { EQUIPMENT, type Cell } from '../data/equipment';
import { itemCells, checkPlacement, type Item, type BagGrid } from '../core/bag';
import { rotateCells, type Rot } from '../core/shapes';
import { computeLoadout, type Loadout } from '../core/loadout';
import { drawItemBody, roundRect, drawEquipIcon } from './sprites';

export interface Selection { uid: string; rot: Rot; ax: number | null; ay: number | null; moving: boolean; from: 'bag' | 'bench' }
export interface BagAnim { land?: { uid: string; t: number }; rotate?: { t: number }; merge?: { uid: string; t: number }; lift?: { t: number } }
export interface BagDrawState {
  grid: BagGrid; items: Item[]; sel: Selection | null; inspectUid: string | null;
  unlock: { chosen: number[]; need: number } | null; anim: BagAnim; loadout: Loadout; time: number;
}

const SUPPORT_COLORS: Record<string, string> = { battery: '#ffd54f', cooler: '#4dd0e1', ammo: '#dce775', lens: '#ce93d8' };

export class BagView {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  cs = 48; ox = 0; oy = 0; W = 0; H = 0; dpr = 1;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.ctx = canvas.getContext('2d')!; }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, Math.floor(r.width)); this.H = Math.max(1, Math.floor(r.height));
    this.canvas.width = Math.floor(this.W * this.dpr); this.canvas.height = Math.floor(this.H * this.dpr);
    const pad = 26;
    this.cs = Math.floor(Math.min((this.W - pad * 2) / 5, (this.H - pad * 2 - 10) / 5));
    this.ox = Math.floor((this.W - this.cs * 5) / 2); this.oy = Math.floor((this.H - this.cs * 5) / 2) + 4;
  }
  cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - r.left - this.ox) / this.cs), y = Math.floor((clientY - r.top - this.oy) / this.cs);
    if (x < 0 || y < 0 || x > 4 || y > 4) return null;
    return { x, y };
  }

  draw(s: BagDrawState): void {
    const ctx = this.ctx; const cs = this.cs; const g = s.grid;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    // ----- 가방 프레임 -----
    const fx = this.ox - 16, fy = this.oy - 14, fw = cs * 5 + 32, fh = cs * 5 + 30;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#5b3a29'; roundRect(ctx, fx, fy, fw, fh, 18); ctx.fill();
    ctx.restore();
    // 손잡이/어깨끈
    ctx.strokeStyle = '#4a2e20'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx + fw * 0.35, fy + 2); ctx.quadraticCurveTo(fx + fw * 0.5, fy - 14, fx + fw * 0.65, fy + 2); ctx.stroke();
    ctx.fillStyle = '#6d4c41'; roundRect(ctx, fx + 4, fy + 4, fw - 8, fh - 8, 14); ctx.fill();
    // 스티치
    ctx.strokeStyle = 'rgba(255,224,178,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); roundRect(ctx, fx + 8, fy + 8, fw - 16, fh - 16, 12); ctx.stroke(); ctx.setLineDash([]);
    // 버클
    ctx.fillStyle = '#c9a227'; roundRect(ctx, fx + fw - 30, fy + fh - 22, 20, 12, 3); ctx.fill(); ctx.fillStyle = '#8a6d1a'; ctx.fillRect(fx + fw - 24, fy + fh - 19, 8, 6);
    ctx.fillStyle = '#c9a227'; roundRect(ctx, fx + 10, fy + fh - 22, 20, 12, 3); ctx.fill(); ctx.fillStyle = '#8a6d1a'; ctx.fillRect(fx + 16, fy + fh - 19, 8, 6);
    // 안감
    ctx.fillStyle = '#2b2a3f'; roundRect(ctx, this.ox - 4, this.oy - 4, cs * 5 + 8, cs * 5 + 8, 8); ctx.fill();
    // ----- 칸 -----
    const occ = new Map<string, Item>();
    for (const it of s.items) if (it.loc === 'bag') for (const [x, y] of itemCells(it)) occ.set(x + ',' + y, it);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const px = this.ox + x * cs, py = this.oy + y * cs; const idx = y * 5 + x;
      const locked = g.locked[idx];
      ctx.fillStyle = locked ? '#1b1a26' : '#3a3852';
      roundRect(ctx, px + 1.5, py + 1.5, cs - 3, cs - 3, 5); ctx.fill();
      if (!locked) { ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 6, py + cs / 2); ctx.lineTo(px + cs - 6, py + cs / 2); ctx.moveTo(px + cs / 2, py + 6); ctx.lineTo(px + cs / 2, py + cs - 6); ctx.stroke(); }
      if (locked) {
        const chosen = s.unlock?.chosen.includes(idx);
        if (s.unlock) { ctx.strokeStyle = chosen ? '#ffca28' : 'rgba(255,202,40,0.5)'; ctx.lineWidth = chosen ? 3 : 1.5; ctx.setLineDash(chosen ? [] : [4, 3]); roundRect(ctx, px + 4, py + 4, cs - 8, cs - 8, 5); ctx.stroke(); ctx.setLineDash([]); }
        // 자물쇠
        ctx.save(); ctx.translate(px + cs / 2, py + cs / 2); const k = cs / 48;
        ctx.strokeStyle = chosen ? '#ffca28' : '#8a8898'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.arc(0, -4 * k, 7 * k, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = chosen ? '#ffca28' : '#8a8898'; roundRect(ctx, -10 * k, -4 * k, 20 * k, 15 * k, 3 * k); ctx.fill();
        ctx.fillStyle = '#1b1a26'; ctx.beginPath(); ctx.arc(0, 3 * k, 2.5 * k, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
    // ----- 장비 -----
    const selItem = s.sel ? s.items.find(i => i.uid === s.sel!.uid) : undefined;
    for (const it of s.items) {
      if (it.loc !== 'bag') continue;
      const isSel = s.sel?.uid === it.uid; const isInspect = s.inspectUid === it.uid;
      const cells = rotateCells(EQUIPMENT[it.id].shape, it.rot);
      let scale = 1;
      if (s.anim.land?.uid === it.uid) { const t = s.anim.land.t; scale = 1 + 0.18 * Math.sin(Math.min(1, t / 0.18) * Math.PI); }
      ctx.save(); ctx.translate(this.ox + it.x * cs, this.oy + it.y * cs);
      if (scale !== 1) { const b = cellsBounds(cells); ctx.translate((b.w * cs) / 2, (b.h * cs) / 2); ctx.scale(scale, scale); ctx.translate(-(b.w * cs) / 2, -(b.h * cs) / 2); }
      if (isSel && s.sel!.moving) { drawItemBody(ctx, it.id, it.grade, cells, cs, { alpha: 0.25 }); }
      else drawItemBody(ctx, it.id, it.grade, cells, cs, { highlight: isInspect, lift: isInspect });
      ctx.restore();
      if (s.anim.merge?.uid === it.uid) {
        const t = s.anim.merge.t; const b = cellsBounds(cells); const cx = this.ox + it.x * cs + (b.w * cs) / 2, cy = this.oy + it.y * cs + (b.h * cs) / 2;
        ctx.strokeStyle = `rgba(255,213,79,${Math.max(0, 1 - t / 0.5)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, cs * 0.4 + t * cs * 2.2, 0, 7); ctx.stroke();
      }
    }
    // ----- 연결 표시 (검사 중인 장비 또는 이동 미리보기 기준) -----
    const focusUid = s.inspectUid ?? (s.sel && s.sel.from === 'bag' && !s.sel.moving ? s.sel.uid : null);
    if (focusUid) this.drawLinks(s, focusUid, occ);
    // ----- 배치 미리보기 -----
    if (s.sel && s.sel.ax !== null && s.sel.ay !== null && selItem) {
      const rot = s.sel.rot;
      const chk = checkPlacement(g, s.items, selItem.id, rot, s.sel.ax, s.sel.ay, selItem.uid);
      const cells = rotateCells(EQUIPMENT[selItem.id].shape, rot);
      // 문제 칸 표시
      for (const c of chk.cells) {
        if (c.x < 0 || c.y < 0 || c.x > 4 || c.y > 4) continue;
        const px = this.ox + c.x * cs, py = this.oy + c.y * cs;
        ctx.fillStyle = c.problem ? 'rgba(255,82,82,0.45)' : 'rgba(102,187,106,0.35)';
        roundRect(ctx, px + 2, py + 2, cs - 4, cs - 4, 5); ctx.fill();
        if (c.problem) { ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + cs * 0.3, py + cs * 0.3); ctx.lineTo(px + cs * 0.7, py + cs * 0.7); ctx.moveTo(px + cs * 0.7, py + cs * 0.3); ctx.lineTo(px + cs * 0.3, py + cs * 0.7); ctx.stroke(); }
      }
      ctx.save();
      ctx.translate(this.ox + s.sel.ax * cs, this.oy + s.sel.ay * cs);
      if (s.anim.rotate) { const t = Math.min(1, s.anim.rotate.t / 0.12); const b = cellsBounds(cells); ctx.translate((b.w * cs) / 2, (b.h * cs) / 2); ctx.rotate(-(1 - t) * (Math.PI / 2)); ctx.scale(0.92 + 0.08 * t, 0.92 + 0.08 * t); ctx.translate(-(b.w * cs) / 2, -(b.h * cs) / 2); }
      const lift = 1 - Math.min(1, (s.anim.lift?.t ?? 1) / 0.15);
      ctx.translate(0, -4 - lift * 6);
      drawItemBody(ctx, selItem.id, selItem.grade, cells, cs, { alpha: 0.9, lift: true, invalid: !chk.ok, highlight: chk.ok });
      ctx.restore();
      // 미리보기 연결 (유효할 때)
      if (chk.ok) {
        const trial = s.items.map(i => (i.uid === selItem.uid ? { ...i, x: s.sel!.ax!, y: s.sel!.ay!, rot, loc: 'bag' as const } : i));
        const lo = computeLoadout(trial, g);
        const occ2 = new Map<string, Item>(); for (const it of trial) if (it.loc === 'bag') for (const [x, y] of itemCells(it)) occ2.set(x + ',' + y, it);
        this.drawLinks({ ...s, items: trial, loadout: lo }, selItem.uid, occ2, true);
      }
    }
  }

  /** 초점 장비와 인접 장비 사이의 지원 연결을 그린다. 적용된 연결은 색 선, 미적용은 회색 점선. */
  private drawLinks(s: BagDrawState, focusUid: string, occ: Map<string, Item>, preview = false): void {
    const ctx = this.ctx; const cs = this.cs; const lo = s.loadout;
    const focus = s.items.find(i => i.uid === focusUid); if (!focus || focus.loc !== 'bag') return;
    // 초점이 무기: 링크 목록. 초점이 지원: linkedTo/blockedFrom.
    const pairs: { other: string; applied: boolean; type: string }[] = [];
    const w = lo.weapons.find(x => x.uid === focusUid);
    if (w) for (const l of w.links) pairs.push({ other: l.supportUid, applied: l.applied, type: l.type });
    const sp = lo.supports.find(x => x.uid === focusUid);
    if (sp) { for (const u of sp.linkedTo) pairs.push({ other: u, applied: true, type: sp.type }); for (const b of sp.blockedFrom) pairs.push({ other: b.uid, applied: false, type: sp.type }); }
    const focusCells = new Set(itemCells(focus).map(c => c[0] + ',' + c[1]));
    for (const p of pairs) {
      const other = s.items.find(i => i.uid === p.other); if (!other) continue;
      const color = SUPPORT_COLORS[p.type] || '#fff';
      // 공유 변 찾기
      for (const [x, y] of itemCells(other)) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = (x + dx) + ',' + (y + dy);
          if (!focusCells.has(k)) continue;
          const ex = this.ox + (x + 0.5 + dx * 0.5) * cs, ey = this.oy + (y + 0.5 + dy * 0.5) * cs;
          ctx.save();
          if (p.applied) {
            const pulse = 0.6 + 0.4 * Math.sin(s.time * 6);
            ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 8 * pulse;
            ctx.beginPath(); if (dx !== 0) { ctx.moveTo(ex, ey - cs * 0.3); ctx.lineTo(ex, ey + cs * 0.3); } else { ctx.moveTo(ex - cs * 0.3, ey); ctx.lineTo(ex + cs * 0.3, ey); } ctx.stroke();
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, 7); ctx.fill();
            if (preview) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✓', ex, ey); }
          } else {
            ctx.strokeStyle = 'rgba(200,200,200,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
            ctx.beginPath(); if (dx !== 0) { ctx.moveTo(ex, ey - cs * 0.25); ctx.lineTo(ex, ey + cs * 0.25); } else { ctx.moveTo(ex - cs * 0.25, ey); ctx.lineTo(ex + cs * 0.25, ey); } ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×', ex, ey);
          }
          ctx.restore();
        }
      }
      // 연결된 상대 장비 강조
      if (p.applied) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.8; for (const [x, y] of itemCells(other)) { roundRect(ctx, this.ox + x * cs + 3, this.oy + y * cs + 3, cs - 6, cs - 6, 5); ctx.stroke(); } ctx.restore(); }
    }
  }
}

function cellsBounds(cells: readonly Cell[]): { w: number; h: number } { let w = 0, h = 0; for (const [x, y] of cells) { w = Math.max(w, x + 1); h = Math.max(h, y + 1); } return { w, h }; }

/** 작업대 칩·보상 카드용: 장비를 작은 캔버스에 그린다. */
export function renderItemThumb(canvas: HTMLCanvasElement, id: Item['id'], grade: Item['grade'], rot: Rot, size: number, opts: { withShape?: boolean } = {}): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr; canvas.height = size * dpr; canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
  const cells = rotateCells(EQUIPMENT[id].shape, rot); const b = cellsBounds(cells);
  if (opts.withShape === false) { ctx.save(); ctx.translate(size / 2, size / 2); drawEquipIcon(ctx, id, grade, size * 0.8); ctx.restore(); return; }
  const cs = Math.floor(Math.min(size / Math.max(b.w, b.h), size / 2.2));
  ctx.save(); ctx.translate((size - b.w * cs) / 2, (size - b.h * cs) / 2);
  drawItemBody(ctx, id, grade, cells, cs); ctx.restore();
}
