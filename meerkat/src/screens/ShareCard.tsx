import { useEffect, useRef, useState } from 'preact/hooks';
import { Download, Share2 } from 'lucide-preact';
import { Animal, LogoMark } from '../components/animals';
import { Seg, toast, TopBar } from '../components/ui';
import { tr } from '../i18n';
import { canvasToBlob } from '../pose/camera';
import { download, shareImage } from '../lib/share';
import { renderShareCard, type CardFormat } from '../share/card';
import { scans } from '../state/store';
import { BRAND } from '../config';
import { L } from '../i18n';

export function ShareCard({ id }: { id: string }) {
  const scan = scans.value.find((s) => s.id === id);
  const animalRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<CardFormat>('story');
  const [img, setImg] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);

  useEffect(() => {
    if (!scan) return;
    let alive = true;
    setImg(null);
    (async () => {
      const a = animalRef.current?.querySelector('svg')?.outerHTML ?? '';
      const l = logoRef.current?.querySelector('svg')?.outerHTML ?? '';
      const c = await renderShareCard(scan, a, l, format);
      const b = await canvasToBlob(c, 'image/png');
      if (!alive) return;
      blob.current = b;
      setImg(URL.createObjectURL(b));
    })().catch((e) => {
      console.error(e);
      toast(tr('카드를 만들지 못했어요', 'Couldn’t create the card'));
    });
    return () => {
      alive = false;
    };
  }, [id, format]);

  if (!scan) return null;
  const text = tr(
    `내 자세 점수는 ${scan.report.score}점! 너도 ${L(BRAND.name)}에서 30초 만에 체형 분석해 봐 🐢→🌟`,
    `My posture score is ${scan.report.score}! Try a 30-second scan on ${L(BRAND.name)} 🐢→🌟`,
  );
  const share = async () => {
    if (!blob.current) return;
    const res = await shareImage(blob.current, `meerkat-${scan.id}.png`, text);
    if (res === 'downloaded') toast(tr('이미지를 저장했어요', 'Image saved'));
  };
  return (
    <div class="screen">
      <TopBar title={tr('결과 카드 공유', 'Share result')} fallback={`/scan/result/${id}`} />
      <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
        <div ref={animalRef}>
          <Animal id={scan.report.type.primary} size={600} />
        </div>
        <div ref={logoRef}>
          <LogoMark size={128} />
        </div>
      </div>
      <Seg
        value={format}
        onChange={setFormat}
        options={[
          { value: 'story', label: tr('스토리 (9:16)', 'Story (9:16)') },
          { value: 'square', label: tr('피드 (4:5)', 'Feed (4:5)') },
        ]}
      />
      <div class="center" style={{ marginTop: 16 }}>
        {img ? (
          <img src={img} alt={tr('결과 카드 미리보기', 'Result card preview')} class="fade-up" style={{ width: format === 'story' ? '66%' : '82%', borderRadius: 20, boxShadow: 'var(--shadow-2)', margin: '0 auto' }} />
        ) : (
          <div class="skeleton" style={{ width: format === 'story' ? '66%' : '82%', aspectRatio: format === 'story' ? '9 / 16' : '4 / 5', margin: '0 auto' }} />
        )}
      </div>
      <p class="caption center" style={{ marginTop: 14 }}>
        {tr('카드에는 사진이 들어가지 않아요. 안심하고 공유하세요!', 'Your photo is never included on the card.')}
      </p>
      <div class="bottom-cta">
        <button class="btn primary block" onClick={share} disabled={!img}>
          <Share2 size={18} /> {tr('공유하기', 'Share')}
        </button>
        <button class="btn secondary block" onClick={() => blob.current && download(blob.current, `meerkat-${scan.id}.png`)} disabled={!img}>
          <Download size={18} /> {tr('이미지 저장', 'Save image')}
        </button>
      </div>
    </div>
  );
}
