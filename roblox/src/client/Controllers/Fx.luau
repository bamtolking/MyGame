--!strict
-- 연출 모음(클라이언트).
--  · 월드: 반짝 터짐, 충격파, 빛기둥, 떠오르는 글자, 망치 휘두르기, 어지러움 별
--  · 슬라임: 구매 시 행진 → 기지 포물선 비행, 합성 시 재료가 날아와 합쳐짐
--  · 화면: 동전이 돈 아이콘으로 날아감, 색종이, 섬광, 도둑 경보 테두리, 카메라 흔들림, 시야 펀치
--  · 설정의 "효과 줄이기"를 켜면 흔들림·섬광·색종이를 줄입니다.

local Debris = game:GetService("Debris")
local GuiService = game:GetService("GuiService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Mutations = require(Shared.Config.Mutations)
local Slimes = require(Shared.Config.Slimes)
local World = require(Shared.Config.World)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)
local SlimeBuilder = require(Shared.SlimeBuilder)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local State = require(Client.State)
local Kit = require(Client.UI.Kit)
local Hud = require(Client.UI.Hud)
local Notify = require(Client.UI.Notify)
local Sound = require(script.Parent.Sound)

local Fx = {}

Fx.reduced = false -- 효과 줄이기

local player = Players.LocalPlayer
local fxFolder: Folder
local overlay: ScreenGui
local thiefMarks: { [number]: BillboardGui } = {}
local revengeHighlight: Highlight? = nil
local paradeExits: { [number]: { pos: Vector3, t: number } } = {}
local shakeAmount = 0
local shakeUntil = 0
local lastAlarm = 0

local function camera(): Camera
	return Workspace.CurrentCamera :: Camera
end

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

local function near(pos: Vector3, range: number): boolean
	return (camera().CFrame.Position - pos).Magnitude <= range
end

---------------------------------------------------------------------------
-- 기본 연출
---------------------------------------------------------------------------

-- 반짝이 터짐
function Fx.poof(pos: Vector3, color: Color3, amount: number?)
	local p = anchoredPart(Vector3.new(0.2, 0.2, 0.2), CFrame.new(pos), color)
	p.Transparency = 1
	local emitter = Instance.new("ParticleEmitter")
	emitter.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	emitter.Color = ColorSequence.new(color)
	emitter.LightEmission = 1
	emitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.3), NumberSequenceKeypoint.new(1, 0) })
	emitter.Lifetime = NumberRange.new(0.5, 0.9)
	emitter.Speed = NumberRange.new(10, 24)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Drag = 3
	emitter.Rate = 0
	emitter.Parent = p
	emitter:Emit(if Fx.reduced then 10 else (amount or 30))
	Debris:AddItem(p, 1.5)
end

-- 바닥 충격파 고리
function Fx.ring(pos: Vector3, color: Color3, radius: number, seconds: number?)
	local ring = anchoredPart(Vector3.new(0.3, 1, 1), CFrame.new(pos) * CFrame.Angles(0, 0, math.rad(90)), color)
	ring.Shape = Enum.PartType.Cylinder
	ring.Transparency = 0.15
	local t = seconds or 0.4
	Kit.tween(ring, t, { Size = Vector3.new(0.3, radius * 2, radius * 2), Transparency = 1 })
	Debris:AddItem(ring, t + 0.05)
end

-- 위로 솟는 빛기둥
function Fx.column(pos: Vector3, color: Color3, height: number)
	local col = anchoredPart(Vector3.new(0.5, 5, 5), CFrame.new(pos) * CFrame.Angles(0, 0, math.rad(90)), color)
	col.Shape = Enum.PartType.Cylinder
	col.Transparency = 0.3
	Kit.tween(col, 0.5, {
		Size = Vector3.new(height, 2, 2),
		CFrame = CFrame.new(pos + Vector3.new(0, height / 2, 0)) * CFrame.Angles(0, 0, math.rad(90)),
		Transparency = 1,
	})
	Debris:AddItem(col, 0.55)
end

