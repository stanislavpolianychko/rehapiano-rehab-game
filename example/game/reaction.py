from copy import deepcopy
import datetime
import logging
import random

import numpy as np
import pygame
from pygame.locals import *

from app_config import LANG
from pygame_config import *
from pygame_events import *
from scenario import Scenario
from texts import TEXTS


class ReactionGame(Scenario):
    def __init__(self, game, display):
        super().__init__(game, display)

        self.instruction = TEXTS["RE_INSTRUCTION"][LANG]
        self.instruction_font = FONT_32
        self.game_instruction = self.instruction

        self.reset_shapes()

        self.is_detecting = False
        self.has_caught = False
        self.active_id = None
        self.last_generated = None

    def reset_shapes(self):
        self.left_box = None
        self.right_box = None
        self.columns = list()
        self.balls = list()

    def init_shapes(self, step):
        self.left_box = self.generate_left_box()
        self.right_box = self.generate_right_box()
        l_x, l_y = self.left_box[0], self.left_box[1]
        r_x = self.right_box[0]
        bottom_y = l_y + COL_RECT_H

        self.columns = self.generate_cols(
            step.fingers, l_x, r_x, bottom_y
        )
        self.ball_x = [c[0] + c[2] // 2 if c else None for c in self.columns]
        self.ball_start_y = [c[1] + int(c[3] * 0.1) if c else None for c in self.columns]
        self.balls = [
            [x, y, RE_BALL_RADIUS] if x is not None and y is not None else None 
            for x, y in zip(self.ball_x, self.ball_start_y)
        ]

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

    def show_left_hand(self, finger_list, active_id, values, threshold):
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

                if finger_idx != active_id or not self.is_detecting:
                    color = GREY3
                else:
                    color = BRIGHT_GREEN if self.has_caught else BRIGHT_ORANGE
                pygame.draw.circle(
                    self.display, color, (x, y), BIG_CIRCLE_RADIUS)

                if values:
                    stream_id = FINGER_POSITIONS[finger_idx]
                    val = abs(values[stream_id])
                    try:
                        radius = int(min(val / threshold, 1.0) * BIG_CIRCLE_RADIUS)
                    except ValueError:
                        radius = 0
                    if finger_idx != active_id or not self.is_detecting:
                        color = GREY2
                    else:
                        color = GREEN if self.has_caught else ORANGE
                    pygame.draw.circle(
                        self.display, color, (x, y), radius)

    def show_right_hand(self, finger_list, active_id, values, threshold):
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

                if finger_idx != active_id or not self.is_detecting:
                    color = GREY3
                else:
                    color = BRIGHT_GREEN if self.has_caught else BRIGHT_ORANGE

                pygame.draw.circle(
                    self.display, color, (x, y), BIG_CIRCLE_RADIUS)

                if values:
                    stream_id = FINGER_POSITIONS[finger_idx]
                    val = abs(values[stream_id])
                    try:
                        radius = int(min(val / threshold, 1.0) * BIG_CIRCLE_RADIUS)
                    except ValueError:
                        radius = 0
                    if finger_idx != active_id or not self.is_detecting:
                        color = GREY2
                    else:
                        color = GREEN if self.has_caught else ORANGE
                    pygame.draw.circle(
                        self.display, color, (x, y), radius)

    def show_hands(self, finger_list, active_id, values, threshold):
        self.show_left_hand(finger_list, active_id, values, threshold)
        self.show_right_hand(finger_list, active_id, values, threshold)

    def detect_pressing(self, fingers, active_id, threshold):
        if not self.is_detecting:
            return

        curr_values = np.array(self.game.rp_connection.rp_queue[-1][1].copy())
        values = np.absolute(curr_values)
        active_val = abs(values[FINGER_POSITIONS[active_id]])
        rel_values = np.delete(values, [0, 8])  # ignore thumbs
        # print(values[8:], active_val)

        if not self.has_caught and np.max(rel_values) <= active_val and active_val > threshold:
            logging.info('Ball caught')
            self.has_caught = True
            caught_time = datetime.datetime.now()
            self.add_data[-1]["reaction"] = int((caught_time - self.last_generated).total_seconds() * 1000)
            pygame.time.set_timer(RE_DELETE_EVENT, 300, loops=1)

    def generate_left_box(self):
        l_rect_x = WIDTH // 2 - int(WIDTH * GAME_HAND_GAP) // 2 - COL_RECT_W + 14
        l_rect_y = int(COL_RECT_V_PADDING * HEIGHT)

        return (l_rect_x, l_rect_y, COL_RECT_W, COL_RECT_H)

    def generate_right_box(self):
        r_rect_x = WIDTH // 2 + int(WIDTH * GAME_HAND_GAP) // 2 - 14
        r_rect_y = int(COL_RECT_V_PADDING * HEIGHT)

        return (r_rect_x, r_rect_y, COL_RECT_W, COL_RECT_H)

    def show_shapes(self):
        pygame.draw.rect(self.display, WHITE, self.left_box)
        pygame.draw.rect(self.display, WHITE, self.right_box)

        for rect in self.columns:
            if rect:
                pygame.draw.rect(self.display, GREY3, rect)

        for idx, circle in enumerate(self.balls):
            if circle:
                x, y, rad = circle
                if idx != self.active_id or not self.is_detecting:
                    color = GREY2
                else:
                    color = GREEN if self.has_caught else ORANGE
                pygame.draw.circle(self.display, color, (x, y), rad)

    def calculate_col_dimensions(self):
        all_cols_width = WIDTH * (1 - 2 * MAX_FORCE_PADDING)
        sections_count = SENSOR_COUNT * MAX_FORCE_COL_GAP_RATIO + (SENSOR_COUNT - 1)

        gap_width = int(all_cols_width / sections_count)
        col_width = MAX_FORCE_COL_GAP_RATIO * gap_width

        return col_width, gap_width

    def generate_cols(self, select_fingers, l_x, r_x, bottom_y):
        rects = list()

        max_height = COL_RECT_H - 2 * COL_V_PADDING
        col_bottom = bottom_y - COL_V_PADDING

        for idx in range(0, 10):
            if idx in select_fingers:
                box_x = l_x if idx < 5 else r_x
                start_x = box_x + COL_H_PADDING + (idx % 5) * (COL_W + COL_H_PADDING)
                rect = (
                    start_x, int(col_bottom - max_height),
                    COL_W, max_height
                )

                rects.append(pygame.Rect(rect))
            else:
                rects.append(None)

        return rects

    def display_pre_game_screen(self, duration, step, step_no, step_count):
        self.display.fill(WELCOME_BGD)

        self.init_shapes(step)

        self.show_pre_game_step_info(step_no, step_count, msg=TEXTS["STEP"][LANG])
        self.show_instruction()
        self.show_shapes()
        self.show_hands(step.fingers, None, [], 0.0)
        pygame.display.update()

        channel = pygame.mixer.Sound('resources/sounds/reaction_{}.wav'.format(LANG)).play()
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

            self.show_shapes()
            self.show_hands(step.fingers, None, [], 0.0)

            self.show_countdown_overlay(seconds_left)

            pygame.display.update()
            self.framePerSec.tick(FPS)

        self.reset_shapes()
        # pygame.mixer.Sound('resources/sounds/beep.wav').play()

    def update(self):
        if self.is_detecting:
            time_passed = (datetime.datetime.now() - self.last_generated).total_seconds() * 1000
            if time_passed > self.detect_time:
                self.is_detecting = False
                logging.info("Ball time out")
                pygame.time.set_timer(RE_DELETE_EVENT, 300, loops=1)

            # self.balls[self.active_id][1] += self.ball_speed
            if not self.has_caught:
                y_change = min(1, time_passed / self.detect_time)
                self.balls[self.active_id][1] = self.ball_start_y[self.active_id] + (self.ball_max_y_movement * y_change)

    def display_game(self, step, step_no, step_count):
        if not self.game.rp_connection.active:
            self.game.rp_connection.activate()
            self.start_time = datetime.datetime.now()

        self.display.fill(WELCOME_BGD)

        min_wait = step.additional['min_pause'] // 100
        max_wait = step.additional['max_pause'] // 100
        self.detect_time = step.additional['max_reaction_time']
        threshold = step.additional['threshold']
        total_balls = step.additional['iteration_count']
        generated_balls = 0
        self.init_shapes(step)
        col_h = int((COL_RECT_H - 2 * COL_V_PADDING) * 0.9)
        self.ball_max_y_movement = col_h - 2 * RE_BALL_RADIUS
        self.ball_speed = round(self.ball_max_y_movement / ((self.detect_time // 1000) * FPS))

        self.running = True
        wait = random.randint(min_wait, max_wait) * 100
        pygame.time.set_timer(RE_NEW_BALL_EVENT, wait, loops=1)
        self.add_data = []

        finger_order = step.fingers.copy()
        random.shuffle(finger_order)
        while generated_balls < total_balls + 1:
            for event in pygame.event.get():
                self.process_game_event(event)
                if event.type == RE_NEW_BALL_EVENT:
                    logging.info("Generating new ball")
                    self.is_detecting = True
                    self.has_caught = False
                    self.last_generated = datetime.datetime.now()
                    self.active_id = finger_order[generated_balls % len(finger_order)]
                    self.init_shapes(step)
                    generated_balls += 1
                    if generated_balls <= total_balls:
                        pygame.mixer.Sound('resources/sounds/beep.wav').play()
                    logging.info("So far generated {}".format(generated_balls))
                    self.add_data.append({
                        "finger": self.active_id,
                        "offset": int((self.last_generated - self.start_time).total_seconds() * 1000),
                        "reaction": 0
                    })
                if event.type == RE_DELETE_EVENT:
                    logging.info("Deleting ball")
                    self.is_detecting = False
                    self.has_caught = False
                    self.active_id = None
                    self.init_shapes(step)
                    wait = random.randint(min_wait, max_wait) * 100
                    pygame.time.set_timer(RE_NEW_BALL_EVENT, wait, loops=1)

            if generated_balls == total_balls + 1:
                break
            if generated_balls == len(finger_order):
                random.shuffle(finger_order)
            self.display.fill(WELCOME_BGD)

            self.show_pre_game_step_info(step_no, step_count, msg=TEXTS["STEP"][LANG])
            self.show_game_instruction()

            self.detect_pressing(step.fingers, self.active_id, threshold)
            self.update()
            # self.show_countdown(seconds_left)

            # values = self.game.rp_connection.rp_queue[-1][1]
            self.show_shapes()
            curr_values = self.game.rp_connection.rp_queue[-1][1].copy()
            self.show_hands(step.fingers, self.active_id, curr_values, threshold)

            pygame.display.update()
            self.framePerSec.tick(FPS)

    def run(self, step, step_no, step_count):
        raw_data = list()

        pre_game_duration = step.padding_start
        logging.info('Pre-game - reaction')
        self.display_pre_game_screen(
            pre_game_duration, step, step_no, step_count)

        self.game.rp_connection.rp_queue.clear()
        self.game.rp_connection.rp_queue.append(
            (datetime.datetime.now(), [0.0] * 16, None))
        self.game.visualization_data.clear()

        logging.info('Measurement started - reaction')
        self.display_game(step, step_no, step_count)
        logging.info('Measurement finished - reaction')
        logging.info(self.add_data[:-1])
        # raw_iter_data = np.array(
        #     [x[-1] for x in self.game.rp_queue], dtype='object'
        # )

        logging.info('Post-game - reaction')
        self.display_post_game_screen(step, step_no, step_count)
        # return np.array(raw_data, dtype='object')
        rp_queue = deepcopy(self.game.rp_connection.rp_queue)
        raw_iter_data = [x[-1] for x in rp_queue]
        # print(len(raw_iter_data))
        raw_data.append(raw_iter_data[1:])
        logging.info("Reaction sending {} samples".format(len(raw_data[-1])))
        return raw_data, self.add_data[:-1]
