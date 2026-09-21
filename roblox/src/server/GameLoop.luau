--!nonstrict
-- 게임 흐름: 대기 → 준비 카운트다운 → 밤(손님 웨이브·이벤트·목표·부적) → 낮(상점·준비 투표·유물 투표) → … → 폐업(결과·리뷰) → 다시 대기.
-- 콤보·명성·순위표·정전·부적 게이지·유물도 여기서 관리합니다.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.GhostDiner.Config)
local Recipes = require(ReplicatedStorage.GhostDiner.Recipes)
local Waves = require(ReplicatedStorage.GhostDiner.Waves)
local CustomerTypes = require(ReplicatedStorage.GhostDiner.CustomerTypes)
local Events = require(ReplicatedStorage.GhostDiner.Events)
local Challenges = require(ReplicatedStorage.GhostDiner.Challenges)
local Combo = require(ReplicatedStorage.GhostDiner.Combo)
local Cosmetics = require(ReplicatedStorage.GhostDiner.Cosmetics)
local Talismans = require(ReplicatedStorage.GhostDiner.Talismans)
local Relics = require(ReplicatedStorage.GhostDiner.Relics)
local Reviews = require(ReplicatedStorage.GhostDiner.Reviews)
local GameState = require(script.Parent.GameState)
local Remotes = require(script.Parent.Remotes)
local Items = require(script.Parent.Items)
local Stations = require(script.Parent.Stations)
local Customers = require(script.Parent.Customers)
local Data = require(script.Parent.Data)
local MapBuilder = require(script.Parent.MapBuilder)

local GameLoop = {}
local map
local onRunReset: () -> () = function() end
local onRelicGained: () -> () = function() end

local function now(): number
	return workspace:GetServerTimeNow()
end

local function playerCount(): number
	return #Players:GetPlayers()
end

local function challengeText(): string
	local c = Challenges.get(GameState.challengeId)
	if not c then
		return ""
	end
	return Challenges.text(c, GameState.nightStats)
end

function GameLoop.publish()
	local S = GameState
	local ns = S.nightStats
	Remotes.set("Phase", S.phase)
	Remotes.set("PhaseEndsAt", S.phaseEndsAt)
	Remotes.set("Night", S.night)
	Remotes.set("Hp", S.hp)
	Remotes.set("MaxHp", Config.StartHp)
	Remotes.set("Coins", S.coins)
	Remotes.set("CustomersTotal", S.customersTotal)
	Remotes.set("CustomersDone", S.customersDone)
	Remotes.set("Served", S.stats.served)
	Remotes.set("Angry", S.stats.angry)
	Remotes.set("Earned", S.stats.earned)
	Remotes.set("RunId", S.runId)
	Remotes.set("Combo", S.combo)
	Remotes.set("ComboExpiresAt", S.comboExpiresAt)
	local event = Events.get(S.eventId)
	Remotes.set("EventId", S.eventId)
	Remotes.set("EventName", if event then event.emoji .. " " .. event.name else "")
	Remotes.set("EventDesc", if event then event.desc else "")
	local challenge = Challenges.get(S.challengeId)
	Remotes.set("ChallengeId", S.challengeId)
	Remotes.set("ChallengeText", challengeText())
	Remotes.set("ChallengeDone", challenge ~= nil and Challenges.done(challenge, ns))
	Remotes.set("ReadyCount", S.readyCount)
	Remotes.set("ReadyTotal", playerCount())
	Remotes.set("Blackout", S.blackout)
	Remotes.set("NightServed", ns.served or 0)
	Remotes.set("NightTips", ns.tips or 0)
	Remotes.set("NightMaxCombo", ns.maxCombo or 0)
	Remotes.set("NightAngry", ns.angry or 0)
	Remotes.set("NightBurnt", ns.burnt or 0)
	Remotes.set("NightFires", ns.fires or 0)
	Remotes.set("NightAscended", ns.ascended or 0)
	Remotes.set("Talisman", S.talisman)
	Remotes.set("TalismanMax", Config.TalismanMax)
	Remotes.set("FortuneUntil", S.fortuneUntil)
	local relicIds = {}
	for id in S.relics do
		table.insert(relicIds, id)
	end
	table.sort(relicIds)
	Remotes.set("Relics", table.concat(relicIds, ","))
	Remotes.set("RelicOffer", table.concat(S.relicOffer, ","))
	local counts = {}
	for i = 1, #S.relicOffer do
		counts[i] = 0
	end
	for _, idx in S.relicVotes do
		if counts[idx] then
			counts[idx] += 1
		end
	end
	Remotes.set("RelicVotes", table.concat(counts, ","))
	Remotes.set("RelicVoteEndsAt", S.relicVoteEndsAt)
	for id, level in S.upgrades do
		Remotes.set("Upg_" .. id, level)
	end
