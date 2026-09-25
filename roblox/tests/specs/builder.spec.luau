--!nocheck
-- SlimeBuilder가 모든 슬라임 × 변이 × ★ 조합을 오류 없이 조립하는지,
-- 파트가 슬라임 주변(합리적인 범위) 안에 있는지 확인합니다. (Lune의 roblox Instance 사용)
return function(H, Shared, req)
	local describe, it, eq, truthy = H.describe, H.it, H.eq, H.truthy
	local Slimes = req(Shared.Config.Slimes)
	local Mutations = req(Shared.Config.Mutations)
	local Economy = req(Shared.Config.Economy)
	local SlimeBuilder = req(Shared.SlimeBuilder)
	local CFrame = H.roblox.CFrame

	describe("SlimeBuilder", function()
		it("every accessory name is implemented", function()
			for _, s in Slimes.list do
				for _, acc in s.accessories do
					truthy(SlimeBuilder.hasAccessory(acc), s.id .. " uses unknown accessory " .. acc)
				end
			end
		end)

		it("builds every species x mutation x star", function()
			local built = 0
			for _, s in Slimes.list do
				for _, m in Mutations.list do
					for _, star in { 1, Economy.star.max } do
						local model = SlimeBuilder.build({ id = s.id, star = star, mut = m.id })
						truthy(model.PrimaryPart and model.PrimaryPart.Name == "Root", s.id .. " root")
						truthy(model:FindFirstChild("Body"), s.id .. " body")
						eq(model:GetAttribute("SpeciesId"), s.id)
						local scale = Economy.star.scale[star]
						for _, p in model:GetChildren() do
							if p:IsA("BasePart") then
								local pos = p.CFrame.Position
								truthy(math.abs(pos.X) <= 3.6 * scale, s.id .. "/" .. p.Name .. " x=" .. pos.X)
								truthy(math.abs(pos.Z) <= 3.6 * scale, s.id .. "/" .. p.Name .. " z=" .. pos.Z)
								truthy(pos.Y >= -0.2 and pos.Y <= 6 * scale, s.id .. "/" .. p.Name .. " y=" .. pos.Y)
								truthy(p.Anchored and not p.CanCollide, s.id .. "/" .. p.Name .. " physics")
							end
						end
						model:Destroy()
						built += 1
					end
				end
			end
			eq(built, #Slimes.list * #Mutations.list * 2)
		end)

		it("respects the origin", function()
			local origin = CFrame.new(100, 5, -40)
			local model = SlimeBuilder.build({ id = "king", star = 2, mut = "gold" }, origin)
			local body = model:FindFirstChild("Body")
			truthy((body.CFrame.Position - origin.Position).Magnitude < 5, "body near origin")
			eq(model.PrimaryPart.CFrame, origin)
		end)

		it("rainbow body is flagged for the client animator", function()
			local model = SlimeBuilder.build({ id = "blobby", star = 1, mut = "rainbow" })
			eq(model:FindFirstChild("Body"):GetAttribute("Rainbow"), true)
		end)
	end)
end
