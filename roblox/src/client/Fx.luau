--!nonstrict
-- 화면·월드 연출: 카메라 흔들림, 요리 날아가기, 파티클 폭죽, 번개, 정전 오버레이, 저체력 비네트.
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("GhostDiner")
local ItemVisuals = require(Shared:WaitForChild("ItemVisuals"))

local Fx = {}

local rng = Random.new()
local flashFrame: Frame
local blackoutFrame: Frame
local vignetteFrames: { Frame } = {}
local shakeUntil, shakeDuration, shakeIntensity = 0, 1, 0

Fx.Colors = {
	gold = Color3.fromRGB(255, 215, 80),
	green = Color3.fromRGB(120, 255, 150),
	blue = Color3.fromRGB(120, 200, 255),
	red = Color3.fromRGB(255, 80, 80),
	purple = Color3.fromRGB(200, 120, 255),
	pink = Color3.fromRGB(255, 130, 200),
	orange = Color3.fromRGB(255, 160, 60),
	white = Color3.fromRGB(255, 255, 255),
}

local function mk(className: string, props: { [string]: any }, parent: Instance?): Instance
	local inst = Instance.new(className)
	for k, v in props do
		(inst :: any)[k] = v
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

local function tempPart(position: Vector3): Part
	return mk("Part", { Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, Transparency = 1, Size = Vector3.new(0.5, 0.5, 0.5), Position = position }, workspace) :: Part
end

local function shakeStep()
	local camera = workspace.CurrentCamera
	if not camera then
		return
	end
	local t = os.clock()
	if t < shakeUntil then
		local k = shakeIntensity * ((shakeUntil - t) / shakeDuration)
		camera.CFrame = camera.CFrame * CFrame.new(rng:NextNumber(-k, k), rng:NextNumber(-k, k), 0) * CFrame.Angles(0, 0, math.rad(rng:NextNumber(-k, k) * 1.5))
	end
end

function Fx.init(playerGui: PlayerGui)
	local under = mk("ScreenGui", { Name = "GhostDinerFxUnder", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 0 }, playerGui)
	local over = mk("ScreenGui", { Name = "GhostDinerFxOver", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 20 }, playerGui)
	blackoutFrame = mk("Frame", { Name = "Blackout", Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(0, 0, 0), BackgroundTransparency = 1, BorderSizePixel = 0 }, under) :: Frame
	flashFrame = mk("Frame", { Name = "Flash", Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(255, 255, 255), BackgroundTransparency = 1, BorderSizePixel = 0 }, over) :: Frame
	-- 비네트(가장자리 빨간 기운): 네 변에 그라데이션 프레임
	local sides = {
		{ Position = UDim2.new(0, 0, 0, 0), Size = UDim2.new(1, 0, 0.28, 0), Rotation = 90 },
		{ Position = UDim2.new(0, 0, 0.72, 0), Size = UDim2.new(1, 0, 0.28, 0), Rotation = -90 },
		{ Position = UDim2.new(0, 0, 0, 0), Size = UDim2.new(0.22, 0, 1, 0), Rotation = 0 },
		{ Position = UDim2.new(0.78, 0, 0, 0), Size = UDim2.new(0.22, 0, 1, 0), Rotation = 180 },
	}
	for _, s in sides do
		local f = mk("Frame", { Position = s.Position, Size = s.Size, BackgroundColor3 = Color3.fromRGB(200, 20, 30), BackgroundTransparency = 1, BorderSizePixel = 0 }, under) :: Frame
		mk("UIGradient", { Rotation = s.Rotation, Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(1, 1) }) }, f)
		table.insert(vignetteFrames, f)
	end
	RunService:BindToRenderStep("GhostDinerShake", Enum.RenderPriority.Camera.Value + 1, shakeStep)
end

function Fx.shake(intensity: number, duration: number)
	local t = os.clock()
	if t < shakeUntil and shakeIntensity > intensity then
		return
	end
	shakeIntensity = intensity
	shakeDuration = math.max(0.05, duration)
	shakeUntil = t + duration
end

-- 거리에 따라 약해지는 흔들림
function Fx.shakeAt(position: Vector3, intensity: number, duration: number)
	local camera = workspace.CurrentCamera
	if not camera then
		return
	end
	local d = (camera.CFrame.Position - position).Magnitude
	local k = math.clamp(1 - d / 70, 0, 1)
	if k > 0.05 then
		Fx.shake(intensity * k, duration)
	end
end

