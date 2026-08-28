"""Webcam capture and MediaPipe-based hand detection.

Everything camera- and CV-specific lives here so the rest of the game only
ever deals with simple (x, y, handedness) hand positions.
"""

import cv2
import mediapipe as mp

from . import config

# Wrist + the four MCP (knuckle) joints: averaging these gives a stable
# "palm center" point that doesn't jitter the way a single fingertip does.
PALM_LANDMARK_IDS = (0, 5, 9, 13, 17)


class HandTrackerError(RuntimeError):
    """Raised when the webcam or MediaPipe cannot be initialized."""


class HandTracker:
    def __init__(self, camera_index=config.CAMERA_INDEX, max_hands=2):
        self.cap = cv2.VideoCapture(camera_index)
        if not self.cap.isOpened():
            raise HandTrackerError(
                "Could not open the webcam. Make sure a camera is connected, "
                "it isn't already in use by another application, and that "
                "camera permission is granted to Python/this terminal."
            )

        try:
            self._mp_hands = mp.solutions.hands
            self.hands = self._mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=max_hands,
                min_detection_confidence=0.6,
                min_tracking_confidence=0.5,
            )
        except Exception as exc:  # noqa: BLE001 - surface any init failure cleanly
            self.cap.release()
            raise HandTrackerError(
                f"Failed to initialize MediaPipe Hands: {exc}"
            ) from exc

        self._smoothed_points = {}  # hand slot index -> (x, y)

    def read_frame(self):
        """Grab one frame, mirrored so on-screen movement feels natural."""
        ok, frame = self.cap.read()
        if not ok or frame is None:
            return None
        return cv2.flip(frame, 1)

    def process(self, frame):
        """Run hand detection on a mirrored BGR frame.

        Returns a list of dicts, one per detected hand::

            {"x": float, "y": float, "handedness": "Left" | "Right"}

        x/y are normalized to [0, 1] so they work regardless of camera or
        display resolution.
        """
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self.hands.process(rgb)

        hands_out = []
        if results.multi_hand_landmarks:
            handedness_list = results.multi_handedness or []
            for i, hand_landmarks in enumerate(results.multi_hand_landmarks):
                xs = [hand_landmarks.landmark[j].x for j in PALM_LANDMARK_IDS]
                ys = [hand_landmarks.landmark[j].y for j in PALM_LANDMARK_IDS]
                raw_x = sum(xs) / len(xs)
                raw_y = sum(ys) / len(ys)

                label = "Right"
                if i < len(handedness_list) and handedness_list[i].classification:
                    label = handedness_list[i].classification[0].label

                smoothed_x, smoothed_y = self._smooth(i, raw_x, raw_y)
                hands_out.append(
                    {"x": smoothed_x, "y": smoothed_y, "handedness": label}
                )

        # Drop smoothing memory for hand slots no longer tracked so a hand
        # that leaves and re-enters the frame doesn't snap from a stale spot.
        for slot in list(self._smoothed_points.keys()):
            if slot >= len(hands_out):
                del self._smoothed_points[slot]

        return hands_out

    def _smooth(self, slot, x, y):
        prev = self._smoothed_points.get(slot)
        if prev is None:
            self._smoothed_points[slot] = (x, y)
            return x, y
        alpha = config.HAND_SMOOTHING
        sx = prev[0] + (x - prev[0]) * alpha
        sy = prev[1] + (y - prev[1]) * alpha
        self._smoothed_points[slot] = (sx, sy)
        return sx, sy

    def close(self):
        self.hands.close()
        self.cap.release()
