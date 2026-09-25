/**
 * 체형 동물 캐릭터 일러스트 (순수 SVG, 외부 이미지 없음)
 * viewBox 0 0 200 200 기준
 */
import type { JSX } from 'preact';
import type { AnimalId } from '../analysis/report';

type Props = { size?: number; class?: string; style?: JSX.CSSProperties };

const Eye = ({ x, y, r = 5.2 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#2b2118" />
    <circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.36} fill="#fff" />
  </g>
);

export function Meerkat({ size = 160, ...p }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" {...p} aria-hidden="true">
      <ellipse cx="100" cy="188" rx="46" ry="7" fill="#000" opacity=".08" />
      {/* 꼬리 */}
      <path d="M126 176 C150 172 160 150 152 128" stroke="#c98f52" stroke-width="10" fill="none" stroke-linecap="round" />
      <path d="M152 128 C150 120 147 115 144 112" stroke="#6b4a2c" stroke-width="8" fill="none" stroke-linecap="round" />
      {/* 발 */}
      <ellipse cx="84" cy="182" rx="15" ry="7" fill="#b98247" />
      <ellipse cx="116" cy="182" rx="15" ry="7" fill="#b98247" />
      {/* 몸 */}
      <path d="M100 58 C72 58 62 92 64 130 C66 164 78 184 100 184 C122 184 134 164 136 130 C138 92 128 58 100 58Z" fill="#e2b77c" />
      <path d="M100 86 C84 86 80 108 81 134 C82 160 89 176 100 176 C111 176 118 160 119 134 C120 108 116 86 100 86Z" fill="#f6e2bf" />
      {/* 팔 (가슴 앞에 모은 발) */}
      <path d="M72 104 C70 116 76 126 88 126" stroke="#c98f52" stroke-width="11" fill="none" stroke-linecap="round" />
      <path d="M128 104 C130 116 124 126 112 126" stroke="#c98f52" stroke-width="11" fill="none" stroke-linecap="round" />
      <ellipse cx="90" cy="127" rx="7" ry="5" fill="#8a5a30" />
      <ellipse cx="110" cy="127" rx="7" ry="5" fill="#8a5a30" />
      {/* 머리 */}
      <ellipse cx="100" cy="48" rx="31" ry="28" fill="#e2b77c" />
      <circle cx="70" cy="44" r="8" fill="#c98f52" />
      <circle cx="130" cy="44" r="8" fill="#c98f52" />
      <circle cx="70" cy="44" r="4" fill="#6b4a2c" />
      <circle cx="130" cy="44" r="4" fill="#6b4a2c" />
      <ellipse cx="100" cy="62" rx="15" ry="12" fill="#f6e2bf" />
      {/* 눈 주변 무늬 */}
      <ellipse cx="86" cy="46" rx="10" ry="9" fill="#6b4a2c" transform="rotate(-18 86 46)" />
      <ellipse cx="114" cy="46" rx="10" ry="9" fill="#6b4a2c" transform="rotate(18 114 46)" />
      <Eye x={86} y={46} r={5} />
      <Eye x={114} y={46} r={5} />
      <path d="M94 58 Q100 54 106 58 Q100 64 94 58Z" fill="#3a2a1c" />
      <path d="M96 66 Q100 69 104 66" stroke="#3a2a1c" stroke-width="2" fill="none" stroke-linecap="round" />
      <ellipse cx="76" cy="60" rx="6" ry="3.5" fill="#ff9d7a" opacity=".45" />
      <ellipse cx="124" cy="60" rx="6" ry="3.5" fill="#ff9d7a" opacity=".45" />
    </svg>
  );
}

