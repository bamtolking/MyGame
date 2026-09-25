--!strict
-- 도감: 슬라임 30종 × 변이 7종. 발견 1칸당 수입 +0.5%.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Mutations = require(Shared.Config.Mutations)
local Economy = require(Shared.Config.Economy)
local Calc = require(Shared.Logic.Calc)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Viewport = require(UI.Viewport)
local Lang = require(Client.Lang)
local State = require(Client.State)

local Index = {}

type Card = {
	id: string,
	viewport: ViewportFrame,
	name: TextLabel,
	dots: { [string]: Frame },
}

local cards: { Card } = {}
local summary: TextLabel
local setProgress: (number) -> ()
local built = false
local panel: Panel.PanelObj

local function build()
	built = true
	local grid = Kit.new("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		LayoutOrder = 3,
		Parent = panel.content,
	}) :: Frame
	local layout = Instance.new("UIGridLayout")
	layout.CellSize = UDim2.new(1 / 3, -8, 0, 150)
	layout.CellPadding = UDim2.fromOffset(8, 8)
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = grid
	for i, s in Slimes.list do
		local rarity = Rarities.byId[s.rarity]
		local card = Kit.new("Frame", { BackgroundColor3 = Kit.colors.card, LayoutOrder = i, Parent = grid }) :: Frame
		Kit.corner(card, 14)
		local st = Kit.stroke(card, 3, rarity.color)
		st.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
		local vp = Viewport.slime(card, { id = s.id, star = 1, mut = "none" }, {
			Size = UDim2.new(1, 0, 0, 92),
			Position = UDim2.fromOffset(0, 4),
		})
		local name = Kit.label({
			Size = UDim2.new(1, -8, 0, 24),
			Position = UDim2.fromOffset(4, 96),
			Text = "???",
			TextColor3 = if rarity.id == "secret" then Kit.colors.white else rarity.color,
			Parent = card,
		})
		local dotRow = Kit.new("Frame", {
			Size = UDim2.new(1, -8, 0, 18),
			Position = UDim2.fromOffset(4, 124),
			BackgroundTransparency = 1,
			Parent = card,
		}) :: Frame
		Kit.list(dotRow, false, 3, Enum.HorizontalAlignment.Center)
		local dots: { [string]: Frame } = {}
		for j, m in Mutations.list do
			local dot = Kit.new("Frame", {
				Size = UDim2.fromOffset(15, 15),
				BackgroundColor3 = m.label,
				BackgroundTransparency = 0.8,
				LayoutOrder = j,
				Parent = dotRow,
			}) :: Frame
			Kit.corner(dot, 8)
			Kit.stroke(dot, 1.5)
			dots[m.id] = dot
		end
		table.insert(cards, { id = s.id, viewport = vp, name = name, dots = dots })
	end
end

local function refresh()
	if not built then
		build()
	end
	local data = State.data()
	if not data then
		return
	end
	local count = Calc.indexCount(data)
	summary.Text = Lang.t("indexSummary", {
		a = count,
		b = Calc.indexTotal(),
		p = Format.number(count * Economy.indexBonusPer * 100),
	})
	setProgress(count / Calc.indexTotal())
	for _, card in cards do
		local found = data.index[card.id]
		local any = found ~= nil and next(found) ~= nil
		card.viewport.ImageColor3 = if any then Color3.new(1, 1, 1) else Color3.new(0, 0, 0)
		card.name.Text = if any then Lang.slime(card.id) else "???"
		for mutId, dot in card.dots do
			dot.BackgroundTransparency = if found and found[mutId] then 0 else 0.8
		end
	end
end

function Index.init()
	panel = Panel.new("Index", "📖 " .. Lang.t("indexTitle"), Kit.colors.blue)
	Kit.list(panel.content, true, 10, Enum.HorizontalAlignment.Center)
	summary = Kit.label({ Size = UDim2.new(1, 0, 0, 32), Text = "", TextColor3 = Kit.colors.yellow, LayoutOrder = 1, Parent = panel.content })
	local _bar
	_bar, setProgress = Kit.progress(panel.content, Kit.colors.blue, { LayoutOrder = 2, Size = UDim2.new(0.9, 0, 0, 16) })
	panel.onOpen = refresh
	State.changed:Connect(function()
		if panel.isOpen then
			refresh()
		end
	end)
end

return Index
