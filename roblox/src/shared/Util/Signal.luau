--!strict
-- 가벼운 시그널(BindableEvent 없이). 연결된 함수는 task.spawn으로 실행되어
-- 한 리스너의 오류·대기가 다른 리스너를 막지 않습니다.

export type Connection = {
	Connected: boolean,
	Disconnect: (self: Connection) -> (),
}

type Listener = { fn: (...any) -> (), connected: boolean }

export type Signal = {
	_listeners: { Listener },
	Connect: (self: Signal, fn: (...any) -> ()) -> Connection,
	Once: (self: Signal, fn: (...any) -> ()) -> Connection,
	Fire: (self: Signal, ...any) -> (),
	Wait: (self: Signal) -> ...any,
}

local Signal = {}

local function connect(self: Signal, fn: (...any) -> ()): Connection
	local listener: Listener = { fn = fn, connected = true }
	table.insert(self._listeners, listener)
	local conn: Connection = {
		Connected = true,
		Disconnect = function(c: Connection)
			c.Connected = false
			listener.connected = false
			local i = table.find(self._listeners, listener)
			if i then
				table.remove(self._listeners, i)
			end
		end,
	}
	return conn
end

local function once(self: Signal, fn: (...any) -> ()): Connection
	local conn: Connection? = nil
	conn = connect(self, function(...)
		if conn then
			conn:Disconnect()
		end
		fn(...)
	end)
	return conn :: Connection
end

local function fire(self: Signal, ...: any)
	for _, listener in table.clone(self._listeners) do
		if listener.connected then
			task.spawn(listener.fn, ...)
		end
	end
end

local function wait(self: Signal): ...any
	local thread = coroutine.running()
	once(self, function(...)
		task.spawn(thread, ...)
	end)
	return coroutine.yield()
end

function Signal.new(): Signal
	return {
		_listeners = {},
		Connect = connect,
		Once = once,
		Fire = fire,
		Wait = wait,
	}
end

return Signal
