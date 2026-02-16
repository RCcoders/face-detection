"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Camera from "@/components/Camera";
import FaceBoundary, { isFaceInBoundary } from "@/components/FaceBoundary";
import EmotionThemeProvider from "@/components/EmotionThemeProvider";
import ParticleField from "@/components/ParticleField";
import Leaderboard, { addToLeaderboard } from "@/components/Leaderboard";
import { detectEmotion } from "@/lib/api";

/* ── Challenge config ─────────────────────────────────────────── */
const CHALLENGES = [
    { emotion: "Happy", emoji: "😊", prompt: "Show me your HAPPY face!" },
    { emotion: "Sad", emoji: "😢", prompt: "Can you look SAD?" },
    { emotion: "Stressed", emoji: "😰", prompt: "Show me STRESSED!" },
    { emotion: "Neutral", emoji: "😐", prompt: "Keep a NEUTRAL expression" },
];

const ROUND_TIME = 5000; // 5 seconds per round
const TOTAL_ROUNDS = 5;
const DETECT_INTERVAL = 300;

type GameState =
    | "READY"
    | "COUNTDOWN"
    | "CHALLENGE"
    | "SCORED"
    | "GAME_OVER"
    | "LEADERBOARD";

interface RoundResult {
    target: string;
    detected: string | null;
    score: number;
    stars: number;
    confidence: number;
    timeMs: number;
}

/* ── Star rating helper ───────────────────────────────────────── */
function getStars(score: number): number {
    if (score >= 90) return 3;
    if (score >= 60) return 2;
    if (score >= 30) return 1;
    return 0;
}

