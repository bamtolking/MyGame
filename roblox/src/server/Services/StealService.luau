--!strict
-- 훔치기 · 들고 달리기 · 배달 · 뿅망치.
--
-- 복제 방지 원칙: 슬라임 데이터는 "배달 완료" 순간에만 피해자 → 도둑으로 옮깁니다.
-- 그 전에는 피해자 데이터에 그대로 있고(busy 표시만), 취소되면 표시만 풀면 됩니다.
-- 그래서 누가 나가거나 서버가 꺼져도 슬라임이 두 개가 되거나 사라지지 않습니다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Economy = require(Shared.Config.Economy)
local Rarities = require(Shared.Config.Rarities)
local Slimes = require(Shared.Config.Slimes)
local World = require(Shared.Config.World)
local Calc = require(Shared.Logic.Calc)
local SlimeBuilder = require(Shared.SlimeBuilder)
local Net = require(Shared.Net)
local Loop = require(Shared.Util.Loop)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local Bus = require(Server.Bus)
local Remote = require(Server.Remote)
local PlotService = require(script.Parent.PlotService)
local SlimeService = require(script.Parent.SlimeService)

local StealService = {}

type Theft = {
	id: number,
	thief: Sessions.Session,
	victim: Sessions.Session,
	uid: string,
	slimeId: string,
	star: number,
	mut: string,
	started: number,
	startPos: Vector3,
	carried: Model?,
}

type Pending = { plot: number, uid: string, t: number, hold: number }

local thefts: { [number]: Theft } = {}
local pending: { [Sessions.Session]: Pending } = {}
local nextId = 1

-- 훔치기 가능 여부 검사. 가능하면 (피해자 세션, nil)
local function check(thief: Sessions.Session, plot: any, uid: any): (Sessions.Session?, string?)
	if type(plot) ~= "number" or type(uid) ~= "string" then
		return nil, "badRequest"
	end
	if thief.carrying then
		return nil, "alreadyCarrying"
	end
	if thief.plot == 0 then
		return nil, "noPlot"
	end
	local victim = PlotService.sessionAt(plot)
	if not victim or victim == thief then
		return nil, "notFound"
	end
	local s = victim.data.slimes[uid]
	if not s or victim.busy[uid] then
		return nil, "notFound"
	end
	if s.fav then
		return nil, "favProtected"
	end
	local protected, kind = PlotService.protection(plot)
	if protected then
		return nil, if kind == "rookie" then "rookieProtected" else "baseProtected"
	end
	local root = PlotService.rootPart(thief.player)
	if not root then
		return nil, "tooFar"
	end
	local padPos = World.padCFrame(plot, s.pad).Position
	if (root.Position - padPos).Magnitude > Economy.steal.stealRange then
		return nil, "tooFar"
	end
	if not SlimeService.freePad(thief) then
		return nil, "baseFull"
	end
	return victim, nil
end

local function attachCarried(theft: Theft)
	local char = theft.thief.player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not char or not root then
		return
	end
	local scaleMult = math.min(1, 1.3 / Calc.starScale(theft.star))
	local model = SlimeBuilder.build(
		{ id = theft.slimeId, star = theft.star, mut = theft.mut },
		root.CFrame * CFrame.new(0, 2.6, 0.4),
		scaleMult
	)
	model.Name = "CarriedSlime"
	-- 바닥 그림자·발밑 빛 고리는 머리 위에서는 어색하므로 제거
	for _, child in model:GetChildren() do
		if child.Name == "Shadow" or child.Name == "Aura" then
			child:Destroy()
		end
	end
	local modelRoot = model.PrimaryPart :: BasePart
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = false
			d.Massless = true
			d.CanCollide = false
			if d ~= modelRoot then
				local weld = Instance.new("WeldConstraint")
				weld.Part0 = modelRoot
				weld.Part1 = d
				weld.Parent = d
			end
		end
	end
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = root
	weld.Part1 = modelRoot
	weld.Parent = modelRoot
	model.Parent = char
	theft.carried = model
end

local function finish(theft: Theft)
	thefts[theft.id] = nil
	if theft.carried then
		theft.carried:Destroy()
		theft.carried = nil
	end
	local thief = theft.thief
	if thief.carrying == theft.id then
		thief.carrying = nil
		thief.carryMult = 1
		PlotService.updateSpeed(thief)
		thief.dirty = true
	end
	Net.event("Fx"):FireAllClients({ kind = "carryEnd", data = { thief = thief.userId } })
