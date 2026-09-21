--!nonstrict
-- 효과음. 로블록스 클라이언트에 기본 내장된 rbxasset 사운드만 사용(외부 에셋 ID 불필요).
local SoundService = game:GetService("SoundService")

local Sfx = {}

local SOUNDS = {
	pick = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.35, pitch = 1.3 },
	put = { id = "rbxasset://sounds/switch.wav", volume = 0.5 },
	chop = { id = "rbxasset://sounds/snap.wav", volume = 0.6 },
	combine = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6, pitch = 1.6 },
	sizzle = { id = "rbxasset://sounds/impact_water.mp3", volume = 0.45 },
	ding = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.7, pitch = 0.85 },
	burn = { id = "rbxasset://sounds/uuhhh.wav", volume = 0.55 },
	trash = { id = "rbxasset://sounds/swoosh.wav", volume = 0.5 },
	serve = { id = "rbxasset://sounds/victory.wav", volume = 0.3, pitch = 1.6 },
	no = { id = "rbxasset://sounds/uuhhh.wav", volume = 0.5, pitch = 1.25 },
	angry = { id = "rbxasset://sounds/HalloweenGhost.wav", volume = 0.7 },
	smash = { id = "rbxasset://sounds/glassbreak.wav", volume = 0.6 },
	buy = { id = "rbxasset://sounds/button.wav", volume = 0.6 },
	unlock = { id = "rbxasset://sounds/switch3.wav", volume = 0.6 },
	clear = { id = "rbxasset://sounds/victory.wav", volume = 0.6 },
	night = { id = "rbxasset://sounds/HalloweenLightning.wav", volume = 0.45 },
	boss = { id = "rbxasset://sounds/HalloweenLightning.wav", volume = 0.8, pitch = 0.7 },
	gameover = { id = "rbxasset://sounds/uuhhh.wav", volume = 0.8, pitch = 0.6 },
	ui = { id = "rbxasset://sounds/clickfast.wav", volume = 0.4 },
}

function Sfx.play(name: string)
	local def = SOUNDS[name]
	if not def then
		return
	end
	local sound = Instance.new("Sound")
	sound.SoundId = def.id
	sound.Volume = def.volume
	sound.PlaybackSpeed = def.pitch or 1
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

return Sfx
