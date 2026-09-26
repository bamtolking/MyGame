// 화면 HTML 생성. 모든 텍스트는 esc()로 이스케이프한다 (AI가 만든 내용도 같은 경로로 그린다).
import { COMPOUND_CATALOG, TAGS, TAG_IDS, type CompoundId } from '../data/catalog';
import { COMPOUNDS, COMPOUND_BY_ID } from '../data/compounds';
import { FOODS, FOOD_BY_ID } from '../data/foods';
import { NUTRIENTS, NUTRIENT_BY_ID, type NutrientId } from '../data/nutrients';
import { COMPOUND_FAQ, FOOD_FAQ } from '../data/faq';
import type { Compound, Effect, Evidence, Food, FoodCategory, Nutrients, Pathway, QA, Step, TagId } from '../data/types';
import type { AiCompoundRef, AiFood } from '../lib/ai';
import { EFFECT_LABEL, EVIDENCE_HELP, EVIDENCE_LABEL, EVIDENCE_LEVEL, VERDICT_LABEL, esc, fmtNum, pct } from '../lib/format';
import { normalize, type FaqHit, type Hit } from '../lib/search';

export const CATEGORY_ORDER: FoodCategory[] = ['채소', '과일', '곡물', '콩·견과·씨앗', '기름·지방', '육류·달걀', '해산물·해조류', '유제품', '발효식품', '향신료·차·음료', '가공식품·기호식품'];

/** 성분 id → 그 성분을 가진 식품들 */
export const FOODS_BY_COMPOUND = new Map<CompoundId, { food: Food; amount?: string }[]>();
for (const f of FOODS) for (const c of f.compounds) {
  const list = FOODS_BY_COMPOUND.get(c.id) ?? [];
  list.push({ food: f, amount: c.amount });
  FOODS_BY_COMPOUND.set(c.id, list);
}

/**
 * 앱 안 이동은 href 대신 data-go로 처리한다. claude.ai 뷰어처럼 페이지가 액자 안에 있으면
 * 링크 클릭을 호스트가 가로챌 수 있어서, 이동은 전부 app.ts가 직접 한다.
 */
export const go = (token: string) => `data-go="${esc(token)}" role="link" tabindex="0"`;
const foodGo = (f: { id: string }, tab?: string) => go(`f.${f.id}${tab ? '.' + tab : ''}`);
const compoundGo = (id: CompoundId, tab?: string) => go(`c.${id}${tab ? '.' + tab : ''}`);

// ---------- 작은 부품 ----------

export function evidenceBadge(ev: Evidence): string {
  const lv = EVIDENCE_LEVEL[ev];
  const dots = ev === 'contested' ? '<i class="dot split"></i>' : [1, 2, 3, 4].map((i) => `<i class="dot${i <= lv ? ' on' : ''}"></i>`).join('');
  return `<a class="ev ev-${ev}" ${go('about')} title="${esc(EVIDENCE_HELP[ev])}"><span class="dots" aria-hidden="true">${dots}</span>${esc(EVIDENCE_LABEL[ev])}</a>`;
}

export const effectPill = (e: Effect) => `<span class="pill fx-${e}">${esc(EFFECT_LABEL[e])}</span>`;

