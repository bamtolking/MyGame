--!strict
-- UI 부품 모음(디자인 시스템).
--  · 입체 버튼: 아래쪽 두께(립) + 윗부분 광택 + 선택적 빛 줄기(스윕), 호버/누름 애니메이션과 소리
--  · 카드, 알약 라벨, 애니메이션 진행 막대, 알림 배지
--  · 모션 도우미: pop(튀어나오기), shake(흔들기), countTo(숫자 올라가기)

local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Kit = {}

Kit.font = Enum.Font.FredokaOne
Kit.fontBody = Enum.Font.GothamBold

Kit.colors = {
	bg = Color3.fromRGB(30, 21, 56),
	bgLight = Color3.fromRGB(58, 42, 100),
	card = Color3.fromRGB(70, 52, 120),
	cardLight = Color3.fromRGB(92, 70, 150),
	stroke = Color3.fromRGB(18, 10, 36),
	white = Color3.fromRGB(255, 255, 255),
	muted = Color3.fromRGB(196, 186, 226),
	purple = Color3.fromRGB(135, 90, 255),
	pink = Color3.fromRGB(255, 90, 170),
	green = Color3.fromRGB(64, 206, 104),
	yellow = Color3.fromRGB(255, 200, 50),
	red = Color3.fromRGB(255, 76, 88),
	blue = Color3.fromRGB(62, 156, 255),
	orange = Color3.fromRGB(255, 146, 46),
	gray = Color3.fromRGB(118, 112, 138),
	cash = Color3.fromRGB(120, 255, 140),
}

export type Props = { [string]: any }

function Kit.darken(c: Color3, amount: number): Color3
	return c:Lerp(Color3.new(0, 0, 0), amount)
end

function Kit.lighten(c: Color3, amount: number): Color3
	return c:Lerp(Color3.new(1, 1, 1), amount)
end

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

function Kit.tween(
	inst: Instance,
	seconds: number,
	props: { [string]: any },
	style: Enum.EasingStyle?,
	dir: Enum.EasingDirection?
): Tween
	local t = TweenService:Create(
		inst,
		TweenInfo.new(seconds, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out),
		props
	)
	t:Play()
	return t
end

-- 요소마다 UIScale 하나를 공유해서 애니메이션에 씀
function Kit.scaleOf(gui: GuiObject): UIScale
	local s = gui:FindFirstChild("KitScale")
	if s and s:IsA("UIScale") then
		return s
	end
	local created = Instance.new("UIScale")
	created.Name = "KitScale"
	created.Parent = gui
	return created
end

-- 톡 튀어나오기(작게 → 조금 크게 → 원래)
function Kit.pop(gui: GuiObject, strength: number?)
	local s = Kit.scaleOf(gui)
	local k = strength or 1
	s.Scale = 1 - 0.35 * k
	local t = Kit.tween(s, 0.14, { Scale = 1 + 0.12 * k }, Enum.EasingStyle.Quad)
	t.Completed:Connect(function()
		Kit.tween(s, 0.16, { Scale = 1 }, Enum.EasingStyle.Back)
	end)
end

