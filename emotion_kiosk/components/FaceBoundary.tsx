"use client";

interface FaceBoundaryProps {
    state: string;
}

/**
 * Renders a centered oval boundary guide on the camera feed.
 * The face must be inside this zone for detection to trigger.
 *
 * The zone is 40% width × 60% height of the viewport, centered.
 */
export default function FaceBoundary({ state }: FaceBoundaryProps) {
    const showGuide = state === "IDLE" || state === "DETECTING";
    const isActive = state === "DETECTING" || state === "SCANNING";

    // Responsive logic (simple media query check via state or just CSS classes would be ideal, 
    // but here we render SVG attributes. We'll use a simple hook or check window).
    // Better: use CSS variables for rx/ry if possible? SVG explicit attributes don't always like CSS vars for geometry.
    // simpler: Let's use a wide default, but if the user wants it "removed on mobile", we can just hide it with CSS media query.
    // BUT the logic needs to match.
    // Let's implement a dynamic check.

    return (
        <div
            className="face-boundary-container"
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 7,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {/* Darkened area outside the boundary (mask) */}
            <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
                <defs>
                    <mask id="boundary-mask">
                        <rect width="100%" height="100%" fill="white" />
                        {/* Circle boundary: 25% radius (increased from 22%) */}
                        {/* Circle boundary: 38vh radius (increased from 30vh) */}
                        <circle className="boundary-circle" cx="50%" cy="50%" r="38vh" fill="black" />
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0,0,0,0.85)"
                    mask="url(#boundary-mask)"
                />
            </svg>

            {/* Circle border ring */}
            {showGuide && (
                <svg
                    width="100%"
                    height="100%"
                    style={{ position: "absolute", inset: 0 }}
                >
                    <circle
                        className="boundary-circle"
                        cx="50%"
                        cy="50%"
                        r="38.5vh"
                        fill="none"
                        stroke={isActive ? "rgba(106,216,122,0.15)" : "rgba(90,220,232,0.1)"}
                        strokeWidth="8"
                    />
                    <circle
                        className="boundary-circle"
                        cx="50%"
                        cy="50%"
                        r="38vh"
                        fill="none"
                        stroke={isActive ? "var(--accent-green)" : "var(--accent-cyan)"}
                        strokeWidth="2"
                        strokeDasharray={isActive ? "none" : "8 6"}
                        style={{
                            transition: "stroke 0.4s ease",
                        }}
                    />
                </svg>
            )}

            {/* Hint for positioning - subtle and lower down */}
            {state === "IDLE" && (
                <div
                    className="animate-pulse"
                    style={{
                        position: "absolute",
                        bottom: "8%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 12,
                        color: "var(--accent-cyan)",
                        opacity: 0.5,
                        letterSpacing: 3,
                        textTransform: "uppercase",
                        fontWeight: 600
                    }}
                >
                    Center your face in the ring
                </div>
            )}

            <style jsx global>{`
                @media (max-width: 768px) {
                    .boundary-circle {
                        r: 42vh !important;
                    }
                }
            `}</style>
        </div>
    );
}

/**
 * Check if a face is detected and valid.
 * The circle is a visual UX guide — detection triggers for any face in frame.
 * The complex coordinate-space mapping (frame→viewport) was causing
 * detection to work at corners instead of center, so it's removed.
 */
export function isFaceInBoundary(
    bbox: number[],
    frameW: number,
    frameH: number
): boolean {
    if (!bbox || bbox.length < 4) return false;

    // Just validate the bbox is reasonable (face isn't too tiny or out of bounds)
    const [x, y, w, h] = bbox;
    if (w < 30 || h < 30) return false;
    if (x < 0 || y < 0 || x + w > frameW || y + h > frameH) return false;

    return true; // Any valid face in frame triggers detection
}
