--!nonstrict
-- Studio 자가 진단 (클라이언트): HUD·라벨·프롬프트·연출이 실제로 만들어지는지 지켜보고 출력 창에 요약을 남깁니다.
local RunService = game:GetService("RunService")
if not RunService:IsStudio() then
	return
end
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ScriptContext = game:GetService("ScriptContext")
local ProximityPromptService = game:GetService("ProximityPromptService")

local DURATION = 90
local results = {}
local errors = {}
local startClock = os.clock()
local promptsShown = 0

local function log(text: string)
	print("[자가진단 클라] " .. text)
end
local function mark(name: string, ok: boolean, detail: any?)
	table.insert(results, { name = name, ok = ok, detail = detail })
	log((if ok then "✅ " else "❌ ") .. name .. (if detail ~= nil then " — " .. tostring(detail) else ""))
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

pcall(function()
	ScriptContext.Error:Connect(function(message, trace, scriptInstance)
		table.insert(errors, { message = tostring(message), script = if scriptInstance then scriptInstance:GetFullName() else "?" })
		log("⚠️ 클라이언트 스크립트 오류: " .. tostring(message))
	end)
	ProximityPromptService.PromptShown:Connect(function()
		promptsShown += 1
	end)
end)

task.spawn(function()
	local ok, err = pcall(function()
		local player = Players.LocalPlayer
		local playerGui = player:WaitForChild("PlayerGui", 10)
		local hud = playerGui and playerGui:WaitForChild("GhostDinerHud", 15)
		mark("HUD 생성", hud ~= nil)
		mark("연출 레이어 생성", playerGui and playerGui:FindFirstChild("GhostDinerFxUnder") ~= nil and playerGui:FindFirstChild("GhostDinerFxOver") ~= nil)
		local state = ReplicatedStorage:WaitForChild("GhostDinerState", 10)
		local map = workspace:WaitForChild("GhostDinerMap", 20)
		if not hud or not state or not map then
			return
		end
		local stations = map:WaitForChild("Stations", 5)
		mark("조리대 라벨 생성", waitFor(function()
			local n = 0
			for _, s in stations:GetChildren() do
				if s:FindFirstChild("StationLabel") then
					n += 1
				end
			end
			return n >= 20
		end, 10))
		mark("밤 1 HUD 표시", waitFor(function()
			local top = hud:FindFirstChild("Top")
			local night = top and top:FindFirstChild("Night")
			return night ~= nil and string.find(night.Text, "1번째 밤", 1, true) ~= nil
		end, 40))
		local customers = map:WaitForChild("Customers", 5)
		local first = nil
		waitFor(function()
			first = customers:GetChildren()[1]
			return first ~= nil
		end, 20)
		if first then
			mark("손님 라벨 생성", waitFor(function()
				local root = first:FindFirstChild("HumanoidRootPart")
				return root ~= nil and root:FindFirstChild("CustomerLabel") ~= nil
			end, 8))
			mark("주문 목록 표시", waitFor(function()
				local orders = hud:FindFirstChild("Orders")
				if not orders then
					return false
				end
				for _, c in orders:GetChildren() do
					if c:IsA("Frame") and c.Visible then
						return true
					end
				end
				return false
			end, 45))
		end
		mark("프롬프트 표시 경험", waitFor(function()
			return promptsShown > 0
		end, 60), if promptsShown > 0 then promptsShown .. "회" else "조리대나 손님 가까이 가 보세요")
	end)
	if not ok then
		mark("자가진단(클라) 자체 오류", false, tostring(err))
	end
	local remain = DURATION - (os.clock() - startClock)
	if remain > 0 then
		task.wait(remain)
	end
	log("================ 자가진단 요약 (클라이언트) — 이 부분도 함께 보내 주세요 ================")
	local pass, fail = 0, 0
	for _, r in results do
		if r.ok then
			pass += 1
		else
			fail += 1
		end
		log((if r.ok then "✅ " else "❌ ") .. r.name .. (if r.detail ~= nil then " — " .. tostring(r.detail) else ""))
	end
	log(string.format("통과 %d · 실패 %d · 클라이언트 스크립트 오류 %d건", pass, fail, #errors))
	for i, e in errors do
		if i <= 10 then
			log("  오류: " .. e.script .. ": " .. e.message)
		end
	end
	log("==========================================================================")
end)
