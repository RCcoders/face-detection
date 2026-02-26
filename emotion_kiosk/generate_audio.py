"""
generate_audio.py — Generate placeholder .wav audio files for each emotion.

Creates simple tonal audio cues using sine waves with different
frequencies, tempos, and characteristics for each emotion.

Run this script once to populate the audio/ directory:
    python generate_audio.py
"""

import os
import struct
import wave
import math

AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio")


def generate_sine_wav(filepath, duration_s, frequency_hz, sample_rate=44100,
                      amplitude=0.5, fade_in=0.1, fade_out=0.3,
                      second_freq=None, modulation_rate=0.0):
    """
    Generate a WAV file with a sine wave tone.

    Args:
        filepath: Output .wav file path.
        duration_s: Duration in seconds.
        frequency_hz: Base frequency in Hz.
        sample_rate: Sample rate (default 44100).
        amplitude: Volume (0.0 to 1.0).
        fade_in: Fade-in duration in seconds.
        fade_out: Fade-out duration in seconds.
        second_freq: Optional second frequency for a layered tone.
        modulation_rate: Amplitude modulation rate in Hz (0 = none).
    """
    n_samples = int(duration_s * sample_rate)
    samples = []

    for i in range(n_samples):
        t = i / sample_rate

        # Base tone
        value = math.sin(2 * math.pi * frequency_hz * t)

        # Add second harmonic if specified
        if second_freq is not None:
            value += 0.4 * math.sin(2 * math.pi * second_freq * t)
            value /= 1.4  # Normalize

        # Amplitude modulation (tremolo effect)
        if modulation_rate > 0:
            mod = 0.7 + 0.3 * math.sin(2 * math.pi * modulation_rate * t)
            value *= mod

        # Apply amplitude
        value *= amplitude

        # Fade in
        if t < fade_in:
            value *= t / fade_in

        # Fade out
        time_from_end = duration_s - t
        if time_from_end < fade_out:
            value *= time_from_end / fade_out

        # Clamp
        value = max(-1.0, min(1.0, value))

        # Convert to 16-bit integer
        sample = int(value * 32767)
        samples.append(sample)

    # Write WAV file
    with wave.open(filepath, "w") as wav_file:
        wav_file.setnchannels(1)       # Mono
        wav_file.setsampwidth(2)       # 16-bit
        wav_file.setframerate(sample_rate)
        for sample in samples:
            wav_file.writeframes(struct.pack("<h", sample))

    file_size = os.path.getsize(filepath) / 1024
    print(f"  Created: {filepath} ({file_size:.0f} KB, {duration_s}s)")


def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    print("Generating audio files...\n")

    # Happy: Bright, upbeat, major chord feel
    generate_sine_wav(
        os.path.join(AUDIO_DIR, "happy.wav"),
        duration_s=12.0,
        frequency_hz=523.25,     # C5
        amplitude=0.4,
        fade_in=0.3,
        fade_out=1.5,
        second_freq=659.25,      # E5 (major third)
        modulation_rate=3.0,     # Gentle pulsing
    )

    # Sad: Slow, warm, low-frequency comfort tone
    generate_sine_wav(
        os.path.join(AUDIO_DIR, "sad.wav"),
        duration_s=12.0,
        frequency_hz=261.63,     # C4 (middle C)
        amplitude=0.35,
        fade_in=1.0,
        fade_out=2.0,
        second_freq=311.13,      # Eb4 (minor third)
        modulation_rate=0.5,     # Very slow pulse
    )

    # Stressed: Calm, soothing, low drone
    generate_sine_wav(
        os.path.join(AUDIO_DIR, "stressed.wav"),
        duration_s=12.0,
        frequency_hz=196.0,      # G3
        amplitude=0.3,
        fade_in=1.5,
        fade_out=2.5,
        second_freq=293.66,      # D4 (perfect fifth)
        modulation_rate=0.3,     # Very slow breathing rhythm
    )

    # Neutral: Very quiet ambient hum (practically silent)
    generate_sine_wav(
        os.path.join(AUDIO_DIR, "neutral.wav"),
        duration_s=5.0,
        frequency_hz=220.0,      # A3
        amplitude=0.05,          # Very quiet
        fade_in=1.0,
        fade_out=2.0,
    )

    print(f"\nAll audio files generated in: {AUDIO_DIR}")


if __name__ == "__main__":
    main()
