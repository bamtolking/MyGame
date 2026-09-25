--!strict
-- 슬라임 모델을 기본 도형(파트)만으로 조립합니다. 외부 에셋이 필요 없습니다.
-- 서버(기지 슬라임·들고 가는 슬라임)와 클라이언트(행진·도감 미리보기)가 같이 씁니다.
--
-- 좌표: 기준점(origin) = 슬라임 바닥 중심, 얼굴은 origin의 LookVector(-Z) 방향.
-- 몸 크기(★1): 가로 4 × 높이 3.2 × 세로 4. ★에 따라 전체가 커집니다.
--
-- 새 장식 추가: ACCESSORIES 표에 함수 하나 추가 → Config/Slimes의 acc에 이름 사용.

local Shared = script.Parent
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Mutations = require(Shared.Config.Mutations)
local Economy = require(Shared.Config.Economy)

local SlimeBuilder = {}

export type BuildInfo = {
	id: string,
	star: number,
	mut: string,
}

type PartOpts = {
	shape: string?, -- "sphere"(늘어나는 타원체) | "ball" | "cylinder" | nil(상자)
	material: Enum.Material?,
	transparency: number?,
	reflectance: number?,
	shadow: boolean?,
}

-- 몸 타원체 반지름(★1 기준)
local RX, RY, RZ = 2, 1.6, 2
local CY = 1.6

type Ctx = {
	model: Model,
	origin: CFrame,
	s: number,
	accent: Color3,
	body: Color3,
}

local function makePart(ctx: Ctx, name: string, size: Vector3, localCf: CFrame, color: Color3, opts: PartOpts?): Part
	local o: PartOpts = opts or {}
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.CastShadow = o.shadow == true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = o.material or Enum.Material.SmoothPlastic
	p.Color = color
	p.Transparency = o.transparency or 0
	p.Reflectance = o.reflectance or 0
	p.Size = size * ctx.s
	local shape = o.shape
	if shape == "sphere" then
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.Sphere
		mesh.Parent = p
	elseif shape == "ball" then
		p.Shape = Enum.PartType.Ball
	elseif shape == "cylinder" then
		p.Shape = Enum.PartType.Cylinder
	end
	-- localCf의 위치만 크기 배율을 적용
	local pos = localCf.Position * ctx.s
	p.CFrame = ctx.origin * (CFrame.new(pos) * (localCf - localCf.Position))
	p.Parent = ctx.model
	return p
end

local function v(x: number, y: number, z: number): Vector3
	return Vector3.new(x, y, z)
end

local function at(x: number, y: number, z: number): CFrame
	return CFrame.new(x, y, z)
end

local rad = math.rad

-- 몸 표면 위의 점(높이 h: -1~1, 방위각 theta: 0=정면)
local function onSurface(theta: number, h: number, inset: number?): Vector3
	local r = math.sqrt(math.max(0, 1 - h * h))
	local k = 1 - (inset or 0)
	return Vector3.new(RX * r * math.sin(theta) * k, CY + h * RY * k, -RZ * r * math.cos(theta) * k)
end

-- 정면(-Z) 표면의 z 좌표
local function frontZ(x: number, y: number): number
	local t = 1 - (x / RX) ^ 2 - ((y - CY) / RY) ^ 2
	return -RZ * math.sqrt(math.max(0, t))
end

-- 세로 원기둥(원기둥 축은 X이므로 Z축으로 90도 회전)
local UPRIGHT = CFrame.Angles(0, 0, rad(90))

local ACCESSORIES: { [string]: (ctx: Ctx) -> () } = {}

ACCESSORIES.droplet = function(ctx)
	makePart(ctx, "Droplet", v(0.8, 1.1, 0.8), at(0, 3.55, 0), ctx.body, { shape = "sphere" })
end

ACCESSORIES.bow = function(ctx)
	makePart(ctx, "BowL", v(0.95, 0.6, 0.35), at(0.55, 3.0, 0.2) * CFrame.Angles(0, 0, rad(25)), ctx.accent, { shape = "sphere" })
	makePart(ctx, "BowR", v(0.95, 0.6, 0.35), at(1.45, 3.0, 0.2) * CFrame.Angles(0, 0, rad(-25)), ctx.accent, { shape = "sphere" })
	makePart(ctx, "Knot", v(0.4, 0.4, 0.4), at(1.0, 3.0, 0.2), ctx.accent, { shape = "ball" })
