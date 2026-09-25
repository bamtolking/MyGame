--!strict
-- 변이 정의. 새 변이 추가 = list에 한 줄 + (선택) SlimeBuilder의 look 처리.
--   mult       : 수입·가치 배수
--   luckWeight : "행운의 손길"(구매 시 무작위 변이)에서의 가중치
--   color      : 몸 색(nil이면 원래 색 유지), material: 몸 재질 이름
--   label      : 머리 위 표시 색

export type Mutation = {
	id: string,
	order: number,
	name: { en: string, ko: string },
	mult: number,
	luckWeight: number,
	color: Color3?,
	material: string?,
	transparency: number?,
	reflectance: number?,
	label: Color3,
	sparkle: Color3?,
	light: Color3?,
}

local rgb = Color3.fromRGB

local list: { Mutation } = {
	{
		id = "none",
		order = 0,
		name = { en = "Normal", ko = "일반" },
		mult = 1,
		luckWeight = 0,
		label = rgb(255, 255, 255),
	},
	{
		id = "gold",
		order = 1,
		name = { en = "Gold", ko = "황금" },
		mult = 2,
		luckWeight = 60,
		color = rgb(255, 200, 40),
		material = "Foil",
		reflectance = 0.2,
		label = rgb(255, 210, 60),
		sparkle = rgb(255, 230, 120),
	},
	{
		id = "diamond",
		order = 2,
		name = { en = "Diamond", ko = "다이아" },
		mult = 3,
		luckWeight = 25,
		color = rgb(170, 240, 255),
		material = "Glass",
		transparency = 0.25,
		reflectance = 0.35,
		label = rgb(140, 230, 255),
		sparkle = rgb(220, 250, 255),
	},
	{
		id = "candy",
		order = 3,
		name = { en = "Candy", ko = "사탕" },
		mult = 4,
		luckWeight = 10,
		color = rgb(255, 130, 200),
		material = "SmoothPlastic",
		label = rgb(255, 140, 210),
		sparkle = rgb(255, 200, 235),
	},
	{
		id = "lava",
		order = 4,
		name = { en = "Lava", ko = "용암" },
		mult = 5,
		luckWeight = 4,
		color = rgb(255, 90, 20),
		material = "CrackedLava",
		label = rgb(255, 120, 40),
		light = rgb(255, 120, 40),
	},
	{
		id = "rainbow",
		order = 5,
		name = { en = "Rainbow", ko = "무지개" },
		mult = 7,
		luckWeight = 0.9,
		color = rgb(255, 80, 80),
		material = "SmoothPlastic",
		label = rgb(255, 120, 255),
		sparkle = rgb(255, 255, 255),
	},
	{
		id = "galaxy",
		order = 6,
		name = { en = "Galaxy", ko = "은하" },
		mult = 10,
		luckWeight = 0.1,
		color = rgb(90, 40, 200),
		material = "ForceField",
		label = rgb(170, 120, 255),
		sparkle = rgb(200, 180, 255),
		light = rgb(140, 90, 255),
	},
}

local byId: { [string]: Mutation } = {}
for _, m in list do
	byId[m.id] = m
end

return {
	list = list,
	byId = byId,
}
