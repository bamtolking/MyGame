--!strict
-- 서버 쪽 원격 통신 도우미: 액션 처리기 등록, 알림·연출 보내기.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)

local Sessions = require(script.Parent.Sessions)

local Remote = {}

export type Result = { [string]: any }
type Handler = { interval: number, fn: (Sessions.Session, any) -> Result }

local handlers: { [string]: Handler } = {}

-- 액션 등록. interval: 같은 플레이어가 이 액션을 다시 보낼 수 있는 최소 간격(초)
function Remote.on(name: string, interval: number, fn: (Sessions.Session, any) -> Result)
	assert(handlers[name] == nil, "duplicate action " .. name)
	handlers[name] = { interval = interval, fn = fn }
end

function Remote.start()
	local action = Net.func("Action")
	action.OnServerInvoke = function(player: Player, name: any, payload: any): any
		if type(name) ~= "string" then
			return { ok = false, msg = "badRequest" }
		end
		local handler = handlers[name]
		local session = Sessions.get(player)
		if not handler or not session then
			return { ok = false, msg = "notReady" }
		end
		if not Sessions.throttle(session, name, handler.interval) then
			return { ok = false, msg = "tooFast" }
		end
		local ok, result = pcall(handler.fn, session, payload)
		if not ok then
			warn(string.format("[Action] %s failed for %s: %s", name, player.Name, tostring(result)))
			return { ok = false, msg = "error" }
		end
		return result
	end
end

-- 알림 종류: "info" | "success" | "error" | "announce" | "event" | "rare" | "steal"
function Remote.notify(player: Player, kind: string, key: string, args: { [string]: any }?)
	Net.event("Notify"):FireClient(player, { kind = kind, key = key, args = args })
end

function Remote.notifyAll(kind: string, key: string, args: { [string]: any }?)
	Net.event("Notify"):FireAllClients({ kind = kind, key = key, args = args })
end

function Remote.fx(player: Player, kind: string, data: { [string]: any }?)
	Net.event("Fx"):FireClient(player, { kind = kind, data = data })
end

function Remote.fxAll(kind: string, data: { [string]: any }?)
	Net.event("Fx"):FireAllClients({ kind = kind, data = data })
end

function Remote.fxOthers(except: Player, kind: string, data: { [string]: any }?)
	for _, p in Players:GetPlayers() do
		if p ~= except then
			Net.event("Fx"):FireClient(p, { kind = kind, data = data })
		end
	end
end

return Remote