end

ACCESSORIES.bubbles = function(ctx)
	local glass = { shape = "ball", material = Enum.Material.Glass, transparency = 0.35 }
	makePart(ctx, "Bubble1", v(0.55, 0.55, 0.55), at(1.9, 2.9, 0.7), Color3.fromRGB(210, 245, 255), glass)
	makePart(ctx, "Bubble2", v(0.4, 0.4, 0.4), at(-2.0, 2.2, -0.4), Color3.fromRGB(210, 245, 255), glass)
	makePart(ctx, "Bubble3", v(0.32, 0.32, 0.32), at(1.3, 3.8, -0.5), Color3.fromRGB(210, 245, 255), glass)
end

ACCESSORIES.sprout = function(ctx)
	makePart(ctx, "Stem", v(0.7, 0.16, 0.16), at(0, 3.45, 0) * UPRIGHT, ctx.accent, { shape = "cylinder" })
	makePart(ctx, "LeafL", v(0.7, 0.14, 0.35), at(-0.33, 3.8, 0) * CFrame.Angles(0, 0, rad(-25)), ctx.accent, { shape = "sphere" })
	makePart(ctx, "LeafR", v(0.7, 0.14, 0.35), at(0.33, 3.8, 0) * CFrame.Angles(0, 0, rad(25)), ctx.accent, { shape = "sphere" })
end

ACCESSORIES.caramel = function(ctx)
	makePart(ctx, "Caramel", v(3.0, 0.7, 3.0), at(0, 2.95, 0), ctx.accent, { shape = "sphere" })
end

ACCESSORIES.leaf = function(ctx)
	makePart(ctx, "Stem", v(0.6, 0.18, 0.18), at(0.1, 3.4, 0) * UPRIGHT, Color3.fromRGB(90, 60, 30), { shape = "cylinder" })
	makePart(ctx, "Leaf", v(2.3, 0.16, 1.1), at(0.8, 3.75, 0.1) * CFrame.Angles(0, rad(15), rad(22)), ctx.accent, { shape = "sphere" })
end

ACCESSORIES.pebbles = function(ctx)
	local m = { shape = "ball", material = Enum.Material.Slate }
	makePart(ctx, "Pebble1", v(0.7, 0.7, 0.7), at(1.9, 0.3, -0.9), ctx.accent, m)
	makePart(ctx, "Pebble2", v(0.55, 0.55, 0.55), at(-2.0, 0.25, 0.5), ctx.accent, m)
	makePart(ctx, "Pebble3", v(0.5, 0.5, 0.5), at(0.9, 0.25, 1.95), ctx.accent, m)
end

ACCESSORIES.antenna = function(ctx)
	local dark = Color3.fromRGB(35, 30, 30)
	makePart(ctx, "AntennaL", v(1.1, 0.13, 0.13), at(-0.5, 3.55, 0) * CFrame.Angles(0, 0, rad(110)), dark, { shape = "cylinder" })
	makePart(ctx, "AntennaR", v(1.1, 0.13, 0.13), at(0.5, 3.55, 0) * CFrame.Angles(0, 0, rad(70)), dark, { shape = "cylinder" })
	makePart(ctx, "TipL", v(0.36, 0.36, 0.36), at(-0.69, 4.07, 0), ctx.accent, { shape = "ball" })
	makePart(ctx, "TipR", v(0.36, 0.36, 0.36), at(0.69, 4.07, 0), ctx.accent, { shape = "ball" })
end

ACCESSORIES.stripes = function(ctx)
	makePart(ctx, "Stripe1", v(3.8, 0.34, 3.8), at(0, 1.02, 0), ctx.accent, { shape = "sphere" })
	makePart(ctx, "Stripe2", v(3.0, 0.3, 3.0), at(0, 0.5, 0), ctx.accent, { shape = "sphere" })
end

ACCESSORIES.chips = function(ctx)
	local spots = { { 0.9, 0.3 }, { 2.2, -0.2 }, { 3.5, 0.5 }, { 4.4, 0.05 }, { 5.3, -0.45 }, { 0.6, 0.72 }, { -0.6, 0.72 } }
	for i, spot in spots do
		makePart(ctx, "Chip" .. i, v(0.36, 0.36, 0.36), CFrame.new(onSurface(spot[1], spot[2], 0.02)), ctx.accent, { shape = "ball" })
	end
