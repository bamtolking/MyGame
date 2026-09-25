--!nocheck
-- 경제 밸런스 시뮬레이션(실제 Config/Logic 사용).
-- 실행(roblox 폴더에서): lune run tests/balance.luau [runs] [hours] [--write]
--   --write 를 주면 docs/BALANCE.md 를 갱신합니다.
--
-- 가정(보수적): 서버 8명이 행진을 나눠 가짐 → 영웅 이상은 35%, 나머지는 70% 확률로 내가 삼.
-- 수금은 자주 함, 날씨 6분 주기, 매시 정각 대폭주, 합성은 가능할 때 즉시, 발판 업그레이드는 싸면 삼.
-- 훔치기·오프라인 수입·출석/퀘스트/선물 보상은 넣지 않음(실제 플레이는 이보다 빠름).

local fs = require("@lune/fs")
local process = require("@lune/process")
local H = require("./harness")

local Shared = H.mount("src/shared", "Shared")
local req = H.require
local Economy = req(Shared.Config.Economy)
local Slimes = req(Shared.Config.Slimes)
local Rarities = req(Shared.Config.Rarities)
local Weather = req(Shared.Config.Weather)
local Calc = req(Shared.Logic.Calc)
local Roll = req(Shared.Logic.Roll)
local Merge = req(Shared.Logic.Merge)
local Data = req(Shared.Logic.Data)
local Rng = req(Shared.Util.Rng)

local runs = tonumber(process.args[1]) or 12
local hours = tonumber(process.args[2]) or 6
local write = table.find(process.args, "--write") ~= nil

local noCtx = { vip = false, doubleCash = false, friends = 0, group = false, frenzy = false }

local function paradePrice(id, mut)
	local species = Slimes.byId[id]
	return math.floor(species.price * (1 + (Calc.mutMult(mut) - 1) * 0.5))
end

