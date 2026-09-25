--!nocheck
-- 서버 통합 테스트: 실제 서버 코드(Main.server.luau)를 가짜 엔진 위에서 부팅하고
-- 입장 → 구매 → 수입/수금 → 합성 → 업그레이드 → 훔치기/뿅망치/배달 → 잠금 → 날씨 변이
-- → 환생 → 보상 → 관리자 명령 → 결제 → 퇴장/재입장(저장·오프라인 수입) → 종료 저장 까지 확인합니다.
-- 실행(roblox 폴더에서): lune run tests/server.luau

local process = require("@lune/process")
local task = require("@lune/task")
local Engine = require("./mock/Engine")
local roblox = require("@lune/roblox")

local S = Engine.services
local Vector3, CFrame = roblox.Vector3, roblox.CFrame

local shared = Engine.mount("src/shared", S.ReplicatedStorage, "Shared")
local server = Engine.mount("src/server", S.ServerScriptService, "Server")
local L = Engine.loader()

-- 테스트 속도를 위해 설정값 조정(모듈은 캐시되므로 서버가 같은 표를 봄)
local Economy = L.require(shared.Config.Economy)
local Weather = L.require(shared.Config.Weather)
local Products = L.require(shared.Config.Products)
local World = L.require(shared.Config.World)
local Calc = L.require(shared.Logic.Calc)
Economy.parade.interval = 0.25
Weather.baseMutationInterval = 0.3
Products.productByKey.serverLuck.id = 777
Products.productById[777] = Products.productByKey.serverLuck

local passed, failed = 0, 0
local function check(cond, label)
	if cond then
		passed += 1
		print("  ✓ " .. label)
	else
		failed += 1
		print("  ✗ FAIL: " .. label)
	end
	return cond
end

local function waitFor(fn, timeout, label)
	local started = os.clock()
	while os.clock() - started < (timeout or 5) do
		local ok, v = pcall(fn)
		if ok and v then
			return v
		end
		task.wait(0.05)
	end
	print("  (timeout waiting for " .. (label or "condition") .. ")")
	return nil
end

