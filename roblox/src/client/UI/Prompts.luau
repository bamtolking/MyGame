--!strict
-- 게임 전용 상호작용 프롬프트(ProximityPrompt Style = Custom).
-- 프롬프트 속성으로 모양을 정합니다:
--   Theme  : "buy" | "steal" | "manage"   (테두리·버튼 색)
--   Price  : number(선택)                 → 가격 줄, 살 수 있으면 초록/부족하면 빨강
--   Accent : Color3(선택)                 → 대상 이름 색(등급 색)
-- 길게 누르는 프롬프트는 게이지가 차오르고, 터치 화면에서는 카드를 눌러 실행합니다.

local Players = game:GetService("Players")
local ProximityPromptService = game:GetService("ProximityPromptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Format = require(Shared.Util.Format)

local Client = script.Parent.Parent
local State = require(Client.State)
local Kit = require(script.Parent.Kit)
local Sound = require(Client.Controllers.Sound)

local Prompts = {}

local THEME: { [string]: Color3 } = {
	buy = Kit.colors.green,
	steal = Kit.colors.red,
	manage = Kit.colors.blue,
}

type Shown = { gui: BillboardGui, conns: { RBXScriptConnection }, refresh: () -> () }
local shown: { [ProximityPrompt]: Shown } = {}
local playerGui: Instance

local function keyText(prompt: ProximityPrompt, inputType: Enum.ProximityPromptInputType): string
	if inputType == Enum.ProximityPromptInputType.Touch then
		return "👆"
	elseif inputType == Enum.ProximityPromptInputType.Gamepad then
		return (string.gsub(prompt.GamepadKeyCode.Name, "Button", ""))
	end
	return prompt.KeyboardKeyCode.Name
end

local function hide(prompt: ProximityPrompt)
	local s = shown[prompt]
	if not s then
		return
	end
	shown[prompt] = nil
	for _, c in s.conns do
		c:Disconnect()
	end
	local g = s.gui
	local card = g:FindFirstChild("Card")
	if card and card:IsA("GuiObject") then
		Kit.tween(Kit.scaleOf(card), 0.12, { Scale = 0.6 })
	end
	task.delay(0.12, function()
		g:Destroy()
	end)
end

local function show(prompt: ProximityPrompt, inputType: Enum.ProximityPromptInputType)
	hide(prompt)
	local theme = prompt:GetAttribute("Theme")
	local color = THEME[if type(theme) == "string" then theme else "manage"] or Kit.colors.blue
	local price = prompt:GetAttribute("Price")
	local accent = prompt:GetAttribute("Accent")
	local touch = inputType == Enum.ProximityPromptInputType.Touch

	local gui = Kit.new("BillboardGui", {
		Name = "SlimePrompt",
		Adornee = prompt.Parent,
		AlwaysOnTop = true,
		Size = UDim2.fromOffset(250, if type(price) == "number" then 86 else 66),
		StudsOffset = Vector3.new(0, 2.2, 0),
		LightInfluence = 0,
		ResetOnSpawn = false,
		Active = touch,
		Parent = playerGui,
	}) :: BillboardGui

	local card = Kit.new(if touch then "TextButton" else "Frame", {
		Name = "Card",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Kit.colors.bg,
		Parent = gui,
	}) :: GuiObject
	if card:IsA("TextButton") then
		card.Text = ""
		card.AutoButtonColor = false
	end
	Kit.corner(card, 16)
	Kit.stroke(card, 3, color)
	Kit.gradient(card, Color3.fromRGB(255, 255, 255), Color3.fromRGB(185, 180, 210))

	local key = Kit.label({
		Size = UDim2.fromOffset(46, 46),
		Position = UDim2.fromOffset(10, 10),
		Text = keyText(prompt, inputType),
		BackgroundColor3 = color,
		BackgroundTransparency = 0,
		stroke = 2,
		Parent = card,
	})
	Kit.corner(key, 12)
	Kit.gradient(key, Color3.new(1, 1, 1), Color3.fromRGB(190, 190, 190))

	Kit.label({
		Size = UDim2.new(1, -72, 0, 26),
		Position = UDim2.fromOffset(64, 7),
		Text = prompt.ActionText,
		TextXAlignment = Enum.TextXAlignment.Left,
		stroke = 2.5,
		Parent = card,
	})
	Kit.label({
		Size = UDim2.new(1, -72, 0, 20),
		Position = UDim2.fromOffset(64, 34),
		Text = prompt.ObjectText,
		TextColor3 = if typeof(accent) == "Color3" then accent else Kit.colors.muted,
		TextXAlignment = Enum.TextXAlignment.Left,
		Parent = card,
	})
	local priceLabel: TextLabel? = nil
	if type(price) == "number" then
		priceLabel = Kit.label({
			Size = UDim2.new(1, -20, 0, 22),
			Position = UDim2.fromOffset(10, 58),
			Text = "💵 " .. Format.cash(price),
			TextXAlignment = Enum.TextXAlignment.Left,
			Parent = card,
		})
	end

	-- 길게 누르기 게이지
	local holdBar = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 8, 1, -4),
		Size = UDim2.new(0, 0, 0, 5),
		BackgroundColor3 = color,
		BorderSizePixel = 0,
		Visible = prompt.HoldDuration > 0,
		Parent = card,
	}) :: Frame
	Kit.corner(holdBar, 3)

	local function refresh()
		if priceLabel and type(price) == "number" then
			local ok = State.cash >= price
			priceLabel.TextColor3 = if ok then Kit.colors.cash else Color3.fromRGB(255, 120, 120)
		end
	end
	refresh()

	local conns: { RBXScriptConnection } = {}
	table.insert(
		conns,
		prompt.PromptButtonHoldBegan:Connect(function()
			holdBar.Size = UDim2.new(0, 0, 0, 5)
			Kit.tween(holdBar, prompt.HoldDuration, { Size = UDim2.new(1, -16, 0, 5) }, Enum.EasingStyle.Linear)
			Kit.bump(card, 0.05)
		end)
	)
	table.insert(
		conns,
		prompt.PromptButtonHoldEnded:Connect(function()
			Kit.tween(holdBar, 0.12, { Size = UDim2.new(0, 0, 0, 5) })
		end)
	)
	table.insert(
		conns,
		prompt.Triggered:Connect(function()
			Kit.pop(card, 0.5)
		end)
	)
	if card:IsA("GuiButton") then
		table.insert(
			conns,
			card.InputBegan:Connect(function(input: InputObject)
				if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
					prompt:InputHoldBegin()
				end
			end)
		)
		table.insert(
			conns,
			card.InputEnded:Connect(function(input: InputObject)
				if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
					prompt:InputHoldEnd()
				end
			end)
		)
	end
	table.insert(conns, State.money:Connect(refresh) :: any)

	shown[prompt] = { gui = gui, conns = conns, refresh = refresh }
	Kit.pop(card, 0.6)
	Sound.play("hover")
end

function Prompts.init()
	playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	ProximityPromptService.PromptShown:Connect(function(prompt: ProximityPrompt, inputType: Enum.ProximityPromptInputType)
		if prompt.Style == Enum.ProximityPromptStyle.Custom then
			show(prompt, inputType)
		end
	end)
	ProximityPromptService.PromptHidden:Connect(function(prompt: ProximityPrompt)
		hide(prompt)
	end)
end

-- 프롬프트 모양 공통 설정
function Prompts.style(prompt: ProximityPrompt, theme: string, accent: Color3?, price: number?)
	prompt.Style = Enum.ProximityPromptStyle.Custom
	prompt:SetAttribute("Theme", theme)
	if accent then
		prompt:SetAttribute("Accent", accent)
	end
	if price then
		prompt:SetAttribute("Price", price)
	end
end

return Prompts