-- 살짝 커졌다가 돌아오기(값이 바뀔 때)
function Kit.bump(gui: GuiObject, amount: number?)
	local s = Kit.scaleOf(gui)
	s.Scale = 1 + (amount or 0.12)
	Kit.tween(s, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
end

-- 좌우로 흔들기(오류 등)
function Kit.shake(gui: GuiObject)
	local base = gui.Position
	task.spawn(function()
		for _, dx in { 8, -7, 6, -4, 2, 0 } do
			gui.Position = base + UDim2.fromOffset(dx, 0)
			task.wait(0.03)
		end
		gui.Position = base
	end)
end

-- 숫자가 올라가는 애니메이션. fmt로 표시 문자열을 만듭니다.
function Kit.countTo(label: TextLabel, from: number, to: number, fmt: (number) -> string, seconds: number?): () -> ()
	local prev = label:GetAttribute("CountToken")
	local token = (if type(prev) == "number" then prev else 0) + 1
	label:SetAttribute("CountToken", token)
	local duration = seconds or 0.45
	local started = os.clock()
	task.spawn(function()
		while label:GetAttribute("CountToken") == token do
			local a = math.min(1, (os.clock() - started) / duration)
			local eased = 1 - (1 - a) ^ 3
			label.Text = fmt(from + (to - from) * eased)
			if a >= 1 then
				break
			end
			task.wait()
		end
	end)
	return function()
		label:SetAttribute("CountToken", token + 1)
	end
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

-- 둥근 배경이 있는 작은 라벨(등급·변이·가격 표시)
function Kit.pill(parent: Instance, text: string, color: Color3, props: Props?): TextLabel
	local p = Kit.label({
		Text = text,
		BackgroundColor3 = color,
		BackgroundTransparency = 0,
		Size = UDim2.fromOffset(90, 24),
		Parent = parent,
	})
	if props then
		for k, v in props do
			(p :: any)[k] = v
		end
	end
	Kit.corner(p, 12)
	local st = Instance.new("UIStroke")
	st.Thickness = 2
	st.Color = Kit.darken(color, 0.55)
	st.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	st.Parent = p
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 8)
	pad.PaddingRight = UDim.new(0, 8)
	pad.PaddingTop = UDim.new(0, 2)
	pad.PaddingBottom = UDim.new(0, 2)
	pad.Parent = p
	return p
end

-- 카드(패널 안 한 줄). 윗부분에 은은한 하이라이트
function Kit.card(parent: Instance, props: Props?): Frame
	local card = Kit.new("Frame", {
		BackgroundColor3 = Kit.colors.card,
		Size = UDim2.new(1, 0, 0, 78),
		Parent = parent,
	}) :: Frame
	if props then
		for k, v in props do
			(card :: any)[k] = v
		end
	end
	Kit.corner(card, 16)
	Kit.stroke(card, 3)
	Kit.gradient(card, Color3.fromRGB(255, 255, 255), Color3.fromRGB(205, 200, 225))
	return card
end

local soundFn: ((string) -> ())? = nil
function Kit.setClickSound(fn: (string) -> ())
	soundFn = fn
end
local function sfx(name: string)
	if soundFn then
		soundFn(name)
	end
end

-- 버튼에 빛 줄기(스윕)를 주기적으로 지나가게
function Kit.sweep(btn: GuiObject, radius: number?)
	local sweep = Kit.new("Frame", {
		Name = "Sweep",
		BackgroundColor3 = Color3.new(1, 1, 1),
		BackgroundTransparency = 0,
		Size = UDim2.fromScale(1, 1),
		ZIndex = btn.ZIndex,
		Parent = btn,
	}) :: Frame
	Kit.corner(sweep, radius or 14)
	local g = Instance.new("UIGradient")
	g.Rotation = 20
	g.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 1),
		NumberSequenceKeypoint.new(0.42, 1),
		NumberSequenceKeypoint.new(0.5, 0.55),
		NumberSequenceKeypoint.new(0.58, 1),
		NumberSequenceKeypoint.new(1, 1),
	})
	g.Offset = Vector2.new(-1, 0)
	g.Parent = sweep
	task.spawn(function()
		while sweep.Parent do
			g.Offset = Vector2.new(-1, 0)
			Kit.tween(g, 0.8, { Offset = Vector2.new(1, 0) }, Enum.EasingStyle.Sine)
			task.wait(2.6 + math.random() * 1.5)
		end
	end)
end

