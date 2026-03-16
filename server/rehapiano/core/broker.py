import asyncio
from typing import Any

class Broker:
    def __init__(self):
        self.queue: asyncio.Queue[Any] = asyncio.Queue()

    async def publish(self, item: Any):
        await self.queue.put(item)

    async def subscribe(self):
        while True:
            item = await self.queue.get()
            yield item
