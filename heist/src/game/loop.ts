// Fixed-step game loop. Everything that moves (player, ghosts, enemies, timers) advances only inside onTick,
// so pausing simply stops calling it and resuming never "catches up" a burst of missed time.
export interface LoopOptions { tickRate?: number; maxTicksPerFrame?: number; onTick: () => void; onRender: (alpha: number) => void }
export class FixedLoop {
  readonly dtMs: number; readonly maxTicks: number;
  private acc = 0; private last: number | null = null; paused = false; ticks = 0;
  constructor(private o: LoopOptions) { this.dtMs = 1000 / (o.tickRate ?? 60); this.maxTicks = o.maxTicksPerFrame ?? 4; }
  /** Call once per animation frame with a monotonic time in ms. */
  frame(nowMs: number): void {
    if (this.paused) { this.last = nowMs; this.o.onRender(0); return; }
    if (this.last === null) this.last = nowMs;
    let elapsed = nowMs - this.last; this.last = nowMs;
    if (elapsed < 0) elapsed = 0;
    // Clamp: a long stall (tab hidden, GC) slows the game briefly instead of jumping ahead.
    this.acc += Math.min(elapsed, this.dtMs * this.maxTicks);
    let n = 0;
    while (this.acc >= this.dtMs && n < this.maxTicks) { this.o.onTick(); this.ticks++; this.acc -= this.dtMs; n++; }
    if (this.acc > this.dtMs * this.maxTicks) this.acc = 0;
    this.o.onRender(this.acc / this.dtMs);
  }
  pause(): void { this.paused = true; }
  resume(nowMs: number): void { this.paused = false; this.last = nowMs; this.acc = 0; }
  reset(): void { this.acc = 0; this.last = null; this.ticks = 0; }
}
