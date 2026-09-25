--!strict
-- 관리자 채팅 명령(테스트·라이브 이벤트용). Studio에서는 누구나, 라이브에서는 제작자와 ADMINS만.
--   /cash 1e6        현금 추가
--   /event rainbow   날씨 이벤트 시작 (golden, crystal, sugar, volcano, rainbow, meteor, stop)
--   /spawn legendary [mut] | /spawn dragon [mut]   행진에 슬라임 소환
--   /luck 600        서버 행운 ×2 (초)
--   /give dragon 3 galaxy   내 기지에 슬라임 지급(★, 변이)
--   /rebirthme       환생 조건 무시하고 1회 환생 조건 충족(현금·등급)
--   /wipe            내 데이터 초기화(다음 접속 시 적용)

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TextChatService = game:GetService("TextChatService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Mutations = require(Shared.Config.Mutations)
local Weather = require(Shared.Config.Weather)
local Calc = require(Shared.Logic.Calc)
local Data = require(Shared.Logic.Data)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local Remote = require(Server.Remote)
local EconomyService = require(script.Parent.EconomyService)
local ParadeService = require(script.Parent.ParadeService)
local SlimeService = require(script.Parent.SlimeService)
local WeatherService = require(script.Parent.WeatherService)

local AdminService = {}

-- 라이브 서버 관리자 userId 목록
local ADMINS: { number } = {}

local function isAdmin(player: Player): boolean
	if RunService:IsStudio() then
		return true
	end
	if game.CreatorType == Enum.CreatorType.User and player.UserId == game.CreatorId then
		return true
	end
	return table.find(ADMINS, player.UserId) ~= nil
end

local function words(text: string): { string }
	local out = {}
	for w in string.gmatch(text, "%S+") do
		table.insert(out, w)
	end
	return out
end

local commands: { [string]: (Sessions.Session, { string }) -> string } = {}

commands.cash = function(session, args)
	local amount = tonumber(args[2]) or 1e6
	EconomyService.addCash(session, amount)
	return "cash +" .. amount
end

commands.event = function(_session, args)
	local id = args[2] or "rainbow"
	if id == "stop" then
		WeatherService.stopEvent()
		return "weather stopped"
	end
	if not Weather.byId[id] then
		return "unknown event"
	end
	WeatherService.startEvent(id)
	return "event " .. id
end

commands.spawn = function(_session, args)
	local what = args[2] or "legendary"
	local mut = if args[3] and Mutations.byId[args[3]] then args[3] else nil
	if Rarities.byId[what] then
		ParadeService.spawn(what, nil, mut)
	elseif Slimes.byId[what] then
		ParadeService.spawn(Slimes.byId[what].rarity, what, mut)
	else
		return "unknown slime/rarity"
	end
	return "spawned " .. what
end

commands.luck = function(session, args)
	WeatherService.addServerLuck(tonumber(args[2]) or 600, session.player.DisplayName)
	return "luck on"
end

commands.give = function(session, args)
	local id = args[2] or "dragon"
	if not Slimes.byId[id] then
		return "unknown slime"
	end
	local star = math.clamp(tonumber(args[3]) or 1, 1, 5)
	local mut = if args[4] and Mutations.byId[args[4]] then args[4] else "none"
	local uid = SlimeService.add(session, { id = id, star = star, mut = mut })
	return if uid then "given " .. id else "base full"
end

commands.rebirthme = function(session, _args)
	local cost = Calc.rebirthCost(session.data.rebirths)
	if session.data.cash < cost then
		EconomyService.addCash(session, cost - session.data.cash)
	end
	local req = Calc.rebirthRarityReq(session.data.rebirths)
	local list = Slimes.byRarity[req]
	if Calc.bestRarityOwned(session.data) < Rarities.byId[req].order and list then
		SlimeService.add(session, { id = list[1].id, star = 1, mut = "none" })
	end
	return "rebirth ready"
end

commands.wipe = function(session, _args)
	local fresh = Data.default()
	for k, v in fresh :: any do
		(session.data :: any)[k] = v
	end
	SlimeService.renderAll(session)
	session.dirty = true
	return "data wiped"
end

local function handle(source: TextSource, text: string)
	local player = Players:GetPlayerByUserId(source.UserId)
	if not player or not isAdmin(player) then
		return
	end
	local session = Sessions.get(player)
	if not session then
		return
	end
	local args = words(text)
	local name = string.lower(string.sub(args[1] or "", 2))
	local fn = commands[name]
	if fn then
		local ok, result = pcall(fn, session, args)
		Remote.notify(player, "info", "adminResult", { text = if ok then result else tostring(result) })
	end
end

function AdminService.init() end

function AdminService.start()
	local folder = Instance.new("Folder")
	folder.Name = "AdminCommands"
	for name in commands do
		local cmd = Instance.new("TextChatCommand")
		cmd.Name = "Admin_" .. name
		cmd.PrimaryAlias = "/" .. name
		cmd.Triggered:Connect(handle)
		cmd.Parent = folder
	end
	folder.Parent = TextChatService
end

return AdminService
