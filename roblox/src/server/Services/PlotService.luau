--!strict
-- 기지: 배정/해제, 캐릭터 스폰, 수금·잠금 발판, 방어막(잠금·도난 후 보호·초보 보호),
-- 잠긴 기지에 들어온 남 밀어내기, 이동 속도, 친구 보너스.
--
-- 기지 모델 속성(클라이언트가 읽음):
--   OwnerUserId, OwnerName, PadCount, LockEnds, ShieldEnds, LockCooldownEnds, Rookie

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local World = require(Shared.Config.World)
local Economy = require(Shared.Config.Economy)
local Products = require(Shared.Config.Products)
local Calc = require(Shared.Logic.Calc)
local Loop = require(Shared.Util.Loop)

local Server = script.Parent.Parent
local Sessions = require(Server.Sessions)
local Bus = require(Server.Bus)
local Remote = require(Server.Remote)
local MapService = require(script.Parent.MapService)
local EconomyService = require(script.Parent.EconomyService)

local PlotService = {}

local owners: { [number]: Sessions.Session } = {}
local lockEnds: { [number]: number } = {}
local shieldEnds: { [number]: number } = {}
local cooldownEnds: { [number]: number } = {}
local touchDebounce: { [Player]: { [string]: number } } = {}
local kickNotice: { [Player]: number } = {}

local function now(): number
	return Workspace:GetServerTimeNow()
end

function PlotService.rootPart(player: Player): BasePart?
	local char = player.Character
	if not char then
		return nil
	end
	local hum = char:FindFirstChildOfClass("Humanoid")
	if not hum or hum.Health <= 0 then
		return nil
	end
	return char:FindFirstChild("HumanoidRootPart") :: BasePart?
end

function PlotService.sessionAt(plot: number): Sessions.Session?
	return owners[plot]
end

-- 위치가 들어 있는 기지 번호(없으면 0)
function PlotService.plotAt(pos: Vector3): number
	for i = 1, World.plot.count do
		if World.isInsidePlot(i, pos, 0) then
			return i
		end
	end
	return 0
end

local function isRookie(session: Sessions.Session): boolean
	return session.data.rebirths == 0 and session.data.playTime < Economy.steal.rookieShieldSeconds
end

-- 기지가 보호 중인가? (true, "lock" | "shield" | "rookie")
function PlotService.protection(plot: number): (boolean, string?)
	local t = now()
	if (lockEnds[plot] or 0) > t then
		return true, "lock"
	end
	if (shieldEnds[plot] or 0) > t then
		return true, "shield"
	end
	local owner = owners[plot]
	if owner and isRookie(owner) then
		return true, "rookie"
	end
	return false, nil
end

local BARRIER_COLORS = {
	lock = Color3.fromRGB(255, 70, 90),
	shield = Color3.fromRGB(90, 170, 255),
	rookie = Color3.fromRGB(90, 230, 130),
}

local function refreshBarrier(plot: number)
	local parts = MapService.plots[plot]
	if not parts then
		return
	end
	local protected, kind = PlotService.protection(plot)
	parts.barrier.Transparency = if protected then 0.35 else 1
	if kind then
		parts.barrier.Color = BARRIER_COLORS[kind]
	end
	local model = parts.model
	model:SetAttribute("LockEnds", lockEnds[plot] or 0)
	model:SetAttribute("ShieldEnds", shieldEnds[plot] or 0)
	model:SetAttribute("LockCooldownEnds", cooldownEnds[plot] or 0)
	local owner = owners[plot]
	model:SetAttribute("Rookie", owner ~= nil and isRookie(owner))

	local t = now()
	local label = parts.lockLabel
	if (lockEnds[plot] or 0) > t then
		label.Text = "🔒 " .. math.ceil(lockEnds[plot] - t) .. "s"
	elseif (cooldownEnds[plot] or 0) > t then
		label.Text = "⏳ " .. math.ceil(cooldownEnds[plot] - t) .. "s"
	elseif kind == "rookie" then
		label.Text = "🛡 NEW"
	elseif kind == "shield" then
		label.Text = "🛡 " .. math.ceil(shieldEnds[plot] - t) .. "s"
	else
		label.Text = "LOCK"
	end
end

function PlotService.shield(plot: number, seconds: number)
	shieldEnds[plot] = math.max(shieldEnds[plot] or 0, now() + seconds)
	refreshBarrier(plot)
end

function PlotService.padCount(session: Sessions.Session): number
	return Calc.padCount(session.data, session.passes.extraPads == true)
end

