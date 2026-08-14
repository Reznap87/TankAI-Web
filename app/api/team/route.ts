import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import {
  requireApiIdentity,
  safetyIdentifier as createSafetyIdentifier,
} from "@/lib/auth";
import {
  appendMessage,
  CapabilityLeaseUnavailableError,
  completeRun,
  conversationModelHistory,
  createConversation,
  failRun,
  requireActiveProjectContext,
  requireCapabilityLeaseForRun,
  requireConversation,
  requireRunnableGoalContext,
  reserveDailyUsage,
  startRun,
} from "@/lib/database";
import { configuredProviders } from "@/lib/providers";
import {
  persistRunMemories,
  recallMemoryContext,
  type MemoryContext,
  type StoredMemorySummary,
} from "@/lib/memory-store";
import {
  ModelAccessError,
  runTankAITeam,
  type TeamMode,
} from "@/lib/team-runtime";
import { TANKAI_MASTER_PROMPT_VERSION } from "@/lib/tankai-master-prompt";

export const dynamic = "force-dynamic";

interface TeamRequestBody {
  message?: unknown;
  mode?: unknown;
  conversationId?: unknown;
  goalId?: unknown;
  projectId?: unknown;
  capabilityLeaseId?: unknown;
}

const MODE_CALLS: Record<TeamMode, number> = {
  fast: 1,
  team: 5,
  deep: 7,
};

