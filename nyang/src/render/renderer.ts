// 캔버스 장면: 방 배경, 종이 상자, 크레인, 고양이, 연출. 월드 → 화면 변환도 여기서 관리한다.
import { CATS } from '../data/cats';
import { Game, NIP, radiusOf, type GameEvent } from '../sim/game';
import type { Body } from '../sim/physics';
import { drawCat, drawTail, type CatPose, type Clip, type Mood } from './catdraw';
import { buildClips, VISUAL_SCALE, type Disc } from './squish';
import { Fx, FONT } from './fx';
import { t } from '../i18n';

export const WALL = 16;
export const RAIL_Y = -132;

interface Vis {
  sq: number; sqv: number;
  off: number;
  blinkT: number; blink: number;
  squishT: number;
  restT: number;
  seed: number;
}

export interface RenderOpts {
  showHeld: boolean;
  /** 타이틀 데모: 효과 약하게 */
  demo?: boolean;
  paused?: boolean;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  dpr = 1;
  cssW = 0; cssH = 0;
  /** 월드 1단위 = scale CSS px, 월드 원점의 화면 위치 */
  scale = 1; ox = 0; oy = 0;
  insetTop = 0; insetBottom = 0;
  fx = new Fx();
  lite = false;
  reduceMotion = false;
  targeting = false;
  hoverId = -1;
  private vis = new Map<number, Vis>();
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private discs: Disc[] = [];
  private clips: Clip[][] = [];
  private poses: CatPose[] = [];
  private held = { x: 180, a: 0, av: 0, lower: 1, tier: -99, lastX: 180 };
  private lookX = 180; private lookY = 0;
  private t = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setInsets(top: number, bottom: number): void { this.insetTop = top; this.insetBottom = bottom; }

