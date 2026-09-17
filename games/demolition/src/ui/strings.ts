import type { FailReason, TutorialKey } from '../sim/types';

export const FAIL_TEXT: Record<FailReason, { title: string; detail: string }> = {
  goalsRemaining: { title: '목표가 남아 있어요', detail: '아직 철거되지 않은 목표가 있습니다. 다른 지점을 노려 보세요.' },
  outOfShots: { title: '발사 횟수를 모두 사용했어요', detail: '목표가 남아 있습니다. 구조를 다시 살펴보고 다른 방법을 시도해 보세요.' },
  protectHit: { title: '보호상자를 직접 맞혔어요', detail: '커터볼이 보호상자에 닿으면 실패입니다. 상자를 피해 가는 경로를 찾아 보세요.' },
  protectOut: { title: '보호상자가 안전 구역을 벗어났어요', detail: '충격이 너무 컸습니다. 세기를 줄이거나 다른 지점을 노려 보세요.' },
};

export const TUTORIALS: Record<TutorialKey, string[]> = {
  basic: [
    '<b>발사대</b>를 손가락으로 누른 채 <b>왼쪽 아래로 당겨</b> 보세요.',
    '방향과 세기를 확인한 뒤 <b>손을 놓으면</b> 반대 방향으로 커터볼이 날아갑니다.',
    '<b>노란 줄무늬 테두리</b>가 있는 블록이 철거 목표예요. 넘어뜨리세요!',
    '실패하거나 다른 방법을 써 보고 싶으면 <b>다시 시작</b> 버튼을 누르세요.',
  ],
  rope: ['커터볼이 <b>밧줄</b>에 닿으면 줄이 끊어집니다. 매달린 것은 중력에 따라 떨어져요.'],
  ball: ['<b>쇠공</b>은 커터볼보다 훨씬 무겁습니다. 경사면을 굴러가면 큰 힘으로 목표를 때려요.'],
  seesaw: ['<b>시소</b>는 볼트를 축으로 회전합니다. 한쪽에 무게가 실리면 반대쪽이 올라가요.'],
  protect: ['<b>보호상자</b>는 커터볼로 직접 맞히거나 <b>파란 안전 구역</b> 밖으로 밀어내면 실패입니다. 상자 가운데 점이 구역 안에 있어야 해요.'],
  twoShots: ['이 스테이지는 <b>두 발</b>을 쓸 수 있어요. 첫 발의 결과는 그대로 남고, 두 번째 발은 그 위에서 이어집니다.'],
};

export const SAVE_POLICY = '저장은 스테이지 결과가 나올 때 이루어집니다. 게임을 닫았다가 돌아오면 현재 스테이지를 처음부터 다시 시작합니다.';
