"use client";

import { useState, useEffect, useRef } from "react";

/* ── Emotion-to-Emoji Mapping ────────────────────────────────── */
const EMOJI_MAP: Record<string, string[]> = {
    Happy: ["😊", "😄", "✨", "🎉", "💛"],
    Sad: ["💧", "🌧️", "💙", "😔"],
    Stressed: ["⚡", "🔥", "💢", "💥", "🔴"],
    Surprised: ["😲", "✨", "❗", "💥"],
    Neutral: ["❄️", "✨", "☁️", "💠"],
    Angry: ["🔥", "💢", "💥", "😡"],
};

const DEFAULT_EMOJIS = ["✨", "💠", "☁️", "🌀"];

interface Particle {
    id: number;
    left: string;
    top: string;
    size: number;
    dur: string;
    delay: string;
    opacity: number;
    char: string;
}

interface ParticleFieldProps {
    emotion?: string | null;
}

export default function ParticleField({ emotion }: ParticleFieldProps) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const prevEmotionRef = useRef<string | null>(null);

    useEffect(() => {
        const emojis = emotion && EMOJI_MAP[emotion] ? EMOJI_MAP[emotion] : DEFAULT_EMOJIS;

        // Don't regenerate if emotion hasn't changed (unless empty)
        if (emotion === prevEmotionRef.current && particles.length > 0) return;
        prevEmotionRef.current = emotion ?? null;

        let count = 25;
        if (emotion === "Happy") count = 50; // Busy
        if (emotion === "Sad") count = 12;   // Sparse
        if (emotion === "Stressed") count = 40;
        if (emotion === "Neutral") count = 15;

        const newParticles: Particle[] = [];

        for (let i = 0; i < count; i++) {
            let x = Math.random() * 100;
            let y = Math.random() * 100;

            const dx = x - 50;
            const dy = y - 50;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 30) {
                if (x < 50) x -= 35; else x += 35;
                if (y < 50) y -= 35; else y += 35;
            }

            // Speed logic based on emotion
            let durMult = 1.0;
            if (emotion === "Happy") durMult = 0.5; // Fast
            if (emotion === "Sad") durMult = 2.5;   // Slow
            if (emotion === "Stressed") durMult = 0.8;
            if (emotion === "Neutral") durMult = 3.0;

            const baseDur = (6 + Math.random() * 8) * durMult;
            newParticles.push({
                id: i,
                left: `${x}%`,
                top: `${y}%`,
                size: 20 + Math.random() * 25,
                dur: `${baseDur}s`,
                delay: `${-Math.random() * 10}s`,
                opacity: 0.4 + Math.random() * 0.4,
                char: emojis[Math.floor(Math.random() * emojis.length)],
            });
        }

        setParticles(newParticles);
    }, [emotion, particles.length]);

    if (particles.length === 0) return null;

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 9, // Above the mask (z-index 7) but below text (z-index 10)
                pointerEvents: "none",
                overflow: "hidden",
            }}
        >
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="animate-float"
                    style={{
                        position: "absolute",
                        left: p.left,
                        top: p.top,
                        fontSize: p.size,
                        opacity: p.opacity,
                        animationDelay: p.delay,
                        animationDuration: p.dur,
                        userSelect: "none",
                        willChange: "transform, opacity",
                        textShadow: "0 2px 10px rgba(0,0,0,0.5)", // Make them pop
                    } as React.CSSProperties}
                >
                    {p.char}
                </div>
            ))}
        </div>
    );
}
