--!nonstrict
-- 클라이언트 진입점: HUD·패널·라벨·연출·튜토리얼·효과음을 만들고 서버 알림을 받습니다.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterGui = game:GetService("StarterGui")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Hud = require(script.Parent:WaitForChild("Hud"))
local Panels = require(script.Parent:WaitForChild("Panels"))
local Labels = require(script.Parent:WaitForChild("Labels"))
local Sfx = require(script.Parent:WaitForChild("Sfx"))
local Fx = require(script.Parent:WaitForChild("Fx"))
local Tutorial = require(script.Parent:WaitForChild("Tutorial"))

local Shared = ReplicatedStorage:WaitForChild("GhostDiner")
local Recipes = require(Shared:WaitForChild("Recipes"))
local Config = require(Shared:WaitForChild("Config"))
local Talismans = require(Shared:WaitForChild("Talismans"))
local remotes = ReplicatedStorage:WaitForChild("GhostDinerRemotes")
local notify = remotes:WaitForChild("Notify") :: RemoteEvent
local buyRemote = remotes:WaitForChild("Buy") :: RemoteFunction
local setHatRemote = remotes:WaitForChild("SetHat") :: RemoteFunction
local readyRemote = remotes:WaitForChild("Ready") :: RemoteEvent
local useTalismanRemote = remotes:WaitForChild("UseTalisman") :: RemoteEvent
local relicVoteRemote = remotes:WaitForChild("RelicVote") :: RemoteEvent
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
Fx.init(playerGui)
local panels = Panels.create(hud.gui, state, { buy = buyRemote, setHat = setHatRemote }, player, hud.toast)

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

Labels.init(map, heldGetter, Fx, hud.updateOrders)
local tutorial = Tutorial.create(hud.gui, state, map, heldGetter, Sfx.play)

-- 상태 갱신
local function refreshAll()
	hud.update(state)
	panels.refreshShop()
end
state.AttributeChanged:Connect(refreshAll)
refreshAll()
local acc, tutorialAcc = 0, 0
RunService.Heartbeat:Connect(function(dt)
	acc += dt
	tutorialAcc += dt
	if acc >= 0.2 then
		acc = 0
		hud.update(state)
		-- 평판이 낮으면 화면 가장자리가 붉게 맥동
		local hp = state:GetAttribute("Hp")
		local maxHp = state:GetAttribute("MaxHp")
		if type(hp) == "number" and type(maxHp) == "number" and maxHp > 0 and hp / maxHp < 0.3 and state:GetAttribute("Phase") == "night" then
			local danger = 1 - (hp / maxHp) / 0.3
			Fx.setVignette(0.25 + 0.25 * danger + 0.15 * math.sin(os.clock() * 4))
		else
			Fx.setVignette(0)
		end
	end
	if tutorialAcc >= 0.1 then
		tutorialAcc = 0
		tutorial.update()
	end
end)

-- 버튼·단축키
hud.onReady = function()
	Sfx.play("ready")
	readyRemote:FireServer()
end
hud.onTalisman = function(id)
	Sfx.play("ui")
	useTalismanRemote:FireServer(id)
end
hud.onRelicVote = function(index)
	Sfx.play("ui")
	relicVoteRemote:FireServer(index)
end
local function talismanReady(): boolean
	local v = state:GetAttribute("Talisman")
	local max = state:GetAttribute("TalismanMax")
	return type(v) == "number" and type(max) == "number" and v >= max and state:GetAttribute("Phase") == "night"
end
hud.recipeButton.MouseButton1Click:Connect(function()
	Sfx.play("ui")
	panels.toggleRecipes()
end)
hud.shopButton.MouseButton1Click:Connect(function()
	Sfx.play("ui")
	panels.toggleShop()
end)
hud.wardrobeButton.MouseButton1Click:Connect(function()
	Sfx.play("ui")
	panels.toggleWardrobe()
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
	elseif input.KeyCode == Enum.KeyCode.C then
		Sfx.play("ui")
		panels.toggleWardrobe()
	elseif input.KeyCode == Enum.KeyCode.One or input.KeyCode == Enum.KeyCode.Two or input.KeyCode == Enum.KeyCode.Three then
		local idx = if input.KeyCode == Enum.KeyCode.One then 1 elseif input.KeyCode == Enum.KeyCode.Two then 2 else 3
		local t = Talismans.List[idx]
		if t and talismanReady() then
			hud.onTalisman(t.id)
		end
	end
end)

local TALISMAN_COLORS = { time = Fx.Colors.blue, calm = Fx.Colors.white, fortune = Fx.Colors.gold }

