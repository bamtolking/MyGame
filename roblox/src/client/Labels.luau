--!nonstrict
-- 월드 라벨: 조리대 위 상태/진행 바, 손님 머리 위 주문/인내심 바, 프롬프트 문구 맞춤.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local ProximityPromptService = game:GetService("ProximityPromptService")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("GhostDiner")
local Recipes = require(Shared:WaitForChild("Recipes"))

local Labels = {}

local FONT = Enum.Font.GothamBold
local FONT_REG = Enum.Font.Gotham
local COOKERS = { pot = true, griddle = true, fryer = true, ricecooker = true }

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
local stationLabels = {} -- part → { gui, title, status, barBg, bar }

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
			entry.status.Text = "💀 탔어요! 꺼내서 버리세요"
			entry.status.TextColor3 = Color3.fromRGB(255, 120, 120)
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
	end
end

-- ---------- 손님 라벨 ----------
local customerLabels = {} -- model → entry

local function makeCustomerLabel(model: Model)
	local root = model:WaitForChild("HumanoidRootPart", 5)
	if not root then
		return
	end
	local scale = 1
	local gui = mk("BillboardGui", { Name = "CustomerLabel", Adornee = root, Size = UDim2.new(0, 190, 0, 78), StudsOffsetWorldSpace = Vector3.new(0, 5.2 * scale, 0), AlwaysOnTop = true, MaxDistance = 90, LightInfluence = 0 }, root)
	local name = mk("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 20), Font = FONT, TextSize = 15, TextColor3 = Color3.fromRGB(230, 220, 255), TextStrokeTransparency = 0.3, Text = model.Name }, gui) :: TextLabel
	local order = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 20), Size = UDim2.new(1, 0, 0, 36), Font = FONT, TextSize = 17, TextWrapped = true, TextColor3 = Color3.fromRGB(255, 240, 200), TextStrokeTransparency = 0.2, Text = "" }, gui) :: TextLabel
	local barBg = mk("Frame", { Position = UDim2.new(0.1, 0, 0, 62), Size = UDim2.new(0.8, 0, 0, 10), BackgroundColor3 = Color3.fromRGB(20, 20, 30), BackgroundTransparency = 0.2, BorderSizePixel = 0 }, gui) :: Frame
	mk("UICorner", { CornerRadius = UDim.new(0, 5) }, barBg)
	local bar = mk("Frame", { Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(120, 230, 120), BorderSizePixel = 0 }, barBg) :: Frame
	mk("UICorner", { CornerRadius = UDim.new(0, 5) }, bar)
	customerLabels[model] = { gui = gui, name = name, order = order, barBg = barBg, bar = bar, root = root }
end

local function updateCustomerLabel(model: Model, entry)
	local mood = attrS(model, "Mood")
	if mood == "" then
		mood = "walking"
	end
	local orders = split(attrS(model, "Orders"))
	local boss = attrB(model, "Boss")
	local displayName = attrS(model, "DisplayName")
	if displayName == "" then
		displayName = model.Name
	end
	entry.name.Text = (if boss then "👑 " else "") .. displayName
	if mood == "waiting" then
		entry.order.Text = "🍽 " .. names(orders)
		entry.order.TextColor3 = Color3.fromRGB(255, 240, 200)
		entry.barBg.Visible = true
		local deadline = attrN(model, "DeadlineAt")
		local total = attrN(model, "Total")
		if total <= 0 then
			total = 1
		end
		local frac = math.clamp((deadline - now()) / total, 0, 1)
		entry.bar.Size = UDim2.new(frac, 0, 1, 0)
		entry.bar.BackgroundColor3 = if frac > 0.5 then Color3.fromRGB(120, 230, 120) elseif frac > 0.25 then Color3.fromRGB(255, 200, 80) else Color3.fromRGB(255, 70, 60)
	elseif mood == "queue" then
		entry.order.Text = "⏳ 자리 기다리는 중 (" .. names(orders) .. ")"
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
	else
		entry.order.Text = "🚶 오는 중 (" .. names(orders) .. ")"
		entry.order.TextColor3 = Color3.fromRGB(200, 195, 220)
		entry.barBg.Visible = false
	end
