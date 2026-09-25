// 후처리: 조명(어둠 오버레이) + 블룸(저해상도 가산) + 근무지 색 비네트.
// 비용 원칙(헤드리스 소프트웨어 GPU에서 잰 값 기준): 곱하기 합성과 전체 화면 쌍선형 확대가 가장 비싸다.
//  → 조명은 '어둠 알파 오버레이'(source-over: 결과 = 장면×(1-어둠) + 어둠색×어둠)로 곱하기와 같은 효과를 낸다.
//    빛은 이 어둠을 'destination-out'으로 지워 만든다(high). medium은 가운데 램프가 뚫린 정적 오버레이 한 장.
//  → 화면 밖 캔버스는 CPU로 그려지므로(매 프레임 바뀌는 버퍼는 작게 유지) 저해상도 버퍼는 화면에 바로 부드럽게 확대해 얹고,
//    정적인 1/2 해상도 오버레이만 최근접 2배로 얹는다(부드러운 그라디언트라 계단이 안 보인다).
// 블룸 흐림은 ctx.filter 없이 축소(부드럽게) → 확대 가산으로 만든다.
// fx.drawLights가 그린 빛(1/8 버퍼)은 high에서 어둠을 지우고, medium·high 모두 블룸에 색빛으로 더해진다.
import type { View } from './fx';
import { rgbOf, rgba, mix } from './color';
import type { EnvStyle } from './env';

interface Buf { c: HTMLCanvasElement; g: CanvasRenderingContext2D; w: number; h: number }
function buf(): Buf { const c = document.createElement('canvas'); c.width = c.height = 1; return { c, g: c.getContext('2d')!, w: 1, h: 1 }; }
function size(b: Buf, w: number, h: number) {
  w = Math.max(1, w); h = Math.max(1, h);
  if (b.w !== w || b.h !== h) { b.c.width = b.w = w; b.c.height = b.h = h; }
}

export class Post {
  private cw = 0; private ch = 0;
  private b4 = buf(); private b8 = buf(); private b16 = buf();   // 블룸
  private l8 = buf();                                              // fx 광원
  private d8 = buf(); private d8base = buf();                      // 동적 어둠(high)
  private v2 = buf(); private red = buf();                         // 정적 오버레이(medium 조명 / low 비네트), 저체력
  private baseKey = ''; private v2Key = ''; private redKey = '';
  private lamp: HTMLCanvasElement | null = null;

  resize(cw: number, ch: number) {
    if (cw === this.cw && ch === this.ch) return;
    this.cw = cw; this.ch = ch;
    const w4 = Math.ceil(cw / 4), h4 = Math.ceil(ch / 4);
    size(this.b4, w4, h4);
    size(this.b8, Math.ceil(w4 / 2), Math.ceil(h4 / 2)); size(this.b16, Math.ceil(w4 / 4), Math.ceil(h4 / 4));
    const w8 = Math.ceil(cw / 8), h8 = Math.ceil(ch / 8);
    size(this.l8, w8, h8); size(this.d8, w8, h8); size(this.d8base, w8, h8);
    size(this.v2, Math.ceil(cw / 2), Math.ceil(ch / 2)); size(this.red, Math.ceil(cw / 2), Math.ceil(ch / 2));
    this.baseKey = this.v2Key = this.redKey = '';
  }

  /** GPU 문맥을 잃었다 되찾았을 때: 버퍼를 모두 새 캔버스로 바꾼다(예전 캔버스는 메인보다 늦게 복구돼 그 사이 다시 그린 내용이 버려질 수 있다).
   *  키로 캐시해 둔 버퍼(기본 어둠·정적 오버레이·저체력 테두리·램프)도 다시 그린다. 이어서 resize()를 불러야 한다 */
  reset() {
    for (const b of [this.b4, this.b8, this.b16, this.l8, this.d8, this.d8base, this.v2, this.red]) b.c.width = b.c.height = 0;
    this.b4 = buf(); this.b8 = buf(); this.b16 = buf(); this.l8 = buf();
    this.d8 = buf(); this.d8base = buf(); this.v2 = buf(); this.red = buf();
    this.cw = this.ch = 0;
    this.baseKey = this.v2Key = this.redKey = '';
    this.lamp = null;
  }