export function Turtle({ size = 160, ...p }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" {...p} aria-hidden="true">
      <ellipse cx="96" cy="176" rx="64" ry="8" fill="#000" opacity=".08" />
      {/* 스마트폰 */}
      <g transform="rotate(-12 170 128)">
        <rect x="158" y="104" width="22" height="38" rx="5" fill="#2c3440" />
        <rect x="161" y="108" width="16" height="28" rx="2.5" fill="#9fd8ff" />
        <path d="M161 116 L177 112" stroke="#fff" stroke-width="2" opacity=".6" />
      </g>
      {/* 다리 */}
      <ellipse cx="54" cy="164" rx="13" ry="10" fill="#8fcf6f" />
      <ellipse cx="116" cy="166" rx="13" ry="10" fill="#8fcf6f" />
      <ellipse cx="72" cy="168" rx="11" ry="8" fill="#7cbf5c" />
      <ellipse cx="102" cy="169" rx="11" ry="8" fill="#7cbf5c" />
      {/* 쭉 뺀 목과 머리 */}
      <path d="M118 128 C132 124 142 118 150 108" stroke="#8fcf6f" stroke-width="20" fill="none" stroke-linecap="round" />
      <ellipse cx="156" cy="100" rx="20" ry="16" fill="#8fcf6f" transform="rotate(18 156 100)" />
      <Eye x={162} y={96} r={4.6} />
      <path d="M160 110 Q166 112 170 108" stroke="#3d6b2e" stroke-width="2" fill="none" stroke-linecap="round" />
      <ellipse cx="150" cy="106" rx="5" ry="3" fill="#ff9d7a" opacity=".5" />
      {/* 등딱지 */}
      <path d="M32 150 C28 102 60 76 88 76 C118 76 136 104 132 150Z" fill="#4f9e4c" />
      <path d="M32 150 L132 150 C132 158 124 162 116 162 L48 162 C40 162 32 158 32 150Z" fill="#e8d58f" />
      <path d="M58 94 L78 90 L96 98 L94 118 L74 124 L56 114Z" fill="#65b861" stroke="#3b7d39" stroke-width="3" stroke-linejoin="round" />
      <path d="M96 98 L114 104 L122 124 L108 138 L94 118Z" fill="#65b861" stroke="#3b7d39" stroke-width="3" stroke-linejoin="round" />
      <path d="M56 114 L74 124 L76 146 L50 146 L42 128Z" fill="#65b861" stroke="#3b7d39" stroke-width="3" stroke-linejoin="round" />
      <path d="M74 124 L94 118 L108 138 L104 146 L76 146Z" fill="#65b861" stroke="#3b7d39" stroke-width="3" stroke-linejoin="round" />
      {/* 땀방울 */}
      <path d="M140 76 C140 72 144 68 144 68 C144 68 148 72 148 76 A4 4 0 0 1 140 76Z" fill="#7cc7ff" />
    </svg>
  );
}

