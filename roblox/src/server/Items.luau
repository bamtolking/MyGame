--!nonstrict
-- 재료·요리의 모양(파츠 조립)과 플레이어 손에 들리는 Tool 관리.
-- 규칙: 플레이어는 한 번에 한 가지만 들 수 있고, Backpack UI 는 클라이언트에서 숨깁니다.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Recipes = require(ReplicatedStorage.GhostDiner.Recipes)

local Items = {}

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

-- 아이템 모양을 만들어 Model 로 돌려줌. PrimaryPart(Handle) 중심이 원점.
function Items.buildVisual(itemId: string): Model
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
	-- 회전한 파츠(세운 실린더 등)가 PivotTo 뒤에도 방향을 유지하도록 기준점을 회전 없는 원점으로
	model.WorldPivot = CFrame.new()
	if item.kind == "burnt" then
		local smoke = Instance.new("Smoke")
		smoke.Size = 0.4
		smoke.Opacity = 0.35
		smoke.RiseVelocity = 2
		smoke.Color = Color3.fromRGB(40, 40, 40)
		smoke.Parent = base
	end
	return model
end

-- 조리대 위 등에 고정해서 보여주는 모양
function Items.display(itemId: string, cframe: CFrame, parent: Instance): Model
	local model = Items.buildVisual(itemId)
	for _, p in model:GetChildren() do
		if p:IsA("BasePart") then
			p.Anchored = true
		end
	end
	model:PivotTo(cframe)
	model.Parent = parent
	return model
end

local function findTool(player: Player): Tool?
	local character = player.Character
	if character then
		local tool = character:FindFirstChildOfClass("Tool")
		if tool then
			return tool
		end
	end
	local backpack = player:FindFirstChildOfClass("Backpack")
	if backpack then
		local tool = backpack:FindFirstChildOfClass("Tool")
		if tool then
			-- 어떤 이유로 손에서 내려놨다면 다시 들게 함
			local humanoid = character and character:FindFirstChildOfClass("Humanoid")
			if humanoid then
				humanoid:EquipTool(tool)
			end
			return tool
		end
	end
	return nil
end

function Items.getHeldId(player: Player): string?
	local tool = findTool(player)
	if tool then
		return tool:GetAttribute("ItemId")
	end
	return nil
end

-- 손에 아이템을 쥐여 줌. 이미 들고 있으면 실패.
function Items.give(player: Player, itemId: string): boolean
	local character = player.Character
	if not character then
		return false
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return false
	end
	if findTool(player) then
		return false
	end
	local tool = Instance.new("Tool")
	tool.Name = Recipes.name(itemId)
	tool.ToolTip = Recipes.name(itemId)
	tool.RequiresHandle = true
	tool.CanBeDropped = false
	tool.ManualActivationOnly = true
	tool:SetAttribute("ItemId", itemId)
	local visual = Items.buildVisual(itemId)
	for _, p in visual:GetChildren() do
		p.Parent = tool
	end
	visual:Destroy()
	local item = Recipes.Items[itemId]
	local shape = item and item.shape or "lump"
	if shape == "jar" or shape == "bowl" or shape == "plate" then
		-- 세운 실린더(축이 X)를 손에서도 위로 향하게
		tool.Grip = CFrame.new(0, -0.1, 0) * CFrame.Angles(0, 0, math.rad(90))
	else
		tool.Grip = CFrame.new(0, -0.1, 0)
	end
	tool.Parent = character -- 캐릭터에 넣으면 바로 손에 듦
	return true
end

-- 손에 든 것을 없애고 그 id 를 돌려줌
function Items.take(player: Player): string?
	local tool = findTool(player)
	if not tool then
		return nil
	end
	local id = tool:GetAttribute("ItemId")
	tool:Destroy()
	return id
end

-- 손에 든 것을 다른 아이템으로 바꿈 (썰기 등)
function Items.replace(player: Player, itemId: string): boolean
	Items.take(player)
	return Items.give(player, itemId)
end

function Items.clearAll()
	for _, player in Players:GetPlayers() do
		local character = player.Character
		if character then
			for _, tool in character:GetChildren() do
				if tool:IsA("Tool") then
					tool:Destroy()
				end
			end
		end
		local backpack = player:FindFirstChildOfClass("Backpack")
		if backpack then
			backpack:ClearAllChildren()
		end
	end
end

return Items
