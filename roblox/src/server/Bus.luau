--!strict
-- 서비스끼리 서로 require 하지 않고 소식을 주고받는 통로(순환 참조 방지).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Signal = require(ReplicatedStorage:WaitForChild("Shared").Util.Signal)

return {
	-- (session, kind: string, amount: number) 퀘스트 진행
	quest = Signal.new(),
	-- (session) 수입 배수에 영향을 주는 상태가 바뀜(업그레이드·패스·친구 등)
	incomeChanged = Signal.new(),
	-- (session, uid) 슬라임이 기지에서 사라짐(판매·합성·도난 완료·환생)
	slimeRemoved = Signal.new(),
	-- (session) 캐릭터가 새로 생김
	characterSpawned = Signal.new(),
	-- (session, plot) 보호 중인 기지에서 밀려남(들고 있던 그 기지 슬라임은 되돌려야 함)
	kickedFromPlot = Signal.new(),
}
