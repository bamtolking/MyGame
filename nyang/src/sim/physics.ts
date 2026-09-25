// 원형 강체 물리 (위치 기반 + 작은 스텝). DOM 없음, 결정적.
// 매 프레임을 여러 하위 스텝으로 나눠 겹침을 밀어내고, 속도는 위치 변화로 다시 구한다.
// 마찰은 접촉점 상대 속도로 계산해 회전(굴러감)까지 만든다.

export interface Body {
  id: number;
  /** 0..10 고양이 단계, -1 = 캣닢 공 */
  tier: number;
  x: number; y: number;
  vx: number; vy: number;
  a: number; w: number;
  /** 현재 반지름과 목표 반지름 (합체 직후 서서히 커진다) */
  r: number; rt: number;
  invM: number;
  born: number;
  over: number;
  /** 한 번이라도 무언가에 닿았는지 */
  touched: boolean;
  dead: boolean;
  /** 이번 프레임에 받은 가장 큰 충돌 속도 (연출용) */
  hit: number;
  /** 연쇄 합체 단계와 그 시각 (콤보 계산용, 물리와 무관) */
  chain: number; ct: number;
  /** 황금 고양이 (합체 점수 3배) */
  gold: boolean;
  // 하위 스텝 임시값
  px: number; py: number; pa: number; ovx: number; ovy: number;
  /** 이번 하위 스텝의 바닥/왼벽/오른벽 밀어냄 양 */
  cf: number; cl: number; cr: number;
}

export interface PhysParams {
  gravity: number;
  friction: number;
  restitution: number;
  boxW: number;
  boxH: number;
  substeps: number;
  iterations: number;
}

export interface Contact { a: Body; b: Body; nx: number; ny: number; pen: number; ovn: number }

const MAX_SPEED = 2200;
/** 위로 튀는 속도 상한: 끼인 고양이가 밀려 튀어 나가는 것을 막는다 */
const MAX_UP = 950;
/** 반지름 변화 속도 (단위/초) */
export const GROW_RATE = 200;
/** 반발이 적용되는 최소 충돌 속도 */
const BOUNCE_MIN = 120;

export function makeBody(id: number, tier: number, x: number, y: number, r: number, born: number): Body {
  return {
    id, tier, x, y, vx: 0, vy: 0, a: 0, w: 0, r, rt: r, invM: 1 / (r * r), born, over: 0, touched: false, dead: false, hit: 0, chain: 0, ct: born, gold: false,
    px: x, py: y, pa: 0, ovx: 0, ovy: 0, cf: 0, cl: 0, cr: 0,
  };
}

export class World {
  bodies: Body[] = [];
  /** 마지막 하위 스텝의 몸끼리 접촉 */
  contacts: Contact[] = [];
  /** 이번 프레임 동안 한 번이라도 닿은 쌍 (합체 판정용, 발견 순서) */
  touching: Array<[Body, Body]> = [];
  private seen = new Set<number>();
  private sorted: Body[] = [];
  private pairs: Body[] = [];
  /** 매 하위 스텝 속도에 더할 외부 힘 (액체화 인력 등) */
  force: ((bodies: Body[], h: number) => void) | null = null;

  constructor(public p: PhysParams) {}

  add(b: Body): void { this.bodies.push(b); }

