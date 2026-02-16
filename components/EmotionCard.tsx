"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import QRCode from "qrcode";

/* ── Emotion configs  ─────────────────────────────────────────── */
const EMOTION_STYLE: Record<
    string,
    { emoji: string; color: string; bgGradient: string }
> = {
    Happy: {
        emoji: "😊",
        color: "#ffc753",
        bgGradient: "linear-gradient(135deg, #2d1f00, #1a1400)",
    },
    Sad: {
        emoji: "😢",
        color: "#60a8e8",
        bgGradient: "linear-gradient(135deg, #0a1a2d, #0d1520)",
    },
    Stressed: {
        emoji: "😰",
        color: "#e87070",
        bgGradient: "linear-gradient(135deg, #2d0a0a, #1a0d0d)",
    },
    Neutral: {
        emoji: "😐",
        color: "#5adce8",
        bgGradient: "linear-gradient(135deg, #0a2024, #0d1518)",
    },
    Surprised: {
        emoji: "😲",
        color: "#d485ff",
        bgGradient: "linear-gradient(135deg, #2a0a2d, #1a051d)",
    },
    Angry: {
        emoji: "😠",
        color: "#ff5252",
        bgGradient: "linear-gradient(135deg, #2d0505, #1a0202)",
    },
};

/* ── Emotion jokes/lines (Indian college + tech-event vibes) ──── */
const EMOTION_JOKES: Record<string, string[]> = {
    Happy: [
        "Who hurt you? Because it clearly wasn't today.",
        "That smile looks suspicious. Did something actually go right?",
        "You look like life finally replied to your 'it is what it is'.",
        "Happiness detected. Screenshot this moment.",
        "You look like you just survived an exam you didn't study for.",
        "That face says 'I'm winning', even if you're not.",
        "Someone's serotonin showed up for work today.",
        "You look like your playlist just hit the perfect song.",
        "Careful — this much happiness might confuse your friends.",
        "Enjoy this mood. It has limited availability.",
    ],
    Sad: [
        "You look like life said 'character development' and meant it.",
        "It's okay to be sad. Everyone's villain arc starts somewhere.",
        "Your face says 'I laughed today, but not sincerely'.",
        "Sad detected. Happens when expectations meet reality.",
        "You look like you're tired, not sad — which is worse.",
        "It's fine. Even legends have low stats sometimes.",
        "This is not rock bottom. There's Wi-Fi here.",
        "You look like you need sleep, food, and less responsibility.",
        "Sadness detected. Don't worry, it usually leaves without notice.",
        "You're allowed to feel like this. Society is exhausting.",
    ],
    Stressed: [
        "You look like your brain has 47 tabs open and music playing from one you can't find.",
        "Stress detected. Congratulations, you're officially an adult now.",
        "You look calm… in the same way a computer looks calm before crashing.",
        "Relax. Whatever you're stressed about will still be there tomorrow.",
        "Your face says 'I need sleep', your schedule says 'absolutely not'.",
        "Stress level high. Motivation level missing.",
        "You're not stressed — you're just aggressively overthinking.",
        "It's okay. Even Google doesn't have all the answers.",
        "Your brain is running on low battery and vibes.",
        "You look like you said 'I'll do it later' and now it's later.",
    ],
    Neutral: [
        "Emotion detected: 'I'm just here'.",
        "Ah yes. The 'nothing's wrong but everything's annoying' face.",
        "You look like you're emotionally buffering.",
        "Neutral detected. Personality loading…",
        "That face says 'I didn't sleep but I showed up'.",
        "You look like life is happening to you.",
        "Mood status: alive, unfortunately.",
        "Emotion level: functioning member of society.",
        "You look like you replied 'ok' but meant 12 things.",
        "Just existing. No free trial included.",
    ],
    Surprised: [
        "You look like the code actually worked on the first try.",
        "That face when the deadline is today, not tomorrow.",
        "You look like you just saw your screen time report.",
        "Surprise detected. Did someone actually reply to your email?",
        "You look like you just found money in an old jeans pocket.",
        "That expression says 'I wasn't ready for this plot twist'.",
        "Shock detected. Did the WiFi just connect automatically?",
        "You look like you just realized it's Monday effectively.",
        "That face when the bug was a missing semicolon.",
        "You look like you just heard your own voice recording.",
    ],
    Angry: [
        "Who touched your code? I just want to talk.",
        "You look like a merge conflict waiting to happen.",
        "That face says 'it works on my machine' but it didn't.",
        "Anger detected. Do you need a hug or a punching bag?",
        "You look like you just read the comments section.",
        "Resting rage face detected. Proceed with caution.",
        "You look like 404 Error: Patience Not Found.",
        "That expression says 'I am one minor inconvenience away from snapping'.",
        "You look like someone who just stepped on a wet floor in socks.",
        "Anger loading... Please wait or run away.",
    ],
};

/* ── No-repeat joke picker ────────────────────────────────────── */
const usedJokes: Record<string, Set<number>> = {};

