import os

import pygame


os.environ['SDL_VIDEO_CENTERED'] = '1'
pygame.init()

info = pygame.display.Info()
WIDTH = info.current_w
HEIGHT = info.current_h

scale = HEIGHT / 1024
# WIDTH = 1440
# HEIGHT = 1024
# WIDTH = 1280
# HEIGHT = 720
# WIDTH = 640
# HEIGHT = 480
FPS = 60

# colors
BLUE = (0, 0, 255)
RED = (255, 0, 0)
RGB_GREEN = (0, 255, 0)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

WELCOME_BGD = (236, 242, 244)
FONT_144 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(144 * scale))
FONT_72 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(72 * scale))
FONT_56 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(56 * scale))
FONT_48 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(48 * scale))
FONT_40 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(40 * scale))
FONT_36 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(36 * scale))
FONT_32 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(32 * scale))
FONT_20 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(20 * scale))
FONT_16 = pygame.freetype.Font("resources/Graphik-Regular.ttf", size=int(16 * scale))

COL_COLOR = pygame.Color(130, 255, 130)
FADED_COL_COLOR = pygame.Color(190, 255, 130)
BALL_COLOR = pygame.Color(255, 150, 100)
GAME_BGD = pygame.Color(75, 75, 75)

BRIGHT_ORANGE = pygame.Color(255, 194, 176)
ORANGE = pygame.Color(255, 91, 45)
BRIGHT_GREEN = pygame.Color(111, 234, 163)
GREEN = pygame.Color(39, 174, 125)
GREY = pygame.Color(98, 107, 109)
GREY2 = pygame.Color(217, 225, 228)
GREY3 = pygame.Color(236, 242, 244)
LIGHT_GREY = pygame.Color(188, 199, 203)
LIGHTEST_GREY = pygame.Color(244, 248, 249)

INIT_CIRCLE_RADIUS = int(0.31 * WIDTH) // 2
INIT_TEXT_GAP = 24

INSTRUCTION_HAND_GAP = 0.03
INSTRUCTION_TOP_PADDING = 0.075
INSTRUCTION_LEFT_PADDING = 0.04
INSTRUCTION_RIGHT_PADDING = 0.05

GAME_HAND_GAP = 0.075
GAME_RECT_GAP = 0.05
COL_RECT_W = 378
COL_RECT_H = 384
COL_RECT_V_PADDING = 0.24
COL_W = 66
COL_H_PADDING = (COL_RECT_W - 5 * COL_W) // 6
COL_V_PADDING = COL_H_PADDING

RECORDING_PADDING = 500
SENSOR_COUNT = 10
FINGER_POSITIONS = [0, 1, 2, 3, 4, 12, 11, 10, 9, 8]
FINGER_NAMES = [
    "left little finger",
    "left ring finger",
    "left middle finger",
    "left index finger",
    "left thumb",
    "right thumb",
    "right index finger",
    "right middle finger",
    "right ring finger",
    "right little finger"
]
FINGER_OFFSETS_SMALL = [
    (4, 60),
    (60, 18),
    (115, 4),
    (172, 30),
    (227, 147)
]
FINGER_OFFSETS_BIG = [
    (8, 78),
    (81, 23),
    (155, 4),
    (229, 40),
    (302, 192)
]
SMALL_CIRCLE_RADIUS = 18
BIG_CIRCLE_RADIUS = 20

# PRE_GAME_SCREEN
PRE_GAME_PADDING = 0.1

# MAX_FORCE_VISUALIZATION
MAX_FORCE_PADDING = 0.2
MAX_FORCE_COL_GAP_RATIO = 3
COL_HEIGHT = 0.5 * HEIGHT

# RHYTHM_VISUALIZATION
RH_CIRCLE_SMALL_RADIUS = 44
RH_CIRCLE_MAX_RADIUS = 104
RH_CIRCLE_TOP_PADDING = 0.36
RH_TIME_LIMIT = 0.7
RH_THRESHOLD = 0.2

# REACTION VISUALIZATION
RE_FORCE_PADDING = 0.2
RE_FORCE_COL_GAP_RATIO = 3
RE_COL_HEIGHT = 0.5 * HEIGHT
RE_CIRCLE_SMALL_RADIUS = 44
RE_CIRCLE_MAX_RADIUS = 104
RE_THRESHOLD = 0.2
RE_BALL_RADIUS = 13