-- 떠오르는 글자(월드)
function Fx.popText(pos: Vector3, text: string, color: Color3, size: number?)
	local anchor = anchoredPart(Vector3.new(0.2, 0.2, 0.2), CFrame.new(pos), color)
	anchor.Transparency = 1
	local s = size or 1
	local gui = Kit.new("BillboardGui", {
		Size = UDim2.fromOffset(240 * s, 64 * s),
		AlwaysOnTop = true,
		LightInfluence = 0,
		Parent = anchor,
	}) :: BillboardGui
	local label = Kit.label({ Text = text, TextColor3 = color, stroke = 3, Rotation = math.random(-8, 8), Parent = gui })
	Kit.pop(label, 1.2)
	Kit.tween(anchor, 1.1, { CFrame = CFrame.new(pos + Vector3.new(0, 6, 0)) })
	task.delay(0.65, function()
		Kit.tween(label, 0.45, { TextTransparency = 1 })
	end)
	Debris:AddItem(anchor, 1.2)
end

-- 사방으로 튀는 작은 별
function Fx.stars(pos: Vector3, color: Color3, count: number)
	for _ = 1, if Fx.reduced then 3 else count do
		local star = anchoredPart(Vector3.new(0.5, 0.5, 0.5), CFrame.new(pos), color)
		star.Shape = Enum.PartType.Ball
		local dir = Vector3.new(math.random() - 0.5, 0.6 + math.random() * 0.6, math.random() - 0.5).Unit
		Kit.tween(star, 0.5, { CFrame = CFrame.new(pos + dir * (4 + math.random() * 3)), Size = Vector3.new(0.1, 0.1, 0.1) }, Enum.EasingStyle.Quad)
		Debris:AddItem(star, 0.55)
	end
end

---------------------------------------------------------------------------
-- 화면 연출
---------------------------------------------------------------------------

function Fx.shake(amount: number, seconds: number)
	if Fx.reduced then
		amount *= 0.25
	end
	shakeAmount = math.max(shakeAmount, amount)
	shakeUntil = math.max(shakeUntil, os.clock() + seconds)
end

function Fx.flash(color: Color3, alpha: number, seconds: number)
	if Fx.reduced then
		alpha = math.min(1, alpha + 0.4)
	end
	local f = Kit.new("Frame", {
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = color,
		BackgroundTransparency = alpha,
		BorderSizePixel = 0,
		ZIndex = 50,
		Parent = overlay,
	}) :: Frame
	Kit.tween(f, seconds, { BackgroundTransparency = 1 })
	Debris:AddItem(f, seconds + 0.05)
end

-- 시야를 잠깐 넓혔다 되돌리기(환생 등)
function Fx.fovPunch(amount: number)
	if Fx.reduced then
		return
	end
	local cam = camera()
	local base = cam.FieldOfView
	Kit.tween(cam, 0.15, { FieldOfView = base + amount })
	task.delay(0.15, function()
		Kit.tween(cam, 0.5, { FieldOfView = base }, Enum.EasingStyle.Back)
	end)
end

-- 도둑 경보: 붉은 테두리가 깜빡임 + 사이렌
function Fx.alarm()
	if os.clock() - lastAlarm < 2 then
		return
	end
	lastAlarm = os.clock()
	Sound.play("alarm")
	local frame = Kit.new("Frame", {
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		ZIndex = 45,
		Parent = overlay,
	}) :: Frame
	local stroke = Instance.new("UIStroke")
	stroke.Thickness = 24
	stroke.Color = Kit.colors.red
	stroke.Transparency = 1
	stroke.Parent = frame
	task.spawn(function()
		for _ = 1, 4 do
			Kit.tween(stroke, 0.18, { Transparency = 0.15 })
			task.wait(0.22)
			Kit.tween(stroke, 0.25, { Transparency = 1 })
			task.wait(0.28)
		end
		frame:Destroy()
	end)
end

