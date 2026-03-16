# rehapiano/app/ws_tap.py
import asyncio
from typing import AsyncIterator, Dict, Any, List

class WSTap:
    def __init__(self) -> None:
        self._subs: List[asyncio.Queue] = []
        self._lock = asyncio.Lock()

    async def publish(self, message: Dict[str, Any]) -> None:
        # fan-out bez blokovania
        for q in list(self._subs):
            if not q.full():
                q.put_nowait(message)

    async def subscribe(self, max_queue: int = 2000) -> AsyncIterator[Dict[str, Any]]:
        q: asyncio.Queue = asyncio.Queue(maxsize=max_queue)
        async with self._lock:
            self._subs.append(q)
        try:
            while True:
                msg = await q.get()
                yield msg
        finally:
            async with self._lock:
                if q in self._subs:
                    self._subs.remove(q)

ws_tap = WSTap()