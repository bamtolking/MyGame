--!strict
-- 다국어: 플레이어 언어가 한국어면 ko, 아니면 en.
-- 서버 알림은 키 + 인자(id)로 오고, 여기서 슬라임·변이·날씨 이름으로 바꿔 보여줍니다.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Text = require(Shared.Config.Text)
local Slimes = require(Shared.Config.Slimes)
local Mutations = require(Shared.Config.Mutations)
local Rarities = require(Shared.Config.Rarities)
local Weather = require(Shared.Config.Weather)
local Rewards = require(Shared.Config.Rewards)
local Format = require(Shared.Util.Format)

local Lang = {}

Lang.code = "en"

function Lang.init()
	local locale = string.lower(Players.LocalPlayer.LocaleId or "")
	Lang.code = if string.sub(locale, 1, 2) == "ko" then "ko" else "en"
end

function Lang.pick(dict: { en: string, ko: string }): string
	return if Lang.code == "ko" then dict.ko else dict.en
end

function Lang.slime(id: string): string
	local s = Slimes.byId[id]
	return if s then Lang.pick(s.name) else id
end

function Lang.mut(id: string): string
	local m = Mutations.byId[id]
	return if m then Lang.pick(m.name) else id
end

function Lang.rarity(id: string): string
	local r = Rarities.byId[id]
	return if r then Lang.pick(r.name) else id
end

function Lang.weather(id: string): string
	local w = Weather.byId[id]
	return if w then Lang.pick(w.name) else id
end

function Lang.quest(id: string, goal: number): string
	local q = Rewards.questById[id]
	if not q then
		return id
	end
	return Format.fill(Lang.pick(q.text), { n = goal, t = Format.time(goal) })
end

-- 인자 중 id를 이름으로 변환
local function resolve(args: { [string]: any }?): { [string]: any }?
	if not args then
		return nil
	end
	local out = table.clone(args)
	if type(out.slime) == "string" then
		out.slime = Lang.slime(out.slime)
	end
	if type(out.mut) == "string" then
		out.mut = Lang.mut(out.mut)
	end
	if type(out.rarity) == "string" then
		out.rarity = Lang.rarity(out.rarity)
	end
	if type(out.weather) == "string" then
		out.weather = Lang.weather(out.weather)
	end
	if type(out.quest) == "string" then
		out.quest = Lang.quest(out.quest, 0)
	end
	return out
end

function Lang.t(key: string, args: { [string]: any }?): string
	local entry = Text[key]
	if not entry then
		return key
	end
	return Format.fill(Lang.pick(entry), resolve(args))
end

return Lang
