"""
face_detector.py — OpenCV Haar Cascade-based single-face detector.

Uses OpenCV's pre-trained Haar Cascades for reliable, offline face detection.
This is a robust fallback when MediaPipe is unavailable.
"""

import os
import cv2
import numpy as np

class FaceDetector:
    """Detects a single face using OpenCV Haar Cascades."""

    def __init__(self, min_detection_confidence: float = 0.5):
        """
        Initialize the OpenCV face detector.
        """
        cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
        if not os.path.exists(cascade_path):
             # Fallback if the above path is somehow wrong
             cascade_path = 'haarcascade_frontalface_default.xml'
             
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        if self.face_cascade.empty():
            print(f"[ERROR] Could not load face cascade from {cascade_path}")

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
        """
        h, w = frame.shape[:2]
        
        # Convert to grayscale for detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        # scaleFactor=1.1, minNeighbors=3 for better sensitivity (was 5)
        # minSize=30x30 to detect faces further away
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 3, minSize=(30, 30))
        
        num_faces = len(faces)
        if num_faces == 0:
            return None, None, 0

        # Find the largest face by area
        best_face = None
        max_area = 0
        for (x, y, fw, fh) in faces:
            area = fw * fh
            if area > max_area:
                max_area = area
                best_face = (x, y, fw, fh)

        (x, y, fw, fh) = best_face

        # ── FALSE DETECTION PREVENTION ──
        if fw < 30 or fh < 30:
             return None, None, num_faces

        # Enhance bbox (Haar cascades can be tight, just like MediaPipe)
        pad_y_top = int(fh * 0.15)
        pad_y_bottom = int(fh * 0.05)
        pad_x = int(fw * 0.10)

        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y_top)
        x2 = min(w, x + fw + pad_x)
        y2 = min(h, y + fh + pad_y_bottom)

        face_crop = frame[y1:y2, x1:x2]

        if face_crop.size == 0:
            return None, None, 0

        bbox = (x1, y1, x2 - x1, y2 - y1)
        return bbox, face_crop, num_faces

    def release(self):
        """No specific release needed for cascade classifier."""
        pass

    def __del__(self):
        self.release()
