--!strict
-- 클라이언트 쪽 상태 저장소. 서버가 보내는 StateView/Money를 받아 두고 변경을 알립니다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)
local Signal = require(Shared.Util.Signal)
local Types = require(Shared.Types)

local State = {}

State.view = nil :: Types.StateView?
State.cash = 0
State.vault = 0
State.income = 0
State.receivedAt = os.clock() -- view.sessionSeconds를 받은 시각

State.changed = Signal.new() -- (view) 전체 상태
State.money = Signal.new() -- (cash, vault, income)

function State.sessionSeconds(): number
	local view = State.view
	if not view then
		return 0
	end
	return view.sessionSeconds + (os.clock() - State.receivedAt)
end

function State.data(): Types.PlayerData?
	local view = State.view
	return if view then view.data else nil
end

function State.hasPass(key: string): boolean
	local view = State.view
	return view ~= nil and view.passes[key] == true
end

function State.init()
	Net.event("State").OnClientEvent:Connect(function(view: Types.StateView)
		State.view = view
		State.receivedAt = os.clock()
		State.cash = view.data.cash
		State.vault = view.data.vault
		State.income = view.income
		State.changed:Fire(view)
		State.money:Fire(State.cash, State.vault, State.income)
	end)
	Net.event("Money").OnClientEvent:Connect(function(m: { cash: number, vault: number, income: number })
		State.cash = m.cash
		State.vault = m.vault
		State.income = m.income
		local view = State.view
		if view then
			view.data.cash = m.cash
			view.data.vault = m.vault
			view.income = m.income
		end
		State.money:Fire(m.cash, m.vault, m.income)
	end)
end

-- 서버 액션 호출. 결과 테이블(항상 ok 필드 있음)
function State.action(name: string, payload: any?): { [string]: any }
	local ok, result = pcall(function()
		return Net.func("Action"):InvokeServer(name, payload)
	end)
	if ok and type(result) == "table" then
		return result
	end
	return { ok = false, msg = "error" }
end

return State
