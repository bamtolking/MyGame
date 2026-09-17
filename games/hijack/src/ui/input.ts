// 터치 입력: 가상 조이스틱 + 버튼(포인터 캡처로 서로 섞이지 않음), 키보드 보조. 백그라운드 복귀 시 전부 초기화.
import type { Input } from '../sim/types';

export interface InputState extends Input { stickActive: boolean; stickX: number; stickY: number; stickOx: number; stickOy: number }

export class InputManager {
  state: InputState = { mx: 0, my: 0, attack: false, skill: false, possess: false, interact: false, stickActive: false, stickX: 0, stickY: 0, stickOx: 0, stickOy: 0 };
  private stickId: number | null = null;
  private keys = new Set<string>();
  private buttonsDown = new Map<string, Set<number>>();
  radius = 52;
  onAnyInput: (() => void) | null = null;
  onPause: (() => void) | null = null;
  constructor(private stickZone: HTMLElement, private buttons: Record<'attack' | 'skill' | 'possess' | 'interact', HTMLElement>, private knob: HTMLElement, private base: HTMLElement) {
    stickZone.addEventListener('pointerdown', (e) => this.stickDown(e));
    stickZone.addEventListener('pointermove', (e) => this.stickMove(e));
    stickZone.addEventListener('pointerup', (e) => this.stickUp(e));
    stickZone.addEventListener('pointercancel', (e) => this.stickUp(e));
    stickZone.addEventListener('lostpointercapture', (e) => this.stickUp(e));
    for (const [name, el] of Object.entries(buttons) as [keyof typeof buttons, HTMLElement][]) {
      const set = new Set<number>(); this.buttonsDown.set(name, set);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); set.add(e.pointerId); this.state[name] = true; el.classList.add('down'); this.onAnyInput?.(); });
      const up = (e: PointerEvent) => { set.delete(e.pointerId); if (set.size === 0) { this.state[name] = false; el.classList.remove('down'); } };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    window.addEventListener('keydown', (e) => { if (e.repeat) return; this.keys.add(e.code); this.onAnyInput?.(); if (e.code === 'Escape' || e.code === 'KeyP') this.onPause?.(); this.syncKeys(); });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.syncKeys(); });
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  }
  private stickDown(e: PointerEvent): void {
    if (this.stickId !== null) return;
    e.preventDefault(); this.stickId = e.pointerId; this.stickZone.setPointerCapture(e.pointerId);
    const r = this.stickZone.getBoundingClientRect();
    this.state.stickOx = e.clientX - r.left; this.state.stickOy = e.clientY - r.top; this.state.stickActive = true; this.state.stickX = 0; this.state.stickY = 0;
    this.base.style.left = this.state.stickOx + 'px'; this.base.style.top = this.state.stickOy + 'px'; this.base.classList.add('on');
    this.updateKnob(); this.onAnyInput?.();
  }
  private stickMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    const r = this.stickZone.getBoundingClientRect();
    let dx = e.clientX - r.left - this.state.stickOx, dy = e.clientY - r.top - this.state.stickOy;
    const l = Math.hypot(dx, dy); const dead = 6;
    if (l < dead) { dx = 0; dy = 0; } else { const m = Math.min(1, (l - dead) / (this.radius - dead)); dx = (dx / l) * m; dy = (dy / l) * m; }
    this.state.stickX = dx; this.state.stickY = dy; this.updateKnob();
  }
  private stickUp(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null; this.state.stickActive = false; this.state.stickX = 0; this.state.stickY = 0; this.base.classList.remove('on'); this.updateKnob();
  }
  private updateKnob(): void { this.knob.style.transform = `translate(${this.state.stickX * this.radius}px, ${this.state.stickY * this.radius}px)`; }
  private syncKeys(): void {
    const k = this.keys;
    this.state.attack = this.buttonsDown.get('attack')!.size > 0 || k.has('KeyJ') || k.has('Space');
    this.state.skill = this.buttonsDown.get('skill')!.size > 0 || k.has('KeyK') || k.has('ShiftLeft');
    this.state.possess = this.buttonsDown.get('possess')!.size > 0 || k.has('KeyL') || k.has('KeyF');
    this.state.interact = this.buttonsDown.get('interact')!.size > 0 || k.has('KeyE');
  }
  /** 시뮬레이션에 넘길 입력(키보드 + 스틱 합성) */
  read(): Input {
    let mx = this.state.stickX, my = this.state.stickY;
    if (!this.state.stickActive) {
      const k = this.keys; mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0); my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    }
    this.syncKeys();
    return { mx, my, attack: this.state.attack, skill: this.state.skill, possess: this.state.possess, interact: this.state.interact };
  }
  reset(): void {
    this.keys.clear(); this.stickId = null; this.state.stickActive = false; this.state.stickX = 0; this.state.stickY = 0; this.base.classList.remove('on'); this.updateKnob();
    for (const [name, set] of this.buttonsDown) { set.clear(); this.state[name as 'attack'] = false; this.buttons[name as 'attack'].classList.remove('down'); }
    this.state.attack = this.state.skill = this.state.possess = this.state.interact = false;
  }
}
