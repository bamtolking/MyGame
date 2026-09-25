--!strict
-- ★ 합성 규칙(순수 함수).
-- 같은 종류·같은 ★ 3마리 → ★+1 한 마리. 변이는 셋 중 가장 좋은 것.
-- 재료는 "누른 슬라임 + 변이가 가장 낮은 같은 슬라임 2마리"(즐겨찾기·이동 중인 슬라임 제외).

local Shared = script.Parent.Parent
local Economy = require(Shared.Config.Economy)
local Mutations = require(Shared.Config.Mutations)
local Types = require(Shared.Types)

type SlimeData = Types.SlimeData

local Merge = {}

local function mutOrder(mut: string): number
	local m = Mutations.byId[mut]
	return if m then m.order else 0
end

-- 합성 재료 uid 3개(첫 번째가 target). 불가능하면 nil
function Merge.findSet(slimes: { [string]: SlimeData }, targetUid: string, busy: { [string]: boolean }?): { string }?
	local target = slimes[targetUid]
	if not target or target.star >= Economy.star.max then
		return nil
	end
	if busy and busy[targetUid] then
		return nil
	end
	local candidates: { string } = {}
	for uid, s in slimes do
		if uid ~= targetUid and s.id == target.id and s.star == target.star and not s.fav then
			if not (busy and busy[uid]) then
				table.insert(candidates, uid)
			end
		end
	end
	if #candidates < 2 then
		return nil
	end
	table.sort(candidates, function(a, b)
		local ma, mb = mutOrder(slimes[a].mut), mutOrder(slimes[b].mut)
		if ma ~= mb then
			return ma < mb
		end
		return a < b
	end)
	return { targetUid, candidates[1], candidates[2] }
end

-- 합성 결과(새 슬라임 데이터). 발판은 target 자리.
function Merge.result(slimes: { [string]: SlimeData }, set: { string }): SlimeData
	local target = slimes[set[1]]
	local best = target.mut
	local fav = target.fav == true
	for i = 2, #set do
		local s = slimes[set[i]]
		if mutOrder(s.mut) > mutOrder(best) then
			best = s.mut
		end
	end
	return {
		id = target.id,
		star = target.star + 1,
		mut = best,
		pad = target.pad,
		fav = if fav then true else nil,
	}
end

-- 합성 가능한 조합 수(UI 배지용): 종류·★ 별로 3마리씩 묶은 개수
function Merge.countAvailable(slimes: { [string]: SlimeData }): number
	local groups: { [string]: number } = {}
	for _, s in slimes do
		if s.star < Economy.star.max and not s.fav then
			local key = s.id .. "#" .. s.star
			groups[key] = (groups[key] or 0) + 1
		end
	end
	local n = 0
	for _, count in groups do
		n += count // 3
	end
	return n
end

return Merge
