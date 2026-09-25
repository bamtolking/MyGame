import { useState } from 'preact/hooks';
import { Trash2 } from 'lucide-preact';
import { BodyMap, PAIN_NAMES } from '../components/BodyMap';
import { Notice, Seg, Sheet, toast, TopBar } from '../components/ui';
import type { Region } from '../content/exercises';
import { L, tr } from '../i18n';
import { back, nav } from '../lib/router';
import { activeRoutine, focusRoutine } from '../state/derived';
import { painLogs, profile, type PainArea } from '../state/store';

const AREA_REGION: Record<PainArea, Region> = {
  head: 'neck',
  neck: 'neck',
  shoulderL: 'shoulder',
  shoulderR: 'shoulder',
  upperBack: 'upperBack',
  lowBack: 'lowBack',
  hipL: 'hip',
  hipR: 'hip',
  kneeL: 'knee',
  kneeR: 'knee',
  wristL: 'wrist',
  wristR: 'wrist',
  elbowL: 'wrist',
  elbowR: 'wrist',
  ankleL: 'ankle',
  ankleR: 'ankle',
};

const NRS_WORDS = (v: number) =>
  v === 0 ? tr('통증 없음', 'No pain') : v <= 3 ? tr('가벼운 통증', 'Mild') : v <= 6 ? tr('신경 쓰이는 통증', 'Moderate') : tr('심한 통증', 'Severe');

export function PainCheck() {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [vals, setVals] = useState<Partial<Record<PainArea, number>>>({ ...profile.value.pain });
  const [edit, setEdit] = useState<PainArea | null>(null);
  const entries = Object.entries(vals) as [PainArea, number][];
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0);

  const save = (andRoutine = false) => {
    profile.value = { ...profile.value, pain: vals };
    painLogs.value = [...painLogs.value, { at: Date.now(), entries: vals }];
    toast(tr('통증 기록을 저장했어요. 루틴에 반영할게요', 'Saved — your routine will adapt'));
    if (andRoutine && entries.length) {
      const regions = [...new Set(entries.map(([a]) => AREA_REGION[a]))];
      activeRoutine.value = focusRoutine(regions);
      nav(`/routine/focus?regions=${regions.join(',')}`);
    } else back('/');
  };

  return (
    <div class="screen">
      <TopBar title={tr('통증 체크', 'Pain check')} />
      <p class="body" style={{ marginTop: 4 }}>
        {tr('아픈 곳을 누르고 강도(0~10)를 골라 주세요. 강도에 맞춰 무리한 동작은 빼고 루틴을 조절해요.', 'Tap where it hurts and set the intensity (0–10). Your routine will drop anything that could aggravate it.')}
      </p>
      <div style={{ margin: '14px 0' }}>
        <Seg
          value={side}
          onChange={setSide}
          options={[
            { value: 'front', label: tr('앞모습', 'Front') },
            { value: 'back', label: tr('뒷모습', 'Back') },
          ]}
        />
      </div>
      <div class="card">
        <BodyMap side={side} values={vals} onPick={setEdit} />
      </div>
      {entries.length > 0 && (
        <div class="card-list" style={{ marginTop: 14 }}>
          {entries.map(([a, v]) => (
            <button key={a} class="list-item" onClick={() => setEdit(a)}>
              <div class="grow">
                <div class="h3">{L(PAIN_NAMES[a])}</div>
                <div class="caption">{NRS_WORDS(v)}</div>
              </div>
              <span class="num" style={{ fontWeight: 900, fontSize: 22, color: v >= 7 ? 'var(--severe)' : v >= 4 ? 'var(--moderate)' : 'var(--mild)' }}>
                {v}
              </span>
            </button>
          ))}
        </div>
      )}
      {max >= 7 && (
        <Notice kind="danger" style={{ marginTop: 14 }}>
          {tr('통증이 심해요. 해당 부위에 부담 주는 동작은 빼고 가볍게만 처방할게요. 3일 넘게 계속되거나 저림·힘 빠짐이 있으면 꼭 진료를 받아 주세요.', 'That’s severe. We’ll remove moves that load this area and keep things light. If it lasts more than 3 days or comes with numbness or weakness, please see a clinician.')}
        </Notice>
      )}
      {max >= 4 && max < 7 && (
        <Notice kind="warn" style={{ marginTop: 14 }}>
          {tr('통증이 느껴지지 않는 범위에서만 움직여 주세요. 운동 중 통증이 2점 이상 늘면 멈추는 게 좋아요.', 'Move only within a pain-free range. Stop if pain rises by 2 or more points during exercise.')}
        </Notice>
      )}
      <div class="bottom-cta">
        {entries.length > 0 && (
          <button class="btn primary block" onClick={() => save(true)}>
            {tr('통증 부위 맞춤 루틴 보기', 'See a routine for these areas')}
          </button>
        )}
        <button class={`btn ${entries.length ? 'secondary' : 'primary'} block`} onClick={() => save(false)}>
          {entries.length ? tr('저장만 하기', 'Just save') : tr('아픈 곳 없음', 'No pain today')}
        </button>
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} label={edit ? L(PAIN_NAMES[edit]) : ''}>
        {edit && (
          <>
            <h2 class="h2">{L(PAIN_NAMES[edit])}</h2>
            <div class="center" style={{ margin: '18px 0 6px' }}>
              <div class="num" style={{ fontSize: 56, fontWeight: 900 }}>
                {vals[edit] ?? 0}
              </div>
              <div class="caption">{NRS_WORDS(vals[edit] ?? 0)}</div>
            </div>
            <input class="slider" type="range" min={0} max={10} value={vals[edit] ?? 0} onInput={(e) => setVals({ ...vals, [edit]: +(e.target as HTMLInputElement).value })} aria-label={tr('통증 강도', 'Pain intensity')} />
            <div class="row between micro">
              <span>0 {tr('없음', 'none')}</span>
              <span>5</span>
              <span>10 {tr('최악', 'worst')}</span>
            </div>
            <div class="row" style={{ gap: 8, marginTop: 18 }}>
              <button
                class="btn secondary"
                onClick={() => {
                  const n = { ...vals };
                  delete n[edit];
                  setVals(n);
                  setEdit(null);
                }}
              >
                <Trash2 size={18} />
              </button>
              <button
                class="btn primary grow"
                onClick={() => {
                  if (vals[edit] === undefined || vals[edit] === 0) {
                    const n = { ...vals };
                    if (!vals[edit]) delete n[edit];
                    setVals(n);
                  }
                  setEdit(null);
                }}
              >
                {tr('확인', 'Done')}
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
