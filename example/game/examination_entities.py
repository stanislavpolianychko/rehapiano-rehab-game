import json


class Step:
    def __init__(self, step_id, step_number, padding_start, padding_end,
                 duration, pause, fingers, additional_config, step_type):
        self.step_id = step_id
        self.step_number = step_number
        self.padding_start = padding_start
        self.padding_end = padding_end
        self.duration = duration
        self.pause = pause
        self.fingers = fingers
        self.additional = json.loads(additional_config)
        self.step_type = step_type


class Scenario:
    def __init__(self, scenario_id, name, note, steps):
        self.scenario_id = scenario_id
        self.name = name
        self.note = note

        self.load_steps(steps)

    def load_steps(self, steps):
        self.steps = list()
        for step in steps:  # after it becomes a list
            self.steps.append(
                Step(step['step_id'], step['step_number'],
                     step['padding_start'], step['padding_end'],
                     step['duration'], step['pause'],
                     step['fingers'], step['additional_config'],
                     step['type'])
            )

        self.steps.sort(key=lambda s: s.step_id)


class Examination:
    def __init__(self, exam_id, patient_code, note, scenario):
        self.exam_id = exam_id
        self.patient_code = patient_code
        self.note = note
        self.scenario = Scenario(
            scenario['scenario_id'], scenario['name'], scenario['note'],
            scenario['steps']
        )
