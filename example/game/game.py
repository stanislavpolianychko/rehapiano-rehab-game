import datetime
import json
import logging
import os
import sys
import threading

import asyncio
import pygame
from pygame.locals import *
from pygame._sdl2 import Window

from app_config import LANG
from communicator import SocketConnection
from rp_communicator import RehaPianoConnection
from message_handler import MessageHandler
from pygame_config import *
from pygame_events import *
from texts import *
from maxforce import MaxForceGame
from reaction import ReactionGame
from rhythm import RhythmGame


import nest_asyncio
nest_asyncio.apply()


class Game:
    def __init__(self, ws_target, rp_target):
        pygame.init()
        self.font = pygame.font.SysFont('Arial', 16)

        # info = pygame.display.Info() # You have to call this before pygame.display.set_mode()
        # screen_width,screen_height = info.current_w,info.current_h
        self.display = pygame.display.set_mode((WIDTH, HEIGHT))
        # Window.from_display_module().maximize()
        pygame.display.set_caption("Rehapiano game")
        self.display.fill(WHITE)

        self.framePerSec = pygame.time.Clock()  # moved to scenario

        self.institution_id = None
        self.institution_name = ""
        self.device_code = ""
        self.tenso_data = None
        self.gains = [1.0] * 16
        self.state = ""

        self.waiting_game_start = True
        self.active_window = self.draw_welcome_screen
        self.gui_thread = None
        self.waiting = True
        self.running = True

        self.examination = None
        self.buffer = list()
        self.visualization_data = list()

        self.ws_thread = None
        self.ws_send_thread = None
        self.ws_target = ws_target

        # self.queue = Queue(maxsize=0)
        self.rp_queue = None
        self.rp_target = rp_target

        self.connection = None
        self.handler = MessageHandler(self)
        self.rp_connection = None

        self.game_loop = asyncio.new_event_loop()
        self.just_started = True

    async def start_game(self):
        self.connection = SocketConnection(self.ws_target)
        self.ws_thread = threading.Thread(target=self.connection.listen)
        self.ws_send_thread = threading.Thread(target=self.connection.send)

        self.rp_connection = RehaPianoConnection(self.rp_target)
        self.rp_thread = threading.Thread(target=self.rp_connection.listen)

        self.rp_thread.start()
        self.ws_thread.start()
        self.ws_send_thread.start()

    def set_device_code(self, device_code):
        self.device_code = device_code

    def set_tenso_data(self, tenso_json):
        self.tenso_data = tenso_json
        for tenso_elem in self.tenso_data:
            self.gains[tenso_elem["code"]] = tenso_elem["gain"]

    def update_institution(self, institution_id, institution_name):
        self.institution_id = institution_id
        self.institution_name = institution_name

        pygame.event.post(
            pygame.event.Event(INIT_EVENT, message="show init screen"))

    def add_languages(self):
        en_lang, en_rect = FONT_20.render("EN", fgcolor=ORANGE if LANG == 'en' else GREY)
        en_w = en_rect[2]

        sk_lang, sk_rect = FONT_20.render("SK", fgcolor=ORANGE if LANG == 'sk' else GREY)
        sk_w = sk_rect[2]

        en_x = int(WIDTH * 0.9) - en_w
        sk_x = en_x - 20 - sk_w

        self.display.blit(en_lang, (en_x, 50))
        self.display.blit(sk_lang, (sk_x, 50))

        self.en_box = en_lang.get_rect(topleft=(en_x, 50))
        self.sk_box = sk_lang.get_rect(topleft=(sk_x, 50))

    def draw_welcome_screen(self):
        global LANG
        # self.rp_connection.activate()
        running = True
        while running:
            for event in pygame.event.get():
                # print('checking event:', event)
                if event.type == QUIT:
                    pygame.quit()
                    asyncio.run(self.end_game())
                if event.type == MAX_GAME_EVENT:
                    running = False
                if event.type == pygame.MOUSEBUTTONDOWN:
                    if event.button == 1:
                        adjusted_pos = (event.pos[0], event.pos[1])
                        if self.en_box.collidepoint(adjusted_pos):
                            logging.info('Language changed to EN')
                            LANG = 'en'
                        elif self.sk_box.collidepoint(adjusted_pos):
                            logging.info('Language changed to SK')
                            LANG = 'sk'

            self.display.fill(WELCOME_BGD)

            self.add_languages()

            pygame.draw.circle(
                self.display, ORANGE,
                (WIDTH // 2, HEIGHT // 2), INIT_CIRCLE_RADIUS
            )

            main_msg, rect = FONT_56.render(TEXTS["INIT_MAIN"][LANG], fgcolor=WHITE)
            _, _, welcome_width, welcome_height = rect
            start_x = WIDTH // 2 - (welcome_width // 2)
            start_y = HEIGHT // 2 - welcome_height
            self.display.blit(main_msg, (start_x, start_y))

            side_msg, rect = FONT_20.render(TEXTS["INIT_SIDE"][LANG], fgcolor=WHITE)
            _, _, welcome_s_width, welcome_s_height = rect
            start_x = WIDTH // 2 - (welcome_s_width // 2)
            start_y = HEIGHT // 2 + welcome_s_height + (welcome_s_height // 2)
            self.display.blit(side_msg, (start_x, start_y))

            code_text = TEXTS["DEV_CODE"][LANG] + self.device_code
            code_msg, rect = FONT_16.render(code_text, fgcolor=GREY)
            _, _, code_w, code_h = rect

            reg_text = TEXTS["DEV_REG"][LANG] + self.institution_name
            reg_msg, rect = FONT_16.render(reg_text, fgcolor=GREY)
            _, _, reg_w, reg_h = rect

            total_w = code_w + INIT_TEXT_GAP + reg_w
            start_x = WIDTH // 2 - (total_w // 2)
            start_y = int(HEIGHT * 0.9375)

            self.display.blit(code_msg, (start_x, start_y))
            self.display.blit(reg_msg, (start_x + code_w + INIT_TEXT_GAP, start_y))

            if self.just_started:
                pygame.display.update()

            if self.just_started:
                channel = pygame.mixer.Sound('resources/sounds/intro_{}.wav'.format(LANG)).play()
                # pygame.time.wait(6000)
                while channel.get_busy():
                    pygame.time.wait(100)
                self.just_started = False

            if not self.connection.connection:
                self.add_network_error_overlay()
            elif not self.rp_connection.connection:
                self.add_rp_error_overlay()
            else:
                self.rp_connection.check_hands_connection()
                if not self.rp_connection.l_connect or not self.rp_connection.r_connect:
                    self.add_hand_disconnected_overlay()

            pygame.display.update()

            self.framePerSec.tick(FPS)

        pygame.event.post(
            pygame.event.Event(END_INIT_EVENT, message="Init ended"))

    def add_network_error_overlay(self):
        game_over_screen_fade = pygame.Surface((WIDTH, HEIGHT))
        game_over_screen_fade.fill((0, 0, 0))
        game_over_screen_fade.set_alpha(160)
        self.display.blit(game_over_screen_fade, (0, 0))

        conn_err, rect = FONT_56.render(TEXTS["NET_ERROR"][LANG], fgcolor=WHITE)
        _, _, welcome_width, welcome_height = rect
        start_x = WIDTH // 2 - (welcome_width // 2)
        start_y = HEIGHT // 2 - welcome_height * 3
        self.display.blit(conn_err, (start_x, start_y))

        net_inst, rect = FONT_40.render(TEXTS["NET_INST"][LANG], fgcolor=WHITE)
        _, _, welcome_s_width, welcome_s_height = rect
        start_x = WIDTH // 2 - (welcome_s_width // 2)
        start_y = HEIGHT // 2 + welcome_s_height * 3
        self.display.blit(net_inst, (start_x, start_y))

    def add_rp_error_overlay(self):
        game_over_screen_fade = pygame.Surface((WIDTH, HEIGHT))
        game_over_screen_fade.fill((0, 0, 0))
        game_over_screen_fade.set_alpha(160)
        self.display.blit(game_over_screen_fade, (0, 0))

        conn_err, rect = FONT_56.render(TEXTS["DEV_ERROR"][LANG], fgcolor=WHITE)
        _, _, welcome_width, welcome_height = rect
        start_x = WIDTH // 2 - (welcome_width // 2)
        start_y = HEIGHT // 2 - welcome_height * 3
        self.display.blit(conn_err, (start_x, start_y))

        net_inst, rect = FONT_40.render(TEXTS["DEV_INST"][LANG], fgcolor=WHITE)
        _, _, welcome_s_width, welcome_s_height = rect
        start_x = WIDTH // 2 - (welcome_s_width // 2)
        start_y = HEIGHT // 2 + welcome_s_height * 3
        self.display.blit(net_inst, (start_x, start_y))

    def add_hand_disconnected_overlay(self):
        game_over_screen_fade = pygame.Surface((WIDTH, HEIGHT))
        game_over_screen_fade.fill((0, 0, 0))
        game_over_screen_fade.set_alpha(160)
        self.display.blit(game_over_screen_fade, (0, 0))

        conn_err, rect = FONT_56.render(TEXTS["DEV_DISC"][LANG], fgcolor=WHITE)
        _, _, welcome_width, welcome_height = rect
        start_x = WIDTH // 2 - (welcome_width // 2)
        start_y = welcome_height * 2
        self.display.blit(conn_err, (start_x, start_y))

        # TODO: add hands
        l_hand = pygame.image.load("resources/hand_left_big_transp.png").convert_alpha()
        l_hand_w, l_hand_h = l_hand.get_size()
        l_image_x = WIDTH // 2 - int(WIDTH * INSTRUCTION_HAND_GAP) // 2 - l_hand_w
        l_image_y = HEIGHT // 2 - l_hand_h // 2
        self.display.blit(l_hand, (l_image_x, l_image_y))

        r_hand = pygame.image.load("resources/hand_right_big_transp.png").convert_alpha()
        r_hand_w, r_hand_h = r_hand.get_size()
        r_image_x = WIDTH // 2 + int(WIDTH * INSTRUCTION_HAND_GAP) // 2
        r_image_y = HEIGHT // 2 - r_hand_h // 2
        self.display.blit(r_hand, (r_image_x, r_image_y))

        # TODO: add circles
        c_rad = l_hand_w // 4
        l_c_x = l_image_x + l_hand_w // 2
        r_c_x = r_image_x + r_hand_w // 2
        c_y = l_image_y + l_hand_h + 2 * c_rad

        l_color = GREEN if self.rp_connection.l_connect else RED
        r_color = GREEN if self.rp_connection.r_connect else RED
        pygame.draw.circle(self.display, l_color, (l_c_x, c_y), c_rad)
        pygame.draw.circle(self.display, r_color, (r_c_x, c_y), c_rad)

    def gui_logic(self):
        updates = 1
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == QUIT:
                    running = False
                    pygame.quit()
                    asyncio.run(self.end_game())
                if event.type == INIT_EVENT:
                    self.active_window = self.draw_welcome_screen
                if event.type in [MAX_GAME_EVENT, END_INIT_EVENT]:
                    self.active_window = self.simulate_game

            if self.active_window:
                self.active_window()
            # logging.info("updating in game logic", updates)
            updates += 1

    def game_gui(self):
        asyncio.set_event_loop(self.game_loop)

        self.game_task = self.game_loop.create_task(self.gui_logic())
        self.game_loop.run_until_complete(self.game_task)

    def add_examination(self, examination):
        self.examination = examination
        logging.info("Game received examination with id {}".format(self.examination.exam_id))

        if self.connection.connection is None or self.rp_connection.connection is None:
            return
           
        if self.rp_connection.l_connect is False or self.rp_connection.r_connect is False:
            # examination gets ignored
            return

        if self.connection:
            try:
                # asyncio.get_event_loop().run_until_complete(
                #     self.connection.send_start_confirmation(
                #         self.examination.exam_id
                #     )
                # )
                socket = self.connection.get_start_confirmation(
                    self.examination.exam_id)
                self.connection.send_queue.put(json.dumps(socket))
            except Exception as e:
                logging.debug("Error when sending examination start: {}".format(e))
                asyncio.get_event_loop().run_until_complete(
                    self.connection.close_stream()
                )

        pygame.event.post(
            pygame.event.Event(MAX_GAME_EVENT, message="Start max game"))

    def find_step_data(self, step_id):
        for exam_id, b_step_id, additionl, raw_data in self.buffer:
            if b_step_id == step_id:
                return raw_data

    def get_step_data(self, exam_id, step_ids):
        # if not self.examination:
        #     return list()

        # if self.examination.exam_id != exam_id:
        #     return list()

        result = list()
        for step_id in step_ids:
            logging.info("Searching for step {}".format(step_id))
            step_data = self.find_step_data(step_id)
            result.append((step_id, step_data))

        for step_id, np_data in result:
            try:
                # asyncio.get_event_loop().run_until_complete(
                #     self.connection.send_step_result(
                #         exam_id, step_id, dict(), np_data
                #     )
                # )
                socket = self.connection.get_step_result(
                    exam_id, step_id, dict(), np_data)
                logging.info("Sending data for step {}".format(step_id))
                self.connection.send_queue.put(json.dumps(socket))
            except Exception as e:
                logging.debug("Error when sending step info: {}".format(e))
                asyncio.get_event_loop().run_until_complete(
                    self.connection.close_stream()
                )

        try:
            socket = self.connection.get_end_confirmation(exam_id)
            self.connection.send_queue.put(json.dumps(socket))
        except Exception as e:
            logging.debug("Error when sending end confirmation: {}".format(e))
            asyncio.get_event_loop().run_until_complete(
                self.connection.close_stream()
            )

    def simulate_game(self):
        if not self.examination:
            return

        if not self.rp_connection.connection:
            return

        # self.buffer.clear()
        exam_id = self.examination.exam_id
        step_count = len(self.examination.scenario.steps)
        for step_no, step in enumerate(self.examination.scenario.steps, start=1):
            self.rp_connection.rp_queue.clear()
            print("RP queue cleared")
            self.rp_connection.rp_queue.append((datetime.datetime.now(), [0.0] * 16))
            self.visualization_data.clear()

            game = None
            if step.step_type == "MAX_FORCE":
                game = MaxForceGame(self, self.display)
            elif step.step_type == "REACTION":
                game = ReactionGame(self, self.display)
            elif step.step_type == "RHYTHM":
                game = RhythmGame(self, self.display)
            else:
                raise ValueError("Unknown game type {}".format(step.step_type))

            raw_data, additional = game.run(step, step_no, step_count)

            # for iteration in raw_data:
            #     print(iteration.shape)

            if self.connection:
                try:
                    # asyncio.get_event_loop().run_until_complete(
                    #     self.connection.send_step_result(
                    #         exam_id,
                    #         step.step_id,
                    #         dict(),
                    #         raw_data
                    #     )
                    # )
                    socket = self.connection.get_step_result(
                        exam_id, step.step_id, additional, raw_data)
                    self.connection.send_queue.put(json.dumps(socket))
                except Exception as e:
                    logging.debug("Error when sending step result: {}".format(e))
                    asyncio.get_event_loop().run_until_complete(
                        self.connection.close_stream()
                    )

            self.buffer.append((exam_id, step.step_id, additional, raw_data))

        if self.connection:
            try:
                # asyncio.get_event_loop().run_until_complete(
                #     self.connection.send_end_confirmation(exam_id)
                # )
                socket = self.connection.get_end_confirmation(exam_id)
                self.connection.send_queue.put(json.dumps(socket))
            except Exception as e:
                logging.debug("Error when sending end confirmation: {}".format(e))
                asyncio.get_event_loop().run_until_complete(
                    self.connection.close_stream()
                )

        self.rp_connection.activate()
        pygame.event.post(
            pygame.event.Event(INIT_EVENT, message="show init"))

    async def end_game(self):
        if self.ws_thread:
            self.ws_thread.join()
        if self.connection:
            await self.connection.close_stream()
        pygame.quit()
        sys.exit()

    async def game_logic(self):
        self.gui_thread = threading.Thread(target=self.game_gui)
        self.gui_thread.start()

        while True:
            msg = self.connection.queue.get(block=True)
            logging.info("Game loaded message: {}".format(msg))

            if msg:
                socket = json.loads(msg)
                self.handler.handle_socket(socket)
