'use strict';
// ===================== 패시브 트리 (PoE 스타일) =====================
const PASSIVE_SMALL = {
  str: [
    { name: '생명력', mods: { inc_life: 0.06 } }, { name: '힘', mods: { str: 10 } }, { name: '물리 피해', mods: { inc_phys: 0.12 } },
    { name: '근접 피해', mods: { inc_melee: 0.12 } }, { name: '방어도', mods: { inc_armor: 0.18 } }, { name: '재생', mods: { inc_regen: 0.35 } },
    { name: '흡수', mods: { leech: 0.004 } }, { name: '광역 피해', mods: { inc_aoe_dmg: 0.10 } },
  ],
  dex: [
    { name: '민첩', mods: { dex: 10 } }, { name: '공격 속도', mods: { inc_aspd: 0.05 } }, { name: '투사체 피해', mods: { inc_proj: 0.12 } },
    { name: '회피', mods: { inc_eva: 0.20 } }, { name: '치명타 확률', mods: { inc_crit: 0.20 } }, { name: '이동 속도', mods: { inc_move: 0.03 } },
    { name: '투사체 속도', mods: { inc_proj_speed: 0.15 } }, { name: '치명타 배율', mods: { crit_multi: 0.10 } },
  ],
  int: [
    { name: '지능', mods: { int: 10 } }, { name: '주문 피해', mods: { inc_spell: 0.12 } }, { name: '시전 속도', mods: { inc_cspd: 0.05 } },
    { name: '원소 피해', mods: { inc_ele: 0.12 } }, { name: '최대 자원', mods: { inc_res: 0.10 } }, { name: '광역 범위', mods: { inc_aoe: 0.08 } },
    { name: '자원 재생', mods: { inc_res_regen: 0.25 } }, { name: '지속 피해', mods: { inc_dot: 0.15 } },
  ],
  any: [
    { name: '원소 저항', mods: { all_res: 6 } }, { name: '피해', mods: { inc_dmg: 0.08 } }, { name: '생명력', mods: { inc_life: 0.04 } }, { name: '속성', mods: { all_attr: 6 } },
  ],
};
const PASSIVE_NOTABLE = {
  str: [
    { name: '피의 계약', mods: { inc_life: 0.12, leech: 0.01 } },
    { name: '강철 피부', mods: { inc_armor: 0.40, phys_red: 0.04 } },
    { name: '학살자', mods: { inc_phys: 0.30, inc_aspd: 0.08 } },
    { name: '거인의 피', mods: { life: 60, str: 20 } },
    { name: '야수의 심장', mods: { inc_melee: 0.35, inc_aoe: 0.15 } },
    { name: '불사의 갈망', mods: { inc_regen: 1.0, life_regen: 5 } },
    { name: '달의 가호', mods: { inc_night: 0.12, inc_dmg: 0.10 } },
    { name: '가시 갑주', mods: { thorns: 40, inc_armor: 0.25 } },
  ],
  dex: [
    { name: '명사수', mods: { inc_proj: 0.30, pierce: 1 } },
    { name: '질풍', mods: { inc_move: 0.08, inc_aspd: 0.12 } },
    { name: '암살자', mods: { inc_crit: 0.50, crit_multi: 0.25 } },
    { name: '유령의 발걸음', mods: { inc_eva: 0.50, dodge_cd: 0.25 } },
    { name: '산탄 전문가', mods: { proj: 1, inc_proj: 0.15 } },
    { name: '태양의 가호', mods: { inc_day: 0.12, inc_dmg: 0.10 } },
    { name: '매의 눈', mods: { inc_proj_speed: 0.40, inc_proj: 0.20 } },
    { name: '약탈자', mods: { life_on_kill: 25, inc_aspd: 0.06 } },
  ],
  int: [
    { name: '원소의 대가', mods: { inc_ele: 0.35, inc_cspd: 0.10 } },
    { name: '심연의 지식', mods: { inc_spell: 0.30, inc_res: 0.25 } },
    { name: '광역 폭발', mods: { inc_aoe: 0.25, inc_aoe_dmg: 0.20 } },
    { name: '점화술사', mods: { inc_dot: 0.40, inc_fire: 0.20 } },
    { name: '서리의 심장', mods: { inc_cold: 0.30, inc_dmg: 0.10 } },
    { name: '폭풍의 목소리', mods: { inc_light: 0.30, inc_cspd: 0.10 } },
    { name: '황혼의 가호', mods: { inc_twilight: 0.15, inc_dmg: 0.10 } },
    { name: '정령의 인도', mods: { inc_minion: 0.50, inc_res_regen: 0.30 } },
  ],
};
const KEYSTONES = [
  { id: 'blood_magic', name: '혈맹', theme: 'str', mods: { inc_life: 0.25 }, flag: 'blood_magic', desc: '자원 대신 생명력으로 스킬을 사용한다. 최대 생명력 25% 증가.' },
  { id: 'unwavering', name: '불굴', theme: 'str', mods: { inc_armor: 0.5 }, flag: 'no_evasion', desc: '기절/둔화 면역, 방어도 50% 증가. 회피할 수 없다.' },
  { id: 'blood_moon', name: '붉은 달', theme: 'str', mods: { inc_night: 0.40, inc_day: -0.20 }, desc: '밤 보너스 +40%, 낮 보너스 -20%.' },
  { id: 'berserk', name: '폭주', theme: 'str', mods: {}, flag: 'berserk', desc: '처치 시 6초간 공격/시전 속도 +4% (최대 10중첩).' },
  { id: 'resolute', name: '무자비', theme: 'dex', mods: { more_dmg: 0.30 }, flag: 'no_crit', desc: '치명타를 할 수 없다. 모든 피해 30% 증폭.' },
  { id: 'glass_cannon', name: '유리 대포', theme: 'dex', mods: { more_dmg: 0.50, more_life: -0.30 }, desc: '모든 피해 50% 증폭, 최대 생명력 30% 감폭.' },
  { id: 'executioner', name: '죽음의 선고', theme: 'dex', mods: {}, flag: 'execute_30', desc: '생명력 30% 이하의 일반/마법 몬스터를 타격 시 즉사시킨다.' },
  { id: 'iron_reflexes', name: '강철 반사', theme: 'dex', mods: {}, flag: 'iron_reflexes', desc: '모든 회피가 방어도로 전환된다.' },
  { id: 'mom', name: '정신 무장', theme: 'int', mods: { inc_res: 0.20 }, flag: 'mom', desc: '받는 피해의 30%를 생명력 대신 자원으로 받는다.' },
  { id: 'ele_overload', name: '원소 과부하', theme: 'int', mods: { more_ele: 0.40 }, flag: 'ele_overload', desc: '치명타 배율이 100%로 고정. 원소 피해 40% 증폭.' },
  { id: 'ignite_avatar', name: '점화의 화신', theme: 'int', mods: { inc_dot: 0.50 }, flag: 'all_ignite', desc: '모든 타격이 점화를 유발할 수 있다. 지속 피해 50% 증가.' },
  { id: 'vaal_pact', name: '흡혈의 서약', theme: 'int', mods: {}, flag: 'vaal_pact', desc: '생명력 흡수량 2배. 자연 생명력 재생 없음.' },
];

