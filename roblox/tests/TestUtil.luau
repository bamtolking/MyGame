-- 테스트 보조: 단언과 Roblox Random 과 같은 메서드를 가진 결정적 난수
local TestUtil = {}

function TestUtil.check(cond, msg)
	if not cond then
		error("검증 실패: " .. tostring(msg), 2)
	end
end

function TestUtil.eq(a, b, msg)
	if a ~= b then
		error(string.format("검증 실패: %s (기대 %s, 실제 %s)", tostring(msg), tostring(b), tostring(a)), 2)
	end
end

-- 32비트 LCG. Roblox 의 Random:NextNumber()/NextInteger(a,b) 와 같은 형태
function TestUtil.rng(seed)
	local state = ((seed or 1) * 7919 + 12345) % 2147483647
	local self = {}
	local function step()
		state = (state * 48271) % 2147483647
		return state
	end
	-- 작은 시드끼리 첫 값이 비슷해지는 것을 막기 위해 몇 번 돌림
	for _ = 1, 5 do
		step()
	end
	function self:NextNumber(a, b)
		local v = step() / 2147483647
		if a and b then
			return a + (b - a) * v
		end
		return v
	end
	function self:NextInteger(a, b)
		return a + (step() % (b - a + 1))
	end
	return self
end

return TestUtil
