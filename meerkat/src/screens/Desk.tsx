import { Bell, ChevronRight, Sparkles } from 'lucide-preact';
import { Notice, Seg, Toggle, toast, TopBar } from '../components/ui';
import { L, tr } from '../i18n';
import { applyReminders } from '../lib/notify';
import { isNative } from '../lib/platform';
import { nav } from '../lib/router';
import { DESK_PRESETS, deskRoutine } from '../routine/generator';
import { activeRoutine, deskAuto } from '../state/derived';
import { settings } from '../state/store';

export function Desk() {
  const s = settings.value;
  const setDesk = async (patch: Partial<typeof s.deskBreak>) => {
    const next = { ...s, deskBreak: { ...s.deskBreak, ...patch } };
    settings.value = next;
    if (patch.enabled && !isNative() && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => undefined);
    }
    const r = await applyReminders(next).catch(() => 'web' as const);
    if (r === 'denied') toast(tr('알림 권한이 꺼져 있어요. 설정에서 허용해 주세요', 'Notifications are blocked — enable them in settings'));
  };
  const auto = deskAuto(5);
  return (
    <div class="screen">
      <TopBar title={tr('사무실 1분 리셋', 'Desk resets')} />
      <p class="body" style={{ marginTop: 4 }}>
        {tr('의자에 앉거나 선 채로 할 수 있는 짧은 동작이에요. 50분마다 한 번씩이면 충분해요.', 'Short moves you can do seated or standing. Once every 50 minutes is plenty.')}
      </p>
      <button
        class="card brand tap"
        style={{ width: '100%', textAlign: 'left', marginTop: 16 }}
        onClick={() => {
          activeRoutine.value = auto;
          nav('/routine/desk');
        }}
      >
        <div class="row" style={{ gap: 12 }}>
          <Sparkles size={28} />
          <div class="grow">
            <div class="h2" style={{ color: '#fff' }}>
              {tr('나에게 맞춘 5분 데스크 루틴', 'My 5-minute desk routine')}
            </div>
            <div class="body">{L(auto.subtitle)}</div>
          </div>
          <ChevronRight size={22} />
        </div>
      </button>
      <div class="grid-2" style={{ marginTop: 12 }}>
        {DESK_PRESETS.map((p) => {
          const r = deskRoutine(p);
          return (
            <button
              key={p.id}
              class="card tap tight"
              style={{ textAlign: 'left' }}
              onClick={() => {
                activeRoutine.value = r;
                nav(`/routine/desk?preset=${p.id}`);
              }}
            >
              <div style={{ fontSize: 30 }}>{p.emoji}</div>
              <div class="h3" style={{ marginTop: 6 }}>
                {L(p.title)}
              </div>
              <div class="caption" style={{ marginTop: 2 }}>
                {L(p.desc)}
              </div>
              <div class="badge" style={{ marginTop: 8 }}>
                {L(r.subtitle).split(' · ')[0]}
              </div>
            </button>
          );
        })}
      </div>

      <div class="section-title">
        <h2 class="h2">
          <Bell size={18} /> {tr('자세 리셋 알림', 'Reset reminders')}
        </h2>
      </div>
      <div class="card stack">
        <div class="row between">
          <div>
            <div class="h3">{tr('근무 시간에 알려 주기', 'Remind me during work hours')}</div>
            <div class="caption">{tr('월~금, 정해진 간격마다', 'Mon–Fri at your chosen interval')}</div>
          </div>
          <Toggle on={s.deskBreak.enabled} onChange={(v) => setDesk({ enabled: v })} label={tr('자세 리셋 알림', 'Reset reminders')} />
        </div>
        {s.deskBreak.enabled && (
          <>
            <Seg
              value={s.deskBreak.everyMin}
              onChange={(v) => setDesk({ everyMin: v })}
              options={[
                { value: 30, label: tr('30분', '30 min') },
                { value: 50, label: tr('50분', '50 min') },
                { value: 60, label: tr('1시간', '1 h') },
                { value: 90, label: tr('1시간 반', '90 min') },
              ]}
            />
            <div class="row" style={{ gap: 10 }}>
              <label class="field grow">
                <span class="caption">{tr('시작', 'From')}</span>
                <input class="input" style={{ height: 46, fontSize: 16 }} type="time" value={s.deskBreak.from} onChange={(e) => setDesk({ from: (e.target as HTMLInputElement).value })} />
              </label>
              <label class="field grow">
                <span class="caption">{tr('끝', 'To')}</span>
                <input class="input" style={{ height: 46, fontSize: 16 }} type="time" value={s.deskBreak.to} onChange={(e) => setDesk({ to: (e.target as HTMLInputElement).value })} />
              </label>
            </div>
          </>
        )}
        {!isNative() && (
          <Notice kind="info">
            {tr('웹 버전에서는 앱 화면을 열어 둔 동안만 알려 드려요. 앱으로 설치하면 잠금 화면에서도 알림이 와요.', 'In the web version reminders only work while the app is open. The installed app can notify you on the lock screen.')}
          </Notice>
        )}
      </div>
    </div>
  );
}