function parseBody(value: TeamRequestBody): {
  message: string;
  mode: TeamMode;
  conversationId?: string;
  goalId?: string;
  projectId?: string;
  capabilityLeaseId?: string;
} {
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!message) throw new RequestValidationError("Die Nachricht ist leer.");
  if (message.length > 12_000) {
    throw new RequestValidationError(
      "Eine Nachricht darf höchstens 12.000 Zeichen enthalten.",
    );
  }
  const mode =
    value.mode === "fast" || value.mode === "deep" || value.mode === "team"
      ? value.mode
      : "team";
  const conversationId =
    typeof value.conversationId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value.conversationId,
    )
      ? value.conversationId
      : undefined;
  const goalId =
    typeof value.goalId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value.goalId,
    )
      ? value.goalId
      : undefined;
  if (value.goalId !== undefined && !goalId) {
    throw new RequestValidationError("Die Ziel-ID ist ungültig.");
  }
  const projectId =
    typeof value.projectId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value.projectId,
    )
      ? value.projectId
      : undefined;
  if (value.projectId !== undefined && !projectId) {
    throw new RequestValidationError("Die Projekt-ID ist ungültig.");
  }
  const capabilityLeaseId =
    typeof value.capabilityLeaseId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value.capabilityLeaseId,
    )
      ? value.capabilityLeaseId
      : undefined;
  if (value.capabilityLeaseId !== undefined && !capabilityLeaseId) {
    throw new RequestValidationError(
      "Die Ausführungsfreigabe-ID ist ungültig.",
    );
  }
  return {
    message,
    mode,
    ...(conversationId ? { conversationId } : {}),
    ...(goalId ? { goalId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(capabilityLeaseId ? { capabilityLeaseId } : {}),
  };
}

class RequestValidationError extends Error {
  readonly status = 400;
  readonly code = "INVALID_REQUEST";
}

function validationErrorResponse(error: RequestValidationError): Response {
  return jsonResponse(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new RequestValidationError(
      "Die Anfrage stammt nicht von TankAI Web.",
    );
  }
}

export async function POST(request: Request) {
  const started = performance.now();
  let activeRun:
    | { runId: string; userId: string }
    | undefined;
  let recalledMemory: MemoryContext | undefined;
  let storedMemory: StoredMemorySummary | undefined;
  const memoryWarnings: string[] = [];
  try {
    requireSameOrigin(request);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 24_000) {
      throw new RequestValidationError("Der Anfragekörper ist zu groß.");
    }
    const identity = await requireApiIdentity(request);
    const raw = (await request.json()) as TeamRequestBody;
    const body = parseBody(raw);
    const goalContext = body.goalId
      ? await requireRunnableGoalContext(body.goalId, identity.userId)
      : undefined;
    const projectContext = body.projectId
      ? await requireActiveProjectContext(body.projectId, identity.userId)
      : undefined;
    const providers = configuredProviders();
    if (providers.length === 0) throw new ModelAccessError();
    if (!body.capabilityLeaseId) {
      throw new CapabilityLeaseUnavailableError();
    }
    const capabilityLease = await requireCapabilityLeaseForRun({
      leaseId: body.capabilityLeaseId,
      userId: identity.userId,
      mode: body.mode,
      ...(projectContext ? { projectId: projectContext.id } : {}),
    });

    await reserveDailyUsage(identity.userId, MODE_CALLS[body.mode]);
    const conversationId =
      body.conversationId ??
      (await createConversation(identity.userId, body.message));
    if (body.conversationId) {
      await requireConversation(conversationId, identity.userId);
    }
    const history = await conversationModelHistory(
      conversationId,
      identity.userId,
    );
    try {
      recalledMemory = await recallMemoryContext({
        userId: identity.userId,
        query: body.message,
        ...(projectContext ? { projectId: projectContext.id } : {}),
      });
    } catch {
      memoryWarnings.push("Langzeitgedächtnis konnte für diesen Lauf nicht geladen werden.");
    }

    const runId = crypto.randomUUID();
    await startRun({
      runId,
      conversationId,
      userId: identity.userId,
      mode: body.mode,
      promptVersion: TANKAI_MASTER_PROMPT_VERSION,
      capabilityLeaseId: capabilityLease.id,
      ...(goalContext ? { goalId: goalContext.id } : {}),
      ...(projectContext ? { projectId: projectContext.id } : {}),
    });
    activeRun = { runId, userId: identity.userId };
    await appendMessage({
      conversationId,
      userId: identity.userId,
      role: "user",
      content: body.message,
    });
    const result = await runTankAITeam({
      runId,
      message: body.message,
      history,
      mode: body.mode,
      safetyIdentifier: await createSafetyIdentifier(identity.userId),
      signal: request.signal,
      providers,
      ...(goalContext ? { goalContext } : {}),
      ...(projectContext ? { projectContext } : {}),
      ...(recalledMemory ? { memoryContext: recalledMemory } : {}),
    });
    await appendMessage({
      conversationId,
      userId: identity.userId,
      role: "assistant",
      content: result.answer,
      runId,
    });
    await completeRun({
      runId,
      userId: identity.userId,
      trace: result.trace,
    });
    try {
      storedMemory = await persistRunMemories({
        userId: identity.userId,
        runId,
        message: body.message,
        answer: result.answer,
        mode: body.mode,
        trace: result.trace,
        ...(goalContext ? { goalId: goalContext.id } : {}),
        ...(projectContext ? { projectId: projectContext.id } : {}),
      });
    } catch {
      memoryWarnings.push("Der Lauf wurde abgeschlossen, aber neue Memory-Einträge konnten nicht gespeichert werden.");
    }
    return jsonResponse({
      runId,
      conversationId,
      answer: result.answer,
      trace: result.trace,
      memory: {
        embeddingModel: recalledMemory?.embeddingModel ?? "tank-hash-v1",
        recalled: recalledMemory?.entries.length ?? 0,
        stored: storedMemory
          ? {
              episodic: storedMemory.episodic,
              semantic: storedMemory.semantic,
              procedural: storedMemory.procedural,
            }
          : null,
        warnings: memoryWarnings,
      },
      authorization: {
        capability: capabilityLease.capability,
        leaseId: capabilityLease.id,
        consumed: true,
      },
      ...(goalContext
        ? {
            goal: {
              id: goalContext.id,
              version: goalContext.version,
              status: goalContext.status,
            },
          }
        : {}),
      ...(projectContext
        ? {
            project: {
              id: projectContext.id,
              version: projectContext.version,
              contentRevision: projectContext.contentRevision,
              includedDocumentCount:
                projectContext.includedDocumentCount,
              omittedDocumentNames: projectContext.omittedDocumentNames,
            },
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return validationErrorResponse(error);
    }
    if (activeRun) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code).slice(0, 80)
          : "RUN_FAILED";
      try {
        await failRun({
          ...activeRun,
          errorCode: code,
          elapsedMs: Math.round(performance.now() - started),
        });
      } catch {
        // Der ursprüngliche Laufzeitfehler bleibt die maßgebliche Antwort.
      }
    }
    return apiErrorResponse(error);
  }
}