end

ACCESSORIES.straw = function(ctx)
	makePart(ctx, "Straw", v(2.4, 0.26, 0.26), at(0.55, 3.7, 0.2) * CFrame.Angles(0, 0, rad(72)), ctx.accent, { shape = "cylinder" })
end

ACCESSORIES.icespikes = function(ctx)
	local ice = { shape = "sphere", material = Enum.Material.Glass, transparency = 0.15 }
	makePart(ctx, "Spike1", v(0.55, 1.6, 0.55), at(0, 3.55, 0), ctx.accent, ice)
	makePart(ctx, "Spike2", v(0.45, 1.2, 0.45), at(-0.8, 3.3, 0.2) * CFrame.Angles(0, 0, rad(20)), ctx.accent, ice)
	makePart(ctx, "Spike3", v(0.45, 1.2, 0.45), at(0.8, 3.3, 0.2) * CFrame.Angles(0, 0, rad(-20)), ctx.accent, ice)
	makePart(ctx, "Spike4", v(0.4, 1.0, 0.4), at(0, 3.25, 0.85) * CFrame.Angles(rad(20), 0, 0), ctx.accent, ice)
end

ACCESSORIES.bolt = function(ctx)
	local neon = { material = Enum.Material.Neon }
	makePart(ctx, "Bolt1", v(0.35, 1.1, 0.35), at(0, 3.6, 0) * CFrame.Angles(0, 0, rad(30)), ctx.accent, neon)
	makePart(ctx, "Bolt2", v(0.35, 1.1, 0.35), at(0, 4.56, 0) * CFrame.Angles(0, 0, rad(-30)), ctx.accent, neon)
	makePart(ctx, "Bolt3", v(0.35, 1.1, 0.35), at(0, 5.51, 0) * CFrame.Angles(0, 0, rad(30)), ctx.accent, neon)
end

ACCESSORIES.coral = function(ctx)
	local branches = { { -0.6, -25 }, { 0, 0 }, { 0.6, 25 } }
	for i, b in branches do
		local x, tilt = b[1], rad(b[2])
		makePart(ctx, "Branch" .. i, v(1.3, 0.3, 0.3), at(x, 3.6, 0) * CFrame.Angles(0, 0, rad(90) - tilt), ctx.accent, { shape = "cylinder" })
		local tip = Vector3.new(x + math.sin(tilt) * 0.65, 3.6 + math.cos(tilt) * 0.65, 0)
		makePart(ctx, "Tip" .. i, v(0.45, 0.45, 0.45), CFrame.new(tip), ctx.accent, { shape = "ball" })
	end
end

ACCESSORIES.cloud = function(ctx)
	local white = Color3.fromRGB(255, 255, 255)
	makePart(ctx, "Cloud1", v(1.3, 1.1, 1.3), at(0, 3.35, 0), white, { shape = "sphere" })
	makePart(ctx, "Cloud2", v(1.0, 0.85, 1.0), at(-0.75, 3.2, 0.1), white, { shape = "sphere" })
	makePart(ctx, "Cloud3", v(1.05, 0.9, 1.05), at(0.8, 3.2, -0.1), white, { shape = "sphere" })
	makePart(ctx, "Cloud4", v(0.85, 0.75, 0.85), at(0.2, 3.75, 0.35), white, { shape = "sphere" })
end

ACCESSORIES.flame = function(ctx)
	local outer = makePart(ctx, "Flame", v(1.0, 1.5, 1.0), at(0, 3.7, 0), ctx.accent, { shape = "sphere", material = Enum.Material.Neon, transparency = 0.1 })
	makePart(ctx, "FlameCore", v(0.55, 0.9, 0.55), at(0, 3.55, -0.15), Color3.fromRGB(255, 250, 200), { shape = "sphere", material = Enum.Material.Neon })
	local fire = Instance.new("Fire")
	fire.Size = 2.5 * ctx.s
	fire.Heat = 6
	fire.Color = Color3.fromRGB(255, 140, 40)
	fire.SecondaryColor = Color3.fromRGB(255, 230, 90)
	fire.Parent = outer
