"use client";

import { useEffect, useState } from "react";

/* ── Emotion Theme Configs ────────────────────────────────────── */
const EMOTION_THEMES: Record<
    string,
    {
        gradient: string;
        ambientColor: string;
        glowOpacity: number;
        pulseSpeed: string;
    }
> = {
    Happy: {
        gradient:
            "radial-gradient(ellipse at 50% 40%, rgba(255,180,40,0.18) 0%, rgba(255,120,20,0.08) 40%, transparent 70%)",
        ambientColor: "rgba(255,199,83,0.12)",
        glowOpacity: 0.25,
        pulseSpeed: "3s",
    },
    Sad: {
        gradient:
            "radial-gradient(ellipse at 50% 40%, rgba(60,120,220,0.18) 0%, rgba(40,60,160,0.08) 40%, transparent 70%)",
        ambientColor: "rgba(96,168,232,0.12)",
        glowOpacity: 0.2,
        pulseSpeed: "5s",
    },
    Stressed: {
        gradient:
            "radial-gradient(ellipse at 50% 40%, rgba(232,80,80,0.2) 0%, rgba(180,40,40,0.1) 40%, transparent 70%)",
        ambientColor: "rgba(232,112,112,0.15)",
        glowOpacity: 0.3,
        pulseSpeed: "1.8s",
    },
    Neutral: {
        gradient:
            "radial-gradient(ellipse at 50% 40%, rgba(90,220,232,0.12) 0%, rgba(60,140,180,0.06) 40%, transparent 70%)",
        ambientColor: "rgba(90,220,232,0.08)",
        glowOpacity: 0.15,
        pulseSpeed: "4s",
    },
};

const IDLE_THEME = {
    gradient:
        "radial-gradient(ellipse at 50% 40%, rgba(90,220,232,0.06) 0%, rgba(30,30,60,0.03) 40%, transparent 70%)",
    ambientColor: "rgba(90,220,232,0.04)",
    glowOpacity: 0.1,
    pulseSpeed: "6s",
};

interface EmotionThemeProviderProps {
    emotion: string | null;
    state: string;
}

export default function EmotionThemeProvider({
    emotion,
    state,
}: EmotionThemeProviderProps) {
    const [theme, setTheme] = useState(IDLE_THEME);

    useEffect(() => {
        if (state === "RESULT" && emotion && EMOTION_THEMES[emotion]) {
            setTheme(EMOTION_THEMES[emotion]);
        } else if (state === "SCANNING" && emotion && EMOTION_THEMES[emotion]) {
            // During scanning, start to subtly shift
            const scanTheme = { ...EMOTION_THEMES[emotion] };
            scanTheme.glowOpacity *= 0.5;
            setTheme(scanTheme);
        } else {
            setTheme(IDLE_THEME);
        }
    }, [emotion, state]);

    return (
        <>
            {/* Primary gradient overlay */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1,
                    background: theme.gradient,
                    transition: "background 1.2s ease-in-out",
                    pointerEvents: "none",
                }}
            />

            {/* Ambient glow orbs */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1,
                    pointerEvents: "none",
                    overflow: "hidden",
                }}
            >
                {/* Top-left orb */}
                <div
                    className="ambient-orb"
                    style={{
                        position: "absolute",
                        top: "-10%",
                        left: "-5%",
                        width: "50vw",
                        height: "50vh",
                        borderRadius: "50%",
                        background: theme.ambientColor,
                        filter: "blur(80px)",
                        opacity: theme.glowOpacity,
                        transition: "all 1.2s ease-in-out",
                        animationName: "ambient-pulse",
                        animationDuration: theme.pulseSpeed,
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                    }}
                />

                {/* Bottom-right orb */}
                <div
                    className="ambient-orb"
                    style={{
                        position: "absolute",
                        bottom: "-15%",
                        right: "-10%",
                        width: "45vw",
                        height: "45vh",
                        borderRadius: "50%",
                        background: theme.ambientColor,
                        filter: "blur(100px)",
                        opacity: theme.glowOpacity * 0.7,
                        transition: "all 1.2s ease-in-out",
                        animationName: "ambient-pulse",
                        animationDuration: theme.pulseSpeed,
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                        animationDelay: "-1.5s",
                    }}
                />

                {/* Center accent for RESULT state */}
                {state === "RESULT" && (
                    <div
                        className="animate-fade-in"
                        style={{
                            position: "absolute",
                            top: "30%",
                            left: "30%",
                            width: "40vw",
                            height: "40vh",
                            borderRadius: "50%",
                            background: theme.ambientColor,
                            filter: "blur(120px)",
                            opacity: theme.glowOpacity * 1.2,
                            animationName: "ambient-pulse",
                            animationDuration: theme.pulseSpeed,
                            animationTimingFunction: "ease-in-out",
                            animationIterationCount: "infinite",
                        }}
                    />
                )}
            </div>

            {/* Vignette overlay (always present, darkens edges) */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 2,
                    background:
                        "radial-gradient(ellipse at center, transparent 40%, rgba(6,6,12,0.6) 100%)",
                    pointerEvents: "none",
                }}
            />
        </>
    );
}