local function simulate(seed)
	local rng = Rng.new(seed)
	local rand = function()
		return rng:next()
	end
	local d = Data.default()
	local events = {}
	local function mark(name, t)
		if not events[name] then
			events[name] = t
		end
	end
	local incomeAt = {}
	local rebirthTimes = {}
	local weather, weatherEnds, nextWeather = nil, 0, 90
	local T = hours * 3600

	for t = 1, T do
		-- 날씨
		local frenzy = (t % 3600) < Weather.frenzy.duration
		if weather and t >= weatherEnds then
			weather, nextWeather = nil, t + Weather.calmDuration
		elseif not weather and t >= nextWeather then
			weather = Roll.pickWeighted(Weather.events, function(e)
				return e.weight
			end, rand)
			weatherEnds = t + weather.duration
		end
		local luck = (weather and weather.luck or 1) * (frenzy and Weather.frenzy.luck or 1)
		noCtx.frenzy = frenzy

		-- 수입
		local income = Calc.incomePerSecond(d, noCtx)
		d.cash += income
		d.totalEarned += income

		-- 행진
		if t % Economy.parade.interval < 1 then
			local rarity = Roll.rarity(luck, rand)
			local id = Roll.species(rarity, rand)
			local mut = Roll.paradeMutation(weather and weather.mutation or nil, rand)
			local price = paradePrice(id, mut)
			local order = Rarities.byId[rarity].order
			local win = if order >= 4 then 0.35 else 0.7
			if price <= d.cash and rand() < win then
				local newIncome = Calc.slimeIncome({ id = id, star = 1, mut = mut })
				local padCount = Calc.padCount(d, false)
				local pad = Data.freePad(d, padCount)
				local sellUid = nil
				if not pad then
					-- 가장 약한 슬라임과 교체(1.5배 이상 좋을 때)
					local worst, worstIncome = nil, math.huge
					for uid, s in d.slimes do
						local inc = Calc.slimeIncome(s)
						if inc < worstIncome then
							worst, worstIncome = uid, inc
						end
					end
					if worst and newIncome > worstIncome * 1.5 then
						sellUid = worst
					end
				end
				if pad or sellUid then
					if sellUid then
						d.cash += Calc.sellPrice(d.slimes[sellUid])
						pad = d.slimes[sellUid].pad
						d.slimes[sellUid] = nil
					end
					d.cash -= price
					local uid = Data.newUid(d)
					d.slimes[uid] = { id = id, star = 1, mut = mut, pad = pad }
					Data.discover(d, id, mut)
					mark("first_" .. rarity, t)
					-- 합성
					local merged = true
					while merged do
						merged = false
						for u in d.slimes do
							local set = Merge.findSet(d.slimes, u)
							if set then
								local result = Merge.result(d.slimes, set)
								for i = 2, #set do
									d.slimes[set[i]] = nil
								end
								d.slimes[u] = result
								Data.discover(d, result.id, result.mut)
								mark("first_star" .. result.star, t)
								merged = true
								break
							end
						end
					end
				end
			end
		end

		-- 날씨 변이(기지)
		if weather and t % Weather.baseMutationInterval == 0 then
			for _, s in d.slimes do
				if rand() < Weather.baseMutationChance and Roll.isBetterMutation(weather.mutation, s.mut) then
					s.mut = weather.mutation
					Data.discover(d, s.id, s.mut)
				end
			end
		end

		-- 업그레이드: 발판은 수입 90초치 이하면 삼
		local cost = Calc.upgradeCost("pads", Calc.upgradeLevel(d, "pads"))
		if cost and cost <= math.max(d.cash * 0.5, 0) and cost <= income * 90 + 500 then
			d.cash -= cost
			d.upgrades.pads = Calc.upgradeLevel(d, "pads") + 1
		end
		local lcost = Calc.upgradeCost("luck", Calc.upgradeLevel(d, "luck"))
		if lcost and lcost <= d.cash * 0.2 then
			d.cash -= lcost
			d.upgrades.luck = Calc.upgradeLevel(d, "luck") + 1
		end

		-- 환생
		if Calc.canRebirth(d) then
			local keep = nil
			local best = -1
			for _, s in d.slimes do
				local inc = Calc.slimeIncome(s)
				if inc > best then
					best, keep = inc, s
				end
			end
			d.slimes = {}
			if keep then
				d.slimes["k" .. t] = { id = keep.id, star = keep.star, mut = keep.mut, pad = 1, fav = true }
			end
			d.cash = Economy.startCash
			d.rebirths += 1
			table.insert(rebirthTimes, t)
		end

		if t % 600 == 0 then
			incomeAt[t // 60] = income
		end
	end
	return { events = events, incomeAt = incomeAt, rebirths = rebirthTimes, index = Calc.indexCount(d), final = d }
end

local function median(list)
	if #list == 0 then
		return nil
	end
	table.sort(list)
	return list[math.floor((#list + 1) / 2)]
end

local function fmtTime(t)
	if not t then
		return "—"
	end
	if t < 3600 then
		return string.format("%d분", math.floor(t / 60 + 0.5))
	end
	return string.format("%.1f시간", t / 3600)
end

local results = {}
for i = 1, runs do
	table.insert(results, simulate(1000 + i * 17))
end

local lines = {}
local function out(s)
	print(s)
	table.insert(lines, s)
end

out("# 밸런스 시뮬레이션 결과")
out("")
out(string.format("`lune run tests/balance.luau %d %d --write` 로 생성 (시드 %d개, 각 %d시간, 중앙값).", runs, hours, runs, hours))
out("")
out("가정: 서버 8명이 행진을 나눠 가짐(영웅 이상 35%, 그 외 70% 확률로 구매 성공), 수금은 자주, 합성은 즉시,")
out("발판·행운 업그레이드는 쌀 때 구매, 환생은 가능하면 즉시(가장 좋은 슬라임 1마리 유지).")
out("훔치기·오프라인 수입·출석/퀘스트/선물 보상·게임패스는 **넣지 않았으므로** 실제 플레이는 이보다 빠릅니다.")
out("")
out("## 첫 달성 시각")
out("")
out("| 목표 | 중앙값 | 달성한 판 |")
out("|---|---|---|")
local milestones = {
	{ "first_uncommon", "첫 고급" },
	{ "first_rare", "첫 희귀" },
	{ "first_epic", "첫 영웅" },
	{ "first_legendary", "첫 전설" },
	{ "first_mythic", "첫 신화" },
	{ "first_secret", "첫 비밀" },
	{ "first_star2", "첫 ★2 합성" },
	{ "first_star3", "첫 ★3 합성" },
	{ "first_star4", "첫 ★4 합성" },
}
for _, m in milestones do
	local times = {}
	for _, r in results do
		if r.events[m[1]] then
			table.insert(times, r.events[m[1]])
		end
	end
	out(string.format("| %s | %s | %d/%d |", m[2], fmtTime(median(times)), #times, runs))
end
out("")
out("## 환생")
out("")
out("| 환생 | 필요 현금 | 필요 등급 | 도달 시각(중앙값) | 달성한 판 |")
out("|---|---|---|---|---|")
for k = 1, 8 do
	local times = {}
	for _, r in results do
		if r.rebirths[k] then
			table.insert(times, r.rebirths[k])
		end
	end
	out(string.format(
		"| %d | $%s | %s | %s | %d/%d |",
		k,
		req(Shared.Util.Format).number(Calc.rebirthCost(k - 1)),
		Rarities.byId[Calc.rebirthRarityReq(k - 1)].name.ko,
		fmtTime(median(times)),
		#times,
		runs
	))
end
out("")
out("## 초당 수입(중앙값)")
out("")
out("| 경과 | 초당 수입 |")
out("|---|---|")
local Format = req(Shared.Util.Format)
for _, minute in { 10, 30, 60, 120, 180, 240, 360 } do
	if minute <= hours * 60 then
		local list = {}
		for _, r in results do
			if r.incomeAt[minute] then
				table.insert(list, r.incomeAt[minute])
			end
		end
		out(string.format("| %s | %s |", fmtTime(minute * 60), Format.cash(median(list) or 0)))
	end
end
local idx = {}
for _, r in results do
	table.insert(idx, r.index)
end
out("")
out(string.format("도감 발견(%d시간 후, 중앙값): %d / %d", hours, median(idx), Calc.indexTotal()))

if write then
	fs.writeFile("docs/BALANCE.md", table.concat(lines, "\n") .. "\n")
	print("\nwrote docs/BALANCE.md")
end
