"""Procedurally synthesized sound effects.

Generating tones with numpy avoids shipping/loading external audio assets,
per the "avoid unnecessary external dependencies" requirement.
"""

import numpy as np
import pygame

SAMPLE_RATE = 44100


def _tone(freq, duration, volume=0.5, waveform="sine"):
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    if waveform == "square":
        wave = np.sign(np.sin(freq * 2 * np.pi * t))
    else:
        wave = np.sin(freq * 2 * np.pi * t)

    envelope = np.linspace(1.0, 0.0, wave.size) ** 1.5
    wave = wave * envelope * volume

    samples = (wave * 32767).astype(np.int16)
    stereo = np.column_stack((samples, samples))
    return pygame.sndarray.make_sound(np.ascontiguousarray(stereo))


def _chime(freqs, step_duration, volume=0.35):
    pieces = [pygame.sndarray.array(_tone(f, step_duration, volume)) for f in freqs]
    combined = np.concatenate(pieces, axis=0)
    return pygame.sndarray.make_sound(np.ascontiguousarray(combined))


class SoundManager:
    """Builds and plays a small library of synthesized sound effects."""

    def __init__(self):
        self.enabled = True
        self.sounds = {}
        try:
            pygame.mixer.init(frequency=SAMPLE_RATE, size=-16, channels=2)
            self.sounds["catch"] = _tone(880, 0.12, 0.4)
            self.sounds["golden"] = _chime([880, 1174, 1568], 0.09)
            self.sounds["red"] = _tone(160, 0.25, 0.5, waveform="square")
            self.sounds["powerup"] = _chime([660, 990], 0.12)
            self.sounds["miss"] = _tone(220, 0.2, 0.35, waveform="square")
            self.sounds["levelup"] = _chime([523, 659, 784, 1047], 0.09)
            self.sounds["gameover"] = _tone(140, 0.6, 0.5, waveform="square")
        except pygame.error:
            # No audio device available (e.g. a headless environment) -
            # fail silently rather than crashing the game.
            self.enabled = False

    def play(self, name):
        if not self.enabled:
            return
        sound = self.sounds.get(name)
        if sound is not None:
            sound.play()