end

local function setPhase(phase: string, duration: number)
	GameState.phase = phase
	GameState.phaseEndsAt = if duration > 0 then now() + duration else 0
	GameState.ready = {}
	GameState.readyCount = 0
	GameLoop.publish()
end

local function waitPhase()
	while now() < GameState.phaseEndsAt and playerCount() > 0 do
		task.wait(0.25)
	end
end

local function resetCombo(reason: string)
	if GameState.combo >= 2 then
		Remotes.toastAll("💔 콤보 끊김 — " .. reason, "bad")
	end
	GameState.combo = 0
	GameState.comboExpiresAt = 0
end

local function awardFame(player: Player, n: number)
	Data.addFame(player, n)
	local fp = GameState.stats.famePerPlayer
	fp[player.UserId] = (fp[player.UserId] or 0) + n
end

local function addTalisman(amount: number)
	if GameState.hasRelic("ink") then
		amount *= 1.5
	end
	local wasFull = GameState.talisman >= Config.TalismanMax
	GameState.talisman = math.min(Config.TalismanMax, GameState.talisman + amount)
	if not wasFull and GameState.talisman >= Config.TalismanMax then
		Remotes.toastAll("🧧 부적이 준비됐습니다! 1·2·3 키 또는 화면 버튼으로 사용하세요", "good")
		Remotes.soundAll("talismanReady")
	end
end

-- 서빙 성공: 최종 코인을 계산해 돌려줌
local function onServed(rec, player: Player, dishId: string, base: number, tip: number, fraction: number): number
	local t = now()
	if GameState.combo > 0 and t <= GameState.comboExpiresAt then
		GameState.combo += 1
	else
		GameState.combo = 1
	end
	GameState.comboExpiresAt = t + Config.ComboWindow
	local event = Events.get(GameState.eventId)
	local tipMult = (if event and event.tipMult then event.tipMult else 1) * (if GameState.hasRelic("ladle") then 1.5 else 1)
	local rewardMult = if event and event.rewardMult then event.rewardMult else 1
	local fortune = if t < GameState.fortuneUntil then Config.FortuneMult else 1
	local mult = Combo.multiplier(GameState.combo)
	local coins = math.floor((base + tip * tipMult) * rewardMult * mult * fortune + 0.5)
	GameState.addCoins(coins)

	local S, ns = GameState.stats, GameState.nightStats
	S.served += 1
	S.tips += tip
	ns.served += 1
	if tip > 0 then
		ns.tips += 1
		S.tipCount += 1
	end
	if fraction >= 0.7 then
		ns.fastServes += 1
	end
	ns.maxCombo = math.max(ns.maxCombo, GameState.combo)
	S.maxCombo = math.max(S.maxCombo, GameState.combo)
	local uid = player.UserId
	S.perPlayer[uid] = (S.perPlayer[uid] or 0) + 1
	ns.perPlayer[uid] = (ns.perPlayer[uid] or 0) + 1
	Data.addServed(player, 1)
	Data.addCoins(player, coins)
	awardFame(player, Config.FamePerServe)
	addTalisman(Config.TalismanPerServe + (if tip > 0 then Config.TalismanTipBonus else 0) + (if rec.ctype.boss then Config.TalismanBossBonus else 0))

	local msg = string.format("%s 서빙! +%d 코인", Recipes.name(dishId), coins)
	if tip > 0 then
		msg ..= string.format(" (팁 %d)", tip)
	end
	if fortune > 1 then
		msg ..= " 💰풍요"
	end
	if GameState.combo >= 2 then
		msg ..= string.format("  🔥 콤보 x%d", GameState.combo)
		Remotes.notify(player, { kind = "combo", count = GameState.combo })
	end
	Remotes.toast(player, msg, "good")
	GameLoop.publish()
	return coins
