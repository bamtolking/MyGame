// Biomes (풍경): presentation + music only. Silhouettes and hitboxes are identical everywhere; only skins change.
// Colour rules (GDD 11.2–11.4, checked by tests/palette.test.ts):
//  - parallax: farther = lighter / bluer (far → mid → near get darker and warmer);
//  - hazard bodies are dark, low-saturation, one hue per kind (spike coral red, tall purple, hang blue) and are
//    separated by lightness too (tall darkest, hang lightest) so they stay distinct under colour-vision deficiency.
export interface BiomeDef {
  id: string;
  name: string;
  style: 'market' | 'riverside' | 'bridge' | 'dawn';
  sky: [string, string];         // gradient top → bottom
  far: string; mid: string; near: string; // parallax silhouettes
  ground: string; groundTop: string; platform: string;
  hazard: { spike: string; tall: string; hang: string };  // dark, low-saturation bodies with a per-kind hue
  hazardName: { spike: string; tall: string; hang: string; pit: string };
  bpm: number; key: number;      // procedural music (key = semitones above C)
  // ---- art-only extras (optional; src/render/backdrops.ts falls back when missing) ----
  haze?: string;                 // atmosphere colour the farthest layer fades into (≈ horizon sky)
  light?: string;                // warm window / lantern light
  accent?: [string, string];     // awnings, tents, banners
  pit?: string;                  // pit interior (darkest colour of the biome)
}

export const BIOMES: BiomeDef[] = [
  { id: 'market', name: '야시장 골목', style: 'market', sky: ['#2b2d6e', '#f28f6b'], far: '#a77a9c', mid: '#6d4f84', near: '#3b2a52',
    ground: '#6b4a2e', groundTop: '#e8b86a', platform: '#c98a4b',
    hazard: { spike: '#893d37', tall: '#3c2851', hang: '#41668d' }, hazardName: { spike: '석쇠 꼬챙이', tall: '찜통 탑', hang: '청사초롱 줄', pit: '하수구 틈' }, bpm: 150, key: 0,
    haze: '#e8927a', light: '#ffc86b', accent: ['#d9544f', '#f3dfbd'], pit: '#150b17' },
  { id: 'riverside', name: '포장마차 강변', style: 'riverside', sky: ['#14284a', '#3f6f8f'], far: '#5f84a6', mid: '#355a7d', near: '#1d3049',
    ground: '#5a4331', groundTop: '#d6ad6d', platform: '#e0803c',
    hazard: { spike: '#874033', tall: '#3b2c54', hang: '#426a8c' }, hazardName: { spike: '소라 껍데기 더미', tall: '쌓인 플라스틱 의자', hang: '천막 끝자락', pit: '물웅덩이 틈' }, bpm: 140, key: 5,
    haze: '#6f9bb5', light: '#ffb35c', accent: ['#f0883a', '#ffd9a0'], pit: '#07121f' },
  { id: 'bridge', name: '불꽃놀이 다리', style: 'bridge', sky: ['#0d0b24', '#402a6b'], far: '#5a4a8e', mid: '#382c68', near: '#211944',
    ground: '#555066', groundTop: '#cfc9dd', platform: '#a3a9bf',
    hazard: { spike: '#8c3f3f', tall: '#3d234e', hang: '#466491' }, hazardName: { spike: '폭죽 상자', tall: '불꽃 발사대', hang: '불꽃 현수막', pit: '끊어진 난간' }, bpm: 156, key: 7,
    haze: '#6c50a0', light: '#ffe08a', accent: ['#ff6b9a', '#6be0ff'], pit: '#0a0718' },
  { id: 'dawn', name: '새벽 지붕길', style: 'dawn', sky: ['#3a3f7a', '#f5c49a'], far: '#b3a1c6', mid: '#86749f', near: '#473a5b',
    ground: '#4d4760', groundTop: '#eadbc8', platform: '#9a6448',
    hazard: { spike: '#843d33', tall: '#392a51', hang: '#456a8c' }, hazardName: { spike: '뾰족 기와', tall: '굴뚝', hang: '빨랫줄', pit: '지붕 사이' }, bpm: 132, key: 2,
    haze: '#eab69a', light: '#ffd9a0', accent: ['#e8743b', '#5f7d4e'], pit: '#16121f' },
];
export const BIOME_ORDER = BIOMES.map(b => b.id);
export const BIOME_BY_ID: Record<string, BiomeDef> = Object.fromEntries(BIOMES.map(b => [b.id, b]));
