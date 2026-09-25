--!strict
-- 반복 작업 도우미: 한 번의 오류가 루프 전체를 멈추지 않게 합니다.

local Loop = {}

-- fn을 안전하게 실행. 오류가 나면 label과 함께 경고를 남기고 false
function Loop.try(label: string, fn: () -> ()): boolean
	local packed = table.pack(pcall(fn))
	if not packed[1] then
		warn(string.format("[%s] %s", label, tostring(packed[2])))
		return false
	end
	return true
end

-- interval초마다 fn 실행(별도 스레드)
function Loop.every(label: string, interval: number, fn: () -> ())
	task.spawn(function()
		while true do
			task.wait(interval)
			Loop.try(label, fn)
		end
	end)
end

return Loop