function pathwayHtml(p: Pathway, open = true): string {
  const steps = p.steps
    .map((s, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><div><b>${esc(s.title)}</b><p>${esc(s.body)}</p></div></li>`)
    .join('');
  return `<details class="pathway"${open ? ' open' : ''}>
    <summary><span class="pw-title">${esc(p.title)}</span>${evidenceBadge(p.evidence)}</summary>
    <ol class="path">${steps}</ol>
    ${p.note ? `<p class="pw-note">${esc(p.note)}</p>` : ''}
  </details>`;
}

function listHtml(items: string[] | undefined, cls = 'bullets'): string {
  if (!items?.length) return '';
  return `<ul class="${cls}">${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
}

function tipsHtml(steps: Step[]): string {
  return `<div class="tips">${steps.map((s) => `<div class="tip"><h4>${esc(s.title)}</h4><p>${esc(s.body)}</p></div>`).join('')}</div>`;
}

function mythsHtml(myths: { claim: string; truth: string }[] | undefined): string {
  if (!myths?.length) return '';
  return `<div class="myths">${myths
    .map((m) => `<div class="myth"><p class="m-claim"><span class="tag-k">흔한 주장</span>${esc(m.claim)}</p><p class="m-truth"><span class="tag-k">근거로 보면</span>${esc(m.truth)}</p></div>`)
    .join('')}</div>`;
}

// ---------- 영양정보 ----------

const LABEL_MAIN: NutrientId[] = ['sodium', 'carb', 'sugar', 'fiber', 'fat', 'transFat', 'satFat', 'cholesterol', 'protein'];
const LABEL_FATS: NutrientId[] = ['mufa', 'pufa', 'la', 'ala', 'epaDha'];
const POSITIVE: NutrientId[] = ['fiber', 'protein', 'potassium', 'calcium', 'magnesium', 'iron', 'zinc', 'selenium', 'iodine', 'vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'vitB1', 'vitB2', 'vitB6', 'folate', 'vitB12', 'ala', 'epaDha'];

function claimBadge(id: NutrientId, per100: number): string {
  const d = NUTRIENT_BY_ID[id];
  if (!d.dv || !POSITIVE.includes(id)) return '';
  const p = (per100 / d.dv) * 100;
  // 식약처 영양강조표시: 100g당 기준치의 30% 이상 "풍부", 15% 이상 "함유"
  if (p >= 30) return '<span class="claim rich">풍부</span>';
  if (p >= 15) return '<span class="claim has">함유</span>';
  return '';
}

function labelRow(id: NutrientId, n: Nutrients, grams: number): string {
  const v100 = n[id];
  if (v100 == null) return '';
  const d = NUTRIENT_BY_ID[id];
  const v = (v100 * grams) / 100;
  const p = d.dv ? pct(v, d.dv) : null;
  const bar = p != null ? `<span class="bar${d.limit ? ' lim' : ''}"><i style="width:${Math.min(100, p)}%"></i></span>` : '<span class="bar none"></span>';
  return `<div class="lrow${d.sub ? ' sub' : ''}">
    <span class="lname">${esc(d.name)}${claimBadge(id, v100)}</span>
    <span class="lval">${fmtNum(v)}${d.unit}</span>
    <span class="lpct">${p != null ? `${p}%` : ''}</span>
    ${bar}
  </div>`;
}

export function nutritionHtml(food: { nutrients: Nutrients; basis: string; serving: { label: string; grams: number } }, grams: number): string {
  const n = food.nutrients;
  const kcal = ((n.kcal ?? 0) * grams) / 100;
  const main = LABEL_MAIN.map((id) => labelRow(id, n, grams)).join('');
  const fats = LABEL_FATS.map((id) => labelRow(id, n, grams)).join('');
  const micro = NUTRIENTS.filter((d) => (d.group === 'vitamin' || d.group === 'mineral') && d.id !== 'sodium' && n[d.id] != null)
    .sort((a, b) => ((n[b.id] ?? 0) / (b.dv ?? 1e9)) - ((n[a.id] ?? 0) / (a.dv ?? 1e9)))
    .map((d) => labelRow(d.id, n, grams))
    .join('');

  const c = Math.max(0, (n.carb ?? 0) - (n.fiber ?? 0)) * 4, pr = (n.protein ?? 0) * 4, f = (n.fat ?? 0) * 9;
  const tot = c + pr + f;
  const energy = tot > 3
    ? `<div class="energy" aria-label="열량 구성">
        <div class="ebar"><i class="e-c" style="width:${(c / tot) * 100}%"></i><i class="e-p" style="width:${(pr / tot) * 100}%"></i><i class="e-f" style="width:${(f / tot) * 100}%"></i></div>
        <div class="elegend"><span><i class="e-c"></i>탄수화물 ${Math.round((c / tot) * 100)}%</span><span><i class="e-p"></i>단백질 ${Math.round((pr / tot) * 100)}%</span><span><i class="e-f"></i>지방 ${Math.round((f / tot) * 100)}%</span></div>
      </div>`
    : '';

  const is100 = grams === 100;
  return `<div class="nut-toggle" role="group" aria-label="기준 양">
      <button type="button" class="seg${is100 ? ' on' : ''}" data-grams="100" aria-pressed="${is100}">100g</button>
      ${food.serving.grams !== 100 ? `<button type="button" class="seg${!is100 ? ' on' : ''}" data-grams="${food.serving.grams}" aria-pressed="${!is100}">${esc(food.serving.label)}</button>` : ''}
    </div>
    ${energy}
    <div class="label">
      <div class="label-head">
        <span class="label-title">영양정보</span>
        <span class="label-size">총 내용량 ${fmtNum(grams)}g</span>
        <span class="kcal"><b>${fmtNum(kcal)}</b>kcal</span>
      </div>
      <p class="label-basis">수치 기준: ${esc(food.basis)}</p>
      <div class="label-cap"><span>총 내용량당</span><span>1일 영양성분 기준치에 대한 비율</span></div>
      ${main}
      ${fats ? `<div class="label-sec">지방산 구성</div>${fats}` : ''}
      ${micro ? `<div class="label-sec">비타민·무기질 <small>기준치 대비 많은 순</small></div>${micro}` : ''}
      <p class="label-foot">1일 영양성분 기준치에 대한 비율(%)은 2,000kcal 기준이므로 개인의 필요 열량에 따라 다를 수 있습니다. "함유"·"풍부"는 100g당 기준치의 15%·30% 이상일 때 붙였습니다.</p>
    </div>`;
}

// ---------- 식품 ----------

function compoundCard(ref: { id: CompoundId; amount?: string; role: string; effect?: Effect }, open: boolean): string {
  const c = COMPOUND_BY_ID.get(ref.id);
  const name = c?.name ?? COMPOUND_CATALOG[ref.id];
  if (!c) {
    return `<article class="cc"><header><a class="cc-name" ${compoundGo(ref.id)}>${esc(name)}</a></header><p class="cc-role">${esc(ref.role)}</p></article>`;
  }
  const first = c.pathways[0];
  const effect = ref.effect ?? c.effect;
  return `<article class="cc fx-edge-${effect}">
    <header>
      <a class="cc-name" ${compoundGo(c.id)}>${esc(name)}</a>
      ${effectPill(effect)}
    </header>
    ${ref.amount ? `<p class="cc-amt">${esc(ref.amount)}</p>` : ''}
    <p class="cc-role">${esc(ref.role)}</p>
    ${pathwayHtml(first, open)}
    ${c.pathways.length > 1 ? `<a class="more" ${compoundGo(c.id)}>다른 경로 ${c.pathways.length - 1}개와 근거 요약 보기 →</a>` : `<a class="more" ${compoundGo(c.id, 'evi')}>근거 요약과 참고자료 보기 →</a>`}
  </article>`;
}

function aiCompoundCard(ref: AiCompoundRef, open: boolean): string {
  if (ref.id && COMPOUND_BY_ID.has(ref.id)) return compoundCard({ id: ref.id, amount: ref.amount, role: ref.role }, open);
  return `<article class="cc fx-edge-${ref.effect ?? 'mixed'}">
    <header><span class="cc-name">${esc(ref.name)}</span>${effectPill(ref.effect ?? 'mixed')}</header>
    ${ref.amount ? `<p class="cc-amt">${esc(ref.amount)}</p>` : ''}
    <p class="cc-role">${esc(ref.role)}</p>
    ${ref.pathway ? pathwayHtml(ref.pathway, open) : ''}
  </article>`;
}

/** 탭 막대. 누르면 app.ts가 해당 패널만 보여 준다. */
function tabsHtml(items: [string, string][], active: string): string {
  return `<div class="tabs" role="tablist" aria-label="이 페이지 항목">${items
    .map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="panel-${id}" aria-selected="${id === active}">${label}</button>`)
    .join('')}</div>`;
}

const panel = (id: string, active: string, body: string) =>
  `<section class="panel" id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}"${id === active ? '' : ' hidden'}>${body}</section>`;

/** 자주 묻는 질문. openIndex가 있으면 그 질문을 펼쳐 둔다. */
export function faqHtml(list: QA[], openIndex = -1): string {
  if (!list.length) return '<p class="muted">아직 정리된 질문이 없어요.</p>';
  return `<div class="faq-tools">
      <label class="sr" for="faq-filter">질문 안에서 찾기</label>
      <input id="faq-filter" type="search" placeholder="질문 안에서 찾기 (예: 임산부, 하루, 약)" autocomplete="off" />
      <button type="button" class="btn ghost small" data-faq-toggle>모두 펼치기</button>
    </div>
    <p class="faq-empty muted" hidden>찾는 질문이 없어요. 위 검색창에서 앱 전체를 찾아보세요.</p>
    <div class="faq">${list
      .map(
        (x, i) => `<details class="qa" id="qa-${i}" data-text="${esc(normalize(x.q + ' ' + x.a))}"${i === openIndex ? ' open' : ''}>
          <summary><span class="qa-q">${esc(x.q)}</span></summary>
          <div class="qa-a">${answerHtml(x.a)}</div>
        </details>`,
      )
      .join('')}</div>`;
}

type FoodLike = Pick<Food, 'name' | 'en' | 'emoji' | 'category' | 'summary' | 'verdict' | 'basis' | 'serving' | 'nutrients' | 'howToEat' | 'pairings' | 'cautions' | 'myths'>;

export const FOOD_TABS = ['nut', 'cmp', 'eat', 'warn', 'faq'] as const;

function foodBody(f: FoodLike, compoundsHtml: string, faq: QA[], grams: number, tab: string, openQa: number, extraTop = ''): string {
  const hasCaution = !!(f.cautions?.length || f.myths?.length);
  const good = f.pairings?.good?.filter(Boolean) ?? [];
  const avoid = f.pairings?.avoid?.filter(Boolean) ?? [];
  const tabs: [string, string][] = [['nut', '영양성분'], ['cmp', '성분·기전'], ['eat', '먹는 법']];
  if (hasCaution) tabs.push(['warn', '주의·오해']);
  if (faq.length) tabs.push(['faq', `질문 <small>${faq.length}</small>`]);
  const active = tabs.some(([id]) => id === tab) ? tab : 'nut';
  return `<article class="page food">
    <header class="food-head">
      <div class="specimen" aria-hidden="true">${esc(f.emoji)}</div>
      <div class="fh-text">
        <p class="eyebrow">${esc(f.category)}${f.en ? ` · <span class="mono">${esc(f.en)}</span>` : ''}</p>
        <h1>${esc(f.name)}</h1>
        <p class="verdict v-${f.verdict.tone}"><b>${esc(VERDICT_LABEL[f.verdict.tone])}</b>${f.verdict.text ? ` ${esc(f.verdict.text)}` : ''}</p>
      </div>
    </header>
    ${extraTop}
    <p class="lede">${esc(f.summary)}</p>
    ${tabsHtml(tabs, active)}

    ${panel('nut', active, `<h2>영양성분</h2><div class="nut" data-nut>${nutritionHtml(f, grams)}</div>`)}

    ${panel('cmp', active, `<h2>핵심 성분과 몸속 작용</h2>
      <p class="muted">성분마다 몸에 들어와서 일어나는 일을 단계별로 보여줍니다. 성분 이름을 누르면 다른 경로와 근거 요약을 볼 수 있어요.</p>
      <div class="cclist">${compoundsHtml}</div>`)}

    ${panel('eat', active, `<h2>먹는 법</h2>
      ${tipsHtml(f.howToEat)}
      ${good.length || avoid.length ? `<div class="pairs">
        ${good.length ? `<div class="pair good"><h3>함께 먹으면 좋아요</h3>${listHtml(good)}</div>` : ''}
        ${avoid.length ? `<div class="pair avoid"><h3>피하면 좋아요</h3>${listHtml(avoid)}</div>` : ''}
      </div>` : ''}`)}

    ${hasCaution ? panel('warn', active, `<h2>주의할 점과 흔한 오해</h2>
      ${f.cautions?.length ? `<div class="caution-box">${listHtml(f.cautions)}</div>` : ''}
      ${mythsHtml(f.myths)}`) : ''}

    ${faq.length ? panel('faq', active, `<h2>자주 묻는 질문</h2>${faqHtml(faq, active === 'faq' ? openQa : -1)}`) : ''}
  </article>`;
}

export function foodView(f: Food, grams: number, tab = 'nut', openQa = -1): string {
  const compounds = f.compounds.map((c, i) => compoundCard(c, i === 0)).join('');
  return `${foodBody(f, compounds, FOOD_FAQ[f.id] ?? [], grams, tab, openQa)}${sourceNote()}`;
}

export function aiFoodView(f: AiFood, grams: number, tab = 'nut', openQa = -1): string {
  const banner = `<div class="ai-banner">
    <b>AI가 작성한 분석</b>
    <p>DB에 없는 식품이라 Claude가 이 앱의 형식에 맞춰 작성했어요. 검수된 항목보다 수치와 근거 표기가 부정확할 수 있습니다. 이 브라우저에만 저장됩니다.</p>
    <div class="row"><button type="button" class="btn ghost" data-ai-refresh="${esc(f.query)}">다시 분석</button><button type="button" class="btn ghost" data-ai-delete="${esc(f.key)}">저장 삭제</button></div>
  </div>`;
  const compounds = f.compounds.map((c, i) => aiCompoundCard(c, i === 0)).join('');
  return foodBody(f, compounds, f.faq ?? [], grams, tab, openQa, banner);
}

// ---------- 성분 ----------

export const COMPOUND_TABS = ['how', 'evi', 'foods', 'faq'] as const;

export function compoundView(c: Compound, tab = 'how', openQa = -1): string {
  const foods = FOODS_BY_COMPOUND.get(c.id) ?? [];
  const faq = COMPOUND_FAQ[c.id] ?? [];
  const tabs: [string, string][] = [['how', '몸속 작용'], ['evi', '근거·사실']];
  if (foods.length) tabs.push(['foods', `식품 <small>${foods.length}</small>`]);
  if (faq.length) tabs.push(['faq', `질문 <small>${faq.length}</small>`]);
  const active = tabs.some(([id]) => id === tab) ? tab : 'how';
  return `<article class="page compound">
    <header class="cmp-head">
      <p class="eyebrow">${esc(c.kind)} · <span class="mono">${esc(c.en)}</span></p>
      <h1>${esc(c.name)}</h1>
      <div class="row wrap">${effectPill(c.effect)}${c.tags.map((t) => `<a class="chip small" ${go(`t.${t}`)}>${esc(TAGS[t])}</a>`).join('')}</div>
    </header>
    <p class="lede">${esc(c.summary)}</p>
    ${tabsHtml(tabs, active)}

    ${panel('how', active, `<h2>몸속에서 일어나는 일</h2><div class="pathways">${c.pathways.map((p) => pathwayHtml(p, true)).join('')}</div>`)}

    ${panel('evi', active, `<h2>근거는 어디까지인가</h2>
      <div class="evidence-box"><p>${esc(c.evidenceNote)}</p></div>
      ${c.facts?.length ? `<h3>알아두면 좋은 사실</h3>${listHtml(c.facts)}` : ''}
      ${c.cautions?.length ? `<h3>주의</h3><div class="caution-box">${listHtml(c.cautions)}</div>` : ''}
      ${c.refs?.length ? `<h3>참고자료</h3>${listHtml(c.refs, 'reflist')}` : ''}`)}

    ${foods.length ? panel('foods', active, `<h2>이 성분이 들어 있는 식품</h2>
      <div class="foodgrid">${foods.map(({ food, amount }) => `<a class="fcard" ${foodGo(food, 'cmp')}><span class="fe" aria-hidden="true">${esc(food.emoji)}</span><span><b>${esc(food.name)}</b>${amount ? `<small>${esc(amount)}</small>` : ''}</span></a>`).join('')}</div>`) : ''}

    ${faq.length ? panel('faq', active, `<h2>자주 묻는 질문</h2>${faqHtml(faq, active === 'faq' ? openQa : -1)}`) : ''}
  </article>`;
}

// ---------- 태그·분류·검색 ----------

export function tagView(t: TagId): string {
  const cs = COMPOUNDS.filter((c) => c.tags.includes(t));
  const foodScore = new Map<string, number>();
  for (const c of cs) for (const { food } of FOODS_BY_COMPOUND.get(c.id) ?? []) foodScore.set(food.id, (foodScore.get(food.id) ?? 0) + 1);
  const foods = [...foodScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([id]) => FOOD_BY_ID.get(id)!);
  const risk = t === 'inflammation-risk' || t === 'oxidative-risk' || t === 'autoimmune';
  return `<article class="page">
    <p class="eyebrow">작용별로 보기</p>
    <h1>${esc(TAGS[t])}</h1>
    <p class="lede">${risk ? `${esc(TAGS[t])}과 관련해 이야기되는 성분입니다. 근거 수준이 제각각이니 경로별 표시를 함께 보세요.` : `${esc(TAGS[t])}에 관여하는 성분과, 그 성분이 들어 있는 식품입니다.`}</p>
    <section class="sec"><h2>성분 ${cs.length}개</h2>
      <div class="clist">${cs.map((c) => compoundRow(c)).join('')}</div>
    </section>
    ${foods.length ? `<section class="sec"><h2>${risk ? '관련 식품' : '이런 성분이 많은 식품'}</h2><div class="foodgrid">${foods.map((f) => foodChip(f)).join('')}</div></section>` : ''}
  </article>`;
}

function firstSentence(s: string): string {
  const i = s.search(/\.\s/);
  return i > 0 ? s.slice(0, i + 1) : s;
}

function compoundRow(c: Compound): string {
  return `<a class="crow" ${compoundGo(c.id)}><span class="crow-main"><b>${esc(c.name)}</b><small>${esc(firstSentence(c.summary))}</small></span><span class="crow-side">${effectPill(c.effect)}</span></a>`;
}

function foodChip(f: Food): string {
  return `<a class="fcard" ${foodGo(f)}><span class="fe" aria-hidden="true">${esc(f.emoji)}</span><span><b>${esc(f.name)}</b><small>${esc(VERDICT_LABEL[f.verdict.tone])}</small></span></a>`;
}

function faqHitRow(h: FaqHit): string {
  const food = h.kind === 'food' ? FOOD_BY_ID.get(h.id) : undefined;
  const name = food ? food.name : COMPOUND_BY_ID.get(h.id as CompoundId)?.name ?? h.id;
  const token = `${h.kind === 'food' ? 'f' : 'c'}.${h.id}.faq.${h.index}`;
  return `<a class="crow" ${go(token)}><span class="crow-main"><b>${esc(h.q)}</b><small>${esc(name)}</small></span></a>`;
}

export function searchView(q: string, hits: Hit[], faqHits: FaqHit[], aiAvailable: boolean, saved: AiFood | undefined): string {
  const foods = hits.filter((h) => h.type === 'food').map((h) => FOOD_BY_ID.get(h.id)!).filter(Boolean);
  const comps = hits.filter((h) => h.type === 'compound').map((h) => COMPOUND_BY_ID.get(h.id as CompoundId)!).filter(Boolean);
  const tags = hits.filter((h) => h.type === 'tag').map((h) => h.id as TagId);
  const strong = hits.some((h) => h.score >= 80);
  const aiBox = saved
    ? `<a class="ai-cta saved" ${go(`a.${encodeURIComponent(saved.key)}`)}><b>저장된 AI 분석: ${esc(saved.name)}</b><span>이전에 분석한 결과를 엽니다 →</span></a>`
    : aiAvailable
      ? `<div class="ai-cta"><div><b>“${esc(q)}” AI로 분석하기</b><span>DB에 ${strong ? '비슷한 항목이 있지만, 이 이름' : '없는 식품이라도'} 그대로 영양성분·성분·기전을 같은 형식으로 정리합니다. 30초~1분 걸려요.</span></div><button type="button" class="btn" data-ai-analyze="${esc(q)}">분석하기</button></div>`
      : !hits.length && !faqHits.length
        ? `<div class="empty"><b>아직 DB에 없는 식품이에요.</b><p>지금은 ${FOODS.length}가지 식품과 ${COMPOUNDS.length}가지 성분을 담고 있어요. claude.ai에서 이 앱을 열면 DB에 없는 식품도 AI로 분석할 수 있습니다.</p></div>`
        : '';
  return `<article class="page">
    <p class="eyebrow">검색</p>
    <h1 class="q">“${esc(q)}”</h1>
    ${foods.length ? `<section class="sec"><h2>식품</h2><div class="foodgrid">${foods.map((f) => foodChip(f)).join('')}</div></section>` : ''}
    ${comps.length ? `<section class="sec"><h2>성분</h2><div class="clist">${comps.map((c) => compoundRow(c)).join('')}</div></section>` : ''}
    ${tags.length ? `<section class="sec"><h2>작용</h2><div class="row wrap">${tags.map((t) => `<a class="chip" ${go(`t.${t}`)}>${esc(TAGS[t])}</a>`).join('')}</div></section>` : ''}
    ${faqHits.length ? `<section class="sec"><h2>질문 ${faqHits.length >= 40 ? '40개 이상' : `${faqHits.length}개`}</h2><div class="clist">${faqHits.map(faqHitRow).join('')}</div></section>` : ''}
    <section class="sec" data-ai-slot>${aiBox}</section>
  </article>`;
}

export function categoryView(cat: FoodCategory): string {
  const foods = FOODS.filter((f) => f.category === cat);
  return `<article class="page"><p class="eyebrow">식품 분류</p><h1>${esc(cat)}</h1>
    <div class="foodgrid">${foods.map((f) => foodChip(f)).join('')}</div></article>`;
}

// ---------- 홈·안내 ----------

const FEATURED: { food: string; compound: CompoundId; q: string; tab: string }[] = [
  { food: 'blueberry', compound: 'anthocyanin', q: '안토시아닌은 활성산소를 정말 없앨까?', tab: 'warn' },
  { food: 'kidney-bean', compound: 'lectin', q: '렉틴이 자가면역을 일으킨다는 말, 어디까지 사실일까?', tab: 'warn' },
  { food: 'canola-oil', compound: 'oxidized-lipids', q: '식물성 기름이 몸에서 염증을 만드는 조건', tab: 'warn' },
  { food: 'spinach', compound: 'oxalate', q: '시금치 영양은 살리고 옥살산은 줄이는 법', tab: 'eat' },
];
const POPULAR_FOODS = ['egg', 'coffee', 'kimchi', 'white-rice', 'alcohol', 'milk', 'tomato', 'green-tea'];

export function homeView(recent: Food[], aiSaved: AiFood[]): string {
  const featured = FEATURED.filter((x) => FOOD_BY_ID.has(x.food))
    .map((x) => {
      const f = FOOD_BY_ID.get(x.food)!;
      const c = COMPOUND_BY_ID.get(x.compound);
      return `<a class="feat" ${foodGo(f, x.tab)}><span class="fe" aria-hidden="true">${esc(f.emoji)}</span><span class="feat-q">${esc(x.q)}</span><span class="feat-meta">${esc(f.name)}${c ? ` · ${esc(c.name)}` : ''}</span></a>`;
    })
    .join('');
  const popular = POPULAR_FOODS.filter((id) => FOOD_FAQ[id]?.length && FOOD_BY_ID.has(id)).map((id) =>
    faqHitRow({ kind: 'food', id, index: 0, q: FOOD_FAQ[id][0].q, score: 0 }),
  );
  const tagCounts = TAG_IDS.map((t) => [t, COMPOUNDS.filter((c) => c.tags.includes(t)).length] as const).filter(([, n]) => n > 0);
  const cats = CATEGORY_ORDER.map((cat) => [cat, FOODS.filter((f) => f.category === cat)] as const).filter(([, fs]) => fs.length);
  return `<article class="page home">
    <section class="hero">
      <p class="eyebrow">기능의학 식품 사전</p>
      <h1>먹은 음식이<br />몸속에서 하는 일</h1>
      <p class="lede">음식을 검색하면 영양성분, 핵심 성분, 그 성분이 몸에 들어와 작용하는 과정을 단계별로 보여줍니다. 모든 설명에는 근거 수준을 표시했어요.</p>
      <div class="legend">${(['strong', 'moderate', 'limited', 'contested'] as Evidence[]).map((e) => evidenceBadge(e)).join('')}</div>
    </section>

    ${recent.length || aiSaved.length ? `<section class="sec"><h2>최근 본 식품</h2><div class="row wrap">${recent.map((f) => `<a class="chip" ${foodGo(f)}>${esc(f.emoji)} ${esc(f.name)}</a>`).join('')}${aiSaved.map((a) => `<a class="chip ai" ${go(`a.${encodeURIComponent(a.key)}`)}>${esc(a.emoji)} ${esc(a.name)} <small>AI</small></a>`).join('')}</div></section>` : ''}

    <section class="sec">
      <h2>이런 걸 알 수 있어요</h2>
      <div class="feats">${featured}</div>
    </section>

    ${popular.length ? `<section class="sec">
      <h2>많이 묻는 질문</h2>
      <p class="muted">모든 식품·성분에 자주 묻는 질문과 답을 정리해 두었어요. 위 검색창에 "임산부", "공복", "하루 얼마나"처럼 질문을 적어도 찾아 줍니다.</p>
      <div class="clist">${popular.join('')}</div>
    </section>` : ''}

    <section class="sec">
      <h2>작용별로 찾기</h2>
      <div class="row wrap">${tagCounts.map(([t, n]) => `<a class="chip${t === 'inflammation-risk' || t === 'oxidative-risk' || t === 'autoimmune' ? ' risk' : ''}" ${go(`t.${t}`)}>${esc(TAGS[t])} <small>${n}</small></a>`).join('')}</div>
    </section>

    <section class="sec">
      <h2>식품 ${FOODS.length}가지</h2>
      <div class="cats">${cats
        .map(([cat, fs]) => `<div class="cat"><h3><a ${go(`k.${CATEGORY_ORDER.indexOf(cat)}`)}>${esc(cat)}</a></h3><p>${fs.map((f) => `<a ${foodGo(f)}>${esc(f.name)}</a>`).join('<span aria-hidden="true"> · </span>')}</p></div>`)
        .join('')}</div>
    </section>

    <section class="sec">
      <h2>성분 사전 ${COMPOUNDS.length}가지</h2>
      <p class="muted">식품을 거치지 않고 성분부터 찾아볼 수도 있어요. <a ${go('index')}>성분 전체 보기 →</a></p>
    </section>
  </article>`;
}

export function indexView(): string {
  const kinds = [...new Set(COMPOUNDS.map((c) => c.kind))];
  return `<article class="page">
    <p class="eyebrow">성분 사전</p>
    <h1>성분 전체</h1>
    ${kinds.map((k) => `<section class="sec"><h2>${esc(k)}</h2><div class="clist">${COMPOUNDS.filter((c) => c.kind === k).map((c) => compoundRow(c)).join('')}</div></section>`).join('')}
  </article>`;
}

export function aboutView(): string {
  return `<article class="page about">
    <p class="eyebrow">읽는 법</p>
    <h1>근거 수준과 자료 출처</h1>
    <section class="sec">
      <h2>근거 수준</h2>
      <p>같은 성분이라도 작용 경로마다 연구가 쌓인 정도가 다릅니다. 그래서 경로마다 따로 표시했어요.</p>
      <dl class="evlist">${(['strong', 'moderate', 'limited', 'contested'] as Evidence[]).map((e) => `<div><dt>${evidenceBadge(e)}</dt><dd>${esc(EVIDENCE_HELP[e])}</dd></div>`).join('')}</dl>
      <p class="muted">기능의학에서 자주 이야기되는 주장(렉틴과 자가면역, 씨앗기름과 염증 등)도 기전은 그대로 설명하되, 사람에게서 어디까지 확인됐는지를 함께 적었습니다.</p>
    </section>
    <section class="sec">
      <h2>영향 표시</h2>
      <p class="row wrap">${(['benefit', 'mixed', 'caution', 'harm'] as Effect[]).map((e) => effectPill(e)).join('')}</p>
      <p class="muted">이로움: 일반적인 식사량에서 도움이 되는 쪽. 양면성: 양·형태·사람에 따라 달라짐. 주의: 특정 조건(조리 부족, 질환, 약물)에서 문제. 해로움: 줄일수록 좋은 쪽.</p>
    </section>
    <section class="sec">
      <h2>자료 출처</h2>
      ${listHtml([
        '영양성분: 미국 농무부 FoodData Central(SR Legacy) 등 공개 식품성분 DB의 100g당 대략값입니다. 품종·재배·조리에 따라 달라지며, 확실하지 않은 항목은 비워 두었습니다.',
        '1일 영양성분 기준치: 식품의약품안전처 「식품등의 표시기준」.',
        '기전·근거 요약: 각 성분 페이지의 참고자료(학술 논문, 미국 국립보건원 영양보충제실, 라이너스 폴링 연구소, EFSA·WHO·IARC 등)를 바탕으로 정리했습니다.',
        'AI 분석: DB에 없는 식품은 claude.ai에서 열었을 때 Claude가 같은 형식으로 작성합니다. 검수되지 않은 내용이라 따로 표시합니다.',
      ])}
    </section>
    <section class="sec">
      <h2>이 앱의 한계</h2>
      <div class="caution-box"><p>교육용 정보이며 진단이나 치료를 대신하지 않습니다. 질환이 있거나 약을 먹고 있다면 식단을 크게 바꾸기 전에 의료진과 상의하세요.</p></div>
    </section>
  </article>`;
}

function sourceNote(): string {
  return `<p class="source">영양성분은 공개 식품성분 DB 기준 대략값이며 품종·조리법에 따라 달라집니다. 교육용 정보로, 진단·치료를 대신하지 않습니다. <a ${go('about')}>근거 수준과 출처</a></p>`;
}

export function notFoundView(): string {
  return `<article class="page"><h1>페이지를 찾을 수 없어요</h1><p><a ${go('')}>처음으로</a></p></article>`;
}

/** 답 텍스트 → HTML. 빈 줄은 문단, "• "로 시작하는 줄은 목록, [근거 …] 표시는 배지로 바꾼다. */
export function answerHtml(text: string): string {
  const evMap = Object.fromEntries(Object.entries(EVIDENCE_LABEL).map(([k, v]) => [v, k])) as Record<string, Evidence>;
  const inline = (line: string) =>
    esc(line).replace(/\[(근거 강함|근거 중간|근거 제한적|논쟁 중)\]/g, (_, label: string) => evidenceBadge(evMap[label]));
  const out: string[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br />')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (bullets.length) out.push(`<ul class="bullets">${bullets.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`);
    bullets = [];
  };
  for (const raw of text.trim().split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (/^[•\-*]\s/.test(line)) {
      flushPara();
      bullets.push(line.replace(/^[•\-*]\s+/, ''));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join('');
}