local KITCHEN_CENTER = Vector3.new(0, 12, -22)

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
	elseif kind == "serve" then
		local to = payload.to
		Fx.serveFly(payload.from, to, payload.itemId, function()
			Fx.sparkle(to, "gold")
			local amount = payload.amount or 0
			local text = if (payload.tip or 0) > 0 then string.format("+%d 🪙 (팁 %d)", amount, payload.tip) else string.format("+%d 🪙", amount)
			Fx.floatText(to + Vector3.new(0, 1.5, 0), text, Fx.Colors.gold, 26)
		end)
	elseif kind == "combo" then
		local count = payload.count or 2
		Sfx.play("combo", math.min(2.2, 1 + 0.08 * count))
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root and root:IsA("BasePart") then
			Fx.floatText(root.Position + Vector3.new(0, 4, 0), string.format("🔥 콤보 x%d", count), Fx.Colors.orange, 30)
		end
	elseif kind == "sparkle" then
		Fx.sparkle(payload.position, payload.color)
	elseif kind == "fire" then
		Sfx.play("fire")
		Fx.shakeAt(payload.position, 0.5, 0.4)
		Fx.flash(Fx.Colors.orange, 0.25, 0.5)
		Fx.burst(payload.position + Vector3.new(0, 3, 0), Fx.Colors.orange, 30, 0.8, 8)
	elseif kind == "smash" then
		Fx.shakeAt(payload.position, 0.9, 0.5)
		Fx.burst(payload.position + Vector3.new(0, 2, 0), Fx.Colors.purple, 24, 0.7, 7)
	elseif kind == "angry" then
		Fx.flash(Fx.Colors.red, 0.3, 0.5)
		Fx.shakeAt(payload.position, 0.5, 0.4)
	elseif kind == "boss" then
		Sfx.play("boss")
		Fx.lightning()
		hud.announce("👑 " .. tostring(payload.name or "산신령") .. " 등장!", "요리 3개를 주문합니다. 실망시키면 크게 후회합니다", Color3.fromRGB(255, 220, 120))
	elseif kind == "blackout" then
		Sfx.play("blackout")
		Fx.setBlackout(payload.on == true)
		if payload.on then
			hud.announce("🕯️ 정전!", "불이 다시 들어올 때까지 감으로 요리하세요", Color3.fromRGB(200, 200, 255))
		end
	elseif kind == "night" then
		hud.hideResult()
		hud.hideSummary()
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
		if payload.event then
			task.delay(3.6, function()
				hud.announce(payload.event.emoji .. " " .. payload.event.name, payload.event.desc, Color3.fromRGB(255, 200, 120))
				Sfx.play("night")
			end)
		end
		if payload.challenge then
			hud.toast(string.format("🎯 밤 목표: %s — %s (+%d 코인)", payload.challenge.name, payload.challenge.desc, payload.challenge.reward), "info")
		end
		panels.rebuildRecipes()
		if (payload.night or 0) == 1 and tutorial.shouldShow(player) then
			tutorial.start()
		end
	elseif kind == "clear" then
		Fx.confetti(KITCHEN_CENTER)
		Fx.flash(Fx.Colors.gold, 0.2, 0.8)
		hud.showSummary(payload)
	elseif kind == "day" then
		hud.announce("☀️ 낮이 되었습니다", "상점에서 업그레이드하고 재료를 미리 준비하세요 · 모두 준비되면 바로 시작", Color3.fromRGB(255, 230, 150))
		task.delay(1.5, function()
			if state:GetAttribute("Phase") == "day" then
				panels.openShop()
			end
		end)
	elseif kind == "result" then
		panels.closeAll()
		hud.hideSummary()
		Fx.flash(Fx.Colors.red, 0.5, 1.5)
		Fx.shake(1.2, 0.8)
		hud.showResult(payload)
	elseif kind == "talisman" then
		Sfx.play("talisman")
		Fx.talismanRing(TALISMAN_COLORS[payload.id] or Fx.Colors.gold)
		hud.announce(string.format("%s %s!", payload.emoji or "🧧", payload.name or "부적"), string.format("%s · %s", payload.user or "", payload.detail or ""), Color3.fromRGB(255, 200, 240))
	elseif kind == "relicResult" then
		hud.announce("🔮 유물 획득: " .. tostring(payload.emoji or "") .. " " .. tostring(payload.name or ""), tostring(payload.desc or ""), Color3.fromRGB(220, 170, 255))
		Fx.confetti(KITCHEN_CENTER)
	elseif kind == "pound" then
		local stationsFolder = map:FindFirstChild("Stations")
		local part = stationsFolder and stationsFolder:FindFirstChild(tostring(payload.stationId or ""))
		if part then
			Fx.swingMallet(part:FindFirstChild("Mallet"))
		end
		Sfx.play("pound", 0.85 + 0.05 * (payload.hits or 1))
		Fx.burst(payload.position, Fx.Colors.white, 12, 0.4, 5)
		Fx.floatText(payload.position + Vector3.new(0, 1, 0), string.format("쿵! %d/%d", payload.hits or 0, payload.total or 0), Fx.Colors.gold, 22)
		Fx.shakeAt(payload.position, 0.25, 0.2)
	elseif kind == "ascend" then
		Sfx.play("ascend")
		Fx.burst(payload.position + Vector3.new(0, 2, 0), Fx.Colors.gold, 24, 0.5, 4)
	end
