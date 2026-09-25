--!strict
-- 게임패스 · 개발자 상품. 영수증 ID를 저장 데이터에 기록해 중복 지급을 막습니다.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Products = require(Shared.Config.Products)
local Calc = require(Shared.Logic.Calc)
local Data = require(Shared.Logic.Data)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local Bus = require(Server.Bus)
local Remote = require(Server.Remote)
local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local PlotService = require(script.Parent.PlotService)
local WeatherService = require(script.Parent.WeatherService)

local ShopService = {}

local function applyPasses(session: Sessions.Session)
	session.player:SetAttribute("VIP", session.passes.vip == true)
	PlotService.refreshPads(session)
	PlotService.updateSpeed(session)
	Bus.incomeChanged:Fire(session)
	session.dirty = true
end

local function grantProduct(session: Sessions.Session, key: string)
	if key == "serverLuck" then
		WeatherService.addServerLuck(Products.serverLuckSeconds, session.player.DisplayName)
	elseif key == "rainbowStorm" then
		WeatherService.startEvent("rainbow")
		Remote.notifyAll("announce", "stormBought", { name = session.player.DisplayName })
	else
		local minutes = (Products.cashPackMinutes :: any)[key] :: number?
		local minCash = (Products.cashPackMin :: any)[key] :: number?
		if minutes and minCash then
			local amount = Calc.cashReward(minutes, minCash, session.income)
			EconomyService.addCash(session, amount)
			Remote.fx(session.player, "reward", { cash = amount })
		end
	end
	Remote.notify(session.player, "success", "thanksPurchase")
end

local function processReceipt(receipt: any): Enum.ProductPurchaseDecision
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	local session = player and Sessions.get(player)
	if not session then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local purchaseId = tostring(receipt.PurchaseId)
	if Data.hasReceipt(session.data, purchaseId) then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	local product = Products.productById[receipt.ProductId]
	if not product then
		warn("[Shop] unknown product id " .. tostring(receipt.ProductId))
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	grantProduct(session, product.key)
	Data.addReceipt(session.data, purchaseId)
	session.dirty = true
	if DataService.isPersistent() and not DataService.saveNow(session) then
		-- 지급 기록은 메모리에 있으므로 재시도 때 중복 지급되지 않습니다
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

function ShopService.init() end

function ShopService.start()
	MarketplaceService.ProcessReceipt = processReceipt

	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player: Player, passId: number, purchased: boolean)
		if not purchased then
			return
		end
		local session = Sessions.get(player)
		if not session then
			return
		end
		for _, pass in Products.passes do
			if pass.id ~= 0 and pass.id == passId then
				session.passes[pass.key] = true
				applyPasses(session)
				Remote.notify(player, "success", "thanksPurchase")
				Remote.fx(player, "rebirth", { n = 0 })
			end
		end
	end)
end

function ShopService.onJoin(session: Sessions.Session)
	task.spawn(function()
		for _, pass in Products.passes do
			if pass.id ~= 0 then
				local ok, owns = pcall(function()
					return MarketplaceService:UserOwnsGamePassAsync(session.userId, pass.id)
				end)
				if ok and owns then
					session.passes[pass.key] = true
				end
			end
		end
		if Sessions.get(session.player) == session then
			applyPasses(session)
		end
	end)
end

return ShopService
