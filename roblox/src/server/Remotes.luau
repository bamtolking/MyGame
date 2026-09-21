--!nonstrict
-- 클라이언트와 주고받는 통로.
--  * GhostDinerState 폴더의 Attribute: 게임 상태(자동 복제, 늦게 들어온 플레이어도 바로 읽음)
--  * Notify(RemoteEvent): 알림·효과음·코인 연출·결과 화면
--  * Buy(RemoteFunction): 상점 구매 요청
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = {}

local folder = Instance.new("Folder")
folder.Name = "GhostDinerRemotes"
folder.Parent = ReplicatedStorage

local notify = Instance.new("RemoteEvent")
notify.Name = "Notify"
notify.Parent = folder

local buy = Instance.new("RemoteFunction")
buy.Name = "Buy"
buy.Parent = folder

local state = Instance.new("Folder")
state.Name = "GhostDinerState"
state.Parent = ReplicatedStorage

Remotes.Notify = notify
Remotes.Buy = buy
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

function Remotes.coinPopup(position: Vector3, amount: number, tip: number?)
	notify:FireAllClients({ kind = "coin", position = position, amount = amount, tip = tip or 0 })
end

return Remotes
