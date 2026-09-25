--!nocheck
-- 게임 코드(MapService)로 맵을 만들어 build/MapPreview.rbxm 로 저장합니다.
-- Rojo가 이 파일을 Workspace.Map 으로 넣어서, Studio에서 Play 전에도 맵이 보이게 합니다.
-- (게임이 시작되면 서버가 이 미리보기를 지우고 코드로 다시 만듭니다.)
-- 실행(roblox 폴더에서): lune run scripts/bake-map.luau

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")
local H = require("../tests/harness")

local Shared = H.mount("src/shared", "Shared")

local workspaceFolder = roblox.Instance.new("Folder")
workspaceFolder.Name = "Workspace"

local fakeGame = {
	GetService = function(_self, name)
		if name == "ReplicatedStorage" then
			return {
				WaitForChild = function()
					return Shared
				end,
			}
		elseif name == "Workspace" then
			return workspaceFolder
		end
		error("service not available while baking: " .. name)
	end,
}

local env = { game = fakeGame, script = { Parent = {} }, require = H.require }
for k, v in H.roblox do
	env[k] = v
end
local MapService = luau.load(fs.readFile("src/server/Services/MapService.luau"), {
	debugName = "MapService",
	environment = env,
})()
MapService.init()

local map = workspaceFolder:FindFirstChild("Map")
assert(map, "map was not built")
map:SetAttribute("Preview", true)
-- Lune은 옛 Font(Enum) 속성을 FontFace로 제대로 옮기지 못하므로, 맵 글자(모두 FredokaOne)를 직접 지정
for _, d in map:GetDescendants() do
	if d:IsA("TextLabel") then
		d.FontFace = roblox.Font.fromEnum(roblox.Enum.Font.FredokaOne)
	end
end
fs.writeDir("build")
fs.writeFile("build/MapPreview.rbxm", roblox.serializeModel({ map }))
print(string.format("baked %d instances into build/MapPreview.rbxm", #map:GetDescendants()))
