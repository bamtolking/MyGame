// 결과 공유 카드: 1080×1350 이미지를 캔버스로 그려 공유(Web Share) 또는 저장
import type { World } from '../sim/types';
import { BALANCE } from '../content';
import { worker, emoji, UI_FONT } from '../render/sprites';
import { fmtTime } from './dom';

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function drawShareCard(w: World, coins: number): HTMLCanvasElement {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const rs = w.stats_;
  const win = rs.cleared;
  // 배경
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, win ? '#2b3170' : '#3a1d3f');
  bg.addColorStop(1, '#141729');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 장식: 흩어진 이모지
  const deco = ['📄', '📧', '📞', '📊', '⌛', '💬'];
  g.globalAlpha = 0.12;
  for (let i = 0; i < 26; i++) {
    const e = emoji(deco[i % deco.length], 40);
    const x = (i * 397) % W, y = (i * 223) % H;
    g.drawImage(e.c, x, y, 110, 110);
  }
  g.globalAlpha = 1;
  // 로고
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 132px ${UI_FONT}`;
  g.fillStyle = '#b37d00'; g.fillText('칼퇴', W / 2, 150 + 8);
  g.fillStyle = '#ffd84d'; g.fillText('칼퇴', W / 2, 150);
  g.font = `900 40px ${UI_FONT}`;
  g.fillStyle = '#ffe9a6'; g.fillText('S U R V I V O R', W / 2, 245);
  // 결과 문구
  g.font = `900 92px ${UI_FONT}`;
  g.fillStyle = win ? '#ffffff' : '#ff9da0';
  const head = win ? (rs.overtimeSec > 0 ? `야근 ${fmtTime(rs.overtimeSec)} 후 퇴근` : '18:00 칼퇴 성공!') : `${fmtTime(Math.min(w.t, BALANCE.runSeconds))} 버팀`;
  g.fillText(head, W / 2, 380);
  g.font = `800 40px ${UI_FONT}`;
  g.fillStyle = '#b7bce6';
  g.fillText(`${w.cfg.stage.icon} ${w.cfg.stage.name}${w.cfg.heat ? ` · 야근 강도 ${w.cfg.heat}` : ''}${w.cfg.daily ? ' · 오늘의 업무' : ''}`, W / 2, 460);
  // 캐릭터
  const s = worker(w.cfg.character.look, 0, 34);
  const k = 330 / s.c.height;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40;
  g.drawImage(s.c, W / 2 - (s.c.width * k) / 2, 510, s.c.width * k, s.c.height * k);
  g.restore();
  g.font = `900 48px ${UI_FONT}`;
  g.fillStyle = '#ffffff';
  g.fillText(`${w.cfg.character.name}`, W / 2, 880);
  g.font = `700 32px ${UI_FONT}`;
  g.fillStyle = '#b7bce6';
  g.fillText(w.cfg.character.title, W / 2, 928);
  // 지표
  const kpis: [string, string][] = [
    ['레벨', `Lv ${w.player.level}`],
    ['처치', rs.kills.toLocaleString('ko-KR')],
    ['월급', `₩${coins.toLocaleString('ko-KR')}`],
  ];
  const bw = 300, bh = 150, gap = 30, x0 = (W - (bw * 3 + gap * 2)) / 2;
  kpis.forEach(([label, v], i) => {
    const x = x0 + i * (bw + gap), y = 980;
    g.fillStyle = 'rgba(255,255,255,.08)';
    rr(g, x, y, bw, bh, 28); g.fill();
    g.fillStyle = '#b7bce6'; g.font = `800 30px ${UI_FONT}`;
    g.fillText(label, x + bw / 2, y + 45);
    g.fillStyle = i === 2 ? '#ffd84d' : '#ffffff'; g.font = `900 52px ${UI_FONT}`;
    g.fillText(v, x + bw / 2, y + 102);
  });
  // 무기
  const ws = [...w.weapons].sort((a, b) => b.dmg - a.dmg).slice(0, 6);
  const iw = 110, ix0 = (W - ws.length * (iw + 16) + 16) / 2;
  ws.forEach((wi, i) => {
    const x = ix0 + i * (iw + 16), y = 1170;
    g.fillStyle = wi.def.evolved ? 'rgba(163,107,255,.45)' : 'rgba(255,255,255,.1)';
    rr(g, x, y, iw, iw, 24); g.fill();
    const e = emoji(wi.def.icon, 40);
    g.drawImage(e.c, x + 12, y + 12, iw - 24, iw - 24);
    if (wi.def.evolved) { g.font = `900 30px ${UI_FONT}`; g.fillStyle = '#ffd84d'; g.fillText('★', x + iw - 16, y + 18); }
  });
  g.font = `700 26px ${UI_FONT}`;
  g.fillStyle = '#7d83b8';
  const d = new Date();
  g.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} · 오늘도 살아남았다`, W / 2, 1318);
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
