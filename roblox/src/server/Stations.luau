--!nonstrict
-- 조리대 동작: 재료 상자 / 도마 / 조리대(합치기) / 냄비·화덕·튀김기·밥솥 / 쓰레기통.
-- 상태는 파츠 Attribute 로 복제되고, 클라이언트가 그걸 읽어 진행 바와 라벨을 그립니다.
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.GhostDiner.Config)
local Recipes = require(ReplicatedStorage.GhostDiner.Recipes)
local Upgrades = require(ReplicatedStorage.GhostDiner.Upgrades)
local GameState = require(script.Parent.GameState)
local Items = require(script.Parent.Items)
local Remotes = require(script.Parent.Remotes)

local Stations = {}

local specs = {} -- MapBuilder.StationSpec + 런타임 필드
local byKind: { [string]: { any } } = {}
local COOKERS = { pot = true, griddle = true, fryer = true, ricecooker = true }
local SMASHABLE = { board = true, combine = true, pot = true, griddle = true, fryer = true, ricecooker = true }
local UNLOCK_BY_UPGRADE = { pot = "pot", griddle = "griddle", fryer = "fryer", ricecooker = "ricecooker" }

local function now(): number
	return workspace:GetServerTimeNow()
end

local function chopTime(): number
	return Config.ChopTime * Upgrades.chopMult(GameState.level("knife"))
end

local function clearDisplays(spec)
	for _, m in spec.displays do
		m:Destroy()
	end
	spec.displays = {}
end

local function refresh(spec)
	local partRef: BasePart = spec.part
	partRef:SetAttribute("State", spec.state)
	partRef:SetAttribute("Item", spec.item or "")
	partRef:SetAttribute("Contents", table.concat(spec.contents, ","))
	partRef:SetAttribute("StartAt", spec.startAt or 0)
	partRef:SetAttribute("DoneAt", spec.doneAt or 0)
	partRef:SetAttribute("BurnAt", spec.burnAt or 0)
	partRef:SetAttribute("Locked", spec.locked)
	partRef:SetAttribute("Smashed", spec.smashed)
	partRef:SetAttribute("ChopTime", chopTime())

	clearDisplays(spec)
	local base = spec.baseCFrame.Position
	if spec.kind == "combine" then
		local n = #spec.contents
		for i, itemId in spec.contents do
			local x = (i - (n + 1) / 2) * 1.4
			table.insert(spec.displays, Items.display(itemId, CFrame.new(base + spec.displayOffset + Vector3.new(x, 0, 0)), partRef))
		end
	elseif spec.item and spec.item ~= "" then
		table.insert(spec.displays, Items.display(spec.item, CFrame.new(base + spec.displayOffset), partRef))
	end

	if spec.fire then
		spec.fire.Enabled = spec.state == "cooking" or spec.state == "done"
	end
	if spec.smoke then
		spec.smoke.Enabled = spec.state == "burnt"
	end
	if spec.prompt then
		spec.prompt.Enabled = (not spec.locked) and (not spec.smashed)
		if spec.kind == "board" then
			spec.prompt.HoldDuration = chopTime()
		end
	end
end

local function toast(player: Player, text: string, style: string?)
	Remotes.toast(player, text, style or "info")
end

local function onCrate(spec, player: Player)
	if Items.getHeldId(player) then
		toast(player, "손이 비어 있어야 재료를 꺼낼 수 있어요")
		return
	end
	if Items.give(player, spec.crateItem) then
		Remotes.sound(player, "pick")
	end
end

local function onBoard(spec, player: Player)
	local held = Items.getHeldId(player)
	if not held then
		toast(player, "썰 재료를 들고 오세요 (야채)")
		return
	end
	local item = Recipes.Items[held]
	if not item or not item.chopTo then
		toast(player, Recipes.name(held) .. "은(는) 썰 수 없어요")
		return
	end
	Items.replace(player, item.chopTo)
	Remotes.sound(player, "chop")
end

local function onCombine(spec, player: Player)
	local held = Items.getHeldId(player)
	if held then
		if held == "burnt" then
			toast(player, "탄 음식은 쓰레기통에 버리세요")
			return
		end
		if #spec.contents >= Config.CombineSlots then
			toast(player, "조리대가 가득 찼어요 (빈손으로 E: 집기)")
			return
		end
		Items.take(player)
		table.insert(spec.contents, held)
		local combo = Recipes.findCombo(spec.contents)
		if combo then
			spec.contents = { combo.output }
			Remotes.sound(player, "combine")
			toast(player, Recipes.name(combo.output) .. " 완성!", "good")
		else
			Remotes.sound(player, "put")
		end
		refresh(spec)
	else
		if #spec.contents == 0 then
			toast(player, "조리대가 비어 있어요. 재료를 들고 와서 올리세요")
			return
		end
		local itemId = table.remove(spec.contents)
		Items.give(player, itemId)
		Remotes.sound(player, "pick")
		refresh(spec)
	end
