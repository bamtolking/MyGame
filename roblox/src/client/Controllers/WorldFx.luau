--!strict
-- 월드 연출(클라이언트 전용): 날씨 조명·입자·유성, 대폭주 테두리, 도로 화살표 흐름,
-- 무지개 슬라임 색 순환, 슬라임 말랑 호흡, 방어막 충돌(주인은 통과).

local CollectionService = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Weather = require(Shared.Config.Weather)
local World = require(Shared.Config.World)
local Economy = require(Shared.Config.Economy)

local Client = script.Parent.Parent
local Kit = require(Client.UI.Kit)

local WorldFx = {}

local player = Players.LocalPlayer
local camera = Workspace.CurrentCamera
local worldState: Instance
local correction: ColorCorrectionEffect
local atmosphere: Atmosphere
local emitterPart: Part
local emitter: ParticleEmitter
local frenzyFrame: Frame
local currentWeather = "?"

local DEFAULT = {
	clockTime = 14.5,
	ambient = Color3.fromRGB(115, 115, 128),
	tint = Color3.fromRGB(255, 255, 255),
	fog = Color3.fromRGB(199, 220, 255),
}

local PARTICLES: { [string]: { texture: string, speed: NumberRange, size: number, rate: number, lifetime: number, accel: Vector3, squash: number } } = {
	rain = { texture = "rbxasset://textures/particles/sparkles_main.dds", speed = NumberRange.new(70, 90), size = 0.35, rate = 260, lifetime = 1.2, accel = Vector3.new(0, -40, 0), squash = 3 },
	snow = { texture = "rbxasset://textures/particles/sparkles_main.dds", speed = NumberRange.new(6, 12), size = 0.6, rate = 120, lifetime = 5, accel = Vector3.new(0, -2, 0), squash = 0 },
	sparkle = { texture = "rbxasset://textures/particles/sparkles_main.dds", speed = NumberRange.new(4, 10), size = 0.8, rate = 70, lifetime = 4, accel = Vector3.new(0, -1, 0), squash = 0 },
	ember = { texture = "rbxasset://textures/particles/fire_main.dds", speed = NumberRange.new(8, 16), size = 0.7, rate = 90, lifetime = 3, accel = Vector3.new(0, 6, 0), squash = 0 },
	stars = { texture = "rbxasset://textures/particles/sparkles_main.dds", speed = NumberRange.new(2, 6), size = 0.9, rate = 60, lifetime = 5, accel = Vector3.new(0, -1, 0), squash = 0 },
	candy = { texture = "rbxasset://textures/particles/sparkles_main.dds", speed = NumberRange.new(5, 12), size = 1.0, rate = 80, lifetime = 4, accel = Vector3.new(0, -4, 0), squash = 0 },
}

local function applyWeather(id: string)
	if id == currentWeather then
		return
	end
	currentWeather = id
	local event = Weather.byId[id]
	local clockTime = if event then event.clockTime else DEFAULT.clockTime
	local ambient = if event then event.ambient else DEFAULT.ambient
	local tint = if event then event.tint else DEFAULT.tint
	local fog = if event then event.fog else DEFAULT.fog
	Kit.tween(Lighting, 3, { ClockTime = clockTime, Ambient = ambient, OutdoorAmbient = ambient:Lerp(Color3.new(1, 1, 1), 0.25) })
	Kit.tween(correction, 3, { TintColor = tint, Saturation = if event then 0.15 else 0.05 })
	Kit.tween(atmosphere, 3, { Color = fog, Density = if event then 0.33 else 0.25, Haze = if event then 1.2 else 0.6 })

	if event then
		local def = PARTICLES[event.particle] or PARTICLES.sparkle
		emitter.Texture = def.texture
		emitter.Color = ColorSequence.new(event.particleColor)
		emitter.Speed = def.speed
		emitter.Size = NumberSequence.new(def.size)
		emitter.Rate = def.rate
		emitter.Lifetime = NumberRange.new(def.lifetime)
		emitter.Acceleration = def.accel
		emitter.Squash = NumberSequence.new(def.squash)
		emitter.Enabled = true
	else
		emitter.Enabled = false
	end
end

local function meteor()
	local start = camera.CFrame.Position + Vector3.new(math.random(-120, 120), 140, math.random(-120, 120))
	local finish = start + Vector3.new(math.random(-60, 60), -150, math.random(-60, 60))
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Ball
	p.Size = Vector3.new(2.5, 2.5, 2.5)
	p.Material = Enum.Material.Neon
	p.Color = Color3.fromRGB(200, 170, 255)
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CFrame = CFrame.new(start)
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, 1, 0)
	a0.Parent = p
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -1, 0)
	a1.Parent = p
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Lifetime = 0.6
	trail.LightEmission = 1
	trail.Color = ColorSequence.new(Color3.fromRGB(230, 210, 255), Color3.fromRGB(120, 80, 255))
	trail.Transparency = NumberSequence.new(0, 1)
	trail.Parent = p
	p.Parent = Workspace
	Kit.tween(p, 1.4, { CFrame = CFrame.new(finish) }, Enum.EasingStyle.Linear)
	task.delay(2, function()
		p:Destroy()
	end)
end