-- 화면 색종이
function Fx.confetti(count: number?)
	local colors = { Kit.colors.pink, Kit.colors.yellow, Kit.colors.green, Kit.colors.blue, Kit.colors.purple, Kit.colors.orange }
	local n = count or 60
	if Fx.reduced then
		n = math.floor(n / 4)
	end
	for _ = 1, n do
		local piece = Kit.new("Frame", {
			Size = UDim2.fromOffset(math.random(8, 14), math.random(12, 20)),
			Position = UDim2.new(math.random(), 0, 0, -30),
			BackgroundColor3 = colors[math.random(1, #colors)],
			Rotation = math.random(0, 360),
			BorderSizePixel = 0,
			ZIndex = 40,
			Parent = overlay,
		}) :: Frame
		local fall = 1.4 + math.random() * 1.2
		Kit.tween(piece, fall, {
			Position = UDim2.new(piece.Position.X.Scale + (math.random() - 0.5) * 0.25, 0, 1.1, 0),
			Rotation = piece.Rotation + math.random(-420, 420),
		}, Enum.EasingStyle.Sine, Enum.EasingDirection.In)
		Debris:AddItem(piece, fall + 0.1)
	end
end

-- 월드 위치 → 돈 아이콘까지 동전이 날아감
function Fx.coinsToHud(worldPos: Vector3, count: number)
	local cam = camera()
	local screen, onScreen = cam:WorldToViewportPoint(worldPos)
	local start = if onScreen then Vector2.new(screen.X, screen.Y) else cam.ViewportSize / 2
	local anchor = Hud.cashAnchor()
	local inset = GuiService:GetGuiInset()
	local target = anchor.AbsolutePosition + inset + anchor.AbsoluteSize / 2
	local n = math.clamp(count, 1, if Fx.reduced then 3 else 10)
	for i = 1, n do
		local coinFrame = Kit.new("TextLabel", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromOffset(start.X, start.Y),
			Size = UDim2.fromOffset(30, 30),
			BackgroundColor3 = Kit.colors.yellow,
			Text = "$",
			TextScaled = true,
			Font = Kit.font,
			TextColor3 = Color3.new(1, 1, 1),
			ZIndex = 48,
			Parent = overlay,
		}) :: TextLabel
		Kit.corner(coinFrame, 15)
		Kit.stroke(coinFrame, 2, Color3.fromRGB(150, 95, 10)).ApplyStrokeMode = Enum.ApplyStrokeMode.Border
		local burst = start + Vector2.new(math.random(-70, 70), math.random(-80, 10))
		task.delay((i - 1) * 0.05, function()
			Kit.tween(coinFrame, 0.22, { Position = UDim2.fromOffset(burst.X, burst.Y) }, Enum.EasingStyle.Quad)
			task.wait(0.22)
			Kit.tween(coinFrame, 0.45, { Position = UDim2.fromOffset(target.X, target.Y), Size = UDim2.fromOffset(18, 18) }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			task.wait(0.45)
			coinFrame:Destroy()
			Sound.combo("coin", 0.6)
			Hud.coinArrived()
		end)
	end
end

---------------------------------------------------------------------------
-- 전투·훔치기
---------------------------------------------------------------------------

local function characterOf(userId: number): Model?
	local p = Players:GetPlayerByUserId(userId)
	return p and p.Character
end

local function rootOf(userId: number): BasePart?
	local char = characterOf(userId)
	local root = char and char:FindFirstChild("HumanoidRootPart")
	return if root and root:IsA("BasePart") then root else nil
end

-- 만화풍 망치를 휘두름(부품으로 즉석 조립)
function Fx.hammer(root: BasePart)
	local pivot = root.CFrame * CFrame.new(1.4, 1.2, -0.6)
	local handleColor = Color3.fromRGB(150, 100, 60)
	local handle = anchoredPart(Vector3.new(0.45, 4.2, 0.45), pivot, handleColor, Enum.Material.Wood)
	local head = anchoredPart(Vector3.new(2.6, 1.5, 1.5), pivot, Color3.fromRGB(235, 60, 80), Enum.Material.SmoothPlastic)
	local band = anchoredPart(Vector3.new(0.5, 1.6, 1.6), pivot, Color3.fromRGB(255, 255, 255), Enum.Material.SmoothPlastic)
	local started = os.clock()
	local conn: RBXScriptConnection
	conn = RunService.RenderStepped:Connect(function()
		local t = math.min(1, (os.clock() - started) / 0.14)
		local eased = t * t
		local angle = math.rad(110 - 130 * eased)
		local base = (root.Parent and root.CFrame or pivot) * CFrame.new(1.4, 1.2, -0.6) * CFrame.Angles(angle, 0, 0)
		handle.CFrame = base * CFrame.new(0, 2.1, 0)
		head.CFrame = base * CFrame.new(0, 4.3, 0)
		band.CFrame = head.CFrame
		if t >= 1 then
			conn:Disconnect()
			for _, p in { handle, head, band } do
				Kit.tween(p, 0.2, { Transparency = 1 })
				Debris:AddItem(p, 0.22)
			end
		end
	end)
end

-- 망치에 맞은 지점: 노란 충격파 + 별 + BONK! 글자
function Fx.impact(pos: Vector3, hit: boolean)
	Fx.ring(pos - Vector3.new(0, 2.5, 0), if hit then Kit.colors.yellow else Color3.new(1, 1, 1), if hit then 9 else 6)
	if hit then
		Fx.stars(pos, Kit.colors.yellow, 8)
		Fx.popText(pos + Vector3.new(0, 2, 0), "BONK!", Kit.colors.yellow, 1.3)
		if near(pos, 35) then
			Fx.shake(0.35, 0.25)
		end
	end
end

-- 맞은 내 머리 위로 도는 어지러움 별
local function dizzy(seconds: number)
	local char = player.Character
	local head = char and char:FindFirstChild("Head")
	if not head or not head:IsA("BasePart") then
		return
	end
	local stars: { Part } = {}
	for i = 1, 3 do
		local s = anchoredPart(Vector3.new(0.6, 0.6, 0.6), head.CFrame, Kit.colors.yellow)
		s.Shape = Enum.PartType.Ball
		stars[i] = s
	end
	local started = os.clock()
	local conn: RBXScriptConnection
	conn = RunService.RenderStepped:Connect(function()
		local t = os.clock() - started
		if t > seconds or not head.Parent then
			conn:Disconnect()
			for _, s in stars do
				s:Destroy()
			end
			return
		end
		for i, s in stars do
			local a = t * 6 + i * (math.pi * 2 / 3)
			s.CFrame = CFrame.new(head.Position + Vector3.new(math.cos(a) * 1.4, 1.3 + math.sin(t * 8 + i) * 0.2, math.sin(a) * 1.4))
		end
	end)
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
	Sound.play("bonkHit")
	Fx.shake(0.8, 0.35)
	Fx.flash(Color3.fromRGB(255, 240, 180), 0.55, 0.25)
	dizzy(stun + 0.4)
	task.delay(stun, function()
		if hum.Parent and hum.Health > 0 then
			hum:ChangeState(Enum.HumanoidStateType.GettingUp)
		end
	end)
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
		Size = UDim2.fromOffset(150, 42),
		StudsOffsetWorldSpace = Vector3.new(0, 7.5, 0),
		AlwaysOnTop = true,
		LightInfluence = 0,
		Parent = fxFolder,
	}) :: BillboardGui
	local label = Kit.label({
		Text = "🥷 " .. Lang.t("thief"),
		TextColor3 = Color3.new(1, 1, 1),
		BackgroundColor3 = Kit.colors.red,
		BackgroundTransparency = 0,
		stroke = 2.5,
		Parent = gui,
	})
	Kit.corner(label, 14)
	Kit.pop(label, 1.2)
	task.spawn(function()
		while gui.Parent do
			Kit.bump(label, 0.12)
			task.wait(0.6)
		end
	end)
	thiefMarks[userId] = gui
