--!strict
-- 뽑기(순수 함수). rand는 [0,1) 난수를 돌려주는 함수입니다.

local Shared = script.Parent.Parent
local Rarities = require(Shared.Config.Rarities)
local Slimes = require(Shared.Config.Slimes)
local Mutations = require(Shared.Config.Mutations)
local Weather = require(Shared.Config.Weather)

type Rand = () -> number

local Roll = {}

-- 행운이 등급 가중치에 주는 효과: 영웅 이상 ×luck, 희귀 ×√luck, 일반·고급은 그대로.
-- (희귀까지 크게 올리면 전체 합이 커져서 전설 이상 확률이 덜 오르므로)
function Roll.rarityWeight(order: number, baseWeight: number, luck: number): number
	if order >= 4 then
		return baseWeight * luck
	elseif order == 3 then
		return baseWeight * math.sqrt(luck)
	end
	return baseWeight
end

function Roll.pickWeighted<T>(items: { T }, weightOf: (T) -> number, rand: Rand): T
	local total = 0
	for _, item in items do
		total += math.max(0, weightOf(item))
	end
	local r = rand() * total
	for _, item in items do
		local w = math.max(0, weightOf(item))
		if r < w then
			return item
		end
		r -= w
	end
	return items[#items]
end

-- 등급 확률표(합=1). UI 표시와 테스트에 사용
function Roll.rarityChances(luck: number, minOrder: number?): { [string]: number }
	local total = 0
	for _, r in Rarities.list do
		if r.order >= (minOrder or 1) then
			total += Roll.rarityWeight(r.order, r.weight, luck)
		end
	end
	local out = {}
	for _, r in Rarities.list do
		if r.order >= (minOrder or 1) then
			out[r.id] = Roll.rarityWeight(r.order, r.weight, luck) / total
		else
			out[r.id] = 0
		end
	end
	return out
end

function Roll.rarity(luck: number, rand: Rand, minOrder: number?): string
	local pool = {}
	for _, r in Rarities.list do
		if r.order >= (minOrder or 1) then
			table.insert(pool, r)
		end
	end
	local picked = Roll.pickWeighted(pool, function(r)
		return Roll.rarityWeight(r.order, r.weight, luck)
	end, rand)
	return picked.id
end

-- 같은 등급 안에서는 싼 슬라임이 더 자주 나옵니다(가중치 n, n-1, ..., 1)
function Roll.species(rarityId: string, rand: Rand): string
	local bucket = Slimes.byRarity[rarityId]
	assert(bucket and #bucket > 0, "no slimes for rarity " .. rarityId)
	local n = #bucket
	local indices = {}
	for i = 1, n do
		indices[i] = i
	end
	local i = Roll.pickWeighted(indices, function(idx)
		return n - idx + 1
	end, rand)
	return bucket[i].id
end

-- 행운의 손길/평상시 변이: luckWeight 기준
function Roll.randomMutation(rand: Rand): string
	local pool = {}
	for _, m in Mutations.list do
		if m.luckWeight > 0 then
			table.insert(pool, m)
		end
	end
	return Roll.pickWeighted(pool, function(m)
		return m.luckWeight
	end, rand).id
end

-- 행진 슬라임 변이: 날씨 변이 우선, 없으면 평상시 확률
function Roll.paradeMutation(weatherMutation: string?, rand: Rand): string
	if weatherMutation and rand() < Weather.paradeMutationChance then
		return weatherMutation
	end
	if rand() < Weather.ambientMutationChance then
		return Roll.randomMutation(rand)
	end
	return "none"
end

-- 더 좋은 변이인가?
function Roll.isBetterMutation(new: string, old: string): boolean
	local a, b = Mutations.byId[new], Mutations.byId[old]
	if not a then
		return false
	end
	if not b then
		return true
	end
	return a.mult > b.mult
end

return Roll
