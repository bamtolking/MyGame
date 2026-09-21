--!nonstrict
-- 월드 라벨과 손님 애니메이션: 조리대 상태/진행 바, 손님 머리 위 주문/인내심 바, 둥실거림·기쁨 점프·분노 떨림, 프롬프트 문구 맞춤.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local ProximityPromptService = game:GetService("ProximityPromptService")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage:WaitForChild("GhostDiner")
local Recipes = require(Shared:WaitForChild("Recipes"))
local Config = require(Shared:WaitForChild("Config"))

local Labels = {}

local FONT = Enum.Font.GothamBold
local FONT_REG = Enum.Font.Gotham
local COOKERS = { pot = true, griddle = true, fryer = true, ricecooker = true }
local rng = Random.new()
local fx = nil
local onOrders: (any) -> () = function() end

local function mk(className: string, props: { [string]: any }, parent: Instance?): Instance
	local inst = Instance.new(className)
	for k, v in props do
		(inst :: any)[k] = v
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

local function now(): number
	return workspace:GetServerTimeNow()
end

local function attrS(inst: Instance, name: string): string
	local v = inst:GetAttribute(name)
	return if v == nil then "" else tostring(v)
end

local function attrN(inst: Instance, name: string): number
	local v = inst:GetAttribute(name)
	return if type(v) == "number" then v else 0
end

local function attrB(inst: Instance, name: string): boolean
	return inst:GetAttribute(name) == true
end

local function split(s: string): { string }
	local out = {}
	for token in string.gmatch(s or "", "[^,]+") do
		table.insert(out, token)
	end
	return out
end

local function names(ids: { string }): string
	local out = {}
	for _, id in ids do
		local item = Recipes.Items[id]
		table.insert(out, (item and item.emoji or "") .. Recipes.name(id))
	end
	return table.concat(out, " · ")
end

-- ---------- 조리대 라벨 ----------
local stationLabels = {}