function pickJoke(emotion: string): string {
    const jokes = EMOTION_JOKES[emotion] || EMOTION_JOKES.Neutral;
    const key = emotion;

    if (!usedJokes[key]) usedJokes[key] = new Set();

    // Reset if all jokes have been used
    if (usedJokes[key].size >= jokes.length) {
        usedJokes[key].clear();
    }

    // Pick a random unused index
    let idx: number;
    do {
        idx = Math.floor(Math.random() * jokes.length);
    } while (usedJokes[key].has(idx));

    usedJokes[key].add(idx);
    return jokes[idx];
}

/* ── Real QR code generator using qrcode library ─────────────── */
async function generateQRCanvas(text: string, size: number): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    await QRCode.toCanvas(canvas, text, {
        width: size,
        margin: 1,
        color: {
            dark: "#000000",
            light: "#ffffff",
        },
        errorCorrectionLevel: "M",
    });
    return canvas;
}

/* ── Card canvas renderer ─────────────────────────────────────── */
function renderCardToCanvas(
    cardCanvas: HTMLCanvasElement,
    snapshot: string,
    emotion: string,
    confidence: number,
    config: { emoji: string; color: string },
    joke: string
): Promise<void> {
    return new Promise((resolve) => {
        const W = 600;
        const H = 1080;
        cardCanvas.width = W;
        cardCanvas.height = H;
        const ctx = cardCanvas.getContext("2d")!;

        // Background
        ctx.fillStyle = "#0a0a14";
        ctx.fillRect(0, 0, W, H);

        // Border glow
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = config.color;
        ctx.shadowBlur = 20;
        ctx.strokeRect(16, 16, W - 32, H - 32);
        ctx.shadowBlur = 0;

        // Inner border
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.strokeRect(24, 24, W - 48, H - 48);

        // Load snapshot image
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
            // Snapshot area (top)
            const imgY = 40;
            const imgW = W - 80;
            const imgH = 340;

            // Clip rounded rect
            ctx.save();
            ctx.beginPath();
            const r = 12;
            ctx.moveTo(40 + r, imgY);
            ctx.lineTo(40 + imgW - r, imgY);
            ctx.quadraticCurveTo(40 + imgW, imgY, 40 + imgW, imgY + r);
            ctx.lineTo(40 + imgW, imgY + imgH - r);
            ctx.quadraticCurveTo(40 + imgW, imgY + imgH, 40 + imgW - r, imgY + imgH);
            ctx.lineTo(40 + r, imgY + imgH);
            ctx.quadraticCurveTo(40, imgY + imgH, 40, imgY + imgH - r);
            ctx.lineTo(40, imgY + r);
            ctx.quadraticCurveTo(40, imgY, 40 + r, imgY);
            ctx.closePath();
            ctx.clip();

            // Draw image (cover fit, mirrored)
            const scale = Math.max(imgW / img.width, imgH / img.height);
            const scaledW = img.width * scale;
            const scaledH = img.height * scale;

            const offsetX = (imgW - scaledW) / 2;
            const offsetY = (imgH - scaledH) / 2;

            ctx.translate(40 + imgW, imgY);
            ctx.scale(-1, 1);

            ctx.drawImage(
                img,
                0, 0, img.width, img.height,
                offsetX, offsetY, scaledW, scaledH
            );
            ctx.restore();

            // Divider line
            const divY = imgY + imgH + 20;
            const grad = ctx.createLinearGradient(80, divY, W - 80, divY);
            grad.addColorStop(0, "transparent");
            grad.addColorStop(0.5, "rgba(255,255,255,0.15)");
            grad.addColorStop(1, "transparent");
            ctx.fillStyle = grad;
            ctx.fillRect(80, divY, W - 160, 1);

            // Emoji
            ctx.font = "56px serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(config.emoji, W / 2, divY + 70);

            // Emotion name
            ctx.font = "bold 42px Inter, system-ui, sans-serif";
            ctx.fillStyle = config.color;
            ctx.shadowColor = config.color;
            ctx.shadowBlur = 30;
            ctx.textBaseline = "middle";
            ctx.fillText(emotion.toUpperCase(), W / 2, divY + 125);
            ctx.shadowBlur = 0;

            // Confidence
            ctx.font = "16px Inter, system-ui, sans-serif";
            ctx.fillStyle = "#8a8a9a";
            ctx.textBaseline = "middle";
            ctx.fillText(
                `Confidence: ${Math.round(confidence * 100)}%`,
                W / 2,
                divY + 158
            );

            // Confidence bar
            const barW = 200;
            const barH = 4;
            const barX = (W - barW) / 2;
            const barY = divY + 170;
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = config.color;
            ctx.fillRect(barX, barY, barW * confidence, barH);

            // Joke / fun line - FIXED TEXT RENDERING
            ctx.font = "600 22px Inter, system-ui, sans-serif";
            ctx.fillStyle = "#e0e0ee";
            ctx.textBaseline = "middle";

            // Clean word-wrap into lines
            const maxTextW = W - 100; // Add more padding
            const jokeWords = joke.split(" ");
            const jokeLines: string[] = [];
            let currentLine = "";

            for (const word of jokeWords) {
                const test = currentLine + (currentLine ? " " : "") + word;
                const testWidth = ctx.measureText(test).width;

                if (testWidth > maxTextW && currentLine) {
                    jokeLines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = test;
                }
            }
            if (currentLine) jokeLines.push(currentLine);

            // Draw centered joke lines with proper spacing
            let jokeY = barY + 60;
            const lineHeight = 32;

            for (const line of jokeLines) {
                ctx.fillText(line, W / 2, jokeY);
                jokeY += lineHeight;
            }

            // Low confidence quip
            let nextSectionY = jokeY + 15;
            if (confidence < 0.4) {
                ctx.font = "22px Inter, system-ui, sans-serif";
                ctx.fillStyle = "#ff9940";
                ctx.textBaseline = "middle";
                ctx.fillText("🤔 Hmm, that's a tricky one!", W / 2, nextSectionY);
                nextSectionY += 40;
            }

            // QR code
            const qrSize = 200;
            const qrTop = nextSectionY + 10;
            const qrCanvas = await generateQRCanvas(`emotion-kiosk:${emotion}:${Date.now()}`, qrSize);
            ctx.drawImage(qrCanvas, W / 2 - qrSize / 2, qrTop);

            // Scan me label
            ctx.font = "14px Inter, system-ui, sans-serif";
            ctx.fillStyle = "#55556a";
            ctx.textBaseline = "middle";
            ctx.fillText("Scan to share", W / 2, qrTop + qrSize + 20);

            // Timestamp
            const time = new Date().toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit",
            });
            ctx.font = "12px Inter, system-ui, sans-serif";
            ctx.fillStyle = "#55556a";
            ctx.textBaseline = "middle";
            ctx.fillText(time, W / 2, H - 50);

            // Branding
            ctx.font = "bold 13px Inter, system-ui, sans-serif";
            ctx.fillStyle = "#3a3a4a";
            ctx.textBaseline = "middle";
            ctx.fillText("EMOTION KIOSK", W / 2, H - 30);

            resolve();
        };
        img.src = snapshot;
    });
}

