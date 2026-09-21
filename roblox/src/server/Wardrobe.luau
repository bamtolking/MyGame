--!nonstrict
-- 옷장: 명성으로 해금한 모자를 플레이어 머리에 씌웁니다 (파츠 조립, 에셋 불필요).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Cosmetics = require(ReplicatedStorage.GhostDiner.Cosmetics)
local Data = require(script.Parent.Data)
local Remotes = require(script.Parent.Remotes)

local Wardrobe = {}

local UPRIGHT = CFrame.Angles(0, 0, math.rad(90))

local function newPart(name: string, size: Vector3, color: Color3, shape: Enum.PartType?, material: Enum.Material?): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Shape = shape or Enum.PartType.Block
	p.Material = material or Enum.Material.SmoothPlastic
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	p.CastShadow = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	return p
end

local function attach(model: Model, head: BasePart, p: BasePart, offset: CFrame)
	p.CFrame = head.CFrame * offset
	local weld = Instance.new("Weld")
	weld.Part0 = head
	weld.Part1 = p
	weld.C0 = offset
	weld.Parent = p
	p.Parent = model
end

local WHITE = Color3.fromRGB(250, 250, 250)
local BLACK = Color3.fromRGB(20, 20, 20)

local function buildHat(hatId: string, head: BasePart): Model?
	local model = Instance.new("Model")
	model.Name = "GhostDinerHat"
	local top = head.Size.Y / 2
	if hatId == "paper" then
		attach(model, head, newPart("Hat", Vector3.new(0.9, 1.5, 1.5), WHITE, Enum.PartType.Cylinder), CFrame.new(0, top + 0.4, 0) * UPRIGHT)
		attach(model, head, newPart("Band", Vector3.new(0.14, 1.56, 1.56), Color3.fromRGB(215, 215, 220), Enum.PartType.Cylinder), CFrame.new(0, top + 0.05, 0) * UPRIGHT)
	elseif hatId == "chef" then
		attach(model, head, newPart("Hat", Vector3.new(1.4, 1.35, 1.35), WHITE, Enum.PartType.Cylinder), CFrame.new(0, top + 0.65, 0) * UPRIGHT)
		attach(model, head, newPart("Puff", Vector3.new(1.65, 1.65, 1.65), WHITE, Enum.PartType.Ball), CFrame.new(0, top + 1.55, 0))
		attach(model, head, newPart("Band", Vector3.new(0.16, 1.5, 1.5), Color3.fromRGB(200, 200, 205), Enum.PartType.Cylinder), CFrame.new(0, top + 0.05, 0) * UPRIGHT)
	elseif hatId == "bandana" then
		attach(model, head, newPart("Band", Vector3.new(0.38, 1.45, 1.45), Color3.fromRGB(215, 40, 50), Enum.PartType.Cylinder, Enum.Material.Fabric), CFrame.new(0, top - 0.15, 0) * UPRIGHT)
		attach(model, head, newPart("Knot", Vector3.new(0.5, 0.35, 0.5), Color3.fromRGB(215, 40, 50), nil, Enum.Material.Fabric), CFrame.new(0, top - 0.15, 0.78))
		attach(model, head, newPart("Tail", Vector3.new(0.25, 0.7, 0.2), Color3.fromRGB(190, 30, 40), nil, Enum.Material.Fabric), CFrame.new(0.2, top - 0.5, 0.85) * CFrame.Angles(0, 0, math.rad(-20)))
	elseif hatId == "gat" then
		local brim = newPart("Brim", Vector3.new(0.1, 2.8, 2.8), BLACK, Enum.PartType.Cylinder)
		brim.Transparency = 0.15
		attach(model, head, brim, CFrame.new(0, top + 0.05, 0) * UPRIGHT)
		local crown = newPart("Crown", Vector3.new(1.1, 1.5, 1.5), BLACK, Enum.PartType.Cylinder)
		crown.Transparency = 0.15
		attach(model, head, crown, CFrame.new(0, top + 0.6, 0) * UPRIGHT)
	elseif hatId == "horn" then
		attach(model, head, newPart("Band", Vector3.new(0.3, 1.45, 1.45), Color3.fromRGB(70, 150, 80), Enum.PartType.Cylinder), CFrame.new(0, top - 0.1, 0) * UPRIGHT)
		attach(model, head, newPart("Horn", Vector3.new(0.9, 0.42, 0.42), Color3.fromRGB(240, 210, 120), Enum.PartType.Cylinder), CFrame.new(0, top + 0.5, 0) * UPRIGHT)
		attach(model, head, newPart("Tip", Vector3.new(0.3, 0.3, 0.3), Color3.fromRGB(250, 235, 170), Enum.PartType.Ball), CFrame.new(0, top + 0.98, 0))
	elseif hatId == "tigerears" then
		for _, x in { -0.55, 0.55 } do
			attach(model, head, newPart("Ear", Vector3.new(0.7, 0.7, 0.7), Color3.fromRGB(235, 150, 40), Enum.PartType.Ball), CFrame.new(x, top + 0.2, 0))
			attach(model, head, newPart("Inner", Vector3.new(0.36, 0.36, 0.36), Color3.fromRGB(40, 30, 30), Enum.PartType.Ball), CFrame.new(x, top + 0.22, -0.22))
		end
	elseif hatId == "halo" then
		local ring = newPart("Halo", Vector3.new(0.12, 1.7, 1.7), Color3.fromRGB(255, 235, 120), Enum.PartType.Cylinder, Enum.Material.Neon)
		ring.Transparency = 0.25
		attach(model, head, ring, CFrame.new(0, top + 1.0, 0) * UPRIGHT)
		local light = Instance.new("PointLight")
		light.Color = Color3.fromRGB(255, 235, 150)
		light.Range = 10
		light.Brightness = 1.2
		light.Parent = ring
		local sparkle = Instance.new("ParticleEmitter")
		sparkle.Rate = 6
		sparkle.Lifetime = NumberRange.new(0.6, 1.2)
		sparkle.Speed = NumberRange.new(0.5, 1.5)
		sparkle.Size = NumberSequence.new(0.25, 0)
		sparkle.Color = ColorSequence.new(Color3.fromRGB(255, 240, 170))
		sparkle.LightEmission = 1
		sparkle.SpreadAngle = Vector2.new(180, 180)
		sparkle.Parent = ring
	elseif hatId == "crown" then
		attach(model, head, newPart("Band", Vector3.new(0.55, 1.45, 1.45), Color3.fromRGB(255, 200, 60), Enum.PartType.Cylinder, Enum.Material.Metal), CFrame.new(0, top + 0.2, 0) * UPRIGHT)
		for i = 0, 3 do
			local angle = i * math.pi / 2
			local x, z = math.cos(angle) * 0.62, math.sin(angle) * 0.62
			attach(model, head, newPart("Spike", Vector3.new(0.26, 0.55, 0.26), Color3.fromRGB(255, 200, 60), nil, Enum.Material.Metal), CFrame.new(x, top + 0.7, z))
			attach(model, head, newPart("Gem", Vector3.new(0.26, 0.26, 0.26), Color3.fromRGB(200, 90, 255), Enum.PartType.Ball, Enum.Material.Neon), CFrame.new(x, top + 1.02, z))
		end
		local sparkle = Instance.new("ParticleEmitter")
		sparkle.Rate = 8
		sparkle.Lifetime = NumberRange.new(0.6, 1.4)
		sparkle.Speed = NumberRange.new(0.5, 2)
		sparkle.Size = NumberSequence.new(0.3, 0)
		sparkle.Color = ColorSequence.new(Color3.fromRGB(220, 150, 255))
		sparkle.LightEmission = 1
		sparkle.SpreadAngle = Vector2.new(180, 180)
		sparkle.Parent = model:FindFirstChild("Band")
	else
		model:Destroy()
		return nil
	end
	return model
