--!nonstrict
-- 한 판(런)의 공용 상태. 여러 서버 모듈이 이 테이블을 읽고 씁니다.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.GhostDiner.Config)
local Upgrades = require(ReplicatedStorage.GhostDiner.Upgrades)

local GameState = {
	phase = "lobby", -- lobby | countdown | night | day | gameover
	phaseEndsAt = 0,
	night = 0,
	hp = Config.StartHp,
	coins = 0,
	upgrades = {}, -- id → 단계
	customersTotal = 0,
	customersDone = 0,
	stats = {} :: { [string]: any }, -- 한 판 누적
	nightStats = {} :: { [string]: any }, -- 이번 밤
	combo = 0,
	comboExpiresAt = 0,
	eventId = "",
	challengeId = "",
	ready = {}, -- userId → true
	readyCount = 0,
	blackout = false,
	talisman = 0, -- 부적 게이지
	fortuneUntil = 0, -- 풍요 부적 종료 시각
	relics = {} :: { [string]: boolean }, -- 보유 유물
	relicOffer = {} :: { string }, -- 투표 중인 유물 후보
	relicVotes = {} :: { [number]: number }, -- userId → 후보 번호
	relicVoteEndsAt = 0,
	seed = 0,
	runId = 0,
}

function GameState.resetNight()
	GameState.nightStats = { served = 0, burnt = 0, tips = 0, maxCombo = 0, angry = 0, fastServes = 0, fires = 0, ascended = 0, perPlayer = {} }
end

function GameState.resetRun()
	GameState.phase = "lobby"
	GameState.phaseEndsAt = 0
	GameState.night = 0
	GameState.hp = Config.StartHp
	GameState.coins = 0
	GameState.upgrades = {}
	for _, u in Upgrades.List do
		GameState.upgrades[u.id] = 0
	end
	GameState.customersTotal = 0
	GameState.customersDone = 0
	GameState.stats = { served = 0, angry = 0, earned = 0, tips = 0, tipCount = 0, maxCombo = 0, burnt = 0, fires = 0, ascended = 0, talismansUsed = 0, perPlayer = {}, famePerPlayer = {} }
	GameState.resetNight()
	GameState.combo = 0
	GameState.comboExpiresAt = 0
	GameState.eventId = ""
	GameState.challengeId = ""
	GameState.ready = {}
	GameState.readyCount = 0
	GameState.blackout = false
	GameState.talisman = 0
	GameState.fortuneUntil = 0
	GameState.relics = {}
	GameState.relicOffer = {}
	GameState.relicVotes = {}
	GameState.relicVoteEndsAt = 0
	GameState.seed = math.random(1, 2 ^ 30)
	GameState.runId += 1
end

function GameState.level(upgradeId: string): number
	return GameState.upgrades[upgradeId] or 0
end

function GameState.hasRelic(id: string): boolean
	return GameState.relics[id] == true
end

function GameState.addCoins(n: number)
	GameState.coins = math.max(0, GameState.coins + n)
	if n > 0 then
		GameState.stats.earned += n
	end
end

function GameState.damage(n: number)
	GameState.hp = math.clamp(GameState.hp - n, 0, Config.StartHp)
end

function GameState.heal(n: number)
	GameState.hp = math.clamp(GameState.hp + n, 0, Config.StartHp)
end

function GameState.now(): number
	return workspace:GetServerTimeNow()
end

GameState.resetRun()
GameState.runId = 0

return GameState
