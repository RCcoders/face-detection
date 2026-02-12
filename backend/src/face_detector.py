"""
face_detector.py — OpenCV-based single-face detector.

Uses OpenCV's Haar Cascade classifier for reliable face detection.
Detects exactly one face in the frame.
Returns the bounding box and cropped face region.
Rejects frames with zero or multiple faces.
"""

import cv2
import numpy as np


class FaceDetector:
    """Detects a single face using OpenCV Haar Cascade."""

    def __init__(self, min_detection_confidence: float = 0.6, scale_factor: float = 1.15,
                 min_neighbors: int = 6, min_face_size: int = 80):
        """
        Initialize the face detector.

        Args:
            min_detection_confidence: Not used directly (kept for API compat).
            scale_factor: How much the image size is reduced at each scale.
            min_neighbors: How many neighbors each candidate rectangle needs
                           to retain it (higher = fewer false positives).
            min_face_size: Minimum face size in pixels.
        """
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.face_cascade = cv2.CascadeClassifier(cascade_path)

        if self.face_cascade.empty():
            raise RuntimeError(
                f"Failed to load Haar cascade from {cascade_path}. "
                "Make sure opencv-python is installed correctly."
            )

        self.scale_factor = scale_factor
        self.min_neighbors = min_neighbors
        self.min_face_size = (min_face_size, min_face_size)

    def detect(self, frame):
        """
        Detect faces in the given BGR frame.

        Args:
            frame: BGR image (numpy array).

        Returns:
            Tuple of (bbox, face_crop, num_faces).
            bbox = (x, y, w, h) in pixel coordinates.
            face_crop = cropped face region (BGR numpy array).
            num_faces = number of faces detected.
            Returns (None, None, 0) if no faces detected.
            Returns (None, None, N) if N > 1 faces detected.
        """
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Equalize histogram for better detection in varying lighting
        gray = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=self.scale_factor,
            minNeighbors=self.min_neighbors,
            minSize=self.min_face_size,
            flags=cv2.CASCADE_SCALE_IMAGE,
        )

        num_faces = len(faces)

        if num_faces == 0:
            return None, None, 0

        if num_faces > 1:
            return None, None, num_faces

        # Exactly one face
        x, y, fw, fh = faces[0]

        # Add padding for better emotion recognition
        pad_x = int(fw * 0.15)
        pad_y = int(fh * 0.15)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(w, x + fw + pad_x)
        y2 = min(h, y + fh + pad_y)

        face_crop = frame[y1:y2, x1:x2]

        if face_crop.size == 0:
            return None, None, 0

        bbox = (x1, y1, x2 - x1, y2 - y1)
        return bbox, face_crop, 1

    def release(self):
        """Release resources (no-op for Haar cascade, kept for API compat)."""
        pass

    def __del__(self):
        pass
