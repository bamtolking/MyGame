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
