// Biomes ("lands"): purely presentational + chunk flavour. Geometry rules are identical everywhere.
export interface BiomeDef {
  id: string;
  name: string;
  sky: [string, string];         // gradient top → bottom
  far: string; mid: string; near: string; // parallax silhouettes
  ground: string; groundTop: string; platform: string;
  hazard: { spike: string; tall: string; hang: string };
  bpm: number; key: number;      // procedural music
}

export const BIOMES: BiomeDef[] = [
  { id: 'market', name: '야시장 골목', sky: ['#2b2d6e', '#f28f6b'], far: '#4b3f7a', mid: '#6a4c7d', near: '#8a5a6b', ground: '#6b4a2e', groundTop: '#e0b36a', platform: '#c98a4b', hazard: { spike: '#e84a5f', tall: '#9c4dcc', hang: '#3a86ff' }, bpm: 150, key: 0 },
];
export const BIOME_ORDER = BIOMES.map(b => b.id);
export const BIOME_BY_ID: Record<string, BiomeDef> = Object.fromEntries(BIOMES.map(b => [b.id, b]));
