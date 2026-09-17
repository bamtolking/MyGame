// Canvas 2D renderer with a pannable/zoomable camera. All drawing is done in screen space (tile → pixel via the camera).
import type { GameState, Prisoner, Staff, Room } from '../sim/types';
import { T_DIRT, T_ROAD, S_WALL, S_FENCE, S_DOOR, S_JAILDOOR, S_NONE } from '../sim/grid';
import { ROOMS } from '../data/rooms';
import { SECURITY_INFO } from '../data/economy';
import { STAFF_BY_ID } from '../data/staff';
import { HOUR_SECONDS } from '../data/regime';
import { STRUCT_BY_INDEX } from '../data/structures';
import { OBJ_BY_ID } from '../data/objects';

export interface Cam { x: number; y: number; zoom: number }
export interface SelRect { x0: number; y0: number; x1: number; y1: number; color: string; hollow: boolean }
export type Selection = { kind: 'prisoner' | 'staff'; id: number } | { kind: 'tile'; x: number; y: number } | null;
interface Marker { x: number; y: number; t0: number; kind: string }

const C = {
  outside: '#0f1215', grass: '#4a7238', grass2: '#4f7a3c', dirt: '#6f5a3e', road: '#4e5259', roadLine: '#d7cf7a',
  wall: '#7f858e', wallTop: '#aab0b9', wallEdge: '#4d525a', fence: '#c39a62', fencePost: '#8a6a3f', door: '#9a6a3a', doorIn: '#c58a4c', jail: '#5f6a76', jailBar: '#c9d2dc',
  skin: '#f1c9a5', skin2: '#c98d5f', body: '#333',
};
const ZONE_FLOOR: string[] = ROOMS.map(r => r.floor);
const ZONE_COLOR: string[] = ROOMS.map(r => r.color);

