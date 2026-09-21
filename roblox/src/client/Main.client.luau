--!nonstrict
-- 클라이언트 진입점: HUD·패널·라벨·효과음을 만들고 서버 알림을 받습니다.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterGui = game:GetService("StarterGui")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local Hud = require(script.Parent:WaitForChild("Hud"))
local Panels = require(script.Parent:WaitForChild("Panels"))
local Labels = require(script.Parent:WaitForChild("Labels"))
local Sfx = require(script.Parent:WaitForChild("Sfx"))

local Shared = ReplicatedStorage:WaitForChild("GhostDiner")
local Recipes = require(Shared:WaitForChild("Recipes"))
local remotes = ReplicatedStorage:WaitForChild("GhostDinerRemotes")
local notify = remotes:WaitForChild("Notify") :: RemoteEvent
local buyRemote = remotes:WaitForChild("Buy") :: RemoteFunction
local state = ReplicatedStorage:WaitForChild("GhostDinerState")
local map = workspace:WaitForChild("GhostDinerMap")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- 한 손에 한 가지만: 가방 UI 숨김
task.spawn(function()
	for _ = 1, 20 do
		local ok = pcall(function()
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
		end)
		if ok then
			break
		end
		task.wait(0.5)
	end
end)

local hud = Hud.create(playerGui)
local panels = Panels.create(hud.gui, state, buyRemote, hud.toast)

-- 손에 든 것 추적
local heldId: string? = nil
local function heldGetter(): string?
	return heldId
end
local function watchCharacter(character: Model)
	local function refresh()
		local tool = character:FindFirstChildOfClass("Tool")
		heldId = if tool then tool:GetAttribute("ItemId") else nil
		hud.setHeld(if heldId then Recipes.name(heldId) else nil)
		Labels.refreshPrompts()
	end
	character.ChildAdded:Connect(function(c)
		if c:IsA("Tool") then
			refresh()
		end
	end)
	character.ChildRemoved:Connect(function(c)
		if c:IsA("Tool") then
			task.defer(refresh)
		end
	end)
	refresh()
end
if player.Character then
	watchCharacter(player.Character)
end
player.CharacterAdded:Connect(watchCharacter)

Labels.init(map, heldGetter)

-- 상태 갱신
local function refreshAll()
	hud.update(state)
	panels.refreshShop()
end
state.AttributeChanged:Connect(refreshAll)
refreshAll()
local acc = 0
RunService.Heartbeat:Connect(function(dt)
	acc += dt
	if acc >= 0.25 then
		acc = 0
		hud.update(state)
	end
end)

-- 버튼·단축키
hud.recipeButton.MouseButton1Click:Connect(function()
	Sfx.play("ui")
	panels.toggleRecipes()
end)
hud.shopButton.MouseButton1Click:Connect(function()
	Sfx.play("ui")
	panels.toggleShop()
end)
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then
		return
	end
	if input.KeyCode == Enum.KeyCode.R then
		Sfx.play("ui")
		panels.toggleRecipes()
	elseif input.KeyCode == Enum.KeyCode.B then
		Sfx.play("ui")
		panels.toggleShop()
	end
end)

-- 서버 알림
notify.OnClientEvent:Connect(function(payload)
	if type(payload) ~= "table" then
		return
	end
	local kind = payload.kind
	if kind == "toast" then
		hud.toast(payload.text, payload.style)
	elseif kind == "sound" then
		Sfx.play(payload.name)
	elseif kind == "coin" then
		Labels.coinPopup(payload.position, payload.amount, payload.tip or 0)
	elseif kind == "night" then
		hud.hideResult()
		panels.closeAll()
		local sub = string.format("손님 %d명이 옵니다", payload.total or 0)
		if payload.newDishes and #payload.newDishes > 0 then
			local list = {}
			for _, id in payload.newDishes do
				table.insert(list, Recipes.name(id))
			end
			sub ..= "  ·  새 메뉴: " .. table.concat(list, ", ")
			hud.toast("📖 새 메뉴 해금: " .. table.concat(list, ", ") .. " — R키로 레시피 확인", "good")
		end
		if payload.boss then
			sub ..= "  ·  👑 산신령이 옵니다!"
		end
		hud.announce(string.format("🌙 %d번째 밤", payload.night or 0), sub, Color3.fromRGB(200, 170, 255))
		panels.rebuildRecipes()
	elseif kind == "day" then
		hud.announce("☀️ 낮이 되었습니다", "상점에서 업그레이드하고 재료를 미리 준비하세요", Color3.fromRGB(255, 230, 150))
		panels.openShop()
	elseif kind == "result" then
		panels.closeAll()
		hud.showResult(payload)
	end
end)

-- 폐업 화면은 새 영업이 시작되면 닫힘
state:GetAttributeChangedSignal("Phase"):Connect(function()
	local phase = state:GetAttribute("Phase")
	if phase ~= "gameover" then
		hud.hideResult()
	end
	if phase == "countdown" then
		hud.announce("🏮 개장 준비", "재료를 미리 꺼내 두면 첫 손님을 빨리 받을 수 있어요", Color3.fromRGB(255, 230, 150))
	end
end)

-- 도움말 순환
local HINTS = {
	"E: 조리대 사용 · 손에는 한 가지만 들 수 있어요",
	"익힌 음식을 오래 두면 타요! 완성되면 바로 꺼내세요",
	"인내심이 많이 남았을 때 서빙하면 팁을 더 받아요",
	"역할을 나누세요: 재료 담당 · 조리 담당 · 서빙 담당",
	"화난 손님은 조리대를 부숩니다 — 잠시 못 써요",
	"낮에는 상점(B)에서 팀 업그레이드 · 급하면 밤에도 살 수 있어요",
	"조리대(합치기)에 재료를 올리면 레시피가 맞을 때 자동으로 합쳐져요",
	"잘못된 요리를 내밀면 손님 인내심이 줄어요 — 주문을 확인하세요",
	"손님 머리 위의 초록 바가 인내심이에요. 빨개지면 서둘러요!",
	"밥솥의 밥은 타지 않아요. 미리 지어 두세요",
}
task.spawn(function()
	local i = 1
	while true do
		hud.setHint("💡 " .. HINTS[i])
		i = (i % #HINTS) + 1
		task.wait(9)
	end
end)
