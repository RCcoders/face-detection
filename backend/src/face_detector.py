"""
face_detector.py — MediaPipe-based single-face detector.

Uses MediaPipe Face Detection for robust, high-performance face tracking.
Detects faces even in difficult lighting and poses.
"""

import cv2
import numpy as np
import mediapipe as mp

class FaceDetector:
    """Detects a single face using MediaPipe Face Detection."""

    def __init__(self, min_detection_confidence: float = 0.5):
        """
        Initialize the MediaPipe face detector.
        
        Args:
            min_detection_confidence: Minimum confidence for face detection [0.0, 1.0].
        """
        try:
            self.mp_face_detection = mp.solutions.face_detection
        except AttributeError:
            from mediapipe.python.solutions import face_detection
            self.mp_face_detection = face_detection

        self.detector = self.mp_face_detection.FaceDetection(
            min_detection_confidence=min_detection_confidence,
            model_selection=0
        )

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
        
        # specific for mediapipe: RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.detector.process(rgb_frame)

        if not results.detections:
            return None, None, 0

        # Find the largest face
        detections = results.detections
        num_faces = len(detections)
        
        best_detection = None
        best_area = 0.0
        
        for detection in detections:
            bboxC = detection.location_data.relative_bounding_box
            width = bboxC.width
            height = bboxC.height
            area = width * height
            if area > best_area:
                best_area = area
                best_detection = detection
        
        if best_detection is None:
            return None, None, 0

        # Convert relative bbox to pixels
        bboxC = best_detection.location_data.relative_bounding_box
        x = int(bboxC.xmin * w)
        y = int(bboxC.ymin * h)
        fw = int(bboxC.width * w)
        fh = int(bboxC.height * h)

        # Enhance bbox (MediaPipe is very tight)
        # We need more forehead/chin for emotion model
        pad_y_top = int(fh * 0.20)
        pad_y_bottom = int(fh * 0.05)
        pad_x = int(fw * 0.05)

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
        """Release MediaPipe resources."""
        if hasattr(self, 'detector'):
            self.detector.close()

    def __del__(self):
        self.release()
