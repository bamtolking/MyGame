--!strict
-- 설정: 효과음, 튜토리얼 건너뛰기, 게임 방법.

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Lang = require(Client.Lang)
local State = require(Client.State)
local Sound = require(Client.Controllers.Sound)

local Settings = {}

local sfxButton: TextButton

local function refresh()
	local data = State.data()
	local on = if data then data.settings.sfx else true
	Sound.enabled = on
	sfxButton.Text = Lang.t("sfx") .. ": " .. (if on then "ON" else "OFF")
	sfxButton.BackgroundColor3 = if on then Kit.colors.green else Kit.colors.gray
end

function Settings.init()
	local p = Panel.new("Settings", "⚙️ " .. Lang.t("settingsTitle"), Kit.colors.gray)
	Kit.list(p.content, true, 10, Enum.HorizontalAlignment.Center)
	sfxButton = Kit.button({ Text = "", Size = UDim2.fromOffset(260, 54), LayoutOrder = 1, Parent = p.content }, function()
		local data = State.data()
		local on = if data then data.settings.sfx else true
		if data then
			data.settings.sfx = not on
		end
		refresh()
		State.action("Settings", { sfx = not on })
	end)
	Kit.button({ Text = Lang.t("skipTutorial"), Color = Kit.colors.blue, Size = UDim2.fromOffset(260, 54), LayoutOrder = 2, Parent = p.content }, function()
		State.action("SkipTutorial")
		Panel.close("Settings")
	end)
	Kit.label({
		Size = UDim2.new(1, -10, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Text = Lang.t("howToPlay"),
		TextScaled = false,
		TextSize = 18,
		TextWrapped = true,
		Font = Kit.fontBody,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = Kit.colors.white,
		stroke = false,
		LayoutOrder = 3,
		Parent = p.content,
	})
	p.onOpen = refresh
	State.changed:Connect(refresh)
end

return Settings
