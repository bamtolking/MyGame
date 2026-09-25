--!strict
-- 퀘스트 창: 7일 출석 + 오늘의 퀘스트 3개 + 전부 완료 보너스.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Rewards = require(Shared.Config.Rewards)
local Progress = require(Shared.Logic.Progress)
local Format = require(Shared.Util.Format)

local UI = script.Parent.Parent
local Client = UI.Parent
local Kit = require(UI.Kit)
local Panel = require(UI.Panel)
local Notify = require(UI.Notify)
local Lang = require(Client.Lang)
local State = require(Client.State)

local Quests = {}

-- 보상 한 줄 설명
function Quests.rewardText(r: Rewards.Reward): string
	if r.giftRarity then
		return "🎁 " .. Lang.t("rewardSlime", { rarity = r.giftRarity })
	elseif r.boost then
		return "💰x2 " .. Format.time(r.seconds or 0)
	elseif r.serverLuck then
		return "🍀 " .. Lang.t("rewardServerLuck", { t = Format.time(r.serverLuck) })
	elseif r.cashMinutes then
		return "💵 " .. Lang.t("rewardCash", { m = r.cashMinutes })
	end
	return ""
end

local panel: Panel.PanelObj
local dayCells: { { frame: Frame, label: TextLabel } } = {}
local dailyButton: TextButton
local questBox: Frame
local bonusLabel: TextLabel
local resetLabel: TextLabel

local function refresh()
	local data = State.data()
	if not data then
		return
	end
	local now = os.time()
	local can, slot = Progress.dailyStatus(data, now)
	for i, cell in dayCells do
		local done = (not can and i <= data.daily.streak) or (can and i < slot)
		local isToday = i == slot
		cell.frame.BackgroundColor3 = if isToday and can
			then Kit.colors.yellow
			elseif done then Kit.colors.green
			else Kit.colors.card
		cell.label.Text = (if done then "✅\n" else "") .. Lang.t("dayN", { n = i })
	end
	Kit.setEnabled(dailyButton, can, Kit.colors.yellow)
	dailyButton.Text = if can then Lang.t("claimDaily") else Lang.t("comeBackTomorrow")

	for _, c in questBox:GetChildren() do
		if c:IsA("Frame") then
			c:Destroy()
		end
	end
	for i, q in data.quests.list do
		local def = Rewards.questById[q.id]
		local card = Kit.new("Frame", {
			Size = UDim2.new(1, 0, 0, 86),
			BackgroundColor3 = Kit.colors.card,
			LayoutOrder = i,
			Parent = questBox,
		}) :: Frame
		Kit.corner(card, 14)
		Kit.stroke(card, 3)
		Kit.label({
			Size = UDim2.new(1, -170, 0, 30),
			Position = UDim2.fromOffset(12, 8),
			Text = Lang.quest(q.id, q.goal),
			TextXAlignment = Enum.TextXAlignment.Left,
			Parent = card,
		})
		if def then
			Kit.label({
				Size = UDim2.new(1, -170, 0, 20),
				Position = UDim2.fromOffset(12, 38),
				Text = Quests.rewardText(def.reward),
				TextColor3 = Kit.colors.yellow,
				TextXAlignment = Enum.TextXAlignment.Left,
				Font = Kit.fontBody,
				stroke = false,
				Parent = card,
			})
		end
		local _, setBar = Kit.progress(card, Kit.colors.green, {
			Size = UDim2.new(1, -180, 0, 14),
			Position = UDim2.fromOffset(12, 64),
		})
		setBar(q.progress / q.goal)
		local done = q.progress >= q.goal
		local index = i
		local btn = Kit.button({
			Text = if q.claimed then "✅" elseif done then Lang.t("claim") else (Format.number(math.floor(q.progress)) .. "/" .. Format.number(q.goal)),
			Color = Kit.colors.green,
			Size = UDim2.fromOffset(140, 52),
			AnchorPoint = Vector2.new(1, 0.5),
			Position = UDim2.new(1, -10, 0.5, 0),
			Parent = card,
		}, function()
			local result = State.action("ClaimQuest", index)
			Notify.result(result)
		end)
		Kit.setEnabled(btn, done and not q.claimed, Kit.colors.green)
	end
	local all = Progress.allQuestsClaimed(data)
	bonusLabel.Text = (if data.quests.bonusClaimed then "✅ " else "🏆 ")
		.. Lang.t("questBonus", { reward = Quests.rewardText(Rewards.questAllBonus) })
	bonusLabel.TextColor3 = if all then Kit.colors.cash else Kit.colors.white
	resetLabel.Text = Lang.t("newQuestsIn", { t = Format.time(Progress.secondsUntilNextDay(now)) })
