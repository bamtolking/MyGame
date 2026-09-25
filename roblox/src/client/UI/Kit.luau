--!strict
-- UI 부품 모음: 색, 글꼴, 둥근 버튼(누름 효과), 패널, 진행 막대 등.

local TweenService = game:GetService("TweenService")

local Kit = {}

Kit.font = Enum.Font.FredokaOne
Kit.fontBody = Enum.Font.GothamBold

Kit.colors = {
	bg = Color3.fromRGB(34, 24, 62),
	bgLight = Color3.fromRGB(58, 42, 100),
	card = Color3.fromRGB(72, 54, 122),
	stroke = Color3.fromRGB(20, 12, 40),
	white = Color3.fromRGB(255, 255, 255),
	muted = Color3.fromRGB(190, 180, 220),
	purple = Color3.fromRGB(135, 90, 255),
	pink = Color3.fromRGB(255, 90, 170),
	green = Color3.fromRGB(70, 210, 110),
	yellow = Color3.fromRGB(255, 205, 60),
	red = Color3.fromRGB(255, 80, 90),
	blue = Color3.fromRGB(70, 160, 255),
	orange = Color3.fromRGB(255, 150, 50),
	gray = Color3.fromRGB(120, 115, 140),
	cash = Color3.fromRGB(120, 255, 140),
}

export type Props = { [string]: any }

-- Instance.new + 속성 + 자식
function Kit.new(className: string, props: Props?, children: { Instance }?): Instance
	local inst = Instance.new(className)
	local parent: Instance? = nil
	if props then
		for k, v in props do
			if k == "Parent" then
				parent = v
			else
				(inst :: any)[k] = v
			end
		end
	end
	if children then
		for _, c in children do
			c.Parent = inst
		end
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

function Kit.corner(parent: Instance, radius: number?): UICorner
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 12)
	c.Parent = parent
	return c
end

function Kit.stroke(parent: Instance, thickness: number?, color: Color3?): UIStroke
	local s = Instance.new("UIStroke")
	s.Thickness = thickness or 3
	s.Color = color or Kit.colors.stroke
	s.ApplyStrokeMode = if parent:IsA("TextLabel") or parent:IsA("TextButton")
		then Enum.ApplyStrokeMode.Contextual
		else Enum.ApplyStrokeMode.Border
	s.Parent = parent
	return s
end

-- 글자 테두리(버튼·라벨의 텍스트에만)
function Kit.textStroke(parent: TextLabel | TextButton, thickness: number?)
	local s = Instance.new("UIStroke")
	s.Thickness = thickness or 2
	s.Color = Kit.colors.stroke
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual
	s.Parent = parent
end

function Kit.gradient(parent: Instance, top: Color3, bottom: Color3): UIGradient
	local g = Instance.new("UIGradient")
	g.Color = ColorSequence.new(top, bottom)
	g.Rotation = 90
	g.Parent = parent
	return g
end

function Kit.padding(parent: Instance, px: number)
	local p = Instance.new("UIPadding")
	p.PaddingTop = UDim.new(0, px)
	p.PaddingBottom = UDim.new(0, px)
	p.PaddingLeft = UDim.new(0, px)
	p.PaddingRight = UDim.new(0, px)
	p.Parent = parent
end

function Kit.list(parent: Instance, vertical: boolean, gap: number, align: Enum.HorizontalAlignment?): UIListLayout
	local l = Instance.new("UIListLayout")
	l.FillDirection = if vertical then Enum.FillDirection.Vertical else Enum.FillDirection.Horizontal
	l.Padding = UDim.new(0, gap)
	l.SortOrder = Enum.SortOrder.LayoutOrder
	if align then
		l.HorizontalAlignment = align
	end
	l.VerticalAlignment = Enum.VerticalAlignment.Center
	l.Parent = parent
	return l
end

function Kit.tween(inst: Instance, seconds: number, props: { [string]: any }, style: Enum.EasingStyle?, dir: Enum.EasingDirection?): Tween
	local t = TweenService:Create(
		inst,
		TweenInfo.new(seconds, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out),
		props
	)
	t:Play()
	return t
end

