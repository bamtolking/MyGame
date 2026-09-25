--!nocheck
-- 헤드리스 가짜 로블록스 엔진(Lune).
-- Lune의 실제 Instance 구현(속성 이름·타입 검증)을 쓰고, 빠진 이벤트·메서드·서비스 동작만 채웁니다.
-- 원격 이벤트와 DataStore는 로블록스 직렬화 규칙(섞인 표·구멍 난 배열·함수 금지)을 검사합니다.

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")
local serde = require("@lune/serde")
local task = require("@lune/task")

local Instance = roblox.Instance
local CFrame, Vector3 = roblox.CFrame, roblox.Vector3
local Enum = roblox.Enum

local Engine = {}
Engine.errors = {} -- 스크립트 오류·경고 기록
Engine.remoteLog = {} -- { {remote, player?, args} }

---------------------------------------------------------------------------
-- 시그널
---------------------------------------------------------------------------
local Signal = {}
Signal.__index = Signal

function Signal.new()
	return setmetatable({ _l = {} }, Signal)
end

function Signal:Connect(fn)
	local conn = { Connected = true, _fn = fn }
	function conn.Disconnect(c)
		c.Connected = false
	end
	conn.disconnect = conn.Disconnect
	table.insert(self._l, conn)
	return conn
end

function Signal:Once(fn)
	local conn
	conn = self:Connect(function(...)
		conn:Disconnect()
		fn(...)
	end)
	return conn
end

function Signal:Wait()
	local thread = coroutine.running()
	self:Once(function(...)
		task.spawn(thread, ...)
	end)
	return coroutine.yield()
end

function Signal:Fire(...)
	for _, c in table.clone(self._l) do
		if c.Connected then
			task.spawn(function(...)
				local ok, err = pcall(c._fn, ...)
				if not ok then
					table.insert(Engine.errors, "signal handler: " .. tostring(err))
					print("[ENGINE] handler error: " .. tostring(err))
				end
			end, ...)
		end
	end
end

Engine.Signal = Signal

local signals = {}
local function sig(inst, name)
	local t = signals[inst]
	if not t then
		t = {}
		signals[inst] = t
	end
	local s = t[name]
	if not s then
		s = Signal.new()
		t[name] = s
	end
	return s
end
Engine.sig = sig

local EVENTS = {
	Instance = { "ChildAdded", "ChildRemoved", "DescendantAdded", "DescendantRemoving", "AncestryChanged", "Changed", "Destroying" },
	BasePart = { "Touched", "TouchEnded" },
	Humanoid = { "Died", "StateChanged", "Running" },
	Players = { "PlayerAdded", "PlayerRemoving" },
	Player = { "CharacterAdded", "CharacterRemoving" },
	RemoteEvent = { "OnServerEvent", "OnClientEvent" },
	RunService = { "Heartbeat", "RenderStepped", "Stepped" },
	MarketplaceService = { "PromptGamePassPurchaseFinished", "PromptProductPurchaseFinished" },
	TextChatCommand = { "Triggered" },
	GuiButton = { "Activated", "MouseButton1Click", "MouseButton1Down", "MouseButton1Up", "MouseEnter", "MouseLeave" },
	GuiObject = { "InputBegan", "InputEnded" },
	ProximityPrompt = { "Triggered", "PromptButtonHoldBegan", "PromptButtonHoldEnded", "PromptShown", "PromptHidden" },
	ProximityPromptService = { "PromptShown", "PromptHidden", "PromptTriggered" },
	Sound = { "Ended", "Loaded", "Played" },
	UserInputService = { "InputBegan", "InputEnded" },
}
for class, names in EVENTS do
	for _, name in names do
		roblox.implementProperty(class, name, function(inst)
			return sig(inst, name)
		end)
	end
end

-- 콜백 속성
local callbacks = {}
local function callbackProp(class, name)
	roblox.implementProperty(class, name, function(inst)
		return callbacks[inst] and callbacks[inst][name]
	end, function(inst, fn)
		callbacks[inst] = callbacks[inst] or {}
		callbacks[inst][name] = fn
	end)
