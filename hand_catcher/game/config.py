"""Global configuration constants for Hand Catcher."""

# --- Display ---
SCREEN_WIDTH = 960
SCREEN_HEIGHT = 720
FPS = 30
TITLE = "Hand Catcher"

# --- Camera ---
CAMERA_INDEX = 0

# --- Colors (R, G, B) ---
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
YELLOW = (255, 215, 0)
GOLD = (255, 200, 0)
RED = (255, 60, 60)
GREEN = (60, 220, 120)
BLUE = (80, 160, 255)
CYAN = (0, 230, 230)
PURPLE = (190, 90, 255)
ORANGE = (255, 140, 40)
HUD_BG = (5, 7, 13)

BALL_COLORS = [
    (255, 90, 90),
    (90, 200, 255),
    (120, 255, 120),
    (255, 190, 80),
    (220, 120, 255),
    (255, 230, 90),
]

# --- Gameplay ---
STARTING_LIVES = 3
GRACE_PERIOD_SECONDS = 3.0
BASE_CATCHER_RADIUS = 34
CATCH_RADIUS_BONUS = 18  # extra forgiveness added to the catcher hitbox
COMBO_STEP = 5  # consecutive catches needed to bump the multiplier
MAX_COMBO_MULTIPLIER = 5
SCORE_PER_LEVEL = 150

BASE_BALL_SPEED = 140.0  # px/sec
SPEED_INCREASE_PER_SEC = 2.2  # global speed ramps up over play time
SPEED_INCREASE_PER_LEVEL = 25.0

BASE_SPAWN_INTERVAL = 1.3  # seconds between spawns at level 1
MIN_SPAWN_INTERVAL = 0.35
SPAWN_INTERVAL_DECAY_PER_LEVEL = 0.11

BALL_RADIUS_RANGE = (18, 34)
BALL_RADIUS_SHRINK_PER_LEVEL = 1.5
BALL_RADIUS_MIN_FLOOR = 14

GOLDEN_BALL_CHANCE = 0.12
RED_BALL_CHANCE = 0.14
POWERUP_BALL_CHANCE = 0.08

GOLDEN_BALL_POINTS = 25
NORMAL_BALL_POINTS = 10

SLOWMO_DURATION = 5.0
SLOWMO_FACTOR = 0.45

HAND_SMOOTHING = 0.35  # EMA factor: higher = snappier, lower = smoother
