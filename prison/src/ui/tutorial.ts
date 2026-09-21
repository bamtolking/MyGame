// Guided first-prison tutorial for the empty plot. Steps auto-advance when their check passes.
import type { GameState } from '../sim/types';
import { ROOMS } from '../data/rooms';
import { validRooms } from '../sim/grid';
import { TOOL_BY_ID } from './toolbar';
import type { App } from './app';

export interface TutStep { text: string; check: (s: GameState, app: App) => boolean; go?: (app: App) => void; goLabel?: string }
const holdingIdx = ROOMS.findIndex(r => r.id === 'holding');
const countWalls = (s: GameState): number => { let n = 0; for (let i = 0; i < s.struct.length; i++) if (s.struct[i] === 1) n++; for (const j of s.jobs) if (j.kind === 'build' && j.struct === 1) n++; return n; };
const hasJail = (s: GameState): boolean => s.struct.some(v => v === 4) || s.jobs.some(j => j.kind === 'build' && j.struct === 4);
const holdingRoom = (s: GameState) => s.cache.rooms.find(r => r.zone === holdingIdx) || null;
function objsIn(s: GameState, type: string): number { const r = holdingRoom(s); if (!r) return 0; let n = 0; for (const t of r.tiles) { const id = s.objAt[t]; if (id >= 0 && s.cache.objIndex.get(id)?.type === type) n++; } return n; }

export const TUTORIAL: TutStep[] = [
  { text: '🏗 프리셋 탭에서 "대기실"을 고르고, 지도 빈 곳을 탭해 놓아 보세요. (벽·문·물건이 한 번에 계획됩니다)', check: s => !!holdingRoom(s) && countWalls(s) >= 12, go: app => { app.setCat('preset'); app.setTool(TOOL_BY_ID['stamp:holding']); }, goLabel: '프리셋 열기' },
  { text: '문이 일반 문이라 탈주자가 드나들 수 있습니다. 왼쪽 문을 탭해 취소한 뒤 🧱 건설 → "감옥문"을 그 자리에 놓으세요.', check: s => hasJail(s), go: app => { app.setCat('build'); app.setTool(TOOL_BY_ID['struct:jaildoor']); }, goLabel: '감옥문 도구' },
  { text: '👮 직원 탭에서 교도관을 1명 고용하세요. 작업반 2명은 이미 고용되어 있습니다.', check: s => s.staff.some(x => x.type === 'guard'), go: app => app.setCat('staff'), goLabel: '직원 탭' },
  { text: '⏩ 상단 속도 버튼을 눌러 4×로 올리고 작업반이 완공할 때까지 기다리세요. 방 이름 앞 ⚠가 사라지면 유효한 방입니다.', check: s => validRooms(s, 'holding').length >= 1, go: app => app.setSpeed(4), goLabel: '4×' },
  { text: '🚌 관리 → "수감 접수"에서 자동 접수를 켜세요. 내일 08:00에 버스가 옵니다.', check: s => s.autoIntake, go: app => app.openSheet('intake'), goLabel: '수감 접수' },
  { text: '수감자는 먹어야 합니다. 프리셋 "주방+식당"을 놓고 요리사를 고용하세요. 감방 블록·샤워실·운동장도 같은 방법으로 놓을 수 있습니다.', check: s => validRooms(s, 'kitchen').length >= 1 && validRooms(s, 'canteen').length >= 1 && s.staff.some(x => x.type === 'cook'), go: app => { app.setCat('preset'); app.setTool(TOOL_BY_ID['stamp:kitchen']); }, goLabel: '주방+식당' },
  { text: '🔒 보안 보기로 빨간(외부와 이어진) 칸을 확인하세요. 건물 사이 통로도 벽이나 울타리로 둘러싸야 안전합니다. 이후는 🎯 목표가 안내합니다.', check: s => s.prisoners.length >= 1 && validRooms(s, 'holding').every(r => r.secure) && validRooms(s, 'canteen').length >= 1, go: app => app.toggleSecurity(), goLabel: '보안 보기' },
];
export function tutorialDone(s: GameState): boolean { return objsIn(s, 'toilet') >= 0 && TUTORIAL.every(t => t.check(s, null as any)); }
