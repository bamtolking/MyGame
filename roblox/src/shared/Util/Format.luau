--!strict
-- 숫자·시간·문장 포맷.

local Format = {}

local SUFFIXES = {
	"K",
	"M",
	"B",
	"T",
	"Qa",
	"Qi",
	"Sx",
	"Sp",
	"Oc",
	"No",
	"Dc",
	"Ud",
	"Dd",
	"Td",
	"Qad",
	"Qid",
	"Sxd",
	"Spd",
	"Ocd",
	"Nod",
	"Vg",
}

-- 1234 → "1.23K", 12345678 → "12.3M"
function Format.number(n: number): string
	if n ~= n then
		return "0"
	end
	if n < 0 then
		return "-" .. Format.number(-n)
	end
	if n < 1000 then
		if n < 10 and n ~= math.floor(n) then
			return string.format("%.1f", math.floor(n * 10) / 10)
		end
		return tostring(math.floor(n))
	end
	-- log10의 부동소수 오차 보정(1000 → 2.9999… 같은 경우)
	local tier = math.max(1, math.floor(math.log10(n) / 3))
	while n >= 10 ^ ((tier + 1) * 3) do
		tier += 1
	end
	while tier > 1 and n < 10 ^ (tier * 3) do
		tier -= 1
	end
	local scaled = n / 10 ^ (tier * 3)
	local suffix = SUFFIXES[tier]
	if not suffix then
		return string.format("%.2e", n)
	end
	local text
	if scaled >= 100 then
		text = string.format("%d", math.floor(scaled))
	elseif scaled >= 10 then
		text = string.format("%.1f", math.floor(scaled * 10) / 10)
	else
		text = string.format("%.2f", math.floor(scaled * 100) / 100)
	end
	-- "1.50" → "1.5", "2.00" → "2"
	if string.find(text, ".", 1, true) then
		text = string.gsub(text, "0+$", "")
		text = string.gsub(text, "%.$", "")
	end
	return text .. suffix
end

function Format.cash(n: number): string
	return "$" .. Format.number(n)
end

-- 초 → "45s" / "4:05" / "1h 05m"
function Format.time(seconds: number): string
	local s = math.max(0, math.floor(seconds))
	if s < 60 then
		return s .. "s"
	elseif s < 3600 then
		return string.format("%d:%02d", s // 60, s % 60)
	else
		return string.format("%dh %02dm", s // 3600, (s % 3600) // 60)
	end
end

-- "Buy {n} slimes" + { n = 3 } → "Buy 3 slimes"
function Format.fill(template: string, args: { [string]: any }?): string
	if not args then
		return template
	end
	local out = string.gsub(template, "{(%w+)}", function(key: string): string
		local v = args[key]
		if v == nil then
			return "{" .. key .. "}"
		end
		return tostring(v)
	end)
	return out
end

-- 배수 표시: 1.5 → "x1.5", 2 → "x2"
function Format.mult(m: number): string
	if m == math.floor(m) then
		return "x" .. Format.number(m)
	end
	if m < 100 then
		local t = string.format("%.2f", m)
		t = string.gsub(t, "0+$", "")
		t = string.gsub(t, "%.$", "")
		return "x" .. t
	end
	return "x" .. Format.number(m)
end

return Format
