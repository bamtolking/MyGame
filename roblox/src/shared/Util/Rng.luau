--!strict
-- 시드 고정 난수(퀘스트 선택처럼 "같은 날 같은 결과"가 필요한 곳에 사용).
-- mulberry32 알고리즘. 전투·뽑기에는 Random.new()를 씁니다.

local Rng = {}
Rng.__index = Rng

export type Rng = typeof(setmetatable({} :: { state: number }, Rng))

function Rng.new(seed: number): Rng
	return setmetatable({ state = bit32.band(math.floor(seed), 0xFFFFFFFF) }, Rng)
end

local function mul32(a: number, b: number): number
	-- 32비트 곱셈(하위 32비트). 16비트로 쪼개 double 정밀도 손실 방지
	local aHi, aLo = bit32.rshift(a, 16), bit32.band(a, 0xFFFF)
	local bHi, bLo = bit32.rshift(b, 16), bit32.band(b, 0xFFFF)
	local lo = aLo * bLo
	local mid = bit32.band(aHi * bLo + aLo * bHi, 0xFFFF)
	return bit32.band(lo + mid * 65536, 0xFFFFFFFF)
end

-- [0, 1)
function Rng.next(self: Rng): number
	self.state = bit32.band(self.state + 0x6D2B79F5, 0xFFFFFFFF)
	local t = self.state
	t = mul32(bit32.bxor(t, bit32.rshift(t, 15)), bit32.bor(t, 1))
	t = bit32.bxor(t, t + mul32(bit32.bxor(t, bit32.rshift(t, 7)), bit32.bor(t, 61)))
	t = bit32.band(t, 0xFFFFFFFF)
	return bit32.bxor(t, bit32.rshift(t, 14)) / 4294967296
end

-- [a, b] 정수
function Rng.int(self: Rng, a: number, b: number): number
	return a + math.floor(self:next() * (b - a + 1))
end

return Rng
