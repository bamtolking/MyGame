--!strict
-- 기지 슬라임: 데이터 ↔ 모델 동기화, 추가/제거, 판매, 합성, 즐겨찾기, 날씨 변이, 도감.
-- 모델: Plot.Slimes 폴더 안, 태그 "BaseSlime", 속성 Uid/OwnerUserId/SpeciesId/Star/Mutation/Pad/Fav

local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Weather = require(Shared.Config.Weather)
local World = require(Shared.Config.World)
local Calc = require(Shared.Logic.Calc)
local Data = require(Shared.Logic.Data)
local Merge = require(Shared.Logic.Merge)
local Roll = require(Shared.Logic.Roll)
local SlimeBuilder = require(Shared.SlimeBuilder)
local Loop = require(Shared.Util.Loop)
local Types = require(Shared.Types)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local Bus = require(Server.Bus)
local Remote = require(Server.Remote)
local MapService = require(script.Parent.MapService)
local EconomyService = require(script.Parent.EconomyService)
local PlotService = require(script.Parent.PlotService)
local WeatherService = require(script.Parent.WeatherService)

local SlimeService = {}

export type SlimeInfo = { id: string, star: number, mut: string }

local models: { [Sessions.Session]: { [string]: Model } } = {}
local random = Random.new()

local function modelsOf(session: Sessions.Session): { [string]: Model }
	local m = models[session]
	if not m then
		m = {}
		models[session] = m
	end
	return m
end

local function destroyModel(session: Sessions.Session, uid: string)
	local m = modelsOf(session)
	local model = m[uid]
	if model then
		model:Destroy()
		m[uid] = nil
	end
end

-- uid 슬라임의 모델을 (다시) 만듭니다. 도둑이 들고 가는 중이면 만들지 않습니다.
function SlimeService.render(session: Sessions.Session, uid: string)
	destroyModel(session, uid)
	local s = session.data.slimes[uid]
	local plot = MapService.plots[session.plot]
	if not s or not plot or session.busy[uid] then
		return
	end
	local model = SlimeBuilder.build({ id = s.id, star = s.star, mut = s.mut }, World.padCFrame(session.plot, s.pad))
	model.Name = "Slime_" .. uid
	model:SetAttribute("Uid", uid)
	model:SetAttribute("OwnerUserId", session.userId)
	model:SetAttribute("Pad", s.pad)
	model:SetAttribute("Fav", s.fav == true)
	model:SetAttribute("PlotIndex", session.plot)
	CollectionService:AddTag(model, "BaseSlime")
	model.Parent = plot.slimes
	modelsOf(session)[uid] = model
end

function SlimeService.renderAll(session: Sessions.Session)
	for uid in modelsOf(session) do
		destroyModel(session, uid)
	end
	for uid in session.data.slimes do
		SlimeService.render(session, uid)
	end
end

function SlimeService.clearModels(session: Sessions.Session)
	for uid in modelsOf(session) do
		destroyModel(session, uid)
	end
	models[session] = nil
end

function SlimeService.freePad(session: Sessions.Session): number?
	return Data.freePad(session.data, PlotService.padCount(session))
end

-- 도감 등록 + 새 발견 알림
local function discover(session: Sessions.Session, id: string, mut: string)
	if Data.discover(session.data, id, mut) then
		Remote.notify(session.player, "success", "newIndex", { slime = id, mut = mut })
		Bus.incomeChanged:Fire(session)
	end
end

-- 슬라임 추가. 빈 발판이 없으면 nil
function SlimeService.add(session: Sessions.Session, info: SlimeInfo, keepFav: boolean?): string?
	local pad = SlimeService.freePad(session)
	if not pad then
		return nil
	end
	local uid = Data.newUid(session.data)
	session.data.slimes[uid] = {
		id = info.id,
		star = math.clamp(info.star, 1, 5),
		mut = info.mut,
		pad = pad,
		fav = if keepFav then true else nil,
	}
	discover(session, info.id, info.mut)
	SlimeService.render(session, uid)
	Bus.incomeChanged:Fire(session)
	return uid
end

-- 데이터에서 제거(모델 포함)
function SlimeService.remove(session: Sessions.Session, uid: string): Types.SlimeData?
	local s = session.data.slimes[uid]
	if not s then
		return nil
	end
	session.data.slimes[uid] = nil
	session.busy[uid] = nil
	destroyModel(session, uid)
	Bus.slimeRemoved:Fire(session, uid)
	Bus.incomeChanged:Fire(session)
	return s
end

-- 선물 슬라임(최소 등급 이상 무작위). 자리가 없으면 판매가를 현금으로
function SlimeService.giveRandom(session: Sessions.Session, minRarity: string): (string?, string)
	local minOrder = Rarities.byId[minRarity].order
	local rand = function(): number
		return random:NextNumber()
	end
	local rarity = Roll.rarity(WeatherService.luck(), rand, minOrder)
	local id = Roll.species(rarity, rand)
	local info = { id = id, star = 1, mut = "none" }
	local uid = SlimeService.add(session, info)
	if not uid then
		EconomyService.addCash(session, Calc.sellPrice(info))
		Remote.notify(session.player, "info", "giftToCash", { slime = id })
	end
	return uid, id