end)

-- 폐업 화면은 새 영업이 시작되면 닫힘
state:GetAttributeChangedSignal("Phase"):Connect(function()
	local phase = state:GetAttribute("Phase")
	if phase ~= "gameover" then
		hud.hideResult()
	end
	if phase == "countdown" then
		hud.announce("🏮 개장 준비", "재료를 미리 꺼내 두면 첫 손님을 빨리 받을 수 있어요 · 준비되면 ✅ 버튼", Color3.fromRGB(255, 230, 150))
	end
end)

-- 평판이 깎이면 화면이 붉게 번쩍
local lastHp = nil
state:GetAttributeChangedSignal("Hp"):Connect(function()
	local hp = state:GetAttribute("Hp")
	if type(hp) == "number" and lastHp ~= nil and hp < lastHp then
		Fx.flash(Fx.Colors.red, 0.3, 0.5)
	end
	lastHp = hp
end)

-- 장식 애니메이션 (클라이언트에서만): 룬 맥동, 저승 문 빛 맥동
task.spawn(function()
	local decor = map:WaitForChild("Decor", 10)
	if not decor then
		return
	end
	local i = 0
	for _, d in decor:GetChildren() do
		if d:IsA("BasePart") and d.Name == "Rune" then
			i += 1
			local tween = TweenService:Create(d, TweenInfo.new(1.4, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true, i * 0.2), { Transparency = 0.75 })
			tween:Play()
		elseif d:IsA("BasePart") and d.Name == "Portal" then
			local light = d:FindFirstChildOfClass("PointLight")
			if light then
				TweenService:Create(light, TweenInfo.new(2.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Brightness = 2.2 }):Play()
			end
		end
	end
end)

-- 배경음악 (Config.MusicId 에 오디오 ID 를 넣으면 재생)
Sfx.startMusic(Config.MusicId, Config.MusicVolume)

-- 도움말 순환
local HINTS = {
	"E: 조리대 사용 · 손에는 한 가지만 들 수 있어요",
	"익힌 음식을 오래 두면 타고, 탄 음식을 방치하면 불이 나요!",
	"인내심이 많이 남았을 때 서빙하면 팁을 더 받아요 · 12초 안에 연속 서빙하면 콤보!",
	"역할을 나누세요: 재료 담당 · 조리 담당 · 서빙 담당",
	"화난 손님은 조리대를 부숩니다 — 잠시 못 써요",
	"낮에는 상점(B)에서 팀 업그레이드 · 모두 ✅ 준비 완료면 바로 다음 밤",
	"조리대(합치기)에 재료를 올리면 레시피가 맞을 때 자동으로 합쳐져요",
	"잘못된 요리를 내밀면 손님 인내심이 줄어요 — 주문 목록(왼쪽)을 확인하세요",
	"불이 나면 벽의 🧯 소화기함에서 소화기를 꺼내 E를 길게 누르세요",
	"밥솥의 밥은 타지 않아요. 미리 지어 두세요",
	"명성을 모으면 옷장(C)에서 새 모자를 쓸 수 있어요",
	"구미호는 기다리다 마음을 바꿉니다 — 주문이 바뀌면 ❗ 표시",
	"서빙할수록 🧧 부적 게이지가 차요. 가득 차면 1·2·3 키로 시간·평온·풍요 부적!",
	"보스 밤을 넘기면 도깨비 상인이 유물 3개를 가져와요 — 팀 투표로 하나를 고르세요",
	"인절미는 밥을 떡메에 올리고 두 명이 번갈아 6번 쳐야 해요 (혼자면 천천히)",
	"배불리 먹은 손님은 빛과 함께 성불합니다 — 그게 이 휴게소의 존재 이유",
}
task.spawn(function()
	local i = 1
	while true do
		hud.setHint("💡 " .. HINTS[i])
		i = (i % #HINTS) + 1
		task.wait(9)
	end
end)
