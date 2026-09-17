export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string | number | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) (el as any)[k.toLowerCase()] = v; else if (k === 'style') el.setAttribute('style', v); else if (k in el && k !== 'list') (el as any)[k] = v; else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  return el;
}
export const $ = (id: string) => document.getElementById(id)!;
export function clear(el: HTMLElement): void { while (el.firstChild) el.removeChild(el.firstChild); }
export const money = (n: number): string => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
export const clock = (hour: number, minute = 0): string => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
export function bar(pct: number, color: string, label?: string): HTMLElement {
  const p = Math.max(0, Math.min(100, pct));
  return h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width:${p}%;background:${color}` }), label ? h('span', { class: 'lbl' }, label) : null);
}
