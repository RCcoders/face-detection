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
                        // Remove high ideal resolution for better mobile compatibility check
                        // or keep it but handle failure. "ideal" is usually safe.
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                };

                stream = await navigator.mediaDevices.getUserMedia(constraints);

                if (isMounted && videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Play must be called explicitly in some browsers, though autoPlay handles most
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

    // Capture frames at interval
    const captureFrame = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !onFrame) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState !== 4) return; // Ensure video is ready

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Draw image
        // Check if we need to mirror based on facingMode (usually user is mirrored)
        // The video element is mirrored via CSS scaleX(-1), so the canvas draw is raw.
        // We probably want to send the raw image to the backend (not mirrored) or mirrored?
        // Face detection works on either, but usually raw is "what the camera sees".
        // However, for the user to see "selfie" mode, CSS mirror is good.
        // Let's draw it as is.
        ctx.drawImage(video, 0, 0);

        // Convert
        const base64 = canvas.toDataURL("image/jpeg", 0.7);
        onFrame(base64, canvas.width, canvas.height);
    }, [onFrame]);

    useEffect(() => {
        if (!active || !ready) return;
        const id = setInterval(captureFrame, captureInterval);
        return () => clearInterval(id);
    }, [active, ready, captureFrame, captureInterval]);

    if (error) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                backgroundColor: '#000',
                color: 'white',
                padding: 20,
                textAlign: 'center'
            }}>
                <div>
                    <p style={{ fontSize: 18, marginBottom: 10 }}>⚠️ Camera Error</p>
                    <p style={{ fontSize: 14, opacity: 0.8 }}>{error}</p>
                    <p style={{ fontSize: 12, opacity: 0.5, marginTop: 10 }}>Please ensure you are using HTTPS and have allowed camera access.</p>
                </div>
            </div>
        );
    }

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