export function Shrimp({ size = 160, ...p }: Props) {
  const seg = (i: number) => {
    const a = (-150 + i * 34) * (Math.PI / 180);
    const cx = 100 + Math.cos(a) * 44;
    const cy = 104 + Math.sin(a) * 44;
    const r = 26 - i * 2.4;
    return { cx, cy, r, a };
  };
  const segs = [0, 1, 2, 3, 4, 5].map(seg);
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" {...p} aria-hidden="true">
      <ellipse cx="100" cy="178" rx="56" ry="7" fill="#000" opacity=".08" />
      <g transform="translate(0 20)">
      {/* 더듬이 */}
      <path d="M62 66 C40 30 70 16 104 22" stroke="#ff7a59" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M58 72 C28 48 44 20 70 12" stroke="#ff7a59" stroke-width="3" fill="none" stroke-linecap="round" />
      {/* 다리 (배 쪽 = 곡선 안쪽) */}
      {segs.slice(1, 5).map((sg, i) => {
        const dx = 100 - sg.cx, dy = 104 - sg.cy;
        const l = Math.hypot(dx, dy) || 1;
        const ux = dx / l, uy = dy / l;
        const x0 = sg.cx + ux * sg.r * 0.7, y0 = sg.cy + uy * sg.r * 0.7;
        return <path key={i} d={`M${x0} ${y0} q ${ux * 10 - 4} ${uy * 10 + 6} ${ux * 16 - 8} ${uy * 16 + 12}`} stroke="#ff8a6b" stroke-width="4" fill="none" stroke-linecap="round" />;
      })}
      {/* 몸 마디 (꼬리 쪽부터) */}
      {[...segs].reverse().map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={i % 2 ? '#ff9677' : '#ff8462'} />
      ))}
      {segs.slice(1).map((s, i) => (
        <path
          key={i}
          d={`M ${s.cx - Math.cos(s.a) * s.r * 0.8} ${s.cy - Math.sin(s.a) * s.r * 0.8} Q ${s.cx} ${s.cy} ${s.cx + Math.cos(s.a + 1.2) * s.r * 0.7} ${s.cy + Math.sin(s.a + 1.2) * s.r * 0.7}`}
          stroke="#ffc2ae"
          stroke-width="4"
          fill="none"
          stroke-linecap="round"
          opacity=".8"
        />
      ))}
      {/* 꼬리 부채 */}
      <path d={`M${segs[5].cx} ${segs[5].cy} l 22 10 l -6 18 Z`} fill="#ff6f4d" />
      <path d={`M${segs[5].cx} ${segs[5].cy} l 8 24 l -16 8 Z`} fill="#ff7d5c" />
      {/* 머리 */}
      <ellipse cx="66" cy="80" rx="24" ry="20" fill="#ff8462" />
      <Eye x={62} y={74} r={5.4} />
      <path d="M52 88 Q58 92 64 89" stroke="#b8442a" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <ellipse cx="76" cy="88" rx="6" ry="3.4" fill="#ffd0c0" opacity=".7" />
      {/* 땀방울 */}
      <path d="M92 58 C92 54 96 50 96 50 C96 50 100 54 100 58 A4 4 0 0 1 92 58Z" fill="#7cc7ff" />
      </g>
    </svg>
  );
}

export function Duck({ size = 160, ...p }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" {...p} aria-hidden="true">
      <ellipse cx="100" cy="182" rx="52" ry="7" fill="#000" opacity=".08" />
      {/* 발 */}
      <path d="M88 160 L86 178 L74 182 L96 182 Z" fill="#ff9a2e" />
      <path d="M108 160 L108 178 L98 182 L120 182 Z" fill="#ff9a2e" />
      {/* 몸 + 쑥 나온 엉덩이 */}
      <path d="M66 96 C52 112 52 146 74 160 C96 172 124 168 142 152 C152 144 164 132 176 110 C166 116 156 116 150 112 C140 96 118 90 96 92 C84 93 74 92 66 96Z" fill="#ffd23f" />
      <path d="M176 110 C170 102 166 96 170 88 C178 96 182 104 176 110Z" fill="#ffc21a" />
      {/* 날개 */}
      <path d="M92 118 C104 110 132 112 138 124 C132 140 108 142 94 134 C88 130 88 122 92 118Z" fill="#ffc21a" />
      <path d="M104 126 C114 124 124 126 130 130" stroke="#f0a800" stroke-width="3" fill="none" stroke-linecap="round" />
      {/* 목 · 머리 */}
      <path d="M66 100 C60 84 60 70 66 58" stroke="#ffd23f" stroke-width="26" fill="none" stroke-linecap="round" />
      <circle cx="70" cy="50" r="24" fill="#ffd23f" />
      <path d="M44 52 C34 52 26 56 28 62 C36 64 44 62 50 58Z" fill="#ff9a2e" />
      <path d="M30 58 C36 59 42 58 48 56" stroke="#e57a12" stroke-width="2" fill="none" stroke-linecap="round" />
      <Eye x={66} y={44} r={5.4} />
      <ellipse cx="78" cy="58" rx="6" ry="3.4" fill="#ff9d7a" opacity=".45" />
      {/* 엉덩이 강조 */}
      <path d="M160 88 l 8 -10 M168 98 l 12 -6 M154 82 l 2 -12" stroke="#ff8a2a" stroke-width="3" stroke-linecap="round" />
    </svg>
  );
}

