import { ECONOMY, BAG } from './balance';
export interface ShopItem { id: 'shotgun' | 'staff' | 'bag1' | 'bag2'; name: string; price: number; desc: string }
export const SHOP: ShopItem[] = [
  { id: 'shotgun', name: '산탄총 해금', price: ECONOMY.unlockShotgun, desc: '근거리 부채꼴 다발 사격. 소총과 다른 선택지이며 무조건 더 강하지는 않습니다.' },
  { id: 'staff', name: '전기 지팡이 해금', price: ECONOMY.unlockStaff, desc: '전기 연결로 군집을 정리합니다. 고립된 강적에게는 약합니다.' },
  { id: 'bag1', name: '수납 보강 1단계', price: ECONOMY.bagUpgrade[0], desc: `가방 최대 무게 +${BAG.upgradeStep}` },
  { id: 'bag2', name: '수납 보강 2단계', price: ECONOMY.bagUpgrade[1], desc: `가방 최대 무게 +${BAG.upgradeStep} (누적 +${BAG.upgradeStep * 2})` },
];
