--!strict
-- 경제·규칙 수치. 밸런스 조정은 이 파일만 고치면 됩니다.

export type UpgradeDef = {
	id: string,
	name: { en: string, ko: string },
	desc: { en: string, ko: string },
	icon: string,
	maxLevel: number,
	baseCost: number,
	growth: number,
}

local upgrades: { UpgradeDef } = {
	{
		id = "pads",
		name = { en = "More Pads", ko = "발판 추가" },
		desc = { en = "+1 slime pad in your base", ko = "기지 발판 +1" },
		icon = "🟩",
		maxLevel = 10,
		baseCost = 300,
		growth = 2.5,
	},
	{
		id = "speed",
		name = { en = "Speedy Shoes", ko = "날쌘 신발" },
		desc = { en = "+1.5 walk speed", ko = "이동 속도 +1.5" },
		icon = "👟",
		maxLevel = 8,
		baseCost = 500,
		growth = 2.8,
	},
	{
		id = "lock",
		name = { en = "Stronger Lock", ko = "튼튼한 잠금" },
		desc = { en = "+15s base lock time", ko = "기지 잠금 +15초" },
		icon = "🔒",
		maxLevel = 4,
		baseCost = 8000,
		growth = 6,
	},
	{
		id = "offline",
		name = { en = "Night Shift", ko = "야간 근무" },
		desc = { en = "+10% offline earnings, +1h cap", ko = "오프라인 수입 +10%, 최대 +1시간" },
		icon = "🌙",
		maxLevel = 5,
		baseCost = 15000,
		growth = 5,
	},
	{
		id = "luck",
		name = { en = "Lucky Touch", ko = "행운의 손길" },
		desc = { en = "+1.5% chance a bought slime mutates", ko = "구매한 슬라임 변이 확률 +1.5%" },
		icon = "🍀",
		maxLevel = 10,
		baseCost = 2000,
		growth = 2.7,
	},
	{
		id = "bonk",
		name = { en = "Heavy Hammer", ko = "묵직한 뿅망치" },
		desc = { en = "Faster bonk cooldown, bigger knockback", ko = "뿅망치 재사용 단축, 넉백 증가" },
		icon = "🔨",
		maxLevel = 5,
		baseCost = 1000,
		growth = 4,
	},
}

local upgradeById: { [string]: UpgradeDef } = {}
for _, u in upgrades do
	upgradeById[u.id] = u
end

return {
	startCash = 100,
	sellRatio = 0.5,

	basePads = 10,
	passPads = 4, -- 게임패스 "발판 +4"
	maxPads = 24,

	star = {
		max = 5,
		mult = { 1, 3.5, 12, 40, 135 },
		scale = { 1, 1.2, 1.45, 1.75, 2.1 },
		carryWeight = { 0, 0.05, 0.1, 0.15, 0.2 },
		holdBonus = { 0, 0.3, 0.6, 0.9, 1.2 },
	},

	rebirth = {
		multPer = 0.5, -- 환생 1회당 수입 +50%
		baseCost = 4e6,
		costGrowth = 7,
		-- 환생 r → r+1 에 필요한 최소 보유 등급
		rarityReq = { "epic", "epic", "legendary", "legendary", "mythic", "mythic", "mythic", "mythic" },
		rarityReqLate = "secret",
	},

	offline = {
		baseRate = 0.2,
		ratePerLevel = 0.1,
		baseCapHours = 2,
		capHoursPerLevel = 1,
		minSeconds = 60,
	},

	friendBoostPer = 0.1,
	friendBoostMax = 0.4,
	groupBoost = 0.1,
	indexBonusPer = 0.005,

	parade = {
		interval = 2.5, -- 초마다 1마리
		speed = 7, -- studs/s
		buyRange = 16, -- 서버 검증 거리(프롬프트 거리 + 지연 여유)
		promptRange = 10,
	},

	steal = {
		timeout = 60,
		afterTheftShield = 30,
		rookieShieldSeconds = 600,
		minCarryMult = 0.35,
		revengeSeconds = 15,
		revengeSpeed = 6,
		stealRange = 14,
		thiefProCarryBonus = 0.25,
	},

	lock = {
		baseDuration = 60,
		perLevel = 15,
		cooldown = 10,
	},

	bonk = {
		baseCooldown = 1.0,
		cooldownPerLevel = 0.08,
		range = 9,
		stun = 1.2,
		knockback = 55,
		knockbackPerLevel = 8,
	},

	walkSpeed = {
		base = 16,
		perLevel = 1.5,
	},

	vipMult = 1.5,
	doubleCashMult = 2,
	boostCashMult = 2,

	upgrades = upgrades,
	upgradeById = upgradeById,
}
