const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface DetectResult {
  detected: boolean;
  emotion: string | null;
  confidence: number;
  face_count: number;
  bbox: number[] | null;
}

export async function detectEmotion(
  base64Image: string
): Promise<DetectResult> {
  const res = await fetch(`${API_URL}/api/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
