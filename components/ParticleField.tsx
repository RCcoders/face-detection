"use client";

import { useState, useEffect } from "react";

interface Particle {
    id: number;
    left: string;
    top: string;
    size: number;
    dur: string;
    delay: string;
    opacity: number;
}

export default function ParticleField() {
    const [particles, setParticles] = useState<Particle[]>([]);

    // Generate particles only on the client to avoid SSR hydration mismatch
    useEffect(() => {
        setParticles(
            Array.from({ length: 35 }, (_, i) => ({
                id: i,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                size: 2 + Math.random() * 4,
                dur: `${4 + Math.random() * 6}s`,
                delay: `${-Math.random() * 6}s`,
                opacity: 0.08 + Math.random() * 0.18,
            }))
        );
    }, []);

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
