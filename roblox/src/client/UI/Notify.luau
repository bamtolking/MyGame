--!strict
-- 알림: 작은 토스트(위쪽 가운데, 아이콘·색 막대·남은 시간 막대)와
-- 큰 배너(희귀 등장·이벤트·대폭주 등, 빛 줄기가 지나감).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local Kit = require(script.Parent.Kit)
local Sound = require(Client.Controllers.Sound)

local Notify = {}

-- 도난 경보 같은 화면 연출을 Fx가 연결
Notify.onAlarm = nil :: (() -> ())?

local gui: ScreenGui
local toasts: Frame
local banner: Frame
local bannerIcon: TextLabel
local bannerLabel: TextLabel
local bannerSub: TextLabel
local bannerToken = 0
local toastOrder = 0

local KIND_COLOR: { [string]: Color3 } = {
	info = Kit.colors.purple,
	success = Kit.colors.green,
	error = Kit.colors.red,
	steal = Kit.colors.red,
	announce = Kit.colors.pink,
	event = Kit.colors.blue,
	rare = Kit.colors.yellow,
}

local KIND_ICON: { [string]: string } = {
	info = "💬",
	success = "✅",
	error = "⛔",
	steal = "🚨",
	announce = "📣",
	event = "🌦️",
	rare = "✨",
}

local KIND_SOUND: { [string]: string } = {
	success = "success",
	error = "error",
	steal = "alarm",
	announce = "rare",
	event = "event",
	rare = "rare",
}

local TOAST_SECONDS = 3.4

function Notify.toast(text: string, kind: string?)
	local k = kind or "info"
	local color = KIND_COLOR[k] or Kit.colors.purple
	toastOrder -= 1
	local holder = Kit.new("Frame", {
		Name = "Toast",
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 46),
		LayoutOrder = toastOrder,
		Parent = toasts,
	}) :: Frame
	local frame = Kit.new("Frame", {
		BackgroundColor3 = Kit.colors.bg,
		Size = UDim2.fromScale(1, 1),
		Position = UDim2.fromOffset(0, -18),
		BackgroundTransparency = 1,
		Parent = holder,
	}) :: Frame
	Kit.corner(frame, 14)
	local stroke = Kit.stroke(frame, 3, color)
	stroke.Transparency = 1
	local accent = Kit.new("Frame", {
		BackgroundColor3 = color,
		Size = UDim2.new(0, 42, 1, 0),
		BorderSizePixel = 0,
		Parent = frame,
	}) :: Frame
	Kit.corner(accent, 14)
	local icon = Kit.label({
		Size = UDim2.new(0, 42, 1, -8),
		Position = UDim2.fromOffset(0, 4),
		Text = KIND_ICON[k] or "💬",
		stroke = false,
		Parent = frame,
	})
	local label = Kit.label({
		Size = UDim2.new(1, -60, 1, -12),
		Position = UDim2.fromOffset(52, 5),
		Text = text,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextTransparency = 1,
		Parent = frame,
	})
	local timer = Kit.new("Frame", {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 46, 1, -3),
		Size = UDim2.new(1, -54, 0, 3),
		BackgroundColor3 = color,
		BorderSizePixel = 0,
		Parent = frame,
	}) :: Frame
	Kit.corner(timer, 2)

	-- 등장
	Kit.tween(frame, 0.25, { Position = UDim2.new(), BackgroundTransparency = 0.04 }, Enum.EasingStyle.Back)
	Kit.tween(stroke, 0.2, { Transparency = 0 })
	Kit.tween(label, 0.2, { TextTransparency = 0 })
	Kit.pop(icon, 0.8)
	Kit.tween(timer, TOAST_SECONDS, { Size = UDim2.new(0, 0, 0, 3) }, Enum.EasingStyle.Linear)

	-- 너무 많으면 가장 오래된 것부터 제거
	local list = {}
	for _, c in toasts:GetChildren() do
		if c:IsA("Frame") then
			table.insert(list, c)
		end
	end
	table.sort(list, function(a, b)
		return a.LayoutOrder > b.LayoutOrder
	end)
	for i = 5, #list do
		list[i]:Destroy()
	end

	local sound = KIND_SOUND[k]
	if sound then
		Sound.play(sound)
	end
	task.delay(TOAST_SECONDS, function()
		if not holder.Parent then
			return
		end
		Kit.tween(frame, 0.3, { Position = UDim2.fromOffset(40, 0), BackgroundTransparency = 1 })
		Kit.tween(stroke, 0.25, { Transparency = 1 })
		Kit.tween(label, 0.25, { TextTransparency = 1 })
		Kit.tween(icon, 0.25, { TextTransparency = 1 })
		Kit.tween(accent, 0.25, { BackgroundTransparency = 1 })
		task.wait(0.32)
		holder:Destroy()
	end)
end

