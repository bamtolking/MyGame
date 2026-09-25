// 캔버스 렌더러(야근 네온): 바닥·소품 → fx.drawGround → 장판·오라·예고 → 그림자·픽업·적·플레이어·궤도체·투사체·광선·적 탄
// → fx.drawWorld → 조명(어둠 오버레이 + fx.drawLights) → 블룸(fx.drawGlow) → fx.drawLabels(숫자·글자) → 월드 UI(말풍선·체력바·명판) → 화면 공간(fx.drawScreen·조이스틱)
// 선명함·속도: 스프라이트는 실제 기기 픽셀 배율로 캐시돼 있고, 변형이 없을 때는 정수 픽셀 위치에 1:1로 찍는다.
import type { World, Enemy, WeaponInst } from '../sim/types';
import { orbitPositions } from '../sim/weapons';
import { ENEMY } from '../content';
import type { EnemyDef, StageDef } from '../content/types';
import {
  angry, bubble, clearSpriteCache, coin, danger, ebullet, emoji, gem, gemColor, gemTier, glow, lightBeam, nameplate, person, setSpriteScale, shadow,
  silhouette, spark, spriteGen, spriteScale, syncSpriteScale, tinted, worker, type Sprite,
} from './sprites';
import { Fx, type View, type Quality } from './fx';
import { Post } from './post';
import { DEFAULT_ENV, drawAmbient, drawFloor, drawPropAnims, drawProps, envOf, lightPower, resetEnvCanvases, visibleProps, type EnvStyle, type Placed } from './env';
import { hexA as colorA, neon } from './color';

export const VIEW_SHORT = 420;   // 화면 짧은 변에 보이는 월드 단위

export interface Joy { active: boolean; bx: number; by: number; kx: number; ky: number }

interface Dust { x: number; y: number; t: number; life: number; r: number; vx: number }

const TAU = Math.PI * 2;
/** 0..1 소수부. JS %는 왼쪽 부호를 따라가 음수 좌표에서 음수가 되고, 그 값으로 만든 반지름이 음수면 arc·ellipse가 예외를 던진다 */
const frac = (v: number) => v - Math.floor(v);
// 점선 패턴(프레임마다 배열을 새로 만들지 않게)
const NO_DASH: number[] = [], DASH_ZONE = [7, 5], DASH_AURA = [12, 7], DASH_AURA2 = [3, 9], DASH_SLAM = [9, 6], DASH_LOB = [5, 5], DASH_CHARGE = [10, 8];
const TAIL: [number, number][] = [[0.62, 0.1], [0.4, 0.12], [0.2, 0.16]];   // 궤도체 꼬리: [길이(rad), 진하기]
const PICKUP_ICON: Record<string, string> = { chest: '📦', coffee: '☕', chicken: '🍗', magnet: '🧲', bomb: '💣', clock: '⏰' };
const PICKUP_GLOW: Record<string, string> = { chest: '#ffd84d', coffee: '#ffb070', chicken: '#ffcf70', magnet: '#ff6b6b', bomb: '#ff8a3d', clock: '#8fd8ff' };

export class Renderer {
  g: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; zoom = 1;
  camX = 0; camY = 0;
  low = false;
  dprCap = 2;
  time = 0;
  demo = false;        // 타이틀 어트랙트 데모: 플레이어 체력바를 그리지 않는다(app이 켠다)
  live = true;         // 시뮬레이션이 진행 중인지(일시정지·모달 중엔 먼지·불씨 등 생성 안 함)
  frameDt = 1 / 60;
  /** 그래픽 품질: 'auto'는 앱이 프레임 시간으로 high/medium/low를 오가며 정한다 */
  quality: Quality = 'high';
  private S = 1; private bx = 0; private by = 0;   // 월드 → 기기 픽셀 변환(bx·by는 정수)
  private SS = 1; private k = 1; private exact = true;   // 스프라이트 배율, S/SS, 1:1로 찍을 수 있는지
  private ipx = 0; private ipy = 0;
  private post = new Post();
  private props: Placed[] = [];
  private slotW: (WeaponInst | undefined)[] = [];
  private env: EnvStyle = DEFAULT_ENV;
  private lean = 0;
  private dust: Dust[] = [];
  private dustT = 0;
  private seed = 12345;
  private bossList: Enemy[] = [];
  private orbitPrev: number[] = [];
  private warmStage: StageDef | null = null;
  private warmGen = -1;
  private warmQ: [EnemyDef, number][] = [];   // [적, 걷기 프레임]
  private ctxLost = false;
  private stillAt = -1;   // 시뮬레이션이 멈춘 시각(ms, 움직이는 중이면 -1)
  private orbitDir: number[] = [];

  constructor(public canvas: HTMLCanvasElement, public fx: Fx) {
    this.g = canvas.getContext('2d', { alpha: false })!;
    for (let i = 0; i < 18; i++) this.dust.push({ x: 0, y: 0, t: 1, life: 1, r: 4, vx: 0 });
    // GPU 프로세스가 죽거나 초기화되면(저사양 안드로이드의 앱 전환 등) 캔버스 문맥을 잃었다 되찾는다 → 다음 프레임 시작에 캐시를 비운다
    canvas.addEventListener('contextrestored', () => { this.ctxLost = true; });
    this.resize();
  }

  /** 문맥을 되찾으면 오프스크린 캐시 캔버스(스프라이트·바닥 타일·후처리·fx 시트)가 빈 채로 남는다.
   *  캐시 키는 그대로라 저절로 다시 그려지지 않으므로 전부 비워 다시 굽게 한다 */
  private resetCanvases() {
    clearSpriteCache();
    resetEnvCanvases();
    this.post.reset();
    this.post.resize(this.canvas.width, this.canvas.height);
    this.fx.invalidateText();
    (this.fx as { resetCanvases?: () => void }).resetCanvases?.();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.dpr = Math.min(this.dprCap, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.zoom = Math.min(this.W, this.H) / VIEW_SHORT;
    setSpriteScale(this.zoom * this.dpr);
    (this.fx as { numScale?: number }).numScale = Math.max(1, Math.round(this.zoom * this.dpr * 2) / 2);
    this.post.resize(this.canvas.width, this.canvas.height);
  }

  viewSize(): [number, number] { return [this.W / this.zoom, this.H / this.zoom]; }

  setLow(low: boolean) { this.setQuality(low ? 'low' : 'high'); }

  setQuality(q: Quality) {
    this.quality = q;
    (this.fx as { quality?: Quality }).quality = q;
    this.low = q === 'low';
    this.fx.setLow(this.low);
    this.resize();
  }

  private rnd() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }

  /** 월드 변환 */
  private world(g = this.g) { g.setTransform(this.S, 0, 0, this.S, this.bx, this.by); }

  /** 식별 변환 상태에서 스프라이트를 앵커 기준으로 찍는다(배율이 맞으면 정수 픽셀 1:1) */
  private blit(s: Sprite, x: number, y: number) {
    const dx = this.bx + x * this.S - s.ax * this.SS * this.k, dy = this.by + y * this.S - s.ay * this.SS * this.k;
    if (this.exact) this.g.drawImage(s.c, Math.round(dx), Math.round(dy));
    else this.g.drawImage(s.c, dx, dy, s.c.width * this.k, s.c.height * this.k);
  }

  /** 스프라이트 s 모양의 캔버스 c(원본 또는 색 실루엣)를 앵커 기준 kx·ky배로 찍는다(kx < 0 = 좌우 반전).
   *  c는 s.c 크기로 늘려 찍으므로 반 해상도 실루엣도 딱 겹친다. 끝나면 변환은 호출한 쪽이 다시 맞춘다 */
  private stamp(s: Sprite, c: HTMLCanvasElement, x: number, y: number, kx: number, ky: number) {
    this.g.setTransform(this.k * kx, 0, 0, this.k * ky, this.bx + x * this.S, this.by + y * this.S);
    this.g.drawImage(c, -s.ax * this.SS, -s.ay * this.SS, s.c.width, s.c.height);
  }

