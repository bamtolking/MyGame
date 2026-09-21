--!strict
-- 손님(귀신·요괴) 종류. 외형은 서버의 Customers 모듈이 이 값으로 파츠를 조립합니다.

export type CustomerType = {
	id: string,
	name: string,
	patience: number, -- 카운터에 선 뒤 기다려 주는 시간(초)
	speed: number, -- 이동 속도
	orders: number, -- 한 번에 주문하는 요리 수
	damage: number, -- 화나서 난동 부릴 때 깎이는 평판
	rewardMult: number, -- 요리 가격에 곱해지는 보상 배율
	smash: number, -- 난동 때 부수는 조리대 수
	minNight: number, -- 이 밤부터 등장
	weight: number, -- 등장 가중치(밤에 따라 보정)
	boss: boolean?,
	quirk: string?, -- mindChange: 인내심 절반에서 주문을 바꿈
	lines: { string }, -- 카운터에 서면 하는 말
	look: {
		body: { number },
		head: { number },
		scale: number,
		hover: number,
		feature: string, -- horn | hair | hat | tails | stripes | beard
	},
}

local CustomerTypes = {}

local customerList: { CustomerType } = {
	{
		id = "dokkaebi",
		name = "꼬마 도깨비",
		patience = 50,
		speed = 14,
		orders = 1,
		damage = 8,
		rewardMult = 1.0,
		smash = 1,
		minNight = 1,
		weight = 10,
		lines = { "이승 분식이 그렇게 맛있다며?", "빨리요 빨리! 도깨비는 참을성이 없어요", "방망이는 안 휘두를게요. 아마도.", "김 나는 거 주세요, 뜨끈한 거!" },
		look = { body = { 80, 170, 90 }, head = { 120, 200, 110 }, scale = 0.85, hover = 0.6, feature = "horn" },
	},
	{
		id = "ghost",
		name = "처녀귀신",
		patience = 60,
		speed = 11,
		orders = 1,
		damage = 10,
		rewardMult = 1.1,
		smash = 1,
		minNight = 2,
		weight = 7,
		lines = { "이승에서 못 먹은 걸 한 입만…", "머리카락은 안 들어가게 해 주세요", "밤은 길어요. 하지만 인내심은 짧아요", "따뜻한 국물이면 성불할 수 있을 것 같아요" },
		look = { body = { 240, 240, 245 }, head = { 245, 240, 240 }, scale = 1.0, hover = 1.4, feature = "hair" },
	},
	{
		id = "reaper",
		name = "저승사자",
		patience = 40,
		speed = 16,
		orders = 1,
		damage = 18,
		rewardMult = 1.4,
		smash = 1,
		minNight = 4,
		weight = 5,
		lines = { "명부에 이름을 적기 전에 한 끼만.", "나는 기다리는 걸 제일 싫어한다.", "빨리 주면 팁을 두둑이 주지.", "갓은 벗지 않는다. 먹을 땐 예외다." },
		look = { body = { 25, 25, 30 }, head = { 225, 215, 210 }, scale = 1.1, hover = 0.8, feature = "hat" },
	},
	{
		id = "gumiho",
		name = "구미호",
		patience = 80,
		speed = 12,
		orders = 2,
		damage = 14,
		rewardMult = 1.3,
		smash = 1,
		minNight = 6,
		weight = 4,
		quirk = "mindChange",
		lines = { "음… 뭘 먹을지 아직 고민 중이에요 후후", "꼬리 아홉 개 값은 해야죠? 두 개 주문!", "마음이 바뀔 수도 있어요. 미리 말해 두는 거예요", "간은 안 먹어요. 요즘은 분식파예요" },
		look = { body = { 235, 140, 60 }, head = { 245, 200, 150 }, scale = 1.0, hover = 0.7, feature = "tails" },
	},
	{
		id = "tiger",
		name = "배고픈 호랑이",
		patience = 60,
		speed = 18,
		orders = 2,
		damage = 20,
		rewardMult = 1.5,
		smash = 2,
		minNight = 8,
		weight = 3,
		lines = { "크르릉… 배고프다… 곶감 말고 진짜 음식!", "두 개 다 빨리 안 주면 조리대를 씹어 먹겠다", "산에서 여기까지 뛰어왔다. 배고프다.", "호랑이는 기다리지 않는다. 기다리게 만들지 마라." },
		look = { body = { 235, 150, 40 }, head = { 240, 170, 60 }, scale = 1.15, hover = 0.5, feature = "stripes" },
	},
	{
		id = "sansin",
		name = "산신령",
		patience = 100,
		speed = 9,
		orders = 3,
		damage = 30,
		rewardMult = 2.5,
		smash = 2,
		minNight = 5,
		weight = 0, -- 일반 추첨에는 안 나오고 5의 배수 밤마다 보스로 등장
		boss = true,
		lines = { "허허, 내 수염이 배고픔에 떨리는구나. 세 그릇이다.", "이 산의 신령이 왔다. 실망시키지 말거라.", "느긋해 보여도 세 번 실망하면 산이 운다." },
		look = { body = { 245, 245, 235 }, head = { 250, 225, 200 }, scale = 1.5, hover = 1.0, feature = "beard" },
	},
}

CustomerTypes.List = customerList
CustomerTypes.ById = {} :: { [string]: CustomerType }
for _, t in customerList do
	CustomerTypes.ById[t.id] = t
end

function CustomerTypes.get(id: string): CustomerType
	local t = CustomerTypes.ById[id]
	assert(t, "unknown customer type " .. id)
	return t
end

-- 밤 n에 등장 가능한 일반 손님과 가중치
function CustomerTypes.weightsForNight(night: number): { { id: string, weight: number } }
	local out = {}
	for _, t in CustomerTypes.List do
		if not t.boss and t.minNight <= night then
			local w = t.weight
			if t.id == "dokkaebi" and night > 6 then
				-- 후반엔 꼬마 도깨비 비중을 줄여 다양하게
				w = math.max(4, w - (night - 6))
			end
			table.insert(out, { id = t.id, weight = w })
		end
	end
	return out
end

function CustomerTypes.bossNight(night: number): boolean
	return night >= 5 and night % 5 == 0
end

return CustomerTypes