end

ACCESSORIES.headband = function(ctx)
	makePart(ctx, "Band", v(3.15, 0.42, 3.15), at(0, 2.65, 0), ctx.accent, { shape = "sphere" })
	makePart(ctx, "TailL", v(0.3, 0.14, 1.3), at(-0.25, 2.45, 1.95) * CFrame.Angles(rad(25), rad(-12), 0), ctx.accent)
	makePart(ctx, "TailR", v(0.3, 0.14, 1.3), at(0.25, 2.4, 1.95) * CFrame.Angles(rad(35), rad(12), 0), ctx.accent)
end

ACCESSORIES.wizardhat = function(ctx)
	local star = Color3.fromRGB(255, 230, 90)
	makePart(ctx, "Brim", v(0.22, 3.3, 3.3), at(0, 3.05, 0) * UPRIGHT, ctx.accent, { shape = "cylinder" })
	makePart(ctx, "Cone1", v(0.8, 2.1, 2.1), at(0, 3.5, 0) * UPRIGHT, ctx.accent, { shape = "cylinder" })
	makePart(ctx, "Cone2", v(0.75, 1.45, 1.45), at(0.08, 4.2, 0.05) * UPRIGHT * CFrame.Angles(0, 0, 0), ctx.accent, { shape = "cylinder" })
	makePart(ctx, "Cone3", v(0.7, 0.85, 0.85), at(0.2, 4.85, 0.1) * UPRIGHT, ctx.accent, { shape = "cylinder" })
	makePart(ctx, "Star", v(0.5, 0.5, 0.5), at(0.3, 5.35, 0.1), star, { shape = "ball", material = Enum.Material.Neon })
end

ACCESSORIES.piratehat = function(ctx)
	local black = Color3.fromRGB(30, 30, 35)
	makePart(ctx, "Brim", v(0.25, 3.5, 3.5), at(0, 3.05, 0) * UPRIGHT, black, { shape = "cylinder" })
	makePart(ctx, "Crown", v(2.7, 1.1, 1.7), at(0, 3.55, 0.1), black, { shape = "sphere" })
	makePart(ctx, "Skull", v(0.45, 0.45, 0.2), at(0, 3.6, -0.78), Color3.fromRGB(245, 245, 240), { shape = "sphere" })
end

ACCESSORIES.eyepatch = function(ctx)
	local black = Color3.fromRGB(20, 20, 22)
	local x, y = 0.75, 2.0
	makePart(ctx, "Patch", v(0.8, 0.95, 0.3), CFrame.new(x, y, frontZ(x, y) - 0.12), black, { shape = "sphere" })
	makePart(ctx, "Strap", v(3.95, 0.12, 3.95), at(0, 2.25, 0) * CFrame.Angles(0, 0, rad(-14)), black, { shape = "sphere" })
end

ACCESSORIES.visor = function(ctx)
	makePart(ctx, "Visor", v(4.02, 0.5, 4.02), at(0, 2.0, 0), ctx.accent, { shape = "sphere", material = Enum.Material.Neon })
end

ACCESSORIES.crown = function(ctx)
	local gold = Color3.fromRGB(255, 205, 50)
	local gem = Color3.fromRGB(255, 50, 80)
	makePart(ctx, "CrownBase", v(0.4, 2.0, 2.0), at(0, 3.12, 0) * UPRIGHT, gold, { shape = "cylinder", material = Enum.Material.Foil })
	for i = 1, 6 do
		local a = rad(i * 60)
		local dir = Vector3.new(math.cos(a), 0, math.sin(a))
		local pos = Vector3.new(0, 3.55, 0) + dir * 0.85
		makePart(ctx, "Spike" .. i, v(0.45, 0.7, 0.18), CFrame.lookAt(pos, pos + dir), gold, { material = Enum.Material.Foil })
		makePart(ctx, "Tip" .. i, v(0.22, 0.22, 0.22), CFrame.new(pos + Vector3.new(0, 0.42, 0)), gold, { shape = "ball" })
	end
	makePart(ctx, "Gem", v(0.35, 0.35, 0.35), at(0, 3.15, -0.98), gem, { shape = "ball", material = Enum.Material.Neon })
end

