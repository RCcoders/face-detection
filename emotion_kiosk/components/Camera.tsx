"use client";

import { useRef, useEffect, useCallback, useState } from "react";

interface CameraProps {
    onFrame?: (base64: string, frameW: number, frameH: number) => Promise<void> | void;
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
    const [error, setError] = useState<string | null>(null);

    // Start camera
    useEffect(() => {
        let stream: MediaStream | null = null;
        let isMounted = true;

        async function startCamera() {
            try {
                setError(null);
                const constraints = {
                    video: {
                        facingMode: "user",
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                };

                stream = await navigator.mediaDevices.getUserMedia(constraints);

                if (isMounted && videoRef.current) {
                    videoRef.current.srcObject = stream;
                    try {
                        await videoRef.current.play();
                    } catch (e) {
                        console.error("Play failed:", e);
                    }
                    setReady(true);
                }
            } catch (err: any) {
                console.error("Camera access denied:", err);
                if (isMounted) {
                    setError(err.message || "Could not access camera. Please allow permissions.");
                }
            }
        }

        startCamera();

        return () => {
            isMounted = false;
            if (stream) {
                stream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    // Capture frames
    const captureFrame = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !onFrame) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState !== 4) return; // Ensure video is ready

        // Use native video resolution — stable and always works
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Draw raw frame (no CSS mirroring needed — backend handles raw coords)
        ctx.drawImage(video, 0, 0);

        // Convert - lower quality for faster transmission
        const base64 = canvas.toDataURL("image/jpeg", 0.6);

        // Await the parent's processing if it returns a promise
        await onFrame(base64, canvas.width, canvas.height);
    }, [onFrame]);

    // Request-Response Loop
    useEffect(() => {
        if (!active || !ready) return;

        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

        const tick = async () => {
            if (!isMounted) return;

            const start = Date.now();
            await captureFrame();
            const elapsed = Date.now() - start;

            // Wait at least 'captureInterval', but if processing took longer, 
            // wait a minimal amount (50ms) to let UI breathe.
            const delay = Math.max(50, captureInterval - elapsed);

            if (isMounted) {
                timeoutId = setTimeout(tick, delay);
            }
        };

        tick();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [active, ready, captureFrame, captureInterval]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-black text-white p-5 text-center">
                <div>
                    <p className="text-lg mb-2">⚠️ Camera Error</p>
                    <p className="text-sm opacity-80">{error}</p>
                    <p className="text-xs opacity-50 mt-2">Please ensure you are using HTTPS and have allowed camera access.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
        </>
    );
}
