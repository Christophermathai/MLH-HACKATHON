import {
  AnalystOutput,
  AnalystSchema,
  MediatorResult,
  MediatorSchema,
  ZoomOutPublicError,
} from "@zoomout/contracts";
import { AnalystProvider, MediatorProvider, JudgeStreamProvider } from "./types.js";
import {
  ANALYST_SYSTEM_PROMPT,
  MEDIATOR_SYSTEM_PROMPT,
  JUDGE_SYSTEM_PROMPT,
} from "../agents/prompts.js";

function cleanJsonCodeFence(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

export class OpenAiLlmProvider
  implements AnalystProvider, MediatorProvider, JudgeStreamProvider
{
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(options: { apiKey?: string; model?: string; baseUrl?: string } = {}) {
    this.apiKey =
      options.apiKey ??
      process.env.LLM_API_KEY ??
      process.env.GEMINI_API_KEY ??
      process.env.GROQ_API_KEY ??
      process.env.OPENAI_API_KEY ??
      "";
    this.baseUrl =
      options.baseUrl ??
      process.env.LLM_BASE_URL ??
      (process.env.GROQ_API_KEY
        ? "https://api.groq.com/openai/v1"
        : process.env.GEMINI_API_KEY
        ? "https://generativelanguage.googleapis.com/v1beta/openai"
        : "https://api.openai.com/v1");
    this.model =
      options.model ??
      process.env.LLM_MODEL ??
      (process.env.GROQ_API_KEY
        ? "gemma2-9b-it"
        : process.env.GEMINI_API_KEY
        ? "gemma-2-9b-it"
        : "gemma-2-9b-it");
  }

  private async fetchChatCompletion(
    messages: Array<{ role: string; content: string }>,
    jsonMode = false,
    signal?: AbortSignal
  ): Promise<string> {
    const isLocalOllama = this.baseUrl.includes("11434");
    if (!this.apiKey && !isLocalOllama) {
      throw new ZoomOutPublicError("MODEL_FAILED", "LLM API key not configured");
    }

    const payload: any = {
      model: this.model,
      messages,
      temperature: 0.3,
    };
    if (jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    let response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

    // If provider rejected response_format json_object, retry without response_format
    if (!response.ok && jsonMode) {
      delete payload.response_format;
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ZoomOutPublicError(
        "MODEL_FAILED",
        `LLM request (${this.model}) failed (${response.status}): ${errText.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new ZoomOutPublicError("MODEL_FAILED", `LLM model (${this.model}) returned empty message content`);
    }
    return content;
  }

  // --- Analyst ---
  async analyze(
    side: "A" | "B",
    confirmedText: string,
    signal?: AbortSignal
  ): Promise<AnalystOutput> {
    const userPrompt = `Participant Side: ${side}\n\nConfirmed Testimony:\n"""\n${confirmedText}\n"""`;
    const messages = [
      { role: "system", content: ANALYST_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    // Attempt 1
    let raw = await this.fetchChatCompletion(messages, true, signal);
    let parsed: any;
    try {
      parsed = JSON.parse(cleanJsonCodeFence(raw));
      parsed.side = side; // Enforce side binding
      const validated = AnalystSchema.parse(parsed);
      return validated;
    } catch {
      // Retry once (FR-006-03)
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: "The previous output was invalid JSON or violated schema. Respond with valid JSON strictly conforming to the AnalystSchema.",
      });
      raw = await this.fetchChatCompletion(messages, true, signal);
      try {
        parsed = JSON.parse(cleanJsonCodeFence(raw));
        parsed.side = side;
        return AnalystSchema.parse(parsed);
      } catch (err: any) {
        throw new ZoomOutPublicError(
          "MODEL_FAILED",
          `Analyst model failed to produce valid schema after retry: ${err.message}`
        );
      }
    }
  }

  // --- Mediator ---
  async mediate(
    analystA: AnalystOutput,
    analystB: AnalystOutput,
    signal?: AbortSignal
  ): Promise<MediatorResult> {
    const userPrompt = `Analysis of Side A:\n${JSON.stringify(analystA, null, 2)}\n\nAnalysis of Side B:\n${JSON.stringify(analystB, null, 2)}`;
    const messages = [
      { role: "system", content: MEDIATOR_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    let raw = await this.fetchChatCompletion(messages, true, signal);
    let parsed: any;
    try {
      parsed = JSON.parse(cleanJsonCodeFence(raw));
      if (parsed.truce) {
        parsed.truce.requires_apology = false; // Invariant
      }
      return MediatorSchema.parse(parsed);
    } catch {
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: "The previous output was invalid JSON or violated schema. Output valid JSON strictly conforming to MediatorSchema with requires_apology: false.",
      });
      raw = await this.fetchChatCompletion(messages, true, signal);
      try {
        parsed = JSON.parse(cleanJsonCodeFence(raw));
        if (parsed.truce) {
          parsed.truce.requires_apology = false;
        }
        return MediatorSchema.parse(parsed);
      } catch (err: any) {
        throw new ZoomOutPublicError(
          "MODEL_FAILED",
          `Mediator model failed to produce valid schema after retry: ${err.message}`
        );
      }
    }
  }

  // --- Judge ---
  async streamVerdict(
    mediator: MediatorResult,
    signal?: AbortSignal,
    onSentence?: (sentence: string, seq: number) => void
  ): Promise<string> {
    const userPrompt = `Mediator Result:\n${JSON.stringify(mediator, null, 2)}\n\nPlease deliver the spoken Malayalam ruling now.`;
    const messages = [
      { role: "system", content: JUDGE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    const raw = await this.fetchChatCompletion(messages, false, signal);
    // Split into sentences on ., !, ?, danda, and newlines
    const rawSentences = raw
      .split(/(?<=[.!?\u0964\u0965\n])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let seq = 0;
    const finalSentences: string[] = [];
    for (const s of rawSentences) {
      finalSentences.push(s);
      onSentence?.(s, seq++);
    }

    return finalSentences.join(" ");
  }
}