  remove(b: Body): void {
    b.dead = true;
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  step(dt: number): void {
    const n = this.p.substeps;
    const h = dt / n;
    this.touching.length = 0;
    this.seen.clear();
    for (const b of this.bodies) b.hit = 0;
    for (let s = 0; s < n; s++) this.substep(h, s === n - 1);
  }

  private substep(h: number, last: boolean): void {
    const p = this.p;
    const bodies = this.bodies;
    for (const b of bodies) {
      if (b.r !== b.rt) {
        const d = GROW_RATE * h;
        b.r = b.r < b.rt ? Math.min(b.rt, b.r + d) : Math.max(b.rt, b.r - d);
        b.invM = 1 / (b.r * b.r);
      }
      b.vy += p.gravity * h;
    }
    if (this.force) this.force(bodies, h);
    for (const b of bodies) {
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > MAX_SPEED * MAX_SPEED) { const k = MAX_SPEED / Math.sqrt(sp2); b.vx *= k; b.vy *= k; }
      b.ovx = b.vx; b.ovy = b.vy;
      b.px = b.x; b.py = b.y; b.pa = b.a;
      b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h;
      b.cf = 0; b.cl = 0; b.cr = 0;
    }

    this.broadphase();
    const pairs = this.pairs;
    const np = pairs.length >> 1;
    this.contacts.length = 0;
    for (let it = 0; it < p.iterations; it++) {
      const first = it === 0;
      // 반복마다 순서를 뒤집어 한쪽으로 쏠리는 것을 막는다
      if (it % 2 === 0) for (let k = 0; k < np; k++) this.collide(pairs[2 * k], pairs[2 * k + 1], first);
      else for (let k = np - 1; k >= 0; k--) this.collide(pairs[2 * k], pairs[2 * k + 1], first);
      this.walls();
    }

    for (const b of bodies) {
      b.vx = (b.x - b.px) / h;
      b.vy = (b.y - b.py) / h;
      b.w = (b.a - b.pa) / h;
      if (b.vy < -MAX_UP) b.vy = -MAX_UP;
    }
    this.solveVelocities(h);
    if (last) {
      for (const b of bodies) {
        b.vx *= 0.9995; b.vy *= 0.9995;
        b.w *= 0.985;
      }
    }
  }

  /** x 구간이 겹치는 후보 쌍을 모은다 (삽입 정렬: 거의 정렬된 상태라 빠르다) */
  private broadphase(): void {
    const srt = this.sorted;
    const bodies = this.bodies;
    if (srt.length !== bodies.length || srt.some(b => b.dead)) { srt.length = 0; for (const b of bodies) srt.push(b); }
    for (let i = 1; i < srt.length; i++) {
      const b = srt[i]; const key = b.x - b.r; let j = i - 1;
      while (j >= 0 && srt[j].x - srt[j].r > key) { srt[j + 1] = srt[j]; j--; }
      srt[j + 1] = b;
    }
    const pairs = this.pairs;
    pairs.length = 0;
    const margin = 3;
    for (let i = 0; i < srt.length; i++) {
      const A = srt[i];
      const maxX = A.x + A.r + margin;
      for (let j = i + 1; j < srt.length; j++) {
        const B = srt[j];
        if (B.x - B.r > maxX) break;
        const dy = B.y - A.y, rr = A.r + B.r + margin;
        if (dy > rr || dy < -rr) continue;
        pairs.push(A, B);
      }
    }
  }

  private collide(A: Body, B: Body, first: boolean): void {
    const dx = B.x - A.x, dy = B.y - A.y;
    const rr = A.r + B.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    let d = Math.sqrt(d2);
    let nx: number, ny: number;
    if (d > 1e-6) { nx = dx / d; ny = dy / d; } else { nx = A.id < B.id ? 1 : -1; ny = 0; d = 0; }
    const pen = rr - d;
    const wsum = A.invM + B.invM;
    const wa = A.invM / wsum, wb = B.invM / wsum;
    A.x -= nx * pen * wa; A.y -= ny * pen * wa;
    B.x += nx * pen * wb; B.y += ny * pen * wb;
    A.touched = true; B.touched = true;
    if (first) {
      const key = A.id < B.id ? A.id * 1048576 + B.id : B.id * 1048576 + A.id;
      if (!this.seen.has(key)) { this.seen.add(key); this.touching.push(A.id < B.id ? [A, B] : [B, A]); }
      const ovn = (B.ovx - A.ovx) * nx + (B.ovy - A.ovy) * ny;
      this.contacts.push({ a: A, b: B, nx, ny, pen, ovn });
    }
  }

