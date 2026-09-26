/**
 * 개발용: 부위 파일 하나의 운동을 키 자세별로 한눈에 보는 시트
 * dev/ex.html?file=neck[&ids=a,b][&dark=1]
 * 각 줄: 키마다 한 칸(단계 자막·근육 강조·경로 포함) + 버티는 자세를 90° 돌려 본 칸 + (양쪽 운동이면) 반대쪽 칸
 */
import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import '../src/styles.css';
import type { Exercise } from '../src/content/exercise-types';
import { DARK, holdKeyOf, keyTime, LIGHT, prepare, renderAt, type AnimSpec } from '../src/figure/render';

const q = new URLSearchParams(location.search);
const file = q.get('file') ?? 'neck';
const ids = q.get('ids')?.split(',').filter(Boolean);
const dark = !!q.get('dark');
if (dark) document.documentElement.dataset.theme = 'dark';
const SIZE = +(q.get('size') ?? 210);

function Frame({ spec, t, mirror = false, yaw = 0, caption }: { spec: AnimSpec; t: number; mirror?: boolean; yaw?: number; caption: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    cv.width = cv.height = SIZE * 2;
    const g = cv.getContext('2d')!;
    const prep = prepare(spec, cv.width, cv.height, mirror, yaw);
    renderAt(g, prep, t, dark ? DARK : LIGHT, { overlays: true, now: 0.4 });
  }, []);
  return (
    <div style={{ width: SIZE, flex: 'none' }}>
      <canvas ref={ref} style={{ width: SIZE, height: SIZE, background: 'var(--surface)', borderRadius: 12, display: 'block' }} />
      <div style={{ font: '600 12px/1.3 system-ui', color: 'var(--text-2)', padding: '4px 2px 0' }}>{caption}</div>
    </div>
  );
}

function Row({ e }: { e: Exercise }) {
  const a = e.anim;
  const hk = holdKeyOf(a);
  const lab = (k: number) => a.labels?.[k]?.ko ?? `key ${k}`;
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 10 }}>
      <div style={{ font: '800 15px system-ui', color: 'var(--text)', marginBottom: 6 }}>
        {e.name.ko} <span style={{ fontWeight: 500, color: 'var(--text-3)' }}>· {e.id} · {e.phase} · {e.dose.kind}{e.dose.perSide ? ' · 양쪽' : ''} · view {a.view}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {a.keys.map((_, k) => (
          <Frame key={k} spec={a} t={keyTime(a, k)} caption={`${k + 1}. ${lab(k)}${k === hk ? ' (버티기)' : ''}`} />
        ))}
        <Frame spec={a} t={keyTime(a, hk)} yaw={90} caption={`↻ 90° 돌려 본 ${lab(hk)}`} />
        {e.dose.perSide && <Frame spec={a} t={keyTime(a, hk)} mirror caption={`반대쪽 · ${lab(hk)}`} />}
      </div>
    </div>
  );
}

async function main() {
  const mod = await import(`../src/content/ex/${file}.ts`);
  const arr = (Object.values(mod).find(Array.isArray) as Exercise[]).filter((e) => !ids || ids.includes(e.id));
  render(
    <div style={{ padding: 12, display: 'grid', gap: 12, background: 'var(--bg)' }}>
      {arr.map((e) => (
        <Row key={e.id} e={e} />
      ))}
    </div>,
    document.getElementById('root')!,
  );
  setTimeout(() => ((window as any).__done = true), 500);
}
main().catch((err) => {
  document.body.textContent = String(err?.stack ?? err);
  (window as any).__done = true;
  console.error(err);
});