local function main()
print("== boot")
L.runScript(server.Main)
local map = waitFor(function()
	return S.Workspace:FindFirstChild("Map")
end, 5, "map")
check(map ~= nil, "map built")
check(map and #map.Plots:GetChildren() == 8, "8 plots")
check(S.ReplicatedStorage:FindFirstChild("Remotes") ~= nil, "remotes created")
check(S.ReplicatedStorage:FindFirstChild("WorldState") ~= nil, "world state folder")

local Sessions = L.require(server.Sessions)
local Services = server.Services
local SlimeService = L.require(Services.SlimeService)
local ParadeService = L.require(Services.ParadeService)
local PlotService = L.require(Services.PlotService)
local WeatherService = L.require(Services.WeatherService)
local EconomyService = L.require(Services.EconomyService)

print("== player A joins")
local A = Engine.addPlayer("Alice")
local sa = waitFor(function()
	return Sessions.get(A)
end, 5, "session A")
check(sa ~= nil, "session loaded")
check(sa and sa.plot == 1, "A got plot 1")
waitFor(function()
	return A.Character
end, 3, "character")
local root = A.Character and A.Character:FindFirstChild("HumanoidRootPart")
check(root and (root.Position - World.spawnCFrame(1).Position).Magnitude < 1, "A spawned at base")
check(A:FindFirstChild("leaderstats") ~= nil, "leaderstats")
check(Engine.lastRemote("State", A) ~= nil, "state sent to A")
check(map.Plots.Plot1:GetAttribute("OwnerUserId") == A.UserId, "plot owner attribute")

print("== buy from parade")
local entry = ParadeService.spawn("common", "blobby", "none")
task.wait(0.1)
local pos = ParadeService.positionOf(entry)
Engine.moveTo(A, pos + Vector3.new(3, 3, 0))
local cashBefore = sa.data.cash
local r = Engine.invoke(A, "Buy", entry.key)
check(r.ok, "buy ok (" .. tostring(r.msg) .. ")")
check(sa.data.cash == cashBefore - entry.price, "cash spent")
local count = 0
for _ in sa.data.slimes do
	count += 1
end
check(count == 1, "A owns 1 slime")
check(#map.Plots.Plot1.Slimes:GetChildren() == 1, "slime model on pad")
check(sa.data.tutorial == 1, "tutorial advanced to collect")
local r2 = Engine.invoke(A, "Buy", entry.key)
check(not r2.ok, "cannot buy the same slime twice")
local far = ParadeService.spawn("common", "blobby", "none")
Engine.moveTo(A, World.spawnCFrame(1).Position)
task.wait(0.2)
local r3 = Engine.invoke(A, "Buy", far.key)
check(not r3.ok and r3.msg == "tooFar", "too far rejected")

print("== income & collect")
task.wait(2.2)
check(sa.data.vault > 0, "vault filled (" .. sa.data.vault .. ")")
local before = sa.data.cash
Engine.touch(map.Plots.Plot1.CollectPlate, A)
task.wait(0.1)
check(sa.data.vault < 1 and sa.data.cash > before, "collected")
check(sa.data.tutorial == 2, "tutorial advanced to lock")

print("== merge")
SlimeService.add(sa, { id = "blobby", star = 1, mut = "gold" })
SlimeService.add(sa, { id = "blobby", star = 1, mut = "none" })
local anyUid
for uid in sa.data.slimes do
	anyUid = uid
end
task.wait(0.35)
local rm = Engine.invoke(A, "Merge", anyUid)
check(rm.ok, "merge ok (" .. tostring(rm.msg) .. ")")
local stars, n = 0, 0
for _, s in sa.data.slimes do
	n += 1
	stars = s.star
	check(s.mut == "gold", "merge kept best mutation")
end
check(n == 1 and stars == 2, "3 slimes became one ★2")

print("== upgrades")
EconomyService.addCash(sa, 1e6)
local ru = Engine.invoke(A, "Upgrade", "pads")
check(ru.ok and sa.data.upgrades.pads == 1, "pads upgrade")
task.wait(0.2)
Engine.invoke(A, "Upgrade", "speed")
local hum = A.Character:FindFirstChildOfClass("Humanoid")
check(hum.WalkSpeed == Calc.walkSpeed(sa.data), "walk speed applied (" .. hum.WalkSpeed .. ")")
check(map.Plots.Plot1:GetAttribute("PadCount") == 11, "pad count attribute")

print("== player B joins (friend)")
Engine.friends["1001:1002"] = true
local B = Engine.addPlayer("Bob")
local sb = waitFor(function()
	return Sessions.get(B)
end, 5, "session B")
check(sb and sb.plot == 2, "B got plot 2")
waitFor(function()
	return sa.friends == 1 and sb.friends == 1
end, 3, "friends")
check(sa.friends == 1 and sb.friends == 1, "friend boost counted both ways")
waitFor(function()
	return B.Character
end, 3, "B character")

print("== steal")
local kingUid = SlimeService.add(sb, { id = "king", star = 1, mut = "none" })
local king = sb.data.slimes[kingUid]
local padPos = World.padCFrame(2, king.pad).Position
Engine.moveTo(A, padPos + Vector3.new(0, 3, 0))
local rs = Engine.invoke(A, "StealStart", { plot = 2, uid = kingUid })
check(not rs.ok and rs.msg == "rookieProtected", "rookie base protected")
sb.data.playTime = 5000
task.wait(0.35)
rs = Engine.invoke(A, "StealStart", { plot = 2, uid = kingUid })
check(rs.ok, "steal start ok (" .. tostring(rs.msg) .. ")")
local early = Engine.invoke(A, "StealFinish", { plot = 2, uid = kingUid })
check(not early.ok, "finishing without holding is rejected")
task.wait(0.35)
rs = Engine.invoke(A, "StealStart", { plot = 2, uid = kingUid })
task.wait(rs.hold or 2)
local rf = Engine.invoke(A, "StealFinish", { plot = 2, uid = kingUid })
check(rf.ok, "steal finish ok (" .. tostring(rf.msg) .. ")")
check(sa.carrying ~= nil and sb.busy[kingUid] == true, "A is carrying B's king")
check(A.Character:FindFirstChild("CarriedSlime") ~= nil, "carried model on A")
check(map.Plots.Plot2.Slimes:FindFirstChild("Slime_" .. kingUid) == nil, "king left B's pad")
check(hum.WalkSpeed < Calc.walkSpeed(sa.data), "A slowed while carrying (" .. hum.WalkSpeed .. ")")

-- B가 A를 뿅!
local aPos = A.Character.HumanoidRootPart.Position
Engine.moveTo(B, aPos + Vector3.new(0, 0, 4))
-- 회전 없는 CFrame은 -Z(= A 쪽)를 바라봄. (Lune의 CFrame.lookAt은 Z축 방향에서 반대로 계산하는 버그가 있어 사용 안 함)
B.Character:PivotTo(CFrame.new(aPos + Vector3.new(0, 0, 4)))
Engine.remote("Bonk"):FireServer() -- localPlayer가 없으므로 직접 발사
local bonk = Engine.sig(Engine.remote("Bonk"), "OnServerEvent")
bonk:Fire(B)
task.wait(0.3)
check(sa.carrying == nil, "bonk made A drop the slime")
check(sb.data.slimes[kingUid] ~= nil and not sb.busy[kingUid], "king back to B")
check(map.Plots.Plot2.Slimes:FindFirstChild("Slime_" .. kingUid) ~= nil, "king model restored on pad")
check(Engine.lastRemote("Fx", A, function(args)
	return args[1].kind == "knockback"
end) ~= nil, "knockback sent to A")

-- 다시 훔쳐서 집까지 배달
Engine.moveTo(A, padPos + Vector3.new(0, 3, 0))
Engine.moveTo(B, World.spawnCFrame(2).Position + Vector3.new(0, 0, 0))
task.wait(0.35)
rs = Engine.invoke(A, "StealStart", { plot = 2, uid = kingUid })
task.wait(rs.hold or 2)
rf = Engine.invoke(A, "StealFinish", { plot = 2, uid = kingUid })
check(rf.ok, "second steal ok")
-- 순간이동으로 바로 집에 가면 무효여야 함 → 한 번 확인 후, 다시 훔쳐서 충분히 "걸은" 시간 뒤 도착
Engine.moveTo(A, World.plotPoint(1, 0, 3, 30).Position)
task.wait(0.4)
check(sa.carrying == nil and sb.data.slimes[kingUid] ~= nil, "teleport delivery rejected")
Engine.moveTo(A, padPos + Vector3.new(0, 3, 0))
task.wait(0.35)
rs = Engine.invoke(A, "StealStart", { plot = 2, uid = kingUid })
task.wait(rs.hold or 2)
rf = Engine.invoke(A, "StealFinish", { plot = 2, uid = kingUid })
check(rf.ok, "third steal ok")
local walkTime = (World.plotPoint(1, 0, 3, 30).Position - padPos).Magnitude / (Calc.walkSpeed(sa.data) * sa.carryMult)
task.wait(walkTime * 0.8)
Engine.moveTo(A, World.plotPoint(1, 0, 3, 30).Position)
task.wait(0.4)
local aHasKing = false
for _, s in sa.data.slimes do
	if s.id == "king" then
		aHasKing = true
	end
end
check(aHasKing and sb.data.slimes[kingUid] == nil, "delivered: king moved from B to A")
check(sa.data.steals == 1, "steal counted")
local prot, kind = PlotService.protection(2)
check(prot and kind == "shield", "B shielded after theft")

print("== lock & kick-out")
task.wait(0.1)
Engine.touch(map.Plots.Plot2.LockPlate, B)
task.wait(0.1)
prot, kind = PlotService.protection(2)
check(prot, "B's base locked")
Engine.moveTo(A, World.plotPoint(2, 0, 3, 40).Position)
task.wait(0.5)
check(not World.isInsidePlot(2, A.Character.HumanoidRootPart.Position, 0), "A pushed out of locked base")

print("== lock while a thief is inside carrying")
-- 새 플레이어 C의 기지에서 훔치는 도중에 C가 잠그면 도둑은 슬라임을 놓쳐야 함
local C = Engine.addPlayer("Cara")
local sc = waitFor(function()
	return Sessions.get(C)
end, 5, "session C")
waitFor(function()
	return C.Character
end, 3, "C character")
sc.data.playTime = 5000
local angelUid = SlimeService.add(sc, { id = "angel", star = 1, mut = "none" })
local angel = sc.data.slimes[angelUid]
Engine.moveTo(A, World.padCFrame(sc.plot, angel.pad).Position + Vector3.new(0, 3, 0))
task.wait(0.35)
rs = Engine.invoke(A, "StealStart", { plot = sc.plot, uid = angelUid })
task.wait(rs.hold or 2)
rf = Engine.invoke(A, "StealFinish", { plot = sc.plot, uid = angelUid })
check(rf.ok and sa.carrying ~= nil, "A carrying C's angel")
Engine.touch(map.Plots["Plot" .. sc.plot].LockPlate, C)
task.wait(0.5)
check(sa.carrying == nil, "locking the base made the thief drop it")
check(sc.data.slimes[angelUid] ~= nil and not sc.busy[angelUid], "angel stayed with C")

print("== weather mutation")
local oldChance = Weather.baseMutationChance
Weather.baseMutationChance = 1
WeatherService.startEvent("rainbow")
task.wait(0.8)
local allRainbow = true
for _, s in sa.data.slimes do
	if s.mut ~= "rainbow" then
		allRainbow = false
	end
end
check(allRainbow, "weather mutated A's slimes to rainbow")
Weather.baseMutationChance = oldChance
WeatherService.stopEvent()

print("== favorite & rebirth")
local kingA
for uid, s in sa.data.slimes do
	if s.id == "king" then
		kingA = uid
	end
end
task.wait(0.35)
check(Engine.invoke(A, "Favorite", kingA).ok, "favorite set")
local rSell = Engine.invoke(A, "Sell", kingA)
check(not rSell.ok and rSell.msg == "favLocked", "cannot sell favorite")
local rb = Engine.invoke(A, "Rebirth")
check(not rb.ok, "rebirth blocked without cash")
EconomyService.addCash(sa, Calc.rebirthCost(0))
SlimeService.add(sa, { id = "ninja", star = 1, mut = "none" })
task.wait(2.1)
rb = Engine.invoke(A, "Rebirth")
check(rb.ok, "rebirth ok (" .. tostring(rb.msg) .. ")")
n = 0
for _, s in sa.data.slimes do
	n += 1
	check(s.id == "king" and s.fav, "favorite kept through rebirth")
end
check(n == 1 and sa.data.rebirths == 1 and sa.data.cash == Economy.startCash, "rebirth reset")

print("== rewards")
local rd = Engine.invoke(A, "ClaimDaily")
check(rd.ok and rd.slot == 1, "daily claimed")
task.wait(1.1)
check(not Engine.invoke(A, "ClaimDaily").ok, "daily only once")
check(not Engine.invoke(A, "ClaimGift", 1).ok, "gift not ready")
sa.joinedClock -= 200
task.wait(0.35)
local rg = Engine.invoke(A, "ClaimGift", 1)
check(rg.ok and rg.granted and rg.granted.cash, "gift claimed")
sa.data.quests.list[1].progress = sa.data.quests.list[1].goal
task.wait(0.35)
local rq = Engine.invoke(A, "ClaimQuest", 1)
check(rq.ok, "quest claimed")

print("== admin & purchase")
local cmd = S.TextChatService:FindFirstChild("AdminCommands"):FindFirstChild("Admin_cash")
local c0 = sa.data.cash
Engine.sig(cmd, "Triggered"):Fire({ UserId = A.UserId }, "/cash 500")
task.wait(0.1)
check(sa.data.cash == c0 + 500, "/cash admin command")
local receipt = Engine.callback(S.MarketplaceService, "ProcessReceipt")
local d1 = receipt({ PlayerId = A.UserId, ProductId = 777, PurchaseId = "p-1" })
local luck1 = WeatherService.luck()
local d2 = receipt({ PlayerId = A.UserId, ProductId = 777, PurchaseId = "p-1" })
check(d1 == roblox.Enum.ProductPurchaseDecision.PurchaseGranted and d2 == d1, "receipt granted")
check(luck1 >= 2 and WeatherService.luck() == luck1, "server luck applied once")

print("== leave, save, rejoin with offline earnings")
local uidA = A.UserId
Engine.removePlayer(A)
task.wait(0.3)
check(Sessions.get(A) == nil, "session removed")
check(map.Plots.Plot1:GetAttribute("OwnerUserId") == 0, "plot freed")
local store = Engine.stores.SlimeHeist_v1
local stored = store:GetAsync("u_" .. uidA)
check(stored and stored.data and stored.data.rebirths == 1, "data saved")
check(stored and stored.lock == nil, "session lock released")
stored.data.lastOnline = os.time() - 3600
store:SetAsync("u_" .. uidA, stored)
local A2 = Engine.addPlayer("Alice", uidA)
local sa2 = waitFor(function()
	return Sessions.get(A2)
end, 5, "session A2")
check(sa2 and sa2.data.rebirths == 1, "data restored")
check(sa2 and sa2.offline and sa2.offline.amount > 0, "offline earnings offered")
local cBefore = sa2.data.cash
check(Engine.invoke(A2, "ClaimOffline").ok and sa2.data.cash > cBefore, "offline claimed")

print("== shutdown")
Engine.close()
task.wait(0.3)
local final = store:GetAsync("u_" .. uidA)
check(final and final.lock == nil, "saved on shutdown")

end

local ok, err = pcall(main)
if not ok then
	failed += 1
	print("TEST SCRIPT ERROR: " .. tostring(err))
end
print("")
if #Engine.errors > 0 then
	for _, e in Engine.errors do
		print("ENGINE ERROR: " .. e)
	end
end
check(#Engine.errors == 0, "no script errors")
print(string.format("\n%d passed, %d failed", passed, failed))
process.exit(if failed == 0 then 0 else 1)
