--!strict
-- 클라이언트 시작점.

local Players = game:GetService("Players")

local Client = script.Parent
local Lang = require(Client.Lang)
local State = require(Client.State)
local Kit = require(Client.UI.Kit)
local Notify = require(Client.UI.Notify)
local Hud = require(Client.UI.Hud)
local Panels = Client.UI.Panels
local Shop = require(Panels.Shop)
local Index = require(Panels.Index)
local Rebirth = require(Panels.Rebirth)
local Quests = require(Panels.Quests)
local Gifts = require(Panels.Gifts)
local Store = require(Panels.Store)
local Settings = require(Panels.Settings)
local Manage = require(Panels.Manage)
local Offline = require(Panels.Offline)
local Controllers = Client.Controllers
local Sound = require(Controllers.Sound)
local Fx = require(Controllers.Fx)
local Parade = require(Controllers.Parade)
local BaseSlimes = require(Controllers.BaseSlimes)
local WorldFx = require(Controllers.WorldFx)
local Tutorial = require(Controllers.Tutorial)
local Input = require(Controllers.Input)

Lang.init()
Sound.init()
Kit.setClickSound(function(name: string)
	Sound.play(name)
end)
State.init()
Notify.init()
Hud.init()
for _, panel in { Shop, Index, Rebirth, Quests, Gifts, Store, Settings, Manage, Offline } :: { { init: () -> () } } do
	panel.init()
end
Fx.init()
Parade.init()
BaseSlimes.init()
WorldFx.init()
Tutorial.init()
Input.init()

-- 서버가 입장 때 보낸 상태를 놓쳤을 수도 있으니 한 번 더 요청
task.spawn(function()
	State.action("GetState")
end)

print("[SlimeHeist] client ready for " .. Players.LocalPlayer.Name)
