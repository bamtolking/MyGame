--!strict
-- 성장·보상: 업그레이드, 환생, 일일 퀘스트, 7일 출석, 접속 선물, 오프라인 수입, 튜토리얼, 설정.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Economy = require(Shared.Config.Economy)
local Rewards = require(Shared.Config.Rewards)
local Calc = require(Shared.Logic.Calc)
local Progress = require(Shared.Logic.Progress)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local Bus = require(Server.Bus)
local Remote = require(Server.Remote)
local EconomyService = require(script.Parent.EconomyService)
local PlotService = require(script.Parent.PlotService)
local SlimeService = require(script.Parent.SlimeService)
local StealService = require(script.Parent.StealService)
local WeatherService = require(script.Parent.WeatherService)

local ProgressService = {}

export type Granted = {
	cash: number?,
	boost: string?,
	seconds: number?,
	slime: string?,
	serverLuck: number?,
}

-- 보상 지급. 클라이언트 팝업용 요약을 돌려줍니다.
function ProgressService.grant(session: Sessions.Session, reward: Rewards.Reward): Granted
	local out: Granted = {}
	if reward.cashMinutes then
		local amount = Calc.cashReward(reward.cashMinutes, reward.minCash or 0, session.income)
		EconomyService.addCash(session, amount)
		out.cash = amount
	end
	if reward.boost and reward.seconds then
		session.data.boosts[reward.boost] = (session.data.boosts[reward.boost] or 0) + reward.seconds
		out.boost = reward.boost
		out.seconds = reward.seconds
		Bus.incomeChanged:Fire(session)
	end
	if reward.giftRarity then
		local _, id = SlimeService.giveRandom(session, reward.giftRarity)
		out.slime = id
	end
	if reward.serverLuck then
		WeatherService.addServerLuck(reward.serverLuck, session.player.DisplayName)
		out.serverLuck = reward.serverLuck
	end
	session.dirty = true
	Remote.fx(session.player, "reward", out :: any)
	return out
end

local function upgrade(session: Sessions.Session, id: any): (boolean, string?)
	if type(id) ~= "string" or not Economy.upgradeById[id] then
		return false, "badRequest"
	end
	local level = Calc.upgradeLevel(session.data, id)
	local cost = Calc.upgradeCost(id, level)
	if not cost then
		return false, "maxed"
	end
	if not EconomyService.spend(session, cost) then
		return false, "noCash"
	end
	session.data.upgrades[id] = level + 1
	if id == "pads" then
		PlotService.refreshPads(session)
	elseif id == "speed" then
		PlotService.updateSpeed(session)
	end
	Bus.quest:Fire(session, "upgrade", 1)
	Bus.incomeChanged:Fire(session)
	session.dirty = true
	return true, nil
end

local function rebirth(session: Sessions.Session): (boolean, string?)
	local ok, why = Calc.canRebirth(session.data)
	if not ok then
		return false, why
	end
	StealService.cancelAllFor(session)
	local data = session.data
	-- 즐겨찾기 1마리는 1번 발판으로 데려갑니다
	local keep = nil
	for _, s in data.slimes do
		if s.fav then
			keep = { id = s.id, star = s.star, mut = s.mut, pad = 1, fav = true }
			break
		end
	end
	SlimeService.clearModels(session)
	data.slimes = {}
	session.busy = {}
	if keep then
		data.slimes[tostring(data.nextUid)] = keep
		data.nextUid += 1
	end
	data.cash = Economy.startCash
	data.vault = 0
	data.rebirths += 1
	SlimeService.renderAll(session)
	Bus.incomeChanged:Fire(session)
	session.dirty = true
	Remote.notifyAll("announce", "rebirthAnnounce", { name = session.player.DisplayName, n = data.rebirths })
	Remote.fx(session.player, "rebirth", { n = data.rebirths })
	return true, nil
end

local function claimQuest(session: Sessions.Session, index: any): (boolean, string?, Granted?)
	if type(index) ~= "number" then
		return false, "badRequest", nil
	end
	local q = session.data.quests.list[index]
	if not q or q.claimed or q.progress < q.goal then
		return false, "notReady", nil
	end
	local def = Rewards.questById[q.id]
	if not def then
		return false, "badRequest", nil
	end
	q.claimed = true
	local granted = ProgressService.grant(session, def.reward)
	if Progress.allQuestsClaimed(session.data) and not session.data.quests.bonusClaimed then
		session.data.quests.bonusClaimed = true
		ProgressService.grant(session, Rewards.questAllBonus)
		Remote.notify(session.player, "success", "questAllDone")
	end
	return true, nil, granted
