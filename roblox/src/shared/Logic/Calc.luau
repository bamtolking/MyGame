--!strict
-- 경제 공식 모음(순수 함수). 서버가 판정에 쓰고, 클라이언트는 같은 공식으로 미리보기를 보여줍니다.

local Shared = script.Parent.Parent
local Economy = require(Shared.Config.Economy)
local Slimes = require(Shared.Config.Slimes)
local Rarities = require(Shared.Config.Rarities)
local Mutations = require(Shared.Config.Mutations)
local Weather = require(Shared.Config.Weather)
local Types = require(Shared.Types)

type SlimeData = Types.SlimeData
type PlayerData = Types.PlayerData
type IncomeContext = Types.IncomeContext

local Calc = {}

function Calc.starMult(star: number): number
	return Economy.star.mult[math.clamp(star, 1, Economy.star.max)]
end

function Calc.starScale(star: number): number
	return Economy.star.scale[math.clamp(star, 1, Economy.star.max)]
end

function Calc.mutMult(mut: string): number
	local m = Mutations.byId[mut]
	return if m then m.mult else 1
end

function Calc.rarityOf(speciesId: string): number
	local s = Slimes.byId[speciesId]
	if not s then
		return 0
	end
	return Rarities.byId[s.rarity].order
end

-- 슬라임 1마리의 초당 수입(배수 적용 전)
function Calc.slimeIncome(s: { id: string, star: number, mut: string }): number
	local species = Slimes.byId[s.id]
	if not species then
		return 0
	end
	return species.income * Calc.starMult(s.star) * Calc.mutMult(s.mut)
end

-- 슬라임 가치(★n = 같은 슬라임 3^(n-1)마리를 합친 것)
function Calc.slimeValue(s: { id: string, star: number, mut: string }): number
	local species = Slimes.byId[s.id]
	if not species then
		return 0
	end
	return species.price * 3 ^ (math.clamp(s.star, 1, Economy.star.max) - 1) * Calc.mutMult(s.mut)
end

function Calc.sellPrice(s: { id: string, star: number, mut: string }): number
	return math.floor(Calc.slimeValue(s) * Economy.sellRatio)
end

function Calc.baseIncome(data: PlayerData): number
	local total = 0
	for _, s in data.slimes do
		total += Calc.slimeIncome(s)
	end
	return total
end

function Calc.indexCount(data: PlayerData): number
	local n = 0
	for speciesId, muts in data.index do
		if Slimes.byId[speciesId] then
			for mutId, found in muts do
				if found and Mutations.byId[mutId] then
					n += 1
				end
			end
		end
	end
	return n
end

function Calc.indexTotal(): number
	return #Slimes.list * #Mutations.list
end

function Calc.rebirthMult(rebirths: number): number
	return 1 + Economy.rebirth.multPer * rebirths
end

function Calc.friendMult(friends: number): number
	return 1 + math.min(Economy.friendBoostMax, friends * Economy.friendBoostPer)
end

-- 모든 수입 배수를 곱한 값
function Calc.multiplier(data: PlayerData, ctx: IncomeContext): number
	local m = Calc.rebirthMult(data.rebirths)
	m *= 1 + Calc.indexCount(data) * Economy.indexBonusPer
	m *= Calc.friendMult(ctx.friends)
	if ctx.group then
		m *= 1 + Economy.groupBoost
	end
	if ctx.vip then
		m *= Economy.vipMult
	end
	if ctx.doubleCash then
		m *= Economy.doubleCashMult
	end
	if (data.boosts.cash2x or 0) > 0 then
		m *= Economy.boostCashMult
	end
	if ctx.frenzy then
		m *= Weather.frenzy.incomeMult
	end
	return m
end

function Calc.incomePerSecond(data: PlayerData, ctx: IncomeContext): number
	return Calc.baseIncome(data) * Calc.multiplier(data, ctx)
end

function Calc.upgradeLevel(data: PlayerData, id: string): number
	return data.upgrades[id] or 0
end

-- 다음 단계 비용. 최대치면 nil
function Calc.upgradeCost(id: string, level: number): number?
	local def = Economy.upgradeById[id]
	if not def or level >= def.maxLevel then
		return nil
	end
	local raw = def.baseCost * def.growth ^ level
	local mag = 10 ^ math.max(0, math.floor(math.log10(raw)) - 1)
	return math.floor(raw / mag + 0.5) * mag
