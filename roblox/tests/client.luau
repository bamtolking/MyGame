--!nocheck
-- 풀스택 스모크 테스트: 서버와 클라이언트 코드를 같은 가짜 엔진에서 함께 실행합니다
-- (모듈 캐시는 로블록스처럼 서버/클라이언트가 따로).
-- 클라이언트 UI 생성, 모든 창 열기/새로고침, 행진 그리기·구매 프롬프트, 기지 슬라임 프롬프트,
-- 연출 이벤트, 튜토리얼, 입력을 실행해서 스크립트 오류가 없는지 확인합니다.
-- 실행(roblox 폴더에서): lune run tests/client.luau

local process = require("@lune/process")
local task = require("@lune/task")
local roblox = require("@lune/roblox")
local Engine = require("./mock/Engine")

local S = Engine.services
local Instance = roblox.Instance
local Vector3, Vector2, CFrame = roblox.Vector3, roblox.Vector2, roblox.CFrame

local shared = Engine.mount("src/shared", S.ReplicatedStorage, "Shared")
local server = Engine.mount("src/server", S.ServerScriptService, "Server")
local starterScripts = Engine.game:GetService("StarterPlayer"):FindFirstChildOfClass("StarterPlayerScripts")
	or Instance.new("StarterPlayerScripts")
starterScripts.Parent = Engine.game:GetService("StarterPlayer")
local client = Engine.mount("src/client", starterScripts, "Client")

local SL = Engine.loader() -- 서버 모듈 캐시
local CL = Engine.loader() -- 클라이언트 모듈 캐시

local Economy = SL.require(shared.Config.Economy)
Economy.parade.interval = 0.3

local camera = Instance.new("Camera")
camera.CFrame = CFrame.new(0, 30, 0)
camera.ViewportSize = Vector2.new(1280, 720)
camera.Parent = S.Workspace
S.Workspace.CurrentCamera = camera

local passed, failed = 0, 0
local function check(cond, label)
	if cond then
		passed += 1
		print("  ✓ " .. label)
	else
		failed += 1
		print("  ✗ FAIL: " .. label)
	end
end
local function waitFor(fn, timeout)
	local started = os.clock()
	while os.clock() - started < (timeout or 5) do
		local ok, v = pcall(fn)
		if ok and v then
			return v
		end
		task.wait(0.05)
	end
	return nil
end

-- RenderStepped/Heartbeat을 60fps 흉내로 발생
local frames = true
task.spawn(function()
	local rs = S.RunService
	while frames do
		Engine.syncPositions()
		Engine.sig(rs, "RenderStepped"):Fire(1 / 60)
		Engine.sig(rs, "Heartbeat"):Fire(1 / 60)
		task.wait(1 / 60)
	end
end)

