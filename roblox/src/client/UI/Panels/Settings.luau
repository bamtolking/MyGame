--!strict
-- 설정: 음악 · 효과음 · 효과(흔들림/섬광) 스위치, 튜토리얼 건너뛰기, 게임 방법.
-- 저장된 설정은 접속하자마자 적용됩니다.

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Lang = require(Client.Lang)
local State = require(Client.State)
local Sound = require(Client.Controllers.Sound)
local Fx = require(Client.Controllers.Fx)

local Settings = {}

type Toggle = { key: string, knob: Frame, track: TextButton, label: TextLabel }
local toggles: { Toggle } = {}

-- 저장된 설정을 소리·연출에 반영
function Settings.apply()
	local data = State.data()
	if not data then
		return
	end
	Sound.enabled = data.settings.sfx
	Sound.musicEnabled = data.settings.music
	Fx.reduced = not data.settings.fx
end

local function valueOf(key: string): boolean
	local data = State.data()
	if not data then
		return true
	end
	local s = data.settings :: any
	return s[key] ~= false
end

local function refresh()
	Settings.apply()
	for _, t in toggles do
		local on = valueOf(t.key)
		Kit.tween(t.knob, 0.18, { Position = if on then UDim2.new(1, -30, 0.5, 0) else UDim2.new(0, 4, 0.5, 0) }, Enum.EasingStyle.Back)
		t.track.BackgroundColor3 = if on then Kit.colors.green else Kit.colors.gray
		t.label.Text = if on then "ON" else "OFF"
	end
end

local function toggleRow(parent: Instance, order: number, icon: string, textKey: string, key: string)
	local card = Kit.card(parent, { LayoutOrder = order, Size = UDim2.new(1, 0, 0, 64) })
	Kit.label({ Size = UDim2.fromOffset(46, 46), Position = UDim2.fromOffset(10, 9), Text = icon, stroke = false, Parent = card })
	Kit.label({
		Size = UDim2.new(1, -190, 0, 34),
		Position = UDim2.fromOffset(66, 15),
		Text = Lang.t(textKey),
		TextXAlignment = Enum.TextXAlignment.Left,
		Parent = card,
	})
	local track = Kit.new("TextButton", {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -14, 0.5, 0),
		Size = UDim2.fromOffset(100, 34),
		BackgroundColor3 = Kit.colors.green,
		Text = "",
		AutoButtonColor = false,
		Parent = card,
	}) :: TextButton
	Kit.corner(track, 17)
	Kit.stroke(track, 2.5).ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	local label = Kit.label({
		Size = UDim2.new(1, -44, 1, -8),
		Position = UDim2.fromOffset(12, 4),
		Text = "ON",
		Parent = track,
	})
	local knob = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(1, -30, 0.5, 0),
		Size = UDim2.fromOffset(26, 26),
		BackgroundColor3 = Color3.new(1, 1, 1),
		Parent = track,
	}) :: Frame
	Kit.corner(knob, 13)
	Kit.stroke(knob, 2)
	track.Activated:Connect(function()
		local data = State.data()
		local nextValue = not valueOf(key)
		if data then
			(data.settings :: any)[key] = nextValue
		end
		Sound.play("click")
		refresh()
		State.action("Settings", { [key] = nextValue })
	end)
	table.insert(toggles, { key = key, knob = knob, track = track, label = label })
end

function Settings.init()
	local p = Panel.new("Settings", "⚙️ " .. Lang.t("settingsTitle"), Kit.colors.gray)
	Kit.list(p.content, true, 10, Enum.HorizontalAlignment.Center)
	toggleRow(p.content, 1, "🎵", "music", "music")
	toggleRow(p.content, 2, "🔊", "sfx", "sfx")
	toggleRow(p.content, 3, "✨", "effects", "fx")
	Kit.button({ Text = Lang.t("skipTutorial"), Color = Kit.colors.blue, Size = UDim2.fromOffset(260, 54), LayoutOrder = 4, Parent = p.content }, function()
		State.action("SkipTutorial")
		Panel.close("Settings")
	end)
	local help = Kit.card(p.content, { LayoutOrder = 5, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0, 12)
	pad.PaddingBottom = UDim.new(0, 12)
	pad.PaddingLeft = UDim.new(0, 14)
	pad.PaddingRight = UDim.new(0, 14)
	pad.Parent = help
	Kit.label({
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Text = Lang.t("howToPlay"),
		TextScaled = false,
		TextSize = 18,
		TextWrapped = true,
		Font = Kit.fontBody,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = Kit.colors.white,
		stroke = false,
		Parent = help,
	})
	p.onOpen = refresh
	State.changed:Connect(refresh)
end

return Settings