local function makeStationLabel(part: BasePart)
	local gui = mk("BillboardGui", { Name = "StationLabel", Adornee = part, Size = UDim2.new(0, 150, 0, 58), StudsOffsetWorldSpace = Vector3.new(0, 4.6, 0), AlwaysOnTop = false, MaxDistance = 70, LightInfluence = 0 }, part)
	local title = mk("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 22), Font = FONT, TextSize = 16, TextColor3 = Color3.fromRGB(255, 240, 210), TextStrokeTransparency = 0.3, Text = "" }, gui) :: TextLabel
	local status = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 22), Size = UDim2.new(1, 0, 0, 20), Font = FONT_REG, TextSize = 14, TextColor3 = Color3.fromRGB(220, 215, 235), TextStrokeTransparency = 0.4, Text = "" }, gui) :: TextLabel
	local barBg = mk("Frame", { Position = UDim2.new(0.15, 0, 0, 46), Size = UDim2.new(0.7, 0, 0, 8), BackgroundColor3 = Color3.fromRGB(20, 20, 30), BackgroundTransparency = 0.2, BorderSizePixel = 0, Visible = false }, gui) :: Frame
	mk("UICorner", { CornerRadius = UDim.new(0, 4) }, barBg)
	local bar = mk("Frame", { Size = UDim2.new(0, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(255, 200, 80), BorderSizePixel = 0 }, barBg) :: Frame
	mk("UICorner", { CornerRadius = UDim.new(0, 4) }, bar)
	stationLabels[part] = { gui = gui, title = title, status = status, barBg = barBg, bar = bar }
end

local function updateStationLabel(part: BasePart, entry)
	local kind = attrS(part, "Kind")
	local label = attrS(part, "Label")
	local locked = attrB(part, "Locked")
	local smashed = attrB(part, "Smashed")
	local state = attrS(part, "State")
	if state == "" then
		state = "idle"
	end
	local item = attrS(part, "Item")
	entry.barBg.Visible = false

	if kind == "crate" then
		local crateItem = Recipes.Items[attrS(part, "CrateItem")]
		entry.title.Text = "📦 " .. (crateItem and crateItem.emoji or "") .. label
		entry.status.Text = ""
	else
		entry.title.Text = label
	end
	if locked then
		entry.status.Text = "🔒 상점에서 추가"
		entry.status.TextColor3 = Color3.fromRGB(180, 170, 200)
		return
	end
	if smashed then
		entry.status.Text = "💥 부서짐 · 복구 중"
		entry.status.TextColor3 = Color3.fromRGB(255, 120, 120)
		return
	end
	if state == "fire" then
		entry.status.Text = "🔥🔥 불이야! 소화기 필요"
		entry.status.TextColor3 = Color3.fromRGB(255, 110, 60)
		return
	end
	entry.status.TextColor3 = Color3.fromRGB(220, 215, 235)
	if COOKERS[kind] then
		local t = now()
		local startAt = attrN(part, "StartAt")
		local doneAt = attrN(part, "DoneAt")
		local burnAt = attrN(part, "BurnAt")
		if state == "cooking" then
			entry.status.Text = "🔥 " .. Recipes.name(item) .. " 익는 중"
			entry.barBg.Visible = true
			local frac = if doneAt > startAt then math.clamp((t - startAt) / (doneAt - startAt), 0, 1) else 0
			entry.bar.Size = UDim2.new(frac, 0, 1, 0)
			entry.bar.BackgroundColor3 = Color3.fromRGB(255, 200, 80)
		elseif state == "done" then
			entry.status.Text = "✅ " .. Recipes.name(item) .. " 완성! 꺼내세요"
			entry.status.TextColor3 = Color3.fromRGB(150, 255, 160)
			if burnAt > 0 then
				entry.barBg.Visible = true
				local frac = math.clamp((burnAt - t) / (burnAt - doneAt), 0, 1)
				entry.bar.Size = UDim2.new(frac, 0, 1, 0)
				entry.bar.BackgroundColor3 = if frac > 0.4 then Color3.fromRGB(120, 230, 120) else Color3.fromRGB(255, 80, 60)
			end
		elseif state == "burnt" then
			local burntAt = attrN(part, "BurntAt")
			local igniteAt = attrN(part, "IgniteAt")
			if igniteAt <= 0 then
				igniteAt = burntAt + Config.FireDelay
			end
			local left = math.max(0, igniteAt - t)
			local span = math.max(1, igniteAt - burntAt)
			entry.status.Text = string.format("💀 탔어요! %d초 뒤 불이 납니다", math.ceil(left))
			entry.status.TextColor3 = Color3.fromRGB(255, 120, 120)
			entry.barBg.Visible = true
			entry.bar.Size = UDim2.new(math.clamp(left / span, 0, 1), 0, 1, 0)
			entry.bar.BackgroundColor3 = Color3.fromRGB(255, 80, 60)
		else
			entry.status.Text = "비어 있음"
		end
	elseif kind == "combine" then
		local contents = split(attrS(part, "Contents"))
		entry.status.Text = if #contents > 0 then names(contents) else "재료를 올려 합치세요"
	elseif kind == "board" then
		local chopTime = attrN(part, "ChopTime")
		if chopTime <= 0 then
			chopTime = 2.5
		end
		entry.status.Text = string.format("야채를 들고 E 길게 (%.1f초)", chopTime)
	elseif kind == "trash" then
		entry.status.Text = "실패한 음식 버리기"
	elseif kind == "extinguisher" then
		entry.title.Text = "🧯 " .. label
		entry.status.Text = "빈손으로 E: 소화기 꺼내기"
	elseif kind == "mallet" then
		entry.title.Text = "🥢 " .. label
		local hits = attrN(part, "Hits")
		local needed = attrN(part, "HitsNeeded")
		if state == "pounding" then
			local last = attrS(part, "LastHitter")
			entry.status.Text = if last == "" then string.format("쿵! %d/%d · 누구든 E", hits, needed) else string.format("쿵! %d/%d · %s 말고 다른 요리사!", hits, needed, last)
			entry.status.TextColor3 = Color3.fromRGB(255, 220, 150)
			entry.barBg.Visible = true
			entry.bar.Size = UDim2.new(if needed > 0 then hits / needed else 0, 0, 1, 0)
			entry.bar.BackgroundColor3 = Color3.fromRGB(255, 200, 80)
		elseif state == "done" then
			entry.status.Text = "✅ 인절미 완성! 꺼내세요"
			entry.status.TextColor3 = Color3.fromRGB(150, 255, 160)
		else
			entry.status.Text = "밥을 올리고 두 명이 번갈아 치기"
		end
	end
end

-- ---------- 손님 라벨 + 애니메이션 ----------
local customerLabels = {}

local function gatherWelds(entry)
	entry.welds = {}
	for _, d in entry.model:GetDescendants() do
		if d:IsA("Weld") and d.Part0 == entry.root then
			table.insert(entry.welds, { weld = d, c0 = d.C0 })
		end
	end
end

local function makeCustomerLabel(model: Model)
	local root = model:WaitForChild("HumanoidRootPart", 5)
	if not root or not model.Parent then
		return
	end
	local gui = mk("BillboardGui", { Name = "CustomerLabel", Adornee = root, Size = UDim2.new(0, 200, 0, 80), StudsOffsetWorldSpace = Vector3.new(0, 5.4, 0), AlwaysOnTop = true, MaxDistance = 90, LightInfluence = 0 }, root)
	local name = mk("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 20), Font = FONT, TextSize = 15, TextColor3 = Color3.fromRGB(230, 220, 255), TextStrokeTransparency = 0.3, Text = model.Name }, gui) :: TextLabel
	local order = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 20), Size = UDim2.new(1, 0, 0, 38), Font = FONT, TextSize = 17, TextWrapped = true, TextColor3 = Color3.fromRGB(255, 240, 200), TextStrokeTransparency = 0.2, Text = "" }, gui) :: TextLabel
	local barBg = mk("Frame", { Position = UDim2.new(0.1, 0, 0, 64), Size = UDim2.new(0.8, 0, 0, 10), BackgroundColor3 = Color3.fromRGB(20, 20, 30), BackgroundTransparency = 0.2, BorderSizePixel = 0 }, gui) :: Frame
	mk("UICorner", { CornerRadius = UDim.new(0, 5) }, barBg)
	local bar = mk("Frame", { Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(120, 230, 120), BorderSizePixel = 0 }, barBg) :: Frame
	mk("UICorner", { CornerRadius = UDim.new(0, 5) }, bar)
	local entry = {
		gui = gui,
		name = name,
		order = order,
		barBg = barBg,
		bar = bar,
		root = root,
		model = model,
		phase = rng:NextNumber(0, math.pi * 2),
		welds = {},
		mood = "",
		anim = nil,
		lastTwist = attrN(model, "Twist"),
		lastFraction = -1,
		weldTries = 0,
	}
	gatherWelds(entry)
	customerLabels[model] = entry
