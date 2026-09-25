import type { Text } from '../i18n';

/** 오늘의 한마디 (물리치료사 팁) */
export const TIPS: Text[] = [
  { ko: '좋은 자세는 “가만히 있는 자세”가 아니라 “자주 바뀌는 자세”예요. 50분마다 1분만 움직여도 충분해요.', en: 'Your best posture is your next posture. Moving for one minute every 50 minutes is enough.' },
  { ko: '모니터 윗부분이 눈높이에 오게 올리면 목 부담이 확 줄어요. 책 두세 권이면 충분해요.', en: 'Raise your monitor so its top edge sits at eye level — a couple of books does the trick.' },
  { ko: '스마트폰은 눈높이로 들어 올려 보세요. 고개를 60° 숙이면 목이 받는 무게가 약 27kg까지 늘어나요.', en: 'Lift your phone to eye level. Bending your head 60° loads your neck with about 27 kg.' },
  { ko: '다리를 꼬고 앉으면 골반이 비틀어져요. 두 발을 바닥에 평평하게, 무릎은 골반 높이로.', en: 'Crossing your legs twists your pelvis. Keep both feet flat and knees level with your hips.' },
  { ko: '가방은 양쪽 어깨로 메거나 자주 바꿔 드세요. 한쪽만 메면 어깨 높이가 달라져요.', en: 'Use both straps or switch sides often — one-sided carrying leaves one shoulder higher.' },
  { ko: '스트레칭은 “아프기 직전의 시원함”까지만. 통증을 참으면 근육이 오히려 굳어요.', en: 'Stretch to “good tension”, never pain. Forcing it makes muscles guard and tighten.' },
  { ko: '숨을 길게 내쉴 때 근육이 더 잘 늘어나요. 스트레칭 중엔 내쉬는 숨을 들이쉬는 숨보다 길게.', en: 'Muscles release on the out-breath. Make your exhales longer than your inhales while stretching.' },
  { ko: '의자에 앉을 땐 엉덩이를 등받이 끝까지 밀어 넣고, 허리 뒤에 작은 쿠션을 받쳐 보세요.', en: 'Slide your hips all the way back in the chair and add a small cushion behind your low back.' },
  { ko: '잠잘 때 너무 높은 베개는 거북목을 만들어요. 옆으로 누웠을 때 목이 일직선인 높이가 좋아요.', en: 'A pillow that’s too high feeds tech neck. Aim for a straight neck line when lying on your side.' },
  { ko: '짝다리를 짚고 있다면 지금 바로 두 발에 체중을 반씩 나눠 실어 보세요.', en: 'Leaning on one leg? Split your weight evenly between both feet right now.' },
  { ko: '교정 운동의 효과는 보통 2~4주부터 보이기 시작해요. 매일 10분이 주말 1시간보다 효과적이에요.', en: 'Postural changes usually show after 2–4 weeks. Ten minutes a day beats an hour on the weekend.' },
  { ko: '거북목 교정의 핵심은 늘리기보다 “약한 근육 깨우기”예요. 턱 당기기를 꾸준히!', en: 'The key to fixing tech neck is waking up weak muscles, not just stretching. Keep up the chin tucks!' },
  { ko: '물 한 잔 마시러 일어나는 것도 훌륭한 자세 리셋이에요. 물병을 일부러 멀리 두세요.', en: 'Getting up for water is a great reset. Keep your bottle out of reach on purpose.' },
  { ko: '노트북만 쓴다면 별도 키보드와 마우스를 쓰고 노트북은 거치대에 올려 보세요.', en: 'Laptop-only? Add a separate keyboard and mouse and raise the laptop on a stand.' },
  { ko: '서 있을 때 무릎을 뒤로 “잠그지” 말고 살짝 풀어 두세요. 허리 부담이 줄어요.', en: 'Don’t lock your knees back when standing — keep them soft to spare your low back.' },
  { ko: '어깨를 억지로 뒤로 젖히기보다 “날개뼈를 뒷주머니에 넣는” 느낌으로 살짝 내려 주세요.', en: 'Instead of forcing your shoulders back, gently slide your shoulder blades “into your back pockets”.' },
  { ko: '통증이 6주 넘게 계속되거나 점점 심해지면 꼭 전문가에게 진료를 받아 보세요.', en: 'If pain lasts more than six weeks or keeps getting worse, please see a professional.' },
  { ko: '일주일에 한 번 같은 조건(같은 옷·같은 장소)으로 스캔하면 변화를 가장 정확히 볼 수 있어요.', en: 'Scan once a week in the same clothes and spot to see your changes most accurately.' },
];

export function tipOfDay(date = new Date()): Text {
  const d = Math.floor(date.getTime() / 864e5);
  return TIPS[d % TIPS.length];
}
