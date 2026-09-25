--!strict
-- 게임패스 · 개발자 상품.
-- Creator Dashboard(create.roblox.com)에서 만든 뒤 숫자 ID를 id 칸에 넣으세요.
-- id가 0이면 상점에 표시되지 않고, 관련 혜택은 꺼진 상태로 동작합니다.

export type Pass = {
	key: string,
	id: number,
	icon: string,
	name: { en: string, ko: string },
	desc: { en: string, ko: string },
}

export type Product = {
	key: string,
	id: number,
	icon: string,
	name: { en: string, ko: string },
	desc: { en: string, ko: string },
}

local passes: { Pass } = {
	{
		key = "vip",
		id = 0,
		icon = "👑",
		name = { en = "VIP", ko = "VIP" },
		desc = { en = "x1.5 income forever + VIP chat tag", ko = "수입 영구 ×1.5 + VIP 채팅 태그" },
	},
	{
		key = "doubleCash",
		id = 0,
		icon = "💰",
		name = { en = "2x Cash", ko = "수입 2배" },
		desc = { en = "Double all income forever", ko = "모든 수입 영구 2배" },
	},
	{
		key = "autoCollect",
		id = 0,
		icon = "🧲",
		name = { en = "Auto Collect", ko = "자동 수금" },
		desc = { en = "Cash goes straight to your wallet", ko = "수금 발판 없이 바로 지갑으로" },
	},
	{
		key = "extraPads",
		id = 0,
		icon = "🟪",
		name = { en = "+4 Pads", ko = "발판 +4" },
		desc = { en = "4 extra slime pads", ko = "슬라임 발판 4칸 추가" },
	},
	{
		key = "thiefPro",
		id = 0,
		icon = "🥷",
		name = { en = "Pro Thief", ko = "프로 도둑" },
		desc = { en = "Run 25% faster while carrying", ko = "슬라임을 들고 25% 더 빨리 달리기" },
	},
}

local products: { Product } = {
	{
		key = "serverLuck",
		id = 0,
		icon = "🍀",
		name = { en = "Server Luck x2", ko = "서버 행운 ×2" },
		desc = { en = "15 min of x2 luck for EVERYONE", ko = "15분간 서버 전체 행운 ×2" },
	},
	{
		key = "rainbowStorm",
		id = 0,
		icon = "🌈",
		name = { en = "Summon Rainbow Storm", ko = "무지개 폭풍 소환" },
		desc = { en = "Start a Rainbow Storm for the whole server", ko = "서버 전체에 무지개 폭풍 시작" },
	},
	{
		key = "cashSmall",
		id = 0,
		icon = "💵",
		name = { en = "Pile of Cash", ko = "현금 한 뭉치" },
		desc = { en = "10 minutes of income", ko = "수입 10분치" },
	},
	{
		key = "cashMedium",
		id = 0,
		icon = "💰",
		name = { en = "Bag of Cash", ko = "현금 한 자루" },
		desc = { en = "1 hour of income", ko = "수입 1시간치" },
	},
	{
		key = "cashLarge",
		id = 0,
		icon = "🏦",
		name = { en = "Vault of Cash", ko = "현금 금고" },
		desc = { en = "5 hours of income", ko = "수입 5시간치" },
	},
}

local passByKey: { [string]: Pass } = {}
for _, p in passes do
	passByKey[p.key] = p
end
local productByKey: { [string]: Product } = {}
local productById: { [number]: Product } = {}
for _, p in products do
	productByKey[p.key] = p
	if p.id ~= 0 then
		productById[p.id] = p
	end
end

return {
	passes = passes,
	passByKey = passByKey,
	products = products,
	productByKey = productByKey,
	productById = productById,
	cashPackMinutes = { cashSmall = 10, cashMedium = 60, cashLarge = 300 },
	cashPackMin = { cashSmall = 5000, cashMedium = 30000, cashLarge = 150000 },
	serverLuckSeconds = 900,
	-- 그룹 ID(선택): 그룹 가입자 수입 +10%. 0이면 끔.
	groupId = 0,
}
