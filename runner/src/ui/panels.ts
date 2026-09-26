// Reusable UI pieces: character cards/portraits and the results-screen explanations.
import type { CharacterDef } from '../data/characters';
import type { RunState } from '../sim/types';
import { BONUS_WORD, HIT_DAMAGE, FALL_DAMAGE } from '../data/tuning';
import type { RunReward } from '../meta/progress';
import { drawCharacter } from '../render/characters';
import { shapeOf } from '../render/renderer';
import { h } from './dom';

export function fmtNum(n: number): string { return Math.round(n).toLocaleString('ko-KR'); }

export function hitName(kind: string): string {
  return kind === 'spike' ? '바닥 가시 (점프!)' : kind === 'tall' ? '높은 기둥 (2단 점프!)' : kind === 'hang' ? '매달린 장애물 (슬라이드!)' : kind === 'pit' ? '구덩이 (점프!)' : kind;
}

/** A small canvas with the character in an idle/run pose. */
export function charPortrait(c: CharacterDef, size = 96, running = false): HTMLCanvasElement {
  const cv = document.createElement('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.className = 'portrait';
  const g = cv.getContext('2d')!; g.scale(dpr, dpr);
  const k = size / 110; g.translate(size / 2, size * 0.9); g.scale(k, k);
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(0, 2, 26, 6, 0, 0, Math.PI * 2); g.fill();
  drawCharacter(g, shapeOf(c), c.palette, { state: running ? 'run' : 'idle', t: 0.5, runPhase: 0.25, spin: 0, squash: 1, hurt: false, alpha: 1 });
  return cv;
}

export interface CardOpts {
  unlocked: boolean; reason: string; main: boolean; partner: boolean; coins: number; best: number;
  onMain: () => void; onPartner: () => void; onBuy: () => void; onTrial: () => void;
}
export function charCard(c: CharacterDef, o: CardOpts): HTMLElement {
  const traits: string[] = [];
  if (c.maxHp !== 100) traits.push(`체력 ${c.maxHp}`);
  if (c.drainMul !== 1) traits.push(`체력 감소 ${c.drainMul < 1 ? '느림' : '빠름'} ×${c.drainMul}`);
  if (c.maxJumps > 2) traits.push(`${c.maxJumps}단 점프`);
  if (c.glide) traits.push('활공 (공중에서 점프 누르고 있기)');
  if (c.magnetR) traits.push('작은 자석');
  if (c.revive) traits.push(`한 번 부활 (${Math.round(c.revive * 100)}%)`);
  const canBuy = !o.unlocked && c.unlock.kind === 'coins';
  return h('div', { class: 'card' + (o.main ? ' main' : '') + (o.partner ? ' partner' : '') + (o.unlocked ? '' : ' locked') },
    h('div', { class: 'pic' }, charPortrait(c, 88)),
    h('div', { class: 'info' },
      h('div', { class: 'name' }, h('b', {}, c.name), h('small', {}, ` ${c.title}`), o.main ? h('span', { class: 'chip' }, '주자') : null, o.partner ? h('span', { class: 'chip p' }, '파트너') : null),
      h('p', {}, c.desc),
      h('div', { class: 'skill' }, h('b', {}, `★ ${c.skillName}`), h('small', {}, ` ${c.skillDesc}`)),
      traits.length ? h('div', { class: 'traits' }, traits.join(' · ')) : null,
      o.best ? h('small', { class: 'muted' }, `이 캐릭터 최고 ${fmtNum(o.best)}점`) : null,
      o.unlocked
        ? h('div', { class: 'row' },
          h('button', { class: o.main ? 'small on' : 'small', disabled: o.main, onclick: o.onMain }, o.main ? '달리는 중' : '주자로'),
          h('button', { class: o.partner ? 'small on' : 'small', disabled: o.main, onclick: o.onPartner }, o.partner ? '파트너 해제' : '파트너로'))
        : h('div', { class: 'row' },
          h('span', { class: 'lock' }, `🔒 ${o.reason}`),
          h('button', { class: 'small', onclick: o.onTrial }, '시험 달리기'),
          canBuy ? h('button', { class: 'small primary', disabled: o.coins < (c.unlock as any).cost, onclick: o.onBuy }, '코인으로 열기') : null),
    ));
}

/** Why did the run end? Always concrete, never "for no reason". */
export function deathExplain(s: RunState): { title: string; detail: string } {
  const hitsDmg = s.stats.hits * (s.assist ? HIT_DAMAGE / 2 : HIT_DAMAGE);
  const fallDmg = s.stats.falls * (s.assist ? FALL_DAMAGE / 2 : FALL_DAMAGE);
  const parts: string[] = [];
  if (s.stats.hits) parts.push(`충돌 ${s.stats.hits}회 (-${Math.round(hitsDmg)})`);
  if (s.stats.falls) parts.push(`낙하 ${s.stats.falls}회 (-${Math.round(fallDmg)})`);
  parts.push(`시간에 따른 체력 감소 (-${Math.round(s.stats.drained)})`);
  if (s.stats.hpFromPotions) parts.push(`물약 회복 (+${Math.round(s.stats.hpFromPotions)})`);
  const cause = s.deathCause ?? 'drain';
  let title = '체력이 다 닳았어요';
  if (cause.startsWith('hit:')) title = `마지막 한 방: ${hitName(cause.slice(4))}`;
  else if (cause === 'pit') title = '마지막 한 방: 구덩이';
  else if (cause === 'cap') title = '긴 달리기 끝! (15분 제한)';
  // most common hazard → a concrete tip
  const worst = Object.entries(s.stats.hitsBy).sort((a, b) => b[1] - a[1])[0];
  let tip = '';
  if (worst && worst[1] >= 2) tip = ` · 가장 많이 부딪힌 것: ${hitName(worst[0])} ×${worst[1]}`;
  else if (cause === 'drain' && s.stats.hits <= 1) tip = ' · 거의 안 부딪혔어요! 물약(초록 하트)을 더 챙기면 더 멀리 가요';
  return { title, detail: parts.join(' · ') + tip };
}

/** "So close!" lines — what you almost got. */
export function nearMissHints(s: RunState, rw: RunReward): string[] {
  const out: string[] = [];
  const got = s.letters.filter(Boolean).length;
  if (got >= BONUS_WORD.length - 2 && got < BONUS_WORD.length && s.mode !== 'tutorial') out.push(`보너스 타임까지 글자 ${BONUS_WORD.length - got}개 남았었어요!`);
  if (!rw.newBest && rw.prevBest > 0 && rw.score >= rw.prevBest * 0.85) out.push(`최고 기록까지 ${fmtNum(rw.prevBest - rw.score)}점!`);
  return out.slice(0, 2);
}
