--!strict
-- 화면 고정 UI: 돈·수입·금고, 날씨/대폭주/행운 칩, 왼쪽 메뉴, 뿅망치·잠금 버튼, 튜토리얼 말풍선.

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
local incomeLabel: TextLabel
local vaultChip: TextLabel
local chips: Frame
local weatherChip: TextLabel
local frenzyChip: TextLabel
local luckChip: TextLabel
local boostChip: TextLabel
local tutorialBubble: TextLabel
local bonkCooldown: Frame
local menuBadges: { [string]: TextLabel } = {}

Hud.onBonk = nil :: (() -> ())?
Hud.onLock = nil :: (() -> ())?

local function chip(parent: Instance, order: number, color: Color3): TextLabel
	local c = Kit.label({
		Size = UDim2.fromOffset(150, 28),
		AutomaticSize = Enum.AutomaticSize.X,
		BackgroundColor3 = color,
		BackgroundTransparency = 0.05,
		TextScaled = false,
		TextSize = 18,
		Text = "",
		LayoutOrder = order,
		Visible = false,
		Parent = parent,
	})
	Kit.corner(c, 14)
	Kit.stroke(c, 2).ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	local p = Instance.new("UIPadding")
	p.PaddingLeft = UDim.new(0, 10)
	p.PaddingRight = UDim.new(0, 10)
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
	if b then
		b.Visible = count > 0
		b.Text = if count > 9 then "9+" elseif count > 0 then tostring(count) else ""
	end
end

function Hud.setTutorial(text: string?)
	tutorialBubble.Visible = text ~= nil
	tutorialBubble.Text = text or ""
end

function Hud.bonkCooldown(seconds: number)
	bonkCooldown.Visible = true
	bonkCooldown.Size = UDim2.fromScale(1, 1)
	Kit.tween(bonkCooldown, seconds, { Size = UDim2.fromScale(1, 0) }, Enum.EasingStyle.Linear).Completed:Connect(function()
		bonkCooldown.Visible = false
	end)
end

local function refreshMoney(cash: number, vault: number, income: number)
	cashLabel.Text = "💵 " .. Format.cash(cash)
	incomeLabel.Text = "+" .. Format.cash(income) .. "/s"
	vaultChip.Visible = vault >= 1 and not State.hasPass("autoCollect")
	vaultChip.Text = Lang.t("vaultChip", { cash = Format.cash(vault) })
end

