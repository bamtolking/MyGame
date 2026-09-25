// 고양이 11단계. 같은 단계 두 마리가 닿으면 다음 단계 한 마리가 된다.
// 반지름은 물리 기준(상자 안쪽 폭 360), 색은 모두 여기서만 정의한다.

export type Pattern =
  | 'kitten' | 'tabby' | 'mackerel' | 'tux' | 'calico' | 'point'
  | 'blue' | 'spots' | 'persian' | 'coon' | 'cosmic';

export interface CatDef {
  id: string;
  name: string;
  en: string;
  r: number;
  body: string;
  line: string;
  belly: string;
  ear: string;
  eye: string;
  /** 무늬 색 1, 2 (무늬 종류마다 쓰임이 다름) */
  c1: string;
  c2: string;
  pattern: Pattern;
  /** 외곽선 털 결 (0이면 매끈) */
  fluff: number;
  desc: string;
}

export const CATS: CatDef[] = [
  { id: 'kitten', name: '아깽이', en: 'Kitten', r: 13, body: '#FFF6EC', line: '#C49A7E', belly: '#FFFFFF', ear: '#FFB3C4', eye: '#3A2622', c1: '#FFD7B0', c2: '#FFE9D2', pattern: 'kitten', fluff: 0.03,
    desc: '손바닥만 한 털뭉치. 세상 모든 게 장난감이다.' },
  { id: 'cheese', name: '치즈냥', en: 'Ginger', r: 17, body: '#FFB44C', line: '#B8641C', belly: '#FFF2DE', ear: '#FFAE9E', eye: '#3B2415', c1: '#E9822A', c2: '#FFCB80', pattern: 'tabby', fluff: 0,
    desc: '치즈색 줄무늬. 먹을 것 앞에서는 체면이 없다.' },
  { id: 'mackerel', name: '고등어', en: 'Mackerel', r: 22, body: '#A9B1BE', line: '#4C5361', belly: '#F4F5F8', ear: '#F2AFBD', eye: '#2B303B', c1: '#5E6676', c2: '#C4CAD4', pattern: 'mackerel', fluff: 0,
    desc: '등무늬가 고등어를 닮았다. 정작 좋아하는 건 참치.' },
  { id: 'tuxedo', name: '턱시도', en: 'Tuxedo', r: 28, body: '#34343F', line: '#15151B', belly: '#FFFFFF', ear: '#E7949F', eye: '#F4CB45', c1: '#4A4A57', c2: '#FFFFFF', pattern: 'tux', fluff: 0,
    desc: '언제나 정장 차림. 하얀 양말은 절대 벗지 않는다.' },
  { id: 'calico', name: '삼색이', en: 'Calico', r: 35, body: '#FFFDF7', line: '#AE8A6C', belly: '#FFFFFF', ear: '#FFB0BF', eye: '#3B2415', c1: '#F2994A', c2: '#3A3137', pattern: 'calico', fluff: 0,
    desc: '세 가지 색의 행운 고양이. 성격은 한 가지, 제멋대로.' },
  { id: 'siamese', name: '샴', en: 'Siamese', r: 43, body: '#F7EBD8', line: '#94705A', belly: '#FFF8EE', ear: '#6E4A3B', eye: '#4FB0F2', c1: '#5B3C2F', c2: '#E8D3B6', pattern: 'point', fluff: 0,
    desc: '파란 눈의 수다쟁이. 대답할 때까지 말을 건다.' },
  { id: 'blue', name: '러시안블루', en: 'Russian Blue', r: 52, body: '#8C9EB6', line: '#4C5B71', belly: '#A9B9CD', ear: '#D8A0B1', eye: '#52D08A', c1: '#7A8CA5', c2: '#B7C5D8', pattern: 'blue', fluff: 0,
    desc: '은빛 털의 조용한 귀족. 초록 눈은 모든 걸 알고 있다.' },
  { id: 'bengal', name: '뱅갈', en: 'Bengal', r: 61, body: '#F1B55B', line: '#94591E', belly: '#FFF0D4', ear: '#F1A28C', eye: '#9CCB3B', c1: '#6E3F1B', c2: '#C9873A', pattern: 'spots', fluff: 0,
    desc: '거실의 작은 표범. 커튼은 등반용이다.' },
  { id: 'persian', name: '페르시안', en: 'Persian', r: 71, body: '#FFF3E2', line: '#B99A78', belly: '#FFFFFF', ear: '#FFBFCB', eye: '#E0892B', c1: '#F0D9BC', c2: '#FFFAF2', pattern: 'persian', fluff: 0.045,
    desc: '표정은 늘 불만. 속마음은 아무도 모른다.' },
  { id: 'coon', name: '메인쿤', en: 'Maine Coon', r: 82, body: '#A06E46', line: '#4B2F1A', belly: '#F3E5D0', ear: '#E2A08D', eye: '#D4AC2C', c1: '#5A381F', c2: '#C08E61', pattern: 'coon', fluff: 0.04,
    desc: '귀 끝 깃털이 멋진 거인. 덩치와 달리 겁이 많다.' },
  { id: 'cosmic', name: '우주뚱냥', en: 'Cosmic Chonk', r: 94, body: '#4A35A0', line: '#1B1242', belly: '#7F63E0', ear: '#FF9AD8', eye: '#FFE46B', c1: '#2E6FD6', c2: '#FF7AC8', pattern: 'cosmic', fluff: 0,
    desc: '털 속에 우주가 있다. 오 주여, 그분이 오신다.' },
];

export const MAX_TIER = CATS.length - 1;

/** 두 마리가 합쳐져 tier+1이 될 때 얻는 점수 (tier = 합쳐지는 쪽). 수박게임식 삼각수 × 10. */
export function mergePoints(tier: number): number {
  const t = tier + 1;
  return 10 * t * (t + 1) / 2;
}

/** 우주뚱냥 둘이 만나면 승천하며 받는 보너스 */
export const ASCEND_BONUS = 1000;