local function main()
	print("== boot server")
	SL.runScript(server.Main)
	waitFor(function()
		return S.Workspace:FindFirstChild("Map")
	end)
	local Sessions = SL.require(server.Sessions)
	local SlimeService = SL.require(server.Services.SlimeService)
	local ParadeService = SL.require(server.Services.ParadeService)
	local WeatherService = SL.require(server.Services.WeatherService)
	local EconomyService = SL.require(server.Services.EconomyService)

	print("== player joins, client boots")
	local player = Engine.addPlayer("Tester")
	local gui = Instance.new("PlayerGui")
	gui.Parent = player
	Engine.setLocalPlayer(player)
	local session = waitFor(function()
		return Sessions.get(player)
	end)
	check(session ~= nil, "server session")
	CL.runScript(client.Main)
	check(waitFor(function()
		return gui:FindFirstChild("HUD")
	end) ~= nil, "HUD created")
	check(gui:FindFirstChild("Panels") ~= nil, "panels created")
	check(gui:FindFirstChild("Notify") ~= nil, "notify created")
	local State = CL.require(client.State)
	check(waitFor(function()
		return State.view
	end) ~= nil, "client received state")

	print("== parade on client")
	local entry = ParadeService.spawn("common", "blobby", "gold")
	local folder = waitFor(function()
		return S.Workspace:FindFirstChild("ParadeClient")
	end)
	local model = waitFor(function()
		for _, m in folder:GetChildren() do
			if m:FindFirstChild("Body") then
				return m
			end
		end
		return nil
	end)
	check(model ~= nil, "parade slime rendered")
	task.wait(0.2)
	local body = model and model:FindFirstChild("Body")
	local prompt = body and body:FindFirstChildOfClass("Attachment"):FindFirstChildOfClass("ProximityPrompt")
	check(prompt ~= nil, "buy prompt exists")
	check(model and model:FindFirstChild("SlimeLabel") ~= nil, "parade label")
	local pos = ParadeService.positionOf(entry)
	Engine.moveTo(player, pos + Vector3.new(2, 3, 0))
	Engine.sig(prompt, "Triggered"):Fire()
	check(waitFor(function()
		for _ in session.data.slimes do
			return true
		end
		return false
	end), "bought via client prompt")

	print("== base slime prompts & manage panel")
	local plot = S.Workspace.Map.Plots.Plot1
	local baseModel = waitFor(function()
		return plot.Slimes:GetChildren()[1]
	end)
	task.wait(0.3)
	local managePrompt = waitFor(function()
		return baseModel.Body:FindFirstChildOfClass("Attachment"):FindFirstChildOfClass("ProximityPrompt")
	end)
	check(managePrompt ~= nil, "manage prompt on own slime")
	check(baseModel:FindFirstChild("SlimeLabel") ~= nil, "base slime label")
	Engine.sig(managePrompt, "Triggered"):Fire()
	local Panel = CL.require(client.UI.Panel)
	check(waitFor(function()
		return Panel.isOpen("Manage")
	end), "manage panel opened")

	print("== open every panel")
	EconomyService.addCash(session, 1e7)
	session.dirty = true
	task.wait(0.4)
	for _, name in { "Shop", "Index", "Rebirth", "Quests", "Gifts", "Store", "Settings", "Manage" } do
		Panel.open(name)
		task.wait(0.15)
		check(Panel.isOpen(name), name .. " opens")
	end
	Panel.close("Manage")

	print("== click buttons")
	Panel.open("Shop")
	local shopRoot = gui.Panels.Shop
	local clicked = 0
	for _, d in shopRoot:GetDescendants() do
		if d:IsA("TextButton") and d.Parent and d.Parent:IsA("Frame") and d.Text:sub(1, 1) == "$" then
			Engine.sig(d, "Activated"):Fire()
			clicked += 1
			task.wait(0.2)
		end
	end
	check(clicked > 0, "clicked upgrade buttons (" .. clicked .. ")")
	check((session.data.upgrades.pads or 0) >= 1, "upgrade bought through UI")
	Panel.open("Quests")
	for _, d in gui.Panels.Quests:GetDescendants() do
		if d:IsA("TextButton") then
			Engine.sig(d, "Activated"):Fire()
		end
	end
	task.wait(0.3)
	check(session.data.daily.streak == 1, "daily claimed through UI")

	print("== fx & world events")
	local other = Engine.addPlayer("Other")
	waitFor(function()
		return other.Character
	end)
	local Remote = SL.require(server.Remote)
	Remote.fx(player, "collect", { amount = 1234 })
	Remote.fx(player, "knockback", { dir = Vector3.new(1, 0, 0), power = 50, stun = 0.1 })
	Remote.fx(player, "revenge", { thief = other.UserId, seconds = 1 })
	Remote.fxAll("carryStart", { thief = other.UserId })
	Remote.fxAll("carryEnd", { thief = other.UserId })
	Remote.fxAll("bonk", { attacker = other.UserId, pos = Vector3.new(0, 3, 0), hit = true })
	Remote.fx(player, "reward", { cash = 50, boost = "cash2x", seconds = 60, slime = "king", serverLuck = 300 })
	Remote.fx(player, "rebirth", { n = 1 })
	Remote.fx(player, "lock", { seconds = 60 })
	Remote.notify(player, "success", "stealSuccess", { slime = "dragon" })
	Remote.notifyAll("rare", "rareSpawn", { slime = "slimegod", mut = "galaxy", rarity = "secret" })
	WeatherService.startEvent("meteor")
	task.wait(1.2)
	SlimeService.add(session, { id = "blobby", star = 1, mut = "rainbow" })
	task.wait(0.5)
	WeatherService.stopEvent()

	print("== input")
	local bonkAction = Engine.actions and Engine.actions.SlimeHeistBonk
	check(bonkAction ~= nil, "bonk key bound")
	if bonkAction then
		bonkAction("SlimeHeistBonk", roblox.Enum.UserInputState.Begin, nil)
	end
	task.wait(0.3)

	print("== offline popup")
	session.offline = { amount = 999, seconds = 3600 }
	session.dirty = true
	check(waitFor(function()
		return Panel.isOpen("Offline")
	end), "offline popup shown")
	Panel.close("Offline")
	task.wait(0.3)
end

local ok, err = pcall(main)
if not ok then
	failed += 1
	print("TEST SCRIPT ERROR: " .. tostring(err))
end
frames = false
task.wait(0.2)
print("")
for _, e in Engine.errors do
	print("ENGINE ERROR: " .. e)
end
check(#Engine.errors == 0, "no script errors")
print(string.format("\n%d passed, %d failed", passed, failed))
process.exit(if failed == 0 then 0 else 1)