  resize(): void {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w === this.cssW && h === this.cssH && dpr === this.dpr) return;
    this.dpr = dpr; this.cssW = w; this.cssH = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.bgKey = '';
  }

  layout(game: Game): void {
    const W = game.rules.boxW, H = game.rules.boxH;
    const x0 = -WALL - 34, x1 = W + WALL + 34;
    const y0 = RAIL_Y - 16, y1 = H + WALL + 6;
    const availW = this.cssW - 12, availH = this.cssH - this.insetTop - this.insetBottom - 8;
    this.scale = Math.max(0.2, Math.min(availW / (x1 - x0), availH / (y1 - y0)));
    this.ox = (this.cssW - (x1 - x0) * this.scale) / 2 - x0 * this.scale;
    this.oy = this.insetTop + 4 + (availH - (y1 - y0) * this.scale) / 2 - y0 * this.scale;
  }

  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
  }

  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.ox + x * this.scale, y: this.oy + y * this.scale };
  }

  pickBody(game: Game, wx: number, wy: number): Body | null {
    let best: Body | null = null, bd = Infinity;
    for (const b of game.world.bodies) {
      const d = Math.hypot(b.x - wx, b.y - wy);
      if (d < b.r * 1.15 + 6 && d / b.r < bd) { bd = d / b.r; best = b; }
    }
    return best;
  }

  private textT = -1; private textX = 0; private textN = 0;
  private comboT = -9; private comboShown = 0;

  /** 같은 자리에 글자가 연달아 뜨면 위로 비켜 쌓는다 */
  private textY(x: number, y: number): number {
    if (this.t - this.textT < 0.45 && Math.abs(x - this.textX) < 90) this.textN++; else this.textN = 0;
    this.textT = this.t; this.textX = x;
    return y - this.textN * 26;
  }

  /** 게임 이벤트 → 연출 */
  onEvents(events: GameEvent[], game: Game): void {
    const fx = this.fx;
    // 한 번에 여러 합체가 나면 콤보 글자는 가장 큰 것 하나만
    let topCombo: { combo: number; x: number; y: number; r: number } | null = null;
    for (const e of events) if ((e.t === 'merge' || e.t === 'nip') && e.combo >= 2 && (!topCombo || e.combo > topCombo.combo)) topCombo = { combo: e.combo, x: e.x, y: e.y, r: CATS[e.tier].r };
    if (topCombo && (this.t - this.comboT > 0.3 || topCombo.combo > this.comboShown)) {
      this.comboT = this.t; this.comboShown = topCombo.combo;
      fx.combo(clampX(topCombo.x, game.rules.boxW), topCombo.y - topCombo.r - 30, t('fx.combo', { n: topCombo.combo }), comboColor(topCombo.combo), 22 + Math.min(16, topCombo.combo * 3));
    }
    for (const e of events) {
      switch (e.t) {
        case 'merge': {
          fx.merge(e.tier, e.x, e.y, e.ax, e.ay, e.bx, e.by, e.ar, e.br);
          const ty = this.textY(e.x, e.y - CATS[e.tier].r * 0.6);
          fx.text(e.x, ty, `+${e.points}`, '#FFF4C2', 15 + Math.min(10, e.tier));
          this.lookX = e.x; this.lookY = e.y;
          break;
        }
        case 'ascend':
          fx.ascend(e.x, e.y);
          fx.text(e.x, e.y - 40, t('fx.ascend'), '#FFE46B', 40, true);
          fx.text(e.x, e.y + 10, `+${e.points}`, '#ffffff', 26, true);
          break;
        case 'nip':
          fx.nip(e.x, e.y, CATS[e.tier].r * (e.grew ? 1 : 0.6));
          const ny = this.textY(e.x, e.y - CATS[e.tier].r * 0.6);
          fx.text(e.x, ny, `+${e.points}`, '#D8FFB0', 17);
          break;
        case 'land':
          if (e.speed > 520) fx.landDust(e.x, Math.min(e.y, game.rules.boxH), e.speed);
          break;
        case 'power':
          if (e.power === 'punch') fx.punch(e.tier, e.x, e.y, radiusOf(e.tier) * VISUAL_SCALE);
          if (e.power === 'shake') fx.shake = Math.max(fx.shake, 6);
          break;
        case 'revive':
          for (const p of e.poofs) fx.poof(p.x, p.y, radiusOf(p.tier));
          break;
        case 'drop':
          this.held.lower = 0;
          break;
      }
    }
  }

  private visOf(b: Body): Vis {
    let v = this.vis.get(b.id);
    if (!v) { v = { sq: 0, sqv: 0, off: 0, blinkT: 1 + Math.random() * 4, blink: 0, squishT: 0, restT: 0, seed: (b.id * 7.31) % 6.28 }; this.vis.set(b.id, v); }
    return v;
  }

  render(game: Game, dt: number, opts: RenderOpts): void {
    this.resize();
    this.layout(game);
    this.t += dt;
    const t = this.t;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const W = game.rules.boxW, H = game.rules.boxH;
    this.fx.lite = this.lite;
    if (!opts.paused) this.fx.update(dt);

    // 배경 (캐시)
    const key = `${this.cssW}x${this.cssH}@${dpr}:${W}x${H}:${this.scale.toFixed(3)}:${this.ox.toFixed(1)},${this.oy.toFixed(1)}`;
    if (key !== this.bgKey) { this.bg = this.paintBackground(game); this.bgKey = key; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg!, 0, 0);

    // 월드 변환 + 흔들림
    let sx = 0, sy = 0;
    const shakeAmt = this.reduceMotion ? 0 : this.fx.shake;
    if (shakeAmt > 0) { sx = (Math.random() - 0.5) * shakeAmt; sy = (Math.random() - 0.5) * shakeAmt; }
    if (game.shake > 0 && !this.reduceMotion) sx += Math.sin(t * 55) * 7 * Math.min(1, game.shake * 2);
    const s = this.scale * dpr;
    ctx.setTransform(s, 0, 0, s, (this.ox + sx * this.scale) * dpr, (this.oy + sy * this.scale) * dpr);
    const line = Math.max(1.1, 1.9 * Math.min(1.2, this.scale)) / this.scale;

    this.drawBoxBack(ctx, game);
    this.drawCrane(ctx, game, t, opts, line, opts.paused ? 0 : dt);

    // 고양이
    const bodies = game.world.bodies;
    const discs = this.discs; discs.length = bodies.length;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const v = this.visOf(b);
      const age = game.time - b.ct;
      const pop = b.chain > 0 && age < 0.35 ? 1 + 0.16 * Math.sin((age / 0.35) * Math.PI) : 1;
      discs[i] = { x: b.x, y: b.y, r: b.r * VISUAL_SCALE * pop };
      void v;
    }
    buildClips(discs, W, H, this.clips);
    const poses = this.poses; poses.length = bodies.length;
    const liquid = game.liquify > 0 ? Math.min(1, game.liquify * 2, (game.rules.liquifyTime - game.liquify) * 3) : 0;
    const heldX = this.held.x;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const v = this.visOf(b);
      if (!opts.paused) this.animateVis(b, v, dt, game);
      const mood = this.moodOf(b, v, game, liquid);
      const lx = opts.showHeld ? clamp((heldX - b.x) / 140, -1, 1) : clamp((this.lookX - b.x) / 160, -1, 1);
      const ly = opts.showHeld ? -0.7 : clamp((this.lookY - b.y) / 160, -1, 1);
      poses[i] = {
        tier: b.tier, x: b.x, y: b.y, r: discs[i].r, a: b.a + v.off, squash: clamp(v.sq, -0.28, 0.24), clips: this.clips[i], mood,
        lookX: lx, lookY: ly, blink: v.blink, t, seed: v.seed, line, melt: liquid, detail: this.scale,
      };
    }
    const order = poses.map((_, i) => i).sort((a, b) => poses[b].y - poses[a].y);
    for (const i of order) drawTail(ctx, poses[i]);
    for (const i of order) drawCat(ctx, poses[i]);

    // 넘침 경고 링
    for (const b of bodies) {
      if (b.over <= 0.05) continue;
      const k = Math.min(1, b.over / game.rules.overflowTime);
      ctx.save();
      ctx.lineWidth = 4 / this.scale;
      ctx.strokeStyle = 'rgba(255,70,90,0.9)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * VISUAL_SCALE + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.restore();
    }

    // 냥펀치 조준
    if (this.targeting) {
      for (const b of bodies) {
        const on = b.id === this.hoverId;
        ctx.save();
        ctx.setLineDash([6 / this.scale, 5 / this.scale]);
        ctx.lineDashOffset = -t * 30 / this.scale;
        ctx.lineWidth = (on ? 4 : 2.5) / this.scale;
        ctx.strokeStyle = on ? '#FF4F6D' : 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * VISUAL_SCALE + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    // 액체화 물결
    if (liquid > 0) {
      if (!opts.paused && Math.random() < 0.5) this.fx.bubbles(W, H);
      ctx.save();
      ctx.globalAlpha = 0.22 * liquid;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(120,220,255,0.2)'); g.addColorStop(1, 'rgba(60,170,255,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 12) ctx.lineTo(x, H * 0.12 + Math.sin(x * 0.04 + t * 3) * 8);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    this.drawRim(ctx, game, t);
    this.fx.draw(ctx, t, line);

    // 화면 번쩍임 / 위험 붉은 테두리
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.fx.flash > 0 && !this.reduceMotion) {
      ctx.globalAlpha = Math.min(0.7, this.fx.flash);
      ctx.fillStyle = this.fx.flashColor;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.globalAlpha = 1;
    }
    if (game.danger > 0.05) {
      const pulse = 0.5 + 0.5 * Math.sin(t * (6 + game.danger * 10));
      const a = Math.min(0.55, game.danger * 0.6) * (0.6 + 0.4 * pulse);
      const g = ctx.createRadialGradient(this.cssW / 2, this.cssH / 2, Math.min(this.cssW, this.cssH) * 0.35, this.cssW / 2, this.cssH / 2, Math.max(this.cssW, this.cssH) * 0.75);
      g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, `rgba(255,40,70,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.cssW, this.cssH);
    }

    // 사라진 몸 정리
    if (this.vis.size > bodies.length + 40) {
      const alive = new Set(bodies.map(b => b.id));
      for (const id of [...this.vis.keys()]) if (!alive.has(id)) this.vis.delete(id);
    }
  }

  private animateVis(b: Body, v: Vis, dt: number, game: Game): void {
    // 착지 충격 → 납작, 떨어지는 중 → 길쭉
    if (b.hit > 180) {
      v.sqv -= Math.min(5.5, b.hit / 170) * (b.r < 30 ? 1 : 0.7);
      if (b.hit > 650) v.squishT = 0.45;
    }
    const k = 260, c = 13;
    v.sqv += (-k * v.sq - c * v.sqv) * dt;
    v.sq += v.sqv * dt;
    if (b.vy > 250 && b.hit < 50) v.sq = Math.max(v.sq, Math.min(0.1, b.vy / 7000));
    if (v.squishT > 0) v.squishT -= dt;
    // 가만히 있으면 천천히 바로 선다 (보이는 각도만)
    const speed = Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.w) * b.r;
    if (speed < 40) {
      let va = b.a + v.off;
      va = Math.atan2(Math.sin(va), Math.cos(va));
      const nva = va * (1 - Math.min(1, dt * 2.2));
      v.off = nva - b.a;
      v.restT += dt;
    } else {
      v.restT = 0;
    }
    // 깜빡임
    v.blinkT -= dt;
    if (v.blinkT <= 0) { v.blink = 1; v.blinkT = 2 + Math.random() * 4; }
    else v.blink = Math.max(0, v.blink - dt * 7);
    void game;
  }

  private moodOf(b: Body, v: Vis, game: Game, liquid: number): Mood {
    if (game.over) return 'scared';
    if (b.over > 0.05) return 'scared';
    if (v.squishT > 0) return 'squish';
    if (b.chain > 0 && game.time - b.ct < 1.1) return 'happy';
    if (liquid > 0.3) return 'melt';
    if (game.danger > 0.25 && b.y - b.r < 60) return 'scared';
    if (v.restT > 16 && Math.sin(v.seed * 10 + game.time * 0.2) > 0.3) return 'sleep';
    if (b.tier === 8) return 'grumpy';
    return 'idle';
  }

  private drawCrane(ctx: CanvasRenderingContext2D, game: Game, t: number, opts: RenderOpts, line: number, dt: number): void {
    const W = game.rules.boxW;
    // 레일
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8B6650'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-WALL - 12, RAIL_Y); ctx.lineTo(W + WALL + 12, RAIL_Y); ctx.stroke();
    ctx.strokeStyle = '#B48A6E'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-WALL - 12, RAIL_Y - 2); ctx.lineTo(W + WALL + 12, RAIL_Y - 2); ctx.stroke();
    ctx.restore();

    const h = this.held;
    const target = game.holdX;
    const prevX = h.x;
    const f = dt * 60;
    h.x += (target - h.x) * Math.min(1, (opts.demo ? 0.12 : 0.6) * f);
    const vx = (h.x - prevX) / Math.max(f, 0.001);
    // 흔들림 스프링 (60fps 기준 계수)
    if (f > 0) {
      h.av += (-vx * 0.05 - h.a * 0.25 - h.av * 0.18) * f;
      h.a += h.av * f;
      h.a = clamp(h.a, -0.5, 0.5);
    }
    if (h.tier !== game.current) { h.tier = game.current; }
    h.lower = Math.min(1, h.lower + dt * 1.2 / Math.max(0.12, game.rules.dropCooldown));

    // 트롤리
    const tx = h.x;
    ctx.save();
    ctx.fillStyle = '#FF6F7D';
    roundRect(ctx, tx - 17, RAIL_Y - 10, 34, 18, 7); ctx.fill();
    ctx.strokeStyle = '#B83E4E'; ctx.lineWidth = line * 1.6; ctx.stroke();
    ctx.fillStyle = '#FFE2E6'; ctx.beginPath(); ctx.arc(tx - 7, RAIL_Y - 1, 2.6, 0, Math.PI * 2); ctx.arc(tx + 7, RAIL_Y - 1, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (!opts.showHeld || game.over) return;
    const tier = game.current;
    const r = radiusOf(tier) * VISUAL_SCALE * (game.liquify > 0 && tier !== NIP ? game.rules.liquifyShrink : 1);
    const ready = game.ready;
    const e = easeOut(h.lower);
    const cy = RAIL_Y + 8 + (game.rules.dropY - RAIL_Y - 8) * (ready ? 1 : e);
    const topY = cy - r;
    // 줄
    ctx.save();
    ctx.strokeStyle = '#6B4B3A'; ctx.lineWidth = line * 1.4;
    ctx.beginPath(); ctx.moveTo(tx, RAIL_Y + 8); ctx.lineTo(tx + Math.sin(h.a) * (topY - RAIL_Y) * 0.4, topY + 2); ctx.stroke();
    ctx.restore();
    if (!ready && h.lower < 0.05) return;

    // 떨어질 곳 안내선
    if (ready && !this.targeting) {
      const land = landingY(game, game.holdX, r / VISUAL_SCALE);
      ctx.save();
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -t * 40;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(game.holdX, cy + r + 4); ctx.lineTo(game.holdX, land); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(game.holdX, land, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    const pose: CatPose = {
      tier, x: tx + Math.sin(h.a) * r * 0.6, y: cy, r, a: h.a, squash: 0.06, clips: [], mood: tier === NIP ? 'idle' : 'held',
      lookX: 0, lookY: 1, blink: 0, t, seed: 3, line, held: true, detail: this.scale, alpha: ready ? 1 : 0.35 + 0.65 * e,
    };
    drawTail(ctx, pose);
    drawCat(ctx, pose);
  }

  private drawBoxBack(ctx: CanvasRenderingContext2D, game: Game): void {
    const W = game.rules.boxW, H = game.rules.boxH;
    ctx.save();
    // 안쪽 뒷면
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#C98E55'); g.addColorStop(1, '#AE733F');
    ctx.fillStyle = g;
    ctx.fillRect(0, -2, W, H + 2);
    // 골판지 결
    ctx.strokeStyle = 'rgba(90,50,20,0.07)'; ctx.lineWidth = 2;
    for (let x = 10; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    // 안쪽 그림자 (벽 쪽)
    const sl = ctx.createLinearGradient(0, 0, 26, 0);
    sl.addColorStop(0, 'rgba(60,30,10,0.28)'); sl.addColorStop(1, 'rgba(60,30,10,0)');
    ctx.fillStyle = sl; ctx.fillRect(0, 0, 26, H);
    const sr = ctx.createLinearGradient(W, 0, W - 26, 0);
    sr.addColorStop(0, 'rgba(60,30,10,0.28)'); sr.addColorStop(1, 'rgba(60,30,10,0)');
    ctx.fillStyle = sr; ctx.fillRect(W - 26, 0, 26, H);
    const sb = ctx.createLinearGradient(0, H, 0, H - 30);
    sb.addColorStop(0, 'rgba(60,30,10,0.3)'); sb.addColorStop(1, 'rgba(60,30,10,0)');
    ctx.fillStyle = sb; ctx.fillRect(0, H - 30, W, 30);
    // 인쇄 도장
    ctx.save();
    ctx.translate(W * 0.5, H * 0.46);
    ctx.rotate(-0.12);
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#7A2E1E'; ctx.fillStyle = '#7A2E1E';
    ctx.lineWidth = 4;
    roundRect(ctx, -110, -46, 220, 92, 14); ctx.stroke();
    ctx.font = `34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, t('box.stamp1'), 0, -12, 200);
    ctx.font = `20px ${FONT}`;
    fitText(ctx, t('box.stamp2'), 0, 24, 200);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.14; ctx.fillStyle = '#7A2E1E';
    ctx.translate(W * 0.2, H * 0.8);
    arrowUp(ctx); ctx.translate(26, 0); arrowUp(ctx);
    ctx.restore();

    // 날개 (위쪽 열린 뚜껑)
    const flap = (side: number) => {
      ctx.save();
      const x = side < 0 ? -WALL : W + WALL;
      ctx.translate(x, -4);
      ctx.scale(side, 1);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(WALL, 0); ctx.lineTo(WALL - 12, -58); ctx.lineTo(-24, -46); ctx.closePath();
      ctx.fillStyle = '#DDA567'; ctx.fill();
      ctx.strokeStyle = '#9C6632'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,220,0.55)';
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(4, -8); ctx.lineTo(-4, -50); ctx.lineTo(-14, -48); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    flap(-1); flap(1);
    // 벽과 바닥
    ctx.fillStyle = '#D69C5E';
    ctx.strokeStyle = '#9C6632'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(-WALL, -4, WALL, H + 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(W, -4, WALL, H + 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(-WALL, H, W + WALL * 2, WALL); ctx.fill(); ctx.stroke();
    // 골판지 단면 (벽 윗면)
    for (const x of [-WALL, W]) {
      ctx.fillStyle = '#F0C58F'; ctx.fillRect(x + 2, -4, WALL - 4, 6);
      ctx.strokeStyle = '#B98046'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(x + 2 + i * (WALL - 4) / 6, -1 + (i % 2 ? -2 : 2));
      ctx.stroke();
    }
    // 테이프
    ctx.fillStyle = 'rgba(245,225,170,0.75)';
    ctx.fillRect(-WALL - 2, H + WALL * 0.3, W + WALL * 2 + 4, WALL * 0.45);
    ctx.restore();
  }

  private drawRim(ctx: CanvasRenderingContext2D, game: Game, t: number): void {
    const W = game.rules.boxW;
    const d = game.danger;
    ctx.save();
    if (d > 0.02) {
      const pulse = 0.5 + 0.5 * Math.sin(t * (8 + d * 12));
      ctx.strokeStyle = `rgba(255,60,80,${0.55 + 0.45 * pulse})`;
      ctx.lineWidth = 3 + 2 * pulse;
    } else {
      const near = game.topY < 70 ? 0.55 : 0.28;
      ctx.strokeStyle = `rgba(255,255,255,${near})`;
      ctx.lineWidth = 2;
    }
    ctx.setLineDash([9, 7]);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.stroke();
    ctx.restore();
  }

  private paintBackground(game: Game): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    const dpr = this.dpr;
    ctx.scale(dpr, dpr);
    const w = this.cssW, h = this.cssH;
    const floorY = this.oy + (game.rules.boxH + WALL - 3) * this.scale;
    // 벽지
    const g = ctx.createLinearGradient(0, 0, 0, floorY);
    g.addColorStop(0, '#FFE3CC'); g.addColorStop(1, '#FFD2B3');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, floorY);
    // 발바닥 무늬
    ctx.fillStyle = 'rgba(214,140,110,0.14)';
    const step = 64;
    for (let y = -step / 2, row = 0; y < floorY; y += step * 0.75, row++) {
      for (let x = (row % 2) * step / 2 - step / 2; x < w + step; x += step) {
        paw(ctx, x, y, 7, (row * 7 + x) * 0.01);
      }
    }
    // 걸레받이
    ctx.fillStyle = '#FFF4EA'; ctx.fillRect(0, floorY - 14, w, 14);
    ctx.fillStyle = 'rgba(150,90,60,0.18)'; ctx.fillRect(0, floorY - 1, w, 2);
    // 나무 바닥
    const fg = ctx.createLinearGradient(0, floorY, 0, h);
    fg.addColorStop(0, '#E9BE8F'); fg.addColorStop(1, '#D9A774');
    ctx.fillStyle = fg; ctx.fillRect(0, floorY, w, h - floorY);
    ctx.strokeStyle = 'rgba(140,80,40,0.16)'; ctx.lineWidth = 1.5;
    for (let y = floorY + 16, i = 0; y < h; y += 22, i++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let x = (i % 2) * 60; x < w; x += 120) { ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x, y); ctx.stroke(); }
    }
    // 상자 그림자
    const cx = this.ox + game.rules.boxW / 2 * this.scale;
    const sw = (game.rules.boxW + WALL * 2 + 30) * this.scale / 2;
    const sg = ctx.createRadialGradient(cx, floorY + 4, 4, cx, floorY + 4, sw);
    sg.addColorStop(0, 'rgba(90,40,20,0.35)'); sg.addColorStop(1, 'rgba(90,40,20,0)');
    ctx.fillStyle = sg;
    ctx.save(); ctx.translate(cx, floorY + 4); ctx.scale(1, 0.12); ctx.translate(-cx, -(floorY + 4));
    ctx.beginPath(); ctx.arc(cx, floorY + 4, sw, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return c;
  }

  /** 공유용 이미지 (정사각형 1080) */
  renderCard(game: Game, info: { title: string; score: string; sub: string; best?: boolean }): HTMLCanvasElement {
    const S = 1080;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#FFE3CC'); g.addColorStop(1, '#FFC9A6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(214,140,110,0.16)';
    for (let y = 30, row = 0; y < S; y += 70, row++) for (let x = (row % 2) * 45; x < S; x += 90) paw(ctx, x, y, 10, x * 0.02);
    const W = game.rules.boxW, H = game.rules.boxH;
    const sc = Math.min(560 / (W + WALL * 2), 640 / (H + WALL + 70));
    ctx.save();
    ctx.translate(S * 0.62 - (W / 2) * sc, 250 + 70 * sc);
    ctx.scale(sc, sc);
    this.drawBoxBack(ctx, game);
    const bodies = game.world.bodies;
    const discs = bodies.map(b => ({ x: b.x, y: b.y, r: b.r * VISUAL_SCALE }));
    const clips: Clip[][] = [];
    buildClips(discs, W, H, clips);
    const poses: CatPose[] = bodies.map((b, i) => ({ tier: b.tier, x: b.x, y: b.y, r: discs[i].r, a: b.a + (this.vis.get(b.id)?.off ?? 0), squash: 0, clips: clips[i], mood: b.tier === 8 ? 'grumpy' : (i % 3 === 0 ? 'happy' : 'idle'), lookX: 0, lookY: 0, blink: 0, t: 1, seed: b.id, line: 2 / sc * 1.4, detail: sc }));
    const order = poses.map((_, i) => i).sort((a, b) => poses[b].y - poses[a].y);
    for (const i of order) drawTail(ctx, poses[i]);
    for (const i of order) drawCat(ctx, poses[i]);
    ctx.restore();
    // 글자
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const txt = (s: string, x: number, y: number, size: number, fill: string, stroke = '#4A2E23', sw = 0.22) => {
      ctx.font = `${size}px ${FONT}`;
      ctx.lineWidth = size * sw; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y);
      ctx.fillStyle = fill; ctx.fillText(s, x, y);
    };
    const name = t('app.name');
    txt(name, 60, 130, name.length > 6 ? 70 : 92, '#FFFFFF');
    ctx.font = `36px ${FONT}`; ctx.fillStyle = '#8A5A44'; ctx.fillText(info.title, 64, 190);
    txt(info.score, 60, 330, 104, '#FFD34D');
    ctx.font = `34px ${FONT}`; ctx.fillStyle = '#6B4436'; ctx.fillText(t('card.pts'), 64, 380);
    if (info.best) txt(t('card.best'), 60, 450, 44, '#FF6F7D', '#ffffff', 0.18);
    ctx.font = `30px ${FONT}`; ctx.fillStyle = '#6B4436';
    info.sub.split('\n').forEach((l, i) => ctx.fillText(l, 64, 540 + i * 46));
    ctx.font = `28px ${FONT}`; ctx.fillStyle = 'rgba(107,68,54,0.7)';
    ctx.fillText(t('card.tag'), 64, S - 60);
    return c;
  }
}

