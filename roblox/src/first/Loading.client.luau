--!strict
-- 로딩 화면(ReplicatedFirst에서 가장 먼저 실행).
-- 기본 로딩 화면을 지우고, 통통 튀는 슬라임 + 제목 + 진행 막대 + 팁을 보여 줍니다.
-- 클라이언트 준비가 끝나면(플레이어 속성 ClientReady) 부드럽게 사라집니다.

local Players = game:GetService("Players")
local ReplicatedFirst = game:GetService("ReplicatedFirst")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

ReplicatedFirst:RemoveDefaultLoadingScreen()

local player = Players.LocalPlayer
local korean = string.sub(string.lower(player.LocaleId or ""), 1, 2) == "ko"

local TIPS = if korean
	then {
		"💡 같은 슬라임 3마리를 합치면 ★ 슬라임이 돼요!",
		"💡 도둑은 F(🔨)로 때리면 슬라임을 떨어뜨려요.",
		"💡 매시 정각엔 슬라임 대폭주! 행운 ×5!",
		"💡 날씨가 바뀌면 슬라임이 황금·무지개로 변해요.",
		"💡 ⭐ 즐겨찾기 슬라임은 도둑맞지 않아요.",
	}
	else {
		"💡 Merge 3 same slimes into a ★ slime!",
		"💡 BONK thieves with F (🔨) to make them drop slimes.",
		"💡 Every hour: SLIME FRENZY with x5 luck!",
		"💡 Weather can turn slimes Gold or Rainbow.",
		"💡 Your ⭐ favorite slime can't be stolen.",
	}

local function tween(inst: Instance, t: number, props: { [string]: any }, style: Enum.EasingStyle?)
	TweenService:Create(inst, TweenInfo.new(t, style or Enum.EasingStyle.Quad, Enum.EasingDirection.Out), props):Play()
end

local function corner(parent: Instance, scale: number?, px: number?)
	local c = Instance.new("UICorner")
	c.CornerRadius = if scale then UDim.new(scale, 0) else UDim.new(0, px or 12)
	c.Parent = parent
end

local function stroke(parent: Instance, thickness: number, color: Color3, contextual: boolean?)
	local s = Instance.new("UIStroke")
	s.Thickness = thickness
	s.Color = color
	s.ApplyStrokeMode = if contextual then Enum.ApplyStrokeMode.Contextual else Enum.ApplyStrokeMode.Border
	s.Parent = parent
end

local gui = Instance.new("ScreenGui")
gui.Name = "LoadingScreen"
gui.IgnoreGuiInset = true
gui.ResetOnSpawn = false
gui.DisplayOrder = 1000

local group = Instance.new("CanvasGroup")
group.Size = UDim2.fromScale(1, 1)
group.BackgroundColor3 = Color3.fromRGB(60, 30, 120)
group.Parent = gui
local bg = Instance.new("UIGradient")
bg.Color = ColorSequence.new(Color3.fromRGB(120, 70, 255), Color3.fromRGB(255, 90, 170))
bg.Rotation = 35
bg.Parent = group

-- 떠다니는 방울
local bubbles = {}
for i = 1, 14 do
	local b = Instance.new("Frame")
	local size = math.random(20, 70)
	b.Size = UDim2.fromOffset(size, size)
	b.Position = UDim2.fromScale(math.random(), math.random())
	b.BackgroundColor3 = Color3.new(1, 1, 1)
	b.BackgroundTransparency = 0.85
	b.Parent = group
	corner(b, 0.5)
	bubbles[i] = { frame = b, speed = 0.02 + math.random() * 0.05, x = math.random() }
end

local title = Instance.new("TextLabel")
title.AnchorPoint = Vector2.new(0.5, 0.5)
title.Position = UDim2.fromScale(0.5, 0.3)
title.Size = UDim2.new(0.8, 0, 0.14, 0)
title.BackgroundTransparency = 1
title.Font = Enum.Font.FredokaOne
title.TextScaled = true
title.Text = if korean then "슬라임 하이스트!" else "SLIME HEIST!"
title.TextColor3 = Color3.fromRGB(255, 230, 90)
title.Parent = group
stroke(title, 6, Color3.fromRGB(70, 20, 110), true)
local titleSize = Instance.new("UISizeConstraint")
titleSize.MaxSize = Vector2.new(760, 120)
titleSize.Parent = title

