--!strict
-- 맵 전체를 코드로 생성합니다: 잔디·언덕, 행진 컨베이어, 포털, 분수 광장, 기지 8개,
-- 나무·소나무·덤불·꽃밭·벤치·가로등·울타리·경계벽.
-- 기지 파트 참조는 PlotService가 사용합니다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local World = require(Shared.Config.World)

local MapService = {}

export type PlotParts = {
	model: Model,
	floor: BasePart,
	pads: { BasePart },
	collect: BasePart,
	lock: BasePart,
	barrier: BasePart,
	signs: { TextLabel },
	vaultLabel: TextLabel,
	lockLabel: TextLabel,
	slimes: Folder,
}

MapService.plots = {} :: { [number]: PlotParts }
MapService.map = nil :: Model?

-- 기지별 바닥 색
local PLOT_COLORS = {
	Color3.fromRGB(255, 196, 214),
	Color3.fromRGB(190, 225, 255),
	Color3.fromRGB(200, 245, 200),
	Color3.fromRGB(255, 232, 170),
	Color3.fromRGB(225, 205, 255),
	Color3.fromRGB(180, 240, 235),
	Color3.fromRGB(255, 210, 180),
	Color3.fromRGB(230, 230, 240),
}

local function part(parent: Instance, name: string, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function decor(p: Part): Part
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	return p
end

local function surfaceText(
	parent: BasePart,
	face: Enum.NormalId,
	text: string,
	color: Color3,
	stroke: Color3?,
	pixelsPerStud: number?
): TextLabel
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = pixelsPerStud or 30
	gui.LightInfluence = 0
	gui.Parent = parent
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.Font = Enum.Font.FredokaOne
	label.TextColor3 = color
	label.Parent = gui
	local st = Instance.new("UIStroke")
	st.Color = stroke or Color3.fromRGB(40, 30, 60)
	st.Thickness = 3
	st.Parent = label
	return label
end

local function billboard(parent: BasePart, offset: Vector3, size: UDim2, maxDistance: number): (BillboardGui, TextLabel)
	local gui = Instance.new("BillboardGui")
	gui.Size = size
	gui.StudsOffset = offset
	gui.MaxDistance = maxDistance
	gui.AlwaysOnTop = false
	gui.LightInfluence = 0
	gui.Parent = parent
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextScaled = true
	label.Font = Enum.Font.FredokaOne
	label.TextColor3 = Color3.new(1, 1, 1)
	label.Text = ""
	label.Parent = gui
	local st = Instance.new("UIStroke")
	st.Color = Color3.fromRGB(30, 25, 45)
	st.Thickness = 2.5
	st.Parent = label
	return gui, label
end

local function tree(parent: Instance, pos: Vector3, scale: number)
	local trunkH = 7 * scale
	decor(part(parent, "Trunk", Vector3.new(trunkH, 1.6 * scale, 1.6 * scale), CFrame.new(pos + Vector3.new(0, trunkH / 2, 0)) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(125, 85, 55), Enum.Material.Wood)).Shape =
		Enum.PartType.Cylinder
	local leafColor = Color3.fromRGB(80 + math.random(0, 40), 180 + math.random(0, 40), 90)
	local top = pos + Vector3.new(0, trunkH, 0)
	local leaves = {
		{ offset = Vector3.new(0, 2.2, 0), size = 7.5 },
		{ offset = Vector3.new(2.2, 0.8, 0.8), size = 5 },
		{ offset = Vector3.new(-2, 1, -1), size = 5.5 },
		{ offset = Vector3.new(0.5, 4.3, 0.3), size = 4.5 },
	}
	for i, l in leaves do
		local ball = decor(part(parent, "Leaves" .. i, Vector3.one * l.size * scale, CFrame.new(top + l.offset * scale), leafColor, Enum.Material.Grass))
		ball.Shape = Enum.PartType.Ball
	end
end

local function lamp(parent: Instance, pos: Vector3)
	decor(part(parent, "Pole", Vector3.new(0.6, 10, 0.6), CFrame.new(pos + Vector3.new(0, 5, 0)), Color3.fromRGB(60, 60, 75), Enum.Material.Metal))
	local bulb = decor(part(parent, "Bulb", Vector3.new(1.6, 1.6, 1.6), CFrame.new(pos + Vector3.new(0, 10.5, 0)), Color3.fromRGB(255, 240, 190), Enum.Material.Neon))
	bulb.Shape = Enum.PartType.Ball
	local light = Instance.new("PointLight")
	light.Range = 18
	light.Brightness = 1.2
	light.Color = Color3.fromRGB(255, 225, 170)
	light.Parent = bulb
end

local function ball(parent: Instance, name: string, diameter: number, pos: Vector3, color: Color3, material: Enum.Material?): Part
	local p = decor(part(parent, name, Vector3.one * diameter, CFrame.new(pos), color, material))
	p.Shape = Enum.PartType.Ball
	return p
end

-- 원기둥(세로)
local function column(parent: Instance, name: string, height: number, diameter: number, pos: Vector3, color: Color3, material: Enum.Material?): Part
	local p = part(parent, name, Vector3.new(height, diameter, diameter), CFrame.new(pos) * CFrame.Angles(0, 0, math.rad(90)), color, material)
	p.Shape = Enum.PartType.Cylinder
	return p
end

local function pine(parent: Instance, pos: Vector3, scale: number)
	decor(column(parent, "PineTrunk", 4 * scale, 1.2 * scale, pos + Vector3.new(0, 2 * scale, 0), Color3.fromRGB(110, 75, 50), Enum.Material.Wood))
	local green = Color3.fromRGB(40 + math.random(0, 20), 130 + math.random(0, 30), 70)
	for k, layer in { { 3, 9 }, { 5.5, 7 }, { 8, 5 }, { 10.2, 3 } } do
		decor(column(parent, "PineLayer" .. k, 2.6 * scale, layer[2] * scale, pos + Vector3.new(0, layer[1] * scale, 0), green, Enum.Material.Grass))
	end
end

local function bush(parent: Instance, pos: Vector3, scale: number)
	local green = Color3.fromRGB(70 + math.random(0, 30), 170 + math.random(0, 30), 80)
	ball(parent, "Bush", 3.2 * scale, pos + Vector3.new(0, 1 * scale, 0), green, Enum.Material.Grass)
	ball(parent, "Bush", 2.4 * scale, pos + Vector3.new(1.5 * scale, 0.8 * scale, 0.3 * scale), green, Enum.Material.Grass)
	ball(parent, "Bush", 2.2 * scale, pos + Vector3.new(-1.3 * scale, 0.7 * scale, -0.4 * scale), green, Enum.Material.Grass)
end

local FLOWER_COLORS = {
	Color3.fromRGB(255, 110, 150),
	Color3.fromRGB(255, 220, 80),
	Color3.fromRGB(170, 120, 255),
	Color3.fromRGB(255, 255, 255),
	Color3.fromRGB(255, 150, 60),
}

local function flowerBed(parent: Instance, center: Vector3, width: number, depth: number)
	decor(part(parent, "Soil", Vector3.new(width, 0.6, depth), CFrame.new(center + Vector3.new(0, 0.3, 0)), Color3.fromRGB(120, 80, 55), Enum.Material.Ground))
	decor(part(parent, "BedEdge", Vector3.new(width + 1, 0.4, depth + 1), CFrame.new(center + Vector3.new(0, 0.2, 0)), Color3.fromRGB(200, 190, 175), Enum.Material.Brick))
	local n = math.floor(width * depth / 6)
	for _ = 1, n do
		local off = Vector3.new((math.random() - 0.5) * (width - 1), 0.9, (math.random() - 0.5) * (depth - 1))
		ball(parent, "Flower", 0.7 + math.random() * 0.4, center + off, FLOWER_COLORS[math.random(1, #FLOWER_COLORS)])
	end
end

local function bench(parent: Instance, cf: CFrame)
	local wood = Color3.fromRGB(170, 115, 70)
	local metal = Color3.fromRGB(60, 60, 75)
	decor(part(parent, "BenchSeat", Vector3.new(6, 0.4, 1.8), cf * CFrame.new(0, 1.6, 0), wood, Enum.Material.Wood))
	decor(part(parent, "BenchBack", Vector3.new(6, 1.6, 0.3), cf * CFrame.new(0, 2.7, 0.8) * CFrame.Angles(math.rad(-12), 0, 0), wood, Enum.Material.Wood))
	for _, x in { -2.6, 2.6 } do
		decor(part(parent, "BenchLeg", Vector3.new(0.3, 1.6, 1.6), cf * CFrame.new(x, 0.8, 0), metal, Enum.Material.Metal))
	end
end

local function fountain(parent: Instance, center: Vector3)
	local stone = Color3.fromRGB(215, 210, 225)
	local water = Color3.fromRGB(110, 200, 255)
	column(parent, "FountainRim", 1.6, 17, center + Vector3.new(0, 0.8, 0), stone, Enum.Material.Marble)
	local pool = decor(column(parent, "FountainWater", 0.3, 15.6, center + Vector3.new(0, 1.5, 0), water, Enum.Material.Glass))
	pool.Transparency = 0.25
	column(parent, "FountainPillar", 5, 2, center + Vector3.new(0, 3.5, 0), stone, Enum.Material.Marble)
	column(parent, "FountainBowl", 0.9, 7, center + Vector3.new(0, 6, 0), stone, Enum.Material.Marble)
	local top = decor(column(parent, "FountainTopWater", 0.3, 6.2, center + Vector3.new(0, 6.5, 0), water, Enum.Material.Glass))
	top.Transparency = 0.25
	local spout = ball(parent, "FountainSpout", 1.6, center + Vector3.new(0, 7.4, 0), Color3.fromRGB(180, 235, 255), Enum.Material.Neon)
	local spray = Instance.new("ParticleEmitter")
	spray.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	spray.Color = ColorSequence.new(Color3.fromRGB(190, 235, 255))
	spray.LightEmission = 0.6
	spray.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 0.2) })
	spray.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.2), NumberSequenceKeypoint.new(1, 1) })
	spray.Lifetime = NumberRange.new(1.1, 1.5)
	spray.Speed = NumberRange.new(12, 16)
	spray.SpreadAngle = Vector2.new(18, 18)
	spray.Acceleration = Vector3.new(0, -26, 0)
	spray.Rate = 60
	spray.EmissionDirection = Enum.NormalId.Top
	spray.Parent = spout
