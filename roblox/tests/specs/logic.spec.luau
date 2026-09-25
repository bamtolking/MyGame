--!nocheck
return function(H, Shared, req)
	local describe, it, eq, near, truthy, falsy = H.describe, H.it, H.eq, H.near, H.truthy, H.falsy

	local Format = req(Shared.Util.Format)
	local Rng = req(Shared.Util.Rng)
	local Slimes = req(Shared.Config.Slimes)
	local Rarities = req(Shared.Config.Rarities)
	local Mutations = req(Shared.Config.Mutations)
	local Economy = req(Shared.Config.Economy)
	local Weather = req(Shared.Config.Weather)
	local Rewards = req(Shared.Config.Rewards)
	local Calc = req(Shared.Logic.Calc)
	local Roll = req(Shared.Logic.Roll)
	local Merge = req(Shared.Logic.Merge)
	local Data = req(Shared.Logic.Data)
	local Progress = req(Shared.Logic.Progress)

	local noCtx = { vip = false, doubleCash = false, friends = 0, group = false, frenzy = false }

	describe("Format", function()
		it("formats small numbers", function()
			eq(Format.number(0), "0")
			eq(Format.number(7), "7")
			eq(Format.number(999), "999")
			eq(Format.number(2.5), "2.5")
		end)
		it("formats suffixes", function()
			eq(Format.number(1000), "1K")
			eq(Format.number(1234), "1.23K")
			eq(Format.number(12345), "12.3K")
			eq(Format.number(123456), "123K")
			eq(Format.number(999999), "999K")
			eq(Format.number(1500000), "1.5M")
			eq(Format.number(2e9), "2B")
			eq(Format.number(3.25e12), "3.25T")
			eq(Format.number(1e15), "1Qa")
		end)
		it("never rounds up into 1000X", function()
			eq(Format.number(999999.9), "999K")
		end)
		it("formats time", function()
			eq(Format.time(45), "45s")
			eq(Format.time(65), "1:05")
			eq(Format.time(3725), "1h 02m")
		end)
		it("fills templates", function()
			eq(Format.fill("Buy {n} slimes", { n = 3 }), "Buy 3 slimes")
			eq(Format.fill("{a}-{missing}", { a = 1 }), "1-{missing}")
		end)
		it("formats multipliers", function()
			eq(Format.mult(2), "x2")
			eq(Format.mult(1.5), "x1.5")
			eq(Format.mult(1.25), "x1.25")
		end)
	end)

	describe("Rng", function()
		it("is deterministic and in range", function()
			local a, b = Rng.new(42), Rng.new(42)
			for _ = 1, 1000 do
				local x = a:next()
				eq(x, b:next())
				truthy(x >= 0 and x < 1, "range")
			end
		end)
		it("is roughly uniform", function()
			local r = Rng.new(7)
			local buckets = { 0, 0, 0, 0 }
			for _ = 1, 40000 do
				local i = r:int(1, 4)
				buckets[i] += 1
			end
			for i = 1, 4 do
				near(buckets[i], 10000, 400, "bucket " .. i)
			end
		end)
	end)

	describe("Config", function()
		it("has 30 slimes covering every rarity", function()
			eq(#Slimes.list, 30)
			for _, r in Rarities.list do
				truthy(Slimes.byRarity[r.id] and #Slimes.byRarity[r.id] > 0, "rarity " .. r.id)
			end
		end)
		it("prices increase within and across rarities", function()
			local lastIncome = 0
			for _, r in Rarities.list do
				for _, s in Slimes.byRarity[r.id] do
					truthy(s.income > lastIncome, s.id .. " income should increase")
					lastIncome = s.income
					truthy(s.price >= s.income, s.id .. " price")
				end
			end
		end)
		it("every weather mutation exists", function()
			for _, e in Weather.events do
				truthy(Mutations.byId[e.mutation], e.id)
			end
			for _, id in Weather.frenzy.events do
				truthy(Weather.byId[id], id)
			end
		end)
		it("rebirth rarity requirements exist", function()
			for _, id in Economy.rebirth.rarityReq do
				truthy(Rarities.byId[id], id)
			end
		end)
		it("gift rarities exist", function()
			for _, d in Rewards.daily do
				if d.giftRarity then
					truthy(Rarities.byId[d.giftRarity])
				end
			end
			for _, g in Rewards.gifts do
				if g.reward.giftRarity then
					truthy(Rarities.byId[g.reward.giftRarity])
				end
			end
		end)
	end)

	describe("Calc", function()
		it("computes slime income with star and mutation", function()
			local s = { id = "blobby", star = 2, mut = "gold", pad = 1 }
			eq(Calc.slimeIncome(s), 1 * 3.5 * 2)
		end)
		it("merging is always worth more income than the 3 inputs", function()
			for star = 1, Economy.star.max - 1 do
				truthy(Calc.starMult(star + 1) > 3 * Calc.starMult(star), "star " .. star)
			end
		end)
		it("applies multipliers", function()
			local d = Data.default()
			d.slimes["1"] = { id = "blobby", star = 1, mut = "none", pad = 1 }
			eq(Calc.incomePerSecond(d, noCtx), 1)
			d.rebirths = 2
			eq(Calc.incomePerSecond(d, noCtx), 2)
			d.boosts.cash2x = 10
			eq(Calc.incomePerSecond(d, noCtx), 4)
			local ctx = { vip = true, doubleCash = true, friends = 10, group = false, frenzy = true }
			near(Calc.incomePerSecond(d, ctx), 4 * 1.5 * 2 * 1.4 * 2, 1e-9)
		end)
		it("index bonus counts only known combos", function()
			local d = Data.default()
			Data.discover(d, "blobby", "none")
			Data.discover(d, "blobby", "gold")
			d.index.fake = { none = true }
			eq(Calc.indexCount(d), 2)
			eq(Calc.indexTotal(), #Slimes.list * #Mutations.list)
		end)
		it("upgrade costs grow and cap", function()
			for _, u in Economy.upgrades do
				local last = 0
				for lvl = 0, u.maxLevel - 1 do
					local c = Calc.upgradeCost(u.id, lvl)
					truthy(c and c > last, u.id .. " lvl " .. lvl)
					last = c
				end
				eq(Calc.upgradeCost(u.id, u.maxLevel), nil)
			end
		end)
		it("pad count respects gamepass and max", function()
			local d = Data.default()
			eq(Calc.padCount(d, false), Economy.basePads)
			d.upgrades.pads = 10
			eq(Calc.padCount(d, false), 20)
			eq(Calc.padCount(d, true), 24)
		end)
		it("offline earnings cap and rate", function()
			local d = Data.default()
			local amount, counted = Calc.offlineEarnings(d, 30, 100)
			eq(amount, 0)
			amount, counted = Calc.offlineEarnings(d, 3600, 100)
			eq(counted, 3600)
			eq(amount, 3600 * 100 * 0.2)
			amount, counted = Calc.offlineEarnings(d, 99999, 100)
			eq(counted, 2 * 3600)
			d.upgrades.offline = 5
			amount, counted = Calc.offlineEarnings(d, 99999, 100)
			eq(counted, 7 * 3600)
			near(amount, 7 * 3600 * 100 * 0.7, 1)
		end)
		it("rebirth needs cash and rarity", function()
			local d = Data.default()
			d.cash = Calc.rebirthCost(0)
			local ok, why = Calc.canRebirth(d)
			falsy(ok)
			eq(why, "rebirthNeedRarity")
			d.slimes["1"] = { id = "ninja", star = 1, mut = "none", pad = 1 }
			ok = Calc.canRebirth(d)
			truthy(ok)
			d.cash -= 1
			ok, why = Calc.canRebirth(d)
			falsy(ok)
			eq(why, "rebirthNeedCash")
			eq(Calc.rebirthRarityReq(50), "secret")
		end)
		it("carry speed is clamped", function()
			eq(Calc.carrySpeedMult({ id = "slimegod", star = 5 }, false), Economy.steal.minCarryMult)
			near(Calc.carrySpeedMult({ id = "blobby", star = 1 }, false), 0.9, 1e-9)
			eq(Calc.carrySpeedMult({ id = "blobby", star = 1 }, true), 1)
		end)
		it("steal hold grows with rarity and star", function()
			truthy(Calc.stealHold({ id = "slimegod", star = 5 }) > Calc.stealHold({ id = "blobby", star = 1 }))
		end)
		it("sell price is half the value", function()
			local s = { id = "king", star = 3, mut = "diamond" }
			eq(Calc.sellPrice(s), math.floor(Slimes.byId.king.price * 9 * 3 * 0.5))
		end)
	end)

	describe("Roll", function()
		local function rand(seed)
			local r = Rng.new(seed)
			return function()
				return r:next()
			end
		end
		it("rarity chances sum to 1", function()
			local total = 0
			for _, p in Roll.rarityChances(1) do
				total += p
			end
			near(total, 1, 1e-9)
		end)
		it("luck raises rare chances", function()
			local base = Roll.rarityChances(1)
			local lucky = Roll.rarityChances(5)
			truthy(lucky.secret > base.secret * 3, "secret")
			truthy(lucky.common < base.common, "common")
		end)
		it("rolls roughly match the table", function()
			local rf = rand(123)
			local counts = {}
			local n = 200000
			for _ = 1, n do
				local id = Roll.rarity(1, rf)
				counts[id] = (counts[id] or 0) + 1
			end
			local chances = Roll.rarityChances(1)
			for id, p in chances do
				near((counts[id] or 0) / n, p, 0.01 + p * 0.1, id)
			end
		end)
		it("min order filter works", function()
			local rf = rand(9)
			for _ = 1, 500 do
				local id = Roll.rarity(1, rf, 4)
				truthy(Rarities.byId[id].order >= 4, id)
			end
		end)
		it("species belongs to the rarity", function()
			local rf = rand(5)
			for _, r in Rarities.list do
				for _ = 1, 50 do
					eq(Slimes.byId[Roll.species(r.id, rf)].rarity, r.id)
				end
			end
		end)
		it("parade mutation prefers weather", function()
			local rf = rand(77)
			local hits = 0
			for _ = 1, 10000 do
				if Roll.paradeMutation("rainbow", rf) == "rainbow" then
					hits += 1
				end
			end
			near(hits / 10000, Weather.paradeMutationChance, 0.03)
		end)
		it("better mutation comparison", function()
			truthy(Roll.isBetterMutation("gold", "none"))
			falsy(Roll.isBetterMutation("gold", "rainbow"))
			falsy(Roll.isBetterMutation("gold", "gold"))
		end)
	end)

	describe("Merge", function()
		local function slimes()
			return {
				["1"] = { id = "blobby", star = 1, mut = "none", pad = 1 },
				["2"] = { id = "blobby", star = 1, mut = "rainbow", pad = 2 },
				["3"] = { id = "blobby", star = 1, mut = "none", pad = 3 },
				["4"] = { id = "blobby", star = 1, mut = "gold", pad = 4 },
				["5"] = { id = "blobby", star = 2, mut = "none", pad = 5 },
				["6"] = { id = "droplet", star = 1, mut = "none", pad = 6, fav = true },
			}
		end
		it("finds the target plus the two worst-mutation copies", function()
			local set = Merge.findSet(slimes(), "2")
			truthy(set)
			eq(set[1], "2")
			eq(set[2], "1")
			eq(set[3], "3")
		end)
		it("result keeps best mutation and target pad", function()
			local s = slimes()
			local set = Merge.findSet(s, "2")
			local out = Merge.result(s, set)
			eq(out.star, 2)
			eq(out.mut, "rainbow")
			eq(out.pad, 2)
		end)
		it("needs three", function()
			eq(Merge.findSet(slimes(), "5"), nil)
			eq(Merge.findSet(slimes(), "6"), nil)
		end)
		it("skips busy and favourite slimes", function()
			local s = slimes()
			s["3"].fav = true
			local set = Merge.findSet(s, "1", { ["4"] = true })
			eq(set, nil)
		end)
		it("counts available merges", function()
			eq(Merge.countAvailable(slimes()), 1)
		end)
		it("max star cannot merge", function()
			local s = {
				a = { id = "blobby", star = 5, mut = "none", pad = 1 },
				b = { id = "blobby", star = 5, mut = "none", pad = 2 },
				c = { id = "blobby", star = 5, mut = "none", pad = 3 },
			}
			eq(Merge.findSet(s, "a"), nil)
		end)
	end)

	describe("Data", function()
		it("default is valid", function()
			local d = Data.default()
			eq(d.cash, Economy.startCash)
			eq(Data.slimeCount(d), 0)
		end)
		it("reconciles garbage", function()
			local d = Data.reconcile("nope")
			eq(d.cash, Economy.startCash)
			d = Data.reconcile({ cash = "lots", rebirths = -3, upgrades = { pads = 999, bogus = 3 } })
			eq(d.cash, Economy.startCash)
			eq(d.rebirths, 0)
			eq(d.upgrades.pads, 10)
			eq(d.upgrades.bogus, nil)
		end)
		it("fixes slimes", function()
			local d = Data.reconcile({
				nextUid = 2,
				slimes = {
					["5"] = { id = "blobby", star = 9, mut = "weird", pad = 1, fav = true },
					["6"] = { id = "blobby", star = 1, mut = "gold", pad = 1, fav = true },
					["7"] = { id = "notaslime", star = 1, mut = "none", pad = 2 },
					["8"] = { id = "king", star = 2, mut = "none", pad = 0 },
				},
			})
			eq(Data.slimeCount(d), 3)
			eq(d.slimes["5"].star, 5)
			eq(d.slimes["5"].mut, "none")
			eq(d.slimes["7"], nil)
			local pads = {}
			local favs = 0
			for _, s in d.slimes do
				falsy(pads[s.pad], "duplicate pad " .. s.pad)
				pads[s.pad] = true
				if s.fav then
					favs += 1
				end
			end
			eq(favs, 1)
			eq(d.nextUid, 9)
		end)
		it("finds free pads and uids", function()
			local d = Data.default()
			d.slimes["1"] = { id = "blobby", star = 1, mut = "none", pad = 1 }
			d.slimes["2"] = { id = "blobby", star = 1, mut = "none", pad = 3 }
			eq(Data.freePad(d, 10), 2)
			eq(Data.freePad(d, 1), nil)
			eq(Data.newUid(d), "1")
			eq(Data.newUid(d), "2")
		end)
		it("discovers once", function()
			local d = Data.default()
			truthy(Data.discover(d, "blobby", "none"))
			falsy(Data.discover(d, "blobby", "none"))
		end)
		it("keeps last 50 receipts", function()
			local d = Data.default()
			for i = 1, 60 do
				Data.addReceipt(d, "r" .. i)
			end
			eq(#d.receipts, 50)
			truthy(Data.hasReceipt(d, "r60"))
			falsy(Data.hasReceipt(d, "r1"))
		end)
		it("round-trips through reconcile", function()
			local d = Data.default()
			d.cash = 12345
			d.slimes["1"] = { id = "king", star = 3, mut = "galaxy", pad = 7, fav = true }
			d.nextUid = 2
			d.quests.list = { { id = "buy", goal = 8, progress = 3, claimed = false } }
			local r = Data.reconcile(d)
			eq(r.cash, 12345)
			eq(r.slimes["1"].mut, "galaxy")
			eq(r.slimes["1"].pad, 7)
			eq(r.quests.list[1].progress, 3)
		end)
	end)

	describe("Progress", function()
		local T = 1_750_000_000
		it("quests are stable per day and user", function()
			local a = Progress.generateQuests(100, 55)
			local b = Progress.generateQuests(100, 55)
			eq(#a, 3)
			for i = 1, 3 do
				eq(a[i].id, b[i].id)
				eq(a[i].goal, b[i].goal)
			end
			local seen = {}
			for _, q in a do
				falsy(seen[q.id], "duplicate quest")
				seen[q.id] = true
			end
		end)
		it("refreshes on a new day", function()
			local d = Data.default()
			truthy(Progress.refreshQuests(d, T, 1))
			falsy(Progress.refreshQuests(d, T + 10, 1))
			truthy(Progress.refreshQuests(d, T + 86400, 1))
		end)
		it("quest events progress matching quests", function()
			local d = Data.default()
			d.quests.list = { { id = "buy", goal = 3, progress = 0, claimed = false } }
			truthy(Progress.questEvent(d, "buy", 2))
			falsy(Progress.questEvent(d, "steal", 1))
			Progress.questEvent(d, "buy", 5)
			eq(d.quests.list[1].progress, 3)
		end)
		it("daily streak continues, resets and wraps", function()
			local d = Data.default()
			eq(Progress.claimDaily(d, T), 1)
			eq(Progress.claimDaily(d, T + 100), nil)
			eq(Progress.claimDaily(d, T + 86400), 2)
			eq(Progress.claimDaily(d, T + 86400 * 3), 1) -- 하루 빠짐
			for i = 2, 7 do
				eq(Progress.claimDaily(d, T + 86400 * (2 + i)), i)
			end
			eq(Progress.claimDaily(d, T + 86400 * 10), 1) -- 7일 완주 후 다시 1일차
		end)
		it("frenzy timing", function()
			local hour = 3600 * 480000
			truthy(Progress.frenzyActive(hour + 5))
			falsy(Progress.frenzyActive(hour + Weather.frenzy.duration))
			eq(Progress.secondsUntilFrenzy(hour + 600), 3000)
			eq(Progress.frenzyEndsAt(hour + 10), hour + Weather.frenzy.duration)
		end)
		it("gift readiness", function()
			truthy(Progress.giftReady(1, Rewards.gifts[1].minutes * 60))
			falsy(Progress.giftReady(1, Rewards.gifts[1].minutes * 60 - 1))
			falsy(Progress.giftReady(99, 1e9))
		end)
	end)
end
