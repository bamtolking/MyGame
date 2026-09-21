--!nonstrict
-- 조리대 동작: 재료 상자 / 도마 / 조리대(합치기) / 냄비·화덕·튀김기·밥솥 / 쓰레기통 / 소화기함.
-- 화재: 탄 음식을 방치하면 불이 나고 옆 조리대로 번집니다. 소화기를 들고 E 를 길게 눌러 끕니다.
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
local FLAME_COOKERS = { pot = true, griddle = true, fryer = true }
local BURNABLE = { board = true, combine = true, pot = true, griddle = true, fryer = true, ricecooker = true }
local UNLOCK_BY_UPGRADE = { pot = "pot", griddle = "griddle", fryer = "fryer", ricecooker = "ricecooker" }
local callbacks: { [string]: any } = {} -- onBurnt(spec) / onFire(spec, reason) / onSpread(from, to) / onExtinguish(spec, player) / isNight()

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

local function clearContents(spec)
	spec.state = "idle"
	spec.item = nil
	spec.output = nil
	spec.startAt = nil
	spec.doneAt = nil
	spec.burnAt = nil
	spec.burntAt = nil
	spec.contents = {}
end

local function applyEffects(spec)
	local state = spec.state
	local cooking = state == "cooking" or state == "done"
	if spec.fire then
		if state == "fire" then
			spec.fire.Enabled = true
			spec.fire.Size = 9
			spec.fire.Heat = 12
		elseif cooking and FLAME_COOKERS[spec.kind] then
			spec.fire.Enabled = true
			spec.fire.Size = 4
			spec.fire.Heat = 6
		else
			spec.fire.Enabled = false
		end
	end
	if spec.smoke then
		spec.smoke.Enabled = state == "burnt" or state == "fire"
	end
	if spec.fireLight then
		spec.fireLight.Enabled = state == "fire"
	end
	if spec.readyLight then
		spec.readyLight.Enabled = state == "done"
	end
	if spec.bubbles then
		spec.bubbles.Enabled = state == "cooking"
	end
	if spec.steam then
		spec.steam.Enabled = cooking
	end
	if spec.plate then
		spec.plate.Material = if cooking then Enum.Material.Neon else Enum.Material.Metal
		spec.plate.Color = if cooking then Color3.fromRGB(255, 110, 40) else Color3.fromRGB(30, 30, 30)
	end
end

local function refresh(spec)
	local partRef: BasePart = spec.part
	partRef:SetAttribute("State", spec.state)
	partRef:SetAttribute("Item", spec.item or "")
	partRef:SetAttribute("Contents", table.concat(spec.contents, ","))
	partRef:SetAttribute("StartAt", spec.startAt or 0)
	partRef:SetAttribute("DoneAt", spec.doneAt or 0)
	partRef:SetAttribute("BurnAt", spec.burnAt or 0)
	partRef:SetAttribute("BurntAt", spec.burntAt or 0)
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

	applyEffects(spec)
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

-- ---------- 화재 ----------
local function fireCount(): number
	local n = 0
	for _, spec in specs do
		if spec.state == "fire" then
			n += 1
		end
	end
	return n
end

local function nearestSpreadTarget(spec)
	local best, bestD = nil, nil
	for _, other in specs do
		if other ~= spec and BURNABLE[other.kind] and not other.locked and other.state ~= "fire" then
			local d = (other.baseCFrame.Position - spec.baseCFrame.Position).Magnitude
			if d <= Config.FireSpreadRange and (bestD == nil or d < bestD) then
				best, bestD = other, d
			end
		end
	end
	return best
end

local function ignite(spec, reason: string, fromSpec)
	if spec.state == "fire" or spec.locked then
		return
	end
	clearContents(spec)
	spec.state = "fire"
	spec.fireAt = now()
	spec.nextSpreadAt = now() + Config.FireSpreadInterval
	refresh(spec)
	if reason == "burnt" then
		Remotes.toastAll("🔥 " .. spec.label .. "의 탄 음식에 불이 붙었어요! 소화기함에서 소화기를 가져오세요", "bad")
	else
		Remotes.toastAll("🔥 불이 " .. spec.label .. "(으)로 번졌어요! 평판 -" .. Config.FireSpreadDamage, "bad")
	end
	Remotes.notifyAll({ kind = "fire", position = spec.baseCFrame.Position })
	if callbacks.onFire then
		callbacks.onFire(spec, reason)
	end
	if reason == "spread" and callbacks.onSpread then
		callbacks.onSpread(fromSpec, spec)
	end
