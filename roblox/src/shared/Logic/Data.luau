--!strict
-- 저장 데이터 기본값 · 버전 이전 · 정리(순수 함수).
-- 구조를 바꿀 때: VERSION을 올리고 migrations에 이전 함수를 추가하세요.

local Shared = script.Parent.Parent
local Economy = require(Shared.Config.Economy)
local Slimes = require(Shared.Config.Slimes)
local Mutations = require(Shared.Config.Mutations)
local Types = require(Shared.Types)

type PlayerData = Types.PlayerData
type SlimeData = Types.SlimeData

local Data = {}

Data.VERSION = 1

function Data.default(): PlayerData
	return {
		version = Data.VERSION,
		cash = Economy.startCash,
		vault = 0,
		totalEarned = 0,
		rebirths = 0,
		steals = 0,
		slimes = {},
		nextUid = 1,
		upgrades = {},
		index = {},
		boosts = {},
		daily = { streak = 0, lastDay = -1 },
		quests = { day = -1, list = {}, bonusClaimed = false },
		tutorial = 0,
		lastOnline = 0,
		playTime = 0,
		settings = { music = true, sfx = true, fx = true },
		receipts = {},
		stats = { bought = 0, merges = 0, bonks = 0, stolenFrom = 0 },
	}
end

-- 버전별 이전 함수: migrations[n] 은 버전 n 데이터를 n+1로 바꿉니다.
local migrations: { [number]: (any) -> () } = {}

local function num(v: any, default: number, min: number?, max: number?): number
	if type(v) ~= "number" or v ~= v or v == math.huge or v == -math.huge then
		return default
	end
	if min and v < min then
		return min
	end
	if max and v > max then
		return max
	end
	return v
end

local function bool(v: any, default: boolean): boolean
	if type(v) == "boolean" then
		return v
	end
	return default
end

local function tbl(v: any): { [any]: any }
	if type(v) == "table" then
		return v
	end
	return {}
end

