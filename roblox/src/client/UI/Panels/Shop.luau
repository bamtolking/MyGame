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

type Row = { level: TextLabel, effect: TextLabel, setBar: (number) -> (), button: TextButton, card: Frame, id: string, last: number }
local rows: { Row } = {}

-- 소수점이 필요 없으면 정수로
local function num(v: number): string
	if math.abs(v - math.round(v)) < 0.001 then
		return tostring(math.round(v))
	end
	return (string.format("%.2f", v):gsub("0+$", ""))
end

-- 업그레이드 효과 "현재 → 다음" 문구
local function effectText(data: any, id: string, level: number): string
	local def = Economy.upgradeById[id]
	if level >= def.maxLevel then
		return Lang.t("effectMax")
	end
	local now = table.clone(data)
	now.upgrades = table.clone(data.upgrades)
	local after = table.clone(now)
	after.upgrades = table.clone(now.upgrades)
	after.upgrades[id] = level + 1
	if id == "pads" then
		local extra = State.hasPass("extraPads")
		return Lang.t("effectPads", { a = Calc.padCount(now, extra), b = Calc.padCount(after, extra) })
	elseif id == "speed" then
		return Lang.t("effectSpeed", { a = num(Calc.walkSpeed(now)), b = num(Calc.walkSpeed(after)) })
	elseif id == "lock" then
		return Lang.t("effectLock", { a = num(Calc.lockDuration(now)), b = num(Calc.lockDuration(after)) })
	elseif id == "offline" then
		return Lang.t("effectOffline", {
			a = num(Calc.offlineRate(now) * 100),
			b = num(Calc.offlineRate(after) * 100),
			c = num(Calc.offlineCapSeconds(now) / 3600),
			d = num(Calc.offlineCapSeconds(after) / 3600),
		})
	elseif id == "luck" then
		return Lang.t("effectLuck", { a = num(Calc.luckyTouchChance(now) * 100), b = num(Calc.luckyTouchChance(after) * 100) })
	elseif id == "bonk" then
		return Lang.t("effectBonk", { a = num(Calc.bonkCooldown(now)), b = num(Calc.bonkCooldown(after)) })
	end
	return Lang.pick(def.desc)
end

local function refresh()
	local data = State.data()
	if not data then
		return
	end
	for _, r in rows do
		local def = Economy.upgradeById[r.id]
		local level = Calc.upgradeLevel(data, r.id)
		r.level.Text = Lang.t("levelOf", { a = level, b = def.maxLevel })
		r.effect.Text = effectText(data, r.id, level)
		r.setBar(level / def.maxLevel)
		if level > r.last and r.last >= 0 then
			Kit.bump(r.level, 0.35)
			Kit.bump(r.effect, 0.15)
		end
		r.last = level
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
		local card = Kit.card(p.content, { LayoutOrder = i, Size = UDim2.new(1, 0, 0, 96) })
		local iconBg = Kit.new("Frame", {
			Size = UDim2.fromOffset(64, 64),
			Position = UDim2.fromOffset(10, 16),
			BackgroundColor3 = Kit.darken(Kit.colors.card, 0.25),
			Parent = card,
		}) :: Frame
		Kit.corner(iconBg, 14)
		Kit.label({ Size = UDim2.fromScale(0.8, 0.8), Position = UDim2.fromScale(0.1, 0.1), Text = def.icon, stroke = false, Parent = iconBg })
		Kit.label({
			Size = UDim2.new(1, -330, 0, 28),
			Position = UDim2.fromOffset(86, 8),
			Text = Lang.pick(def.name),
			TextXAlignment = Enum.TextXAlignment.Left,
			Parent = card,
		})
		local level = Kit.label({
			Size = UDim2.fromOffset(84, 24),
			AnchorPoint = Vector2.new(1, 0),
			Position = UDim2.new(1, -152, 0, 10),
			Text = "",
			TextColor3 = Kit.colors.yellow,
			TextXAlignment = Enum.TextXAlignment.Right,
			Parent = card,
		})
		local effect = Kit.label({
			Size = UDim2.new(1, -250, 0, 22),
			Position = UDim2.fromOffset(86, 40),
			Text = Lang.pick(def.desc),
			TextColor3 = Kit.colors.cash,
			Font = Kit.fontBody,
			TextXAlignment = Enum.TextXAlignment.Left,
			stroke = false,
			Parent = card,
		})
		local _, setBar = Kit.progress(card, Kit.colors.yellow, {
			Size = UDim2.new(1, -250, 0, 12),
			Position = UDim2.fromOffset(86, 70),
		})
		local id = def.id
		local row: Row
		local button = Kit.button({
			Text = "",
			Color = Kit.colors.green,
			Size = UDim2.fromOffset(130, 56),
			AnchorPoint = Vector2.new(1, 0.5),
			Position = UDim2.new(1, -12, 0.5, 0),
			Parent = card,
		}, function()
			local result = State.action("Upgrade", id)
			if result.ok then
				local data = State.data()
				local n = if data then Calc.upgradeLevel(data, id) + 1 else 1
				Sound.play("buy", 1 + math.min(n, 10) * 0.03)
				Sound.play("success", 1.05, 0.6)
				Kit.pop(row.card, 0.25)
			else
				Notify.result(result)
			end
		end)
		row = { level = level, effect = effect, setBar = setBar, button = button, card = card, id = id, last = -1 }
		table.insert(rows, row)
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
