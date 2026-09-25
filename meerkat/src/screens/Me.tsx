import { useRef, useState } from 'preact/hooks';
import { ChevronRight, Download, Info, Shield, Trash2, Upload } from 'lucide-preact';
import { Meerkat } from '../components/animals';
import { ask, Chip, Seg, Sheet, Toggle, toast, TopBar } from '../components/ui';
import { EQUIPMENT_LABEL } from '../content/exercises';
import { L, lang, setLang, tr } from '../i18n';
import { idb } from '../lib/idb';
import { applyReminders } from '../lib/notify';
import { allKeys } from '../lib/persist';
import { isNative } from '../lib/platform';
import { nav } from '../lib/router';
import { download } from '../lib/share';
import { speak } from '../lib/voice';
import { age, profile, progression, scans, sessions, settings, type Equipment } from '../state/store';

const EQUIP: Equipment[] = ['wall', 'chair', 'towel', 'mat', 'foamRoller', 'band', 'ball'];

function Row({ title, sub, right, onClick }: { title: string; sub?: string; right?: any; onClick?: () => void }) {
  const inner = (
    <>
      <div class="grow">
        <div class="h3" style={{ fontWeight: 600 }}>
          {title}
        </div>
        {sub && <div class="caption">{sub}</div>}
      </div>
      {right ?? (onClick ? <ChevronRight size={18} class="chev" /> : null)}
    </>
  );
  return onClick ? (
    <button class="list-item" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div class="list-item">{inner}</div>
  );
}

