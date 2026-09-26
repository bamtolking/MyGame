// Input → per-step RunInput. Presses are queued on pointerdown/keydown (never lost between frames, no click
// delay) and consumed one per sim step; slide / jump-hold are levels. Multi-touch: each pointer keeps the zone
// it started in, so holding slide with one thumb and tapping jump with the other works.
import type { RunInput } from '../sim/types';

export type Zone = 'jump' | 'slide' | null;

export class InputState {
  private jumpQueue = 0;
  private pointers = new Map<number, Zone>();
  private keysJump = new Set<string>();
  private keysSlide = new Set<string>();
  enabled = true;
  /** called on every accepted press (UI uses it for button feedback + audio unlock) */
  onPress: ((z: Exclude<Zone, null>) => void) | null = null;

  pressJump(): void { if (!this.enabled) return; this.jumpQueue = Math.min(this.jumpQueue + 1, 2); this.onPress?.('jump'); }

  pointerDown(id: number, zone: Zone): void {
    if (!zone || !this.enabled) return;
    this.pointers.set(id, zone);
    if (zone === 'jump') this.pressJump(); else this.onPress?.('slide');
  }
  pointerUp(id: number): void { this.pointers.delete(id); }

  keyDown(code: string, repeat: boolean): boolean {
    const z = keyZone(code); if (!z) return false;
    if (z === 'jump') { if (!repeat && !this.keysJump.has(code)) { this.keysJump.add(code); this.pressJump(); } }
    else { if (!this.keysSlide.has(code)) this.onPress?.('slide'); this.keysSlide.add(code); }
    return true;
  }
  keyUp(code: string): void { this.keysJump.delete(code); this.keysSlide.delete(code); }

  get slideHeld(): boolean { if (this.keysSlide.size) return true; for (const z of this.pointers.values()) if (z === 'slide') return true; return false; }
  get jumpHeld(): boolean { if (this.keysJump.size) return true; for (const z of this.pointers.values()) if (z === 'jump') return true; return false; }

  /** Input for the next sim step (consumes one queued press). */
  take(): RunInput {
    const jump = this.jumpQueue > 0; if (jump) this.jumpQueue--;
    return { jump, slide: this.enabled && this.slideHeld, jumpHeld: this.enabled && (this.jumpHeld || jump) };
  }
  /** Drop everything (pause / blur / screen change) so nothing sticks. */
  reset(): void { this.jumpQueue = 0; this.pointers.clear(); this.keysJump.clear(); this.keysSlide.clear(); }
}

export function keyZone(code: string): Zone {
  switch (code) {
    case 'Space': case 'ArrowUp': case 'KeyW': case 'KeyK': case 'KeyZ': return 'jump';
    case 'ArrowDown': case 'KeyS': case 'KeyJ': case 'KeyX': case 'ShiftLeft': case 'ShiftRight': return 'slide';
    default: return null;
  }
}
