--!nonstrict
-- 게임 흐름: 대기 → 준비 카운트다운 → 밤(손님 웨이브) → 낮(상점) → … → 폐업(결과) → 다시 대기.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.GhostDiner.Config)
local Recipes = require(ReplicatedStorage.GhostDiner.Recipes)
local Waves = require(ReplicatedStorage.GhostDiner.Waves)
local CustomerTypes = require(ReplicatedStorage.GhostDiner.CustomerTypes)
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

local function now(): number
	return workspace:GetServerTimeNow()
end

function GameLoop.publish()
	Remotes.set("Phase", GameState.phase)
	Remotes.set("PhaseEndsAt", GameState.phaseEndsAt)
	Remotes.set("Night", GameState.night)
	Remotes.set("Hp", GameState.hp)
	Remotes.set("MaxHp", Config.StartHp)
	Remotes.set("Coins", GameState.coins)
	Remotes.set("CustomersTotal", GameState.customersTotal)
	Remotes.set("CustomersDone", GameState.customersDone)
	Remotes.set("Served", GameState.stats.served)
	Remotes.set("Angry", GameState.stats.angry)
	Remotes.set("Earned", GameState.stats.earned)
	Remotes.set("RunId", GameState.runId)
	for id, level in GameState.upgrades do
		Remotes.set("Upg_" .. id, level)
	end
end

local function setPhase(phase: string, duration: number)
	GameState.phase = phase
	GameState.phaseEndsAt = if duration > 0 then now() + duration else 0
	GameLoop.publish()
end

local function playerCount(): number
	return #Players:GetPlayers()
end

local function waitPhase()
	while now() < GameState.phaseEndsAt and playerCount() > 0 do
		task.wait(0.25)
	end
end

local function onServed(rec, player: Player, dishId: string, coins: number, tip: number)
	GameState.addCoins(coins)
	GameState.stats.served += 1
	GameState.stats.tips += tip
	local per = GameState.stats.perPlayer
	per[player.UserId] = (per[player.UserId] or 0) + 1
	Data.addServed(player, 1)
	Data.addCoins(player, coins)
	if tip > 0 then
		Remotes.toast(player, string.format("%s 서빙! +%d 코인 (팁 %d)", Recipes.name(dishId), coins, tip), "good")
	else
		Remotes.toast(player, string.format("%s 서빙! +%d 코인", Recipes.name(dishId), coins), "good")
	end
	GameLoop.publish()
end

local function onAngry(rec, damage: number)
	GameState.damage(damage)
	GameState.stats.angry += 1
	Remotes.toastAll(string.format("👿 %s이(가) 악귀가 되어 난동을 부립니다! 평판 -%d", rec.ctype.name, damage), "bad")
	GameLoop.publish()
end

local function onResolved(rec)
	GameState.customersDone += 1
	GameLoop.publish()
end

-- 밤 하나를 진행. "cleared" | "abandon" | "dead"
local function runNight(night: number): string
	GameState.night = night
	local rng = Random.new(GameState.seed + night * 7919)
	local plan = Waves.plan(night, playerCount(), rng)
	GameState.customersTotal = plan.total
	GameState.customersDone = 0
	setPhase("night", 0)
	MapBuilder.setNight(true)

	local newDishes = {}
	for _, dishId in Recipes.dishesForNight(night) do
		local item = Recipes.Items[dishId]
		if item.unlock == night then
			table.insert(newDishes, dishId)
		end
	end
	Remotes.notifyAll({ kind = "night", night = night, total = plan.total, newDishes = newDishes, boss = CustomerTypes.bossNight(night) })
	Remotes.soundAll("night")

	local i = 1
	local nextSpawnAt = now() + plan.customers[1].delay
	while true do
		if GameState.hp <= 0 then
			return "dead"
		end
		if playerCount() == 0 then
			return "abandon"
		end
		if i <= plan.total and now() >= nextSpawnAt and Customers.hasSpace() then
			Customers.spawn(plan.customers[i], night)
			i += 1
			if i <= plan.total then
				nextSpawnAt = now() + plan.customers[i].delay
			end
		end
		if i > plan.total and Customers.pendingCount() == 0 then
			return "cleared"
		end
		task.wait(0.2)
	end
end

local function resetRun()
	GameState.resetRun()
	Customers.clear()
	Stations.reset()
	Items.clearAll()
	onRunReset()
	GameLoop.publish()
end

function GameLoop.init(mapInfo, resetCallback: () -> ())
	map = mapInfo
	onRunReset = resetCallback
	Customers.init(map, { onServed = onServed, onAngry = onAngry, onResolved = onResolved })
end

function GameLoop.start()
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
				local bonus = Config.NightClearBonus * night
				GameState.addCoins(bonus)
				Remotes.toastAll(string.format("☀️ %d번째 밤을 넘겼습니다! 보너스 +%d 코인. 낮 동안 상점(B)에서 업그레이드하세요", night, bonus), "good")
				Remotes.soundAll("clear")
				for _, player in Players:GetPlayers() do
					Data.recordNight(player, night)
				end
				setPhase("day", Config.DayLength)
				MapBuilder.setNight(false)
				Remotes.notifyAll({ kind = "day", night = night })
				waitPhase()
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
				for _, player in Players:GetPlayers() do
					table.insert(perPlayer, { name = player.DisplayName, served = GameState.stats.perPlayer[player.UserId] or 0 })
					Data.recordRun(player)
				end
				table.sort(perPlayer, function(a, b)
					return a.served > b.served
				end)
				Remotes.notifyAll({
					kind = "result",
					night = GameState.night,
					served = GameState.stats.served,
					angry = GameState.stats.angry,
					earned = GameState.stats.earned,
					tips = GameState.stats.tips,
					players = perPlayer,
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
