// 결과 공유 카드: 1080×1350 이미지를 캔버스로 그려 공유(Web Share) 또는 저장 — "야근 네온" 스타일
import type { World } from '../sim/types';
import { BALANCE } from '../content';
import { worker, emoji } from '../render/sprites';
import { DISPLAY_FONT, BODY_FONT } from './fonts';
import { fmtTime, displayFontLoaded } from './dom';

/** 근무지 강조색(style.css의 [data-stage]와 같은 값) */
const STAGE_ACC: Record<string, string> = { office: '#3de0ff', crunch: '#a3ff5c', dinner: '#ff8a3d', holiday: '#ffcf5a' };

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** 디스플레이 서체는 한 굵기(400)뿐이다. 실제로 받아졌으면 400(가짜 굵게 방지), 아니면 대체 글꼴을 900으로 */
function displayFont(): (px: number) => string {
  const wt = displayFontLoaded() ? 400 : 900;
  return px => `${wt} ${px}px ${DISPLAY_FONT}`;
}

/** 글자 사이를 벌려 가운데 정렬로 쓴다(canvas letterSpacing 미지원 브라우저 대비) */
function spaced(g: CanvasRenderingContext2D, text: string, cx: number, y: number, gap: number) {
  const chars = [...text];
  const ws = chars.map(c => g.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let x = cx - total / 2;
  const align = g.textAlign;
  g.textAlign = 'left';
  chars.forEach((c, i) => { g.fillText(c, x, y); x += ws[i] + gap; });
  g.textAlign = align;
}

/** 네온 글자: 번짐 두 겹 + 흰 심 */
function neonText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, blur: number, core = '#ffffff') {
  g.save();
  g.shadowColor = color; g.shadowBlur = blur;
  g.fillStyle = color; g.fillText(text, x, y);
  g.shadowBlur = blur * 0.4; g.fillText(text, x, y);
  g.shadowBlur = 0; g.fillStyle = core; g.fillText(text, x, y);
  g.restore();
}

