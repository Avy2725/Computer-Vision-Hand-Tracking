# Hand Catcher

A computer-vision game: catch falling balls with your real hand, tracked
live through your webcam using MediaPipe Hands, rendered with Pygame over
an OpenCV camera feed.

## Requirements

- Python 3.9 - 3.11 (MediaPipe's prebuilt wheels don't yet cover every
  newer Python version — if `pip install` fails on mediapipe, try a 3.9-3.11
  virtual environment)
- A working webcam

## Installation

```bash
cd hand_catcher
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## Play in the browser

The webcam game is also deployed on GitHub Pages (allow camera access when prompted):

https://avy2725.github.io/Computer-Vision-Hand-Tracking/catcher.html

## Running the desktop game

```bash
python main.py
```

A window opens showing your mirrored webcam feed. Show your hand to the
camera — a cyan circle marks where the game thinks your "catcher" is.

## Controls

| Key         | Action                                   |
|-------------|-------------------------------------------|
| `SPACE`     | Start the game from the title screen      |
| `P`         | Pause / resume                            |
| `R`         | Restart (from pause or game-over screen)  |
| `H`         | Toggle one-hand / two-hand catcher mode   |
| `Q` / `ESC` | Quit                                      |

## How to play

Colorful balls fall from the top of the screen. Move your hand so the
cyan catcher circle overlaps a ball before it reaches the bottom.

- **Normal balls** — worth 10 points x your combo multiplier.
- **Gold balls ($)** — worth 25 points x combo. Grab these.
- **Red balls (!)** — **avoid them.** Catching one costs a life; letting
  it fall past is free and safe.
- **Cyan power-up (S)** — grants 5 seconds of slow motion.
- **Green power-up (+)** — grants a shield charge that absorbs your next
  missed ball instead of costing a life.

Catch balls back-to-back to build a combo multiplier (every 5 consecutive
catches raises it, up to x5). Missing a normal or gold ball resets your
combo and costs a life (or a shield charge, if you have one). You get a
few seconds of grace at the start of each run before misses count, so you
have time to find your hand on camera.

Ball speed increases continuously over time and jumps again every time you
level up (every 150 x current level points). Higher levels also spawn
balls more frequently, occasionally two at once, and shrink the balls a
little for extra challenge.

## Project structure

```
hand_catcher/
  main.py               Game loop: ties camera, tracking, logic, and rendering together
  requirements.txt
  game/
    config.py            All tunable constants (colors, sizes, difficulty curve, ...)
    hand_tracker.py       Webcam capture + MediaPipe hand detection + smoothing
    entities.py           Ball class: falling motion, appearance, special-type symbols
    game_state.py          Game class: spawning, scoring, difficulty, collisions
    sound.py               Procedurally synthesized sound effects (no audio files needed)
    ui.py                  HUD, start/pause/game-over screens, hand cursor
```

## Hand-tracking & collision logic

1. **Capture** — `hand_tracker.HandTracker` opens the webcam with OpenCV
   and flips each frame horizontally so the feed behaves like a mirror
   (move your hand right, the on-screen hand moves right).
2. **Detection** — the mirrored frame is converted to RGB and passed to
   MediaPipe Hands, which returns up to 2 hands' worth of 21 landmarks
   each, normalized to `[0, 1]` regardless of camera resolution.
3. **Catcher position** — rather than using a single, jittery fingertip,
   the wrist and the four knuckle (MCP) landmarks are averaged into a
   stable "palm center" point.
4. **Smoothing** — that point is passed through an exponential moving
   average (`HAND_SMOOTHING` in `config.py`) frame to frame, which removes
   high-frequency jitter from the raw detector output without adding
   noticeable input lag.
5. **Scaling** — the normalized palm point is multiplied by the game
   window's width/height at render time, so the same logic works no
   matter what resolution the webcam or window actually is.
6. **Collision** — each frame, every falling ball's center is compared to
   every active catcher point with a simple circle-circle distance check:
   a catch happens when `distance(ball, catcher) <= ball.radius +
   catcher.radius`. The catcher radius includes a forgiveness margin
   (`CATCH_RADIUS_BONUS`) so imprecise hand tracking doesn't feel unfair.

If no hand is detected in a frame, the hand list is simply empty for that
frame — balls keep falling and can be missed, but nothing crashes.

## Error handling

- **No webcam / camera in use / permission denied** — `HandTracker` raises
  a clear `HandTrackerError` on startup; the game shows the message on
  screen for a few seconds and exits instead of crashing with a traceback.
- **MediaPipe failing to initialize** — caught the same way as a webcam
  failure.
- **A dropped frame during play** — `read_frame()` returns `None`, and the
  main loop just reuses a blank background for that frame instead of
  throwing.
- **No hand detected** — handled as normal gameplay (see above), not an
  error.
- **Clean shutdown** — the `finally` block in `main.py` always releases
  the camera (`cv2.VideoCapture.release`) and closes MediaPipe/Pygame,
  whether the game exits normally, via a quit key, or because of an
  unexpected exception.

## Future improvement ideas

- Gesture-based menus (e.g. a pinch or open-palm hold to start/pause
  instead of the keyboard).
- Online leaderboard / local high-score file.
- True local multiplayer: split-screen or shared-screen with two players
  each controlled by one hand, competing for the same balls.
- Difficulty presets (Easy/Normal/Hard) exposed on the start screen.
- Replace the procedural tones in `sound.py` with mixed music + SFX
  tracks, and add particle effects on catch/miss.
- AI-generated ball skins/backgrounds for visual variety between runs.
