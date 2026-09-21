--!nonstrict
-- 레시피 책과 상점 패널.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("GhostDiner")
local Recipes = require(Shared:WaitForChild("Recipes"))
local Upgrades = require(Shared:WaitForChild("Upgrades"))

local Panels = {}

local FONT = Enum.Font.GothamBold
local FONT_REG = Enum.Font.Gotham

local function mk(className: string, props: { [string]: any }, parent: Instance?): Instance
	local inst = Instance.new(className)
	for k, v in props do
		(inst :: any)[k] = v
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

local function corner(parent: Instance, radius: number?)
	mk("UICorner", { CornerRadius = UDim.new(0, radius or 10) }, parent)
end

local function panelFrame(gui: Instance, name: string, title: string, side: string): (Frame, ScrollingFrame)
	local frame = mk("Frame", {
		Name = name,
		Visible = false,
		AnchorPoint = if side == "left" then Vector2.new(0, 0) else Vector2.new(1, 0),
		Position = if side == "left" then UDim2.new(0, 12, 0, 96) else UDim2.new(1, -12, 0, 146),
		Size = UDim2.new(0, 380, 1, -160),
		BackgroundColor3 = Color3.fromRGB(24, 20, 36),
		BackgroundTransparency = 0.08,
		ZIndex = 10,
	}, gui) :: Frame
	corner(frame, 14)
	mk("UISizeConstraint", { MaxSize = Vector2.new(380, 560), MinSize = Vector2.new(260, 220) }, frame)
	mk("UIStroke", { Color = Color3.fromRGB(150, 90, 220), Thickness = 1.5, Transparency = 0.2 }, frame)
	mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 14, 0, 8), Size = UDim2.new(1, -28, 0, 34), Font = FONT, TextSize = 22, TextColor3 = Color3.fromRGB(255, 225, 160), TextXAlignment = Enum.TextXAlignment.Left, Text = title, ZIndex = 11 }, frame)
	local close = mk("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -10, 0, 10), Size = UDim2.new(0, 30, 0, 30), BackgroundColor3 = Color3.fromRGB(90, 40, 60), Font = FONT, TextSize = 16, Text = "✕", TextColor3 = Color3.fromRGB(255, 255, 255), ZIndex = 11 }, frame) :: TextButton
	corner(close, 8)
	close.MouseButton1Click:Connect(function()
		frame.Visible = false
	end)
	local scroll = mk("ScrollingFrame", {
		Position = UDim2.new(0, 10, 0, 50),
		Size = UDim2.new(1, -20, 1, -60),
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		ScrollBarThickness = 6,
		CanvasSize = UDim2.new(0, 0, 0, 0),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollingDirection = Enum.ScrollingDirection.Y,
		ZIndex = 11,
	}, frame) :: ScrollingFrame
	mk("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, scroll)
	return frame, scroll
end

function Panels.create(gui: Instance, state: Instance, buyRemote: RemoteFunction, toast: (string, string?) -> ())
	local self = {}

	-- 레시피 책
	local recipeFrame, recipeScroll = panelFrame(gui, "RecipePanel", "📖 레시피 책", "left")
	self.recipeFrame = recipeFrame
	local lastNight = -1
	local function rebuildRecipes()
		local rawNight = state:GetAttribute("Night")
		local night = if type(rawNight) == "number" then math.max(1, rawNight) else 1
		if night == lastNight then
			return
		end
		lastNight = night
		for _, c in recipeScroll:GetChildren() do
			if c:IsA("Frame") then
				c:Destroy()
			end
		end
		for i, dishId in Recipes.allDishes() do
			local item = Recipes.Items[dishId]
			local unlocked = (item.unlock or 1) <= night
			local card = mk("Frame", { Size = UDim2.new(1, -6, 0, 60), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = if unlocked then Color3.fromRGB(45, 38, 62) else Color3.fromRGB(32, 28, 40), BackgroundTransparency = 0.1, LayoutOrder = i, ZIndex = 12 }, recipeScroll)
			corner(card, 10)
			mk("UIPadding", { PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10), PaddingTop = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8) }, card)
			mk("UIListLayout", { Padding = UDim.new(0, 2), SortOrder = Enum.SortOrder.LayoutOrder }, card)
			local titleText = string.format("%s %s  ·  %d코인", item.emoji or "", item.name, item.price or 0)
			if not unlocked then
				titleText ..= string.format("  (🔒 %d번째 밤부터)", item.unlock or 1)
			end
			mk("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 24), Font = FONT, TextSize = 18, TextColor3 = if unlocked then Color3.fromRGB(255, 230, 170) else Color3.fromRGB(150, 140, 160), TextXAlignment = Enum.TextXAlignment.Left, Text = titleText, LayoutOrder = 1, ZIndex = 13 }, card)
			local steps = Recipes.describe(dishId)
			local body = {}
			for _, s in steps do
				if not string.find(s, "재료 상자") then
					table.insert(body, "• " .. s)
				end
			end
			mk("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 20), AutomaticSize = Enum.AutomaticSize.Y, Font = FONT_REG, TextSize = 15, TextWrapped = true, TextColor3 = if unlocked then Color3.fromRGB(230, 225, 240) else Color3.fromRGB(140, 135, 150), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Text = table.concat(body, "\n"), LayoutOrder = 2, ZIndex = 13 }, card)
		end
	end
	self.rebuildRecipes = rebuildRecipes

	-- 상점
	local shopFrame, shopScroll = panelFrame(gui, "ShopPanel", "🛒 상점 (팀 코인으로 구매)", "right")
	self.shopFrame = shopFrame
	local rows = {}
	local function refreshShop()
		local rawCoins = state:GetAttribute("Coins")
		local coins = if type(rawCoins) == "number" then rawCoins else 0
		for id, row in rows do
			local rawLevel = state:GetAttribute("Upg_" .. id)
			local level = if type(rawLevel) == "number" then rawLevel else 0
			local u = row.upgrade
			local cost = Upgrades.cost(id, level)
			if u.max < 99 then
				row.name.Text = string.format("%s %s  [%d/%d]", u.emoji or "", u.name, level, u.max)
			else
				row.name.Text = string.format("%s %s  [%d회]", u.emoji or "", u.name, level)
			end
			if cost then
				row.buy.Text = string.format("🪙 %d", cost)
				row.buy.BackgroundColor3 = if coins >= cost then Color3.fromRGB(90, 50, 150) else Color3.fromRGB(70, 60, 80)
			else
				row.buy.Text = "최대"
				row.buy.BackgroundColor3 = Color3.fromRGB(60, 60, 70)
			end
		end
	end
	self.refreshShop = refreshShop
	for i, u in Upgrades.List do
		local row = mk("Frame", { Size = UDim2.new(1, -6, 0, 64), BackgroundColor3 = Color3.fromRGB(45, 38, 62), BackgroundTransparency = 0.1, LayoutOrder = i, ZIndex = 12 }, shopScroll)
		corner(row, 10)
		local name = mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 10, 0, 6), Size = UDim2.new(1, -120, 0, 24), Font = FONT, TextSize = 17, TextColor3 = Color3.fromRGB(255, 230, 170), TextXAlignment = Enum.TextXAlignment.Left, Text = (u.emoji or "") .. " " .. u.name, ZIndex = 13 }, row) :: TextLabel
		mk("TextLabel", { BackgroundTransparency = 1, Position = UDim2.new(0, 10, 0, 30), Size = UDim2.new(1, -120, 0, 30), Font = FONT_REG, TextSize = 14, TextWrapped = true, TextColor3 = Color3.fromRGB(215, 210, 225), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Text = u.desc, ZIndex = 13 }, row)
		local buy = mk("TextButton", { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -10, 0.5, 0), Size = UDim2.new(0, 96, 0, 44), BackgroundColor3 = Color3.fromRGB(90, 50, 150), Font = FONT, TextSize = 15, TextColor3 = Color3.fromRGB(255, 255, 255), Text = "", ZIndex = 13 }, row) :: TextButton
		corner(buy, 8)
		buy.MouseButton1Click:Connect(function()
			buy.Text = "…"
			task.spawn(function()
				local ok, success, message = pcall(function()
					return buyRemote:InvokeServer(u.id)
				end)
				if not ok then
					toast("구매 요청 실패", "bad")
				elseif not success then
					toast(tostring(message), "bad")
				end
				refreshShop()
			end)
		end)
		rows[u.id] = { name = name, buy = buy, upgrade = u }
	end

	function self.toggleRecipes()
		rebuildRecipes()
		recipeFrame.Visible = not recipeFrame.Visible
	end

	function self.toggleShop()
		self.refreshShop()
		shopFrame.Visible = not shopFrame.Visible
	end

	function self.openShop()
		self.refreshShop()
		shopFrame.Visible = true
	end

	function self.closeAll()
		recipeFrame.Visible = false
		shopFrame.Visible = false
	end

	rebuildRecipes()
	self.refreshShop()
	return self
end

return Panels
