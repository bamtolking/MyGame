--!strict
-- 효과음. 지금은 로블록스 기본 내장 소리(rbxasset://)만 씁니다.
-- 더 좋은 소리로 바꾸려면 Creator Store의 오디오 ID("rbxassetid://123")로 id를 바꾸세요.

local SoundService = game:GetService("SoundService")

local Sound = {}

type Def = { id: string, volume: number, speed: number }

local DEFS: { [string]: Def } = {
	click = { id = "rbxasset://sounds/clickfast.wav", volume = 0.5, speed = 1.1 },
	buy = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6, speed = 1.2 },
	collect = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.5, speed = 1.6 },
	error = { id = "rbxasset://sounds/clickfast.wav", volume = 0.6, speed = 0.6 },
	bonk = { id = "rbxasset://sounds/swordslash.wav", volume = 0.6, speed = 1.3 },
	hit = { id = "rbxasset://sounds/collide.wav", volume = 0.8, speed = 1.0 },
	steal = { id = "rbxasset://sounds/swoosh.wav", volume = 0.7, speed = 0.9 },
	alert = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.8, speed = 0.7 },
	event = { id = "rbxasset://sounds/swoosh.wav", volume = 0.7, speed = 0.6 },
	rare = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.8, speed = 2.0 },
	merge = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.7, speed = 1.4 },
	success = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6, speed = 1.8 },
	lock = { id = "rbxasset://sounds/clickfast.wav", volume = 0.7, speed = 0.8 },
	zap = { id = "rbxasset://sounds/swoosh.wav", volume = 0.6, speed = 1.6 },
	jump = { id = "rbxasset://sounds/action_jump.mp3", volume = 0.4, speed = 1.4 },
}

local instances: { [string]: Sound } = {}
Sound.enabled = true

function Sound.init()
	local folder = Instance.new("Folder")
	folder.Name = "SlimeHeistSfx"
	folder.Parent = SoundService
	for name, def in DEFS do
		local s = Instance.new("Sound")
		s.Name = name
		s.SoundId = def.id
		s.Volume = def.volume
		s.PlaybackSpeed = def.speed
		s.Parent = folder
		instances[name] = s
	end
end

-- pitch: 기본 속도에 곱할 값(연속 효과음에 변화를 줄 때)
function Sound.play(name: string, pitch: number?)
	if not Sound.enabled then
		return
	end
	local s = instances[name]
	local def = DEFS[name]
	if not s or not def then
		return
	end
	s.PlaybackSpeed = def.speed * (pitch or 1)
	SoundService:PlayLocalSound(s)
end

return Sound
