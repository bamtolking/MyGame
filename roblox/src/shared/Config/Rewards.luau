--!strict
-- 보상 표: 7일 출석, 접속 선물, 일일 퀘스트.
-- 보상 형식(Reward):
--   cashMinutes/minCash : 현재 수입 N분치 현금(최소 minCash)
--   boost/seconds       : 개인 부스트("cash2x")
--   giftRarity          : 해당 등급 이상 슬라임 1마리(빈 발판 없으면 판매가 현금)
--   serverLuck          : 서버 전체 행운 ×2 (초)

export type Reward = {
	cashMinutes: number?,
	minCash: number?,
	boost: string?,
	seconds: number?,
	giftRarity: string?,
	serverLuck: number?,
}

export type QuestDef = {
	id: string,
	kind: string,
	goals: { number },
	text: { en: string, ko: string },
	reward: Reward,
}

local daily: { Reward } = {
	{ cashMinutes = 3, minCash = 300 },
	{ boost = "cash2x", seconds = 600 },
	{ cashMinutes = 8, minCash = 800 },
	{ serverLuck = 300 },
	{ cashMinutes = 15, minCash = 2000 },
	{ boost = "cash2x", seconds = 1200 },
	{ giftRarity = "epic" },
}

export type Gift = { minutes: number, reward: Reward }

local gifts: { Gift } = {
	{ minutes = 2, reward = { cashMinutes = 2, minCash = 150 } },
	{ minutes = 5, reward = { boost = "cash2x", seconds = 300 } },
	{ minutes = 10, reward = { giftRarity = "uncommon" } },
	{ minutes = 15, reward = { cashMinutes = 5, minCash = 1000 } },
	{ minutes = 25, reward = { giftRarity = "rare" } },
	{ minutes = 40, reward = { boost = "cash2x", seconds = 900 } },
	{ minutes = 60, reward = { giftRarity = "epic" } },
}

local quests: { QuestDef } = {
	{
		id = "buy",
		kind = "buy",
		goals = { 8, 12, 20 },
		text = { en = "Buy {n} slimes", ko = "슬라임 {n}마리 구매하기" },
		reward = { cashMinutes = 5, minCash = 500 },
	},
	{
		id = "buyRare",
		kind = "buyRare",
		goals = { 1, 2 },
		text = { en = "Buy {n} Rare+ slimes", ko = "희귀 이상 슬라임 {n}마리 구매하기" },
		reward = { cashMinutes = 8, minCash = 800 },
	},
	{
		id = "merge",
		kind = "merge",
		goals = { 1, 2, 3 },
		text = { en = "Merge slimes {n} times", ko = "슬라임 {n}번 합성하기" },
		reward = { cashMinutes = 8, minCash = 800 },
	},
	{
		id = "steal",
		kind = "steal",
		goals = { 1, 2 },
		text = { en = "Steal {n} slimes", ko = "슬라임 {n}마리 훔치기" },
		reward = { cashMinutes = 10, minCash = 1000 },
	},
	{
		id = "bonk",
		kind = "bonk",
		goals = { 10, 20 },
		text = { en = "Bonk players {n} times", ko = "뿅망치로 {n}번 때리기" },
		reward = { cashMinutes = 5, minCash = 500 },
	},
	{
		id = "defend",
		kind = "defend",
		goals = { 1 },
		text = { en = "Bonk a thief {n} time", ko = "도둑을 {n}번 저지하기" },
		reward = { boost = "cash2x", seconds = 600 },
	},
	{
		id = "collect",
		kind = "collect",
		goals = { 10, 20 },
		text = { en = "Collect cash {n} times", ko = "수금 {n}번 하기" },
		reward = { cashMinutes = 4, minCash = 400 },
	},
	{
		id = "play",
		kind = "playtime",
		goals = { 600, 1200 },
		text = { en = "Play for {t}", ko = "{t} 동안 플레이하기" },
		reward = { cashMinutes = 6, minCash = 600 },
	},
	{
		id = "upgrade",
		kind = "upgrade",
		goals = { 2, 3 },
		text = { en = "Buy {n} upgrades", ko = "업그레이드 {n}번 하기" },
		reward = { cashMinutes = 6, minCash = 600 },
	},
}

local questById: { [string]: QuestDef } = {}
for _, q in quests do
	questById[q.id] = q
end

return {
	daily = daily,
	gifts = gifts,
	quests = quests,
	questById = questById,
	questsPerDay = 3,
	questAllBonus = { giftRarity = "rare" } :: Reward,
}