end

-- 멀리 보이는 언덕(큰 공을 땅에 반쯤 묻음)
local function hill(parent: Instance, pos: Vector3, diameter: number, color: Color3)
	local h = ball(parent, "Hill", diameter, pos, color, Enum.Material.Grass)
	h.CastShadow = false
end

-- 경계 울타리(기둥 + 가로대 2줄)
local function fence(parent: Instance, a: Vector3, b: Vector3)
	local white = Color3.fromRGB(250, 245, 235)
	local dir = b - a
	local length = dir.Magnitude
	local n = math.floor(length / 14)
	for k = 0, n do
		local pos = a + dir * (k / n)
		decor(part(parent, "FencePost", Vector3.new(0.8, 4, 0.8), CFrame.new(pos + Vector3.new(0, 2, 0)), white, Enum.Material.Wood))
	end
	local mid = (a + b) / 2
	local look = CFrame.lookAt(mid, mid + Vector3.new(dir.Unit.X, 0, dir.Unit.Z))
	for _, y in { 1.4, 3 } do
		decor(part(parent, "FenceRail", Vector3.new(0.3, 0.5, length), look + Vector3.new(0, y, 0), white, Enum.Material.Wood))
	end
end

-- 링 모양 포털(작은 네온 조각을 원형으로)
local function portal(parent: Instance, center: Vector3, color: Color3, label: string)
	local model = Instance.new("Model")
	model.Name = "Portal"
	model.Parent = parent
	local radius = 11
	for i = 1, 24 do
		local a = math.rad(i * 15)
		local p = Vector3.new(math.cos(a) * radius, math.sin(a) * radius, 0)
		if p.Y > -1 then
			local cf = CFrame.new(center + Vector3.new(p.X, p.Y + 1, 0)) * CFrame.Angles(0, 0, a)
			decor(part(model, "Ring", Vector3.new(1.4, 3.2, 1.4), cf, color, Enum.Material.Neon))
		end
	end
	local inner = decor(part(model, "Swirl", Vector3.new(19, 11, 0.3), CFrame.new(center + Vector3.new(0, 6, 0)), color, Enum.Material.ForceField))
	inner.Transparency = 0.2
	local signPart = decor(part(model, "Sign", Vector3.new(20, 4, 0.5), CFrame.new(center + Vector3.new(0, 14.5, 0)), Color3.fromRGB(40, 30, 70)))
	surfaceText(signPart, Enum.NormalId.Front, label, Color3.new(1, 1, 1))
	surfaceText(signPart, Enum.NormalId.Back, label, Color3.new(1, 1, 1))
	-- 받침대와 양옆 기둥
	for _, side in { -1, 1 } do
		decor(column(model, "PortalBase", 2.4, 5, center + Vector3.new(side * radius, 1.2, 0), Color3.fromRGB(70, 60, 110), Enum.Material.Slate))
		ball(model, "PortalOrb", 2.2, center + Vector3.new(side * radius, 3.4, 0), color, Enum.Material.Neon)
	end
	local glow = Instance.new("PointLight")
	glow.Color = color
	glow.Range = 26
	glow.Brightness = 2
	glow.Parent = inner
	-- 클라이언트가 고리를 돌릴 때 쓰는 중심점
	model:SetAttribute("Center", center + Vector3.new(0, 1, 0))
