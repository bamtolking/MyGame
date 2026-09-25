--!strict
-- 순위표: 플레이어 목록(leaderstats) + 광장의 전체 서버 순위판 3개(누적 수입·환생·훔치기).
-- OrderedDataStore는 정수만 저장하므로 누적 수입은 log10 값을 1e9배 해서 저장합니다.
-- DataStore를 못 쓰는 환경(Studio)에서는 현재 서버 플레이어로 순위판을 채웁니다.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Format = require(Shared.Util.Format)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local MapService = require(script.Parent.MapService)

local LeaderboardService = {}

type Board = {
	key: string,
	title: string,
	store: OrderedDataStore?,
	encode: (Sessions.Session) -> number,
	decode: (number) -> string,
	rows: { TextLabel },
	titleLabel: TextLabel?,
}

local LOG_SCALE = 1e9

local boards: { Board } = {
	{
		key = "LB_Earned_v1",
		title = "💰 TOP EARNERS",
		store = nil,
		encode = function(s)
			return math.floor(math.log10(s.data.totalEarned + 1) * LOG_SCALE)
		end,
		decode = function(v)
			return Format.cash(10 ^ (v / LOG_SCALE) - 1)
		end,
		rows = {},
		titleLabel = nil,
	},
	{
		key = "LB_Rebirths_v1",
		title = "♻️ TOP REBIRTHS",
		store = nil,
		encode = function(s)
			return s.data.rebirths
		end,
		decode = function(v)
			return Format.number(v)
		end,
		rows = {},
		titleLabel = nil,
	},
	{
		key = "LB_Steals_v1",
		title = "🥷 TOP THIEVES",
		store = nil,
		encode = function(s)
			return s.data.steals
		end,
		decode = function(v)
			return Format.number(v)
		end,
		rows = {},
		titleLabel = nil,
	},
}

local nameCache: { [number]: string } = {}

local function nameOf(userId: number): string
	local cached = nameCache[userId]
	if cached then
		return cached
	end
	local player = Players:GetPlayerByUserId(userId)
	if player then
		nameCache[userId] = player.DisplayName
		return player.DisplayName
	end
	local ok, name = pcall(function()
		return Players:GetNameFromUserIdAsync(userId)
	end)
	local result = if ok and type(name) == "string" then name else ("#" .. userId)
	nameCache[userId] = result
	return result
end

local function buildBoardGui(board: Board, part: BasePart)
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Back -- 순위판 파트의 Back 면이 도로/광장 쪽
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 25
	gui.LightInfluence = 0
	gui.Parent = part

	local layout = Instance.new("UIListLayout")
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Padding = UDim.new(0, 6)
	layout.Parent = gui
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0, 16)
	pad.PaddingLeft = UDim.new(0, 18)
	pad.PaddingRight = UDim.new(0, 18)
	pad.Parent = gui

	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, 0, 0, 70)
	title.BackgroundTransparency = 1
	title.Font = Enum.Font.FredokaOne
	title.TextScaled = true
	title.TextColor3 = Color3.fromRGB(255, 225, 90)
	title.Text = board.title
	title.LayoutOrder = 0
	title.Parent = gui
	board.titleLabel = title

	for i = 1, 10 do
		local row = Instance.new("TextLabel")
		row.Size = UDim2.new(1, 0, 0, 46)
		row.BackgroundColor3 = if i % 2 == 0 then Color3.fromRGB(60, 45, 100) else Color3.fromRGB(75, 55, 120)
		row.BackgroundTransparency = 0.1
		row.Font = Enum.Font.FredokaOne
		row.TextScaled = true
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.TextColor3 = if i == 1
			then Color3.fromRGB(255, 215, 60)
			elseif i == 2 then Color3.fromRGB(220, 225, 235)
			elseif i == 3 then Color3.fromRGB(240, 170, 110)
			else Color3.new(1, 1, 1)
		row.Text = string.format("  %d. ---", i)
		row.LayoutOrder = i
		row.Parent = gui
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 10)
		corner.Parent = row
		board.rows[i] = row
	end
end

local function fill(board: Board, entries: { { userId: number, value: number } })
	for i = 1, 10 do
		local e = entries[i]
		local row = board.rows[i]
		if row then
			row.Text = if e
				then string.format("  %d. %s  —  %s", i, nameOf(e.userId), board.decode(e.value))
				else string.format("  %d. ---", i)
		end
	end
end

local function localEntries(board: Board): { { userId: number, value: number } }
	local list = {}
	for _, s in Sessions.all() do
		table.insert(list, { userId = s.userId, value = board.encode(s) })
	end
	table.sort(list, function(a, b)
		return a.value > b.value
	end)
	return list
end

local function refresh()
	for _, board in boards do
		local store = board.store
		local entries: { { userId: number, value: number } }? = nil
		if store then
			local ok, pages = pcall(function()
				return store:GetSortedAsync(false, 10)
			end)
			if ok and pages then
				local list = {}
				for _, item in (pages :: DataStorePages):GetCurrentPage() do
					local userId = tonumber(string.match(item.key, "%d+"))
					if userId then
						table.insert(list, { userId = userId, value = item.value })
					end
				end
				entries = list
			end
		end
		fill(board, entries or localEntries(board))
	end
end

local function push()
	for _, board in boards do
		local store = board.store
		if store then
			for _, s in Sessions.all() do
				local value = board.encode(s)
				if value > 0 then
					pcall(function()
						store:SetAsync("u_" .. s.userId, value)
					end)
				end
			end
		end
	end
end

function LeaderboardService.init() end

function LeaderboardService.start()
	local map = MapService.map
	local folder = map and map:FindFirstChild("Leaderboards")
	if folder then
		for i, board in boards do
			local part = folder:FindFirstChild("Board" .. i)
			if part and part:IsA("BasePart") then
				buildBoardGui(board, part)
			end
		end
	end
	for _, board in boards do
		local ok, store = pcall(function()
			return DataStoreService:GetOrderedDataStore(board.key)
		end)
		if ok then
			board.store = store
		end
	end

	-- leaderstats(플레이어 목록) 갱신
	task.spawn(function()
		while true do
			task.wait(1)
			for _, s in Sessions.all() do
				local stats = s.player:FindFirstChild("leaderstats")
				if stats then
					local cash = stats:FindFirstChild("Cash")
					if cash and cash:IsA("StringValue") then
						cash.Value = Format.cash(s.data.cash)
					end
					local reb = stats:FindFirstChild("Rebirths")
					if reb and reb:IsA("IntValue") then
						reb.Value = s.data.rebirths
					end
					local steals = stats:FindFirstChild("Steals")
					if steals and steals:IsA("IntValue") then
						steals.Value = s.data.steals
					end
				end
			end
		end
	end)

	task.spawn(function()
		task.wait(5)
		while true do
			push()
			refresh()
			task.wait(120)
		end
	end)
end

function LeaderboardService.onJoin(session: Sessions.Session)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local cash = Instance.new("StringValue")
	cash.Name = "Cash"
	cash.Value = Format.cash(session.data.cash)
	cash.Parent = stats
	local reb = Instance.new("IntValue")
	reb.Name = "Rebirths"
	reb.Value = session.data.rebirths
	reb.Parent = stats
	local steals = Instance.new("IntValue")
	steals.Name = "Steals"
	steals.Value = session.data.steals
	steals.Parent = stats
	stats.Parent = session.player
end

return LeaderboardService
