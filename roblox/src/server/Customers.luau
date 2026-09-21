--!nonstrict
-- 손님(귀신·요괴) NPC: 파츠로 몸을 조립하고 Humanoid 로 걷게 하며, 인내심·서빙·난동을 처리합니다.
-- 손님은 "Customers" 충돌 그룹이라 카운터·조리대·플레이어를 통과합니다 (귀신이니까요).
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.GhostDiner.Config)
local Recipes = require(ReplicatedStorage.GhostDiner.Recipes)
local CustomerTypes = require(ReplicatedStorage.GhostDiner.CustomerTypes)
local Waves = require(ReplicatedStorage.GhostDiner.Waves)
local Upgrades = require(ReplicatedStorage.GhostDiner.Upgrades)
local GameState = require(script.Parent.GameState)
local Items = require(script.Parent.Items)
local Remotes = require(script.Parent.Remotes)
local Stations = require(script.Parent.Stations)

local Customers = {}

local map
local deps
local active = {} -- 살아 있는 손님 목록
local slots: { [number]: any } = {}
local queue: { [number]: any } = {}
local seq = 0
local rng = Random.new()

local function now(): number
	return workspace:GetServerTimeNow()
end

local function flat(v: Vector3): Vector3
	return Vector3.new(v.X, 0, v.Z)
end

local function rgb(c: { number }): Color3
	return Color3.fromRGB(c[1], c[2], c[3])
end

local function newPart(name: string, size: Vector3, color: Color3, shape: Enum.PartType?): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Shape = shape or Enum.PartType.Block
	p.Material = Enum.Material.SmoothPlastic
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	return p
end

local function weldTo(root: BasePart, p: BasePart, offset: CFrame, weldName: string?)
	p.CFrame = root.CFrame * offset
	local w = Instance.new("Weld")
	w.Name = weldName or "Weld"
	w.Part0 = root
	w.Part1 = p
	w.C0 = offset
	w.Parent = p
end

