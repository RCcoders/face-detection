"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Camera from "@/components/Camera";
import EmotionDisplay from "@/components/EmotionDisplay";
import ScanOverlay from "@/components/ScanOverlay";
import ParticleField from "@/components/ParticleField";
import EmotionThemeProvider from "@/components/EmotionThemeProvider";
import AudioPlayer from "@/components/AudioPlayer";
import EmotionCard from "@/components/EmotionCard";
import ChallengeMode from "@/components/ChallengeMode";
import FaceBoundary, { isFaceInBoundary } from "@/components/FaceBoundary";
import { detectEmotion, type DetectResult } from "@/lib/api";
import { pickJoke } from "@/lib/jokes";

/* ── State Machine ─────────────────────────────────────────────── */
type KioskState = "IDLE" | "DETECTING" | "SCANNING" | "RESULT" | "RESET";

const SCAN_DURATION = 2400;    // 2.4s scanning buffer
const RESULT_DURATION = 12000; // 12s result display
const RESET_DURATION = 3000;   // 3s reset screen
const DETECT_DELAY = 2000;     // 2s hold face steady before scanning starts

export default function KioskPage() {
  /* ── State ──────────────────────────────────────────────────── */
  const [mode, setMode] = useState<"normal" | "challenge">("normal");
  const [state, setState] = useState<KioskState>("IDLE");
  const [emotion, setEmotion] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [playAudio, setPlayAudio] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [faceInZone, setFaceInZone] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [currentJoke, setCurrentJoke] = useState<string | null>(null);
  const frameDimsRef = useRef({ w: 640, h: 480 });
  const lastFrameRef = useRef<string | null>(null);

  /* ── Refs ────────────────────────────────────────────────────── */
  const stateRef = useRef(state);
  stateRef.current = state;

  const scanStartRef = useRef(0);
  const emotionVotesRef = useRef<{ emotion: string; confidence: number }[]>([]);
  const detectTimeRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Cleanup timer ──────────────────────────────────────────── */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /* ── State transition ───────────────────────────────────────── */
  const goTo = useCallback(
    (s: KioskState) => {
      clearTimer();
      setState(s);
    },
    [clearTimer]
  );

  /* ── Reset everything ───────────────────────────────────────── */
  const fullReset = useCallback(() => {
    clearTimer();
    setEmotion(null);
    setConfidence(0);
    setScanProgress(0);
    setAudioProgress(0);
    setPlayAudio(false);
    setFaceCount(0);
    setSnapshot(null);
    setCurrentJoke(null);
    emotionVotesRef.current = [];
    goTo("IDLE");
  }, [clearTimer, goTo]);

  /* ── Majority vote ──────────────────────────────────────────── */
  const tallyVotes = useCallback(() => {
    const votes = emotionVotesRef.current;
    if (votes.length < 3) return null;

    const counts: Record<string, { count: number; totalConf: number }> = {};
    for (const v of votes) {
      if (!counts[v.emotion]) counts[v.emotion] = { count: 0, totalConf: 0 };
      counts[v.emotion].count++;
      counts[v.emotion].totalConf += v.confidence;
    }

    // Bias against Neutral: if any other emotion has significant presence (>25% of votes), pick it.
    let best = "Neutral";
    let bestScore = -1;

    for (const [em, data] of Object.entries(counts)) {
      let score = data.count;

      // Boost non-neutral emotions
      if (em !== "Neutral") {
        score *= 1.5; // weight multiplier
      }

      if (score > bestScore) {
        bestScore = score;
        best = em;
      }
    }

    return {
      emotion: best,
      confidence: counts[best].totalConf / counts[best].count,
    };
  }, []);

  /* ── Smoothing Buffer ───────────────────────────────────────── */
  const historyRef = useRef<{ emotion: string; confidence: number }[]>([]);
  const SMOOTHING_WINDOW = 6; // Number of frames to average

  /* ── Handle each frame result from the API ──────────────────── */
  const handleDetection = useCallback(
    (result: DetectResult) => {
      const s = stateRef.current;
      setFaceCount(result.face_count);

      // Check if face is inside the boundary zone
      const inZone = result.detected && result.bbox
        ? isFaceInBoundary(result.bbox, frameDimsRef.current.w, frameDimsRef.current.h)
        : false;
      setFaceInZone(inZone);

      // Treat face outside boundary as "not detected"
      const detected = result.detected && inZone;

      // ─ IDLE: wait for a face ─
      if (s === "IDLE") {
        if (detected) {
          detectTimeRef.current = Date.now();
          historyRef.current = []; // Clear history on new detection
          goTo("DETECTING");
        }
        return;
      }

      // ─ DETECTING: brief pause then start scan ─
      if (s === "DETECTING") {
        if (!detected) {
          goTo("IDLE");
          return;
        }
        if (Date.now() - detectTimeRef.current > DETECT_DELAY) {
          scanStartRef.current = Date.now();
          emotionVotesRef.current = [];
          goTo("SCANNING");
        }
        return;
      }

      // ─ SCANNING: collect votes ─
      if (s === "SCANNING") {
        if (!detected) {
          goTo("IDLE");
          return;
        }

        // Add vote
        if (result.emotion) {
          emotionVotesRef.current.push({
            emotion: result.emotion,
            confidence: result.confidence,
          });

          // --- SMOOTHING LOGIC ---
          // Add to rolling history
          historyRef.current.push({ emotion: result.emotion, confidence: result.confidence });
          if (historyRef.current.length > SMOOTHING_WINDOW) {
            historyRef.current.shift();
          }

          // Calculate smoothed result for display
          const totals: Record<string, number> = {};
          for (const item of historyRef.current) {
            totals[item.emotion] = (totals[item.emotion] || 0) + item.confidence;
          }

          let bestEm = result.emotion;
          let bestScore = -1;

          for (const [em, score] of Object.entries(totals)) {
            if (score > bestScore) {
              bestScore = score;
              bestEm = em;
            }
          }

          setEmotion(bestEm);
          // -----------------------
        }

        // Update progress
        const elapsed = Date.now() - scanStartRef.current;
        const prog = Math.min(1, elapsed / SCAN_DURATION);
        setScanProgress(prog);

        // Check if done
        if (elapsed >= SCAN_DURATION) {
          const winner = tallyVotes();
          if (winner) {
            setEmotion(winner.emotion);
            setConfidence(winner.confidence);
            setPlayAudio(true);

            // Capture snapshot for the emotion card
            if (lastFrameRef.current) {
              setSnapshot(lastFrameRef.current);
            }

            // Pick a joke for the result display
            if (winner.emotion) {
              setCurrentJoke(pickJoke(winner.emotion));
            }

            goTo("RESULT");

            // Auto-transition to RESET
            timerRef.current = setTimeout(() => {
              setPlayAudio(false);
              goTo("RESET");
              timerRef.current = setTimeout(fullReset, RESET_DURATION);
            }, RESULT_DURATION);
          } else {
            goTo("IDLE");
          }
        }
        return;
      }
    },
    [goTo, tallyVotes, fullReset]
  );

  /* ── Frame callback: send to API ────────────────────────────── */
  const onFrame = useCallback(
    async (base64: string, frameW: number, frameH: number) => {
      const s = stateRef.current;
      if (s === "RESULT" || s === "RESET") return;

      frameDimsRef.current = { w: frameW, h: frameH };
      lastFrameRef.current = base64;

      try {
        const result = await detectEmotion(base64);
        handleDetection(result);
      } catch {
        // API error — ignore
      }
    },
    [handleDetection]
  );

  /* ── Keyboard shortcuts ─────────────────────────────────────── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") fullReset();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullReset]);

  /* ── Audio Callback ────────────────────────────────────────── */
  const handleAudioEnd = useCallback(() => {
    setAudioProgress(1);
  }, []);

  /* ── Render ─────────────────────────────────────────────────── */
  if (mode === "challenge") {
    return <ChallengeMode onExit={() => setMode("normal")} />;
  }

  return (
    <div className="kiosk-container">
      {/* Camera feed */}
      <div className="camera-layer">
        <Camera
          onFrame={onFrame}
          captureInterval={state === "SCANNING" ? 180 : 300}
          active={state !== "RESULT" && state !== "RESET"}
        />
      </div>

      {/* Emotion-reactive environment */}
      <EmotionThemeProvider emotion={emotion} state={state} />

      {/* Face boundary zone */}
      <FaceBoundary state={state} />

      {/* UI Layer */}
      <div className="ui-layer">
        {/* ── IDLE ── */}
        {state === "IDLE" && (
          <div className="flex flex-col justify-between h-full py-12 md:py-20 animate-fade-in" style={{ textAlign: "center", pointerEvents: "none" }}>
            {/* Top Section */}
            <div style={{ pointerEvents: "auto" }}>
              <h1
                className="text-gradient text-3xl md:text-5xl lg:text-7xl font-[800] tracking-tighter mb-4 px-4"
              >
                EMOTION DETECTION
              </h1>
              <p
                style={{
                  fontSize: 18,
                  color: "var(--text-secondary)",
                  letterSpacing: "4px",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  opacity: 0.8
                }}
              >
                Real-Time Facial Analysis
              </p>
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col items-center gap-6" style={{ pointerEvents: "auto" }}>
              <p
                className="animate-text-glow"
                style={{
                  fontSize: 20,
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  letterSpacing: "0.5px"
                }}
              >
                Please stand in front of the camera
              </p>

              {faceCount > 1 && (
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--accent-cyan)",
                    background: "rgba(90, 220, 232, 0.1)",
                    padding: "6px 16px",
                    borderRadius: "20px",
                    border: "1px solid rgba(90, 220, 232, 0.2)"
                  }}
                >
                  👥 Multiple faces detected — stand solo for accuracy
                </p>
              )}

              {faceCount >= 1 && !faceInZone && (
                <p
                  style={{
                    fontSize: 15,
                    color: "var(--accent-amber)",
                    fontWeight: 500,
                    animation: "fade-in 0.3s ease-out"
                  }}
                >
                  Move your face into the circular zone
                </p>
              )}

            </div>
          </div>
        )}

        {/* ── Background Emojis (Highest Z-Index background layer) ── */}
        <ParticleField emotion={emotion} />

        {/* ── DETECTING ── */}
        {state === "DETECTING" && (
          <div className="absolute bottom-12 md:bottom-20 w-full animate-fade-in text-center" style={{ pointerEvents: "none" }}>
            <div
              className="w-[60px] h-[60px] rounded-full border-2 border-[var(--accent-green)] flex items-center justify-center mx-auto mb-5 bg-[rgba(106,216,122,0.1)] backdrop-blur-sm"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12l5 5L20 7"
                  stroke="var(--accent-green)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[22px] font-bold text-[var(--accent-green)] tracking-tight">
              FACE DETECTED
            </p>
          </div>
        )}

        {/* ── SCANNING ── (no UI shown, just processing silently) */}

        {/* ── RESULT ── */}
        {state === "RESULT" && emotion && (
          <div className="flex items-center justify-center">
            <div className="result-card glass-strong animate-slide-up text-center">
              <EmotionDisplay
                emotion={emotion}
                confidence={confidence}
                joke={currentJoke}
                visible
              />
            </div>
          </div>
        )}

        {/* ── RESET ── */}
        {state === "RESET" && (
          <div className="animate-fade-in text-center">
            <p className="text-3xl md:text-5xl font-bold text-[var(--accent-green)] mb-4">
              Thank You!
            </p>
            <p className="text-base text-[var(--text-secondary)]">
              Next participant, please step forward
            </p>
          </div>
        )}
      </div>

      {/* Audio Player (headless) */}
      <AudioPlayer
        emotion={emotion}
        play={playAudio}
        onProgress={setAudioProgress}
        onEnded={handleAudioEnd}
      />

      {/* HUD Bar */}
      <div className="hud-bar">
        <span>R Reset</span>
        <span>Emotion Kiosk v3.0</span>
      </div>

      {/* ── Fixed Judges Circle Button ── */}
      {mode === "normal" && (
        <button
          onClick={() => setMode("challenge")}
          title="Judges Panel"
          style={{
            position: "fixed",
            right: 24,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 200,
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "2px solid rgba(255, 184, 77, 0.6)",
            background: "rgba(255, 184, 77, 0.15)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 0 24px rgba(255,184,77,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            transition: "all 0.3s ease",
            pointerEvents: "auto",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,184,77,0.3)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-50%) scale(1.1)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,184,77,0.15)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-50%) scale(1)";
          }}
        >
          <span style={{ fontSize: 26 }}>👨‍⚖️</span>
          <span style={{ fontSize: 9, color: "var(--accent-amber)", fontWeight: 700, letterSpacing: 0.5 }}>JUDGES</span>
        </button>
      )}
    </div>
  );
}