end

---------------------------------------------------------------------------
-- 슬라임 비행
---------------------------------------------------------------------------

local function plotFolder(plot: number): Instance?
	local map = Workspace:FindFirstChild("Map")
	local plots = map and map:FindFirstChild("Plots")
	return plots and plots:FindFirstChild("Plot" .. tostring(plot))
end

function Fx.baseModel(plot: number, uid: string): Model?
	local p = plotFolder(plot)
	local slimes = p and p:FindFirstChild("Slimes")
	local m = slimes and slimes:FindFirstChild("Slime_" .. uid)
	return if m and m:IsA("Model") then m else nil
end

local function setHidden(model: Model, hidden: boolean)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.LocalTransparencyModifier = if hidden then 1 else 0
		elseif d:IsA("BillboardGui") then
			d.Enabled = not hidden
		end
	end
end

-- Parade가 슬라임이 사라진 위치를 알려 줌(구매 비행 출발점)
function Fx.noteParadeExit(key: number, pos: Vector3)
	paradeExits[key] = { pos = pos, t = os.clock() }
end

-- 포물선 비행: from → to, 도착하면 onLand
local function arc(model: Model, from: Vector3, to: Vector3, seconds: number, onLand: () -> ())
	local started = os.clock()
	local peak = math.max(10, (to - from).Magnitude * 0.25)
	local conn: RBXScriptConnection
	conn = RunService.RenderStepped:Connect(function()
		local t = math.min(1, (os.clock() - started) / seconds)
		local pos = from:Lerp(to, t) + Vector3.new(0, math.sin(t * math.pi) * peak, 0)
		local flat = Vector3.new(to.X - from.X, 0, to.Z - from.Z)
		local facing = if flat.Magnitude > 0.1 then CFrame.lookAt(pos, pos + flat) else CFrame.new(pos)
		model:PivotTo(facing * CFrame.Angles(0, 0, math.sin(t * math.pi * 2) * 0.4))
		if t >= 1 then
			conn:Disconnect()
			onLand()
		end
	end)
