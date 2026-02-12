"""
audio_player.py — Audio feedback system using pygame.mixer.

Loads audio files from per-emotion subfolders and plays a random
one per detection cycle.

Expected folder structure:
    audio/
        happy/      ← drop 3 .wav or .mp3 files here
        sad/
        stressed/
        neutral/    ← (optional, neutral usually has no audio)
"""

import os
import time
import pygame


class AudioPlayer:
    """Manages audio playback for emotion feedback."""

    # Subfolders to scan (must match emotion labels, lowercase)
    EMOTION_FOLDERS = ["happy", "sad", "stressed", "neutral"]

    # Supported audio extensions
    AUDIO_EXTS = {".wav", ".mp3", ".ogg"}

    def __init__(self, audio_dir: str, max_duration: float = 10.0):
        """
        Initialize the audio player.

        Args:
            audio_dir: Path to the root audio directory containing
                       per-emotion subfolders.
            max_duration: Maximum playback duration in seconds.
        """
        self.audio_dir = audio_dir
        self.max_duration = max_duration
        self.play_start_time = None
        self.is_playing = False
        self.current_emotion = None

        # Initialize pygame mixer
        try:
            pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=1024)
            self._initialized = True
        except Exception as e:
            print(f"[WARNING] pygame mixer init failed: {e}")
            self._initialized = False

        # sounds[emotion] = [Sound, Sound, ...]
        self.sounds = {}
        # Round-robin index per emotion  {emotion: int}
        self._next_idx = {}

        if self._initialized:
            self._preload()

    def _preload(self):
        """Scan per-emotion subfolders and preload all audio files."""
        for folder in self.EMOTION_FOLDERS:
            emotion = folder.capitalize()   # "happy" → "Happy"
            folder_path = os.path.join(self.audio_dir, folder)

            if not os.path.isdir(folder_path):
                continue

            loaded = []
            for fname in sorted(os.listdir(folder_path)):
                ext = os.path.splitext(fname)[1].lower()
                if ext not in self.AUDIO_EXTS:
                    continue
                fpath = os.path.join(folder_path, fname)
                try:
                    snd = pygame.mixer.Sound(fpath)
                    loaded.append(snd)
                    print(f"[INFO] Loaded: {folder}/{fname}")
                except Exception as e:
                    print(f"[WARNING] Failed to load {fpath}: {e}")

            if loaded:
                self.sounds[emotion] = loaded
                self._next_idx[emotion] = 0
                print(f"[INFO] {emotion}: {len(loaded)} sound(s) ready")
            else:
                print(f"[INFO] {emotion}: no audio files found in {folder}/")

        # Also check for legacy flat files (happy.wav etc.) as fallback
        for folder in self.EMOTION_FOLDERS:
            emotion = folder.capitalize()
            if emotion in self.sounds:
                continue
            flat_path = os.path.join(self.audio_dir, f"{folder}.wav")
            if os.path.exists(flat_path):
                try:
                    snd = pygame.mixer.Sound(flat_path)
                    self.sounds[emotion] = [snd]
                    self._next_idx[emotion] = 0
                    print(f"[INFO] Loaded fallback: {folder}.wav")
                except Exception:
                    pass

    def play(self, emotion: str):
        """
        Play the next audio clip for the given emotion (round-robin).

        Cycles through clips sequentially: 1 → 2 → 3 → 1 → …

        Args:
            emotion: The detected emotion label (e.g. "Happy").
        """
        if not self._initialized:
            return
        if self.is_playing:
            return

        clips = self.sounds.get(emotion)
        if not clips:
            return

        try:
            idx = self._next_idx.get(emotion, 0)
            clip = clips[idx]
            clip.play()
            # Advance to next clip for next time
            self._next_idx[emotion] = (idx + 1) % len(clips)
            self.play_start_time = time.time()
            self.is_playing = True
            self.current_emotion = emotion
        except Exception as e:
            print(f"[ERROR] Audio playback failed: {e}")

    def update(self):
        """
        Check if playback should be stopped (max duration reached).
        Call this every frame.

        Returns:
            True if audio is still playing, False if stopped/finished.
        """
        if not self.is_playing:
            return False

        elapsed = time.time() - self.play_start_time

        if elapsed >= self.max_duration:
            self.stop()
            return False

        if not pygame.mixer.get_busy():
            self.is_playing = False
            return False

        return True

    def stop(self):
        """Stop all audio playback."""
        if self._initialized:
            pygame.mixer.stop()
        self.is_playing = False
        self.play_start_time = None
        self.current_emotion = None

    def get_playback_progress(self):
        """
        Get playback progress as float [0.0, 1.0].

        Returns:
            Progress based on elapsed time vs max duration.
        """
        if not self.is_playing or self.play_start_time is None:
            return 0.0
        elapsed = time.time() - self.play_start_time
        return min(1.0, elapsed / self.max_duration)

    def cleanup(self):
        """Clean up pygame mixer."""
        self.stop()
        if self._initialized:
            try:
                pygame.mixer.quit()
            except Exception:
                pass
