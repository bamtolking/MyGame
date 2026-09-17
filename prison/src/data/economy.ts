export type SecurityLevel = 'min' | 'med' | 'max';
export const SECURITY_INFO: Record<SecurityLevel, { name: string; grant: number; color: string; volatility: number; hp: number; attack: number; desc: string }> = {
  min: { name: '최소 보안', grant: 110, color: '#ffa726', volatility: 0.6, hp: 90, attack: 6, desc: '얌전하고 보조금이 적음' },
  med: { name: '일반 보안', grant: 160, color: '#ff7043', volatility: 1.0, hp: 100, attack: 8, desc: '표준' },
  max: { name: '최고 보안', grant: 240, color: '#e53935', volatility: 1.7, hp: 120, attack: 11, desc: '위험하지만 보조금이 큼. 5장 이후 해금' },
};
export const START_MONEY = 25000;
export const BANKRUPT_LIMIT = -8000;
export const MEAL_INGREDIENT_COST = 3;
export const MEALS_PER_COOK_HOUR = 8;
export const WORK_INCOME_PER_HOUR = 14;
export const OFFICE_GRANT_BONUS = 0.10;
export const FINE_ESCAPE = 1500;
export const FINE_DEATH = 2500;
export const RELEASE_BONUS = 300;
export const REP_ESCAPE = -8;
export const REP_DEATH = -10;
export const REP_RIOT = -5;
export const REP_RELEASE = 2;
export const REP_CHAPTER = 5;
export const RIOT_SQUAD_COST = 1500;
export const RIOT_SQUAD_SIZE = 4;
export const RIOT_SQUAD_HOURS = 24;
export const INTAKE_HOUR = 8;
export const MAX_INTAKE_PER_DAY = 6;
export const STAFF_FIRE_REFUND = 0;
