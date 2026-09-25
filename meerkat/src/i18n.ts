import { signal } from '@preact/signals';

export type Lang = 'ko' | 'en';
export interface Text {
  ko: string;
  en: string;
}

function detect(): Lang {
  try {
    const saved = localStorage.getItem('mk.lang');
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {
    /* 저장소 접근 불가 */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('ko') || !nav ? 'ko' : 'en';
}

export const lang = signal<Lang>(typeof window === 'undefined' ? 'ko' : detect());

export function setLang(l: Lang) {
  lang.value = l;
  try {
    localStorage.setItem('mk.lang', l);
  } catch {
    /* noop */
  }
  document.documentElement.lang = l;
}

/** 인라인 번역: tr('한국어', 'English') */
export function tr(ko: string, en: string): string {
  return lang.value === 'ko' ? ko : en;
}

/** 콘텐츠 객체 번역 */
export function L(t: Text | string | undefined | null): string {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  return t[lang.value] ?? t.ko;
}

/** 배열 콘텐츠 번역 */
export function LA(t: { ko: string[]; en: string[] } | undefined): string[] {
  if (!t) return [];
  return t[lang.value] ?? t.ko;
}

/** 숫자 포맷 (소수 자릿수) */
export function num(v: number, digits = 0): string {
  return v.toLocaleString(lang.value === 'ko' ? 'ko-KR' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
