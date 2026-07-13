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
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generate(
  model: string,
  system: string,
  user: string,
  responseSchema?: object,
  maxOutputTokens = 1024,
  // Gemini 3.x models think by default and that reasoning is billed against
  // maxOutputTokens BEFORE the model writes its answer — with short outputs
  // (gate/classify) there's enough budget left over, but longer structured
  // outputs (summaries) got silently truncated mid-JSON (finishReason
  // MAX_TOKENS), which JSON.parse then throws on. Capping the thinking
  // budget leaves the rest of maxOutputTokens for the actual answer.
  thinkingBudget = 200
): Promise<string> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens,
      thinkingConfig: { thinkingBudget },
      ...(responseSchema ? { responseMimeType: "application/json", responseSchema } : {}),
    },
  });

  const MAX_ATTEMPTS = 3;
  let lastErr: Error = new Error("unreachable");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(45000),
      });
      // 503 (overloaded) / 429 (rate limited) are transient — retry with backoff,
      // matching the pattern Anthropic's SDK applies automatically.
      if ((res.status === 503 || res.status === 429) && attempt < MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1) + Math.random() * 250);
        continue;
      }
      const data = (await res.json()) as GeminiResponse;
      if (!res.ok) throw new Error(`gemini ${model} HTTP ${res.status}: ${data.error?.message ?? ""}`);
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) {
        throw new Error(`gemini ${model}: empty response (finishReason: ${candidate?.finishReason ?? "?"})`);
      }
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new Error(`gemini ${model}: truncated (MAX_TOKENS) — raise maxOutputTokens or lower thinkingBudget`);
      }
      return text;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      // Network/timeout errors are also worth one retry; JSON/MAX_TOKENS errors are not.
      if (attempt < MAX_ATTEMPTS && !lastErr.message.includes("MAX_TOKENS")) {
        await sleep(500 * 2 ** (attempt - 1) + Math.random() * 250);
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}

export async function geminiJson<T>(
  model: string,
  system: string,
  user: string,
  responseSchema: object,
  maxOutputTokens = 1024,
  thinkingBudget = 200
): Promise<T> {
  const text = await generate(model, system, user, responseSchema, maxOutputTokens, thinkingBudget);
  return JSON.parse(text) as T;
}
