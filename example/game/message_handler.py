import logging

from examination_entities import Examination


class MessageHandler:
    def __init__(self, game):
        self.game = game

    def handle_socket(self, socket):
        # msg arrives in json form
        action = socket["action"]
        if action == "INIT":
            self.handle_init(socket)
        elif action == "START_EXAMINATION":
            self.handle_start_examination(socket)
        elif action == "STEP_REQUEST":
            self.handle_step_request(socket)
        elif action == "TERMINATE":
            self.handle_terminate(socket)
        else:
            raise ValueError("Unsupported socket action type {}".format(
                action))

    def handle_init(self, init_json):
        payload = init_json["payload"]
        institution_id = payload["institution_id"]
        institution_name = payload["institution_name"]
        device_code = payload["device_code"]
        tenso_json = payload["tenzometer_data"]

        self.game.set_device_code(device_code)
        self.game.set_tenso_data(tenso_json)
        self.game.update_institution(institution_id, institution_name)

    def handle_start_examination(self, exam_info):
        payload = exam_info["payload"]
        examination = Examination(
            payload["examination_id"],
            payload["patient_code"],
            payload["note"],
            payload["scenario"]
        )

        self.game.add_examination(examination)

    def handle_step_request(self, step_request_info):
        logging.info('Handling step request')
        payload = step_request_info["payload"]
        exam_id = payload["examination_id"]
        steps = payload["steps"]

        _ = self.game.get_step_data(exam_id, steps)

    def handle_terminate(self, terminate_info):
        exam_id = terminate_info["payload"]["examination_id"]

        self.game.end_game()
