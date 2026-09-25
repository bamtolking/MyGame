--!strict
-- 슬라임 종류 표. 새 슬라임 추가 = 아래 list에 한 줄 추가.
--   income    : ★1·변이 없음 기준 초당 수입
--   price     : 비워 두면 income × 등급 payback 으로 자동 계산(보기 좋은 숫자로 반올림)
--   color     : 몸 색, accent: 장식 기본 색
--   material  : Enum.Material 이름(선택)
--   accessories: SlimeBuilder의 장식 함수 이름 목록
--   transparency: 몸 투명도(선택)

local Rarities = require(script.Parent.Rarities)

export type Species = {
	id: string,
	name: { en: string, ko: string },
	rarity: string,
	income: number,
	price: number,
	color: Color3,
	accent: Color3,
	material: string?,
	transparency: number?,
	accessories: { string },
}

type Def = {
	id: string,
	en: string,
	ko: string,
	rarity: string,
	income: number,
	price: number?,
	color: Color3,
	accent: Color3?,
	material: string?,
	transparency: number?,
	acc: { string }?,
}

local rgb = Color3.fromRGB

local defs: { Def } = {
	-- 일반
	{ id = "blobby", en = "Blobby", ko = "말랑이", rarity = "common", income = 1, color = rgb(130, 222, 120) },
	{ id = "droplet", en = "Droplet", ko = "물방울", rarity = "common", income = 2, color = rgb(110, 190, 255), acc = { "droplet" } },
	{ id = "mochi", en = "Mochi", ko = "찹쌀떡", rarity = "common", income = 3, color = rgb(255, 232, 238), accent = rgb(255, 120, 170), acc = { "bow" } },
	{ id = "bubbles", en = "Bubbles", ko = "방울이", rarity = "common", income = 5, color = rgb(150, 235, 255), material = "Glass", transparency = 0.2, acc = { "bubbles" } },
	{ id = "jellybean", en = "Jelly Bean", ko = "젤리빈", rarity = "common", income = 7, color = rgb(255, 150, 60), accent = rgb(90, 200, 90), acc = { "sprout" } },
	{ id = "pudding", en = "Pudding", ko = "푸딩", rarity = "common", income = 10, color = rgb(255, 222, 110), accent = rgb(150, 85, 40), acc = { "caramel" } },
	-- 고급
	{ id = "leafy", en = "Leafy", ko = "풀잎이", rarity = "uncommon", income = 15, color = rgb(70, 190, 90), accent = rgb(40, 150, 60), acc = { "leaf" } },
	{ id = "rocky", en = "Rocky", ko = "돌멩이", rarity = "uncommon", income = 22, color = rgb(150, 150, 160), accent = rgb(110, 110, 120), material = "Slate", acc = { "pebbles" } },
	{ id = "honey", en = "Honey", ko = "꿀벌이", rarity = "uncommon", income = 30, color = rgb(255, 196, 40), accent = rgb(40, 30, 20), acc = { "antenna", "stripes" } },
	{ id = "minty", en = "Mint Choco", ko = "민트초코", rarity = "uncommon", income = 40, color = rgb(150, 240, 210), accent = rgb(90, 55, 35), acc = { "chips" } },
	{ id = "soda", en = "Soda", ko = "사이다", rarity = "uncommon", income = 55, color = rgb(200, 245, 255), accent = rgb(255, 90, 90), material = "Glass", transparency = 0.25, acc = { "straw", "bubbles" } },
	-- 희귀
	{ id = "frosty", en = "Frosty", ko = "눈꽃이", rarity = "rare", income = 80, color = rgb(190, 235, 255), accent = rgb(120, 200, 255), material = "Ice", acc = { "icespikes" } },
	{ id = "sparky", en = "Sparky", ko = "찌릿이", rarity = "rare", income = 110, color = rgb(255, 238, 70), accent = rgb(255, 255, 200), acc = { "bolt" } },
	{ id = "coral", en = "Coral", ko = "산호", rarity = "rare", income = 150, color = rgb(255, 120, 110), accent = rgb(255, 170, 150), acc = { "coral" } },
	{ id = "cloudy", en = "Cloudy", ko = "구름이", rarity = "rare", income = 200, color = rgb(245, 248, 255), accent = rgb(255, 255, 255), acc = { "cloud" } },
	{ id = "ember", en = "Ember", ko = "불씨", rarity = "rare", income = 270, color = rgb(255, 110, 40), accent = rgb(255, 210, 60), acc = { "flame" } },
	-- 영웅
	{ id = "ninja", en = "Ninja", ko = "닌자", rarity = "epic", income = 400, color = rgb(45, 50, 80), accent = rgb(230, 40, 50), acc = { "headband" } },
	{ id = "wizard", en = "Wizard", ko = "마법사", rarity = "epic", income = 600, color = rgb(140, 90, 230), accent = rgb(70, 40, 160), acc = { "wizardhat" } },
	{ id = "pirate", en = "Pirate", ko = "해적", rarity = "epic", income = 850, color = rgb(60, 190, 180), accent = rgb(30, 30, 35), acc = { "piratehat", "eyepatch" } },
	{ id = "robo", en = "Robo", ko = "로보", rarity = "epic", income = 1200, color = rgb(185, 195, 210), accent = rgb(255, 50, 60), material = "DiamondPlate", acc = { "visor", "antenna" } },
	-- 전설
	{ id = "king", en = "King Slime", ko = "슬라임 킹", rarity = "legendary", income = 2500, color = rgb(60, 110, 255), accent = rgb(255, 205, 50), acc = { "crown", "cape" } },
	{ id = "dragon", en = "Dragon", ko = "드래곤", rarity = "legendary", income = 4000, color = rgb(220, 50, 50), accent = rgb(255, 200, 80), acc = { "horns", "wings" } },
	{ id = "angel", en = "Angel", ko = "천사", rarity = "legendary", income = 6000, color = rgb(255, 250, 235), accent = rgb(255, 225, 120), acc = { "halo", "wings" } },
	{ id = "samurai", en = "Samurai", ko = "사무라이", rarity = "legendary", income = 9000, color = rgb(150, 25, 35), accent = rgb(230, 190, 70), acc = { "kabuto" } },
	-- 신화
	{ id = "phoenix", en = "Phoenix", ko = "불사조", rarity = "mythic", income = 20000, color = rgb(255, 120, 30), accent = rgb(255, 230, 80), material = "Neon", acc = { "crest", "wings", "flame" } },
	{ id = "kraken", en = "Kraken", ko = "크라켄", rarity = "mythic", income = 35000, color = rgb(110, 40, 170), accent = rgb(180, 90, 230), acc = { "tentacles", "piratehat" } },
	{ id = "void", en = "Void", ko = "보이드", rarity = "mythic", income = 60000, color = rgb(20, 16, 30), accent = rgb(170, 60, 255), acc = { "orbit", "horns" } },
	-- 비밀
	{ id = "galaxyemperor", en = "Galaxy Emperor", ko = "은하 황제", rarity = "secret", income = 150000, color = rgb(40, 30, 110), accent = rgb(255, 220, 90), material = "ForceField", acc = { "crown", "orbit", "cape" } },
	{ id = "glitch", en = "Glitch", ko = "글리치", rarity = "secret", income = 300000, color = rgb(255, 40, 200), accent = rgb(40, 255, 240), material = "Neon", acc = { "glitch", "visor" } },
	{ id = "slimegod", en = "Slime God", ko = "슬라임 신", rarity = "secret", income = 600000, color = rgb(255, 215, 70), accent = rgb(255, 255, 255), material = "Neon", acc = { "halo", "wings", "crown" } },
}

