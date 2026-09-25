--!strict
-- "돌아온 걸 환영해요!" 오프라인 수입 팝업.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Lang = require(Client.Lang)
local State = require(Client.State)
local Sound = require(Client.Controllers.Sound)

local Offline = {}

local text: TextLabel
local shown = false

function Offline.init()
	local p = Panel.new("Offline", "🌙 " .. Lang.t("offlineTitle"), Kit.colors.blue)
	Kit.list(p.content, true, 12, Enum.HorizontalAlignment.Center)
	text = Kit.label({
		Size = UDim2.new(1, 0, 0, 120),
		Text = "",
		TextWrapped = true,
		LayoutOrder = 1,
		Parent = p.content,
	})
	Kit.button({ Text = Lang.t("collectIt"), Color = Kit.colors.green, Size = UDim2.fromOffset(240, 64), LayoutOrder = 2, Parent = p.content }, function()
		State.action("ClaimOffline")
		Sound.play("collect")
		Panel.close("Offline")
	end)
	p.onClose = function()
		-- 닫기만 해도 받도록(놓치지 않게)
		local view = State.view
		if view and view.offline then
			State.action("ClaimOffline")
		end
	end
	State.changed:Connect(function(view)
		if not shown and view.offline and view.offline.amount > 0 then
			shown = true
			text.Text = Lang.t("offlineText", {
				t = Format.time(view.offline.seconds),
				cash = Format.cash(view.offline.amount),
			})
			Panel.open("Offline")
		end
	end)
end

return Offline
