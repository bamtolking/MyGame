local T = require("./TestUtil")
local Recipes = require("./Recipes")

-- 모든 규칙이 실제 존재하는 재료만 가리키는지
for _, combo in Recipes.Combos do
	for _, input in combo.inputs do
		T.check(Recipes.Items[input], "합치기 재료 없음: " .. input)
	end
	T.check(Recipes.Items[combo.output], "합치기 결과 없음: " .. combo.output)
	for _, input in combo.inputs do
		T.check(Recipes.isComboInput(input), "isComboInput 이 false: " .. input)
	end
end
for _, cook in Recipes.Cooks do
	T.check(Recipes.Items[cook.input], "익히기 재료 없음: " .. cook.input)
	T.check(Recipes.Items[cook.output], "익히기 결과 없음: " .. cook.output)
	T.check(Recipes.StationNames[cook.station], "기구 이름 없음: " .. cook.station)
	T.check(cook.time > 0, "조리 시간 양수")
	T.eq(Recipes.cookFor(cook.input, cook.station), cook, "cookFor 매칭 " .. cook.input)
end
for _, id in Recipes.CrateItems do
	local item = Recipes.Items[id]
	T.check(item and item.kind == "raw", "상자 재료는 raw 여야 함: " .. id)
end
for _, item in Recipes.List do
	if item.chopTo then
		T.check(Recipes.Items[item.chopTo], "썰기 결과 없음: " .. item.chopTo)
	end
	T.check(#item.color == 3, "색은 rgb 3개: " .. item.id)
	if item.kind == "dish" then
		T.check(item.price and item.price > 0, "요리 가격 필요: " .. item.id)
		T.check(item.unlock and item.unlock >= 1, "요리 해금 밤 필요: " .. item.id)
	end
end

-- 모든 요리가 원재료에서 도달 가능한지 (describe 가 상자 단계로 시작하고 요리로 끝나야 함)
local reachable = {}
for _, id in Recipes.CrateItems do
	reachable[id] = true
end
local changed = true
while changed do
	changed = false
	for _, item in Recipes.List do
		if item.chopTo and reachable[item.id] and not reachable[item.chopTo] then
			reachable[item.chopTo] = true
			changed = true
		end
	end
	for _, cook in Recipes.Cooks do
		if reachable[cook.input] and not reachable[cook.output] then
			reachable[cook.output] = true
			changed = true
		end
	end
	for _, combo in Recipes.Combos do
		local ok = true
		for _, input in combo.inputs do
			if not reachable[input] then
				ok = false
			end
		end
		if ok and not reachable[combo.output] then
			reachable[combo.output] = true
			changed = true
		end
	end
end
for _, id in Recipes.allDishes() do
	T.check(reachable[id], "만들 수 없는 요리: " .. id)
	local steps = Recipes.describe(id)
	T.check(#steps >= 2, "레시피 설명이 너무 짧음: " .. id)
	T.check(string.find(steps[1], "재료 상자") ~= nil, "첫 단계는 상자: " .. id .. " / " .. steps[1])
	T.check(string.find(steps[#steps], Recipes.name(id), 1, true) ~= nil, "마지막 단계는 요리: " .. id)
end

-- 합치기: 순서와 무관, 재료가 남거나 모자라면 실패
T.eq(Recipes.findCombo({ "gochujang", "tteok" }).output, "tteokbokki_raw", "순서 무관")
T.eq(Recipes.findCombo({ "tteok", "gochujang", "gim" }), nil, "재료가 남으면 실패")
T.eq(Recipes.findCombo({ "tteok" }), nil, "재료 부족")
T.eq(Recipes.findCombo({ "veg_chopped", "gim", "rice" }).output, "kimbap", "김밥 3재료")
T.eq(Recipes.findCombo({}), nil, "빈 목록")

-- 해금 순서
local n1 = Recipes.dishesForNight(1)
T.check(#n1 >= 2, "첫 밤엔 요리 2개 이상")
for night = 1, 12 do
	T.check(#Recipes.dishesForNight(night) <= #Recipes.dishesForNight(night + 1), "해금은 단조 증가")
end
T.eq(#Recipes.dishesForNight(99), #Recipes.allDishes(), "결국 전부 해금")

-- 이름·가격
T.eq(Recipes.name("tteokbokki"), "떡볶이", "이름")
T.eq(Recipes.price("kimbap"), 18, "가격")
T.eq(Recipes.price("veg"), 0, "재료는 가격 0")
T.check(Recipes.isDish("eomuk") and not Recipes.isDish("eomuk_raw"), "isDish")

print("recipes ok:", #Recipes.List, "items,", #Recipes.allDishes(), "dishes")