ACCESSORIES.cape = function(ctx)
	makePart(ctx, "Cape", v(2.6, 2.75, 0.12), at(0, 1.5, 1.78) * CFrame.Angles(rad(-18), 0, 0), ctx.accent, { material = Enum.Material.Fabric })
end

ACCESSORIES.horns = function(ctx)
	makePart(ctx, "HornL", v(0.45, 1.3, 0.45), at(-0.95, 3.2, -0.2) * CFrame.Angles(0, 0, rad(25)), ctx.accent, { shape = "sphere" })
	makePart(ctx, "HornR", v(0.45, 1.3, 0.45), at(0.95, 3.2, -0.2) * CFrame.Angles(0, 0, rad(-25)), ctx.accent, { shape = "sphere" })
end

ACCESSORIES.wings = function(ctx)
	local mat = if ctx.accent.R + ctx.accent.G + ctx.accent.B > 2.4 then Enum.Material.SmoothPlastic else Enum.Material.Neon
	makePart(ctx, "WingL", v(2.3, 1.4, 0.15), at(-2.25, 2.3, 0.8) * CFrame.Angles(0, rad(-25), rad(-20)), ctx.accent, { shape = "sphere", material = mat, transparency = 0.1 })
	makePart(ctx, "WingR", v(2.3, 1.4, 0.15), at(2.25, 2.3, 0.8) * CFrame.Angles(0, rad(25), rad(20)), ctx.accent, { shape = "sphere", material = mat, transparency = 0.1 })
end

ACCESSORIES.halo = function(ctx)
	local gold = Color3.fromRGB(255, 235, 120)
	for i = 1, 12 do
		local a = rad(i * 30)
		makePart(ctx, "Halo" .. i, v(0.3, 0.3, 0.3), at(math.cos(a) * 0.95, 4.1, math.sin(a) * 0.95), gold, { shape = "ball", material = Enum.Material.Neon })
	end
end

ACCESSORIES.kabuto = function(ctx)
	local gold = Color3.fromRGB(230, 190, 70)
	local dark = Color3.fromRGB(60, 20, 25)
	makePart(ctx, "Helmet", v(4.3, 1.9, 4.3), at(0, 2.95, 0.05), dark, { shape = "sphere", material = Enum.Material.Metal })
	makePart(ctx, "CrestL", v(0.25, 1.5, 0.12), at(-0.45, 4.0, -1.25) * CFrame.Angles(0, 0, rad(30)), gold, { material = Enum.Material.Foil })
	makePart(ctx, "CrestR", v(0.25, 1.5, 0.12), at(0.45, 4.0, -1.25) * CFrame.Angles(0, 0, rad(-30)), gold, { material = Enum.Material.Foil })
	makePart(ctx, "Badge", v(0.4, 0.4, 0.15), at(0, 3.4, -1.95), gold, { shape = "sphere", material = Enum.Material.Foil })
end

ACCESSORIES.crest = function(ctx)
	local neon = { shape = "sphere", material = Enum.Material.Neon }
	makePart(ctx, "Crest1", v(0.35, 1.6, 0.35), at(-0.35, 3.7, 0.45) * CFrame.Angles(rad(15), 0, rad(22)), ctx.accent, neon)
	makePart(ctx, "Crest2", v(0.38, 1.9, 0.38), at(0, 3.9, 0.45) * CFrame.Angles(rad(15), 0, 0), ctx.accent, neon)
	makePart(ctx, "Crest3", v(0.35, 1.6, 0.35), at(0.35, 3.7, 0.45) * CFrame.Angles(rad(15), 0, rad(-22)), ctx.accent, neon)
end

ACCESSORIES.tentacles = function(ctx)
	for i = 1, 6 do
		local a = rad(i * 60 + 30)
		local pos = Vector3.new(math.cos(a) * 1.9, 0.35, math.sin(a) * 1.9)
		local cf = CFrame.new(pos) * CFrame.Angles(0, -a, 0) * CFrame.Angles(0, 0, rad(-12))
		makePart(ctx, "Tentacle" .. i, v(1.7, 0.45, 0.45), cf, ctx.accent, { shape = "cylinder" })
		local tip = (cf * CFrame.new(0.85, 0, 0)).Position
		makePart(ctx, "Suck" .. i, v(0.5, 0.5, 0.5), CFrame.new(tip), ctx.accent, { shape = "ball" })
	end
