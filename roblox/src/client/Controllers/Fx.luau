--!strict
-- 연출: 반짝 터짐, 색종이, 떠오르는 +$ 글자, 뿅망치 충격파, 넉백, 도둑 표시, 복수 윤곽선.

local Debris = game:GetService("Debris")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Mutations = require(Shared.Config.Mutations)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local Kit = require(Client.UI.Kit)
local Notify = require(Client.UI.Notify)
local Sound = require(script.Parent.Sound)

local Fx = {}

local player = Players.LocalPlayer
local fxFolder: Folder
local overlay: ScreenGui
local thiefMarks: { [number]: BillboardGui } = {}
local revengeHighlight: Highlight? = nil

local function anchoredPart(size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.Neon
	p.Parent = fxFolder
	return p
end

-- 반짝이 터짐
function Fx.poof(pos: Vector3, color: Color3, amount: number?)
	local p = anchoredPart(Vector3.new(0.2, 0.2, 0.2), CFrame.new(pos), color)
	p.Transparency = 1
	local emitter = Instance.new("ParticleEmitter")
	emitter.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	emitter.Color = ColorSequence.new(color)
	emitter.LightEmission = 1
	emitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.2), NumberSequenceKeypoint.new(1, 0) })
	emitter.Lifetime = NumberRange.new(0.5, 0.9)
	emitter.Speed = NumberRange.new(10, 22)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Rate = 0
	emitter.Parent = p
	emitter:Emit(amount or 30)
	Debris:AddItem(p, 1.5)
end

-- 바닥 충격파 고리
function Fx.ring(pos: Vector3, color: Color3, radius: number)
	local ring = anchoredPart(Vector3.new(0.4, 1, 1), CFrame.new(pos) * CFrame.Angles(0, 0, math.rad(90)), color)
	ring.Shape = Enum.PartType.Cylinder
	ring.Transparency = 0.2
	Kit.tween(ring, 0.35, { Size = Vector3.new(0.4, radius * 2, radius * 2), Transparency = 1 })
	Debris:AddItem(ring, 0.4)
end

-- 머리 위로 떠오르는 글자
function Fx.popText(pos: Vector3, text: string, color: Color3)
	local anchor = anchoredPart(Vector3.new(0.2, 0.2, 0.2), CFrame.new(pos), color)
	anchor.Transparency = 1
	local gui = Kit.new("BillboardGui", {
		Size = UDim2.fromOffset(220, 60),
		AlwaysOnTop = true,
		LightInfluence = 0,
		Parent = anchor,
	}) :: BillboardGui
	local label = Kit.label({ Text = text, TextColor3 = color, stroke = 3, Parent = gui })
	Kit.tween(anchor, 1.1, { CFrame = CFrame.new(pos + Vector3.new(0, 6, 0)) })
	task.delay(0.6, function()
		Kit.tween(label, 0.5, { TextTransparency = 1 })
	end)
	Debris:AddItem(anchor, 1.2)
end