function landingY(game: Game, x: number, r: number): number {
  let y = game.rules.boxH - r;
  for (const b of game.world.bodies) {
    const dx = Math.abs(b.x - x), rr = r + b.r;
    if (dx >= rr) continue;
    const hy = b.y - Math.sqrt(rr * rr - dx * dx);
    if (hy < y) y = hy;
  }
  return y + r;
}

function comboColor(c: number): string {
  return c >= 5 ? '#FF7AC8' : c >= 4 ? '#B08CFF' : c >= 3 ? '#6CE4FF' : '#FFE46B';
}

function clamp(x: number, a: number, b: number): number { return x < a ? a : x > b ? b : x; }
function clampX(x: number, W: number): number { return clamp(x, 70, W - 70); }
function easeOut(x: number): number { return 1 - Math.pow(1 - clamp(x, 0, 1), 3); }

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.ellipse(0, s * 0.5, s * 0.9, s * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy] of [[-0.95, -0.45], [-0.35, -1.05], [0.35, -1.05], [0.95, -0.45]]) {
    ctx.beginPath(); ctx.ellipse(dx * s, dy * s, s * 0.33, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** 최대 폭을 넘으면 가로로 눌러 쓴다 */
function fitText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number): void {
  const w = ctx.measureText(s).width;
  if (w <= maxW) { ctx.fillText(s, x, y); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(maxW / w, 1); ctx.fillText(s, 0, 0); ctx.restore();
}

function arrowUp(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -18); ctx.lineTo(10, -4); ctx.lineTo(4, -4); ctx.lineTo(4, 14); ctx.lineTo(-4, 14); ctx.lineTo(-4, -4); ctx.lineTo(-10, -4);
  ctx.closePath(); ctx.fill();
}
