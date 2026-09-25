--!strict
-- 날씨 이벤트 · 매시 정각 대폭주 · 서버 행운.
-- 상태는 ReplicatedStorage.WorldState 폴더의 속성으로 모든 클라이언트에 자동 복제됩니다.
--   Weather(string, ""=맑음) · WeatherEnds · NextWeatherAt · Frenzy(bool) · FrenzyEnds
--   ServerLuck(number) · ServerLuckEnds · Luck(최종 서버 행운 배수)
-- 시간 값은 모두 workspace:GetServerTimeNow() 기준(Frenzy 계산만 UTC os.time).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Weather = require(Shared.Config.Weather)
local Progress = require(Shared.Logic.Progress)
local Roll = require(Shared.Logic.Roll)
local Signal = require(Shared.Util.Signal)
local Loop = require(Shared.Util.Loop)

local Server = script.Parent.Parent
local Remote = require(Server.Remote)

local WeatherService = {}

WeatherService.changed = Signal.new() -- () 날씨·대폭주·행운 중 하나라도 바뀜

local state: Folder
local current: Weather.WeatherEvent? = nil
local endsAt = 0
local nextAt = 0
local frenzy = false
local serverLuckEnds = 0
local random = Random.new()

local function now(): number
	return Workspace:GetServerTimeNow()
end

local function publish()
	state:SetAttribute("Weather", if current then current.id else "")
	state:SetAttribute("WeatherEnds", endsAt)
	state:SetAttribute("NextWeatherAt", nextAt)
	state:SetAttribute("Frenzy", frenzy)
	state:SetAttribute("FrenzyEnds", if frenzy then Progress.frenzyEndsAt(os.time()) - os.time() + now() else 0)
	state:SetAttribute("ServerLuck", if serverLuckEnds > now() then 2 else 1)
	state:SetAttribute("ServerLuckEnds", serverLuckEnds)
	state:SetAttribute("Luck", WeatherService.luck())
	WeatherService.changed:Fire()
end

function WeatherService.luck(): number
	local luck = 1
	if current then
		luck *= current.luck
	end
	if frenzy then
		luck *= Weather.frenzy.luck
	end
	if serverLuckEnds > now() then
		luck *= 2
	end
	return luck
end

function WeatherService.current(): Weather.WeatherEvent?
	return current
end

function WeatherService.currentMutation(): string?
	return if current then current.mutation else nil
end

function WeatherService.isFrenzy(): boolean
	return frenzy
end

function WeatherService.startEvent(id: string, duration: number?)
	local event = Weather.byId[id]
	if not event then
		return
	end
	current = event
	endsAt = now() + (duration or event.duration)
	Remote.notifyAll("event", "weatherStart", { weather = event.id })
	publish()
end

function WeatherService.stopEvent()
	if current then
		current = nil
		endsAt = 0
		nextAt = now() + Weather.calmDuration
		publish()
	end
end

-- 서버 행운 ×2 (시간 누적)
function WeatherService.addServerLuck(seconds: number, byName: string?)
	serverLuckEnds = math.max(serverLuckEnds, now()) + seconds
	Remote.notifyAll("announce", "serverLuck", { name = byName or "", minutes = math.floor(seconds / 60) })
	publish()
end

local function pickEvent(): Weather.WeatherEvent
	return Roll.pickWeighted(Weather.events, function(e: Weather.WeatherEvent): number
		return e.weight
	end, function(): number
		return random:NextNumber()
	end)
end

local function tick()
	local t = now()
	local unix = os.time()
	local wasFrenzy = frenzy
	frenzy = Progress.frenzyActive(unix)
	if frenzy and not wasFrenzy then
		local pool = Weather.frenzy.events
		local id = pool[random:NextInteger(1, #pool)]
		Remote.notifyAll("announce", "frenzyStart")
		WeatherService.startEvent(id, Progress.frenzyEndsAt(unix) - unix)
		return
	elseif wasFrenzy and not frenzy then
		Remote.notifyAll("info", "frenzyEnd")
		publish()
	end

	if current and t >= endsAt then
		Remote.notifyAll("info", "weatherEnd", { weather = current.id })
		WeatherService.stopEvent()
	elseif not current and t >= nextAt then
		WeatherService.startEvent(pickEvent().id)
	end

	if serverLuckEnds > 0 and t >= serverLuckEnds then
		serverLuckEnds = 0
		publish()
	end
end

function WeatherService.init()
	state = Instance.new("Folder")
	state.Name = "WorldState"
	state.Parent = ReplicatedStorage
	nextAt = now() + 90 -- 서버 시작 후 첫 이벤트는 조금 빨리
	publish()
end

function WeatherService.start()
	Loop.every("Weather", 1, tick)
end

return WeatherService
