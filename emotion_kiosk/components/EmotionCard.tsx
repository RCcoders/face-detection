"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { pickJoke } from "@/lib/jokes";
import QRCode from "qrcode";

/* ── Emotion styles ───────────────────────────────────────────── */
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

/* ── Real QR code generator ──────────────────────────────────── */
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

interface EmotionCardProps {
    snapshot: string | null;
    emotion: string;
    confidence: number;
    visible: boolean;
    jokeOverride?: string | null;
}

export default function EmotionCard({
    snapshot,
    emotion,
    confidence,
    visible,
    jokeOverride,
}: EmotionCardProps) {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);
    const [capturedJoke, setCapturedJoke] = useState("");

    const config = EMOTION_STYLE[emotion] || EMOTION_STYLE.Neutral;

    // Pick joke once when visible
    useEffect(() => {
        if (visible) {
            setCapturedJoke(jokeOverride || pickJoke(emotion));
        }
    }, [visible, emotion, jokeOverride]);

    const renderToCanvas = useCallback(
        async (canvas: HTMLCanvasElement) => {
            if (!snapshot || !capturedJoke) return;
            const ctx = canvas.getContext("2d")!;
            const W = 600;
            const H = 840;
            canvas.width = W;
            canvas.height = H;

            // 1. Clear & Background
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = "#1a1a2a";
            ctx.fillRect(0, 0, W, H);

            // Border
            ctx.strokeStyle = config.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(24, 24, W - 48, H - 48);

            // Load snapshot image
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = async () => {
                const imgY = 40;
                const imgW = W - 80;
                const imgH = 340;

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

                const scale = Math.max(imgW / img.width, imgH / img.height);
                const scaledW = img.width * scale;
                const scaledH = img.height * scale;
                const offsetX = (imgW - scaledW) / 2;
                const offsetY = (imgH - scaledH) / 2;

                ctx.translate(40 + imgW, imgY);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, scaledW, scaledH);
                ctx.restore();

                const divY = imgY + imgH + 20;
                ctx.font = "56px serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(config.emoji, W / 2, divY + 70);

                ctx.font = "bold 42px Inter, system-ui, sans-serif";
                ctx.fillStyle = config.color;
                ctx.shadowColor = config.color;
                ctx.shadowBlur = 30;
                ctx.fillText(emotion.toUpperCase(), W / 2, divY + 125);
                ctx.shadowBlur = 0;

                ctx.font = "16px Inter, system-ui, sans-serif";
                ctx.fillStyle = "#8a8a9a";
                ctx.fillText(`Confidence: ${Math.round(confidence * 100)}%`, W / 2, divY + 158);

                const barW = 200;
                const barH = 4;
                const barX = (W - barW) / 2;
                const barY = divY + 170;
                ctx.fillStyle = "rgba(255,255,255,0.08)";
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = config.color;
                ctx.fillRect(barX, barY, barW * confidence, barH);

                ctx.font = "600 32px Inter, system-ui, sans-serif";
                ctx.fillStyle = "#e0e0ee";

                const maxTextW = W - 120;
                const words = capturedJoke.split(" ");
                const lines: string[] = [];
                let current = "";
                for (const word of words) {
                    const test = current + (current ? " " : "") + word;
                    if (ctx.measureText(test).width > maxTextW && current) {
                        lines.push(current);
                        current = word;
                    } else current = test;
                }
                if (current) lines.push(current);

                let jokeY = barY + 80;
                for (const line of lines) {
                    ctx.fillText(line, W / 2, jokeY);
                    jokeY += 42;
                }

                const qrSize = 160;
                const qrTop = jokeY + 20;
                const qrCanvas = await generateQRCanvas(`emotion-kiosk:${emotion}:${Date.now()}`, qrSize);
                ctx.drawImage(qrCanvas, W / 2 - qrSize / 2, qrTop);

                ctx.font = "14px Inter, system-ui, sans-serif";
                ctx.fillStyle = "#55556a";
                ctx.fillText("Scan to share", W / 2, qrTop + qrSize + 22);

                const time = new Date().toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                });
                ctx.font = "12px Inter, system-ui, sans-serif";
                ctx.fillText(`${time} • EMOTION KIOSK`, W / 2, H - 40);

                setReady(true);
            };
            img.src = snapshot;
        },
        [snapshot, emotion, confidence, config, capturedJoke]
    );

    useEffect(() => {
        if (visible && snapshot && previewCanvasRef.current && capturedJoke) {
            setReady(false);
            renderToCanvas(previewCanvasRef.current);
        }
    }, [visible, snapshot, capturedJoke, renderToCanvas]);

    const handleDownload = useCallback(() => {
        if (!previewCanvasRef.current || !ready) return;
        const link = document.createElement("a");
        link.download = `emotion-card-${emotion.toLowerCase()}.png`;
        link.href = previewCanvasRef.current.toDataURL("image/png");
        link.click();
    }, [ready, emotion]);

    if (!visible) return null;

    return (
        <div className="flex flex-col items-center animate-fade-in">
            <div className="card-container glass-strong p-6 rounded-[24px] relative bg-[#1a1a2a]/40 border border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl">
                <div className="absolute inset-0 pointer-events-none opacity-20"
                    style={{ background: config.bgGradient }} />

                <canvas
                    ref={previewCanvasRef}
                    className="rounded-xl border border-white/10 shadow-lg w-[300px] md:w-[350px] lg:w-[400px]"
                    style={{ height: "auto", display: ready ? "block" : "none" }}
                />

                {!ready && (
                    <div className="w-[300px] aspect-[600/840] flex items-center justify-center">
                        {/* Just a spacer, no text per user request */}
                    </div>
                )}

                <div className="mt-6 flex flex-col gap-3 w-full">
                    <button
                        onClick={handleDownload}
                        disabled={!ready}
                        className="w-full py-4 rounded-xl bg-white text-black font-bold text-sm tracking-widest uppercase hover:bg-[var(--accent-amber)] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                    >
                        Download Card
                    </button>
                    <p className="text-[11px] text-[var(--text-dim)] text-center uppercase tracking-[2px]">
                        Saved locally • Zero cloud storage
                    </p>
                </div>
            </div>
        </div>
    );
}