-- 손님 외형 조립
local function buildRig(ctype)
	local look = ctype.look
	local s = look.scale
	local model = Instance.new("Model")
	model.Name = ctype.name

	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = Vector3.new(2, 2, 1) * s
	root.Transparency = 1
	root.CanCollide = true
	root.CanTouch = false
	root.CanQuery = true
	root.CollisionGroup = "Customers"
	root.Material = Enum.Material.SmoothPlastic
	root.Parent = model

	local bodyColor = rgb(look.body)
	local headColor = rgb(look.head)
	local black = Color3.fromRGB(20, 20, 20)

	local body = newPart("Body", Vector3.new(2.2, 2.6, 1.3) * s, bodyColor)
	weldTo(root, body, CFrame.new(0, 0, 0))
	body.Parent = model

	local head = newPart("Head", Vector3.new(1.9, 1.9, 1.9) * s, headColor, Enum.PartType.Ball)
	weldTo(root, head, CFrame.new(0, 2.3 * s, 0), "Neck")
	head.Parent = model

	for _, x in { -0.38, 0.38 } do
		local eye = newPart("Eye", Vector3.new(0.32, 0.32, 0.32) * s, black, Enum.PartType.Ball)
		weldTo(root, eye, CFrame.new(x * s, 2.45 * s, -0.82 * s))
		eye.Parent = model
	end

	local feature = look.feature
	if feature == "horn" then
		local horn = newPart("Horn", Vector3.new(0.45, 0.9, 0.45) * s, Color3.fromRGB(240, 210, 120))
		weldTo(root, horn, CFrame.new(0, 3.45 * s, 0))
		horn.Parent = model
		local club = newPart("Club", Vector3.new(0.5, 2.2, 0.5) * s, Color3.fromRGB(120, 80, 50), Enum.PartType.Cylinder)
		weldTo(root, club, CFrame.new(1.5 * s, 0.2 * s, -0.4 * s) * CFrame.Angles(0, 0, math.rad(80)))
		club.Parent = model
	elseif feature == "hair" then
		local hair = newPart("Hair", Vector3.new(2.3, 3.4, 0.7) * s, black)
		weldTo(root, hair, CFrame.new(0, 1.9 * s, 0.75 * s))
		hair.Parent = model
		local fringe = newPart("Fringe", Vector3.new(2.1, 1.1, 0.4) * s, black)
		weldTo(root, fringe, CFrame.new(0, 2.95 * s, -0.75 * s))
		fringe.Parent = model
		local tail = newPart("Wisp", Vector3.new(1.6, 1.6, 1.6) * s, bodyColor, Enum.PartType.Ball)
		tail.Transparency = 0.35
		weldTo(root, tail, CFrame.new(0, -1.7 * s, 0))
		tail.Parent = model
	elseif feature == "hat" then
		local brim = newPart("Brim", Vector3.new(0.15, 3.1, 3.1) * s, black, Enum.PartType.Cylinder)
		weldTo(root, brim, CFrame.new(0, 3.25 * s, 0) * CFrame.Angles(0, 0, math.rad(90)))
		brim.Parent = model
		local crown = newPart("Crown", Vector3.new(1.1, 1.7, 1.7) * s, black, Enum.PartType.Cylinder)
		weldTo(root, crown, CFrame.new(0, 3.85 * s, 0) * CFrame.Angles(0, 0, math.rad(90)))
		crown.Parent = model
	elseif feature == "tails" then
		for i, off in { Vector3.new(-0.9, -0.2, 1.1), Vector3.new(0, -0.5, 1.4), Vector3.new(0.9, -0.2, 1.1) } do
			local tail = newPart("Tail" .. i, Vector3.new(0.95, 0.95, 0.95) * s, bodyColor, Enum.PartType.Ball)
			weldTo(root, tail, CFrame.new(off * s))
			tail.Parent = model
			local tip = newPart("TailTip" .. i, Vector3.new(0.5, 0.5, 0.5) * s, Color3.fromRGB(250, 245, 235), Enum.PartType.Ball)
			weldTo(root, tip, CFrame.new((off + Vector3.new(0, 0.45, 0.35)) * s))
			tip.Parent = model
		end
		for _, x in { -0.6, 0.6 } do
			local ear = newPart("Ear", Vector3.new(0.5, 0.8, 0.3) * s, bodyColor)
			weldTo(root, ear, CFrame.new(x * s, 3.35 * s, 0))
			ear.Parent = model
		end
	elseif feature == "stripes" then
		for _, y in { -0.75, 0, 0.75 } do
			local stripe = newPart("Stripe", Vector3.new(2.3, 0.26, 1.4) * s, black)
			weldTo(root, stripe, CFrame.new(0, y * s, 0))
			stripe.Parent = model
		end
		for _, x in { -0.7, 0.7 } do
			local ear = newPart("Ear", Vector3.new(0.6, 0.6, 0.6) * s, bodyColor, Enum.PartType.Ball)
			weldTo(root, ear, CFrame.new(x * s, 3.2 * s, 0))
			ear.Parent = model
		end
	elseif feature == "beard" then
		local beard = newPart("Beard", Vector3.new(1.3, 1.8, 0.45) * s, Color3.fromRGB(250, 250, 250))
		weldTo(root, beard, CFrame.new(0, 1.4 * s, -0.75 * s))
		beard.Parent = model
		local staff = newPart("Staff", Vector3.new(0.3, 5.2, 0.3) * s, Color3.fromRGB(110, 80, 50))
		weldTo(root, staff, CFrame.new(1.5 * s, 0.4 * s, -0.3 * s))
		staff.Parent = model
		local glow = Instance.new("PointLight")
		glow.Color = Color3.fromRGB(255, 240, 200)
		glow.Range = 14
		glow.Brightness = 0.8
		glow.Parent = head
	end

	local humanoid = Instance.new("Humanoid")
	humanoid.RigType = Enum.HumanoidRigType.R15
	humanoid.RequiresNeck = false
	humanoid.HipHeight = look.hover + 0.3 * s
	humanoid.WalkSpeed = ctype.speed
	humanoid.JumpPower = 0
	humanoid.AutoRotate = true
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	humanoid.NameDisplayDistance = 0
	humanoid.BreakJointsOnDeath = false
	for _, state in { Enum.HumanoidStateType.FallingDown, Enum.HumanoidStateType.Ragdoll, Enum.HumanoidStateType.Climbing, Enum.HumanoidStateType.Swimming, Enum.HumanoidStateType.Seated } do
		humanoid:SetStateEnabled(state, false)
	end
	humanoid.Parent = model

	model.PrimaryPart = root
	return model, root, humanoid
