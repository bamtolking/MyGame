--!strict
-- 3D 슬라임 미리보기(ViewportFrame).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local SlimeBuilder = require(Shared.SlimeBuilder)

local Kit = require(script.Parent.Kit)

local Viewport = {}

export type Info = { id: string, star: number, mut: string }

function Viewport.slime(parent: Instance, info: Info, props: Kit.Props?): ViewportFrame
	local vf = Kit.new("ViewportFrame", {
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		Ambient = Color3.fromRGB(190, 190, 200),
		LightColor = Color3.fromRGB(255, 255, 255),
		LightDirection = Vector3.new(-0.4, -1, 0.6),
	}) :: ViewportFrame
	if props then
		for k, v in props do
			(vf :: any)[k] = v
		end
	end
	Viewport.set(vf, info)
	vf.Parent = parent
	return vf
end

-- 이미 있는 뷰포트의 슬라임을 바꿉니다.
function Viewport.set(vf: ViewportFrame, info: Info)
	for _, c in vf:GetChildren() do
		if c:IsA("Model") or c:IsA("Camera") then
			c:Destroy()
		end
	end
	-- ★ 크기와 상관없이 같은 크기로 보이게 1배로 만들고, 장식 높이를 고려해 카메라를 둡니다
	local model = SlimeBuilder.build({ id = info.id, star = 1, mut = info.mut })
	model.Parent = vf
	local cam = Instance.new("Camera")
	cam.FieldOfView = 40
	cam.CFrame = CFrame.lookAt(Vector3.new(3.2, 4.2, -10.5), Vector3.new(0, 2.3, 0))
	cam.Parent = vf
	vf.CurrentCamera = cam
end

return Viewport
