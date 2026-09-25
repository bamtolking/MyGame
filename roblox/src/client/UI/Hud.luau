--!strict
-- 화면 고정 UI
--  · 위: 돈(동전 아이콘 + 숫자 카운트업 + 증감 표시), 초당 수입·배수·금고 칩, 날씨/대폭주/행운/부스트 칩
--  · 왼쪽: 메뉴 7개(알림 배지가 톡 튐)
--  · 오른쪽 아래: 뿅망치(쿨타임 게이지)·잠금(남은 시간 표시)·집 찾기
--  · 아래: 튜토리얼 말풍선(단계 표시, 둥실둥실)

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Format = require(Shared.Util.Format)
local Progress = require(Shared.Logic.Progress)
local Weather = require(Shared.Config.Weather)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local State = require(Client.State)
local Kit = require(script.Parent.Kit)
local Panel = require(script.Parent.Panel)

local Hud = {}

local gui: ScreenGui
local cashLabel: TextLabel
local coin: Frame
local incomeLabel: TextLabel
local multChip: TextLabel
local vaultChip: TextLabel
local weatherChip: TextLabel
local frenzyChip: TextLabel
local luckChip: TextLabel
local boostChip: TextLabel
local tutorialBubble: TextLabel
local tutorialStep: TextLabel
local bonkFill: Frame
local lockText: TextLabel
local menuBadges: { [string]: TextLabel } = {}
local badgeCounts: { [string]: number } = {}
local displayedCash = 0
local lastCash = 0
local lastIncome = 0

Hud.onBonk = nil :: (() -> ())?
Hud.onLock = nil :: (() -> ())?
Hud.onHome = nil :: (() -> ())?

local WEATHER_ICON: { [string]: string } = {
	golden = "☀️",
	crystal = "❄️",
	sugar = "🍬",
	volcano = "🌋",
	rainbow = "🌈",
	meteor = "☄️",
}

local function chip(parent: Instance, order: number, color: Color3): TextLabel
	local c = Kit.label({
		Size = UDim2.fromOffset(60, 30),
		AutomaticSize = Enum.AutomaticSize.X,
		BackgroundColor3 = color,
		BackgroundTransparency = 0,
		TextScaled = false,
		TextSize = 19,
		Text = "",
		LayoutOrder = order,
		Visible = false,
		Parent = parent,
	})
	Kit.corner(c, 15)
	Kit.gradient(c, Color3.new(1, 1, 1), Color3.fromRGB(205, 205, 205))
	local st = Kit.stroke(c, 2.5)
	st.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	local p = Instance.new("UIPadding")
	p.PaddingLeft = UDim.new(0, 12)
	p.PaddingRight = UDim.new(0, 12)
	p.Parent = c
	return c
end

local MENU = {
	{ key = "Shop", icon = "🛒", label = "menuShop", color = Kit.colors.green },
	{ key = "Index", icon = "📖", label = "menuIndex", color = Kit.colors.blue },
	{ key = "Rebirth", icon = "♻️", label = "menuRebirth", color = Kit.colors.pink },
	{ key = "Quests", icon = "📜", label = "menuQuests", color = Kit.colors.orange },
	{ key = "Gifts", icon = "🎁", label = "menuGifts", color = Kit.colors.red },
	{ key = "Store", icon = "💎", label = "menuStore", color = Kit.colors.purple },
	{ key = "Settings", icon = "⚙️", label = "menuSettings", color = Kit.colors.gray },
}

function Hud.setBadge(key: string, count: number)
	local b = menuBadges[key]
	if not b then
		return
	end
	local before = badgeCounts[key] or 0
	badgeCounts[key] = count
	b.Visible = count > 0
	b.Text = if count > 9 then "9+" elseif count > 0 then tostring(count) else ""
	if count > before then
		Kit.pop(b, 1.3)
	end
end

function Hud.setTutorial(text: string?, step: number?)
	local was = tutorialBubble.Visible
	tutorialBubble.Visible = text ~= nil
	if text and tutorialBubble.Text ~= text then
		tutorialBubble.Text = text
		Kit.pop(tutorialBubble, 0.6)
	elseif not text then
		tutorialBubble.Text = ""
	end
	tutorialStep.Visible = step ~= nil and text ~= nil
	if step then
		tutorialStep.Text = step .. "/3"
	end
	if text and not was then
		Kit.pop(tutorialBubble)
	end
end

function Hud.bonkCooldown(seconds: number)
	bonkFill.Visible = true
	bonkFill.Size = UDim2.fromScale(1, 1)
	Kit.tween(bonkFill, seconds, { Size = UDim2.fromScale(1, 0) }, Enum.EasingStyle.Linear).Completed:Connect(function()
		bonkFill.Visible = false
	end)
