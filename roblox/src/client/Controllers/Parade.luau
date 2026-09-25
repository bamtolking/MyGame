--!strict
-- 슬라임 행진을 클라이언트에서 그립니다.
--  · 60fps 통통 점프: 착지 때 납작, 공중에서 길쭉(스쿼시·스트레치), 바닥 그림자가 높이에 따라 작아짐
--  · 가까운 슬라임은 착지할 때 "찰싹" 위치음
--  · 전설 이상·고배율 변이는 하늘로 솟는 빛기둥 + 멀리서도 보이는 ! 표시
--  · 구매 프롬프트(가격 색이 돈에 따라 바뀜)
-- 위치는 서버와 같은 공식(World.paradePosition)과 서버 시각으로 계산합니다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Mutations = require(Shared.Config.Mutations)
local Economy = require(Shared.Config.Economy)
local World = require(Shared.Config.World)
local SlimeBuilder = require(Shared.SlimeBuilder)
local Net = require(Shared.Net)
local Types = require(Shared.Types)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local State = require(Client.State)
local SlimeLabel = require(Client.SlimeLabel)
local Kit = require(Client.UI.Kit)
local Notify = require(Client.UI.Notify)
local Prompts = require(Client.UI.Prompts)
local Sound = require(script.Parent.Sound)
local Fx = require(script.Parent.Fx)

local Parade = {}

type Entry = {
	data: Types.ParadeSlime,
	model: Model,
	body: BasePart,
	mesh: SpecialMesh?,
	ground: Model,
	price: TextLabel?,
	phase: number,
	lastHop: number,
	rainbow: boolean,
}

local entries: { [number]: Entry } = {}
local folder: Folder
local lastSquishSound = 0
local HOP_RATE = 1.8
local HOP_HEIGHT = 1.4

local function now(): number
	return Workspace:GetServerTimeNow()
end

local function remove(key: number, bought: boolean)
	local e = entries[key]
	if not e then
		return
	end
	entries[key] = nil
	Fx.noteParadeExit(key, e.body.Position)
	if bought then
		Fx.poof(e.body.Position, Color3.fromRGB(255, 255, 255))
		Sound.playAt("poof", e.body.Position)
	end
	e.model:Destroy()
	e.ground:Destroy()
end

-- 빛기둥 + 멀리서 보이는 느낌표
local function beacon(body: BasePart, color: Color3)
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, 1, 0)
	a0.Parent = body
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, 70, 0)
	a1.Parent = body
	local beam = Instance.new("Beam")
	beam.Attachment0 = a0
	beam.Attachment1 = a1
	beam.Width0 = 3
	beam.Width1 = 0.6
	beam.FaceCamera = true
	beam.LightEmission = 1
	beam.Color = ColorSequence.new(color)
	beam.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.25), NumberSequenceKeypoint.new(1, 1) })
	beam.Parent = body
	local mark = Kit.new("BillboardGui", {
		Name = "RareMark",
		Size = UDim2.fromOffset(46, 46),
		StudsOffsetWorldSpace = Vector3.new(0, 16, 0),
		AlwaysOnTop = true,
		MaxDistance = 450,
		LightInfluence = 0,
		Parent = body,
	}) :: BillboardGui
	local label = Kit.label({
		Text = "!",
		BackgroundColor3 = color,
		BackgroundTransparency = 0,
		stroke = 3,
		Parent = mark,
	})
	Kit.corner(label, 23)
	task.spawn(function()
		while label.Parent do
			Kit.bump(label, 0.2)
			task.wait(0.7)
		end
	end)
end

