--!nonstrict
-- 첫 손님 튜토리얼: 처음 온 요리사에게 어묵탕 한 그릇을 서빙하는 4단계를 체크리스트로 안내합니다.
local Tutorial = {}

local FONT = Enum.Font.GothamBold
local FONT_REG = Enum.Font.Gotham

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

local STEPS = {
	{ text = "📦 어묵 상자 앞에서 E — 어묵 꺼내기", check = function(ctx)
		return ctx.held == "eomuk_raw"
	end },
	{ text = "🍲 냄비 앞에서 E — 어묵 넣기", check = function(ctx)
		return ctx.potBusy
	end },
	{ text = "✅ 완성되면 빈손으로 E — 어묵탕 꺼내기 (10초 안에!)", check = function(ctx)
		return ctx.held == "eomuk"
	end },
	{ text = "🍽 카운터 너머 손님 앞에서 E — 서빙!", check = function(ctx)
		return ctx.served > ctx.servedAtStart
	end },
}

function Tutorial.create(gui: Instance, state: Instance, map: Instance, getHeld: () -> string?, playSound: (string) -> ())
	local self = {}
	local frame = mk("Frame", { Name = "Tutorial", Visible = false, AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 12, 1, -150), Size = UDim2.new(0, 340, 0, 176), BackgroundColor3 = Color3.fromRGB(24, 20, 36), BackgroundTransparency = 0.1, ZIndex = 8 }, gui) :: Frame
	mk("UICorner", { CornerRadius = UDim.new(0, 12) }, frame)
	mk("UIStroke", { Color = Color3.fromRGB(255, 200, 90), Thickness = 1.5, Transparency = 0.2 }, frame)
	local title = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 12, 0, 8), Size = UDim2.new(1, -60, 0, 26), Font = FONT, TextSize = 18, TextColor3 = Color3.fromRGB(255, 220, 140), TextXAlignment = Enum.TextXAlignment.Left, Text = "👋 첫 손님 튜토리얼", ZIndex = 9 }, frame) :: TextLabel
	local skip = mk("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -10, 0, 8), Size = UDim2.new(0, 46, 0, 24), BackgroundColor3 = Color3.fromRGB(70, 60, 90), Font = FONT_REG, TextSize = 13, TextColor3 = Color3.fromRGB(230, 225, 240), Text = "건너뛰기", ZIndex = 9 }, frame) :: TextButton
	mk("UICorner", { CornerRadius = UDim.new(0, 6) }, skip)
	local lines = {}
	for i, step in STEPS do
		local l = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 12, 0, 36 + (i - 1) * 32), Size = UDim2.new(1, -24, 0, 30), Font = FONT_REG, TextSize = 15, TextWrapped = true, TextColor3 = Color3.fromRGB(200, 195, 215), TextXAlignment = Enum.TextXAlignment.Left, Text = "○ " .. step.text, ZIndex = 9 }, frame) :: TextLabel
		table.insert(lines, l)
	end

	local active = false
	local step = 1
	local servedAtStart = 0
	local finished = false

	local function render()
		for i, l in lines do
			if i < step then
				l.Text = "✅ " .. STEPS[i].text
				l.TextColor3 = Color3.fromRGB(140, 230, 150)
			elseif i == step then
				l.Text = "👉 " .. STEPS[i].text
				l.TextColor3 = Color3.fromRGB(255, 240, 200)
			else
				l.Text = "○ " .. STEPS[i].text
				l.TextColor3 = Color3.fromRGB(160, 155, 175)
			end
		end
	end

	function self.shouldShow(player: Player): boolean
		local best = player:GetAttribute("BestNight")
		local fame = player:GetAttribute("Fame")
		return (best == nil or best == 0) and (fame == nil or fame < 5) and not finished
	end

	function self.start()
		if finished then
			return
		end
		active = true
		step = 1
		local served = state:GetAttribute("Served")
		servedAtStart = if type(served) == "number" then served else 0
		title.Text = "👋 첫 손님 튜토리얼"
		frame.Visible = true
		render()
	end

	function self.finish(skipped: boolean)
		active = false
		finished = true
		if skipped then
			frame.Visible = false
			return
		end
		title.Text = "🎉 튜토리얼 완료! 이제 진짜 영업입니다"
		playSound("challenge")
		task.delay(3.5, function()
			frame.Visible = false
		end)
	end

	skip.MouseButton1Click:Connect(function()
		self.finish(true)
	end)

	local function potBusy(): boolean
		local stationsFolder = map:FindFirstChild("Stations")
		if not stationsFolder then
			return false
		end
		for _, part in stationsFolder:GetChildren() do
			if part:GetAttribute("Kind") == "pot" then
				local st = part:GetAttribute("State")
				local item = part:GetAttribute("Item")
				if (st == "cooking" or st == "done") and (item == "eomuk_raw" or item == "eomuk") then
					return true
				end
			end
		end
		return false
	end

	function self.update()
		if not active then
			return
		end
		local served = state:GetAttribute("Served")
		local ctx = {
			held = getHeld(),
			potBusy = potBusy(),
			served = if type(served) == "number" then served else 0,
			servedAtStart = servedAtStart,
		}
		-- 빠른 요리사가 단계를 건너뛰어도 따라잡도록, 충족된 가장 뒤 단계까지 한 번에 진행
		local reached = nil
		for i = #STEPS, step, -1 do
			if STEPS[i].check(ctx) then
				reached = i
				break
			end
		end
		if reached then
			step = reached + 1
			playSound("ui")
			render()
			if step > #STEPS then
				self.finish(false)
			end
		end
	end

	return self
end

return Tutorial