end

function Calc.padCount(data: PlayerData, extraPads: boolean): number
	local n = Economy.basePads + Calc.upgradeLevel(data, "pads")
	if extraPads then
		n += Economy.passPads
	end
	return math.min(n, Economy.maxPads)
end

function Calc.walkSpeed(data: PlayerData): number
	return Economy.walkSpeed.base + Economy.walkSpeed.perLevel * Calc.upgradeLevel(data, "speed")
end

function Calc.lockDuration(data: PlayerData): number
	return Economy.lock.baseDuration + Economy.lock.perLevel * Calc.upgradeLevel(data, "lock")
end

function Calc.bonkCooldown(data: PlayerData): number
	return Economy.bonk.baseCooldown - Economy.bonk.cooldownPerLevel * Calc.upgradeLevel(data, "bonk")
end

function Calc.bonkKnockback(data: PlayerData): number
	return Economy.bonk.knockback + Economy.bonk.knockbackPerLevel * Calc.upgradeLevel(data, "bonk")
end

-- 구매한 슬라임에 무작위 변이가 붙을 확률
function Calc.luckyTouchChance(data: PlayerData): number
	return 0.015 * Calc.upgradeLevel(data, "luck")
end

function Calc.offlineRate(data: PlayerData): number
	return Economy.offline.baseRate + Economy.offline.ratePerLevel * Calc.upgradeLevel(data, "offline")
end

function Calc.offlineCapSeconds(data: PlayerData): number
	return (Economy.offline.baseCapHours + Economy.offline.capHoursPerLevel * Calc.upgradeLevel(data, "offline"))
		* 3600
end

-- 오프라인 보상. (금액, 인정된 초)
function Calc.offlineEarnings(data: PlayerData, awaySeconds: number, incomePerSecond: number): (number, number)
	if awaySeconds < Economy.offline.minSeconds or incomePerSecond <= 0 then
		return 0, 0
	end
	local counted = math.min(awaySeconds, Calc.offlineCapSeconds(data))
	return math.floor(counted * incomePerSecond * Calc.offlineRate(data)), counted
end

function Calc.rebirthCost(rebirths: number): number
	return Economy.rebirth.baseCost * Economy.rebirth.costGrowth ^ rebirths
end

function Calc.rebirthRarityReq(rebirths: number): string
	return Economy.rebirth.rarityReq[rebirths + 1] or Economy.rebirth.rarityReqLate
end

function Calc.bestRarityOwned(data: PlayerData): number
	local best = 0
	for _, s in data.slimes do
		best = math.max(best, Calc.rarityOf(s.id))
	end
	return best
end

-- 환생 가능 여부. (가능?, 실패 이유 텍스트 키)
function Calc.canRebirth(data: PlayerData): (boolean, string?)
	if data.cash < Calc.rebirthCost(data.rebirths) then
		return false, "rebirthNeedCash"
	end
	local req = Rarities.byId[Calc.rebirthRarityReq(data.rebirths)]
	if Calc.bestRarityOwned(data) < req.order then
		return false, "rebirthNeedRarity"
	end
	return true, nil
end

-- 들고 달릴 때 속도 배수
function Calc.carrySpeedMult(s: { id: string, star: number }, thiefPro: boolean): number
	local species = Slimes.byId[s.id]
	local weight = if species then Rarities.byId[species.rarity].carryWeight else 0
	weight += Economy.star.carryWeight[math.clamp(s.star, 1, Economy.star.max)]
	local mult = 1 - weight
	if thiefPro then
		mult *= 1 + Economy.steal.thiefProCarryBonus
	end
	return math.clamp(mult, Economy.steal.minCarryMult, 1)
end

-- 훔치기 길게 누르기 시간
function Calc.stealHold(s: { id: string, star: number }): number
	local species = Slimes.byId[s.id]
	local base = if species then Rarities.byId[species.rarity].stealHold else 1
	return base + Economy.star.holdBonus[math.clamp(s.star, 1, Economy.star.max)]
end

-- 보상용 현금: 현재 수입 N분치(최소값 보장)
function Calc.cashReward(minutes: number, minCash: number, incomePerSecond: number): number
	return math.floor(math.max(minCash, incomePerSecond * 60 * minutes))
end

return Calc
