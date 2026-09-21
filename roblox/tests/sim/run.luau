--!nonstrict
-- 헤드리스 통합 시뮬레이션: 실제 서버·클라이언트 스크립트를 Lune 위에서 실행하고, 가짜 요리사 2명이 게임을 진행합니다.
--   실행: cd roblox && lune run tests/sim/run.luau
-- 검증 대상: 지도 생성, 조리대·손님 AI, 서빙·성불, 난동·파손, 화재·소화, 부적, 떡메치기, 구미호 변덕, 정전, 보스·유물 투표,
--            상점·옷장·저장, 낮 준비 투표, 폐업·리뷰·재시작, 클라이언트 HUD/패널/라벨/연출 핸들러.
local rbx = require("./rbx")
local roblox = require("@lune/roblox")
local task = require("@lune/task")
local process = require("@lune/process")

local ROOT = process.args[1] or "."
local PLACE = process.args[2] -- 예: build/GhostDiner.rbxlx 를 주면 빌드 산출물의 스크립트로 실행
local results = {}
local function check(name, cond, detail)
	table.insert(results, { name = name, ok = cond and true or false, detail = detail })
	print(string.format("%s %s%s", cond and "  ✅" or "  ❌", name, if detail and not cond then " — " .. tostring(detail) else ""))
end

local function scenario()
-- ---------- 준비 ----------
local tree = if PLACE then rbx.mountPlace(PLACE) else rbx.mountProject(ROOT)
print(if PLACE then "== 실행 대상: " .. PLACE .. " (빌드 산출물)" else "== 실행 대상: src/ (소스)")
local Config = rbx.requireInstance(tree.shared.Config)
Config.StartCountdown = 1
Config.DayLength = 2.5
Config.GameOverLength = 1
Config.SmashDuration = 1
Config.BurnDelay = 0.6
Config.FireDelay = 0.6
Config.FireSpreadInterval = 0.4
Config.AscendDuration = 0.4
Config.RelicVoteTime = 3
Config.BlackoutDuration = 1
Config.TalismanMax = 10
Config.EventChance = 0
Config.LeaderboardRefresh = 3
Config.ExtinguishHold = 0
Config.ChopTime = 0.1
Config.PoundSoloCooldown = 0.1
local Recipes = rbx.requireInstance(tree.shared.Recipes)
for _, c in Recipes.Cooks do
	c.time = 0.3
end
local CustomerTypes = rbx.requireInstance(tree.shared.CustomerTypes)
for _, t in CustomerTypes.List do
	t.patience = 6
	t.speed = 200
end
CustomerTypes.ById.sansin.patience = 40
local Waves = rbx.requireInstance(tree.shared.Waves)
Waves.customerCount = function()
	return 1
end
local Events = rbx.requireInstance(tree.shared.Events)

local p1 = rbx.addPlayer("철수", 1001)
local p2 = rbx.addPlayer("영희", 1002)
rbx.startTicker(0.05)

