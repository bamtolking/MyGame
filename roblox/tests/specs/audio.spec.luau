--!nocheck
-- 소리 설정 검사: 큐가 쓰는 샘플이 모두 있는지, 음정·볼륨 범위, 코드에서 부르는 큐 이름이 모두 있는지.
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

-- Controllers/Sound.luau 의 ALIASES 와 같아야 합니다
local ALIASES = { hit = "bonkHit", alert = "alarm", jump = "hop" }

return function(H, Shared, req)
	local describe, it, truthy, eq = H.describe, H.it, H.truthy, H.eq
	local Audio = req(Shared.Config.Audio)

	describe("Audio", function()
		it("every sample has at least one candidate sound", function()
			for name, list in Audio.samples do
				truthy(#list > 0, name)
				for _, id in list do
					truthy(string.match(id, "^rbxasset") ~= nil, name .. " " .. id)
				end
			end
		end)

		it("custom overrides cover every sample plus the two music tracks", function()
			for name in Audio.samples do
				truthy(Audio.custom[name] ~= nil, "custom." .. name)
			end
			for name, id in Audio.custom do
				truthy(Audio.samples[name] ~= nil or name == "music" or name == "musicFrenzy", "unknown custom " .. name)
				truthy(id == "" or string.match(id, "^rbxassetid://%d+$") ~= nil, "custom." .. name .. " format")
			end
		end)

		it("cue layers use known samples with sane pitch/volume/delay", function()
			local count = 0
			for name, layers in Audio.cues do
				truthy(#layers > 0, name .. " empty")
				for i, l in layers do
					local where = name .. "[" .. i .. "]"
					truthy(Audio.samples[l.s] ~= nil, where .. " sample " .. tostring(l.s))
					truthy(l.p >= 0.25 and l.p <= 4, where .. " pitch " .. l.p)
					truthy(l.v > 0 and l.v <= 1.5, where .. " volume " .. l.v)
					truthy(l.d == nil or (l.d >= 0 and l.d <= 3), where .. " delay")
					count += 1
				end
			end
			truthy(count > 50, "layer count")
		end)

		it("every cue name used in client code exists", function()
			for _, file in walk("src/client", {}) do
				local src = fs.readFile(file)
				for _, pattern in { 'Sound%.play%("(%w+)"', 'Sound%.combo%("(%w+)"', 'Sound%.playAt%("(%w+)"', 'sfx%("(%w+)"' } do
					for name in string.gmatch(src, pattern) do
						local cue = ALIASES[name] or name
						truthy(Audio.cues[cue] ~= nil, file .. ": " .. name)
					end
				end
			end
		end)

		it("music box pattern is well formed", function()
			local m = Audio.music
			truthy(Audio.samples[m.sample] ~= nil, "music sample")
			eq(#m.chords, #m.melody, "one melody bar per chord")
			for _, bar in m.melody do
				eq(#bar, 8, "8 steps per bar")
				for _, n in bar do
					truthy(n == false or type(n) == "number", "note type")
					if type(n) == "number" then
						local speed = m.rootSpeed * Audio.semitone(n)
						truthy(speed > 0.25 and speed < 4, "melody pitch in range")
					end
				end
			end
			truthy(m.frenzyBpm > m.calmBpm, "frenzy is faster")
			truthy(math.abs(Audio.semitone(12) - 2) < 1e-9, "octave doubles speed")
		end)
	end)
end
