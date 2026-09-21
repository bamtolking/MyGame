--!nonstrict
-- Studio 자가 진단 (서버): Studio 에서 플레이/실행하면 실제 엔진에서 벌어지는 일을 90초 동안 지켜보고
-- 출력 창(보기 > 출력)에 "[자가진단]" 줄과 마지막 요약을 남깁니다. 게시된 게임에서는 아무것도 하지 않습니다.
local RunService = game:GetService("RunService")
if not RunService:IsStudio() then
	return
end
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ScriptContext = game:GetService("ScriptContext")

local Config = require(ReplicatedStorage.GhostDiner.Config)

local DURATION = Config.SelfTestDuration or 90
local results = {}
local errors = {}
local startClock = os.clock()

local function log(text: string)
	print("[자가진단] " .. text)
end
local function mark(name: string, ok: boolean, detail: any?)
	table.insert(results, { name = name, ok = ok, detail = detail })
	log((if ok then "✅ " else "❌ ") .. name .. (if detail ~= nil then " — " .. tostring(detail) else ""))
end
local function info(name: string, detail: any?)
	table.insert(results, { name = name, ok = nil, detail = detail })
	log("ℹ️ " .. name .. (if detail ~= nil then " — " .. tostring(detail) else ""))
end
local function waitFor(cond: () -> boolean, timeout: number): boolean
	local deadline = os.clock() + timeout
	while os.clock() < deadline do
		local ok, v = pcall(cond)
		if ok and v then
			return true
		end
		task.wait(0.1)
	end
	return false
end
local function elapsed(): string
	return string.format("%.1f초", os.clock() - startClock)
end

pcall(function()
	ScriptContext.Error:Connect(function(message, trace, scriptInstance)
		table.insert(errors, { message = tostring(message), trace = tostring(trace), script = if scriptInstance then scriptInstance:GetFullName() else "?" })
		log("⚠️ 서버 스크립트 오류: " .. tostring(message))
	end)
end)