end

ACCESSORIES.orbit = function(ctx)
	local tilt = CFrame.Angles(rad(18), 0, rad(8))
	for i = 1, 8 do
		local a = rad(i * 45)
		local pos = (CFrame.new(0, 1.8, 0) * tilt * CFrame.new(math.cos(a) * 2.9, 0, math.sin(a) * 2.9)).Position
		makePart(ctx, "Orb" .. i, v(0.38, 0.38, 0.38), CFrame.new(pos), ctx.accent, { shape = "ball", material = Enum.Material.Neon })
	end
end

ACCESSORIES.glitch = function(ctx)
	local cubes = {
		{ 1.8, 2.6, -0.5, 0.8 },
		{ -1.95, 1.2, 0.6, 0.65 },
		{ 0.9, 0.35, -1.75, 0.5 },
		{ -1.2, 3.1, 0.9, 0.55 },
		{ 2.1, 1.0, 1.1, 0.45 },
		{ -0.5, 3.5, -0.6, 0.4 },
	}
	for i, c in cubes do
		local color = if i % 2 == 0 then ctx.accent else ctx.body
		makePart(ctx, "Glitch" .. i, v(c[4], c[4], c[4]), at(c[1], c[2], c[3]) * CFrame.Angles(rad(i * 17), rad(i * 29), 0), color, { material = Enum.Material.Neon, transparency = 0.15 })
	end
end

function SlimeBuilder.hasAccessory(name: string): boolean
	return ACCESSORIES[name] ~= nil
end

local function materialOf(name: string?): Enum.Material?
	if not name then
		return nil
	end
	local ok, value = pcall(function(): Enum.Material
		return (Enum.Material :: any)[name]
	end)
	return if ok then value else nil
end