function PlotService.refreshPads(session: Sessions.Session)
	local parts = MapService.plots[session.plot]
	if not parts then
		return
	end
	local count = PlotService.padCount(session)
	parts.model:SetAttribute("PadCount", count)
	for p, pad in parts.pads do
		local open = p <= count
		pad.Color = if open then Color3.fromRGB(255, 255, 255) else Color3.fromRGB(120, 115, 135)
		pad.Transparency = if open then 0 else 0.5
		pad.Material = if open then Enum.Material.SmoothPlastic else Enum.Material.Glass
	end
end

function PlotService.updateSpeed(session: Sessions.Session)
	local char = session.player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	local speed = Calc.walkSpeed(session.data) * session.carryMult
	if session.revengeUntil > os.clock() then
		speed += Economy.steal.revengeSpeed
	end
	hum.WalkSpeed = speed
end

function PlotService.spawnCharacter(session: Sessions.Session)
	local player = session.player
	if player.Parent ~= Players or Sessions.get(player) ~= session then
		return
	end
	local ok, err = pcall(function()
		player:LoadCharacterAsync()
	end)
	if not ok then
		warn("[Plot] LoadCharacter failed: " .. tostring(err))
		return
	end
	local char = player.Character
	if not char then
		return
	end
	local cf = if session.plot > 0 then World.spawnCFrame(session.plot) else CFrame.new(World.plaza.spawn + Vector3.new(0, 3, 0))
	char:PivotTo(cf)
	local hum = char:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.Died:Connect(function()
			task.delay(3, function()
				PlotService.spawnCharacter(session)
			end)
		end)
	end
	session.carryMult = 1
	PlotService.updateSpeed(session)
	Bus.characterSpawned:Fire(session)
end

local function debounced(player: Player, key: string, seconds: number): boolean
	local entry = touchDebounce[player]
	if not entry then
		entry = {}
		touchDebounce[player] = entry
	end
	local t = os.clock()
	if entry[key] and t - entry[key] < seconds then
		return false
	end
	entry[key] = t
	return true
end

local function ownerFromHit(plot: number, hit: BasePart): Sessions.Session?
	local model = hit:FindFirstAncestorOfClass("Model")
	if not model then
		return nil
	end
	local player = Players:GetPlayerFromCharacter(model)
	if not player then
		return nil
	end
	local owner = owners[plot]
	if owner and owner.player == player then
		return owner
	end
	return nil
end

function PlotService.lock(session: Sessions.Session): (boolean, string?)
	local plot = session.plot
	if plot == 0 then
		return false, "noPlot"
	end
	local t = now()
	if (lockEnds[plot] or 0) > t then
		return false, "alreadyLocked"
	end
	if (cooldownEnds[plot] or 0) > t then
		return false, "lockCooldown"
	end
	local duration = Calc.lockDuration(session.data)
	lockEnds[plot] = t + duration
	cooldownEnds[plot] = t + duration + Economy.lock.cooldown
	refreshBarrier(plot)
	Remote.fx(session.player, "lock", { seconds = duration })
	if session.data.tutorial == 2 then
		session.data.tutorial = 3
		session.dirty = true
	end
	return true, nil
end

local function connectPlates(plot: number)
	local parts = MapService.plots[plot]
	parts.collect.Touched:Connect(function(hit: BasePart)
		local owner = ownerFromHit(plot, hit)
		if owner and debounced(owner.player, "collect", 0.6) then
			EconomyService.collect(owner)
		end
	end)
	parts.lock.Touched:Connect(function(hit: BasePart)
		local owner = ownerFromHit(plot, hit)
		if owner and debounced(owner.player, "lock", 1) then
			local ok, msg = PlotService.lock(owner)
			if not ok and msg then
				local t = now()
				local secs = if msg == "alreadyLocked"
					then math.ceil((lockEnds[plot] or t) - t)
					else math.ceil((cooldownEnds[plot] or t) - t)
				Remote.notify(owner.player, "info", msg, { s = secs })
			end
		end
	end)
end

local function setSign(plot: number, text: string)
	for _, label in MapService.plots[plot].signs do
		label.Text = text
	end
end

-- 가장 앞(낮은 번호)의 빈 기지 배정
function PlotService.assign(session: Sessions.Session): number
	for i = 1, World.plot.count do
		if not owners[i] then
			owners[i] = session
			session.plot = i
			lockEnds[i], shieldEnds[i], cooldownEnds[i] = 0, 0, 0
			local model = MapService.plots[i].model
			model:SetAttribute("OwnerUserId", session.userId)
			model:SetAttribute("OwnerName", session.player.DisplayName)
			setSign(i, session.player.DisplayName .. "'s Base")
			PlotService.refreshPads(session)
			refreshBarrier(i)
			return i
		end
	end
	return 0
