// Tool and category definitions for the bottom toolbar.
import { STRUCTS, type StructType } from '../data/structures';
import { OBJECTS, type ObjType } from '../data/objects';
import { ROOMS } from '../data/rooms';
import { STAFF, type StaffType } from '../data/staff';

export type CatId = 'select' | 'build' | 'zone' | 'object' | 'staff' | 'manage';
export type ToolKind = 'select' | 'struct' | 'zone' | 'object' | 'demolish' | 'action';
export interface Tool { id: string; cat: CatId; name: string; icon: string; cost?: number; desc: string; kind: ToolKind; struct?: StructType; zone?: number; obj?: ObjType; staff?: StaffType; action?: string; color: string }

export const CATS: { id: CatId; name: string; icon: string }[] = [
  { id: 'select', name: '선택', icon: '👆' }, { id: 'build', name: '건설', icon: '🧱' }, { id: 'zone', name: '구역', icon: '🟦' },
  { id: 'object', name: '물건', icon: '🛏' }, { id: 'staff', name: '직원', icon: '👮' }, { id: 'manage', name: '관리', icon: '📋' },
];
const STRUCT_ICON: Record<StructType, string> = { wall: '🧱', fence: '🪵', door: '🚪', jaildoor: '🔐' };
const ZONE_ICON: Record<string, string> = { none: '🧹', cell: '🛏', holding: '🏚', canteen: '🍽', kitchen: '🍳', yard: '🌳', shower: '🚿', infirmary: '🏥', common: '📺', workshop: '🔧', solitary: '⛓', office: '🗂' };
export const STAFF_ICON: Record<StaffType, string> = { guard: '👮', cook: '👨‍🍳', workman: '👷', doctor: '🧑‍⚕️' };

export const TOOLS: Tool[] = [
  { id: 'select', cat: 'select', name: '선택·이동', icon: '👆', desc: '탭: 정보 보기 · 드래그: 화면 이동 · 두 손가락: 확대/축소', kind: 'select', color: 'rgb(255,255,255)' },
  { id: 'security', cat: 'select', name: '보안 보기', icon: '🔒', desc: '외부와 이어진 취약 구역(빨강)을 표시합니다. 탈주는 여기서 시작됩니다.', kind: 'action', action: 'security', color: 'rgb(255,255,255)' },
  { id: 'fit', cat: 'select', name: '전체 보기', icon: '🗺', desc: '지도 전체가 보이도록 화면을 맞춥니다.', kind: 'action', action: 'fit', color: 'rgb(255,255,255)' },
  { id: 'grid', cat: 'select', name: '격자', icon: '▦', desc: '칸 격자를 표시합니다.', kind: 'action', action: 'grid', color: 'rgb(255,255,255)' },
  ...STRUCTS.map<Tool>(sd => ({ id: 'struct:' + sd.id, cat: 'build', name: sd.name, icon: STRUCT_ICON[sd.id], cost: sd.cost, desc: sd.desc, kind: 'struct', struct: sd.id, color: sd.id === 'fence' ? 'rgb(195,154,98)' : sd.id === 'wall' ? 'rgb(200,205,210)' : 'rgb(255,200,120)' })),
  { id: 'demolish', cat: 'build', name: '철거', icon: '🚧', desc: '드래그한 범위의 벽·문·물건을 철거 예약합니다(50% 환불). 예정된 작업은 취소(전액 환불).', kind: 'demolish', color: 'rgb(229,72,77)' },
  ...ROOMS.filter(r => r.id !== 'none').map<Tool>((r, i) => ({ id: 'zone:' + r.id, cat: 'zone', name: r.name, icon: ZONE_ICON[r.id], desc: r.desc, kind: 'zone', zone: ROOMS.indexOf(r), color: hexToRgb(r.color) })),
  { id: 'zone:none', cat: 'zone', name: '구역 해제', icon: '🧹', desc: '드래그한 범위의 구역 지정을 지웁니다.', kind: 'zone', zone: 0, color: 'rgb(200,200,200)' },
  ...OBJECTS.map<Tool>(o => ({ id: 'obj:' + o.id, cat: 'object', name: o.name, icon: o.icon, cost: o.cost, desc: o.desc + ` (${o.rooms.map(rid => ROOMS.find(r => r.id === rid)?.name).join('·')})`, kind: 'object', obj: o.id, color: 'rgb(120,180,255)' })),
  ...STAFF.map<Tool>(sd => ({ id: 'hire:' + sd.id, cat: 'staff', name: sd.name + ' 고용', icon: STAFF_ICON[sd.id], cost: sd.hireCost, desc: `${sd.desc} 고용 $${sd.hireCost}, 급여 $${sd.wage}/일`, kind: 'action', action: 'hire', staff: sd.id, color: 'rgb(255,255,255)' })),
  { id: 'staffsheet', cat: 'staff', name: '직원 관리', icon: '📇', desc: '직원 목록·해고·급여 합계', kind: 'action', action: 'sheet:staff', color: 'rgb(255,255,255)' },
  { id: 'riot', cat: 'staff', name: '진압대 요청', icon: '🚨', cost: 1500, desc: '무장 진압대 4명이 24시간 주둔합니다. 폭동 때 사용하세요.', kind: 'action', action: 'riotSquad', color: 'rgb(255,255,255)' },
  { id: 'intake', cat: 'manage', name: '수감 접수', icon: '🚌', desc: '수감자 접수·보안 등급·자동 접수 설정과 수감자 명단', kind: 'action', action: 'sheet:intake', color: 'rgb(255,255,255)' },
  { id: 'regime', cat: 'manage', name: '일과표', icon: '🕗', desc: '24시간 일과(수면·식사·노동·운동·자유·샤워·감금)를 편집합니다.', kind: 'action', action: 'sheet:regime', color: 'rgb(255,255,255)' },
  { id: 'objectives', cat: 'manage', name: '목표', icon: '🎯', desc: '현재 장의 목표와 보상', kind: 'action', action: 'sheet:objectives', color: 'rgb(255,255,255)' },
  { id: 'report', cat: 'manage', name: '보고서', icon: '📊', desc: '재정·사건·위험 요약', kind: 'action', action: 'sheet:report', color: 'rgb(255,255,255)' },
  { id: 'lockdown', cat: 'manage', name: '비상 봉쇄', icon: '⛔', desc: '모든 수감자를 감방으로 돌려보내고 문을 잠급니다. 폭동 확산 방지. 자유 욕구 상승.', kind: 'action', action: 'lockdown', color: 'rgb(255,255,255)' },
  { id: 'log', cat: 'manage', name: '기록', icon: '📜', desc: '최근 사건 기록', kind: 'action', action: 'sheet:log', color: 'rgb(255,255,255)' },
];
export const TOOL_BY_ID: Record<string, Tool> = Object.fromEntries(TOOLS.map(t => [t.id, t]));
export const isDrawKind = (k: ToolKind): boolean => k === 'struct' || k === 'zone' || k === 'object' || k === 'demolish';
function hexToRgb(hex: string): string { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`; }
