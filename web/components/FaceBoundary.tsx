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

    return (
        <div
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
                        {/* White = visible (darkened) */}
                        <rect width="100%" height="100%" fill="white" />
                        {/* Black = cutout (clear) */}
                        <ellipse cx="50%" cy="45%" rx="18%" ry="30%" fill="black" />
                    </mask>
                </defs>
                {/* Dark overlay with oval cutout */}
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
                    {/* Outer glow */}
                    <ellipse
                        cx="50%"
                        cy="45%"
                        rx="18.5%"
                        ry="30.5%"
                        fill="none"
                        stroke={isActive ? "rgba(106,216,122,0.15)" : "rgba(90,220,232,0.1)"}
                        strokeWidth="8"
                    />
                    {/* Main border */}
                    <ellipse
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
        </div>
    );
}

/**
 * Check if a face bounding box is inside the boundary zone.
 *
 * The boundary is an oval at center (50%, 45%) with rx=18%, ry=30%
 * of the frame dimensions. We check if the center of the bbox
 * falls within this ellipse.
 *
 * @param bbox [x, y, w, h] face bounding box in pixels
 * @param frameW  frame width in pixels
 * @param frameH  frame height in pixels
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
    const rx = 0.18;
    const ry = 0.30;

    // Ellipse equation: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 <= 1
    const dx = (faceCenterX - cx) / rx;
    const dy = (faceCenterY - cy) / ry;

    return dx * dx + dy * dy <= 1.0;
}
