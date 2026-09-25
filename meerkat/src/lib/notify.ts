import { LocalNotifications } from '@capacitor/local-notifications';
import { lang } from '../i18n';
import type { Settings } from '../state/store';
import { isNative } from './platform';

const DAILY_ID = 1;
const DESK_BASE = 100;

const deskLines = {
  ko: [
    '어깨 한 번 으쓱, 턱 한 번 쏙! 1분만 투자해요',
    '50분 앉아 있었다면 지금 일어날 시간이에요',
    '모니터 속으로 빨려 들어가고 있진 않나요? 🐢',
    '숨 한 번 크게, 가슴 활짝! 등 펴기 1분',
    '다리 꼬고 있다면 지금 풀어 주세요 🦩',
  ],
  en: [
    'Shrug, tuck your chin — one minute is all it takes',
    'Sitting for 50 minutes? Time to stand up',
    'Getting sucked into the screen? 🐢',
    'Big breath, open chest — one-minute back reset',
    'Crossing your legs? Uncross them now 🦩',
  ],
};

function hm(s: string): [number, number] {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return [h || 0, m || 0];
}

export type ReminderResult = 'ok' | 'denied' | 'web';

/** 설정에 맞춰 로컬 알림을 다시 예약합니다. */
export async function applyReminders(s: Settings): Promise<ReminderResult> {
  if (!isNative()) return 'web';
  const ko = lang.value === 'ko';
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  if (!s.reminder.enabled && !s.deskBreak.enabled) return 'ok';
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 'denied';

  const list: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
  if (s.reminder.enabled) {
    const [hour, minute] = hm(s.reminder.time);
    list.push({
      id: DAILY_ID,
      title: ko ? '오늘의 자세 리셋 🧘' : 'Your daily posture reset 🧘',
      body: ko ? '10분이면 충분해요. 거북이에서 미어캣으로!' : 'Ten minutes is enough. From turtle to meerkat!',
      schedule: { on: { hour, minute }, allowWhileIdle: true },
      extra: { path: '/routine/today' },
    });
  }
  if (s.deskBreak.enabled) {
    const [fh, fm] = hm(s.deskBreak.from);
    const [th, tm] = hm(s.deskBreak.to);
    const start = fh * 60 + fm + s.deskBreak.everyMin;
    const end = th * 60 + tm;
    const lines = ko ? deskLines.ko : deskLines.en;
    let n = 0;
    // 월~금(2~6), iOS 예약 한도(64개)를 넘지 않게 제한
    for (let t = start; t <= end && n < 45; t += s.deskBreak.everyMin) {
      for (let weekday = 2; weekday <= 6 && n < 45; weekday++) {
        list.push({
          id: DESK_BASE + n,
          title: ko ? '1분 자세 리셋' : 'One-minute reset',
          body: lines[n % lines.length],
          schedule: { on: { weekday, hour: Math.floor(t / 60), minute: t % 60 }, allowWhileIdle: true },
          extra: { path: '/desk' },
        });
        n++;
      }
    }
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list });
  return 'ok';
}

export function onNotificationTap(cb: (path: string) => void) {
  if (!isNative()) return;
  LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const path = a.notification.extra?.path;
    if (typeof path === 'string') cb(path);
  }).catch(() => undefined);
}
