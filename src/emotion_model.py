"""
emotion_model.py — Emotion classification using pre-trained FER model.

Uses the `fer` library's bundled pre-trained model for accurate emotion
detection. Maps 7 FER emotions → 4 display categories:

    angry, disgust, fear  →  Stressed
    happy, surprise       →  Happy
    sad                   →  Sad
    neutral               →  Neutral
"""

import cv2
import numpy as np

# Our display emotion categories
EMOTIONS = ["Happy", "Neutral", "Sad", "Stressed"]

# Mapping from FER's 7 emotions to our 4 categories
_FER_MAP = {
    "angry":    "Stressed",
    "disgust":  "Stressed",
    "fear":     "Stressed",
    "happy":    "Happy",
    "surprise": "Happy",
    "sad":      "Sad",
    "neutral":  "Neutral",
}


class EmotionClassifier:
    """Classifies facial expressions using the pre-trained FER model."""

    def __init__(self, model_path: str = None):
        """
        Initialize the emotion classifier.

        Args:
            model_path: Legacy argument (ignored). The FER library bundles
                        its own pre-trained model.
        """
        self.detector = None

        try:
            from fer.fer import FER
            # mtcnn=False  → use OpenCV cascade (we do our own face detection)
            self.detector = FER(mtcnn=False)
            print("[INFO] FER pre-trained emotion model loaded successfully")
        except ImportError:
            print("[WARNING] fer package not installed. pip install fer")
            print("          Falling back to random predictions.")
        except Exception as e:
            print(f"[WARNING] Failed to load FER model: {e}")

    def predict(self, face_crop):
        """
        Predict emotion from a face crop.

        Args:
            face_crop: BGR face image (numpy array).

        Returns:
            Tuple of (emotion_label, confidence) or (None, 0.0) on failure.
        """
        if face_crop is None or face_crop.size == 0:
            return None, 0.0

        if self.detector is None:
            # Random fallback when FER not available
            idx = np.random.randint(0, len(EMOTIONS))
            return EMOTIONS[idx], np.random.uniform(0.4, 0.85)

        try:
            # FER expects BGR image (OpenCV default) — we already have that
            results = self.detector.detect_emotions(face_crop)

            if not results:
                # FER couldn't detect a face in the crop — try resizing
                h, w = face_crop.shape[:2]
                if h < 48 or w < 48:
                    face_crop = cv2.resize(face_crop, (96, 96))
                    results = self.detector.detect_emotions(face_crop)
                if not results:
                    return None, 0.0

            # Get the first (or best) face result
            emotions = results[0]["emotions"]
            # emotions = {"angry": 0.02, "disgust": 0.0, "fear": 0.01,
            #             "happy": 0.85, "sad": 0.02, "surprise": 0.05,
            #             "neutral": 0.05}

            # Aggregate into our 4 categories
            scores = {"Happy": 0.0, "Neutral": 0.0, "Sad": 0.0, "Stressed": 0.0}
            for fer_emotion, prob in emotions.items():
                mapped = _FER_MAP.get(fer_emotion, "Neutral")
                scores[mapped] += prob

            # Find the dominant emotion
            best = max(scores, key=scores.get)
            confidence = scores[best]

            return best, confidence

        except Exception as e:
            print(f"[ERROR] Emotion prediction failed: {e}")
            return None, 0.0
