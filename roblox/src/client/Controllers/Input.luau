--!strict
-- 입력: 뿅망치(F / 게임패드 X / HUD 버튼), 잠금(HUD 버튼), 메뉴 배지 갱신, VIP 채팅 태그.

local ContextActionService = game:GetService("ContextActionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextChatService = game:GetService("TextChatService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Calc = require(Shared.Logic.Calc)
local Net = require(Shared.Net)

local Client = script.Parent.Parent
local State = require(Client.State)
local Hud = require(Client.UI.Hud)
local Notify = require(Client.UI.Notify)
local Shop = require(Client.UI.Panels.Shop)
local Quests = require(Client.UI.Panels.Quests)
local Gifts = require(Client.UI.Panels.Gifts)
local Rebirth = require(Client.UI.Panels.Rebirth)
local Fx = require(script.Parent.Fx)

local Input = {}

local lastBonk = 0

local function bonk()
	local data = State.data()
	local cooldown = if data then Calc.bonkCooldown(data) else 1
	local t = os.clock()
	if t - lastBonk < cooldown then
		return
	end
	lastBonk = t
	Net.event("Bonk"):FireServer()
	Fx.localBonk()
	Hud.bonkCooldown(cooldown)
end

local function lock()
	local result = State.action("Lock")
	Notify.result(result)
end

local function refreshBadges()
	Hud.setBadge("Shop", Shop.affordable())
	Hud.setBadge("Quests", Quests.claimable())
	Hud.setBadge("Gifts", Gifts.claimable())
	Hud.setBadge("Rebirth", if Rebirth.ready() then 1 else 0)
end

function Input.init()
	Hud.onBonk = bonk
	Hud.onLock = lock
	ContextActionService:BindAction("SlimeHeistBonk", function(_name, inputState, _obj)
		if inputState == Enum.UserInputState.Begin then
			bonk()
		end
		return Enum.ContextActionResult.Sink
	end, false, Enum.KeyCode.F, Enum.KeyCode.ButtonX)

	State.changed:Connect(refreshBadges)
	task.spawn(function()
		while true do
			task.wait(1)
			refreshBadges()
		end
	end)

	-- VIP 채팅 태그
	TextChatService.OnIncomingMessage = function(message: TextChatMessage): TextChatMessageProperties?
		local props = Instance.new("TextChatMessageProperties")
		local source = message.TextSource
		if source then
			local sender = Players:GetPlayerByUserId(source.UserId)
			if sender and sender:GetAttribute("VIP") == true then
				props.PrefixText = "<font color='#FFD23F'>[VIP]</font> " .. message.PrefixText
			end
		end
		return props
	end
end

return Input