  private walls(): void {
    const W = this.p.boxW, H = this.p.boxH;
    for (const b of this.bodies) {
      if (b.x - b.r < 0) { b.cl += b.r - b.x; b.x = b.r; b.touched = true; }
      else if (b.x + b.r > W) { b.cr += b.x + b.r - W; b.x = W - b.r; b.touched = true; }
      if (b.y + b.r > H) { b.cf += b.y + b.r - H; b.y = H - b.r; b.touched = true; }
    }
  }

  private solveVelocities(h: number): void {
    const mu = this.p.friction;
    const e = this.p.restitution;
    for (const c of this.contacts) {
      const A = c.a, B = c.b, nx = c.nx, ny = c.ny;
      const tx = -ny, ty = nx;
      const ra = A.r, rb = B.r;
      // 접촉점 속도: v + w × r  (rA = n*ra, rB = -n*rb)
      const vax = A.vx - A.w * ny * ra, vay = A.vy + A.w * nx * ra;
      const vbx = B.vx + B.w * ny * rb, vby = B.vy - B.w * nx * rb;
      const rvx = vbx - vax, rvy = vby - vay;
      const vn = rvx * nx + rvy * ny;
      const vt = rvx * tx + rvy * ty;
      const wsum = A.invM + B.invM;
      const hit = -c.ovn;
      if (hit > A.hit) A.hit = hit;
      if (hit > B.hit) B.hit = hit;
      if (c.ovn < -BOUNCE_MIN && e > 0) {
        const target = -e * c.ovn;
        if (vn < target) {
          const j = (target - vn) / wsum;
          A.vx -= nx * j * A.invM; A.vy -= ny * j * A.invM;
          B.vx += nx * j * B.invM; B.vy += ny * j * B.invM;
        }
      }
      if (mu <= 0) continue;
      // 마찰 충격량 (원판: 접선 유효 질량 역수 = 3 * (1/mA + 1/mB))
      const jn = c.pen / h / wsum;
      let jt = -vt / (3 * wsum);
      const lim = mu * jn;
      if (jt > lim) jt = lim; else if (jt < -lim) jt = -lim;
      const Px = tx * jt, Py = ty * jt;
      B.vx += Px * B.invM; B.vy += Py * B.invM;
      A.vx -= Px * A.invM; A.vy -= Py * A.invM;
      // 각속도: Δw = (r × P) / I,  I = m r² / 2
      const rbx = -nx * rb, rby = -ny * rb;
      B.w += (rbx * Py - rby * Px) * 2 * B.invM / (rb * rb);
      const rax = nx * ra, ray = ny * ra;
      A.w -= (rax * Py - ray * Px) * 2 * A.invM / (ra * ra);
    }
    for (const b of this.bodies) {
      if (b.cf > 0) this.wallContact(b, 0, -1, b.cf, mu, e, h);
      if (b.cl > 0) this.wallContact(b, 1, 0, b.cl, mu, e, h);
      if (b.cr > 0) this.wallContact(b, -1, 0, b.cr, mu, e, h);
    }
  }

  /** n = 벽에서 몸 쪽을 향하는 법선, corr = 이번 스텝에 벽이 밀어낸 거리 */
  private wallContact(b: Body, nx: number, ny: number, corr: number, mu: number, e: number, h: number): void {
    const r = b.r;
    const cx = -nx * r, cy = -ny * r;
    const ovn = b.ovx * nx + b.ovy * ny;
    if (-ovn > b.hit) b.hit = -ovn;
    if (ovn < -BOUNCE_MIN && e > 0) {
      const vn = b.vx * nx + b.vy * ny;
      const target = -e * ovn;
      if (vn < target) { b.vx += nx * (target - vn); b.vy += ny * (target - vn); }
    }
    if (mu <= 0) return;
    const tx = -ny, ty = nx;
    const vpx = b.vx - b.w * cy, vpy = b.vy + b.w * cx;
    const vt = vpx * tx + vpy * ty;
    const lim = mu * corr / h;
    let dv = -vt / 3;
    if (dv > lim) dv = lim; else if (dv < -lim) dv = -lim;
    b.vx += tx * dv; b.vy += ty * dv;
    b.w += (cx * (ty * dv) - cy * (tx * dv)) * 2 / (r * r);
  }
}
