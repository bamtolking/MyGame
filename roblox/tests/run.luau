--!nocheck
-- 실행: lune run tests/run.luau   (roblox 폴더에서)
local process = require("@lune/process")
local fs = require("@lune/fs")
local H = require("./harness")

local Shared = H.mount("src/shared", "Shared")
local req = H.require

local specs = {}
for _, entry in fs.readDir("tests/specs") do
	if string.match(entry, "%.spec%.luau$") then
		table.insert(specs, entry)
	end
end
table.sort(specs)

for _, entry in specs do
	local spec = require("./specs/" .. string.gsub(entry, "%.luau$", ""))
	spec(H, Shared, req)
end

local r = H.results()
for _, f in r.failures do
	print("FAIL " .. f)
end
print(string.format("\n%d passed, %d failed", r.passed, r.failed))
if r.failed > 0 then
	process.exit(1)
end
