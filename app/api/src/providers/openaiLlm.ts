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
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned.trim();
}

function normalizeAnalyst(parsed: any, side: "A" | "B"): any {
  if (parsed && typeof parsed === "object") {
    if (parsed.analyst && typeof parsed.analyst === "object") parsed = parsed.analyst;
    else if (parsed.analysis && typeof parsed.analysis === "object") parsed = parsed.analysis;
    else if (parsed.result && typeof parsed.result === "object") parsed = parsed.result;
  } else {
    parsed = {};
  }

  parsed.side = side;
  const toArray = (v: any) => (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v.trim()] : []);
  parsed.upset_about = toArray(parsed.upset_about);
  parsed.stated_facts = toArray(parsed.stated_facts);
  parsed.assumptions_made = toArray(parsed.assumptions_made);
  parsed.possible_feelings = toArray(parsed.possible_feelings);
  parsed.unclear_lines = toArray(parsed.unclear_lines);

  if (!parsed.safety_flags || typeof parsed.safety_flags !== "object") {
    parsed.safety_flags = { abuse_or_coercion_signals: false, notes: "" };
  } else {
    parsed.safety_flags.abuse_or_coercion_signals = Boolean(parsed.safety_flags.abuse_or_coercion_signals);
    parsed.safety_flags.notes = String(parsed.safety_flags.notes || "");
  }
  return parsed;
}

function normalizeMediator(parsed: any): any {
  if (parsed && typeof parsed === "object") {
    if (parsed.mediator && typeof parsed.mediator === "object") parsed = parsed.mediator;
    else if (parsed.mediator_result && typeof parsed.mediator_result === "object") parsed = parsed.mediator_result;
    else if (parsed.result && typeof parsed.result === "object") parsed = parsed.result;
  } else {
    parsed = {};
  }

  const toArray = (v: any) => (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v.trim()] : []);

  if (!parsed.what_each_is_upset_about || typeof parsed.what_each_is_upset_about !== "object") {
    parsed.what_each_is_upset_about = { A: [], B: [] };
  } else {
    parsed.what_each_is_upset_about.A = toArray(parsed.what_each_is_upset_about.A);
    parsed.what_each_is_upset_about.B = toArray(parsed.what_each_is_upset_about.B);
  }

  parsed.where_interpretations_differ = toArray(parsed.where_interpretations_differ);

  let score = Number(parsed.petty_score);
  if (isNaN(score)) score = 5;
  parsed.petty_score = Math.max(0, Math.min(10, Math.round(score)));

  if (!parsed.zoom_out || typeof parsed.zoom_out !== "object") {
    parsed.zoom_out = {
      immediate_issue: "Misunderstanding between parties",
      possible_underlying_feelings: ["tension", "grief"],
      bigger_picture: "Navigating communication challenges during difficult moments",
    };
  } else {
    parsed.zoom_out.immediate_issue = String(parsed.zoom_out.immediate_issue || "Disagreement between parties");
    parsed.zoom_out.possible_underlying_feelings = toArray(parsed.zoom_out.possible_underlying_feelings);
    parsed.zoom_out.bigger_picture = String(parsed.zoom_out.bigger_picture || "Communication breakdown");
  }

  if (!parsed.truce || typeof parsed.truce !== "object") {
    parsed.truce = {
      next_step: "Take a step back and have a calm conversation without blame.",
      requires_apology: false,
    };
  } else {
    parsed.truce.next_step = String(parsed.truce.next_step || "Take a pause to reflect.");
    parsed.truce.requires_apology = false;
  }

  return parsed;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

    try {
      let response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: combinedSignal,
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
          signal: combinedSignal,
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
    } finally {
      clearTimeout(timeoutId);
    }
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
      parsed = normalizeAnalyst(parsed, side);
      return AnalystSchema.parse(parsed);
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
        parsed = normalizeAnalyst(parsed, side);
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
      parsed = normalizeMediator(parsed);
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
        parsed = normalizeMediator(parsed);
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