export function drawShareCard(w: World, coins: number): HTMLCanvasElement {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const D = displayFont();
  const B = (wt: number, px: number) => `${wt} ${px}px ${BODY_FONT}`;
  const rs = w.stats_;
  const win = rs.cleared;
  const acc = STAGE_ACC[w.cfg.stage.id] ?? '#3de0ff';
  const hot = win ? '#ffd84d' : '#ff4d6d';
  // 배경: 밤 사무실 남색 + 위쪽 네온 번짐
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, win ? '#101a3a' : '#1c0f2e');
  bg.addColorStop(0.55, '#0a0f22');
  bg.addColorStop(1, '#04060e');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const top = g.createRadialGradient(W / 2, -80, 40, W / 2, -80, 900);
  top.addColorStop(0, win ? 'rgba(255,216,77,.28)' : 'rgba(255,77,109,.25)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = top; g.fillRect(0, 0, W, H);
  // 신스웨이브 바닥 격자(원근)
  g.save();
  const hy = 760;
  const floor = g.createLinearGradient(0, hy, 0, H);
  floor.addColorStop(0, 'rgba(0,0,0,0)');
  floor.addColorStop(1, 'rgba(0,0,0,.35)');
  g.strokeStyle = acc; g.lineWidth = 2;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, y = hy + (H - hy) * t * t;
    g.globalAlpha = 0.05 + t * 0.22;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    g.globalAlpha = 0.16;
    g.beginPath(); g.moveTo(W / 2 + i * 30, hy); g.lineTo(W / 2 + i * 190, H); g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = floor; g.fillRect(0, hy, W, H - hy);
  g.restore();
  // 장식: 흩어진 업무 이모지(아주 옅게)
  const deco = ['📄', '📧', '📞', '📊', '⌛', '💬'];
  g.globalAlpha = 0.07;
  for (let i = 0; i < 22; i++) {
    const e = emoji(deco[i % deco.length], 40);
    const x = (i * 397) % W, y = (i * 223) % 700;
    g.drawImage(e.c, x, y, 100, 100);
  }
  g.globalAlpha = 1;
  // 로고
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = D(150);
  g.fillStyle = '#6b3a00'; g.fillText('칼퇴', W / 2, 140 + 9);
  const lg = g.createLinearGradient(0, 80, 0, 200);
  lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.35, '#fff3c0'); lg.addColorStop(0.7, '#ffd84d'); lg.addColorStop(1, '#ff9b2e');
  g.save(); g.shadowColor = 'rgba(255,180,40,.75)'; g.shadowBlur = 40; g.fillStyle = lg; g.fillText('칼퇴', W / 2, 140); g.restore();
  g.font = D(40);
  g.save(); g.shadowColor = '#3de0ff'; g.shadowBlur = 24; g.fillStyle = '#dffcff'; spaced(g, 'SURVIVOR', W / 2, 250, 22); g.restore();
  // 결과 문구
  const head = win ? (rs.overtimeSec > 0 ? `야근 ${fmtTime(rs.overtimeSec)} 후 퇴근` : '18:00 칼퇴 성공!') : `${fmtTime(Math.min(w.t, BALANCE.runSeconds))} 버팀`;
  g.font = D(head.length > 10 ? 86 : 98);
  neonText(g, head, W / 2, 372, hot, 34, win ? '#fffbe8' : '#ffe3e8');
  g.font = B(800, 38);
  g.fillStyle = '#c3cbef';
  g.fillText(`${w.cfg.stage.icon} ${w.cfg.stage.name}${w.cfg.heat ? ` · 야근 강도 ${w.cfg.heat}` : ''}${w.cfg.daily ? ' · 오늘의 업무' : ''}`, W / 2, 452);
  // 캐릭터: 스포트라이트 + 발밑 빛 웅덩이
  const spot = g.createRadialGradient(W / 2, 700, 20, W / 2, 700, 330);
  spot.addColorStop(0, acc + '66'); spot.addColorStop(0.5, acc + '1f'); spot.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = spot; g.fillRect(0, 380, W, 620);
  g.save();
  g.translate(W / 2, 842); g.scale(1, 0.24);
  const pool = g.createRadialGradient(0, 0, 10, 0, 0, 220);
  pool.addColorStop(0, 'rgba(255,255,255,.4)'); pool.addColorStop(0.4, acc + '55'); pool.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = pool; g.beginPath(); g.arc(0, 0, 220, 0, Math.PI * 2); g.fill();
  g.restore();
  const s = worker(w.cfg.character.look, 0, 34, 8);
  const k = 320 / s.c.height;
  g.save();
  g.shadowColor = acc; g.shadowBlur = 36;
  g.drawImage(s.c, W / 2 - (s.c.width * k) / 2, 520, s.c.width * k, s.c.height * k);
  g.restore();
  g.font = D(54);
  neonText(g, w.cfg.character.name, W / 2, 900, acc, 18);
  g.font = B(700, 30);
  g.fillStyle = '#aeb7de';
  g.fillText(w.cfg.character.title, W / 2, 950);
  // 지표: 유리 타일 + 네온 윗선
  const kpis: [string, string][] = [
    ['레벨', `Lv ${w.player.level}`],
    ['처치', rs.kills.toLocaleString('ko-KR')],
    ['월급', `₩${coins.toLocaleString('ko-KR')}`],
  ];
  const bw = 300, bh = 150, gap = 30, x0 = (W - (bw * 3 + gap * 2)) / 2;
  kpis.forEach(([label, v], i) => {
    const x = x0 + i * (bw + gap), y = 1000;
    const col = i === 2 ? '#ffd84d' : acc;
    const tile = g.createLinearGradient(0, y, 0, y + bh);
    tile.addColorStop(0, 'rgba(34,44,78,.92)'); tile.addColorStop(1, 'rgba(10,13,28,.92)');
    g.fillStyle = tile; rr(g, x, y, bw, bh, 26); g.fill();
    g.save(); g.strokeStyle = col; g.globalAlpha = 0.45; g.lineWidth = 2; rr(g, x + 1, y + 1, bw - 2, bh - 2, 25); g.stroke(); g.restore();
    const ln = g.createLinearGradient(x + 20, 0, x + bw - 20, 0);
    ln.addColorStop(0, 'rgba(0,0,0,0)'); ln.addColorStop(0.5, col); ln.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ln; g.fillRect(x + 20, y, bw - 40, 4);
    g.fillStyle = '#aeb7de'; g.font = B(800, 30);
    g.fillText(label, x + bw / 2, y + 44);
    g.font = D(v.length > 7 ? 46 : 56);
    if (i === 2) neonText(g, v, x + bw / 2, y + 102, '#ffd84d', 16, '#ffe98a');
    else { g.fillStyle = '#ffffff'; g.fillText(v, x + bw / 2, y + 102); }
  });
  // 무기: 등급 테두리(진화 = 금색)
  const ws = [...w.weapons].sort((a, b) => b.dmg - a.dmg).slice(0, 6);
  const iw = 110, ix0 = (W - ws.length * (iw + 16) + 16) / 2;
  ws.forEach((wi, i) => {
    const x = ix0 + i * (iw + 16), y = 1180;
    const col = wi.def.evolved ? '#ffc93d' : acc;
    g.fillStyle = wi.def.evolved ? 'rgba(110,64,10,.75)' : 'rgba(22,29,54,.9)';
    rr(g, x, y, iw, iw, 22); g.fill();
    g.save(); g.shadowColor = col; g.shadowBlur = wi.def.evolved ? 22 : 10; g.strokeStyle = col; g.globalAlpha = wi.def.evolved ? 1 : 0.6; g.lineWidth = 3; rr(g, x + 1.5, y + 1.5, iw - 3, iw - 3, 21); g.stroke(); g.restore();
    const e = emoji(wi.def.icon, 40);
    g.drawImage(e.c, x + 14, y + 14, iw - 28, iw - 28);
    if (wi.def.evolved) { g.font = D(30); neonText(g, '★', x + iw - 14, y + 14, '#ffd84d', 12, '#fff6c8'); }
  });
  g.font = B(700, 26);
  g.fillStyle = '#6f79a8';
  const d = new Date();
  g.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} · 오늘도 살아남았다`, W / 2, 1322);
  return c;
}

/** 공유: 기기 공유 시트(지원 시) → 안 되면 카드 이미지를 화면에 띄워 길게 눌러 저장하게 한다(다운로드가 막힌 환경 대비) */
export async function shareCard(w: World, coins: number, text: string): Promise<'shared' | 'show'> {
  const c = drawShareCard(w, coins);
  const blob: Blob | null = await new Promise(res => { try { c.toBlob(b => res(b), 'image/png'); } catch { res(null); } });
  if (blob) {
    const file = new File([blob], 'kaltoe-result.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> };
    try {
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], text, title: '칼퇴 서바이버' });
        return 'shared';
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared';
    }
  }
  return 'show';
}

/** 공유 카드 이미지(data URL) — 모달에 보여 줄 때 사용 */
export function shareCardDataUrl(w: World, coins: number): string {
  try { return drawShareCard(w, coins).toDataURL('image/png'); } catch { return ''; }
}
