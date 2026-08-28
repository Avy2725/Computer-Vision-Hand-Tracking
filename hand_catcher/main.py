"""Hand Catcher - entry point and main game loop.

Controls:
    SPACE   Start (from the start screen)
    P       Pause / resume
    R       Restart (from pause or game over)
    H       Toggle two-hand catcher mode
    Q/ESC   Quit
"""

import sys

import cv2
import numpy as np
import pygame

from game import config, ui
from game.game_state import Game, GameStatus
from game.hand_tracker import HandTracker, HandTrackerError
from game.sound import SoundManager


def frame_to_surface(frame_bgr, size):
    """Convert an OpenCV BGR frame into a pygame surface sized for the window."""
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    frame_rgb = cv2.resize(frame_rgb, size)
    # pygame surfaces are (width, height, channels); OpenCV arrays are
    # (rows, cols, channels) i.e. (height, width, channels) - swap the axes.
    return pygame.surfarray.make_surface(np.transpose(frame_rgb, (1, 0, 2)))


def compute_catcher_points(hands, screen_size, two_hand_mode):
    """Map detected hands to on-screen (x, y, hitbox radius) catcher points."""
    width, height = screen_size
    hands_to_use = hands[:2] if two_hand_mode else hands[:1]
    points = []
    for hand in hands_to_use:
        px = hand["x"] * width
        py = hand["y"] * height
        radius = config.BASE_CATCHER_RADIUS + config.CATCH_RADIUS_BONUS
        points.append((px, py, radius))
    return points


def handle_key(key, game):
    """Return False if the game should quit."""
    if key in (pygame.K_q, pygame.K_ESCAPE):
        return False
    if key == pygame.K_SPACE and game.status == GameStatus.START:
        game.start()
    elif key == pygame.K_p:
        game.toggle_pause()
    elif key == pygame.K_r and game.status in (GameStatus.PAUSED, GameStatus.GAME_OVER):
        game.status = GameStatus.START
    elif key == pygame.K_h:
        game.two_hand_mode = not game.two_hand_mode
    return True


def run():
    pygame.init()
    pygame.display.set_caption(config.TITLE)
    screen = pygame.display.set_mode((config.SCREEN_WIDTH, config.SCREEN_HEIGHT))
    clock = pygame.time.Clock()
    fonts = ui.get_fonts()

    try:
        tracker = HandTracker(max_hands=2)
    except HandTrackerError as exc:
        print(f"[Hand Catcher] {exc}")
        ui.draw_fatal_error(screen, fonts, str(exc))
        pygame.display.flip()
        pygame.time.wait(4000)
        pygame.quit()
        sys.exit(1)

    sound = SoundManager()
    game = Game(sound)
    screen_size = (config.SCREEN_WIDTH, config.SCREEN_HEIGHT)

    running = True
    try:
        while running:
            dt = clock.tick(config.FPS) / 1000.0
            dt = min(dt, 0.05)  # clamp so a stalled frame can't jump the simulation

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if not handle_key(event.key, game):
                        running = False

            frame = tracker.read_frame()
            if frame is not None:
                hands = tracker.process(frame)
                screen.blit(frame_to_surface(frame, screen_size), (0, 0))
            else:
                # Webcam hiccup (or no camera): keep running, just show a
                # blank background instead of crashing.
                hands = []
                screen.fill(config.HUD_BG)

            catcher_points = compute_catcher_points(hands, screen_size, game.two_hand_mode)

            if game.status == GameStatus.PLAYING:
                game.update(dt, config.SCREEN_WIDTH, config.SCREEN_HEIGHT, catcher_points)

            for ball in game.balls:
                ball.draw(screen, fonts["ball_symbol"])

            for px, py, radius in catcher_points:
                ui.draw_hand_cursor(screen, px, py, radius)
            if not catcher_points and game.status == GameStatus.PLAYING:
                ui.draw_no_hand_warning(screen, fonts)

            if game.status == GameStatus.START:
                ui.draw_start_screen(screen, fonts)
            elif game.status == GameStatus.PAUSED:
                ui.draw_hud(screen, fonts, game)
                ui.draw_pause_screen(screen, fonts)
            elif game.status == GameStatus.GAME_OVER:
                ui.draw_hud(screen, fonts, game)
                ui.draw_game_over_screen(screen, fonts, game)
            else:
                ui.draw_hud(screen, fonts, game)

            pygame.display.flip()
    finally:
        tracker.close()
        pygame.quit()


if __name__ == "__main__":
    run()