-- 슬라임 모델을 만듭니다(모든 파트 Anchored). origin 기본값은 원점.
-- scaleMult: ★ 크기에 추가로 곱할 배율(머리 위에 들 때 등)
function SlimeBuilder.build(info: BuildInfo, origin: CFrame?, scaleMult: number?): Model
	local species = Slimes.byId[info.id] or Slimes.list[1]
	local rarity = Rarities.byId[species.rarity]
	local mutation = Mutations.byId[info.mut] or Mutations.byId.none
	local star = math.clamp(info.star, 1, Economy.star.max)
	local s = Economy.star.scale[star] * (scaleMult or 1)

	local model = Instance.new("Model")
	model.Name = species.id

	local bodyColor = mutation.color or species.color
	local ctx: Ctx = {
		model = model,
		origin = origin or CFrame.new(),
		s = s,
		accent = species.accent,
		body = bodyColor,
	}

	local root = Instance.new("Part")
	root.Name = "Root"
	root.Anchored = true
	root.CanCollide = false
	root.CanTouch = false
	root.CanQuery = false
	root.Transparency = 1
	root.Size = Vector3.new(1, 1, 1)
	root.CFrame = ctx.origin
	root.Parent = model
	model.PrimaryPart = root

	local bodyMaterial = materialOf(mutation.material) or materialOf(species.material) or Enum.Material.SmoothPlastic
	local bodyTransparency = mutation.transparency or species.transparency or 0
	local body = makePart(ctx, "Body", v(RX * 2, RY * 2, RZ * 2), at(0, CY, 0), bodyColor, {
		shape = "sphere",
		material = bodyMaterial,
		transparency = bodyTransparency,
		reflectance = mutation.reflectance,
		shadow = true,
	})
	if mutation.id == "rainbow" then
		body:SetAttribute("Rainbow", true)
	end

	-- 바닥 그림자(얇은 원판) — 들고 가거나 공중에 띄울 때는 호출한 쪽에서 떼어 냅니다
	makePart(ctx, "Shadow", v(0.08, 3.9, 3.9), at(0, 0.05, 0) * UPRIGHT, Color3.new(0, 0, 0), {
		shape = "cylinder",
		transparency = 0.72,
	})

	-- 광택(큰 것 + 작은 것)
	makePart(ctx, "Shine", v(0.9, 0.45, 0.6), at(-0.85, 2.75, -0.95) * CFrame.Angles(0, rad(-30), rad(20)), Color3.new(1, 1, 1), {
		shape = "sphere",
		transparency = 0.45,
	})
	makePart(ctx, "Shine2", v(0.34, 0.2, 0.24), at(-0.35, 3.02, -0.95) * CFrame.Angles(0, rad(-15), rad(10)), Color3.new(1, 1, 1), {
		shape = "sphere",
		transparency = 0.4,
	})

	-- 눈: 흰자 + 눈동자 + 반짝임 2개(깜빡임은 클라이언트가 Eye/EyeWhite 크기로 연출)
	local black = Color3.fromRGB(25, 22, 30)
	local white = Color3.fromRGB(255, 255, 255)
	for _, side in { -1, 1 } do
		local ex, ey = 0.72 * side, 2.0
		local ez = frontZ(ex, ey)
		makePart(ctx, "EyeWhite", v(0.64, 0.88, 0.3), CFrame.new(ex, ey, ez + 0.08), white, { shape = "sphere" })
		makePart(ctx, "Eye", v(0.46, 0.66, 0.3), CFrame.new(ex - 0.04 * side, ey - 0.05, ez - 0.02), black, { shape = "sphere" })
		makePart(ctx, "EyeShine", v(0.2, 0.2, 0.2), CFrame.new(ex - 0.1, ey + 0.13, ez - 0.14), white, { shape = "ball" })
		makePart(ctx, "EyeShine2", v(0.09, 0.09, 0.09), CFrame.new(ex + 0.08, ey - 0.16, ez - 0.13), white, { shape = "ball" })
		local cx, cy = 1.25 * side, 1.55
		makePart(ctx, "Cheek", v(0.55, 0.3, 0.3), CFrame.new(cx, cy, frontZ(cx, cy) + 0.08), Color3.fromRGB(255, 130, 150), {
			shape = "sphere",
			transparency = 0.25,
		})
	end
	-- 입 + 혀
	local mz = frontZ(0, 1.45)
	makePart(ctx, "Mouth", v(0.52, 0.26, 0.24), CFrame.new(0, 1.45, mz + 0.06), black, { shape = "sphere" })
	makePart(ctx, "Tongue", v(0.26, 0.13, 0.16), CFrame.new(0, 1.39, mz - 0.03), Color3.fromRGB(255, 110, 140), { shape = "sphere" })

	-- 전설 이상: 발밑 빛 고리
	if rarity.glow then
		local auraColor = if rarity.id == "secret" then Color3.fromRGB(255, 255, 255) else rarity.color
		for i = 1, 12 do
			local a = rad(i * 30)
			makePart(ctx, "Aura", v(0.28, 0.28, 0.28), at(math.cos(a) * 2.35, 0.16, math.sin(a) * 2.35), auraColor, {
				shape = "ball",
				material = Enum.Material.Neon,
			})
		end
	end

	for _, accName in species.accessories do
		local fn = ACCESSORIES[accName]
		if fn then
			fn(ctx)
		end
	end

	-- 등급 빛
	if rarity.glow then
		local light = Instance.new("PointLight")
		light.Color = rarity.color
		light.Range = 10 * s
		light.Brightness = 1.4
		light.Parent = body
	end
	-- 변이 효과
	if mutation.sparkle then
		local sparkles = Instance.new("Sparkles")
		sparkles.SparkleColor = mutation.sparkle
		sparkles.Parent = body
	end
	if mutation.light then
		local light = Instance.new("PointLight")
		light.Color = mutation.light
		light.Range = 12 * s
		light.Brightness = 2
		light.Parent = body
	end
	if mutation.id == "lava" then
		local fire = Instance.new("Fire")
		fire.Size = 3 * s
		fire.Heat = 4
		fire.Color = Color3.fromRGB(255, 90, 20)
		fire.SecondaryColor = Color3.fromRGB(255, 200, 60)
		fire.Parent = body
	end

	model:SetAttribute("SpeciesId", species.id)
	model:SetAttribute("Star", star)
	model:SetAttribute("Mutation", mutation.id)
	model:SetAttribute("Height", (RY * 2) * s)
	return model
end

-- 슬라임 높이(★ 반영)
function SlimeBuilder.height(star: number): number
	return RY * 2 * Economy.star.scale[math.clamp(star, 1, Economy.star.max)]
end

return SlimeBuilder
