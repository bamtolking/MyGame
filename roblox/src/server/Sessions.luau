--!strict
-- 접속 중인 플레이어의 세션(저장 데이터 + 저장하지 않는 실시간 상태) 등록소.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Types = require(Shared.Types)
local Signal = require(Shared.Util.Signal)

export type Session = {
	player: Player,
	userId: number,
	data: Types.PlayerData,
	plot: number, -- 0 = 기지 없음
	passes: { [string]: boolean },
	friends: number,
	friendSet: { [number]: boolean }, -- 같은 서버에 있는 친구 userId
	group: boolean,
	joinedClock: number,
	giftsClaimed: { [string]: boolean }, -- 키: 선물 번호 문자열("1"~"7")
	offline: { amount: number, seconds: number }?,
	income: number,
	multiplier: number,
	dirty: boolean,
	moneyDirty: boolean,
	lastAction: { [string]: number },
	busy: { [string]: boolean }, -- 도둑이 들고 가는 중인 내 슬라임 uid
	carrying: number?, -- 내가 들고 가는 도난 건 id
	carryMult: number, -- 들고 달릴 때 속도 배수(1 = 안 들고 있음)
	lastBonk: number,
	stunUntil: number,
	revengeUntil: number,
	lastPlaytimeQuest: number,
}

local Sessions = {}

local map: { [Player]: Session } = {}

-- (session) 데이터 로드가 끝나 게임에 들어올 준비가 됨
Sessions.added = Signal.new()
-- (session) 나가기 직전(저장 전에 정리할 것들)
Sessions.removing = Signal.new()

function Sessions.get(player: Player): Session?
	return map[player]
end

function Sessions.byUserId(userId: number): Session?
	for _, s in map do
		if s.userId == userId then
			return s
		end
	end
	return nil
end

function Sessions.all(): { Session }
	local out = {}
	for _, s in map do
		table.insert(out, s)
	end
	return out
end

function Sessions.add(session: Session)
	map[session.player] = session
	Sessions.added:Fire(session)
end

function Sessions.remove(player: Player): Session?
	local s = map[player]
	if s then
		map[player] = nil
		Sessions.removing:Fire(s)
	end
	return s
end

function Sessions.new(player: Player, data: Types.PlayerData): Session
	return {
		player = player,
		userId = player.UserId,
		data = data,
		plot = 0,
		passes = {},
		friends = 0,
		friendSet = {},
		group = false,
		joinedClock = os.clock(),
		giftsClaimed = {},
		offline = nil,
		income = 0,
		multiplier = 1,
		dirty = true,
		moneyDirty = true,
		lastAction = {},
		busy = {},
		carrying = nil,
		carryMult = 1,
		lastBonk = 0,
		stunUntil = 0,
		revengeUntil = 0,
		lastPlaytimeQuest = os.clock(),
	}
end

-- 액션 속도 제한: 같은 이름의 요청을 interval초에 한 번만 허용
function Sessions.throttle(session: Session, name: string, interval: number): boolean
	local now = os.clock()
	local last = session.lastAction[name]
	if last and now - last < interval then
		return false
	end
	session.lastAction[name] = now
	return true
end

return Sessions
