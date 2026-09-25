// 콘텐츠 무결성 테스트: validateContent() + 스키마로 표현되지 않는 규칙(브리프 로스터·타임라인·곡선 등).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  validateContent, WEAPONS, WEAPON, PASSIVES, PASSIVE, ENEMIES, ENEMY, STAGES, CHARACTERS, ULTIMATE,
  LUNCHES, META_UPGRADES, META, ACHIEVEMENTS, ACHIEVEMENT, DAILY_MODIFIERS, BALANCE,
} from '../src/content/index';
import { ATTENDANCE_REWARDS } from '../src/content/meta';
import type { WeaponStats } from '../src/content/types';

const BRIEF = readFileSync(fileURLToPath(new URL('../docs/BRIEF.md', import.meta.url)), 'utf8');

/** 단일 코드포인트(+선택적 FE0F) 이모지 또는 'proc:' 스프라이트 키인지 */
function isSingleEmoji(s: string): boolean {
  if (s.startsWith('proc:')) return true;
  const cps = [...s].filter(c => c !== '️');
  return cps.length === 1 && !s.includes('‍');
}

describe('validateContent', () => {
  it('reports no errors', () => {
    const errs = validateContent();
    if (errs.length) console.error(`validateContent() 오류 ${errs.length}건:\n  ` + errs.join('\n  '));
    expect(errs).toEqual([]);
  });
});

describe('stages', () => {
  it.each(STAGES.map(s => [s.id, s] as const))('%s timeline covers 0..runSeconds without gaps', (_id, s) => {
    const segs = [...s.timeline].sort((a, b) => a.from - b.from);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0].from).toBe(0);
    for (let i = 1; i < segs.length; i++) expect(segs[i].from).toBe(segs[i - 1].to);
    expect(segs[segs.length - 1].to).toBeGreaterThanOrEqual(BALANCE.runSeconds);
    for (const g of segs) expect(g.to).toBeGreaterThan(g.from);
  });

  it('events are sorted by time (director consumes them with a running index)', () => {
    for (const s of STAGES) {
      for (let i = 1; i < s.events.length; i++) {
        expect(s.events[i].at, `${s.id} event #${i}`).toBeGreaterThanOrEqual(s.events[i - 1].at);
      }
    }
  });

  it('boss events carry no time multiplier (engine uses boss def.hp as absolute HP)', () => {
    for (const s of STAGES) {
      for (const e of s.events.filter(e => e.kind === 'boss')) {
        expect(e.hpMul ?? 1, `${s.id} boss ${e.enemy}@${e.at}`).toBe(1);
      }
    }
  });

  it('each stage has a boss event for its finalBoss and at least one elite event', () => {
    for (const s of STAGES) {
      expect(s.events.some(e => e.kind === 'boss' && e.enemy === s.finalBoss), s.id).toBe(true);
      expect(s.events.some(e => e.kind === 'elite' && ENEMY.get(e.enemy!)?.elite), s.id).toBe(true);
      for (const e of s.events) {
        if (e.kind === 'boss') expect(ENEMY.get(e.enemy!)?.boss, `${s.id} boss@${e.at}`).toBe(true);
        expect(e.at, `${s.id} event@${e.at}`).toBeGreaterThanOrEqual(0);
        expect(e.at, `${s.id} event@${e.at}`).toBeLessThanOrEqual(BALANCE.runSeconds);
      }
    }
  });
});