local function refreshChips()
	local world = ReplicatedStorage:FindFirstChild("WorldState")
	if not world then
		return
	end
	local now = Workspace:GetServerTimeNow()
	local weatherId = world:GetAttribute("Weather")
	if type(weatherId) == "string" and weatherId ~= "" and Weather.byId[weatherId] then
		local ends = world:GetAttribute("WeatherEnds")
		local left = if type(ends) == "number" then ends - now else 0
		weatherChip.Visible = true
		weatherChip.Text = Lang.weather(weatherId) .. "  " .. Format.time(left)
	else
		weatherChip.Visible = false
	end

	local unix = os.time()
	if Progress.frenzyActive(unix) then
		frenzyChip.Text = Lang.t("frenzyNow", { t = Format.time(Progress.frenzyEndsAt(unix) - unix) })
		frenzyChip.BackgroundColor3 = Kit.colors.pink
	else
		frenzyChip.Text = Lang.t("frenzyIn", { t = Format.time(Progress.secondsUntilFrenzy(unix)) })
		frenzyChip.BackgroundColor3 = Kit.colors.bgLight
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

	-- 돈
	local top = Kit.new("Frame", {
		Name = "Top",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 6),
		Size = UDim2.fromOffset(280, 56),
		BackgroundColor3 = Kit.colors.bg,
		Parent = gui,
	}) :: Frame
	Kit.corner(top, 18)
	Kit.stroke(top, 4)
	cashLabel = Kit.label({
		Size = UDim2.new(1, -20, 1, -10),
		Position = UDim2.fromOffset(10, 5),
		Text = "💵 $0",
		TextColor3 = Kit.colors.cash,
		stroke = 3,
		Parent = top,
	})

	local row = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 66),
		Size = UDim2.fromOffset(420, 28),
		BackgroundTransparency = 1,
		Parent = gui,
	}) :: Frame
	Kit.list(row, false, 8, Enum.HorizontalAlignment.Center)
	incomeLabel = chip(row, 1, Kit.colors.green)
	incomeLabel.Visible = true
	incomeLabel.Text = "+$0/s"
	vaultChip = chip(row, 2, Kit.colors.orange)

	chips = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 100),
		Size = UDim2.fromOffset(640, 28),
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
		Size = UDim2.fromOffset(134, 270),
		BackgroundTransparency = 1,
		Parent = gui,
	}) :: Frame
	local grid = Instance.new("UIGridLayout")
	grid.CellSize = UDim2.fromOffset(62, 62)
	grid.CellPadding = UDim2.fromOffset(8, 8)
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.Parent = menu
	local menuScale = Instance.new("UIScale")
	menuScale.Parent = menu
	for i, m in MENU do
		local btn = Kit.button({ Text = "", Color = m.color, LayoutOrder = i, Radius = 16, Parent = menu }, function()
			Panel.toggle(m.key)
		end)
		Kit.label({
			Size = UDim2.new(1, 0, 0.62, 0),
			Text = m.icon,
			stroke = false,
			Parent = btn,
		})
		Kit.label({
			Size = UDim2.new(1, 0, 0.36, 0),
			Position = UDim2.fromScale(0, 0.64),
			Text = Lang.t(m.label),
			Parent = btn,
		})
		menuBadges[m.key] = Kit.badge(btn)
	end

	-- 뿅망치 · 잠금
	local bonkBtn = Kit.button({
		Text = "",
		Color = Kit.colors.orange,
		Size = UDim2.fromOffset(92, 92),
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.new(1, -18, 1, -150),
		Radius = 46,
		Parent = gui,
	}, function()
		if Hud.onBonk then
			Hud.onBonk()
		end
	end)
	Kit.label({ Size = UDim2.fromScale(1, 0.6), Text = "🔨", stroke = false, Parent = bonkBtn })
	local bonkText = if UserInputService.KeyboardEnabled then "BONK [F]" else "BONK"
	Kit.label({ Size = UDim2.fromScale(1, 0.34), Position = UDim2.fromScale(0, 0.62), Text = bonkText, Parent = bonkBtn })
	bonkCooldown = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.fromScale(0.5, 1),
		Size = UDim2.fromScale(1, 0),
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 0.45,
		Visible = false,
		ZIndex = 5,
		Parent = bonkBtn,
	}) :: Frame
	Kit.corner(bonkCooldown, 46)

	local lockBtn = Kit.button({
		Text = "",
		Color = Kit.colors.red,
		Size = UDim2.fromOffset(70, 70),
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.new(1, -122, 1, -158),
		Radius = 35,
		Parent = gui,
	}, function()
		if Hud.onLock then
			Hud.onLock()
		end
	end)
	Kit.label({ Size = UDim2.fromScale(1, 0.6), Text = "🔒", stroke = false, Parent = lockBtn })
	Kit.label({ Size = UDim2.fromScale(1, 0.32), Position = UDim2.fromScale(0, 0.64), Text = Lang.t("lockButton"), Parent = lockBtn })

	-- 튜토리얼 말풍선
	tutorialBubble = Kit.label({
		Name = "Tutorial",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -24),
		Size = UDim2.new(0.7, 0, 0, 54),
		BackgroundColor3 = Kit.colors.yellow,
		TextColor3 = Kit.colors.white,
		Text = "",
		Visible = false,
		stroke = 3,
		Parent = gui,
	})
	Kit.corner(tutorialBubble, 16)
	Kit.stroke(tutorialBubble, 4).ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	local tsc = Instance.new("UISizeConstraint")
	tsc.MaxSize = Vector2.new(560, 60)
	tsc.Parent = tutorialBubble

	-- 작은 화면에서 메뉴·버튼 크기 조정
	local function rescale()
		local cam = Workspace.CurrentCamera
		if cam then
			menuScale.Scale = math.clamp(cam.ViewportSize.Y / 620, 0.72, 1.1)
		end
	end
	rescale()
	local cam = Workspace.CurrentCamera
	if cam then
		cam:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	end

	State.money:Connect(refreshMoney)
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc >= 0.5 then
			acc = 0
			refreshChips()
		end
	end)
end

function Hud.gui(): ScreenGui
	return gui
end

return Hud