-- 입체 버튼. onClick은 누를 때 실행
function Kit.button(props: Props, onClick: (() -> ())?): TextButton
	local color: Color3 = props.Color or Kit.colors.purple
	local radius = props.Radius or 14
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
	Kit.corner(btn, radius)
	local stroke = Kit.stroke(btn, 3)
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	Kit.textStroke(btn, 2)
	Kit.gradient(btn, Color3.new(1, 1, 1), Color3.fromRGB(200, 200, 200))
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 8)
	pad.PaddingRight = UDim.new(0, 8)
	pad.PaddingTop = UDim.new(0, 4)
	pad.PaddingBottom = UDim.new(0, 9)
	pad.Parent = btn

	-- 아래쪽 두께(립)
	local lip = Kit.new("Frame", {
		Name = "Lip",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, 9),
		Size = UDim2.new(1, 16, 0, 7),
		BackgroundColor3 = Kit.darken(color, 0.35),
		BorderSizePixel = 0,
		ZIndex = btn.ZIndex,
		Parent = btn,
	}) :: Frame
	Kit.corner(lip, radius)
	-- 윗부분 광택
	local gloss = Kit.new("Frame", {
		Name = "Gloss",
		Position = UDim2.new(0, -4, 0, -2),
		Size = UDim2.new(1, 8, 0.48, 0),
		BackgroundColor3 = Color3.new(1, 1, 1),
		BorderSizePixel = 0,
		ZIndex = btn.ZIndex,
		Parent = btn,
	}) :: Frame
	Kit.corner(gloss, radius)
	local gg = Instance.new("UIGradient")
	gg.Rotation = 90
	gg.Transparency = NumberSequence.new(0.72, 1)
	gg.Parent = gloss
	if props.Shine then
		Kit.sweep(btn, radius)
	end

	local scale = Kit.scaleOf(btn)
	local touch = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
	btn.MouseEnter:Connect(function()
		Kit.tween(scale, 0.12, { Scale = 1.06 }, Enum.EasingStyle.Back)
		if not touch and btn:GetAttribute("Enabled") ~= false then
			sfx("hover")
		end
	end)
	btn.MouseLeave:Connect(function()
		Kit.tween(scale, 0.12, { Scale = 1 })
	end)
	btn.MouseButton1Down:Connect(function()
		Kit.tween(scale, 0.06, { Scale = 0.93 })
		lip.Size = UDim2.new(1, 16, 0, 3)
	end)
	btn.MouseButton1Up:Connect(function()
		Kit.tween(scale, 0.14, { Scale = 1 }, Enum.EasingStyle.Back)
		lip.Size = UDim2.new(1, 16, 0, 7)
	end)
	if onClick then
		btn.Activated:Connect(function()
			if btn:GetAttribute("Enabled") == false then
				sfx("error")
				Kit.shake(btn)
				return
			end
			sfx("click")
			onClick()
		end)
	end
	if props.Parent then
		btn.Parent = props.Parent
	end
	return btn
end

-- 버튼 활성/비활성 모양. 비활성 버튼을 누르면 흔들리며 막힘 소리
function Kit.setEnabled(btn: TextButton, enabled: boolean, color: Color3?)
	btn.Active = true
	btn.AutoButtonColor = false
	local c = if enabled then (color or btn.BackgroundColor3) else Kit.colors.gray
	btn.BackgroundColor3 = c
	btn.TextTransparency = if enabled then 0 else 0.25
	local lip = btn:FindFirstChild("Lip")
	if lip and lip:IsA("Frame") then
		lip.BackgroundColor3 = Kit.darken(c, 0.35)
	end
	btn:SetAttribute("Enabled", enabled)
end

-- 진행 막대. 반환된 함수로 값(0~1)을 바꾸면 부드럽게 채워집니다.
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
	Kit.gradient(fill, Kit.lighten(color, 0.35), color)
	local shine = Kit.new("Frame", {
		BackgroundColor3 = Color3.new(1, 1, 1),
		BackgroundTransparency = 0.7,
		Position = UDim2.fromOffset(4, 2),
		Size = UDim2.new(1, -8, 0.3, 0),
		BorderSizePixel = 0,
		Parent = fill,
	}) :: Frame
	Kit.corner(shine, 4)
	return bar, function(v: number)
		Kit.tween(fill, 0.35, { Size = UDim2.fromScale(math.clamp(v, 0, 1), 1) })
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
		ZIndex = parent.ZIndex + 5,
		Parent = parent,
	}) :: TextLabel
	Kit.corner(b, 12)
	Kit.stroke(b, 2)
	return b
end

return Kit