end

local function startAnim(entry, kind: string, duration: number)
	entry.anim = { kind = kind, startAt = os.clock(), duration = duration }
end

local function onMoodChanged(entry, mood: string)
	local root = entry.root
	if mood ~= "angry" then
		local aura = root:FindFirstChild("AngryAura")
		if aura then
			aura:Destroy()
		end
	end
	if mood == "happy" then
		startAnim(entry, "hop", 0.7)
		if fx then
			fx.burst(root.Position + Vector3.new(0, 3, 0), fx.Colors.pink, 16, 0.5, 4)
			fx.floatText(root.Position + Vector3.new(0, 4, 0), "💚 잘 먹었다!", fx.Colors.green, 22)
		end
	elseif mood == "angry" then
		startAnim(entry, "rage", 0.8)
		for _, p in entry.model:GetDescendants() do
			if p:IsA("BasePart") and p.Name == "Eye" then
				p.Material = Enum.Material.Neon
				p.Color = Color3.fromRGB(255, 40, 40)
			end
		end
		mk("ParticleEmitter", {
			Name = "AngryAura",
			Rate = 14,
			Lifetime = NumberRange.new(0.8, 1.4),
			Speed = NumberRange.new(2, 4),
			Size = NumberSequence.new(1.3, 0),
			Transparency = NumberSequence.new(0.3, 1),
			Color = ColorSequence.new(Color3.fromRGB(255, 40, 40), Color3.fromRGB(60, 0, 0)),
			LightEmission = 0.6,
			SpreadAngle = Vector2.new(180, 180),
		}, root)
		if fx then
			fx.floatText(root.Position + Vector3.new(0, 4.5, 0), "👿 악귀!", fx.Colors.red, 26)
		end
	end