const CLASS_ANGLE = { slayer: -Math.PI / 2, vampire: Math.PI * 5 / 6, ouster: Math.PI / 6 };
const CLASS_THEME = { slayer: 'dex', vampire: 'str', ouster: 'int' };

function buildTree() {
  const rng = mulberry32(20240915);
  const nodes = []; const byId = {};
  const add = n => { n.links = n.links || []; nodes.push(n); byId[n.id] = n; return n; };
  const link = (a, b) => { if (!a.links.includes(b.id)) a.links.push(b.id); if (!b.links.includes(a.id)) b.links.push(a.id); };
  const themeAt = ang => {
    // 가장 가까운 종족 각도의 테마, 경계 부근은 혼합
    let best = null, bd = 9;
    for (const c in CLASS_ANGLE) { const d = Math.abs(angleDiff(ang, CLASS_ANGLE[c])); if (d < bd) { bd = d; best = CLASS_THEME[c]; } }
    if (bd > Math.PI / 3 - 0.15 && rng() < 0.5) {
      // 이웃 테마
      const others = ['str', 'dex', 'int'].filter(t => t !== best); return others[Math.floor(rng() * 2)];
    }
    return best;
  };
  const rings = [
    { r: 62, n: 6 }, { r: 130, n: 12 }, { r: 205, n: 18 }, { r: 285, n: 24 }, { r: 370, n: 30 },
  ];
  const notableUsed = { str: 0, dex: 0, int: 0 };
  const smallCounter = {};
  const ringNodes = [];
  rings.forEach((ring, ri) => {
    const arr = [];
    for (let i = 0; i < ring.n; i++) {
      const ang = -Math.PI / 2 + (i / ring.n) * Math.PI * 2 + (ri > 0 ? (rng() - 0.5) * 0.12 : 0);
      const rr = ring.r + (ri > 0 ? (rng() - 0.5) * 22 : 0);
      const id = `r${ri}_${i}`;
      let node = { id, x: Math.cos(ang) * rr, y: Math.sin(ang) * rr, ring: ri, ang };
      // 종족 시작 노드
      let isStart = null;
      if (ri === 0) for (const c in CLASS_ANGLE) if (Math.abs(angleDiff(ang, CLASS_ANGLE[c])) < 0.05) isStart = c;
      if (isStart) {
        node.type = 'start'; node.cls = isStart; node.name = CLASSES[isStart].name + ' 시작점';
        node.mods = {}; node.desc = `${CLASSES[isStart].name}의 여정이 시작되는 곳.`;
      } else {
        const theme = ri <= 1 && rng() < 0.4 ? 'any' : themeAt(ang);
        const isNotable = (ri === 2 && i % 3 === 1) || (ri === 3 && i % 4 === 2) || (ri === 4 && i % 3 === 0);
        if (isNotable && theme !== 'any') {
          const pool = PASSIVE_NOTABLE[theme]; const def = pool[notableUsed[theme] % pool.length]; notableUsed[theme]++;
          node.type = 'notable'; node.name = def.name; node.mods = def.mods; node.theme = theme;
        } else {
          const t = theme === 'any' ? 'any' : theme;
          const pool = PASSIVE_SMALL[t];
          smallCounter[t] = (smallCounter[t] || 0) + 1;
          const def = pool[Math.floor(rng() * pool.length)];
          node.type = 'small'; node.name = def.name; node.mods = def.mods; node.theme = t;
        }
      }
      add(node); arr.push(node);
    }
    ringNodes.push(arr);
  });
  // 링 내부 연결
  ringNodes.forEach((arr, ri) => {
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      const a = arr[i], b = arr[(i + 1) % n];
      if (ri === 0 || rng() < 0.6) link(a, b);
    }
    if (ri > 0) {
      const prev = ringNodes[ri - 1];
      for (let i = 0; i < n; i++) {
        const j = Math.round(i * prev.length / n) % prev.length;
        link(arr[i], prev[j]);
      }
    }
  });
  // 키스톤 (외곽)
  const outer = ringNodes[ringNodes.length - 1];
  KEYSTONES.forEach((ks, k) => {
    // 테마 각도 근처 배치
    const base = CLASS_ANGLE[Object.keys(CLASS_THEME).find(c => CLASS_THEME[c] === ks.theme)];
    const idx = KEYSTONES.filter(x => x.theme === ks.theme).indexOf(ks);
    const ang = base + (idx - 1.5) * 0.42;
    const node = add({ id: 'ks_' + ks.id, x: Math.cos(ang) * 455, y: Math.sin(ang) * 455, ring: 5, ang, type: 'keystone', name: ks.name, mods: ks.mods, flag: ks.flag, desc: ks.desc, theme: ks.theme, ks: ks.id });
    // 가장 가까운 외곽 노드에 연결
    let best = null, bd = 1e9;
    for (const o of outer) { const d = dist(o.x, o.y, node.x, node.y); if (d < bd) { bd = d; best = o; } }
    link(node, best);
  });
  // 설명 생성
  for (const n of nodes) if (!n.desc) n.desc = Object.entries(n.mods).map(([k, v]) => modText({ k, v })).join(', ');
  return { nodes, byId };
}
const TREE = buildTree();

