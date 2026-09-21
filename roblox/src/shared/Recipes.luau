--!strict
-- 재료·중간 재료·완성 요리와 조리 규칙.
-- 규칙 종류: 상자(재료 꺼내기) → 도마(썰기) → 조리대(합치기) → 냄비/화덕/튀김기/밥솥(익히기) → 손님에게 서빙.

export type Rgb = { number }

export type Item = {
	id: string,
	name: string,
	kind: "raw" | "mid" | "dish" | "burnt" | "tool",
	color: Rgb, -- {r, g, b} 0~255
	shape: string, -- box | ball | cyl | flat | bag | jar | bowl | plate | lump
	chopTo: string?, -- 도마에서 썰면 되는 것
	price: number?, -- 완성 요리 가격(코인)
	unlock: number?, -- 이 밤부터 손님이 주문
	emoji: string?,
}

export type Combo = { inputs: { string }, output: string }
export type Cook = { input: string, station: string, time: number, output: string, noBurn: boolean? }

local Recipes = {}

-- 조리 기구 이름
Recipes.StationNames = {
	crate = "재료 상자",
	board = "도마",
	combine = "조리대",
	pot = "냄비",
	griddle = "화덕",
	fryer = "튀김기",
	ricecooker = "밥솥",
	trash = "쓰레기통",
	extinguisher = "소화기함",
	mallet = "떡메",
}

local itemList: { Item } = {
	-- 원재료 (재료 상자에서 꺼냄)
	{ id = "eomuk_raw", name = "어묵", kind = "raw", color = { 235, 220, 190 }, shape = "flat", emoji = "🍢" },
	{ id = "ramyeon_raw", name = "건면", kind = "raw", color = { 245, 200, 90 }, shape = "box", emoji = "🍜" },
	{ id = "tteok", name = "떡", kind = "raw", color = { 250, 248, 240 }, shape = "cyl", emoji = "🍡" },
	{ id = "gochujang", name = "고추장", kind = "raw", color = { 200, 30, 30 }, shape = "jar", emoji = "🌶️" },
	{ id = "dough", name = "반죽", kind = "raw", color = { 240, 220, 170 }, shape = "ball", emoji = "🫓" },
	{ id = "redbean", name = "팥", kind = "raw", color = { 110, 40, 50 }, shape = "ball", emoji = "🫘" },
	{ id = "gim", name = "김", kind = "raw", color = { 30, 30, 30 }, shape = "flat", emoji = "🟩" },
	{ id = "rice_raw", name = "쌀", kind = "raw", color = { 245, 245, 245 }, shape = "bag", emoji = "🌾" },
	{ id = "veg", name = "야채", kind = "raw", color = { 90, 180, 80 }, shape = "box", chopTo = "veg_chopped", emoji = "🥬" },

	-- 중간 재료
	{ id = "veg_chopped", name = "썬 야채", kind = "mid", color = { 120, 200, 90 }, shape = "lump", emoji = "🥗" },
	{ id = "tteokbokki_raw", name = "떡볶이 재료", kind = "mid", color = { 220, 70, 60 }, shape = "bowl", emoji = "🥣" },
	{ id = "bungeo_raw", name = "붕어빵 반죽", kind = "mid", color = { 230, 190, 140 }, shape = "ball", emoji = "🫓" },
	{ id = "twigim_raw", name = "튀김 반죽", kind = "mid", color = { 190, 210, 140 }, shape = "lump", emoji = "🥣" },
	{ id = "rice", name = "밥", kind = "mid", color = { 255, 255, 250 }, shape = "bowl", emoji = "🍚" },

	-- 완성 요리 (손님이 주문)
	{ id = "eomuk", name = "어묵탕", kind = "dish", color = { 240, 225, 190 }, shape = "bowl", price = 8, unlock = 1, emoji = "🍢" },
	{ id = "ramyeon", name = "라면", kind = "dish", color = { 240, 170, 60 }, shape = "bowl", price = 10, unlock = 1, emoji = "🍜" },
	{ id = "hotteok", name = "호떡", kind = "dish", color = { 210, 150, 80 }, shape = "plate", price = 10, unlock = 2, emoji = "🥞" },
	{ id = "tteokbokki", name = "떡볶이", kind = "dish", color = { 220, 50, 40 }, shape = "bowl", price = 14, unlock = 3, emoji = "🍲" },
	{ id = "bungeoppang", name = "붕어빵", kind = "dish", color = { 200, 140, 70 }, shape = "plate", price = 14, unlock = 5, emoji = "🐟" },
	{ id = "twigim", name = "모둠 튀김", kind = "dish", color = { 230, 180, 90 }, shape = "plate", price = 16, unlock = 7, emoji = "🍤" },
	{ id = "injeolmi", name = "인절미", kind = "dish", color = { 240, 225, 180 }, shape = "plate", price = 20, unlock = 6, emoji = "🍡" },
	{ id = "kimbap", name = "김밥", kind = "dish", color = { 40, 40, 40 }, shape = "plate", price = 18, unlock = 9, emoji = "🍙" },

	-- 실패
	{ id = "burnt", name = "탄 음식", kind = "burnt", color = { 25, 20, 20 }, shape = "lump", emoji = "💀" },

	-- 도구
	{ id = "extinguisher", name = "소화기", kind = "tool", color = { 220, 40, 40 }, shape = "tank", emoji = "🧯" },
}

Recipes.List = itemList
Recipes.Items = {} :: { [string]: Item }
for _, item in itemList do
	Recipes.Items[item.id] = item
end

-- 재료 상자에서 꺼낼 수 있는 것 (상자 배치 순서)
Recipes.CrateItems = { "eomuk_raw", "ramyeon_raw", "tteok", "gochujang", "dough", "redbean", "gim", "rice_raw", "veg" }

