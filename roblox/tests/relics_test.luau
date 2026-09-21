local T = require("./TestUtil")
local Relics = require("./Relics")
local Talismans = require("./Talismans")
local Reviews = require("./Reviews")

for _, r in Relics.List do
	T.check(Relics.ById[r.id] == r and #r.name > 0 and #r.desc > 0, "유물 " .. r.id)
end
T.eq(#Talismans.List, 3, "부적 3종")
for _, t in Talismans.List do
	T.check(Talismans.ById[t.id] == t, "부적 " .. t.id)
end

-- 제시: 보유한 것은 빠지고 서로 다른 3개
local owned = { ladle = true, club = true }
for seed = 1, 30 do
	local offer = Relics.offer(owned, T.rng(seed), 3)
	T.eq(#offer, 3, "3개 제시")
	local seen = {}
	for _, id in offer do
		T.check(not owned[id], "보유 유물 제외: " .. id)
		T.check(not seen[id], "중복 없음")
		seen[id] = true
		T.check(Relics.ById[id], "존재하는 유물")
	end
end
local almost = {}
for _, r in Relics.List do
	almost[r.id] = true
end
almost.ink = nil
T.eq(#Relics.offer(almost, T.rng(1), 3), 1, "남은 만큼만 제시")
T.eq(#Relics.offer(Relics.ById and (function()
	local all = {}
	for _, r in Relics.List do
		all[r.id] = true
	end
	return all
end)() or {}, T.rng(1), 3), 0, "전부 보유하면 없음")

-- 투표 집계
local offer = { "ladle", "club", "wind" }
T.eq(Relics.tally(offer, {}, T.rng(1)), nil, "표 없음")
T.eq(Relics.tally(offer, { [1] = 2, [2] = 2, [3] = 1 }, T.rng(1)), "club", "최다 득표")
T.eq(Relics.tally(offer, { [1] = 9 }, T.rng(1)), nil, "잘못된 번호는 무시")
local tie = Relics.tally(offer, { [1] = 1, [2] = 3 }, T.rng(7))
T.check(tie == "ladle" or tie == "wind", "동률은 둘 중 하나")

-- 리뷰: 항상 3줄, 조건별 대사 포함
local r1 = Reviews.generate({ served = 40, angry = 0, burnt = 0, fires = 0, maxCombo = 7, night = 11, tips = 12 }, T.rng(3))
T.eq(#r1, 3, "리뷰 3줄")
local r2 = Reviews.generate({ served = 2, angry = 5, burnt = 4, fires = 2, maxCombo = 1, night = 2, tips = 0 }, T.rng(4))
T.eq(#r2, 3, "리뷰 3줄(나쁜 판)")
local joined = table.concat(r2, "\n")
T.check(string.find(joined, "악귀", 1, true) ~= nil or string.find(joined, "탄 냄새", 1, true) ~= nil or string.find(joined, "불이", 1, true) ~= nil, "나쁜 판 대사")
local r3 = Reviews.generate({}, T.rng(5))
T.eq(#r3, 3, "빈 기록도 3줄")
print("relics ok")
