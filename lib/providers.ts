import { readRuntimeString } from "@/lib/runtime-env";

export type TeamRole =
  | "planner"
  | "general"
  | "researcher"
  | "engineer"
  | "creative"
  | "music"
  | "critic"
  | "synthesizer";

export interface ModelMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  instructions: string;
  messages: ModelMessage[];
  maxOutputTokens: number;
  responseFormat?: "text" | "json";
  safetyIdentifier: string;
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  latencyMs: number;
}

export interface ModelProvider {
  id: string;
  family: string;
  name: string;
  model: string;
  priority: number;
  roles: TeamRole[];
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export interface ProviderReadiness {
  id: string;
  family: string;
  name: string;
  state: "ready" | "blocked";
  missing: string[];
}

interface JsonRecord {
  [key: string]: unknown;
}

const REQUEST_TIMEOUT_MS = 55_000;
const ALL_ROLES: TeamRole[] = [
  "planner",
  "general",
  "researcher",
  "engineer",
  "creative",
  "music",
  "critic",
  "synthesizer",
];

function combinedSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function safeProviderError(value: unknown): string {
  const message =
    value && typeof value === "object" && "error" in value
      ? JSON.stringify((value as JsonRecord).error)
      : typeof value === "string"
        ? value
        : "Unbekannter Providerfehler";
  return message
    .replace(/sk-[A-Za-z0-9_-]{12,}/gu, "[REDACTED]")
    .replace(/[A-Za-z0-9_-]{32,}/gu, "[REDACTED]")
    .slice(0, 480);
}

async function postJson(
  providerName: string,
  url: string,
  headers: HeadersInit,
  body: JsonRecord,
  signal?: AbortSignal,
): Promise<JsonRecord> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: combinedSignal(signal),
  });
  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = raw;
  }
  if (!response.ok) {
    throw new Error(
      `${providerName} antwortete mit HTTP ${response.status}: ${safeProviderError(parsed)}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`${providerName} lieferte keine gültige JSON-Antwort.`);
  }
  return parsed as JsonRecord;
}

function openAIResponseText(payload: JsonRecord): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  const fragments: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as JsonRecord).content)
      ? ((item as JsonRecord).content as unknown[])
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as JsonRecord).type === "output_text" &&
        typeof (part as JsonRecord).text === "string"
      ) {
        fragments.push(((part as JsonRecord).text as string).trim());
      }
    }
  }
  const text = fragments.filter(Boolean).join("\n");
  if (!text) throw new Error("Der Provider lieferte keinen Antworttext.");
  return text;
}

function chatCompletionText(payload: JsonRecord): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];
  if (!first || typeof first !== "object") {
    throw new Error("Der Provider lieferte keine Chat-Antwort.");
  }
  const message = (first as JsonRecord).message;
  if (!message || typeof message !== "object") {
    throw new Error("Der Provider lieferte keine Chat-Nachricht.");
  }
  const content = (message as JsonRecord).content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Der Provider lieferte keinen Antworttext.");
  }
  return content.trim();
}

function anthropicText(payload: JsonRecord): string {
  const content = Array.isArray(payload.content) ? payload.content : [];
  const text = content
    .filter(
      (item): item is JsonRecord =>
        Boolean(item) &&
        typeof item === "object" &&
        (item as JsonRecord).type === "text" &&
        typeof (item as JsonRecord).text === "string",
    )
    .map((item) => String(item.text).trim())
    .filter(Boolean)
    .join("\n");
  if (!text) throw new Error("Anthropic lieferte keinen Antworttext.");
  return text;
}

function geminiText(payload: JsonRecord): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = candidates[0];
  const content =
    first && typeof first === "object" ? (first as JsonRecord).content : undefined;
  const parts =
    content && typeof content === "object" && Array.isArray((content as JsonRecord).parts)
      ? ((content as JsonRecord).parts as unknown[])
      : [];
  const text = parts
    .filter(
      (part): part is JsonRecord =>
        Boolean(part) &&
        typeof part === "object" &&
        typeof (part as JsonRecord).text === "string",
    )
    .map((part) => String(part.text).trim())
    .filter(Boolean)
    .join("\n");
  if (!text) throw new Error("Gemini lieferte keinen Antworttext.");
  return text;
}

function openAIResponsesProvider(input: {
  id: string;
  name: string;
  model: string;
  priority: number;
  roles: TeamRole[];
  apiKey: string;
}): ModelProvider {
  return {
    ...input,
    family: "openai",
    async complete(request) {
      const started = performance.now();
      const payload = await postJson(
        input.name,
        "https://api.openai.com/v1/responses",
        { authorization: `Bearer ${input.apiKey}` },
        {
          model: input.model,
          instructions: request.instructions,
          input: request.messages,
          max_output_tokens: request.maxOutputTokens,
          store: false,
          safety_identifier: request.safetyIdentifier,
          ...(request.responseFormat === "json"
            ? { text: { format: { type: "json_object" } } }
            : {}),
        },
        request.signal,
      );
      return {
        text: openAIResponseText(payload),
        latencyMs: Math.round(performance.now() - started),
      };
    },
  };
}

function openAICompatibleProvider(input: {
  id: string;
  family: string;
  name: string;
  model: string;
  priority: number;
  roles: TeamRole[];
  apiKey: string;
  endpoint: string;
}): ModelProvider {
  return {
    ...input,
    async complete(request) {
      const started = performance.now();
      const payload = await postJson(
        input.name,
        input.endpoint,
        { authorization: `Bearer ${input.apiKey}` },
        {
          model: input.model,
          messages: [
            { role: "system", content: request.instructions },
            ...request.messages,
          ],
          max_tokens: request.maxOutputTokens,
          ...(request.responseFormat === "json"
            ? { response_format: { type: "json_object" } }
            : {}),
        },
        request.signal,
      );
      return {
        text: chatCompletionText(payload),
        latencyMs: Math.round(performance.now() - started),
      };
    },
  };
}

function anthropicProvider(input: {
  apiKey: string;
  model: string;
}): ModelProvider {
  return {
    id: "anthropic",
    family: "anthropic",
    name: "Anthropic",
    model: input.model,
    priority: 91,
    roles: [
      "planner",
      "general",
      "researcher",
      "engineer",
      "creative",
      "critic",
      "synthesizer",
    ],
    async complete(request) {
      const started = performance.now();
      const payload = await postJson(
        "Anthropic",
        "https://api.anthropic.com/v1/messages",
        {
          "x-api-key": input.apiKey,
          "anthropic-version": "2023-06-01",
        },
        {
          model: input.model,
          system: request.instructions,
          messages: request.messages,
          max_tokens: request.maxOutputTokens,
        },
        request.signal,
      );
      return {
        text: anthropicText(payload),
        latencyMs: Math.round(performance.now() - started),
      };
    },
  };
}

function geminiProvider(input: {
  apiKey: string;
  model: string;
}): ModelProvider {
  return {
    id: "gemini",
    family: "google",
    name: "Google Gemini",
    model: input.model,
    priority: 90,
    roles: [
      "planner",
      "general",
      "researcher",
      "creative",
      "music",
      "critic",
      "synthesizer",
    ],
    async complete(request) {
      const started = performance.now();
      const model = encodeURIComponent(input.model);
      const payload = await postJson(
        "Google Gemini",
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { "x-goog-api-key": input.apiKey },
        {
          systemInstruction: { parts: [{ text: request.instructions }] },
          contents: request.messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            maxOutputTokens: request.maxOutputTokens,
            ...(request.responseFormat === "json"
              ? { responseMimeType: "application/json" }
              : {}),
          },
        },
        request.signal,
      );
      return {
        text: geminiText(payload),
        latencyMs: Math.round(performance.now() - started),
      };
    },
  };
}

function customEndpoint(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    if (url.username || url.password || url.hash) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function configuredProviders(): ModelProvider[] {
  const providers: ModelProvider[] = [];
  const openAIKey = readRuntimeString("OPENAI_API_KEY");
  if (openAIKey) {
    providers.push(
      openAIResponsesProvider({
        id: "openai-sol",
        name: "OpenAI Sol",
        model: readRuntimeString("TANKAI_OPENAI_SOL_MODEL") ?? "gpt-5.6-sol",
        priority: 100,
        roles: [
          "general",
          "researcher",
          "engineer",
          "creative",
          "critic",
          "synthesizer",
        ],
        apiKey: openAIKey,
      }),
      openAIResponsesProvider({
        id: "openai-terra",
        name: "OpenAI Terra",
        model: readRuntimeString("TANKAI_OPENAI_TERRA_MODEL") ?? "gpt-5.6-terra",
        priority: 96,
        roles: ["planner", "general", "researcher", "critic", "synthesizer"],
        apiKey: openAIKey,
      }),
      openAIResponsesProvider({
        id: "openai-luna",
        name: "OpenAI Luna",
        model: readRuntimeString("TANKAI_OPENAI_LUNA_MODEL") ?? "gpt-5.6-luna",
        priority: 82,
        roles: ["planner", "general", "creative"],
        apiKey: openAIKey,
      }),
    );
  }

  const xaiKey = readRuntimeString("XAI_API_KEY");
  const xaiModel = readRuntimeString("XAI_MODEL");
  if (xaiKey && xaiModel) {
    providers.push(
      openAICompatibleProvider({
        id: "xai",
        family: "xai",
        name: "xAI Grok",
        model: xaiModel,
        priority: 93,
        roles: ["general", "researcher", "engineer", "creative", "critic"],
        apiKey: xaiKey,
        endpoint: "https://api.x.ai/v1/chat/completions",
      }),
    );
  }

  const anthropicKey = readRuntimeString("ANTHROPIC_API_KEY");
  const anthropicModel = readRuntimeString("ANTHROPIC_MODEL");
  if (anthropicKey && anthropicModel) {
    providers.push(
      anthropicProvider({ apiKey: anthropicKey, model: anthropicModel }),
    );
  }

  const geminiKey = readRuntimeString("GEMINI_API_KEY");
  const geminiModel = readRuntimeString("GEMINI_MODEL");
  if (geminiKey && geminiModel) {
    providers.push(geminiProvider({ apiKey: geminiKey, model: geminiModel }));
  }

  const customKey = readRuntimeString("CUSTOM_AI_API_KEY");
  const customModel = readRuntimeString("CUSTOM_AI_MODEL");
  const customUrl = readRuntimeString("CUSTOM_AI_CHAT_COMPLETIONS_URL");
  const validatedCustomUrl = customUrl ? customEndpoint(customUrl) : undefined;
  if (customKey && customModel && validatedCustomUrl) {
    providers.push(
      openAICompatibleProvider({
        id: "custom",
        family: "custom",
        name: "Eigener KI-Endpunkt",
        model: customModel,
        priority: 75,
        roles: ALL_ROLES,
        apiKey: customKey,
        endpoint: validatedCustomUrl,
      }),
    );
  }

  return providers.sort((left, right) => right.priority - left.priority);
}

export function publicProviderInfo(): Array<{
  id: string;
  family: string;
  name: string;
  model: string;
  roles: TeamRole[];
}> {
  return configuredProviders().map(({ id, family, name, model, roles }) => ({
    id,
    family,
    name,
    model,
    roles,
  }));
}

function readiness(
  input: Omit<ProviderReadiness, "state">,
): ProviderReadiness {
  return {
    ...input,
    state: input.missing.length === 0 ? "ready" : "blocked",
  };
}

export function publicProviderReadiness(): ProviderReadiness[] {
  const customUrl = readRuntimeString("CUSTOM_AI_CHAT_COMPLETIONS_URL");
  return [
    readiness({
      id: "openai",
      family: "openai",
      name: "OpenAI",
      missing: readRuntimeString("OPENAI_API_KEY") ? [] : ["API-Zugang"],
    }),
    readiness({
      id: "xai",
      family: "xai",
      name: "xAI Grok",
      missing: [
        ...(readRuntimeString("XAI_API_KEY") ? [] : ["API-Zugang"]),
        ...(readRuntimeString("XAI_MODEL") ? [] : ["Modell-ID"]),
      ],
    }),
    readiness({
      id: "anthropic",
      family: "anthropic",
      name: "Anthropic",
      missing: [
        ...(readRuntimeString("ANTHROPIC_API_KEY") ? [] : ["API-Zugang"]),
        ...(readRuntimeString("ANTHROPIC_MODEL") ? [] : ["Modell-ID"]),
      ],
    }),
    readiness({
      id: "gemini",
      family: "google",
      name: "Google Gemini",
      missing: [
        ...(readRuntimeString("GEMINI_API_KEY") ? [] : ["API-Zugang"]),
        ...(readRuntimeString("GEMINI_MODEL") ? [] : ["Modell-ID"]),
      ],
    }),
    readiness({
      id: "custom",
      family: "custom",
      name: "Eigener KI-Endpunkt",
      missing: [
        ...(readRuntimeString("CUSTOM_AI_API_KEY") ? [] : ["API-Zugang"]),
        ...(readRuntimeString("CUSTOM_AI_MODEL") ? [] : ["Modell-ID"]),
        ...(customUrl && customEndpoint(customUrl)
          ? []
          : ["gültige HTTPS-Endpunkt-URL"]),
      ],
    }),
  ];
}

export function publicModelMeshDiagnostics() {
  const providers = configuredProviders();
  const families = new Set(providers.map((provider) => provider.family));
  const roleCoverage = Object.fromEntries(
    ALL_ROLES.map((role) => [
      role,
      providers.filter((provider) => provider.roles.includes(role)).length,
    ]),
  ) as Record<TeamRole, number>;
  const teamReady = [
    "planner",
    "general",
    "critic",
    "synthesizer",
  ].every((role) => roleCoverage[role as TeamRole] > 0);

  return {
    providerCount: providers.length,
    familyCount: families.size,
    teamReady,
    independentReviewReady: families.size >= 2 && teamReady,
    roleCoverage,
    candidates: publicProviderReadiness(),
  };
}