end

local function setMood(rec, mood: string)
	rec.model:SetAttribute("Mood", mood)
end

local function setOrdersAttr(rec)
	rec.model:SetAttribute("Orders", table.concat(rec.orders, ","))
end

local function faceFront(rec)
	local pos = rec.root.Position
	rec.root.CFrame = CFrame.lookAt(pos, pos + Vector3.new(0, 0, -1))
end

local function moveTo(rec, pos: Vector3)
	rec.target = pos
	rec.humanoid:MoveTo(pos)
	rec.lastMoveAt = now()
	rec.moveStartAt = now()
end

local function stationApproach(spec): Vector3
	return spec.baseCFrame.Position + Vector3.new(0, 0, 4)
end

local function promote(slotIndex: number)
	local best = nil
	for _, rec in pairs(queue) do
		if best == nil or rec.seq < best.seq then
			best = rec
		end
	end
	if not best then
		return
	end
	queue[best.spot.index] = nil
	slots[slotIndex] = best
	best.spot = { kind = "slot", index = slotIndex }
	best.state = "toSpot"
	setMood(best, "walking")
	moveTo(best, map.slots[slotIndex])
end

local function freeSpot(rec)
	local spot = rec.spot
	rec.spot = nil
	if not spot then
		return
	end
	if spot.kind == "slot" then
		slots[spot.index] = nil
		promote(spot.index)
	else
		queue[spot.index] = nil
	end
end

local function assignSpot(rec): boolean
	for i = 1, Config.Slots do
		if not slots[i] then
			slots[i] = rec
			rec.spot = { kind = "slot", index = i }
			rec.state = "toSpot"
			setMood(rec, "walking")
			moveTo(rec, map.slots[i])
			return true
		end
	end
	for i = 1, Config.QueueSpots do
		if not queue[i] then
			queue[i] = rec
			rec.spot = { kind = "queue", index = i }
			rec.state = "toSpot"
			setMood(rec, "walking")
			moveTo(rec, map.queue[i])
			return true
		end
	end
	return false
end

local function remove(rec)
	local idx = table.find(active, rec)
	if idx then
		table.remove(active, idx)
	end
	if rec.targetStation then
		Stations.untarget(rec.targetStation)
		rec.targetStation = nil
	end
	freeSpot(rec)
	if rec.model then
		rec.model:Destroy()
	end
end

local function resolve(rec)
	if not rec.resolved then
		rec.resolved = true
		deps.onResolved(rec)
	end
end

-- 배불리 먹은 손님은 걸어 나가지 않고 빛과 함께 승천합니다 (성불)
local function startAscension(rec)
	rec.ascendStarted = true
	setMood(rec, "ascend")
	local root = rec.root
	root.Anchored = true
	local glow = Instance.new("PointLight")
	glow.Color = Color3.fromRGB(255, 240, 200)
	glow.Range = 20
	glow.Brightness = 2.5
	glow.Parent = root
	local sparkle = Instance.new("ParticleEmitter")
	sparkle.Rate = 40
	sparkle.Lifetime = NumberRange.new(1, 1.8)
	sparkle.Speed = NumberRange.new(2, 5)
	sparkle.Size = NumberSequence.new(0.6, 0)
	sparkle.Transparency = NumberSequence.new(0, 1)
	sparkle.Color = ColorSequence.new(Color3.fromRGB(255, 235, 160))
	sparkle.LightEmission = 1
	sparkle.SpreadAngle = Vector2.new(180, 180)
	sparkle.Parent = root
	local info = TweenInfo.new(Config.AscendDuration, Enum.EasingStyle.Sine, Enum.EasingDirection.In)
	TweenService:Create(root, info, { CFrame = root.CFrame * CFrame.new(0, 28, 0) * CFrame.Angles(0, math.pi * 0.9, 0) }):Play()
	for _, p in rec.model:GetDescendants() do
		if p:IsA("BasePart") and p ~= root then
			TweenService:Create(p, TweenInfo.new(Config.AscendDuration * 0.9, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Transparency = 1 }):Play()
		end
	end
	Remotes.notifyAll({ kind = "ascend", position = root.Position, name = rec.ctype.name })