end

local function updateCustomerLabel(model: Model, entry)
	local mood = attrS(model, "Mood")
	if mood == "" then
		mood = "walking"
	end
	if #entry.welds == 0 and entry.weldTries < 20 then
		entry.weldTries += 1
		gatherWelds(entry)
	end
	if mood ~= entry.mood then
		entry.mood = mood
		onMoodChanged(entry, mood)
	end
	local twist = attrN(model, "Twist")
	if twist ~= entry.lastTwist then
		entry.lastTwist = twist
		startAnim(entry, "twist", 0.8)
		if fx then
			fx.floatText(entry.root.Position + Vector3.new(0, 4.5, 0), "❗ 주문 변경!", fx.Colors.orange, 24)
			fx.burst(entry.root.Position + Vector3.new(0, 3, 0), fx.Colors.orange, 14, 0.45, 4)
		end
	end

	local orders = split(attrS(model, "Orders"))
	local boss = attrB(model, "Boss")
	local displayName = attrS(model, "DisplayName")
	if displayName == "" then
		displayName = model.Name
	end
	entry.name.Text = (if boss then "👑 " else "") .. displayName
	entry.fraction = -1
	entry.ordersText = names(orders)
	entry.displayName = displayName
	if mood == "waiting" then
		entry.order.Text = "🍽 " .. entry.ordersText
		entry.order.TextColor3 = Color3.fromRGB(255, 240, 200)
		entry.barBg.Visible = true
		local deadline = attrN(model, "DeadlineAt")
		local total = attrN(model, "Total")
		if total <= 0 then
			total = 1
		end
		local frac = math.clamp((deadline - now()) / total, 0, 1)
		entry.fraction = frac
		entry.bar.Size = UDim2.new(frac, 0, 1, 0)
		entry.bar.BackgroundColor3 = if frac > 0.5 then Color3.fromRGB(120, 230, 120) elseif frac > 0.25 then Color3.fromRGB(255, 200, 80) else Color3.fromRGB(255, 70, 60)
		if frac < 0.25 then
			entry.order.TextColor3 = if math.floor(os.clock() * 4) % 2 == 0 then Color3.fromRGB(255, 120, 100) else Color3.fromRGB(255, 240, 200)
		end
		-- 도착 직후 3.5초는 손님의 한마디
		local line = attrS(model, "Line")
		local elapsed = total - (deadline - now())
		if line ~= "" and elapsed < 3.5 then
			entry.order.Text = "💬 " .. line
			entry.order.TextColor3 = Color3.fromRGB(230, 225, 255)
		end
	elseif mood == "queue" then
		entry.order.Text = "⏳ 자리 기다리는 중 (" .. entry.ordersText .. ")"
		entry.order.TextColor3 = Color3.fromRGB(200, 195, 220)
		entry.barBg.Visible = false
	elseif mood == "angry" then
		entry.order.Text = "👿 악귀가 되었다!"
		entry.order.TextColor3 = Color3.fromRGB(255, 90, 90)
		entry.barBg.Visible = false
	elseif mood == "happy" then
		entry.order.Text = "💚 잘 먹었다~"
		entry.order.TextColor3 = Color3.fromRGB(150, 255, 160)
		entry.barBg.Visible = false
	elseif mood == "ascend" then
		entry.order.Text = "✨ 성불합니다… 고마워요"
		entry.order.TextColor3 = Color3.fromRGB(255, 240, 180)
		entry.barBg.Visible = false
	elseif mood == "calm" then
		entry.order.Text = "🕊️ 진정했다… 돌아갈게요"
		entry.order.TextColor3 = Color3.fromRGB(200, 230, 255)
		entry.barBg.Visible = false
	else
		entry.order.Text = "🚶 오는 중 (" .. entry.ordersText .. ")"
		entry.order.TextColor3 = Color3.fromRGB(200, 195, 220)
		entry.barBg.Visible = false
	end