end

local function onCooker(spec, player: Player)
	local held = Items.getHeldId(player)
	if spec.state == "idle" then
		if not held then
			toast(player, "익힐 재료를 들고 오세요")
			return
		end
		local cook = Recipes.cookFor(held, spec.kind)
		if not cook then
			toast(player, Recipes.name(held) .. "은(는) " .. spec.label .. "에 넣을 수 없어요")
			return
		end
		Items.take(player)
		local t = now()
		spec.state = "cooking"
		spec.item = held
		spec.output = cook.output
		spec.startAt = t
		spec.doneAt = t + cook.time * Upgrades.cookMult(GameState.level("fire"))
		spec.burnAt = if cook.noBurn then nil else spec.doneAt + Config.BurnDelay
		Remotes.sound(player, "sizzle")
		refresh(spec)
	elseif spec.state == "cooking" then
		toast(player, "아직 익는 중이에요")
	else -- done / burnt
		if held then
			toast(player, "손을 비우고 꺼내세요")
			return
		end
		local out = if spec.state == "burnt" then "burnt" else spec.output
		if Items.give(player, out) then
			Remotes.sound(player, "pick")
			spec.state = "idle"
			spec.item = nil
			spec.output = nil
			spec.startAt = nil
			spec.doneAt = nil
			spec.burnAt = nil
			refresh(spec)
		end
	end
end

local function onTrash(spec, player: Player)
	local held = Items.take(player)
	if held then
		Remotes.sound(player, "trash")
	else
		toast(player, "버릴 것이 없어요")
	end
end

local function onTriggered(spec, player: Player)
	if spec.locked or spec.smashed then
		return
	end
	if GameState.phase == "lobby" or GameState.phase == "gameover" then
		toast(player, "잠시 후 영업을 시작합니다")
		return
	end
	if spec.kind == "crate" then
		onCrate(spec, player)
	elseif spec.kind == "board" then
		onBoard(spec, player)
	elseif spec.kind == "combine" then
		onCombine(spec, player)
	elseif COOKERS[spec.kind] then
		onCooker(spec, player)
	elseif spec.kind == "trash" then
		onTrash(spec, player)
	end
end

local function setup(spec)
	spec.state = "idle"
	spec.item = nil
	spec.contents = {}
	spec.displays = {}
	spec.smashed = false
	spec.smashedUntil = nil
	spec.baseLocked = spec.locked

	local partRef: BasePart = spec.part
	partRef:SetAttribute("Kind", spec.kind)
	partRef:SetAttribute("Label", spec.label)
	partRef:SetAttribute("Index", spec.index)
	partRef:SetAttribute("CrateItem", spec.crateItem or "")

	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Prompt"
	prompt.ObjectText = spec.label
	prompt.ActionText = "사용"
	prompt.MaxActivationDistance = Config.StationDistance
	prompt.RequiresLineOfSight = false
	prompt.HoldDuration = if spec.kind == "board" then chopTime() else 0
	prompt.Parent = partRef
	prompt.Triggered:Connect(function(player)
		onTriggered(spec, player)
	end)
	spec.prompt = prompt

	if spec.kind == "pot" or spec.kind == "griddle" or spec.kind == "fryer" then
		local fx = Instance.new("Part")
		fx.Name = "Burner"
		fx.Size = Vector3.new(1, 1, 1)
		fx.Transparency = 1
		fx.Anchored = true
		fx.CanCollide = false
		fx.CanQuery = false
		fx.CanTouch = false
		fx.CFrame = CFrame.new(spec.baseCFrame.Position + Vector3.new(0, 1.7, 0))
		fx.Parent = partRef
		local fire = Instance.new("Fire")
		fire.Size = 4
		fire.Heat = 6
		fire.Enabled = false
		fire.Parent = fx
		spec.fire = fire
		local smoke = Instance.new("Smoke")
		smoke.Size = 1.5
		smoke.Opacity = 0.5
		smoke.RiseVelocity = 4
		smoke.Color = Color3.fromRGB(35, 35, 35)
		smoke.Enabled = false
		smoke.Parent = fx
		spec.smoke = smoke
	elseif spec.kind == "ricecooker" then
		local fx = Instance.new("Part")
		fx.Name = "Steam"
		fx.Size = Vector3.new(1, 1, 1)
		fx.Transparency = 1
		fx.Anchored = true
		fx.CanCollide = false
		fx.CanQuery = false
		fx.CanTouch = false
		fx.CFrame = CFrame.new(spec.baseCFrame.Position + Vector3.new(0, 5.4, 0))
		fx.Parent = partRef
		local smoke = Instance.new("Smoke")
		smoke.Size = 0.6
		smoke.Opacity = 0.25
		smoke.RiseVelocity = 3
		smoke.Color = Color3.fromRGB(240, 240, 240)
		smoke.Enabled = false
		smoke.Parent = fx
		spec.fire = smoke -- 조리 중 표시로 김을 씀
	end

	local dust = Instance.new("ParticleEmitter")
	dust.Name = "SmashFx"
	dust.Rate = 0
	dust.Lifetime = NumberRange.new(0.8, 1.6)
	dust.Speed = NumberRange.new(3, 6)
	dust.Size = NumberSequence.new(1.2, 0)
	dust.Transparency = NumberSequence.new(0.2, 1)
	dust.Color = ColorSequence.new(Color3.fromRGB(60, 40, 70))
	dust.SpreadAngle = Vector2.new(80, 80)
	dust.Enabled = false
	dust.Parent = partRef
	spec.dust = dust

	table.insert(specs, spec)
	byKind[spec.kind] = byKind[spec.kind] or {}
	table.insert(byKind[spec.kind], spec)
	refresh(spec)
