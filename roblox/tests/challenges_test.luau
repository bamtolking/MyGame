local T = require("./TestUtil")
local Challenges = require("./Challenges")

for _, c in Challenges.List do
	T.check(Challenges.ById[c.id] == c, "ById")
	T.check(c.reward > 0 and c.minNight >= 2, "기본값 " .. c.id)
	T.check(c.mode == "min" or c.mode == "max", "모드")
end
T.eq(Challenges.pick(1, T.rng(1)), nil, "첫 밤엔 목표 없음")
for night = 2, 12 do
	for seed = 1, 10 do
		local c = Challenges.pick(night, T.rng(seed + night))
		T.check(c ~= nil and c.minNight <= night, "목표 해금 밤")
	end
end
local tips = Challenges.ById.tips
T.eq(Challenges.done(tips, { tips = 4 }), false, "팁 4/5 미달성")
T.eq(Challenges.done(tips, { tips = 5 }), true, "팁 5/5 달성")
T.check(string.find(Challenges.text(tips, { tips = 2 }), "2/5", 1, true) ~= nil, "진행 문구")
local noburn = Challenges.ById.noburn
T.eq(Challenges.done(noburn, {}), true, "탄 음식 없으면 유지")
T.eq(Challenges.done(noburn, { burnt = 1 }), false, "태우면 실패")
T.check(string.find(Challenges.text(noburn, { burnt = 1 }), "실패", 1, true) ~= nil, "실패 문구")
T.check(string.find(Challenges.text(noburn, {}), "유지", 1, true) ~= nil, "유지 문구")
print("challenges ok")
