--!strict
-- 로벅스 상점: 게임패스 · 개발자 상품. ID가 0인 상품은 숨깁니다.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Products = require(Shared.Config.Products)

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Lang = require(Client.Lang)
local State = require(Client.State)

local Store = {}

type Item = { kind: string, key: string, id: number, button: TextButton }
local items: { Item } = {}

local function priceText(id: number, infoType: Enum.InfoType): string
	local ok, info = pcall(function()
		return MarketplaceService:GetProductInfoAsync(id, infoType)
	end)
	if ok and type(info) == "table" and type(info.PriceInRobux) == "number" then
		return "R$ " .. tostring(info.PriceInRobux)
	end
	return Lang.t("buy")
end

local function card(parent: Instance, order: number, icon: string, name: string, desc: string, kind: string, key: string, id: number)
	local c = Kit.new("Frame", {
		Size = UDim2.new(1, 0, 0, 78),
		BackgroundColor3 = Kit.colors.card,
		LayoutOrder = order,
		Parent = parent,
	}) :: Frame
	Kit.corner(c, 14)
	Kit.stroke(c, 3)
	Kit.label({ Size = UDim2.fromOffset(56, 56), Position = UDim2.fromOffset(10, 11), Text = icon, stroke = false, Parent = c })
	Kit.label({
		Size = UDim2.new(1, -230, 0, 30),
		Position = UDim2.fromOffset(74, 8),
		Text = name,
		TextXAlignment = Enum.TextXAlignment.Left,
		Parent = c,
	})
	Kit.label({
		Size = UDim2.new(1, -230, 0, 24),
		Position = UDim2.fromOffset(74, 42),
		Text = desc,
		TextColor3 = Kit.colors.muted,
		Font = Kit.fontBody,
		TextXAlignment = Enum.TextXAlignment.Left,
		stroke = false,
		Parent = c,
	})
	local button = Kit.button({
		Text = "...",
		Color = Kit.colors.green,
		Size = UDim2.fromOffset(130, 52),
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -10, 0.5, 0),
		Parent = c,
	}, function()
		if kind == "pass" then
			if not State.hasPass(key) then
				MarketplaceService:PromptGamePassPurchase(Players.LocalPlayer, id)
			end
		else
			MarketplaceService:PromptProductPurchase(Players.LocalPlayer, id)
		end
	end)
	table.insert(items, { kind = kind, key = key, id = id, button = button })
	task.spawn(function()
		local text = priceText(id, if kind == "pass" then Enum.InfoType.GamePass else Enum.InfoType.Product)
		button:SetAttribute("Price", text)
		Store.refresh()
	end)
end

function Store.refresh()
	for _, item in items do
		local price = item.button:GetAttribute("Price")
		if item.kind == "pass" and State.hasPass(item.key) then
			item.button.Text = Lang.t("owned")
			Kit.setEnabled(item.button, false)
		else
			item.button.Text = if type(price) == "string" then price else "..."
			Kit.setEnabled(item.button, true, Kit.colors.green)
		end
	end
end

function Store.init()
	local p = Panel.new("Store", "💎 " .. Lang.t("storeTitle"), Kit.colors.purple)
	Kit.list(p.content, true, 8, Enum.HorizontalAlignment.Center)
	local order = 0
	local any = false
	order += 1
	Kit.label({ Size = UDim2.new(1, 0, 0, 30), Text = Lang.t("storePasses"), LayoutOrder = order, Parent = p.content })
	for _, pass in Products.passes do
		if pass.id ~= 0 then
			any = true
			order += 1
			card(p.content, order, pass.icon, Lang.pick(pass.name), Lang.pick(pass.desc), "pass", pass.key, pass.id)
		end
	end
	order += 1
	Kit.label({ Size = UDim2.new(1, 0, 0, 30), Text = Lang.t("storeProducts"), LayoutOrder = order, Parent = p.content })
	for _, product in Products.products do
		if product.id ~= 0 then
			any = true
			order += 1
			card(p.content, order, product.icon, Lang.pick(product.name), Lang.pick(product.desc), "product", product.key, product.id)
		end
	end
	if not any then
		order += 1
		Kit.label({
			Size = UDim2.new(1, 0, 0, 80),
			Text = Lang.t("storeSoon"),
			TextColor3 = Kit.colors.muted,
			TextWrapped = true,
			LayoutOrder = order,
			Parent = p.content,
		})
	end
	p.onOpen = Store.refresh
	State.changed:Connect(function()
		if p.isOpen then
			Store.refresh()
		end
	end)
end

return Store
