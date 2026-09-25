"""게임에 쓰인 글자만 남긴 주아체 woff2를 만들어 src/ui/font.css 에 base64로 넣는다.

사용: python3 scripts/subset_font.py [Jua-Regular.ttf 경로]
원본 TTF는 저장소에 넣지 않는다 (https://github.com/google/fonts/tree/main/ofl/jua).
"""
import base64, glob, io, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'fonts', 'Jua-Regular.ttf')
chars = set(chr(c) for c in range(0x20, 0x7f))
chars |= set('·★☆…‘’“”!?~%+×−–—')
for path in glob.glob(os.path.join(root, 'src', '**', '*.ts'), recursive=True) + [os.path.join(root, 'index.html')]:
    with open(path, encoding='utf-8') as f:
        chars |= set(f.read())
chars = {c for c in chars if ord(c) >= 0x20}
font = TTFont(src)
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.name_IDs = ['*']
opts.notdef_outline = True
sub = subset.Subsetter(opts)
sub.populate(text=''.join(sorted(chars)))
sub.subset(font)
buf = io.BytesIO()
font.flavor = 'woff2'
font.save(buf)
data = base64.b64encode(buf.getvalue()).decode()
hangul = sum(1 for c in chars if 0xAC00 <= ord(c) <= 0xD7A3)
css = (
    "/* 자동 생성: npm run font (scripts/subset_font.py). 주아체 Jua © The Jua Project Authors, SIL Open Font License 1.1 (fonts/Jua-OFL.txt). */\n"
    "@font-face { font-family: 'Jua'; font-style: normal; font-weight: 400; font-display: swap;\n"
    f"  src: url(data:font/woff2;base64,{data}) format('woff2'); }}\n"
)
with open(os.path.join(root, 'src', 'ui', 'font.css'), 'w', encoding='utf-8') as f:
    f.write(css)
print(f'glyph chars={len(chars)} hangul={hangul} woff2={len(buf.getvalue())//1024}KB')
