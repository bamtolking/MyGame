--!strict
-- 밤 이벤트: 몇몇 밤에는 규칙이 조금 바뀝니다. 밤 시작 때 큰 배너로 알립니다.

export type NightEvent = {
	id: string,
	name: string,
	desc: string,
	emoji: string,
	minNight: number,
	weight: number,
	countMult: number?, -- 손님 수 배율
	spawnMult: number?, -- 등장 간격 배율
	rewardMult: number?, -- 보상 배율
	tipMult: number?, -- 팁 배율
	patienceMult: number?, -- 인내심 배율
	extraOrder: boolean?, -- 모든 손님 주문 +1
	blackout: boolean?, -- 밤 중 정전 발생
}

local Events = {}

local list: { NightEvent } = {
	{ id = "rush", name = "폭주의 밤", desc = "손님이 더 많이, 더 빨리 옵니다. 보상 +30%", emoji = "⚡", minNight = 3, weight = 3, countMult = 1.2, spawnMult = 0.65, rewardMult = 1.3 },
	{ id = "golden", name = "황금의 밤", desc = "팁이 두 배! 빨리 서빙할수록 이득", emoji = "💰", minNight = 2, weight = 3, tipMult = 2 },
	{ id = "blackout", name = "정전의 밤", desc = "영업 중 갑자기 불이 꺼집니다. 조리대 위치를 외워 두세요", emoji = "🕯️", minNight = 4, weight = 2, blackout = true },
	{ id = "patient", name = "느긋한 밤", desc = "손님 인내심 +30%, 대신 보상 -10%", emoji = "🍵", minNight = 2, weight = 2, patienceMult = 1.3, rewardMult = 0.9 },
	{ id = "picky", name = "까다로운 밤", desc = "모든 손님이 요리를 하나 더 주문합니다. 보상 +25%", emoji = "🧐", minNight = 6, weight = 2, extraOrder = true, rewardMult = 1.25 },
}

Events.List = list
Events.ById = {} :: { [string]: NightEvent }
for _, e in list do
	Events.ById[e.id] = e
end

function Events.get(id: string?): NightEvent?
	if not id or id == "" then
		return nil
	end
	return Events.ById[id]
end

-- 이번 밤 이벤트 추첨. rng 는 Random 과 같은 인터페이스.
function Events.pick(night: number, rng: { NextNumber: (any) -> number }, chance: number, minNight: number): NightEvent?
	if night < minNight then
		return nil
	end
	if rng:NextNumber() >= chance then
		return nil
	end
	local candidates = {}
	local total = 0
	for _, e in list do
		if e.minNight <= night then
			table.insert(candidates, e)
			total += e.weight
		end
	end
	if #candidates == 0 then
		return nil
	end
	local r = rng:NextNumber() * total
	for _, e in candidates do
		r -= e.weight
		if r <= 0 then
			return e
		end
	end
	return candidates[#candidates]
end

return Events
