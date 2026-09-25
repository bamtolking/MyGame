--!strict
-- 내 슬라임 관리: 합성(★), 판매, 즐겨찾기(도난 불가 + 환생 유지).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Mutations = require(Shared.Config.Mutations)
local Economy = require(Shared.Config.Economy)
local Calc = require(Shared.Logic.Calc)
local Merge = require(Shared.Logic.Merge)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Notify = require(UI.Notify)
local Viewport = require(UI.Viewport)
local Lang = require(Client.Lang)
local State = require(Client.State)
local Sound = require(Client.Controllers.Sound)

local Manage = {}

local panel: Panel.PanelObj
local currentUid: string? = nil
local viewport: ViewportFrame
local nameLabel: TextLabel
local rarityLabel: TextLabel
local mutLabel: TextLabel
local incomeLabel: TextLabel
local mergeLabel: TextLabel
local mergeButton: TextButton
local sellButton: TextButton
local favButton: TextButton
local shownKey = ""

local function countSame(uid: string): number
	local data = State.data()
	if not data then
		return 0
	end
	local target = data.slimes[uid]
	local n = 0
	for u, s in data.slimes do
		if s.id == target.id and s.star == target.star and (u == uid or not s.fav) then
			n += 1
		end
	end
	return n
end

local function refresh()
	local data = State.data()
	local uid = currentUid
	if not data or not uid then
		return
	end
	local s = data.slimes[uid]
	if not s then
		Panel.close("Manage")
		return
	end
	local species = Slimes.byId[s.id]
	local rarity = Rarities.byId[species.rarity]
	local mutation = Mutations.byId[s.mut] or Mutations.byId.none
	local key = s.id .. s.mut
	if key ~= shownKey then
		shownKey = key
		Viewport.set(viewport, { id = s.id, star = s.star, mut = s.mut })
	end
	nameLabel.Text = Lang.slime(s.id) .. " " .. string.rep("★", s.star)
	rarityLabel.Text = Lang.rarity(rarity.id)
	rarityLabel.TextColor3 = if rarity.id == "secret" then Kit.colors.white else rarity.color
	mutLabel.Visible = mutation.id ~= "none"
	mutLabel.Text = "✨ " .. Lang.mut(mutation.id) .. " " .. Format.mult(mutation.mult)
	mutLabel.TextColor3 = mutation.label
	local base = Calc.slimeIncome(s)
	local view = State.view
	local mult = if view then view.multiplier else 1
	incomeLabel.Text = Lang.t("slimeIncome", { a = Format.cash(base), b = Format.cash(base * mult) })

	local have = countSame(uid)
	local canMerge = Merge.findSet(data.slimes, uid) ~= nil
	if s.star >= Economy.star.max then
		mergeLabel.Text = Lang.t("maxStar")
		Kit.setEnabled(mergeButton, false)
	else
		mergeLabel.Text = Lang.t("mergeInfo", {
			n = math.min(have, 3),
			a = Format.mult(Calc.starMult(s.star)),
			b = Format.mult(Calc.starMult(s.star + 1)),
		})
		Kit.setEnabled(mergeButton, canMerge, Kit.colors.purple)
	end
	sellButton.Text = Lang.t("sellFor", { cash = Format.cash(Calc.sellPrice(s)) })
	Kit.setEnabled(sellButton, not s.fav, Kit.colors.red)
	favButton.Text = if s.fav then "⭐ " .. Lang.t("favOn") else "☆ " .. Lang.t("favOff")
	favButton.BackgroundColor3 = if s.fav then Kit.colors.yellow else Kit.colors.gray
end

function Manage.open(uid: string)
	currentUid = uid
	shownKey = ""
	Panel.open("Manage")
	refresh()
end

function Manage.init()
	panel = Panel.new("Manage", "🟢 " .. Lang.t("manageTitle"), Kit.colors.purple)
	Kit.list(panel.content, true, 8, Enum.HorizontalAlignment.Center)
	local top = Kit.new("Frame", {
		Size = UDim2.new(1, 0, 0, 150),
		BackgroundTransparency = 1,
		LayoutOrder = 1,
		Parent = panel.content,
	}) :: Frame
	viewport = Viewport.slime(top, { id = Slimes.list[1].id, star = 1, mut = "none" }, {
		Size = UDim2.fromOffset(150, 150),
	})
	local info = Kit.new("Frame", {
		Size = UDim2.new(1, -160, 1, 0),
		Position = UDim2.fromOffset(160, 0),
		BackgroundTransparency = 1,
		Parent = top,
	}) :: Frame
	Kit.list(info, true, 4, Enum.HorizontalAlignment.Left)
	nameLabel = Kit.label({ Size = UDim2.new(1, 0, 0, 38), Text = "", LayoutOrder = 1, TextXAlignment = Enum.TextXAlignment.Left, Parent = info })
	rarityLabel = Kit.label({ Size = UDim2.new(1, 0, 0, 26), Text = "", LayoutOrder = 2, TextXAlignment = Enum.TextXAlignment.Left, Parent = info })
	mutLabel = Kit.label({ Size = UDim2.new(1, 0, 0, 24), Text = "", LayoutOrder = 3, TextXAlignment = Enum.TextXAlignment.Left, Parent = info })
	incomeLabel = Kit.label({
		Size = UDim2.new(1, 0, 0, 24),
		Text = "",
		TextColor3 = Kit.colors.cash,
		LayoutOrder = 4,
		TextXAlignment = Enum.TextXAlignment.Left,
		Parent = info,
	})

	mergeLabel = Kit.label({
		Size = UDim2.new(1, 0, 0, 26),
		Text = "",
		TextColor3 = Kit.colors.yellow,
		LayoutOrder = 2,
		Parent = panel.content,
	})
	local buttons = Kit.new("Frame", {
		Size = UDim2.new(1, 0, 0, 60),
		BackgroundTransparency = 1,
		LayoutOrder = 3,
		Parent = panel.content,
	}) :: Frame
	Kit.list(buttons, false, 10, Enum.HorizontalAlignment.Center)
	mergeButton = Kit.button({ Text = "⭐ " .. Lang.t("merge"), Color = Kit.colors.purple, Size = UDim2.fromOffset(170, 56), LayoutOrder = 1, Parent = buttons }, function()
		local uid = currentUid
		if uid then
			local result = State.action("Merge", uid)
			if result.ok then
				Sound.play("merge")
			else
				Notify.result(result)
			end
		end
	end)
	sellButton = Kit.button({ Text = "", Color = Kit.colors.red, Size = UDim2.fromOffset(170, 56), LayoutOrder = 2, Parent = buttons }, function()
		local uid = currentUid
		if uid then
			local result = State.action("Sell", uid)
			if result.ok then
				Sound.play("collect", 0.8)
				Panel.close("Manage")
			else
				Notify.result(result)
			end
		end
	end)
	favButton = Kit.button({ Text = "", Color = Kit.colors.gray, Size = UDim2.fromOffset(250, 52), LayoutOrder = 4, Parent = panel.content }, function()
		local uid = currentUid
		if uid then
			Notify.result(State.action("Favorite", uid))
		end
	end)
	Kit.label({
		Size = UDim2.new(1, 0, 0, 40),
		Text = Lang.t("favHelp"),
		TextColor3 = Kit.colors.muted,
		Font = Kit.fontBody,
		TextWrapped = true,
		stroke = false,
		LayoutOrder = 5,
		Parent = panel.content,
	})
	panel.onClose = function()
		currentUid = nil
	end
	State.changed:Connect(function()
		if panel.isOpen then
			refresh()
		end
	end)
end

return Manage
