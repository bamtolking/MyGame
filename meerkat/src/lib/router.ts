import { signal } from '@preact/signals';

export interface Route {
  path: string;
  parts: string[];
  query: Record<string, string>;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const query: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(qs)) query[k] = v;
  return { path, parts: path.split('/').filter(Boolean), query };
}

export const route = signal<Route>(parse(typeof location !== 'undefined' ? location.hash : ''));
/** 화면 전환 방향 (애니메이션용) */
export const navDir = signal<'forward' | 'back' | 'none'>('none');

let depth = 0;
if (typeof window !== 'undefined') {
  history.replaceState({ depth: 0 }, '');
  window.addEventListener('popstate', (e) => {
    const d = (e.state && e.state.depth) || 0;
    navDir.value = d < depth ? 'back' : 'forward';
    depth = d;
    route.value = parse(location.hash);
  });
}

export function nav(path: string) {
  depth += 1;
  navDir.value = 'forward';
  history.pushState({ depth }, '', '#' + path);
  route.value = parse('#' + path);
  window.scrollTo(0, 0);
}

export function replace(path: string) {
  navDir.value = 'none';
  history.replaceState({ depth }, '', '#' + path);
  route.value = parse('#' + path);
  window.scrollTo(0, 0);
}

/** 이전 화면으로. 앱 첫 화면이면 fallback 경로로 이동 */
export function back(fallback = '/') {
  if (depth > 0) history.back();
  else replace(fallback);
}
