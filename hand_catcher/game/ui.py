"""HUD, screens, and hand-cursor rendering. No game logic lives here."""

import pygame

from . import config


def get_fonts():
    pygame.font.init()
    return {
        "title": pygame.font.SysFont("arial", 64, bold=True),
        "large": pygame.font.SysFont("arial", 40, bold=True),
        "medium": pygame.font.SysFont("arial", 26, bold=True),
        "small": pygame.font.SysFont("arial", 18, bold=True),
        "ball_symbol": pygame.font.SysFont("arial", 16, bold=True),
    }


def draw_text(surface, font, text, color, pos, center=False):
    """Render text with a dark drop-shadow so it stays readable over video."""
    shadow = font.render(text, True, config.BLACK)
    label = font.render(text, True, color)
    rect = label.get_rect()
    if center:
        rect.center = pos
    else:
        rect.topleft = pos
    surface.blit(shadow, (rect.x + 2, rect.y + 2))
    surface.blit(label, rect)
    return rect


def draw_hud(surface, fonts, game):
    draw_text(surface, fonts["medium"], f"Score: {game.score}", config.WHITE, (16, 12))

    lives_rect = draw_text(surface, fonts["medium"], "Lives:", config.WHITE, (16, 44))
    dot_y = lives_rect.centery
    dot_x = lives_rect.right + 14
    for i in range(max(game.lives, 0)):
        pygame.draw.circle(surface, config.RED, (dot_x + i * 24, dot_y), 9)

    draw_text(surface, fonts["medium"], f"Level: {game.level}", config.CYAN, (16, 76))
    draw_text(
        surface, fonts["small"], f"Ball Speed: {game.speed_multiplier:.2f}x",
        config.ORANGE, (16, 110),
    )

    next_line_y = 134
    if game.combo_multiplier > 1:
        draw_text(
            surface, fonts["small"], f"Combo x{game.combo_multiplier}!",
            config.YELLOW, (16, next_line_y),
        )
        next_line_y += 24
    if game.shield_charges > 0:
        draw_text(
            surface, fonts["small"], f"Shield x{game.shield_charges}",
            config.GREEN, (16, next_line_y),
        )
        next_line_y += 24
    if game.slowmo_timer > 0:
        draw_text(
            surface, fonts["small"], f"Slow-Mo {game.slowmo_timer:.1f}s",
            config.CYAN, (16, next_line_y),
        )

    if game.two_hand_mode:
        label_width, _ = fonts["small"].size("Two-Hand Mode")
        draw_text(
            surface, fonts["small"], "Two-Hand Mode",
            config.PURPLE, (surface.get_width() - 16 - label_width, 12),
        )

    if game.in_grace_period:
        remaining = config.GRACE_PERIOD_SECONDS - game.elapsed_time
        draw_text(
            surface, fonts["large"], f"Get Ready: {remaining:.1f}",
            config.WHITE, (surface.get_width() // 2, 50), center=True,
        )


def draw_hand_cursor(surface, x, y, radius, color=config.CYAN):
    pygame.draw.circle(surface, color, (int(x), int(y)), int(radius), width=3)
    pygame.draw.circle(surface, config.WHITE, (int(x), int(y)), 4)


def draw_no_hand_warning(surface, fonts):
    draw_text(
        surface, fonts["small"], "No hand detected - show your hand to the camera",
        config.RED, (surface.get_width() // 2, surface.get_height() - 24), center=True,
    )


def _dim_overlay(surface, alpha):
    w, h = surface.get_size()
    overlay = pygame.Surface((w, h), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, alpha))
    surface.blit(overlay, (0, 0))


def draw_start_screen(surface, fonts):
    w, h = surface.get_size()
    _dim_overlay(surface, 150)

    draw_text(surface, fonts["title"], config.TITLE, config.YELLOW, (w // 2, h // 2 - 110), center=True)
    draw_text(
        surface, fonts["medium"], "Move your hand under the falling balls to catch them",
        config.WHITE, (w // 2, h // 2 - 40), center=True,
    )
    draw_text(
        surface, fonts["medium"], "Avoid red balls   |   Grab gold for bonus points",
        config.WHITE, (w // 2, h // 2 - 5), center=True,
    )
    draw_text(surface, fonts["large"], "Press SPACE to Start", config.GREEN, (w // 2, h // 2 + 60), center=True)
    draw_text(
        surface, fonts["small"], "H: toggle two-hand mode   P: pause   Q / ESC: quit",
        config.WHITE, (w // 2, h // 2 + 105), center=True,
    )


def draw_pause_screen(surface, fonts):
    w, h = surface.get_size()
    _dim_overlay(surface, 170)
    draw_text(surface, fonts["title"], "Paused", config.WHITE, (w // 2, h // 2 - 40), center=True)
    draw_text(
        surface, fonts["medium"], "P: resume   R: restart   Q / ESC: quit",
        config.WHITE, (w // 2, h // 2 + 30), center=True,
    )


def draw_game_over_screen(surface, fonts, game):
    w, h = surface.get_size()
    _dim_overlay(surface, 190)
    draw_text(surface, fonts["title"], "Game Over", config.RED, (w // 2, h // 2 - 95), center=True)
    draw_text(
        surface, fonts["large"], f"Final Score: {game.score}", config.WHITE,
        (w // 2, h // 2 - 25), center=True,
    )
    draw_text(
        surface, fonts["medium"], f"Level Reached: {game.level}", config.CYAN,
        (w // 2, h // 2 + 20), center=True,
    )
    draw_text(surface, fonts["large"], "Press R to Restart", config.GREEN, (w // 2, h // 2 + 80), center=True)
    draw_text(surface, fonts["small"], "Press Q / ESC to Quit", config.WHITE, (w // 2, h // 2 + 120), center=True)


def draw_fatal_error(surface, fonts, message):
    surface.fill(config.HUD_BG)
    w, h = surface.get_size()
    draw_text(
        surface, fonts["medium"], "Hand Catcher could not start:", config.RED,
        (w // 2, h // 2 - 40), center=True,
    )
    draw_text(surface, fonts["small"], message, config.WHITE, (w // 2, h // 2 + 10), center=True)