end

-- ---------- 코인 연출 ----------
function Labels.coinPopup(position: Vector3, amount: number, tip: number)
	local anchor = mk("Part", { Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, Transparency = 1, Size = Vector3.new(0.2, 0.2, 0.2), Position = position }, workspace)
	local gui = mk("BillboardGui", { Size = UDim2.new(0, 160, 0, 40), AlwaysOnTop = true, LightInfluence = 0 }, anchor)
	local text = mk("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0), Font = FONT, TextSize = 24, TextColor3 = Color3.fromRGB(255, 220, 90), TextStrokeTransparency = 0.2, Text = if tip > 0 then string.format("+%d 🪙 (팁 %d)", amount, tip) else string.format("+%d 🪙", amount) }, gui) :: TextLabel
	TweenService:Create(anchor, TweenInfo.new(1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = position + Vector3.new(0, 4, 0) }):Play()
	TweenService:Create(text, TweenInfo.new(1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	task.delay(1.3, function()
		anchor:Destroy()
	end)
end

-- ---------- 프롬프트 문구 ----------
local getHeldId: () -> string? = function()
	return nil
end
local shownPrompts: { [ProximityPrompt]: boolean } = {}

local function hintFor(part: BasePart, heldId: string?): (string?, string?, boolean)
	local kind = attrS(part, "Kind")
	local heldName = if heldId then Recipes.name(heldId) else nil
	if kind == "customer" then
		local model = part.Parent
		local orders = split(if model then attrS(model, "Orders") else "")
		if heldId and table.find(orders, heldId) then
			return nil, "서빙: " .. heldName, true
		end
		return nil, "주문: " .. names(orders), true
	elseif kind == "crate" then
		local crateItem = attrS(part, "CrateItem")
		return nil, if heldId then "손이 비어야 꺼낼 수 있음" else "꺼내기: " .. Recipes.name(crateItem), true
	elseif kind == "board" then
		local item = heldId and Recipes.Items[heldId]
		if item and item.chopTo then
			return nil, "썰기 (길게 누르기)", true
		end
		return nil, "야채를 들고 오세요", false
	elseif kind == "combine" then
		if heldId then
			return nil, "올리기: " .. heldName, true
		end
		local contents = split(attrS(part, "Contents"))
		if #contents > 0 then
			return nil, "집기: " .. Recipes.name(contents[#contents]), true
		end
		return nil, "재료를 들고 와서 올리세요", true
	elseif COOKERS[kind] then
		local state = attrS(part, "State")
		if state == "" then
			state = "idle"
		end
		if state == "idle" then
			if heldId then
				local cook = Recipes.cookFor(heldId, kind)
				return nil, if cook then "넣기: " .. heldName else heldName .. "은(는) 못 넣어요", true
			end
			return nil, "익힐 재료를 들고 오세요", true
		elseif state == "cooking" then
			return nil, "익는 중…", true
		elseif state == "done" then
			return nil, if heldId then "손을 비우고 꺼내세요" else "꺼내기: " .. Recipes.name(attrS(part, "Item")), true
		else
			return nil, "탄 음식 꺼내기", true
		end
	elseif kind == "trash" then
		return nil, if heldId then "버리기: " .. heldName else "버릴 것이 없어요", true
	end
	return nil, nil, true
end

local function applyHint(prompt: ProximityPrompt)
	local part = prompt.Parent
	if not part or not part:IsA("BasePart") then
		return
	end
	local heldId = getHeldId()
	local _, action, holdOk = hintFor(part, heldId)
	if action then
		prompt.ActionText = action
	end
	if attrS(part, "Kind") == "board" then
		local chopTime = attrN(part, "ChopTime")
		if chopTime <= 0 then
			chopTime = 2.5
		end
		prompt.HoldDuration = if holdOk then chopTime else 0
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

function Labels.init(map: Instance, heldGetter: () -> string?)
	getHeldId = heldGetter
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
		for model, entry in customerLabels do
			if model.Parent then
				updateCustomerLabel(model, entry)
			else
				customerLabels[model] = nil
			end
		end
		Labels.refreshPrompts()
	end)
end

return Labels
