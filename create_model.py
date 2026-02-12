"""
create_model.py — Create and save the emotion CNN model architecture.

Creates a lightweight CNN suitable for FER-2013 emotion classification.
Saves the model with random (untrained) weights to models/emotion_model.h5.

The architecture is designed to be compatible with transfer learning
from FER-2013 or similar datasets.

Usage:
    python create_model.py
"""

import os

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


def build_emotion_model(num_classes=4, input_shape=(48, 48, 1)):
    """
    Build a lightweight CNN for facial emotion classification.

    Architecture:
        - 4 Convolutional blocks with Batch Normalization and MaxPooling
        - Global Average Pooling
        - Dense layers with Dropout
        - Softmax output

    Args:
        num_classes: Number of emotion categories.
        input_shape: Input image dimensions (height, width, channels).

    Returns:
        Compiled Keras Sequential model.
    """
    model = keras.Sequential([
        # Input
        layers.Input(shape=input_shape),

        # Block 1
        layers.Conv2D(32, (3, 3), padding="same"),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.Conv2D(32, (3, 3), padding="same"),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Dropout(0.25),

        # Block 2
        layers.Conv2D(64, (3, 3), padding="same"),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.Conv2D(64, (3, 3), padding="same"),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Dropout(0.25),

        # Block 3
        layers.Conv2D(128, (3, 3), padding="same"),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.Conv2D(128, (3, 3), padding="same"),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Dropout(0.25),

        # Block 4
        layers.Conv2D(256, (3, 3), padding="same"),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.MaxPooling2D(pool_size=(2, 2)),
        layers.Dropout(0.25),

        # Classification head
        layers.GlobalAveragePooling2D(),
        layers.Dense(256),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.Dropout(0.5),
        layers.Dense(128),
        layers.BatchNormalization(),
        layers.Activation("relu"),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation="softmax"),
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


def main():
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, "emotion_model.h5")

    print("Building emotion classification model...")
    print(f"  Classes: Happy, Neutral, Sad, Stressed")
    print(f"  Input:   48x48 grayscale")
    print()

    model = build_emotion_model(num_classes=4)
    model.summary()

    print(f"\nSaving model to: {model_path}")
    model.save(model_path)
    
    file_size = os.path.getsize(model_path) / (1024 * 1024)
    print(f"Model saved! ({file_size:.1f} MB)")
    print()
    print("NOTE: This model has RANDOM weights.")
    print("      For real predictions, train it using train_model.py")
    print("      or replace emotion_model.h5 with a pre-trained model.")


if __name__ == "__main__":
    main()
