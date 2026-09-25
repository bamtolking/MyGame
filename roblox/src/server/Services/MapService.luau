--!strict
-- 맵 전체를 코드로 생성합니다: 잔디, 행진 도로, 포털, 광장, 기지 8개, 나무·가로등·경계벽.
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

	-- 발판
	local pads: { BasePart } = {}
	for p = 1, World.pads.cols * World.pads.rows do
		local x, d = World.padLocal(p)
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
	part(map, "Ground", Vector3.new(sizeX + 40, 2, sizeZ + 40), CFrame.new(cx, -1, cz), Color3.fromRGB(110, 200, 95), Enum.Material.Grass)
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

	-- 나무·가로등
	math.randomseed(12345)
	for zz = -230, 190, 26 do
		for _, xx in { -150, -128, 128, 150 } do
			tree(map, Vector3.new(xx + math.random(-4, 4), 0, zz + math.random(-6, 6)), 0.9 + math.random() * 0.4)
		end
	end
	for _, xx in { -64, -38, 38, 64 } do
		tree(map, Vector3.new(xx, 0, World.plaza.centerZ + math.random(-8, 8)), 1)
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
