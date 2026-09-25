--!strict
-- 가운데 모달 창. 한 번에 하나만 열립니다.
-- 열릴 때: 배경 흐림(블러) + 어두운 막 + 창이 아래에서 튀어 오르며 커짐 + 소리
-- 닫힐 때: 창이 작아지며 사라짐

local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local Kit = require(script.Parent.Kit)
local Sound = require(script.Parent.Parent.Controllers.Sound)

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
local blur: BlurEffect? = nil
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
		local b = Instance.new("BlurEffect")
		b.Name = "PanelBlur"
		b.Size = 0
		b.Parent = Lighting
		blur = b
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

local function setBlur(on: boolean)
	local b = blur
	if b then
		Kit.tween(b, 0.25, { Size = if on then 12 else 0 })
	end
end

function Panel.new(name: string, titleText: string, color: Color3): PanelObj
	local screen = Panel.gui()
	local root = Kit.new("Frame", {
		Name = name,
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.fromRGB(12, 6, 26),
		BackgroundTransparency = 1,
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
	Kit.corner(window, 24)
	Kit.stroke(window, 5)
	Kit.gradient(window, Color3.fromRGB(255, 255, 255), Color3.fromRGB(190, 185, 215))
	local scale = Instance.new("UIScale")
	scale.Name = "FitScale"
	scale.Parent = window

	-- 창 아래 두께감
	local base = Kit.new("Frame", {
		Name = "Base",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 1, -18),
		Size = UDim2.new(1, 0, 0, 28),
		BackgroundColor3 = Kit.darken(Kit.colors.bg, 0.4),
		ZIndex = 0,
		Parent = window,
	}) :: Frame
	Kit.corner(base, 24)

	local header = Kit.new("Frame", {
		Name = "Header",
		Size = UDim2.new(1, 0, 0, 66),
		BackgroundColor3 = color,
		Parent = window,
	}) :: Frame
	Kit.corner(header, 24)
	Kit.gradient(header, Kit.lighten(color, 0.25), Kit.darken(color, 0.15))
	-- 헤더 아래 모서리를 네모로 보이게 덮개
	local cover = Kit.new("Frame", {
		Size = UDim2.new(1, 0, 0, 22),
		Position = UDim2.new(0, 0, 1, -22),
		BackgroundColor3 = Kit.darken(color, 0.15),
		BorderSizePixel = 0,
		Parent = header,
	}) :: Frame
	assert(cover)
	-- 헤더 광택
	local gloss = Kit.new("Frame", {
		Size = UDim2.new(1, -24, 0, 22),
		Position = UDim2.fromOffset(12, 5),
		BackgroundColor3 = Color3.new(1, 1, 1),
		BackgroundTransparency = 0.8,
		BorderSizePixel = 0,
		Parent = header,
	}) :: Frame
	Kit.corner(gloss, 11)
	local title = Kit.label({
		Size = UDim2.new(1, -140, 0, 46),
		Position = UDim2.fromOffset(70, 10),
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
		Position = UDim2.fromOffset(12, 76),
		Size = UDim2.new(1, -24, 1, -88),
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
	pad.PaddingTop = UDim.new(0, 6)
	pad.PaddingBottom = UDim.new(0, 12)
	pad.PaddingLeft = UDim.new(0, 2)
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
		if obj.isOpen then
			scale.Scale = fitScale()
		end
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
		Panel.close(current.name, true)
	end
	local wasOpen = p.isOpen
	current = p
	p.isOpen = true
	p.root.Visible = true
	if not wasOpen then
		Sound.play("open")
		setBlur(true)
		p.root.BackgroundTransparency = 1
		Kit.tween(p.root, 0.2, { BackgroundTransparency = 0.45 })
		local scale = p.window:FindFirstChild("FitScale")
		if scale and scale:IsA("UIScale") then
			local target = fitScale()
			scale.Scale = target * 0.8
			Kit.tween(scale, 0.28, { Scale = target }, Enum.EasingStyle.Back)
		end
		p.window.Position = UDim2.new(0.5, 0, 0.52, 40)
		Kit.tween(p.window, 0.28, { Position = UDim2.fromScale(0.5, 0.52) }, Enum.EasingStyle.Back)
	end
	if p.onOpen then
		p.onOpen()
	end
end

-- instant: 다른 창으로 바로 바꿀 때(닫힘 애니메이션·블러 해제 생략)
function Panel.close(name: string, instant: boolean?)
	local p = panels[name]
	if not p or not p.isOpen then
		return
	end
	p.isOpen = false
	if current == p then
		current = nil
	end
	if p.onClose then
		p.onClose()
	end
	if instant then
		p.root.Visible = false
		return
	end
	Sound.play("close")
	setBlur(false)
	Kit.tween(p.root, 0.16, { BackgroundTransparency = 1 })
	local scale = p.window:FindFirstChild("FitScale")
	if scale and scale:IsA("UIScale") then
		Kit.tween(scale, 0.16, { Scale = fitScale() * 0.85 })
	end
	task.delay(0.16, function()
		if not p.isOpen then
			p.root.Visible = false
		end
	end)
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

function Panel.anyOpen(): boolean
	return current ~= nil
end

function Panel.clear(p: PanelObj)
	for _, c in p.content:GetChildren() do
		if c:IsA("GuiObject") then
			c:Destroy()
		end
	end
end

return Panel
