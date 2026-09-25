--!strict
-- 원격 이벤트 이름과 생성/조회. 서버가 만들고 클라이언트는 기다려서 받습니다.
--
-- 클라이언트 → 서버
--   Action (RemoteFunction) : (name, payload) → { ok, msg?, ... }   UI 조작 전부
--   Bonk   (RemoteEvent)    : 뿅망치 휘두르기
-- 서버 → 클라이언트
--   State  : StateView 전체
--   Money  : { cash, vault, income }
--   Notify : { kind, key, args? }
--   Parade : { op = "spawn" | "remove" | "sync", ... }
--   Fx     : 연출 이벤트 { kind, ... }

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Net = {}

local FOLDER = "Remotes"
local EVENTS = { "State", "Money", "Notify", "Parade", "Fx", "Bonk" }
local FUNCTIONS = { "Action" }

local function folder(): Folder
	if RunService:IsServer() then
		local f = ReplicatedStorage:FindFirstChild(FOLDER)
		if not f then
			local created = Instance.new("Folder")
			created.Name = FOLDER
			for _, name in EVENTS do
				local e = Instance.new("RemoteEvent")
				e.Name = name
				e.Parent = created
			end
			for _, name in FUNCTIONS do
				local fn = Instance.new("RemoteFunction")
				fn.Name = name
				fn.Parent = created
			end
			created.Parent = ReplicatedStorage
			f = created
		end
		return f :: Folder
	end
	return ReplicatedStorage:WaitForChild(FOLDER) :: Folder
end

function Net.event(name: string): RemoteEvent
	assert(table.find(EVENTS, name), "unknown remote event " .. name)
	return folder():WaitForChild(name) :: RemoteEvent
end

function Net.func(name: string): RemoteFunction
	assert(table.find(FUNCTIONS, name), "unknown remote function " .. name)
	return folder():WaitForChild(name) :: RemoteFunction
end

return Net
