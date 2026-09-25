--!strict
-- 서버 시작점: 서비스 초기화 → 시작 → 입장/퇴장 순서 조율.

local ServerScriptService = game:GetService("ServerScriptService")

local Server = ServerScriptService:WaitForChild("Server")
local Services = Server:WaitForChild("Services")

local Sessions = require(Server.Sessions)
local Remote = require(Server.Remote)

local DataService = require(Services.DataService)
local MapService = require(Services.MapService)
local WeatherService = require(Services.WeatherService)
local EconomyService = require(Services.EconomyService)
local PlotService = require(Services.PlotService)
local SlimeService = require(Services.SlimeService)
local ParadeService = require(Services.ParadeService)
local StealService = require(Services.StealService)
local ProgressService = require(Services.ProgressService)
local ShopService = require(Services.ShopService)
local LeaderboardService = require(Services.LeaderboardService)
local AdminService = require(Services.AdminService)

type Service = { init: () -> (), start: () -> () }

local order: { Service } = {
	MapService,
	WeatherService,
	DataService,
	EconomyService,
	PlotService,
	SlimeService,
	ParadeService,
	StealService,
	ProgressService,
	ShopService,
	LeaderboardService,
	AdminService,
}

for _, service in order do
	service.init()
end

-- 입장: 데이터 로드가 끝난 뒤 순서대로(기지 배정 → 슬라임 → 진행도 → 패스 → 순위 → 캐릭터)
Sessions.added:Connect(function(session: Sessions.Session)
	PlotService.onJoin(session)
	SlimeService.onJoin(session)
	ProgressService.onJoin(session)
	ShopService.onJoin(session)
	LeaderboardService.onJoin(session)
	EconomyService.pushState(session)
	PlotService.spawnCharacter(session)
end)

-- 퇴장: 저장 전에 동기적으로 정리(도난 취소 → 모델 제거 → 기지 반납)
Sessions.removing:Connect(function(session: Sessions.Session)
	StealService.onLeave(session)
	SlimeService.onLeave(session)
	PlotService.onLeave(session)
end)

Remote.start()
for _, service in order do
	service.start()
end

print("[SlimeHeist] server ready")