export function Flamingo({ size = 160, ...p }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" {...p} aria-hidden="true">
      <ellipse cx="108" cy="186" rx="34" ry="6" fill="#000" opacity=".08" />
      {/* 서 있는 다리 */}
      <path d="M108 126 L110 184" stroke="#f47aa0" stroke-width="5" stroke-linecap="round" />
      <path d="M110 184 L124 184" stroke="#f47aa0" stroke-width="5" stroke-linecap="round" />
      {/* 접은 다리 */}
      <path d="M118 124 L134 146 L112 150" stroke="#f47aa0" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      {/* 몸 (기울어짐) */}
      <g transform="rotate(-12 110 104)">
        <ellipse cx="112" cy="104" rx="42" ry="28" fill="#ff8fb4" />
        <path d="M120 88 C140 86 154 98 152 112 C142 110 130 106 120 100Z" fill="#ff76a3" />
        <path d="M150 106 L166 118 L148 116Z" fill="#ff76a3" />
      </g>
      {/* S자 목 · 머리 */}
      <path d="M80 98 C66 90 64 70 76 58 C88 46 92 34 82 26" stroke="#ff8fb4" stroke-width="12" fill="none" stroke-linecap="round" />
      <circle cx="78" cy="24" r="14" fill="#ff8fb4" />
      <path d="M66 26 C58 28 54 36 58 44 C62 40 64 34 70 32Z" fill="#fff" />
      <path d="M58 44 C57 40 58 37 60 35 L 63 38 C61 40 60 42 58 44Z" fill="#2b2118" />
      <Eye x={82} y={20} r={4.2} />
      <ellipse cx="88" cy="30" rx="4.6" ry="2.6" fill="#ff5a8c" opacity=".45" />
      {/* 기울어짐 표시 */}
      <path d="M150 58 A 44 44 0 0 1 164 90" stroke="#ffb3cb" stroke-width="3" fill="none" stroke-dasharray="4 5" stroke-linecap="round" />
    </svg>
  );
}

export const ANIMAL_ART: Record<AnimalId, (p: Props) => JSX.Element> = {
  meerkat: Meerkat,
  turtle: Turtle,
  shrimp: Shrimp,
  duck: Duck,
  flamingo: Flamingo,
};

export function Animal({ id, ...p }: Props & { id: AnimalId }) {
  const C = ANIMAL_ART[id];
  return <C {...p} />;
}

/** 앱 로고 (미어캣 얼굴) */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#ff6b2c" />
      <ellipse cx="32" cy="38" rx="19" ry="17" fill="#f3d19f" />
      <circle cx="14.5" cy="33" r="5" fill="#d9a15f" />
      <circle cx="49.5" cy="33" r="5" fill="#d9a15f" />
      <ellipse cx="24" cy="35" rx="6" ry="5.4" fill="#6b4a2c" transform="rotate(-18 24 35)" />
      <ellipse cx="40" cy="35" rx="6" ry="5.4" fill="#6b4a2c" transform="rotate(18 40 35)" />
      <circle cx="24" cy="35" r="2.8" fill="#1d140c" />
      <circle cx="40" cy="35" r="2.8" fill="#1d140c" />
      <circle cx="25" cy="34" r="1" fill="#fff" />
      <circle cx="41" cy="34" r="1" fill="#fff" />
      <ellipse cx="32" cy="46" rx="8" ry="6" fill="#fbead0" />
      <path d="M29 43.5 Q32 41.5 35 43.5 Q32 46.5 29 43.5Z" fill="#3a2a1c" />
    </svg>
  );
}
