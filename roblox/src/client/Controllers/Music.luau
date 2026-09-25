--!strict
-- 배경음악.
--  · Config/Audio의 custom.music / custom.musicFrenzy 에 오디오 ID가 있으면 그 곡을 반복 재생
--  · 없으면 오르골풍 음악을 코드로 연주(I–V–vi–IV 화음 + 아르페지오 + 멜로디)
--  · 매시 정각 대폭주 중에는 더 빠르고 꽉 찬 편곡

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Audio = require(Shared.Config.Audio)

local Sound = require(script.Parent.Sound)

local Music = {}

local worldState: Instance
local tracks: { calm: Sound?, frenzy: Sound? } = { calm = nil, frenzy = nil }

local function isFrenzy(): boolean
	return worldState:GetAttribute("Frenzy") == true
end

local function makeTrack(id: string, name: string): Sound?
	if id == "" then
		return nil
	end
	local s = Instance.new("Sound")
	s.Name = name
	s.SoundId = id
	s.Looped = true
	s.Volume = 0.6
	s.SoundGroup = Sound.group("Music")
	s.Parent = Sound.group("Music")
	return s
end

-- 업로드한 음악 파일 재생(있을 때)
local function runTracks()
	while true do
		local want = if isFrenzy() and tracks.frenzy then tracks.frenzy else tracks.calm
		for _, t in { tracks.calm, tracks.frenzy } do
			if t then
				local shouldPlay = t == want and Sound.musicEnabled
				if shouldPlay and not t.IsPlaying then
					t:Play()
				elseif not shouldPlay and t.IsPlaying then
					t:Pause()
				end
			end
		end
		task.wait(0.5)
	end
end

-- 오르골 연주
local function runMusicBox()
	local M = Audio.music
	local st = Audio.semitone
	local bar = 1
	local loop = 0
	while true do
		local frenzy = isFrenzy()
		local step = 60 / (if frenzy then M.frenzyBpm else M.calmBpm) / 2
		local chordNotes = M.chords[bar]
		local melody = M.melody[bar]
		for s = 1, 8 do
			if Sound.musicEnabled then
				local base = M.rootSpeed
				if s == 1 or s == 5 or (frenzy and s % 2 == 1) then
					Sound.note(base * st(chordNotes[1] - 12), M.volume.bass)
				end
				if frenzy or s % 2 == 1 then
					local tone = chordNotes[(s - 1) % 3 + 1] + 12
					Sound.note(base * st(tone), M.volume.arp)
				end
				local m = melody[s]
				-- 홀수 바퀴는 멜로디를 성기게 해서 숨 쉴 틈을 줌
				if type(m) == "number" and (loop % 2 == 0 or frenzy or s % 4 == 1) then
					Sound.note(base * st(m), M.volume.melody)
				end
			end
			task.wait(step)
		end
		bar = bar % #M.chords + 1
		if bar == 1 then
			loop += 1
		end
	end
end

function Music.init()
	worldState = ReplicatedStorage:WaitForChild("WorldState")
	tracks.calm = makeTrack(Audio.custom.music, "MusicCalm")
	tracks.frenzy = makeTrack(Audio.custom.musicFrenzy, "MusicFrenzy")
	if tracks.calm or tracks.frenzy then
		task.spawn(runTracks)
	else
		task.spawn(runMusicBox)
	end
end

return Music
