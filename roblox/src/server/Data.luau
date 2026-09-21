--!nonstrict
-- 플레이어 기록 저장(DataStore) + leaderstats.
-- Studio 에서는 "게임 설정 > 보안 > Studio의 API 서비스 접근 허용" 을 켜야 저장됩니다. 꺼져 있어도 게임은 돌아갑니다.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.GhostDiner.Config)

local Data = {}
local store = nil
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	if ok then
		store = result
	else
		warn("[GhostDiner] DataStore 사용 불가:", result)
	end
end

local cache: { [number]: { data: any, loaded: boolean } } = {}

local function default()
	return { bestNight = 0, totalServed = 0, totalCoins = 0, runs = 0 }
end

local function key(player: Player): string
	return "p_" .. player.UserId
end

local function load(player: Player)
	local data = default()
	local loaded = false
	if store then
		local ok, saved = pcall(function()
			return store:GetAsync(key(player))
		end)
		if ok then
			loaded = true
			if type(saved) == "table" then
				for k, v in default() do
					if type(saved[k]) == typeof(v) then
						data[k] = saved[k]
					end
				end
			end
		else
			warn("[GhostDiner] 기록 불러오기 실패:", saved)
		end
	end
	cache[player.UserId] = { data = data, loaded = loaded }

	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local best = Instance.new("IntValue")
	best.Name = "최고 밤"
	best.Value = data.bestNight
	best.Parent = ls
	local served = Instance.new("IntValue")
	served.Name = "서빙"
	served.Value = 0
	served.Parent = ls
	ls.Parent = player
end

local function save(player: Player)
	local entry = cache[player.UserId]
	if not entry or not store or not entry.loaded then
		return
	end
	local data = entry.data
	local ok, err = pcall(function()
		store:UpdateAsync(key(player), function(old)
			local merged = default()
			if type(old) == "table" then
				for k, v in merged do
					if type(old[k]) == typeof(v) then
						merged[k] = old[k]
					end
				end
			end
			merged.bestNight = math.max(merged.bestNight, data.bestNight)
			merged.totalServed = math.max(merged.totalServed, data.totalServed)
			merged.totalCoins = math.max(merged.totalCoins, data.totalCoins)
			merged.runs = math.max(merged.runs, data.runs)
			return merged
		end)
	end)
	if not ok then
		warn("[GhostDiner] 기록 저장 실패:", err)
	end
end

local function stat(player: Player, name: string): IntValue?
	local ls = player:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild(name)
	if v and v:IsA("IntValue") then
		return v
	end
	return nil
end

function Data.get(player: Player)
	local entry = cache[player.UserId]
	return entry and entry.data or default()
end

function Data.addServed(player: Player, n: number)
	local entry = cache[player.UserId]
	if entry then
		entry.data.totalServed += n
	end
	local v = stat(player, "서빙")
	if v then
		v.Value += n
	end
end

function Data.addCoins(player: Player, n: number)
	local entry = cache[player.UserId]
	if entry then
		entry.data.totalCoins += n
	end
end

function Data.recordNight(player: Player, night: number)
	local entry = cache[player.UserId]
	if entry and night > entry.data.bestNight then
		entry.data.bestNight = night
		local v = stat(player, "최고 밤")
		if v then
			v.Value = night
		end
	end
end

function Data.recordRun(player: Player)
	local entry = cache[player.UserId]
	if entry then
		entry.data.runs += 1
	end
end

function Data.saveAll()
	for _, player in Players:GetPlayers() do
		task.spawn(save, player)
	end
end

function Data.init()
	Players.PlayerAdded:Connect(load)
	for _, player in Players:GetPlayers() do
		task.spawn(load, player)
	end
	Players.PlayerRemoving:Connect(function(player)
		save(player)
		cache[player.UserId] = nil
	end)
	game:BindToClose(function()
		for _, player in Players:GetPlayers() do
			save(player)
		end
	end)
end

return Data