export class Renderer {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  cam: Cam = { x: 22, y: 22, zoom: 14 };
  cw = 1; ch = 1; dpr = 1;
  showSecurity = false; showGrid = false; lowFx = false;
  selRect: SelRect | null = null; selection: Selection = null; hoverTile: { x: number; y: number } | null = null;
  markers: Marker[] = []; follow: { kind: 'prisoner' | 'staff'; id: number } | null = null;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false })!; }

  resize(): void {
    const r = this.canvas.getBoundingClientRect(); const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w !== this.cw || h !== this.ch || dpr !== this.dpr) { this.cw = w; this.ch = h; this.dpr = dpr; this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); }
  }
  fitMap(s: GameState, focus?: { x: number; y: number }): void {
    this.resize();
    const z = Math.min(this.cw / s.w, this.ch / s.h);
    this.cam.zoom = Math.max(z, 12);
    if (focus) { this.cam.x = focus.x; this.cam.y = focus.y; } else { this.cam.x = s.w / 2; this.cam.y = s.h / 2; }
    this.clampCam(s);
  }
  clampCam(s: GameState): void {
    this.cam.zoom = Math.max(5, Math.min(64, this.cam.zoom));
    const halfW = this.cw / 2 / this.cam.zoom, halfH = this.ch / 2 / this.cam.zoom;
    this.cam.x = Math.max(-halfW * 0.6, Math.min(s.w + halfW * 0.6, this.cam.x));
    this.cam.y = Math.max(-halfH * 0.6, Math.min(s.h + halfH * 0.6, this.cam.y));
  }
  sx(x: number): number { return (x - this.cam.x) * this.cam.zoom + this.cw / 2; }
  sy(y: number): number { return (y - this.cam.y) * this.cam.zoom + this.ch / 2; }
  screenToTile(px: number, py: number): { x: number; y: number } { return { x: (px - this.cw / 2) / this.cam.zoom + this.cam.x, y: (py - this.ch / 2) / this.cam.zoom + this.cam.y }; }
  centerOn(x: number, y: number): void { this.cam.x = x; this.cam.y = y; }
  addMarker(x: number, y: number, kind: string): void { this.markers.push({ x, y, t0: performance.now(), kind }); if (this.markers.length > 40) this.markers.shift(); }

  draw(s: GameState, now: number): void {
    this.resize();
    const ctx = this.ctx; const z = this.cam.zoom; const dpr = this.dpr;
    if (this.follow) { const e = this.follow.kind === 'prisoner' ? s.cache.prisonerIndex.get(this.follow.id) : s.cache.staffIndex.get(this.follow.id); if (e) { this.cam.x += (e.x - this.cam.x) * 0.15; this.cam.y += (e.y - this.cam.y) * 0.15; } else this.follow = null; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.outside; ctx.fillRect(0, 0, this.cw, this.ch);
    const x0 = Math.max(0, Math.floor(this.cam.x - this.cw / 2 / z) - 1), x1 = Math.min(s.w - 1, Math.ceil(this.cam.x + this.cw / 2 / z) + 1);
    const y0 = Math.max(0, Math.floor(this.cam.y - this.ch / 2 / z) - 1), y1 = Math.min(s.h - 1, Math.ceil(this.cam.y + this.ch / 2 / z) + 1);
    if (x1 < x0 || y1 < y0) return;
    const ox = this.sx(0), oy = this.sy(0);
    const px = (x: number) => ox + x * z, py = (y: number) => oy + y * z;
    // ground
    ctx.fillStyle = C.grass; ctx.fillRect(px(0), py(0), s.w * z, s.h * z);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * s.w + x; const t = s.terrain[i];
      if (t === T_DIRT) { ctx.fillStyle = C.dirt; ctx.fillRect(px(x), py(y), z + 0.5, z + 0.5); }
      else if (t === T_ROAD) { ctx.fillStyle = C.road; ctx.fillRect(px(x), py(y), z + 0.5, z + 0.5); if (x === 0 && y % 2 === 0 && z >= 8) { ctx.fillStyle = C.roadLine; ctx.fillRect(px(x) + z - z * 0.06, py(y) + z * 0.15, z * 0.12, z * 0.7); } }
      else if (z >= 12 && ((x * 7 + y * 13) % 5 === 0)) { ctx.fillStyle = C.grass2; ctx.fillRect(px(x) + z * 0.3, py(y) + z * 0.3, z * 0.4, z * 0.4); }
    }
    // entrance marker
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(px(s.entry.x), py(s.entry.y), z, z);
    // zone floors
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * s.w + x; const zn = s.zone[i]; if (!zn || s.struct[i] !== S_NONE) continue;
      ctx.fillStyle = ZONE_FLOOR[zn]; ctx.fillRect(px(x), py(y), z + 0.5, z + 0.5);
      const rid = s.cache.roomAt[i]; const room = rid >= 0 ? s.cache.rooms[rid] : null;
      if (room && !room.valid) { ctx.fillStyle = 'rgba(229,72,77,0.16)'; ctx.fillRect(px(x), py(y), z + 0.5, z + 0.5); }
    }
    // grid
    if (this.showGrid && z >= 10) { ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(px(x) + 0.5, py(y0)); ctx.lineTo(px(x) + 0.5, py(y1 + 1)); } for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(px(x0), py(y) + 0.5); ctx.lineTo(px(x1 + 1), py(y) + 0.5); } ctx.stroke(); }
    // security overlay
    if (this.showSecurity) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * s.w + x; if (s.struct[i] === S_WALL || s.struct[i] === S_FENCE) continue; ctx.fillStyle = s.cache.insecure[i] ? 'rgba(229,72,77,0.28)' : 'rgba(76,175,80,0.14)'; ctx.fillRect(px(x), py(y), z + 0.5, z + 0.5); }
    }
    // objects (built + ghosts)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const id = s.objAt[y * s.w + x]; if (id < 0) continue; const ob = s.cache.objIndex.get(id); if (!ob) continue; ctx.globalAlpha = ob.built ? 1 : 0.45; this.drawObject(ob.type, px(x), py(y), z); ctx.globalAlpha = 1; }
    // structures
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const st = s.struct[y * s.w + x]; if (st) this.drawStruct(s, st, x, y, px(x), py(y), z, 1); }
    // jobs
    for (const j of s.jobs) {
      if (j.x < x0 || j.x > x1 || j.y < y0 || j.y > y1) continue; const X = px(j.x), Y = py(j.y);
      if (j.kind === 'build' && j.struct) this.drawStruct(s, j.struct, j.x, j.y, X, Y, z, 0.45);
      if (j.kind === 'demolish') { ctx.strokeStyle = 'rgba(229,72,77,0.9)'; ctx.lineWidth = Math.max(1.5, z * 0.1); ctx.beginPath(); ctx.moveTo(X + z * 0.2, Y + z * 0.2); ctx.lineTo(X + z * 0.8, Y + z * 0.8); ctx.moveTo(X + z * 0.8, Y + z * 0.2); ctx.lineTo(X + z * 0.2, Y + z * 0.8); ctx.stroke(); }
      if (j.progress > 0) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(X + z * 0.1, Y + z * 0.78, z * 0.8, z * 0.14); ctx.fillStyle = '#ffd54f'; ctx.fillRect(X + z * 0.1, Y + z * 0.78, z * 0.8 * Math.min(1, j.progress / j.total), z * 0.14); }
      else if (z >= 9) { ctx.strokeStyle = j.unreachable ? '#e5484d' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(X + 1, Y + 1, z - 2, z - 2); ctx.setLineDash([]); }
      if (j.unreachable && z >= 8) this.icon('⛔', X + z / 2, Y + z * 0.45, Math.max(9, z * 0.6));
    }
    // room labels & issues
    if (z >= 11) for (const r of s.cache.rooms) {
      if (r.cx < x0 || r.cx > x1 + 1 || r.cy < y0 || r.cy > y1 + 1) continue;
      const def = ROOMS[r.zone]; const label = def.name + (r.tiles.length >= 6 && z >= 16 ? '' : '');
      ctx.font = `700 ${Math.max(9, Math.min(14, z * 0.55))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const X = px(r.cx), Y = py(r.cy);
      if (r.tiles.length >= 4 || !r.valid) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(label, X + 1, Y + 1); ctx.fillStyle = r.valid ? 'rgba(255,255,255,0.85)' : '#ffb3b3'; ctx.fillText((r.valid ? '' : '⚠ ') + label, X, Y); }
    } else for (const r of s.cache.rooms) if (!r.valid && z >= 6) this.icon('⚠', px(r.cx), py(r.cy), 11);
    // selection rect
    if (this.selRect) {
      const r = this.selRect; const rx0 = Math.min(r.x0, r.x1), ry0 = Math.min(r.y0, r.y1), rx1 = Math.max(r.x0, r.x1), ry1 = Math.max(r.y0, r.y1);
      ctx.fillStyle = r.color.replace(')', ',0.25)').replace('rgb(', 'rgba('); ctx.strokeStyle = r.color; ctx.lineWidth = 2;
      if (r.hollow) { for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) { if (x !== rx0 && x !== rx1 && y !== ry0 && y !== ry1) continue; ctx.fillRect(px(x), py(y), z, z); } }
      else ctx.fillRect(px(rx0), py(ry0), (rx1 - rx0 + 1) * z, (ry1 - ry0 + 1) * z);
      ctx.strokeRect(px(rx0) + 1, py(ry0) + 1, (rx1 - rx0 + 1) * z - 2, (ry1 - ry0 + 1) * z - 2);
      const wz = rx1 - rx0 + 1, hz = ry1 - ry0 + 1;
      if (wz > 1 || hz > 1) { ctx.font = '700 12px system-ui'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; const t = `${wz}×${hz}`; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px(rx0), py(ry0) - 16, ctx.measureText(t).width + 8, 16); ctx.fillStyle = '#fff'; ctx.fillText(t, px(rx0) + 4, py(ry0) - 2); }
    }
    // entities
    const ents: (Prisoner | Staff)[] = [];
    for (const p of s.prisoners) if (p.x >= x0 - 1 && p.x <= x1 + 2 && p.y >= y0 - 1 && p.y <= y1 + 2) ents.push(p);
    for (const st of s.staff) if (st.x >= x0 - 1 && st.x <= x1 + 2 && st.y >= y0 - 1 && st.y <= y1 + 2) ents.push(st);
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) { if ('sec' in e) this.drawPrisoner(s, e, this.sx(e.x), this.sy(e.y), z, now); else this.drawStaff(e, this.sx(e.x), this.sy(e.y), z, now); }
    // fights
    for (const f of s.fights) { const X = this.sx(f.x), Y = this.sy(f.y); const pulse = 0.5 + 0.5 * Math.sin(now / 120); ctx.strokeStyle = `rgba(229,72,77,${0.4 + 0.5 * pulse})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, z * (0.9 + 0.3 * pulse), 0, Math.PI * 2); ctx.stroke(); this.icon('💥', X, Y - z * 0.9, Math.max(12, z * 0.8)); }
    // markers
    const keep: Marker[] = [];
    for (const m of this.markers) {
      const age = (now - m.t0) / 1000; if (age > 1.2) continue; keep.push(m);
      const X = this.sx(m.x), Y = this.sy(m.y);
      if (m.kind === 'built') { ctx.strokeStyle = `rgba(255,213,79,${1 - age / 1.2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, z * (0.3 + age * 0.8), 0, Math.PI * 2); ctx.stroke(); }
      else if (m.kind === 'alert') { ctx.strokeStyle = `rgba(229,72,77,${1 - age / 1.2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X, Y, z * (0.5 + age * 2.5), 0, Math.PI * 2); ctx.stroke(); }
      else if (m.kind === 'good') { ctx.strokeStyle = `rgba(76,175,80,${1 - age / 1.2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, z * (0.4 + age * 1.5), 0, Math.PI * 2); ctx.stroke(); }
    }
    this.markers = keep;
    // night
    const hour = (s.time / HOUR_SECONDS) % 24;
    let night = 0; if (hour < 5) night = 1; else if (hour < 7) night = 1 - (hour - 5) / 2; else if (hour < 19) night = 0; else if (hour < 21) night = (hour - 19) / 2; else night = 1;
    if (night > 0) { ctx.fillStyle = `rgba(8,12,40,${0.42 * night})`; ctx.fillRect(0, 0, this.cw, this.ch); }
    // hover / selection tile outline
    if (this.selection && this.selection.kind === 'tile') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px(this.selection.x) + 1, py(this.selection.y) + 1, z - 2, z - 2); }
    // off-screen incident indicators
    this.edgeIndicators(s, now);
  }

  private edgeIndicators(s: GameState, now: number): void {
    const pts: { x: number; y: number; icon: string }[] = [];
    for (const f of s.fights) pts.push({ x: f.x, y: f.y, icon: '💥' });
    for (const p of s.prisoners) if (p.state === 'escape') pts.push({ x: p.x, y: p.y, icon: '🏃' });
    for (const j of s.jobs) if (j.unreachable && (now / 1000) % 2 < 1) { pts.push({ x: j.x + 0.5, y: j.y + 0.5, icon: '⛔' }); break; }
    const ctx = this.ctx; const m = 18;
    for (const p of pts) {
      let X = this.sx(p.x), Y = this.sy(p.y);
      if (X > m && X < this.cw - m && Y > m && Y < this.ch - m) continue;
      const cx = this.cw / 2, cy = this.ch / 2; const dx = X - cx, dy = Y - cy;
      const k = Math.min((this.cw / 2 - m) / Math.abs(dx || 1e-6), (this.ch / 2 - m) / Math.abs(dy || 1e-6));
      X = cx + dx * k; Y = cy + dy * k;
      ctx.fillStyle = 'rgba(229,72,77,0.9)'; ctx.beginPath(); ctx.arc(X, Y, 14, 0, Math.PI * 2); ctx.fill();
      this.icon(p.icon, X, Y, 15);
    }
  }

  icon(txt: string, x: number, y: number, size: number): void { const ctx = this.ctx; ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y); }

  drawStruct(s: GameState, st: number, tx: number, ty: number, X: number, Y: number, z: number, alpha: number): void {
    const ctx = this.ctx; ctx.globalAlpha = alpha;
    if (st === S_WALL) {
      ctx.fillStyle = C.wall; ctx.fillRect(X, Y, z + 0.5, z + 0.5);
      ctx.fillStyle = C.wallTop; ctx.fillRect(X, Y, z + 0.5, Math.max(1, z * 0.35));
      const below = ty + 1 < s.h && s.struct[(ty + 1) * s.w + tx] === S_WALL;
      if (!below) { ctx.fillStyle = C.wallEdge; ctx.fillRect(X, Y + z * 0.82, z + 0.5, z * 0.18 + 0.5); }
    } else if (st === S_FENCE) {
      ctx.fillStyle = C.fencePost; ctx.fillRect(X + z * 0.38, Y + z * 0.1, z * 0.24, z * 0.8);
      ctx.strokeStyle = C.fence; ctx.lineWidth = Math.max(1, z * 0.1);
      ctx.beginPath(); ctx.moveTo(X, Y + z * 0.35); ctx.lineTo(X + z, Y + z * 0.35); ctx.moveTo(X, Y + z * 0.7); ctx.lineTo(X + z, Y + z * 0.7); ctx.moveTo(X + z * 0.5, Y); ctx.lineTo(X + z * 0.5, Y + z); ctx.stroke();
    } else if (st === S_DOOR) {
      ctx.fillStyle = C.wall; ctx.fillRect(X, Y, z + 0.5, z + 0.5);
      ctx.fillStyle = C.door; ctx.fillRect(X + z * 0.1, Y + z * 0.1, z * 0.8, z * 0.8);
      ctx.fillStyle = C.doorIn; ctx.fillRect(X + z * 0.2, Y + z * 0.2, z * 0.6, z * 0.6);
      ctx.fillStyle = '#ffe082'; ctx.fillRect(X + z * 0.62, Y + z * 0.45, z * 0.12, z * 0.12);
    } else if (st === S_JAILDOOR) {
      ctx.fillStyle = C.wall; ctx.fillRect(X, Y, z + 0.5, z + 0.5);
      ctx.fillStyle = C.jail; ctx.fillRect(X + z * 0.08, Y + z * 0.08, z * 0.84, z * 0.84);
      ctx.fillStyle = C.jailBar; for (let k = 0; k < 3; k++) ctx.fillRect(X + z * (0.22 + k * 0.24), Y + z * 0.12, Math.max(1, z * 0.08), z * 0.76);
      ctx.fillStyle = '#ffb300'; ctx.fillRect(X + z * 0.42, Y + z * 0.44, z * 0.16, z * 0.12);
    }
    ctx.globalAlpha = 1;
  }

  drawObject(type: string, X: number, Y: number, z: number): void {
    const ctx = this.ctx; const u = z / 10; // unit
    if (z < 8) { ctx.fillStyle = '#ddd'; ctx.fillRect(X + z * 0.25, Y + z * 0.25, z * 0.5, z * 0.5); return; }
    switch (type) {
      case 'bed': ctx.fillStyle = '#7a4a2a'; ctx.fillRect(X + u, Y + u, 8 * u, 8 * u); ctx.fillStyle = '#e8e8e8'; ctx.fillRect(X + 1.5 * u, Y + 1.5 * u, 7 * u, 7 * u); ctx.fillStyle = '#4c8dff'; ctx.fillRect(X + 1.5 * u, Y + 4 * u, 7 * u, 4.5 * u); ctx.fillStyle = '#fff'; ctx.fillRect(X + 2.5 * u, Y + 2 * u, 5 * u, 1.6 * u); break;
      case 'toilet': ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.ellipse(X + 5 * u, Y + 6 * u, 3 * u, 2.6 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(X + 3 * u, Y + 1.5 * u, 4 * u, 3 * u); ctx.fillStyle = '#9fc7ff'; ctx.beginPath(); ctx.ellipse(X + 5 * u, Y + 6 * u, 1.6 * u, 1.3 * u, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'bench': ctx.fillStyle = '#a0713f'; ctx.fillRect(X + u, Y + 3.5 * u, 8 * u, 2.5 * u); ctx.fillStyle = '#6e4a27'; ctx.fillRect(X + 1.5 * u, Y + 6 * u, 1.5 * u, 2.5 * u); ctx.fillRect(X + 7 * u, Y + 6 * u, 1.5 * u, 2.5 * u); break;
      case 'table': ctx.fillStyle = '#b27d47'; ctx.fillRect(X + 1.5 * u, Y + 1.5 * u, 7 * u, 7 * u); ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(X + 3.5 * u, Y + 4 * u, 1.3 * u, 0, Math.PI * 2); ctx.arc(X + 6.5 * u, Y + 6 * u, 1.3 * u, 0, Math.PI * 2); ctx.fill(); break;
      case 'serving': ctx.fillStyle = '#9aa5b1'; ctx.fillRect(X + u, Y + 2 * u, 8 * u, 6 * u); ctx.fillStyle = '#e57373'; ctx.fillRect(X + 2 * u, Y + 3 * u, 2.5 * u, 2 * u); ctx.fillStyle = '#aed581'; ctx.fillRect(X + 5.5 * u, Y + 3 * u, 2.5 * u, 2 * u); ctx.fillStyle = '#fff59d'; ctx.fillRect(X + 3.5 * u, Y + 5.5 * u, 3 * u, 1.5 * u); break;
      case 'cooker': ctx.fillStyle = '#2f3339'; ctx.fillRect(X + u, Y + u, 8 * u, 8 * u); ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.arc(X + 3.5 * u, Y + 3.5 * u, 1.4 * u, 0, Math.PI * 2); ctx.arc(X + 6.5 * u, Y + 3.5 * u, 1.4 * u, 0, Math.PI * 2); ctx.arc(X + 3.5 * u, Y + 6.5 * u, 1.4 * u, 0, Math.PI * 2); ctx.arc(X + 6.5 * u, Y + 6.5 * u, 1.4 * u, 0, Math.PI * 2); ctx.fill(); break;
      case 'fridge': ctx.fillStyle = '#e0e6ea'; ctx.fillRect(X + 2 * u, Y + u, 6 * u, 8 * u); ctx.fillStyle = '#9aa5b1'; ctx.fillRect(X + 2 * u, Y + 4 * u, 6 * u, 0.6 * u); ctx.fillRect(X + 6.5 * u, Y + 2 * u, 0.8 * u, 1.5 * u); break;
      case 'shower': ctx.fillStyle = '#5fb4d8'; ctx.fillRect(X + 1.5 * u, Y + 1.5 * u, 7 * u, 7 * u); ctx.fillStyle = '#cfd8dc'; ctx.fillRect(X + 4 * u, Y + u, 2 * u, 3 * u); ctx.fillStyle = '#e1f5fe'; for (let k = 0; k < 3; k++) ctx.fillRect(X + (3 + k * 1.5) * u, Y + (5 + (k % 2)) * u, 0.8 * u, 1.5 * u); break;
      case 'medbed': ctx.fillStyle = '#f4f4f4'; ctx.fillRect(X + u, Y + u, 8 * u, 8 * u); ctx.fillStyle = '#e53935'; ctx.fillRect(X + 4 * u, Y + 2.5 * u, 2 * u, 5 * u); ctx.fillRect(X + 2.5 * u, Y + 4 * u, 5 * u, 2 * u); break;
      case 'tv': ctx.fillStyle = '#212121'; ctx.fillRect(X + 1.5 * u, Y + 2 * u, 7 * u, 5.5 * u); ctx.fillStyle = '#42a5f5'; ctx.fillRect(X + 2.2 * u, Y + 2.7 * u, 5.6 * u, 4 * u); ctx.fillStyle = '#616161'; ctx.fillRect(X + 4 * u, Y + 7.5 * u, 2 * u, 1.2 * u); break;
      case 'bookshelf': ctx.fillStyle = '#6d4c41'; ctx.fillRect(X + 1.5 * u, Y + u, 7 * u, 8 * u); const cols = ['#e57373', '#64b5f6', '#ffd54f', '#81c784', '#ba68c8']; for (let k = 0; k < 5; k++) { ctx.fillStyle = cols[k]; ctx.fillRect(X + (2 + k * 1.3) * u, Y + 2 * u, u, 2.5 * u); ctx.fillStyle = cols[(k + 2) % 5]; ctx.fillRect(X + (2 + k * 1.3) * u, Y + 5.5 * u, u, 2.5 * u); } break;
      case 'workbench': ctx.fillStyle = '#8d6e63'; ctx.fillRect(X + u, Y + 2 * u, 8 * u, 6 * u); ctx.fillStyle = '#b0bec5'; ctx.fillRect(X + 2 * u, Y + 3 * u, 3 * u, 1.2 * u); ctx.fillStyle = '#ff8f00'; ctx.fillRect(X + 6 * u, Y + 3 * u, 1.5 * u, 3 * u); break;
      case 'desk': ctx.fillStyle = '#795548'; ctx.fillRect(X + u, Y + 2.5 * u, 8 * u, 5 * u); ctx.fillStyle = '#eceff1'; ctx.fillRect(X + 2 * u, Y + 3.5 * u, 3 * u, 2.5 * u); ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(X + 7 * u, Y + 4 * u, 1.2 * u, 0, Math.PI * 2); ctx.fill(); break;
      case 'weights': ctx.fillStyle = '#455a64'; ctx.fillRect(X + 1.5 * u, Y + 4.4 * u, 7 * u, 1.2 * u); ctx.fillStyle = '#263238'; ctx.fillRect(X + u, Y + 2.5 * u, 2 * u, 5 * u); ctx.fillRect(X + 7 * u, Y + 2.5 * u, 2 * u, 5 * u); break;
      default: ctx.fillStyle = '#ddd'; ctx.fillRect(X + 2 * u, Y + 2 * u, 6 * u, 6 * u);
    }
  }

  drawPrisoner(s: GameState, p: Prisoner, X: number, Y: number, z: number, now: number): void {
    const ctx = this.ctx; const r = z * 0.32;
    const color = SECURITY_INFO[p.sec].color;
    const lying = p.state === 'sleep' || p.state === 'subdued' || p.state === 'heal';
    if (this.selection && this.selection.kind === 'prisoner' && this.selection.id === p.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, r + 4 + 2 * Math.sin(now / 150), 0, Math.PI * 2); ctx.stroke(); }
    if (p.state === 'escape') { ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y + r * 0.7, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    if (lying) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(X, Y, r * 1.5, r * 0.75, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(X - r * 1.2, Y, r * 0.5, 0, Math.PI * 2); ctx.fill(); }
    else {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
      if (p.sec === 'max' && z >= 10) { ctx.strokeStyle = '#3a0a0a'; ctx.lineWidth = Math.max(1, z * 0.06); ctx.beginPath(); ctx.arc(X, Y, r * 0.7, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = (p.id % 3 === 0) ? C.skin2 : C.skin; ctx.beginPath(); ctx.arc(X, Y - r * 0.55, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.arc(X, Y - r * 0.75, r * 0.45, Math.PI, Math.PI * 2); ctx.fill();
    }
    if (z >= 11) {
      let ic = '';
      switch (p.state) { case 'sleep': ic = '💤'; break; case 'eat': ic = '🍽'; break; case 'shower': ic = '🚿'; break; case 'fight': ic = '💢'; break; case 'escape': ic = '🏃'; break; case 'subdued': ic = '😵'; break; case 'heal': ic = '🩹'; break; case 'work': ic = '🔧'; break; }
      if (!ic && p.injured) ic = '🩸'; if (!ic && p.rioter) ic = '🔥'; if (!ic && p.anger > 70) ic = '😡'; else if (!ic && p.anger > 50) ic = '😠';
      if (!ic && p.intent === 'release' && p.state === 'move') ic = '🎉';
      if (ic) this.icon(ic, X, Y - r * 2.1, Math.max(10, z * 0.55));
      if (p.punishedUntil > s.time && !ic) this.icon('🔒', X, Y - r * 2.1, Math.max(10, z * 0.5));
    }
  }
  drawStaff(st: Staff, X: number, Y: number, z: number, now: number): void {
    const ctx = this.ctx; const r = z * 0.32; const def = STAFF_BY_ID[st.type];
    if (this.selection && this.selection.kind === 'staff' && this.selection.id === st.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, r + 4 + 2 * Math.sin(now / 150), 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y + r * 0.7, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    if (st.state === 'injured') { ctx.fillStyle = def.color; ctx.beginPath(); ctx.ellipse(X, Y, r * 1.5, r * 0.75, 0, 0, Math.PI * 2); ctx.fill(); if (z >= 11) this.icon('🤕', X, Y - r * 2, Math.max(10, z * 0.55)); return; }
    ctx.fillStyle = st.temp ? '#1f3f8a' : def.color; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(X, Y - r * 0.55, r * 0.55, 0, Math.PI * 2); ctx.fill();
    // hats
    if (st.type === 'guard') { ctx.fillStyle = st.temp ? '#111' : '#1a2f6b'; ctx.fillRect(X - r * 0.6, Y - r * 1.25, r * 1.2, r * 0.4); ctx.fillRect(X - r * 0.75, Y - r * 0.9, r * 1.5, r * 0.15); }
    else if (st.type === 'cook') { ctx.fillStyle = '#fff'; ctx.fillRect(X - r * 0.5, Y - r * 1.45, r, r * 0.6); }
    else if (st.type === 'workman') { ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(X, Y - r * 0.85, r * 0.55, Math.PI, Math.PI * 2); ctx.fill(); }
    else if (st.type === 'doctor') { ctx.fillStyle = '#fff'; ctx.fillRect(X - r * 0.45, Y - r * 1.3, r * 0.9, r * 0.3); ctx.fillStyle = '#e53935'; ctx.fillRect(X - r * 0.1, Y - r * 1.35, r * 0.2, r * 0.4); }
    if (z >= 11) {
      let ic = '';
      if (st.type === 'workman' && st.state === 'work') ic = '🔨'; else if (st.type === 'cook' && st.state === 'work') ic = '🍳'; else if (st.state === 'fight') ic = '🛡'; else if (st.state === 'chase') ic = '❗'; else if (st.state === 'leave') ic = '👋';
      if (ic) this.icon(ic, X, Y - r * 2.1, Math.max(10, z * 0.55));
    }
  }

  /** Nearest entity within 0.7 tiles of a world point. */
  pick(s: GameState, wx: number, wy: number): Selection {
    let best: Selection = null, bd = 0.7 * 0.7;
    for (const p of s.prisoners) { const d = (p.x - wx) ** 2 + (p.y - wy) ** 2; if (d < bd) { bd = d; best = { kind: 'prisoner', id: p.id }; } }
    for (const st of s.staff) { const d = (st.x - wx) ** 2 + (st.y - wy) ** 2; if (d < bd) { bd = d; best = { kind: 'staff', id: st.id }; } }
    return best;
  }
}
export const roomLabel = (r: Room): string => ROOMS[r.zone].name;
export const structName = (st: number): string => STRUCT_BY_INDEX[st]?.name || '';
export const objName = (t: string): string => OBJ_BY_ID[t]?.name || t;
export const zoneColor = (z: number): string => ZONE_COLOR[z];