-- 슬라임(프레임으로 그림)
local slime = Instance.new("Frame")
slime.AnchorPoint = Vector2.new(0.5, 1)
slime.Position = UDim2.fromScale(0.5, 0.64)
slime.Size = UDim2.fromOffset(140, 104)
slime.BackgroundColor3 = Color3.fromRGB(130, 222, 120)
slime.Parent = group
corner(slime, 0.5)
stroke(slime, 5, Color3.fromRGB(40, 90, 50))
local shine = Instance.new("Frame")
shine.Size = UDim2.fromOffset(34, 18)
shine.Position = UDim2.fromOffset(28, 16)
shine.BackgroundColor3 = Color3.new(1, 1, 1)
shine.BackgroundTransparency = 0.35
shine.Rotation = -20
shine.Parent = slime
corner(shine, 0.5)
for _, x in { 0.36, 0.64 } do
	local eye = Instance.new("Frame")
	eye.AnchorPoint = Vector2.new(0.5, 0.5)
	eye.Position = UDim2.fromScale(x, 0.5)
	eye.Size = UDim2.fromOffset(18, 26)
	eye.BackgroundColor3 = Color3.fromRGB(25, 22, 30)
	eye.Parent = slime
	corner(eye, 0.5)
	local glint = Instance.new("Frame")
	glint.Size = UDim2.fromOffset(7, 7)
	glint.Position = UDim2.fromOffset(3, 4)
	glint.BackgroundColor3 = Color3.new(1, 1, 1)
	glint.Parent = eye
	corner(glint, 0.5)
end
local shadow = Instance.new("Frame")
shadow.AnchorPoint = Vector2.new(0.5, 0.5)
shadow.Position = UDim2.fromScale(0.5, 0.645)
shadow.Size = UDim2.fromOffset(130, 18)
shadow.BackgroundColor3 = Color3.new(0, 0, 0)
shadow.BackgroundTransparency = 0.7
shadow.ZIndex = 0
shadow.Parent = group
corner(shadow, 0.5)

-- 진행 막대
local barBg = Instance.new("Frame")
barBg.AnchorPoint = Vector2.new(0.5, 0.5)
barBg.Position = UDim2.fromScale(0.5, 0.76)
barBg.Size = UDim2.new(0.5, 0, 0, 22)
barBg.BackgroundColor3 = Color3.fromRGB(30, 15, 60)
barBg.Parent = group
corner(barBg, 0.5)
stroke(barBg, 3, Color3.fromRGB(255, 255, 255))
local barSize = Instance.new("UISizeConstraint")
barSize.MaxSize = Vector2.new(460, 22)
barSize.Parent = barBg
local fill = Instance.new("Frame")
fill.Size = UDim2.fromScale(0, 1)
fill.BackgroundColor3 = Color3.fromRGB(120, 255, 140)
fill.Parent = barBg
corner(fill, 0.5)

local tip = Instance.new("TextLabel")
tip.AnchorPoint = Vector2.new(0.5, 0.5)
tip.Position = UDim2.fromScale(0.5, 0.85)
tip.Size = UDim2.new(0.8, 0, 0, 30)
tip.BackgroundTransparency = 1
tip.Font = Enum.Font.GothamBold
tip.TextScaled = true
tip.TextColor3 = Color3.new(1, 1, 1)
tip.Text = TIPS[math.random(1, #TIPS)]
tip.Parent = group
local tipSize = Instance.new("UISizeConstraint")
tipSize.MaxSize = Vector2.new(700, 30)
tipSize.Parent = tip

gui.Parent = player:WaitForChild("PlayerGui")

local started = os.clock()
local progress = 0
local conn = RunService.RenderStepped:Connect(function(dt)
	local t = os.clock() - started
	-- 통통: 높이는 |sin|, 착지 순간 납작해짐
	local phase = (t * 1.6) % 1
	local h = math.sin(phase * math.pi)
	local squash = if phase < 0.12 or phase > 0.88 then 0.82 else 1 + h * 0.08
	slime.Size = UDim2.fromOffset(140 / squash ^ 0.5, 104 * squash)
	slime.Position = UDim2.new(0.5, 0, 0.64, -h * 70)
	shadow.Size = UDim2.fromOffset(130 * (1 - h * 0.4), 18 * (1 - h * 0.3))
	title.Rotation = math.sin(t * 2) * 2
	for _, b in bubbles do
		local y = (b.frame.Position.Y.Scale - b.speed * dt)
		if y < -0.1 then
			y = 1.1
		end
		b.frame.Position = UDim2.fromScale(b.x + math.sin(t + b.speed * 50) * 0.01, y)
	end
	-- 준비될 때까지 90%까지 천천히
	progress += (0.9 - progress) * dt * 0.8
	fill.Size = UDim2.fromScale(progress, 1)
end)

task.spawn(function()
	while true do
		task.wait(3.5)
		if not gui.Parent then
			break
		end
		tip.Text = TIPS[math.random(1, #TIPS)]
	end
end)

-- 준비 완료 대기(최소 1.5초, 최대 25초)
while os.clock() - started < 25 do
	if player:GetAttribute("ClientReady") == true and os.clock() - started > 1.5 then
		break
	end
	task.wait(0.1)
end

conn:Disconnect()
tween(fill, 0.25, { Size = UDim2.fromScale(1, 1) })
task.wait(0.3)
tween(slime, 0.35, { Size = UDim2.fromOffset(200, 150) }, Enum.EasingStyle.Back)
tween(group, 0.6, { GroupTransparency = 1 })
task.wait(0.65)
gui:Destroy()
