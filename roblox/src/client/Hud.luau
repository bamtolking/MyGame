--!nonstrict
-- 화면 HUD: 상단 상태(밤·타이머·손님), 평판·코인, 손에 든 것, 알림, 큰 안내, 결과 화면.
local TweenService = game:GetService("TweenService")

local Hud = {}

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

local function corner(parent: Instance, radius: number?)
	mk("UICorner", { CornerRadius = UDim.new(0, radius or 10) }, parent)
end

local function label(parent: Instance, props: { [string]: any }): TextLabel
	local base = {
		BackgroundTransparency = 1,
		Font = FONT,
		TextColor3 = Color3.fromRGB(245, 240, 235),
		TextSize = 18,
		TextScaled = false,
		TextWrapped = true,
		Text = "",
	}
	for k, v in props do
		base[k] = v
	end
	return mk("TextLabel", base, parent) :: TextLabel
end

local PHASE_TEXT = {
	lobby = "요리사를 기다리는 중",
	countdown = "개장 준비",
	night = "영업 중",
	day = "낮 · 휴식 시간",
	gameover = "폐업",
}

function Hud.create(playerGui: PlayerGui)
	local self = {}
	local gui = mk("ScreenGui", { Name = "GhostDinerHud", ResetOnSpawn = false, IgnoreGuiInset = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, playerGui)
	self.gui = gui

	-- 상단 바
	local top = mk("Frame", { Name = "Top", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 8), Size = UDim2.new(0, 640, 0, 62), BackgroundColor3 = Color3.fromRGB(20, 16, 30), BackgroundTransparency = 0.25 }, gui)
	corner(top, 14)
	mk("UIStroke", { Color = Color3.fromRGB(150, 90, 220), Thickness = 1.5, Transparency = 0.3 }, top)
	local nightLabel = label(top, { Name = "Night", Position = UDim2.new(0, 14, 0, 6), Size = UDim2.new(0, 200, 0, 28), TextSize = 22, TextXAlignment = Enum.TextXAlignment.Left, Text = "🏮 저승 휴게소" })
	local phaseLabel = label(top, { Name = "Phase", Position = UDim2.new(0, 14, 0, 34), Size = UDim2.new(0, 200, 0, 22), TextSize = 15, Font = FONT_REG, TextColor3 = Color3.fromRGB(200, 190, 220), TextXAlignment = Enum.TextXAlignment.Left })
	local timerLabel = label(top, { Name = "Timer", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 6), Size = UDim2.new(0, 160, 0, 50), TextSize = 30, Text = "" })
	local custLabel = label(top, { Name = "Customers", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 6), Size = UDim2.new(0, 200, 0, 28), TextSize = 20, TextXAlignment = Enum.TextXAlignment.Right })
	local coinLabel = label(top, { Name = "Coins", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 34), Size = UDim2.new(0, 200, 0, 22), TextSize = 17, TextColor3 = Color3.fromRGB(255, 215, 110), TextXAlignment = Enum.TextXAlignment.Right })

	-- 평판 바
	local hpFrame = mk("Frame", { Name = "Hp", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 74), Size = UDim2.new(0, 400, 0, 18), BackgroundColor3 = Color3.fromRGB(40, 20, 30), BackgroundTransparency = 0.2 }, gui)
	corner(hpFrame, 9)
	local hpFill = mk("Frame", { Name = "Fill", Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(230, 70, 90), BorderSizePixel = 0 }, hpFrame)
	corner(hpFill, 9)
	local hpText = label(hpFrame, { Size = UDim2.new(1, 0, 1, 0), TextSize = 13, Text = "평판 100 / 100", ZIndex = 2 })

	-- 손에 든 것
	local held = label(gui, { Name = "Held", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -110), Size = UDim2.new(0, 360, 0, 30), TextSize = 18, BackgroundColor3 = Color3.fromRGB(20, 16, 30), BackgroundTransparency = 0.35, Text = "🖐 빈손" })
	corner(held, 8)

	-- 힌트
	local hint = label(gui, { Name = "Hint", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -76), Size = UDim2.new(0, 620, 0, 28), TextSize = 15, Font = FONT_REG, TextColor3 = Color3.fromRGB(215, 205, 235), Text = "" })

	-- 버튼
	-- 모바일 점프 버튼(오른쪽 아래)과 겹치지 않도록 오른쪽 위에 둠
	local buttons = mk("Frame", { Name = "Buttons", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0, 100), Size = UDim2.new(0, 260, 0, 40), BackgroundTransparency = 1 }, gui)
	mk("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Right, Padding = UDim.new(0, 8) }, buttons)
	local function button(text: string): TextButton
		local b = mk("TextButton", { Size = UDim2.new(0, 122, 1, 0), BackgroundColor3 = Color3.fromRGB(90, 50, 150), Text = text, Font = FONT, TextSize = 17, TextColor3 = Color3.fromRGB(255, 255, 255), AutoButtonColor = true }, buttons) :: TextButton
		corner(b, 10)
		return b
	end
	self.recipeButton = button("📖 레시피 (R)")
	self.shopButton = button("🛒 상점 (B)")

	-- 알림(토스트)
	local toasts = mk("Frame", { Name = "Toasts", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 100), Size = UDim2.new(0, 560, 0, 200), BackgroundTransparency = 1 }, gui)
	mk("UIListLayout", { HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, toasts)

	-- 큰 안내
	local announce = label(gui, { Name = "Announce", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.32, 0), Size = UDim2.new(0, 700, 0, 70), TextSize = 44, TextTransparency = 1, TextStrokeTransparency = 1, TextStrokeColor3 = Color3.fromRGB(0, 0, 0) })
	local announceSub = label(gui, { Name = "AnnounceSub", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.32, 48), Size = UDim2.new(0, 700, 0, 34), TextSize = 22, Font = FONT_REG, TextTransparency = 1, TextColor3 = Color3.fromRGB(255, 220, 150) })

	-- 결과 화면
	local result = mk("Frame", { Name = "Result", Visible = false, Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(10, 8, 16), BackgroundTransparency = 0.25, ZIndex = 20 }, gui)
	local resultBox = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 520, 0, 420), BackgroundColor3 = Color3.fromRGB(28, 22, 40), ZIndex = 21 }, result)
	corner(resultBox, 16)
	mk("UIStroke", { Color = Color3.fromRGB(200, 80, 120), Thickness = 2 }, resultBox)
	local resultTitle = label(resultBox, { Position = UDim2.new(0, 0, 0, 18), Size = UDim2.new(1, 0, 0, 48), TextSize = 36, Text = "💀 폐업", ZIndex = 22 })
	local resultBody = label(resultBox, { Position = UDim2.new(0, 30, 0, 80), Size = UDim2.new(1, -60, 1, -120), TextSize = 19, Font = FONT_REG, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, ZIndex = 22, RichText = true })
	local resultFoot = label(resultBox, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -14), Size = UDim2.new(1, -40, 0, 24), TextSize = 15, Font = FONT_REG, TextColor3 = Color3.fromRGB(200, 190, 220), Text = "잠시 후 새 영업이 시작됩니다", ZIndex = 22 })

	local toastCount = 0
	function self.toast(text: string, style: string?)
		toastCount += 1
		local color = Color3.fromRGB(35, 30, 55)
		if style == "good" then
			color = Color3.fromRGB(30, 90, 60)
		elseif style == "bad" then
			color = Color3.fromRGB(120, 35, 50)
		end
		local t = label(toasts, { Size = UDim2.new(1, 0, 0, 30), AutomaticSize = Enum.AutomaticSize.Y, TextSize = 16, Font = FONT_REG, BackgroundColor3 = color, BackgroundTransparency = 0.15, Text = text, LayoutOrder = toastCount })
		corner(t, 8)
		mk("UIPadding", { PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10), PaddingTop = UDim.new(0, 4), PaddingBottom = UDim.new(0, 4) }, t)
		local children = toasts:GetChildren()
		local count = 0
		for _, c in children do
			if c:IsA("TextLabel") then
				count += 1
			end
		end
		if count > 4 then
			for _, c in children do
				if c:IsA("TextLabel") then
					c:Destroy()
					break
				end
			end
		end
		task.delay(4, function()
			if t.Parent then
				TweenService:Create(t, TweenInfo.new(0.5), { TextTransparency = 1, BackgroundTransparency = 1 }):Play()
				task.wait(0.5)
				t:Destroy()
			end
		end)
	end

	function self.announce(text: string, sub: string?, color: Color3?)
		announce.Text = text
		announce.TextColor3 = color or Color3.fromRGB(255, 255, 255)
		announceSub.Text = sub or ""
		local show = TweenInfo.new(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
		TweenService:Create(announce, show, { TextTransparency = 0, TextStrokeTransparency = 0.5 }):Play()
		TweenService:Create(announceSub, show, { TextTransparency = 0 }):Play()
		task.delay(3.2, function()
			local hide = TweenInfo.new(0.8)
			TweenService:Create(announce, hide, { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
			TweenService:Create(announceSub, hide, { TextTransparency = 1 }):Play()
		end)
	end

	function self.setHeld(text: string?)
		held.Text = if text then "🖐 손에: " .. text else "🖐 빈손"
	end

	function self.setHint(text: string)
		hint.Text = text
	end

	function self.showResult(data)
		resultTitle.Text = string.format("💀 폐업 — %d번째 밤에 무너짐", data.night or 0)
		local lines = {
			string.format("서빙한 요리: <b>%d</b>", data.served or 0),
			string.format("악귀가 된 손님: <b>%d</b>", data.angry or 0),
			string.format("번 코인: <b>%d</b> (팁 %d)", data.earned or 0, data.tips or 0),
			"",
			"<b>요리사별 서빙</b>",
		}
		for _, p in data.players or {} do
			table.insert(lines, string.format("  %s — %d", p.name, p.served))
		end
		resultBody.Text = table.concat(lines, "\n")
		result.Visible = true
	end

	function self.hideResult()
		result.Visible = false
	end

	function self.setResultFoot(text: string)
		resultFoot.Text = text
	end

	-- 상태 폴더의 Attribute 를 읽어 화면 갱신
	function self.update(state: Instance)
		local phase = state:GetAttribute("Phase") or "lobby"
		local night = state:GetAttribute("Night") or 0
		local hp = state:GetAttribute("Hp") or 0
		local maxHp = state:GetAttribute("MaxHp") or 100
		local coins = state:GetAttribute("Coins") or 0
		local total = state:GetAttribute("CustomersTotal") or 0
		local done = state:GetAttribute("CustomersDone") or 0
		local endsAt = state:GetAttribute("PhaseEndsAt") or 0

		if phase == "night" then
			nightLabel.Text = string.format("🌙 %d번째 밤", night)
		elseif phase == "day" then
			nightLabel.Text = string.format("☀️ %d번째 밤 종료", night)
		else
			nightLabel.Text = "🏮 저승 휴게소"
		end
		phaseLabel.Text = PHASE_TEXT[phase] or phase
		if endsAt > 0 then
			local left = math.max(0, endsAt - workspace:GetServerTimeNow())
			timerLabel.Text = string.format("%d", math.ceil(left))
		else
			timerLabel.Text = if phase == "night" then "🔥" else ""
		end
		if phase == "night" then
			custLabel.Text = string.format("손님 %d / %d", done, total)
		else
			custLabel.Text = ""
		end
		coinLabel.Text = string.format("🪙 %d 코인", coins)
		local frac = if maxHp > 0 then math.clamp(hp / maxHp, 0, 1) else 0
		hpFill.Size = UDim2.new(frac, 0, 1, 0)
		hpFill.BackgroundColor3 = if frac > 0.5 then Color3.fromRGB(230, 70, 90) elseif frac > 0.25 then Color3.fromRGB(235, 140, 60) else Color3.fromRGB(255, 40, 40)
		hpText.Text = string.format("평판 %d / %d", hp, maxHp)
	end

	return self
end

return Hud