const Passives = {
  startNode(cls) { return TREE.nodes.find(n => n.type === 'start' && n.cls === cls).id; },
  pointsAvailable(p) { return (p.level - 1) + (p.bonusPoints || 0) - (p.passives.size - 1); },
  canAllocate(p, id) {
    const n = TREE.byId[id]; if (!n || p.passives.has(id) || n.type === 'start') return false;
    if (this.pointsAvailable(p) <= 0) return false;
    return n.links.some(l => p.passives.has(l));
  },
  allocate(p, id) { if (!this.canAllocate(p, id)) return false; p.passives.add(id); return true; },
  canRefund(p, id) {
    const n = TREE.byId[id]; if (!n || !p.passives.has(id) || n.type === 'start') return false;
    // 제거 후 시작점에서 연결성 유지되는지 검사
    const set = new Set(p.passives); set.delete(id);
    const start = this.startNode(p.cls);
    const seen = new Set([start]); const q = [start];
    while (q.length) { const c = q.pop(); for (const l of TREE.byId[c].links) if (set.has(l) && !seen.has(l)) { seen.add(l); q.push(l); } }
    return seen.size === set.size;
  },
  refund(p, id) { if (!this.canRefund(p, id)) return false; p.passives.delete(id); return true; },
  mods(p) {
    const out = {}; const flags = new Set();
    for (const id of p.passives) {
      const n = TREE.byId[id]; if (!n) continue;
      for (const k in n.mods) out[k] = (out[k] || 0) + n.mods[k];
      if (n.flag) flags.add(n.flag);
    }
    return { mods: out, flags };
  },
  nodeTooltipHTML(n, p) {
    const col = n.type === 'keystone' ? '#ff7eb6' : n.type === 'notable' ? '#ffd23f' : n.type === 'start' ? '#ffffff' : '#c8c8c8';
    let h = `<div class="tt-name" style="color:${col}">${esc(n.name)}</div>`;
    h += `<div class="tt-sub">${{ small: '일반 노드', notable: '주요 노드', keystone: '키스톤', start: '시작점' }[n.type]}</div>`;
    h += `<div class="tt-mods">${esc(n.desc)}</div>`;
    if (p) {
      if (p.passives.has(n.id)) h += `<div class="tt-hint">할당됨${this.canRefund(p, n.id) ? ' · 우클릭: 후회의 오브로 환불' : ''}</div>`;
      else if (this.canAllocate(p, n.id)) h += `<div class="tt-hint" style="color:#9fe1a5">클릭하여 할당</div>`;
      else h += `<div class="tt-hint">연결된 노드가 필요하거나 포인트 부족</div>`;
    }
    return h;
  },
};
