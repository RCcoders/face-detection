# Real-Time Facial Emotion Detection with Adaptive Audio Feedback

A real-time system that detects a person's emotional state using facial expression
analysis and provides adaptive audio feedback. The system uses a camera to capture
facial expressions, applies computer vision and machine learning to classify emotions,
and responds with audio cues based on the detected emotional state.

> **Purpose**: Showcase how AI can recognize human emotions and respond in a supportive,
> non-intrusive way. This is **not** a medical or psychological treatment tool.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN APPLICATION                     │
│                    (State Machine)                       │
│                                                         │
│  IDLE → DETECTING → SCANNING → RESULT → RESET → IDLE   │
│                                                         │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│  Camera  │   Face   │ Emotion  │ Emotion  │   Audio     │
│  Module  │ Detector │  Model   │  Buffer  │  Player     │
│          │          │  (CNN)   │ (Vote)   │ (pygame)    │
│ OpenCV   │MediaPipe │TensorFlow│ 3s window│  .wav files │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

## Project Structure

```
emotion_kiosk/
├── models/
│   └── emotion_model.h5        # CNN model (create with create_model.py)
├── audio/
│   ├── happy.wav               # Generated audio cues
│   ├── sad.wav
│   ├── stressed.wav
│   └── neutral.wav
├── src/
│   ├── camera.py               # Webcam capture
│   ├── face_detector.py        # MediaPipe face detection
│   ├── emotion_model.py        # Emotion classification
│   ├── emotion_buffer.py       # Temporal majority-vote buffer
│   ├── audio_player.py         # Audio playback (pygame)
│   └── main.py                 # Main application (state machine + UI)
├── create_model.py             # Generate model architecture
├── generate_audio.py           # Generate audio .wav files
├── train_model.py              # Train model on FER-2013 (bonus)
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## Quick Start

### 1. Setup Environment

```bash
cd emotion_kiosk
python -m venv venv
venv\Scripts\activate           # Windows
# source venv/bin/activate      # macOS/Linux

pip install -r requirements.txt
```

### 2. Generate Assets

```bash
python generate_audio.py        # Creates audio/*.wav files
python create_model.py          # Creates models/emotion_model.h5
```

### 3. Run the Application

```bash
python src/main.py              # Normal mode
python src/main.py --demo       # Fullscreen demo/event mode
```

## Controls

| Key       | Action               |
|-----------|----------------------|
| **R**     | Reset / next user    |
| **F**     | Toggle fullscreen    |
| **Q/ESC** | Exit application     |

## Emotions Detected

| Emotion    | Audio Response              |
|------------|-----------------------------|
| 😊 Happy   | Bright, upbeat tone         |
| 😐 Neutral | No audio                    |
| 😢 Sad     | Warm, comforting tone       |
| 😰 Stressed| Calm, soothing drone        |

## User Flow

```
  ┌─────────────────┐
  │  Idle Screen    │  "Please stand in front of the camera"
  └───────┬─────────┘
          ▼
  ┌─────────────────┐
  │  Face Detected  │  Green bounding box appears
  └───────┬─────────┘
          ▼
  ┌─────────────────┐
  │  Scanning (3s)  │  "Scanning your expression…" + progress bar
  └───────┬─────────┘
          ▼
  ┌─────────────────┐
  │  Emotion Result │  Shows emotion + plays audio (10-12s)
  └───────┬─────────┘
          ▼
  ┌─────────────────┐
  │  Auto Reset     │  "Next participant" → returns to Idle
  └─────────────────┘
```

## Training a Real Model (Optional)

The included model has **random weights**. For real emotion detection:

1. Download the [FER-2013 dataset](https://www.kaggle.com/datasets/msambare/fer2013)
2. Organize into `data/train/` and `data/test/` with subfolders per emotion
3. Map FER-2013 labels: angry/disgust/fear → stressed, surprise → happy
4. Run training:

```bash
python train_model.py --data_dir data/ --epochs 50
```

## Key Design Decisions

- **Single face only**: Rejects frames with multiple faces to avoid confusion
- **3-second buffer**: Majority vote prevents emotion flickering
- **Offline operation**: No internet required — fast and reliable
- **FPS limiter (18 FPS)**: Prevents overheating during long sessions
- **Auto-reset**: Fully automated for exhibition/kiosk use

## Limitations

- Model accuracy depends on training data quality (untrained model = random)
- Performance varies with lighting conditions and face angles
- Not suitable for medical diagnosis or psychological assessment
- Works best with frontal face view at 0.5–2m distance
- Glasses and facial hair may affect detection confidence

## Technologies

- **OpenCV** — Camera capture and UI rendering
- **MediaPipe** — Real-time face detection
- **TensorFlow/Keras** — CNN emotion classification
- **pygame** — Audio playback
- **Python 3.8+** — Core language

---

*Built for public demonstration and educational purposes.*
