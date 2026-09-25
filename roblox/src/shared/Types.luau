--!strict
-- 서버·클라이언트가 공유하는 데이터 형태.

export type SlimeData = {
	id: string, -- 슬라임 종류 id (Config/Slimes)
	star: number, -- 1~5
	mut: string, -- 변이 id (Config/Mutations)
	pad: number, -- 발판 번호
	fav: boolean?, -- 즐겨찾기: 도난 불가 + 환생 시 유지
}

export type QuestState = {
	id: string,
	goal: number,
	progress: number,
	claimed: boolean,
}

export type PlayerData = {
	version: number,
	cash: number,
	vault: number,
	totalEarned: number,
	rebirths: number,
	steals: number,
	slimes: { [string]: SlimeData },
	nextUid: number,
	upgrades: { [string]: number },
	index: { [string]: { [string]: boolean } },
	boosts: { [string]: number },
	daily: { streak: number, lastDay: number },
	quests: { day: number, list: { QuestState }, bonusClaimed: boolean },
	tutorial: number,
	lastOnline: number,
	playTime: number,
	settings: { music: boolean, sfx: boolean, fx: boolean }, -- fx=false: 효과 줄이기
	receipts: { string },
	stats: { bought: number, merges: number, bonks: number, stolenFrom: number },
}

-- 수입 계산에 필요한 "데이터 밖" 정보
export type IncomeContext = {
	vip: boolean,
	doubleCash: boolean,
	friends: number,
	group: boolean,
	frenzy: boolean,
}

-- 서버 → 클라이언트 상태 묶음
export type StateView = {
	data: PlayerData,
	passes: { [string]: boolean },
	income: number,
	multiplier: number,
	friends: number,
	plot: number,
	sessionSeconds: number, -- 이번 접속 경과 시간(접속 선물용)
	giftsClaimed: { [string]: boolean }, -- 키: 선물 번호 문자열("1"~"7")
	offline: { amount: number, seconds: number }?,
}

-- 행진 슬라임(서버·클라이언트 공통)
export type ParadeSlime = {
	key: number,
	id: string,
	mut: string,
	price: number,
	spawnAt: number, -- workspace:GetServerTimeNow() 기준
}

return {}
