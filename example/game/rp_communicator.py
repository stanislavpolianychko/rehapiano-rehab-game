import asyncio
from collections import deque
import datetime
import logging
import time

import numpy as np
import websockets

from connection_config import RP_URL, RP_INVALID_VAL
from pygame_config import FINGER_POSITIONS
from rehapiano_data_converter import RehapianoDataConverter


import nest_asyncio
nest_asyncio.apply()


class RehaPianoConnection:
    def __init__(self, connect_to):
        self.rp_queue = None
        self.connection = None
        self.active = False

        self.r_connect = True
        self.l_connect = True

        self.listen_task = None
        self.listen_loop = asyncio.new_event_loop()

        self.decoder = RehapianoDataConverter()

        self.target_url = connect_to

    async def ws_connect(self):
        while not self.connection:
            try:
                self.connection = await websockets.connect(self.target_url)
                self.activate()
            except Exception as e:
                logging.debug("Rehapiano connection failed: {}".format(e))
                # raise RuntimeError('Could not establish websocket connection with rehapiano')
                time.sleep(5)

    async def expect_socket(self):
        if not self.connection:
            return

        while True:
            socket = await self.connection.recv()
            if self.active:
                t_stamp, channels = self.decoder.decode(socket)
                self.rp_queue.append((t_stamp, channels, socket))

    def listen(self):
        self.rp_queue = deque(maxlen=None)
        asyncio.set_event_loop(self.listen_loop)

        self.listen_loop.run_until_complete(self.ws_connect())

        self.listen_task = self.listen_loop.create_task(self.expect_socket())
        self.listen_loop.run_until_complete(self.listen_task)

    def activate(self):
        if not self.active:
            logging.info("RP remembering activated at {}".format(
                datetime.datetime.now()))
            self.active = True

    def deactivate(self):
        if self.active:
            logging.info("RP remembering deactivated at {}".format(
                datetime.datetime.now()))
            self.active = False

    async def close_stream(self):
        try:
            if self.listen_task:
                self.listen_task.close()
        except asyncio.CancelledError:
            pass
        finally:
            if self.connection:
                await self.connection.close()
            if self.listen_loop:
                self.listen_loop.stop()

    def check_hands_connection(self):
        if len(self.rp_queue) == 0:
            return

        last_vals = np.array(self.rp_queue[-1][1])
        l_hand = last_vals[FINGER_POSITIONS[:5]]
        r_hand = last_vals[FINGER_POSITIONS[5:]]

        self.l_connect = not np.all(np.isnan(l_hand))
        self.r_connect = not np.all(np.isnan(r_hand))