/* ── EmotionCard Component ────────────────────────────────────── */
interface EmotionCardProps {
    snapshot: string | null;
    emotion: string;
    confidence: number;
    visible: boolean;
}

export default function EmotionCard({
    snapshot,
    emotion,
    confidence,
    visible,
}: EmotionCardProps) {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const config = EMOTION_STYLE[emotion] || EMOTION_STYLE.Neutral;

    // Pick joke once so StrictMode double-render uses the same joke
    const jokeRef = useRef("");

    // Render the card to canvas when visible
    useEffect(() => {
        if (!visible || !snapshot || !previewCanvasRef.current) return;
        // Pick a fresh joke only on first mount for this detection
        if (!jokeRef.current) {
            jokeRef.current = pickJoke(emotion);
        }
        setReady(false);

        renderCardToCanvas(
            previewCanvasRef.current,
            snapshot,
            emotion,
            confidence,
            config,
            jokeRef.current
        ).then(() => setReady(true));
    }, [visible, snapshot, emotion, confidence, config]);

    const handleDownload = useCallback(async () => {
        if (!previewCanvasRef.current || !ready) return;
        setDownloading(true);
        try {
            const blob = await new Promise<Blob | null>((res) =>
                previewCanvasRef.current!.toBlob(res, "image/png")
            );
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `emotion-${emotion.toLowerCase()}-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } finally {
            setDownloading(false);
        }
    }, [emotion, ready]);

    if (!visible || !snapshot) return null;

    return (
        <div
            className="animate-slide-up"
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
            }}
        >
            {/* Card preview */}
            <div
                style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: `0 0 40px ${config.color}33, 0 8px 32px rgba(0,0,0,0.5)`,
                    border: `1px solid ${config.color}33`,
                    maxWidth: 300,
                    width: "100%",
                }}
            >
                <canvas
                    ref={previewCanvasRef}
                    style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                        opacity: ready ? 1 : 0,
                        transition: "opacity 0.5s ease",
                    }}
                />
            </div>

            {/* Download button */}
            <button
                onClick={handleDownload}
                disabled={!ready || downloading}
                style={{
                    padding: "10px 28px",
                    borderRadius: 8,
                    border: `1px solid ${config.color}66`,
                    background: `${config.color}15`,
                    color: config.color,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: ready ? "pointer" : "default",
                    opacity: ready ? 1 : 0.5,
                    transition: "all 0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    pointerEvents: "auto",
                }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 3v13M12 16l-5-5M12 16l5-5M5 21h14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                {downloading ? "Saving..." : "Download Card"}
            </button>
        </div>
    );
}