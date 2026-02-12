"""
train_model.py — Train the emotion CNN on FER-2013 dataset.

This script trains the emotion classification model using the FER-2013
dataset. You need to download the dataset first.

Dataset: https://www.kaggle.com/datasets/msambare/fer2013
Expected structure:
    data/
    ├── train/
    │   ├── happy/
    │   ├── neutral/
    │   ├── sad/
    │   └── stressed/ (or 'fear' renamed)
    └── test/
        ├── happy/
        ├── neutral/
        ├── sad/
        └── stressed/

Usage:
    python train_model.py --data_dir data/ --epochs 50

For FER-2013, you may need to map original labels:
    angry    → stressed
    disgust  → stressed
    fear     → stressed
    happy    → happy
    sad      → sad
    surprise → happy
    neutral  → neutral
"""

import os
import argparse

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from create_model import build_emotion_model


# Emotion labels must match model output order
EMOTION_LABELS = ["happy", "neutral", "sad", "stressed"]


def create_data_generators(data_dir, batch_size=64, img_size=48):
    """Create training and validation data generators."""

    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=15,
        width_shift_range=0.15,
        height_shift_range=0.15,
        horizontal_flip=True,
        zoom_range=0.1,
        shear_range=0.1,
        brightness_range=[0.8, 1.2],
    )

    val_datagen = ImageDataGenerator(rescale=1.0 / 255)

    train_dir = os.path.join(data_dir, "train")
    test_dir = os.path.join(data_dir, "test")

    if not os.path.exists(train_dir):
        raise FileNotFoundError(
            f"Training directory not found: {train_dir}\n"
            "Please download and organize the FER-2013 dataset.\n"
            "See the script docstring for expected directory structure."
        )

    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=(img_size, img_size),
        color_mode="grayscale",
        batch_size=batch_size,
        class_mode="categorical",
        classes=EMOTION_LABELS,
        shuffle=True,
    )

    val_generator = val_datagen.flow_from_directory(
        test_dir,
        target_size=(img_size, img_size),
        color_mode="grayscale",
        batch_size=batch_size,
        class_mode="categorical",
        classes=EMOTION_LABELS,
        shuffle=False,
    )

    return train_generator, val_generator


def train(data_dir, epochs=50, batch_size=64):
    """Train the emotion model."""

    print("=" * 60)
    print("  EMOTION MODEL TRAINING")
    print("=" * 60)
    print(f"  Data directory: {data_dir}")
    print(f"  Epochs: {epochs}")
    print(f"  Batch size: {batch_size}")
    print(f"  Labels: {EMOTION_LABELS}")
    print("=" * 60)

    # Create data generators
    print("\nLoading data...")
    train_gen, val_gen = create_data_generators(data_dir, batch_size)
    print(f"  Training samples: {train_gen.samples}")
    print(f"  Validation samples: {val_gen.samples}")

    # Build model
    print("\nBuilding model...")
    model = build_emotion_model(num_classes=len(EMOTION_LABELS))

    # Callbacks
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, "emotion_model.h5")

    callbacks = [
        keras.callbacks.ModelCheckpoint(
            model_path,
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            patience=10,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1,
        ),
    ]

    # Train
    print("\nStarting training...\n")
    history = model.fit(
        train_gen,
        epochs=epochs,
        validation_data=val_gen,
        callbacks=callbacks,
        verbose=1,
    )

    # Final evaluation
    print("\n" + "=" * 60)
    print("  TRAINING COMPLETE")
    print("=" * 60)
    val_loss, val_acc = model.evaluate(val_gen, verbose=0)
    print(f"  Best validation accuracy: {val_acc:.4f}")
    print(f"  Best validation loss: {val_loss:.4f}")
    print(f"  Model saved to: {model_path}")
    print("=" * 60)

    return history


def main():
    parser = argparse.ArgumentParser(
        description="Train the emotion classification model on FER-2013"
    )
    parser.add_argument(
        "--data_dir", type=str, default="data",
        help="Path to dataset directory (with train/ and test/ subdirs)"
    )
    parser.add_argument(
        "--epochs", type=int, default=50,
        help="Number of training epochs"
    )
    parser.add_argument(
        "--batch_size", type=int, default=64,
        help="Training batch size"
    )
    args = parser.parse_args()

    train(args.data_dir, args.epochs, args.batch_size)


if __name__ == "__main__":
    main()
