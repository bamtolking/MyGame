// 성분 목록(id → 이름). 식품은 여기 있는 id로만 성분을 참조할 수 있고, 테스트가 모든 id에 성분 설명이 있는지 확인한다.
import type { TagId } from './types';

export const COMPOUND_CATALOG = {
  // 폴리페놀
  anthocyanin: '안토시아닌',
  quercetin: '퀘르세틴',
  egcg: '카테킨 (EGCG)',
  curcumin: '커큐민',
  resveratrol: '레스베라트롤',
  'chlorogenic-acid': '클로로겐산',
  'cocoa-flavanol': '코코아 플라바놀',
  isoflavone: '이소플라본',
  ellagitannin: '엘라지탄닌·유롤리틴',
  hesperidin: '헤스페리딘',
  'olive-polyphenol': '올리브 폴리페놀',
  lignan: '리그난',
  // 카로티노이드
  'beta-carotene': '베타카로틴',
  lutein: '루테인·제아잔틴',
  lycopene: '라이코펜',
  astaxanthin: '아스타잔틴',
  // 유황화합물·기타 식물성분
  sulforaphane: '설포라판',
  allicin: '알리신 (마늘 유황화합물)',
  'dietary-nitrate': '식이 질산염',
  capsaicin: '캡사이신',
  gingerol: '진저롤·쇼가올',
  caffeine: '카페인',
  // 식이섬유·탄수화물·미생물
  'beta-glucan': '베타글루칸',
  'prebiotic-fiber': '발효성 식이섬유 (프리바이오틱스)',
  'resistant-starch': '저항성 전분',
  'seaweed-polysaccharide': '해조 다당류 (알긴산·후코이단)',
  'added-sugar': '첨가당·과당',
  'refined-carb': '정제 탄수화물',
  probiotics: '유산균 (프로바이오틱스)',
  // 비타민
  'vitamin-c': '비타민 C',
  'vitamin-k': '비타민 K',
  folate: '엽산',
  'vitamin-e': '비타민 E',
  'vitamin-d': '비타민 D',
  'vitamin-b12': '비타민 B12',
  // 무기질·영양소
  magnesium: '마그네슘',
  potassium: '칼륨',
  'nonheme-iron': '비헴철 (식물성 철)',
  'heme-iron': '헴철 (동물성 철)',
  calcium: '칼슘',
  iodine: '요오드',
  selenium: '셀레늄',
  zinc: '아연',
  choline: '콜린',
  // 지방산
  'epa-dha': '오메가3 EPA·DHA',
  ala: '알파리놀렌산 (식물성 오메가3)',
  'linoleic-acid': '리놀레산 (오메가6)',
  'oleic-acid': '올레산 (단일불포화지방)',
  'saturated-fat': '포화지방',
  'trans-fat': '트랜스지방',
  'oxidized-lipids': '산화 지질 (과산화물·알데하이드)',
  mct: '중쇄지방산 (MCT)',
  // 항영양소·유해 생성물·오염물질
  lectin: '렉틴',
  oxalate: '옥살산',
  phytate: '피트산',
  gluten: '글루텐',
  glycoalkaloid: '글리코알칼로이드 (솔라닌)',
  acrylamide: '아크릴아마이드',
  nitrosamine: '아질산염·니트로사민',
  'heat-byproducts': '고온 조리 부산물 (HCA·PAH·AGEs)',
  methylmercury: '메틸수은',
  ethanol: '알코올 (에탄올)',
  sodium: '나트륨',
} as const;

export type CompoundId = keyof typeof COMPOUND_CATALOG;
export const COMPOUND_IDS = Object.keys(COMPOUND_CATALOG) as CompoundId[];

export const TAGS: Record<TagId, string> = {
  antioxidant: '항산화',
  'anti-inflammatory': '항염',
  vascular: '혈관·혈압',
  cholesterol: '콜레스테롤·지질',
  'blood-sugar': '혈당·인슐린',
  gut: '장 건강',
  brain: '뇌·신경',
  eye: '눈',
  'bone-muscle': '뼈·근육',
  liver: '간·해독',
  immune: '면역',
  hormone: '호르몬',
  skin: '피부',
  energy: '에너지 대사',
  cancer: '암 관련 연구',
  'inflammation-risk': '염증 유발',
  'oxidative-risk': '산화 스트레스 유발',
  autoimmune: '자가면역 관련',
};
export const TAG_IDS = Object.keys(TAGS) as TagId[];
