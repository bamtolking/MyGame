--!strict
-- 월드 연출(클라이언트 전용)
--  · 조명: 햇살(SunRays)·블룸·색보정·대기, 날씨별 조명/안개/입자, 유성우
--  · 하늘: 천천히 흘러가는 구름
--  · 포털 고리 조명이 차례로 반짝(마퀴 효과), 도로 화살표 흐름
--  · 기지 슬라임: 말랑 호흡, 눈 깜빡임, 가끔 콩 점프, 내 슬라임 위로 +$ 수입 표시, 무지개 색 순환
--  · 내 수금 발판은 돈이 쌓이면 두근두근, 방어막은 일렁임, 대폭주 중 화면 테두리 번쩍

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
local Calc = require(Shared.Logic.Calc)
local Format = require(Shared.Util.Format)

local Client = script.Parent.Parent
local Kit = require(Client.UI.Kit)
local State = require(Client.State)
local Fx = require(script.Parent.Fx)

local WorldFx = {}

local player = Players.LocalPlayer
local camera = Workspace.CurrentCamera
local worldState: Instance
local correction: ColorCorrectionEffect
local atmosphere: Atmosphere
local emitterPart: Part
local emitter: ParticleEmitter
local frenzyStroke: UIStroke
local frenzyFrame: Frame
local currentWeather = "?"
local popupFolder: Folder

local DEFAULT = {
	clockTime = 14.5,
	ambient = Color3.fromRGB(115, 115, 128),
	tint = Color3.fromRGB(255, 252, 245),
	fog = Color3.fromRGB(199, 220, 255),
}

type ParticleDef = {
	texture: string,
	speed: NumberRange,
	size: number,
	rate: number,
	lifetime: number,
	accel: Vector3,
	squash: number,
}

