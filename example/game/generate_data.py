import random

import numpy as np


INST_ID = random.randint(100, 999)
EXAM_ID = random.randint(100, 999)
PATIENT_CODE = "ABCD-1234"
SCENARIO_ID = random.randint(100, 999)
STEPS_COUNT = random.randint(10, 15)
STEP_ID = str(random.randint(10, 99))


def generate_init():
    return {
        "action": "INIT",
        "payload": {
            "institution_id": str(INST_ID)
        }
    }


def generate_step(step_no):
    return {
        "step_id": STEP_ID,
        "step_number": step_no,
        "padding_start": random.choice([0.1, 0.2, 0.3, 0.5]),
        "padding_end": random.choice([0.1, 0.2, 0.3, 0.5]),
        "duration": random.choice([1, 3, 5]),
        "pause": random.choice([1, 3, 5, 10]),
        "fingers": random.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], k=random.randint(1, 5)),
        "type": random.sample(["MAX_FORCE", "REACTION", "RHYTHM"], k=1)
    }


def generate_start_examination():
    return {
        "action": "START_EXAMINATION",
        "payload": {
            "examination_id": str(EXAM_ID),
            "patient_code": PATIENT_CODE,
            "note": "bla-note",
            "scenario": {
                "scenario_id": str(SCENARIO_ID),
                "name": "scen_name",
                "note": "bla-scenario-note",
                "steps": generate_step(1)  # redo for list
            }
        }
    }


def generate_step_request():
    return {
        "action": "STEP_REQUEST",
        "payload": {
            "examination_id": str(EXAM_ID),
            "steps": [STEP_ID]  # redo for list, select from STEPS_COUNT range
        }
    }


def generate_terminate():
    return {
        "action": "TERMINATE",
        "payload": {
            "examination_id": str(EXAM_ID)
        }
    }


def generate_raw_data(length):
    return np.random.rand(length, 10)
