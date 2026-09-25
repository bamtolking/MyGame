--!strict
-- 돈: 1초마다 수입 → 기지 금고, 수금, 부스트 시간, 플레이 시간, 클라이언트 상태 전송.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Calc = require(Shared.Logic.Calc)
local Format = require(Shared.Util.Format)
local Loop = require(Shared.Util.Loop)
local Net = require(Shared.Net)
local Types = require(Shared.Types)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local Bus = require(Server.Bus)
local Remote = require(Server.Remote)
local MapService = require(script.Parent.MapService)
local WeatherService = require(script.Parent.WeatherService)

local EconomyService = {}

function EconomyService.context(session: Sessions.Session): Types.IncomeContext
	return {
		vip = session.passes.vip == true,
		doubleCash = session.passes.doubleCash == true,
		friends = session.friends,
		group = session.group,
		frenzy = WeatherService.isFrenzy(),
	}
end

function EconomyService.recalc(session: Sessions.Session)
	local ctx = EconomyService.context(session)
	local income = Calc.incomePerSecond(session.data, ctx)
	local mult = Calc.multiplier(session.data, ctx)
	if income ~= session.income or mult ~= session.multiplier then
		session.income = income
		session.multiplier = mult
		session.dirty = true
	end
end

function EconomyService.markDirty(session: Sessions.Session)
	session.dirty = true
end

function EconomyService.addCash(session: Sessions.Session, amount: number)
	if amount <= 0 or amount ~= amount then
		return
	end
	session.data.cash += amount
	session.data.totalEarned += amount
	session.moneyDirty = true
end

function EconomyService.spend(session: Sessions.Session, amount: number): boolean
	if amount < 0 or amount ~= amount or session.data.cash < amount then
		return false
	end
	session.data.cash -= amount
	session.moneyDirty = true
	return true
end

local function updateVaultLabel(session: Sessions.Session)
	local plot = MapService.plots[session.plot]
	if plot then
		plot.vaultLabel.Text = Format.cash(session.data.vault)
	end
end

function EconomyService.collect(session: Sessions.Session): number
	local amount = math.floor(session.data.vault)
	if amount <= 0 then
		return 0
	end
	session.data.vault -= amount
	session.data.cash += amount
	session.moneyDirty = true
	updateVaultLabel(session)
	Remote.fx(session.player, "collect", { amount = amount })
	Bus.quest:Fire(session, "collect", 1)
	if session.data.tutorial == 1 then
		session.data.tutorial = 2
		session.dirty = true
	end
	return amount
end

function EconomyService.buildView(session: Sessions.Session): Types.StateView
	return {
		data = session.data,
		passes = session.passes,
		income = session.income,
		multiplier = session.multiplier,
		friends = session.friends,
		plot = session.plot,
		sessionSeconds = os.clock() - session.joinedClock,
		giftsClaimed = session.giftsClaimed,
		offline = session.offline,
	}
end

function EconomyService.pushState(session: Sessions.Session)
	session.dirty = false
	session.moneyDirty = false
	Net.event("State"):FireClient(session.player, EconomyService.buildView(session))
end

local function pushMoney(session: Sessions.Session)
	session.moneyDirty = false
	Net.event("Money"):FireClient(session.player, {
		cash = session.data.cash,
		vault = session.data.vault,
		income = session.income,
	})
end

local function incomeTick()
	for _, session in Sessions.all() do
		local data = session.data
		EconomyService.recalc(session)

		local earned = session.income
		if earned > 0 then
			if session.passes.autoCollect then
				data.cash += earned
			else
				data.vault += earned
			end
			data.totalEarned += earned
			session.moneyDirty = true
			updateVaultLabel(session)
		end

		-- 부스트는 접속 중에만 줄어듭니다
		for key, seconds in data.boosts do
			local left = seconds - 1
			if left <= 0 then
				data.boosts[key] = nil
				session.dirty = true
				Remote.notify(session.player, "info", "boostEnded")
			else
				data.boosts[key] = left
			end
		end

		data.playTime += 1
		if os.clock() - session.lastPlaytimeQuest >= 10 then
			session.lastPlaytimeQuest = os.clock()
			Bus.quest:Fire(session, "playtime", 10)
		end
	end
end

function EconomyService.init() end

function EconomyService.start()
	Bus.incomeChanged:Connect(function(session: Sessions.Session)
		EconomyService.recalc(session)
		session.dirty = true
	end)
	WeatherService.changed:Connect(function()
		for _, s in Sessions.all() do
			EconomyService.recalc(s)
		end
	end)

	Loop.every("Economy", 1, incomeTick)

	-- 상태 전송: 구조가 바뀌면 전체, 돈만 바뀌면 가벼운 Money 이벤트
	task.spawn(function()
		while true do
			task.wait(0.2)
			for _, session in Sessions.all() do
				if session.player.Parent ~= Players then
					continue
				end
				if session.dirty then
					EconomyService.pushState(session)
				elseif session.moneyDirty then
					pushMoney(session)
				end
			end
		end
	end)

	Remote.on("GetState", 1, function(session)
		EconomyService.pushState(session)
		return { ok = true }
	end)
end

return EconomyService
