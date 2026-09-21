--!strict
-- 폐업 리뷰: 그 판의 기록을 보고 손님들이 남기는 별점 한 줄.
local Reviews = {}

export type Stats = { [string]: any }

local function n(stats: Stats, key: string): number
	local v = stats[key]
	return if type(v) == "number" then v else 0
end

-- 3줄을 돌려줌 (조건에 맞는 것 우선, 부족하면 기본 대사)
function Reviews.generate(stats: Stats, rng: any): { string }
	local served, angry, burnt, fires = n(stats, "served"), n(stats, "angry"), n(stats, "burnt"), n(stats, "fires")
	local maxCombo, night, tips = n(stats, "maxCombo"), n(stats, "night"), n(stats, "tips")
	local special = {}
	local function add(text: string)
		table.insert(special, text)
	end
	if served > 0 and angry == 0 then
		add("처녀귀신: 기다리는 동안 한 번도 화가 안 났어요. 여기가 극락인가요? ★★★★★")
	end
	if angry > served then
		add("저승사자: 기다리다 지쳐 다들 악귀가 됐다. 다음엔 명부부터 적겠다. ★☆☆☆☆")
	elseif angry >= 3 then
		add("꼬마 도깨비: 화난 친구들이 조리대를 부쉈어요. 솔직히 재밌었어요! ★★☆☆☆")
	end
	if burnt >= 3 then
		add("구미호: 탄 냄새가 아직 꼬리 아홉 개에 배어 있어요. ★★☆☆☆")
	elseif burnt == 0 and served >= 5 then
		add("배고픈 호랑이: 탄 음식이 하나도 없다니. 크르릉(칭찬이다). ★★★★☆")
	end
	if fires > 0 then
		add(string.format("산신령: 주방에 불이 %d번 났더구나. 불구경은 좋았다. ★★★☆☆", fires))
	end
	if maxCombo >= 5 then
		add(string.format("구미호: 콤보 x%d… 이런 손놀림은 이승에서도 못 봤어요. ★★★★★", maxCombo))
	end
	if tips >= 10 then
		add(string.format("저승사자: 팁을 %d번이나 받아 갔다. 빠른 자에게 복이 있으리. ★★★★★", tips))
	end
	if night >= 10 then
		add("저승사자: 열 번째 밤을 넘긴 인간은 백 년 만이다. ★★★★★")
	elseif night <= 2 then
		add("꼬마 도깨비: 문 열자마자 닫았어요? 배고파요… ★☆☆☆☆")
	end
	if served >= 30 then
		add(string.format("처녀귀신: 영혼 %d명을 배불리 보냈어요. 다들 성불했대요. ★★★★★", served))
	end
	local generic = {
		"꼬마 도깨비: 라면은 맛있었는데 자리가 좁아요. ★★★☆☆",
		"처녀귀신: 등불이 예뻐서 별 하나 더. ★★★★☆",
		"저승사자: 메뉴판 글씨가 작다. 안경을 쓰고 왔어야 했나. ★★★☆☆",
		"구미호: 요리사 모자가 귀여워서 봐 드릴게요. ★★★★☆",
		"배고픈 호랑이: 인절미… 다음엔 인절미를 달라. ★★★☆☆",
	}
	local out = {}
	while #out < 3 and #special > 0 do
		local idx = rng:NextInteger(1, #special)
		table.insert(out, special[idx])
		table.remove(special, idx)
	end
	while #out < 3 and #generic > 0 do
		local idx = rng:NextInteger(1, #generic)
		table.insert(out, generic[idx])
		table.remove(generic, idx)
	end
	return out
end

return Reviews
