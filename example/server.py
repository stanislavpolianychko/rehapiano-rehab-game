import asyncio
import datetime
import json
import time

import websockets


INIT = {
    "action": "INIT",
    "payload": {
        "institution_id": "A847-BFG8",
        "institution_name": "Nemocnica 1",
        "device_code": "ABCD-1234",
        "tenzometer_data": []
    }
}


START_EXAM_MF = {
    "action": "START_EXAMINATION",
    "payload": {
        "examination_id": "TR42-REFG9",
        "patient_code": "IV48-UG76",
        "note": "bla-note",
        "scenario": {
            "scenario_id": "PLTR-4217",
            "name": "scen_name",
            "note": "bla-scenario-note",
            "steps": [
                {
                    "step_id": "UTR4-DRF8",
                    "step_number": 1,
                    "padding_start": 500,
                    "padding_end": 500,
                    "duration": 5000,
                    "pause": 2000,
                    "fingers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                    "additional_config": "{\"iteration_count\": 3}",
                    "type": "MAX_FORCE"
                }
            ]
        }
    }
}


START_EXAM_RH = {
    "action": "START_EXAMINATION",
    "payload": {
        "examination_id": "TR42-REFG8",
        "patient_code": "IV48-UG76",
        "note": "bla-note",
        "scenario": {
            "scenario_id": "PLTR-4218",
            "name": "scen_name",
            "note": "bla-scenario-note",
            "steps": [
                {
                    "step_id": "UTR4-DRF9",
                    "step_number": 1,
                    "padding_start": 500,
                    "padding_end": 500,
                    "duration": 2000,
                    "pause": 2000,
                    "fingers": [0, 1],
                    "additional_config": "{\"threshold\": 0.2}",
                    "type": "RHYTHM"
                }
            ]
        }
    }
}

START_EXAM_RE = {
    "action": "START_EXAMINATION",
    "payload": {
        "examination_id": "TR42-REFG8",
        "patient_code": "IV48-UG76",
        "note": "bla-note",
        "scenario": {
            "scenario_id": "PLTR-4218",
            "name": "scen_name",
            "note": "bla-scenario-note",
            "steps": [
                {
                    "step_id": "UTR4-DRF9",
                    "step_number": 1,
                    "padding_start": 200,
                    "padding_end": 500,
                    "duration": 10000,
                    "pause": 2000,
                    "fingers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                    "additional_config": "{\"max_reaction_time\": 1000, \"min_pause\": 100, \"max_pause\": 200, \"iteration_count\": 5, \"threshold\": 0.2}",
                    "type": "REACTION"
                }
            ]
        }
    }
}

TEST_ON = START_EXAM_RE
TEST_ON2 = START_EXAM_RE
STEP_REQUEST = {
    "action": "STEP_REQUEST",
    "payload": {
        "examination_id": TEST_ON['payload']['examination_id'],
        "steps": [  # list ids of missing steps
            TEST_ON['payload']['scenario']['steps'][0]['step_id']
        ]
    }
}


async def send_init(websocket):
    await websocket.send(json.dumps(INIT))


async def send_start_exam(websocket, data):
    await websocket.send(json.dumps(data))


async def send_step_request(websocket):
    await websocket.send(json.dumps(STEP_REQUEST))


async def handler(websocket, path):
    print("connected")

    await send_init(websocket)
    print(datetime.datetime.now(), 'INIT sent')
    # time.sleep(10)

    await send_start_exam(websocket, TEST_ON)
    print(datetime.datetime.now(), 'START_EXAMINATION sent')

    print("waiting confirmation")
    test = await websocket.recv()
    print(test[:100])

    for _ in range(len(TEST_ON["payload"]["scenario"]["steps"])):
        print("waiting results")
        test = await websocket.recv()
        print(test[:100])

    print("waiting finish")
    test = await websocket.recv()
    print(test[:100])
    print("received")

    keep_open = await websocket.recv()


start_server = websockets.serve(
    handler, "localhost", 8000,
    ping_interval=30, max_size=None
)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