-- 방어막: 보호 중이고 내가 주인이 아니면 로컬 충돌 켜기
local function updateBarriers()
	local map = Workspace:FindFirstChild("Map")
	local plots = map and map:FindFirstChild("Plots")
	if not plots then
		return
	end
	local now = Workspace:GetServerTimeNow()
	for _, plot in plots:GetChildren() do
		local barrier = plot:FindFirstChild("Barrier")
		if barrier and barrier:IsA("BasePart") then
			local lockEnds = plot:GetAttribute("LockEnds")
			local shieldEnds = plot:GetAttribute("ShieldEnds")
			local protected = (type(lockEnds) == "number" and lockEnds > now)
				or (type(shieldEnds) == "number" and shieldEnds > now)
				or plot:GetAttribute("Rookie") == true
			local owner = plot:GetAttribute("OwnerUserId")
			barrier.CanCollide = protected and owner ~= 0 and owner ~= player.UserId
		end
	end
end

type Arrow = { part: BasePart, base: CFrame }
local arrows: { Arrow } = {}
local roadEnd = World.road.endZ - 3

local function collectArrows()
	local map = Workspace:WaitForChild("Map", 30)
	local folder = map and map:WaitForChild("RoadArrows", 10)
	if not folder then
		return
	end
	for _, p in folder:GetChildren() do
		if p:IsA("BasePart") then
			table.insert(arrows, { part = p, base = p.CFrame })
		end
	end
end

-- 슬라임 몸의 말랑 호흡 + 무지개
type Squish = { mesh: SpecialMesh, body: BasePart, phase: number, rainbow: boolean }
local squishes: { [BasePart]: Squish } = {}

local function trackModel(model: Instance)
	local body = model:FindFirstChild("Body")
	if not body or not body:IsA("BasePart") then
		return
	end
	local mesh = body:FindFirstChildOfClass("SpecialMesh")
	if not mesh then
		return
	end
	squishes[body] = { mesh = mesh, body = body, phase = math.random() * 6.28, rainbow = body:GetAttribute("Rainbow") == true }
	body.AncestryChanged:Connect(function(_, parent)
		if not parent then
			squishes[body] = nil
		end
	end)
end

function WorldFx.init()
	worldState = ReplicatedStorage:WaitForChild("WorldState")
	correction = Instance.new("ColorCorrectionEffect")
	correction.Name = "SlimeHeistCC"
	correction.Saturation = 0.05
	correction.Parent = Lighting
	atmosphere = Lighting:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atmosphere.Density = 0.25
	atmosphere.Haze = 0.6
	atmosphere.Color = DEFAULT.fog
	atmosphere.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.6
	bloom.Size = 30
	bloom.Threshold = 1.6
	bloom.Parent = Lighting

	emitterPart = Instance.new("Part")
	emitterPart.Name = "WeatherEmitter"
	emitterPart.Anchored = true
	emitterPart.CanCollide = false
	emitterPart.CanQuery = false
	emitterPart.CanTouch = false
	emitterPart.Transparency = 1
	emitterPart.Size = Vector3.new(160, 1, 160)
	emitterPart.Parent = Workspace
	emitter = Instance.new("ParticleEmitter")
	emitter.EmissionDirection = Enum.NormalId.Bottom
	emitter.LightEmission = 0.8
	emitter.Enabled = false
	emitter.Parent = emitterPart

	local overlay = Kit.new("ScreenGui", {
		Name = "FrenzyOverlay",
		ResetOnSpawn = false,
		IgnoreGuiInset = true,
		DisplayOrder = 1,
		Parent = player:WaitForChild("PlayerGui"),
	}) :: ScreenGui
	frenzyFrame = Kit.new("Frame", {
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		Visible = false,
		Parent = overlay,
	}) :: Frame
	local frenzyStroke = Kit.stroke(frenzyFrame, 10, Kit.colors.pink)
	frenzyStroke.Transparency = 0.2

	task.spawn(collectArrows)
	CollectionService:GetInstanceAddedSignal("BaseSlime"):Connect(function(m)
		task.defer(trackModel, m)
	end)
	for _, m in CollectionService:GetTagged("BaseSlime") do
		trackModel(m)
	end
	local paradeFolder = Workspace:WaitForChild("ParadeClient", 10)
	if paradeFolder then
		paradeFolder.ChildAdded:Connect(function(m)
			task.defer(trackModel, m)
		end)
	end

	local acc = 0
	local meteorAcc = 0
	RunService.RenderStepped:Connect(function(dt)
		local t = os.clock()
		-- 입자는 카메라를 따라다님
		emitterPart.CFrame = CFrame.new(camera.CFrame.Position + Vector3.new(0, 45, 0))

		-- 도로 화살표 흐름(행진 방향 +Z)
		-- 화살표 간격(12)만큼 움직였다 되돌아가므로 무늬가 끊김 없이 흐름
		local shift = (t * Economy.parade.speed) % 12
		for _, a in arrows do
			a.part.CFrame = a.base + Vector3.new(0, 0, shift)
			a.part.Transparency = if a.base.Position.Z + shift > roadEnd then 1 else 0.35
		end

		-- 말랑 호흡 · 무지개(카메라 근처만)
		local camPos = camera.CFrame.Position
		for body, s in squishes do
			if (body.Position - camPos).Magnitude < 140 then
				local k = math.sin(t * 3 + s.phase) * 0.045
				s.mesh.Scale = Vector3.new(1 + k, 1 - k, 1 + k)
				if s.rainbow then
					body.Color = Color3.fromHSV((t * 0.25 + s.phase) % 1, 0.75, 1)
				end
			end
		end

		acc += dt
		if acc >= 0.25 then
			acc = 0
			local weather = worldState:GetAttribute("Weather")
			applyWeather(if type(weather) == "string" then weather else "")
			frenzyFrame.Visible = worldState:GetAttribute("Frenzy") == true
			updateBarriers()
		end
		if currentWeather == "meteor" then
			meteorAcc += dt
			if meteorAcc > 0.8 then
				meteorAcc = 0
				meteor()
			end
		end
	end)
end

return WorldFx
