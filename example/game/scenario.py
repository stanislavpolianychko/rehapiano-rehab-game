import datetime
import time

import pygame
from pygame.locals import *

from app_config import LANG
from pygame_config import *
from pygame_events import *
from texts import *


class Scenario:
    def __init__(self, game, display):
        self.game = game
        self.display = display

        self.instruction = ""
        self.framePerSec = pygame.time.Clock()
        self.running = False
        self.start_time = None

    def display_game(self, step, step_no, step_count):
        pass

    def run(self, step, step_no, step_count):
        pass

    def process_pre_game_event(self, event):
        if event.type == START_RECORDING:
            self.game.rp_connection.activate()
            # print('here')
            self.start_time = datetime.datetime.now()
        if event.type == STOP_RECORDING:
            self.game.rp_connection.deactivate()
        if event.type == QUIT:
            pygame.quit()
            asyncio.run(self.game.end_game())
        if event.type == STOP_WAIT:
            self.running = False

    def show_pre_game_step_info(self, step_no, step_count, msg="Step"):
        start_y = int(HEIGHT * INSTRUCTION_TOP_PADDING)
        start_x = int(WIDTH * INSTRUCTION_LEFT_PADDING)
        title_text = "{} {}/{}".format(msg, step_no, step_count)
        title_msg, rect = FONT_20.render(title_text, fgcolor=GREY)
        self.display.blit(title_msg, (start_x, start_y))

    def show_instruction(self):
        instruction_msg, rect = FONT_32.render(self.instruction, fgcolor=GREY)
        _, _, instruction_w, instruction_h = rect
        start_x = int(WIDTH // 2 - (instruction_w // 2))
        start_y = int(HEIGHT * INSTRUCTION_TOP_PADDING)
        self.display.blit(instruction_msg, (start_x, start_y))

    def show_left_fingers(self, finger_list):
        l_hand = pygame.image.load("resources/hand_left.png")
        l_hand_w, l_hand_h = l_hand.get_size()
        image_x = WIDTH // 2 - int(WIDTH * INSTRUCTION_HAND_GAP) // 2 - l_hand_w
        image_y = HEIGHT // 2 - l_hand_h // 2

        self.display.blit(l_hand, (image_x, image_y))

        for finger_idx in finger_list:
            if finger_idx < 5:
                offset_x, offset_y = FINGER_OFFSETS_SMALL[finger_idx]
                x = image_x + offset_x + SMALL_CIRCLE_RADIUS
                y = image_y + offset_y + SMALL_CIRCLE_RADIUS

                pygame.draw.circle(
                    self.display, ORANGE, (x, y), SMALL_CIRCLE_RADIUS)

    def show_right_fingers(self, finger_list):
        r_hand = pygame.image.load("resources/hand_right.png")
        r_hand_w, r_hand_h = r_hand.get_size()
        image_x = WIDTH // 2 + int(WIDTH * INSTRUCTION_HAND_GAP) // 2
        image_y = HEIGHT // 2 - r_hand_h // 2

        self.display.blit(r_hand, (image_x, image_y))

        for finger_idx in finger_list:
            if finger_idx >= 5:
                offset_idx = -(finger_idx % 5) - 1
                offset_x, offset_y = FINGER_OFFSETS_SMALL[offset_idx]
                x = image_x + r_hand_w - offset_x - SMALL_CIRCLE_RADIUS
                y = image_y + offset_y + SMALL_CIRCLE_RADIUS

                pygame.draw.circle(
                    self.display, ORANGE, (x, y), SMALL_CIRCLE_RADIUS)

    def show_fingers(self, finger_list):
        self.show_left_fingers(finger_list)
        self.show_right_fingers(finger_list)

    def show_countdown(self, seconds_left):
        time_str = "{}".format(seconds_left)
        time_msg, rect = FONT_32.render(time_str, fgcolor=GREY)
        _, _, time_w, time_h = rect
        start_y = int(HEIGHT * INSTRUCTION_TOP_PADDING)
        start_x = int(WIDTH * (1 - INSTRUCTION_RIGHT_PADDING)) - time_w
        self.display.blit(time_msg, (start_x, start_y))

    def show_countdown_overlay(self, seconds_left):
        game_over_screen_fade = pygame.Surface((WIDTH, HEIGHT))
        game_over_screen_fade.fill((0, 0, 0))
        game_over_screen_fade.set_alpha(160)
        self.display.blit(game_over_screen_fade, (0, 0))

        ready_str, rect = FONT_72.render(TEXTS["READY"][LANG], fgcolor=WHITE)
        _, _, time_w, time_h = rect
        start_x = WIDTH // 2 - (time_w // 2)
        start_y = HEIGHT // 2 - 300
        self.display.blit(ready_str, (start_x, start_y))

        time_msg, rect = FONT_144.render("{}".format(seconds_left), fgcolor=WHITE)
        _, _, time_w, time_h = rect
        start_x = WIDTH // 2 - (time_w // 2)
        start_y = HEIGHT // 2 - (time_h // 2)
        self.display.blit(time_msg, (start_x, start_y))

    def display_pre_game_screen(self, duration, step, step_no, step_count, first=False):
        total_time = duration
        seconds_left = total_time // 1000

        self.display.fill(WELCOME_BGD)

        if first:
            self.show_pre_game_step_info(step_no, step_count, msg=TEXTS["STEP"][LANG])
            self.show_instruction()
            self.show_fingers(step.fingers)
            pygame.display.update()

            channel = pygame.mixer.Sound('resources/sounds/max_{}.wav'.format(LANG)).play()
            while channel.get_busy():
                pygame.time.wait(100)
                pass

        pygame.time.set_timer(STOP_WAIT, total_time, loops=1)
        pygame.time.set_timer(SECOND_PASSED, 1000, loops=total_time // 1000)
        pygame.time.set_timer(
            START_RECORDING, total_time - RECORDING_PADDING, loops=1)
        pygame.time.set_timer(STOP_RECORDING, RECORDING_PADDING, loops=1)
        self.running = True
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

            self.show_fingers(step.fingers)

            self.show_countdown_overlay(seconds_left)

            pygame.display.update()
            self.framePerSec.tick(FPS)

        pygame.mixer.Sound('resources/sounds/beep.wav').play()

    def process_post_game_event(self, event):
        if event.type == QUIT:
            pygame.quit()
            asyncio.run(self.game.end_game())
        if event.type == STOP_RECORDING:
            self.game.rp_connection.deactivate()
        if event.type == STOP_WAIT:
            self.running = False

    def normalize_step_text(self, txt, step_no, step_count):
        remaining = step_count - step_no
        if LANG == "en":
            if remaining == 1:
                txt = txt.replace('steps', 'step')
        elif LANG == 'sk':
            if remaining == 1:
                txt = txt.replace('krokov', 'krok')
            elif 1 < remaining < 5:
                txt = txt.replace('ostáva', 'ostávajú').replace('krokov', 'kroky')

        return txt

    def show_post_game_step_info(self, step_no, step_count):
        pygame.draw.circle(
            self.display, ORANGE,
            (WIDTH // 2, HEIGHT // 2), INIT_CIRCLE_RADIUS
        )

        info_text, rect = FONT_40.render(
            TEXTS["STEP_FINISHED"][LANG].format(step_no, step_count), fgcolor=WHITE)
        _, _, info_w, info_h = rect
        start_x = WIDTH // 2 - (info_w // 2)
        start_y = HEIGHT // 2 - info_h
        self.display.blit(info_text, (start_x, start_y))

        remaining = step_count - step_no
        msg = TEXTS["STEP_REMAINING"][LANG].format(remaining)
        msg = self.normalize_step_text(msg, step_no, step_count)
        side_msg, rect = FONT_20.render(msg, fgcolor=WHITE)
        _, _, remaining_w, remaining_h = rect
        start_x = WIDTH // 2 - (remaining_w // 2)
        start_y = HEIGHT // 2 + remaining_h + (remaining_h // 2)
        self.display.blit(side_msg, (start_x, start_y))

    def display_post_game_screen(self, step, step_no, step_count):
        self.display.fill(WELCOME_BGD)

        total_time = step.padding_end
        pygame.time.set_timer(STOP_RECORDING, RECORDING_PADDING, loops=1)
        pygame.time.set_timer(STOP_WAIT, step.padding_end, loops=1)
        seconds_left = max(1, total_time // 1000)
        pygame.time.set_timer(SECOND_PASSED, 1000, loops=seconds_left)
        self.running = True
        while self.running:
            for event in pygame.event.get():
                self.process_post_game_event(event)
                if event.type == SECOND_PASSED:
                    seconds_left -= 1

            self.display.fill(WELCOME_BGD)

            self.show_post_game_step_info(step_no, step_count)

            pygame.display.update()
            self.framePerSec.tick(FPS)

    def process_pause_event(self, event):
        if event.type == QUIT:
            pygame.quit()
            asyncio.run(self.end_game())
        elif event.type == TIME_UP:
            self.running = False

    def show_pause_step_info(self, step_no, step_count):
        step_msg, rect = FONT_56.render(
            "Step: {}/{}".format(step_no, step_count), fgcolor=BLACK)
        self.display.blit(step_msg, (100, 100))

    def draw_pause_screen(self, duration, step_no, step_count):
        self.running = True
        pygame.time.set_timer(TIME_UP, duration, loops=1)
        while self.running:
            for event in pygame.event.get():
                self.process_pause_event(event)

            self.display.fill(WELCOME_BGD)

            self.show_pause_step_info(step_no, step_count)

            pygame.display.update()
            self.framePerSec.tick(FPS)
