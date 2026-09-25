import { ChevronRight, Flame, Lightbulb, Play, RefreshCw, ScanLine } from 'lucide-preact';
import { Animal, Meerkat } from '../components/animals';
import { Ring, scoreColor } from '../components/ui';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { tipOfDay } from '../content/tips';
import { ANIMALS, typeName } from '../content/types';
import { L, num, tr } from '../i18n';
import { nav } from '../lib/router';
import { DESK_PRESETS, deskRoutine, hasEmergency, ISSUE_THEME } from '../routine/generator';
import { activeRoutine, program, rescanIn, shuffle, todayRoutine } from '../state/derived';
import { activeDays, dayKey, doneToday, latestScan, profile, streak } from '../state/store';

function greeting(): string {
  const h = new Date().getHours();
  const name = profile.value.nickname;
  const who = name ? tr(`${name}님`, name) : '';
  if (h < 11) return tr(`좋은 아침이에요${who ? ', ' + who : ''}`, `Good morning${who ? ', ' + who : ''}`);
  if (h < 17) return tr(`오늘도 바른 자세${who ? ', ' + who : ''}`, `Stand tall today${who ? ', ' + who : ''}`);
  return tr(`오늘 하루 수고했어요${who ? ', ' + who : ''}`, `Great work today${who ? ', ' + who : ''}`);
}

