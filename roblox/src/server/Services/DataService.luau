--!strict
-- 저장: DataStore UpdateAsync + 세션 잠금.
--  · 불러올 때 다른 서버가 잠가 두었으면 잠시 기다렸다 다시 시도(오래된 잠금은 인계)
--  · 60초마다 자동 저장, 나갈 때 저장 후 잠금 해제, 서버 종료 시 모두 저장
--  · Studio에서 API 접근이 꺼져 있으면 메모리 저장으로 전환(경고 출력)

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local DataLogic = require(Shared.Logic.Data)
local Types = require(Shared.Types)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)

local DataService = {}

local STORE_NAME = "SlimeHeist_v1"
local AUTOSAVE_INTERVAL = 60
local LOCK_EXPIRE = 180 -- 이 시간 동안 갱신 안 된 잠금은 버려진 것으로 봄
local LOAD_ATTEMPTS = 6
local JOB_ID = if game.JobId ~= "" then game.JobId else "studio-" .. tostring(math.random(1, 1e9))

type Stored = {
	data: any,
	lock: { job: string, time: number }?,
}

local store: DataStore? = nil
local memory: { [string]: Stored } = {} -- Studio 대체 저장소
local loading: { [Player]: boolean } = {}
local saving: { [number]: boolean } = {}
local inflight = 0 -- 진행 중인 저장 수(서버 종료 시 모두 끝날 때까지 대기)

local function keyOf(userId: number): string
	return "u_" .. userId
end

local function update(key: string, transform: (Stored?) -> Stored?): (boolean, string?)
	if not store then
		local result = transform(memory[key])
		if result then
			memory[key] = table.clone(result)
		end
		return true, nil
	end
	local s = store :: DataStore
	local ok, err = pcall(function()
		s:UpdateAsync(key, function(old: any): any
			local result = transform(old)
			return result
		end)
	end)
	return ok, if ok then nil else tostring(err)
end

-- 불러오기(잠금 획득). 실패하면 nil
local function load(player: Player): Types.PlayerData?
	local key = keyOf(player.UserId)
	for attempt = 1, LOAD_ATTEMPTS do
		local result: any = nil
		local locked = false
		local force = attempt == LOAD_ATTEMPTS
		local ok, err = update(key, function(old: Stored?): Stored?
			local now = os.time()
			local current: Stored = old or { data = nil, lock = nil }
			local lock = current.lock
			if lock and lock.job ~= JOB_ID and now - lock.time < LOCK_EXPIRE and not force then
				locked = true
				return nil -- 쓰기 취소
			end
			result = current.data
			return { data = current.data, lock = { job = JOB_ID, time = now } }
		end)
		if ok and not locked then
			return DataLogic.reconcile(result)
		end
		if not player.Parent then
			return nil
		end
		if not ok then
			warn(string.format("[Data] load failed for %d (attempt %d): %s", player.UserId, attempt, tostring(err)))
		end
		task.wait(if locked then 5 else 2 * attempt)
	end
	return nil
end

local function save(session: Sessions.Session, release: boolean): boolean
	local userId = session.userId
	if saving[userId] and not release then
		return false
	end
	saving[userId] = true
	inflight += 1
	session.data.lastOnline = os.time()
	local snapshot = session.data
	local lostLock = false
	local ok, err = update(keyOf(userId), function(old: Stored?): Stored?
		if old and old.lock and old.lock.job ~= JOB_ID then
			lostLock = true -- 다른 서버가 이어받음: 덮어쓰지 않음
			return nil
		end
		return {
			data = snapshot,
			lock = if release then nil else { job = JOB_ID, time = os.time() },
		}
	end)
	saving[userId] = nil
	inflight -= 1
	if not ok then
		warn(string.format("[Data] save failed for %d: %s", userId, tostring(err)))
	elseif lostLock then
		warn(string.format("[Data] session lock for %d was taken by another server; save skipped", userId))
	end
	return ok and not lostLock
end

local function onPlayerAdded(player: Player)
	if loading[player] then
		return
	end
	loading[player] = true
	local data = load(player)
	loading[player] = nil
	if not player.Parent then
		return
	end
	if not data then
		player:Kick("데이터를 불러오지 못했어요. 잠시 후 다시 접속해 주세요. (Could not load your data, please rejoin.)")
		return
	end
	local session = Sessions.new(player, data)
	Sessions.add(session)
end

local function onPlayerRemoving(player: Player)
	local session = Sessions.remove(player)
	if session then
		save(session, true)
	end
end

function DataService.init()
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(STORE_NAME)
	end)
	if ok then
		store = result
		-- Studio에서 API 접근이 꺼져 있으면 여기서 오류가 납니다
		local probeOk, probeErr = pcall(function()
			(result :: DataStore):GetAsync("__probe")
		end)
		if not probeOk then
			if RunService:IsStudio() then
				warn(
					"[Data] DataStore 사용 불가 → 메모리 저장으로 실행합니다. 저장하려면 Game Settings > Security > "
						.. "Enable Studio Access to API Services 를 켜세요. ("
						.. tostring(probeErr)
						.. ")"
				)
				store = nil
			else
				warn("[Data] DataStore probe failed: " .. tostring(probeErr))
			end
		end
	else
		warn("[Data] DataStore unavailable, using memory: " .. tostring(result))
		store = nil
	end
end

function DataService.start()
	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)
	for _, p in Players:GetPlayers() do
		task.spawn(onPlayerAdded, p)
	end

	-- 자동 저장(플레이어마다 시점을 흩어서)
	task.spawn(function()
		while true do
			task.wait(AUTOSAVE_INTERVAL / math.max(1, #Sessions.all()))
			local list = Sessions.all()
			table.sort(list, function(a, b)
				return (a.data.lastOnline or 0) < (b.data.lastOnline or 0)
			end)
			local oldest = list[1]
			if oldest and os.time() - oldest.data.lastOnline >= AUTOSAVE_INTERVAL then
				task.spawn(save, oldest, false)
			end
		end
	end)

	game:BindToClose(function()
		for _, player in Players:GetPlayers() do
			local session = Sessions.remove(player)
			if session then
				task.spawn(save, session, true)
			end
		end
		-- PlayerRemoving에서 시작된 저장까지 포함해 모두 끝날 때까지 대기
		local started = os.clock()
		task.wait()
		while inflight > 0 and os.clock() - started < 25 do
			task.wait(0.2)
		end
	end)
end

-- 중요한 변경(결제 등) 직후 즉시 저장
function DataService.saveNow(session: Sessions.Session): boolean
	return save(session, false)
end

function DataService.isPersistent(): boolean
	return store ~= nil
end

return DataService
