import { useEffect, useRef, useState } from 'preact/hooks';
import type { FrontAnalysis, MetricResult, SideAnalysis } from '../analysis/analyze';
import { lang, num } from '../i18n';
import { loadPhoto } from '../scan/pipeline';
import type { ScanRecord } from '../state/store';

const LEVEL_HEX = ['#12b76a', '#f5a524', '#f06e2a', '#ef4444'];

function lvl(m?: MetricResult) {
  return LEVEL_HEX[m?.level ?? 0];
}

/** 리포트용 사진 + 측정선 오버레이 */
export function ScanPhoto({ scan, view, hidePhoto = false, maxHeight = 520 }: { scan: ScanRecord; view: 'front' | 'side'; hidePhoto?: boolean; maxHeight?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const size = scan.size[view];

  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    if (scan.hasPhoto[view]) {
      loadPhoto(scan.id, view).then((x) => {
        u = x;
        if (alive) setUrl(x);
      });
    }
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [scan.id, view]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !size) return;
    const [w, h] = size;
    const draw = (img: HTMLImageElement | null) => {
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d')!;
      g.fillStyle = '#15171c';
      g.fillRect(0, 0, w, h);
      if (img && !hidePhoto) {
        g.drawImage(img, 0, 0, w, h);
        g.fillStyle = 'rgba(10,12,16,0.28)';
        g.fillRect(0, 0, w, h);
      }
      const s = Math.max(w, h) / 900;
      if (view === 'front' && scan.front) drawFront(g, scan.front, s, w);
      if (view === 'side' && scan.side) drawSide(g, scan.side, s, h);
    };
    if (url && !hidePhoto) {
      const img = new Image();
      img.onload = () => draw(img);
      img.onerror = () => draw(null);
      img.src = url;
    } else draw(null);
  }, [url, hidePhoto, view, scan.id]);

  if (!size) return null;
  return (
    <div class="photo-frame" style={{ maxHeight, display: 'flex', justifyContent: 'center' }}>
      <canvas ref={ref} style={{ maxHeight, width: 'auto', maxWidth: '100%', aspectRatio: `${size[0]} / ${size[1]}` }} />
    </div>
  );
}

function pill(g: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, s: number, align: 'left' | 'right' | 'center' = 'left') {
  g.font = `700 ${Math.round(15 * s)}px Pretendard Variable, -apple-system, sans-serif`;
  const tw = g.measureText(text).width;
  const pw = tw + 16 * s, ph = 26 * s;
  let px = align === 'left' ? x : align === 'right' ? x - pw : x - pw / 2;
  px = Math.max(4, Math.min(g.canvas.width - pw - 4, px));
  const py = Math.max(4, Math.min(g.canvas.height - ph - 4, y - ph / 2));
  g.fillStyle = 'rgba(15,17,22,0.82)';
  g.beginPath();
  g.roundRect(px, py, pw, ph, 13 * s);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(px + 9 * s, py + ph / 2, 3.5 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(text, px + 16 * s, py + ph / 2 + 0.5);
}

function dot(g: CanvasRenderingContext2D, x: number, y: number, color: string, s: number) {
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(x, y, 7 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, 4.5 * s, 0, Math.PI * 2);
  g.fill();
}

function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number, dash?: number[]) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.setLineDash(dash ?? []);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.setLineDash([]);
}

function drawFront(g: CanvasRenderingContext2D, a: FrontAnalysis, s: number, w: number) {
  const m = (id: string) => a.metrics.find((x) => x.id === id);
  const ko = lang.value === 'ko';
  const G = a.geo;
  // 몸 중심 수직선
  const top = Math.min(G.headMid.y, G.eyeMid.y) - 60 * s;
  line(g, G.centerX, top, G.centerX, Math.max(G.ankleL.y, G.ankleR.y) + 30 * s, 'rgba(255,255,255,0.75)', 2.5 * s, [10 * s, 8 * s]);
  // 수평 기준선 + 실제 선
  const pairs: [any, any, string, string][] = [
    [G.earL, G.earR, 'headTilt', ko ? '머리' : 'Head'],
    [G.shL, G.shR, 'shoulderTilt', ko ? '어깨' : 'Shoulders'],
    [G.hipL, G.hipR, 'pelvicTilt', ko ? '골반' : 'Pelvis'],
  ];
  for (const [L, R, id, name] of pairs) {
    const mm = m(id);
    const c = lvl(mm);
    const midY = (L.y + R.y) / 2;
    const ext = Math.abs(L.x - R.x) * 0.35;
    const x0 = Math.min(L.x, R.x) - ext, x1 = Math.max(L.x, R.x) + ext;
    line(g, x0, midY, x1, midY, 'rgba(255,255,255,0.45)', 2 * s, [6 * s, 6 * s]);
    const dx = R.x - L.x, dy = R.y - L.y;
    const k = ext / Math.max(1, Math.abs(dx));
    line(g, L.x - dx * k, L.y - dy * k, R.x + dx * k, R.y + dy * k, c, 4 * s);
    dot(g, L.x, L.y, c, s);
    dot(g, R.x, R.y, c, s);
    const labelX = Math.max(L.x, R.x) + ext + 8 * s;
    const val = mm ? `${num(Math.abs(mm.value), 1)}°` : '';
    pill(g, labelX > w * 0.8 ? Math.min(L.x, R.x) - ext - 8 * s : labelX, midY, `${name} ${val}`, c, s, labelX > w * 0.8 ? 'right' : 'left');
  }
  // 다리 정렬선
  const knee = m('kneeAlign');
  const kc = lvl(knee);
  for (const [H, K, A] of [
    [G.hipL, G.kneeL, G.ankleL],
    [G.hipR, G.kneeR, G.ankleR],
  ]) {
    line(g, H.x, H.y, A.x, A.y, 'rgba(255,255,255,0.4)', 2 * s, [6 * s, 6 * s]);
    line(g, H.x, H.y, K.x, K.y, kc, 4 * s);
    line(g, K.x, K.y, A.x, A.y, kc, 4 * s);
    dot(g, K.x, K.y, kc, s);
    dot(g, A.x, A.y, kc, s);
  }
  if (knee) {
    const kx = Math.max(G.kneeL.x, G.kneeR.x) + 24 * s;
    pill(g, kx, (G.kneeL.y + G.kneeR.y) / 2, `${ko ? '무릎' : 'Knees'} ${num(Math.abs(knee.value), 1)}°`, kc, s);
  }
  // 몸통 중심 치우침
  const trunk = m('trunkShift');
  if (trunk && trunk.level > 0) {
    const sm = { x: (G.shL.x + G.shR.x) / 2, y: (G.shL.y + G.shR.y) / 2 };
    const hm = { x: (G.hipL.x + G.hipR.x) / 2, y: (G.hipL.y + G.hipR.y) / 2 };
    line(g, hm.x, hm.y, sm.x, sm.y, lvl(trunk), 3.5 * s);
  }
}

