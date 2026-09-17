// DOM HUD: 상단 상태, 토스트, 버튼 상태. DOM 쓰기는 값이 바뀔 때만.
import { BODIES } from '../data/bodies';
import { RULES } from '../data/rules';
import { waveStatus } from '../sim/devices';
import { skillReady } from '../sim/skills';
import { World } from '../sim/world';
import { bodyIcon } from '../render/sprites';

export function el<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
export const fmtTime = (s: number): string => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

export class Hud {
  private cache = new Map<string, string>();
  private set(id: string, text: string): void { if (this.cache.get(id) === text) return; this.cache.set(id, text); const e = document.getElementById(id); if (e) e.textContent = text; }
  private cls(id: string, cls: string): void { if (this.cache.get('cls:' + id) === cls) return; this.cache.set('cls:' + id, cls); const e = document.getElementById(id); if (e) e.className = cls; }
  private style(id: string, prop: string, val: string): void { const k = `st:${id}:${prop}`; if (this.cache.get(k) === val) return; this.cache.set(k, val); const e = document.getElementById(id); if (e) e.style.setProperty(prop, val); }
  reset(): void { this.cache.clear(); }
  update(w: World, elapsed: number, hard: boolean): void {
    const p = w.player; const d = BODIES[p.body];
    const icon = el<HTMLImageElement>('bodyicon'); const src = bodyIcon(p.body); if (icon.getAttribute('data-body') !== p.body) { icon.src = src; icon.setAttribute('data-body', p.body); }
    this.set('bodyname', d.name); this.set('bodyrole', d.role);
    this.set('zonename', `${w.zoneIndex + 1}/5 ${w.zone.name}${hard ? ' · 어려움' : ''}`); this.set('zonetime', fmtTime(elapsed));
    const hpr = Math.max(0, p.hp / p.hpMax);
    this.style('hpfill', 'width', `${(hpr * 100).toFixed(1)}%`); this.cls('hpfill', hpr <= 0.3 ? 'low' : '');
    this.set('hptext', `${Math.ceil(p.hp)} / ${p.hpMax}`);
    const seg = el<HTMLDivElement>('stabseg');
    if (p.stability == null || p.stabilityMax == null) { this.cls('stabseg', 'none'); this.set('stabtext', '고유 몸 · 붕괴 없음'); for (let i = 0; i < 10; i++) this.cls(`seg${i}`, 'seg'); }
    else {
      const r = p.stability / p.stabilityMax; const n = Math.ceil(r * 10 - 1e-6);
      this.cls('stabseg', ''); this.set('stabtext', p.collapsing ? '붕괴 중!' : `${Math.ceil(p.stability)} / ${p.stabilityMax}`);
      for (let i = 0; i < 10; i++) this.cls(`seg${i}`, i < n ? (r <= RULES.stabilityWarnRatio ? 'seg on warn' : 'seg on') : 'seg');
    }
    void seg;
    if (d.skill) { const cd = p.skillCd > 0 ? ` (${p.skillCd.toFixed(1)}초)` : ''; this.set('skillline', `스킬 ${d.skill.name}${cd} — ${d.skill.desc}`); }
    else this.set('skillline', '스킬 없음');
    const boss = w.entities.find((e) => e.body === 'boss' && e.alive);
    const bb = el<HTMLDivElement>('bossbar');
    if (boss) { bb.classList.remove('hidden'); this.style('bossfill', 'width', `${((boss.hp / boss.hpMax) * 100).toFixed(1)}%`); this.set('bosslabel', boss.ai.shielded ? '보호막 가동 — 노드 파괴 필요' : boss.ai.phase === 3 ? '과부하 단계' : `${boss.ai.phase}단계`); this.set('bosshp', `${Math.ceil(boss.hp)}`); }
    else bb.classList.add('hidden');
    const ws = waveStatus(w); const wsEl = el<HTMLDivElement>('wavestatus'); if (ws) { wsEl.classList.remove('hidden'); this.set('wavestatus', ws); } else wsEl.classList.add('hidden');
    // 토스트
    const toast = el<HTMLDivElement>('toast');
    if (w.message) { this.set('toast', w.message.text); this.cls('toast', w.message.kind); toast.style.opacity = '1'; } else toast.style.opacity = '0';
    // 버튼
    const pb = el<HTMLButtonElement>('btn-possess');
    let pcls = 'abtn'; let ptxt = '빙의'; let psub = '대상 없음';
    if (w.possessCd > 0) { pcls += ' cd'; psub = `대기 ${w.possessCd.toFixed(1)}`; pb.style.setProperty('--cd', `${(w.possessCd / RULES.possessCooldown) * 100}`); }
    else { pb.style.setProperty('--cd', '0'); if (w.possessTarget) { pcls += ' ready'; psub = BODIES[w.possessTarget.body].name; ptxt = '빙의!'; } else if (w.candidates.length) { pcls += ' far'; psub = '더 가까이'; } }
    this.cls('btn-possess', pcls); this.set('possess-txt', ptxt); this.set('possess-sub', psub);
    const sb = el<HTMLButtonElement>('btn-skill');
    if (d.skill) { sb.style.setProperty('--cd', `${(p.skillCd / d.skill.cooldown) * 100}`); this.set('skill-txt', d.skill.name); this.set('skill-sub', skillReady(w, p) ? '준비' : `${p.skillCd.toFixed(1)}`); }
    else { sb.style.setProperty('--cd', '0'); this.set('skill-txt', '스킬'); this.set('skill-sub', '없음'); }
    this.set('attack-sub', d.weapon.name);
    const ib = el<HTMLButtonElement>('btn-interact');
    if (w.interactTarget) { ib.classList.add('avail'); this.set('interact-sub', w.interactLabel); } else { ib.classList.remove('avail'); this.set('interact-sub', '없음'); }
  }
}