end

function Quests.init()
	panel = Panel.new("Quests", "📜 " .. Lang.t("questsTitle"), Kit.colors.orange)
	Kit.list(panel.content, true, 10, Enum.HorizontalAlignment.Center)

	Kit.label({ Size = UDim2.new(1, 0, 0, 30), Text = Lang.t("dailyTitle"), LayoutOrder = 1, Parent = panel.content })
	local strip = Kit.new("Frame", {
		Size = UDim2.new(1, 0, 0, 70),
		BackgroundTransparency = 1,
		LayoutOrder = 2,
		Parent = panel.content,
	}) :: Frame
	local grid = Instance.new("UIGridLayout")
	grid.CellSize = UDim2.new(1 / 7, -6, 1, 0)
	grid.CellPadding = UDim2.fromOffset(6, 0)
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.Parent = strip
	for i, reward in Rewards.daily do
		local cell = Kit.new("Frame", { BackgroundColor3 = Kit.colors.card, LayoutOrder = i, Parent = strip }) :: Frame
		Kit.corner(cell, 10)
		Kit.stroke(cell, 2)
		local label = Kit.label({ Size = UDim2.new(1, -4, 0.45, 0), Position = UDim2.fromOffset(2, 2), Text = "", Parent = cell })
		Kit.label({
			Size = UDim2.new(1, -4, 0.48, 0),
			Position = UDim2.new(0, 2, 0.5, 0),
			Text = Quests.rewardText(reward),
			TextColor3 = Kit.colors.yellow,
			Font = Kit.fontBody,
			TextWrapped = true,
			Parent = cell,
		})
		dayCells[i] = { frame = cell, label = label }
	end
	dailyButton = Kit.button({
		Text = "",
		Color = Kit.colors.yellow,
		Size = UDim2.fromOffset(240, 50),
		LayoutOrder = 3,
		Shine = true,
		Parent = panel.content,
	}, function()
		local result = State.action("ClaimDaily")
		Notify.result(result)
	end)

	Kit.label({ Size = UDim2.new(1, 0, 0, 30), Text = Lang.t("todayQuests"), LayoutOrder = 4, Parent = panel.content })
	questBox = Kit.new("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		LayoutOrder = 5,
		Parent = panel.content,
	}) :: Frame
	Kit.list(questBox, true, 8, Enum.HorizontalAlignment.Center)
	bonusLabel = Kit.label({ Size = UDim2.new(1, 0, 0, 28), Text = "", LayoutOrder = 6, Parent = panel.content })
	resetLabel = Kit.label({
		Size = UDim2.new(1, 0, 0, 22),
		Text = "",
		TextColor3 = Kit.colors.muted,
		Font = Kit.fontBody,
		stroke = false,
		LayoutOrder = 7,
		Parent = panel.content,
	})

	panel.onOpen = refresh
	State.changed:Connect(function()
		if panel.isOpen then
			refresh()
		end
	end)
end

-- 받을 수 있는 보상 수(배지)
function Quests.claimable(): number
	local data = State.data()
	if not data then
		return 0
	end
	local n = 0
	if (Progress.dailyStatus(data, os.time())) then
		n += 1
	end
	for _, q in data.quests.list do
		if not q.claimed and q.progress >= q.goal then
			n += 1
		end
	end
	return n
end

return Quests