-- 가격을 유효숫자 2자리로 깔끔하게 반올림
local function nice(n: number): number
	if n < 100 then
		return math.max(1, math.floor(n + 0.5))
	end
	local mag = 10 ^ (math.floor(math.log10(n)) - 1)
	return math.floor(n / mag + 0.5) * mag
end

local list: { Species } = {}
local byId: { [string]: Species } = {}
local byRarity: { [string]: { Species } } = {}

for _, d in defs do
	local rarity = Rarities.byId[d.rarity]
	assert(rarity, "unknown rarity " .. d.rarity .. " for " .. d.id)
	assert(byId[d.id] == nil, "duplicate slime id " .. d.id)
	local s: Species = {
		id = d.id,
		name = { en = d.en, ko = d.ko },
		rarity = d.rarity,
		income = d.income,
		price = d.price or nice(d.income * rarity.payback),
		color = d.color,
		accent = d.accent or d.color,
		material = d.material,
		transparency = d.transparency,
		accessories = d.acc or {},
	}
	table.insert(list, s)
	byId[s.id] = s
	local bucket = byRarity[s.rarity]
	if not bucket then
		bucket = {}
		byRarity[s.rarity] = bucket
	end
	table.insert(bucket, s)
end

return {
	list = list,
	byId = byId,
	byRarity = byRarity,
}
