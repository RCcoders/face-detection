"use client";

import { useState, useEffect, useRef } from "react";

/* ── Emotion-specific particle configs ────────────────────────── */
const EMOTION_PARTICLE_CONFIG: Record<
    string,
    {
        color: string;
        count: number;
        speedMultiplier: number;
        sizeRange: [number, number];
        opacityRange: [number, number];
    }
> = {
    Happy: {
        color: "rgba(255,199,83",
        count: 50,
        speedMultiplier: 0.7,
        sizeRange: [2, 6],
        opacityRange: [0.1, 0.3],
    },
    Sad: {
        color: "rgba(96,168,232",
        count: 20,
        speedMultiplier: 1.6,
        sizeRange: [2, 5],
        opacityRange: [0.06, 0.18],
    },
    Stressed: {
        color: "rgba(232,112,112",
        count: 40,
        speedMultiplier: 0.5,
        sizeRange: [1, 4],
        opacityRange: [0.1, 0.25],
    },
    Neutral: {
        color: "rgba(90,220,232",
        count: 30,
        speedMultiplier: 1.0,
        sizeRange: [2, 5],
        opacityRange: [0.08, 0.2],
    },
};

const DEFAULT_CONFIG = {
    color: "rgba(90,220,232",
    count: 35,
    speedMultiplier: 1.0,
    sizeRange: [2, 4] as [number, number],
    opacityRange: [0.08, 0.18] as [number, number],
};

interface Particle {
    id: number;
    left: string;
    top: string;
    size: number;
    dur: string;
    delay: string;
    opacity: number;
    color: string;
}

interface ParticleFieldProps {
    emotion?: string | null;
}

export default function ParticleField({ emotion }: ParticleFieldProps) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const prevEmotionRef = useRef<string | null>(null);

    useEffect(() => {
        const config =
            emotion && EMOTION_PARTICLE_CONFIG[emotion]
                ? EMOTION_PARTICLE_CONFIG[emotion]
                : DEFAULT_CONFIG;

        // Don't regenerate if emotion hasn't changed
        if (emotion === prevEmotionRef.current && particles.length > 0) return;
        prevEmotionRef.current = emotion ?? null;

        setParticles(
            Array.from({ length: config.count }, (_, i) => {
                const baseDur = 4 + Math.random() * 6;
                return {
                    id: i,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    size:
                        config.sizeRange[0] +
                        Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
                    dur: `${baseDur * config.speedMultiplier}s`,
                    delay: `${-Math.random() * 6}s`,
                    opacity:
                        config.opacityRange[0] +
                        Math.random() *
                        (config.opacityRange[1] - config.opacityRange[0]),
                    color: `${config.color},1)`,
                };
            })
        );
    }, [emotion, particles.length]);

    if (particles.length === 0) return null;

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                pointerEvents: "none",
                overflow: "hidden",
            }}
        >
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="particle"
                    style={{
                        left: p.left,
                        top: p.top,
                        width: p.size,
                        height: p.size,
                        opacity: p.opacity,
                        background: p.color,
                        "--dur": p.dur,
                        "--delay": p.delay,
                        animationDelay: p.delay,
                        animationDuration: p.dur,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}
