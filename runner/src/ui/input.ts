// Input layer (GDD §3.5). One full-screen surface receives Pointer Events; each pointerId is locked to the zone it
// started in (so holding slide with one thumb and tapping jump with the other always works). Presses are queued
// with their event.timeStamp and handed to the sim at the first fixed step whose (real) time is ≥ the press time,
// at most MAX_PRESS_QUEUE queued and one per step — two quick taps are never merged, a lag spike never fires a
// burst, and presses older than STALE_PRESS_MS when stepping resumes (after a pause countdown) are dropped.
// Slide is a level: any slide-zone pointer (or slide key) down. The optional slide toggle turns one tap into a
// 0.6 s slide by feeding slide=true for SLIDE_TOGGLE_STEPS steps — decided here, so the input log (ghosts,
// replays) stays exact.
import type { RunInput } from '../sim/types';

export type Zone = 'jump' | 'slide' | null;
export const MAX_PRESS_QUEUE = 2;
export const STALE_PRESS_MS = 150;
export const SLIDE_TOGGLE_STEPS = 36;   // 0.6 s at 60 steps/s

/** event.timeStamp is performance.now()-based in every current browser; very old ones used epoch ms. */
export function evTime(e: { timeStamp?: number } | null | undefined): number {
  const now = performance.now(); const t = e?.timeStamp;
  return typeof t === 'number' && t > 0 && Math.abs(t - now) < 10000 ? Math.min(t, now) : now;
}

export class InputState {
  private jumps: number[] = [];                   // queued jump presses (ms timestamps)
  private slides: number[] = [];                  // queued slide taps (only used by the slide toggle)
  private pointers = new Map<number, Exclude<Zone, null>>();
  private keysJump = new Set<string>();
  private keysSlide = new Set<string>();
  private toggleSteps = 0;
  enabled = true;
  slideToggle = false;
  /** every accepted press (audio unlock, pad feedback, tutorial overlay) */
  onPress: ((z: Exclude<Zone, null>) => void) | null = null;
  /** held state changed (pad highlight) */
  onChange: (() => void) | null = null;

  pressJump(ts = performance.now()): void {
    if (!this.enabled) return;
    if (this.jumps.length < MAX_PRESS_QUEUE) this.jumps.push(ts);
    this.onPress?.('jump');
  }
  pressSlide(ts = performance.now()): void {
    if (!this.enabled) return;
    if (this.slideToggle && this.slides.length < MAX_PRESS_QUEUE) this.slides.push(ts);
    this.onPress?.('slide');
  }

  pointerDown(id: number, zone: Zone, ts = performance.now()): boolean {
    if (!zone || !this.enabled) return false;
    this.pointers.set(id, zone);
    if (zone === 'jump') this.pressJump(ts); else this.pressSlide(ts);
    this.onChange?.();
    return true;
  }
  pointerUp(id: number): void { if (this.pointers.delete(id)) this.onChange?.(); }
  zoneOf(id: number): Zone { return this.pointers.get(id) ?? null; }

  keyDown(code: string, repeat: boolean, ts = performance.now()): boolean {
    const z = keyZone(code); if (!z || !this.enabled) return !!z;
    if (z === 'jump') { if (!repeat && !this.keysJump.has(code)) { this.keysJump.add(code); this.pressJump(ts); } }
    else if (!this.keysSlide.has(code)) { this.keysSlide.add(code); this.pressSlide(ts); }
    this.onChange?.();
    return true;
  }
  keyUp(code: string): void { const a = this.keysJump.delete(code), b = this.keysSlide.delete(code); if (a || b) this.onChange?.(); }

  get slideHeld(): boolean { if (this.keysSlide.size) return true; for (const z of this.pointers.values()) if (z === 'slide') return true; return false; }
  get jumpHeld(): boolean { if (this.keysJump.size) return true; for (const z of this.pointers.values()) if (z === 'jump') return true; return false; }
  get queued(): number { return this.jumps.length; }