end
callbackProp("RemoteFunction", "OnServerInvoke")
callbackProp("RemoteFunction", "OnClientInvoke")
callbackProp("MarketplaceService", "ProcessReceipt")
callbackProp("TextChatService", "OnIncomingMessage")
function Engine.callback(inst, name)
	return callbacks[inst] and callbacks[inst][name]
end

---------------------------------------------------------------------------
-- 직렬화 규칙 검사
---------------------------------------------------------------------------
local function validate(value, path, allowUserdata, seen)
	seen = seen or {}
	local t = type(value)
	if t == "function" or t == "thread" then
		error("cannot serialize " .. t .. " at " .. path)
	elseif t == "userdata" then
		if not allowUserdata then
			error("cannot store userdata (" .. typeof(value) .. ") at " .. path)
		end
	elseif t == "number" then
		if value ~= value then
			error("NaN at " .. path)
		end
	elseif t == "table" then
		if seen[value] then
			error("cyclic table at " .. path)
		end
		seen[value] = true
		local n, strings, numbers = 0, 0, 0
		for k in value do
			n += 1
			if type(k) == "string" then
				strings += 1
			elseif type(k) == "number" then
				numbers += 1
			else
				error("bad key type " .. type(k) .. " at " .. path)
			end
		end
		if strings > 0 and numbers > 0 then
			error("mixed table (string + number keys) at " .. path)
		end
		if numbers > 0 and numbers ~= #value then
			error("sparse array at " .. path)
		end
		for k, v in value do
			validate(v, path .. "." .. tostring(k), allowUserdata, seen)
		end
		seen[value] = nil
	end
end
Engine.validate = validate

---------------------------------------------------------------------------
-- DataModel · 서비스
---------------------------------------------------------------------------
local game = Instance.new("DataModel")
game.JobId = "mock-job-1"
Engine.game = game

local function svc(name)
	return game:GetService(name)
end

local Players = svc("Players")
local Workspace = svc("Workspace")
local ReplicatedStorage = svc("ReplicatedStorage")
local ServerScriptService = svc("ServerScriptService")
local RunService = svc("RunService")
local CollectionService = svc("CollectionService")
local MarketplaceService = svc("MarketplaceService")
local DataStoreService = svc("DataStoreService")
local TextChatService = svc("TextChatService")
svc("Lighting")
svc("SoundService")
svc("StarterPlayer")
svc("TweenService")
svc("Debris")
svc("ContextActionService")
svc("UserInputService")
svc("LocalizationService")
svc("ContentProvider")
svc("ProximityPromptService")
svc("GuiService")
svc("ReplicatedFirst")

Engine.isServer = true
Engine.isStudio = true
Engine.localPlayer = nil
Engine.clock0 = os.clock()

roblox.implementMethod("DataModel", "BindToClose", function(_self, fn)
	Engine.closeHandlers = Engine.closeHandlers or {}
	table.insert(Engine.closeHandlers, fn)
end)
roblox.implementProperty("DataModel", "CreatorId", function()
	return 0
end)
roblox.implementProperty("DataModel", "CreatorType", function()
	return Enum.CreatorType.User
end)

roblox.implementMethod("RunService", "IsStudio", function()
	return Engine.isStudio
end)
roblox.implementMethod("RunService", "IsServer", function()
	return Engine.isServer
end)
roblox.implementMethod("RunService", "IsClient", function()
	return not Engine.isServer
end)
roblox.implementMethod("Workspace", "GetServerTimeNow", function()
	return 1_000_000 + (os.clock() - Engine.clock0)
end)
roblox.implementProperty("Workspace", "CurrentCamera", function()
	if not Engine.camera then
		local cam = Instance.new("Camera")
		cam.CFrame = CFrame.new(0, 20, 20)
		cam.ViewportSize = roblox.Vector2.new(1280, 720)
		Engine.camera = cam
	end
	return Engine.camera
end)

-- 인스턴스 공통
roblox.implementMethod("Instance", "WaitForChild", function(self, name, timeout)
	local started = os.clock()
	while true do
		local child = self:FindFirstChild(name)
		if child then
			return child
		end
		if os.clock() - started > (timeout or 5) then
			if timeout then
				return nil
			end
			error("Infinite yield: " .. self:GetFullName() .. ":WaitForChild(\"" .. name .. "\")")
		end
		task.wait(0.02)
	end
end)
roblox.implementMethod("Instance", "GetPropertyChangedSignal", function(self, prop)
	return sig(self, "prop:" .. prop)
end)
roblox.implementMethod("Instance", "GetAttributeChangedSignal", function(self, name)
	return sig(self, "attr:" .. name)
end)

