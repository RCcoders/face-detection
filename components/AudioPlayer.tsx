"use client";

import { useRef, useCallback, useEffect, useState } from "react";

const AUDIO_FILES: Record<string, string[]> = {
    Happy: ["/audio/happy/happy1.mp3", "/audio/happy/happy2.mp3", "/audio/happy/happy3.mp3"],
    Sad: ["/audio/sad/sad1.mp3", "/audio/sad/sad2.mp3", "/audio/sad/sad3.mp3"],
    Stressed: ["/audio/stressed/stressed1.mp3", "/audio/stressed/stressed2.mp3", "/audio/stressed/stressed3.mp3"],
    Neutral: ["/audio/neutral/neutral1.mp3", "/audio/neutral/neutral2.mp3", "/audio/neutral/neutral3.mp3"],
};

interface AudioPlayerProps {
    emotion: string | null;
    play: boolean;
    onProgress?: (progress: number) => void;
    onEnded?: () => void;
}

export default function AudioPlayer({
    emotion,
    play,
    onProgress,
    onEnded,
}: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const indexRef = useRef<Record<string, number>>({});
    const [unlocked, setUnlocked] = useState(false);

    // Unlock audio on first user interaction (browser autoplay policy)
    useEffect(() => {
        const unlock = () => {
            if (!unlocked) {
                // Create a silent audio context to unlock playback
                const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                const buffer = ctx.createBuffer(1, 1, 22050);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(0);
                setUnlocked(true);
            }
        };

        window.addEventListener("click", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        window.addEventListener("touchstart", unlock, { once: true });

        return () => {
            window.removeEventListener("click", unlock);
            window.removeEventListener("keydown", unlock);
            window.removeEventListener("touchstart", unlock);
        };
    }, [unlocked]);

    const getNextTrack = useCallback((rawEm: string) => {
        if (!rawEm) return null;

        // Normalize: "happy" -> "Happy"
        let em = rawEm.charAt(0).toUpperCase() + rawEm.slice(1).toLowerCase();

        // Map other emotions to "Stressed" if no direct match
        if (!AUDIO_FILES[em]) {
            if (["Fear", "Angry", "Disgust", "Surprise"].includes(em)) {
                em = "Stressed";
            } else {
                // Fallback to Neutral if still no match? Or Stressed?
                // If we have "Stressed" audio, let's use it for any negative/high arousal stuff
                em = "Stressed";
            }
        }

        // Final check
        if (!AUDIO_FILES[em]) return null;

        const tracks = AUDIO_FILES[em];
        if (!tracks || tracks.length === 0) return null;
        const idx = indexRef.current[em] ?? 0;
        indexRef.current[em] = (idx + 1) % tracks.length;
        return tracks[idx];
    }, []);

    // Play / stop based on props
    useEffect(() => {
        // 1. Stop if play is false or emotion is null
        if (!play || !emotion) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            return;
        }



        // 3. If already playing, DO NOT restart/skip track
        if (audioRef.current && !audioRef.current.paused) {
            return;
        }

        // 4. Select and play track
        const track = getNextTrack(emotion);
        if (!track) return;

        const audio = new Audio(track);
        audio.volume = 1.0;
        audioRef.current = audio;

        // Loop the audio for continuous playback as requested
        audio.loop = true;

        const handleEnded = () => {
            // Because it loops, 'ended' won't fire naturally unless we unloop.
            // But just in case browsers fire it on loop end (some don't):
            onEnded?.();
        };

        const handleTimeUpdate = () => {
            if (audio.duration > 0) {
                onProgress?.(audio.currentTime / audio.duration);
            }
        };

        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("timeupdate", handleTimeUpdate);

        audio.play().catch((e) => {
            console.warn("[Audio] Play blocked:", e.message);
        });

        // Cleanup: only pause if we are actually unmounting or `play` becomes false
        // The return function here runs on re-renders too if dependencies change.
        return () => {
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("timeupdate", handleTimeUpdate);

            audio.pause();
            audio.src = ""; // Release memory
        };
    }, [play, emotion, getNextTrack, onProgress, onEnded]);

    // Show unlock prompt if not yet unlocked
    if (!unlocked) {
        return (
            <div
                style={{
                    position: "fixed",
                    top: 16,
                    right: 16,
                    zIndex: 100,
                    background: "rgba(255,184,77,0.15)",
                    border: "1px solid rgba(255,184,77,0.3)",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    color: "var(--accent-amber)",
                    cursor: "pointer",
                    backdropFilter: "blur(8px)",
                }}
                onClick={() => setUnlocked(true)}
            >
                🔊 Click anywhere to enable audio
            </div>
        );
    }

    return null;
}
