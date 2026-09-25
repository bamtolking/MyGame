import { ArrowLeftRight, ChevronRight, Flame } from 'lucide-preact';
import { Animal } from '../components/animals';
import { LineChart } from '../components/LineChart';
import { TopBar } from '../components/ui';
import { typeName } from '../content/types';
import { L, num, tr } from '../i18n';
import { nav } from '../lib/router';
import { dayKey, painLogs, scans, sessions, streak, totalMinutes } from '../state/store';

function Heatmap() {
  const byDay = new Map<string, number>();
  for (const s of sessions.value) {
    const k = dayKey(s.at);
    byDay.set(k, (byDay.get(k) ?? 0) + s.durationSec / 60);
  }
  const weeks = 6;
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
  const cells: { k: string; m: number; future: boolean; d: Date }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = dayKey(d);
    cells.push({ k, m: byDay.get(k) ?? 0, future: d > today, d });
  }
  const shade = (m: number) => (m <= 0 ? 'var(--surface-3)' : m < 5 ? 'color-mix(in srgb, var(--brand) 40%, var(--surface))' : m < 12 ? 'color-mix(in srgb, var(--brand) 70%, var(--surface))' : 'var(--brand)');
  const labels = tr('월,화,수,목,금,토,일', 'M,T,W,T,F,S,S').split(',');
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {labels.map((l, i) => (
          <div key={i} class="micro center">
            {l}
          </div>
        ))}
        {cells.map((c) => (
          <div
            key={c.k}
            title={`${c.k} · ${Math.round(c.m)}${tr('분', ' min')}`}
            style={{ aspectRatio: '1', borderRadius: 7, background: c.future ? 'transparent' : shade(c.m), border: c.k === dayKey(today) ? '2px solid var(--text)' : undefined }}
          />
        ))}
      </div>
      <div class="row micro" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
        {tr('적게', 'Less')}
        {[0, 3, 8, 15].map((m) => (
          <span key={m} style={{ width: 12, height: 12, borderRadius: 3, background: shade(m) }} />
        ))}
        {tr('많이', 'More')}
      </div>
    </div>
  );
}

export function Progress() {
  const sc = scans.value;
  const ss = [...sessions.value].reverse();
  const pl = painLogs.value.filter((p) => Object.keys(p.entries).length);
  const date = (t: number) => new Date(t).toLocaleDateString(tr('ko-KR', 'en-US'), { month: 'numeric', day: 'numeric' });
  const feelEmoji = { easy: '😌', ok: '🙂', hard: '😮‍💨' } as const;
  return (
    <div class="screen with-tabbar">
      <TopBar plain title={tr('기록', 'Progress')} />
      <div class="grid-3">
        {[
          [
            <span class="row" style={{ gap: 4, justifyContent: 'center' }}>
              <Flame size={20} color="var(--brand)" fill="var(--brand)" />
              {num(streak.value)}
            </span>,
            tr('연속 일수', 'Day streak'),
          ],
          [num(sessions.value.length), tr('운동 횟수', 'Workouts')],
          [num(totalMinutes.value), tr('총 운동(분)', 'Minutes')],
        ].map(([v, l], i) => (
          <div key={i} class="card tight center">
            <div style={{ fontSize: 26, fontWeight: 800 }}>{v}</div>
            <div class="caption">{l}</div>
          </div>
        ))}
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('운동 달력', 'Activity')}</h2>
      </div>
      <div class="card">
        <Heatmap />
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('자세 점수 변화', 'Posture score')}</h2>
        {sc.length >= 2 && (
          <button class="link-btn row" style={{ gap: 4 }} onClick={() => nav('/scan/compare')}>
            <ArrowLeftRight size={15} /> {tr('전후 비교', 'Compare')}
          </button>
        )}
      </div>
      <div class="card">
        {sc.length ? (
          <>
            <LineChart
              label={tr('자세 점수 추이', 'Posture score over time')}
              points={sc.map((s) => ({ t: s.at, v: s.report.score }))}
              domain={[20, 100]}
              ticks={[40, 60, 80, 100]}
              formatDate={date}
            />
            {sc.length === 1 && <p class="caption" style={{ marginTop: 8 }}>{tr('일주일 뒤 다시 스캔하면 변화가 그래프로 보여요.', 'Scan again in a week to see your trend.')}</p>}
          </>
        ) : (
          <div class="center">
            <p class="body">{tr('아직 스캔 기록이 없어요.', 'No scans yet.')}</p>
            <button class="btn primary" style={{ marginTop: 12 }} onClick={() => nav('/scan/capture')}>
              {tr('첫 스캔 하기', 'Do your first scan')}
            </button>
          </div>
        )}
      </div>
      {sc.length > 0 && (
        <div class="card-list" style={{ marginTop: 12 }}>
          {[...sc].reverse().slice(0, 5).map((s) => (
            <button key={s.id} class="list-item" onClick={() => nav(`/scan/result/${s.id}`)}>
              <span class="thumb">
                <Animal id={s.report.type.primary} size={42} />
              </span>
              <div class="grow">
                <div class="h3">{L(typeName(s.report.type.primary, s.report.type.secondary))}</div>
                <div class="caption">{date(s.at)}</div>
              </div>
              <span style={{ fontWeight: 800 }}>
                {s.report.score}
                {tr('점', '')}
              </span>
              <ChevronRight size={18} class="chev" />
            </button>
          ))}
        </div>
      )}

      {pl.length > 0 && (
        <>
          <div class="section-title">
            <h2 class="h2">{tr('통증 변화 (가장 아픈 곳 기준)', 'Pain (worst area)')}</h2>
          </div>
          <div class="card">
            <LineChart
              label={tr('통증 추이', 'Pain over time')}
              points={pl.map((p) => ({ t: p.at, v: Math.max(0, ...Object.values(p.entries).map((x) => x ?? 0)) }))}
              domain={[0, 10]}
              ticks={[0, 5, 10]}
              color="var(--severe)"
              formatDate={date}
            />
          </div>
        </>
      )}

      <div class="section-title">
        <h2 class="h2">{tr('최근 운동', 'Recent workouts')}</h2>
      </div>
      {ss.length ? (
        <div class="card-list">
          {ss.slice(0, 12).map((s) => (
            <div key={s.id} class="list-item">
              <span class="thumb" style={{ fontSize: 20 }}>
                {s.feel ? feelEmoji[s.feel] : '💪'}
              </span>
              <div class="grow">
                <div class="h3">{s.title}</div>
                <div class="caption">
                  {new Date(s.at).toLocaleString(tr('ko-KR', 'en-US'), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {Math.max(1, Math.round(s.durationSec / 60))}
                  {tr('분', ' min')} · {s.exercises.filter((e) => e.done).length}
                  {tr('개 동작', ' moves')}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div class="card center caption">{tr('첫 운동을 시작해 보세요!', 'Start your first workout!')}</div>
      )}
    </div>
  );
}