-- 화면 색종이
function Fx.confetti(count: number?)
	local colors = { Kit.colors.pink, Kit.colors.yellow, Kit.colors.green, Kit.colors.blue, Kit.colors.purple, Kit.colors.orange }
	for _ = 1, count or 60 do
		local piece = Kit.new("Frame", {
			Size = UDim2.fromOffset(math.random(8, 14), math.random(12, 20)),
			Position = UDim2.new(math.random(), 0, 0, -30),
			BackgroundColor3 = colors[math.random(1, #colors)],
			Rotation = math.random(0, 360),
			BorderSizePixel = 0,
			Parent = overlay,
		}) :: Frame
		local fall = 1.4 + math.random() * 1.2
		Kit.tween(piece, fall, {
			Position = UDim2.new(piece.Position.X.Scale + (math.random() - 0.5) * 0.2, 0, 1.1, 0),
			Rotation = piece.Rotation + math.random(-360, 360),
		}, Enum.EasingStyle.Sine, Enum.EasingDirection.In)
		Debris:AddItem(piece, fall + 0.1)
	end
end

local function characterOf(userId: number): Model?
	local p = Players:GetPlayerByUserId(userId)
	return p and p.Character
end

local function rootOf(userId: number): BasePart?
	local char = characterOf(userId)
	local root = char and char:FindFirstChild("HumanoidRootPart")
	return if root and root:IsA("BasePart") then root else nil
end

local function markThief(userId: number, on: boolean)
	local existing = thiefMarks[userId]
	if existing then
		existing:Destroy()
		thiefMarks[userId] = nil
	end
	if not on then
		return
	end
	local char = characterOf(userId)
	local head = char and char:FindFirstChild("Head")
	if not head or not head:IsA("BasePart") then
		return
	end
	local gui = Kit.new("BillboardGui", {
		Name = "ThiefMark",
		Adornee = head,
		Size = UDim2.fromOffset(140, 40),
		StudsOffsetWorldSpace = Vector3.new(0, 7.5, 0),
		AlwaysOnTop = true,
		LightInfluence = 0,
		Parent = fxFolder,
	}) :: BillboardGui
	Kit.label({ Text = "🥷 " .. Lang.t("thief"), TextColor3 = Kit.colors.red, stroke = 3, Parent = gui })
	thiefMarks[userId] = gui
end

local function knockback(dir: Vector3, power: number, stun: number)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not hum or not root or not root:IsA("BasePart") then
		return
	end
	hum:ChangeState(Enum.HumanoidStateType.FallingDown)
	root.AssemblyLinearVelocity = dir * power + Vector3.new(0, 38, 0)
	Sound.play("hit")
	Fx.popText(root.Position + Vector3.new(0, 3, 0), "BONK!", Kit.colors.yellow)
	task.delay(stun, function()
		if hum.Parent and hum.Health > 0 then
			hum:ChangeState(Enum.HumanoidStateType.GettingUp)
		end
	end)
end

local function onFx(msg: { kind: string, data: { [string]: any }? })
	local d: { [string]: any } = msg.data or {}
	local kind = msg.kind
	if kind == "collect" then
		local root = rootOf(player.UserId)
		if root then
			Fx.popText(root.Position + Vector3.new(0, 4, 0), "+" .. Format.cash(d.amount or 0), Kit.colors.cash)
			Fx.poof(root.Position, Kit.colors.cash, 20)
		end
		Sound.play("collect")
	elseif kind == "sell" then
		Notify.toast(Lang.t("soldFor", { cash = Format.cash(d.amount or 0) }), "success")
	elseif kind == "bonk" then
		if typeof(d.pos) == "Vector3" then
			Fx.ring(d.pos - Vector3.new(0, 2.5, 0), if d.hit then Kit.colors.yellow else Kit.colors.white, 7)
			if d.attacker ~= player.UserId then
				Sound.play("bonk", 0.9 + math.random() * 0.2)
			end
		end
	elseif kind == "knockback" then
		if typeof(d.dir) == "Vector3" then
			knockback(d.dir, d.power or 50, d.stun or 1)
		end
	elseif kind == "carryStart" then
		markThief(d.thief, true)
		if d.thief ~= player.UserId then
			Sound.play("steal")
		end
	elseif kind == "carryEnd" then
		markThief(d.thief, false)
		if revengeHighlight and revengeHighlight.Adornee == characterOf(d.thief) then
			revengeHighlight:Destroy()
			revengeHighlight = nil
		end
	elseif kind == "revenge" then
		local char = characterOf(d.thief)
		if char then
			if revengeHighlight then
				revengeHighlight:Destroy()
			end
			local h = Instance.new("Highlight")
			h.FillColor = Kit.colors.red
			h.OutlineColor = Color3.new(1, 1, 1)
			h.FillTransparency = 0.4
			h.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
			h.Adornee = char
			h.Parent = fxFolder
			revengeHighlight = h
			Debris:AddItem(h, d.seconds or 15)
			Notify.banner(Lang.t("revengeTitle"), Lang.t("revengeSub"), Kit.colors.red, 3)
		end
	elseif kind == "stealSuccess" then
		Fx.confetti(40)
		Sound.play("success")
	elseif kind == "merge" or kind == "rebirth" then
		Fx.confetti(if kind == "rebirth" then 120 else 50)
		Sound.play("merge")
	elseif kind == "reward" then
		local parts = {}
		if d.cash then
			table.insert(parts, Format.cash(d.cash))
		end
		if d.boost then
			table.insert(parts, "💰x2 " .. Format.time(d.seconds or 0))
		end
		if d.slime then
			table.insert(parts, "🎁 " .. Lang.slime(d.slime))
		end
		if d.serverLuck then
			table.insert(parts, "🍀 x2")
		end
		if #parts > 0 then
			Notify.toast(Lang.t("youGot", { what = table.concat(parts, " + ") }), "success")
		end
		Fx.confetti(30)
	elseif kind == "lock" then
		Sound.play("lock")
		Notify.toast(Lang.t("lockedFor", { s = d.seconds or 60 }), "success")
	elseif kind == "zap" then
		Sound.play("zap")
	elseif kind == "bought" or kind == "mutate" then
		-- 기지에 새로 생긴/변이한 슬라임 위치에서 반짝
		task.wait(0.1)
		local plots = Workspace:FindFirstChild("Map")
		local plotsFolder = plots and plots:FindFirstChild("Plots")
		local plot = plotsFolder and plotsFolder:FindFirstChild("Plot" .. tostring(d.plot))
		local slimes = plot and plot:FindFirstChild("Slimes")
		local model = slimes and slimes:FindFirstChild("Slime_" .. tostring(d.uid))
		local body = model and model:FindFirstChild("Body")
		if body and body:IsA("BasePart") then
			local color = Color3.new(1, 1, 1)
			if kind == "mutate" and type(d.mut) == "string" and Mutations.byId[d.mut] then
				color = Mutations.byId[d.mut].label
			end
			Fx.poof(body.Position, color, 40)
		end
	end
end

function Fx.init()
	fxFolder = Instance.new("Folder")
	fxFolder.Name = "ClientFx"
	fxFolder.Parent = Workspace
	overlay = Kit.new("ScreenGui", {
		Name = "FxOverlay",
		ResetOnSpawn = false,
		DisplayOrder = 60,
		IgnoreGuiInset = true,
		Parent = player:WaitForChild("PlayerGui"),
	}) :: ScreenGui
	Net.event("Fx").OnClientEvent:Connect(onFx)
end

-- 내가 휘두를 때 즉시 보이는 연출(서버 응답 기다리지 않음)
function Fx.localBonk()
	local root = rootOf(player.UserId)
	if root then
		Fx.ring(root.Position + root.CFrame.LookVector * 3 - Vector3.new(0, 2.5, 0), Kit.colors.white, 7)
	end
	Sound.play("bonk")
end

return Fx