end

local function isOwnSlime(session: Sessions.Session, uid: any): boolean
	return type(uid) == "string" and session.data.slimes[uid] ~= nil and not session.busy[uid]
end

function SlimeService.sell(session: Sessions.Session, uid: string): (boolean, string?)
	if not isOwnSlime(session, uid) then
		return false, "notFound"
	end
	local s = session.data.slimes[uid]
	if s.fav then
		return false, "favLocked"
	end
	local price = Calc.sellPrice(s)
	SlimeService.remove(session, uid)
	EconomyService.addCash(session, price)
	Remote.fx(session.player, "sell", { amount = price })
	return true, nil
end

function SlimeService.merge(session: Sessions.Session, uid: string): (boolean, string?)
	if not isOwnSlime(session, uid) then
		return false, "notFound"
	end
	local set = Merge.findSet(session.data.slimes, uid, session.busy)
	if not set then
		return false, "cantMerge"
	end
	local result = Merge.result(session.data.slimes, set)
	for i = 2, #set do
		SlimeService.remove(session, set[i])
	end
	session.data.slimes[uid] = result
	discover(session, result.id, result.mut)
	SlimeService.render(session, uid)
	session.data.stats.merges += 1
	Bus.quest:Fire(session, "merge", 1)
	Bus.incomeChanged:Fire(session)
	Remote.fx(session.player, "merge", { uid = uid, star = result.star })
	return true, nil
end

function SlimeService.toggleFav(session: Sessions.Session, uid: string): (boolean, string?)
	if not isOwnSlime(session, uid) then
		return false, "notFound"
	end
	local target = session.data.slimes[uid]
	local turnOn = not target.fav
	for _, s in session.data.slimes do
		s.fav = nil
	end
	if turnOn then
		target.fav = true
	end
	for u, model in modelsOf(session) do
		model:SetAttribute("Fav", session.data.slimes[u] ~= nil and session.data.slimes[u].fav == true)
	end
	session.dirty = true
	return true, nil
end

-- 도둑이 들어 올리면 기지에서 사라지고, 실패하면 다시 나타남
function SlimeService.setBusy(session: Sessions.Session, uid: string, busy: boolean)
	if busy then
		session.busy[uid] = true
		destroyModel(session, uid)
	else
		session.busy[uid] = nil
		SlimeService.render(session, uid)
	end
	session.dirty = true
end

function SlimeService.modelOf(session: Sessions.Session, uid: string): Model?
	return modelsOf(session)[uid]
end

-- 날씨 이벤트 중 기지 슬라임 변이
local function weatherTick()
	local mut = WeatherService.currentMutation()
	if not mut then
		return
	end
	for _, session in Sessions.all() do
		local changed: { string } = {}
		for uid, s in session.data.slimes do
			if not session.busy[uid] and random:NextNumber() < Weather.baseMutationChance then
				if Roll.isBetterMutation(mut, s.mut) then
					s.mut = mut
					table.insert(changed, uid)
					discover(session, s.id, mut)
				end
			end
		end
		for _, uid in changed do
			SlimeService.render(session, uid)
			Remote.fxAll("mutate", { plot = session.plot, uid = uid, mut = mut })
		end
		if #changed > 0 then
			local first = session.data.slimes[changed[1]]
			Remote.notify(session.player, "success", "slimeMutated", { slime = first.id, mut = mut, n = #changed })
			Bus.incomeChanged:Fire(session)
		end
	end
end

function SlimeService.init() end

function SlimeService.start()
	Loop.every("SlimeWeather", Weather.baseMutationInterval, weatherTick)

	Remote.on("Sell", 0.2, function(session, uid)
		local ok, msg = SlimeService.sell(session, uid)
		return { ok = ok, msg = msg }
	end)
	Remote.on("Merge", 0.3, function(session, uid)
		local ok, msg = SlimeService.merge(session, uid)
		return { ok = ok, msg = msg }
	end)
	Remote.on("Favorite", 0.3, function(session, uid)
		local ok, msg = SlimeService.toggleFav(session, uid)
		return { ok = ok, msg = msg }
	end)
end

function SlimeService.onJoin(session: Sessions.Session)
	-- 발판 수가 줄었을 수도 있으니(게임패스 환불 등) 범위 밖 발판은 그대로 두되 표시만
	for _, s in session.data.slimes do
		discover(session, s.id, s.mut)
	end
	SlimeService.renderAll(session)
end

function SlimeService.onLeave(session: Sessions.Session)
	SlimeService.clearModels(session)
end

-- 사용하지 않는 경고 방지용(설정 로드 검증)
assert(#Slimes.list > 0, "no slimes configured")

return SlimeService
