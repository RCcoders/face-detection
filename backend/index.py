"""
api_server.py — FastAPI backend for the Emotion Detection Kiosk.

Exposes a single endpoint that accepts a base64-encoded image frame
and returns emotion detection results.

Run:
    python api_server.py
"""

import os
import sys
import base64

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add src to path (src is now a sibling in backend/src)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SCRIPT_DIR, "src"))

from face_detector import FaceDetector
from emotion_model import EmotionClassifier

# ── Init ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Emotion Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("[INFO] Loading face detector...")
face_detector = FaceDetector()

print("[INFO] Loading emotion model...")
emotion_classifier = EmotionClassifier()


# ── Models ────────────────────────────────────────────────────────────────────

class DetectRequest(BaseModel):
    image: str  # base64-encoded JPEG/PNG frame


class DetectResponse(BaseModel):
    detected: bool
    emotion: str | None = None
    confidence: float = 0.0
    face_count: int = 0
    bbox: list[int] | None = None


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/api/detect", response_model=DetectResponse)
async def detect_emotion(req: DetectRequest):
    """Detect faces and classify emotion from a base64 image."""
    try:
        # Decode base64 → image
        img_data = req.image
        if "," in img_data:
            img_data = img_data.split(",", 1)[1]

        raw = base64.b64decode(img_data)
        arr = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if frame is not None:
            h, w = frame.shape[:2]
            if w > 640:
                scale = 640 / w
                new_h = int(h * scale)
                frame = cv2.resize(frame, (640, new_h))

        if frame is None:
            return DetectResponse(detected=False, face_count=0)

        # Detect face
        bbox, crop, face_count = face_detector.detect(frame)

        if bbox is None or crop is None:
            return DetectResponse(detected=False, face_count=face_count)

        # Classify emotion
        emotion, confidence = emotion_classifier.predict(crop)

        if emotion is None:
            return DetectResponse(
                detected=True,
                face_count=face_count,
                bbox=list(bbox),
            )

        return DetectResponse(
            detected=True,
            emotion=emotion,
            confidence=round(confidence, 3),
            face_count=face_count,
            bbox=list(bbox),
        )

    except Exception as e:
        print(f"[ERROR] Detection failed: {e}")
        return DetectResponse(detected=False)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Leaderboard Persistence ───────────────────────────────────────────────────

import json
from datetime import datetime

LEADERBOARD_FILE = os.path.join(SCRIPT_DIR, "..", "leaderboard.json")

def load_leaderboard():
    if not os.path.exists(LEADERBOARD_FILE):
        return []
    try:
        with open(LEADERBOARD_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_leaderboard(entries):
    try:
        # Keep top 50 only
        entries.sort(key=lambda x: x["score"], reverse=True)
        entries = entries[:50]
        with open(LEADERBOARD_FILE, "w") as f:
            json.dump(entries, f, indent=2)
    except Exception as e:
        print(f"[ERROR] Failed to save leaderboard: {e}")

class LeaderboardEntry(BaseModel):
    name: str
    score: int
    rounds: int
    date: str | None = None

@app.get("/api/leaderboard")
async def get_leaderboard():
    return load_leaderboard()

@app.post("/api/leaderboard")
async def add_leaderboard_entry(entry: LeaderboardEntry):
    board = load_leaderboard()
    
    new_entry = entry.dict()
    if not new_entry.get("date"):
        new_entry["date"] = datetime.now().isoformat()
        
    board.append(new_entry)
    save_leaderboard(board)
    return {"status": "ok", "leaderboard": board[:10]} # Return top 10 for immediate updates


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