end

local function onAngry(rec, damage: number)
	damage = math.floor(damage * (if GameState.hasRelic("club") then 0.5 else 1) + 0.5)
	GameState.damage(damage)
	GameState.stats.angry += 1
	GameState.nightStats.angry += 1
	resetCombo("악귀 발생")
	Remotes.toastAll(string.format("👿 %s이(가) 악귀가 되어 난동을 부립니다! 평판 -%d", rec.ctype.name, damage), "bad")
	Remotes.notifyAll({ kind = "angry", position = rec.root.Position, damage = damage })
	GameLoop.publish()
end

local function onResolved(rec)
	GameState.customersDone += 1
	GameLoop.publish()
end

local function onAscended(rec)
	GameState.stats.ascended += 1
	GameState.nightStats.ascended += 1
	GameLoop.publish()
end

local stationCallbacks = {
	onBurnt = function(spec)
		GameState.nightStats.burnt += 1
		GameState.stats.burnt += 1
		resetCombo("음식을 태움")
		GameLoop.publish()
	end,
	onFire = function(spec, reason)
		GameState.nightStats.fires += 1
		GameState.stats.fires += 1
		GameLoop.publish()
	end,
	onSpread = function(from, to)
		GameState.damage(Config.FireSpreadDamage)
		GameLoop.publish()
	end,
	onExtinguish = function(spec, player)
		Remotes.notifyAll({ kind = "sparkle", position = spec.baseCFrame.Position + Vector3.new(0, 3.5, 0), color = "blue" })
	end,
	isNight = function()
		return GameState.phase == "night"
	end,
}

-- ---------- 정전 ----------
local function endBlackout()
	if not GameState.blackout then
		return
	end
	GameState.blackout = false
	MapBuilder.setBlackout(false)
	Remotes.notifyAll({ kind = "blackout", on = false })
	Remotes.toastAll("💡 불이 다시 들어왔습니다", "good")
	GameLoop.publish()
end

local function startBlackout()
	GameState.blackout = true
	MapBuilder.setBlackout(true)
	Remotes.notifyAll({ kind = "blackout", on = true })
	Remotes.toastAll("🕯️ 정전! 조리대 위치를 기억하세요…", "bad")
	GameLoop.publish()
	local runId = GameState.runId
	task.delay(Config.BlackoutDuration, function()
		if GameState.runId == runId then
			endBlackout()
		end
	end)
end

-- ---------- 부적 ----------
local function useTalisman(player: Player, id: any)
	if GameState.phase ~= "night" then
		Remotes.toast(player, "부적은 영업 중에만 쓸 수 있어요")
		return
	end
	if GameState.talisman < Config.TalismanMax then
		Remotes.toast(player, "부적 게이지가 아직 안 찼어요")
		return
	end
	local talisman = Talismans.get(if type(id) == "string" then id else nil)
	if not talisman then
		return
	end
	GameState.talisman = 0
	GameState.stats.talismansUsed += 1
	local detail = ""
	if talisman.id == "time" then
		local n = Customers.extendAll(Config.TimeCharmSeconds)
		detail = string.format("손님 %d명 인내심 +%d초", n, Config.TimeCharmSeconds)
	elseif talisman.id == "calm" then
		local n = Customers.calmAll()
		detail = if n > 0 then string.format("악귀 %d명이 진정해 돌아갑니다", n) else "진정시킬 악귀가 없었어요"
	elseif talisman.id == "fortune" then
		GameState.fortuneUntil = now() + Config.FortuneDuration
		detail = string.format("%d초 동안 보상 ×%.1f", Config.FortuneDuration, Config.FortuneMult)
	end
	Remotes.notifyAll({ kind = "talisman", id = talisman.id, name = talisman.name, emoji = talisman.emoji, user = player.DisplayName, detail = detail })
	Remotes.toastAll(string.format("🧧 %s 님이 %s 사용! %s", player.DisplayName, talisman.name, detail), "good")
	GameLoop.publish()
