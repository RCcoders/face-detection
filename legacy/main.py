"""
main.py — Main application: Real-Time Facial Emotion Detection Kiosk.

State machine flow:
    IDLE → DETECTING → SCANNING → RESULT → RESET → IDLE

Controls:
    R     = Manual reset
    Q/ESC = Exit
    F     = Toggle fullscreen
"""

import os
import sys
import time
import math
import cv2
import numpy as np

# Resolve paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
MODELS_DIR = os.path.join(PROJECT_DIR, "models")
AUDIO_DIR = os.path.join(PROJECT_DIR, "audio")

# Add src to path
sys.path.insert(0, SCRIPT_DIR)

from camera import Camera
from face_detector import FaceDetector
from emotion_model import EmotionClassifier
from emotion_buffer import EmotionBuffer
from audio_player import AudioPlayer


# ── Application States ──────────────────────────────────────────────────────

class State:
    IDLE = "IDLE"
    DETECTING = "DETECTING"
    SCANNING = "SCANNING"
    RESULT = "RESULT"
    RESET = "RESET"


# ── Color Palette (BGR) ─────────────────────────────────────────────────────

class C:
    """Premium color palette — all BGR."""
    BG       = (18, 18, 22)
    WHITE    = (255, 255, 255)
    OFFWHITE = (230, 230, 235)
    GRAY     = (140, 140, 150)
    DIM      = (80, 80, 90)
    TEAL     = (210, 195, 70)       # Muted teal
    CYAN     = (230, 210, 90)
    GREEN    = (130, 215, 100)
    LIME     = (110, 240, 170)
    AMBER    = (60, 195, 255)
    ORANGE   = (50, 145, 255)
    RED      = (80, 80, 235)
    PURPLE   = (200, 110, 190)
    PINK     = (180, 120, 240)

    EMOTION = {
        "Happy":    (80, 230, 255),    # warm gold
        "Neutral":  (210, 195, 70),    # teal
        "Sad":      (220, 155, 80),    # sky blue
        "Stressed": (110, 100, 230),   # coral red
    }

    EMOTION_GLOW = {
        "Happy":    (40, 120, 180),
        "Neutral":  (120, 110, 40),
        "Sad":      (130, 90, 50),
        "Stressed": (60, 55, 140),
    }


# ── Smooth Bounding-Box Tracker ─────────────────────────────────────────────

class SmoothBox:
    """Exponential-moving-average bounding-box tracker for zero jitter."""

    def __init__(self, smoothing: float = 0.35):
        self.sx = self.sy = self.sw = self.sh = 0.0
        self.initialized = False
        self.alpha = smoothing          # lower = smoother

    def update(self, bbox):
        if bbox is None:
            return None
        x, y, w, h = bbox
        if not self.initialized:
            self.sx, self.sy, self.sw, self.sh = float(x), float(y), float(w), float(h)
            self.initialized = True
        else:
            a = self.alpha
            self.sx += a * (x - self.sx)
            self.sy += a * (y - self.sy)
            self.sw += a * (w - self.sw)
            self.sh += a * (h - self.sh)
        return (int(self.sx), int(self.sy), int(self.sw), int(self.sh))

    def reset(self):
        self.initialized = False


# ── Particle System (lightweight) ────────────────────────────────────────────

class Particles:
    """Simple floating-dot particle system for the IDLE screen."""

    def __init__(self, count=40, w=1280, h=720):
        self.n = count
        rng = np.random.default_rng(42)
        self.x  = rng.uniform(0, w, count).astype(np.float32)
        self.y  = rng.uniform(0, h, count).astype(np.float32)
        self.vx = rng.uniform(-0.3, 0.3, count).astype(np.float32)
        self.vy = rng.uniform(-0.15, 0.15, count).astype(np.float32)
        self.r  = rng.integers(2, 5, count)
        self.a  = rng.uniform(0.2, 0.7, count).astype(np.float32)
        self.w, self.h = w, h

    def resize(self, w, h):
        self.w, self.h = w, h

    def tick(self):
        self.x += self.vx
        self.y += self.vy
        # wrap
        self.x %= self.w
        self.y %= self.h

    def draw(self, frame, tint=C.TEAL):
        overlay = frame.copy()
        for i in range(self.n):
            col = tuple(int(c * self.a[i]) for c in tint)
            cv2.circle(overlay, (int(self.x[i]), int(self.y[i])),
                       int(self.r[i]), col, -1, cv2.LINE_AA)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)


