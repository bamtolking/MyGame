import { effect, signal, type Signal } from '@preact/signals';

const PREFIX = 'mk.';

/** localStorage 에 자동 저장되는 signal */
export function persisted<T>(key: string, initial: T, migrate?: (raw: any) => T): Signal<T> {
  let value = initial;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      if (migrate) value = migrate(parsed);
      else if (Array.isArray(initial)) value = parsed as T;
      else if (initial && typeof initial === 'object') value = { ...(initial as any), ...parsed };
      else value = parsed as T;
    }
  } catch {
    /* 손상된 값은 무시 */
  }
  const s = signal<T>(value);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let first = true;
  effect(() => {
    const v = s.value;
    if (first) {
      first = false;
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(v));
      } catch (e) {
        console.warn('[persist] save failed', key, e);
      }
    }, 120);
  });
  return s;
}

/** 모든 앱 데이터 키 */
export function allKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}
