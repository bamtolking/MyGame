--!nonstrict
-- 화면 HUD: 상단 상태, 평판·코인, 콤보, 이벤트 배너, 주문 목록, 밤 목표, 준비 버튼, 손에 든 것, 알림, 큰 안내, 밤 요약, 결과.
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("GhostDiner")
local Combo = require(Shared:WaitForChild("Combo"))
local Config = require(Shared:WaitForChild("Config"))
local Relics = require(Shared:WaitForChild("Relics"))
local Talismans = require(Shared:WaitForChild("Talismans"))

local Hud = {}

local FONT = Enum.Font.GothamBold
local FONT_REG = Enum.Font.Gotham
local FONT_BLACK = Enum.Font.GothamBlack

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

local function now(): number
	return workspace:GetServerTimeNow()
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
	local gui = mk("ScreenGui", { Name = "GhostDinerHud", ResetOnSpawn = false, IgnoreGuiInset = false, DisplayOrder = 5, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, playerGui)
	self.gui = gui
	self.onReady = function() end

	-- 상단 바
	local top = mk("Frame", { Name = "Top", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 8), Size = UDim2.new(0, 640, 0, 62), BackgroundColor3 = Color3.fromRGB(20, 16, 30), BackgroundTransparency = 0.25 }, gui)
	corner(top, 14)
	mk("UIStroke", { Color = Color3.fromRGB(150, 90, 220), Thickness = 1.5, Transparency = 0.3 }, top)
	mk("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(170, 160, 200)) }, top)
	local nightLabel = label(top, { Name = "Night", Position = UDim2.new(0, 14, 0, 6), Size = UDim2.new(0, 220, 0, 28), TextSize = 22, TextXAlignment = Enum.TextXAlignment.Left, Text = "🏮 저승 휴게소" })
	local phaseLabel = label(top, { Name = "Phase", Position = UDim2.new(0, 14, 0, 34), Size = UDim2.new(0, 220, 0, 22), TextSize = 15, Font = FONT_REG, TextColor3 = Color3.fromRGB(200, 190, 220), TextXAlignment = Enum.TextXAlignment.Left })
	local timerLabel = label(top, { Name = "Timer", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 6), Size = UDim2.new(0, 160, 0, 50), TextSize = 30, Text = "" })
	local custLabel = label(top, { Name = "Customers", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 6), Size = UDim2.new(0, 200, 0, 28), TextSize = 20, TextXAlignment = Enum.TextXAlignment.Right })
	local coinLabel = label(top, { Name = "Coins", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 34), Size = UDim2.new(0, 200, 0, 22), TextSize = 17, TextColor3 = Color3.fromRGB(255, 215, 110), TextXAlignment = Enum.TextXAlignment.Right })

	-- 평판 바
	local hpFrame = mk("Frame", { Name = "Hp", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 74), Size = UDim2.new(0, 400, 0, 18), BackgroundColor3 = Color3.fromRGB(40, 20, 30), BackgroundTransparency = 0.2 }, gui)
	corner(hpFrame, 9)
	local hpFill = mk("Frame", { Name = "Fill", Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(230, 70, 90), BorderSizePixel = 0 }, hpFrame)
	corner(hpFill, 9)
	mk("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(150, 150, 150)) }, hpFill)
	local hpText = label(hpFrame, { Size = UDim2.new(1, 0, 1, 0), TextSize = 13, Text = "평판 100 / 100", ZIndex = 2 })

	-- 콤보
	local comboFrame = mk("Frame", { Name = "Combo", Visible = false, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 96), Size = UDim2.new(0, 260, 0, 30), BackgroundTransparency = 1 }, gui)
	local comboScale = mk("UIScale", { Scale = 1 }, comboFrame) :: UIScale
	local comboLabel = label(comboFrame, { Size = UDim2.new(1, 0, 0, 22), TextSize = 19, Font = FONT_BLACK, TextColor3 = Color3.fromRGB(255, 170, 60), TextStrokeTransparency = 0.4, Text = "" })
	local comboBarBg = mk("Frame", { Position = UDim2.new(0.2, 0, 0, 24), Size = UDim2.new(0.6, 0, 0, 5), BackgroundColor3 = Color3.fromRGB(40, 30, 30), BorderSizePixel = 0 }, comboFrame)
	corner(comboBarBg, 3)
	local comboBar = mk("Frame", { Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(255, 170, 60), BorderSizePixel = 0 }, comboBarBg)
	corner(comboBar, 3)

	-- 이벤트 배너
	local eventBanner = label(gui, { Name = "Event", Visible = false, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 128), Size = UDim2.new(0, 600, 0, 26), TextSize = 15, BackgroundColor3 = Color3.fromRGB(90, 40, 120), BackgroundTransparency = 0.2, TextColor3 = Color3.fromRGB(255, 235, 200), Text = "" })
	corner(eventBanner, 8)

	-- 주문 목록 (왼쪽)
	local orders = mk("Frame", { Name = "Orders", Position = UDim2.new(0, 12, 0, 100), Size = UDim2.new(0, 250, 0, 30), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = Color3.fromRGB(20, 16, 30), BackgroundTransparency = 0.35 }, gui)
	corner(orders, 10)
	mk("UIPadding", { PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8), PaddingTop = UDim.new(0, 6), PaddingBottom = UDim.new(0, 6) }, orders)
	mk("UIListLayout", { Padding = UDim.new(0, 3), SortOrder = Enum.SortOrder.LayoutOrder }, orders)
	local ordersTitle = label(orders, { Size = UDim2.new(1, 0, 0, 20), TextSize = 15, TextXAlignment = Enum.TextXAlignment.Left, Text = "🍽 주문 없음", LayoutOrder = 0 })
	local orderRows = {}
	for i = 1, 6 do
		local row = mk("Frame", { Visible = false, Size = UDim2.new(1, 0, 0, 30), BackgroundTransparency = 1, LayoutOrder = i }, orders)
		local text = label(row, { Size = UDim2.new(1, 0, 0, 20), TextSize = 14, Font = FONT_REG, TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd, Text = "" })
		local barBg = mk("Frame", { Position = UDim2.new(0, 0, 0, 22), Size = UDim2.new(1, 0, 0, 4), BackgroundColor3 = Color3.fromRGB(40, 35, 55), BorderSizePixel = 0 }, row)
		corner(barBg, 2)
		local bar = mk("Frame", { Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(120, 230, 120), BorderSizePixel = 0 }, barBg)
		corner(bar, 2)
		orderRows[i] = { row = row, text = text, bar = bar, barBg = barBg }
	end

	-- 버튼 (오른쪽 위)
	-- 오른쪽 위 로블록스 플레이어 목록(리더보드)과 겹치지 않도록 왼쪽으로 띄움
	local buttons = mk("Frame", { Name = "Buttons", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -372, 0, 100), Size = UDim2.new(0, 330, 0, 40), BackgroundTransparency = 1 }, gui)
	mk("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Right, Padding = UDim.new(0, 6) }, buttons)
	local function button(text: string, width: number): TextButton
		local b = mk("TextButton", { Size = UDim2.new(0, width, 1, 0), BackgroundColor3 = Color3.fromRGB(90, 50, 150), Text = text, Font = FONT, TextSize = 15, TextColor3 = Color3.fromRGB(255, 255, 255), AutoButtonColor = true }, buttons) :: TextButton
		corner(b, 10)
		return b
	end
	self.recipeButton = button("📖 레시피 (R)", 110)
	self.shopButton = button("🛒 상점 (B)", 100)
	self.wardrobeButton = button("🎩 옷장 (C)", 100)

	-- 밤 목표
	local challengeBox = label(gui, { Name = "Challenge", Visible = false, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -372, 0, 146), Size = UDim2.new(0, 330, 0, 44), TextSize = 15, BackgroundColor3 = Color3.fromRGB(20, 16, 30), BackgroundTransparency = 0.3, Text = "" })
	corner(challengeBox, 10)
	local challengeStroke = mk("UIStroke", { Color = Color3.fromRGB(255, 200, 90), Thickness = 1.5, Transparency = 0.3 }, challengeBox) :: UIStroke

	-- 준비 완료 버튼
	local readyButton = mk("TextButton", { Name = "Ready", Visible = false, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -190), Size = UDim2.new(0, 260, 0, 40), BackgroundColor3 = Color3.fromRGB(40, 120, 80), Font = FONT, TextSize = 17, TextColor3 = Color3.fromRGB(255, 255, 255), Text = "✅ 준비 완료", AutoButtonColor = true }, gui) :: TextButton
	corner(readyButton, 10)
	local readyLocal = false
	readyButton.MouseButton1Click:Connect(function()
		readyLocal = not readyLocal
		self.onReady()
	end)

	-- 부적 게이지 + 버튼
	local talismanFrame = mk("Frame", { Name = "Talisman", Visible = false, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -146), Size = UDim2.new(0, 360, 0, 30), BackgroundColor3 = Color3.fromRGB(20, 16, 30), BackgroundTransparency = 0.35 }, gui)
	corner(talismanFrame, 8)
	local talismanLabel = label(talismanFrame, { Position = UDim2.new(0, 10, 0, 2), Size = UDim2.new(1, -20, 0, 18), TextSize = 14, TextXAlignment = Enum.TextXAlignment.Left, Text = "🧧 부적 0%" })
	local talismanBarBg = mk("Frame", { Position = UDim2.new(0, 10, 0, 22), Size = UDim2.new(1, -20, 0, 5), BackgroundColor3 = Color3.fromRGB(50, 40, 60), BorderSizePixel = 0 }, talismanFrame)
	corner(talismanBarBg, 3)
	local talismanBar = mk("Frame", { Size = UDim2.new(0, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(255, 200, 80), BorderSizePixel = 0 }, talismanBarBg)
	corner(talismanBar, 3)
	local talismanButtons = mk("Frame", { Name = "TalismanButtons", Visible = false, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -184), Size = UDim2.new(0, 480, 0, 40), BackgroundTransparency = 1 }, gui)
	mk("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 8) }, talismanButtons)
	self.onTalisman = function(_id) end
	for _, t in Talismans.List do
		local b = mk("TextButton", { Size = UDim2.new(0, 152, 1, 0), BackgroundColor3 = Color3.fromRGB(180, 120, 40), Font = FONT, TextSize = 14, TextColor3 = Color3.fromRGB(255, 255, 255), Text = string.format("[%s] %s %s", t.key, t.emoji, t.name), AutoButtonColor = true }, talismanButtons) :: TextButton
		corner(b, 10)
		mk("UIStroke", { Color = Color3.fromRGB(255, 230, 150), Thickness = 1.5 }, b)
		b.MouseButton1Click:Connect(function()
			self.onTalisman(t.id)
		end)
	end

	-- 유물 투표 패널 (Attribute 로 동기화되어 늦게 들어와도 보임)
	local relicPanel = mk("Frame", { Name = "RelicVote", Visible = false, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 620, 0, 290), BackgroundColor3 = Color3.fromRGB(28, 22, 40), BackgroundTransparency = 0.05, ZIndex = 15 }, gui)
	corner(relicPanel, 16)
	mk("UIStroke", { Color = Color3.fromRGB(200, 120, 255), Thickness = 2 }, relicPanel)
	label(relicPanel, { Position = UDim2.new(0, 0, 0, 12), Size = UDim2.new(1, 0, 0, 30), TextSize = 21, Text = "🔮 도깨비 상인의 유물 — 하나를 골라 투표하세요", ZIndex = 16 })
	local relicTimer = label(relicPanel, { Position = UDim2.new(0, 0, 0, 42), Size = UDim2.new(1, 0, 0, 20), TextSize = 14, Font = FONT_REG, TextColor3 = Color3.fromRGB(220, 200, 240), Text = "", ZIndex = 16 })
	local relicCards = {}
	self.onRelicVote = function(_index) end
	for i = 1, 3 do
		local card = mk("Frame", { Position = UDim2.new(0, 16 + (i - 1) * 198, 0, 68), Size = UDim2.new(0, 190, 0, 206), BackgroundColor3 = Color3.fromRGB(45, 38, 62), ZIndex = 16 }, relicPanel)
		corner(card, 12)
		local emoji = label(card, { Position = UDim2.new(0, 0, 0, 8), Size = UDim2.new(1, 0, 0, 44), TextSize = 38, Text = "", ZIndex = 17 })
		local name = label(card, { Position = UDim2.new(0, 8, 0, 54), Size = UDim2.new(1, -16, 0, 24), TextSize = 17, TextColor3 = Color3.fromRGB(255, 230, 170), Text = "", ZIndex = 17 })
		local desc = label(card, { Position = UDim2.new(0, 8, 0, 80), Size = UDim2.new(1, -16, 0, 58), TextSize = 14, Font = FONT_REG, TextColor3 = Color3.fromRGB(225, 220, 235), TextYAlignment = Enum.TextYAlignment.Top, Text = "", ZIndex = 17 })
		local votes = label(card, { Position = UDim2.new(0, 8, 0, 140), Size = UDim2.new(1, -16, 0, 20), TextSize = 14, TextColor3 = Color3.fromRGB(200, 255, 200), Text = "투표 0", ZIndex = 17 })
		local voteButton = mk("TextButton", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -8), Size = UDim2.new(1, -16, 0, 32), BackgroundColor3 = Color3.fromRGB(120, 60, 180), Font = FONT, TextSize = 15, TextColor3 = Color3.fromRGB(255, 255, 255), Text = "이걸로!", ZIndex = 17 }, card) :: TextButton
		corner(voteButton, 8)
		voteButton.MouseButton1Click:Connect(function()
			self.onRelicVote(i)
		end)
		relicCards[i] = { card = card, emoji = emoji, name = name, desc = desc, votes = votes, button = voteButton }
	end
	local relicOfferShown = ""

	-- 손에 든 것 / 힌트
	local held = label(gui, { Name = "Held", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -110), Size = UDim2.new(0, 360, 0, 30), TextSize = 18, BackgroundColor3 = Color3.fromRGB(20, 16, 30), BackgroundTransparency = 0.35, Text = "🖐 빈손" })
	corner(held, 8)
	local hint = label(gui, { Name = "Hint", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -76), Size = UDim2.new(0, 620, 0, 28), TextSize = 15, Font = FONT_REG, TextColor3 = Color3.fromRGB(215, 205, 235), Text = "" })

	-- 보유 유물
	local relicRow = label(gui, { Name = "Relics", Visible = false, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 158), Size = UDim2.new(0, 640, 0, 24), TextSize = 14, Font = FONT_REG, TextColor3 = Color3.fromRGB(230, 200, 255), Text = "" })

	-- 알림(토스트)
	local toasts = mk("Frame", { Name = "Toasts", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 190), Size = UDim2.new(0, 560, 0, 200), BackgroundTransparency = 1 }, gui)
	mk("UIListLayout", { HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, toasts)

	-- 큰 안내
	local announceBar = mk("Frame", { Name = "AnnounceBar", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.32, 0), Size = UDim2.new(1, 0, 0, 110), BackgroundColor3 = Color3.fromRGB(10, 8, 18), BackgroundTransparency = 1, BorderSizePixel = 0 }, gui)
	mk("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.2, 0), NumberSequenceKeypoint.new(0.8, 0), NumberSequenceKeypoint.new(1, 1) }) }, announceBar)
	local announce = label(gui, { Name = "Announce", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.32, -8), Size = UDim2.new(0, 760, 0, 70), TextSize = 46, Font = FONT_BLACK, TextTransparency = 1, TextStrokeTransparency = 1, TextStrokeColor3 = Color3.fromRGB(0, 0, 0) })
	local announceSub = label(gui, { Name = "AnnounceSub", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.32, 36), Size = UDim2.new(0, 760, 0, 34), TextSize = 21, Font = FONT_REG, TextTransparency = 1, TextColor3 = Color3.fromRGB(255, 220, 150) })

	-- 밤 요약
	local summary = mk("Frame", { Name = "Summary", Visible = false, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 440, 0, 300), BackgroundColor3 = Color3.fromRGB(28, 22, 40), BackgroundTransparency = 0.05, ZIndex = 15 }, gui)
	corner(summary, 16)
	mk("UIStroke", { Color = Color3.fromRGB(255, 200, 90), Thickness = 2 }, summary)
	local summaryTitle = label(summary, { Position = UDim2.new(0, 0, 0, 14), Size = UDim2.new(1, 0, 0, 40), TextSize = 28, Text = "", ZIndex = 16 })
	local summaryBody = label(summary, { Position = UDim2.new(0, 28, 0, 62), Size = UDim2.new(1, -56, 1, -100), TextSize = 18, Font = FONT_REG, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, RichText = true, ZIndex = 16 })
	local summaryClose = mk("TextButton", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -12), Size = UDim2.new(0, 140, 0, 30), BackgroundColor3 = Color3.fromRGB(90, 50, 150), Font = FONT, TextSize = 15, TextColor3 = Color3.fromRGB(255, 255, 255), Text = "닫기", ZIndex = 16 }, summary) :: TextButton
	corner(summaryClose, 8)
	summaryClose.MouseButton1Click:Connect(function()
		summary.Visible = false
	end)

	-- 결과 화면
	local result = mk("Frame", { Name = "Result", Visible = false, Size = UDim2.new(1, 0, 1, 0), BackgroundColor3 = Color3.fromRGB(10, 8, 16), BackgroundTransparency = 0.25, ZIndex = 20 }, gui)
	local resultBox = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 600, 0, 560), BackgroundColor3 = Color3.fromRGB(28, 22, 40), ZIndex = 21 }, result)
	mk("UISizeConstraint", { MaxSize = Vector2.new(600, 560), MinSize = Vector2.new(320, 300) }, resultBox)
	corner(resultBox, 16)
	mk("UIStroke", { Color = Color3.fromRGB(200, 80, 120), Thickness = 2 }, resultBox)
	local resultTitle = label(resultBox, { Position = UDim2.new(0, 0, 0, 18), Size = UDim2.new(1, 0, 0, 48), TextSize = 34, Text = "💀 폐업", ZIndex = 22 })
	local resultBody = label(resultBox, { Position = UDim2.new(0, 30, 0, 78), Size = UDim2.new(1, -60, 1, -118), TextSize = 18, Font = FONT_REG, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, ZIndex = 22, RichText = true })
	label(resultBox, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -14), Size = UDim2.new(1, -40, 0, 24), TextSize = 15, Font = FONT_REG, TextColor3 = Color3.fromRGB(200, 190, 220), Text = "잠시 후 새 영업이 시작됩니다", ZIndex = 22 })

	-- ---------- 동작 ----------
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
		local scale = mk("UIScale", { Scale = 0.7 }, t)
		TweenService:Create(scale, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
		local count = 0
		for _, c in toasts:GetChildren() do
			if c:IsA("TextLabel") then
				count += 1
			end
		end
		if count > 4 then
			for _, c in toasts:GetChildren() do
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
		announce.Position = UDim2.new(0.5, 0, 0.32, -24)
		TweenService:Create(announce, show, { TextTransparency = 0, TextStrokeTransparency = 0.5, Position = UDim2.new(0.5, 0, 0.32, -8) }):Play()
		TweenService:Create(announceSub, show, { TextTransparency = 0 }):Play()
		TweenService:Create(announceBar, show, { BackgroundTransparency = 0.35 }):Play()
		task.delay(3.2, function()
			local hide = TweenInfo.new(0.8)
			TweenService:Create(announce, hide, { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
			TweenService:Create(announceSub, hide, { TextTransparency = 1 }):Play()
			TweenService:Create(announceBar, hide, { BackgroundTransparency = 1 }):Play()
		end)
	end

	function self.setHeld(text: string?)
		held.Text = if text then "🖐 손에: " .. text else "🖐 빈손"
	end

	function self.setHint(text: string)
		hint.Text = text
	end

	-- 주문 목록: { {name, orders, fraction(-1 이면 대기 안 함), mood} }
	function self.updateOrders(list)
		table.sort(list, function(a, b)
			local fa = if a.fraction < 0 then 2 else a.fraction
			local fb = if b.fraction < 0 then 2 else b.fraction
			return fa < fb
		end)
		local waiting = 0
		for _, e in list do
			if e.fraction >= 0 then
				waiting += 1
			end
		end
		ordersTitle.Text = if #list == 0 then "🍽 주문 없음" else string.format("🍽 주문 %d개 (대기 %d)", #list, waiting)
		for i, r in orderRows do
			local e = list[i]
			if e then
				r.row.Visible = true
				r.text.Text = string.format("%s · %s", e.orders, e.name)
				if e.fraction >= 0 then
					r.barBg.Visible = true
					r.bar.Size = UDim2.new(e.fraction, 0, 1, 0)
					r.bar.BackgroundColor3 = if e.fraction > 0.5 then Color3.fromRGB(120, 230, 120) elseif e.fraction > 0.25 then Color3.fromRGB(255, 200, 80) else Color3.fromRGB(255, 70, 60)
					r.text.TextColor3 = Color3.fromRGB(245, 240, 235)
				else
					r.barBg.Visible = false
					r.text.TextColor3 = Color3.fromRGB(170, 165, 185)
				end
			else
				r.row.Visible = false
			end
		end
	end

	local lastHp = nil
	function self.hpHit()
		hpFill.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
		TweenService:Create(hpFill, TweenInfo.new(0.5), { BackgroundColor3 = Color3.fromRGB(230, 70, 90) }):Play()
		hpFrame.Position = UDim2.new(0.5, 6, 0, 74)
		TweenService:Create(hpFrame, TweenInfo.new(0.3, Enum.EasingStyle.Elastic, Enum.EasingDirection.Out), { Position = UDim2.new(0.5, 0, 0, 74) }):Play()
	end

	function self.showSummary(p)
		summaryTitle.Text = string.format("☀️ %d번째 밤 종료!", p.night or 0)
		local lines = {
			string.format("서빙 <b>%d</b> · 성불 <b>%d</b> · 팁 <b>%d</b>회 · 최대 콤보 <b>x%d</b>", p.served or 0, p.ascended or 0, p.tips or 0, p.maxCombo or 0),
			string.format("악귀 <b>%d</b> · 탄 음식 <b>%d</b>", p.angry or 0, p.burnt or 0),
			string.format("밤 보너스 <font color=\"#FFD27F\">+%d 코인</font>", p.bonus or 0),
		}
		if p.challengeName then
			if p.challengeDone then
				table.insert(lines, string.format("밤 목표 %s: <font color=\"#9AF0A0\">달성! +%d 코인</font>", p.challengeName, p.challengeBonus or 0))
			else
				table.insert(lines, string.format("밤 목표 %s: <font color=\"#FF9090\">실패</font>", p.challengeName))
			end
		end
		if p.mvp and p.mvp ~= "" then
			table.insert(lines, string.format("🏆 이번 밤 MVP: <b>%s</b> (%d 서빙)", p.mvp, p.mvpServed or 0))
		end
		table.insert(lines, string.format("✨ 명성 +%d (모두)", p.fame or 0))
		summaryBody.Text = table.concat(lines, "\n")
		summary.Visible = true
		local scale = summary:FindFirstChildOfClass("UIScale") or mk("UIScale", { Scale = 1 }, summary)
		scale.Scale = 0.8
		TweenService:Create(scale, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
		task.delay(9, function()
			summary.Visible = false
		end)
	end

	function self.hideSummary()
		summary.Visible = false
	end

	function self.showResult(data)
		resultTitle.Text = string.format("💀 폐업 — %d번째 밤에 무너짐", data.night or 0)
		local lines = {
			string.format("서빙한 요리: <b>%d</b>  ·  성불한 영혼: <b>%d</b>  ·  최대 콤보: <b>x%d</b>", data.served or 0, data.ascended or 0, data.maxCombo or 0),
			string.format("악귀가 된 손님: <b>%d</b>  ·  탄 음식: <b>%d</b>  ·  화재: <b>%d</b>  ·  부적 사용: <b>%d</b>", data.angry or 0, data.burnt or 0, data.fires or 0, data.talismans or 0),
			string.format("번 코인: <b>%d</b> (팁 %d)", data.earned or 0, data.tips or 0),
		}
		if data.relics and data.relics ~= "" then
			table.insert(lines, "🔮 유물: " .. data.relics)
		end
		if data.mvp and data.mvp ~= "" then
			table.insert(lines, string.format("🏆 이번 판 MVP: <b>%s</b>", data.mvp))
		end
		if data.reviews then
			table.insert(lines, "")
			table.insert(lines, "<b>💬 손님 리뷰</b>")
			for _, r in data.reviews do
				table.insert(lines, "  " .. r)
			end
		end
		table.insert(lines, "")
		table.insert(lines, "<b>요리사별 서빙 · 얻은 명성</b>")
		for _, p in data.players or {} do
			table.insert(lines, string.format("  %s — 서빙 %d · 명성 +%d", p.name, p.served, p.fame or 0))
		end
		resultBody.Text = table.concat(lines, "\n")
		result.Visible = true
	end

	function self.hideResult()
		result.Visible = false
	end

	local displayedCoins = 0
	local lastCombo = 0
	local lastPhase = ""

	-- 상태 폴더의 Attribute 를 읽어 화면 갱신
	function self.update(state: Instance)
		local phase = attrS(state, "Phase")
		if phase == "" then
			phase = "lobby"
		end
		local night = attrN(state, "Night")
		local hp = attrN(state, "Hp")
		local maxHp = attrN(state, "MaxHp")
		if maxHp <= 0 then
			maxHp = 100
		end
		local coins = attrN(state, "Coins")
		local total = attrN(state, "CustomersTotal")
		local done = attrN(state, "CustomersDone")
		local endsAt = attrN(state, "PhaseEndsAt")
		local t = now()

		if phase ~= lastPhase then
			lastPhase = phase
			readyLocal = false
		end

		if phase == "night" then
			nightLabel.Text = string.format("🌙 %d번째 밤", night)
		elseif phase == "day" then
			nightLabel.Text = string.format("☀️ %d번째 밤 종료", night)
		else
			nightLabel.Text = "🏮 저승 휴게소"
		end
		phaseLabel.Text = PHASE_TEXT[phase] or phase
		if endsAt > 0 then
			timerLabel.Text = string.format("%d", math.ceil(math.max(0, endsAt - t)))
		else
			timerLabel.Text = if phase == "night" then "🔥" else ""
		end
		custLabel.Text = if phase == "night" then string.format("손님 %d / %d", done, total) else ""

		displayedCoins += (coins - displayedCoins) * 0.4
		if math.abs(coins - displayedCoins) < 1 then
			displayedCoins = coins
		end
		coinLabel.Text = string.format("🪙 %d 코인", math.floor(displayedCoins + 0.5))

		local frac = math.clamp(hp / maxHp, 0, 1)
		hpFill.Size = UDim2.new(frac, 0, 1, 0)
		if lastHp ~= nil and hp < lastHp then
			self.hpHit()
		else
			hpFill.BackgroundColor3 = if frac > 0.5 then Color3.fromRGB(230, 70, 90) elseif frac > 0.25 then Color3.fromRGB(235, 140, 60) else Color3.fromRGB(255, 40, 40)
		end
		lastHp = hp
		hpText.Text = string.format("평판 %d / %d", hp, maxHp)

		-- 콤보
		local combo = attrN(state, "Combo")
		local comboEnds = attrN(state, "ComboExpiresAt")
		if combo >= 2 and comboEnds > t then
			comboFrame.Visible = true
			comboLabel.Text = "🔥 " .. Combo.label(combo)
			comboBar.Size = UDim2.new(math.clamp((comboEnds - t) / Config.ComboWindow, 0, 1), 0, 1, 0)
			if combo > lastCombo then
				comboScale.Scale = 1.35
				TweenService:Create(comboScale, TweenInfo.new(0.3, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
			end
		else
			comboFrame.Visible = false
		end
		lastCombo = combo

		-- 이벤트
		local eventName = attrS(state, "EventName")
		if eventName ~= "" and phase == "night" then
			eventBanner.Visible = true
			eventBanner.Text = eventName .. " — " .. attrS(state, "EventDesc")
		else
			eventBanner.Visible = false
		end

		-- 밤 목표
		local challengeText = attrS(state, "ChallengeText")
		if challengeText ~= "" and (phase == "night" or phase == "day") then
			challengeBox.Visible = true
			challengeBox.Text = "🎯 밤 목표: " .. challengeText
			local ok = attrB(state, "ChallengeDone")
			challengeStroke.Color = if ok then Color3.fromRGB(120, 255, 150) else Color3.fromRGB(255, 200, 90)
			challengeBox.TextColor3 = if ok then Color3.fromRGB(190, 255, 200) else Color3.fromRGB(245, 240, 235)
		else
			challengeBox.Visible = false
		end

		-- 부적 게이지
		local talisman = attrN(state, "Talisman")
		local talismanMax = attrN(state, "TalismanMax")
		if talismanMax <= 0 then
			talismanMax = 100
		end
		if phase == "night" or phase == "day" then
			talismanFrame.Visible = true
			local pct = math.clamp(talisman / talismanMax, 0, 1)
			talismanBar.Size = UDim2.new(pct, 0, 1, 0)
			local full = pct >= 1
			talismanLabel.Text = if full then "🧧 부적 준비 완료! 1·2·3 키 또는 아래 버튼" else string.format("🧧 부적 %d%%  (서빙할수록 참)", math.floor(pct * 100))
			talismanBar.BackgroundColor3 = if full then Color3.fromRGB(255, 120, 200) else Color3.fromRGB(255, 200, 80)
			talismanButtons.Visible = full and phase == "night"
		else
			talismanFrame.Visible = false
			talismanButtons.Visible = false
		end
		local fortuneUntil = attrN(state, "FortuneUntil")
		if fortuneUntil > t then
			coinLabel.Text ..= string.format("  💰×%.1f %ds", Config.FortuneMult, math.ceil(fortuneUntil - t))
		end

		-- 보유 유물
		local relics = attrS(state, "Relics")
		if relics ~= "" then
			local names = {}
			for id in string.gmatch(relics, "[^,]+") do
				local r = Relics.get(id)
				if r then
					table.insert(names, r.emoji .. " " .. r.name)
				end
			end
			relicRow.Visible = true
			relicRow.Text = "🔮 유물: " .. table.concat(names, " · ")
		else
			relicRow.Visible = false
		end

		-- 유물 투표 패널
		local offer = attrS(state, "RelicOffer")
		if offer ~= "" then
			if offer ~= relicOfferShown then
				relicOfferShown = offer
				local ids = {}
				for id in string.gmatch(offer, "[^,]+") do
					table.insert(ids, id)
				end
				for i, card in relicCards do
					local relic = Relics.get(ids[i])
					card.card.Visible = relic ~= nil
					if relic then
						card.emoji.Text = relic.emoji
						card.name.Text = relic.name
						card.desc.Text = relic.desc
					end
				end
				relicPanel.Visible = true
			end
			local counts = {}
			for c in string.gmatch(attrS(state, "RelicVotes"), "[^,]+") do
				table.insert(counts, tonumber(c) or 0)
			end
			for i, card in relicCards do
				card.votes.Text = string.format("투표 %d", counts[i] or 0)
			end
			relicTimer.Text = string.format("%d초 뒤 확정 · 모두 투표하면 바로 확정", math.ceil(math.max(0, attrN(state, "RelicVoteEndsAt") - t)))
		else
			relicOfferShown = ""
			relicPanel.Visible = false
		end

		-- 준비 버튼
		if phase == "day" or phase == "countdown" then
			readyButton.Visible = true
			readyButton.Text = string.format("%s 준비 완료 (%d/%d)", if readyLocal then "☑" else "✅", attrN(state, "ReadyCount"), attrN(state, "ReadyTotal"))
			readyButton.BackgroundColor3 = if readyLocal then Color3.fromRGB(30, 160, 100) else Color3.fromRGB(40, 110, 80)
		else
			readyButton.Visible = false
		end
	end

	return self
end

return Hud
