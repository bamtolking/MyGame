// Biomes (풍경): presentation + music only. Silhouettes and hitboxes are identical everywhere; only skins change.
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
}

export const BIOMES: BiomeDef[] = [
  { id: 'market', name: '야시장 골목', style: 'market', sky: ['#2b2d6e', '#f28f6b'], far: '#4b3f7a', mid: '#6a4c7d', near: '#8a5a6b', ground: '#6b4a2e', groundTop: '#e0b36a', platform: '#c98a4b',
    hazard: { spike: '#7a2a36', tall: '#4a2a66', hang: '#23406e' }, hazardName: { spike: '석쇠 꼬챙이', tall: '찜통 탑', hang: '청사초롱 줄', pit: '하수구 틈' }, bpm: 150, key: 0 },
  { id: 'riverside', name: '포장마차 강변', style: 'riverside', sky: ['#14284a', '#3f6f8f'], far: '#23405e', mid: '#2f5570', near: '#3b4a66', ground: '#4a3b2f', groundTop: '#c9a46a', platform: '#b5653a',
    hazard: { spike: '#6e2f3a', tall: '#4b2f63', hang: '#1f3f6a' }, hazardName: { spike: '소라 껍데기 더미', tall: '쌓인 플라스틱 의자', hang: '천막 끝자락', pit: '물웅덩이 틈' }, bpm: 140, key: 5 },
  { id: 'bridge', name: '불꽃놀이 다리', style: 'bridge', sky: ['#0d0b24', '#402a6b'], far: '#2a2150', mid: '#3a2d63', near: '#52406f', ground: '#5a5566', groundTop: '#c8c3d6', platform: '#9aa0b5',
    hazard: { spike: '#7a2b3b', tall: '#51306e', hang: '#26457a' }, hazardName: { spike: '폭죽 상자', tall: '불꽃 발사대', hang: '불꽃 현수막', pit: '끊어진 난간' }, bpm: 156, key: 7 },
  { id: 'dawn', name: '새벽 지붕길', style: 'dawn', sky: ['#3a3f7a', '#f5c49a'], far: '#6d6aa0', mid: '#8a7aa6', near: '#5a4a6e', ground: '#5b4636', groundTop: '#d8a878', platform: '#a86b4a',
    hazard: { spike: '#72303a', tall: '#4d3066', hang: '#28446e' }, hazardName: { spike: '뾰족 기와', tall: '굴뚝', hang: '빨랫줄', pit: '지붕 사이' }, bpm: 132, key: 2 },
];
export const BIOME_ORDER = BIOMES.map(b => b.id);
export const BIOME_BY_ID: Record<string, BiomeDef> = Object.fromEntries(BIOMES.map(b => [b.id, b]));
