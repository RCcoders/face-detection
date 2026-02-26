
import sys
import os
import cv2
import numpy as np

# Add src to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SCRIPT_DIR, "src"))

try:
    from face_detector import FaceDetector
    from emotion_model import EmotionClassifier
except ImportError as e:
    print(f"[FAIL] Import failed: {e}")
    sys.exit(1)

def main():
    print("Initializing components...")
    try:
        fd = FaceDetector()
        print("[PASS] FaceDetector initialized (MediaPipe)")
    except Exception as e:
        print(f"[FAIL] FaceDetector init failed: {e}")
        sys.exit(1)

    try:
        ec = EmotionClassifier()
        print("[PASS] EmotionClassifier initialized")
    except Exception as e:
        print(f"[FAIL] EmotionClassifier init failed: {e}")
        sys.exit(1)

    # Create a dummy image (black 640x480)
    # We can't test detection easily without a real face, but we can test the pipeline doesn't crash
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Draw a face-like structure? No, MediaPipe is too smart for simple drawings.
    # Just run detection and expect 0 faces, but no crash.
    print("Running detection on empty frame...")
    bbox, crop, count = fd.detect(dummy_frame)
    print(f"[PASS] Detection ran. Faces found: {count} (Expected 0)")

    # Test emotion prediction on a dummy crop (48x48)
    print("Running prediction on dummy crop...")
    dummy_crop = np.zeros((48, 48, 3), dtype=np.uint8)
    emotion, conf = ec.predict(dummy_crop)
    print(f"[PASS] Prediction result: {emotion}, Confidence: {conf:.2f}")

    if ec.model is None:
        print("[WARN] Model was NOT loaded (using fallback). Check download.")
    else:
        print("[PASS] Model loaded successfully.")

    print("\nVerification Complete!")

if __name__ == "__main__":
    main()
