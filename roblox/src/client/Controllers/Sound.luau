--!strict
-- 소리 엔진(클라이언트).
--  · 샘플마다 소리 인스턴스 풀을 만들어 여러 음을 겹쳐 재생(화음·아르페지오)
--  · 후보 소리 중 실제로 로딩되는 첫 번째를 자동 선택(Config/Audio)
--  · 소리 그룹 SFX / UI / Music, 음악에는 잔향
--  · playAt: 3D 위치음(멀어지면 작아짐), combo: 연속 동작일수록 음이 올라감

local ContentProvider = game:GetService("ContentProvider")
local Debris = game:GetService("Debris")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Audio = require(Shared.Config.Audio)

local Sound = {}

Sound.enabled = true
Sound.musicEnabled = true

local POOL_SIZE = 8
local UI_CUES = { click = true, hover = true, open = true, close = true, error = true, tick = true }
-- 예전 이름 호환
local ALIASES: { [string]: string } = { hit = "bonkHit", alert = "alarm", jump = "hop" }

local root: Folder
local groups: { [string]: SoundGroup } = {}
local pools: { [string]: { Sound } } = {}
local cursor: { [string]: number } = {}
local resolved: { [string]: string } = {}
local comboState: { [string]: { t: number, n: number } } = {}
local musicPool: { Sound } = {} -- 음악 전용(효과음을 끊지 않도록 분리)
local musicCursor = 1

local function candidates(sample: string): { string }
	local list: { string } = {}
	local custom = Audio.custom[sample]
	if custom and custom ~= "" then
		table.insert(list, custom)
	end
	local builtIn: { string } = Audio.samples[sample] or {}
	for _, id in builtIn do
		table.insert(list, id)
	end
	return list
end

-- 후보를 차례로 불러 보고 길이가 있는(=로딩된) 첫 소리를 고릅니다.
local function resolve(sample: string)
	local list = candidates(sample)
	for _, id in list do
		local probe = Instance.new("Sound")
		probe.SoundId = id
		local ok = pcall(function()
			ContentProvider:PreloadAsync({ probe })
		end)
		local length = probe.TimeLength
		probe:Destroy()
		if ok and length > 0 then
			resolved[sample] = id
			for _, s in pools[sample] do
				s.SoundId = id
			end
			if sample == Audio.music.sample then
				for _, s in musicPool do
					s.SoundId = id
				end
			end
			return
		end
	end
end

function Sound.group(name: string): SoundGroup
	return groups[name]
end

local function makeGroup(name: string, volume: number): SoundGroup
	local g = Instance.new("SoundGroup")
	g.Name = name
	g.Volume = volume
	g.Parent = SoundService
	groups[name] = g
	return g
end

function Sound.init()
	root = Instance.new("Folder")
	root.Name = "SlimeHeistAudio"
	root.Parent = SoundService

	makeGroup("SFX", Audio.groups.SFX)
	makeGroup("UI", Audio.groups.UI)
	local music = makeGroup("Music", Audio.groups.Music)
	local reverb = Instance.new("ReverbSoundEffect")
	reverb.DecayTime = 2.2
	reverb.Density = 0.8
	reverb.Diffusion = 0.9
	reverb.WetLevel = -6
	reverb.DryLevel = -1
	reverb.Parent = music
	local eq = Instance.new("EqualizerSoundEffect")
	eq.HighGain = -9
	eq.MidGain = -2
	eq.LowGain = 2
	eq.Parent = music

	for sample in Audio.samples do
		local folder = Instance.new("Folder")
		folder.Name = sample
		folder.Parent = root
		local list: { Sound } = {}
		local first = candidates(sample)[1]
		for i = 1, POOL_SIZE do
			local s = Instance.new("Sound")
			s.Name = sample .. i
			s.SoundId = first or ""
			s.SoundGroup = groups.SFX
			s.Parent = folder
			list[i] = s
		end
		pools[sample] = list
		cursor[sample] = 1
	end
	local musicFolder = Instance.new("Folder")
	musicFolder.Name = "MusicNotes"
	musicFolder.Parent = root
	for i = 1, 12 do
		local s = Instance.new("Sound")
		s.Name = "note" .. i
		s.SoundId = candidates(Audio.music.sample)[1] or ""
		s.SoundGroup = music
		s.Parent = musicFolder
		musicPool[i] = s
	end
	for sample in Audio.samples do
		task.spawn(resolve, sample)
	end