end

-- 취소: 슬라임은 원래 자리로
function StealService.cancel(theft: Theft, reason: string)
	if not thefts[theft.id] then
		return
	end
	finish(theft)
	local victim = theft.victim
	if Sessions.get(victim.player) == victim and victim.data.slimes[theft.uid] then
		SlimeService.setBusy(victim, theft.uid, false)
		if reason == "bonked" then
			Remote.notify(victim.player, "success", "slimeSaved", { slime = theft.slimeId })
		end
	end
	if Sessions.get(theft.thief.player) == theft.thief then
		Remote.notify(theft.thief.player, "error", "stealFailed_" .. reason)
	end
end

local function complete(theft: Theft)
	local thief, victim = theft.thief, theft.victim
	if Sessions.get(victim.player) ~= victim or not victim.data.slimes[theft.uid] then
		StealService.cancel(theft, "gone")
		return
	end
	if not SlimeService.freePad(thief) then
		StealService.cancel(theft, "baseFull")
		return
	end
	finish(theft)
	local data = SlimeService.remove(victim, theft.uid)
	if not data then
		return
	end
	SlimeService.add(thief, { id = data.id, star = data.star, mut = data.mut })

	thief.data.steals += 1
	victim.data.stats.stolenFrom += 1
	Bus.quest:Fire(thief, "steal", 1)
	PlotService.shield(victim.plot, Economy.steal.afterTheftShield)

	Remote.notify(thief.player, "success", "stealSuccess", { slime = data.id })
	Remote.notify(victim.player, "steal", "gotStolen", { slime = data.id, name = thief.player.DisplayName })
	local rarity = Rarities.byId[Slimes.byId[data.id].rarity]
	if rarity.order >= Rarities.byId.epic.order then
		Remote.notifyAll("announce", "stealAnnounce", {
			thief = thief.player.DisplayName,
			victim = victim.player.DisplayName,
			slime = data.id,
		})
	end
	Remote.fx(thief.player, "stealSuccess", {})
end

local function begin(thief: Sessions.Session, victim: Sessions.Session, uid: string)
	local s = victim.data.slimes[uid]
	local thiefRoot = PlotService.rootPart(thief.player)
	local theft: Theft = {
		id = nextId,
		thief = thief,
		victim = victim,
		uid = uid,
		slimeId = s.id,
		star = s.star,
		mut = s.mut,
		started = os.clock(),
		startPos = if thiefRoot then thiefRoot.Position else Vector3.zero,
		carried = nil,
	}
	nextId += 1
	thefts[theft.id] = theft
	SlimeService.setBusy(victim, uid, true)
	attachCarried(theft)

	thief.carrying = theft.id
	thief.carryMult = Calc.carrySpeedMult(s, thief.passes.thiefPro == true)
	PlotService.updateSpeed(thief)
	thief.dirty = true

	victim.revengeUntil = os.clock() + Economy.steal.revengeSeconds
	PlotService.updateSpeed(victim)

	Remote.notify(thief.player, "info", "carryHint")
	Remote.notify(victim.player, "steal", "stealAlert", { slime = s.id, name = thief.player.DisplayName })
	Remote.fx(victim.player, "revenge", { thief = thief.userId, seconds = Economy.steal.revengeSeconds })
	Net.event("Fx"):FireAllClients({
		kind = "carryStart",
		data = { thief = thief.userId, victim = victim.userId, plot = victim.plot, pad = s.pad },
	})
end

local function tick()
	local t = os.clock()
	for _, theft in thefts do
		local thief = theft.thief
		if Sessions.get(thief.player) ~= thief then
			StealService.cancel(theft, "left")
			continue
		end
		local root = PlotService.rootPart(thief.player)
		if not root or not theft.carried or not theft.carried.Parent then
			StealService.cancel(theft, "died")
		elseif t - theft.started > Economy.steal.timeout then
			StealService.cancel(theft, "timeout")
		elseif thief.plot > 0 and World.isInsidePlot(thief.plot, root.Position, 0) then
			-- 순간이동 방지: 출발점에서 온 평균 속도가 가능한 최고 속도(여유 포함)를 넘으면 무효
			local elapsed = t - theft.started
			local maxSpeed = Calc.walkSpeed(thief.data) * thief.carryMult + Economy.steal.revengeSpeed
			if (root.Position - theft.startPos).Magnitude > maxSpeed * 1.6 * elapsed + 8 then
				StealService.cancel(theft, "tooFast")
			else
				complete(theft)
			end
		end
	end
