--!strict
-- 유물: 보스 밤(5·10·15…)을 넘기면 도깨비 상인이 3개를 제시하고, 팀 투표로 하나를 고릅니다. 한 판 동안 유지.
export type Relic = { id: string, name: string, desc: string, emoji: string }

local Relics = {}

local list: { Relic } = {
	{ id = "ladle", name = "황금 국자", desc = "팁 +50%", emoji = "🥄" },
	{ id = "club", name = "도깨비 방망이", desc = "악귀 난동 피해 -50%", emoji = "🏏" },
	{ id = "sturdy", name = "튼튼한 조리대", desc = "부서진 조리대 복구 시간 절반", emoji = "🔧" },
	{ id = "fireward", name = "불꽃 수호 부적", desc = "불이 번지지 않고, 발화까지 시간 2배", emoji = "🛡️" },
	{ id = "smile", name = "다정한 미소", desc = "손님 인내심 +15%", emoji = "😊" },
	{ id = "wind", name = "바람 신발", desc = "모든 요리사 이동 속도 +3", emoji = "🌬️" },
	{ id = "pouch", name = "복주머니", desc = "밤 클리어 보너스 2배", emoji = "👛" },
	{ id = "iceladle", name = "얼음 국자", desc = "완성 후 타기까지 시간 2배", emoji = "🧊" },
	{ id = "ink", name = "부적 먹물", desc = "부적 게이지가 50% 더 빨리 참", emoji = "🖌️" },
}

Relics.List = list
Relics.ById = {} :: { [string]: Relic }
for _, r in list do
	Relics.ById[r.id] = r
end

function Relics.get(id: string?): Relic?
	if not id then
		return nil
	end
	return Relics.ById[id]
end

-- 아직 없는 유물 중 count 개를 무작위로 (부족하면 있는 만큼)
function Relics.offer(owned: { [string]: boolean }, rng: any, count: number): { string }
	local pool = {}
	for _, r in list do
		if not owned[r.id] then
			table.insert(pool, r.id)
		end
	end
	local out = {}
	while #out < count and #pool > 0 do
		local idx = rng:NextInteger(1, #pool)
		table.insert(out, pool[idx])
		table.remove(pool, idx)
	end
	return out
end

-- 투표 집계: votes[userId] = 후보 번호. 최다 득표(동률이면 rng). 표가 없으면 nil.
function Relics.tally(offer: { string }, votes: { [any]: number }, rng: any): string?
	if #offer == 0 then
		return nil
	end
	local counts = {}
	for i = 1, #offer do
		counts[i] = 0
	end
	local any = false
	for _, idx in votes do
		if counts[idx] then
			counts[idx] += 1
			any = true
		end
	end
	if not any then
		return nil
	end
	local best = 0
	for i = 1, #offer do
		best = math.max(best, counts[i])
	end
	local winners = {}
	for i = 1, #offer do
		if counts[i] == best then
			table.insert(winners, i)
		end
	end
	return offer[winners[rng:NextInteger(1, #winners)]]
end

return Relics
