--!strict
-- 소리 설정.
--
-- 샘플(samples): 이름 → 후보 소리 목록. 앞에서부터 실제로 로딩되는 첫 소리를 씁니다.
--   기본값은 로블록스 클라이언트에 내장된 소리(rbxasset://)라서 에셋 업로드 없이 동작합니다.
--   더 좋은 소리를 쓰려면 custom 표에 Creator Store 오디오 ID("rbxassetid://123")를 넣으세요(가장 먼저 시도).
--
-- 큐(cues): 효과 하나 = 여러 겹의 음(layer). 같은 짧은 "핑" 소리를 음정만 바꿔 겹치면
--   동전·합성·환생 같은 효과가 화음/아르페지오로 들립니다.
--   s: 샘플, p: 재생 속도(음정), v: 볼륨, d: 시작 지연(초)
--
-- 음악(music): custom.music(평상시)·custom.musicFrenzy(대폭주) ID가 있으면 그 음악을 반복 재생하고,
--   없으면 아래 패턴으로 오르골풍 배경음악을 만들어 연주합니다.

export type Layer = { s: string, p: number, v: number, d: number? }

-- 반음 n개 위의 재생 속도 배율
local function st(n: number): number
	return 2 ^ (n / 12)
end

local function arp(sample: string, notes: { number }, gap: number, volume: number, base: number?): { Layer }
	local out: { Layer } = {}
	for i, n in notes do
		table.insert(out, { s = sample, p = (base or 1) * st(n), v = volume, d = (i - 1) * gap })
	end
	return out
end

local function chord(sample: string, notes: { number }, delay: number, volume: number): { Layer }
	local out: { Layer } = {}
	for _, n in notes do
		table.insert(out, { s = sample, p = st(n), v = volume, d = delay })
	end
	return out
end

local function concat(...: { Layer }): { Layer }
	local out: { Layer } = {}
	for _, list in { ... } do
		for _, layer in list do
			table.insert(out, layer)
		end
	end
	return out
end

local samples: { [string]: { string } } = {
	ping = { "rbxasset://sounds/electronicpingshort.wav" },
	click = { "rbxasset://sounds/clickfast.wav", "rbxasset://sounds/button.wav" },
	swoosh = { "rbxasset://sounds/swoosh.wav" },
	whoosh = { "rbxasset://sounds/Rocket whoosh 01.wav", "rbxasset://sounds/swoosh.wav" },
	slash = { "rbxasset://sounds/swordslash.wav", "rbxasset://sounds/swordlunge.wav", "rbxasset://sounds/swoosh.wav" },
	hit = { "rbxasset://sounds/collide.wav", "rbxasset://sounds/snap.wav", "rbxasset://sounds/clickfast.wav" },
	splat = { "rbxasset://sounds/splat.wav", "rbxasset://sounds/snap.wav", "rbxasset://sounds/clickfast.wav" },
	jump = { "rbxasset://sounds/action_jump.mp3", "rbxasset://sounds/swoosh.wav" },
	boom = { "rbxasset://sounds/Rocket shot.wav", "rbxasset://sounds/collide.wav" },
}

-- 직접 고른 오디오로 바꾸기(비워 두면 기본 내장 소리/오르골 음악)
local custom: { [string]: string } = {
	ping = "",
	click = "",
	swoosh = "",
	whoosh = "",
	slash = "",
	hit = "",
	splat = "",
	jump = "",
	boom = "",
	music = "",
	musicFrenzy = "",
}

local cues: { [string]: { Layer } } = {
	-- UI
	click = { { s = "click", p = 1.1, v = 0.35 } },
	hover = { { s = "click", p = 1.8, v = 0.1 } },
	open = { { s = "swoosh", p = 1.6, v = 0.22 }, { s = "ping", p = st(19), v = 0.08, d = 0.03 } },
	close = { { s = "swoosh", p = 1.3, v = 0.18 } },
	error = { { s = "click", p = 0.55, v = 0.45 }, { s = "click", p = 0.48, v = 0.4, d = 0.09 } },
	tick = { { s = "click", p = 2.2, v = 0.1 } },

	-- 돈
	buy = arp("ping", { 0, 7, 12 }, 0.06, 0.4),
	coin = { { s = "ping", p = st(12), v = 0.2 } },
	collect = arp("ping", { 0, 4, 7, 12 }, 0.045, 0.38),
	reward = arp("ping", { 0, 4, 7, 12, 16 }, 0.05, 0.35),
	success = arp("ping", { 7, 12 }, 0.07, 0.35),
	questDone = arp("ping", { 4, 7, 12 }, 0.06, 0.35),

	-- 성장
	merge = concat(
		arp("ping", { 0, 4, 7, 12, 16 }, 0.06, 0.34),
		{ { s = "swoosh", p = 1.2, v = 0.3, d = 0.05 }, { s = "ping", p = st(24), v = 0.3, d = 0.36 } }
	),
	mutate = concat(arp("ping", { 12, 16, 19, 24 }, 0.04, 0.3), { { s = "swoosh", p = 1.5, v = 0.2 } }),
	rebirth = concat(
		chord("ping", { 0, 4, 7 }, 0, 0.26),
		chord("ping", { 5, 9, 12 }, 0.22, 0.26),
		chord("ping", { 7, 11, 14 }, 0.44, 0.26),
		chord("ping", { 12, 16, 19, 24 }, 0.7, 0.3),
		{ { s = "whoosh", p = 0.9, v = 0.4, d = 0.7 } }
	),

	-- 행진·공지
	rare = arp("ping", { 7, 12, 16, 19 }, 0.05, 0.34),
	event = concat({ { s = "whoosh", p = 0.7, v = 0.35 } }, arp("ping", { 0, 5, 9 }, 0.12, 0.28)),
	frenzy = concat(
		arp("ping", { 0, 4, 7, 12, 16, 19, 24 }, 0.04, 0.3),
		{ { s = "boom", p = 0.8, v = 0.3, d = 0.28 } }
	),
	poof = { { s = "swoosh", p = 1.8, v = 0.22 }, { s = "ping", p = st(19), v = 0.14, d = 0.02 } },
	flight = { { s = "whoosh", p = 1.3, v = 0.25 } },
	land = { { s = "splat", p = 1.5, v = 0.3 }, { s = "ping", p = st(7), v = 0.18, d = 0.03 } },

	-- 훔치기·전투
	bonk = { { s = "slash", p = 1.35, v = 0.42 }, { s = "hit", p = 0.75, v = 0.6, d = 0.1 } },
	bonkHit = {
		{ s = "hit", p = 0.6, v = 0.8 },
		{ s = "splat", p = 1.1, v = 0.5, d = 0.03 },
		{ s = "ping", p = st(-12), v = 0.3, d = 0.05 },
	},
	steal = concat({ { s = "swoosh", p = 0.85, v = 0.45 } }, arp("ping", { 7, 3 }, 0.1, 0.28)),
	stealSuccess = concat(arp("ping", { 0, 3, 7, 12 }, 0.05, 0.32), { { s = "whoosh", p = 1.1, v = 0.3 } }),
	alarm = arp("ping", { 12, 7, 12, 7 }, 0.18, 0.42),
	lock = { { s = "click", p = 0.6, v = 0.5 }, { s = "ping", p = st(-5), v = 0.32, d = 0.05 }, { s = "ping", p = st(0), v = 0.32, d = 0.12 } },
	zap = { { s = "swoosh", p = 2.0, v = 0.38 }, { s = "hit", p = 1.6, v = 0.28 } },

	-- 슬라임 움직임(위치음)
	hop = { { s = "jump", p = 1.6, v = 0.1 } },
	squish = { { s = "splat", p = 1.8, v = 0.08 } },
}

-- 오르골 배경음악 패턴(반음 단위, 0 = 기준음 C)
local music = {
	sample = "ping",
	rootSpeed = 0.72, -- 기준음(C)의 재생 속도
	calmBpm = 88,
	frenzyBpm = 126,
	-- I - V - vi - IV
	chords = {
		{ 0, 4, 7 },
		{ -5, -1, 2 },
		{ -3, 0, 4 },
		{ -7, -3, 0 },
	},
	-- 마디마다 8분음표 8칸. false = 쉼표
	melody = {
		{ 12, false, 14, 16, false, 14, 12, false },
		{ 11, false, 14, false, 19, false, 14, false },
		{ 12, false, 16, false, 21, 19, 16, false },
		{ 9, false, 12, false, 14, false, 12, false },
	} :: { { number | boolean } },
	volume = { bass = 0.2, arp = 0.055, melody = 0.1 },
}

return {
	samples = samples,
	custom = custom,
	cues = cues,
	music = music,
	semitone = st,
	-- 소리 그룹 기본 볼륨
	groups = { SFX = 0.8, UI = 0.7, Music = 0.45 },
	-- 위치음이 들리는 거리
	positional = { min = 12, max = 110 },
}