end

local function restore(spec)
	spec.smashed = false
	spec.smashedUntil = nil
	spec.part.CFrame = spec.baseCFrame
	spec.dust.Enabled = false
	refresh(spec)
end

local lastTick = 0
local function update()
	local t = now()
	if t - lastTick < 0.1 then
		return
	end
	lastTick = t
	for _, spec in specs do
		if spec.smashed and spec.smashedUntil and t >= spec.smashedUntil then
			restore(spec)
		end
		if COOKERS[spec.kind] then
			if spec.state == "cooking" and spec.doneAt and t >= spec.doneAt then
				spec.state = "done"
				spec.item = spec.output
				Remotes.soundAll("ding")
				refresh(spec)
			elseif spec.state == "done" and spec.burnAt and t >= spec.burnAt then
				spec.state = "burnt"
				spec.item = "burnt"
				Remotes.toastAll(spec.label .. "의 " .. Recipes.name(spec.output) .. "이(가) 탔어요! 쓰레기통에 버리세요", "bad")
				Remotes.soundAll("burn")
				refresh(spec)
			end
		end
	end
end

function Stations.init(map)
	for _, spec in map.stations do
		setup(spec)
	end
	RunService.Heartbeat:Connect(update)
end

-- 한 판 시작 상태로 되돌림
function Stations.reset()
	for _, spec in specs do
		spec.state = "idle"
		spec.item = nil
		spec.output = nil
		spec.startAt = nil
		spec.doneAt = nil
		spec.burnAt = nil
		spec.contents = {}
		spec.locked = spec.baseLocked
		if spec.smashed then
			restore(spec)
		end
		for _, p in spec.part:GetDescendants() do
			if p:IsA("BasePart") and p.Name ~= "Burner" and p.Name ~= "Steam" then
				p.Transparency = if spec.locked then 0.6 else (if p.Name == "Oil" then 0.2 else 0)
			end
		end
		spec.part.Transparency = if spec.locked then 0.6 else 0
		refresh(spec)
	end
end

-- 업그레이드 단계에 맞춰 잠긴 조리대를 엶
function Stations.applyUpgrades()
	for kind, upgradeId in UNLOCK_BY_UPGRADE do
		local level = GameState.level(upgradeId)
		local unlockedExtra = 0
		local list = byKind[kind] or {}
		for _, spec in list do
			if spec.baseLocked then
				if unlockedExtra < level then
					unlockedExtra += 1
					if spec.locked then
						spec.locked = false
						spec.part.Transparency = 0
						for _, p in spec.part:GetDescendants() do
							if p:IsA("BasePart") and p.Name ~= "Burner" and p.Name ~= "Steam" then
								p.Transparency = if p.Name == "Oil" then 0.2 else 0
							end
						end
						Remotes.soundAll("unlock")
					end
				end
			end
		end
	end
	for _, spec in specs do
		refresh(spec)
	end
end

-- 악귀가 부술 조리대를 고름
function Stations.pickSmashTarget(rng: Random)
	local candidates = {}
	for _, spec in specs do
		if SMASHABLE[spec.kind] and not spec.locked and not spec.smashed and not spec.targeted then
			table.insert(candidates, spec)
		end
	end
	if #candidates == 0 then
		return nil
	end
	local spec = candidates[rng:NextInteger(1, #candidates)]
	spec.targeted = true
	return spec
end

function Stations.smash(spec)
	spec.targeted = false
	if spec.locked then
		return
	end
	spec.smashed = true
	spec.smashedUntil = now() + Config.SmashDuration
	spec.state = "idle"
	spec.item = nil
	spec.output = nil
	spec.startAt = nil
	spec.doneAt = nil
	spec.burnAt = nil
	spec.contents = {}
	spec.part.CFrame = spec.baseCFrame * CFrame.Angles(0, 0, math.rad(14))
	spec.dust.Enabled = true
	spec.dust:Emit(30)
	Remotes.soundAll("smash")
	refresh(spec)
end

function Stations.untarget(spec)
	spec.targeted = false
end

function Stations.all()
	return specs
end

return Stations