end

local function nextSound(sample: string): Sound?
	local list = pools[sample]
	if not list then
		return nil
	end
	local i = cursor[sample]
	cursor[sample] = i % #list + 1
	return list[i]
end

local function playLayer(layer: Audio.Layer, pitch: number, volume: number, group: SoundGroup)
	local s = nextSound(layer.s)
	if not s then
		return
	end
	s.SoundGroup = group
	s.PlaybackSpeed = layer.p * pitch
	s.Volume = layer.v * volume
	s.TimePosition = 0
	s:Play()
end

-- 효과 재생. pitch/volume은 큐 전체에 곱합니다.
function Sound.play(name: string, pitch: number?, volume: number?)
	if not Sound.enabled then
		return
	end
	local cueName = ALIASES[name] or name
	local cue = Audio.cues[cueName]
	if not cue then
		return
	end
	local group = if UI_CUES[cueName] then groups.UI else groups.SFX
	local p, v = pitch or 1, volume or 1
	for _, layer in cue do
		if layer.d and layer.d > 0 then
			task.delay(layer.d, playLayer, layer, p, v, group)
		else
			playLayer(layer, p, v, group)
		end
	end
end

-- 연속으로 부르면(window초 안) 반음씩 올라가는 효과(동전 여러 개 등)
function Sound.combo(name: string, window: number?): number
	local now = os.clock()
	local state = comboState[name]
	if state == nil or now - state.t > (window or 1.2) then
		state = { t = now, n = 0 }
	end
	assert(state)
	comboState[name] = state
	state.t = now
	state.n = math.min(state.n + 1, 12)
	Sound.play(name, Audio.semitone(state.n - 1))
	return state.n
end

-- 3D 위치음: 카메라에서 멀면 생략
function Sound.playAt(name: string, position: Vector3, pitch: number?, volume: number?)
	if not Sound.enabled then
		return
	end
	local camera = Workspace.CurrentCamera
	if camera and (camera.CFrame.Position - position).Magnitude > Audio.positional.max then
		return
	end
	local cue = Audio.cues[ALIASES[name] or name]
	if not cue then
		return
	end
	local holder = Instance.new("Part")
	holder.Name = "SoundAt"
	holder.Anchored = true
	holder.CanCollide = false
	holder.CanQuery = false
	holder.CanTouch = false
	holder.Transparency = 1
	holder.Size = Vector3.new(0.2, 0.2, 0.2)
	holder.CFrame = CFrame.new(position)
	holder.Parent = Workspace
	local p, v = pitch or 1, volume or 1
	for _, layer in cue do
		local s = Instance.new("Sound")
		s.SoundId = resolved[layer.s] or candidates(layer.s)[1] or ""
		s.PlaybackSpeed = layer.p * p
		s.Volume = layer.v * v * 1.6
		s.RollOffMode = Enum.RollOffMode.InverseTapered
		s.RollOffMinDistance = Audio.positional.min
		s.RollOffMaxDistance = Audio.positional.max
		s.SoundGroup = groups.SFX
		s.Parent = holder
		if layer.d and layer.d > 0 then
			task.delay(layer.d, function()
				s:Play()
			end)
		else
			s:Play()
		end
	end
	Debris:AddItem(holder, 3)
end

-- 음악용 음 하나(Music 그룹, 전용 풀)
function Sound.note(speed: number, volume: number)
	if not Sound.musicEnabled then
		return
	end
	local s = musicPool[musicCursor]
	if not s then
		return
	end
	musicCursor = musicCursor % #musicPool + 1
	s.PlaybackSpeed = speed
	s.Volume = volume
	s.TimePosition = 0
	s:Play()
end

return Sound