end

local function buildPlot(root: Instance, i: number): PlotParts
	local model = Instance.new("Model")
	model.Name = "Plot" .. i
	model:SetAttribute("PlotIndex", i)
	model:SetAttribute("OwnerUserId", 0)
	model.Parent = root

	local P = World.plot
	local W, D, H, T = P.width, P.depth, P.wallHeight, P.wallThickness
	local color = PLOT_COLORS[i] or Color3.new(1, 1, 1)
	local wallColor = color:Lerp(Color3.fromRGB(90, 80, 110), 0.35)

	local floor = part(model, "Floor", Vector3.new(W, 1, D), World.plotPoint(i, 0, 0.5, D / 2), color, Enum.Material.SmoothPlastic)
	-- 벽(좌·우·뒤)
	for _, side in { -1, 1 } do
		part(model, "Wall", Vector3.new(T, H, D), World.plotPoint(i, side * (W / 2 + T / 2), H / 2 + 1, D / 2), wallColor)
	end
	part(model, "BackWall", Vector3.new(W + T * 2, H, T), World.plotPoint(i, 0, H / 2 + 1, D + T / 2), wallColor)
	-- 입구 기둥 + 간판
	for _, side in { -1, 1 } do
		part(model, "Pillar", Vector3.new(3, H + 6, 3), World.plotPoint(i, side * (W / 2 + T / 2), (H + 6) / 2 + 1, 0), wallColor:Lerp(Color3.new(0, 0, 0), 0.2))
	end
	local signPart = part(model, "Sign", Vector3.new(W - 4, 5, 1), World.plotPoint(i, 0, H + 4.5, -0.5), Color3.fromRGB(45, 35, 75))
	-- 간판 파트는 기지 안쪽을 바라보므로 Back 면이 도로를 향함(양면 모두 글씨)
	local signs = {
		surfaceText(signPart, Enum.NormalId.Front, "EMPTY BASE", Color3.new(1, 1, 1), nil, 20),
		surfaceText(signPart, Enum.NormalId.Back, "EMPTY BASE", Color3.new(1, 1, 1), nil, 20),
	}

	-- 장식: 벽 윗단, 벽 기둥, 입구 조명·깃발, 뒷벽 슬라임 엠블럼, 발판 구역 카펫
	local bright = color:Lerp(Color3.new(1, 1, 1), 0.35)
	local deep = color:Lerp(Color3.fromRGB(60, 40, 90), 0.55)
	local decoFolder = Instance.new("Folder")
	decoFolder.Name = "Decor"
	decoFolder.Parent = model
	for _, side in { -1, 1 } do
		decor(part(decoFolder, "WallCap", Vector3.new(T + 1, 1, D + 1), World.plotPoint(i, side * (W / 2 + T / 2), H + 1.5, D / 2), bright))
		for k = 1, 3 do
			local d = k * D / 4
			decor(part(decoFolder, "WallRib", Vector3.new(0.6, H, 2), World.plotPoint(i, side * (W / 2 - 0.3), H / 2 + 1, d), deep))
		end
		-- 입구 기둥 위 조명 + 깃발
		local orb = ball(decoFolder, "PillarLamp", 3, World.plotPoint(i, side * (W / 2 + T / 2), H + 8.6, 0).Position, bright, Enum.Material.Neon)
		local light = Instance.new("PointLight")
		light.Color = bright
		light.Range = 20
		light.Brightness = 1.5
		light.Parent = orb
		decor(part(decoFolder, "FlagPole", Vector3.new(0.3, 7, 0.3), World.plotPoint(i, side * (W / 2 + T / 2), H + 13.5, 0), Color3.fromRGB(230, 230, 240), Enum.Material.Metal))
		decor(part(decoFolder, "Flag", Vector3.new(0.12, 2.4, 3.6), World.plotPoint(i, side * (W / 2 + T / 2), H + 15.6, 1.9), bright, Enum.Material.Fabric))
	end
	decor(part(decoFolder, "BackCap", Vector3.new(W + T * 2 + 1, 1, T + 1), World.plotPoint(i, 0, H + 1.5, D + T / 2), bright))
	-- 뒷벽 엠블럼(기지 색 슬라임 얼굴). 기지 좌표계의 +Z가 입구 쪽이라 얼굴 부품은 +Z로 내밈
	local emblemCf = World.plotPoint(i, 0, 10, D - 0.2)
	local face = decor(part(decoFolder, "EmblemBody", Vector3.new(16, 11, 1), emblemCf, bright))
	local faceMesh = Instance.new("SpecialMesh")
	faceMesh.MeshType = Enum.MeshType.Sphere
	faceMesh.Parent = face
	for _, sx in { -1, 1 } do
		local eye = decor(part(decoFolder, "EmblemEye", Vector3.new(1.6, 2.4, 0.6), emblemCf * CFrame.new(sx * 2.6, 1, 0.5), Color3.fromRGB(35, 30, 45)))
		local em = Instance.new("SpecialMesh")
		em.MeshType = Enum.MeshType.Sphere
		em.Parent = eye
		ball(decoFolder, "EmblemShine", 0.7, (emblemCf * CFrame.new(sx * 2.6 - 0.3, 1.6, 0.9)).Position, Color3.new(1, 1, 1))
	end
	local smile = decor(part(decoFolder, "EmblemMouth", Vector3.new(3, 1, 0.6), emblemCf * CFrame.new(0, -1.8, 0.5), Color3.fromRGB(35, 30, 45)))
	local sm = Instance.new("SpecialMesh")
	sm.MeshType = Enum.MeshType.Sphere
	sm.Parent = smile
	-- 발판 구역 카펫
	decor(part(decoFolder, "Carpet", Vector3.new(W - 4, 0.08, D - 22), World.plotPoint(i, 0, World.floorTop + 0.04, 17 + (D - 22) / 2), color:Lerp(Color3.new(1, 1, 1), 0.3)))

	-- 발판(+ 테두리)
	local pads: { BasePart } = {}
	for p = 1, World.pads.cols * World.pads.rows do
		local x, d = World.padLocal(p)
		decor(part(decoFolder, "PadRim", Vector3.new(World.pads.size + 1, 0.3, World.pads.size + 1), World.plotPoint(i, x, World.floorTop + 0.15, d), deep))
		local pad = part(model, "Pad" .. p, Vector3.new(World.pads.size, 0.4, World.pads.size), World.plotPoint(i, x, World.floorTop + 0.2, d), Color3.fromRGB(255, 255, 255), Enum.Material.SmoothPlastic)
		pad:SetAttribute("Pad", p)
		pads[p] = pad
	end

	-- 수금 발판 / 잠금 발판
	local F = World.front
	local collect = part(model, "CollectPlate", Vector3.new(F.plateSize, 0.5, F.plateSize), World.plotPoint(i, F.collect.x, World.floorTop + 0.25, F.collect.d), Color3.fromRGB(70, 220, 110), Enum.Material.Neon)
	local lock = part(model, "LockPlate", Vector3.new(F.plateSize, 0.5, F.plateSize), World.plotPoint(i, F.lock.x, World.floorTop + 0.25, F.lock.d), Color3.fromRGB(255, 80, 90), Enum.Material.Neon)
	local _, vaultLabel = billboard(collect, Vector3.new(0, 4, 0), UDim2.fromScale(10, 2.4), 90)
	local _, lockLabel = billboard(lock, Vector3.new(0, 4, 0), UDim2.fromScale(10, 2.4), 90)
	vaultLabel.TextColor3 = Color3.fromRGB(140, 255, 150)
	lockLabel.TextColor3 = Color3.fromRGB(255, 170, 170)
	vaultLabel.Text = "$0"
	lockLabel.Text = "LOCK"
	-- 발판 윗면 아이콘(기지 좌표계에서 윗면 글자가 입구 쪽을 향하도록 Top 면 사용)
	surfaceText(collect, Enum.NormalId.Top, "💰", Color3.new(1, 1, 1), Color3.fromRGB(20, 90, 40), 25)
	surfaceText(lock, Enum.NormalId.Top, "🔒", Color3.new(1, 1, 1), Color3.fromRGB(110, 20, 30), 25)
	for _, plate in { collect, lock } do
		decor(part(decoFolder, "PlateRim", Vector3.new(F.plateSize + 1.2, 0.35, F.plateSize + 1.2), plate.CFrame - Vector3.new(0, 0.1, 0), Color3.fromRGB(245, 245, 250), Enum.Material.Metal))
	end

	-- 방어막(잠금 시 보임). 충돌은 각 클라이언트가 주인 여부에 따라 로컬로 켭니다.
	local barrier = part(model, "Barrier", Vector3.new(W, H + 1, 0.6), World.plotPoint(i, 0, (H + 1) / 2 + 1, 0.3), Color3.fromRGB(255, 70, 90), Enum.Material.ForceField)
	barrier.Transparency = 1
	barrier.CanCollide = false
	barrier.CanQuery = false
	barrier.CanTouch = false
	barrier.CastShadow = false

	local slimes = Instance.new("Folder")
	slimes.Name = "Slimes"
	slimes.Parent = model

	return {
		model = model,
		floor = floor,
		pads = pads,
		collect = collect,
		lock = lock,
		barrier = barrier,
		signs = signs,
		vaultLabel = vaultLabel,
		lockLabel = lockLabel,
		slimes = slimes,
	}
