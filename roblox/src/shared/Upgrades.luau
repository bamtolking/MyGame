--!strict
-- 낮에 살 수 있는 팀 업그레이드(한 판 동안만 유지). 코인은 팀 공용입니다.

export type Upgrade = {
	id: string,
	name: string,
	desc: string,
	max: number,
	costs: { number }?, -- 단계별 가격
	costBase: number?, -- 반복 구매형: costBase + costStep × 현재 단계
	costStep: number?,
	emoji: string?,
}

local Upgrades = {}

local upgradeList: { Upgrade } = {
	{ id = "knife", name = "날카로운 칼", desc = "칼질 시간 -25% (단계당)", max = 3, costs = { 30, 60, 100 }, emoji = "🔪" },
	{ id = "fire", name = "센 불", desc = "익히는 시간 -15% (단계당)", max = 3, costs = { 40, 80, 130 }, emoji = "🔥" },
	{ id = "smile", name = "친절한 미소", desc = "손님 인내심 +12% (단계당)", max = 3, costs = { 35, 70, 120 }, emoji = "😊" },
	{ id = "shoes", name = "빠른 신발", desc = "모든 요리사 이동 속도 +2 (단계당)", max = 3, costs = { 40, 80, 120 }, emoji = "👟" },
	{ id = "pot", name = "냄비 추가", desc = "냄비 1개를 더 씁니다", max = 2, costs = { 60, 120 }, emoji = "🍲" },
	{ id = "griddle", name = "화덕 추가", desc = "화덕 1개를 더 씁니다", max = 1, costs = { 70 }, emoji = "🥞" },
	{ id = "fryer", name = "튀김기 추가", desc = "튀김기 1개를 더 씁니다", max = 1, costs = { 70 }, emoji = "🍤" },
	{ id = "ricecooker", name = "밥솥 추가", desc = "밥솥 1개를 더 씁니다", max = 1, costs = { 60 }, emoji = "🍚" },
	{ id = "repair", name = "평판 수리", desc = "평판 +25 (살 때마다 값이 오름)", max = 99, costBase = 50, costStep = 10, emoji = "🛠️" },
}

Upgrades.List = upgradeList
Upgrades.ById = {} :: { [string]: Upgrade }
for _, u in upgradeList do
	Upgrades.ById[u.id] = u
end

-- 현재 단계(level)에서 다음 단계를 사는 값. 최대면 nil.
function Upgrades.cost(id: string, level: number): number?
	local u = Upgrades.ById[id]
	if not u or level >= u.max then
		return nil
	end
	if u.costs then
		return u.costs[level + 1]
	end
	return (u.costBase or 0) + (u.costStep or 0) * level
end

function Upgrades.chopMult(level: number): number
	return math.max(0.25, 1 - 0.25 * level)
end

function Upgrades.cookMult(level: number): number
	return math.max(0.4, 1 - 0.15 * level)
end

function Upgrades.patienceMult(level: number): number
	return 1 + 0.12 * level
end

function Upgrades.walkSpeedBonus(level: number, perLevel: number): number
	return perLevel * level
end

Upgrades.RepairAmount = 25

return Upgrades
