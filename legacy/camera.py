"""
camera.py — Webcam / IP camera capture with threaded reader.

Supports:
  - Local webcam via device index (default: 0)
  - Mobile phone camera via IP Webcam URL (e.g. http://192.168.x.x:8080/video)

The threaded reader continuously grabs frames in the background so the
main loop always gets the LATEST frame with zero buffer lag.
"""

import cv2
import threading
import time


class Camera:
    """Manages webcam or IP camera capture with low-latency threaded reading."""

    def __init__(self, source=0, width: int = 1280, height: int = 720):
        """
        Initialize the camera.

        Args:
            source: Camera device index (int) or IP Webcam URL (str).
                    For Android "IP Webcam" app:
                      "http://<PHONE_IP>:8080/video"
                    For DroidCam:
                      "http://<PHONE_IP>:4747/video"
            width: Desired capture width (for local cameras).
            height: Desired capture height (for local cameras).
        """
        self.source = source
        self.is_ip = isinstance(source, str)
        self._frame = None
        self._lock = threading.Lock()
        self._running = False

        if self.is_ip:
            print(f"[INFO] Connecting to IP camera: {source}")

        self.cap = cv2.VideoCapture(source)

        if not self.cap.isOpened():
            if self.is_ip:
                raise RuntimeError(
                    f"Cannot connect to IP camera at {source}.\n"
                    "Make sure:\n"
                    "  1. Your phone and PC are on the same WiFi network\n"
                    "  2. The IP Webcam app is running and streaming\n"
                    "  3. The URL is correct (check the app for the IP address)"
                )
            else:
                raise RuntimeError(
                    f"Cannot open camera device {source}. "
                    "Make sure a webcam is connected."
                )

        # Set resolution for local cameras
        if not self.is_ip:
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

        # Minimal buffer for lower latency
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        # Start the background reader thread
        self._running = True
        self._thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._thread.start()

        # Wait for first frame
        deadline = time.time() + 5.0
        while self._frame is None and time.time() < deadline:
            time.sleep(0.05)

        if self._frame is None:
            raise RuntimeError("Camera started but no frames received within 5s.")

    def _reader_loop(self):
        """Background thread: continuously grab the latest frame."""
        while self._running:
            ret, frame = self.cap.read()
            if ret and frame is not None:
                # Resize large IP camera frames to 720p for performance
                h, w = frame.shape[:2]
                if w > 1300:
                    scale = 1280 / w
                    new_w = 1280
                    new_h = int(h * scale)
                    frame = cv2.resize(frame, (new_w, new_h),
                                       interpolation=cv2.INTER_AREA)

                with self._lock:
                    self._frame = frame
            else:
                time.sleep(0.01)  # brief pause on read failure

    def read_frame(self):
        """
        Get the latest captured frame (non-blocking).

        Returns:
            BGR frame (numpy array) or None.
        """
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    def get_resolution(self):
        """Return the actual capture resolution as (width, height)."""
        f = self.read_frame()
        if f is not None:
            return f.shape[1], f.shape[0]
        return 1280, 720

    def release(self):
        """Release the camera resource."""
        self._running = False
        if hasattr(self, '_thread') and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        if self.cap is not None and self.cap.isOpened():
            self.cap.release()

    def __del__(self):
        self.release()