end

function Wardrobe.equip(player: Player)
	local character = player.Character
	if not character then
		return
	end
	local head = character:FindFirstChild("Head")
	if not head or not head:IsA("BasePart") then
		return
	end
	local old = character:FindFirstChild("GhostDinerHat")
	if old then
		old:Destroy()
	end
	local hatId = Data.getHat(player)
	if hatId == "none" then
		return
	end
	local model = buildHat(hatId, head)
	if model then
		model.Parent = character
	end
end

local function onCharacter(player: Player, character: Model)
	task.spawn(function()
		local head = character:WaitForChild("Head", 15)
		if head then
			task.wait(0.2)
			Wardrobe.equip(player)
		end
	end)
end

function Wardrobe.init()
	Players.PlayerAdded:Connect(function(player)
		player.CharacterAdded:Connect(function(character)
			onCharacter(player, character)
		end)
	end)
	for _, player in Players:GetPlayers() do
		player.CharacterAdded:Connect(function(character)
			onCharacter(player, character)
		end)
		if player.Character then
			onCharacter(player, player.Character)
		end
	end

	Remotes.SetHat.OnServerInvoke = function(player, hatId)
		if type(hatId) ~= "string" then
			return false, "잘못된 요청"
		end
		local hat = Cosmetics.get(hatId)
		if not hat then
			return false, "없는 모자"
		end
		if not Cosmetics.isUnlocked(hatId, Data.getFame(player)) then
			return false, string.format("명성 %d이 필요해요", hat.fame)
		end
		Data.setHat(player, hatId)
		Wardrobe.equip(player)
		Remotes.sound(player, "hat")
		return true, hat.name .. " 착용!"
	end
end

return Wardrobe
