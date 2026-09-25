// Monster table. Index in MONSTERS is the u8 "type" sent on the wire.
export type Behavior = 'chase' | 'charger' | 'ranged' | 'exploder' | 'runner' | 'boss';
export type BossKind = 'chief' | 'imugi' | 'reaper' | 'gumiho' | 'bulgasari';

export interface MonsterDef {
  key: string; name: string; zone: number; hp: number; dmg: number; speed: number; r: number; xp: number; gold: number;
  beh: Behavior; atkCd: number; range: number; projSpeed: number; glow: string; boss?: BossKind; level?: number; desc: string;
}

const M = (key: string, name: string, zone: number, hp: number, dmg: number, speed: number, r: number, xp: number, gold: number, beh: Behavior, o: Partial<MonsterDef> = {}): MonsterDef =>
  ({ key, name, zone, hp, dmg, speed, r, xp, gold, beh, atkCd: 0.9, range: 0, projSpeed: 0, glow: '', desc: '', ...o });

export const MONSTERS: MonsterDef[] = [
  /* 0 */ M('wisp', '도깨비불', 1, 16, 5, 60, 11, 3, 2, 'chase', { glow: '#5fb4ff', desc: '길 잃은 혼이 뭉친 푸른 불꽃.' }),
  /* 1 */ M('imp', '꼬마 도깨비', 1, 34, 8, 56, 13, 6, 4, 'chase', { desc: '뿔 하나 달린 장난꾸러기. 방망이가 제법 아프다.' }),
  /* 2 */ M('clubber', '방망이 도깨비', 1, 115, 15, 48, 18, 16, 10, 'charger', { atkCd: 1.1, range: 230, desc: '멈칫하면 돌진한다. 붉은 선을 피하자.' }),
  /* 3 */ M('toad', '두꺼비 요괴', 2, 84, 12, 50, 17, 11, 7, 'chase', { desc: '늪에서 뛰어오르는 거대 두꺼비.' }),
  /* 4 */ M('drowned', '물귀신', 2, 60, 13, 76, 13, 10, 6, 'chase', { glow: '#7fe0d0', desc: '물에 빠진 이의 원혼. 빠르게 따라붙는다.' }),
  /* 5 */ M('bogwisp', '독 도깨비불', 2, 42, 26, 72, 11, 9, 5, 'exploder', { glow: '#9dff6a', range: 72, desc: '가까이 오면 부풀어 터진다. 원 밖으로!' }),
  /* 6 */ M('egg', '달걀귀신', 3, 112, 16, 70, 15, 15, 9, 'chase', { glow: '#e8e8ff', desc: '얼굴이 없는 귀신. 소리 없이 다가온다.' }),
  /* 7 */ M('skeleton', '해골 무사', 3, 175, 20, 56, 15, 19, 11, 'charger', { atkCd: 1.2, range: 240, desc: '폐사찰을 지키던 무사의 뼈. 돌진한다.' }),
  /* 8 */ M('crow', '저승 까마귀', 3, 82, 14, 88, 13, 14, 8, 'ranged', { atkCd: 1.8, range: 270, projSpeed: 250, desc: '거리를 두고 검은 깃털을 날린다.' }),
  /* 9 */ M('foxfire', '여우불', 4, 120, 16, 100, 12, 17, 10, 'chase', { glow: '#ff9a3c', desc: '구미호의 꼬리에서 떨어진 불씨. 매우 빠르다.' }),
  /* 10 */ M('foxmage', '여우 무녀', 4, 165, 13, 72, 14, 21, 12, 'ranged', { atkCd: 2.5, range: 300, projSpeed: 230, glow: '#ffb86b', desc: '세 갈래 여우불을 부채꼴로 쏜다.' }),
  /* 11 */ M('jangseung', '성난 장승', 4, 620, 30, 42, 24, 58, 30, 'charger', { atkCd: 1.4, range: 260, desc: '마을을 지키던 장승이 미쳐 날뛴다. 매우 단단하다.' }),
  /* 12 */ M('goldgob', '황금 도깨비', 0, 380, 0, 118, 16, 40, 0, 'runner', { glow: '#ffd54a', desc: '금 나와라 뚝딱! 도망치기 전에 잡으면 금화가 쏟아진다.' }),
  /* 13 */ M('boss_chief', '금방망이 대장', 1, 2600, 22, 62, 40, 420, 300, 'boss', { boss: 'chief', level: 6, atkCd: 1.0, desc: '도깨비 숲의 대장. 금방망이로 땅을 내리친다.' }),
  /* 14 */ M('boss_imugi', '늪의 이무기', 2, 5200, 26, 58, 46, 1500, 700, 'boss', { boss: 'imugi', level: 12, atkCd: 1.1, glow: '#7fe0d0', desc: '용이 되지 못한 뱀. 물줄기를 뿜는다.' }),
  /* 15 */ M('boss_reaper', '저승사자', 3, 8800, 30, 66, 34, 3800, 1400, 'boss', { boss: 'reaper', level: 18, atkCd: 1.0, glow: '#b8a6ff', desc: '검은 갓의 사자. 순간이동하며 벤다.' }),
  /* 16 */ M('boss_gumiho', '구미호', 4, 14500, 30, 74, 40, 8000, 2600, 'boss', { boss: 'gumiho', level: 25, atkCd: 1.0, glow: '#ffb86b', desc: '아홉 꼬리의 여우. 꼬리마다 불을 쏜다.' }),
  /* 17 */ M('boss_bulgasari', '불가사리', 5, 1, 0, 70, 64, 0, 0, 'boss', { boss: 'bulgasari', level: 20, atkCd: 1.2, glow: '#ff5a3c', desc: '쇠를 먹고 자라는 불사의 괴수. 핏빛 달이 뜨면 나타난다.' }),
];
export const MON_IDX: Record<string, number> = Object.fromEntries(MONSTERS.map((m, i) => [m.key, i]));
export const GOLD_GOBLIN = MON_IDX.goldgob;
export const WORLD_BOSS = MON_IDX.boss_bulgasari;
export const isBossType = (t: number): boolean => MONSTERS[t].beh === 'boss';

export const hpMul = (lv: number): number => 1 + 0.16 * (lv - 1) + 0.006 * (lv - 1) * (lv - 1);
export const dmgMul = (lv: number): number => 1 + 0.13 * (lv - 1);
export const xpMul = (lv: number): number => 1 + 0.11 * (lv - 1);