local modelPivots = setmetatable({}, { __mode = "k" })
local function pivotOf(model)
	if model.PrimaryPart then
		return model.PrimaryPart.CFrame
	end
	if modelPivots[model] then
		return modelPivots[model]
	end
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			return d.CFrame
		end
	end
	return CFrame.new()
end
local function setPart(part, cf)
	part.CFrame = cf
	part.Position = cf.Position
end
Engine.setPart = setPart
roblox.implementMethod("Model", "GetPivot", pivotOf)
roblox.implementMethod("Model", "PivotTo", function(self, cf)
	local delta = cf * pivotOf(self):Inverse()
	for _, d in self:GetDescendants() do
		if d:IsA("BasePart") then
			setPart(d, delta * d.CFrame)
		end
	end
	if modelPivots[self] then
		modelPivots[self] = cf
	end
end)
roblox.implementMethod("BasePart", "GetPivot", function(self)
	return self.CFrame
end)
roblox.implementMethod("BasePart", "PivotTo", function(self, cf)
	setPart(self, cf)
end)
roblox.implementMethod("ParticleEmitter", "Emit", function() end)

-- 태그: Lune 인스턴스에 이미 AddTag(태그) 메서드가 있어서 CollectionService는 프록시로 제공
local tags = {}
local CollectionProxy = {}
function CollectionProxy.AddTag(_self, inst, tag)
	tags[tag] = tags[tag] or {}
	if not table.find(tags[tag], inst) then
		table.insert(tags[tag], inst)
		sig(CollectionService, "added:" .. tag):Fire(inst)
	end
end
function CollectionProxy.RemoveTag(_self, inst, tag)
	local list = tags[tag]
	local i = list and table.find(list, inst)
	if i then
		table.remove(list, i)
		sig(CollectionService, "removed:" .. tag):Fire(inst)
	end
end
function CollectionProxy.HasTag(_self, inst, tag)
	return tags[tag] ~= nil and table.find(tags[tag], inst) ~= nil
end
function CollectionProxy.GetTagged(_self, tag)
	local out = {}
	for _, inst in tags[tag] or {} do
		if inst.Parent then
			table.insert(out, inst)
		end
	end
	return out
end
function CollectionProxy.GetInstanceAddedSignal(_self, tag)
	return sig(CollectionService, "added:" .. tag)
end
function CollectionProxy.GetInstanceRemovedSignal(_self, tag)
	return sig(CollectionService, "removed:" .. tag)
end

-- game 프록시: GetService에서 프록시 서비스를 돌려주고 나머지는 진짜 DataModel로
local gameProxy = setmetatable({}, {
	__index = function(_t, key)
		if key == "GetService" then
			return function(_self, name)
				if name == "CollectionService" then
					return CollectionProxy
				end
				return game:GetService(name)
			end
		elseif key == "BindToClose" then
			return function(_self, fn)
				Engine.closeHandlers = Engine.closeHandlers or {}
				table.insert(Engine.closeHandlers, fn)
			end
		elseif key == "CreatorId" then
			return 0
		elseif key == "CreatorType" then
			return Enum.CreatorType.User
		end
		return game[key]
	end,
})
Engine.gameProxy = gameProxy

-- 트윈: 즉시 적용
roblox.implementMethod("TweenService", "Create", function(_self, inst, _info, props)
	local tween = { Completed = Signal.new() }
	function tween.Play(t)
		for k, v in props do
			inst[k] = v
		end
		t.Completed:Fire(Enum.PlaybackState.Completed)
	end
	function tween.Cancel() end
	function tween.Pause() end
	return tween
end)
roblox.implementMethod("Debris", "AddItem", function(_self, inst, seconds)
	task.delay(seconds or 10, function()
		pcall(function()
			inst:Destroy()
		end)
	end)
end)
roblox.implementMethod("SoundService", "PlayLocalSound", function() end)

