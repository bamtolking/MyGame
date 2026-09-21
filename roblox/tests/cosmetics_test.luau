local T = require("./TestUtil")
local Cosmetics = require("./Cosmetics")

local prev = -1
for _, h in Cosmetics.Hats do
	T.check(h.fame >= prev, "모자는 명성 오름차순")
	prev = h.fame
	T.check(Cosmetics.ById[h.id] == h, "ById")
end
T.check(Cosmetics.isUnlocked("paper", 0) and Cosmetics.isUnlocked("none", 0), "기본 모자")
T.check(not Cosmetics.isUnlocked("crown", 1499) and Cosmetics.isUnlocked("crown", 1500), "왕관 1500")
T.check(not Cosmetics.isUnlocked("nope", 99999), "없는 모자")
T.eq(Cosmetics.nextUnlock(0).id, "chef", "다음 해금")
T.eq(Cosmetics.nextUnlock(1500), nil, "전부 해금")
T.eq(Cosmetics.fameForNight(3, 5), 8, "밤 명성")
print("cosmetics ok")