end

function PlotService.release(session: Sessions.Session)
	local plot = session.plot
	if plot > 0 and owners[plot] == session then
		owners[plot] = nil
		lockEnds[plot], shieldEnds[plot], cooldownEnds[plot] = 0, 0, 0
		local parts = MapService.plots[plot]
		parts.model:SetAttribute("OwnerUserId", 0)
		parts.model:SetAttribute("OwnerName", "")
		parts.vaultLabel.Text = "$0"
		setSign(plot, "EMPTY BASE")
		for _, pad in parts.pads do
			pad.Color = Color3.fromRGB(255, 255, 255)
			pad.Transparency = 0
			pad.Material = Enum.Material.SmoothPlastic
		end
		refreshBarrier(plot)
	end
	session.plot = 0
	touchDebounce[session.player] = nil
	kickNotice[session.player] = nil
end

-- 친구·그룹 보너스 계산(웹 호출이라 비동기). 친구 관계는 세션에 기록해 두고 나갈 때 재사용
local function recount(session: Sessions.Session)
	local n = 0
	for userId in session.friendSet do
		if Sessions.byUserId(userId) then
			n += 1
		end
	end
	if n ~= session.friends then
		session.friends = n
		Bus.incomeChanged:Fire(session)
	end
end

local function refreshSocial(session: Sessions.Session)
	for _, other in Sessions.all() do
		if other ~= session then
			local ok, isFriend = pcall(function()
				return session.player:IsFriendsWithAsync(other.userId)
			end)
			if ok and isFriend and Sessions.get(session.player) == session then
				session.friendSet[other.userId] = true
				other.friendSet[session.userId] = true
				recount(other)
				Remote.notify(other.player, "success", "friendJoined", { name = session.player.DisplayName })
			end
		end
	end
	if Products.groupId ~= 0 then
		local ok, inGroup = pcall(function()
			return session.player:IsInGroupAsync(Products.groupId)
		end)
		session.group = ok and inGroup == true
	end
	recount(session)
	Bus.incomeChanged:Fire(session)
end

local function onLeaveSocial(session: Sessions.Session)
	for _, other in Sessions.all() do
		if other.friendSet[session.userId] then
			other.friendSet[session.userId] = nil
			recount(other)
		end
	end
end

-- 잠긴 기지에서 남을 밀어내기 + 방어막 표시 갱신
local function guardTick()
	for plot = 1, World.plot.count do
		local owner = owners[plot]
		if not owner then
			continue
		end
		local protected = PlotService.protection(plot)
		if protected then
			for _, player in Players:GetPlayers() do
				if player ~= owner.player then
					local root = PlotService.rootPart(player)
					if root and World.isInsidePlot(plot, root.Position, 0) then
						local char = player.Character
						local intruder = Sessions.get(player)
						if intruder then
							Bus.kickedFromPlot:Fire(intruder, plot)
						end
						if char then
							char:PivotTo(World.outsidePlot(plot))
							local last = kickNotice[player] or 0
							if os.clock() - last > 3 then
								kickNotice[player] = os.clock()
								Remote.notify(player, "error", "baseLocked")
								Remote.fx(player, "zap", {})
							end
						end
					end
				end
			end
		end
	end
end

local lastBarrierRefresh = 0

function PlotService.init() end

function PlotService.start()
	for i = 1, World.plot.count do
		connectPlates(i)
	end
	task.spawn(function()
		while true do
			task.wait(0.2)
			Loop.try("PlotGuard", guardTick)
			if os.clock() - lastBarrierRefresh >= 1 then
				lastBarrierRefresh = os.clock()
				for i = 1, World.plot.count do
					refreshBarrier(i)
				end
				for _, s in Sessions.all() do
					if s.revengeUntil > 0 and s.revengeUntil <= os.clock() then
						s.revengeUntil = 0
						PlotService.updateSpeed(s)
					end
				end
			end
		end
	end)

	Remote.on("Lock", 1, function(session)
		-- 모바일에서 발판 대신 버튼으로 잠글 때: 주인이 기지 안에 있어야 함
		local root = PlotService.rootPart(session.player)
		if not root or session.plot == 0 or not World.isInsidePlot(session.plot, root.Position, 4) then
			return { ok = false, msg = "goHomeToLock" }
		end
		local ok, msg = PlotService.lock(session)
		return { ok = ok, msg = msg }
	end)
end

function PlotService.onJoin(session: Sessions.Session)
	PlotService.assign(session)
	task.spawn(refreshSocial, session)
end

function PlotService.onLeave(session: Sessions.Session)
	onLeaveSocial(session)
	PlotService.release(session)
end

return PlotService
