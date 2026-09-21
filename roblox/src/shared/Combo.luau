--!strict
-- 연속 서빙 콤보: 정해진 시간 안에 계속 서빙하면 보상 배율이 오릅니다.
-- 악귀가 생기거나 음식을 태우면 끊깁니다.
local Combo = {}

-- 콤보 수 → 코인 배율 (2번째 서빙부터 +10%씩, 최대 2배)
function Combo.multiplier(count: number): number
	if count <= 1 then
		return 1
	end
	return math.min(2, 1 + 0.1 * (count - 1))
end

-- 화면 표시용
function Combo.label(count: number): string
	if count <= 1 then
		return ""
	end
	return string.format("콤보 x%d  (보상 ×%.1f)", count, Combo.multiplier(count))
end

return Combo
