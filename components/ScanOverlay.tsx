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
            {/* Title */}
            <p
                style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "var(--accent-amber)",
                    marginBottom: 20,
                    letterSpacing: 0.5,
                }}
            >
                Scanning Your Expression
            </p>

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

            {/* Percentage */}
            <p
                style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    marginTop: 10,
                }}
            >
                {pct}%
            </p>

            {/* Analyzing text */}
            <p
                style={{
                    fontSize: 14,
                    color: "var(--text-dim)",
                    marginTop: 30,
                }}
            >
                Analyzing
                <span className="animate-dots">...</span>
            </p>
        </div>
    );
}