  /** 저해상도 버퍼용 View(월드 변환을 버퍼 배율로, W/H는 화면 CSS px 그대로) */
  private sub(v: View, div: number): View {
    return { x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y1, S: v.S / div, bx: v.bx / div, by: v.by / div, W: v.W, H: v.H, dpr: v.dpr / div, time: v.time, quality: v.quality };
  }

  /** 램프(가운데가 평평하게 밝고 가장자리로 부드럽게 꺼지는 빛) — 어둠 지우개·빛 웅덩이용, 흰색 */
  lampSprite(): HTMLCanvasElement {
    if (this.lamp) return this.lamp;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,.96)');
    grd.addColorStop(0.55, 'rgba(255,255,255,.62)'); grd.addColorStop(0.8, 'rgba(255,255,255,.2)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    this.lamp = c;
    return c;
  }

  // ── fx 광원 버퍼(1/8) ──
  /** fx.drawLights용 버퍼: 투명으로 비우고 가산 합성·월드 변환을 건 상태로 돌려준다 */
  lightBegin(v: View): [CanvasRenderingContext2D, View] {
    const b = this.l8, g = b.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, b.w, b.h);
    const sv = this.sub(v, 8);
    g.setTransform(sv.S, 0, 0, sv.S, sv.bx, sv.by);
    g.globalCompositeOperation = 'lighter';
    return [g, sv];
  }

  // ── 어둠(조명) ──
  private buildBase(st: EnvStyle, fog: string) {
    const key = `${this.d8.w}x${this.d8.h}|${st.ambient}|${st.dark}|${fog}`;
    if (this.baseKey === key) return;
    this.baseKey = key;
    this.paintDark(this.d8base, st, fog, false, 0);
  }

  /** 어둠 + 비네트(+ 가운데 램프 구멍) 그리기. lampK = 램프 반지름 ÷ 화면 짧은 변 */
  private paintDark(b: Buf, st: EnvStyle, fog: string, lamp: boolean, lampK: number) {
    const g = b.g, W = b.w, H = b.h;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy'; g.globalAlpha = 1;
    g.fillStyle = rgba(rgbOf(st.ambient), st.dark);
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    const vc = rgbOf(mix(st.ambient, fog, 0.55));
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.hypot(W, H) / 2);
    vg.addColorStop(0, rgba(vc, 0)); vg.addColorStop(0.55, rgba(vc, 0.16)); vg.addColorStop(1, rgba(vc, 0.52));
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (lamp) {
      g.globalCompositeOperation = 'destination-out';
      const R = Math.min(W, H) * lampK;
      g.drawImage(this.lampSprite(), W / 2 - R, H / 2 - R, R * 2, R * 2);
      g.globalCompositeOperation = 'source-over';
    }
  }

  /** high: 동적 어둠 버퍼 시작 — 기본 어둠을 깔고 'destination-out'(빛 = 어둠 지우기)·월드 변환 상태로 돌려준다 */
  darkBegin(v: View, st: EnvStyle, fog: string): [CanvasRenderingContext2D, View] {
    this.buildBase(st, fog);
    const b = this.d8, g = b.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'copy';
    g.drawImage(this.d8base.c, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    const sv = this.sub(v, 8);
    g.setTransform(sv.S, 0, 0, sv.S, sv.bx, sv.by);
    return [g, sv];
  }

  /** high: fx 광원도 어둠을 지우게 하고, 어둠 버퍼를 화면에 얹는다 */
  darkEnd(main: CanvasRenderingContext2D, fxLights: number) {
    const d = this.d8, g = d.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (fxLights > 0) { g.globalCompositeOperation = 'destination-out'; g.globalAlpha = fxLights; g.drawImage(this.l8.c, 0, 0); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    this.blitUp(main, d, 8, 'source-over', 1);
  }

  /** medium: 정적 조명(어둠 + 비네트 + 가운데 램프) / low: 비네트만. 크기·색이 바뀔 때만 다시 그린다 */
  overlay(main: CanvasRenderingContext2D, st: EnvStyle, fog: string, withLight: boolean, lampK: number) {
    const key = `${this.v2.w}x${this.v2.h}|${st.ambient}|${st.dark}|${fog}|${withLight ? 1 : 0}|${lampK.toFixed(3)}`;
    if (this.v2Key !== key) {
      this.v2Key = key;
      if (withLight) this.paintDark(this.v2, st, fog, true, lampK);
      else {
        const g = this.v2.g, W = this.v2.w, H = this.v2.h;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'copy';
        const vc = rgbOf(mix(st.ambient, fog, 0.6));
        const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.hypot(W, H) / 2);
        vg.addColorStop(0, rgba(vc, 0)); vg.addColorStop(0.5, rgba(vc, 0.18)); vg.addColorStop(1, rgba(vc, 0.62));
        g.fillStyle = vg; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
      }
    }
    this.blitHalf(main, this.v2, 'source-over', 1);
  }

  /** 저체력 붉은 테두리(맥동 세기 a) */
  lowHp(main: CanvasRenderingContext2D, a: number) {
    const key = `${this.red.w}x${this.red.h}`;
    if (this.redKey !== key) {
      this.redKey = key;
      const g = this.red.g, W = this.red.w, H = this.red.h;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'copy';
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
      vg.addColorStop(0, 'rgba(200,0,30,0)'); vg.addColorStop(0.6, 'rgba(200,0,30,.18)'); vg.addColorStop(1, 'rgba(210,0,36,.55)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    this.blitHalf(main, this.red, 'source-over', a);
  }

  // ── 블룸 ──
  /** 블룸 버퍼(1/4): 투명으로 비우고 가산 합성·월드 변환을 건 상태로 돌려준다 */
  bloomBegin(v: View): [CanvasRenderingContext2D, View] {
    const b = this.b4, g = b.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, b.w, b.h);
    const sv = this.sub(v, 4);
    g.setTransform(sv.S, 0, 0, sv.S, sv.bx, sv.by);
    g.globalCompositeOperation = 'lighter';
    return [g, sv];
  }

  /** fx 광원 버퍼를 블룸에 색빛으로 더한다 */
  addLights(a: number) {
    const g = this.b4.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
    g.drawImage(this.l8.c, 0, 0, this.l8.w * 2, this.l8.h * 2);
    g.globalAlpha = 1;
  }

  /** 블룸을 흐려(high: 1/8·1/16 추가 패스) 화면에 가산 합성 */
  bloomEnd(main: CanvasRenderingContext2D, wide: boolean, strength: number) {
    const b4 = this.b4;
    b4.g.setTransform(1, 0, 0, 1, 0, 0);
    if (wide) {
      const b8 = this.b8, b16 = this.b16;
      b8.g.globalCompositeOperation = 'copy'; b8.g.drawImage(b4.c, 0, 0, b8.w, b8.h);
      b16.g.globalCompositeOperation = 'copy'; b16.g.drawImage(b8.c, 0, 0, b16.w, b16.h);
      b8.g.globalCompositeOperation = 'lighter'; b8.g.drawImage(b16.c, 0, 0, b16.w * 2, b16.h * 2);
      b4.g.globalCompositeOperation = 'lighter'; b4.g.globalAlpha = 0.85;
      b4.g.drawImage(b8.c, 0, 0, b8.w * 2, b8.h * 2);
      b4.g.globalAlpha = 1;
    }
    this.blitUp(main, b4, 4, 'lighter', strength);
  }

  /** 저해상도 버퍼를 화면에 부드럽게 div배 확대해 얹는다 */
  private blitUp(main: CanvasRenderingContext2D, b: Buf, div: number, op: GlobalCompositeOperation, a: number) {
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = op;
    main.globalAlpha = a;
    main.drawImage(b.c, 0, 0, b.w * div, b.h * div);
    main.globalAlpha = 1;
    main.globalCompositeOperation = 'source-over';
  }

  /** 1/2 해상도 버퍼를 화면에 최근접 2배로 얹는다 */
  private blitHalf(main: CanvasRenderingContext2D, b: Buf, op: GlobalCompositeOperation, a: number) {
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = op;
    main.globalAlpha = a;
    main.imageSmoothingEnabled = false;
    main.drawImage(b.c, 0, 0, b.w * 2, b.h * 2);
    main.imageSmoothingEnabled = true;
    main.globalAlpha = 1;
    main.globalCompositeOperation = 'source-over';
  }
}
