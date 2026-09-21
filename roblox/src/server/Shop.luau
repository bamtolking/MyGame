--!nonstrict
-- 상점: 팀 코인으로 업그레이드 구매. 낮이 아니어도 살 수 있습니다(급할 때 평판 수리 등).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.GhostDiner.Config)
local Upgrades = require(ReplicatedStorage.GhostDiner.Upgrades)
local GameState = require(script.Parent.GameState)
local Remotes = require(script.Parent.Remotes)
local Stations = require(script.Parent.Stations)

local Shop = {}
local publish: () -> () = function() end

function Shop.applyWalkSpeed(player: Player?)
	local speed = Config.BaseWalkSpeed + Upgrades.walkSpeedBonus(GameState.level("shoes"), Config.WalkSpeedPerLevel)
	local list = if player then { player } else Players:GetPlayers()
	for _, p in list do
		local character = p.Character
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		if humanoid then
			humanoid.WalkSpeed = speed
		end
	end
end

local function buy(player: Player, upgradeId: any): (boolean, string)
	if type(upgradeId) ~= "string" then
		return false, "잘못된 요청"
	end
	local upgrade = Upgrades.ById[upgradeId]
	if not upgrade then
		return false, "없는 업그레이드"
	end
	if GameState.phase == "lobby" or GameState.phase == "gameover" then
		return false, "지금은 살 수 없어요"
	end
	local level = GameState.level(upgradeId)
	local cost = Upgrades.cost(upgradeId, level)
	if not cost then
		return false, "이미 최대 단계예요"
	end
	if upgradeId == "repair" and GameState.hp >= Config.StartHp then
		return false, "평판이 이미 가득해요"
	end
	if GameState.coins < cost then
		return false, string.format("코인이 부족해요 (%d 필요)", cost)
	end
	GameState.addCoins(-cost)
	GameState.upgrades[upgradeId] = level + 1

	if upgradeId == "repair" then
		GameState.heal(Upgrades.RepairAmount)
	elseif upgradeId == "shoes" then
		Shop.applyWalkSpeed(nil)
	elseif upgradeId == "knife" or upgradeId == "pot" or upgradeId == "griddle" or upgradeId == "fryer" or upgradeId == "ricecooker" then
		Stations.applyUpgrades()
	end
	Remotes.toastAll(string.format("🛒 %s 님이 %s 구매! (-%d 코인)", player.DisplayName, upgrade.name, cost), "good")
	Remotes.soundAll("buy")
	publish()
	return true, "구매 완료"
end

function Shop.init(publishFn: () -> ())
	publish = publishFn
	Remotes.Buy.OnServerInvoke = function(player, upgradeId)
		local ok, result, message = pcall(buy, player, upgradeId)
		if not ok then
			warn("[GhostDiner] 구매 처리 오류:", result)
			return false, "오류가 났어요"
		end
		return result, message
	end
end

return Shop
