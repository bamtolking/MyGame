--!nocheck
-- 헤드리스 미리보기용: 실제 게임 코드(MapService, SlimeBuilder)로 맵과 슬라임을 조립해
-- 파트 목록을 JSON으로 내보냅니다. render.py가 이걸 그림으로 그립니다.
-- 실행(roblox 폴더에서): lune run scripts/preview/export.luau <scene> <out.json>
--   scene: map | gallery

local fs = require("@lune/fs")
local process = require("@lune/process")
local serde = require("@lune/serde")
local roblox = require("@lune/roblox")
local H = require("../../tests/harness")

local scene = process.args[1] or "map"
local outPath = process.args[2] or "scene.json"

local Shared = H.mount("src/shared", "Shared")
local req = H.require

local Instance, CFrame, Vector3 = roblox.Instance, roblox.CFrame, roblox.Vector3

local workspaceFolder = Instance.new("Folder")
workspaceFolder.Name = "Workspace"

local fakeReplicated = {
	WaitForChild = function(_self, name)
		assert(name == "Shared")
		return Shared
	end,
}
local fakeGame = {
	GetService = function(_self, name)
		if name == "ReplicatedStorage" then
			return fakeReplicated
		elseif name == "Workspace" then
			return workspaceFolder
		end
		error("service not available in preview: " .. name)
	end,
}

-- 서버 모듈 하나를 가짜 game과 함께 불러오기
local luau = require("@lune/luau")
local function loadServerModule(path)
	local env = { game = fakeGame, script = { Parent = {} }, require = req }
	for k, v in H.roblox do
		env[k] = v
	end
	local chunk = luau.load(fs.readFile(path), { debugName = path, environment = env })
	return chunk()
end

local World = req(Shared.Config.World)
local Slimes = req(Shared.Config.Slimes)
local Mutations = req(Shared.Config.Mutations)
local SlimeBuilder = req(Shared.SlimeBuilder)

local rng = Random and Random.new(7) or nil
math.randomseed(7)
local function rand()
	return math.random()
end

if scene == "map" or scene == "base" then
	local MapService = loadServerModule("src/server/Services/MapService.luau")
	MapService.init()
	-- 기지마다 슬라임을 적당히 채우기
	local slimeFolder = Instance.new("Folder")
	slimeFolder.Name = "PreviewSlimes"
	slimeFolder.Parent = workspaceFolder
	for plot = 1, World.plot.count do
		local count = 6 + (plot * 3) % 13
		for pad = 1, count do
			local s = Slimes.list[math.random(1, #Slimes.list)]
			local muts = { "none", "none", "none", "gold", "diamond", "rainbow", "galaxy", "lava", "candy" }
			local star = math.random(1, 100) > 80 and math.random(2, 5) or 1
			local model = SlimeBuilder.build({ id = s.id, star = star, mut = muts[math.random(1, #muts)] }, World.padCFrame(plot, pad))
			model.Parent = slimeFolder
		end
	end
	-- 행진 슬라임
	for i = 0, 18 do
		local t = i * 2.5
		local pos = World.paradePosition(t)
		if pos then
			local s = Slimes.list[math.random(1, 12)]
			-- +Z(진행 방향)를 바라보게. Lune의 CFrame.lookAt은 Z축에서 반대로 계산되므로 회전으로 지정
			local model = SlimeBuilder.build({ id = s.id, star = 1, mut = "none" }, CFrame.new(pos) * CFrame.Angles(0, math.pi, 0))
			model.Parent = slimeFolder
		end
	end
elseif scene == "gallery" then
	-- 세로 벽처럼 배치(카메라가 정면에서 봄): 30종 6열 + 변이 7종 + ★1~5
	local cols = 6
	local function place(info, col, row, spacing)
		local origin = CFrame.new(col * (spacing or 9), -row * 8.5, 0) * CFrame.Angles(0, math.pi, 0)
		local model = SlimeBuilder.build(info, origin)
		model.Parent = workspaceFolder
	end
	for i, s in Slimes.list do
		place({ id = s.id, star = 1, mut = "none" }, (i - 1) % cols, math.floor((i - 1) / cols))
	end
	for j, m in Mutations.list do
		place({ id = "blobby", star = 1, mut = m.id }, (j - 1) * 6 / 7, 5.2)
	end
	for star = 1, 5 do
		local origin = CFrame.new((star - 1) * 11.5 - 1, -6.6 * 8.5 - 9, 0) * CFrame.Angles(0, math.pi, 0)
		local model = SlimeBuilder.build({ id = "king", star = star, mut = "none" }, origin)
		model.Parent = workspaceFolder
	end
end

local parts = {}
for _, d in workspaceFolder:GetDescendants() do
	if d:IsA("BasePart") and d.Name ~= "Root" and d.Name ~= "Boundary" then
		local cf = d.CFrame
		local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = cf:GetComponents()
		local shape = "Block"
		if d:IsA("Part") then
			shape = tostring(d.Shape.Name)
		end
		if d:FindFirstChildOfClass("SpecialMesh") then
			shape = "Sphere"
		end
		local color = d.Color
		table.insert(parts, {
			n = d.Name,
			sh = shape,
			s = { d.Size.X, d.Size.Y, d.Size.Z },
			cf = { x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 },
			c = { color.R, color.G, color.B },
			t = d.Transparency,
			m = tostring(d.Material.Name),
		})
	end
end
fs.writeFile(outPath, serde.encode("json", parts))
print(string.format("exported %d parts to %s", #parts, outPath))
local _ = rng
local _ = rand
