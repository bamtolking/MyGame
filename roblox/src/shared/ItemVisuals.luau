--!nonstrict
-- 재료·요리·도구의 모양(파츠 조립). 서버(조리대 위 표시, Tool)와 클라이언트(서빙 연출) 양쪽에서 씁니다.
local Recipes = require(script.Parent.Recipes)

local ItemVisuals = {}

local function rgb(c: { number }): Color3
	return Color3.fromRGB(c[1], c[2], c[3])
end

local function newPart(size: Vector3, color: Color3, shape: Enum.PartType?): Part
	local p = Instance.new("Part")
	p.Size = size
	p.Color = color
	p.Material = Enum.Material.SmoothPlastic
	p.Shape = shape or Enum.PartType.Block
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	p.CastShadow = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	return p
end

local UPRIGHT = CFrame.Angles(0, 0, math.rad(90)) -- 실린더를 세움
ItemVisuals.UPRIGHT_SHAPES = { jar = true, bowl = true, plate = true, tank = true }

-- 아이템 모양을 Model 로 돌려줌. PrimaryPart(Handle) 중심이 원점, 기준점(WorldPivot)은 회전 없는 원점.
function ItemVisuals.build(itemId: string): Model
	local item = Recipes.Items[itemId] or Recipes.Items.burnt
	local color = rgb(item.color)
	local model = Instance.new("Model")
	model.Name = itemId
	local base: Part
	local shape = item.shape
	if shape == "box" then
		base = newPart(Vector3.new(1.2, 0.8, 1.2), color)
	elseif shape == "ball" then
		base = newPart(Vector3.new(1, 1, 1), color, Enum.PartType.Ball)
	elseif shape == "cyl" then
		base = newPart(Vector3.new(1.6, 0.6, 0.6), color, Enum.PartType.Cylinder)
	elseif shape == "flat" then
		base = newPart(Vector3.new(1.4, 0.2, 1.4), color)
	elseif shape == "bag" then
		base = newPart(Vector3.new(1, 1.2, 0.7), color)
	elseif shape == "jar" then
		base = newPart(Vector3.new(0.9, 0.9, 0.9), color, Enum.PartType.Cylinder)
		base.CFrame = UPRIGHT
	elseif shape == "bowl" then
		base = newPart(Vector3.new(0.6, 1.5, 1.5), Color3.fromRGB(250, 250, 250), Enum.PartType.Cylinder)
		base.CFrame = UPRIGHT
		local content = newPart(Vector3.new(0.15, 1.2, 1.2), color, Enum.PartType.Cylinder)
		content.CFrame = CFrame.new(0, 0.3, 0) * UPRIGHT
		content.Name = "Content"
		content.Parent = model
	elseif shape == "plate" then
		base = newPart(Vector3.new(0.15, 1.7, 1.7), Color3.fromRGB(250, 250, 250), Enum.PartType.Cylinder)
		base.CFrame = UPRIGHT
		local food = newPart(Vector3.new(0.9, 0.5, 0.9), color)
		food.CFrame = CFrame.new(0, 0.35, 0)
		food.Name = "Food"
		food.Parent = model
	elseif shape == "tank" then
		base = newPart(Vector3.new(1.6, 0.7, 0.7), color, Enum.PartType.Cylinder)
		base.CFrame = UPRIGHT
		local nozzle = newPart(Vector3.new(0.25, 0.5, 0.25), Color3.fromRGB(30, 30, 30))
		nozzle.CFrame = CFrame.new(0.3, 0.95, 0)
		nozzle.Name = "Nozzle"
		nozzle.Parent = model
		local band = newPart(Vector3.new(0.3, 0.75, 0.75), Color3.fromRGB(240, 240, 240), Enum.PartType.Cylinder)
		band.CFrame = CFrame.new(0, 0.2, 0) * UPRIGHT
		band.Name = "Band"
		band.Parent = model
	else -- lump
		base = newPart(Vector3.new(0.9, 0.6, 0.9), color)
	end
	base.Name = "Handle"
	base.Parent = model
	model.PrimaryPart = base
	for _, p in model:GetChildren() do
		if p ~= base and p:IsA("BasePart") then
			local weld = Instance.new("WeldConstraint")
			weld.Part0 = base
			weld.Part1 = p
			weld.Parent = p
		end
	end
	model.WorldPivot = CFrame.new()
	if item.kind == "burnt" then
		local smoke = Instance.new("Smoke")
		smoke.Size = 0.4
		smoke.Opacity = 0.35
		smoke.RiseVelocity = 2
		smoke.Color = Color3.fromRGB(40, 40, 40)
		smoke.Parent = base
	end
	if item.kind == "dish" then
		-- 완성 요리는 은은한 김
		local steam = Instance.new("ParticleEmitter")
		steam.Rate = 3
		steam.Lifetime = NumberRange.new(0.8, 1.4)
		steam.Speed = NumberRange.new(1, 1.6)
		steam.Size = NumberSequence.new(0.35, 0.9)
		steam.Transparency = NumberSequence.new(0.6, 1)
		steam.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255))
		steam.LightEmission = 0.3
		steam.SpreadAngle = Vector2.new(15, 15)
		steam.Parent = base
	end
	return model
end

-- 고정해서 보여주기 (조리대 위 등)
function ItemVisuals.display(itemId: string, cframe: CFrame, parent: Instance): Model
	local model = ItemVisuals.build(itemId)
	for _, p in model:GetChildren() do
		if p:IsA("BasePart") then
			p.Anchored = true
		end
	end
	model:PivotTo(cframe)
	model.Parent = parent
	return model
end

return ItemVisuals