  /** 회전·확대 스프라이트(행렬 직접 설정, save/restore 없음). 끝나면 변환은 호출한 쪽이 다시 맞춘다 */
  private rot(s: Sprite, x: number, y: number, a: number, sc = 1) {
    const k = this.k * sc, c = Math.cos(a) * k, n = Math.sin(a) * k;
    this.g.setTransform(c, n, -n, c, this.bx + x * this.S, this.by + y * this.S);
    this.g.drawImage(s.c, -s.ax * this.SS, -s.ay * this.SS);
  }

  /** 버퍼 g에 부드러운 빛(glow 텍스처)을 월드 좌표로 그린다 */
  private light(g: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, a: number) {
    if (a <= 0.01) return;
    const s = glow(color, r);
    g.globalAlpha = Math.min(1, a);
    g.drawImage(s.c, x - r, y - r, r * 2, r * 2);
  }

  /** 근무지가 바뀌거나 캐시가 비워지면(배율·글꼴·문맥) 그 근무지 적 스프라이트(외곽선·림라이트 가공)를 프레임마다 조금씩 미리 만들어
   *  첫 등장 때 끊김을 없앤다. 사람형(보스)은 걷기 자세 셋 + 붉은 림 실루엣까지 — 비싸서 한 프레임에 하나씩 */
  private warm(w: World) {
    const st = w.cfg.stage, gen = spriteGen();
    if (st !== this.warmStage || gen !== this.warmGen) {
      this.warmStage = st; this.warmGen = gen;
      const ids = new Set<string>([st.finalBoss]);
      for (const seg of st.timeline) for (const e of seg.pool) ids.add(e.enemy);
      for (const ev of st.events) if (ev.enemy) ids.add(ev.enemy);
      for (const e of st.overtimePool) ids.add(e.enemy);
      this.warmQ.length = 0;
      for (const id of ids) {
        const d = ENEMY.get(id);
        if (!d) continue;
        if (d.body && !d.label) for (const f of [3, 1, 0]) this.warmQ.push([d, f]);
        else this.warmQ.push([d, 0]);
      }
    }
    const big = w.flags.has('bigHead') ? 1.35 : 1;
    for (let n = 0; n < 2 && this.warmQ.length; n++) {
      const [d, f] = this.warmQ.pop()!, r = d.radius * big;
      if (d.label) bubble(d.label, r, d.tint ?? '#ff5a7a');
      else if (d.body) {
        const s = person(d.sprite, d.body.suit, d.body.tie, r, f, d.boss ? '#ff5446' : d.elite ? '#ffd76a' : envOf(st).rim);
        if (d.boss) silhouette(s, '#ff2a36');
        n++;
      } else angry(d.sprite, Math.round(r * 2.1), d.tint ?? (d.elite ? '#ffb000' : '#ff3b5c'), envOf(st).rim, !!d.elite);
    }
  }

  /** steps = 이번 프레임에 진행된 시뮬레이션 스텝 수. 카메라도 스텝 단위로 움직여 90/120Hz 화면에서 월드와 어긋나지 않는다. */
  render(w: World, dt: number, joy: Joy | null, steps = 1) {
    const g = this.g;
    const fx = this.fx;
    // 문맥을 잃은 동안은 그려도 버려진다. 되찾으면(이벤트 또는 여기서 본 잃음) 캐시를 비운다
    if (g.isContextLost?.()) { this.ctxLost = true; return; }
    if (this.ctxLost) { this.ctxLost = false; this.resetCanvases(); }
    // 작은 화면 변화로 미뤄 둔 스프라이트 배율은 멈춘 지 0.5초 지나서(일시정지·모달이 다 뜬 뒤) 맞춘다 — 다시 굽는 끊김이 안 보이게
    if (this.live) this.stillAt = -1;
    else if (this.stillAt < 0) this.stillAt = performance.now();
    else if (performance.now() - this.stillAt > 500) syncSpriteScale();
    this.time += dt;
    this.frameDt = dt;
    const p = w.player;
    const px = p.x, py = p.y;
    this.ipx = px; this.ipy = py;
    // 카메라: 플레이어를 부드럽게 따라감(스텝당 18%)
    const ck = 1 - Math.pow(0.82, steps);
    this.camX += (px - this.camX) * ck;
    this.camY += (py - this.camY) * ck;
    if (Math.abs(px - this.camX) > 300 || Math.abs(py - this.camY) > 300) { this.camX = px; this.camY = py; }
    const [shx, shy] = fx.shakeOffset();
    const punch = fx.zoomPunch() || 1;
    const S = this.zoom * this.dpr * punch;
    const cw = this.canvas.width, ch = this.canvas.height;
    const cx = this.camX + shx / this.zoom, cy = this.camY + shy / this.zoom;
    this.S = S;
    this.bx = Math.round(cw / 2 - cx * S); this.by = Math.round(ch / 2 - cy * S);
    this.SS = spriteScale(); this.k = S / this.SS; this.exact = Math.abs(this.k - 1) < 1e-6;
    const x0 = -this.bx / S, y0 = -this.by / S, x1 = (cw - this.bx) / S, y1 = (ch - this.by) / S;
    const view: View = { x0, y0, x1, y1, S, bx: this.bx, by: this.by, W: this.W, H: this.H, dpr: this.dpr, time: this.time, quality: this.quality };
    const st = w.cfg.stage;
    const env = this.env = envOf(st);
    this.warm(w);
    for (let i = 0; i < this.slotW.length; i++) this.slotW[i] = undefined;
    for (const wi of w.weapons) this.slotW[wi.slot] = wi;
    const vis = (x: number, y: number, m = 60) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;

    // ── 바닥·소품 ──
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // 바닥색을 먼저 깐다: 타일이 비어도(문맥을 잃었다 되찾는 등) 이전 프레임이 번져 남지 않게
    g.fillStyle = st.palette.floor; g.fillRect(0, 0, cw, ch);
    drawFloor(g, st, view, this.exact);
    visibleProps(st, x0, y0, x1, y1, this.props);
    drawProps(g, st, this.props, view, this.exact);
    this.world();
    drawPropAnims(g, this.props, this.time, glow('rgba(150,140,135,.9)', 1));
    drawAmbient(g, st, view, this.time, this.low ? 0.6 : 1);
    fx.drawGround(g, view);
    this.world(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

    this.drawZones(w, vis);
    this.drawAura(w, px, py);
    this.drawBlasts(w, vis);
    this.drawGroundMarks(w, vis, dt);

    // ── 그림자 ──
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.low) {
      for (const e of w.enemies) {
        if (e.dead || !vis(e.x, e.y)) continue;
        this.blit(shadow(e.boss ? e.r * 1.3 : e.r), e.x, e.y + e.r * (e.def.body ? 1.3 : e.def.label ? 0.9 : 0.85));
      }
      this.blit(shadow(13), px, py + 14);
    }

    // ── 픽업 ──
    this.drawPickups(w, vis);

    // ── 적 → 플레이어. 보스는 발 위치로 앞뒤를 가른다: 플레이어보다 뒤(위쪽)면 밑에, 앞(아래쪽)이면 위에 그리고
    //    그 몸에 플레이어가 가려지면 플레이어를 반투명하게 한 번 더 얹어 늘 먼저 읽히게 ──
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bosses = this.bossList; bosses.length = 0;
    let burnN = 0;
    for (const e of w.enemies) {
      if (e.dead || !vis(e.x, e.y, e.r * (e.def.label || e.def.body ? 3.2 : 1.4) + 30)) continue;
      if (e.boss) { bosses.push(e); continue; }
      this.drawEnemy(e);
      if (e.burnT > 0 && this.live && burnN < 14 && this.rnd() < dt * 8) { burnN++; fx.burst(e.x, e.y - e.r * 0.5, '#ff7a1a', 1, 40, 2.5, 1, -80); }
    }
    const pf = py + 14;   // 플레이어 발(그림자 자리)
    for (const e of bosses) if (e.y + e.r * (e.def.body ? 1.3 : 0.85) <= pf) this.drawEnemy(e);
    this.drawPlayer(w);
    g.setTransform(1, 0, 0, 1, 0, 0);
    let hidden = false;
    for (const e of bosses) {
      if (e.y + e.r * (e.def.body ? 1.3 : 0.85) <= pf) continue;
      this.drawEnemy(e);
      // 보스 몸통(사람형: 가로 ±1.05r, 머리 꼭대기 -1.6r)이 플레이어 몸(가로 ±16, 세로 -27..+18)을 덮는지
      if (Math.abs(e.x - px) < e.r * (e.def.body ? 1.05 : 0.9) + 16 && e.y - e.r * (e.def.body ? 1.6 : 0.9) < py + 18) hidden = true;
    }
    if (hidden) this.drawPlayer(w, true);
    this.drawTelegraphs(w, vis);

    // ── 궤도 무기·드론·투사체·광선·적 탄 ──
    this.drawOrbitals(w, px, py);
    this.drawBullets(w, vis);
    this.drawBeams(w, px, py);
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const b of w.ebullets) {
      if (b.dead || !vis(b.x, b.y, 20)) continue;
      if (b.sprite && b.sprite !== '•') this.blit(danger(b.sprite, 14), b.x, b.y);
      else this.blit(ebullet(b.r), b.x, b.y);
    }

