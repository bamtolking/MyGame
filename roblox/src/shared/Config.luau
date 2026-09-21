--!strict
-- 저승 휴게소: 게임 전체 수치 설정.
-- 밸런스를 바꾸고 싶으면 이 파일과 Recipes / CustomerTypes / Waves / Upgrades 만 손대면 됩니다.

local Config = {
	Version = "0.3.0-beta.1",
	GameName = "저승 휴게소",

	-- 라운드 흐름
	StartHp = 100, -- 평판(체력). 0이 되면 폐업(게임 오버)
	StartCountdown = 15, -- 첫 밤이 시작되기 전 준비 시간(초)
	DayLength = 25, -- 밤과 밤 사이 낮(상점·준비) 시간(초)
	GameOverLength = 15, -- 폐업 화면 시간(초)
	MaxNight = 99,

	-- 손님
	Slots = 6, -- 카운터 앞 자리 수 (여기 서야 인내심이 줄기 시작)
	QueueSpots = 8, -- 대기줄 자리 수
	WrongDishPenalty = 10, -- 잘못된 음식을 내밀면 인내심이 이만큼(초) 줄어듦
	TipMax = 0.5, -- 인내심이 가득 남았을 때 받는 추가 팁 비율(가격의 50%)
	NightClearBonus = 5, -- 밤을 넘기면 (밤 수 × 이 값) 코인
	SmashDuration = 10, -- 악귀가 부순 조리대가 복구되기까지 걸리는 시간(초)
	ServeDistance = 10, -- 서빙 프롬프트가 보이는 거리(스터드)

	-- 조리
	BurnDelay = 10, -- 조리 완료 후 이 시간(초) 안에 꺼내지 않으면 탐
	ChopTime = 2.5, -- 기본 칼질 시간(초, E 길게 누르기)
	CombineSlots = 3, -- 조리대 위에 올릴 수 있는 재료 수
	StationDistance = 8, -- 조리대 프롬프트가 보이는 거리(스터드)

	-- 플레이어
	BaseWalkSpeed = 16,
	WalkSpeedPerLevel = 2,

	-- 콤보 (연속 서빙)
	ComboWindow = 12, -- 이 시간(초) 안에 다음 서빙을 하면 콤보 유지

	-- 화재
	FireDelay = 8, -- 탄 음식을 이만큼(초) 방치하면 불이 남
	FireSpreadInterval = 7, -- 불이 옆 조리대로 번지는 간격(초)
	FireSpreadRange = 9, -- 번지는 거리(스터드)
	FireSpreadDamage = 3, -- 번질 때마다 깎이는 평판
	MaxFires = 6, -- 동시에 탈 수 있는 조리대 수
	ExtinguishHold = 1.2, -- 소화기 사용 시간(초, E 길게)

	-- 밤 이벤트
	EventChance = 0.45,
	EventMinNight = 3,
	BlackoutDuration = 12, -- 정전 지속(초)

	-- 부적 (팀 필살기 게이지)
	TalismanMax = 100,
	TalismanPerServe = 10,
	TalismanTipBonus = 5,
	TalismanBossBonus = 30,
	TimeCharmSeconds = 12, -- 시간 부적: 기다리는 손님 인내심 +초
	FortuneDuration = 20, -- 풍요 부적 지속(초)
	FortuneMult = 1.5,

	-- 유물 (보스 밤 뒤 팀 투표)
	RelicVoteTime = 20,

	-- 떡메치기
	PoundSoloCooldown = 1.2, -- 혼자 칠 때 타격 간격(초)

	-- 성불 연출
	AscendDuration = 3.2,

	-- 명성(영구 진행)
	FamePerServe = 1,
	FamePerNightBase = 5, -- 밤을 넘기면 5 + 밤 수

	-- 순위표
	LeaderboardRefresh = 90, -- 초

	-- 배경음악: Creator Store 에서 고른 오디오의 ID 를 "rbxassetid://123456" 형태로 넣으면 재생됩니다
	MusicId = "",
	MusicVolume = 0.25,

	-- 저장
	DataStoreName = "GhostDiner_v1",
	LeaderboardStoreName = "GhostDiner_BestNight_v1",
}

return Config
