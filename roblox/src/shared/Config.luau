--!strict
-- 저승 휴게소: 게임 전체 수치 설정.
-- 밸런스를 바꾸고 싶으면 이 파일과 Recipes / CustomerTypes / Waves / Upgrades 만 손대면 됩니다.

local Config = {
	Version = "0.1.0-beta.1",
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

	-- 저장
	DataStoreName = "GhostDiner_v1",
}

return Config