end

local function ghost(info: { id: string, star: number, mut: string }, at: Vector3): Model
	local model = SlimeBuilder.build(info, CFrame.new(at))
	for _, name in { "Shadow", "Aura" } do
		for _, child in model:GetChildren() do
			if child.Name == name then
				child:Destroy()
			end
		end
	end
	local body = model:FindFirstChild("Body")
	if body and body:IsA("BasePart") then
		local a0 = Instance.new("Attachment")
		a0.Position = Vector3.new(0, 0.8, 0)
		a0.Parent = body
		local a1 = Instance.new("Attachment")
		a1.Position = Vector3.new(0, -0.8, 0)
		a1.Parent = body
		local trail = Instance.new("Trail")
		trail.Attachment0 = a0
		trail.Attachment1 = a1
		trail.Lifetime = 0.35
		trail.LightEmission = 0.8
		trail.Color = ColorSequence.new(body.Color)
		trail.Transparency = NumberSequence.new(0.3, 1)
		trail.Parent = body
	end
	model.Parent = fxFolder
	return model
end

local function onBought(d: { [string]: any })
	local plot, uid = d.plot, d.uid
	if type(plot) ~= "number" or type(uid) ~= "string" or type(d.id) ~= "string" or not Slimes.byId[d.id] then
		return
	end
	local exit = if type(d.key) == "number" then paradeExits[d.key] else nil
	local destination = World.padCFrame(plot, 1).Position
	-- 실제 모델이 복제되어 올 때까지 잠깐 기다림
	local real: Model? = nil
	for _ = 1, 20 do
		real = Fx.baseModel(plot, uid)
		if real then
			break
		end
		task.wait(0.05)
	end
	if real and real.PrimaryPart then
		destination = real.PrimaryPart.Position
	end
	local from = if exit then exit.pos else destination + Vector3.new(0, 30, 0)
	if not near(destination, 260) and not near(from, 260) then
		return
	end
	if real then
		setHidden(real, true)
	end
	local mut = if type(d.mut) == "string" then d.mut else "none"
	local g = ghost({ id = d.id, star = 1, mut = mut }, from)
	Sound.playAt("flight", from)
	arc(g, from, destination, 0.8, function()
		g:Destroy()
		if real and real.Parent then
			setHidden(real, false)
		end
		Fx.poof(destination + Vector3.new(0, 1.5, 0), Color3.new(1, 1, 1), 26)
		Fx.ring(destination + Vector3.new(0, 0.2, 0), Kit.colors.yellow, 5)
		Sound.playAt("land", destination)
	end)
end