end

local function extinguish(spec, player: Player)
	clearContents(spec)
	spec.fireAt = nil
	spec.nextSpreadAt = nil
	refresh(spec)
	if spec.puff then
		spec.puff:Emit(30)
	end
	Remotes.soundAll("extinguish")
	toast(player, "불을 껐어요! 👍", "good")
	if callbacks.onExtinguish then
		callbacks.onExtinguish(spec, player)
	end
end

-- ---------- 상호작용 ----------
local function onCrate(spec, player: Player, held: string?)
	if held then
		toast(player, "손이 비어 있어야 재료를 꺼낼 수 있어요")
		return
	end
	if Items.give(player, spec.crateItem) then
		Remotes.sound(player, "pick")
	end
end

local function onBoard(spec, player: Player, held: string?)
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

local function onCombine(spec, player: Player, held: string?)
	if held then
		if held == "burnt" then
			toast(player, "탄 음식은 쓰레기통에 버리세요")
			return
		end
		if held == "extinguisher" then
			toast(player, "소화기는 소화기함에 돌려놓으세요")
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
			Remotes.notifyAll({ kind = "sparkle", position = spec.baseCFrame.Position + Vector3.new(0, 3.5, 0), color = "green" })
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

local function onCooker(spec, player: Player, held: string?)
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
			clearContents(spec)
			refresh(spec)
		end
	end
end

local function onTrash(spec, player: Player, held: string?)
	if held then
		Items.take(player)
		Remotes.sound(player, "trash")
	else
		toast(player, "버릴 것이 없어요")
	end
end

local function onExtinguisherBox(spec, player: Player, held: string?)
	if not held then
		if Items.give(player, "extinguisher") then
			Remotes.sound(player, "pick")
			toast(player, "🧯 소화기를 들었어요. 불난 조리대 앞에서 E를 길게 누르세요")
		end
	elseif held == "extinguisher" then
		Items.take(player)
		Remotes.sound(player, "put")
	else
		toast(player, "손을 비우고 소화기를 꺼내세요")
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
	local held = Items.getHeldId(player)
	if spec.state == "fire" then
		if held == "extinguisher" then
			extinguish(spec, player)
		else
			toast(player, "🔥 불이 났어요! 소화기함에서 소화기를 가져오세요", "bad")
		end
		return
	end
	if spec.kind == "crate" then
		onCrate(spec, player, held)
	elseif spec.kind == "board" then
		onBoard(spec, player, held)
	elseif spec.kind == "combine" then
		onCombine(spec, player, held)
	elseif COOKERS[spec.kind] then
		onCooker(spec, player, held)
	elseif spec.kind == "trash" then
		onTrash(spec, player, held)
	elseif spec.kind == "extinguisher" then
		onExtinguisherBox(spec, player, held)
	end
end

-- ---------- 설정 ----------
local function fxPart(spec, offset: Vector3, name: string): Part
	local fx = Instance.new("Part")
	fx.Name = name
	fx.Size = Vector3.new(1, 1, 1)
	fx.Transparency = 1
	fx.Anchored = true
	fx.CanCollide = false
	fx.CanQuery = false
	fx.CanTouch = false
	fx.CFrame = CFrame.new(spec.baseCFrame.Position + offset)
	fx.Parent = spec.part
	return fx
end

