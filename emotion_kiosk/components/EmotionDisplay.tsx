"use client";

import { useMemo } from "react";

const EMOTION_CONFIG: Record<
    string,
    { emoji: string; color: string; glow: string }
> = {
    Happy: { emoji: "😊", color: "var(--happy)", glow: "rgba(255,199,83,0.25)" },
    Sad: { emoji: "😢", color: "var(--sad)", glow: "rgba(96,168,232,0.25)" },
    Stressed: { emoji: "😰", color: "var(--stressed)", glow: "rgba(232,112,112,0.25)" },
    Neutral: { emoji: "😐", color: "var(--neutral)", glow: "rgba(90,220,232,0.25)" },
};

interface EmotionDisplayProps {
    emotion: string;
    confidence: number;
    joke?: string | null;
    visible: boolean;
}

export default function EmotionDisplay({
    emotion,
    confidence,
    joke,
    visible,
}: EmotionDisplayProps) {
    const config = useMemo(
        () => EMOTION_CONFIG[emotion] || EMOTION_CONFIG.Neutral,
        [emotion]
    );

    if (!visible) return null;

    return (
        <div className="animate-slide-up text-center">

            {/* Divider */}
            <div className="w-[120px] h-[1px] bg-[rgba(255,255,255,0.1)] mx-auto mb-5" />

            {/* Emoji */}
            <span className="emotion-emoji">{config.emoji}</span>

            {/* Name */}
            <h1
                className="emotion-name"
                style={{
                    color: config.color,
                    textShadow: `0 0 40px ${config.glow}, 0 0 80px ${config.glow}`,
                }}
            >
                {emotion}
            </h1>

            {/* Confidence */}
            <p className="text-base text-[var(--text-secondary)] mt-2">
                Confidence: {Math.round(confidence * 100)}%
            </p>

            {/* Confidence bar */}
            <div className="confidence-bar">
                <div
                    className="confidence-fill"
                    style={{
                        width: `${confidence * 100}%`,
                        background: config.color,
                    }}
                />
            </div>
            {/* Joke / One-liner - ENLARGED */}
            {joke && (
                <div className="mt-8 px-4">
                    <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">
                        {joke}
                    </p>
                </div>
            )}
        </div>
    );
}