end

-- 매 프레임: 둥실거림 + 애니메이션 (Weld C0 를 로컬에서만 바꿈)
local function animateCustomers()
	local t = os.clock()
	for _, entry in customerLabels do
		if #entry.welds == 0 or not entry.model.Parent then
			continue
		end
		local y = math.sin(t * 2.6 + entry.phase) * 0.22
		local x, z = 0, 0
		local rotY = 0
		if entry.mood == "angry" then
			x = rng:NextNumber(-0.09, 0.09)
			z = rng:NextNumber(-0.09, 0.09)
		end
		local anim = entry.anim
		if anim then
			local u = (t - anim.startAt) / anim.duration
			if u >= 1 then
				entry.anim = nil
			elseif anim.kind == "hop" then
				y += math.abs(math.sin(u * math.pi * 2)) * 1.3 * (1 - u * 0.5)
				rotY = math.sin(u * math.pi) * 0.6
			elseif anim.kind == "twist" then
				x += math.sin(u * math.pi * 6) * 0.25
			elseif anim.kind == "rage" then
				y += math.sin(u * math.pi) * 0.9
				rotY = math.sin(u * math.pi * 4) * 0.35
			end
		end
		local offset = CFrame.new(x, y, z) * CFrame.Angles(0, rotY, 0)
		for _, w in entry.welds do
			w.weld.C0 = offset * w.c0
		end
	end
end

-- ---------- 프롬프트 문구 ----------
local getHeldId: () -> string? = function()
	return nil
end
local shownPrompts: { [ProximityPrompt]: boolean } = {}

