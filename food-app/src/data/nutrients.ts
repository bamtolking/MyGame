// 영양성분 정의. dv는 식약처 「식품등의 표시기준」 1일 영양성분 기준치. 열량은 기준치 대신 2,000kcal 대비로 표시한다.

export type NutrientId =
  | 'kcal'
  | 'carb'
  | 'sugar'
  | 'fiber'
  | 'protein'
  | 'fat'
  | 'satFat'
  | 'mufa'
  | 'pufa'
  | 'transFat'
  | 'la'
  | 'ala'
  | 'epaDha'
  | 'cholesterol'
  | 'sodium'
  | 'potassium'
  | 'calcium'
  | 'magnesium'
  | 'iron'
  | 'zinc'
  | 'selenium'
  | 'iodine'
  | 'vitA'
  | 'vitC'
  | 'vitD'
  | 'vitE'
  | 'vitK'
  | 'vitB1'
  | 'vitB2'
  | 'vitB6'
  | 'folate'
  | 'vitB12';

export type NutrientGroup = 'energy' | 'macro' | 'fat' | 'vitamin' | 'mineral';

export interface NutrientDef {
  id: NutrientId;
  name: string;
  unit: 'kcal' | 'g' | 'mg' | 'μg';
  group: NutrientGroup;
  dv?: number;
  /** 많이 먹을수록 좋지 않은 항목 (막대 색을 다르게 표시) */
  limit?: boolean;
  /** 표에서 들여쓰기(하위 항목) */
  sub?: boolean;
  hint?: string;
}

export const NUTRIENTS: NutrientDef[] = [
  { id: 'kcal', name: '열량', unit: 'kcal', group: 'energy', dv: 2000, hint: '2,000kcal 대비' },
  { id: 'carb', name: '탄수화물', unit: 'g', group: 'macro', dv: 324 },
  { id: 'sugar', name: '당류', unit: 'g', group: 'macro', dv: 100, limit: true, sub: true },
  { id: 'fiber', name: '식이섬유', unit: 'g', group: 'macro', dv: 25, sub: true },
  { id: 'protein', name: '단백질', unit: 'g', group: 'macro', dv: 55 },
  { id: 'fat', name: '지방', unit: 'g', group: 'fat', dv: 54 },
  { id: 'satFat', name: '포화지방', unit: 'g', group: 'fat', dv: 15, limit: true, sub: true },
  { id: 'transFat', name: '트랜스지방', unit: 'g', group: 'fat', limit: true, sub: true },
  { id: 'mufa', name: '단일불포화지방', unit: 'g', group: 'fat', sub: true },
  { id: 'pufa', name: '다불포화지방', unit: 'g', group: 'fat', sub: true },
  { id: 'la', name: '리놀레산 (오메가6)', unit: 'g', group: 'fat', dv: 10, sub: true },
  { id: 'ala', name: '알파리놀렌산 (오메가3)', unit: 'g', group: 'fat', dv: 1.3, sub: true },
  { id: 'epaDha', name: 'EPA+DHA (오메가3)', unit: 'mg', group: 'fat', dv: 330, sub: true },
  { id: 'cholesterol', name: '콜레스테롤', unit: 'mg', group: 'fat', dv: 300, limit: true },
  { id: 'sodium', name: '나트륨', unit: 'mg', group: 'mineral', dv: 2000, limit: true },
  { id: 'potassium', name: '칼륨', unit: 'mg', group: 'mineral', dv: 3500 },
  { id: 'calcium', name: '칼슘', unit: 'mg', group: 'mineral', dv: 700 },
  { id: 'magnesium', name: '마그네슘', unit: 'mg', group: 'mineral', dv: 315 },
  { id: 'iron', name: '철', unit: 'mg', group: 'mineral', dv: 12 },
  { id: 'zinc', name: '아연', unit: 'mg', group: 'mineral', dv: 8.5 },
  { id: 'selenium', name: '셀레늄', unit: 'μg', group: 'mineral', dv: 55 },
  { id: 'iodine', name: '요오드', unit: 'μg', group: 'mineral', dv: 150 },
  { id: 'vitA', name: '비타민 A', unit: 'μg', group: 'vitamin', dv: 700, hint: 'μg RAE' },
  { id: 'vitC', name: '비타민 C', unit: 'mg', group: 'vitamin', dv: 100 },
  { id: 'vitD', name: '비타민 D', unit: 'μg', group: 'vitamin', dv: 10 },
  { id: 'vitE', name: '비타민 E', unit: 'mg', group: 'vitamin', dv: 11, hint: 'mg α-TE' },
  { id: 'vitK', name: '비타민 K', unit: 'μg', group: 'vitamin', dv: 70 },
  { id: 'vitB1', name: '비타민 B1 (티아민)', unit: 'mg', group: 'vitamin', dv: 1.2 },
  { id: 'vitB2', name: '비타민 B2 (리보플라빈)', unit: 'mg', group: 'vitamin', dv: 1.4 },
  { id: 'vitB6', name: '비타민 B6', unit: 'mg', group: 'vitamin', dv: 1.5 },
  { id: 'folate', name: '엽산', unit: 'μg', group: 'vitamin', dv: 400, hint: 'μg DFE' },
  { id: 'vitB12', name: '비타민 B12', unit: 'μg', group: 'vitamin', dv: 2.4 },
];

export const NUTRIENT_BY_ID = Object.fromEntries(NUTRIENTS.map((n) => [n.id, n])) as Record<NutrientId, NutrientDef>;
export const NUTRIENT_IDS = NUTRIENTS.map((n) => n.id);
