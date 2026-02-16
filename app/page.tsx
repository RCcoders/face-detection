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

/* ── State Machine ─────────────────────────────────────────────── */
type KioskState = "IDLE" | "DETECTING" | "SCANNING" | "RESULT" | "RESET";

const SCAN_DURATION = 3000;    // 3s scanning buffer
const RESULT_DURATION = 12000; // 12s result display
const RESET_DURATION = 3000;   // 3s reset screen
const DETECT_DELAY = 800;      // 0.8s before scanning starts

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
          captureInterval={state === "SCANNING" ? 250 : 400}
          active={state !== "RESULT" && state !== "RESET"}
        />
      </div>

      {/* Emotion-reactive environment */}
      <EmotionThemeProvider emotion={emotion} state={state} />

      {/* Face boundary zone */}
      <FaceBoundary state={state} />

      {/* Particles (always visible, emotion-reactive) */}
      <ParticleField emotion={emotion} />

      {/* UI Layer */}
      <div className="ui-layer">
        {/* ── IDLE ── */}
        {state === "IDLE" && (
          <div className="animate-fade-in" style={{ textAlign: "center" }}>
            <h1
              className="text-gradient text-4xl md:text-5xl lg:text-6xl"
              style={{
                fontWeight: 800,
                letterSpacing: -1,
                marginBottom: 8,
              }}
            >
              EMOTION DETECTION
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-secondary)",
                marginBottom: 40,
              }}
            >
              Real-Time Facial Analysis
            </p>

            {/* Divider */}
            <div
              style={{
                width: 200,
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                margin: "0 auto 40px",
              }}
            />

            {/* Scan ring */}
            <div
              style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}
            >
              <div className="scan-ring-outer animate-pulse-ring">
                <div className="scan-ring-inner">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <ellipse
                      cx="12"
                      cy="10"
                      rx="5"
                      ry="6.5"
                      stroke="var(--accent-cyan)"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                      stroke="var(--accent-cyan)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <p
              className="animate-text-glow"
              style={{
                fontSize: 18,
                color: "var(--text-primary)",
                opacity: 0.8,
              }}
            >
              Please stand in front of the camera
            </p>

            {faceCount > 1 && (
              <p
                style={{
                  fontSize: 14,
                  color: "var(--accent-cyan)",
                  marginTop: 16,
                }}
              >
                👥 Multiple faces detected — step closer for best results
              </p>
            )}
            {faceCount >= 1 && !faceInZone && (
              <p
                style={{
                  fontSize: 14,
                  color: "var(--accent-amber)",
                  marginTop: 16,
                }}
              >
                ↕ Move your face into the oval zone
              </p>
            )}

            {/* Challenge Mode button */}
            <button
              onClick={() => setMode("challenge")}
              style={{
                marginTop: 32,
                padding: "10px 24px",
                borderRadius: 10,
                border: "1px solid rgba(176,112,232,0.3)",
                background: "rgba(176,112,232,0.1)",
                color: "var(--accent-purple)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                margin: "32px auto 0",
              }}
            >
              🎭 Challenge Mode
            </button>
          </div>
        )}

        {/* ── DETECTING ── */}
        {state === "DETECTING" && (
          <div className="animate-fade-in" style={{ textAlign: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: "2px solid var(--accent-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
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
            <p
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "var(--accent-green)",
              }}
            >
              Face Detected
            </p>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginTop: 8,
              }}
            >
              Hold still — scanning begins shortly
            </p>
          </div>
        )}

        {/* ── SCANNING ── */}
        {state === "SCANNING" && (
          <ScanOverlay progress={scanProgress} visible />
        )}

        {/* ── RESULT ── */}
        {state === "RESULT" && emotion && (
          <div
            style={{
              display: "flex",
              gap: 32,
              alignItems: "flex-start",
              justifyContent: "center",
              flexWrap: "wrap",
              maxWidth: "90vw",
            }}
          >
            {/* Left: Emotion result + audio */}
            <div style={{ textAlign: "center" }}>
              <div className="result-card glass-strong animate-slide-up">
                <EmotionDisplay
                  emotion={emotion}
                  confidence={confidence}
                  visible
                />

                {/* Audio progress */}
                <div style={{ marginTop: 30 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--accent-amber)",
                      marginBottom: 8,
                    }}
                  >
                    ♪ Playing audio feedback
                  </p>
                  <div className="progress-track" style={{ width: 240, margin: "0 auto" }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${audioProgress * 100}%`,
                        background: "var(--accent-amber)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Shareable card */}
            <EmotionCard
              snapshot={snapshot}
              emotion={emotion}
              confidence={confidence}
              visible
            />
          </div>
        )}

        {/* ── RESET ── */}
        {state === "RESET" && (
          <div className="animate-fade-in" style={{ textAlign: "center" }}>
            <p
              className="text-3xl md:text-5xl"
              style={{
                fontWeight: 700,
                color: "var(--accent-green)",
                marginBottom: 16,
              }}
            >
              Thank You!
            </p>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-secondary)",
              }}
            >
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
    </div>
  );
}