-- 소리: 재생 기록만 남김(Engine.soundsPlayed[SoundId] = 횟수)
Engine.soundsPlayed = {}
roblox.implementMethod("Sound", "Play", function(self)
	Engine.soundsPlayed[self.SoundId] = (Engine.soundsPlayed[self.SoundId] or 0) + 1
	self.Playing = true
	self.IsPlaying = true
end)
roblox.implementMethod("Sound", "Stop", function(self)
	self.Playing = false
	self.IsPlaying = false
end)
roblox.implementMethod("Sound", "Pause", function(self)
	self.Playing = false
	self.IsPlaying = false
end)
roblox.implementMethod("Sound", "Resume", function(self)
	self.Playing = true
	self.IsPlaying = true
end)
roblox.implementMethod("ContentProvider", "PreloadAsync", function(_self, list, callback)
	for _, item in list do
		if callback then
			local id = if type(item) == "string" then item else item.SoundId
			callback(id, Enum.AssetFetchStatus.Success)
		end
	end
end)

-- 프롬프트 길게 누르기(터치용 사용자 정의 프롬프트)
roblox.implementMethod("ProximityPrompt", "InputHoldBegin", function(self)
	sig(self, "PromptButtonHoldBegan"):Fire()
end)
roblox.implementMethod("ProximityPrompt", "InputHoldEnd", function(self)
	sig(self, "PromptButtonHoldEnded"):Fire()
end)

-- 렌더 단계 바인딩: RenderStepped에 연결
Engine.renderSteps = {}
roblox.implementMethod("RunService", "BindToRenderStep", function(self, name, _priority, fn)
	if Engine.renderSteps[name] then
		Engine.renderSteps[name]:Disconnect()
	end
	Engine.renderSteps[name] = sig(self, "RenderStepped"):Connect(fn)
end)
roblox.implementMethod("RunService", "UnbindFromRenderStep", function(_self, name)
	if Engine.renderSteps[name] then
		Engine.renderSteps[name]:Disconnect()
		Engine.renderSteps[name] = nil
	end
end)

-- 카메라 투영(간단한 원근): 화면 가운데 기준
roblox.implementMethod("Camera", "WorldToViewportPoint", function(self, pos)
	local rel = self.CFrame:PointToObjectSpace(pos)
	local size = self.ViewportSize
	local depth = -rel.Z
	if depth <= 0.01 then
		return roblox.Vector3.new(size.X / 2, size.Y / 2, depth), false
	end
	local f = (size.Y / 2) / math.tan(math.rad(self.FieldOfView / 2))
	local x = size.X / 2 + rel.X / depth * f
	local y = size.Y / 2 - rel.Y / depth * f
	return roblox.Vector3.new(x, y, depth), x >= 0 and x <= size.X and y >= 0 and y <= size.Y
end)
roblox.implementMethod("GuiService", "GetGuiInset", function()
	return roblox.Vector2.new(0, 58), roblox.Vector2.new(0, 0)
end)
roblox.implementMethod("ReplicatedFirst", "RemoveDefaultLoadingScreen", function()
	Engine.defaultLoadingRemoved = true
end)

-- 모델 기준점(WorldPivot): 설정한 모델은 PivotTo가 이 값을 기준으로 움직임
roblox.implementProperty("Model", "WorldPivot", function(self)
	return pivotOf(self)
end, function(self, cf)
	modelPivots[self] = cf
end)
roblox.implementMethod("ContextActionService", "BindAction", function(_self, name, fn)
	Engine.actions = Engine.actions or {}
	Engine.actions[name] = fn
end)
do
	local uis = svc("UserInputService")
	uis.KeyboardEnabled = true
	uis.TouchEnabled = false
end

-- 플레이어
roblox.implementMethod("Players", "GetPlayers", function(self)
	local out = {}
	for _, c in self:GetChildren() do
		if c:IsA("Player") then
			table.insert(out, c)
		end
	end
	return out
end)
roblox.implementMethod("Players", "GetPlayerByUserId", function(self, userId)
	for _, c in self:GetChildren() do
		if c:IsA("Player") and c.UserId == userId then
			return c
		end
	end
	return nil
end)
roblox.implementMethod("Players", "GetPlayerFromCharacter", function(self, model)
	for _, c in self:GetChildren() do
		if c:IsA("Player") and c.Character == model then
			return c
		end
	end
	return nil
end)
roblox.implementMethod("Players", "GetNameFromUserIdAsync", function(_self, userId)
	return "User" .. tostring(userId)
end)
-- LocalPlayer는 원래 있는 속성이라 implementProperty로 덮을 수 없음 → 직접 설정
function Engine.setLocalPlayer(p)
	Engine.localPlayer = p
	Players.LocalPlayer = p
