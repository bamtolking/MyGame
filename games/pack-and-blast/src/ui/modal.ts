// 모달·토스트. 모달은 화면 크기에 관계없이 닫기 버튼이 항상 보이도록 헤더에 둔다.
import { h, clear, type Child } from './dom';

export interface ModalOpts { title: string; body: Child; buttons?: { label: string; cls?: string; onClick: () => void; keep?: boolean; disabled?: boolean }[]; closable?: boolean; onClose?: () => void; center?: boolean }

let current: HTMLElement | null = null;
export function openModal(root: HTMLElement, o: ModalOpts): () => void {
  closeModal();
  const close = () => { if (current === ov) { current = null; ov.remove(); } };
  const ov = h('div', { id: 'overlay', class: o.center ? 'center' : '' });
  const foot = o.buttons && o.buttons.length ? h('div', { class: 'mfoot' }, o.buttons.map(b => h('button', { class: b.cls || '', disabled: b.disabled, onClick: () => { b.onClick(); if (!b.keep) close(); } }, b.label))) : null;
  const modal = h('div', { class: 'modal' },
    h('div', { class: 'mhead' }, o.title, o.closable !== false ? h('button', { class: 'x ghost', 'aria-label': '닫기', onClick: () => { close(); o.onClose?.(); } }, '✕') : null),
    h('div', { class: 'mbody' }, o.body),
    foot,
  );
  ov.appendChild(modal);
  root.appendChild(ov);
  current = ov;
  return close;
}
export function closeModal(): void { if (current) { current.remove(); current = null; } }
export function isModalOpen(): boolean { return !!current; }

let toastTimer = 0;
export function toast(container: HTMLElement, msg: string, ms = 1800): void {
  let el = container.querySelector('#toast') as HTMLElement | null;
  if (!el) { el = h('div', { id: 'toast' }); container.appendChild(el); }
  clear(el); el.textContent = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el?.remove(); }, ms);
}
