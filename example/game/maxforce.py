from copy import deepcopy
import datetime
import logging
import time

import numpy as np
from pygame.locals import *
from pygame.time import wait

from app_config import LANG
from pygame_config import *
from pygame_events import *
from scenario import Scenario
from texts import TEXTS


class MaxForceGame(Scenario):
    def __init__(self, game, display):
        super().__init__(game, display)

        self.instruction = TEXTS["MF_INSTRUCTION"][LANG]
        self.game_instruction = TEXTS["MF_GAME_INSTRUCTION"][LANG]
        self.maximums = np.zeros(16, dtype='float32')
        self.max_registered = np.full(16, np.datetime64('now') - np.timedelta64(3, 's'), dtype='datetime64[ms]')
        self.is_green = np.full(16, False)

    def calculate_col_dimensions(self):
        all_cols_width = WIDTH * (1 - 2 * MAX_FORCE_PADDING)
        sections_count = SENSOR_COUNT * MAX_FORCE_COL_GAP_RATIO + (SENSOR_COUNT - 1)

        gap_width = int(all_cols_width / sections_count)
        col_width = MAX_FORCE_COL_GAP_RATIO * gap_width

        return col_width, gap_width

    def generate_shapes(self, values, select_fingers, l_x, r_x, bottom_y):
        rects = list()

        max_height = COL_RECT_H - 2 * COL_V_PADDING
        col_bottom = bottom_y - COL_V_PADDING

        orig = self.maximums.copy()
        self.maximums = np.maximum(self.maximums, np.absolute(values))
        updated = self.maximums > orig
        self.max_registered[updated] = np.datetime64('now')
        self.is_green = (np.datetime64('now') - self.max_registered).astype(np.int32) < 2000

        for idx in range(0, 10):
            if idx in select_fingers:
                stream_id = FINGER_POSITIONS[idx]
                val = values[stream_id]  # server code to stream code
                height = int(abs(val) * max_height * self.game.gains[stream_id])
                height = min(height, max_height)

                finger_max = self.maximums[stream_id]
                f_max_height = int(abs(finger_max) * max_height * self.game.gains[stream_id])
                f_max_height = min(f_max_height, max_height)

                box_x = l_x if idx < 5 else r_x
                start_x = box_x + COL_H_PADDING + (idx % 5) * (COL_W + COL_H_PADDING)
                rect = (
                    start_x, int(col_bottom - height),
                    COL_W, height
                )
                max_rect = (
                    start_x, int(col_bottom - f_max_height),
                    COL_W, f_max_height
                )
                rects.append((pygame.Rect(rect), pygame.Rect(max_rect), self.is_green[stream_id]))

        return rects

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

    def show_left_hand(self, finger_list, values):
        l_hand = pygame.image.load("resources/hand_left_crop.png")
        l_hand_w, l_hand_h = l_hand.get_size()
        image_x = WIDTH // 2 - int(WIDTH * GAME_HAND_GAP) // 2 - l_hand_w
        image_y = HEIGHT - l_hand_h

        if np.count_nonzero(self.maximums) != 0:
            values = values / self.maximums
            values[values == np.nan] = 0.0

        self.display.blit(l_hand, (image_x, image_y))

        for finger_idx in finger_list:
            if finger_idx < 5:
                offset_x, offset_y = FINGER_OFFSETS_BIG[finger_idx]
                x = image_x + offset_x + BIG_CIRCLE_RADIUS
                y = image_y + offset_y + BIG_CIRCLE_RADIUS

                stream_id = FINGER_POSITIONS[finger_idx]
                color = BRIGHT_GREEN if self.is_green[stream_id] else BRIGHT_ORANGE
                pygame.draw.circle(
                    self.display, color, (x, y), BIG_CIRCLE_RADIUS)

                val = values[stream_id]
                try:
                    radius = int(val * BIG_CIRCLE_RADIUS)
                except ValueError:
                    radius = 0
                color = GREEN if self.is_green[stream_id] else ORANGE
                pygame.draw.circle(
                    self.display, color, (x, y), radius)

    def show_right_hand(self, finger_list, values):
        r_hand = pygame.image.load("resources/hand_right_crop.png")
        r_hand_w, r_hand_h = r_hand.get_size()
        image_x = WIDTH // 2 + int(WIDTH * GAME_HAND_GAP) // 2
        image_y = HEIGHT - r_hand_h

        if np.count_nonzero(self.maximums) != 0:
            values = values / self.maximums
            values[values == np.nan] = 0

        self.display.blit(r_hand, (image_x, image_y))
        # print(values, self.maximums)

        for finger_idx in finger_list:
            if finger_idx >= 5:
                offset_idx = -(finger_idx % 5) - 1
                offset_x, offset_y = FINGER_OFFSETS_BIG[offset_idx]
                x = image_x + r_hand_w - offset_x - BIG_CIRCLE_RADIUS
                y = image_y + offset_y + BIG_CIRCLE_RADIUS

                stream_id = FINGER_POSITIONS[finger_idx]
                color = BRIGHT_GREEN if self.is_green[stream_id] else BRIGHT_ORANGE
                pygame.draw.circle(
                    self.display, color, (x, y), BIG_CIRCLE_RADIUS)

                val = values[stream_id]
                try:
                    radius = int(val * BIG_CIRCLE_RADIUS)
                except ValueError:
                    radius = 0
                color = GREEN if self.is_green[stream_id] else ORANGE
                pygame.draw.circle(
                    self.display, color, (x, y), radius)

    def show_hands(self, finger_list, values):
        self.show_left_hand(finger_list, values.copy())
        self.show_right_hand(finger_list, values.copy())

    def show_left_box(self):
        l_rect_x = WIDTH // 2 - int(WIDTH * GAME_HAND_GAP) // 2 - COL_RECT_W + 14
        l_rect_y = int(COL_RECT_V_PADDING * HEIGHT)

        pygame.draw.rect(
            self.display, WHITE,
            (l_rect_x, l_rect_y, COL_RECT_W, COL_RECT_H)
        )

        return l_rect_x, l_rect_y

    def show_right_box(self):
        r_rect_x = WIDTH // 2 + int(WIDTH * GAME_HAND_GAP) // 2 - 14
        r_rect_y = int(COL_RECT_V_PADDING * HEIGHT)

        pygame.draw.rect(
            self.display, WHITE,
            (r_rect_x, r_rect_y, COL_RECT_W, COL_RECT_H)
        )

        return r_rect_x, r_rect_y

    def show_shapes(self, step, values):
        l_x, l_y = self.show_left_box()
        r_x, r_y = self.show_right_box()
        bottom_y = l_y + COL_RECT_H
        rectangles = self.generate_shapes(
            values,
            step.fingers, l_x, r_x, bottom_y
        )

        for rect, max_rect, is_green in rectangles:
            pygame.draw.rect(self.display, GREY2, max_rect)

            if is_green:
                pygame.draw.rect(self.display, GREEN, rect)
            else:
                pygame.draw.rect(self.display, ORANGE, rect)

    def display_game(self, step, step_no, step_count):
        if not self.game.rp_connection.active:
            self.game.rp_connection.activate()
        col_w, gap_w = self.calculate_col_dimensions()

        self.display.fill(WELCOME_BGD)

        total_time = step.duration
        pygame.time.set_timer(STOP_GAME, total_time, loops=1)
        pygame.time.set_timer(SECOND_PASSED, 1000, loops=total_time // 1000)
        self.running = True
        seconds_left = total_time // 1000
        while self.running:
            for event in pygame.event.get():
                self.process_game_event(event)
                if event.type == SECOND_PASSED:
                    seconds_left -= 1
                    # print(seconds_left)

            self.display.fill(WELCOME_BGD)

            self.show_pre_game_step_info(step_no, step_count, msg=TEXTS["ITERATION"][LANG])
            self.show_game_instruction()
            self.show_countdown(seconds_left)

            values = self.game.rp_connection.rp_queue[-1][1].copy()
            values2 = [abs(c) if abs(c) > 0.02 else 0.0 for c in values]
            self.show_shapes(step, values2)
            self.show_hands(step.fingers, values2)

            pygame.display.update()
            self.framePerSec.tick(FPS)

        pygame.mixer.Sound('resources/sounds/long_beep.wav').play()
        wait(1000)

    def run(self, step, step_no, step_count):
        iterations = step.additional['iteration_count']
        raw_data = list()

        pre_game_duration = step.padding_start
        for i in range(iterations):
            logging.info('Pre-game - maxforce')
            play_sound = i == 0
            self.display_pre_game_screen(
                pre_game_duration, step, step_no, step_count, play_sound)

            self.game.rp_connection.rp_queue.clear()
            self.game.rp_connection.rp_queue.append(
                (datetime.datetime.now(), [0.0] * 16, None))
            self.game.visualization_data.clear()

            logging.info('Measurement started - maxforce')
            self.display_game(step, i + 1, iterations)
            logging.info('Measurement finished - maxforce')
            # raw_iter_data = np.array(
            #     [x[-1] for x in self.game.rp_queue], dtype='object'
            # )
            sample_size = len(self.game.rp_connection.rp_queue)
            logging.info("Maxforce sanding {} samples".format(sample_size))
            rp_queue = deepcopy(list(self.game.rp_connection.rp_queue)[:sample_size])
            raw_iter_data = [x[-1] for x in rp_queue]
            # print(i + 1, len(raw_iter_data))
            raw_data.append(raw_iter_data[1:])

            # print(i + 1, len(raw_data[-1]))

            pre_game_duration = step.pause

        logging.info('Post-game - maxforce')
        self.display_post_game_screen(step, step_no, step_count)
        # return np.array(raw_data, dtype='object')
        return raw_data, dict()
