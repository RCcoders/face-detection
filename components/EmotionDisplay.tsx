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
    visible: boolean;
}

export default function EmotionDisplay({
    emotion,
    confidence,
    visible,
}: EmotionDisplayProps) {
    const config = useMemo(
        () => EMOTION_CONFIG[emotion] || EMOTION_CONFIG.Neutral,
        [emotion]
    );

    if (!visible) return null;

    return (
        <div className="animate-slide-up" style={{ textAlign: "center" }}>
            {/* Label */}
            <p
                style={{
                    fontSize: 14,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                }}
            >
                Emotion Detected
            </p>

            {/* Divider */}
            <div
                style={{
                    width: 120,
                    height: 1,
                    background: "rgba(255,255,255,0.1)",
                    margin: "0 auto 20px",
                }}
            />

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
            <p
                style={{
                    fontSize: 16,
                    color: "var(--text-secondary)",
                    marginTop: 8,
                }}
            >
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
        </div>
    );
}
