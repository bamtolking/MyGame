// Per-entity hit reactions and pose timelines: knock-back spring, white flash, squash, attack/hurt poses.
export interface React {
  ox: number; oy: number; vx: number; vy: number; flash: number; squash: number;
  atkT: number; atkDur: number; hurtT: number; seen: number;
}
const K = 260, C = 18; // spring stiffness / damping (under-damped: a visible kick and one small bounce)
const key = (kind: 'p' | 'm', id: number) => id * 2 + (kind === 'm' ? 1 : 0);

export class Anim {
  private m = new Map<number, React>(); private frame = 0;
  get(kind: 'p' | 'm', id: number): React {
    const k = key(kind, id); let r = this.m.get(k);
    if (!r) { r = { ox: 0, oy: 0, vx: 0, vy: 0, flash: 0, squash: 0, atkT: 9, atkDur: 0.3, hurtT: 9, seen: this.frame }; this.m.set(k, r); }
    r.seen = this.frame; return r;
  }
  peek(kind: 'p' | 'm', id: number): React | undefined { return this.m.get(key(kind, id)); }
  /** Knock the entity away along (dx, dy) with `power` px/s, flash white and squash. */
  hit(kind: 'p' | 'm', id: number, dx: number, dy: number, power: number, flash = 1): void {
    const r = this.get(kind, id); const d = Math.hypot(dx, dy) || 1;
    r.vx += dx / d * power; r.vy += dy / d * power * 0.6; r.flash = Math.max(r.flash, flash); r.squash = 1;
  }
  attack(id: number, dur = 0.3): void { const r = this.get('p', id); r.atkT = 0; r.atkDur = dur; }
  hurt(id: number): void { const r = this.get('p', id); r.hurtT = 0; r.flash = Math.max(r.flash, 0.8); }
  update(dt: number): void {
    this.frame++;
    for (const [k, r] of this.m) {
      const ax = -K * r.ox - C * r.vx, ay = -K * r.oy - C * r.vy; r.vx += ax * dt; r.vy += ay * dt; r.ox += r.vx * dt; r.oy += r.vy * dt;
      const lim = 22; if (r.ox > lim) r.ox = lim; else if (r.ox < -lim) r.ox = -lim; if (r.oy > lim) r.oy = lim; else if (r.oy < -lim) r.oy = -lim;
      r.flash = Math.max(0, r.flash - dt / 0.1); r.squash = Math.max(0, r.squash - dt / 0.14); r.atkT += dt; r.hurtT += dt;
      if (this.frame - r.seen > 240) this.m.delete(k);
    }
  }
  /** Player frame name for the attack timeline, or null when not attacking. */
  static atkFrame(r: React | undefined): string | null {
    if (!r || r.atkT >= r.atkDur) return null; const k = r.atkT / r.atkDur;
    return k < 0.22 ? 'atk0' : k < 0.55 ? 'atk1' : 'atk2';
  }
}
