export function h(tag: string, attrs: Record<string, any> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) { if (c == null || c === false) continue; el.append(typeof c === 'string' ? document.createTextNode(c) : c); }
  return el;
}
export function $(id: string): HTMLElement { return document.getElementById(id)!; }
export function clear(el: HTMLElement): void { while (el.firstChild) el.removeChild(el.firstChild); }
export function fmtTime(sec: number): string { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${s.toString().padStart(2, '0')}`; }