end

-- 뿅망치
local function bonk(attacker: Sessions.Session)
	local t = os.clock()
	if t - attacker.lastBonk < Calc.bonkCooldown(attacker.data) - 0.05 or t < attacker.stunUntil then
		return
	end
	attacker.lastBonk = t
	local root = PlotService.rootPart(attacker.player)
	if not root then
		return
	end
	local look = root.CFrame.LookVector
	local hits = 0
	for _, target in Sessions.all() do
		if target == attacker or hits >= 3 then
			continue
		end
		local troot = PlotService.rootPart(target.player)
		if not troot then
			continue
		end
		local offset = troot.Position - root.Position
		local flat = Vector3.new(offset.X, 0, offset.Z)
		if flat.Magnitude > Economy.bonk.range or math.abs(offset.Y) > 8 then
			continue
		end
		local dir = if flat.Magnitude > 0.01 then flat.Unit else look
		if dir:Dot(look) < -0.2 then
			continue -- 등 뒤는 안 맞음
		end
		hits += 1
		target.stunUntil = t + Economy.bonk.stun
		Remote.fx(target.player, "knockback", {
			dir = dir,
			power = Calc.bonkKnockback(attacker.data),
			stun = Economy.bonk.stun,
		})
		Bus.quest:Fire(attacker, "bonk", 1)
		attacker.data.stats.bonks += 1
		if target.carrying then
			local theft = thefts[target.carrying]
			if theft then
				StealService.cancel(theft, "bonked")
				Bus.quest:Fire(attacker, "defend", 1)
				Remote.notify(attacker.player, "success", "thiefStopped", { slime = theft.slimeId })
			end
		end
	end
	Net.event("Fx"):FireAllClients({
		kind = "bonk",
		data = { attacker = attacker.userId, pos = root.Position + look * 3, hit = hits > 0 },
	})
end

function StealService.init() end

function StealService.start()
	-- 주인이 잠가서 밀려난 도둑은 그 기지 슬라임을 놓침(순간이동으로 도망치는 것 방지)
	Bus.kickedFromPlot:Connect(function(session: Sessions.Session, plot: number)
		local id = session.carrying
		local theft = id and thefts[id]
		if theft and theft.victim.plot == plot then
			StealService.cancel(theft, "locked")
		end
	end)

	Remote.on("StealStart", 0.3, function(session, payload)
		if type(payload) ~= "table" then
			return { ok = false, msg = "badRequest" }
		end
		local victim, msg = check(session, payload.plot, payload.uid)
		if not victim then
			pending[session] = nil
			return { ok = false, msg = msg }
		end
		local s = victim.data.slimes[payload.uid]
		local hold = Calc.stealHold(s)
		pending[session] = { plot = payload.plot, uid = payload.uid, t = os.clock(), hold = hold }
		return { ok = true, hold = hold }
	end)

	Remote.on("StealFinish", 0.3, function(session, payload)
		if type(payload) ~= "table" then
			return { ok = false, msg = "badRequest" }
		end
		local p = pending[session]
		pending[session] = nil
		if not p or p.plot ~= payload.plot or p.uid ~= payload.uid then
			return { ok = false, msg = "badRequest" }
		end
		if os.clock() - p.t < p.hold - 0.4 then
			return { ok = false, msg = "tooFast" }
		end
		local victim, msg = check(session, p.plot, p.uid)
		if not victim then
			return { ok = false, msg = msg }
		end
		begin(session, victim, p.uid)
		return { ok = true }
	end)

	Net.event("Bonk").OnServerEvent:Connect(function(player: Player)
		local session = Sessions.get(player)
		if session then
			bonk(session)
		end
	end)

	Loop.every("Steal", 0.2, tick)
end

function StealService.onLeave(session: Sessions.Session)
	pending[session] = nil
	for _, theft in thefts do
		if theft.thief == session then
			StealService.cancel(theft, "left")
		elseif theft.victim == session then
			StealService.cancel(theft, "victimLeft")
		end
	end
end

-- 환생 등으로 슬라임을 통째로 지우기 전에 진행 중인 도난을 정리
function StealService.cancelAllFor(session: Sessions.Session)
	for _, theft in thefts do
		if theft.thief == session or theft.victim == session then
			StealService.cancel(theft, "reset")
		end
	end
end

function StealService.isCarrying(session: Sessions.Session): boolean
	return session.carrying ~= nil
end

return StealService