function Fx.burst(position: Vector3, color: Color3, count: number, size: number?, speed: number?)
	local p = tempPart(position)
	local e = mk("ParticleEmitter", {
		Rate = 0,
		Lifetime = NumberRange.new(0.5, 1.1),
		Speed = NumberRange.new(speed or 6, (speed or 6) * 1.7),
		Size = NumberSequence.new(size or 0.5, 0),
		Color = ColorSequence.new(color),
		LightEmission = 1,
		SpreadAngle = Vector2.new(180, 180),
		Transparency = NumberSequence.new(0, 1),
		Acceleration = Vector3.new(0, -6, 0),
	}, p) :: ParticleEmitter
	e:Emit(count)
	task.delay(2, function()
		p:Destroy()
	end)
end

function Fx.sparkle(position: Vector3, colorName: string?)
	Fx.burst(position, Fx.Colors[colorName or "gold"] or Fx.Colors.gold, 24)
end

-- 요리가 요리사 손에서 손님에게 포물선으로 날아감
function Fx.serveFly(from: Vector3, to: Vector3, itemId: string, onArrive: (() -> ())?)
	local model = ItemVisuals.build(itemId)
	for _, p in model:GetDescendants() do
		if p:IsA("BasePart") then
			p.Anchored = true
		end
	end
	model.Parent = workspace
	local start = os.clock()
	local duration = 0.45
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local u = math.clamp((os.clock() - start) / duration, 0, 1)
		local pos = from:Lerp(to, u) + Vector3.new(0, math.sin(u * math.pi) * 4, 0)
		model:PivotTo(CFrame.new(pos) * CFrame.Angles(0, u * math.pi * 2, 0))
		if u >= 1 then
			conn:Disconnect()
			model:Destroy()
			if onArrive then
				onArrive()
			end
		end
	end)
end

function Fx.floatText(position: Vector3, text: string, color: Color3, textSize: number?)
	local p = tempPart(position)
	local gui = mk("BillboardGui", { Size = UDim2.new(0, 240, 0, 50), AlwaysOnTop = true, LightInfluence = 0 }, p)
	local label = mk("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0), Font = Enum.Font.GothamBlack, TextSize = textSize or 26, TextColor3 = color, TextStrokeTransparency = 0.2, Text = text }, gui)
	TweenService:Create(p, TweenInfo.new(1.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = position + Vector3.new(0, 4.5, 0) }):Play()
	TweenService:Create(label, TweenInfo.new(1.3, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	task.delay(1.4, function()
		p:Destroy()
	end)
end

function Fx.confetti(center: Vector3)
	local colors = { Fx.Colors.gold, Fx.Colors.pink, Fx.Colors.blue, Fx.Colors.green }
	for i, color in colors do
		local p = tempPart(center + Vector3.new((i - 2.5) * 7, 0, 0))
		local e = mk("ParticleEmitter", {
			Rate = 0,
			Lifetime = NumberRange.new(1.6, 2.6),
			Speed = NumberRange.new(14, 22),
			Size = NumberSequence.new(0.55, 0.3),
			Color = ColorSequence.new(color),
			SpreadAngle = Vector2.new(70, 70),
			Acceleration = Vector3.new(0, -26, 0),
			Rotation = NumberRange.new(0, 360),
			RotSpeed = NumberRange.new(-240, 240),
			LightEmission = 0.5,
		}, p) :: ParticleEmitter
		e:Emit(45)
		task.delay(3.5, function()
			p:Destroy()
		end)
	end
end

function Fx.flash(color: Color3, alpha: number, duration: number)
	flashFrame.BackgroundColor3 = color
	flashFrame.BackgroundTransparency = 1 - alpha
	TweenService:Create(flashFrame, TweenInfo.new(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { BackgroundTransparency = 1 }):Play()
end

function Fx.lightning()
	Fx.flash(Fx.Colors.white, 0.85, 0.35)
	task.delay(0.18, function()
		Fx.flash(Fx.Colors.white, 0.5, 0.6)
	end)
	Fx.shake(0.7, 0.6)
end

function Fx.setBlackout(on: boolean)
	if on then
		task.spawn(function()
			for i = 1, 6 do
				blackoutFrame.BackgroundTransparency = if i % 2 == 0 then 0.95 else 0.4
				task.wait(0.07)
			end
			blackoutFrame.BackgroundTransparency = 0.72
		end)
	else
		TweenService:Create(blackoutFrame, TweenInfo.new(1.2), { BackgroundTransparency = 1 }):Play()
	end
end

-- 0(없음)~1(최대) 비네트 강도
function Fx.setVignette(alpha: number)
	for _, f in vignetteFrames do
		f.BackgroundTransparency = 1 - math.clamp(alpha, 0, 0.75)
	end
end

return Fx
