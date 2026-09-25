--!strict
-- 업그레이드 상점.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Economy = require(Shared.Config.Economy)
local Calc = require(Shared.Logic.Calc)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Notify = require(UI.Notify)
local Lang = require(Client.Lang)
local State = require(Client.State)
local Sound = require(Client.Controllers.Sound)

local Shop = {}

type Row = { level: TextLabel, button: TextButton, id: string }
local rows: { Row } = {}

local function refresh()
	local data = State.data()
	if not data then
		return
	end
	for _, r in rows do
		local def = Economy.upgradeById[r.id]
		local level = Calc.upgradeLevel(data, r.id)
		r.level.Text = Lang.t("levelOf", { a = level, b = def.maxLevel })
		local cost = Calc.upgradeCost(r.id, level)
		if cost then
			r.button.Text = Format.cash(cost)
			Kit.setEnabled(r.button, data.cash >= cost, Kit.colors.green)
		else
			r.button.Text = Lang.t("maxed")
			Kit.setEnabled(r.button, false)
		end
	end
end

function Shop.init()
	local p = Panel.new("Shop", "🛒 " .. Lang.t("shopTitle"), Kit.colors.green)
	Kit.list(p.content, true, 8, Enum.HorizontalAlignment.Center)
	for i, def in Economy.upgrades do
		local card = Kit.new("Frame", {
			Size = UDim2.new(1, 0, 0, 78),
			BackgroundColor3 = Kit.colors.card,
			LayoutOrder = i,
			Parent = p.content,
		}) :: Frame
		Kit.corner(card, 14)
		Kit.stroke(card, 3)
		Kit.label({ Size = UDim2.fromOffset(56, 56), Position = UDim2.fromOffset(10, 11), Text = def.icon, stroke = false, Parent = card })
		Kit.label({
			Size = UDim2.new(1, -250, 0, 30),
			Position = UDim2.fromOffset(74, 8),
			Text = Lang.pick(def.name),
			TextXAlignment = Enum.TextXAlignment.Left,
			Parent = card,
		})
		Kit.label({
			Size = UDim2.new(1, -250, 0, 24),
			Position = UDim2.fromOffset(74, 42),
			Text = Lang.pick(def.desc),
			TextColor3 = Kit.colors.muted,
			Font = Kit.fontBody,
			TextXAlignment = Enum.TextXAlignment.Left,
			stroke = false,
			Parent = card,
		})
		local level = Kit.label({
			Size = UDim2.fromOffset(70, 26),
			AnchorPoint = Vector2.new(1, 0.5),
			Position = UDim2.new(1, -150, 0.5, 0),
			Text = "",
			TextColor3 = Kit.colors.yellow,
			Parent = card,
		})
		local id = def.id
		local button = Kit.button({
			Text = "",
			Color = Kit.colors.green,
			Size = UDim2.fromOffset(130, 52),
			AnchorPoint = Vector2.new(1, 0.5),
			Position = UDim2.new(1, -10, 0.5, 0),
			Parent = card,
		}, function()
			local result = State.action("Upgrade", id)
			if result.ok then
				Sound.play("buy", 1.1)
			else
				Notify.result(result)
			end
		end)
		table.insert(rows, { level = level, button = button, id = id })
	end
	p.onOpen = refresh
	State.changed:Connect(function()
		if p.isOpen then
			refresh()
		end
	end)
	State.money:Connect(function()
		if p.isOpen then
			refresh()
		end
	end)
end

-- 살 수 있는 업그레이드 수(메뉴 배지용)
function Shop.affordable(): number
	local data = State.data()
	if not data then
		return 0
	end
	local n = 0
	for _, def in Economy.upgrades do
		local cost = Calc.upgradeCost(def.id, Calc.upgradeLevel(data, def.id))
		if cost and data.cash >= cost then
			n += 1
		end
	end
	return n
end

return Shop
