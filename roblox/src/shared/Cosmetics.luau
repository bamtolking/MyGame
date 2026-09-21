--!strict
-- 명성(영구 진행)과 해금 모자. 명성은 서빙·밤 클리어로 쌓이고 저장됩니다.

export type Hat = {
	id: string,
	name: string,
	fame: number, -- 이 명성부터 착용 가능
	desc: string,
	emoji: string,
}

local Cosmetics = {}

local hats: { Hat } = {
	{ id = "none", name = "맨머리", fame = 0, desc = "아무것도 쓰지 않음", emoji = "🙂" },
	{ id = "paper", name = "종이 모자", fame = 0, desc = "분식집의 기본", emoji = "🧢" },
	{ id = "chef", name = "요리사 모자", fame = 50, desc = "밤 5개쯤 넘기면 손에 익는 모자", emoji = "👨‍🍳" },
	{ id = "bandana", name = "빨간 두건", fame = 120, desc = "불 앞에서 땀을 닦는 자의 것", emoji = "🔴" },
	{ id = "gat", name = "갓", fame = 250, desc = "저승사자도 인정한 요리사", emoji = "🎩" },
	{ id = "horn", name = "도깨비 뿔", fame = 400, desc = "도깨비들이 단골이 됐다", emoji = "👹" },
	{ id = "tigerears", name = "호랑이 귀", fame = 600, desc = "호랑이도 배부르게 보낸 사람", emoji = "🐯" },
	{ id = "halo", name = "신령의 후광", fame = 900, desc = "산신령의 축복", emoji = "😇" },
	{ id = "crown", name = "저승 왕관", fame = 1500, desc = "저승 휴게소의 전설", emoji = "👑" },
}

Cosmetics.Hats = hats
Cosmetics.ById = {} :: { [string]: Hat }
for _, h in hats do
	Cosmetics.ById[h.id] = h
end

function Cosmetics.get(id: string?): Hat?
	if not id then
		return nil
	end
	return Cosmetics.ById[id]
end

function Cosmetics.isUnlocked(id: string, fame: number): boolean
	local hat = Cosmetics.ById[id]
	return hat ~= nil and fame >= hat.fame
end

-- 다음에 해금될 모자
function Cosmetics.nextUnlock(fame: number): Hat?
	for _, h in hats do
		if h.fame > fame then
			return h
		end
	end
	return nil
end

function Cosmetics.fameForNight(night: number, base: number): number
	return base + night
end

return Cosmetics
