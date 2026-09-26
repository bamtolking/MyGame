// Korean particle helper (조사): picks 이/가 · 은/는 · 을/를 · 와/과 · (으)로 · 이에요/예요 from the last syllable.
// A Hangul syllable has a final consonant (받침) when (code − 0xAC00) % 28 ≠ 0 (GDD §10.7).
// Digits and a few Latin letters are read the way Korean speakers say them (1 일 → 받침, 2 이 → none, m 엠 → 받침).

const HANGUL_FIRST = 0xac00, HANGUL_LAST = 0xd7a3;
const RIEUL = 8;   // jongseong index of ㄹ (for 으로/로: ㄹ-final words take 로)
// 영 일 이 삼 사 오 육 칠 팔 구 → ㅇ ㄹ · ㅁ · · ㄱ ㄹ ㄹ ·
const DIGIT_FINAL = [21, RIEUL, 0, 16, 0, 0, 1, RIEUL, RIEUL, 0];

/** jongseong index of the last pronounceable character: 0 = no 받침, −1 = unknown (symbols only). */
function finalIndex(word: string): number {
  const s = word.replace(/[\s)\]}'"」』.,!?~…·★☆]+$/u, '');
  for (let i = s.length - 1; i >= 0; i--) {
    const code = s.charCodeAt(i);
    if (code >= HANGUL_FIRST && code <= HANGUL_LAST) return (code - HANGUL_FIRST) % 28;
    const ch = s[i];
    if (ch >= '0' && ch <= '9') return DIGIT_FINAL[+ch];
    if (/[lr]/i.test(ch)) return RIEUL;      // 엘, 알
    if (/[mn]/i.test(ch)) return 4;          // 엠, 엔
    if (/[a-z]/i.test(ch)) return 0;
    if (ch === '%') return 0;                // 퍼센트
  }
  return -1;
}

/** true when the last syllable has a final consonant (받침). */
export function hasBatchim(word: string): boolean { return finalIndex(word) > 0; }

export type JosaPair = '이/가' | '은/는' | '을/를' | '와/과' | '으로/로' | '이에요/예요' | '이나/나' | '아/야';

/** Just the particle for `word` (without the word). Unknown endings get the combined form, e.g. '이(가)'. */
export function particle(word: string, pair: JosaPair): string {
  const f = finalIndex(word);
  // every pair is written "after-받침 / after-vowel" except 와/과, which is written the usual way round
  const [withF, noF] = pair === '와/과' ? ['과', '와'] : pair.split('/');
  if (f < 0) return pair === '으로/로' ? '(으)로' : `${withF}(${noF})`;
  if (pair === '으로/로') return f > 0 && f !== RIEUL ? withF : noF;
  return f > 0 ? withF : noF;
}

/** word + the right particle: josa('호떡이', '이/가') → '호떡이가', josa('달콩', '을/를') → '달콩을'. */
export function josa(word: string, pair: JosaPair): string { return word + particle(word, pair); }
