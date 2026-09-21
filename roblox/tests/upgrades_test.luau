local T = require("./TestUtil")
local Upgrades = require("./Upgrades")

for _, u in Upgrades.List do
	T.check(Upgrades.ById[u.id] == u, "ById")
	if u.costs then
		T.eq(#u.costs, u.max, "단계 수만큼 가격: " .. u.id)
		for i = 2, #u.costs do
			T.check(u.costs[i] > u.costs[i - 1], "가격 증가: " .. u.id)
		end
		T.eq(Upgrades.cost(u.id, u.max), nil, "최대면 nil: " .. u.id)
		T.eq(Upgrades.cost(u.id, 0), u.costs[1], "0단계 가격: " .. u.id)
	else
		T.eq(Upgrades.cost(u.id, 0), u.costBase, "반복형 첫 가격")
		T.eq(Upgrades.cost(u.id, 3), u.costBase + 3 * u.costStep, "반복형 값 상승")
	end
end
T.eq(Upgrades.cost("nope", 0), nil, "없는 업그레이드")
T.eq(Upgrades.chopMult(0), 1, "칼 0단계")
T.eq(Upgrades.chopMult(3), 0.25, "칼 3단계")
T.check(math.abs(Upgrades.cookMult(3) - 0.55) < 1e-9, "불 3단계")
T.check(math.abs(Upgrades.patienceMult(2) - 1.24) < 1e-9, "미소 2단계")
T.eq(Upgrades.walkSpeedBonus(2, 2), 4, "신발 2단계")
print("upgrades ok")
