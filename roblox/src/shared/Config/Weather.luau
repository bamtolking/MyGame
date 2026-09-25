--!strict
-- 날씨 이벤트. 이벤트 중 행진 슬라임과 기지 슬라임에 변이가 붙습니다.
-- 새 날씨 추가 = events에 한 줄(변이 id는 Mutations에 있어야 함).

export type WeatherEvent = {
	id: string,
	name: { en: string, ko: string },
	desc: { en: string, ko: string },
	mutation: string,
	duration: number,
	weight: number,
	luck: number, -- 이벤트 중 서버 행운 배수
	-- 연출(클라이언트)
	clockTime: number,
	ambient: Color3,
	tint: Color3,
	fog: Color3,
	particle: string, -- "rain" | "snow" | "sparkle" | "ember" | "stars" | "candy"
	particleColor: Color3,
}

local rgb = Color3.fromRGB

local events: { WeatherEvent } = {
	{
		id = "golden",
		name = { en = "Golden Hour", ko = "황금 시간" },
		desc = { en = "Slimes may turn GOLD (x2)!", ko = "슬라임이 황금(×2)으로 변할 수 있어요!" },
		mutation = "gold",
		duration = 120,
		weight = 35,
		luck = 1,
		clockTime = 17.6,
		ambient = rgb(150, 120, 70),
		tint = rgb(255, 225, 160),
		fog = rgb(255, 210, 140),
		particle = "sparkle",
		particleColor = rgb(255, 220, 90),
	},
	{
		id = "crystal",
		name = { en = "Crystal Storm", ko = "수정 폭풍" },
		desc = { en = "Slimes may turn DIAMOND (x3)!", ko = "슬라임이 다이아(×3)로 변할 수 있어요!" },
		mutation = "diamond",
		duration = 120,
		weight = 25,
		luck = 1,
		clockTime = 9,
		ambient = rgb(110, 150, 190),
		tint = rgb(200, 235, 255),
		fog = rgb(190, 230, 255),
		particle = "snow",
		particleColor = rgb(200, 245, 255),
	},
	{
		id = "sugar",
		name = { en = "Sugar Rush", ko = "슈가 러시" },
		desc = { en = "Slimes may turn CANDY (x4)!", ko = "슬라임이 사탕(×4)으로 변할 수 있어요!" },
		mutation = "candy",
		duration = 120,
		weight = 18,
		luck = 1.5,
		clockTime = 13,
		ambient = rgb(170, 110, 150),
		tint = rgb(255, 205, 235),
		fog = rgb(255, 190, 225),
		particle = "candy",
		particleColor = rgb(255, 140, 210),
	},
	{
		id = "volcano",
		name = { en = "Volcano Eruption", ko = "화산 폭발" },
		desc = { en = "Slimes may turn LAVA (x5)!", ko = "슬라임이 용암(×5)으로 변할 수 있어요!" },
		mutation = "lava",
		duration = 120,
		weight = 12,
		luck = 1.5,
		clockTime = 19.2,
		ambient = rgb(160, 70, 40),
		tint = rgb(255, 190, 160),
		fog = rgb(120, 50, 30),
		particle = "ember",
		particleColor = rgb(255, 120, 40),
	},
	{
		id = "rainbow",
		name = { en = "Rainbow Storm", ko = "무지개 폭풍" },
		desc = { en = "Slimes may turn RAINBOW (x7)!", ko = "슬라임이 무지개(×7)로 변할 수 있어요!" },
		mutation = "rainbow",
		duration = 150,
		weight = 7,
		luck = 2,
		clockTime = 12,
		ambient = rgb(150, 140, 180),
		tint = rgb(240, 230, 255),
		fog = rgb(230, 210, 255),
		particle = "rain",
		particleColor = rgb(255, 255, 255),
	},
	{
		id = "meteor",
		name = { en = "Meteor Shower", ko = "유성우" },
		desc = { en = "Slimes may turn GALAXY (x10)!", ko = "슬라임이 은하(×10)로 변할 수 있어요!" },
		mutation = "galaxy",
		duration = 150,
		weight = 3,
		luck = 3,
		clockTime = 0.5,
		ambient = rgb(70, 60, 130),
		tint = rgb(190, 180, 255),
		fog = rgb(30, 20, 70),
		particle = "stars",
		particleColor = rgb(200, 180, 255),
	},
}

local byId: { [string]: WeatherEvent } = {}
for _, e in events do
	byId[e.id] = e
end

return {
	events = events,
	byId = byId,
	calmDuration = 240, -- 이벤트 사이 맑은 시간(초)
	paradeMutationChance = 0.3, -- 이벤트 중 행진 슬라임에 이벤트 변이가 붙을 확률
	baseMutationChance = 0.02, -- 이벤트 중 기지 슬라임이 10초마다 변이를 얻을 확률
	baseMutationInterval = 10,
	-- 평상시 행진 슬라임 변이 확률(날씨 무관)
	ambientMutationChance = 0.03,
	-- 슬라임 대폭주: 매시 정각(UTC)부터 frenzyDuration초
	frenzy = {
		duration = 180,
		luck = 5,
		incomeMult = 2,
		events = { "rainbow", "meteor" },
	},
}
