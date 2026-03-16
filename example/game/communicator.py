import asyncio
import base64
import datetime
import json
import logging
import pickle
import time
from queue import Queue
import requests
import zlib

import websockets

from connection_config import DEVICE_NAME, REST_URL, WS_URL, LOCAL_WS_URL


import nest_asyncio
nest_asyncio.apply()


class SocketConnection:
    def __init__(self, connect_to='server'):
        self.device_name = DEVICE_NAME
        self.token = None  # make None
        self.connection = None

        self.queue = Queue(maxsize=0)
        self.send_queue = Queue(maxsize=0)
        self.listen_task = None
        self.listen_loop = asyncio.new_event_loop()

        self.send_task = None
        self.send_loop = asyncio.new_event_loop()

        if connect_to == 'server':
            self.connection_func = self.connect_to_server
        elif connect_to == 'local':
            self.connection_func = self.connect_to_local
        else:
            raise ValueError("Unknown websocket connection target: {}".format(connect_to))

    def get_token(self):
        try:
            response = requests.post(REST_URL)

            # TODO: load device name from json
            self.token = response.json()['access_token']
        except Exception as e:
            logging.debug("Could not get access token: {}".format(e))
            raise RuntimeError("Could not get access token from REST API")

    async def connect_to_server(self):
        while self.connection is None:
            self.get_token()

            header = {"Authorization": "Bearer {}".format(self.token)}
            url = WS_URL + self.device_name

            try:
                self.connection = await websockets.connect(
                    url, ping_interval=30,
                    extra_headers=header
                )
            except Exception as e:
                logging.debug("Could not connect to server: {}".format(e))
                # raise RuntimeError('Could not establish websocket connection with server')
                # print("Could not connect to server, trying again...")
                time.sleep(3)

    async def connect_to_local(self):
        while self.connection is None:
            try:
                self.connection = await websockets.connect(
                    LOCAL_WS_URL, ping_interval=30
                )
            except Exception:
                # print(e)
                # raise RuntimeError('Could not establish websocket connection with local')
                # print("Could not connect to local, trying again...")
                pass

    async def ws_connect(self):
        await self.connection_func()

    async def future_send(self, future, json_data):
        future.set_result(
            await self.connection.send(json.dumps(json_data))
        )

    def get_start_confirmation(self, exam_id):
        return {
            "action": "START_CONFIRMATION",
            "payload": {
                "examination_id": exam_id
            }
        }

    async def send_start_confirmation(self, exam_id):
        json_data = self.get_start_confirmation(exam_id)
        await self.connection.send(json.dumps(json_data))

    def get_step_result(self, exam_id, step_id, additional, data):
        raw_data = pickle.dumps(data)
        raw_compressed = zlib.compress(raw_data)
        json_data = {
            "action": "STEP_RESULT",
            "payload": {
                "examination_id": exam_id,
                "step_id": step_id,
                "additional_data": json.dumps(additional),
                "raw": base64.b64encode(raw_compressed).decode('utf-8')
            }
        }

        json_string = json.dumps(json_data)
        filename = 'results/results_{}_{}'.format(
            exam_id, datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
        with open(filename, 'w') as myf:
            myf.write(json_string)

        # with open("C:\\Esten\\test_sockets\\real_zipped", 'r') as myf:
        #     json_string = myf.read()

        # new_json = json.loads(json_string)
        # new_json['payload']['examination_id'] = exam_id
        # new_json['payload']['step_id'] = step_id
        return json_data

    async def send_step_result(self, exam_id, step_id, additional, data):
        json_data = self.get_step_result(
            exam_id, step_id, additional, data)
        json_string = json.dumps(json_data)

        filename = 'results_{}_{}'.format(
            exam_id, datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
        with open(filename, 'w') as myf:
            myf.write(json_string)

        with open("real_zipped", 'r') as myf:
            json_string = myf.read()

        new_json = json.loads(json_string)
        new_json['payload']['examination_id'] = exam_id
        new_json['payload']['step_id'] = step_id
        json_string = json.dumps(new_json)

        await self.connection.send(json_string)

    def get_end_confirmation(self, exam_id):
        return {
            "action": "END_CONFIRMATION",
            "payload": {
                "examination_id": exam_id
            }
        }

    async def send_end_confirmation(self, exam_id):
        json_data = self.get_end_confirmation(exam_id)
        await self.connection.send(json.dumps(json_data))

    def get_terminate(self, exam_id):
        return {
            "action": "TERMINATE",
            "payload": {
                "examination_id": exam_id
            }
        }

    async def send_terminate(self, exam_id):
        json_data = self.get_terminate(exam_id)
        await self.connection.send(json.dumps(json_data))

    async def expect_socket(self):
        if not self.connection:
            return

        while True:
            socket = await self.connection.recv()
            # print(datetime.datetime.now(), socket)
            self.queue.put(socket)

    def listen(self):
        logging.info('Starting listening to server')
        asyncio.set_event_loop(self.listen_loop)

        try:
            self.listen_loop.run_until_complete(self.ws_connect())

            self.listen_task = self.listen_loop.create_task(self.expect_socket())
            self.listen_loop.run_until_complete(self.listen_task)
        except Exception:
            self.connection = None
            self.token = None
            logging.debug('Server listen operation failed, trying to start again')

            while self.connection is None:
                logging.debug('Trying to reconnect to server...')
                try:
                    self.listen_loop.run_until_complete(self.ws_connect())
                except Exception as e:
                    logging.debug("Cannot connect to server: {}".format(e))
                    time.sleep(10)

            if self.connection:
                try:
                    self.listen_task = self.listen_loop.create_task(self.expect_socket())
                    self.listen_loop.run_until_complete(self.listen_task)
                except Exception:
                    self.listen()

    async def send_socket(self):
        # if not self.connection:
        #     return

        while True:
            logging.info("Checking for send messages")
            socket = self.send_queue.get(block=True)
            if socket:
                logging.info("Sending new socket: {}...".format(socket[:50]))
                if self.connection:
                    logging.info("Socket length: {}".format(len(socket)))
                    try:
                        await self.connection.send(socket)
                    except Exception as e:
                        logging.debug("Could not send socket: {}".format(e))
                        # pass
                else:
                    logging.debug("Failed send - No server connection exists")

    def send(self):
        logging.info('Starting send job')

        try:
            asyncio.set_event_loop(self.send_loop)

            self.send_task = self.send_loop.create_task(self.send_socket())
            self.send_loop.run_until_complete(self.send_task)
        except Exception:
            self.connection = None
            logging.debug('Send operation failed, trying to start again')
            # self.send()

            while self.connection is None:
                pass

            if self.connection:
                try:
                    self.send_task = self.send_loop.create_task(self.send_socket())
                    self.send_loop.run_until_complete(self.send_task)
                except Exception:
                    self.send()

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
