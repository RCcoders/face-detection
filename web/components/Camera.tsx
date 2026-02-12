"use client";

import { useRef, useEffect, useCallback, useState } from "react";

interface CameraProps {
    onFrame?: (base64: string, frameW: number, frameH: number) => void;
    captureInterval?: number; // ms between captures sent to API
    active?: boolean;
}

export default function Camera({
    onFrame,
    captureInterval = 300,
    active = true,
}: CameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);

    // Start camera
    useEffect(() => {
        let stream: MediaStream | null = null;

        async function startCamera() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "user",
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setReady(true);
                }
            } catch (err) {
                console.error("Camera access denied:", err);
            }
        }

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    // Capture frames at interval
    const captureFrame = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !onFrame) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL("image/jpeg", 0.7);
        onFrame(base64, canvas.width, canvas.height);
    }, [onFrame]);

    useEffect(() => {
        if (!active || !ready) return;
        const id = setInterval(captureFrame, captureInterval);
        return () => clearInterval(id);
    }, [active, ready, captureFrame, captureInterval]);

    return (
        <>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
        </>
    );
}
