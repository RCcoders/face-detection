"use client";

interface ScanOverlayProps {
    progress: number; // 0-1
    visible: boolean;
}

export default function ScanOverlay({ progress, visible }: ScanOverlayProps) {
    if (!visible) return null;

    const pct = Math.round(progress * 100);

    return (
        <div className="animate-fade-in" style={{ textAlign: "center" }}>
            {/* Progress bar */}
            <div className="progress-track" style={{ margin: "0 auto" }}>
                <div
                    className="progress-fill"
                    style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, var(--accent-amber), var(--accent-green))`,
                    }}
                />
            </div>
        </div>
    );
}
