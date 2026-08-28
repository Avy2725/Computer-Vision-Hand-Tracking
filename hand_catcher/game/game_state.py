"""Core game state: spawning, scoring, difficulty, and collision detection."""

import random

from . import config
from .entities import Ball, BallType


class GameStatus:
    START = "start"
    PLAYING = "playing"
    PAUSED = "paused"
    GAME_OVER = "game_over"


class Game:
    """Owns all gameplay state. Rendering and input live outside this class."""

    def __init__(self, sound_manager):
        self.sound = sound_manager
        self.reset()

    def reset(self):
        self.status = GameStatus.START
        self.score = 0
        self.lives = config.STARTING_LIVES
        self.level = 1
        self.combo = 0
        self.combo_multiplier = 1
        self.balls = []
        self.elapsed_time = 0.0
        self.time_since_spawn = 0.0
        self.shield_charges = 0
        self.slowmo_timer = 0.0
        self.two_hand_mode = False

    def start(self):
        two_hand_mode = self.two_hand_mode
        self.reset()
        self.two_hand_mode = two_hand_mode
        self.status = GameStatus.PLAYING

    def toggle_pause(self):
        if self.status == GameStatus.PLAYING:
            self.status = GameStatus.PAUSED
        elif self.status == GameStatus.PAUSED:
            self.status = GameStatus.PLAYING

    @property
    def in_grace_period(self):
        return self.elapsed_time < config.GRACE_PERIOD_SECONDS

    @property
    def speed_multiplier(self):
        time_bonus = self.elapsed_time * (config.SPEED_INCREASE_PER_SEC / config.BASE_BALL_SPEED)
        level_bonus = (self.level - 1) * (config.SPEED_INCREASE_PER_LEVEL / config.BASE_BALL_SPEED)
        mult = 1.0 + time_bonus + level_bonus
        if self.slowmo_timer > 0:
            mult *= config.SLOWMO_FACTOR
        return mult

    @property
    def spawn_interval(self):
        interval = (
            config.BASE_SPAWN_INTERVAL
            - (self.level - 1) * config.SPAWN_INTERVAL_DECAY_PER_LEVEL
        )
        return max(config.MIN_SPAWN_INTERVAL, interval)

    def update(self, dt, screen_width, screen_height, catcher_points):
        if self.status != GameStatus.PLAYING:
            return

        self.elapsed_time += dt
        if self.slowmo_timer > 0:
            self.slowmo_timer = max(0.0, self.slowmo_timer - dt)

        if not self.in_grace_period:
            self.time_since_spawn += dt
            if self.time_since_spawn >= self.spawn_interval:
                self.time_since_spawn = 0.0
                self._spawn_ball(screen_width)
                # More chaos at higher levels: sometimes spawn a second ball.
                if self.level >= 4 and random.random() < 0.35:
                    self._spawn_ball(screen_width)

        speed_mult = self.speed_multiplier
        surviving = []
        for ball in self.balls:
            ball.update(dt, speed_mult)
            if self._check_catch(ball, catcher_points):
                continue
            if ball.is_off_screen(screen_height):
                self._handle_miss(ball)
                continue
            surviving.append(ball)
        self.balls = surviving

        if self.score >= self.level * config.SCORE_PER_LEVEL:
            self.level += 1
            self.sound.play("levelup")

        if self.lives <= 0:
            self.lives = 0
            self.status = GameStatus.GAME_OVER
            self.sound.play("gameover")

    def _spawn_ball(self, screen_width):
        min_r, max_r = config.BALL_RADIUS_RANGE
        shrink = min(max_r - config.BALL_RADIUS_MIN_FLOOR, (self.level - 1) * config.BALL_RADIUS_SHRINK_PER_LEVEL)
        radius = random.randint(min_r, max(min_r, int(max_r - shrink)))
        x = random.randint(radius, max(radius, screen_width - radius))
        speed = config.BASE_BALL_SPEED * random.uniform(0.85, 1.2)

        roll = random.random()
        red_cut = config.RED_BALL_CHANCE
        gold_cut = red_cut + config.GOLDEN_BALL_CHANCE
        power_cut = gold_cut + config.POWERUP_BALL_CHANCE

        if roll < red_cut:
            ball_type = BallType.RED
        elif roll < gold_cut:
            ball_type = BallType.GOLDEN
        elif roll < power_cut:
            ball_type = random.choice([BallType.POWERUP_SLOW, BallType.POWERUP_SHIELD])
        else:
            ball_type = BallType.NORMAL

        self.balls.append(Ball(x, -radius, radius, speed, ball_type))

    def _check_catch(self, ball, catcher_points):
        for cx, cy, catcher_radius in catcher_points:
            dist_sq = (ball.x - cx) ** 2 + (ball.y - cy) ** 2
            if dist_sq <= (ball.radius + catcher_radius) ** 2:
                self._handle_catch(ball)
                return True
        return False

    def _handle_catch(self, ball):
        if ball.type == BallType.RED:
            # Catching a red ball is the bad outcome - it costs a life.
            self.lives -= 1
            self.combo = 0
            self.combo_multiplier = 1
            self.sound.play("red")
            return

        if ball.type == BallType.GOLDEN:
            points = config.GOLDEN_BALL_POINTS
            self.sound.play("golden")
        elif ball.type == BallType.POWERUP_SLOW:
            self.slowmo_timer = config.SLOWMO_DURATION
            points = config.NORMAL_BALL_POINTS
            self.sound.play("powerup")
        elif ball.type == BallType.POWERUP_SHIELD:
            self.shield_charges += 1
            points = config.NORMAL_BALL_POINTS
            self.sound.play("powerup")
        else:
            points = config.NORMAL_BALL_POINTS
            self.sound.play("catch")

        self.combo += 1
        self.combo_multiplier = min(
            config.MAX_COMBO_MULTIPLIER, 1 + self.combo // config.COMBO_STEP
        )
        self.score += points * self.combo_multiplier

    def _handle_miss(self, ball):
        if ball.type == BallType.RED:
            return  # letting a dangerous ball fall past is the correct play
        if ball.type in (BallType.POWERUP_SLOW, BallType.POWERUP_SHIELD):
            return  # missing a power-up just forfeits the bonus, no penalty

        self.combo = 0
        self.combo_multiplier = 1
        if self.shield_charges > 0:
            self.shield_charges -= 1
        else:
            self.lives -= 1
        self.sound.play("miss")
