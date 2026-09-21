local T = require("./TestUtil")
local Waves = require("./Waves")
local Recipes = require("./Recipes")
local CustomerTypes = require("./CustomerTypes")
local Upgrades = require("./Upgrades")

for players = 1, 6 do
	local prev = 0
	for night = 1, 30 do
		local plan = Waves.plan(night, players, T.rng(night * 100 + players))
		T.eq(plan.total, #plan.customers, "total 일치")
		local regular = plan.total - (CustomerTypes.bossNight(night) and 1 or 0)
		T.eq(regular, Waves.customerCount(night, players), "손님 수 " .. night .. "/" .. players)
		T.check(regular >= prev, "손님 수는 밤이 갈수록 줄지 않음")
		prev = regular
		local pool = Recipes.dishesForNight(night)
		local bossCount = 0
		for i, c in plan.customers do
			local ctype = CustomerTypes.get(c.typeId)
			T.check(ctype.minNight <= night, "너무 이른 손님: " .. c.typeId .. " 밤 " .. night)
			T.eq(#c.dishes, ctype.orders, "주문 수 = 타입 주문 수")
			for _, d in c.dishes do
				T.check(table.find(pool, d), "해금 안 된 요리 주문: " .. d)
			end
			T.check(c.delay > 0 and c.delay <= 15, "등장 간격 범위")
			if i == 1 then
				T.eq(c.delay, 1, "첫 손님은 1초 뒤")
			end
			if ctype.boss then
				bossCount += 1
			end
		end
		T.eq(bossCount, CustomerTypes.bossNight(night) and 1 or 0, "보스는 5의 배수 밤에만 1명")
		if CustomerTypes.bossNight(night) then
			T.eq(plan.customers[#plan.customers].typeId, "sansin", "보스는 마지막")
		end
	end
end

-- 결정성: 같은 시드 → 같은 계획
local a = Waves.plan(7, 3, T.rng(42))
local b = Waves.plan(7, 3, T.rng(42))
for i, c in a.customers do
	T.eq(c.typeId, b.customers[i].typeId, "결정적 타입")
	T.eq(table.concat(c.dishes, ","), table.concat(b.customers[i].dishes, ","), "결정적 주문")
	T.eq(c.delay, b.customers[i].delay, "결정적 간격")
end

-- 수치 범위
T.check(Waves.customerCount(1, 1) >= 3 and Waves.customerCount(1, 1) <= 4, "1명 첫 밤 손님 3~4")
T.check(Waves.customerCount(1, 4) >= 4 and Waves.customerCount(1, 4) <= 5, "4명 첫 밤 손님 4~5")
T.check(Waves.customerCount(10, 6) <= 40, "상한")
T.check(Waves.spawnInterval(1) == 9 and Waves.spawnInterval(30) == 3.5, "등장 간격 9→3.5")
T.check(Waves.patienceMultiplier(1) == 1 and Waves.patienceMultiplier(40) == 0.7, "인내심 1→0.7")
local p = Waves.patienceFor("dokkaebi", 1, 0, Upgrades.patienceMult)
T.eq(p, 50, "도깨비 첫 밤 인내심 50초")
local p3 = Waves.patienceFor("dokkaebi", 1, 3, Upgrades.patienceMult)
T.check(math.abs(p3 - 68) < 0.001, "미소 3단계 +36%")

-- 손님 가중치: 후반에 도깨비 비중 감소
local w1, w12 = 0, 0
for _, e in CustomerTypes.weightsForNight(1) do
	if e.id == "dokkaebi" then
		w1 = e.weight
	end
end
for _, e in CustomerTypes.weightsForNight(12) do
	if e.id == "dokkaebi" then
		w12 = e.weight
	end
end
T.check(w12 < w1, "도깨비 비중 감소")
T.eq(#CustomerTypes.weightsForNight(1), 1, "첫 밤엔 도깨비만")
T.eq(#CustomerTypes.weightsForNight(8), 5, "8밤엔 일반 5종")

print("waves ok")