end

-- ---------- 유물 투표 ----------
local function resolveRelic()
	local offer = GameState.relicOffer
	if #offer == 0 then
		return
	end
	local rng = Random.new()
	local id = Relics.tally(offer, GameState.relicVotes, rng) or offer[rng:NextInteger(1, #offer)]
	GameState.relicOffer = {}
	GameState.relicVotes = {}
	GameState.relicVoteEndsAt = 0
	GameState.relics[id] = true
	local relic = Relics.get(id)
	if relic then
		Remotes.notifyAll({ kind = "relicResult", id = id, name = relic.name, desc = relic.desc, emoji = relic.emoji })
		Remotes.toastAll("🔮 유물 획득: " .. relic.emoji .. " " .. relic.name .. " — " .. relic.desc, "good")
		Remotes.soundAll("relic")
	end
	onRelicGained()
	GameLoop.publish()
end

local function offerRelics(night: number)
	local offer = Relics.offer(GameState.relics, Random.new(GameState.seed + night * 31), 3)
	if #offer == 0 then
		return
	end
	GameState.relicOffer = offer
	GameState.relicVotes = {}
	GameState.relicVoteEndsAt = now() + Config.RelicVoteTime
	Remotes.toastAll("🔮 도깨비 상인이 유물을 가져왔습니다! 하나를 골라 투표하세요", "good")
	Remotes.soundAll("relicOffer")
	GameLoop.publish()
end

local function relicVote(player: Player, index: any)
	if #GameState.relicOffer == 0 or type(index) ~= "number" then
		return
	end
	index = math.floor(index)
	if index < 1 or index > #GameState.relicOffer then
		return
	end
	GameState.relicVotes[player.UserId] = index
	GameLoop.publish()
	local all = true
	for _, p in Players:GetPlayers() do
		if not GameState.relicVotes[p.UserId] then
			all = false
		end
	end
	if all then
		resolveRelic()
	end
end

-- 밤 하나를 진행. "cleared" | "abandon" | "dead"
local function runNight(night: number): string
	GameState.resetNight()
	GameState.night = night
	local rng = Random.new(GameState.seed + night * 7919)
	local event = Events.pick(night, rng, Config.EventChance, Config.EventMinNight)
	GameState.eventId = if event then event.id else ""
	local challenge = if night >= 2 then Challenges.pick(night, rng) else nil
	GameState.challengeId = if challenge then challenge.id else ""
	local mods = if event then { countMult = event.countMult, spawnMult = event.spawnMult, extraOrder = event.extraOrder } else nil
	local plan = Waves.plan(night, playerCount(), rng, mods)
	local pool = Recipes.dishesForNight(night)
	GameState.customersTotal = plan.total
	GameState.customersDone = 0
	setPhase("night", 0)
	MapBuilder.setNight(true)

	local newDishes = {}
	for _, dishId in pool do
		local item = Recipes.Items[dishId]
		if item.unlock == night then
			table.insert(newDishes, dishId)
		end
	end
	Remotes.notifyAll({
		kind = "night",
		night = night,
		total = plan.total,
		newDishes = newDishes,
		boss = CustomerTypes.bossNight(night),
		event = if event then { id = event.id, name = event.name, desc = event.desc, emoji = event.emoji } else nil,
		challenge = if challenge then { name = challenge.name, desc = challenge.desc, reward = challenge.reward, emoji = challenge.emoji } else nil,
	})
	Remotes.soundAll("night")

	local blackoutAt = nil
	if event and event.blackout then
		local totalDelay = 0
		for _, c in plan.customers do
			totalDelay += c.delay
		end
		blackoutAt = now() + math.max(10, totalDelay * (0.25 + 0.4 * rng:NextNumber()))
	end
	local patienceMult = if event and event.patienceMult then event.patienceMult else 1

	local i = 1
	local nextSpawnAt = now() + plan.customers[1].delay
	while true do
		if GameState.hp <= 0 then
			endBlackout()
			return "dead"
		end
		if playerCount() == 0 then
			endBlackout()
			return "abandon"
		end
		if i <= plan.total and now() >= nextSpawnAt and Customers.hasSpace() then
			Customers.spawn(plan.customers[i], night, { patienceMult = patienceMult, pool = pool })
			i += 1
			if i <= plan.total then
				nextSpawnAt = now() + plan.customers[i].delay
			end
		end
		if blackoutAt and now() >= blackoutAt then
			blackoutAt = nil
			startBlackout()
		end
		if GameState.combo > 0 and now() > GameState.comboExpiresAt then
			GameState.combo = 0
			GameState.comboExpiresAt = 0
			GameLoop.publish()
		end
		if i > plan.total and Customers.pendingCount() == 0 then
			endBlackout()
			return "cleared"
		end
		task.wait(0.2)
	end
end

local function nightCleared(night: number)
	local ns = GameState.nightStats
	local bonus = Config.NightClearBonus * night * (if GameState.hasRelic("pouch") then 2 else 1)
	GameState.addCoins(bonus)

	local challenge = Challenges.get(GameState.challengeId)
	local challengeBonus = 0
	local challengeDone = false
	if challenge and Challenges.done(challenge, ns) then
		challengeBonus = challenge.reward
		challengeDone = true
		GameState.addCoins(challengeBonus)
		Remotes.soundAll("challenge")
	end

	local mvpName, mvpServed = "", 0
	for userId, n in ns.perPlayer do
		if n > mvpServed then
			local p = Players:GetPlayerByUserId(userId)
			if p then
				mvpName = p.DisplayName
				mvpServed = n
			end
		end
	end

	local fame = Cosmetics.fameForNight(night, Config.FamePerNightBase)
	local newBest = false
	for _, player in Players:GetPlayers() do
		if Data.recordNight(player, night) then
			Data.updateLeaderboard(player, night)
			newBest = true
		end
		awardFame(player, fame)
	end

	Remotes.notifyAll({
		kind = "clear",
		night = night,
		bonus = bonus,
		challengeBonus = challengeBonus,
		challengeDone = challengeDone,
		challengeName = if challenge then challenge.emoji .. " " .. challenge.name else nil,
		mvp = mvpName,
		mvpServed = mvpServed,
		served = ns.served,
		ascended = ns.ascended,
		tips = ns.tips,
		maxCombo = ns.maxCombo,
		angry = ns.angry,
		burnt = ns.burnt,
		fame = fame,
	})
	Remotes.soundAll("clear")
	if newBest then
		GameLoop.refreshLeaderboard()
	end
	if CustomerTypes.bossNight(night) then
		offerRelics(night)
	end
end

local function runDay()
	setPhase("day", Config.DayLength)
	MapBuilder.setNight(false)
	Remotes.notifyAll({ kind = "day", night = GameState.night })
	while now() < GameState.phaseEndsAt and playerCount() > 0 do
		if #GameState.relicOffer > 0 and now() >= GameState.relicVoteEndsAt then
			resolveRelic()
		end
		task.wait(0.25)
	end
	if #GameState.relicOffer > 0 then
		resolveRelic()
	end
end

local function resetRun()
	GameState.resetRun()
	Customers.clear()
	Stations.reset()
	Items.clearAll()
	MapBuilder.setBlackout(false)
	onRunReset()
	GameLoop.publish()
end

function GameLoop.refreshLeaderboard()
	task.spawn(function()
		local entries = Data.fetchLeaderboard(10)
		MapBuilder.setLeaderboard(entries)
	end)
end

function GameLoop.init(mapInfo, resetCallback: () -> (), relicCallback: (() -> ())?)
	map = mapInfo
	onRunReset = resetCallback
	if relicCallback then
		onRelicGained = relicCallback
	end
	Customers.init(map, { onServed = onServed, onAngry = onAngry, onResolved = onResolved, onAscended = onAscended })
	Stations.setCallbacks(stationCallbacks)

	Remotes.Ready.OnServerEvent:Connect(function(player)
		local phase = GameState.phase
		if phase ~= "day" and phase ~= "countdown" then
			return
		end
		local uid = player.UserId
		if GameState.ready[uid] then
			GameState.ready[uid] = nil
		else
			GameState.ready[uid] = true
		end
		local n = 0
		for _, p in Players:GetPlayers() do
			if GameState.ready[p.UserId] then
				n += 1
			end
		end
		GameState.readyCount = n
		if n >= playerCount() and playerCount() > 0 and now() < GameState.phaseEndsAt then
			GameState.phaseEndsAt = now()
			Remotes.toastAll("✅ 모두 준비 완료! 바로 시작합니다", "good")
		end
		GameLoop.publish()
	end)
	Remotes.UseTalisman.OnServerEvent:Connect(useTalisman)
	Remotes.RelicVote.OnServerEvent:Connect(relicVote)
end

function GameLoop.start()
	task.spawn(function()
		while true do
			GameLoop.refreshLeaderboard()
			task.wait(Config.LeaderboardRefresh)
		end
	end)

	task.spawn(function()
		while true do
			resetRun()
			setPhase("lobby", 0)
			MapBuilder.setNight(true)
			while playerCount() == 0 do
				task.wait(1)
			end

			setPhase("countdown", Config.StartCountdown)
			Remotes.toastAll("🏮 저승 휴게소 개장 준비! R키로 레시피를 확인하고 재료를 미리 꺼내 두세요", "info")
			waitPhase()

			local night = 1
			local ended = "abandon"
			while night <= Config.MaxNight do
				local result = runNight(night)
				if result ~= "cleared" then
					ended = result
					break
				end
				nightCleared(night)
				runDay()
				if playerCount() == 0 then
					ended = "abandon"
					break
				end
				night += 1
			end

			if ended == "dead" then
				setPhase("gameover", Config.GameOverLength)
				Remotes.soundAll("gameover")
				local perPlayer = {}
				local mvpName, mvpServed = "", 0
				for _, player in Players:GetPlayers() do
					local served = GameState.stats.perPlayer[player.UserId] or 0
					table.insert(perPlayer, { name = player.DisplayName, served = served, fame = GameState.stats.famePerPlayer[player.UserId] or 0 })
					if served > mvpServed then
						mvpName, mvpServed = player.DisplayName, served
					end
					Data.recordRun(player)
				end
				table.sort(perPlayer, function(a, b)
					return a.served > b.served
				end)
				local S = GameState.stats
				local reviews = Reviews.generate({ served = S.served, angry = S.angry, burnt = S.burnt, fires = S.fires, maxCombo = S.maxCombo, night = GameState.night, tips = S.tipCount }, Random.new())
				local relicNames = {}
				for id in GameState.relics do
					local r = Relics.get(id)
					if r then
						table.insert(relicNames, r.emoji .. " " .. r.name)
					end
				end
				Remotes.notifyAll({
					kind = "result",
					night = GameState.night,
					served = S.served,
					ascended = S.ascended,
					angry = S.angry,
					earned = S.earned,
					tips = S.tips,
					maxCombo = S.maxCombo,
					burnt = S.burnt,
					fires = S.fires,
					talismans = S.talismansUsed,
					relics = table.concat(relicNames, " · "),
					mvp = mvpName,
					players = perPlayer,
					reviews = reviews,
				})
				Data.saveAll()
				Customers.clear()
				waitPhase()
				if playerCount() > 0 then
					task.wait(1)
				end
			end
		end
	end)
end

return GameLoop