end

Engine.friends = {} -- ["a:b"] = true
roblox.implementMethod("Player", "IsFriendsWithAsync", function(self, other)
	return Engine.friends[self.UserId .. ":" .. other] == true or Engine.friends[other .. ":" .. self.UserId] == true
end)
roblox.implementMethod("Player", "IsInGroupAsync", function()
	return false
end)
roblox.implementMethod("Player", "Kick", function(self, msg)
	Engine.kicked = Engine.kicked or {}
	Engine.kicked[self.UserId] = msg
	self.Parent = nil
end)
roblox.implementMethod("Player", "LoadCharacterAsync", function(self)
	local old = self.Character
	if old then
		old:Destroy()
	end
	local char = Instance.new("Model")
	char.Name = self.Name
	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = Vector3.new(2, 2, 1)
	root.Parent = char
	local head = Instance.new("Part")
	head.Name = "Head"
	head.Size = Vector3.new(1, 1, 1)
	head.Parent = char
	local hum = Instance.new("Humanoid")
	hum.Health = 100
	hum.MaxHealth = 100
	hum.WalkSpeed = 16
	hum.Parent = char
	char.PrimaryPart = root
	setPart(root, CFrame.new(0, 3, -205))
	setPart(head, CFrame.new(0, 4.5, -205))
	char.Parent = Workspace
	self.Character = char
	sig(self, "CharacterAdded"):Fire(char)
end)
roblox.implementMethod("Humanoid", "ChangeState", function(self, state)
	Engine.humanoidStates = Engine.humanoidStates or {}
	Engine.humanoidStates[self] = state
end)

-- 원격
local function logRemote(remote, player, args)
	for i, a in args do
		local ok, err = pcall(validate, a, remote.Name .. "[" .. i .. "]", true)
		if not ok then
			table.insert(Engine.errors, "remote payload: " .. tostring(err))
			print("[ENGINE] remote payload error: " .. tostring(err))
		end
	end
	table.insert(Engine.remoteLog, { remote = remote.Name, player = player, args = args })
end
roblox.implementMethod("RemoteEvent", "FireClient", function(self, player, ...)
	logRemote(self, player, { ... })
	if Engine.localPlayer == player then
		sig(self, "OnClientEvent"):Fire(...)
	end
end)
roblox.implementMethod("RemoteEvent", "FireAllClients", function(self, ...)
	logRemote(self, nil, { ... })
	if Engine.localPlayer then
		sig(self, "OnClientEvent"):Fire(...)
	end
end)
roblox.implementMethod("RemoteEvent", "FireServer", function(self, ...)
	logRemote(self, Engine.localPlayer, { ... })
	sig(self, "OnServerEvent"):Fire(Engine.localPlayer, ...)
end)
roblox.implementMethod("RemoteFunction", "InvokeServer", function(self, ...)
	local fn = Engine.callback(self, "OnServerInvoke")
	if Engine.clientInvoke then
		return Engine.clientInvoke(self, ...)
	end
	assert(fn, "no OnServerInvoke")
	local result = fn(Engine.localPlayer, ...)
	validate(result, "InvokeServer result", true)
	return result
end)

-- 마켓
Engine.ownedPasses = {}
roblox.implementMethod("MarketplaceService", "UserOwnsGamePassAsync", function(_self, userId, passId)
	return Engine.ownedPasses[userId .. ":" .. passId] == true
end)
roblox.implementMethod("MarketplaceService", "PromptGamePassPurchase", function() end)
roblox.implementMethod("MarketplaceService", "PromptProductPurchase", function() end)
roblox.implementMethod("MarketplaceService", "GetProductInfoAsync", function()
	return { PriceInRobux = 99 }
end)

