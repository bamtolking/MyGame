--!strict
-- 슬라임 행진(공유 컨베이어). 서버는 목록과 출발 시각만 관리하고,
-- 위치는 공식(World.paradePosition)으로 계산합니다. 그리기는 클라이언트 몫.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Mutations = require(Shared.Config.Mutations)
local Economy = require(Shared.Config.Economy)
local World = require(Shared.Config.World)
local Calc = require(Shared.Logic.Calc)
local Roll = require(Shared.Logic.Roll)
local Net = require(Shared.Net)
local Loop = require(Shared.Util.Loop)
local Types = require(Shared.Types)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local Bus = require(Server.Bus)
local Remote = require(Server.Remote)
local EconomyService = require(script.Parent.EconomyService)
local PlotService = require(script.Parent.PlotService)
local SlimeService = require(script.Parent.SlimeService)
local WeatherService = require(script.Parent.WeatherService)

local ParadeService = {}

local active: { [number]: Types.ParadeSlime } = {}
local nextKey = 1
local random = Random.new()

local function rand(): number
	return random:NextNumber()
end

local function now(): number
	return Workspace:GetServerTimeNow()
end

-- 변이 슬라임은 수입 배수만큼 비싸지 않음(이득이라 눈에 띄면 달려가게)
function ParadeService.priceOf(id: string, mut: string): number
	local species = Slimes.byId[id]
	local mult = Calc.mutMult(mut)
	return math.floor(species.price * (1 + (mult - 1) * 0.5))
end

function ParadeService.spawn(rarity: string?, speciesId: string?, mut: string?): Types.ParadeSlime
	local r = rarity or Roll.rarity(WeatherService.luck(), rand)
	local id = speciesId or Roll.species(r, rand)
	local m = mut or Roll.paradeMutation(WeatherService.currentMutation(), rand)
	local entry: Types.ParadeSlime = {
		key = nextKey,
		id = id,
		mut = m,
		price = ParadeService.priceOf(id, m),
		spawnAt = now(),
	}
	nextKey += 1
	active[entry.key] = entry
	Net.event("Parade"):FireAllClients({ op = "spawn", slime = entry })

	local species = Slimes.byId[id]
	local rar = Rarities.byId[species.rarity]
	if rar.announce or (Mutations.byId[m] and Mutations.byId[m].mult >= 5) then
		Remote.notifyAll("rare", "rareSpawn", { slime = id, mut = m, rarity = rar.id })
	end
	return entry
end

local function removeEntry(key: number, buyerUserId: number?)
	if active[key] then
		active[key] = nil
		Net.event("Parade"):FireAllClients({ op = "remove", key = key, buyer = buyerUserId })
	end
end

function ParadeService.positionOf(entry: Types.ParadeSlime): Vector3?
	return World.paradePosition(now() - entry.spawnAt)
end

function ParadeService.buy(session: Sessions.Session, key: any): (boolean, string?)
	if type(key) ~= "number" then
		return false, "badRequest"
	end
	local entry = active[key]
	if not entry then
		return false, "gone"
	end
	local pos = ParadeService.positionOf(entry)
	if not pos then
		removeEntry(key)
		return false, "gone"
	end
	local root = PlotService.rootPart(session.player)
	if not root then
		return false, "tooFar"
	end
	local flat = Vector3.new(root.Position.X - pos.X, 0, root.Position.Z - pos.Z)
	if flat.Magnitude > Economy.parade.buyRange or math.abs(root.Position.Y - pos.Y) > 20 then
		return false, "tooFar"
	end
	if session.plot == 0 then
		return false, "noPlot"
	end
	if not SlimeService.freePad(session) then
		return false, "baseFull"
	end
	if not EconomyService.spend(session, entry.price) then
		return false, "noCash"
	end

	removeEntry(key, session.userId)
	local mut = entry.mut
	if mut == "none" and rand() < Calc.luckyTouchChance(session.data) then
		mut = Roll.randomMutation(rand)
		Remote.notify(session.player, "success", "luckyTouch", { mut = mut })
	end
	local uid = SlimeService.add(session, { id = entry.id, star = 1, mut = mut })
	if not uid then
		-- 이론상 위에서 확인했지만, 혹시 모를 경우 환불
		EconomyService.addCash(session, entry.price)
		return false, "baseFull"
	end

	session.data.stats.bought += 1
	Bus.quest:Fire(session, "buy", 1)
	if Calc.rarityOf(entry.id) >= Rarities.byId.rare.order then
		Bus.quest:Fire(session, "buyRare", 1)
	end
	if session.data.tutorial == 0 then
		session.data.tutorial = 1
		session.dirty = true
	end
	Remote.fxAll("bought", { key = key, plot = session.plot, uid = uid, userId = session.userId })
	return true, nil
end

function ParadeService.list(): { Types.ParadeSlime }
	local out = {}
	for _, e in active do
		table.insert(out, e)
	end
	return out
end

function ParadeService.init() end

function ParadeService.start()
	Loop.every("Parade", Economy.parade.interval, function()
		-- 끝까지 간 슬라임 정리
		local t = now()
		for key, e in active do
			if t - e.spawnAt > World.paradeDuration + 1 then
				active[key] = nil
			end
		end
		if #Players:GetPlayers() > 0 then
			ParadeService.spawn()
		end
	end)

	Remote.on("Buy", 0.15, function(session, key)
		local ok, msg = ParadeService.buy(session, key)
		return { ok = ok, msg = msg }
	end)
	Remote.on("ParadeSync", 1, function(_session)
		return { ok = true, list = ParadeService.list(), serverTime = now() }
	end)
end

return ParadeService
