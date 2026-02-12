"""
emotion_buffer.py — Temporal emotion buffering with majority vote.

Collects per-frame emotion predictions over a configurable time window
and returns the majority-vote emotion to prevent flickering.
"""

import time
from collections import Counter


class EmotionBuffer:
    """Buffers emotion predictions and computes majority vote."""

    def __init__(self, buffer_duration: float = 3.0, min_predictions: int = 5):
        """
        Initialize the emotion buffer.

        Args:
            buffer_duration: Time window in seconds for collecting predictions.
            min_predictions: Minimum number of predictions before a vote is valid.
        """
        self.buffer_duration = buffer_duration
        self.min_predictions = min_predictions
        self.predictions = []  # List of (timestamp, emotion, confidence)
        self.locked_emotion = None
        self.locked_confidence = None
        self.lock_time = None

    def add_prediction(self, emotion: str, confidence: float):
        """
        Add a new prediction to the buffer.

        Args:
            emotion: Predicted emotion label.
            confidence: Prediction confidence score.
        """
        if self.locked_emotion is not None:
            return  # Already locked, ignore new predictions

        now = time.time()
        self.predictions.append((now, emotion, confidence))

        # Remove old predictions outside the time window
        cutoff = now - self.buffer_duration
        self.predictions = [
            (t, e, c) for t, e, c in self.predictions if t >= cutoff
        ]

    def get_stable_emotion(self):
        """
        Compute the majority-vote emotion from buffered predictions.

        Returns:
            Tuple of (emotion_label, avg_confidence) if a stable emotion
            is determined, or (None, 0.0) if not enough data.
        """
        if self.locked_emotion is not None:
            return self.locked_emotion, self.locked_confidence

        if len(self.predictions) < self.min_predictions:
            return None, 0.0

        # Check if we have enough time span
        if self.predictions:
            time_span = self.predictions[-1][0] - self.predictions[0][0]
            if time_span < self.buffer_duration * 0.7:
                return None, 0.0

        # Majority vote
        emotions = [e for _, e, _ in self.predictions]
        counter = Counter(emotions)
        majority_emotion, count = counter.most_common(1)[0]

        # Require at least 40% agreement
        if count / len(emotions) < 0.4:
            return None, 0.0

        # Calculate average confidence for the majority emotion
        confidences = [c for _, e, c in self.predictions if e == majority_emotion]
        avg_confidence = sum(confidences) / len(confidences)

        # Lock the emotion
        self.locked_emotion = majority_emotion
        self.locked_confidence = avg_confidence
        self.lock_time = time.time()

        return majority_emotion, avg_confidence

    def is_locked(self):
        """Check if an emotion has been locked."""
        return self.locked_emotion is not None

    def get_progress(self):
        """
        Get scanning progress as a float [0.0, 1.0].

        Returns:
            Progress ratio based on predictions collected vs minimum needed,
            combined with time elapsed vs buffer duration.
        """
        if self.locked_emotion is not None:
            return 1.0

        if not self.predictions:
            return 0.0

        time_span = self.predictions[-1][0] - self.predictions[0][0]
        time_progress = min(1.0, time_span / self.buffer_duration)
        count_progress = min(1.0, len(self.predictions) / self.min_predictions)

        return min(1.0, (time_progress + count_progress) / 2)

    def reset(self):
        """Clear the buffer and unlock."""
        self.predictions.clear()
        self.locked_emotion = None
        self.locked_confidence = None
        self.lock_time = None