-- 반환: 행동 문구, 길게 누르는 시간(초)
local function hintFor(part: BasePart, heldId: string?): (string?, number)
	local kind = attrS(part, "Kind")
	local heldName = if heldId then Recipes.name(heldId) else nil
	local state = attrS(part, "State")
	if state == "" then
		state = "idle"
	end
	if kind ~= "customer" and state == "fire" then
		if heldId == "extinguisher" then
			return "🧯 불 끄기 (길게)", Config.ExtinguishHold
		end
		return "🔥 소화기가 필요해요!", 0
	end
	if kind == "customer" then
		local model = part.Parent
		local orders = split(if model then attrS(model, "Orders") else "")
		if heldId and table.find(orders, heldId) then
			return "서빙: " .. heldName, 0
		end
		return "주문: " .. names(orders), 0
	elseif kind == "crate" then
		local crateItem = attrS(part, "CrateItem")
		return if heldId then "손이 비어야 꺼낼 수 있음" else "꺼내기: " .. Recipes.name(crateItem), 0
	elseif kind == "board" then
		local item = heldId and Recipes.Items[heldId]
		if item and item.chopTo then
			local chopTime = attrN(part, "ChopTime")
			if chopTime <= 0 then
				chopTime = 2.5
			end
			return "썰기 (길게 누르기)", chopTime
		end
		return "야채를 들고 오세요", 0
	elseif kind == "combine" then
		if heldId then
			return "올리기: " .. heldName, 0
		end
		local contents = split(attrS(part, "Contents"))
		if #contents > 0 then
			return "집기: " .. Recipes.name(contents[#contents]), 0
		end
		return "재료를 들고 와서 올리세요", 0
	elseif COOKERS[kind] then
		if state == "idle" then
			if heldId then
				local cook = Recipes.cookFor(heldId, kind)
				return if cook then "넣기: " .. heldName else heldName .. "은(는) 못 넣어요", 0
			end
			return "익힐 재료를 들고 오세요", 0
		elseif state == "cooking" then
			return "익는 중…", 0
		elseif state == "done" then
			return if heldId then "손을 비우고 꺼내세요" else "꺼내기: " .. Recipes.name(attrS(part, "Item")), 0
		else
			return "탄 음식 꺼내기 (서둘러요!)", 0
		end
	elseif kind == "trash" then
		return if heldId then "버리기: " .. heldName else "버릴 것이 없어요", 0
	elseif kind == "extinguisher" then
		if heldId == nil then
			return "소화기 꺼내기", 0
		elseif heldId == "extinguisher" then
			return "소화기 넣기", 0
		end
		return "손을 비우세요", 0
	elseif kind == "mallet" then
		if state == "idle" then
			return if heldId == Recipes.Pound.input then "밥 올리기" else "밥을 들고 오세요", 0
		elseif state == "pounding" then
			if heldId then
				return "손을 비우고 치세요", 0
			end
			local last = attrS(part, "LastHitter")
			local me = Players.LocalPlayer and Players.LocalPlayer.DisplayName or ""
			if last == me and #Players:GetPlayers() >= 2 then
				return "다른 요리사 차례!", 0
			end
			return string.format("떡메 치기! (%d/%d)", attrN(part, "Hits"), attrN(part, "HitsNeeded")), 0
		end
		return if heldId then "손을 비우고 꺼내세요" else "인절미 꺼내기", 0
	end
	return nil, 0
end

local function applyHint(prompt: ProximityPrompt)
	local part = prompt.Parent
	if not part or not part:IsA("BasePart") then
		return
	end
	local action, hold = hintFor(part, getHeldId())
	if action then
		prompt.ActionText = action
	end
	if attrS(part, "Kind") ~= "customer" then
		prompt.HoldDuration = hold
	end
end

function Labels.refreshPrompts()
	for prompt in shownPrompts do
		if prompt.Parent then
			applyHint(prompt)
		else
			shownPrompts[prompt] = nil
		end
	end
end

function Labels.init(map: Instance, heldGetter: () -> string?, fxModule, ordersCallback)
	getHeldId = heldGetter
	fx = fxModule
	onOrders = ordersCallback or onOrders
	local stationsFolder = map:WaitForChild("Stations")
	local customersFolder = map:WaitForChild("Customers")

	for _, part in stationsFolder:GetChildren() do
		if part:IsA("BasePart") then
			makeStationLabel(part)
		end
	end
	stationsFolder.ChildAdded:Connect(function(part)
		if part:IsA("BasePart") then
			makeStationLabel(part)
		end
	end)
	stationsFolder.ChildRemoved:Connect(function(part)
		stationLabels[part] = nil
	end)

	for _, model in customersFolder:GetChildren() do
		if model:IsA("Model") then
			task.spawn(makeCustomerLabel, model)
		end
	end
	customersFolder.ChildAdded:Connect(function(model)
		if model:IsA("Model") then
			task.spawn(makeCustomerLabel, model)
		end
	end)
	customersFolder.ChildRemoved:Connect(function(model)
		customerLabels[model] = nil
	end)

	ProximityPromptService.PromptShown:Connect(function(prompt)
		shownPrompts[prompt] = true
		applyHint(prompt)
	end)
	ProximityPromptService.PromptHidden:Connect(function(prompt)
		shownPrompts[prompt] = nil
	end)

	local acc = 0
	RunService.RenderStepped:Connect(function(dt)
		animateCustomers()
		acc += dt
		if acc < 0.1 then
			return
		end
		acc = 0
		for part, entry in stationLabels do
			if part.Parent then
				updateStationLabel(part, entry)
			else
				stationLabels[part] = nil
			end
		end
		local list = {}
		for model, entry in customerLabels do
			if model.Parent then
				updateCustomerLabel(model, entry)
				if entry.mood ~= "happy" and entry.mood ~= "angry" and entry.mood ~= "ascend" and entry.mood ~= "calm" then
					table.insert(list, { name = entry.displayName or model.Name, orders = entry.ordersText or "", fraction = entry.fraction or -1, mood = entry.mood })
				end
			else
				customerLabels[model] = nil
			end
		end
		onOrders(list)
		Labels.refreshPrompts()
	end)
end

return Labels
