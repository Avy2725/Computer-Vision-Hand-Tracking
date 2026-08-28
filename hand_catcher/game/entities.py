"""Falling game objects and their visual/gameplay behavior."""

import math
import random

import pygame

from . import config


class BallType:
    NORMAL = "normal"
    GOLDEN = "golden"
    RED = "red"
    POWERUP_SLOW = "powerup_slow"
    POWERUP_SHIELD = "powerup_shield"


TYPE_COLORS = {
    BallType.GOLDEN: config.GOLD,
    BallType.RED: config.RED,
    BallType.POWERUP_SLOW: config.CYAN,
    BallType.POWERUP_SHIELD: config.GREEN,
}

TYPE_SYMBOLS = {
    BallType.GOLDEN: "$",
    BallType.RED: "!",
    BallType.POWERUP_SLOW: "S",
    BallType.POWERUP_SHIELD: "+",
}


class Ball:
    def __init__(self, x, y, radius, speed, ball_type=BallType.NORMAL):
        self.x = x
        self.y = y
        self.radius = radius
        self.speed = speed
        self.type = ball_type
        self.color = TYPE_COLORS.get(ball_type) or random.choice(config.BALL_COLORS)
        self._pulse = random.uniform(0, math.tau)

    def update(self, dt, speed_multiplier):
        self.y += self.speed * speed_multiplier * dt
        self._pulse += dt * 4

    def is_off_screen(self, screen_height):
        return self.y - self.radius > screen_height

    def draw(self, surface, symbol_font):
        # Special balls get a soft pulsing ring so they read clearly over
        # the busy webcam background.
        if self.type != BallType.NORMAL:
            glow = 4 + int(2 * math.sin(self._pulse))
            pygame.draw.circle(
                surface, self.color, (int(self.x), int(self.y)),
                int(self.radius + glow), width=3,
            )

        pygame.draw.circle(surface, self.color, (int(self.x), int(self.y)), int(self.radius))
        pygame.draw.circle(
            surface, config.WHITE, (int(self.x), int(self.y)), int(self.radius), width=2
        )

        symbol = TYPE_SYMBOLS.get(self.type)
        if symbol:
            label = symbol_font.render(symbol, True, config.BLACK)
            rect = label.get_rect(center=(int(self.x), int(self.y)))
            surface.blit(label, rect)