end

-- 동전이 날아올 목표(화면 위 돈 아이콘)
function Hud.cashAnchor(): GuiObject
	return coin
end

-- 돈 아이콘에 동전이 도착했을 때
function Hud.coinArrived()
	Kit.bump(coin, 0.25)
end

-- 돈 옆에 떠오르는 +$ / -$ 글자
function Hud.flyText(text: string, color: Color3)
	local label = Kit.label({
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 90, 0, 44),
		Size = UDim2.fromOffset(200, 30),
		Text = text,
		TextColor3 = color,
		stroke = 3,
		ZIndex = 20,
		Parent = gui,
	})
	Kit.pop(label, 0.8)
	Kit.tween(label, 1.1, { Position = UDim2.new(0.5, 110, 0, 8), TextTransparency = 1 }, Enum.EasingStyle.Quad)
	task.delay(1.15, function()
		label:Destroy()
	end)
end

local function refreshMoney(cash: number, vault: number, income: number)
	local delta = cash - lastCash
	lastCash = cash
	if delta > 0.5 then
		local from = displayedCash
		displayedCash = cash
		Kit.countTo(cashLabel, from, cash, Format.cash, if delta > income * 3 then 0.8 else 0.35)
		if delta > math.max(1, lastIncome * 1.5) then
			Hud.flyText("+" .. Format.cash(delta), Kit.colors.cash)
			Kit.bump(cashLabel, 0.14)
		end
	elseif delta < -0.5 then
		displayedCash = cash
		Kit.countTo(cashLabel, cash, cash, Format.cash, 0.01)
		Hud.flyText("-" .. Format.cash(-delta), Color3.fromRGB(255, 130, 130))
	end
	if income ~= lastIncome then
		incomeLabel.Text = "+" .. Format.cash(income) .. "/s"
		if income > lastIncome then
			Kit.bump(incomeLabel, 0.18)
		end
		lastIncome = income
	end
	local showVault = vault >= 1 and not State.hasPass("autoCollect")
	vaultChip.Visible = showVault
	vaultChip.Text = Lang.t("vaultChip", { cash = Format.cash(vault) })
	local view = State.view
	local mult = if view then view.multiplier else 1
	multChip.Visible = mult > 1.001
	multChip.Text = Format.mult(math.floor(mult * 100) / 100)
end

local function ownPlot(): Instance?
	local view = State.view
	if not view or view.plot == 0 then
		return nil
	end
	local map = Workspace:FindFirstChild("Map")
	local plots = map and map:FindFirstChild("Plots")
	return plots and plots:FindFirstChild("Plot" .. view.plot)
end

local pulse = 0
local function refreshChips()
	pulse += 1
	local world = ReplicatedStorage:FindFirstChild("WorldState")
	if not world then
		return
	end
	local now = Workspace:GetServerTimeNow()
	local weatherId = world:GetAttribute("Weather")
	if type(weatherId) == "string" and weatherId ~= "" and Weather.byId[weatherId] then
		local ends = world:GetAttribute("WeatherEnds")
		local left = if type(ends) == "number" then ends - now else 0
		if not weatherChip.Visible then
			Kit.pop(weatherChip)
		end
		weatherChip.Visible = true
		weatherChip.Text = (WEATHER_ICON[weatherId] or "🌦️") .. " " .. Lang.weather(weatherId) .. "  " .. Format.time(left)
	else
		weatherChip.Visible = false
	end

	local unix = os.time()
	if Progress.frenzyActive(unix) then
		frenzyChip.Text = Lang.t("frenzyNow", { t = Format.time(Progress.frenzyEndsAt(unix) - unix) })
		frenzyChip.BackgroundColor3 = Kit.colors.pink
		if pulse % 2 == 0 then
			Kit.bump(frenzyChip, 0.08)
		end
	else
		local wait = Progress.secondsUntilFrenzy(unix)
		frenzyChip.Text = Lang.t("frenzyIn", { t = Format.time(wait) })
		frenzyChip.BackgroundColor3 = if wait <= 60 then Kit.colors.orange else Kit.colors.bgLight
		if wait <= 60 and pulse % 2 == 0 then
			Kit.bump(frenzyChip, 0.1)
		end
	end
	frenzyChip.Visible = true

	local luck = world:GetAttribute("Luck")
	if type(luck) == "number" and luck > 1.01 then
		luckChip.Visible = true
		luckChip.Text = "🍀 " .. Lang.t("luckChip", { x = Format.mult(luck) })
	else
		luckChip.Visible = false
	end

	local data = State.data()
	local boost = data and data.boosts.cash2x
	if boost and boost > 0 then
		boostChip.Visible = true
		boostChip.Text = "💰x2 " .. Format.time(boost)
	else
		boostChip.Visible = false
	end

	-- 잠금 버튼에 남은 시간
	local plot = ownPlot()
	local lockEnds = plot and plot:GetAttribute("LockEnds")
	local cooldown = plot and plot:GetAttribute("LockCooldownEnds")
	if type(lockEnds) == "number" and lockEnds > now then
		lockText.Text = "🔒" .. math.ceil(lockEnds - now)
	elseif type(cooldown) == "number" and cooldown > now then
		lockText.Text = "⏳" .. math.ceil(cooldown - now)
	else
		lockText.Text = Lang.t("lockButton")
	end
	-- 금고 칩 반짝
	if vaultChip.Visible and pulse % 2 == 0 then
		Kit.bump(vaultChip, 0.07)
	end
