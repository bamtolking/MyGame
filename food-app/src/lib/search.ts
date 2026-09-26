// 검색: 이름·별칭·영어 이름 부분 일치, 한글 초성 검색(ㅅㄱㅊ → 시금치), 한 글자 오타 허용, 작용 태그 검색.
import { COMPOUND_CATALOG, TAGS, TAG_IDS, type CompoundId } from '../data/catalog';
import type { Compound, Food, TagId } from '../data/types';

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFC').replace(/[\s·・()\[\]{}\-_,./'"!?~]+/g, '');
}

export function choseong(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) out += CHO[Math.floor(code / 588)];
    else if (CHO.includes(ch)) out += ch;
  }
  return out;
}

const isChoseongOnly = (q: string) => q.length > 0 && [...q].every((c) => CHO.includes(c));

function editDistanceAtMost1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export type Hit =
  | { type: 'food'; id: string; score: number }
  | { type: 'compound'; id: CompoundId; score: number }
  | { type: 'tag'; id: TagId; score: number };

interface Entry {
  type: 'food' | 'compound';
  id: string;
  names: string[]; // 정규화된 대표 이름들 (이름 + 영어)
  aliases: string[];
  cho: string;
}

export class SearchIndex {
  private entries: Entry[];

  constructor(foods: Food[], compounds: Compound[]) {
    const foodEntries: Entry[] = foods.map((f) => ({
      type: 'food',
      id: f.id,
      names: [normalize(f.name), normalize(f.en)],
      aliases: (f.aliases ?? []).map(normalize),
      cho: choseong(f.name.replace(/\(.*?\)/g, '')),
    }));
    const compoundEntries: Entry[] = compounds.map((c) => ({
      type: 'compound',
      id: c.id,
      names: [normalize(c.name), normalize(c.en), normalize(COMPOUND_CATALOG[c.id])],
      aliases: (c.aliases ?? []).map(normalize),
      cho: choseong(c.name.replace(/\(.*?\)/g, '')),
    }));
    this.entries = [...foodEntries, ...compoundEntries];
  }

  private score(e: Entry, q: string): number {
    let best = 0;
    for (const n of e.names) {
      if (!n) continue;
      if (n === q) best = Math.max(best, 100);
      else if (n.startsWith(q)) best = Math.max(best, 80);
      else if (n.includes(q)) best = Math.max(best, 65);
    }
    for (const a of e.aliases) {
      if (!a) continue;
      if (a === q) best = Math.max(best, 90);
      else if (a.startsWith(q)) best = Math.max(best, 60);
      else if (q.length >= 2 && a.includes(q)) best = Math.max(best, 50);
    }
    if (best === 0 && isChoseongOnly(q)) {
      if (e.cho.startsWith(q)) best = 55;
      else if (q.length >= 2 && e.cho.includes(q)) best = 40;
    }
    if (best === 0 && q.length >= 2) {
      // 이름 앞부분과 한 글자 차이까지 허용 (예: 브로컬리 → 브로콜리)
      for (const n of [...e.names, ...e.aliases]) {
        if (n && (editDistanceAtMost1(n, q) || (n.length > q.length && editDistanceAtMost1(n.slice(0, q.length), q) && q.length >= 3))) {
          best = Math.max(best, 30);
        }
      }
    }
    return best;
  }