local PARTICLES: { [string]: ParticleDef } = {
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
	Kit.tween(correction, 3, { TintColor = tint, Saturation = if event then 0.2 else 0.12 })
	Kit.tween(atmosphere, 3, { Color = fog, Density = if event then 0.33 else 0.24, Haze = if event then 1.2 else 0.5 })

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

---------------------------------------------------------------------------
-- 기지(방어막·수금 발판)
---------------------------------------------------------------------------

local function plotsFolder(): Instance?
	local map = Workspace:FindFirstChild("Map")
	return map and map:FindFirstChild("Plots")
end

local function isProtected(plot: Instance, now: number): boolean
	local lockEnds = plot:GetAttribute("LockEnds")
	local shieldEnds = plot:GetAttribute("ShieldEnds")
	return (type(lockEnds) == "number" and lockEnds > now)
		or (type(shieldEnds) == "number" and shieldEnds > now)
		or plot:GetAttribute("Rookie") == true
end

-- 방어막: 보호 중이고 내가 주인이 아니면 로컬 충돌 켜기
local function updateBarriers()
	local plots = plotsFolder()
	if not plots then
		return
	end
	local now = Workspace:GetServerTimeNow()
	for _, plot in plots:GetChildren() do
		local barrier = plot:FindFirstChild("Barrier")
		if barrier and barrier:IsA("BasePart") then
			local owner = plot:GetAttribute("OwnerUserId")
			local protected = isProtected(plot, now)
			barrier.CanCollide = protected and owner ~= 0 and owner ~= player.UserId
			barrier:SetAttribute("ClientProtected", protected)
		end
	end
end

local function animatePlots(t: number)
	local plots = plotsFolder()
	if not plots then
		return
	end
	local view = State.view
	for _, plot in plots:GetChildren() do
		local barrier = plot:FindFirstChild("Barrier")
		if barrier and barrier:IsA("BasePart") and barrier:GetAttribute("ClientProtected") == true then
			barrier.Transparency = 0.3 + 0.15 * math.sin(t * 4)
		end
		if view and plot.Name == "Plot" .. view.plot then
			local plate = plot:FindFirstChild("CollectPlate")
			if plate and plate:IsA("BasePart") then
				if State.vault >= 1 then
					local k = 0.5 + 0.5 * math.sin(t * 6)
					plate.Color = Color3.fromRGB(70, 220, 110):Lerp(Color3.fromRGB(220, 255, 150), k)
				else
					plate.Color = Color3.fromRGB(70, 220, 110)
				end
			end
		end
	end
end

---------------------------------------------------------------------------
-- 도로 화살표 · 포털
---------------------------------------------------------------------------

type Arrow = { part: BasePart, base: CFrame }
local arrows: { Arrow } = {}
local roadEnd = World.road.endZ - 3
type Portal = { rings: { BasePart }, orbs: { BasePart }, orbBase: { CFrame } }
local portals: { Portal } = {}

local function collectMapParts()
	local map = Workspace:WaitForChild("Map", 30)
	if not map then
		return
	end
	local folder = map:WaitForChild("RoadArrows", 10)
	if folder then
		for _, p in folder:GetChildren() do
			if p:IsA("BasePart") then
				table.insert(arrows, { part = p, base = p.CFrame })
			end
		end
	end
	for _, m in map:GetChildren() do
		if m.Name == "Portal" then
			local portal: Portal = { rings = {}, orbs = {}, orbBase = {} }
			for _, p in m:GetChildren() do
				if p:IsA("BasePart") then
					if p.Name == "Ring" then
						table.insert(portal.rings, p)
					elseif p.Name == "PortalOrb" then
						table.insert(portal.orbs, p)
						table.insert(portal.orbBase, p.CFrame)
					end
				end
			end
			table.insert(portals, portal)
		end
	end
end

---------------------------------------------------------------------------
-- 구름
---------------------------------------------------------------------------

type Cloud = { model: Model, speed: number }
local clouds: { Cloud } = {}

local function makeClouds()
	local folder = Instance.new("Folder")
	folder.Name = "Clouds"
	folder.Parent = Workspace
	for i = 1, 14 do
		local model = Instance.new("Model")
		model.Name = "Cloud"
		local center = Vector3.new(math.random(-400, 400), 110 + math.random(0, 40), math.random(-400, 400))
		local puffs = math.random(3, 5)
		for k = 1, puffs do
			local p = Instance.new("Part")
			p.Shape = Enum.PartType.Ball
			local d = 14 + math.random() * 12
			p.Size = Vector3.new(d, d, d)
			p.CFrame = CFrame.new(center + Vector3.new((k - puffs / 2) * 9, math.random() * 4, math.random(-5, 5)))
			p.Color = Color3.fromRGB(255, 255, 255)
			p.Material = Enum.Material.SmoothPlastic
			p.Transparency = 0.08
			p.Anchored = true
			p.CanCollide = false
			p.CanQuery = false
			p.CanTouch = false
			p.CastShadow = false
			p.Parent = model
		end
		model.Parent = folder
		clouds[i] = { model = model, speed = 2 + math.random() * 3 }
	end
end

---------------------------------------------------------------------------
-- 기지 슬라임 생동감
---------------------------------------------------------------------------

type Eye = { mesh: SpecialMesh, base: Vector3 }
type Living = {
	model: Model,
	body: BasePart,
	mesh: SpecialMesh,
	origin: CFrame,
	phase: number,
	rainbow: boolean,
	eyes: { Eye },
	shines: { BasePart },
	nextBlink: number,
	nextHop: number,
	hopStart: number,
	nextPopup: number,
	mine: boolean,
	income: number,
}
local living: { [Model]: Living } = {}

local function track(inst: Instance)
	if inst.Parent == nil or not inst:IsA("Model") or living[inst] then
		return
	end
	local model = inst
	local body = model:FindFirstChild("Body")
	if not body or not body:IsA("BasePart") then
		return
	end
	local mesh = body:FindFirstChildOfClass("SpecialMesh")
	if not mesh then
		return
	end
	local eyes: { Eye } = {}
	local shines: { BasePart } = {}
	for _, p in model:GetChildren() do
		if p:IsA("BasePart") then
			if p.Name == "Eye" or p.Name == "EyeWhite" then
				local m = p:FindFirstChildOfClass("SpecialMesh")
				if m then
					table.insert(eyes, { mesh = m, base = m.Scale })
				end
			elseif p.Name == "EyeShine" or p.Name == "EyeShine2" then
				table.insert(shines, p)
			end
		end
	end
	local id, star, mut = model:GetAttribute("SpeciesId"), model:GetAttribute("Star"), model:GetAttribute("Mutation")
	local income = 0
	if type(id) == "string" and type(star) == "number" and type(mut) == "string" then
		income = Calc.slimeIncome({ id = id, star = star, mut = mut })
	end
	local now = os.clock()
	living[model] = {
		model = model,
		body = body,
		mesh = mesh,
		origin = model:GetPivot(),
		phase = math.random() * 6.28,
		rainbow = body:GetAttribute("Rainbow") == true,
		eyes = eyes,
		shines = shines,
		nextBlink = now + 1 + math.random() * 4,
		nextHop = now + 4 + math.random() * 8,
		hopStart = 0,
		nextPopup = now + 1 + math.random() * 4,
		mine = model:GetAttribute("OwnerUserId") == player.UserId,
		income = income,
	}
	model.AncestryChanged:Connect(function(_, parent)
		if not parent then
			living[model] = nil
		end
	end)
end

local function incomePopup(pos: Vector3, amount: number)
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.CanTouch = false
	anchor.Transparency = 1
	anchor.Size = Vector3.new(0.2, 0.2, 0.2)
	anchor.CFrame = CFrame.new(pos)
	anchor.Parent = popupFolder
	local gui = Kit.new("BillboardGui", {
		Size = UDim2.fromOffset(120, 34),
		AlwaysOnTop = false,
		LightInfluence = 0,
		MaxDistance = 70,
		Parent = anchor,
	}) :: BillboardGui
	local label = Kit.label({ Text = "+" .. Format.cash(amount), TextColor3 = Kit.colors.cash, stroke = 2.5, Parent = gui })
	Kit.tween(anchor, 1.2, { CFrame = CFrame.new(pos + Vector3.new(0, 4, 0)) }, Enum.EasingStyle.Quad)
	task.delay(0.7, function()
		Kit.tween(label, 0.45, { TextTransparency = 1 })
	end)
	task.delay(1.25, function()
		anchor:Destroy()
	end)
end

local POPUP_EVERY = 4

local function animateSlimes(t: number)
	local camPos = camera.CFrame.Position
	local view = State.view
	local mult = if view then view.multiplier else 1
	for model, s in living do
		if model.Parent == nil then
			living[model] = nil
			continue
		end
		local dist = (s.body.Position - camPos).Magnitude
		if dist > 140 then
			continue
		end
		-- 말랑 호흡
		local k = math.sin(t * 3 + s.phase) * 0.045
		local hopAge = t - s.hopStart
		if hopAge < 0.1 then
			k -= 0.12 -- 점프 직전 움츠림
		end
		s.mesh.Scale = Vector3.new(1 + k, 1 - k, 1 + k)
		if s.rainbow then
			s.body.Color = Color3.fromHSV((t * 0.25 + s.phase) % 1, 0.75, 1)
		end
		-- 눈 깜빡임
		if t >= s.nextBlink then
			s.nextBlink = t + 2 + math.random() * 4
			for _, eye in s.eyes do
				eye.mesh.Scale = Vector3.new(eye.base.X, 0.12, eye.base.Z)
			end
			for _, shine in s.shines do
				shine.LocalTransparencyModifier = 1
			end
			task.delay(0.12, function()
				for _, eye in s.eyes do
					eye.mesh.Scale = eye.base
				end
				for _, shine in s.shines do
					shine.LocalTransparencyModifier = 0
				end
			end)
		end
		-- 가끔 콩 점프(가까울 때만)
		if dist < 90 and t >= s.nextHop then
			s.nextHop = t + 6 + math.random() * 8
			s.hopStart = t
		end
		if hopAge < 0.55 then
			local h = if hopAge < 0.1 then 0 else math.sin((hopAge - 0.1) / 0.45 * math.pi) * 1.3
			model:PivotTo(s.origin + Vector3.new(0, h, 0))
		elseif hopAge < 0.7 then
			model:PivotTo(s.origin)
		end
		-- 내 슬라임 수입 표시
		if s.mine and dist < 60 and t >= s.nextPopup and s.income > 0 then
			s.nextPopup = t + POPUP_EVERY
			incomePopup(s.body.Position + Vector3.new(0, 3, 0), s.income * mult * POPUP_EVERY)
		end
	end
end

---------------------------------------------------------------------------

function WorldFx.init()
	worldState = ReplicatedStorage:WaitForChild("WorldState")
	correction = Instance.new("ColorCorrectionEffect")
	correction.Name = "SlimeHeistCC"
	correction.Saturation = 0.12
	correction.Contrast = 0.08
	correction.TintColor = DEFAULT.tint
	correction.Parent = Lighting
	atmosphere = Lighting:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atmosphere.Density = 0.24
	atmosphere.Haze = 0.5
	atmosphere.Glare = 0.2
	atmosphere.Color = DEFAULT.fog
	atmosphere.Decay = Color3.fromRGB(150, 170, 220)
	atmosphere.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.7
	bloom.Size = 32
	bloom.Threshold = 1.5
	bloom.Parent = Lighting
	local rays = Instance.new("SunRaysEffect")
	rays.Intensity = 0.06
	rays.Spread = 0.75
	rays.Parent = Lighting

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

	popupFolder = Instance.new("Folder")
	popupFolder.Name = "IncomePopups"
	popupFolder.Parent = Workspace

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
	frenzyStroke = Kit.stroke(frenzyFrame, 12, Kit.colors.pink)
	frenzyStroke.Transparency = 0.2

	makeClouds()
	task.spawn(collectMapParts)
	CollectionService:GetInstanceAddedSignal("BaseSlime"):Connect(function(m)
		task.defer(track, m)
	end)
	for _, m in CollectionService:GetTagged("BaseSlime") do
		track(m)
	end

	local acc = 0
	local meteorAcc = 0
	RunService.RenderStepped:Connect(function(dt)
		local t = os.clock()
		-- 입자는 카메라를 따라다님
		emitterPart.CFrame = CFrame.new(camera.CFrame.Position + Vector3.new(0, 45, 0))

		-- 도로 화살표 흐름(행진 방향 +Z). 간격(12)만큼 움직였다 되돌아가서 끊김 없이 흐름
		local shift = (t * Economy.parade.speed) % 12
		for _, a in arrows do
			a.part.CFrame = a.base + Vector3.new(0, 0, shift)
			a.part.Transparency = if a.base.Position.Z + shift > roadEnd then 1 else 0.35
		end

		-- 포털: 고리 조명이 차례로 반짝, 양옆 구슬은 둥실
		for _, portal in portals do
			for i, ring in portal.rings do
				ring.Transparency = 0.05 + 0.45 * (0.5 + 0.5 * math.sin(t * 5 - i * 0.55))
			end
			for i, orb in portal.orbs do
				orb.CFrame = portal.orbBase[i] + Vector3.new(0, math.sin(t * 2 + i) * 0.6, 0)
			end
		end

		-- 구름
		for _, c in clouds do
			local pivot = c.model:GetPivot()
			local x = pivot.Position.X + c.speed * dt
			if x > 450 then
				c.model:PivotTo(pivot - Vector3.new(900, 0, 0))
			else
				c.model:PivotTo(pivot + Vector3.new(c.speed * dt, 0, 0))
			end
		end

		animateSlimes(t)
		animatePlots(t)

		-- 대폭주 테두리: 색이 돌고 두근거림
		if frenzyFrame.Visible then
			frenzyStroke.Color = Color3.fromHSV((t * 0.3) % 1, 0.7, 1)
			frenzyStroke.Transparency = 0.15 + 0.25 * (0.5 + 0.5 * math.sin(t * 5))
		end

		acc += dt
		if acc >= 0.25 then
			acc = 0
			local weather = worldState:GetAttribute("Weather")
			applyWeather(if type(weather) == "string" then weather else "")
			frenzyFrame.Visible = worldState:GetAttribute("Frenzy") == true and not Fx.reduced
			updateBarriers()
		end
		if currentWeather == "meteor" and not Fx.reduced then
			meteorAcc += dt
			if meteorAcc > 0.8 then
				meteorAcc = 0
				meteor()
			end
		end
	end)
end

return WorldFx
