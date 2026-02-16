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
                        {/* Desktop: 18% w, 30% h. Mobile (Portrait): 35% w, 22% h */}
                        <ellipse className="boundary-ellipse" cx="50%" cy="45%" rx="18%" ry="30%" fill="black" />
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0,0,0,0.5)"
                    mask="url(#boundary-mask)"
                />
            </svg>

            {/* Oval border ring */}
            {showGuide && (
                <svg
                    width="100%"
                    height="100%"
                    style={{ position: "absolute", inset: 0 }}
                >
                    <ellipse
                        className="boundary-ellipse"
                        cx="50%"
                        cy="45%"
                        rx="18.5%"
                        ry="30.5%"
                        fill="none"
                        stroke={isActive ? "rgba(106,216,122,0.15)" : "rgba(90,220,232,0.1)"}
                        strokeWidth="8"
                    />
                    <ellipse
                        className="boundary-ellipse"
                        cx="50%"
                        cy="45%"
                        rx="18%"
                        ry="30%"
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

            {/* Label */}
            {state === "IDLE" && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "12%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 13,
                        color: "var(--accent-cyan)",
                        opacity: 0.7,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                    }}
                >
                    Position face here
                </div>
            )}

            <style jsx global>{`
                @media (max-width: 768px) {
                    .boundary-ellipse {
                        rx: 35% !important;
                        ry: 25% !important;
                    }
                }
            `}</style>
        </div>
    );
}

/**
 * Check if a face bounding box is inside the boundary zone.
 */
export function isFaceInBoundary(
    bbox: number[],
    frameW: number,
    frameH: number
): boolean {
    if (!bbox || bbox.length < 4) return false;

    const [x, y, w, h] = bbox;

    // Face center in normalized coords (0-1)
    // Note: camera is mirrored (scaleX(-1)), so we flip X
    const faceCenterX = 1 - (x + w / 2) / frameW;
    const faceCenterY = (y + h / 2) / frameH;

    // Boundary ellipse center and radii (normalized)
    const cx = 0.50;
    const cy = 0.45;

    // Adjust logic based on aspect ratio to match visual CSS
    const isPortrait = frameH > frameW;

    const rx = isPortrait ? 0.35 : 0.18;
    const ry = isPortrait ? 0.25 : 0.30;

    // Ellipse equation: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 <= 1
    const dx = (faceCenterX - cx) / rx;
    const dy = (faceCenterY - cy) / ry;

    // Loosen the check slightly (1.2 instead of 1.0) to be more forgiving on mobile
    return dx * dx + dy * dy <= 1.2;
}
