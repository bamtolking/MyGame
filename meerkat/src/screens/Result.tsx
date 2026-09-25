import { useEffect, useMemo, useState } from 'preact/hooks';
import { ChevronDown, ChevronUp, EyeOff, Eye, Play, Share2, Trash2, Info } from 'lucide-preact';
import type { MetricResult } from '../analysis/analyze';
import { NORMS, type MetricId } from '../analysis/norms';
import { Animal } from '../components/animals';
import { ask, LevelBadge, LEVEL_COLORS, levelLabel, Notice, Ring, scoreColor, toast, TopBar } from '../components/ui';
import { DEMO_SCAN } from '../content/demo';
import { ScanPhoto } from '../components/ScanPhoto';
import { describeMetric, METRIC_INFO, metricValue } from '../content/metrics';
import { ANIMALS, typeTitle, typeName } from '../content/types';
import type { AnimalId } from '../analysis/report';
import { L, num, tr } from '../i18n';
import { nav, replace, route } from '../lib/router';
import { haptic } from '../lib/haptics';
import { sfx } from '../lib/sound';
import { speak } from '../lib/voice';
import { ISSUE_THEME, topIssues } from '../routine/generator';
import { deletePhotos } from '../scan/pipeline';
import { activeRoutine, todayRoutine } from '../state/derived';
import { profile, removeScan, scans, settings, type ScanRecord } from '../state/store';

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.8 + Math.random() * 1.4,
        color: ['#ff6b2c', '#ffc53d', '#12b76a', '#3182f6', '#ff5a8c'][i % 5],
      })),
    [],
  );
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {pieces.map((p, i) => (
        <i key={i} class="confetti" style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

function CountUp({ to, ms = 1200 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}

const SLOT: AnimalId[] = ['turtle', 'shrimp', 'duck', 'flamingo', 'meerkat'];

function scoreWord(score: number): string {
  if (score >= 85) return tr('아주 좋아요', 'Excellent');
  if (score >= 70) return tr('양호해요', 'Good');
  if (score >= 55) return tr('관리가 필요해요', 'Needs care');
  if (score >= 40) return tr('교정이 필요해요', 'Needs work');
  return tr('집중 관리 필요', 'Needs focus');
}

/** 결과 공개: 동물 실루엣 슬롯 → 내 유형 등장, 점수·자세 나이·주요 소견 */
function Reveal({ scan, onClose }: { scan: ScanRecord; onClose: () => void }) {
  const [phase, setPhase] = useState(0);
  const [slot, setSlot] = useState(0);
  const r = scan.report;
  const a = ANIMALS[r.type.primary];
  const good = r.score >= 75;
  const findings = (Object.values(r.metrics) as MetricResult[])
    .filter((m) => m && m.level > 0)
    .sort((x, y) => y.badness - x.badness)
    .slice(0, 3);
  useEffect(() => {
    let k = 0;
    const iv = setInterval(() => {
      k += 1;
      setSlot(k % SLOT.length);
    }, 110);
    const t1 = setTimeout(() => {
      clearInterval(iv);
      setPhase(1);
      sfx.done();
      haptic.success();
      speak(tr(`당신의 체형은 ${L(typeName(r.type.primary, r.type.secondary))}입니다`, `Your posture type is ${L(typeName(r.type.primary, r.type.secondary))}`));
    }, 1600);
    return () => {
      clearInterval(iv);
      clearTimeout(t1);
    };
  }, []);
  const short = (id: MetricId) => L(METRIC_INFO[id].name).replace(/\s*\(.*\)\s*$/, '');
  const delta = r.ageDelta ?? 0;
  return (
    <div class="reveal" style={{ background: phase ? a.soft : 'var(--bg)' }}>
      <div class="rv-inner">
        {phase === 0 ? (
          <div class="fade-up">
            <div class="rv-slot" aria-hidden="true">
              <Animal id={SLOT[slot]} size={150} />
            </div>
            <h1 class="h1" style={{ marginTop: 22 }}>
              {tr('당신의 체형은…', 'Your posture type is…')}
            </h1>
            <p class="caption" style={{ marginTop: 6 }}>
              {tr('12가지 지표를 종합하고 있어요', 'Combining 12 posture markers')}
            </p>
          </div>
        ) : (
          <>
            {good && <Confetti />}
            <div class="caption" style={{ color: '#6b5a48' }}>
              {tr('당신의 체형은', 'Your posture type is')}
            </div>
            <div class="rv-stage">
              <div class="rv-rays" style={{ color: a.color }} />
              <div class="pop-in">
                <Animal id={r.type.primary} size={190} />
              </div>
            </div>
            <h1 class="display fade-up" style={{ color: '#1f1a15', fontSize: 30 }}>
              {L(typeName(r.type.primary, r.type.secondary))}
            </h1>
            <p class="body fade-up" style={{ color: '#4b3f33', marginTop: 6, animationDelay: '0.1s' }}>
              {L(a.tagline)}
            </p>
            <div class="rv-stats fade-up" style={{ animationDelay: '0.2s' }}>
              <div class="rv-stat">
                <div class="n num" style={{ color: scoreColor(r.score) }}>
                  <CountUp to={r.score} />
                </div>
                <div class="l">{tr('자세 점수 / 100', 'Posture score / 100')}</div>
                <span class="rv-delta" style={{ background: 'rgba(0,0,0,0.05)', color: scoreColor(r.score) }}>
                  {scoreWord(r.score)}
                </span>
              </div>
              {r.postureAge !== null && (
                <div class="rv-stat">
                  <div class="n num">
                    <CountUp to={r.postureAge} />
                    <small>{tr('세', '')}</small>
                  </div>
                  <div class="l">{tr('자세 나이', 'Posture age')}</div>
                  {delta !== 0 && (
                    <span class="rv-delta" style={{ background: delta > 0 ? 'var(--severe-soft)' : 'var(--good-soft)', color: delta > 0 ? 'var(--severe)' : 'var(--good)' }}>
                      {tr(`실제보다 ${delta > 0 ? '+' : ''}${delta}세`, `${delta > 0 ? '+' : ''}${delta} yrs vs real`)}
                    </span>
                  )}
                </div>
              )}
            </div>
            {findings.length > 0 && (
              <div class="rv-chips fade-up" style={{ animationDelay: '0.3s' }}>
                {findings.map((m) => (
                  <span key={m.id} class="rv-chip">
                    <i style={{ background: LEVEL_COLORS[m.level] }} />
                    {short(m.id)} · {levelLabel(m.level)}
                  </span>
                ))}
              </div>
            )}
            <div class="rv-actions fade-up" style={{ animationDelay: '0.4s' }}>
              <button class="btn block" style={{ background: '#1f1a15', color: '#fff' }} onClick={onClose}>
                {tr('자세한 리포트 보기', 'See full report')}
              </button>
              <button class="btn block rv-share" onClick={() => nav(`/scan/share/${scan.id}`)}>
                <Share2 size={18} /> {tr('결과 카드 공유하기', 'Share result card')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricList({ metrics, ids }: { metrics: Partial<Record<MetricId, MetricResult>>; ids: MetricId[] }) {
  const [open, setOpen] = useState<MetricId | null>(null);
  const list = ids.map((id) => metrics[id]).filter((x): x is MetricResult => !!x);
  if (!list.length) return null;
  return (
    <div class="card-list">
      {list.map((m) => {
        const info = METRIC_INFO[m.id];
        const isOpen = open === m.id;
        const frac = Math.min(1, m.badness / 1.2);
        return (
          <div key={m.id}>
            <button class="metric-row" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen}>
              <div class="grow">
                <div class="row" style={{ gap: 8 }}>
                  <span class="h3">{L(info.name)}</span>
                  {NORMS[m.id].experimental && <span class="badge">{tr('참고', 'Beta')}</span>}
                </div>
                <div class="caption" style={{ marginTop: 3, color: 'var(--text-2)' }}>
                  {describeMetric(m)}
                </div>
                <div class="metric-bar">
                  <i style={{ width: `${Math.max(6, frac * 100)}%`, background: LEVEL_COLORS[m.level] }} />
                </div>
              </div>
              <div class="center" style={{ minWidth: 64 }}>
                <div class="num" style={{ fontWeight: 800, fontSize: 17 }}>
                  {metricValue(m)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <LevelBadge level={m.level} />
                </div>
              </div>
              {isOpen ? <ChevronUp size={18} class="chev" /> : <ChevronDown size={18} class="chev" />}
            </button>
            {isOpen && (
              <div class="metric-detail fade-up">
                <p style={{ margin: '0 0 6px' }}>
                  <b>{tr('측정 방법', 'How it’s measured')}</b> · {L(info.how)}
                </p>
                <p style={{ margin: 0 }}>
                  <b>{tr('왜 중요할까요', 'Why it matters')}</b> · {L(info.why)}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Result({ id }: { id: string }) {
  const isDemo = id === 'demo';
  const scan = isDemo ? DEMO_SCAN : scans.value.find((s) => s.id === id);
  const [reveal, setReveal] = useState(route.value.query.reveal === '1');
  const [view, setView] = useState<'front' | 'side'>(scan?.side ? 'side' : 'front');
  const [hide, setHide] = useState(false);
  if (!scan) {
    return (
      <div class="screen">
        <TopBar title={tr('리포트', 'Report')} fallback="/scan" />
        <p class="body">{tr('리포트를 찾을 수 없어요.', 'Report not found.')}</p>
      </div>
    );
  }
  const r = scan.report;
  const a = ANIMALS[r.type.primary];
  const prev = isDemo ? undefined : scans.value.filter((s) => s.at < scan.at).slice(-1)[0];
  const delta = prev ? r.score - prev.report.score : null;
  const tops = topIssues(r.issues, 3);

  const closeReveal = () => {
    setReveal(false);
    replace(`/scan/result/${scan.id}`);
  };
  const startRoutine = () => {
    if (!profile.value.safetyCheckedAt) return nav('/safety?next=/routine/today');
    activeRoutine.value = todayRoutine.value;
    nav('/routine/today');
  };
  const remove = async () => {
    if (!(await ask(tr('이 스캔 기록과 사진을 삭제할까요?', 'Delete this scan and its photos?'), { ok: tr('삭제', 'Delete'), danger: true }))) return;
    await deletePhotos(scan.id);
    removeScan(scan.id);
    toast(tr('삭제했어요', 'Deleted'));
    replace('/scan');
  };

  return (
    <div class="screen">
      {reveal && <Reveal scan={scan} onClose={closeReveal} />}
      <TopBar
        title={tr('체형 분석 리포트', 'Posture report')}
        fallback="/scan"
        right={
          isDemo ? undefined : (
            <button class="icon-btn" aria-label={tr('공유', 'Share')} onClick={() => nav(`/scan/share/${scan.id}`)}>
              <Share2 size={22} />
            </button>
          )
        }
      />
      {isDemo && (
        <Notice kind="info" style={{ marginBottom: 12 }}>
          <div>{tr('예시 리포트예요. 실제 결과는 내 사진으로 스캔하면 볼 수 있어요.', 'This is a sample report. Scan yourself to see your own results.')}</div>
          <button class="btn sm primary" style={{ marginTop: 10 }} onClick={() => nav('/scan/capture')}>
            {tr('내 자세 스캔하기', 'Scan my posture')}
          </button>
        </Notice>
      )}
      <div class="card" style={{ background: a.soft, boxShadow: 'none', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div class="caption" style={{ color: '#6b5a48' }}>
          {new Date(scan.at).toLocaleString(tr('ko-KR', 'en-US'), { dateStyle: 'medium', timeStyle: 'short' })}
          {scan.label ? ` · ${scan.label}` : ''}
        </div>
        <div style={{ display: 'inline-block', marginTop: 6 }}>
          <Animal id={r.type.primary} size={160} />
        </div>
        <h1 class="h1" style={{ color: '#1f1a15' }}>
          {L(typeName(r.type.primary, r.type.secondary))}
        </h1>
        <p class="body" style={{ color: '#4b3f33', marginTop: 6 }}>
          {L(typeTitle(r.type.primary, r.type.secondary))}
        </p>
        <div class="row" style={{ justifyContent: 'center', gap: 28, marginTop: 18 }}>
          <Ring value={r.score} size={96} stroke={10} color={scoreColor(r.score)} track="rgba(0,0,0,0.08)">
            <div>
              <div class="num" style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: '#1f1a15' }}>
                {r.score}
              </div>
              <div class="micro" style={{ color: '#6b5a48' }}>
                {tr('자세 점수', 'score')}
              </div>
            </div>
          </Ring>
          {r.postureAge !== null && (
            <div style={{ textAlign: 'left', color: '#1f1a15' }}>
              <div class="micro" style={{ color: '#6b5a48' }}>
                {tr('자세 나이', 'Posture age')}
              </div>
              <div class="num" style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1 }}>
                {r.postureAge}
                <span style={{ fontSize: 16 }}>{tr('세', '')}</span>
              </div>
              <span class={`badge ${r.ageDelta! > 0 ? 'lv3' : 'lv0'}`}>
                {r.ageDelta! > 0 ? tr(`실제보다 +${r.ageDelta}세`, `+${r.ageDelta} vs real age`) : r.ageDelta! < 0 ? tr(`실제보다 ${r.ageDelta}세`, `${r.ageDelta} vs real age`) : tr('실제 나이와 같아요', 'Same as real age')}
              </span>
            </div>
          )}
        </div>
        {delta !== null && (
          <div class={`badge ${delta >= 0 ? 'lv0' : 'lv3'}`} style={{ marginTop: 14 }}>
            {delta >= 0 ? tr(`지난 스캔보다 ${delta}점 올랐어요 📈`, `Up ${delta} pts since last scan 📈`) : tr(`지난 스캔보다 ${-delta}점 내려갔어요`, `Down ${-delta} pts since last scan`)}
          </div>
        )}
        {!isDemo && (
          <button class="btn primary block" style={{ marginTop: 18 }} onClick={() => nav(`/scan/share/${scan.id}`)}>
            <Share2 size={18} /> {tr('결과 카드 공유하기', 'Share my result card')}
          </button>
        )}
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('AI 측정 결과', 'AI measurements')}</h2>
        <button class="link-btn row" style={{ gap: 4 }} onClick={() => setHide(!hide)}>
          {hide ? <Eye size={16} /> : <EyeOff size={16} />} {hide ? tr('사진 보기', 'Show photo') : tr('사진 가리기', 'Hide photo')}
        </button>
      </div>
      {scan.front && scan.side && (
        <div class="seg" style={{ marginBottom: 12 }}>
          <button class={view === 'front' ? 'on' : ''} onClick={() => setView('front')}>
            {tr('정면', 'Front')}
          </button>
          <button class={view === 'side' ? 'on' : ''} onClick={() => setView('side')}>
            {tr('옆모습', 'Side')}
          </button>
        </div>
      )}
      <ScanPhoto scan={scan} view={view} hidePhoto={hide || isDemo} />
      <div style={{ marginTop: 12 }}>
        {view === 'side' ? (
          <MetricList metrics={r.metrics} ids={['headForward', 'shoulderForward', 'kyphosis', 'lordosis', 'pelvisForward', 'kneeExtension']} />
        ) : (
          <MetricList metrics={r.metrics} ids={['headTilt', 'shoulderTilt', 'pelvicTilt', 'trunkShift', 'pelvicShift', 'headShift', 'kneeAlign']} />
        )}
      </div>
      {!scan.side && (
        <Notice kind="info" icon={<Info size={18} />} style={{ marginTop: 12 }}>
          {tr('옆모습 사진이 없어 거북목·굽은 등은 측정하지 못했어요. 다음엔 두 장 모두 찍어 보세요.', 'No side photo, so tech neck and back curve weren’t measured. Try both photos next time.')}
        </Notice>
      )}
      {!scan.front && (
        <Notice kind="info" icon={<Info size={18} />} style={{ marginTop: 12 }}>
          {tr('정면 사진이 없어 좌우 균형은 측정하지 못했어요.', 'No front photo, so left–right balance wasn’t measured.')}
        </Notice>
      )}

      <div class="section-title">
        <h2 class="h2">{tr(`${a.short.ko}형은 이런 체형이에요`, `About the ${a.short.en} type`)}</h2>
      </div>
      <div class="card stack">
        <p class="body" style={{ color: 'var(--text)' }}>
          {L(a.looks)}
        </p>
        {a.causes.length > 0 && (
          <div>
            <div class="h3">{tr('흔한 원인', 'Common causes')}</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: 'var(--text-2)', fontSize: 15 }}>
              {a.causes.map((c, i) => (
                <li key={i}>{L(c)}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <div class="h3">{tr('생길 수 있는 불편', 'You might feel')}</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: 'var(--text-2)', fontSize: 15 }}>
            {a.symptoms.map((c, i) => (
              <li key={i}>{L(c)}</li>
            ))}
          </ul>
        </div>
        {a.tight.length > 0 && (
          <div class="row" style={{ gap: 10, alignItems: 'stretch' }}>
            <div class="muscle-col">
              <h4 style={{ color: 'var(--severe)' }}>
                <i class="dot" style={{ background: 'var(--severe)' }} />
                {tr('짧아지고 뭉친 근육', 'Tight & short')}
              </h4>
              <ul>
                {a.tight.map((c, i) => (
                  <li key={i}>{L(c)}</li>
                ))}
              </ul>
            </div>
            <div class="muscle-col">
              <h4 style={{ color: 'var(--info)' }}>
                <i class="dot" style={{ background: 'var(--info)' }} />
                {tr('약해진 근육', 'Weak & long')}
              </h4>
              <ul>
                {a.weak.map((c, i) => (
                  <li key={i}>{L(c)}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <Notice kind="brand">
          <b>{tr('물리치료사의 한마디', 'Physio note')}</b>
          <div style={{ marginTop: 2 }}>{L(a.proTip)}</div>
        </Notice>
        <div class="caption">
          {tr('전문 용어', 'Clinical term')}: {L(a.clinical)}
        </div>
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('맞춤 교정 처방', 'Your corrective plan')}</h2>
      </div>
      <div class="card">
        <p class="body">{tr('측정 결과를 바탕으로 매일 10분 루틴을 새로 짜 드려요. 우선순위는 다음과 같아요.', 'Based on these results, you’ll get a fresh 10-minute routine every day. Your priorities:')}</p>
        <ol style={{ margin: '10px 0 0', paddingLeft: 22 }}>
          {tops.map((t) => (
            <li key={t} class="h3" style={{ margin: '6px 0' }}>
              {L(ISSUE_THEME[t] ?? { ko: t, en: t })}
            </li>
          ))}
          {!tops.length && <li class="h3">{tr('지금 자세 유지하기', 'Keep your good posture')}</li>}
        </ol>
        <button class="btn primary block" style={{ marginTop: 16 }} onClick={startRoutine}>
          <Play size={18} fill="currentColor" /> {tr('오늘의 교정 루틴 시작', 'Start today’s routine')}
        </button>
      </div>

      {settings.value.expert.enabled && (
        <>
          <div class="section-title">
            <h2 class="h2">{tr('전문가용 원시 값', 'Raw values (expert)')}</h2>
          </div>
          <div class="card" style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace', overflowX: 'auto' }}>
            {Object.values(r.metrics).map((m) => (
              <div key={m!.id}>
                {m!.id}: {num(m!.value, 2)} {NORMS[m!.id].unit} · L{m!.level} · b={num(m!.badness, 2)}
                {m!.extra ? ` · ${Object.entries(m!.extra).map(([k, v]) => `${k}=${num(v, 1)}`).join(' ')}` : ''}
              </div>
            ))}
          </div>
        </>
      )}

      <Notice style={{ marginTop: 20 }}>
        {tr(
          '이 결과는 사진 기반 AI 추정치로 의료 진단이 아니에요. 촬영 각도·옷·조명에 따라 달라질 수 있으니 같은 조건에서 주기적으로 비교해 보세요. 통증이 계속되면 전문가와 상담하세요.',
          'These are AI estimates from photos, not a medical diagnosis. Angle, clothing and lighting affect results, so compare scans taken under the same conditions. See a professional if pain persists.',
        )}
      </Notice>
      {!isDemo && (
        <button class="btn ghost block" style={{ marginTop: 12, color: 'var(--severe)' }} onClick={remove}>
          <Trash2 size={18} /> {tr('이 스캔 삭제', 'Delete this scan')}
        </button>
      )}
    </div>
  );
}
