// 작은 DOM 헬퍼.
export type Child = Node | string | null | undefined | false | Child[];
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'disabled' || k === 'checked') (el as unknown as Record<string, unknown>)[k] = !!v;
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}
function append(el: HTMLElement, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) { append(el, c); continue; }
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}
export function clear(el: HTMLElement): void { while (el.firstChild) el.removeChild(el.firstChild); }
export function $(sel: string, root: ParentNode = document): HTMLElement { const e = root.querySelector(sel); if (!e) throw new Error('missing ' + sel); return e as HTMLElement; }