end

local function claimGift(session: Sessions.Session, index: any): (boolean, string?, Granted?)
	if type(index) ~= "number" or not Rewards.gifts[index] then
		return false, "badRequest", nil
	end
	local key = tostring(index)
	if session.giftsClaimed[key] then
		return false, "claimed", nil
	end
	if not Progress.giftReady(index, os.clock() - session.joinedClock + 1) then
		return false, "notReady", nil
	end
	session.giftsClaimed[key] = true
	return true, nil, ProgressService.grant(session, Rewards.gifts[index].reward)
end

local function onQuest(session: Sessions.Session, kind: string, amount: number)
	if Sessions.get(session.player) ~= session then
		return
	end
	local before: { [number]: boolean } = {}
	for i, q in session.data.quests.list do
		before[i] = q.progress >= q.goal
	end
	if Progress.questEvent(session.data, kind, amount) then
		session.dirty = true
		for i, q in session.data.quests.list do
			if not before[i] and q.progress >= q.goal then
				Remote.notify(session.player, "success", "questDone", { quest = q.id })
			end
		end
	end
end

function ProgressService.init() end

function ProgressService.start()
	Bus.quest:Connect(onQuest)

	-- 자정(UTC)이 지나면 퀘스트 새로 뽑기
	task.spawn(function()
		while true do
			task.wait(30)
			for _, s in Sessions.all() do
				if Progress.refreshQuests(s.data, os.time(), s.userId) then
					s.dirty = true
					Remote.notify(s.player, "info", "newQuests")
				end
			end
		end
	end)

	Remote.on("Upgrade", 0.15, function(session, id)
		local ok, msg = upgrade(session, id)
		return { ok = ok, msg = msg }
	end)
	Remote.on("Rebirth", 2, function(session)
		local ok, msg = rebirth(session)
		return { ok = ok, msg = msg }
	end)
	Remote.on("ClaimDaily", 1, function(session)
		local slot = Progress.claimDaily(session.data, os.time())
		if not slot then
			return { ok = false, msg = "claimed" }
		end
		return { ok = true, granted = ProgressService.grant(session, Rewards.daily[slot]), slot = slot }
	end)
	Remote.on("ClaimQuest", 0.3, function(session, index)
		local ok, msg, granted = claimQuest(session, index)
		return { ok = ok, msg = msg, granted = granted }
	end)
	Remote.on("ClaimGift", 0.3, function(session, index)
		local ok, msg, granted = claimGift(session, index)
		return { ok = ok, msg = msg, granted = granted }
	end)
	Remote.on("ClaimOffline", 1, function(session)
		local offline = session.offline
		if not offline then
			return { ok = false, msg = "claimed" }
		end
		session.offline = nil
		EconomyService.addCash(session, offline.amount)
		session.dirty = true
		Remote.fx(session.player, "reward", { cash = offline.amount })
		return { ok = true }
	end)
	Remote.on("SkipTutorial", 1, function(session)
		session.data.tutorial = math.max(session.data.tutorial, 3)
		session.dirty = true
		return { ok = true }
	end)
	Remote.on("Settings", 0.5, function(session, payload)
		if type(payload) == "table" then
			if type(payload.music) == "boolean" then
				session.data.settings.music = payload.music
			end
			if type(payload.sfx) == "boolean" then
				session.data.settings.sfx = payload.sfx
			end
			session.dirty = true
		end
		return { ok = true }
	end)
end

function ProgressService.onJoin(session: Sessions.Session)
	local data = session.data
	Progress.refreshQuests(data, os.time(), session.userId)
	EconomyService.recalc(session)
	if data.lastOnline > 0 then
		local away = os.time() - data.lastOnline
		local amount, seconds = Calc.offlineEarnings(data, away, session.income)
		if amount > 0 then
			session.offline = { amount = amount, seconds = seconds }
		end
	end
	session.dirty = true
end

return ProgressService
