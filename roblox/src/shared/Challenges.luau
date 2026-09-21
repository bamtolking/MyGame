--!strict
-- 밤 목표: 매 밤(2번째 밤부터) 하나씩 주어지는 도전 과제. 달성하면 보너스 코인.

export type Challenge = {
	id: string,
	name: string,
	desc: string,
	emoji: string,
	reward: number,
	stat: string, -- 밤 통계 키
	target: number,
	mode: "min" | "max", -- min: stat >= target 이면 성공 / max: 밤 끝까지 stat <= target 유지
	minNight: number,
}

export type NightStats = { [string]: any } -- 숫자 통계 + perPlayer 같은 표

local Challenges = {}

local list: { Challenge } = {
	{ id = "noburn", name = "무사고 영업", desc = "탄 음식 0개로 밤 넘기기", emoji = "🧑‍🍳", reward = 20, stat = "burnt", target = 0, mode = "max", minNight = 2 },
	{ id = "tips", name = "팁 부자", desc = "팁 5번 받기", emoji = "💸", reward = 25, stat = "tips", target = 5, mode = "min", minNight = 2 },
	{ id = "combo", name = "연속 서빙", desc = "콤보 x4 달성", emoji = "🔥", reward = 25, stat = "maxCombo", target = 4, mode = "min", minNight = 3 },
	{ id = "perfect", name = "완벽한 밤", desc = "악귀 0명으로 밤 넘기기", emoji = "🌟", reward = 35, stat = "angry", target = 0, mode = "max", minNight = 3 },
	{ id = "fast", name = "번개 서빙", desc = "인내심 70% 이상 남았을 때 서빙 4번", emoji = "⚡", reward = 25, stat = "fastServes", target = 4, mode = "min", minNight = 2 },
	{ id = "nofire", name = "화재 예방", desc = "화재 0건으로 밤 넘기기", emoji = "🧯", reward = 20, stat = "fires", target = 0, mode = "max", minNight = 4 },
}

Challenges.List = list
Challenges.ById = {} :: { [string]: Challenge }
for _, c in list do
	Challenges.ById[c.id] = c
end

function Challenges.get(id: string?): Challenge?
	if not id or id == "" then
		return nil
	end
	return Challenges.ById[id]
end

function Challenges.pick(night: number, rng: { NextInteger: (any, number, number) -> number }): Challenge?
	local candidates = {}
	for _, c in list do
		if c.minNight <= night then
			table.insert(candidates, c)
		end
	end
	if #candidates == 0 then
		return nil
	end
	return candidates[rng:NextInteger(1, #candidates)]
end

function Challenges.value(c: Challenge, stats: NightStats): number
	local v = stats[c.stat]
	return if type(v) == "number" then v else 0
end

-- 지금 시점 기준 달성 여부 (max 모드는 "아직 지키고 있음")
function Challenges.done(c: Challenge, stats: NightStats): boolean
	local v = Challenges.value(c, stats)
	if c.mode == "min" then
		return v >= c.target
	end
	return v <= c.target
end

-- HUD 문구
function Challenges.text(c: Challenge, stats: NightStats): string
	local v = Challenges.value(c, stats)
	if c.mode == "min" then
		return string.format("%s %s  %d/%d  (+%d)", c.emoji, c.name, math.min(v, c.target), c.target, c.reward)
	end
	if v <= c.target then
		return string.format("%s %s  유지 중  (+%d)", c.emoji, c.name, c.reward)
	end
	return string.format("%s %s  실패", c.emoji, c.name)
end

return Challenges