-- ---------- 서버 부팅 ----------
print("== 서버 시작")
rbx.runScript(tree.serverMain)
local ws = rbx.workspace
local map = ws:WaitForChild("GhostDinerMap", 5)
check("지도 생성", map ~= nil)
local stations = map and map:FindFirstChild("Stations")
local customersFolder = map and map:FindFirstChild("Customers")
check("조리대 28개", stations and #stations:GetChildren() == 28, stations and #stations:GetChildren())
local rs = rbx.game:GetService("ReplicatedStorage")
local remotes = rs:FindFirstChild("GhostDinerRemotes")
local state = rs:FindFirstChild("GhostDinerState")
check("리모트·상태 폴더", remotes ~= nil and state ~= nil)
for _, n in { "Notify", "Buy", "SetHat", "Ready", "UseTalisman", "RelicVote" } do
	check("리모트 " .. n, remotes and remotes:FindFirstChild(n) ~= nil)
end
local decor = map and map:FindFirstChild("Decor")
check("장식(간판·달·순위표·등불)", decor and decor:FindFirstChild("NeonSign") and decor:FindFirstChild("Moon") and decor:FindFirstChild("LeaderboardBoard") and decor:FindFirstChild("PaperLantern") ~= nil)

local GameState = rbx.requireInstance(tree.server.GameState)
local Customers = rbx.requireInstance(tree.server.Customers)
local Stations = rbx.requireInstance(tree.server.Stations)
local Items = rbx.requireInstance(tree.server.Items)
local Data = rbx.requireInstance(tree.server.Data)

-- ---------- 클라이언트 부팅 ----------
print("== 클라이언트 시작")
rbx.runScript(tree.clientMain)
task.wait(0.5)
local pg = p1:FindFirstChildOfClass("PlayerGui")
local hud = pg and pg:FindFirstChild("GhostDinerHud")
check("HUD 생성", hud ~= nil and hud:FindFirstChild("Top") ~= nil)
check("연출 GUI 생성", pg and pg:FindFirstChild("GhostDinerFxUnder") ~= nil and pg:FindFirstChild("GhostDinerFxOver") ~= nil)
local function guiText(path)
	local inst = hud
	for name in string.gmatch(path, "[^.]+") do
		inst = inst and inst:FindFirstChild(name)
	end
	return inst and inst.Text or nil
end
local function findButton(text)
	for _, d in pg:GetDescendants() do
		if d:IsA("TextButton") and string.find(d.Text, text, 1, true) then
			return d
		end
	end
	return nil
end

-- ---------- 도우미 ----------
local function attr(inst, name)
	return inst and inst:GetAttribute(name)
end
local function phase()
	return attr(state, "Phase")
end
local function press(part, player, wait)
	local prompt = part:FindFirstChild("Prompt") or part:FindFirstChild("ServePrompt")
	assert(prompt, "프롬프트 없음: " .. part.Name)
	rbx.sigOf(prompt, "Triggered"):Fire(player)
	task.wait(wait or 0.15)
end
local function held(player)
	return Items.getHeldId(player)
end
local function crateFor(itemId)
	local idx = table.find(Recipes.CrateItems, itemId)
	return stations:FindFirstChild("crate" .. idx)
end
local function findStation(kind, wantState)
	for _, part in stations:GetChildren() do
		if attr(part, "Kind") == kind and attr(part, "Locked") == false and attr(part, "Smashed") == false and (wantState == nil or attr(part, "State") == wantState) then
			return part
		end
	end
	return nil
end
local function stationsOfKind(kind)
	local out = {}
	for _, part in stations:GetChildren() do
		if attr(part, "Kind") == kind then
			table.insert(out, part)
		end
	end
	table.sort(out, function(a, b)
		return a.Name < b.Name
	end)
	return out
end
local function customers()
	local out = {}
	for _, m in customersFolder:GetChildren() do
		if m:IsA("Model") then
			table.insert(out, m)
		end
	end
	return out
end
local function dumpCustomers(tag)
	print("   [덤프 " .. tag .. "] phase=" .. tostring(phase()) .. " total=" .. tostring(attr(state, "CustomersTotal")) .. " done=" .. tostring(attr(state, "CustomersDone")) .. " pending=" .. tostring(Customers.pendingCount()) .. " hasSpace=" .. tostring(Customers.hasSpace()) .. " models=" .. #customers())
	for _, m in customers() do
		local root = m:FindFirstChild("HumanoidRootPart")
		print(string.format("     - %s mood=%s orders=%s pos=%s", m.Name, tostring(attr(m, "Mood")), tostring(attr(m, "Orders")), root and tostring(root.CFrame.Position) or "?"))
	end
end
local function waitingCustomer(timeout)
	local found = nil
	local ok = rbx.waitUntil(function()
		for _, m in customers() do
			if attr(m, "Mood") == "waiting" then
				found = m
				return true
			end
		end
		return false
	end, timeout or 8, "기다리는 손님")
	if not ok then
		dumpCustomers("대기 손님 없음")
	end
	return found
end

-- 요리 만들기 (손에 결과가 들림)
local make
make = function(player, itemId, depth)
	depth = depth or 0
	assert(depth < 8, "레시피 재귀 과다")
	local item = Recipes.Items[itemId]
	assert(item, "없는 아이템 " .. itemId)
	if item.kind == "raw" then
		press(crateFor(itemId), player)
		return
	end
	if Recipes.Pound.output == itemId then
		make(player, Recipes.Pound.input, depth + 1)
		local mallet = findStation("mallet", "idle")
		press(mallet, player)
		local other = if player == p1 then p2 else p1
		for i = 1, Recipes.Pound.hits do
			press(mallet, if i % 2 == 1 then player else other, 0.2)
		end
		rbx.waitUntil(function()
			return attr(mallet, "State") == "done"
		end, 3, "떡메 완성")
		press(mallet, player)
		return
	end
	for _, cook in Recipes.Cooks do
		if cook.output == itemId then
			make(player, cook.input, depth + 1)
			local station = findStation(cook.station, "idle")
			assert(station, "빈 " .. cook.station .. " 없음")
			press(station, player)
			rbx.waitUntil(function()
				return attr(station, "State") == "done"
			end, 5, cook.station .. " 완성")
			press(station, player)
			return
		end
	end
	for _, combo in Recipes.Combos do
		if combo.output == itemId then
			local counter = findStation("combine")
			for _, input in combo.inputs do
				make(player, input, depth + 1)
				press(counter, player)
			end
			press(counter, player) -- 합쳐진 결과 집기
			return
		end
	end
	for _, other in Recipes.List do
		if other.chopTo == itemId then
			make(player, other.id, depth + 1)
			press(findStation("board"), player)
			return
		end
	end
	error("만들 수 없음: " .. itemId)
end

local function serveCustomer(player, model)
	local orders = {}
	for id in string.gmatch(attr(model, "Orders") or "", "[^,]+") do
		table.insert(orders, id)
	end
	for _, dish in orders do
		if held(player) then
			press(findStation("trash"), player)
		end
		make(player, dish)
		if attr(model, "Mood") ~= "waiting" then
			return false
		end
		press(model.HumanoidRootPart, player)
	end
	return true
end

local function waitPhase(p, timeout)
	return rbx.waitUntil(function()
		return phase() == p
	end, timeout or 20, "단계 " .. p)
end
local function readyAll()
	rbx.sigOf(remotes.Ready, "OnServerEvent"):Fire(p1)
	task.wait(0.1)
	rbx.sigOf(remotes.Ready, "OnServerEvent"):Fire(p2)
	task.wait(0.2)
end

-- ---------- 밤 1: 기본 서빙·성불·튜토리얼 ----------
print("== 밤 1")
check("개장 준비 단계", waitPhase("countdown", 5))
check("밤 1 시작", waitPhase("night", 5) and attr(state, "Night") == 1)
task.wait(0.4)
check("튜토리얼 표시(첫 방문)", hud:FindFirstChild("Tutorial") and hud.Tutorial.Visible == true)
local c1 = waitingCustomer(8)
check("손님 도착·대기", c1 ~= nil)
if c1 then
	local line = attr(c1, "Line")
	check("손님 대사 있음", type(line) == "string" and #line > 0)
	local coinsBefore = attr(state, "Coins")
	local ok = serveCustomer(p1, c1)
	check("서빙 성공", ok and attr(state, "Served") == 1, tostring(attr(state, "Served")))
	check("코인 증가", (attr(state, "Coins") or 0) > (coinsBefore or 0))
	check("부적 게이지 증가", (attr(state, "Talisman") or 0) > 0)
	check("성불(승천) 무드", rbx.waitUntil(function()
		return attr(c1, "Mood") == "ascend"
	end, 3, "ascend 무드"))
	check("성불 후 손님 제거", rbx.waitUntil(function()
		return c1.Parent == nil
	end, 3, "손님 제거"))
end
check("밤 1 클리어 → 낮", waitPhase("day", 10))
task.wait(0.3)
check("밤 요약 표시", hud:FindFirstChild("Summary") and hud.Summary.Visible == true)
check("튜토리얼 완료로 숨김", rbx.waitUntil(function()
	return hud.Tutorial.Visible == false
end, 5, "튜토리얼 숨김"))
check("HUD 밤 라벨", string.find(guiText("Top.Night") or "", "밤", 1, true) ~= nil, guiText("Top.Night"))
check("순위표에 기록", rbx.waitUntil(function()
	local board = decor.LeaderboardBoard:FindFirstChildOfClass("SurfaceGui")
	local body = board and board:GetChildren()[2]
	return body and string.find(body.Text, "번째 밤", 1, true) ~= nil
end, 6, "순위표 갱신"))

-- ---------- 낮 1: 상점·옷장·준비 투표 ----------
print("== 낮 1: 상점·옷장·준비 투표")
GameState.coins = 500
local buy = remotes.Buy.OnServerInvoke
local ok1, msg1 = buy(p1, "pot")
check("상점: 냄비 추가 구매", ok1 == true, msg1)
check("잠긴 냄비 해금", attr(stations.pot2, "Locked") == false)
local ok2, msg2 = buy(p1, "shoes")
check("상점: 빠른 신발 구매", ok2 == true, msg2)
task.wait(0.1)
check("이동 속도 적용", p1.Character.Humanoid.WalkSpeed == 18, p1.Character.Humanoid.WalkSpeed)
local ok3, msg3 = buy(p1, "repair")
check("상점: 평판 가득이면 수리 거부", ok3 == false, msg3)
local ok4 = buy(p1, "knife")
check("상점: 칼 구매 → 칼질 시간 갱신", ok4 == true and math.abs((attr(stations.board1, "ChopTime") or 0) - 0.075) < 0.001, attr(stations.board1, "ChopTime"))
local ok5, msg5 = buy(p1, "nope")
check("상점: 없는 항목 거부", ok5 == false, msg5)
Data.addFame(p1, 100)
local hok, hmsg = remotes.SetHat.OnServerInvoke(p1, "chef")
check("옷장: 요리사 모자 착용", hok == true and p1.Character:FindFirstChild("GhostDinerHat") ~= nil, hmsg)
local hok2, hmsg2 = remotes.SetHat.OnServerInvoke(p1, "crown")
check("옷장: 명성 부족 거부", hok2 == false, hmsg2)
check("플레이어 명성 속성", (p1:GetAttribute("Fame") or 0) >= 100)
readyAll()
check("준비 투표로 낮 즉시 종료", waitPhase("night", 3) and attr(state, "Night") == 2)

-- ---------- 밤 2: 악귀 난동·파손·평온 부적 ----------
print("== 밤 2: 악귀·파손·평온 부적")
for _, t in CustomerTypes.List do
	t.speed = 20
end
local c2 = waitingCustomer(10)
check("밤 2 손님 대기", c2 ~= nil)
local hpBefore = attr(state, "Hp")
check("악귀화", rbx.waitUntil(function()
	return c2 and attr(c2, "Mood") == "angry"
end, 12, "angry 무드"))
task.wait(0.2)
check("평판 감소", (attr(state, "Hp") or 100) < (hpBefore or 100), attr(state, "Hp"))
GameState.talisman = Config.TalismanMax
rbx.sigOf(remotes.UseTalisman, "OnServerEvent"):Fire(p1, "calm")
check("평온 부적으로 진정", rbx.waitUntil(function()
	return c2 and attr(c2, "Mood") == "calm"
end, 3, "calm 무드"))
check("부적 게이지 초기화", attr(state, "Talisman") == 0)
for _, t in CustomerTypes.List do
	t.speed = 200
end
-- 파손 테스트: 손님을 추가로 불러 화나게 둠 (진정 없이)
local extra = Customers.spawn({ typeId = "dokkaebi", dishes = { "eomuk" }, delay = 0 }, 2, { patienceMult = 0.2, pool = Recipes.dishesForNight(2) })
check("추가 손님 소환", extra ~= nil)
check("조리대 파손", rbx.waitUntil(function()
	for _, part in stations:GetChildren() do
		if attr(part, "Smashed") == true then
			return true
		end
	end
	return false
end, 10, "파손"))
check("파손 복구", rbx.waitUntil(function()
	for _, part in stations:GetChildren() do
		if attr(part, "Smashed") == true then
			return false
		end
	end
	return true
end, 5, "복구"))
check("밤 2 종료 → 낮", waitPhase("day", 15))
readyAll()

-- ---------- 밤 3: 화재·번짐·소화·시간 부적·풍요 부적 ----------
print("== 밤 3: 화재·소화·시간/풍요 부적")
check("밤 3 시작", waitPhase("night", 5) and attr(state, "Night") == 3)
local keeper = Customers.spawn({ typeId = "ghost", dishes = { "ramyeon" }, delay = 0 }, 3, { patienceMult = 6, pool = Recipes.dishesForNight(3) })
local c3 = waitingCustomer(8)
if c3 and c3 ~= keeper.model then
	serveCustomer(p1, c3)
end
rbx.waitUntil(function()
	return attr(keeper.model, "Mood") == "waiting"
end, 8, "지킴이 손님 대기")
local deadlineBefore = attr(keeper.model, "DeadlineAt")
GameState.talisman = Config.TalismanMax
rbx.sigOf(remotes.UseTalisman, "OnServerEvent"):Fire(p2, "time")
task.wait(0.3)
check("시간 부적: 인내심 연장", (attr(keeper.model, "DeadlineAt") or 0) >= (deadlineBefore or 0) + Config.TimeCharmSeconds - 0.01)
GameState.talisman = Config.TalismanMax
rbx.sigOf(remotes.UseTalisman, "OnServerEvent"):Fire(p2, "fortune")
task.wait(0.3)
check("풍요 부적: 배율 시간 설정", (attr(state, "FortuneUntil") or 0) > 0)
-- 냄비에 어묵을 넣고 방치 → 탐 → 발화 → 번짐
make(p1, "eomuk_raw")
local pot = findStation("pot", "idle")
press(pot, p1)
check("탄 음식", rbx.waitUntil(function()
	return attr(pot, "State") == "burnt"
end, 5, "burnt"))
check("발화", rbx.waitUntil(function()
	return attr(pot, "State") == "fire"
end, 5, "fire"))
local hpBeforeFire = attr(state, "Hp")
check("번짐(2곳 이상)", rbx.waitUntil(function()
	local n = 0
	for _, part in stations:GetChildren() do
		if attr(part, "State") == "fire" then
			n += 1
		end
	end
	return n >= 2
end, 6, "번짐"))
task.wait(0.2)
check("번짐 피해", (attr(state, "Hp") or 100) < (hpBeforeFire or 100))
if held(p1) then
	press(findStation("trash"), p1)
end
press(stations.extinguisher1, p1)
check("소화기 들기", held(p1) == "extinguisher")
-- 끄는 동안에도 번지므로 불이 다 꺼질 때까지 반복
local rounds = 0
repeat
	rounds += 1
	local any = false
	for _, part in stations:GetChildren() do
		if attr(part, "State") == "fire" then
			any = true
			press(part, p1)
		end
	end
	task.wait(0.2)
until not any or rounds > 12
check("소화 완료", (function()
	for _, part in stations:GetChildren() do
		if attr(part, "State") == "fire" then
			return false
		end
	end
	return true
end)(), "라운드 " .. rounds)
press(stations.extinguisher1, p1)
check("소화기 반납", held(p1) == nil)
-- 프롬프트 문구·클라이언트 입력 흉내
local pps = rbx.game:GetService("ProximityPromptService")
for _, part in { stations.crate1, stations.board1, stations.combine1, stations.pot1, stations.mallet1, stations.extinguisher1, stations.trash1, keeper.model.HumanoidRootPart } do
	local prompt = part:FindFirstChild("Prompt") or part:FindFirstChild("ServePrompt")
	rbx.sigOf(pps, "PromptShown"):Fire(prompt)
end
task.wait(0.3)
check("프롬프트 문구 맞춤", string.find(stations.crate1.Prompt.ActionText, "꺼내기", 1, true) ~= nil, stations.crate1.Prompt.ActionText)
local uis = rbx.game:GetService("UserInputService")
for _, key in { "R", "B", "C", "R", "B", "C" } do
	rbx.sigOf(uis, "InputBegan"):Fire({ KeyCode = roblox.Enum.KeyCode[key], UserInputType = roblox.Enum.UserInputType.Keyboard }, false)
	task.wait(0.1)
end
check("패널 토글(레시피/상점/옷장)", hud:FindFirstChild("RecipePanel") ~= nil and hud:FindFirstChild("ShopPanel") ~= nil and hud:FindFirstChild("WardrobePanel") ~= nil)
local recipeBtn = findButton("레시피")
if recipeBtn then
	rbx.sigOf(recipeBtn, "MouseButton1Click"):Fire()
	task.wait(0.1)
end
check("레시피 버튼으로 열기", hud.RecipePanel.Visible == true)
serveCustomer(p2, keeper.model)
check("밤 3 종료 → 낮", waitPhase("day", 15))
-- 다음 밤 이벤트를 정전으로 고정 (밤이 시작되기 전에 설정해야 함)
Config.EventChance = 1
for _, e in Events.List do
	e.weight = if e.id == "blackout" then 1 else 0
end
readyAll()

-- ---------- 밤 4: 떡메치기·구미호 변덕·정전 ----------
print("== 밤 4: 떡메·구미호·정전")
check("밤 4 시작", waitPhase("night", 5) and attr(state, "Night") == 4)
check("정전의 밤 이벤트 선택", attr(state, "EventId") == "blackout", attr(state, "EventId"))
local keeper4 = Customers.spawn({ typeId = "ghost", dishes = { "hotteok" }, delay = 0 }, 4, { patienceMult = 8, pool = Recipes.dishesForNight(4) })
local c4 = waitingCustomer(8)
if c4 and c4 ~= keeper4.model then
	serveCustomer(p1, c4)
end
-- 떡메치기
make(p1, "rice")
press(stations.mallet1, p1)
check("떡메: 밥 올림", attr(stations.mallet1, "State") == "pounding")
press(stations.mallet1, p1, 0.2)
press(stations.mallet1, p1, 0.2)
check("떡메: 같은 사람 연속 거부", attr(stations.mallet1, "Hits") == 1, attr(stations.mallet1, "Hits"))
for i = 1, 5 do
	press(stations.mallet1, if i % 2 == 1 then p2 else p1, 0.2)
end
check("떡메: 6번 치면 완성", attr(stations.mallet1, "State") == "done", attr(stations.mallet1, "State"))
press(stations.mallet1, p1)
check("인절미 획득", held(p1) == "injeolmi", held(p1))
press(findStation("trash"), p1)
-- 구미호 변덕
local fox = Customers.spawn({ typeId = "gumiho", dishes = { "eomuk", "ramyeon" }, delay = 0 }, 4, { patienceMult = 1, pool = Recipes.dishesForNight(4) })
rbx.waitUntil(function()
	return attr(fox.model, "Mood") == "waiting"
end, 8, "구미호 대기")
check("구미호 변덕(주문 변경)", rbx.waitUntil(function()
	return (attr(fox.model, "Twist") or 0) > 0
end, 8, "Twist"))
-- 정전
check("정전 발생", rbx.waitUntil(function()
	return attr(state, "Blackout") == true
end, 14, "Blackout"))
check("정전 복구", rbx.waitUntil(function()
	return attr(state, "Blackout") == false
end, 4, "Blackout 해제"))
Config.EventChance = 0
if held(p2) then
	press(findStation("trash"), p2)
end
serveCustomer(p2, keeper4.model)
check("밤 4 종료 → 낮", waitPhase("day", 25))
readyAll()

-- ---------- 밤 5: 보스·유물 투표 ----------
print("== 밤 5: 보스·유물")
check("밤 5 시작", waitPhase("night", 5) and attr(state, "Night") == 5)
local servedBoss = false
dumpCustomers("밤 5 시작 직후")
for _ = 1, 3 do
	local c = waitingCustomer(16)
	if not c then
		break
	end
	local isBoss = attr(c, "Boss") == true
	local ok = serveCustomer(p1, c)
	if isBoss and ok then
		servedBoss = true
	end
	rbx.waitUntil(function()
		return c.Parent == nil or attr(c, "Mood") ~= "waiting"
	end, 5, "손님 처리")
	if phase() ~= "night" then
		break
	end
end
check("보스 서빙", servedBoss)
check("밤 5 종료 → 낮", waitPhase("day", 30))
check("유물 제시", rbx.waitUntil(function()
	return (attr(state, "RelicOffer") or "") ~= ""
end, 3, "RelicOffer"))
task.wait(0.3)
check("유물 투표 패널 표시", hud:FindFirstChild("RelicVote") and hud.RelicVote.Visible == true)
local offer = {}
for id in string.gmatch(attr(state, "RelicOffer") or "", "[^,]+") do
	table.insert(offer, id)
end
rbx.sigOf(remotes.RelicVote, "OnServerEvent"):Fire(p1, 2)
task.wait(0.1)
rbx.sigOf(remotes.RelicVote, "OnServerEvent"):Fire(p2, 2)
task.wait(0.3)
check("전원 투표 즉시 확정", attr(state, "RelicOffer") == "" and attr(state, "Relics") == offer[2], tostring(attr(state, "Relics")) .. " vs " .. tostring(offer[2]))
check("유물 투표 패널 닫힘", rbx.waitUntil(function()
	return hud.RelicVote.Visible == false
end, 2, "패널 닫힘"))
readyAll()

-- ---------- 폐업·리뷰·재시작 ----------
print("== 폐업")
check("밤 6 시작", waitPhase("night", 5) and attr(state, "Night") == 6)
GameState.hp = 0
check("폐업 단계", waitPhase("gameover", 5))
task.wait(0.4)
check("결과 화면 표시", hud:FindFirstChild("Result") and hud.Result.Visible == true)
local resultText = ""
for _, d in hud.Result:GetDescendants() do
	if d:IsA("TextLabel") and string.find(d.Text, "서빙한 요리", 1, true) then
		resultText = d.Text
	end
end
check("결과에 리뷰 포함", string.find(resultText, "손님 리뷰", 1, true) ~= nil, string.sub(resultText, 1, 120))
local saved = rbx.stores["GhostDiner_v1"] and rbx.stores["GhostDiner_v1"]._data["p_1001"]
check("기록 저장(명성·최고 밤)", saved ~= nil and saved.bestNight == 5 and saved.fame >= 100, saved and (saved.bestNight .. "/" .. saved.fame))
check("재시작 → 개장 준비", waitPhase("countdown", 5))
task.wait(0.3)
check("유물·코인 초기화", attr(state, "Relics") == "" and attr(state, "Coins") == 0)
check("결과 화면 닫힘", hud.Result.Visible == false)
for _, fn in rbx.boundToClose do
	local ok, err = pcall(fn)
	check("BindToClose 저장", ok, err)
end

end -- scenario

local okScenario, scenarioErr = xpcall(scenario, rbx.trace)
if not okScenario then
	rbx.record("시나리오 중단: " .. tostring(scenarioErr))
end

-- ---------- 결과 ----------
rbx.stopTicker()
task.wait(0.2)
local passed, failed = 0, 0
for _, r in results do
	if r.ok then
		passed += 1
	else
		failed += 1
	end
end
print(string.format("\n검증 %d개 중 통과 %d, 실패 %d, 런타임 오류 %d, 경고 %d, 트윈 %d", #results, passed, failed, #rbx.errors, #rbx.warnings, rbx.tweensPlayed))
for i, w in rbx.warnings do
	if i <= 15 then
		print("  경고: " .. w)
	end
end
for i, e in rbx.errors do
	if i <= 10 then
		print("  오류: " .. string.sub(e, 1, 600))
	end
end
process.exit(if failed == 0 and #rbx.errors == 0 then 0 else 1)
