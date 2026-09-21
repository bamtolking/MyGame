--!nonstrict
-- 클라이언트와 주고받는 통로.
--  * GhostDinerState 폴더의 Attribute: 게임 상태(자동 복제, 늦게 들어온 플레이어도 바로 읽음)
--  * Notify(RemoteEvent 서버→클라): 알림·효과음·연출·결과 화면
--  * Buy(RemoteFunction): 상점 구매 / SetHat(RemoteFunction): 모자 착용 / Ready(RemoteEvent 클라→서버): 준비 완료
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = {}

local folder = Instance.new("Folder")
folder.Name = "GhostDinerRemotes"
folder.Parent = ReplicatedStorage

local function remoteEvent(name: string): RemoteEvent
	local r = Instance.new("RemoteEvent")
	r.Name = name
	r.Parent = folder
	return r
end

local function remoteFunction(name: string): RemoteFunction
	local r = Instance.new("RemoteFunction")
	r.Name = name
	r.Parent = folder
	return r
end

local notify = remoteEvent("Notify")
local state = Instance.new("Folder")
state.Name = "GhostDinerState"
state.Parent = ReplicatedStorage

Remotes.Notify = notify
Remotes.Buy = remoteFunction("Buy")
Remotes.SetHat = remoteFunction("SetHat")
Remotes.Ready = remoteEvent("Ready")
Remotes.UseTalisman = remoteEvent("UseTalisman")
Remotes.RelicVote = remoteEvent("RelicVote")
Remotes.State = state

function Remotes.set(key: string, value: any)
	state:SetAttribute(key, value)
end

function Remotes.notifyAll(payload: { [string]: any })
	notify:FireAllClients(payload)
end

function Remotes.notify(player: Player, payload: { [string]: any })
	notify:FireClient(player, payload)
end

function Remotes.toastAll(text: string, style: string?)
	notify:FireAllClients({ kind = "toast", text = text, style = style or "info" })
end

function Remotes.toast(player: Player, text: string, style: string?)
	notify:FireClient(player, { kind = "toast", text = text, style = style or "info" })
end

function Remotes.soundAll(name: string)
	notify:FireAllClients({ kind = "sound", name = name })
end

function Remotes.sound(player: Player, name: string)
	notify:FireClient(player, { kind = "sound", name = name })
end

return Remotes
