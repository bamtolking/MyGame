--!strict
-- 가운데 모달 창. 한 번에 하나만 열립니다.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local Kit = require(script.Parent.Kit)

local Panel = {}

export type PanelObj = {
	name: string,
	root: Frame,
	window: Frame,
	content: ScrollingFrame,
	title: TextLabel,
	isOpen: boolean,
	onOpen: (() -> ())?,
	onClose: (() -> ())?,
}

local gui: ScreenGui? = nil
local panels: { [string]: PanelObj } = {}
local current: PanelObj? = nil

function Panel.gui(): ScreenGui
	if not gui then
		local g = Kit.new("ScreenGui", {
			Name = "Panels",
			ResetOnSpawn = false,
			DisplayOrder = 20,
			IgnoreGuiInset = true,
			ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
			Parent = Players.LocalPlayer:WaitForChild("PlayerGui"),
		}) :: ScreenGui
		gui = g
		return g
	end
	return gui :: ScreenGui
end

local function fitScale(): number
	local cam = Workspace.CurrentCamera
	if not cam then
		return 1
	end
	local size = cam.ViewportSize
	return math.clamp(math.min(size.Y / 560, size.X / 640), 0.6, 1.15)
end

function Panel.new(name: string, titleText: string, color: Color3): PanelObj
	local screen = Panel.gui()
	local root = Kit.new("Frame", {
		Name = name,
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 0.55,
		Visible = false,
		Active = true,
		Parent = screen,
	}) :: Frame
	local backdrop = Kit.new("TextButton", {
		Name = "Backdrop",
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		Text = "",
		AutoButtonColor = false,
		Parent = root,
	}) :: TextButton

	local window = Kit.new("Frame", {
		Name = "Window",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.52),
		Size = UDim2.fromOffset(600, 450),
		BackgroundColor3 = Kit.colors.bg,
		Parent = root,
	}) :: Frame
	Kit.corner(window, 22)
	Kit.stroke(window, 5)
	local scale = Instance.new("UIScale")
	scale.Parent = window

	local header = Kit.new("Frame", {
		Name = "Header",
		Size = UDim2.new(1, 0, 0, 64),
		BackgroundColor3 = color,
		Parent = window,
	}) :: Frame
	Kit.corner(header, 22)
	Kit.gradient(header, Color3.new(1, 1, 1), Color3.fromRGB(175, 175, 175))
	-- 헤더 아래쪽 모서리를 네모로 보이게 덮개
	Kit.new("Frame", {
		Size = UDim2.new(1, 0, 0, 20),
		Position = UDim2.new(0, 0, 1, -20),
		BackgroundColor3 = color,
		BorderSizePixel = 0,
		Parent = header,
	})
	local title = Kit.label({
		Size = UDim2.new(1, -140, 0, 46),
		Position = UDim2.fromOffset(70, 9),
		Text = titleText,
		stroke = 3,
		Parent = header,
	})
	local closeBtn = Kit.button({
		Text = "X",
		Color = Kit.colors.red,
		Size = UDim2.fromOffset(50, 50),
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -8, 0, 7),
		Radius = 25,
		Parent = header,
	})

	local content = Kit.new("ScrollingFrame", {
		Name = "Content",
		Position = UDim2.fromOffset(12, 74),
		Size = UDim2.new(1, -24, 1, -86),
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		ScrollBarThickness = 8,
		ScrollBarImageColor3 = Kit.colors.purple,
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollingDirection = Enum.ScrollingDirection.Y,
		Parent = window,
	}) :: ScrollingFrame
	local pad = Instance.new("UIPadding")
	pad.PaddingRight = UDim.new(0, 10)
	pad.PaddingTop = UDim.new(0, 4)
	pad.PaddingBottom = UDim.new(0, 8)
	pad.Parent = content

	local obj: PanelObj = {
		name = name,
		root = root,
		window = window,
		content = content,
		title = title,
		isOpen = false,
		onOpen = nil,
		onClose = nil,
	}
	panels[name] = obj

	local function close()
		Panel.close(name)
	end
	closeBtn.Activated:Connect(close)
	backdrop.Activated:Connect(close)
	window:GetPropertyChangedSignal("AbsoluteSize"):Connect(function()
		scale.Scale = fitScale()
	end)
	scale.Scale = fitScale()
	return obj
end

function Panel.open(name: string)
	local p = panels[name]
	if not p then
		return
	end
	if current and current ~= p then
		Panel.close(current.name)
	end
	current = p
	p.isOpen = true
	p.root.Visible = true
	local scale = p.window:FindFirstChildOfClass("UIScale")
	if scale then
		local target = fitScale()
		scale.Scale = target * 0.85
		Kit.tween(scale, 0.22, { Scale = target }, Enum.EasingStyle.Back)
	end
	if p.onOpen then
		p.onOpen()
	end
end

function Panel.close(name: string)
	local p = panels[name]
	if not p or not p.isOpen then
		return
	end
	p.isOpen = false
	p.root.Visible = false
	if current == p then
		current = nil
	end
	if p.onClose then
		p.onClose()
	end
end

function Panel.toggle(name: string)
	local p = panels[name]
	if p and p.isOpen then
		Panel.close(name)
	else
		Panel.open(name)
	end
end

function Panel.isOpen(name: string): boolean
	local p = panels[name]
	return p ~= nil and p.isOpen
end

function Panel.clear(p: PanelObj)
	for _, c in p.content:GetChildren() do
		if c:IsA("GuiObject") then
			c:Destroy()
		end
	end
end

return Panel
