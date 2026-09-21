-- run-in-roblox 용 스크립트: PC 에 Roblox Studio 가 설치되어 있으면 터미널에서 Studio 를 띄워 무인 시연을 돌리고 출력을 받아옵니다.
--   run-in-roblox --place build/GhostDiner.rbxlx --script tests/studio/run_in_studio.luau
-- (https://github.com/rojo-rbx/run-in-roblox — Windows/macOS 전용, Studio 로그인 필요)
local RunService = game:GetService("RunService")
local LogService = game:GetService("LogService")
LogService.MessageOut:Connect(function(message, messageType)
	if string.find(message, "자가진단", 1, true) or messageType == Enum.MessageType.MessageError then
		print(message)
	end
end)
RunService:Run() -- 실행(Run) 모드: 서버 스크립트와 물리가 돌아가고, 플레이어 없이 무인 시연이 시작됨
task.wait(105)
RunService:Stop()
