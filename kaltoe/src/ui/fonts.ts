// 글꼴: 제목·숫자용 디스플레이 서체와 본문 서체. Google Fonts(index.html)에서 오며, 오프라인이면 시스템 글꼴로 대체된다.
// 캔버스에 글자를 미리 그려 두는 캐시(피해 숫자·말풍선 등)는 글꼴이 늦게 도착하면 다시 그려야 하므로 fontsReady를 기다린다.
export const DISPLAY_FAMILY = 'Black Han Sans';
export const BODY_FAMILY = 'Noto Sans KR';
export const DISPLAY_FONT = `"${DISPLAY_FAMILY}","Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","WenQuanYi Zen Hei",system-ui,sans-serif`;
export const BODY_FONT = `"${BODY_FAMILY}","Pretendard","Apple SD Gothic Neo","Malgun Gothic","WenQuanYi Zen Hei",system-ui,sans-serif`;

let ready = false;
const listeners: (() => void)[] = [];
const all: (() => void)[] = [];   // 제한 시간 뒤 글꼴이 늦게 도착하면 한 번 더 부르기 위해 보관

/** 글꼴 준비가 끝나면(또는 2.5초 제한 후) 호출. 이미 끝났으면 바로 호출. 제한 뒤 늦게 도착하면 한 번 더 호출. */
export function onFontsReady(fn: () => void) { all.push(fn); if (ready) fn(); else listeners.push(fn); }
export function fontsAreReady() { return ready; }

export function loadFonts() {
  const done = () => { if (ready) return; ready = true; for (const f of listeners.splice(0)) { try { f(); } catch { /* 무시 */ } } };
  // 2.5초 제한 뒤에 글꼴이 도착하면 글자 캐시(피해 숫자 아틀라스·말풍선 스프라이트)를 한 번 더 다시 그리게 한다
  const late = () => { if (!ready) { done(); return; } for (const f of all) { try { f(); } catch { /* 무시 */ } } };
  try {
    const fs = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fs) { done(); return; }
    Promise.all([
      fs.load(`900 32px "${DISPLAY_FAMILY}"`, '칼퇴123'),
      fs.load(`700 16px "${BODY_FAMILY}"`, '칼퇴123'),
      fs.load(`900 16px "${BODY_FAMILY}"`, '칼퇴123'),
    ]).then(late, done);
    setTimeout(done, 2500);
  } catch { done(); }
}
