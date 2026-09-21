--!nonstrict
-- 플레이어 기록 저장(DataStore), leaderstats, 전체 순위표(OrderedDataStore).
-- Studio 에서는 "게임 설정 > 보안 > Studio의 API 서비스 접근 허용" 을 켜야 저장됩니다. 꺼져 있어도 게임은 돌아갑니다.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.GhostDiner.Config)
local Cosmetics = require(ReplicatedStorage.GhostDiner.Cosmetics)

local Data = {}
local store = nil
local orderedStore = nil
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	if ok then
		store = result
	else
		warn("[GhostDiner] DataStore 사용 불가:", result)
	end
	local ok2, result2 = pcall(function()
		return DataStoreService:GetOrderedDataStore(Config.LeaderboardStoreName)
	end)
	if ok2 then
		orderedStore = result2
	end
end

local cache: { [number]: { data: any, loaded: boolean } } = {}
local nameCache: { [number]: string } = {}

local function default()
	return { bestNight = 0, totalServed = 0, totalCoins = 0, runs = 0, fame = 0, hat = "paper" }
end

local function key(player: Player): string
	return "p_" .. player.UserId
end

local function stat(player: Player, name: string): IntValue?
	local ls = player:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild(name)
	if v and v:IsA("IntValue") then
		return v
	end
	return nil
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
	if not Cosmetics.isUnlocked(data.hat, data.fame) then
		data.hat = "paper"
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
	local fame = Instance.new("IntValue")
	fame.Name = "명성"
	fame.Value = data.fame
	fame.Parent = ls
	ls.Parent = player
	player:SetAttribute("Fame", data.fame)
	player:SetAttribute("Hat", data.hat)
	player:SetAttribute("BestNight", data.bestNight)
	player:SetAttribute("DataLoaded", loaded)
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
			merged.fame = math.max(merged.fame, data.fame)
			merged.hat = data.hat
			return merged
		end)
	end)
	if not ok then
		warn("[GhostDiner] 기록 저장 실패:", err)
	end
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

function Data.addFame(player: Player, n: number)
	local entry = cache[player.UserId]
	if not entry then
		return
	end
	entry.data.fame += n
	local v = stat(player, "명성")
	if v then
		v.Value = entry.data.fame
	end
	player:SetAttribute("Fame", entry.data.fame)
end

function Data.getFame(player: Player): number
	local entry = cache[player.UserId]
	return entry and entry.data.fame or 0
end

function Data.getHat(player: Player): string
	local entry = cache[player.UserId]
	return entry and entry.data.hat or "paper"
end

function Data.setHat(player: Player, hatId: string)
	local entry = cache[player.UserId]
	if entry then
		entry.data.hat = hatId
	end
	player:SetAttribute("Hat", hatId)
end

-- 새 최고 기록이면 true
function Data.recordNight(player: Player, night: number): boolean
	local entry = cache[player.UserId]
	if entry and night > entry.data.bestNight then
		entry.data.bestNight = night
		local v = stat(player, "최고 밤")
		if v then
			v.Value = night
		end
		player:SetAttribute("BestNight", night)
		return true
	end
	return false
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

-- ---------- 전체 순위표 ----------
function Data.updateLeaderboard(player: Player, best: number)
	if not orderedStore or best <= 0 then
		return
	end
	task.spawn(function()
		local ok, err = pcall(function()
			orderedStore:SetAsync(tostring(player.UserId), best)
		end)
		if not ok then
			warn("[GhostDiner] 순위표 갱신 실패:", err)
		end
	end)
end

-- { {name, value}, ... } 또는 nil(사용 불가)
function Data.fetchLeaderboard(limit: number)
	if not orderedStore then
		return nil
	end
	local ok, pages = pcall(function()
		return orderedStore:GetSortedAsync(false, limit)
	end)
	if not ok then
		return nil
	end
	local entries = {}
	local okPage, page = pcall(function()
		return pages:GetCurrentPage()
	end)
	if not okPage then
		return nil
	end
	for _, entry in page do
		local userId = tonumber(entry.key)
		local name = userId and nameCache[userId] or nil
		if not name and userId then
			local okName, result = pcall(function()
				return Players:GetNameFromUserIdAsync(userId)
			end)
			name = if okName then result else "???"
			nameCache[userId] = name
		end
		table.insert(entries, { name = name or "???", value = entry.value })
	end
	return entries
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