end

local function leave(rec, mood: string)
	freeSpot(rec)
	rec.prompt.Enabled = false
	setMood(rec, mood)
	if mood == "happy" then
		rec.state = "ascending"
		rec.ascendAt = now() + 0.9
		rec.removeAt = rec.ascendAt + Config.AscendDuration
		rec.humanoid.WalkSpeed = 0
		resolve(rec)
		if deps.onAscended then
			deps.onAscended(rec)
		end
		return
	end
	rec.state = "leaving"
	rec.humanoid.WalkSpeed = rec.ctype.speed * 1.3
	moveTo(rec, map.exitPoint)
	resolve(rec)
end

local function becomeAngry(rec)
	freeSpot(rec)
	setMood(rec, "angry")
	rec.prompt.Enabled = false
	for _, p in rec.model:GetDescendants() do
		if p:IsA("BasePart") and p.Name ~= "HumanoidRootPart" and p.Name ~= "Eye" then
			p.Color = p.Color:Lerp(Color3.fromRGB(255, 30, 30), 0.65)
		end
	end
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 40, 40)
	light.Range = 16
	light.Brightness = 2
	light.Parent = rec.root
	Remotes.soundAll("angry")
	deps.onAngry(rec, rec.ctype.damage)
	resolve(rec)
	rec.humanoid.WalkSpeed = rec.ctype.speed * 1.4
	local spec = Stations.pickSmashTarget(rng)
	if spec then
		rec.targetStation = spec
		rec.state = "toStation"
		moveTo(rec, stationApproach(spec))
	else
		leave(rec, "angry")
	end
end

local function arrived(rec)
	if rec.state == "toSpot" then
		if rec.spot and rec.spot.kind == "slot" then
			rec.state = "waiting"
			rec.deadlineAt = now() + rec.total
			rec.model:SetAttribute("DeadlineAt", rec.deadlineAt)
			rec.model:SetAttribute("Total", rec.total)
			setMood(rec, "waiting")
			rec.prompt.Enabled = true
			faceFront(rec)
		else
			rec.state = "queued"
			setMood(rec, "queue")
			faceFront(rec)
		end
	elseif rec.state == "toStation" then
		local spec = rec.targetStation
		rec.targetStation = nil
		if spec then
			Stations.smash(spec)
		end
		rec.smashLeft -= 1
		if rec.smashLeft > 0 then
			local nextSpec = Stations.pickSmashTarget(rng)
			if nextSpec then
				rec.targetStation = nextSpec
				moveTo(rec, stationApproach(nextSpec))
				return
			end
		end
		leave(rec, "angry")
	elseif rec.state == "leaving" then
		remove(rec)
	end
end

