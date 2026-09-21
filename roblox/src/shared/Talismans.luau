--!strict
-- 부적: 서빙으로 채우는 팀 게이지가 가득 차면 누구나 하나를 골라 씁니다.
export type Talisman = { id: string, name: string, desc: string, emoji: string, key: string }

local Talismans = {}

local list: { Talisman } = {
	{ id = "time", name = "시간 부적", desc = "기다리는 손님 전원의 인내심 +12초", emoji = "⏳", key = "1" },
	{ id = "calm", name = "평온 부적", desc = "난동 중인 악귀를 모두 진정시켜 돌려보냄", emoji = "🕊️", key = "2" },
	{ id = "fortune", name = "풍요 부적", desc = "20초 동안 모든 보상 ×1.5", emoji = "💰", key = "3" },
}

Talismans.List = list
Talismans.ById = {} :: { [string]: Talisman }
for _, t in list do
	Talismans.ById[t.id] = t
end

function Talismans.get(id: string?): Talisman?
	if not id then
		return nil
	end
	return Talismans.ById[id]
end

return Talismans