  /** Input for the sim step that happens at real time `stepT` (ms). Consumes at most one queued press. */
  take(stepT = performance.now()): RunInput {
    const stale = stepT - STALE_PRESS_MS;
    while (this.jumps.length && this.jumps[0] < stale) this.jumps.shift();
    while (this.slides.length && this.slides[0] < stale) this.slides.shift();
    let jump = false;
    if (this.jumps.length && this.jumps[0] <= stepT) { this.jumps.shift(); jump = true; }
    if (this.slides.length && this.slides[0] <= stepT) { this.slides.shift(); this.toggleSteps = SLIDE_TOGGLE_STEPS; }
    const tog = this.toggleSteps > 0; if (tog) this.toggleSteps--;
    return { jump, slide: this.enabled && (this.slideHeld || tog), jumpHeld: this.enabled && (this.jumpHeld || jump) };
  }
  /** Drop everything (pause / blur / screen change) so nothing sticks. */
  reset(): void {
    const had = this.pointers.size + this.keysJump.size + this.keysSlide.size;
    this.jumps.length = 0; this.slides.length = 0; this.toggleSteps = 0;
    this.pointers.clear(); this.keysJump.clear(); this.keysSlide.clear();
    if (had) this.onChange?.();
  }
}

export function keyZone(code: string): Zone {
  switch (code) {
    case 'Space': case 'ArrowUp': case 'KeyW': case 'KeyZ': return 'jump';
    case 'ArrowDown': case 'KeyS': case 'KeyX': case 'ShiftLeft': case 'ShiftRight': return 'slide';
    default: return null;
  }
}

export interface SurfaceHooks {
  /** zone for a new pointer (null = not game input, e.g. a real button) */
  zoneAt: (e: PointerEvent) => Zone;
  /** any user gesture on the surface (audio unlock must also run on pointerup / touchend for Chrome & iOS) */
  gesture?: (e: Event) => void;
  /** a pointer went down that is not game input (results screen, overlays) */
  other?: (e: PointerEvent) => void;
}

/**
 * Wire one full-screen element as the game's input layer: Pointer Events with capture and zone locking, and the
 * browser gestures that would eat game input blocked (iOS double-tap-hold magnifier = "air jump then slide",
 * long-press callout, text selection, pinch). Real buttons inside keep working. Returns an unbind function.
 */
export function bindSurface(el: HTMLElement, inp: InputState, hooks: SurfaceHooks): () => void {
  const isButton = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('button, a, input, select, label, textarea');
  const down = (e: PointerEvent) => {
    hooks.gesture?.(e);
    if (isButton(e.target)) return;
    const z = hooks.zoneAt(e);
    if (!z) { hooks.other?.(e); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    inp.pointerDown(e.pointerId, z, evTime(e));
  };
  const up = (e: PointerEvent) => { if (e.type === 'pointerup') hooks.gesture?.(e); inp.pointerUp(e.pointerId); };
  const touchStart = (e: TouchEvent) => { if (!isButton(e.target) && e.cancelable) e.preventDefault(); };
  const touchMove = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
  const touchEnd = (e: TouchEvent) => { hooks.gesture?.(e); };
  const block = (e: Event) => { if (!isButton(e.target) || e.type !== 'click') e.preventDefault(); };
  const opts: AddEventListenerOptions = { passive: false };
  el.addEventListener('pointerdown', down, opts);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up as EventListener);
  el.addEventListener('touchstart', touchStart, opts);
  el.addEventListener('touchmove', touchMove, opts);
  el.addEventListener('touchend', touchEnd, opts);
  for (const t of ['contextmenu', 'selectstart', 'gesturestart', 'gesturechange', 'dblclick', 'dragstart']) el.addEventListener(t, block, opts);
  return () => {
    el.removeEventListener('pointerdown', down, opts);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('lostpointercapture', up as EventListener);
    el.removeEventListener('touchstart', touchStart, opts);
    el.removeEventListener('touchmove', touchMove, opts);
    el.removeEventListener('touchend', touchEnd, opts);
    for (const t of ['contextmenu', 'selectstart', 'gesturestart', 'gesturechange', 'dblclick', 'dragstart']) el.removeEventListener(t, block, opts);
  };
}