# ── Drawing Helpers (performance-optimised) ──────────────────────────────────

# Vignette mask cache  {(h,w,strength) → uint8 mask}
_vignette_cache = {}


def _put(frame, text, pos, scale, color, thick, shadow=True):
    """Low-level text with optional drop-shadow."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    if shadow:
        cv2.putText(frame, text, (pos[0]+2, pos[1]+2), font, scale,
                    (0, 0, 0), thick + 2, cv2.LINE_AA)
    cv2.putText(frame, text, pos, font, scale, color, thick, cv2.LINE_AA)


def text_center(frame, text, y, scale=1.0, color=C.WHITE, thick=2):
    """Draw text centered horizontally."""
    w = frame.shape[1]
    tw = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thick)[0][0]
    _put(frame, text, ((w - tw) // 2, y), scale, color, thick)


def text_at(frame, text, pos, scale=0.55, color=C.GRAY, thick=1):
    _put(frame, text, pos, scale, color, thick, shadow=False)


def vignette(frame, strength=0.45):
    """Apply a cinematic radial vignette (cached mask — near-zero cost)."""
    h, w = frame.shape[:2]
    key = (h, w, int(strength * 100))
    if key not in _vignette_cache:
        y = np.linspace(-1, 1, h).reshape(-1, 1).astype(np.float32)
        x = np.linspace(-1, 1, w).reshape(1, -1).astype(np.float32)
        mask = 1.0 - strength * (x * x + y * y)
        np.clip(mask, 0.0, 1.0, out=mask)
        # Store as uint8 (0-255) for fast multiply
        _vignette_cache[key] = (mask * 255).astype(np.uint8)
    mask = _vignette_cache[key]
    # Fast per-channel multiply using cv2 (stays in uint8)
    for c in range(3):
        frame[:, :, c] = cv2.multiply(frame[:, :, c], mask, scale=1.0/255)


def dark_overlay(frame, alpha=0.35):
    """Darken the entire frame uniformly (fast, color-safe)."""
    cv2.convertScaleAbs(frame, frame, alpha=(1.0 - alpha), beta=0)


def gradient_bar(frame, x, y, w_bar, h_bar, progress, col_start, col_end):
    """Draw a progress bar with solid start→end color blend (fast)."""
    cv2.rectangle(frame, (x, y), (x + w_bar, y + h_bar), (35, 35, 42), -1)
    cv2.rectangle(frame, (x, y), (x + w_bar, y + h_bar), (55, 55, 65), 1)
    fill = max(0, min(w_bar, int(w_bar * progress)))
    if fill < 2:
        return
    # Blend color at midpoint instead of per-pixel loop
    mid_col = tuple(int((col_start[c] + col_end[c]) * 0.5) for c in range(3))
    half = fill // 2
    if half > 0:
        cv2.rectangle(frame, (x+1, y+1), (x+half, y+h_bar-1), col_start, -1)
    if fill > half:
        cv2.rectangle(frame, (x+half, y+1), (x+fill, y+h_bar-1), mid_col, -1)
    # Bright tip
    cv2.rectangle(frame, (x+fill-2, y+1), (x+fill, y+h_bar-1), col_end, -1)


def draw_glow_circle(frame, center, radius, color, intensity=0.5):
    """Draw a soft-glow circle (lightweight, reduced intensity)."""
    overlay = frame.copy()
    cv2.circle(overlay, center, radius, color, -1, cv2.LINE_AA)
    # Very subtle blend to avoid color distortion
    cv2.addWeighted(overlay, intensity * 0.12, frame, 1.0 - intensity * 0.12, 0, frame)


def draw_scan_ring(frame, center, radius, progress, color):
    """Draw an animated arc ring (scan indicator)."""
    start = int(-90 + 360 * progress * 0.3) % 360
    end = start + int(360 * progress)
    cv2.ellipse(frame, center, (radius, radius), 0, start, end, color, 2, cv2.LINE_AA)
    dim = tuple(c // 3 for c in color)
    cv2.ellipse(frame, center, (radius + 4, radius + 4), 0,
                start, end, dim, 1, cv2.LINE_AA)


def fancy_face_box(frame, bbox, color, thickness=2, phase=0.0):
    """Stylised face bounding box with animated corner brackets (no blur)."""
    x, y, w, h = bbox
    cl = min(w, h) // 3
    t = thickness + 1

    # Lightweight glow: semi-transparent rectangle (no GaussianBlur)
    overlay = frame.copy()
    glow_col = tuple(c // 2 for c in color)
    cv2.rectangle(overlay, (x - 4, y - 4), (x + w + 4, y + h + 4), glow_col, -1)
    cv2.addWeighted(overlay, 0.08, frame, 0.92, 0, frame)

    # Thin full rectangle
    cv2.rectangle(frame, (x, y), (x + w, y + h), color, 1, cv2.LINE_AA)

    # Animated corner length
    breath = int(4 * math.sin(phase * 1.5))
    cl2 = cl + breath

    # Corners
    cv2.line(frame, (x, y), (x + cl2, y), color, t, cv2.LINE_AA)
    cv2.line(frame, (x, y), (x, y + cl2), color, t, cv2.LINE_AA)
    cv2.line(frame, (x + w, y), (x + w - cl2, y), color, t, cv2.LINE_AA)
    cv2.line(frame, (x + w, y), (x + w, y + cl2), color, t, cv2.LINE_AA)
    cv2.line(frame, (x, y + h), (x + cl2, y + h), color, t, cv2.LINE_AA)
    cv2.line(frame, (x, y + h), (x, y + h - cl2), color, t, cv2.LINE_AA)
    cv2.line(frame, (x + w, y + h), (x + w - cl2, y + h), color, t, cv2.LINE_AA)
    cv2.line(frame, (x + w, y + h), (x + w, y + h - cl2), color, t, cv2.LINE_AA)


def lerp_color(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + t * (b[i] - a[i])) for i in range(3))


# ── Main Application ────────────────────────────────────────────────────────

class EmotionKiosk:
    """Main application class for the emotion detection kiosk."""

    TARGET_FPS      = 30
    SCAN_DURATION   = 3.0
    RESULT_DURATION = 12.0
    RESET_DURATION  = 2.5
    FACE_TIMEOUT    = 2.0
    WIN             = "Emotion Detection Kiosk"

    def __init__(self, demo_mode=False, camera_source=0):
        self.demo = demo_mode
        self.state = State.IDLE
        self.t_state = time.time()
        self.face_lost_t = None
        self.emotion = None
        self.confidence = 0.0
        self.fc = 0
        self.fps = 0.0
        self.fps_t = time.time()
        self.phase = 0.0
        self.fullscreen = demo_mode
        self.running = True
        self.fade = 0.0           # 0→1 fade-in helper
        self.prev_state = None

        # Smooth tracker
        self.sbox = SmoothBox(smoothing=0.3)

        # Particles
        self.particles = Particles(50, 1280, 720)

        # Components
        print("[INFO] Initializing camera...")
        self.cam = Camera(source=camera_source)

        print("[INFO] Initializing face detector...")
        self.fd = FaceDetector()

        print("[INFO] Loading emotion model...")
        self.ec = EmotionClassifier()

        print("[INFO] Initializing audio player...")
        self.ap = AudioPlayer(AUDIO_DIR, max_duration=10.0)

        self.eb = EmotionBuffer(buffer_duration=self.SCAN_DURATION, min_predictions=8)

        # Window
        cv2.namedWindow(self.WIN, cv2.WINDOW_NORMAL)
        if self.fullscreen:
            cv2.setWindowProperty(self.WIN, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
        else:
            cv2.resizeWindow(self.WIN, 1280, 720)

        print("[INFO] Ready! Q/ESC=exit  R=reset  F=fullscreen")

    # ── State transitions ────────────────────────────────────────────────

    def go(self, s):
        self.prev_state = self.state
        self.state = s
        self.t_state = time.time()
        self.face_lost_t = None
        self.fade = 0.0

    def dt(self):
        return time.time() - self.t_state

    # ── IDLE ─────────────────────────────────────────────────────────────

    def _idle(self, f, bbox, crop, nf):
        h, w = f.shape[:2]
        self.particles.resize(w, h)
        self.particles.tick()
        self.particles.draw(f)

        dark_overlay(f, 0.30)
        vignette(f, 0.40)

        # Glow behind title area
        draw_glow_circle(f, (w // 2, int(h * 0.15)), 180, (30, 25, 15), 0.25)

        # Title
        text_center(f, "EMOTION  DETECTION", int(h * 0.14),
                    scale=2.0, color=C.AMBER, thick=3)
        text_center(f, "Real-Time Facial Analysis", int(h * 0.21),
                    scale=0.75, color=C.DIM, thick=1)

        # Separator line
        lx = int(w * 0.3)
        ly = int(h * 0.25)
        cv2.line(f, (lx, ly), (w - lx, ly), C.DIM, 1, cv2.LINE_AA)

        # Pulsing scan ring + face icon
        cx, cy = w // 2, int(h * 0.40)
        ring_r = 48 + int(6 * math.sin(self.phase * 0.8))
        pulse_col = lerp_color(C.TEAL, C.CYAN, 0.5 + 0.5 * math.sin(self.phase))
        draw_scan_ring(f, (cx, cy), ring_r, 0.5 + 0.3 * math.sin(self.phase * 0.5), pulse_col)

        # Face silhouette inside ring
        cv2.ellipse(f, (cx, cy - 4), (22, 28), 0, 0, 360, pulse_col, 2, cv2.LINE_AA)

        # Instruction
        alpha_v = 0.6 + 0.4 * math.sin(self.phase * 0.7)
        inst_col = tuple(int(c * alpha_v) for c in C.OFFWHITE)
        text_center(f, "Please stand in front of the camera", int(h * 0.58),
                    scale=1.0, color=inst_col, thick=2)

        # Multi-face warning
        if nf > 1:
            text_center(f, "Only one person at a time, please", int(h * 0.68),
                        scale=0.75, color=C.AMBER, thick=2)

        if bbox is not None:
            self.sbox.reset()
            self.go(State.DETECTING)

    # ── DETECTING ────────────────────────────────────────────────────────

    def _detecting(self, f, bbox, crop, nf):
        h, w = f.shape[:2]

        if bbox is None:
            if self.face_lost_t is None:
                self.face_lost_t = time.time()
            elif time.time() - self.face_lost_t > 1.0:
                self.go(State.IDLE)
                return
        else:
            self.face_lost_t = None

        dark_overlay(f, 0.15)
        vignette(f, 0.35)

        sbx = self.sbox.update(bbox)
        if sbx:
            fancy_face_box(f, sbx, C.CYAN, 2, self.phase)

        # Fade-in text
        self.fade = min(1.0, self.fade + 0.06)
        fc = lerp_color((0, 0, 0), C.GREEN, self.fade)
        text_center(f, "Face Detected", int(h * 0.11),
                    scale=1.3, color=fc, thick=2)

        sc = lerp_color((0, 0, 0), C.OFFWHITE, self.fade)
        text_center(f, "Hold still — scanning will begin shortly", int(h * 0.18),
                    scale=0.7, color=sc, thick=1)

        # Small countdown dots
        elapsed = self.dt()
        dots_total = 3
        filled = min(dots_total, int(elapsed / 0.25) + 1)
        dx = w // 2 - 20
        for i in range(dots_total):
            col = C.GREEN if i < filled else C.DIM
            cv2.circle(f, (dx + i * 20, int(h * 0.22)), 4, col, -1, cv2.LINE_AA)

        if elapsed > 0.8:
            self.eb.reset()
            self.go(State.SCANNING)

    # ── SCANNING ─────────────────────────────────────────────────────────

    def _scanning(self, f, bbox, crop, nf):
        h, w = f.shape[:2]

        if bbox is None:
            if self.face_lost_t is None:
                self.face_lost_t = time.time()
            elif time.time() - self.face_lost_t > self.FACE_TIMEOUT:
                self.go(State.IDLE)
                return
        else:
            self.face_lost_t = None

        # Predict
        if crop is not None:
            em, conf = self.ec.predict(crop)
            if em:
                self.eb.add_prediction(em, conf)

        dark_overlay(f, 0.18)
        vignette(f, 0.35)

        # Face box (amber while scanning)
        sbx = self.sbox.update(bbox)
        progress = self.eb.get_progress()
        scan_col = lerp_color(C.AMBER, C.LIME, progress)

        if sbx:
            fancy_face_box(f, sbx, scan_col, 2, self.phase)
            # Animated scan-ring around face
            cx = sbx[0] + sbx[2] // 2
            cy = sbx[1] + sbx[3] // 2
            r = max(sbx[2], sbx[3]) // 2 + 20
            draw_scan_ring(f, (cx, cy), r, progress, scan_col)

        # Header
        text_center(f, "Scanning Your Expression", int(h * 0.10),
                    scale=1.2, color=C.AMBER, thick=2)

        # Gradient progress bar
        bar_w = int(w * 0.45)
        bar_x = (w - bar_w) // 2
        bar_y = int(h * 0.16)
        gradient_bar(f, bar_x, bar_y, bar_w, 12, progress, C.AMBER, C.LIME)

        pct = int(progress * 100)
        text_center(f, f"{pct}%", bar_y + 32, scale=0.55, color=C.GRAY, thick=1)

        # Animated bottom text
        ndots = (int(self.phase * 1.5) % 4)
        text_center(f, "Analyzing" + "." * ndots, int(h * 0.88),
                    scale=0.6, color=C.DIM, thick=1)

        # Check result
        stable, conf = self.eb.get_stable_emotion()
        if stable:
            self.emotion = stable
            self.confidence = conf
            self.go(State.RESULT)

    # ── RESULT ───────────────────────────────────────────────────────────

    def _result(self, f, bbox, crop, nf):
        h, w = f.shape[:2]
        ecol = C.EMOTION.get(self.emotion, C.WHITE)
        gcol = C.EMOTION_GLOW.get(self.emotion, C.DIM)

        # Face box in emotion color
        sbx = self.sbox.update(bbox)
        if sbx:
            fancy_face_box(f, sbx, ecol, 3, self.phase)

        dark_overlay(f, 0.32)
        vignette(f, 0.40)

        # Background glow for the emotion
        draw_glow_circle(f, (w // 2, int(h * 0.20)), 220, gcol, 0.35)

        # Fade in
        self.fade = min(1.0, self.fade + 0.04)

        # "Emotion Detected" label
        lc = lerp_color((0, 0, 0), C.OFFWHITE, self.fade)
        text_center(f, "Emotion Detected", int(h * 0.08),
                    scale=0.9, color=lc, thick=1)

        # Separator
        sep_w = int(160 * self.fade)
        cv2.line(f, (w // 2 - sep_w, int(h * 0.11)),
                 (w // 2 + sep_w, int(h * 0.11)), C.DIM, 1, cv2.LINE_AA)

        # Emotion name (large, colored)
        emojis = {"Happy": ":)", "Neutral": ":|", "Sad": ":(", "Stressed": ":/"}
        e_text = f'{emojis.get(self.emotion, "")}  {self.emotion}'
        e_col = lerp_color((0, 0, 0), ecol, self.fade)
        text_center(f, e_text, int(h * 0.22), scale=2.4, color=e_col, thick=4)

        # Confidence
        conf_col = lerp_color((0, 0, 0), C.GRAY, self.fade)
        text_center(f, f"Confidence: {self.confidence:.0%}", int(h * 0.30),
                    scale=0.75, color=conf_col, thick=1)

        # Confidence bar
        bar_w = int(w * 0.25)
        bar_x = (w - bar_w) // 2
        gradient_bar(f, bar_x, int(h * 0.33), bar_w, 8, self.confidence, gcol, ecol)

        # Audio feedback area
        if self.emotion != "Neutral":
            if self.ap.is_playing:
                prog = self.ap.get_playback_progress()
                text_center(f, "Playing audio feedback", int(h * 0.84),
                            scale=0.65, color=C.ORANGE, thick=1)
                abar_w = int(w * 0.35)
                abar_x = (w - abar_w) // 2
                gradient_bar(f, abar_x, int(h * 0.87), abar_w, 6, prog, C.ORANGE, C.AMBER)
            elif self.dt() > 1.0:
                text_center(f, "Audio complete", int(h * 0.84),
                            scale=0.65, color=C.GREEN, thick=1)
        else:
            text_center(f, "Neutral — no audio feedback", int(h * 0.84),
                        scale=0.6, color=C.DIM, thick=1)

        # Play audio once
        if self.dt() < 0.5:
            self.ap.play(self.emotion)
        self.ap.update()

        if self.dt() > self.RESULT_DURATION:
            self.ap.stop()
            self.go(State.RESET)

    # ── RESET ────────────────────────────────────────────────────────────

    def _reset(self, f, bbox, crop, nf):
        h, w = f.shape[:2]

        dark_overlay(f, 0.50)
        vignette(f, 0.45)

        self.fade = min(1.0, self.fade + 0.05)

        tc = lerp_color((0, 0, 0), C.GREEN, self.fade)
        text_center(f, "Thank You!", int(h * 0.33), scale=1.8, color=tc, thick=3)

        sc = lerp_color((0, 0, 0), C.OFFWHITE, self.fade)
        text_center(f, "Next participant, please step forward",
                    int(h * 0.44), scale=0.85, color=sc, thick=2)

        remaining = max(0, self.RESET_DURATION - self.dt())
        rc = lerp_color((0, 0, 0), C.DIM, self.fade)
        text_center(f, f"Resetting in {remaining:.0f}s", int(h * 0.54),
                    scale=0.6, color=rc, thick=1)

        # Countdown bar
        bar_w = int(w * 0.3)
        bar_x = (w - bar_w) // 2
        bar_prog = 1.0 - (remaining / self.RESET_DURATION) if self.RESET_DURATION > 0 else 1.0
        gradient_bar(f, bar_x, int(h * 0.58), bar_w, 6, bar_prog, C.DIM, C.GREEN)

        if self.dt() > self.RESET_DURATION:
            self._full_reset()

    def _full_reset(self):
        self.eb.reset()
        self.ap.stop()
        self.sbox.reset()
        self.emotion = None
        self.confidence = 0.0
        self.go(State.IDLE)

    # ── HUD ──────────────────────────────────────────────────────────────

    def _hud(self, f):
        h, w = f.shape[:2]

        if not self.demo:
            text_at(f, f"FPS {self.fps:.0f}", (12, 24), 0.45, C.DIM)
            scol = {
                State.IDLE: C.DIM, State.DETECTING: C.CYAN,
                State.SCANNING: C.AMBER, State.RESULT: C.GREEN,
                State.RESET: C.PURPLE,
            }.get(self.state, C.WHITE)
            text_at(f, self.state, (12, 46), 0.45, scol)

        # Bottom bar
        cv2.rectangle(f, (0, h - 32), (w, h), (12, 12, 15), -1)
        text_at(f, "R Reset  |  Q/ESC Exit  |  F Fullscreen",
                (14, h - 10), 0.42, C.DIM)
        lbl = "Emotion Kiosk v2.0"
        tw = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)[0][0]
        text_at(f, lbl, (w - tw - 14, h - 10), 0.42, (50, 50, 55))

    # ── Main Loop ────────────────────────────────────────────────────────

    def run(self):
        delay = 1.0 / self.TARGET_FPS
        handlers = {
            State.IDLE:      self._idle,
            State.DETECTING: self._detecting,
            State.SCANNING:  self._scanning,
            State.RESULT:    self._result,
            State.RESET:     self._reset,
        }

        try:
            while self.running:
                t0 = time.time()

                frame = self.cam.read_frame()
                if frame is None:
                    break

                frame = cv2.flip(frame, 1)
                bbox, crop, nf = self.fd.detect(frame)

                handlers[self.state](frame, bbox, crop, nf)
                self._hud(frame)

                # Animation clock
                self.phase += 0.10

                # FPS
                self.fc += 1
                if time.time() - self.fps_t >= 1.0:
                    self.fps = self.fc / (time.time() - self.fps_t)
                    self.fc = 0
                    self.fps_t = time.time()

                cv2.imshow(self.WIN, frame)

                key = cv2.waitKey(1) & 0xFF
                if key in (ord('q'), 27):
                    break
                elif key in (ord('r'), ord('R')):
                    self._full_reset()
                elif key in (ord('f'), ord('F')):
                    self.fullscreen = not self.fullscreen
                    prop = cv2.WINDOW_FULLSCREEN if self.fullscreen else cv2.WINDOW_NORMAL
                    cv2.setWindowProperty(self.WIN, cv2.WND_PROP_FULLSCREEN, prop)

                elapsed = time.time() - t0
                if elapsed < delay:
                    time.sleep(delay - elapsed)

        except KeyboardInterrupt:
            pass
        finally:
            self._cleanup()

    def _cleanup(self):
        print("[INFO] Cleaning up...")
        self.cam.release()
        self.fd.release()
        self.ap.cleanup()
        cv2.destroyAllWindows()
        print("[INFO] Goodbye!")


# ── Entry Point ──────────────────────────────────────────────────────────────

def main():
    import argparse
    p = argparse.ArgumentParser(description="Emotion Detection Kiosk")
    p.add_argument("--demo", action="store_true", help="Fullscreen event mode")
    p.add_argument("--camera", type=str, default="0",
                   help="Camera source: device index (0,1,...) or "
                        "IP Webcam URL (http://PHONE_IP:8080/video)")
    a = p.parse_args()

    # Parse camera source: int for device index, str for URL
    cam_src = a.camera
    if cam_src.isdigit():
        cam_src = int(cam_src)

    EmotionKiosk(demo_mode=a.demo, camera_source=cam_src).run()


if __name__ == "__main__":
    main()
