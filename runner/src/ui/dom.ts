export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) (el as any)[k.toLowerCase()] = v; else if (k === 'style') el.setAttribute('style', v); else if (k in el && k !== 'list') (el as any)[k] = v; else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}
export const $ = (id: string) => document.getElementById(id)!;
export function clear(el: HTMLElement): void { while (el.firstChild) el.removeChild(el.firstChild); }
export function fmtTime(sec: number): string { const m = Math.floor(sec / 60); const s = Math.floor(sec % 60); return `${m}:${s.toString().padStart(2, '0')}`; }
/**
 * Act on a tap of `el` without relying on `click`: Chromium / Android / iOS drop the click of a tap made while another
 * finger rests on the glass (two-thumb play: slide held, the other thumb taps ⏸ or 다시 달리기). Fires on the pointerup
 * of the pointer that went down on `el`, still inside it (sliding off cancels), or — `down: true` — right on a touch
 * or pen pointerdown. A click that no pointer on `el` explains (keyboard Enter / Space, assistive tech, el.click())
 * still fires, once — or, `native: true`, is left to the element (a <label> toggles its checkbox itself); the click
 * that follows a handled tap is swallowed (so a <label> does not toggle its box twice).
 */
export function onTap<T extends HTMLElement>(el: T, fn: (e: Event) => void, o: { down?: boolean; native?: boolean } = {}): T {
  const SLOP = 10;                                   // px outside the box a finger may drift and still count
  let id: number | null = null; let seenAt = -1e9;
  const fire = (e: Event) => { seenAt = performance.now(); fn(e); };
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    seenAt = performance.now();
    if (o.down && e.pointerType !== 'mouse') { id = null; fire(e); return; }
    id = e.pointerId;
  });
  el.addEventListener('pointerup', e => {
    if (e.pointerId !== id) return; id = null;
    const r = el.getBoundingClientRect();
    if (e.clientX < r.left - SLOP || e.clientX > r.right + SLOP || e.clientY < r.top - SLOP || e.clientY > r.bottom + SLOP) return;
    fire(e);
  });
  el.addEventListener('pointercancel', e => { if (e.pointerId === id) id = null; });
  el.addEventListener('click', e => {
    if (performance.now() - seenAt < 1000) { e.preventDefault(); return; }   // part of a pointer tap: handled (or cancelled) above
    if (!o.native) fire(e);
  });
  return el;
}
