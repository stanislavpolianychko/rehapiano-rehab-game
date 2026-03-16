import asyncio
import time
import sys

from game import Game


exam = {
    "action": "START_EXAMINATION",
    "payload": {
        "examination_id": "123456",
        "patient_code": "ABCD-1234",
        "note": "bla",
        "scenario": {
            "scenario_id": "123456789",
            "name": "scen1",
            "note": "note2",
            "steps": [
                {
                    "step_id": "123456",
                    "type": "MAX_FORCE",
                    "step_number": 1,  # in millis
                    "padding_start": 1000,  # in millis
                    "padding_end": 1000,  # in millis
                    "duration": 3000,  # in millis
                    "pause": 0,  # in millis
                    "fingers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
                }
            ]
        }
    }
}


async def main():
    test = Game()

    test.set_device_code("Device1234")
    test.update_institution("1234", "Nemocnica 1")

    time.sleep(2)

    test.handler.handle_start_examination(exam)

    # time.sleep(2)


asyncio.run(main())
sys.exit()
