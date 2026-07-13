// Minimal Gemini REST client (no SDK dependency) for the cost-optimized
// pipeline stages. Callers must handle errors — classify.ts falls back to
// the Claude path when Gemini is unavailable.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY not set");
  return k;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

async function generate(
  model: string,
  system: string,
  user: string,
  responseSchema?: object,
  maxOutputTokens = 1024
): Promise<string> {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens,
        ...(responseSchema
          ? { responseMimeType: "application/json", responseSchema }
          : {}),
      },
    }),
    signal: AbortSignal.timeout(45000),
  });
  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) throw new Error(`gemini ${model} HTTP ${res.status}: ${data.error?.message ?? ""}`);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`gemini ${model}: empty response`);
  return text;
}

export async function geminiJson<T>(
  model: string,
  system: string,
  user: string,
  responseSchema: object,
  maxOutputTokens = 1024
): Promise<T> {
  const text = await generate(model, system, user, responseSchema, maxOutputTokens);
  return JSON.parse(text) as T;
}
