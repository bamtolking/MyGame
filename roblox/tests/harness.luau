--!nocheck
-- Lune용 테스트 하네스.
-- src/shared 폴더를 로블록스 인스턴스 트리처럼 흉내 내서
-- `require(script.Parent.Config.Economy)` 같은 로블록스식 require를 그대로 실행합니다.

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")

local Harness = {}

local nodeMeta = {}
nodeMeta.__index = function(node, key)
	local child = rawget(node, "_children")[key]
	if child then
		return child
	end
	error(string.format("%s is not a valid member of %s", tostring(key), rawget(node, "Name")), 2)
end
nodeMeta.__tostring = function(node)
	return "Node(" .. rawget(node, "_path") .. ")"
end

local function newNode(name, parent, filePath, dirPath)
	local node = setmetatable({
		Name = name,
		Parent = parent,
		_children = {},
		_file = filePath,
		_path = dirPath or filePath or name,
	}, nodeMeta)
	if parent then
		rawget(parent, "_children")[name] = node
	end
	return node
end

local function stripExt(name)
	return (string.gsub(name, "%.luau$", ""))
end

local function mount(dir, parent)
	for _, entry in fs.readDir(dir) do
		local full = dir .. "/" .. entry
		if fs.isDir(full) then
			local node = newNode(entry, parent, nil, full)
			mount(full, node)
		elseif string.match(entry, "%.luau$") and not string.match(entry, "%.server%.luau$")
			and not string.match(entry, "%.client%.luau$") then
			newNode(stripExt(entry), parent, full)
		end
	end
end

local cache = {}

local robloxGlobals = {
	Color3 = roblox.Color3,
	Vector3 = roblox.Vector3,
	Vector2 = roblox.Vector2,
	CFrame = roblox.CFrame,
	UDim2 = roblox.UDim2,
	UDim = roblox.UDim,
	Enum = roblox.Enum,
	NumberSequence = roblox.NumberSequence,
	ColorSequence = roblox.ColorSequence,
	NumberRange = roblox.NumberRange,
	NumberSequenceKeypoint = roblox.NumberSequenceKeypoint,
	ColorSequenceKeypoint = roblox.ColorSequenceKeypoint,
	Font = roblox.Font,
	Rect = roblox.Rect,
	Instance = roblox.Instance,
}

local function customRequire(target)
	if type(target) == "string" then
		return require(target)
	end
	local file = rawget(target, "_file")
	assert(file, "require target is not a module: " .. tostring(target))
	local cached = cache[file]
	if cached ~= nil then
		return cached.value
	end
	local source = fs.readFile(file)
	local env = { script = target, require = customRequire }
	for k, v in robloxGlobals do
		env[k] = v
	end
	local chunk = luau.load(source, { debugName = file, environment = env })
	local value = chunk()
	cache[file] = { value = value }
	return value
end

-- root 폴더를 name이라는 가짜 인스턴스로 올립니다.
function Harness.mount(rootDir, name)
	local root = newNode(name, nil, nil, rootDir)
	mount(rootDir, root)
	return root
end

Harness.require = customRequire
Harness.roblox = robloxGlobals

-- 아주 작은 테스트 러너
local results = { passed = 0, failed = 0, failures = {} }
local currentSuite = ""

function Harness.describe(name, fn)
	currentSuite = name
	fn()
	currentSuite = ""
end

function Harness.it(name, fn)
	local ok, err = pcall(fn)
	if ok then
		results.passed += 1
	else
		results.failed += 1
		table.insert(results.failures, string.format("[%s] %s\n    %s", currentSuite, name, tostring(err)))
	end
end

local function fmt(v)
	if type(v) == "string" then
		return string.format("%q", v)
	end
	return tostring(v)
end

function Harness.eq(actual, expected, msg)
	if actual ~= expected then
		error(string.format("%sexpected %s, got %s", msg and (msg .. ": ") or "", fmt(expected), fmt(actual)), 2)
	end
end

function Harness.near(actual, expected, tol, msg)
	if math.abs(actual - expected) > tol then
		error(string.format("%sexpected %s ± %s, got %s", msg and (msg .. ": ") or "", fmt(expected), fmt(tol), fmt(actual)), 2)
	end
end

function Harness.truthy(v, msg)
	if not v then
		error((msg or "expected truthy") .. ", got " .. fmt(v), 2)
	end
end

function Harness.falsy(v, msg)
	if v then
		error((msg or "expected falsy") .. ", got " .. fmt(v), 2)
	end
end

function Harness.results()
	return results
end

return Harness