function WeekStrip() {
  const days = activeDays.value;
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const labels = tr('월,화,수,목,금,토,일', 'M,T,W,T,F,S,S').split(',');
  return (
    <div class="row between" style={{ gap: 6 }}>
      {labels.map((l, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const k = dayKey(d);
        const done = days.has(k);
        const isToday = k === dayKey(now);
        return (
          <div key={i} class="center" style={{ flex: 1 }}>
            <div class="micro" style={{ fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--text)' : undefined }}>
              {l}
            </div>
            <div
              style={{
                margin: '6px auto 0',
                width: 30,
                height: 30,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                background: done ? 'var(--brand)' : isToday ? 'var(--brand-soft)' : 'var(--surface-3)',
                color: done ? '#fff' : 'var(--text-3)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {done ? '✓' : d.getDate()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScanCard() {
  const s = latestScan.value;
  if (!s) {
    return (
      <button class="card brand tap" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', padding: 22 }} onClick={() => nav('/scan/capture')}>
        <div style={{ position: 'absolute', right: -14, bottom: -18, opacity: 0.95 }}>
          <Meerkat size={150} />
        </div>
        <div style={{ maxWidth: '62%' }}>
          <span class="badge" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>
            <ScanLine size={14} /> AI
          </span>
          <h2 class="h1" style={{ color: '#fff', marginTop: 10, fontSize: 22 }}>
            {tr('30초 AI 체형 분석', '30-second AI posture scan')}
          </h2>
          <p class="body" style={{ marginTop: 6 }}>
            {tr('정면·옆모습 두 장으로 나의 체형 동물과 자세 나이를 알아봐요', 'Two photos reveal your posture animal and posture age')}
          </p>
          <div class="row" style={{ marginTop: 14, fontWeight: 700, color: '#fff' }}>
            {tr('지금 측정하기', 'Scan now')} <ChevronRight size={18} />
          </div>
        </div>
      </button>
    );
  }
  const r = s.report;
  const a = ANIMALS[r.type.primary];
  const p = program.value;
  return (
    <button class="card tap" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav(`/scan/result/${s.id}`)}>
      <div class="row" style={{ gap: 14, alignItems: 'center' }}>
        <div style={{ background: a.soft, borderRadius: 20, flex: 'none' }}>
          <Animal id={r.type.primary} size={84} />
        </div>
        <div class="grow">
          <div class="caption">{tr('나의 체형 유형', 'My posture type')}</div>
          <div class="h2" style={{ marginTop: 2 }}>
            {L(typeName(r.type.primary, r.type.secondary))}
          </div>
          <div class="caption" style={{ marginTop: 4 }}>
            {r.postureAge !== null ? tr(`자세 나이 ${r.postureAge}세`, `Posture age ${r.postureAge}`) + ' · ' : ''}
            {new Date(s.at).toLocaleDateString(tr('ko-KR', 'en-US'), { month: 'short', day: 'numeric' })}
          </div>
        </div>
        <Ring value={r.score} size={72} stroke={8} color={scoreColor(r.score)}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }} class="num">
              {r.score}
            </div>
            <div class="micro">{tr('점', 'pts')}</div>
          </div>
        </Ring>
      </div>
      <div class="divider" style={{ margin: '14px 0 12px' }} />
      <div class="row between">
        <div class="caption">
          <span class="strong">{tr(`${a.short.ko} 탈출 4주`, `${a.short.en} program`)}</span> · {tr(`${p.week}주차 ${p.day}/28일`, `Week ${p.week} · day ${p.day}/28`)}
        </div>
        <span class={`badge ${rescanIn.value === 0 ? 'brand' : ''}`}>{rescanIn.value === 0 ? tr('재측정 추천', 'Rescan now') : tr(`재측정 D-${rescanIn.value}`, `Rescan in ${rescanIn.value}d`)}</span>
      </div>
    </button>
  );
}

function RoutineCard() {
  const r = todayRoutine.value;
  const done = doneToday.value;
  const emergency = hasEmergency(profile.value);
  const start = () => {
    if (!profile.value.safetyCheckedAt) {
      nav('/safety?next=/routine/today');
      return;
    }
    activeRoutine.value = r;
    nav('/routine/today');
  };
  return (
    <div class="card">
      <div class="row between">
        <div>
          <div class="caption">{done ? tr('오늘 운동 완료! 🎉', 'Done for today! 🎉') : tr('오늘의 맞춤 루틴', 'Today’s routine')}</div>
          <div class="h2" style={{ marginTop: 2 }}>
            {L(r.title)}
          </div>
          <div class="caption" style={{ marginTop: 2 }}>
            {L(r.subtitle)}
          </div>
        </div>
        <button class="icon-btn" aria-label={tr('다른 조합', 'Shuffle')} onClick={() => (shuffle.value += 1)}>
          <RefreshCw size={20} />
        </button>
      </div>
      <div class="row" style={{ gap: 8, marginTop: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {r.items.map((it, i) => (
          <ExerciseThumb key={it.exercise.id + i} ex={it.exercise} size={64} />
        ))}
      </div>
      {r.focus.length > 0 && (
        <div class="chips" style={{ marginTop: 12 }}>
          {r.focus.map((f) => (
            <span key={f} class="badge brand">
              #{L(ISSUE_THEME[f] ?? { ko: f, en: f })}
            </span>
          ))}
        </div>
      )}
      {emergency ? (
        <p class="caption" style={{ marginTop: 14, color: 'var(--severe)' }}>
          {tr('안전 체크에서 즉시 진료가 필요한 증상이 확인됐어요. 운동 전 의료진과 상담해 주세요.', 'Your safety check flagged symptoms that need medical attention first. Please see a clinician before exercising.')}
        </p>
      ) : (
        <button class={`btn ${done ? 'secondary' : 'primary'} block`} style={{ marginTop: 16 }} onClick={start}>
          <Play size={18} fill="currentColor" /> {done ? tr('한 번 더 하기', 'Go again') : tr('시작하기', 'Start')}
        </button>
      )}
    </div>
  );
}

export function Home() {
  const tip = tipOfDay();
  return (
    <div class="screen with-tabbar">
      <header class="row between" style={{ padding: '14px 2px 16px' }}>
        <div>
          <div class="caption">{new Date().toLocaleDateString(tr('ko-KR', 'en-US'), { month: 'long', day: 'numeric', weekday: 'long' })}</div>
          <h1 class="h1" style={{ marginTop: 2, fontSize: 22 }}>
            {greeting()}
          </h1>
        </div>
        <button class="badge brand" style={{ height: 34, padding: '0 12px', fontSize: 14, borderRadius: 12 }} onClick={() => nav('/progress')} aria-label={tr('연속 운동 일수', 'Streak')}>
          <Flame size={16} fill="currentColor" /> <span class="num">{num(streak.value)}</span>
          {tr('일', 'd')}
        </button>
      </header>

      <div class="stack">
        <ScanCard />
        <RoutineCard />
        <div class="card tight">
          <WeekStrip />
        </div>
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('1분 리셋', 'One-minute resets')}</h2>
        <button class="link-btn" onClick={() => nav('/desk')}>
          {tr('전체', 'All')}
        </button>
      </div>
      <div class="row" style={{ gap: 10, overflowX: 'auto', margin: '0 -20px', padding: '0 20px 4px' }}>
        {DESK_PRESETS.map((p) => (
          <button
            key={p.id}
            class="card tap tight"
            style={{ minWidth: 132, textAlign: 'left' }}
            onClick={() => {
              activeRoutine.value = deskRoutine(p);
              nav(`/routine/desk?preset=${p.id}`);
            }}
          >
            <div style={{ fontSize: 28 }}>{p.emoji}</div>
            <div class="h3" style={{ marginTop: 6 }}>
              {L(p.title)}
            </div>
            <div class="caption" style={{ marginTop: 2 }}>
              {L(deskRoutine(p).subtitle).split(' · ')[0]}
            </div>
          </button>
        ))}
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('통증 체크', 'Pain check')}</h2>
      </div>
      <button class="card tap row" style={{ width: '100%', textAlign: 'left', gap: 14 }} onClick={() => nav('/pain')}>
        <span class="thumb" style={{ background: 'var(--severe-soft)', fontSize: 22 }}>🩹</span>
        <div class="grow">
          <div class="h3">{Object.keys(profile.value.pain).length ? tr('오늘 통증은 어떤가요?', 'How’s your pain today?') : tr('불편한 곳이 있나요?', 'Anything hurting?')}</div>
          <div class="caption">{tr('부위와 강도를 기록하면 루틴이 알아서 조절돼요', 'Log it and your routine adapts automatically')}</div>
        </div>
        <ChevronRight size={20} class="chev" />
      </button>

      <div class="notice brand" style={{ marginTop: 16 }}>
        <span class="ic" style={{ color: 'var(--brand)' }}>
          <Lightbulb size={18} />
        </span>
        <div>
          <div class="strong" style={{ fontSize: 14 }}>
            {tr('물리치료사의 한마디', 'Physio tip')}
          </div>
          <div style={{ marginTop: 2 }}>{L(tip)}</div>
        </div>
      </div>
    </div>
  );
}
