--!nonstrict
-- 플레이어 손에 들리는 Tool 관리. 모양은 shared/ItemVisuals 가 만듭니다.
-- 규칙: 플레이어는 한 번에 한 가지만 들 수 있고, Backpack UI 는 클라이언트에서 숨깁니다.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Recipes = require(ReplicatedStorage.GhostDiner.Recipes)
local ItemVisuals = require(ReplicatedStorage.GhostDiner.ItemVisuals)

local Items = {}

Items.buildVisual = ItemVisuals.build
Items.display = ItemVisuals.display

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
	local visual = ItemVisuals.build(itemId)
	for _, p in visual:GetChildren() do
		p.Parent = tool
	end
	visual:Destroy()
	local item = Recipes.Items[itemId]
	local shape = if item then item.shape else "lump"
	if ItemVisuals.UPRIGHT_SHAPES[shape] then
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