  search(raw: string, limit = 24): Hit[] {
    const q = normalize(raw);
    if (!q) return [];
    const hits: Hit[] = [];
    for (const e of this.entries) {
      const s = this.score(e, q);
      if (s > 0) hits.push({ type: e.type, id: e.id, score: s + (e.type === 'food' ? 2 : 0) } as Hit);
    }
    for (const t of TAG_IDS) {
      const label = normalize(TAGS[t]);
      if (label === q || (q.length >= 2 && label.includes(q))) hits.push({ type: 'tag', id: t, score: label === q ? 85 : 45 });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }
}

// ---------- 자주 묻는 질문 검색 ----------

export interface FaqHit {
  kind: 'food' | 'compound';
  id: string;
  index: number;
  q: string;
  score: number;
}

interface FaqEntry extends FaqHit {
  head: string; // 정규화된 "항목 이름 + 질문"
  body: string; // 정규화된 답
}

/** 질문 검색에서 같은 뜻으로 보는 낱말 묶음 (예: "임산부"로 찾으면 "임신 중에…" 질문도 나온다) */
const SYNONYMS: string[][] = [
  ['임산부', '임신', '임신부', '임부', '태아', '입덧'],
  ['수유', '모유', '수유부'],
  ['아이', '어린이', '아기', '유아', '영아', '영유아', '이유식', '소아', '자녀', '아동', '청소년'],
  ['노인', '어르신', '고령', '노년'],
  ['신장', '콩팥', '신부전', '투석'],
  ['당뇨', '혈당', '당뇨병', '인슐린'],
  ['고혈압', '혈압'],
  ['다이어트', '체중', '살', '뱃살', '비만', '감량'],
  ['공복', '빈속', '아침'],
  ['자기전', '밤', '저녁', '야식'],
  ['약', '약물', '복용', '와파린', '항응고제'],
  ['결석', '요로결석', '신장결석', '담석'],
  ['콜레스테롤', 'ldl', '고지혈증', '이상지질혈증'],
  ['위염', '역류', '속쓰림', '위궤양', '위'],
  ['변비', '배변', '장'],
  ['설사', '배탈', '가스', '복통', '과민성대장'],
  ['알레르기', '두드러기', '가려움'],
  ['암', '항암', '발암'],
  ['피부', '여드름', '주름', '미백'],
  ['탈모', '머리카락', '모발'],
  ['보관', '냉장', '냉동', '유통기한', '소비기한'],
  ['하루', '적정량', '얼마나', '몇개', '몇잔'],
  ['생으로', '날것', '날로', '생식'],
  ['갑상선', '요오드'],
  ['통풍', '요산', '퓨린'],
  ['빈혈', '철분', '철'],
  ['운동', '근육', '단백질'],
  ['수면', '잠', '불면'],
];
const SYN_INDEX = new Map<string, string[]>();
for (const group of SYNONYMS) {
  const g = group.map(normalize);
  for (const w of g) SYN_INDEX.set(w, [...new Set([...(SYN_INDEX.get(w) ?? []), ...g])]);
}
/** 낱말 하나를 같은 뜻 낱말들로 넓힌다. 한 글자 낱말은 그대로 둔다(너무 넓게 걸림). */
function expand(term: string): string[] {
  const syn = SYN_INDEX.get(term);
  if (!syn) return [term];
  return syn.filter((w) => w === term || w.length >= 2);
}

/**
 * 질문 검색. 검색어를 띄어쓰기로 나눠 모든 낱말(또는 같은 뜻 낱말)이 "항목 이름 + 질문"에 있으면 높은 점수,
 * 질문에는 없고 답에만 있으면 낮은 점수로 찾는다.
 */
export class FaqIndex {
  private entries: FaqEntry[] = [];

  constructor(sets: { kind: 'food' | 'compound'; map: Record<string, { q: string; a: string }[]>; names: (id: string) => string[] }[]) {
    for (const { kind, map, names } of sets) {
      for (const [id, list] of Object.entries(map)) {
        const nameKey = names(id).map(normalize).join(' ');
        list.forEach((x, index) => {
          this.entries.push({ kind, id, index, q: x.q, score: 0, head: `${nameKey} ${normalize(x.q)}`, body: normalize(x.a) });
        });
      }
    }
  }

  get size(): number {
    return this.entries.length;
  }

  search(raw: string, limit = 40): FaqHit[] {
    const terms = raw.split(/\s+/).map(normalize).filter((t) => t.length >= 1);
    if (!terms.length || terms.join('').length < 2) return [];
    const groups = terms.map(expand);
    const inHead = (e: FaqEntry, g: string[]) => g.some((w) => e.head.includes(w));
    const hits: FaqHit[] = [];
    for (const e of this.entries) {
      let score = 0;
      if (groups.every((g) => inHead(e, g))) score = 10 + (terms.every((t) => e.head.includes(t)) ? 3 : 0) + (e.head.includes(normalize(raw)) ? 2 : 0);
      else if (groups.every((g) => inHead(e, g) || g.some((w) => e.body.includes(w)))) score = 3;
      if (score) hits.push({ kind: e.kind, id: e.id, index: e.index, q: e.q, score });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }
}
