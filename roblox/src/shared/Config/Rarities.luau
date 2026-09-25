--!strict
-- 등급 정의. order가 클수록 희귀합니다.
-- weight: 행진 등장 가중치(서버 행운 1배 기준), payback: 가격 = 수입 × payback(초)
-- stealHold: 훔치기 길게 누르기 시간(초), carryWeight: 들고 갈 때 속도 감소량(0~1)

export type Rarity = {
	id: string,
	order: number,
	name: { en: string, ko: string },
	color: Color3,
	weight: number,
	payback: number,
	stealHold: number,
	carryWeight: number,
	announce: boolean,
	glow: boolean,
}

local list: { Rarity } = {
	{
		id = "common",
		order = 1,
		name = { en = "Common", ko = "일반" },
		color = Color3.fromRGB(190, 196, 204),
		weight = 55,
		payback = 20,
		stealHold = 1.0,
		carryWeight = 0.10,
		announce = false,
		glow = false,
	},
	{
		id = "uncommon",
		order = 2,
		name = { en = "Uncommon", ko = "고급" },
		color = Color3.fromRGB(96, 214, 96),
		weight = 28,
		payback = 35,
		stealHold = 1.2,
		carryWeight = 0.16,
		announce = false,
		glow = false,
	},
	{
		id = "rare",
		order = 3,
		name = { en = "Rare", ko = "희귀" },
		color = Color3.fromRGB(70, 150, 255),
		weight = 12,
		payback = 60,
		stealHold = 1.5,
		carryWeight = 0.24,
		announce = false,
		glow = false,
	},
	{
		id = "epic",
		order = 4,
		name = { en = "Epic", ko = "영웅" },
		color = Color3.fromRGB(176, 92, 255),
		weight = 4,
		payback = 100,
		stealHold = 1.8,
		carryWeight = 0.32,
		announce = false,
		glow = false,
	},
	{
		id = "legendary",
		order = 5,
		name = { en = "Legendary", ko = "전설" },
		color = Color3.fromRGB(255, 186, 36),
		weight = 0.85,
		payback = 150,
		stealHold = 2.2,
		carryWeight = 0.40,
		announce = true,
		glow = true,
	},
	{
		id = "mythic",
		order = 6,
		name = { en = "Mythic", ko = "신화" },
		color = Color3.fromRGB(255, 64, 120),
		weight = 0.13,
		payback = 220,
		stealHold = 2.6,
		carryWeight = 0.46,
		announce = true,
		glow = true,
	},
	{
		id = "secret",
		order = 7,
		name = { en = "SECRET", ko = "비밀" },
		color = Color3.fromRGB(30, 30, 36),
		weight = 0.02,
		payback = 320,
		stealHold = 3.0,
		carryWeight = 0.52,
		announce = true,
		glow = true,
	},
}

local byId: { [string]: Rarity } = {}
for _, r in list do
	byId[r.id] = r
end

return {
	list = list,
	byId = byId,
	count = #list,
}
