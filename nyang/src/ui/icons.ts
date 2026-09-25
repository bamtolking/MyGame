// 인라인 SVG 아이콘 (외부 파일 없이 동작)
const svg = (body: string, vb = '0 0 32 32') => `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICON = {
  pause: svg('<rect x="9" y="7" width="5" height="18" rx="2.5" fill="#4A2E23"/><rect x="18" y="7" width="5" height="18" rx="2.5" fill="#4A2E23"/>'),
  paw: svg('<ellipse cx="16" cy="21" rx="7" ry="5.6" fill="#FF6F7D"/><ellipse cx="8.6" cy="13.6" rx="2.6" ry="3.2" fill="#FF6F7D"/><ellipse cx="13.2" cy="9.2" rx="2.6" ry="3.2" fill="#FF6F7D"/><ellipse cx="18.8" cy="9.2" rx="2.6" ry="3.2" fill="#FF6F7D"/><ellipse cx="23.4" cy="13.6" rx="2.6" ry="3.2" fill="#FF6F7D"/>'),
  drop: svg('<path d="M16 4C12 10 7.5 14.5 7.5 19.5a8.5 8.5 0 0 0 17 0C24.5 14.5 20 10 16 4Z" fill="#5FB2FF" stroke="#3A83CF" stroke-width="2"/><path d="M11.5 19.5a4.5 4.5 0 0 0 3 4.2" stroke="#fff" stroke-width="2.2"/><path d="M11 13l-1.5-2.8M21 13l1.5-2.8" stroke="#3A83CF" stroke-width="2"/>'),
  box: svg('<path d="M6 12h20v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V12Z" fill="#D69C5E" stroke="#9C6632" stroke-width="2"/><path d="M6 12l-3-5 9 1 4 4M26 12l3-5-9 1-4 4" fill="#E8B57C" stroke="#9C6632" stroke-width="2"/><path d="M2 18l2 2-2 2M30 18l-2 2 2 2" stroke="#4A2E23" stroke-width="2"/>'),
  gear: svg('<circle cx="16" cy="16" r="4.5" stroke="#4A2E23" stroke-width="2.6"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M7.5 24.5l2.8-2.8M21.7 10.3l2.8-2.8" stroke="#4A2E23" stroke-width="2.6"/>'),
  book: svg('<path d="M5 7c4-2 8-2 11 1v18c-3-3-7-3-11-1V7ZM27 7c-4-2-8-2-11 1v18c3-3 7-3 11-1V7Z" fill="#fff" stroke="#fff" stroke-width="2.2"/>'),
  home: svg('<path d="M5 15 16 6l11 9M8 13v13h16V13" stroke="currentColor" stroke-width="2.6"/>'),
  retry: svg('<path d="M25 11a10 10 0 1 0 1.5 7" stroke="currentColor" stroke-width="2.8"/><path d="M26 4v7h-7" stroke="currentColor" stroke-width="2.8"/>'),
  share: svg('<path d="M16 4v15M10 10l6-6 6 6" stroke="currentColor" stroke-width="2.8"/><path d="M8 15v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9" stroke="currentColor" stroke-width="2.8"/>'),
  play: svg('<path d="M10 6.5v19a1.5 1.5 0 0 0 2.3 1.3l14-9.5a1.5 1.5 0 0 0 0-2.6l-14-9.5A1.5 1.5 0 0 0 10 6.5Z" fill="currentColor"/>'),
  heart: svg('<path d="M16 27S4 19.5 4 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 12 3.5C28 19.5 16 27 16 27Z" fill="currentColor"/>'),
  calendar: svg('<rect x="5" y="7" width="22" height="20" rx="4" fill="#fff"/><path d="M5 13h22" stroke="#23967C" stroke-width="2.4"/><path d="M11 4v5M21 4v5" stroke="#fff" stroke-width="2.8"/><circle cx="16" cy="20" r="3" fill="#FF6F7D"/>'),
  nip: svg('<circle cx="16" cy="16" r="11" fill="#7CCB5E" stroke="#2F6B25" stroke-width="2"/><path d="M6 13c6 4 14 4 20 0M6 20c6 3 14 3 20 0" stroke="#4E9A3A" stroke-width="2"/>'),
  flame: svg('<path d="M16 3c1 5 7 7 7 14a7 7 0 0 1-14 0c0-3 1.5-5 3-6.5 0 3 1.5 4.5 3 4.5-1-4 0-8 1-12Z" fill="#FF7A45" stroke="#D9481B" stroke-width="1.6"/><path d="M16 17c2 2 3 3.5 3 5a3 3 0 0 1-6 0c0-1.5 1.2-3 3-5Z" fill="#FFD34D"/>'),
  check: svg('<circle cx="16" cy="16" r="12" fill="#3FC7A6"/><path d="M10 16.5l4 4 8-9" stroke="#fff" stroke-width="3.2"/>'),
  brush: svg('<path d="M22 4l6 6-11 11-6-6L22 4Z" fill="#FF9DB0" stroke="#C94E68" stroke-width="2"/><path d="M11 15l6 6c-1 5-6 7-12 6 2-2 1-5 2-8 1-2 2-3 4-4Z" fill="#8C5A3C"/>'),
  fever: svg('<rect x="5" y="4" width="6" height="24" rx="3" fill="#FFB45C"/><rect x="21" y="4" width="6" height="24" rx="3" fill="#FF6F9A"/><path d="M16 9l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5Z" fill="#FFD34D" stroke="#D9A514" stroke-width="1"/>'),
  warn: svg('<path d="M16 4 29 27H3L16 4Z" fill="#FFD34D" stroke="#D9A514" stroke-width="2"/><path d="M16 12v7" stroke="#4A2E23" stroke-width="3"/><circle cx="16" cy="23" r="1.8" fill="#4A2E23"/>'),
};
