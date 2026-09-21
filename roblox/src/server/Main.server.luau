--!nonstrict
-- 서버 진입점. 지도 생성 → 조리대·손님·저장·상점·옷장 초기화 → 게임 루프 시작.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.GhostDiner.Config)
local MapBuilder = require(script.Parent.MapBuilder)
local Stations = require(script.Parent.Stations)
local GameLoop = require(script.Parent.GameLoop)
local Data = require(script.Parent.Data)
local Shop = require(script.Parent.Shop)
local Wardrobe = require(script.Parent.Wardrobe)

local map = MapBuilder.build()
Stations.init(map)
GameLoop.init(map, function()
	Shop.applyWalkSpeed(nil)
end)
Data.init()
Shop.init(GameLoop.publish)
Wardrobe.init()

local function onCharacter(player: Player, character: Model)
	for _, d in character:GetDescendants() do
		if d:IsA("BasePart") then
			d.CollisionGroup = "Players"
		end
	end
	character.DescendantAdded:Connect(function(d)
		if d:IsA("BasePart") then
			d.CollisionGroup = "Players"
		end
	end)
	character:WaitForChild("Humanoid", 10)
	Shop.applyWalkSpeed(player)
end

local function onPlayer(player: Player)
	player.CharacterAdded:Connect(function(character)
		onCharacter(player, character)
	end)
	if player.Character then
		onCharacter(player, player.Character)
	end
end

Players.PlayerAdded:Connect(onPlayer)
for _, player in Players:GetPlayers() do
	onPlayer(player)
end

GameLoop.start()
print("[GhostDiner] 저승 휴게소 서버 시작 v" .. Config.Version)