-- 데이터스토어(JSON으로 저장 → 로블록스처럼 복사본만 오감)
Engine.stores = {}
local function makeStore(name)
	local data = {}
	local store = { name = name, data = data }
	function store.GetAsync(_s, key)
		local raw = data[key]
		return if raw then serde.decode("json", raw) else nil
	end
	function store.SetAsync(_s, key, value)
		validate(value, name .. "/" .. key, false)
		data[key] = serde.encode("json", value)
	end
	function store.UpdateAsync(_s, key, fn)
		local raw = data[key]
		local old = if raw then serde.decode("json", raw) else nil
		local new = fn(old)
		if new ~= nil then
			validate(new, name .. "/" .. key, false)
			data[key] = serde.encode("json", new)
		end
		return new
	end
	function store.GetSortedAsync(_s, ascending, pageSize)
		local list = {}
		for k, raw in data do
			table.insert(list, { key = k, value = serde.decode("json", raw) })
		end
		table.sort(list, function(a, b)
			if ascending then
				return a.value < b.value
			end
			return a.value > b.value
		end)
		local page = {}
		for i = 1, math.min(pageSize, #list) do
			page[i] = list[i]
		end
		return {
			GetCurrentPage = function()
				return page
			end,
		}
	end
	return store
end
roblox.implementMethod("DataStoreService", "GetDataStore", function(_self, name)
	Engine.stores[name] = Engine.stores[name] or makeStore(name)
	return Engine.stores[name]
end)
roblox.implementMethod("DataStoreService", "GetOrderedDataStore", function(_self, name)
	Engine.stores["ordered:" .. name] = Engine.stores["ordered:" .. name] or makeStore(name)
	return Engine.stores["ordered:" .. name]
end)

---------------------------------------------------------------------------
-- 전역 · 스크립트 로딩
---------------------------------------------------------------------------
local FakeRandom = {}
FakeRandom.__index = FakeRandom
function FakeRandom.new(_seed)
	return setmetatable({}, FakeRandom)
end
function FakeRandom:NextNumber(a, b)
	a, b = a or 0, b or 1
	return a + math.random() * (b - a)
end
function FakeRandom:NextInteger(a, b)
	return math.random(a, b)
end

local TweenInfo = {
	new = function(...)
		return { ... }
	end,
}

-- Lune에는 기본값이 없는 읽기 전용 속성 → 만들 때 채워 줌
local function withDefaults(inst)
	if inst:IsA("Sound") then
		inst.TimeLength = 1
		inst.IsPlaying = false
	elseif inst:IsA("BasePart") then
		inst.Position = roblox.Vector3.zero -- CFrame을 바꾸면 syncPositions가 매 프레임 맞춰 줌
	elseif inst:IsA("GuiBase2d") then
		inst.AbsolutePosition = roblox.Vector2.new(0, 0)
		inst.AbsoluteSize = roblox.Vector2.new(100, 40)
	end
	return inst
end
local InstanceShim = {
	new = function(className, parent)
		local inst = withDefaults(Instance.new(className))
		if parent then
			inst.Parent = parent
		end
		return inst
	end,
}
Engine.withDefaults = withDefaults

local baseGlobals = {
	game = gameProxy,
	workspace = Workspace,
	task = task,
	Random = FakeRandom,
	TweenInfo = TweenInfo,
	Instance = InstanceShim,
	Enum = Enum,
	warn = function(...)
		local parts = {}
		for _, v in { ... } do
			table.insert(parts, tostring(v))
		end
		local msg = table.concat(parts, " ")
		table.insert(Engine.warnings, msg)
		print("[WARN] " .. msg)
	end,
}
Engine.warnings = {}
for _, name in {
	"CFrame",
	"Vector3",
	"Vector2",
	"Color3",
	"UDim",
	"UDim2",
	"ColorSequence",
	"ColorSequenceKeypoint",
	"NumberSequence",
	"NumberSequenceKeypoint",
	"NumberRange",
	"Rect",
	"Font",
} do
	baseGlobals[name] = roblox[name]
end

local scriptFiles = {}

local function mount(dir, parent)
	for _, entry in fs.readDir(dir) do
		local full = dir .. "/" .. entry
		if fs.isDir(full) then
			local folder = Instance.new("Folder")
			folder.Name = entry
			folder.Parent = parent
			mount(full, folder)
		else
			local className, name
			if string.match(entry, "%.server%.luau$") then
				className, name = "Script", string.gsub(entry, "%.server%.luau$", "")
			elseif string.match(entry, "%.client%.luau$") then
				className, name = "LocalScript", string.gsub(entry, "%.client%.luau$", "")
			elseif string.match(entry, "%.luau$") then
				className, name = "ModuleScript", string.gsub(entry, "%.luau$", "")
			end
			if className then
				local inst = Instance.new(className)
				inst.Name = name
				inst.Parent = parent
				scriptFiles[inst] = full
			end
		end
	end
end

function Engine.mount(dir, parent, name)
	local folder = Instance.new("Folder")
	folder.Name = name
	folder.Parent = parent
	mount(dir, folder)
	return folder
end

-- 서버/클라이언트마다 모듈 캐시가 따로 있어야 하므로 로더를 만들어 씀
function Engine.loader()
	local cache = {}
	local loader = {}
	local function run(inst)
		local file = scriptFiles[inst]
		assert(file, "not a script: " .. tostring(inst))
		local env = {}
		for k, v in baseGlobals do
			env[k] = v
		end
		env.script = inst
		env.require = loader.require
		local chunk = luau.load(fs.readFile(file), { debugName = file, environment = env })
		return chunk()
	end
	function loader.require(target)
		if type(target) == "string" then
			return require(target)
		end
		local cached = cache[target]
		if cached then
			return cached.value
		end
		local value = run(target)
		cache[target] = { value = value }
		return value
	end
	function loader.runScript(inst)
		task.spawn(function()
			local ok, err = pcall(run, inst)
			if not ok then
				table.insert(Engine.errors, "script " .. inst.Name .. ": " .. tostring(err))
				print("[ENGINE] script error: " .. tostring(err))
			end
		end)
	end
	return loader
end

-- 테스트 도우미
local nextUserId = 1000
function Engine.addPlayer(name, userId)
	nextUserId += 1
	local p = Instance.new("Player")
	p.Name = name
	p.DisplayName = name
	p.UserId = userId or nextUserId
	p.LocaleId = "en-us"
	p.Parent = Players
	sig(Players, "PlayerAdded"):Fire(p)
	return p
end

function Engine.removePlayer(p)
	sig(Players, "PlayerRemoving"):Fire(p)
	task.wait()
	p.Parent = nil
end

function Engine.moveTo(p, pos)
	local char = p.Character
	assert(char, "no character for " .. p.Name)
	char:PivotTo(CFrame.new(pos))
end

function Engine.kill(p)
	local char = p.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.Health = 0
		sig(hum, "Died"):Fire()
	end
end

function Engine.touch(part, p)
	local char = p.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	sig(part, "Touched"):Fire(root)
end

function Engine.remote(name)
	return ReplicatedStorage:WaitForChild("Remotes"):WaitForChild(name)
end

-- 서버 액션 호출(클라이언트 InvokeServer 흉내)
function Engine.invoke(p, name, payload)
	local fn = Engine.callback(Engine.remote("Action"), "OnServerInvoke")
	local result = fn(p, name, payload)
	validate(result, "Action " .. name .. " result", true)
	return result
end

function Engine.lastRemote(remoteName, player, predicate)
	for i = #Engine.remoteLog, 1, -1 do
		local e = Engine.remoteLog[i]
		if e.remote == remoteName and (player == nil or e.player == player) and (predicate == nil or predicate(e.args)) then
			return e
		end
	end
	return nil
end

-- Lune에서는 Position과 CFrame이 따로 저장되므로, 로블록스처럼 Position = CFrame.Position 으로 맞춤
function Engine.syncPositions()
	for _, d in Workspace:GetDescendants() do
		if d:IsA("BasePart") then
			d.Position = d.CFrame.Position
		end
	end
end

function Engine.close()
	for _, fn in Engine.closeHandlers or {} do
		fn()
	end
end

Engine.services = {
	Players = Players,
	Workspace = Workspace,
	ReplicatedStorage = ReplicatedStorage,
	ServerScriptService = ServerScriptService,
	RunService = RunService,
	MarketplaceService = MarketplaceService,
	TextChatService = TextChatService,
	DataStoreService = DataStoreService,
	CollectionService = CollectionService,
}

return Engine
