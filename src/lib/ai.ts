import "server-only";

// Structured qualitative review via Anthropic tool-use. Any failure (missing
// key, network, malformed output) returns null so callers fall back to raw math.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SystemicAlert = {
  severity: "info" | "watch" | "alert";
  category: string;
  summary: string;
  user_ids?: string[];
};

export type AiAssessment = {
  systemic_alerts: SystemicAlert[];
  per_user_notes: Record<string, string>;
};

const TOOL = {
  name: "record_assessment",
  description: "Record a structured qualitative QC assessment.",
  input_schema: {
    type: "object",
    properties: {
      systemic_alerts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["info", "watch", "alert"] },
            category: { type: "string" },
            summary: { type: "string" },
            user_ids: { type: "array", items: { type: "string" } },
          },
          required: ["severity", "category", "summary"],
        },
      },
      per_user_notes: { type: "object", additionalProperties: { type: "string" } },
    },
    required: ["systemic_alerts", "per_user_notes"],
  },
} as const;

export async function runAiAssessment(
  context: unknown,
  maxAttempts = 3
): Promise<AiAssessment | null> {
  const key = process.env.MOONSHOT_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  const body = {
    model,
    max_tokens: 1500,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "record_assessment" },
    messages: [
      {
        role: "user",
        content:
          "You are a QC operations analyst. Analyze the JSON below for systemic " +
          "issues: multi-day task rollovers, repetitive day-to-day prose, and " +
          "cross-team defect-tag clustering. Call record_assessment.\n\n" +
          JSON.stringify(context),
      },
    ],
  };

  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json();
      const block = (data.content ?? []).find((b: any) => b.type === "tool_use");
      if (!block) throw new Error("No tool_use block");
      return block.input as AiAssessment;
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt >= maxAttempts) break;
      const base = Math.min(1000 * 2 ** attempt, 20000);
      await sleep(base + Math.random() * base * 0.3);
    }
  }
  console.error("AI assessment failed, falling back to raw math:", lastErr);
  return null;
}
