import type { Effect, Evidence, Verdict } from '../data/types';

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** 영양 수치 표시: 100 이상은 정수, 10 이상은 소수 1자리, 그 밖은 유효숫자 2자리 */
export function fmtNum(v: number): string {
  if (v === 0) return '0';
  if (v >= 100) return Math.round(v).toLocaleString('ko-KR');
  if (v >= 10) return String(Math.round(v * 10) / 10);
  if (v >= 1) return String(Math.round(v * 10) / 10);
  const p = Number(v.toPrecision(2));
  return p < 0.01 ? '0.01 미만' : String(p);
}

export function pct(v: number, dv: number): number {
  return Math.round((v / dv) * 100);
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  strong: '근거 강함',
  moderate: '근거 중간',
  limited: '근거 제한적',
  contested: '논쟁 중',
};
export const EVIDENCE_HELP: Record<Evidence, string> = {
  strong: '사람 대상 무작위 대조시험·메타분석에서 일관되게 확인된 내용',
  moderate: '사람 관찰연구가 일관되고 일부 대조시험이 뒷받침하는 내용',
  limited: '주로 시험관·동물 연구이며 사람 근거는 적거나 간접적인 내용',
  contested: '연구 결과가 서로 엇갈리거나 널리 퍼진 주장과 근거가 다른 내용',
};
export const EVIDENCE_LEVEL: Record<Evidence, number> = { strong: 4, moderate: 3, limited: 2, contested: 0 };

export const EFFECT_LABEL: Record<Effect, string> = {
  benefit: '이로움',
  mixed: '양면성',
  caution: '주의',
  harm: '해로움',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  good: '자주 먹기 좋아요',
  balanced: '균형 있게',
  caution: '조건부·주의',
  limit: '줄이기',
};
