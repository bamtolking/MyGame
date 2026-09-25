import type { MetricResult } from '../analysis/analyze';
import { METRIC_INFO } from '../content/metrics';
import { ANIMALS, typeName } from '../content/types';
import { BRAND } from '../config';
import { L, lang } from '../i18n';
import type { ScanRecord } from '../state/store';

export type CardFormat = 'story' | 'square';

const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const LEVEL_HEX = ['#12b76a', '#f5a524', '#f06e2a', '#ef4444'];
const LEVEL_TXT = { ko: ['정상', '경미', '주의', '심함'], en: ['Normal', 'Mild', 'Moderate', 'Severe'] };

function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const withNs = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(withNs);
  });
}

async function ensureFont(texts: string[]) {
  if (!document.fonts?.load) return;
  const all = texts.join(' ');
  await Promise.all([document.fonts.load(`800 40px ${FONT}`, all), document.fonts.load(`600 40px ${FONT}`, all)]).catch(() => undefined);
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** 공유용 결과 카드 이미지 */
export async function renderShareCard(scan: ScanRecord, animalSvg: string, logoSvg: string, format: CardFormat = 'story'): Promise<HTMLCanvasElement> {
  const ko = lang.value === 'ko';
  const W = 1080, H = format === 'story' ? 1920 : 1350;
  const r = scan.report;
  const a = ANIMALS[r.type.primary];
  const name = L(typeName(r.type.primary, r.type.secondary));
  const worst: MetricResult[] = Object.values(r.metrics)
    .filter((m): m is MetricResult => !!m)
    .sort((x, y) => y.badness - x.badness)
    .slice(0, 3);
  const lines = [
    ko ? '나의 체형 유형은' : 'My posture type is',
    name,
    L(a.tagline),
    ko ? '자세 점수' : 'Posture score',
    ko ? '자세 나이' : 'Posture age',
    ...worst.map((m) => L(METRIC_INFO[m.id].name)),
    ko ? `${L(BRAND.name)} AI 체형 분석` : `${L(BRAND.name)} AI posture scan`,
    ko ? '나도 30초 만에 측정하기' : 'Scan yourself in 30 seconds',
    BRAND.url,
    '0123456789세점',
  ];
  await ensureFont(lines);
  const [animal, logo] = await Promise.all([svgToImage(animalSvg), svgToImage(logoSvg)]);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // 배경
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, a.soft);
  bg.addColorStop(1, '#ffffff');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 장식 원
  g.fillStyle = 'rgba(255,107,44,0.08)';
  g.beginPath();
  g.arc(W - 80, 140, 260, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(60, H - 260, 200, 0, Math.PI * 2);
  g.fill();

  const story = format === 'story';
  let y = story ? 120 : 70;
  // 헤더
  g.drawImage(logo, 80, y, 84, 84);
  g.fillStyle = '#191f28';
  g.font = `800 40px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillText(ko ? `${L(BRAND.name)} AI 체형 분석` : `${L(BRAND.name)} AI posture scan`, 186, y + 44);
  y += story ? 170 : 120;

  // 동물 + 이름
  g.textAlign = 'center';
  g.fillStyle = '#6b5a48';
  g.font = `600 42px ${FONT}`;
  g.fillText(ko ? '나의 체형 유형은' : 'My posture type is', W / 2, y);
  y += 30;
  const aSize = story ? 470 : 330;
  g.drawImage(animal, (W - aSize) / 2, y, aSize, aSize);
  y += aSize + (story ? 40 : 16);
  g.fillStyle = '#1f1a15';
  let fs = 84;
  g.font = `900 ${fs}px ${FONT}`;
  while (g.measureText(name).width > W - 140 && fs > 48) {
    fs -= 4;
    g.font = `900 ${fs}px ${FONT}`;
  }
  g.fillText(name, W / 2, y);
  y += story ? 74 : 58;
  g.fillStyle = '#4b3f33';
  g.font = `600 40px ${FONT}`;
  g.fillText(L(a.tagline), W / 2, y);
  y += story ? 70 : 50;

  // 점수 · 자세 나이
  const boxes: [string, string, string][] = [[ko ? '자세 점수' : 'Posture score', String(r.score), ko ? '점' : '/100']];
  if (r.postureAge !== null) boxes.push([ko ? '자세 나이' : 'Posture age', String(r.postureAge), ko ? '세' : 'yrs']);
  const bw = boxes.length === 2 ? 440 : 600, bh = story ? 200 : 180, gap = 40;
  let bx = (W - (bw * boxes.length + gap * (boxes.length - 1))) / 2;
  for (const [label, val, unit] of boxes) {
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.08)';
    g.shadowBlur = 30;
    rr(g, bx, y, bw, bh, 44);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#8b95a1';
    g.font = `600 36px ${FONT}`;
    g.fillText(label, bx + bw / 2, y + 48);
    g.fillStyle = '#191f28';
    g.font = `900 100px ${FONT}`;
    const vw = g.measureText(val).width;
    g.font = `700 40px ${FONT}`;
    const uw = g.measureText(unit).width;
    const sx = bx + bw / 2 - (vw + uw + 8) / 2;
    g.textAlign = 'left';
    g.font = `900 100px ${FONT}`;
    g.fillStyle = label.includes('나이') || label.includes('age') ? (r.ageDelta && r.ageDelta > 0 ? '#ef4444' : '#12b76a') : '#ff6b2c';
    g.fillText(val, sx, y + 138);
    g.fillStyle = '#4e5968';
    g.font = `700 40px ${FONT}`;
    g.fillText(unit, sx + vw + 8, y + 150);
    g.textAlign = 'center';
    bx += bw + gap;
  }
  y += bh + (story ? 50 : 30);

  // 주요 측정 3가지 (푸터와 겹치지 않게 행 수 조절)
  const footerTop = H - (story ? 250 : 180);
  const rowH = story ? 88 : 76;
  const rows = Math.max(0, Math.min(worst.length, Math.floor((footerTop - 30 - y - 86) / rowH)));
  worst.length = rows;
  if (worst.length) {
    const cardH = 86 + worst.length * rowH;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    rr(g, 80, y, W - 160, cardH, 44);
    g.fill();
    g.textAlign = 'left';
    g.fillStyle = '#191f28';
    g.font = `800 38px ${FONT}`;
    g.fillText(ko ? '가장 신경 쓸 부분' : 'Top areas to work on', 130, y + 60);
    let yy = y + 128;
    for (const m of worst) {
      g.fillStyle = '#191f28';
      g.font = `700 36px ${FONT}`;
      g.fillText(L(METRIC_INFO[m.id].name), 130, yy);
      const lv = (ko ? LEVEL_TXT.ko : LEVEL_TXT.en)[m.level];
      g.font = `800 32px ${FONT}`;
      const lw = g.measureText(lv).width + 40;
      g.fillStyle = LEVEL_HEX[m.level] + '26';
      rr(g, W - 130 - lw, yy - 28, lw, 56, 18);
      g.fill();
      g.fillStyle = LEVEL_HEX[m.level];
      g.textAlign = 'center';
      g.fillText(lv, W - 130 - lw / 2, yy + 1);
      g.textAlign = 'left';
      yy += rowH;
    }
    y += cardH + 40;
  }

  // 푸터
  g.textAlign = 'center';
  const fy = H - (story ? 170 : 110);
  g.fillStyle = '#ff6b2c';
  rr(g, 140, fy - 60, W - 280, 120, 60);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = `800 42px ${FONT}`;
  g.fillText(ko ? '나도 30초 만에 측정하기 👉' : 'Scan yourself in 30 seconds 👉', W / 2, fy);
  g.fillStyle = '#8b95a1';
  g.font = `600 32px ${FONT}`;
  g.fillText(`${L(BRAND.name)} · ${BRAND.url}`, W / 2, H - (story ? 60 : 36));
  return c;
}
