from copy import deepcopy
import datetime
import logging
import time

import numpy as np
from pygame.locals import *
import pygame.time

from app_config import LANG
from pygame_config import *
from pygame_events import *
from scenario import Scenario
from texts import TEXTS


class RhythmGame(Scenario):
    def __init__(self, game, display):
        super().__init__(game, display)

        self.instruction = TEXTS["RH_INSTRUCTION"][LANG]
        self.instruction_font = FONT_56
        self.game_instruction = self.instruction

        self.is_detecting = False
        self.is_pressed = False
        self.presses = 0

        self.last_press_evt = None
        self.add_data = list()

    def process_game_event(self, event):
        if event.type == QUIT:
            pygame.quit()
            asyncio.run(self.end_game())
        if event.type == STOP_GAME:
            self.running = False

    def show_game_instruction(self):
        instruction_msg, rect = FONT_32.render(self.game_instruction, fgcolor=GREY)
        _, _, instruction_w, instruction_h = rect
        start_x = int(WIDTH // 2 - (instruction_w // 2))
        start_y = int(HEIGHT * INSTRUCTION_TOP_PADDING)
        self.display.blit(instruction_msg, (start_x, start_y))

    def show_left_hand(self, finger_list, values, threshold):
        l_hand = pygame.image.load("resources/hand_left_crop.png")
        l_hand_w, l_hand_h = l_hand.get_size()
        image_x = WIDTH // 2 - int(WIDTH * GAME_HAND_GAP) // 2 - l_hand_w
        image_y = HEIGHT - l_hand_h

        self.display.blit(l_hand, (image_x, image_y))

        for finger_idx in finger_list:
            if finger_idx < 5:
                offset_x, offset_y = FINGER_OFFSETS_BIG[finger_idx]
                x = image_x + offset_x + BIG_CIRCLE_RADIUS
                y = image_y + offset_y + BIG_CIRCLE_RADIUS

                color = BRIGHT_GREEN if self.is_detecting and self.is_pressed else BRIGHT_ORANGE
                pygame.draw.circle(
                    self.display, color, (x, y), BIG_CIRCLE_RADIUS)

                if values:
                    stream_id = FINGER_POSITIONS[finger_idx]
                    val = abs(values[stream_id])
                    try:
                        radius = int(min(val / threshold, 1.0) * BIG_CIRCLE_RADIUS)
                    except ValueError:
                        radius = 0
                    color = GREEN if self.is_detecting and self.is_pressed else ORANGE
                    pygame.draw.circle(
                        self.display, color, (x, y), radius)

    def show_right_hand(self, finger_list, values, threshold):
        r_hand = pygame.image.load("resources/hand_right_crop.png")
        r_hand_w, r_hand_h = r_hand.get_size()
        image_x = WIDTH // 2 + int(WIDTH * GAME_HAND_GAP) // 2
        image_y = HEIGHT - r_hand_h

        self.display.blit(r_hand, (image_x, image_y))

        for finger_idx in finger_list:
            if finger_idx >= 5:
                offset_idx = -(finger_idx % 5) - 1
                offset_x, offset_y = FINGER_OFFSETS_BIG[offset_idx]
                x = image_x + r_hand_w - offset_x - BIG_CIRCLE_RADIUS
                y = image_y + offset_y + BIG_CIRCLE_RADIUS

                color = BRIGHT_GREEN if self.is_detecting and self.is_pressed else BRIGHT_ORANGE
                pygame.draw.circle(
                    self.display, color, (x, y), BIG_CIRCLE_RADIUS)

                if values:
                    stream_id = FINGER_POSITIONS[finger_idx]
                    val = abs(values[stream_id])
                    try:
                        radius = int(min(val / threshold, 1.0) * BIG_CIRCLE_RADIUS)
                    except ValueError:
                        radius = 0
                    color = GREEN if self.is_detecting and self.is_pressed else ORANGE
                    pygame.draw.circle(
                        self.display, color, (x, y), radius)

    def show_hands(self, finger_list, values, threshold):
        self.show_left_hand(finger_list, values, threshold)
        self.show_right_hand(finger_list, values, threshold)

    def update_values(self, fingers, threshold):
        # if not self.is_detecting:
        #     return

        values = np.array(self.game.rp_connection.rp_queue[-1][1])
        mean_val = np.mean(np.absolute(values[fingers]))
        # print(mean_val)

        if self.is_pressed and mean_val < threshold:
            self.is_pressed = False
            if len(self.add_data) > 0:
                self.add_data[-1]['release_offset'] = int((datetime.datetime.now() - self.start_time).total_seconds() * 1000)
        elif not self.is_pressed and mean_val > threshold:
            self.is_pressed = True
            self.add_data.append({
                "press_offset": int((datetime.datetime.now() - self.start_time).total_seconds() * 1000),
                "release_offset": 0
            })
            self.presses += 1

    def show_circle(self):
        # if not self.is_detecting:
        #     return

        bg_color = GREEN if self.is_pressed else ORANGE
        # color = GREEN if self.is_pressed else ORANGE

        # small_radius = 0
        # if self.last_press_evt:
        #     passed = (datetime.datetime.now() - self.last_press_evt).total_seconds()
        #     passed_ms = int(passed * 1000)
        #     small_radius = int(RH_CIRCLE_MAX_RADIUS * (passed_ms / self.time_limit))

        x = WIDTH // 2
        y = int(RH_CIRCLE_TOP_PADDING * HEIGHT)

        pygame.draw.circle(
            self.display, bg_color, (x, y), RH_CIRCLE_MAX_RADIUS)

        # pygame.draw.circle(
        #     self.display, color, (x, y), small_radius)

        # msg = "Perfect!" if self.is_pressed else "Press"
        command, rect = self.instruction_font.render(str(self.presses), fgcolor=WHITE)
        _, _, instruction_w, instruction_h = rect
        start_x = x - (instruction_w // 2)
        start_y = y - (instruction_h // 2)
        self.display.blit(command, (start_x, start_y))

    def display_pre_game_screen(self, duration, step, step_no, step_count):
        x = WIDTH // 2
        y = int(RH_CIRCLE_TOP_PADDING * HEIGHT)

        self.display.fill(WELCOME_BGD)

        self.show_pre_game_step_info(step_no, step_count, msg=TEXTS["STEP"][LANG])
        self.show_instruction()
        pygame.draw.circle(
            self.display, ORANGE, (x, y), RH_CIRCLE_MAX_RADIUS)
        self.show_hands(step.fingers, [], 0.0)
        pygame.display.update()

        channel = pygame.mixer.Sound('resources/sounds/rhythm_{}.wav'.format(LANG)).play()
        while channel.get_busy():
            pygame.time.wait(100)

        total_time = duration
        pygame.time.set_timer(STOP_WAIT, total_time, loops=1)
        pygame.time.set_timer(SECOND_PASSED, 1000, loops=total_time // 1000)
        pygame.time.set_timer(
            START_RECORDING, total_time - RECORDING_PADDING, loops=1)
        pygame.time.set_timer(STOP_RECORDING, RECORDING_PADDING, loops=1)
        self.running = True
        seconds_left = total_time // 1000
        # if seconds_left == step.padding_start // 1000:
        #     self.game.rp_connection.activate()
        while self.running:
            for event in pygame.event.get():
                self.process_pre_game_event(event)
                if event.type == SECOND_PASSED:
                    seconds_left -= 1
                    # if seconds_left == step.padding_start // 1000:
                    #     self.game.rp_connection.activate()

            self.display.fill(WELCOME_BGD)

            self.show_pre_game_step_info(step_no, step_count, msg=TEXTS["STEP"][LANG])

            self.show_instruction()

            pygame.draw.circle(
                self.display, ORANGE, (x, y), RH_CIRCLE_MAX_RADIUS)
            self.show_hands(step.fingers, [], 0.0)

            self.show_countdown_overlay(seconds_left)

            pygame.display.update()
            self.framePerSec.tick(FPS)

        pygame.mixer.Sound('resources/sounds/beep.wav').play()

    def display_game(self, step, step_no, step_count):
        if not self.game.rp_connection.active:
            self.start_game = datetime.datetime.now()
            self.game.rp_connection.activate()

        self.display.fill(WELCOME_BGD)

        active_fingers_id = [FINGER_POSITIONS[idx] for idx in step.fingers]

        total_time = step.duration
        pygame.time.set_timer(STOP_GAME, total_time, loops=1)
        pygame.time.set_timer(SECOND_PASSED, 1000, loops=total_time // 1000)

        # self.detecting_time = int(60000 / step.additional['frequency'])
        # press_count = int(total_time / self.detecting_time)
        # self.time_limit = int(RH_TIME_LIMIT * self.detecting_time)
        # pygame.time.set_timer(RH_PRESS_EVENT, self.detecting_time, loops=press_count)

        self.running = True
        seconds_left = total_time // 1000
        threshold = step.additional['threshold']
        self.is_detecting = True
        while self.running:
            for event in pygame.event.get():
                self.process_game_event(event)
                if event.type == SECOND_PASSED:
                    seconds_left -= 1
                    # print(seconds_left)
                if event.type == RH_PRESS_EVENT:
                    logging.info("Press at {}".format(datetime.datetime.now()))
                    self.last_press_evt = datetime.datetime.now()
                    # self.is_detecting = True
                    # self.is_pressed = False
                    pygame.time.set_timer(RH_RELAX_EVENT, self.time_limit, loops=1)
                if event.type == RH_RELAX_EVENT:
                    logging.info("Relax at {}".format(datetime.datetime.now()))
                    # self.is_detecting = False
                    # self.is_pressed = False

            self.display.fill(WELCOME_BGD)

            self.show_pre_game_step_info(step_no, step_count, msg=TEXTS["STEP"][LANG])
            self.show_game_instruction()
            self.show_countdown(seconds_left)

            self.update_values(active_fingers_id, threshold)
            self.show_circle()
            values = self.game.rp_connection.rp_queue[-1][1]
            self.show_hands(step.fingers, values, threshold)

            pygame.display.update()
            self.framePerSec.tick(FPS)

        pygame.mixer.Sound('resources/sounds/long_beep.wav').play()
        pygame.time.wait(1000)

    def run(self, step, step_no, step_count):
        raw_data = list()

        pre_game_duration = step.padding_start
        logging.info('Pre-game - rhythm')
        self.start_time = datetime.datetime.now()
        self.display_pre_game_screen(
            pre_game_duration, step, step_no, step_count)

        self.game.rp_connection.rp_queue.clear()
        self.game.rp_connection.rp_queue.append(
            (datetime.datetime.now(), [0.0] * 16, None))
        self.game.visualization_data.clear()

        logging.info('Measurement started - rhythm')
        self.display_game(step, step_no, step_count)
        logging.info('Measurement finished - rhythm')
        # raw_iter_data = np.array(
        #     [x[-1] for x in self.game.rp_queue], dtype='object'
        # )

        logging.info('Post-game - rhythm')
        self.display_post_game_screen(step, step_no, step_count)
        # return np.array(raw_data, dtype='object')
        rp_queue = deepcopy(self.game.rp_connection.rp_queue)
        raw_iter_data = [x[-1] for x in rp_queue]
        # print(len(raw_iter_data))
        raw_data.append(raw_iter_data[1:])
        logging.info("Rhythm sending {} samples".format(len(raw_data[-1])))
        logging.info("Rhythm sending detected data: {}".format(self.add_data))
        return raw_data, self.add_data
