--!nonstrict
-- 휴게소 지도를 파츠로 조립합니다 (외부 에셋 없음).
-- 좌표: 주방은 Z<0, 손님 구역은 Z>0. 카운터가 Z≈-1 에서 둘을 가릅니다. 저승 문은 Z=+64.
local Lighting = game:GetService("Lighting")
local PhysicsService = game:GetService("PhysicsService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Recipes = require(ReplicatedStorage.GhostDiner.Recipes)
local Config = require(ReplicatedStorage.GhostDiner.Config)

local MapBuilder = {}

export type StationSpec = {
	kind: string,
	id: string,
	index: number,
	part: BasePart,
	crateItem: string?,
	locked: boolean,
	displayOffset: Vector3,
	baseCFrame: CFrame,
	label: string,
}

export type MapInfo = {
	root: Model,
	stationsFolder: Folder,
	customersFolder: Folder,
	stations: { StationSpec },
	slots: { Vector3 },
	queue: { Vector3 },
	spawnPoint: Vector3,
	exitPoint: Vector3,
	lanterns: { PointLight },
}

local function part(props: { [string]: any }): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in props do
		(p :: any)[k] = v
	end
	return p
end

local function setupCollisionGroups()
	for _, name in { "Customers", "Players", "Furniture" } do
		pcall(function()
			PhysicsService:RegisterCollisionGroup(name)
		end)
	end
	pcall(function()
		PhysicsService:CollisionGroupSetCollidable("Customers", "Players", false)
		PhysicsService:CollisionGroupSetCollidable("Customers", "Furniture", false)
		PhysicsService:CollisionGroupSetCollidable("Customers", "Customers", false)
	end)
end

local NIGHT = {
	ClockTime = 0.5,
	Brightness = 1.2,
	Ambient = Color3.fromRGB(70, 62, 95),
	OutdoorAmbient = Color3.fromRGB(80, 78, 120),
	FogColor = Color3.fromRGB(28, 22, 48),
	FogEnd = 320,
	ExposureCompensation = 0.15,
}
local DAY = {
	ClockTime = 13,
	Brightness = 2,
	Ambient = Color3.fromRGB(150, 150, 150),
	OutdoorAmbient = Color3.fromRGB(165, 165, 175),
	FogColor = Color3.fromRGB(190, 190, 210),
	FogEnd = 700,
	ExposureCompensation = 0,
}

local atmosphere: Atmosphere? = nil
local lanternLights: { PointLight } = {}

local function setupLighting()
	for k, v in NIGHT do
		(Lighting :: any)[k] = v
	end
	Lighting.GlobalShadows = true
	local existing = Lighting:FindFirstChildOfClass("Atmosphere")
	if existing then
		existing:Destroy()
	end
	local atm = Instance.new("Atmosphere")
	atm.Density = 0.32
	atm.Offset = 0.25
	atm.Color = Color3.fromRGB(120, 110, 165)
	atm.Decay = Color3.fromRGB(45, 38, 80)
	atm.Glare = 0.15
	atm.Haze = 1.6
	atm.Parent = Lighting
	atmosphere = atm
end

function MapBuilder.setNight(isNight: boolean)
	local target = if isNight then NIGHT else DAY
	local info = TweenInfo.new(4, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)
	TweenService:Create(Lighting, info, target):Play()
	if atmosphere then
		TweenService:Create(atmosphere, info, { Density = if isNight then 0.32 else 0.18 }):Play()
	end
	for _, light in lanternLights do
		light.Enabled = isNight
	end
end

local function makeLantern(parent: Instance, x: number, z: number)
	part({ Name = "LanternPost", Size = Vector3.new(0.5, 7, 0.5), Position = Vector3.new(x, 3.5, z), Color = Color3.fromRGB(60, 45, 35), Material = Enum.Material.Wood, CollisionGroup = "Furniture", Parent = parent })
	local lamp = part({ Name = "Lantern", Size = Vector3.new(1.4, 1.8, 1.4), Position = Vector3.new(x, 7.6, z), Color = Color3.fromRGB(255, 120, 60), Material = Enum.Material.Neon, CanCollide = false, Parent = parent })
	local light = Instance.new("PointLight")
	light.Range = 24
	light.Brightness = 1.4
	light.Color = Color3.fromRGB(255, 150, 90)
	light.Shadows = false
	light.Parent = lamp
	table.insert(lanternLights, light)
end

local function makeBulb(parent: Instance, x: number, y: number, z: number)
	local bulb = part({ Name = "Bulb", Size = Vector3.new(0.7, 0.7, 0.7), Shape = Enum.PartType.Ball, Position = Vector3.new(x, y, z), Color = Color3.fromRGB(255, 235, 180), Material = Enum.Material.Neon, CanCollide = false, Parent = parent })
	local light = Instance.new("PointLight")
	light.Range = 18
	light.Brightness = 0.9
	light.Color = Color3.fromRGB(255, 235, 190)
	light.Shadows = false
	light.Parent = bulb
end

local STATION_STYLE = {
	crate = { color = Color3.fromRGB(140, 100, 60), material = Enum.Material.WoodPlanks },
	board = { color = Color3.fromRGB(180, 180, 185), material = Enum.Material.Slate },
	combine = { color = Color3.fromRGB(150, 155, 165), material = Enum.Material.Metal },
	pot = { color = Color3.fromRGB(70, 70, 75), material = Enum.Material.Metal },
	griddle = { color = Color3.fromRGB(60, 55, 55), material = Enum.Material.Slate },
	fryer = { color = Color3.fromRGB(170, 170, 175), material = Enum.Material.DiamondPlate },
	ricecooker = { color = Color3.fromRGB(235, 235, 240), material = Enum.Material.SmoothPlastic },
	trash = { color = Color3.fromRGB(50, 90, 60), material = Enum.Material.Metal },
}

local function makeStation(parent: Folder, kind: string, index: number, x: number, z: number, crateItem: string?, locked: boolean): StationSpec
	local style = STATION_STYLE[kind]
	local id = kind .. index
	local base = part({
		Name = id,
		Size = Vector3.new(4, 3, 4),
		Position = Vector3.new(x, 1.5, z),
		Color = style.color,
		Material = style.material,
		CollisionGroup = "Furniture",
		Parent = parent,
	})
	local displayOffset = Vector3.new(0, 2.2, 0)
	local label = Recipes.StationNames[kind] or kind
	if kind == "crate" and crateItem then
		local item = Recipes.Items[crateItem]
		label = Recipes.name(crateItem)
		part({ Name = "Lid", Size = Vector3.new(3.2, 0.3, 3.2), Position = Vector3.new(x, 3.15, z), Color = Color3.fromRGB(item.color[1], item.color[2], item.color[3]), CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		displayOffset = Vector3.new(0, 2.5, 0)
	elseif kind == "board" then
		part({ Name = "Board", Size = Vector3.new(3, 0.3, 2.4), Position = Vector3.new(x, 3.15, z), Color = Color3.fromRGB(205, 165, 110), Material = Enum.Material.Wood, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		part({ Name = "Knife", Size = Vector3.new(1.4, 0.1, 0.3), Position = Vector3.new(x + 0.6, 3.35, z + 1.4), Color = Color3.fromRGB(220, 220, 230), Material = Enum.Material.Metal, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		displayOffset = Vector3.new(0, 2.4, 0)
	elseif kind == "pot" then
		part({ Name = "Pot", Size = Vector3.new(1.3, 2.8, 2.8), Shape = Enum.PartType.Cylinder, CFrame = CFrame.new(x, 3.65, z) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(35, 35, 40), Material = Enum.Material.Metal, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		displayOffset = Vector3.new(0, 3.6, 0)
	elseif kind == "griddle" then
		part({ Name = "Plate", Size = Vector3.new(3.4, 0.3, 3.4), Position = Vector3.new(x, 3.15, z), Color = Color3.fromRGB(30, 30, 30), Material = Enum.Material.Metal, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		displayOffset = Vector3.new(0, 2.5, 0)
	elseif kind == "fryer" then
		part({ Name = "Oil", Size = Vector3.new(3, 0.3, 3), Position = Vector3.new(x, 3.15, z), Color = Color3.fromRGB(240, 200, 90), Material = Enum.Material.Glass, Transparency = 0.2, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		displayOffset = Vector3.new(0, 2.5, 0)
	elseif kind == "ricecooker" then
		part({ Name = "Cooker", Size = Vector3.new(2, 2.6, 2.6), Shape = Enum.PartType.Cylinder, CFrame = CFrame.new(x, 4, z) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(245, 245, 250), Material = Enum.Material.SmoothPlastic, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		part({ Name = "Button", Size = Vector3.new(0.5, 0.5, 0.2), Position = Vector3.new(x, 4, z + 1.35), Color = Color3.fromRGB(230, 60, 60), Material = Enum.Material.Neon, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		displayOffset = Vector3.new(0, 4.1, 0)
	elseif kind == "trash" then
		base.Shape = Enum.PartType.Cylinder
		base.Size = Vector3.new(3.2, 3, 3)
		base.CFrame = CFrame.new(x, 1.6, z) * CFrame.Angles(0, 0, math.rad(90))
		part({ Name = "Rim", Size = Vector3.new(0.2, 3.2, 3.2), Shape = Enum.PartType.Cylinder, CFrame = CFrame.new(x, 3.2, z) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(35, 60, 40), Material = Enum.Material.Metal, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
	elseif kind == "combine" then
		part({ Name = "Top", Size = Vector3.new(4.2, 0.2, 4.2), Position = Vector3.new(x, 3.1, z), Color = Color3.fromRGB(200, 205, 215), Material = Enum.Material.Metal, CanCollide = false, CollisionGroup = "Furniture", Parent = base })
		displayOffset = Vector3.new(0, 2.3, 0)
	end
	-- 잠긴 조리대는 반투명
	if locked then
		for _, p in base:GetDescendants() do
			if p:IsA("BasePart") then
				p.Transparency = 0.6
			end
		end
		base.Transparency = 0.6
	end
	return {
		kind = kind,
		id = id,
		index = index,
		part = base,
		crateItem = crateItem,
		locked = locked,
		displayOffset = displayOffset,
		baseCFrame = base.CFrame,
		label = label,
	}
end

local function makeMenuBoard(parent: Instance)
	local board = part({
		Name = "MenuBoard",
		Size = Vector3.new(44, 7, 0.4),
		CFrame = CFrame.new(0, 9.5, -45.6) * CFrame.Angles(0, math.pi, 0),
		Color = Color3.fromRGB(35, 30, 30),
		Material = Enum.Material.Wood,
		CollisionGroup = "Furniture",
		Parent = parent,
	})
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.CanvasSize = Vector2.new(1760, 280)
	gui.LightInfluence = 0
	gui.Brightness = 1.5
	gui.Parent = board
	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, 0, 0, 56)
	title.BackgroundTransparency = 1
	title.Text = "🏮 저승 휴게소 메뉴판 — 손님이 원하는 것을 제때 내주세요 (레시피: R키)"
	title.TextColor3 = Color3.fromRGB(255, 220, 150)
	title.Font = Enum.Font.GothamBold
	title.TextSize = 34
	title.Parent = gui
	local list = Instance.new("Frame")
	list.Position = UDim2.new(0, 20, 0, 62)
	list.Size = UDim2.new(1, -40, 1, -70)
	list.BackgroundTransparency = 1
	list.Parent = gui
	local grid = Instance.new("UIGridLayout")
	grid.CellSize = UDim2.new(0, 420, 0, 100)
	grid.CellPadding = UDim2.new(0, 10, 0, 6)
	grid.Parent = list
	for _, dishId in Recipes.allDishes() do
		local item = Recipes.Items[dishId]
		local steps = Recipes.describe(dishId)
		local short = {}
		for _, s in steps do
			if not string.find(s, "재료 상자") then
				table.insert(short, s)
			end
		end
		local cell = Instance.new("TextLabel")
		cell.BackgroundColor3 = Color3.fromRGB(55, 45, 45)
		cell.BackgroundTransparency = 0.2
		cell.TextColor3 = Color3.fromRGB(245, 240, 230)
		cell.Font = Enum.Font.Gotham
		cell.TextSize = 20
		cell.TextXAlignment = Enum.TextXAlignment.Left
		cell.TextYAlignment = Enum.TextYAlignment.Top
		cell.TextWrapped = true
		cell.RichText = true
		cell.Text = string.format(
			"<b>%s %s</b>  <font color=\"#FFD27F\">%d코인</font>  <font color=\"#9AD0FF\">%d번째 밤부터</font>\n%s",
			item.emoji or "",
			item.name,
			item.price or 0,
			item.unlock or 1,
			table.concat(short, "\n")
		)
		local pad = Instance.new("UIPadding")
		pad.PaddingLeft = UDim.new(0, 8)
		pad.PaddingTop = UDim.new(0, 4)
		pad.Parent = cell
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 8)
		corner.Parent = cell
		cell.Parent = list
	end
end

function MapBuilder.build(): MapInfo
	setupCollisionGroups()
	setupLighting()

	local old = workspace:FindFirstChild("GhostDinerMap")
	if old then
		old:Destroy()
	end
	local root = Instance.new("Model")
	root.Name = "GhostDinerMap"
	local decor = Instance.new("Folder")
	decor.Name = "Decor"
	decor.Parent = root
	local stationsFolder = Instance.new("Folder")
	stationsFolder.Name = "Stations"
	stationsFolder.Parent = root
	local customersFolder = Instance.new("Folder")
	customersFolder.Name = "Customers"
	customersFolder.Parent = root

	-- 바닥
	part({ Name = "KitchenFloor", Size = Vector3.new(96, 1, 46), Position = Vector3.new(0, -0.5, -23), Color = Color3.fromRGB(120, 115, 110), Material = Enum.Material.Slate, Parent = decor })
	part({ Name = "FrontFloor", Size = Vector3.new(96, 1, 80), Position = Vector3.new(0, -0.5, 40), Color = Color3.fromRGB(62, 58, 75), Material = Enum.Material.Cobblestone, Parent = decor })
	part({ Name = "Path", Size = Vector3.new(14, 0.2, 60), Position = Vector3.new(0, 0.05, 36), Color = Color3.fromRGB(95, 90, 110), Material = Enum.Material.Concrete, CanCollide = false, Parent = decor })

	-- 벽 (주방 3면은 높게, 손님 구역은 낮게) + 보이지 않는 경계
	part({ Name = "BackWall", Size = Vector3.new(96, 12, 1), Position = Vector3.new(0, 6, -46.5), Color = Color3.fromRGB(90, 70, 60), Material = Enum.Material.Brick, Parent = decor })
	part({ Name = "LeftWall", Size = Vector3.new(1, 12, 46), Position = Vector3.new(-48.5, 6, -23), Color = Color3.fromRGB(90, 70, 60), Material = Enum.Material.Brick, Parent = decor })
	part({ Name = "RightWall", Size = Vector3.new(1, 12, 46), Position = Vector3.new(48.5, 6, -23), Color = Color3.fromRGB(90, 70, 60), Material = Enum.Material.Brick, Parent = decor })
	part({ Name = "LeftFence", Size = Vector3.new(1, 3, 80), Position = Vector3.new(-48.5, 1.5, 40), Color = Color3.fromRGB(70, 55, 45), Material = Enum.Material.Wood, Parent = decor })
	part({ Name = "RightFence", Size = Vector3.new(1, 3, 80), Position = Vector3.new(48.5, 1.5, 40), Color = Color3.fromRGB(70, 55, 45), Material = Enum.Material.Wood, Parent = decor })
	part({ Name = "FarWall", Size = Vector3.new(96, 3, 1), Position = Vector3.new(0, 1.5, 80.5), Color = Color3.fromRGB(70, 55, 45), Material = Enum.Material.Wood, Parent = decor })
	for _, spec in {
		{ Vector3.new(1, 40, 130), Vector3.new(-49.5, 20, 17) },
		{ Vector3.new(1, 40, 130), Vector3.new(49.5, 20, 17) },
		{ Vector3.new(100, 40, 1), Vector3.new(0, 20, -47.5) },
		{ Vector3.new(100, 40, 1), Vector3.new(0, 20, 81.5) },
	} do
		part({ Name = "Boundary", Size = spec[1], Position = spec[2], Transparency = 1, CastShadow = false, Parent = decor })
	end

	-- 카운터 (주방과 손님 구역을 가름. 손님(귀신)은 통과, 플레이어는 못 넘음)
	part({ Name = "Counter", Size = Vector3.new(74, 3, 2), Position = Vector3.new(0, 1.5, -1), Color = Color3.fromRGB(110, 75, 45), Material = Enum.Material.Wood, CollisionGroup = "Furniture", Parent = decor })
	part({ Name = "CounterTop", Size = Vector3.new(74.6, 0.3, 2.8), Position = Vector3.new(0, 3.15, -1), Color = Color3.fromRGB(190, 150, 100), Material = Enum.Material.WoodPlanks, CollisionGroup = "Furniture", Parent = decor })
	-- 카운터 양끝을 막는 기둥 (플레이어가 손님 구역으로 못 나가게)
	part({ Name = "CounterEndL", Size = Vector3.new(12, 3, 2), Position = Vector3.new(-43, 1.5, -1), Color = Color3.fromRGB(110, 75, 45), Material = Enum.Material.Wood, CollisionGroup = "Furniture", Parent = decor })
	part({ Name = "CounterEndR", Size = Vector3.new(12, 3, 2), Position = Vector3.new(43, 1.5, -1), Color = Color3.fromRGB(110, 75, 45), Material = Enum.Material.Wood, CollisionGroup = "Furniture", Parent = decor })

	-- 손님 자리 표시
	local slots: { Vector3 } = {}
	local slotXs = { -25, -15, -5, 5, 15, 25 }
	for i = 1, Config.Slots do
		local x = slotXs[((i - 1) % #slotXs) + 1]
		table.insert(slots, Vector3.new(x, 0, 3.5))
		part({ Name = "SlotMark" .. i, Size = Vector3.new(3.2, 0.1, 3.2), Position = Vector3.new(x, 0.06, 3.5), Color = Color3.fromRGB(150, 90, 220), Material = Enum.Material.Neon, Transparency = 0.5, CanCollide = false, Parent = decor })
	end
	local queue: { Vector3 } = {}
	local queueXs = { -21, -15, -9, -3, 3, 9, 15, 21 }
	for i = 1, Config.QueueSpots do
		local x = queueXs[((i - 1) % #queueXs) + 1]
		table.insert(queue, Vector3.new(x, 0, 13))
		part({ Name = "QueueMark" .. i, Size = Vector3.new(2.6, 0.1, 2.6), Position = Vector3.new(x, 0.06, 13), Color = Color3.fromRGB(90, 70, 140), Material = Enum.Material.Neon, Transparency = 0.7, CanCollide = false, Parent = decor })
	end

	-- 저승 문
	for _, x in { -7, 7 } do
		part({ Name = "GatePost", Size = Vector3.new(1.6, 13, 1.6), Position = Vector3.new(x, 6.5, 64), Color = Color3.fromRGB(45, 35, 60), Material = Enum.Material.Granite, CollisionGroup = "Furniture", Parent = decor })
	end
	part({ Name = "GateBeam", Size = Vector3.new(17, 1.6, 1.8), Position = Vector3.new(0, 13.3, 64), Color = Color3.fromRGB(45, 35, 60), Material = Enum.Material.Granite, CollisionGroup = "Furniture", Parent = decor })
	local portal = part({ Name = "Portal", Size = Vector3.new(12.4, 12, 0.4), Position = Vector3.new(0, 6.5, 64), Color = Color3.fromRGB(150, 70, 255), Material = Enum.Material.Neon, Transparency = 0.35, CanCollide = false, Parent = decor })
	local portalLight = Instance.new("PointLight")
	portalLight.Range = 30
	portalLight.Brightness = 1.2
	portalLight.Color = Color3.fromRGB(170, 100, 255)
	portalLight.Parent = portal
	local portalFx = Instance.new("ParticleEmitter")
	portalFx.Rate = 12
	portalFx.Lifetime = NumberRange.new(1.5, 3)
	portalFx.Speed = NumberRange.new(1, 2)
	portalFx.Size = NumberSequence.new(0.6, 0)
	portalFx.Transparency = NumberSequence.new(0.3, 1)
	portalFx.Color = ColorSequence.new(Color3.fromRGB(200, 150, 255))
	portalFx.LightEmission = 0.8
	portalFx.SpreadAngle = Vector2.new(60, 60)
	portalFx.Parent = portal

	-- 등불
	for _, z in { 6, 24, 42, 58 } do
		makeLantern(decor, -16, z)
		makeLantern(decor, 16, z)
	end
	for x = -40, 40, 10 do
		makeBulb(decor, x, 9.5, -9)
		makeBulb(decor, x, 9.5, -37)
	end
	for _, z in { -8, -37 } do
		part({ Name = "Wire", Size = Vector3.new(84, 0.1, 0.1), Position = Vector3.new(0, 9.8, z + (if z == -8 then -1 else 0)), Color = Color3.fromRGB(30, 30, 30), CanCollide = false, Parent = decor })
	end

	-- 플레이어 스폰
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "KitchenSpawn"
	spawn.Size = Vector3.new(8, 1, 6)
	spawn.Position = Vector3.new(-30, 0.0, -8)
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Color = Color3.fromRGB(140, 135, 130)
	spawn.Material = Enum.Material.Fabric
	spawn.TopSurface = Enum.SurfaceType.Smooth
	spawn.Parent = decor

	makeMenuBoard(decor)

	-- 조리대 배치
	local stations: { StationSpec } = {}
	local function add(kind: string, index: number, x: number, z: number, crateItem: string?, locked: boolean?)
		table.insert(stations, makeStation(stationsFolder, kind, index, x, z, crateItem, locked == true))
	end
	-- 뒷벽: 재료 상자 9개
	for i, itemId in Recipes.CrateItems do
		add("crate", i, -32 + (i - 1) * 8, -42, itemId)
	end
	-- 왼쪽 벽: 도마 2, 쓰레기통 / 오른쪽 벽: 밥솥(1 + 잠금 1), 쓰레기통
	add("board", 1, -42, -32)
	add("board", 2, -42, -26)
	add("trash", 1, -42, -14)
	add("ricecooker", 1, 42, -32)
	add("ricecooker", 2, 42, -26, nil, true)
	add("trash", 2, 42, -14)
	-- 가운데 섬 A(Z=-30): 튀김기(1+1), 냄비(1+2), 화덕(1+1)
	add("fryer", 1, -30, -30)
	add("fryer", 2, -24, -30, nil, true)
	add("pot", 1, -12, -30)
	add("pot", 2, -6, -30, nil, true)
	add("pot", 3, 0, -30, nil, true)
	add("griddle", 1, 10, -30)
	add("griddle", 2, 16, -30, nil, true)
	-- 가운데 섬 B(Z=-16): 조리대 3
	add("combine", 1, -12, -16)
	add("combine", 2, 0, -16)
	add("combine", 3, 12, -16)

	root.Parent = workspace

	return {
		root = root,
		stationsFolder = stationsFolder,
		customersFolder = customersFolder,
		stations = stations,
		slots = slots,
		queue = queue,
		spawnPoint = Vector3.new(0, 3, 72),
		exitPoint = Vector3.new(0, 3, 74),
		lanterns = lanternLights,
	}
end

return MapBuilder