end

function MapService.init()
	-- Studio 편집 화면용으로 구워 둔 미리보기 맵은 지우고 코드로 새로 만듭니다
	local preview = Workspace:FindFirstChild("Map")
	if preview then
		preview:Destroy()
	end
	local map = Instance.new("Model")
	map.Name = "Map"

	local B = World.bounds
	local sizeX, sizeZ = B.maxX - B.minX, B.maxZ - B.minZ
	local cx, cz = (B.minX + B.maxX) / 2, (B.minZ + B.maxZ) / 2

	-- 바닥
	part(map, "Ground", Vector3.new(sizeX + 400, 2, sizeZ + 400), CFrame.new(cx, -1, cz), Color3.fromRGB(110, 200, 95), Enum.Material.Grass)
	-- 경계벽(보이지 않음)
	local wallH = 60
	for _, w in {
		{ size = Vector3.new(2, wallH, sizeZ), pos = Vector3.new(B.minX - 1, wallH / 2, cz) },
		{ size = Vector3.new(2, wallH, sizeZ), pos = Vector3.new(B.maxX + 1, wallH / 2, cz) },
		{ size = Vector3.new(sizeX, wallH, 2), pos = Vector3.new(cx, wallH / 2, B.minZ - 1) },
		{ size = Vector3.new(sizeX, wallH, 2), pos = Vector3.new(cx, wallH / 2, B.maxZ + 1) },
	} do
		local p = part(map, "Boundary", w.size, CFrame.new(w.pos), Color3.new(1, 1, 1))
		p.Transparency = 1
		p.CastShadow = false
	end

	-- 행진 도로
	local R = World.road
	local roadLen = R.endZ - R.startZ
	part(map, "Road", Vector3.new(R.halfWidth * 2, 0.4, roadLen), CFrame.new(0, R.top - 0.2, (R.startZ + R.endZ) / 2), Color3.fromRGB(80, 70, 110), Enum.Material.SmoothPlastic)
	for _, side in { -1, 1 } do
		part(map, "Curb", Vector3.new(1.2, 0.8, roadLen), CFrame.new(side * (R.halfWidth + 0.6), 0.4, (R.startZ + R.endZ) / 2), Color3.fromRGB(255, 220, 90), Enum.Material.SmoothPlastic)
	end
	-- 컨베이어 레일(금속 + 네온 줄)과 벨트 이음매
	for _, side in { -1, 1 } do
		decor(part(map, "Rail", Vector3.new(0.8, 1.1, roadLen), CFrame.new(side * (R.halfWidth - 0.5), R.top + 0.55, (R.startZ + R.endZ) / 2), Color3.fromRGB(150, 155, 175), Enum.Material.Metal))
		decor(part(map, "RailGlow", Vector3.new(0.35, 0.2, roadLen), CFrame.new(side * (R.halfWidth - 0.5), R.top + 1.2, (R.startZ + R.endZ) / 2), Color3.fromRGB(120, 230, 255), Enum.Material.Neon))
	end
	local seam = R.startZ + 4
	while seam < R.endZ do
		decor(part(map, "BeltSeam", Vector3.new(R.halfWidth * 2 - 2, 0.05, 0.5), CFrame.new(0, R.top + 0.02, seam), Color3.fromRGB(65, 55, 92)))
		seam += 8
	end

	-- 도로 화살표(클라이언트가 흐르게 움직임)
	local arrows = Instance.new("Folder")
	arrows.Name = "RoadArrows"
	arrows.Parent = map
	local step = 12
	local z = R.startZ + 6
	while z < R.endZ - 4 do
		for _, side in { -1, 1 } do
			local arm = decor(part(arrows, "Arrow", Vector3.new(0.9, 0.12, 4.2), CFrame.new(side * 1.3, R.top + 0.03, z) * CFrame.Angles(0, math.rad(-side * 40), 0), Color3.fromRGB(150, 130, 255), Enum.Material.Neon))
			arm.Transparency = 0.35
		end
		z += step
	end

	-- 인도(도로와 기지 사이)
	for _, side in { -1, 1 } do
		part(map, "Walkway", Vector3.new(World.plot.frontX - R.halfWidth - 1.2, 0.2, roadLen), CFrame.new(side * (R.halfWidth + 1.2 + (World.plot.frontX - R.halfWidth - 1.2) / 2), 0.1, (R.startZ + R.endZ) / 2), Color3.fromRGB(235, 225, 205), Enum.Material.Pavement)
	end

	-- 포털
	portal(map, Vector3.new(0, 0, World.parade.startZ - 2), Color3.fromRGB(120, 255, 170), "SLIME PARADE")
	portal(map, Vector3.new(0, 0, World.parade.endZ + 2), Color3.fromRGB(255, 120, 200), "BYE BYE!")

	-- 광장
	local plaza = part(map, "Plaza", Vector3.new(150, 0.3, 60), CFrame.new(0, 0.15, World.plaza.centerZ), Color3.fromRGB(245, 235, 215), Enum.Material.Pavement)
	plaza.Name = "Plaza"
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "PlazaSpawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(10, 0.4, 10)
	spawn.CFrame = CFrame.new(World.plaza.spawn)
	spawn.Color = Color3.fromRGB(120, 255, 170)
	spawn.Material = Enum.Material.Neon
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Transparency = 0.3
	spawn.Parent = map
	local title = part(map, "TitleSign", Vector3.new(60, 14, 2), CFrame.new(0, 12, World.plaza.centerZ - 26), Color3.fromRGB(60, 40, 110))
	surfaceText(title, Enum.NormalId.Back, "SLIME HEIST!", Color3.fromRGB(255, 230, 90), Color3.fromRGB(120, 40, 160), 12)
	surfaceText(title, Enum.NormalId.Front, "SLIME HEIST!", Color3.fromRGB(255, 230, 90), Color3.fromRGB(120, 40, 160), 12)
	for _, side in { -1, 1 } do
		part(map, "TitlePost", Vector3.new(2, 20, 2), CFrame.new(side * 31, 10, World.plaza.centerZ - 26), Color3.fromRGB(90, 70, 140))
		ball(map, "TitleOrb", 3, Vector3.new(side * 31, 21, World.plaza.centerZ - 26), Color3.fromRGB(255, 220, 90), Enum.Material.Neon)
	end
	local plazaDeco = Instance.new("Folder")
	plazaDeco.Name = "PlazaDecor"
	plazaDeco.Parent = map
	fountain(plazaDeco, Vector3.new(0, 0.3, World.plaza.centerZ - 11))
	for _, side in { -1, 1 } do
		flowerBed(plazaDeco, Vector3.new(side * 24, 0.3, World.plaza.centerZ - 11), 10, 5)
		flowerBed(plazaDeco, Vector3.new(side * 66, 0.3, World.plaza.centerZ + 18), 12, 5)
		bench(plazaDeco, CFrame.new(side * 22, 0.3, World.plaza.centerZ + 6) * CFrame.Angles(0, math.pi, 0))
		bench(plazaDeco, CFrame.new(side * 40, 0.3, World.plaza.centerZ - 20))
	end

	-- 순위표 자리(LeaderboardService가 채움)
	local boards = Instance.new("Folder")
	boards.Name = "Leaderboards"
	boards.Parent = map
	for bi, x in { -55, 55, 0 } do
		local z0 = if bi == 3 then World.parade.endZ + 22 else World.plaza.centerZ - 8
		local face = if bi == 3 then math.pi else 0
		local board = part(boards, "Board" .. bi, Vector3.new(20, 26, 1.5), CFrame.new(x, 14, z0) * CFrame.Angles(0, face, 0), Color3.fromRGB(40, 30, 70))
		board:SetAttribute("BoardIndex", bi)
		for _, sx in { -1, 1 } do
			part(boards, "BoardPost", Vector3.new(1.5, 28, 1.5), CFrame.new(x, 14, z0) * CFrame.Angles(0, face, 0) * CFrame.new(sx * 10.5, 0, 0), Color3.fromRGB(90, 70, 140))
		end
	end

	-- 나무(둥근 나무와 소나무를 섞어서)·덤불·언덕·울타리·가로등
	math.randomseed(12345)
	local nature = Instance.new("Folder")
	nature.Name = "Nature"
	nature.Parent = map
	for zz = -230, 190, 26 do
		for k, xx in { -150, -128, 128, 150 } do
			local pos = Vector3.new(xx + math.random(-4, 4), 0, zz + math.random(-6, 6))
			if (k + zz // 26) % 3 == 0 then
				pine(nature, pos, 1 + math.random() * 0.4)
			else
				tree(nature, pos, 0.9 + math.random() * 0.4)
			end
		end
	end
	for zz = -140, 140, 16 do
		for _, xx in { -114, 114 } do
			bush(nature, Vector3.new(xx + math.random(-2, 2), 0, zz + math.random(-3, 3)), 0.9 + math.random() * 0.3)
		end
	end
	local hillColors = { Color3.fromRGB(95, 185, 90), Color3.fromRGB(120, 200, 100), Color3.fromRGB(80, 165, 85) }
	for k, h in {
		{ -250, -180, 150 },
		{ -260, -40, 190 },
		{ -245, 110, 160 },
		{ 250, -160, 170 },
		{ 262, 0, 150 },
		{ 250, 140, 190 },
		{ -120, 300, 180 },
		{ 60, 310, 210 },
		{ -80, -330, 170 },
		{ 110, -320, 150 },
	} do
		hill(nature, Vector3.new(h[1], -h[3] * 0.32, h[2]), h[3], hillColors[k % #hillColors + 1])
	end
	local fenceInset = 3
	local corners = {
		Vector3.new(B.minX + fenceInset, 0, B.minZ + fenceInset),
		Vector3.new(B.maxX - fenceInset, 0, B.minZ + fenceInset),
		Vector3.new(B.maxX - fenceInset, 0, B.maxZ - fenceInset),
		Vector3.new(B.minX + fenceInset, 0, B.maxZ - fenceInset),
	}
	for k = 1, 4 do
		fence(nature, corners[k], corners[k % 4 + 1])
	end
	for _, xx in { -64, -38, 38, 64 } do
		tree(nature, Vector3.new(xx, 0, World.plaza.centerZ + math.random(-8, 8)), 1)
	end
	for zz = World.road.startZ + 20, World.road.endZ - 10, 38 do
		lamp(map, Vector3.new(-(World.road.halfWidth + 3), 0.2, zz))
		lamp(map, Vector3.new(World.road.halfWidth + 3, 0.2, zz))
	end

	-- 기지
	local plotsFolder = Instance.new("Folder")
	plotsFolder.Name = "Plots"
	plotsFolder.Parent = map
	for i = 1, World.plot.count do
		MapService.plots[i] = buildPlot(plotsFolder, i)
	end

	map.Parent = Workspace
	MapService.map = map
end

function MapService.start() end

return MapService
