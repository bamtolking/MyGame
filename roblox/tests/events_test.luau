local T = require("./TestUtil")
local Events = require("./Events")
local Waves = require("./Waves")
local CustomerTypes = require("./CustomerTypes")

for _, e in Events.List do
	T.check(Events.ById[e.id] == e, "ById " .. e.id)
	T.check(e.minNight >= 2 and e.weight > 0, "이벤트 기본값 " .. e.id)
end
T.eq(Events.pick(1, T.rng(1), 1, 3), nil, "3밤 전엔 이벤트 없음")
T.eq(Events.pick(10, T.rng(1), 0, 3), nil, "확률 0이면 없음")
-- 확률 1이면 항상 뽑히고 해금 밤을 지킴
for night = 3, 20 do
	for seed = 1, 20 do
		local e = Events.pick(night, T.rng(seed * 31 + night), 1, 3)
		T.check(e ~= nil, "확률 1이면 항상 이벤트")
		T.check(e.minNight <= night, "너무 이른 이벤트 " .. e.id)
	end
end
-- 45% 확률이면 대략 절반쯤
local hits = 0
for seed = 1, 400 do
	if Events.pick(8, T.rng(seed), 0.45, 3) then
		hits += 1
	end
end
T.check(hits > 120 and hits < 240, "이벤트 빈도 대략 45% (" .. hits .. "/400)")

-- 이벤트 보정이 웨이브에 반영되는지
local base = Waves.plan(7, 3, T.rng(7))
local rush = Waves.plan(7, 3, T.rng(7), { countMult = 1.2, spawnMult = 0.65 })
T.check(rush.total >= base.total, "폭주의 밤은 손님이 더 많음")
local sumBase, sumRush = 0, 0
for i = 2, math.min(#base.customers, #rush.customers) do
	sumBase += base.customers[i].delay
	sumRush += rush.customers[i].delay
end
T.check(sumRush < sumBase, "폭주의 밤은 간격이 짧음")
local picky = Waves.plan(7, 3, T.rng(7), { extraOrder = true })
for _, c in picky.customers do
	local orders = CustomerTypes.get(c.typeId).orders
	T.eq(#c.dishes, math.min(3, orders + 1), "까다로운 밤 주문 +1")
end
print("events ok")