-- 구미호: 인내심이 절반이 되면 주문 하나를 바꿈 (대신 8초를 더 기다려 줌)
local function changeMind(rec)
	rec.changedMind = true
	local pool = rec.pool or {}
	if #rec.orders == 0 or #pool < 2 then
		return
	end
	local idx = rng:NextInteger(1, #rec.orders)
	local current = rec.orders[idx]
	local choices = {}
	for _, d in pool do
		if d ~= current then
			table.insert(choices, d)
		end
	end
	if #choices == 0 then
		return
	end
	local newDish = choices[rng:NextInteger(1, #choices)]
	rec.orders[idx] = newDish
	setOrdersAttr(rec)
	rec.deadlineAt += 8
	rec.model:SetAttribute("DeadlineAt", rec.deadlineAt)
	rec.model:SetAttribute("Twist", now())
	Remotes.toastAll(string.format("🦊 %s이(가) 마음을 바꿨어요! %s 대신 %s을(를) 원해요", rec.ctype.name, Recipes.name(current), Recipes.name(newDish)), "bad")
	Remotes.soundAll("fox")
end

local lastTick = 0
local function update()
	local t = now()
	if t - lastTick < 0.1 then
		return
	end
	lastTick = t
	for i = #active, 1, -1 do
		local rec = active[i]
		if not rec.model.Parent or not rec.root.Parent then
			remove(rec)
			continue
		end
		if rec.root.Position.Y < -20 and rec.target then
			rec.model:PivotTo(CFrame.new(rec.target + Vector3.new(0, 3, 0)))
		end
		local st = rec.state
		if st == "ascending" then
			if not rec.ascendStarted and t >= rec.ascendAt then
				startAscension(rec)
			end
			if t >= rec.removeAt then
				remove(rec)
			end
			continue
		end
		if st == "toSpot" or st == "toStation" or st == "leaving" then
			local d = (flat(rec.root.Position) - flat(rec.target)).Magnitude
			if d < 2.2 then
				arrived(rec)
			else
				if t - rec.lastMoveAt > 1 then
					rec.humanoid:MoveTo(rec.target)
					rec.lastMoveAt = t
				end
				if t - rec.moveStartAt > 20 then
					-- 어딘가 걸렸으면 목적지로 순간이동 (귀신이니까 가능)
					rec.model:PivotTo(CFrame.new(rec.target + Vector3.new(0, 3, 0)))
					rec.moveStartAt = t
					arrived(rec)
				end
			end
		elseif st == "waiting" then
			if t >= rec.deadlineAt then
				becomeAngry(rec)
			elseif rec.ctype.quirk == "mindChange" and not rec.changedMind and (rec.deadlineAt - t) / rec.total <= 0.5 then
				changeMind(rec)
			end
		end
	end
end

function Customers.tryServe(rec, player: Player)
	if rec.state ~= "waiting" then
		Remotes.toast(player, "아직 주문을 받을 수 없어요")
		return
	end
	local held = Items.getHeldId(player)
	if not held then
		Remotes.toast(player, "손에 요리가 없어요. 주문: " .. Recipes.name(rec.orders[1] or ""))
		return
	end
	local idx = table.find(rec.orders, held)
	if not idx then
		if Recipes.isDish(held) then
			Remotes.toast(player, rec.ctype.name .. "은(는) " .. Recipes.name(held) .. "을(를) 원하지 않아요! (인내심 -" .. Config.WrongDishPenalty .. "초)", "bad")
			rec.deadlineAt -= Config.WrongDishPenalty
			rec.model:SetAttribute("DeadlineAt", rec.deadlineAt)
			Remotes.sound(player, "no")
		else
			Remotes.toast(player, "완성된 요리만 서빙할 수 있어요")
		end
		return
	end
	Items.take(player)
	table.remove(rec.orders, idx)
	local fraction = math.clamp((rec.deadlineAt - now()) / rec.total, 0, 1)
	local base = math.floor(Recipes.price(held) * rec.ctype.rewardMult + 0.5)
	local tip = math.floor(base * Config.TipMax * fraction + 0.5)
	local coins = deps.onServed(rec, player, held, base, tip, fraction)
	local character = player.Character
	local fromPart = character and character:FindFirstChild("HumanoidRootPart")
	local from = if fromPart and fromPart:IsA("BasePart") then fromPart.Position else rec.root.Position
	Remotes.notifyAll({ kind = "serve", from = from, to = rec.root.Position + Vector3.new(0, 2, 0), itemId = held, amount = coins or 0, tip = tip })
	Remotes.soundAll("serve")
	setOrdersAttr(rec)
	if #rec.orders == 0 then
		leave(rec, "happy")
	end
end

function Customers.init(mapInfo, callbacks)
	map = mapInfo
	deps = callbacks
	RunService.Heartbeat:Connect(update)
end

function Customers.spawn(spec, night: number, opts)
	opts = opts or {}
	local ctype = CustomerTypes.get(spec.typeId)
	local model, root, humanoid = buildRig(ctype)
	seq += 1
	local rec = {
		seq = seq,
		typeId = spec.typeId,
		ctype = ctype,
		model = model,
		root = root,
		humanoid = humanoid,
		orders = table.clone(spec.dishes),
		state = "toSpot",
		spot = nil,
		target = map.spawnPoint,
		total = Waves.patienceFor(spec.typeId, night, GameState.level("smile"), Upgrades.patienceMult) * (opts.patienceMult or 1) * (if GameState.hasRelic("smile") then 1.15 else 1),
		pool = opts.pool or Recipes.dishesForNight(night),
		changedMind = false,
		deadlineAt = 0,
		smashLeft = ctype.smash,
		targetStation = nil,
		lastMoveAt = 0,
		moveStartAt = 0,
		resolved = false,
	}

	model:SetAttribute("TypeId", spec.typeId)
	model:SetAttribute("DisplayName", ctype.name)
	model:SetAttribute("Mood", "walking")
	model:SetAttribute("DeadlineAt", 0)
	model:SetAttribute("Total", rec.total)
	model:SetAttribute("Boss", ctype.boss == true)
	if ctype.lines and #ctype.lines > 0 then
		model:SetAttribute("Line", ctype.lines[rng:NextInteger(1, #ctype.lines)])
	end
	setOrdersAttr(rec)
	root:SetAttribute("Kind", "customer")

	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "ServePrompt"
	prompt.ObjectText = ctype.name
	prompt.ActionText = "서빙"
	prompt.MaxActivationDistance = Config.ServeDistance
	prompt.RequiresLineOfSight = false
	prompt.Enabled = false
	prompt.Parent = root
	prompt.Triggered:Connect(function(player)
		Customers.tryServe(rec, player)
	end)
	rec.prompt = prompt

	model:PivotTo(CFrame.lookAt(map.spawnPoint, map.spawnPoint + Vector3.new(0, 0, -1)))
	model.Parent = map.customersFolder
	humanoid.HipHeight = ctype.look.hover + 0.3 * ctype.look.scale -- 워크스페이스 진입 후 다시 고정
	pcall(function()
		root:SetNetworkOwner(nil)
	end)

	table.insert(active, rec)
	if not assignSpot(rec) then
		leave(rec, "happy")
	end
	if ctype.boss then
		Remotes.toastAll("⚠️ " .. ctype.name .. "이(가) 오셨습니다! 요리 " .. #rec.orders .. "개를 주문합니다", "bad")
		Remotes.notifyAll({ kind = "boss", name = ctype.name })
	end
	return rec
end

function Customers.hasSpace(): boolean
	for i = 1, Config.Slots do
		if not slots[i] then
			return true
		end
	end
	for i = 1, Config.QueueSpots do
		if not queue[i] then
			return true
		end
	end
	return false
end

-- 아직 처리가 끝나지 않은 손님 수 (나가는 중·성불 중인 손님 제외)
function Customers.pendingCount(): number
	local n = 0
	for _, rec in active do
		if rec.state ~= "leaving" and rec.state ~= "ascending" then
			n += 1
		end
	end
	return n
end

-- 시간 부적: 기다리는 손님 전원 인내심 연장. 영향받은 수를 돌려줌
function Customers.extendAll(seconds: number): number
	local n = 0
	for _, rec in active do
		if rec.state == "waiting" then
			rec.deadlineAt += seconds
			rec.total += seconds
			rec.model:SetAttribute("DeadlineAt", rec.deadlineAt)
			rec.model:SetAttribute("Total", rec.total)
			n += 1
		end
	end
	return n
end

-- 평온 부적: 난동 중인 악귀를 진정시켜 돌려보냄. 진정한 수를 돌려줌
function Customers.calmAll(): number
	local n = 0
	for _, rec in active do
		if rec.state == "toStation" then
			if rec.targetStation then
				Stations.untarget(rec.targetStation)
				rec.targetStation = nil
			end
			for _, p in rec.model:GetDescendants() do
				if p:IsA("PointLight") then
					p:Destroy()
				end
			end
			leave(rec, "calm")
			n += 1
		end
	end
	return n
end

function Customers.count(): number
	return #active
end

function Customers.clear()
	for i = #active, 1, -1 do
		local rec = active[i]
		if rec.targetStation then
			Stations.untarget(rec.targetStation)
		end
		rec.model:Destroy()
	end
	active = {}
	slots = {}
	queue = {}
end

return Customers
