import { useEffect, useRef, useState } from 'preact/hooks';

export interface ChartPoint {
  t: number;
  v: number;
}

interface Props {
  points: ChartPoint[];
  domain: [number, number];
  ticks: number[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
  formatDate?: (t: number) => string;
  label: string;
}

/**
 * 단일 시계열 선 그래프 (2px 선, 끝점 라벨, 가는 격자, 탭/호버 툴팁)
 */
export function LineChart({ points, domain, ticks, color = 'var(--brand)', height = 180, format = (v) => String(Math.round(v)), formatDate = (t) => new Date(t).toLocaleDateString(), label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 320));
    ro.observe(el);
    setW(el.clientWidth || 320);
    return () => ro.disconnect();
  }, []);
  const padL = 30, padR = 36, padT = 14, padB = 26;
  const pw = Math.max(40, w - padL - padR), ph = height - padT - padB;
  const [y0, y1] = domain;
  const tMin = Math.min(...points.map((p) => p.t)), tMax = Math.max(...points.map((p) => p.t));
  const X = (t: number) => padL + (tMax === tMin ? pw / 2 : ((t - tMin) / (tMax - tMin)) * pw);
  const Y = (v: number) => padT + (1 - (Math.max(y0, Math.min(y1, v)) - y0) / (y1 - y0)) * ph;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${path} L${X(points[points.length - 1].t)},${padT + ph} L${X(points[0].t)},${padT + ph} Z` : '';
  const last = points[points.length - 1];
  const hp = hover !== null ? points[hover] : null;

  const onMove = (e: PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(X(p.t) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={w} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ display: 'block', touchAction: 'pan-y' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={padL + pw} y1={Y(t)} y2={Y(t)} stroke="var(--line)" stroke-width="1" />
            <text x={padL - 6} y={Y(t) + 4} text-anchor="end" font-size="11" fill="var(--text-3)">
              {format(t)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill={color} opacity="0.1" />}
        <path d={path} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={X(p.t)} cy={Y(p.v)} r={hover === i ? 6 : 4} fill={color} stroke="var(--surface)" stroke-width="2" />
        ))}
        {last && (
          <text x={X(last.t) + 8} y={Y(last.v) + 4} font-size="12.5" font-weight="700" fill="var(--text)">
            {format(last.v)}
          </text>
        )}
        {points.length > 0 && (
          <>
            <text x={X(points[0].t)} y={height - 6} text-anchor={points.length > 1 ? 'start' : 'middle'} font-size="11" fill="var(--text-3)">
              {formatDate(points[0].t)}
            </text>
            {points.length > 1 && (
              <text x={X(last.t)} y={height - 6} text-anchor="end" font-size="11" fill="var(--text-3)">
                {formatDate(last.t)}
              </text>
            )}
          </>
        )}
        {hp && <line x1={X(hp.t)} x2={X(hp.t)} y1={padT} y2={padT + ph} stroke="var(--text-3)" stroke-width="1" />}
      </svg>
      {hp && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(w - 120, Math.max(0, X(hp.t) - 60)),
            top: 0,
            width: 120,
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-2)',
            borderRadius: 10,
            padding: '6px 10px',
            fontSize: 12.5,
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: 'var(--text-3)' }}>{formatDate(hp.t)}</div>
          <div class="row" style={{ gap: 6, fontWeight: 700 }}>
            <span style={{ width: 12, height: 2, background: color, borderRadius: 1 }} />
            {format(hp.v)}
          </div>
        </div>
      )}
    </div>
  );
}