local function add(data: Types.ParadeSlime)
	if entries[data.key] or not Slimes.byId[data.id] then
		return
	end
	local species = Slimes.byId[data.id]
	local rarity = Rarities.byId[species.rarity]
	local mutation = Mutations.byId[data.mut]
	local model = SlimeBuilder.build({ id = data.id, star = 1, mut = data.mut })
	model:SetAttribute("ParadeKey", data.key)
	local body = model:FindFirstChild("Body") :: BasePart
	-- 그림자·발밑 고리는 점프해도 바닥에 남도록 따로 둠
	local ground = Instance.new("Model")
	ground.Name = "Ground"
	-- 부품들이 원점 기준으로 만들어졌으므로 기준점도 원점
	ground.WorldPivot = CFrame.new()
	for _, child in model:GetChildren() do
		if child.Name == "Shadow" or child.Name == "Aura" then
			child.Parent = ground
		end
	end
	local gui = SlimeLabel.create(body, { id = data.id, star = 1, mut = data.mut }, "parade", data.price)
	gui.Parent = model
	local priceLabel = gui:FindFirstChild("Price", true)

	local attach = Instance.new("Attachment")
	attach.Position = Vector3.new(0, 1.6, 0)
	attach.Parent = body
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = Lang.t("buy")
	prompt.ObjectText = Lang.slime(data.id) .. " · " .. Lang.rarity(rarity.id)
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = Economy.parade.promptRange
	prompt.RequiresLineOfSight = false
	Prompts.style(prompt, "buy", if rarity.id == "secret" then Color3.new(1, 1, 1) else rarity.color, data.price)
	prompt.Parent = attach
	local key = data.key
	prompt.Triggered:Connect(function()
		local result = State.action("Buy", key)
		if result.ok then
			Sound.play("buy")
		else
			Notify.result(result)
		end
	end)

	if rarity.announce or (mutation and mutation.mult >= 5) then
		beacon(body, if rarity.id == "secret" then Color3.new(1, 1, 1) else rarity.color)
	end

	model.Parent = folder
	ground.Parent = folder
	entries[data.key] = {
		data = data,
		model = model,
		body = body,
		mesh = body:FindFirstChildOfClass("SpecialMesh"),
		ground = ground,
		price = if priceLabel and priceLabel:IsA("TextLabel") then priceLabel else nil,
		phase = math.random(),
		lastHop = 0,
		rainbow = body:GetAttribute("Rainbow") == true,
	}
end

local function refreshAffordable()
	for _, e in entries do
		if e.price then
			e.price.TextColor3 = if State.cash >= e.data.price
				then Color3.fromRGB(255, 220, 70)
				else Color3.fromRGB(255, 110, 110)
		end
	end
end

-- 진행 방향(+Z)을 바라보는 회전
local FACING = CFrame.Angles(0, math.pi, 0)

local function step()
	local t = now()
	local clock = os.clock()
	local camPos = (Workspace.CurrentCamera :: Camera).CFrame.Position
	for key, e in entries do
		local elapsed = t - e.data.spawnAt
		local pos = World.paradePosition(elapsed)
		if not pos then
			remove(key, false)
			continue
		end
		local hops = elapsed * HOP_RATE + e.phase
		local hopT = hops % 1
		local h = math.sin(hopT * math.pi)
		e.model:PivotTo(CFrame.new(pos + Vector3.new(0, h * HOP_HEIGHT, 0)) * FACING)
		e.ground:PivotTo(CFrame.new(pos) * FACING)
		local mesh = e.mesh
		if mesh then
			-- 착지 전후는 납작, 공중에서는 길쭉
			local squash = if hopT < 0.1 then 1 - (0.1 - hopT) * 2.2 elseif hopT > 0.92 then 1 - (hopT - 0.92) * 2.2 else 1 + h * 0.08
			mesh.Scale = Vector3.new(1 / math.sqrt(squash), squash, 1 / math.sqrt(squash))
		end
		local shadowScale = 1 - h * 0.35
		for _, part in e.ground:GetChildren() do
			if part.Name == "Shadow" and part:IsA("BasePart") then
				part.Transparency = 0.72 + h * 0.15
				local d = 3.9 * shadowScale
				part.Size = Vector3.new(part.Size.X, d, d)
			end
		end
		if e.rainbow then
			e.body.Color = Color3.fromHSV((clock * 0.25 + e.phase) % 1, 0.75, 1)
		end
		-- 새 점프 시작(= 착지) 순간
		local hopIndex = math.floor(hops)
		if hopIndex ~= e.lastHop then
			e.lastHop = hopIndex
			if clock - lastSquishSound > 0.25 and (pos - camPos).Magnitude < 45 then
				lastSquishSound = clock
				Sound.playAt("squish", pos, 0.9 + math.random() * 0.3)
			end
		end
	end
end

function Parade.init()
	folder = Instance.new("Folder")
	folder.Name = "ParadeClient"
	folder.Parent = Workspace

	Net.event("Parade").OnClientEvent:Connect(function(msg: { [string]: any })
		if msg.op == "spawn" then
			add(msg.slime)
			refreshAffordable()
		elseif msg.op == "remove" then
			remove(msg.key, msg.buyer ~= nil)
		end
	end)

	task.spawn(function()
		local result = State.action("ParadeSync")
		if result.ok and type(result.list) == "table" then
			for _, data in result.list do
				add(data)
			end
			refreshAffordable()
		end
	end)

	State.money:Connect(refreshAffordable)
	RunService.RenderStepped:Connect(step)
end

-- 튜토리얼용: 살 수 있는 가장 가까운 행진 슬라임
function Parade.nearestAffordable(from: Vector3): BasePart?
	local best: BasePart? = nil
	local bestDist = math.huge
	for _, e in entries do
		if e.data.price <= State.cash then
			local d = (e.body.Position - from).Magnitude
			if d < bestDist then
				best, bestDist = e.body, d
			end
		end
	end
	return best
end

return Parade