function drawSide(g: CanvasRenderingContext2D, a: SideAnalysis, s: number, h: number) {
  const m = (id: string) => a.metrics.find((x) => x.id === id);
  const ko = lang.value === 'ko';
  const G = a.geo;
  const f = G.facing;
  // 기준 수직선 (Kendall plumb line)
  line(g, G.plumbX, G.ear.y - 90 * s, G.plumbX, G.ankle.y + 30 * s, 'rgba(255,255,255,0.85)', 3 * s, [12 * s, 8 * s]);
  pill(g, G.plumbX + f * 10 * s, G.ear.y - 110 * s, ko ? '기준선' : 'Plumb line', '#ffffff', s, f > 0 ? 'left' : 'right');
  // 등 곡선
  if (G.back) {
    const B = G.back;
    g.strokeStyle = '#ffb088';
    g.lineWidth = 3.5 * s;
    g.lineJoin = 'round';
    g.beginPath();
    B.contour.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    const kyph = m('kyphosis'), lord = m('lordosis');
    line(g, B.c7.x, B.c7.y, B.l1.x, B.l1.y, 'rgba(255,255,255,0.5)', 2 * s, [5 * s, 5 * s]);
    line(g, B.l1.x, B.l1.y, B.s2.x, B.s2.y, 'rgba(255,255,255,0.5)', 2 * s, [5 * s, 5 * s]);
    dot(g, B.tApex.x, B.tApex.y, lvl(kyph), s);
    dot(g, B.lApex.x, B.lApex.y, lvl(lord), s);
    if (kyph) pill(g, B.tApex.x - f * 14 * s, B.tApex.y, `${ko ? '등' : 'Upper back'} ${num(kyph.value, 1)}`, lvl(kyph), s, f > 0 ? 'right' : 'left');
    if (lord) pill(g, B.lApex.x - f * 14 * s, B.lApex.y, `${ko ? '허리' : 'Low back'} ${num(lord.value, 1)}`, lvl(lord), s, f > 0 ? 'right' : 'left');
  }
  // 관절 연결선
  const chain = [G.ear, G.shoulder, G.hip, G.knee, G.ankle];
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3 * s;
  g.beginPath();
  chain.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();
  // 머리 전방 각도
  const hf = m('headForward');
  const hc = lvl(hf);
  line(g, G.shoulder.x, G.shoulder.y, G.shoulder.x, G.ear.y - 20 * s, 'rgba(255,255,255,0.5)', 2 * s, [5 * s, 5 * s]);
  line(g, G.shoulder.x, G.shoulder.y, G.ear.x, G.ear.y, hc, 5 * s);
  const labels: [any, MetricResult | undefined, string][] = [
    [G.ear, hf, `${ko ? '거북목' : 'Head'} ${num(Math.abs(hf?.value ?? 0), 0)}°`],
    [G.shoulder, m('shoulderForward'), `${ko ? '어깨' : 'Shoulder'} ${num(Math.abs(m('shoulderForward')?.value ?? 0), 1)}cm`],
    [G.hip, m('pelvisForward'), `${ko ? '골반' : 'Pelvis'} ${num(Math.abs(m('pelvisForward')?.value ?? 0), 1)}cm`],
    [G.knee, m('kneeExtension'), `${ko ? '무릎' : 'Knee'} ${num(Math.abs(m('kneeExtension')?.value ?? 0), 0)}°`],
  ];
  for (const [p, mm, text] of labels) {
    dot(g, p.x, p.y, lvl(mm), s);
    pill(g, p.x + f * 22 * s, p.y, text, lvl(mm), s, f > 0 ? 'left' : 'right');
  }
  dot(g, G.ankle.x, G.ankle.y, '#ffffff', s);
  void h;
}
