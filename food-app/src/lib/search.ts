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
