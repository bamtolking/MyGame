--!strict
-- 밤(웨이브) 구성: 손님 수, 등장 간격, 주문 요리, 인내심 보정.
-- rng 는 Roblox 의 Random 객체(또는 같은 메서드를 가진 테스트용 객체)입니다.

local Recipes = require(script.Parent.Recipes)
local CustomerTypes = require(script.Parent.CustomerTypes)

export type Rng = {
	NextNumber: (self: Rng) -> number,
	NextInteger: (self: Rng, min: number, max: number) -> number,
}

export type CustomerSpec = {
	typeId: string,
	dishes: { string },
	delay: number, -- 앞 손님 뒤로 몇 초 있다가 나오는지
}

export type Plan = {
	night: number,
	customers: { CustomerSpec },
	total: number,
}

local Waves = {}

-- 팀 인원에 따른 손님 수 배율 (1명 0.7 / 2명 0.85 / 3명 1.0 / 4명 1.15 / 6명 1.45)
function Waves.teamScale(playerCount: number): number
	local n = math.clamp(playerCount, 1, 6)
	return 0.55 + 0.15 * n
end

function Waves.customerCount(night: number, playerCount: number): number
	local base = 4 + 1.6 * (night - 1)
	return math.clamp(math.floor(base * Waves.teamScale(playerCount) + 0.5), 3, 40)
end

function Waves.spawnInterval(night: number): number
	return math.max(3.5, 9 - 0.45 * (night - 1))
end

-- 밤이 깊을수록 손님이 덜 기다림 (최저 70%)
function Waves.patienceMultiplier(night: number): number
	return math.max(0.7, 1 - 0.02 * (night - 1))
end

local function weightedPick(rng: Rng, entries: { { id: string, weight: number } }): string
	local total = 0
	for _, e in entries do
		total += e.weight
	end
	local r = rng:NextNumber() * total
	for _, e in entries do
		r -= e.weight
		if r <= 0 then
			return e.id
		end
	end
	return entries[#entries].id
end

-- 요리 추첨: 가장 최근에 해금된 요리를 조금 더 자주
local function pickDish(rng: Rng, pool: { string }, night: number): string
	local entries = {}
	for _, id in pool do
		local item = Recipes.Items[id]
		local w = 3
		if item and item.unlock and item.unlock >= night - 1 then
			w = 5
		end
		table.insert(entries, { id = id, weight = w })
	end
	return weightedPick(rng, entries)
end

export type EventMods = { countMult: number?, spawnMult: number?, extraOrder: boolean? }

function Waves.plan(night: number, playerCount: number, rng: Rng, mods: EventMods?): Plan
	local pool = Recipes.dishesForNight(night)
	local count = Waves.customerCount(night, playerCount)
	local interval = Waves.spawnInterval(night)
	if mods then
		if mods.countMult then
			count = math.clamp(math.floor(count * mods.countMult + 0.5), 3, 40)
		end
		if mods.spawnMult then
			interval = math.max(2.5, interval * mods.spawnMult)
		end
	end
	local weights = CustomerTypes.weightsForNight(night)
	local customers: { CustomerSpec } = {}

	for i = 1, count do
		local typeId = weightedPick(rng, weights)
		local ctype = CustomerTypes.get(typeId)
		local orderCount = ctype.orders
		if mods and mods.extraOrder then
			orderCount = math.min(3, orderCount + 1)
		end
		local dishes = {}
		for _ = 1, orderCount do
			table.insert(dishes, pickDish(rng, pool, night))
		end
		-- 첫 손님은 바로, 그 뒤는 간격 ± 25%
		local delay = if i == 1 then 1 else interval * (0.75 + 0.5 * rng:NextNumber())
		table.insert(customers, { typeId = typeId, dishes = dishes, delay = delay })
	end

	if CustomerTypes.bossNight(night) then
		local boss = CustomerTypes.get("sansin")
		local dishes = {}
		for _ = 1, boss.orders do
			table.insert(dishes, pickDish(rng, pool, night))
		end
		table.insert(customers, { typeId = "sansin", dishes = dishes, delay = interval * 1.5 })
	end

	return { night = night, customers = customers, total = #customers }
end

-- 손님이 카운터에 서서 기다려 주는 시간(초)
function Waves.patienceFor(typeId: string, night: number, smileLevel: number, patienceMult: (number) -> number): number
	local ctype = CustomerTypes.get(typeId)
	return ctype.patience * Waves.patienceMultiplier(night) * patienceMult(smileLevel)
end

return Waves
