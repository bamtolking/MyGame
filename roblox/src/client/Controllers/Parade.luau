--!strict
-- 슬라임 행진을 클라이언트에서 그립니다(60fps 통통 튀는 이동 + 구매 프롬프트).
-- 위치는 서버와 같은 공식(World.paradePosition)과 서버 시각으로 계산합니다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Slimes = require(Shared.Config.Slimes)
local Economy = require(Shared.Config.Economy)
local World = require(Shared.Config.World)
local Format = require(Shared.Util.Format)
local SlimeBuilder = require(Shared.SlimeBuilder)
local Net = require(Shared.Net)
local Types = require(Shared.Types)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local State = require(Client.State)
local SlimeLabel = require(Client.SlimeLabel)
local Notify = require(Client.UI.Notify)
local Sound = require(script.Parent.Sound)
local Fx = require(script.Parent.Fx)

local Parade = {}

type Entry = {
	data: Types.ParadeSlime,
	model: Model,
	price: TextLabel?,
	phase: number,
}

local entries: { [number]: Entry } = {}
local folder: Folder

local function now(): number
	return Workspace:GetServerTimeNow()
end

local function remove(key: number, bought: boolean)
	local e = entries[key]
	if not e then
		return
	end
	entries[key] = nil
	if bought then
		local body = e.model:FindFirstChild("Body")
		if body and body:IsA("BasePart") then
			Fx.poof(body.Position, Color3.fromRGB(255, 255, 255))
		end
	end
	e.model:Destroy()
end

local function add(data: Types.ParadeSlime)
	if entries[data.key] or not Slimes.byId[data.id] then
		return
	end
	local model = SlimeBuilder.build({ id = data.id, star = 1, mut = data.mut })
	local body = model:FindFirstChild("Body") :: BasePart
	local gui = SlimeLabel.create(body, { id = data.id, star = 1, mut = data.mut }, "parade", data.price)
	gui.Parent = model
	local priceLabel = gui:FindFirstChild("Price", true)

	local attach = Instance.new("Attachment")
	attach.Position = Vector3.new(0, 1.6, 0)
	attach.Parent = body
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = Lang.t("buyFor", { cash = Format.cash(data.price) })
	prompt.ObjectText = Lang.slime(data.id)
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = Economy.parade.promptRange
	prompt.RequiresLineOfSight = false
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

	model.Parent = folder
	entries[data.key] = {
		data = data,
		model = model,
		price = if priceLabel and priceLabel:IsA("TextLabel") then priceLabel else nil,
		phase = math.random() * math.pi * 2,
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

local function step()
	local t = now()
	for key, e in entries do
		local elapsed = t - e.data.spawnAt
		local pos = World.paradePosition(elapsed)
		if not pos then
			remove(key, false)
			continue
		end
		-- 통통 튀기: 0.55초마다 한 번 점프
		local hopT = (elapsed * 1.8 + e.phase) % 1
		local hop = math.sin(hopT * math.pi) * 1.3
		local cf = CFrame.lookAt(pos, pos + Vector3.new(0, 0, 1)) + Vector3.new(0, hop, 0)
		e.model:PivotTo(cf)
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
			local body = e.model:FindFirstChild("Body")
			if body and body:IsA("BasePart") then
				local d = (body.Position - from).Magnitude
				if d < bestDist then
					best, bestDist = body, d
				end
			end
		end
	end
	return best
end

return Parade
