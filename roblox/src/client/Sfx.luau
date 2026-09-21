--!nonstrict
-- 효과음. 로블록스 클라이언트에 기본 내장된 rbxasset 사운드만 사용(외부 에셋 ID 불필요).
local SoundService = game:GetService("SoundService")
local ContentProvider = game:GetService("ContentProvider")

local Sfx = {}

-- 로드에 실패한(승인되지 않은) 내장 소리는 이 소리로 대체
local FALLBACK_ID = "rbxasset://sounds/electronicpingshort.wav"
local failedIds: { [string]: boolean } = {}

local SOUNDS = {
	pick = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.35, pitch = 1.3 },
	put = { id = "rbxasset://sounds/switch.wav", volume = 0.5 },
	chop = { id = "rbxasset://sounds/snap.wav", volume = 0.6 },
	combine = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6, pitch = 1.6 },
	sizzle = { id = "rbxasset://sounds/impact_water.mp3", volume = 0.45 },
	ding = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.7, pitch = 0.85 },
	burn = { id = "rbxasset://sounds/uuhhh.wav", volume = 0.55 },
	trash = { id = "rbxasset://sounds/impact_water.mp3", volume = 0.45, pitch = 1.5 },
	serve = { id = "rbxasset://sounds/victory.wav", volume = 0.3, pitch = 1.6 },
	no = { id = "rbxasset://sounds/uuhhh.wav", volume = 0.5, pitch = 1.25 },
	angry = { id = "rbxasset://sounds/HalloweenGhost.wav", volume = 0.7 },
	smash = { id = "rbxasset://sounds/glassbreak.wav", volume = 0.6 },
	buy = { id = "rbxasset://sounds/button.wav", volume = 0.6 },
	unlock = { id = "rbxasset://sounds/switch3.wav", volume = 0.6 },
	clear = { id = "rbxasset://sounds/victory.wav", volume = 0.6 },
	night = { id = "rbxasset://sounds/HalloweenLightning.wav", volume = 0.45 },
	boss = { id = "rbxasset://sounds/HalloweenLightning.wav", volume = 0.9, pitch = 0.7 },
	gameover = { id = "rbxasset://sounds/uuhhh.wav", volume = 0.8, pitch = 0.6 },
	ui = { id = "rbxasset://sounds/clickfast.wav", volume = 0.4 },
	fire = { id = "rbxasset://sounds/HalloweenLightning.wav", volume = 0.7, pitch = 0.5 },
	extinguish = { id = "rbxasset://sounds/impact_water.mp3", volume = 0.7, pitch = 0.8 },
	fox = { id = "rbxasset://sounds/snap.wav", volume = 0.6, pitch = 0.7 },
	challenge = { id = "rbxasset://sounds/victory.wav", volume = 0.5, pitch = 1.2 },
	hat = { id = "rbxasset://sounds/switch.wav", volume = 0.6, pitch = 1.3 },
	combo = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.5, pitch = 1.0 },
	ready = { id = "rbxasset://sounds/button.wav", volume = 0.5, pitch = 1.2 },
	blackout = { id = "rbxasset://sounds/switch.wav", volume = 0.8, pitch = 0.5 },
	pound = { id = "rbxasset://sounds/collide.wav", volume = 0.7, pitch = 0.9 },
	talisman = { id = "rbxasset://sounds/flashbulb.wav", volume = 0.8 },
	talismanReady = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.7, pitch = 0.6 },
	relicOffer = { id = "rbxasset://sounds/switch3.wav", volume = 0.7, pitch = 0.8 },
	relic = { id = "rbxasset://sounds/victory.wav", volume = 0.6, pitch = 0.85 },
	ascend = { id = "rbxasset://sounds/victory.wav", volume = 0.4, pitch = 1.9 },
}

-- 시작할 때 모든 소리를 미리 불러 보고, 실패한 것은 대체음으로 표시
task.spawn(function()
	local list = {}
	local seen = {}
	for _, def in SOUNDS do
		if not seen[def.id] then
			seen[def.id] = true
			local s = Instance.new("Sound")
			s.SoundId = def.id
			s.Volume = 0
			s.Parent = SoundService
			table.insert(list, s)
		end
	end
	pcall(function()
		ContentProvider:PreloadAsync(list, function(contentId, status)
			if status ~= Enum.AssetFetchStatus.Success then
				failedIds[contentId] = true
			end
		end)
	end)
	for _, s in list do
		s:Destroy()
	end
end)

-- pitchMult: 기본 음높이에 곱함 (콤보 등)
function Sfx.play(name: string, pitchMult: number?)
	local def = SOUNDS[name]
	if not def then
		return
	end
	local sound = Instance.new("Sound")
	sound.SoundId = if failedIds[def.id] then FALLBACK_ID else def.id
	sound.Volume = def.volume
	sound.PlaybackSpeed = (def.pitch or 1) * (pitchMult or 1)
	sound.Parent = SoundService
	sound.Ended:Once(function()
		sound:Destroy()
	end)
	sound:Play()
	task.delay(8, function()
		if sound.Parent then
			sound:Destroy()
		end
	end)
end

local music: Sound? = nil
function Sfx.startMusic(id: string, volume: number)
	if id == nil or id == "" then
		return
	end
	if music then
		music:Destroy()
	end
	local s = Instance.new("Sound")
	s.Name = "GhostDinerMusic"
	s.SoundId = id
	s.Volume = volume
	s.Looped = true
	s.Parent = SoundService
	s:Play()
	music = s
end

return Sfx
