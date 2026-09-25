--!strict
-- 슬라임 머리 위 이름표(클라이언트에서 각자 언어로 생성).

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

local RAINBOW = ColorSequence.new({
	ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 80, 80)),
	ColorSequenceKeypoint.new(0.25, Color3.fromRGB(255, 220, 70)),
	ColorSequenceKeypoint.new(0.5, Color3.fromRGB(80, 255, 120)),
	ColorSequenceKeypoint.new(0.75, Color3.fromRGB(80, 160, 255)),
	ColorSequenceKeypoint.new(1, Color3.fromRGB(220, 90, 255)),
})

local function line(parent: Instance, order: number, height: number, text: string, color: Color3): TextLabel
	local l = Kit.label({
		Size = UDim2.fromScale(1, height),
		Text = text,
		TextColor3 = color,
		LayoutOrder = order,
		Parent = parent,
	})
	return l
end

function SlimeLabel.stars(star: number): string
	return string.rep("★", star)
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
		Size = UDim2.fromScale(9, 3.6),
		StudsOffsetWorldSpace = Vector3.new(0, height / 2 + 2.4, 0),
		MaxDistance = if mode == "parade" then 110 else 70,
		LightInfluence = 0,
		AlwaysOnTop = false,
		ResetOnSpawn = false,
	}) :: BillboardGui
	local frame = Kit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Parent = gui })
	Kit.list(frame, true, 0, Enum.HorizontalAlignment.Center)

	if mutation.id ~= "none" then
		local m = line(frame, 1, 0.2, "✨ " .. string.upper(Lang.pick(mutation.name)), mutation.label)
		if mutation.id == "rainbow" then
			local g = Instance.new("UIGradient")
			g.Color = RAINBOW
			g.Parent = m
		end
	end
	line(frame, 2, 0.3, Lang.pick(species.name) .. " " .. SlimeLabel.stars(info.star), Kit.colors.white)
	local r = line(frame, 3, 0.2, Lang.pick(rarity.name), rarity.color)
	if rarity.id == "secret" then
		r.TextColor3 = Color3.new(1, 1, 1)
		local g = Instance.new("UIGradient")
		g.Color = RAINBOW
		g.Parent = r
	end
	if mode == "parade" then
		local p = line(frame, 4, 0.3, Format.cash(price or species.price), Kit.colors.yellow)
		p.Name = "Price"
	else
		local inc = line(frame, 4, 0.24, Format.cash(Calc.slimeIncome(info)) .. "/s", Kit.colors.cash)
		inc.Name = "Income"
	end
	return gui
end

return SlimeLabel