export function Me() {
  const s = settings.value;
  const p = profile.value;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ nickname: p.nickname, birthYear: p.birthYear ?? '', heightCm: p.heightCm ?? '' });
  const importRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof s>) => (settings.value = { ...s, ...patch });

  const setReminder = async (patch: Partial<typeof s.reminder>) => {
    const next = { ...s, reminder: { ...s.reminder, ...patch } };
    settings.value = next;
    const r = await applyReminders(next).catch(() => 'web' as const);
    if (r === 'denied') toast(tr('알림 권한이 꺼져 있어요', 'Notifications are blocked'));
    if (r === 'web' && patch.enabled) toast(tr('웹에서는 앱을 열어 둔 동안만 알려 드려요', 'On the web, reminders work while the app is open'));
  };

  const exportData = () => {
    const data: Record<string, unknown> = {};
    for (const k of allKeys()) data[k] = JSON.parse(localStorage.getItem(k) ?? 'null');
    const blob = new Blob([JSON.stringify({ app: 'meerkat', version: 1, at: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
    download(blob, `meerkat-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };
  const importData = async (f: File | undefined) => {
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (json.app !== 'meerkat' || !json.data) throw new Error('bad file');
      if (!(await ask(tr('현재 기록을 백업 파일로 바꿀까요?', 'Replace current data with this backup?'), { ok: tr('불러오기', 'Restore') }))) return;
      for (const [k, v] of Object.entries(json.data)) if (k.startsWith('mk.')) localStorage.setItem(k, JSON.stringify(v));
      location.reload();
    } catch {
      toast(tr('백업 파일을 읽지 못했어요', 'Couldn’t read the backup file'));
    }
  };
  const wipe = async () => {
    if (!(await ask(tr('모든 기록(스캔·사진·운동)을 삭제할까요? 되돌릴 수 없어요.', 'Delete all data (scans, photos, workouts)? This can’t be undone.'), { ok: tr('모두 삭제', 'Delete all'), danger: true }))) return;
    for (const k of allKeys()) localStorage.removeItem(k);
    await idb.clear().catch(() => undefined);
    location.hash = '#/';
    location.reload();
  };
  const saveProfile = () => {
    const by = +draft.birthYear, h = +draft.heightCm;
    profile.value = { ...p, nickname: String(draft.nickname).slice(0, 12), birthYear: by > 1900 && by < 2030 ? by : null, heightCm: h >= 120 && h <= 220 ? h : null };
    setEditing(false);
  };

  return (
    <div class="screen with-tabbar">
      <TopBar plain title={tr('마이', 'Me')} />
      <button class="card tap row" style={{ width: '100%', textAlign: 'left', gap: 14 }} onClick={() => setEditing(true)}>
        <span class="thumb" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--brand-soft)' }}>
          <Meerkat size={52} />
        </span>
        <div class="grow">
          <div class="h2">{p.nickname || tr('미어캣 회원', 'Meerkat member')}</div>
          <div class="caption">
            {[age.value !== null ? tr(`${age.value}세`, `${age.value} y`) : null, p.heightCm ? `${p.heightCm}cm` : null, tr(`레벨 ${progression.value.level}`, `Level ${progression.value.level}`)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <ChevronRight size={18} class="chev" />
      </button>

      <div class="section-title">
        <h2 class="h2">{tr('운동 설정', 'Workout')}</h2>
      </div>
      <div class="card-list">
        <div class="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div class="h3" style={{ fontWeight: 600 }}>
            {tr('하루 루틴 시간', 'Daily routine length')}
          </div>
          <Seg
            value={s.sessionMinutes}
            onChange={(v) => set({ sessionMinutes: v })}
            options={[
              { value: 5, label: tr('5분', '5 min') },
              { value: 10, label: tr('10분', '10 min') },
              { value: 15, label: tr('15분', '15 min') },
            ]}
          />
        </div>
        <div class="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div class="h3" style={{ fontWeight: 600 }}>
            {tr('가지고 있는 도구', 'Equipment I have')}
          </div>
          <div class="chips">
            {EQUIP.map((q) => (
              <Chip key={q} on={s.equipment.includes(q)} onClick={() => set({ equipment: s.equipment.includes(q) ? s.equipment.filter((x) => x !== q) : [...s.equipment, q] })}>
                {L(EQUIPMENT_LABEL[q])}
              </Chip>
            ))}
          </div>
        </div>
        <Row title={tr('AI 카메라 코치', 'AI camera coach')} sub={tr('일부 동작에서 횟수·자세를 카메라로 확인', 'Counts reps and checks form on supported moves')} right={<Toggle on={s.coachCamera} onChange={(v) => set({ coachCamera: v })} />} />
        <Row title={tr('안전 체크 다시 하기', 'Redo safety check')} onClick={() => nav('/safety?next=/me')} />
        <Row title={tr('통증 체크', 'Pain check')} onClick={() => nav('/pain')} />
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('알림', 'Reminders')}</h2>
      </div>
      <div class="card-list">
        <Row title={tr('매일 운동 알림', 'Daily workout reminder')} sub={s.reminder.enabled ? s.reminder.time : undefined} right={<Toggle on={s.reminder.enabled} onChange={(v) => setReminder({ enabled: v })} />} />
        {s.reminder.enabled && (
          <div class="list-item">
            <input class="input" type="time" style={{ height: 46 }} value={s.reminder.time} onChange={(e) => setReminder({ time: (e.target as HTMLInputElement).value })} />
          </div>
        )}
        <Row title={tr('근무 중 자세 리셋 알림', 'Desk reset reminders')} sub={s.deskBreak.enabled ? tr(`${s.deskBreak.everyMin}분마다`, `Every ${s.deskBreak.everyMin} min`) : tr('꺼짐', 'Off')} onClick={() => nav('/desk')} />
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('소리 · 화면', 'Sound & display')}</h2>
      </div>
      <div class="card-list">
        <Row title={tr('음성 안내', 'Voice guidance')} right={<Toggle on={s.voice} onChange={(v) => set({ voice: v })} />} />
        {s.voice && (
          <div class="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div class="row between">
              <span class="caption">{tr('말하기 속도', 'Speed')}</span>
              <button class="link-btn" onClick={() => speak(tr('턱을 당기고, 어깨는 아래로', 'Chin in, shoulders down'), { interrupt: true })}>
                {tr('들어 보기', 'Preview')}
              </button>
            </div>
            <input class="slider" type="range" min={0.7} max={1.4} step={0.05} value={s.voiceRate} onInput={(e) => set({ voiceRate: +(e.target as HTMLInputElement).value })} />
          </div>
        )}
        <Row title={tr('효과음', 'Sound effects')} right={<Toggle on={s.sound} onChange={(v) => set({ sound: v })} />} />
        <Row title={tr('진동', 'Haptics')} right={<Toggle on={s.haptics} onChange={(v) => set({ haptics: v })} />} />
        <div class="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div class="h3" style={{ fontWeight: 600 }}>
            {tr('테마', 'Theme')}
          </div>
          <Seg
            value={s.theme}
            onChange={(v) => set({ theme: v })}
            options={[
              { value: 'system', label: tr('자동', 'Auto') },
              { value: 'light', label: tr('밝게', 'Light') },
              { value: 'dark', label: tr('어둡게', 'Dark') },
            ]}
          />
        </div>
        <div class="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div class="h3" style={{ fontWeight: 600 }}>
            {tr('언어', 'Language')}
          </div>
          <Seg
            value={lang.value}
            onChange={(v) => setLang(v)}
            options={[
              { value: 'ko', label: '한국어' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('전문가 모드', 'Pro mode')}</h2>
      </div>
      <div class="card-list">
        <Row title={tr('전문가 모드', 'Pro mode')} sub={tr('리포트에 원시 측정값 표시, 센터·회원 이름 기록', 'Show raw values; label scans with client & clinic names')} right={<Toggle on={s.expert.enabled} onChange={(v) => set({ expert: { ...s.expert, enabled: v } })} />} />
        {s.expert.enabled && (
          <div class="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <input class="input" style={{ height: 46, fontSize: 16 }} placeholder={tr('센터 이름 (리포트 표시)', 'Clinic name (shown on reports)')} value={s.expert.center} onInput={(e) => set({ expert: { ...s.expert, center: (e.target as HTMLInputElement).value } })} />
            <input class="input" style={{ height: 46, fontSize: 16 }} placeholder={tr('담당자 이름', 'Therapist name')} value={s.expert.name} onInput={(e) => set({ expert: { ...s.expert, name: (e.target as HTMLInputElement).value } })} />
          </div>
        )}
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('데이터', 'Data')}</h2>
      </div>
      <div class="card-list">
        <Row title={tr('기록 백업하기', 'Back up data')} sub={tr(`스캔 ${scans.value.length}회 · 운동 ${sessions.value.length}회 (사진 제외)`, `${scans.value.length} scans · ${sessions.value.length} workouts (no photos)`)} right={<Download size={18} />} onClick={exportData} />
        <Row title={tr('백업 불러오기', 'Restore backup')} right={<Upload size={18} />} onClick={() => importRef.current?.click()} />
        <button class="list-item" style={{ color: 'var(--severe)' }} onClick={wipe}>
          <Trash2 size={18} />
          <span class="grow h3" style={{ fontWeight: 600, color: 'var(--severe)' }}>
            {tr('모든 데이터 삭제', 'Delete all data')}
          </span>
        </button>
      </div>
      <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => importData((e.target as HTMLInputElement).files?.[0])} />

      <div class="section-title">
        <h2 class="h2">{tr('정보', 'About')}</h2>
      </div>
      <div class="card-list">
        <Row title={tr('미어캣 소개 · 설계한 사람', 'About Meerkat & its designer')} right={<Info size={18} />} onClick={() => nav('/about')} />
        <Row title={tr('개인정보 보호', 'Privacy')} sub={tr('모든 사진과 기록은 이 기기에만 저장돼요', 'All photos and data stay on this device')} right={<Shield size={18} />} onClick={() => nav('/about#privacy')} />
        <Row title={tr('버전', 'Version')} right={<span class="caption">0.1.0 {isNative() ? '' : '(web)'}</span>} />
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} label={tr('프로필', 'Profile')}>
        <h2 class="h2">{tr('프로필 수정', 'Edit profile')}</h2>
        <div class="stack" style={{ marginTop: 14 }}>
          <label class="field">
            <span>{tr('닉네임', 'Nickname')}</span>
            <input class="input" value={draft.nickname} maxLength={12} onInput={(e) => setDraft({ ...draft, nickname: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field">
            <span>{tr('태어난 해', 'Birth year')}</span>
            <input class="input" type="number" inputMode="numeric" value={draft.birthYear} onInput={(e) => setDraft({ ...draft, birthYear: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field">
            <span>{tr('키 (cm)', 'Height (cm)')}</span>
            <input class="input" type="number" inputMode="numeric" value={draft.heightCm} onInput={(e) => setDraft({ ...draft, heightCm: (e.target as HTMLInputElement).value })} />
          </label>
          <button class="btn primary block" onClick={saveProfile}>
            {tr('저장', 'Save')}
          </button>
          <button class="btn ghost block" onClick={() => nav('/onboarding')}>
            {tr('목표·생활 습관 다시 설정', 'Redo goals & lifestyle')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