local function setup(spec)
	clearContents(spec)
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

	if BURNABLE[spec.kind] then
		local fx = fxPart(spec, Vector3.new(0, if COOKERS[spec.kind] then 1.7 else 1.6, 0), "Burner")
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
		local fireLight = Instance.new("PointLight")
		fireLight.Color = Color3.fromRGB(255, 120, 40)
		fireLight.Range = 16
		fireLight.Brightness = 2.5
		fireLight.Enabled = false
		fireLight.Parent = fx
		spec.fireLight = fireLight
		local puff = Instance.new("ParticleEmitter")
		puff.Rate = 0
		puff.Lifetime = NumberRange.new(0.6, 1.2)
		puff.Speed = NumberRange.new(4, 8)
		puff.Size = NumberSequence.new(1.6, 0)
		puff.Transparency = NumberSequence.new(0.2, 1)
		puff.Color = ColorSequence.new(Color3.fromRGB(240, 240, 250))
		puff.SpreadAngle = Vector2.new(180, 180)
		puff.Parent = fx
		spec.puff = puff
	end
	if COOKERS[spec.kind] then
		local top = fxPart(spec, Vector3.new(0, if spec.kind == "ricecooker" then 5.4 elseif spec.kind == "pot" then 3.9 else 3.3, 0), "Top")
		local readyLight = Instance.new("PointLight")
		readyLight.Color = Color3.fromRGB(120, 255, 140)
		readyLight.Range = 9
		readyLight.Brightness = 1.5
		readyLight.Enabled = false
		readyLight.Parent = top
		spec.readyLight = readyLight
		if spec.kind == "pot" or spec.kind == "fryer" then
			local bubbles = Instance.new("ParticleEmitter")
			bubbles.Rate = 14
			bubbles.Lifetime = NumberRange.new(0.5, 0.9)
			bubbles.Speed = NumberRange.new(1, 2.2)
			bubbles.Size = NumberSequence.new(0.28, 0.1)
			bubbles.Transparency = NumberSequence.new(0.2, 1)
			bubbles.Color = ColorSequence.new(if spec.kind == "pot" then Color3.fromRGB(255, 255, 255) else Color3.fromRGB(255, 230, 150))
			bubbles.LightEmission = 0.3
			bubbles.SpreadAngle = Vector2.new(25, 25)
			bubbles.Enabled = false
			bubbles.Parent = top
			spec.bubbles = bubbles
		elseif spec.kind == "ricecooker" then
			local steam = Instance.new("Smoke")
			steam.Size = 0.6
			steam.Opacity = 0.25
			steam.RiseVelocity = 3
			steam.Color = Color3.fromRGB(240, 240, 240)
			steam.Enabled = false
			steam.Parent = top
			spec.steam = steam
		elseif spec.kind == "griddle" then
			spec.plate = partRef:FindFirstChild("Plate")
		end
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
				spec.burntAt = t
				Remotes.toastAll(string.format("💀 %s의 %s이(가) 탔어요! %d초 안에 꺼내지 않으면 불이 납니다", spec.label, Recipes.name(spec.output or ""), Config.FireDelay), "bad")
				Remotes.soundAll("burn")
				refresh(spec)
				if callbacks.onBurnt then
					callbacks.onBurnt(spec)
				end
			elseif spec.state == "burnt" and spec.burntAt and t >= spec.burntAt + Config.FireDelay then
				ignite(spec, "burnt", nil)
			end
		end
		if spec.state == "fire" and spec.nextSpreadAt and t >= spec.nextSpreadAt then
			spec.nextSpreadAt = t + Config.FireSpreadInterval
			local isNight = callbacks.isNight == nil or callbacks.isNight()
			if isNight and fireCount() < Config.MaxFires then
				local target = nearestSpreadTarget(spec)
				if target then
					ignite(target, "spread", spec)
				end
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

function Stations.setCallbacks(t)
	callbacks = t or {}
end

-- 한 판 시작 상태로 되돌림
function Stations.reset()
	for _, spec in specs do
		clearContents(spec)
		spec.fireAt = nil
		spec.nextSpreadAt = nil
		spec.targeted = false
		spec.locked = spec.baseLocked
		if spec.smashed then
			restore(spec)
		end
		for _, p in spec.part:GetDescendants() do
			if p:IsA("BasePart") and p.Name ~= "Burner" and p.Name ~= "Top" then
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
							if p:IsA("BasePart") and p.Name ~= "Burner" and p.Name ~= "Top" then
								p.Transparency = if p.Name == "Oil" then 0.2 else 0
							end
						end
						Remotes.soundAll("unlock")
						Remotes.notifyAll({ kind = "sparkle", position = spec.baseCFrame.Position + Vector3.new(0, 3.5, 0), color = "gold" })
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
		if BURNABLE[spec.kind] and not spec.locked and not spec.smashed and not spec.targeted and spec.state ~= "fire" then
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
	clearContents(spec)
	spec.fireAt = nil
	spec.nextSpreadAt = nil
	spec.part.CFrame = spec.baseCFrame * CFrame.Angles(0, 0, math.rad(14))
	spec.dust.Enabled = true
	spec.dust:Emit(30)
	Remotes.soundAll("smash")
	Remotes.notifyAll({ kind = "smash", position = spec.baseCFrame.Position })
	refresh(spec)
end

function Stations.untarget(spec)
	spec.targeted = false
end

function Stations.fireCount(): number
	return fireCount()
end

function Stations.all()
	return specs
end

return Stations
