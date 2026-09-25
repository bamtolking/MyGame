--!strict
-- 환생 창: 조건(현금·등급), 보상 미리보기, 유지/초기화 안내.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Rarities = require(Shared.Config.Rarities)
local Calc = require(Shared.Logic.Calc)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Notify = require(UI.Notify)
local Lang = require(Client.Lang)
local State = require(Client.State)

local Rebirth = {}

local header: TextLabel
local bonus: TextLabel
local cashText: TextLabel
local setCash: (number) -> ()
local rarityText: TextLabel
local button: TextButton

local function refresh()
	local data = State.data()
	if not data then
		return
	end
	local r = data.rebirths
	header.Text = Lang.t("rebirthHeader", { a = r, b = r + 1 })
	bonus.Text = Lang.t("rebirthBonus", {
		a = Format.mult(Calc.rebirthMult(r)),
		b = Format.mult(Calc.rebirthMult(r + 1)),
	})
	local cost = Calc.rebirthCost(r)
	cashText.Text = Lang.t("rebirthCash", { a = Format.cash(math.min(data.cash, cost)), b = Format.cash(cost) })
	setCash(data.cash / cost)
	local req = Rarities.byId[Calc.rebirthRarityReq(r)]
	local hasRarity = Calc.bestRarityOwned(data) >= req.order
	rarityText.Text = (if hasRarity then "✅ " else "❌ ") .. Lang.t("rebirthRarity", { rarity = req.id })
	rarityText.TextColor3 = if hasRarity then Kit.colors.cash else Color3.fromRGB(255, 170, 170)
	local ok = Calc.canRebirth(data)
	Kit.setEnabled(button, ok, Kit.colors.pink)
end

function Rebirth.init()
	local p = Panel.new("Rebirth", "♻️ " .. Lang.t("rebirthTitle"), Kit.colors.pink)
	Kit.list(p.content, true, 10, Enum.HorizontalAlignment.Center)
	header = Kit.label({ Size = UDim2.new(1, 0, 0, 44), Text = "", TextColor3 = Kit.colors.yellow, LayoutOrder = 1, stroke = 3, Parent = p.content })
	bonus = Kit.label({ Size = UDim2.new(1, 0, 0, 34), Text = "", TextColor3 = Kit.colors.cash, LayoutOrder = 2, Parent = p.content })
	cashText = Kit.label({ Size = UDim2.new(1, 0, 0, 28), Text = "", LayoutOrder = 3, Parent = p.content })
	local bar
	bar, setCash = Kit.progress(p.content, Kit.colors.green, { LayoutOrder = 4, Size = UDim2.new(0.9, 0, 0, 18) })
	assert(bar)
	rarityText = Kit.label({ Size = UDim2.new(1, 0, 0, 30), Text = "", LayoutOrder = 5, Parent = p.content })
	Kit.label({
		Size = UDim2.new(1, -10, 0, 58),
		Text = Lang.t("rebirthInfo"),
		TextColor3 = Kit.colors.muted,
		Font = Kit.fontBody,
		TextWrapped = true,
		stroke = false,
		LayoutOrder = 6,
		Parent = p.content,
	})
	button = Kit.button({
		Text = Lang.t("rebirthButton"),
		Color = Kit.colors.pink,
		Size = UDim2.fromOffset(260, 64),
		LayoutOrder = 7,
		Parent = p.content,
	}, function()
		local result = State.action("Rebirth")
		if result.ok then
			Panel.close("Rebirth")
		else
			Notify.result(result)
		end
	end)
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

function Rebirth.ready(): boolean
	local data = State.data()
	return data ~= nil and (Calc.canRebirth(data))
end

return Rebirth
