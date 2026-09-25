--!strict
-- 기지 슬라임: 이름표 + 프롬프트(내 것은 "관리", 남의 것은 길게 눌러 "훔치기").

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Calc = require(Shared.Logic.Calc)
local SlimeBuilder = require(Shared.SlimeBuilder)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local State = require(Client.State)
local SlimeLabel = require(Client.SlimeLabel)
local Notify = require(Client.UI.Notify)
local Manage = require(Client.UI.Panels.Manage)
local Sound = require(script.Parent.Sound)

local BaseSlimes = {}

local player = Players.LocalPlayer
local prompts: { [Model]: ProximityPrompt } = {}

local function plotModel(index: number): Instance?
	local map = Workspace:FindFirstChild("Map")
	local plots = map and map:FindFirstChild("Plots")
	return plots and plots:FindFirstChild("Plot" .. index)
end

local function isProtected(index: number): boolean
	local plot = plotModel(index)
	if not plot then
		return false
	end
	local now = Workspace:GetServerTimeNow()
	local lockEnds = plot:GetAttribute("LockEnds")
	local shieldEnds = plot:GetAttribute("ShieldEnds")
	return (type(lockEnds) == "number" and lockEnds > now)
		or (type(shieldEnds) == "number" and shieldEnds > now)
		or plot:GetAttribute("Rookie") == true
end

local function setup(model: Instance)
	if not model:IsA("Model") or prompts[model] then
		return
	end
	local body = model:WaitForChild("Body", 5)
	if not body or not body:IsA("BasePart") then
		return
	end
	local id = model:GetAttribute("SpeciesId")
	local star = model:GetAttribute("Star")
	local mut = model:GetAttribute("Mutation")
	local uid = model:GetAttribute("Uid")
	local owner = model:GetAttribute("OwnerUserId")
	local plotIndex = model:GetAttribute("PlotIndex")
	if type(id) ~= "string" or type(star) ~= "number" or type(mut) ~= "string" or type(uid) ~= "string" then
		return
	end
	local info = { id = id, star = star, mut = mut }

	local gui = SlimeLabel.create(body, info, "base")
	gui.Parent = model

	local attach = Instance.new("Attachment")
	attach.Position = Vector3.new(0, SlimeBuilder.height(star) / 2, 0)
	attach.Parent = body
	local prompt = Instance.new("ProximityPrompt")
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.RequiresLineOfSight = false
	prompt.MaxActivationDistance = 9
	prompt.ObjectText = Lang.slime(id)
	prompt.Parent = attach
	prompts[model] = prompt

	if owner == player.UserId then
		prompt.ActionText = Lang.t("manage")
		prompt.HoldDuration = 0
		prompt.Triggered:Connect(function()
			Manage.open(uid)
		end)
	else
		local fav = model:GetAttribute("Fav") == true
		prompt.ActionText = if fav then Lang.t("protectedFav") else Lang.t("steal")
		prompt.Enabled = not fav
		prompt.HoldDuration = Calc.stealHold(info)
		local payload = { plot = plotIndex, uid = uid }
		prompt.PromptButtonHoldBegan:Connect(function()
			task.spawn(function()
				local result = State.action("StealStart", payload)
				if not result.ok then
					Notify.result(result)
				end
			end)
		end)
		prompt.Triggered:Connect(function()
			local result = State.action("StealFinish", payload)
			if result.ok then
				Sound.play("steal")
			else
				Notify.result(result)
			end
		end)
	end
end

local function cleanup(model: Instance)
	if model:IsA("Model") then
		prompts[model] = nil
	end
end

function BaseSlimes.init()
	CollectionService:GetInstanceAddedSignal("BaseSlime"):Connect(function(inst)
		task.spawn(setup, inst)
	end)
	CollectionService:GetInstanceRemovedSignal("BaseSlime"):Connect(cleanup)
	for _, inst in CollectionService:GetTagged("BaseSlime") do
		task.spawn(setup, inst)
	end

	-- 보호 중인 기지의 훔치기 프롬프트 끄기
	task.spawn(function()
		while true do
			task.wait(0.5)
			for model, prompt in prompts do
				if model.Parent == nil then
					prompts[model] = nil
				elseif model:GetAttribute("OwnerUserId") ~= player.UserId then
					local plotIndex = model:GetAttribute("PlotIndex")
					local fav = model:GetAttribute("Fav") == true
					local blocked = fav or (type(plotIndex) == "number" and isProtected(plotIndex))
					prompt.Enabled = not blocked
				end
			end
		end
	end)
end

return BaseSlimes