export default function ChallengeMode({ onExit }: { onExit: () => void }) {
    /* ── State ────────────────────────────────────────────── */
    const [gameState, setGameState] = useState<GameState>("READY");
    const [round, setRound] = useState(0);
    const [countdown, setCountdown] = useState(3);
    const [currentChallenge, setCurrentChallenge] = useState(CHALLENGES[0]);
    const [timeRemaining, setTimeRemaining] = useState(ROUND_TIME);
    const [results, setResults] = useState<RoundResult[]>([]);
    const [lastResult, setLastResult] = useState<RoundResult | null>(null);
    const [totalScore, setTotalScore] = useState(0);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState("");

    /* ── Refs ──────────────────────────────────────────────── */
    const gameStateRef = useRef(gameState);
    gameStateRef.current = gameState;
    const roundStartRef = useRef(0);
    const votesRef = useRef<{ emotion: string; confidence: number }[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const frameDimsRef = useRef({ w: 640, h: 480 });

    const clearTimers = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (countdownRef.current) clearTimeout(countdownRef.current);
        timerRef.current = null;
        countdownRef.current = null;
    }, []);

    /* ── Pick a random challenge ────────────────────────────── */
    const pickChallenge = useCallback(() => {
        const idx = Math.floor(Math.random() * CHALLENGES.length);
        return CHALLENGES[idx];
    }, []);

    /* ── Score a round ──────────────────────────────────────── */
    /* ── Score a round ──────────────────────────────────────── */
    const scoreRound = useCallback((roundDuration: number, targetEmotion: string) => {
        const votes = votesRef.current;
        const elapsed = Date.now() - roundStartRef.current;

        // Count votes for target emotion
        let matchCount = 0;
        let totalConf = 0;
        let bestConf = 0;

        for (const v of votes) {
            if (v.emotion === targetEmotion) {
                matchCount++;
                totalConf += v.confidence;
                bestConf = Math.max(bestConf, v.confidence);
            }
        }

        const matchRatio = votes.length > 0 ? matchCount / votes.length : 0;
        const avgConf = matchCount > 0 ? totalConf / matchCount : 0;

        // Score formula: match% * confidence * speed bonus
        const speedBonus = Math.max(0.5, 1 - elapsed / (roundDuration * 2));
        let score = Math.round(matchRatio * avgConf * 100 * speedBonus);
        score = Math.min(100, Math.max(0, score));

        const stars = getStars(score);

        const detected =
            votes.length > 0
                ? votes.reduce(
                    (acc, v) => {
                        const key = v.emotion;
                        acc[key] = (acc[key] || 0) + 1;
                        return acc;
                    },
                    {} as Record<string, number>
                )
                : {};

        const bestDetected =
            Object.entries(detected).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

        const result: RoundResult = {
            target: targetEmotion,
            detected: bestDetected,
            score,
            stars,
            confidence: avgConf,
            timeMs: elapsed,
        };

        return result;
    }, []);

    /* ── Start countdown ────────────────────────────────────── */
    const startCountdown = useCallback(() => {
        setGameState("COUNTDOWN");
        setCountdown(3);

        let count = 3;
        const tick = () => {
            count--;
            if (count <= 0) {
                // Start the challenge
                const challenge = pickChallenge();
                setCurrentChallenge(challenge);
                votesRef.current = [];
                roundStartRef.current = Date.now();

                // Dynamic Difficulty: Decrease time by 400ms per round, min 2000ms
                const currentRoundDuration = Math.max(2000, ROUND_TIME - (round * 400));
                setTimeRemaining(currentRoundDuration);

                setGameState("CHALLENGE");

                // Timer to end round
                timerRef.current = setInterval(() => {
                    const elapsed = Date.now() - roundStartRef.current;
                    const remaining = Math.max(0, currentRoundDuration - elapsed);
                    setTimeRemaining(remaining);

                    if (remaining <= 0) {
                        clearTimers();
                        const result = scoreRound(currentRoundDuration, challenge.emotion);
                        setLastResult(result);
                        setResults((prev) => [...prev, result]);
                        setTotalScore((prev) => prev + result.score);
                        setGameState("SCORED");
                    }
                }, 100);
            } else {
                setCountdown(count);
                countdownRef.current = setTimeout(tick, 1000);
            }
        };

        countdownRef.current = setTimeout(tick, 1000);
    }, [pickChallenge, clearTimers, scoreRound, round]);

    /* ── Next round or game over ────────────────────────────── */
    const nextRound = useCallback(() => {
        const nextR = round + 1;
        setRound(nextR);
        if (nextR >= TOTAL_ROUNDS) {
            // Game over
            // Save to API
            addToLeaderboard({
                name: playerName.trim() || "Anonymous",
                score: totalScore + (lastResult?.score || 0),
                rounds: TOTAL_ROUNDS,
                date: new Date().toISOString(),
            });
            setGameState("GAME_OVER");
        } else {
            startCountdown();
        }
    }, [round, totalScore, lastResult, startCountdown, playerName]);

    /* ── Start game ─────────────────────────────────────────── */
    const startGame = useCallback(() => {
        setRound(0);
        setResults([]);
        setTotalScore(0);
        setLastResult(null);
        setDetectedEmotion(null);
        startCountdown();
    }, [startCountdown]);

    /* ── Frame handler ──────────────────────────────────────── */
    const onFrame = useCallback(
        async (base64: string, frameW: number, frameH: number) => {
            if (gameStateRef.current !== "CHALLENGE") return;
            frameDimsRef.current = { w: frameW, h: frameH };

            try {
                const result = await detectEmotion(base64);
                if (result.detected && result.emotion && result.bbox) {
                    const inZone = isFaceInBoundary(result.bbox, frameW, frameH);
                    if (inZone) {
                        votesRef.current.push({
                            emotion: result.emotion,
                            confidence: result.confidence,
                        });
                        setDetectedEmotion(result.emotion);
                    }
                }
            } catch {
                // ignore
            }
        },
        []
    );

    /* ── Keyboard: ESC to exit ──────────────────────────────── */
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                clearTimers();
                onExit();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => {
            window.removeEventListener("keydown", handleKey);
            clearTimers();
        };
    }, [onExit, clearTimers]);

    /* ── Emotion color helper ───────────────────────────────── */
    const emotionColor: Record<string, string> = {
        Happy: "var(--happy)",
        Sad: "var(--sad)",
        Stressed: "var(--stressed)",
        Neutral: "var(--neutral)",
    };

    /* ── Render ─────────────────────────────────────────────── */
    return (
        <div className="kiosk-container">
            {/* Camera */}
            <div className="camera-layer">
                <Camera
                    onFrame={onFrame}
                    captureInterval={DETECT_INTERVAL}
                    active={gameState === "CHALLENGE"}
                />
            </div>

            {/* Theme */}
            <EmotionThemeProvider
                emotion={detectedEmotion}
                state={gameState === "CHALLENGE" ? "SCANNING" : "IDLE"}
            />

            <FaceBoundary state={gameState === "CHALLENGE" ? "DETECTING" : "IDLE"} />
            <ParticleField emotion={detectedEmotion} />

            {/* UI */}
            <div className="ui-layer">
                {/* ── READY ── */}
                {gameState === "READY" && !showLeaderboard && (
                    <div className="animate-fade-in" style={{ textAlign: "center" }}>
                        <p style={{ fontSize: 48, marginBottom: 8 }}>🎭</p>
                        <h1
                            className="text-gradient"
                            style={{
                                fontSize: 42,
                                fontWeight: 800,
                                letterSpacing: -1,
                                marginBottom: 8,
                            }}
                        >
                            EMOTION CHALLENGE
                        </h1>
                        <p
                            style={{
                                fontSize: 15,
                                color: "var(--text-secondary)",
                                marginBottom: 32,
                            }}
                        >
                            Match the target expression to score points!
                        </p>

                        <div
                            style={{
                                display: "flex",
                                gap: 12,
                                justifyContent: "center",
                                marginBottom: 16,
                            }}
                        >
                            {CHALLENGES.map((c) => (
                                <div
                                    key={c.emotion}
                                    style={{
                                        padding: "12px 16px",
                                        borderRadius: 12,
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                        textAlign: "center",
                                    }}
                                >
                                    <span style={{ fontSize: 28 }}>{c.emoji}</span>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--text-dim)",
                                            marginTop: 4,
                                        }}
                                    >
                                        {c.emotion}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <p
                            style={{
                                fontSize: 13,
                                color: "var(--text-dim)",
                                marginBottom: 24,
                            }}
                        >
                            {TOTAL_ROUNDS} rounds • {ROUND_TIME / 1000}s each
                        </p>

                        <div style={{ marginBottom: 32 }}>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                style={{
                                    padding: "12px 20px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    background: "rgba(0,0,0,0.4)",
                                    color: "white",
                                    fontSize: 16,
                                    textAlign: "center",
                                    width: 240,
                                    outline: "none",
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                            <button
                                onClick={startGame}
                                className="challenge-btn-primary"
                                style={{
                                    padding: "14px 40px",
                                    borderRadius: 12,
                                    border: "1px solid var(--accent-green)",
                                    background: "rgba(106,216,122,0.15)",
                                    color: "var(--accent-green)",
                                    fontSize: 16,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    pointerEvents: "auto",
                                    transition: "all 0.3s",
                                }}
                            >
                                ▶ Start Game
                            </button>

                            <button
                                onClick={() => setShowLeaderboard(true)}
                                style={{
                                    padding: "14px 24px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,184,77,0.3)",
                                    background: "rgba(255,184,77,0.08)",
                                    color: "var(--accent-amber)",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    pointerEvents: "auto",
                                }}
                            >
                                🏆 Leaderboard
                            </button>

                            <button
                                onClick={onExit}
                                style={{
                                    padding: "14px 24px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    background: "rgba(255,255,255,0.04)",
                                    color: "var(--text-secondary)",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    pointerEvents: "auto",
                                }}
                            >
                                ← Back
                            </button>
                        </div>
                    </div>
                )}

                {/* ── LEADERBOARD overlay ── */}
                {showLeaderboard && (
                    <Leaderboard
                        visible
                        onClose={() => setShowLeaderboard(false)}
                    />
                )}

                {/* ── COUNTDOWN ── */}
                {gameState === "COUNTDOWN" && (
                    <div className="animate-fade-in" style={{ textAlign: "center" }}>
                        <p
                            style={{
                                fontSize: 14,
                                color: "var(--text-secondary)",
                                marginBottom: 12,
                                letterSpacing: 2,
                                textTransform: "uppercase",
                            }}
                        >
                            Get Ready
                        </p>
                        <p
                            className="countdown-number"
                            style={{
                                fontSize: 120,
                                fontWeight: 800,
                                color: "var(--accent-cyan)",
                                lineHeight: 1,
                                textShadow: "0 0 60px rgba(90,220,232,0.4)",
                            }}
                        >
                            {countdown}
                        </p>
                    </div>
                )}

                {/* ── CHALLENGE (active round) ── */}
                {gameState === "CHALLENGE" && (
                    <div style={{ textAlign: "center", width: "100%" }}>
                        {/* Round indicator */}
                        <div
                            style={{
                                position: "absolute",
                                top: 20,
                                left: "50%",
                                transform: "translateX(-50%)",
                                display: "flex",
                                gap: 8,
                                pointerEvents: "none",
                            }}
                        >
                            {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        background:
                                            i < round
                                                ? "var(--accent-green)"
                                                : i === round
                                                    ? "var(--accent-amber)"
                                                    : "rgba(255,255,255,0.1)",
                                        transition: "background 0.3s",
                                    }}
                                />
                            ))}
                        </div>

                        {/* Target emotion prompt */}
                        <div className="animate-slide-up">
                            <p
                                style={{
                                    fontSize: 60,
                                    marginBottom: 8,
                                }}
                            >
                                {currentChallenge.emoji}
                            </p>
                            <p
                                style={{
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: emotionColor[currentChallenge.emotion] || "var(--text-primary)",
                                    marginBottom: 8,
                                    textShadow: `0 0 30px ${emotionColor[currentChallenge.emotion]}55`,
                                }}
                            >
                                {currentChallenge.prompt}
                            </p>

                            {/* Timer bar */}
                            <div
                                className="progress-track"
                                style={{ width: 280, margin: "20px auto 0" }}
                            >
                                <div
                                    className="progress-fill"
                                    style={{
                                        width: `${(timeRemaining / ROUND_TIME) * 100}%`,
                                        background:
                                            timeRemaining > ROUND_TIME * 0.3
                                                ? "var(--accent-green)"
                                                : "var(--accent-red)",
                                        transition: "width 0.1s linear, background 0.3s",
                                    }}
                                />
                            </div>
                            <p
                                style={{
                                    fontSize: 16,
                                    color: "var(--text-secondary)",
                                    marginTop: 8,
                                }}
                            >
                                {(timeRemaining / 1000).toFixed(1)}s
                            </p>

                            {/* Live detection feedback */}
                            {detectedEmotion && (
                                <p
                                    style={{
                                        marginTop: 16,
                                        fontSize: 14,
                                        color:
                                            detectedEmotion === currentChallenge.emotion
                                                ? "var(--accent-green)"
                                                : "var(--accent-red)",
                                    }}
                                >
                                    Detecting:{" "}
                                    <strong>
                                        {detectedEmotion}{" "}
                                        {detectedEmotion === currentChallenge.emotion ? "✓" : "✗"}
                                    </strong>
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── SCORED (after each round) ── */}
                {gameState === "SCORED" && lastResult && (
                    <div className="animate-slide-up" style={{ textAlign: "center" }}>
                        <p style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 8 }}>
                            Round {round + 1} of {TOTAL_ROUNDS}
                        </p>

                        {/* Stars */}
                        <p style={{ fontSize: 42, marginBottom: 8 }}>
                            {Array.from({ length: 3 }, (_, i) => (
                                <span
                                    key={i}
                                    style={{
                                        opacity: i < lastResult.stars ? 1 : 0.2,
                                        filter: i < lastResult.stars ? "none" : "grayscale(1)",
                                        transition: `opacity 0.3s ease ${i * 0.15}s`,
                                    }}
                                >
                                    ⭐
                                </span>
                            ))}
                        </p>

                        {/* Score */}
                        <p
                            style={{
                                fontSize: 56,
                                fontWeight: 800,
                                color:
                                    lastResult.score >= 60
                                        ? "var(--accent-green)"
                                        : lastResult.score >= 30
                                            ? "var(--accent-amber)"
                                            : "var(--accent-red)",
                                lineHeight: 1,
                                marginBottom: 4,
                            }}
                        >
                            {lastResult.score}
                        </p>
                        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
                            points
                        </p>

                        {/* Details */}
                        <div
                            style={{
                                display: "flex",
                                gap: 24,
                                justifyContent: "center",
                                marginBottom: 24,
                                fontSize: 13,
                                color: "var(--text-dim)",
                            }}
                        >
                            <span>
                                Target:{" "}
                                <strong style={{ color: emotionColor[lastResult.target] }}>
                                    {lastResult.target}
                                </strong>
                            </span>
                            <span>
                                Detected:{" "}
                                <strong
                                    style={{
                                        color: lastResult.detected === lastResult.target
                                            ? "var(--accent-green)"
                                            : "var(--accent-red)",
                                    }}
                                >
                                    {lastResult.detected || "None"}
                                </strong>
                            </span>
                        </div>

                        <button
                            onClick={nextRound}
                            style={{
                                padding: "12px 36px",
                                borderRadius: 10,
                                border: "1px solid var(--accent-cyan)",
                                background: "rgba(90,220,232,0.12)",
                                color: "var(--accent-cyan)",
                                fontSize: 15,
                                fontWeight: 600,
                                cursor: "pointer",
                                pointerEvents: "auto",
                            }}
                        >
                            {round + 1 >= TOTAL_ROUNDS ? "See Results →" : "Next Round →"}
                        </button>
                    </div>
                )}

                {/* ── GAME OVER ── */}
                {gameState === "GAME_OVER" && (
                    <div className="animate-slide-up" style={{ textAlign: "center" }}>
                        <p style={{ fontSize: 48, marginBottom: 8 }}>🎉</p>
                        <h2
                            style={{
                                fontSize: 36,
                                fontWeight: 800,
                                color: "var(--accent-amber)",
                                marginBottom: 4,
                            }}
                        >
                            Game Over!
                        </h2>

                        <p
                            style={{
                                fontSize: 64,
                                fontWeight: 800,
                                color: "var(--text-primary)",
                                lineHeight: 1.1,
                                marginBottom: 4,
                            }}
                        >
                            {totalScore}
                        </p>
                        <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 24 }}>
                            Total Points
                        </p>

                        {/* Round breakdown */}
                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                justifyContent: "center",
                                marginBottom: 28,
                            }}
                        >
                            {results.map((r, i) => (
                                <div
                                    key={i}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                        textAlign: "center",
                                        minWidth: 50,
                                    }}
                                >
                                    <p style={{ fontSize: 11, color: "var(--text-dim)" }}>R{i + 1}</p>
                                    <p
                                        style={{
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color:
                                                r.score >= 60
                                                    ? "var(--accent-green)"
                                                    : r.score >= 30
                                                        ? "var(--accent-amber)"
                                                        : "var(--accent-red)",
                                        }}
                                    >
                                        {r.score}
                                    </p>
                                    <p style={{ fontSize: 12 }}>
                                        {"⭐".repeat(r.stars)}{"☆".repeat(3 - r.stars)}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                            <button
                                onClick={startGame}
                                style={{
                                    padding: "12px 32px",
                                    borderRadius: 10,
                                    border: "1px solid var(--accent-green)",
                                    background: "rgba(106,216,122,0.12)",
                                    color: "var(--accent-green)",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    pointerEvents: "auto",
                                }}
                            >
                                🔄 Play Again
                            </button>
                            <button
                                onClick={() => setShowLeaderboard(true)}
                                style={{
                                    padding: "12px 24px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,184,77,0.3)",
                                    background: "rgba(255,184,77,0.08)",
                                    color: "var(--accent-amber)",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    pointerEvents: "auto",
                                }}
                            >
                                🏆 Leaderboard
                            </button>
                            <button
                                onClick={onExit}
                                style={{
                                    padding: "12px 24px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    background: "rgba(255,255,255,0.04)",
                                    color: "var(--text-secondary)",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    pointerEvents: "auto",
                                }}
                            >
                                ← Exit
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* HUD */}
            <div className="hud-bar">
                <span>ESC Exit</span>
                <span>Challenge Mode</span>
                <span>
                    Score: {totalScore} | Round {Math.min(round + 1, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}
                </span>
            </div>
        </div>
    );
}
