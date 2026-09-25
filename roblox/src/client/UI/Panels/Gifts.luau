--!strict
-- 접속 선물: 이번 접속에서 N분 지나면 받을 수 있는 무료 선물 7개.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Rewards = require(Shared.Config.Rewards)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Notify = require(UI.Notify)
local Lang = require(Client.Lang)
local State = require(Client.State)
local Quests = require(script.Parent.Quests)

local Gifts = {}

type Cell = { button: TextButton, index: number }
local cells: { Cell } = {}

local function claimed(i: number): boolean
	local view = State.view
	return view ~= nil and view.giftsClaimed[tostring(i)] == true
end

local function refresh()
	local elapsed = State.sessionSeconds()
	for _, cell in cells do
		local gift = Rewards.gifts[cell.index]
		local left = gift.minutes * 60 - elapsed
		if claimed(cell.index) then
			cell.button.Text = "✅"
			Kit.setEnabled(cell.button, false)
		elseif left <= 0 then
			cell.button.Text = Lang.t("claim")
			Kit.setEnabled(cell.button, true, Kit.colors.green)
		else
			cell.button.Text = Format.time(left)
			Kit.setEnabled(cell.button, false)
		end
	end
end

function Gifts.init()
	local p = Panel.new("Gifts", "🎁 " .. Lang.t("giftsTitle"), Kit.colors.red)
	local grid = Instance.new("UIGridLayout")
	grid.CellSize = UDim2.new(0.25, -8, 0, 150)
	grid.CellPadding = UDim2.fromOffset(8, 8)
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.HorizontalAlignment = Enum.HorizontalAlignment.Center
	grid.Parent = p.content
	for i, gift in Rewards.gifts do
		local card = Kit.new("Frame", { BackgroundColor3 = Kit.colors.card, LayoutOrder = i, Parent = p.content }) :: Frame
		Kit.corner(card, 14)
		Kit.stroke(card, 3)
		Kit.label({ Size = UDim2.new(1, 0, 0, 44), Position = UDim2.fromOffset(0, 6), Text = "🎁", stroke = false, Parent = card })
		Kit.label({
			Size = UDim2.new(1, -8, 0, 40),
			Position = UDim2.fromOffset(4, 52),
			Text = Quests.rewardText(gift.reward),
			TextColor3 = Kit.colors.yellow,
			Font = Kit.fontBody,
			TextWrapped = true,
			Parent = card,
		})
		local index = i
		local button = Kit.button({
			Text = "",
			Color = Kit.colors.green,
			Size = UDim2.new(1, -12, 0, 42),
			AnchorPoint = Vector2.new(0.5, 1),
			Position = UDim2.new(0.5, 0, 1, -6),
			Parent = card,
		}, function()
			local result = State.action("ClaimGift", index)
			Notify.result(result)
		end)
		table.insert(cells, { button = button, index = i })
	end
	p.onOpen = refresh
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc >= 1 and p.isOpen then
			acc = 0
			refresh()
		end
	end)
	State.changed:Connect(function()
		if p.isOpen then
			refresh()
		end
	end)
end

function Gifts.claimable(): number
	local elapsed = State.sessionSeconds()
	local n = 0
	for i, gift in Rewards.gifts do
		if not claimed(i) and elapsed >= gift.minutes * 60 then
			n += 1
		end
	end
	return n
end

return Gifts