local function summary()
	log("================ 자가진단 요약 (서버) — 이 부분을 복사해서 보내 주세요 ================")
	local pass, fail = 0, 0
	for _, r in results do
		if r.ok == true then
			pass += 1
		elseif r.ok == false then
			fail += 1
		end
		log((if r.ok == true then "✅ " elseif r.ok == false then "❌ " else "ℹ️ ") .. r.name .. (if r.detail ~= nil then " — " .. tostring(r.detail) else ""))
	end
	log(string.format("통과 %d · 실패 %d · 서버 스크립트 오류 %d건 · 버전 %s", pass, fail, #errors, Config.Version))
	for i, e in errors do
		if i <= 10 then
			log("  오류: " .. e.script .. ": " .. e.message)
		end
	end
	log("========================================================================")
end

task.spawn(function()
	local ok, err = pcall(function()
		log("시작 — " .. (if RunService:IsRunMode() then "실행(Run) 모드: 플레이어 없이 무인 시연" else "플레이 모드"))

		-- 1. 지도·상태
		local map = workspace:WaitForChild("GhostDinerMap", 20)
		mark("지도 생성", map ~= nil, elapsed())
		if not map then
			return
		end
		local stations = map:WaitForChild("Stations", 5)
		local stationCount = if stations then #stations:GetChildren() else 0
		mark("조리대 28개", stationCount == 28, stationCount)
		local customersFolder = map:WaitForChild("Customers", 5)
		local state = ReplicatedStorage:WaitForChild("GhostDinerState", 10)
		mark("상태 폴더·리모트", state ~= nil and ReplicatedStorage:FindFirstChild("GhostDinerRemotes") ~= nil)
		if not state or not stations or not customersFolder then
			return
		end

		-- 2. 플레이어 (플레이 모드일 때)
		local player = Players:GetPlayers()[1]
		if not player then
			waitFor(function()
				player = Players:GetPlayers()[1]
				return player ~= nil
			end, 8)
		end
		if player then
			mark("플레이어 입장", true, player.Name)
			local character = player.Character
			if not character then
				waitFor(function()
					character = player.Character
					return character ~= nil
				end, 15)
			end
			local humanoid = character and character:WaitForChild("Humanoid", 10)
			mark("캐릭터 생성", humanoid ~= nil)
			task.wait(1.5)
			if humanoid then
				mark("이동 속도 설정", humanoid.WalkSpeed == Config.BaseWalkSpeed, humanoid.WalkSpeed)
			end
			local root = character and character:FindFirstChild("HumanoidRootPart")
			mark("충돌 그룹 Players", root ~= nil and root.CollisionGroup == "Players", root and root.CollisionGroup)
			local hat = player:GetAttribute("Hat")
			if hat and hat ~= "none" then
				mark("모자 착용", waitFor(function()
					return character:FindFirstChild("GhostDinerHat") ~= nil
				end, 6), hat)
			end
		else
			info("플레이어 없음 (실행 모드면 정상)")
		end

		-- 3. 단계 진행
		mark("개장 준비 단계", waitFor(function()
			return state:GetAttribute("Phase") == "countdown" or state:GetAttribute("Phase") == "night"
		end, 15), elapsed())
		mark("밤 1 시작", waitFor(function()
			return state:GetAttribute("Phase") == "night"
		end, Config.StartCountdown + 15), elapsed())

		-- 4. 첫 손님: 실제 물리로 걸어오는지
		local first = customersFolder:GetChildren()[1]
		if not first then
			waitFor(function()
				first = customersFolder:GetChildren()[1]
				return first ~= nil
			end, 15)
		end
		mark("첫 손님 소환", first ~= nil, first and first.Name)
		if first then
			local root = first:WaitForChild("HumanoidRootPart", 5)
			mark("손님 Humanoid", first:FindFirstChildOfClass("Humanoid") ~= nil)
			if root then
				local startZ = root.Position.Z
				local moved = waitFor(function()
					return root.Parent ~= nil and root.Position.Z < startZ - 10
				end, 10)
				mark("손님 이동(물리·MoveTo)", moved, string.format("Z %.0f → %.0f", startZ, root.Position.Z))
				local tArrive = os.clock()
				local arrived = waitFor(function()
					return first:GetAttribute("Mood") == "waiting"
				end, 45)
				mark("손님 카운터 도착", arrived, string.format("%.1f초 걸림", os.clock() - tArrive))
				if arrived then
					local y = root.Position.Y
					mark("손님이 떠 있음 (높이 0.5~6)", y > 0.5 and y < 6, string.format("Y=%.2f", y))
					mark("서빙 프롬프트 활성", root:FindFirstChild("ServePrompt") ~= nil and root.ServePrompt.Enabled == true)
				end
				-- 결과: 서빙(성불) 또는 방치(악귀)
				waitFor(function()
					local m = first:GetAttribute("Mood")
					return m == "happy" or m == "ascend" or m == "angry" or first.Parent == nil
				end, 90)
				local mood = first:GetAttribute("Mood")
				if mood == "happy" or mood == "ascend" then
					mark("서빙 성공 → 성불 후 사라짐", waitFor(function()
						return first.Parent == nil
					end, 10), "직접 서빙하셨네요!")
				elseif mood == "angry" then
					info("서빙하지 않아 악귀가 됨 (정상)")
					mark("난동: 조리대 파손", waitFor(function()
						for _, s in stations:GetChildren() do
							if s:GetAttribute("Smashed") == true then
								return true
							end
						end
						return false
					end, 25))
					mark("악귀 퇴장", waitFor(function()
						return first.Parent == nil
					end, 30))
				else
					mark("손님 결과 (서빙 또는 악귀화)", false, tostring(mood))
				end
			end
		end

		-- 5. 사용 흔적 (있으면 표시)
		local cookedSeen = false
		for _, s in stations:GetChildren() do
			local st = s:GetAttribute("State")
			if st == "cooking" or st == "done" or st == "burnt" then
				cookedSeen = true
			end
		end
		info("조리대 사용 감지", if cookedSeen then "예" else "아직 없음 (재료를 냄비에 넣어 보세요)")
		info("현재 단계 / 밤 / 평판 / 코인", string.format("%s / %s / %s / %s", tostring(state:GetAttribute("Phase")), tostring(state:GetAttribute("Night")), tostring(state:GetAttribute("Hp")), tostring(state:GetAttribute("Coins"))))
	end)
	if not ok then
		mark("자가진단 자체 오류", false, tostring(err))
	end
	local remain = DURATION - (os.clock() - startClock)
	if remain > 0 then
		task.wait(remain)
	end
	summary()
end)