describe('balance', () => {
  it('xpToLevel is positive and non-decreasing for levels 1..120', () => {
    let prev = 0;
    for (let L = 1; L <= 120; L++) {
      const v = BALANCE.xpToLevel(L);
      expect(Number.isFinite(v), `L${L}`).toBe(true);
      expect(v, `L${L}`).toBeGreaterThan(0);
      expect(v, `L${L}`).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('lunch and final boss happen inside the run', () => {
    expect(BALANCE.lunchAt).toBeGreaterThan(0);
    expect(BALANCE.lunchAt).toBeLessThan(BALANCE.runSeconds);
    expect(BALANCE.finalBossAt).toBeLessThan(BALANCE.runSeconds);
  });
});

describe('weapons', () => {
  it('each non-evolved weapon has exactly 7 levels; evolved weapons have none', () => {
    for (const w of WEAPONS) {
      if (w.evolved) expect(w.levels.length, w.id).toBe(0);
      else expect(w.levels.length, w.id).toBe(7);
    }
  });

  it('every base weapon with evolvesTo has an existing evolveWith passive', () => {
    for (const w of WEAPONS.filter(w => w.evolvesTo)) {
      expect(w.evolveWith, w.id).toBeTruthy();
      expect(PASSIVE.has(w.evolveWith!), `${w.id} → ${w.evolveWith}`).toBe(true);
    }
  });

  it('every non-evolved weapon evolves, each into a distinct weapon', () => {
    const base = WEAPONS.filter(w => !w.evolved);
    for (const w of base) expect(w.evolvesTo, w.id).toBeTruthy();
    const targets = base.map(w => w.evolvesTo);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('level deltas only touch fields defined in base (no undefined + delta)', () => {
    for (const w of WEAPONS) {
      for (const [i, lv] of w.levels.entries()) {
        for (const k of Object.keys(lv.delta) as (keyof WeaponStats)[]) {
          expect(w.base[k], `${w.id} Lv${i + 2} delta.${k}`).not.toBeUndefined();
        }
      }
    }
  });
});

describe('brief roster', () => {
  it('every u_* id mentioned in docs/BRIEF.md exists in ACHIEVEMENTS', () => {
    const ids = [...new Set(BRIEF.match(/\bu_[a-z]+_[a-z0-9_]+/g) ?? [])];
    expect(ids.length).toBeGreaterThan(20);
    const missing = ids.filter(id => !ACHIEVEMENT.has(id));
    expect(missing).toEqual([]);
  });

  it('weapon / evolution table ids, names and emoji match', () => {
    const section = BRIEF.split('### 무기')[1].split('###')[0];
    const rows = section.split('\n').filter(l => /^\| [a-z]+ \|/.test(l) && !l.startsWith('| id |'));
    expect(rows.length).toBe(14);
    for (const row of rows) {
      const c = row.split('|').map(x => x.trim());
      const [id, name, emoji, , passive, evo] = c.slice(1);
      const w = WEAPON.get(id);
      expect(w, id).toBeDefined();
      expect(w!.name).toBe(name);
      expect(w!.icon).toBe(emoji);
      expect(w!.evolveWith).toBe(passive);
      const m = evo.match(/^([a-z_]+) \/ (.+?)(?: (\S+))?$/)!;
      expect(w!.evolvesTo).toBe(m[1]);
      const e = WEAPON.get(m[1])!;
      expect(e.evolved, m[1]).toBe(true);
      if (m[3] && isSingleEmoji(m[3])) { expect(e.name).toBe(m[2]); expect(e.icon).toBe(m[3]); }
      else expect(e.name).toBe(m[3] ? `${m[2]} ${m[3]}` : m[2]);
      const unlocked = c[7] === 'O';
      expect(w!.unlockedBy, id).toBe(unlocked ? undefined : `u_weapon_${id}`);
    }
  });

  it('passive table ids, names and emoji match', () => {
    const section = BRIEF.split('### 패시브')[1].split('###')[0];
    const rows = section.split('\n').filter(l => /^\| [a-z]+ \|/.test(l) && !l.startsWith('| id |'));
    expect(rows.length).toBe(15);
    expect(PASSIVES.length).toBe(15);
    for (const row of rows) {
      const [id, name, emoji, , unlock] = row.split('|').map(x => x.trim()).slice(1);
      const p = PASSIVE.get(id);
      expect(p, id).toBeDefined();
      expect(p!.name).toBe(name);
      expect(p!.icon).toBe(emoji);
      expect(p!.unlockedBy, id).toBe(unlock === 'O' ? undefined : `u_passive_${id}`);
    }
    expect(PASSIVE.get('multitask')!.maxLevel).toBe(2);
  });

  it('character table ids, names, start weapons and ultimates match', () => {
    const section = BRIEF.split('### 캐릭터')[1].split('###')[0];
    const rows = section.split('\n').filter(l => /^\| [a-z]+ \|/.test(l) && !l.startsWith('| id |'));
    expect(rows.length).toBe(8);
    expect(CHARACTERS.length).toBe(8);
    for (const row of rows) {
      const [id, name, title, weapon, ult, unlock] = row.split('|').map(x => x.trim()).slice(1);
      const ch = CHARACTERS.find(c => c.id === id);
      expect(ch, id).toBeDefined();
      expect(ch!.name).toBe(name);
      expect(ch!.title).toBe(title);
      expect(ch!.startWeapon).toBe(weapon);
      // 'rmrf / rm -rf / / rain' → id 'rmrf', 이름 'rm -rf /', 원형 'rain'
      const uid = ult.slice(0, ult.indexOf(' / '));
      const ukind = ult.slice(ult.lastIndexOf(' / ') + 3);
      const uname = ult.slice(ult.indexOf(' / ') + 3, ult.lastIndexOf(' / '));
      expect(ch!.ultimate).toBe(uid);
      const u = ULTIMATE.get(uid)!;
      expect(u, uid).toBeDefined();
      expect(u.name).toBe(uname);
      expect(u.kind).toBe(ukind);
      expect(ch!.unlockedBy, id).toBe(unlock === '기본' ? undefined : `u_character_${id}`);
    }
  });

  it('stage table ids, names and bosses match', () => {
    const section = BRIEF.split('### 스테이지')[1].split('###')[0];
    const rows = section.split('\n').filter(l => /^\| [a-z]+ \|/.test(l) && !l.startsWith('| id |'));
    expect(rows.length).toBe(4);
    expect(STAGES.length).toBe(4);
    for (const row of rows) {
      const [id, name, , mid, fin] = row.split('|').map(x => x.trim()).slice(1);
      const s = STAGES.find(x => x.id === id);
      expect(s, id).toBeDefined();
      expect(s!.name).toBe(name);
      // 'team_lead 팀장님 😒' → id, 이름(여러 단어 가능), 이모지
      const boss = (cell: string) => {
        const p = cell.split(' ');
        return { id: p[0], name: p.slice(1, -1).join(' '), emoji: p[p.length - 1] };
      };
      const mid0 = boss(mid), fin0 = boss(fin);
      const midId = mid0.id;
      expect(s!.finalBoss).toBe(fin0.id);
      for (const b of [mid0, fin0]) {
        const e = ENEMY.get(b.id)!;
        expect(e, b.id).toBeDefined();
        expect(e.boss, b.id).toBe(true);
        expect(e.name).toBe(b.name);
        expect(e.sprite).toBe(b.emoji);
      }
      expect(s!.events.some(e => e.kind === 'boss' && e.enemy === midId), `${id} mid boss event`).toBe(true);
      expect(s!.unlockedBy).toBe(id === 'office' ? undefined : `u_stage_${id}`);
    }
  });

  it('enemy roster ids, names and emoji match', () => {
    const section = BRIEF.split('### 적 로스터')[1].split('###')[0];
    const found = [...section.matchAll(/`([a-z_]+)` ([^`/]+?)(?= \/|\n|$| \()/g)];
    let checked = 0;
    for (const [, id, rest] of found) {
      const e = ENEMY.get(id);
      expect(e, id).toBeDefined();
      const parts = rest.trim().split(' ');
      const emoji = parts.find(p => isSingleEmoji(p) && /\p{Extended_Pictographic}/u.test(p));
      if (emoji) {
        expect(e!.sprite, id).toBe(emoji);
        const name = parts.slice(0, parts.indexOf(emoji)).join(' ');
        expect(e!.name, id).toBe(name);
      } else {
        const label = rest.match(/"(.+?)"/)?.[1];
        expect(e!.label, id).toBe(label);
        expect(e!.sprite, id).toBe('💬');
      }
      checked++;
    }
    expect(checked).toBe(49);
    expect(ENEMIES.length).toBeGreaterThanOrEqual(49);
  });

  it('lunch ids, names and emoji match', () => {
    const line = BRIEF.split('### 점심 메뉴')[1].split('\n').find(l => l.startsWith('`'))!;
    const items = [...line.matchAll(/`([a-z]+)` (.+?) (\S+?)(?: \/|$| \()/g)];
    expect(items.length).toBe(10);
    expect(LUNCHES.length).toBe(10);
    const locked = ['gimbap', 'dosirak', 'burger', 'sushi'];
    for (const [, id, name, emoji] of items) {
      const l = LUNCHES.find(x => x.id === id);
      expect(l, id).toBeDefined();
      expect(l!.name).toBe(name);
      expect(l!.icon).toBe(emoji);
      expect(l!.unlockedBy).toBe(locked.includes(id) ? `u_lunch_${id}` : undefined);
    }
  });
});

describe('cross references & conventions', () => {
  it('all sprites/icons are a single codepoint emoji (optionally + FE0F) or proc: key', () => {
    const bad: string[] = [];
    const chk = (where: string, s: string | undefined) => { if (s !== undefined && !isSingleEmoji(s)) bad.push(`${where}: ${s}`); };
    for (const w of WEAPONS) { chk(`weapon ${w.id} icon`, w.icon); chk(`weapon ${w.id} projectile`, w.projectile); }
    for (const p of PASSIVES) chk(`passive ${p.id}`, p.icon);
    for (const e of ENEMIES) chk(`enemy ${e.id}`, e.sprite);
    for (const s of STAGES) { chk(`stage ${s.id}`, s.icon); s.decor.forEach((d, i) => chk(`stage ${s.id} decor${i}`, d)); }
    for (const c of CHARACTERS) chk(`character ${c.id} accessory`, c.look.accessory);
    for (const u of ULTIMATE.values()) chk(`ultimate ${u.id}`, u.icon);
    for (const l of LUNCHES) chk(`lunch ${l.id}`, l.icon);
    for (const m of META_UPGRADES) chk(`meta ${m.id}`, m.icon);
    for (const a of ACHIEVEMENTS) chk(`achievement ${a.id}`, a.icon);
    for (const m of [...DAILY_MODIFIERS, ...BALANCE.heatLevels]) chk(`modifier ${m.id}`, m.icon);
    expect(bad).toEqual([]);
  });

  it('unlockedBy ids follow u_<kind>_<id>', () => {
    const bad: string[] = [];
    const chk = (kind: string, id: string, by?: string) => { if (by && by !== `u_${kind}_${id}`) bad.push(`${kind} ${id}: ${by}`); };
    for (const w of WEAPONS) chk('weapon', w.id, w.unlockedBy);
    for (const p of PASSIVES) chk('passive', p.id, p.unlockedBy);
    for (const c of CHARACTERS) chk('character', c.id, c.unlockedBy);
    for (const s of STAGES) chk('stage', s.id, s.unlockedBy);
    for (const l of LUNCHES) chk('lunch', l.id, l.unlockedBy);
    for (const m of META_UPGRADES) chk('meta', m.id, m.unlockedBy);
    expect(bad).toEqual([]);
  });

  it('every unlock reward targets content that is actually locked by that achievement', () => {
    const lockedBy = (kind: string, id: string): string | undefined => {
      switch (kind) {
        case 'weapon': return WEAPON.get(id)?.unlockedBy;
        case 'passive': return PASSIVE.get(id)?.unlockedBy;
        case 'character': return CHARACTERS.find(c => c.id === id)?.unlockedBy;
        case 'stage': return STAGES.find(s => s.id === id)?.unlockedBy;
        case 'lunch': return LUNCHES.find(l => l.id === id)?.unlockedBy;
        case 'meta': return META.get(id)?.unlockedBy;
        default: return undefined;
      }
    };
    const bad: string[] = [];
    for (const a of ACHIEVEMENTS) {
      const r = a.reward;
      if (r.kind === 'coins' || r.kind === 'feature') continue;
      if (lockedBy(r.kind, r.id!) !== a.id) bad.push(`${a.id} → ${r.kind}:${r.id} (locked by ${lockedBy(r.kind, r.id!)})`);
      if (a.id !== `u_${r.kind}_${r.id}`) bad.push(`${a.id}: id does not follow u_${r.kind}_${r.id}`);
    }
    for (const a of ACHIEVEMENTS.filter(a => a.reward.kind === 'feature')) {
      expect(a.id).toBe(`u_feature_${a.reward.id}`);
    }
    expect(bad).toEqual([]);
  });

  it('each feature key is unlocked by exactly one achievement', () => {
    for (const f of ['daily', 'heat', 'overtime']) {
      expect(ACHIEVEMENTS.filter(a => a.reward.kind === 'feature' && a.reward.id === f).length, f).toBe(1);
    }
  });

  it('starting kit exists: default characters, stage, weapons', () => {
    expect(CHARACTERS.filter(c => !c.unlockedBy).map(c => c.id).sort()).toEqual(['kim', 'park']);
    expect(STAGES.filter(s => !s.unlockedBy).map(s => s.id)).toEqual(['office']);
    expect(WEAPONS.filter(w => !w.evolved && !w.unlockedBy).length).toBe(6);
  });

  it('metaRanks "all maxed" achievement target equals total META maxRank', () => {
    const total = META_UPGRADES.reduce((s, m) => s + m.maxRank, 0);
    const maxTarget = Math.max(...ACHIEVEMENTS.filter(a => a.metric === 'metaRanks').map(a => a.target));
    expect(maxTarget).toBe(total);
  });

  it('coin achievements have positive amounts; ids are unique across achievements', () => {
    for (const a of ACHIEVEMENTS) if (a.reward.kind === 'coins') expect(a.reward.amount, a.id).toBeGreaterThan(0);
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('ATTENDANCE_REWARDS has length 7 with positive values', () => {
    expect(ATTENDANCE_REWARDS).toHaveLength(7);
    for (const v of ATTENDANCE_REWARDS) expect(v).toBeGreaterThan(0);
  });
});
