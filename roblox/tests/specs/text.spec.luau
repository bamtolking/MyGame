--!nocheck
-- 코드에서 쓰는 문구 키가 Text 표에 모두 있는지, 영어/한국어 자리표시자가 같은지 검사합니다.
local fs = require("@lune/fs")

local function walk(dir, out)
	for _, entry in fs.readDir(dir) do
		local full = dir .. "/" .. entry
		if fs.isDir(full) then
			walk(full, out)
		elseif string.match(entry, "%.luau$") then
			table.insert(out, full)
		end
	end
	return out
end

local function placeholders(s)
	local set = {}
	for key in string.gmatch(s, "{(%w+)}") do
		set[key] = true
	end
	return set
end

return function(H, Shared, req)
	local describe, it, truthy = H.describe, H.it, H.truthy
	local Text = req(Shared.Config.Text)
	local Weather = req(Shared.Config.Weather)

	describe("Text", function()
		it("every entry has both languages with the same placeholders", function()
			for key, entry in Text do
				truthy(type(entry.en) == "string" and #entry.en > 0, key .. " en")
				truthy(type(entry.ko) == "string" and #entry.ko > 0, key .. " ko")
				local a, b = placeholders(entry.en), placeholders(entry.ko)
				for p in a do
					truthy(b[p], key .. " ko missing {" .. p .. "}")
				end
				for p in b do
					truthy(a[p], key .. " en missing {" .. p .. "}")
				end
			end
		end)

		it("every key used in code exists", function()
			local used = {}
			local function use(key, where)
				-- "weatherDesc_" .. id 처럼 동적으로 붙이는 접두사는 따로 검사
				if string.sub(key, -1) ~= "_" then
					used[key] = used[key] or where
				end
			end
			for _, file in walk("src", {}) do
				local src = fs.readFile(file)
				for key in string.gmatch(src, 'Lang%.t%("([%w_]+)"') do
					use(key, file)
				end
				for key in string.gmatch(src, 'notify%([^,\n]+,%s*"%w+",%s*"([%w_]+)"') do
					use(key, file)
				end
				for key in string.gmatch(src, 'notifyAll%(%s*"%w+",%s*"([%w_]+)"') do
					use(key, file)
				end
				for key in string.gmatch(src, 'return false, "([%w_]+)"') do
					use(key, file)
				end
				for key in string.gmatch(src, 'return nil, "([%w_]+)"') do
					use(key, file)
				end
				for a, b in string.gmatch(src, 'return nil, if [^\n]- then "([%w_]+)" else "([%w_]+)"') do
					use(a, file)
					use(b, file)
				end
				for key in string.gmatch(src, 'msg = "([%w_]+)"') do
					use(key, file)
				end
				for reason in string.gmatch(src, 'cancel%(theft, "([%w]+)"%)') do
					use("stealFailed_" .. reason, file)
				end
				for key in string.gmatch(src, 'label = "(menu%w+)"') do
					use(key, file)
				end
				for key in string.gmatch(src, '"(tip%u%w+)"') do
					use(key, file)
				end
			end
			for _, e in Weather.events do
				use("weatherDesc_" .. e.id, "Weather")
			end
			local count = 0
			for key, where in used do
				count += 1
				truthy(Text[key], "missing text key '" .. key .. "' used in " .. where)
			end
			truthy(count > 100, "scanner found only " .. count .. " keys")
		end)
	end)
end
