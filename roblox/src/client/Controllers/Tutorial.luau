--!strict
-- 첫 3분 튜토리얼: 빛나는 빔으로 목표를 가리킵니다.
--   0: 행진에서 슬라임 사기 → 1: 수금 발판 밟기 → 2: 잠금 발판 밟기 → 3: 끝(팁 몇 개)

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local World = require(Shared.Config.World)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local State = require(Client.State)
local Hud = require(Client.UI.Hud)
local Notify = require(Client.UI.Notify)
local Parade = require(script.Parent.Parade)

local Tutorial = {}

local player = Players.LocalPlayer
local beam: Beam
local a0: Attachment
local a1: Attachment
local targetPart: Part
local tipsShown = false

local function plotPart(name: string): BasePart?
	local view = State.view
	if not view or view.plot == 0 then
		return nil
	end
	local map = Workspace:FindFirstChild("Map")
	local plots = map and map:FindFirstChild("Plots")
	local plot = plots and plots:FindFirstChild("Plot" .. view.plot)
	local part = plot and plot:FindFirstChild(name)
	return if part and part:IsA("BasePart") then part else nil
end

local function root(): BasePart?
	local char = player.Character
	local r = char and char:FindFirstChild("HumanoidRootPart")
	return if r and r:IsA("BasePart") then r else nil
end

local function showTips()
	if tipsShown then
		return
	end
	tipsShown = true
	task.spawn(function()
		for _, key in { "tipMerge", "tipBonk", "tipWeather", "tipSteal" } do
			task.wait(9)
			Notify.toast(Lang.t(key), "info")
		end
	end)
end

local function update()
	local data = State.data()
	local r = root()
	if not data or not r then
		beam.Enabled = false
		return
	end
	if a0.Parent ~= r then
		a0.Parent = r
	end
	local step = data.tutorial
	local target: Vector3? = nil
	if step == 0 then
		local slime = Parade.nearestAffordable(r.Position)
		if slime then
			target = slime.Position
		else
			target = Vector3.new(World.parade.x, 2, r.Position.Z)
		end
		Hud.setTutorial(Lang.t("tut0"))
	elseif step == 1 then
		local plate = plotPart("CollectPlate")
		if State.vault < 1 then
			Hud.setTutorial(Lang.t("tut1wait"))
			target = nil
		else
			target = if plate then plate.Position else nil
			Hud.setTutorial(Lang.t("tut1"))
		end
	elseif step == 2 then
		local plate = plotPart("LockPlate")
		target = if plate then plate.Position else nil
		Hud.setTutorial(Lang.t("tut2"))
	else
		Hud.setTutorial(nil)
		showTips()
	end
	if target then
		targetPart.CFrame = CFrame.new(target + Vector3.new(0, 1, 0))
		beam.Enabled = true
	else
		beam.Enabled = false
	end
end

function Tutorial.init()
	targetPart = Instance.new("Part")
	targetPart.Name = "TutorialTarget"
	targetPart.Anchored = true
	targetPart.CanCollide = false
	targetPart.CanQuery = false
	targetPart.CanTouch = false
	targetPart.Transparency = 1
	targetPart.Size = Vector3.new(1, 1, 1)
	targetPart.Parent = Workspace
	a1 = Instance.new("Attachment")
	a1.Parent = targetPart
	a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, -1.5, 0)
	beam = Instance.new("Beam")
	beam.Attachment0 = a0
	beam.Attachment1 = a1
	beam.Width0 = 1.2
	beam.Width1 = 1.2
	beam.FaceCamera = true
	beam.LightEmission = 1
	beam.Segments = 20
	beam.CurveSize0 = 0
	beam.CurveSize1 = 0
	beam.Color = ColorSequence.new(Color3.fromRGB(255, 240, 120), Color3.fromRGB(120, 255, 160))
	beam.Transparency = NumberSequence.new(0.2)
	beam.Enabled = false
	beam.Parent = targetPart

	-- 빔이 흐르는 느낌
	local arrow = Instance.new("BillboardGui")
	arrow.Size = UDim2.fromOffset(60, 60)
	arrow.StudsOffset = Vector3.new(0, 4, 0)
	arrow.AlwaysOnTop = true
	arrow.Parent = targetPart
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = "⬇"
	label.TextScaled = true
	label.TextColor3 = Color3.fromRGB(255, 240, 120)
	label.Parent = arrow

	task.spawn(function()
		while true do
			task.wait(0.25)
			local ok = pcall(update)
			arrow.Enabled = ok and beam.Enabled
		end
	end)
end

return Tutorial
