--!strict
-- 슬라임 머리 위 이름표(클라이언트에서 각자 언어로 생성).
--  [✨ 황금 x2]      ← 변이 배지(있을 때)
--  드래곤 ★★         ← 이름 + 노란 별
--  [ 전설 ]          ← 등급 배지(비밀은 무지개)
--  $4K/s  또는 $360K ← 수입(기지) / 가격(행진)

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Mutations = require(Shared.Config.Mutations)
local Calc = require(Shared.Logic.Calc)
local Format = require(Shared.Util.Format)
local SlimeBuilder = require(Shared.SlimeBuilder)

local Client = script.Parent
local Lang = require(Client.Lang)
local Kit = require(Client.UI.Kit)

local SlimeLabel = {}

export type Info = { id: string, star: number, mut: string }

SlimeLabel.RAINBOW = ColorSequence.new({
	ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 80, 80)),
	ColorSequenceKeypoint.new(0.25, Color3.fromRGB(255, 220, 70)),
	ColorSequenceKeypoint.new(0.5, Color3.fromRGB(80, 255, 120)),
	ColorSequenceKeypoint.new(0.75, Color3.fromRGB(80, 160, 255)),
	ColorSequenceKeypoint.new(1, Color3.fromRGB(220, 90, 255)),
})

function SlimeLabel.stars(star: number): string
	return string.rep("★", star)
end

local function row(parent: Instance, order: number, height: number): Frame
	return Kit.new("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, height),
		LayoutOrder = order,
		Parent = parent,
	}) :: Frame
end

local function badge(parent: Instance, text: string, color: Color3, width: number, rainbow: boolean?): TextLabel
	local b = Kit.label({
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromScale(width, 0.92),
		BackgroundColor3 = if rainbow then Color3.new(1, 1, 1) else color,
		BackgroundTransparency = 0.05,
		Text = text,
		stroke = 2,
		Parent = parent,
	})
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.5, 0)
	corner.Parent = b
	local st = Instance.new("UIStroke")
	st.Thickness = 2
	st.Color = Kit.darken(color, 0.55)
	st.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	st.Parent = b
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0.08, 0)
	pad.PaddingBottom = UDim.new(0.08, 0)
	pad.Parent = b
	if rainbow then
		local g = Instance.new("UIGradient")
		g.Color = SlimeLabel.RAINBOW
		g.Parent = b
	end
	return b
end

-- mode "base": 초당 수입 표시 / "parade": 가격 표시
function SlimeLabel.create(adornee: BasePart, info: Info, mode: string, price: number?): BillboardGui
	local species = Slimes.byId[info.id]
	local rarity = Rarities.byId[species.rarity]
	local mutation = Mutations.byId[info.mut] or Mutations.byId.none
	local height = SlimeBuilder.height(info.star)

	local gui = Kit.new("BillboardGui", {
		Name = "SlimeLabel",
		Adornee = adornee,
		Size = UDim2.fromScale(10, 4.4),
		StudsOffsetWorldSpace = Vector3.new(0, height / 2 + 2.9, 0),
		MaxDistance = if mode == "parade" then 120 else 75,
		LightInfluence = 0,
		AlwaysOnTop = false,
		ResetOnSpawn = false,
	}) :: BillboardGui
	local frame = Kit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Parent = gui })
	local layout = Kit.list(frame, true, 0, Enum.HorizontalAlignment.Center)
	layout.VerticalAlignment = Enum.VerticalAlignment.Bottom

	if mutation.id ~= "none" then
		badge(row(frame, 1, 0.2), "✨ " .. string.upper(Lang.pick(mutation.name)) .. " " .. Format.mult(mutation.mult), mutation.label, 0.62, mutation.id == "rainbow")
	end
	local name = Kit.label({
		Size = UDim2.fromScale(1, 0.3),
		Text = Lang.pick(species.name) .. ' <font color="#FFD54A">' .. SlimeLabel.stars(info.star) .. "</font>",
		RichText = true,
		stroke = 2.5,
		LayoutOrder = 2,
		Parent = frame,
	})
	assert(name)
	badge(row(frame, 3, 0.2), Lang.pick(rarity.name), rarity.color, 0.42, rarity.id == "secret")
	local value = if mode == "parade"
		then Format.cash(price or species.price)
		else "💵 " .. Format.cash(Calc.slimeIncome(info)) .. "/s"
	local v = Kit.label({
		Name = if mode == "parade" then "Price" else "Income",
		Size = UDim2.fromScale(1, 0.26),
		Text = value,
		TextColor3 = if mode == "parade" then Kit.colors.yellow else Kit.colors.cash,
		stroke = 2.5,
		LayoutOrder = 4,
		Parent = frame,
	})
	assert(v)
	return gui
end

return SlimeLabel
