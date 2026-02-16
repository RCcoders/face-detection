"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ── Leaderboard types ────────────────────────────────────────── */
export interface LeaderboardEntry {
    name: string;
    score: number;
    rounds: number;
    date: string;
}

const API_URL = "http://localhost:8000/api/leaderboard";

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

export async function addToLeaderboard(entry: LeaderboardEntry) {
    try {
        await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
        });
    } catch (e) {
        console.error("Failed to save score", e);
    }
}

/* ── Leaderboard UI ───────────────────────────────────────────── */
interface LeaderboardProps {
    visible: boolean;
    onClose: () => void;
}

export default function Leaderboard({ visible, onClose }: LeaderboardProps) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        if (visible) {
            getLeaderboard().then(setEntries);
        }
    }, [visible]);

    if (!visible) return null;

    const medals = ["🥇", "🥈", "🥉"];

    return (
        <div
            className="animate-slide-up"
            style={{
                background: "var(--bg-card)",
                backdropFilter: "blur(32px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "var(--radius)",
                padding: "32px 40px",
                minWidth: 360,
                maxWidth: 440,
                textAlign: "center",
                pointerEvents: "auto",
                maxHeight: "80vh",
                overflowY: "auto",
            }}
        >
            <h2
                style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "var(--accent-amber)",
                    marginBottom: 4,
                }}
            >
                🏆 Leaderboard
            </h2>
            <p
                style={{
                    fontSize: 13,
                    color: "var(--text-dim)",
                    marginBottom: 20,
                }}
            >
                Top expression masters
            </p>

            {entries.length === 0 ? (
                <p style={{ fontSize: 14, color: "var(--text-secondary)", padding: "20px 0" }}>
                    No scores yet. Be the first!
                </p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {entries.map((e, i) => (
                        <div
                            key={i}
                            className="animate-fade-in"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 16px",
                                borderRadius: 8,
                                background:
                                    i === 0
                                        ? "rgba(255,199,83,0.1)"
                                        : i === 1
                                            ? "rgba(192,192,192,0.08)"
                                            : i === 2
                                                ? "rgba(205,127,50,0.08)"
                                                : "rgba(255,255,255,0.03)",
                                border: `1px solid ${i < 3 ? "rgba(255,199,83,0.15)" : "rgba(255,255,255,0.04)"
                                    }`,
                                animationDelay: `${i * 0.08}s`,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: i < 3 ? 20 : 14,
                                    width: 32,
                                    textAlign: "center",
                                }}
                            >
                                {i < 3 ? medals[i] : `#${i + 1}`}
                            </span>

                            {/* Name & Date */}
                            <div style={{ flex: 1, textAlign: "left", paddingLeft: 12 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                                    {e.name || "Anonymous"}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                                    {new Date(e.date).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </div>
                            </div>

                            <span
                                style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: i === 0 ? "var(--accent-amber)" : "var(--text-primary)",
                                    textAlign: "right",
                                }}
                            >
                                {e.score}
                                <span
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 400,
                                        color: "var(--text-dim)",
                                        marginLeft: 4,
                                    }}
                                >
                                    pts
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={onClose}
                style={{
                    marginTop: 20,
                    padding: "8px 24px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                }}
            >
                Close
            </button>
        </div>
    );
}
