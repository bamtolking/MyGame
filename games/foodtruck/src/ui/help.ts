// 도움말 내용 (영업 화면 밖에서 열람)
import { h, svgEl } from './dom';
import { ALL_FOODS, FAMILY_DEFS } from '../data/foods';
import { CUSTOMER_DEFS, CUSTOMER_TYPES } from '../data/customers';
import { TIME, DECOR, PRICES, TIP } from '../data/balance';
import { foodIcon, customerFace } from '../render/icons';

export function helpContent(): HTMLElement {
  const root = h('div', { class: 'help' });
  root.append(
    h('h4', {}, '하루의 흐름'),
    h('p', {}, '영업일 선택 → 손님·목표 확인, 가구 배치·구매 → 영업 시작(약 3분) → 주문 처리 → 마감 정리 → 정산 → 가게 손보기 → 다음 영업일. 준비 시간에는 제한이 없어요.'),
    h('h4', {}, '조작 (드래그 없이 모두 가능)'),
    h('ul', {},
      h('li', {}, '음식 누르기 → 같은 음식 누르기 = 합성 (두 번째 칸에 한 단계 높은 음식이 생겨요)'),
      h('li', {}, '음식 누르기 → 빈칸 누르기 = 이동'),
      h('li', {}, '구이·음료·디저트 버튼: 1단계 음식 1개 생성. 길게 누르면 연속 생성(손을 떼면 멈춤).'),
      h('li', {}, '주문 카드에 "준비 완료"가 뜨면 카드를 눌러 서빙을 맡겨요. 직원이 실제로 전달해야 수입이 들어와요.'),
      h('li', {}, '음식을 고른 뒤 "정리"로 그 음식 1개를 없앨 수 있어요 (코인 없음).'),
    ),
    h('h4', {}, '시간 규칙'),
    h('ul', {},
      h('li', {}, `영업 ${TIME.dayLength}초. ${TIME.lastArrival}초부터 새 손님이 오지 않고, 마지막 30초는 남은 주문을 처리하는 시간이에요.`),
      h('li', {}, `${TIME.dayLength}초가 되면 생산·합성·새 접수가 끝나고, 이미 접수한 서빙만 마무리해요.`),
      h('li', {}, '영업 시작 시 계열별 1단계 음식 2개씩(총 6개)을 받아요. 남은 음식은 다음 날로 이월되지 않고 코인으로 바뀌지도 않아요.'),
      h('li', {}, '도움말·설정을 열면 영업이 멈춰요. 화면을 벗어나면 자동으로 멈추고, 돌아오면 확인 후 재개해요.'),
    ),
    h('h4', {}, '주문·인내·팁'),
    h('ul', {},
      h('li', {}, '주문은 메뉴 1~2개. 정확히 같은 계열·단계·수량이 있어야 접수돼요. 높은 단계 음식으로 낮은 단계 주문을 대신할 수 없어요.'),
      h('li', {}, '좌석이 없으면 최대 3명이 줄을 서요(대기줄 인내). 앉으면 주문 인내가 줄어들어요. 접수하면 인내 감소가 멈춰요.'),
      h('li', {}, `팁은 접수 시점에 남은 인내 비율로 정해져요: ${Math.round(TIP.fullRatio * 100)}% 이상 → 팁 100%, ${Math.round(TIP.halfRatio * 100)}% 이상 → 50%, 그 미만 → 0. 팁 = 판매액 × 손님 팁 비율 × 배율.`),
    ),
    h('h4', {}, '가게'),
    h('ul', {},
      h('li', {}, '직원은 배식구에서 음식을 받아 좌석 옆 칸까지 걸어가 전달하고 돌아와요. 경로가 길수록 오래 걸려요.'),
      h('li', {}, `장식이 좌석과 상하좌우로 붙어 있으면 그 좌석의 주문 인내가 +${DECOR.perDecorSec}초(좌석당 최대 +${DECOR.capSec}초).`),
      h('li', {}, `구매: 세 번째 좌석 ${PRICES.seat[0]}, 네 번째 좌석 ${PRICES.seat[1]}, 장식 ${PRICES.decor}(최대 ${PRICES.decorMax}개), 직원 속도 ${PRICES.staffSpeed[0]}/${PRICES.staffSpeed[1]} 코인.`),
    ),
    h('h4', {}, '손님 6종'),
  );
  for (const t of CUSTOMER_TYPES) {
    const d = CUSTOMER_DEFS[t];
    root.append(h('div', { class: 'row', style: 'gap:8px;margin:4px 0' }, svgEl(customerFace(t), ''), h('div', { class: 'grow' }, h('b', {}, d.name), h('div', { class: 'small muted' }, `${d.desc} 대기줄 ${d.queuePatience}초 · 주문 인내 ${d.basePatience}초+ · 식사 ${d.eatTime}초 · 팁 ${Math.round(d.tipRate * 100)}%`))));
    (root.lastElementChild!.firstElementChild as HTMLElement).style.cssText = 'width:36px;height:36px;flex-shrink:0';
  }
  root.append(h('h4', {}, '메뉴 12종 (모든 단계가 판매 메뉴)'));
  const ml = h('div', { class: 'menulist' });
  for (const f of ALL_FOODS) ml.append(h('div', { class: 'm' }, svgEl(foodIcon(f.family, f.tier)), h('div', {}, h('b', {}, f.name), h('div', { class: 'muted' }, `${FAMILY_DEFS[f.family].name} ${f.tier}단계 · ${f.price}코인`))));
  root.append(ml);
  root.append(
    h('h4', {}, '저장'),
    h('p', {}, '영업 중 3초마다, 그리고 합성·접수·전달·구매·정산 뒤에 전체 상태를 이 기기의 브라우저에 저장해요. 이어하기는 가장 최근 저장 지점부터 일시정지 상태로 시작해요. 앱을 닫아둔 시간은 영업에 적용되지 않고 오프라인 수입도 없어요.'),
  );
  return root;
}