function Notify.banner(text: string, sub: string?, color: Color3?, seconds: number?, icon: string?)
	bannerToken += 1
	local token = bannerToken
	bannerLabel.Text = text
	bannerSub.Text = sub or ""
	bannerIcon.Text = icon or "✨"
	local c = color or Kit.colors.pink
	banner.BackgroundColor3 = c
	local lip = banner:FindFirstChild("Lip")
	if lip and lip:IsA("Frame") then
		lip.BackgroundColor3 = Kit.darken(c, 0.4)
	end
	banner.Visible = true
	banner.Position = UDim2.new(0.5, 0, 0, -130)
	Kit.tween(banner, 0.45, { Position = UDim2.new(0.5, 0, 0, 100) }, Enum.EasingStyle.Back)
	Kit.pop(bannerIcon, 1.2)
	task.delay(seconds or 4, function()
		if bannerToken == token then
			Kit.tween(banner, 0.3, { Position = UDim2.new(0.5, 0, 0, -130) }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			task.wait(0.32)
			if bannerToken == token then
				banner.Visible = false
			end
		end
	end)
end

local BANNER_ICON: { [string]: string } = {
	frenzyStart = "⚡",
	weatherStart = "🌦️",
	rareSpawn = "✨",
	serverLuck = "🍀",
	stormBought = "🌈",
	rebirthAnnounce = "♻️",
	stealAnnounce = "🥷",
}

-- 서버 알림 처리
local function onServer(msg: { kind: string, key: string, args: { [string]: any }? })
	local text = Lang.t(msg.key, msg.args)
	local kind = msg.kind
	if kind == "announce" or kind == "rare" or kind == "event" then
		local sub: string? = nil
		if msg.key == "weatherStart" and msg.args and type(msg.args.weather) == "string" then
			sub = Lang.t("weatherDesc_" .. msg.args.weather)
		end
		Notify.banner(text, sub, KIND_COLOR[kind], if kind == "rare" then 3.5 else 4.5, BANNER_ICON[msg.key])
		local sound = if msg.key == "frenzyStart" then "frenzy" else KIND_SOUND[kind]
		if sound then
			Sound.play(sound)
		end
	else
		Notify.toast(text, kind)
		if kind == "steal" and Notify.onAlarm then
			Notify.onAlarm()
		end
	end
end

-- 액션 실패 메시지(서버 msg 키)를 보여줌
function Notify.result(result: { [string]: any })
	if not result.ok and type(result.msg) == "string" and result.msg ~= "tooFast" then
		Notify.toast(Lang.t(result.msg), "error")
	end
end

function Notify.init()
	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	gui = Kit.new("ScreenGui", {
		Name = "Notify",
		ResetOnSpawn = false,
		DisplayOrder = 50,
		IgnoreGuiInset = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		Parent = playerGui,
	}) :: ScreenGui

	toasts = Kit.new("Frame", {
		Name = "Toasts",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 178),
		Size = UDim2.new(0.8, 0, 0, 250),
		BackgroundTransparency = 1,
		Parent = gui,
	}) :: Frame
	local sc = Instance.new("UISizeConstraint")
	sc.MaxSize = Vector2.new(480, 270)
	sc.Parent = toasts
	local layout = Kit.list(toasts, true, 6, Enum.HorizontalAlignment.Center)
	layout.VerticalAlignment = Enum.VerticalAlignment.Top

	banner = Kit.new("Frame", {
		Name = "Banner",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, -130),
		Size = UDim2.new(0.9, 0, 0, 82),
		BackgroundColor3 = Kit.colors.pink,
		Visible = false,
		Parent = gui,
	}) :: Frame
	local bsc = Instance.new("UISizeConstraint")
	bsc.MaxSize = Vector2.new(660, 96)
	bsc.Parent = banner
	Kit.corner(banner, 20)
	Kit.stroke(banner, 4)
	Kit.gradient(banner, Color3.new(1, 1, 1), Color3.fromRGB(175, 175, 175))
	local lip = Kit.new("Frame", {
		Name = "Lip",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, 0),
		Size = UDim2.new(1, 0, 0, 8),
		BackgroundColor3 = Kit.darken(Kit.colors.pink, 0.4),
		BorderSizePixel = 0,
		Parent = banner,
	}) :: Frame
	Kit.corner(lip, 20)
	Kit.sweep(banner, 20)
	bannerIcon = Kit.label({
		Size = UDim2.new(0, 64, 1, -16),
		Position = UDim2.fromOffset(10, 6),
		Text = "✨",
		stroke = false,
		Parent = banner,
	})
	bannerLabel = Kit.label({
		Size = UDim2.new(1, -96, 0.58, 0),
		Position = UDim2.fromOffset(80, 6),
		Text = "",
		stroke = 3,
		Parent = banner,
	})
	bannerSub = Kit.label({
		Size = UDim2.new(1, -96, 0.28, 0),
		Position = UDim2.new(0, 80, 0.62, 0),
		Text = "",
		TextColor3 = Color3.fromRGB(255, 250, 220),
		Parent = banner,
	})

	Net.event("Notify").OnClientEvent:Connect(onServer)
end

return Notify
