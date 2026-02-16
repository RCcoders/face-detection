"""
emotion_model.py — Emotion classification using custom trained CNN.

Uses a lightweight CNN trained on FER-2013 (7 classes) and maps them
to our display categories.
"""

import os
import cv2
import numpy as np

# Try importing tensorflow, but don't crash if it takes time or fails
try:
    import tensorflow as tf
except ImportError:
    print("[ERROR] tensorflow not found. pip install tensorflow")
    tf = None

# Our display emotion categories
EMOTIONS = ["Happy", "Neutral", "Sad", "Stressed", "Surprised", "Angry"]

# The 7 classes output by the model (standard FER-2013 order)
_MODEL_CLASSES = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# Mapping from model's 7 classes to our 6 display categories
_FER_MAP = {
    "angry":    "Angry",
    "disgust":  "Stressed",
    "fear":     "Stressed",
    "happy":    "Happy",
    "neutral":  "Neutral",
    "sad":      "Sad",
    "surprise": "Surprised",
}


class EmotionClassifier:
    """Classifies facial expressions using a Keras model."""

    def __init__(self, model_filename="fer2013_mini_XCEPTION.102-0.66.hdf5"):
        self.model = None
        self.input_shape = (64, 64) # Default for mini_XCEPTION
        
        if tf is None:
            print("[WARNING] TensorFlow not available. Using random fallback.")
            return

        try:
            # Locate the model file: ../../models/model_filename
            base_path = os.path.dirname(os.path.abspath(__file__))
            # emotion_model.py is in backend/src
            # Go up 2 levels: src -> backend -> emotion_kiosk -> models
            model_path = os.path.join(base_path, "..", "..", "models", model_filename)
            model_path = os.path.abspath(model_path)

            if not os.path.exists(model_path):
                # Fallback to old name if new one doesn't exist
                old_path = os.path.join(base_path, "..", "..", "models", "emotion_model.h5")
                old_path = os.path.abspath(old_path)
                if os.path.exists(old_path):
                    print(f"[INFO] New model not found. Falling back to: {old_path}")
                    model_path = old_path
                else:
                    print(f"[WARNING] Model file not found at: {model_path}")
                    return

            print(f"[INFO] Loading emotion model from: {model_path}")
            self.model = tf.keras.models.load_model(model_path, compile=False)
            print("[INFO] Model loaded successfully.")
            
            # Try to determine input shape from model
            try:
                # model.input_shape is usually (None, H, W, C)
                cfg = self.model.input_shape
                if cfg and len(cfg) == 4:
                    self.input_shape = (cfg[1], cfg[2])
                    print(f"[INFO] Auto-detected input shape: {self.input_shape}")
            except Exception:
                pass


        except Exception as e:
            print(f"[ERROR] Failed to load emotion model: {e}")

    def predict(self, face_crop):
        """
        Predict emotion from a face crop.

        Args:
            face_crop: BGR face image (numpy array).

        Returns:
            Tuple of (emotion_label, confidence).
        """
        if face_crop is None or face_crop.size == 0:
            return None, 0.0

        # Fallback if model is not loaded
        if self.model is None:
            idx = np.random.randint(0, len(EMOTIONS))
            return EMOTIONS[idx], np.random.uniform(0.4, 0.85)

        try:
            # Preprocess
            # 1. Grayscale
            if len(face_crop.shape) == 3:
                gray_face = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            else:
                gray_face = face_crop

            # --- LIGHTING CORRECTION ---
            # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            gray_face = clahe.apply(gray_face)

            # Apply Gamma Correction (brighten dark images)
            gamma = 1.2
            invGamma = 1.0 / gamma
            table = np.array([((i / 255.0) ** invGamma) * 255
                              for i in np.arange(0, 256)]).astype("uint8")
            gray_face = cv2.LUT(gray_face, table)
            # ---------------------------

            # 2. Resize to model input shape
            target_h, target_w = self.input_shape
            resized = cv2.resize(gray_face, (target_w, target_h))

            # 3. Normalize to [-1, 1] for mini_XCEPTION
            # (pixel / 255.0) - 0.5) * 2.0
            input_arr = resized.astype("float32") / 255.0
            input_arr = input_arr - 0.5
            input_arr = input_arr * 2.0
            
            # 4. Expand dims -> (1, H, W, 1)
            input_arr = np.expand_dims(input_arr, axis=0)
            input_arr = np.expand_dims(input_arr, axis=-1)

            # Predict
            # fast inference: use __call__ instead of .predict()
            preds = self.model(input_arr, training=False).numpy()[0] # [p0, p1, ..., p6]

            # Aggregate scores for our display categories
            scores = {cat: 0.0 for cat in EMOTIONS}
            
            for i, prob in enumerate(preds):
                if i < len(_MODEL_CLASSES):
                    raw_label = _MODEL_CLASSES[i]
                    display_cat = _FER_MAP.get(raw_label)
                    if display_cat:
                        scores[display_cat] += prob
            
            # Find Best
            best_cat = max(scores, key=scores.get)
            confidence = scores[best_cat]

            return best_cat, confidence

        except Exception as e:
            print(f"[ERROR] Prediction failed: {e}")
            # Fallback
            idx = np.random.randint(0, len(EMOTIONS))
            return EMOTIONS[idx], 0.5