local function onMerge(d: { [string]: any })
	local plot, uid = d.plot, d.uid
	if type(plot) ~= "number" or type(uid) ~= "string" then
		return
	end
	local mine = d.owner == player.UserId
	local target = World.padCFrame(plot, 1).Position
	local real = Fx.baseModel(plot, uid)
	for _ = 1, 20 do
		if real then
			break
		end
		task.wait(0.05)
		real = Fx.baseModel(plot, uid)
	end
	if real and real.PrimaryPart then
		target = real.PrimaryPart.Position
	end
	if not mine and not near(target, 200) then
		return
	end
	local species = if type(d.id) == "string" then Slimes.byId[d.id] else nil
	local color = if species then species.color else Color3.new(1, 1, 1)
	if real then
		setHidden(real, true)
	end
	local from = if type(d.from) == "table" then d.from else {}
	for _, pad in from do
		if type(pad) == "number" then
			local start = World.padCFrame(plot, pad).Position + Vector3.new(0, 1.6, 0)
			local blob = anchoredPart(Vector3.new(2.4, 2.4, 2.4), CFrame.new(start), color, Enum.Material.Neon)
			blob.Shape = Enum.PartType.Ball
			Kit.tween(blob, 0.45, { CFrame = CFrame.new(target + Vector3.new(0, 2, 0)), Size = Vector3.new(1, 1, 1) }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
			Debris:AddItem(blob, 0.46)
		end
	end
	task.wait(0.45)
	if real and real.Parent then
		setHidden(real, false)
	end
	local star = if type(d.star) == "number" then d.star else 2
	Fx.poof(target + Vector3.new(0, 2, 0), Kit.colors.yellow, 50)
	Fx.ring(target + Vector3.new(0, 0.2, 0), Kit.colors.yellow, 8)
	Fx.column(target, Kit.colors.yellow, 22)
	Fx.popText(target + Vector3.new(0, 5, 0), string.rep("★", star) .. "!", Kit.colors.yellow, 1.4)
	if mine then
		Sound.play("merge")
		Fx.confetti(50)
		Fx.shake(0.25, 0.2)
	else
		Sound.playAt("merge", target)
	end
end

---------------------------------------------------------------------------
-- 서버 연출 이벤트
---------------------------------------------------------------------------

local function ownPlotPart(name: string): BasePart?
	local view = State.view
	if not view or view.plot == 0 then
		return nil
	end
	local p = plotFolder(view.plot)
	local part = p and p:FindFirstChild(name)
	return if part and part:IsA("BasePart") then part else nil
end

local function onFx(msg: { kind: string, data: { [string]: any }? })
	local d: { [string]: any } = msg.data or {}
	local kind = msg.kind
	if kind == "collect" then
		local plate = ownPlotPart("CollectPlate")
		local root = rootOf(player.UserId)
		local from = if plate then plate.Position + Vector3.new(0, 1, 0) elseif root then root.Position else Vector3.zero
		local amount = if type(d.amount) == "number" then d.amount else 0
		Fx.coinsToHud(from, 4 + math.floor(math.log10(amount + 1)))
		Fx.poof(from, Kit.colors.cash, 24)
		Fx.ring(from - Vector3.new(0, 0.8, 0), Kit.colors.cash, 6)
		Sound.play("collect")
	elseif kind == "sell" then
		local root = rootOf(player.UserId)
		if root then
			Fx.coinsToHud(root.Position, 5)
		end
		Notify.toast(Lang.t("soldFor", { cash = Format.cash(d.amount or 0) }), "success")
	elseif kind == "bonk" then
		if d.attacker ~= player.UserId then
			local root = if type(d.attacker) == "number" then rootOf(d.attacker) else nil
			if root then
				Fx.hammer(root)
			end
			if typeof(d.pos) == "Vector3" then
				task.delay(0.14, Fx.impact, d.pos, d.hit == true)
				Sound.playAt("bonk", d.pos, 0.9 + math.random() * 0.2)
			end
		elseif d.hit and typeof(d.pos) == "Vector3" then
			-- 내가 맞혔을 때는 서버 확인 후 별·글자만 추가
			Fx.stars(d.pos, Kit.colors.yellow, 8)
			Fx.popText(d.pos + Vector3.new(0, 2, 0), "BONK!", Kit.colors.yellow, 1.3)
			Fx.shake(0.3, 0.2)
		end
	elseif kind == "knockback" then
		if typeof(d.dir) == "Vector3" then
			knockback(d.dir, d.power or 50, d.stun or 1)
		end
	elseif kind == "carryStart" then
		markThief(d.thief, true)
		if type(d.plot) == "number" and type(d.pad) == "number" then
			local padPos = World.padCFrame(d.plot, d.pad).Position
			Fx.ring(padPos + Vector3.new(0, 0.3, 0), Kit.colors.red, 6)
			Fx.poof(padPos + Vector3.new(0, 2, 0), Kit.colors.red, 20)
			Sound.playAt("steal", padPos)
		end
		if d.victim == player.UserId then
			Fx.alarm()
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
			Notify.banner(Lang.t("revengeTitle"), Lang.t("revengeSub"), Kit.colors.red, 3, "😡")
			Fx.alarm()
		end
	elseif kind == "stealSuccess" then
		Fx.confetti(45)
		Sound.play("stealSuccess")
		Fx.flash(Kit.colors.green, 0.7, 0.3)
	elseif kind == "merge" then
		onMerge(d)
	elseif kind == "rebirth" then
		Fx.flash(Color3.new(1, 1, 1), 0.2, 0.8)
		Fx.fovPunch(14)
		Fx.shake(0.5, 0.4)
		Fx.confetti(140)
		Sound.play("rebirth")
		local root = rootOf(player.UserId)
		if root then
			Fx.column(root.Position - Vector3.new(0, 3, 0), Kit.colors.pink, 40)
			Fx.ring(root.Position - Vector3.new(0, 2.8, 0), Kit.colors.pink, 16, 0.7)
		end
	elseif kind == "reward" then
		local parts = {}
		if d.cash then
			table.insert(parts, Format.cash(d.cash))
			local root = rootOf(player.UserId)
			if root then
				Fx.coinsToHud(root.Position, 8)
			end
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
		Sound.play("reward")
		Fx.confetti(30)
	elseif kind == "lock" then
		Sound.play("lock")
		local plate = ownPlotPart("LockPlate")
		if plate then
			Fx.ring(plate.Position, Kit.colors.red, 10)
			Fx.column(plate.Position, Kit.colors.red, 16)
		end
		Notify.toast(Lang.t("lockedFor", { s = d.seconds or 60 }), "success")
	elseif kind == "zap" then
		Sound.play("zap")
		Fx.flash(Kit.colors.blue, 0.6, 0.25)
		Fx.shake(0.3, 0.2)
	elseif kind == "bought" then
		onBought(d)
	elseif kind == "mutate" then
		task.wait(0.1)
		local model = if type(d.plot) == "number" and type(d.uid) == "string" then Fx.baseModel(d.plot, d.uid) else nil
		local body = model and model:FindFirstChild("Body")
		if body and body:IsA("BasePart") then
			local color = Color3.new(1, 1, 1)
			if type(d.mut) == "string" and Mutations.byId[d.mut] then
				color = Mutations.byId[d.mut].label
			end
			Fx.poof(body.Position, color, 40)
			Fx.column(body.Position - Vector3.new(0, 1.5, 0), color, 18)
			Sound.playAt("mutate", body.Position)
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
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		Parent = player:WaitForChild("PlayerGui"),
	}) :: ScreenGui
	Net.event("Fx").OnClientEvent:Connect(onFx)
	Notify.onAlarm = Fx.alarm

	-- 카메라 흔들림(카메라 갱신 직후에 살짝 비틀기)
	RunService:BindToRenderStep("SlimeHeistShake", Enum.RenderPriority.Camera.Value + 1, function()
		local now = os.clock()
		if now < shakeUntil and shakeAmount > 0 then
			local left = (shakeUntil - now)
			local a = shakeAmount * math.min(1, left * 4)
			local cam = camera()
			cam.CFrame = cam.CFrame
				* CFrame.new((math.random() - 0.5) * a, (math.random() - 0.5) * a, 0)
				* CFrame.Angles(0, 0, (math.random() - 0.5) * a * 0.05)
		else
			shakeAmount = 0
		end
	end)

	-- 오래된 행진 퇴장 기록 정리
	task.spawn(function()
		while true do
			task.wait(5)
			local now = os.clock()
			for key, e in paradeExits do
				if now - e.t > 5 then
					paradeExits[key] = nil
				end
			end
		end
	end)
end

-- 내가 휘두를 때 즉시 보이는 연출(서버 응답 기다리지 않음)
function Fx.localBonk()
	local root = rootOf(player.UserId)
	if root then
		Fx.hammer(root)
		local pos = root.Position + root.CFrame.LookVector * 3
		task.delay(0.14, Fx.impact, pos, false)
	end
	Sound.play("bonk")
end

return Fx
