--!strict
-- 맵 배치 수치와 좌표 계산. 서버(맵 생성·검증)와 클라이언트(행진 그리기)가 같이 씁니다.
--
--            북(+Z) 출구 포털
--   서쪽 기지 5~8  |도로|  동쪽 기지 1~4
--            남(-Z) 입구 포털 · 광장(순위표)
--
-- 기지 좌표계: 원점 = 기지 입구 가운데 바닥, LookVector = 기지 안쪽.
--   x = 좌우, d = 입구에서 안쪽으로 들어간 거리

local Economy = require(script.Parent.Economy)

local World = {}

World.groundTop = 0
World.floorTop = 1
World.padTop = 1.4

World.road = {
	halfWidth = 9,
	startZ = -178,
	endZ = 178,
	top = 0.2,
}

World.parade = {
	x = 0,
	startZ = -172,
	endZ = 172,
}

World.plot = {
	count = 8,
	frontX = 30,
	width = 68,
	depth = 76,
	wallHeight = 18,
	wallThickness = 2,
	zCenters = { -114, -38, 38, 114 },
}

World.pads = {
	cols = 6,
	rows = 4,
	colSpacing = 11,
	firstRowDepth = 24,
	rowSpacing = 12,
	size = 8,
}

World.front = {
	collect = { x = -14, d = 9 },
	lock = { x = 14, d = 9 },
	spawn = { x = 0, d = 11 },
	plateSize = 8,
}

World.plaza = {
	centerZ = -212,
	spawn = Vector3.new(0, 1, -205),
}

World.bounds = {
	minX = -175,
	maxX = 175,
	minZ = -262,
	maxZ = 205,
}

-- 기지 i의 기준 좌표계
function World.plotFrame(i: number): CFrame
	local side = if i <= 4 then 1 else -1
	local zc = World.plot.zCenters[(i - 1) % 4 + 1]
	local origin = Vector3.new(side * World.plot.frontX, 0, zc)
	return CFrame.lookAt(origin, origin + Vector3.new(side, 0, 0))
end

-- 기지 좌표(x, 높이 y, 깊이 d) → 월드 CFrame(기지 안쪽을 바라봄)
function World.plotPoint(i: number, x: number, y: number, d: number): CFrame
	return World.plotFrame(i) * CFrame.new(x, y, -d)
end

-- 발판 p(1~24)의 기지 좌표
function World.padLocal(p: number): (number, number)
	local cols = World.pads.cols
	local row = math.floor((p - 1) / cols) + 1
	local col = (p - 1) % cols + 1
	local x = -((cols - 1) * World.pads.colSpacing) / 2 + (col - 1) * World.pads.colSpacing
	local d = World.pads.firstRowDepth + (row - 1) * World.pads.rowSpacing
	return x, d
end

-- 발판 위 슬라임 기준점(바닥 중심). 슬라임은 도로 쪽(입구)을 바라봅니다.
function World.padCFrame(i: number, p: number): CFrame
	local x, d = World.padLocal(p)
	return World.plotPoint(i, x, World.padTop, d) * CFrame.Angles(0, math.pi, 0)
end

-- 월드 좌표 → 기지 좌표 (x, y, d)
function World.toPlotLocal(i: number, pos: Vector3): (number, number, number)
	local rel = World.plotFrame(i):PointToObjectSpace(pos)
	return rel.X, rel.Y, -rel.Z
end

function World.isInsidePlot(i: number, pos: Vector3, margin: number?): boolean
	local m = margin or 0
	local x, y, d = World.toPlotLocal(i, pos)
	local half = World.plot.width / 2
	return math.abs(x) <= half + m and d >= -m and d <= World.plot.depth + m and y > -10 and y < 60
end

-- 입구 밖(도로 쪽) 안전한 위치: 잠긴 기지에서 밀어낼 때 사용
function World.outsidePlot(i: number): CFrame
	return World.plotPoint(i, 0, 3, -8) * CFrame.Angles(0, math.pi, 0)
end

function World.spawnCFrame(i: number): CFrame
	return World.plotPoint(i, World.front.spawn.x, World.floorTop + 3, World.front.spawn.d)
		* CFrame.Angles(0, math.pi, 0)
end

World.paradeLength = World.parade.endZ - World.parade.startZ
World.paradeDuration = World.paradeLength / Economy.parade.speed

-- 행진 슬라임이 출발 후 t초에 있는 위치(바닥 중심). 끝을 지나면 nil.
function World.paradePosition(t: number): Vector3?
	if t < 0 or t > World.paradeDuration then
		return nil
	end
	return Vector3.new(World.parade.x, World.road.top, World.parade.startZ + t * Economy.parade.speed)
end

return World