-- 조리대에서 합치기 (순서 무관, 정확히 이 재료들만 있을 때)
local comboList: { Combo } = {
	{ inputs = { "tteok", "gochujang" }, output = "tteokbokki_raw" },
	{ inputs = { "dough", "redbean" }, output = "bungeo_raw" },
	{ inputs = { "veg_chopped", "dough" }, output = "twigim_raw" },
	{ inputs = { "rice", "gim", "veg_chopped" }, output = "kimbap" },
}

Recipes.Combos = comboList

-- 익히기 (기구별)
local cookList: { Cook } = {
	{ input = "eomuk_raw", station = "pot", time = 5, output = "eomuk" },
	{ input = "ramyeon_raw", station = "pot", time = 6, output = "ramyeon" },
	{ input = "tteokbokki_raw", station = "pot", time = 7, output = "tteokbokki" },
	{ input = "dough", station = "griddle", time = 6, output = "hotteok" },
	{ input = "bungeo_raw", station = "griddle", time = 7, output = "bungeoppang" },
	{ input = "twigim_raw", station = "fryer", time = 6, output = "twigim" },
	{ input = "rice_raw", station = "ricecooker", time = 8, output = "rice", noBurn = true },
}

Recipes.Cooks = cookList

-- 떡메치기: 두 요리사가 번갈아 쳐야 함 (혼자면 천천히)
Recipes.Pound = { input = "rice", output = "injeolmi", hits = 6 }

function Recipes.get(id: string): Item?
	return Recipes.Items[id]
end

function Recipes.name(id: string): string
	local item = Recipes.Items[id]
	return if item then item.name else id
end

function Recipes.isDish(id: string): boolean
	local item = Recipes.Items[id]
	return item ~= nil and item.kind == "dish"
end

function Recipes.price(id: string): number
	local item = Recipes.Items[id]
	return if item and item.price then item.price else 0
end

-- 해당 기구에 넣을 수 있는 재료면 조리 규칙을 돌려줌
function Recipes.cookFor(itemId: string, station: string): Cook?
	for _, cook in Recipes.Cooks do
		if cook.input == itemId and cook.station == station then
			return cook
		end
	end
	return nil
end

-- 재료 목록(순서 무관)이 정확히 어떤 합치기 규칙과 일치하는지
function Recipes.findCombo(itemIds: { string }): Combo?
	for _, combo in Recipes.Combos do
		if #combo.inputs == #itemIds then
			local remaining = table.clone(itemIds)
			local ok = true
			for _, need in combo.inputs do
				local idx = table.find(remaining, need)
				if idx then
					table.remove(remaining, idx)
				else
					ok = false
					break
				end
			end
			if ok then
				return combo
			end
		end
	end
	return nil
end

-- 이 재료가 어떤 합치기 규칙에라도 쓰이는지 (조리대에 올릴 수 있는지)
function Recipes.isComboInput(itemId: string): boolean
	for _, combo in Recipes.Combos do
		if table.find(combo.inputs, itemId) then
			return true
		end
	end
	return false
end

-- 밤 n에 손님이 주문할 수 있는 요리 목록(잠금 해제 순)
function Recipes.dishesForNight(night: number): { string }
	local out = {}
	for _, item in itemList do
		if item.kind == "dish" and item.unlock and item.unlock <= night then
			table.insert(out, item.id)
		end
	end
	return out
end

-- 모든 완성 요리를 잠금 해제 순으로
function Recipes.allDishes(): { string }
	local out = {}
	for _, item in itemList do
		if item.kind == "dish" then
			table.insert(out, item.id)
		end
	end
	table.sort(out, function(a, b)
		local ua = Recipes.Items[a].unlock or 0
		local ub = Recipes.Items[b].unlock or 0
		if ua == ub then
			return a < b
		end
		return ua < ub
	end)
	return out
end

-- 요리 하나를 만드는 순서를 사람이 읽을 수 있는 문장 목록으로 (레시피 책·메뉴판용)
function Recipes.describe(dishId: string): { string }
	local steps: { string } = {}
	local visited: { [string]: boolean } = {}

	local function explain(id: string)
		if visited[id] then
			return
		end
		visited[id] = true
		local item = Recipes.Items[id]
		if not item then
			return
		end
		-- 떡메로 만드는 것?
		if Recipes.Pound.output == id then
			explain(Recipes.Pound.input)
			table.insert(steps, string.format("%s → 떡메 (두 명이 번갈아 %d번 치기) → %s", Recipes.name(Recipes.Pound.input), Recipes.Pound.hits, item.name))
			return
		end
		-- 익혀서 만드는 것?
		for _, cook in Recipes.Cooks do
			if cook.output == id then
				explain(cook.input)
				table.insert(
					steps,
					string.format(
						"%s → %s (%d초) → %s",
						Recipes.name(cook.input),
						Recipes.StationNames[cook.station] or cook.station,
						cook.time,
						item.name
					)
				)
				return
			end
		end
		-- 합쳐서 만드는 것?
		for _, combo in Recipes.Combos do
			if combo.output == id then
				local names = {}
				for _, input in combo.inputs do
					explain(input)
					table.insert(names, Recipes.name(input))
				end
				table.insert(steps, string.format("%s → 조리대 → %s", table.concat(names, " + "), item.name))
				return
			end
		end
		-- 썰어서 만드는 것?
		for _, other in itemList do
			if other.chopTo == id then
				explain(other.id)
				table.insert(steps, string.format("%s → 도마(E 길게) → %s", other.name, item.name))
				return
			end
		end
		-- 원재료
		if item.kind == "raw" then
			table.insert(steps, string.format("재료 상자에서 %s 꺼내기", item.name))
		end
	end

	explain(dishId)
	return steps
end

return Recipes