function Kit.label(props: Props): TextLabel
	local label = Kit.new("TextLabel", {
		BackgroundTransparency = 1,
		Font = Kit.font,
		TextColor3 = Kit.colors.white,
		TextScaled = true,
		Size = UDim2.fromScale(1, 1),
	}) :: TextLabel
	for k, v in props do
		if k ~= "Parent" and k ~= "stroke" then
			(label :: any)[k] = v
		end
	end
	if props.stroke ~= false then
		Kit.textStroke(label, if type(props.stroke) == "number" then props.stroke else 2)
	end
	if props.Parent then
		label.Parent = props.Parent
	end
	return label
end

local pressSound: ((string) -> ())? = nil
function Kit.setClickSound(fn: (string) -> ())
	pressSound = fn
end

-- 둥근 그라데이션 버튼. onClick은 누를 때 실행
function Kit.button(props: Props, onClick: (() -> ())?): TextButton
	local color: Color3 = props.Color or Kit.colors.purple
	local btn = Kit.new("TextButton", {
		AutoButtonColor = false,
		BackgroundColor3 = color,
		Font = Kit.font,
		TextColor3 = Kit.colors.white,
		TextScaled = true,
		Text = props.Text or "",
		Size = props.Size or UDim2.fromOffset(160, 50),
		Position = props.Position or UDim2.new(),
		AnchorPoint = props.AnchorPoint or Vector2.new(),
		LayoutOrder = props.LayoutOrder or 0,
		ZIndex = props.ZIndex or 1,
	}) :: TextButton
	Kit.corner(btn, props.Radius or 14)
	local stroke = Kit.stroke(btn, 3)
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	Kit.textStroke(btn, 2)
	Kit.gradient(btn, Color3.new(1, 1, 1), Color3.fromRGB(190, 190, 190))
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 8)
	pad.PaddingRight = UDim.new(0, 8)
	pad.PaddingTop = UDim.new(0, 5)
	pad.PaddingBottom = UDim.new(0, 5)
	pad.Parent = btn
	local scale = Instance.new("UIScale")
	scale.Parent = btn

	btn.MouseEnter:Connect(function()
		Kit.tween(scale, 0.1, { Scale = 1.05 })
	end)
	btn.MouseLeave:Connect(function()
		Kit.tween(scale, 0.1, { Scale = 1 })
	end)
	btn.MouseButton1Down:Connect(function()
		Kit.tween(scale, 0.06, { Scale = 0.92 })
	end)
	btn.MouseButton1Up:Connect(function()
		Kit.tween(scale, 0.1, { Scale = 1 })
	end)
	if onClick then
		btn.Activated:Connect(function()
			if pressSound then
				pressSound("click")
			end
			onClick()
		end)
	end
	if props.Parent then
		btn.Parent = props.Parent
	end
	return btn
end

-- 버튼 활성/비활성 모양
function Kit.setEnabled(btn: TextButton, enabled: boolean, color: Color3?)
	btn.Active = enabled
	btn.AutoButtonColor = false
	btn.BackgroundColor3 = if enabled then (color or btn.BackgroundColor3) else Kit.colors.gray
	btn:SetAttribute("Enabled", enabled)
end

-- 진행 막대. 반환된 함수로 값(0~1)을 바꿉니다.
function Kit.progress(parent: Instance, color: Color3, props: Props?): (Frame, (number) -> ())
	local bar = Kit.new("Frame", {
		BackgroundColor3 = Kit.colors.stroke,
		Size = UDim2.new(1, 0, 0, 16),
		Parent = parent,
	}) :: Frame
	if props then
		for k, v in props do
			(bar :: any)[k] = v
		end
	end
	Kit.corner(bar, 8)
	local fill = Kit.new("Frame", {
		BackgroundColor3 = color,
		Size = UDim2.fromScale(0, 1),
		Parent = bar,
	}) :: Frame
	Kit.corner(fill, 8)
	return bar, function(v: number)
		fill.Size = UDim2.fromScale(math.clamp(v, 0, 1), 1)
	end
end

-- 빨간 알림 점(숫자)
function Kit.badge(parent: GuiObject): TextLabel
	local b = Kit.new("TextLabel", {
		Name = "Badge",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.new(1, -6, 0, 6),
		Size = UDim2.fromOffset(24, 24),
		BackgroundColor3 = Kit.colors.red,
		Font = Kit.font,
		TextScaled = true,
		TextColor3 = Kit.colors.white,
		Text = "!",
		Visible = false,
		ZIndex = (parent.ZIndex or 1) + 5,
		Parent = parent,
	}) :: TextLabel
	Kit.corner(b, 12)
	Kit.stroke(b, 2)
	return b
end

return Kit
