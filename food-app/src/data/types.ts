// 데이터 스키마. 식품(Food)은 성분(Compound)을 id로 참조하고, 성분은 작용 경로(Pathway)를 단계별로 설명한다.
import type { CompoundId } from './catalog';
import type { NutrientId } from './nutrients';

/**
 * 근거 수준
 * - strong: 사람 대상 무작위 대조시험(RCT)·메타분석에서 일관되게 확인
 * - moderate: 사람 관찰연구가 일관되고 일부 RCT가 뒷받침
 * - limited: 주로 시험관·동물 연구, 사람 근거는 적거나 간접적
 * - contested: 연구 결과가 서로 엇갈리거나 널리 퍼진 주장과 근거가 다름
 */
export type Evidence = 'strong' | 'moderate' | 'limited' | 'contested';

/** 몸에 대한 전반적 영향: 이로움 / 양면성(양·형태·사람에 따라 다름) / 주의(조건부 위험) / 해로움 */
export type Effect = 'benefit' | 'mixed' | 'caution' | 'harm';

export type CompoundKind =
  | '폴리페놀'
  | '카로티노이드'
  | '유황화합물'
  | '기타 식물성분'
  | '식이섬유·탄수화물'
  | '미생물'
  | '비타민'
  | '무기질·영양소'
  | '지방산'
  | '항영양소'
  | '유해 생성물'
  | '오염물질·기타';

export type TagId =
  | 'antioxidant'
  | 'anti-inflammatory'
  | 'vascular'
  | 'cholesterol'
  | 'blood-sugar'
  | 'gut'
  | 'brain'
  | 'eye'
  | 'bone-muscle'
  | 'liver'
  | 'immune'
  | 'hormone'
  | 'skin'
  | 'energy'
  | 'cancer'
  | 'inflammation-risk'
  | 'oxidative-risk'
  | 'autoimmune';

/** 기전의 한 단계. title은 짧은 단계명(예: "흡수", "간에서 대사"), body는 그 단계에서 일어나는 일. */
export interface Step {
  title: string;
  body: string;
}

/** 하나의 작용 경로. 단계는 섭취 → 흡수 → 대사/표적 → 결과 순서로 쓴다. */
export interface Pathway {
  title: string;
  evidence: Evidence;
  steps: Step[];
  note?: string;
}

export interface Compound {
  id: CompoundId;
  name: string;
  en: string;
  aliases?: string[];
  kind: CompoundKind;
  effect: Effect;
  tags: TagId[];
  /** 1~2문장 요약 */
  summary: string;
  /** 1~3개 경로, 중요한 것부터 */
  pathways: Pathway[];
  /** 사람 연구에서 확인된 것과 아닌 것을 구분한 근거 요약 */
  evidenceNote: string;
  /** 흡수율, 조리 영향, 함량 비교 같은 사실 */
  facts?: string[];
  cautions?: string[];
  /** 실제로 존재하는 출처만. 저자·학술지·연도 수준으로 쓰고 쪽수·DOI는 확실할 때만. */
  refs?: string[];
}

export type FoodCategory =
  | '채소'
  | '과일'
  | '곡물'
  | '콩·견과·씨앗'
  | '기름·지방'
  | '육류·달걀'
  | '해산물·해조류'
  | '유제품'
  | '발효식품'
  | '향신료·차·음료'
  | '가공식품·기호식품';

/** 한 줄 평가의 톤: 자주 먹기 좋음 / 균형 있게 / 조건부·주의 / 줄이기 */
export type Verdict = 'good' | 'balanced' | 'caution' | 'limit';

export type Nutrients = Partial<Record<NutrientId, number>>;

export interface FoodCompound {
  id: CompoundId;
  /** 이 식품 속 대략적인 함량 (예: "약 12mg/100g") */
  amount?: string;
  /** 이 식품에서 이 성분이 하는 역할 한두 문장 */
  role: string;
  /** 이 식품 안에서의 영향이 성분 기본값과 다를 때만 (예: 통과일 속 과당은 첨가당과 달라 'mixed') */
  effect?: Effect;
}

export interface Food {
  id: string;
  name: string;
  en: string;
  aliases?: string[];
  emoji: string;
  category: FoodCategory;
  summary: string;
  verdict: { tone: Verdict; text: string };
  /** 영양성분 기준 상태 (예: "생 시금치 100g") */
  basis: string;
  serving: { label: string; grams: number };
  /** 100g당 값. 단위는 nutrients.ts 정의를 따른다. 확실하지 않은 값은 넣지 않는다. */
  nutrients: Nutrients;
  /** 핵심 성분, 중요한 것부터 */
  compounds: FoodCompound[];
  /** 먹는 방법·조리 팁 */
  howToEat: Step[];
  pairings?: { good?: string[]; avoid?: string[] };
  cautions?: string[];
  /** 흔한 주장과 실제 근거 */
  myths?: { claim: string; truth: string }[];
}

/** 자주 묻는 질문 하나. a에는 "• " 목록 줄과 [근거 강함]·[근거 중간]·[근거 제한적]·[논쟁 중] 표시를 쓸 수 있다. */
export interface QA {
  q: string;
  a: string;
}

/** 식품 id 또는 성분 id → 질문 목록 */
export type FaqMap = Record<string, QA[]>;
