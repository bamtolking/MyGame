import { tr, type Text } from './i18n';

/**
 * 앱 브랜드 · 전문가 정보 (출시 전 실제 정보로 바꿔 주세요)
 */
export const BRAND = {
  name: { ko: '미어캣', en: 'Meerkat' } as Text,
  tagline: { ko: '거북이에서 미어캣으로', en: 'From turtle to meerkat' } as Text,
  /** 공유 카드 하단에 표시할 주소 (스토어 링크나 웹사이트) */
  url: 'meerkat.app',
  expertLine: () => tr('현직 물리치료사 · 퍼스널 트레이너가 설계했어요', 'Designed by a licensed physical therapist & personal trainer'),
};

export const EXPERT = {
  // TODO(대표): 실제 이름·자격·경력으로 바꾸세요. 앱 소개 화면과 공유 리포트에 표시됩니다.
  name: { ko: '대표 물리치료사', en: 'Lead physiotherapist' } as Text,
  title: { ko: '물리치료사 · 퍼스널 트레이너', en: 'Physical therapist · Personal trainer' } as Text,
  bio: {
    ko: '병원 재활과 퍼스널 트레이닝 현장에서 만난 수많은 거북목·굽은 등·골반 불균형 사례를 바탕으로, 누구나 집과 사무실에서 따라 할 수 있는 교정 프로그램을 만들었어요.',
    en: 'Built from years of clinical rehab and personal-training work with tech neck, rounded backs and pelvic imbalances — a corrective plan anyone can follow at home or at the desk.',
  } as Text,
};
