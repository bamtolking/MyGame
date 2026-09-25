--!strict
-- 일일 퀘스트 · 출석 · 접속 선물 · 대폭주 시각 계산(순수 함수).

local Shared = script.Parent.Parent
local Rewards = require(Shared.Config.Rewards)
local Weather = require(Shared.Config.Weather)
local Rng = require(Shared.Util.Rng)
local Types = require(Shared.Types)

type PlayerData = Types.PlayerData
type QuestState = Types.QuestState

local Progress = {}

local DAY = 86400

-- UTC 기준 날짜 번호
function Progress.dayNumber(unixTime: number): number
	return math.floor(unixTime / DAY)
end

function Progress.secondsUntilNextDay(unixTime: number): number
	return DAY - (unixTime % DAY)
end

-- 오늘의 퀘스트 3개(유저·날짜별로 고정)
function Progress.generateQuests(day: number, userId: number): { QuestState }
	local rng = Rng.new(day * 7919 + (userId % 1000003) * 31 + 17)
	local pool = table.clone(Rewards.quests)
	local out: { QuestState } = {}
	for _ = 1, math.min(Rewards.questsPerDay, #pool) do
		local i = rng:int(1, #pool)
		local def = table.remove(pool, i) :: Rewards.QuestDef
		local goal = def.goals[rng:int(1, #def.goals)]
		table.insert(out, { id = def.id, goal = goal, progress = 0, claimed = false })
	end
	return out
end

-- 날짜가 바뀌었으면 퀘스트를 새로 뽑습니다. 바뀌었으면 true
function Progress.refreshQuests(data: PlayerData, now: number, userId: number): boolean
	local day = Progress.dayNumber(now)
	if data.quests.day == day and #data.quests.list > 0 then
		return false
	end
	data.quests.day = day
	data.quests.list = Progress.generateQuests(day, userId)
	data.quests.bonusClaimed = false
	return true
end

-- 퀘스트 진행 이벤트. 진행도가 바뀌었으면 true
function Progress.questEvent(data: PlayerData, kind: string, amount: number): boolean
	local changed = false
	for _, q in data.quests.list do
		local def = Rewards.questById[q.id]
		if def and def.kind == kind and not q.claimed and q.progress < q.goal then
			q.progress = math.min(q.goal, q.progress + amount)
			changed = true
		end
	end
	return changed
end

function Progress.allQuestsClaimed(data: PlayerData): boolean
	if #data.quests.list == 0 then
		return false
	end
	for _, q in data.quests.list do
		if not q.claimed then
			return false
		end
	end
	return true
end

-- 출석 보상 상태: (오늘 받을 수 있나?, 받게 될 날짜 칸 1~7)
function Progress.dailyStatus(data: PlayerData, now: number): (boolean, number)
	local day = Progress.dayNumber(now)
	if data.daily.lastDay == day then
		return false, math.max(1, data.daily.streak)
	end
	local streak = data.daily.streak
	if data.daily.lastDay ~= day - 1 or streak >= #Rewards.daily then
		streak = 0 -- 하루 빠졌거나 7일 완주 → 1일차부터
	end
	return true, streak + 1
end

-- 출석 처리. 받은 칸 번호 반환(못 받으면 nil)
function Progress.claimDaily(data: PlayerData, now: number): number?
	local can, slot = Progress.dailyStatus(data, now)
	if not can then
		return nil
	end
	data.daily.streak = slot
	data.daily.lastDay = Progress.dayNumber(now)
	return slot
end

-- 접속 선물 i를 지금 받을 수 있나
function Progress.giftReady(i: number, sessionSeconds: number): boolean
	local g = Rewards.gifts[i]
	return g ~= nil and sessionSeconds >= g.minutes * 60
end

-- 대폭주: 매시 정각(UTC)부터 duration초
function Progress.frenzyActive(unixTime: number): boolean
	return unixTime % 3600 < Weather.frenzy.duration
end

function Progress.frenzyEndsAt(unixTime: number): number
	return unixTime - unixTime % 3600 + Weather.frenzy.duration
end

function Progress.secondsUntilFrenzy(unixTime: number): number
	if Progress.frenzyActive(unixTime) then
		return 0
	end
	return 3600 - unixTime % 3600
end

return Progress