-- 어떤 값이 들어와도 올바른 PlayerData를 돌려줍니다(손상·누락 필드 복구).
function Data.reconcile(raw: any): PlayerData
	local d = Data.default()
	if type(raw) ~= "table" then
		return d
	end
	local src: { [string]: any } = raw

	local version = num(src.version, 0, 0)
	while version < Data.VERSION do
		local m = migrations[version]
		if m then
			m(src)
		end
		version += 1
	end

	d.cash = num(src.cash, d.cash, 0)
	d.vault = num(src.vault, 0, 0)
	d.totalEarned = num(src.totalEarned, 0, 0)
	d.rebirths = math.floor(num(src.rebirths, 0, 0))
	d.steals = math.floor(num(src.steals, 0, 0))
	d.nextUid = math.floor(num(src.nextUid, 1, 1))
	d.tutorial = math.floor(num(src.tutorial, 0, 0))
	d.lastOnline = num(src.lastOnline, 0, 0)
	d.playTime = num(src.playTime, 0, 0)

	for id, level in tbl(src.upgrades) do
		local def = Economy.upgradeById[id]
		if def then
			d.upgrades[id] = math.floor(num(level, 0, 0, def.maxLevel))
		end
	end

	for speciesId, muts in tbl(src.index) do
		if type(speciesId) == "string" and Slimes.byId[speciesId] then
			local entry = {}
			for mutId, found in tbl(muts) do
				if type(mutId) == "string" and Mutations.byId[mutId] and found == true then
					entry[mutId] = true
				end
			end
			d.index[speciesId] = entry
		end
	end

	for key, seconds in tbl(src.boosts) do
		if type(key) == "string" then
			local s = num(seconds, 0, 0)
			if s > 0 then
				d.boosts[key] = s
			end
		end
	end

	local daily = tbl(src.daily)
	d.daily.streak = math.floor(num(daily.streak, 0, 0, 7))
	d.daily.lastDay = math.floor(num(daily.lastDay, -1))

	local quests = tbl(src.quests)
	d.quests.day = math.floor(num(quests.day, -1))
	d.quests.bonusClaimed = bool(quests.bonusClaimed, false)
	for _, q in tbl(quests.list) do
		if type(q) == "table" and type(q.id) == "string" then
			table.insert(d.quests.list, {
				id = q.id,
				goal = math.max(1, num(q.goal, 1, 1)),
				progress = num(q.progress, 0, 0),
				claimed = bool(q.claimed, false),
			})
		end
	end

	local settings = tbl(src.settings)
	d.settings.music = bool(settings.music, true)
	d.settings.sfx = bool(settings.sfx, true)
	d.settings.fx = bool(settings.fx, true)

	for _, r in tbl(src.receipts) do
		if type(r) == "string" then
			table.insert(d.receipts, r)
		end
	end

	local stats = tbl(src.stats)
	d.stats.bought = num(stats.bought, 0, 0)
	d.stats.merges = num(stats.merges, 0, 0)
	d.stats.bonks = num(stats.bonks, 0, 0)
	d.stats.stolenFrom = num(stats.stolenFrom, 0, 0)

	-- 슬라임: 알 수 없는 종류는 버리고, 발판 번호가 겹치거나 범위를 벗어나면 다시 배정
	local usedPads: { [number]: boolean } = {}
	local needPad: { string } = {}
	local favSeen = false
	local maxUid = 0
	for uid, s in tbl(src.slimes) do
		if type(uid) == "string" and type(s) == "table" and type(s.id) == "string" and Slimes.byId[s.id] then
			local mut = if type(s.mut) == "string" and Mutations.byId[s.mut] then s.mut else "none"
			local slime: SlimeData = {
				id = s.id,
				star = math.floor(num(s.star, 1, 1, Economy.star.max)),
				mut = mut,
				pad = math.floor(num(s.pad, 0, 0)),
				fav = nil,
			}
			if s.fav == true and not favSeen then
				slime.fav = true
				favSeen = true
			end
			if slime.pad < 1 or slime.pad > Economy.maxPads or usedPads[slime.pad] then
				table.insert(needPad, uid)
			else
				usedPads[slime.pad] = true
			end
			d.slimes[uid] = slime
			local n = tonumber(uid)
			if n then
				maxUid = math.max(maxUid, n)
			end
		end
	end
	table.sort(needPad)
	for _, uid in needPad do
		local pad = Data.freePadFrom(usedPads, Economy.maxPads)
		if pad then
			usedPads[pad] = true
			d.slimes[uid].pad = pad
		else
			d.slimes[uid] = nil -- 자리가 전혀 없으면(이론상 불가) 제거
		end
	end
	d.nextUid = math.max(d.nextUid, maxUid + 1)
	d.version = Data.VERSION
	return d
end

function Data.freePadFrom(used: { [number]: boolean }, padCount: number): number?
	for p = 1, padCount do
		if not used[p] then
			return p
		end
	end
	return nil
end

function Data.usedPads(data: PlayerData): { [number]: boolean }
	local used = {}
	for _, s in data.slimes do
		used[s.pad] = true
	end
	return used
end

function Data.freePad(data: PlayerData, padCount: number): number?
	return Data.freePadFrom(Data.usedPads(data), padCount)
end

function Data.slimeCount(data: PlayerData): number
	local n = 0
	for _ in data.slimes do
		n += 1
	end
	return n
end

-- 새 uid 발급
function Data.newUid(data: PlayerData): string
	local uid = tostring(data.nextUid)
	data.nextUid += 1
	return uid
end

-- 도감 등록. 새로 발견했으면 true
function Data.discover(data: PlayerData, speciesId: string, mut: string): boolean
	local entry = data.index[speciesId]
	if not entry then
		entry = {}
		data.index[speciesId] = entry
	end
	if entry[mut] then
		return false
	end
	entry[mut] = true
	return true
end

-- 영수증 기록(최근 50개만 유지)
function Data.addReceipt(data: PlayerData, receiptId: string)
	table.insert(data.receipts, receiptId)
	while #data.receipts > 50 do
		table.remove(data.receipts, 1)
	end
end

function Data.hasReceipt(data: PlayerData, receiptId: string): boolean
	return table.find(data.receipts, receiptId) ~= nil
end

return Data