    this.world(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    fx.drawWorld(g, view);

    // ── 조명·블룸 ──
    if (this.quality !== 'low') {
      const [lg, lv] = this.post.lightBegin(view);
      fx.drawLights(lg, lv);
      if (this.quality === 'high') {
        const [dg, dv] = this.post.darkBegin(view, env, st.palette.fog);
        this.darkLights(dg, dv, w);
        this.post.darkEnd(g, 0.85);
      } else this.post.overlay(g, env, st.palette.fog, true, (185 * this.zoom * this.dpr) / Math.min(cw, ch));
      const [bg, bv] = this.post.bloomBegin(view);
      this.bloom(bg, bv, w);
      this.post.addLights(0.38);
      bg.setTransform(bv.S, 0, 0, bv.S, bv.bx, bv.by);
      bg.globalAlpha = 1; bg.globalCompositeOperation = 'lighter';
      fx.drawGlow(bg, bv);
      this.post.bloomEnd(g, this.quality === 'high', 0.85);
    } else this.post.overlay(g, env, st.palette.fog, false, 0);

    // ── 피해 숫자·떠오르는 글자(조명·블룸 뒤: 등불 밖에서도 어둠에 묻히지 않게) ──
    this.world(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    fx.drawLabels(g, view);

    // ── 월드 UI(조명 영향 없이 또렷하게) ──
    this.drawWorldUi(w, vis);

    // ── 화면 공간 ──
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    this.drawIndicators(w, cx, cy);
    if (p.hp / w.d.maxHp < 0.3) { this.post.lowHp(g, 0.65 + Math.sin(this.time * 6) * 0.3); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
    if (p.clockT > 0) { g.fillStyle = 'rgba(120,200,255,.1)'; g.fillRect(0, 0, this.W, this.H); }
    fx.drawScreen(g, view);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (joy && joy.active) this.drawJoystick(joy);
  }

  // ───────────── 바닥 레이어 ─────────────

  private drawZones(w: World, vis: (x: number, y: number, m?: number) => boolean) {
    const g = this.g;
    for (const z of w.zones) {
      if (!vis(z.x, z.y, z.r)) continue;
      const k = Math.min(1, z.t * 4) * Math.min(1, (z.life - z.t) * 2);
      const col = z.hostile ? '#ff2e4a' : neon(z.color);
      g.globalAlpha = (z.hostile ? 0.2 : 0.34) * k;
      g.fillStyle = z.hostile ? '#ff2e4a' : z.color;
      g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.fill();
      g.globalAlpha = 0.12 * k; g.fillStyle = col;
      g.beginPath(); g.arc(z.x, z.y, z.r * (0.45 + frac(this.time * 0.8 + z.x * 0.01) * 0.5), 0, TAU); g.fill();
      g.globalAlpha = 0.75 * k;
      g.strokeStyle = col;
      g.lineWidth = z.hostile ? 2.4 : 1.6;
      g.setLineDash(z.hostile ? DASH_ZONE : NO_DASH);
      g.lineDashOffset = -this.time * 22;
      g.beginPath(); g.arc(z.x, z.y, z.r * (0.97 + Math.sin(this.time * 6 + z.x) * 0.03), 0, TAU); g.stroke();
      g.setLineDash(NO_DASH);
    }
    g.globalAlpha = 1;
  }

  private drawAura(w: World, px: number, py: number) {
    const g = this.g;
    for (const wi of w.weapons) {
      if (wi.def.archetype !== 'aura') continue;
      const r = wi.st.area * w.d.areaMul;
      const col = neon(wi.def.color);
      const pulse = Math.sin(this.time * 5) * 0.08;
      this.light(g, colorA(col, 0.3), px, py, r * 1.05, 0.9 + pulse);
      g.strokeStyle = col;
      g.globalAlpha = 0.6; g.lineWidth = 2;
      g.setLineDash(DASH_AURA); g.lineDashOffset = -this.time * 30;
      g.beginPath(); g.arc(px, py, r, 0, TAU); g.stroke();
      g.globalAlpha = 0.3; g.lineWidth = 1.2;
      g.setLineDash(DASH_AURA2); g.lineDashOffset = this.time * 46;
      g.beginPath(); g.arc(px, py, r * 0.84, 0, TAU); g.stroke();
      g.setLineDash(NO_DASH);
      g.globalAlpha = 1;
    }
  }

  private drawBlasts(w: World, vis: (x: number, y: number, m?: number) => boolean) {
    const g = this.g;
    for (const b of w.blasts) {
      if (!vis(b.x, b.y, b.r + 40)) continue;
      const k = Math.min(1, b.t / Math.max(0.01, b.delay));
      if (b.kind === 'slam') {
        g.globalAlpha = 0.14 + 0.16 * k;
        g.fillStyle = '#ff2240';
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill();
        g.globalAlpha = 0.3; g.fillStyle = '#ff5a3a';
        g.beginPath(); g.arc(b.x, b.y, b.r * k, 0, TAU); g.fill();
        g.globalAlpha = 0.95;
        g.strokeStyle = '#ff3b4a'; g.lineWidth = 2.6;
        g.setLineDash(DASH_SLAM); g.lineDashOffset = -this.time * 40;
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke();
        g.setLineDash(NO_DASH);
        g.lineWidth = 1.6; g.strokeStyle = '#ffd0c8';
        g.beginPath(); g.arc(b.x, b.y, b.r * k, 0, TAU); g.stroke();
      } else if (b.kind === 'strike' || b.kind === 'ult') {
        const col = neon(b.color);
        g.globalAlpha = 0.35 + 0.45 * k;
        g.strokeStyle = col; g.lineWidth = 2;
        const rr = b.r * (1.3 - 0.3 * k);
        g.beginPath(); g.arc(b.x, b.y, rr, 0, TAU); g.stroke();
        g.lineWidth = 1.2;
        g.beginPath();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + this.time * 2; g.moveTo(b.x + Math.cos(a) * rr * 0.55, b.y + Math.sin(a) * rr * 0.55); g.lineTo(b.x + Math.cos(a) * rr * 0.85, b.y + Math.sin(a) * rr * 0.85); }
        g.stroke();
        g.globalAlpha = 0.12 * k; g.fillStyle = col;
        g.beginPath(); g.arc(b.x, b.y, rr, 0, TAU); g.fill();
        g.globalAlpha = 1;
        if (b.sprite) { this.rot(emoji(b.sprite, 18), b.x, b.y - (1 - k) * 160, 0); this.world(); }
      } else if (b.kind === 'lob') {
        const lx = b.sx + (b.x - b.sx) * k, ly = b.sy + (b.y - b.sy) * k;
        const h = Math.sin(k * Math.PI) * 70;
        g.globalAlpha = 0.35;
        g.fillStyle = '#000';
        g.beginPath(); g.ellipse(lx, ly, 7 * (1 - h / 140), 3.5 * (1 - h / 140), 0, 0, TAU); g.fill();
        g.globalAlpha = 0.5 * k;
        g.strokeStyle = neon(b.color); g.lineWidth = 1.5;
        g.setLineDash(DASH_LOB); g.lineDashOffset = -this.time * 30;
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke();
        g.setLineDash(NO_DASH);
        g.globalAlpha = 1;
        this.rot(emoji(b.sprite || '●', 16), lx, ly - h, k * 8); this.world();
      } else if (b.kind === 'mine') {
        const blink = b.armed && Math.floor(this.time * 6 + b.x) % 2 === 0;
        g.globalAlpha = b.armed ? 1 : 0.6;
        if (b.armed) {
          g.globalAlpha = 0.25 + Math.sin(this.time * 4 + b.x) * 0.1; g.strokeStyle = neon(b.color); g.lineWidth = 1;
          g.beginPath(); g.arc(b.x, b.y, 11, 0, TAU); g.stroke();
          g.globalAlpha = 1;
        }
        this.rot(emoji(b.sprite || '●', 16), b.x, b.y, 0); this.world();
        if (blink) { g.globalAlpha = 0.9; g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(b.x, b.y - 8, 1.8, 0, TAU); g.fill(); }
      }
      g.globalAlpha = 1;
    }
    g.globalAlpha = 1;
  }

  /** 발밑 표시: 플레이어 발밑 빛·달리기 먼지, 엘리트·보스 바닥 고리 */
  private drawGroundMarks(w: World, vis: (x: number, y: number, m?: number) => boolean, dt: number) {
    const g = this.g, p = w.player, env = this.env;
    // 플레이어 발밑의 따뜻한 빛
    this.light(g, colorA(env.lamp, 0.3), p.x, p.y + 10, this.low ? 42 : 58, 1);
    // 먼지: 달릴 때 발뒤꿈치에서
    if (this.live && p.moving) {
      this.dustT += dt;
      if (this.dustT > 0.085) {
        this.dustT = 0;
        const d = this.dust.find(x => x.t >= x.life);
        if (d) { d.x = p.x - p.mx * 7 + (this.rnd() - 0.5) * 6; d.y = p.y + 13 + (this.rnd() - 0.5) * 2; d.t = 0; d.life = 0.3 + this.rnd() * 0.18; d.r = 2.6 + this.rnd() * 2; d.vx = -p.mx * 16; }
      }
    }
    const puff = glow('rgba(190,185,175,.7)', 1);
    for (const d of this.dust) {
      if (d.t >= d.life) continue;
      if (this.live) { d.t += dt; d.x += d.vx * dt; d.y -= dt * 8; }
      const k = d.t / d.life, r = d.r * (1 + k * 2);
      g.globalAlpha = 0.2 * (1 - k) * (1 - k);
      g.drawImage(puff.c, d.x - r, d.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    // 엘리트·보스 바닥 오라
    for (const e of w.enemies) {
      if (e.dead || !(e.elite || e.boss) || !vis(e.x, e.y)) continue;
      const fy = e.y + e.r * (e.def.body ? 1.3 : 0.85);
      const col = e.boss ? '#ff3b4a' : '#ffcf33';
      const pulse = 0.5 + Math.sin(this.time * 5 + e.seed) * 0.5;
      const rr = e.r * (e.boss ? 1.9 : 1.45);
      g.globalAlpha = 0.14 + pulse * 0.08; g.fillStyle = col;
      g.beginPath(); g.ellipse(e.x, fy, rr, rr * 0.4, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.55 + pulse * 0.35; g.strokeStyle = col; g.lineWidth = e.boss ? 2.4 : 1.6;
      g.beginPath(); g.ellipse(e.x, fy, rr, rr * 0.4, 0, 0, TAU); g.stroke();
      g.globalAlpha = 0.35 * (1 - pulse); g.lineWidth = 1;
      g.beginPath(); g.ellipse(e.x, fy, rr * (1.1 + pulse * 0.25), rr * 0.4 * (1.1 + pulse * 0.25), 0, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
  }

  // ───────────── 픽업 ─────────────

  private drawPickups(w: World, vis: (x: number, y: number, m?: number) => boolean) {
    const g = this.g, p = w.player;
    // 끌려오는 보석·코인의 줄무늬 잔상(색별로 한 번에)
    this.world();
    g.lineCap = 'round';
    for (let tier = -1; tier < 5; tier++) {
      let n = 0;
      g.beginPath();
      for (const k of w.pickups) {
        if (k.dead || !k.pull || k.pt < 0.08 || !vis(k.x, k.y, 20)) continue;
        if (tier < 0 ? k.kind !== 'coin' : k.kind !== 'xp' || gemTier(k.value) !== tier) continue;
        const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
        const len = Math.min(22, (260 + k.pt * 1500) * 0.022);
        g.moveTo(k.x, k.y); g.lineTo(k.x - dx / d * len, k.y - dy / d * len);
        n++;
      }
      if (!n) continue;
      g.strokeStyle = tier < 0 ? '#ffd84d' : gemColor(tier);
      g.globalAlpha = 0.45; g.lineWidth = tier < 0 ? 3 : 2.4 + tier * 0.4;
      g.stroke();
    }
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const t = this.time;
    for (const k of w.pickups) {
      if (k.dead || !vis(k.x, k.y, 30)) continue;
      const bob = Math.sin(t * 4 + k.x * 0.05) * 1.5;
      if (k.kind === 'xp') {
        this.blit(gem(gemTier(k.value)), k.x, k.y + bob);
        // 가끔 반짝(위치마다 위상이 달라 화면 전체가 은은하게 반짝인다)
        const tw = Math.sin(t * 2.3 + k.x * 0.37 + k.y * 0.61);
        if (tw > 0.97) {
          const sp = spark(), r = (3 + (tw - 0.97) * 170) * this.S;
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.9;
          g.drawImage(sp.c, this.bx + (k.x - 2) * this.S - r, this.by + (k.y + bob - 3) * this.S - r, r * 2, r * 2);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        }
      }
      else if (k.kind === 'coin') {
        const s = coin();
        const sc = Math.cos(t * 5 + k.x);
        const aw = Math.max(0.16, Math.abs(sc));
        const dx = this.bx + k.x * this.S, dy = this.by + (k.y + bob) * this.S, kk = this.k;
        g.drawImage(s.c, dx - s.c.width * kk * aw / 2, dy - s.ay * this.SS * kk, s.c.width * kk * aw, s.c.height * kk);
        if (sc > 0.93) { const sp = spark(); const r = 5 * this.S; g.globalCompositeOperation = 'lighter'; g.globalAlpha = (sc - 0.93) * 12; g.drawImage(sp.c, dx - r - 2 * this.S, dy - r - 2 * this.S, r * 2, r * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      }
    }
    // 아이템: 바닥 고리 + 아이콘(+ 상자 빛기둥)
    for (const k of w.pickups) {
      if (k.dead || k.kind === 'xp' || k.kind === 'coin' || !vis(k.x, k.y, 60)) continue;
      const bob = Math.sin(t * 4 + k.x * 0.05) * 1.5;
      const big = k.kind === 'chest';
      const col = k.bossChest ? '#ff6bd6' : PICKUP_GLOW[k.kind] ?? '#ffffff';
      this.world();
      if (big) { const lb = lightBeam(col); g.globalAlpha = 0.5 + Math.sin(t * 3) * 0.12; g.drawImage(lb.c, k.x - 18, k.y - lb.ay * 0.9 + 6, 36, lb.h * 0.9); }
      const pr = frac(t * 1.2 + k.x * 0.01);
      g.globalAlpha = 0.6 * (1 - pr); g.strokeStyle = col; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(k.x, k.y + 9, (big ? 16 : 10) * (0.6 + pr * 0.8), (big ? 6 : 4) * (0.6 + pr * 0.8), 0, 0, TAU); g.stroke();
      if (this.low) this.light(g, colorA(col, 0.5), k.x, k.y + bob, big ? 30 : 18, 0.7);
      g.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
      this.blit(emoji(PICKUP_ICON[k.kind] ?? '⏰', big ? 26 : 18), k.x, k.y + bob * 2);
    }
  }

  // ───────────── 적 ─────────────

  private enemySprite(e: Enemy): Sprite {
    const d = e.def;
    if (d.label) return bubble(d.label, e.r, d.tint ?? '#ff5a7a');
    if (d.body) return person(d.sprite, d.body.suit, d.body.tie, e.r, Math.floor(this.time * 6 + e.seed) & 3, e.boss ? '#ff5446' : e.elite ? '#ffd76a' : this.env.rim);
    return angry(d.sprite, Math.round(e.r * 2.1), d.tint ?? (e.elite ? '#ffb000' : '#ff3b5c'), this.env.rim, e.elite);
  }

  /** 적의 색 실루엣 캔버스: 사람형(보스)은 반 해상도(stamp처럼 원본 크기로 늘려 찍는다), 나머지는 원본 해상도 */
  private tint(s: Sprite, half: boolean, color: string): HTMLCanvasElement { return (half ? silhouette(s, color) : tinted(s, color)).c; }

  /** 식별 변환 상태에서 호출. 끝나면 식별 변환으로 돌려 둔다 */
  private drawEnemy(e: Enemy) {
    const g = this.g;
    const s = this.enemySprite(e);
    // 사람형(보스)은 오른쪽을 보는 그림만 캐시하고, 왼쪽을 볼 때는 찍을 때 좌우로 뒤집는다
    const body = !!e.def.body && !e.def.label, mir = body && e.face < 0 ? -1 : 1;
    let sx = 1, sy = 1;
    // 등장: 튀어나오듯 커졌다가 안착
    if (e.spawnT > 0) { const t = 1 - e.spawnT / 0.25; const q = t < 0.7 ? (t / 0.7) * 1.14 : 1.14 - ((t - 0.7) / 0.3) * 0.14; sx = sy = Math.max(0.05, q); }
    let x = e.x, y = e.y;
    if (!e.def.body && !e.def.label) y -= Math.abs(Math.sin(this.time * 7 + e.seed)) * 1.6;
    // 예고 흔들림
    if (e.st === 11 || e.st === 21 || e.st === 1) { x += Math.sin(this.time * 60) * 1.5; const q = 1 + Math.sin(this.time * 30) * 0.06; sx *= q; sy *= q; }
    // 피격: 흰 번쩍임 + 60ms 찌그러짐(가로 1.25·세로 0.8) + 뒤로 살짝 밀림, 이어서 작은 반동
    const fl = e.flash > 0 ? e.flash / 0.12 : 0;
    // 큰 적(엘리트·보스)은 계속 맞아도 형체가 보이게: 몸 전체 대신 흰 테두리가 번쩍이고 찌그러짐도 작게
    const big = e.boss || e.elite;
    const heavy = e.boss ? 0.3 : e.elite ? 0.6 : 1;
    const flashA = big ? fl * 0.16 : Math.min(0.95, fl * 1.35);
    if (fl > 0) {
      const t = 1 - fl;
      const q = (t < 0.5 ? 1 - t * 2 : 0) * heavy;
      const rb = (t >= 0.5 ? Math.sin((t - 0.5) * 2 * Math.PI) * 0.35 : 0) * heavy;
      sx *= 1 + 0.25 * q - 0.07 * rb; sy *= 1 - 0.2 * q + 0.07 * rb;
      const dx = e.x - this.ipx, dy = e.y - this.ipy, L = Math.hypot(dx, dy) || 1;
      x += dx / L * 2.6 * q; y += dy / L * 2.6 * q;
    }
    if (big) {
      // 뒤에 살짝 큰 실루엣: 보스는 붉은 림 맥동, 맞으면 흰 테두리 번쩍임
      const pl = 0.5 + Math.sin(this.time * 4) * 0.5;
      if (e.boss) { const q = 1.04 + pl * 0.03; g.globalAlpha = 0.25 + pl * 0.35; this.stamp(s, this.tint(s, body, '#ff2a36'), x, y, q * mir, q); }
      if (fl > 0) { const q = e.boss ? 1.05 : 1.08; g.globalAlpha = Math.min(0.85, fl * 1.2); this.stamp(s, this.tint(s, body, '#ffffff'), x, y, q * mir, q); }
      g.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    const ax = this.bx + x * this.S, ay = this.by + y * this.S;
    const sw = s.c.width, sh = s.c.height;
    if (sx === 1 && sy === 1 && this.exact) {
      // 1:1 정수 픽셀. 뒤집을 때는 x축만 -1(정수 이동이라 여전히 픽셀 그대로)
      const dy = Math.round(ay - s.ay * this.SS);
      let dx = 0;
      if (mir < 0) g.setTransform(-1, 0, 0, 1, Math.round(ax + s.ax * this.SS), 0);
      else dx = Math.round(ax - s.ax * this.SS);
      g.drawImage(s.c, dx, dy);
      if (fl > 0) { g.globalAlpha = flashA; g.drawImage(this.tint(s, body, '#ffffff'), dx, dy, sw, sh); g.globalAlpha = 1; }
      if (e.freezeT > 0) { g.globalAlpha = 0.5; g.drawImage(this.tint(s, body, '#9fe8ff'), dx, dy, sw, sh); g.globalAlpha = 1; }
      if (mir < 0) g.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      // 발끝 기준으로 찌그러뜨림
      const fp = (s.h - s.ay) * 0.8 * this.SS;
      const kx = sx * this.k, ky = sy * this.k;
      const ox = -s.ax * this.SS, oy = -s.ay * this.SS;
      g.setTransform(kx * mir, 0, 0, ky, ax, ay + fp * (this.k - ky));
      g.drawImage(s.c, ox, oy);
      if (fl > 0) { g.globalAlpha = flashA; g.drawImage(this.tint(s, body, '#ffffff'), ox, oy, sw, sh); g.globalAlpha = 1; }
      if (e.freezeT > 0) { g.globalAlpha = 0.5; g.drawImage(this.tint(s, body, '#9fe8ff'), ox, oy, sw, sh); g.globalAlpha = 1; }
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  /** 적 공격 예고(돌진선·폭발 범위·능력 예고) */
  private drawTelegraphs(w: World, vis: (x: number, y: number, m?: number) => boolean) {
    const g = this.g;
    this.world();
    for (const e of w.enemies) {
      if (e.dead || !(e.st === 1 || e.st === 11 || e.st === 21 || e.pendAb >= 0) || !vis(e.x, e.y, 400)) continue;
      if (e.st === 21) {
        const R = Number(e.def.params?.blastRadius ?? 60);
        g.globalAlpha = 0.18 + Math.abs(Math.sin(this.time * 18)) * 0.22;
        g.fillStyle = '#ff3b1a';
        g.beginPath(); g.arc(e.x, e.y, R, 0, TAU); g.fill();
        g.globalAlpha = 0.8; g.strokeStyle = '#ff6a3a'; g.lineWidth = 2;
        g.beginPath(); g.arc(e.x, e.y, R, 0, TAU); g.stroke();
      }
      if (e.pendAb >= 0) {
        g.globalAlpha = 0.35 + Math.abs(Math.sin(this.time * 24)) * 0.45;
        g.strokeStyle = '#ff2e4a'; g.lineWidth = 3;
        g.beginPath(); g.arc(e.x, e.y, e.r * 1.35, 0, TAU); g.stroke();
        g.globalAlpha = 1;
        this.rot(emoji('❗', 18), e.x, e.y - e.r * 1.6, Math.sin(this.time * 20) * 0.15); this.world();
      }
      if (e.st === 1 && e.boss) {
        g.lineCap = 'round';
        g.globalAlpha = 0.22; g.strokeStyle = '#ff2e2e'; g.lineWidth = e.r * 1.2;
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + e.dx * 380, e.y + e.dy * 380); g.stroke();
        g.globalAlpha = 0.7; g.lineWidth = 2; g.setLineDash(DASH_CHARGE); g.lineDashOffset = -this.time * 60;
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + e.dx * 380, e.y + e.dy * 380); g.stroke();
        g.setLineDash(NO_DASH);
      }
      if (e.st === 11) {
        g.lineCap = 'round';
        g.globalAlpha = 0.25; g.strokeStyle = '#ffae00'; g.lineWidth = e.r;
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + e.dx * 120, e.y + e.dy * 120); g.stroke();
      }
      g.globalAlpha = 1;
    }
    g.globalAlpha = 1;
  }

  // ───────────── 플레이어 ─────────────

  /** ghost = 앞쪽 보스에 가려졌을 때 한 번 더 얹는 반투명 몸 + 따뜻한 윤곽(기울기 갱신·궁극기 고리는 첫 번째에만) */
  private drawPlayer(w: World, ghost = false) {
    const g = this.g;
    const p = w.player;
    const x = this.ipx, y = this.ipy;
    const look = w.cfg.character.look;
    const frame = p.moving ? Math.floor(p.walk) & 3 : 0;
    const s = worker(look, frame, w.flags.has('bigHead') ? 46 : 40);
    const flip = p.fx < -0.05 ? -1 : 1;
    // 이동 방향으로 기울기(부드럽게)
    const target = p.moving ? Math.max(-1, Math.min(1, p.mx)) * 0.14 : 0;
    if (!ghost) this.lean += (target - this.lean) * Math.min(1, this.frameDt * 12);
    if (p.ultActiveT > 0 && !ghost) {
      this.world();
      this.light(g, 'rgba(255,120,240,.7)', x, y, 44, 0.7 + Math.sin(this.time * 10) * 0.2);
      g.globalAlpha = 0.6; g.strokeStyle = '#ff9cf0'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(x, y, 30 + Math.sin(this.time * 8) * 2, 0, TAU); g.stroke();
      g.globalAlpha = 1;
    }
    const blink = p.invulnT > 0 && p.hurtT <= 0 && Math.floor(this.time * 14) % 2 === 0;
    const squash = p.moving ? 1 + Math.sin(p.walk * 2) * 0.035 : 1 + Math.sin(this.time * 3) * 0.02;
    const kx = this.k / squash, ky = this.k * squash;
    const c = Math.cos(this.lean), n = Math.sin(this.lean);
    const fp = (s.h - s.ay) * 0.9 * this.SS;   // 발끝 기준으로 기울이고 숨쉰다
    const a = c * flip * kx, b = n * flip * kx, cc = -n * ky, d = c * ky;
    const ax = this.bx + x * this.S, ay = this.by + y * this.S;
    g.setTransform(a, b, cc, d, ax - cc * fp, ay + fp * this.k - d * fp);
    if (ghost) {
      g.globalAlpha = blink ? 0.3 : 0.6;
      g.drawImage(s.c, -s.ax * this.SS, -s.ay * this.SS);
      g.globalAlpha = 0.2;
      g.drawImage(tinted(s, '#fff0cc').c, -s.ax * this.SS, -s.ay * this.SS);
      g.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    if (blink) g.globalAlpha = 0.5;
    g.drawImage(s.c, -s.ax * this.SS, -s.ay * this.SS);
    if (p.hurtT > 0) {
      g.globalAlpha = Math.min(1, p.hurtT * 4);
      g.drawImage(tinted(s, '#ffe4e4').c, -s.ax * this.SS, -s.ay * this.SS);
    }
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ───────────── 무기 ─────────────

  private drawOrbitals(w: World, px: number, py: number) {
    const g = this.g, p = w.player;
    for (const wi of w.weapons) {
      if (wi.def.archetype === 'orbit' && wi.on > 0) {
        const sz = Math.max(14, wi.st.area * w.d.areaMul * 2.2) * (wi.def.evolved ? 1.15 : 1);
        const s = emoji(wi.def.projectile, Math.round(sz));
        const pos = orbitPositions(w, wi);
        if (pos.length) {
          // 궤도 잔광 + 진행 방향 뒤로 끌리는 꼬리(세 토막, 점점 옅게)
          this.world();
          const R = Math.hypot(pos[0].x - p.x, pos[0].y - p.y);
          const col = neon(wi.def.color);
          const prev = this.orbitPrev[wi.slot];
          if (prev !== undefined && wi.angle !== prev) this.orbitDir[wi.slot] = wi.angle > prev ? 1 : -1;
          this.orbitPrev[wi.slot] = wi.angle;
          const dir = this.orbitDir[wi.slot] ?? 1;
          g.strokeStyle = col; g.lineCap = 'butt';
          g.globalAlpha = 0.07; g.lineWidth = sz * 0.4;
          g.beginPath(); g.arc(px, py, R, 0, TAU); g.stroke();
          // 길이가 다른 꼬리를 겹쳐 그려 앞쪽일수록 진하게
          for (const [len, al] of TAIL) {
            g.globalAlpha = al; g.lineWidth = sz * 0.5;
            g.beginPath();
            for (const q of pos) {
              const a = Math.atan2(q.y - p.y, q.x - p.x);
              const a0 = dir > 0 ? a - len : a;
              g.moveTo(px + Math.cos(a0) * R, py + Math.sin(a0) * R);
              g.arc(px, py, R, a0, a0 + len);
            }
            g.stroke();
          }
          g.globalAlpha = 1;
        }
        for (const q of pos) this.rot(s, q.x + px - p.x, q.y + py - p.y, this.time * 6);
      } else if (wi.def.archetype === 'drone') {
        const s = emoji(wi.def.projectile, wi.def.evolved ? 20 : 18);
        for (const d of wi.drones) this.rot(s, d.x, d.y + Math.sin(this.time * 5 + d.x) * 2, Math.sin(this.time * 3 + d.x) * 0.12);
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawBullets(w: World, vis: (x: number, y: number, m?: number) => boolean) {
    const g = this.g;
    // 트레일: 무기(슬롯)별로 경로를 모아 한 번에(넓고 흐린 줄 + 가늘고 밝은 심)
    this.world();
    g.lineCap = 'round';
    for (let slot = 0; slot < this.slotW.length; slot++) {
      const wi = this.slotW[slot];
      if (!wi) continue;
      let n = 0, rr = 4;
      g.beginPath();
      for (const b of w.bullets) {
        if (b.dead || b.slot !== slot || !vis(b.x, b.y, 40)) continue;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp < 1) continue;
        const len = Math.min(34, Math.max(8, sp * 0.05)) * (wi.def.evolved ? 1.35 : 1);
        g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx / sp * len, b.y - b.vy / sp * len);
        rr = b.r; n++;
      }
      if (!n) continue;
      const col = neon(wi.def.color);
      g.strokeStyle = col;
      g.globalAlpha = 0.16; g.lineWidth = Math.max(3, rr * 1.2);
      g.stroke();
      g.globalAlpha = 0.45; g.lineWidth = Math.max(1.2, rr * 0.36);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (const b of w.bullets) {
      if (b.dead || !vis(b.x, b.y, 30)) continue;
      const wi = this.slotW[b.slot];
      if (b.kind === 'drone') {
        const col = neon(wi?.def.color ?? '#7df9ff');
        this.world();
        g.fillStyle = col;
        g.beginPath(); g.arc(b.x, b.y, Math.max(2.6, b.r), 0, TAU); g.fill();
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(b.x, b.y, Math.max(1.3, b.r * 0.5), 0, TAU); g.fill();
        continue;
      }
      const evo = !!wi?.def.evolved;
      const s = emoji(b.sprite, Math.round(Math.max(13, b.r * 2.4) * (evo ? 1.12 : 1)));
      this.rot(s, b.x, b.y, b.kind === 'boomerang' ? b.rot : b.rot + Math.PI / 4);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawBeams(w: World, px: number, py: number) {
    const g = this.g;
    this.world();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const b of w.beams) {
      const k = Math.min(1, b.life / b.maxLife * 3) * Math.min(1, (b.maxLife - b.life) * 12);
      const ex = px + Math.cos(b.ang) * b.len, ey = py + Math.sin(b.ang) * b.len;
      const col = neon(b.color);
      const fl = 0.9 + Math.sin(this.time * 40 + b.ang * 7) * 0.1;
      g.strokeStyle = col;
      g.globalAlpha = 0.16 * k; g.lineWidth = b.w * 2;
      g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke();
      g.globalAlpha = 0.66 * k * fl; g.lineWidth = b.w * 0.8;
      g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke();
      g.globalAlpha = k; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, b.w * 0.28);
      g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke();
      this.light(g, colorA(col, 0.9), ex, ey, b.w * 1.3, k);
      this.light(g, colorA(col, 0.9), px + Math.cos(b.ang) * 10, py + Math.sin(b.ang) * 10, b.w, k * 0.8);
    }
    for (const r of w.rings) {
      const k = 1 - r.r / r.maxR;
      const col = neon(r.color);
      g.globalAlpha = 0.18 * k; g.strokeStyle = col; g.lineWidth = r.w * 2;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
      g.globalAlpha = 0.8 * k; g.lineWidth = r.w * 0.7;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
      g.globalAlpha = 0.9 * k; g.strokeStyle = '#fff'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  // ───────────── 조명·블룸 ─────────────

  /** high: 어둠을 지우는 빛(월드 변환·destination-out 상태의 저해상도 버퍼) */
  private darkLights(g: CanvasRenderingContext2D, _v: View, w: World) {
    const p = w.player, t = this.time;
    const lamp = this.post.lampSprite();
    const L = (x: number, y: number, r: number, a: number) => { if (a <= 0.01) return; g.globalAlpha = Math.min(1, a); g.drawImage(lamp, x - r, y - r, r * 2, r * 2); };
    L(this.ipx, this.ipy - 4, 195, 1);
    for (const pr of this.props) for (const l of pr.lights) L(l.x, l.y, l.r * 1.15, lightPower(l, t, pr.seed) * 0.95);
    for (const e of w.enemies) {
      if (e.dead) continue;
      if (e.boss) L(e.x, e.y, e.r * 3, 0.45 + Math.sin(t * 4) * 0.15);
      else if (e.elite) L(e.x, e.y, e.r * 2.4, 0.4);
      if (e.burnT > 0) L(e.x, e.y, e.r * 2.2, 0.5);
    }
    let nb = 0;
    for (const b of w.bullets) { if (b.dead || nb++ > 140) continue; L(b.x, b.y, 26, 0.3); }
    for (const b of w.ebullets) if (!b.dead) L(b.x, b.y, 16, 0.35);
    for (const k of w.pickups) if (!k.dead && k.kind !== 'xp' && k.kind !== 'coin') L(k.x, k.y, k.kind === 'chest' ? 60 : 36, 0.55);
    g.globalAlpha = 0.5; g.strokeStyle = '#fff'; g.lineCap = 'round';
    for (const b of w.beams) { g.lineWidth = b.w * 4; g.beginPath(); g.moveTo(this.ipx, this.ipy); g.lineTo(this.ipx + Math.cos(b.ang) * b.len, this.ipy + Math.sin(b.ang) * b.len); g.stroke(); }
    g.globalAlpha = 0.35;
    for (const r of w.rings) { g.lineWidth = 22; g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke(); }
    for (const b of w.blasts) if (b.kind === 'slam') L(b.x, b.y, b.r * 1.2, 0.35);
    for (const wi of w.weapons) if (wi.def.archetype === 'aura') L(p.x, p.y, wi.st.area * w.d.areaMul * 1.2, 0.4);
    g.globalAlpha = 1;
  }

  /** 블룸 버퍼(1/4, 가산 합성·월드 변환)에 빛나야 할 것만 그린다 */
  private bloom(g: CanvasRenderingContext2D, _v: View, w: World) {
    const p = w.player, t = this.time, env = this.env;
    // 플레이어 램프의 따뜻한 기운
    this.light(g, env.lamp, this.ipx, this.ipy + 4, 120, 0.1);
    // 소품 광원(모니터·등불·숯불)
    for (const pr of this.props) for (const l of pr.lights) this.light(g, l.color, l.x, l.y, l.r * 0.8, lightPower(l, t, pr.seed) * 0.34);
    // 오라 가장자리·장판·보스 예고
    g.lineCap = 'round';
    for (const wi of w.weapons) {
      if (wi.def.archetype !== 'aura') continue;
      g.globalAlpha = 0.45; g.strokeStyle = neon(wi.def.color); g.lineWidth = 6;
      g.beginPath(); g.arc(p.x, p.y, wi.st.area * w.d.areaMul, 0, TAU); g.stroke();
    }
    for (const z of w.zones) { if (!z.hostile) continue; g.globalAlpha = 0.35; g.strokeStyle = '#ff2e4a'; g.lineWidth = 5; g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.stroke(); }
    for (const b of w.blasts) {
      if (b.kind === 'slam') { g.globalAlpha = 0.5; g.strokeStyle = '#ff2e4a'; g.lineWidth = 6; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke(); }
      else if (b.kind === 'strike' || b.kind === 'ult') { g.globalAlpha = 0.4; g.strokeStyle = neon(b.color); g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke(); }
    }
    // 픽업
    for (const k of w.pickups) {
      if (k.dead) continue;
      if (k.kind === 'xp') { const tier = gemTier(k.value); this.light(g, gemColor(tier), k.x, k.y, 6 + tier * 1.8, k.pull ? 0.6 : 0.34); }
      else if (k.kind === 'coin') this.light(g, '#ffc933', k.x, k.y, 9, 0.45);
      else this.light(g, k.bossChest ? '#ff6bd6' : PICKUP_GLOW[k.kind] ?? '#ffffff', k.x, k.y, k.kind === 'chest' ? 30 : 20, 0.4 + Math.sin(t * 6) * 0.12);
    }
    // 적(엘리트·보스는 몸을 물들이지 않게 둘레에 고리 빛, 불붙은 적·언 적은 은은하게)
    for (const e of w.enemies) {
      if (e.dead) continue;
      if (e.boss || e.elite) {
        const cy = e.y + (e.def.body ? e.r * 0.2 : 0), R = e.r * (e.boss ? 1.55 : 1.25);
        g.strokeStyle = e.boss ? '#ff2a36' : '#ffcf33';
        g.globalAlpha = e.boss ? 0.34 + Math.sin(t * 4) * 0.16 : 0.2 + Math.sin(t * 5 + e.seed) * 0.06;
        g.lineWidth = e.r * (e.boss ? 0.55 : 0.4);
        g.beginPath(); g.ellipse(e.x, cy, R, R * (e.def.body ? 1.25 : 1), 0, 0, TAU); g.stroke();
      }
      if (e.burnT > 0) this.light(g, '#ff7a1a', e.x, e.y, e.r * 1.4, 0.45);
      if (e.freezeT > 0) this.light(g, '#8fe8ff', e.x, e.y, e.r * 1.3, 0.3);
    }
    if (p.ultActiveT > 0) this.light(g, '#ff78f0', this.ipx, this.ipy, 46, 0.5);
    // 궤도·드론
    for (const wi of w.weapons) {
      const col = neon(wi.def.color);
      if (wi.def.archetype === 'orbit' && wi.on > 0) {
        const sz = Math.max(14, wi.st.area * w.d.areaMul * 2.2);
        for (const q of orbitPositions(w, wi)) this.light(g, col, q.x + this.ipx - p.x, q.y + this.ipy - p.y, sz * 0.75, wi.def.evolved ? 0.4 : 0.26);
      } else if (wi.def.archetype === 'drone') for (const d of wi.drones) this.light(g, col, d.x, d.y, 13, 0.5);
    }
    // 투사체: 빛 + 줄무늬
    for (let slot = 0; slot < this.slotW.length; slot++) {
      const wi = this.slotW[slot];
      if (!wi) continue;
      const col = neon(wi.def.color), evo = !!wi.def.evolved;
      let n = 0, rr = 4;
      g.beginPath();
      for (const b of w.bullets) {
        if (b.dead || b.slot !== slot) continue;
        const sp = Math.hypot(b.vx, b.vy);
        this.light(g, col, b.x, b.y, Math.max(6, b.r * 2) * (evo ? 1.15 : 1), evo ? 0.28 : 0.2);
        if (sp < 1) continue;
        const len = Math.min(34, Math.max(8, sp * 0.05)) * (evo ? 1.35 : 1);
        g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx / sp * len, b.y - b.vy / sp * len);
        rr = b.r; n++;
      }
      if (n) { g.globalAlpha = evo ? 0.3 : 0.22; g.strokeStyle = col; g.lineWidth = Math.max(2, rr * 0.8); g.stroke(); }
    }
    // 광선·고리
    for (const b of w.beams) {
      const k = Math.min(1, b.life / b.maxLife * 3) * Math.min(1, (b.maxLife - b.life) * 12);
      const col = neon(b.color);
      g.strokeStyle = col; g.globalAlpha = 0.32 * k; g.lineWidth = b.w * 2.4;
      g.beginPath(); g.moveTo(this.ipx, this.ipy); g.lineTo(this.ipx + Math.cos(b.ang) * b.len, this.ipy + Math.sin(b.ang) * b.len); g.stroke();
      g.globalAlpha = 0.4 * k; g.lineWidth = b.w * 0.6; g.strokeStyle = '#ffffff';
      g.stroke();
    }
    for (const r of w.rings) {
      const k = 1 - r.r / r.maxR;
      g.globalAlpha = 0.6 * k; g.strokeStyle = neon(r.color); g.lineWidth = r.w * 1.6;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
    }
    // 적 탄: 형광 분홍이 확 번지게(위험 인지)
    for (const b of w.ebullets) { if (b.dead) continue; this.light(g, '#ff2e8a', b.x, b.y, b.r * 3.4, 0.85); this.light(g, '#ffffff', b.x, b.y, b.r * 1.2, 0.5); }
    g.globalAlpha = 1;
  }

  // ───────────── 월드 UI ─────────────

  private drawWorldUi(w: World, vis: (x: number, y: number, m?: number) => boolean) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // 말풍선
    for (const e of w.enemies) {
      if (e.dead || e.shoutT <= 0 || !e.shout || !vis(e.x, e.y, 80)) continue;
      const s = bubble(e.shout, 7, e.boss ? '#ff3b3b' : '#ffae00');
      g.globalAlpha = Math.min(1, e.shoutT * 3);
      this.blit(s, e.x, e.y - e.r * (e.def.body ? 2.1 : 1.6) - s.h * 0.4);
    }
    g.globalAlpha = 1;
    // 보스 명판
    for (const e of w.enemies) {
      if (e.dead || !e.boss || !vis(e.x, e.y, 80) || e.shoutT > 0) continue;
      this.blit(nameplate(e.def.name, '#ff4a4a'), e.x, e.y - e.r * (e.def.body ? 2.05 : 1.5) - 4);
    }
    // 엘리트 체력바
    this.world();
    for (const e of w.enemies) {
      if (e.dead || !e.elite || e.boss || !vis(e.x, e.y)) continue;
      const bw = e.r * 2.2, bh = 3, bx = e.x - bw / 2, by = e.y - e.r - 11;
      g.fillStyle = 'rgba(8,6,14,.8)'; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle = '#ffcf33'; g.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 1);
    }
    if (this.demo) return;
    // 플레이어 체력바
    const p = w.player;
    const bw = 30, bh = 3.6, bx = this.ipx - bw / 2, by = this.ipy + 18;
    const hk = Math.max(0, p.hp / w.d.maxHp);
    g.fillStyle = 'rgba(6,8,16,.82)';
    g.beginPath(); g.roundRect?.(bx - 1.2, by - 1.2, bw + 2.4, bh + 2.4, 2.4); if (!g.roundRect) g.rect(bx - 1.2, by - 1.2, bw + 2.4, bh + 2.4); g.fill();
    g.fillStyle = hk > 0.5 ? '#3ddc84' : hk > 0.25 ? '#ffc93c' : '#ff4d4d';
    g.fillRect(bx, by, bw * hk, bh);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx, by, bw * hk, 1.1);
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 1; i < 5; i++) g.fillRect(bx + (bw * i) / 5 - 0.25, by, 0.5, bh);
  }

  private drawIndicators(w: World, cx: number, cy: number) {
    const g = this.g;
    const [vw, vh] = this.viewSize();
    const draw = (x: number, y: number, icon: string, color: string) => {
      const dx = x - cx, dy = y - cy;
      if (Math.abs(dx) < vw / 2 - 10 && Math.abs(dy) < vh / 2 - 10) return;
      const ang = Math.atan2(dy, dx);
      const m = 28;
      const hx = this.W / 2 - m, hy = this.H / 2 - m;
      const k = Math.min(hx / Math.abs(Math.cos(ang) || 1e-6), hy / Math.abs(Math.sin(ang) || 1e-6));
      const sx = this.W / 2 + Math.cos(ang) * k, sy = this.H / 2 + Math.sin(ang) * k;
      const c = Math.cos(ang), s = Math.sin(ang), pulse = 1 + Math.sin(this.time * 6) * 0.08;
      g.setTransform(c * this.dpr * pulse, s * this.dpr * pulse, -s * this.dpr * pulse, c * this.dpr * pulse, sx * this.dpr, sy * this.dpr);
      g.fillStyle = 'rgba(6,8,16,.7)';
      g.beginPath(); g.moveTo(17, 0); g.lineTo(1, -10); g.lineTo(1, 10); g.closePath(); g.fill();
      g.fillStyle = color;
      g.beginPath(); g.moveTo(14, 0); g.lineTo(3, -7); g.lineTo(3, 7); g.closePath(); g.fill();
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const ix = sx - c * 13, iy = sy - s * 13;
      g.fillStyle = 'rgba(6,8,16,.72)';
      g.beginPath(); g.arc(ix, iy, 11, 0, TAU); g.fill();
      g.strokeStyle = color; g.lineWidth = 1.5; g.stroke();
      const es = emoji(icon, 16);
      g.drawImage(es.c, ix - 9, iy - 9, 18, 18);
    };
    for (const e of w.enemies) if (!e.dead && (e.boss || e.elite)) draw(e.x, e.y, e.boss ? '💢' : '⚠️', e.boss ? '#ff3b3b' : '#ffcf33');
    for (const k of w.pickups) if (!k.dead && k.kind === 'chest') draw(k.x, k.y, '📦', '#ffd84d');
  }

  private drawJoystick(joy: Joy) {
    const g = this.g;
    const dx = joy.kx - joy.bx, dy = joy.ky - joy.by, d = Math.hypot(dx, dy);
    g.globalAlpha = 0.16; g.fillStyle = '#0a0e1c';
    g.beginPath(); g.arc(joy.bx, joy.by, 54, 0, TAU); g.fill();
    g.globalAlpha = 0.5; g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.beginPath(); g.arc(joy.bx, joy.by, 52, 0, TAU); g.stroke();
    g.globalAlpha = 0.18; g.lineWidth = 6; g.strokeStyle = this.env.neon;
    g.beginPath(); g.arc(joy.bx, joy.by, 47, 0, TAU); g.stroke();
    if (d > 4) {
      const a = Math.atan2(dy, dx);
      g.globalAlpha = 0.7; g.strokeStyle = this.env.neon; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.arc(joy.bx, joy.by, 52, a - 0.45, a + 0.45); g.stroke();
    }
    g.globalAlpha = 0.9; g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(joy.kx, joy.ky, 24, 0, TAU); g.fill();
    g.globalAlpha = 0.18; g.fillStyle = '#0a0e1c';
    g.beginPath(); g.arc(joy.kx + 2, joy.ky + 4, 20, 0, TAU); g.fill();
    g.globalAlpha = 1; g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(joy.kx - 1, joy.ky - 1.5, 19, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }
}

export function hexA(hex: string, a: number): string { return colorA(hex, a); }