end

local function roundButton(icon: string, text: string, color: Color3, size: number, pos: UDim2, onClick: () -> ()): (TextButton, TextLabel)
	local btn = Kit.button({
		Text = "",
		Color = color,
		Size = UDim2.fromOffset(size, size),
		AnchorPoint = Vector2.new(1, 1),
		Position = pos,
		Radius = size // 2,
		Parent = gui,
	}, onClick)
	Kit.label({ Size = UDim2.fromScale(1, 0.58), Text = icon, stroke = false, Parent = btn })
	local label = Kit.label({ Size = UDim2.fromScale(1, 0.32), Position = UDim2.fromScale(0, 0.6), Text = text, Parent = btn })
	return btn, label
end

function Hud.init()
	gui = Kit.new("ScreenGui", {
		Name = "HUD",
		ResetOnSpawn = false,
		DisplayOrder = 10,
		IgnoreGuiInset = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		Parent = Players.LocalPlayer:WaitForChild("PlayerGui"),
	}) :: ScreenGui

	-- 돈 패널
	local top = Kit.new("Frame", {
		Name = "Top",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 6),
		Size = UDim2.fromOffset(300, 58),
		BackgroundColor3 = Kit.colors.bg,
		Parent = gui,
	}) :: Frame
	Kit.corner(top, 20)
	Kit.stroke(top, 4)
	Kit.gradient(top, Color3.fromRGB(255, 255, 255), Color3.fromRGB(180, 175, 205))
	coin = Kit.new("Frame", {
		Name = "Coin",
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, 8, 0.5, 0),
		Size = UDim2.fromOffset(44, 44),
		BackgroundColor3 = Kit.colors.yellow,
		Parent = top,
	}) :: Frame
	Kit.corner(coin, 22)
	Kit.stroke(coin, 3, Color3.fromRGB(150, 95, 10))
	Kit.gradient(coin, Color3.fromRGB(255, 250, 200), Color3.fromRGB(255, 190, 40))
	Kit.label({ Text = "$", TextColor3 = Color3.fromRGB(255, 255, 255), stroke = 2.5, Size = UDim2.fromScale(0.8, 0.8), Position = UDim2.fromScale(0.1, 0.1), Parent = coin })
	cashLabel = Kit.label({
		Size = UDim2.new(1, -68, 1, -12),
		Position = UDim2.fromOffset(60, 6),
		Text = "$0",
		TextColor3 = Kit.colors.cash,
		TextXAlignment = Enum.TextXAlignment.Left,
		stroke = 3,
		Parent = top,
	})

	local row = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 70),
		Size = UDim2.fromOffset(520, 30),
		BackgroundTransparency = 1,
		Parent = gui,
	}) :: Frame
	Kit.list(row, false, 8, Enum.HorizontalAlignment.Center)
	incomeLabel = chip(row, 1, Kit.colors.green)
	incomeLabel.Visible = true
	incomeLabel.Text = "+$0/s"
	multChip = chip(row, 2, Kit.colors.purple)
	vaultChip = chip(row, 3, Kit.colors.orange)

	local chips = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 106),
		Size = UDim2.fromOffset(680, 30),
		BackgroundTransparency = 1,
		Parent = gui,
	}) :: Frame
	Kit.list(chips, false, 8, Enum.HorizontalAlignment.Center)
	weatherChip = chip(chips, 1, Kit.colors.blue)
	frenzyChip = chip(chips, 2, Kit.colors.bgLight)
	luckChip = chip(chips, 3, Kit.colors.green)
	boostChip = chip(chips, 4, Kit.colors.yellow)

	-- 왼쪽 메뉴(2열)
	local menu = Kit.new("Frame", {
		Name = "Menu",
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, 10, 0.5, 0),
		Size = UDim2.fromOffset(142, 290),
		BackgroundTransparency = 1,
		Parent = gui,
	}) :: Frame
	local grid = Instance.new("UIGridLayout")
	grid.CellSize = UDim2.fromOffset(66, 66)
	grid.CellPadding = UDim2.fromOffset(8, 10)
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.Parent = menu
	local menuScale = Instance.new("UIScale")
	menuScale.Parent = menu
	for i, m in MENU do
		local btn = Kit.button({ Text = "", Color = m.color, LayoutOrder = i, Radius = 18, Parent = menu }, function()
			Panel.toggle(m.key)
		end)
		Kit.label({ Size = UDim2.new(1, 0, 0.6, 0), Text = m.icon, stroke = false, Parent = btn })
		Kit.label({ Size = UDim2.new(1, 4, 0.34, 0), Position = UDim2.new(0, -2, 0.62, 0), Text = Lang.t(m.label), Parent = btn })
		menuBadges[m.key] = Kit.badge(btn)
	end

	-- 오른쪽 아래 버튼 묶음
	local bonkText = if UserInputService.KeyboardEnabled then "BONK [F]" else "BONK"
	local bonkBtn = roundButton("🔨", bonkText, Kit.colors.orange, 98, UDim2.new(1, -18, 1, -146), function()
		if Hud.onBonk then
			Hud.onBonk()
		end
	end)
	bonkFill = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, 9),
		Size = UDim2.fromScale(1, 0),
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 0.45,
		Visible = false,
		ZIndex = 5,
		Parent = bonkBtn,
	}) :: Frame
	Kit.corner(bonkFill, 49)
	local _, lockLabel = roundButton("🔒", Lang.t("lockButton"), Kit.colors.red, 72, UDim2.new(1, -128, 1, -152), function()
		if Hud.onLock then
			Hud.onLock()
		end
	end)
	lockText = lockLabel
	roundButton("🏠", Lang.t("homeButton"), Kit.colors.blue, 64, UDim2.new(1, -35, 1, -262), function()
		if Hud.onHome then
			Hud.onHome()
		end
	end)

	-- 튜토리얼 말풍선
	tutorialBubble = Kit.label({
		Name = "Tutorial",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -26),
		Size = UDim2.new(0.7, 0, 0, 58),
		BackgroundColor3 = Kit.colors.yellow,
		TextColor3 = Kit.colors.white,
		Text = "",
		Visible = false,
		stroke = 3,
		Parent = gui,
	})
	Kit.corner(tutorialBubble, 18)
	Kit.gradient(tutorialBubble, Color3.new(1, 1, 1), Color3.fromRGB(215, 215, 215))
	local tst = Kit.stroke(tutorialBubble, 4)
	tst.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	local tpad = Instance.new("UIPadding")
	tpad.PaddingLeft = UDim.new(0, 58)
	tpad.PaddingRight = UDim.new(0, 12)
	tpad.PaddingTop = UDim.new(0, 6)
	tpad.PaddingBottom = UDim.new(0, 6)
	tpad.Parent = tutorialBubble
	local tsc = Instance.new("UISizeConstraint")
	tsc.MaxSize = Vector2.new(600, 64)
	tsc.Parent = tutorialBubble
	tutorialStep = Kit.pill(tutorialBubble, "1/3", Kit.colors.orange, {
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, -50, 0.5, 0),
		Size = UDim2.fromOffset(44, 30),
	})

	-- 작은 화면에서 메뉴 크기 조정
	local function rescale()
		local cam = Workspace.CurrentCamera
		if cam then
			menuScale.Scale = math.clamp(cam.ViewportSize.Y / 640, 0.7, 1.1)
		end
	end
	rescale()
	local cam = Workspace.CurrentCamera
	if cam then
		cam:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	end

	State.money:Connect(refreshMoney)
	State.changed:Connect(function(view)
		refreshMoney(view.data.cash, view.data.vault, view.income)
	end)
	local acc = 0
	local t = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		t += dt
		if acc >= 0.5 then
			acc = 0
			refreshChips()
		end
		-- 튜토리얼 말풍선 둥실둥실
		if tutorialBubble.Visible then
			tutorialBubble.Position = UDim2.new(0.5, 0, 1, -26 - math.abs(math.sin(t * 2.4)) * 6)
		end
	end)
end

function Hud.gui(): ScreenGui
	return gui
end

return Hud
