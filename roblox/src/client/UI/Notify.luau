--!strict
-- 알림: 작은 토스트(위쪽 가운데)와 큰 배너(희귀 등장·이벤트·대폭주 등).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)

local Client = script.Parent.Parent
local Lang = require(Client.Lang)
local Kit = require(script.Parent.Kit)
local Sound = require(Client.Controllers.Sound)

local Notify = {}

local gui: ScreenGui
local toasts: Frame
local banner: Frame
local bannerLabel: TextLabel
local bannerSub: TextLabel
local bannerToken = 0

local KIND_COLOR: { [string]: Color3 } = {
	info = Kit.colors.purple,
	success = Kit.colors.green,
	error = Kit.colors.red,
	steal = Kit.colors.red,
	announce = Kit.colors.pink,
	event = Kit.colors.blue,
	rare = Kit.colors.yellow,
}

local KIND_SOUND: { [string]: string } = {
	success = "success",
	error = "error",
	steal = "alert",
	announce = "rare",
	event = "event",
	rare = "rare",
}

function Notify.toast(text: string, kind: string?)
	local k = kind or "info"
	local color = KIND_COLOR[k] or Kit.colors.purple
	local frame = Kit.new("Frame", {
		BackgroundColor3 = Kit.colors.bg,
		BackgroundTransparency = 0.05,
		Size = UDim2.new(1, 0, 0, 40),
		Parent = toasts,
	}) :: Frame
	Kit.corner(frame, 12)
	Kit.stroke(frame, 3, color)
	local label = Kit.label({
		Size = UDim2.new(1, -20, 1, -10),
		Position = UDim2.fromOffset(10, 5),
		Text = text,
		TextColor3 = Kit.colors.white,
		Parent = frame,
	})
	label.TextScaled = true
	local children = toasts:GetChildren()
	local count = 0
	for _, c in children do
		if c:IsA("Frame") then
			count += 1
		end
	end
	if count > 4 then
		for _, c in children do
			if c:IsA("Frame") and c ~= frame then
				c:Destroy()
				break
			end
		end
	end
	local sound = KIND_SOUND[k]
	if sound then
		Sound.play(sound)
	end
	task.delay(3.2, function()
		Kit.tween(frame, 0.3, { BackgroundTransparency = 1 })
		Kit.tween(label, 0.3, { TextTransparency = 1 })
		task.wait(0.35)
		frame:Destroy()
	end)
end

function Notify.banner(text: string, sub: string?, color: Color3?, seconds: number?)
	bannerToken += 1
	local token = bannerToken
	bannerLabel.Text = text
	bannerSub.Text = sub or ""
	banner.BackgroundColor3 = color or Kit.colors.pink
	banner.Visible = true
	banner.Position = UDim2.new(0.5, 0, 0, -120)
	Kit.tween(banner, 0.35, { Position = UDim2.new(0.5, 0, 0, 96) }, Enum.EasingStyle.Back)
	task.delay(seconds or 4, function()
		if bannerToken == token then
			Kit.tween(banner, 0.3, { Position = UDim2.new(0.5, 0, 0, -120) })
			task.wait(0.32)
			if bannerToken == token then
				banner.Visible = false
			end
		end
	end)
end

-- 서버 알림 처리
local function onServer(msg: { kind: string, key: string, args: { [string]: any }? })
	local text = Lang.t(msg.key, msg.args)
	local kind = msg.kind
	if kind == "announce" or kind == "rare" or kind == "event" then
		local sub: string? = nil
		if msg.key == "weatherStart" and msg.args and type(msg.args.weather) == "string" then
			sub = Lang.t("weatherDesc_" .. msg.args.weather)
		end
		Notify.banner(text, sub, KIND_COLOR[kind], if kind == "rare" then 3.5 else 4.5)
		local sound = KIND_SOUND[kind]
		if sound then
			Sound.play(sound)
		end
	else
		Notify.toast(text, kind)
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
		Position = UDim2.new(0.5, 0, 0, 170),
		Size = UDim2.new(0.8, 0, 0, 220),
		BackgroundTransparency = 1,
		Parent = gui,
	}) :: Frame
	local sc = Instance.new("UISizeConstraint")
	sc.MaxSize = Vector2.new(460, 260)
	sc.Parent = toasts
	Kit.list(toasts, true, 6, Enum.HorizontalAlignment.Center)

	banner = Kit.new("Frame", {
		Name = "Banner",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, -120),
		Size = UDim2.new(0.9, 0, 0, 74),
		BackgroundColor3 = Kit.colors.pink,
		Visible = false,
		Parent = gui,
	}) :: Frame
	local bsc = Instance.new("UISizeConstraint")
	bsc.MaxSize = Vector2.new(620, 90)
	bsc.Parent = banner
	Kit.corner(banner, 18)
	Kit.stroke(banner, 4)
	Kit.gradient(banner, Color3.new(1, 1, 1), Color3.fromRGB(170, 170, 170))
	bannerLabel = Kit.label({
		Size = UDim2.new(1, -20, 0.62, 0),
		Position = UDim2.fromOffset(10, 4),
		Text = "",
		Parent = banner,
	})
	bannerSub = Kit.label({
		Size = UDim2.new(1, -20, 0.3, 0),
		Position = UDim2.new(0, 10, 0.64, 0),
		Text = "",
		TextColor3 = Color3.fromRGB(255, 250, 220),
		Parent = banner,
	})

	Net.event("Notify").OnClientEvent:Connect(onServer)
end

return Notify
