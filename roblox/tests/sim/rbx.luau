--!nonstrict
-- Lune(https://lune-org.github.io/docs) 위에서 로블록스 서버·클라이언트 스크립트를 그대로 실행하기 위한 흉내 환경.
-- 진짜 Roblox 가 아니므로 물리·렌더링·복제는 없고, 게임 코드가 쓰는 신호·서비스·메서드만 최소한으로 구현합니다.
-- 인스턴스 트리·속성 검증·데이터타입(CFrame, Vector3, Color3, UDim2 …)은 Lune 의 roblox 라이브러리(rbx-dom)가 담당합니다.
local roblox = require("@lune/roblox")
local luau = require("@lune/luau")
local task = require("@lune/task")
local fs = require("@lune/fs")
local Instance = roblox.Instance

local M = {}
M.errors = {}
M.warnings = {}
M.players = {}
M.localPlayer = nil
M.boundToClose = {}
M.time0 = os.clock()

local function record(err)
	table.insert(M.errors, tostring(err))
	print("[SIM ERROR] " .. tostring(err))
end
M.record = record

-- 오류 값이 문자열이 아니어도(userdata 등) 추적을 만들 수 있는 핸들러
local function trace(e)
	local msg = tostring(e)
	local ok, tb = pcall(debug.traceback, msg, 2)
	return if ok then tb else msg
end
M.trace = trace

-- ---------- 신호 ----------
local Signal = {}
Signal.__index = Signal
function Signal.new(name)
	return setmetatable({ _h = {}, _name = name }, Signal)
end
function Signal:Connect(fn)
	local h = { fn = fn }
	table.insert(self._h, h)
	return { Disconnect = function()
		h.dead = true
	end, Connected = true }
end
function Signal:Once(fn)
	local h = { fn = fn, once = true }
	table.insert(self._h, h)
	return { Disconnect = function()
		h.dead = true
	end }
end
function Signal:Wait()
	local co = coroutine.running()
	self:Once(function(...)
		task.spawn(co, ...)
	end)
	return coroutine.yield()
end
function Signal:Fire(...)
	local args = table.pack(...)
	for _, h in table.clone(self._h) do
		if not h.dead then
			if h.once then
				h.dead = true
			end
			task.spawn(function()
				local ok, err = xpcall(h.fn, trace, table.unpack(args, 1, args.n))
				if not ok then
					record(err)
				end
			end)
		end
	end
	for i = #self._h, 1, -1 do
		if self._h[i].dead then
			table.remove(self._h, i)
		end
	end
end
M.Signal = Signal

-- Lune 은 같은 인스턴스라도 접근할 때마다 새 userdata 를 주므로, 테이블 키로는 GetDebugId() 를 씁니다.
local function idOf(inst)
	return inst:GetDebugId()
end
M.idOf = idOf

local signals = {}
local function sigOf(inst, name)
	local id = idOf(inst)
	local t = signals[id]
	if not t then
		t = {}
		signals[id] = t
	end
	local s = t[name]
	if not s then
		s = Signal.new(name)
		t[name] = s
	end
	return s
end
M.sigOf = sigOf

-- 속성/자식 변화 감시(폴링)
local attrWatch = {} -- id → { inst, snap }
local childWatch = {} -- id → { inst, set }
local descWatch = {} -- id → { inst, set }
local function cleanAttrs(t)
	local out = {}
	for k, v in t do
		if k ~= "__sim" then
			out[k] = v
		end
	end
	return out
end
local function childSet(list)
	local set = {}
	for _, c in list do
		set[idOf(c)] = c
	end
	return set
end

local EVENTS = {
	"ChildAdded", "ChildRemoved", "DescendantAdded", "DescendantRemoving", "AttributeChanged", "Changed", "AncestryChanged", "Destroying",
	"Triggered", "PromptButtonHoldBegan", "PromptButtonHoldEnded", "OnServerEvent", "OnClientEvent", "PlayerAdded", "PlayerRemoving",
	"CharacterAdded", "CharacterRemoving", "Heartbeat", "RenderStepped", "Stepped", "PromptShown", "PromptHidden", "InputBegan", "InputEnded",
	"Ended", "Played", "MouseButton1Click", "Activated", "Died", "Touched", "Completed",
}
for _, name in EVENTS do
	roblox.implementProperty("Instance", name, function(self)
		local id = idOf(self)
		if name == "AttributeChanged" then
			attrWatch[id] = attrWatch[id] or { inst = self, snap = cleanAttrs(self:GetAttributes()) }
		elseif name == "ChildAdded" or name == "ChildRemoved" then
			childWatch[id] = childWatch[id] or { inst = self, set = childSet(self:GetChildren()) }
		elseif name == "DescendantAdded" then
			descWatch[id] = descWatch[id] or { inst = self, set = childSet(self:GetDescendants()) }
		end
		return sigOf(self, name)
	end, function() end)
end

-- ---------- Instance 메서드 ----------
roblox.implementMethod("Instance", "WaitForChild", function(self, name, timeout)
	local deadline = os.clock() + (timeout or 10)
	while true do
		local c = self:FindFirstChild(name)
		if c then
			return c
		end
		if os.clock() > deadline then
			if not timeout then
				table.insert(M.warnings, "WaitForChild 시간 초과: " .. tostring(self) .. "." .. tostring(name))
			end
			return nil
		end
		task.wait(0.03)
	end
end)
roblox.implementMethod("Instance", "GetAttributeChangedSignal", function(self, name)
	local id = idOf(self)
	attrWatch[id] = attrWatch[id] or { inst = self, snap = cleanAttrs(self:GetAttributes()) }
	return sigOf(self, "Attr:" .. name)
end)
roblox.implementMethod("Instance", "GetPropertyChangedSignal", function(self, name)
	return sigOf(self, "Prop:" .. name)
end)
roblox.implementMethod("Instance", "SetNetworkOwner", function() end)
roblox.implementMethod("Instance", "GetNetworkOwner", function()
	return nil
end)
roblox.implementMethod("Instance", "Emit", function() end)
roblox.implementMethod("Instance", "Play", function() end)
roblox.implementMethod("Instance", "Stop", function() end)
roblox.implementMethod("Instance", "Pause", function() end)
roblox.implementMethod("Instance", "Cancel", function() end)

-- Lune 에서는 Position 이 CFrame 에서 파생되지 않아, CFrame 을 바꿀 때 Position 도 같이 맞춥니다.
local function setCF(part, cf)
	part.CFrame = cf
	part.Position = cf.Position
end
M.setCF = setCF

local function modelPivot(model)
	local pp = model.PrimaryPart
	if pp then
		return pp.CFrame
	end
	return model.WorldPivot
end
roblox.implementMethod("Instance", "GetPivot", function(self)
	if self:IsA("BasePart") then
		return self.CFrame
	end
	return modelPivot(self)
end)
roblox.implementMethod("Instance", "PivotTo", function(self, cf)
	if self:IsA("BasePart") then
		setCF(self, cf)
		return
	end
	local current = modelPivot(self)
	local delta = cf * current:Inverse()
	for _, p in self:GetDescendants() do
		if p:IsA("BasePart") then
			setCF(p, delta * p.CFrame)
		end
	end
	self.WorldPivot = cf
end)

-- Humanoid
M.moveTargets = {} -- id → { humanoid, target }
roblox.implementMethod("Humanoid", "MoveTo", function(self, pos)
	M.moveTargets[idOf(self)] = { humanoid = self, target = pos }
end)
roblox.implementMethod("Humanoid", "EquipTool", function(self, tool)
	local character = self.Parent
	if character and tool then
		tool.Parent = character
	end
end)
roblox.implementMethod("Humanoid", "UnequipTools", function() end)
roblox.implementMethod("Humanoid", "SetStateEnabled", function() end)
roblox.implementMethod("Humanoid", "ChangeState", function() end)

-- 서비스
roblox.implementMethod("DataModel", "BindToClose", function(self, fn)
	table.insert(M.boundToClose, fn)
end)
roblox.implementMethod("Workspace", "GetServerTimeNow", function()
	return os.clock() - M.time0 + 1000
end)
local camera = Instance.new("Camera")
camera.Name = "Camera"
roblox.implementProperty("Workspace", "CurrentCamera", function()
	return camera
end, function() end)
roblox.implementMethod("PhysicsService", "RegisterCollisionGroup", function() end)
roblox.implementMethod("PhysicsService", "CollisionGroupSetCollidable", function() end)
roblox.implementMethod("Players", "GetPlayers", function()
	return table.clone(M.players)
end)
roblox.implementMethod("Players", "GetPlayerByUserId", function(self, id)
	for _, p in M.players do
		if p.UserId == id then
			return p
		end
	end
	return nil
end)
roblox.implementMethod("Players", "GetNameFromUserIdAsync", function(self, id)
	return "User" .. tostring(id)
end)
roblox.implementProperty("Players", "LocalPlayer", function()
	return M.localPlayer
end, function() end)
roblox.implementMethod("RunService", "IsStudio", function()
	return true
end)
roblox.implementMethod("RunService", "IsServer", function()
	return true
end)
roblox.implementMethod("RunService", "IsClient", function()
	return true
end)
M.renderSteps = {}
roblox.implementMethod("RunService", "BindToRenderStep", function(self, name, prio, fn)
	M.renderSteps[name] = fn
end)
roblox.implementMethod("RunService", "UnbindFromRenderStep", function(self, name)
	M.renderSteps[name] = nil
end)
roblox.implementMethod("StarterGui", "SetCoreGuiEnabled", function() end)
roblox.implementMethod("SoundService", "PlayLocalSound", function() end)

-- TweenService: Play 하면 목표값을 바로 적용 (반복 트윈은 첫 목표값만)
M.tweensPlayed = 0
roblox.implementMethod("TweenService", "Create", function(self, inst, info, props)
	local tween = { Completed = Signal.new("Completed") }
	function tween:Play()
		M.tweensPlayed += 1
		for k, v in props do
			local ok, err = pcall(function()
				if k == "CFrame" and inst:IsA("BasePart") then
					setCF(inst, v)
				else
					(inst :: any)[k] = v
				end
			end)
			if not ok then
				record("Tween 속성 적용 실패 " .. tostring(inst) .. "." .. tostring(k) .. ": " .. tostring(err))
			end
		end
		self.Completed:Fire()
	end
	function tween:Cancel() end
	function tween:Pause() end
	return tween
end)

-- 리모트
local invokes = {}
roblox.implementProperty("RemoteFunction", "OnServerInvoke", function(self)
	return invokes[idOf(self)]
end, function(self, fn)
	invokes[idOf(self)] = fn
end)
roblox.implementMethod("RemoteFunction", "InvokeServer", function(self, ...)
	local fn = invokes[idOf(self)]
	if not fn then
		error("OnServerInvoke 미설정: " .. self.Name)
	end
	return fn(M.localPlayer, ...)
end)
roblox.implementMethod("RemoteEvent", "FireAllClients", function(self, ...)
	sigOf(self, "OnClientEvent"):Fire(...)
end)
roblox.implementMethod("RemoteEvent", "FireClient", function(self, player, ...)
	sigOf(self, "OnClientEvent"):Fire(...)
end)
roblox.implementMethod("RemoteEvent", "FireServer", function(self, ...)
	sigOf(self, "OnServerEvent"):Fire(M.localPlayer, ...)
end)

-- DataStore (메모리)
local stores = {}
local function fakeStore()
	local data = {}
	local s = { _data = data }
	function s:GetAsync(key)
		return data[key]
	end
	function s:SetAsync(key, v)
		data[key] = v
	end
	function s:UpdateAsync(key, fn)
		local nv = fn(data[key])
		if nv ~= nil then
			data[key] = nv
		end
		return nv
	end
	return s
end
local function fakeOrdered()
	local data = {}
	local s = { _data = data }
	function s:SetAsync(key, v)
		data[key] = v
	end
	function s:GetSortedAsync(asc, n)
		local arr = {}
		for k, v in data do
			table.insert(arr, { key = k, value = v })
		end
		table.sort(arr, function(a, b)
			if asc then
				return a.value < b.value
			end
			return a.value > b.value
		end)
		local page = {}
		for i = 1, math.min(n, #arr) do
			page[i] = arr[i]
		end
		return { GetCurrentPage = function()
			return page
		end }
	end
	return s
end
roblox.implementMethod("DataStoreService", "GetDataStore", function(self, name)
	stores[name] = stores[name] or fakeStore()
	return stores[name]
end)
roblox.implementMethod("DataStoreService", "GetOrderedDataStore", function(self, name)
	stores["ordered:" .. name] = stores["ordered:" .. name] or fakeOrdered()
	return stores["ordered:" .. name]
end)
M.stores = stores

-- ---------- 전역 환경 ----------
local RandomShim = {}
RandomShim.__index = RandomShim
function RandomShim.new(seed)
	local s = math.floor(((seed or os.clock() * 1000) * 7919 + 12345) % 2147483647)
	local self = setmetatable({ state = s }, RandomShim)
	for _ = 1, 5 do
		self:_step()
	end
	return self
end
function RandomShim:_step()
	self.state = (self.state * 48271) % 2147483647
	return self.state
end
function RandomShim:NextNumber(a, b)
	local v = self:_step() / 2147483647
	if a and b then
		return a + (b - a) * v
	end
	return v
end
function RandomShim:NextInteger(a, b)
	return a + (self:_step() % (b - a + 1))
end

local TweenInfoShim = {
	new = function(t, style, dir, rep, rev, delay)
		return { Time = t or 1, EasingStyle = style, EasingDirection = dir, RepeatCount = rep or 0, Reverses = rev or false, DelayTime = delay or 0 }
	end,
}

local taskShim = {}
function taskShim.wait(t)
	return task.wait(t)
end
function taskShim.spawn(fn, ...)
	if type(fn) == "thread" then
		return task.spawn(fn, ...)
	end
	return task.spawn(function(...)
		local ok, err = xpcall(fn, trace, ...)
		if not ok then
			record(err)
		end
	end, ...)
end
function taskShim.delay(t, fn, ...)
	return task.delay(t, function(...)
		local ok, err = xpcall(fn, trace, ...)
		if not ok then
			record(err)
		end
	end, ...)
end
function taskShim.defer(fn, ...)
	if type(fn) == "thread" then
		return task.defer(fn, ...)
	end
	return task.defer(function(...)
		local ok, err = xpcall(fn, trace, ...)
		if not ok then
			record(err)
		end
	end, ...)
end
function taskShim.cancel(th)
	task.cancel(th)
end

M.game = Instance.new("DataModel")
M.workspace = M.game:GetService("Workspace")

local pathOf = {}
local sourceOf = {} -- .rbxlx 에서 올린 경우 Source 문자열
local cache = {}
local loading = {}

local baseEnv = {
	game = M.game,
	workspace = M.workspace,
	Instance = Instance,
	Enum = roblox.Enum,
	CFrame = roblox.CFrame,
	Vector3 = roblox.Vector3,
	Vector2 = roblox.Vector2,
	Color3 = roblox.Color3,
	UDim = roblox.UDim,
	UDim2 = roblox.UDim2,
	NumberRange = roblox.NumberRange,
	NumberSequence = roblox.NumberSequence,
	NumberSequenceKeypoint = roblox.NumberSequenceKeypoint,
	ColorSequence = roblox.ColorSequence,
	ColorSequenceKeypoint = roblox.ColorSequenceKeypoint,
	BrickColor = roblox.BrickColor,
	Font = roblox.Font,
	TweenInfo = TweenInfoShim,
	Random = RandomShim,
	task = taskShim,
	print = print,
	warn = function(...)
		local parts = {}
		for _, v in { ... } do
			table.insert(parts, tostring(v))
		end
		table.insert(M.warnings, table.concat(parts, " "))
		print("[warn] " .. table.concat(parts, " "))
	end,
	error = error,
	assert = assert,
	pcall = pcall,
	xpcall = xpcall,
	typeof = typeof,
	type = type,
	tostring = tostring,
	tonumber = tonumber,
	ipairs = ipairs,
	pairs = pairs,
	next = next,
	select = select,
	unpack = unpack,
	table = table,
	string = string,
	math = math,
	os = os,
	utf8 = utf8,
	coroutine = coroutine,
	setmetatable = setmetatable,
	getmetatable = getmetatable,
	rawget = rawget,
	rawset = rawset,
	rawequal = rawequal,
	tick = os.clock,
	time = os.clock,
	debug = debug,
}
M.baseEnv = baseEnv

function M.requireInstance(inst)
	local id = idOf(inst)
	if cache[id] ~= nil then
		return cache[id]
	end
	local path = pathOf[id]
	local source = sourceOf[id]
	if not path and not source then
		error("require 대상이 모듈이 아님: " .. tostring(inst))
	end
	if loading[id] then
		error("순환 require: " .. tostring(path or inst.Name))
	end
	loading[id] = true
	source = source or fs.readFile(path)
	local env = M.makeEnv(inst)
	local fn = luau.load(source, { debugName = inst.Name, environment = env })
	local result = fn()
	loading[id] = nil
	cache[id] = if result == nil then false else result
	return result
end

-- Lune 의 luau.load 는 환경 테이블의 메타테이블을 보지 않으므로 항목을 직접 복사합니다.
function M.makeEnv(inst)
	local env = {}
	for k, v in baseEnv do
		env[k] = v
	end
	env.script = inst
	env.require = function(x)
		if type(x) == "string" then
			error("문자열 require 미지원: " .. x)
		end
		return M.requireInstance(x)
	end
	return env
end

function M.runScript(inst)
	local id = idOf(inst)
	local source = sourceOf[id] or fs.readFile(pathOf[id])
	local env = M.makeEnv(inst)
	local fn = luau.load(source, { debugName = inst.Name, environment = env })
	local ok, err = xpcall(fn, trace)
	if not ok then
		record("스크립트 " .. inst.Name .. " 실패: " .. tostring(err))
	end
	return ok
end

-- 프로젝트 폴더를 인스턴스 트리로 올림 (default.project.json 과 같은 배치)
function M.mountProject(root)
	local rs = M.game:GetService("ReplicatedStorage")
	local sss = M.game:GetService("ServerScriptService")
	local sp = M.game:GetService("StarterPlayer")
	local sps = Instance.new("StarterPlayerScripts")
	sps.Name = "StarterPlayerScripts"
	sps.Parent = sp
	local function mount(dir, parent, folderName)
		local folder = Instance.new("Folder")
		folder.Name = folderName
		folder.Parent = parent
		local mains = {}
		for _, file in fs.readDir(dir) do
			if string.sub(file, -5) == ".luau" then
				local base = string.sub(file, 1, -6)
				local inst
				if string.sub(base, -7) == ".server" then
					inst = Instance.new("Script")
					inst.Name = string.sub(base, 1, -8)
					mains[#mains + 1] = inst
				elseif string.sub(base, -7) == ".client" then
					inst = Instance.new("LocalScript")
					inst.Name = string.sub(base, 1, -8)
					mains[#mains + 1] = inst
				else
					inst = Instance.new("ModuleScript")
					inst.Name = base
				end
				inst.Parent = folder
				pathOf[idOf(inst)] = dir .. "/" .. file
			end
		end
		return folder, mains[1]
	end
	local shared = mount(root .. "/src/shared", rs, "GhostDiner")
	local serverFolder, serverMain = mount(root .. "/src/server", sss, "GhostDinerServer")
	local clientFolder, clientMain = mount(root .. "/src/client", sps, "GhostDinerClient")
	return { shared = shared, server = serverFolder, serverMain = serverMain, client = clientFolder, clientMain = clientMain }
end

-- 빌드된 .rbxlx 를 열어 그 안의 스크립트 Source 로 실행 (배포 산출물 검증용)
function M.mountPlace(path)
	local dm = roblox.deserializePlace(fs.readFile(path))
	M.game = dm
	M.workspace = dm:GetService("Workspace")
	baseEnv.game = dm
	baseEnv.workspace = M.workspace
	local function register(folder)
		local main = nil
		for _, inst in folder:GetChildren() do
			if inst:IsA("LuaSourceContainer") then
				sourceOf[idOf(inst)] = inst.Source
				if inst:IsA("Script") then
					main = inst
				end
			end
		end
		return main
	end
	local shared = dm:GetService("ReplicatedStorage"):FindFirstChild("GhostDiner")
	local serverFolder = dm:GetService("ServerScriptService"):FindFirstChild("GhostDinerServer")
	local sps = dm:GetService("StarterPlayer"):FindFirstChild("StarterPlayerScripts")
	local clientFolder = sps and sps:FindFirstChild("GhostDinerClient")
	assert(shared and serverFolder and clientFolder, "rbxlx 에 GhostDiner 폴더가 없음")
	register(shared)
	local serverMain = register(serverFolder)
	local clientMain = register(clientFolder)
	return { shared = shared, server = serverFolder, serverMain = serverMain, client = clientFolder, clientMain = clientMain, dataModel = dm }
end

-- ---------- 플레이어 ----------
function M.addPlayer(name, userId, spawnPos)
	local player = Instance.new("Player")
	player.Name = name
	player.UserId = userId
	player.DisplayName = name
	local backpack = Instance.new("Backpack")
	backpack.Parent = player
	local pg = Instance.new("PlayerGui")
	pg.Parent = player
	local character = Instance.new("Model")
	character.Name = name
	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = roblox.Vector3.new(2, 2, 1)
	setCF(root, roblox.CFrame.new(spawnPos or roblox.Vector3.new(-30, 3, -8)))
	root.Parent = character
	local head = Instance.new("Part")
	head.Name = "Head"
	head.Size = roblox.Vector3.new(2, 1, 1)
	setCF(head, root.CFrame * roblox.CFrame.new(0, 1.5, 0))
	head.Parent = character
	local humanoid = Instance.new("Humanoid")
	humanoid.Health = 100
	humanoid.MaxHealth = 100
	humanoid.WalkSpeed = 16
	humanoid.Parent = character
	character.PrimaryPart = root
	player.Character = character
	player.Parent = M.game:GetService("Players")
	character.Parent = M.workspace
	table.insert(M.players, player)
	if not M.localPlayer then
		M.localPlayer = player
		pcall(function()
			M.game:GetService("Players").LocalPlayer = player -- 네이티브 속성이라 implementProperty 보다 우선함
		end)
	end
	sigOf(M.game:GetService("Players"), "PlayerAdded"):Fire(player)
	sigOf(player, "CharacterAdded"):Fire(character)
	return player
end

-- ---------- 틱 ----------
local running = false
function M.startTicker(dt)
	dt = dt or 0.05
	running = true
	local rs = M.game:GetService("RunService")
	task.spawn(function()
		local last = os.clock()
		while running do
			local nowT = os.clock()
			local real = nowT - last
			last = nowT
			local okTick, errTick = xpcall(function()
			-- 손님 이동 흉내
			for id, mv in M.moveTargets do
				local humanoid, target = mv.humanoid, mv.target
				local okP, model = pcall(function()
					return humanoid.Parent
				end)
				local root = okP and model and model:FindFirstChild("HumanoidRootPart")
				if root and root:IsA("BasePart") then
					local pos = root.CFrame.Position
					local flatTarget = roblox.Vector3.new(target.X, pos.Y, target.Z)
					local dist = (flatTarget - pos).Magnitude
					local step = humanoid.WalkSpeed * real
					if dist <= step or dist < 0.5 then
						setCF(root, roblox.CFrame.new(flatTarget))
						M.moveTargets[id] = nil
					else
						setCF(root, roblox.CFrame.lookAt(pos + (flatTarget - pos).Unit * step, flatTarget))
					end
				else
					M.moveTargets[id] = nil
				end
			end
			-- 속성 변화
			for _, w in attrWatch do
				local ok, current = pcall(function()
					return cleanAttrs(w.inst:GetAttributes())
				end)
				if ok then
					for k, v in current do
						if w.snap[k] ~= v then
							sigOf(w.inst, "Attr:" .. k):Fire()
							sigOf(w.inst, "AttributeChanged"):Fire(k)
						end
					end
					for k in w.snap do
						if current[k] == nil then
							sigOf(w.inst, "Attr:" .. k):Fire()
							sigOf(w.inst, "AttributeChanged"):Fire(k)
						end
					end
					w.snap = current
				end
			end
			-- 자식 변화
			for _, w in childWatch do
				local ok, children = pcall(function()
					return w.inst:GetChildren()
				end)
				if ok then
					local newSet = childSet(children)
					for cid, c in newSet do
						if not w.set[cid] then
							sigOf(w.inst, "ChildAdded"):Fire(c)
						end
					end
					for cid, c in w.set do
						if not newSet[cid] then
							sigOf(w.inst, "ChildRemoved"):Fire(c)
						end
					end
					w.set = newSet
				end
			end
			for _, w in descWatch do
				local ok, list = pcall(function()
					return w.inst:GetDescendants()
				end)
				if ok then
					local newSet = childSet(list)
					for cid, c in newSet do
						if not w.set[cid] then
							sigOf(w.inst, "DescendantAdded"):Fire(c)
						end
					end
					w.set = newSet
				end
			end
			sigOf(rs, "Heartbeat"):Fire(real)
			sigOf(rs, "Stepped"):Fire(os.clock(), real)
			sigOf(rs, "RenderStepped"):Fire(real)
			for _, fn in M.renderSteps do
				local ok, err = xpcall(fn, trace, real)
				if not ok then
					record(err)
				end
			end
			end, trace)
			if not okTick then
				record("틱 오류: " .. tostring(errTick))
			end
			task.wait(dt)
		end
	end)
end
function M.stopTicker()
	running = false
end

function M.waitUntil(fn, timeout, what)
	local deadline = os.clock() + (timeout or 10)
	while os.clock() < deadline do
		local ok, v = pcall(fn)
		if ok and v then
			return true
		end
		task.wait(0.05)
	end
	record("시간 초과: " .. tostring(what))
	return false
end

return M
